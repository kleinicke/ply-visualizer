//! Cross-station photographic colouring.
//!
//! An X3A holds several stations, and only the scan a panorama was shot from
//! gets colour out of the box. Once registration has put them all in one frame,
//! any station's camera can colour any scan, because the mapping from another
//! scan's points into this camera is just a composition,
//! `viewerToCamera(frame) · T_station⁻¹ · T_scan`.
//!
//! Two things make the result trustworthy rather than merely colourful:
//!
//! - **Visibility.** A camera at station S must not paint a surface S could not
//!   see. Every scan is an organized sphere of ranges around its own origin, so
//!   S's own points give a depth buffer in S's frame for free: bin them by
//!   azimuth and elevation, keep the nearest range per bin, and reject a point
//!   that sits well behind what S measured in that direction. Without this,
//!   colour bleeds through walls onto whatever is behind them.
//! - **Best view wins.** A point seen by several frames takes the colour from
//!   the one that saw it closest to the image centre and furthest from an edge,
//!   scored exactly as the parser's own first pass does.
//!
//! Ported from `engine/src/parsers/stonexStationColoring.ts`, which kept the
//! scoring and sampling in JavaScript around a Rust projection call — the same
//! split the parser's own colour pass had before it moved here whole.

use super::bayer;
use camera_models::{project_opencv_pinhole, Intrinsics, OpenCvPinhole};
use wasm_bindgen::prelude::*;

/// Elevation span of an X300 sweep; matches the parser's own constants.
const ELEVATION_MIN_DEGREES: f64 = -25.0;
const ELEVATION_SPAN_DEGREES: f64 = 90.0;
const AZIMUTH_BINS: usize = 2048;
const ELEVATION_BINS: usize = 512;

/// Frames only see so far around; matches the parser's per-column pre-filter.
const FRAME_AZIMUTH_WINDOW_DEGREES: f64 = 30.0;

fn angular_difference(a: f64, b: f64) -> f64 {
    (((a - b + 540.0) % 360.0) - 180.0).abs()
}

/// Nearest measured range per direction, as seen from one station.
///
/// Built from the station's own points, which are already expressed in its
/// frame, so this costs one pass and no transform.
struct StationDepth {
    ranges: Vec<f32>,
}

impl StationDepth {
    fn new(positions: &[f32], point_offset: usize, point_count: usize) -> Self {
        let mut ranges = vec![f32::INFINITY; AZIMUTH_BINS * ELEVATION_BINS];
        for i in 0..point_count {
            let index = (point_offset + i) * 3;
            if index + 2 >= positions.len() {
                break;
            }
            let (x, y, z) = (
                positions[index] as f64,
                positions[index + 1] as f64,
                positions[index + 2] as f64,
            );
            let range = (x * x + y * y + z * z).sqrt();
            // Negated deliberately: this has to reject a NaN coordinate too,
            // which `range <= 0.0` would let through.
            #[allow(clippy::neg_cmp_op_on_partial_ord)]
            if !(range > 0.0) {
                continue;
            }
            if let Some(bin) = Self::bin_of(x, y, z, range) {
                if (range as f32) < ranges[bin] {
                    ranges[bin] = range as f32;
                }
            }
        }
        StationDepth { ranges }
    }

    fn bin_of(x: f64, y: f64, z: f64, range: f64) -> Option<usize> {
        let azimuth = y.atan2(x).to_degrees();
        let elevation = (z / range).clamp(-1.0, 1.0).asin().to_degrees();
        let elevation_t = (elevation - ELEVATION_MIN_DEGREES) / ELEVATION_SPAN_DEGREES;
        if !(0.0..1.0).contains(&elevation_t) {
            return None;
        }
        let azimuth_bin = (((azimuth + 360.0) % 360.0) / 360.0 * AZIMUTH_BINS as f64).floor()
            as usize
            % AZIMUTH_BINS;
        let elevation_bin =
            ((elevation_t * ELEVATION_BINS as f64).floor() as usize).min(ELEVATION_BINS - 1);
        Some(elevation_bin * AZIMUTH_BINS + azimuth_bin)
    }

    /// True when a point at `range` in this direction is at or in front of what
    /// the station measured. A direction the station never sampled counts as
    /// visible: it cannot be shown to be hidden, and refusing those would strip
    /// colour from everything above and below the sweep.
    fn is_visible(&self, x: f64, y: f64, z: f64, tolerance: f64, relative: f64) -> bool {
        let range = (x * x + y * y + z * z).sqrt();
        #[allow(clippy::neg_cmp_op_on_partial_ord)]
        if !(range > 0.0) {
            return false;
        }
        match Self::bin_of(x, y, z, range) {
            None => true,
            Some(bin) => {
                let measured = self.ranges[bin] as f64;
                !measured.is_finite() || range <= measured + tolerance + relative * measured
            }
        }
    }
}

fn view_score(pixel_x: f64, pixel_y: f64, cx: f64, cy: f64, width: f64, height: f64) -> f64 {
    let center_x = (pixel_x - cx) / (width * 0.5);
    let center_y = (pixel_y - cy) / (height * 0.5);
    let off_centre = center_x * center_x + center_y * center_y;
    let edge_distance = pixel_x
        .min(pixel_y)
        .min(width - 1.0 - pixel_x)
        .min(height - 1.0 - pixel_y);
    let edge_margin = width.min(height) * 0.08;
    let edge_t = (edge_distance / edge_margin).clamp(0.0, 1.0);
    let edge_weight = edge_t * edge_t * (3.0 - 2.0 * edge_t);
    edge_weight / (0.05 + off_centre).powi(2)
}

/// Row-major times row-major.
fn multiply_row_major(a: &[f64], b: &[f64]) -> [f64; 16] {
    let mut out = [0f64; 16];
    for row in 0..4 {
        for column in 0..4 {
            let mut sum = 0.0;
            for k in 0..4 {
                sum += a[row * 4 + k] * b[k * 4 + column];
            }
            out[row * 4 + column] = sum;
        }
    }
    out
}

/// Column-major to row-major, and vice versa.
///
/// The two conventions genuinely meet here and the mix is not obvious from the
/// types, because both are sixteen floats. Scan placements come from three.js
/// and are column-major; a frame's `viewerToCamera` is built from the CAL
/// file's `Model2CameraMatrix`, which the XML declares row-ordered. Composing
/// one with the other without this conversion produces a transform that is
/// correct only when the other factor is the identity — which is exactly the
/// same-station case, so the bug hid behind scans that already looked right.
fn transpose(m: &[f64]) -> [f64; 16] {
    let mut out = [0f64; 16];
    for row in 0..4 {
        for column in 0..4 {
            out[row * 4 + column] = m[column * 4 + row];
        }
    }
    out
}

/// Inverse of a rigid transform (rotation plus translation), row-major.
fn invert_rigid(m: &[f64]) -> [f64; 16] {
    let mut out = [0f64; 16];
    for row in 0..3 {
        for column in 0..3 {
            out[row * 4 + column] = m[column * 4 + row];
        }
    }
    for row in 0..3 {
        let mut sum = 0.0;
        for k in 0..3 {
            sum += out[row * 4 + k] * m[k * 4 + 3];
        }
        out[row * 4 + 3] = -sum;
    }
    out[15] = 1.0;
    out
}

fn transform_point(m: &[f64; 16], x: f64, y: f64, z: f64) -> [f64; 3] {
    [
        m[0] * x + m[1] * y + m[2] * z + m[3],
        m[4] * x + m[5] * y + m[6] * z + m[7],
        m[8] * x + m[9] * y + m[10] * z + m[11],
    ]
}

/// One camera frame: where it stands, how it projects, and where its raw plane
/// lives in the shared pixel buffer.
///
/// This is the parser's own frame description plus the two things only the
/// cross-station pass needs: which station shot the frame, and the archive
/// index to record per point. The optical fields are separate from the
/// parser's descriptors rather than shared because the projection diagnostics
/// alter them - zeroed distortion, a swapped axis convention - while the raw
/// plane they read stays the same.
#[derive(Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct Frame {
    /// Index in the archive's complete frame list, stored per point so colour
    /// correction can find the frame's white balance again.
    frame_number: u16,
    /// Index of the scan this frame was shot from.
    station: usize,
    pan_degrees: f64,
    /// Offset of this frame's raw plane in the shared pixel buffer.
    pixel_offset: usize,
    raw_width: usize,
    raw_height: usize,
    image_width: usize,
    image_height: usize,
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

/// One scan: which points are its own, and where they sit in the common frame.
#[derive(Clone, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct Scan {
    station: usize,
    point_offset: usize,
    point_count: usize,
    /// Column-major 4x4, as three.js produces it.
    transform: Vec<f64>,
}

/// How permissive the visibility test is, and which points may be written.
#[derive(Clone, Copy, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
struct StationOptions {
    occlusion_tolerance: f64,
    occlusion_relative_tolerance: f64,
    recolor_already_colored: bool,
    own_station_only: bool,
}

/// Colours an archive's scans from every station's cameras, one scan at a time.
///
/// Built once per pass and kept alive across scans, for the same reason the
/// parser's own colour session is: the point cloud, the raw planes and each
/// demosaiced panorama are shared by every scan, and the per-station depth
/// buffers cost a full pass over that station's points to build. Colouring
/// scan by scan rather than in one call is what lets the host publish a
/// finished scan while the rest are still running.
#[wasm_bindgen]
pub struct StonexStationSession {
    positions: Vec<f32>,
    pixels: Vec<u8>,
    colours: Vec<u8>,
    frame_indices: Vec<u16>,
    coloured: Vec<u8>,
    changed: Vec<u8>,
    best_weights: Vec<f64>,
    frames: Vec<Frame>,
    scans: Vec<Scan>,
    depths: Vec<Option<StationDepth>>,
    options: StationOptions,
    newly_coloured: u32,
    recoloured: u32,
    occluded_samples: u32,
}

#[wasm_bindgen]
impl StonexStationSession {
    /// Takes the point cloud, the raw planes and the colour arrays by value.
    ///
    /// A `&[f32]` argument is copied into wasm memory for the call and would
    /// have to be copied again to retain it; owning them costs one copy of the
    /// archive instead of two, and the host keeps its own arrays untouched
    /// until it reads the results back at the end.
    #[wasm_bindgen(constructor)]
    #[allow(clippy::too_many_arguments)]
    pub fn new(
        positions: Vec<f32>,
        pixels: Vec<u8>,
        raw_colours: Vec<u8>,
        frame_indices: Vec<u16>,
        coloured: Vec<u8>,
        frames_json: &str,
        scans_json: &str,
        options_json: &str,
    ) -> Result<StonexStationSession, String> {
        // A `String` error rather than a `JsValue`: wasm-bindgen throws it just
        // the same, and building a `JsValue` outside wasm panics, which would
        // put every one of these guards out of reach of a native test.
        let fail = |message: String| message;
        let frames: Vec<Frame> = serde_json::from_str(frames_json)
            .map_err(|error| fail(format!("bad frames json: {error}")))?;
        let scans: Vec<Scan> = serde_json::from_str(scans_json)
            .map_err(|error| fail(format!("bad scans json: {error}")))?;
        let options: StationOptions = serde_json::from_str(options_json)
            .map_err(|error| fail(format!("bad options json: {error}")))?;

        let point_count = positions.len() / 3;
        if frame_indices.len() != point_count || coloured.len() != point_count {
            return Err(fail(format!(
                "expected {point_count} frame indices and colour flags"
            )));
        }
        if raw_colours.len() != point_count * 3 {
            return Err(fail(format!("expected {} colour bytes", point_count * 3)));
        }
        for frame in &frames {
            if frame.pixel_offset + frame.raw_width * frame.raw_height > pixels.len() {
                return Err(fail("frame pixels outside the supplied buffer".into()));
            }
            if frame.viewer_to_camera.len() != 16 {
                return Err(fail("viewerToCamera must have 16 values".into()));
            }
        }
        for scan in &scans {
            if scan.transform.len() != 16 {
                return Err(fail("scan transform must have 16 values".into()));
            }
            if scan.station >= scans.len() {
                return Err(fail("scan station is not one of the scans".into()));
            }
        }

        // A point counts as coloured exactly when it already has a frame, and
        // that existing view is worth a hair more than nothing: it is only
        // replaced by a demonstrably better one, never by whichever frame
        // happens to run last.
        let best_weights = coloured
            .iter()
            .map(|flag| if *flag != 0 { 1e-6 } else { 0.0 })
            .collect();
        let depths = scans.iter().map(|_| None).collect();

        Ok(StonexStationSession {
            positions,
            pixels,
            colours: raw_colours,
            frame_indices,
            coloured,
            changed: vec![0u8; point_count],
            best_weights,
            frames,
            scans,
            depths,
            options,
            newly_coloured: 0,
            recoloured: 0,
            occluded_samples: 0,
        })
    }

    #[wasm_bindgen(getter)]
    pub fn scan_count(&self) -> u32 {
        self.scans.len() as u32
    }

    /// Colours one scan from every station's cameras.
    ///
    /// Returns true when it wrote anything, so the host can publish only the
    /// scans that actually changed.
    pub fn colour_scan(&mut self, scan_index: u32) -> bool {
        let Some(scan) = self.scans.get(scan_index as usize).cloned() else {
            return false;
        };
        let point_count = self.positions.len() / 3;
        let end = (scan.point_offset + scan.point_count).min(point_count);
        if scan.point_offset >= end {
            return false;
        }

        if !self.options.recolor_already_colored
            && self.coloured[scan.point_offset..end]
                .iter()
                .all(|f| *f != 0)
        {
            // Nothing to do for a scan that is already fully coloured, and in
            // the default mode that is every scan a camera of its own station
            // covered - the big ones. Skipping them here rather than per point
            // turns an archive with three photographed stations from a walk
            // over every point once per station into a walk over just the grey
            // preview sweeps.
            return false;
        }

        let mut wrote = false;
        for station_index in 0..self.scans.len() {
            let station_scan = self.scans[station_index].clone();
            if self.options.own_station_only && station_scan.station != scan.station {
                continue;
            }
            let station_frames: Vec<usize> = (0..self.frames.len())
                .filter(|index| self.frames[*index].station == station_scan.station)
                .collect();
            if station_frames.is_empty() {
                continue;
            }

            // A station's depth buffer is built from its own points and reused
            // by every frame it shot and every scan it colours; building it per
            // frame would repeat a full pass over the station's points ten
            // times over.
            if self.depths[station_index].is_none() {
                self.depths[station_index] = Some(StationDepth::new(
                    &self.positions,
                    station_scan.point_offset,
                    station_scan.point_count,
                ));
            }

            // `T_station⁻¹ · T_scan`, with the column-major placements
            // converted to the projector's row-major layout on the way in.
            let scan_to_station = multiply_row_major(
                &invert_rigid(&transpose(&station_scan.transform)),
                &transpose(&scan.transform),
            );

            // Disjoint borrows: the pass reads the points and the pixels while
            // it writes the colours, so hand the fields over individually
            // rather than `&mut self`.
            wrote |= colour_scan_from_station(
                &self.positions,
                &self.pixels,
                &self.frames,
                &station_frames,
                self.depths[station_index].as_ref().unwrap(),
                &scan_to_station,
                scan.point_offset,
                end,
                &self.options,
                &mut self.colours,
                &mut self.frame_indices,
                &mut self.coloured,
                &mut self.changed,
                &mut self.best_weights,
                &mut self.newly_coloured,
                &mut self.recoloured,
                &mut self.occluded_samples,
            );
        }
        wrote
    }

    /// This scan's colours, for publishing it before the rest are done.
    pub fn scan_colours(&self, scan_index: u32) -> Vec<u8> {
        match self.scans.get(scan_index as usize) {
            None => Vec::new(),
            Some(scan) => {
                let start = (scan.point_offset * 3).min(self.colours.len());
                let end = ((scan.point_offset + scan.point_count) * 3).min(self.colours.len());
                self.colours[start..end].to_vec()
            }
        }
    }

    pub fn scan_frame_indices(&self, scan_index: u32) -> Vec<u16> {
        match self.scans.get(scan_index as usize) {
            None => Vec::new(),
            Some(scan) => {
                let start = scan.point_offset.min(self.frame_indices.len());
                let end = (scan.point_offset + scan.point_count).min(self.frame_indices.len());
                self.frame_indices[start..end].to_vec()
            }
        }
    }

    /// Points that gained colour they did not have before.
    #[wasm_bindgen(getter)]
    pub fn newly_colored(&self) -> u32 {
        self.newly_coloured
    }
    /// Points whose colour was replaced by a better view.
    #[wasm_bindgen(getter)]
    pub fn recolored(&self) -> u32 {
        self.recoloured
    }
    /// Point-station pairs rejected because that station could not see the
    /// point. Counted per attempt: one point hidden from three stations
    /// contributes three.
    #[wasm_bindgen(getter)]
    pub fn occluded_samples(&self) -> u32 {
        self.occluded_samples
    }

    pub fn take_colours(&mut self) -> Vec<u8> {
        std::mem::take(&mut self.colours)
    }
    pub fn take_frame_indices(&mut self) -> Vec<u16> {
        std::mem::take(&mut self.frame_indices)
    }
    pub fn take_coloured(&mut self) -> Vec<u8> {
        std::mem::take(&mut self.coloured)
    }
    /// One flag per point, set where this pass wrote.
    pub fn take_changed(&mut self) -> Vec<u8> {
        std::mem::take(&mut self.changed)
    }
}

/// One scan's points against one station's cameras.
#[allow(clippy::too_many_arguments)]
fn colour_scan_from_station(
    positions: &[f32],
    pixels: &[u8],
    frames: &[Frame],
    station_frames: &[usize],
    depth: &StationDepth,
    scan_to_station: &[f64; 16],
    from: usize,
    to: usize,
    options: &StationOptions,
    colours: &mut [u8],
    frame_indices: &mut [u16],
    coloured: &mut [u8],
    changed: &mut [u8],
    best_weights: &mut [f64],
    newly_coloured: &mut u32,
    recoloured: &mut u32,
    occluded_samples: &mut u32,
) -> bool {
    // Everything that does not vary per point is built once per station.
    // Choosing a distortion model is a branch on the coefficient count and
    // describing a frame to the sampler clones its coefficients; both used to
    // sit inside the per-point loop, with millions of points behind them.
    struct Prepared<'a> {
        index: usize,
        intrinsics: Intrinsics,
        distortion: OpenCvPinhole,
        viewer_to_camera: [f64; 16],
        mosaic: bayer::BayerFrame<'a>,
    }
    let prepared: Vec<Prepared> = station_frames
        .iter()
        .map(|index| {
            let frame = &frames[*index];
            let mut viewer_to_camera = [0f64; 16];
            viewer_to_camera.copy_from_slice(&frame.viewer_to_camera);
            Prepared {
                index: *index,
                intrinsics: Intrinsics {
                    fx: frame.fx,
                    fy: frame.fy,
                    cx: frame.cx,
                    cy: frame.cy,
                },
                distortion: OpenCvPinhole::new(&frame.distortion),
                viewer_to_camera,
                mosaic: frame.as_bayer_frame(pixels),
            }
        })
        .collect();

    let mut wrote = false;
    for index in from..to {
        if !options.recolor_already_colored && coloured[index] != 0 {
            // Default: fill in the grey and leave existing colour alone. The
            // check is on the point, not on whether this is its own station - a
            // camera one station away is not automatically an improvement on
            // the one that stood right next to the surface.
            continue;
        }
        let base = index * 3;
        let local = transform_point(
            scan_to_station,
            positions[base] as f64,
            positions[base + 1] as f64,
            positions[base + 2] as f64,
        );
        // Scanner azimuth, matching the parser's column headers.
        let azimuth = local[1].atan2(local[0]).to_degrees();

        let mut visible: Option<bool> = None;
        for candidate in &prepared {
            let frame = &frames[candidate.index];
            if angular_difference(frame.pan_degrees, azimuth) > FRAME_AZIMUTH_WINDOW_DEGREES {
                continue;
            }
            // Only pay for the visibility test once a frame actually wants the
            // point.
            let seen = *visible.get_or_insert_with(|| {
                depth.is_visible(
                    local[0],
                    local[1],
                    local[2],
                    options.occlusion_tolerance,
                    options.occlusion_relative_tolerance,
                )
            });
            if !seen {
                *occluded_samples += 1;
                break;
            }

            let camera = transform_point(&candidate.viewer_to_camera, local[0], local[1], local[2]);
            if camera[2] <= 0.0 {
                continue;
            }
            if (camera[0] / camera[2]).abs() > frame.max_normalized_x
                || (camera[1] / camera[2]).abs() > frame.max_normalized_y
            {
                continue;
            }
            let projected =
                project_opencv_pinhole(candidate.intrinsics, &candidate.distortion, camera);
            if !projected.converged {
                continue;
            }
            let [pixel_x, pixel_y] = projected.value;
            if !pixel_x.is_finite()
                || !pixel_y.is_finite()
                || pixel_x < 1.0
                || pixel_y < 1.0
                || pixel_x >= frame.image_width as f64 - 1.0
                || pixel_y >= frame.image_height as f64 - 1.0
            {
                continue;
            }
            let weight = view_score(
                pixel_x,
                pixel_y,
                frame.cx,
                frame.cy,
                frame.image_width as f64,
                frame.image_height as f64,
            );
            if weight <= best_weights[index] {
                continue;
            }

            // Sampled straight out of the mosaic at the projected coordinate.
            // The alternative is the parser's own route - demosaic the whole
            // frame to a half-resolution image, then read that - which is this
            // same `sample_grbg` evaluated on a grid and re-interpolated. It is
            // a cache, not a quality step: it pays for itself only when one
            // frame serves millions of points, and costs a decode of every
            // frame (~500ms an archive) even when it serves ten thousand.
            let sample = bayer::sample_grbg(&candidate.mosaic, pixel_x, pixel_y);

            best_weights[index] = weight;
            for channel in 0..3 {
                colours[base + channel] = sample[channel].round().clamp(0.0, 255.0) as u8;
            }
            frame_indices[index] = frame.frame_number;
            changed[index] = 1;
            wrote = true;
            if coloured[index] != 0 {
                *recoloured += 1;
            } else {
                coloured[index] = 1;
                *newly_coloured += 1;
            }
        }
    }
    wrote
}

impl Frame {
    /// This frame's raw sensor plane, in the shape the mosaic sampler takes.
    fn as_bayer_frame<'a>(&self, pixels: &'a [u8]) -> bayer::BayerFrame<'a> {
        bayer::BayerFrame {
            pixels: &pixels
                [self.pixel_offset..self.pixel_offset + self.raw_width * self.raw_height],
            raw_width: self.raw_width,
            raw_height: self.raw_height,
            image_width: self.image_width,
            image_height: self.image_height,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const RAW: usize = 16;

    fn identity() -> Vec<f64> {
        vec![
            1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0,
        ]
    }

    /// A 16x16 frame looking along its station's +x, so a point on that axis
    /// lands dead centre. `focal` widens or narrows it without moving the
    /// principal point, which is how two frames end up scoring a point
    /// differently.
    fn frame_json(
        frame_number: u16,
        station: usize,
        pan: f64,
        pixel_offset: usize,
        focal: f64,
    ) -> String {
        let viewer_to_camera = vec![
            0.0, 1.0, 0.0, 0.0, // camera x = scanner y
            0.0, 0.0, 1.0, 0.0, // camera y = scanner z
            1.0, 0.0, 0.0, 0.0, // camera z = scanner x
            0.0, 0.0, 0.0, 1.0,
        ];
        format!(
            r#"{{"frameNumber":{frame_number},"station":{station},"panDegrees":{pan},
              "pixelOffset":{pixel_offset},"rawWidth":{RAW},"rawHeight":{RAW},
              "imageWidth":{RAW},"imageHeight":{RAW},
              "fx":{focal},"fy":{focal},"cx":8,"cy":8,"distortion":[0,0,0,0,0],
              "viewerToCamera":{viewer_to_camera:?},
              "maxNormalizedX":1,"maxNormalizedY":1}}"#
        )
    }

    fn scan_json(station: usize, offset: usize, count: usize, transform: &[f64]) -> String {
        format!(
            r#"{{"station":{station},"pointOffset":{offset},"pointCount":{count},"transform":{transform:?}}}"#
        )
    }

    fn options_json(recolor: bool, own_station_only: bool) -> String {
        format!(
            r#"{{"occlusionTolerance":0.08,"occlusionRelativeTolerance":0.02,
               "recolorAlreadyColored":{recolor},"ownStationOnly":{own_station_only}}}"#
        )
    }

    /// A flat sensor plane, which demosaics to that grey.
    fn flat(value: u8) -> Vec<u8> {
        vec![value; RAW * RAW]
    }

    struct Case {
        positions: Vec<f32>,
        pixels: Vec<u8>,
        colours: Vec<u8>,
        frame_indices: Vec<u16>,
        coloured: Vec<u8>,
        frames: String,
        scans: String,
    }

    impl Case {
        /// One station at the origin, one grey frame, one point in front of it.
        fn simple() -> Case {
            Case {
                positions: vec![2.0, 0.0, 0.0],
                pixels: flat(120),
                colours: vec![255; 3],
                frame_indices: vec![u16::MAX],
                coloured: vec![0],
                frames: format!("[{}]", frame_json(7, 0, 0.0, 0, 8.0)),
                scans: format!("[{}]", scan_json(0, 0, 1, &identity())),
            }
        }

        fn run(self, options: &str) -> StonexStationSession {
            let mut session = StonexStationSession::new(
                self.positions,
                self.pixels,
                self.colours,
                self.frame_indices,
                self.coloured,
                &self.frames,
                &self.scans,
                options,
            )
            .unwrap();
            for index in 0..session.scan_count() {
                session.colour_scan(index);
            }
            session
        }
    }

    /// A point in front of a frame takes that frame's pixel, and says which.
    #[test]
    fn colours_a_point_from_the_station_that_sees_it() {
        let mut session = Case::simple().run(&options_json(false, false));
        assert_eq!(session.newly_colored(), 1);
        assert_eq!(session.recolored(), 0);
        assert_eq!(session.take_colours(), vec![120, 120, 120]);
        assert_eq!(session.take_frame_indices(), vec![7]);
        assert_eq!(session.take_changed(), vec![1]);
    }

    /// Colour must not bleed through geometry: a point behind a surface the
    /// station itself measured is rejected rather than painted.
    #[test]
    fn a_point_behind_the_stations_own_surface_is_rejected() {
        let mut session = Case {
            // A wall one metre out, and something five metres out behind it.
            positions: vec![1.0, 0.0, 0.0, 5.0, 0.0, 0.0],
            colours: vec![255; 6],
            frame_indices: vec![u16::MAX; 2],
            coloured: vec![0; 2],
            scans: format!("[{}]", scan_json(0, 0, 2, &identity())),
            ..Case::simple()
        }
        .run(&options_json(false, false));

        assert_eq!(session.newly_colored(), 1);
        assert!(session.occluded_samples() >= 1);
        let changed = session.take_changed();
        assert_eq!(changed[0], 1, "the surface itself is coloured");
        assert_eq!(changed[1], 0, "what is behind it is not");
    }

    /// The azimuth window really prefilters: a frame aimed the other way never
    /// offers itself.
    #[test]
    fn a_frame_facing_away_colours_nothing() {
        let session = Case {
            frames: format!("[{}]", frame_json(0, 0, 180.0, 0, 8.0)),
            ..Case::simple()
        }
        .run(&options_json(false, false));
        assert_eq!(session.newly_colored(), 0);
    }

    /// Existing colour survives by default and is taken over on request.
    #[test]
    fn existing_colour_is_kept_unless_a_recolour_is_asked_for() {
        let coloured_case = || Case {
            colours: vec![10, 20, 30],
            frame_indices: vec![3],
            coloured: vec![1],
            ..Case::simple()
        };

        let mut kept = coloured_case().run(&options_json(false, false));
        assert_eq!(kept.newly_colored(), 0);
        assert_eq!(kept.recolored(), 0);
        assert_eq!(kept.take_colours(), vec![10, 20, 30]);

        let mut redone = coloured_case().run(&options_json(true, false));
        assert_eq!(redone.recolored(), 1, "a better view takes it over");
        assert_eq!(redone.newly_colored(), 0);
        assert_eq!(redone.take_frame_indices(), vec![7]);
        assert_eq!(redone.take_colours(), vec![120, 120, 120]);
    }

    /// Two scans, one photographed station: the placements are what let its
    /// camera reach the other scan's points at all. This is the whole point of
    /// the pass, and the case a wrong matrix convention breaks while the
    /// same-station case still looks right.
    #[test]
    fn another_stations_camera_colours_this_scan() {
        // Station 1 stands four metres down +x, turned 180 degrees about z, so
        // it looks back at the origin. Column-major, as three.js stores it.
        let station_one = vec![
            -1.0, 0.0, 0.0, 0.0, // column 0
            0.0, -1.0, 0.0, 0.0, // column 1
            0.0, 0.0, 1.0, 0.0, // column 2
            4.0, 0.0, 0.0, 1.0, // translation
        ];
        let mut session = Case {
            // One point of scan 0 halfway between the stations, and one point
            // for station 1 so it has a scan of its own.
            positions: vec![2.0, 0.0, 0.0, 0.0, 0.0, 0.0],
            colours: vec![255; 6],
            frame_indices: vec![u16::MAX; 2],
            coloured: vec![0; 2],
            frames: format!("[{}]", frame_json(4, 1, 0.0, 0, 8.0)),
            scans: format!(
                "[{},{}]",
                scan_json(0, 0, 1, &identity()),
                scan_json(1, 1, 1, &station_one)
            ),
            ..Case::simple()
        }
        .run(&options_json(false, false));

        assert_eq!(session.newly_colored(), 1);
        assert_eq!(session.take_frame_indices()[0], 4, "coloured by station 1");
        assert_eq!(&session.take_colours()[0..3], &[120, 120, 120]);
    }

    /// Restricting to a scan's own station is the diagnostic mode, and it must
    /// leave a scan whose station never held a camera untouched.
    #[test]
    fn own_station_only_ignores_other_stations_cameras() {
        let station_one = vec![
            -1.0, 0.0, 0.0, 0.0, 0.0, -1.0, 0.0, 0.0, 0.0, 0.0, 1.0, 0.0, 4.0, 0.0, 0.0, 1.0,
        ];
        let session = Case {
            positions: vec![2.0, 0.0, 0.0, 0.0, 0.0, 0.0],
            colours: vec![255; 6],
            frame_indices: vec![u16::MAX; 2],
            coloured: vec![0; 2],
            frames: format!("[{}]", frame_json(4, 1, 0.0, 0, 8.0)),
            scans: format!(
                "[{},{}]",
                scan_json(0, 0, 1, &identity()),
                scan_json(1, 1, 1, &station_one)
            ),
            ..Case::simple()
        }
        .run(&options_json(false, true));
        assert_eq!(
            session.newly_colored(),
            0,
            "station 0 has no camera of its own"
        );
    }

    /// Best view wins, not last view: the frame that saw the point nearer its
    /// centre supplies the colour even though it is listed first and would
    /// otherwise be overwritten.
    #[test]
    fn the_more_central_of_two_frames_wins() {
        let mut pixels = flat(40);
        pixels.extend_from_slice(&flat(120));
        let mut session = Case {
            // Off the axis, so the two focal lengths place it at different
            // distances from the principal point.
            positions: vec![2.0, 0.5, 0.0],
            pixels,
            frames: format!(
                "[{},{}]",
                // Listed first, narrower, so it sees the point further out.
                frame_json(1, 0, 0.0, 0, 16.0),
                frame_json(2, 0, 0.0, RAW * RAW, 8.0)
            ),
            ..Case::simple()
        }
        .run(&options_json(false, false));

        assert_eq!(session.take_frame_indices(), vec![2]);
        assert_eq!(session.take_colours(), vec![120, 120, 120]);
    }

    /// A scan can be published as soon as it is done, so its own slice of the
    /// archive's arrays has to come back on its own.
    #[test]
    fn a_finished_scan_can_be_read_on_its_own() {
        let mut session = StonexStationSession::new(
            vec![2.0, 0.0, 0.0, 3.0, 0.0, 0.0],
            flat(120),
            vec![255; 6],
            vec![u16::MAX; 2],
            vec![0; 2],
            &format!("[{}]", frame_json(7, 0, 0.0, 0, 8.0)),
            &format!(
                "[{},{}]",
                scan_json(0, 0, 1, &identity()),
                scan_json(0, 1, 1, &identity())
            ),
            &options_json(false, false),
        )
        .unwrap();

        assert!(session.colour_scan(0), "the first scan is coloured");
        assert_eq!(session.scan_colours(0), vec![120, 120, 120]);
        assert_eq!(session.scan_frame_indices(0), vec![7]);
        // The second scan has not run yet, so its slice is still untouched.
        assert_eq!(session.scan_colours(1), vec![255, 255, 255]);
        assert_eq!(session.scan_frame_indices(1), vec![u16::MAX]);
    }

    /// Mismatched arrays are a caller bug worth catching at the boundary rather
    /// than colouring the wrong points.
    #[test]
    fn arrays_that_do_not_match_the_point_count_are_refused() {
        let case = Case::simple();
        assert!(StonexStationSession::new(
            case.positions,
            case.pixels,
            vec![255; 9],
            case.frame_indices,
            case.coloured,
            &case.frames,
            &case.scans,
            &options_json(false, false),
        )
        .is_err());
    }

    /// "Best view wins" means the more central of two frames, not the last one.
    #[test]
    fn the_view_score_prefers_the_centre() {
        let centre = view_score(50.0, 50.0, 50.0, 50.0, 100.0, 100.0);
        let off_centre = view_score(80.0, 50.0, 50.0, 50.0, 100.0, 100.0);
        let at_edge = view_score(1.0, 50.0, 50.0, 50.0, 100.0, 100.0);
        assert!(centre > off_centre, "{centre} vs {off_centre}");
        assert!(off_centre > at_edge, "{off_centre} vs {at_edge}");
        assert!(at_edge >= 0.0);
    }

    /// The two matrix conventions meet in this file, and composing them wrongly
    /// is invisible whenever the other factor is the identity - so check a
    /// transform that is neither.
    #[test]
    fn a_rigid_inverse_undoes_its_transform() {
        let m = [
            0.0, -1.0, 0.0, 5.0, 1.0, 0.0, 0.0, -2.0, 0.0, 0.0, 1.0, 3.0, 0.0, 0.0, 0.0, 1.0,
        ];
        let inverse = invert_rigid(&m);
        let point = [1.5, -0.5, 2.0];
        let there = transform_point(&m, point[0], point[1], point[2]);
        let back = transform_point(&inverse, there[0], there[1], there[2]);
        for axis in 0..3 {
            assert!(
                (back[axis] - point[axis]).abs() < 1e-12,
                "axis {axis}: {} vs {}",
                back[axis],
                point[axis]
            );
        }
        // And the composition order matches: the inverse times the transform is
        // the identity.
        let composed = multiply_row_major(&inverse, &m);
        for (index, value) in composed.iter().enumerate() {
            let expected = if index % 5 == 0 { 1.0 } else { 0.0 };
            assert!((value - expected).abs() < 1e-12, "entry {index}: {value}");
        }
    }
}
