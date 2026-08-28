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
fn extract_exr_tags_json(
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
        .map_err(|e| DecodeError::new(&format!("Failed to decode EXR: {}", e)))?;
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

