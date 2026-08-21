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

