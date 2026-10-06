#![allow(dead_code)]

//! Minimal hand-rolled JSON value type used by the format decoders
//! to build `ScientificResult.metadata_json` (see `lib.rs`) and to parse the
//! small `NetCdfDecodeOptions` JSON blob the worker passes to
//! `decode_netcdf_fast`. No `serde_json` dependency, by project convention
//! (see `formats/tiff/tags.rs::json_escape`, which this module reuses).
//!
//! The serializer mirrors a useful subset of `JSON.stringify`: an object
//! field whose value is `None` (JS `undefined`) is simply never inserted,
//! matching `JSON.stringify({ a: undefined })` -> `{}`. The parser is a
//! plain recursive-descent reader for standard JSON (used only for the tiny,
//! fully-controlled `options_json` argument, not untrusted file bytes).

use super::metadata::json_escape;

#[derive(Debug, Clone)]
pub(crate) enum JsonValue {
    Null,
    Bool(bool),
    Num(f64),
    Str(String),
    Arr(Vec<JsonValue>),
    Obj(Vec<(String, JsonValue)>),
}

impl JsonValue {
    pub(crate) fn obj() -> Vec<(String, JsonValue)> {
        Vec::new()
    }

    pub(crate) fn as_str(&self) -> Option<&str> {
        match self {
            JsonValue::Str(s) => Some(s.as_str()),
            _ => None,
        }
    }

    pub(crate) fn as_num(&self) -> Option<f64> {
        match self {
            JsonValue::Num(n) => Some(*n),
            _ => None,
        }
    }

    pub(crate) fn as_obj(&self) -> Option<&[(String, JsonValue)]> {
        match self {
            JsonValue::Obj(fields) => Some(fields.as_slice()),
            _ => None,
        }
    }

    pub(crate) fn get<'a>(&'a self, key: &str) -> Option<&'a JsonValue> {
        self.as_obj()?
            .iter()
            .find(|(k, _)| k == key)
            .map(|(_, v)| v)
    }
}

/// Push `(key, value)` onto an object's field list, UNLESS `value` is `None`
/// — mirrors JS `{ key: possiblyUndefined }` losing the key entirely once
/// `JSON.stringify`d.
pub(crate) fn push_opt(fields: &mut Vec<(String, JsonValue)>, key: &str, value: Option<JsonValue>) {
    if let Some(v) = value {
        fields.push((key.to_string(), v));
    }
}

pub(crate) fn to_json_string(value: &JsonValue) -> String {
    match value {
        JsonValue::Null => "null".to_string(),
        JsonValue::Bool(b) => {
            if *b {
                "true".to_string()
            } else {
                "false".to_string()
            }
        }
        JsonValue::Num(n) => format_number(*n),
        JsonValue::Str(s) => format!("\"{}\"", json_escape(s)),
        JsonValue::Arr(items) => {
            let parts: Vec<String> = items.iter().map(to_json_string).collect();
            format!("[{}]", parts.join(","))
        }
        JsonValue::Obj(fields) => {
            let parts: Vec<String> = fields
                .iter()
                .map(|(k, v)| format!("\"{}\":{}", json_escape(k), to_json_string(v)))
                .collect();
            format!("{{{}}}", parts.join(","))
        }
    }
}

/// Format a finite f64 close to how `JSON.stringify`/`String(number)` would
/// for the small integers and simple decimals that flow through here (axis
/// sizes, BSCALE/BZERO, dimension indices, ...). NaN/Infinity have no JSON
/// representation; `JSON.stringify` emits `null` for them, so we do too —
/// none of our own numeric metadata fields are ever non-finite in practice.
pub(crate) fn format_number(n: f64) -> String {
    if n.is_nan() || n.is_infinite() {
        return "null".to_string();
    }
    if n == n.trunc() && n.abs() < 1e15 {
        format!("{}", n as i64)
    } else {
        format!("{}", n)
    }
}

// ---------------------------------------------------------------------------
// Parser (only used for the small, trusted NetCdfDecodeOptions JSON blob)
// ---------------------------------------------------------------------------

pub(crate) fn parse(s: &str) -> Result<JsonValue, String> {
    let chars: Vec<char> = s.chars().collect();
    let mut pos = 0usize;
    let value = parse_value(&chars, &mut pos)?;
    skip_ws(&chars, &mut pos);
    Ok(value)
}

fn skip_ws(chars: &[char], pos: &mut usize) {
    while *pos < chars.len() && chars[*pos].is_whitespace() {
        *pos += 1;
    }
}

fn parse_value(chars: &[char], pos: &mut usize) -> Result<JsonValue, String> {
    skip_ws(chars, pos);
    if *pos >= chars.len() {
        return Err("unexpected end of JSON input".to_string());
    }
    match chars[*pos] {
        '{' => parse_object(chars, pos),
        '[' => parse_array(chars, pos),
        '"' => Ok(JsonValue::Str(parse_string(chars, pos)?)),
        't' => {
            expect_literal(chars, pos, "true")?;
            Ok(JsonValue::Bool(true))
        }
        'f' => {
            expect_literal(chars, pos, "false")?;
            Ok(JsonValue::Bool(false))
        }
        'n' => {
            expect_literal(chars, pos, "null")?;
            Ok(JsonValue::Null)
        }
        _ => parse_number(chars, pos),
    }
}

fn expect_literal(chars: &[char], pos: &mut usize, lit: &str) -> Result<(), String> {
    for expected in lit.chars() {
        if *pos >= chars.len() || chars[*pos] != expected {
            return Err(format!("invalid JSON literal, expected \"{}\"", lit));
        }
        *pos += 1;
    }
    Ok(())
}

fn parse_object(chars: &[char], pos: &mut usize) -> Result<JsonValue, String> {
    *pos += 1; // '{'
    let mut fields = Vec::new();
    skip_ws(chars, pos);
    if *pos < chars.len() && chars[*pos] == '}' {
        *pos += 1;
        return Ok(JsonValue::Obj(fields));
    }
    loop {
        skip_ws(chars, pos);
        if *pos >= chars.len() || chars[*pos] != '"' {
            return Err("expected string key in JSON object".to_string());
        }
        let key = parse_string(chars, pos)?;
        skip_ws(chars, pos);
        if *pos >= chars.len() || chars[*pos] != ':' {
            return Err("expected ':' in JSON object".to_string());
        }
        *pos += 1;
        let value = parse_value(chars, pos)?;
        fields.push((key, value));
        skip_ws(chars, pos);
        if *pos >= chars.len() {
            return Err("unterminated JSON object".to_string());
        }
        match chars[*pos] {
            ',' => {
                *pos += 1;
            }
            '}' => {
                *pos += 1;
                break;
            }
            _ => return Err("expected ',' or '}' in JSON object".to_string()),
        }
    }
    Ok(JsonValue::Obj(fields))
}

fn parse_array(chars: &[char], pos: &mut usize) -> Result<JsonValue, String> {
    *pos += 1; // '['
    let mut items = Vec::new();
    skip_ws(chars, pos);
    if *pos < chars.len() && chars[*pos] == ']' {
        *pos += 1;
        return Ok(JsonValue::Arr(items));
    }
    loop {
        let value = parse_value(chars, pos)?;
        items.push(value);
        skip_ws(chars, pos);
        if *pos >= chars.len() {
            return Err("unterminated JSON array".to_string());
        }
        match chars[*pos] {
            ',' => {
                *pos += 1;
            }
            ']' => {
                *pos += 1;
                break;
            }
            _ => return Err("expected ',' or ']' in JSON array".to_string()),
        }
    }
    Ok(JsonValue::Arr(items))
}

fn parse_string(chars: &[char], pos: &mut usize) -> Result<String, String> {
    *pos += 1; // opening quote
    let mut out = String::new();
    while *pos < chars.len() {
        let c = chars[*pos];
        if c == '"' {
            *pos += 1;
            return Ok(out);
        }
        if c == '\\' {
            *pos += 1;
            if *pos >= chars.len() {
                return Err("unterminated JSON escape".to_string());
            }
            match chars[*pos] {
                '"' => out.push('"'),
                '\\' => out.push('\\'),
                '/' => out.push('/'),
                'b' => out.push('\u{0008}'),
                'f' => out.push('\u{000C}'),
                'n' => out.push('\n'),
                'r' => out.push('\r'),
                't' => out.push('\t'),
                'u' => {
                    if *pos + 4 >= chars.len() {
                        return Err("invalid \\u escape in JSON string".to_string());
                    }
                    let hex: String = chars[*pos + 1..*pos + 5].iter().collect();
                    let code = u32::from_str_radix(&hex, 16)
                        .map_err(|_| "invalid \\u escape in JSON string".to_string())?;
                    if let Some(ch) = char::from_u32(code) {
                        out.push(ch);
                    }
                    *pos += 4;
                }
                other => return Err(format!("invalid JSON escape '\\{}'", other)),
            }
            *pos += 1;
        } else {
            out.push(c);
            *pos += 1;
        }
    }
    Err("unterminated JSON string".to_string())
}

fn parse_number(chars: &[char], pos: &mut usize) -> Result<JsonValue, String> {
    let start = *pos;
    if *pos < chars.len() && (chars[*pos] == '-' || chars[*pos] == '+') {
        *pos += 1;
    }
    while *pos < chars.len()
        && (chars[*pos].is_ascii_digit()
            || chars[*pos] == '.'
            || chars[*pos] == 'e'
            || chars[*pos] == 'E'
            || chars[*pos] == '+'
            || chars[*pos] == '-')
    {
        *pos += 1;
    }
    let s: String = chars[start..*pos].iter().collect();
    s.parse::<f64>()
        .map(JsonValue::Num)
        .map_err(|_| format!("invalid JSON number '{}'", s))
}
