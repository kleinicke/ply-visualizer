//! Report what a CZI decode asks for, to tell a genuinely large mosaic apart
//! from a misparsed extent.
use scientific_image_decoders::decode_czi_fast;
fn main() {
    for path in std::env::args().skip(1) {
        let name = path.rsplit('/').next().unwrap_or(&path).to_string();
        let bytes = std::fs::read(&path).expect("read");
        match decode_czi_fast(&bytes, "{}") {
            Ok(d) => println!(
                "{:46} {}x{} ch={} -> {} samples ({:.1} GB as f32)",
                name,
                d.width(),
                d.height(),
                d.channels(),
                d.width() as u64 * d.height() as u64 * d.channels() as u64,
                (d.width() as f64 * d.height() as f64 * d.channels() as f64 * 4.0) / 1073741824.0
            ),
            Err(e) => println!("{:46} ERROR: {}", name, e.message()),
        }
    }
}
