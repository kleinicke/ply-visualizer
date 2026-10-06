//! SGI RGB: https://ftp.zx.net.nz/pub/archive/ftp.sgi.com/graphics/grafica/sgiimage.html
use crate::{DecodeError, DecodedArray};

fn invalid() -> DecodeError {
    DecodeError::new("SGI: invalid or truncated image data")
}
fn u16be(data: &[u8], at: usize) -> Result<usize, DecodeError> {
    let b = data
        .get(at..at.checked_add(2).ok_or_else(invalid)?)
        .ok_or_else(invalid)?;
    Ok(u16::from_be_bytes([b[0], b[1]]) as usize)
}
fn u32be(data: &[u8], at: usize) -> Result<usize, DecodeError> {
    let b = data
        .get(at..at.checked_add(4).ok_or_else(invalid)?)
        .ok_or_else(invalid)?;
    Ok(u32::from_be_bytes(b.try_into().unwrap()) as usize)
}
fn sample(data: &[u8], at: &mut usize, bpc: usize) -> Result<f32, DecodeError> {
    let value = if bpc == 1 {
        *data.get(*at).ok_or_else(invalid)? as usize
    } else {
        u16be(data, *at)?
    };
    *at += bpc;
    Ok(value as f32)
}

pub(crate) fn decode(data: &[u8]) -> Result<DecodedArray, DecodeError> {
    if data.len() < 512 || u16be(data, 0)? != 474 {
        return Err(invalid());
    }
    let storage = data[2];
    let bpc = data[3] as usize;
    let dim = u16be(data, 4)?;
    let width = u16be(data, 6)?;
    let height = u16be(data, 8)?;
    let channels = u16be(data, 10)?;
    if storage > 1
        || !(1..=2).contains(&bpc)
        || !(1..=3).contains(&dim)
        || width == 0
        || height == 0
        || !(1..=4).contains(&channels)
        || (dim == 1 && (height != 1 || channels != 1))
        || (dim == 2 && channels != 1)
    {
        return Err(invalid());
    }
    if u32be(data, 104)? != 0 {
        return Err(DecodeError::new(
            "SGI: obsolete colormap modes are unsupported",
        ));
    }
    let rows = height * channels;
    let count = width.checked_mul(rows).ok_or_else(invalid)?;
    let payload = if storage == 1 { 512 + rows * 8 } else { 512 };
    let required = if storage == 0 {
        count
            .checked_mul(bpc)
            .and_then(|n| n.checked_add(512))
            .ok_or_else(invalid)?
    } else {
        payload
    };
    if data.len() < required {
        return Err(invalid());
    }
    // Bound allocations even for tiny RLE inputs declaring enormous images.
    if count > 268_435_456 {
        return Err(DecodeError::new("SGI: image exceeds sample limit"));
    }
    let mut out = Vec::new();
    out.try_reserve_exact(count)
        .map_err(|_| DecodeError::new("SGI: image allocation failed"))?;
    out.resize(count, 0.0);
    for row in 0..rows {
        let channel = row / height;
        let y = height - 1 - row % height;
        let put = |out: &mut [f32], x: usize, v: f32| {
            out[(y * width + x) * channels + channel] = v;
        };
        if storage == 0 {
            let mut at = 512 + row * width * bpc;
            for x in 0..width {
                put(&mut out, x, sample(data, &mut at, bpc)?);
            }
        } else {
            let start = u32be(data, 512 + row * 4)?;
            let length = u32be(data, 512 + (rows + row) * 4)?;
            if start < payload || length % bpc != 0 {
                return Err(invalid());
            }
            let bytes = data
                .get(start..start.checked_add(length).ok_or_else(invalid)?)
                .ok_or_else(invalid)?;
            let mut at = 0;
            let mut x = 0;
            loop {
                let control = sample(bytes, &mut at, bpc)? as usize;
                let n = control & 127;
                if n == 0 {
                    if x != width {
                        return Err(invalid());
                    }
                    break;
                }
                if n > width - x {
                    return Err(invalid());
                }
                if control & 128 != 0 {
                    for _ in 0..n {
                        put(&mut out, x, sample(bytes, &mut at, bpc)?);
                        x += 1;
                    }
                } else {
                    let v = sample(bytes, &mut at, bpc)?;
                    for _ in 0..n {
                        put(&mut out, x, v);
                        x += 1;
                    }
                }
            }
        }
    }
    Ok(DecodedArray {
        width: width as u32,
        height: height as u32,
        channels: channels as u32,
        bits_per_sample: (bpc * 8) as u32,
        sample_format: 1,
        type_min: 0.0,
        type_max: if bpc == 1 { 255.0 } else { 65535.0 },
        source_numeric_type: format!("uint{}", bpc * 8),
        sample_kind: 0,
        format_label: "SGI RGB".into(),
        metadata_json: "{}".into(),
        data_f32: out,
        data_u8: Vec::new(),
        data_u16: Vec::new(),
        source_data_offset: 0,
        can_reuse_source: false,
        taken: false,
        data_min: 0.0,
        data_max: 0.0,
        non_finite_count: 0.0,
        valid_count: 0.0,
    }
    .maybe_finalize_stats(true))
}
