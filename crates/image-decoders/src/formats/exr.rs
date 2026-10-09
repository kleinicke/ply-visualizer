use crate::formats::metadata::push_generic_attr_row;
use crate::DecodeError;
use crate::ExrResult;
use exr::prelude::FlatSamples;
use std::io::Cursor;
use std::mem;

/// Dump every EXR header attribute (image + layer) as JSON, generically:
/// each named `Option<T>` field on `ImageAttributes`/`LayerAttributes` plus
/// the crate's own catch-all `other` maps for custom/vendor attributes, so
/// nothing an EXR file carries is left out.
pub(crate) fn extract_exr_tags_json(
    image_attrs: &exr::meta::header::ImageAttributes,
    layer_attrs: &exr::meta::header::LayerAttributes,
) -> String {
    let mut out = Vec::new();
    const GROUP: &str = "EXR";

    macro_rules! opt_field {
        ($field:expr, $name:expr) => {
            if let Some(v) = &$field {
                push_generic_attr_row(&mut out, GROUP, $name, format!("{:?}", v));
            }
        };
    }

    push_generic_attr_row(
        &mut out,
        GROUP,
        "displayWindow",
        format!("{:?}", image_attrs.display_window),
    );
    push_generic_attr_row(
        &mut out,
        GROUP,
        "pixelAspect",
        format!("{}", image_attrs.pixel_aspect),
    );
    opt_field!(image_attrs.chromaticities, "chromaticities");
    opt_field!(image_attrs.time_code, "timeCode");
    for (key, value) in image_attrs.other.iter() {
        push_generic_attr_row(&mut out, GROUP, &key.to_string(), format!("{:?}", value));
    }

    opt_field!(layer_attrs.layer_name, "layerName");
    push_generic_attr_row(
        &mut out,
        GROUP,
        "layerPosition",
        format!("{:?}", layer_attrs.layer_position),
    );
    push_generic_attr_row(
        &mut out,
        GROUP,
        "screenWindowCenter",
        format!("{:?}", layer_attrs.screen_window_center),
    );
    push_generic_attr_row(
        &mut out,
        GROUP,
        "screenWindowWidth",
        format!("{}", layer_attrs.screen_window_width),
    );
    opt_field!(layer_attrs.white_luminance, "whiteLuminance");
    opt_field!(layer_attrs.adopted_neutral, "adoptedNeutral");
    opt_field!(
        layer_attrs.rendering_transform_name,
        "renderingTransformName"
    );
    opt_field!(
        layer_attrs.look_modification_transform_name,
        "lookModificationTransformName"
    );
    opt_field!(layer_attrs.horizontal_density, "horizontalDensity");
    opt_field!(layer_attrs.owner, "owner");
    opt_field!(layer_attrs.comments, "comments");
    opt_field!(layer_attrs.capture_date, "captureDate");
    opt_field!(layer_attrs.utc_offset, "utcOffset");
    opt_field!(layer_attrs.longitude, "longitude");
    opt_field!(layer_attrs.latitude, "latitude");
    opt_field!(layer_attrs.altitude, "altitude");
    opt_field!(layer_attrs.focus, "focus");
    opt_field!(layer_attrs.exposure, "exposure");
    opt_field!(layer_attrs.aperture, "aperture");
    opt_field!(layer_attrs.iso_speed, "isoSpeed");
    opt_field!(layer_attrs.environment_map, "environmentMap");
    opt_field!(layer_attrs.film_key_code, "filmKeyCode");
    opt_field!(layer_attrs.wrap_mode_name, "wrapModeName");
    opt_field!(layer_attrs.frames_per_second, "framesPerSecond");
    opt_field!(layer_attrs.multi_view_names, "multiViewNames");
    opt_field!(layer_attrs.world_to_camera, "worldToCamera");
    opt_field!(
        layer_attrs.world_to_normalized_device,
        "worldToNormalizedDevice"
    );
    opt_field!(layer_attrs.deep_image_state, "deepImageState");
    opt_field!(layer_attrs.original_data_window, "originalDataWindow");
    opt_field!(layer_attrs.view_name, "viewName");
    opt_field!(layer_attrs.software_name, "softwareName");
    opt_field!(layer_attrs.near_clip_plane, "nearClipPlane");
    opt_field!(layer_attrs.far_clip_plane, "farClipPlane");
    opt_field!(
        layer_attrs.horizontal_field_of_view,
        "horizontalFieldOfView"
    );
    opt_field!(layer_attrs.vertical_field_of_view, "verticalFieldOfView");
    for (key, value) in layer_attrs.other.iter() {
        push_generic_attr_row(&mut out, GROUP, &key.to_string(), format!("{:?}", value));
    }

    format!("[{}]", out.join(","))
}

/// Compressed-block plan for the common scientific EXR shape that can be
/// decoded by the webview's shared WASM worker pool in parallel.
///
/// Keep this deliberately narrow. The ordinary `exr` crate decoder remains
/// the compatibility path for multipart, tiled, deep, multi-channel, half,
/// uint, subsampled, and non-ZIP16 images.
pub(crate) fn zip_f32_plan(data: &[u8]) -> Result<Option<crate::ExrZipPlan>, DecodeError> {
    use exr::block::chunk::{CompressedBlock, CompressedScanLineBlock};
    use exr::meta::attribute::{LineOrder, SampleType};
    use exr::prelude::Compression;

    let reader = exr::block::read(Cursor::new(data), false)
        .map_err(|e| DecodeError::new(format!("Failed to read EXR header: {e}")))?;
    let metadata = reader.meta_data();
    if metadata.headers.len() != 1 {
        return Ok(None);
    }
    let header = &metadata.headers[0];
    if header.deep
        || metadata.requirements.is_single_layer_and_tiled
        || header.compression != Compression::ZIP16
        || header.line_order != LineOrder::Increasing
        || header.channels.list.is_empty()
    {
        return Ok(None);
    }
    // Every channel, displayed or not, must be full resolution: the blocks are
    // then rows of `width` samples per channel, one channel after another.
    if header
        .channels
        .list
        .iter()
        .any(|channel| channel.sampling.0 != 1 || channel.sampling.1 != 1)
    {
        return Ok(None);
    }
    let channel_kinds: Vec<u32> = header
        .channels
        .list
        .iter()
        .map(|channel| match channel.sample_type {
            SampleType::U32 => EXR_U32,
            SampleType::F16 => EXR_F16,
            SampleType::F32 => EXR_F32,
        })
        .collect();
    let channel = &header.channels.list[0];
    let channel_names: Vec<String> = header
        .channels
        .list
        .iter()
        .map(|channel| channel.name.to_string())
        .collect();
    // The same channels, in the same order, as `decode_exr_impl` shows.
    let selection = select_exr_display_channels(&channel_names);
    if selection.source_indices.is_empty() {
        return Ok(None);
    }

    let width = header.layer_size.0;
    let height = header.layer_size.1;
    if width == 0 || height == 0 || width.checked_mul(height).is_none() {
        return Ok(None);
    }
    let data_y = header.own_attributes.layer_position.1;
    let all_tags_json = extract_exr_tags_json(&header.shared_attributes, &header.own_attributes);
    let channel_name = channel.name.to_string();

    let chunks = reader
        .all_chunks(false)
        .map_err(|e| DecodeError::new(format!("Failed to read EXR chunk table: {e}")))?;
    let chunk_capacity = chunks.len();
    let mut compressed = Vec::with_capacity(data.len().saturating_sub(1024));
    let mut counts = Vec::with_capacity(chunk_capacity);
    let mut y_coordinates = Vec::with_capacity(chunk_capacity);
    for chunk in chunks {
        let chunk =
            chunk.map_err(|e| DecodeError::new(format!("Failed to read EXR chunk: {e}")))?;
        if chunk.layer_index != 0 {
            return Ok(None);
        }
        let CompressedBlock::ScanLine(CompressedScanLineBlock {
            y_coordinate,
            compressed_pixels_le,
        }) = chunk.compressed_block
        else {
            return Ok(None);
        };
        let count = u32::try_from(compressed_pixels_le.len())
            .map_err(|_| DecodeError::new("EXR compressed block is too large"))?;
        y_coordinates.push(y_coordinate);
        counts.push(count);
        compressed.extend_from_slice(&compressed_pixels_le);
    }
    if counts.is_empty() {
        return Ok(None);
    }

    Ok(Some(crate::ExrZipPlan {
        width: width as u32,
        height: height as u32,
        data_y,
        channel_name,
        channel_names,
        channel_kinds,
        selection: selection
            .source_indices
            .iter()
            .map(|index| index.map_or(-1, |index| i32::try_from(index).unwrap_or(-1)))
            .collect(),
        displayed_names: selection.displayed_names,
        compressed,
        counts,
        y_coordinates,
        all_tags_json,
    }))
}

/// Inflate a contiguous group of one-channel Float32 ZIP16 blocks. The caller
/// distributes disjoint groups across Web Workers and concatenates the raw
/// little-endian float bytes in row order.
pub(crate) fn decode_zip_f32_blocks(
    blob: &[u8],
    counts: &[u32],
    rows: &[u32],
    width: u32,
) -> Result<Vec<u8>, DecodeError> {
    let row_bytes = (width as usize)
        .checked_mul(4)
        .ok_or_else(|| DecodeError::new("EXR ZIP output size overflow"))?;
    decode_zip_blocks(blob, counts, rows, row_bytes)
}

/// EXR pixel types, as the file stores them.
pub(crate) const EXR_U32: u32 = 0;
pub(crate) const EXR_F16: u32 = 1;
pub(crate) const EXR_F32: u32 = 2;

fn exr_sample_bytes(kind: u32) -> usize {
    if kind == EXR_F16 {
        2
    } else {
        4
    }
}

/// Inflate ZIP16 blocks of `row_bytes`-byte rows, returning those rows' bytes.
fn decode_zip_blocks(
    blob: &[u8],
    counts: &[u32],
    rows: &[u32],
    row_bytes: usize,
) -> Result<Vec<u8>, DecodeError> {
    if counts.len() != rows.len() || row_bytes == 0 {
        return Err(DecodeError::new("Invalid EXR ZIP block range"));
    }
    let total_rows = rows.iter().try_fold(0usize, |sum, &value| {
        sum.checked_add(value as usize)
            .ok_or_else(|| DecodeError::new("EXR ZIP row count overflow"))
    })?;
    let total_bytes = total_rows
        .checked_mul(row_bytes)
        .ok_or_else(|| DecodeError::new("EXR ZIP output size overflow"))?;
    let mut output = Vec::with_capacity(total_bytes);
    let mut input_offset = 0usize;

    for (&count, &row_count) in counts.iter().zip(rows) {
        let input_end = input_offset
            .checked_add(count as usize)
            .filter(|&end| end <= blob.len())
            .ok_or_else(|| DecodeError::new("EXR ZIP block exceeds its compressed range"))?;
        let expected = (row_count as usize)
            .checked_mul(row_bytes)
            .ok_or_else(|| DecodeError::new("EXR ZIP block size overflow"))?;
        let source = &blob[input_offset..input_end];
        let mut bytes = if source.len() == expected {
            source.to_vec()
        } else {
            let options = zune_inflate::DeflateOptions::default()
                .set_limit(expected)
                .set_size_hint(expected);
            let mut decoder = zune_inflate::DeflateDecoder::new_with_options(source, options);
            decoder
                .decode_zlib()
                .map_err(|_| DecodeError::new("Malformed EXR ZIP block"))?
        };
        if bytes.len() != expected {
            return Err(DecodeError::new(
                "EXR ZIP block decompressed to the wrong size",
            ));
        }
        if source.len() != expected {
            exr_zip_differences_to_samples(&mut bytes);
            exr_zip_interleave_byte_blocks(&mut bytes);
        }
        output.extend_from_slice(&bytes);
        input_offset = input_end;
    }
    if input_offset != blob.len() {
        return Err(DecodeError::new(
            "EXR ZIP range contains trailing compressed bytes",
        ));
    }
    Ok(output)
}

/// Rows of a multi-channel ZIP16 image as `decode_exr_impl` shows them: the
/// `selection` (indices into the file's channel order; -1 for a missing
/// channel, filled with 1.0) interleaved per pixel as f32 (half floats and
/// integers converted as `decode_exr_impl` converts them), with
/// `compute_min_max_f32`'s range over them. The ranges of row bands merge by
/// min and max into the whole image's range.
pub(crate) fn decode_zip_f32_blocks_selected(
    blob: &[u8],
    counts: &[u32],
    rows: &[u32],
    width: u32,
    kinds: &[u32],
    selection: &[i32],
) -> Result<(Vec<f32>, f64, f64), DecodeError> {
    if selection.is_empty()
        || kinds.iter().any(|&kind| kind > EXR_F32)
        || selection
            .iter()
            .any(|&index| usize::try_from(index).is_ok_and(|index| index >= kinds.len()))
    {
        return Err(DecodeError::new("Invalid EXR channel selection"));
    }
    let width = width as usize;
    // Where each channel's run of `width` samples starts within a row.
    let mut plane_starts = Vec::with_capacity(kinds.len());
    let mut row_bytes = 0usize;
    for &kind in kinds {
        plane_starts.push(row_bytes);
        row_bytes = width
            .checked_mul(exr_sample_bytes(kind))
            .and_then(|bytes| row_bytes.checked_add(bytes))
            .ok_or_else(|| DecodeError::new("EXR ZIP output size overflow"))?;
    }
    let bytes = decode_zip_blocks(blob, counts, rows, row_bytes)?;
    let total_rows = bytes.len() / row_bytes;
    let out_channels = selection.len();
    let mut output = vec![0.0f32; total_rows * width * out_channels];
    for row in 0..total_rows {
        let source_row = &bytes[row * row_bytes..(row + 1) * row_bytes];
        let target_row = &mut output[row * width * out_channels..(row + 1) * width * out_channels];
        for (out_channel, &index) in selection.iter().enumerate() {
            // A negative index is a channel the file lacks: shown as 1.0.
            let Ok(index) = usize::try_from(index) else {
                for x in 0..width {
                    target_row[x * out_channels + out_channel] = 1.0;
                }
                continue;
            };
            let kind = kinds[index];
            let start = plane_starts[index];
            let plane = &source_row[start..start + width * exr_sample_bytes(kind)];
            let targets = target_row
                .iter_mut()
                .skip(out_channel)
                .step_by(out_channels);
            if kind == EXR_F16 {
                for (target, sample) in targets.zip(plane.chunks_exact(2)) {
                    *target =
                        exr::prelude::f16::from_bits(u16::from_le_bytes([sample[0], sample[1]]))
                            .to_f32();
                }
            } else if kind == EXR_F32 {
                for (target, sample) in targets.zip(plane.chunks_exact(4)) {
                    *target = f32::from_le_bytes([sample[0], sample[1], sample[2], sample[3]]);
                }
            } else {
                #[allow(clippy::cast_precision_loss)] // as decode_exr_impl converts integers
                for (target, sample) in targets.zip(plane.chunks_exact(4)) {
                    *target =
                        u32::from_le_bytes([sample[0], sample[1], sample[2], sample[3]]) as f32;
                }
            }
        }
    }
    #[allow(clippy::cast_possible_truncation)] // bounded by the decoded image size
    let (min, max) = crate::pipeline::stats::compute_min_max_f32(
        &output,
        width as u32,
        total_rows as u32,
        out_channels as u32,
    );
    Ok((output, min, max))
}

fn exr_zip_differences_to_samples(bytes: &mut [u8]) {
    if bytes.len() < 2 {
        return;
    }
    let mut previous = bytes[0] as i16;
    for byte in &mut bytes[1..] {
        let sample = (previous + *byte as i16 - 128) as u8;
        *byte = sample;
        previous = sample as i16;
    }
}

fn exr_zip_interleave_byte_blocks(bytes: &mut [u8]) {
    let separated = bytes.to_vec();
    let split = separated.len().div_ceil(2);
    let (first, second) = separated.split_at(split);
    for index in 0..second.len() {
        bytes[index * 2] = first[index];
        bytes[index * 2 + 1] = second[index];
    }
    if first.len() > second.len() {
        bytes[bytes.len() - 1] = first[first.len() - 1];
    }
}

pub(crate) fn decode_exr_impl(data: &[u8]) -> Result<ExrResult, DecodeError> {
    use exr::prelude::*;

    let start_time = crate::time::now_ms();
    let cursor = Cursor::new(data);
    let image = read()
        .no_deep_data()
        .largest_resolution_level()
        .all_channels()
        .first_valid_layer()
        .all_attributes()
        .from_buffered(cursor)
        .map_err(|e| DecodeError::new(format!("Failed to decode EXR: {}", e)))?;
    let read_time = crate::time::now_ms() - start_time;
    let pack_start = crate::time::now_ms();

    let layer = image.layer_data;
    let width = layer.size.0;
    let height = layer.size.1;
    if width == 0 || height == 0 {
        return Err(DecodeError::new("EXR has empty dimensions"));
    }

    let mut channels = layer.channel_data.list;
    if channels.is_empty() {
        return Err(DecodeError::new("EXR has no flat channels"));
    }

    let pixel_count = width
        .checked_mul(height)
        .ok_or_else(|| DecodeError::new("EXR dimensions overflow"))?;
    let channel_names: Vec<String> = channels
        .iter()
        .map(|channel| channel.name.to_string())
        .collect();
    let selection = select_exr_display_channels(&channel_names);
    if selection.source_indices.is_empty() {
        return Err(DecodeError::new("EXR has no displayable channels"));
    }

    for &index in selection.source_indices.iter().flatten() {
        let channel = &channels[index];
        if channel.sampling.0 != 1 || channel.sampling.1 != 1 {
            return Err(DecodeError::new(
                "Subsampled EXR channels are not supported by the Rust fast path",
            ));
        }
        if channel.sample_data.len() < pixel_count {
            return Err(DecodeError::new(
                "EXR channel sample count is smaller than the image dimensions",
            ));
        }
    }

    let output_channels = selection.source_indices.len();
    let interleaved = if output_channels == 1 {
        let source_index = selection.source_indices[0].ok_or_else(|| {
            DecodeError::new("EXR grayscale selection unexpectedly has no source channel")
        })?;
        let samples = mem::replace(
            &mut channels[source_index].sample_data,
            FlatSamples::F32(Vec::new()),
        );
        exr_samples_into_f32_vec(samples, pixel_count)
    } else {
        let mut interleaved = vec![0.0f32; pixel_count * output_channels];
        for (out_channel, source_index) in selection.source_indices.iter().enumerate() {
            if let Some(source_index) = source_index {
                copy_exr_channel_to_interleaved(
                    &channels[*source_index].sample_data,
                    &mut interleaved,
                    out_channel,
                    output_channels,
                    pixel_count,
                );
            } else {
                fill_exr_interleaved_channel(
                    &mut interleaved,
                    out_channel,
                    output_channels,
                    pixel_count,
                    1.0,
                );
            }
        }
        interleaved
    };

    let format = if output_channels == 1 { 1028 } else { 1023 };
    // Computed here rather than in the webview: the samples are already hot in
    // cache from the interleave above, and the JS fallback was a second full
    // pass over the whole image (~50ms at 5120x5120).
    let (range_min, range_max) = crate::pipeline::stats::compute_min_max_f32(
        &interleaved,
        width as u32,
        height as u32,
        output_channels as u32,
    );
    let pack_time = crate::time::now_ms() - pack_start;
    let total_time = crate::time::now_ms() - start_time;
    let all_tags_json = extract_exr_tags_json(&image.attributes, &layer.attributes);

    Ok(ExrResult {
        width: width as u32,
        height: height as u32,
        channels: output_channels as u32,
        data_f32: interleaved,
        channel_names_csv: channel_names.join(","),
        displayed_channels_csv: selection.displayed_names.join(","),
        format,
        data_min: range_min,
        data_max: range_max,
        data_type: 1015,
        timing_read_ms: read_time,
        timing_pack_ms: pack_time,
        timing_total_ms: total_time,
        all_tags_json,
    })
}

struct ExrChannelSelection {
    source_indices: Vec<Option<usize>>,
    displayed_names: Vec<String>,
}

fn select_exr_display_channels(channel_names: &[String]) -> ExrChannelSelection {
    let mut y = None;
    let mut r = None;
    let mut g = None;
    let mut b = None;
    let mut a = None;

    for (index, name) in channel_names.iter().enumerate() {
        let base = exr_base_channel_name(name);
        match base {
            "Y" => y.get_or_insert(index),
            "R" => r.get_or_insert(index),
            "G" => g.get_or_insert(index),
            "B" => b.get_or_insert(index),
            "A" => a.get_or_insert(index),
            "Z" | "z" | "depth" | "Depth" | "DEPTH" => y.get_or_insert(index),
            _ if channel_names.len() == 1 => y.get_or_insert(index),
            _ => continue,
        };
    }

    if let (Some(r), Some(g), Some(b)) = (r, g, b) {
        let mut source_indices = vec![Some(r), Some(g), Some(b)];
        let mut displayed_names = vec![
            channel_names[r].clone(),
            channel_names[g].clone(),
            channel_names[b].clone(),
        ];
        if let Some(a) = a {
            source_indices.push(Some(a));
            displayed_names.push(channel_names[a].clone());
        } else {
            source_indices.push(None);
        }
        return ExrChannelSelection {
            source_indices,
            displayed_names,
        };
    }

    if let Some(index) = y {
        return ExrChannelSelection {
            source_indices: vec![Some(index)],
            displayed_names: vec![channel_names[index].clone()],
        };
    }

    for (index, name) in channel_names.iter().enumerate() {
        let base = exr_base_channel_name(name);
        if base == "R" || base == "G" || base == "B" {
            return ExrChannelSelection {
                source_indices: vec![Some(index)],
                displayed_names: vec![channel_names[index].clone()],
            };
        }
    }

    ExrChannelSelection {
        source_indices: Vec::new(),
        displayed_names: Vec::new(),
    }
}

fn exr_base_channel_name(name: &str) -> &str {
    name.rsplit('.').next().unwrap_or(name)
}

fn copy_exr_channel_to_interleaved(
    samples: &FlatSamples,
    out: &mut [f32],
    out_channel: usize,
    output_channels: usize,
    pixel_count: usize,
) {
    match samples {
        FlatSamples::F16(values) => {
            for i in 0..pixel_count {
                out[i * output_channels + out_channel] = values[i].to_f32();
            }
        }
        FlatSamples::F32(values) => {
            for i in 0..pixel_count {
                out[i * output_channels + out_channel] = values[i];
            }
        }
        FlatSamples::U32(values) => {
            for i in 0..pixel_count {
                out[i * output_channels + out_channel] = values[i] as f32;
            }
        }
    }
}

fn exr_samples_into_f32_vec(samples: FlatSamples, pixel_count: usize) -> Vec<f32> {
    match samples {
        FlatSamples::F16(values) => {
            let mut out = Vec::with_capacity(pixel_count);
            for value in values.into_iter().take(pixel_count) {
                out.push(value.to_f32());
            }
            out
        }
        FlatSamples::F32(mut values) => {
            values.truncate(pixel_count);
            values
        }
        FlatSamples::U32(values) => {
            let mut out = Vec::with_capacity(pixel_count);
            for value in values.into_iter().take(pixel_count) {
                out.push(value as f32);
            }
            out
        }
    }
}

fn fill_exr_interleaved_channel(
    out: &mut [f32],
    out_channel: usize,
    output_channels: usize,
    pixel_count: usize,
    value: f32,
) {
    for i in 0..pixel_count {
        out[i * output_channels + out_channel] = value;
    }
}
