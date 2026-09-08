# Third-Party Notices

This extension incorporates components from the following open source projects.

---

## libjxl (JPEG XL Reference Implementation)

Used via `@jsquash/jxl` for decoding JPEG XL (`.jxl`) images.

- **Homepage**: https://github.com/libjxl/libjxl
- **License**: Apache License 2.0

Copyright (c) the JPEG XL Project Authors.

The full Apache 2.0 license text can be found at:
https://www.apache.org/licenses/LICENSE-2.0

---

## jSquash (@jsquash/jxl)

WebAssembly wrapper around libjxl.

- **Homepage**: https://github.com/jamsinclair/jSquash
- **Author**: Jamie Sinclair
- **License**: Apache License 2.0

---

## tiff (Rust crate)

Used as the primary TIFF decoder, compiled to WebAssembly.

- **Homepage**: https://github.com/image-rs/image-tiff
- **License**: MIT

---

## lerc-reader (Rust crate)

Pure-Rust decoder for LERC-compressed TIFF strips and tiles (compression 34887).

- **Homepage**: https://github.com/i-norden/lerc-rust
- **License**: MIT OR Apache-2.0

---

## JXRLib / jpegxr-pure-rs (vendored at crates/jpegxr)

Pure-Rust JPEG XR decoder, vendored from
[jpegxr-pure-rs](https://github.com/henriksson-lab/jpegxr-pure-rs) 0.1.0, which
is a translation of Microsoft's JXRLib. Two changes were made so it can decode
without a filesystem; they are listed in `crates/jpegxr/VENDORING.md`.

- **License**: BSD-3-Clause (New BSD), Copyright (c) 2009 Microsoft. The
  upstream licence text ships verbatim at `crates/jpegxr/LICENSE.md`.

---

## dicom-toolkit-jpeg2000 (Rust crate)

Pure-Rust JPEG 2000 decoder for JP2-compressed TIFF strips and tiles
(compressions 34712 and Aperio's 33003/33004/33005), used through its
native-bit-depth entry point.

- **Homepage**: https://crates.io/crates/dicom-toolkit-jpeg2000
- **License**: MIT OR Apache-2.0

---

## pure_jpegls and pure_jpegli (Rust crates)

Pure-Rust JPEG-LS and lossless JPEG decoders, used for the DICOM
1.2.840.10008.1.2.4.80/.81 and .57/.70 transfer syntaxes.

- **Homepage**: https://crates.io/crates/pure_jpegls and
  https://crates.io/crates/pure_jpegli
- **License**: MIT OR Apache-2.0

---

## lzma-rs (Rust crate)

Pure-Rust xz/LZMA decoder for LZMA-compressed TIFF strips and tiles (compression
34925).

- **Homepage**: https://github.com/gendx/lzma-rs
- **License**: MIT

---

## geotiff.js

Used as the fallback TIFF decoder.

- **Homepage**: https://github.com/geotiffjs/geotiff.js
- **Author**: Fabian Schindler
- **License**: MIT

---

## pako

Used for zlib/deflate decompression.

- **Homepage**: https://github.com/nodeca/pako
- **License**: MIT and Zlib

---

## parse-exr

Used for decoding OpenEXR images.

- **Homepage**: https://github.com/nicktindall/parse-exr
- **License**: MIT

---

## parse-hdr

Used for decoding Radiance HDR images.

- **Author**: Marcin Ignac
- **License**: MIT

---

## tga-js

Used for decoding TGA images.

- **Homepage**: https://github.com/vthibault/tga.js
- **License**: MIT

---

## UPNG.js

Used for decoding 16-bit PNG images.

- **Homepage**: https://github.com/photopea/UPNG.js
- **License**: MIT

---

## ag-psd

Used for decoding Photoshop PSD and PSB composite images and document structure.

- **Homepage**: https://github.com/Agamnentzar/ag-psd
- **License**: MIT

---

## fflate

Used for selective extraction of OpenRaster and Krita ZIP containers.

- **Homepage**: https://github.com/101arrowz/fflate
- **License**: MIT

---

## tslib

TypeScript runtime helpers.

- **Homepage**: https://github.com/Microsoft/tslib
- **License**: 0BSD (Zero-Clause BSD — no attribution required)

---

## vscode-uri

URI utilities for VS Code extensions.

- **Homepage**: https://github.com/microsoft/vscode-uri
- **License**: MIT
