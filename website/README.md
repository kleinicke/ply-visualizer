# 3D Point Cloud Visualizer - Web Version

A standalone web application for visualizing 3D point clouds and meshes, adapted
from the VS Code PLY Visualizer extension.

## Features

- **Multiple File Format Support**: PLY, XYZ, OBJ, STL, PCD, PTS, OFF, GLTF/GLB
- **3D Visualization**: Interactive 3D rendering using Three.js
- **File Management**: Load multiple files simultaneously with individual
  controls
- **Camera Controls**: Trackball, Orbit, and custom control schemes
- **Rendering Modes**: Points, wireframe, solid, and normals visualization
- **Real-time Performance**: FPS monitoring and GPU timing
- **Drag & Drop**: Easy file loading via drag and drop interface

## Getting Started

### Development

1. Install dependencies:

```bash
npm install
```

2. Start development server:

```bash
npm start
```

3. Open your browser to `http://localhost:8080`

### Production Build

```bash
npm run build
```

The built files will be in the `dist/` directory, ready for deployment to any
web server.

## Usage

1. **Load Files**: Use the "Choose Files" button or drag and drop files into the
   designated area
2. **Navigate**: Use mouse controls to rotate, zoom, and pan the 3D view
3. **Adjust Settings**: Use the sidebar controls to modify rendering options,
   point sizes, and visibility
4. **Multiple Files**: Load multiple files to compare or visualize them together

## File Format Support

- **PLY**: Polygon File Format (ASCII/Binary)
- **XYZ**: Simple point cloud format
- **OBJ**: Wavefront OBJ mesh files
- **STL**: Stereolithography files (ASCII/Binary)
- **PCD**: Point Cloud Data format
- **PTS**: Point cloud format
- **OFF**: Object File Format
- **GLTF/GLB**: Graphics Library Transmission Format

## Controls

- **Mouse**: Rotate view
- **Scroll**: Zoom in/out
- **F Key**: Fit all objects to view
- **R Key**: Reset camera to default position

## Architecture

This web version is built from the webview component of the VS Code extension,
with the following key changes:

- **Browser File Loading**: Uses HTML5 File API instead of VS Code file system
- **Standalone Operation**: No VS Code API dependencies
- **Unified Build**: Single webpack bundle including all parsers and
  dependencies
- **Direct Parser Integration**: File parsers run directly in the browser

## Development Notes

- Built with TypeScript and Three.js
- Uses webpack for bundling
- Includes all file parsers from the original extension
- Maintains the same 3D visualization engine and UI controls
