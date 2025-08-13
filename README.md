# PLY Pointcloud Visualizer

A Visual Studio Code extension for visualizing PLY (Polygon File Format) files with interactive 3D visualization using Three.js. It's currently mainly developed for point cloud visualization, but should work in the future equally well for any objects.

## Features

- **Visualize Point Clouds**: Navigate in colored or uncolored point clouds 
- **Fast Loading of Big Point Clouds**: Even point clouds with 5 Million Points load in around a second.
- **Compare Multiple Point Clouds**: Multiple point clouds can be loaded in the same view and activated and deactivated independently.
- **Multiple Formats**: Support for both ASCII and binary PLY formats, XYZ pointclouds, OBJ wireframes and pose estimations in json files.
- **Rotation of points**: Apply Rotation Matrix for single point clouds

![example-view](assets/example.png)

Interpret depth/disparity images as point cloud.
![tifPC](https://github.com/kleinicke/ply-visualizer/releases/download/v1.0.0/disp2pc.gif)

Load two point clouds and switch between them imediatly pressing shift and click
![load-two](https://github.com/kleinicke/ply-visualizer/releases/download/v0.0.14/load2.gif)

## Theoretically supported PLY Features

- **Vertex Properties**:
  - Position (x, y, z)
  - Colors (red, green, blue)
  - Normals (nx, ny, nz)
- **Face Properties**:
  - Triangle and polygon faces
  - Automatic triangulation for complex polygons
- **Formats**:
  - ASCII PLY format
  - Binary PLY format (little-endian and big-endian)
  - XYZ point cloud format
  - OBJ wireframe format (points, vertices and line segments)
  - Bodypose json format (keypoints and connections)

## Known Issues and Missing Features
- **Wrong direction of Rotation**: When rotating the point cloud the direction is inversed. It's unclear how to fix this.
- **Bad use case knowledge for Shapes**: It was mainly tested for point clouds, since the author mainly works with point clouds.
- **Visualize Depth Image**: Interpret a depth image directly as a point cloud
- **Visualizing gaussian splats**: Add gaussian splat support
- **Add eye dome lighting**: Improve percenption of uncolored point clouds
- **Drag and Drop**: Add more pc to a given pc using drag and drop instead of adding them in an extra window

### OBJ Wireframe Format Example
```
# Vertices
v 0.0 0.0 0.0
v 1.0 0.0 0.0
v 0.5 1.0 0.0

# Lines connecting vertices (1-based indexing)
l 1 2
l 2 3
l 3 1

# Material file reference (colors currently ignored)
mtllib wireframe.mtl
usemtl red
```

**OBJ Support:**
- Vertices (`v` elements) are parsed and rendered as points
- Line segments (`l` elements) create wireframe connections
- MTL material files are recognized but colors are currently ignored
- Wireframes render in red by default and overlay existing point clouds
- Can be added to existing visualizations using "Add Point Cloud" button

## Depth/Disparity import: supported formats and requirements

The viewer can convert depth/disparity images to point clouds. Each format has minimal requirements so the geometry is unambiguous:

- PNG 16-bit (`.png`):
  - Single-channel 16-bit grayscale preferred; values represent depth or disparity.
  - If values are millimeters or scaled, provide a sidecar JSON (same folder, same stem + `.json`) with:
    - `{"kind":"depth","unit":"millimeter","scale":1000}` to convert mm→m; or `{"kind":"disparity","fx":...,"baseline":...}` for disparity.
  - Without sidecar, values are treated as meters and projected with a pinhole model using focal length from the UI dialog.

- EXR (`.exr`):
  - Single-channel float or RGBA float; the R channel is used.
  - Treated as Z-depth (distance along optical axis) in meters by default.
  - If it encodes range depth, add sidecar: `{"kind":"depth"}`.

- PFM (`.pfm`):
  - Single-channel float PFM (header `Pf`). The reader assumes values are in meters.
  - The file must be 2D (H×W). Multichannel `PF` is not supported for depth.

- NPY (`.npy`):
  - 2D float32/float64 C-order array with shape (H, W). Fortran order is not supported.
  - Values are interpreted as meters by default. Use sidecar to declare `kind` or units if needed.

- NPZ (`.npz`):
  - Must contain at least one `.npy` array with shape (H, W), float32/float64.
  - If multiple arrays exist, a key named `depth.npy` is preferred, otherwise the first array is used.

- TIFF (`.tif`, `.tiff`):
  - Single-band image. Float sample formats are treated as metric depth. Integer formats are treated as disparity or scaled depth (use sidecar to disambiguate units/kind).
  - If disparity, provide `{"kind":"disparity","fx":...,"baseline":...}`; baseline in meters.

- MAT v5 (`.mat`):
  - Must contain a 2D matrix (H×W) named one of `depth`, `D`, `Z`, `disp`, `disparity`.
  - Values assumed meters unless declared in a sidecar.

- HDF5 (`.h5`):
  - Not supported yet. Save as `.npy`/`.npz`/`.mat`. Opening will show a message explaining this.

Sidecar JSON example (optional but recommended when units/kind are ambiguous):

```json
{
  "kind": "depth",        
  "unit": "millimeter",   
  "scale": 1000,           
  "fx": 525.0, "fy": 525.0, "cx": 319.5, "cy": 239.5,
  "baseline": 0.054,       
  "cameraModel": "pinhole",
  "convention": "opencv"
}
```

Notes:
- If intrinsics are missing in the sidecar, the UI prompts for focal length and model (pinhole/fisheye). The principal point defaults to the image center.
- Disparity conversion uses `depth = fx * baseline / disparity`.
- Z-depth vs range-depth: EXR defaults to Z-depth; others default to range-depth unless `kind:"z"` is provided.

### Errors and how to fix them
- PNG: “Expected single-channel grayscale image” → Save as grayscale; if values are in mm, add sidecar with `unit`/`scale`.
- EXR: “Failed to parse EXR” or “No float channel found” → Export a float EXR with a depth pass; ensure R holds depth.
- PFM: “Invalid PFM header” or “Unsupported PFM dims” → Use `Pf` (single-channel) with `(width height)` on the second line and a scale on the third.
- NPY: “Only float32/float64 and 2D (H, W) arrays supported” → Save as C-order float 2D array.
- NPZ: “No .npy arrays found” → Include `depth.npy` with a 2D float array.
- TIFF: “Regular image (not single-channel depth/disparity)” → Use single-band depth/disparity TIFF.

## Supported formats at a glance

### 3D formats (point clouds and meshes)

| Format | Status | What loads | Notes |
| --- | --- | --- | --- |
| PLY (ASCII/Binary) | Supported | Points and meshes | Colors and normals if present. Mesh rendering available. |
| XYZ | Supported | Points | Optional per-vertex RGB if provided. |
| OBJ | Supported | Meshes | Basic MTL parsing; textures limited. “Wireframe” is a render mode. |
| KITTI BIN (Velodyne) | Planned | Points | Common lidar binary format; not yet implemented. |
| PCD (Point Cloud Data) | Planned | Points | ASCII/Binary; planned. |
| OFF | Planned | Meshes | Planned for mesh workflows. |
| STL | Planned | Meshes | Planned for CAD mesh workflows. |

| ASC (ASCII point cloud) | Maybe planned | Points | GIS/surveying; xyz plus optional intensity/classification. |
| ICS/ICP | Maybe planned | Points | Robotics/scanning; ASCII xyz (often with normals). |
| LAS (uncompressed) | Planned | Points | LiDAR standard; start here (no compression). |
| LAZ (compressed LAS) | Maybe planned | Points | Needs wasm decoder (LAZperf/plasio); larger bundle. |
| E57 | Maybe planned | Points/scans | Complex reader; likely needs wasm/native; defer. |
| glTF/GLB | Planned | Meshes/points | Good ROI via Three.js GLTFLoader. |
| COLLADA (.dae) | Maybe planned | Meshes | Available loader; lower demand. |
| X3D/VRML | Maybe planned | Meshes | Legacy/web 3D; lower demand. |
| 3MF | Maybe planned | Meshes | Manufacturing format; optional. |
| FBX | Maybe planned | Meshes | Large/complex loader; only if requested. |
| VOX (MagicaVoxel) | Maybe planned | Voxels → points | Could sample to points; not native voxel rendering. |
| VDB (OpenVDB) | Maybe planned | Sparse voxels | Likely out-of-scope in webview; defer. |
| VTK/VTP/VTU | Maybe planned | Meshes/points | Scientific viz; potential later. |
| NetCDF | Maybe planned | Grids/fields | Scientific data with spatial components; defer. |

Other tools commonly support combinations like OBJ/OFF/PCD/PLY/STL/XYZ; we’ll expand based on requests.

#### 3D format details

- PLY:
  - Points: x y z [red green blue] [nx ny nz]
  - Meshes: faces with indices; colors/normals supported when present
  - ASCII or binary (little/big endian)
- XYZ / ASC:
  - Line-based: `x y z [r g b] [intensity] [classification] ...`
  - Unknown extra columns are ignored; if an intensity column is found it can be mapped to grayscale
  - Comments/blank lines are skipped
- OBJ (.obj + optional .mtl):
  - Geometry: v/vt/vn, f (faces); we render meshes, and can display wireframe as a render mode
  - MTL materials are parsed; textures are limited
- KITTI BIN:
  - Binary little-endian; each point: 4 float32 values: x, y, z, reflectance
  - File size must be divisible by 16 bytes
- OFF (planned):
  - ASCII; header `OFF`, then counts and vertex/face lists
- PCD (planned):
  - Header with FIELDS, SIZE, TYPE, COUNT, WIDTH, HEIGHT, DATA (ascii|binary)
  - Fields typically include x y z [rgb|intensity]
- STL (planned):
  - ASCII or binary triangles; unitless; meshes only
- glTF/GLB (planned):
  - Modern meshes; optional point support via extensions; will use GLTFLoader
- COLLADA/DAE, X3D/VRML, 3MF, FBX (maybe planned):
  - Mesh-centric workflows; added based on demand
- LAS/LAZ, E57 (maybe planned):
  - LiDAR/scan standards; LAZ/E57 require heavier decoders (likely wasm)

### Depth/disparity formats (depth → point cloud)

| Format | Status | Typical data | Notes |
| --- | --- | --- | --- |
| TIFF (single-band) | Supported | Depth or disparity | Float → meters; int → use sidecar for units/kind. |
| PNG 16-bit (grayscale) | Supported | Depth or disparity | Use sidecar for units (mm→m) or disparity fx/baseline. |
| EXR (float) | Supported | Z-depth or range depth | Defaults to Z-depth; use sidecar `kind:"depth"` to force range. |
| PFM (Pf) | Supported | Float depth or disparity | Single-channel only; disparity needs fx/baseline. |
| NPY (2D float) | Supported | Depth | Shape (H,W) C-order. |
| NPZ (with .npy) | Supported | Depth | Prefers `depth.npy`; first array otherwise. |
| MAT v5 | Planned | Depth or disparity | Not yet supported; save as NPY/NPZ for now. |
| HDF5 (.h5) | Planned | Depth or disparity | Not yet supported; save as NPY/NPZ/MAT. |
| ROS bag | Planned | 16UC1/32FC1 depth | Would map to depth readers; future. |
| ARKit/HEIC with depth | Planned | Depth/disparity | Future via AVDepthData parsing. |
| COLMAP depth maps | Planned | Float depth | Future support for SfM/MVS outputs. |
| DPT (OpenCV depth) | Maybe planned | Depth | Niche; add if requested. |
| Raw binary depth (+ sidecar) | Maybe planned | Depth/disparity | Sidecar to specify width/height/dtype/endianness/kind/units/fx/cx/baseline. |
| Multi-frame depth sequences | Maybe planned | Temporal depth | Folder/NPZ stack; UI to select frames. |

#### Depth format details

- TIFF (single-band):
  - Float sample → meters; Integer sample → use sidecar for units (e.g., mm) or disparity
  - Single channel expected; intrinsics via UI or sidecar
- PNG 16-bit (grayscale):
  - Prefer true 16-bit single-channel; if 8-bit, values are quantized
  - Sidecar controls units/scale (mm→m) or disparity conversion (fx/baseline)
- EXR (float):
  - Single-channel or RGBA float; we use the R channel
  - Defaults to Z-depth (optical axis); set `{"kind":"depth"}` in sidecar for range depth
- PFM (Pf):
  - Header lines: `Pf`, then `width height`, then `scale` (negative = little-endian)
  - Single-channel float32; scanlines stored bottom-to-top (handled internally)
  - Middlebury disparity PFMs: set sidecar `{"kind":"disparity","fx":...,"baseline":...}`
- NPY / NPZ:
  - NPY: 2D C-order float32/float64 array with shape (H, W)
  - NPZ: archive with one or more NPY arrays; `depth.npy` preferred, otherwise first array used
- MAT v5 / HDF5 (planned):
  - Expect a 2D float array; we’ll auto-detect common keys (depth/disp/Z)
- Raw binary depth (+ sidecar) (maybe planned):
  - Sidecar schema example:
    ```json
    {
      "width": 640, "height": 480,
      "dtype": "uint16", "endianness": "little",
      "kind": "depth", "unit": "millimeter", "scale": 1000,
      "fx": 525.0, "fy": 525.0, "cx": 319.5, "cy": 239.5,
      "baseline": 0.054
    }
    ```



## Feature Requests and Issues

If you have use cases that would be helpful for others or find problems, feel free to suggest them on the [GitHub repository](https://github.com/kleinicke/ply-visualizer/issues). If you know how to fix bugs or how to implement certain features, feel free to contribute.



