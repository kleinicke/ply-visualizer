//! Small byte-in/byte-out codecs shared by more than one container.

#[cfg(any(feature = "tiff", feature = "czi"))]
use crate::DecodeError;

/// Decode TIFF-flavoured LZW into exactly the byte count the container's
/// geometry declares. CZI compression 2 uses the same MSB-first stream and
/// TIFF code-width transition as TIFF compression 5.
#[cfg(any(feature = "tiff", feature = "czi"))]
pub(crate) fn decode_tiff_lzw(
    block: &[u8],
    expected_len: usize,
    context: &str,
) -> Result<Vec<u8>, DecodeError> {
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
                    break;
                }
                return Err(DecodeError::new(format!(
                    "{}: LZW decode stalled before end of input",
                    context
                )));
            }
            Err(e) => {
                return Err(DecodeError::new(format!(
                    "{}: LZW decode failed: {}",
                    context, e
                )))
            }
        }
    }
    if out_pos < expected_len {
        return Err(DecodeError::new(format!(
            "{}: LZW stream produced {} bytes, expected {}",
            context, out_pos, expected_len
        )));
    }
    Ok(out)
}

/// Inflate one zlib stream (a TIFF Deflate strip or tile).
///
/// zune-inflate decodes the whole stream in one pass into a buffer sized from
/// the block geometry, which is markedly faster than flate2's streaming reader
/// (a 32 KiB window plus repeated `Vec` growth). Any error retries through
/// flate2 so that malformed streams fail, or succeed, exactly as before.
#[cfg(feature = "tiff")]
pub(crate) fn inflate_zlib(
    block: &[u8],
    expected_len: usize,
    context: &str,
) -> Result<Vec<u8>, DecodeError> {
    use std::io::Read;

    let options = zune_inflate::DeflateOptions::default().set_size_hint(expected_len);
    if let Ok(out) = zune_inflate::DeflateDecoder::new_with_options(block, options).decode_zlib() {
        return Ok(out);
    }
    let mut buf = Vec::with_capacity(expected_len);
    flate2::read::ZlibDecoder::new(block)
        .read_to_end(&mut buf)
        .map_err(|e| DecodeError::new(format!("{context}: Deflate decode failed: {e}")))?;
    Ok(buf)
}

/// Decode an LZ4 raw block (not an LZ4 frame) into its declared size.
/// CZI CHUNKED stores independently compressed raw LZ4 blocks.
#[cfg(feature = "czi")]
fn decode_lz4_block(
    input: &[u8],
    expected_len: usize,
    context: &str,
) -> Result<Vec<u8>, DecodeError> {
    let mut out = Vec::with_capacity(expected_len);
    let mut pos = 0usize;
    while pos < input.len() {
        let token = input[pos];
        pos += 1;

        let mut literal_len = (token >> 4) as usize;
        if literal_len == 15 {
            loop {
                let extra = *input.get(pos).ok_or_else(|| {
                    DecodeError::new(format!("{}: truncated LZ4 literal length", context))
                })? as usize;
                pos += 1;
                literal_len = literal_len.checked_add(extra).ok_or_else(|| {
                    DecodeError::new(format!("{}: LZ4 literal length overflow", context))
                })?;
                if extra != 255 {
                    break;
                }
            }
        }
        let literal_end = pos
            .checked_add(literal_len)
            .ok_or_else(|| DecodeError::new(format!("{}: LZ4 literal range overflow", context)))?;
        let output_after_literals = out.len().checked_add(literal_len).ok_or_else(|| {
            DecodeError::new(format!("{}: LZ4 literal output size overflow", context))
        })?;
        if literal_end > input.len() || output_after_literals > expected_len {
            return Err(DecodeError::new(format!(
                "{}: invalid LZ4 literal run",
                context
            )));
        }
        out.extend_from_slice(&input[pos..literal_end]);
        pos = literal_end;
        if pos == input.len() {
            break;
        }

        let offset_bytes = input
            .get(pos..pos + 2)
            .ok_or_else(|| DecodeError::new(format!("{}: truncated LZ4 match offset", context)))?;
        pos += 2;
        let offset = u16::from_le_bytes([offset_bytes[0], offset_bytes[1]]) as usize;
        if offset == 0 || offset > out.len() {
            return Err(DecodeError::new(format!(
                "{}: invalid LZ4 match offset {}",
                context, offset
            )));
        }

        let mut match_len = (token & 0x0f) as usize + 4;
        if token & 0x0f == 15 {
            loop {
                let extra = *input.get(pos).ok_or_else(|| {
                    DecodeError::new(format!("{}: truncated LZ4 match length", context))
                })? as usize;
                pos += 1;
                match_len = match_len.checked_add(extra).ok_or_else(|| {
                    DecodeError::new(format!("{}: LZ4 match length overflow", context))
                })?;
                if extra != 255 {
                    break;
                }
            }
        }
        let output_after_match = out.len().checked_add(match_len).ok_or_else(|| {
            DecodeError::new(format!("{}: LZ4 match output size overflow", context))
        })?;
        if output_after_match > expected_len {
            return Err(DecodeError::new(format!(
                "{}: LZ4 match exceeds declared output size",
                context
            )));
        }
        for _ in 0..match_len {
            let value = out[out.len() - offset];
            out.push(value);
        }
    }
    if out.len() != expected_len {
        return Err(DecodeError::new(format!(
            "{}: LZ4 block produced {} bytes, expected {}",
            context,
            out.len(),
            expected_len
        )));
    }
    Ok(out)
}

#[cfg(feature = "czi")]
fn chunked_varint(
    payload: &[u8],
    pos: &mut usize,
    max_bytes: usize,
    context: &str,
) -> Result<usize, DecodeError> {
    let mut value = 0usize;
    for index in 0..max_bytes {
        let byte = *payload
            .get(*pos)
            .ok_or_else(|| DecodeError::new(format!("{}: truncated varint", context)))?;
        *pos += 1;
        value |= ((byte & 0x7f) as usize) << (index * 7);
        if byte & 0x80 == 0 {
            return Ok(value);
        }
    }
    Err(DecodeError::new(format!(
        "{}: varint exceeds {} bytes",
        context, max_bytes
    )))
}

#[cfg(feature = "czi")]
fn chunked_varints(payload: &[u8], context: &str) -> Result<Vec<usize>, DecodeError> {
    let mut values = Vec::new();
    let mut pos = 0usize;
    while pos < payload.len() {
        values.push(chunked_varint(payload, &mut pos, 4, context)?);
    }
    Ok(values)
}

/// Decode the experimental CZI compression-mode 7 payload described by
/// libCZI. The small header identifies independent zstd or raw-LZ4 blocks.
#[cfg(feature = "czi")]
pub(crate) fn decode_czi_chunked(
    payload: &[u8],
    expected_len: usize,
    bytes_per_channel: usize,
) -> Result<Vec<u8>, DecodeError> {
    use std::io::{Cursor, Read};

    let mut pos = 0usize;
    let mut compressed_sizes: Option<Vec<usize>> = None;
    let mut decompressed_compact: Option<Vec<usize>> = None;
    let mut method = 0u8; // zstd is the specified default
    let mut preprocessing = 0u8;
    let mut ended = false;

    while pos < payload.len() {
        let id = chunked_varint(payload, &mut pos, 2, "CZI CHUNKED header id")?;
        if id == 0 {
            ended = true;
            break;
        }

        let length = chunked_varint(payload, &mut pos, 3, "CZI CHUNKED header length")?;
        let end = pos
            .checked_add(length)
            .ok_or_else(|| DecodeError::new("CZI CHUNKED header range overflow"))?;
        let chunk = payload
            .get(pos..end)
            .ok_or_else(|| DecodeError::new("CZI CHUNKED header payload is truncated"))?;
        pos = end;
        match id {
            1 => {
                if compressed_sizes.is_some() {
                    return Err(DecodeError::new("CZI CHUNKED has duplicate ChunkSizes"));
                }
                compressed_sizes = Some(chunked_varints(chunk, "CZI CHUNKED compressed sizes")?);
            }
            2 => {
                if chunk.len() != 1 || chunk[0] > 1 {
                    return Err(DecodeError::new(
                        "CZI CHUNKED has an invalid compression method",
                    ));
                }
                method = chunk[0];
            }
            3 => {
                if decompressed_compact.is_some() {
                    return Err(DecodeError::new(
                        "CZI CHUNKED has duplicate DecompressedSizes",
                    ));
                }
                decompressed_compact =
                    Some(chunked_varints(chunk, "CZI CHUNKED decompressed sizes")?);
            }
            4 => {
                if chunk.len() != 1 || chunk[0] > 1 {
                    return Err(DecodeError::new("CZI CHUNKED has invalid preprocessing"));
                }
                preprocessing = chunk[0];
            }
            _ => {
                return Err(DecodeError::new(format!(
                    "CZI CHUNKED header chunk {} is not supported",
                    id
                )))
            }
        }
    }
    if !ended {
        return Err(DecodeError::new("CZI CHUNKED header has no end marker"));
    }
    let compressed_sizes =
        compressed_sizes.ok_or_else(|| DecodeError::new("CZI CHUNKED is missing ChunkSizes"))?;
    let compact = decompressed_compact
        .ok_or_else(|| DecodeError::new("CZI CHUNKED is missing DecompressedSizes"))?;
    if compressed_sizes.is_empty() || compact.is_empty() || compact.len() > compressed_sizes.len() {
        return Err(DecodeError::new("CZI CHUNKED size tables are invalid"));
    }

    let chunk_count = compressed_sizes.len();
    let mut decompressed_sizes = Vec::with_capacity(chunk_count);
    if compact.len() == 1 {
        decompressed_sizes.resize(chunk_count, compact[0]);
    } else if compact.len() == chunk_count {
        decompressed_sizes.extend_from_slice(&compact);
    } else {
        decompressed_sizes.extend_from_slice(&compact[..compact.len() - 2]);
        decompressed_sizes.resize(chunk_count - 1, compact[compact.len() - 2]);
        decompressed_sizes.push(compact[compact.len() - 1]);
    }
    let total = decompressed_sizes
        .iter()
        .try_fold(0usize, |sum, &size| sum.checked_add(size))
        .ok_or_else(|| DecodeError::new("CZI CHUNKED decompressed size overflow"))?;
    if total != expected_len {
        return Err(DecodeError::new(format!(
            "CZI CHUNKED declares {} output bytes, expected {}",
            total, expected_len
        )));
    }
    if preprocessing == 1 && bytes_per_channel != 2 {
        return Err(DecodeError::new(
            "CZI CHUNKED hi-lo preprocessing requires 16-bit samples",
        ));
    }

    let mut out = Vec::with_capacity(expected_len);
    for (index, (&compressed_len, &decompressed_len)) in
        compressed_sizes.iter().zip(&decompressed_sizes).enumerate()
    {
        let end = pos
            .checked_add(compressed_len)
            .ok_or_else(|| DecodeError::new("CZI CHUNKED data range overflow"))?;
        let input = payload
            .get(pos..end)
            .ok_or_else(|| DecodeError::new("CZI CHUNKED data is truncated"))?;
        pos = end;
        let context = format!("CZI CHUNKED block {}", index);
        let mut decoded = if method == 0 {
            let mut bytes = Vec::with_capacity(decompressed_len);
            let mut decoder = ruzstd::decoding::StreamingDecoder::new(Cursor::new(input))
                .map_err(|e| DecodeError::new(format!("{} zstd init: {:?}", context, e)))?;
            decoder
                .read_to_end(&mut bytes)
                .map_err(|e| DecodeError::new(format!("{} zstd decode: {:?}", context, e)))?;
            if bytes.len() != decompressed_len {
                return Err(DecodeError::new(format!(
                    "{} produced {} bytes, expected {}",
                    context,
                    bytes.len(),
                    decompressed_len
                )));
            }
            bytes
        } else {
            decode_lz4_block(input, decompressed_len, &context)?
        };
        if preprocessing == 1 {
            if decoded.len() % 2 != 0 {
                return Err(DecodeError::new("CZI CHUNKED hi-lo block has an odd size"));
            }
            let half = decoded.len() / 2;
            let mut unpacked = Vec::with_capacity(decoded.len());
            for sample in 0..half {
                unpacked.push(decoded[sample]);
                unpacked.push(decoded[half + sample]);
            }
            decoded = unpacked;
        }
        out.extend_from_slice(&decoded);
    }
    if pos != payload.len() {
        return Err(DecodeError::new("CZI CHUNKED payload has trailing data"));
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::decode_tiff_lzw;

    #[test]
    fn shared_lzw_round_trips_across_code_width_changes() {
        let input: Vec<u8> = (0..4096)
            .map(|i| ((i * 37 + i / 11) & 0xff) as u8)
            .collect();
        let encoded = weezl::encode::Encoder::with_tiff_size_switch(weezl::BitOrder::Msb, 8)
            .encode(&input)
            .expect("encode fixture");
        assert_eq!(
            decode_tiff_lzw(&encoded, input.len(), "shared LZW fixture").unwrap(),
            input
        );
    }

    #[cfg(feature = "czi")]
    #[test]
    fn czi_chunked_decodes_independent_lz4_blocks() {
        // Header: compressed sizes [18, 7], decompressed sizes [16, 6], LZ4.
        let mut encoded = vec![1, 2, 18, 7, 3, 2, 16, 6, 2, 1, 1, 0, 0xf0, 1];
        encoded.extend(0u8..16);
        encoded.push(0x60);
        encoded.extend(16u8..22);
        assert_eq!(
            super::decode_czi_chunked(&encoded, 22, 1).unwrap(),
            (0u8..22).collect::<Vec<_>>()
        );
    }

    #[cfg(feature = "czi")]
    #[test]
    fn czi_chunked_reverses_hilo_per_chunk() {
        // One raw-literal LZ4 block containing four hi-lo packed u16 samples.
        let encoded = [
            1, 1, 9, 3, 1, 8, 2, 1, 1, 4, 1, 1, 0, 0x80, 1, 3, 5, 7, 2, 4, 6, 8,
        ];
        assert_eq!(
            super::decode_czi_chunked(&encoded, 8, 2).unwrap(),
            vec![1, 2, 3, 4, 5, 6, 7, 8]
        );
    }
}
