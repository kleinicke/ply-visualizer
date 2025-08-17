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
npm run test            # Run unit tests (Mocha-based)
npm run lint            # Run ESLint on TypeScript files
npm run pretest         # Compile and lint before testing
npm run test:ui         # Run UI tests (VS Code Extension Tester)
npm run test:all        # Run both unit and UI tests
npm run test:stl        # Quick STL functionality validation and checklist
```

### Extension Testing
- Use **F5** in VS Code to launch Extension Development Host
- Test files organized by format in `testfiles/` subdirectories:
  - `testfiles/stl/` - STL triangle mesh files (ASCII/binary)
  - `testfiles/ply/` - PLY point cloud files and XYZ coordinates
  - `testfiles/np/` - NPY/NPZ depth/disparity arrays
  - `testfiles/tif/` - TIF/TIFF depth images
  - `testfiles/png/` - PNG depth images
  - `testfiles/pfm/` - PFM depth files
  - `testfiles/json/` - JSON pose/keypoint files
  - `testfiles/obj/` - OBJ wireframe files (if present)
  - Root directory - Large test PLY files for performance testing

## Architecture Overview

This is a **VS Code extension** that provides 3D visualization for point clouds, triangle meshes, and depth-to-pointcloud conversion using Three.js. Supports 10+ file formats including PLY, XYZ, OBJ, STL, TIF, NPY, and JSON pose data.

### Core Components

**Extension Host (Node.js)**
- `src/extension.ts` - Extension activation and command registration
- `src/plyEditorProvider.ts` - Custom editor provider routing by file extension
- Format-specific parsers:
  - `src/plyParser.ts` - PLY files (ASCII/binary, little/big endian)
  - `src/objParser.ts` - OBJ wireframes with MTL material support
  - `src/stlParser.ts` - STL triangle meshes (ASCII/binary with color support)
  - `src/mtlParser.ts` - MTL material files for OBJ color data

**Webview (Browser Context)**
- `src/webview/main.ts` - Main visualization engine (~9000+ lines)
- `src/webview/tifProcessor.ts` - TIF depth image to point cloud conversion
- `src/webview/depth/` - Depth processing pipeline:
  - `DepthRegistry.ts` - Format detection and reader selection
  - `DepthProjector.ts` - 3D projection with camera models (pinhole/fisheye)
  - `readers/` - Format-specific depth readers (TIF, PFM, NPY, PNG)
- `media/` - External dependencies (geotiff.min.js, CSS)

### Key Architectural Patterns

**Dual Build System**: Webpack creates two separate bundles:
- Extension bundle (Node.js target) - VS Code API integration, file parsing
- Webview bundle (Web target) - Three.js visualization, user interaction
- Separate TypeScript configs prevent dependency conflicts

**Message Passing Architecture**: Extension host and webview communicate via `postMessage/onMessage`:
- Extension → Webview: Parsed file data, timing updates, conversion parameters
- Webview → Extension: Save requests, error handling, progress updates, camera parameter requests

**Unified File Management**: Single `PLYVisualizer` class in webview manages:
- Multiple files simultaneously (point clouds, meshes, wireframes)
- Individual transformation matrices per file
- Per-file visibility, colors, point sizes, rendering modes
- Camera state and control schemes

**Format Detection Pipeline**: `plyEditorProvider.ts` routes files by extension:
1. File extension detection (`.ply`, `.stl`, `.obj`, `.tif`, etc.)
2. Parser selection and instantiation
3. Data parsing in extension host
4. Structured data transfer to webview
5. 3D visualization rendering

### 3D Visualization Architecture

**Camera Control Systems**:
- Trackball controls (default) - Intuitive rotation around target
- Orbit controls - Constrained orbital movement
- Inverse trackball (experimental) - Reversed rotation direction
- CloudCompare-style controls - Familiar CAD software behavior

**Transformation System**: Each file has independent transformation matrix supporting:
- Direct 4x4 matrix input (column-major Three.js format)
- Quaternion rotations (X,Y,Z,W components)
- Angle-axis rotations (axis vector + angle in degrees)
- Quick 90° rotations around cardinal axes
- UI displays matrices in row-major format for user friendliness

**Rendering Pipeline Optimization**:
- Large files (>1M points) use chunked loading to prevent UI blocking
- Vertex deduplication for STL triangle meshes
- Point cloud rendering with configurable point sizes and gamma correction
- Triangle mesh rendering with proper lighting using surface normals
- Multiple simultaneous file rendering with independent controls

### Depth-to-Point Cloud Pipeline

**Format Support**: TIF/TIFF, PFM, NPY/NPZ, PNG depth/disparity images
**Processing Flow**:
1. **File Detection**: Extension identifies depth image formats
2. **Data Transfer**: Raw image data sent to webview via ArrayBuffer
3. **Format Processing**: Specialized readers handle format-specific parsing
4. **Camera Parameter Collection**: User provides intrinsic parameters via UI
5. **3D Projection**: DepthProjector converts pixels to 3D coordinates
6. **Point Cloud Generation**: Creates Three.js geometry for visualization

**Camera Models Supported**:
- **Pinhole**: Standard perspective projection
- **Fisheye**: Distortion correction for wide-angle cameras
- **Coordinate Systems**: OpenGL (+Y up) and OpenCV (+Y down) conventions

## File Structure Patterns

**TypeScript Configuration**:
- Root `tsconfig.json` - Extension host compilation (Node.js target)
- `src/webview/tsconfig.json` - Webview compilation (DOM/ES6 target)
- Webpack enforces separation and prevents dependency conflicts

**Test Organization**:
- `src/test/suite/` - Unit tests (Mocha framework)
- `ui-tests/specs/` - UI integration tests (VS Code Extension Tester)
- Test files organized by format in `testfiles/` subdirectories:
  - `testfiles/ply/` - PLY files for parser and integration tests
  - `testfiles/np/` - NPY/NPZ files for depth processing tests
  - `testfiles/stl/` - STL files for triangle mesh tests
  - Other format-specific directories with corresponding test files

**Resource Management**:
- `media/` - External JavaScript libraries and CSS
- `out/` - Compiled extension and webview bundles
- `testfiles/` - Organized test files by format type

## Important Development Notes

**WebGL Context Management**: The webview creates a Three.js WebGL context requiring:
- Proper cleanup on webview disposal to prevent memory leaks
- Context loss/restore handling for robust operation
- Memory management for large datasets (5M+ points supported)

**Performance Optimizations**:
- Files >1M points trigger chunked loading with progress indicators
- Transformation matrices applied per-frame using efficient Three.js operations
- Camera controls optimized for large datasets with responsive interaction

**Parser Architecture**: Each format has dedicated parser with consistent interface:
- Input: `Uint8Array` file data + optional timing callback
- Output: Structured data object with metadata (vertex/face counts, colors, normals)
- Error handling: Graceful degradation with informative error messages

**Matrix Conventions**: 
- Internal: Three.js column-major matrices for WebGL compatibility
- UI Display: Row-major format for user familiarity
- Input Support: Multiple formats (4x4, quaternion, angle-axis)

**Known Issues**:
- Camera rotation direction inverted compared to CloudCompare (experimental fixes available)
- Large coordinate values require "Fit to View" (F key) after loading

## Extension Points

**Custom Editor Registration**: Uses `vscode.registerCustomEditorProvider` for file associations:
- Point clouds: `.ply`, `.xyz`
- Triangle meshes: `.obj`, `.stl`
- Depth images: `.tif`, `.tiff`, `.pfm`, `.npy`, `.npz`, `.png`
- Pose data: `.json`

**Command Integration**: Context menu commands for:
- File opening and multi-file loading
- Depth-to-point cloud conversion with parameter collection
- Format-specific processing options

**Progress Reporting**: Uses VS Code progress API for:
- Large file loading with real-time updates
- Depth image conversion with parameter collection workflow
- Multi-file batch processing

## Testing Strategy

**Unit Tests**: Mocha-based tests in `src/test/suite/` covering:
- Parser functionality for all supported formats
- File format detection and validation
- Mathematical operations (transformations, projections)

**UI Tests**: VS Code Extension Tester framework in `ui-tests/` testing:
- File opening workflows and context menu integration
- Webview rendering and user interaction
- Edge cases (empty files, large coordinates, malformed data)

**Manual Testing Workflow**:
1. Press F5 → Extension Development Host opens
2. Navigate to format-specific `testfiles/` subdirectories:
   - `testfiles/stl/` for triangle mesh testing
   - `testfiles/ply/` for point cloud testing
   - `testfiles/np/` for depth-to-pointcloud conversion
3. Right-click test files → "Open with PLY Visualizer"
4. Verify 3D rendering and interaction controls
5. Test edge cases and performance with large files in root directory