# Change Log

## [1.9.0] - 2026- (unreleased)

- Add support for animations for GLTF, GLB, FBX, DAE (Collada), 3DS
- Create jetbrains version, standalone tauri app, python, rest and mcp interface
- open remote files
- Provide AI Agents the commands to use the tools
- Much faster loading of non-depth files: text point clouds (XYZ, PTS, ASCII PLY/PCD), LAS/LAZ and multi-scan E57 decode on several threads; STL, OBJ and OFF decode in Rust (large STL/OBJ meshes now load at all); quicker binary PLY/PCD and less work per load in the viewer
- Depth images convert on worker threads inside VS Code too (they ran on the UI thread before): a 26-megapixel TIFF opens in under a second instead of 8-15 s, large TIFFs and ZIP-compressed EXRs decode on several threads, and changing depth settings no longer decodes the file again
- Binary PLY point clouds are decoded while they stream in, using far less memory (a 341 MB cloud: ~1.7 s instead of 4-19 s); ASCII PLY clouds added with "+ Add Point Cloud" use the same fast parser as opened ones
- Align all is about five times faster (pairs run side by side, faster coarse search); each result row gets Fix and Refine buttons, the run reports its duration, Escape cancels it, and the up axis sits next to the align buttons; archive colouring can be cancelled
- Less memory per loaded file: intensity/field colour modes and mesh colours use half the colour memory, and the depth worker caps its decoded-image cache at about 192 MB instead of keeping four full images
- Adding XYZ files with "+ Add Point Cloud" now parses them in Rust like opened ones (the old path built one JavaScript object per point)
- Large binary PLY files are fetched as four byte ranges at once and decoded as they arrive (113 MB: ~0.6 s → ~0.37 s; 341 MB: ~1.3 s); large binary PCD files decode on several threads; PTS files stream in like the other text formats; X3A archives demosaic their camera images faster when colouring
- Changing a depth image's camera settings is faster again: the projection workers keep the image's rows between changes instead of receiving them every time (26 MP: ~0.35 s → ~0.21 s)
- LAS/LAZ/E57 attributes that are whole numbers (classification, return numbers, user data, point source ID, ...) are stored at their natural width instead of as floats: a 1.6M-point LAS keeps 16 MB of attributes instead of 46 MB and opens faster
- Depth images keep less memory: in VS Code the file is read again on the rare occasion it is needed instead of staying in memory while open, and on the standalone page a depth image no longer builds one JavaScript object per point (a 3.7M-point TIFF: 285 MB less memory, opens in ~0.2 s instead of ~0.65 s) and converts on the depth workers, with lens distortion from the dialog applied
- Point clouds with normals keep them at 16 bits instead of 32 (unit normals only; meshes and non-unit normals are unchanged): 47 MB less for 7.9M points, at most 0.00002 off per component
- KITTI .bin scans open on the standalone page again; cancelling one alignment no longer stalls the ones queued behind it
- NumPy (.npy/.npz) depth images convert on the worker in VS Code (they hit a 30 s timeout first); PFM depth images decode in Rust and PFM headers with a comment line open again

## [1.8.0] - 2026-08-28

- Add Kitti's .bin file support
- Add Gaussian Splatting support
- Add unofficial Stonex x3r lidar scanner support, improve e57 support
- Depth images are now decoded only by the Rust/WASM decoder; the geotiff.js fallback is gone. TIFF support gains tiled and planar layouts, sub-byte bit depths (10/12/14-bit), ...
- Add EXR depth images


## [1.7.0] - 2026-07-17

- Internal refactoring - move to svelte
- Speedup for computing point clouds out of depth
- Add double click onto empty region to automatically fit to point cloud
- Color point clouds by any extra PLY scalar property (e.g. confidence, error) via Viridis/Gray colormaps in the Color dropdown
- Add Clip Planes (near / far), Save Screenshot (PNG) and Copy Camera JSON (position/target/up/fov) to the camera tab
- Add LAS/LAZ and E57 file formats
- Finally Inverse Camera Rotation
- Add video mode
- Add distance measurement paths


## [1.6.0] - 2026-06-07

- Visualizing points as round points instead of squares
- Add support for intensity values (for ply, pcd, pts and xyz)
- Speedup during loading of point clouds using rust decoders and strongly modifying loading routines


## [1.5.0] - 2026-05-02

- Fix pts, psd and xyz implementation to support bigger point clouds
- Add Eye-Dome Lighting
- Add brightness sliders for objects and background
- Drop an additional pc using shift plus drag and drop into the scene.

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
- Renamed the extension (that historical name has since been superseded)

## [0.0.1] - 2025-06-29

- Initial release of PLY Visualizer extension
- Support for PLY file visualization using Three.js
- Interactive 3D controls and multiple rendering modes
- Complete PLY parser with ASCII and binary format support
