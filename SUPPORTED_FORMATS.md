# Supported File Formats - Technical Specifications

This document describes the formats the viewer can load or use as auxiliary
inputs. "Auxiliary" files are selected from controls inside the viewer, for
example MTL materials, color images or calibration files.

## Summary

| Category               | Extensions                                                                         | Notes                                                               |
| ---------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| Point clouds           | `.ply`, `.xyz`, `.xyzn`, `.xyzrgb`, `.pcd`, `.pts`, `.npy`, `.las`, `.laz`, `.e57` | `.npy` is treated as a point cloud when the array shape ends in `3` |
| Meshes                 | `.ply`, `.obj`, `.stl`, `.off`, `.gltf`, `.glb`                                    | Meshes can also be shown as points/wireframes where applicable      |
| Depth/disparity images | `.tif`, `.tiff`, `.png`, `.pfm`, `.npy`, `.npz`                                    | Converted to point clouds with camera parameters                    |
| Pose data              | `.json`                                                                            | 2D/3D body/keypoint JSON structures                                 |
| Camera profiles        | `.json`                                                                            | JSON with a top-level `cameras` object                              |
| Auxiliary materials    | `.mtl`                                                                             | Loaded for OBJ/material coloring workflows                          |
| Auxiliary color images | `.png`, `.jpg`, `.jpeg`, `.bmp`, `.gif`, `.tif`, `.tiff`                           | Applied to depth-derived point clouds                               |
| Auxiliary calibration  | `.json`, `.yaml`, `.yml`, `.txt`, `.conf`                                          | Loaded from depth settings/calibration controls                     |

Note: EXR is currently not fully supported yet.

## Point Cloud Files

### PLY Files (`.ply`)

- **Format**: ASCII, binary little endian and binary big endian.
- **Vertices**: `x y z` are required.
- **Colors**: `red green blue` vertex properties.
- **Normals**: `nx ny nz` vertex properties.
- **Faces**: Optional polygon faces; faces are triangulated for rendering.
- **Data types**: common PLY scalar types including `char`, `uchar`, `short`,
  `ushort`, `int`, `uint`, `float` and `double` variants.
- **Scalar coloring**: vertex properties named `intensity`, `reflectivity`,
  `reflectance` or `remission` are exposed through Intensity color modes.

### XYZ Files (`.xyz`)

- **Format**: ASCII text, one point per line.
- **Coordinates**: `x y z`.
- **Colors**: optional `x y z r g b`.
- **Intensity**: optional `x y z intensity`.
- **Notes**: plain `.xyz` is parsed through the PLY/XYZ parser. RGB values may
  be 0-255 integers or normalized 0-1 values depending on the loading path.

### XYZN Files (`.xyzn`)

- **Format**: ASCII text, one point per line.
- **Columns**: `x y z nx ny nz`.
- **Rendering**: normals are stored as typed arrays and can be visualized with
  the normals display controls.

### XYZRGB Files (`.xyzrgb`)

- **Format**: ASCII text, one point per line.
- **Columns**: `x y z r g b`.
- **Colors**: RGB can be normalized 0-1 or 0-255; normalized values are scaled
  to bytes.

### PCD Files (`.pcd`)

- **Format**: ASCII, binary and binary_compressed Point Cloud Data.
- **Coordinates**: required `x y z` fields.
- **Colors**: packed `rgb`/`rgba` or separate `r g b`/`red green blue`.
- **Normals**: `normal_x normal_y normal_z` or `nx ny nz`.
- **Viewpoint**: `VIEWPOINT` is preserved and applied as an initial transform
  when non-identity.
- **NaN filtering**: points with NaN coordinates are removed; colors, normals
  and intensity values are compacted with the remaining points.
- **Scalar coloring**: `intensity`, `reflectivity`, `reflectance` and
  `remission` fields are exposed through Intensity color modes.

### PTS Files (`.pts`)

- **Format**: ASCII text, optional leading point count.
- **Coordinates**: `x y z`.
- **Colors**: `x y z r g b` or `x y z intensity r g b`.
- **Normals**: `x y z r g b nx ny nz`.
- **Intensity**: `x y z intensity` and `x y z intensity r g b`.

### NPY Point Clouds (`.npy`)

- **Detection**: an NPY file is treated as a point cloud when its array shape
  ends with dimension `3`.
- **Shapes**: `(N, 3)`, `(H, W, 3)`, batched arrays and higher-dimensional
  arrays ending in `3`.
- **Data types**: float32, float64, signed integers and unsigned integers with
  little, native or big endian descriptors.
- **Interpretation**: the final dimension is interpreted as `x y z`; other
  dimensions are flattened.

### LAS and LAZ Files (`.las`, `.laz`)

- **Decoder**: the same optimized Rust/WASM implementation is used by VS Code
  and the standalone browser host.
- **Coordinates**: LAS scale and offset are applied as 64-bit values. A
  source-space origin is retained separately while local float32 positions are
  sent to the GPU, avoiding visible precision loss for large survey coordinates.
- **Colors**: LAS RGB records are supported, including both commonly encountered
  8-bit-in-16-bit and full 16-bit channel encodings. The detected encoding is
  recorded in metadata. Because LAS has no color-depth flag, files whose full
  16-bit RGB values all happen to be at most 255 are inherently ambiguous and
  are interpreted as 8-bit-in-16-bit.
- **Scalar coloring**: intensity, classification, return number/count, scan
  angle, GPS time, user data and point source ID are available as scalar fields.
- **Metadata**: version, point format, bounds, scale/offset, creation software,
  GUID and VLR/EVLR summaries are retained with the loaded cloud. OGC WKT and
  GeoTIFF projection VLR values are decoded into the `crs` metadata object.
- **Compression**: LAZ uses the native Rust LAZ decoder behind the same API.

### E57 Files (`.e57`)

- **Decoder**: pure Rust/WASM E57 decoding with Cartesian and spherical-to-
  Cartesian point support.
- **Multiple scans**: every scan becomes a separate file-list entry. Scan poses
  are applied and all entries share one precision-preserving origin, so they
  remain correctly aligned.
- **Colors and intensity**: normalized RGB and intensity are available when
  present; row and column indices are exposed as scalar fields.
- **Invalid records**: invalid Cartesian/direction-only records are skipped and
  their count is retained in scan metadata. A damaged E57 scan is reported as a
  decoder warning while other independently decodable scans still load.
- **Memory behavior**: browser decoding runs in a worker and transfers packed
  buffers without blocking the renderer. Extension transfers above 64 MiB are
  split into awaited 250,000-point chunks. All valid points are still decoded at
  full quality; inputs estimated to require more than 1 GiB of decoded WASM
  buffers fail early with a clear error instead of risking a WASM memory trap.
  Automatic sampling is not currently performed.

## Mesh Files

### OBJ Files (`.obj`)

- **Format**: ASCII Wavefront OBJ.
- **Geometry**: vertices (`v`), points (`p`), lines (`l`) and faces (`f`).
- **Normals/textures**: normal (`vn`) and texture coordinate (`vt`) records are
  parsed when present.
- **Materials**: `mtllib` and `usemtl` groups are parsed. MTL files can be
  loaded separately to apply material colors.
- **Rendering**: OBJ files with faces render as meshes; line/point data can be
  shown as wireframe/point geometry.

### STL Files (`.stl`)

- **Format**: ASCII STL and binary STL.
- **Geometry**: triangle meshes with per-triangle normals.
- **Colors**: binary STL attribute colors are parsed when present.
- **Conversion**: duplicate triangle vertices are deduplicated into a mesh-like
  vertex/face structure for rendering.

### OFF Files (`.off`)

- **Format**: ASCII OFF-family files.
- **Variants**: `OFF`, `COFF`, `NOFF`, `CNOFF`.
- **Colors**: `COFF` and `CNOFF`.
- **Normals**: `NOFF` and `CNOFF`.
- **Faces**: triangles, quads and polygons; quads/polygons are triangulated.

### GLTF/GLB Files (`.gltf`, `.glb`)

- **Format**: glTF JSON and binary GLB.
- **Geometry**: mesh primitives with positions, indices and faces.
- **Colors**: vertex colors are parsed when present.
- **Normals**: normal attributes are parsed when present.
- **Materials**: material counts and metadata are preserved for display.

## Depth Images to Point Clouds

Depth images are converted to point clouds using camera intrinsics and a depth
interpretation selected in the UI.

### TIFF Files (`.tif`, `.tiff`)

- **Dimensions**: 2D image data.
- **Data types**: unsigned integer, signed integer and floating-point samples.
- **Compression**: uncompressed, LZW and Deflate paths are supported by the TIFF
  reader.
- **Depth types**: Euclidean depth, orthogonal depth, disparity and inverse
  depth can be selected during conversion.

### PNG Files (`.png`)

- **Modes**: 8-bit/16-bit depth-style PNGs and RGB24-packed depth workflows.
- **Scale**: PNG scale factor converts raw values to meters or disparity units
  depending on the selected depth type.
- **RGB24 extraction**: shift, multiply, red, green and blue channel extraction
  modes are available for packed-depth images.

### PFM Files (`.pfm`)

- **Format**: Portable Float Map with ASCII header and binary float payload.
- **Channels**: grayscale and RGB PFM readers collapse to depth data as needed.
- **Endian**: scale sign controls endian handling.
- **Orientation**: bottom-up scanlines are flipped during load.

### NPY Depth Files (`.npy`)

- **Detection**: if the NPY array does not end in dimension `3`, it is treated
  as depth-like data.
- **Shapes**: 2D `(height, width)` and selected multi-channel arrays.
- **Data types**: float32, float64 and integer descriptors.

### NPZ Depth Archives (`.npz`)

- **Format**: ZIP archive containing NPY arrays.
- **Compression**: uncompressed ZIP entries are supported.
- **Array selection**: priority is `depth`, `disparity`, `distance`, `z`, then
  `range`.
- **Requirements**: at least one usable 2D array.

## JSON Data

### Pose JSON Files (`.json`)

- **Structures**: arrays of keypoints, nested pose data and OpenPose-like
  `people[].pose_keypoints_2d` / `pose_keypoints_3d`.
- **Coordinates**: 2D `[x, y]` or 3D `[x, y, z]`.
- **Confidence**: optional score/confidence values can be used for filtering and
  scaling controls.
- **Extras**: dataset keypoint/link colors are preserved when present.

### Camera Profile JSON Files (`.json`)

- **Detection**: JSON with a top-level `cameras` object is loaded as a camera
  profile instead of pose data.
- **Required fields**: each camera needs `local_extrinsics.params.location` and
  `local_extrinsics.params.rotation_quaternion`.
- **Rendering**: camera profiles are visualized as camera frustums/pyramids with
  optional labels and coordinate display.

## Auxiliary Files

### MTL Materials (`.mtl`)

- **Use case**: loaded alongside OBJ files to apply material colors.
- **Fields**: material names and diffuse colors are used for rendering.

### Color Images

- **Extensions**: `.png`, `.jpg`, `.jpeg`, `.bmp`, `.gif`, `.tif`, `.tiff`.
- **Use case**: selected from the depth settings UI and projected onto a
  depth-derived point cloud.
- **Validation**: dimensions are checked against the depth image when possible.

### Calibration Files

- **JSON**: 3D Visualizer/RealSense-style camera profiles.
- **YAML/YML**: OpenCV, ROS, stereo and Kalibr-style camera calibration.
- **TXT**: Middlebury `calib.txt`, COLMAP `cameras.txt` and TUM camera text.
- **CONF**: ZED calibration files.
- **Use case**: populate depth conversion intrinsics, distortion and stereo
  baseline settings.

## Color Modes

- **Original**: uses RGB/RGBA data from the file when present.
- **Intensity**: grayscale mapping of scalar intensity/reflectivity values.
- **Intensity (Viridis)**: perceptual color map for scalar inspection.
- **Intensity (Colors)**: blue-green-yellow-red scalar color map.
- **Assigned**: per-file color chosen by the viewer.
- **Palette colors**: manually selected fixed colors.

Intensity color modes affect RGB color only. They do not change point opacity or
filter out low-intensity points.

## Depth Conversion Parameters

- **Focal length**: `fx`, `fy` in pixels.
- **Principal point**: `cx`, `cy` in pixels.
- **Camera models**: pinhole ideal, pinhole OpenCV, fisheye equidistant, fisheye
  OpenCV and fisheye Kannala-Brandt.
- **Depth types**: Euclidean, orthogonal, disparity and inverse depth.
- **Coordinate conventions**: OpenGL and OpenCV.
- **Stereo options**: baseline and disparity offset.
- **Mono-depth options**: depth scale and depth bias.
