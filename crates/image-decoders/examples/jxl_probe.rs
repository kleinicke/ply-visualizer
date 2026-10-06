//! Run with: cargo run --no-default-features --features jxl --example jxl_probe -- FILE...
//!
//! `jxl` is not in `all-formats`, so the feature has to be named explicitly.
use scientific_image_decoders::decode_jxl_fast;
fn main() {
    for path in std::env::args().skip(1) {
        let bytes = std::fs::read(&path).unwrap();
        let name = path.rsplit('/').next().unwrap_or(&path).to_string();
        match decode_jxl_fast(&bytes) {
            Ok(mut d) => {
                let (w, h, c, b, sf) = (
                    d.width(),
                    d.height(),
                    d.channels(),
                    d.bits_per_sample(),
                    d.sample_format(),
                );
                let ty = d.source_numeric_type();
                let data = d.take_data_as_f32().unwrap_or_default();
                println!(
                    "{:24} {}x{}x{} bits={} sf={} {} n={} first={:?}",
                    name,
                    w,
                    h,
                    c,
                    b,
                    sf,
                    ty,
                    data.len(),
                    &data[..6.min(data.len())]
                );
            }
            Err(e) => println!("{:24} ERROR {}", name, e.message()),
        }
    }
}
