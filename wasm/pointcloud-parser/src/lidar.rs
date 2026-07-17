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
    pub fn errors_json(&self) -> String {
        serde_json::to_string(&self.errors).unwrap_or_else(|_| "[]".into())
    }
}

const MAX_DECODED_BUFFER_BYTES: u64 = 1024 * 1024 * 1024;

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

#[wasm_bindgen]
pub fn parse_las(data: Vec<u8>, file_name: &str) -> Result<LidarCollectionResult, JsValue> {
    let cursor = Cursor::new(data);
    let mut reader = LasReader::new(cursor).map_err(|e| JsValue::from_str(&e.to_string()))?;
    let header = reader.header().clone();
    let has_colors = header.point_format().has_color;
    let has_gps = header.point_format().has_gps_time;
    // Positions + seven always-present scalar fields, with optional GPS and
    // temporary/final RGB storage. This rejects hostile headers before large
    // Vec allocations can trap the WASM instance.
    let bytes_per_point = 40 + if has_gps { 4 } else { 0 } + if has_colors { 9 } else { 0 };
    let count = validate_decoded_size(header.number_of_points(), bytes_per_point)
        .map_err(|error| JsValue::from_str(&error))?;
    let bounds = header.bounds();
    let origin = [
        (bounds.min.x + bounds.max.x) * 0.5,
        (bounds.min.y + bounds.max.y) * 0.5,
        (bounds.min.z + bounds.max.z) * 0.5,
    ];
    let point_format = header.point_format().to_u8().unwrap_or_default();
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
    let mut metadata = LasMetadata {
        format: if header.point_format().is_compressed {
            "LAZ"
        } else {
            "LAS"
        },
        version: header.version().to_string(),
        point_format,
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
        crs: read_las_crs(&header),
        color_encoding: None,
        gps_time_offset: None,
        vlrs,
    };

    let mut positions = Vec::with_capacity(count.saturating_mul(3));
    let mut colors16 = if has_colors {
        Vec::with_capacity(count.saturating_mul(3))
    } else {
        Vec::new()
    };
    let mut max_color = 0u16;
    let mut color_channels_above_byte = 0usize;
    let mut intensity = Vec::with_capacity(count);
    let mut classification = Vec::with_capacity(count);
    let mut return_number = Vec::with_capacity(count);
    let mut number_of_returns = Vec::with_capacity(count);
    let mut scan_angle = Vec::with_capacity(count);
    let mut gps_time = if has_gps {
        Vec::with_capacity(count)
    } else {
        Vec::new()
    };
    let mut user_data = Vec::with_capacity(count);
    let mut point_source_id = Vec::with_capacity(count);
    let mut gps_time_offset: Option<f64> = None;
    let mut min = [f32::INFINITY; 3];
    let mut max = [f32::NEG_INFINITY; 3];
    for point in reader.points() {
        let p = point.map_err(|e| JsValue::from_str(&e.to_string()))?;
        let x = (p.x - origin[0]) as f32;
        let y = (p.y - origin[1]) as f32;
        let z = (p.z - origin[2]) as f32;
        positions.extend_from_slice(&[x, y, z]);
        update_bounds(&mut min, &mut max, x, y, z);
        if has_colors {
            let c = p.color.unwrap_or_default();
            max_color = max_color.max(c.red).max(c.green).max(c.blue);
            color_channels_above_byte += [c.red, c.green, c.blue]
                .into_iter()
                .filter(|value| *value > 255)
                .count();
            colors16.extend_from_slice(&[c.red, c.green, c.blue]);
        }
        intensity.push(p.intensity as f32);
        classification.push(u8::from(p.classification) as f32);
        return_number.push(p.return_number as f32);
        number_of_returns.push(p.number_of_returns as f32);
        scan_angle.push(p.scan_angle);
        if has_gps {
            let value = p.gps_time.unwrap_or(f64::NAN);
            if value.is_finite() && gps_time_offset.is_none() {
                gps_time_offset = Some(value);
            }
            gps_time.push(
                gps_time_offset
                    .map(|offset| (value - offset) as f32)
                    .unwrap_or(f32::NAN),
            );
        }
        user_data.push(p.user_data as f32);
        point_source_id.push(p.point_source_id as f32);
    }
    finish_bounds(&mut min, &mut max);
    let color_is_16_bit = las_color_is_16_bit(max_color, color_channels_above_byte, colors16.len());
    let colors = if has_colors {
        let divisor = if color_is_16_bit { 257u32 } else { 1u32 };
        colors16
            .into_iter()
            .map(|v| ((v as u32 / divisor).min(255)) as u8)
            .collect()
    } else {
        Vec::new()
    };
    metadata.gps_time_offset = gps_time_offset;
    metadata.color_encoding = has_colors.then_some(if color_is_16_bit {
        "16-bit"
    } else {
        "8-bit-in-16-bit"
    });
    let result = LidarScanResult {
        name: file_name.to_owned(),
        source_count: header.number_of_points(),
        positions,
        colors,
        intensity,
        classification,
        return_number,
        number_of_returns,
        scan_angle,
        gps_time,
        user_data,
        point_source_id,
        row_index: Vec::new(),
        column_index: Vec::new(),
        has_colors,
        metadata_json: serde_json::to_string(&metadata).unwrap_or_else(|_| "{}".into()),
        source_origin: origin,
        min,
        max,
    };
    Ok(LidarCollectionResult {
        scans: vec![Some(result)],
        errors: Vec::new(),
    })
}

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
        let bytes_per_point = 12
            + if pc.has_color() { 3 } else { 0 }
            + if pc.has_intensity() { 4 } else { 0 }
            + if pc.has_row_column() { 8 } else { 0 };
        let capacity = match validate_decoded_size(pc.records, bytes_per_point) {
            Ok(capacity) => capacity,
            Err(error) => {
                errors.push(format!("scan {}: {}", scan_index + 1, error));
                continue;
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
                continue;
            }
        };
        points.intensity_to_color(false);
        for point in points {
            let p = match point {
                Ok(point) => point,
                Err(error) => {
                    invalid += 1;
                    if errors.len() < 20 {
                        errors.push(format!("scan {} record error: {error}", scan_index + 1));
                    }
                    continue;
                }
            };
            let (wx, wy, wz) = match p.cartesian {
                e57::CartesianCoordinate::Valid { x, y, z } => (x, y, z),
                _ => {
                    invalid += 1;
                    continue;
                }
            };
            let origin = *common_origin.get_or_insert([wx, wy, wz]);
            let x = (wx - origin[0]) as f32;
            let y = (wy - origin[1]) as f32;
            let z = (wz - origin[2]) as f32;
            positions.extend_from_slice(&[x, y, z]);
            update_bounds(&mut min, &mut max, x, y, z);
            if pc.has_color() {
                let c = p.color.unwrap_or(e57::Color {
                    red: 1.0,
                    green: 1.0,
                    blue: 1.0,
                });
                colors.extend_from_slice(&[
                    (c.red.clamp(0.0, 1.0) * 255.0).round() as u8,
                    (c.green.clamp(0.0, 1.0) * 255.0).round() as u8,
                    (c.blue.clamp(0.0, 1.0) * 255.0).round() as u8,
                ]);
            }
            if pc.has_intensity() {
                intensity.push(p.intensity.unwrap_or(f32::NAN));
            }
            if pc.has_row_column() {
                row_index.push(p.row as f32);
                column_index.push(p.column as f32);
            }
        }
        finish_bounds(&mut min, &mut max);
        let origin = common_origin.unwrap_or([0.0; 3]);
        let pose = pc
            .transform
            .as_ref()
            .map(|t| {
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
            .unwrap_or([0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0]);
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
        scans.push(Some(LidarScanResult {
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
        }));
    }
    if scans.is_empty() && !descriptors.is_empty() {
        return Err(JsValue::from_str(&format!(
            "none of the {} E57 scans could be decoded: {}",
            descriptors.len(),
            errors.join("; ")
        )));
    }
    Ok(LidarCollectionResult { scans, errors })
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
        use e57::{E57Writer, Record, RecordValue, Transform, Translation};
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
