# Change Log

All notable changes to the "ply-viewer" extension will be documented in this file.

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