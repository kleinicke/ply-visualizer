# Vendored image decoder backend

`crates/image-decoders` is copied from the neighboring `tiff-visualizer`
repository at commit `ed3c7ed`. The optional JPEG XR dependency in
`crates/jpegxr` comes from the same commit; its license and in-memory decoding
patches are documented in `crates/jpegxr/VENDORING.md`.

The crate owns format parsing, decompression, predictors, decoded samples,
demosaicing, and decoder statistics. JavaScript bindings and 3D-specific depth
and camera operations remain in `wasm/tiff-decoder`.

The 3D adapter enables `tiff`, `exr`, `png`, `pfm`, and `codec-webp`. WebP stays
in this build to preserve existing TIFF support: this viewer does not use the
image viewer's lazy heavy-codec retry path. JPEG XR remains disabled.

Local patches to preserve when updating:

- `decode_png_samples_fast` retains original 8/16-bit PNG sample values for
  calibrated depth inputs; `decode_png16_fast` retains its display conversion.
- The TIFF-only feature combination enables the JSON metadata module needed by
  GeoTIFF metadata. The upstream all-format build hides this dependency.
- Format-specific examples declare their required features, and public API tests
  enable only the formats present in the selected build.

`npm run lint:rust:image` and `npm run lint:rust:image:wasm` run Clippy with
warnings treated as errors on the shared decoder and 3D image adapter, using the
features actually shipped here. `npm run format:rust:image:check` checks
formatting; `npm run format:rust:image` applies it. These checks exclude the
third-party JPEG XR implementation and the separate point-cloud/camera crates.

To update, copy the decoder and JPEG XR directories from a known upstream
commit, retain the local patches above, update the dependency lockfile and this
provenance, and compare decoded samples against the existing Node WASM build.
Then run `npm run build:wasm` to rebuild web and Node artifacts and record
`wasm/artifacts.json`, followed by `npm run check:wasm`, Rust tests, and depth
regressions. The artifact manifest includes both copied source directories. Copy
the fixtures referenced by the upstream tests into `test-samples` too;
`npm run test:rust` also runs the shared decoder tests with the enabled image
features.
