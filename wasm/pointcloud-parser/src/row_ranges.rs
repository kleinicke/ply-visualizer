//! Text point clouds parsed in independent byte ranges.
//!
//! Every ASCII point format here (XYZ and its variants, PTS, ASCII PLY and
//! ASCII PCD point clouds) is, after its header, one point per line with a
//! fixed column layout. Once the layout is known, any run of whole lines can
//! be parsed without the others, so a caller with threads (the extension
//! host's worker pool) can split a large file into ranges, parse them at the
//! same time and concatenate the results in order.
//!
//! The plan reproduces the decisions the whole-file and streaming parsers
//! make - the same header readers, the same first-row layout detection, the
//! same colour interpretation - and ranges go through the same `Builder`, so
//! the concatenated result is identical to a sequential parse. The caller
//! applies the one rule that needs the whole file: a declared vertex count
//! (PLY, PCD) stops the parse after that many points, which across ranges is a
//! truncation of the concatenated arrays.

use super::{
    parse_line, pcd_header_stream, ply_header_stream, Builder, Col, ColorMode, HeaderState,
    PointCloudResult, StreamParser,
};
use wasm_bindgen::prelude::*;

fn col_code(col: Col) -> u8 {
    match col {
        Col::X => 0,
        Col::Y => 1,
        Col::Z => 2,
        Col::R => 3,
        Col::G => 4,
        Col::B => 5,
        Col::PackedRgb => 6,
        Col::Nx => 7,
        Col::Ny => 8,
        Col::Nz => 9,
        Col::Intensity => 10,
        Col::Skip => 11,
    }
}

fn col_from_code(code: u8) -> Col {
    match code {
        0 => Col::X,
        1 => Col::Y,
        2 => Col::Z,
        3 => Col::R,
        4 => Col::G,
        5 => Col::B,
        6 => Col::PackedRgb,
        7 => Col::Nx,
        8 => Col::Ny,
        9 => Col::Nz,
        10 => Col::Intensity,
        _ => Col::Skip,
    }
}

fn color_code(mode: ColorMode) -> u8 {
    match mode {
        ColorMode::Auto => 0,
        ColorMode::Byte => 1,
        ColorMode::Unit => 2,
    }
}

fn color_from_code(code: u8) -> ColorMode {
    match code {
        1 => ColorMode::Byte,
        2 => ColorMode::Unit,
        _ => ColorMode::Auto,
    }
}

/// Column count of the first line that holds at least three numbers - the
/// row XYZ and PTS detect their layout from.
fn first_row_width(head: &[u8]) -> Option<usize> {
    let mut vals = [0f64; 16];
    let mut pos = 0usize;
    while pos < head.len() {
        let n = parse_line(head, &mut pos, &mut vals);
        if n >= 3 {
            // A row cut off by the end of the sample would under-count.
            return (pos < head.len() || head.last() == Some(&b'\n')).then_some(n);
        }
    }
    None
}

/// The layout `parse_xyz` / `StreamParser` choose for each variant.
fn xyz_layout(variant: &str, head: &[u8]) -> Option<Vec<Col>> {
    Some(match variant {
        "xyzn" => vec![Col::X, Col::Y, Col::Z, Col::Nx, Col::Ny, Col::Nz],
        "xyzrgb" => vec![Col::X, Col::Y, Col::Z, Col::R, Col::G, Col::B],
        _ => match first_row_width(head)? {
            c if c >= 6 => vec![Col::X, Col::Y, Col::Z, Col::R, Col::G, Col::B],
            4 => vec![Col::X, Col::Y, Col::Z, Col::Intensity],
            _ => vec![Col::X, Col::Y, Col::Z],
        },
    })
}

/// The layout `parse_pts` chooses.
fn pts_layout(head: &[u8]) -> Option<Vec<Col>> {
    Some(match first_row_width(head)? {
        c if c >= 9 => vec![
            Col::X,
            Col::Y,
            Col::Z,
            Col::R,
            Col::G,
            Col::B,
            Col::Nx,
            Col::Ny,
            Col::Nz,
        ],
        7 => vec![
            Col::X,
            Col::Y,
            Col::Z,
            Col::Intensity,
            Col::R,
            Col::G,
            Col::B,
        ],
        6 | 8 => vec![Col::X, Col::Y, Col::Z, Col::R, Col::G, Col::B],
        4 => vec![Col::X, Col::Y, Col::Z, Col::Intensity],
        _ => vec![Col::X, Col::Y, Col::Z],
    })
}

/// Decide how a text point cloud's rows are read, from the start of the file.
///
/// `format` is `xyz`, `xyzn`, `xyzrgb`, `pts`, `ply` or `pcd`; `color_mode`
/// is the caller's `byte`/`unit` decision for XYZRGB (ignored elsewhere).
/// Returns JSON - `{"layout":[..],"color":c,"start":offset,"expected":n}` - or
/// an empty string when the sample is not enough to decide (a header longer
/// than the sample) or the file is not a plain point table (binary data, a
/// PLY with faces); the caller then uses the sequential parser.
#[wasm_bindgen]
#[must_use]
pub fn plan_rows(head: &[u8], format: &str, color_mode: &str) -> String {
    let plan = match format {
        "ply" | "pcd" => {
            let state = if format == "ply" {
                ply_header_stream(head)
            } else {
                pcd_header_stream(head)
            };
            match state {
                HeaderState::Ready(layout, expected, start, color) => {
                    Some((layout, color, start, expected))
                }
                HeaderState::NeedMore | HeaderState::Reject => None,
            }
        }
        "pts" => pts_layout(head).map(|layout| (layout, ColorMode::Byte, 0, 0)),
        "xyz" | "xyzn" | "xyzrgb" => xyz_layout(format, head).map(|layout| {
            // Only XYZRGB takes the caller's decision; the streaming parser
            // reads the other variants with the per-row heuristic.
            let color = if format == "xyzrgb" {
                super::color_mode_from_str(color_mode)
            } else {
                ColorMode::Auto
            };
            (layout, color, 0, 0)
        }),
        _ => None,
    };
    let Some((layout, color, start, expected)) = plan else {
        return String::new();
    };
    let codes: Vec<String> = layout.iter().map(|c| col_code(*c).to_string()).collect();
    format!(
        "{{\"layout\":[{}],\"color\":{},\"start\":{start},\"expected\":{expected}}}",
        codes.join(","),
        color_code(color)
    )
}

/// A streaming row parser preset with a layout from [`plan_rows`] and room
/// for about `rows_hint` rows, for one
/// range of a file: push the range in chunks of any size (lines may straddle
/// them), then `finish`. Holding only the current chunk is what keeps eight
/// parallel workers from each copying their whole slice into wasm memory -
/// which never shrinks.
#[wasm_bindgen]
#[must_use]
pub fn row_stream(layout: &[u8], color: u8, rows_hint: u32) -> StreamParser {
    let layout: Vec<Col> = layout.iter().map(|code| col_from_code(*code)).collect();
    // Sized up front from the range: growing by doubling would copy the
    // buffers and briefly hold both. Unused capacity is never touched, so it
    // costs address space rather than memory.
    let rows = usize::try_from(rows_hint).unwrap_or(usize::MAX).max(1024);
    StreamParser::with_builder(Builder::new(layout, rows, color_from_code(color)))
}

/// Parse a run of whole lines (starting at a line boundary) with a layout from
/// [`plan_rows`].
#[wasm_bindgen]
#[must_use]
pub fn parse_row_range(data: &[u8], layout: &[u8], color: u8) -> PointCloudResult {
    let layout: Vec<Col> = layout.iter().map(|code| col_from_code(*code)).collect();
    // ~40 bytes per row is typical for these formats; the vectors grow if not.
    let mut builder = Builder::new(layout, data.len() / 40 + 1024, color_from_code(color));
    let mut vals = [0f64; 16];
    let mut pos = 0usize;
    while pos < data.len() {
        let n = parse_line(data, &mut pos, &mut vals);
        if n >= 3 {
            builder.push_row(&vals, n);
        }
    }
    builder.finish()
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{parse_pts, parse_xyz, StreamParser};

    struct Plan {
        layout: Vec<u8>,
        color: u8,
        start: usize,
        expected: usize,
    }

    fn plan(head: &[u8], format: &str, color: &str) -> Option<Plan> {
        let json = plan_rows(head, format, color);
        if json.is_empty() {
            return None;
        }
        let value: serde_json::Value = serde_json::from_str(&json).unwrap();
        let number = |key: &str| usize::try_from(value[key].as_u64().unwrap()).unwrap();
        Some(Plan {
            layout: value["layout"]
                .as_array()
                .unwrap()
                .iter()
                .map(|v| u8::try_from(v.as_u64().unwrap()).unwrap())
                .collect(),
            color: u8::try_from(value["color"].as_u64().unwrap()).unwrap(),
            start: number("start"),
            expected: number("expected"),
        })
    }

    /// Split at every line boundary near `parts` equal cuts and concatenate,
    /// as the worker pool does.
    fn ranged(data: &[u8], plan: &Plan, parts: usize) -> (Vec<f32>, Vec<u8>, Vec<f32>, Vec<f32>) {
        let body = &data[plan.start..];
        let mut cuts = vec![0usize];
        for k in 1..parts {
            let mut at = body.len() * k / parts;
            // A range owns the lines that start inside it.
            while at < body.len() && at > 0 && body[at - 1] != b'\n' {
                at += 1;
            }
            cuts.push(at.max(*cuts.last().unwrap()));
        }
        cuts.push(body.len());
        let mut positions = Vec::new();
        let mut colors = Vec::new();
        let mut normals = Vec::new();
        let mut intensity = Vec::new();
        for pair in cuts.windows(2) {
            let mut range = parse_row_range(&body[pair[0]..pair[1]], &plan.layout, plan.color);
            positions.extend(range.take_positions());
            colors.extend(range.take_colors());
            normals.extend(range.take_normals());
            intensity.extend(range.take_intensity());
        }
        if plan.expected > 0 {
            let keep = plan.expected.min(positions.len() / 3);
            let cut = |values: usize, per: usize| if values == 0 { 0 } else { keep * per };
            positions.truncate(keep * 3);
            colors.truncate(cut(colors.len(), 3));
            normals.truncate(cut(normals.len(), 3));
            intensity.truncate(cut(intensity.len(), 1));
        }
        (positions, colors, normals, intensity)
    }

    fn streamed(data: &[u8], format: &str, color: &str) -> (Vec<f32>, Vec<u8>, Vec<f32>, Vec<f32>) {
        let mut parser = StreamParser::new(format, color);
        for chunk in data.chunks(7) {
            parser.push(chunk);
        }
        let mut r = parser.finish();
        (
            r.take_positions(),
            r.take_colors(),
            r.take_normals(),
            r.take_intensity(),
        )
    }

    #[test]
    fn xyz_ranges_match_the_whole_file_parse_at_every_split() {
        let text = b"# comment\n1 2 3 0.5\n4 5 6 0.25\n\n7 8 9 1\n10 11 12 0\n13 14 15 0.75";
        let p = plan(text, "xyz", "auto").unwrap();
        let mut whole = parse_xyz(text, "xyz", "auto");
        let expected = (
            whole.take_positions(),
            whole.take_colors(),
            whole.take_normals(),
            whole.take_intensity(),
        );
        for parts in 1..=8 {
            assert_eq!(ranged(text, &p, parts), expected, "{parts} ranges");
        }
    }

    #[test]
    fn a_streamed_range_matches_the_same_range_parsed_whole() {
        let text = b"1 2 3 4 5 6\n7 8 9 10 11 12\n13 14 15 16 17 18\n19 20 21 22 23 24";
        let p = plan(text, "xyz", "auto").unwrap();
        let mut whole = parse_row_range(text, &p.layout, p.color);
        for chunk in 1..text.len() {
            let mut stream = row_stream(&p.layout, p.color, 0);
            for piece in text.chunks(chunk) {
                stream.push(piece);
            }
            let mut streamed = stream.finish();
            assert_eq!(streamed.take_positions(), whole.positions, "chunk {chunk}");
            assert_eq!(streamed.take_colors(), whole.colors, "chunk {chunk}");
        }
        assert_eq!(whole.take_positions().len(), 12);
    }

    #[test]
    fn xyzrgb_takes_the_callers_colour_decision() {
        let text = b"0 0 0 1 1 1\n1 1 1 255 0 0\n";
        let p = plan(text, "xyzrgb", "byte").unwrap();
        assert_eq!(ranged(text, &p, 2).1, vec![1, 1, 1, 255, 0, 0]);
    }

    #[test]
    fn pts_ranges_match_parse_pts() {
        let text = b"5\n0 0 0 -100 0 1 1\n1 2 3 10 255 255 255\n4 5 6 0 1 2 3\n7 8 9 5 4 5 6\n1 1 1 0 9 9 9\n";
        let p = plan(text, "pts", "auto").unwrap();
        let mut whole = parse_pts(text);
        let expected = (
            whole.take_positions(),
            whole.take_colors(),
            whole.take_normals(),
            whole.take_intensity(),
        );
        for parts in 1..=5 {
            assert_eq!(ranged(text, &p, parts), expected, "{parts} ranges");
        }
    }

    #[test]
    fn ply_and_pcd_ranges_match_the_stream_parser_and_stop_at_the_count() {
        let ply = b"ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nproperty uchar red\nproperty uchar green\nproperty uchar blue\nend_header\n0 0 0 1 1 1\n1 0 0 2 2 2\n0 1 0 3 3 3\n9 9 9 9 9 9\n";
        let p = plan(ply, "ply", "auto").unwrap();
        assert_eq!(p.expected, 3);
        for parts in 1..=4 {
            assert_eq!(ranged(ply, &p, parts), streamed(ply, "ply", "auto"));
        }
        let pcd = b"# .PCD v0.7\nFIELDS x y z intensity\nSIZE 4 4 4 4\nTYPE F F F F\nCOUNT 1 1 1 1\nWIDTH 2\nHEIGHT 1\nPOINTS 2\nDATA ascii\n1 2 3 0.5\n4 5 6 0.25\n";
        let p = plan(pcd, "pcd", "auto").unwrap();
        for parts in 1..=3 {
            assert_eq!(ranged(pcd, &p, parts), streamed(pcd, "pcd", "auto"));
        }
    }

    #[test]
    fn meshes_binary_data_and_cut_headers_are_left_to_the_sequential_parser() {
        let mesh = b"ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\nelement face 0\nproperty list uchar int vertex_indices\nend_header\n";
        // An empty face element is still a point cloud.
        assert!(plan(mesh, "ply", "auto").is_some());
        let with_faces = b"ply\nformat ascii 1.0\nelement vertex 1\nproperty float x\nproperty float y\nproperty float z\nelement face 1\nproperty list uchar int vertex_indices\nend_header\n0 0 0\n";
        assert!(plan(with_faces, "ply", "auto").is_none());
        assert!(plan(
            b"ply\nformat binary_little_endian 1.0\nend_header\n",
            "ply",
            "auto"
        )
        .is_none());
        assert!(plan(b"ply\nformat ascii 1.0\nelement vertex 1", "ply", "auto").is_none());
        assert!(plan(b"FIELDS x y z\nDATA binary\n", "pcd", "auto").is_none());
        assert!(plan(b"1 2", "xyz", "auto").is_none());
    }
}
