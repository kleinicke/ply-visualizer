//! WASM adapter for image decoding and ply-visualizer's depth/camera kernels.
//!
//! Format parsing and decompression live in the vendored plain-Rust
//! `scientific-image-decoders` crate. This crate owns only JavaScript bindings
//! and application-specific depth/camera operations.

mod decoder_bindings;
mod depth_camera;

pub use decoder_bindings::*;
pub use depth_camera::*;

#[cfg(feature = "console_error_panic_hook")]
pub use console_error_panic_hook::set_once as set_panic_hook;
