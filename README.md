# 3D Point Cloud Visualizer (PLY, ...)

A Visual Studio Code extension for visualizing Point Cloud files like PLY
(Polygon File Format) with interactive 3D visualization using Three.js. Multiple
3d formats for points and shapes and depth and disparity images are also
supported. The depth and disparity images are converted on the fly into point
clouds.

Frequently new features will be added. You can simply request features that
support your workflow or new file formats on
[github](https://github.com/kleinicke/ply-visualizer/issues).

## Features

- **Visualize Point Clouds**: Navigate in colored or uncolored point clouds
- **Fast Loading of Big Point Clouds**: Even point clouds with 5 Million Points
  load in around a second
- **Compare Multiple Point Clouds**: Multiple point clouds can be loaded in the
  same view and activated and deactivated independently
- **Rotation of points**: Apply Rotation Matrix for single point clouds
- **Point Cloud Formats**: Support for both ASCII and binary PLY point clouds
  and meshes, XYZ, XYZN, XYZRGB, PCD and PTS point clouds, OBJ, STL, OFF and
  GLTF/GLB meshes
- **Depth to point cloud conversion**: Can convert on the fly depth images to
  point clouds. It has support for tiff, png, pfm, npy and npz files
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

Interpret depth/disparity images as point cloud.
![tifPC](https://github.com/kleinicke/ply-visualizer/releases/download/v1.0.0/disp2pc.gif)

Load two point clouds and switch between them imediatly pressing shift and click
![load-two](https://github.com/kleinicke/ply-visualizer/releases/download/v0.0.14/load2.gif)

## Roadmap

- **Wrong direction of Rotation**: When rotating the point cloud the direction
  is inverted. It's unclear how to fix this.
- **Add eye dome lighting**: Improve perception of uncolored point clouds
- **Drag and Drop**: Add more pc to a given pc using drag and drop instead of
  adding them in an extra window
- **Add new file formats**: Body pose json files for 3d body pose, FBX files can
  contain meshes or animations, Exr files can contain float depth images or
  complete point clouds, gaussian splats
- **Measure distance**: Add option to measure the distance between points
- **Dataset support**: Add images from Middlebury stereo and Eth3d as example
  images
- **Automatic usage of calib files**: calibration files next to the depth images
  can contain all required parameter for a depth to pc conversion. Automatically
  use those for depth images for intrinsics and extrinsics for point clouds
- **Improve npz file interpretation**: These files can have different
  structures. Offer some options to visualize them

## Feature Requests and Issues

If you have use cases that would be helpful for others or find problems, feel
free to suggest them on the
[GitHub repository](https://github.com/kleinicke/ply-visualizer/issues). If you
know how to fix bugs or how to implement certain features, feel free to
contribute. If you provide an example file, I can implement support for it in
the extension.
