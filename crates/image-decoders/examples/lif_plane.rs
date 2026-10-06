use scientific_image_decoders::decode_lif_fast;
fn main() {
    let mut args = std::env::args().skip(1);
    let path = args.next().expect("path");
    let opts = args.next().unwrap_or_else(|| "{}".into());
    let bytes = std::fs::read(&path).expect("read");
    let mut d = decode_lif_fast(&bytes, &opts).expect("decode");
    let (w, h, c) = (d.width(), d.height(), d.channels());
    let data = d.take_data_as_f32().expect("take");
    let sum: f64 = data.iter().map(|v| *v as f64).sum();
    let (mut mn, mut mx) = (f32::INFINITY, f32::NEG_INFINITY);
    for v in &data {
        mn = mn.min(*v);
        mx = mx.max(*v);
    }
    println!(
        "{}x{}x{} sum={:.1} mean={:.4} min={} max={} first8={:?}",
        w,
        h,
        c,
        sum,
        sum / data.len() as f64,
        mn,
        mx,
        &data[..8.min(data.len())]
    );
}
