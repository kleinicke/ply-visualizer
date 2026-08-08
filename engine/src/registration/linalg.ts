/**
 * Small dense linear algebra for the registration solvers.
 *
 * Everything here is sized for the fixed, tiny systems registration produces —
 * a 4x4 profile matrix (Horn), a 3x3 covariance (normal estimation) and a 6x6
 * normal-equation system (point-to-plane ICP). There is no general matrix type
 * on purpose: these run inside iteration loops, so they take and return plain
 * arrays and allocate nothing the caller cannot hoist.
 */

/**
 * Cyclic Jacobi eigen decomposition of a symmetric `n x n` matrix.
 *
 * `matrix` is row-major and is not modified. Returns eigenvalues and the
 * matching eigenvectors as rows of `vectors` (row `i` is the unit eigenvector
 * for `values[i]`), sorted by descending eigenvalue.
 *
 * Jacobi rather than a closed form because it is unconditionally stable for
 * the near-degenerate inputs both callers hit in practice: collinear picked
 * correspondences, and PCA neighborhoods on a flat wall where two of the three
 * eigenvalues coincide.
 */
export function symmetricEigen(
  matrix: readonly number[],
  n: number
): { values: number[]; vectors: number[][] } {
  const a = matrix.slice();
  // Eigenvector accumulator, starts as identity.
  const v = new Array<number>(n * n).fill(0);
  for (let i = 0; i < n; i++) {
    v[i * n + i] = 1;
  }

  for (let sweep = 0; sweep < 64; sweep++) {
    let off = 0;
    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        off += a[p * n + q] * a[p * n + q];
      }
    }
    if (off < 1e-24) {
      break;
    }

    for (let p = 0; p < n - 1; p++) {
      for (let q = p + 1; q < n; q++) {
        const apq = a[p * n + q];
        if (Math.abs(apq) < 1e-30) {
          continue;
        }
        const app = a[p * n + p];
        const aqq = a[q * n + q];
        // Rotation angle that zeroes a[p][q]; the `t` formula is the numerically
        // stable branch of the quadratic (smaller root), which keeps |t| <= 1.
        const theta = (aqq - app) / (2 * apq);
        const sign = theta >= 0 ? 1 : -1;
        const t = sign / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1);
        const s = t * c;

        for (let k = 0; k < n; k++) {
          const akp = a[k * n + p];
          const akq = a[k * n + q];
          a[k * n + p] = c * akp - s * akq;
          a[k * n + q] = s * akp + c * akq;
        }
        for (let k = 0; k < n; k++) {
          const apk = a[p * n + k];
          const aqk = a[q * n + k];
          a[p * n + k] = c * apk - s * aqk;
          a[q * n + k] = s * apk + c * aqk;
        }
        for (let k = 0; k < n; k++) {
          const vkp = v[k * n + p];
          const vkq = v[k * n + q];
          v[k * n + p] = c * vkp - s * vkq;
          v[k * n + q] = s * vkp + c * vkq;
        }
      }
    }
  }

  const order = Array.from({ length: n }, (_, i) => i).sort((x, y) => a[y * n + y] - a[x * n + x]);
  return {
    values: order.map(i => a[i * n + i]),
    // Eigenvectors live in the columns of `v`; transpose them out to rows so
    // callers can use `vectors[0]` without knowing the storage order.
    vectors: order.map(i => Array.from({ length: n }, (_, k) => v[k * n + i])),
  };
}

/**
 * Solves `A x = b` for a symmetric positive-definite `A` (row-major `n x n`)
 * by Cholesky decomposition. Returns null when `A` is not positive definite,
 * which for ICP means the correspondences left the pose under-constrained
 * (too few, or all on one plane) and the step must be refused rather than
 * taken with a garbage direction.
 *
 * `A` and `b` are not modified.
 */
export function solveSymmetricPositiveDefinite(
  A: readonly number[],
  b: readonly number[],
  n: number
): number[] | null {
  const L = new Array<number>(n * n).fill(0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j <= i; j++) {
      let sum = A[i * n + j];
      for (let k = 0; k < j; k++) {
        sum -= L[i * n + k] * L[j * n + k];
      }
      if (i === j) {
        if (!(sum > 1e-12)) {
          return null;
        }
        L[i * n + i] = Math.sqrt(sum);
      } else {
        L[i * n + j] = sum / L[j * n + j];
      }
    }
  }

  // Forward substitution, then back substitution.
  const y = new Array<number>(n).fill(0);
  for (let i = 0; i < n; i++) {
    let sum = b[i];
    for (let k = 0; k < i; k++) {
      sum -= L[i * n + k] * y[k];
    }
    y[i] = sum / L[i * n + i];
  }
  const x = new Array<number>(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let sum = y[i];
    for (let k = i + 1; k < n; k++) {
      sum -= L[k * n + i] * x[k];
    }
    x[i] = sum / L[i * n + i];
  }
  return x;
}
