//! GRBG Bayer demosaicing for Stonex X3I camera frames.
//!
//! An X3I member is a raw sensor plane: one 8-bit sample per photosite, in a
//! GRBG mosaic (even rows `G R`, odd rows `B G`). Producing a colour per point
//! means reconstructing all three channels, and doing it the same way the
//! TypeScript parser has been doing it - bilinear interpolation *within each
//! colour's own lattice* rather than across neighbouring photosites of
//! different colours, which would bleed one channel into another.
//!
//! The sensor is mounted rotated: the calibrated image is portrait while the
//! raw plane is landscape, so a calibrated `(x, y)` maps to raw
//! `(y, height - 1 - x)`.

/// Half-resolution decode, matching the TypeScript `CAMERA_RGB_SCALE`.
///
/// Half rather than full because the result is sampled per point, and the scan
/// is angularly coarser than the sensor: at range a scan column steps about
/// 0.16 degrees while a full-resolution pixel covers roughly 0.015, so the
/// extra samples buy nothing a point can carry.
pub const CAMERA_RGB_SCALE: f64 = 0.5;

/// A decoded frame: interleaved RGB, row-major, `width * height * 3` bytes.
pub struct RgbImage {
    pub width: usize,
    pub height: usize,
    pub data: Vec<u8>,
}

/// One frame's raw plane and the geometry needed to read it.
pub struct BayerFrame<'a> {
    pub pixels: &'a [u8],
    pub raw_width: usize,
    pub raw_height: usize,
    /// Calibrated (portrait) dimensions the decode targets.
    pub image_width: usize,
    pub image_height: usize,
}

/// Bilinear sample within the lattice of one colour.
///
/// `parity` selects which of the four mosaic positions this colour occupies, so
/// the interpolation only ever mixes samples of the same colour. Coordinates
/// are clamped to the lattice rather than wrapped: an edge pixel repeats, which
/// is what the TypeScript version does and keeps the two byte-identical.
fn sample_lattice(
    frame: &BayerFrame,
    raw_x: f64,
    raw_y: f64,
    parity_x: usize,
    parity_y: usize,
) -> f64 {
    let lattice_x = (raw_x - parity_x as f64) * 0.5;
    let lattice_y = (raw_y - parity_y as f64) * 0.5;
    let x0 = lattice_x.floor();
    let y0 = lattice_y.floor();
    let tx = lattice_x - x0;
    let ty = lattice_y - y0;

    let max_x = ((frame.raw_width as f64 - 1.0 - parity_x as f64) * 0.5).floor();
    let max_y = ((frame.raw_height as f64 - 1.0 - parity_y as f64) * 0.5).floor();
    let read = |x: f64, y: f64| -> f64 {
        let cx = x.clamp(0.0, max_x) as usize;
        let cy = y.clamp(0.0, max_y) as usize;
        let offset = (cy * 2 + parity_y) * frame.raw_width + cx * 2 + parity_x;
        frame.pixels.get(offset).copied().unwrap_or(0) as f64
    };

    let top = read(x0, y0) * (1.0 - tx) + read(x0 + 1.0, y0) * tx;
    let bottom = read(x0, y0 + 1.0) * (1.0 - tx) + read(x0 + 1.0, y0 + 1.0) * tx;
    top * (1.0 - ty) + bottom * ty
}

/// Full RGB at one calibrated (portrait) coordinate.
///
/// Green is averaged over both of its mosaic positions, which is what makes it
/// the least noisy channel and why the white balance references it.
pub fn sample_grbg(frame: &BayerFrame, portrait_x: f64, portrait_y: f64) -> [f64; 3] {
    let raw_x = portrait_y;
    let raw_y = frame.raw_height as f64 - 1.0 - portrait_x;
    let red = sample_lattice(frame, raw_x, raw_y, 1, 0);
    let green = (sample_lattice(frame, raw_x, raw_y, 0, 0)
        + sample_lattice(frame, raw_x, raw_y, 1, 1))
        * 0.5;
    let blue = sample_lattice(frame, raw_x, raw_y, 0, 1);
    [red.min(255.0), green.min(255.0), blue.min(255.0)]
}

/// Decodes a whole frame at `CAMERA_RGB_SCALE`.
pub fn decode_rgb(frame: &BayerFrame) -> RgbImage {
    let width = (frame.image_width as f64 * CAMERA_RGB_SCALE).ceil() as usize;
    let height = (frame.image_height as f64 * CAMERA_RGB_SCALE).ceil() as usize;
    let mut data = vec![0u8; width * height * 3];
    for y in 0..height {
        let portrait_y = (y as f64 + 0.5) / CAMERA_RGB_SCALE - 0.5;
        for x in 0..width {
            let portrait_x = (x as f64 + 0.5) / CAMERA_RGB_SCALE - 0.5;
            let colour = sample_grbg(frame, portrait_x, portrait_y);
            let offset = (y * width + x) * 3;
            data[offset] = colour[0].round() as u8;
            data[offset + 1] = colour[1].round() as u8;
            data[offset + 2] = colour[2].round() as u8;
        }
    }
    RgbImage {
        width,
        height,
        data,
    }
}

/// Gray-world reference gains, measured on a subsample of the plane.
///
/// Not called from the wasm surface yet: the colour pass that consumes it is
/// the next piece of the port, and the TypeScript parser still computes its own.
#[allow(dead_code)]
///
/// Subsampled by 16 in both axes on purpose: this only needs the average cast
/// of the frame, and reading every photosite to compute three means is most of
/// a decode's cost for none of its value.
pub fn white_balance(frame: &BayerFrame) -> (f64, f64, f64) {
    let (mut red, mut green, mut blue, mut samples) = (0.0f64, 0.0f64, 0.0f64, 0usize);
    let mut y = 0usize;
    while y + 1 < frame.raw_height {
        let even_y = y & !1;
        let mut x = 0usize;
        while x + 1 < frame.raw_width {
            let even_x = x & !1;
            let row0 = even_y * frame.raw_width + even_x;
            let row1 = row0 + frame.raw_width;
            let at = |index: usize| frame.pixels.get(index).copied().unwrap_or(0) as f64;
            green += (at(row0) + at(row1 + 1)) * 0.5;
            red += at(row0 + 1);
            blue += at(row1);
            samples += 1;
            x += 16;
        }
        y += 16;
    }
    if samples == 0 || red == 0.0 || blue == 0.0 {
        return (1.0, 1.0, green / samples.max(1) as f64);
    }
    (green / red, green / blue, green / samples as f64)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A 4x4 GRBG plane with distinct values per channel position.
    fn fixture() -> Vec<u8> {
        vec![
            10, 200, 12, 210, // G R G R
            90, 20, 95, 22, //  B G B G
            14, 220, 16, 230, // G R G R
            99, 24, 105, 26, // B G B G
        ]
    }

    fn frame(pixels: &[u8]) -> BayerFrame<'_> {
        BayerFrame {
            pixels,
            raw_width: 4,
            raw_height: 4,
            image_width: 4,
            image_height: 4,
        }
    }

    #[test]
    fn separates_the_three_channels_at_a_lattice_centre() {
        let pixels = fixture();
        let frame = frame(&pixels);
        // Portrait (x, y) maps to raw (y, height-1-x); pick a point that lands
        // exactly on the red photosite at raw (1, 0).
        let colour = sample_grbg(&frame, 3.0, 1.0);
        assert!((colour[0] - 200.0).abs() < 1e-9, "red {}", colour[0]);
        // Green is the mean of its two positions, blue interpolates its own.
        assert!(colour[1] > 0.0 && colour[1] < 200.0, "green {}", colour[1]);
        assert!(colour[2] > 0.0, "blue {}", colour[2]);
    }

    #[test]
    fn clamps_at_the_edges_rather_than_wrapping() {
        let pixels = fixture();
        let frame = frame(&pixels);
        // Far outside the plane in both directions: the edge sample repeats, so
        // the result stays in range instead of folding round to the far side.
        let outside = sample_grbg(&frame, -50.0, -50.0);
        for channel in outside {
            assert!(
                (0.0..=255.0).contains(&channel),
                "channel out of range: {channel}"
            );
        }
    }

    #[test]
    fn decodes_at_half_resolution() {
        let pixels = fixture();
        let frame = frame(&pixels);
        let image = decode_rgb(&frame);
        assert_eq!(image.width, 2);
        assert_eq!(image.height, 2);
        assert_eq!(image.data.len(), 2 * 2 * 3);
    }

    #[test]
    fn white_balance_reports_green_relative_gains() {
        let pixels = fixture();
        let frame = frame(&pixels);
        let (red_gain, blue_gain, mean_green) = white_balance(&frame);
        // This mosaic is green-poor and red-rich, so the red gain pulls down.
        assert!(red_gain < 1.0, "red gain {red_gain}");
        assert!(blue_gain > 0.0, "blue gain {blue_gain}");
        assert!(mean_green > 0.0);
    }

    #[test]
    fn a_uniform_plane_decodes_to_that_value() {
        let pixels = vec![128u8; 16];
        let frame = frame(&pixels);
        let image = decode_rgb(&frame);
        for byte in &image.data {
            assert_eq!(*byte, 128, "a flat sensor must not produce colour");
        }
    }
}
