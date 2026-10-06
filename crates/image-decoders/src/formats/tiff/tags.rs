use crate::cfa_safe_bytes;
use crate::formats::metadata::{json_escape, push_generic_attr_row};
use std::io::Cursor;
use tiff::decoder::Decoder;

/// Render any TIFF tag value as a human-readable string, regardless of its
/// underlying type. Falls back to `Debug` for the rarer/deprecated variants
/// (e.g. `RationalBig`) so this stays correct as the `tiff` crate's
/// `#[non_exhaustive]` `Value` enum grows.
fn value_to_display_string(value: &tiff::decoder::ifd::Value) -> String {
    use tiff::decoder::ifd::Value;
    match value {
        Value::Byte(v) => v.to_string(),
        Value::Short(v) => v.to_string(),
        Value::SignedByte(v) => v.to_string(),
        Value::SignedShort(v) => v.to_string(),
        Value::Signed(v) => v.to_string(),
        Value::SignedBig(v) => v.to_string(),
        Value::Unsigned(v) => v.to_string(),
        Value::UnsignedBig(v) => v.to_string(),
        Value::Float(v) => v.to_string(),
        Value::Double(v) => v.to_string(),
        Value::Rational(n, d) if *d != 0 => format!("{}/{} ({:.6})", n, d, *n as f64 / *d as f64),
        Value::Rational(n, d) => format!("{}/{}", n, d),
        Value::SRational(n, d) if *d != 0 => format!("{}/{} ({:.6})", n, d, *n as f64 / *d as f64),
        Value::SRational(n, d) => format!("{}/{}", n, d),
        Value::Ascii(s) => s.trim_end_matches('\0').to_string(),
        Value::Ifd(v) => format!("IFD@{}", v),
        Value::IfdBig(v) => format!("IFD@{}", v),
        Value::List(items) => items
            .iter()
            .map(value_to_display_string)
            .collect::<Vec<_>>()
            .join(", "),
        other => format!("{:?}", other),
    }
}

/// Recursively serialize every tag in `entries` (and, for `ExifDirectory` /
/// `GpsDirectory` pointer tags, the sub-IFD they point to) into `out` as JSON
/// object fragments. This walks the raw tag map generically, so it surfaces
/// every tag present in the file rather than a curated subset.
fn append_ifd_tags(
    decoder: &mut Decoder<Cursor<&[u8]>>,
    entries: Vec<(tiff::tags::Tag, tiff::decoder::ifd::Value)>,
    group: &str,
    out: &mut Vec<String>,
) {
    use tiff::tags::Tag;

    for (tag, value) in entries {
        if matches!(tag, Tag::ExifDirectory | Tag::GpsDirectory) {
            if let Ok(ptr) = value.clone().into_ifd_pointer() {
                if let Ok(subdir) = decoder.read_directory(ptr) {
                    let sub_entries: Vec<_> = decoder
                        .read_directory_tags(&subdir)
                        .tag_iter()
                        .filter_map(|r| r.ok())
                        .collect();
                    let sub_group = if matches!(tag, Tag::ExifDirectory) {
                        "Exif"
                    } else {
                        "GPS"
                    };
                    append_ifd_tags(decoder, sub_entries, sub_group, out);
                    continue;
                }
            }
        }

        out.push(format!(
            "{{\"tag\":{},\"name\":\"{}\",\"group\":\"{}\",\"value\":\"{}\"}}",
            tag.to_u16(),
            json_escape(&format!("{:?}", tag)),
            json_escape(group),
            json_escape(&value_to_display_string(&value))
        ));
    }
}

/// Dump every tag in the file's main IFD (plus any Exif/GPS sub-IFD) as a JSON
/// array. Independent of whichever specialized pixel-decode path is used, so
/// it's recomputed cheaply (a handful of IFD entries, not the pixel data)
/// wherever a `TiffResult` is built.
pub(crate) fn extract_all_tags_json(data: &[u8]) -> String {
    extract_page_tags_json(data, 0)
}

pub(crate) fn extract_ome_xml(data: &[u8]) -> String {
    let data = cfa_safe_bytes(data);
    let mut decoder = match Decoder::new(Cursor::new(data.as_ref())) {
        Ok(d) => d,
        Err(_) => return String::new(),
    };
    let description = decoder
        .get_tag_ascii_string(tiff::tags::Tag::ImageDescription)
        .unwrap_or_default();
    let trimmed = description.trim_start_matches('\u{feff}').trim_start();
    // The recommended OME-TIFF header includes a warning XML comment before
    // the OME root, so detection must not require OME to be the first token.
    if trimmed.contains("<OME") || trimmed.contains(":OME") {
        description
    } else {
        String::new()
    }
}

pub(crate) fn extract_page_tags_json(data: &[u8], page_index: u32) -> String {
    // Without this the Metadata panel comes back empty for every CFA file.
    let data = cfa_safe_bytes(data);
    let mut decoder = match Decoder::new(Cursor::new(data.as_ref())) {
        Ok(d) => d,
        Err(_) => return "[]".to_string(),
    };
    for _ in 0..page_index {
        if decoder.next_image().is_err() {
            return "[]".to_string();
        }
    }
    let main_entries: Vec<_> = decoder
        .image_ifd()
        .tag_iter()
        .filter_map(|r| r.ok())
        .collect();
    let mut out = Vec::new();
    append_ifd_tags(&mut decoder, main_entries, "TIFF", &mut out);
    // GeoTIFF's key directory is a flat integer array pointing into two other
    // tags; shown raw it is unreadable, which is what a plain tag dump gives.
    // Unpacked here so the panel can show "EPSG:32631 (WGS 84 / UTM zone 31N)"
    // where the raw dump showed "1, 1, 1, 8, 1024, 0, 1, 1, ...".
    if let Some(geo) = read_geo_reference(&mut decoder) {
        for key in &geo.keys {
            out.push(format!(
                "{{\"tag\":null,\"name\":\"{}\",\"group\":\"GeoKeys\",\"value\":\"{}\"}}",
                json_escape(&key.name),
                json_escape(&key.value)
            ));
        }
    }
    format!("[{}]", out.join(","))
}

/// Read the six GeoTIFF tags off `decoder` and unpack them.
///
/// Every one is optional and a missing one is ordinary rather than an error —
/// a non-geo TIFF has none of them, and a geo one may carry the key directory
/// with no georeferencing (a CRS but no placement) or the reverse.
pub(crate) fn read_geo_reference(
    decoder: &mut Decoder<Cursor<&[u8]>>,
) -> Option<super::geokeys::GeoReference> {
    use tiff::tags::Tag;
    let directory = decoder.get_tag_u16_vec(Tag::Unknown(34735)).ok()?;
    let doubles = decoder
        .get_tag_f64_vec(Tag::Unknown(34736))
        .unwrap_or_default();
    let ascii = decoder
        .get_tag_ascii_string(Tag::Unknown(34737))
        .unwrap_or_default();
    let pixel_scale = decoder
        .get_tag_f64_vec(Tag::Unknown(33550))
        .unwrap_or_default();
    let tiepoint = decoder
        .get_tag_f64_vec(Tag::Unknown(33922))
        .unwrap_or_default();
    let transformation = decoder
        .get_tag_f64_vec(Tag::Unknown(34264))
        .unwrap_or_default();
    super::geokeys::parse_geo_reference(
        &directory,
        &doubles,
        &ascii,
        &pixel_scale,
        &tiepoint,
        &transformation,
    )
}

/// The georeferencing as JSON for the webview's coordinate readout, or an
/// empty string when the file carries none.
pub(crate) fn extract_geo_json(data: &[u8], page_index: u32) -> String {
    let data = cfa_safe_bytes(data);
    let mut decoder = match Decoder::new(Cursor::new(data.as_ref())) {
        Ok(d) => d,
        Err(_) => return String::new(),
    };
    for _ in 0..page_index {
        if decoder.next_image().is_err() {
            return String::new();
        }
    }
    match read_geo_reference(&mut decoder) {
        Some(geo) => geo.to_json(),
        None => String::new(),
    }
}

/// TIFF/Exif field type sizes in bytes, per the TIFF6/Exif spec (type IDs 1-12).
fn ifd_type_size(type_id: u16) -> usize {
    match type_id {
        1 | 2 | 6 | 7 => 1, // BYTE, ASCII, SBYTE, UNDEFINED
        3 | 8 => 2,         // SHORT, SSHORT
        4 | 9 | 11 => 4,    // LONG, SLONG, FLOAT
        5 | 10 | 12 => 8,   // RATIONAL, SRATIONAL, DOUBLE
        _ => 0,
    }
}

/// Render one IFD entry's value bytes as a human-readable string, generically
/// across all twelve standard TIFF/Exif field types. Caps very long arrays at
/// 16 shown elements, mirroring `value_to_display_string`'s `List` handling.
fn format_bare_ifd_value(
    data: &[u8],
    type_id: u16,
    count: u32,
    inline_bytes: &[u8],
    big_endian: bool,
) -> String {
    let elem_size = ifd_type_size(type_id);
    if elem_size == 0 {
        return format!("<unsupported field type {}>", type_id);
    }
    let total_size = elem_size.saturating_mul(count as usize);
    let bytes: &[u8] = if total_size <= 4 {
        &inline_bytes[..total_size.min(inline_bytes.len())]
    } else {
        let offset = if big_endian {
            u32::from_be_bytes([
                inline_bytes[0],
                inline_bytes[1],
                inline_bytes[2],
                inline_bytes[3],
            ])
        } else {
            u32::from_le_bytes([
                inline_bytes[0],
                inline_bytes[1],
                inline_bytes[2],
                inline_bytes[3],
            ])
        } as usize;
        match data.get(offset..offset.saturating_add(total_size)) {
            Some(b) => b,
            None => return "<value out of range>".to_string(),
        }
    };

    let u16_at = |i: usize| -> u16 {
        let b = &bytes[i * 2..i * 2 + 2];
        if big_endian {
            u16::from_be_bytes([b[0], b[1]])
        } else {
            u16::from_le_bytes([b[0], b[1]])
        }
    };
    let i16_at = |i: usize| -> i16 {
        let b = &bytes[i * 2..i * 2 + 2];
        if big_endian {
            i16::from_be_bytes([b[0], b[1]])
        } else {
            i16::from_le_bytes([b[0], b[1]])
        }
    };
    let u32_at = |i: usize| -> u32 {
        let b = &bytes[i * 4..i * 4 + 4];
        if big_endian {
            u32::from_be_bytes([b[0], b[1], b[2], b[3]])
        } else {
            u32::from_le_bytes([b[0], b[1], b[2], b[3]])
        }
    };
    let i32_at = |i: usize| -> i32 {
        let b = &bytes[i * 4..i * 4 + 4];
        if big_endian {
            i32::from_be_bytes([b[0], b[1], b[2], b[3]])
        } else {
            i32::from_le_bytes([b[0], b[1], b[2], b[3]])
        }
    };
    let f32_at = |i: usize| -> f32 {
        let b = &bytes[i * 4..i * 4 + 4];
        if big_endian {
            f32::from_be_bytes([b[0], b[1], b[2], b[3]])
        } else {
            f32::from_le_bytes([b[0], b[1], b[2], b[3]])
        }
    };
    let f64_at = |i: usize| -> f64 {
        let b = &bytes[i * 8..i * 8 + 8];
        let a = [b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]];
        if big_endian {
            f64::from_be_bytes(a)
        } else {
            f64::from_le_bytes(a)
        }
    };

    let join_all = |n: usize, render: &dyn Fn(usize) -> String| -> String {
        (0..n).map(render).collect::<Vec<_>>().join(", ")
    };

    let n = count as usize;
    match type_id {
        2 => {
            // ASCII: NUL-terminated string
            let end = bytes.iter().position(|&b| b == 0).unwrap_or(bytes.len());
            String::from_utf8_lossy(&bytes[..end]).to_string()
        }
        1 | 7 => join_all(bytes.len(), &|i| bytes[i].to_string()), // BYTE, UNDEFINED
        6 => join_all(bytes.len(), &|i| (bytes[i] as i8).to_string()), // SBYTE
        3 => join_all(n, &|i| u16_at(i).to_string()),
        8 => join_all(n, &|i| i16_at(i).to_string()),
        4 => join_all(n, &|i| u32_at(i).to_string()),
        9 => join_all(n, &|i| i32_at(i).to_string()),
        11 => join_all(n, &|i| f32_at(i).to_string()),
        12 => join_all(n, &|i| f64_at(i).to_string()),
        5 => join_all(n, &|i| {
            // RATIONAL: pairs of u32
            let (num, den) = (u32_at(i * 2), u32_at(i * 2 + 1));
            if den != 0 {
                format!("{}/{} ({:.6})", num, den, num as f64 / den as f64)
            } else {
                format!("{}/{}", num, den)
            }
        }),
        10 => join_all(n, &|i| {
            // SRATIONAL: pairs of i32
            let (num, den) = (i32_at(i * 2), i32_at(i * 2 + 1));
            if den != 0 {
                format!("{}/{} ({:.6})", num, den, num as f64 / den as f64)
            } else {
                format!("{}/{}", num, den)
            }
        }),
        _ => "<unsupported field type>".to_string(),
    }
}

/// Recursively walk a raw IFD's entries (byte-level, no `tiff` crate
/// `Decoder`) starting at `ifd_offset`, pushing each as a JSON tag row and
/// following the Exif (0x8769) / GPS (0x8825) sub-IFD pointer tags.
fn walk_bare_ifd(
    data: &[u8],
    ifd_offset: usize,
    big_endian: bool,
    group: &str,
    out: &mut Vec<String>,
    depth: u32,
) {
    if depth > 4 {
        return;
    } // guard against absurd/cyclic offsets in malformed input
    let read_u16 = |offset: usize| -> Option<u16> {
        let b = data.get(offset..offset + 2)?;
        Some(if big_endian {
            u16::from_be_bytes([b[0], b[1]])
        } else {
            u16::from_le_bytes([b[0], b[1]])
        })
    };
    let read_u32 = |offset: usize| -> Option<u32> {
        let b = data.get(offset..offset + 4)?;
        Some(if big_endian {
            u32::from_be_bytes([b[0], b[1], b[2], b[3]])
        } else {
            u32::from_le_bytes([b[0], b[1], b[2], b[3]])
        })
    };

    let entry_count = match read_u16(ifd_offset) {
        Some(c) => c as usize,
        None => return,
    };
    for i in 0..entry_count {
        let entry_offset = ifd_offset + 2 + i * 12;
        let (Some(tag_id), Some(type_id), Some(count)) = (
            read_u16(entry_offset),
            read_u16(entry_offset + 2),
            read_u32(entry_offset + 4),
        ) else {
            continue;
        };
        let value_bytes = match data.get(entry_offset + 8..entry_offset + 12) {
            Some(b) => b,
            None => continue,
        };

        // Exif (0x8769) / GPS (0x8825) sub-IFD pointer tags: a single LONG offset.
        if (tag_id == 0x8769 || tag_id == 0x8825) && type_id == 4 && count == 1 {
            if let Some(sub_offset) = read_u32(entry_offset + 8) {
                let sub_group = if tag_id == 0x8769 { "Exif" } else { "GPS" };
                walk_bare_ifd(
                    data,
                    sub_offset as usize,
                    big_endian,
                    sub_group,
                    out,
                    depth + 1,
                );
                continue;
            }
        }

        let tag_name = format!("{:?}", tiff::tags::Tag::from_u16_exhaustive(tag_id));
        let value_str = format_bare_ifd_value(data, type_id, count, value_bytes, big_endian);
        push_generic_attr_row(out, group, &tag_name, value_str);
    }
}

/// Entry point for `extract_exif_tags`: parse a bare Exif-structured blob
/// (JPEG APP1 payload sans "Exif\0\0", or a PNG eXIf chunk) into JSON tags.
pub(crate) fn extract_bare_ifd_tags_json(data: &[u8]) -> String {
    if data.len() < 8 {
        return "[]".to_string();
    }
    let big_endian = match &data[0..2] {
        b"II" => false,
        b"MM" => true,
        _ => return "[]".to_string(),
    };
    let read_u16 = |offset: usize| -> u16 {
        let b = &data[offset..offset + 2];
        if big_endian {
            u16::from_be_bytes([b[0], b[1]])
        } else {
            u16::from_le_bytes([b[0], b[1]])
        }
    };
    let read_u32 = |offset: usize| -> u32 {
        let b = &data[offset..offset + 4];
        if big_endian {
            u32::from_be_bytes([b[0], b[1], b[2], b[3]])
        } else {
            u32::from_le_bytes([b[0], b[1], b[2], b[3]])
        }
    };
    if read_u16(2) != 42 {
        return "[]".to_string();
    }
    let ifd0_offset = read_u32(4) as usize;

    let mut out = Vec::new();
    walk_bare_ifd(data, ifd0_offset, big_endian, "Exif", &mut out, 0);
    format!("[{}]", out.join(","))
}
