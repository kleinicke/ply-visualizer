//! Decode every ND2 given on the command line and report what came out.
//! Used to check the decoder against a corpus of real files.
use scientific_image_decoders::decode_nd2_fast;

fn main() {
    for path in std::env::args().skip(1) {
        let name = path.rsplit('/').next().unwrap_or(&path).to_string();
        let bytes = match std::fs::read(&path) {
            Ok(b) => b,
            Err(e) => {
                println!("{:50} READ FAIL {}", name, e);
                continue;
            }
        };
        match decode_nd2_fast(&bytes, "{}") {
            Ok(d) => {
                let meta = d.metadata_json();
                let sel = meta
                    .find("\"selectors\"")
                    .map(|i| {
                        let t = &meta[i..];
                        t[..t.len().min(160)].to_string()
                    })
                    .unwrap_or_default();
                println!(
                    "{:50} {}x{} ch={} bps={} fmt={} min={:.4} max={:.4}\n     {}",
                    name,
                    d.width(),
                    d.height(),
                    d.channels(),
                    d.bits_per_sample(),
                    d.sample_format(),
                    d.data_min(),
                    d.data_max(),
                    sel
                );
            }
            Err(e) => println!("{:50} ERROR: {}", name, e.message()),
        }
    }
}
