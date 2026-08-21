# Vendored image decoder backend

`crates/image-decoders` is vendored unchanged from the neighboring
`tiff-visualizer` repository at commit `8a263aa` (2026-08-21).

The crate is plain Rust: it owns format parsing, decompression, predictor
handling, decoded pixel assembly, demosaicing, and decoder-level statistics.
Application and JavaScript bindings remain in `wasm/tiff-decoder`.

This project currently enables the `tiff`, `exr`, `png`, and `pfm` crate
features. PFM is enabled because the upstream crate's minimal-feature build
currently requires its shared statistics implementation; no PFM WASM binding is
exposed here yet.

To update the backend, replace the vendored directory from a known upstream
commit, update the commit recorded above, compare decoder output against the
existing build, then rebuild both web and Node.js WASM artifacts.
