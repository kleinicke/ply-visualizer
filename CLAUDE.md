# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

## Development Commands

### Build & Development

```bash
npm run compile          # Build the extension using webpack
npm run watch           # Watch mode for development
npm run vscode:prepublish  # Production build before publishing
npm run clean           # Clean output directory
npm run compile:all     # Compile both extension and tests
```

### Testing & Linting

```bash
npm run test            # Run unit tests (Mocha-based)
npm run lint            # Run ESLint on TypeScript files
npm run pretest         # Compile and lint before testing
npm run test:ui         # Run UI tests (VS Code Extension Tester)
npm run test:all        # Run both unit and UI tests
npm run test:stl        # Quick STL functionality validation and checklist
npm run test:coverage   # Run tests with coverage analysis
npm run coverage        # Generate coverage report
```

### Code Quality & Formatting

```bash
npm run format          # Format code with Prettier
npm run format:check    # Check code formatting
npx lint-staged         # Run linting on staged files (via git hooks)
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

### Development Workflow

**For Core Functionality Changes** (parsers, visualization, controls):

1. Work in `engine/src/` directory - this is the shared codebase
2. Fast feedback loop: `cd engine && npm run dev` (or `npm test` for
   Playwright) - no need to launch VS Code for engine-only logic
3. Before shipping, verify in the real target: Press **F5** to launch Extension
   Development Host
4. Changes in `engine/src/` automatically affect both targets

**For VS Code-Specific Features** (commands, menus, file associations):

1. Work in `src/` directory for extension host integration
2. Use `npm run watch` for automatic rebuilding during development
3. Test with **F5** Extension Development Host

## Architecture Overview

**The VS Code extension is the primary product.** This project is one shared
visualization engine (`engine/src/`) with two thin hosts:

1. **VS Code Extension** (`src/` folder) - the main target; integrates the
   engine into a custom editor via a webview
2. **Standalone page** (`engine/` folder, deployed at https://f-kleinicke.de)
   - a thin harness around the same engine bundle. It is not a second product to
     feature-match the extension; its value is (a) a public demo/embed and (b) a
     much faster test surface than the VS Code host - Playwright against a
     browser page skips launching Electron/VS Code entirely.

**Key Architectural Principle**: The `engine/src/` directory contains all core
visualization functionality (parsers, renderers, controls, depth processing)
that is shared between both targets. The `src/` directory contains only VS
Code-specific integration code (commands, custom editor registration, webview
wiring) - it should stay thin and delegate to `engine/src/`.

**Svelte migration (Phases 0-6 done)**: The webview UI panel layer (file list,
settings panels, dialogs, tab navigation) has been migrated to Svelte 5,
in-place, one panel at a time — see
[`docs/SVELTE_MIGRATION_PLAN.md`](docs/SVELTE_MIGRATION_PLAN.md) for what moved
where, two intentionally-deferred follow-ups, and the rationale. New UI work in
the webview should be a Svelte component under `engine/src/components/` reading
from `engine/src/state/*.svelte.{ts,js}`, not a new HTML-string generator. Every
phase's exit criterion included an F5 Extension Development Host check, because
the extension must keep working perfectly throughout — the standalone page is a
faster iteration surface, not the target to optimize for.

### Project Structure

```
├── src/                     # VS Code extension-specific files
│   ├── extension.ts         # Extension activation & VS Code API integration
│   ├── pointCloudEditorProvider.ts  # Custom editor registration
│   └── *Parser.ts          # Lightweight parser wrappers for extension host
├── engine/                  # Shared visualization engine + standalone page host
│   ├── src/                # Core visualization engine (shared code)
│   │   ├── main.ts         # Main 3D visualization engine (~4,350 lines - Svelte migration Phases 0-6 done)
│   │   ├── fileHandler.ts  # Shared file handling logic (USE THIS!)
│   │   ├── controls.ts     # Camera control systems (USE THIS!)
│   │   ├── interfaces.ts   # Shared type definitions
│   │   ├── parsers/        # Complete format parsers (ADD NEW PARSERS HERE!)
│   │   │   ├── plyParser.ts
│   │   │   ├── objParser.ts
│   │   │   ├── stlParser.ts
│   │   │   └── ...
│   │   ├── depth/          # Depth-to-pointcloud processing (ADD DEPTH FEATURES HERE!)
│   │   │   ├── DepthRegistry.ts
│   │   │   ├── DepthProjector.ts
│   │   │   ├── readers/    # Format-specific readers (ADD NEW READERS HERE!)
│   │   │   └── ...
│   │   ├── themes/         # UI themes and styling (ADD THEME FEATURES HERE!)
│   │   │   ├── darkModern.ts
│   │   │   └── ...
│   │   ├── ui/             # UI generation modules
│   │   │   ├── dialogs.ts  # escapeHtml/addTooltipsToTruncatedFilenames only -
│   │   │   │                # modal dialogs are components/Modal.svelte + friends
│   │   │   └── ...
│   │   └── utils/          # Utility modules (matrix.ts, perfLog.ts exist; add more here)
│   ├── test/               # Playwright tests - the fast engine test surface
│   ├── index.html          # Standalone page entry point (SINGLE SOURCE OF TRUTH!)
│   └── webpack.config.js   # Engine-specific build configuration
├── media/                  # Shared static assets (CSS, external libraries)
└── testfiles/             # Test data organized by format type
```

This architecture enables:

- **Code Reuse**: Core functionality written once, used in both contexts
- **Fast Testing**: The engine can be developed and tested standalone via
  Playwright, without booting VS Code/Electron
- **VS Code Integration**: Extension provides native VS Code experience with
  same features

### Core Components

**Extension Host (Node.js)**

- `src/extension.ts` - Extension activation and command registration
- `src/pointCloudEditorProvider.ts` - Custom editor provider routing by file
  extension
- Format-specific parsers:
  - `src/plyParser.ts` - PLY files (ASCII/binary, little/big endian)
  - `src/objParser.ts` - OBJ wireframes with MTL material support
  - `src/stlParser.ts` - STL triangle meshes (ASCII/binary with color support)
  - `src/mtlParser.ts` - MTL material files for OBJ color data

**Webview (Browser Context)**

- `engine/src/main.ts` - Main visualization engine (~4,350 lines - Svelte
  migration Phases 0-6 done)
- `engine/src/depth/` - Depth processing pipeline:
  - `DepthRegistry.ts` - Format detection and reader selection
  - `DepthProjector.ts` - 3D projection with camera models (pinhole/fisheye)
  - `readers/` - Format-specific depth readers (TIF, PFM, NPY, PNG)
- `engine/src/parsers/` - Format-specific parsers (PLY, OBJ, STL, etc.)
- `engine/src/controls.ts` - Camera control systems
- `engine/src/themes/` - Color themes and UI styling
- `media/` - External dependencies (geotiff.min.js, CSS)

### Key Architectural Patterns

**Dual Build System**: Webpack creates separate bundles for different targets:

1. **Extension Bundle** (Node.js target):
   - Entry: `src/extension.ts`
   - Purpose: VS Code API integration, file I/O, command registration
   - Contains lightweight parsers that delegate core parsing to webview

2. **Webview Bundle** (Web target):
   - Entry: `engine/src/main.ts`
   - Purpose: 3D visualization, user interaction, core functionality
   - Contains complete parsers, rendering engine, controls, themes
   - Same bundle used for both the VS Code webview and the standalone page

3. **Shared Resources**:
   - `media/` directory assets accessible to both targets
   - Webpack alias ensures single Three.js instance across bundles
   - Separate TypeScript configs prevent dependency conflicts

**Message Passing Architecture**: Extension host and webview communicate via
`postMessage/onMessage`:

- Extension → Webview: Parsed file data, timing updates, conversion parameters
- Webview → Extension: Save requests, error handling, progress updates, camera
  parameter requests

**Unified File Management**: Single `SpatialVisualizer` class in webview
manages:

- Multiple files simultaneously (point clouds, meshes, wireframes)
- Individual transformation matrices per file
- Per-file visibility, colors, point sizes, rendering modes
- Camera state and control schemes

**Format Detection Pipeline**: `pointCloudEditorProvider.ts` routes files by
extension:

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

**Transformation System**: Each file has independent transformation matrix
supporting:

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
- `engine/src/tsconfig.json` - Webview compilation (DOM/ES6 target)
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
- `engine/` - Webview source code and assets
- `testfiles/` - Organized test files by format type

**Git Hooks & Code Quality**:

- `.husky/pre-commit` - Runs lint-staged on git commits
- `lint-staged` configuration in package.json for automatic formatting and
  linting
- Coverage target reported via c8 and the custom analyzer (80% minimum)

## Critical Coding Guidelines

### Preventing Code Bloat in main.ts

**IMPORTANT**: `engine/src/main.ts` was **15,576 lines (603KB)**, went down to
**~6,300 lines** after a plain-TS extraction pass (~30 commits, each moving a
cohesive cluster of methods into its own module behind a `XyzHost` interface +
thin delegating wrapper), and is now **~4,350 lines** after the Svelte migration
(Phases 0-6, see git history on `claude/library-refactor-svelte-a0nnim` and
[`docs/SVELTE_MIGRATION_PLAN.md`](docs/SVELTE_MIGRATION_PLAN.md) for what moved
where). `updateFileList()` (was ~1,600 lines) is now 3 lines - the file list
rendering + its ~70 `addEventListener` calls became
`FileList.svelte`/`FileItem.svelte`/`DepthSettingsPanel.svelte`. The Controls/
Camera/Info tab button grids, all modal dialogs, and the tab-navigation shell
are Svelte components too. What's left in main.ts is core visualization logic
(Three.js scene/render/materials) plus thin delegating wrappers to the
already-extracted modules - see the migration plan's "Deferred follow-ups"
section for the two remaining DOM-heavy pieces (`#loading` overlay,
`depth/panelState.ts`'s DOM-scrape architecture) intentionally left alone. To
prevent regrowth going forward:

**DO:**

- ✅ **Move code OUT of main.ts** - Always prefer existing appropriate files
  over adding to main.ts
- ✅ **Use existing modular directories first**: Check if your code fits in
  `engine/src/parsers/`, `engine/src/depth/`, `engine/src/themes/`,
  `engine/src/controls.ts`, `engine/src/fileHandler.ts`
- ✅ **Add new parsers** in `engine/src/parsers/` directory (follow existing
  parser patterns)
- ✅ **Add new depth readers** in `engine/src/depth/readers/` (implement reader
  interface)
- ✅ **Add camera/control features** to `engine/src/controls.ts` (already
  modular)
- ✅ **Add file handling logic** to `engine/src/fileHandler.ts` (already shared)
- ✅ **Only create NEW files** if no appropriate existing file exists (e.g., new
  `engine/src/ui/` or `engine/src/utils/` modules)

**DON'T:**

- ❌ **Never add new methods** to the `PointCloudVisualizer` class unless
  absolutely necessary
- ❌ **Never add large HTML generation code** inline - extract to functions or
  templates
- ❌ **Never duplicate code** between main.ts and other files
- ❌ **Avoid adding utility functions** to main.ts - check if they fit in
  existing modules first

**Why This Matters:**

- Previous refactoring attempts (5+ abandoned branches) have failed due to tight
  coupling
- The `PointCloudVisualizer` class has 231 private methods and ~80 state
  variables
- AI-assisted development tends to add code to existing files rather than
  creating new ones
- File will become unmaintainable if it continues growing at current rate (~24
  commits in 3 months)

**Single Source of Truth:**

- `engine/index.html` is the **canonical UI definition** for both the standalone
  page and the VS Code extension
- `src/pointCloudEditorProvider.ts` reads and modifies this HTML at runtime
- **Never duplicate HTML** between these files - modify index.html only

### Code Organization Strategy

**Decision Tree for Adding Code:**

1. **Is it parser-related?** → Add to existing file in `engine/src/parsers/` or
   create new parser following pattern
2. **Is it depth/camera-related?** → Add to `engine/src/depth/` directory
   (DepthProjector, readers, etc.)
3. **Is it camera controls?** → Add to `engine/src/controls.ts` (already
   modular)
4. **Is it file detection/handling?** → Add to `engine/src/fileHandler.ts`
   (already shared)
5. **Is it theme-related?** → Add to `engine/src/themes/` directory
6. **Is it UI generation?** → Create in `engine/src/ui/` directory (new module)
7. **Is it a utility function?** → Create in `engine/src/utils/` directory (new
   module)
8. **Is it core visualization logic?** → Only then consider adding to main.ts
   (last resort)

**For New Features - Prioritize Existing Files:**

1. **First**: Look for existing appropriate file (parsers/, depth/, controls.ts,
   fileHandler.ts, themes/)
2. **Second**: If no fit, create new file in appropriate directory
3. **Last resort**: Add to main.ts only if it's core visualization logic that
   can't be separated

**Example - Good Pattern:**

```typescript
// engine/src/ui/transformDialog.ts
export function createTransformDialog(fileData: SpatialData): string {
  return `<div class="transform-dialog">...</div>`;
}

// engine/src/main.ts
import { createTransformDialog } from './ui/transformDialog';
// Use it without defining inline
```

**Example - Bad Pattern:**

```typescript
// engine/src/main.ts
private showTransformDialog() {
  const html = `<div>...</div>`; // 200 lines of HTML inline
  dialog.innerHTML = html;
}
```

### Proposed Future Structure (Target State)

The original goal here was "reduce main.ts to ~2,000 lines by extracting
everything into plain-TS modules." That goal is **superseded** by the Svelte
migration plan below — the remaining bulk in main.ts is DOM-manipulation code
(HTML-string building, `addEventListener` wiring) that gets **rewritten as
Svelte components**, not relocated as plain-TS modules behind a Host interface.
Extracting it first with the old pattern would be thrown-away work. See
[`docs/SVELTE_MIGRATION_PLAN.md`](docs/SVELTE_MIGRATION_PLAN.md) for the full
phased plan. Current structure:

```
engine/src/
├── main.ts                    # Coordinator - shrinking, UI parts move to Svelte components (not plain-TS modules)
├── fileHandler.ts             # File detection/handling (EXISTS - use it!)
├── controls.ts                # Camera controls (EXISTS - use it!)
├── interfaces.ts              # Type definitions (EXISTS)
│
├── parsers/                   # Format parsers (EXISTS - add new ones here!)
│   ├── plyParser.ts
│   ├── objParser.ts
│   ├── stlParser.ts
│   └── ...
│
├── depth/                     # Depth processing (EXISTS - extend here!)
│   ├── DepthRegistry.ts
│   ├── DepthProjector.ts
│   ├── readers/
│   └── ...
│
├── themes/                    # Themes (EXISTS - extend here!)
│   ├── darkModern.ts
│   └── ...
│
├── ui/                        # UI generators (EXISTS)
│   └── dialogs.ts            # escapeHtml/addTooltipsToTruncatedFilenames only -
│                              # the modal shell + dialog templates moved to
│                              # components/Modal.svelte + friends in Phase 5.
│
├── state/                     # Svelte runes stores (EXISTS - Phase 1, done)
│   ├── files.svelte.js        # File entries: visibility, color mode, per-file settings,
│   │                           # renderTick/statsTick (drive FileList.svelte/Stats.svelte)
│   ├── depthSettings.svelte.js # liveUpdateFileIndices (DOM-scrape architecture kept
│   │                           # otherwise - see migration plan's "Deferred follow-ups")
│   ├── ui.svelte.ts           # Loading/error/status, active tab, sequence-mode state
│   └── viewer.svelte.js       # Control scheme, camera convention, EDL, brightness,
│                               # lighting mode, camera FOV/position/rotation text
│
├── components/                 # Svelte components (EXISTS - Phases 2-6, done)
│   ├── FileList.svelte / FileItem.svelte / DepthSettingsPanel.svelte
│   ├── CalibrationSection.svelte / TransformSection.svelte
│   ├── ControlsTabTop.svelte / ControlsTabBottom.svelte / CameraControlsPanel.svelte
│   ├── Stats.svelte / TabNav.svelte
│   ├── ErrorOverlay.svelte / WelcomeMessage.svelte / PerformanceStats.svelte /
│   │   SequenceControls.svelte
│   └── Modal.svelte / VectorInputDialog.svelte / CameraVectorDialog.svelte /
│       DepthCameraParamsDialog.svelte
│
├── visualization/             # 3D rendering (PROPOSED - independent of Svelte, can proceed in parallel)
│   ├── SceneManager.ts       # Scene setup/management
│   ├── MeshBuilder.ts        # Mesh creation
│   ├── PointCloudRenderer.ts # Point cloud rendering
│   └── LightingManager.ts    # Lighting setup
│
└── utils/                     # Utilities (STARTED)
    ├── matrix.ts             # Matrix/transform helpers (EXISTS)
    ├── perfLog.ts            # Perf timing helpers (EXISTS)
    ├── math.ts               # Math/geometry helpers (proposed)
    └── three.ts              # Three.js helpers (proposed)
```

**Migration Strategy:**

- ✅ **main.ts extraction pass** (Done): ~30 commits moved cohesive,
  non-UI-string-building logic (parsers glue, depth pipeline, pose/camera math,
  transform dialogs, binary data handlers, etc.) out of main.ts into modules.
  main.ts went from 15,576 → ~6,300 lines this way.
- ✅ **Svelte Phase 0** (Done): Tooling — Svelte added to the webview webpack
  build only.
- ✅ **Svelte Phase 1** (Done): State layer (`state/` stores).
- ✅ **Svelte Phases 2-6** (Done): Leaf islands → file list → controls/camera/
  info tabs → dialogs → consolidate shell. main.ts: ~6,300 → ~4,350 lines this
  way. Full detail, including two intentionally-deferred items (`#loading`
  overlay, `depth/panelState.ts`'s DOM-scrape architecture), in
  [`docs/SVELTE_MIGRATION_PLAN.md`](docs/SVELTE_MIGRATION_PLAN.md).
- ⏳ **Independent, in parallel, not started**: Extract rendering logic to
  `visualization/` modules (plain TS, not Svelte — this is the other side of the
  store boundary).

**Note**: Don't attempt big-bang refactoring! Previous attempts (5+ branches)
failed. Instead, follow "strangler fig" pattern - new code goes in modules, old
code stays until naturally updated. The Svelte migration follows the same
philosophy: index.html keeps its shell, each panel becomes an island mounted
into its existing container, one at a time.

## Important Development Notes

**WebGL Context Management**: The webview creates a Three.js WebGL context
requiring:

- Proper cleanup on webview disposal to prevent memory leaks
- Context loss/restore handling for robust operation
- Memory management for large datasets (5M+ points supported)

**Performance Optimizations**:

- Files >1M points trigger chunked loading with progress indicators
- Transformation matrices applied per-frame using efficient Three.js operations
- Camera controls optimized for large datasets with responsive interaction

**Parser Architecture**: Each format has dedicated parser with consistent
interface:

- Input: `Uint8Array` file data + optional timing callback
- Output: Structured data object with metadata (vertex/face counts, colors,
  normals)
- Error handling: Graceful degradation with informative error messages

**Matrix Conventions**:

- Internal: Three.js column-major matrices for WebGL compatibility
- UI Display: Row-major format for user familiarity
- Input Support: Multiple formats (4x4, quaternion, angle-axis)

**Known Issues**:

- Camera rotation direction inverted compared to CloudCompare (experimental
  fixes available)
- Large coordinate values require "Fit to View" (F key) after loading

## Extension Points

**Custom Editor Registration**: Uses `vscode.registerCustomEditorProvider` for
file associations:

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
3. Right-click test files → "Open with 3D Visualizer"
4. Verify 3D rendering and interaction controls
5. Test edge cases and performance with large files in root directory
