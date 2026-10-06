/// Orientation tag (274) values 2-8 the TIFF spec defines beyond the default
/// (1, top-left/no transform). Rows/columns below assume the interleaved
/// buffer's natural row-major layout (row 0 first, left-to-right).
#[derive(Clone, Copy, PartialEq)]
pub(crate) enum TiffOrientation {
    TopLeft = 1,
    TopRight = 2,
    BottomRight = 3,
    BottomLeft = 4,
    LeftTop = 5,
    RightTop = 6,
    RightBottom = 7,
    LeftBottom = 8,
}

impl TiffOrientation {
    pub(crate) fn from_tag(value: u32) -> Self {
        match value {
            2 => TiffOrientation::TopRight,
            3 => TiffOrientation::BottomRight,
            4 => TiffOrientation::BottomLeft,
            5 => TiffOrientation::LeftTop,
            6 => TiffOrientation::RightTop,
            7 => TiffOrientation::RightBottom,
            8 => TiffOrientation::LeftBottom,
            _ => TiffOrientation::TopLeft,
        }
    }

    /// True for the transpose variants (5-8), which swap width and height.
    fn transposes(self) -> bool {
        matches!(
            self,
            TiffOrientation::LeftTop
                | TiffOrientation::RightTop
                | TiffOrientation::RightBottom
                | TiffOrientation::LeftBottom
        )
    }
}

/// Apply a TIFF Orientation tag transform to an interleaved pixel buffer,
/// generic over sample type (`T: Copy`) and channel count, so it works for
/// every `DecodingResult` variant (bytes, u16, f32, ...) without duplicating
/// the geometry per type. Returns the (possibly swapped) output width/height
/// alongside the transformed buffer. `TopLeft` (the default / no tag) is a
/// no-op handled by the caller before this is invoked.
pub(crate) fn apply_orientation<T: Copy>(
    data: &[T],
    width: u32,
    height: u32,
    channels: u32,
    orientation: TiffOrientation,
) -> (Vec<T>, u32, u32) {
    let (w, h, c) = (width as usize, height as usize, channels as usize);
    let (out_w, out_h) = if orientation.transposes() {
        (h, w)
    } else {
        (w, h)
    };
    let mut out = Vec::with_capacity(w * h * c);
    // SAFETY-free: just push in the destination's row-major order, reading
    // whichever source pixel maps to that destination position.
    for out_y in 0..out_h {
        for out_x in 0..out_w {
            // For each orientation, (src_x, src_y) is the source pixel that
            // belongs at destination (out_x, out_y).
            let (src_x, src_y) = match orientation {
                TiffOrientation::TopLeft => (out_x, out_y),
                TiffOrientation::TopRight => (w - 1 - out_x, out_y),
                TiffOrientation::BottomRight => (w - 1 - out_x, h - 1 - out_y),
                TiffOrientation::BottomLeft => (out_x, h - 1 - out_y),
                TiffOrientation::LeftTop => (out_y, out_x),
                TiffOrientation::RightTop => (out_y, h - 1 - out_x),
                TiffOrientation::RightBottom => (w - 1 - out_y, h - 1 - out_x),
                TiffOrientation::LeftBottom => (w - 1 - out_y, out_x),
            };
            let src_index = (src_y * w + src_x) * c;
            out.extend_from_slice(&data[src_index..src_index + c]);
        }
    }
    (out, out_w as u32, out_h as u32)
}
