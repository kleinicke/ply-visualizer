//! COLMAP dense arrays: ASCII dimensions followed by planar little-endian f32.
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn decode_colmap_depth(bytes: &[u8]) -> Result<Vec<f32>, JsValue> {
    decode(bytes).map_err(|e| JsValue::from_str(&e))
}
fn decode(bytes: &[u8]) -> Result<Vec<f32>, String> {
    let mut offset = 0;
    let mut dims = Vec::new();
    for _ in 0..3 {
        let end = bytes
            .get(offset..)
            .and_then(|s| s.iter().take(24).position(|&b| b == b'&'))
            .ok_or("Invalid COLMAP dense header")?
            + offset;
        let n = std::str::from_utf8(&bytes[offset..end])
            .map_err(|_| "Invalid COLMAP dimension")?
            .parse::<usize>()
            .map_err(|_| "Invalid COLMAP dimension")?;
        if n == 0 {
            return Err("COLMAP dimensions must be positive".into());
        }
        dims.push(n);
        offset = end + 1;
    }
    let pixels = dims[0]
        .checked_mul(dims[1])
        .ok_or("COLMAP dimensions overflow")?;
    let samples = pixels
        .checked_mul(dims[2])
        .ok_or("COLMAP dimensions overflow")?;
    if samples.checked_mul(4) != Some(bytes.len() - offset) {
        return Err("COLMAP dense payload size mismatch".into());
    }
    let mut values = vec![0.0; samples];
    for c in 0..dims[2] {
        for i in 0..pixels {
            let at = offset + (c * pixels + i) * 4;
            values[i * dims[2] + c] = f32::from_le_bytes(bytes[at..at + 4].try_into().unwrap());
        }
    }
    Ok(values)
}
#[cfg(test)]
mod tests {
    use super::decode;
    #[test]
    fn planar_channels_and_size_validation() {
        let mut bytes = b"2&1&2&".to_vec();
        for n in [1f32, 2., 3., 4.] {
            bytes.extend(n.to_le_bytes());
        }
        assert_eq!(decode(&bytes).unwrap(), vec![1., 3., 2., 4.]);
        bytes.pop();
        assert!(decode(&bytes).is_err());
        assert!(decode(b"0&1&1&").is_err());
    }
}

#[wasm_bindgen]
pub struct DepthRaster {
    pub width: u32,
    pub height: u32,
    pub channels: u32,
    data: Vec<f32>,
}
#[wasm_bindgen]
impl DepthRaster {
    pub fn take_data(&mut self) -> Vec<f32> {
        std::mem::take(&mut self.data)
    }
}
/// PFM raw samples in top-left raster order; caller explicitly supplies value scale.
#[wasm_bindgen]
pub fn decode_depth_pfm(bytes: &[u8]) -> Result<DepthRaster, JsValue> {
    let mut decoded = scientific_image_decoders::decode_pfm_fast(bytes, true)
        .map_err(|e| JsValue::from_str(&e.to_string()))?;
    Ok(DepthRaster {
        width: decoded.width(),
        height: decoded.height(),
        channels: decoded.channels(),
        data: decoded
            .take_data_as_f32()
            .map_err(|e| JsValue::from_str(&e.to_string()))?,
    })
}

#[cfg(test)]
mod raster_tests {
    use super::*;
    #[test]
    fn pfm_flips_bottom_up_and_preserves_channels() {
        for (scale, little) in [("-1", true), ("1", false)] {
            let mut bytes = format!("PF\n1 2\n{scale}\n").into_bytes();
            for value in [1f32, 2., 3., 4., 5., 6.] {
                bytes.extend(if little {
                    value.to_le_bytes()
                } else {
                    value.to_be_bytes()
                });
            }
            let result = decode_depth_pfm(&bytes).unwrap();
            assert_eq!(result.data, vec![4., 5., 6., 1., 2., 3.]);
            assert_eq!((result.width, result.height, result.channels), (1, 2, 3));
        }
    }
}
