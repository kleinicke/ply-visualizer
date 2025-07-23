# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Build & Development
```bash
npm run compile          # Build the extension using webpack
npm run watch           # Watch mode for development
npm run vscode:prepublish  # Production build before publishing
```

### Testing & Linting
```bash
npm run test            # Run all tests
npm run lint            # Run ESLint on TypeScript files
npm run pretest         # Compile and lint before testing
```

### Extension Testing
- Use F5 in VS Code to launch Extension Development Host
- Test with sample PLY/XYZ files in the root directory (test_*.ply, test_*.xyz)
- TIF/TIFF files can be tested for depth-to-pointcloud conversion

## Architecture Overview

This is a **VS Code extension** that provides 3D visualization for point cloud files (PLY, XYZ) and depth image conversion (TIF/TIFF) using Three.js.

### Core Components

**Extension Host (Node.js)**
- `src/extension.ts` - Extension activation and command registration
- `src/plyEditorProvider.ts` - Custom editor provider for PLY/XYZ/TIF files
- `src/plyParser.ts` - PLY file format parser (ASCII/binary, little/big endian)

**Webview (Browser Context)**
- `src/webview/main.ts` - Main visualization engine (~5000+ lines)
- `src/webview/tifProcessor.ts` - TIF depth image to point cloud conversion
- `media/` - Contains external dependencies (geotiff.min.js, CSS)

### Key Architectural Patterns

**Dual Build System**: Webpack creates two bundles:
- Extension bundle (Node.js target) - VS Code API integration
- Webview bundle (Web target) - Three.js visualization

**Message Passing**: Extension host and webview communicate via `postMessage/onMessage`:
- Extension → Webview: File data, timing updates, conversion results
- Webview → Extension: Save requests, error handling, progress updates

**Unified File Management**: Single `PLYVisualizer` class manages:
- Multiple point cloud files simultaneously
- Individual transformation matrices per file
- Per-file visibility, colors, point sizes
- TIF conversion state and camera parameters

### 3D Visualization Architecture

**Camera Controls**: Multiple control schemes available:
- Trackball controls (default)
- Orbit controls  
- Inverse trackball (experimental)
- CloudCompare-style controls (for familiar rotation behavior)

**Transformation System**: Each loaded file has its own transformation matrix supporting:
- Direct 4x4 matrix input
- Quaternion rotations (X,Y,Z,W components)
- Angle-axis rotations (axis vector + angle in degrees)
- Quick 90° rotations around cardinal axes

**Rendering Pipeline**: 
- Large files use chunked loading to prevent UI blocking
- Point cloud rendering with configurable point sizes
- Color management: original colors vs assigned colors
- Optional gamma correction for color display

### TIF Processing Workflow

1. **File Detection**: Extension identifies .tif/.tiff files
2. **Data Transfer**: Raw TIF data sent to webview via ArrayBuffer
3. **GeoTIFF Processing**: Uses geotiff.min.js library for TIFF parsing
4. **Camera Parameter Input**: User provides camera model (pinhole/fisheye) and focal length
5. **Depth Conversion**: Converts depth pixels to 3D points using camera intrinsics
6. **Point Cloud Generation**: Creates Three.js geometry for visualization

## File Structure Patterns

**TypeScript Configuration**: 
- Root `tsconfig.json` for extension code
- Separate `src/webview/tsconfig.json` for webview code (different targets)

**Test Organization**:
- Tests mirror source structure: `src/test/` contains test files  
- Mocha-based testing with VS Code test runner integration

**Resource Management**:
- Static assets in `media/` directory
- Compiled output in `out/` directory
- Sample test files in root for development

## Important Development Notes

**WebGL Context**: The webview creates a Three.js WebGL context that must handle:
- Proper cleanup on webview disposal
- Context loss/restore scenarios
- Memory management for large point clouds

**Performance Considerations**:
- Files >1M points use chunked loading (prevents UI freezing)
- Transformation matrices are applied per-frame efficiently
- Camera controls optimized for large datasets

**Matrix Conventions**: The transformation system supports multiple matrix input formats but internally uses Three.js column-major matrices. The UI displays matrices in row-major format for user friendliness.

**Camera Rotation Issue**: There's a known issue with rotation direction being inverted compared to CloudCompare. The codebase includes experimental fixes for this in the camera control system.

## Extension Points

**Custom Editor Registration**: Uses VS Code's `registerCustomEditorProvider` for file type associations (PLY, XYZ, TIF, TIFF).

**Command Integration**: Provides context menu commands for file conversion and multi-file opening.

**Progress Reporting**: Uses VS Code's progress API for long-running operations like large file loading and TIF conversion.