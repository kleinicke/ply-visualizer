//! Decode a RECTANGLE of a TIFF page instead of the whole thing.
//!
//! The cost of looking at an image should follow the window, not the file. A
//! 10980x10980 band displayed 1:1 in a 1600x1000 window shows about 1.3% of its
//! pixels, and decoding the other 98.7% is work whose only visible effect is
//! the wait before it. Tiled files — which is what every Cloud-Optimized
//! GeoTIFF and whole-slide image is — already store the pixels in independently
//! compressed blocks, so the tiles a viewport covers can be decoded on their
//! own: a handful of blocks whose count depends on the window size, not on how
//! large the image happens to be.
//!
//! This is built on the same `FloatStripPlan` the parallel decoder uses, and on
//! the same `decode_block_rows` that decodes one of its blocks. That is
//! deliberate: a region decode and a whole-image decode that disagreed about a
//! pixel would be a silent correctness bug, and the only real defence is that
//! both walk the same code. The `*_matches_whole_image` tests below assert
//! exactly that, and `test/region-decode-test.js` asserts it again through
//! WebAssembly, across the whole sample corpus.
//!
//! What this does NOT handle, by design — each returns `None`/an error so the
//! caller falls back to the whole-image path rather than getting it wrong:
//!
//! * Layouts the plan itself declines (palette, YCbCr, CFA, sub-byte depths).
//! * `PlanarConfiguration` 2, where one block holds a single channel: assembling
//!   a region from those is a different traversal, and no COG uses it.
//! * `Orientation` other than 1. The stored rows are then not in display order,
//!   so a rectangle in display space is not a rectangle in storage space.

use crate::DecodeError;

use super::strips::{decode_block_rows, strip_bytes_to_f32, FloatStripPlan};

/// A rectangle of a page, in that page's own pixel coordinates.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub struct TiffRegion {
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

impl TiffRegion {
    /// The part of this rectangle that is inside a `width` x `height` image, or
    /// `None` when it lies entirely outside.
    pub fn clamped_to(self, width: u32, height: u32) -> Option<TiffRegion> {
        if self.x >= width || self.y >= height || self.width == 0 || self.height == 0 {
            return None;
        }
        Some(TiffRegion {
            x: self.x,
            y: self.y,
            width: self.width.min(width - self.x),
            height: self.height.min(height - self.y),
        })
    }
}

#[derive(Debug)]
pub struct TiffRegionResult {
    /// The rectangle actually decoded, after clamping to the image.
    pub region: TiffRegion,
    pub channels: u32,
    pub bits_per_sample: u32,
    pub sample_format: u32,
    /// Interleaved samples for the region, row-major, `region.width *
    /// region.height * channels` long.
    pub data_f32: Vec<f32>,
    /// Which blocks were read, for the caller's own accounting. This is the
    /// number that should stay flat as the image grows.
    pub blocks_decoded: u32,
}

/// Whether a page can be decoded a region at a time. Cheap: reads the IFD only.
pub fn region_decode_supported(plan: &FloatStripPlan) -> bool {
    plan.planar_configuration == 1
        && plan.orientation == 1
        && plan.bits_per_sample.is_multiple_of(8)
}

/// Decode `region` of the page described by `plan`.
///
/// `data` is the whole file; only the blocks the region touches are read from
/// it. Blocks a sparse file never wrote (byte count 0) read as zeros, as
/// libtiff does.
pub fn decode_region(
    data: &[u8],
    plan: &FloatStripPlan,
    region: TiffRegion,
) -> Result<TiffRegionResult, DecodeError> {
    if !region_decode_supported(plan) {
        return Err(DecodeError::new(
            "Region decode: this layout is decoded whole (planar, rotated, or sub-byte samples)",
        ));
    }
    let region = region
        .clamped_to(plan.width, plan.height)
        .ok_or_else(|| DecodeError::new("Region decode: the region is outside the image"))?;

    let channels = plan.channels as usize;
    let bytes_per_sample = plan.bits_per_sample as usize / 8;
    let pixel_bytes = channels * bytes_per_sample;
    let out_row_bytes = region.width as usize * pixel_bytes;
    let mut raster = vec![0u8; out_row_bytes * region.height as usize];

    // A strip is a full-width block; a tile is `tile_width` wide. Everything
    // below is the same for both once the block geometry is known.
    let (block_width, block_height, blocks_across) = if plan.is_tiled() {
        (
            plan.tile_width as usize,
            plan.tile_length as usize,
            plan.blocks_across.max(1) as usize,
        )
    } else {
        (plan.width as usize, plan.rows_per_strip.max(1) as usize, 1)
    };
    if block_width == 0 || block_height == 0 {
        return Err(DecodeError::new("Region decode: degenerate block geometry"));
    }

    let first_block_col = region.x as usize / block_width;
    let last_block_col = (region.x as usize + region.width as usize - 1) / block_width;
    let first_block_row = region.y as usize / block_height;
    let last_block_row = (region.y as usize + region.height as usize - 1) / block_height;

    let block_row_bytes = block_width * pixel_bytes;
    let mut block_buffer = vec![0u8; block_height * block_row_bytes];
    let mut blocks_decoded = 0u32;

    for block_row in first_block_row..=last_block_row {
        for block_col in first_block_col..=last_block_col {
            let index = block_row * blocks_across + block_col;
            let (Some(&offset), Some(&count)) = (plan.offsets.get(index), plan.counts.get(index))
            else {
                return Err(DecodeError::new(
                    "Region decode: block index outside the offset table",
                ));
            };

            // A strip is only as tall as the rows it actually holds; a tile is
            // padded by the encoder to its full height even at the edge.
            let block_first_row = block_row * block_height;
            let rows_in_block = if plan.is_tiled() {
                block_height
            } else {
                block_height.min(plan.height as usize - block_first_row)
            };

            if count == 0 {
                // Sparse: never written, reads as zeros.
                block_buffer.iter_mut().for_each(|byte| *byte = 0);
            } else {
                let start = offset as usize;
                let end = start.saturating_add(count as usize);
                if end > data.len() {
                    return Err(DecodeError::new(
                        "Region decode: block byte range outside the file",
                    ));
                }
                decode_block_rows(
                    &data[start..end],
                    plan,
                    block_width,
                    rows_in_block,
                    &mut block_buffer[..rows_in_block * block_row_bytes],
                )?;
            }
            blocks_decoded += 1;

            // Copy the part of this block that is inside the region.
            let block_first_col = block_col * block_width;
            let copy_first_col = block_first_col.max(region.x as usize);
            let copy_last_col = (block_first_col + block_width)
                .min(region.x as usize + region.width as usize)
                .min(plan.width as usize);
            if copy_last_col <= copy_first_col {
                continue;
            }
            let copy_bytes = (copy_last_col - copy_first_col) * pixel_bytes;
            let source_col_offset = (copy_first_col - block_first_col) * pixel_bytes;
            let dest_col_offset = (copy_first_col - region.x as usize) * pixel_bytes;

            let copy_first_row = block_first_row.max(region.y as usize);
            let copy_last_row = (block_first_row + rows_in_block)
                .min(region.y as usize + region.height as usize)
                .min(plan.height as usize);
            for image_row in copy_first_row..copy_last_row {
                let source_start =
                    (image_row - block_first_row) * block_row_bytes + source_col_offset;
                let dest_start = (image_row - region.y as usize) * out_row_bytes + dest_col_offset;
                raster[dest_start..dest_start + copy_bytes]
                    .copy_from_slice(&block_buffer[source_start..source_start + copy_bytes]);
            }
        }
    }

    // CMYK is stored as four samples and displayed as three. The whole-image
    // decode converts before handing pixels out, so a region that skipped this
    // would disagree with it on channel count and on every value — the exact
    // silent divergence this module exists to avoid. Same call the parallel
    // strip path makes, for the same reason.
    let (raster, channels_out) = if plan.photometric_interpretation == 5 {
        super::convert_cmyk_u8_to_rgb(raster, plan.channels)
    } else {
        (raster, plan.channels)
    };

    // The conversion is the plan's own, applied to a plan of the region's
    // shape — the same bytes-to-samples rules as a whole-image decode.
    let mut region_plan = plan.clone();
    region_plan.width = region.width;
    region_plan.height = region.height;
    let data_f32 = strip_bytes_to_f32(&raster, &region_plan);

    Ok(TiffRegionResult {
        region,
        channels: channels_out,
        bits_per_sample: plan.bits_per_sample,
        sample_format: plan.sample_format,
        data_f32,
        blocks_decoded,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::formats::tiff::float_strip_plan_for_page;

    /// A region must hold exactly the samples the whole-image decode holds for
    /// the same rectangle. This is the entire contract; everything else about
    /// region decoding is a performance argument.
    fn assert_matches_whole_image(path: &str, regions: &[TiffRegion]) {
        let data = std::fs::read(path).unwrap_or_else(|_| panic!("missing fixture {}", path));
        let plan = float_strip_plan_for_page(&data, 0)
            .unwrap_or_else(|| panic!("{} has no strip plan", path));
        if !region_decode_supported(&plan) {
            return;
        }
        let whole = decode_region(
            &data,
            &plan,
            TiffRegion {
                x: 0,
                y: 0,
                width: plan.width,
                height: plan.height,
            },
        )
        .unwrap();
        let channels = plan.channels as usize;

        for region in regions {
            let Some(clamped) = region.clamped_to(plan.width, plan.height) else {
                continue;
            };
            let part = decode_region(&data, &plan, *region).unwrap();
            assert_eq!(part.region, clamped);
            assert_eq!(
                part.data_f32.len(),
                clamped.width as usize * clamped.height as usize * channels
            );
            for row in 0..clamped.height as usize {
                for column in 0..clamped.width as usize * channels {
                    let from_region =
                        part.data_f32[row * clamped.width as usize * channels + column];
                    let image_row = row + clamped.y as usize;
                    let image_column = clamped.x as usize * channels + column;
                    let from_whole =
                        whole.data_f32[image_row * plan.width as usize * channels + image_column];
                    assert_eq!(
                        from_region, from_whole,
                        "{} region {:?} disagrees at row {} column {}",
                        path, region, row, column
                    );
                }
            }
        }
    }

    fn regions() -> Vec<TiffRegion> {
        vec![
            // A block-aligned rectangle, the easy case.
            TiffRegion {
                x: 0,
                y: 0,
                width: 128,
                height: 128,
            },
            // Straddling block boundaries in both directions, which is what a
            // viewport actually does.
            TiffRegion {
                x: 37,
                y: 91,
                width: 143,
                height: 77,
            },
            // A single pixel — what a pixel readout needs.
            TiffRegion {
                x: 200,
                y: 13,
                width: 1,
                height: 1,
            },
            // Running off the right and bottom edges, where tiles are padded.
            TiffRegion {
                x: 200,
                y: 200,
                width: 500,
                height: 500,
            },
            // One row and one column.
            TiffRegion {
                x: 0,
                y: 64,
                width: 256,
                height: 1,
            },
            TiffRegion {
                x: 64,
                y: 0,
                width: 1,
                height: 256,
            },
        ]
    }

    #[test]
    fn tiled_two_band_int16_region_matches_whole_image() {
        assert_matches_whole_image("../../test-samples/cog_2band_pyramid.tif", &regions());
    }

    #[test]
    fn stripped_float_region_matches_whole_image() {
        assert_matches_whole_image("../../test-samples/deflate_pred3_f32.tif", &regions());
    }

    /// A tiled file in a different carrier and codec. Deliberately not one of
    /// the heavy-codec fixtures: those decode only in the codec build, and a
    /// test that silently skips there would be worse than no test.
    #[test]
    fn tiled_bigtiff_region_matches_whole_image() {
        assert_matches_whole_image("../../test-samples/bigtiff_deflate_tiled.tif", &regions());
    }

    #[test]
    fn a_region_outside_the_image_is_reported() {
        let data = std::fs::read("../../test-samples/cog_2band_pyramid.tif").unwrap();
        let plan = float_strip_plan_for_page(&data, 0).unwrap();
        assert!(decode_region(
            &data,
            &plan,
            TiffRegion {
                x: 9000,
                y: 9000,
                width: 10,
                height: 10
            }
        )
        .is_err());
    }

    /// The point of the exercise: blocks read must follow the region, not the
    /// image. A one-pixel read touches one block however large the page is.
    #[test]
    fn a_small_region_reads_few_blocks() {
        let data = std::fs::read("../../test-samples/cog_2band_pyramid.tif").unwrap();
        let plan = float_strip_plan_for_page(&data, 0).unwrap();
        let one = decode_region(
            &data,
            &plan,
            TiffRegion {
                x: 5,
                y: 5,
                width: 1,
                height: 1,
            },
        )
        .unwrap();
        assert_eq!(one.blocks_decoded, 1);
        let whole = decode_region(
            &data,
            &plan,
            TiffRegion {
                x: 0,
                y: 0,
                width: plan.width,
                height: plan.height,
            },
        )
        .unwrap();
        assert!(whole.blocks_decoded > one.blocks_decoded);
    }
}
