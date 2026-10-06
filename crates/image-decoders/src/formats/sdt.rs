//! Becker & Hickl SDT fluorescence-lifetime / TCSPC histogram files.
//!
//! An SDT image is not one conventional raster: every spatial pixel owns a
//! histogram over photon-arrival bins. The decoder exposes three useful views
//! through selectors: integrated intensity, mean arrival time, and one raw
//! time bin. Multiple data blocks are selectable as `B`.

use super::json_value::{to_json_string, JsonValue};
use super::scientific_common::ScientificParsed;
use crate::DecodeError;
use std::io::Read;

#[derive(Clone, Copy)]
struct Block {
    data_offset: usize,
    next_offset: usize,
    block_type: u16,
    measure_index: usize,
    byte_length: usize,
}

fn slice<'a>(
    data: &'a [u8],
    offset: usize,
    length: usize,
    what: &str,
) -> Result<&'a [u8], DecodeError> {
    let end = offset
        .checked_add(length)
        .ok_or_else(|| DecodeError::new(format!("SDT: {} range overflow", what)))?;
    data.get(offset..end)
        .ok_or_else(|| DecodeError::new(format!("SDT: {} is truncated", what)))
}

fn u16_at(data: &[u8], offset: usize, what: &str) -> Result<u16, DecodeError> {
    let b = slice(data, offset, 2, what)?;
    Ok(u16::from_le_bytes([b[0], b[1]]))
}

fn i16_at(data: &[u8], offset: usize, what: &str) -> Result<i16, DecodeError> {
    Ok(u16_at(data, offset, what)? as i16)
}

fn u32_at(data: &[u8], offset: usize, what: &str) -> Result<u32, DecodeError> {
    let b = slice(data, offset, 4, what)?;
    Ok(u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
}

fn i32_at(data: &[u8], offset: usize, what: &str) -> Result<i32, DecodeError> {
    Ok(u32_at(data, offset, what)? as i32)
}

fn f32_at(data: &[u8], offset: usize, what: &str) -> Result<f32, DecodeError> {
    Ok(f32::from_bits(u32_at(data, offset, what)?))
}

fn option_index(options: &str, name: &str, size: usize) -> usize {
    let value = super::json_value::parse(options)
        .ok()
        .and_then(|root| {
            root.get("indices")
                .and_then(JsonValue::as_obj)
                .map(|v| v.to_vec())
        })
        .and_then(|indices| {
            indices
                .into_iter()
                .find(|(key, _)| key == name)
                .and_then(|(_, value)| value.as_num())
        })
        .unwrap_or(0.0);
    if !value.is_finite() || size == 0 {
        0
    } else {
        ((value + 0.5).floor().max(0.0) as usize).min(size - 1)
    }
}

fn zip_entry(payload: &[u8], expected: usize) -> Result<Vec<u8>, DecodeError> {
    if payload.get(0..4) != Some(&[0x50, 0x4b, 0x03, 0x04]) {
        return Err(DecodeError::new(
            "SDT: ZIP-compressed block has no local header",
        ));
    }
    let flags = u16_at(payload, 6, "ZIP flags")?;
    let method = u16_at(payload, 8, "ZIP method")?;
    let compressed = u32_at(payload, 18, "ZIP compressed size")? as usize;
    let name_len = u16_at(payload, 26, "ZIP name length")? as usize;
    let extra_len = u16_at(payload, 28, "ZIP extra length")? as usize;
    if flags & 0x08 != 0 {
        return Err(DecodeError::new(
            "SDT: ZIP data-descriptor blocks are not supported",
        ));
    }
    let start = 30usize
        .checked_add(name_len)
        .and_then(|value| value.checked_add(extra_len))
        .ok_or_else(|| DecodeError::new("SDT: ZIP header overflow"))?;
    let encoded = slice(payload, start, compressed, "ZIP data")?;
    let mut out = Vec::with_capacity(expected);
    match method {
        0 => out.extend_from_slice(encoded),
        8 => {
            flate2::read::DeflateDecoder::new(encoded)
                .read_to_end(&mut out)
                .map_err(|error| DecodeError::new(format!("SDT: ZIP decode failed: {}", error)))?;
        }
        _ => {
            return Err(DecodeError::new(format!(
                "SDT: ZIP method {} is not supported",
                method
            )))
        }
    };
    if out.len() != expected {
        return Err(DecodeError::new(format!(
            "SDT: compressed block produced {} bytes, expected {}",
            out.len(),
            expected
        )));
    }
    Ok(out)
}

fn content_name(block_type: u16) -> &'static str {
    match block_type & 0x00f0 {
        0x00 => "Decay",
        0x10 => "Page",
        0x20 => "FCS",
        0x50 => "MCS",
        0x60 => "Image",
        0x80 => "Image MCS",
        0xa0 => "Image intensity",
        0xc0 => "Image lifetime",
        _ => "Data",
    }
}

pub(crate) fn decode_sdt_impl(
    data: &[u8],
    options_json: &str,
) -> Result<ScientificParsed, DecodeError> {
    if data.len() < 42 {
        return Err(DecodeError::new("SDT: file is shorter than its header"));
    }
    let revision = u16_at(data, 0, "revision")?;
    let header_valid = u16_at(data, 32, "header marker")?;
    let checksum = u16_at(data, 40, "checksum")?;
    if header_valid != 0x5555 && !matches!(checksum, 0x55aa | 0xaa55) {
        return Err(DecodeError::new("Not an SDT file (invalid header markers)"));
    }
    let measure_offset = i32_at(data, 24, "measurement offset")?;
    let measure_count = i16_at(data, 28, "measurement count")?;
    let measure_length = i16_at(data, 30, "measurement length")?;
    let mut block_count = u16_at(data, 18, "block count")? as usize;
    if block_count == 0x7fff {
        block_count = u32_at(data, 36, "extended block count")? as usize;
    }
    if measure_offset < 0 || measure_count <= 0 || measure_length <= 0 || block_count == 0 {
        return Err(DecodeError::new(
            "SDT: file has no image measurement blocks",
        ));
    }
    if block_count > 0x10000 {
        return Err(DecodeError::new("SDT: unreasonable data block count"));
    }

    let first_block_offset = i32_at(data, 14, "first block offset")?;
    if first_block_offset < 0 {
        return Err(DecodeError::new("SDT: negative data block offset"));
    }
    let mut offset = first_block_offset as usize;
    let modern = revision & 0x0f >= 15;
    let mut blocks = Vec::with_capacity(block_count);
    for _ in 0..block_count {
        let header = slice(data, offset, 22, "data block header")?;
        let (data_low, next_low, block_type, measure_index, byte_length, data_high, next_high) =
            if modern {
                (
                    u32::from_le_bytes([header[2], header[3], header[4], header[5]]),
                    u32::from_le_bytes([header[6], header[7], header[8], header[9]]),
                    u16::from_le_bytes([header[10], header[11]]),
                    i16::from_le_bytes([header[12], header[13]]),
                    u32::from_le_bytes([header[18], header[19], header[20], header[21]]),
                    header[0],
                    header[1],
                )
            } else {
                (
                    u32::from_le_bytes([header[2], header[3], header[4], header[5]]),
                    u32::from_le_bytes([header[6], header[7], header[8], header[9]]),
                    u16::from_le_bytes([header[10], header[11]]),
                    i16::from_le_bytes([header[12], header[13]]),
                    u32::from_le_bytes([header[18], header[19], header[20], header[21]]),
                    0,
                    0,
                )
            };
        if measure_index < 0 || measure_index as usize >= measure_count as usize {
            return Err(DecodeError::new(
                "SDT: data block references an invalid measurement",
            ));
        }
        let data_offset = (data_low as u64) | ((data_high as u64) << 32);
        let next_offset = (next_low as u64) | ((next_high as u64) << 32);
        let next_offset = usize::try_from(next_offset)
            .map_err(|_| DecodeError::new("SDT: next offset does not fit this target"))?;
        blocks.push(Block {
            data_offset: usize::try_from(data_offset)
                .map_err(|_| DecodeError::new("SDT: data offset does not fit this target"))?,
            next_offset,
            block_type,
            measure_index: measure_index as usize,
            byte_length: byte_length as usize,
        });
        offset = next_offset;
    }

    let block_index = option_index(options_json, "B", blocks.len());
    let block = blocks[block_index];
    let measure_delta = block
        .measure_index
        .checked_mul(measure_length as usize)
        .ok_or_else(|| DecodeError::new("SDT: measurement offset overflow"))?;
    let measure_at = (measure_offset as usize)
        .checked_add(measure_delta)
        .ok_or_else(|| DecodeError::new("SDT: measurement offset overflow"))?;
    let measure = slice(
        data,
        measure_at,
        measure_length as usize,
        "measurement description",
    )?;
    if measure.len() < 185 {
        return Err(DecodeError::new(
            "SDT: measurement description is too short",
        ));
    }
    let mut bins = i16_at(measure, 82, "ADC resolution")? as i32;
    if bins == 0 {
        bins = 65536;
    }
    if bins <= 0 {
        return Err(DecodeError::new("SDT: invalid histogram bin count"));
    }
    let bins = bins as usize;
    let scan_x = i32_at(measure, 173, "scan width")?.max(0) as usize;
    let scan_y = i32_at(measure, 177, "scan height")?.max(0) as usize;
    let image_x = if measure.len() >= 317 {
        i32_at(measure, 309, "image width")?.max(0) as usize
    } else {
        0
    };
    let image_y = if measure.len() >= 317 {
        i32_at(measure, 313, "image height")?.max(0) as usize
    } else {
        0
    };
    let (width, height) = if scan_x > 0 && scan_y > 0 {
        (scan_x, scan_y)
    } else if image_x > 0 && image_y > 0 {
        (image_x, image_y)
    } else {
        return Err(DecodeError::new("SDT: measurement has no image dimensions"));
    };

    let item_size = match block.block_type & 0x0f00 {
        0x000 => 2usize,
        0x100 => 4usize,
        0x200 => 8usize,
        other => {
            return Err(DecodeError::new(format!(
                "SDT: sample type 0x{:03x} is not supported",
                other
            )))
        }
    };
    if block.byte_length % item_size != 0 {
        return Err(DecodeError::new(
            "SDT: data byte length is not aligned to its sample type",
        ));
    }
    let sample_count = block
        .byte_length
        .checked_div(item_size)
        .ok_or_else(|| DecodeError::new("SDT: invalid sample width"))?;
    if sample_count % bins != 0 {
        return Err(DecodeError::new(
            "SDT: data length is not a whole number of histograms",
        ));
    }
    let curve_count = sample_count / bins;
    let image_curves = width
        .checked_mul(height)
        .ok_or_else(|| DecodeError::new("SDT: image dimensions overflow"))?;
    let padded_width_candidate = width
        .checked_next_power_of_two()
        .ok_or_else(|| DecodeError::new("SDT: padded width overflows"))?;
    let padded_height = height
        .checked_next_power_of_two()
        .ok_or_else(|| DecodeError::new("SDT: padded height overflows"))?;
    let fully_padded_curves = padded_width_candidate.checked_mul(padded_height);
    let width_padded_curves = padded_width_candidate.checked_mul(height);
    let height_padded_curves = width.checked_mul(padded_height);
    let padded_width = if curve_count == image_curves {
        width
    } else if Some(curve_count) == fully_padded_curves || Some(curve_count) == width_padded_curves {
        padded_width_candidate
    } else if Some(curve_count) == height_padded_curves {
        width
    } else {
        return Err(DecodeError::new(format!(
            "SDT: {} histograms do not match image dimensions {}x{}",
            curve_count, width, height
        )));
    };

    let payload_end = if block.block_type & 0x5000 != 0 {
        block.next_offset
    } else {
        block
            .data_offset
            .checked_add(block.byte_length)
            .ok_or_else(|| DecodeError::new("SDT: data range overflow"))?
    };
    let payload = data
        .get(block.data_offset..payload_end)
        .ok_or_else(|| DecodeError::new("SDT: data block is truncated"))?;
    let owned;
    let raw = if block.block_type & 0x4000 != 0 {
        return Err(DecodeError::new(
            "SDT: LZ4-frame-compressed data blocks are not yet supported",
        ));
    } else if block.block_type & 0x1000 != 0 {
        owned = zip_entry(payload, block.byte_length)?;
        owned.as_slice()
    } else {
        payload
    };

    let mode = option_index(options_json, "Mode", 3);
    let time_bin = option_index(options_json, "T", bins);
    let tac_range = f32_at(measure, 64, "TAC range")? as f64;
    let tac_gain = i16_at(measure, 68, "TAC gain")?.max(1) as f64;
    let bin_width_ns = tac_range / (tac_gain * bins as f64) * 1.0e9;
    let mut out = Vec::new();
    out.try_reserve_exact(image_curves)
        .map_err(|_| DecodeError::new("SDT: image is too large to allocate"))?;
    for y in 0..height {
        for x in 0..width {
            let curve = (y * padded_width + x) * bins;
            let read_value = |bin: usize| -> f64 {
                let at = (curve + bin) * item_size;
                match item_size {
                    2 => u16::from_le_bytes([raw[at], raw[at + 1]]) as f64,
                    4 => {
                        u32::from_le_bytes([raw[at], raw[at + 1], raw[at + 2], raw[at + 3]]) as f64
                    }
                    _ => f64::from_le_bytes([
                        raw[at],
                        raw[at + 1],
                        raw[at + 2],
                        raw[at + 3],
                        raw[at + 4],
                        raw[at + 5],
                        raw[at + 6],
                        raw[at + 7],
                    ]),
                }
            };
            let value = match mode {
                0 => (0..bins).map(read_value).sum(),
                1 => {
                    let sum: f64 = (0..bins).map(read_value).sum();
                    if sum == 0.0 {
                        0.0
                    } else {
                        (0..bins)
                            .map(|bin| read_value(bin) * bin as f64)
                            .sum::<f64>()
                            / sum
                            * bin_width_ns
                    }
                }
                _ => read_value(time_bin),
            };
            out.push(value as f32);
        }
    }

    let selector = |name: &str, size: usize, value: usize, labels: Option<Vec<&str>>| {
        let mut fields = vec![
            ("name".to_string(), JsonValue::Str(name.to_string())),
            ("size".to_string(), JsonValue::Num(size as f64)),
            ("value".to_string(), JsonValue::Num(value as f64)),
        ];
        if let Some(labels) = labels {
            fields.push((
                "labels".to_string(),
                JsonValue::Arr(
                    labels
                        .into_iter()
                        .map(|v| JsonValue::Str(v.to_string()))
                        .collect(),
                ),
            ));
        }
        JsonValue::Obj(fields)
    };
    let mut selectors = Vec::new();
    if blocks.len() > 1 {
        selectors.push(selector("B", blocks.len(), block_index, None));
    }
    selectors.push(selector(
        "Mode",
        3,
        mode,
        Some(vec![
            "Intensity (sum)",
            "Mean arrival time (ns)",
            "Single time bin",
        ]),
    ));
    selectors.push(selector("T", bins, time_bin, None));
    let metadata = JsonValue::Obj(vec![
        ("format".to_string(), JsonValue::Str("SDT".to_string())),
        (
            "blockCount".to_string(),
            JsonValue::Num(blocks.len() as f64),
        ),
        ("block".to_string(), JsonValue::Num(block_index as f64)),
        (
            "blockType".to_string(),
            JsonValue::Str(content_name(block.block_type).to_string()),
        ),
        ("histogramBins".to_string(), JsonValue::Num(bins as f64)),
        ("tacRangeSeconds".to_string(), JsonValue::Num(tac_range)),
        (
            "binWidthNanoseconds".to_string(),
            JsonValue::Num(bin_width_ns),
        ),
        (
            "view".to_string(),
            JsonValue::Str(
                match mode {
                    0 => "Integrated intensity",
                    1 => "Mean arrival time",
                    _ => "Single time bin",
                }
                .to_string(),
            ),
        ),
        ("selectors".to_string(), JsonValue::Arr(selectors)),
        (
            "selectedIndices".to_string(),
            JsonValue::Obj(vec![
                ("B".to_string(), JsonValue::Num(block_index as f64)),
                ("Mode".to_string(), JsonValue::Num(mode as f64)),
                ("T".to_string(), JsonValue::Num(time_bin as f64)),
            ]),
        ),
    ]);

    Ok(ScientificParsed {
        width: width as u32,
        height: height as u32,
        channels: 1,
        bits_per_sample: 32,
        sample_format: 3,
        type_min: 0.0,
        type_max: out.iter().copied().fold(0.0f32, f32::max) as f64,
        source_numeric_type: "float32".to_string(),
        metadata_json: to_json_string(&metadata),
        data: out,
    })
}

#[cfg(test)]
mod tests {
    const RAW: &[u8] = include_bytes!("../../../../test-samples/scientific/synthetic-flim.sdt");
    const ZIP: &[u8] = include_bytes!("../../../../test-samples/scientific/synthetic-flim-zip.sdt");

    #[test]
    fn integrated_intensity_crops_padded_histograms() {
        let decoded = super::decode_sdt_impl(RAW, "{}").unwrap();
        assert_eq!((decoded.width, decoded.height, decoded.channels), (5, 4, 1));
        assert_eq!(decoded.data.len(), 20);
        for y in 0..4 {
            for x in 0..5 {
                assert_eq!(decoded.data[y * 5 + x], (8 * (10 * y + 3 * x) + 28) as f32);
            }
        }
        assert!(decoded.metadata_json.contains("Mean arrival time (ns)"));
    }

    #[test]
    fn raw_time_bin_and_zip_match_reference_values() {
        let options = r#"{"indices":{"Mode":2,"T":3}}"#;
        for bytes in [RAW, ZIP] {
            let decoded = super::decode_sdt_impl(bytes, options).unwrap();
            for y in 0..4 {
                for x in 0..5 {
                    assert_eq!(decoded.data[y * 5 + x], (10 * y + 3 * x + 3) as f32);
                }
            }
        }
    }
}
