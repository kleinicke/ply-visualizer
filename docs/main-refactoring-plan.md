# Main.ts Refactoring Plan

**Goal**: Refactor the monolithic `main.ts` (~14,500 lines) into a modular,
maintainable structure that will make a future Svelte migration straightforward.

**Philosophy**: Separate concerns, extract reusable components, and create clear
boundaries between business logic and UI code - but keep everything working with
the existing architecture.

---

## Current State Analysis

### Problems with Current Architecture

1. **Monolithic Structure**: Single 14,500+ line file containing:
   - Three.js initialization and rendering
   - File parsing for multiple formats
   - UI event handling
   - Camera controls
   - Transformation matrix management
   - Depth-to-point-cloud conversion
   - Message passing with VS Code extension
   - Performance monitoring
   - Theme management

2. **Tight Coupling**: Business logic mixed with:
   - DOM manipulation
   - Event listeners
   - Three.js rendering code
   - UI state management

3. **Hard to Test**: No clear module boundaries make unit testing difficult

4. **Hard to Extend**: Adding new features requires navigating thousands of
   lines

5. **Future Migration Difficulty**: Moving to Svelte would require untangling
   deeply intertwined code

---

## Refactoring Strategy: Phased Approach

**Key Principle**: Extract and isolate, but don't change behavior. Each phase
should result in a working system.

---

## Phase 1: Extract Core Three.js Management

**Goal**: Separate Three.js rendering logic from business logic

### Create `ThreeManager` Class

**File**: `website/src/lib/three-manager.ts`

**Responsibilities**:

- Scene, camera, renderer initialization
- Control type management (Trackball, Orbit, etc.)
- Lighting setup
- Axes helper management
- Render loop and FPS tracking
- Window resize handling
- Camera state tracking

**Public API**:

```typescript
class ThreeManager {
  // Core Three.js objects
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: TrackballControls | OrbitControls | CustomControls

  // Initialization
  initialize(container: HTMLElement): void
  dispose(): void

  // Rendering
  startRenderLoop(): void
  stopRenderLoop(): void
  requestRender(): void

  // Scene management
  addToScene(object: THREE.Object3D, name?: string): void
  removeFromScene(object: THREE.Object3D): void
  clearScene(): void

  // Camera operations
  fitToView(): void
  resetCamera(): void

  // Control configuration
  setControlType(type: 'trackball' | 'orbit' | ...): void
  setLightingMode(flatLighting: boolean): void
  toggleAxesVisibility(visible: boolean): void

  // Performance metrics
  getCurrentFps(): number
  getLastFrameTime(): number | null
  isRendering(): boolean

  // Callbacks for business logic
  setOnCameraChangeCallback(callback: () => void): void
  setOnRenderCallback(callback: () => void): void
}
```

**Benefits**:

- Encapsulates all Three.js complexity
- Can be used by both legacy main.ts and future Svelte components
- Easy to test in isolation
- Clear API surface

**Migration Notes for Future Svelte**:

- This class can be wrapped in a Svelte component with `onMount()`
- Scene state can be exposed via Svelte stores
- Camera changes can trigger store updates for reactive UI

---

## Phase 2: Extract File Management System

**Goal**: Separate file data structures and multi-file management from rendering

### Create `FileManager` Class

**File**: `website/src/lib/file-manager.ts`

**Responsibilities**:

- Track loaded files and their metadata
- Manage file visibility states
- Handle file transformations (matrix, quaternion, angle-axis)
- Store per-file rendering settings (color, point size, etc.)
- Provide file selection and solo mode

**Data Structures**:

```typescript
interface FileData {
  id: string;
  name: string;
  type: 'point-cloud' | 'mesh' | 'wireframe' | 'camera-pose';

  // Geometry data
  vertices: Float32Array;
  colors?: Uint8Array;
  normals?: Float32Array;
  indices?: Uint32Array;

  // Three.js objects
  object3d: THREE.Points | THREE.Mesh | THREE.LineSegments;

  // Rendering state
  visible: boolean;
  selected: boolean;

  // Transformation
  transformation: THREE.Matrix4;

  // Rendering settings
  pointSize: number;
  color: THREE.Color;
  renderMode: 'points' | 'mesh' | 'wireframe';

  // Statistics
  vertexCount: number;
  faceCount?: number;
}
```

**Public API**:

```typescript
class FileManager {
  // File operations
  addFile(fileData: FileData): string; // returns file ID
  removeFile(fileId: string): void;
  getFile(fileId: string): FileData | undefined;
  getAllFiles(): FileData[];
  clearAllFiles(): void;

  // Visibility management
  setFileVisibility(fileId: string, visible: boolean): void;
  soloFile(fileId: string): void;
  unsolo(): void;

  // Selection
  selectFile(fileId: string): void;
  deselectAll(): void;
  getSelectedFile(): FileData | undefined;

  // Transformation
  setFileTransformation(fileId: string, matrix: THREE.Matrix4): void;
  applyQuaternionRotation(fileId: string, quat: THREE.Quaternion): void;
  applyAngleAxisRotation(
    fileId: string,
    axis: THREE.Vector3,
    angle: number
  ): void;

  // Rendering settings
  setPointSize(fileId: string, size: number): void;
  setColor(fileId: string, color: THREE.Color): void;
  setRenderMode(fileId: string, mode: 'points' | 'mesh' | 'wireframe'): void;

  // Events
  onFileAdded: (callback: (fileId: string) => void) => void;
  onFileRemoved: (callback: (fileId: string) => void) => void;
  onVisibilityChanged: (
    callback: (fileId: string, visible: boolean) => void
  ) => void;
}
```

**Benefits**:

- Single source of truth for file data
- Separates data management from rendering
- Easy to serialize/deserialize for save/load
- Can be tested without Three.js

**Migration Notes for Future Svelte**:

- Can be wrapped in a Svelte store: `$fileStore`
- File list becomes reactive: `{#each $files as file}`
- UI updates automatically when files change
- Easy to bind to Svelte UI components

---

## Phase 3: Extract Message Handler System

**Goal**: Decouple VS Code extension communication from business logic

### Create `MessageHandler` Class

**File**: `website/src/lib/message-handler.ts`

**Responsibilities**:

- Register message type handlers
- Route incoming messages to appropriate handlers
- Provide type-safe message definitions
- Handle message queueing if needed

**Public API**:

```typescript
type MessageHandler<T = any> = (message: T) => void | Promise<void>;

class MessageHandler {
  // Registration
  registerHandler<T>(type: string, handler: MessageHandler<T>): void;
  unregisterHandler(type: string): void;

  // Message processing
  handleMessage(message: any): Promise<void>;

  // VS Code API
  setVsCodeApi(api: any): void;
  postMessage(message: any): void;
}

// Type-safe message definitions
interface Messages {
  ultimateRawBinaryData: {
    type: 'ultimateRawBinaryData';
    fileName: string;
    data: ArrayBuffer;
    // ... other fields
  };

  depthData: {
    type: 'depthData';
    fileName: string;
    data: ArrayBuffer;
  };

  objData: {
    type: 'objData';
    fileName: string;
    data: ObjParsedData;
  };

  // ... all other message types
}
```

**Benefits**:

- Clear message contract
- Easy to add new message types
- Can be mocked for testing
- Separates communication protocol from business logic

**Migration Notes for Future Svelte**:

- Message handlers can dispatch to Svelte stores
- Can be used in both extension and standalone contexts
- Easy to add debugging/logging
- WebSocket support could be added for standalone website

---

## Phase 4: Extract Depth Processing Pipeline

**Goal**: Isolate depth-to-point-cloud conversion logic

### Already Partially Done

The current codebase already has:

- `website/src/depth/DepthRegistry.ts` - Format detection
- `website/src/depth/DepthProjector.ts` - 3D projection
- `website/src/depth/readers/` - Format-specific readers

**Improvements Needed**:

1. Remove direct DOM manipulation from these modules
2. Use callbacks for UI updates instead of direct DOM access
3. Make camera parameter collection async with Promise-based API

**Example Refactoring**:

```typescript
// Instead of:
const fx = parseFloat(document.getElementById('fx').value);

// Use callback pattern:
class DepthProjector {
  async projectToPointCloud(
    depthData: Float32Array,
    width: number,
    height: number,
    onRequestParams: () => Promise<CameraParams>
  ): Promise<PointCloudData>;
}
```

**Migration Notes for Future Svelte**:

- Parameter collection can use Svelte modal component
- Progress updates can use Svelte stores
- Camera parameter form becomes a `.svelte` component

---

## Phase 5: Extract UI State Management

**Goal**: Separate UI state from business logic

### Create State Classes

**File**: `website/src/lib/ui-state.ts`

**Responsibilities**:

- Track UI state (selected tabs, panel visibility, etc.)
- Manage user preferences (theme, default settings)
- Handle keyboard shortcut state
- Provide reactive state updates

**Public API**:

```typescript
class UIState {
  // Current state
  activeTab: 'files' | 'camera' | 'controls' | 'info'
  panelVisible: boolean
  selectedFileId: string | null

  // User preferences
  theme: 'dark-modern' | 'light-modern'
  controlType: 'trackball' | 'orbit' | ...
  axesVisible: boolean
  gammaCorrection: boolean

  // Keyboard shortcuts
  keyboardShortcutsEnabled: boolean

  // Methods
  setActiveTab(tab: string): void
  togglePanel(): void
  setTheme(theme: string): void

  // Persistence
  saveToLocalStorage(): void
  loadFromLocalStorage(): void

  // Events
  onStateChange(callback: () => void): void
}
```

**Benefits**:

- Centralized state management
- Easy to persist and restore
- Can be observed for changes
- Separates state from rendering

**Migration Notes for Future Svelte**:

- Becomes Svelte stores: `$uiState`
- Automatic reactivity: `$: theme = $uiState.theme`
- Can use `derived` stores for computed values
- Persistence handled by store subscriptions

---

## Phase 6: Extract Camera Control System

**Goal**: Separate camera transformation logic from Three.js implementation

### Create `CameraController` Class

**File**: `website/src/lib/camera-controller.ts`

**Responsibilities**:

- High-level camera operations (fit to view, reset, look at)
- Camera pose serialization
- View presets (top, front, side views)
- Camera animation/interpolation

**Public API**:

```typescript
class CameraController {
  constructor(threeManager: ThreeManager);

  // View operations
  fitToView(objects: THREE.Object3D[]): void;
  resetCamera(): void;
  lookAt(target: THREE.Vector3): void;

  // View presets
  setTopView(): void;
  setFrontView(): void;
  setSideView(): void;

  // Camera pose
  getCameraPose(): CameraPose;
  setCameraPose(pose: CameraPose): void;

  // Animation
  animateTo(pose: CameraPose, duration: number): Promise<void>;

  // Rotation center
  setRotationCenter(point: THREE.Vector3): void;
  getRotationCenter(): THREE.Vector3;
}
```

**Benefits**:

- High-level camera API independent of control type
- Easy to add camera presets
- Can record/replay camera movements
- Testable without rendering

**Migration Notes for Future Svelte**:

- Camera controls UI becomes Svelte component
- Camera pose can be bound to form inputs
- Animation state can be tracked in stores

---

## Phase 7: Extract Parser System

**Goal**: Standardize parser interface and registration

### Create Parser Registry

**File**: `website/src/parsers/parser-registry.ts`

**Current State**: Parsers exist in `website/src/parsers/` but are called
directly

**Improvements**:

```typescript
interface Parser {
  name: string;
  extensions: string[];
  parse(
    data: Uint8Array,
    onProgress?: (pct: number) => void
  ): Promise<ParsedData>;
}

class ParserRegistry {
  // Registration
  registerParser(parser: Parser): void;

  // Detection
  getParserForFile(fileName: string): Parser | undefined;
  getSupportedExtensions(): string[];

  // Parsing
  async parseFile(
    fileName: string,
    data: Uint8Array,
    onProgress?: (pct: number) => void
  ): Promise<ParsedData>;
}
```

**Benefits**:

- Easy to add new format support
- Can register parsers dynamically
- Progress callbacks standardized
- Parser selection based on file extension

**Migration Notes for Future Svelte**:

- Parser progress can update Svelte stores
- Supported formats list reactive for UI
- Parser errors can trigger Svelte notifications

---

## Phase 8: Extract Transformation System

**Goal**: Separate transformation matrix handling from file management

### Create `TransformationManager` Class

**File**: `website/src/lib/transformation-manager.ts`

**Responsibilities**:

- Parse transformation matrix formats (4x4, quaternion, angle-axis)
- Apply transformations to objects
- Provide quick rotation helpers (90° X/Y/Z)
- Display matrix in human-readable format

**Public API**:

```typescript
class TransformationManager {
  // Parsing
  parseMatrix4x4(input: string): THREE.Matrix4 | null;
  parseQuaternion(input: string): THREE.Quaternion | null;
  parseAngleAxis(input: string): { axis: THREE.Vector3; angle: number } | null;

  // Application
  applyTransformation(object: THREE.Object3D, matrix: THREE.Matrix4): void;
  applyQuickRotation(
    object: THREE.Object3D,
    axis: 'X' | 'Y' | 'Z',
    degrees: number
  ): void;

  // Display
  matrixToString(
    matrix: THREE.Matrix4,
    format: 'column-major' | 'row-major'
  ): string;
  quaternionToString(quat: THREE.Quaternion): string;

  // Utilities
  getIdentityMatrix(): THREE.Matrix4;
  invertMatrix(matrix: THREE.Matrix4): THREE.Matrix4;
}
```

**Benefits**:

- Centralized transformation logic
- Easy to add new input formats
- Can validate transformations
- Testable with known transforms

**Migration Notes for Future Svelte**:

- Transformation UI panel becomes Svelte component
- Matrix display updates reactively
- Input validation can use Svelte form bindings

---

## Phase 9: Extract Performance Monitor

**Goal**: Separate performance tracking from rendering

### Create `PerformanceMonitor` Class

**File**: `website/src/lib/performance-monitor.ts`

**Responsibilities**:

- FPS tracking
- Frame time measurement
- GPU timing (if available)
- Memory usage tracking
- Performance statistics

**Public API**:

```typescript
class PerformanceMonitor {
  // Metrics
  getCurrentFps(): number;
  getAverageFps(): number;
  getFrameTime(): number;
  getGpuTime(): number;
  getMemoryUsage(): { used: number; total: number };

  // Recording
  startRecording(): void;
  stopRecording(): PerformanceReport;

  // Display
  getStatsString(): string;

  // Thresholds
  setFpsThreshold(threshold: number): void;
  onLowPerformance(callback: () => void): void;
}
```

**Benefits**:

- Centralized performance tracking
- Can identify performance bottlenecks
- Easy to add performance warnings
- Can generate performance reports

**Migration Notes for Future Svelte**:

- Performance stats can be a Svelte component
- Real-time updates via stores
- Charts can be added using Svelte Chart.js wrapper

---

## Phase 10: Extract Theme System

**Goal**: Separate theme management from application logic

### Create `ThemeManager` Class

**File**: `website/src/themes/theme-manager.ts`

**Current State**: Theme code exists in `website/src/themes/` but needs better
integration

**Improvements**:

```typescript
class ThemeManager {
  // Theme operations
  setTheme(themeName: string): void;
  getCurrentTheme(): Theme;
  getAvailableThemes(): string[];

  // Custom themes
  registerTheme(theme: Theme): void;

  // CSS variable access
  getThemeVariable(varName: string): string;

  // Persistence
  saveThemePreference(): void;
  loadThemePreference(): void;
}
```

**Benefits**:

- Easy to add new themes
- Theme switching without page reload
- Can preview themes
- Centralized theme logic

**Migration Notes for Future Svelte**:

- Theme selector becomes Svelte component
- Theme changes trigger CSS variable updates
- Live theme preview possible

---

## Implementation Order

**Critical Path** (do these first):

1. **Phase 1: ThreeManager** - Foundation for everything else
2. **Phase 2: FileManager** - Core data structure
3. **Phase 3: MessageHandler** - Communication layer
4. **Phase 7: ParserRegistry** - Standardize parsing

**Secondary** (improve architecture):

5. **Phase 6: CameraController** - High-level camera operations
6. **Phase 8: TransformationManager** - Cleaner transformation handling
7. **Phase 5: UIState** - Centralized state

**Polish** (nice to have):

8. **Phase 9: PerformanceMonitor** - Better debugging
9. **Phase 10: ThemeManager** - Better theme handling
10. **Phase 4: Depth Pipeline Improvements** - Already mostly done

---

## Refactoring Guidelines

### Do's ✅

1. **Extract, don't rewrite**: Keep existing logic, just move it
2. **One phase at a time**: Complete each phase before moving to next
3. **Test after each phase**: Ensure everything still works
4. **Keep backward compatibility**: Don't break existing API
5. **Document as you go**: Add JSDoc comments to public APIs
6. **Use TypeScript**: Add proper types to all new code
7. **Keep commits small**: One class per commit ideally

### Don'ts ❌

1. **Don't change behavior**: Refactoring should not change functionality
2. **Don't mix phases**: Complete one extraction before starting another
3. **Don't optimize prematurely**: Focus on structure, not performance
4. **Don't remove old code immediately**: Comment out, test, then remove
5. **Don't skip testing**: Manual test with sample files after each change
6. **Don't forget edge cases**: Test with large files, empty files, malformed
   data

---

## Testing Strategy

### Manual Testing Checklist (After Each Phase)

- [ ] Load PLY file (ASCII and binary)
- [ ] Load OBJ file with MTL materials
- [ ] Load STL file (ASCII and binary)
- [ ] Load XYZ point cloud
- [ ] Convert TIF depth image to point cloud
- [ ] Load multiple files simultaneously
- [ ] Apply transformations (matrix, quaternion, angle-axis)
- [ ] Change camera controls (Trackball, Orbit)
- [ ] Toggle visibility of files
- [ ] Remove files
- [ ] Fit to view
- [ ] Reset camera
- [ ] Toggle axes
- [ ] Change theme (if Phase 10 done)
- [ ] Test keyboard shortcuts
- [ ] Test with 5M+ point cloud (performance)

### Automated Testing

Create unit tests for each extracted class:

```typescript
// Example: three-manager.test.ts
describe('ThreeManager', () => {
  let threeManager: ThreeManager;
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement('div');
    container.style.width = '800px';
    container.style.height = '600px';
    document.body.appendChild(container);

    threeManager = new ThreeManager();
    threeManager.initialize(container);
  });

  afterEach(() => {
    threeManager.dispose();
    document.body.removeChild(container);
  });

  test('initializes scene, camera, renderer', () => {
    expect(threeManager.scene).toBeDefined();
    expect(threeManager.camera).toBeDefined();
    expect(threeManager.renderer).toBeDefined();
  });

  test('adds objects to scene', () => {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshBasicMaterial()
    );

    threeManager.addToScene(mesh, 'test-box');
    expect(threeManager.scene.children).toContain(mesh);
  });

  // ... more tests
});
```

---

## Migration Path to Svelte (Future)

Once refactoring is complete, the Svelte migration becomes much easier:

### Step 1: Create Svelte Wrapper Components

```svelte
<!-- ThreeJSViewer.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte'
  import { ThreeManager } from '$lib/three-manager'

  let container: HTMLElement
  let threeManager: ThreeManager

  onMount(() => {
    threeManager = new ThreeManager()
    threeManager.initialize(container)
  })

  onDestroy(() => {
    threeManager.dispose()
  })
</script>

<div bind:this={container} class="threejs-container"></div>
```

### Step 2: Create Svelte Stores from Managers

```typescript
// stores/file-store.ts
import { writable } from 'svelte/store';
import { FileManager } from '$lib/file-manager';

const fileManager = new FileManager();

function createFileStore() {
  const { subscribe, set, update } = writable([]);

  fileManager.onFileAdded(() => {
    set(fileManager.getAllFiles());
  });

  fileManager.onFileRemoved(() => {
    set(fileManager.getAllFiles());
  });

  return {
    subscribe,
    addFile: data => fileManager.addFile(data),
    removeFile: id => fileManager.removeFile(id),
    // ... other methods
  };
}

export const files = createFileStore();
```

### Step 3: Create UI Components

```svelte
<!-- FileList.svelte -->
<script lang="ts">
  import { files } from '$stores/file-store'
</script>

<div class="file-list">
  {#each $files as file}
    <div class="file-item">
      <span>{file.name}</span>
      <button on:click={() => files.removeFile(file.id)}>Remove</button>
    </div>
  {/each}
</div>
```

### Step 4: Replace HTML Templates Gradually

Start with smallest components first:

1. PerformanceMonitor → `PerformanceMonitor.svelte`
2. FileList → `FileList.svelte`
3. CameraControls → `CameraControls.svelte`
4. TransformationPanel → `TransformationPanel.svelte`
5. Finally: Main app → `App.svelte`

---

## Expected Outcomes

### After Complete Refactoring

1. **Modular Codebase**: ~10 focused classes instead of 1 monolithic file
2. **Testable**: Each class can be unit tested in isolation
3. **Maintainable**: Clear boundaries and responsibilities
4. **Extensible**: Easy to add new features
5. **Documented**: Clear API documentation for each module
6. **Ready for Svelte**: Clean separation of concerns makes migration
   straightforward

### File Structure After Refactoring

```
website/src/
├── lib/
│   ├── three-manager.ts           (~600 lines)
│   ├── file-manager.ts            (~400 lines)
│   ├── message-handler.ts         (~200 lines)
│   ├── camera-controller.ts       (~300 lines)
│   ├── transformation-manager.ts  (~200 lines)
│   ├── ui-state.ts                (~150 lines)
│   └── performance-monitor.ts     (~200 lines)
├── parsers/
│   ├── parser-registry.ts         (~100 lines)
│   ├── ply-parser.ts              (existing)
│   ├── obj-parser.ts              (existing)
│   └── stl-parser.ts              (existing)
├── depth/
│   ├── depth-registry.ts          (existing)
│   ├── depth-projector.ts         (existing, improved)
│   └── readers/                   (existing)
├── themes/
│   ├── theme-manager.ts           (~150 lines)
│   ├── dark-modern.ts             (existing)
│   └── light-modern.ts            (existing)
├── main.ts                        (~8000 lines - mostly integration)
└── app.ts                         (future Svelte entry point)
```

---

## Key Insights for Future Reference

### Why This Refactoring Enables Svelte

1. **Clean Boundaries**: Each class has clear input/output, making it easy to
   wrap in Svelte stores
2. **State Separation**: UI state separated from business logic = Svelte
   reactivity works naturally
3. **Event-Driven**: Callback-based architecture maps perfectly to Svelte event
   dispatching
4. **No DOM Coupling**: Classes don't manipulate DOM directly = can be used with
   any UI framework
5. **Testable**: Unit tests ensure refactored code works correctly
6. **Incremental Migration**: Can migrate one component at a time without
   breaking everything

### Common Pitfalls to Avoid

1. **Don't try to do everything at once**: Incremental refactoring is safer
2. **Don't change behavior during refactoring**: Separate concerns first,
   optimize later
3. **Don't skip testing**: Every phase should end with a working system
4. **Don't forget backward compatibility**: Keep old entry points working during
   transition
5. **Don't mix refactoring with feature work**: Focus on structure, not new
   features

### Success Criteria

You'll know the refactoring is successful when:

- [ ] Main.ts is under 10,000 lines (ideally ~8,000)
- [ ] Each extracted class is under 600 lines
- [ ] Each class has a single, clear responsibility
- [ ] All manual tests pass
- [ ] Unit tests cover core functionality (>70% coverage)
- [ ] Adding a new file format takes <100 lines of code
- [ ] A Svelte wrapper component can be created in <50 lines
- [ ] Documentation exists for all public APIs

---

## Conclusion

This refactoring plan prioritizes **stability** and **incremental progress**
over ambitious rewrites. Each phase delivers value independently while building
toward the goal of a Svelte-ready architecture.

The key is: **Extract, don't rewrite. Test after every change. Keep it
working.**

Once complete, the Svelte migration becomes a matter of wrapping existing,
tested classes in Svelte components - a much safer and more manageable task than
the current approach of trying to migrate everything simultaneously.
