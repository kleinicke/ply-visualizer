use scientific_image_decoders::decode_jpegxr_fast;
fn main() {
    for path in std::env::args().skip(1) {
        let bytes = std::fs::read(&path).unwrap();
        let name = path.rsplit('/').next().unwrap_or(&path).to_string();
        match decode_jpegxr_fast(&bytes) {
            Ok(mut d) => {
                let (w, h, c, b, sf) = (
                    d.width(),
                    d.height(),
                    d.channels(),
                    d.bits_per_sample(),
                    d.sample_format(),
                );
                let data = d.take_data_as_f32().unwrap_or_default();
                println!(
                    "{:24} {}x{}x{} bits={} sf={} n={} first={:?}",
                    name,
                    w,
                    h,
                    c,
                    b,
                    sf,
                    data.len(),
                    &data[..6.min(data.len())]
                );
            }
            Err(e) => println!("{:24} ERROR {}", name, e.message()),
        }
    }
}
