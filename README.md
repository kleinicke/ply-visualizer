# PLY Visualizer

A Visual Studio Code extension for visualizing PLY (Polygon File Format) files with interactive 3D visualization using Three.js.

## Features

- **3D Visualization**: View PLY files with interactive 3D rendering
- **Multiple Formats**: Support for both ASCII and binary PLY formats
- **Point Cloud Support**: Display point clouds with colors and normals
- **Mesh Support**: Render triangulated meshes with faces
- **Interactive Controls**: 
  - Orbit, zoom, and pan controls
  - Toggle between mesh, wireframe, and point rendering modes
  - Reset camera to fit the model
- **File Information**: Display detailed file statistics and metadata

## Supported PLY Features

- **Vertex Properties**:
  - Position (x, y, z)
  - Colors (red, green, blue, alpha)
  - Normals (nx, ny, nz)
- **Face Properties**:
  - Triangle and polygon faces
  - Automatic triangulation for complex polygons
- **Formats**:
  - ASCII PLY format
  - Binary PLY format (little-endian and big-endian)

## Usage

1. **Automatic Opening**: PLY files will automatically open with the PLY Visualizer when clicked
2. **Manual Opening**: Right-click on a PLY file and select "Open with PLY Visualizer"
3. **Controls**:
   - **Mouse**: Orbit around the model
   - **Scroll**: Zoom in and out
   - **Right-click + drag**: Pan the view
   - **Reset Camera**: Click the button to reset the view
   - **Toggle Wireframe**: Switch between solid and wireframe rendering
   - **Toggle Points**: Switch between mesh and point cloud rendering

## Installation

### From Source

1. Clone this repository
2. Install dependencies: `npm install`
3. Compile the extension: `npm run compile`
4. Open in VS Code and press `F5` to run in a new Extension Development Host window

### Building VSIX Package

```bash
npm install -g vsce
vsce package
```

## Development

### Prerequisites

- Node.js 16 or higher
- Visual Studio Code

### Setup

```bash
git clone <repository-url>
cd ply-visualizer
npm install
```

### Building

```bash
npm run compile
```

### Testing

```bash
npm test
```

### Running in Development

1. Open the project in VS Code
2. Press `F5` to start debugging
3. A new VS Code window will open with the extension loaded
4. Open a PLY file to test the extension

## File Format Support

The extension supports the standard PLY format specification:

### ASCII Format Example
```
ply
format ascii 1.0
element vertex 3
property float x
property float y
property float z
property uchar red
property uchar green
property uchar blue
end_header
0.0 0.0 0.0 255 0 0
1.0 0.0 0.0 0 255 0
0.5 1.0 0.0 0 0 255
```

### Binary Format Support
- Binary little-endian format
- Binary big-endian format
- All standard PLY data types (char, uchar, short, ushort, int, uint, float, double)

## Technical Details

### Architecture

- **Extension Host**: Main extension logic in TypeScript
- **WebView**: Three.js visualization in a VSCode webview
- **PLY Parser**: Custom parser for both ASCII and binary PLY formats
- **Three.js Integration**: 3D rendering with interactive controls

### Performance

- Efficient parsing of large PLY files
- Memory-optimized geometry creation
- Viewport culling for better performance
- Adaptive point size for point clouds

## Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass
6. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- [Three.js](https://threejs.org/) for 3D rendering
- [VSCode Extension API](https://code.visualstudio.com/api) for extension framework
- PLY format specification for file format details 