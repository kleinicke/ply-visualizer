//! Classic NetCDF (CDF-1 / CDF-2) decoder.
//!
//! Bit-exact port of `parseNetCdf` and its helpers (`NetCdfReader`,
//! `NC_TYPE_SIZE`/`NC_DIMENSION`/`NC_VARIABLE`/`NC_ATTRIBUTE`) in
//! `media/modules/scientific-format-parsers.ts`. Handles both the regular
//! raster path and the MPAS `nCells` polygon-mesh projection path, big-endian
//! sample order throughout, 4-byte record/name padding, and
//! `scale_factor`/`add_offset`/`_FillValue`/`missing_value` handling.
//!
//! `options_json` carries the small `NetCdfDecodeOptions` shape
//! (`{ variableName?, indices? }`) as JSON, parsed with the tiny reader in
//! `json_value.rs`.
//!
//! Held equal to the TS implementation by `test/rust-scientific-conformance-test.js`.

use super::json_value::{push_opt, to_json_string, JsonValue};
use super::scientific_common::{
    ascii, ceil4, get_slice, js_number, scaled_domain, ScientificParsed,
};
use crate::DecodeError;
use std::collections::{BTreeMap, HashMap};

const NC_DIMENSION: u32 = 10;
const NC_VARIABLE: u32 = 11;
const NC_ATTRIBUTE: u32 = 12;

fn type_size(t: u32) -> Option<usize> {
    match t {
        1 => Some(1),
        2 => Some(1),
        3 => Some(2),
        4 => Some(4),
        5 => Some(4),
        6 => Some(8),
        _ => None,
    }
}

#[derive(Clone)]
struct Dimension {
    name: String,
    size: usize,
    unlimited: bool,
}

#[derive(Clone)]
enum AttrValue {
    Str(String),
    Num(f64),
    NumArr(Vec<f64>),
}

fn find_attr<'a>(attrs: &'a [(String, AttrValue)], key: &str) -> Option<&'a AttrValue> {
    attrs.iter().find(|(k, _)| k == key).map(|(_, v)| v)
}

/// JS `finiteNumber(attrs.someKey, fallback)`, specialized for our `AttrValue`
/// union (which already collapses a single-element numeric array down to a
/// plain number, as the TS `attributes()` reader does).
fn finite_number_attr(v: Option<&AttrValue>, fallback: f64) -> f64 {
    match v {
        None => fallback,
        Some(AttrValue::Num(n)) => {
            if n.is_finite() {
                *n
            } else {
                fallback
            }
        }
        Some(AttrValue::NumArr(arr)) => match arr.len() {
            0 => 0.0, // Number([]) === 0
            1 => {
                if arr[0].is_finite() {
                    arr[0]
                } else {
                    fallback
                }
            } // Number([x]) === x
            _ => fallback, // Number([x, y, ...]) is NaN (comma-joined string)
        },
        Some(AttrValue::Str(s)) => {
            let n = js_number(s);
            if n.is_finite() {
                n
            } else {
                fallback
            }
        }
    }
}

/// `[attrs._FillValue, attrs.missing_value].flat().filter(v => typeof v === 'number')`.
fn fill_values(attrs: &[(String, AttrValue)]) -> Vec<f64> {
    let mut out = Vec::new();
    for key in ["_FillValue", "missing_value"] {
        match find_attr(attrs, key) {
            Some(AttrValue::Num(n)) => out.push(*n),
            Some(AttrValue::NumArr(arr)) => out.extend(arr.iter().copied()),
            _ => {}
        }
    }
    out
}

struct Variable {
    name: String,
    dim_ids: Vec<usize>,
    attrs: Vec<(String, AttrValue)>,
    var_type: u32,
    #[allow(dead_code)]
    vsize: u32,
    begin: f64,
}

struct Reader<'a> {
    data: &'a [u8],
    offset: usize,
}

impl<'a> Reader<'a> {
    fn u32(&mut self) -> Result<u32, DecodeError> {
        let b = get_slice(self.data, self.offset, 4, "NetCDF")?;
        self.offset += 4;
        Ok(u32::from_be_bytes([b[0], b[1], b[2], b[3]]))
    }

    /// Reads a big-endian u64 offset and converts it to f64, matching the TS
    /// `Number(view.getBigUint64(...))` + safe-integer guard.
    fn u64_as_f64(&mut self) -> Result<f64, DecodeError> {
        let b = get_slice(self.data, self.offset, 8, "NetCDF")?;
        self.offset += 8;
        let raw = u64::from_be_bytes([b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]]);
        let v = raw as f64;
        if v > 9_007_199_254_740_991.0 {
            return Err(DecodeError::new(
                "NetCDF offset exceeds JavaScript safe integer range",
            ));
        }
        Ok(v)
    }

    fn name(&mut self) -> Result<String, DecodeError> {
        let length = self.u32()? as usize;
        let s = ascii(self.data, self.offset, length);
        self.offset = self.offset.saturating_add(ceil4(length));
        Ok(s)
    }

    /// Mirrors TS `values(type, count)`: reads `count` samples of `type`,
    /// returning either the joined char string (type 2) or the numeric list.
    fn values(&mut self, var_type: u32, count: usize) -> Result<AttrRaw, DecodeError> {
        let size = type_size(var_type)
            .ok_or_else(|| DecodeError::new(&format!("Unsupported NetCDF type: {}", var_type)))?;
        if var_type == 2 {
            let total = count
                .checked_mul(size)
                .ok_or_else(|| DecodeError::new("NetCDF: size overflow"))?;
            let bytes = get_slice(self.data, self.offset, total, "NetCDF")?;
            let s: String = bytes.iter().map(|&b| b as char).collect();
            self.offset = self.offset.saturating_add(ceil4(total));
            return Ok(AttrRaw::Chars(s));
        }
        let mut nums = Vec::with_capacity(count);
        for i in 0..count {
            let byte_off = i
                .checked_mul(size)
                .and_then(|v| self.offset.checked_add(v))
                .ok_or_else(|| DecodeError::new("NetCDF: offset overflow"))?;
            let b = get_slice(self.data, byte_off, size, "NetCDF")?;
            let v = match var_type {
                1 => (b[0] as i8) as f64,
                3 => i16::from_be_bytes([b[0], b[1]]) as f64,
                4 => i32::from_be_bytes([b[0], b[1], b[2], b[3]]) as f64,
                5 => f32::from_be_bytes([b[0], b[1], b[2], b[3]]) as f64,
                6 => f64::from_be_bytes([b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]]),
                _ => unreachable!(),
            };
            nums.push(v);
        }
        let total = count
            .checked_mul(size)
            .ok_or_else(|| DecodeError::new("NetCDF: size overflow"))?;
        self.offset = self.offset.saturating_add(ceil4(total));
        Ok(AttrRaw::Nums(nums))
    }

    fn attributes(&mut self) -> Result<Vec<(String, AttrValue)>, DecodeError> {
        let tag = self.u32()?;
        if tag == 0 {
            self.u32()?;
            return Ok(Vec::new());
        }
        if tag != NC_ATTRIBUTE {
            return Err(DecodeError::new("Invalid NetCDF attribute list"));
        }
        let count = self.u32()? as usize;
        let mut attrs = Vec::with_capacity(count);
        for _ in 0..count {
            let name = self.name()?;
            let var_type = self.u32()?;
            let length = self.u32()? as usize;
            let raw = self.values(var_type, length)?;
            let value = match raw {
                AttrRaw::Chars(s) => AttrValue::Str(s.trim_end_matches('\0').to_string()),
                AttrRaw::Nums(nums) => {
                    if nums.len() == 1 {
                        AttrValue::Num(nums[0])
                    } else {
                        AttrValue::NumArr(nums)
                    }
                }
            };
            attrs.push((name, value));
        }
        Ok(attrs)
    }
}

enum AttrRaw {
    Chars(String),
    Nums(Vec<f64>),
}

/// Whether a variable describes the MESH rather than a field defined on it.
///
/// MPAS stores grid geometry and connectivity alongside the simulation output,
/// in the same `nCells` dimension, so both look equally displayable. These are
/// coordinates, areas, indices and adjacency lists — real data, but not what a
/// viewer should open by default.
fn is_mesh_geometry(name: &str) -> bool {
    const GEOMETRY: [&str; 10] = [
        "areaCell",
        "areaTriangle",
        "latCell",
        "lonCell",
        "xCell",
        "yCell",
        "zCell",
        "meshDensity",
        "maxLevelCell",
        "nEdgesOnCell",
    ];
    GEOMETRY.contains(&name)
        || name.starts_with("indexTo")
        || name.ends_with("OnCell")
        || name.ends_with("OnEdge")
        || name.ends_with("OnVertex")
}

fn variable_dimensions<'a>(
    variable: &Variable,
    dimensions: &'a [Dimension],
) -> Result<Vec<&'a Dimension>, DecodeError> {
    variable
        .dim_ids
        .iter()
        .map(|&id| {
            dimensions
                .get(id)
                .ok_or_else(|| DecodeError::new("NetCDF variable references an invalid dimension"))
        })
        .collect()
}

fn clamp_trunc(value: f64, size: usize) -> usize {
    if size == 0 {
        return 0;
    }
    let t = value.trunc();
    let t = if t.is_finite() { t } else { 0.0 };
    let clamped = t.max(0.0).min((size - 1) as f64);
    clamped as usize
}

/// Mirrors TS `storedValue(variable, indices)`.
fn stored_value(
    data: &[u8],
    variable: &Variable,
    dimensions: &[Dimension],
    record_size: f64,
    indices: &[f64],
) -> Result<f64, DecodeError> {
    let dims = variable_dimensions(variable, dimensions)?;
    let type_sz = type_size(variable.var_type).ok_or_else(|| {
        DecodeError::new(&format!(
            "Unsupported NetCDF variable type: {}",
            variable.var_type
        ))
    })?;
    let is_record = dims.first().map(|d| d.unlimited).unwrap_or(false);

    let mut linear: f64 = 0.0;
    let start = if is_record { 1 } else { 0 };
    for i in start..dims.len() {
        let idx_val = indices.get(i).copied().unwrap_or(0.0);
        let idx_val = if idx_val.is_finite() { idx_val } else { 0.0 };
        linear = linear * dims[i].size as f64 + clamp_trunc(idx_val, dims[i].size) as f64;
    }
    let record_index = if is_record {
        let idx_val = indices.first().copied().unwrap_or(0.0);
        let idx_val = if idx_val.is_finite() { idx_val } else { 0.0 };
        clamp_trunc(idx_val, dims[0].size) as f64
    } else {
        0.0
    };

    let p = variable.begin + record_index * record_size + linear * type_sz as f64;
    if !(p >= 0.0) || p + (type_sz as f64) > data.len() as f64 {
        return Err(DecodeError::new(&format!(
            "Truncated NetCDF variable data: {}",
            variable.name
        )));
    }
    let offset = p as usize;
    let b = get_slice(data, offset, type_sz, "NetCDF")?;
    let stored = match variable.var_type {
        1 => (b[0] as i8) as f64,
        3 => i16::from_be_bytes([b[0], b[1]]) as f64,
        4 => i32::from_be_bytes([b[0], b[1], b[2], b[3]]) as f64,
        5 => f32::from_be_bytes([b[0], b[1], b[2], b[3]]) as f64,
        6 => f64::from_be_bytes([b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]]),
        _ => {
            return Err(DecodeError::new(&format!(
                "Unsupported NetCDF variable type: {}",
                variable.var_type
            )))
        }
    };

    if fill_values(&variable.attrs).iter().any(|&fv| stored == fv) {
        return Ok(f64::NAN);
    }
    Ok(
        stored * finite_number_attr(find_attr(&variable.attrs, "scale_factor"), 1.0)
            + finite_number_attr(find_attr(&variable.attrs, "add_offset"), 0.0),
    )
}

fn is_numeric(variable: &Variable) -> bool {
    variable.var_type != 2 && type_size(variable.var_type).is_some()
}

/// `/^(?:lat|lon|x|y|z)Cell$|^indexToCellID$|^(?:cells|edges|vertices)OnCell$|^nEdgesOnCell$/i`
fn is_topology_name(name: &str) -> bool {
    matches!(
        name.to_lowercase().as_str(),
        "latcell"
            | "loncell"
            | "xcell"
            | "ycell"
            | "zcell"
            | "indextocellid"
            | "cellsoncell"
            | "edgesoncell"
            | "verticesoncell"
            | "nedgesoncell"
    )
}

struct Point {
    x: f64,
    y: f64,
}

/// Mirrors TS `fillPolygon`: scanline-fills `points` into `data` (width x
/// height), wrapping horizontally at +-`width` to handle antimeridian
/// crossing.
fn fill_polygon(data: &mut [f32], width: usize, height: usize, points: &[Point], value: f32) {
    if points.len() < 3 || !value.is_finite() {
        return;
    }
    for &shift in &[-(width as f64), 0.0, width as f64] {
        let shifted: Vec<Point> = points
            .iter()
            .map(|p| Point {
                x: p.x + shift,
                y: p.y,
            })
            .collect();
        let min_y = shifted
            .iter()
            .map(|p| p.y)
            .fold(f64::INFINITY, f64::min)
            .floor()
            .max(0.0);
        let max_y = shifted
            .iter()
            .map(|p| p.y)
            .fold(f64::NEG_INFINITY, f64::max)
            .ceil()
            .min((height - 1) as f64);
        if !(min_y.is_finite() && max_y.is_finite()) {
            continue;
        }
        let mut y = min_y as i64;
        let max_y_i = max_y as i64;
        while y <= max_y_i {
            let scan_y = y as f64 + 0.5;
            let mut intersections: Vec<f64> = Vec::new();
            let mut previous = shifted.len().wrapping_sub(1);
            for i in 0..shifted.len() {
                let a = &shifted[previous];
                let b = &shifted[i];
                if (a.y > scan_y) != (b.y > scan_y) {
                    intersections.push(a.x + (scan_y - a.y) * (b.x - a.x) / (b.y - a.y));
                }
                previous = i;
            }
            intersections.sort_by(|a, b| a.partial_cmp(b).unwrap_or(std::cmp::Ordering::Equal));
            let mut pair = 0usize;
            while pair + 1 < intersections.len() {
                let from = intersections[pair].ceil().max(0.0);
                let to = intersections[pair + 1].floor().min((width - 1) as f64);
                if from.is_finite() && to.is_finite() {
                    let mut x = from as i64;
                    let to_i = to as i64;
                    while x <= to_i {
                        if x >= 0 && (x as usize) < width {
                            data[y as usize * width + x as usize] = value;
                        }
                        x += 1;
                    }
                }
                pair += 2;
            }
            y += 1;
        }
    }
}

fn dims_json(dims: &[&Dimension]) -> JsonValue {
    JsonValue::Arr(
        dims.iter()
            .map(|d| {
                JsonValue::Obj(vec![
                    ("name".to_string(), JsonValue::Str(d.name.clone())),
                    ("size".to_string(), JsonValue::Num(d.size as f64)),
                ])
            })
            .collect(),
    )
}

fn attr_to_json(v: &AttrValue) -> JsonValue {
    match v {
        AttrValue::Str(s) => JsonValue::Str(s.clone()),
        AttrValue::Num(n) => JsonValue::Num(*n),
        AttrValue::NumArr(arr) => JsonValue::Arr(arr.iter().map(|&n| JsonValue::Num(n)).collect()),
    }
}

/// `{ variableName?: string, indices?: Record<string, number> }`, parsed
/// from the small JSON blob the worker sends.
struct DecodeOptions {
    variable_name: Option<String>,
    indices: HashMap<String, f64>,
}

fn parse_options(options_json: &str) -> DecodeOptions {
    let mut out = DecodeOptions {
        variable_name: None,
        indices: HashMap::new(),
    };
    if options_json.trim().is_empty() {
        return out;
    }
    let Ok(root) = super::json_value::parse(options_json) else {
        return out;
    };
    if let Some(name) = root.get("variableName").and_then(|v| v.as_str()) {
        out.variable_name = Some(name.to_string());
    }
    if let Some(indices) = root.get("indices").and_then(|v| v.as_obj()) {
        for (k, v) in indices {
            if let Some(n) = v.as_num() {
                out.indices.insert(k.clone(), n);
            }
        }
    }
    out
}

/// Decode classic NetCDF CDF-1/CDF-2 as either a regular raster or an MPAS
/// cell mesh.
pub(crate) fn decode_netcdf_impl(
    data: &[u8],
    options_json: &str,
) -> Result<ScientificParsed, DecodeError> {
    if data.len() < 8 || ascii(data, 0, 3) != "CDF" {
        if data.len() >= 8 && data[0] == 0x89 && ascii(data, 1, 3) == "HDF" {
            return Err(DecodeError::new(
                "NetCDF-4/HDF5 is not supported yet; use classic NetCDF (CDF-1 or CDF-2)",
            ));
        }
        return Err(DecodeError::new("Invalid NetCDF signature"));
    }
    let version = data[3];
    if version != 1 && version != 2 {
        return Err(DecodeError::new(&format!(
            "Unsupported NetCDF format version: CDF-{}",
            version
        )));
    }
    let options = parse_options(options_json);

    let mut reader = Reader { data, offset: 4 };
    let num_records = reader.u32()? as f64;
    let dim_tag = reader.u32()?;
    let mut dimensions: Vec<Dimension> = Vec::new();
    if dim_tag == 0 {
        reader.u32()?;
    } else {
        if dim_tag != NC_DIMENSION {
            return Err(DecodeError::new("Invalid NetCDF dimension list"));
        }
        let count = reader.u32()? as usize;
        for _ in 0..count {
            let name = reader.name()?;
            let declared_size = reader.u32()? as f64;
            let size = if declared_size == 0.0 {
                num_records
            } else {
                declared_size
            };
            dimensions.push(Dimension {
                name,
                size: size.max(0.0) as usize,
                unlimited: declared_size == 0.0,
            });
        }
    }
    reader.attributes()?;
    let var_tag = reader.u32()?;
    if var_tag == 0 {
        reader.u32()?;
        return Err(DecodeError::new("NetCDF file contains no variables"));
    }
    if var_tag != NC_VARIABLE {
        return Err(DecodeError::new("Invalid NetCDF variable list"));
    }
    let variable_count = reader.u32()? as usize;
    let mut variables: Vec<Variable> = Vec::with_capacity(variable_count);
    for _ in 0..variable_count {
        let name = reader.name()?;
        let dim_count = reader.u32()? as usize;
        let mut dim_ids = Vec::with_capacity(dim_count);
        for _ in 0..dim_count {
            dim_ids.push(reader.u32()? as usize);
        }
        let attrs = reader.attributes()?;
        let var_type = reader.u32()?;
        let vsize = reader.u32()?;
        let begin = if version == 1 {
            reader.u32()? as f64
        } else {
            reader.u64_as_f64()?
        };
        variables.push(Variable {
            name,
            dim_ids,
            attrs,
            var_type,
            vsize,
            begin,
        });
    }

    let record_size: f64 = variables
        .iter()
        .filter(|v| {
            v.dim_ids
                .first()
                .and_then(|&id| dimensions.get(id))
                .map(|d| d.unlimited)
                .unwrap_or(false)
        })
        .map(|v| (v.vsize as f64 / 4.0).ceil() * 4.0)
        .sum();

    let mut variable_by_name: HashMap<String, usize> = HashMap::new();
    for (i, v) in variables.iter().enumerate() {
        variable_by_name.insert(v.name.clone(), i);
    }

    let cell_dimension = dimensions.iter().position(|d| d.name == "nCells");
    let has_mpas_geometry = cell_dimension.is_some()
        && ["latVertex", "lonVertex", "verticesOnCell", "nEdgesOnCell"]
            .iter()
            .all(|n| variable_by_name.contains_key(*n));

    let mesh_indices: Vec<usize> = if has_mpas_geometry {
        let cd = cell_dimension.unwrap();
        variables
            .iter()
            .enumerate()
            .filter(|(_, v)| is_numeric(v) && v.dim_ids.contains(&cd) && !is_topology_name(&v.name))
            .map(|(i, _)| i)
            .collect()
    } else {
        Vec::new()
    };
    let raster_indices: Vec<usize> = variables
        .iter()
        .enumerate()
        .filter_map(|(i, v)| {
            if !is_numeric(v) || v.dim_ids.len() < 2 || is_topology_name(&v.name) {
                return None;
            }
            let dims = variable_dimensions(v, &dimensions).ok()?;
            let n = dims.len();
            if dims[n - 1].size > 1 && dims[n - 2].size > 1 {
                Some(i)
            } else {
                None
            }
        })
        .collect();

    let candidates: &[usize] = if !mesh_indices.is_empty() {
        &mesh_indices
    } else {
        &raster_indices
    };
    if candidates.is_empty() {
        return Err(DecodeError::new(
            "NetCDF file contains no supported raster or MPAS cell variable",
        ));
    }

    let selected_idx: usize = candidates
        .iter()
        .find(|&&i| Some(&variables[i].name) == options.variable_name.as_ref())
        .copied()
        // Default to a simulated field rather than the grid it was computed on.
        // An MPAS file carries both under the same `nCells` dimension, and the
        // geometry sorts first by file order, so a naive "first candidate" (or
        // the old hard-coded list, which put `areaCell` at the front) opens an
        // ocean model showing cell areas in m^2 — a nearly flat picture of the
        // mesh rather than the data the file was opened for.
        //
        // Among the remaining candidates, prefer one that varies over the
        // record (time) dimension. Those are the prognostic fields; a
        // cell-only variable is typically static (`h_s`, the channel floor in
        // the MPAS test case, is a constant -5000 everywhere and renders as a
        // single flat colour).
        .or_else(|| {
            let is_field = |i: &&usize| !is_mesh_geometry(&variables[**i].name);
            let time_varying = |i: &&usize| {
                variable_dimensions(&variables[**i], &dimensions)
                    .map(|dims| dims.first().map(|d| d.unlimited).unwrap_or(false))
                    .unwrap_or(false)
            };
            candidates
                .iter()
                .filter(is_field)
                .find(time_varying)
                .copied()
                .or_else(|| candidates.iter().find(is_field).copied())
        })
        .unwrap_or(candidates[0]);

    let selected_bits = (type_size(variables[selected_idx].var_type).unwrap_or(0) * 8) as u32;
    let selected_sample_format: u32 = if variables[selected_idx].var_type >= 5 {
        3
    } else {
        2
    };
    let selected_scale = finite_number_attr(
        find_attr(&variables[selected_idx].attrs, "scale_factor"),
        1.0,
    );
    let selected_offset =
        finite_number_attr(find_attr(&variables[selected_idx].attrs, "add_offset"), 0.0);
    let selected_stored_min = if selected_sample_format == 3 {
        0.0
    } else {
        -(2f64.powi(selected_bits as i32 - 1))
    };
    let selected_stored_max = if selected_sample_format == 3 {
        1.0
    } else {
        2f64.powi(selected_bits as i32 - 1) - 1.0
    };
    let (type_min, type_max) = scaled_domain(
        selected_stored_min,
        selected_stored_max,
        selected_scale,
        selected_offset,
    );
    let selected_source_numeric_type: &str = if selected_sample_format == 3 {
        if selected_bits <= 32 {
            "float32"
        } else {
            "float64"
        }
    } else if selected_bits <= 8 {
        "int8"
    } else if selected_bits <= 16 {
        "int16"
    } else {
        "int32"
    };

    let selected_dimensions = variable_dimensions(&variables[selected_idx], &dimensions)?;
    // BTreeMap, not HashMap: this map is serialized into `metadata.selectedIndices`,
    // and HashMap iteration order varies between builds — which made the emitted
    // JSON key order (and therefore the golden files and the metadata panel's
    // display order) non-deterministic.
    let selected_indices: BTreeMap<String, usize> = selected_dimensions
        .iter()
        .map(|d| {
            let raw = options.indices.get(&d.name).copied().unwrap_or(0.0);
            let raw = if raw == 0.0 || !raw.is_finite() {
                0.0
            } else {
                raw
            };
            (d.name.clone(), clamp_trunc(raw, d.size))
        })
        .collect();

    let variable_choices: Vec<JsonValue> = candidates
        .iter()
        .map(|&i| {
            let v = &variables[i];
            let dims = variable_dimensions(v, &dimensions).unwrap_or_default();
            let label = match find_attr(&v.attrs, "long_name") {
                Some(AttrValue::Str(s)) if !s.is_empty() => s.clone(),
                Some(AttrValue::Num(n)) => super::json_value::format_number(*n),
                _ => v.name.clone(),
            };
            let mut fields = vec![
                ("name".to_string(), JsonValue::Str(v.name.clone())),
                ("label".to_string(), JsonValue::Str(label)),
                ("dimensions".to_string(), dims_json(&dims)),
            ];
            push_opt(
                &mut fields,
                "unit",
                find_attr(&v.attrs, "units").map(attr_to_json),
            );
            JsonValue::Obj(fields)
        })
        .collect();

    let format_str = format!("NetCDF CDF-{}", version);

    if mesh_indices.contains(&selected_idx) {
        let cd = cell_dimension.unwrap();
        let selected = &variables[selected_idx];
        let cell_axis = selected.dim_ids.iter().position(|&id| id == cd);

        let selectors: Vec<JsonValue> = selected_dimensions
            .iter()
            .enumerate()
            .filter(|(i, _)| Some(*i) != cell_axis)
            .map(|(_, d)| {
                JsonValue::Obj(vec![
                    ("name".to_string(), JsonValue::Str(d.name.clone())),
                    ("size".to_string(), JsonValue::Num(d.size as f64)),
                    (
                        "value".to_string(),
                        JsonValue::Num(*selected_indices.get(&d.name).unwrap_or(&0) as f64),
                    ),
                ])
            })
            .collect();

        let cell_count = dimensions[cd].size;
        let mut cell_values = vec![0f32; cell_count];
        for cell in 0..cell_count {
            let indices: Vec<f64> = selected_dimensions
                .iter()
                .enumerate()
                .map(|(i, d)| {
                    if Some(i) == cell_axis {
                        cell as f64
                    } else {
                        *selected_indices.get(&d.name).unwrap_or(&0) as f64
                    }
                })
                .collect();
            cell_values[cell] =
                stored_value(data, selected, &dimensions, record_size, &indices)? as f32;
        }

        let lat_vertex_idx = *variable_by_name.get("latVertex").unwrap();
        let lon_vertex_idx = *variable_by_name.get("lonVertex").unwrap();
        let vertices_on_cell_idx = *variable_by_name.get("verticesOnCell").unwrap();
        let n_edges_on_cell_idx = *variable_by_name.get("nEdgesOnCell").unwrap();

        let lat_vertex_dims = variable_dimensions(&variables[lat_vertex_idx], &dimensions)?;
        let vertex_count = lat_vertex_dims.first().map(|d| d.size).unwrap_or(0);
        let voc_dims = variable_dimensions(&variables[vertices_on_cell_idx], &dimensions)?;
        let max_edges = voc_dims.get(1).map(|d| d.size).unwrap_or(0);

        let mut latitudes = vec![0f64; vertex_count];
        let mut longitudes = vec![0f64; vertex_count];
        for vertex in 0..vertex_count {
            latitudes[vertex] = stored_value(
                data,
                &variables[lat_vertex_idx],
                &dimensions,
                record_size,
                &[vertex as f64],
            )?;
            longitudes[vertex] = stored_value(
                data,
                &variables[lon_vertex_idx],
                &dimensions,
                record_size,
                &[vertex as f64],
            )?;
        }
        let max_abs_lat =
            latitudes.iter().fold(
                0.0f64,
                |acc, &v| if v.is_finite() { acc.max(v.abs()) } else { acc },
            );
        let angular_scale = if max_abs_lat > std::f64::consts::PI {
            std::f64::consts::PI / 180.0
        } else {
            1.0
        };

        let width: usize = 720;
        let height: usize = 360;
        let mut out = vec![f32::NAN; width * height];

        for cell in 0..cell_count {
            let raw_edge_count = stored_value(
                data,
                &variables[n_edges_on_cell_idx],
                &dimensions,
                record_size,
                &[cell as f64],
            )?;
            let edge_count = if raw_edge_count.is_finite() {
                raw_edge_count.trunc().max(0.0).min(max_edges as f64) as usize
            } else {
                0
            };
            let mut points: Vec<Point> = Vec::with_capacity(edge_count);
            for edge in 0..edge_count {
                let raw_vertex = stored_value(
                    data,
                    &variables[vertices_on_cell_idx],
                    &dimensions,
                    record_size,
                    &[cell as f64, edge as f64],
                )?;
                if !raw_vertex.is_finite() {
                    continue;
                }
                let vertex = raw_vertex.trunc() as i64 - 1;
                if vertex < 0 || vertex as usize >= vertex_count {
                    continue;
                }
                let vertex = vertex as usize;
                let lon = longitudes[vertex] * angular_scale;
                let lat = latitudes[vertex] * angular_scale;
                let mut x =
                    ((lon + std::f64::consts::PI) / (2.0 * std::f64::consts::PI)) * width as f64;
                let y = ((std::f64::consts::PI / 2.0 - lat) / std::f64::consts::PI) * height as f64;
                if let Some(first) = points.first() {
                    while x - first.x > width as f64 / 2.0 {
                        x -= width as f64;
                    }
                    while x - first.x < -(width as f64) / 2.0 {
                        x += width as f64;
                    }
                }
                points.push(Point { x, y });
            }
            fill_polygon(&mut out, width, height, &points, cell_values[cell]);
        }

        let selected = &variables[selected_idx];
        let mut fields = vec![
            ("format".to_string(), JsonValue::Str(format_str)),
            (
                "variable".to_string(),
                JsonValue::Str(selected.name.clone()),
            ),
        ];
        push_opt(
            &mut fields,
            "unit",
            find_attr(&selected.attrs, "units").map(attr_to_json),
        );
        push_opt(
            &mut fields,
            "longName",
            find_attr(&selected.attrs, "long_name").map(attr_to_json),
        );
        fields.push((
            "viewMode".to_string(),
            JsonValue::Str("mpas-mesh".to_string()),
        ));
        fields.push((
            "projection".to_string(),
            JsonValue::Str("Equirectangular".to_string()),
        ));
        fields.push((
            "meshLocation".to_string(),
            JsonValue::Str("nCells".to_string()),
        ));
        fields.push(("variables".to_string(), JsonValue::Arr(variable_choices)));
        fields.push(("selectors".to_string(), JsonValue::Arr(selectors)));
        fields.push((
            "selectedIndices".to_string(),
            JsonValue::Obj(
                selected_indices
                    .iter()
                    .map(|(k, &v)| (k.clone(), JsonValue::Num(v as f64)))
                    .collect(),
            ),
        ));
        let metadata_json = to_json_string(&JsonValue::Obj(fields));

        return Ok(ScientificParsed {
            width: width as u32,
            height: height as u32,
            channels: 1,
            bits_per_sample: selected_bits,
            sample_format: selected_sample_format,
            type_min,
            type_max,
            source_numeric_type: selected_source_numeric_type.to_string(),
            metadata_json,
            data: out,
        });
    }

    // --- Regular raster path -------------------------------------------------
    let n = selected_dimensions.len();
    if n < 2 {
        return Err(DecodeError::new(
            "NetCDF file contains no supported raster or MPAS cell variable",
        ));
    }
    let width = selected_dimensions[n - 1].size;
    let height = selected_dimensions[n - 2].size;

    let selectors: Vec<JsonValue> = selected_dimensions[..n - 2]
        .iter()
        .map(|d| {
            JsonValue::Obj(vec![
                ("name".to_string(), JsonValue::Str(d.name.clone())),
                ("size".to_string(), JsonValue::Num(d.size as f64)),
                (
                    "value".to_string(),
                    JsonValue::Num(*selected_indices.get(&d.name).unwrap_or(&0) as f64),
                ),
            ])
        })
        .collect();

    let pixel_count = width
        .checked_mul(height)
        .ok_or_else(|| DecodeError::new("NetCDF raster dimensions overflow"))?;
    let mut out = vec![0f32; pixel_count];
    let selected = &variables[selected_idx];
    for y in 0..height {
        for x in 0..width {
            let indices: Vec<f64> = selected_dimensions
                .iter()
                .enumerate()
                .map(|(i, d)| {
                    if i == n - 2 {
                        y as f64
                    } else if i == n - 1 {
                        x as f64
                    } else {
                        *selected_indices.get(&d.name).unwrap_or(&0) as f64
                    }
                })
                .collect();
            out[y * width + x] =
                stored_value(data, selected, &dimensions, record_size, &indices)? as f32;
        }
    }

    let mut fields = vec![
        ("format".to_string(), JsonValue::Str(format_str)),
        (
            "variable".to_string(),
            JsonValue::Str(selected.name.clone()),
        ),
        ("dimensions".to_string(), dims_json(&selected_dimensions)),
    ];
    push_opt(
        &mut fields,
        "unit",
        find_attr(&selected.attrs, "units").map(attr_to_json),
    );
    push_opt(
        &mut fields,
        "longName",
        find_attr(&selected.attrs, "long_name").map(attr_to_json),
    );
    fields.push(("viewMode".to_string(), JsonValue::Str("raster".to_string())));
    fields.push(("variables".to_string(), JsonValue::Arr(variable_choices)));
    fields.push(("selectors".to_string(), JsonValue::Arr(selectors)));
    fields.push((
        "selectedIndices".to_string(),
        JsonValue::Obj(
            selected_indices
                .iter()
                .map(|(k, &v)| (k.clone(), JsonValue::Num(v as f64)))
                .collect(),
        ),
    ));
    let metadata_json = to_json_string(&JsonValue::Obj(fields));

    Ok(ScientificParsed {
        width: width as u32,
        height: height as u32,
        channels: 1,
        bits_per_sample: selected_bits,
        sample_format: selected_sample_format,
        type_min,
        type_max,
        source_numeric_type: selected_source_numeric_type.to_string(),
        metadata_json,
        data: out,
    })
}

