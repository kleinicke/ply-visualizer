//! Indexed NPY/NPZ datasets. Headers are inspected without decoding samples;
//! only the selected member is inflated, and only the selected plane converted.
use super::json_value::{self, to_json_string, JsonValue as J};
use super::npy::{extract_group, numeric_info_from_dtype, read_header, read_npy_samples};
use crate::{DecodeError, DecodedArray};
use std::io::Read;

fn error(message: &str) -> DecodeError {
    DecodeError::new(message)
}
fn bytes(data: &[u8], offset: usize, count: usize) -> Result<&[u8], DecodeError> {
    data.get(
        offset
            ..offset
                .checked_add(count)
                .ok_or_else(|| error("NumPy offset overflow"))?,
    )
    .ok_or_else(|| error("Truncated NumPy data"))
}
fn u16_at(data: &[u8], offset: usize) -> Result<usize, DecodeError> {
    Ok(u16::from_le_bytes(bytes(data, offset, 2)?.try_into().unwrap()) as usize)
}
fn u32_at(data: &[u8], offset: usize) -> Result<usize, DecodeError> {
    Ok(u32::from_le_bytes(bytes(data, offset, 4)?.try_into().unwrap()) as usize)
}
fn u64_at(data: &[u8], offset: usize) -> Result<usize, DecodeError> {
    usize::try_from(u64::from_le_bytes(
        bytes(data, offset, 8)?.try_into().unwrap(),
    ))
    .map_err(|_| error("NumPy archive exceeds addressable memory"))
}
fn string(value: impl Into<String>) -> J {
    J::Str(value.into())
}
fn number(value: usize) -> J {
    J::Num(value as f64)
}
fn field(key: &str, value: J) -> (String, J) {
    (key.to_string(), value)
}
fn index(options: &J, name: &str, size: usize, default: usize) -> usize {
    options
        .get("indices")
        .and_then(|v| v.get(name))
        .and_then(J::as_num)
        .filter(|v| v.is_finite() && *v >= 0.0)
        .map(|v| v as usize)
        .unwrap_or(default)
        .min(size.saturating_sub(1))
}
fn selector(name: &str, size: usize, value: usize, labels: Option<Vec<J>>) -> J {
    let mut fields = vec![
        field("name", string(name)),
        field("size", number(size)),
        field("value", number(value)),
    ];
    if let Some(labels) = labels {
        fields.push(field("labels", J::Arr(labels)));
    }
    J::Obj(fields)
}

#[derive(Clone)]
struct Header {
    shape: Vec<usize>,
    dtype: String,
    offset: usize,
    item_size: usize,
    fortran: bool,
}
impl Header {
    fn parse(data: &[u8]) -> Result<Self, DecodeError> {
        let (text, offset) = read_header(data, true)?;
        // NPY's dictionary is Python literal syntax, not JSON. NumPy emits
        // single quotes; accept double-quoted keys and string values as well.
        let text = text.replace('"', "'");
        let dtype = extract_group(&text, "'descr':", '\'', '\'')
            .ok_or_else(|| error("NPY missing dtype"))?;
        let shape = extract_group(&text, "'shape':", '(', ')')
            .ok_or_else(|| error("NPY missing shape"))?
            .split(',')
            .map(str::trim)
            .filter(|v| !v.is_empty())
            .map(|v| v.parse::<usize>().map_err(|_| error("Invalid NPY shape")))
            .collect::<Result<Vec<_>, _>>()?;
        let descriptor = dtype.trim_start_matches(['<', '>', '=', '|']);
        let supported = matches!(
            descriptor,
            "f2" | "f4" | "f8" | "u1" | "u2" | "u4" | "u8" | "i1" | "i2" | "i4" | "i8" | "b1"
        );
        if !supported {
            return Err(error(&format!(
                "Unsupported NPY dtype {dtype} (numeric arrays only; pickle is never executed)"
            )));
        }
        let item_size = descriptor[1..].parse::<usize>().unwrap();
        if dtype.starts_with('|') && item_size != 1 {
            return Err(error("NPY multi-byte dtype requires an endian marker"));
        }
        let fortran_text = text
            .split("'fortran_order':")
            .nth(1)
            .ok_or_else(|| error("NPY missing fortran_order"))?
            .trim_start();
        let fortran = if fortran_text.starts_with("True") {
            true
        } else if fortran_text.starts_with("False") {
            false
        } else {
            return Err(error("Invalid NPY fortran_order"));
        };
        let dtype = if !dtype.starts_with(['<', '>', '=', '|']) {
            format!("={dtype}")
        } else {
            dtype
        };
        Ok(Self {
            shape,
            dtype,
            offset,
            item_size,
            fortran,
        })
    }
    fn length(&self) -> Result<usize, DecodeError> {
        self.shape.iter().try_fold(self.item_size, |n, d| {
            n.checked_mul(*d)
                .ok_or_else(|| error("NPY shape overflows addressable memory"))
        })
    }
}

struct Entry {
    name: String,
    offset: usize,
    compressed: usize,
    size: usize,
    method: usize,
    header: Result<Header, String>,
}

/// One source and at most one inflated member are retained. Moving between
/// slices never re-reads the source or re-inflates the selected array.
pub struct NumpyDataset {
    source: Vec<u8>,
    entries: Vec<Entry>,
    inflated: Option<(usize, Vec<u8>)>,
}
impl NumpyDataset {
    pub fn new(source: Vec<u8>) -> Result<Self, DecodeError> {
        let mut entries = if source.starts_with(b"\x93NUMPY") {
            vec![Entry {
                name: "array".into(),
                offset: 0,
                compressed: source.len(),
                size: source.len(),
                method: 0,
                header: Header::parse(&source).map_err(|e| e.to_string()),
            }]
        } else {
            directory(&source)?
        };
        for entry in &mut entries {
            if entry.method == 0 {
                entry.header = bytes(&source, entry.offset, entry.compressed)
                    .and_then(Header::parse)
                    .map_err(|e| e.to_string());
            } else if entry.method == 8 {
                // Inflate only a bounded header prefix during discovery.
                entry.header = (|| {
                    let mut decoder = flate2::read::DeflateDecoder::new(bytes(
                        &source,
                        entry.offset,
                        entry.compressed,
                    )?);
                    let mut prefix = [0u8; 12];
                    decoder
                        .read_exact(&mut prefix)
                        .map_err(|_| error("Invalid compressed NPY header"))?;
                    let start = if prefix[6] == 1 { 10 } else { 12 };
                    let len = if start == 10 {
                        u16_at(&prefix, 8)?
                    } else {
                        u32_at(&prefix, 8)?
                    };
                    if len > 1024 * 1024 {
                        return Err(error("NPY header exceeds 1 MiB"));
                    }
                    let total = start + len;
                    if total < prefix.len() || total > entry.size {
                        return Err(error("Invalid NPY header length"));
                    }
                    let mut header = vec![0; total];
                    header[..12].copy_from_slice(&prefix);
                    decoder
                        .read_exact(&mut header[12..])
                        .map_err(|_| error("Truncated compressed NPY header"))?;
                    Header::parse(&header)
                })()
                .map_err(|e: DecodeError| e.to_string());
            }
        }
        if entries.is_empty() {
            return Err(error("NPZ contains no .npy arrays"));
        }
        Ok(Self {
            source,
            entries,
            inflated: None,
        })
    }

    pub fn decode(&mut self, options_json: &str) -> Result<DecodedArray, DecodeError> {
        let options = json_value::parse(options_json).map_err(|e| error(&e))?;
        let candidates: Vec<usize> = self
            .entries
            .iter()
            .enumerate()
            .filter_map(|(i, entry)| {
                entry
                    .header
                    .as_ref()
                    .ok()
                    .filter(|h| !h.shape.contains(&0))
                    .map(|_| i)
            })
            .collect();
        if candidates.is_empty() {
            return Err(error(&format!(
                "No supported numeric arrays: {}",
                self.entries
                    .iter()
                    .map(|e| format!(
                        "{}: {}",
                        e.name,
                        e.header
                            .as_ref()
                            .err()
                            .map(String::as_str)
                            .unwrap_or("empty array")
                    ))
                    .collect::<Vec<_>>()
                    .join("; ")
            )));
        }
        // Prefer image-sized arrays over camera matrices/vectors, retaining a
        // predictable archive order among equally suitable candidates.
        let default = candidates
            .iter()
            .position(|&i| {
                self.entries[i]
                    .header
                    .as_ref()
                    .is_ok_and(|h| h.shape.iter().filter(|&&d| d > 4).count() >= 2)
            })
            .or_else(|| {
                candidates
                    .iter()
                    .position(|&i| self.entries[i].header.as_ref().unwrap().shape.len() >= 2)
            })
            .unwrap_or(0);
        let choice = index(&options, "Array", candidates.len(), default);
        let selected = candidates[choice];
        let entry = &self.entries[selected];
        let header = entry.header.as_ref().unwrap().clone();
        let ndim = header.shape.len();
        let mut layouts = vec![(None, "Grayscale / stack")];
        if ndim >= 3 {
            if matches!(header.shape[ndim - 1], 1 | 3 | 4) {
                layouts.push((Some(ndim - 1), "Channels last"));
            }
            if matches!(header.shape[ndim - 3], 1 | 3 | 4) {
                layouts.push((Some(ndim - 3), "Channels first"));
            }
        }
        // A leading 3 is commonly a view count, so auto only recognizes HWC.
        let default_layout = usize::from(layouts.get(1).is_some_and(|l| l.0 == Some(ndim - 1)));
        let layout = index(&options, "Layout", layouts.len(), default_layout);
        let channel_axis = layouts[layout].0;
        let spatial: Vec<usize> = (0..ndim)
            .filter(|axis| Some(*axis) != channel_axis)
            .collect();
        let x_axis = spatial.last().copied();
        let y_axis = spatial.iter().rev().nth(1).copied();
        let width = x_axis.map(|a| header.shape[a]).unwrap_or(1);
        let height = y_axis.map(|a| header.shape[a]).unwrap_or(1);
        let channels = channel_axis.map(|a| header.shape[a]).unwrap_or(1);
        let mut coordinates = vec![0; ndim];
        let mut selectors = Vec::new();
        let mut indices = vec![
            field("Array", number(choice)),
            field("Layout", number(layout)),
        ];
        if candidates.len() > 1 {
            selectors.push(selector(
                "Array",
                candidates.len(),
                choice,
                Some(
                    candidates
                        .iter()
                        .map(|&i| {
                            let e = &self.entries[i];
                            let h = e.header.as_ref().unwrap();
                            string(format!(
                                "{}  ({})  {}",
                                e.name,
                                h.shape
                                    .iter()
                                    .map(usize::to_string)
                                    .collect::<Vec<_>>()
                                    .join(" × "),
                                h.dtype
                            ))
                        })
                        .collect(),
                ),
            ));
        }
        if layouts.len() > 1 {
            selectors.push(selector(
                "Layout",
                layouts.len(),
                layout,
                Some(layouts.iter().map(|l| string(l.1)).collect()),
            ));
        }
        for (axis, coordinate) in coordinates.iter_mut().enumerate() {
            if Some(axis) == x_axis || Some(axis) == y_axis || Some(axis) == channel_axis {
                continue;
            }
            let name = format!("Axis {axis}");
            *coordinate = index(&options, &name, header.shape[axis], 0);
            selectors.push(selector(&name, header.shape[axis], *coordinate, None));
            indices.push(field(&name, number(*coordinate)));
        }
        let arrays = self
            .entries
            .iter()
            .map(|e| {
                let mut fields = vec![field("name", string(&e.name))];
                match &e.header {
                    Ok(h) => {
                        fields.push(field(
                            "shape",
                            J::Arr(h.shape.iter().map(|&d| number(d)).collect()),
                        ));
                        fields.push(field("dtype", string(&h.dtype)));
                    }
                    Err(reason) => fields.push(field("unavailable", string(reason))),
                }
                J::Obj(fields)
            })
            .collect();
        // Array members may enumerate different layout choices, so choose a
        // fresh layout for the new member. Slice coordinates are independent:
        // preserve matching axes and let index() clamp to the new extent.
        // Layout changes likewise retain any axes that remain navigable.
        let resets = J::Obj(vec![field("Array", J::Arr(vec![string("Layout")]))]);
        let metadata = to_json_string(&J::Obj(vec![
            field("selectorResets", resets),
            field("dtype", string(&header.dtype)),
            field("array", string(&entry.name)),
            field(
                "shape",
                J::Arr(header.shape.iter().map(|&d| number(d)).collect()),
            ),
            field("fortranOrder", J::Bool(header.fortran)),
            field("arrays", J::Arr(arrays)),
            field("selectors", J::Arr(selectors)),
            field("selectedIndices", J::Obj(indices)),
        ]));
        let expected = header
            .offset
            .checked_add(header.length()?)
            .ok_or_else(|| error("NPY length overflow"))?;
        if expected > entry.size {
            return Err(error("Truncated NPY samples"));
        }
        if entry.method == 8 && self.inflated.as_ref().map(|v| v.0) != Some(selected) {
            let mut decoder = flate2::read::DeflateDecoder::new(bytes(
                &self.source,
                entry.offset,
                entry.compressed,
            )?)
            .take(entry.size as u64 + 1);
            let mut data = Vec::new();
            data.try_reserve_exact(entry.size)
                .map_err(|_| error("NPZ member is too large to allocate"))?;
            decoder
                .read_to_end(&mut data)
                .map_err(|_| error("Invalid NPZ Deflate stream"))?;
            if data.len() != entry.size {
                return Err(error("NPZ member size mismatch"));
            }
            self.inflated = Some((selected, data));
        }
        let data = if entry.method == 0 {
            bytes(&self.source, entry.offset, entry.size)?
        } else {
            &self.inflated.as_ref().unwrap().1
        };
        let mut strides = vec![0; ndim];
        let mut stride = header.item_size;
        let axes: Vec<_> = if header.fortran {
            (0..ndim).collect()
        } else {
            (0..ndim).rev().collect()
        };
        for axis in axes {
            strides[axis] = stride;
            stride = stride
                .checked_mul(header.shape[axis])
                .ok_or_else(|| error("NPY strides overflow"))?;
        }
        let base = header.offset
            + coordinates
                .iter()
                .zip(&strides)
                .map(|(i, s)| i * s)
                .sum::<usize>();
        let count = width
            .checked_mul(height)
            .and_then(|v| v.checked_mul(channels))
            .ok_or_else(|| error("NumPy plane size overflow"))?;
        let sx = x_axis.map(|a| strides[a]).unwrap_or(0);
        let sy = y_axis.map(|a| strides[a]).unwrap_or(0);
        let sc = channel_axis.map(|a| strides[a]).unwrap_or(0);
        let contiguous = (width == 1 || sx == channels * header.item_size)
            && (height == 1 || sy == width * channels * header.item_size)
            && (channels == 1 || sc == header.item_size);
        let packed;
        let (samples, offset) = if contiguous {
            (data, base)
        } else {
            // Gather bytes rather than converting each sample through a tiny
            // allocation. The common C-order plane takes the branch above.
            let mut target = vec![0u8; count * header.item_size];
            for y in 0..height {
                for x in 0..width {
                    for c in 0..channels {
                        let out = ((y * width + x) * channels + c) * header.item_size;
                        target[out..out + header.item_size].copy_from_slice(bytes(
                            data,
                            base + y * sy + x * sx + c * sc,
                            header.item_size,
                        )?);
                    }
                }
            }
            packed = target;
            (packed.as_slice(), 0)
        };
        let (sample_format, bits_per_sample, source_numeric_type, type_min, type_max) =
            numeric_info_from_dtype(&header.dtype);
        let boolean = header.dtype.ends_with("b1");
        let (sample_format, bits_per_sample, source_numeric_type, type_min, type_max) = if boolean {
            (1, 8, "uint8".to_string(), 0.0, 1.0)
        } else {
            (
                sample_format,
                bits_per_sample,
                source_numeric_type,
                type_min,
                type_max,
            )
        };
        let native_u8 = header.dtype.ends_with("u1") || boolean;
        let native_u16 = header.dtype.ends_with("u2");
        let mut result = DecodedArray {
            width: u32::try_from(width).map_err(|_| error("NPY width too large"))?,
            height: u32::try_from(height).map_err(|_| error("NPY height too large"))?,
            channels: channels as u32,
            bits_per_sample,
            sample_format,
            source_numeric_type,
            type_min,
            type_max,
            sample_kind: 0,
            format_label: "NumPy".into(),
            metadata_json: metadata,
            data_f32: Vec::new(),
            data_u8: Vec::new(),
            data_u16: Vec::new(),
            source_data_offset: 0,
            can_reuse_source: false,
            taken: false,
            data_min: 0.0,
            data_max: 0.0,
            non_finite_count: 0.0,
            valid_count: 0.0,
        };
        if native_u8 {
            result.sample_kind = 1;
            result.data_u8 = bytes(samples, offset, count)?.to_vec();
        } else if native_u16 {
            result.sample_kind = 2;
            result.data_u16 = bytes(samples, offset, count * 2)?
                .chunks_exact(2)
                .map(|b| {
                    if header.dtype.starts_with('>') {
                        u16::from_be_bytes([b[0], b[1]])
                    } else {
                        u16::from_le_bytes([b[0], b[1]])
                    }
                })
                .collect();
        } else {
            result.data_f32 = read_npy_samples(samples, offset, count, &header.dtype)?;
        }
        Ok(result.finalize_stats())
    }
}

/// Resolve extents from the central directory, including ZIP64 and data
/// descriptors. Never scan sample bytes for signatures that may occur in data.
fn directory(data: &[u8]) -> Result<Vec<Entry>, DecodeError> {
    let end = (data.len().saturating_sub(65557)..data.len().saturating_sub(21))
        .rev()
        .find(|&i| {
            data.get(i..i + 4) == Some(b"PK\x05\x06")
                && u16_at(data, i + 20).is_ok_and(|n| i + 22 + n == data.len())
        })
        .ok_or_else(|| error("NPZ ZIP directory not found"))?;
    if u16_at(data, end + 4)? != 0 || u16_at(data, end + 6)? != 0 {
        return Err(error("Multi-disk NPZ archives are unsupported"));
    }
    let mut count = u16_at(data, end + 10)?;
    let mut cursor = u32_at(data, end + 16)?;
    if count == 0xffff || cursor == 0xffff_ffff {
        let locator = end
            .checked_sub(20)
            .ok_or_else(|| error("Missing ZIP64 locator"))?;
        if bytes(data, locator, 4)? != b"PK\x06\x07" {
            return Err(error("Missing ZIP64 locator"));
        }
        let zip64 = u64_at(data, locator + 8)?;
        if bytes(data, zip64, 4)? != b"PK\x06\x06" {
            return Err(error("Invalid ZIP64 directory"));
        }
        count = u64_at(data, zip64 + 32)?;
        cursor = u64_at(data, zip64 + 48)?;
    }
    if count > data.len() / 46 {
        return Err(error("Invalid NPZ entry count"));
    }
    let mut result = Vec::new();
    for _ in 0..count {
        if bytes(data, cursor, 4)? != b"PK\x01\x02" {
            return Err(error("Invalid NPZ central directory"));
        }
        let flags = u16_at(data, cursor + 8)?;
        let method = u16_at(data, cursor + 10)?;
        let mut compressed = u32_at(data, cursor + 20)?;
        let mut size = u32_at(data, cursor + 24)?;
        let name_len = u16_at(data, cursor + 28)?;
        let extra_len = u16_at(data, cursor + 30)?;
        let comment_len = u16_at(data, cursor + 32)?;
        let mut local = u32_at(data, cursor + 42)?;
        let name = String::from_utf8_lossy(bytes(data, cursor + 46, name_len)?).into_owned();
        let extra = bytes(data, cursor + 46 + name_len, extra_len)?;
        if size == 0xffff_ffff || compressed == 0xffff_ffff || local == 0xffff_ffff {
            let mut p = 0;
            let mut found = false;
            while p + 4 <= extra.len() {
                let kind = u16_at(extra, p)?;
                let len = u16_at(extra, p + 2)?;
                let value = bytes(extra, p + 4, len)?;
                if kind == 1 {
                    let mut q = 0;
                    if size == 0xffff_ffff {
                        size = u64_at(value, q)?;
                        q += 8;
                    }
                    if compressed == 0xffff_ffff {
                        compressed = u64_at(value, q)?;
                        q += 8;
                    }
                    if local == 0xffff_ffff {
                        local = u64_at(value, q)?;
                    }
                    found = true;
                    break;
                }
                p += 4 + len;
            }
            if !found {
                return Err(error("Missing ZIP64 entry sizes"));
            }
        }
        cursor += 46 + name_len + extra_len + comment_len;
        if !name.to_ascii_lowercase().ends_with(".npy") {
            continue;
        }
        if bytes(data, local, 4)? != b"PK\x03\x04" {
            return Err(error("Invalid NPZ local header"));
        }
        let offset = local + 30 + u16_at(data, local + 26)? + u16_at(data, local + 28)?;
        bytes(data, offset, compressed)?;
        if method == 0 && compressed != size {
            return Err(error("Stored NPZ member size mismatch"));
        }
        let reason = if flags & 1 != 0 {
            "Encrypted NPZ member"
        } else if method != 0 && method != 8 {
            "Unsupported NPZ compression"
        } else {
            "Header not read"
        };
        result.push(Entry {
            name: name[..name.len() - 4].into(),
            offset,
            compressed,
            size,
            method: if flags & 1 != 0 { usize::MAX } else { method },
            header: Err(reason.into()),
        });
    }
    Ok(result)
}
