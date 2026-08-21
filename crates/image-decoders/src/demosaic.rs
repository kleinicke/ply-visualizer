//! CFA (colour filter array) demosaicing.
//!
//! Operates on an already-decoded single-channel plane, so it is format
//! agnostic: TIFF, PNG, NPY, PGM and friends all reach it the same way. The
//! source plane is never modified — the caller keeps the raw mosaic for pixel
//! inspection and re-runs this whenever a debayer parameter changes.
//!
//! Pipeline order follows the standard raw pipeline:
//!   black/white level  ->  white balance  ->  demosaic
//! White balance runs *before* interpolation on purpose: interpolating across
//! channels that sit at different scales produces colour fringing on edges.

use crate::DecodeError;

/// Channel slot indices used inside a CFA grid.
pub const R: u8 = 0;
pub const G: u8 = 1;
pub const B: u8 = 2;
/// Fourth slot: IR on RGB-IR sensors, W (panchromatic/clear) on RGBW and RCCB.
pub const I: u8 = 3;

/// A CFA layout: `period x period` sites, row-major, each naming a channel slot.
pub struct CfaPattern {
    pub period: usize,
    pub grid: Vec<u8>,
    /// Number of output channels (3 for RGB, 4 when the 4th slot is populated).
    pub channels: usize,
}

impl CfaPattern {
    fn new(period: usize, grid: Vec<u8>) -> Self {
        debug_assert_eq!(grid.len(), period * period);
        let channels = if grid.iter().any(|&c| c == I) { 4 } else { 3 };
        CfaPattern {
            period,
            grid,
            channels,
        }
    }

    /// Channel at an image coordinate, honouring the phase offset.
    #[inline]
    fn at(&self, x: usize, y: usize, ox: usize, oy: usize) -> u8 {
        let p = self.period;
        self.grid[((y + oy) % p) * p + ((x + ox) % p)]
    }
}

/// Resolve a pattern name. Unknown names fall back to RGGB.
///
/// For 2x2 layouts the four names are the four phase offsets of one physical
/// sensor, so `rggb` + offset (1,0) is exactly `grbg`; both spellings are kept
/// because cameras document it either way.
pub fn pattern_from_name(name: &str) -> CfaPattern {
    match name {
        "bggr" => CfaPattern::new(2, vec![B, G, G, R]),
        "grbg" => CfaPattern::new(2, vec![G, R, B, G]),
        "gbrg" => CfaPattern::new(2, vec![G, B, R, G]),

        // RGB-IR, OmniVision-style 4x4: BGRG / GIGI / RGBG / GIGI.
        "rgbi_4x4" => CfaPattern::new(4, vec![B, G, R, G, G, I, G, I, R, G, B, G, G, I, G, I]),

        // Fuji X-Trans 6x6. Sparse R/B, so it needs the wider interpolation
        // radius that `fill_radius` derives from the period.
        "xtrans" => CfaPattern::new(
            6,
            vec![
                G, B, R, G, R, B, R, G, G, B, G, G, B, G, G, R, G, G, G, R, B, G, B, R, B, G, G, R,
                G, G, R, G, G, B, G, G,
            ],
        ),

        // Automotive clear-filter arrays. "C" (clear/panchromatic) is carried in
        // the 4th slot; the view layer can show it directly or as luma.
        "rccb" => CfaPattern::new(2, vec![R, I, I, B]),
        "rccc" => CfaPattern::new(2, vec![R, I, I, I]),

        // Kodak-style RGBW.
        "rgbw" => CfaPattern::new(2, vec![R, G, B, I]),

        // Quad-Bayer / Tetracell: 2x2 blocks of like colour in RGGB order.
        "quad_rggb" => CfaPattern::new(4, vec![R, R, G, G, R, R, G, G, G, G, B, B, G, G, B, B]),

        _ => CfaPattern::new(2, vec![R, G, G, B]),
    }
}

/// Interpolation radius that guarantees every channel is present in the window.
fn fill_radius(period: usize) -> isize {
    match period {
        2 => 1,
        4 => 2,
        _ => 3,
    }
}

/// PhotometricInterpretation value meaning "colour filter array" (TIFF/EP, DNG).
pub const PHOTOMETRIC_CFA: u32 = 32803;

/// Rewrite PhotometricInterpretation 32803 (CFA) to 1 (BlackIsZero) in a copy
/// of the file, returning the copy.
///
/// The `tiff` crate rejects unknown photometric interpretations in
/// `Decoder::new`, so a CFA file cannot be opened at all otherwise. The pixel
/// data of a CFA image *is* a plain single-channel plane — only the tag is
/// unknown to the crate — so presenting it as BlackIsZero decodes correctly and
/// the caller restores the real value for reporting. Returns `None` when the
/// file carries no CFA tag, so the common path copies nothing.
///
/// Handles both byte orders and both classic TIFF and BigTIFF.
pub fn neutralize_cfa_photometric(data: &[u8]) -> Option<Vec<u8>> {
    if data.len() < 8 {
        return None;
    }
    let little = match &data[0..2] {
        b"II" => true,
        b"MM" => false,
        _ => return None,
    };
    let u16_at = |b: &[u8], o: usize| -> u16 {
        if little {
            u16::from_le_bytes([b[o], b[o + 1]])
        } else {
            u16::from_be_bytes([b[o], b[o + 1]])
        }
    };
    let u32_at = |b: &[u8], o: usize| -> u32 {
        let s = [b[o], b[o + 1], b[o + 2], b[o + 3]];
        if little {
            u32::from_le_bytes(s)
        } else {
            u32::from_be_bytes(s)
        }
    };
    let u64_at = |b: &[u8], o: usize| -> u64 {
        let mut s = [0u8; 8];
        s.copy_from_slice(&b[o..o + 8]);
        if little {
            u64::from_le_bytes(s)
        } else {
            u64::from_be_bytes(s)
        }
    };

    let version = u16_at(data, 2);
    let big = match version {
        42 => false,
        43 => true,
        _ => return None,
    };

    // Collect the byte offsets of every CFA-valued PhotometricInterpretation.
    let mut hits: Vec<usize> = Vec::new();
    let mut next: u64 = if big {
        if data.len() < 16 {
            return None;
        }
        u64_at(data, 8)
    } else {
        u32_at(data, 4) as u64
    };

    // Bounded so a malformed or cyclic IFD chain cannot spin forever.
    for _ in 0..64 {
        if next == 0 {
            break;
        }
        let ifd = next as usize;
        let (count, entry_size, entries_at) = if big {
            if ifd + 8 > data.len() {
                break;
            }
            (u64_at(data, ifd) as usize, 20usize, ifd + 8)
        } else {
            if ifd + 2 > data.len() {
                break;
            }
            (u16_at(data, ifd) as usize, 12usize, ifd + 2)
        };
        let end = entries_at + count * entry_size;
        if end + if big { 8 } else { 4 } > data.len() {
            break;
        }
        for i in 0..count {
            let e = entries_at + i * entry_size;
            if u16_at(data, e) != 262 {
                continue;
            }
            // SHORT, inline in the value field: the only encoding in practice.
            let value_at = e + if big { 12 } else { 8 };
            if u16_at(data, e + 2) == 3 && u16_at(data, value_at) as u32 == PHOTOMETRIC_CFA {
                hits.push(value_at);
            }
        }
        next = if big {
            u64_at(data, end)
        } else {
            u32_at(data, end) as u64
        };
    }

    if hits.is_empty() {
        return None;
    }
    let mut patched = data.to_vec();
    for offset in hits {
        let bytes = if little {
            1u16.to_le_bytes()
        } else {
            1u16.to_be_bytes()
        };
        patched[offset] = bytes[0];
        patched[offset + 1] = bytes[1];
    }
    Some(patched)
}

/// Result handed back to JS: interleaved f32, `channels` samples per pixel.
pub struct DemosaicResult {
    width: u32,
    height: u32,
    channels: u32,
    data: Vec<f32>,
    gain_r: f32,
    gain_g: f32,
    gain_b: f32,
}

impl DemosaicResult {
    pub fn width(&self) -> u32 {
        self.width
    }
    pub fn height(&self) -> u32 {
        self.height
    }
    pub fn channels(&self) -> u32 {
        self.channels
    }
    /// Gains actually applied, so the UI can show what auto-WB resolved to.
    pub fn gain_r(&self) -> f32 {
        self.gain_r
    }
    pub fn gain_g(&self) -> f32 {
        self.gain_g
    }
    pub fn gain_b(&self) -> f32 {
        self.gain_b
    }

    /// Moves the buffer out; the result is empty afterwards.
    pub fn take_data(&mut self) -> Vec<f32> {
        std::mem::take(&mut self.data)
    }
}

/// Gray-world gains, normalised to green. Computed on the mosaic itself so it
/// costs one pass and needs no interpolation.
fn gray_world_gains(
    plane: &[f32],
    width: usize,
    height: usize,
    pat: &CfaPattern,
    ox: usize,
    oy: usize,
) -> (f32, f32, f32) {
    let mut sums = [0f64; 4];
    let mut counts = [0u64; 4];
    for y in 0..height {
        for x in 0..width {
            let c = pat.at(x, y, ox, oy) as usize;
            sums[c] += plane[y * width + x] as f64;
            counts[c] += 1;
        }
    }
    let mean = |c: usize| {
        if counts[c] > 0 {
            sums[c] / counts[c] as f64
        } else {
            0.0
        }
    };
    let (mr, mg, mb) = (mean(R as usize), mean(G as usize), mean(B as usize));
    // Green is the reference. If a pattern has no green sites (RCCC), fall back
    // to the clear channel so the gains stay finite and meaningful.
    let reference = if mg > 1e-9 { mg } else { mean(I as usize) };
    if reference <= 1e-9 {
        return (1.0, 1.0, 1.0);
    }
    let g = |m: f64| {
        if m > 1e-9 {
            (reference / m) as f32
        } else {
            1.0
        }
    };
    (g(mr), g(mg), g(mb))
}

/// Normalised-convolution fill: blur the known samples and the known-mask with
/// the same kernel, then divide. Reduces to bilinear on a regular lattice and,
/// unlike a hand-rolled bilinear, works unchanged for 4x4 and 6x6 layouts.
fn fill_generic(
    plane: &[f32],
    width: usize,
    height: usize,
    pat: &CfaPattern,
    ox: usize,
    oy: usize,
    out: &mut [f32],
) {
    let nch = pat.channels;
    let radius = fill_radius(pat.period);
    // Triangular (tent) weights -> linear interpolation on a regular lattice.
    let weight = |d: isize| -> f32 { (radius + 1 - d.abs()) as f32 };

    for y in 0..height {
        for x in 0..width {
            let own = pat.at(x, y, ox, oy) as usize;
            let own_value = plane[y * width + x];
            let base = (y * width + x) * nch;

            for c in 0..nch {
                if c == own {
                    out[base + c] = own_value;
                    continue;
                }
                let mut num = 0f32;
                let mut den = 0f32;
                for dy in -radius..=radius {
                    let sy = y as isize + dy;
                    if sy < 0 || sy >= height as isize {
                        continue;
                    }
                    for dx in -radius..=radius {
                        let sx = x as isize + dx;
                        if sx < 0 || sx >= width as isize {
                            continue;
                        }
                        if pat.at(sx as usize, sy as usize, ox, oy) as usize != c {
                            continue;
                        }
                        let w = weight(dx) * weight(dy);
                        num += w * plane[sy as usize * width + sx as usize];
                        den += w;
                    }
                }
                out[base + c] = if den > 0.0 { num / den } else { own_value };
            }
        }
    }
}

/// Nearest-neighbour fill: copy the closest site of each channel, no averaging.
/// Preferred for measurement work, where an interpolated value is an invention.
fn fill_nearest(
    plane: &[f32],
    width: usize,
    height: usize,
    pat: &CfaPattern,
    ox: usize,
    oy: usize,
    out: &mut [f32],
) {
    let nch = pat.channels;
    let radius = fill_radius(pat.period);
    for y in 0..height {
        for x in 0..width {
            let own = pat.at(x, y, ox, oy) as usize;
            let own_value = plane[y * width + x];
            let base = (y * width + x) * nch;
            for c in 0..nch {
                if c == own {
                    out[base + c] = own_value;
                    continue;
                }
                let mut best = own_value;
                let mut best_d = isize::MAX;
                for dy in -radius..=radius {
                    let sy = y as isize + dy;
                    if sy < 0 || sy >= height as isize {
                        continue;
                    }
                    for dx in -radius..=radius {
                        let sx = x as isize + dx;
                        if sx < 0 || sx >= width as isize {
                            continue;
                        }
                        if pat.at(sx as usize, sy as usize, ox, oy) as usize != c {
                            continue;
                        }
                        let d = dx.abs() + dy.abs();
                        if d < best_d {
                            best_d = d;
                            best = plane[sy as usize * width + sx as usize];
                        }
                    }
                }
                out[base + c] = best;
            }
        }
    }
}

#[inline]
fn tap(plane: &[f32], width: usize, height: usize, x: isize, y: isize) -> f32 {
    // Mirror at the border so the 5x5 kernels stay well-defined on edges.
    let cx = if x < 0 {
        (-x) as usize
    } else if x >= width as isize {
        2 * width - 2 - x as usize
    } else {
        x as usize
    };
    let cy = if y < 0 {
        (-y) as usize
    } else if y >= height as isize {
        2 * height - 2 - y as usize
    } else {
        y as usize
    };
    let cx = cx.min(width - 1);
    let cy = cy.min(height - 1);
    plane[cy * width + cx]
}

/// Malvar-He-Cutler gradient-corrected linear interpolation (2x2 Bayer only).
///
/// Substantially better than bilinear on high-frequency detail for ~the same
/// cost: it corrects each interpolated value by the local gradient of the
/// channel that *is* sampled at that site.
fn fill_malvar(
    plane: &[f32],
    width: usize,
    height: usize,
    pat: &CfaPattern,
    ox: usize,
    oy: usize,
    out: &mut [f32],
) {
    let nch = pat.channels;
    for y in 0..height {
        for x in 0..width {
            let xi = x as isize;
            let yi = y as isize;
            let own = pat.at(x, y, ox, oy) as usize;
            let centre = plane[y * width + x];
            let base = (y * width + x) * nch;

            // Shared neighbourhood sums.
            let cross4 = tap(plane, width, height, xi - 1, yi)
                + tap(plane, width, height, xi + 1, yi)
                + tap(plane, width, height, xi, yi - 1)
                + tap(plane, width, height, xi, yi + 1);
            let diag4 = tap(plane, width, height, xi - 1, yi - 1)
                + tap(plane, width, height, xi + 1, yi - 1)
                + tap(plane, width, height, xi - 1, yi + 1)
                + tap(plane, width, height, xi + 1, yi + 1);
            let far_h =
                tap(plane, width, height, xi - 2, yi) + tap(plane, width, height, xi + 2, yi);
            let far_v =
                tap(plane, width, height, xi, yi - 2) + tap(plane, width, height, xi, yi + 2);
            let h2 = tap(plane, width, height, xi - 1, yi) + tap(plane, width, height, xi + 1, yi);
            let v2 = tap(plane, width, height, xi, yi - 1) + tap(plane, width, height, xi, yi + 1);

            // G at an R or B site.
            let g_at_rb = (4.0 * centre + 2.0 * cross4 - far_h - far_v) / 8.0;
            // R (or B) at a G site, with the sampled pair running horizontally.
            let rb_at_g_h = (5.0 * centre + 4.0 * h2 - diag4 - far_h + 0.5 * far_v) / 8.0;
            // Same, sampled pair running vertically.
            let rb_at_g_v = (5.0 * centre + 4.0 * v2 - diag4 - far_v + 0.5 * far_h) / 8.0;
            // R at a B site (and B at an R site).
            let rb_at_br = (6.0 * centre + 2.0 * diag4 - 1.5 * (far_h + far_v)) / 8.0;

            match own {
                x if x == R as usize => {
                    out[base + R as usize] = centre;
                    out[base + G as usize] = g_at_rb;
                    out[base + B as usize] = rb_at_br;
                }
                x if x == B as usize => {
                    out[base + B as usize] = centre;
                    out[base + G as usize] = g_at_rb;
                    out[base + R as usize] = rb_at_br;
                }
                _ => {
                    // Green site. Which of R/B lies horizontally depends on the
                    // colour of the left neighbour.
                    out[base + G as usize] = centre;
                    let left_is_red = pat.at((x + width - 1) % width, y, ox, oy) == R;
                    if left_is_red {
                        out[base + R as usize] = rb_at_g_h;
                        out[base + B as usize] = rb_at_g_v;
                    } else {
                        out[base + B as usize] = rb_at_g_h;
                        out[base + R as usize] = rb_at_g_v;
                    }
                }
            }
        }
    }
}

/// Demosaic a single-channel plane.
///
/// `black`/`white` bracket the sensor's usable range and are applied first;
/// pass `black = 0`, `white = 0` to skip level normalisation entirely. When
/// `auto_wb` is set, gray-world gains are computed and the explicit gains are
/// ignored.
#[allow(clippy::too_many_arguments)]
pub fn demosaic(
    data: &[f32],
    width: u32,
    height: u32,
    pattern: &str,
    algorithm: &str,
    offset_x: u32,
    offset_y: u32,
    black: f32,
    white: f32,
    auto_wb: bool,
    gain_r: f32,
    gain_g: f32,
    gain_b: f32,
) -> Result<DemosaicResult, DecodeError> {
    let (w, h) = (width as usize, height as usize);
    if w == 0 || h == 0 || data.len() < w * h {
        return Err(DecodeError::new(&format!(
            "demosaic: plane too small ({} values for {}x{})",
            data.len(),
            w,
            h
        )));
    }

    let pat = pattern_from_name(pattern);
    let ox = offset_x as usize % pat.period;
    let oy = offset_y as usize % pat.period;

    // --- black / white level ---
    let mut plane = vec![0f32; w * h];
    if white > black {
        let scale = 1.0 / (white - black);
        for i in 0..w * h {
            plane[i] = (data[i] - black) * scale;
        }
    } else {
        plane.copy_from_slice(&data[..w * h]);
    }

    // --- white balance, before interpolation ---
    let (gr, gg, gb) = if auto_wb {
        gray_world_gains(&plane, w, h, &pat, ox, oy)
    } else {
        (gain_r, gain_g, gain_b)
    };
    if (gr - 1.0).abs() > 1e-6 || (gg - 1.0).abs() > 1e-6 || (gb - 1.0).abs() > 1e-6 {
        let gains = [gr, gg, gb, 1.0];
        for y in 0..h {
            for x in 0..w {
                plane[y * w + x] *= gains[pat.at(x, y, ox, oy) as usize];
            }
        }
    }

    // --- interpolate ---
    let mut out = vec![0f32; w * h * pat.channels];
    match algorithm {
        "nearest" => fill_nearest(&plane, w, h, &pat, ox, oy, &mut out),
        // MHC is defined for 2x2 Bayer only; anything else uses the generic path.
        "malvar" if pat.period == 2 && pat.channels == 3 => {
            fill_malvar(&plane, w, h, &pat, ox, oy, &mut out)
        }
        _ => fill_generic(&plane, w, h, &pat, ox, oy, &mut out),
    }

    // Malvar-He-Cutler is an unconstrained linear filter, so it rings past the
    // sensor range on sharp detail (a 1px checkerboard can overshoot by >0.5).
    // Clamp when levelling told us what the valid range is: unbounded overshoot
    // would otherwise drag auto-normalisation far outside the real data and
    // wash the image out. Without levels the range is unknown, so leave it be.
    if white > black {
        for v in out.iter_mut() {
            *v = v.clamp(0.0, 1.0);
        }
    }

    Ok(DemosaicResult {
        width,
        height,
        channels: pat.channels as u32,
        data: out,
        gain_r: gr,
        gain_g: gg,
        gain_b: gb,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Mosaic an RGB source, demosaic it back, and report PSNR. Mirrors what
    /// `verify_bayer_testdata.py` does against the generated test files.
    fn roundtrip_psnr(algorithm: &str, pattern: &str, w: usize, h: usize) -> f64 {
        let pat = pattern_from_name(pattern);
        // Smooth synthetic source: interpolation should reconstruct it closely.
        let mut rgb = vec![0f32; w * h * 3];
        for y in 0..h {
            for x in 0..w {
                let fx = x as f32 / w as f32;
                let fy = y as f32 / h as f32;
                rgb[(y * w + x) * 3] = fx;
                rgb[(y * w + x) * 3 + 1] = fy;
                rgb[(y * w + x) * 3 + 2] = 0.5 * (fx + fy);
            }
        }
        let mut mosaic = vec![0f32; w * h];
        for y in 0..h {
            for x in 0..w {
                let c = pat.at(x, y, 0, 0) as usize;
                mosaic[y * w + x] = rgb[(y * w + x) * 3 + c.min(2)];
            }
        }
        let mut res = demosaic(
            &mosaic, w as u32, h as u32, pattern, algorithm, 0, 0, 0.0, 0.0, false, 1.0, 1.0, 1.0,
        )
        .unwrap();
        let out = res.take_data();

        let mut mse = 0f64;
        let mut n = 0u64;
        // Skip a 3px border: edge extension is not the thing under test.
        for y in 3..h - 3 {
            for x in 3..w - 3 {
                for c in 0..3 {
                    let d = (out[(y * w + x) * pat.channels + c] - rgb[(y * w + x) * 3 + c]) as f64;
                    mse += d * d;
                    n += 1;
                }
            }
        }
        mse /= n as f64;
        if mse <= 0.0 {
            return f64::INFINITY;
        }
        10.0 * (1.0 / mse).log10()
    }

    #[test]
    fn bilinear_reconstructs_smooth_gradients() {
        for pattern in ["rggb", "bggr", "grbg", "gbrg"] {
            let psnr = roundtrip_psnr("bilinear", pattern, 64, 64);
            assert!(psnr > 40.0, "{pattern} bilinear PSNR too low: {psnr}");
        }
    }

    #[test]
    fn malvar_beats_bilinear_on_gradients() {
        let bilinear = roundtrip_psnr("bilinear", "rggb", 64, 64);
        let malvar = roundtrip_psnr("malvar", "rggb", 64, 64);
        assert!(
            malvar >= bilinear - 1.0,
            "malvar {malvar} far below bilinear {bilinear}"
        );
    }

    #[test]
    fn nearest_is_exact_at_sampled_sites() {
        let w = 16;
        let h = 16;
        let plane: Vec<f32> = (0..w * h).map(|i| (i % 251) as f32 / 251.0).collect();
        let pat = pattern_from_name("rggb");
        let mut res = demosaic(
            &plane, w as u32, h as u32, "rggb", "nearest", 0, 0, 0.0, 0.0, false, 1.0, 1.0, 1.0,
        )
        .unwrap();
        let out = res.take_data();
        for y in 0..h {
            for x in 0..w {
                let c = pat.at(x, y, 0, 0) as usize;
                assert_eq!(out[(y * w + x) * 3 + c], plane[y * w + x]);
            }
        }
    }

    #[test]
    fn every_pattern_produces_full_output() {
        let (w, h) = (24usize, 24usize);
        let plane: Vec<f32> = (0..w * h).map(|i| (i % 97) as f32 / 97.0).collect();
        for name in [
            "rggb",
            "bggr",
            "grbg",
            "gbrg",
            "rgbi_4x4",
            "xtrans",
            "rccb",
            "rccc",
            "rgbw",
            "quad_rggb",
        ] {
            let pat = pattern_from_name(name);
            let mut res = demosaic(
                &plane, w as u32, h as u32, name, "bilinear", 0, 0, 0.0, 0.0, false, 1.0, 1.0, 1.0,
            )
            .unwrap();
            assert_eq!(
                res.channels() as usize,
                pat.channels,
                "{name} channel count"
            );
            let out = res.take_data();
            assert_eq!(out.len(), w * h * pat.channels, "{name} buffer size");
            assert!(
                out.iter().all(|v| v.is_finite()),
                "{name} produced non-finite values"
            );
        }
    }

    #[test]
    fn gray_world_recovers_known_gains() {
        // Neutral scene with known per-channel gains applied; auto WB should
        // undo them almost exactly.
        let (w, h) = (32usize, 32usize);
        let pat = pattern_from_name("rggb");
        let applied = [0.5f32, 1.0, 0.6];
        let mut mosaic = vec![0f32; w * h];
        for y in 0..h {
            for x in 0..w {
                let c = pat.at(x, y, 0, 0) as usize;
                mosaic[y * w + x] = 0.5 * applied[c];
            }
        }
        let res = demosaic(
            &mosaic, w as u32, h as u32, "rggb", "bilinear", 0, 0, 0.0, 0.0, true, 1.0, 1.0, 1.0,
        )
        .unwrap();
        assert!(
            (res.gain_r() - 2.0).abs() < 0.01,
            "gain_r = {}",
            res.gain_r()
        );
        assert!(
            (res.gain_g() - 1.0).abs() < 0.01,
            "gain_g = {}",
            res.gain_g()
        );
        assert!(
            (res.gain_b() - 1.0 / 0.6).abs() < 0.01,
            "gain_b = {}",
            res.gain_b()
        );
    }

    #[test]
    fn black_level_is_subtracted() {
        let (w, h) = (8usize, 8usize);
        let plane = vec![256.0f32 + 2047.5; w * h]; // mid-grey of a 12-bit sensor
        let mut res = demosaic(
            &plane, w as u32, h as u32, "rggb", "bilinear", 0, 0, 256.0, 4351.0, false, 1.0, 1.0,
            1.0,
        )
        .unwrap();
        let out = res.take_data();
        for v in out {
            assert!((v - 0.5).abs() < 1e-3, "expected ~0.5, got {v}");
        }
    }

    #[test]
    fn offset_cycles_through_the_2x2_phases() {
        // rggb shifted one column is grbg -- the claim the UI makes to users.
        let (w, h) = (16usize, 16usize);
        let plane: Vec<f32> = (0..w * h).map(|i| (i % 71) as f32 / 71.0).collect();
        let mut a = demosaic(
            &plane, w as u32, h as u32, "rggb", "bilinear", 1, 0, 0.0, 0.0, false, 1.0, 1.0, 1.0,
        )
        .unwrap();
        let mut b = demosaic(
            &plane, w as u32, h as u32, "grbg", "bilinear", 0, 0, 0.0, 0.0, false, 1.0, 1.0, 1.0,
        )
        .unwrap();
        assert_eq!(a.take_data(), b.take_data());
    }
}

