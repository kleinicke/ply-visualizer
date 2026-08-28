//! Minimal in-place radix-2 complex FFT, sized for the coarse-alignment
//! rasters. Hand-rolled rather than a dependency: the whole requirement is a
//! power-of-two 2-D transform of a 128x128 or 256x256 grid.

/// In-place 1-D transform of one strided run. `length` must be a power of two.
fn fft1d(
    re: &mut [f64],
    im: &mut [f64],
    offset: usize,
    stride: usize,
    length: usize,
    inverse: bool,
) {
    // Bit-reversal permutation.
    let mut j = 0usize;
    for i in 1..length {
        let mut bit = length >> 1;
        while j & bit != 0 {
            j ^= bit;
            bit >>= 1;
        }
        j ^= bit;
        if i < j {
            let a = offset + i * stride;
            let b = offset + j * stride;
            re.swap(a, b);
            im.swap(a, b);
        }
    }

    let sign = if inverse { 1.0 } else { -1.0 };
    let mut len = 2;
    while len <= length {
        let angle = sign * 2.0 * std::f64::consts::PI / len as f64;
        let (w_re, w_im) = (angle.cos(), angle.sin());
        let half = len / 2;
        let mut start = 0;
        while start < length {
            let (mut cur_re, mut cur_im) = (1.0f64, 0.0f64);
            for k in 0..half {
                let a = offset + (start + k) * stride;
                let b = offset + (start + k + half) * stride;
                let (even_re, even_im) = (re[a], im[a]);
                let odd_re = re[b] * cur_re - im[b] * cur_im;
                let odd_im = re[b] * cur_im + im[b] * cur_re;
                re[a] = even_re + odd_re;
                im[a] = even_im + odd_im;
                re[b] = even_re - odd_re;
                im[b] = even_im - odd_im;
                let next_re = cur_re * w_re - cur_im * w_im;
                cur_im = cur_re * w_im + cur_im * w_re;
                cur_re = next_re;
            }
            start += len;
        }
        len <<= 1;
    }

    if inverse {
        for i in 0..length {
            let index = offset + i * stride;
            re[index] /= length as f64;
            im[index] /= length as f64;
        }
    }
}

/// In-place 2-D transform of an `n x n` row-major complex grid. `n` must be a
/// power of two.
pub fn fft2d(re: &mut [f64], im: &mut [f64], n: usize, inverse: bool) {
    for row in 0..n {
        fft1d(re, im, row * n, 1, n, inverse);
    }
    for column in 0..n {
        fft1d(re, im, column, n, n, inverse);
    }
}
