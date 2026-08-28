use super::codecs::build_uncompressed_tiff;
use crate::DecodeError;
use std::io::Cursor;
use tiff::decoder::{Decoder, DecodingResult};

fn tiff_is_little_endian(data: &[u8]) -> Option<bool> {
    match data.get(0..4)? {
        b"II*\0" | b"II+\0" => Some(true),
        b"MM\0*" | b"MM\0+" => Some(false),
        _ => None,
    }
}

pub(crate) fn try_decode_uncompressed_strips(
    data: &[u8],
    decoder: &mut Decoder<Cursor<&[u8]>>,
    width: u32,
    height: u32,
    channels: u32,
    bits_per_sample: u32,
    compression: u32,
    predictor: u32,
    planar_configuration: u32,
) -> Result<Option<DecodingResult>, DecodeError> {
    use tiff::tags::Tag;

    if compression != 1 || predictor != 1 || planar_configuration != 1 {
        return Ok(None);
    }
    if bits_per_sample == 0 || bits_per_sample % 8 != 0 {
        return Ok(None);
    }
    if decoder.get_tag_u64_vec(Tag::TileOffsets).is_ok() {
        return Ok(None);
    }

    let little_endian = match tiff_is_little_endian(data) {
        Some(value) => value,
        None => return Ok(None),
    };
    let offsets = match decoder.get_tag_u64_vec(Tag::StripOffsets) {
        Ok(value) if !value.is_empty() => value,
        _ => return Ok(None),
    };
    let counts = match decoder.get_tag_u64_vec(Tag::StripByteCounts) {
        Ok(value) if value.len() == offsets.len() => value,
        _ => return Ok(None),
    };

    let sample_format = decoder
        .get_tag_u64_vec(Tag::SampleFormat)
        .ok()
        .and_then(|values| values.first().copied())
        .unwrap_or(1) as u32;
    let sample_count = (width as usize)
        .checked_mul(height as usize)
        .and_then(|v| v.checked_mul(channels as usize))
        .ok_or_else(|| DecodeError::new("Direct TIFF decode: image dimensions overflow"))?;
    let bytes_per_sample = (bits_per_sample / 8) as usize;
    let expected_bytes = sample_count
        .checked_mul(bytes_per_sample)
        .ok_or_else(|| DecodeError::new("Direct TIFF decode: raster byte count overflow"))?;

    let total_available = counts
        .iter()
        .try_fold(0usize, |acc, &count| acc.checked_add(count as usize))
        .ok_or_else(|| DecodeError::new("Direct TIFF decode: strip byte count overflow"))?;
    if total_available < expected_bytes {
        return Ok(None);
    }

    let mut raster = Vec::with_capacity(expected_bytes);
    for (&offset, &count) in offsets.iter().zip(counts.iter()) {
        if raster.len() >= expected_bytes {
            break;
        }
        let start = offset as usize;
        let count_usize = count as usize;
        let end = match start.checked_add(count_usize) {
            Some(value) => value,
            None => return Ok(None),
        };
        if end > data.len() {
            return Ok(None);
        }
        let remaining = expected_bytes - raster.len();
        let take = remaining.min(count_usize);
        raster.extend_from_slice(&data[start..start + take]);
    }
    if raster.len() != expected_bytes {
        return Ok(None);
    }

    let result = match (sample_format, bits_per_sample) {
        (1, 8) => DecodingResult::U8(raster),
        (1, 16) => {
            let values = raster
                .chunks_exact(2)
                .map(|b| {
                    if little_endian {
                        u16::from_le_bytes([b[0], b[1]])
                    } else {
                        u16::from_be_bytes([b[0], b[1]])
                    }
                })
                .collect();
            DecodingResult::U16(values)
        }
        (1, 32) => {
            let values = raster
                .chunks_exact(4)
                .map(|b| {
                    if little_endian {
                        u32::from_le_bytes([b[0], b[1], b[2], b[3]])
                    } else {
                        u32::from_be_bytes([b[0], b[1], b[2], b[3]])
                    }
                })
                .collect();
            DecodingResult::U32(values)
        }
        (2, 8) => DecodingResult::I8(raster.into_iter().map(|v| v as i8).collect()),
        (2, 16) => {
            let values = raster
                .chunks_exact(2)
                .map(|b| {
                    if little_endian {
                        i16::from_le_bytes([b[0], b[1]])
                    } else {
                        i16::from_be_bytes([b[0], b[1]])
                    }
                })
                .collect();
            DecodingResult::I16(values)
        }
        (2, 32) => {
            let values = raster
                .chunks_exact(4)
                .map(|b| {
                    if little_endian {
                        i32::from_le_bytes([b[0], b[1], b[2], b[3]])
                    } else {
                        i32::from_be_bytes([b[0], b[1], b[2], b[3]])
                    }
                })
                .collect();
            DecodingResult::I32(values)
        }
        (3, 32) => {
            let values = raster
                .chunks_exact(4)
                .map(|b| {
                    if little_endian {
                        f32::from_le_bytes([b[0], b[1], b[2], b[3]])
                    } else {
                        f32::from_be_bytes([b[0], b[1], b[2], b[3]])
                    }
                })
                .collect();
            DecodingResult::F32(values)
        }
        (3, 64) => {
            let values = raster
                .chunks_exact(8)
                .map(|b| {
                    if little_endian {
                        f64::from_le_bytes([b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]])
                    } else {
                        f64::from_be_bytes([b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]])
                    }
                })
                .collect();
            DecodingResult::F64(values)
        }
        _ => return Ok(None),
    };

    Ok(Some(result))
}

/// Decompress one strip/tile's compressed bytes (compression None/LZW/
/// Deflate) into exactly `expected_len` bytes, shared by
/// `try_decode_subbit_strips` and `try_decode_general_strips_tiles`.
///
/// LZW is decoded through weezl's low-level `decode_bytes` (rather than the
/// `decode()`/`into_vec()` convenience wrapper) precisely because it does
/// *not* require an end-of-information code: it simply stops once the
/// caller-provided output buffer is full. Some encoders (seen in tiled TIFFs)
/// omit the EOI code on the last tile of an image, which the `tiff` crate's
/// own LZW reader rejects with "no lzw end code found"; libtiff tolerates
/// this, and so does this path, since we already know the exact decompressed
/// size from the image/tile geometry and don't need the stream to tell us
/// when to stop.
pub(crate) fn decompress_strip_or_tile(
    block: &[u8],
    compression: u32,
    expected_len: usize,
    context: &str,
) -> Result<Vec<u8>, DecodeError> {
    use std::io::Read;

    match compression {
        1 => Ok(block.to_vec()),
        5 => {
            let mut lzw = weezl::decode::Decoder::with_tiff_size_switch(weezl::BitOrder::Msb, 8);
            let mut out = vec![0u8; expected_len];
            let mut in_pos = 0usize;
            let mut out_pos = 0usize;
            while out_pos < expected_len {
                let result = lzw.decode_bytes(&block[in_pos..], &mut out[out_pos..]);
                in_pos += result.consumed_in;
                out_pos += result.consumed_out;
                match result.status {
                    Ok(weezl::LzwStatus::Ok) => {}
                    Ok(weezl::LzwStatus::Done) => break,
                    Ok(weezl::LzwStatus::NoProgress) => {
                        if in_pos >= block.len() {
                            // Input exhausted before an EOI code appeared.
                            // Tolerate this the same way libtiff does; the
                            // caller already validates `out` was filled to
                            // the expected length below.
                            break;
                        }
                        return Err(DecodeError::new(&format!(
                            "{}: LZW decode stalled before end of input",
                            context
                        )));
                    }
                    Err(e) => {
                        return Err(DecodeError::new(&format!(
                            "{}: LZW decode failed: {}",
                            context, e
                        )))
                    }
                }
            }
            if out_pos < expected_len {
                return Err(DecodeError::new(&format!(
                    "{}: LZW stream produced {} bytes, expected {}",
                    context, out_pos, expected_len
                )));
            }
            Ok(out)
        }
        8 | 32946 => {
            let mut zd = flate2::read::ZlibDecoder::new(block);
            let mut buf = Vec::new();
            zd.read_to_end(&mut buf).map_err(|e| {
                DecodeError::new(&format!("{}: Deflate decode failed: {}", context, e))
            })?;
            Ok(buf)
        }
        _ => Err(DecodeError::new(&format!(
            "{}: compression {} is not supported",
            context, compression
        ))),
    }
}

/// Unpack `samples_per_row` MSB-first, bit-packed unsigned samples from a
/// single decompressed row. Samples are packed continuously (not padded per
/// sample), only the row as a whole is padded to a byte boundary. Shared by
/// `try_decode_subbit_strips` and `try_decode_general_strips_tiles`.
fn unpack_msb_packed_row(row: &[u8], samples_per_row: usize, bits_per_sample: u32) -> Vec<u16> {
    let max_value = (1u32 << bits_per_sample) - 1;
    let mut out = Vec::with_capacity(samples_per_row);
    let mut bit_buf: u64 = 0;
    let mut bit_count: u32 = 0;
    let mut byte_idx = 0usize;
    for _ in 0..samples_per_row {
        while bit_count < bits_per_sample {
            let byte = row.get(byte_idx).copied().unwrap_or(0);
            byte_idx += 1;
            bit_buf = (bit_buf << 8) | byte as u64;
            bit_count += 8;
        }
        let shift = bit_count - bits_per_sample;
        let value = ((bit_buf >> shift) & (max_value as u64)) as u16;
        out.push(value);
        bit_count -= bits_per_sample;
        bit_buf &= (1u64 << bit_count) - 1;
    }
    out
}

/// Unpack one decompressed row into raw sample values, widened to `u64`.
///
/// Two regimes, because TIFF treats them differently:
///
/// * **Whole-byte samples** (8/16/24/32/64 bit) are stored in the FILE's byte
///   order. Reading them MSB-first is only correct for big-endian files; a
///   little-endian file decoded that way comes out byte-swapped. `caspian.tif`
///   is little-endian, which is what exposed this.
/// * **Sub-byte and odd depths** (1/2/4/10/12/14 ...) are a continuous
///   MSB-first bit stream, unaffected by byte order (bit order is FillOrder's
///   business, and FillOrder 2 is rejected by the caller). Only the row as a
///   whole is padded to a byte boundary.
fn unpack_row_u64(
    row: &[u8],
    samples_per_row: usize,
    bits_per_sample: u32,
    little_endian: bool,
) -> Vec<u64> {
    let mut out = Vec::with_capacity(samples_per_row);
    if bits_per_sample % 8 == 0 {
        let width = (bits_per_sample / 8) as usize;
        for index in 0..samples_per_row {
            let start = index * width;
            let bytes = row.get(start..start + width).unwrap_or(&[]);
            let mut value: u64 = 0;
            if bytes.len() == width {
                if little_endian {
                    for (shift, byte) in bytes.iter().enumerate() {
                        value |= (*byte as u64) << (8 * shift);
                    }
                } else {
                    for byte in bytes {
                        value = (value << 8) | *byte as u64;
                    }
                }
            }
            out.push(value);
        }
        return out;
    }
    let mask = if bits_per_sample >= 64 { u64::MAX } else { (1u64 << bits_per_sample) - 1 };
    let mut bit_buf: u64 = 0;
    let mut bit_count: u32 = 0;
    let mut byte_idx = 0usize;
    for _ in 0..samples_per_row {
        while bit_count < bits_per_sample {
            let byte = row.get(byte_idx).copied().unwrap_or(0);
            byte_idx += 1;
            bit_buf = (bit_buf << 8) | byte as u64;
            bit_count += 8;
        }
        let shift = bit_count - bits_per_sample;
        out.push((bit_buf >> shift) & mask);
        bit_count -= bits_per_sample;
        bit_buf &= if bit_count == 0 { 0 } else { (1u64 << bit_count) - 1 };
    }
    out
}

/// Horizontal (predictor 2) differencing over `u64` samples, wrapping modulo
/// 2^bits_per_sample. The `u16` variant above cannot express the 24/32/64-bit
/// depths this path now decodes.
fn apply_horizontal_predictor2_u64(
    row_values: &mut [u64],
    row_width: usize,
    channels: usize,
    bits_per_sample: u32,
) {
    let mask = if bits_per_sample >= 64 { u64::MAX } else { (1u64 << bits_per_sample) - 1 };
    for x in 1..row_width {
        for c in 0..channels {
            let idx = x * channels + c;
            let prev = row_values[idx - channels];
            row_values[idx] = row_values[idx].wrapping_add(prev) & mask;
        }
    }
}

/// Apply the horizontal (predictor 2) differencing predictor in place to one
/// decoded row of `row_width` pixels x `channels` samples, wrapping modulo
/// 2^bits_per_sample (via `max_value`). Shared by `try_decode_subbit_strips`
/// and `try_decode_general_strips_tiles`.
fn apply_horizontal_predictor2(
    row_values: &mut [u16],
    row_width: usize,
    channels: usize,
    max_value: u32,
) {
    for x in 1..row_width {
        for c in 0..channels {
            let idx = x * channels + c;
            let prev = row_values[idx - channels] as u32;
            let cur = row_values[idx] as u32;
            row_values[idx] = ((cur + prev) & max_value) as u16;
        }
    }
}

/// Decode chunky, strip-based, unsigned-integer samples whose bit depth is
/// non-byte-aligned (9..=15 bits, e.g. 10/12/14-bit RGB or grayscale, common
/// for RAW-derived TIFFs). The tiff crate's read_image() only supports 8/16/
/// 32/64-bit samples for multi-sample color types (1/2/4-bit for single-
/// channel Gray), so it rejects these with "color type RGB(14) is
/// unsupported" before decompression is even attempted. Fetch the strips,
/// decompress them ourselves (None/LZW/Deflate), unpack the MSB-first
/// bit-packed samples (each row padded to a byte boundary), and apply the
/// horizontal predictor if present. Values are left in their native range
/// (0..2^bits-1), not rescaled to 16-bit.
///
/// Returns `Ok(None)` when the bit depth is outside 9..=15 or the layout is
/// otherwise not handled here (PlanarConfiguration 2 and tiled layouts are
/// handled by the more general `try_decode_general_strips_tiles`, tried
/// after this one). Returns `Err` for cases within this path's scope that
/// are known to not be decodable (LSB fill order, non-unsigned sample
/// format, unsupported predictor).
#[allow(clippy::too_many_arguments)]
pub(crate) fn try_decode_subbit_strips(
    data: &[u8],
    decoder: &mut Decoder<Cursor<&[u8]>>,
    width: u32,
    height: u32,
    channels: u32,
    bits_per_sample: u32,
    compression: u32,
    predictor: u32,
    planar_configuration: u32,
) -> Result<Option<DecodingResult>, DecodeError> {
    use tiff::tags::Tag;

    if !(9..=15).contains(&bits_per_sample) {
        return Ok(None);
    }
    if planar_configuration != 1 {
        // Planar sub-16-bit is a separate, parked issue: fall through so the
        // tiff crate produces its usual (clear) "unsupported color type" error.
        return Ok(None);
    }
    if compression != 1 && compression != 5 && compression != 8 && compression != 32946 {
        return Ok(None);
    }
    if decoder.get_tag_u64_vec(Tag::TileOffsets).is_ok() {
        return Err(DecodeError::new(
            "Sub-16-bit TIFF: tiled layout is not supported by the direct decode path",
        ));
    }
    if predictor != 1 && predictor != 2 {
        return Err(DecodeError::new(&format!(
            "Sub-16-bit TIFF: predictor {} is not supported",
            predictor
        )));
    }
    let fill_order = decoder.get_tag_u32(Tag::FillOrder).unwrap_or(1);
    if fill_order != 1 {
        return Err(DecodeError::new(
            "Sub-16-bit TIFF: FillOrder 2 (LSB-first) is not supported",
        ));
    }
    let sample_format = decoder
        .get_tag_u64_vec(Tag::SampleFormat)
        .ok()
        .and_then(|values| values.first().copied())
        .unwrap_or(1) as u32;
    if sample_format != 1 {
        return Err(DecodeError::new(&format!(
            "Sub-16-bit TIFF: sample format {} is not supported (only unsigned integer)",
            sample_format
        )));
    }

    let offsets = match decoder.get_tag_u64_vec(Tag::StripOffsets) {
        Ok(value) if !value.is_empty() => value,
        _ => return Ok(None),
    };
    let counts = match decoder.get_tag_u64_vec(Tag::StripByteCounts) {
        Ok(value) if value.len() == offsets.len() => value,
        _ => return Ok(None),
    };
    let rows_per_strip = decoder
        .get_tag_u32(Tag::RowsPerStrip)
        .unwrap_or(height)
        .max(1);

    let samples_per_row = (width as usize).saturating_mul(channels as usize);
    let row_bytes = (samples_per_row * bits_per_sample as usize + 7) / 8;
    let max_value = (1u32 << bits_per_sample) - 1;

    let mut out: Vec<u16> = Vec::with_capacity(samples_per_row.saturating_mul(height as usize));
    let mut rows_decoded: u32 = 0;

    for (&offset, &count) in offsets.iter().zip(counts.iter()) {
        if rows_decoded >= height {
            break;
        }
        let start = offset as usize;
        let end = start.saturating_add(count as usize);
        if end > data.len() {
            return Err(DecodeError::new(
                "Sub-16-bit TIFF: strip byte range out of bounds",
            ));
        }
        let strip = &data[start..end];

        let rows_in_strip = rows_per_strip.min(height - rows_decoded) as usize;
        let expected_bytes = row_bytes.saturating_mul(rows_in_strip);
        let decompressed =
            decompress_strip_or_tile(strip, compression, expected_bytes, "Sub-16-bit TIFF")?;
        if decompressed.len() < expected_bytes {
            return Err(DecodeError::new(&format!(
                "Sub-16-bit TIFF: strip decompressed to {} bytes, expected at least {}",
                decompressed.len(),
                expected_bytes
            )));
        }

        for row_idx in 0..rows_in_strip {
            let row = &decompressed[row_idx * row_bytes..(row_idx + 1) * row_bytes];
            let mut row_values = unpack_msb_packed_row(row, samples_per_row, bits_per_sample);

            if predictor == 2 {
                apply_horizontal_predictor2(
                    &mut row_values,
                    width as usize,
                    channels as usize,
                    max_value,
                );
            }

            out.extend_from_slice(&row_values);
        }
        rows_decoded += rows_in_strip as u32;
    }

    if rows_decoded != height {
        return Err(DecodeError::new(&format!(
            "Sub-16-bit TIFF: decoded {} of {} rows",
            rows_decoded, height
        )));
    }

    Ok(Some(DecodingResult::U16(out)))
}

/// Decode strip- or tile-based, unsigned-integer TIFFs for the two cases the
/// `tiff` crate's `read_image()` gets wrong or refuses outright:
///
///  - **Any `PlanarConfiguration == 2` image** (strips or tiles, any of the
///    compressions handled here). `read_image()`'s own doc comment admits its
///    planar handling is "not correct" -- depending on version it either
///    reads only the first plane or concatenates planes sequentially into one
///    buffer instead of interleaving them per sample, producing a
///    scrambled-but-no-error image (three copies of the picture, wrong
///    colors, etc).
///  - **Tiled LZW** (chunky or planar). Some encoders omit the LZW
///    end-of-information code on the final tile of an image; the `tiff`
///    crate's LZW reader treats a stream that runs out of input before EOI as
///    a hard error ("no lzw end code found"), where libtiff tolerates it.
///    `decompress_strip_or_tile` decodes LZW through weezl's low-level
///    buffer API, which naturally tolerates this since it stops once the
///    (known in advance, from the tile geometry) output size is reached.
///
/// Chunky, non-tiled images are left alone (`Ok(None)`) so the faster
/// existing paths (`try_decode_uncompressed_strips`, `try_decode_subbit_strips`,
/// or the `tiff` crate's own `read_image()`) keep handling them exactly as
/// before -- this path is deliberately scoped to only the cases above so it
/// never adds overhead to the common chunky path.
///
/// Always produces **chunky, interleaved** output regardless of the file's
/// on-disk planar configuration, matching what every format processor on the
/// JS side expects (the caller still reports the true
/// `PlanarConfiguration` tag value in `TiffResult` metadata).
///
/// Supports 8-bit and 9..=16-bit unsigned integer samples (matching what
/// `TiffResult::get_data_as_f32` knows how to unpack), predictor 1/2,
/// compression None/LZW/Deflate, and MSB-first fill order. Returns `Err` with
/// a clear message for anything else within its trigger scope (planar float,
/// planar 32-bit, LSB fill order, unsupported predictor/compression) rather
/// than silently producing wrong pixels.
#[allow(clippy::too_many_arguments)]
pub(crate) fn try_decode_general_strips_tiles(
    data: &[u8],
    decoder: &mut Decoder<Cursor<&[u8]>>,
    width: u32,
    height: u32,
    channels: u32,
    bits_per_sample: u32,
    compression: u32,
    predictor: u32,
    planar_configuration: u32,
    tile_width: u32,
    tile_length: u32,
) -> Result<Option<DecodingResult>, DecodeError> {
    use tiff::tags::Tag;

    let is_tiled = tile_width > 0 && tile_length > 0;
    // Depths the tiff crate declines outright (`color type RGB(2) is
    // unsupported`, `Gray(24) is unsupported`, ...). Anything that is not a
    // plain 8/16/32/64-bit sample has to be unpacked here or not at all.
    // 1-bit bilevel is deliberately excluded: `unpack_bilevel` expands it to
    // 0/255 grayscale, which is what every other path and the CCITT decoder
    // produce. Unpacking it here as raw 0/1 made a bilevel image decode
    // differently depending on its compression.
    let odd_depth = !matches!(bits_per_sample, 8 | 16 | 32 | 64) && bits_per_sample > 1;
    // 9..=15-bit STRIPS already have a dedicated, well-tested path
    // (`try_decode_subbit_strips`); leave those alone. Tiled layouts of the
    // same depths have no other handler, so they are claimed here.
    let subbit_strip_path_handles = !is_tiled && (9..=15).contains(&bits_per_sample);
    let claim = planar_configuration == 2
        || (is_tiled && compression == 5)
        || (odd_depth && !subbit_strip_path_handles);
    if !claim || bits_per_sample <= 1 {
        return Ok(None);
    }
    // A palette image's samples are indices into ColorMap, not intensities.
    // Expanding them is `decode_palette`'s job, and claiming 2/4-bit palette
    // files here bypassed it: the raw indices came back as one channel while
    // the caller had already been told the image has three, so the buffer was
    // short and the picture wrong. Photometric 3 always belongs to that path.
    if decoder
        .get_tag_u32(tiff::tags::Tag::PhotometricInterpretation)
        .map(|value| value == 3)
        .unwrap_or(false)
    {
        return Ok(None);
    }

    const CTX: &str = "Planar/tiled TIFF";

    if bits_per_sample == 0 || bits_per_sample > 64 || (bits_per_sample > 32 && bits_per_sample != 64) {
        return Err(DecodeError::new(&format!(
            "{}: {}-bit samples are not supported",
            CTX, bits_per_sample
        )));
    }
    if compression != 1 && compression != 5 && compression != 8 && compression != 32946 {
        return Err(DecodeError::new(&format!(
            "{}: compression {} is not supported",
            CTX, compression
        )));
    }
    if predictor != 1 && predictor != 2 {
        return Err(DecodeError::new(&format!(
            "{}: predictor {} is not supported",
            CTX, predictor
        )));
    }
    let fill_order = decoder.get_tag_u32(Tag::FillOrder).unwrap_or(1);
    if fill_order != 1 {
        return Err(DecodeError::new(&format!(
            "{}: FillOrder 2 (LSB-first) is not supported",
            CTX
        )));
    }
    let sample_format = decoder
        .get_tag_u64_vec(Tag::SampleFormat)
        .ok()
        .and_then(|values| values.first().copied())
        .unwrap_or(1) as u32;
    // 1 = unsigned, 2 = signed, 3 = IEEE float. Float only exists at 32/64 bits.
    if !matches!(sample_format, 1 | 2 | 3) || (sample_format == 3 && !matches!(bits_per_sample, 32 | 64)) {
        return Err(DecodeError::new(&format!(
            "{}: sample format {} at {} bits is not supported",
            CTX, sample_format, bits_per_sample
        )));
    }
    // Differencing a float sample as an integer would corrupt it; predictor 3
    // (floating-point predictor) is a different algorithm handled elsewhere.
    if sample_format == 3 && predictor != 1 {
        return Err(DecodeError::new(&format!(
            "{}: predictor {} on float samples is not supported here",
            CTX, predictor
        )));
    }
    // Multi-byte samples are stored in the file's byte order.
    let little_endian = data.first() == Some(&b'I');

    let planes = if planar_configuration == 2 {
        channels
    } else {
        1
    };
    let channels_per_block = if planar_configuration == 2 {
        1
    } else {
        channels
    };

    // Block geometry. Strips span the full image width and are never padded
    // (the last strip may simply have fewer rows than `rows_per_strip`).
    // Tiles are always TileWidth x TileLength; edge tiles that overhang the
    // image are zero-padded by the encoder to that full size, so the decoded
    // rows/columns past width/height are dropped below when assembling the
    // output.
    let (block_width, block_height, blocks_across, blocks_down, rows_per_strip) = if is_tiled {
        let across = ((width as u64) + tile_width as u64 - 1) / tile_width as u64;
        let down = ((height as u64) + tile_length as u64 - 1) / tile_length as u64;
        (tile_width, tile_length, across as u32, down as u32, 0u32)
    } else {
        let rps = decoder
            .get_tag_u32(Tag::RowsPerStrip)
            .unwrap_or(height)
            .max(1);
        let down = ((height as u64) + rps as u64 - 1) / rps as u64;
        (width, rps, 1u32, down as u32, rps)
    };
    let blocks_per_plane = (blocks_across as u64) * (blocks_down as u64);

    let offsets = (if is_tiled {
        decoder.get_tag_u64_vec(Tag::TileOffsets)
    } else {
        decoder.get_tag_u64_vec(Tag::StripOffsets)
    })
    .map_err(|e| DecodeError::new(&format!("{}: missing offsets: {}", CTX, e)))?;
    let counts = (if is_tiled {
        decoder.get_tag_u64_vec(Tag::TileByteCounts)
    } else {
        decoder.get_tag_u64_vec(Tag::StripByteCounts)
    })
    .map_err(|e| DecodeError::new(&format!("{}: missing byte counts: {}", CTX, e)))?;

    let expected_blocks = blocks_per_plane
        .checked_mul(planes as u64)
        .ok_or_else(|| DecodeError::new(&format!("{}: block count overflow", CTX)))?;
    if offsets.len() as u64 != expected_blocks || counts.len() as u64 != expected_blocks {
        return Err(DecodeError::new(&format!(
            "{}: expected {} strip/tile offsets, found {}",
            CTX,
            expected_blocks,
            offsets.len()
        )));
    }

    let samples_per_row = (block_width as usize) * (channels_per_block as usize);
    let row_bytes = (samples_per_row * bits_per_sample as usize + 7) / 8;
    let mut out: Vec<u64> = vec![0u64; (width as usize) * (height as usize) * (channels as usize)];

    let mut block_idx = 0usize;
    for plane in 0..planes {
        for tile_row in 0..blocks_down {
            for tile_col in 0..blocks_across {
                let offset = offsets[block_idx];
                let count = counts[block_idx];
                block_idx += 1;

                let start = offset as usize;
                let end = start.saturating_add(count as usize);
                if end > data.len() {
                    return Err(DecodeError::new(&format!(
                        "{}: strip/tile byte range out of bounds",
                        CTX
                    )));
                }
                let block_bytes = &data[start..end];

                let image_row_start = if is_tiled {
                    tile_row * tile_length
                } else {
                    tile_row * rows_per_strip
                };
                let image_col_start = tile_col * block_width;
                let valid_rows = block_height.min(height.saturating_sub(image_row_start));
                let valid_cols = block_width.min(width.saturating_sub(image_col_start));

                // A tile is zero-padded by the encoder to its full declared
                // size, so an edge tile really does carry `block_height` rows.
                // A STRIP is not: `RowsPerStrip` may exceed the image height
                // (a single strip covering everything is written that way, and
                // the last strip of a series is short), and the strip then
                // holds only the rows that exist. Demanding `RowsPerStrip`
                // rows rejected valid files whose strip simply ended at the
                // bottom of the image.
                let rows_present = if is_tiled { block_height } else { valid_rows };
                let expected_bytes = row_bytes.saturating_mul(rows_present as usize);
                let decompressed =
                    decompress_strip_or_tile(block_bytes, compression, expected_bytes, CTX)?;
                if decompressed.len() < expected_bytes {
                    return Err(DecodeError::new(&format!(
                        "{}: block decompressed to {} bytes, expected at least {}",
                        CTX,
                        decompressed.len(),
                        expected_bytes
                    )));
                }

                for row_idx in 0..(block_height as usize) {
                    if (row_idx as u32) >= valid_rows {
                        continue;
                    }
                    let row = &decompressed[row_idx * row_bytes..(row_idx + 1) * row_bytes];
                    let mut row_values =
                        unpack_row_u64(row, samples_per_row, bits_per_sample, little_endian);

                    if predictor == 2 {
                        apply_horizontal_predictor2_u64(
                            &mut row_values,
                            block_width as usize,
                            channels_per_block as usize,
                            bits_per_sample,
                        );
                    }

                    let out_row = (image_row_start as usize) + row_idx;
                    let out_row_base = out_row * (width as usize) * (channels as usize);

                    for col in 0..(valid_cols as usize) {
                        let out_col = (image_col_start as usize) + col;
                        for c in 0..(channels_per_block as usize) {
                            let dest_channel = if planar_configuration == 2 {
                                plane as usize
                            } else {
                                c
                            };
                            out[out_row_base + out_col * (channels as usize) + dest_channel] =
                                row_values[col * (channels_per_block as usize) + c];
                        }
                    }
                }
            }
        }
    }

    // Map the raw sample bits onto the narrowest result type that holds them
    // without loss. Depths that have no exact variant (2/4/10/12/14/24-bit)
    // widen to the next one up; the reported `bits_per_sample` still describes
    // the source, so normalization keeps using the true type maximum.
    Ok(Some(match (sample_format, bits_per_sample) {
        (3, 32) => DecodingResult::F32(
            out.into_iter().map(|v| f32::from_bits(v as u32)).collect(),
        ),
        (3, 64) => DecodingResult::F64(out.into_iter().map(f64::from_bits).collect()),
        (2, bits) => {
            // Sign-extend from the source width before widening.
            let shift = 64 - bits;
            let signed = out
                .into_iter()
                .map(|v| ((v << shift) as i64) >> shift);
            if bits <= 8 {
                DecodingResult::I8(signed.map(|v| v as i8).collect())
            } else if bits <= 16 {
                DecodingResult::I16(signed.map(|v| v as i16).collect())
            } else {
                DecodingResult::I32(signed.map(|v| v as i32).collect())
            }
        }
        (_, bits) if bits <= 8 => {
            DecodingResult::U8(out.into_iter().map(|v| v as u8).collect())
        }
        (_, bits) if bits <= 16 => {
            DecodingResult::U16(out.into_iter().map(|v| v as u16).collect())
        }
        (_, bits) if bits <= 32 => {
            DecodingResult::U32(out.into_iter().map(|v| v as u32).collect())
        }
        _ => DecodingResult::U64(out),
    }))
}

/// Decode a ZSTD-compressed TIFF (compression 50000) using the pure-Rust
/// ruzstd crate. We decompress each strip, concatenate the raster (still
/// predictor-encoded), rebuild it as a single-strip *uncompressed* TIFF that
/// keeps the predictor tag, and hand that back to the tiff crate so it performs
/// predictor un-application and type/endianness handling for us.
///
/// Tiled images and planar configuration 2 are not supported by this path.
pub(crate) fn decode_zstd(
    original: &[u8],
    decoder: &mut Decoder<Cursor<&[u8]>>,
) -> Result<DecodingResult, DecodeError> {
    use std::io::Read;
    use tiff::tags::Tag;

    if decoder.get_tag_u64_vec(Tag::TileOffsets).is_ok() {
        return Err(DecodeError::new(
            "ZSTD: tiled TIFFs are not supported by the pure-Rust path",
        ));
    }
    let planar = decoder.get_tag_u32(Tag::PlanarConfiguration).unwrap_or(1);
    if planar != 1 {
        return Err(DecodeError::new(
            "ZSTD: planar configuration 2 is not supported",
        ));
    }

    let (width, height) = decoder
        .dimensions()
        .map_err(|e| DecodeError::new(&format!("ZSTD: dimensions: {}", e)))?;
    let offsets = decoder
        .get_tag_u64_vec(Tag::StripOffsets)
        .map_err(|e| DecodeError::new(&format!("ZSTD: StripOffsets: {}", e)))?;
    let counts = decoder
        .get_tag_u64_vec(Tag::StripByteCounts)
        .map_err(|e| DecodeError::new(&format!("ZSTD: StripByteCounts: {}", e)))?;
    let spp = decoder.get_tag_u32(Tag::SamplesPerPixel).unwrap_or(1);
    let predictor = decoder.get_tag_u32(Tag::Predictor).unwrap_or(1);
    let photometric = decoder
        .get_tag_u32(Tag::PhotometricInterpretation)
        .unwrap_or(1);
    let bits: Vec<u32> = decoder
        .get_tag_u64_vec(Tag::BitsPerSample)
        .map(|v| v.into_iter().map(|b| b as u32).collect())
        .unwrap_or_else(|_| vec![8; spp as usize]);
    let sample_format: Vec<u32> = decoder
        .get_tag_u64_vec(Tag::SampleFormat)
        .map(|v| v.into_iter().map(|s| s as u32).collect())
        .unwrap_or_else(|_| vec![1; spp as usize]);

    // Decompress every strip with pure-Rust ruzstd, concatenated in row order.
    let mut raster: Vec<u8> = Vec::new();
    for (off, cnt) in offsets.iter().zip(counts.iter()) {
        let start = *off as usize;
        let end = start.saturating_add(*cnt as usize);
        if end > original.len() {
            return Err(DecodeError::new("ZSTD: strip byte range out of bounds"));
        }
        let mut dec = ruzstd::decoding::StreamingDecoder::new(Cursor::new(&original[start..end]))
            .map_err(|e| DecodeError::new(&format!("ZSTD: decoder init: {:?}", e)))?;
        dec.read_to_end(&mut raster)
            .map_err(|e| DecodeError::new(&format!("ZSTD: decompress: {:?}", e)))?;
    }

    // Match the rebuilt TIFF's byte order to the original so multi-byte samples
    // are interpreted correctly.
    let little_endian = original.get(0..2) != Some(b"MM");
    let rebuilt = build_uncompressed_tiff(
        little_endian,
        width,
        height,
        spp,
        &bits,
        &sample_format,
        photometric,
        predictor,
        &raster,
    );
    let mut d = Decoder::new(Cursor::new(rebuilt.as_slice()))
        .map_err(|e| DecodeError::new(&format!("ZSTD: rebuilt decoder: {}", e)))?;
    d.read_image()
        .map_err(|e| DecodeError::new(&format!("ZSTD: rebuilt read_image: {}", e)))
}

/// Decode chunky, strip-based **floating-point** samples that use TIFF
/// predictor 3, which neither `try_decode_general_strips_tiles` (planar or
/// tiled-LZW only, <=16bpp) nor `try_decode_uncompressed_strips` (predictor 1
/// only) accepts. Before this existed, every float TIFF written by the common
/// encoders — Deflate + predictor 3 is what GDAL, libtiff and most scientific
/// tools emit — fell through to the `tiff` crate's monolithic `read_image()`.
///
/// Predictor 3 stores each row as byte planes: all the most-significant bytes
/// of the row's samples, then all the second bytes, and so on, with horizontal
/// differencing applied across the whole byte sequence. Reconstruction is
/// therefore an accumulate pass followed by a de-planarize pass, both per row.
///
/// Each strip is decompressed and un-predicted independently of every other
/// strip, which is what makes this shape parallelizable: `first_strip`/
/// `strip_count` let a caller decode a sub-range without touching the rest.
#[allow(clippy::too_many_arguments)]
/// Geometry needed to decode a range of predictor-3 float strips without
/// re-parsing the IFD. Split out from `try_decode_float_predictor_strips` so a
/// caller can decode strips `[first, first + count)` on its own thread with
/// nothing but the compressed bytes for that range.
#[derive(Clone, Debug)]
pub struct FloatStripPlan {
    pub width: u32,
    pub height: u32,
    pub channels: u32,
    pub bits_per_sample: u32,
    pub compression: u32,
    /// 1 = none, 2 = horizontal, 3 = floating-point.
    pub predictor: u32,
    /// TIFF SampleFormat: 1 = uint, 2 = int, 3 = float.
    pub sample_format: u32,
    /// File byte order, which is how predictor 1 and 2 samples are stored.
    /// Predictor 3 always reassembles to big-endian regardless.
    pub little_endian: bool,
    pub rows_per_strip: u32,
    pub offsets: Vec<u64>,
    pub counts: Vec<u64>,
}

impl FloatStripPlan {
    pub fn strip_count(&self) -> usize {
        self.offsets.len()
    }
    pub fn row_bytes(&self) -> usize {
        (self.width as usize) * (self.channels as usize) * (self.bits_per_sample as usize / 8)
    }
    /// First image row covered by `strip`.
    pub fn first_row(&self, strip: usize) -> usize {
        strip * self.rows_per_strip as usize
    }
    /// Rows actually covered by `strip` (the last strip may be short).
    pub fn rows_in(&self, strip: usize) -> usize {
        let first = self.first_row(strip);
        if first >= self.height as usize {
            0
        } else {
            (self.rows_per_strip as usize).min(self.height as usize - first)
        }
    }
}

/// Read the tags describing a predictor-3 float strip layout, or `None` when
/// this file is not that shape. Same guards as
/// `try_decode_float_predictor_strips`, which is built on top of it.
#[allow(clippy::too_many_arguments)]
pub(crate) fn float_predictor_plan(
    data: &[u8],
    decoder: &mut Decoder<Cursor<&[u8]>>,
    width: u32,
    height: u32,
    channels: u32,
    bits_per_sample: u32,
    compression: u32,
    predictor: u32,
    planar_configuration: u32,
) -> Option<FloatStripPlan> {
    use tiff::tags::Tag;

    if planar_configuration != 1 || !matches!(predictor, 1..=3) {
        return None;
    }
    // Byte-aligned widths only. Sub-byte and 9..15-bit shapes have their own
    // dedicated paths (try_decode_subbit_strips) and are not worth duplicating.
    if !matches!(bits_per_sample, 8 | 16 | 32 | 64) {
        return None;
    }
    if !matches!(compression, 1 | 5 | 8 | 32946) {
        return None;
    }
    let sample_format = decoder
        .get_tag_u64_vec(Tag::SampleFormat)
        .ok()
        .and_then(|values| values.first().copied())
        .unwrap_or(1) as u32;
    // Predictor 3 is defined only for floating-point samples. Half floats are
    // included: the byte-plane form is width-agnostic, so 16-bit works exactly
    // like 32- and 64-bit.
    if predictor == 3 && (sample_format != 3 || !matches!(bits_per_sample, 16 | 32 | 64)) {
        return None;
    }
    if decoder.get_tag_u64_vec(Tag::TileOffsets).is_ok() {
        return None;
    }
    let little_endian = tiff_is_little_endian(data)?;
    let offsets = match decoder.get_tag_u64_vec(Tag::StripOffsets) {
        Ok(value) if !value.is_empty() => value,
        _ => return None,
    };
    let counts = match decoder.get_tag_u64_vec(Tag::StripByteCounts) {
        Ok(value) if value.len() == offsets.len() => value,
        _ => return None,
    };
    let rows_per_strip = decoder
        .get_tag_u64_vec(Tag::RowsPerStrip)
        .ok()
        .and_then(|values| values.first().copied())
        .unwrap_or(height as u64);
    if rows_per_strip == 0 {
        return None;
    }
    Some(FloatStripPlan {
        width,
        height,
        channels,
        bits_per_sample,
        compression,
        predictor,
        sample_format,
        little_endian,
        rows_per_strip: rows_per_strip as u32,
        offsets,
        counts,
    })
}

/// Decompress and un-predict one strip into `out`, which must be exactly
/// `rows * row_bytes` long. This is the whole per-strip unit of work: it reads
/// only `block` and writes only `out`, so strips can be processed in any order,
/// on any thread, with no shared state.
pub(crate) fn decode_float_predictor_strip(
    block: &[u8],
    plan: &FloatStripPlan,
    rows: usize,
    out: &mut [u8],
) -> Result<(), DecodeError> {
    let row_bytes = plan.row_bytes();
    let bytes_per_sample = plan.bits_per_sample as usize / 8;
    let samples_per_row = (plan.width as usize) * (plan.channels as usize);
    let expected = rows * row_bytes;

    let mut decompressed =
        decompress_strip_or_tile(block, plan.compression, expected, "Strip decode")?;
    if decompressed.len() < expected {
        return Err(DecodeError::new(
            "Strip decode: strip shorter than its declared geometry",
        ));
    }
    decompressed.truncate(expected);

    for row in 0..rows {
        let row_start = row * row_bytes;
        let row_slice = &mut decompressed[row_start..row_start + row_bytes];
        let dst = &mut out[row_start..row_start + row_bytes];

        match plan.predictor {
            // No predictor: the row is already the sample bytes.
            1 => dst.copy_from_slice(row_slice),

            // Horizontal differencing, applied per SAMPLE (not per byte), so it
            // must be undone in the sample's own width and byte order.
            2 => {
                undo_horizontal_predictor_row(
                    row_slice,
                    samples_per_row,
                    plan.channels as usize,
                    bytes_per_sample,
                    plan.little_endian,
                );
                dst.copy_from_slice(row_slice);
            }

            // Floating-point predictor: differencing runs over the row's raw
            // bytes, and the row is stored as byte planes (all MSBs, then all
            // second bytes, ...). Undo the differencing, then de-planarize.
            _ => {
                for i in 1..row_bytes {
                    row_slice[i] = row_slice[i].wrapping_add(row_slice[i - 1]);
                }
                for sample in 0..samples_per_row {
                    for byte in 0..bytes_per_sample {
                        dst[sample * bytes_per_sample + byte] =
                            row_slice[byte * samples_per_row + sample];
                    }
                }
            }
        }
    }
    Ok(())
}

/// Undo TIFF predictor 2 for one row, in place, for byte-aligned sample widths.
/// Each sample is added to the sample `channels` positions earlier, wrapping at
/// the sample width, and samples are stored in the file's byte order.
fn undo_horizontal_predictor_row(
    row: &mut [u8],
    samples_per_row: usize,
    channels: usize,
    bytes_per_sample: usize,
    little_endian: bool,
) {
    macro_rules! undo {
        ($ty:ty, $read:path, $write:path, $n:expr) => {{
            for index in channels..samples_per_row {
                let cur_at = index * $n;
                let prev_at = (index - channels) * $n;
                let mut cur_bytes = [0u8; $n];
                let mut prev_bytes = [0u8; $n];
                cur_bytes.copy_from_slice(&row[cur_at..cur_at + $n]);
                prev_bytes.copy_from_slice(&row[prev_at..prev_at + $n]);
                let sum = <$ty>::wrapping_add($read(cur_bytes), $read(prev_bytes));
                row[cur_at..cur_at + $n].copy_from_slice(&$write(sum));
            }
        }};
    }
    match (bytes_per_sample, little_endian) {
        (1, _) => {
            for index in channels..samples_per_row {
                row[index] = row[index].wrapping_add(row[index - channels]);
            }
        }
        (2, true) => undo!(u16, u16::from_le_bytes, u16::to_le_bytes, 2),
        (2, false) => undo!(u16, u16::from_be_bytes, u16::to_be_bytes, 2),
        (4, true) => undo!(u32, u32::from_le_bytes, u32::to_le_bytes, 4),
        (4, false) => undo!(u32, u32::from_be_bytes, u32::to_be_bytes, 4),
        (8, true) => undo!(u64, u64::from_le_bytes, u64::to_le_bytes, 8),
        (8, false) => undo!(u64, u64::from_be_bytes, u64::to_be_bytes, 8),
        _ => {}
    }
}

/// Reassemble decoded sample bytes into f32.
///
/// Predictor 3 leaves samples big-endian (the byte planes are MSB-first by
/// definition); predictors 1 and 2 leave them in the file's byte order.
/// IEEE 754 binary16 -> binary32. Written out rather than pulling in `half`,
/// which is only an indirect dependency here.
#[inline]
fn half_bits_to_f32(bits: u16) -> f32 {
    let sign = ((bits >> 15) as u32) << 31;
    let exponent = ((bits >> 10) & 0x1f) as u32;
    let mantissa = (bits & 0x3ff) as u32;
    let out = match exponent {
        // Zero and subnormals: renormalize into a binary32 exponent.
        0 => {
            if mantissa == 0 {
                sign
            } else {
                let shift = mantissa.leading_zeros() - 21;
                let exponent = 127 - 15 - shift;
                let mantissa = (mantissa << (shift + 1)) & 0x3ff;
                sign | (exponent << 23) | (mantissa << 13)
            }
        }
        // Infinity and NaN.
        31 => sign | 0x7f80_0000 | (mantissa << 13),
        _ => sign | ((exponent + 127 - 15) << 23) | (mantissa << 13),
    };
    f32::from_bits(out)
}

pub(crate) fn strip_bytes_to_f32(raster: &[u8], plan: &FloatStripPlan) -> Vec<f32> {
    let big_endian = plan.predictor == 3 || !plan.little_endian;
    let bytes_per_sample = plan.bits_per_sample as usize / 8;

    macro_rules! map {
        ($n:expr, $conv:expr) => {
            raster
                .chunks_exact($n)
                .map(|b| {
                    let mut arr = [0u8; $n];
                    arr.copy_from_slice(b);
                    if big_endian {
                        arr.reverse();
                    }
                    // `arr` is now little-endian; $conv reads it as such.
                    #[allow(clippy::redundant_closure_call)]
                    ($conv)(arr)
                })
                .collect()
        };
    }

    match (bytes_per_sample, plan.sample_format) {
        (1, 2) => raster.iter().map(|v| *v as i8 as f32).collect(),
        (1, _) => raster.iter().map(|v| *v as f32).collect(),
        (2, 3) => map!(2, |a| half_bits_to_f32(u16::from_le_bytes(a))),
        (2, 2) => map!(2, |a| i16::from_le_bytes(a) as f32),
        (2, _) => map!(2, |a| u16::from_le_bytes(a) as f32),
        (4, 3) => map!(4, f32::from_le_bytes),
        (4, 2) => map!(4, |a| i32::from_le_bytes(a) as f32),
        (4, _) => map!(4, |a| u32::from_le_bytes(a) as f32),
        (8, 3) => map!(8, |a| f64::from_le_bytes(a) as f32),
        (8, 2) => map!(8, |a| i64::from_le_bytes(a) as f32),
        (8, _) => map!(8, |a| u64::from_le_bytes(a) as f32),
        _ => Vec::new(),
    }
}

/// Decode chunky, strip-based **floating-point** samples that use TIFF
/// predictor 3, which neither `try_decode_general_strips_tiles` (planar or
/// tiled-LZW only, <=16bpp) nor `try_decode_uncompressed_strips` (predictor 1
/// only) accepts. Before this existed, every float TIFF written by the common
/// encoders — Deflate + predictor 3 is what GDAL, libtiff and most scientific
/// tools emit — fell through to the `tiff` crate's monolithic `read_image()`.
///
/// Predictor 3 stores each row as byte planes: all the most-significant bytes
/// of the row's samples, then all the second bytes, and so on, with horizontal
/// differencing applied across the whole byte sequence.
///
/// Each strip is independent, which is what makes this parallelizable; see
/// `float_predictor_plan` + `decode_float_predictor_strip` for the split form.
#[allow(clippy::too_many_arguments)]
pub(crate) fn try_decode_float_predictor_strips(
    data: &[u8],
    decoder: &mut Decoder<Cursor<&[u8]>>,
    width: u32,
    height: u32,
    channels: u32,
    bits_per_sample: u32,
    compression: u32,
    predictor: u32,
    planar_configuration: u32,
) -> Result<Option<DecodingResult>, DecodeError> {
    let plan = match float_predictor_plan(
        data,
        decoder,
        width,
        height,
        channels,
        bits_per_sample,
        compression,
        predictor,
        planar_configuration,
    ) {
        Some(plan) => plan,
        None => return Ok(None),
    };
    // The plan is broader than this function: it also describes predictor 1 and
    // 2 layouts and 16-bit floats, which the strip-parallel API handles. The
    // reassembly below reads big-endian f32/f64, so anything else must be
    // declined here or it would silently reinterpret the bytes.
    if plan.predictor != 3 || !matches!(plan.bits_per_sample, 32 | 64) {
        return Ok(None);
    }

    let row_bytes = plan.row_bytes();
    let total_bytes = row_bytes
        .checked_mul(height as usize)
        .ok_or_else(|| DecodeError::new("Float predictor decode: raster byte count overflow"))?;
    let mut raster = vec![0u8; total_bytes];

    for strip in 0..plan.strip_count() {
        let rows = plan.rows_in(strip);
        if rows == 0 {
            break;
        }
        let start = plan.offsets[strip] as usize;
        let end = match start.checked_add(plan.counts[strip] as usize) {
            Some(value) if value <= data.len() => value,
            _ => return Ok(None),
        };
        let out_start = plan.first_row(strip) * row_bytes;
        decode_float_predictor_strip(
            &data[start..end],
            &plan,
            rows,
            &mut raster[out_start..out_start + rows * row_bytes],
        )?;
    }

    Ok(Some(if bits_per_sample == 32 {
        DecodingResult::F32(
            raster
                .chunks_exact(4)
                .map(|b| f32::from_be_bytes([b[0], b[1], b[2], b[3]]))
                .collect(),
        )
    } else {
        DecodingResult::F64(
            raster
                .chunks_exact(8)
                .map(|b| f64::from_be_bytes([b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]]))
                .collect(),
        )
    }))
}

