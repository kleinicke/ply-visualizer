//! JavaScript-facing adapter for the vendored scientific image decoders.
//!
//! Byte parsing and decompression belong in `scientific-image-decoders`.
//! This module only preserves the WASM API consumed by the visualizer.

use scientific_image_decoders as core;
use wasm_bindgen::prelude::*;

fn prepare() {
    #[cfg(feature = "console_error_panic_hook")]
    console_error_panic_hook::set_once();
}

fn js_error(error: core::DecodeError) -> JsValue {
    JsValue::from_str(error.message())
}

#[wasm_bindgen]
pub struct TiffResult {
    inner: core::TiffResult,
}

#[wasm_bindgen]
impl TiffResult {
    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.inner.width()
    }
    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.inner.height()
    }
    #[wasm_bindgen(getter)]
    pub fn channels(&self) -> u32 {
        self.inner.channels()
    }
    #[wasm_bindgen(getter)]
    pub fn bits_per_sample(&self) -> u32 {
        self.inner.bits_per_sample()
    }
    #[wasm_bindgen(getter)]
    pub fn sample_format(&self) -> u32 {
        self.inner.sample_format()
    }
    #[wasm_bindgen(getter)]
    pub fn min_value(&self) -> f64 {
        self.inner.min_value()
    }
    #[wasm_bindgen(getter)]
    pub fn max_value(&self) -> f64 {
        self.inner.max_value()
    }
    #[wasm_bindgen(getter)]
    pub fn timing_metadata_ms(&self) -> f64 {
        self.inner.timing_metadata_ms()
    }
    #[wasm_bindgen(getter)]
    pub fn timing_decode_ms(&self) -> f64 {
        self.inner.timing_decode_ms()
    }
    #[wasm_bindgen(getter)]
    pub fn timing_convert_ms(&self) -> f64 {
        self.inner.timing_convert_ms()
    }
    #[wasm_bindgen(getter)]
    pub fn timing_stats_ms(&self) -> f64 {
        self.inner.timing_stats_ms()
    }
    #[wasm_bindgen(getter)]
    pub fn timing_pack_ms(&self) -> f64 {
        self.inner.timing_pack_ms()
    }
    #[wasm_bindgen(getter)]
    pub fn compression(&self) -> u32 {
        self.inner.compression()
    }
    #[wasm_bindgen(getter)]
    pub fn predictor(&self) -> u32 {
        self.inner.predictor()
    }
    #[wasm_bindgen(getter)]
    pub fn photometric_interpretation(&self) -> u32 {
        self.inner.photometric_interpretation()
    }
    #[wasm_bindgen(getter)]
    pub fn planar_configuration(&self) -> u32 {
        self.inner.planar_configuration()
    }
    #[wasm_bindgen(getter)]
    pub fn rows_per_strip(&self) -> u32 {
        self.inner.rows_per_strip()
    }
    #[wasm_bindgen(getter)]
    pub fn strip_count(&self) -> u32 {
        self.inner.strip_count()
    }
    #[wasm_bindgen(getter)]
    pub fn strip_byte_count_total(&self) -> f64 {
        self.inner.strip_byte_count_total()
    }
    #[wasm_bindgen(getter)]
    pub fn strip_byte_count_max(&self) -> f64 {
        self.inner.strip_byte_count_max()
    }
    #[wasm_bindgen(getter)]
    pub fn tile_width(&self) -> u32 {
        self.inner.tile_width()
    }
    #[wasm_bindgen(getter)]
    pub fn tile_length(&self) -> u32 {
        self.inner.tile_length()
    }
    #[wasm_bindgen(getter)]
    pub fn tile_count(&self) -> u32 {
        self.inner.tile_count()
    }
    #[wasm_bindgen(getter)]
    pub fn direct_decode(&self) -> bool {
        self.inner.direct_decode()
    }
    #[wasm_bindgen(getter)]
    pub fn ome_xml(&self) -> String {
        self.inner.ome_xml()
    }
    #[wasm_bindgen(getter)]
    pub fn all_tags_json(&self) -> String {
        self.inner.all_tags_json()
    }
    pub fn get_data_bytes(&self) -> Vec<u8> {
        self.inner.get_data_bytes()
    }
    pub fn get_data_as_f32(&self) -> Vec<f32> {
        self.inner.get_data_as_f32()
    }
    pub fn take_data_as_f32(&mut self) -> Vec<f32> {
        self.inner.take_data_as_f32()
    }
}

#[wasm_bindgen]
pub struct ExrResult {
    inner: core::ExrResult,
}

#[wasm_bindgen]
impl ExrResult {
    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.inner.width()
    }
    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.inner.height()
    }
    #[wasm_bindgen(getter)]
    pub fn channels(&self) -> u32 {
        self.inner.channels()
    }
    #[wasm_bindgen(getter)]
    pub fn channel_names_csv(&self) -> String {
        self.inner.channel_names_csv()
    }
    #[wasm_bindgen(getter)]
    pub fn displayed_channels_csv(&self) -> String {
        self.inner.displayed_channels_csv()
    }
    #[wasm_bindgen(getter)]
    pub fn format(&self) -> u32 {
        self.inner.format()
    }
    #[wasm_bindgen(getter)]
    pub fn data_type(&self) -> u32 {
        self.inner.data_type()
    }
    #[wasm_bindgen(getter)]
    pub fn timing_read_ms(&self) -> f64 {
        self.inner.timing_read_ms()
    }
    #[wasm_bindgen(getter)]
    pub fn timing_pack_ms(&self) -> f64 {
        self.inner.timing_pack_ms()
    }
    #[wasm_bindgen(getter)]
    pub fn timing_total_ms(&self) -> f64 {
        self.inner.timing_total_ms()
    }
    #[wasm_bindgen(getter)]
    pub fn data_min(&self) -> f64 {
        self.inner.data_min()
    }
    #[wasm_bindgen(getter)]
    pub fn data_max(&self) -> f64 {
        self.inner.data_max()
    }
    #[wasm_bindgen(getter)]
    pub fn all_tags_json(&self) -> String {
        self.inner.all_tags_json()
    }
    pub fn take_data_as_f32(&mut self) -> Vec<f32> {
        self.inner.take_data_as_f32()
    }
}

#[wasm_bindgen]
pub struct PngResult {
    inner: core::PngResult,
}

#[wasm_bindgen]
impl PngResult {
    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.inner.width()
    }
    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.inner.height()
    }
    #[wasm_bindgen(getter)]
    pub fn channels(&self) -> u32 {
        self.inner.channels()
    }
    #[wasm_bindgen(getter)]
    pub fn bit_depth(&self) -> u32 {
        self.inner.bit_depth()
    }
    #[wasm_bindgen(getter)]
    pub fn color_type(&self) -> u32 {
        self.inner.color_type()
    }
    #[wasm_bindgen(getter)]
    pub fn timing_read_info_ms(&self) -> f64 {
        self.inner.timing_read_info_ms()
    }
    #[wasm_bindgen(getter)]
    pub fn timing_decode_ms(&self) -> f64 {
        self.inner.timing_decode_ms()
    }
    #[wasm_bindgen(getter)]
    pub fn timing_convert_ms(&self) -> f64 {
        self.inner.timing_convert_ms()
    }
    #[wasm_bindgen(getter)]
    pub fn timing_total_ms(&self) -> f64 {
        self.inner.timing_total_ms()
    }
    pub fn take_data_as_u16(&mut self) -> Vec<u16> {
        self.inner.take_data_as_u16()
    }
}

#[wasm_bindgen]
pub fn decode_tiff(data: &[u8]) -> Result<TiffResult, JsValue> {
    prepare();
    core::decode_tiff(data)
        .map(|inner| TiffResult { inner })
        .map_err(js_error)
}

#[wasm_bindgen]
pub fn decode_tiff_fast(data: &[u8]) -> Result<TiffResult, JsValue> {
    prepare();
    core::decode_tiff_fast(data)
        .map(|inner| TiffResult { inner })
        .map_err(js_error)
}

#[wasm_bindgen]
pub fn decode_tiff_page(data: &[u8], page_index: u32) -> Result<TiffResult, JsValue> {
    prepare();
    core::decode_tiff_page(data, page_index)
        .map(|inner| TiffResult { inner })
        .map_err(js_error)
}

#[wasm_bindgen]
pub fn decode_tiff_page_fast(data: &[u8], page_index: u32) -> Result<TiffResult, JsValue> {
    prepare();
    core::decode_tiff_page_fast(data, page_index)
        .map(|inner| TiffResult { inner })
        .map_err(js_error)
}

#[wasm_bindgen]
pub fn tiff_page_count(data: &[u8]) -> Result<u32, JsValue> {
    prepare();
    core::tiff_page_count(data).map_err(js_error)
}

#[wasm_bindgen]
pub fn extract_exif_tags(data: &[u8]) -> String {
    core::extract_exif_tags(data)
}

#[wasm_bindgen]
pub fn decode_exr_fast(data: &[u8]) -> Result<ExrResult, JsValue> {
    prepare();
    core::decode_exr_fast(data)
        .map(|inner| ExrResult { inner })
        .map_err(js_error)
}

#[wasm_bindgen]
pub fn decode_png16_fast(data: &[u8]) -> Result<PngResult, JsValue> {
    prepare();
    core::decode_png16_fast(data)
        .map(|inner| PngResult { inner })
        .map_err(js_error)
}

#[wasm_bindgen]
pub fn decode_png_samples_fast(data: &[u8]) -> Result<PngResult, JsValue> {
    prepare();
    core::decode_png_samples_fast(data)
        .map(|inner| PngResult { inner })
        .map_err(js_error)
}

/// A stripped TIFF's block table and layout, for decoding it in row ranges on
/// several workers (`decode_tiff_strip_range`). Undefined for files the
/// range decoder does not cover; those take `decode_tiff_fast`.
#[wasm_bindgen]
pub struct TiffStripPlan {
    inner: core::TiffFloatStripPlan,
}

/// Layout numbers in the order `TiffStripPlan::fields` writes them.
const PLAN_FIELDS: usize = 16;

#[wasm_bindgen]
impl TiffStripPlan {
    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.inner.width
    }
    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.inner.height
    }
    #[wasm_bindgen(getter)]
    pub fn channels(&self) -> u32 {
        self.inner.channels
    }
    #[wasm_bindgen(getter)]
    pub fn bits_per_sample(&self) -> u32 {
        self.inner.bits_per_sample
    }
    #[wasm_bindgen(getter)]
    pub fn sample_format(&self) -> u32 {
        self.inner.sample_format
    }
    #[wasm_bindgen(getter)]
    pub fn compression(&self) -> u32 {
        self.inner.compression
    }
    #[wasm_bindgen(getter)]
    pub fn predictor(&self) -> u32 {
        self.inner.predictor
    }
    #[wasm_bindgen(getter)]
    pub fn rows_per_strip(&self) -> u32 {
        self.inner.rows_per_strip
    }
    /// True for a plain chunky, top-left, non-CMYK strip layout: the one shape
    /// whose ranges simply stack into the image.
    #[wasm_bindgen(getter)]
    pub fn stackable(&self) -> bool {
        let plan = &self.inner;
        plan.tile_width == 0
            && plan.planar_configuration == 1
            && plan.orientation == 1
            && plan.photometric_interpretation != 5
            && plan.jpeg_tables.is_empty()
            && plan.offsets.len() == plan.counts.len()
    }
    /// Byte offset of each strip within the file.
    pub fn offsets(&self) -> Vec<f64> {
        #[allow(clippy::cast_precision_loss)] // file offsets stay far below 2^53
        self.inner
            .offsets
            .iter()
            .map(|&offset| offset as f64)
            .collect()
    }
    /// Compressed length of each strip.
    pub fn counts(&self) -> Vec<f64> {
        #[allow(clippy::cast_precision_loss)] // strip lengths stay far below 2^53
        self.inner
            .counts
            .iter()
            .map(|&count| count as f64)
            .collect()
    }
    /// The layout as numbers, to rebuild the plan in another worker.
    pub fn fields(&self) -> Vec<f64> {
        let plan = &self.inner;
        vec![
            f64::from(plan.width),
            f64::from(plan.height),
            f64::from(plan.channels),
            f64::from(plan.bits_per_sample),
            f64::from(plan.compression),
            f64::from(plan.predictor),
            f64::from(plan.sample_format),
            f64::from(plan.planar_configuration),
            f64::from(plan.orientation),
            f64::from(plan.photometric_interpretation),
            f64::from(u8::from(plan.little_endian)),
            f64::from(plan.rows_per_strip),
            f64::from(plan.tile_width),
            f64::from(plan.tile_length),
            f64::from(plan.blocks_across),
            f64::from(plan.lerc_additional_compression),
        ]
    }
}

#[wasm_bindgen]
pub fn tiff_strip_plan(data: &[u8]) -> Option<TiffStripPlan> {
    prepare();
    core::tiff_float_strip_plan(data).map(|inner| TiffStripPlan { inner })
}

/// Decode strips `first_strip..first_strip + counts.len()` from their
/// concatenated compressed bytes, as the f32 samples `decode_tiff_fast`
/// produces for those rows. `fields` comes from `TiffStripPlan::fields`.
#[wasm_bindgen]
#[allow(clippy::cast_possible_truncation, clippy::cast_sign_loss)] // fields are u32 values sent as f64
pub fn decode_tiff_strip_range(
    blob: &[u8],
    counts: &[u32],
    first_strip: u32,
    fields: &[f64],
) -> Result<Vec<f32>, JsValue> {
    prepare();
    if fields.len() != PLAN_FIELDS {
        return Err(JsValue::from_str(
            "TIFF strip plan has the wrong number of fields",
        ));
    }
    let field = |index: usize| fields[index] as u32;
    let plan = core::TiffFloatStripPlan {
        width: field(0),
        height: field(1),
        channels: field(2),
        bits_per_sample: field(3),
        compression: field(4),
        predictor: field(5),
        sample_format: field(6),
        planar_configuration: field(7),
        orientation: field(8),
        photometric_interpretation: field(9),
        little_endian: field(10) != 0,
        rows_per_strip: field(11),
        tile_width: field(12),
        tile_length: field(13),
        blocks_across: field(14),
        lerc_additional_compression: field(15),
        offsets: Vec::new(),
        counts: Vec::new(),
        jpeg_tables: Vec::new(),
    };
    core::decode_tiff_float_strip_range(blob, counts, first_strip, &plan).map_err(js_error)
}

/// A ZIP16 scanline EXR's compressed blocks and channel layout, for decoding
/// it in row ranges on several workers (`decode_exr_zip_blocks`). Ported from
/// the image viewer's adapter; undefined for every other EXR layout.
#[wasm_bindgen]
pub struct ExrZipPlanJs {
    inner: core::ExrZipPlan,
}

#[wasm_bindgen]
impl ExrZipPlanJs {
    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 {
        self.inner.width
    }
    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 {
        self.inner.height
    }
    #[wasm_bindgen(getter)]
    pub fn data_y(&self) -> i32 {
        self.inner.data_y
    }
    /// Each channel's pixel type: 0 u32, 1 half, 2 float.
    #[wasm_bindgen(getter)]
    pub fn channel_kinds(&self) -> Vec<u32> {
        self.inner.channel_kinds.clone()
    }
    /// The displayed channels as indices into the file's channels (-1: absent).
    #[wasm_bindgen(getter)]
    pub fn selection(&self) -> Vec<i32> {
        self.inner.selection.clone()
    }
    #[wasm_bindgen(getter)]
    pub fn displayed_names(&self) -> Vec<String> {
        self.inner.displayed_names.clone()
    }
    #[wasm_bindgen(getter)]
    pub fn counts(&self) -> Vec<u32> {
        self.inner.counts.clone()
    }
    #[wasm_bindgen(getter)]
    pub fn y_coordinates(&self) -> Vec<i32> {
        self.inner.y_coordinates.clone()
    }
    /// Move the compressed blocks out, back to back in file order.
    pub fn take_compressed(&mut self) -> Vec<u8> {
        std::mem::take(&mut self.inner.compressed)
    }
}

/// # Errors
///
/// A malformed EXR header.
#[wasm_bindgen]
pub fn exr_zip_plan(data: &[u8]) -> Result<Option<ExrZipPlanJs>, JsValue> {
    prepare();
    core::exr_zip_f32_plan(data)
        .map(|plan| plan.map(|inner| ExrZipPlanJs { inner }))
        .map_err(js_error)
}

/// Blocks `counts` (with `rows` scanlines each) of a ZIP16 EXR, as the
/// interleaved displayed channels `decode_exr_fast` returns for those rows.
///
/// # Errors
///
/// Malformed or truncated blocks, or a selection outside the channels.
#[wasm_bindgen]
pub fn decode_exr_zip_blocks(
    blob: &[u8],
    counts: &[u32],
    rows: &[u32],
    width: u32,
    kinds: &[u32],
    selection: &[i32],
) -> Result<Vec<f32>, JsValue> {
    prepare();
    core::decode_exr_zip_f32_blocks_selected(blob, counts, rows, width, kinds, selection)
        .map(|(data, _, _)| data)
        .map_err(js_error)
}
