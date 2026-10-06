//! Range-reading metadata support. Pixel decoding remains in the existing decoders.
use crate::DecodeError;
const MAX_SAFE: u64 = (1u64 << 53) - 1;
fn uint(data: &[u8], at: usize, size: usize, little: bool) -> Result<u64, DecodeError> {
    let bytes = data
        .get(
            at..at
                .checked_add(size)
                .ok_or_else(|| DecodeError::new("TIFF offset overflow"))?,
        )
        .ok_or_else(|| DecodeError::new("Truncated TIFF index"))?;
    let mut value = 0u64;
    for i in 0..size {
        value |= (bytes[if little { i } else { size - 1 - i }] as u64) << (8 * i);
    }
    if value > MAX_SAFE {
        return Err(DecodeError::new(
            "TIFF offset exceeds exact browser integer range",
        ));
    }
    Ok(value)
}
fn layout(header: &[u8]) -> Result<(bool, bool, u64), DecodeError> {
    let little = match header.get(..2) {
        Some(b"II") => true,
        Some(b"MM") => false,
        _ => return Err(DecodeError::new("Invalid TIFF byte order")),
    };
    let big = match uint(header, 2, 2, little)? {
        42 => false,
        43 => true,
        _ => return Err(DecodeError::new("Invalid TIFF version")),
    };
    if big && (uint(header, 4, 2, little)? != 8 || uint(header, 6, 2, little)? != 0) {
        return Err(DecodeError::new("Unsupported BigTIFF offset layout"));
    }
    Ok((
        little,
        big,
        uint(
            header,
            if big { 8 } else { 4 },
            if big { 8 } else { 4 },
            little,
        )?,
    ))
}
pub fn header_json(header: &[u8]) -> Result<String, DecodeError> {
    let (little, big, first) = layout(header)?;
    Ok(format!(
        "{{\"littleEndian\":{little},\"bigTiff\":{big},\"firstOffset\":{first}}}"
    ))
}
/// Describe index ranges and patches for a metadata-only view of one IFD.
/// The patches replace index arrays with a single zero; the original source
/// is never modified, and each real index entry is read before decoding a tile.
pub fn ifd_json(header: &[u8], data: &[u8], offset: u64) -> Result<String, DecodeError> {
    let (little, big, _) = layout(header)?;
    let (count_size, entry_size, pointer_size) = if big { (8, 20, 8) } else { (2, 12, 4) };
    let count = uint(data, 0, count_size, little)? as usize;
    if count > 65536 {
        return Err(DecodeError::new("TIFF directory has too many entries"));
    }
    let length = count_size + count * entry_size + pointer_size;
    if data.len() < length {
        return Ok(format!("{{\"length\":{length}}}"));
    }
    let mut tables = Vec::new();
    let mut patches = Vec::new();
    for i in 0..count {
        let at = count_size + i * entry_size;
        let tag = uint(data, at, 2, little)?;
        if !matches!(tag, 273 | 279 | 324 | 325) {
            continue;
        }
        let kind = uint(data, at + 2, 2, little)?;
        let item_bytes = match kind {
            1 => 1,
            3 => 2,
            4 => 4,
            16 => 8,
            _ => return Err(DecodeError::new("Unsupported TIFF block index type")),
        };
        let items = uint(data, at + 4, if big { 8 } else { 4 }, little)?;
        if items == 0 || items > u32::MAX as u64 {
            return Err(DecodeError::new("Invalid TIFF block index length"));
        }
        let value_at = at + if big { 12 } else { 8 };
        let external = items * item_bytes > pointer_size as u64;
        let table_offset = if external {
            uint(data, value_at, pointer_size, little)?
        } else {
            offset
                .checked_add(value_at as u64)
                .ok_or_else(|| DecodeError::new("TIFF offset overflow"))?
        };
        if table_offset
            .checked_add(items * item_bytes)
            .filter(|end| *end <= MAX_SAFE)
            .is_none()
        {
            return Err(DecodeError::new(
                "TIFF block index exceeds exact browser range",
            ));
        }
        tables.push(format!("{{\"tag\":{tag},\"count\":{items},\"offset\":{table_offset},\"itemBytes\":{item_bytes}}}"));
        if external {
            let mut bytes = vec![0u8; entry_size - 4];
            let field_count_size = if big { 8 } else { 4 };
            bytes[if little { 0 } else { field_count_size - 1 }] = 1;
            patches.push(format!(
                "{{\"offset\":{},\"bytes\":{:?}}}",
                offset + at as u64 + 4,
                bytes
            ));
        }
    }
    let next = uint(data, count_size + count * entry_size, pointer_size, little)?;
    Ok(format!(
        "{{\"length\":{length},\"nextOffset\":{next},\"tables\":[{}],\"patches\":[{}]}}",
        tables.join(","),
        patches.join(",")
    ))
}
pub fn index_values(data: &[u8], item_bytes: usize, little: bool) -> Result<Vec<f64>, DecodeError> {
    if !matches!(item_bytes, 1 | 2 | 4 | 8) || !data.len().is_multiple_of(item_bytes) {
        return Err(DecodeError::new("Invalid TIFF index element size"));
    }
    (0..data.len())
        .step_by(item_bytes)
        .map(|at| uint(data, at, item_bytes, little).map(|v| v as f64))
        .collect()
}
