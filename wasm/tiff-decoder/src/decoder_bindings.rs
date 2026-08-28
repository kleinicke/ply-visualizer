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
    pub fn width(&self) -> u32 { self.inner.width() }
    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 { self.inner.height() }
    #[wasm_bindgen(getter)]
    pub fn channels(&self) -> u32 { self.inner.channels() }
    #[wasm_bindgen(getter)]
    pub fn bits_per_sample(&self) -> u32 { self.inner.bits_per_sample() }
    #[wasm_bindgen(getter)]
    pub fn sample_format(&self) -> u32 { self.inner.sample_format() }
    #[wasm_bindgen(getter)]
    pub fn min_value(&self) -> f64 { self.inner.min_value() }
    #[wasm_bindgen(getter)]
    pub fn max_value(&self) -> f64 { self.inner.max_value() }
    #[wasm_bindgen(getter)]
    pub fn timing_metadata_ms(&self) -> f64 { self.inner.timing_metadata_ms() }
    #[wasm_bindgen(getter)]
    pub fn timing_decode_ms(&self) -> f64 { self.inner.timing_decode_ms() }
    #[wasm_bindgen(getter)]
    pub fn timing_convert_ms(&self) -> f64 { self.inner.timing_convert_ms() }
    #[wasm_bindgen(getter)]
    pub fn timing_stats_ms(&self) -> f64 { self.inner.timing_stats_ms() }
    #[wasm_bindgen(getter)]
    pub fn timing_pack_ms(&self) -> f64 { self.inner.timing_pack_ms() }
    #[wasm_bindgen(getter)]
    pub fn compression(&self) -> u32 { self.inner.compression() }
    #[wasm_bindgen(getter)]
    pub fn predictor(&self) -> u32 { self.inner.predictor() }
    #[wasm_bindgen(getter)]
    pub fn photometric_interpretation(&self) -> u32 { self.inner.photometric_interpretation() }
    #[wasm_bindgen(getter)]
    pub fn planar_configuration(&self) -> u32 { self.inner.planar_configuration() }
    #[wasm_bindgen(getter)]
    pub fn rows_per_strip(&self) -> u32 { self.inner.rows_per_strip() }
    #[wasm_bindgen(getter)]
    pub fn strip_count(&self) -> u32 { self.inner.strip_count() }
    #[wasm_bindgen(getter)]
    pub fn strip_byte_count_total(&self) -> f64 { self.inner.strip_byte_count_total() }
    #[wasm_bindgen(getter)]
    pub fn strip_byte_count_max(&self) -> f64 { self.inner.strip_byte_count_max() }
    #[wasm_bindgen(getter)]
    pub fn tile_width(&self) -> u32 { self.inner.tile_width() }
    #[wasm_bindgen(getter)]
    pub fn tile_length(&self) -> u32 { self.inner.tile_length() }
    #[wasm_bindgen(getter)]
    pub fn tile_count(&self) -> u32 { self.inner.tile_count() }
    #[wasm_bindgen(getter)]
    pub fn direct_decode(&self) -> bool { self.inner.direct_decode() }
    #[wasm_bindgen(getter)]
    pub fn ome_xml(&self) -> String { self.inner.ome_xml() }
    #[wasm_bindgen(getter)]
    pub fn all_tags_json(&self) -> String { self.inner.all_tags_json() }
    pub fn get_data_bytes(&self) -> Vec<u8> { self.inner.get_data_bytes() }
    pub fn get_data_as_f32(&self) -> Vec<f32> { self.inner.get_data_as_f32() }
    pub fn take_data_as_f32(&mut self) -> Vec<f32> { self.inner.take_data_as_f32() }
}

#[wasm_bindgen]
pub struct ExrResult {
    inner: core::ExrResult,
}

#[wasm_bindgen]
impl ExrResult {
    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 { self.inner.width() }
    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 { self.inner.height() }
    #[wasm_bindgen(getter)]
    pub fn channels(&self) -> u32 { self.inner.channels() }
    #[wasm_bindgen(getter)]
    pub fn channel_names_csv(&self) -> String { self.inner.channel_names_csv() }
    #[wasm_bindgen(getter)]
    pub fn displayed_channels_csv(&self) -> String { self.inner.displayed_channels_csv() }
    #[wasm_bindgen(getter)]
    pub fn format(&self) -> u32 { self.inner.format() }
    #[wasm_bindgen(getter)]
    pub fn data_type(&self) -> u32 { self.inner.data_type() }
    #[wasm_bindgen(getter)]
    pub fn timing_read_ms(&self) -> f64 { self.inner.timing_read_ms() }
    #[wasm_bindgen(getter)]
    pub fn timing_pack_ms(&self) -> f64 { self.inner.timing_pack_ms() }
    #[wasm_bindgen(getter)]
    pub fn timing_total_ms(&self) -> f64 { self.inner.timing_total_ms() }
    #[wasm_bindgen(getter)]
    pub fn data_min(&self) -> f64 { self.inner.data_min() }
    #[wasm_bindgen(getter)]
    pub fn data_max(&self) -> f64 { self.inner.data_max() }
    #[wasm_bindgen(getter)]
    pub fn all_tags_json(&self) -> String { self.inner.all_tags_json() }
    pub fn take_data_as_f32(&mut self) -> Vec<f32> { self.inner.take_data_as_f32() }
}

#[wasm_bindgen]
pub struct PngResult {
    inner: core::PngResult,
}

#[wasm_bindgen]
impl PngResult {
    #[wasm_bindgen(getter)]
    pub fn width(&self) -> u32 { self.inner.width() }
    #[wasm_bindgen(getter)]
    pub fn height(&self) -> u32 { self.inner.height() }
    #[wasm_bindgen(getter)]
    pub fn channels(&self) -> u32 { self.inner.channels() }
    #[wasm_bindgen(getter)]
    pub fn bit_depth(&self) -> u32 { self.inner.bit_depth() }
    #[wasm_bindgen(getter)]
    pub fn color_type(&self) -> u32 { self.inner.color_type() }
    #[wasm_bindgen(getter)]
    pub fn timing_read_info_ms(&self) -> f64 { self.inner.timing_read_info_ms() }
    #[wasm_bindgen(getter)]
    pub fn timing_decode_ms(&self) -> f64 { self.inner.timing_decode_ms() }
    #[wasm_bindgen(getter)]
    pub fn timing_convert_ms(&self) -> f64 { self.inner.timing_convert_ms() }
    #[wasm_bindgen(getter)]
    pub fn timing_total_ms(&self) -> f64 { self.inner.timing_total_ms() }
    pub fn take_data_as_u16(&mut self) -> Vec<u16> { self.inner.take_data_as_u16() }
}

#[wasm_bindgen]
pub fn decode_tiff(data: &[u8]) -> Result<TiffResult, JsValue> {
    prepare();
    core::decode_tiff(data).map(|inner| TiffResult { inner }).map_err(js_error)
}

#[wasm_bindgen]
pub fn decode_tiff_fast(data: &[u8]) -> Result<TiffResult, JsValue> {
    prepare();
    core::decode_tiff_fast(data).map(|inner| TiffResult { inner }).map_err(js_error)
}

#[wasm_bindgen]
pub fn decode_tiff_page(data: &[u8], page_index: u32) -> Result<TiffResult, JsValue> {
    prepare();
    core::decode_tiff_page(data, page_index).map(|inner| TiffResult { inner }).map_err(js_error)
}

#[wasm_bindgen]
pub fn decode_tiff_page_fast(data: &[u8], page_index: u32) -> Result<TiffResult, JsValue> {
    prepare();
    core::decode_tiff_page_fast(data, page_index).map(|inner| TiffResult { inner }).map_err(js_error)
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
    core::decode_exr_fast(data).map(|inner| ExrResult { inner }).map_err(js_error)
}

#[wasm_bindgen]
pub fn decode_png16_fast(data: &[u8]) -> Result<PngResult, JsValue> {
    prepare();
    core::decode_png16_fast(data).map(|inner| PngResult { inner }).map_err(js_error)
}
