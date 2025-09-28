# Svelte Migration Plan

## Overview

This document outlines the migration strategy for transitioning the PLY
Visualizer VS Code extension from vanilla TypeScript to Svelte. The main goal is
to replace the monolithic 12,795-line `main.ts` file with modular, maintainable
Svelte components while preserving all existing functionality.

## Current Architecture Analysis

### Files Requiring Changes

**Primary Target:**

- `src/webview/main.ts` (12,795 lines) - Main webview visualization engine

**Secondary Files (minimal changes):**

- `webpack.config.js` - Add Svelte compilation support
- `package.json` - Add Svelte dependencies
- `src/webview/tsconfig.json` - Update TypeScript config for Svelte
- `src/extension.ts` - Minor webview HTML template updates
- `src/pointCloudEditorProvider.ts` - Possible webview initialization updates

**Unchanged Files:**

- All parser files (`src/*Parser.ts`) - Extension host logic remains the same
- Test files - Extension host testing unchanged
- `src/webview/interfaces.ts` - Type definitions remain valid
- `src/webview/controls.ts` - Three.js controls can be reused

## Migration Strategy - Direct Replacement with Testing Points

**Critical Requirement**: The visualizer must work after each major phase for
both:

- **VS Code Extension**: Extension Development Host testing
- **Standalone Website**: Independent website at https://f-kleinicke.de

### Current Dual-Target Architecture

The project uses a **shared codebase strategy**:

- `website/src/main.ts` → Core visualization engine (shared)
- `src/extension.ts` → VS Code integration wrapper
- **Webpack builds**:
  - Extension bundle: `src/extension.ts` → `out/extension.js` (Node.js target)
  - Webview bundle: `website/src/main.ts` → `out/webview/main.js` (Web target)

### Direct Replacement Approach

**Strategy**: Implement new Svelte version, delete old code, test functionality:

1. **Implement Svelte equivalent** for each functional area
2. **Replace original code directly** - no parallel implementations
3. **Test thoroughly** after each major replacement
4. **Git commit** after each working phase for easy rollback
5. **Both targets work** after each phase completion

### Phase 1: Setup & Foundation (1-2 days)

#### 1.1 Environment Setup

```bash
npm install --save-dev svelte svelte-loader svelte-preprocess @types/svelte
```

#### 1.2 Build Configuration

Update `website/webpack.config.js` to support Svelte:

```javascript
// Add to webpack rules
{
  test: /\.svelte$/,
  use: {
    loader: 'svelte-loader',
    options: {
      preprocess: sveltePreprocess({
        typescript: true,
      }),
    },
  },
},
// Update resolve extensions
resolve: {
  extensions: ['.ts', '.js', '.svelte'],
  // Keep existing Three.js alias
}
```

#### 1.3 Project Structure Setup

Create new Svelte structure that will replace existing code:

```
website/src/
├── App.svelte                # NEW - Root Svelte app
├── main.ts                   # WILL BE REPLACED - new Svelte entry point
├── components/               # NEW - Svelte components
│   ├── ui/
│   │   ├── FileManager.svelte
│   │   ├── CameraControls.svelte
│   │   ├── RenderingSettings.svelte
│   │   └── TransformationPanel.svelte
│   ├── threejs/
│   │   ├── ThreeJSViewer.svelte
│   │   └── PerformanceMonitor.svelte
│   └── depth/
│       ├── DepthConverter.svelte
│       └── CameraParameterInput.svelte
├── stores/                   # NEW - Svelte stores
│   ├── visualizer.ts
│   ├── files.ts
│   ├── camera.ts
│   └── ui.ts
├── lib/                      # NEW - Utility libraries
│   ├── three-manager.ts
│   └── message-handler.ts
├── parsers/ (KEEP)           # Keep existing parsers
├── depth/ (KEEP)             # Keep existing depth processing
└── themes/ (KEEP)            # Keep existing themes
```

**✅ Phase 1 Testing**:

- Create basic structure and verify build system works
- `npm run compile` → Both targets build successfully
- No functional changes yet - just build system ready

### Phase 2: Core Infrastructure - Three.js Manager (2-3 days)

**Goal**: Extract Three.js functionality from main.ts into reusable
`lib/three-manager.ts`

#### 2.1 Three.js Manager Creation

Create `website/src/lib/three-manager.ts` with core Three.js functions:

```typescript
export class ThreeManager {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: any;

  // Move these functions from main.ts:
  initialize() {
    /* initThreeJS() code */
  }
  setupControls() {
    /* initializeControls() code */
  }
  setupLighting() {
    /* initSceneLighting() code */
  }
  animate() {
    /* animate() code */
  }
  // ... all other Three.js functions
}
```

#### 2.2 Replace main.ts with new architecture

**REPLACE** the monolithic `main.ts` with a new structure:

```typescript
// New main.ts - simple entry point
import App from './App.svelte';
import { setupMessageHandler } from './lib/message-handler';

const app = new App({
  target: document.body,
});

setupMessageHandler();
export default app;
```

**✅ Phase 2 Testing**:

- VS Code Extension: F5 → Extension Development Host → Load test files
- Standalone Website: `cd website && npm run dev` → Load files
- **All functionality works**: Three.js rendering, file loading, UI interactions
- **New architecture**: ThreeManager class handles all 3D functionality

### Phase 3: Svelte Stores (1-2 days)

**Goal**: Create reactive state management using Svelte stores

#### 3.1 Core Stores Creation

Create `website/src/stores/` with reactive state management:

**visualizer.ts**:

```typescript
import { writable } from 'svelte/store';
export const visualizerStore = writable({
  scene: null,
  camera: null,
  renderer: null,
  needsRender: false,
  currentFps: 0,
});
```

**files.ts**:

```typescript
export const filesStore = writable({
  plyFiles: [],
  meshes: [],
  fileVisibility: [],
  pointSizes: [],
  individualColorModes: [],
});
```

**camera.ts** / **ui.ts** - Similar reactive state patterns

**✅ Phase 3 Testing**:

- VS Code Extension: F5 → Extension Development Host → All functionality works
- Standalone Website: `cd website && npm run dev` → All functionality works
- **Reactive updates**: UI updates automatically when stores change

### Phase 4: Core UI Components (3-4 days)

**Goal**: Replace DOM manipulation with Svelte components

#### 4.1 Main App Component

Create `App.svelte` as the root component:

```svelte
<script lang="ts">
  import ThreeJSViewer from './components/threejs/ThreeJSViewer.svelte';
  import FileManager from './components/ui/FileManager.svelte';
  import CameraControls from './components/ui/CameraControls.svelte';
  // ... other components
</script>

<div class="app-container">
  <ThreeJSViewer />
  <FileManager />
  <CameraControls />
  <!-- ... other UI panels -->
</div>
```

#### 4.2 Three.js Viewer Component

Create `ThreeJSViewer.svelte` that uses the ThreeManager:

```svelte
<script lang="ts">
  import { onMount } from 'svelte';
  import { ThreeManager } from '../../lib/three-manager';

  let canvasContainer: HTMLElement;
  let threeManager: ThreeManager;

  onMount(() => {
    threeManager = new ThreeManager();
    threeManager.initialize(canvasContainer);
  });
</script>

<div bind:this={canvasContainer} class="threejs-container"></div>
```

**✅ Phase 4 Testing**:

- VS Code Extension: F5 → Extension Development Host → All functionality works
- Standalone Website: `cd website && npm run dev` → All functionality works
- **Svelte UI**: File management, camera controls, rendering settings all work
- **Three.js integration**: 3D rendering works identically to original

### Phase 5: Advanced Components (2-3 days)

**Goal**: Implement remaining specialized components

#### 5.1 Advanced UI Components

- `DepthConverter.svelte` - Depth image processing interface
- `TransformationPanel.svelte` - Matrix input/display, quaternion controls
- `SequencePlayer.svelte` - Sequence playback controls
- `PerformanceMonitor.svelte` - FPS display, timing information

#### 5.2 Specialized Features

- Depth-to-point cloud conversion
- Camera profile management
- Pose visualization and filtering
- Calibration file handling

**✅ Phase 5 Testing**:

- VS Code Extension: F5 → Extension Development Host → All functionality works
- Standalone Website: `cd website && npm run dev` → All functionality works
- **Complete feature set**: All 13+ file formats, depth conversion, sequences
  work
- **Performance**: No regression in rendering or memory usage

### Phase 6: Final Polish & Cleanup (1-2 days)

**Goal**: Final cleanup and optimization

#### 6.1 Code Cleanup

- Remove any remaining unused files
- Optimize bundle size
- Clean up imports and dependencies
- Update documentation

#### 6.2 Final Testing

- Comprehensive testing of all file formats from `testfiles/`
- Performance testing with large files (5M+ points)
- Memory leak testing
- Cross-browser compatibility (for website)

**✅ Final Testing Checklist**:

- [ ] VS Code Extension: Load all file types from `testfiles/` subdirectories
- [ ] Standalone Website: Load files via browser file picker
- [ ] Performance: No regression in FPS or memory usage
- [ ] Features: All 364 original functions work in new Svelte architecture
- [ ] Build: `npm run compile` produces working outputs for both targets
- [ ] Deploy: Website deployment continues to work

## Summary: Simple Migration Strategy

**No feature flags, no parallel implementations - just direct replacement with
testing:**

1. **Phase 1**: Setup Svelte build system (no functional changes)
2. **Phase 2**: Replace main.ts with ThreeManager + new entry point
3. **Phase 3**: Add Svelte stores for reactive state management
4. **Phase 4**: Replace DOM manipulation with core Svelte components
5. **Phase 5**: Implement remaining advanced components
6. **Phase 6**: Final cleanup and comprehensive testing

**After each phase**: Test both VS Code extension and standalone website to
ensure everything works. Git commit for easy rollback if needed.

**Both targets always work** - no complex feature flagging, just clean
implementation and thorough testing at each stage.

## Technical Implementation Details

### Build System Integration

**webpack.config.js modifications:**

```javascript
// Add to webview bundle rules
{
  test: /\.svelte$/,
  use: {
    loader: 'svelte-loader',
    options: {
      preprocess: sveltePreprocess({
        typescript: true,
      }),
    },
  },
}
```

### Entry Point Simplification

**New main.ts structure:**

```typescript
import App from './App.svelte';

// Initialize VS Code API
const vscode = acquireVsCodeApi();

// Mount Svelte app
const app = new App({
  target: document.body,
  props: {
    vscode: vscode,
  },
});

export default app;
```

### Store Integration Pattern

**Example component with store:**

```svelte
<script lang="ts">
  import { filesStore, visualizerStore } from '../stores';
  import { onMount } from 'svelte';

  $: files = $filesStore.plyFiles;
  $: meshes = $filesStore.meshes;

  function toggleFileVisibility(index: number) {
    // Update store, triggers reactive updates
  }
</script>
```

## Migration Risks & Mitigation

### High Risk Areas

1. **Three.js Integration Complexity**
   - Risk: Breaking existing 3D rendering
   - Mitigation: Preserve Three.js code as-is, only wrap in Svelte components

2. **VS Code Webview Constraints**
   - Risk: CSP violations, security restrictions
   - Mitigation: Test early, use inline styles if needed

3. **Performance Regression**
   - Risk: Svelte overhead affecting 3D performance
   - Mitigation: Benchmark at each step, optimize reactive subscriptions

4. **Message Passing Changes**
   - Risk: Breaking extension host communication
   - Mitigation: Maintain exact same message protocols

### Medium Risk Areas

1. **State Synchronization**
   - Risk: Race conditions in reactive updates
   - Mitigation: Careful store design, test state transitions

2. **Bundle Size Increase**
   - Risk: Svelte adding to webview bundle
   - Mitigation: Monitor bundle size, use tree shaking

3. **TypeScript Integration**
   - Risk: Type safety issues with Svelte components
   - Mitigation: Strong typing in stores, proper svelte-preprocess setup

## Success Metrics

### Functional Requirements

- [ ] All 13+ file formats load correctly
- [ ] Three.js rendering performance maintained
- [ ] All UI interactions work as before
- [ ] Extension host communication unchanged
- [ ] Large file handling (5M+ points) preserved

### Quality Improvements

- [ ] Code split into <50 manageable components
- [ ] State management centralized and reactive
- [ ] Component reusability increased
- [ ] Development experience improved
- [ ] Bundle size impact <20% increase

### Maintainability Goals

- [ ] No single file >500 lines
- [ ] Clear component boundaries
- [ ] Documented store interfaces
- [ ] Testable component isolation
- [ ] Easier feature additions

## Timeline Summary

**Total Estimated Time: 15-20 days**

- Phase 1 (Setup): 1-2 days
- Phase 2 (State): 2-3 days
- Phase 3 (Components): 3-4 days
- Phase 4 (Messages): 1-2 days
- Phase 5 (Three.js): 2-3 days
- Phase 6 (Features): 4-5 days
- Phase 7 (Testing): 2-3 days

## Post-Migration Benefits

1. **Maintainability**: No more 12K-line monolith
2. **Reactivity**: Automatic UI updates with state changes
3. **Component Reuse**: Modular UI components
4. **Developer Experience**: Better debugging, hot reloading
5. **Feature Development**: Easier to add new UI features
6. **AI-Friendly**: Cleaner component boundaries for AI assistance

This migration preserves all existing functionality while providing a modern,
maintainable foundation for future development.

## Detailed Function Migration Mapping

The main.ts file contains **364 functions** across 12,795 lines. Below is a
comprehensive mapping of where each function should be migrated in the Svelte
architecture:

### Core Three.js Engine Functions → `lib/three-manager.ts`

**Initialization & Setup (12 functions):**

- `initThreeJS()` → `ThreeManager.initialize()`
- `initializeControls()` → `ThreeManager.setupControls()`
- `initSceneLighting()` → `ThreeManager.setupLighting()`
- `setupResizeObserver()` → `ThreeManager.setupResize()`
- `dispose()` → `ThreeManager.dispose()`
- `onWindowResize()` → `ThreeManager.handleResize()`
- `addAxesHelper()` → `ThreeManager.addAxes()`
- `createAxisLabels()` → `ThreeManager.createAxisLabels()`
- `updateRendererColorSpace()` → `ThreeManager.setColorSpace()`
- `ensureSrgbLUT()` → `ThreeManager.setupColorLUT()`
- `initGPUTiming()` → `ThreeManager.setupGPUTiming()`
- `setupInvertedControls()` → `ThreeManager.setupInvertedControls()`

**Rendering Loop & Performance (15 functions):**

- `animate()` → `ThreeManager.animate()`
- `requestRender()` → `ThreeManager.requestRender()`
- `trackRender()` → `ThreeManager.trackRender()`
- `trackFrameTime()` → `ThreeManager.trackFrameTime()`
- `updateFPSCalculation()` → `ThreeManager.updateFPS()`
- `startRenderLoop()` → `ThreeManager.startLoop()`
- `stopRenderLoop()` → `ThreeManager.stopLoop()`
- `startGPUTiming()` → `ThreeManager.startGPUTiming()`
- `endGPUTiming()` → `ThreeManager.endGPUTiming()`
- `updateGPUTiming()` → `ThreeManager.updateGPUTiming()`
- `createOptimizedPointCloud()` → `ThreeManager.createOptimizedPointCloud()`
- `decimateGeometryByDistance()` → `ThreeManager.decimateGeometry()`
- `updateAdaptiveDecimation()` → `ThreeManager.updateDecimation()`
- `optimizeForPointCount()` → `ThreeManager.optimizeForPointCount()`
- `checkMeshVisibility()` → `ThreeManager.checkVisibility()`

**Geometry Creation (8 functions):**

- `createGeometryFromSpatialData()` → `ThreeManager.createGeometry()`
- `createNormalsVisualizer()` → `ThreeManager.createNormals()`
- `createComputedNormalsVisualizer()` → `ThreeManager.createComputedNormals()`
- `createPointCloudNormalsVisualizer()` →
  `ThreeManager.createPointCloudNormals()`
- `createMaterialForFile()` → `ThreeManager.createMaterial()`
- `createVertexPointsFromMesh()` → `ThreeManager.createVertexPoints()`
- `rebuildAllPlyMaterials()` → `ThreeManager.rebuildMaterials()`
- `rebuildAllColorAttributesForCurrentGammaSetting()` →
  `ThreeManager.rebuildColors()`

### Camera & Controls Functions → `stores/camera.ts` + `components/ui/CameraControls.svelte`

**Camera Control Switching (8 functions):**

- `switchToTrackballControls()` → `CameraControls.svelte` +
  `cameraStore.setControlType()`
- `switchToOrbitControls()` → `CameraControls.svelte` +
  `cameraStore.setControlType()`
- `switchToInverseTrackballControls()` → `CameraControls.svelte` +
  `cameraStore.setControlType()`
- `switchToArcballControls()` → `CameraControls.svelte` +
  `cameraStore.setControlType()`
- `updateControlStatus()` → `CameraControls.svelte` reactive updates
- `setOpenCVCameraConvention()` → `CameraControls.svelte` +
  `cameraStore.setConvention()`
- `setOpenGLCameraConvention()` → `CameraControls.svelte` +
  `cameraStore.setConvention()`
- `updateAxesForCameraConvention()` → `CameraControls.svelte` reactive handler

**Camera State Management (12 functions):**

- `updateCameraMatrix()` → `cameraStore.updateMatrix()`
- `updateCameraMatrixDisplay()` → `CameraControls.svelte` reactive display
- `updateCameraControlsPanel()` → `CameraControls.svelte` reactive updates
- `setupCameraControlEventListeners()` → `CameraControls.svelte` event handlers
- `resetCameraToDefault()` → `CameraControls.svelte` reset method
- `setRotationCenterToOrigin()` → `CameraControls.svelte` +
  `cameraStore.setRotationCenter()`
- `setRotationCenter()` → `cameraStore.setRotationCenter()`
- `showRotationCenterFeedback()` → `CameraControls.svelte` feedback display
- `autoFitCameraOnFirstLoad()` → `cameraStore.autoFit()`
- `fitCameraToAllObjects()` → `cameraStore.fitToAll()`
- `fitCameraToObject()` → `cameraStore.fitToObject()`
- `showUpVectorFeedback()` → `CameraControls.svelte` feedback display

**Camera Dialogs (6 functions):**

- `showCameraPositionDialog()` → `CameraControls.svelte` modal dialog
- `showCameraRotationDialog()` → `CameraControls.svelte` modal dialog
- `showRotationCenterDialog()` → `CameraControls.svelte` modal dialog
- `showTranslationDialog()` → `TransformationPanel.svelte` modal dialog
- `showQuaternionDialog()` → `TransformationPanel.svelte` modal dialog
- `showAngleAxisDialog()` → `TransformationPanel.svelte` modal dialog

### File Management Functions → `stores/files.ts` + `components/ui/FileManager.svelte`

**File Operations (18 functions):**

- `addNewFiles()` → `filesStore.addFiles()` + `FileManager.svelte` UI updates
- `removeFileByIndex()` → `filesStore.removeFile()` + `FileManager.svelte` UI
  updates
- `requestAddFile()` → `FileManager.svelte` add button handler
- `requestRemoveFile()` → `FileManager.svelte` remove button handler
- `requestLoadMtl()` → `FileManager.svelte` MTL load handler
- `requestColorImageForDepth()` → `FileManager.svelte` color image handler
- `updateFileList()` → `FileManager.svelte` reactive list updates
- `updateFileStats()` → `FileManager.svelte` reactive stats display
- `updateFileStatsImmediate()` → `FileManager.svelte` immediate updates
- `toggleFileVisibility()` → `FileManager.svelte` visibility toggle
- `soloPointCloud()` → `FileManager.svelte` solo mode
- `savePlyFile()` → `FileManager.svelte` save handler
- `generatePlyFileContent()` → `filesStore.generatePlyContent()`
- `handleMtlData()` → `filesStore.handleMtlData()`
- `captureDepthPanelStates()` → `filesStore.captureDepthStates()`
- `restoreDepthPanelStates()` → `filesStore.restoreDepthStates()`
- `captureDepthFormValues()` → `filesStore.captureFormValues()`
- `restoreDepthFormValues()` → `filesStore.restoreFormValues()`

**File Rendering Modes (15 functions):**

- `toggleUniversalRenderMode()` → `FileManager.svelte` render mode controls
- `toggleSolidRendering()` → `FileManager.svelte` solid toggle
- `toggleWireframeRendering()` → `FileManager.svelte` wireframe toggle
- `togglePointsRendering()` → `FileManager.svelte` points toggle
- `toggleNormalsRendering()` → `FileManager.svelte` normals toggle
- `updateMeshVisibilityAndMaterial()` → `FileManager.svelte` reactive updates
- `updateVertexPointsVisualization()` → `FileManager.svelte` vertex points
  updates
- `updateMultiMaterialPointsVisualization()` → `FileManager.svelte`
  multi-material updates
- `updateUniversalRenderButtonStates()` → `FileManager.svelte` reactive button
  states
- `updatePointsNormalsButtonStates()` → `FileManager.svelte` reactive button
  states
- `toggleAxesVisibility()` → `FileManager.svelte` axes toggle
- `updateAxesButtonState()` → `FileManager.svelte` reactive button state
- `toggleNormalsVisibility()` → `FileManager.svelte` normals toggle
- `togglePointsVisibility()` → `FileManager.svelte` points toggle
- `toggleFileNormalsVisibility()` → `FileManager.svelte` file normals toggle

### Transformation System Functions → `components/ui/TransformationPanel.svelte`

**Matrix Operations (18 functions):**

- `setTransformationMatrix()` → `TransformationPanel.svelte` matrix input
- `getTransformationMatrix()` → `transformationStore.getMatrix()`
- `getTransformationMatrixAsArray()` → `transformationStore.getMatrixArray()`
- `applyTransformationMatrix()` → `transformationStore.applyMatrix()`
- `resetTransformationMatrix()` → `TransformationPanel.svelte` reset button
- `createRotationMatrix()` → `transformationStore.createRotation()`
- `createTranslationMatrix()` → `transformationStore.createTranslation()`
- `createQuaternionMatrix()` → `transformationStore.createQuaternion()`
- `createAngleAxisMatrix()` → `transformationStore.createAngleAxis()`
- `multiplyTransformationMatrices()` → `transformationStore.multiplyMatrices()`
- `addTranslationToMatrix()` → `transformationStore.addTranslation()`
- `updateMatrixTextarea()` → `TransformationPanel.svelte` reactive textarea
- `parseMatrixInput()` → `transformationStore.parseMatrix()`
- `parseSpaceSeparatedValues()` → `transformationStore.parseValues()`
- `setUpVector()` → `transformationStore.setUpVector()`
- `updateAxesForUpVector()` → `transformationStore.updateAxes()`
- `showUpVectorIndicator()` → `TransformationPanel.svelte` indicator display
- `updateRotationOriginButtonState()` → `TransformationPanel.svelte` reactive
  button

### Depth Processing Functions → `components/depth/DepthConverter.svelte`

**Depth Conversion Core (8 functions):**

- `depthToPointCloud()` → `DepthConverter.svelte` main conversion method
- `convertDepthResultToVertices()` → `depthStore.convertToVertices()`
- `getDepthSettingsFromFileUI()` → `DepthConverter.svelte` form data collection
- `handleDefaultDepthSettings()` → `DepthConverter.svelte` defaults handler
- `refreshDepthFileFormsWithDefaults()` → `DepthConverter.svelte` refresh method
- `updateDepthFormWithDefaults()` → `DepthConverter.svelte` form update
- `updatePrinciplePointFields()` → `DepthConverter.svelte` reactive field
  updates
- `updateDefaultButtonState()` → `DepthConverter.svelte` reactive button state

**Depth Settings Management (20 functions):**

- `isDepthTifImage()` → `depthStore.isDepthTif()`
- `isDepthDerivedFile()` → `depthStore.isDepthDerived()`
- `isPngDerivedFile()` → `depthStore.isPngDerived()`
- `getPngScaleFactor()` → `depthStore.getPngScale()`
- `getDepthSetting()` → `depthStore.getSetting()`
- `getDepthFx()` → `depthStore.getFx()`
- `getDepthFy()` → `depthStore.getFy()`
- `getDepthBaseline()` → `depthStore.getBaseline()`
- `getDepthCx()` → `depthStore.getCx()`
- `getDepthCy()` → `depthStore.getCy()`
- `getDepthConvention()` → `depthStore.getConvention()`
- `getStoredColorImageName()` → `depthStore.getColorImageName()`
- `getImageSizeDisplay()` → `DepthConverter.svelte` reactive display
- `resetMonoParameters()` → `DepthConverter.svelte` reset method
- `resetDisparityOffset()` → `DepthConverter.svelte` reset method
- `resetPrinciplePoint()` → `DepthConverter.svelte` reset method
- `updateSingleDefaultButtonState()` → `DepthConverter.svelte` reactive button
- `loadSavedCameraParams()` → `depthStore.loadSavedParams()`
- `saveCameraParams()` → `depthStore.saveParams()`
- `loadPpmImage()` → `depthStore.loadPpmImage()`
- `parsePpmImage()` → `depthStore.parsePpmImage()`

### UI State & Display Functions → `stores/ui.ts` + Various UI Components

**Tab & Panel Management (8 functions):**

- `switchTab()` → `uiStore.setActiveTab()` + reactive tab components
- `setupAxesVisibility()` → `uiStore.setupAxes()` + UI components
- `updateLightingButtonsState()` → `RenderingSettings.svelte` reactive buttons
- `updateGammaButtonState()` → `RenderingSettings.svelte` reactive button
- `toggleGammaCorrection()` → `RenderingSettings.svelte` gamma toggle
- `showKeyboardShortcuts()` → Modal component
- `createShortcutsUI()` → KeyboardShortcuts.svelte component
- `addTooltipsToTruncatedFilenames()` → `FileManager.svelte` tooltip logic

**Feedback & Status Display (8 functions):**

- `showImmediateLoading()` → Loading.svelte component + `uiStore.setLoading()`
- `showError()` → ErrorDisplay.svelte component + `uiStore.setError()`
- `clearError()` → `uiStore.clearError()`
- `showStatus()` → StatusBar.svelte component + `uiStore.setStatus()`
- `showColorMappingStatus()` → StatusBar.svelte color mapping display
- `updateFPSDisplay()` → `PerformanceMonitor.svelte` reactive FPS display
- `showCameraConventionFeedback()` → `CameraControls.svelte` feedback
- `showTransparencyFeedback()` → `RenderingSettings.svelte` feedback

**Material & Rendering Settings (12 functions):**

- `toggleTransparency()` → `RenderingSettings.svelte` transparency toggle
- `updateAllMaterialsForTransparency()` → `renderingStore.updateTransparency()`
- `toggleScreenSpaceScaling()` → `RenderingSettings.svelte` scaling toggle
- `updateAllPointSizesForDistance()` → `renderingStore.updatePointSizes()`
- `calculateScreenSpacePointSize()` → `renderingStore.calculatePointSize()`
- `restoreOriginalPointSizes()` → `renderingStore.restorePointSizes()`
- `updatePointSize()` → `FileManager.svelte` point size slider
- `getColorName()` → `FileManager.svelte` color display
- `getColorOptions()` → `FileManager.svelte` color options
- `updatePoseAppearance()` → `FileManager.svelte` pose appearance
- `updatePoseLabels()` → `FileManager.svelte` pose labels
- `updatePoseScaling()` → `FileManager.svelte` pose scaling

### Sequence Mode Functions → `components/ui/SequencePlayer.svelte`

**Sequence Playback (12 functions):**

- `initializeSequence()` → `SequencePlayer.svelte` initialization
- `updateSequenceUI()` → `SequencePlayer.svelte` reactive UI updates
- `playSequence()` → `SequencePlayer.svelte` play button
- `pauseSequence()` → `SequencePlayer.svelte` pause button
- `stopSequence()` → `SequencePlayer.svelte` stop button
- `stepSequence()` → `SequencePlayer.svelte` step controls
- `seekSequence()` → `SequencePlayer.svelte` seek slider
- `loadSequenceFrame()` → `sequenceStore.loadFrame()`
- `useSequenceObject()` → `sequenceStore.useObject()`
- `cacheSequenceOnly()` → `sequenceStore.cacheObject()`
- `swapSequenceObject()` → `sequenceStore.swapObject()`
- `ensureSequenceVisibility()` → `sequenceStore.ensureVisibility()`

**Sequence File Handlers (7 functions):**

- `sequenceHandleUltimate()` → `sequenceStore.handleUltimate()`
- `sequenceHandlePly()` → `sequenceStore.handlePly()`
- `sequenceHandleXyz()` → `sequenceStore.handleXyz()`
- `sequenceHandleObj()` → `sequenceStore.handleObj()`
- `sequenceHandleStl()` → `sequenceStore.handleStl()`
- `sequenceHandleDepth()` → `sequenceStore.handleDepth()`
- `trimNormalModeArraysFrom()` → `sequenceStore.trimArrays()`

### Selection & Interaction Functions → `components/threejs/InteractionHandler.svelte`

**Object Selection (12 functions):**

- `onDoubleClick()` → `InteractionHandler.svelte` double-click handler
- `selectCameraProfile()` → `InteractionHandler.svelte` camera selection
- `selectCameraObject()` → `InteractionHandler.svelte` camera object selection
- `selectPoseKeypoint()` → `InteractionHandler.svelte` pose keypoint selection
- `selectPoseObject()` → `InteractionHandler.svelte` pose object selection
- `selectTriangleMesh()` → `InteractionHandler.svelte` triangle mesh selection
- `selectPointCloud()` → `InteractionHandler.svelte` point cloud selection
- `selectPointCloudWithLogging()` → `InteractionHandler.svelte` logged selection
- `fallbackPixelDistanceSelection()` → `InteractionHandler.svelte` fallback
  selection
- `fallbackPixelDistanceSelectionWithLogging()` → `InteractionHandler.svelte`
  logged fallback
- `computeRenderedPointSize()` → `InteractionHandler.svelte` size computation
- `computeSelectionPixelRadius()` → `InteractionHandler.svelte` radius
  computation
- `convertPixelsToWorldUnits()` → `InteractionHandler.svelte` pixel conversion

### Camera Profile & Pose Functions → `components/ui/CameraProfileManager.svelte`

**Camera Profile Management (10 functions):**

- `handleCameraProfile()` → `CameraProfileManager.svelte` profile handler
- `createCameraVisualization()` → `CameraProfileManager.svelte` visualization
- `createCameraBodyGeometry()` → `CameraProfileManager.svelte` body geometry
- `createDirectionArrow()` → `CameraProfileManager.svelte` direction arrow
- `createCameraLabel()` → `CameraProfileManager.svelte` label creation
- `toggleCameraVisibility()` → `CameraProfileManager.svelte` visibility toggle
- `updateCameraButtonState()` → `CameraProfileManager.svelte` reactive button
- `toggleCameraProfileLabels()` → `CameraProfileManager.svelte` labels toggle
- `toggleCameraProfileCoordinates()` → `CameraProfileManager.svelte` coordinates
  toggle
- `applyCameraScale()` → `CameraProfileManager.svelte` scale control

**Pose Processing (8 functions):**

- `applyPoseConvention()` → `PoseManager.svelte` convention handler
- `applyPoseFilters()` → `PoseManager.svelte` filter application
- `normalizePose()` → `poseStore.normalizePose()`
- `autoConnectKnn()` → `poseStore.autoConnect()`
- `buildPoseGroup()` → `poseStore.buildGroup()`
- `updatePoseAppearance()` → `PoseManager.svelte` appearance updates
- `updatePoseLabels()` → `PoseManager.svelte` label updates
- `updatePoseScaling()` → `PoseManager.svelte` scaling updates

### Calibration & File Format Functions → `components/depth/CalibrationManager.svelte`

**Calibration File Handling (8 functions):**

- `openCalibrationFileDialog()` → `CalibrationManager.svelte` file dialog
- `displayCalibrationInfo()` → `CalibrationManager.svelte` info display
- `onCameraSelectionChange()` → `CalibrationManager.svelte` selection handler
- `parseCalibrationFile()` → `calibrationStore.parseFile()`
- `handleCalibrationFileSelected()` → `calibrationStore.handleFileSelected()`
- `populateFormFromCalibration()` → `CalibrationManager.svelte` form population
- `handleCameraParamsCancelled()` → `CalibrationManager.svelte` cancel handler
- `handleCameraParamsError()` → `CalibrationManager.svelte` error handler

### Message Handling Functions → `lib/message-handler.ts`

**VS Code Communication (8 functions):**

- `setupMessageHandler()` → `MessageHandler.initialize()`
- `handleTimingMessage()` → `MessageHandler.handleTiming()`
- `handleBrowserMessage()` → `MessageHandler.handleBrowser()`
- `initializeBrowserFileHandler()` → `MessageHandler.initBrowser()`
- `setupBrowserFileHandlers()` → `MessageHandler.setupBrowser()`
- `handleStartLargeFile()` → `MessageHandler.handleLargeFileStart()`
- `handleLargeFileChunk()` → `MessageHandler.handleLargeFileChunk()`
- `handleSaveSpatialFileResult()` → `MessageHandler.handleSaveResult()`

### Data Parsing Functions → Keep in `lib/parsers/` (Minimal Changes)

**Format-Specific Parsing (2 functions):**

- `parseXyzVariantData()` → Keep as utility function
- `handleDefaultDepthSettings()` → Move to `DepthConverter.svelte`

## Migration Priority by Function Count

1. **File Management** (33 functions) → High Priority
2. **Transformation System** (18 functions) → High Priority
3. **Camera & Controls** (26 functions) → High Priority
4. **Depth Processing** (28 functions) → Medium Priority
5. **Rendering & Performance** (27 functions) → Medium Priority
6. **Sequence Mode** (19 functions) → Low Priority
7. **Selection & Interaction** (13 functions) → Low Priority
8. **UI State & Display** (28 functions) → Low Priority
9. **Camera Profiles & Poses** (18 functions) → Low Priority

This mapping ensures every function has a clear destination in the new Svelte
architecture while maintaining logical component boundaries and proper
separation of concerns.

## Continuous Functionality Guarantee

### Both Targets Work Throughout Migration

**VS Code Extension**:

- **Always functional**: F5 → Extension Development Host → Load test files from
  `testfiles/`
- **Webpack builds**: `npm run compile` always produces working
  `out/extension.js` and `out/webview/main.js`
- **Testing**: All existing test suites continue to pass
- **Feature flags**: Allow selective enabling of Svelte components

**Standalone Website**:

- **Always functional**: `cd website && npm run dev` → http://localhost:8080
  works
- **Independent build**: `cd website && npm run build` produces working dist
- **Deployment**: Website deployment to https://f-kleinicke.de remains
  unaffected
- **Same codebase**: Uses identical `website/src/main.ts` as VS Code webview

### Risk Mitigation Strategy

**Phase-by-Phase Safety**:

1. **Phase 1**: Only adds Svelte build support, original code unchanged
2. **Phase 2**: Creates parallel stores, original state management unchanged
3. **Phase 3**: Creates parallel components, original DOM elements unchanged
4. **Phase 4-6**: Feature flags control which implementation is active
5. **Phase 7**: Only after thorough testing, original code is removed

**Rollback Plan**:

- **Immediate rollback**: Set all feature flags to `false`
- **Emergency rollback**: Remove Svelte files, revert webpack config
- **Git branches**: Each phase in separate branch for easy reversion

**Testing at Each Phase**:

```bash
# After each phase, validate both targets:

# VS Code Extension Testing
npm run compile
# F5 → Extension Development Host
# Load testfiles/ply/*.ply, testfiles/stl/*.stl, etc.
# Verify all functionality works

# Standalone Website Testing
cd website
npm run dev
# Open localhost:8080
# Load files via browser file picker
# Verify all functionality works

# Both should work identically
```

### Migration Success Criteria

**Phase Completion Requirements**:

- ✅ VS Code Extension: All file formats load and display correctly
- ✅ Standalone Website: All file formats load and display correctly
- ✅ Performance: No regression in rendering performance
- ✅ Memory: No memory leaks or increased usage
- ✅ Build: Both webpack bundles build successfully
- ✅ Tests: All existing tests continue to pass

**Final Migration Completion**:

- ✅ Original 12,795-line `main.ts` replaced with modular Svelte components
- ✅ Both VS Code extension and standalone website work identically
- ✅ All 364 functions migrated to appropriate Svelte architecture
- ✅ Improved maintainability with <50 component files
- ✅ No functional regressions from original implementation

This incremental, feature-flagged approach ensures that the visualizer **never
breaks** during migration and both deployment targets remain fully functional
throughout the entire process.
