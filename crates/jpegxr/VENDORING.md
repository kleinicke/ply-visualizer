# jpegxr (vendored)

A pure-Rust JPEG XR decoder, vendored from
[henriksson-lab/jpegxr-pure-rs](https://github.com/henriksson-lab/jpegxr-pure-rs)
at version 0.1.0 (commit `484ca94`), which is itself a translation of
Microsoft's JXRLib. Licensed BSD-3-Clause; `LICENSE.md` is the upstream file,
unchanged.

## Why it is vendored rather than depended on

The published crate cannot decode anything in WebAssembly. Every public
constructor reaches its input through a **temporary file**:

```rust
pub fn from_slice(data: &[u8]) -> Result<Self> {
    let path = temp_jxr_path("input");   // std::env::temp_dir()
    std::fs::write(&path, data)?;
    let decoder = create_decoder_from_path(&path)?;
```

`std::env::temp_dir()` panics on `wasm32-unknown-unknown`, so the first wasm
build using it aborted the module. The crate already contains everything needed
to avoid the file — an in-memory `WMPStream` — but it is private, so the fix
cannot live outside the crate.

## Changes from upstream

Only two, both in service of decoding from memory. Everything else, including
the encoder, is untouched.

1. **`src/api.rs` — decode from memory instead of a temp file.** `DecoderInput`
   gains a `Memory(Box<[u8]>)` variant; `Decoder::from_bytes` builds the decoder
   over `create_ws_memory_read_owned` (the crate's own read-only memory stream)
   through a new `create_decoder_from_memory`, and `from_slice` goes through it.
   The file-based constructors are still there and still work.

2. **`src/image/sys/strcodec.rs` — `read_ws_memory` clamps instead of failing.**
   The translation made an over-long read return `BufferOverflow`; the C
   original (`ReadWS_Memory`, `strcodec.c:395`) clamps to what is left, copies
   it, advances to the end and succeeds. The decoder depends on the C behaviour:
   it reads the bitstream one 4096-byte packet at a time, the last packet of an
   image is nearly always short, and it only tolerates a failed read when the
   stream reports EOS — which a read that consumes nothing never does. With the
   strict version every in-memory decode failed with `Codec(Fail)` at the last
   packet, which is why the file path worked and the memory path did not.

Both are worth sending upstream; with them the crate needs no filesystem at all
for decoding.

## Re-syncing with upstream

Copy `src/` and `LICENSE.md` over, keep this repo's `Cargo.toml` (the package is
renamed to `jpegxr-wasm` and is `publish = false`, with the library still named
`jpegxr`), then re-apply the two changes above. `npm run test:wasm` covers the
result: `jxr_*.tif` in `test-samples/` decode through this crate, and the
fixtures' pixels are checked against jxrlib's own output.
