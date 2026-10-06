//! Decode LIF files given on the command line; with `--all`, walk every series.
use scientific_image_decoders::decode_lif_fast;

fn main() {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let all = args.iter().any(|a| a == "--all");
    for path in args.iter().filter(|a| *a != "--all") {
        let name = path.rsplit('/').next().unwrap_or(path).to_string();
        let bytes = match std::fs::read(path) {
            Ok(b) => b,
            Err(e) => {
                println!("{:40} READ FAIL {}", name, e);
                continue;
            }
        };
        match decode_lif_fast(&bytes, "{}") {
            Ok(d) => {
                let meta = d.metadata_json();
                let count = meta
                    .find("\"seriesCount\":")
                    .map(|i| {
                        meta[i + 14..]
                            .split(|c: char| !c.is_ascii_digit())
                            .next()
                            .unwrap_or("1")
                            .to_string()
                    })
                    .unwrap_or("1".into());
                println!(
                    "{}  -> {}x{} ch={} bps={} count={} min={:.3} max={:.3}",
                    name,
                    d.width(),
                    d.height(),
                    d.channels(),
                    d.bits_per_sample(),
                    count,
                    d.data_min(),
                    d.data_max()
                );
                if all {
                    let n: usize = count.parse().unwrap_or(1);
                    for s in 0..n {
                        let opts = format!("{{\"indices\":{{\"S\":{}}}}}", s);
                        match decode_lif_fast(&bytes, &opts) {
                            Ok(x) => {
                                let m = x.metadata_json();
                                let sname = m
                                    .find("\"seriesName\":\"")
                                    .map(|i| {
                                        m[i + 14..].split('"').next().unwrap_or("").to_string()
                                    })
                                    .unwrap_or_default();
                                let sel = m
                                    .find("\"selectors\"")
                                    .map(|i| {
                                        let t = &m[i..];
                                        t[..t.len().min(150)].to_string()
                                    })
                                    .unwrap_or_default();
                                println!(
                                    "   S={:<2} {:38} {}x{} ch={} min={:.2} max={:.2}\n        {}",
                                    s,
                                    sname,
                                    x.width(),
                                    x.height(),
                                    x.channels(),
                                    x.data_min(),
                                    x.data_max(),
                                    sel
                                );
                            }
                            Err(e) => println!("   S={:<2} ERROR: {}", s, e.message()),
                        }
                    }
                }
            }
            Err(e) => println!("{}  ERROR: {}", name, e.message()),
        }
    }
}
