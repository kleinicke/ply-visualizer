//! Small dense linear algebra for the registration solvers.
//!
//! Sized for the fixed, tiny systems registration produces: a 4x4 profile
//! matrix (Horn), a 3x3 covariance (normal estimation) and a 6x6
//! normal-equation system (point-to-plane ICP). Fixed-size stack arrays, no
//! allocation, because these run inside the iteration loops.

/// Cyclic Jacobi eigen decomposition of a symmetric `N x N` matrix.
///
/// `matrix` is row-major. Returns eigenvalues and matching eigenvectors as
/// rows, sorted by descending eigenvalue.
///
/// Jacobi rather than a closed form because it is unconditionally stable for
/// the near-degenerate inputs both callers hit in practice: collinear picked
/// correspondences, and PCA neighbourhoods on a flat wall where two of the
/// three eigenvalues coincide.
pub fn symmetric_eigen<const N: usize>(matrix: &[f64]) -> ([f64; N], [[f64; N]; N]) {
    debug_assert_eq!(matrix.len(), N * N);
    let mut a = [[0.0f64; N]; N];
    for row in 0..N {
        a[row][..N].copy_from_slice(&matrix[row * N..row * N + N]);
    }
    let mut v = [[0.0f64; N]; N];
    for (i, row) in v.iter_mut().enumerate() {
        row[i] = 1.0;
    }

    for _ in 0..64 {
        let mut off = 0.0;
        for p in 0..N.saturating_sub(1) {
            for q in (p + 1)..N {
                off += a[p][q] * a[p][q];
            }
        }
        if off < 1e-24 {
            break;
        }

        for p in 0..N.saturating_sub(1) {
            for q in (p + 1)..N {
                let apq = a[p][q];
                if apq.abs() < 1e-30 {
                    continue;
                }
                // Rotation angle that zeroes a[p][q]; `t` is the numerically
                // stable (smaller) root of the quadratic, so |t| <= 1.
                let theta = (a[q][q] - a[p][p]) / (2.0 * apq);
                let sign = if theta >= 0.0 { 1.0 } else { -1.0 };
                let t = sign / (theta.abs() + (theta * theta + 1.0).sqrt());
                let c = 1.0 / (t * t + 1.0).sqrt();
                let s = t * c;

                for row in a.iter_mut() {
                    let (akp, akq) = (row[p], row[q]);
                    row[p] = c * akp - s * akq;
                    row[q] = s * akp + c * akq;
                }
                for k in 0..N {
                    let (apk, aqk) = (a[p][k], a[q][k]);
                    a[p][k] = c * apk - s * aqk;
                    a[q][k] = s * apk + c * aqk;
                }
                for row in v.iter_mut() {
                    let (vkp, vkq) = (row[p], row[q]);
                    row[p] = c * vkp - s * vkq;
                    row[q] = s * vkp + c * vkq;
                }
            }
        }
    }

    let mut order: [usize; N] = [0; N];
    for (i, slot) in order.iter_mut().enumerate() {
        *slot = i;
    }
    order.sort_by(|&x, &y| a[y][y].total_cmp(&a[x][x]));

    let mut values = [0.0f64; N];
    let mut vectors = [[0.0f64; N]; N];
    for (rank, &index) in order.iter().enumerate() {
        values[rank] = a[index][index];
        // Eigenvectors live in the columns of `v`; transpose them out to rows.
        for k in 0..N {
            vectors[rank][k] = v[k][index];
        }
    }
    (values, vectors)
}

/// Solves `A x = b` for a symmetric positive-definite row-major `A` by
/// Cholesky decomposition.
///
/// Returns `None` when `A` is not positive definite, which for ICP means the
/// correspondences left the pose under-constrained (too few, or all on one
/// plane) and the step must be refused rather than taken in a garbage
/// direction.
pub fn solve_spd<const N: usize>(a: &[f64], b: &[f64]) -> Option<[f64; N]> {
    debug_assert_eq!(a.len(), N * N);
    debug_assert_eq!(b.len(), N);
    let mut l = [[0.0f64; N]; N];
    for i in 0..N {
        for j in 0..=i {
            let mut sum = a[i * N + j];
            for k in 0..j {
                sum -= l[i][k] * l[j][k];
            }
            if i == j {
                if !(sum > 1e-12) {
                    return None;
                }
                l[i][i] = sum.sqrt();
            } else {
                l[i][j] = sum / l[j][j];
            }
        }
    }

    let mut y = [0.0f64; N];
    for i in 0..N {
        let mut sum = b[i];
        for k in 0..i {
            sum -= l[i][k] * y[k];
        }
        y[i] = sum / l[i][i];
    }
    let mut x = [0.0f64; N];
    for i in (0..N).rev() {
        let mut sum = y[i];
        for k in (i + 1)..N {
            sum -= l[k][i] * x[k];
        }
        x[i] = sum / l[i][i];
    }
    Some(x)
}

/// Column-major 4x4 transform, matching three.js `Matrix4.elements` so poses
/// cross the wasm boundary without a layout conversion.
#[derive(Clone, Copy, Debug)]
pub struct Mat4(pub [f64; 16]);

impl Mat4 {
    pub fn identity() -> Self {
        let mut m = [0.0; 16];
        m[0] = 1.0;
        m[5] = 1.0;
        m[10] = 1.0;
        m[15] = 1.0;
        Mat4(m)
    }

    pub fn from_slice(values: &[f64]) -> Self {
        let mut m = [0.0; 16];
        m.copy_from_slice(&values[..16]);
        Mat4(m)
    }

    pub fn translation(x: f64, y: f64, z: f64) -> Self {
        let mut m = Self::identity();
        m.0[12] = x;
        m.0[13] = y;
        m.0[14] = z;
        m
    }

    /// Right-handed rotation of `angle` radians about a unit `axis`.
    pub fn rotation_axis(axis: [f64; 3], angle: f64) -> Self {
        let (x, y, z) = (axis[0], axis[1], axis[2]);
        let (c, s) = (angle.cos(), angle.sin());
        let t = 1.0 - c;
        let mut m = Self::identity();
        m.0[0] = t * x * x + c;
        m.0[1] = t * x * y + s * z;
        m.0[2] = t * x * z - s * y;
        m.0[4] = t * x * y - s * z;
        m.0[5] = t * y * y + c;
        m.0[6] = t * y * z + s * x;
        m.0[8] = t * x * z + s * y;
        m.0[9] = t * y * z - s * x;
        m.0[10] = t * z * z + c;
        m
    }

    /// Rotation from a unit quaternion `(x, y, z, w)`.
    pub fn from_quaternion(q: [f64; 4]) -> Self {
        let (x, y, z, w) = (q[0], q[1], q[2], q[3]);
        let mut m = Self::identity();
        m.0[0] = 1.0 - 2.0 * (y * y + z * z);
        m.0[1] = 2.0 * (x * y + z * w);
        m.0[2] = 2.0 * (x * z - y * w);
        m.0[4] = 2.0 * (x * y - z * w);
        m.0[5] = 1.0 - 2.0 * (x * x + z * z);
        m.0[6] = 2.0 * (y * z + x * w);
        m.0[8] = 2.0 * (x * z + y * w);
        m.0[9] = 2.0 * (y * z - x * w);
        m.0[10] = 1.0 - 2.0 * (x * x + y * y);
        m
    }

    /// `self * other`, i.e. `other` applied first.
    pub fn multiply(&self, other: &Mat4) -> Mat4 {
        let (a, b) = (&self.0, &other.0);
        let mut m = [0.0f64; 16];
        for column in 0..4 {
            for row in 0..4 {
                let mut sum = 0.0;
                for k in 0..4 {
                    sum += a[k * 4 + row] * b[column * 4 + k];
                }
                m[column * 4 + row] = sum;
            }
        }
        Mat4(m)
    }

    pub fn apply(&self, point: [f32; 3]) -> [f32; 3] {
        let m = &self.0;
        let (x, y, z) = (point[0] as f64, point[1] as f64, point[2] as f64);
        [
            (m[0] * x + m[4] * y + m[8] * z + m[12]) as f32,
            (m[1] * x + m[5] * y + m[9] * z + m[13]) as f32,
            (m[2] * x + m[6] * y + m[10] * z + m[14]) as f32,
        ]
    }

    pub fn set_position(&mut self, x: f64, y: f64, z: f64) {
        self.0[12] = x;
        self.0[13] = y;
        self.0[14] = z;
    }
}
