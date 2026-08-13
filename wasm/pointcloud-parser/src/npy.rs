//! NumPy `.npy` arrays and `.npz` archives.
//!
//! One reader for what were three TypeScript paths: the point-cloud parser, the
//! depth reader, and the NPZ handling threaded between them. They shared a
//! copy-pasted header parser and disagreed about the rest — most visibly, the
//! NPZ side could only read *stored* zip entries, so `numpy.savez_compressed`
//! output was silently skipped.
//!
//! Everything is decoded to `f32`, which is what both consumers want: a depth
//! image or an XYZ buffer. Which array to take out of an archive, and what a
//! given array *means*, stay on the TypeScript side — that is presentation
//! policy and it changes with every new dataset.

use std::io::{Cursor, Read};
use wasm_bindgen::prelude::*;

/// A NumPy element type, reduced to what is needed to read it.
#[derive(Clone, Copy, PartialEq, Debug)]
struct DType {
    kind: u8,
    size: usize,
    little_endian: bool,
}

impl DType {
    /// Parses a descr string like `<f4`, `>i8`, `|u1`.
    fn parse(descr: &str) -> Result<DType, String> {
        let bytes = descr.as_bytes();
        if bytes.len() < 2 {
            return Err(format!("unsupported dtype: {descr}"));
        }
        let (byte_order, rest) = match bytes[0] {
            b'<' | b'=' | b'|' => (true, &bytes[1..]),
            b'>' => (false, &bytes[1..]),
            _ => (cfg!(target_endian = "little"), bytes),
        };
        let kind = rest[0];
        let size: usize = std::str::from_utf8(&rest[1..])
            .ok()
            .and_then(|s| s.parse().ok())
            .ok_or_else(|| format!("unsupported dtype: {descr}"))?;
        let ok = match kind {
            b'f' => size == 4 || size == 8,
            b'i' | b'u' => size == 1 || size == 2 || size == 4 || size == 8,
            b'b' => size == 1,
            _ => false,
        };
        if !ok {
            return Err(format!(
                "unsupported dtype: {descr}. Supported: float32/64, int and uint 8/16/32/64, bool"
            ));
        }
        Ok(DType {
            kind,
            size,
            little_endian: byte_order,
        })
    }

    fn read(&self, data: &[u8], offset: usize) -> f32 {
        macro_rules! bytes {
            ($n:expr) => {{
                let mut b = [0u8; $n];
                b.copy_from_slice(&data[offset..offset + $n]);
                if !self.little_endian {
                    b.reverse();
                }
                b
            }};
        }
        match (self.kind, self.size) {
            (b'f', 4) => f32::from_le_bytes(bytes!(4)),
            (b'f', 8) => f64::from_le_bytes(bytes!(8)) as f32,
            (b'i', 1) => data[offset] as i8 as f32,
            (b'i', 2) => i16::from_le_bytes(bytes!(2)) as f32,
            (b'i', 4) => i32::from_le_bytes(bytes!(4)) as f32,
            (b'i', 8) => i64::from_le_bytes(bytes!(8)) as f32,
            (b'u', 1) | (b'b', 1) => data[offset] as f32,
            (b'u', 2) => u16::from_le_bytes(bytes!(2)) as f32,
            (b'u', 4) => u32::from_le_bytes(bytes!(4)) as f32,
            (b'u', 8) => u64::from_le_bytes(bytes!(8)) as f32,
            _ => 0.0,
        }
    }
}

struct NpyHeader {
    shape: Vec<usize>,
    descr: String,
    dtype: DType,
    fortran_order: bool,
    data_start: usize,
}

fn parse_header(data: &[u8]) -> Result<NpyHeader, String> {
    if data.len() < 10 || &data[..6] != b"\x93NUMPY" {
        return Err("not an NPY file: missing magic".into());
    }
    let major = data[6];
    // v1 has a u16 header length, v2 and v3 a u32; v3 differs only in that the
    // header is UTF-8 rather than latin-1, which changes nothing here.
    let (header_len, header_start) = match major {
        1 => (u16::from_le_bytes([data[8], data[9]]) as usize, 10),
        2 | 3 => (
            u32::from_le_bytes([data[8], data[9], data[10], data[11]]) as usize,
            12,
        ),
        other => return Err(format!("unsupported NPY version: {other}")),
    };
    let end = header_start + header_len;
    if end > data.len() {
        return Err("NPY header runs past the end of the file".into());
    }
    // The header dict is ASCII in every version, so a lossy read is exact here
    // and avoids failing on the padding bytes numpy aligns it with.
    let text = String::from_utf8_lossy(&data[header_start..end]).to_string();

    let descr = extract_quoted(&text, "'descr'")
        .or_else(|| extract_quoted(&text, "\"descr\""))
        .ok_or("could not read 'descr' from the NPY header")?;
    let fortran_order = text.contains("'fortran_order': True")
        || text.contains("\"fortran_order\": True")
        || text.contains("'fortran_order':True");
    let shape = extract_shape(&text).ok_or("could not read 'shape' from the NPY header")?;

    Ok(NpyHeader {
        dtype: DType::parse(&descr)?,
        descr,
        shape,
        fortran_order,
        data_start: end,
    })
}

/// The value of `key` in the header dict, when it is a quoted string.
fn extract_quoted(text: &str, key: &str) -> Option<String> {
    let after = &text[text.find(key)? + key.len()..];
    let rest = after.trim_start().strip_prefix(':')?.trim_start();
    let quote = rest.chars().next()?;
    if quote != '\'' && quote != '"' {
        return None;
    }
    let body = &rest[1..];
    Some(body[..body.find(quote)?].to_string())
}

/// `'shape': (480, 640)` → `[480, 640]`. A one-dimensional array is written
/// `(100,)` and a scalar `()`; the empty token each produces is skipped rather
/// than parsed, which is what the TypeScript readers tripped over.
fn extract_shape(text: &str) -> Option<Vec<usize>> {
    let after = &text[text.find("'shape'").or_else(|| text.find("\"shape\""))?..];
    let open = after.find('(')?;
    let close = after[open..].find(')')? + open;
    let mut shape = Vec::new();
    for token in after[open + 1..close].split(',') {
        let token = token.trim();
        if token.is_empty() {
            continue;
        }
        shape.push(token.parse().ok()?);
    }
    Some(shape)
}

#[cfg_attr(test, derive(Debug))]
struct NpyArray {
    shape: Vec<usize>,
    descr: String,
    values: Vec<f32>,
}

fn read_npy(data: &[u8]) -> Result<NpyArray, String> {
    let header = parse_header(data)?;
    let count: usize = header.shape.iter().product();
    if header.fortran_order && header.shape.len() > 1 {
        // Reading column-major data as row-major produces a transposed image
        // rather than an error, which is worse than refusing it.
        return Err("NPY arrays saved in Fortran order are not supported".into());
    }
    let needed = count * header.dtype.size;
    let available = data.len() - header.data_start;
    if available < needed {
        return Err(format!(
            "NPY data is short: expected {needed} bytes, found {available}"
        ));
    }

    let body = &data[header.data_start..];
    let mut values = vec![0f32; count];
    let dtype = header.dtype;
    // Native little-endian float32 is the common case and is a straight
    // reinterpretation; everything else goes through the per-element reader.
    if dtype.kind == b'f' && dtype.size == 4 && dtype.little_endian {
        for (i, value) in values.iter_mut().enumerate() {
            let o = i * 4;
            *value = f32::from_le_bytes([body[o], body[o + 1], body[o + 2], body[o + 3]]);
        }
    } else {
        for (i, value) in values.iter_mut().enumerate() {
            *value = dtype.read(body, i * dtype.size);
        }
    }

    Ok(NpyArray {
        shape: header.shape,
        descr: header.descr,
        values,
    })
}

fn is_npz(data: &[u8]) -> bool {
    data.len() >= 4 && data[..4] == [0x50, 0x4b, 0x03, 0x04]
}

/// Every `.npy` member of an archive, in the order the archive lists them.
fn npz_members(data: &[u8]) -> Result<Vec<(String, Vec<u8>)>, String> {
    let mut archive =
        zip::ZipArchive::new(Cursor::new(data)).map_err(|e| format!("not a readable NPZ: {e}"))?;
    let mut members = Vec::new();
    for i in 0..archive.len() {
        let mut entry = archive
            .by_index(i)
            .map_err(|e| format!("unreadable NPZ entry {i}: {e}"))?;
        let name = entry.name().to_string();
        if !name.to_ascii_lowercase().ends_with(".npy") {
            continue;
        }
        let mut bytes = Vec::with_capacity(entry.size() as usize);
        entry
            .read_to_end(&mut bytes)
            .map_err(|e| format!("could not decompress {name}: {e}"))?;
        // numpy names the member `<key>.npy`; the key is what callers ask for.
        members.push((name[..name.len() - 4].to_string(), bytes));
    }
    Ok(members)
}

/// One array, decoded to f32.
#[wasm_bindgen]
#[cfg_attr(test, derive(Debug))]
pub struct NpyArrayResult {
    name: String,
    shape: Vec<u32>,
    dtype: String,
    values: Vec<f32>,
}

#[wasm_bindgen]
impl NpyArrayResult {
    /// Empty for a plain `.npy`; the archive key for a member of an `.npz`.
    #[wasm_bindgen(getter)]
    pub fn name(&self) -> String {
        self.name.clone()
    }
    #[wasm_bindgen(getter)]
    pub fn shape(&self) -> Vec<u32> {
        self.shape.clone()
    }
    /// The NumPy descr string, e.g. `<f4`.
    #[wasm_bindgen(getter)]
    pub fn dtype(&self) -> String {
        self.dtype.clone()
    }
    pub fn take_values(&mut self) -> Vec<f32> {
        std::mem::take(&mut self.values)
    }
}

/// What a `.npy` or `.npz` holds, without decoding any of it: a JSON array of
/// `{name, shape, dtype}`. Callers use it to decide whether a file is a point
/// cloud or a depth image, and which member of an archive to ask for.
#[wasm_bindgen]
pub fn npy_inspect(data: &[u8]) -> Result<String, JsValue> {
    npy_inspect_inner(data).map_err(|e| JsValue::from_str(&e))
}

fn npy_inspect_inner(data: &[u8]) -> Result<String, String> {
    let entries: Vec<(String, Vec<usize>, String)> = if is_npz(data) {
        npz_members(data)?
            .into_iter()
            .filter_map(|(name, bytes)| {
                let header = parse_header(&bytes).ok()?;
                Some((name, header.shape, header.descr))
            })
            .collect()
    } else {
        let header = parse_header(data)?;
        vec![(String::new(), header.shape, header.descr)]
    };

    let json = entries
        .iter()
        .map(|(name, shape, dtype)| {
            format!(
                "{{\"name\":\"{}\",\"shape\":[{}],\"dtype\":\"{}\"}}",
                name.replace('\\', "\\\\").replace('"', "\\\""),
                shape
                    .iter()
                    .map(|d| d.to_string())
                    .collect::<Vec<_>>()
                    .join(","),
                dtype
            )
        })
        .collect::<Vec<_>>()
        .join(",");
    Ok(format!("[{json}]"))
}

/// Decode one array to f32. `name` selects an archive member; it is ignored for
/// a plain `.npy`, and an empty name takes the archive's first array.
#[wasm_bindgen]
pub fn npy_read(data: &[u8], name: &str) -> Result<NpyArrayResult, JsValue> {
    npy_read_inner(data, name).map_err(|e| JsValue::from_str(&e))
}

fn npy_read_inner(data: &[u8], name: &str) -> Result<NpyArrayResult, String> {
    let (key, array) = if is_npz(data) {
        let members = npz_members(data)?;
        if members.is_empty() {
            return Err("NPZ archive contains no .npy members".into());
        }
        let chosen = if name.is_empty() {
            &members[0]
        } else {
            members
                .iter()
                .find(|(member, _)| member == name)
                .ok_or_else(|| format!("NPZ archive has no array named \"{name}\""))?
        };
        (chosen.0.clone(), read_npy(&chosen.1)?)
    } else {
        (String::new(), read_npy(data)?)
    };

    Ok(NpyArrayResult {
        name: key,
        shape: array.shape.iter().map(|d| *d as u32).collect(),
        dtype: array.descr,
        values: array.values,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Builds an NPY the way numpy does, header padding included.
    fn npy(descr: &str, shape: &[usize], body: &[u8]) -> Vec<u8> {
        let shape_text = if shape.len() == 1 {
            format!("{},", shape[0])
        } else {
            shape
                .iter()
                .map(|d| d.to_string())
                .collect::<Vec<_>>()
                .join(", ")
        };
        let dict =
            format!("{{'descr': '{descr}', 'fortran_order': False, 'shape': ({shape_text}), }}");
        let mut header = dict.into_bytes();
        while (header.len() + 11) % 64 != 0 {
            header.push(b' ');
        }
        header.push(b'\n');
        let mut out = b"\x93NUMPY\x01\x00".to_vec();
        out.extend_from_slice(&(header.len() as u16).to_le_bytes());
        out.extend_from_slice(&header);
        out.extend_from_slice(body);
        out
    }

    fn f32_body(values: &[f32]) -> Vec<u8> {
        values.iter().flat_map(|v| v.to_le_bytes()).collect()
    }

    #[test]
    fn reads_a_float32_array() {
        let file = npy("<f4", &[2, 3], &f32_body(&[1.0, 2.0, 3.0, 4.0, 5.0, 6.0]));
        let array = read_npy(&file).unwrap();
        assert_eq!(array.shape, vec![2, 3]);
        assert_eq!(array.values, vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0]);
    }

    /// numpy writes a one-dimensional shape with a trailing comma, which the
    /// TypeScript readers parsed as an extra empty dimension and threw on.
    #[test]
    fn reads_a_one_dimensional_shape() {
        let file = npy("<f4", &[3], &f32_body(&[7.0, 8.0, 9.0]));
        let array = read_npy(&file).unwrap();
        assert_eq!(array.shape, vec![3]);
        assert_eq!(array.values, vec![7.0, 8.0, 9.0]);
    }

    #[test]
    fn converts_every_supported_dtype_to_f32() {
        let cases: Vec<(&str, Vec<u8>, Vec<f32>)> = vec![
            (
                "<f8",
                vec![0f64, 1.5, -2.5]
                    .iter()
                    .flat_map(|v| v.to_le_bytes())
                    .collect(),
                vec![0.0, 1.5, -2.5],
            ),
            (
                ">f4",
                vec![1.5f32, -2.5, 3.0]
                    .iter()
                    .flat_map(|v| v.to_be_bytes())
                    .collect(),
                vec![1.5, -2.5, 3.0],
            ),
            ("|u1", vec![0, 128, 255], vec![0.0, 128.0, 255.0]),
            (
                "<i2",
                vec![0i16, -300, 1000]
                    .iter()
                    .flat_map(|v| v.to_le_bytes())
                    .collect(),
                vec![0.0, -300.0, 1000.0],
            ),
            (
                "<u4",
                vec![0u32, 70000, 1]
                    .iter()
                    .flat_map(|v| v.to_le_bytes())
                    .collect(),
                vec![0.0, 70000.0, 1.0],
            ),
            (
                "<i8",
                vec![0i64, -5, 9]
                    .iter()
                    .flat_map(|v| v.to_le_bytes())
                    .collect(),
                vec![0.0, -5.0, 9.0],
            ),
            ("|b1", vec![0, 1, 1], vec![0.0, 1.0, 1.0]),
        ];
        for (descr, body, expected) in cases {
            let array = read_npy(&npy(descr, &[3], &body)).unwrap();
            assert_eq!(array.values, expected, "dtype {descr}");
        }
    }

    /// Column-major data read as row-major is a transposed image, not an error,
    /// so it has to be refused explicitly.
    #[test]
    fn refuses_fortran_ordered_arrays() {
        let dict = "{'descr': '<f4', 'fortran_order': True, 'shape': (2, 2), }";
        let mut header = dict.as_bytes().to_vec();
        header.push(b'\n');
        let mut file = b"\x93NUMPY\x01\x00".to_vec();
        file.extend_from_slice(&(header.len() as u16).to_le_bytes());
        file.extend_from_slice(&header);
        file.extend_from_slice(&f32_body(&[1.0, 2.0, 3.0, 4.0]));
        assert!(read_npy(&file).unwrap_err().contains("Fortran"));
    }

    #[test]
    fn rejects_a_truncated_body() {
        let file = npy("<f4", &[4], &f32_body(&[1.0, 2.0]));
        assert!(read_npy(&file).unwrap_err().contains("short"));
    }

    fn npz(entries: &[(&str, Vec<u8>)], compress: bool) -> Vec<u8> {
        let mut buffer = Vec::new();
        {
            let mut writer = zip::ZipWriter::new(Cursor::new(&mut buffer));
            let options: zip::write::FileOptions<'_, ()> = zip::write::FileOptions::default()
                .compression_method(if compress {
                    zip::CompressionMethod::Deflated
                } else {
                    zip::CompressionMethod::Stored
                });
            for (name, body) in entries {
                use std::io::Write;
                writer.start_file(*name, options).unwrap();
                writer.write_all(body).unwrap();
            }
            writer.finish().unwrap();
        }
        buffer
    }

    /// `numpy.savez_compressed` deflates its members. The TypeScript reader
    /// skipped anything that was not stored, so those archives came out empty.
    #[test]
    fn reads_stored_and_deflated_npz_members() {
        for compress in [false, true] {
            let archive = npz(
                &[
                    (
                        "depth.npy",
                        npy("<f4", &[2, 2], &f32_body(&[1.0, 2.0, 3.0, 4.0])),
                    ),
                    ("mask.npy", npy("|u1", &[2, 2], &[0, 1, 1, 0])),
                    ("notes.txt", b"ignored".to_vec()),
                ],
                compress,
            );

            let listing = npy_inspect_inner(&archive).unwrap();
            assert!(listing.contains("\"name\":\"depth\""), "{listing}");
            assert!(listing.contains("\"name\":\"mask\""), "{listing}");
            assert!(!listing.contains("notes"), "{listing}");

            let depth = npy_read_inner(&archive, "depth").unwrap();
            assert_eq!(depth.values, vec![1.0, 2.0, 3.0, 4.0]);
            assert_eq!(depth.shape, vec![2, 2]);
            let mask = npy_read_inner(&archive, "mask").unwrap();
            assert_eq!(mask.values, vec![0.0, 1.0, 1.0, 0.0]);
        }
    }

    #[test]
    fn an_empty_name_takes_the_first_array_and_a_wrong_one_is_an_error() {
        let archive = npz(
            &[("first.npy", npy("<f4", &[1], &f32_body(&[42.0])))],
            false,
        );
        assert_eq!(npy_read_inner(&archive, "").unwrap().name, "first");
        assert!(npy_read_inner(&archive, "missing")
            .unwrap_err()
            .contains("missing"));
    }

    #[test]
    fn inspecting_a_plain_npy_reports_one_unnamed_array() {
        let file = npy("<f4", &[4, 3], &f32_body(&[0.0; 12]));
        let listing = npy_inspect_inner(&file).unwrap();
        assert_eq!(
            listing,
            "[{\"name\":\"\",\"shape\":[4,3],\"dtype\":\"<f4\"}]"
        );
    }
}
