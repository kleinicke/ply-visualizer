use crate::formats::metadata::push_generic_attr_row;
use crate::DecodeError;
use crate::HdrResult;

/// Turn Radiance HDR header lines into generic {name, value} tags: `KEY=VALUE`
/// lines split on the first `=`, `#`-prefixed lines become "Comment" rows,
/// anything else (e.g. the resolution line) is kept verbatim under "Header".
fn hdr_header_lines_to_json(lines: &[String]) -> String {
    let mut out = Vec::new();
    for line in lines {
        let (name, value) = if let Some(rest) = line.strip_prefix('#') {
            ("Comment", rest.trim())
        } else if let Some(eq_pos) = line.find('=') {
            (&line[..eq_pos], &line[eq_pos + 1..])
        } else {
            ("Header", line.as_str())
        };
        push_generic_attr_row(&mut out, "HDR", name, value.to_string());
    }
    format!("[{}]", out.join(","))
}

pub(crate) fn decode_hdr_impl(data: &[u8]) -> Result<HdrResult, DecodeError> {
    let start_time = crate::time::now_ms();
    let mut offset = 0usize;
    let mut width = 0usize;
    let mut height = 0usize;
    let mut exposure = 1.0f32;
    let mut gamma = 1.0f32;
    let mut rle = false;
    // Every non-empty header line (comments, SOFTWARE=, VIEW=, custom fields,
    // and the recognized ones below), kept generically for the Metadata panel.
    let mut header_lines: Vec<String> = Vec::new();

    for _ in 0..128 {
        let line_start = offset;
        while offset < data.len() && data[offset] != b'\n' {
            offset += 1;
        }
        if offset >= data.len() {
            return Err(DecodeError::new("HDR header ended before resolution line"));
        }
        let line_bytes = &data[line_start..offset];
        offset += 1;
        let line = std::str::from_utf8(line_bytes)
            .map_err(|_| DecodeError::new("HDR header is not UTF-8"))?
            .trim();
        if !line.is_empty() {
            header_lines.push(line.to_string());
        }
        if line == "FORMAT=32-bit_rle_rgbe" {
            rle = true;
        } else if let Some(value) = line.strip_prefix("EXPOSURE=") {
            exposure = value.trim().parse::<f32>().unwrap_or(1.0);
        } else if let Some(value) = line.strip_prefix("GAMMA=") {
            gamma = value.trim().parse::<f32>().unwrap_or(1.0);
        } else if line.starts_with("-Y ") && line.contains(" +X ") {
            let mut parts = line.split_whitespace();
            if parts.next() == Some("-Y") {
                height = parts
                    .next()
                    .ok_or_else(|| DecodeError::new("Missing HDR height"))?
                    .parse::<usize>()
                    .map_err(|_| DecodeError::new("Invalid HDR height"))?;
                if parts.next() != Some("+X") {
                    return Err(DecodeError::new("Unsupported HDR orientation"));
                }
                width = parts
                    .next()
                    .ok_or_else(|| DecodeError::new("Missing HDR width"))?
                    .parse::<usize>()
                    .map_err(|_| DecodeError::new("Invalid HDR width"))?;
                break;
            }
        }
    }

    let header_time = crate::time::now_ms() - start_time;
    if width == 0 || height == 0 {
        return Err(DecodeError::new("HDR resolution line not found"));
    }
    if !rle {
        return Err(DecodeError::new(
            "Only FORMAT=32-bit_rle_rgbe HDR files are supported",
        ));
    }
    if width > 0x7fff {
        return Err(DecodeError::new("HDR scanline is too wide for RLE"));
    }

    let pixel_count = width
        .checked_mul(height)
        .ok_or_else(|| DecodeError::new("HDR dimensions overflow"))?;
    let mut scanline = vec![0u8; width * 4];
    // parse-hdr's historical fourth channel was always constant alpha=1.
    // Omitting it saves 100 MiB for a 5120² image at every later handoff.
    let mut output = vec![0f32; pixel_count * 3];
    let mut scales = [0f32; 256];
    for e in 1..256 {
        scales[e] = 2f32.powi(e as i32 - 128) / 255.0;
    }
    let mut rle_time = 0.0;
    let mut convert_time = 0.0;

    for y in 0..height {
        let rle_start = crate::time::now_ms();
        if offset + 4 > data.len() {
            return Err(DecodeError::new("Unexpected EOF in HDR scanline header"));
        }
        let b0 = data[offset];
        let b1 = data[offset + 1];
        let b2 = data[offset + 2];
        let b3 = data[offset + 3];
        offset += 4;
        if b0 != 2 || b1 != 2 || (b2 & 0x80) != 0 {
            return Err(DecodeError::new("HDR file is not new-style RLE encoded"));
        }
        let scanline_width = ((b2 as usize) << 8) | b3 as usize;
        if scanline_width != width {
            return Err(DecodeError::new("HDR scanline width mismatch"));
        }
        for channel in 0..4 {
            let mut ptr = channel * width;
            let end = ptr + width;
            while ptr < end {
                if offset + 2 > data.len() {
                    return Err(DecodeError::new("Unexpected EOF in HDR RLE data"));
                }
                let count_byte = data[offset];
                let value = data[offset + 1];
                offset += 2;
                if count_byte > 128 {
                    let count = (count_byte - 128) as usize;
                    if count == 0 || ptr + count > end {
                        return Err(DecodeError::new("Bad HDR RLE run"));
                    }
                    scanline[ptr..ptr + count].fill(value);
                    ptr += count;
                } else {
                    let count = count_byte as usize;
                    if count == 0 || ptr + count > end {
                        return Err(DecodeError::new("Bad HDR RLE literal"));
                    }
                    scanline[ptr] = value;
                    ptr += 1;
                    if count > 1 {
                        let remaining = count - 1;
                        if offset + remaining > data.len() {
                            return Err(DecodeError::new("Unexpected EOF in HDR literal"));
                        }
                        scanline[ptr..ptr + remaining]
                            .copy_from_slice(&data[offset..offset + remaining]);
                        ptr += remaining;
                        offset += remaining;
                    }
                }
            }
        }
        rle_time += crate::time::now_ms() - rle_start;

        let convert_start = crate::time::now_ms();
        let row_offset = y * width * 3;
        for x in 0..width {
            let e = scanline[x + width * 3] as usize;
            let out = row_offset + x * 3;
            if e == 0 {
                output[out] = 0.0;
                output[out + 1] = 0.0;
                output[out + 2] = 0.0;
            } else {
                let scale = scales[e];
                output[out] = scanline[x] as f32 * scale;
                output[out + 1] = scanline[x + width] as f32 * scale;
                output[out + 2] = scanline[x + width * 2] as f32 * scale;
            }
        }
        convert_time += crate::time::now_ms() - convert_start;
    }

    Ok(HdrResult {
        channels: 3,
        data_f32: output,
        metadata_f64: vec![
            width as f64,
            height as f64,
            exposure as f64,
            gamma as f64,
            header_time,
            rle_time,
            convert_time,
            crate::time::now_ms() - start_time,
        ],
        all_tags_json: hdr_header_lines_to_json(&header_lines),
    })
}

