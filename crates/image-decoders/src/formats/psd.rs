//! The merged (composite) image of an 8-bit RGB or grayscale Photoshop
//! document, in row ranges, so the viewer can decode it across its worker
//! pool.
//!
//! The viewer's PSD reader is ag-psd; its composite is the authoritative
//! preview, so these rows must equal ag-psd's output byte for byte:
//!
//! - The output is RGBA, starting from opaque black.
//! - The channel list is R, G, B (grayscale: gray alone), then channels 3 and
//!   up when the header names more than three, or else channel 3 (alpha)
//!   when the layer count is negative ("global alpha"). List entry `i` goes to
//!   output byte `list[i]` of each pixel; entries past the fourth, or aimed
//!   past alpha, are skipped. Grayscale then copies gray into green and blue.
//! - `PackBits` rows stop writing at `width`; a source byte read past the row's
//!   end is 0, header 128 is skipped. ag-psd's write position runs on across
//!   rows, so a row that fills fewer than `width` pixels shifts every later
//!   row. Such files are rejected here (decoding fails) and stay with ag-psd.
//! - With global alpha the white matte is removed in f64 and stored through a
//!   `Uint8ClampedArray` (clamped, ties to even).

use crate::DecodeError;

/// Where each composite row of each channel starts.
pub struct PsdCompositePlan {
    pub width: u32,
    pub height: u32,
    /// The output byte (0-3) each planned channel lands in.
    pub targets: Vec<u8>,
    /// Gray in byte 0, copied into green and blue after decoding.
    pub grayscale: bool,
    /// The document's layer count is negative; see the module comment.
    pub global_alpha: bool,
    /// 0 raw, 1 `PackBits`.
    pub compression: u32,
    /// `targets.len() * height` byte offsets, channel-major: row `y` of
    /// planned channel `c` starts at `row_offsets[c * height + y]`.
    pub row_offsets: Vec<u64>,
    /// The matching row lengths in bytes.
    pub row_counts: Vec<u32>,
}

/// What decoding a range of composite rows needs from the plan.
pub struct PsdRowLayout<'a> {
    pub width: usize,
    /// The plan's `targets`.
    pub targets: &'a [u8],
    /// 0 raw, 1 `PackBits`.
    pub compression: u32,
    pub global_alpha: bool,
    pub grayscale: bool,
}

struct Reader<'a> {
    data: &'a [u8],
    offset: usize,
}

impl Reader<'_> {
    fn bytes(&mut self, length: usize) -> Result<&[u8], DecodeError> {
        let end = self
            .offset
            .checked_add(length)
            .filter(|end| *end <= self.data.len())
            .ok_or_else(|| DecodeError::new("PSD: truncated file"))?;
        let bytes = &self.data[self.offset..end];
        self.offset = end;
        Ok(bytes)
    }
    fn u16(&mut self) -> Result<u16, DecodeError> {
        let b = self.bytes(2)?;
        Ok(u16::from_be_bytes([b[0], b[1]]))
    }
    fn u32(&mut self) -> Result<u32, DecodeError> {
        let b = self.bytes(4)?;
        Ok(u32::from_be_bytes([b[0], b[1], b[2], b[3]]))
    }
    /// A section length: 4 bytes, or 8 in a PSB (whose high word must be 0,
    /// as ag-psd requires).
    fn section_length(&mut self, large: bool) -> Result<usize, DecodeError> {
        if large && self.u32()? != 0 {
            return Err(DecodeError::new(
                "PSD: sections over 4 GB are not supported",
            ));
        }
        Ok(self.u32()? as usize)
    }
    fn skip(&mut self, length: usize) -> Result<(), DecodeError> {
        self.bytes(length).map(|_| ())
    }
}

/// The plan for an 8-bit RGB or grayscale composite stored raw or as `PackBits`. Anything
/// else (other color modes or depths, unknown compression) is an error, and
/// the caller keeps decoding the document with ag-psd.
pub(crate) fn psd_composite_plan(data: &[u8]) -> Result<PsdCompositePlan, DecodeError> {
    let mut reader = Reader { data, offset: 0 };
    if reader.bytes(4)? != b"8BPS" {
        return Err(DecodeError::new("PSD: missing 8BPS signature"));
    }
    let version = reader.u16()?;
    if version != 1 && version != 2 {
        return Err(DecodeError::new("PSD: unknown version"));
    }
    let large = version == 2;
    reader.skip(6)?;
    let header_channels = reader.u16()?;
    let height = reader.u32()?;
    let width = reader.u32()?;
    let depth = reader.u16()?;
    let color_mode = reader.u16()?;
    let grayscale = color_mode == 1;
    if (color_mode != 3 && !grayscale) || depth != 8 || width == 0 || height == 0 {
        return Err(DecodeError::new(
            "PSD: only 8-bit RGB and grayscale composites are planned",
        ));
    }

    // Color mode data, then image resources.
    for _ in 0..2 {
        let length = reader.u32()? as usize;
        reader.skip(length)?;
    }
    // Layer and mask information: only the sign of the layer count matters.
    let layer_and_mask = reader.section_length(large)?;
    let section_end = reader
        .offset
        .checked_add(layer_and_mask)
        .filter(|end| *end <= data.len())
        .ok_or_else(|| DecodeError::new("PSD: truncated layer section"))?;
    let mut global_alpha = false;
    if layer_and_mask > 0 && reader.section_length(large)? > 0 {
        global_alpha = reader.u16()?.cast_signed() < 0;
    }
    reader.offset = section_end;

    let compression = u32::from(reader.u16()?);
    if compression > 1 {
        return Err(DecodeError::new("PSD: unsupported composite compression"));
    }
    let mut list: Vec<u16> = if grayscale { vec![0] } else { vec![0, 1, 2] };
    if header_channels > 3 {
        list.extend(3..header_channels);
    } else if global_alpha {
        list.push(3);
    }
    let listed = list.len();
    let height_rows = height as usize;
    let mut lengths = Vec::with_capacity(listed * height_rows);
    if compression == 1 {
        for _ in 0..listed * height_rows {
            lengths.push(if large {
                reader.u32()?
            } else {
                u32::from(reader.u16()?)
            });
        }
    } else {
        lengths.resize(listed * height_rows, width);
    }
    // Only list entries 0-3 aimed at bytes 0-3 are decoded, and those form a
    // prefix of the list (targets rise by at least one per entry).
    let targets: Vec<u8> = list
        .iter()
        .take(4)
        .take_while(|&&target| target <= 3)
        .map(|&target| u8::try_from(target).unwrap_or(u8::MAX))
        .collect();
    let channels = targets.len();
    let mut row_offsets = Vec::with_capacity(channels * height_rows);
    let mut row_counts = Vec::with_capacity(channels * height_rows);
    let mut offset = reader.offset as u64;
    for (index, &length) in lengths.iter().enumerate() {
        if index < channels * height_rows {
            row_offsets.push(offset);
            row_counts.push(length);
        }
        offset += u64::from(length);
    }
    // ag-psd reads (and skips) every listed channel; a file too short for
    // them fails there, so it is not planned here either.
    if offset > data.len() as u64 {
        return Err(DecodeError::new("PSD: composite rows extend past the file"));
    }
    Ok(PsdCompositePlan {
        width,
        height,
        targets,
        grayscale,
        global_alpha,
        compression,
        row_offsets,
        row_counts,
    })
}

/// Decode `rows` composite rows to RGBA. `blob` holds those rows' bytes for
/// each planned channel in turn (channel-major, as in the plan), `counts`
/// their lengths in the same order, `targets` the plan's output bytes.
///
/// # Errors
///
/// Lengths that do not match `blob`, or a `PackBits` row that does not fill
/// exactly `width` pixels (ag-psd would shift the rows after it).
pub(crate) fn decode_psd_composite_rows(
    blob: &[u8],
    counts: &[u32],
    rows: usize,
    layout: &PsdRowLayout,
) -> Result<Vec<u8>, DecodeError> {
    let PsdRowLayout {
        width,
        targets,
        compression,
        global_alpha,
        grayscale,
    } = *layout;
    let channels = targets.len();
    if channels == 0
        || channels > 4
        || targets.iter().any(|&t| t > 3)
        || counts.len() != channels * rows
    {
        return Err(DecodeError::new("PSD rows: counts do not match the range"));
    }
    let mut out = vec![0u8; width * rows * 4];
    for pixel in out.chunks_exact_mut(4) {
        pixel[3] = 255;
    }
    let mut position = 0usize;
    for (index, &count) in counts.iter().enumerate() {
        let channel = usize::from(targets[index / rows]);
        let y = index % rows;
        let end = position
            .checked_add(count as usize)
            .filter(|end| *end <= blob.len())
            .ok_or_else(|| DecodeError::new("PSD rows: blob is shorter than its counts"))?;
        let source = &blob[position..end];
        position = end;
        let row = &mut out[y * width * 4..(y + 1) * width * 4];
        let written = if compression == 1 {
            unpack_bits_strided(source, row, channel, width)
        } else {
            for (x, &value) in source.iter().take(width).enumerate() {
                row[x * 4 + channel] = value;
            }
            source.len()
        };
        if written != width {
            return Err(DecodeError::new(
                "PSD rows: a row does not fill the image width",
            ));
        }
    }
    if grayscale {
        for pixel in out.chunks_exact_mut(4) {
            pixel[1] = pixel[0];
            pixel[2] = pixel[0];
        }
    }
    if global_alpha {
        remove_white_matte(&mut out);
    }
    Ok(out)
}

/// ag-psd's `PackBits` loop for one row, writing every fourth byte from
/// `channel`. Returns how many pixels it wrote (at most `width`).
fn unpack_bits_strided(source: &[u8], row: &mut [u8], channel: usize, width: usize) -> usize {
    let at = |i: usize| source.get(i).copied().unwrap_or(0);
    let mut x = 0usize;
    let mut i = 0usize;
    while i < source.len() {
        let header = source[i];
        if header > 128 {
            i += 1;
            let value = at(i);
            let run = usize::from(header.wrapping_neg()) + 1;
            let stop = (x + run).min(width);
            while x < stop {
                row[x * 4 + channel] = value;
                x += 1;
            }
        } else if header < 128 {
            let run = usize::from(header) + 1;
            for _ in 0..run {
                if x >= width {
                    break;
                }
                i += 1;
                row[x * 4 + channel] = at(i);
                x += 1;
            }
        }
        i += 1;
    }
    x
}

/// ag-psd's "remove weird white matte" for global-alpha composites.
fn remove_white_matte(rgba: &mut [u8]) {
    for pixel in rgba.chunks_exact_mut(4) {
        let alpha = pixel[3];
        if alpha != 0 && alpha != 255 {
            let ra = 1.0 / (f64::from(alpha) / 255.0);
            let inv_a = 255.0 * (1.0 - ra);
            for value in &mut pixel[..3] {
                *value = clamp_u8(f64::from(*value) * ra + inv_a);
            }
        }
    }
}

/// `Uint8ClampedArray` element conversion: NaN to 0, clamp, round half to even.
#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)] // clamped to 0..=255
fn clamp_u8(value: f64) -> u8 {
    if value.is_nan() {
        0
    } else {
        value.clamp(0.0, 255.0).round_ties_even() as u8
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn literal_and_repeat_runs_fill_a_row() {
        // 2 literals (header 1), then 3 repeats of 9 (header 254 = -2).
        let mut row = vec![0u8; 5 * 4];
        let written = unpack_bits_strided(&[1, 7, 8, 254, 9], &mut row, 1, 5);
        assert_eq!(written, 5);
        let channel: Vec<u8> = row.chunks_exact(4).map(|p| p[1]).collect();
        assert_eq!(channel, [7, 8, 9, 9, 9]);
    }

    #[test]
    fn runs_stop_at_the_width_and_short_rows_are_rejected() {
        let mut row = vec![0u8; 2 * 4];
        assert_eq!(unpack_bits_strided(&[253, 5], &mut row, 0, 2), 2);
        assert_eq!(unpack_bits_strided(&[0, 5], &mut row, 0, 2), 1);
        let layout = PsdRowLayout {
            width: 2,
            targets: &[0, 1, 2],
            compression: 1,
            global_alpha: false,
            grayscale: false,
        };
        let error = decode_psd_composite_rows(&[0, 5, 0, 5, 0, 5], &[2, 2, 2], 1, &layout);
        assert!(error.is_err());
    }

    #[test]
    fn matte_matches_uint8_clamped_rounding() {
        // alpha 128: ra = 255 / 128 = 1.9921875 and inv_a = 255 * (1 - ra) =
        // -253.0078125, both exact, so 200 -> 145.4296875 and 129 -> 3.984375.
        let mut pixel = [200u8, 129, 0, 128];
        remove_white_matte(&mut pixel);
        assert_eq!(pixel, [145, 4, 0, 128]);
        assert_eq!(clamp_u8(2.5), 2);
        assert_eq!(clamp_u8(3.5), 4);
        assert_eq!(clamp_u8(f64::NAN), 0);
    }
}
