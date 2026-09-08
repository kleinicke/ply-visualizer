//! Agent inspection kernels: exact index sets, provenance-preserving export and bounded distances.
use crate::registration::point_index::PointGrid;
use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub fn combine_point_indices(a: &[u32], b: &[u32], operation: &str) -> Vec<u32> {
    let left: std::collections::BTreeSet<u32> = a.iter().copied().collect();
    let right: std::collections::BTreeSet<u32> = b.iter().copied().collect();
    match operation {
        "union" => left.union(&right).copied().collect(),
        "intersection" => left.intersection(&right).copied().collect(),
        "subtract" => left.difference(&right).copied().collect(),
        _ => Vec::new(),
    }
}

#[wasm_bindgen]
pub fn inspection_fingerprint(points: &[f32]) -> String {
    let mut hash = 0xcbf29ce484222325u64;
    for v in points {
        for byte in v.to_bits().to_le_bytes() {
            hash = (hash ^ byte as u64).wrapping_mul(0x100000001b3);
        }
    }
    format!("{hash:016x}")
}

#[wasm_bindgen]
pub fn point_distances(source: &[f32], target: &[f32], radius: f64, paired: bool) -> Vec<f32> {
    if !radius.is_finite() || radius <= 0.0 || source.len() % 3 != 0 || target.len() % 3 != 0 {
        return Vec::new();
    }
    if paired && source.len() != target.len() {
        return Vec::new();
    }
    let grid = if paired {
        None
    } else {
        Some(PointGrid::new(target.to_vec(), radius))
    };
    source
        .chunks_exact(3)
        .enumerate()
        .map(|(i, p)| {
            let index = if paired {
                Some(i)
            } else {
                grid.as_ref()
                    .unwrap()
                    .nearest(p[0] as f64, p[1] as f64, p[2] as f64, radius)
            };
            index
                .map(|j| {
                    ((0..3)
                        .map(|k| (p[k] as f64 - target[j * 3 + k] as f64).powi(2))
                        .sum::<f64>()
                        .sqrt()) as f32
                })
                .unwrap_or(f32::NAN)
        })
        .collect()
}

#[wasm_bindgen]
pub fn export_inspection_ply(
    positions: &[f32],
    colors: &[u8],
    normals: &[f32],
    scalars: &[f32],
    names_json: &str,
    decoded: &[u32],
    original: &[u32],
    metadata: &str,
) -> Vec<u8> {
    let n = positions.len() / 3;
    let names: Vec<String> = serde_json::from_str(names_json).unwrap_or_default();
    if positions.len() % 3 != 0
        || decoded.len() != n
        || (!original.is_empty() && original.len() != n)
        || scalars.len() != names.len() * n
    {
        return Vec::new();
    }
    let color = colors.len() == n * 3 && n > 0;
    let normal = normals.len() == n * 3 && n > 0;
    let mut header = format!("ply\nformat binary_little_endian 1.0\ncomment inspection {}\ncomment scalar_names {}\nelement vertex {}\nproperty float x\nproperty float y\nproperty float z\n", metadata.replace(['\r','\n'], " "), names_json.replace(['\r','\n'], " "), n);
    if color {
        header.push_str("property uchar red\nproperty uchar green\nproperty uchar blue\n");
    }
    if normal {
        header.push_str("property float nx\nproperty float ny\nproperty float nz\n");
    }
    // Preserve ordinary field names (e.g. label). Encode unusual/reserved names with an explicit mapping comment.
    let reserved = [
        "x",
        "y",
        "z",
        "red",
        "green",
        "blue",
        "nx",
        "ny",
        "nz",
        "decoded_index",
        "source_row",
    ];
    let mut used: std::collections::HashSet<String> =
        reserved.into_iter().map(str::to_owned).collect();
    let mut properties = Vec::new();
    for (i, name) in names.iter().enumerate() {
        let mut prop = name.clone();
        if prop.is_empty()
            || !prop.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
            || used.contains(&prop)
        {
            prop = format!("attribute_{i}");
            while used.contains(&prop) || names.contains(&prop) {
                prop.push('_');
            }
        }
        used.insert(prop.clone());
        header.push_str(&format!("property float {prop}\n"));
        properties.push(prop);
    }
    header.push_str(&format!(
        "comment scalar_properties {}\nproperty uint decoded_index\n",
        serde_json::to_string(&properties).unwrap()
    ));
    if !original.is_empty() {
        header.push_str("property uint source_row\n");
    }
    header.push_str("end_header\n");
    let mut out = header.into_bytes();
    for i in 0..n {
        for v in &positions[i * 3..i * 3 + 3] {
            out.extend_from_slice(&v.to_le_bytes());
        }
        if color {
            out.extend_from_slice(&colors[i * 3..i * 3 + 3]);
        }
        if normal {
            for v in &normals[i * 3..i * 3 + 3] {
                out.extend_from_slice(&v.to_le_bytes());
            }
        }
        for field in 0..names.len() {
            out.extend_from_slice(&scalars[field * n + i].to_le_bytes());
        }
        out.extend_from_slice(&decoded[i].to_le_bytes());
        if !original.is_empty() {
            out.extend_from_slice(&original[i].to_le_bytes());
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn set_operations_and_distances() {
        assert_eq!(
            combine_point_indices(&[3, 1, 1], &[2, 3], "union"),
            vec![1, 2, 3]
        );
        assert_eq!(
            combine_point_indices(&[3, 1], &[2, 3], "intersection"),
            vec![3]
        );
        assert_eq!(combine_point_indices(&[3, 1], &[2, 3], "subtract"), vec![1]);
        assert_eq!(
            point_distances(&[0., 0., 0.], &[3., 4., 0.], 10., false),
            vec![5.]
        );
        assert!(point_distances(&[0., 0., 0.], &[3., 4., 0.], 1., false)[0].is_nan());
        assert_eq!(
            point_distances(&[0., 0., 0.], &[3., 4., 0.], 1., true),
            vec![5.]
        );
    }
    #[test]
    fn export_preserves_u32_provenance_and_fields() {
        let out = export_inspection_ply(
            &[1., 2., 3.],
            &[10, 20, 30],
            &[],
            &[20.],
            "[\"label\"]",
            &[16777217],
            &[16777219],
            "{}",
        );
        assert!(String::from_utf8_lossy(&out).contains("property float label"));
        assert_eq!(
            &out[out.len() - 8..out.len() - 4],
            &16777217u32.to_le_bytes()
        );
        assert_eq!(&out[out.len() - 4..], &16777219u32.to_le_bytes());
    }
}
