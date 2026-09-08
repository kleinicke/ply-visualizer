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
pub use pipeline::stats;

#[cfg(feature = "czi")]
use formats::czi::decode_czi_impl;
#[cfg(feature = "dicom")]
use formats::dicom::decode_dicom_impl;
#[cfg(feature = "exr")]
use formats::exr::decode_exr_impl;
#[cfg(feature = "fits")]
use formats::fits::decode_fits_impl;
#[cfg(feature = "hdr")]
use formats::hdr::decode_hdr_impl;
#[cfg(feature = "lif")]
use formats::lif::decode_lif_impl;
#[cfg(feature = "nd2")]
use formats::nd2::decode_nd2_impl;
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
            return Err(DecodeError::new(&format!(
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
    #[cfg(any(
        feature = "pfm",
        feature = "netpbm",
        feature = "npy",
        feature = "fits",
        feature = "netcdf",
        feature = "dicom",
        feature = "czi",
        feature = "nd2",
        feature = "lif"
    ))]
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
    feature = "fits",
    feature = "netcdf",
    feature = "dicom",
    feature = "czi",
    feature = "nd2",
    feature = "lif"
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
/// - `test/goldens/external/dicom-fixture-external-0002-dcm.json` was captured
///   before simd128 was enabled and so fails against current builds. Re-capturing
///   it is a decision to accept IDCT variance, not a routine refresh.
#[cfg(feature = "jpeg")]
pub fn decode_jpeg_fast(data: &[u8]) -> Result<JpegResult, DecodeError> {
    use zune_jpeg::JpegDecoder;

    let mut decoder = JpegDecoder::new(Cursor::new(data));
    let pixels = decoder
        .decode()
        .map_err(|e| DecodeError::new(&format!("JPEG decode failed: {:?}", e)))?;
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
        .map_err(|e| DecodeError::new(&format!("Failed to create decoder: {}", e)))?;
    let mut count = 1u32;
    while decoder.more_images() {
        decoder
            .next_image()
            .map_err(|e| DecodeError::new(&format!("Failed to enumerate TIFF pages: {}", e)))?;
        count = count.saturating_add(1);
    }
    Ok(count)
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
pub fn decode_png16_fast(data: &[u8]) -> Result<PngResult, DecodeError> {
    decode_png16_impl(data)
}

#[cfg(feature = "hdr")]
pub fn decode_hdr_fast(data: &[u8]) -> Result<HdrResult, DecodeError> {
    decode_hdr_impl(data)
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
#[cfg(feature = "dicom")]
pub fn decode_dicom_fast(data: &[u8], frame_index: u32) -> Result<DecodedArray, DecodeError> {
    Ok(decode_dicom_impl(data, frame_index)?.into())
}

/// Decode a Zeiss CZI plane. `options_json` is the JSON-serialized
/// `CziDecodeOptions` (`{ indices?: Record<string, number> }`) selecting the
/// Z/C/T/... coordinate to assemble; unspecified axes default to their first
/// coordinate. Compressed subblocks (JPEG/LZW/JPEG XR/Zstd) are rejected —
/// only uncompressed subblocks decode.
#[cfg(feature = "czi")]
pub fn decode_czi_fast(data: &[u8], options_json: &str) -> Result<DecodedArray, DecodeError> {
    Ok(decode_czi_impl(data, options_json)?.into())
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

// Canonical Rust names. The `*_fast` spellings above are retained because the
// WASM adapter's public JavaScript API has used them for years.
#[cfg(feature = "czi")]
pub use decode_czi_fast as decode_czi;
#[cfg(feature = "nd2")]
pub use decode_nd2_fast as decode_nd2;
#[cfg(feature = "lif")]
pub use decode_lif_fast as decode_lif;
#[cfg(feature = "dicom")]
pub use decode_dicom_fast as decode_dicom;
#[cfg(feature = "exr")]
pub use decode_exr_fast as decode_exr;
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

/// Layout of a predictor-3 float TIFF, or `None` if the file is not that shape.
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
    pub little_endian: bool,
    pub rows_per_strip: u32,
    /// Byte offset of each strip within the file.
    pub offsets: Vec<u64>,
    /// Compressed length of each strip.
    pub counts: Vec<u64>,
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
        little_endian: plan.little_endian,
        rows_per_strip: plan.rows_per_strip,
        offsets: plan.offsets,
        counts: plan.counts,
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
    let inner = formats::tiff::strips::FloatStripPlan {
        width: plan.width,
        height: plan.height,
        channels: plan.channels,
        bits_per_sample: plan.bits_per_sample,
        compression: plan.compression,
        predictor: plan.predictor,
        sample_format: plan.sample_format,
        little_endian: plan.little_endian,
        rows_per_strip: plan.rows_per_strip,
        offsets: Vec::new(),
        counts: Vec::new(),
    };
    let row_bytes = inner.row_bytes();
    let first = first_strip as usize;

    let mut rows_total = 0usize;
    for index in 0..counts.len() {
        rows_total += inner.rows_in(first + index);
    }
    let mut raster = vec![0u8; rows_total * row_bytes];

    let mut in_pos = 0usize;
    let mut out_pos = 0usize;
    for (index, &count) in counts.iter().enumerate() {
        let rows = inner.rows_in(first + index);
        if rows == 0 {
            break;
        }
        let end = in_pos
            .checked_add(count as usize)
            .filter(|end| *end <= blob.len())
            .ok_or_else(|| DecodeError::new("Strip range: compressed blob is shorter than its counts"))?;
        formats::tiff::strips::decode_float_predictor_strip(
            &blob[in_pos..end],
            &inner,
            rows,
            &mut raster[out_pos..out_pos + rows * row_bytes],
        )?;
        in_pos = end;
        out_pos += rows * row_bytes;
    }

    Ok(formats::tiff::strips::strip_bytes_to_f32(
        &raster[..out_pos],
        &inner,
    ))
}

/// Metadata accompanying a strip-parallel decode.
pub struct TiffStripMetadata {
    pub page_count: u32,
    pub photometric_interpretation: u32,
    pub all_tags_json: String,
    pub ome_xml: String,
}

#[cfg(feature = "tiff")]
pub fn tiff_strip_metadata(data: &[u8]) -> Result<TiffStripMetadata, DecodeError> {
    formats::tiff::strip_metadata_for(data).map(|m| TiffStripMetadata {
        page_count: m.page_count,
        photometric_interpretation: m.photometric_interpretation,
        all_tags_json: m.all_tags_json,
        ome_xml: m.ome_xml,
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
    let inner = formats::tiff::strips::FloatStripPlan {
        width: plan.width,
        height: plan.height,
        channels: plan.channels,
        bits_per_sample: plan.bits_per_sample,
        compression: plan.compression,
        predictor: plan.predictor,
        sample_format: plan.sample_format,
        little_endian: plan.little_endian,
        rows_per_strip: plan.rows_per_strip,
        offsets: Vec::new(),
        counts: Vec::new(),
    };
    let row_bytes = inner.row_bytes();
    let first = first_strip as usize;

    let mut rows_total = 0usize;
    for index in 0..counts.len() {
        rows_total += inner.rows_in(first + index);
    }
    let mut raster = vec![0u8; rows_total * row_bytes];

    let mut in_pos = 0usize;
    let mut out_pos = 0usize;
    for (index, &count) in counts.iter().enumerate() {
        let rows = inner.rows_in(first + index);
        if rows == 0 {
            break;
        }
        let end = in_pos
            .checked_add(count as usize)
            .filter(|end| *end <= blob.len())
            .ok_or_else(|| {
                DecodeError::new("Strip range: compressed blob is shorter than its counts")
            })?;
        formats::tiff::strips::decode_float_predictor_strip(
            &blob[in_pos..end],
            &inner,
            rows,
            &mut raster[out_pos..out_pos + rows * row_bytes],
        )?;
        in_pos = end;
        out_pos += rows * row_bytes;
    }
    raster.truncate(out_pos);

    let bytes_per_sample = (plan.bits_per_sample / 8) as usize;
    let big_endian = plan.predictor == 3 || !plan.little_endian;
    if big_endian && bytes_per_sample > 1 {
        for sample in raster.chunks_exact_mut(bytes_per_sample) {
            sample.reverse();
        }
    }
    Ok(raster)
}


/// Raw 8/16-bit PNG samples, without display color or gamma conversion.
#[cfg(feature = "png")]
pub fn decode_png_samples_fast(data: &[u8]) -> Result<PngResult, DecodeError> {
    formats::png::decode_png_samples_impl(data, true)
}
