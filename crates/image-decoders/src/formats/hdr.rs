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

/// The parsed Radiance header and where its first scanline starts.
struct HdrHeader {
    width: usize,
    height: usize,
    exposure: f32,
    gamma: f32,
    header_lines: Vec<String>,
    data_offset: usize,
}

fn parse_header(data: &[u8]) -> Result<HdrHeader, DecodeError> {
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

    if width == 0 || height == 0 {
        return Err(DecodeError::new("HDR resolution line not found"));
    }
    if !rle {
        return Err(DecodeError::new(
            "Only FORMAT=32-bit_rle_rgbe HDR files are supported",
        ));
    }
    Ok(HdrHeader {
        width,
        height,
        exposure,
        gamma,
        header_lines,
        data_offset: offset,
    })
}

/// RGBE exponent byte to its linear scale, `2^(e - 128) / 255`.
fn exponent_scales() -> [f32; 256] {
    let mut scales = [0f32; 256];
    for (e, scale) in scales.iter_mut().enumerate().skip(1) {
        *scale = 2f32.powi(e as i32 - 128) / 255.0;
    }
    scales
}

/// Decode one new-style RLE scanline starting at `*offset` into `scanline`
/// (four planes of `width` bytes: R, G, B, E), advancing `*offset` past it.
/// With `scanline` empty the runs are only walked, which is how the parallel
/// plan finds where each scanline starts.
fn decode_scanline(
    data: &[u8],
    offset: &mut usize,
    width: usize,
    scanline: &mut [u8],
) -> Result<(), DecodeError> {
    if *offset + 4 > data.len() {
        return Err(DecodeError::new("Unexpected EOF in HDR scanline header"));
    }
    let b0 = data[*offset];
    let b1 = data[*offset + 1];
    let b2 = data[*offset + 2];
    let b3 = data[*offset + 3];
    // Scanlines narrower than 8 or wider than 0x7fff pixels cannot be
    // new-style RLE, and a scanline without its marker is stored flat.
    if !(8..=0x7fff).contains(&width) || b0 != 2 || b1 != 2 || (b2 & 0x80) != 0 {
        return decode_old_scanline(data, offset, width, scanline);
    }
    *offset += 4;
    let scanline_width = ((b2 as usize) << 8) | b3 as usize;
    if scanline_width != width {
        return Err(DecodeError::new("HDR scanline width mismatch"));
    }
    let write = !scanline.is_empty();
    for channel in 0..4 {
        let mut ptr = channel * width;
        let end = ptr + width;
        while ptr < end {
            if *offset + 2 > data.len() {
                return Err(DecodeError::new("Unexpected EOF in HDR RLE data"));
            }
            let count_byte = data[*offset];
            let value = data[*offset + 1];
            *offset += 2;
            if count_byte > 128 {
                let count = (count_byte - 128) as usize;
                if count == 0 || ptr + count > end {
                    return Err(DecodeError::new("Bad HDR RLE run"));
                }
                if write {
                    scanline[ptr..ptr + count].fill(value);
                }
                ptr += count;
            } else {
                let count = count_byte as usize;
                if count == 0 || ptr + count > end {
                    return Err(DecodeError::new("Bad HDR RLE literal"));
                }
                if write {
                    scanline[ptr] = value;
                }
                ptr += 1;
                if count > 1 {
                    let remaining = count - 1;
                    if *offset + remaining > data.len() {
                        return Err(DecodeError::new("Unexpected EOF in HDR literal"));
                    }
                    if write {
                        scanline[ptr..ptr + remaining]
                            .copy_from_slice(&data[*offset..*offset + remaining]);
                    }
                    ptr += remaining;
                    *offset += remaining;
                }
            }
        }
    }
    Ok(())
}

/// Decode one flat (uncompressed) or old-style RLE scanline starting at
/// `*offset` into the same planar layout as `decode_scanline`. Flat pixels are
/// four bytes R, G, B, E; a pixel of `1, 1, 1, n` repeats the previous pixel
/// `n << shift` times, the shift growing by 8 for each consecutive run.
fn decode_old_scanline(
    data: &[u8],
    offset: &mut usize,
    width: usize,
    scanline: &mut [u8],
) -> Result<(), DecodeError> {
    let write = !scanline.is_empty();
    if width > 0
        && *offset + width * 4 <= data.len()
        && !has_old_run(&data[*offset + 4..*offset + width * 4])
    {
        // The common case: the whole scanline is flat (a marker on its
        // first pixel has nothing to repeat and is read as a pixel).
        if write {
            let pixels = &data[*offset..*offset + width * 4];
            let (r, rest) = scanline.split_at_mut(width);
            let (g, rest) = rest.split_at_mut(width);
            let (b, e) = rest.split_at_mut(width);
            for (x, pixel) in pixels.chunks_exact(4).enumerate() {
                r[x] = pixel[0];
                g[x] = pixel[1];
                b[x] = pixel[2];
                e[x] = pixel[3];
            }
        }
        *offset += width * 4;
        return Ok(());
    }
    let mut x = 0usize;
    let mut shift = 0u32;
    while x < width {
        if *offset + 4 > data.len() {
            return Err(DecodeError::new("Unexpected EOF in flat HDR scanline"));
        }
        let pixel = &data[*offset..*offset + 4];
        *offset += 4;
        if x > 0 && pixel[0] == 1 && pixel[1] == 1 && pixel[2] == 1 {
            if shift > 24 {
                return Err(DecodeError::new("Bad old-style HDR run"));
            }
            let count = (pixel[3] as usize) << shift;
            if x + count > width {
                return Err(DecodeError::new("Old-style HDR run overflows the scanline"));
            }
            if write {
                for plane in 0..4 {
                    let value = scanline[plane * width + x - 1];
                    scanline[plane * width + x..plane * width + x + count].fill(value);
                }
            }
            x += count;
            shift += 8;
        } else {
            if write {
                for plane in 0..4 {
                    scanline[plane * width + x] = pixel[plane];
                }
            }
            x += 1;
            shift = 0;
        }
    }
    Ok(())
}

/// Whether any pixel of a flat scanline is an old-style run marker.
fn has_old_run(pixels: &[u8]) -> bool {
    pixels
        .chunks_exact(4)
        .any(|p| p[0] == 1 && p[1] == 1 && p[2] == 1)
}

/// One decoded scanline to RGB floats.
fn convert_row(scanline: &[u8], width: usize, scales: &[f32; 256], out: &mut [f32]) {
    for x in 0..width {
        let e = scanline[x + width * 3] as usize;
        let at = x * 3;
        if e == 0 {
            out[at] = 0.0;
            out[at + 1] = 0.0;
            out[at + 2] = 0.0;
        } else {
            let scale = scales[e];
            out[at] = f32::from(scanline[x]) * scale;
            out[at + 1] = f32::from(scanline[x + width]) * scale;
            out[at + 2] = f32::from(scanline[x + width * 2]) * scale;
        }
    }
}

pub(crate) fn decode_hdr_impl(data: &[u8]) -> Result<HdrResult, DecodeError> {
    let start_time = crate::time::now_ms();
    let header = parse_header(data)?;
    let header_time = crate::time::now_ms() - start_time;
    let (width, height) = (header.width, header.height);
    let mut offset = header.data_offset;

    let pixel_count = width
        .checked_mul(height)
        .ok_or_else(|| DecodeError::new("HDR dimensions overflow"))?;
    let mut scanline = vec![0u8; width * 4];
    // parse-hdr's historical fourth channel was always constant alpha=1.
    // Omitting it saves 100 MiB for a 5120² image at every later handoff.
    let mut output = vec![0f32; pixel_count * 3];
    let scales = exponent_scales();
    let mut rle_time = 0.0;
    let mut convert_time = 0.0;

    for y in 0..height {
        let rle_start = crate::time::now_ms();
        decode_scanline(data, &mut offset, width, &mut scanline)?;
        rle_time += crate::time::now_ms() - rle_start;

        let convert_start = crate::time::now_ms();
        let row_offset = y * width * 3;
        convert_row(
            &scanline,
            width,
            &scales,
            &mut output[row_offset..row_offset + width * 3],
        );
        convert_time += crate::time::now_ms() - convert_start;
    }

    Ok(HdrResult {
        channels: 3,
        data_f32: output,
        metadata_f64: vec![
            width as f64,
            height as f64,
            f64::from(header.exposure),
            f64::from(header.gamma),
            header_time,
            rle_time,
            convert_time,
            crate::time::now_ms() - start_time,
        ],
        all_tags_json: hdr_header_lines_to_json(&header.header_lines),
    })
}

/// Where every scanline of an HDR file starts, so ranges of scanlines can be
/// decoded in parallel: Radiance RLE scanlines are independent, but carry no
/// index, so the runs are walked once without writing any pixels.
pub struct HdrScanlinePlan {
    pub width: u32,
    pub height: u32,
    pub exposure: f32,
    pub gamma: f32,
    pub all_tags_json: String,
    /// `height + 1` byte offsets: scanline `y` spans `offsets[y]..offsets[y + 1]`.
    pub offsets: Vec<u64>,
}

pub(crate) fn hdr_scanline_plan(data: &[u8]) -> Result<HdrScanlinePlan, DecodeError> {
    let header = parse_header(data)?;
    let mut offsets = Vec::with_capacity(header.height + 1);
    let mut offset = header.data_offset;
    for _ in 0..header.height {
        offsets.push(offset as u64);
        decode_scanline(data, &mut offset, header.width, &mut [])?;
    }
    offsets.push(offset as u64);
    Ok(HdrScanlinePlan {
        width: u32::try_from(header.width).map_err(|_| DecodeError::new("HDR too wide"))?,
        height: u32::try_from(header.height).map_err(|_| DecodeError::new("HDR too tall"))?,
        exposure: header.exposure,
        gamma: header.gamma,
        all_tags_json: hdr_header_lines_to_json(&header.header_lines),
        offsets,
    })
}

/// Decode `rows` consecutive scanlines from `blob` (exactly their bytes, as
/// the plan delimits them) to RGB f32, with the same code as the whole-file
/// decode.
pub(crate) fn decode_hdr_rows(
    blob: &[u8],
    width: usize,
    rows: usize,
) -> Result<Vec<f32>, DecodeError> {
    let mut scanline = vec![0u8; width * 4];
    let scales = exponent_scales();
    let mut out = vec![0f32; rows * width * 3];
    let mut offset = 0usize;
    for row in out.chunks_exact_mut(width * 3) {
        decode_scanline(blob, &mut offset, width, &mut scanline)?;
        convert_row(&scanline, width, &scales, row);
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn header(width: usize, height: usize) -> Vec<u8> {
        format!("#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y {height} +X {width}\n").into_bytes()
    }

    fn pixels(width: usize, height: usize) -> Vec<[u8; 4]> {
        (0..width * height)
            .map(|i| {
                [
                    (i * 7 % 251) as u8,
                    (i * 13 % 239) as u8,
                    (i % 200) as u8 + 3,
                    120 + (i % 16) as u8,
                ]
            })
            .collect()
    }

    /// New-style RLE with every channel stored as literals of at most 128.
    fn rle_file(width: usize, height: usize, px: &[[u8; 4]]) -> Vec<u8> {
        let mut out = header(width, height);
        for row in px.chunks_exact(width) {
            out.extend_from_slice(&[2, 2, (width >> 8) as u8, width as u8]);
            for channel in 0..4 {
                let values: Vec<u8> = row.iter().map(|p| p[channel]).collect();
                for chunk in values.chunks(128) {
                    out.push(chunk.len() as u8);
                    out.extend_from_slice(chunk);
                }
            }
        }
        out
    }

    fn flat_file(width: usize, height: usize, px: &[[u8; 4]]) -> Vec<u8> {
        let mut out = header(width, height);
        for p in px {
            out.extend_from_slice(p);
        }
        out
    }

    #[test]
    fn flat_scanlines_decode_like_rle_ones() {
        for (width, height) in [(37, 5), (4, 3)] {
            let px = pixels(width, height);
            let flat = decode_hdr_impl(&flat_file(width, height, &px)).unwrap();
            if width >= 8 {
                let rle = decode_hdr_impl(&rle_file(width, height, &px)).unwrap();
                assert_eq!(flat.data_f32, rle.data_f32);
            }
            let (r, g, b, e) = (px[1][0], px[1][1], px[1][2], px[1][3]);
            let scale = 2f32.powi(i32::from(e) - 128) / 255.0;
            assert_eq!(
                &flat.data_f32[3..6],
                &[
                    f32::from(r) * scale,
                    f32::from(g) * scale,
                    f32::from(b) * scale
                ]
            );
        }
    }

    #[test]
    fn flat_files_plan_fixed_scanline_offsets() {
        let (width, height) = (37, 5);
        let file = flat_file(width, height, &pixels(width, height));
        let plan = hdr_scanline_plan(&file).unwrap();
        let start = header(width, height).len() as u64;
        let expected: Vec<u64> = (0..=height as u64)
            .map(|y| start + y * width as u64 * 4)
            .collect();
        assert_eq!(plan.offsets, expected);
        let blob = &file[plan.offsets[2] as usize..plan.offsets[4] as usize];
        let rows = decode_hdr_rows(blob, width, 2).unwrap();
        assert_eq!(
            rows,
            decode_hdr_impl(&file).unwrap().data_f32[2 * width * 3..4 * width * 3]
        );
    }

    #[test]
    fn old_style_runs_repeat_the_previous_pixel() {
        // Width 300: pixel, run of 2, run of 1 << 8 (consecutive: shift 8), then
        // a final literal pixel; 1 + 2 + 256 + 1 = 260 < 300, so pad literals.
        let width = 300;
        let mut file = header(width, 1);
        file.extend_from_slice(&[10, 20, 30, 130]);
        file.extend_from_slice(&[1, 1, 1, 2]);
        file.extend_from_slice(&[1, 1, 1, 1]);
        for _ in 0..41 {
            file.extend_from_slice(&[5, 6, 7, 129]);
        }
        let result = decode_hdr_impl(&file).unwrap();
        let first = &result.data_f32[0..3];
        for x in 0..259 {
            assert_eq!(&result.data_f32[x * 3..x * 3 + 3], first, "pixel {x}");
        }
        let scale = 2f32.powi(1) / 255.0;
        assert_eq!(
            &result.data_f32[259 * 3..260 * 3],
            &[5.0 * scale, 6.0 * scale, 7.0 * scale]
        );
        assert_eq!(
            hdr_scanline_plan(&file).unwrap().offsets[1] as usize,
            file.len()
        );
    }
}
