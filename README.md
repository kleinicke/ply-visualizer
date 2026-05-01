# 3D Point Cloud and Mesh Visualizer (PLY, ...)

This extension visualizes:

- **Point Clouds** in the formats: ASCII and binary PLY files, XYZ, XYZN,
  XYZRGB, PCD, PTS and NPY
- **Meshes** in the formats: ASCII and binary PLY files, OBJ, STL, OFF and
  GLTF/GLB
- **Depth and disparity images** are transformed on the fly to point clouds for
  the formats: TIFF, PNG, PFM, NPY and NPZ

New features are added frequently. You can simply request features that support
your workflow or new file formats on
[GitHub](https://github.com/kleinicke/ply-visualizer/issues).

## Features

Interpret depth/disparity images as point clouds
![tifPC](https://github.com/kleinicke/ply-visualizer/releases/download/v1.0.0/disp2pc.gif)

Use Eye-Dome Lighting
![eyeDome](https://github.com/kleinicke/ply-visualizer/releases/download/v1.0.0/EyeDome.gif)

Load two point clouds and switch between them immediately by pressing Shift and
clicking
![load-two](https://github.com/kleinicke/ply-visualizer/releases/download/v0.0.14/load2.gif)

- **Compare Multiple Point Clouds**: Multiple point clouds can be loaded in the
  same view and activated and deactivated independently
- **Fast Loading of Big Point Clouds**: Even point clouds with 5 million points
  load in around a second
- **Rotation of points**: Apply rotation matrices for single point clouds
- **Depth to point cloud settings**: Allows setting the fx, fy, cx, cy,
  different camera distortion models, mono depth scale and bias parameters, PNG
  int16 scale parameters, disparity offset...
- **Pose estimations**: Support is currently in development for 3D pose
  estimations in JSON files
- **Buttons for meshes**: Easily activate wireframe, mesh, points and normals
- **Corresponding website**: All features can also be used without VS Code using
  the static website https://f-kleinicke.de
- **Frame rate visualization**: Shows the current frame rate. When the point
  cloud is not moving, no more frames are generated to save power.
  Transparencies are also ignored by default to save power
- **Measure distance**: Shift-double-click measures the distance between the
  rotation center and the selected point
- **Brightness correction**: Use Eye-Dome Lighting or simple brightness
  correction
- **Eye-Dome Lighting**: Improve perception of uncolored point clouds
- **Trackpad and mouse friendly**: Simply change the rotation point and your
  position by double-clicking a point in the cloud. Additionally, the position
  can be changed while keeping the same rotation by right-clicking or holding
  Shift. It is also possible to manually enter the position of the camera, the
  rotation center and the angle.

## Roadmap

- **Wrong direction of rotation**: When rotating the point cloud, the direction
  is inverted. It's unclear how to fix this.
- **Drag and Drop**: Add more point clouds to a given point cloud using drag and
  drop instead of adding them in an extra window
- **Add new file formats**: Body pose JSON files for 3D body pose, FBX files can
  contain meshes or animations, EXR files can contain float depth images or
  complete point clouds, gaussian splats
- **Dataset support**: Add images from Middlebury stereo and ETH3D as example
  images
- **Automatic usage of calibration files**: extrinsics/intrinsics files next to
  the depth images can contain all required parameters for a depth to point
  cloud conversion. Automatically use those for depth images for intrinsics and
  extrinsics for point clouds
- **Crashes for too many points**: After loading multiple point clouds in
  multiple files in parallel, it crashes, rendering all views with this
  extension gray.

## Feature Requests and Issues

If you have use cases that would be helpful for others or find problems, feel
free to suggest them on the
[GitHub repository](https://github.com/kleinicke/ply-visualizer/issues). If you
know how to fix bugs or how to implement certain features, feel free to
contribute. If you provide an example file, I can implement support for it in
the extension.

## Required structures of certain file formats

NPY files:

- As depth image: [X,Y]
- As point cloud: [...,3] with the three values X,Y,Z
