# PLY Pointcloud Visualizer

A Visual Studio Code extension for visualizing PLY (Polygon File Format) files with interactive 3D visualization using Three.js.
Multiple 3d formats for points and shapes and depth and disparity images are also supported.
The depth and disparity images are converted on the fly into point clouds.

## Features

- **Visualize Point Clouds**: Navigate in colored or uncolored point clouds
- **Fast Loading of Big Point Clouds**: Even point clouds with 5 Million Points load in around a second.
- **Compare Multiple Point Clouds**: Multiple point clouds can be loaded in the same view and activated and deactivated independently.
- **Multiple Formats**: Support for both ASCII and binary PLY formats, XYZ pointclouds, OBJ wireframes, stl and pose estimations in json files.
- **Rotation of points**: Apply Rotation Matrix for single point clouds
- **Depth to point cloud conversion**: Can convert on the fly depth images to point clouds. It has support for tiff, png, pfm, npy and npz files.

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

## Feature Requests and Issues

If you have use cases that would be helpful for others or find problems, feel free to suggest them on the [GitHub repository](https://github.com/kleinicke/ply-visualizer/issues). If you know how to fix bugs or how to implement certain features, feel free to contribute.
