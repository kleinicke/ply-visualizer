//! The one signal that says "this file needs the heavy-codec module".
//!
//! Ungated, and outside `tiff`, because both the TIFF strip decoders and the
//! DICOM transfer-syntax dispatch raise it and neither feature implies the
//! other.

use crate::DecodeError;

/// The error a build WITHOUT a given heavy codec returns when a file needs it.
///
/// The `[external-codec:NAME]` prefix is load-bearing, not decoration: the
/// webview matches it to decide that this file needs the separate codec
/// module, and fetches it. Anything that changes the prefix has to change
/// `EXTERNAL_CODEC_PATTERN` in `media/modules/codec-wasm-wrapper.ts` with it.
#[allow(dead_code)]
pub(crate) fn needed(name: &str, what: &str) -> DecodeError {
    DecodeError::new(format!(
        "[external-codec:{}] {} needs the {} decoder, which is not in this build",
        name, what, name
    ))
}
