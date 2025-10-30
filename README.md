# 3D Point Cloud and Mesh Visualizer (PLY, ...)

This extension visualizes:

- **Point Clouds** in the formats: ASCII and binary ply files, xyz, xyzn,
  xyzrgb, pcd, pts and npy
- **Meshes** in the formats: ASCII and binary ply files, pbj, stl, off and
  gltf/glb
- **Depth and disparity images** are transformed on the fly to point clouds for
  the formats: tiff, png, pfm, npy and npz

Frequently new features will be added. You can simply request features that
support your workflow or new file formats on
[github](https://github.com/kleinicke/ply-visualizer/issues).

## Features

Interpret depth/disparity images as point cloud.
![tifPC](https://github.com/kleinicke/ply-visualizer/releases/download/v1.0.0/disp2pc.gif)

Load two point clouds and switch between them imediatly pressing shift and click
![load-two](https://github.com/kleinicke/ply-visualizer/releases/download/v0.0.14/load2.gif)

- **Compare Multiple Point Clouds**: Multiple point clouds can be loaded in the
  same view and activated and deactivated independently
- **Fast Loading of Big Point Clouds**: Even point clouds with 5 Million Points
  load in around a second
- **Rotation of points**: Apply Rotation Matrix for single point clouds
- **Depth to point cloud settings**: Allow setting the fx, fy, cx, cy, different
  camera disturbance models, mono depth scale and bias parameter, png int16
  scale parameter, disparity offset ...
- **Pose estimations**: Currently in development is support for 3d pose
  estimations in json files
- **Buttons for meshes**: Easily active wireframe, mesh, points and normals
- **Corresponding website**: All features can be also used without VS Code using
  the static website https://f-kleinicke.de
- **Frame rate visualization**: Shows the current frame rate. When point cloud
  is not moved, no more frames will be generated to save power, also ignores
  transparencies by default to save power
- **Measure distance**: Shift double click measures the distance between the
  rotation center and the selected point

## Roadmap

- **Wrong direction of Rotation**: When rotating the point cloud the direction
  is inverted. It's unclear how to fix this.
- **Add eye dome lighting**: Improve perception of uncolored point clouds
- **Drag and Drop**: Add more pc to a given pc using drag and drop instead of
  adding them in an extra window
- **Add new file formats**: Body pose json files for 3d body pose, FBX files can
  contain meshes or animations, Exr files can contain float depth images or
  complete point clouds, gaussian splats
- **Dataset support**: Add images from Middlebury stereo and Eth3d as example
  images
- **Automatic usage of calibration files**: extrinsics/intrinsics files next to
  the depth images can contain all required parameter for a depth to pc
  conversion. Automatically use those for depth images for intrinsics and
  extrinsics for point clouds
- **Crashes for too many points** After loading multiple point clouds also in
  multiple files in parallel it crashes, rendering all views with this extension
  gray.

## Feature Requests and Issues

If you have use cases that would be helpful for others or find problems, feel
free to suggest them on the
[GitHub repository](https://github.com/kleinicke/ply-visualizer/issues). If you
know how to fix bugs or how to implement certain features, feel free to
contribute. If you provide an example file, I can implement support for it in
the extension.

## Required structures of certain file formats

npy files:

- As depth image: [X,Y]
- As point cloud: [...,3] with the 3 values X,Y,Z
