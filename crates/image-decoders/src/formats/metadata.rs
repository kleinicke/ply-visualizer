// Several helpers below serve only the container formats. A NARROW build —
// `jxl` or `jpegxr` on their own, which is what the separate WebAssembly
// modules in `wasm/` use — pulls this module in for its shared types and
// leaves the rest unused. That is expected; it is not dead code to delete.
#![cfg_attr(
    not(any(
        feature = "fits",
        feature = "netcdf",
        feature = "dicom",
        feature = "czi",
        feature = "nd2",
        feature = "lif"
    )),
    allow(dead_code)
)]

/// Escape a string for embedding inside a JSON string literal.
pub(crate) fn json_escape(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    for character in value.chars() {
        match character {
            '"' => out.push_str("\\\""),
            '\\' => out.push_str("\\\\"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            c if c < ' ' => out.push_str(&format!("\\u{:04x}", c as u32)),
            c => out.push(c),
        }
    }
    out
}

pub(crate) fn push_generic_attr_row(
    out: &mut Vec<String>,
    group: &str,
    name: &str,
    value_debug: String,
) {
    out.push(format!(
        "{{\"tag\":null,\"name\":\"{}\",\"group\":\"{}\",\"value\":\"{}\"}}",
        json_escape(name),
        json_escape(group),
        json_escape(&value_debug),
    ));
}
