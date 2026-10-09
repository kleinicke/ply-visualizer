//! Shared types/helpers for the FITS (`fits.rs`) and NetCDF (`netcdf.rs`)
//! decoders, mirroring `ScientificDecodedImage`, `finiteNumber` and
//! `scaledDomain` in `media/modules/scientific-format-parsers.ts`. Wrapped
//! into the public `DecodedArray` by `lib.rs`.

// Several helpers below serve only the container formats. A NARROW build —
// `jxl`, `jpegxr`, or `sdt` on their own — pulls this module in for its shared
// types and
// leaves the rest unused. That is expected; it is not dead code to delete.
#![cfg_attr(
    not(any(
        feature = "fits",
        feature = "netcdf",
        feature = "dicom",
        feature = "czi",
        feature = "nd2",
        feature = "lif"
    )),
    allow(dead_code)
)]

use crate::DecodeError;

/// Intermediate result shared by the FITS and NetCDF entry points, before
/// being assembled into the public `DecodedArray` in `lib.rs`.
pub(crate) struct ScientificParsed {
    pub width: u32,
    pub height: u32,
    pub channels: u32,
    pub bits_per_sample: u32,
    pub sample_format: u32,
    pub type_min: f64,
    pub type_max: f64,
    pub source_numeric_type: String,
    pub metadata_json: String,
    pub data: Vec<f32>,
}

/// `Math.min(first, last)` / `max` of `offset + scale * storedMin/Max` —
/// mirrors the TS `scaledDomain` helper exactly.
pub(crate) fn scaled_domain(
    stored_min: f64,
    stored_max: f64,
    scale: f64,
    offset: f64,
) -> (f64, f64) {
    let first = offset + scale * stored_min;
    let last = offset + scale * stored_max;
    (first.min(last), first.max(last))
}

/// Loose JS `Number(str)` equivalent: a FULL-STRING (not prefix) parse,
/// matching JS coercion semantics closely enough for the ASCII numeric
/// literals FITS/NetCDF headers actually contain (plain decimals, optional
/// sign/exponent). Empty/whitespace-only strings are `0` (as in JS); anything
/// that fails to parse is `NaN`. Unlike JS, this does not understand
/// `0x`/`0o`/`0b` prefixes — not a real-world concern for these formats'
/// header text.
pub(crate) fn js_number(s: &str) -> f64 {
    let t = s.trim();
    if t.is_empty() {
        return 0.0;
    }
    t.parse::<f64>().unwrap_or(f64::NAN)
}

/// Lenient byte-range-to-latin1-string reader: each byte maps 1:1 to the
/// Unicode code point of the same value (like `TextDecoder('latin1')` or JS
/// `String.fromCharCode` over raw bytes). Clamps to the available length
/// instead of erroring, mirroring the TS `ascii()` helper exactly (it is
/// deliberately permissive; callers that need a hard bounds check perform one
/// separately when they actually read binary values).
pub(crate) fn ascii(bytes: &[u8], start: usize, length: usize) -> String {
    if start >= bytes.len() {
        return String::new();
    }
    let end = bytes.len().min(start.saturating_add(length));
    bytes[start..end].iter().map(|&b| b as char).collect()
}

fn oob_generic(context: &str) -> DecodeError {
    DecodeError::new(format!(
        "{}: unexpected end of data while reading samples",
        context
    ))
}

/// Bounds-checked slice read, matching the "throw on out-of-range access"
/// behavior of a JS `DataView` getter (which is where the TS parsers get
/// their own implicit bounds checking).
pub(crate) fn get_slice<'a>(
    data: &'a [u8],
    offset: usize,
    len: usize,
    context: &str,
) -> Result<&'a [u8], DecodeError> {
    let end = offset
        .checked_add(len)
        .ok_or_else(|| oob_generic(context))?;
    data.get(offset..end).ok_or_else(|| oob_generic(context))
}

/// Marker of the error a [`SparseFile`] read returns for bytes the caller has
/// not supplied yet: `[need-range:OFFSET:LENGTH]`. The page reads that range
/// and calls the decoder again (`media/modules/ranged-source.ts`).
#[allow(dead_code)] // absent from builds without a ranged decoder
pub(crate) const NEED_RANGE_MARKER: &str = "[need-range:";

/// The bytes of a file of known size of which only some ranges are present,
/// addressed by absolute file offset. A decoder written against it reads a
/// whole file (one piece) and a ranged one alike: a read outside the file
/// fails exactly like [`get_slice`], a read inside it that no piece contains
/// fails with a [`NEED_RANGE_MARKER`] error naming the range to fetch.
#[allow(dead_code)] // absent from builds without a ranged decoder
pub(crate) struct SparseFile<'a> {
    size: usize,
    /// `(file offset, bytes)`, sorted by offset.
    pieces: Vec<(usize, &'a [u8])>,
}

#[allow(dead_code)] // absent from builds without a ranged decoder
impl<'a> SparseFile<'a> {
    /// A whole file in memory.
    pub(crate) fn whole(data: &'a [u8]) -> Self {
        Self {
            size: data.len(),
            pieces: vec![(0, data)],
        }
    }

    /// `size` bytes of which `pieces` (file offset, bytes) are present.
    pub(crate) fn new(size: usize, mut pieces: Vec<(usize, &'a [u8])>) -> Self {
        pieces.sort_by_key(|(offset, _)| *offset);
        Self { size, pieces }
    }

    /// The file's size (not the bytes present).
    pub(crate) fn len(&self) -> usize {
        self.size
    }

    pub(crate) fn is_empty(&self) -> bool {
        self.size == 0
    }

    /// `len` bytes at `offset`. When they are missing, ask for at least
    /// `want` bytes from `offset` (clamped to the file), so one fetch can
    /// cover what usually follows, e.g. a whole chunk after its header.
    pub(crate) fn slice_want(
        &self,
        offset: usize,
        len: usize,
        want: usize,
        context: &str,
    ) -> Result<&'a [u8], DecodeError> {
        let end = offset
            .checked_add(len)
            .ok_or_else(|| oob_generic(context))?;
        if end > self.size {
            return Err(oob_generic(context));
        }
        // The last piece starting at or before `offset` is the only candidate
        // besides earlier, longer pieces; check from there backwards.
        let after = self.pieces.partition_point(|(start, _)| *start <= offset);
        for &(start, bytes) in self.pieces[..after].iter().rev() {
            if start + bytes.len() >= end {
                return Ok(&bytes[offset - start..end - start]);
            }
        }
        let wanted = len.max(want).min(self.size - offset);
        Err(DecodeError::new(format!(
            "{NEED_RANGE_MARKER}{offset}:{wanted}] {context}: bytes not read yet"
        )))
    }

    /// `len` bytes at `offset`; see [`SparseFile::slice_want`].
    pub(crate) fn slice(
        &self,
        offset: usize,
        len: usize,
        context: &str,
    ) -> Result<&'a [u8], DecodeError> {
        self.slice_want(offset, len, len, context)
    }
}

/// Whether `error` is a [`SparseFile`] request for more bytes.
#[allow(dead_code)] // absent from builds without a ranged decoder
pub(crate) fn is_need_range(error: &DecodeError) -> bool {
    error.to_string().starts_with(NEED_RANGE_MARKER)
}

/// `Math.ceil(n / 4) * 4`, computed with checked arithmetic (no usize
/// overflow on 32-bit wasm targets, no panics on adversarial sizes).
#[allow(dead_code)] // absent from narrow TIFF+DICOM+JXL builds
pub(crate) fn ceil4(n: usize) -> usize {
    n.checked_add(3).map(|v| v / 4 * 4).unwrap_or(usize::MAX)
}
