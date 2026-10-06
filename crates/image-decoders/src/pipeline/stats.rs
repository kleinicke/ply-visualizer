/// Convert u16 slice to little-endian bytes using SIMD
#[inline]
pub fn convert_u16_to_bytes_simd(data: &[u16]) -> Vec<u8> {
    use wide::*;

    let mut bytes = Vec::with_capacity(data.len() * 2);

    // Process 8 u16s at a time (128-bit SIMD)
    let chunks = data.chunks_exact(8);
    let remainder = chunks.remainder();

    for chunk in chunks {
        let simd = u16x8::new([
            chunk[0], chunk[1], chunk[2], chunk[3], chunk[4], chunk[5], chunk[6], chunk[7],
        ]);

        let arr = simd.to_array();
        for val in arr {
            bytes.extend_from_slice(&val.to_le_bytes());
        }
    }

    // Handle remainder
    for &val in remainder {
        bytes.extend_from_slice(&val.to_le_bytes());
    }

    bytes
}

pub fn compute_stats_u8(data: &[u8]) -> (u8, u8) {
    let mut min = u8::MAX;
    let mut max = u8::MIN;
    for &v in data {
        min = min.min(v);
        max = max.max(v);
    }
    (min, max)
}

pub fn compute_stats_u16(data: &[u16]) -> (u16, u16) {
    let mut min = u16::MAX;
    let mut max = u16::MIN;
    for &v in data {
        min = min.min(v);
        max = max.max(v);
    }
    (min, max)
}

pub fn compute_stats_u32(data: &[u32]) -> (u32, u32) {
    let mut min = u32::MAX;
    let mut max = u32::MIN;
    for &v in data {
        min = min.min(v);
        max = max.max(v);
    }
    (min, max)
}

pub fn compute_stats_u64(data: &[u64]) -> (u64, u64) {
    let mut min = u64::MAX;
    let mut max = u64::MIN;
    for &v in data {
        min = min.min(v);
        max = max.max(v);
    }
    (min, max)
}

pub fn compute_stats_i8(data: &[i8]) -> (i8, i8) {
    let mut min = i8::MAX;
    let mut max = i8::MIN;
    for &v in data {
        min = min.min(v);
        max = max.max(v);
    }
    (min, max)
}

pub fn compute_stats_i16(data: &[i16]) -> (i16, i16) {
    let mut min = i16::MAX;
    let mut max = i16::MIN;
    for &v in data {
        min = min.min(v);
        max = max.max(v);
    }
    (min, max)
}

pub fn compute_stats_i32(data: &[i32]) -> (i32, i32) {
    let mut min = i32::MAX;
    let mut max = i32::MIN;
    for &v in data {
        min = min.min(v);
        max = max.max(v);
    }
    (min, max)
}

pub fn compute_stats_i64(data: &[i64]) -> (i64, i64) {
    let mut min = i64::MAX;
    let mut max = i64::MIN;
    for &v in data {
        min = min.min(v);
        max = max.max(v);
    }
    (min, max)
}

pub fn compute_stats_f32(data: &[f32]) -> (f64, f64) {
    let mut min = f64::INFINITY;
    let mut max = f64::NEG_INFINITY;
    for &v in data {
        if !v.is_nan() && v.is_finite() {
            let v64 = v as f64;
            min = min.min(v64);
            max = max.max(v64);
        }
    }
    (min, max)
}

pub fn compute_stats_f64(data: &[f64]) -> (f64, f64) {
    let mut min = f64::INFINITY;
    let mut max = f64::NEG_INFINITY;
    for &v in data {
        if !v.is_nan() && v.is_finite() {
            min = min.min(v);
            max = max.max(v);
        }
    }
    (min, max)
}

// ---------------------------------------------------------------------------
// ImageStatsCalculator port (media/modules/normalization-helper.ts).
//
// These back the render-hot-path stats used by every format processor
// (min/max normalization) plus the on-demand "extended" stats (mean/std/
// valid & non-finite counts) shown in the Metadata panel. See
// The WASM adapter exposes these through `compute_image_stats_f32/u8/u16`;
// the plain-Rust logic lives here so it stays testable without a wasm runtime.
// ---------------------------------------------------------------------------

/// Full statistics accumulated over the scanned samples of an image. The WASM
/// adapter mirrors this as its small `ImageStats` result; native Rust callers
/// can use this struct directly.
pub struct RawImageStats {
    pub min: f64,
    pub max: f64,
    pub mean: f64,
    pub std: f64,
    pub valid_count: f64,
    pub non_finite_count: f64,
    pub total_count: f64,
}

/// The subset needed while decoding an image for its first render. Extended
/// mean/std statistics are calculated on demand by the metadata UI; doing
/// those f64 accumulations here made every large RGB decode pay for work whose
/// result was immediately discarded.
pub struct ImageRange {
    pub min: f64,
    pub max: f64,
    pub valid_count: f64,
    pub non_finite_count: f64,
}

/// How many leading channels of a pixel participate in stats scanning.
/// Mirrors the `scanChannels` convention shared by `calculateFloatStats`,
/// `calculateIntegerStats`, and `calculateExtendedStats` in the TS source:
/// channels <= 2 (mono, or gray+alpha where alpha must NOT skew the range)
/// scan just the first sample; channels >= 3 (RGB[A]) scan the first three,
/// ignoring any alpha/extra samples beyond that.
#[inline]
fn scan_channels(channels: u32) -> u32 {
    if channels <= 2 {
        1
    } else {
        channels.min(3)
    }
}

/// Min/max only, over the same scanned channels as `compute_image_range_f32`,
/// without the valid/non-finite counts.
///
/// Kept separate because the counting version cannot vectorize: `f32::min` has
/// NaN-propagation semantics and `is_finite()` adds a per-sample branch, which
/// together measured ~90ms on a 26M-sample mono image -- slower than the
/// JavaScript scan it was meant to replace. This version uses plain `<`/`>`
/// comparisons, which are false for NaN (so NaN is skipped exactly as
/// `Number.isFinite` skips it) and which LLVM turns into SIMD min/max. The rare
/// infinity case is fixed up with a second, careful pass rather than paid for on
/// every sample.
pub fn compute_min_max_f32(data: &[f32], width: u32, height: u32, channels: u32) -> (f64, f64) {
    let pixels = (width as usize).saturating_mul(height as usize);
    let stride = channels as usize;
    let scanned = scan_channels(channels) as usize;
    let mut min = f32::INFINITY;
    let mut max = f32::NEG_INFINITY;

    if stride <= 1 {
        for &value in &data[..pixels.min(data.len())] {
            if value < min {
                min = value;
            }
            if value > max {
                max = value;
            }
        }
    } else {
        for pixel in data.chunks(stride).take(pixels) {
            for &value in pixel.iter().take(scanned) {
                if value < min {
                    min = value;
                }
                if value > max {
                    max = value;
                }
            }
        }
    }

    // Infinities are legal float samples but must not become the display range;
    // the comparison loop above cannot exclude them, so redo the scan carefully
    // in that (rare) case only.
    if min.is_infinite() || max.is_infinite() {
        let range = compute_image_range_f32(data, width, height, channels);
        return (range.min, range.max);
    }
    (min as f64, max as f64)
}

pub fn compute_image_range_f32(data: &[f32], width: u32, height: u32, channels: u32) -> ImageRange {
    let pixels = (width as usize).saturating_mul(height as usize);
    let stride = channels as usize;
    let scanned = scan_channels(channels) as usize;
    let mut min = f32::INFINITY;
    let mut max = f32::NEG_INFINITY;
    let mut valid_count = 0usize;
    let mut non_finite_count = 0usize;

    // Mono float arrays are common (depth NPY/PFM/TIFF) and large. Avoid the
    // generic chunks/take iterator and per-sample f32->f64 conversion in this
    // bandwidth-bound path; every representable source extreme remains exact
    // when converted to f64 once at the end.
    if stride == 1 {
        let present = pixels.min(data.len());
        for &value in &data[..present] {
            if value.is_finite() {
                min = min.min(value);
                max = max.max(value);
                valid_count += 1;
            } else {
                non_finite_count += 1;
            }
        }
        non_finite_count += pixels.saturating_sub(present);
    } else {
        for pixel in data.chunks(stride.max(1)).take(pixels) {
            for &value in pixel.iter().take(scanned) {
                if value.is_finite() {
                    min = min.min(value);
                    max = max.max(value);
                    valid_count += 1;
                } else {
                    non_finite_count += 1;
                }
            }
            non_finite_count += scanned.saturating_sub(pixel.len());
        }
        let present_pixels = if stride == 0 {
            0
        } else {
            data.len().div_ceil(stride).min(pixels)
        };
        non_finite_count += pixels
            .saturating_sub(present_pixels)
            .saturating_mul(scanned);
    }

    ImageRange {
        min: min as f64,
        max: max as f64,
        valid_count: valid_count as f64,
        non_finite_count: non_finite_count as f64,
    }
}

pub fn compute_image_range_uint<T>(data: &[T], width: u32, height: u32, channels: u32) -> ImageRange
where
    T: Copy + Into<u32>,
{
    let pixels = (width as usize).saturating_mul(height as usize);
    let stride = channels as usize;
    let scanned = scan_channels(channels) as usize;
    let mut min = f64::INFINITY;
    let mut max = f64::NEG_INFINITY;
    let mut valid_count = 0usize;

    for pixel in data.chunks(stride.max(1)).take(pixels) {
        for &value in pixel.iter().take(scanned) {
            let value = value.into() as f64;
            min = min.min(value);
            max = max.max(value);
            valid_count += 1;
        }
    }

    ImageRange {
        min,
        max,
        valid_count: valid_count as f64,
        non_finite_count: 0.0,
    }
}

/// Shared f32 accumulation pass, ported from `calculateFloatStats` /
/// `calculateExtendedStats`. Non-finite samples (NaN, +Inf, -Inf) are
/// excluded from min/max/mean/std and counted separately — this is the
/// documented correctness invariant for this project (see CLAUDE.md's
/// `!Number.isFinite()` rule). Out-of-bounds reads (a `data` shorter than
/// `width * height * channels` implies) are treated the same as the TS
/// version's `undefined` reads: counted as non-finite, never touching
/// min/max/sum.
///
/// `extended` selects the "no valid samples" min/max fallback to match the
/// two different TS call sites: `calculateFloatStats` leaves the seeded
/// +/-Infinity in place (matches `compute_stats_f32` above), while
/// `calculateExtendedStats` reports NaN instead, consistent with its
/// NaN mean/std. Every other field (mean/std/counts) is computed the same
/// way regardless of `extended`; the two TS non-extended methods simply
/// never read them.
pub fn compute_image_stats_f32_impl(
    data: &[f32],
    width: u32,
    height: u32,
    channels: u32,
    extended: bool,
) -> RawImageStats {
    let len = (width as u64) * (height as u64);
    let scan_ch = scan_channels(channels);

    let mut min = f64::INFINITY;
    let mut max = f64::NEG_INFINITY;
    let mut sum = 0.0f64;
    let mut sum_sq = 0.0f64;
    let mut valid_count: f64 = 0.0;
    let mut non_finite_count: f64 = 0.0;

    for i in 0..len {
        let base = i * (channels as u64);
        for c in 0..scan_ch {
            let idx = (base + c as u64) as usize;
            let sample = data.get(idx).copied();
            match sample {
                Some(v) if v.is_finite() => {
                    let v64 = v as f64;
                    if v64 < min {
                        min = v64;
                    }
                    if v64 > max {
                        max = v64;
                    }
                    sum += v64;
                    sum_sq += v64 * v64;
                    valid_count += 1.0;
                }
                _ => {
                    non_finite_count += 1.0;
                }
            }
        }
    }

    let total_count = (len * (scan_ch as u64)) as f64;
    let mean = if valid_count > 0.0 {
        sum / valid_count
    } else {
        f64::NAN
    };
    let variance = if valid_count > 0.0 {
        (sum_sq / valid_count - mean * mean).max(0.0)
    } else {
        f64::NAN
    };
    let std = variance.sqrt();

    let (out_min, out_max) = if extended {
        if valid_count > 0.0 {
            (min, max)
        } else {
            (f64::NAN, f64::NAN)
        }
    } else {
        (min, max)
    };

    RawImageStats {
        min: out_min,
        max: out_max,
        mean,
        std,
        valid_count,
        non_finite_count,
        total_count,
    }
}

/// Shared unsigned-integer accumulation pass, ported from
/// `calculateIntegerStats`. Integers have no non-finite concept, so
/// `non_finite_count` is always 0 and `valid_count == total_count`.
///
/// `rgb_as_24bit` (only takes effect when `channels >= 3`, matching the TS
/// `rgbAs24Bit && channels >= 3` guard) packs the first three channels of
/// each pixel into one value as `(r << 16) | (g << 8) | b`, ignoring any
/// 4th (alpha) channel — the same packing `calculateIntegerStats` uses for
/// the depth-as-RGB24 render mode. Otherwise the plain `scan_channels`
/// convention applies, same as the float path.
pub fn compute_image_stats_uint_impl<T>(
    data: &[T],
    width: u32,
    height: u32,
    channels: u32,
    rgb_as_24bit: bool,
) -> RawImageStats
where
    T: Copy + Into<u32>,
{
    let len = (width as u64) * (height as u64);

    let mut min = f64::INFINITY;
    let mut max = f64::NEG_INFINITY;
    let mut sum = 0.0f64;
    let mut sum_sq = 0.0f64;
    let mut valid_count: f64 = 0.0;

    if rgb_as_24bit && channels >= 3 {
        for i in 0..len {
            let idx = (i * (channels as u64)) as usize;
            let (r, g, b) = match (data.get(idx), data.get(idx + 1), data.get(idx + 2)) {
                (Some(&r), Some(&g), Some(&b)) => (r, g, b),
                _ => continue,
            };
            let val24 = ((r.into()) << 16) | ((g.into()) << 8) | (b.into());
            let v64 = val24 as f64;
            if v64 < min {
                min = v64;
            }
            if v64 > max {
                max = v64;
            }
            sum += v64;
            sum_sq += v64 * v64;
            valid_count += 1.0;
        }

        return RawImageStats {
            min,
            max,
            mean: if valid_count > 0.0 {
                sum / valid_count
            } else {
                f64::NAN
            },
            std: if valid_count > 0.0 {
                (sum_sq / valid_count - (sum / valid_count) * (sum / valid_count))
                    .max(0.0)
                    .sqrt()
            } else {
                f64::NAN
            },
            valid_count,
            non_finite_count: 0.0,
            total_count: valid_count,
        };
    }

    let scan_ch = scan_channels(channels);
    for i in 0..len {
        let base = i * (channels as u64);
        for c in 0..scan_ch {
            let idx = (base + c as u64) as usize;
            let Some(&v) = data.get(idx) else { continue };
            let v64: u32 = v.into();
            let v64 = v64 as f64;
            if v64 < min {
                min = v64;
            }
            if v64 > max {
                max = v64;
            }
            sum += v64;
            sum_sq += v64 * v64;
            valid_count += 1.0;
        }
    }

    let mean = if valid_count > 0.0 {
        sum / valid_count
    } else {
        f64::NAN
    };
    let variance = if valid_count > 0.0 {
        (sum_sq / valid_count - mean * mean).max(0.0)
    } else {
        f64::NAN
    };

    RawImageStats {
        min,
        max,
        mean,
        std: variance.sqrt(),
        valid_count,
        non_finite_count: 0.0,
        total_count: valid_count,
    }
}
