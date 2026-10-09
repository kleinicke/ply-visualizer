//! Times one automatic pair registration natively, split into the coarse yaw
//! sweep and the whole `register_pair` call.
//!
//! `cargo run --release --example bench_register -- <fixed.ply> <moving.ply> [runs]`
//! Clouds are strided to the viewer's 400k solver cap, as `worldPoints` does.

use std::time::Instant;

fn load(path: &str) -> Vec<f32> {
    let bytes = std::fs::read(path).expect("read file");
    let mut result = pointcloud_parser::parse_ply(&bytes).expect("parse");
    let positions = result.take_positions();
    let count = positions.len() / 3;
    let stride = count.div_ceil(400_000).max(1);
    positions
        .chunks_exact(3)
        .step_by(stride)
        .flatten()
        .copied()
        .collect()
}

fn main() {
    let mut args = std::env::args().skip(1);
    let fixed = load(&args.next().expect("fixed.ply"));
    let moving = load(&args.next().expect("moving.ply"));
    let runs: usize = args.next().and_then(|s| s.parse().ok()).unwrap_or(3);
    println!(
        "fixed {} pts, moving {} pts",
        fixed.len() / 3,
        moving.len() / 3
    );
    for run in 1..=runs {
        // What the viewer's align-all sends.
        let settings = r#"{"coarse":{"upAxis":"z"},"icp":{}}"#;
        let start = Instant::now();
        let coarse = pointcloud_parser::coarse_align(&moving, &fixed, r#"{"upAxis":"z"}"#);
        let coarse_ms = start.elapsed().as_secs_f64() * 1000.0;
        let start = Instant::now();
        let result = pointcloud_parser::register_pair(&moving, &fixed, settings);
        let total_ms = start.elapsed().as_secs_f64() * 1000.0;
        println!(
            "run {run}: coarse {coarse_ms:.0}ms · register_pair {total_ms:.0}ms · coarse ok {} · {}",
            coarse.is_some(),
            result.map(|r| r.stats()).unwrap_or_default()
        );
    }
}
