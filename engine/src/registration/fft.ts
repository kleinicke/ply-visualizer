/**
 * Minimal in-place radix-2 complex FFT, sized for the coarse-alignment rasters.
 *
 * Vendored rather than pulled in as a dependency: the whole requirement is a
 * power-of-two 2-D transform of a 128x128 or 256x256 grid, and the extension
 * bundle should not grow a numerics package for sixty lines of Cooley-Tukey.
 */

/** In-place 1-D transform of one strided run. `length` must be a power of two. */
function fft1d(
  re: Float64Array,
  im: Float64Array,
  offset: number,
  stride: number,
  length: number,
  inverse: boolean
): void {
  // Bit-reversal permutation.
  for (let i = 1, j = 0; i < length; i++) {
    let bit = length >> 1;
    for (; j & bit; bit >>= 1) {
      j ^= bit;
    }
    j ^= bit;
    if (i < j) {
      const a = offset + i * stride;
      const b = offset + j * stride;
      const tr = re[a];
      const ti = im[a];
      re[a] = re[b];
      im[a] = im[b];
      re[b] = tr;
      im[b] = ti;
    }
  }

  const sign = inverse ? 1 : -1;
  for (let len = 2; len <= length; len <<= 1) {
    const angle = (sign * 2 * Math.PI) / len;
    const wRe = Math.cos(angle);
    const wIm = Math.sin(angle);
    for (let start = 0; start < length; start += len) {
      let curRe = 1;
      let curIm = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = offset + (start + k) * stride;
        const b = offset + (start + k + len / 2) * stride;
        const evenRe = re[a];
        const evenIm = im[a];
        const oddRe = re[b] * curRe - im[b] * curIm;
        const oddIm = re[b] * curIm + im[b] * curRe;
        re[a] = evenRe + oddRe;
        im[a] = evenIm + oddIm;
        re[b] = evenRe - oddRe;
        im[b] = evenIm - oddIm;
        const nextRe = curRe * wRe - curIm * wIm;
        curIm = curRe * wIm + curIm * wRe;
        curRe = nextRe;
      }
    }
  }

  if (inverse) {
    for (let i = 0; i < length; i++) {
      const index = offset + i * stride;
      re[index] /= length;
      im[index] /= length;
    }
  }
}

/**
 * In-place 2-D transform of an `n x n` row-major complex grid.
 * `n` must be a power of two.
 */
export function fft2d(re: Float64Array, im: Float64Array, n: number, inverse: boolean): void {
  for (let row = 0; row < n; row++) {
    fft1d(re, im, row * n, 1, n, inverse);
  }
  for (let column = 0; column < n; column++) {
    fft1d(re, im, column, n, n, inverse);
  }
}
