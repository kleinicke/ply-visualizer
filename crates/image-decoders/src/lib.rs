//! Reusable decoders for scientific, medical, HDR, and standard images.
//!
//! This crate contains byte parsing and pixel decoding only. It deliberately
//! has no JavaScript-facing API; applications provide their own native, WASM,
//! or FFI adapters around these Rust types.

use std::fmt;

/// Error returned when encoded bytes cannot be decoded.
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct DecodeError(String);

impl DecodeError {
    pub fn new(message: impl Into<String>) -> Self {
        Self(message.into())
    }

    pub fn message(&self) -> &str {
        &self.0
    }
}

impl fmt::Display for DecodeError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(&self.0)
    }
}

impl std::error::Error for DecodeError {}

#[cfg(any(feature = "demosaic", feature = "tiff"))]
mod demosaic;
#[cfg(any(feature = "demosaic", feature = "tiff"))]
pub use demosaic::{demosaic, DemosaicResult};

mod formats;
mod pipeline;
#[cfg(any(feature = "tiff", feature = "exr", feature = "png", feature = "hdr"))]
mod time;
#[cfg(feature = "tiff")]
pub use formats::tiff::region::{TiffRegion, TiffRegionResult};
pub use pipeline::stats;

#[cfg(feature = "czi")]
use formats::czi::{
    czi_header_json, czi_layout_json, czi_region_plan_json, decode_czi_impl, decode_czi_region_impl,
};
#[cfg(feature = "dicom")]
use formats::dicom::decode_dicom_impl;
#[cfg(feature = "exr")]
use formats::exr::decode_exr_impl;
#[cfg(feature = "fits")]
use formats::fits::decode_fits_impl;
#[cfg(feature = "hdr")]
use formats::hdr::decode_hdr_impl;
#[cfg(feature = "lif")]
use formats::lif::{decode_lif_impl, decode_lif_sparse};
#[cfg(feature = "nd2")]
use formats::nd2::{decode_nd2_impl, decode_nd2_sparse};
#[cfg(feature = "netcdf")]
use formats::netcdf::decode_netcdf_impl;
#[cfg(feature = "netpbm")]
use formats::netpbm::decode_ppm_impl;
#[cfg(feature = "npy")]
use formats::npy::{decode_npy_display_impl, decode_npy_impl};
#[cfg(feature = "pfm")]
use formats::pfm::decode_pfm_impl;
#[cfg(feature = "png")]
use formats::png::decode_png16_impl;
#[cfg(feature = "sdt")]
use formats::sdt::decode_sdt_impl;
#[cfg(feature = "tiff")]
use formats::tiff::{decode_tiff_impl, tags::extract_bare_ifd_tags_json};

#[cfg(any(feature = "jpeg", feature = "tiff"))]
use std::io::Cursor;
use std::mem;
#[cfg(feature = "tiff")]
use tiff::decoder::Decoder;

/// Result type for TIFF decoding operations
pub struct TiffResult {
    width: u32,
    height: u32,
    channels: u32,
    bits_per_sample: u32,
    sample_format: u32, // 1=uint, 2=int, 3=float
    // Metadata fields
    compression: u32,
    predictor: u32,
    photometric_interpretation: u32,
    planar_configuration: u32,
    rows_per_strip: u32,
    strip_count: u32,
    strip_byte_count_total: u64,
    strip_byte_count_max: u64,
    tile_width: u32,
    tile_length: u32,
    tile_count: u32,
    direct_decode: bool,
    // Data stored as bytes, interpreted based on sample_format
    data: Vec<u8>,
    // Float representation used by the webview render pipeline. For float TIFFs
    // this avoids converting decoded f32 pixels to bytes and back again.
    data_f32: Vec<f32>,
    // Computed statistics
    min_value: f64,
    max_value: f64,
    timing_metadata_ms: f64,
    timing_decode_ms: f64,
    timing_convert_ms: f64,
    timing_stats_ms: f64,
    timing_pack_ms: f64,
    // JSON array of every tag found in the main IFD, plus any Exif/GPS sub-IFD,
    // as `{"tag":<u16>,"name":"<Tag debug name>","group":"TIFF"|"Exif"|"GPS","value":"<string>"}`.
    all_tags_json: String,
    // OME-XML always lives in the first IFD's ImageDescription. Carry it with
    // every page result so restoring directly to a later page still has the
    // dataset's C/Z/T semantics without decoding page zero first.
    ome_xml: String,
    // GeoTIFF georeferencing (34735/34736/34737 unpacked, plus the model
    // transform from 33550+33922 or 34264) as JSON, or empty for a TIFF that
    // carries none. Computed per page like `ome_xml` above, because a
    // multi-page GeoTIFF's pages can sit at different resolutions.
    geo_json: String,
    // What the file's other images ARE — separate pages, pyramid overviews, or
    // masks — as JSON. See formats::tiff::pages. Whole-file, not per-page, so
    // every page result carries the same value.
    page_directory_json: String,
}

pub struct ExrResult {
    width: u32,
    height: u32,
    channels: u32,
    data_f32: Vec<f32>,
    channel_names_csv: String,
    displayed_channels_csv: String,
    format: u32,
    data_type: u32,
    timing_read_ms: f64,
    timing_pack_ms: f64,
    timing_total_ms: f64,
    // Min/max over the scanned channels, computed during the pack pass that
    // already walks every sample. Without these the webview re-scanned the
    // whole image in JavaScript purely to get the normalization range.
    data_min: f64,
    data_max: f64,
    // JSON array of every EXR header attribute (image + layer, named fields
    // plus the crate's generic "other"/custom-attribute bags), in the same
    // {"tag","name","group","value"} shape as TiffResult.all_tags_json.
    all_tags_json: String,
}

/// Compressed blocks and metadata for the guarded parallel EXR ZIP16 path.
pub struct ExrZipPlan {
    pub width: u32,
    pub height: u32,
    pub data_y: i32,
    pub channel_name: String,
    /// Every channel, in the file's (block) order.
    pub channel_names: Vec<String>,
    /// Each channel's pixel type: 0 u32, 1 half, 2 float.
    pub channel_kinds: Vec<u32>,
    /// The displayed channels as indices into `channel_names` (-1: absent,
    /// shown as 1.0), as `decode_exr_fast` selects them.
    pub selection: Vec<i32>,
    pub displayed_names: Vec<String>,
    pub compressed: Vec<u8>,
    pub counts: Vec<u32>,
    pub y_coordinates: Vec<i32>,
    pub all_tags_json: String,
}

pub struct PngResult {
    width: u32,
    height: u32,
    channels: u32,
    bit_depth: u32,
    color_type: u32,
    data_u16: Vec<u16>,
    timing_read_info_ms: f64,
    timing_decode_ms: f64,
    timing_convert_ms: f64,
    timing_total_ms: f64,
}

pub struct HdrResult {
    channels: u32,
    data_f32: Vec<f32>,
    metadata_f64: Vec<f64>,
    all_tags_json: String,
}

/// Unified result type for every format whose decoder needs nothing beyond a
/// plain raster: PFM, NetPBM (PBM/PGM/PPM), NPY/NPZ, FITS, classic NetCDF and
/// DICOM. These used to be four near-identical structs (`PfmResult`,
/// `PpmResult`, `NpyResult`, `ScientificResult`) that each restated the same
/// handful of concepts in slightly different words; `DecodedArray` is the one
/// shape all six `decode_*_fast` entry points below return.
///
/// - `sample_format`: 1 = unsigned int, 2 = signed int, 3 = float (the same
///   TIFF convention `TiffResult.sample_format` already uses).
/// - `sample_kind`: which `take_data_as_*` getter actually holds data —
///   0 = `take_data_as_f32`, 1 = `take_data_as_u8`, 2 = `take_data_as_u16`,
///   3 = native-endian u16 bytes via `take_data_as_u8` (owned NetPBM display
///   fast path; avoids a second full-size WASM allocation).
///   The other two getters return an empty `Vec` for a given result.
/// - `format_label`: a human sub-variant string (e.g. "PGM (Binary)"); `""`
///   when the format has no such concept.
/// - `metadata_json`: a JSON object string (`formats/json_value.rs`), mirroring
///   the TS `metadata: Record<string, any>` shape; `"{}"` when the format has
///   no extra metadata.
pub struct DecodedArray {
    width: u32,
    height: u32,
    channels: u32,
    bits_per_sample: u32,
    sample_format: u32,
    type_min: f64,
    type_max: f64,
    source_numeric_type: String,
    sample_kind: u32,
    format_label: String,
    metadata_json: String,
    data_f32: Vec<f32>,
    data_u8: Vec<u8>,
    data_u16: Vec<u16>,
    source_data_offset: usize,
    can_reuse_source: bool,
    /// Guards the one-shot `take_data_as_*` contract below.
    taken: bool,
    /// Sample statistics, ported from `ImageStatsCalculator.calculateFloatStats`
    /// / `.calculateIntegerStats` (`media/modules/normalization-helper.ts`) and
    /// filled in by `finalize_stats()` below. See that method for why this is
    /// computed unconditionally rather than behind a "needs stats" flag.
    data_min: f64,
    data_max: f64,
    non_finite_count: f64,
    valid_count: f64,
}

impl DecodedArray {
    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    pub fn channels(&self) -> u32 {
        self.channels
    }

    pub fn bits_per_sample(&self) -> u32 {
        self.bits_per_sample
    }

    pub fn sample_format(&self) -> u32 {
        self.sample_format
    }

    pub fn type_min(&self) -> f64 {
        self.type_min
    }

    pub fn type_max(&self) -> f64 {
        self.type_max
    }

    pub fn source_numeric_type(&self) -> String {
        self.source_numeric_type.clone()
    }

    pub fn sample_kind(&self) -> u32 {
        self.sample_kind
    }

    pub fn format_label(&self) -> String {
        self.format_label.clone()
    }

    pub fn metadata_json(&self) -> String {
        self.metadata_json.clone()
    }

    pub fn data_min(&self) -> f64 {
        self.data_min
    }

    pub fn data_max(&self) -> f64 {
        self.data_max
    }

    pub fn non_finite_count(&self) -> f64 {
        self.non_finite_count
    }

    pub fn valid_count(&self) -> f64 {
        self.valid_count
    }

    /// Number of scalar samples in the active carrier. Used by the WASM
    /// adapter to copy directly into a transferred JavaScript buffer without
    /// first allocating another full-size typed array.
    pub fn data_len(&self) -> usize {
        if self.can_reuse_source {
            return (self.width as usize)
                .saturating_mul(self.height as usize)
                .saturating_mul(self.channels as usize);
        }
        match self.sample_kind {
            1 => self.data_u8.len(),
            2 => self.data_u16.len(),
            3 => self.data_u8.len() / 2,
            _ => self.data_f32.len(),
        }
    }

    pub fn source_data_offset(&self) -> usize {
        self.source_data_offset
    }

    pub fn can_reuse_source(&self) -> bool {
        self.can_reuse_source
    }

    /// Release a decoded carrier when JavaScript can safely use a typed view
    /// of the original transferred source instead (plain native-endian f32
    /// NPY). This avoids copying the full raster out of WASM.
    pub fn discard_data(&mut self) {
        self.data_f32.clear();
        self.data_f32.shrink_to_fit();
        self.data_u8.clear();
        self.data_u8.shrink_to_fit();
        self.data_u16.clear();
        self.data_u16.shrink_to_fit();
        self.taken = true;
    }

    /// Moves the raster out as `Vec<f32>` (valid when `sample_kind == 0`).
    ///
    /// ONE-SHOT. The samples are moved rather than copied, because copying a
    /// multi-hundred-megabyte raster to satisfy a second caller would be a
    /// serious cost to pay for a mistake. A second call therefore CANNOT
    /// return the data — but it now fails loudly instead of handing back an
    /// empty `Vec`, which is what silently produced blank images and
    /// `undefined` samples twice in this project's history.
    pub fn take_data_as_f32(&mut self) -> Result<Vec<f32>, DecodeError> {
        self.claim("take_data_as_f32")?;
        Ok(mem::take(&mut self.data_f32))
    }

    /// Moves the raster out as `Vec<u8>` (valid when `sample_kind == 1`).
    /// One-shot; see [`DecodedArray::take_data_as_f32`].
    pub fn take_data_as_u8(&mut self) -> Result<Vec<u8>, DecodeError> {
        self.claim("take_data_as_u8")?;
        Ok(mem::take(&mut self.data_u8))
    }

    /// Moves the raster out as `Vec<u16>` (valid when `sample_kind == 2`).
    /// One-shot; see [`DecodedArray::take_data_as_f32`].
    pub fn take_data_as_u16(&mut self) -> Result<Vec<u16>, DecodeError> {
        self.claim("take_data_as_u16")?;
        Ok(mem::take(&mut self.data_u16))
    }
}

impl DecodedArray {
    /// Enforces the one-shot contract shared by the three takers. The samples
    /// live in ONE of the three buffers, so claiming any of them consumes the
    /// result: asking for the wrong carrier is a caller bug too, and is better
    /// reported than answered with an empty array.
    fn claim(&mut self, method: &str) -> Result<(), DecodeError> {
        if self.taken {
            return Err(DecodeError::new(format!(
                "DecodedArray::{method} called more than once. The decoded samples are \
                 moved out on the first call, not copied. Take them once and reuse that \
                 array (media/modules/wasm-decoders.ts does this for every format)."
            )));
        }
        self.taken = true;
        Ok(())
    }

    /// Scans the samples once and fills `data_min`/`data_max`/`non_finite_count`/
    /// `valid_count`, ported from `ImageStatsCalculator.calculateFloatStats` /
    /// `.calculateIntegerStats` (`media/modules/normalization-helper.ts`) via
    /// the shared `pipeline::stats` helpers — same channel-scanning convention
    /// (`scan_channels`), same non-finite exclusion rules, same "no valid
    /// samples" min/max fallback (`extended = false` keeps +/-Infinity, which
    /// is what the render-time normalization range this feeds expects).
    ///
    /// Called by array/scientific decoders whose default auto-normalization
    /// consumes the range immediately. PFM and NetPBM deliberately use their
    /// `*_display_fast` entry points without this scan: both default to gamma
    /// mode, and their large RGB files showed that an unconditional pass was
    /// pure first-paint overhead. Their processors request Rust-backed stats
    /// lazily if the visualization mode changes.
    // Deliberately NOT gated on a list of features. Nearly every decoder ends
    // by calling this, the list went stale three times as formats moved
    // between builds, and each time the symptom was a feature combination that
    // simply did not compile. `allow(dead_code)` costs nothing here — the
    // linker drops it from a build that has no caller.
    #[allow(dead_code)]
    fn finalize_stats(mut self) -> Self {
        let stats = match self.sample_kind {
            1 => pipeline::stats::compute_image_range_uint(
                &self.data_u8,
                self.width,
                self.height,
                self.channels,
            ),
            2 => pipeline::stats::compute_image_range_uint(
                &self.data_u16,
                self.width,
                self.height,
                self.channels,
            ),
            _ => pipeline::stats::compute_image_range_f32(
                &self.data_f32,
                self.width,
                self.height,
                self.channels,
            ),
        };
        self.data_min = stats.min;
        self.data_max = stats.max;
        self.non_finite_count = stats.non_finite_count;
        self.valid_count = stats.valid_count;
        self
    }

    #[allow(dead_code)]
    fn maybe_finalize_stats(self, compute_stats: bool) -> Self {
        if compute_stats {
            self.finalize_stats()
        } else {
            self
        }
    }

    #[cfg(feature = "npy")]
    fn with_precomputed_range(mut self, stats: pipeline::stats::ImageRange) -> Self {
        self.data_min = stats.min;
        self.data_max = stats.max;
        self.non_finite_count = stats.non_finite_count;
        self.valid_count = stats.valid_count;
        self
    }
}

#[cfg(any(
    feature = "jpeg2000",
    feature = "jpegxr",
    feature = "jxl",
    feature = "fits",
    feature = "netcdf",
    feature = "dicom",
    feature = "czi",
    feature = "nd2",
    feature = "lif",
    feature = "sdt"
))]
impl From<formats::scientific_common::ScientificParsed> for DecodedArray {
    fn from(p: formats::scientific_common::ScientificParsed) -> Self {
        DecodedArray {
            taken: false,
            width: p.width,
            height: p.height,
            channels: p.channels,
            bits_per_sample: p.bits_per_sample,
            sample_format: p.sample_format,
            type_min: p.type_min,
            type_max: p.type_max,
            source_numeric_type: p.source_numeric_type,
            sample_kind: 0,
            format_label: String::new(),
            metadata_json: p.metadata_json,
            data_f32: p.data,
            data_u8: Vec::new(),
            data_u16: Vec::new(),
            source_data_offset: 0,
            can_reuse_source: false,
            data_min: 0.0,
            data_max: 0.0,
            non_finite_count: 0.0,
            valid_count: 0.0,
        }
        .finalize_stats()
    }
}

/// Small, format-neutral result used when a container (currently DICOM)
/// supplies an individual JPEG codestream to the shared Rust decoder.
pub struct JpegResult {
    width: u32,
    height: u32,
    channels: u32,
    data_u8: Vec<u8>,
}

impl JpegResult {
    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    pub fn channels(&self) -> u32 {
        self.channels
    }

    pub fn take_data_as_u8(&mut self) -> Vec<u8> {
        mem::take(&mut self.data_u8)
    }
}

/// Decode a complete JPEG codestream. DICOM parsing and frame extraction stay
/// in TypeScript; this reuses the same zune-jpeg codec already used by TIFF.
///
/// # Output is not bit-stable across build flags
///
/// Enabling `-C target-feature=+simd128` changes this decoder's output by +/-1
/// on a minority of samples (measured: 3687 of 262144 on a 512x512 JPEG-baseline
/// DICOM, maximum absolute difference 1). Nothing here is wrong in either build.
///
/// The JPEG standard (ISO/IEC 10918-1) does NOT specify a bit-exact inverse DCT:
/// it defines an accuracy tolerance and lets implementations choose their own
/// IDCT. zune-jpeg's hand-written SIMD is AVX2-gated and so is not active on
/// wasm32; what changes is that LLVM autovectorizes its *scalar* IDCT
/// differently once simd128 is available, and the intermediate rounding lands
/// differently. Two conformant JPEG decoders routinely disagree by +/-1 for the
/// same reason.
///
/// Consequences worth knowing:
/// - Only LOSSY JPEG pixel data is affected. Uncompressed and lossless DICOM
///   transfer syntaxes are bit-exact (verified: `1.2.840.10008.1.2.1` shows zero
///   differing samples, `1.2.840.10008.1.2.4.50` shows the +/-1 spread).
/// - Pixel-inspector readouts on lossy JPEG images can therefore differ by 1
///   between builds. For lossy data there is no single "correct" stored value to
///   be off by; quantitative work should not be reading lossy JPEG anyway.
/// - `test/goldens/external/dicom-fixture-external-0002-dcm.json` has moved
///   when SIMD was enabled and again when DICOM JPEG Baseline was switched to
///   this shared decoder. Re-capturing it is a decision to accept IDCT
///   variance, not a routine refresh.
#[cfg(feature = "jpeg")]
pub fn decode_jpeg_fast(data: &[u8]) -> Result<JpegResult, DecodeError> {
    decode_jpeg_impl(data, None)
}

/// `decode_jpeg_fast`, but able to pin the output colorspace.
///
/// zune-jpeg's default expands a single-component (greyscale) JPEG to three
/// RGB channels. That suits the callers that hand the result straight to a
/// canvas, but not DICOM: a MONOCHROME2 dataset declares one sample per pixel,
/// and three would disagree with every other tag in the file. Passing the
/// dataset's own SamplesPerPixel keeps the decode honest to the container.
#[cfg(feature = "jpeg")]
pub(crate) fn decode_jpeg_with_channels(
    data: &[u8],
    channels: u32,
) -> Result<JpegResult, DecodeError> {
    let colorspace = match channels {
        1 => zune_jpeg::zune_core::colorspace::ColorSpace::Luma,
        3 => zune_jpeg::zune_core::colorspace::ColorSpace::RGB,
        _ => {
            return Err(DecodeError::new(format!(
                "JPEG: {} samples per pixel is not a baseline JPEG output",
                channels
            )))
        }
    };
    decode_jpeg_impl(data, Some(colorspace))
}

#[cfg(feature = "jpeg")]
fn decode_jpeg_impl(
    data: &[u8],
    colorspace: Option<zune_jpeg::zune_core::colorspace::ColorSpace>,
) -> Result<JpegResult, DecodeError> {
    use zune_jpeg::JpegDecoder;

    let mut decoder = match colorspace {
        Some(colorspace) => JpegDecoder::new_with_options(
            Cursor::new(data),
            zune_jpeg::zune_core::options::DecoderOptions::default()
                .jpeg_set_out_colorspace(colorspace),
        ),
        None => JpegDecoder::new(Cursor::new(data)),
    };
    let pixels = decoder
        .decode()
        .map_err(|e| DecodeError::new(format!("JPEG decode failed: {:?}", e)))?;
    let info = decoder
        .info()
        .ok_or_else(|| DecodeError::new("JPEG: missing image info"))?;
    let pixel_count = (info.width as usize).saturating_mul(info.height as usize);
    if pixel_count == 0 || pixels.len() % pixel_count != 0 {
        return Err(DecodeError::new("JPEG: invalid decoded dimensions"));
    }
    let channels = (pixels.len() / pixel_count) as u32;
    if channels != 1 && channels != 3 && channels != 4 {
        return Err(DecodeError::new("JPEG: unsupported decoded channel count"));
    }
    Ok(JpegResult {
        width: info.width as u32,
        height: info.height as u32,
        channels,
        data_u8: pixels,
    })
}

impl HdrResult {
    pub fn channels(&self) -> u32 {
        self.channels
    }

    pub fn all_tags_json(&self) -> String {
        self.all_tags_json.clone()
    }

    pub fn take_data_as_f32(&mut self) -> Vec<f32> {
        mem::take(&mut self.data_f32)
    }

    pub fn take_metadata_as_f64(&mut self) -> Vec<f64> {
        mem::take(&mut self.metadata_f64)
    }
}

impl PngResult {
    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    pub fn channels(&self) -> u32 {
        self.channels
    }

    pub fn bit_depth(&self) -> u32 {
        self.bit_depth
    }

    pub fn color_type(&self) -> u32 {
        self.color_type
    }

    pub fn timing_read_info_ms(&self) -> f64 {
        self.timing_read_info_ms
    }

    pub fn timing_decode_ms(&self) -> f64 {
        self.timing_decode_ms
    }

    pub fn timing_convert_ms(&self) -> f64 {
        self.timing_convert_ms
    }

    pub fn timing_total_ms(&self) -> f64 {
        self.timing_total_ms
    }

    pub fn take_data_as_u16(&mut self) -> Vec<u16> {
        mem::take(&mut self.data_u16)
    }
}

impl ExrResult {
    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    pub fn channels(&self) -> u32 {
        self.channels
    }

    pub fn channel_names_csv(&self) -> String {
        self.channel_names_csv.clone()
    }

    pub fn displayed_channels_csv(&self) -> String {
        self.displayed_channels_csv.clone()
    }

    pub fn format(&self) -> u32 {
        self.format
    }

    pub fn data_type(&self) -> u32 {
        self.data_type
    }

    pub fn timing_read_ms(&self) -> f64 {
        self.timing_read_ms
    }

    pub fn timing_pack_ms(&self) -> f64 {
        self.timing_pack_ms
    }

    pub fn timing_total_ms(&self) -> f64 {
        self.timing_total_ms
    }

    pub fn data_min(&self) -> f64 {
        self.data_min
    }

    pub fn data_max(&self) -> f64 {
        self.data_max
    }

    pub fn all_tags_json(&self) -> String {
        self.all_tags_json.clone()
    }

    pub fn take_data_as_f32(&mut self) -> Vec<f32> {
        mem::take(&mut self.data_f32)
    }
}

impl TiffResult {
    pub fn width(&self) -> u32 {
        self.width
    }

    pub fn height(&self) -> u32 {
        self.height
    }

    pub fn channels(&self) -> u32 {
        self.channels
    }

    pub fn bits_per_sample(&self) -> u32 {
        self.bits_per_sample
    }

    pub fn sample_format(&self) -> u32 {
        self.sample_format
    }

    /// JavaScript carrier used for the decoded samples.
    ///
    /// This mirrors `DecodedArray::sample_kind`: 0 = f32, 1 = u8, and
    /// 3 = little-endian u16 samples packed in a byte vector. TIFF keeps
    /// signed, floating-point, and wider-than-16-bit samples on the existing
    /// f32 path because the renderer needs their signed/range semantics.
    pub fn sample_kind(&self) -> u32 {
        if self.sample_format == 1 && !self.data.is_empty() {
            if self.bits_per_sample <= 8 {
                return 1;
            }
            if self.bits_per_sample <= 16 {
                return 3;
            }
        }
        0
    }

    /// The samples split into channel planes, plane after plane, without
    /// moving them: bytes for carriers 1 (u8) and 3 (u16), empty otherwise or
    /// for a single channel. Read before `take_data_as_*`.
    #[must_use]
    pub fn planes_as_bytes(&self) -> Vec<u8> {
        let channels = self.channels as usize;
        match self.sample_kind() {
            1 if channels > 1 => split_sample_planes(&self.data, channels, 1),
            3 if channels > 1 => split_sample_planes(&self.data, channels, 2),
            _ => Vec::new(),
        }
    }

    /// The f32 samples split into channel planes (carrier 0), plane after
    /// plane; empty for a single channel or another carrier.
    #[must_use]
    pub fn planes_as_f32(&self) -> Vec<f32> {
        let channels = self.channels as usize;
        if channels < 2 || self.sample_kind() != 0 || self.data_f32.is_empty() {
            return Vec::new();
        }
        let pixels = self.data_f32.len() / channels;
        let mut planes = vec![0f32; pixels * channels];
        for (channel, plane) in planes
            .chunks_exact_mut(pixels.max(1))
            .enumerate()
            .take(channels)
        {
            for (pixel, out) in plane.iter_mut().enumerate() {
                *out = self.data_f32[pixel * channels + channel];
            }
        }
        planes
    }

    pub fn data_len(&self) -> usize {
        match self.sample_kind() {
            1 => self.data.len(),
            3 => self.data.len() / 2,
            _ if !self.data_f32.is_empty() => self.data_f32.len(),
            _ => {
                let storage_bytes = match self.bits_per_sample {
                    0 => return 0,
                    b if b <= 8 => 1usize,
                    b if b <= 16 => 2,
                    b if b <= 32 => 4,
                    _ => 8,
                };
                self.data.len() / storage_bytes
            }
        }
    }

    pub fn min_value(&self) -> f64 {
        self.min_value
    }

    pub fn max_value(&self) -> f64 {
        self.max_value
    }

    pub fn timing_metadata_ms(&self) -> f64 {
        self.timing_metadata_ms
    }

    pub fn timing_decode_ms(&self) -> f64 {
        self.timing_decode_ms
    }

    pub fn timing_convert_ms(&self) -> f64 {
        self.timing_convert_ms
    }

    pub fn timing_stats_ms(&self) -> f64 {
        self.timing_stats_ms
    }

    pub fn timing_pack_ms(&self) -> f64 {
        self.timing_pack_ms
    }

    pub fn compression(&self) -> u32 {
        self.compression
    }

    pub fn predictor(&self) -> u32 {
        self.predictor
    }

    pub fn photometric_interpretation(&self) -> u32 {
        self.photometric_interpretation
    }

    pub fn planar_configuration(&self) -> u32 {
        self.planar_configuration
    }

    pub fn rows_per_strip(&self) -> u32 {
        self.rows_per_strip
    }

    pub fn strip_count(&self) -> u32 {
        self.strip_count
    }

    pub fn strip_byte_count_total(&self) -> f64 {
        self.strip_byte_count_total as f64
    }

    pub fn strip_byte_count_max(&self) -> f64 {
        self.strip_byte_count_max as f64
    }

    pub fn tile_width(&self) -> u32 {
        self.tile_width
    }

    pub fn tile_length(&self) -> u32 {
        self.tile_length
    }

    pub fn tile_count(&self) -> u32 {
        self.tile_count
    }

    pub fn direct_decode(&self) -> bool {
        self.direct_decode
    }

    pub fn ome_xml(&self) -> String {
        self.ome_xml.clone()
    }

    pub fn all_tags_json(&self) -> String {
        self.all_tags_json.clone()
    }

    pub fn geo_json(&self) -> String {
        self.geo_json.clone()
    }

    pub fn page_directory_json(&self) -> String {
        self.page_directory_json.clone()
    }

    /// Get raw data as bytes (for transferring to JS)
    pub fn get_data_bytes(&self) -> Vec<u8> {
        if self.data.is_empty() && !self.data_f32.is_empty() {
            let mut bytes = Vec::with_capacity(self.data_f32.len() * 4);
            for &value in &self.data_f32 {
                bytes.extend_from_slice(&value.to_le_bytes());
            }
            return bytes;
        }
        self.data.clone()
    }

    /// Get data as Float32Array (most common for visualization)
    pub fn get_data_as_f32(&self) -> Vec<f32> {
        if !self.data_f32.is_empty() {
            return self.data_f32.clone();
        }

        match self.sample_format {
            3 => {
                // Already float32
                self.data
                    .chunks_exact(4)
                    .map(|bytes| f32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]))
                    .collect()
            }
            1 | 2 => {
                // `bits_per_sample` reports the SOURCE depth, which is not the
                // width the samples are stored at. A decoder that unpacks an
                // odd depth widens it to the next whole type before packing
                // (2/4-bit -> 1 byte, 10/12/14-bit -> 2 bytes, 24-bit -> 4),
                // so the read width has to be derived the same way. Keying off
                // the source depth instead returned an EMPTY image for every
                // depth that was not exactly 8, 9..=16 or 32 — 2/4/24-bit
                // files decoded successfully and then displayed nothing.
                let storage_bytes = match self.bits_per_sample {
                    0 => return vec![],
                    b if b <= 8 => 1usize,
                    b if b <= 16 => 2,
                    b if b <= 32 => 4,
                    _ => 8,
                };
                // Sample format 2 is signed: the packed bytes are a two's
                // complement value, so reading them as unsigned turns every
                // negative sample into a huge positive one.
                let signed = self.sample_format == 2;
                self.data
                    .chunks_exact(storage_bytes)
                    .map(|bytes| {
                        let mut raw: u64 = 0;
                        for (shift, byte) in bytes.iter().enumerate() {
                            raw |= (*byte as u64) << (8 * shift);
                        }
                        if signed {
                            let shift = 64 - storage_bytes as u32 * 8;
                            (((raw << shift) as i64) >> shift) as f32
                        } else {
                            raw as f32
                        }
                    })
                    .collect()
            }
            _ => vec![],
        }
    }

    /// Move float data out of the result when possible. This avoids cloning the
    /// decoded f32 vector before wasm-bindgen copies it into JS-owned memory.
    pub fn take_data_as_f32(&mut self) -> Vec<f32> {
        if !self.data_f32.is_empty() {
            return mem::take(&mut self.data_f32);
        }
        self.get_data_as_f32()
    }

    /// Move the compact unsigned carrier out without widening every sample to
    /// f32. For `sample_kind == 3` the returned bytes are little-endian u16s;
    /// JavaScript reinterprets the same ArrayBuffer as a `Uint16Array`.
    pub fn take_data_as_u8(&mut self) -> Vec<u8> {
        mem::take(&mut self.data)
    }
}

/// Decode a TIFF file from an ArrayBuffer
/// Returns TiffResult with image data and metadata
#[cfg(feature = "tiff")]
pub fn decode_tiff(data: &[u8]) -> Result<TiffResult, DecodeError> {
    decode_tiff_impl(data, true, 0)
}

/// Bytes safe to hand to `Decoder::new`, with a CFA photometric neutralized.
///
/// The `tiff` crate rejects PhotometricInterpretation 32803 when it opens a
/// file, so *every* entry point that constructs a `Decoder` has to go through
/// this or CFA/Bayer files fail before any pixels are touched. Borrows the
/// input unchanged when there is no CFA tag, so the common path copies nothing.
#[cfg(feature = "tiff")]
pub fn cfa_safe_bytes(data: &[u8]) -> std::borrow::Cow<'_, [u8]> {
    if let Some(patched) = demosaic::neutralize_cfa_photometric(data) {
        return std::borrow::Cow::Owned(patched);
    }
    // SGI Log photometrics (32844 CIE Log2(L), 32845 CIE Log2(Luv)) are refused
    // by the tiff crate in `Decoder::new` just as CFA is. Page counting does not
    // care what the photometric means, only how many IFDs there are, so
    // neutralize it here too — otherwise enumerating pages fails for a file
    // whose pixels decode perfectly well.
    #[cfg(feature = "tiff")]
    {
        let photometric = formats::tiff::raw_tag_u32(data, 0, 262).unwrap_or(1);
        if matches!(photometric, 32844 | 32845) {
            let mut patched = data.to_vec();
            if formats::tiff::patch_photometric_to_grayscale(&mut patched, 0) {
                return std::borrow::Cow::Owned(patched);
            }
        }
    }
    std::borrow::Cow::Borrowed(data)
}

/// Return the number of top-level image file directories (pages) in a TIFF.
#[cfg(feature = "tiff")]
pub fn tiff_page_count(data: &[u8]) -> Result<u32, DecodeError> {
    let bytes = cfa_safe_bytes(data);
    let mut decoder = Decoder::new(Cursor::new(bytes.as_ref()))
        .map_err(|e| DecodeError::new(format!("Failed to create decoder: {}", e)))?;
    let mut count = 1u32;
    while decoder.more_images() {
        decoder
            .next_image()
            .map_err(|e| DecodeError::new(format!("Failed to enumerate TIFF pages: {}", e)))?;
        count = count.saturating_add(1);
    }
    Ok(count)
}

/// Classify every image in a TIFF's main IFD chain: which are pages of their
/// own, which are pyramid overviews of an earlier page, which are masks.
/// Reads headers only. Returns "" for a file with no readable directory.
#[cfg(feature = "tiff")]
pub fn tiff_page_directory_json(data: &[u8]) -> String {
    formats::tiff::pages::page_directory_json(data)
}

/// A rectangle of one page of a TIFF, decoded on its own.
///
/// The cost of this follows the rectangle, not the image: only the strips or
/// tiles the rectangle touches are read. That is what lets a viewer show a
/// gigapixel scene at full resolution — it never decodes more than a window's
/// worth — and what makes an exact pixel readout affordable while a reduced
/// pyramid level is on screen.
///
/// Returns an error for layouts that are decoded whole (palette, YCbCr, CFA,
/// planar, rotated, sub-byte samples); callers fall back to the page decode.
#[cfg(feature = "tiff")]
pub fn decode_tiff_region(
    data: &[u8],
    page_index: u32,
    x: u32,
    y: u32,
    width: u32,
    height: u32,
) -> Result<formats::tiff::region::TiffRegionResult, DecodeError> {
    let plan = formats::tiff::float_strip_plan_for_page(data, page_index).ok_or_else(|| {
        DecodeError::new("Region decode: this file's layout is decoded as a whole image")
    })?;
    formats::tiff::region::decode_region(
        data,
        &plan,
        formats::tiff::region::TiffRegion {
            x,
            y,
            width,
            height,
        },
    )
}

/// A bounded preview is available for large single-page scalar float TIFFs.
/// Keep this conservative: region decoding must preserve the native samples.
#[cfg(feature = "tiff")]
pub fn tiff_preview_reduction(data: &[u8]) -> u32 {
    let Some(plan) = formats::tiff::float_strip_plan_for(data) else {
        return 0;
    };
    if plan.width as u64 * plan.height as u64 <= 130_000_000
        || plan.channels != 1
        || plan.sample_format != 3
        || plan.bits_per_sample != 32
        || !formats::tiff::region::region_decode_supported(&plan)
        || tiff_page_count(data).ok() != Some(1)
    {
        return 0;
    }
    let block_width = if plan.is_tiled() {
        plan.tile_width
    } else {
        plan.width
    };
    let block_height = if plan.is_tiled() {
        plan.tile_length
    } else {
        plan.rows_per_strip
    };
    // A stored block is the minimum allocation even for a one-pixel request.
    if block_width as u64 * block_height as u64 > 8_000_000 {
        return 0;
    }
    let mut reduction = 2;
    while plan.width.div_ceil(reduction) > 4096 || plan.height.div_ceil(reduction) > 4096 {
        reduction *= 2;
    }
    reduction
}

/// Everything a bounded preview reports except its pixels and range, with the
/// plan and reduction that produce them.
#[cfg(feature = "tiff")]
fn tiff_preview_shell(
    data: &[u8],
) -> Result<(TiffResult, formats::tiff::strips::FloatStripPlan, u32), DecodeError> {
    let reduction = tiff_preview_reduction(data);
    if reduction == 0 {
        return Err(DecodeError::new("TIFF has no bounded preview route"));
    }
    let plan = formats::tiff::float_strip_plan_for(data)
        .ok_or_else(|| DecodeError::new("TIFF has no bounded preview route"))?;
    let width = plan.width.div_ceil(reduction);
    let height = plan.height.div_ceil(reduction);
    let meta = formats::tiff::strip_metadata_for(data)?;
    let directory = format!(
        "{},{{\"index\":1,\"width\":{},\"height\":{},\"samplesPerPixel\":1,\"kind\":\"overview\",\"parent\":0,\"reduction\":{},\"blockWidth\":{},\"blockHeight\":{},\"generated\":true}}]",
        meta.page_directory_json.trim_end().trim_end_matches(']'), width, height, reduction, width, height
    );
    let result = TiffResult {
        width,
        height,
        channels: 1,
        bits_per_sample: 32,
        sample_format: 3,
        compression: plan.compression,
        predictor: plan.predictor,
        photometric_interpretation: 1,
        planar_configuration: 1,
        rows_per_strip: plan.rows_per_strip,
        strip_count: u32::try_from(plan.offsets.len()).unwrap_or(u32::MAX),
        strip_byte_count_total: plan.counts.iter().sum(),
        strip_byte_count_max: *plan.counts.iter().max().unwrap_or(&0),
        tile_width: plan.tile_width,
        tile_length: plan.tile_length,
        tile_count: 0,
        direct_decode: false,
        data: Vec::new(),
        data_f32: Vec::new(),
        min_value: f64::INFINITY,
        max_value: f64::NEG_INFINITY,
        timing_metadata_ms: 0.0,
        timing_decode_ms: 0.0,
        timing_convert_ms: 0.0,
        timing_stats_ms: 0.0,
        timing_pack_ms: 0.0,
        all_tags_json: meta.all_tags_json,
        ome_xml: meta.ome_xml,
        geo_json: meta.geo_json,
        page_directory_json: directory,
    };
    Ok((result, plan, reduction))
}

/// `decode_tiff_preview` without its pixels and range: what a caller that
/// decodes those itself (the strip pool, `decode_tiff_preview_range`) reports.
///
/// # Errors
///
/// A TIFF with no bounded preview route.
#[cfg(feature = "tiff")]
pub fn tiff_preview_header(data: &[u8]) -> Result<TiffResult, DecodeError> {
    tiff_preview_shell(data).map(|(result, _, _)| result)
}

/// Generate a nearest-sample overview without allocating the full raster.
/// Full-image finite min/max are accumulated while each stored block is read
/// once. The original file remains authoritative for region/picker requests.
///
/// # Errors
///
/// A TIFF with no bounded preview route, or a block that fails to decode.
#[cfg(feature = "tiff")]
pub fn decode_tiff_preview(data: &[u8]) -> Result<TiffResult, DecodeError> {
    use formats::tiff::region::{decode_region, TiffRegion};
    let (mut result, plan, reduction) = tiff_preview_shell(data)?;
    let width = result.width;
    let mut pixels = vec![0.0f32; width as usize * result.height as usize];
    let mut min = f32::INFINITY;
    let mut max = f32::NEG_INFINITY;
    let bw = if plan.is_tiled() {
        plan.tile_width
    } else {
        plan.width
    };
    let bh = if plan.is_tiled() {
        plan.tile_length
    } else {
        plan.rows_per_strip
    }
    .max(1);
    for y in (0..plan.height).step_by(bh as usize) {
        for x in (0..plan.width).step_by(bw as usize) {
            let region = decode_region(
                data,
                &plan,
                TiffRegion {
                    x,
                    y,
                    width: bw,
                    height: bh,
                },
            )?;
            let (low, high, _) = pipeline::stats::finite_range_mono_f32(&region.data_f32);
            if low < min {
                min = low;
            }
            if high > max {
                max = high;
            }
            // Grid anchored at source pixel (0,0), including partial edge blocks.
            for sy in ((y.div_ceil(reduction) * reduction)..y + region.region.height)
                .step_by(reduction as usize)
            {
                for sx in ((x.div_ceil(reduction) * reduction)..x + region.region.width)
                    .step_by(reduction as usize)
                {
                    pixels[(sy / reduction * width + sx / reduction) as usize] =
                        region.data_f32[((sy - y) * region.region.width + sx - x) as usize];
                }
            }
        }
    }
    result.data_f32 = pixels;
    result.min_value = f64::from(min);
    result.max_value = f64::from(max);
    Ok(result)
}

/// One strip range's share of a bounded preview: the preview rows that fall in
/// these units, and the finite min/max of every sample the units hold.
#[cfg(feature = "tiff")]
pub struct TiffPreviewRange {
    pub data: Vec<f32>,
    pub min: f32,
    pub max: f32,
}

/// The bounded preview of the units `[first_strip, ...)`, decoded unit by unit
/// so a worker never holds more than one unit at full resolution. The same
/// nearest-sample grid as `decode_tiff_preview`, anchored at source pixel
/// (0,0); concatenating the ranges in order gives its pixels exactly.
///
/// # Errors
///
/// A malformed or truncated range.
#[cfg(feature = "tiff")]
pub fn decode_tiff_preview_range(
    blob: &[u8],
    counts: &[u32],
    first_strip: u32,
    plan: &TiffFloatStripPlan,
    reduction: u32,
) -> Result<TiffPreviewRange, DecodeError> {
    use formats::tiff::strips::{decode_unit_into, strip_bytes_to_f32};
    if reduction == 0 || plan.channels != 1 || plan.bits_per_sample != 32 || plan.sample_format != 3
    {
        return Err(DecodeError::new(
            "Preview range: not a single-channel float32 preview",
        ));
    }
    let inner = inner_plan(plan);
    let width = plan.width as usize;
    let step = reduction as usize;
    let row_bytes = inner.row_bytes();
    let blocks_per_unit = inner.blocks_per_unit().max(1);
    let units = counts.len() / blocks_per_unit;
    let mut out = Vec::new();
    let mut min = f32::INFINITY;
    let mut max = f32::NEG_INFINITY;
    let mut band = Vec::new();
    let mut in_pos = 0usize;
    for index in 0..units {
        let unit = first_strip as usize + index;
        let rows = inner.rows_in(unit);
        if rows == 0 {
            break;
        }
        let mut blocks: Vec<&[u8]> = Vec::with_capacity(blocks_per_unit);
        for block in 0..blocks_per_unit {
            let count = counts[index * blocks_per_unit + block] as usize;
            let end = in_pos
                .checked_add(count)
                .filter(|end| *end <= blob.len())
                .ok_or_else(|| {
                    DecodeError::new("Preview range: compressed blob is shorter than its counts")
                })?;
            blocks.push(&blob[in_pos..end]);
            in_pos = end;
        }
        band.clear();
        band.resize(rows * row_bytes, 0);
        decode_unit_into(&blocks, &inner, unit, rows, &mut band)?;
        let samples = strip_bytes_to_f32(&band, &inner);
        let (low, high, _) = pipeline::stats::finite_range_mono_f32(&samples);
        if low < min {
            min = low;
        }
        if high > max {
            max = high;
        }
        let first_row = inner.first_row(unit);
        for local in 0..rows {
            if !(first_row + local).is_multiple_of(step) {
                continue;
            }
            let row = &samples[local * width..(local + 1) * width];
            out.extend(row.iter().step_by(step));
        }
    }
    Ok(TiffPreviewRange {
        data: out,
        min,
        max,
    })
}

/// Whether `decode_tiff_region` can serve this page at all, without decoding.
/// Lets a caller decide between a region strategy and the whole-image one
/// before committing to either.
#[cfg(feature = "tiff")]
pub fn tiff_region_decode_available(data: &[u8], page_index: u32) -> bool {
    formats::tiff::float_strip_plan_for_page(data, page_index)
        .map(|plan| formats::tiff::region::region_decode_supported(&plan))
        .unwrap_or(false)
}

/// Decode an arbitrary zero-based TIFF page and compute min/max statistics.
#[cfg(feature = "tiff")]
pub fn decode_tiff_page(data: &[u8], page_index: u32) -> Result<TiffResult, DecodeError> {
    decode_tiff_impl(data, true, page_index)
}

/// Walk a raw Exif-only IFD blob (a JPEG APP1 payload with its "Exif\0\0"
/// prefix already stripped, or a PNG eXIf chunk's raw bytes) and return
/// every tag as JSON, in the same shape as `TiffResult.all_tags_json`.
///
/// These blobs are TIFF-*structured* (byte order + magic 42 + IFD entries)
/// but are not full TIFF files — they carry no ImageWidth/PhotometricInterpretation/
/// etc., so the `tiff` crate's `Decoder::new()` (which always validates a
/// full image directory) rejects them. `extract_bare_ifd_tags_json` reads
/// the IFD structure directly instead, bypassing `Decoder` entirely; real
/// `.tif`/`.tiff` files keep using the `Decoder`-based `extract_all_tags_json`
/// via `decode_tiff`/`decode_tiff_fast` above.
#[cfg(feature = "tiff")]
pub fn extract_exif_tags(data: &[u8]) -> String {
    extract_bare_ifd_tags_json(data)
}

/// Decode a TIFF file without eagerly computing min/max statistics.
///
/// The webview render path computes stats lazily when a non-gamma mode needs
/// them. Skipping eager stats saves a full pass over large float TIFFs during
/// the common gamma-mode initial load.
#[cfg(feature = "tiff")]
pub fn decode_tiff_fast(data: &[u8]) -> Result<TiffResult, DecodeError> {
    decode_tiff_impl(data, false, 0)
}

/// Decode an arbitrary zero-based TIFF page without eagerly computing stats.
#[cfg(feature = "tiff")]
pub fn decode_tiff_page_fast(data: &[u8], page_index: u32) -> Result<TiffResult, DecodeError> {
    decode_tiff_impl(data, false, page_index)
}

#[cfg(feature = "exr")]
pub fn decode_exr_fast(data: &[u8]) -> Result<ExrResult, DecodeError> {
    decode_exr_impl(data)
}

#[cfg(feature = "png")]
pub use formats::png::PngRgba8;

/// A PNG as 8-bit RGBA, identical to UPNG's `toRGBA8` for every PNG it
/// accepts (see the format module).
///
/// # Errors
///
/// Malformed PNGs, animated PNGs, and grayscale or interlaced images below
/// 8 bits.
#[cfg(feature = "png")]
pub fn decode_png_rgba8(data: &[u8]) -> Result<PngRgba8, DecodeError> {
    formats::png::decode_png_rgba8_impl(data)
}

#[cfg(feature = "png")]
pub fn decode_png16_fast(data: &[u8]) -> Result<PngResult, DecodeError> {
    decode_png16_impl(data)
}

#[cfg(feature = "hdr")]
pub fn decode_hdr_fast(data: &[u8]) -> Result<HdrResult, DecodeError> {
    decode_hdr_impl(data)
}

#[cfg(feature = "hdr")]
pub use formats::hdr::HdrScanlinePlan;

/// Where each scanline of an HDR file starts, for decoding scanline ranges in
/// parallel with `decode_hdr_rows`.
///
/// # Errors
///
/// The same header and RLE errors as `decode_hdr_fast`.
#[cfg(feature = "hdr")]
pub fn hdr_scanline_plan(data: &[u8]) -> Result<HdrScanlinePlan, DecodeError> {
    formats::hdr::hdr_scanline_plan(data)
}

/// Decode `rows` consecutive HDR scanlines (exactly their bytes) to RGB f32,
/// identical to the same rows of `decode_hdr_fast`.
///
/// # Errors
///
/// Malformed or truncated scanlines.
#[cfg(feature = "hdr")]
pub fn decode_hdr_rows(blob: &[u8], width: u32, rows: u32) -> Result<Vec<f32>, DecodeError> {
    formats::hdr::decode_hdr_rows(blob, width as usize, rows as usize)
}

#[cfg(feature = "psd")]
pub use formats::psd::{PsdCompositePlan, PsdRowLayout};

/// Where each row of an 8-bit RGB or grayscale Photoshop composite starts, for decoding
/// row ranges in parallel with `decode_psd_composite_rows`.
///
/// # Errors
///
/// Not an 8-bit RGB or grayscale PSD/PSB with a raw or `PackBits` composite,
/// or truncated.
#[cfg(feature = "psd")]
pub fn psd_composite_plan(data: &[u8]) -> Result<PsdCompositePlan, DecodeError> {
    formats::psd::psd_composite_plan(data)
}

/// Decode `rows` composite rows to RGBA, byte for byte what ag-psd produces.
/// `blob` holds the rows of each planned channel in turn, `counts` their
/// lengths in the same order.
///
/// # Errors
///
/// Counts that do not match the blob, or a row that does not fill the width.
#[cfg(feature = "psd")]
pub fn decode_psd_composite_rows(
    blob: &[u8],
    counts: &[u32],
    rows: u32,
    layout: &PsdRowLayout,
) -> Result<Vec<u8>, DecodeError> {
    formats::psd::decode_psd_composite_rows(blob, counts, rows as usize, layout)
}

/// Decode a Portable Float Map (PFM). `top_down` requests a vertical flip so
/// row 0 of the output is the PFM file's last (topmost, in image space) row —
/// the worker always passes `true` to match the existing TS parser's
/// `{ topDown: true }` call.
#[cfg(feature = "pfm")]
pub fn decode_pfm_fast(data: &[u8], top_down: bool) -> Result<DecodedArray, DecodeError> {
    decode_pfm_impl(data, top_down, true)
}

/// Initial-display variant for PFM's default gamma mode. Statistics remain
/// available through the regular entry point and are calculated lazily if the
/// user switches the visualization to auto-normalization.
#[cfg(feature = "pfm")]
pub fn decode_pfm_display_fast(data: &[u8], top_down: bool) -> Result<DecodedArray, DecodeError> {
    decode_pfm_impl(data, top_down, false)
}

/// Decode a NetPBM image (PBM/PGM/PPM, ASCII or binary).
#[cfg(feature = "netpbm")]
pub fn decode_ppm_fast(data: &[u8]) -> Result<DecodedArray, DecodeError> {
    decode_ppm_impl(data, true)
}

/// Initial-display variant for NetPBM's default gamma mode; see
/// [`decode_pfm_display_fast`].
#[cfg(feature = "netpbm")]
pub fn decode_ppm_display_fast(data: &[u8]) -> Result<DecodedArray, DecodeError> {
    decode_ppm_impl(data, false)
}

/// Owned-buffer display path used by wasm-bindgen. Binary 16-bit PGM/PPM can
/// byte-swap the transferred WASM input allocation in place, avoiding a
/// second 50-150 MiB Rust allocation. Other NetPBM variants use the regular
/// implementation.
#[cfg(feature = "netpbm")]
pub fn decode_ppm_display_owned(data: Vec<u8>) -> Result<DecodedArray, DecodeError> {
    formats::netpbm::decode_ppm_display_owned_impl(data)
}

/// Decode a NumPy `.npy` file or a `.npz` archive. Dispatches internally on
/// the ZIP local-file-header signature in the first 4 bytes, mirroring the
/// worker's existing `case 'npy':` dispatch.
#[cfg(feature = "npy")]
pub fn decode_npy_fast(data: &[u8]) -> Result<DecodedArray, DecodeError> {
    decode_npy_impl(data)
}

#[cfg(feature = "npy")]
pub fn decode_npy_display_fast(data: &[u8]) -> Result<DecodedArray, DecodeError> {
    decode_npy_display_impl(data)
}

/// Decode a FITS file's first primary/IMAGE HDU with at least two axes.
#[cfg(feature = "fits")]
pub fn decode_fits_fast(data: &[u8]) -> Result<DecodedArray, DecodeError> {
    Ok(decode_fits_impl(data)?.into())
}

/// Decode a classic NetCDF (CDF-1/CDF-2) file as either a regular raster or
/// an MPAS `nCells` polygon mesh. `options_json` is the JSON-serialized
/// `NetCdfDecodeOptions` (`{ variableName?, indices? }`).
#[cfg(feature = "netcdf")]
pub fn decode_netcdf_fast(data: &[u8], options_json: &str) -> Result<DecodedArray, DecodeError> {
    Ok(decode_netcdf_impl(data, options_json)?.into())
}

/// Decode one native (uncompressed) DICOM frame. `frame_index` selects a
/// frame from a multi-frame `NumberOfFrames` dataset (clamped to range).
/// Compressed (encapsulated) Pixel Data is rejected with the same error text
/// the TS parser uses, so `decode-worker.ts`'s existing JPEG-Baseline
/// fallback (TS frame extraction + the shared `decode_jpeg_fast`) keeps
/// working unchanged against this decoder.
/// Decode a standalone JPEG XR file (`.jxr`, `.wdp`, `.hdp`).
///
/// The same codestream decoder TIFF's compression 34934 uses; this entry point
/// exists because a bare JPEG XR file has no TIFF wrapper to describe it, so
/// the pixel format has to be read off the codestream itself.
#[cfg(feature = "jpegxr")]
pub fn decode_jpegxr_fast(data: &[u8]) -> Result<DecodedArray, DecodeError> {
    Ok(formats::jpegxr::decode_jpegxr_impl(data)?.into())
}

/// Decode a standalone JPEG 2000 file (`.jp2`, `.jpf`, `.jpx`, `.j2k`, `.j2c`,
/// `.jpc`).
///
/// The same codestream decoder TIFF's compression 34712 uses. It exists
/// separately because a bare JPEG 2000 file has no TIFF wrapper to describe
/// it, and because its precision has to be read off the codestream: a
/// Sentinel-2 band is 12 bits stored in 16, and normalizing it against the
/// storage width would render it at a sixteenth brightness.
#[cfg(feature = "jpeg2000")]
pub fn decode_jpeg2000_fast(data: &[u8]) -> Result<DecodedArray, DecodeError> {
    Ok(formats::jpeg2000::decode_jpeg2000_impl(data)?.into())
}

/// Standalone JPEG XL (`.jxl`). Built only into the separate `jxl-decoder`
/// WebAssembly module — see `formats::jxl` for why it is not part of
/// `all-formats`.
#[cfg(feature = "jxl")]
pub fn decode_jxl_fast(data: &[u8]) -> Result<DecodedArray, DecodeError> {
    Ok(formats::jxl::decode_jxl_impl(data)?.into())
}

#[cfg(feature = "dicom")]
pub fn decode_dicom_fast(data: &[u8], frame_index: u32) -> Result<DecodedArray, DecodeError> {
    Ok(decode_dicom_impl(data, frame_index)?.into())
}

/// Decode a Zeiss CZI plane. `options_json` is the JSON-serialized
/// `CziDecodeOptions` (`{ indices?: Record<string, number> }`) selecting the
/// Z/C/T/... coordinate to assemble; unspecified axes default to their first
/// coordinate. JPEG, LZW and Zstd subblocks decode in the core module; JPEG XR
/// uses the same lazy heavy-codec retry as TIFF and standalone `.jxr` files.
#[cfg(feature = "czi")]
pub fn decode_czi_fast(data: &[u8], options_json: &str) -> Result<DecodedArray, DecodeError> {
    Ok(decode_czi_impl(data, options_json)?.into())
}

/// Ranged CZI access, step 1: the directory and metadata positions, from
/// the file's first 512 bytes. See `czi_layout`.
#[cfg(feature = "czi")]
pub fn czi_header(head: &[u8]) -> Result<String, DecodeError> {
    czi_header_json(head)
}

/// Ranged CZI access, step 2: from the ZISRAWDIRECTORY and ZISRAWMETADATA
/// segments (each from its segment header; metadata may be empty), the plane
/// `options_json` selects: size, channels, numeric domain, stored pyramid
/// `factors` (1 first), `needsJpegXr` and the plane's `metadataJson`.
#[cfg(feature = "czi")]
pub fn czi_layout(
    directory: &[u8],
    metadata: &[u8],
    options_json: &str,
) -> Result<String, DecodeError> {
    czi_layout_json(directory, metadata, options_json)
}

/// Ranged CZI access, step 3: the subblock byte ranges a region needs.
/// `options_json` adds to the plane indices `factor` (output pixel spacing in
/// full-resolution pixels), `rect` (full-resolution, from the plane's
/// top-left; the whole plane when absent), `fileSize` and `boundaries`
/// (other known segment starts, e.g. directory and metadata).
#[cfg(feature = "czi")]
pub fn czi_region_plan(directory: &[u8], options_json: &str) -> Result<String, DecodeError> {
    czi_region_plan_json(directory, options_json)
}

/// Ranged CZI access, step 4: decode the planned region from the planned
/// ranges, concatenated in `blob` with each one's start in `offsets`.
#[cfg(feature = "czi")]
pub fn decode_czi_region(
    directory: &[u8],
    options_json: &str,
    blob: &[u8],
    offsets: &[u32],
) -> Result<DecodedArray, DecodeError> {
    Ok(decode_czi_region_impl(directory, options_json, blob, offsets)?.into())
}

/// Decode one plane of a Nikon ND2. `options_json` is the same
/// `{ indices?: Record<string, number> }` shape CZI uses, selecting the
/// T/P/Z/C coordinate. Only modern (chunk-based) uncompressed ND2 decodes;
/// legacy containers and Nikon's lossless/lossy modes are rejected by name.
#[cfg(feature = "nd2")]
pub fn decode_nd2_fast(data: &[u8], options_json: &str) -> Result<DecodedArray, DecodeError> {
    Ok(decode_nd2_impl(data, options_json)?.into())
}

/// Decode one plane of a Leica LIF. `options_json` extends the shared
/// `{ indices?: Record<string, number> }` shape with an `S` axis selecting
/// which image series in the file to read; `.lifext` sidecars are not needed.
#[cfg(feature = "lif")]
pub fn decode_lif_fast(data: &[u8], options_json: &str) -> Result<DecodedArray, DecodeError> {
    Ok(decode_lif_impl(data, options_json)?.into())
}

/// The pieces of a partially read file as a `SparseFile`: `blob` holds them
/// back to back, `lengths[i]` bytes each, read from file offset `offsets[i]`.
#[cfg(any(feature = "nd2", feature = "lif"))]
fn sparse_pieces<'a>(
    blob: &'a [u8],
    offsets: &[f64],
    lengths: &[u32],
    file_size: f64,
) -> Result<formats::scientific_common::SparseFile<'a>, DecodeError> {
    let as_usize = |value: f64, what: &str| -> Result<usize, DecodeError> {
        if value.is_finite() && value >= 0.0 && value <= usize::MAX as f64 && value.fract() == 0.0 {
            // Checked just above: a non-negative integer within usize.
            #[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)]
            Ok(value as usize)
        } else {
            Err(DecodeError::new(format!(
                "Ranged read: invalid {what} {value}"
            )))
        }
    };
    if offsets.len() != lengths.len() {
        return Err(DecodeError::new(
            "Ranged read: offsets and lengths disagree",
        ));
    }
    let mut pieces = Vec::with_capacity(offsets.len());
    let mut at = 0usize;
    for (&offset, &length) in offsets.iter().zip(lengths) {
        let length =
            usize::try_from(length).map_err(|_| DecodeError::new("Ranged read: piece too long"))?;
        let end = at
            .checked_add(length)
            .filter(|&end| end <= blob.len())
            .ok_or_else(|| DecodeError::new("Ranged read: pieces exceed the buffer"))?;
        pieces.push((as_usize(offset, "offset")?, &blob[at..end]));
        at = end;
    }
    Ok(formats::scientific_common::SparseFile::new(
        as_usize(file_size, "file size")?,
        pieces,
    ))
}

/// `decode_nd2_fast` on a partially read file (see `sparse_pieces`). A plane
/// needing bytes not supplied fails with `[need-range:OFFSET:LENGTH]`; the
/// page reads that range and retries (media/modules/ranged-source.ts).
#[cfg(feature = "nd2")]
pub fn decode_nd2_ranged(
    blob: &[u8],
    offsets: &[f64],
    lengths: &[u32],
    file_size: f64,
    options_json: &str,
) -> Result<DecodedArray, DecodeError> {
    let file = sparse_pieces(blob, offsets, lengths, file_size)?;
    Ok(decode_nd2_sparse(&file, options_json)?.into())
}

/// `decode_lif_fast` on a partially read file; see `decode_nd2_ranged`.
#[cfg(feature = "lif")]
pub fn decode_lif_ranged(
    blob: &[u8],
    offsets: &[f64],
    lengths: &[u32],
    file_size: f64,
    options_json: &str,
) -> Result<DecodedArray, DecodeError> {
    let file = sparse_pieces(blob, offsets, lengths, file_size)?;
    Ok(decode_lif_sparse(&file, options_json)?.into())
}

/// Decode a Becker & Hickl SDT TCSPC histogram image. `options_json` selects
/// the data block, visualization mode, and raw time bin.
#[cfg(feature = "sdt")]
pub fn decode_sdt_fast(data: &[u8], options_json: &str) -> Result<DecodedArray, DecodeError> {
    Ok(decode_sdt_impl(data, options_json)?.into())
}

// Canonical Rust names. The `*_fast` spellings above are retained because the
// WASM adapter's public JavaScript API has used them for years.
#[cfg(feature = "czi")]
pub use decode_czi_fast as decode_czi;
#[cfg(feature = "dicom")]
pub use decode_dicom_fast as decode_dicom;
#[cfg(feature = "exr")]
pub use decode_exr_fast as decode_exr;
#[cfg(feature = "lif")]
pub use decode_lif_fast as decode_lif;
#[cfg(feature = "nd2")]
pub use decode_nd2_fast as decode_nd2;
#[cfg(feature = "sdt")]
pub use decode_sdt_fast as decode_sdt;
#[cfg(feature = "exr")]
pub fn exr_zip_f32_plan(data: &[u8]) -> Result<Option<ExrZipPlan>, DecodeError> {
    formats::exr::zip_f32_plan(data)
}

#[cfg(feature = "exr")]
pub fn decode_exr_zip_f32_blocks(
    blob: &[u8],
    counts: &[u32],
    rows: &[u32],
    width: u32,
) -> Result<Vec<u8>, DecodeError> {
    formats::exr::decode_zip_f32_blocks(blob, counts, rows, width)
}

/// Rows of a multi-channel ZIP16 EXR (channel pixel types `kinds`), the
/// plan's `selection` interleaved as `decode_exr_fast` returns it, and their
/// display range.
///
/// # Errors
///
/// Malformed or truncated blocks, or a selection outside the channels.
#[cfg(feature = "exr")]
pub fn decode_exr_zip_f32_blocks_selected(
    blob: &[u8],
    counts: &[u32],
    rows: &[u32],
    width: u32,
    kinds: &[u32],
    selection: &[i32],
) -> Result<(Vec<f32>, f64, f64), DecodeError> {
    formats::exr::decode_zip_f32_blocks_selected(blob, counts, rows, width, kinds, selection)
}

/// `decode_exr_zip_f32_blocks` plus the finite min/max of the samples, the
/// same scan the strip workers used to run in JavaScript.
///
/// # Errors
///
/// As `decode_exr_zip_f32_blocks`.
#[cfg(feature = "exr")]
pub fn decode_exr_zip_f32_blocks_with_range(
    blob: &[u8],
    counts: &[u32],
    rows: &[u32],
    width: u32,
) -> Result<RawStripRange, DecodeError> {
    let data = decode_exr_zip_f32_blocks(blob, counts, rows, width)?;
    let range = Some(raw_range_f32_le(&data));
    Ok(RawStripRange { data, range })
}
#[cfg(feature = "fits")]
pub use decode_fits_fast as decode_fits;
#[cfg(feature = "hdr")]
pub use decode_hdr_fast as decode_hdr;
#[cfg(feature = "jpeg")]
pub use decode_jpeg_fast as decode_jpeg;
#[cfg(feature = "netcdf")]
pub use decode_netcdf_fast as decode_netcdf;
#[cfg(feature = "npy")]
pub use decode_npy_fast as decode_numpy;
#[cfg(feature = "pfm")]
pub use decode_pfm_fast as decode_pfm;
#[cfg(feature = "png")]
pub use decode_png16_fast as decode_png16;
#[cfg(feature = "netpbm")]
pub use decode_ppm_fast as decode_netpbm;

// ---------------------------------------------------------------------------
// Strip-parallel decoding of predictor-3 float TIFFs.
//
// The single-threaded path (`try_decode_float_predictor_strips`) already treats
// each strip as an independent unit of work. These two entry points expose that
// split so a caller can fan strips out across workers: `tiff_float_strip_plan`
// reports the layout once, then each worker calls `decode_tiff_float_strip_range`
// with ONLY the compressed bytes for its own strips. Total bytes moved across
// the worker boundary is therefore one file's worth, not one per worker.
// ---------------------------------------------------------------------------

/// Layout of a TIFF whose blocks can each be decoded on their own, or `None`
/// if the file is not that shape.
///
/// A "strip" in this API is a UNIT OF WORK: one strip of a stripped file, or
/// one whole tile ROW of a tiled one. Both are full-width bands of the image,
/// which is what lets a worker return rows the caller places at a single
/// offset. `offsets`/`counts` list every BLOCK — one per strip, or
/// `blocks_across` per tile row, in row-major order.
pub struct TiffFloatStripPlan {
    pub width: u32,
    pub height: u32,
    pub channels: u32,
    pub bits_per_sample: u32,
    pub compression: u32,
    /// 1 = none, 2 = horizontal, 3 = floating-point.
    pub predictor: u32,
    /// TIFF SampleFormat: 1 = uint, 2 = int, 3 = float.
    pub sample_format: u32,
    /// TIFF PlanarConfiguration: 1 = chunky, 2 = separate channel planes.
    pub planar_configuration: u32,
    /// TIFF Orientation tag (1-8).
    pub orientation: u32,
    pub photometric_interpretation: u32,
    pub little_endian: bool,
    /// Image rows covered by one unit: `RowsPerStrip`, or `TileLength`.
    pub rows_per_strip: u32,
    /// `TileWidth`/`TileLength`, both zero for a stripped file.
    pub tile_width: u32,
    pub tile_length: u32,
    /// Tiles per tile row; 1 for a stripped file.
    pub blocks_across: u32,
    /// Tag 50674's second value, for LERC blocks.
    pub lerc_additional_compression: u32,
    /// Byte offset of each block within the file.
    pub offsets: Vec<u64>,
    /// Compressed length of each block.
    pub counts: Vec<u64>,
    /// `JPEGTables` (tag 347) for compression 7; empty otherwise. Callers that
    /// slice blocks for workers complete each block with these.
    pub jpeg_tables: Vec<u8>,
}

#[cfg(feature = "tiff")]
pub fn tiff_float_strip_plan(data: &[u8]) -> Option<TiffFloatStripPlan> {
    formats::tiff::float_strip_plan_for(data).map(|plan| TiffFloatStripPlan {
        width: plan.width,
        height: plan.height,
        channels: plan.channels,
        bits_per_sample: plan.bits_per_sample,
        compression: plan.compression,
        predictor: plan.predictor,
        sample_format: plan.sample_format,
        planar_configuration: plan.planar_configuration,
        orientation: plan.orientation,
        photometric_interpretation: plan.photometric_interpretation,
        little_endian: plan.little_endian,
        rows_per_strip: plan.rows_per_strip,
        tile_width: plan.tile_width,
        tile_length: plan.tile_length,
        blocks_across: plan.blocks_across,
        lerc_additional_compression: plan.lerc_additional_compression,
        offsets: plan.offsets,
        counts: plan.counts,
        jpeg_tables: plan.jpeg_tables,
    })
}

/// Decode a contiguous run of strips.
///
/// `blob` is the concatenation of those strips' compressed bytes and `counts`
/// their individual lengths, so the caller slices the file once rather than
/// handing every worker the whole thing. `first_strip` locates the run so the
/// last strip's short row count is handled correctly.
///
/// Returns the decoded samples for exactly these strips, row-major, ready to be
/// copied into the assembled image at row `first_strip * rows_per_strip`.
#[cfg(feature = "tiff")]
pub fn decode_tiff_float_strip_range(
    blob: &[u8],
    counts: &[u32],
    first_strip: u32,
    plan: &TiffFloatStripPlan,
) -> Result<Vec<f32>, DecodeError> {
    let inner = inner_plan(plan);
    let raster = formats::tiff::strips::decode_unit_range(blob, counts, first_strip, &inner)?;
    let raster = if plan.photometric_interpretation == 5 {
        formats::tiff::convert_cmyk_u8_to_rgb(raster, plan.channels).0
    } else {
        raster
    };
    Ok(formats::tiff::strips::strip_bytes_to_f32(&raster, &inner))
}

/// The internal plan carries the geometry; the public one is the wire form.
#[cfg(feature = "tiff")]
fn inner_plan(plan: &TiffFloatStripPlan) -> formats::tiff::strips::FloatStripPlan {
    formats::tiff::strips::FloatStripPlan {
        width: plan.width,
        height: plan.height,
        channels: plan.channels,
        bits_per_sample: plan.bits_per_sample,
        compression: plan.compression,
        predictor: plan.predictor,
        sample_format: plan.sample_format,
        planar_configuration: plan.planar_configuration,
        orientation: plan.orientation,
        photometric_interpretation: plan.photometric_interpretation,
        little_endian: plan.little_endian,
        rows_per_strip: plan.rows_per_strip,
        tile_width: plan.tile_width,
        tile_length: plan.tile_length,
        blocks_across: plan.blocks_across,
        lerc_additional_compression: plan.lerc_additional_compression,
        // A range decode is told its blocks by `counts`; the plan's own block
        // table is only needed by the caller doing the slicing.
        offsets: Vec::new(),
        counts: Vec::new(),
        jpeg_tables: plan.jpeg_tables.clone(),
    }
}

/// Metadata accompanying a strip-parallel decode.
pub struct TiffStripMetadata {
    pub page_count: u32,
    pub photometric_interpretation: u32,
    pub all_tags_json: String,
    pub ome_xml: String,
    pub geo_json: String,
    pub page_directory_json: String,
}

#[cfg(feature = "tiff")]
pub fn tiff_strip_metadata(data: &[u8]) -> Result<TiffStripMetadata, DecodeError> {
    formats::tiff::strip_metadata_for(data).map(|m| TiffStripMetadata {
        page_count: m.page_count,
        photometric_interpretation: m.photometric_interpretation,
        all_tags_json: m.all_tags_json,
        ome_xml: m.ome_xml,
        geo_json: m.geo_json,
        page_directory_json: m.page_directory_json,
    })
}

/// Decode a strip range and return the samples as **native little-endian
/// bytes** at their source width, rather than converting to f32.
///
/// This exists because the caller's carrier type is chosen by bit depth and
/// sample format (8-bit unsigned -> Uint8Array, <=16-bit unsigned ->
/// Uint16Array, float32 -> Float32Array), and handing back f32 for integer
/// images forced a second full pass on the JavaScript side to rebuild the
/// right carrier — and, worse, disqualified the GPU's integer texture path.
/// Returning raw bytes lets the caller wrap them in a typed array with no
/// conversion at all.
///
/// Predictor 3 reassembles to big-endian by definition, and predictor 1/2 keep
/// the file's byte order, so both are normalised to little-endian here.
#[cfg(feature = "tiff")]
pub fn decode_tiff_strip_range_raw(
    blob: &[u8],
    counts: &[u32],
    first_strip: u32,
    plan: &TiffFloatStripPlan,
) -> Result<Vec<u8>, DecodeError> {
    let inner = inner_plan(plan);
    let mut raster = formats::tiff::strips::decode_unit_range(blob, counts, first_strip, &inner)?;

    let bytes_per_sample = (plan.bits_per_sample / 8) as usize;
    // Predictor 3 already yields little-endian samples.
    let big_endian = plan.predictor != 3 && !plan.little_endian;
    if big_endian && bytes_per_sample > 1 {
        for sample in raster.chunks_exact_mut(bytes_per_sample) {
            sample.reverse();
        }
    }
    if plan.photometric_interpretation == 5 {
        raster = formats::tiff::convert_cmyk_u8_to_rgb(raster, plan.channels).0;
    }
    Ok(raster)
}

/// `decode_tiff_strip_range_raw`, plus the range's sample min/max.
///
/// The strip workers used to scan every decoded sample in JavaScript for this,
/// at roughly 2 ns a sample: about a third of the decode itself on a large
/// float image. The scan has the same semantics here: every sample of every
/// channel, finite values only, `(inf, -inf)` when there are none. `None` for a
/// carrier the raw path does not produce, in which case the caller scans.
///
/// # Errors
///
/// As `decode_tiff_strip_range_raw`: a malformed or truncated strip range.
#[cfg(feature = "tiff")]
pub fn decode_tiff_strip_range_raw_with_range(
    blob: &[u8],
    counts: &[u32],
    first_strip: u32,
    plan: &TiffFloatStripPlan,
) -> Result<RawStripRange, DecodeError> {
    let data = decode_tiff_strip_range_raw(blob, counts, first_strip, plan)?;
    let range = match (plan.bits_per_sample, plan.sample_format) {
        (8, 1) => Some(raw_range_u8(&data)),
        (16, 1) => Some(raw_range_u16_le(&data)),
        (32, 3) => Some(raw_range_f32_le(&data)),
        _ => None,
    };
    Ok(RawStripRange { data, range })
}

/// A strip range's native little-endian sample bytes and their finite
/// `(min, max)`, or `None` for a carrier without a Rust-side scan.
#[cfg(any(feature = "tiff", feature = "exr"))]
pub struct RawStripRange {
    pub data: Vec<u8>,
    pub range: Option<(f64, f64)>,
}

/// Split interleaved samples of `bytes_per_sample` bytes into `channels`
/// planes, laid out plane after plane in one buffer.
///
/// The strip workers need per-channel planes as well as the interleaved band;
/// this is the same gather the JavaScript split did, at a fraction of its cost.
#[cfg(feature = "tiff")]
#[must_use]
pub fn split_sample_planes(
    interleaved: &[u8],
    channels: usize,
    bytes_per_sample: usize,
) -> Vec<u8> {
    let mut planes = vec![0u8; interleaved.len()];
    if channels < 2 || bytes_per_sample == 0 {
        planes.copy_from_slice(interleaved);
        return planes;
    }
    let pixel_bytes = channels * bytes_per_sample;
    let pixels = interleaved.len() / pixel_bytes;
    let plane_bytes = pixels * bytes_per_sample;
    macro_rules! split {
        ($n:expr) => {{
            for (channel, plane) in planes
                .chunks_exact_mut(plane_bytes)
                .enumerate()
                .take(channels)
            {
                let offset = channel * $n;
                for (dst, pixel) in plane
                    .chunks_exact_mut($n)
                    .zip(interleaved.chunks_exact(pixel_bytes))
                {
                    dst.copy_from_slice(&pixel[offset..offset + $n]);
                }
            }
        }};
    }
    match bytes_per_sample {
        1 => split!(1),
        2 => split!(2),
        4 => split!(4),
        8 => split!(8),
        _ => planes.copy_from_slice(interleaved),
    }
    planes
}

#[cfg(feature = "tiff")]
fn raw_range_u8(raster: &[u8]) -> (f64, f64) {
    match (raster.iter().min(), raster.iter().max()) {
        (Some(&min), Some(&max)) => (f64::from(min), f64::from(max)),
        _ => (f64::INFINITY, f64::NEG_INFINITY),
    }
}

#[cfg(feature = "tiff")]
fn raw_range_u16_le(raster: &[u8]) -> (f64, f64) {
    let mut min = u16::MAX;
    let mut max = u16::MIN;
    for pair in raster.chunks_exact(2) {
        let value = u16::from_le_bytes([pair[0], pair[1]]);
        min = min.min(value);
        max = max.max(value);
    }
    if raster.len() < 2 {
        return (f64::INFINITY, f64::NEG_INFINITY);
    }
    (f64::from(min), f64::from(max))
}

/// Finite min/max of little-endian f32 samples. Plain `<`/`>` comparisons skip
/// NaN and vectorize; an infinity that wins either side is corrected by a
/// second, finite-only pass, which only such (rare) images pay for.
#[cfg(any(feature = "tiff", feature = "exr"))]
fn raw_range_f32_le(raster: &[u8]) -> (f64, f64) {
    const LANES: usize = 8;
    let mut mins = [f32::INFINITY; LANES];
    let mut maxs = [f32::NEG_INFINITY; LANES];
    let mut blocks = raster.chunks_exact(4 * LANES);
    for block in &mut blocks {
        for lane in 0..LANES {
            let at = lane * 4;
            let value =
                f32::from_le_bytes([block[at], block[at + 1], block[at + 2], block[at + 3]]);
            if value < mins[lane] {
                mins[lane] = value;
            }
            if value > maxs[lane] {
                maxs[lane] = value;
            }
        }
    }
    let mut min = f32::INFINITY;
    let mut max = f32::NEG_INFINITY;
    for lane in 0..LANES {
        if mins[lane] < min {
            min = mins[lane];
        }
        if maxs[lane] > max {
            max = maxs[lane];
        }
    }
    for sample in blocks.remainder().chunks_exact(4) {
        let value = f32::from_le_bytes([sample[0], sample[1], sample[2], sample[3]]);
        if value < min {
            min = value;
        }
        if value > max {
            max = value;
        }
    }
    if min.is_infinite() || max.is_infinite() {
        min = f32::INFINITY;
        max = f32::NEG_INFINITY;
        for sample in raster.chunks_exact(4) {
            let value = f32::from_le_bytes([sample[0], sample[1], sample[2], sample[3]]);
            if value.is_finite() {
                if value < min {
                    min = value;
                }
                if value > max {
                    max = value;
                }
            }
        }
    }
    (f64::from(min), f64::from(max))
}

#[cfg(feature = "tiff")]
pub use formats::tiff::remote::{
    header_json as remote_tiff_header, ifd_json as remote_tiff_ifd,
    index_values as remote_tiff_index_values,
};

/// Decode SGI RGB (verbatim or RLE, 8/16-bit) to top-down interleaved samples.
#[cfg(feature = "sgi")]
pub fn decode_sgi_fast(data: &[u8]) -> Result<DecodedArray, DecodeError> {
    formats::sgi::decode(data)
}

/// Raw 8/16-bit PNG samples, without display color or gamma conversion.
#[cfg(feature = "png")]
pub fn decode_png_samples_fast(data: &[u8]) -> Result<PngResult, DecodeError> {
    formats::png::decode_png_samples_impl(data, true)
}

#[cfg(all(test, feature = "tiff"))]
mod raw_range_tests {
    use super::{raw_range_f32_le, raw_range_u16_le, raw_range_u8};

    /// The JavaScript scan the strip workers used: in order, `<`/`>` only,
    /// redone finite-only when NaN or an infinite extreme turned up.
    fn js_scan(values: &[f32]) -> (f64, f64) {
        let (mut min, mut max, mut non_finite) = (f32::INFINITY, f32::NEG_INFINITY, false);
        for &v in values {
            if v < min {
                min = v;
            }
            if v > max {
                max = v;
            }
            non_finite |= v.is_nan();
        }
        if non_finite || !min.is_finite() || !max.is_finite() {
            min = f32::INFINITY;
            max = f32::NEG_INFINITY;
            for &v in values.iter().filter(|v| v.is_finite()) {
                if v < min {
                    min = v;
                }
                if v > max {
                    max = v;
                }
            }
        }
        (f64::from(min), f64::from(max))
    }

    fn le(values: &[f32]) -> Vec<u8> {
        values.iter().flat_map(|v| v.to_le_bytes()).collect()
    }

    #[test]
    fn f32_range_matches_the_javascript_scan() {
        let cases: Vec<Vec<f32>> = vec![
            vec![],
            vec![f32::NAN],
            vec![f32::INFINITY, f32::NEG_INFINITY, f32::NAN],
            vec![3.0],
            (0..37u8).map(|i| f32::from(i) - 18.5).collect(),
            (0..64u8)
                .map(|i| if i % 5 == 0 { f32::NAN } else { f32::from(i) })
                .collect(),
            (0..65u8)
                .map(|i| {
                    if i == 40 {
                        f32::INFINITY
                    } else {
                        -f32::from(i)
                    }
                })
                .collect(),
            (0..19u8)
                .map(|i| {
                    if i == 3 {
                        f32::NEG_INFINITY
                    } else {
                        f32::from(i) * 0.25
                    }
                })
                .collect(),
            vec![f32::MAX, f32::MIN, f32::MIN_POSITIVE, -f32::MIN_POSITIVE],
        ];
        for case in cases {
            assert_eq!(raw_range_f32_le(&le(&case)), js_scan(&case), "{case:?}");
        }
    }

    #[test]
    fn integer_ranges_cover_every_sample() {
        assert_eq!(raw_range_u8(&[]), (f64::INFINITY, f64::NEG_INFINITY));
        assert_eq!(raw_range_u8(&[7, 255, 0, 9]), (0.0, 255.0));
        assert_eq!(raw_range_u16_le(&[]), (f64::INFINITY, f64::NEG_INFINITY));
        let words: Vec<u8> = [513u16, 2, 65535, 40]
            .iter()
            .flat_map(|v| v.to_le_bytes())
            .collect();
        assert_eq!(raw_range_u16_le(&words), (2.0, 65535.0));
    }
}
