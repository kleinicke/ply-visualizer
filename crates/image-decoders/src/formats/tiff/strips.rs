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

#[allow(clippy::too_many_arguments)] // The TIFF metadata is passed through from the caller unchanged.
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
    if bits_per_sample == 0 || !bits_per_sample.is_multiple_of(8) {
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
    decompress_block(block, compression, expected_len, context, None)
}

// The typed fields are read only by the LERC/JPEG 2000/JPEG XR block
// decoders, which the core build leaves out; the struct itself is still needed
// by every caller of `decompress_block`.
#[cfg_attr(
    not(any(
        feature = "codec-lerc",
        feature = "codec-jpeg2000",
        feature = "codec-jpegxr",
        feature = "jxl"
    )),
    allow(dead_code)
)]
/// How the samples in a block are laid out, for the codecs that decode to
/// TYPED values rather than to the file's raw bytes. LERC and PNG both hand
/// back numbers of a known type; turning those back into a TIFF strip means
/// writing them in the file's own byte order and width, which the byte-in,
/// byte-out codecs (LZW, Deflate, ZSTD, LZMA) never need to know.
#[derive(Clone, Debug)]
pub(crate) struct BlockCodecInfo {
    pub bits_per_sample: u32,
    /// TIFF SampleFormat: 1 = uint, 2 = int, 3 = float.
    pub sample_format: u32,
    pub little_endian: bool,
    /// TIFF tag 50674 (LercParameters), second value: an extra codec applied
    /// on top of the LERC blob. 0 = none, 1 = Deflate, 2 = ZSTD.
    #[cfg_attr(not(feature = "codec-lerc"), allow(dead_code))]
    pub lerc_additional_compression: u32,
    /// PhotometricInterpretation 6: the block's samples are YCbCr and have to
    /// be converted on the way out. Only the codecs that carry colour
    /// themselves (JPEG 2000) consult this.
    #[cfg_attr(not(feature = "codec-jpeg2000"), allow(dead_code))]
    pub ycbcr: bool,
    /// `JPEGTables` for compression 7; empty when the blocks are complete streams.
    pub jpeg_tables: Vec<u8>,
}

/// `decompress_strip_or_tile` plus the layout the typed codecs need. Callers
/// that can meet a LERC or PNG block must pass `info`; the others may pass
/// `None` and get a clear error rather than a wrong picture if such a block
/// turns up anyway.
pub(crate) fn decompress_block(
    block: &[u8],
    compression: u32,
    expected_len: usize,
    context: &str,
    info: Option<&BlockCodecInfo>,
) -> Result<Vec<u8>, DecodeError> {
    use std::io::Read;

    match compression {
        1 => Ok(block.to_vec()),
        5 => crate::formats::compression::decode_tiff_lzw(block, expected_len, context),
        7 => decode_jpeg_block(block, expected_len, context, info),
        8 | 32946 => crate::formats::compression::inflate_zlib(block, expected_len, context),
        // ZSTD, via the pure-Rust ruzstd crate so the WASM build needs no C
        // toolchain. A single strip or tile is one complete zstd frame; GDAL
        // writes exactly one frame per block, but concatenated frames are legal
        // so the decoder is re-created until the input is consumed.
        50000 => {
            let mut buf = Vec::with_capacity(expected_len);
            let mut rest = block;
            while !rest.is_empty() && buf.len() < expected_len {
                let mut cursor = std::io::Cursor::new(rest);
                let mut dec =
                    ruzstd::decoding::StreamingDecoder::new(&mut cursor).map_err(|e| {
                        DecodeError::new(format!("{}: ZSTD decoder init failed: {:?}", context, e))
                    })?;
                dec.read_to_end(&mut buf).map_err(|e| {
                    DecodeError::new(format!("{}: ZSTD decode failed: {:?}", context, e))
                })?;
                let consumed = cursor.position() as usize;
                if consumed == 0 || consumed > rest.len() {
                    break;
                }
                rest = &rest[consumed..];
            }
            Ok(buf)
        }
        // LZMA. libtiff and tifffile both write each strip/tile as a
        // standalone .xz stream (magic FD 37 7A 58 5A 00), not a bare LZMA1
        // chunk, so this is the xz entry point.
        #[cfg(feature = "codec-lzma")]
        34925 => {
            let mut out = Vec::with_capacity(expected_len);
            // libtiff applies an XZ delta filter before LZMA2 when its TIFF
            // predictor option is enabled. `lzma-rs` only understands a bare
            // LZMA2 filter and rejected those perfectly valid streams with
            // "Unknown filter id 3". xz4rust supports the standard XZ filter
            // chain (including delta) and remains pure Rust/WASM-compatible.
            // XzReader owns its std::io::Read source. A TIFF block is already
            // bounded and in memory, so give the reader an owned buffer. Cap
            // the declared dictionary at XZ preset 9's 64 MiB: the default
            // reader permits a hostile stream to request roughly 3 GiB, and
            // eagerly starts every strip with a wasteful 16 MiB allocation.
            let xz = xz4rust::XzDecoder::in_heap_with_alloc_dict_size(
                xz4rust::DICT_SIZE_MIN,
                64 * 1024 * 1024,
            );
            let mut decoder = xz4rust::XzReader::new_with_buffer_size_and_decoder(
                std::io::Cursor::new(block.to_vec()),
                std::num::NonZeroUsize::new(8192).unwrap(),
                xz,
            );
            decoder
                .read_to_end(&mut out)
                .map_err(|e| DecodeError::new(format!("{}: LZMA decode failed: {}", context, e)))?;
            Ok(out)
        }
        #[cfg(not(feature = "codec-lzma"))]
        34925 => Err(crate::formats::external_codec::needed("LZMA", context)),
        // PNG-in-TIFF: every block is a complete PNG stream covering exactly
        // that strip or tile.
        34933 => decode_png_block(
            block,
            expected_len,
            context,
            codec_info(info, context, "PNG")?,
        ),
        // LERC, including GDAL's LERC_DEFLATE and LERC_ZSTD, which wrap the
        // same blob in a second codec named by tag 50674.
        #[cfg(feature = "codec-lerc")]
        34887 => decode_lerc_block(
            block,
            expected_len,
            context,
            codec_info(info, context, "LERC")?,
        ),
        #[cfg(not(feature = "codec-lerc"))]
        34887 => Err(crate::formats::external_codec::needed("LERC", context)),
        // JPEG XR. 22610 is the code Hamamatsu NDPI files use.
        #[cfg(feature = "codec-jpegxr")]
        34934 | 22610 => decode_jpegxr_block(
            block,
            expected_len,
            context,
            codec_info(info, context, "JPEG XR")?,
        ),
        #[cfg(not(feature = "codec-jpegxr"))]
        34934 | 22610 => Err(crate::formats::external_codec::needed("JPEG XR", context)),
        // JPEG 2000. 34712 is the registered code; 33003/33004/33005 are what
        // Aperio slide scanners write (YCbCr, lossy, and RGB respectively).
        #[cfg(feature = "codec-jpeg2000")]
        34712 | 33003 | 33004 | 33005 => decode_jpeg2000_block(
            block,
            expected_len,
            context,
            codec_info(info, context, "JPEG 2000")?,
        ),
        #[cfg(not(feature = "codec-jpeg2000"))]
        34712 | 33003 | 33004 | 33005 => {
            Err(crate::formats::external_codec::needed("JPEG 2000", context))
        }
        // JPEG XL in TIFF, registered as compression 50002. It lives in the
        // separate lazy JXL module, which builds this same container parser.
        #[cfg(feature = "jxl")]
        50002 => decode_jxl_block(
            block,
            expected_len,
            context,
            codec_info(info, context, "JPEG XL")?,
        ),
        #[cfg(not(feature = "jxl"))]
        50002 => Err(crate::formats::external_codec::needed("JPEG XL", context)),
        _ => Err(DecodeError::new(format!(
            "{}: compression {} is not supported",
            context, compression
        ))),
    }
}

#[cfg(feature = "jxl")]
fn decode_jxl_block(
    block: &[u8],
    expected_len: usize,
    context: &str,
    info: &BlockCodecInfo,
) -> Result<Vec<u8>, DecodeError> {
    let decoded = crate::formats::jxl::decode_jxl_impl(block)?;
    let bytes_per_sample = (info.bits_per_sample as usize).div_ceil(8);
    if decoded.data.len().saturating_mul(bytes_per_sample) != expected_len {
        return Err(DecodeError::new(format!(
            "{}: JPEG XL decoded {} samples, but the TIFF block needs {} bytes of {}-bit samples",
            context,
            decoded.data.len(),
            expected_len,
            info.bits_per_sample
        )));
    }
    if decoded.sample_format != info.sample_format
        || decoded.bits_per_sample != info.bits_per_sample
    {
        return Err(DecodeError::new(format!(
            "{}: JPEG XL is sample format {}/{}-bit, TIFF declares {}/{}-bit",
            context,
            decoded.sample_format,
            decoded.bits_per_sample,
            info.sample_format,
            info.bits_per_sample
        )));
    }

    let mut out = Vec::with_capacity(expected_len);
    match (info.sample_format, info.bits_per_sample) {
        (1, 8) => out.extend(decoded.data.iter().map(|&value| value as u8)),
        (1, 16) => {
            for value in decoded.data {
                out.extend_from_slice(&to_file_order_2(value as u16, info.little_endian));
            }
        }
        (3, 32) => {
            for value in decoded.data {
                out.extend_from_slice(&to_file_order_4(value.to_bits(), info.little_endian));
            }
        }
        _ => {
            return Err(DecodeError::new(format!(
                "{}: JPEG XL TIFF samples {}/{}-bit are not supported",
                context, info.sample_format, info.bits_per_sample
            )))
        }
    }
    Ok(out)
}

/// A typed codec cannot run without knowing the sample layout; a caller that
/// did not supply one has a bug, and saying so beats decoding garbage.
fn codec_info<'a>(
    info: Option<&'a BlockCodecInfo>,
    context: &str,
    codec: &str,
) -> Result<&'a BlockCodecInfo, DecodeError> {
    info.ok_or_else(|| {
        DecodeError::new(format!(
            "{}: {} blocks need the sample layout, which this path does not have",
            context, codec
        ))
    })
}

/// Decode one JPEG-compressed strip/tile (compression 7) to interleaved
/// 8-bit samples. The block is completed with the plan's `JPEGTables` when it
/// carries any; zune-jpeg converts YCbCr to RGB, as the whole-image path does.
fn decode_jpeg_block(
    block: &[u8],
    expected_len: usize,
    context: &str,
    info: Option<&BlockCodecInfo>,
) -> Result<Vec<u8>, DecodeError> {
    let tables = info
        .map(|info| info.jpeg_tables.as_slice())
        .filter(|tables| !tables.is_empty());
    let jpeg = super::codecs::build_jpeg(tables, block);
    let mut decoder = zune_jpeg::JpegDecoder::new(Cursor::new(jpeg));
    let pixels = decoder
        .decode()
        .map_err(|e| DecodeError::new(format!("{context}: JPEG decode failed: {e:?}")))?;
    if pixels.len() < expected_len {
        return Err(DecodeError::new(format!(
            "{}: JPEG block holds {} bytes, expected {}",
            context,
            pixels.len(),
            expected_len
        )));
    }
    Ok(pixels)
}

/// Decode one PNG-compressed strip/tile. The PNG crate returns 16-bit samples
/// big-endian (PNG's own order); a little-endian TIFF wants them the other way
/// round, so they are swapped back into the file's order.
fn decode_png_block(
    block: &[u8],
    expected_len: usize,
    context: &str,
    info: &BlockCodecInfo,
) -> Result<Vec<u8>, DecodeError> {
    let mut decoder = png::Decoder::new(block);
    // Keep the samples exactly as stored: no palette expansion, no
    // 1/2/4-bit widening. A TIFF strip must come back with the geometry the
    // IFD promised, and any expansion here would change its stride.
    decoder.set_transformations(png::Transformations::IDENTITY);
    let mut reader = decoder
        .read_info()
        .map_err(|e| DecodeError::new(format!("{}: PNG header: {}", context, e)))?;
    let mut buffer = vec![0u8; reader.output_buffer_size()];
    let frame = reader
        .next_frame(&mut buffer)
        .map_err(|e| DecodeError::new(format!("{}: PNG decode failed: {}", context, e)))?;
    buffer.truncate(frame.buffer_size());
    if info.bits_per_sample == 16 && info.little_endian {
        for pair in buffer.chunks_exact_mut(2) {
            pair.swap(0, 1);
        }
    }
    if buffer.len() < expected_len {
        return Err(DecodeError::new(format!(
            "{}: PNG block holds {} bytes, expected {}",
            context,
            buffer.len(),
            expected_len
        )));
    }
    Ok(buffer)
}

#[cfg(feature = "codec-lerc")]
/// Decode one LERC-compressed strip/tile.
///
/// LERC is a *value* codec: it hands back numbers, with a validity mask and a
/// declared maximum error, not the strip's bytes. Re-serializing them in the
/// file's own sample type and byte order lets the rest of the block path treat
/// a LERC tile exactly like any other. Values the blob marks invalid are
/// written as zero, which is how libtiff's own LERC codec reads them back:
/// the TIFF encoder always marks every pixel valid, so a mask only appears in
/// blobs that came from somewhere else.
fn decode_lerc_block(
    block: &[u8],
    expected_len: usize,
    context: &str,
    info: &BlockCodecInfo,
) -> Result<Vec<u8>, DecodeError> {
    use std::io::Read;

    // GDAL's LERC_DEFLATE / LERC_ZSTD put a second codec around the blob.
    let blob = match info.lerc_additional_compression {
        0 => std::borrow::Cow::Borrowed(block),
        1 => {
            let mut inflated = Vec::new();
            flate2::read::ZlibDecoder::new(block)
                .read_to_end(&mut inflated)
                .map_err(|e| {
                    DecodeError::new(format!("{}: LERC Deflate wrapper failed: {}", context, e))
                })?;
            std::borrow::Cow::Owned(inflated)
        }
        2 => std::borrow::Cow::Owned(decompress_strip_or_tile(
            block,
            50000,
            expected_len,
            context,
        )?),
        other => {
            return Err(DecodeError::new(format!(
                "{}: LERC additional compression {} is not supported",
                context, other
            )))
        }
    };

    let decoded = lerc_reader::decode_to_f64(&blob)
        .map_err(|e| DecodeError::new(format!("{}: LERC decode failed: {}", context, e)))?;
    #[allow(clippy::manual_div_ceil)] // The u32 tag plus 7 may overflow on wasm32.
    let bytes_per_sample = (info.bits_per_sample as usize + 7) / 8;
    if decoded.pixels.len().saturating_mul(bytes_per_sample) < expected_len {
        return Err(DecodeError::new(format!(
            "{}: LERC block holds {} samples ({} bytes), expected {}",
            context,
            decoded.pixels.len(),
            decoded.pixels.len() * bytes_per_sample,
            expected_len
        )));
    }

    let mut out = Vec::with_capacity(decoded.pixels.len() * bytes_per_sample);
    let mask = decoded.mask.as_deref();
    let depth = decoded.info.depth.max(1) as usize;
    for (index, value) in decoded.pixels.iter().enumerate() {
        // The mask is one byte per PIXEL; a multi-band blob stores `depth`
        // values per pixel, so several samples share one mask entry.
        let valid = mask.is_none_or(|m| m.get(index / depth).copied().unwrap_or(1) != 0);
        let value = if valid { *value } else { 0.0 };
        match (info.sample_format, info.bits_per_sample) {
            (3, 32) => out.extend_from_slice(&to_file_order_4(
                (value as f32).to_bits(),
                info.little_endian,
            )),
            (3, 64) => {
                let bits = value.to_bits();
                if info.little_endian {
                    out.extend_from_slice(&bits.to_le_bytes());
                } else {
                    out.extend_from_slice(&bits.to_be_bytes());
                }
            }
            (2, 8) => out.push((value as i8) as u8),
            (2, 16) => {
                out.extend_from_slice(&to_file_order_2((value as i16) as u16, info.little_endian))
            }
            (2, 32) => {
                out.extend_from_slice(&to_file_order_4((value as i32) as u32, info.little_endian))
            }
            (_, 8) => out.push(value as u8),
            (_, 16) => out.extend_from_slice(&to_file_order_2(value as u16, info.little_endian)),
            (_, 32) => out.extend_from_slice(&to_file_order_4(value as u32, info.little_endian)),
            (format, bits) => {
                return Err(DecodeError::new(format!(
                    "{}: LERC with sample format {} at {} bits is not supported",
                    context, format, bits
                )))
            }
        }
    }
    Ok(out)
}

#[cfg(feature = "codec-jpeg2000")]
/// Decode one JPEG 2000-compressed strip/tile.
///
/// `decode_native` is deliberate: this crate's other entry point returns 8-bit
/// RGBA for display, which would silently throw away half of a 16-bit
/// scientific image.
fn decode_jpeg2000_block(
    block: &[u8],
    expected_len: usize,
    context: &str,
    info: &BlockCodecInfo,
) -> Result<Vec<u8>, DecodeError> {
    let settings = dicom_toolkit_jpeg2000::DecodeSettings::default();
    let image = dicom_toolkit_jpeg2000::Image::new(block, &settings)
        .map_err(|e| DecodeError::new(format!("{}: JPEG 2000 header: {:?}", context, e)))?;
    let raw = image
        .decode_native()
        .map_err(|e| DecodeError::new(format!("{}: JPEG 2000 decode failed: {:?}", context, e)))?;
    let mut data = raw.data;

    // An Aperio 33003 block holds YCbCr, which the codestream does not convert
    // for us; the TIFF says so through PhotometricInterpretation 6.
    if info.ycbcr && raw.num_components >= 3 && raw.bytes_per_sample == 1 {
        ycbcr_to_rgb_in_place(&mut data, raw.num_components as usize);
    }

    // The crate returns native little-endian samples; a big-endian TIFF wants
    // them the other way round.
    if raw.bytes_per_sample == 2 && !info.little_endian {
        for pair in data.chunks_exact_mut(2) {
            pair.swap(0, 1);
        }
    }
    if data.len() < expected_len {
        return Err(DecodeError::new(format!(
            "{}: JPEG 2000 block holds {} bytes, expected {}",
            context,
            data.len(),
            expected_len
        )));
    }
    Ok(data)
}

#[cfg(feature = "codec-jpegxr")]
/// Decode one JPEG XR-compressed strip/tile.
///
/// The decoder returns rows padded to its own stride and samples in the
/// machine's little-endian order; a TIFF strip is neither padded nor
/// necessarily little-endian.
fn decode_jpegxr_block(
    block: &[u8],
    expected_len: usize,
    context: &str,
    info: &BlockCodecInfo,
) -> Result<Vec<u8>, DecodeError> {
    let decoded = crate::formats::jpegxr::decode_jpegxr_pixels(block, context)?;
    let bytes_per_sample = (decoded.bits_per_sample as usize).div_ceil(8);
    let mut data = decoded.pixels;
    if bytes_per_sample > 1 && !info.little_endian {
        for sample in data.chunks_exact_mut(bytes_per_sample) {
            sample.reverse();
        }
    }
    if data.len() < expected_len {
        return Err(DecodeError::new(format!(
            "{}: JPEG XR block holds {} bytes, expected {}",
            context,
            data.len(),
            expected_len
        )));
    }
    Ok(data)
}

#[cfg_attr(
    not(any(
        feature = "codec-lerc",
        feature = "codec-jpeg2000",
        feature = "codec-jpegxr",
        feature = "jxl"
    )),
    allow(dead_code)
)]
/// CCIR 601-1 / JFIF inverse transform, in place over interleaved 8-bit
/// samples. The same coefficients the subsampled-YCbCr path uses, which is
/// what TIFF 6.0 specifies for the default YCbCrCoefficients.
#[cfg_attr(not(feature = "codec-jpeg2000"), allow(dead_code))]
fn ycbcr_to_rgb_in_place(data: &mut [u8], channels: usize) {
    for pixel in data.chunks_exact_mut(channels) {
        let y = pixel[0] as f32;
        let cb = pixel[1] as f32 - 128.0;
        let cr = pixel[2] as f32 - 128.0;
        pixel[0] = (y + 1.402 * cr).clamp(0.0, 255.0) as u8;
        pixel[1] = (y - 0.344_136 * cb - 0.714_136 * cr).clamp(0.0, 255.0) as u8;
        pixel[2] = (y + 1.772 * cb).clamp(0.0, 255.0) as u8;
    }
}

#[cfg_attr(
    not(any(
        feature = "codec-lerc",
        feature = "codec-jpeg2000",
        feature = "codec-jpegxr",
        feature = "jxl"
    )),
    allow(dead_code)
)]
fn to_file_order_2(value: u16, little_endian: bool) -> [u8; 2] {
    if little_endian {
        value.to_le_bytes()
    } else {
        value.to_be_bytes()
    }
}

#[cfg_attr(
    not(any(
        feature = "codec-lerc",
        feature = "codec-jpeg2000",
        feature = "codec-jpegxr",
        feature = "jxl"
    )),
    allow(dead_code)
)]
fn to_file_order_4(value: u32, little_endian: bool) -> [u8; 4] {
    if little_endian {
        value.to_le_bytes()
    } else {
        value.to_be_bytes()
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
    if bits_per_sample.is_multiple_of(8) {
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
    let mask = if bits_per_sample >= 64 {
        u64::MAX
    } else {
        (1u64 << bits_per_sample) - 1
    };
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
        bit_buf &= if bit_count == 0 {
            0
        } else {
            (1u64 << bit_count) - 1
        };
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
    let mask = if bits_per_sample >= 64 {
        u64::MAX
    } else {
        (1u64 << bits_per_sample) - 1
    };
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
    // ZSTD is in this list because `decode_zstd` cannot help here: it rebuilds
    // the raster as an uncompressed TIFF, which the tiff crate then rejects for
    // a 9..=15-bit color type. Such files are routed straight to this path.
    if !matches!(compression, 1 | 5 | 8 | 32946 | 50000) {
        return Ok(None);
    }
    if decoder.get_tag_u64_vec(Tag::TileOffsets).is_ok() {
        return Err(DecodeError::new(
            "Sub-16-bit TIFF: tiled layout is not supported by the direct decode path",
        ));
    }
    if predictor != 1 && predictor != 2 {
        return Err(DecodeError::new(format!(
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
        return Err(DecodeError::new(format!(
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
    #[allow(clippy::manual_div_ceil)] // Packed-row multiplication and addition may overflow usize.
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
            return Err(DecodeError::new(format!(
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
        return Err(DecodeError::new(format!(
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
    // TILED ZSTD has no other handler: `decode_zstd` rebuilds a single-strip
    // TIFF and so only understands strip layouts, and the tiff crate's own
    // zstd support is a C dependency the WASM build cannot use. Cloud-optimized
    // GeoTIFFs are tiled by definition, so this is the common shape in the
    // wild. Strip ZSTD keeps using `decode_zstd`.
    //
    // LERC, LZMA, PNG-in-TIFF, JPEG 2000 and JPEG XR have no handler at all
    // outside this path — the tiff crate knows none of them — so every layout
    // of them is claimed here, strips included.
    let block_only_codec = matches!(
        compression,
        34887 | 34925 | 34933 | 34712 | 33003 | 33004 | 33005 | 34934 | 22610 | 50002
    );
    let claim = planar_configuration == 2
        || (is_tiled && matches!(compression, 5 | 50000))
        || block_only_codec
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

    if bits_per_sample == 0
        || bits_per_sample > 64
        || (bits_per_sample > 32 && bits_per_sample != 64)
    {
        return Err(DecodeError::new(format!(
            "{}: {}-bit samples are not supported",
            CTX, bits_per_sample
        )));
    }
    if !matches!(compression, 1 | 5 | 8 | 32946 | 50000) && !block_only_codec {
        return Err(DecodeError::new(format!(
            "{}: compression {} is not supported",
            CTX, compression
        )));
    }
    if !matches!(predictor, 1..=3) {
        return Err(DecodeError::new(format!(
            "{}: predictor {} is not supported",
            CTX, predictor
        )));
    }
    let fill_order = decoder.get_tag_u32(Tag::FillOrder).unwrap_or(1);
    if fill_order != 1 {
        return Err(DecodeError::new(format!(
            "{}: FillOrder 2 (LSB-first) is not supported",
            CTX
        )));
    }
    let sample_format = decoder
        .get_tag_u64_vec(Tag::SampleFormat)
        .ok()
        .and_then(|values| values.first().copied())
        .unwrap_or(1) as u32;
    // 1 = unsigned, 2 = signed, 3 = IEEE float. Half floats are real TIFF —
    // scientific data uses them — and every other path here already reads them
    // (`strip_bytes_to_f32`, `float_predictor_plan`, the ZSTD path). Leaving 16
    // out made a float16 image decode fine under LZW or ZSTD and fail under any
    // block-only codec, which is a difference no file property justifies.
    if !matches!(sample_format, 1..=3)
        || (sample_format == 3 && !matches!(bits_per_sample, 16 | 32 | 64))
    {
        return Err(DecodeError::new(format!(
            "{}: sample format {} at {} bits is not supported",
            CTX, sample_format, bits_per_sample
        )));
    }
    // Differencing a float sample as an integer would corrupt it: predictor 2
    // is defined for integer samples only, and predictor 3 (the floating-point
    // predictor, undone per block below) only for float ones.
    if sample_format == 3 && predictor == 2 {
        return Err(DecodeError::new(format!(
            "{}: horizontal predictor on float samples is not supported",
            CTX
        )));
    }
    if predictor == 3 && (sample_format != 3 || !matches!(bits_per_sample, 16 | 32 | 64)) {
        return Err(DecodeError::new(format!(
            "{}: the floating-point predictor is only supported on 16/32/64-bit float samples",
            CTX
        )));
    }
    // Multi-byte samples are stored in the file's byte order.
    let little_endian = data.first() == Some(&b'I');

    // Tag 50674 (LercParameters) is [version, additional compression]; the
    // second value names the codec GDAL wrapped the LERC blob in.
    let codec_info = BlockCodecInfo {
        bits_per_sample,
        sample_format,
        little_endian,
        lerc_additional_compression: decoder
            .get_tag_u32_vec(Tag::Unknown(50674))
            .ok()
            .and_then(|values| values.get(1).copied())
            .unwrap_or(0),
        ycbcr: decoder
            .get_tag_u32(Tag::PhotometricInterpretation)
            .map(|value| value == 6)
            .unwrap_or(false),
        jpeg_tables: Vec::new(),
    };

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
        let across = (width as u64).div_ceil(tile_width as u64);
        let down = (height as u64).div_ceil(tile_length as u64);
        (tile_width, tile_length, across as u32, down as u32, 0u32)
    } else {
        let rps = decoder
            .get_tag_u32(Tag::RowsPerStrip)
            .unwrap_or(height)
            .max(1);
        let down = (height as u64).div_ceil(rps as u64);
        (width, rps, 1u32, down as u32, rps)
    };
    let blocks_per_plane = (blocks_across as u64) * (blocks_down as u64);

    let offsets = (if is_tiled {
        decoder.get_tag_u64_vec(Tag::TileOffsets)
    } else {
        decoder.get_tag_u64_vec(Tag::StripOffsets)
    })
    .map_err(|e| DecodeError::new(format!("{}: missing offsets: {}", CTX, e)))?;
    let counts = (if is_tiled {
        decoder.get_tag_u64_vec(Tag::TileByteCounts)
    } else {
        decoder.get_tag_u64_vec(Tag::StripByteCounts)
    })
    .map_err(|e| DecodeError::new(format!("{}: missing byte counts: {}", CTX, e)))?;

    let expected_blocks = blocks_per_plane
        .checked_mul(planes as u64)
        .ok_or_else(|| DecodeError::new(format!("{}: block count overflow", CTX)))?;
    if offsets.len() as u64 != expected_blocks || counts.len() as u64 != expected_blocks {
        return Err(DecodeError::new(format!(
            "{}: expected {} strip/tile offsets, found {}",
            CTX,
            expected_blocks,
            offsets.len()
        )));
    }

    let samples_per_row = (block_width as usize) * (channels_per_block as usize);
    #[allow(clippy::manual_div_ceil)] // Packed-row multiplication and addition may overflow usize.
    let row_bytes = (samples_per_row * bits_per_sample as usize + 7) / 8;
    let mut out: Vec<u64> = vec![0u64; (width as usize) * (height as usize) * (channels as usize)];

    // Scratch buffers for the floating-point predictor, reused across rows.
    let mut fp_planes: Vec<u8> = Vec::new();
    let mut fp_samples: Vec<u8> = Vec::new();

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
                    return Err(DecodeError::new(format!(
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
                // A byte count of zero marks a block that was never written
                // (GDAL's SPARSE_OK). libtiff reads those as all-zero pixels,
                // and there is no compressed stream to hand to a codec.
                let decompressed = if count == 0 {
                    vec![0u8; expected_bytes]
                } else {
                    decompress_block(
                        block_bytes,
                        compression,
                        expected_bytes,
                        CTX,
                        Some(&codec_info),
                    )?
                };
                if decompressed.len() < expected_bytes {
                    return Err(DecodeError::new(format!(
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
                    // Predictor 3 stores each row as byte planes (all the
                    // samples' first bytes, then all their second bytes, ...)
                    // with the differencing applied across those raw bytes.
                    // Undoing it yields big-endian samples regardless of the
                    // file's byte order, which is why the unpack below is told
                    // so. Rows are independent, so a skipped padding row costs
                    // nothing here.
                    let (row, row_is_little_endian) = if predictor == 3 {
                        let bytes_per_sample = bits_per_sample as usize / 8;
                        fp_planes.clear();
                        fp_planes.extend_from_slice(row);
                        for i in 1..row_bytes {
                            fp_planes[i] = fp_planes[i].wrapping_add(fp_planes[i - 1]);
                        }
                        fp_samples.resize(row_bytes, 0);
                        for sample in 0..samples_per_row {
                            for byte in 0..bytes_per_sample {
                                fp_samples[sample * bytes_per_sample + byte] =
                                    fp_planes[byte * samples_per_row + sample];
                            }
                        }
                        (fp_samples.as_slice(), false)
                    } else {
                        (row, little_endian)
                    };
                    let mut row_values =
                        unpack_row_u64(row, samples_per_row, bits_per_sample, row_is_little_endian);

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
        // No F16 carrier exists, and none is wanted: everything downstream
        // reads half floats as f32 while still reporting 16 bits, which is what
        // the tiff crate's own half-float path produces.
        (3, 16) => DecodingResult::F32(
            out.into_iter()
                .map(|v| crate::formats::half::f16_to_f32(v as u16))
                .collect(),
        ),
        (3, 32) => DecodingResult::F32(out.into_iter().map(|v| f32::from_bits(v as u32)).collect()),
        (3, 64) => DecodingResult::F64(out.into_iter().map(f64::from_bits).collect()),
        (2, bits) => {
            // Sign-extend from the source width before widening.
            let shift = 64 - bits;
            let signed = out.into_iter().map(|v| ((v << shift) as i64) >> shift);
            if bits <= 8 {
                DecodingResult::I8(signed.map(|v| v as i8).collect())
            } else if bits <= 16 {
                DecodingResult::I16(signed.map(|v| v as i16).collect())
            } else {
                DecodingResult::I32(signed.map(|v| v as i32).collect())
            }
        }
        (_, bits) if bits <= 8 => DecodingResult::U8(out.into_iter().map(|v| v as u8).collect()),
        (_, bits) if bits <= 16 => DecodingResult::U16(out.into_iter().map(|v| v as u16).collect()),
        (_, bits) if bits <= 32 => DecodingResult::U32(out.into_iter().map(|v| v as u32).collect()),
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
    use tiff::tags::Tag;

    if decoder.get_tag_u64_vec(Tag::TileOffsets).is_ok() {
        return Err(DecodeError::new(
            "ZSTD: tiled TIFFs are handled by the block decoder, not here",
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
        .map_err(|e| DecodeError::new(format!("ZSTD: dimensions: {}", e)))?;
    let offsets = decoder
        .get_tag_u64_vec(Tag::StripOffsets)
        .map_err(|e| DecodeError::new(format!("ZSTD: StripOffsets: {}", e)))?;
    let counts = decoder
        .get_tag_u64_vec(Tag::StripByteCounts)
        .map_err(|e| DecodeError::new(format!("ZSTD: StripByteCounts: {}", e)))?;
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
    // Knowing each strip's decompressed size lets a strip that was never
    // written (byte count 0, GDAL's SPARSE_OK) be filled with zeros, the way
    // libtiff reads it.
    let rows_per_strip = decoder
        .get_tag_u32(Tag::RowsPerStrip)
        .unwrap_or(height)
        .max(1);
    let bits_per_pixel: u64 = bits.iter().map(|b| *b as u64).sum();
    #[allow(clippy::manual_div_ceil)] // Pixel-bit multiplication and addition may overflow u64.
    let row_bytes = ((width as u64 * bits_per_pixel + 7) / 8) as usize;
    let mut raster: Vec<u8> = Vec::new();
    for (index, (off, cnt)) in offsets.iter().zip(counts.iter()).enumerate() {
        let start = *off as usize;
        let end = start.saturating_add(*cnt as usize);
        if end > original.len() {
            return Err(DecodeError::new("ZSTD: strip byte range out of bounds"));
        }
        let first_row = (index as u64) * rows_per_strip as u64;
        let rows = (rows_per_strip as u64).min((height as u64).saturating_sub(first_row)) as usize;
        let expected = rows.saturating_mul(row_bytes);
        if *cnt == 0 {
            raster.resize(raster.len() + expected, 0);
            continue;
        }
        raster.extend_from_slice(&decompress_strip_or_tile(
            &original[start..end],
            50000,
            expected,
            "ZSTD",
        )?);
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
    // Unlimited, like every other decoder this crate builds: the tiff crate's
    // default caps the buffer it will allocate, and the rebuilt file is the
    // WHOLE image in one strip, so a large GeoTIFF failed here with "decoder
    // limits exceeded" while the same pixels decoded fine tiled.
    let mut d = Decoder::new(Cursor::new(rebuilt.as_slice()))
        .map_err(|e| DecodeError::new(format!("ZSTD: rebuilt decoder: {}", e)))?
        .with_limits(tiff::decoder::Limits::unlimited());
    d.read_image()
        .map_err(|e| DecodeError::new(format!("ZSTD: rebuilt read_image: {}", e)))
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
    /// TIFF PlanarConfiguration: 1 = chunky, 2 = one block per channel.
    pub planar_configuration: u32,
    /// TIFF Orientation tag. Range decoding produces stored rows; worker-side
    /// orchestration can transform each range directly into its final band.
    pub orientation: u32,
    /// Raw TIFF PhotometricInterpretation tag (1 gray, 2 RGB, 5 CMYK).
    pub photometric_interpretation: u32,
    /// File byte order, which is how predictor 1 and 2 samples are stored.
    /// Predictor 3 always reassembles to little-endian regardless.
    pub little_endian: bool,
    /// Rows covered by one UNIT of work: `RowsPerStrip` for a stripped file,
    /// `TileLength` for a tiled one.
    pub rows_per_strip: u32,
    /// `TileWidth`/`TileLength`, both zero for a stripped file.
    pub tile_width: u32,
    pub tile_length: u32,
    /// Tiles per tile row; 1 for a stripped file.
    pub blocks_across: u32,
    /// Tag 50674's second value, for LERC blocks.
    pub lerc_additional_compression: u32,
    /// Byte offset of each BLOCK (strip, or tile in row-major order).
    pub offsets: Vec<u64>,
    /// Compressed length of each block.
    pub counts: Vec<u64>,
    /// `JPEGTables` (tag 347) for compression 7: the abbreviated table stream
    /// each block's frame is completed with. Empty when absent or not JPEG.
    pub jpeg_tables: Vec<u8>,
}

impl FloatStripPlan {
    pub fn is_tiled(&self) -> bool {
        self.tile_width > 0 && self.tile_length > 0
    }
    /// Blocks making up one unit of work: a strip is one block, a tile row is
    /// one block per tile column. A unit is always a full-width band of the
    /// image, which is what lets a worker return rows the caller can place
    /// with a single offset.
    pub fn blocks_per_unit(&self) -> usize {
        if self.planar_configuration == 2 {
            self.channels as usize
        } else if self.is_tiled() {
            (self.blocks_across as usize).max(1)
        } else {
            1
        }
    }
    /// Number of units of work — strips, or tile ROWS.
    pub fn strip_count(&self) -> usize {
        self.offsets.len() / self.blocks_per_unit().max(1)
    }
    pub fn row_bytes(&self) -> usize {
        (self.width as usize) * (self.channels as usize) * (self.bits_per_sample as usize / 8)
    }
    /// Bytes in one row of a single block: the full image width for a strip,
    /// `TileWidth` for a tile (edge tiles are padded to that width).
    pub fn block_row_bytes(&self) -> usize {
        if self.planar_configuration == 2 {
            (self.width as usize) * (self.bits_per_sample as usize / 8)
        } else if self.is_tiled() {
            (self.tile_width as usize)
                * (self.channels as usize)
                * (self.bits_per_sample as usize / 8)
        } else {
            self.row_bytes()
        }
    }
    /// First image row covered by `unit`.
    pub fn first_row(&self, unit: usize) -> usize {
        unit * self.rows_per_strip as usize
    }
    /// Rows actually covered by `unit` (the last one may be short).
    pub fn rows_in(&self, unit: usize) -> usize {
        let first = self.first_row(unit);
        if first >= self.height as usize {
            0
        } else {
            (self.rows_per_strip as usize).min(self.height as usize - first)
        }
    }
    pub(crate) fn codec_info(&self) -> BlockCodecInfo {
        BlockCodecInfo {
            bits_per_sample: self.bits_per_sample,
            sample_format: self.sample_format,
            little_endian: self.little_endian,
            lerc_additional_compression: self.lerc_additional_compression,
            // YCbCr only reaches the plan as JPEG, which converts to RGB itself.
            ycbcr: false,
            jpeg_tables: self.jpeg_tables.clone(),
        }
    }
}

/// Read the tags describing a byte-aligned chunky layout that can be decoded
/// one unit at a time — a strip, or a whole tile ROW — or `None` when the file
/// is not that shape.
///
/// This is what makes parallel decoding possible: every unit is a full-width
/// band of the image, so a worker handed only that unit's compressed bytes can
/// return rows the caller drops in at one offset. Tiles qualify a tile row at
/// a time for exactly that reason; a single tile would not, since it covers
/// only part of each row it touches.
///
/// `try_decode_float_predictor_strips` is built on top of this and applies
/// narrower guards of its own — it predates tiles and the block-only codecs,
/// and widening it is not needed for the single-threaded path.
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
    orientation: u32,
    photometric_interpretation: u32,
) -> Option<FloatStripPlan> {
    use tiff::tags::Tag;

    if !matches!(planar_configuration, 1 | 2) || !matches!(predictor, 1..=3) {
        return None;
    }
    // Byte-aligned widths only. Sub-byte and 9..15-bit shapes have their own
    // dedicated paths (try_decode_subbit_strips) and are not worth duplicating.
    if !matches!(bits_per_sample, 8 | 16 | 32 | 64) {
        return None;
    }
    // Every codec `decompress_block` implements IN THIS BUILD. LERC and PNG
    // hand back typed values rather than the strip's bytes, which is why the
    // plan carries the sample layout they need to re-serialize against.
    //
    // Planning only parses the IFD, but it must not advertise a codec that the
    // selected parallel worker module cannot decode. Embedded JPEG XL takes
    // the whole-container retry path through its dedicated module instead.
    let supported = matches!(
        compression,
        1 | 5
            | 7
            | 8
            | 32946
            | 50000
            | 34933
            | 34925
            | 34887
            | 34712
            | 33003
            | 33004
            | 33005
            | 34934
            | 22610
    );
    if !supported {
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
    let little_endian = tiff_is_little_endian(data)?;
    let tile_width = decoder.get_tag_u32(Tag::TileWidth).unwrap_or(0);
    let tile_length = decoder.get_tag_u32(Tag::TileLength).unwrap_or(0);
    let is_tiled = tile_width > 0 && tile_length > 0;

    if is_tiled && planar_configuration == 2 {
        // Separate tiled planes need both a channel and a tile-column axis.
        // Keep that uncommon shape on the established whole-image decoder.
        return None;
    }
    let (mut offsets, mut counts, rows_per_unit, blocks_across) = if is_tiled {
        let offsets = match decoder.get_tag_u64_vec(Tag::TileOffsets) {
            Ok(value) if !value.is_empty() => value,
            _ => return None,
        };
        let counts = match decoder.get_tag_u64_vec(Tag::TileByteCounts) {
            Ok(value) if value.len() == offsets.len() => value,
            _ => return None,
        };
        let across = (width as u64).div_ceil(tile_width as u64) as u32;
        let down = (height as u64).div_ceil(tile_length as u64) as u32;
        // The tiles must be exactly the row-major grid this assumes; anything
        // else (a missing tile, a second plane) is not this path's to guess at.
        if across == 0 || offsets.len() as u64 != (across as u64) * (down as u64) {
            return None;
        }
        (offsets, counts, tile_length as u64, across)
    } else {
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
        (offsets, counts, rows_per_strip, 1)
    };
    if rows_per_unit == 0 {
        return None;
    }
    if planar_configuration == 2 {
        let strips_per_plane = (height as u64).div_ceil(rows_per_unit) as usize;
        let channel_count = channels as usize;
        if channel_count == 0 || offsets.len() != strips_per_plane * channel_count {
            return None;
        }
        // TIFF stores separate planes plane-major. Reorder only the small IFD
        // tables to band-major so one unit contains all channel blocks for the
        // same rows and can be assembled at a single output offset.
        let mut band_offsets = Vec::with_capacity(offsets.len());
        let mut band_counts = Vec::with_capacity(counts.len());
        for strip in 0..strips_per_plane {
            for channel in 0..channel_count {
                let index = channel * strips_per_plane + strip;
                band_offsets.push(offsets[index]);
                band_counts.push(counts[index]);
            }
        }
        offsets = band_offsets;
        counts = band_counts;
    }
    // JPEG blocks are abbreviated streams completed with the shared tables.
    // Only 8-bit unsigned samples without a predictor are JPEG-compressed.
    let jpeg_tables = if compression == 7 {
        if bits_per_sample != 8 || sample_format != 1 || predictor != 1 {
            return None;
        }
        decoder
            .get_tag_u8_vec(Tag::Unknown(347))
            .unwrap_or_default()
    } else {
        Vec::new()
    };
    Some(FloatStripPlan {
        width,
        height,
        channels,
        bits_per_sample,
        compression,
        predictor,
        sample_format,
        planar_configuration,
        orientation,
        photometric_interpretation,
        little_endian,
        rows_per_strip: rows_per_unit as u32,
        tile_width: if is_tiled { tile_width } else { 0 },
        tile_length: if is_tiled { tile_length } else { 0 },
        blocks_across,
        lerc_additional_compression: decoder
            .get_tag_u32_vec(Tag::Unknown(50674))
            .ok()
            .and_then(|values| values.get(1).copied())
            .unwrap_or(0),
        offsets,
        counts,
        jpeg_tables,
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
    decode_block_rows(block, plan, plan.width as usize, rows, out)
}

/// The same work for a block that is only `block_width` columns wide — a TILE.
/// Predictors run along a block's own rows, not the image's, so the width has
/// to be the block's for the differencing and the byte planes to line up.
pub(crate) fn decode_block_rows(
    block: &[u8],
    plan: &FloatStripPlan,
    block_width: usize,
    rows: usize,
    out: &mut [u8],
) -> Result<(), DecodeError> {
    let bytes_per_sample = plan.bits_per_sample as usize / 8;
    let samples_per_row = block_width * (plan.channels as usize);
    let row_bytes = samples_per_row * bytes_per_sample;
    let expected = rows * row_bytes;

    let mut decompressed = decompress_block(
        block,
        plan.compression,
        expected,
        "Strip decode",
        Some(&plan.codec_info()),
    )?;
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
            // second bytes, ...). Undo the differencing, then de-planarize
            // straight into LITTLE-endian samples, whatever the file's order.
            _ => {
                prefix_sum_bytes(row_slice);
                planes_to_le_samples(row_slice, dst, samples_per_row, bytes_per_sample);
            }
        }
    }
    Ok(())
}

/// Running wrapping sum over `row`, in place: the inverse of the byte-wise
/// differencing TIFF predictor 3 applies.
fn prefix_sum_bytes(row: &mut [u8]) {
    #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
    let start = simd128::prefix_sum_bytes(row);
    #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
    let start = 1;
    for i in start..row.len() {
        row[i] = row[i].wrapping_add(row[i - 1]);
    }
}

/// De-planarize one predictor-3 row: `planes` holds `bytes_per_sample` planes of
/// `samples` bytes each, most significant first; `dst` receives the samples in
/// little-endian byte order.
fn planes_to_le_samples(planes: &[u8], dst: &mut [u8], samples: usize, bytes_per_sample: usize) {
    #[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
    let start = simd128::planes_to_le_samples(planes, dst, samples, bytes_per_sample);
    #[cfg(not(all(target_arch = "wasm32", target_feature = "simd128")))]
    let start = 0;
    for sample in start..samples {
        for byte in 0..bytes_per_sample {
            dst[sample * bytes_per_sample + (bytes_per_sample - 1 - byte)] =
                planes[byte * samples + sample];
        }
    }
}

/// WebAssembly SIMD kernels for predictor 3. Each handles a whole number of
/// 16-byte vectors and returns how far it got; the scalar loops above finish
/// the row, so both paths always produce identical bytes.
#[cfg(all(target_arch = "wasm32", target_feature = "simd128"))]
mod simd128 {
    use core::arch::wasm32::{i8x16_shuffle, u8x16_add, u8x16_splat, v128, v128_load, v128_store};

    /// Interleave the low halves of `a` and `b` byte by byte: a0 b0 a1 b1 ...
    #[inline]
    fn zip_low_bytes(a: v128, b: v128) -> v128 {
        i8x16_shuffle::<0, 16, 1, 17, 2, 18, 3, 19, 4, 20, 5, 21, 6, 22, 7, 23>(a, b)
    }

    /// Interleave the high halves of `a` and `b` byte by byte: a8 b8 a9 b9 ...
    #[inline]
    fn zip_high_bytes(a: v128, b: v128) -> v128 {
        i8x16_shuffle::<8, 24, 9, 25, 10, 26, 11, 27, 12, 28, 13, 29, 14, 30, 15, 31>(a, b)
    }

    /// Interleave the low halves of `a` and `b` two bytes at a time.
    #[inline]
    fn zip_low_pairs(a: v128, b: v128) -> v128 {
        i8x16_shuffle::<0, 1, 16, 17, 2, 3, 18, 19, 4, 5, 20, 21, 6, 7, 22, 23>(a, b)
    }

    /// Interleave the high halves of `a` and `b` two bytes at a time.
    #[inline]
    fn zip_high_pairs(a: v128, b: v128) -> v128 {
        i8x16_shuffle::<8, 9, 24, 25, 10, 11, 26, 27, 12, 13, 28, 29, 14, 15, 30, 31>(a, b)
    }

    /// `v` moved up by N lanes, the vacated low lanes taken from `zero`.
    #[inline]
    fn shift_lanes_1(zero: v128, v: v128) -> v128 {
        i8x16_shuffle::<0, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30>(zero, v)
    }
    #[inline]
    fn shift_lanes_2(zero: v128, v: v128) -> v128 {
        i8x16_shuffle::<0, 0, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29>(zero, v)
    }
    #[inline]
    fn shift_lanes_4(zero: v128, v: v128) -> v128 {
        i8x16_shuffle::<0, 0, 0, 0, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27>(zero, v)
    }
    #[inline]
    fn shift_lanes_8(zero: v128, v: v128) -> v128 {
        i8x16_shuffle::<0, 0, 0, 0, 0, 0, 0, 0, 16, 17, 18, 19, 20, 21, 22, 23>(zero, v)
    }

    /// In-place running byte sum over whole vectors; returns the first index
    /// the scalar loop must continue from (always at least 1).
    pub(super) fn prefix_sum_bytes(row: &mut [u8]) -> usize {
        let zero = u8x16_splat(0);
        let mut carry = u8x16_splat(0);
        let mut chunks = row.chunks_exact_mut(16);
        for chunk in &mut chunks {
            // SAFETY: `chunk` is exactly 16 bytes; unaligned v128 access is legal.
            let mut v = unsafe { v128_load(chunk.as_ptr().cast()) };
            // Log-step inclusive scan within the vector: lane i gains lane
            // i-1, then i-2, i-4, i-8 (lanes below the shift take `zero`'s 0).
            v = u8x16_add(v, shift_lanes_1(zero, v));
            v = u8x16_add(v, shift_lanes_2(zero, v));
            v = u8x16_add(v, shift_lanes_4(zero, v));
            v = u8x16_add(v, shift_lanes_8(zero, v));
            v = u8x16_add(v, carry);
            carry = i8x16_shuffle::<15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15>(
                v, v,
            );
            // SAFETY: as above.
            unsafe { v128_store(chunk.as_mut_ptr().cast(), v) };
        }
        let done = row.len() - row.len() % 16;
        if done > 0 && done < row.len() {
            row[done] = row[done].wrapping_add(row[done - 1]);
            done + 1
        } else {
            done.max(1)
        }
    }

    /// De-planarize whole vectors of 32- or 16-bit samples; returns how many
    /// samples were written (0 for widths handled only by the scalar loop).
    pub(super) fn planes_to_le_samples(
        planes: &[u8],
        dst: &mut [u8],
        samples: usize,
        bytes_per_sample: usize,
    ) -> usize {
        let vectors = samples / 16;
        if planes.len() < samples * bytes_per_sample || dst.len() < samples * bytes_per_sample {
            return 0;
        }
        match bytes_per_sample {
            4 => planes_to_le_u32(planes, dst, samples, vectors),
            2 => planes_to_le_u16(planes, dst, samples, vectors),
            _ => return 0,
        }
        vectors * 16
    }

    fn planes_to_le_u32(planes: &[u8], dst: &mut [u8], samples: usize, vectors: usize) {
        let src = planes.as_ptr();
        let out = dst.as_mut_ptr();
        for i in 0..vectors {
            let at = i * 16;
            // SAFETY: plane `b` spans `planes[b * samples..(b + 1) * samples]`
            // and `at + 16 <= samples`, so every load is in bounds; the stores
            // write `dst[at * 4..at * 4 + 64]`, inside its `samples * 4` bytes
            // (both lengths are checked by the caller).
            unsafe {
                let p0 = v128_load(src.add(at).cast());
                let p1 = v128_load(src.add(samples + at).cast());
                let p2 = v128_load(src.add(2 * samples + at).cast());
                let p3 = v128_load(src.add(3 * samples + at).cast());
                // Least significant byte first: (p3, p2) pairs, then (p1, p0).
                let low_lo = zip_low_bytes(p3, p2);
                let low_hi = zip_high_bytes(p3, p2);
                let high_lo = zip_low_bytes(p1, p0);
                let high_hi = zip_high_bytes(p1, p0);
                let o = out.add(at * 4);
                v128_store(o.cast(), zip_low_pairs(low_lo, high_lo));
                v128_store(o.add(16).cast(), zip_high_pairs(low_lo, high_lo));
                v128_store(o.add(32).cast(), zip_low_pairs(low_hi, high_hi));
                v128_store(o.add(48).cast(), zip_high_pairs(low_hi, high_hi));
            }
        }
    }

    fn planes_to_le_u16(planes: &[u8], dst: &mut [u8], samples: usize, vectors: usize) {
        let src = planes.as_ptr();
        let out = dst.as_mut_ptr();
        for i in 0..vectors {
            let at = i * 16;
            // SAFETY: as in `planes_to_le_u32`, with two planes and two bytes
            // per sample.
            unsafe {
                let p0 = v128_load(src.add(at).cast());
                let p1 = v128_load(src.add(samples + at).cast());
                let o = out.add(at * 2);
                v128_store(o.cast(), zip_low_bytes(p1, p0));
                v128_store(o.add(16).cast(), zip_high_bytes(p1, p0));
            }
        }
    }
}

/// Decode one UNIT of work into `band`, the full-width rows it covers.
///
/// A strip is one block spanning the whole width, so it lands in `band`
/// directly. A tile row is `blocks_across` blocks side by side, each padded by
/// the encoder to the full tile size: the tile is decoded on its own (so its
/// predictor runs along the tile's rows) and then the part that is inside the
/// image is copied across. `band` must be exactly `rows * plan.row_bytes()`.
pub(crate) fn decode_unit_into(
    blocks: &[&[u8]],
    plan: &FloatStripPlan,
    unit: usize,
    rows: usize,
    band: &mut [u8],
) -> Result<(), DecodeError> {
    if plan.planar_configuration == 2 {
        let bytes_per_sample = plan.bits_per_sample as usize / 8;
        let plane_row_bytes = plan.width as usize * bytes_per_sample;
        let mut plane_plan = plan.clone();
        plane_plan.channels = 1;
        plane_plan.planar_configuration = 1;
        let mut plane = vec![0u8; rows * plane_row_bytes];
        for (channel, block) in blocks.iter().enumerate() {
            decode_float_predictor_strip(block, &plane_plan, rows, &mut plane)?;
            for pixel in 0..rows * plan.width as usize {
                let source = pixel * bytes_per_sample;
                let destination = (pixel * plan.channels as usize + channel) * bytes_per_sample;
                band[destination..destination + bytes_per_sample]
                    .copy_from_slice(&plane[source..source + bytes_per_sample]);
            }
        }
        return Ok(());
    }
    if !plan.is_tiled() {
        let block = blocks
            .first()
            .ok_or_else(|| DecodeError::new("Strip range: missing strip bytes"))?;
        return decode_float_predictor_strip(block, plan, rows, band);
    }

    let row_bytes = plan.row_bytes();
    let tile_row_bytes = plan.block_row_bytes();
    let bytes_per_sample = plan.bits_per_sample as usize / 8;
    let tile_length = plan.tile_length as usize;
    let tile_width = plan.tile_width as usize;
    let first_row = plan.first_row(unit);
    let mut tile = vec![0u8; tile_length * tile_row_bytes];

    for (column, block) in blocks.iter().enumerate() {
        let image_col = column * tile_width;
        if image_col >= plan.width as usize {
            break;
        }
        // An edge tile still carries a full tile's rows and columns: the
        // encoder pads it, and the padding is dropped when copying out.
        if block.is_empty() {
            // A tile a sparse GeoTIFF never wrote reads as zeros, as in libtiff.
            tile.iter_mut().for_each(|byte| *byte = 0);
        } else {
            decode_block_rows(block, plan, tile_width, tile_length, &mut tile)?;
        }

        let valid_cols = tile_width.min(plan.width as usize - image_col);
        let copy_bytes = valid_cols * (plan.channels as usize) * bytes_per_sample;
        let dst_col_offset = image_col * (plan.channels as usize) * bytes_per_sample;
        for row in 0..rows.min(plan.height as usize - first_row) {
            let src = &tile[row * tile_row_bytes..row * tile_row_bytes + copy_bytes];
            let dst_start = row * row_bytes + dst_col_offset;
            band[dst_start..dst_start + copy_bytes].copy_from_slice(src);
        }
    }
    Ok(())
}

/// Decode the units `[first_unit, first_unit + units)` from `blob`, the
/// concatenated compressed bytes of every block those units cover, and return
/// the full-width rows they make up.
///
/// Shared by the two public range entry points, which differ only in what they
/// turn the bytes into afterwards.
pub(crate) fn decode_unit_range(
    blob: &[u8],
    counts: &[u32],
    first_unit: u32,
    plan: &FloatStripPlan,
) -> Result<Vec<u8>, DecodeError> {
    let row_bytes = plan.row_bytes();
    let blocks_per_unit = plan.blocks_per_unit();
    let first = first_unit as usize;
    let units = counts.len() / blocks_per_unit.max(1);

    let mut rows_total = 0usize;
    for index in 0..units {
        rows_total += plan.rows_in(first + index);
    }
    let mut raster = vec![0u8; rows_total * row_bytes];

    let mut in_pos = 0usize;
    let mut out_pos = 0usize;
    for index in 0..units {
        let rows = plan.rows_in(first + index);
        if rows == 0 {
            break;
        }
        let mut blocks: Vec<&[u8]> = Vec::with_capacity(blocks_per_unit);
        for block in 0..blocks_per_unit {
            let count = counts[index * blocks_per_unit + block] as usize;
            let end = in_pos
                .checked_add(count)
                .filter(|end| *end <= blob.len())
                .ok_or_else(|| {
                    DecodeError::new("Strip range: compressed blob is shorter than its counts")
                })?;
            blocks.push(&blob[in_pos..end]);
            in_pos = end;
        }
        decode_unit_into(
            &blocks,
            plan,
            first + index,
            rows,
            &mut raster[out_pos..out_pos + rows * row_bytes],
        )?;
        out_pos += rows * row_bytes;
    }
    raster.truncate(out_pos);
    Ok(raster)
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
/// Predictor 3 leaves samples little-endian (`planes_to_le_samples`);
/// predictors 1 and 2 leave them in the file's byte order.
pub(crate) fn strip_bytes_to_f32(raster: &[u8], plan: &FloatStripPlan) -> Vec<f32> {
    let big_endian = plan.predictor != 3 && !plan.little_endian;
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
        (2, 3) => map!(2, |a| crate::formats::half::f16_to_f32(u16::from_le_bytes(
            a
        ))),
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
        1,
        1,
    ) {
        Some(plan) => plan,
        None => return Ok(None),
    };
    // The plan is broader than this function: it also describes predictor 1 and
    // 2 layouts, 16-bit floats, TILED layouts and the block-only codecs, all of
    // which the strip-parallel API handles and the loop below does not — it
    // walks strips and reads predictor-3 f32/f64. Anything else must be declined
    // here or it would silently reinterpret the bytes.
    if plan.predictor != 3 || !matches!(plan.bits_per_sample, 32 | 64) {
        return Ok(None);
    }
    if plan.is_tiled() || !matches!(plan.compression, 1 | 5 | 8 | 32946) {
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
                .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
                .collect(),
        )
    } else {
        DecodingResult::F64(
            raster
                .chunks_exact(8)
                .map(|b| f64::from_le_bytes([b[0], b[1], b[2], b[3], b[4], b[5], b[6], b[7]]))
                .collect(),
        )
    }))
}

#[cfg(all(test, feature = "codec-lzma"))]
mod tests {
    use super::decompress_block;

    #[test]
    fn lzma_decodes_standard_xz_delta_filter_chain() {
        // Python lzma FORMAT_XZ: Delta(dist=3) followed by LZMA2. This is the
        // same filter chain libtiff writes for LZMA + horizontal predictor.
        let encoded = [
            0xfd, 0x37, 0x7a, 0x58, 0x5a, 0x00, 0x00, 0x04, 0xe6, 0xd6, 0xb4, 0x46, 0x02, 0x01,
            0x03, 0x01, 0x02, 0x21, 0x01, 0x16, 0xf2, 0xe8, 0xcd, 0x44, 0x01, 0x00, 0x05, 0x4b,
            0x3a, 0x2a, 0x02, 0x02, 0x02, 0x00, 0x00, 0x00, 0x96, 0x3e, 0xab, 0x28, 0x30, 0x07,
            0xf7, 0xde, 0x00, 0x01, 0x1e, 0x06, 0xc1, 0x2f, 0xa4, 0x1d, 0x1f, 0xb6, 0xf3, 0x7d,
            0x01, 0x00, 0x00, 0x00, 0x00, 0x04, 0x59, 0x5a,
        ];
        let decoded = decompress_block(&encoded, 34925, 6, "test", None).unwrap();
        assert_eq!(decoded, [75, 58, 42, 77, 60, 44]);
    }
}
