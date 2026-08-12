//! Photographic colouring of an X3R scan from its station's panorama.
//!
//! This is the expensive half of an X3A load — measured at 78-80% of the parse
//! on a 42M-point archive — and it was previously split across the JS/WASM
//! boundary: candidates were gathered in JavaScript, projection crossed into
//! Rust once per frame carrying the *entire* point cloud, and the resulting
//! pixels were scored and sampled back in JavaScript. On that archive the cloud
//! crossed thirty times.
//!
//! Here the whole pass runs on one side. Points, pixels and frames stay put; a
//! colour and a frame index come back.
//!
//! Two behaviours are load-bearing and deliberately preserved from the
//! TypeScript this replaces:
//!
//! - **Candidates come from the column's azimuth, not from each point.** A scan
//!   is organised by azimuth, so an entire column either faces a frame or does
//!   not, and testing once per column instead of once per point is most of why
//!   this is affordable at all.
//! - **The best view wins, and "best" means most central.** A point seen by
//!   several frames takes the colour from the one that saw it nearest the image
//!   centre and furthest from an edge, so seams fall where the geometry is
//!   least reliable rather than wherever the frame order happened to put them.

use camera_models::{project, CameraModel, Intrinsics};

use super::bayer::{sample_grbg, BayerFrame};
use super::scan::ScanLayout;

/// How far a column's azimuth may sit from a frame's pan and still be offered
/// to it. Generous on purpose: the frames overlap, and a point missed here can
/// never be recovered.
const FRAME_AZIMUTH_WINDOW_DEGREES: f64 = 30.0;

/// Beyond this fraction of the frame's short side from an edge, a sample is
/// trusted fully; inside it, the weight falls off smoothly to zero.
const EDGE_MARGIN_FRACTION: f64 = 0.08;

/// No frame coloured this point.
pub const NO_FRAME: u16 = u16::MAX;

pub struct ColourFrame<'a> {
    pub pixels: &'a [u8],
    pub raw_width: usize,
    pub raw_height: usize,
    pub image_width: usize,
    pub image_height: usize,
    pub pan_degrees: f64,
    pub fx: f64,
    pub fy: f64,
    pub cx: f64,
    pub cy: f64,
    pub distortion: Vec<f64>,
    /// Row-major 4x4 viewer-to-camera transform, as the CAL file declares it.
    pub viewer_to_camera: [f64; 16],
    pub max_normalized_x: f64,
    pub max_normalized_y: f64,
}

pub struct ColourResult {
    /// Interleaved RGB, one triple per point; untouched points stay at 255.
    pub colours: Vec<u8>,
    /// Which frame coloured each point, or `NO_FRAME`.
    pub frame_indices: Vec<u16>,
    pub coloured_points: usize,
}

fn angular_difference(a: f64, b: f64) -> f64 {
    (((a - b + 540.0) % 360.0) - 180.0).abs()
}

/// Scores a projected pixel: centred and clear of the edge is best.
fn view_score(frame: &ColourFrame, pixel_x: f64, pixel_y: f64) -> f64 {
    let centre_x = (pixel_x - frame.cx) / (frame.image_width as f64 * 0.5);
    let centre_y = (pixel_y - frame.cy) / (frame.image_height as f64 * 0.5);
    let off_centre = centre_x * centre_x + centre_y * centre_y;

    let edge_distance = pixel_x
        .min(pixel_y)
        .min(frame.image_width as f64 - 1.0 - pixel_x)
        .min(frame.image_height as f64 - 1.0 - pixel_y);
    let edge_margin = (frame.image_width.min(frame.image_height)) as f64 * EDGE_MARGIN_FRACTION;
    let edge_t = (edge_distance / edge_margin).clamp(0.0, 1.0);
    // Smoothstep, so the weight does not step at the margin boundary.
    let edge_weight = edge_t * edge_t * (3.0 - 2.0 * edge_t);
    edge_weight / (0.05 + off_centre).powi(2)
}

/// Applies a row-major 4x4 to a point.
fn transform(matrix: &[f64; 16], point: [f64; 3]) -> [f64; 3] {
    [
        matrix[0] * point[0] + matrix[1] * point[1] + matrix[2] * point[2] + matrix[3],
        matrix[4] * point[0] + matrix[5] * point[1] + matrix[6] * point[2] + matrix[7],
        matrix[8] * point[0] + matrix[9] * point[1] + matrix[10] * point[2] + matrix[11],
    ]
}

/// Colours a decoded scan from the frames that can see it.
///
/// `column_azimuths` is one azimuth per column, in degrees, and
/// `points_per_column` the number of valid returns each produced, in order —
/// together they say which points belong to which column without storing a
/// direction per point.
/// `frames` are the archive's frames; `active` selects the ones this scan may
/// be coloured from. `decoded` is the caller's cache, indexed like `frames`, so
/// a panorama shared by several scans is demosaiced once for the archive rather
/// than once per scan - which is what made a six-scan, ten-frame archive do
/// sixty decodes and run slower than the JavaScript it replaced.
pub fn colour_scan(
    positions: &[f32],
    layout: &ScanLayout,
    column_azimuths: &[f64],
    points_per_column: &[usize],
    frames: &[ColourFrame],
    active: &[usize],
    decoded: &mut [Option<super::bayer::RgbImage>],
) -> ColourResult {
    let point_count = positions.len() / 3;
    let mut colours = vec![255u8; point_count * 3];
    let mut frame_indices = vec![NO_FRAME; point_count];
    let mut best_weights = vec![0.0f64; point_count];
    let mut coloured_points = 0usize;

    for &frame_index in active {
        let Some(frame) = frames.get(frame_index) else {
            continue;
        };
        let model = CameraModel::PinholeOpenCv;
        let intrinsics = Intrinsics {
            fx: frame.fx,
            fy: frame.fy,
            cx: frame.cx,
            cy: frame.cy,
        };

        let mut point_index = 0usize;
        for column in 0..layout.columns.min(column_azimuths.len()) {
            let in_column = points_per_column.get(column).copied().unwrap_or(0);
            if angular_difference(frame.pan_degrees, column_azimuths[column])
                > FRAME_AZIMUTH_WINDOW_DEGREES
            {
                point_index += in_column;
                continue;
            }

            for _ in 0..in_column {
                let offset = point_index * 3;
                point_index += 1;
                let camera = transform(
                    &frame.viewer_to_camera,
                    [
                        positions[offset] as f64,
                        positions[offset + 1] as f64,
                        positions[offset + 2] as f64,
                    ],
                );

                // The calibration's field of view bounds the domain before the
                // distortion polynomial runs, so a strong polynomial cannot
                // fold an invalid ray into a plausible-looking pixel.
                if camera[2] <= 0.0 {
                    continue;
                }
                let normalized_x = camera[0] / camera[2];
                let normalized_y = camera[1] / camera[2];
                if normalized_x.abs() > frame.max_normalized_x
                    || normalized_y.abs() > frame.max_normalized_y
                {
                    continue;
                }

                // `project` reports convergence rather than failing: a ray the
                // iterative inverse could not settle on is not a pixel, and
                // taking its last iterate would paint a point from whatever the
                // solver happened to be looking at when it gave up.
                let projected = project(model, intrinsics, &frame.distortion, camera);
                if !projected.converged {
                    continue;
                }
                let (pixel_x, pixel_y) = (projected.value[0], projected.value[1]);
                if !pixel_x.is_finite()
                    || !pixel_y.is_finite()
                    || pixel_x < 1.0
                    || pixel_y < 1.0
                    || pixel_x >= frame.image_width as f64 - 1.0
                    || pixel_y >= frame.image_height as f64 - 1.0
                {
                    continue;
                }

                let index = point_index - 1;
                let weight = view_score(frame, pixel_x, pixel_y);
                if weight <= best_weights[index] {
                    continue;
                }

                // Decoded lazily and kept across scans: a frame no column
                // faces is never unpacked at all.
                let image = decoded[frame_index].get_or_insert_with(|| {
                    super::bayer::decode_rgb(&BayerFrame {
                        pixels: frame.pixels,
                        raw_width: frame.raw_width,
                        raw_height: frame.raw_height,
                        image_width: frame.image_width,
                        image_height: frame.image_height,
                    })
                });
                let colour = sample_image(image, frame, pixel_x, pixel_y);

                if frame_indices[index] == NO_FRAME {
                    coloured_points += 1;
                }
                best_weights[index] = weight;
                frame_indices[index] = frame_index as u16;
                let out = index * 3;
                colours[out] = colour[0].round().clamp(0.0, 255.0) as u8;
                colours[out + 1] = colour[1].round().clamp(0.0, 255.0) as u8;
                colours[out + 2] = colour[2].round().clamp(0.0, 255.0) as u8;
            }
        }
    }

    ColourResult {
        colours,
        frame_indices,
        coloured_points,
    }
}

/// Bilinear read of the decoded frame at a calibrated pixel.
pub(crate) fn sample_image(
    image: &super::bayer::RgbImage,
    frame: &ColourFrame,
    pixel_x: f64,
    pixel_y: f64,
) -> [f64; 3] {
    if image.width == 0 || image.height == 0 {
        return sample_grbg(
            &BayerFrame {
                pixels: frame.pixels,
                raw_width: frame.raw_width,
                raw_height: frame.raw_height,
                image_width: frame.image_width,
                image_height: frame.image_height,
            },
            pixel_x,
            pixel_y,
        );
    }
    let scale = super::bayer::CAMERA_RGB_SCALE;
    let x = (pixel_x + 0.5) * scale - 0.5;
    let y = (pixel_y + 0.5) * scale - 0.5;
    let x0 = x.floor();
    let y0 = y.floor();
    let tx = x - x0;
    let ty = y - y0;
    let read = |ix: f64, iy: f64, channel: usize| -> f64 {
        let cx = (ix.max(0.0) as usize).min(image.width - 1);
        let cy = (iy.max(0.0) as usize).min(image.height - 1);
        image.data[(cy * image.width + cx) * 3 + channel] as f64
    };
    let mut out = [0.0f64; 3];
    for (channel, value) in out.iter_mut().enumerate() {
        let top = read(x0, y0, channel) * (1.0 - tx) + read(x0 + 1.0, y0, channel) * tx;
        let bottom =
            read(x0, y0 + 1.0, channel) * (1.0 - tx) + read(x0 + 1.0, y0 + 1.0, channel) * tx;
        *value = top * (1.0 - ty) + bottom * ty;
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    fn identity_transform() -> [f64; 16] {
        let mut m = [0.0; 16];
        m[0] = 1.0;
        m[5] = 1.0;
        m[10] = 1.0;
        m[15] = 1.0;
        m
    }

    /// A frame looking straight down viewer +z, with a flat mid-grey sensor.
    fn frame(pan_degrees: f64, pixels: &[u8]) -> ColourFrame<'_> {
        ColourFrame {
            pixels,
            raw_width: 16,
            raw_height: 16,
            image_width: 16,
            image_height: 16,
            pan_degrees,
            fx: 8.0,
            fy: 8.0,
            cx: 8.0,
            cy: 8.0,
            distortion: vec![0.0; 5],
            viewer_to_camera: identity_transform(),
            max_normalized_x: 1.0,
            max_normalized_y: 1.0,
        }
    }

    fn layout(columns: usize) -> ScanLayout {
        ScanLayout {
            columns,
            rows: 1,
            column_offset: 0,
            column_stride: 0,
            valid_points: columns,
        }
    }

    #[test]
    fn colours_only_columns_a_frame_faces() {
        let pixels = vec![120u8; 16 * 16];
        // Two points straight ahead of the camera, one column each.
        let positions = vec![0.0, 0.0, 5.0, 0.0, 0.0, 5.0];
        // The first column faces the frame, the second is behind it.
        let frames = [frame(0.0, &pixels)];
        let mut cache = vec![None];
        let result = colour_scan(
            &positions,
            &layout(2),
            &[0.0, 180.0],
            &[1, 1],
            &frames,
            &[0],
            &mut cache,
        );
        assert_eq!(result.coloured_points, 1, "only the facing column");
        assert_eq!(result.frame_indices[0], 0);
        assert_eq!(result.frame_indices[1], NO_FRAME);
        // The untouched point keeps the neutral fill rather than black.
        assert_eq!(&result.colours[3..6], &[255, 255, 255]);
    }

    #[test]
    fn a_point_behind_the_camera_is_never_coloured() {
        let pixels = vec![120u8; 16 * 16];
        let positions = vec![0.0, 0.0, -5.0];
        let frames = [frame(0.0, &pixels)];
        let mut cache = vec![None];
        let result = colour_scan(
            &positions,
            &layout(1),
            &[0.0],
            &[1],
            &frames,
            &[0],
            &mut cache,
        );
        assert_eq!(result.coloured_points, 0, "behind the sensor is not a view");
        assert_eq!(result.frame_indices[0], NO_FRAME);
    }

    #[test]
    fn the_more_central_of_two_frames_wins() {
        // Same scene, two frames: the second sees the point dead centre, the
        // first well off to the side, so the second must win regardless of the
        // order they are processed in.
        let pixels = vec![120u8; 16 * 16];
        let positions = vec![0.6, 0.0, 5.0];

        // Offset by moving the *camera*, not its principal point: shifting cx
        // would move the projection and the scoring centre together and leave
        // the point looking central after all.
        let mut offset_frame = frame(0.0, &pixels);
        offset_frame.viewer_to_camera[3] = 3.15; // translate x, landing near the edge

        let frames = [offset_frame, frame(0.0, &pixels)];
        let mut cache = vec![None, None];
        let result = colour_scan(
            &positions,
            &layout(1),
            &[0.0],
            &[1],
            &frames,
            &[0, 1],
            &mut cache,
        );
        assert_eq!(result.coloured_points, 1);
        assert_eq!(result.frame_indices[0], 1, "the centred frame should win");
    }

    #[test]
    fn a_flat_sensor_produces_that_grey() {
        let pixels = vec![120u8; 16 * 16];
        let positions = vec![0.0, 0.0, 5.0];
        let frames = [frame(0.0, &pixels)];
        let mut cache = vec![None];
        let result = colour_scan(
            &positions,
            &layout(1),
            &[0.0],
            &[1],
            &frames,
            &[0],
            &mut cache,
        );
        assert_eq!(result.coloured_points, 1);
        for channel in &result.colours[0..3] {
            assert_eq!(*channel, 120, "a flat sensor must not invent colour");
        }
    }
}
