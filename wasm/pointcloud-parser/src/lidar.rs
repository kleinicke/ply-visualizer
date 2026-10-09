use std::io::Cursor;
use std::mem;

use las::Reader as LasReader;
use serde::Serialize;
use wasm_bindgen::prelude::*;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LasMetadata {
    format: &'static str,
    version: String,
    point_format: u8,
    compressed: bool,
    source_point_count: u64,
    scale: [f64; 3],
    offset: [f64; 3],
    source_bounds: [f64; 6],
    source_origin: [f64; 3],
    system_identifier: String,
    generating_software: String,
    guid: String,
    creation_date: Option<String>,
    has_wkt_crs: bool,
    crs: LasCrsMetadata,
    color_encoding: Option<&'static str>,
    gps_time_offset: Option<f64>,
    vlrs: Vec<VlrMetadata>,
}

#[derive(Default, Serialize)]
#[serde(rename_all = "camelCase")]
struct LasCrsMetadata {
    wkt: Option<String>,
    geo_key_directory: Option<Vec<u16>>,
    geo_double_params: Option<Vec<f64>>,
    geo_ascii_params: Option<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VlrMetadata {
    user_id: String,
    record_id: u16,
    description: String,
    byte_length: usize,
    extended: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct E57Metadata {
    format: &'static str,
    scan_index: usize,
    scan_count: usize,
    source_point_count: u64,
    name: Option<String>,
    guid: Option<String>,
    description: Option<String>,
    source_origin: [f64; 3],
    pose: [f64; 7],
    sensor_vendor: Option<String>,
    sensor_model: Option<String>,
    sensor_serial: Option<String>,
    invalid_cartesian_records: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct E57ImageMetadata {
    format: &'static str,
    image_index: usize,
    representation: &'static str,
    projectable: bool,
    camera_model: Option<&'static str>,
    mime_type: &'static str,
    width: u32,
    height: u32,
    fx: Option<f64>,
    fy: Option<f64>,
    cx: Option<f64>,
    cy: Option<f64>,
    guid: Option<String>,
    associated_pointcloud_guid: Option<String>,
    name: Option<String>,
    description: Option<String>,
    sensor_vendor: Option<String>,
    sensor_model: Option<String>,
    sensor_serial: Option<String>,
    pose: [f64; 7],
    source_origin: [f64; 3],
    has_mask: bool,
}

/// An embedded E57 JPEG/PNG representation and its optional PNG validity mask.
/// Encoded bytes are kept encoded across the WASM boundary so callers can
/// decode one image at a time instead of retaining every full-resolution RGB
/// buffer.
#[wasm_bindgen]
pub struct E57ImageResult {
    metadata_json: String,
    data: Vec<u8>,
    mask: Vec<u8>,
}

#[wasm_bindgen]
impl E57ImageResult {
    #[wasm_bindgen(getter)]
    pub fn metadata_json(&self) -> String {
        self.metadata_json.clone()
    }
    pub fn take_data(&mut self) -> Vec<u8> {
        mem::take(&mut self.data)
    }
    pub fn take_mask(&mut self) -> Vec<u8> {
        mem::take(&mut self.mask)
    }
}

/// A single decoded LAS/LAZ cloud or E57 scan. Buffers are moved to JS with
/// `take_*`, avoiding an additional Rust-side clone at the WASM boundary.
#[wasm_bindgen]
pub struct LidarScanResult {
    name: String,
    source_count: u64,
    positions: Vec<f32>,
    colors: Vec<u8>,
    intensity: Vec<f32>,
    classification: Vec<f32>,
    return_number: Vec<f32>,
    number_of_returns: Vec<f32>,
    scan_angle: Vec<f32>,
    gps_time: Vec<f32>,
    user_data: Vec<f32>,
    point_source_id: Vec<f32>,
    row_index: Vec<f32>,
    column_index: Vec<f32>,
    has_colors: bool,
    metadata_json: String,
    source_origin: [f64; 3],
    min: [f32; 3],
    max: [f32; 3],
}

#[wasm_bindgen]
impl LidarScanResult {
    #[wasm_bindgen(getter)]
    pub fn name(&self) -> String {
        self.name.clone()
    }
    #[wasm_bindgen(getter)]
    pub fn vertex_count(&self) -> u32 {
        (self.positions.len() / 3) as u32
    }
    #[wasm_bindgen(getter)]
    pub fn source_count(&self) -> f64 {
        self.source_count as f64
    }
    #[wasm_bindgen(getter)]
    pub fn has_colors(&self) -> bool {
        self.has_colors
    }
    #[wasm_bindgen(getter)]
    pub fn metadata_json(&self) -> String {
        self.metadata_json.clone()
    }
    pub fn take_positions(&mut self) -> Vec<f32> {
        mem::take(&mut self.positions)
    }
    pub fn take_colors(&mut self) -> Vec<u8> {
        mem::take(&mut self.colors)
    }
    pub fn take_intensity(&mut self) -> Vec<f32> {
        mem::take(&mut self.intensity)
    }
    pub fn take_classification(&mut self) -> Vec<f32> {
        mem::take(&mut self.classification)
    }
    pub fn take_return_number(&mut self) -> Vec<f32> {
        mem::take(&mut self.return_number)
    }
    pub fn take_number_of_returns(&mut self) -> Vec<f32> {
        mem::take(&mut self.number_of_returns)
    }
    pub fn take_scan_angle(&mut self) -> Vec<f32> {
        mem::take(&mut self.scan_angle)
    }
    pub fn take_gps_time(&mut self) -> Vec<f32> {
        mem::take(&mut self.gps_time)
    }
    pub fn take_user_data(&mut self) -> Vec<f32> {
        mem::take(&mut self.user_data)
    }
    pub fn take_point_source_id(&mut self) -> Vec<f32> {
        mem::take(&mut self.point_source_id)
    }
    pub fn take_row_index(&mut self) -> Vec<f32> {
        mem::take(&mut self.row_index)
    }
    pub fn take_column_index(&mut self) -> Vec<f32> {
        mem::take(&mut self.column_index)
    }
    pub fn bbox(&self) -> Vec<f32> {
        vec![
            self.min[0],
            self.min[1],
            self.min[2],
            self.max[0],
            self.max[1],
            self.max[2],
        ]
    }
    pub fn source_origin(&self) -> Vec<f64> {
        self.source_origin.to_vec()
    }
}

#[wasm_bindgen]
pub struct LidarCollectionResult {
    scans: Vec<Option<LidarScanResult>>,
    images: Vec<Option<E57ImageResult>>,
    errors: Vec<String>,
}

#[wasm_bindgen]
impl LidarCollectionResult {
    #[wasm_bindgen(getter)]
    pub fn scan_count(&self) -> u32 {
        self.scans.len() as u32
    }
    pub fn take_scan(&mut self, index: usize) -> Result<LidarScanResult, JsValue> {
        self.scans
            .get_mut(index)
            .and_then(Option::take)
            .ok_or_else(|| JsValue::from_str("scan index is invalid or was already taken"))
    }
    #[wasm_bindgen(getter)]
    pub fn image_count(&self) -> u32 {
        self.images.len() as u32
    }
    pub fn take_image(&mut self, index: usize) -> Result<E57ImageResult, JsValue> {
        self.images
            .get_mut(index)
            .and_then(Option::take)
            .ok_or_else(|| JsValue::from_str("image index is invalid or was already taken"))
    }
    #[wasm_bindgen(getter)]
    pub fn errors_json(&self) -> String {
        serde_json::to_string(&self.errors).unwrap_or_else(|_| "[]".into())
    }
}

const MAX_DECODED_BUFFER_BYTES: u64 = 1024 * 1024 * 1024;
const MAX_EMBEDDED_IMAGE_BYTES: u64 = 512 * 1024 * 1024;

fn validate_decoded_size(point_count: u64, bytes_per_point: u64) -> Result<usize, String> {
    let estimated = point_count
        .checked_mul(bytes_per_point)
        .ok_or_else(|| "decoded point-cloud size overflow".to_owned())?;
    if estimated > MAX_DECODED_BUFFER_BYTES {
        return Err(format!(
            "point cloud needs about {:.1} GiB of decoded buffers; the safety limit is 1.0 GiB",
            estimated as f64 / 1024.0 / 1024.0 / 1024.0
        ));
    }
    usize::try_from(point_count)
        .map_err(|_| "point count is too large for this platform".to_owned())
}

fn projection_vlrs<'a>(header: &'a las::Header) -> impl Iterator<Item = &'a las::Vlr> {
    header
        .vlrs()
        .iter()
        .chain(header.evlrs().iter())
        .filter(|v| v.user_id.trim_end_matches('\0') == "LASF_Projection")
}

fn read_las_crs(header: &las::Header) -> LasCrsMetadata {
    let mut crs = LasCrsMetadata::default();
    for vlr in projection_vlrs(header) {
        match vlr.record_id {
            2112 => {
                let text = String::from_utf8_lossy(&vlr.data)
                    .trim_end_matches('\0')
                    .trim()
                    .to_owned();
                if !text.is_empty() {
                    crs.wkt = Some(text);
                }
            }
            34735 => {
                crs.geo_key_directory = Some(
                    vlr.data
                        .chunks_exact(2)
                        .map(|b| u16::from_le_bytes([b[0], b[1]]))
                        .collect(),
                );
            }
            34736 => {
                crs.geo_double_params = Some(
                    vlr.data
                        .chunks_exact(8)
                        .map(|b| f64::from_le_bytes(b.try_into().expect("eight-byte chunk")))
                        .collect(),
                );
            }
            34737 => {
                crs.geo_ascii_params = Some(
                    String::from_utf8_lossy(&vlr.data)
                        .trim_end_matches('\0')
                        .to_owned(),
                );
            }
            _ => {}
        }
    }
    crs
}

fn update_bounds(min: &mut [f32; 3], max: &mut [f32; 3], x: f32, y: f32, z: f32) {
    min[0] = min[0].min(x);
    min[1] = min[1].min(y);
    min[2] = min[2].min(z);
    max[0] = max[0].max(x);
    max[1] = max[1].max(y);
    max[2] = max[2].max(z);
}

fn finish_bounds(min: &mut [f32; 3], max: &mut [f32; 3]) {
    if !min[0].is_finite() {
        *min = [0.0; 3];
        *max = [0.0; 3];
    }
}

fn las_color_is_16_bit(max_color: u16, channels_above_byte: usize, channel_count: usize) -> bool {
    // A single slightly out-of-range channel is usually dirty 8-bit-in-16-bit
    // data, while genuinely high values or a meaningful population above 255
    // indicate the spec-defined 16-bit encoding.
    max_color > 4095
        || (channel_count > 0 && channels_above_byte.saturating_mul(100) >= channel_count)
}

/// The header facts of a LAS/LAZ file, before any point is read. The two
/// fields that depend on every point - colour encoding and the GPS offset -
/// are filled in by the caller once the points are in.
fn las_header_metadata(header: &las::Header, origin: [f64; 3]) -> LasMetadata {
    let bounds = header.bounds();
    let transforms = header.transforms();
    let vlrs = header
        .vlrs()
        .iter()
        .map(|v| VlrMetadata {
            user_id: v.user_id.clone(),
            record_id: v.record_id,
            description: v.description.clone(),
            byte_length: v.data.len(),
            extended: false,
        })
        .chain(header.evlrs().iter().map(|v| VlrMetadata {
            user_id: v.user_id.clone(),
            record_id: v.record_id,
            description: v.description.clone(),
            byte_length: v.data.len(),
            extended: true,
        }))
        .collect();
    LasMetadata {
        format: if header.point_format().is_compressed {
            "LAZ"
        } else {
            "LAS"
        },
        version: header.version().to_string(),
        point_format: header.point_format().to_u8().unwrap_or_default(),
        compressed: header.point_format().is_compressed,
        source_point_count: header.number_of_points(),
        scale: [transforms.x.scale, transforms.y.scale, transforms.z.scale],
        offset: [
            transforms.x.offset,
            transforms.y.offset,
            transforms.z.offset,
        ],
        source_bounds: [
            bounds.min.x,
            bounds.min.y,
            bounds.min.z,
            bounds.max.x,
            bounds.max.y,
            bounds.max.z,
        ],
        source_origin: origin,
        system_identifier: header.system_identifier().to_owned(),
        generating_software: header.generating_software().to_owned(),
        guid: header.guid().to_string(),
        creation_date: header.date().map(|d| d.to_string()),
        has_wkt_crs: header.has_wkt_crs(),
        crs: read_las_crs(header),
        color_encoding: None,
        gps_time_offset: None,
        vlrs,
    }
}

/// The centre of the header bounds: every point is stored relative to it, so
/// the GPU gets small, precise float32 coordinates.
fn las_origin(header: &las::Header) -> [f64; 3] {
    let bounds = header.bounds();
    [
        (bounds.min.x + bounds.max.x) * 0.5,
        (bounds.min.y + bounds.max.y) * 0.5,
        (bounds.min.z + bounds.max.z) * 0.5,
    ]
}

/// Positions + seven always-present scalar fields, with optional GPS and
/// temporary/final RGB storage, per point.
fn las_bytes_per_point(header: &las::Header) -> u64 {
    let format = header.point_format();
    40 + if format.has_gps_time { 4 } else { 0 } + if format.has_color { 9 } else { 0 }
}

/// How GPS times are made relative. A whole-file parse takes the first finite
/// time it meets; a range of the file is handed that same value, found
/// beforehand, so every range subtracts the same offset.
#[derive(Clone, Copy)]
enum GpsOffset {
    FirstFinite,
    Fixed(Option<f64>),
}

/// Per-point decoded arrays, shared by the whole-file and the ranged parse so
/// both do exactly the same arithmetic.
struct LasPoints {
    origin: [f64; 3],
    has_colors: bool,
    has_gps: bool,
    gps: GpsOffset,
    positions: Vec<f32>,
    colors16: Vec<u16>,
    max_color: u16,
    color_channels_above_byte: usize,
    intensity: Vec<f32>,
    classification: Vec<f32>,
    return_number: Vec<f32>,
    number_of_returns: Vec<f32>,
    scan_angle: Vec<f32>,
    gps_time: Vec<f32>,
    user_data: Vec<f32>,
    point_source_id: Vec<f32>,
    min: [f32; 3],
    max: [f32; 3],
}

impl LasPoints {
    fn new(header: &las::Header, origin: [f64; 3], gps: GpsOffset, count: usize) -> Self {
        let has_colors = header.point_format().has_color;
        let has_gps = header.point_format().has_gps_time;
        LasPoints {
            origin,
            has_colors,
            has_gps,
            gps,
            positions: Vec::with_capacity(count.saturating_mul(3)),
            colors16: if has_colors {
                Vec::with_capacity(count.saturating_mul(3))
            } else {
                Vec::new()
            },
            max_color: 0,
            color_channels_above_byte: 0,
            intensity: Vec::with_capacity(count),
            classification: Vec::with_capacity(count),
            return_number: Vec::with_capacity(count),
            number_of_returns: Vec::with_capacity(count),
            scan_angle: Vec::with_capacity(count),
            gps_time: if has_gps {
                Vec::with_capacity(count)
            } else {
                Vec::new()
            },
            user_data: Vec::with_capacity(count),
            point_source_id: Vec::with_capacity(count),
            min: [f32::INFINITY; 3],
            max: [f32::NEG_INFINITY; 3],
        }
    }

    // Positions and GPS times are narrowed on purpose: relative to the origin
    // and the offset they fit float32, which is what the GPU buffers hold.
    #[allow(clippy::cast_possible_truncation)]
    fn push(&mut self, point: &las::Point) {
        let origin = self.origin;
        let xyz = [
            (point.x - origin[0]) as f32,
            (point.y - origin[1]) as f32,
            (point.z - origin[2]) as f32,
        ];
        self.positions.extend_from_slice(&xyz);
        update_bounds(&mut self.min, &mut self.max, xyz[0], xyz[1], xyz[2]);
        if self.has_colors {
            let color = point.color.unwrap_or_default();
            let rgb = [color.red, color.green, color.blue];
            self.max_color = self.max_color.max(rgb[0]).max(rgb[1]).max(rgb[2]);
            self.color_channels_above_byte += rgb.into_iter().filter(|value| *value > 255).count();
            self.colors16.extend_from_slice(&rgb);
        }
        self.intensity.push(f32::from(point.intensity));
        self.classification
            .push(f32::from(u8::from(point.classification)));
        self.return_number.push(f32::from(point.return_number));
        self.number_of_returns
            .push(f32::from(point.number_of_returns));
        self.scan_angle.push(point.scan_angle);
        if self.has_gps {
            let value = point.gps_time.unwrap_or(f64::NAN);
            if value.is_finite() {
                if let GpsOffset::FirstFinite = self.gps {
                    self.gps = GpsOffset::Fixed(Some(value));
                }
            }
            let offset = match self.gps {
                GpsOffset::Fixed(offset) => offset,
                GpsOffset::FirstFinite => None,
            };
            self.gps_time
                .push(offset.map_or(f32::NAN, |offset| (value - offset) as f32));
        }
        self.user_data.push(f32::from(point.user_data));
        self.point_source_id.push(f32::from(point.point_source_id));
    }

    fn gps_offset(&self) -> Option<f64> {
        match self.gps {
            GpsOffset::Fixed(offset) => offset,
            GpsOffset::FirstFinite => None,
        }
    }
}

/// Whether LAS colours use the 16-bit range, from the whole file's colours.
fn las_color_encoding(points_max: u16, above: usize, channels: usize) -> (bool, &'static str) {
    let sixteen = las_color_is_16_bit(points_max, above, channels);
    (sixteen, if sixteen { "16-bit" } else { "8-bit-in-16-bit" })
}

fn las_colors_to_u8(colors16: Vec<u16>, color_is_16_bit: bool) -> Vec<u8> {
    let divisor = if color_is_16_bit { 257u32 } else { 1u32 };
    colors16
        .into_iter()
        .map(|v| u8::try_from((u32::from(v) / divisor).min(255)).unwrap_or(u8::MAX))
        .collect()
}

/// Decode a whole LAS or LAZ file.
///
/// # Errors
/// Fails on a malformed header or point record, or a file too large to
/// decode within the wasm memory limit.
#[wasm_bindgen]
pub fn parse_las(data: Vec<u8>, file_name: &str) -> Result<LidarCollectionResult, JsValue> {
    let cursor = Cursor::new(data);
    let mut reader = LasReader::new(cursor).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let header = reader.header().clone();
    // This rejects hostile headers before large Vec allocations can trap the
    // WASM instance.
    let count = validate_decoded_size(header.number_of_points(), las_bytes_per_point(&header))
        .map_err(|error| JsValue::from_str(&error))?;
    let origin = las_origin(&header);
    let mut metadata = las_header_metadata(&header, origin);
    let mut points = LasPoints::new(&header, origin, GpsOffset::FirstFinite, count);
    for point in reader.points() {
        let p = point.map_err(|e| JsValue::from_str(&e.to_string()))?;
        points.push(&p);
    }
    finish_bounds(&mut points.min, &mut points.max);
    let has_colors = points.has_colors;
    let (color_is_16_bit, encoding) = las_color_encoding(
        points.max_color,
        points.color_channels_above_byte,
        points.colors16.len(),
    );
    metadata.gps_time_offset = points.gps_offset();
    metadata.color_encoding = has_colors.then_some(encoding);
    let colors = if has_colors {
        las_colors_to_u8(mem::take(&mut points.colors16), color_is_16_bit)
    } else {
        Vec::new()
    };
    let result = LidarScanResult {
        name: file_name.to_owned(),
        source_count: header.number_of_points(),
        positions: points.positions,
        colors,
        intensity: points.intensity,
        classification: points.classification,
        return_number: points.return_number,
        number_of_returns: points.number_of_returns,
        scan_angle: points.scan_angle,
        gps_time: points.gps_time,
        user_data: points.user_data,
        point_source_id: points.point_source_id,
        row_index: Vec::new(),
        column_index: Vec::new(),
        has_colors,
        metadata_json: serde_json::to_string(&metadata).unwrap_or_else(|_| "{}".into()),
        source_origin: origin,
        min: points.min,
        max: points.max,
    };
    Ok(LidarCollectionResult {
        scans: vec![Some(result)],
        images: Vec::new(),
        errors: Vec::new(),
    })
}

/// A scan or image pose as `[tx, ty, tz, qw, qx, qy, qz]`; identity if absent.
fn e57_pose(transform: Option<&e57::Transform>) -> [f64; 7] {
    transform.map_or([0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0], |t| {
        [
            t.translation.x,
            t.translation.y,
            t.translation.z,
            t.rotation.w,
            t.rotation.x,
            t.rotation.y,
            t.rotation.z,
        ]
    })
}

/// Decode one E57 scan. `common_origin` is the first valid point of the
/// whole file once one has been seen (set here if not yet); errors go to the
/// shared list, record errors only while it holds fewer than twenty.
// Narrowing is the point here: positions rebased on the origin fit float32,
// colours are clamped to 0..=1 before scaling to bytes, and row/column
// indices are image coordinates far below float32's exact-integer range.
#[allow(
    clippy::too_many_lines,
    clippy::cast_possible_truncation,
    clippy::cast_sign_loss,
    clippy::cast_precision_loss
)]
fn decode_e57_scan<T: std::io::Read + std::io::Seek>(
    reader: &mut e57::E57Reader<T>,
    pc: &e57::PointCloud,
    scan_index: usize,
    scan_count: usize,
    file_name: &str,
    common_origin: &mut Option<[f64; 3]>,
    errors: &mut Vec<String>,
) -> Option<LidarScanResult> {
    let bytes_per_point = 12
        + if pc.has_color() { 3 } else { 0 }
        + if pc.has_intensity() { 4 } else { 0 }
        + if pc.has_row_column() { 8 } else { 0 };
    let capacity = match validate_decoded_size(pc.records, bytes_per_point) {
        Ok(capacity) => capacity,
        Err(error) => {
            errors.push(format!("scan {}: {}", scan_index + 1, error));
            return None;
        }
    };
    let mut positions = Vec::with_capacity(capacity.saturating_mul(3));
    let mut colors = if pc.has_color() {
        Vec::with_capacity(capacity.saturating_mul(3))
    } else {
        Vec::new()
    };
    let mut intensity = if pc.has_intensity() {
        Vec::with_capacity(capacity)
    } else {
        Vec::new()
    };
    let mut row_index = if pc.has_row_column() {
        Vec::with_capacity(capacity)
    } else {
        Vec::new()
    };
    let mut column_index = if pc.has_row_column() {
        Vec::with_capacity(capacity)
    } else {
        Vec::new()
    };
    let mut invalid = 0u64;
    let mut min = [f32::INFINITY; 3];
    let mut max = [f32::NEG_INFINITY; 3];
    let mut points = match reader.pointcloud_simple(pc) {
        Ok(points) => points,
        Err(error) => {
            errors.push(format!("scan {}: {error}", scan_index + 1));
            return None;
        }
    };
    points.intensity_to_color(false);
    for point in points {
        let record = match point {
            Ok(point) => point,
            Err(error) => {
                invalid += 1;
                if errors.len() < 20 {
                    errors.push(format!("scan {} record error: {error}", scan_index + 1));
                }
                continue;
            }
        };
        let e57::CartesianCoordinate::Valid {
            x: wx,
            y: wy,
            z: wz,
        } = record.cartesian
        else {
            invalid += 1;
            continue;
        };
        let origin = *common_origin.get_or_insert([wx, wy, wz]);
        let xyz = [
            (wx - origin[0]) as f32,
            (wy - origin[1]) as f32,
            (wz - origin[2]) as f32,
        ];
        positions.extend_from_slice(&xyz);
        update_bounds(&mut min, &mut max, xyz[0], xyz[1], xyz[2]);
        if pc.has_color() {
            let color = record.color.unwrap_or(e57::Color {
                red: 1.0,
                green: 1.0,
                blue: 1.0,
            });
            colors.extend_from_slice(&[
                (color.red.clamp(0.0, 1.0) * 255.0).round() as u8,
                (color.green.clamp(0.0, 1.0) * 255.0).round() as u8,
                (color.blue.clamp(0.0, 1.0) * 255.0).round() as u8,
            ]);
        }
        if pc.has_intensity() {
            intensity.push(record.intensity.unwrap_or(f32::NAN));
        }
        if pc.has_row_column() {
            row_index.push(record.row as f32);
            column_index.push(record.column as f32);
        }
    }
    finish_bounds(&mut min, &mut max);
    let origin = common_origin.unwrap_or([0.0; 3]);
    let pose = e57_pose(pc.transform.as_ref());
    let metadata = E57Metadata {
        format: "E57",
        scan_index,
        scan_count,
        source_point_count: pc.records,
        name: pc.name.clone(),
        guid: pc.guid.clone(),
        description: pc.description.clone(),
        source_origin: origin,
        pose,
        sensor_vendor: pc.sensor_vendor.clone(),
        sensor_model: pc.sensor_model.clone(),
        sensor_serial: pc.sensor_serial.clone(),
        invalid_cartesian_records: invalid,
    };
    let scan_name = pc
        .name
        .clone()
        .unwrap_or_else(|| format!("{file_name} — scan {}", scan_index + 1));
    Some(LidarScanResult {
        name: scan_name,
        source_count: pc.records,
        positions,
        colors,
        intensity,
        classification: Vec::new(),
        return_number: Vec::new(),
        number_of_returns: Vec::new(),
        scan_angle: Vec::new(),
        gps_time: Vec::new(),
        user_data: Vec::new(),
        point_source_id: Vec::new(),
        row_index,
        column_index,
        has_colors: pc.has_color(),
        metadata_json: serde_json::to_string(&metadata).unwrap_or_else(|_| "{}".into()),
        source_origin: origin,
        min,
        max,
    })
}

/// The embedded images of an E57, with the cloud's common origin recorded on
/// each so they can be placed against the rebased points.
// Blob sizes are bounded by the 512 MiB limit checked first, so the usize
// casts cannot truncate on wasm32; the f64 casts only format a size or halve
// an image dimension.
#[allow(
    clippy::too_many_lines,
    clippy::cast_possible_truncation,
    clippy::cast_precision_loss
)]
fn e57_images<T: std::io::Read + std::io::Seek>(
    reader: &mut e57::E57Reader<T>,
    source_origin: [f64; 3],
    errors: &mut Vec<String>,
) -> Vec<Option<E57ImageResult>> {
    let image_descriptors = reader.images();
    let mut images = Vec::new();
    for (image_index, descriptor) in image_descriptors.iter().enumerate() {
        let pose = e57_pose(descriptor.transform.as_ref());

        let mut append_representation = |representation: &'static str,
                                         projectable: bool,
                                         camera_model: Option<&'static str>,
                                         blob: &e57::ImageBlob,
                                         mask_blob: Option<&e57::Blob>,
                                         width: u32,
                                         height: u32,
                                         fx: Option<f64>,
                                         fy: Option<f64>,
                                         cx: Option<f64>,
                                         cy: Option<f64>| {
            if blob.data.length > MAX_EMBEDDED_IMAGE_BYTES {
                errors.push(format!(
                    "image {} {representation}: {:.1} MiB blob exceeds the 512 MiB safety limit",
                    image_index + 1,
                    blob.data.length as f64 / 1024.0 / 1024.0
                ));
                return;
            }
            let mut data = Vec::with_capacity(blob.data.length.min(usize::MAX as u64) as usize);
            if let Err(error) = reader.blob(&blob.data, &mut data) {
                errors.push(format!(
                    "image {} {representation}: {error}",
                    image_index + 1
                ));
                return;
            }
            let mut mask = Vec::new();
            if let Some(mask_blob) = mask_blob {
                if mask_blob.length > MAX_EMBEDDED_IMAGE_BYTES {
                    errors.push(format!(
                        "image {} {representation} mask exceeds the 512 MiB safety limit",
                        image_index + 1
                    ));
                    return;
                }
                mask.reserve(mask_blob.length.min(usize::MAX as u64) as usize);
                if let Err(error) = reader.blob(mask_blob, &mut mask) {
                    errors.push(format!(
                        "image {} {representation} mask: {error}",
                        image_index + 1
                    ));
                    mask.clear();
                }
            }
            let metadata = E57ImageMetadata {
                format: "E57 image",
                image_index,
                representation,
                projectable,
                camera_model,
                mime_type: match blob.format {
                    e57::ImageFormat::Png => "image/png",
                    e57::ImageFormat::Jpeg => "image/jpeg",
                },
                width,
                height,
                fx,
                fy,
                cx,
                cy,
                guid: descriptor.guid.clone(),
                associated_pointcloud_guid: descriptor.pointcloud_guid.clone(),
                name: descriptor.name.clone(),
                description: descriptor.description.clone(),
                sensor_vendor: descriptor.sensor_vendor.clone(),
                sensor_model: descriptor.sensor_model.clone(),
                sensor_serial: descriptor.sensor_serial.clone(),
                pose,
                source_origin,
                has_mask: !mask.is_empty(),
            };
            images.push(Some(E57ImageResult {
                metadata_json: serde_json::to_string(&metadata).unwrap_or_else(|_| "{}".into()),
                data,
                mask,
            }));
        };

        if let Some(projection) = &descriptor.projection {
            match projection {
                e57::Projection::Pinhole(image) => {
                    let p = &image.properties;
                    append_representation(
                        "pinhole",
                        true,
                        Some("e57-pinhole"),
                        &image.blob,
                        image.mask.as_ref(),
                        p.width,
                        p.height,
                        Some(p.focal_length / p.pixel_width),
                        Some(p.focal_length / p.pixel_height),
                        Some(p.principal_x),
                        Some(p.principal_y),
                    );
                }
                e57::Projection::Spherical(image) => {
                    let p = &image.properties;
                    append_representation(
                        "spherical",
                        true,
                        Some("e57-spherical"),
                        &image.blob,
                        image.mask.as_ref(),
                        p.width,
                        p.height,
                        Some(1.0 / p.pixel_width),
                        Some(1.0 / p.pixel_height),
                        Some(f64::from(p.width) / 2.0),
                        Some(f64::from(p.height) / 2.0),
                    );
                }
                e57::Projection::Cylindrical(image) => {
                    let p = &image.properties;
                    append_representation(
                        "cylindrical",
                        true,
                        Some("e57-cylindrical"),
                        &image.blob,
                        image.mask.as_ref(),
                        p.width,
                        p.height,
                        Some(1.0 / p.pixel_width),
                        Some(p.radius / p.pixel_height),
                        Some(f64::from(p.width) / 2.0),
                        Some(p.principal_y),
                    );
                }
            }
        }
        if let Some(image) = &descriptor.visual_reference {
            append_representation(
                "visual-reference",
                false,
                None,
                &image.blob,
                image.mask.as_ref(),
                image.properties.width,
                image.properties.height,
                None,
                None,
                None,
                None,
            );
        }
    }
    images
}

/// Decode every scan and image of an E57.
///
/// # Errors
/// Fails when the file is not a readable E57 or none of its scans decode.
#[wasm_bindgen]
pub fn parse_e57(data: Vec<u8>, file_name: &str) -> Result<LidarCollectionResult, JsValue> {
    let cursor = Cursor::new(data);
    let mut reader = e57::E57Reader::new(cursor).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let descriptors = reader.pointclouds();
    let scan_count = descriptors.len();
    let mut scans = Vec::with_capacity(scan_count);
    let mut errors = Vec::new();
    // The simple reader applies each scan pose. One common origin keeps every
    // scan aligned while retaining small, precise float32 GPU coordinates.
    let mut common_origin: Option<[f64; 3]> = None;
    for (scan_index, pc) in descriptors.iter().enumerate() {
        if let Some(scan) = decode_e57_scan(
            &mut reader,
            pc,
            scan_index,
            scan_count,
            file_name,
            &mut common_origin,
            &mut errors,
        ) {
            scans.push(Some(scan));
        }
    }
    if scans.is_empty() && !descriptors.is_empty() {
        return Err(JsValue::from_str(&format!(
            "none of the {} E57 scans could be decoded: {}",
            descriptors.len(),
            errors.join("; ")
        )));
    }
    let images = e57_images(&mut reader, common_origin.unwrap_or([0.0; 3]), &mut errors);
    Ok(LidarCollectionResult {
        scans,
        images,
        errors,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use las::{Builder, Color, Point, Writer};

    fn las_fixture(compressed: bool) -> Vec<u8> {
        let mut builder = Builder::from((1, 4));
        builder.point_format = las::point::Format::new(3).unwrap();
        builder.point_format.is_compressed = compressed;
        builder.transforms.x.offset = 4_000_000.0;
        builder.transforms.y.offset = 500_000.0;
        builder.vlrs.push(las::Vlr {
            user_id: "LASF_Projection".into(),
            record_id: 2112,
            description: "OGC coordinate system WKT".into(),
            data: b"PROJCRS[\"Fixture CRS\"]\0".to_vec(),
        });
        let header = builder.into_header().unwrap();
        let mut writer = Writer::new(Cursor::new(Vec::new()), header).unwrap();
        writer
            .write_point(Point {
                x: 4_000_000.25,
                y: 500_000.5,
                z: 123.75,
                intensity: 42,
                return_number: 1,
                number_of_returns: 2,
                classification: las::point::Classification::Ground,
                gps_time: Some(12345.5),
                color: Some(Color::new(65535, 32768, 0)),
                ..Default::default()
            })
            .unwrap();
        writer
            .write_point(Point {
                x: 4_000_002.25,
                y: 500_002.5,
                z: 125.75,
                intensity: 84,
                return_number: 2,
                number_of_returns: 2,
                classification: las::point::Classification::Building,
                gps_time: Some(12346.5),
                color: Some(Color::new(0, 65535, 32768)),
                ..Default::default()
            })
            .unwrap();
        writer.close().unwrap();
        writer.into_inner().unwrap().into_inner()
    }

    #[test]
    fn decodes_las_and_laz_with_attributes_and_rebased_positions() {
        for compressed in [false, true] {
            let collection = parse_las(las_fixture(compressed), "fixture.las").unwrap();
            let scan = collection.scans[0].as_ref().unwrap();
            assert_eq!(2, scan.positions.len() / 3);
            assert_eq!(vec![42.0, 84.0], scan.intensity);
            assert_eq!(vec![2.0, 6.0], scan.classification);
            assert_eq!(&[255, 127, 0, 0, 255, 127], scan.colors.as_slice());
            assert!(scan.positions.iter().all(|v| v.abs() <= 1.01));
            assert!(scan.source_origin[0] > 4_000_000.0);
            let metadata: serde_json::Value = serde_json::from_str(&scan.metadata_json).unwrap();
            assert_eq!("16-bit", metadata["colorEncoding"]);
            assert_eq!("PROJCRS[\"Fixture CRS\"]", metadata["crs"]["wkt"]);
        }
    }

    #[test]
    fn rejects_decoded_buffers_above_the_wasm_safety_limit() {
        assert!(validate_decoded_size(1_000, 49).is_ok());
        let error = validate_decoded_size(u64::MAX, 49).unwrap_err();
        assert!(error.contains("overflow"));
        let error = validate_decoded_size(30_000_000, 49).unwrap_err();
        assert!(error.contains("safety limit"));
    }

    #[test]
    fn las_color_detection_ignores_one_slightly_out_of_range_channel() {
        assert!(!las_color_is_16_bit(300, 1, 300));
        assert!(las_color_is_16_bit(300, 3, 300));
        assert!(las_color_is_16_bit(65_535, 1, 300));
    }

    fn e57_fixture() -> Vec<u8> {
        use e57::{
            E57Writer, ImageFormat, Record, RecordValue, SphericalImageProperties, Transform,
            Translation,
        };
        let mut bytes = Vec::new();
        {
            let cursor = Cursor::new(&mut bytes);
            let mut writer = E57Writer::new(cursor, "fixture-guid").unwrap();
            let prototype = vec![
                Record::CARTESIAN_X_F64,
                Record::CARTESIAN_Y_F64,
                Record::CARTESIAN_Z_F64,
                Record::COLOR_RED_U8,
                Record::COLOR_GREEN_U8,
                Record::COLOR_BLUE_U8,
                Record::INTENSITY_U16,
            ];
            {
                let mut scan = writer
                    .add_pointcloud("scan-one-guid", prototype.clone())
                    .unwrap();
                scan.set_name(Some("Scan one".into()));
                scan.add_point(vec![
                    RecordValue::Double(1000.0),
                    RecordValue::Double(2000.0),
                    RecordValue::Double(3.0),
                    RecordValue::Integer(255),
                    RecordValue::Integer(64),
                    RecordValue::Integer(0),
                    RecordValue::Integer(32768),
                ])
                .unwrap();
                scan.finalize().unwrap();
            }
            {
                let mut scan = writer.add_pointcloud("scan-two-guid", prototype).unwrap();
                scan.set_name(Some("Scan two".into()));
                scan.set_transform(Some(Transform {
                    translation: Translation {
                        x: 10.0,
                        y: 0.0,
                        z: 0.0,
                    },
                    ..Default::default()
                }));
                scan.add_point(vec![
                    RecordValue::Double(1000.0),
                    RecordValue::Double(2000.0),
                    RecordValue::Double(3.0),
                    RecordValue::Integer(0),
                    RecordValue::Integer(128),
                    RecordValue::Integer(255),
                    RecordValue::Integer(65535),
                ])
                .unwrap();
                scan.finalize().unwrap();
            }
            {
                let mut image = writer.add_image("image-one-guid").unwrap();
                image.set_name("Spherical image");
                image.set_pointcloud_guid("scan-one-guid");
                let mut encoded = Cursor::new(b"fixture-encoded-png".to_vec());
                let mut mask = Cursor::new(b"fixture-mask-png".to_vec());
                image
                    .add_spherical(
                        ImageFormat::Png,
                        &mut encoded,
                        SphericalImageProperties {
                            width: 400,
                            height: 200,
                            pixel_width: std::f64::consts::TAU / 400.0,
                            pixel_height: std::f64::consts::PI / 200.0,
                        },
                        Some(&mut mask),
                    )
                    .unwrap();
                image.finalize().unwrap();
            }
            writer.finalize().unwrap();
        }
        bytes
    }

    #[test]
    fn decodes_all_e57_scans_and_applies_scan_poses() {
        let collection = parse_e57(e57_fixture(), "fixture.e57").unwrap();
        assert_eq!(2, collection.scans.len());
        let first = collection.scans[0].as_ref().unwrap();
        let second = collection.scans[1].as_ref().unwrap();
        assert_eq!("Scan one", first.name);
        assert_eq!("Scan two", second.name);
        assert_eq!(&[0.0, 0.0, 0.0], first.positions.as_slice());
        assert_eq!(&[10.0, 0.0, 0.0], second.positions.as_slice());
        assert_eq!(&[255, 64, 0], first.colors.as_slice());
        assert_eq!(1, first.intensity.len());
        assert_eq!(1, collection.images.len());
        let image = collection.images[0].as_ref().unwrap();
        assert_eq!(b"fixture-encoded-png", image.data.as_slice());
        assert_eq!(b"fixture-mask-png", image.mask.as_slice());
        let metadata: serde_json::Value = serde_json::from_str(&image.metadata_json).unwrap();
        assert_eq!("e57-spherical", metadata["cameraModel"]);
        assert_eq!("scan-one-guid", metadata["associatedPointcloudGuid"]);
        assert_eq!(400.0 / std::f64::consts::TAU, metadata["fx"]);
    }

    #[test]
    #[ignore = "regenerates checked-in browser/extension fixtures"]
    fn generate_test_fixtures() {
        let dir = "../../engine/test/fixtures/lidar";
        std::fs::create_dir_all(dir).unwrap();
        std::fs::write(format!("{dir}/attributes.las"), las_fixture(false)).unwrap();
        std::fs::write(format!("{dir}/attributes.laz"), las_fixture(true)).unwrap();
        std::fs::write(format!("{dir}/multi-scan.e57"), e57_fixture()).unwrap();
    }
}

/// A file of which only some byte ranges are present: enough for `las` to
/// read the header and VLRs, the LAZ chunk table and EVLRs, and one worker's
/// share of the points. Reading anywhere else is an error rather than zeros,
/// so a plan that misjudged a range fails loudly instead of decoding garbage.
struct SparseFile {
    regions: Vec<(u64, Vec<u8>)>,
    len: u64,
    pos: u64,
}

impl std::io::Read for SparseFile {
    fn read(&mut self, buf: &mut [u8]) -> std::io::Result<usize> {
        if self.pos >= self.len || buf.is_empty() {
            return Ok(0);
        }
        for (start, bytes) in &self.regions {
            let end = start + bytes.len() as u64;
            if self.pos >= *start && self.pos < end {
                let offset = usize::try_from(self.pos - start).unwrap_or(usize::MAX);
                let n = buf.len().min(bytes.len() - offset);
                buf[..n].copy_from_slice(&bytes[offset..offset + n]);
                self.pos += n as u64;
                return Ok(n);
            }
        }
        Err(std::io::Error::new(
            std::io::ErrorKind::UnexpectedEof,
            format!(
                "byte {} of the LAS file was not provided to this range",
                self.pos
            ),
        ))
    }
}

impl std::io::Seek for SparseFile {
    fn seek(&mut self, to: std::io::SeekFrom) -> std::io::Result<u64> {
        let target = match to {
            std::io::SeekFrom::Start(at) => i128::from(at),
            std::io::SeekFrom::End(delta) => i128::from(self.len) + i128::from(delta),
            std::io::SeekFrom::Current(delta) => i128::from(self.pos) + i128::from(delta),
        };
        self.pos = u64::try_from(target).map_err(|_| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "seek before the file start",
            )
        })?;
        Ok(self.pos)
    }
}

/// One worker's share of a LAS/LAZ file: points `[first, first + count)`,
/// stored in bytes `[byte_start, byte_end)`.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LasRange {
    first: u64,
    count: u64,
    byte_start: u64,
    byte_end: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LasRangePlan {
    point_count: u64,
    /// Bytes `[0, head_end)` hold the header, VLRs and (LAZ) the chunk-table
    /// pointer; bytes `[tail_start, end)` the LAZ chunk table and any EVLRs.
    head_end: u64,
    tail_start: u64,
    /// The first finite GPS time in the file, which every range subtracts.
    gps_offset: Option<f64>,
    source_origin: [f64; 3],
    metadata: LasMetadata,
    ranges: Vec<LasRange>,
}

fn read_i64_at(data: &[u8], at: u64) -> Option<i64> {
    let at = usize::try_from(at).ok()?;
    let bytes: [u8; 8] = data.get(at..at.checked_add(8)?)?.try_into().ok()?;
    Some(i64::from_le_bytes(bytes))
}

/// Chunk boundaries of a LAZ file: (first point, point count, byte start) per
/// chunk.
fn laz_chunks(
    data: &[u8],
    header: &las::Header,
    data_start: u64,
    point_count: u64,
) -> Result<Vec<(u64, u64, u64)>, String> {
    let vlr = header.laz_vlr().map_err(|e| e.to_string())?;
    let mut cursor = Cursor::new(data);
    std::io::Seek::seek(&mut cursor, std::io::SeekFrom::Start(data_start))
        .map_err(|e| e.to_string())?;
    let table = laz::laszip::ChunkTable::read_from(&mut cursor, &vlr).map_err(|e| e.to_string())?;
    let mut chunks = Vec::with_capacity(table.len());
    let mut first = 0u64;
    let mut byte = data_start + 8;
    for entry in table.as_ref() {
        if first >= point_count {
            break;
        }
        // Fixed-size tables report the nominal size for the last chunk too.
        let count = entry.point_count.min(point_count - first);
        chunks.push((first, count, byte));
        first += count;
        byte += entry.byte_count;
    }
    Ok(chunks)
}

/// Split a LAS/LAZ file into about `parts` ranges a worker each can decode on
/// its own, aligned to LAZ chunks so no range starts mid-chunk.
///
/// # Errors
/// Fails on a header the sequential reader would also reject.
#[wasm_bindgen]
pub fn las_range_plan(data: &[u8], parts: u32) -> Result<String, JsValue> {
    las_range_plan_inner(data, parts).map_err(|e| JsValue::from_str(&e))
}

/// Where a LAS/LAZ file keeps what every range needs.
struct LasLayout {
    data_start: u64,
    record_len: u64,
    compressed: bool,
    /// LAZ only: the chunk table's byte offset.
    table_start: Option<u64>,
    head_end: u64,
    tail_start: u64,
}

fn las_layout(data: &[u8]) -> Result<LasLayout, String> {
    let raw = las::raw::Header::read_from(data).map_err(|e| e.to_string())?;
    let data_start = u64::from(raw.offset_to_point_data);
    let compressed = las::point::Format::new(raw.point_data_record_format)
        .map_err(|e| e.to_string())?
        .is_compressed;
    let evlr_start = raw
        .evlr
        .as_ref()
        .filter(|evlr| evlr.number_of_evlrs > 0)
        .map(|evlr| evlr.start_of_first_evlr);
    let file_len = data.len() as u64;
    let table_start = if compressed {
        // The same pointer the decompressor follows: at the start of the point
        // data, or - when the writer could not seek back - at the very end.
        let start = i64::try_from(data_start).map_err(|e| e.to_string())?;
        let mut at = read_i64_at(data, data_start).ok_or("missing chunk table offset")?;
        if at <= start {
            at = read_i64_at(data, file_len.saturating_sub(8))
                .ok_or("missing chunk table offset")?;
        }
        Some(u64::try_from(at).map_err(|_| "invalid chunk table offset")?)
    } else {
        None
    };
    let tail_start = match (table_start, evlr_start) {
        (Some(table), Some(evlr)) => table.min(evlr),
        (Some(table), None) => table,
        (None, Some(evlr)) => evlr,
        (None, None) => file_len,
    }
    .min(file_len);
    Ok(LasLayout {
        data_start,
        record_len: u64::from(raw.point_data_record_length),
        compressed,
        table_start,
        head_end: if compressed {
            data_start + 8
        } else {
            data_start
        },
        tail_start,
    })
}

/// The first finite GPS time, read through a partial view of the file (the
/// header, the start of the point data and the tail), so the whole file is
/// never copied again for it.
fn las_header_and_gps_offset(
    data: &[u8],
    layout: &LasLayout,
) -> Result<(las::Header, Option<f64>), String> {
    let file_len = data.len() as u64;
    let slice = |from: u64, to: u64| -> Vec<u8> {
        let from = usize::try_from(from.min(file_len)).unwrap_or(data.len());
        let to = usize::try_from(to.min(file_len)).unwrap_or(data.len());
        data[from..to.max(from)].to_vec()
    };
    let probe = SparseFile {
        regions: vec![
            (0, slice(0, layout.head_end + 16 * 1024 * 1024)),
            (layout.tail_start, slice(layout.tail_start, file_len)),
        ],
        len: file_len,
        pos: 0,
    };
    let mut reader = LasReader::new(probe).map_err(|e| e.to_string())?;
    let header = reader.header().clone();
    let mut found = None;
    if header.point_format().has_gps_time {
        for point in reader.points() {
            let value = point
                .map_err(|e| e.to_string())?
                .gps_time
                .unwrap_or(f64::NAN);
            if value.is_finite() {
                found = Some(value);
                break;
            }
        }
    }
    Ok((header, found))
}

/// About `parts` point ranges of balanced size, chunk-aligned for LAZ.
fn las_ranges(
    data: &[u8],
    header: &las::Header,
    layout: &LasLayout,
    parts: u32,
) -> Result<Vec<LasRange>, String> {
    let point_count = header.number_of_points();
    let file_len = data.len() as u64;
    let target = point_count.div_ceil(u64::from(parts.max(1))).max(1);
    let mut ranges = Vec::new();
    if layout.compressed {
        let chunks = laz_chunks(data, header, layout.data_start, point_count)?;
        let table_start = layout.table_start.unwrap_or(file_len);
        let mut current: Option<LasRange> = None;
        for (index, &(first, count, byte)) in chunks.iter().enumerate() {
            let next_byte = chunks.get(index + 1).map_or(table_start, |c| c.2);
            let range = current.get_or_insert(LasRange {
                first,
                count: 0,
                byte_start: byte,
                byte_end: next_byte,
            });
            range.count += count;
            range.byte_end = next_byte;
            if range.count >= target {
                ranges.extend(current.take());
            }
        }
        ranges.extend(current);
    } else {
        let mut first = 0;
        while first < point_count {
            let count = target.min(point_count - first);
            ranges.push(LasRange {
                first,
                count,
                byte_start: layout.data_start + first * layout.record_len,
                byte_end: layout.data_start + (first + count) * layout.record_len,
            });
            first += count;
        }
    }
    // The LAZ arithmetic decoder may look a few bytes past a chunk's end; a
    // little of the next range costs nothing and keeps reads in bounds.
    for range in &mut ranges {
        range.byte_end = (range.byte_end + 64 * 1024).min(file_len);
    }
    Ok(ranges)
}

fn las_range_plan_inner(data: &[u8], parts: u32) -> Result<String, String> {
    let layout = las_layout(data)?;
    let (header, gps_offset) = las_header_and_gps_offset(data, &layout)?;
    let point_count = header.number_of_points();
    validate_decoded_size(point_count, las_bytes_per_point(&header))?;
    let origin = las_origin(&header);
    let plan = LasRangePlan {
        point_count,
        head_end: layout.head_end,
        tail_start: layout.tail_start,
        gps_offset,
        source_origin: origin,
        metadata: las_header_metadata(&header, origin),
        ranges: las_ranges(data, &header, &layout, parts)?,
    };
    serde_json::to_string(&plan).map_err(|e| e.to_string())
}

/// One range of a LAS/LAZ file, decoded. Colours stay 16-bit: whether they
/// are 8-bit-in-16-bit is a decision over the whole file (see
/// [`las_colors_to_bytes`]).
#[wasm_bindgen]
pub struct LasRangeResult {
    points: LasPoints,
}

#[wasm_bindgen]
impl LasRangeResult {
    #[wasm_bindgen(getter)]
    #[must_use]
    pub fn max_color(&self) -> u16 {
        self.points.max_color
    }
    #[wasm_bindgen(getter)]
    #[must_use]
    pub fn color_channels_above_byte(&self) -> u32 {
        u32::try_from(self.points.color_channels_above_byte).unwrap_or(u32::MAX)
    }
    #[must_use]
    pub fn bounds(&self) -> Vec<f32> {
        let (min, max) = (self.points.min, self.points.max);
        vec![min[0], min[1], min[2], max[0], max[1], max[2]]
    }
    pub fn take_positions(&mut self) -> Vec<f32> {
        mem::take(&mut self.points.positions)
    }
    pub fn take_colors16(&mut self) -> Vec<u16> {
        mem::take(&mut self.points.colors16)
    }
    pub fn take_intensity(&mut self) -> Vec<f32> {
        mem::take(&mut self.points.intensity)
    }
    pub fn take_classification(&mut self) -> Vec<f32> {
        mem::take(&mut self.points.classification)
    }
    pub fn take_return_number(&mut self) -> Vec<f32> {
        mem::take(&mut self.points.return_number)
    }
    pub fn take_number_of_returns(&mut self) -> Vec<f32> {
        mem::take(&mut self.points.number_of_returns)
    }
    pub fn take_scan_angle(&mut self) -> Vec<f32> {
        mem::take(&mut self.points.scan_angle)
    }
    pub fn take_gps_time(&mut self) -> Vec<f32> {
        mem::take(&mut self.points.gps_time)
    }
    pub fn take_user_data(&mut self) -> Vec<f32> {
        mem::take(&mut self.points.user_data)
    }
    pub fn take_point_source_id(&mut self) -> Vec<f32> {
        mem::take(&mut self.points.point_source_id)
    }
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct LasRangeJob {
    file_len: u64,
    tail_start: u64,
    body_start: u64,
    first: u64,
    count: u64,
    /// Not in the JSON: a float through `serde_json` can come back one ulp
    /// off, which would shift every relative GPS time. It travels as an f64.
    #[serde(skip)]
    gps_offset: Option<f64>,
}

/// Decode one range from a plan made by [`las_range_plan`]. `head`, `tail`
/// and `body` are the bytes at `[0, head.len())`, `tail_start..` and
/// `body_start..`; `gps_offset` is the plan's offset, NaN when it has none.
///
/// # Errors
/// Fails when the range needs bytes it was not given, or on corrupt data.
#[wasm_bindgen]
pub fn parse_las_range(
    head: Vec<u8>,
    tail: Vec<u8>,
    body: Vec<u8>,
    job_json: &str,
    gps_offset: f64,
) -> Result<LasRangeResult, JsValue> {
    let mut job: LasRangeJob =
        serde_json::from_str(job_json).map_err(|e| JsValue::from_str(&e.to_string()))?;
    job.gps_offset = gps_offset.is_finite().then_some(gps_offset);
    parse_las_range_inner(head, tail, body, &job).map_err(|e| JsValue::from_str(&e))
}

fn parse_las_range_inner(
    head: Vec<u8>,
    tail: Vec<u8>,
    body: Vec<u8>,
    job: &LasRangeJob,
) -> Result<LasRangeResult, String> {
    let source = SparseFile {
        regions: vec![(0, head), (job.body_start, body), (job.tail_start, tail)],
        len: job.file_len,
        pos: 0,
    };
    let mut reader = LasReader::new(source).map_err(|e| e.to_string())?;
    let header = reader.header().clone();
    let count = usize::try_from(job.count).map_err(|e| e.to_string())?;
    let mut points = LasPoints::new(
        &header,
        las_origin(&header),
        GpsOffset::Fixed(job.gps_offset),
        count,
    );
    reader.seek(job.first).map_err(|e| e.to_string())?;
    for _ in 0..job.count {
        let point = reader
            .read_point()
            .map_err(|e| e.to_string())?
            .ok_or("LAS range ended before its declared point count")?;
        points.push(&point);
    }
    Ok(LasRangeResult { points })
}

/// The 8-bit colours of a whole LAS/LAZ file from its ranges' 16-bit ones,
/// with the encoding decided over every channel as the whole-file parse does.
#[wasm_bindgen]
pub struct LasColorBytes {
    colors: Vec<u8>,
    encoding: &'static str,
}

#[wasm_bindgen]
impl LasColorBytes {
    #[wasm_bindgen(getter)]
    #[must_use]
    pub fn encoding(&self) -> String {
        self.encoding.to_owned()
    }
    pub fn take_colors(&mut self) -> Vec<u8> {
        mem::take(&mut self.colors)
    }
}

#[wasm_bindgen]
#[must_use]
pub fn las_colors_to_bytes(colors16: Vec<u16>, max_color: u16, above_byte: u32) -> LasColorBytes {
    let (sixteen, encoding) = las_color_encoding(max_color, above_byte as usize, colors16.len());
    LasColorBytes {
        colors: las_colors_to_u8(colors16, sixteen),
        encoding,
    }
}

#[cfg(test)]
mod range_tests {
    use super::*;
    use las::{Builder, Color, Point, Writer};

    /// Enough points for several LAZ chunks (50 000 points each by default).
    fn fixture(format: u8, compressed: bool, points: u32) -> Vec<u8> {
        let mut builder = Builder::from((1, 4));
        builder.point_format = las::point::Format::new(format).unwrap();
        builder.point_format.is_compressed = compressed;
        builder.transforms.x.offset = 4_000_000.0;
        let has_gps = builder.point_format.has_gps_time;
        let has_color = builder.point_format.has_color;
        let header = builder.into_header().unwrap();
        let mut writer = Writer::new(Cursor::new(Vec::new()), header).unwrap();
        for i in 0..points {
            let f = f64::from(i);
            writer
                .write_point(Point {
                    x: 4_000_000.0 + (f * 0.37).sin() * 50.0,
                    y: f * 0.01,
                    z: (f * 0.013).cos() * 10.0,
                    intensity: (i % 65_000) as u16,
                    return_number: u8::try_from(i % 3 + 1).unwrap(),
                    number_of_returns: 3,
                    classification: las::point::Classification::Ground,
                    scan_angle: f32::from(u8::try_from(i % 90).unwrap()),
                    user_data: (i % 251) as u8,
                    point_source_id: (i % 7) as u16,
                    // Not finite at first, so the offset is a later point's.
                    gps_time: has_gps.then_some(if i < 3 { f64::NAN } else { 1.0e8 + f * 1e-3 }),
                    color: has_color.then(|| Color::new((i % 300) as u16, 200, (i % 256) as u16)),
                    ..Default::default()
                })
                .unwrap();
        }
        writer.close().unwrap();
        writer.into_inner().unwrap().into_inner()
    }

    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Plan {
        head_end: u64,
        tail_start: u64,
        gps_offset: Option<f64>,
        metadata: serde_json::Value,
        ranges: Vec<Range>,
    }
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Range {
        first: u64,
        count: u64,
        byte_start: u64,
        byte_end: u64,
    }

    fn slice(data: &[u8], from: u64, to: u64) -> Vec<u8> {
        data[usize::try_from(from).unwrap()..usize::try_from(to).unwrap()].to_vec()
    }

    /// The ranges decoded and concatenated, as the extension host does.
    fn ranged(data: &[u8], parts: u32) -> (Vec<Vec<f32>>, Vec<u8>, serde_json::Value) {
        let plan: Plan = serde_json::from_str(&las_range_plan_inner(data, parts).unwrap()).unwrap();
        // The exact offset, as the f64 argument carries it (not via JSON).
        let gps_offset = las_header_and_gps_offset(data, &las_layout(data).unwrap())
            .unwrap()
            .1;
        assert_eq!(plan.gps_offset.is_some(), gps_offset.is_some());
        let len = data.len() as u64;
        let mut columns: Vec<Vec<f32>> = vec![Vec::new(); 9];
        let mut colors16 = Vec::new();
        let (mut max_color, mut above) = (0u16, 0u32);
        for range in &plan.ranges {
            let job = LasRangeJob {
                file_len: len,
                tail_start: plan.tail_start,
                body_start: range.byte_start,
                first: range.first,
                count: range.count,
                gps_offset,
            };
            let mut part = parse_las_range_inner(
                slice(data, 0, plan.head_end),
                slice(data, plan.tail_start, len),
                slice(data, range.byte_start, range.byte_end),
                &job,
            )
            .unwrap();
            max_color = max_color.max(part.max_color());
            above += part.color_channels_above_byte();
            colors16.extend(part.take_colors16());
            for (column, values) in columns.iter_mut().zip([
                part.take_positions(),
                part.take_intensity(),
                part.take_classification(),
                part.take_return_number(),
                part.take_number_of_returns(),
                part.take_scan_angle(),
                part.take_gps_time(),
                part.take_user_data(),
                part.take_point_source_id(),
            ]) {
                column.extend(values);
            }
        }
        let colors16_empty = colors16.is_empty();
        let mut colors = las_colors_to_bytes(colors16, max_color, above);
        let has_colors = !colors16_empty;
        let mut metadata = plan.metadata;
        metadata["colorEncoding"] = if has_colors {
            serde_json::Value::from(colors.encoding())
        } else {
            serde_json::Value::Null
        };
        metadata["gpsTimeOffset"] = serde_json::json!(gps_offset);
        (columns, colors.take_colors(), metadata)
    }

    #[test]
    fn ranges_reproduce_the_whole_file_parse_at_every_split() {
        for (format, compressed) in [(3, true), (3, false), (1, true), (0, true), (0, false)] {
            let data = fixture(format, compressed, 130_000);
            let whole = parse_las(data.clone(), "f").unwrap();
            let scan = whole.scans[0].as_ref().unwrap();
            let expected = vec![
                scan.positions.clone(),
                scan.intensity.clone(),
                scan.classification.clone(),
                scan.return_number.clone(),
                scan.number_of_returns.clone(),
                scan.scan_angle.clone(),
                scan.gps_time.clone(),
                scan.user_data.clone(),
                scan.point_source_id.clone(),
            ];
            let metadata: serde_json::Value = serde_json::from_str(&scan.metadata_json).unwrap();
            for parts in [1, 2, 3, 7] {
                let (columns, colors, ranged_metadata) = ranged(&data, parts);
                let label = format!("format {format} compressed {compressed} parts {parts}");
                // Bit-level comparison: NaN GPS times must match too.
                for (got, want) in columns.iter().zip(&expected) {
                    let got: Vec<u32> = got.iter().map(|v| v.to_bits()).collect();
                    let want: Vec<u32> = want.iter().map(|v| v.to_bits()).collect();
                    assert_eq!(got, want, "{label}");
                }
                assert_eq!(colors, scan.colors, "{label}");
                assert_eq!(ranged_metadata, metadata, "{label}");
            }
        }
    }
}

/// Where one E57 scan's binary section lies, page-aligned.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct E57ScanSpan {
    start: u64,
    end: u64,
    records: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct E57ScanPlan {
    page_size: u64,
    /// Bytes `[xml_start, file end)` hold the XML (written last by every
    /// writer we have seen; if not, the range is simply larger).
    xml_start: u64,
    /// The first valid point in scan order - the origin every scan is
    /// rebased on - and the scan it is in. Scans before that one have no
    /// valid points and keep a zero origin, as in the whole-file decode.
    origin: Option<[f64; 3]>,
    origin_scan: Option<usize>,
    image_count: usize,
    scans: Vec<E57ScanSpan>,
}

fn e57_bytes_per_point(pc: &e57::PointCloud) -> u64 {
    12 + if pc.has_color() { 3 } else { 0 }
        + if pc.has_intensity() { 4 } else { 0 }
        + if pc.has_row_column() { 8 } else { 0 }
}

/// Plan a scan-per-worker decode of a multi-scan E57.
///
/// # Errors
/// Fails on a file the whole-file decoder would also reject.
#[wasm_bindgen]
pub fn e57_scan_plan(data: &[u8]) -> Result<String, JsValue> {
    e57_scan_plan_inner(data).map_err(|e| JsValue::from_str(&e))
}

fn e57_scan_plan_inner(data: &[u8]) -> Result<String, String> {
    let file_len = data.len() as u64;
    let mut reader = e57::E57Reader::new(Cursor::new(data)).map_err(|e| e.to_string())?;
    let header = reader.header();
    let page = header.page_size.max(1);
    let floor = |at: u64| at / page * page;
    let ceil = |at: u64| at.div_ceil(page) * page;
    let descriptors = reader.pointclouds();

    // The sections do not overlap, so each one ends before the next one
    // starts - or before the XML, or at the end of the file.
    let mut starts: Vec<u64> = descriptors.iter().map(|pc| pc.file_offset).collect();
    starts.push(header.phys_xml_offset);
    let scans = descriptors
        .iter()
        .map(|pc| {
            let next = starts
                .iter()
                .copied()
                .filter(|start| *start > pc.file_offset)
                .min()
                .unwrap_or(file_len);
            E57ScanSpan {
                start: floor(pc.file_offset),
                end: ceil(next).min(file_len),
                records: pc.records,
            }
        })
        .collect();

    let mut origin = None;
    let mut origin_scan = None;
    for (index, pc) in descriptors.iter().enumerate() {
        // The same skips as the decode: an oversized or unreadable scan never
        // contributes the origin.
        if validate_decoded_size(pc.records, e57_bytes_per_point(pc)).is_err() {
            continue;
        }
        let Ok(mut points) = reader.pointcloud_simple(pc) else {
            continue;
        };
        points.intensity_to_color(false);
        for point in points.flatten() {
            if let e57::CartesianCoordinate::Valid { x, y, z } = point.cartesian {
                origin = Some([x, y, z]);
                break;
            }
        }
        if origin.is_some() {
            origin_scan = Some(index);
            break;
        }
    }

    let plan = E57ScanPlan {
        page_size: page,
        xml_start: floor(header.phys_xml_offset),
        origin,
        origin_scan,
        image_count: reader.images().len(),
        scans,
    };
    serde_json::to_string(&plan).map_err(|e| e.to_string())
}

#[derive(serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct E57ScanJob {
    file_len: u64,
    xml_start: u64,
    body_start: u64,
    scan_index: usize,
    file_name: String,
    /// The origin itself travels as three f64 arguments, never through JSON.
    has_origin: bool,
}

/// One scan decoded on its own, with the errors it produced.
#[wasm_bindgen]
pub struct E57ScanJobResult {
    scan: Option<LidarScanResult>,
    errors: Vec<String>,
}

#[wasm_bindgen]
impl E57ScanJobResult {
    /// The decoded scan; `undefined` when the scan could not be decoded.
    pub fn take_scan(&mut self) -> Option<LidarScanResult> {
        self.scan.take()
    }
    #[wasm_bindgen(getter)]
    #[must_use]
    pub fn errors_json(&self) -> String {
        serde_json::to_string(&self.errors).unwrap_or_else(|_| "[]".into())
    }
}

/// Decode scan `scan_index` from the first page, the XML region and the
/// scan's own section, rebased on `origin` when the job says it has one.
///
/// # Errors
/// Fails when the partial file cannot be opened as an E57.
#[wasm_bindgen]
pub fn parse_e57_scan(
    head: Vec<u8>,
    xml: Vec<u8>,
    body: Vec<u8>,
    job_json: &str,
    origin_x: f64,
    origin_y: f64,
    origin_z: f64,
) -> Result<E57ScanJobResult, JsValue> {
    parse_e57_scan_inner(head, xml, body, job_json, [origin_x, origin_y, origin_z])
        .map_err(|e| JsValue::from_str(&e))
}

fn parse_e57_scan_inner(
    head: Vec<u8>,
    xml: Vec<u8>,
    body: Vec<u8>,
    job_json: &str,
    origin: [f64; 3],
) -> Result<E57ScanJobResult, String> {
    let job: E57ScanJob = serde_json::from_str(job_json).map_err(|e| e.to_string())?;
    let source = SparseFile {
        regions: vec![(0, head), (job.body_start, body), (job.xml_start, xml)],
        len: job.file_len,
        pos: 0,
    };
    let mut reader = e57::E57Reader::new(source).map_err(|e| e.to_string())?;
    let descriptors = reader.pointclouds();
    let pc = descriptors
        .get(job.scan_index)
        .ok_or("E57 scan index out of range")?;
    let mut common_origin = job.has_origin.then_some(origin);
    let mut errors = Vec::new();
    let scan = decode_e57_scan(
        &mut reader,
        pc,
        job.scan_index,
        descriptors.len(),
        &job.file_name,
        &mut common_origin,
        &mut errors,
    );
    Ok(E57ScanJobResult { scan, errors })
}

/// The embedded images of an E57 on their own, for a file whose scans were
/// decoded elsewhere. `has_origin` false records a zero origin.
///
/// # Errors
/// Fails on a file the whole-file decoder would also reject.
#[wasm_bindgen]
pub fn e57_images_only(
    data: &[u8],
    origin_x: f64,
    origin_y: f64,
    origin_z: f64,
    has_origin: bool,
) -> Result<LidarCollectionResult, JsValue> {
    let mut reader =
        e57::E57Reader::new(Cursor::new(data)).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let origin = if has_origin {
        [origin_x, origin_y, origin_z]
    } else {
        [0.0; 3]
    };
    let mut errors = Vec::new();
    let images = e57_images(&mut reader, origin, &mut errors);
    Ok(LidarCollectionResult {
        scans: Vec::new(),
        images,
        errors,
    })
}

#[cfg(test)]
mod e57_scan_tests {
    use super::*;
    use e57::{
        E57Writer, ImageFormat, Record, RecordValue, SphericalImageProperties, Transform,
        Translation,
    };

    fn fixture() -> Vec<u8> {
        let mut bytes = Vec::new();
        {
            let mut writer = E57Writer::new(Cursor::new(&mut bytes), "plan-guid").unwrap();
            let prototype = vec![
                Record::CARTESIAN_X_F64,
                Record::CARTESIAN_Y_F64,
                Record::CARTESIAN_Z_F64,
                Record::COLOR_RED_U8,
                Record::COLOR_GREEN_U8,
                Record::COLOR_BLUE_U8,
                Record::INTENSITY_U16,
            ];
            for (index, count) in [3_000u32, 60_000, 1, 20_000].into_iter().enumerate() {
                let guid = format!("scan-{index}");
                let mut scan = writer.add_pointcloud(&guid, prototype.clone()).unwrap();
                scan.set_name(Some(format!("Scan {index}")));
                scan.set_transform(Some(Transform {
                    translation: Translation {
                        x: 10.0 * f64::from(u32::try_from(index).unwrap()),
                        y: 0.0,
                        z: 0.0,
                    },
                    ..Default::default()
                }));
                for i in 0..count {
                    let f = f64::from(i);
                    scan.add_point(vec![
                        RecordValue::Double(5000.0 + (f * 0.1).sin()),
                        RecordValue::Double(2000.0 + f * 1e-3),
                        RecordValue::Double((f * 0.01).cos()),
                        RecordValue::Integer(i64::from(i % 256)),
                        RecordValue::Integer(64),
                        RecordValue::Integer(i64::from((i * 7) % 256)),
                        RecordValue::Integer(i64::from(i % 65_536)),
                    ])
                    .unwrap();
                }
                scan.finalize().unwrap();
                if index == 1 {
                    // A blob between two scans' sections.
                    let mut image = writer.add_image("image-guid").unwrap();
                    image.set_pointcloud_guid("scan-1");
                    let mut encoded = Cursor::new(vec![7u8; 5000]);
                    image
                        .add_spherical(
                            ImageFormat::Png,
                            &mut encoded,
                            SphericalImageProperties {
                                width: 40,
                                height: 20,
                                pixel_width: 0.1,
                                pixel_height: 0.1,
                            },
                            None,
                        )
                        .unwrap();
                    image.finalize().unwrap();
                }
            }
            writer.finalize().unwrap();
        }
        bytes
    }

    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Plan {
        xml_start: u64,
        origin: Option<[f64; 3]>,
        origin_scan: Option<usize>,
        image_count: usize,
        scans: Vec<Span>,
    }
    #[derive(serde::Deserialize)]
    struct Span {
        start: u64,
        end: u64,
    }

    fn part(data: &[u8], from: u64, to: u64) -> Vec<u8> {
        data[usize::try_from(from).unwrap()..usize::try_from(to).unwrap()].to_vec()
    }

    #[test]
    fn each_scan_decodes_on_its_own_exactly_as_in_the_whole_file() {
        let data = fixture();
        let whole = parse_e57(data.clone(), "f.e57").unwrap();
        let plan: Plan = serde_json::from_str(&e57_scan_plan_inner(&data).unwrap()).unwrap();
        assert_eq!(plan.scans.len(), whole.scans.len());
        assert_eq!(plan.image_count, 1);
        assert_eq!(plan.origin_scan, Some(0));
        let page = 1024;
        for (index, span) in plan.scans.iter().enumerate() {
            let job = serde_json::json!({
                "fileLen": data.len(),
                "xmlStart": plan.xml_start,
                "bodyStart": span.start,
                "scanIndex": index,
                "fileName": "f.e57",
                "hasOrigin": plan.origin_scan.is_some_and(|scan| index >= scan),
            });
            let mut result = parse_e57_scan_inner(
                part(&data, 0, page),
                part(&data, plan.xml_start, data.len() as u64),
                part(&data, span.start, span.end),
                &job.to_string(),
                plan.origin.unwrap_or([0.0; 3]),
            )
            .unwrap();
            assert!(result.errors.is_empty(), "{:?}", result.errors);
            let scan = result.take_scan().unwrap();
            let expected = whole.scans[index].as_ref().unwrap();
            let bits = |v: &[f32]| v.iter().map(|x| x.to_bits()).collect::<Vec<_>>();
            assert_eq!(
                bits(&scan.positions),
                bits(&expected.positions),
                "scan {index}"
            );
            assert_eq!(scan.colors, expected.colors);
            assert_eq!(bits(&scan.intensity), bits(&expected.intensity));
            assert_eq!(scan.metadata_json, expected.metadata_json);
            assert_eq!(
                scan.source_origin.map(f64::to_bits),
                expected.source_origin.map(f64::to_bits)
            );
            assert_eq!(scan.name, expected.name);
        }
        let origin = plan.origin.unwrap();
        let images = e57_images_only(&data, origin[0], origin[1], origin[2], true).unwrap();
        assert_eq!(images.images.len(), whole.images.len());
        for (a, b) in images.images.iter().zip(&whole.images) {
            let (a, b) = (a.as_ref().unwrap(), b.as_ref().unwrap());
            assert_eq!(a.metadata_json, b.metadata_json);
            assert_eq!(a.data, b.data);
        }
    }
}
