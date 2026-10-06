//! What the images in a TIFF file actually ARE, as opposed to how many there
//! are.
//!
//! A multi-page TIFF and a pyramidal one (a Cloud-Optimized GeoTIFF, a
//! whole-slide image) look identical to a plain IFD count: both are a chain of
//! images. They are not the same thing. A COG's later IFDs are the SAME scene
//! at half, quarter and eighth resolution — showing them as "page 2 of 4"
//! invites the reader to treat a downsampled duplicate as separate data, and
//! hides the pyramid that makes the file fast to open.
//!
//! TIFF says which is which in NewSubfileType (tag 254): bit 0 marks a reduced-
//! resolution version of another image in the file, bit 2 a transparency mask.
//! This module reads that bit rather than guessing from dimensions, so a file
//! that genuinely holds four same-sized pages is never mistaken for a pyramid.
//!
//! Not covered: overviews hung off tag 330 (SubIFDs) instead of the main IFD
//! chain. They are reported as present (`sub_ifd_count`) but cannot be selected
//! — the `tiff` crate addresses images by chain index and exposes no way to
//! make an arbitrary IFD offset the current image. GDAL's COG driver writes the
//! main chain, which is the case this serves.

use std::io::Cursor;
use tiff::decoder::Decoder;
use tiff::tags::Tag;

use crate::formats::metadata::json_escape;

/// NewSubfileType bit 0: this image is a reduced-resolution version of another
/// image in the file.
const SUBFILE_REDUCED_RESOLUTION: u64 = 1;
/// NewSubfileType bit 2: this image is a transparency mask for another image.
const SUBFILE_TRANSPARENCY_MASK: u64 = 4;

/// How one IFD relates to the rest of the file.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum TiffPageKind {
    /// A page in its own right: the file's first image, or a genuinely
    /// separate one (a second timepoint, a second channel, a second scan).
    Image,
    /// A downsampled copy of an earlier page — a pyramid level.
    Overview,
    /// A transparency/coverage mask for an earlier page.
    Mask,
}

impl TiffPageKind {
    fn as_str(self) -> &'static str {
        match self {
            TiffPageKind::Image => "image",
            TiffPageKind::Overview => "overview",
            TiffPageKind::Mask => "mask",
        }
    }
}

#[derive(Debug, Clone)]
pub struct TiffPageInfo {
    /// Index in the main IFD chain — the same numbering `decode_tiff_page`
    /// takes, so a caller can act on this directly.
    pub index: u32,
    pub width: u32,
    pub height: u32,
    pub samples_per_pixel: u32,
    /// Raw NewSubfileType value (0 when the tag is absent).
    pub subfile_type: u64,
    pub kind: TiffPageKind,
    /// For an overview or mask, the page it belongs to. TIFF does not record
    /// this, so it is the nearest preceding full image — which is how both
    /// GDAL and libtiff read a chain.
    pub parent: Option<u32>,
    /// Linear downsample factor against the parent, rounded: 2 for a half-size
    /// overview. Only meaningful for `Overview`.
    pub reduction: u32,
    /// Overviews hung off THIS page via SubIFDs (tag 330), which are counted
    /// but not addressable. See the module comment.
    pub sub_ifd_count: u32,
    /// The smallest independently decodable unit of this level: a tile, or the
    /// full width by RowsPerStrip. A region read costs whole blocks, so this is
    /// what a caller snaps a requested rectangle to.
    pub block_width: u32,
    pub block_height: u32,
}

/// Walk the main IFD chain and classify every image in it.
///
/// Reads headers only — no pixel data — so this stays cheap enough to run on
/// every open. A file whose chain cannot be walked yields what was read before
/// the failure rather than an error: a partial directory still beats none.
pub fn page_directory(data: &[u8]) -> Vec<TiffPageInfo> {
    let cfa_patched = crate::cfa_safe_bytes(data);
    let raw: &[u8] = cfa_patched.as_ref();
    let mut decoder = match Decoder::new(Cursor::new(raw)) {
        Ok(decoder) => decoder.with_limits(tiff::decoder::Limits::unlimited()),
        Err(_) => return Vec::new(),
    };

    let mut pages: Vec<TiffPageInfo> = Vec::new();
    let mut index = 0u32;
    loop {
        let Ok((width, height)) = decoder.dimensions() else {
            break;
        };
        let subfile_type = decoder.get_tag_u64(Tag::NewSubfileType).unwrap_or(0);
        let samples_per_pixel = decoder.get_tag_u64(Tag::SamplesPerPixel).unwrap_or(1) as u32;
        let sub_ifd_count = decoder
            .get_tag_u64_vec(Tag::Unknown(330))
            .map(|offsets| offsets.len() as u32)
            .unwrap_or(0);
        let tile_width = decoder.get_tag_u64(Tag::TileWidth).unwrap_or(0) as u32;
        let tile_length = decoder.get_tag_u64(Tag::TileLength).unwrap_or(0) as u32;
        let (block_width, block_height) = if tile_width > 0 && tile_length > 0 {
            (tile_width, tile_length)
        } else {
            // A strip spans the full width; RowsPerStrip defaults to the whole
            // image, which is exactly the "one block" case a caller must know
            // about — there is nothing smaller to read.
            (
                width,
                decoder
                    .get_tag_u64(Tag::RowsPerStrip)
                    .unwrap_or(height as u64) as u32,
            )
        };

        let kind = if subfile_type & SUBFILE_TRANSPARENCY_MASK != 0 {
            TiffPageKind::Mask
        } else if subfile_type & SUBFILE_REDUCED_RESOLUTION != 0 {
            TiffPageKind::Overview
        } else {
            TiffPageKind::Image
        };

        // The parent is the nearest preceding full image. The first IFD is
        // always a page even if it claims otherwise, since there is nothing
        // before it for it to be a reduction OF.
        let parent = if kind == TiffPageKind::Image || pages.is_empty() {
            None
        } else {
            pages
                .iter()
                .rev()
                .find(|page| page.kind == TiffPageKind::Image)
                .map(|page| page.index)
        };
        let kind = if parent.is_none() {
            TiffPageKind::Image
        } else {
            kind
        };

        let reduction = match (kind, parent) {
            (TiffPageKind::Overview, Some(parent_index)) => pages
                .iter()
                .find(|page| page.index == parent_index)
                .filter(|_| width > 0)
                .map(|page| ((page.width as f64 / width as f64).round() as u32).max(1))
                .unwrap_or(1),
            _ => 1,
        };

        pages.push(TiffPageInfo {
            index,
            width,
            height,
            samples_per_pixel,
            subfile_type,
            kind,
            parent,
            reduction,
            sub_ifd_count,
            block_width,
            block_height,
        });

        if !decoder.more_images() || decoder.next_image().is_err() {
            break;
        }
        index += 1;
    }
    pages
}

/// The same directory as a JSON array, for the JavaScript side. Shares the
/// carrier convention of `all_tags_json` and `geo_json`: one string field on
/// the decode result, parsed once by the caller.
pub fn page_directory_json(data: &[u8]) -> String {
    let pages = page_directory(data);
    if pages.is_empty() {
        return String::new();
    }
    let entries: Vec<String> = pages
        .iter()
        .map(|page| {
            format!(
                "{{\"index\":{},\"width\":{},\"height\":{},\"samplesPerPixel\":{},\
                 \"subfileType\":{},\"kind\":\"{}\",\"parent\":{},\"reduction\":{},\
                 \"subIfdCount\":{},\"blockWidth\":{},\"blockHeight\":{}}}",
                page.index,
                page.width,
                page.height,
                page.samples_per_pixel,
                page.subfile_type,
                json_escape(page.kind.as_str()),
                page.parent
                    .map(|value| value.to_string())
                    .unwrap_or_else(|| "null".to_string()),
                page.reduction,
                page.sub_ifd_count,
                page.block_width,
                page.block_height,
            )
        })
        .collect();
    format!("[{}]", entries.join(","))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A file with one image reports one page and no pyramid, so callers can
    /// treat "one entry" as the ordinary case without special-casing.
    #[test]
    fn single_image_is_one_page() {
        let data = std::fs::read("../../test-samples/geotiff_wgs84.tif").unwrap();
        let pages = page_directory(&data);
        assert_eq!(pages.len(), 1);
        assert_eq!(pages[0].kind, TiffPageKind::Image);
        assert_eq!(pages[0].parent, None);
    }

    /// The first IFD is a page even when it claims to be a reduction: there is
    /// nothing before it for it to be a reduction of.
    #[test]
    fn first_ifd_is_always_a_page() {
        let data = std::fs::read("../../test-samples/multipage_rgb_depth_mask.tif").unwrap();
        let pages = page_directory(&data);
        assert!(!pages.is_empty());
        assert_eq!(pages[0].kind, TiffPageKind::Image);
    }

    /// The case from issue #12: a pyramidal COG must read as ONE image with
    /// overviews, not as several pages of unrelated data.
    #[test]
    fn cog_overviews_are_not_pages() {
        let data = std::fs::read("../../test-samples/cog_2band_pyramid.tif").unwrap();
        let pages = page_directory(&data);
        assert_eq!(pages.len(), 3);
        assert_eq!(pages[0].kind, TiffPageKind::Image);
        assert_eq!(pages[0].samples_per_pixel, 2);
        assert!(pages[1..]
            .iter()
            .all(|page| page.kind == TiffPageKind::Overview));
        assert!(pages[1..].iter().all(|page| page.parent == Some(0)));
        assert_eq!(pages[1].reduction, 2);
        assert_eq!(pages[2].reduction, 4);
        // Block geometry per level, which is what a region read snaps to.
        assert_eq!((pages[0].block_width, pages[0].block_height), (128, 128));
    }

    /// A stripped file has no tiles; its block is the full width by
    /// RowsPerStrip, and a caller must be able to tell the difference.
    #[test]
    fn stripped_pages_report_strip_geometry() {
        let data = std::fs::read("../../test-samples/deflate_pred3_f32.tif").unwrap();
        let pages = page_directory(&data);
        assert_eq!(pages.len(), 1);
        assert_eq!(
            pages[0].block_width, pages[0].width,
            "a strip spans the width"
        );
        assert!(pages[0].block_height >= 1 && pages[0].block_height <= pages[0].height);
    }

    /// A genuinely multi-page file keeps every page a page. The tag drives the
    /// classification, so same-sized pages are never read as a pyramid and
    /// differently-sized ones are never read as one either.
    #[test]
    fn plain_multipage_stays_pages() {
        let data = std::fs::read("../../test-samples/multipage_rgb_depth_mask.tif").unwrap();
        let pages = page_directory(&data);
        assert_eq!(pages.len(), 3);
        assert!(pages.iter().all(|page| page.kind == TiffPageKind::Image));
        assert!(pages.iter().all(|page| page.parent.is_none()));
    }

    /// A transparency mask is neither a page nor an overview; conflating it
    /// with either would offer the reader a 1-bit image as data.
    #[test]
    fn transparency_mask_is_its_own_kind() {
        let data = std::fs::read("../../test-samples/cog_rgb_mask.tif").unwrap();
        let pages = page_directory(&data);
        assert_eq!(pages.len(), 2);
        assert_eq!(pages[0].kind, TiffPageKind::Image);
        assert_eq!(pages[1].kind, TiffPageKind::Mask);
        assert_eq!(pages[1].parent, Some(0));
    }

    #[test]
    fn json_is_empty_for_a_non_tiff() {
        assert_eq!(page_directory_json(b"not a tiff at all"), "");
    }
}
