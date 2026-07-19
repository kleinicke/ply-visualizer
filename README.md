# 3D Point Cloud and Mesh Visualizer for VS Code

View, compare and inspect point clouds, meshes, gaussian splats, depth maps and
disparity images directly inside VS Code.

![Depth image converted to a point cloud](https://github.com/kleinicke/ply-visualizer/releases/download/v1.0.0/disp2pc.gif)

## Highlights

- Open large point clouds quickly, including files with millions of points
- Compare multiple point clouds in one view and toggle them independently
- Convert depth and disparity images into point clouds
- Render gaussian splat reconstructions as sorted splats or center point clouds
- Inspect meshes as surfaces, wireframes, points and normals
- Use Eye-Dome Lighting and brightness correction for clearer uncolored geometry
- Measure distances and adjust camera, rotation center and view parameters
- Use the same viewer outside VS Code on the static website:
  https://f-kleinicke.de

## Supported formats

| Type                   | Formats                                                         |
| ---------------------- | --------------------------------------------------------------- |
| Point clouds           | PLY, XYZ, XYZN, XYZRGB, PCD, PTS, NPY, LAS, LAZ, E57, KITTI BIN |
| Meshes                 | PLY, OBJ, STL, OFF, GLTF, GLB                                   |
| Gaussian splats        | 3DGS PLY, SPZ, SPLAT, KSPLAT, SOG                               |
| Depth/disparity images | TIFF, PNG, PFM, NPY, NPZ                                        |
| 3D Body Poses          | JSON pose data (experimental)                                   |
| Camera Profiles        | JSON pose data (experimental)                                   |

Because `.bin` and `.json` are generic extensions, neither is opened with the 3D
Visualizer by default. For KITTI BIN, use **Open With...** or right-click and
choose **Open with 3D Visualizer**. For a supported JSON pose, right-click and
choose **Load JSON as 3D Pose**.

## Features

### Depth and Disparity to Point Cloud

Convert depth or disparity images into point clouds directly from VS Code.
Projection settings include `fx`, `fy`, `cx`, `cy`, camera distortion models,
mono depth scale and bias, PNG int16 scale and disparity offset.

### Eye-Dome Lighting

Use Eye-Dome Lighting to improve depth perception, especially for uncolored
point clouds.

![Eye-Dome Lighting](https://github.com/kleinicke/ply-visualizer/releases/download/v1.0.0/EyeDome.gif)

### Multiple Point Clouds

Load multiple point clouds into the same view, toggle them independently and
switch between them with Shift-click.

![Multiple point clouds](https://github.com/kleinicke/ply-visualizer/releases/download/v0.0.14/load2.gif)

### Mesh Inspection

Inspect mesh files with controls for surface, wireframe, points and normals.
This is useful when checking geometry, topology or exported reconstruction
results without leaving the editor.

### Gaussian Splatting

Open 3D Gaussian Splatting reconstructions (3DGS PLY, SPZ, SPLAT, KSPLAT, SOG)
and render them as real sorted splats via [Spark](https://sparkjs.dev), or as a
point cloud of the gaussian centers with colors derived from the
spherical-harmonics coefficients. Switch per file with the **✨ Splats** button
in the Files panel. Measurement and picking keep working on the gaussian centers
in splat mode, and coloring the center points by the `opacity` scalar field
helps with spotting floaters.

### Point Cloud Attributes

Point cloud files can include positions, RGB colors, normals and scalar fields.
The viewer uses positions for geometry, original RGB values when available,
normals for inspection, and intensity/reflectivity fields for optional scalar
coloring. The recognized property names are `x/y/z`, `red/green/blue`,
`nx/ny/nz` and `intensity`/`reflectivity`/`reflectance`/`remission`. Any other
numeric per-vertex PLY property (e.g. `confidence`, `error`, `curvature`) also
appears in the Color dropdown for Viridis or grayscale colormap coloring.
LAS/LAZ attributes such as classification, returns, scan angle and GPS time are
exposed through the same scalar-field color controls. E57 containers load each
scan as a separate, independently visible entry.

### Distance Measurement Tools and Camera Manipulation

Build multiple measurement paths with **Shift-double-click**. See control
settings for options.

### Camera Recording

Create smooth camera paths from keyframes and export them as configurable video
recordings.

### Navigation

**Double-click** a point to change the rotation center. This allows for easy
navigation using a mouse or a trackpad. You can also manually enter the camera
position, rotation center and viewing angle.

### Performance-Aware Rendering

The viewer shows the current frame rate. When the point cloud is not moving, no
more frames are generated, which helps reduce power usage.

## NPY file structure options

- As a depth image: `[X,Y]`
- As a point cloud: `[...,3]` with the three values `X,Y,Z`

## Quick start

1. Open a supported file in VS Code.
2. Use the default custom editor, or right-click the file and choose **Open with
   3D Visualizer**.
3. For depth and disparity images, use the conversion command for the file type
   and adjust the camera parameters when prompted.

The extension also adds commands for opening multiple point clouds, playing a
point cloud sequence and converting depth files to point clouds.

## Feature requests and issues

If you have a workflow that would benefit from new features or file formats,
please open an issue on the
[GitHub repository](https://github.com/kleinicke/ply-visualizer/issues). Example
files are especially helpful when adding support for new formats.

## Roadmap

- Add support for more file formats, including FBX
- Improve dataset support with example images from Middlebury stereo and ETH3D
- Use calibration files next to depth images automatically when available
  (example files needed)
- Accept 3d body pose files (example files needed)
