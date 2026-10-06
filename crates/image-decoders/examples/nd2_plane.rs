//! Dump one selected ND2 plane's checksum and extremes, for cross-checking
//! against an independent reference implementation.
use scientific_image_decoders::decode_nd2_fast;

fn main() {
    let mut args = std::env::args().skip(1);
    let path = args.next().expect("path");
    let opts = args.next().unwrap_or_else(|| "{}".into());
    let bytes = std::fs::read(&path).expect("read");
    let mut d = decode_nd2_fast(&bytes, &opts).expect("decode");
    let (w, h, c) = (d.width(), d.height(), d.channels());
    let data = d.take_data_as_f32().expect("take data");
    let sum: f64 = data.iter().map(|v| *v as f64).sum();
    let mut mn = f32::INFINITY;
    let mut mx = f32::NEG_INFINITY;
    for v in &data {
        mn = mn.min(*v);
        mx = mx.max(*v);
    }
    println!(
        "{}x{}x{} n={} sum={:.1} min={} max={} first8={:?}",
        w,
        h,
        c,
        data.len(),
        sum,
        mn,
        mx,
        &data[..8.min(data.len())]
    );
}
