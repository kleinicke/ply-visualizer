# Change Log

## [1.1.0] - 2025-07-23
Add support for obj files
Add experimental Arcball camera rotation 
Add experimental pose estimation support
Improve support for ply mesh files
Fix 

## [1.0.0] - 2025-07-23
Improve Readme
Add some tests

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

## [0.0.12] 
- Added TIF to Point Cloud conversion feature
- Support for pinhole and fisheye camera models
- Interactive camera parameter prompts
- Seamless integration with PLY visualization workflow

## [0.0.11] - 2024-12-19
- Added multi-file support for simultaneous PLY visualization
- Implemented file management with visibility controls
- Performance optimization with binary data transfer
- Advanced camera controls and coordinate conventions

## [0.0.1]
- Initial release of PLY Visualizer extension
- Support for PLY file visualization using Three.js
- Interactive 3D controls and multiple rendering modes
- Complete PLY parser with ASCII and binary format support 