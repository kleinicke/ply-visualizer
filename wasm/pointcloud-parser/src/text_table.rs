//! Delimited XYZ tables and calibrated, orthographic height grids.
use crate::{Builder, Col, ColorMode, PointCloudResult};
use serde::Deserialize;
use wasm_bindgen::prelude::*;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct Options {
    mode: String,
    delimiter: String,
    skip_rows: usize,
    columns: [usize; 3],
    spacing: [f64; 2],
    scale: f64,
    missing: String,
}

// Quotes are supported within a physical row; multiline cells are not geometry.
fn cells(line: &str, delimiter: &str) -> Result<Vec<String>, String> {
    if delimiter == "whitespace" {
        return Ok(line.split_whitespace().map(str::to_owned).collect());
    }
    let separator = match delimiter {
        "comma" => ',',
        "tab" => '\t',
        "semicolon" => ';',
        _ => return Err("Choose a supported delimiter".into()),
    };
    let mut result = Vec::new();
    let mut cell = String::new();
    let mut quoted = false;
    let mut chars = line.chars().peekable();
    while let Some(ch) = chars.next() {
        if ch == '"' {
            if quoted && chars.peek() == Some(&'"') {
                cell.push('"');
                chars.next();
            } else {
                quoted = !quoted;
            }
        } else if ch == separator && !quoted {
            result.push(std::mem::take(&mut cell));
        } else {
            cell.push(ch);
        }
    }
    if quoted {
        return Err("Unclosed quote; multiline cells are not supported".into());
    }
    result.push(cell);
    Ok(result)
}

fn number(cell: &str, missing: &str, row: usize) -> Result<Option<f64>, String> {
    let value = cell.trim();
    if value.is_empty()
        || value.eq_ignore_ascii_case("nan")
        || value.eq_ignore_ascii_case("na")
        || (!missing.is_empty() && value == missing)
    {
        return Ok(None);
    }
    let number: f64 = value.parse().map_err(|_| {
        format!(
            "Row {row}: ‘{value}’ is not a number. Check the delimiter and skipped header rows."
        )
    })?;
    if !number.is_finite() {
        return Ok(None);
    }
    Ok(Some(number))
}

fn parse(data: &[u8], options: &str) -> Result<PointCloudResult, String> {
    let o: Options = serde_json::from_str(options).map_err(|e| e.to_string())?;
    if !["xyz", "grid"].contains(&o.mode.as_str())
        || !o.scale.is_finite()
        || o.scale <= 0.0
        || o.spacing.iter().any(|v| !v.is_finite() || *v <= 0.0)
    {
        return Err("Spacing and scale must be positive, finite numbers".into());
    }
    if o.mode == "xyz"
        && (o.columns[0] == o.columns[1]
            || o.columns[0] == o.columns[2]
            || o.columns[1] == o.columns[2])
    {
        return Err("Choose different columns for X, Y and Z".into());
    }
    let text = std::str::from_utf8(data)
        .map_err(|_| "Save the text file as UTF-8 first")?
        .trim_start_matches('\u{feff}');
    let mut b = Builder::new(vec![Col::X, Col::Y, Col::Z], 1024, ColorMode::Auto);
    let mut width = None;
    let mut skipped = 0;
    for (r, line) in text.lines().enumerate().skip(o.skip_rows) {
        let values = cells(line, &o.delimiter)?;
        let mut push = |xyz: [f64; 3]| -> Result<(), String> {
            let xyz = xyz.map(|v| v * o.scale);
            if xyz.iter().any(|v| !(*v as f32).is_finite()) {
                return Err(format!("Row {}: coordinate is too large", r + 1));
            }
            b.push_row(&xyz, 3);
            Ok(())
        };
        if o.mode == "grid" {
            if line.trim().is_empty() {
                return Err(format!(
                    "Row {} is empty; remove empty rows from the height grid",
                    r + 1
                ));
            }
            if *width.get_or_insert(values.len()) != values.len() {
                return Err(format!("Row {} has a different number of heights", r + 1));
            }
            for (c, value) in values.iter().enumerate() {
                if let Some(z) = number(value, o.missing.trim(), r + 1)? {
                    push([
                        c as f64 * o.spacing[0],
                        (r - o.skip_rows) as f64 * o.spacing[1],
                        z,
                    ])?;
                } else {
                    skipped += 1;
                }
            }
        } else {
            if line.trim().is_empty() {
                continue;
            }
            let mut xyz = [0.0; 3];
            let mut valid = true;
            for axis in 0..3 {
                let cell = values.get(o.columns[axis]).ok_or_else(|| {
                    format!("Row {} does not contain the selected columns", r + 1)
                })?;
                match number(cell, o.missing.trim(), r + 1)? {
                    Some(v) => xyz[axis] = v,
                    None => valid = false,
                }
            }
            if valid {
                push(xyz)?;
            } else {
                skipped += 1;
            }
        }
    }
    if b.count() == 0 {
        return Err("No valid points found. Check the layout and header rows.".into());
    }
    b.metadata = serde_json::json!({"missingSamples": skipped}).to_string();
    Ok(b.finish())
}

#[wasm_bindgen]
pub fn parse_text_table(data: &[u8], options: &str) -> Result<PointCloudResult, JsValue> {
    parse(data, options).map_err(|e| JsValue::from_str(&e))
}

#[cfg(test)]
mod tests {
    use super::*;
    fn options(mode: &str) -> serde_json::Value {
        serde_json::json!({"mode":mode,"delimiter":"comma","skipRows":0,"columns":[0,1,2],"spacing":[2,3],"scale":0.001,"missing":"-999"})
    }
    #[test]
    fn grid_preserves_holes_and_spacing() {
        let result = parse(b"1,,3\n-999,5,6", &options("grid").to_string()).unwrap();
        assert_eq!(result.vertex_count, 4);
        assert_eq!(
            result.positions,
            vec![0., 0., 0.001, 0.004, 0., 0.003, 0.002, 0.003, 0.005, 0.004, 0.003, 0.006]
        );
    }
    #[test]
    fn columns_quotes_headers_and_missing_rows() {
        let mut o = options("xyz");
        o["skipRows"] = 2.into();
        o["columns"] = serde_json::json!([2, 0, 1]);
        let result = parse(b"instrument\nY,Z,X\n\"2\",3,1\nNaN,5,6", &o.to_string()).unwrap();
        assert_eq!(result.positions, vec![0.001, 0.002, 0.003]);
    }
    #[test]
    fn rejects_bad_grid_and_wrong_layout() {
        assert!(parse(b"1,2\n3", &options("grid").to_string()).is_err());
        assert!(parse(b"1,2\n\n3,4", &options("grid").to_string()).is_err());
        assert!(parse(b"X,Y,Z\n1,2,3", &options("xyz").to_string()).is_err());
        assert!(parse(b"1,2", &options("xyz").to_string()).is_err());
    }
    #[test]
    fn tab_and_semicolon() {
        for (delimiter, input) in [
            ("tab", "1\t2\t3"),
            ("semicolon", "1;2;3"),
            ("whitespace", "1  2  3"),
        ] {
            let mut o = options("xyz");
            o["delimiter"] = delimiter.into();
            assert_eq!(
                parse(input.as_bytes(), &o.to_string())
                    .unwrap()
                    .vertex_count,
                1
            );
        }
    }
}
