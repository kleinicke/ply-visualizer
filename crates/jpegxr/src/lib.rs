#![allow(dead_code)]
#![allow(non_snake_case)]
#![allow(non_camel_case_types)]
#![allow(non_upper_case_globals)]
#![allow(unused_imports)]
#![allow(unused_variables)]
#![allow(clippy::missing_safety_doc)]

//! Safe JPEG-XR decode, encode, and transcode API backed by a faithful Rust
//! translation of JXRLib.

/// Crate-wide error type: the idiomatic replacement for BOTH C error families — the
/// glue/stream `WMP_err*` codes (`ERR`/`int`, `windowsmediaphoto.h`) and the codec
/// `ERR_CODE` status (`ICERR_OK`/`ICERR_ERROR`). Every function whose original C returned
/// one of those integer codes returns `Result<T, WmpError>`: success (`WMP_errSuccess` /
/// `ICERR_OK`, both `0`) maps to `Ok(...)`, and each failure code maps to the matching
/// variant. The generic codec failure `ICERR_ERROR` (== `WMP_errFail`, both `-1`) is
/// `WmpError::Fail`; where the cause is known, a more specific variant is used.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WmpError {
    Fail,
    NotYetImplemented,
    AbstractMethod,
    OutOfMemory,
    FileIO,
    BufferOverflow,
    InvalidParameter,
    InvalidArgument,
    UnsupportedFormat,
    IncorrectCodecVersion,
    IndexNotFound,
    OutOfSequence,
    NotInitialized,
    MustBeMultipleOf16LinesUntilLastCall,
    PlanarAlphaBandedEncRequiresTempFile,
    AlphaModeCannotBeTranscoded,
    IncorrectCodecSubVersion,
}

impl std::fmt::Display for WmpError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        let name = match self {
            WmpError::Fail => "operation failed",
            WmpError::NotYetImplemented => "not yet implemented",
            WmpError::AbstractMethod => "abstract method",
            WmpError::OutOfMemory => "out of memory",
            WmpError::FileIO => "file I/O error",
            WmpError::BufferOverflow => "buffer overflow",
            WmpError::InvalidParameter => "invalid parameter",
            WmpError::InvalidArgument => "invalid argument",
            WmpError::UnsupportedFormat => "unsupported format",
            WmpError::IncorrectCodecVersion => "incorrect codec version",
            WmpError::IndexNotFound => "index not found",
            WmpError::OutOfSequence => "out of sequence",
            WmpError::NotInitialized => "not initialized",
            WmpError::MustBeMultipleOf16LinesUntilLastCall => {
                "must be a multiple of 16 lines until the last call"
            }
            WmpError::PlanarAlphaBandedEncRequiresTempFile => {
                "planar alpha banded encoding requires a temp file"
            }
            WmpError::AlphaModeCannotBeTranscoded => "alpha mode cannot be transcoded",
            WmpError::IncorrectCodecSubVersion => "incorrect codec sub-version",
        };
        f.write_str(name)
    }
}

impl std::error::Error for WmpError {}

mod api;
mod common;
mod image;
mod jxrgluelib;

pub use api::{
    decode_bytes, decode_file, decode_reader, encode_to_path, encode_to_vec, encode_to_writer,
    transcode_bytes_to_vec, transcode_file_to_path, transcode_reader_to_writer, BitDepth,
    ChannelOrder, ColorFormat, DecodedImage, Decoder, Encoder, EncoderColorFormat, EncoderOptions,
    Error, PixelFormat, PixelInterpretation, Result, SampleFormat,
};
