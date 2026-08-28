# scientific-image-decoders

Pure Rust byte decoders shared by Scientific Image Visualizer and, eventually,
PLY Visualizer. The crate contains no `wasm-bindgen` types or application UI. It
can be tested natively and wrapped for WebAssembly, native Rust, or another FFI
without changing decoder code.

## Formats

Each decoder is independently selectable with a Cargo feature:

- `tiff` (including OME-TIFF metadata and CFA-safe decoding)
- `exr`, `png`, `hdr`, `jpeg`
- `pfm`, `netpbm`, `npy`/NPZ
- `fits`, `netcdf`, `dicom`, `czi`
- `demosaic`

`all-formats` enables the complete set and is the default. A smaller consumer
such as PLY Visualizer can disable defaults and compile only its depth formats:

```toml
[dependencies]
scientific-image-decoders = {
    git = "https://github.com/kleinicke/scientific-image-decoders",
    rev = "<pinned-commit>",
    default-features = false,
    features = ["tiff", "exr", "png", "pfm", "npy"]
}
```

## Development workflow

In this repository the WASM adapter uses a relative path dependency, so an edit
under `crates/image-decoders` is picked up by the next `cargo`, `wasm-pack`, or
`npm run build:wasm` command—there is no publish or dependency-update step.

After this directory becomes its own repository, applications should commit a
Git dependency pinned with `rev`. For simultaneous local development, override
that pin in the application's uncommitted `.cargo/config.toml`:

```toml
[patch."https://github.com/kleinicke/scientific-image-decoders"]
scientific-image-decoders = { path = "../scientific-image-decoders" }
```

This preserves reproducible CI and releases while keeping the local edit/build
loop just as direct as an in-repository crate.

## Responsibilities

This crate owns encoded bytes, decoded samples, source metadata, demosaicing,
and format-neutral statistics. WASM bindings, rendering, normalization policy,
depth/camera semantics, measurement tools, and layer compositing belong to the
consuming applications.
