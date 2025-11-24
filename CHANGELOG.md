# Change Log

## [1.4.0] - 2025-11-24

- **Npy point clouds**: Add support for npy point clouds (dimension [...,3])
- **Collapsible File Items**: Added collapse/expand arrows to each point cloud, mesh, pose, and camera entry for cleaner UI organization
- **Resizable Panel**: Main UI panel can now be resized by dragging from the bottom edge
- **Distance Measuring**: Measure the distance between a shift double click selected point and the rotation center
- **24 bit mode**: Can convert 8 bit rgb images into 24 bit depth images to display as a point cloud
- **Name adaptation** Now the extension is called: 3D Point Cloud and Mesh Visualizer (PLY, ...)

## [1.3.0] - 2025-09-16

- Add easier selection of material
- Add support for fx, fy, cx, cy, disp offset, bias and scale and inverse depth support for depth images
- Add support for different camera distortion models for depth to point cloud conversion: Pinhole + OpenCV Distortion, Fisheye + OpenCV Distortion and Fisheye Kannala-Brandt
- Option to load calibration files (experimentally)
- Improve performance (for occluded points, idle state and removing transparency by default)

## [1.2.0] - 2025-08-25

- Add support for pfm depth/disparity predictions
- Add support for npy/npz depth/disparity predictions
- Add support for stl files
- Add support for pcd files (Point Cloud Data format)
- Add support for pts files (Point Cloud format)
- Add support for off files (Object File Format)
- Add support for gltf/glb files (3D model formats)
- Add support for some camera position profiles
- Add support for some body pose estimations
- Easier application of translation, quaternion or angle axis.
- The name of the extension is now: 3D Point Cloud Visualizer (PLY, ...)

## [1.1.0] - 2025-08-11

- Add support for obj files
- Add experimental Arcball camera rotation
- Add experimental pose estimation support
- Improve support for ply mesh files
- Fix gamma correction issues
- Add button toggling fixes

## [1.0.0] - 2025-08-04

- Improve Readme
- Add some tests

## [0.0.14] - 2025-07-23

- **Added Rotation Center Controls**: New "Modify Rotation Center" button in camera panel with coordinate display and editing dialog
- **Enhanced Camera Control Status**: Added visual indicator showing currently active camera control mode (Trackball, Orbit, etc.)
- **Fixed Matrix Formatting**: Ignores all additional symbols when interpreting a matrix, only focusses on the numbers.
- **Improved Camera Rotation Logic**: Fixed camera positioning relative to orbit controls target for stable rotation behavior

## [0.0.13] - 2025-07-18

- Add improved TIF to point cloud support for multiple depth types: Euclidean, Orthogonal, and Disparity
- Remove additional gamma correction
- Improved error messages and TIF processing stability
- Enhanced TIF controls UI with color mapping support

## [0.0.12] - 2025-07-17

- Added TIF to Point Cloud conversion feature
- Support for pinhole and fisheye camera models
- Interactive camera parameter prompts
- Seamless integration with PLY visualization workflow

## [0.0.11] - 2025-07-16

- Added multi-file support for simultaneous PLY visualization
- Implemented file management with visibility controls
- Performance optimization with binary data transfer
- Advanced camera controls and coordinate conventions
- The name of the extension is now PLY Pointcloud Visualizer

## [0.0.1] - 2025-06-29

- Initial release of PLY Visualizer extension
- Support for PLY file visualization using Three.js
- Interactive 3D controls and multiple rendering modes
- Complete PLY parser with ASCII and binary format support

