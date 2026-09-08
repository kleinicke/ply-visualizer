# Remote files

Requires **VS Code 1.106.0 or later** (Node 22.20.0).

Run **3D Visualizer: Load Remote URL** from the VS Code command palette. Paste
an HTTP(S) link to a supported file. Press Up/Down or click the arrow buttons to
recall previously loaded URLs. The latest 50 distinct URLs are saved across
sessions. The entire file downloads before visualization; VS Code keeps
downloads in its extension storage.

Gzip (`.gz`), zlib (`.zlib`, `.zz`, `.deflate`), raw DEFLATE (`.deflate-raw`),
and Brotli (`.br`, `.brotli`) files are decompressed using built-in APIs, with
no additional library. Gzip and zlib are also recognized by their headers.
Website Brotli loading requires a browser with Brotli support in
`DecompressionStream`. For URLs without a recognizable filename, supply a
filename with the correct extension when prompted.

Website links use `?source=<encoded-file-url>` to reopen a remote file; an
optional `filename` parameter selects its format. There is no remote URL button
in the viewer. The source server must allow browser CORS requests. Use
self-contained files (for example GLB) for easy sharing. GLTF/GLB, FBX, Collada
and 3DS supporting buffers and textures are resolved relative to the model URL;
each resource must also allow CORS.
