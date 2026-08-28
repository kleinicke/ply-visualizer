//! Times `parse_ply` on a real file, natively.
//!
//! The browser number includes two copies the parser itself does not do — the
//! file into wasm memory and the buffers back out — so this exists to say how
//! much of a load is the parse loop and how much is the boundary.
//!
//! `cargo run --release --example bench_ply -- <file.ply> [runs]`

use std::time::Instant;

fn main() {
    let mut args = std::env::args().skip(1);
    let path = args.next().expect("usage: bench_ply <file.ply> [runs]");
    let runs: usize = args.next().and_then(|s| s.parse().ok()).unwrap_or(3);

    let read_start = Instant::now();
    let bytes = std::fs::read(&path).expect("read file");
    println!(
        "read {:.1} MB in {:.1}ms",
        bytes.len() as f64 / 1048576.0,
        read_start.elapsed().as_secs_f64() * 1000.0
    );

    for run in 1..=runs {
        let start = Instant::now();
        let result = pointcloud_parser::parse_ply_native(&bytes).expect("parse");
        let ms = start.elapsed().as_secs_f64() * 1000.0;
        println!(
            "run {run}: parse {:.1}ms ({} vertices, {} faces)",
            ms, result.0, result.1
        );
    }
}
