# Change Log

All notable changes to the "ply-viewer" extension will be documented in this file.

## [0.0.12] - 2024-12-21

### Added
- **TIF to Point Cloud Conversion**: New feature to convert TIF/TIFF depth images to 3D point clouds
  - Support for both pinhole and fisheye camera models
  - Interactive user prompts for camera type and focal length selection
  - Automatic principal point calculation (set to image center)
  - Real-time depth image processing using GeoTIFF library
  - Seamless integration with existing PLY visualization workflow
  - Support for both euclidean depth (pinhole) and equidistant fisheye projection
  - Color-coded point clouds based on depth values

### Enhanced
- **File Format Support**: Extended custom editor to handle TIF/TIFF files
- **Command Integration**: Added dedicated "Convert TIF to Point Cloud" command
- **User Experience**: Streamlined workflow with progress indicators and error handling
- **WebView Processing**: Added client-side TIF processing for better performance

### Technical Improvements
- **GeoTIFF Integration**: Integrated GeoTIFF.js library for robust TIF file parsing
- **Camera Model Implementation**: Accurate implementation of pinhole and fisheye projection models
- **Memory Efficient**: Client-side processing reduces server load
- **Error Handling**: Comprehensive error handling with user-friendly messages
- **Type Safety**: Full TypeScript implementation with proper type definitions

## [0.0.11] - 2024-12-19

### Added
- **Multi-file Support**: Load and visualize multiple PLY files simultaneously
- **File Management**: Individual file visibility controls and removal options
- **Performance Optimization**: Binary data transfer for large files
- **Advanced Camera Controls**: Multiple control schemes and camera conventions

### Enhanced
- **UI/UX**: Tabbed interface with organized controls
- **Keyboard Shortcuts**: Comprehensive keyboard navigation
- **Color Management**: Per-file color schemes and original color preservation
- **Camera System**: Support for different coordinate conventions (OpenCV, Blender)

### Technical Improvements
- **Binary PLY Support**: Optimized parsing for binary PLY files
- **Chunked Loading**: Progressive loading for very large files
- **Memory Management**: Efficient TypedArray usage
- **WebView Architecture**: Modern message-based communication

## [0.0.1] - 2024-06-22

### Added
- Initial release of PLY Visualizer extension
- Support for PLY file visualization using Three.js
- Custom editor for `.ply` files
- Interactive 3D controls (orbit, zoom, pan)
- Support for both ASCII and binary PLY formats
- Point cloud and mesh rendering
- Vertex colors and normals support
- Wireframe and point rendering modes
- File information panel
- Automatic camera fitting to model bounds

### Features
- **PLY Parser**: Complete parser for PLY file format
  - ASCII format support
  - Binary format support (little-endian and big-endian)
  - Multiple data types (char, uchar, short, ushort, int, uint, float, double)
  - Vertex properties (position, colors, normals)
  - Face properties with automatic triangulation

- **3D Visualization**: 
  - Three.js-based WebView rendering
  - Interactive OrbitControls
  - Multiple rendering modes (solid, wireframe, points)
  - Automatic lighting setup
  - Responsive design

- **User Interface**:
  - Clean, VSCode-integrated interface
  - File statistics and metadata display
  - Control buttons for interaction
  - Error handling and loading states

### Technical Details
- TypeScript implementation
- WebView-based architecture
- Custom PLY parser
- Three.js integration
- Comprehensive test suite
- ESLint configuration
- Build system with TypeScript compilation 