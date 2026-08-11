//! Stonex X300 archive handling.
//!
//! Being ported from `engine/src/parsers/stonexX3aParser.ts` a piece at a time,
//! measured rather than assumed: on a 42M-point archive the colour work is
//! ~80% of the parse and the point decode ~16%, with the remainder split
//! between the archive directory and colour correction.
//!
//! The TypeScript parser stays authoritative until each piece here is checked
//! against it on the real archives, so the two live side by side for now.

pub mod bayer;
pub mod colour;
pub mod scan;

use wasm_bindgen::prelude::*;

/// One decoded X3R record, for comparison against the TypeScript decoder.
#[wasm_bindgen]
pub struct StonexScanPoints {
    positions: Vec<f32>,
    intensity: Vec<f32>,
    column_azimuths: Vec<f64>,
    points_per_column: Vec<u32>,
}

#[wasm_bindgen]
impl StonexScanPoints {
    #[wasm_bindgen(getter)]
    pub fn point_count(&self) -> u32 {
        (self.positions.len() / 3) as u32
    }
    pub fn take_positions(&mut self) -> Vec<f32> {
        std::mem::take(&mut self.positions)
    }
    pub fn take_intensity(&mut self) -> Vec<f32> {
        std::mem::take(&mut self.intensity)
    }
    pub fn take_column_azimuths(&mut self) -> Vec<f64> {
        std::mem::take(&mut self.column_azimuths)
    }
    pub fn take_points_per_column(&mut self) -> Vec<u32> {
        std::mem::take(&mut self.points_per_column)
    }
}

/// Decodes one X3R record's points.
///
/// `record` is the member's bytes on their own. Exposed while the port is in
/// progress so the TypeScript decoder can be checked against this one on the
/// real archives.
#[wasm_bindgen]
pub fn stonex_decode_scan(record: &[u8]) -> Result<StonexScanPoints, JsValue> {
    let layout = scan::read_layout(record).map_err(|error| JsValue::from_str(&error))?;
    let points = scan::decode_points(record, &layout);
    Ok(StonexScanPoints {
        positions: points.positions,
        intensity: points.intensity,
        column_azimuths: points.column_azimuths,
        points_per_column: points.points_per_column,
    })
}

/// Decoded frame for JS: interleaved RGB at `CAMERA_RGB_SCALE`.
#[wasm_bindgen]
pub struct StonexRgbImage {
    width: u32,
    height: u32,
    data: Vec<u8>,
}

#[wasm_bindgen]
impl StonexRgbImage {
    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.width
    }
    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.height
    }
    pub fn take_data(&mut self) -> Vec<u8> {
        std::mem::take(&mut self.data)
    }
}

/// Demosaics one X3I frame.
///
/// `pixels` is the raw GRBG plane for this frame alone. Exposed while the port
/// is in progress so the TypeScript decode can be compared against this one on
/// real frames; the colour pass will call it internally rather than handing
/// images back across the boundary.
#[wasm_bindgen]
pub fn stonex_decode_frame(
    pixels: &[u8],
    raw_width: u32,
    raw_height: u32,
    image_width: u32,
    image_height: u32,
) -> StonexRgbImage {
    let frame = bayer::BayerFrame {
        pixels,
        raw_width: raw_width as usize,
        raw_height: raw_height as usize,
        image_width: image_width as usize,
        image_height: image_height as usize,
    };
    let decoded = bayer::decode_rgb(&frame);
    StonexRgbImage {
        width: decoded.width as u32,
        height: decoded.height as u32,
        data: decoded.data,
    }
}

use serde::Deserialize;

/// One frame's description, paired with its slice of the `pixels` buffer.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FrameDescriptor {
    /// Byte offset of this frame's raw plane within the shared buffer.
    pixel_offset: usize,
    raw_width: usize,
    raw_height: usize,
    image_width: usize,
    image_height: usize,
    pan_degrees: f64,
    fx: f64,
    fy: f64,
    cx: f64,
    cy: f64,
    distortion: Vec<f64>,
    /// Row-major, as the CAL file declares `Model2CameraMatrix`.
    viewer_to_camera: Vec<f64>,
    max_normalized_x: f64,
    max_normalized_y: f64,
}

#[wasm_bindgen]
pub struct StonexColourResult {
    colours: Vec<u8>,
    frame_indices: Vec<u16>,
    coloured_points: u32,
}

#[wasm_bindgen]
impl StonexColourResult {
    #[wasm_bindgen(getter)]
    pub fn coloured_points(&self) -> u32 {
        self.coloured_points
    }
    pub fn take_colours(&mut self) -> Vec<u8> {
        std::mem::take(&mut self.colours)
    }
    pub fn take_frame_indices(&mut self) -> Vec<u16> {
        std::mem::take(&mut self.frame_indices)
    }
}

/// Holds an archive's frames for the length of a parse.
///
/// The pixels and the decoded panoramas live here rather than in each call:
/// they are shared by every scan, and rebuilding them per scan meant a
/// six-scan archive demosaicing its ten frames sixty times and copying the
/// pixel buffer six times over. Created once, coloured scan by scan, dropped at
/// the end.
#[wasm_bindgen]
pub struct StonexColourSession {
    pixels: Vec<u8>,
    descriptors: Vec<FrameDescriptor>,
    decoded: Vec<Option<bayer::RgbImage>>,
}

#[wasm_bindgen]
impl StonexColourSession {
    /// `pixels` holds every frame's raw plane; each descriptor points into it.
    #[wasm_bindgen(constructor)]
    /// Takes `pixels` by value: a `&[u8]` is copied into wasm memory for the
    /// call and then copied again to retain it, which is 300 MB of duplication
    /// on a large archive. Owning it costs one copy instead of two, and the
    /// caller can drop its own reference immediately afterwards.
    pub fn new(pixels: Vec<u8>, frames_json: &str) -> Result<StonexColourSession, JsValue> {
        let descriptors: Vec<FrameDescriptor> = serde_json::from_str(frames_json)
            .map_err(|error| JsValue::from_str(&error.to_string()))?;
        for descriptor in &descriptors {
            let end = descriptor.pixel_offset + descriptor.raw_width * descriptor.raw_height;
            if end > pixels.len() {
                return Err(JsValue::from_str(
                    "frame pixels outside the supplied buffer",
                ));
            }
            if descriptor.viewer_to_camera.len() != 16 {
                return Err(JsValue::from_str("viewerToCamera must have 16 values"));
            }
        }
        let decoded = descriptors.iter().map(|_| None).collect();
        Ok(StonexColourSession {
            pixels,
            descriptors,
            decoded,
        })
    }

    /// Colours one scan from the frames named in `active_frames`.
    ///
    /// Returned frame indices address this session's frame list, which is the
    /// archive's own ordering, so no remapping is needed on the way out.
    pub fn colour_scan(
        &mut self,
        positions: &[f32],
        column_azimuths: &[f64],
        points_per_column: &[u32],
        active_frames: &[u32],
    ) -> StonexColourResult {
        let frames: Vec<colour::ColourFrame> = self
            .descriptors
            .iter()
            .map(|descriptor| {
                let end = descriptor.pixel_offset + descriptor.raw_width * descriptor.raw_height;
                let mut transform = [0.0f64; 16];
                transform.copy_from_slice(&descriptor.viewer_to_camera);
                colour::ColourFrame {
                    pixels: &self.pixels[descriptor.pixel_offset..end],
                    raw_width: descriptor.raw_width,
                    raw_height: descriptor.raw_height,
                    image_width: descriptor.image_width,
                    image_height: descriptor.image_height,
                    pan_degrees: descriptor.pan_degrees,
                    fx: descriptor.fx,
                    fy: descriptor.fy,
                    cx: descriptor.cx,
                    cy: descriptor.cy,
                    distortion: descriptor.distortion.clone(),
                    viewer_to_camera: transform,
                    max_normalized_x: descriptor.max_normalized_x,
                    max_normalized_y: descriptor.max_normalized_y,
                }
            })
            .collect();

        let counts: Vec<usize> = points_per_column.iter().map(|v| *v as usize).collect();
        let active: Vec<usize> = active_frames.iter().map(|v| *v as usize).collect();
        let layout = scan::ScanLayout {
            columns: column_azimuths.len(),
            rows: 0,
            column_offset: 0,
            column_stride: 0,
            valid_points: positions.len() / 3,
        };
        let result = colour::colour_scan(
            positions,
            &layout,
            column_azimuths,
            &counts,
            &frames,
            &active,
            &mut self.decoded,
        );
        StonexColourResult {
            colours: result.colours,
            frame_indices: result.frame_indices,
            coloured_points: result.coloured_points as u32,
        }
    }
}
