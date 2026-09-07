//! Point-region predicates. Indices always refer to the decoded input cloud.
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn select_point_indices(
    positions: &[f32],
    values: &[f32],
    accepted: &[f32],
    matrix: &[f64],
    bounds: &[f64],
    plane: &[f64],
) -> Vec<u32> {
    if matrix.len() != 16
        || (!bounds.is_empty() && bounds.len() != 6)
        || (!plane.is_empty() && plane.len() != 4)
    {
        return Vec::new();
    }
    positions
        .chunks_exact(3)
        .enumerate()
        .filter_map(|(i, p)| {
            if !accepted.is_empty() && !values.get(i).is_some_and(|v| accepted.contains(v)) {
                return None;
            }
            let world: [f64; 3] = std::array::from_fn(|axis| {
                matrix[axis] * p[0] as f64
                    + matrix[axis + 4] * p[1] as f64
                    + matrix[axis + 8] * p[2] as f64
                    + matrix[axis + 12]
            });
            if world.iter().any(|v| !v.is_finite()) {
                return None;
            }
            if !bounds.is_empty()
                && (0..3).any(|k| world[k] < bounds[k] || world[k] > bounds[k + 3])
            {
                return None;
            }
            if !plane.is_empty()
                && (0..3).map(|k| world[k] * plane[k]).sum::<f64>() + plane[3] < 0.0
            {
                return None;
            }
            Some(i as u32)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn label_box_and_plane_intersect_in_world_space() {
        let m = [
            1., 0., 0., 0., 0., 1., 0., 0., 0., 0., 1., 0., 10., 0., 0., 1.,
        ];
        let p = [0., 0., 0., 1., 0., 0., 2., 0., 0.];
        assert_eq!(
            select_point_indices(
                &p,
                &[2., 1., 2.],
                &[2.],
                &m,
                &[9., -1., -1., 12., 1., 1.],
                &[1., 0., 0., -11.]
            ),
            vec![2]
        );
        assert!(select_point_indices(&p, &[], &[2.], &m, &[], &[]).is_empty());
    }
}

/// Bounded attribute discovery: continuous fields never produce huge tool replies.
#[wasm_bindgen]
pub fn scalar_summary(values: &[f32]) -> String {
    let mut categories = std::collections::BTreeMap::<String, usize>::new();
    let (mut min, mut max, mut finite) = (f32::INFINITY, f32::NEG_INFINITY, 0usize);
    let mut truncated = false;
    for &v in values {
        if !v.is_finite() {
            continue;
        }
        finite += 1;
        min = min.min(v);
        max = max.max(v);
        let key = v.to_string();
        if let Some(count) = categories.get_mut(&key) {
            *count += 1;
        } else if categories.len() < 64 {
            categories.insert(key, 1);
        } else {
            truncated = true;
        }
    }
    serde_json::json!({"min": if finite > 0 { Some(min) } else { None }, "max": if finite > 0 { Some(max) } else { None }, "finite_count": finite, "nonfinite_count": values.len()-finite, "value_counts": categories, "values_truncated": truncated, "storage": "float32"}).to_string()
}
