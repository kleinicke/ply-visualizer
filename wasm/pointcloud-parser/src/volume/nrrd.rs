//! NRRD volumes: a plain-text header followed by raw, gzipped or ASCII voxels.
//!
//! NRRD is the bridge payload between `tiff-visualizer` (which decodes DICOM,
//! OME-TIFF and friends) and this viewer. It was chosen over a bespoke
//! descriptor because it is a documented standard that already carries
//! everything the handover needs — a full affine, world units, dtype and
//! endianness — so there is no private contract for two repositories to keep in
//! sync, and `.nrrd` files from 3D Slicer/ITK open here as a side effect.
//!
//! This reader stops at "a volume in world space". Turning that into geometry
//! is the marching cubes beside it.

use flate2::read::GzDecoder;
use std::io::Read;
use wasm_bindgen::prelude::*;

/// A NRRD sample type, reduced to what reading it needs.
#[derive(Clone, Copy, PartialEq, Debug)]
struct SampleType {
    bytes: usize,
    signed: bool,
    float: bool,
}

impl SampleType {
    /// NRRD accepts the C and C99 spellings of each type; both are data rather
    /// than names this code chose.
    fn parse(name: &str) -> Option<SampleType> {
        let int = |bytes, signed| {
            Some(SampleType {
                bytes,
                signed,
                float: false,
            })
        };
        match name.trim().to_ascii_lowercase().as_str() {
            "signed char" | "int8" | "int8_t" => int(1, true),
            "uchar" | "unsigned char" | "uint8" | "uint8_t" => int(1, false),
            "short" | "short int" | "signed short" | "signed short int" | "int16" | "int16_t" => {
                int(2, true)
            }
            "ushort" | "unsigned short" | "unsigned short int" | "uint16" | "uint16_t" => {
                int(2, false)
            }
            "int" | "signed int" | "int32" | "int32_t" => int(4, true),
            "uint" | "unsigned int" | "uint32" | "uint32_t" => int(4, false),
            "float" => Some(SampleType {
                bytes: 4,
                signed: true,
                float: true,
            }),
            "double" => Some(SampleType {
                bytes: 8,
                signed: true,
                float: true,
            }),
            _ => None,
        }
    }

    /// Single-byte types are endian-independent.
    fn endian_sensitive(self) -> bool {
        self.bytes > 1
    }

    fn read(self, data: &[u8], offset: usize, little: bool) -> f32 {
        macro_rules! bytes {
            ($n:expr) => {{
                let mut b = [0u8; $n];
                b.copy_from_slice(&data[offset..offset + $n]);
                if !little {
                    b.reverse();
                }
                b
            }};
        }
        match (self.float, self.signed, self.bytes) {
            (true, _, 4) => f32::from_le_bytes(bytes!(4)),
            (true, _, 8) => f64::from_le_bytes(bytes!(8)) as f32,
            (false, true, 1) => data[offset] as i8 as f32,
            (false, false, 1) => data[offset] as f32,
            (false, true, 2) => i16::from_le_bytes(bytes!(2)) as f32,
            (false, false, 2) => u16::from_le_bytes(bytes!(2)) as f32,
            (false, true, 4) => i32::from_le_bytes(bytes!(4)) as f32,
            (false, false, 4) => u32::from_le_bytes(bytes!(4)) as f32,
            _ => 0.0,
        }
    }
}

/// The header as `key: value` and `key:=value` pairs, plus where the data
/// starts.
///
/// The header is ASCII lines terminated by a blank line. Scanning bytes rather
/// than decoding the whole file matters: decoding a gigabyte of voxels as UTF-8
/// to find a newline is both slow and lossy.
fn read_header(data: &[u8]) -> Result<(Vec<(String, String)>, usize), String> {
    let mut header: Vec<(String, String)> = Vec::new();
    let mut offset = 0usize;
    let mut line_index = 0usize;
    let limit = data.len().min(1 << 20);

    while offset < limit {
        let mut end = offset;
        while end < limit && data[end] != b'\n' {
            end += 1;
        }
        // Tolerate CRLF, which Windows producers emit.
        let mut text_end = end;
        if text_end > offset && data[text_end - 1] == b'\r' {
            text_end -= 1;
        }
        let line: String = data[offset..text_end].iter().map(|b| *b as char).collect();
        offset = end + 1;

        if line_index == 0 {
            header.push(("__magic__".into(), line.trim().to_string()));
            line_index += 1;
            continue;
        }
        line_index += 1;

        if line.trim().is_empty() {
            return Ok((header, offset));
        }
        if line.starts_with('#') {
            continue;
        }
        // `key:=value` is a key/value pair, `key: value` a field. Both are kept
        // together; the `:=` form is how producers attach custom metadata such
        // as the intensity units this viewer reads back.
        if let Some(position) = line.find(":=") {
            header.push((
                line[..position].trim().to_ascii_lowercase(),
                line[position + 2..].trim().to_string(),
            ));
            continue;
        }
        if let Some(position) = line.find(':') {
            if position > 0 {
                header.push((
                    line[..position].trim().to_ascii_lowercase(),
                    line[position + 1..].trim().to_string(),
                ));
            }
        }
    }
    Err("NRRD header is not terminated by a blank line".into())
}

fn field<'a>(header: &'a [(String, String)], key: &str) -> Option<&'a str> {
    header
        .iter()
        .find(|(name, _)| name == key)
        .map(|(_, value)| value.as_str())
}

fn numbers(value: Option<&str>) -> Vec<f64> {
    value
        .unwrap_or("")
        .split_whitespace()
        .filter_map(|token| token.parse::<f64>().ok())
        .filter(|value| value.is_finite())
        .collect()
}

/// NRRD's `(x,y,z)` vector syntax; `none` marks a non-spatial axis.
fn parse_vectors(value: Option<&str>) -> Vec<Option<Vec<f64>>> {
    let text = match value {
        Some(text) => text,
        None => return Vec::new(),
    };
    let mut out = Vec::new();
    let bytes: Vec<char> = text.chars().collect();
    let mut i = 0usize;
    while i < bytes.len() {
        if bytes[i] == '(' {
            let start = i + 1;
            let mut end = start;
            while end < bytes.len() && bytes[end] != ')' {
                end += 1;
            }
            let inside: String = bytes[start..end].iter().collect();
            out.push(Some(
                inside
                    .split(',')
                    .filter_map(|part| part.trim().parse::<f64>().ok())
                    .collect(),
            ));
            i = end + 1;
        } else if bytes[i..]
            .iter()
            .collect::<String>()
            .to_ascii_lowercase()
            .starts_with("none")
        {
            out.push(None);
            i += 4;
        } else {
            i += 1;
        }
    }
    out
}

/// The voxel-to-world affine, normalised to RAS.
///
/// DICOM — and therefore anything derived from it — is LPS: +x left, +y
/// posterior. RAS is the convention this viewer treats as world space, so an
/// LPS volume has its first two world axes negated. Without this a CT loads
/// mirrored, which looks plausible on a roughly symmetric body and is then very
/// hard to notice.
fn build_affine(header: &[(String, String)], has_channel_axis: bool) -> Vec<f64> {
    let directions: Vec<Vec<f64>> = parse_vectors(field(header, "space directions"))
        .into_iter()
        .flatten()
        .collect();
    let origin = parse_vectors(field(header, "space origin"))
        .into_iter()
        .flatten()
        .next()
        .unwrap_or_else(|| vec![0.0, 0.0, 0.0]);
    let spacings = numbers(field(header, "spacings"));

    let columns: Vec<Vec<f64>> = if directions.len() >= 3 {
        directions[..3].to_vec()
    } else {
        // No `space directions`: fall back to axis-aligned `spacings`, then to
        // unit voxels. Both are legal NRRD and common in non-medical volumes.
        let offset = if has_channel_axis && spacings.len() > 3 {
            1
        } else {
            0
        };
        let s: Vec<f64> = (0..3)
            .map(|i| match spacings.get(i + offset) {
                Some(value) if value.is_finite() && *value != 0.0 => *value,
                _ => 1.0,
            })
            .collect();
        vec![
            vec![s[0], 0.0, 0.0],
            vec![0.0, s[1], 0.0],
            vec![0.0, 0.0, s[2]],
        ]
    };

    let space = field(header, "space")
        .unwrap_or("")
        .trim()
        .to_ascii_lowercase();
    let is_lps = space.starts_with("left-posterior-superior") || space == "lps";
    let flip = if is_lps {
        [-1.0, -1.0, 1.0]
    } else {
        [1.0, 1.0, 1.0]
    };
    let at = |column: usize, row: usize| -> f64 {
        columns
            .get(column)
            .and_then(|c| c.get(row))
            .copied()
            .unwrap_or(0.0)
    };
    let origin_at = |index: usize| origin.get(index).copied().unwrap_or(0.0);

    // Row-major 4x4: world = M * (i, j, k, 1).
    vec![
        flip[0] * at(0, 0),
        flip[0] * at(1, 0),
        flip[0] * at(2, 0),
        flip[0] * origin_at(0),
        flip[1] * at(0, 1),
        flip[1] * at(1, 1),
        flip[1] * at(2, 1),
        flip[1] * origin_at(1),
        flip[2] * at(0, 2),
        flip[2] * at(1, 2),
        flip[2] * at(2, 2),
        flip[2] * origin_at(2),
        0.0,
        0.0,
        0.0,
        1.0,
    ]
}

/// A decoded volume, handed to JS as f32 samples plus its header facts.
#[wasm_bindgen]
#[cfg_attr(test, derive(Debug))]
pub struct NrrdVolume {
    sizes: Vec<u32>,
    samples: Vec<f32>,
    ijk_to_world: Vec<f64>,
    channels: u32,
    metadata: String,
}

#[wasm_bindgen]
impl NrrdVolume {
    #[wasm_bindgen(getter)]
    pub fn sizes(&self) -> Vec<u32> {
        self.sizes.clone()
    }
    #[wasm_bindgen(getter)]
    pub fn ijk_to_world(&self) -> Vec<f64> {
        self.ijk_to_world.clone()
    }
    #[wasm_bindgen(getter)]
    pub fn channels(&self) -> u32 {
        self.channels
    }
    /// Header facts as JSON: every field, plus the units and range the viewer
    /// reads back out of them.
    #[wasm_bindgen(getter)]
    pub fn metadata_json(&self) -> String {
        self.metadata.clone()
    }
    pub fn take_samples(&mut self) -> Vec<f32> {
        std::mem::take(&mut self.samples)
    }
}

fn json_string(value: &str) -> String {
    let escaped = value
        .replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "");
    format!("\"{escaped}\"")
}

/// Parse a NRRD volume. `payload` supplies a detached data file when the header
/// names one; pass an empty slice otherwise.
#[wasm_bindgen]
pub fn parse_nrrd(data: &[u8], detached: &[u8]) -> Result<NrrdVolume, JsValue> {
    parse_nrrd_inner(data, detached).map_err(|error| JsValue::from_str(&error))
}

fn parse_nrrd_inner(data: &[u8], detached: &[u8]) -> Result<NrrdVolume, String> {
    let (header, data_start) = read_header(data)?;

    let magic = field(&header, "__magic__").unwrap_or("");
    if !magic.to_ascii_uppercase().starts_with("NRRD") {
        return Err("Not an NRRD file: missing magic".into());
    }

    let dimension = numbers(field(&header, "dimension"))
        .first()
        .copied()
        .unwrap_or(0.0) as usize;
    if !(3..=4).contains(&dimension) {
        return Err(format!(
            "NRRD dimension is {dimension}; only 3D volumes (or 4D with a channel axis) are supported"
        ));
    }
    let sizes_field: Vec<usize> = numbers(field(&header, "sizes"))
        .iter()
        .map(|value| *value as usize)
        .collect();
    if sizes_field.len() != dimension {
        return Err(format!(
            "NRRD \"sizes\" lists {} entries but dimension is {dimension}",
            sizes_field.len()
        ));
    }

    // A 4D NRRD carries a channel axis. Per the spec it is whichever axis has a
    // non-spatial `kinds` entry; in practice producers put it first. Detect it
    // rather than assuming, because guessing wrong silently transposes the
    // volume instead of failing.
    let mut channel_axis: i32 = -1;
    if dimension == 4 {
        let kinds: Vec<String> = field(&header, "kinds")
            .unwrap_or("")
            .split_whitespace()
            .map(|kind| kind.to_ascii_lowercase())
            .collect();
        channel_axis = kinds
            .iter()
            .position(|kind| kind != "domain" && kind != "space")
            .map(|position| position as i32)
            .unwrap_or(0);
        if channel_axis != 0 {
            return Err("NRRD has a channel axis that is not the first axis; only channel-first 4D volumes are supported. Re-save with the channel axis first.".into());
        }
    }

    let channels = if channel_axis == -1 {
        1
    } else {
        sizes_field[0]
    };
    let spatial: Vec<usize> = if channel_axis == -1 {
        sizes_field.clone()
    } else {
        sizes_field[1..].to_vec()
    };
    let sizes = [spatial[0], spatial[1], spatial[2]];
    let voxel_count = sizes[0] * sizes[1] * sizes[2];
    if voxel_count == 0 {
        return Err("NRRD volume is empty".into());
    }

    let type_name = field(&header, "type").unwrap_or("");
    let sample_type = SampleType::parse(type_name)
        .ok_or_else(|| format!("Unsupported NRRD sample type \"{type_name}\""))?;
    let encoding = field(&header, "encoding")
        .unwrap_or("raw")
        .trim()
        .to_ascii_lowercase();

    let has_detached =
        field(&header, "data file").is_some() || field(&header, "datafile").is_some();
    if has_detached {
        let name = field(&header, "data file")
            .or_else(|| field(&header, "datafile"))
            .unwrap_or("");
        if name.trim().starts_with("LIST") {
            return Err(
                "Detached NRRD \"data file: LIST\" (one file per slice) is not supported".into(),
            );
        }
        if detached.is_empty() {
            return Err(format!(
                "NRRD header references a detached data file \"{}\" but none was provided",
                name.trim()
            ));
        }
    }
    let payload: &[u8] = if has_detached {
        detached
    } else {
        &data[data_start.min(data.len())..]
    };

    let sample_count = voxel_count * channels;
    let little = field(&header, "endian")
        .unwrap_or("little")
        .trim()
        .to_ascii_lowercase()
        != "big"
        || !sample_type.endian_sensitive();

    // Every encoding ends as one f32 per sample; only channel 0 is kept, which
    // is what the isosurface uses.
    let mut samples = vec![0f32; voxel_count];
    let take_channel = |values: &mut Vec<f32>, read: &dyn Fn(usize) -> f32| {
        for (voxel, value) in values.iter_mut().enumerate() {
            *value = read(voxel * channels);
        }
    };

    match encoding.as_str() {
        "raw" | "gzip" | "gz" => {
            let decoded: Vec<u8>;
            let bytes: &[u8] = if encoding == "raw" {
                payload
            } else {
                let mut out = Vec::new();
                GzDecoder::new(payload)
                    .read_to_end(&mut out)
                    .map_err(|error| format!("NRRD gzip payload could not be inflated: {error}"))?;
                decoded = out;
                &decoded
            };
            let needed = sample_count * sample_type.bytes;
            if bytes.len() < needed {
                return Err(format!(
                    "NRRD data is truncated: expected {needed} bytes for {}x{}x{}{}, got {}",
                    sizes[0],
                    sizes[1],
                    sizes[2],
                    if channels > 1 {
                        format!(" x {channels} channels")
                    } else {
                        String::new()
                    },
                    bytes.len()
                ));
            }
            take_channel(&mut samples, &|index| {
                sample_type.read(bytes, index * sample_type.bytes, little)
            });
        }
        "ascii" | "text" | "txt" => {
            let text = String::from_utf8_lossy(payload);
            let values: Vec<f32> = text
                .split_whitespace()
                .filter_map(|token| token.parse::<f32>().ok())
                .collect();
            if values.len() < sample_count {
                return Err(format!(
                    "ASCII NRRD holds {} values but {sample_count} were expected",
                    values.len()
                ));
            }
            take_channel(&mut samples, &|index| values[index]);
        }
        other => {
            return Err(format!(
                "NRRD encoding \"{other}\" is not supported (raw, gzip and ascii are). Re-save the volume with \"encoding: gzip\"."
            ))
        }
    }

    let fields = header
        .iter()
        .map(|(key, value)| format!("{}:{}", json_string(key), json_string(value)))
        .collect::<Vec<_>>()
        .join(",");

    Ok(NrrdVolume {
        sizes: sizes.iter().map(|size| *size as u32).collect(),
        samples,
        ijk_to_world: build_affine(&header, channel_axis != -1),
        channels: channels as u32,
        metadata: format!("{{{fields}}}"),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn nrrd(header_lines: &[&str], body: &[u8]) -> Vec<u8> {
        let mut out = String::from("NRRD0004\n");
        for line in header_lines {
            out.push_str(line);
            out.push('\n');
        }
        out.push('\n');
        let mut bytes = out.into_bytes();
        bytes.extend_from_slice(body);
        bytes
    }

    fn body_u16(values: &[u16], little: bool) -> Vec<u8> {
        values
            .iter()
            .flat_map(|v| {
                if little {
                    v.to_le_bytes()
                } else {
                    v.to_be_bytes()
                }
            })
            .collect()
    }

    #[test]
    fn reads_a_raw_volume_and_its_affine() {
        let file = nrrd(
            &[
                "type: uint16",
                "dimension: 3",
                "sizes: 2 2 2",
                "encoding: raw",
                "endian: little",
                "space: right-anterior-superior",
                "space directions: (0.5,0,0) (0,0.5,0) (0,0,2)",
                "space origin: (10,20,30)",
            ],
            &body_u16(&[1, 2, 3, 4, 5, 6, 7, 8], true),
        );
        let mut volume = parse_nrrd_inner(&file, &[]).unwrap();
        assert_eq!(volume.sizes, vec![2, 2, 2]);
        assert_eq!(
            volume.take_samples(),
            vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0]
        );
        // Row-major: the columns are the axis directions, the last column the
        // origin.
        assert_eq!(volume.ijk_to_world[0], 0.5);
        assert_eq!(volume.ijk_to_world[5], 0.5);
        assert_eq!(volume.ijk_to_world[10], 2.0);
        assert_eq!(volume.ijk_to_world[3], 10.0);
        assert_eq!(volume.ijk_to_world[7], 20.0);
        assert_eq!(volume.ijk_to_world[11], 30.0);
    }

    /// LPS is what DICOM produces; reading it as RAS mirrors the patient, which
    /// looks plausible on a symmetric body and is very hard to notice.
    #[test]
    fn an_lps_volume_is_flipped_into_ras() {
        let file = nrrd(
            &[
                "type: uint8",
                "dimension: 3",
                "sizes: 2 2 2",
                "encoding: raw",
                "space: left-posterior-superior",
                "space directions: (1,0,0) (0,1,0) (0,0,1)",
                "space origin: (5,6,7)",
            ],
            &[0u8; 8],
        );
        let volume = parse_nrrd_inner(&file, &[]).unwrap();
        assert_eq!(volume.ijk_to_world[0], -1.0);
        assert_eq!(volume.ijk_to_world[5], -1.0);
        assert_eq!(volume.ijk_to_world[10], 1.0);
        assert_eq!(volume.ijk_to_world[3], -5.0);
        assert_eq!(volume.ijk_to_world[7], -6.0);
        assert_eq!(volume.ijk_to_world[11], 7.0);
    }

    #[test]
    fn big_endian_samples_are_swapped() {
        let file = nrrd(
            &[
                "type: uint16",
                "dimension: 3",
                "sizes: 2 1 1",
                "encoding: raw",
                "endian: big",
            ],
            &body_u16(&[258, 772], false),
        );
        let mut volume = parse_nrrd_inner(&file, &[]).unwrap();
        assert_eq!(volume.take_samples(), vec![258.0, 772.0]);
    }

    #[test]
    fn reads_a_gzip_payload() {
        use flate2::{write::GzEncoder, Compression};
        use std::io::Write;
        let raw = body_u16(&[9, 8, 7, 6], true);
        let mut encoder = GzEncoder::new(Vec::new(), Compression::default());
        encoder.write_all(&raw).unwrap();
        let compressed = encoder.finish().unwrap();

        let file = nrrd(
            &[
                "type: uint16",
                "dimension: 3",
                "sizes: 4 1 1",
                "encoding: gzip",
            ],
            &compressed,
        );
        let mut volume = parse_nrrd_inner(&file, &[]).unwrap();
        assert_eq!(volume.take_samples(), vec![9.0, 8.0, 7.0, 6.0]);
    }

    #[test]
    fn reads_an_ascii_payload() {
        let file = nrrd(
            &[
                "type: float",
                "dimension: 3",
                "sizes: 3 1 1",
                "encoding: ascii",
            ],
            b"1.5 -2.5 3.25\n",
        );
        let mut volume = parse_nrrd_inner(&file, &[]).unwrap();
        assert_eq!(volume.take_samples(), vec![1.5, -2.5, 3.25]);
    }

    /// A 4D volume is channel-first; only channel 0 is isosurfaced, so the
    /// interleaved samples have to be de-interleaved rather than truncated.
    #[test]
    fn takes_the_first_channel_of_a_4d_volume() {
        let file = nrrd(
            &[
                "type: uint8",
                "dimension: 4",
                "sizes: 3 2 1 1",
                "kinds: vector domain domain domain",
                "encoding: raw",
            ],
            &[10, 20, 30, 40, 50, 60],
        );
        let mut volume = parse_nrrd_inner(&file, &[]).unwrap();
        assert_eq!(volume.sizes, vec![2, 1, 1]);
        assert_eq!(volume.channels, 3);
        assert_eq!(volume.take_samples(), vec![10.0, 40.0]);
    }

    #[test]
    fn falls_back_to_spacings_then_unit_voxels() {
        let with_spacings = nrrd(
            &[
                "type: uint8",
                "dimension: 3",
                "sizes: 2 2 2",
                "encoding: raw",
                "spacings: 0.25 0.5 3",
            ],
            &[0u8; 8],
        );
        let volume = parse_nrrd_inner(&with_spacings, &[]).unwrap();
        assert_eq!(volume.ijk_to_world[0], 0.25);
        assert_eq!(volume.ijk_to_world[5], 0.5);
        assert_eq!(volume.ijk_to_world[10], 3.0);

        let bare = nrrd(
            &[
                "type: uint8",
                "dimension: 3",
                "sizes: 2 2 2",
                "encoding: raw",
            ],
            &[0u8; 8],
        );
        let volume = parse_nrrd_inner(&bare, &[]).unwrap();
        assert_eq!(volume.ijk_to_world[0], 1.0);
        assert_eq!(volume.ijk_to_world[5], 1.0);
        assert_eq!(volume.ijk_to_world[10], 1.0);
    }

    #[test]
    fn keeps_key_value_metadata() {
        let file = nrrd(
            &[
                "type: uint8",
                "dimension: 3",
                "sizes: 2 2 2",
                "encoding: raw",
                "units:=HU",
                "modality:=CT",
                "# a comment line",
            ],
            &[0u8; 8],
        );
        let volume = parse_nrrd_inner(&file, &[]).unwrap();
        assert!(volume.metadata_json().contains("\"units\":\"HU\""));
        assert!(volume.metadata_json().contains("\"modality\":\"CT\""));
    }

    #[test]
    fn rejects_truncated_and_unreadable_files() {
        let truncated = nrrd(
            &[
                "type: uint16",
                "dimension: 3",
                "sizes: 4 4 4",
                "encoding: raw",
            ],
            &[0u8; 8],
        );
        assert!(parse_nrrd_inner(&truncated, &[])
            .unwrap_err()
            .contains("truncated"));

        let unsupported = nrrd(
            &[
                "type: uint8",
                "dimension: 3",
                "sizes: 2 2 2",
                "encoding: bzip2",
            ],
            &[0u8; 8],
        );
        assert!(parse_nrrd_inner(&unsupported, &[])
            .unwrap_err()
            .contains("not supported"));

        assert!(parse_nrrd_inner(b"not a volume\n\n", &[]).is_err());
    }

    #[test]
    fn a_detached_data_file_is_supplied_separately() {
        let file = nrrd(
            &[
                "type: uint8",
                "dimension: 3",
                "sizes: 2 1 1",
                "encoding: raw",
                "data file: volume.raw",
            ],
            &[],
        );
        assert!(parse_nrrd_inner(&file, &[])
            .unwrap_err()
            .contains("detached data file"));
        let mut volume = parse_nrrd_inner(&file, &[42, 43]).unwrap();
        assert_eq!(volume.take_samples(), vec![42.0, 43.0]);
    }
}
