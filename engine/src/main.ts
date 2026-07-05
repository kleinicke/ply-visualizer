import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { EDLPass } from './postprocessing/EDLPass';
import {
  SpatialVertex,
  SpatialFace,
  SpatialData,
  CameraParams,
  DepthConversionResult,
} from './interfaces';
import { CustomArcballControls, TurntableControls } from './controls';
import { initializeThemes, getThemeByName, applyTheme, getCurrentThemeName } from './themes';
import { RotationCenterManager, RotationCenterMode } from './RotationCenterManager';
import { MeasurementManager } from './MeasurementManager';
import { SelectionManager, SelectionContext } from './SelectionManager';

declare const GeoTIFF: any;
declare const acquireVsCodeApi: () => any;

// Environment detection - works in both VSCode and browser
const isVSCode = typeof acquireVsCodeApi !== 'undefined';

// Shared file handling functionality
import {
  detectFileType,
  DEFAULT_COLORS,
  shouldRequestDepthParams,
  generateDepthRequestId,
  createDefaultCameraParams,
  BrowserMessageHandler,
  collectCameraParamsForBrowserPrompt,
} from './fileHandler';

// Depth processing modules
import { ColorImageLoader } from './colorImageLoader';
import { PerfTimer, perfLog, setPerfSink } from './utils/perfLog';
import { createRotationMatrix, parseMatrixInput } from './utils/matrix';
import { escapeHtml, addTooltipsToTruncatedFilenames } from './ui/dialogs';
import * as sequencePlayback from './sequencePlayback';
import * as pose from './pose';
import * as renderStats from './renderStats';
import * as uiStatus from './ui/status';
import * as intensity from './utils/intensity';
import * as commentSettings from './depth/commentSettings';
import * as cameraProfile from './cameraProfile';
import * as renderModeToggles from './renderModeToggles';
import * as colorModeUtils from './colorMode';
import * as pointSizeScaling from './pointSizeScaling';
import * as depthPanelState from './depth/panelState';
import * as sceneBrightness from './sceneBrightness';
import * as depthDefaultSettings from './depth/defaultSettings';
import * as calibrationForm from './depth/calibrationForm';
import * as controlSchemeSwitcher from './controlSchemeSwitcher';
import * as cameraConvention from './cameraConvention';
import * as edl from './edl';
import * as transparency from './transparency';
import * as plyExport from './plyExport';
import * as rotationCenterFeature from './rotationCenterFeature';
import * as axesFeature from './axesFeature';
import * as transformationMatrix from './transformationMatrix';
import * as depthCameraParamsPrompt from './depthCameraParamsPrompt';
import * as formatDataHandlers from './formatDataHandlers';
import * as transformDialogs from './transformDialogs';
import * as browserFileDragDrop from './browserFileDragDrop';
import * as liveDepthUpdate from './depth/liveDepthUpdate';
import * as normalsVisualizer from './normalsVisualizer';
import * as depthConversionPipeline from './depth/depthConversionPipeline';
import * as colorImageForDepth from './depth/colorImageForDepth';
import * as largeFileChunking from './largeFileChunking';
import * as binaryDataHandlers from './binaryDataHandlers';
import * as datasetWorkflow from './depth/datasetWorkflow';
import { mountSvelteSmokeTest } from './svelteSmokeTestMount';
import { formatFileSize } from './utils/format';
import { ColorProcessor } from './colorProcessor';
import { DepthConverter } from './depth/DepthConverter';
import { DepthWorkerClient } from './depth/DepthWorkerClient';

/**
 * Modern point cloud visualizer with unified file management and Depth image processing
 * Works in both VSCode extension and standalone browser environments
 */

class PointCloudVisualizer {
  vscode: any = isVSCode
    ? acquireVsCodeApi()
    : {
        // Mock VS Code API for browser version - fully functional
        postMessage: (message: any) => {
          console.log('🌐 Browser mode handling:', message.type);
          this.handleBrowserMessage(message);
        },
      };

  // Browser file handler
  browserFileHandler: BrowserMessageHandler | null = null;
  scene!: THREE.Scene;
  camera!: THREE.PerspectiveCamera;
  renderer!: THREE.WebGLRenderer;
  // True between a WebGL context loss and its restoration. While lost, the GPU
  // is gone, so we must not render or touch GL objects — doing so throws and
  // crashes the webview. This is the safety net for the multi-window
  // out-of-VRAM case (each window is a separate context sharing one GPU).
  private contextLost = false;
  controls!: TrackballControls | OrbitControls | CustomArcballControls | TurntableControls;

  // Camera control state
  controlType: 'trackball' | 'orbit' | 'inverse-trackball' | 'arcball' | 'cloudcompare' =
    'trackball';
  screenSpaceScaling: boolean = false;
  allowTransparency: boolean = false;

  // Eye Dome Lighting (EDL) state
  edlEnabled: boolean = false;
  edlStrength: number = 1.0;
  edlRadius: number = 1.4;
  edlSecondRingWeight: number = 0.0;
  brightnessStops: number = 0.0;
  backgroundBrightness: number = 13;
  effectComposer: EffectComposer | null = null;
  edlPass: EDLPass | null = null;
  rotationCenterManager: RotationCenterManager = new RotationCenterManager();
  private measurementManager: MeasurementManager | null = null;
  private selectionManager: SelectionManager | null = null;

  // On-demand rendering state
  needsRender: boolean = false;
  private animationId: number | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // Welcome message state
  isFileLoading: boolean = false;
  // When loading additional file(s) into a non-empty scene, we show progress as a
  // row in the Files list instead of a blocking overlay (the current cloud stays
  // interactive). Holds the label/detail of the in-progress add, or null.
  private pendingLoadLabel: string | null = null;
  private pendingLoadDetail: string = '';

  // FPS tracking
  fpsFrameTimes: number[] = [];
  lastFpsUpdate: number = 0;
  currentFps: number = 0;
  previousFps: number = 0;

  // Frame time tracking
  private lastFrameTime: number = 0;
  frameRenderTimes: number[] = [];
  currentFrameTime: number = 0;

  // GPU timing
  gpuTimerExtension: any = null;
  gpuQueries: any[] = [];
  gpuTimes: number[] = [];
  currentGpuTime: number = 0;

  // Camera tracking for screen-space scaling
  private lastScalingUpdate: number = 0;

  // Unified file management
  spatialFiles: SpatialData[] = [];
  meshes: (THREE.Mesh | THREE.Points | THREE.LineSegments)[] = [];
  normalsVisualizers: (THREE.LineSegments | null)[] = [];
  vertexPointsObjects: (THREE.Points | null)[] = []; // Vertex points for triangle meshes
  multiMaterialGroups: (THREE.Group | null)[] = []; // Multi-material Groups for OBJ files
  materialMeshes: (THREE.Object3D[] | null)[] = []; // Sub-meshes for multi-material OBJ files
  fileVisibility: boolean[] = [];
  private isFirstFileLoad: boolean = true; // Track if this is the first file being loaded

  // Universal rendering mode states for each file
  solidVisible: boolean[] = []; // Solid mesh rendering
  wireframeVisible: boolean[] = []; // Wireframe rendering
  pointsVisible: boolean[] = []; // Points rendering
  normalsVisible: boolean[] = []; // Normals lines rendering

  private useOriginalColors = true; // Default to original colors
  pointSizes: number[] = []; // Individual point sizes for each point cloud

  // Sequence mode state
  sequenceMode = false;
  sequenceFiles: string[] = [];
  sequenceIndex = 0;
  sequenceTargetIndex = 0;
  sequenceDidInitialFit = false;
  sequenceTimer: number | null = null;
  sequenceFps = 2; // ~2 frames per second
  isSequencePlaying = false;
  sequenceCache = new Map<number, THREE.Object3D>();
  sequenceCacheOrder: number[] = [];
  maxSequenceCache = 6; // keep more frames when navigating back
  individualColorModes: string[] = []; // Individual color modes: 'original', 'assigned', or color index
  appliedMtlColors: (number | null)[] = []; // Store applied MTL hex colors for each file
  appliedMtlNames: (string | null)[] = []; // Store applied MTL material names for each file
  appliedMtlData: (any | null)[] = []; // Store applied MTL data for each file

  // Per-file Depth data storage for reprocessing
  fileDepthData: Map<
    number,
    {
      originalData: ArrayBuffer;
      cameraParams: CameraParams;
      fileName: string;
      depthDimensions: { width: number; height: number };
      colorImageData?: ImageData;
      colorImageName?: string;
    }
  > = new Map();

  // Calibration data storage for each depth file
  calibrationData?: Map<number, any>;

  // Depth converter instance
  private depthConverter: DepthConverter = new DepthConverter();
  private depthWorkerClient: DepthWorkerClient = new DepthWorkerClient(this.depthConverter);

  // Pose entries managed like files but stored as Object3D groups
  poseGroups: THREE.Group[] = [];
  poseMeta: {
    jointCount: number;
    edgeCount: number;
    fileName: string;
    invalidJoints?: number;
    // Dataset extras (Halpe or similar)
    jointColors?: [number, number, number][]; // normalized 0-1
    linkColors?: [number, number, number][]; // normalized 0-1
    keypointNames?: string[];
    skeletonLinks?: Array<[number, number]>;
    jointScores?: number[];
    jointUncertainties?: Array<[number, number, number]>;
  }[] = [];
  // Per-pose feature toggles
  poseUseDatasetColors: boolean[] = [];
  poseShowLabels: boolean[] = [];
  poseScaleByScore: boolean[] = [];
  poseScaleByUncertainty: boolean[] = [];
  poseConvention: ('opencv' | 'opengl')[] = [];
  poseMinScoreThreshold: number[] = [];
  poseMaxUncertaintyThreshold: number[] = [];
  poseLabelsGroups: (THREE.Group | null)[] = [];
  poseJoints: Array<Array<{ x: number; y: number; z: number; valid?: boolean }>> = [];
  poseEdges: Array<Array<[number, number]>> = [];

  // Camera visualization
  cameraGroups: THREE.Group[] = [];
  cameraNames: string[] = [];
  cameraVisibility: boolean = true;
  cameraShowLabels: boolean[] = [];
  cameraShowCoords: boolean[] = [];

  // Rotation matrices
  cameraMatrix: THREE.Matrix4 = new THREE.Matrix4(); // Current camera position and rotation
  transformationMatrices: THREE.Matrix4[] = []; // Individual transformation matrices for each point cloud
  private frameCount: number = 0; // Frame counter for UI updates
  private lastCameraPosition: THREE.Vector3 = new THREE.Vector3(); // Track camera position changes
  private lastCameraQuaternion: THREE.Quaternion = new THREE.Quaternion(); // Track camera rotation changes
  private lastRotationCenter: THREE.Vector3 = new THREE.Vector3(); // Track rotation center changes
  private arcballInvertRotation: boolean = false; // preference for arcball handedness

  // Lighting/material toggles
  private useUnlitPly: boolean = false;
  private useFlatLighting: boolean = false;

  // UI state for collapsible file sections
  private fileItemsCollapsed: boolean[] = [];
  private lightingMode: 'normal' | 'flat' | 'unlit' = 'normal';

  // Large file chunked loading state
  chunkedFileState: Map<
    string,
    {
      fileName: string;
      totalVertices: number;
      totalChunks: number;
      receivedChunks: number;
      vertices: SpatialVertex[];
      hasColors: boolean;
      hasNormals: boolean;
      faces: SpatialFace[];
      format: string;
      comments: string[];
      messageType: string;
      startTime: number;
      firstChunkTime: number;
      lastChunkTime: number;
    }
  > = new Map();

  // Adaptive decimation tracking

  // Depth processing state - support multiple pending Depth files
  pendingDepthFiles: Map<
    string,
    {
      data: ArrayBuffer;
      fileName: string;
      shortPath?: string;
      isAddFile: boolean;
      requestId: string;
      sceneMetadata?: any;
    }
  > = new Map();

  // Dataset texture storage for later application to point clouds
  datasetTextures: Map<
    string,
    {
      fileName: string;
      sceneName: string;
      data: ArrayBuffer;
      arrayBuffer: ArrayBuffer;
    }
  > = new Map();

  // Depth conversion tracking
  originalDepthFileName: string | null = null;
  currentCameraParams: CameraParams | null = null;
  private depthDimensions: { width: number; height: number } | null = null;
  liveDepthUpdateFiles = new Set<number>();
  liveDepthUpdateInFlight = new Set<number>();
  liveDepthUpdateQueued = new Set<number>();
  liveDepthUpdateTimers = new Map<number, number>();
  liveDepthUpdateVersions = new Map<number, number>();
  useLinearColorSpace: boolean = true; // Default: toggle is inactive; renderer still outputs sRGB
  axesPermanentlyVisible: boolean = false; // Persistent axes visibility toggle
  // Color space handling: always output sRGB, optionally convert source sRGB colors to linear before shading

  // Default depth settings for new files
  defaultDepthSettings: CameraParams = {
    fx: 1000,
    fy: undefined, // Optional, defaults to fx if not provided
    cx: undefined, // Will be auto-calculated per image based on dimensions
    cy: undefined, // Will be auto-calculated per image based on dimensions
    cameraModel: 'pinhole-ideal',
    depthType: 'euclidean',
    convention: 'opengl',
    pngScaleFactor: 1000, // Default for PNG files
    depthScale: 1.0, // Default scale factor for mono depth networks
    depthBias: 0.0, // Default bias for mono depth networks
  };

  // Color image loader and processor
  colorImageLoader = new ColorImageLoader();
  colorProcessor = new ColorProcessor();
  convertSrgbToLinear: boolean = true; // Default: remove gamma from source colors
  private lastGeometryMs: number = 0;
  lastAbsoluteMs: number = 0;

  private optimizeForPointCount(material: THREE.PointsMaterial, pointCount: number): void {
    // Render points as discs instead of the default GL squares. A small circular
    // alpha texture is sampled per fragment (via gl_PointCoord) and alphaTest
    // discards the corners — so points are round and still opaque (no alpha
    // blending pipeline). The white texture only carries the round mask; the
    // per-vertex color is preserved (PointsMaterial multiplies map × color).
    material.map = this.getRoundPointTexture();
    material.alphaTest = 0.5; // keep the disc, discard the corners

    // Transparency only affects the soft rim; the disc shape comes from alphaTest.
    material.transparent = this.allowTransparency;

    material.depthTest = true;
    material.depthWrite = true;
    material.sizeAttenuation = true; // Keep world-space sizing
    material.side = THREE.FrontSide; // Default for points

    // Force material update
    material.needsUpdate = true;
  }

  private roundPointTexture: THREE.Texture | null = null;

  /**
   * Lazily build (once) a small white circular alpha texture used to make points
   * round. Alpha is 1 inside the disc with a 1–2px soft rim for anti-aliasing,
   * 0 in the corners; combined with alphaTest=0.5 this yields clean round points.
   */
  private getRoundPointTexture(): THREE.Texture {
    if (this.roundPointTexture) {
      return this.roundPointTexture;
    }
    const size = 64;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    const img = ctx.createImageData(size, size);
    const c = (size - 1) / 2;
    const smooth = (e0: number, e1: number, x: number) => {
      const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
      return t * t * (3 - 2 * t);
    };
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const dx = (x - c) / c;
        const dy = (y - c) / c;
        const d = Math.sqrt(dx * dx + dy * dy); // 0 at center, 1 at edge
        const a = 1 - smooth(0.9, 1.0, d);
        const i = (y * size + x) * 4;
        img.data[i] = 255;
        img.data[i + 1] = 255;
        img.data[i + 2] = 255;
        img.data[i + 3] = Math.round(a * 255);
      }
    }
    ctx.putImageData(img, 0, 0);
    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    this.roundPointTexture = tex;
    return tex;
  }

  /**
   * Make a PointsMaterial decode its (raw 8-bit sRGB) vertex colors to linear in
   * the fragment shader, so we can store point colors as Uint8 (4x less memory)
   * instead of a baked Float32 [0,1] array — see buildOriginalColorArray.
   *
   * The decode is gated by material.userData.srgbDecode and uses the exact same
   * sRGB→linear formula as colorProcessor's LUT, so the result is visually
   * identical to the old path. It only applies in 'original' color mode with the
   * gamma toggle on; intensity/assigned colors (already linear) keep srgbDecode
   * false. Wired through onBeforeCompile (a no-op when disabled) with a matching
   * customProgramCacheKey so toggling recompiles correctly. Idempotent.
   */
  /**
   * Whether a point cloud's vertex colors are raw sRGB that the shader should
   * decode. True only in 'original' mode with the gamma toggle on, and NOT for
   * depth-derived clouds — those colors are already linear, so decoding them
   * would darken them incorrectly. (Intensity/assigned modes aren't 'original'.)
   */
  pointColorsNeedSrgbDecode(data: SpatialData, colorMode: string): boolean {
    return colorModeUtils.pointColorsNeedSrgbDecode(this, data, colorMode);
  }

  setupPointSrgbDecode(material: THREE.PointsMaterial): void {
    colorModeUtils.setupPointSrgbDecode(material);
  }

  private toggleTransparency(): void {
    transparency.toggleTransparency(this);
  }

  private updateAllMaterialsForTransparency(): void {
    transparency.updateAllMaterialsForTransparency(this);
  }

  private toggleScreenSpaceScaling(): void {
    pointSizeScaling.toggleScreenSpaceScaling(this);
  }

  private updateAllPointSizesForDistance(): void {
    pointSizeScaling.updateAllPointSizesForDistance(this);
  }

  private calculateScreenSpacePointSize(baseSize: number, cameraDistance: number): number {
    return pointSizeScaling.calculateScreenSpacePointSize(baseSize, cameraDistance);
  }

  private restoreOriginalPointSizes(): void {
    pointSizeScaling.restoreOriginalPointSizes(this);
  }

  private initGPUTiming(): void {
    renderStats.initGPUTiming(this);
  }

  private startGPUTiming(): any {
    return renderStats.startGPUTiming(this);
  }

  private endGPUTiming(query: any): void {
    renderStats.endGPUTiming(this, query);
  }

  private updateGPUTiming(): void {
    renderStats.updateGPUTiming(this);
  }

  private createOptimizedPointCloud(
    geometry: THREE.BufferGeometry,
    material: THREE.PointsMaterial
  ): THREE.Points {
    // Optimize geometry for GPU
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    if (positions && positions.count > 50000) {
      // For very large point clouds, try to reduce vertex data transfer
      geometry.deleteAttribute('normal'); // Points don't need normals
      geometry.computeBoundingBox(); // Help with frustum culling
      geometry.computeBoundingSphere();
    }

    const points = new THREE.Points(geometry, material);

    return points;
  }

  // Predefined colors for different files - use shared constants
  readonly fileColors: [number, number, number][] = DEFAULT_COLORS.FILE_COLORS;

  constructor() {
    // Forward PERF lines to the extension's "3D Visualizer" Output channel.
    if (isVSCode) {
      setPerfSink((line: string) => this.vscode.postMessage({ type: 'perfLog', line }));
    }
    this.init();
  }

  private async init(): Promise<void> {
    try {
      this.initThreeJS();
      this.applyEnvironmentSpecificUI();
      this.setupEventListeners();
      mountSvelteSmokeTest();

      // Setup color image loader callback
      this.colorImageLoader.setStatusCallback((message, type) => {
        this.showColorMappingStatus(message, type);
      });

      // Setup welcome message interactivity
      const welcomeAddBtn = document.getElementById('welcome-add-cloud');
      if (welcomeAddBtn) {
        welcomeAddBtn.addEventListener('click', () => {
          this.triggerOpenFile();
        });
      }

      // Initial check for formatted welcome message
      this.updateWelcomeMessageVisibility();

      // Setup drag handle in both environments
      this.setupPanelResizeAndDrag();
      this.setupBrowserFileHandlers();

      if (isVSCode) {
        // VSCode extension environment
        this.setupMessageHandler();
        console.log('📤 Requesting default depth settings from extension...');
        this.vscode.postMessage({
          type: 'requestDefaultDepthSettings',
        });
      } else {
        // Browser environment
        this.initializeBrowserFileHandler();
        console.log('🌐 Initializing standalone browser version...');
      }
    } catch (error) {
      this.showError(
        `Failed to initialize 3D Visualizer: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  private initThreeJS(): void {
    // Scene
    this.scene = new THREE.Scene();
    this.applyBackgroundBrightness();

    // Camera
    const container = document.getElementById('viewer-container');
    if (!container) {
      throw new Error('Viewer container not found');
    }

    this.camera = new THREE.PerspectiveCamera(
      75,
      container.clientWidth / container.clientHeight,
      0.001,
      1000000 // Further increased far plane for disparity files
    );
    this.camera.position.set(1, 1, 1);

    // Initialize last camera state for change detection
    this.lastCameraPosition.copy(this.camera.position);
    this.lastCameraQuaternion.copy(this.camera.quaternion);

    // Renderer
    const canvas = document.getElementById('three-canvas') as HTMLCanvasElement;
    if (!canvas) {
      throw new Error('Canvas not found');
    }

    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true, // Re-enable antialiasing for quality
      alpha: true,
      preserveDrawingBuffer: false, // better performance
      powerPreference: 'high-performance', // Keep discrete GPU preference
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.applySceneBrightness();
    this.applyBackgroundBrightness();
    // Shadows are disabled: no object in the scene sets castShadow/receiveShadow,
    // so the per-frame shadow pass + 2048² depth target produced nothing visible
    // — pure overhead. (If shadow-casting meshes are ever added, re-enable here
    // and set castShadow/receiveShadow on them.)
    this.renderer.shadowMap.enabled = false;

    this.setupContextLossHandling(canvas);

    // Initial check for formatted welcome message
    this.updateWelcomeMessageVisibility();

    // Initialize GPU timing if supported
    this.initGPUTiming();

    // Re-enable object sorting for better visual quality
    this.renderer.sortObjects = true;

    // Initialize EDL post-processing pipeline
    this.initEDLComposer();

    // Set initial color space based on preference
    this.updateRendererColorSpace();

    // Initialize controls
    this.initializeControls();

    // Initialize measurement manager
    this.measurementManager = new MeasurementManager(this.scene, this.camera, this.renderer);

    // Initialize selection manager
    this.selectionManager = new SelectionManager(this.getSelectionContext());

    // Lighting
    this.initSceneLighting();

    // Add coordinate axes helper with labels
    this.addAxesHelper();

    // Window resize with ResizeObserver for comprehensive dimension change detection
    window.addEventListener('resize', this.onWindowResize.bind(this));
    this.setupResizeObserver();

    // Global UI interaction listener - triggers render on any button/input change
    document.addEventListener('click', e => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'BUTTON' ||
        target.classList.contains('btn') ||
        target.closest('button') ||
        target.closest('.btn')
      ) {
        this.requestRender();
        // this.requestRender();
      }
    });

    document.addEventListener('input', e => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'SELECT') {
        this.requestRender();
        // this.requestRender();
      }
    });

    // Double-click to change rotation center (like CloudCompare)
    this.renderer.domElement.addEventListener('dblclick', this.onDoubleClick.bind(this));

    // Start render loop
    this.startRenderLoop();

    // Clean up on page unload
    window.addEventListener('beforeunload', () => {
      this.dispose();
    });
  }

  initializeControls(): void {
    // Store current camera state before disposing old controls
    const currentCameraPosition = this.camera.position.clone();
    const currentTarget = this.controls ? this.controls.target.clone() : new THREE.Vector3(0, 0, 0);
    const currentUp = this.camera.up.clone();

    // Dispose of existing controls if any
    if (this.controls) {
      this.controls.dispose();
    }

    if (this.controlType === 'trackball') {
      this.controls = new TrackballControls(this.camera, this.renderer.domElement);
      const trackballControls = this.controls as TrackballControls;
      trackballControls.rotateSpeed = 5.0;
      trackballControls.zoomSpeed = 2.5;
      trackballControls.panSpeed = 1.5;
      trackballControls.noZoom = false;
      trackballControls.noPan = false;
      trackballControls.staticMoving = false;
      trackballControls.dynamicDampingFactor = 0.2;

      // Set up screen coordinates for proper rotation
      trackballControls.screen.left = 0;
      trackballControls.screen.top = 0;
      trackballControls.screen.width = this.renderer.domElement.clientWidth;
      trackballControls.screen.height = this.renderer.domElement.clientHeight;
    } else if (this.controlType === 'inverse-trackball') {
      this.controls = new TrackballControls(this.camera, this.renderer.domElement);
      const trackballControls = this.controls as TrackballControls;
      trackballControls.rotateSpeed = 1.0; // Reduced to 1.0 as requested
      trackballControls.zoomSpeed = 2.5;
      trackballControls.panSpeed = 1.5;
      trackballControls.noZoom = false;
      trackballControls.noPan = false;
      trackballControls.staticMoving = false;
      trackballControls.dynamicDampingFactor = 0.2;

      // Set up screen coordinates for proper rotation
      trackballControls.screen.left = 0;
      trackballControls.screen.top = 0;
      trackballControls.screen.width = this.renderer.domElement.clientWidth;
      trackballControls.screen.height = this.renderer.domElement.clientHeight;

      // Apply inversion
      this.setupInvertedControls();
    } else if (this.controlType === 'arcball') {
      this.controls = new CustomArcballControls(this.camera, this.renderer.domElement);
      const arc = this.controls as CustomArcballControls;
      arc.rotateSpeed = 1.0;
      arc.zoomSpeed = 1.0;
      arc.panSpeed = 1.0;
      // Apply preference
      arc.invertRotation = this.arcballInvertRotation;
    } else if (this.controlType === 'cloudcompare') {
      this.controls = new TurntableControls(this.camera, this.renderer.domElement);
      const cc = this.controls as TurntableControls;
      cc.rotateSpeed = 1.0;
      cc.zoomSpeed = 1.0;
      cc.panSpeed = 1.0;
      cc.worldUp.copy(this.camera.up.lengthSq() > 0 ? this.camera.up : new THREE.Vector3(0, 1, 0));
    } else {
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      const orbitControls = this.controls as OrbitControls;
      orbitControls.enableDamping = true;
      orbitControls.dampingFactor = 0.2;
      orbitControls.screenSpacePanning = false;
      orbitControls.minDistance = 0.001;
      orbitControls.maxDistance = 50000; // Increased to match camera far plane
    }

    // Set up axes visibility for all control types
    this.setupAxesVisibility();

    // Restore camera state to prevent jumps
    this.camera.position.copy(currentCameraPosition);
    this.camera.up.copy(currentUp);
    this.controls.target.copy(currentTarget);
    this.controls.update();

    // Initialize rotation center tracking
    this.lastRotationCenter.copy(this.controls.target);

    // Update control status to highlight active button
    this.updateControlStatus();
  }

  private setupAxesVisibility(): void {
    axesFeature.setupAxesVisibility(this);
  }

  private setupInvertedControls(): void {
    if (this.controlType !== 'inverse-trackball') {
      return;
    }

    // TRACKBALL ROTATION DIRECTION INVERSION - Override the _rotateCamera method
    // debug: controls inversion setup

    const controls = this.controls as TrackballControls;

    // Override _rotateCamera to invert up vector rotation using quaternion.invert()
    (controls as any)._rotateCamera = function () {
      const _moveDirection = new THREE.Vector3();
      const _eyeDirection = new THREE.Vector3();
      const _objectUpDirection = new THREE.Vector3();
      const _objectSidewaysDirection = new THREE.Vector3();
      const _axis = new THREE.Vector3();
      const _quaternion = new THREE.Quaternion();

      _moveDirection.set(
        this._moveCurr.x - this._movePrev.x,
        this._moveCurr.y - this._movePrev.y,
        0
      );
      let angle = _moveDirection.length();

      if (angle) {
        this._eye.copy(this.object.position).sub(this.target);

        _eyeDirection.copy(this._eye).normalize();
        _objectUpDirection.copy(this.object.up).normalize();
        _objectSidewaysDirection.crossVectors(_objectUpDirection, _eyeDirection).normalize();

        _objectUpDirection.setLength(this._moveCurr.y - this._movePrev.y);
        _objectSidewaysDirection.setLength(this._moveCurr.x - this._movePrev.x);

        _moveDirection.copy(_objectUpDirection.add(_objectSidewaysDirection));

        _axis.crossVectors(_moveDirection, this._eye).normalize();

        angle *= this.rotateSpeed;
        _quaternion.setFromAxisAngle(_axis, angle);

        // Apply normal rotation to camera position
        this._eye.applyQuaternion(_quaternion);

        // Apply inverted rotation to up vector
        this.object.up.applyQuaternion(_quaternion.clone().invert());

        this._lastAxis.copy(_axis);
        this._lastAngle = angle;
      } else if (!this.staticMoving && this._lastAngle) {
        this._lastAngle *= Math.sqrt(1.0 - this.dynamicDampingFactor);
        this._eye.copy(this.object.position).sub(this.target);

        _quaternion.setFromAxisAngle(this._lastAxis, this._lastAngle);

        // Apply normal rotation to camera position
        this._eye.applyQuaternion(_quaternion);

        // Apply inverted rotation to up vector
        this.object.up.applyQuaternion(_quaternion.clone().invert());
      }

      this._movePrev.copy(this._moveCurr);
    };

    // debug: inversion applied
  }

  private addAxesHelper(): void {
    axesFeature.addAxesHelper(this);
  }

  private createAxisLabels(axesGroup: THREE.Group): void {
    axesFeature.createAxisLabels(this, axesGroup);
  }

  private initSceneLighting(): void {
    // Remove existing lights
    const lightsToRemove = this.scene.children.filter(
      child =>
        child instanceof THREE.AmbientLight ||
        child instanceof THREE.DirectionalLight ||
        child instanceof THREE.HemisphereLight
    );
    lightsToRemove.forEach(light => this.scene.remove(light));

    // Add fresh lighting based on mode
    if (this.useFlatLighting) {
      const ambient = new THREE.AmbientLight(0xffffff, 0.9);
      this.scene.add(ambient);
      const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 0.6);
      this.scene.add(hemi);
    } else {
      const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
      this.scene.add(ambientLight);
      const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
      directionalLight.position.set(10, 10, 5);
      directionalLight.castShadow = true;
      directionalLight.shadow.mapSize.width = 2048;
      directionalLight.shadow.mapSize.height = 2048;
      this.scene.add(directionalLight);
    }

    // Ensure initial UI states reflect current settings
    setTimeout(() => {
      this.updateGammaButtonState();
      this.updateAxesButtonState();
      this.updateLightingButtonsState();
      this.updateRotationCenterModeButtons();
    }, 0);
  }

  private updateLightingButtonsState(): void {
    const normalBtn = document.getElementById('use-normal-lighting');
    const flatBtn = document.getElementById('use-flat-lighting');
    if (normalBtn && flatBtn) {
      if (this.lightingMode === 'flat') {
        normalBtn.classList.remove('active');
        flatBtn.classList.add('active');
      } else if (this.lightingMode === 'normal') {
        flatBtn.classList.remove('active');
        normalBtn.classList.add('active');
      } else {
        // Unlit mode: neither normal nor flat highlighted
        flatBtn.classList.remove('active');
        normalBtn.classList.remove('active');
      }
    }
    const unlitBtn = document.getElementById('toggle-unlit-ply');
    if (unlitBtn) {
      if (this.lightingMode === 'unlit') {
        unlitBtn.classList.add('active');
      } else {
        unlitBtn.classList.remove('active');
      }
    }
  }

  private updateRendererColorSpace(): void {
    sceneBrightness.updateRendererColorSpace(this);
  }

  private applySceneBrightness(): void {
    sceneBrightness.applySceneBrightness(this);
  }

  private getBackgroundCssColor(): string {
    return sceneBrightness.getBackgroundCssColor(this);
  }

  private getBackgroundBrightnessLabel(): string {
    return sceneBrightness.getBackgroundBrightnessLabel(this);
  }

  private applyBackgroundBrightness(): void {
    sceneBrightness.applyBackgroundBrightness(this);
  }

  private applyEnvironmentSpecificUI(): void {
    // Themes are browser-only; VS Code uses native theme variables.
    const themeSection = document.getElementById('theme-section');
    if (themeSection && isVSCode) {
      themeSection.style.display = 'none';
    }
  }

  private toggleGammaCorrection(): void {
    sceneBrightness.toggleGammaCorrection(this);
  }

  updateGammaButtonState(): void {
    sceneBrightness.updateGammaButtonState(this);
  }

  private updateRotationCenterModeButtons(): void {
    this.rotationCenterManager.updateModeButtons();
  }

  private rebuildAllColorAttributesForCurrentGammaSetting(): void {
    sceneBrightness.rebuildAllColorAttributesForCurrentGammaSetting(this);
  }

  private setupResizeObserver(): void {
    const container = document.getElementById('viewer-container');
    if (!container) {
      return;
    }

    this.resizeObserver = new ResizeObserver(() => {
      // Trigger rerender when container dimensions change
      this.onWindowResize();
    });

    this.resizeObserver.observe(container);
  }

  /**
   * Get the selection context for the SelectionManager
   */
  private getSelectionContext(): SelectionContext {
    return {
      camera: this.camera,
      meshes: this.meshes,
      spatialFiles: this.spatialFiles,
      poseGroups: this.poseGroups,
      cameraGroups: this.cameraGroups,
      fileVisibility: this.fileVisibility,
      pointSizes: this.pointSizes,
      screenSpaceScaling: this.screenSpaceScaling,
    };
  }

  private dispose(): void {
    // Clean up ResizeObserver
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Clean up measurements
    if (this.measurementManager) {
      this.measurementManager.dispose();
      this.measurementManager = null;
    }

    // Clean up EDL resources
    if (this.edlPass) {
      this.edlPass.dispose();
      this.edlPass = null;
    }
    if (this.effectComposer) {
      this.effectComposer = null;
    }

    // Clean up controls
    if (this.controls) {
      this.controls.dispose();
    }

    // Clean up renderer
    if (this.renderer) {
      this.renderer.dispose();
    }
  }

  private showLoading(show: boolean, message?: string): void {
    const loadingEl = document.getElementById('loading');
    if (!loadingEl) {
      return;
    }

    this.isFileLoading = show;

    if (show) {
      loadingEl.classList.remove('hidden');
      const msgEl = loadingEl.querySelector('p');
      if (msgEl && message) {
        msgEl.textContent = message;
      }
    } else {
      loadingEl.classList.add('hidden');
      // Clear any in-progress Files-list loading row.
      if (this.pendingLoadLabel !== null) {
        this.pendingLoadLabel = null;
        this.pendingLoadDetail = '';
        this.updateFileList();
      }
    }

    // Update welcome message state based on loading status
    this.updateWelcomeMessageVisibility();
  }

  updateWelcomeMessageVisibility(): void {
    uiStatus.updateWelcomeMessageVisibility(this);
  }

  private triggerOpenFile(): void {
    if (isVSCode) {
      this.vscode.postMessage({
        type: 'addFile',
      });
    } else {
      const fileInput = document.getElementById('hiddenFileInput');
      if (fileInput) {
        fileInput.click();
      }
    }
  }

  private onWindowResize(): void {
    const container = document.getElementById('viewer-container');
    if (!container) {
      return;
    }

    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);

    // Update EDL composer and render targets on resize
    if (this.effectComposer) {
      this.effectComposer.setSize(container.clientWidth, container.clientHeight);
    }

    // Update controls based on type
    if (this.controlType === 'trackball') {
      const trackballControls = this.controls as TrackballControls;
      trackballControls.screen.width = container.clientWidth;
      trackballControls.screen.height = container.clientHeight;
      trackballControls.handleResize();
    } else {
      const orbitControls = this.controls as OrbitControls;
      // OrbitControls automatically handles resize
    }

    // Force immediate render to prevent flashing
    const now = performance.now();
    if (this.lastFrameTime > 0) {
      this.trackFrameTime(now - this.lastFrameTime);
    }
    this.lastFrameTime = now;

    // Start GPU timing for resize render
    const gpuQuery = this.startGPUTiming();
    this.performRender();
    this.endGPUTiming(gpuQuery);
    this.updateGPUTiming();

    // Track render event for resize renders too
    this.trackRender();
  }

  private animate(): void {
    this.animationId = requestAnimationFrame(this.animate.bind(this));

    // Update FPS calculation (always, to decay to 0 when no renders)
    this.updateFPSCalculation();

    // Update controls
    this.controls.update();

    // Update measurement label positions
    if (this.measurementManager) {
      this.measurementManager.updateLabelPositions();
    }

    // Check if camera position, rotation, or rotation center has changed
    const positionChanged = !this.camera.position.equals(this.lastCameraPosition);
    const rotationChanged = !this.camera.quaternion.equals(this.lastCameraQuaternion);
    const rotationCenterChanged = !this.controls.target.equals(this.lastRotationCenter);

    // Only update camera matrix and UI when camera actually changes
    if (positionChanged || rotationChanged) {
      this.updateCameraMatrix();
      this.updateCameraControlsPanel();

      // Update screen-space scaling if enabled
      if (this.screenSpaceScaling) {
        const now = performance.now();
        // Throttle updates to every 100ms for performance
        if (now - this.lastScalingUpdate > 100) {
          this.updateAllPointSizesForDistance();
          this.lastScalingUpdate = now;
        }
      }

      // Debug: Check if any Depth-derived point clouds are being culled
      // Only log every 60 frames to avoid spam
      this.frameCount++;
      if (this.frameCount % 60 === 0) {
        this.checkMeshVisibility();
      }

      // Update last known position and rotation
      this.lastCameraPosition.copy(this.camera.position);
      this.lastCameraQuaternion.copy(this.camera.quaternion);

      this.needsRender = true;
    }

    // Handle rotation center changes separately
    if (rotationCenterChanged) {
      // Update coordinate system position to follow the rotation center
      const axesGroup = (this as any).axesGroup;
      if (axesGroup) {
        axesGroup.position.copy(this.controls.target);
      }

      // Update reset to center button state
      this.updateRotationOriginButtonState();

      // Update last known rotation center
      this.lastRotationCenter.copy(this.controls.target);

      this.needsRender = true;
    }

    // Always render when needed (this covers camera damping/momentum)
    if (this.needsRender) {
      const now = performance.now();
      // Measure full frame time (time between actual renders)
      if (this.lastFrameTime > 0) {
        this.trackFrameTime(now - this.lastFrameTime);
      }
      this.lastFrameTime = now;

      // Start GPU timing
      const gpuQuery = this.startGPUTiming();
      this.performRender();
      this.endGPUTiming(gpuQuery);

      // Update GPU timing results
      this.updateGPUTiming();

      this.needsRender = false;
      // Track render event
      this.trackRender();
    }
  }

  requestRender(): void {
    this.needsRender = true;
  }

  /**
   * Recover gracefully from WebGL context loss instead of crashing.
   *
   * Context loss happens when the GPU runs out of memory — common when several
   * extension windows each hold a large cloud, since every webview is a separate
   * WebGL context but they all share one GPU's VRAM. Without this handler the
   * next GL call throws and takes down the whole webview. We preventDefault() to
   * let the browser attempt restoration, pause rendering while lost, and resume
   * on restore (Three.js re-uploads geometries/textures automatically on the
   * next render because their CPU-side arrays still exist).
   */
  private setupContextLossHandling(canvas: HTMLCanvasElement): void {
    canvas.addEventListener(
      'webglcontextlost',
      event => {
        event.preventDefault(); // required so the context can be restored
        this.contextLost = true;
        console.warn('WebGL context lost — pausing rendering until restored.');
        this.showStatus('GPU context lost (likely out of memory). Recovering…');
      },
      false
    );
    canvas.addEventListener(
      'webglcontextrestored',
      () => {
        this.contextLost = false;
        console.warn('WebGL context restored — resuming.');
        this.showStatus('GPU context restored.');
        this.requestRender();
      },
      false
    );
  }

  /**
   * Centralized render method — routes through EDL EffectComposer when enabled,
   * falls back to direct renderer.render() when disabled for zero overhead.
   */
  performRender(): void {
    // The GPU is gone while the context is lost; any GL call would throw.
    if (this.contextLost) {
      return;
    }
    if (this.edlEnabled && this.effectComposer) {
      this.effectComposer.render();
    } else {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /**
   * Initialize the EDL post-processing pipeline.
   * Creates the EffectComposer with a RenderPass and EDLPass.
   * The composer is only used when EDL is enabled.
   */
  private initEDLComposer(): void {
    edl.initEDLComposer(this);
  }

  /**
   * Toggle Eye Dome Lighting on/off.
   */
  private toggleEDL(): void {
    edl.toggleEDL(this);
  }

  /**
   * Update EDL button active state.
   */
  private updateEDLButtonState(): void {
    edl.updateEDLButtonState(this);
  }

  /**
   * Show/hide the EDL strength and radius sliders.
   */
  private updateEDLSettingsVisibility(): void {
    edl.updateEDLSettingsVisibility(this);
  }

  private trackRender(): void {
    renderStats.trackRender(this);
  }

  private trackFrameTime(frameTimeMs: number): void {
    renderStats.trackFrameTime(this, frameTimeMs);
  }

  private updateFPSCalculation(): void {
    renderStats.updateFPSCalculation(this);
  }

  private updateFPSDisplay(): void {
    renderStats.updateFPSDisplay(this);
  }

  private startRenderLoop(): void {
    if (this.animationId === null) {
      this.animate();
    }
  }

  private stopRenderLoop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  private checkMeshVisibility(): void {
    // Check if any meshes are being culled by frustum culling
    for (let i = 0; i < this.meshes.length; i++) {
      const mesh = this.meshes[i];
      const isVisible = this.fileVisibility[i];

      if (!isVisible) {
        continue;
      } // Skip if manually hidden

      // Check if mesh should be visible but might be culled
      if (mesh && mesh.geometry && mesh.geometry.boundingBox) {
        const box = mesh.geometry.boundingBox.clone();
        box.applyMatrix4(mesh.matrixWorld);

        // Simple frustum check - if bounding box is completely outside view
        const center = box.getCenter(new THREE.Vector3());
        const distanceToCamera = this.camera.position.distanceTo(center);

        // Check if it's within camera range
        const withinNearFar =
          distanceToCamera >= this.camera.near && distanceToCamera <= this.camera.far;

        if (!withinNearFar) {
          // debug: culling warning
        }

        // Check if bounding box is extremely large
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        if (maxDim > 50000) {
          // debug: large bounds
        }
      }
    }
  }

  // Rotation Matrix Methods
  private updateCameraMatrix(): void {
    transformationMatrix.updateCameraMatrix(this);
  }

  setTransformationMatrix(fileIndex: number, matrix: THREE.Matrix4): void {
    transformationMatrix.setTransformationMatrix(this, fileIndex, matrix);
  }

  private getTransformationMatrix(fileIndex: number): THREE.Matrix4 {
    return transformationMatrix.getTransformationMatrix(this, fileIndex);
  }

  private getTransformationMatrixAsArray(fileIndex: number): number[] {
    return transformationMatrix.getTransformationMatrixAsArray(this, fileIndex);
  }

  applyTransformationMatrix(fileIndex: number): void {
    transformationMatrix.applyTransformationMatrix(this, fileIndex);
  }

  private resetTransformationMatrix(fileIndex: number): void {
    transformationMatrix.resetTransformationMatrix(this, fileIndex);
  }

  multiplyTransformationMatrices(fileIndex: number, matrix: THREE.Matrix4): void {
    transformationMatrix.multiplyTransformationMatrices(this, fileIndex, matrix);
  }

  addTranslationToMatrix(fileIndex: number, x: number, y: number, z: number): void {
    transformationMatrix.addTranslationToMatrix(this, fileIndex, x, y, z);
  }

  updateMatrixTextarea(fileIndex: number): void {
    transformationMatrix.updateMatrixTextarea(this, fileIndex);
  }

  private updateCameraMatrixDisplay(): void {
    transformationMatrix.updateCameraMatrixDisplay(this);
  }

  updateCameraControlsPanel(): void {
    transformationMatrix.updateCameraControlsPanel(this);
  }

  setupCameraControlEventListeners(matrixStr: string): void {
    const fovSlider = document.getElementById('camera-fov') as HTMLInputElement;
    const fovInput = document.getElementById('fov-input') as HTMLInputElement;

    // Update FOV from slider
    if (fovSlider) {
      fovSlider.addEventListener('input', e => {
        const newFov = parseFloat((e.target as HTMLInputElement).value);
        this.camera.fov = newFov;
        this.camera.updateProjectionMatrix();
        if (fovInput) {
          fovInput.value = newFov.toFixed(2);
        }
        this.requestRender();
      });
    }

    // Update FOV from text input
    if (fovInput) {
      const updateFromInput = () => {
        const newFov = parseFloat(fovInput.value);
        if (!isNaN(newFov) && newFov > 0) {
          this.camera.fov = newFov;
          this.camera.updateProjectionMatrix();

          // Always update slider by clamping to its range
          if (fovSlider) {
            const min = parseFloat(fovSlider.min);
            const max = parseFloat(fovSlider.max);
            const clampedValue = Math.max(min, Math.min(max, newFov));
            fovSlider.value = clampedValue.toString();
          }
          this.requestRender();
        } else {
          // Reset to current value if invalid
          fovInput.value = this.camera.fov.toFixed(2);
        }
      };

      fovInput.addEventListener('blur', updateFromInput);
      fovInput.addEventListener('keydown', e => {
        if (e.key === 'Enter') {
          updateFromInput();
          fovInput.blur();
        }
      });

      // Select text on focus
      fovInput.addEventListener('focus', () => {
        fovInput.select();
      });
    }

    const resetBtn = document.getElementById('reset-camera-matrix');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.resetCameraToDefault();
      });
    }

    const modifyPositionBtn = document.getElementById('modify-camera-position');
    if (modifyPositionBtn) {
      modifyPositionBtn.addEventListener('click', () => {
        this.showCameraPositionDialog();
      });
    }

    const modifyRotationBtn = document.getElementById('modify-camera-rotation');
    if (modifyRotationBtn) {
      modifyRotationBtn.addEventListener('click', () => {
        this.showCameraRotationDialog();
      });
    }

    const modifyRotationCenterBtn = document.getElementById('modify-rotation-center');
    if (modifyRotationCenterBtn) {
      modifyRotationCenterBtn.addEventListener('click', () => {
        this.showRotationCenterDialog();
      });
    }
  }

  private resetCameraToDefault(): void {
    // Reset FOV and camera orientation
    this.camera.fov = 75;
    this.camera.updateProjectionMatrix();

    // Reset quaternion to identity (no rotation)
    this.camera.quaternion.set(0, 0, 0, 1);

    // Fit camera to currently loaded objects
    this.fitCameraToAllObjects();

    // Update last known camera state to prevent unnecessary UI updates
    this.lastCameraPosition.copy(this.camera.position);
    this.lastCameraQuaternion.copy(this.camera.quaternion);

    // Force update camera matrix and UI
    this.updateCameraMatrix();
    this.updateCameraControlsPanel();
  }

  private setRotationCenterToOrigin(): void {
    rotationCenterFeature.setRotationCenterToOrigin(this);
  }

  private onDoubleClick(event: MouseEvent): void {
    if (!this.selectionManager) {
      return;
    }

    // Get canvas and mouse position in screen coordinates
    const canvas = this.renderer.domElement;
    const rect = canvas.getBoundingClientRect();
    const mouseScreenX = event.clientX - rect.left;
    const mouseScreenY = event.clientY - rect.top;

    console.log(`🖱️ Double-click at (${mouseScreenX.toFixed(1)}, ${mouseScreenY.toFixed(1)})`);

    // Update selection context before selecting
    this.selectionManager.updateContext(this.getSelectionContext());

    // Try to select a point with detailed logging
    const result = this.selectionManager.selectPointWithLogging(mouseScreenX, mouseScreenY, canvas);

    if (result) {
      const { point: selectedPoint, info } = result;

      // Log selection info with appropriate emoji
      if (info.includes('camera profile')) {
        console.log(`📷 Selected ${info}`);
      } else if (info.includes('pose keypoint')) {
        console.log(`🕺 Selected ${info}`);
      } else if (info.includes('triangle mesh')) {
        console.log(`🔷 Selected ${info}`);
      } else {
        console.log(`⚫ Selected point cloud: ${info}`);
      }

      // If Shift is pressed, measure distance to rotation center
      if (event.shiftKey && this.measurementManager) {
        const rotationCenter = this.controls.target.clone();
        this.measurementManager.addMeasurement(rotationCenter, selectedPoint);
        console.log(`📏 Measurement added from rotation center to selected point`);
        this.requestRender();
      } else {
        this.setRotationCenter(selectedPoint);
        this.updateRotationOriginButtonState();
      }
      return;
    }

    // If no point found, log the failure
    console.log(
      `❌ No selectable object found at (${mouseScreenX.toFixed(1)}, ${mouseScreenY.toFixed(1)})`
    );
  }

  private setRotationCenter(point: THREE.Vector3): void {
    rotationCenterFeature.setRotationCenter(this, point);
  }

  private showRotationCenterFeedback(point: THREE.Vector3): void {
    rotationCenterFeature.showRotationCenterFeedback(this, point);
  }

  private getIntensityArray(data: SpatialData): Float32Array | null {
    return intensity.getIntensityArray(data);
  }

  private hasIntensityData(data: SpatialData): boolean {
    return intensity.hasIntensityData(data);
  }

  private buildIntensityColorArrayForMode(
    values: Float32Array,
    pointCount: number,
    colorMode: string
  ): Float32Array {
    return intensity.buildIntensityColorArrayForMode(values, pointCount, colorMode);
  }

  private mapIntensityValue(
    value: number,
    mapName: 'grayscale' | 'viridis' | 'colors'
  ): [number, number, number] {
    return intensity.mapIntensityValue(value, mapName);
  }

  // For POINT CLOUDS this returns raw 8-bit sRGB colors (Uint8, 3 bytes/point)
  // and the sRGB→linear conversion happens in the point shader (see
  // setupPointSrgbDecode). That's 4x less color memory than the old baked Float32
  // [0,1] array — the key lever when many large clouds are open at once — and the
  // typed path is zero-copy (shares the parser's array). MESHES are unchanged:
  // they keep the Float32 + LUT path (few vertices, memory is a non-issue, and
  // their lit materials read linear vertex colors directly).
  private buildOriginalColorArray(data: SpatialData): Float32Array | Uint8Array | null {
    return colorModeUtils.buildOriginalColorArray(this, data);
  }

  applyColorModeToGeometry(
    data: SpatialData,
    geometry: THREE.BufferGeometry,
    colorMode: string
  ): void {
    colorModeUtils.applyColorModeToGeometry(this, data, geometry, colorMode);
  }

  shouldUseVertexColors(data: SpatialData, colorMode: string): boolean {
    return colorModeUtils.shouldUseVertexColors(data, colorMode);
  }

  createGeometryFromSpatialData(data: SpatialData): THREE.BufferGeometry {
    const geometry = new THREE.BufferGeometry();

    const startTime = performance.now();

    // Point clouds (no faces) are drawn with PointsMaterial, which never uses
    // normals (points aren't lit, and EDL works off depth). Uploading a normal
    // attribute for them just wastes ~12 bytes/point of VRAM — significant when
    // many large clouds are open at once. So only attach normals for MESHES;
    // the CPU normals stay in spatialData for PLY export, and the
    // normal-visualization tool is mesh-only anyway.
    const isMesh = (data.faces?.length || 0) > 0 || (data.faceCount || 0) > 0;

    // Check if we have direct TypedArrays (new ultra-fast path)
    if ((data as any).useTypedArrays) {
      const positions = (data as any).positionsArray as Float32Array;
      const normals = (data as any).normalsArray as Float32Array | null;

      // Direct assignment - zero copying, zero processing!
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      // NOTE: the 'color' attribute is intentionally NOT built here. The
      // unconditional applyColorModeToGeometry() call below fully determines the
      // final color attribute for every mode (original/intensity rebuild it,
      // assigned deletes it), so building it here was a redundant full-size
      // Float32 allocation + per-channel loop on every colored load.

      if (normals && data.hasNormals && isMesh) {
        geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      }
    } else {
      // Fallback to traditional vertex object processing
      const vertexCount = data.vertices.length;
      // fallback path

      // Pre-allocate typed arrays for better performance
      const vertices = new Float32Array(vertexCount * 3);
      const colors = data.hasColors ? new Float32Array(vertexCount * 3) : null;
      const normals = data.hasNormals ? new Float32Array(vertexCount * 3) : null;

      // Optimized vertex processing - batch operations
      const vertexArray = data.vertices;
      for (let i = 0, i3 = 0; i < vertexCount; i++, i3 += 3) {
        const vertex = vertexArray[i];

        // Position data (required)
        vertices[i3] = vertex.x;
        vertices[i3 + 1] = vertex.y;
        vertices[i3 + 2] = vertex.z;

        // Color data (optional)
        if (colors && vertex.red !== undefined) {
          const r8 = (vertex.red || 0) & 255;
          const g8 = (vertex.green || 0) & 255;
          const b8 = (vertex.blue || 0) & 255;
          if (this.convertSrgbToLinear) {
            const lut = this.colorProcessor.ensureSrgbLUT();
            colors[i3] = lut[r8];
            colors[i3 + 1] = lut[g8];
            colors[i3 + 2] = lut[b8];
          } else {
            colors[i3] = r8 / 255;
            colors[i3 + 1] = g8 / 255;
            colors[i3 + 2] = b8 / 255;
          }
        }

        // Normal data (optional)
        if (normals && vertex.nx !== undefined) {
          normals[i3] = vertex.nx;
          normals[i3 + 1] = vertex.ny || 0;
          normals[i3 + 2] = vertex.nz || 0;
        }
      }

      // Set attributes
      geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

      if (colors) {
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      }

      if (normals && isMesh) {
        geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
      }
    }

    const colorMode =
      data.fileIndex !== undefined
        ? this.individualColorModes[data.fileIndex] || 'assigned'
        : 'assigned';
    this.applyColorModeToGeometry(data, geometry, colorMode);

    // Optimized face processing
    if (data.faces.length > 0) {
      // Estimate index count for pre-allocation
      let estimatedIndexCount = 0;
      for (const face of data.faces) {
        if (face.indices.length >= 3) {
          estimatedIndexCount += (face.indices.length - 2) * 3;
        }
      }

      const indices = new Uint32Array(estimatedIndexCount);
      let indexOffset = 0;

      for (const face of data.faces) {
        if (face.indices.length >= 3) {
          // Optimized fan triangulation
          const faceIndices = face.indices;
          const firstIndex = faceIndices[0];

          for (let i = 1; i < faceIndices.length - 1; i++) {
            indices[indexOffset++] = firstIndex;
            indices[indexOffset++] = faceIndices[i];
            indices[indexOffset++] = faceIndices[i + 1];
          }
        }
      }

      if (indexOffset > 0) {
        // Trim array if we over-estimated
        const finalIndices = indexOffset < indices.length ? indices.slice(0, indexOffset) : indices;
        geometry.setIndex(new THREE.BufferAttribute(finalIndices, 1));
      }
    }

    // Ensure normals are available for proper lighting after indices are set
    if (!geometry.getAttribute('normal') && data.faces.length > 0) {
      geometry.computeVertexNormals();
    }

    geometry.computeBoundingBox();

    // Debug bounding box for disparity Depth files (may help with disappearing issue)
    if (geometry.boundingBox) {
      const box = geometry.boundingBox;
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());

      // debug: bbox

      // Check for extreme values that might cause culling issues
      const maxDimension = Math.max(size.x, size.y, size.z);
      if (maxDimension > 10000) {
        // debug
      }

      // Check distance from origin
      const distanceFromOrigin = center.length();
      if (distanceFromOrigin > 1000) {
        // debug
      }
    }

    const endTime = performance.now();
    this.lastGeometryMs = +(endTime - startTime).toFixed(1);
    console.log(`Render: geometry ${this.lastGeometryMs}ms`);

    return geometry;
  }

  private setupEventListeners(): void {
    // Add file button - different behavior for VSCode vs browser
    const addFileBtn = document.getElementById('add-file');
    if (addFileBtn) {
      addFileBtn.addEventListener('click', () => {
        if (isVSCode) {
          // VSCode environment - request file from extension
          this.requestAddFile();
        } else {
          // Browser environment - trigger file input
          const fileInput = document.getElementById('hiddenFileInput') as HTMLInputElement;
          if (fileInput) {
            fileInput.click();
          }
        }
      });
    }

    // Sequence controls (overlay)
    const playBtn = document.getElementById('seq-play');
    const pauseBtn = document.getElementById('seq-pause');
    const stopBtn = document.getElementById('seq-stop');
    const prevBtn = document.getElementById('seq-prev');
    const nextBtn = document.getElementById('seq-next');
    const slider = document.getElementById('seq-slider') as HTMLInputElement | null;
    if (playBtn) {
      playBtn.addEventListener('click', () => this.playSequence());
    }
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => this.pauseSequence());
    }
    if (stopBtn) {
      stopBtn.addEventListener('click', () => this.stopSequence());
    }
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.stepSequence(-1));
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.stepSequence(1));
    }
    if (slider) {
      slider.addEventListener('input', () => this.seekSequence(parseInt(slider.value, 10) || 0));
    }

    document.addEventListener('dblclick', e => {
      const slider = e.target;
      if (!(slider instanceof HTMLInputElement) || slider.type !== 'range') {
        return;
      }

      const resetValue = slider.defaultValue || slider.getAttribute('value');
      if (resetValue === null || resetValue === '') {
        return;
      }

      e.preventDefault();
      slider.value = resetValue;
      slider.dispatchEvent(new Event('input', { bubbles: true }));
    });

    // Tab navigation
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
      button.addEventListener('click', e => {
        const targetTab = (e.target as HTMLElement).getAttribute('data-tab');
        if (targetTab) {
          this.switchTab(targetTab);
        }
      });
    });

    // Control buttons
    const fitCameraBtn = document.getElementById('fit-camera');
    if (fitCameraBtn) {
      fitCameraBtn.addEventListener('click', () => {
        if (!this.sequenceMode) {
          this.fitCameraToAllObjects();
        }
      });
    }

    const resetCameraBtn = document.getElementById('reset-camera');
    if (resetCameraBtn) {
      resetCameraBtn.addEventListener('click', () => {
        if (!this.sequenceMode) {
          this.resetCameraToDefault();
        }
      });
    }

    const toggleAxesBtn = document.getElementById('toggle-axes');
    if (toggleAxesBtn) {
      toggleAxesBtn.addEventListener('click', () => {
        this.toggleAxesVisibility();
        this.updateAxesButtonState();
      });
    }

    const toggleNormalsBtn = document.getElementById('toggle-normals');
    if (toggleNormalsBtn) {
      toggleNormalsBtn.addEventListener('click', () => {
        this.toggleNormalsVisibility();
      });
    }

    const toggleCamerasBtn = document.getElementById('toggle-cameras');
    if (toggleCamerasBtn) {
      toggleCamerasBtn.addEventListener('click', () => {
        this.toggleCameraVisibility();
        this.updateCameraButtonState();
      });
    }

    const setRotationOriginBtn = document.getElementById('set-rotation-origin');
    if (setRotationOriginBtn) {
      setRotationOriginBtn.addEventListener('click', () => {
        this.setRotationCenterToOrigin();
        this.updateRotationOriginButtonState();
      });
    }

    // Measurement buttons
    const clearMeasurementsBtn = document.getElementById('clear-measurements');
    if (clearMeasurementsBtn) {
      clearMeasurementsBtn.addEventListener('click', () => {
        if (this.measurementManager) {
          this.measurementManager.clearAll();
          this.requestRender();
          this.showStatus('All measurements cleared');
        }
      });
    }

    const removeLastMeasurementBtn = document.getElementById('remove-last-measurement');
    if (removeLastMeasurementBtn) {
      removeLastMeasurementBtn.addEventListener('click', () => {
        if (this.measurementManager) {
          this.measurementManager.removeLastMeasurement();
          this.requestRender();
          this.showStatus('Last measurement removed');
        }
      });
    }

    // Camera convention buttons
    const opencvBtn = document.getElementById('opencv-convention');
    if (opencvBtn) {
      opencvBtn.addEventListener('click', () => {
        this.setOpenCVCameraConvention();
        if (this.vscode) {
          this.vscode.postMessage({ type: 'saveCameraConvention', convention: 'opencv' });
        }
      });
    }

    const openglBtn = document.getElementById('opengl-convention');
    if (openglBtn) {
      openglBtn.addEventListener('click', () => {
        this.setOpenGLCameraConvention();
        if (this.vscode) {
          this.vscode.postMessage({ type: 'saveCameraConvention', convention: 'opengl' });
        }
      });
    }

    // Control type buttons
    const trackballBtn = document.getElementById('trackball-controls');
    if (trackballBtn) {
      trackballBtn.addEventListener('click', () => {
        this.switchToTrackballControls();
      });
    }

    const orbitBtn = document.getElementById('orbit-controls');
    if (orbitBtn) {
      orbitBtn.addEventListener('click', () => {
        this.switchToOrbitControls();
      });
    }

    const inverseBtn = document.getElementById('inverse-trackball-controls');
    if (inverseBtn) {
      inverseBtn.addEventListener('click', () => {
        this.switchToInverseTrackballControls();
      });
    }

    const arcballBtn = document.getElementById('arcball-controls');
    if (arcballBtn) {
      arcballBtn.addEventListener('click', () => {
        this.switchToArcballControls();
      });
    }

    // Rotation center mode buttons
    const rotationCenterMoveCameraBtn = document.getElementById('rotation-center-move-camera');
    if (rotationCenterMoveCameraBtn) {
      rotationCenterMoveCameraBtn.addEventListener('click', () => {
        this.rotationCenterManager.setMode('move-camera');
        this.updateRotationCenterModeButtons();
        this.showStatus('Rotation center: Camera moves laterally');
      });
    }

    const rotationCenterKeepCameraBtn = document.getElementById('rotation-center-keep-camera');
    if (rotationCenterKeepCameraBtn) {
      rotationCenterKeepCameraBtn.addEventListener('click', () => {
        this.rotationCenterManager.setMode('keep-camera');
        this.updateRotationCenterModeButtons();
        this.showStatus('Rotation center: Camera stays in place');
      });
    }

    const rotationCenterKeepDistanceBtn = document.getElementById('rotation-center-keep-distance');
    if (rotationCenterKeepDistanceBtn) {
      rotationCenterKeepDistanceBtn.addEventListener('click', () => {
        this.rotationCenterManager.setMode('keep-distance');
        this.updateRotationCenterModeButtons();
        this.showStatus('Rotation center: Camera keeps distance');
      });
    }

    // Arcball settings UI removed per request

    // Color settings
    const toggleGammaCorrectionBtn = document.getElementById('toggle-gamma-correction');
    if (toggleGammaCorrectionBtn) {
      toggleGammaCorrectionBtn.addEventListener('click', () => {
        this.toggleGammaCorrection();
        this.updateGammaButtonState();
      });
    }

    // Screen-space scaling toggle
    const toggleScreenSpaceScalingBtn = document.getElementById('toggle-screenspace-scaling');
    if (toggleScreenSpaceScalingBtn) {
      toggleScreenSpaceScalingBtn.addEventListener('click', () => {
        this.toggleScreenSpaceScaling();
      });
    }

    // Transparency toggle
    const toggleTransparencyBtn = document.getElementById('toggle-transparency');
    if (toggleTransparencyBtn) {
      toggleTransparencyBtn.addEventListener('click', () => {
        this.toggleTransparency();
      });
    }

    // Unlit PLY button - acts as a mode switch now
    const toggleUnlitPlyBtn = document.getElementById('toggle-unlit-ply');
    if (toggleUnlitPlyBtn) {
      toggleUnlitPlyBtn.addEventListener('click', () => {
        this.lightingMode = 'unlit';
        this.useUnlitPly = true;
        this.useFlatLighting = false;
        this.rebuildAllPlyMaterials();
        this.initSceneLighting();
        this.updateLightingButtonsState();
        this.showStatus('Using unlit PLY (uniform)');
      });
    }

    // Lighting mode buttons
    const normalLightingBtn = document.getElementById('use-normal-lighting');
    if (normalLightingBtn) {
      normalLightingBtn.addEventListener('click', () => {
        this.lightingMode = 'normal';
        this.useFlatLighting = false;
        this.useUnlitPly = false;
        this.rebuildAllPlyMaterials();
        this.initSceneLighting();
        this.updateLightingButtonsState();
        this.showStatus('Using normal lighting');
      });
    }
    const flatLightingBtn = document.getElementById('use-flat-lighting');
    if (flatLightingBtn) {
      flatLightingBtn.addEventListener('click', () => {
        this.lightingMode = 'flat';
        this.useFlatLighting = true;
        this.useUnlitPly = false;
        this.rebuildAllPlyMaterials();
        this.initSceneLighting();
        this.updateLightingButtonsState();
        this.showStatus('Using flat lighting');
      });
    }

    // Eye Dome Lighting controls
    const toggleEDLBtn = document.getElementById('toggle-edl');
    if (toggleEDLBtn) {
      toggleEDLBtn.addEventListener('click', () => {
        this.toggleEDL();
      });
    }
    const edlStrengthSlider = document.getElementById('edl-strength-slider') as HTMLInputElement;
    const edlStrengthValue = document.getElementById('edl-strength-value');
    if (edlStrengthSlider) {
      edlStrengthSlider.addEventListener('input', () => {
        const val = parseFloat(edlStrengthSlider.value);
        this.edlStrength = val;
        if (this.edlPass) {
          this.edlPass.edlStrength = val;
        }
        if (edlStrengthValue) {
          edlStrengthValue.textContent = val.toFixed(1);
        }
        this.requestRender();
      });
    }
    const edlRadiusSlider = document.getElementById('edl-radius-slider') as HTMLInputElement;
    const edlRadiusValue = document.getElementById('edl-radius-value');
    if (edlRadiusSlider) {
      edlRadiusSlider.addEventListener('input', () => {
        const val = parseFloat(edlRadiusSlider.value);
        this.edlRadius = val;
        if (this.edlPass) {
          this.edlPass.edlRadius = val;
        }
        if (edlRadiusValue) {
          edlRadiusValue.textContent = val.toFixed(1);
        }
        this.requestRender();
      });
    }
    const edlSecondRingSlider = document.getElementById(
      'edl-second-ring-slider'
    ) as HTMLInputElement;
    const edlSecondRingValue = document.getElementById('edl-second-ring-value');
    if (edlSecondRingSlider) {
      edlSecondRingSlider.value = this.edlSecondRingWeight.toFixed(2);
      edlSecondRingSlider.addEventListener('input', () => {
        const val = parseFloat(edlSecondRingSlider.value);
        this.edlSecondRingWeight = Number.isFinite(val) ? val : 0.0;
        if (this.edlPass) {
          this.edlPass.secondRingWeight = this.edlSecondRingWeight;
        }
        if (edlSecondRingValue) {
          edlSecondRingValue.textContent = this.edlSecondRingWeight.toFixed(2);
        }
        this.showStatus(
          this.edlSecondRingWeight > 0
            ? `Advanced EDL neighborhood: ON (${this.edlSecondRingWeight.toFixed(2)})`
            : 'Advanced EDL neighborhood: OFF'
        );
        this.requestRender();
      });
      if (edlSecondRingValue) {
        edlSecondRingValue.textContent = this.edlSecondRingWeight.toFixed(2);
      }
    }

    const brightnessSlider = document.getElementById('brightness-slider') as HTMLInputElement;
    const brightnessValue = document.getElementById('brightness-value');
    if (brightnessSlider) {
      brightnessSlider.value = this.brightnessStops.toFixed(1);
      if (brightnessValue) {
        brightnessValue.textContent = this.brightnessStops.toFixed(1);
      }
      brightnessSlider.addEventListener('input', () => {
        const val = parseFloat(brightnessSlider.value);
        this.brightnessStops = Number.isFinite(val) ? val : 0;
        if (brightnessValue) {
          brightnessValue.textContent = this.brightnessStops.toFixed(1);
        }
        this.applySceneBrightness();
        this.requestRender();
      });
    }

    const backgroundSlider = document.getElementById(
      'background-brightness-slider'
    ) as HTMLInputElement;
    const backgroundValue = document.getElementById('background-brightness-value');
    if (backgroundSlider) {
      backgroundSlider.value = this.backgroundBrightness.toString();
      if (backgroundValue) {
        backgroundValue.textContent = this.getBackgroundBrightnessLabel();
      }
      backgroundSlider.addEventListener('input', () => {
        const val = parseFloat(backgroundSlider.value);
        this.backgroundBrightness = Number.isFinite(val) ? val : 13;
        if (backgroundValue) {
          backgroundValue.textContent = this.getBackgroundBrightnessLabel();
        }
        this.applyBackgroundBrightness();
        this.requestRender();
      });
    }

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      // Only handle shortcuts when not typing in input fields
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case 'h':
          this.showKeyboardShortcuts();
          e.preventDefault();
          break;
        case 'f':
          if (!this.sequenceMode) {
            this.fitCameraToAllObjects();
          }
          e.preventDefault();
          break;
        case 'r':
          if (!this.sequenceMode) {
            this.resetCameraToDefault();
          }
          e.preventDefault();
          break;
        case 'a':
          this.toggleAxesVisibility();
          e.preventDefault();
          break;
        case 'c':
          this.setOpenCVCameraConvention();
          if (this.vscode) {
            this.vscode.postMessage({ type: 'saveCameraConvention', convention: 'opencv' });
          }
          e.preventDefault();
          break;
        case 'b':
          this.setOpenGLCameraConvention();
          if (this.vscode) {
            this.vscode.postMessage({ type: 'saveCameraConvention', convention: 'opengl' });
          }
          e.preventDefault();
          break;
        case 't':
          this.switchToTrackballControls();
          e.preventDefault();
          break;
        case 'o':
          this.switchToOrbitControls();
          e.preventDefault();
          break;
        case 'i':
          this.switchToInverseTrackballControls();
          e.preventDefault();
          break;
        case 'k':
          this.switchToArcballControls();
          e.preventDefault();
          break;

        // Arcball settings bindings
        case 'x':
          this.setUpVector(new THREE.Vector3(1, 0, 0));
          e.preventDefault();
          break;
        case 'y':
          this.setUpVector(new THREE.Vector3(0, 1, 0));
          e.preventDefault();
          break;
        case 'z':
          this.setUpVector(new THREE.Vector3(0, 0, 1));
          e.preventDefault();
          break;
        case 'w':
          // debug
          this.setRotationCenterToOrigin();
          this.updateRotationOriginButtonState();
          e.preventDefault();
          break;
        case 'g':
          this.toggleGammaCorrection();
          e.preventDefault();
          break;
        case 's':
          this.toggleScreenSpaceScaling();
          e.preventDefault();
          break;
        case 'e':
          this.toggleEDL();
          e.preventDefault();
          break;
        case 'u':
          this.toggleTransparency();
          e.preventDefault();
          break;
        case 'l':
          this.arcballInvertRotation = !this.arcballInvertRotation;
          if (this.controlType === 'arcball') {
            const arc = this.controls as any;
            if (arc && typeof arc.invertRotation === 'boolean') {
              arc.invertRotation = this.arcballInvertRotation;
            }
          }
          this.showStatus(
            `Arcball handedness: ${this.arcballInvertRotation ? 'Inverted' : 'Normal'}`
          );
          e.preventDefault();
          break;
      }
    });

    // Depth control handlers are now handled per-file in updateFileList

    // Global color mode toggle (removed - now handled per file)
  }

  private initializeSequence(files: string[], wildcard: string): void {
    sequencePlayback.initializeSequence(this, files, wildcard);
  }

  private updateSequenceUI(): void {
    sequencePlayback.updateSequenceUI(this);
  }

  private playSequence(): void {
    sequencePlayback.playSequence(this);
  }

  private pauseSequence(): void {
    sequencePlayback.pauseSequence(this);
  }

  private stopSequence(): void {
    sequencePlayback.stopSequence(this);
  }

  private stepSequence(delta: number): void {
    sequencePlayback.stepSequence(this, delta);
  }

  private seekSequence(index: number): void {
    sequencePlayback.seekSequence(this, index);
  }

  private async sequenceHandleUltimate(message: any): Promise<void> {
    await sequencePlayback.sequenceHandleUltimate(this, message);
  }

  private async sequenceHandlePly(message: any): Promise<void> {
    await sequencePlayback.sequenceHandlePly(this, message);
  }

  private async sequenceHandleXyz(message: any): Promise<void> {
    await sequencePlayback.sequenceHandleXyz(this, message);
  }

  private async sequenceHandleObj(message: any): Promise<void> {
    await sequencePlayback.sequenceHandleObj(this, message);
  }

  private async sequenceHandleStl(message: any): Promise<void> {
    await sequencePlayback.sequenceHandleStl(this, message);
  }

  private async sequenceHandleDepth(message: any): Promise<void> {
    await sequencePlayback.sequenceHandleDepth(this, message);
  }

  private trimNormalModeArraysFrom(startIndex: number): void {
    sequencePlayback.trimNormalModeArraysFrom(this, startIndex);
  }

  private async loadSequenceFrame(index: number): Promise<void> {
    await sequencePlayback.loadSequenceFrame(this, index);
  }

  private useSequenceObject(obj: THREE.Object3D, index: number): void {
    sequencePlayback.useSequenceObject(this, obj, index);
  }

  private cacheSequenceOnly(obj: THREE.Object3D, index: number): void {
    sequencePlayback.cacheSequenceOnly(this, obj, index);
  }

  private swapSequenceObject(obj: THREE.Object3D, index: number): void {
    sequencePlayback.swapSequenceObject(this, obj, index);
  }

  private ensureSequenceVisibility(obj: THREE.Object3D): void {
    sequencePlayback.ensureSequenceVisibility(obj);
  }

  fitCameraToObject(obj: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(obj);
    if (!box.isEmpty()) {
      const size = box.getSize(new THREE.Vector3());
      const center = box.getCenter(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = this.camera.fov * (Math.PI / 180);
      const distance = (maxDim / 2 / Math.tan(fov / 2)) * 1.5;

      // Move camera along its current direction to the new distance
      const dir = this.camera.getWorldDirection(new THREE.Vector3()).normalize();
      this.camera.position.copy(center.clone().sub(dir.multiplyScalar(distance)));
      // Conservative clipping planes for massive point clouds
      this.camera.near = Math.max(0.001, Math.min(0.1, distance / 10000));
      this.camera.far = Math.max(distance * 100, 1000000);
      this.camera.updateProjectionMatrix();

      // Update controls target if present
      if (this.controls && (this.controls as any).target) {
        (this.controls as any).target.copy(center);
      }
    }
  }

  getDepthSettingsFromFileUI(fileIndex: number): CameraParams {
    return depthPanelState.getDepthSettingsFromFileUI(fileIndex);
  }

  private rebuildAllPlyMaterials(): void {
    for (let i = 0; i < this.meshes.length && i < this.spatialFiles.length; i++) {
      const data = this.spatialFiles[i];
      const mesh = this.meshes[i];
      if (!data || !mesh) {
        continue;
      }
      // Only update triangle meshes, not points or line segments
      const isTriangleMesh = mesh.type === 'Mesh' && !(mesh as any).isLineSegments;
      if (!isTriangleMesh) {
        continue;
      }
      const oldMaterial = (mesh as any).material as THREE.Material | THREE.Material[] | undefined;
      const newMaterial = this.createMaterialForFile(data, i);
      (mesh as any).material = newMaterial;
      if (oldMaterial) {
        if (Array.isArray(oldMaterial)) {
          oldMaterial.forEach(m => m.dispose());
        } else {
          oldMaterial.dispose();
        }
      }
    }
    // Trigger a single render after material changes
    try {
      (this as any).renderOnce?.();
    } catch {}
  }

  private switchTab(tabName: string): void {
    uiStatus.switchTab(tabName);
  }

  private toggleAxesVisibility(): void {
    axesFeature.toggleAxesVisibility(this);
  }

  private toggleNormalsVisibility(): void {
    this.normalsVisualizers.forEach(normals => {
      if (normals) {
        normals.visible = !normals.visible;
      }
    });
    this.requestRender();
  }

  private togglePointsVisibility(fileIndex: number): void {
    if (fileIndex < 0 || fileIndex >= this.meshes.length) {
      return;
    }

    // Initialize visibility state if not set
    if (this.pointsVisible[fileIndex] === undefined) {
      this.pointsVisible[fileIndex] = true;
    }

    // Toggle the visibility state
    this.pointsVisible[fileIndex] = !this.pointsVisible[fileIndex];

    // Apply to the actual mesh
    if (this.meshes[fileIndex]) {
      this.meshes[fileIndex].visible = this.pointsVisible[fileIndex];
    }
    this.requestRender();
    // this.requestRender();
  }

  private toggleFileNormalsVisibility(fileIndex: number): void {
    if (fileIndex < 0 || fileIndex >= this.normalsVisualizers.length) {
      return;
    }

    // Initialize visibility state if not set
    if (this.normalsVisible[fileIndex] === undefined) {
      this.normalsVisible[fileIndex] = true;
    }

    // Toggle the visibility state
    this.normalsVisible[fileIndex] = !this.normalsVisible[fileIndex];

    // Apply to the actual normals visualizer
    if (this.normalsVisualizers[fileIndex]) {
      this.normalsVisualizers[fileIndex]!.visible = this.normalsVisible[fileIndex];
    }
    this.requestRender();
    // this.requestRender();
  }

  private updatePointsNormalsButtonStates(): void {
    // Update points toggle button states
    const pointsButtons = document.querySelectorAll('.points-toggle-btn');
    pointsButtons.forEach(button => {
      const fileIndex = parseInt(button.getAttribute('data-file-index') || '0');
      const isVisible = this.pointsVisible[fileIndex] !== false; // Default to true

      const baseStyle =
        'flex: 1; padding: 4px 8px; border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 10px;';
      if (isVisible) {
        button.setAttribute(
          'style',
          baseStyle +
            ' background: var(--vscode-button-background); color: var(--vscode-button-foreground);'
        );
      } else {
        button.setAttribute(
          'style',
          baseStyle +
            ' background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);'
        );
      }
    });

    // Update normals toggle button states
    const normalsButtons = document.querySelectorAll('.normals-toggle-btn');
    normalsButtons.forEach(button => {
      const fileIndex = parseInt(button.getAttribute('data-file-index') || '0');

      // Skip disabled buttons (files without normals)
      if (button.hasAttribute('disabled') || button.classList.contains('disabled')) {
        return;
      }

      const isVisible = this.normalsVisible[fileIndex] !== false; // Default to true

      const baseStyle =
        'flex: 1; padding: 4px 8px; border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 10px;';
      if (isVisible) {
        button.setAttribute(
          'style',
          baseStyle +
            ' background: var(--vscode-button-background); color: var(--vscode-button-foreground);'
        );
      } else {
        button.setAttribute(
          'style',
          baseStyle +
            ' background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);'
        );
      }
    });
  }

  updateAxesButtonState(): void {
    axesFeature.updateAxesButtonState(this);
  }

  updateRotationOriginButtonState(): void {
    rotationCenterFeature.updateRotationOriginButtonState(this);
  }

  private setUpVector(upVector: THREE.Vector3): void {
    axesFeature.setUpVector(this, upVector);
  }

  showUpVectorFeedback(upVector: THREE.Vector3): void {
    axesFeature.showUpVectorFeedback(this, upVector);
  }

  updateAxesForUpVector(upVector: THREE.Vector3): void {
    axesFeature.updateAxesForUpVector(this, upVector);
  }

  showUpVectorIndicator(upVector: THREE.Vector3): void {
    axesFeature.showUpVectorIndicator(this, upVector);
  }

  private showKeyboardShortcuts(): void {
    uiStatus.showKeyboardShortcuts(() => this.createShortcutsUI());
  }

  private createShortcutsUI(): void {
    uiStatus.createShortcutsUI(() => this.updateControlStatus());
  }

  private setupMessageHandler(): void {
    window.addEventListener('message', async event => {
      const message = event.data;

      switch (message.type) {
        case 'timing':
          this.handleTimingMessage(message);
          break;
        case 'startLoading':
          this.showImmediateLoading(message);
          break;
        case 'timingUpdate':
          // Allow timing updates, suppress other spam
          if (
            typeof message.message === 'string' &&
            message.message.includes('🧪 Header face types')
          ) {
            console.log(message.message);
          }
          break;
        case 'loadingError':
          const fileType = message.fileType || 'point cloud';
          const fileName = message.fileName ? ` (${message.fileName})` : '';
          this.showError(`Failed to load ${fileType} file${fileName}: ${message.error}`);
          break;
        case 'spatialData':
        case 'multiSpatialData':
          try {
            // Both single and multi-file data are handled the same way now
            const dataArray = Array.isArray(message.data) ? message.data : [message.data];
            await this.loadWithPerf('ply', message, () => this.displayFiles(dataArray));
          } catch (error) {
            console.error('Error displaying PLY data:', error);
            this.showError(
              'Failed to display PLY data: ' +
                (error instanceof Error ? error.message : String(error))
            );
          }
          break;
        case 'ultimateRawBinaryData':
          try {
            await this.handleUltimateRawBinaryData(message);
          } catch (error) {
            console.error('Error handling ultimate raw binary data:', error);
            this.showError(
              'Failed to handle ultimate raw binary data: ' +
                (error instanceof Error ? error.message : String(error))
            );
          }
          break;
        case 'ultimateRawBinaryUri':
          await this.handleUltimateRawBinaryUri(message);
          break;
        case 'directTypedArrayData':
          try {
            await this.loadWithPerf('ply', message, () => this.handleDirectTypedArrayData(message));
          } catch (error) {
            console.error('Error handling direct TypedArray data:', error);
            this.showError(
              'Failed to handle direct TypedArray data: ' +
                (error instanceof Error ? error.message : String(error))
            );
          }
          break;
        case 'binarySpatialData':
          try {
            await this.loadWithPerf('ply', message, () => this.handleBinarySpatialData(message));
          } catch (error) {
            console.error('Error handling binary PLY data:', error);
            this.showError(
              'Failed to handle binary PLY data: ' +
                (error instanceof Error ? error.message : String(error))
            );
          }
          break;
        case 'addFiles':
          try {
            this.addNewFiles(message.data);
          } catch (error) {
            console.error('Error adding new files:', error);
            this.showError(
              'Failed to add files: ' + (error instanceof Error ? error.message : String(error))
            );
          }
          break;
        case 'sequence:init':
          try {
            this.initializeSequence(message.files as string[], message.wildcard as string);
          } catch (error) {
            console.error('Error starting sequence:', error);
            this.showError(
              'Failed to start sequence: ' +
                (error instanceof Error ? error.message : String(error))
            );
          }
          break;
        case 'sequence:file:ultimate':
          await this.sequenceHandleUltimate(message);
          break;
        case 'sequence:file:ply':
          await this.sequenceHandlePly(message);
          break;
        case 'sequence:file:xyz':
          await this.sequenceHandleXyz(message);
          break;
        case 'sequence:file:obj':
          await this.sequenceHandleObj(message);
          break;
        case 'sequence:file:stl':
          await this.sequenceHandleStl(message);
          break;
        case 'sequence:file:depth':
          await this.sequenceHandleDepth(message);
          break;
        case 'fileRemoved':
          try {
            this.removeFileByIndex(message.fileIndex);
          } catch (error) {
            console.error('Error removing file:', error);
            this.showError(
              'Failed to remove file: ' + (error instanceof Error ? error.message : String(error))
            );
          }
          break;
        case 'startLargeFile':
          this.handleStartLargeFile(message);
          break;
        case 'largeFileChunk':
          this.handleLargeFileChunk(message);
          break;
        case 'largeFileComplete':
          await this.handleLargeFileComplete(message);
          break;
        case 'depthData':
          this.handleDepthData(message);
          break;
        case 'objData':
          await this.loadWithPerf('obj', message, () => this.handleObjData(message));
          break;
        case 'stlData':
          await this.loadWithPerf('stl', message, () => this.handleStlData(message));
          break;
        case 'xyzData':
          await this.loadWithPerf('xyz', message, () => this.handleXyzData(message));
          break;
        case 'pcdData':
          await this.loadWithPerf('pcd', message, () => this.handlePcdData(message));
          break;
        case 'ptsData':
          await this.loadWithPerf('pts', message, () => this.handlePtsData(message));
          break;
        case 'offData':
          await this.loadWithPerf('off', message, () => this.handleOffData(message));
          break;
        case 'gltfData':
          await this.loadWithPerf('gltf', message, () => this.handleGltfData(message));
          break;
        case 'npyData':
          await this.loadWithPerf('npy', message, () => this.handleNpyData(message));
          break;
        case 'xyzVariantData':
          await this.loadWithPerf('xyz', message, () => this.handleXyzVariantData(message));
          break;
        case 'cameraParams':
          this.handleCameraParams(message);
          break;
        case 'cameraParamsCancelled':
          this.handleCameraParamsCancelled(message.requestId);
          break;
        case 'datasetTexture':
          this.handleDatasetTexture(message);
          break;
        case 'cameraParamsError':
          this.handleCameraParamsError(message.error, message.requestId);
          break;
        case 'savePlyFileResult':
          this.handleSaveSpatialFileResult(message);
          break;
        case 'colorImageData':
          this.handleColorImageData(message);
          break;
        case 'defaultDepthSettings':
          this.handleDefaultDepthSettings(message);
          break;
        case 'mtlData':
          this.handleMtlData(message);
          break;
        case 'calibrationFileSelected':
          this.handleCalibrationFileSelected(message);
          break;
        case 'poseData':
          try {
            await (this as any).handlePoseData(message);
          } catch (error) {
            console.error('Error handling pose data:', error);
            this.showError(
              'Failed to handle pose data: ' +
                (error instanceof Error ? error.message : String(error))
            );
          }
          break;
      }
    });
  }

  private currentTiming: {
    kind: string;
    startAt?: string;
    readMs?: number;
    parseMs?: number;
    convertMs?: number;
    totalMs?: number;
    format?: string;
  } | null = null;
  private handleTimingMessage(msg: any): void {
    if (!this.currentTiming) {
      this.currentTiming = { kind: msg.kind };
    }
    if (msg.phase === 'start') {
      this.currentTiming = { kind: msg.kind, startAt: msg.at };
    } else if (msg.phase === 'read') {
      this.currentTiming = { ...(this.currentTiming || { kind: msg.kind }), readMs: msg.ms };
    } else if (msg.phase === 'parse') {
      this.currentTiming = {
        ...(this.currentTiming || { kind: msg.kind }),
        parseMs: msg.ms,
        format: msg.format || this.currentTiming?.format,
      };
    } else if (msg.phase === 'convert') {
      this.currentTiming = { ...(this.currentTiming || { kind: msg.kind }), convertMs: msg.ms };
    } else if (msg.phase === 'total') {
      this.currentTiming = {
        ...(this.currentTiming || { kind: msg.kind }),
        totalMs: msg.ms,
        startAt: this.currentTiming?.startAt || msg.at,
      };
      // Emit final summary line with exact timestamp
      const iso = msg.at ? new Date(msg.at).toISOString() : new Date().toISOString();
      const timeOnly = `${new Date(iso).toTimeString().split(' ')[0]}.${new Date(iso).getMilliseconds().toString().padStart(3, '0')}`;
      const kind = (this.currentTiming.kind || 'unknown').toUpperCase();
      const fmt = this.currentTiming.format ? `, format=${this.currentTiming.format}` : '';
      const read = this.currentTiming.readMs != null ? `read ${this.currentTiming.readMs}ms` : null;
      const parse =
        this.currentTiming.parseMs != null ? `parse ${this.currentTiming.parseMs}ms` : null;
      const convert =
        this.currentTiming.convertMs != null ? `convert ${this.currentTiming.convertMs}ms` : null;
      const render = this.lastGeometryMs ? `render ${this.lastGeometryMs}ms` : null;
      const parts = [read, parse, convert, render].filter(Boolean).join(', ');
      const totalAbs = this.lastAbsoluteMs
        ? this.lastAbsoluteMs.toFixed(1)
        : (this.currentTiming.totalMs ?? 0).toFixed(1);
      console.log(`[${timeOnly}] Summary: ${kind}${fmt} - ${parts} | total ${totalAbs}ms`);
      this.currentTiming = null;
    }
  }

  /**
   * Initialize browser file handler with shared functionality
   */
  private initializeBrowserFileHandler(): void {
    browserFileDragDrop.initializeBrowserFileHandler(this);
  }

  /**
   * Handle messages in browser mode - implements VS Code extension functionality locally
   */
  private handleBrowserMessage(message: any): void {
    browserFileDragDrop.handleBrowserMessage(this, message);
  }

  // # VSCode changes: the functions below are used in the browser and were not used for the extension
  // Browser file handling methods
  private setupPanelResizeAndDrag(): void {
    browserFileDragDrop.setupPanelResizeAndDrag();
  }

  private setupBrowserFileHandlers(): void {
    browserFileDragDrop.setupBrowserFileHandlers(this);
  }

  private handleDragOver(event: DragEvent): void {
    browserFileDragDrop.handleDragOver(event);
  }

  private async handleDropEvent(event: DragEvent): Promise<void> {
    await browserFileDragDrop.handleDropEvent(this, event);
  }

  private extractDroppedFilePaths(dataTransfer: DataTransfer | null): string[] {
    return browserFileDragDrop.extractDroppedFilePaths(dataTransfer);
  }

  private async handleDroppedFiles(files: File[]): Promise<void> {
    await browserFileDragDrop.handleDroppedFiles(this, files);
  }

  private async handleBrowserFiles(files: File[]): Promise<void> {
    await browserFileDragDrop.handleBrowserFiles(this, files);
  }

  // # VSCode changes: the functions above are used in the browser and were not used for the extension

  async displayFiles(dataArray: SpatialData[]): Promise<void> {
    // concise summary printed separately
    // In sequence mode: do not auto-fit camera or heavy UI work
    if (this.sequenceMode) {
      this.addNewFiles(dataArray);

      // Capture and restore form states even in sequence mode
      const openPanelStates = this.captureDepthPanelStates();
      this.updateFileList();
      this.restoreDepthPanelStates(openPanelStates);

      // Ensure color consistency with current gamma setting
      this.rebuildAllColorAttributesForCurrentGammaSetting();

      try {
        (document.getElementById('loading') as HTMLElement)?.classList.add('hidden');
      } catch {}
      return;
    }

    // Normal mode
    this.addNewFiles(dataArray);
    this.updateFileStats();

    // Capture current form states before regenerating UI
    const openPanelStates = this.captureDepthPanelStates();
    this.updateFileList();
    // Restore form values after UI regeneration
    this.restoreDepthPanelStates(openPanelStates);

    this.updateCameraControlsPanel();

    // Ensure color consistency with current gamma setting
    this.rebuildAllColorAttributesForCurrentGammaSetting();

    this.autoFitCameraOnFirstLoad();
    this.showLoading(false);
    this.clearError();
    const absStart = (window as any).absoluteStartTime || performance.now();
    this.lastAbsoluteMs = performance.now() - absStart;
  }

  private async yieldToUI(): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, 0));
  }

  createMaterialForFile(data: SpatialData, fileIndex: number): THREE.Material {
    const colorMode = this.individualColorModes[fileIndex] || 'assigned';

    if (data.faceCount > 0) {
      // Mesh material
      const material: THREE.MeshBasicMaterial | THREE.MeshLambertMaterial = this.useUnlitPly
        ? new THREE.MeshBasicMaterial()
        : new THREE.MeshLambertMaterial();
      material.side = THREE.DoubleSide; // More robust visibility if face winding varies
      // For files without explicit normals, prefer flat shading to avoid odd gradients
      if (material instanceof THREE.MeshLambertMaterial) {
        material.flatShading = !data.hasNormals;
      }

      if (this.shouldUseVertexColors(data, colorMode)) {
        material.vertexColors = true;
        material.color = new THREE.Color(1, 1, 1); // White base color
      } else if (colorMode === 'assigned') {
        // Use assigned color
        const color = this.fileColors[fileIndex % this.fileColors.length];
        material.color.setRGB(color[0], color[1], color[2]);
      } else {
        // Use color index
        const colorIndex = parseInt(colorMode);
        if (!isNaN(colorIndex) && colorIndex >= 0 && colorIndex < this.fileColors.length) {
          const color = this.fileColors[colorIndex];
          material.color.setRGB(color[0], color[1], color[2]);
        }
      }

      material.needsUpdate = true;
      return material;
    } else {
      // Points material
      const material = new THREE.PointsMaterial();

      // Initialize point size if not set
      if (!this.pointSizes[fileIndex]) {
        this.pointSizes[fileIndex] = 0.001; // Universal default for all file types
      }

      material.size = this.pointSizes[fileIndex];
      material.sizeAttenuation = true; // Always use distance-based scaling

      // Apply point count-based optimizations
      const pointCount = data.vertexCount || data.vertices?.length || 0;
      this.optimizeForPointCount(material, pointCount);

      // debug

      if (this.shouldUseVertexColors(data, colorMode)) {
        material.vertexColors = true;
        material.color = new THREE.Color(1, 1, 1); // White base color
      } else if (colorMode === 'assigned') {
        // Use assigned color
        const color = this.fileColors[fileIndex % this.fileColors.length];
        material.color.setRGB(color[0], color[1], color[2]);
      } else {
        // Use color index
        const colorIndex = parseInt(colorMode);
        if (!isNaN(colorIndex) && colorIndex >= 0 && colorIndex < this.fileColors.length) {
          const color = this.fileColors[colorIndex];
          material.color.setRGB(color[0], color[1], color[2]);
        }
      }

      // Point colors are stored as raw 8-bit sRGB; decode them in-shader when in
      // original mode with the gamma toggle on (visually identical to the old
      // baked-Float32 path, 4x less memory).
      this.setupPointSrgbDecode(material);
      material.userData.srgbDecode = this.pointColorsNeedSrgbDecode(data, colorMode);

      return material;
    }
  }

  private fitCameraToAllObjects(): void {
    if (
      this.meshes.length === 0 &&
      this.poseGroups.length === 0 &&
      this.cameraGroups.length === 0
    ) {
      return;
    }

    const box = new THREE.Box3();
    for (const obj of this.meshes) {
      box.expandByObject(obj);
    }
    for (const group of this.poseGroups) {
      box.expandByObject(group);
    }
    for (const group of this.cameraGroups) {
      box.expandByObject(group);
    }

    if (box.isEmpty()) {
      return;
    }

    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    const maxDim = Math.max(size.x, size.y, size.z, 1e-6);

    const vFov = this.camera.fov * (Math.PI / 180);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * this.camera.aspect);
    const fitHeightDistance = maxDim / (2 * Math.tan(vFov / 2));
    const fitWidthDistance = maxDim / (2 * Math.tan(hFov / 2));
    const distance = Math.max(fitHeightDistance, fitWidthDistance) * 1.5; // padding

    // Keep current camera viewing direction and move along it.
    const direction = this.camera.getWorldDirection(new THREE.Vector3()).normalize();
    this.camera.position.copy(center.clone().sub(direction.multiplyScalar(distance)));
    this.camera.lookAt(center);

    // Conservative clipping planes for massive coordinate ranges
    this.camera.near = Math.max(0.001, Math.min(0.1, distance / 10000));
    this.camera.far = Math.max(distance * 100, 1000000);
    this.camera.updateProjectionMatrix();

    // Set rotation center to fitted center
    this.controls.target.copy(center);
    this.controls.update();
  }

  autoFitCameraOnFirstLoad(): void {
    // Only auto-fit camera on first file load
    if (this.isFirstFileLoad) {
      this.fitCameraToAllObjects();
      this.isFirstFileLoad = false;
    }
  }

  updateFileStats(): void {
    const statsDiv = document.getElementById('file-stats');
    if (!statsDiv) {
      return;
    }

    if (
      this.spatialFiles.length === 0 &&
      this.poseGroups.length === 0 &&
      this.cameraGroups.length === 0
    ) {
      statsDiv.innerHTML = '<div>No objects loaded</div>';
      // Also clear camera matrix panel
      const cameraPanel = document.getElementById('camera-matrix-panel');
      if (cameraPanel) {
        cameraPanel.innerHTML = '';
      }
      return;
    }

    if (
      this.spatialFiles.length + this.poseGroups.length + this.cameraGroups.length === 1 &&
      this.spatialFiles.length === 1
    ) {
      // Single file view
      const data = this.spatialFiles[0];
      const renderingMode = data.faceCount === 0 ? 'Points' : 'Mesh';
      statsDiv.innerHTML = `
                <div><strong>File Size:</strong> ${formatFileSize(data.fileSizeInBytes)}</div>
                <div><strong>Vertices:</strong> ${data.vertexCount.toLocaleString()}</div>
                <div><strong>Faces:</strong> ${data.faceCount.toLocaleString()}</div>
                <div><strong>Format:</strong> ${data.format}</div>
                <div><strong>Colors:</strong> ${data.hasColors ? 'Yes' : 'No'}</div>
                <div><strong>Intensity:</strong> ${this.hasIntensityData(data) ? 'Yes' : 'No'}</div>
                <div><strong>Normals:</strong> ${data.hasNormals ? 'Yes' : 'No'}</div>
                <div><strong>Rendering Mode:</strong> ${renderingMode}</div>
                ${Array.isArray((data as any).comments) && (data as any).comments.length > 0 ? `<div><strong>Comments:</strong><br>${(data as any).comments.join('<br>')}</div>` : ''}
            `;
    } else {
      // Multiple files view
      const totalVertices = this.spatialFiles.reduce(
        (sum: number, data: SpatialData) => sum + data.vertexCount,
        0
      );
      const totalFaces = this.spatialFiles.reduce(
        (sum: number, data: SpatialData) => sum + data.faceCount,
        0
      );
      const totalSize = this.spatialFiles.reduce(
        (sum: number, data: SpatialData) => sum + (data.fileSizeInBytes || 0),
        0
      );
      const totalObjects =
        this.spatialFiles.length + this.poseGroups.length + this.cameraGroups.length;

      statsDiv.innerHTML = `
                <div><strong>Total Objects:</strong> ${totalObjects} (Pointclouds: ${this.spatialFiles.length}, Poses: ${this.poseGroups.length}, Cameras: ${this.cameraGroups.length})</div>
                <div><strong>Total Size:</strong> ${formatFileSize(totalSize)}</div>
                <div><strong>Total Vertices:</strong> ${totalVertices.toLocaleString()}</div>
                <div><strong>Total Faces:</strong> ${totalFaces.toLocaleString()}</div>
            `;
    }

    // Update camera matrix panel
    this.updateCameraMatrixDisplay();
    this.updateCameraControlsPanel();
  }

  updateFileList(): void {
    console.log(`🔄 updateFileList() called - regenerating file list UI`);
    const fileListDiv = document.getElementById('file-list');
    if (!fileListDiv) {
      return;
    }

    if (
      this.spatialFiles.length === 0 &&
      this.poseGroups.length === 0 &&
      this.cameraGroups.length === 0
    ) {
      fileListDiv.innerHTML = '<div class="no-files">No objects loaded</div>';
      return;
    }

    let html = '';
    // In sequence mode, show only the current frame information
    if (this.sequenceMode && this.sequenceFiles.length > 0) {
      const fullPath = this.sequenceFiles[this.sequenceIndex] || '';
      const pathParts = fullPath.split(/[\\/]/);
      const name = pathParts.pop() || `Frame ${this.sequenceIndex + 1}`;
      // Get up to 3 parts: grandparent/parent/filename
      const shortPath = pathParts.slice(-2).concat(name).join('/');
      html += `
                <div class="file-item">
                    <div class="file-item-main">
                        <input type="checkbox" id="file-0" checked disabled>
                        <span class="color-indicator" style="background-color: #888"></span>
                        <label for="file-0" class="file-name" data-short-path="${shortPath}">${name}</label>
                    </div>
                    <div class="file-info">Frame ${this.sequenceIndex + 1} of ${this.sequenceFiles.length}</div>
                </div>
            `;
      fileListDiv.innerHTML = html;
      addTooltipsToTruncatedFilenames();
      return;
    }

    // Render point clouds and meshes
    for (let i = 0; i < this.spatialFiles.length; i++) {
      const data = this.spatialFiles[i];

      // Color indicator
      let colorIndicator = '';
      if (this.individualColorModes[i] === 'original' && data.hasColors) {
        colorIndicator =
          '<span class="color-indicator" style="background: linear-gradient(45deg, #ff0000, #00ff00, #0000ff); border: 1px solid #666;"></span>';
      } else if (
        this.individualColorModes[i]?.startsWith('intensity') &&
        this.hasIntensityData(data)
      ) {
        colorIndicator =
          '<span class="color-indicator" style="background: linear-gradient(90deg, #111, #fff); border: 1px solid #666;"></span>';
      } else {
        const color = this.fileColors[i % this.fileColors.length];
        const colorHex = `#${Math.round(color[0] * 255)
          .toString(16)
          .padStart(2, '0')}${Math.round(color[1] * 255)
          .toString(16)
          .padStart(2, '0')}${Math.round(color[2] * 255)
          .toString(16)
          .padStart(2, '0')}`;
        colorIndicator = `<span class="color-indicator" style="background-color: ${colorHex}"></span>`;
      }

      // Transformation matrix UI
      const matrixArr = this.getTransformationMatrixAsArray(i);
      let matrixStr = '';
      for (let r = 0; r < 4; ++r) {
        const row = matrixArr.slice(r * 4, r * 4 + 4).map(v => v.toFixed(6));
        matrixStr += row.join(' ') + '\n';
      }

      const isCollapsed = this.fileItemsCollapsed[i] ?? false;
      html += `
                <div class="file-item">
                    <div class="file-item-main">
                        <button class="collapse-toggle" data-file-index="${i}" title="${isCollapsed ? 'Expand' : 'Collapse'}">
                            <span class="collapse-icon">${isCollapsed ? '▶' : '▼'}</span>
                        </button>
                        <input type="checkbox" id="file-${i}" ${this.fileVisibility[i] ? 'checked' : ''}>
                        ${colorIndicator}
                        <label for="file-${i}" class="file-name" data-short-path="${data.shortPath || data.fileName || ''}">${data.fileName || `File ${i + 1}`}</label>
                        <button class="remove-file" data-file-index="${i}" title="Remove file">✕</button>
                    </div>
                    <div class="file-item-content" id="file-content-${i}" style="display: ${isCollapsed ? 'none' : 'block'}">
                    <div class="file-info">${data.vertexCount.toLocaleString()} vertices, ${data.faceCount.toLocaleString()} faces</div>
                    
                    ${
                      data &&
                      (commentSettings.isDepthDerivedFile(data) || (data as any).isDepthDerived)
                        ? `
                    <!-- Depth Settings (First) -->
                    <div class="depth-controls" style="margin-top: 8px;">
                        <button class="depth-settings-toggle" data-file-index="${i}" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 1px solid var(--vscode-panel-border); padding: 4px 8px; border-radius: 2px; cursor: pointer; font-size: 11px; width: 100%;">
                            <span class="toggle-icon">▶</span> Depth Settings
                        </button>
                        <div class="depth-settings-panel" id="depth-panel-${i}" style="display:none; margin-top: 8px; padding: 8px; background: var(--vscode-input-background); border: 1px solid var(--vscode-panel-border); border-radius: 2px;">
                            <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 1px; margin-bottom: 6px;">
                                <div id="image-size-${i}" style="font-size: 9px; color: var(--vscode-descriptionForeground); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${this.getImageSizeDisplay(i)}</div>
                                <label title="Apply depth settings when a field is committed" style="display: inline-flex; align-items: center; gap: 3px; flex: 0 0 auto; font-size: 9px; color: var(--vscode-descriptionForeground); white-space: nowrap; cursor: pointer;">
                                    <input type="checkbox" class="live-depth-update" data-file-index="${i}" ${this.liveDepthUpdateFiles.has(i) ? 'checked' : ''} style="margin: 0; width: 12px; height: 12px;"> Live
                                </label>
                            </div>
                            
                            <!-- Calibration File Loading -->
                            <div class="depth-group" style="margin-bottom: 8px;">
                                <button class="depth-section-toggle" data-section="load-calibration-${i}" style="width: 100%; text-align: left; background: transparent; border: none; color: var(--vscode-foreground); cursor: pointer; padding: 2px 0; font-size: 10px; font-weight: bold; display: flex; align-items: center; gap: 4px;">
                                    <span class="toggle-icon" style="font-size: 8px;">▶</span> Load Calibration (beta)
                                </button>
                                <div class="depth-section-content" id="load-calibration-${i}" style="display: none; margin-top: 4px;">
                                    <button class="load-calibration-btn" data-file-index="${i}" style="width: 100%; padding: 4px 8px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 10px;">
                                        📁 Load Calibration File
                                    </button>
                                    <div class="calibration-info" id="calibration-info-${i}" style="display: none; margin-top: 4px; padding: 4px; background: var(--vscode-input-background); border: 1px solid var(--vscode-panel-border); border-radius: 2px;">
                                        <div style="display: flex; align-items: center; gap: 8px;">
                                            <div id="calibration-filename-${i}" style="font-size: 9px; font-weight: bold; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"></div>
                                            <select id="camera-select-${i}" style="flex: 0 0 25%; font-size: 9px; padding: 1px 2px;">
                                                <option value="">Select camera...</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <div class="depth-group" style="margin-bottom: 8px;">
                                <label for="camera-model-${i}" style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">Camera Model ⭐:</label>
                                <select id="camera-model-${i}" style="width: 100%; padding: 2px; font-size: 11px;">
                                    <option value="pinhole-ideal" ${this.getDepthSetting(data, 'camera').includes('pinhole-ideal') ? 'selected' : ''}>Pinhole Ideal</option>
                                    <option value="pinhole-opencv" ${this.getDepthSetting(data, 'camera').includes('pinhole-opencv') ? 'selected' : ''}>Pinhole + OpenCV Distortion (beta)</option>
                                    <option value="fisheye-equidistant" ${this.getDepthSetting(data, 'camera').includes('fisheye-equidistant') ? 'selected' : ''}>Fisheye Equidistant</option>
                                    <option value="fisheye-opencv" ${this.getDepthSetting(data, 'camera').includes('fisheye-opencv') ? 'selected' : ''}>Fisheye + OpenCV Distortion (beta)</option>
                                    <option value="fisheye-kannala-brandt" ${this.getDepthSetting(data, 'camera').includes('fisheye-kannala-brandt') ? 'selected' : ''}>Fisheye Kannala-Brandt (beta)</option>
                                </select>
                            </div>
                            <div class="depth-group" style="margin-bottom: 8px;">
                                <label for="depth-type-${i}" style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">Depth Type ⭐:</label>
                                <select id="depth-type-${i}" style="width: 100%; padding: 2px; font-size: 11px;">
                                    <option value="euclidean" ${this.getDepthSetting(data, 'depth').includes('euclidean') ? 'selected' : ''}>Euclidean</option>
                                    <option value="orthogonal" ${this.getDepthSetting(data, 'depth').includes('orthogonal') ? 'selected' : ''}>Orthogonal</option>
                                    <option value="disparity" ${this.getDepthSetting(data, 'depth').includes('disparity') ? 'selected' : ''}>Disparity</option>
                                    <option value="inverse_depth" ${this.getDepthSetting(data, 'depth').includes('inverse_depth') ? 'selected' : ''}>Inverse Depth</option>
                                </select>
                            </div>
                            <div class="depth-group" style="margin-bottom: 8px;">
                                <label style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">Focal Length (px) ⭐:</label>
                                <div style="display: flex; gap: 4px;">
                                    <div style="flex: 1;">
                                        <label for="fx-${i}" style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">fx:</label>
                                        <input type="number" id="fx-${i}" value="${this.getDepthFx(data)}" min="1" step="0.1" style="width: 100%; padding: 2px; font-size: 11px;">
                                    </div>
                                    <div style="flex: 1;">
                                        <label for="fy-${i}" style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">fy:</label>
                                        <input type="number" id="fy-${i}" value="${this.getDepthFy(data)}" step="0.1" style="width: 100%; padding: 2px; font-size: 11px;" placeholder="Same as fx">
                                    </div>
                                </div>
                            </div>
                            <div class="depth-group" style="margin-bottom: 8px;">
                                <button class="depth-section-toggle" data-section="principal-point-${i}" style="width: 100%; text-align: left; background: transparent; border: none; color: var(--vscode-foreground); cursor: pointer; padding: 2px 0; font-size: 10px; font-weight: bold; display: flex; align-items: center; gap: 4px;">
                                    <span class="toggle-icon" style="font-size: 8px;">▶</span> Principal Point (px)
                                </button>
                                <div class="depth-section-content" id="principal-point-${i}" style="display: none; margin-top: 4px;">
                                    <div style="display: flex; gap: 4px; align-items: end;">
                                        <div style="flex: 1;">
                                            <label for="cx-${i}" style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">cx:</label>
                                            <input type="number" id="cx-${i}" value="${this.getDepthCx(data, i)}" step="0.1" style="width: 100%; padding: 2px; font-size: 11px;">
                                        </div>
                                        <div style="flex: 1;">
                                            <label for="cy-${i}" style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">cy:</label>
                                            <input type="number" id="cy-${i}" value="${this.getDepthCy(data, i)}" step="0.1" style="width: 100%; padding: 2px; font-size: 11px;">
                                        </div>
                                        <div style="flex: 0 0 auto;">
                                            <button class="reset-principle-point" data-file-index="${i}" style="padding: 2px 6px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 9px; height: 24px;" title="Reset to auto-calculated center">↺</button>
                                        </div>
                                    </div>
                                    <div style="font-size: 9px; color: var(--vscode-descriptionForeground); margin-top: 1px;">Auto-calculated as (width-1)/2 and (height-1)/2</div>
                                </div>
                            </div>
                            <div class="depth-group" id="distortion-params-${i}" style="margin-bottom: 8px; display: none;">
                                <button class="depth-section-toggle" data-section="distortion-content-${i}" style="width: 100%; text-align: left; background: transparent; border: none; color: var(--vscode-foreground); cursor: pointer; padding: 2px 0; font-size: 10px; font-weight: bold; display: flex; align-items: center; gap: 4px;">
                                    <span class="toggle-icon" style="font-size: 8px;">▶</span> Distortion Parameters (beta)
                                </button>
                                <div class="depth-section-content" id="distortion-content-${i}" style="display: none; margin-top: 4px;">
                                
                                <!-- Pinhole OpenCV parameters: k1, k2, k3, p1, p2 -->
                                <div id="pinhole-params-${i}" style="display: none;">
                                    <div style="display: flex; gap: 4px; margin-bottom: 4px;">
                                        <div style="flex: 1;">
                                            <label for="k1-${i}" style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">k1:</label>
                                            <input type="number" id="k1-${i}" value="0" step="0.001" style="width: 100%; padding: 2px; font-size: 11px;" placeholder="0">
                                        </div>
                                        <div style="flex: 1;">
                                            <label for="k2-${i}" style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">k2:</label>
                                            <input type="number" id="k2-${i}" value="0" step="0.001" style="width: 100%; padding: 2px; font-size: 11px;" placeholder="0">
                                        </div>
                                        <div style="flex: 1;">
                                            <label for="k3-${i}" style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">k3:</label>
                                            <input type="number" id="k3-${i}" value="0" step="0.001" style="width: 100%; padding: 2px; font-size: 11px;" placeholder="0">
                                        </div>
                                    </div>
                                    <div style="display: flex; gap: 4px; margin-bottom: 4px;">
                                        <div style="flex: 1;">
                                            <label for="p1-${i}" style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">p1:</label>
                                            <input type="number" id="p1-${i}" value="0" step="0.001" style="width: 100%; padding: 2px; font-size: 11px;" placeholder="0">
                                        </div>
                                        <div style="flex: 1;">
                                            <label for="p2-${i}" style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">p2:</label>
                                            <input type="number" id="p2-${i}" value="0" step="0.001" style="width: 100%; padding: 2px; font-size: 11px;" placeholder="0">
                                        </div>
                                        <div style="flex: 1;"></div>
                                    </div>
                                    <div style="font-size: 9px; color: var(--vscode-descriptionForeground);">k1,k2,k3: radial; p1,p2: tangential</div>
                                </div>
                                
                                <!-- Fisheye OpenCV parameters: k1, k2, k3, k4 -->
                                <div id="fisheye-opencv-params-${i}" style="display: none;">
                                    <div style="display: flex; gap: 4px; margin-bottom: 4px;">
                                        <div style="flex: 1;">
                                            <label for="k1-${i}" style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">k1:</label>
                                            <input type="number" id="k1-${i}" value="0" step="0.001" style="width: 100%; padding: 2px; font-size: 11px;" placeholder="0">
                                        </div>
                                        <div style="flex: 1;">
                                            <label for="k2-${i}" style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">k2:</label>
                                            <input type="number" id="k2-${i}" value="0" step="0.001" style="width: 100%; padding: 2px; font-size: 11px;" placeholder="0">
                                        </div>
                                        <div style="flex: 1;">
                                            <label for="k3-${i}" style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">k3:</label>
                                            <input type="number" id="k3-${i}" value="0" step="0.001" style="width: 100%; padding: 2px; font-size: 11px;" placeholder="0">
                                        </div>
                                        <div style="flex: 1;">
                                            <label for="k4-${i}" style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">k4:</label>
                                            <input type="number" id="k4-${i}" value="0" step="0.001" style="width: 100%; padding: 2px; font-size: 11px;" placeholder="0">
                                        </div>
                                    </div>
                                    <div style="font-size: 9px; color: var(--vscode-descriptionForeground);">Fisheye radial distortion coefficients</div>
                                </div>
                                
                                <!-- Kannala-Brandt parameters: k1, k2, k3, k4, k5 -->
                                <div id="kannala-brandt-params-${i}" style="display: none;">
                                    <div style="display: flex; gap: 4px; margin-bottom: 4px;">
                                        <div style="flex: 1;">
                                            <label for="k1-${i}" style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">k1:</label>
                                            <input type="number" id="k1-${i}" value="0" step="0.001" style="width: 100%; padding: 2px; font-size: 11px;" placeholder="0">
                                        </div>
                                        <div style="flex: 1;">
                                            <label for="k2-${i}" style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">k2:</label>
                                            <input type="number" id="k2-${i}" value="0" step="0.001" style="width: 100%; padding: 2px; font-size: 11px;" placeholder="0">
                                        </div>
                                        <div style="flex: 1;">
                                            <label for="k3-${i}" style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">k3:</label>
                                            <input type="number" id="k3-${i}" value="0" step="0.001" style="width: 100%; padding: 2px; font-size: 11px;" placeholder="0">
                                        </div>
                                    </div>
                                    <div style="display: flex; gap: 4px; margin-bottom: 4px;">
                                        <div style="flex: 1;">
                                            <label for="k4-${i}" style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">k4:</label>
                                            <input type="number" id="k4-${i}" value="0" step="0.001" style="width: 100%; padding: 2px; font-size: 11px;" placeholder="0">
                                        </div>
                                        <div style="flex: 1;">
                                            <label for="k5-${i}" style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">k5:</label>
                                            <input type="number" id="k5-${i}" value="0" step="0.001" style="width: 100%; padding: 2px; font-size: 11px;" placeholder="0">
                                        </div>
                                        <div style="flex: 1;"></div>
                                    </div>
                                    <div style="font-size: 9px; color: var(--vscode-descriptionForeground);">Polynomial fisheye coefficients</div>
                                </div>
                                </div>
                            </div>
                            <div class="depth-group" id="baseline-group-${i}" style="margin-bottom: 8px; ${this.getDepthSetting(data, 'depth').includes('disparity') ? '' : 'display:none;'}">
                                <label for="baseline-${i}" style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">Baseline (mm) ⭐:</label>
                                <input type="number" id="baseline-${i}" value="${this.getDepthBaseline(data)}" min="0.1" step="0.1" style="width: 100%; padding: 2px; font-size: 11px;">
                            </div>
                            <div class="depth-group" id="disparity-offset-group-${i}" style="margin-bottom: 8px; ${this.getDepthSetting(data, 'depth').includes('disparity') ? '' : 'display:none;'}">
                                <button class="depth-section-toggle" data-section="disparity-offset-content-${i}" style="width: 100%; text-align: left; background: transparent; border: none; color: var(--vscode-foreground); cursor: pointer; padding: 2px 0; font-size: 10px; font-weight: bold; display: flex; align-items: center; gap: 4px;">
                                    <span class="toggle-icon" style="font-size: 8px;">▶</span> Disparity Offset
                                </button>
                                <div class="depth-section-content" id="disparity-offset-content-${i}" style="display: none; margin-top: 4px;">
                                    <div style="display: flex; gap: 4px; align-items: center;">
                                        <input type="number" id="disparity-offset-${i}" value="0" step="0.1" style="flex: 1; padding: 2px; font-size: 11px;" placeholder="Offset added to disparity values">
                                        <button class="reset-disparity-offset" data-file-index="${i}" style="padding: 2px 6px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 9px; height: 24px; flex: 0 0 auto;" title="Reset to 0">↺</button>
                                    </div>
                                </div>
                            </div>
                            <div class="depth-group" style="margin-bottom: 8px;">
                                <button class="depth-section-toggle" data-section="mono-params-${i}" style="width: 100%; text-align: left; background: transparent; border: none; color: var(--vscode-foreground); cursor: pointer; padding: 2px 0; font-size: 10px; font-weight: bold; display: flex; align-items: center; gap: 4px;">
                                    <span class="toggle-icon" style="font-size: 8px;">▶</span> Depth from Mono Parameters ⭐
                                </button>
                                <div class="depth-section-content" id="mono-params-${i}" style="display: none; margin-top: 4px;">
                                    <div style="display: flex; gap: 6px; align-items: end;">
                                        <div style="flex: 1;">
                                            <label for="depth-scale-${i}" style="display: block; font-size: 9px; font-weight: bold; margin-bottom: 2px;">Scale:</label>
                                            <input type="number" id="depth-scale-${i}" value="1.0" step="0.1" style="width: 100%; padding: 2px; font-size: 11px;" placeholder="Scale factor">
                                        </div>
                                        <div style="flex: 1;">
                                            <label for="depth-bias-${i}" style="display: block; font-size: 9px; font-weight: bold; margin-bottom: 2px;">Bias:</label>
                                            <input type="number" id="depth-bias-${i}" value="0.0" step="0.1" style="width: 100%; padding: 2px; font-size: 11px;" placeholder="Bias offset">
                                        </div>
                                        <div style="flex: 0 0 auto;">
                                            <button class="reset-mono-params" data-file-index="${i}" style="padding: 2px 6px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 9px; height: 24px;" title="Reset to Scale=1.0, Bias=0.0">↺</button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            ${
                              commentSettings.isPngDerivedFile(data)
                                ? `
                            <div class="depth-group" style="margin-bottom: 8px;">
                                <label for="png-scale-factor-${i}" style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">Scale Factor ⭐:</label>
                                <input type="number" id="png-scale-factor-${i}" value="${this.getPngScaleFactor(data)}" min="0.1" step="0.1" style="width: 100%; padding: 2px; font-size: 11px;" placeholder="1000 for mm, 256 for disparity">
                                <div style="font-size: 9px; color: var(--vscode-descriptionForeground); margin-top: 1px;">The depth/disparity is divided to get the applied value in meters/disparities</div>
                            </div>
                            `
                                : ''
                            }
                            <div class="depth-group" style="margin-bottom: 8px;">
                                <button class="depth-section-toggle" data-section="rgb24-params-${i}" style="width: 100%; text-align: left; background: transparent; border: none; color: var(--vscode-foreground); cursor: pointer; padding: 2px 0; font-size: 10px; font-weight: bold; display: flex; align-items: center; gap: 4px;">
                                    <span class="toggle-icon" style="font-size: 8px;">▶</span> RGB to 24bit Conversion Mode
                                </button>
                                <div class="depth-section-content" id="rgb24-params-${i}" style="display: none; margin-top: 4px;">
                                    <label for="rgb24-conversion-mode-${i}" style="display: block; font-size: 9px; font-weight: bold; margin-bottom: 2px;">Conversion Mode:</label>
                                    <select id="rgb24-conversion-mode-${i}" style="width: 100%; padding: 2px; font-size: 11px;">
                                        <option value="shift" ${this.getRgb24ConversionMode(data) === 'shift' ? 'selected' : ''}>RGB as 24-bit</option>
                                        <option value="multiply" ${this.getRgb24ConversionMode(data) === 'multiply' ? 'selected' : ''}>Shift 255</option>
                                        <option value="red" ${this.getRgb24ConversionMode(data) === 'red' ? 'selected' : ''}>Red Channel Only</option>
                                        <option value="green" ${this.getRgb24ConversionMode(data) === 'green' ? 'selected' : ''}>Green Channel Only</option>
                                        <option value="blue" ${this.getRgb24ConversionMode(data) === 'blue' ? 'selected' : ''}>Blue Channel Only</option>
                                    </select>
                                    <div style="font-size: 9px; color: var(--vscode-descriptionForeground); margin-top: 1px;">How to extract depth from RGB channels (only used if image is RGB)</div>

                                    <label for="rgb24-scale-factor-${i}" style="display: block; font-size: 9px; font-weight: bold; margin-bottom: 2px; margin-top: 8px;">RGB24 Scale Factor:</label>
                                    <input type="number" id="rgb24-scale-factor-${i}" value="${this.getRgb24ScaleFactor(data)}" style="width: 100%; padding: 2px; font-size: 11px;" step="1" min="1" />
                                    <div style="font-size: 9px; color: var(--vscode-descriptionForeground); margin-top: 1px;">Divider for 24 bit image (e.g., 1000, so max value is 16777.215)</div>
                                </div>
                            </div>
                            <div class="depth-group" style="margin-bottom: 8px;">
                                <button class="depth-section-toggle" data-section="coordinate-convention-${i}" style="width: 100%; text-align: left; background: transparent; border: none; color: var(--vscode-foreground); cursor: pointer; padding: 2px 0; font-size: 10px; font-weight: bold; display: flex; align-items: center; gap: 4px;">
                                    <span class="toggle-icon" style="font-size: 8px;">▶</span> Coordinate Convention ⭐
                                </button>
                                <div class="depth-section-content" id="coordinate-convention-${i}" style="display: none; margin-top: 4px;">
                                    <select id="convention-${i}" style="width: 100%; padding: 2px; font-size: 11px;">
                                        <option value="opengl" ${this.getDepthConvention(data) === 'opengl' ? 'selected' : ''}>OpenGL (Y-up, Z-backward)</option>
                                        <option value="opencv" ${this.getDepthConvention(data) === 'opencv' ? 'selected' : ''}>OpenCV (Y-down, Z-forward)</option>
                                    </select>
                                </div>
                            </div>
                            <div class="depth-group" style="margin-bottom: 8px;">
                                <button class="depth-section-toggle" data-section="color-image-${i}" style="width: 100%; text-align: left; background: transparent; border: none; color: var(--vscode-foreground); cursor: pointer; padding: 2px 0; font-size: 10px; font-weight: bold; display: flex; align-items: center; gap: 4px;">
                                    <span class="toggle-icon" style="font-size: 8px;">▶</span> Color Image (optional)
                                </button>
                                <div class="depth-section-content" id="color-image-${i}" style="display: none; margin-top: 4px;">
                                    <button class="select-color-image" data-file-index="${i}" style="width: 100%; padding: 4px 8px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 11px; text-align: left;">📁 Select Color Image...</button>
                                    ${this.getStoredColorImageName(i) ? `<div style="font-size: 9px; color: var(--vscode-textLink-foreground); margin-top: 2px; display: flex; align-items: center; gap: 4px;">📷 Current: ${this.getStoredColorImageName(i)} <button class="remove-color-image" data-file-index="${i}" style="font-size: 8px; padding: 1px 4px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer;">✕</button></div>` : ''}
                                </div>
                            </div>
                            <div class="depth-group" style="margin-bottom: 8px;">
                                <div style="display: flex; gap: 4px;">
                                    <button class="apply-depth-settings" data-file-index="${i}" style="flex: 1; padding: 4px 8px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 11px; ${this.liveDepthUpdateFiles.has(i) ? 'display:none;' : ''}">Apply Settings</button>
                                    <button class="save-ply-file" data-file-index="${i}" style="flex: 1; padding: 4px 8px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 11px;">💾 Save as PLY</button>
                                </div>
                                <div style="display: flex; gap: 4px; margin-top: 4px;">
                                    <button class="use-as-default-settings" data-file-index="${i}" style="flex: 1; padding: 4px 8px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 11px;">⭐ Use as Default</button>
                                    <button class="reset-to-default-settings" data-file-index="${i}" style="flex: 1; padding: 4px 8px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 11px;">⭐ Reset to Default</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    `
                        : ''
                    }
                    
                    <!-- Transform Controls (Second) -->
                    <div class="transform-section">
                        <button class="transform-toggle" data-file-index="${i}">
                            <span class="toggle-icon">▶</span> Transform
                        </button>
                        <div class="transform-panel" id="transform-panel-${i}" style="display:none;">
                            <div class="transform-group">
                                <label style="font-size:10px;font-weight:bold;">Transformations:</label>
                                <div class="transform-buttons">
                                    <button class="add-translation" data-file-index="${i}">Add Translation</button>
                                    <button class="add-quaternion" data-file-index="${i}">Add Quaternion</button>
                                    <button class="add-angle-axis" data-file-index="${i}">Add Angle-Axis</button>
                                </div>
                            </div>
                            
                            <div class="transform-group">
                                <label style="font-size:10px;font-weight:bold;">Rotation (90°):</label>
                                <div class="transform-buttons">
                                    <button class="rotate-x" data-file-index="${i}">X</button>
                                    <button class="rotate-y" data-file-index="${i}">Y</button>
                                    <button class="rotate-z" data-file-index="${i}">Z</button>
                                </div>
                            </div>
                            
                            <div class="transform-group">
                                <label style="font-size:10px;font-weight:bold;">Matrix (4x4):</label>
                                <textarea id="matrix-${i}" rows="4" cols="50" style="width:100%;font-size:9px;font-family:monospace;" placeholder="1.000000 0.000000 0.000000 0.000000&#10;0.000000 1.000000 0.000000 0.000000&#10;0.000000 0.000000 1.000000 0.000000&#10;0.000000 0.000000 0.000000 1.000000">${matrixStr.trim()}</textarea>
                                <div class="transform-buttons" style="margin-top:4px;">
                                    <button class="apply-matrix" data-file-index="${i}">Apply Matrix</button>
                                    <button class="invert-matrix" data-file-index="${i}">Invert</button>
                                    <button class="reset-matrix" data-file-index="${i}">Reset</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- Universal Rendering Controls (conditional based on file content) -->
                    <div class="rendering-controls" style="margin-top: 4px; margin-bottom: 6px;">
                        ${(() => {
                          const hasFaces = data.faceCount > 0;
                          const hasLines =
                            (data as any).objData && (data as any).objData.lineCount > 0;
                          const hasGeometry = hasFaces || hasLines; // Either faces or lines enable mesh/wireframe modes
                          const hasNormalsData = data.hasNormals || hasFaces; // Faces can generate normals
                          const buttons = [];

                          // Debug logging
                          console.log(
                            `File ${i}: ${data.fileName}, faceCount=${data.faceCount}, lineCount=${(data as any).objData?.lineCount || 0}, hasNormals=${data.hasNormals}, hasFaces=${hasFaces}, hasLines=${hasLines}, hasGeometry=${hasGeometry}`
                          );

                          // Always show points button
                          buttons.push(
                            `<button class="render-mode-btn points-btn" data-file-index="${i}" data-mode="points" style="padding: 3px 6px; border: 1px solid var(--vscode-panel-border); border-radius: 2px; font-size: 9px; cursor: pointer;">👁️ Points</button>`
                          );

                          // Show mesh/wireframe buttons if there are faces OR lines (OBJ wireframes)
                          if (hasGeometry) {
                            buttons.push(
                              `<button class="render-mode-btn mesh-btn" data-file-index="${i}" data-mode="mesh" style="padding: 3px 6px; border: 1px solid var(--vscode-panel-border); border-radius: 2px; font-size: 9px; cursor: pointer;">🔷 Mesh</button>`
                            );
                            buttons.push(
                              `<button class="render-mode-btn wireframe-btn" data-file-index="${i}" data-mode="wireframe" style="padding: 3px 6px; border: 1px solid var(--vscode-panel-border); border-radius: 2px; font-size: 9px; cursor: pointer;">📐 Wireframe</button>`
                            );
                          }

                          // Show normals button if there are normals or faces (can compute normals)
                          // Exception: Don't show for PTS files unless they actually have normals in vertices
                          const isPtsFile = data.fileName?.toLowerCase().endsWith('.pts');
                          const shouldShowNormals =
                            hasNormalsData &&
                            (!isPtsFile ||
                              (data.vertices.length > 0 && data.vertices[0]?.nx !== undefined));

                          if (shouldShowNormals) {
                            buttons.push(
                              `<button class="render-mode-btn normals-btn" data-file-index="${i}" data-mode="normals" style="padding: 3px 6px; border: 1px solid var(--vscode-panel-border); border-radius: 2px; font-size: 9px; cursor: pointer;">📏 Normals</button>`
                            );
                          }

                          // Determine grid layout based on number of buttons
                          const buttonCount = buttons.length;
                          let gridColumns = '';
                          if (buttonCount === 1) {
                            gridColumns = '1fr';
                          } else if (buttonCount === 2) {
                            gridColumns = '1fr 1fr';
                          } else if (buttonCount === 3) {
                            gridColumns = '1fr 1fr 1fr';
                          } else if (buttonCount === 4) {
                            gridColumns = '1fr 1fr 1fr 1fr';
                          }

                          return `<div style="display: grid; grid-template-columns: ${gridColumns}; gap: 3px;">${buttons.join('')}</div>`;
                        })()}
                    </div>
                    
                    <!-- Point/Line Size Control -->
                    <div class="point-size-control" style="margin-top: 4px;">
                        <label for="size-${i}" style="font-size: 11px;">Point Size:</label>
                        ${(() => {
                          const isObjFile = (data as any).isObjFile;
                          const currentSize = this.pointSizes[i];

                          // Universal point size slider for all file types
                          const sizeValue = currentSize || 0.001;
                          return `<input type="range" id="size-${i}" min="0.0001" max="0.1" step="0.0001" value="${sizeValue}" class="size-slider" style="width: 100%;">
                            <input type="text" id="size-input-${i}" class="size-input" value="${sizeValue.toFixed(4)}" style="font-size: 10px; width: 30px; border: none; background: transparent; color: var(--vscode-foreground); text-align: left; padding: 0; margin: 0; outline: none; cursor: text;">`;
                        })()}
                    </div>
                    
                    ${
                      (data as any).isObjWireframe || (data as any).isObjFile
                        ? `
                    <!-- OBJ Controls -->
                    <div class="obj-controls" style="margin-top: 8px;">
                        <!-- MTL Material Control -->
                        <button class="load-mtl-btn" data-file-index="${i}" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 1px solid var(--vscode-panel-border); padding: 4px 8px; border-radius: 2px; cursor: pointer; font-size: 11px; width: 100%; margin-bottom: 4px;">
                            🎨 Load MTL Material
                        </button>
                        ${
                          this.appliedMtlNames[i]
                            ? `
                        <div class="mtl-status" style="font-size: 9px; color: var(--vscode-textLink-foreground); margin-bottom: 4px; text-align: center;">
                            📄 ${this.appliedMtlNames[i]} applied
                        </div>
                        `
                            : ''
                        }
                    </div>
                    `
                        : ''
                    }
                    
                    <!-- Color Control (Fourth) -->
                    <div class="color-control">
                        <label for="color-${i}">Color:</label>
                        <select id="color-${i}" class="color-selector">
                            ${data.hasColors ? `<option value="original" ${this.individualColorModes[i] === 'original' ? 'selected' : ''}>Original</option>` : ''}
                            ${
                              this.hasIntensityData(data)
                                ? `
                            <option value="intensity" ${this.individualColorModes[i] === 'intensity' ? 'selected' : ''}>Intensity</option>
                            <option value="intensity-viridis" ${this.individualColorModes[i] === 'intensity-viridis' ? 'selected' : ''}>Intensity (Viridis)</option>
                            <option value="intensity-colors" ${this.individualColorModes[i] === 'intensity-colors' ? 'selected' : ''}>Intensity (Colors)</option>`
                                : ''
                            }
                            <option value="assigned" ${this.individualColorModes[i] === 'assigned' ? 'selected' : ''}>Assigned (${this.getColorName(i)})</option>
                            ${this.getColorOptions(i)}
                        </select>
                    </div>
                    </div><!-- close file-item-content -->
                </div>
            `;
    }

    // Render pose entries appended after point clouds
    const baseIndex = this.spatialFiles.length;
    for (let p = 0; p < this.poseGroups.length; p++) {
      const i = baseIndex + p;
      const meta = this.poseMeta[p];
      const color = this.fileColors[i % this.fileColors.length];
      const colorHex = `#${Math.round(color[0] * 255)
        .toString(16)
        .padStart(2, '0')}${Math.round(color[1] * 255)
        .toString(16)
        .padStart(2, '0')}${Math.round(color[2] * 255)
        .toString(16)
        .padStart(2, '0')}`;
      const colorIndicator = `<span class="color-indicator" style="background-color: ${colorHex}"></span>`;
      const visible = this.fileVisibility[i] ?? true;
      const sizeVal = this.pointSizes[i] ?? 0.02;
      // Transformation matrix UI content for pose
      const poseMatrixArr = this.getTransformationMatrixAsArray(i);
      let poseMatrixStr = '';
      for (let r = 0; r < 4; ++r) {
        const row = poseMatrixArr.slice(r * 4, r * 4 + 4).map(v => v.toFixed(6));
        poseMatrixStr += row.join(' ') + '\n';
      }

      const isPoseCollapsed = this.fileItemsCollapsed[i] ?? false;
      html += `
                <div class="file-item">
                    <div class="file-item-main">
                        <button class="collapse-toggle" data-file-index="${i}" title="${isPoseCollapsed ? 'Expand' : 'Collapse'}">
                            <span class="collapse-icon">${isPoseCollapsed ? '▶' : '▼'}</span>
                        </button>
                        <input type="checkbox" id="file-${i}" ${visible ? 'checked' : ''}>
                        ${colorIndicator}
                        <label for="file-${i}" class="file-name" data-short-path="${(meta as any).shortPath || meta.fileName || ''}">${meta.fileName || `Pose ${p + 1}`}</label>
                        <button class="remove-file" data-file-index="${i}" title="Remove object">✕</button>
                    </div>
                    <div class="file-item-content" id="file-content-${i}" style="display: ${isPoseCollapsed ? 'none' : 'block'}">
                    <div class="file-info">${meta.jointCount} joints, ${meta.edgeCount} edges${meta.invalidJoints ? `, ${meta.invalidJoints} invalid` : ''}</div>
                    <div class="panel-section" style="margin-top:6px;">
                        <div class="control-buttons">
                            <label style="font-size:10px;display:flex;align-items:center;gap:6px;">
                                <input type="checkbox" id="pose-dataset-colors-${i}" ${this.poseUseDatasetColors[i] ? 'checked' : ''}>
                                Use dataset colors
                            </label>
                            <label style="font-size:10px;display:flex;align-items:center;gap:6px;">
                                <input type="checkbox" id="pose-show-labels-${i}" ${this.poseShowLabels[i] ? 'checked' : ''}>
                                Show labels
                            </label>
                            <label style="font-size:10px;display:flex;align-items:center;gap:6px;">
                                <input type="checkbox" id="pose-scale-score-${i}" ${this.poseScaleByScore[i] ? 'checked' : ''}>
                                Scale by score
                            </label>
                            <label style="font-size:10px;display:flex;align-items:center;gap:6px;">
                                <input type="checkbox" id="pose-scale-uncertainty-${i}" ${this.poseScaleByUncertainty[i] ? 'checked' : ''}>
                                Scale by uncertainty
                            </label>
                            <div style="display:flex;gap:6px;align-items:center;">
                                <span style="font-size:10px;">Pose Convention:</span>
                                <select id="pose-conv-${i}" style="font-size:10px;">
                                    <option value="opengl" ${this.poseConvention[i] === 'opengl' ? 'selected' : ''}>OpenGL</option>
                                    <option value="opencv" ${this.poseConvention[i] === 'opencv' ? 'selected' : ''}>OpenCV</option>
                                </select>
                            </div>
                            <div style="display:flex;gap:6px;align-items:center;">
                                <span style="font-size:10px;">Min score:</span>
                                <input type="range" id="pose-minscore-${i}" min="0" max="1" step="0.01" value="${(this.poseMinScoreThreshold[i] ?? 0).toFixed(2)}" style="flex:1;">
                                <span id="pose-minscore-val-${i}" style="font-size:10px;">${(this.poseMinScoreThreshold[i] ?? 0).toFixed(2)}</span>
                            </div>
                            <div style="display:flex;gap:6px;align-items:center;">
                                <span style="font-size:10px;">Max uncertainty:</span>
                                <input type="range" id="pose-maxunc-${i}" min="0" max="1" step="0.01" value="${(this.poseMaxUncertaintyThreshold[i] ?? 1).toFixed(2)}" style="flex:1;">
                                <span id="pose-maxunc-val-${i}" style="font-size:10px;">${(this.poseMaxUncertaintyThreshold[i] ?? 1).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="transform-section">
                        <button class="transform-toggle" data-file-index="${i}">
                            <span class="toggle-icon">▶</span> Transform
                        </button>
                        <div class="transform-panel" id="transform-panel-${i}" style="display:none;">
                            <div class="transform-group">
                                <label style="font-size:10px;font-weight:bold;">Transformations:</label>
                                <div class="transform-buttons">
                                    <button class="add-translation" data-file-index="${i}">Add Translation</button>
                                    <button class="add-quaternion" data-file-index="${i}">Add Quaternion</button>
                                    <button class="add-angle-axis" data-file-index="${i}">Add Angle-Axis</button>
                                </div>
                            </div>
                            <div class="transform-group">
                                <label style="font-size:10px;font-weight:bold;">Rotation (90°):</label>
                                <div class="transform-buttons">
                                    <button class="rotate-x" data-file-index="${i}">X</button>
                                    <button class="rotate-y" data-file-index="${i}">Y</button>
                                    <button class="rotate-z" data-file-index="${i}">Z</button>
                                </div>
                            </div>
                            <div class="transform-group">
                                <label style="font-size:10px;font-weight:bold;">Matrix (4x4):</label>
                                <textarea id="matrix-${i}" rows="4" cols="50" style="width:100%;font-size:9px;font-family:monospace;" placeholder="1.000000 0.000000 0.000000 0.000000&#10;0.000000 1.000000 0.000000 0.000000&#10;0.000000 0.000000 1.000000 0.000000&#10;0.000000 0.000000 0.000000 1.000000">${poseMatrixStr.trim()}</textarea>
                                <div class="transform-buttons" style="margin-top:4px;">
                                    <button class="apply-matrix" data-file-index="${i}">Apply Matrix</button>
                                    <button class="invert-matrix" data-file-index="${i}">Invert</button>
                                    <button class="reset-matrix" data-file-index="${i}">Reset</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="point-size-control">
                        <label for="size-${i}">Joint Radius (m):</label>
                        <input type="range" id="size-${i}" min="0.001" max="0.1" step="0.001" value="${sizeVal}" class="size-slider">
                        <input type="text" id="size-input-${i}" class="size-input" value="${sizeVal.toFixed(3)}" style="font-size: 10px; width: 30px; border: none; background: transparent; color: var(--vscode-foreground); text-align: left; padding: 0; margin: 0; outline: none; cursor: text;">
                    </div>
                    <div class="color-control">
                        <label for="color-${i}">Color:</label>
                        <select id="color-${i}" class="color-selector">
                            <option value="assigned" ${this.individualColorModes[i] === 'assigned' ? 'selected' : ''}>Assigned (Red)</option>
                            ${this.getColorOptions(i)}
                        </select>
                    </div>
                    </div><!-- close file-item-content -->
                </div>
            `;
    }

    // Render camera profiles (like poses)
    for (let c = 0; c < this.cameraGroups.length; c++) {
      const i = this.spatialFiles.length + this.poseGroups.length + c; // Unified index
      const cameraProfileName = this.cameraNames[c];
      const color = this.fileColors[i % this.fileColors.length];
      const colorHex = `#${Math.round(color[0] * 255)
        .toString(16)
        .padStart(2, '0')}${Math.round(color[1] * 255)
        .toString(16)
        .padStart(2, '0')}${Math.round(color[2] * 255)
        .toString(16)
        .padStart(2, '0')}`;
      const colorIndicator = `<span class="color-indicator" style="background-color: ${colorHex}"></span>`;
      const visible = this.fileVisibility[i] ?? true;
      const sizeVal = this.pointSizes[i] ?? 1.0;

      // Count cameras in the profile
      const group = this.cameraGroups[c];
      const cameraCount = group.children.length;

      // Transformation matrix UI
      const cameraMatrixArr = this.getTransformationMatrixAsArray(i);
      let cameraMatrixStr = '';
      for (let r = 0; r < 4; ++r) {
        const row = cameraMatrixArr.slice(r * 4, r * 4 + 4).map(v => v.toFixed(6));
        cameraMatrixStr += row.join(' ') + '\n';
      }

      const isCameraCollapsed = this.fileItemsCollapsed[i] ?? false;
      html += `
                <div class="file-item">
                    <div class="file-item-main">
                        <button class="collapse-toggle" data-file-index="${i}" title="${isCameraCollapsed ? 'Expand' : 'Collapse'}">
                            <span class="collapse-icon">${isCameraCollapsed ? '▶' : '▼'}</span>
                        </button>
                        <input type="checkbox" id="file-${i}" ${visible ? 'checked' : ''}>
                        ${colorIndicator}
                        <label for="file-${i}" class="file-name" data-short-path="${cameraProfileName}">📷 ${cameraProfileName}</label>
                        <button class="remove-file" data-file-index="${i}" title="Remove camera profile">✕</button>
                    </div>
                    <div class="file-item-content" id="file-content-${i}" style="display: ${isCameraCollapsed ? 'none' : 'block'}">
                    <div class="file-info">${cameraCount} cameras</div>
                    <div class="panel-section" style="margin-top:6px;">
                        <div class="control-buttons">
                            <label style="font-size:10px;display:flex;align-items:center;gap:6px;">
                                <input type="checkbox" id="camera-show-labels-${i}" ${this.cameraShowLabels[c] ? 'checked' : ''}>
                                Show labels
                            </label>
                            <label style="font-size:10px;display:flex;align-items:center;gap:6px;">
                                <input type="checkbox" id="camera-show-coords-${i}" ${this.cameraShowCoords[c] ? 'checked' : ''}>
                                Show coordinates
                            </label>
                        </div>
                    </div>
                    <div class="size-control">
                        <label for="size-${i}">Scale:</label>
                        <input type="range" id="size-${i}" min="0.1" max="5.0" step="0.1" value="${sizeVal}">
                        <input type="text" id="size-input-${i}" class="size-input" value="${sizeVal.toFixed(1)}" style="font-size: 10px; width: 20px; border: none; background: transparent; color: var(--vscode-foreground); text-align: left; padding: 0; margin: 0; outline: none; cursor: text;">
                    </div>
                    <!-- Transform Panel (First) -->
                    <div class="transformation-panel" style="margin-top:8px;">
                        <div class="panel-header" style="display:flex;align-items:center;margin-bottom:4px;">
                            <button class="toggle-panel transformation-toggle" data-file-index="${i}" style="background:none;border:none;color:var(--vscode-foreground);cursor:pointer;display:flex;align-items:center;gap:4px;padding:2px;font-size:10px;">
                                <span class="toggle-icon">▶</span> Transform Matrix
                            </button>
                        </div>
                        <div id="transformation-panel-${i}" class="transformation-content" style="display:none;background:var(--vscode-editor-background);border:1px solid var(--vscode-panel-border);border-radius:4px;padding:8px;margin-top:4px;">
                            
                            <div class="transform-group">
                                <label style="font-size:10px;font-weight:bold;">Matrix (4x4):</label>
                                <textarea id="matrix-${i}" rows="4" cols="50" style="width:100%;font-size:9px;font-family:monospace;" placeholder="1.000000 0.000000 0.000000 0.000000&#10;0.000000 1.000000 0.000000 0.000000&#10;0.000000 0.000000 1.000000 0.000000&#10;0.000000 0.000000 0.000000 1.000000">${cameraMatrixStr.trim()}</textarea>
                                <div class="transform-buttons" style="margin-top:4px;">
                                    <button class="apply-matrix" data-file-index="${i}">Apply Matrix</button>
                                    <button class="invert-matrix" data-file-index="${i}">Invert</button>
                                    <button class="reset-matrix" data-file-index="${i}">Reset</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    </div><!-- close file-item-content -->
                </div>
            `;
    }

    // In-progress add(s): a non-blocking loading row so the user sees progress
    // here while still interacting with the already-loaded clouds.
    if (this.pendingLoadLabel !== null) {
      html += `
                <div class="file-item file-item-loading">
                    <div class="file-item-main">
                        <span class="spinner spinner-inline"></span>
                        <span class="file-name">Loading ${escapeHtml(this.pendingLoadLabel)}…</span>
                    </div>
                    <div class="file-info" id="pending-load-detail">${escapeHtml(this.pendingLoadDetail)}</div>
                </div>
            `;
    }

    fileListDiv.innerHTML = html;

    // Add event listeners after setting innerHTML
    const totalEntries =
      this.spatialFiles.length + this.poseGroups.length + this.cameraGroups.length;
    for (let i = 0; i < totalEntries; i++) {
      const checkbox = document.getElementById(`file-${i}`);
      if (checkbox) {
        checkbox.addEventListener('click', e => {
          const event = e as MouseEvent;
          if (event.shiftKey) {
            // Shift+click: solo this point cloud
            e.preventDefault(); // Prevent checkbox from toggling
            this.soloPointCloud(i);
          } else {
            // Normal click: let the checkbox toggle normally
            // The change event will handle the visibility toggle
          }
        });

        // Keep the change event for normal toggling
        checkbox.addEventListener('change', () => {
          this.toggleFileVisibility(i);
        });
      }
    }

    // Add tooltips only to truncated filenames
    addTooltipsToTruncatedFilenames();

    // Collapse toggle logic for file items
    for (let i = 0; i < totalEntries; i++) {
      const collapseBtn = document.querySelector(`.collapse-toggle[data-file-index="${i}"]`);
      if (collapseBtn) {
        collapseBtn.addEventListener('click', e => {
          e.stopPropagation(); // Prevent triggering other events
          const content = document.getElementById(`file-content-${i}`);
          const icon = collapseBtn.querySelector('.collapse-icon');

          if (content && icon) {
            const isCollapsed = content.style.display === 'none';
            content.style.display = isCollapsed ? 'block' : 'none';
            icon.textContent = isCollapsed ? '▼' : '▶';
            this.fileItemsCollapsed[i] = !isCollapsed;

            // Update tooltip
            collapseBtn.setAttribute('title', isCollapsed ? 'Collapse' : 'Expand');
          }
        });
      }
    }

    // Transform toggle logic with improved UI (handle both point clouds and cameras)
    for (let i = 0; i < totalEntries; i++) {
      const transformBtn = document.querySelector(`.transform-toggle[data-file-index="${i}"]`);
      const transformationBtn = document.querySelector(
        `.transformation-toggle[data-file-index="${i}"]`
      );
      const transformPanel = document.getElementById(`transform-panel-${i}`);
      const transformationPanel = document.getElementById(`transformation-panel-${i}`);

      const activeBtn = transformBtn || transformationBtn;
      const activePanel = transformPanel || transformationPanel;

      if (activeBtn && activePanel) {
        // Always hide by default and set triangle to side
        activePanel.style.display = 'none';
        const toggleIcon = activeBtn.querySelector('.toggle-icon');
        if (toggleIcon) {
          toggleIcon.textContent = '▶';
        }

        activeBtn.addEventListener('click', () => {
          const isVisible = activePanel.style.display !== 'none';
          activePanel.style.display = isVisible ? 'none' : 'block';
          if (toggleIcon) {
            toggleIcon.textContent = isVisible ? '▶' : '▼';
          }
        });
      }

      // Depth section toggle logic
      const depthSectionToggles = document.querySelectorAll(
        `.depth-section-toggle[data-section*="${i}"]`
      );
      depthSectionToggles.forEach(toggle => {
        const sectionId = toggle.getAttribute('data-section');
        const sectionContent = document.getElementById(sectionId!);

        if (toggle && sectionContent) {
          // Always hide by default and set triangle to side
          sectionContent.style.display = 'none';
          const toggleIcon = toggle.querySelector('.toggle-icon');
          if (toggleIcon) {
            toggleIcon.textContent = '▶';
          }

          toggle.addEventListener('click', () => {
            const isVisible = sectionContent.style.display !== 'none';
            sectionContent.style.display = isVisible ? 'none' : 'block';
            if (toggleIcon) {
              toggleIcon.textContent = isVisible ? '▶' : '▼';
            }
          });
        }
      });

      // Apply matrix logic with improved parsing
      const applyBtn = document.querySelector(`.apply-matrix[data-file-index="${i}"]`);
      if (applyBtn && activePanel) {
        applyBtn.addEventListener('click', () => {
          const textarea = document.getElementById(`matrix-${i}`) as HTMLTextAreaElement;
          if (textarea) {
            const values = parseMatrixInput(textarea.value);
            if (values && values.length === 16) {
              const mat = new THREE.Matrix4();
              // Read matrix in row-major order (as displayed in UI)
              mat.set(
                values[0],
                values[1],
                values[2],
                values[3],
                values[4],
                values[5],
                values[6],
                values[7],
                values[8],
                values[9],
                values[10],
                values[11],
                values[12],
                values[13],
                values[14],
                values[15]
              );
              this.setTransformationMatrix(i, mat);
              // Auto-format the matrix after applying
              this.updateMatrixTextarea(i);
            } else {
              alert('Please enter 16 valid numbers for the 4x4 matrix.');
            }
          }
        });
      }

      // Invert matrix logic
      const invertBtn = document.querySelector(`.invert-matrix[data-file-index="${i}"]`);
      if (invertBtn && transformPanel) {
        invertBtn.addEventListener('click', () => {
          const currentMatrix = this.getTransformationMatrix(i);
          try {
            const invertedMatrix = currentMatrix.clone().invert();
            this.setTransformationMatrix(i, invertedMatrix);
            this.updateMatrixTextarea(i);
          } catch (error) {
            alert('Matrix is not invertible (determinant is zero).');
          }
        });
      }

      // Reset matrix logic
      const resetBtn = document.querySelector(`.reset-matrix[data-file-index="${i}"]`);
      if (resetBtn && transformPanel) {
        resetBtn.addEventListener('click', () => {
          this.resetTransformationMatrix(i);
          // Update textarea to identity
          const textarea = document.getElementById(`matrix-${i}`) as HTMLTextAreaElement;
          if (textarea) {
            textarea.value =
              '1.000000 0.000000 0.000000 0.000000\n0.000000 1.000000 0.000000 0.000000\n0.000000 0.000000 1.000000 0.000000\n0.000000 0.000000 0.000000 1.000000';
          }
        });
      }

      // Transformation buttons
      const addTranslationBtn = document.querySelector(`.add-translation[data-file-index="${i}"]`);
      if (addTranslationBtn) {
        addTranslationBtn.addEventListener('click', () => {
          this.showTranslationDialog(i);
        });
      }

      const addQuaternionBtn = document.querySelector(`.add-quaternion[data-file-index="${i}"]`);
      if (addQuaternionBtn) {
        addQuaternionBtn.addEventListener('click', () => {
          this.showQuaternionDialog(i);
        });
      }

      const addAngleAxisBtn = document.querySelector(`.add-angle-axis[data-file-index="${i}"]`);
      if (addAngleAxisBtn) {
        addAngleAxisBtn.addEventListener('click', () => {
          this.showAngleAxisDialog(i);
        });
      }

      // Rotation buttons
      const rotateXBtn = document.querySelector(`.rotate-x[data-file-index="${i}"]`);
      if (rotateXBtn) {
        rotateXBtn.addEventListener('click', () => {
          const rotationMatrix = createRotationMatrix('x', Math.PI / 2); // 90 degrees
          this.multiplyTransformationMatrices(i, rotationMatrix);
          this.updateMatrixTextarea(i);
        });
      }

      const rotateYBtn = document.querySelector(`.rotate-y[data-file-index="${i}"]`);
      if (rotateYBtn) {
        rotateYBtn.addEventListener('click', () => {
          const rotationMatrix = createRotationMatrix('y', Math.PI / 2); // 90 degrees
          this.multiplyTransformationMatrices(i, rotationMatrix);
          this.updateMatrixTextarea(i);
        });
      }

      const rotateZBtn = document.querySelector(`.rotate-z[data-file-index="${i}"]`);
      if (rotateZBtn) {
        rotateZBtn.addEventListener('click', () => {
          const rotationMatrix = createRotationMatrix('z', Math.PI / 2); // 90 degrees
          this.multiplyTransformationMatrices(i, rotationMatrix);
          this.updateMatrixTextarea(i);
        });
      }

      // Pose controls listeners
      const datasetColorsCb = document.getElementById(
        `pose-dataset-colors-${i}`
      ) as HTMLInputElement;
      if (datasetColorsCb) {
        datasetColorsCb.addEventListener('change', () => {
          this.poseUseDatasetColors[i] = !!datasetColorsCb.checked;
          this.updatePoseAppearance(i);
        });
      }
      const showLabelsCb = document.getElementById(`pose-show-labels-${i}`) as HTMLInputElement;
      if (showLabelsCb) {
        showLabelsCb.addEventListener('change', () => {
          this.poseShowLabels[i] = !!showLabelsCb.checked;
          this.updatePoseLabels(i);
        });
      }
      const scaleScoreCb = document.getElementById(`pose-scale-score-${i}`) as HTMLInputElement;
      if (scaleScoreCb) {
        scaleScoreCb.addEventListener('change', () => {
          this.poseScaleByScore[i] = !!scaleScoreCb.checked;
          this.updatePoseScaling(i);
        });
      }
      const scaleUncCb = document.getElementById(`pose-scale-uncertainty-${i}`) as HTMLInputElement;
      if (scaleUncCb) {
        scaleUncCb.addEventListener('change', () => {
          this.poseScaleByUncertainty[i] = !!scaleUncCb.checked;
          this.updatePoseScaling(i);
        });
      }
      const poseConvSel = document.getElementById(`pose-conv-${i}`) as HTMLSelectElement;
      if (poseConvSel) {
        poseConvSel.addEventListener('change', () => {
          const val = poseConvSel.value === 'opencv' ? 'opencv' : 'opengl';
          this.applyPoseConvention(i, val);
        });
      }

      const minScoreSlider = document.getElementById(`pose-minscore-${i}`) as HTMLInputElement;
      const minScoreVal = document.getElementById(`pose-minscore-val-${i}`) as HTMLElement;
      if (minScoreSlider && minScoreVal) {
        minScoreSlider.addEventListener('input', () => {
          const v = Math.max(0, Math.min(1, parseFloat(minScoreSlider.value)));
          this.poseMinScoreThreshold[i] = v;
          minScoreVal.textContent = v.toFixed(2);
          this.applyPoseFilters(i);
        });
      }
      const maxUncSlider = document.getElementById(`pose-maxunc-${i}`) as HTMLInputElement;
      const maxUncVal = document.getElementById(`pose-maxunc-val-${i}`) as HTMLElement;
      if (maxUncSlider && maxUncVal) {
        maxUncSlider.addEventListener('input', () => {
          const v = Math.max(0, Math.min(1, parseFloat(maxUncSlider.value)));
          this.poseMaxUncertaintyThreshold[i] = v;
          maxUncVal.textContent = v.toFixed(2);
          this.applyPoseFilters(i);
        });
      }

      // Camera profile controls listeners
      const cameraLabelCb = document.getElementById(`camera-show-labels-${i}`) as HTMLInputElement;
      if (cameraLabelCb) {
        cameraLabelCb.addEventListener('change', () => {
          const cameraProfileIndex = i - this.spatialFiles.length - this.poseGroups.length;
          this.toggleCameraProfileLabels(cameraProfileIndex, cameraLabelCb.checked);
        });
      }

      const cameraCoordsCb = document.getElementById(`camera-show-coords-${i}`) as HTMLInputElement;
      if (cameraCoordsCb) {
        cameraCoordsCb.addEventListener('change', () => {
          const cameraProfileIndex = i - this.spatialFiles.length - this.poseGroups.length;
          this.toggleCameraProfileCoordinates(cameraProfileIndex, cameraCoordsCb.checked);
        });
      }

      // Add size slider listeners for point clouds and OBJ files
      const sizeSlider = document.getElementById(`size-${i}`) as HTMLInputElement;
      const sizeInput = document.getElementById(`size-input-${i}`) as HTMLInputElement;
      const isPose =
        i >= this.spatialFiles.length && i < this.spatialFiles.length + this.poseGroups.length;
      const isCamera = i >= this.spatialFiles.length + this.poseGroups.length;
      const isObjFile = !isPose && !isCamera && (this.spatialFiles[i] as any).isObjFile;

      // Determine precision based on type
      const getPrecision = () => {
        if (isPose) {
          return 3;
        } // Joint radius precision
        if (isCamera) {
          return 1;
        } // Camera scale precision
        return 4; // Universal point size precision
      };

      if (sizeSlider) {
        sizeSlider.addEventListener('input', e => {
          const newSize = parseFloat((e.target as HTMLInputElement).value);
          this.updatePointSize(i, newSize);
          this.requestRender();

          // Update the number input
          if (sizeInput) {
            sizeInput.value = newSize.toFixed(getPrecision());
          }
        });
      }

      // Add text input listener to allow manual entry beyond slider limits
      if (sizeInput) {
        // Update on blur or Enter key
        const updateFromInput = () => {
          const newSize = parseFloat(sizeInput.value);
          if (!isNaN(newSize) && newSize > 0) {
            this.updatePointSize(i, newSize);
            this.requestRender();

            // Format the value with proper precision
            sizeInput.value = newSize.toFixed(getPrecision());

            // Update slider if value is within slider range
            if (sizeSlider) {
              const min = parseFloat(sizeSlider.min);
              const max = parseFloat(sizeSlider.max);
              if (newSize >= min && newSize <= max) {
                sizeSlider.value = newSize.toString();
              }
            }
          } else {
            // Reset to current value if invalid
            const currentSize = this.pointSizes[i] || 0.001;
            sizeInput.value = currentSize.toFixed(getPrecision());
          }
        };

        sizeInput.addEventListener('blur', updateFromInput);
        sizeInput.addEventListener('keydown', e => {
          if (e.key === 'Enter') {
            updateFromInput();
            sizeInput.blur();
          }
        });

        // Select text on focus for easy editing
        sizeInput.addEventListener('focus', () => {
          sizeInput.select();
        });
      }

      // Color selector listeners
      const colorSelector = document.getElementById(`color-${i}`) as HTMLSelectElement;
      if (colorSelector) {
        colorSelector.addEventListener('change', () => {
          const value = colorSelector.value;
          this.individualColorModes[i] = value;
          const isPose = i >= this.spatialFiles.length;
          if (isPose) {
            // Update pose group material color
            const poseIndex = i - this.spatialFiles.length;
            const group = this.poseGroups[poseIndex];
            if (group) {
              const colorIdx = value === 'assigned' ? i % this.fileColors.length : parseInt(value);
              const color = isNaN(colorIdx)
                ? this.fileColors[i % this.fileColors.length]
                : this.fileColors[colorIdx];
              group.traverse(obj => {
                if ((obj as any).isInstancedMesh && obj instanceof THREE.InstancedMesh) {
                  const material = obj.material as THREE.MeshBasicMaterial;
                  material.color.setRGB(color[0], color[1], color[2]);
                  material.needsUpdate = true;
                } else if ((obj as any).isLineSegments && obj instanceof THREE.LineSegments) {
                  const material = obj.material as THREE.LineBasicMaterial;
                  material.color.setRGB(color[0], color[1], color[2]);
                  material.needsUpdate = true;
                }
              });
            }
          } else if (i < this.meshes.length) {
            // Recreate material for point clouds/OBJ
            const mesh = this.meshes[i] as any;
            const geometry = mesh.geometry as THREE.BufferGeometry | undefined;
            if (geometry) {
              this.applyColorModeToGeometry(this.spatialFiles[i], geometry, value);
            }
            const oldMaterial = this.meshes[i].material as any;
            const newMaterial = this.createMaterialForFile(this.spatialFiles[i], i);
            (this.meshes[i] as any).material = newMaterial;
            if (oldMaterial) {
              if (Array.isArray(oldMaterial)) {
                oldMaterial.forEach((m: any) => m.dispose());
              } else {
                oldMaterial.dispose();
              }
            }
          }
        });
      }

      // Depth settings toggle and controls
      if (
        this.spatialFiles[i] &&
        (commentSettings.isDepthDerivedFile(this.spatialFiles[i]) ||
          (this.spatialFiles[i] as any).isDepthDerived)
      ) {
        const depthToggleBtn = document.querySelector(
          `.depth-settings-toggle[data-file-index="${i}"]`
        );
        const depthPanel = document.getElementById(`depth-panel-${i}`);
        if (depthToggleBtn && depthPanel) {
          // Hide by default
          depthPanel.style.display = 'none';
          const toggleIcon = depthToggleBtn.querySelector('.toggle-icon');
          if (toggleIcon) {
            toggleIcon.textContent = '▶';
          }

          depthToggleBtn.addEventListener('click', () => {
            const isVisible = depthPanel.style.display !== 'none';
            depthPanel.style.display = isVisible ? 'none' : 'block';
            if (toggleIcon) {
              toggleIcon.textContent = isVisible ? '▶' : '▼';
            }
          });
        }

        const liveDepthUpdateCheckbox = document.querySelector(
          `.live-depth-update[data-file-index="${i}"]`
        ) as HTMLInputElement | null;
        if (liveDepthUpdateCheckbox) {
          liveDepthUpdateCheckbox.checked = this.liveDepthUpdateFiles.has(i);
          liveDepthUpdateCheckbox.addEventListener('change', () => {
            this.setLiveDepthUpdateEnabled(i, liveDepthUpdateCheckbox.checked);
            if (liveDepthUpdateCheckbox.checked) {
              this.scheduleLiveDepthUpdate(i, 0);
            }
          });
        }

        if (depthPanel) {
          depthPanel.addEventListener('keydown', event => {
            if (event.key !== 'Enter' || !this.isDepthCommitTarget(event.target)) {
              return;
            }
            event.preventDefault();
            (event.target as HTMLElement).blur();
            this.scheduleLiveDepthUpdate(i, 0);
          });

          depthPanel.addEventListener('focusout', event => {
            if (this.isDepthCommitTarget(event.target)) {
              this.scheduleLiveDepthUpdate(i);
            }
          });

          depthPanel.addEventListener('change', event => {
            if (!this.isDepthCommitTarget(event.target)) {
              return;
            }
            this.updateSingleDefaultButtonState(i);
            this.scheduleLiveDepthUpdate(i, 0);
          });
        }
        // Calibration file loading
        const loadCalibrationBtn = document.querySelector(
          `.load-calibration-btn[data-file-index="${i}"]`
        );
        if (loadCalibrationBtn) {
          loadCalibrationBtn.addEventListener('click', () => {
            this.openCalibrationFileDialog(i);
          });
        }

        // Camera selection change handler
        const cameraSelect = document.getElementById(`camera-select-${i}`) as HTMLSelectElement;
        if (cameraSelect) {
          cameraSelect.addEventListener('change', () => {
            this.onCameraSelectionChange(i, cameraSelect.value);
          });
        }

        // Depth type change handler for baseline and disparity offset visibility
        const depthTypeSelect = document.getElementById(`depth-type-${i}`) as HTMLSelectElement;
        const baselineGroup = document.getElementById(`baseline-group-${i}`);
        const disparityOffsetGroup = document.getElementById(`disparity-offset-group-${i}`);
        if (depthTypeSelect && baselineGroup && disparityOffsetGroup) {
          depthTypeSelect.addEventListener('change', () => {
            const isDisparity = depthTypeSelect.value === 'disparity';
            baselineGroup.style.display = isDisparity ? '' : 'none';
            disparityOffsetGroup.style.display = isDisparity ? '' : 'none';
            this.updateSingleDefaultButtonState(i);
          });
        }

        // Update button state when any depth setting changes
        const fxInput = document.getElementById(`fx-${i}`) as HTMLInputElement;
        const fyInput = document.getElementById(`fy-${i}`) as HTMLInputElement;
        if (fxInput && !fxInput.hasAttribute('data-listener-attached')) {
          fxInput.setAttribute('data-listener-attached', 'true');
          fxInput.addEventListener('input', () => this.updateSingleDefaultButtonState(i));
          // Prevent scroll wheel from changing value but allow page scrolling
          fxInput.addEventListener('wheel', e => {
            (e.target as HTMLInputElement).blur();
          });
        }
        if (fyInput && !fyInput.hasAttribute('data-listener-attached')) {
          fyInput.setAttribute('data-listener-attached', 'true');
          fyInput.addEventListener('input', () => this.updateSingleDefaultButtonState(i));
          // Prevent scroll wheel from changing value but allow page scrolling
          fyInput.addEventListener('wheel', e => {
            (e.target as HTMLInputElement).blur();
          });
        }

        const cxInput = document.getElementById(`cx-${i}`) as HTMLInputElement;
        if (cxInput) {
          cxInput.addEventListener('input', () => this.updateSingleDefaultButtonState(i));
          // Prevent scroll wheel from changing value but allow page scrolling
          cxInput.addEventListener('wheel', e => {
            (e.target as HTMLInputElement).blur();
          });
        }

        const cyInput = document.getElementById(`cy-${i}`) as HTMLInputElement;
        if (cyInput) {
          cyInput.addEventListener('input', () => this.updateSingleDefaultButtonState(i));
          // Prevent scroll wheel from changing value but allow page scrolling
          cyInput.addEventListener('wheel', e => {
            (e.target as HTMLInputElement).blur();
          });
        }

        const cameraModelSelect = document.getElementById(`camera-model-${i}`) as HTMLSelectElement;
        if (cameraModelSelect) {
          cameraModelSelect.addEventListener('change', () => {
            // Show/hide distortion parameters based on camera model selection
            const distortionGroup = document.getElementById(`distortion-params-${i}`);
            const pinholeParams = document.getElementById(`pinhole-params-${i}`);
            const fisheyeOpencvParams = document.getElementById(`fisheye-opencv-params-${i}`);
            const kannalaBrandtParams = document.getElementById(`kannala-brandt-params-${i}`);

            if (distortionGroup && pinholeParams && fisheyeOpencvParams && kannalaBrandtParams) {
              // Hide all parameter sections first
              pinholeParams.style.display = 'none';
              fisheyeOpencvParams.style.display = 'none';
              kannalaBrandtParams.style.display = 'none';

              // Show appropriate parameter section based on model
              if (cameraModelSelect.value === 'pinhole-opencv') {
                distortionGroup.style.display = '';
                pinholeParams.style.display = '';
              } else if (cameraModelSelect.value === 'fisheye-opencv') {
                distortionGroup.style.display = '';
                fisheyeOpencvParams.style.display = '';
              } else if (cameraModelSelect.value === 'fisheye-kannala-brandt') {
                distortionGroup.style.display = '';
                kannalaBrandtParams.style.display = '';
              } else {
                distortionGroup.style.display = 'none';
              }
            }
            this.updateSingleDefaultButtonState(i);
          });

          // Initialize distortion parameters visibility
          const distortionGroup = document.getElementById(`distortion-params-${i}`);
          const pinholeParams = document.getElementById(`pinhole-params-${i}`);
          const fisheyeOpencvParams = document.getElementById(`fisheye-opencv-params-${i}`);
          const kannalaBrandtParams = document.getElementById(`kannala-brandt-params-${i}`);

          if (distortionGroup && pinholeParams && fisheyeOpencvParams && kannalaBrandtParams) {
            // Hide all parameter sections first
            pinholeParams.style.display = 'none';
            fisheyeOpencvParams.style.display = 'none';
            kannalaBrandtParams.style.display = 'none';

            // Show appropriate parameter section based on model
            if (cameraModelSelect.value === 'pinhole-opencv') {
              distortionGroup.style.display = '';
              pinholeParams.style.display = '';
            } else if (cameraModelSelect.value === 'fisheye-opencv') {
              distortionGroup.style.display = '';
              fisheyeOpencvParams.style.display = '';
            } else if (cameraModelSelect.value === 'fisheye-kannala-brandt') {
              distortionGroup.style.display = '';
              kannalaBrandtParams.style.display = '';
            } else {
              distortionGroup.style.display = 'none';
            }
          }
        }

        // Add event listeners for all distortion parameters
        ['k1', 'k2', 'k3', 'k4', 'k5', 'p1', 'p2'].forEach(param => {
          const input = document.getElementById(`${param}-${i}`) as HTMLInputElement;
          if (input) {
            input.addEventListener('input', () => this.updateSingleDefaultButtonState(i));
            input.addEventListener('wheel', e => {
              (e.target as HTMLInputElement).blur();
            });
          }
        });

        const baselineInput = document.getElementById(`baseline-${i}`) as HTMLInputElement;
        if (baselineInput) {
          baselineInput.addEventListener('input', () => this.updateSingleDefaultButtonState(i));
          // Prevent scroll wheel from changing value but allow page scrolling
          baselineInput.addEventListener('wheel', e => {
            (e.target as HTMLInputElement).blur();
          });
        }

        const depthScaleInput = document.getElementById(`depth-scale-${i}`) as HTMLInputElement;
        if (depthScaleInput) {
          depthScaleInput.addEventListener('input', () => this.updateSingleDefaultButtonState(i));
          // Prevent scroll wheel from changing value but allow page scrolling
          depthScaleInput.addEventListener('wheel', e => {
            (e.target as HTMLInputElement).blur();
          });
        }

        const depthBiasInput = document.getElementById(`depth-bias-${i}`) as HTMLInputElement;
        if (depthBiasInput) {
          depthBiasInput.addEventListener('input', () => this.updateSingleDefaultButtonState(i));
          // Prevent scroll wheel from changing value but allow page scrolling
          depthBiasInput.addEventListener('wheel', e => {
            (e.target as HTMLInputElement).blur();
          });
        }

        const pngScaleFactorInput = document.getElementById(
          `png-scale-factor-${i}`
        ) as HTMLInputElement;
        if (pngScaleFactorInput) {
          pngScaleFactorInput.addEventListener('input', () =>
            this.updateSingleDefaultButtonState(i)
          );
          // Prevent scroll wheel from changing value but allow page scrolling
          pngScaleFactorInput.addEventListener('wheel', e => {
            (e.target as HTMLInputElement).blur();
          });
        }

        const conventionSelect = document.getElementById(`convention-${i}`) as HTMLSelectElement;
        if (conventionSelect) {
          conventionSelect.addEventListener('change', () => this.updateSingleDefaultButtonState(i));
        }

        // Apply Deptn settings button
        const applyDepthBtn = document.querySelector(
          `.apply-depth-settings[data-file-index="${i}"]`
        );
        if (applyDepthBtn) {
          applyDepthBtn.addEventListener('click', async () => {
            await this.applyDepthSettings(i);
          });
        }

        // Use as Default settings button
        const useAsDefaultBtn = document.querySelector(
          `.use-as-default-settings[data-file-index="${i}"]`
        );
        if (useAsDefaultBtn) {
          useAsDefaultBtn.addEventListener('click', async () => {
            await this.useAsDefaultSettings(i);
          });
        }

        // Reset to Default settings button
        const resetToDefaultBtn = document.querySelector(
          `.reset-to-default-settings[data-file-index="${i}"]`
        );
        if (resetToDefaultBtn) {
          resetToDefaultBtn.addEventListener('click', async () => {
            await this.resetToDefaultSettings(i);
          });
        }

        // Save PLY file button
        const savePlyBtn = document.querySelector(`.save-ply-file[data-file-index="${i}"]`);
        if (savePlyBtn) {
          savePlyBtn.addEventListener('click', () => {
            this.savePlyFile(i);
          });
        }

        // Color image selection button
        const selectColorImageBtn = document.querySelector(
          `.select-color-image[data-file-index="${i}"]`
        );
        if (selectColorImageBtn) {
          selectColorImageBtn.addEventListener('click', () => {
            this.requestColorImageForDepth(i);
          });
        }

        // Remove color image button
        const removeColorBtn = document.querySelector(
          `.remove-color-image[data-file-index="${i}"]`
        );
        if (removeColorBtn) {
          removeColorBtn.addEventListener('click', async () => {
            await this.removeColorImageFromDepth(i);
          });
        }

        // Reset mono parameters button
        const resetMonoBtn = document.querySelector(`.reset-mono-params[data-file-index="${i}"]`);
        if (resetMonoBtn) {
          resetMonoBtn.addEventListener('click', () => {
            this.resetMonoParameters(i);
          });
        }

        // Reset disparity offset button
        const resetDisparityOffsetBtn = document.querySelector(
          `.reset-disparity-offset[data-file-index="${i}"]`
        );
        if (resetDisparityOffsetBtn) {
          resetDisparityOffsetBtn.addEventListener('click', () => {
            this.resetDisparityOffset(i);
          });
        }

        // Reset principle point button
        const resetPrinciplePointBtn = document.querySelector(
          `.reset-principle-point[data-file-index="${i}"]`
        );
        if (resetPrinciplePointBtn) {
          resetPrinciplePointBtn.addEventListener('click', () => {
            this.resetPrinciplePoint(i);
          });
        }
      }
    }

    // Add remove button listeners
    const removeButtons = fileListDiv.querySelectorAll(
      '.remove-file:not([data-listener-attached])'
    );
    removeButtons.forEach(button => {
      button.setAttribute('data-listener-attached', 'true');
      button.addEventListener('click', e => {
        const fileIndex = parseInt(
          (e.target as HTMLElement).getAttribute('data-file-index') || '0'
        );
        this.requestRemoveFile(fileIndex);
      });
    });

    // Add MTL button listeners for OBJ files
    const mtlButtons = fileListDiv.querySelectorAll('.load-mtl-btn:not([data-listener-attached])');
    mtlButtons.forEach(button => {
      button.setAttribute('data-listener-attached', 'true');
      button.addEventListener('click', e => {
        const fileIndex = parseInt(
          (e.target as HTMLElement).getAttribute('data-file-index') || '0'
        );
        this.requestLoadMtl(fileIndex);
      });
    });

    // Add universal render mode button listeners (solid, wireframe, points, normals)
    const renderModeButtons = fileListDiv.querySelectorAll(
      '.render-mode-btn:not([data-listener-attached])'
    );
    if (renderModeButtons.length > 0) {
      console.log(`Found ${renderModeButtons.length} render mode buttons to attach listeners to`);
      renderModeButtons.forEach(button => {
        button.setAttribute('data-listener-attached', 'true');
        button.addEventListener('click', e => {
          const target = e.target as HTMLElement;
          const fileIndex = parseInt(target.getAttribute('data-file-index') || '0');
          const mode = target.getAttribute('data-mode') || 'solid';
          console.log(`🔘 Render button clicked: fileIndex=${fileIndex}, mode=${mode}`);
          this.toggleUniversalRenderMode(fileIndex, mode);
        });
      });
    }

    // Add points/normals toggle button listeners
    const pointsToggleButtons = fileListDiv.querySelectorAll(
      '.points-toggle-btn:not([data-listener-attached])'
    );
    pointsToggleButtons.forEach(button => {
      button.setAttribute('data-listener-attached', 'true');
      button.addEventListener('click', e => {
        const target = e.target as HTMLElement;
        const fileIndex = parseInt(target.getAttribute('data-file-index') || '0');
        this.togglePointsVisibility(fileIndex);
        this.updatePointsNormalsButtonStates();
      });
    });

    const normalsToggleButtons = fileListDiv.querySelectorAll(
      '.normals-toggle-btn:not([data-listener-attached])'
    );
    normalsToggleButtons.forEach(button => {
      button.setAttribute('data-listener-attached', 'true');
      button.addEventListener('click', e => {
        const target = e.target as HTMLElement;

        // Ignore clicks on disabled buttons
        if (target.hasAttribute('disabled') || target.classList.contains('disabled')) {
          return;
        }

        const fileIndex = parseInt(target.getAttribute('data-file-index') || '0');
        this.toggleFileNormalsVisibility(fileIndex);
        this.updatePointsNormalsButtonStates();
      });
    });

    // Update button states after file list is refreshed
    this.updatePointsNormalsButtonStates();
    this.updateUniversalRenderButtonStates();
    this.updateDefaultButtonState();
  }

  private toggleFileVisibility(fileIndex: number): void {
    if (fileIndex < 0) {
      return;
    }
    // Determine desired visibility from checkbox state
    const checkboxEl = document.getElementById(`file-${fileIndex}`) as HTMLInputElement | null;
    const desiredVisible = checkboxEl
      ? !!checkboxEl.checked
      : !(this.fileVisibility[fileIndex] ?? true);
    this.fileVisibility[fileIndex] = desiredVisible;

    // If it's a mesh/pointcloud entry
    if (fileIndex < this.meshes.length && this.meshes[fileIndex]) {
      // Use the unified function to properly handle all visibility logic
      this.updateMeshVisibilityAndMaterial(fileIndex);

      // Also update normals visualizer visibility
      if (fileIndex < this.normalsVisualizers.length && this.normalsVisualizers[fileIndex]) {
        const normalsVisible = this.normalsVisible[fileIndex] ?? false;
        this.normalsVisualizers[fileIndex]!.visible = normalsVisible && desiredVisible;
      }

      return;
    }
    // Pose entries are appended after meshes
    const poseIndex = fileIndex - this.spatialFiles.length;
    if (poseIndex >= 0 && poseIndex < this.poseGroups.length) {
      const group = this.poseGroups[poseIndex];
      if (group) {
        group.visible = desiredVisible;
      }
      const labels = this.poseLabelsGroups[poseIndex];
      if (labels) {
        labels.visible = desiredVisible;
      }
      return;
    }

    // Camera entries are appended after poses
    const cameraIndex = fileIndex - this.spatialFiles.length - this.poseGroups.length;
    if (cameraIndex >= 0 && cameraIndex < this.cameraGroups.length) {
      const group = this.cameraGroups[cameraIndex];
      if (group) {
        group.visible = desiredVisible;
      }
    }
  }

  /**
   * Universal render mode toggle for all file types
   * Handles solid, wireframe, points, and normals rendering modes
   */
  private toggleUniversalRenderMode(fileIndex: number, mode: string): void {
    renderModeToggles.toggleUniversalRenderMode(this, fileIndex, mode);
  }

  private toggleSolidRendering(fileIndex: number): void {
    renderModeToggles.toggleSolidRendering(this, fileIndex);
  }

  private toggleWireframeRendering(fileIndex: number): void {
    renderModeToggles.toggleWireframeRendering(this, fileIndex);
  }

  private togglePointsRendering(fileIndex: number): void {
    renderModeToggles.togglePointsRendering(this, fileIndex);
  }

  private updateMeshVisibilityAndMaterial(fileIndex: number): void {
    renderModeToggles.updateMeshVisibilityAndMaterial(this, fileIndex);
  }

  private updateVertexPointsVisualization(
    fileIndex: number,
    pointsVisible: boolean,
    solidVisible: boolean,
    wireframeVisible: boolean,
    fileVisible: boolean
  ): void {
    renderModeToggles.updateVertexPointsVisualization(
      this,
      fileIndex,
      pointsVisible,
      solidVisible,
      wireframeVisible,
      fileVisible
    );
  }

  private createVertexPointsFromMesh(mesh: THREE.Object3D, fileIndex: number): THREE.Points | null {
    return renderModeToggles.createVertexPointsFromMesh(this, mesh, fileIndex);
  }

  private updateMultiMaterialPointsVisualization(
    fileIndex: number,
    pointsVisible: boolean,
    fileVisible: boolean
  ): void {
    renderModeToggles.updateMultiMaterialPointsVisualization(
      this,
      fileIndex,
      pointsVisible,
      fileVisible
    );
  }

  private toggleNormalsRendering(fileIndex: number): void {
    renderModeToggles.toggleNormalsRendering(this, fileIndex);
  }

  private updateUniversalRenderButtonStates(): void {
    renderModeToggles.updateUniversalRenderButtonStates(this);
  }

  showImmediateLoading(message: any): void {
    const fileName = message.fileName;
    const uiStartTime = performance.now();
    console.log(`Load: UI start ${fileName} at ${uiStartTime.toFixed(1)}ms`);

    this.isFileLoading = true;
    this.updateWelcomeMessageVisibility();

    // Store timing for complete analysis
    (window as any).loadingStartTime = uiStartTime;
    (window as any).absoluteStartTime = uiStartTime;

    // Additional load into an existing scene: don't cover the cloud with a
    // blocking spinner — the user can keep looking at / interacting with the
    // current clouds. Show progress as a row in the Files list instead.
    if (this.spatialFiles.length > 0) {
      this.pendingLoadLabel = fileName;
      this.pendingLoadDetail = 'Reading file…';
      document.getElementById('loading')?.classList.add('hidden');
      this.updateFileList();
      return;
    }

    // First/empty load: nothing to interact with yet, so a centered spinner is
    // appropriate. Show the real filename + a live phase line.
    const loadingEl = document.getElementById('loading');
    if (loadingEl) {
      loadingEl.classList.remove('hidden');
      loadingEl.innerHTML = `
                <div class="spinner"></div>
                <p>Loading ${fileName}…</p>
                <p class="loading-detail">Reading file…</p>
            `;
    }

    // Show the main UI elements immediately (before file loads)
    const infoPanelEl = document.getElementById('info-panel');
    if (infoPanelEl) {
      infoPanelEl.style.visibility = 'visible';
    }

    const viewerContainerEl = document.getElementById('viewer-container');
    if (viewerContainerEl) {
      viewerContainerEl.style.visibility = 'visible';
    }

    // Keep the Files tab active for all files (depth controls are in Files tab)

    // Update file stats with placeholder
    this.updateFileStatsImmediate(fileName);
  }

  /**
   * Update the live phase line during a load — the centered spinner's detail for
   * a first load, or the in-progress Files-list row for an additional load.
   */
  private setLoadingDetail(text: string): void {
    if (!this.isFileLoading) {
      return;
    }
    if (this.pendingLoadLabel !== null) {
      this.pendingLoadDetail = text;
      const detailEl = document.getElementById('pending-load-detail');
      if (detailEl) {
        detailEl.textContent = text;
      }
      return;
    }
    const detailEl = document.querySelector('#loading .loading-detail');
    if (detailEl) {
      detailEl.textContent = text;
    }
  }

  private updateFileStatsImmediate(fileName: string): void {
    const statsEl = document.getElementById('file-stats');
    if (statsEl) {
      statsEl.innerHTML = `
                <div class="stat">
                    <span class="label">File:</span>
                    <span class="value">${fileName}</span>
                </div>
                <div class="stat">
                    <span class="label">Status:</span>
                    <span class="value">Loading...</span>
                </div>
            `;
    }
  }

  showError(message: string): void {
    uiStatus.showError(message);
  }

  private clearError(): void {
    uiStatus.clearError();
  }

  // File management methods
  private requestAddFile(): void {
    this.vscode.postMessage({
      type: 'addFile',
    });
  }

  private requestRemoveFile(fileIndex: number): void {
    this.vscode.postMessage({
      type: 'removeFile',
      fileIndex: fileIndex,
    });
  }

  private requestLoadMtl(fileIndex: number): void {
    this.vscode.postMessage({
      type: 'loadMtl',
      fileIndex: fileIndex,
    });
  }

  private requestColorImageForDepth(fileIndex: number): void {
    colorImageForDepth.requestColorImageForDepth(this, fileIndex);
  }

  addNewFiles(newFiles: SpatialData[]): void {
    // Phase feedback: the bytes are here, now we build GPU geometry.
    if (this.isFileLoading && newFiles.length > 0) {
      const pts = newFiles.reduce((s, f) => s + (f.vertexCount || 0), 0);
      this.setLoadingDetail(
        pts > 0 ? `Building geometry (${pts.toLocaleString()} points)…` : 'Building geometry…'
      );
    }
    for (const data of newFiles) {
      // Assign new file index
      data.fileIndex = this.spatialFiles.length;

      // Add to data array
      this.spatialFiles.push(data);

      // Update welcome message visibility
      this.updateWelcomeMessageVisibility();

      // Initialize visibility states based on file type
      const isObjFile = (data as any).isObjFile;
      const objData = (data as any).objData;
      const isMultiMaterial =
        isObjFile && objData && objData.materialGroups && objData.materialGroups.length > 1;

      if (data.faceCount > 0) {
        // Mesh file (STL, PLY with faces, OBJ)
        this.solidVisible.push(true);

        if (isMultiMaterial) {
          // Multi-material OBJ - points represent distinct geometric elements
          this.pointsVisible.push(true); // Show points by default
        } else {
          // Single-material mesh - points are just mesh vertices
          this.pointsVisible.push(false); // Don't show mesh vertices as points
        }
      } else {
        // Point cloud file (PLY, XYZ, PTS) - show points only
        this.solidVisible.push(false); // No mesh surface exists
        this.pointsVisible.push(true); // Show actual point data
      }

      // Wireframe and normals always start disabled
      this.wireframeVisible.push(false);
      this.normalsVisible.push(false);

      // Initialize vertex points object (null initially, created on demand)
      this.vertexPointsObjects.push(null);

      // Initialize color mode before creating material
      // Ensure the individualColorModes array is large enough for this file's index
      // (it might have camera/pose entries that extend beyond spatialFiles)
      const initialColorMode =
        this.useOriginalColors && data.hasColors
          ? 'original'
          : this.hasIntensityData(data)
            ? 'intensity'
            : 'assigned';
      while (this.individualColorModes.length <= data.fileIndex) {
        this.individualColorModes.push('assigned'); // Placeholder for non-existent files
      }
      this.individualColorModes[data.fileIndex] = initialColorMode;
      console.log(
        `🎨 addNewFiles - fileIndex: ${data.fileIndex}, hasColors: ${data.hasColors}, colorMode: ${initialColorMode}, useOriginalColors: ${this.useOriginalColors}`
      );

      // Ensure pointSizes array is large enough and set correct default for this PLY
      while (this.pointSizes.length <= data.fileIndex) {
        this.pointSizes.push(0.001); // Placeholder for non-existent files
      }
      // IMPORTANT: Always set PLY file point size to 0.001, overwriting any placeholder values
      this.pointSizes[data.fileIndex] = 0.001;
      // debug

      // Create geometry and material
      // Use data.fileIndex which is the spatialFiles array index
      const geometry = this.createGeometryFromSpatialData(data);
      const material = this.createMaterialForFile(data, data.fileIndex);

      // Check if this is an OBJ file and handle different rendering modes
      const isObjFile2 = (data as any).isObjFile;
      const objRenderType = (data as any).objRenderType;

      if (isObjFile2) {
        if (objRenderType === 'wireframe' && (data as any).objLines) {
          // Create wireframe using LineSegments
          const lines = (data as any).objLines;
          const linePositions = new Float32Array(lines.length * 6); // 2 vertices per line, 3 coords per vertex

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const startVertex = data.vertices[line.start];
            const endVertex = data.vertices[line.end];

            const i6 = i * 6;
            linePositions[i6] = startVertex.x;
            linePositions[i6 + 1] = startVertex.y;
            linePositions[i6 + 2] = startVertex.z;
            linePositions[i6 + 3] = endVertex.x;
            linePositions[i6 + 4] = endVertex.y;
            linePositions[i6 + 5] = endVertex.z;
          }

          const lineGeometry = new THREE.BufferGeometry();
          lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));

          const lineMaterial = new THREE.LineBasicMaterial({
            color: 0xff0000, // Red wireframe
          });

          const wireframeMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
          (wireframeMesh as any).isLineSegments = true;
          this.scene.add(wireframeMesh);
          this.meshes.push(wireframeMesh);
          this.requestRender();
        } else if (objRenderType === 'mesh' && data.faceCount > 0) {
          // Create multi-material mesh(es)
          const objData = (data as any).objData;

          if (objData && objData.materialGroups && objData.materialGroups.length > 1) {
            // Multi-material rendering: create separate mesh for each material group
            const subMeshes: THREE.Object3D[] = [];
            const meshGroup = new THREE.Group();

            for (const materialGroup of objData.materialGroups) {
              if (materialGroup.faces.length > 0) {
                // Create geometry for this material group
                const groupGeometry = new THREE.BufferGeometry();

                // Collect vertices for faces in this group
                const faceVertices: number[] = [];
                const faceIndices: number[] = [];
                let vertexOffset = 0;

                for (const face of materialGroup.faces) {
                  if (face.indices.length >= 3) {
                    // Add vertices for this face
                    for (const vertexIndex of face.indices) {
                      const vertex = data.vertices[vertexIndex];
                      faceVertices.push(vertex.x, vertex.y, vertex.z);
                    }

                    // Triangulate face (fan triangulation)
                    for (let i = 1; i < face.indices.length - 1; i++) {
                      faceIndices.push(vertexOffset);
                      faceIndices.push(vertexOffset + i);
                      faceIndices.push(vertexOffset + i + 1);
                    }

                    vertexOffset += face.indices.length;
                  }
                }

                if (faceVertices.length > 0) {
                  groupGeometry.setAttribute(
                    'position',
                    new THREE.BufferAttribute(new Float32Array(faceVertices), 3)
                  );
                  groupGeometry.setIndex(faceIndices);
                  groupGeometry.computeVertexNormals();

                  const groupMaterial = new THREE.MeshBasicMaterial({
                    color: 0x808080, // Default gray - will be colored by MTL
                    side: THREE.DoubleSide,
                  });

                  const groupMesh = new THREE.Mesh(groupGeometry, groupMaterial);
                  (groupMesh as any).materialName = materialGroup.material;
                  (groupMesh as any).isObjMesh = true;

                  meshGroup.add(groupMesh);
                  subMeshes.push(groupMesh);
                }
              }

              // Handle lines in this material group
              if (materialGroup.lines.length > 0) {
                const linePositions = new Float32Array(materialGroup.lines.length * 6);

                for (let i = 0; i < materialGroup.lines.length; i++) {
                  const line = materialGroup.lines[i];
                  const startVertex = data.vertices[line.start];
                  const endVertex = data.vertices[line.end];

                  const i6 = i * 6;
                  linePositions[i6] = startVertex.x;
                  linePositions[i6 + 1] = startVertex.y;
                  linePositions[i6 + 2] = startVertex.z;
                  linePositions[i6 + 3] = endVertex.x;
                  linePositions[i6 + 4] = endVertex.y;
                  linePositions[i6 + 5] = endVertex.z;
                }

                const lineGeometry = new THREE.BufferGeometry();
                lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));

                const lineMaterial = new THREE.LineBasicMaterial({
                  color: 0xff0000, // Default red - will be colored by MTL
                });

                const lineSegments = new THREE.LineSegments(lineGeometry, lineMaterial);
                (lineSegments as any).materialName = materialGroup.material;
                (lineSegments as any).isLineSegments = true;

                meshGroup.add(lineSegments);
                subMeshes.push(lineSegments);
              }

              // Handle points in this material group
              if (materialGroup.points.length > 0) {
                const pointPositions = new Float32Array(materialGroup.points.length * 3);

                for (let i = 0; i < materialGroup.points.length; i++) {
                  const point = materialGroup.points[i];
                  const vertex = data.vertices[point.index];

                  const i3 = i * 3;
                  pointPositions[i3] = vertex.x;
                  pointPositions[i3 + 1] = vertex.y;
                  pointPositions[i3 + 2] = vertex.z;
                }

                const pointGeometry = new THREE.BufferGeometry();
                pointGeometry.setAttribute(
                  'position',
                  new THREE.BufferAttribute(pointPositions, 3)
                );

                const pointMaterial = new THREE.PointsMaterial({
                  color: 0xff0000, // Default red - will be colored by MTL
                  size: this.pointSizes[data.fileIndex] || 0.001, // Use stored point size (world units)
                  sizeAttenuation: true, // Use world-space sizing like other file types
                  // Apply transparency settings
                  transparent: this.allowTransparency,
                  alphaTest: this.allowTransparency ? 0.1 : 0,
                  opacity: 1.0,
                  depthWrite: true,
                  depthTest: true,
                  side: THREE.DoubleSide,
                });

                const points = new THREE.Points(pointGeometry, pointMaterial);
                (points as any).materialName = materialGroup.material;
                (points as any).isPoints = true;

                meshGroup.add(points);
                subMeshes.push(points);
              }
            }

            (meshGroup as any).isObjMesh = true;
            (meshGroup as any).isMultiMaterial = true;
            this.scene.add(meshGroup);
            this.multiMaterialGroups[data.fileIndex!] = meshGroup;
            this.materialMeshes[data.fileIndex!] = subMeshes;

            console.log(`Created multi-material OBJ with ${subMeshes.length} sub-meshes`);
          } else {
            // Single material or fallback to original logic
            const meshMaterial = new THREE.MeshBasicMaterial({
              color: 0x808080,
              side: THREE.DoubleSide,
              vertexColors: data.hasColors,
            });

            if (objData && objData.hasNormals && objData.normals.length > 0) {
              const normals = new Float32Array(data.vertexCount * 3);
              for (let i = 0; i < data.vertexCount && i < objData.normals.length; i++) {
                const normal = objData.normals[i];
                normals[i * 3] = normal.nx;
                normals[i * 3 + 1] = normal.ny;
                normals[i * 3 + 2] = normal.nz;
              }
              geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
            }

            const mesh = new THREE.Mesh(geometry, meshMaterial);
            (mesh as any).isObjMesh = true;
            this.scene.add(mesh);
            this.meshes.push(mesh);
            this.requestRender();
            // this.requestRender();
          }
        } else {
          // Fallback to points - use optimized creation
          const mesh = this.createOptimizedPointCloud(geometry, material as THREE.PointsMaterial);
          this.scene.add(mesh);
          this.meshes.push(mesh);
          this.requestRender();
        }
      } else {
        // Handle legacy OBJ wireframe format and regular PLY files
        const isObjWireframe = (data as any).isObjWireframe;

        if (isObjWireframe && (data as any).objLines) {
          // Legacy wireframe handling
          const lines = (data as any).objLines;
          const linePositions = new Float32Array(lines.length * 6);

          for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const startVertex = data.vertices[line.start];
            const endVertex = data.vertices[line.end];

            const i6 = i * 6;
            linePositions[i6] = startVertex.x;
            linePositions[i6 + 1] = startVertex.y;
            linePositions[i6 + 2] = startVertex.z;
            linePositions[i6 + 3] = endVertex.x;
            linePositions[i6 + 4] = endVertex.y;
            linePositions[i6 + 5] = endVertex.z;
          }

          const lineGeometry = new THREE.BufferGeometry();
          lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));

          const lineMaterial = new THREE.LineBasicMaterial({
            color: 0xff0000,
          });

          const wireframeMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
          (wireframeMesh as any).isLineSegments = true;
          this.scene.add(wireframeMesh);
          this.meshes.push(wireframeMesh);
          this.requestRender();
        } else {
          // Create regular mesh for PLY files
          const shouldShowAsPoints = data.faceCount === 0;
          const mesh = shouldShowAsPoints
            ? this.createOptimizedPointCloud(geometry, material as THREE.PointsMaterial)
            : new THREE.Mesh(geometry, material);

          this.scene.add(mesh);
          this.meshes.push(mesh);
          this.requestRender();
        }
      }
      // If sequence mode is active, only the current frame stays visible to avoid overloading the scene
      const isSeqMode = this.sequenceFiles.length > 0;
      const shouldBeVisible = !isSeqMode || data.fileIndex === this.sequenceIndex;
      this.fileVisibility.push(shouldBeVisible);
      const lastObject = this.meshes[this.meshes.length - 1];
      if (lastObject) {
        lastObject.visible = shouldBeVisible;
      }
      const isObjFile3 = (data as any).isObjFile;
      // Universal default point size for all file types (now that all use world-space sizing)
      // Note: pointSizes array is pre-allocated in the material creation step above
      if (this.pointSizes.length <= data.fileIndex) {
        this.pointSizes.push(0.001);
      }
      this.appliedMtlColors.push(null); // No MTL color applied initially
      this.appliedMtlNames.push(null); // No MTL material applied initially
      this.appliedMtlData.push(null); // No MTL data applied initially
      this.multiMaterialGroups.push(null); // No multi-material group initially
      this.materialMeshes.push(null); // No sub-meshes initially

      // Initialize transformation matrix for this file
      this.transformationMatrices.push(new THREE.Matrix4());
    }

    // Update UI (preserve depth panel states)
    const openPanelStates = this.captureDepthPanelStates();
    this.updateFileList();
    this.restoreDepthPanelStates(openPanelStates);
    this.updateFileStats();
    this.showLoading(false);

    // debug
  }

  removeFileByIndex(fileIndex: number): void {
    if (fileIndex < 0) {
      return;
    }

    // Determine if this index refers to a camera profile, pose, or pointcloud/mesh
    const cameraStartIndex = this.spatialFiles.length + this.poseGroups.length;

    if (fileIndex >= cameraStartIndex) {
      // Camera profile removal
      const cameraIndex = fileIndex - cameraStartIndex;
      if (cameraIndex < 0 || cameraIndex >= this.cameraGroups.length) {
        return;
      }

      const group = this.cameraGroups[cameraIndex];
      this.scene.remove(group);
      group.traverse((obj: any) => {
        if (obj.geometry && typeof obj.geometry.dispose === 'function') {
          obj.geometry.dispose();
        }
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m: any) => m.dispose && m.dispose());
          } else if (typeof obj.material.dispose === 'function') {
            obj.material.dispose();
          }
        }
      });
      this.cameraGroups.splice(cameraIndex, 1);
      this.cameraNames.splice(cameraIndex, 1);
      this.cameraShowLabels.splice(cameraIndex, 1);
      this.cameraShowCoords.splice(cameraIndex, 1);

      // Remove UI-aligned state for this unified index
      this.fileVisibility.splice(fileIndex, 1);
      this.pointSizes.splice(fileIndex, 1);
      if (this.individualColorModes[fileIndex] !== undefined) {
        this.individualColorModes.splice(fileIndex, 1);
      }
      this.transformationMatrices.splice(fileIndex, 1);

      // Preserve depth panel states when removing files
      const openPanelStates = this.captureDepthPanelStates();
      this.updateFileList();
      this.restoreDepthPanelStates(openPanelStates);
      this.updateFileStats();
      return;
    }

    if (fileIndex >= this.spatialFiles.length) {
      // Pose removal
      const poseIndex = fileIndex - this.spatialFiles.length;
      if (poseIndex < 0 || poseIndex >= this.poseGroups.length) {
        return;
      }

      const group = this.poseGroups[poseIndex];
      this.scene.remove(group);
      group.traverse((obj: any) => {
        if (obj.geometry && typeof obj.geometry.dispose === 'function') {
          obj.geometry.dispose();
        }
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m: any) => m.dispose && m.dispose());
          } else if (typeof obj.material.dispose === 'function') {
            obj.material.dispose();
          }
        }
      });
      this.poseGroups.splice(poseIndex, 1);
      this.poseMeta.splice(poseIndex, 1);
      // Remove UI-aligned state for this unified index
      this.fileVisibility.splice(fileIndex, 1);
      this.pointSizes.splice(fileIndex, 1);
      if (this.individualColorModes[fileIndex] !== undefined) {
        this.individualColorModes.splice(fileIndex, 1);
      }
      // Preserve depth panel states when removing files
      const openPanelStates = this.captureDepthPanelStates();
      this.updateFileList();
      this.restoreDepthPanelStates(openPanelStates);
      this.updateFileStats();
      return;
    }

    // Remove mesh from scene
    const mesh = this.meshes[fileIndex];
    this.scene.remove(mesh);
    if (mesh.geometry) {
      mesh.geometry.dispose();
    }
    if (mesh.material) {
      if (Array.isArray(mesh.material)) {
        mesh.material.forEach(mat => mat.dispose());
      } else {
        mesh.material.dispose();
      }
    }

    // Remove normals visualizer from scene and dispose
    const normalsVisualizer = this.normalsVisualizers[fileIndex];
    if (normalsVisualizer) {
      this.scene.remove(normalsVisualizer);
      if (normalsVisualizer.geometry) {
        normalsVisualizer.geometry.dispose();
      }
      if (normalsVisualizer.material) {
        if (Array.isArray(normalsVisualizer.material)) {
          normalsVisualizer.material.forEach(mat => mat.dispose());
        } else {
          normalsVisualizer.material.dispose();
        }
      }
    }

    // Remove vertex points object from scene and dispose
    const vertexPoints = this.vertexPointsObjects[fileIndex];
    if (vertexPoints) {
      this.scene.remove(vertexPoints);
      if (vertexPoints.geometry) {
        vertexPoints.geometry.dispose();
      }
      if (vertexPoints.material) {
        if (Array.isArray(vertexPoints.material)) {
          vertexPoints.material.forEach(mat => mat.dispose());
        } else {
          vertexPoints.material.dispose();
        }
      }
    }

    // Remove multi-material group from scene and dispose
    const multiMaterialGroup = this.multiMaterialGroups[fileIndex];
    if (multiMaterialGroup) {
      this.scene.remove(multiMaterialGroup);
      multiMaterialGroup.traverse((obj: any) => {
        if (obj.geometry && typeof obj.geometry.dispose === 'function') {
          obj.geometry.dispose();
        }
        if (obj.material) {
          if (Array.isArray(obj.material)) {
            obj.material.forEach((m: any) => m.dispose && m.dispose());
          } else if (typeof obj.material.dispose === 'function') {
            obj.material.dispose();
          }
        }
      });
    }

    // Remove from arrays
    this.spatialFiles.splice(fileIndex, 1);
    this.meshes.splice(fileIndex, 1);
    this.normalsVisualizers.splice(fileIndex, 1); // Remove normals visualizer for this file
    this.vertexPointsObjects.splice(fileIndex, 1); // Remove vertex points object for this file
    this.multiMaterialGroups.splice(fileIndex, 1); // Remove multi-material group for this file
    this.materialMeshes.splice(fileIndex, 1); // Remove sub-meshes for this file
    this.fileVisibility.splice(fileIndex, 1);
    this.pointSizes.splice(fileIndex, 1); // Remove point size for this file
    this.individualColorModes.splice(fileIndex, 1); // Remove color mode for this file
    this.appliedMtlColors.splice(fileIndex, 1); // Remove MTL color for this file
    this.appliedMtlNames.splice(fileIndex, 1); // Remove MTL name for this file
    this.appliedMtlData.splice(fileIndex, 1); // Remove MTL data for this file

    // Remove rendering mode states for this file
    this.solidVisible.splice(fileIndex, 1);
    this.wireframeVisible.splice(fileIndex, 1);
    this.pointsVisible.splice(fileIndex, 1);
    this.normalsVisible.splice(fileIndex, 1);

    // Remove transformation matrix for this file
    this.transformationMatrices.splice(fileIndex, 1);

    // Remove Depth data if it exists for this file
    this.fileDepthData.delete(fileIndex);

    // Update Depth data indices for remaining files (shift down)
    const newdepthData = new Map<number, any>();
    for (const [key, value] of this.fileDepthData) {
      if (key > fileIndex) {
        newdepthData.set(key - 1, value);
      } else if (key < fileIndex) {
        newdepthData.set(key, value);
      }
    }
    this.fileDepthData = newdepthData;

    const shiftLiveDepthSet = (source: Set<number>): Set<number> => {
      const next = new Set<number>();
      for (const key of source) {
        if (key > fileIndex) {
          next.add(key - 1);
        } else if (key < fileIndex) {
          next.add(key);
        }
      }
      return next;
    };

    const removedTimer = this.liveDepthUpdateTimers.get(fileIndex);
    if (removedTimer !== undefined) {
      window.clearTimeout(removedTimer);
    }
    const shiftedTimers = new Map<number, number>();
    for (const [key, timer] of this.liveDepthUpdateTimers) {
      if (key > fileIndex) {
        shiftedTimers.set(key - 1, timer);
      } else if (key < fileIndex) {
        shiftedTimers.set(key, timer);
      }
    }
    this.liveDepthUpdateTimers = shiftedTimers;
    this.liveDepthUpdateFiles = shiftLiveDepthSet(this.liveDepthUpdateFiles);
    this.liveDepthUpdateInFlight = shiftLiveDepthSet(this.liveDepthUpdateInFlight);
    this.liveDepthUpdateQueued = shiftLiveDepthSet(this.liveDepthUpdateQueued);
    const shiftedVersions = new Map<number, number>();
    for (const [key, version] of this.liveDepthUpdateVersions) {
      if (key > fileIndex) {
        shiftedVersions.set(key - 1, version);
      } else if (key < fileIndex) {
        shiftedVersions.set(key, version);
      }
    }
    this.liveDepthUpdateVersions = shiftedVersions;

    // Reassign file indices
    for (let i = 0; i < this.spatialFiles.length; i++) {
      this.spatialFiles[i].fileIndex = i;
    }

    // Update UI (preserve depth panel states)
    const openPanelStates = this.captureDepthPanelStates();
    this.updateFileList();
    this.restoreDepthPanelStates(openPanelStates);
    this.updateFileStats();
    this.updateWelcomeMessageVisibility();

    // If all scene objects are gone, allow first-load auto-fit for the next import.
    if (
      this.spatialFiles.length === 0 &&
      this.poseGroups.length === 0 &&
      this.cameraGroups.length === 0
    ) {
      this.isFirstFileLoad = true;
    }

    // Request render to update the display after removing objects
    this.requestRender();
  }

  /**
   * Generic timing wrapper for format handlers that don't self-report detailed
   * phases (OBJ, STL, PCD, PTS, OFF, GLTF, NPY, XYZ, ...). Captures the
   * cross-process transfer cost plus the handler (parse + geometry + display)
   * as a single comparable PERF line. Errors propagate; the summary still
   * fires via finally so failed loads are still timed.
   */
  private async loadWithPerf(
    kind: string,
    message: any,
    fn: () => void | Promise<void>
  ): Promise<void> {
    await binaryDataHandlers.loadWithPerf(kind, message, fn);
  }

  /**
   * Transfer-via-fetch entry: instead of receiving the vertex buffer over
   * postMessage (a multi-hundred-ms structured clone for large clouds), fetch
   * the file directly from its webview URI, slice out the vertex bytes, and
   * hand off to the normal parser. On any fetch failure, ask the extension to
   * resend over postMessage (the proven path) so loading never breaks.
   */
  private async handleUltimateRawBinaryUri(message: any): Promise<void> {
    await binaryDataHandlers.handleUltimateRawBinaryUri(this, message);
  }

  async handleUltimateRawBinaryData(message: any): Promise<void> {
    await binaryDataHandlers.handleUltimateRawBinaryData(this, message);
  }

  private async handleDirectTypedArrayData(message: any): Promise<void> {
    await binaryDataHandlers.handleDirectTypedArrayData(this, message);
  }

  private async handleBinarySpatialData(message: any): Promise<void> {
    await binaryDataHandlers.handleBinarySpatialData(this, message);
  }

  private handleStartLargeFile(message: any): void {
    largeFileChunking.handleStartLargeFile(this, message);
  }

  private handleLargeFileChunk(message: any): void {
    largeFileChunking.handleLargeFileChunk(this, message);
  }

  private async handleLargeFileComplete(message: any): Promise<void> {
    await largeFileChunking.handleLargeFileComplete(this, message);
  }

  private updatePointSize(fileIndex: number, newSize: number): void {
    pointSizeScaling.updatePointSize(this, fileIndex, newSize);
  }

  private getColorName(fileIndex: number): string {
    return colorModeUtils.getColorName(fileIndex);
  }

  private getColorOptions(fileIndex: number): string {
    return colorModeUtils.getColorOptions(this, fileIndex);
  }

  // ===== Pose feature updaters =====
  private updatePoseAppearance(fileIndex: number): void {
    pose.updatePoseAppearance(this, fileIndex);
  }

  private updatePoseLabels(fileIndex: number): void {
    pose.updatePoseLabels(this, fileIndex);
  }

  private updatePoseScaling(fileIndex: number): void {
    pose.updatePoseScaling(this, fileIndex);
  }

  private applyPoseConvention(fileIndex: number, conv: 'opengl' | 'opencv'): void {
    pose.applyPoseConvention(this, fileIndex, conv);
  }

  private applyPoseFilters(fileIndex: number): void {
    pose.applyPoseFilters(this, fileIndex);
  }

  private soloPointCloud(fileIndex: number): void {
    // Hide all objects (point clouds and poses)
    const totalEntries = this.spatialFiles.length + this.poseGroups.length;
    for (let i = 0; i < totalEntries; i++) {
      this.fileVisibility[i] = false;
      if (i < this.meshes.length) {
        const obj = this.meshes[i];
        if (obj) {
          obj.visible = false;
        }
      } else {
        const poseIndex = i - this.spatialFiles.length;
        const group = this.poseGroups[poseIndex];
        if (group) {
          group.visible = false;
        }
      }
    }
    // Show only the selected entry
    this.fileVisibility[fileIndex] = true;
    if (fileIndex < this.meshes.length) {
      const obj = this.meshes[fileIndex];
      if (obj) {
        obj.visible = true;
      }
    } else {
      const poseIndex = fileIndex - this.spatialFiles.length;
      const group = this.poseGroups[poseIndex];
      if (group) {
        group.visible = true;
      }
    }
    // Update UI
    this.updateFileList();
    // Request render to show visibility changes
    this.requestRender();
  }

  private switchToTrackballControls(): void {
    controlSchemeSwitcher.switchToTrackballControls(this);
  }

  private switchToOrbitControls(): void {
    controlSchemeSwitcher.switchToOrbitControls(this);
  }

  private switchToInverseTrackballControls(): void {
    controlSchemeSwitcher.switchToInverseTrackballControls(this);
  }

  private switchToArcballControls(): void {
    controlSchemeSwitcher.switchToArcballControls(this);
  }

  // Removed CloudCompare button/shortcut per user request; turntable impl remains unused

  updateControlStatus(): void {
    controlSchemeSwitcher.updateControlStatus(this);
  }

  private setOpenCVCameraConvention(): void {
    cameraConvention.setOpenCVCameraConvention(this);
  }

  private setOpenGLCameraConvention(): void {
    cameraConvention.setOpenGLCameraConvention(this);
  }

  updateAxesForCameraConvention(convention: 'opencv' | 'opengl'): void {
    cameraConvention.updateAxesForCameraConvention(this, convention);
  }

  showCameraConventionFeedback(convention: string): void {
    cameraConvention.showCameraConventionFeedback(this, convention);
  }

  private showTranslationDialog(fileIndex: number): void {
    transformDialogs.showTranslationDialog(this, fileIndex);
  }

  private showQuaternionDialog(fileIndex: number): void {
    transformDialogs.showQuaternionDialog(this, fileIndex);
  }

  private showAngleAxisDialog(fileIndex: number): void {
    transformDialogs.showAngleAxisDialog(this, fileIndex);
  }

  private showCameraPositionDialog(): void {
    transformDialogs.showCameraPositionDialog(this);
  }

  private showCameraRotationDialog(): void {
    transformDialogs.showCameraRotationDialog(this);
  }

  private showRotationCenterDialog(): void {
    transformDialogs.showRotationCenterDialog(this);
  }

  private openCalibrationFileDialog(fileIndex: number): void {
    calibrationForm.openCalibrationFileDialog(this, fileIndex);
  }

  private async loadCalibrationFile(file: File, fileIndex: number): Promise<void> {
    await calibrationForm.loadCalibrationFile(this, file, fileIndex);
  }

  displayCalibrationInfo(calibrationData: any, fileName: string, fileIndex: number): void {
    calibrationForm.displayCalibrationInfo(this, calibrationData, fileName, fileIndex);
  }

  private onCameraSelectionChange(fileIndex: number, selectedCamera: string): void {
    calibrationForm.onCameraSelectionChange(this, fileIndex, selectedCamera);
  }

  private handleCalibrationFileSelected(message: any): void {
    calibrationForm.handleCalibrationFileSelected(this, message);
  }

  private populateFormFromCalibration(cameraData: any, fileIndex: number): void {
    calibrationForm.populateFormFromCalibration(this, cameraData, fileIndex);
  }

  async handleDepthData(message: any): Promise<void> {
    await depthConversionPipeline.handleDepthData(this, message);
  }

  /**
   * Show depth conversion UI for local parameter collection
   */
  private async showDepthConversionUI(fileName: string, requestId: string): Promise<void> {
    await depthConversionPipeline.showDepthConversionUI(this, fileName, requestId);
  }

  /**
   * Process depth data using default camera parameters
   */
  private async processDepthWithDefaults(
    fileName: string,
    data: ArrayBuffer,
    requestId: string
  ): Promise<void> {
    await depthConversionPipeline.processDepthWithDefaults(this, fileName, data, requestId);
  }

  async processDepthWithParams(requestId: string, cameraParams: CameraParams): Promise<void> {
    await depthConversionPipeline.processDepthWithParams(this, requestId, cameraParams);
  }

  async processDepthToPointCloud(
    depthData: ArrayBuffer,
    fileName: string,
    cameraParams: CameraParams,
    colorImageData?: ImageData
  ): Promise<DepthConversionResult> {
    return this.depthWorkerClient.processDepthToPointCloud(
      depthData,
      fileName,
      cameraParams,
      colorImageData
    );
  }

  async handleObjData(message: any): Promise<void> {
    await formatDataHandlers.handleObjData(this, message);
  }

  async handleStlData(message: any): Promise<void> {
    await formatDataHandlers.handleStlData(this, message);
  }

  async handleXyzData(message: any): Promise<void> {
    await formatDataHandlers.handleXyzData(this, message);
  }

  async handleCameraParams(message: any): Promise<void> {
    await depthCameraParamsPrompt.handleCameraParams(this, message);
  }

  private saveCameraParams(params: CameraParams): void {
    depthCameraParamsPrompt.saveCameraParams(params);
  }

  private handleCameraParamsCancelled(requestId?: string): void {
    depthCameraParamsPrompt.handleCameraParamsCancelled(this, requestId);
  }

  private handleCameraParamsError(error: string, requestId?: string): void {
    depthCameraParamsPrompt.handleCameraParamsError(this, error, requestId);
  }

  private handleSaveSpatialFileResult(message: any): void {
    if (message.success) {
      this.showStatus(`PLY file saved successfully: ${message.filePath}`);
      console.log(`✅ PLY file saved: ${message.filePath}`);
    } else {
      if (message.cancelled) {
        this.showStatus('Save operation cancelled by user');
      } else {
        this.showError(`Failed to save PLY file: ${message.error || 'Unknown error'}`);
        console.error('PLY save error:', message.error);
      }
    }
  }

  private async handlePcdData(message: any): Promise<void> {
    await formatDataHandlers.handlePcdData(this, message);
  }

  private async handleNpyData(message: any): Promise<void> {
    await formatDataHandlers.handleNpyData(this, message);
  }

  private async handlePtsData(message: any): Promise<void> {
    await formatDataHandlers.handlePtsData(this, message);
  }

  private async handleOffData(message: any): Promise<void> {
    await formatDataHandlers.handleOffData(this, message);
  }

  private async handleGltfData(message: any): Promise<void> {
    await formatDataHandlers.handleGltfData(this, message);
  }

  private async handleXyzVariantData(message: any): Promise<void> {
    await formatDataHandlers.handleXyzVariantData(this, message);
  }

  createNormalsVisualizer(data: SpatialData): THREE.LineSegments {
    return normalsVisualizer.createNormalsVisualizer(data);
  }

  createComputedNormalsVisualizer(
    data: SpatialData,
    mesh: THREE.Object3D
  ): THREE.LineSegments | null {
    return normalsVisualizer.createComputedNormalsVisualizer(data, mesh);
  }

  createPointCloudNormalsVisualizer(
    data: SpatialData,
    mesh: THREE.Object3D
  ): THREE.LineSegments | null {
    return normalsVisualizer.createPointCloudNormalsVisualizer(data, mesh);
  }

  private async handleColorImageData(message: any): Promise<void> {
    await colorImageForDepth.handleColorImageData(this, message);
  }

  /**
   * Convert depth image to 3D point cloud
   * Based on the Python reference implementation
   */

  showStatus(message: string): void {
    uiStatus.showStatus(message);
  }

  /**
   * Show color mapping status message
   */
  private showColorMappingStatus(message: string, type: 'success' | 'error' | 'warning'): void {
    uiStatus.showColorMappingStatus(message, type);
  }

  /**
   * Determine if a Depth image is a depth image suitable for point cloud conversion
   * Accepts both floating-point and integer formats (for disparity images)
   */
  private isDepthTifImage(
    samplesPerPixel: number,
    sampleFormat: number | null,
    bitsPerSample: number[]
  ): boolean {
    // Depth images should be single-channel
    if (samplesPerPixel !== 1) {
      return false;
    }

    // Accept floating-point formats (sampleFormat 3) for depth images
    // and integer formats (sampleFormat 1, 2) for disparity images
    if (sampleFormat !== null && sampleFormat !== 1 && sampleFormat !== 2 && sampleFormat !== 3) {
      return false;
    }

    // If bit depth information is available, validate it
    if (bitsPerSample && bitsPerSample.length > 0 && bitsPerSample[0] !== undefined) {
      const bitDepth = bitsPerSample[0];
      // Accept common bit depths for depth/disparity images
      if (bitDepth !== 8 && bitDepth !== 16 && bitDepth !== 32) {
        return false;
      }
    }

    console.log(
      `✅ TIF validated as depth/disparity image: samples=${samplesPerPixel}, format=${sampleFormat}, bits=${bitsPerSample?.[0]}`
    );
    return true;
  }

  private getRgb24ScaleFactor(data: SpatialData): number {
    return commentSettings.getRgb24ScaleFactor(data);
  }

  private getRgb24ConversionMode(
    data: SpatialData
  ): 'shift' | 'multiply' | 'red' | 'green' | 'blue' {
    return commentSettings.getRgb24ConversionMode(data);
  }

  private getPngScaleFactor(data: SpatialData): number {
    return commentSettings.getPngScaleFactor(data);
  }

  private getDepthSetting(data: SpatialData, setting: 'camera' | 'depth'): string {
    return commentSettings.getDepthSetting(this, data, setting);
  }

  private getDepthFx(data: SpatialData): number {
    return commentSettings.getDepthFx(this, data);
  }

  private getDepthFy(data: SpatialData): string {
    return commentSettings.getDepthFy(this, data);
  }

  private getDepthBaseline(data: SpatialData): number {
    return commentSettings.getDepthBaseline(this, data);
  }

  private getDepthCx(data: SpatialData, fileIndex?: number): string {
    return commentSettings.getDepthCx(this, data, fileIndex);
  }

  private getDepthCy(data: SpatialData, fileIndex?: number): string {
    return commentSettings.getDepthCy(this, data, fileIndex);
  }

  private getDepthConvention(data: SpatialData): 'opengl' | 'opencv' {
    return commentSettings.getDepthConvention(this, data);
  }

  private getStoredColorImageName(fileIndex: number): string | null {
    return colorImageForDepth.getStoredColorImageName(this, fileIndex);
  }

  private getImageSizeDisplay(fileIndex: number): string {
    return colorImageForDepth.getImageSizeDisplay(this, fileIndex);
  }

  setLiveDepthUpdateEnabled(fileIndex: number, enabled: boolean): void {
    liveDepthUpdate.setLiveDepthUpdateEnabled(this, fileIndex, enabled);
  }

  private isDepthCommitTarget(
    target: EventTarget | null
  ): target is HTMLInputElement | HTMLSelectElement {
    return liveDepthUpdate.isDepthCommitTarget(target);
  }

  scheduleLiveDepthUpdate(fileIndex: number, delayMs: number = 60): void {
    liveDepthUpdate.scheduleLiveDepthUpdate(this, fileIndex, delayMs);
  }

  private async requestLiveDepthUpdate(fileIndex: number): Promise<void> {
    await liveDepthUpdate.requestLiveDepthUpdate(this, fileIndex);
  }

  private isLiveDepthResultCurrent(fileIndex: number, version?: number): boolean {
    return liveDepthUpdate.isLiveDepthResultCurrent(this, fileIndex, version);
  }

  private waitForNextFrame(): Promise<void> {
    return liveDepthUpdate.waitForNextFrame();
  }

  private async applyDepthSettings(fileIndex: number, liveVersion?: number): Promise<void> {
    await liveDepthUpdate.applyDepthSettings(this, fileIndex, liveVersion);
  }

  private handleDefaultDepthSettings(message: any): void {
    console.log('📥 Received default depth settings message:', message);
    if (message.settings) {
      // Update default settings from extension storage (exclude cx and cy as they are auto-calculated per image)
      this.defaultDepthSettings = {
        fx: message.settings.fx || 1000,
        fy: message.settings.fy,
        cx: this.defaultDepthSettings.cx, // Keep existing cx, don't load from storage
        cy: this.defaultDepthSettings.cy, // Keep existing cy, don't load from storage
        cameraModel: message.settings.cameraModel || 'pinhole-ideal',
        depthType: message.settings.depthType || 'euclidean',
        baseline: message.settings.baseline,
        convention: message.settings.convention || 'opengl',
        pngScaleFactor: message.settings.pngScaleFactor || 1000,
        depthScale: message.settings.depthScale !== undefined ? message.settings.depthScale : 1.0,
        depthBias: message.settings.depthBias !== undefined ? message.settings.depthBias : 0.0,
      };
      console.log('✅ Loaded default depth settings from extension:', this.defaultDepthSettings);

      // Apply saved camera view convention if present
      if (message.viewConvention === 'opencv') {
        this.setOpenCVCameraConvention();
      } else if (message.viewConvention === 'opengl') {
        this.setOpenGLCameraConvention();
      }

      // Update any existing depth file forms to use new defaults
      this.refreshDepthFileFormsWithDefaults();
      this.updateDefaultButtonState();
    } else {
      console.log('⚠️ No settings in default depth settings message');
    }
  }

  private refreshDepthFileFormsWithDefaults(): void {
    // Update existing depth file forms to use the new default settings
    for (let i = 0; i < this.spatialFiles.length; i++) {
      const data = this.spatialFiles[i];
      if (commentSettings.isDepthDerivedFile(data)) {
        console.log(`🔄 Refreshing depth form ${i} with new defaults`);
        this.updateDepthFormWithDefaults(i);
      }
    }
  }

  private updateDepthFormWithDefaults(fileIndex: number): void {
    // Update form fields to show default values (but preserve cx/cy if they exist from image dimensions)
    const fxInput = document.getElementById(`fx-${fileIndex}`) as HTMLInputElement;
    const fyInput = document.getElementById(`fy-${fileIndex}`) as HTMLInputElement;
    if (fxInput) {
      fxInput.value = this.defaultDepthSettings.fx.toString();
    }
    if (fyInput && this.defaultDepthSettings.fy !== undefined) {
      fyInput.value = this.defaultDepthSettings.fy.toString();
    }

    // Preserve cx/cy values if they were auto-calculated from Depth dimensions
    const cxInput = document.getElementById(`cx-${fileIndex}`) as HTMLInputElement;
    const cyInput = document.getElementById(`cy-${fileIndex}`) as HTMLInputElement;
    const depthData = this.fileDepthData.get(fileIndex);

    if (cxInput && depthData?.depthDimensions) {
      // Keep the computed cx value based on actual image dimensions
      const computedCx = (depthData.depthDimensions.width - 1) / 2;
      cxInput.value = computedCx.toString();
      console.log(
        `📐 Preserving computed cx = ${computedCx} for file ${fileIndex} (not overriding with defaults)`
      );
    }

    if (cyInput && depthData?.depthDimensions) {
      // Keep the computed cy value based on actual image dimensions
      const computedCy = (depthData.depthDimensions.height - 1) / 2;
      cyInput.value = computedCy.toString();
      console.log(
        `📐 Preserving computed cy = ${computedCy} for file ${fileIndex} (not overriding with defaults)`
      );
    }

    const cameraModelSelect = document.getElementById(
      `camera-model-${fileIndex}`
    ) as HTMLSelectElement;
    if (cameraModelSelect) {
      cameraModelSelect.value = this.defaultDepthSettings.cameraModel;
    }

    const depthTypeSelect = document.getElementById(`depth-type-${fileIndex}`) as HTMLSelectElement;
    if (depthTypeSelect) {
      depthTypeSelect.value = this.defaultDepthSettings.depthType;

      // Update baseline and disparity offset visibility based on depth type
      const baselineGroup = document.getElementById(`baseline-group-${fileIndex}`);
      const disparityOffsetGroup = document.getElementById(`disparity-offset-group-${fileIndex}`);
      const isDisparity = this.defaultDepthSettings.depthType === 'disparity';
      if (baselineGroup) {
        baselineGroup.style.display = isDisparity ? '' : 'none';
      }
      if (disparityOffsetGroup) {
        disparityOffsetGroup.style.display = isDisparity ? '' : 'none';
      }
    }

    const baselineInput = document.getElementById(`baseline-${fileIndex}`) as HTMLInputElement;
    if (baselineInput && this.defaultDepthSettings.baseline !== undefined) {
      baselineInput.value = this.defaultDepthSettings.baseline.toString();
    }

    const conventionSelect = document.getElementById(
      `convention-${fileIndex}`
    ) as HTMLSelectElement;
    if (conventionSelect) {
      conventionSelect.value = this.defaultDepthSettings.convention || 'opengl';
    }

    const depthScaleInput = document.getElementById(`depth-scale-${fileIndex}`) as HTMLInputElement;
    if (depthScaleInput && this.defaultDepthSettings.depthScale !== undefined) {
      depthScaleInput.value = this.defaultDepthSettings.depthScale.toString();
    }

    const depthBiasInput = document.getElementById(`depth-bias-${fileIndex}`) as HTMLInputElement;
    if (depthBiasInput && this.defaultDepthSettings.depthBias !== undefined) {
      depthBiasInput.value = this.defaultDepthSettings.depthBias.toString();
    }

    console.log(`✅ Updated depth form ${fileIndex} with defaults:`, this.defaultDepthSettings);
  }

  updatePrinciplePointFields(
    fileIndex: number,
    dimensions: { width: number; height: number }
  ): void {
    // Update cx and cy form fields with computed values based on actual image dimensions
    const cxInput = document.getElementById(`cx-${fileIndex}`) as HTMLInputElement;
    const cyInput = document.getElementById(`cy-${fileIndex}`) as HTMLInputElement;

    const computedCx = (dimensions.width - 1) / 2;
    const computedCy = (dimensions.height - 1) / 2;

    if (cxInput) {
      cxInput.value = computedCx.toString();
    }

    if (cyInput) {
      cyInput.value = computedCy.toString();
    }

    // Update image size display
    const imageSizeDiv = document.getElementById(`image-size-${fileIndex}`);
    if (imageSizeDiv) {
      imageSizeDiv.textContent = `Image Size: Width: ${dimensions.width}, Height: ${dimensions.height}`;
    }

    // Note: Not calling updateSingleDefaultButtonState() here to avoid duplicate calls
    // It will be called by updateFileList() which renders the UI
  }

  private updateDefaultButtonState(): void {
    depthDefaultSettings.updateDefaultButtonState(this);
  }

  updateSingleDefaultButtonState(fileIndex: number): void {
    depthDefaultSettings.updateSingleDefaultButtonState(this, fileIndex);
  }

  private async useAsDefaultSettings(fileIndex: number): Promise<void> {
    await depthDefaultSettings.useAsDefaultSettings(this, fileIndex);
  }

  private async resetToDefaultSettings(fileIndex: number): Promise<void> {
    await depthDefaultSettings.resetToDefaultSettings(this, fileIndex);
  }

  private resetMonoParameters(fileIndex: number): void {
    depthDefaultSettings.resetMonoParameters(this, fileIndex);
  }

  private resetDisparityOffset(fileIndex: number): void {
    depthDefaultSettings.resetDisparityOffset(this, fileIndex);
  }

  private resetPrinciplePoint(fileIndex: number): void {
    depthDefaultSettings.resetPrinciplePoint(this, fileIndex);
  }

  private async removeColorImageFromDepth(fileIndex: number): Promise<void> {
    await colorImageForDepth.removeColorImageFromDepth(this, fileIndex);
  }

  private savePlyFile(fileIndex: number): void {
    plyExport.savePlyFile(this, fileIndex);
  }

  private generatePlyFileContent(spatialData: SpatialData, fileIndex: number): string {
    return plyExport.generatePlyFileContent(this, spatialData, fileIndex);
  }

  // ========== Pose loading ==========
  async handlePoseData(message: any): Promise<void> {
    await pose.handlePoseData(this, message);
  }

  // ========== Camera Profile handling ==========
  handleCameraProfile(data: any, fileName: string): void {
    cameraProfile.handleCameraProfile(this, data, fileName);
  }

  private createCameraVisualization(
    cameraName: string,
    location: number[],
    rotationQuaternion: number[],
    rotationType?: string
  ): THREE.Group {
    return cameraProfile.createCameraVisualization(
      cameraName,
      location,
      rotationQuaternion,
      rotationType
    );
  }

  private toggleCameraVisibility(): void {
    cameraProfile.toggleCameraVisibility(this);
  }

  private updateCameraButtonState(): void {
    cameraProfile.updateCameraButtonState(this);
  }

  private toggleCameraProfileLabels(cameraProfileIndex: number, showLabels: boolean): void {
    cameraProfile.toggleCameraProfileLabels(this, cameraProfileIndex, showLabels);
  }

  private toggleCameraProfileCoordinates(cameraProfileIndex: number, showCoords: boolean): void {
    cameraProfile.toggleCameraProfileCoordinates(this, cameraProfileIndex, showCoords);
  }

  applyCameraScale(cameraProfileIndex: number, scale: number): void {
    cameraProfile.applyCameraScale(this, cameraProfileIndex, scale);
  }

  private handleMtlData(message: any): void {
    formatDataHandlers.handleMtlData(this, message);
  }

  /**
   * Capture the current open/closed state of depth settings panels and form values
   */
  captureDepthPanelStates(): Map<number, { panelOpen: boolean; formValues: any }> {
    return depthPanelState.captureDepthPanelStates(this);
  }

  private captureDepthFormValues(fileIndex: number): any {
    return depthPanelState.captureDepthFormValues(this, fileIndex);
  }

  restoreDepthPanelStates(states: Map<number, { panelOpen: boolean; formValues: any }>): void {
    depthPanelState.restoreDepthPanelStates(this, states);
  }

  private restoreDepthFormValues(fileIndex: number, formValues: any): void {
    depthPanelState.restoreDepthFormValues(this, fileIndex, formValues);
  }

  async promptForCameraParameters(fileName: string): Promise<CameraParams | null> {
    return depthCameraParamsPrompt.promptForCameraParameters(fileName);
  }

  async triggerDatasetCalibrationLoading(sceneMetadata: any): Promise<void> {
    await datasetWorkflow.triggerDatasetCalibrationLoading(this, sceneMetadata);
  }

  async triggerDatasetImageLoading(sceneMetadata: any): Promise<void> {
    await datasetWorkflow.triggerDatasetImageLoading(this, sceneMetadata);
  }

  private async handleDatasetTexture(message: any): Promise<void> {
    await datasetWorkflow.handleDatasetTexture(this, message);
  }
}

// # VSCode changes: before this code was used instead of anything below

// Initialize when DOM is ready
// if (document.readyState === 'loading') {
//   document.addEventListener('DOMContentLoaded', () => new PointCloudVisualizer());
// } else {
//   new PointCloudVisualizer();
// }
// below, everything is new for the web version

// Export for global access
(window as any).PointCloudVisualizer = PointCloudVisualizer;

// Initialize when DOM is ready
let visualizer: PointCloudVisualizer | null = null;

async function initializeVisualizer() {
  // Initialize themes first - only for browser version
  // VSCode handles theming natively via CSS variables
  if (!isVSCode) {
    await initializeThemes();
    console.log('✅ Theme system initialized');

    // Initialize theme switcher
    setupThemeSwitcher();
  }

  if (!visualizer) {
    visualizer = new PointCloudVisualizer();
    (window as any).visualizer = visualizer;
    console.log('✅ PointCloudVisualizer initialized');
  }
}

function setupThemeSwitcher() {
  const themeSelector = document.getElementById('theme-selector') as HTMLSelectElement;
  if (themeSelector) {
    // Set current theme as selected
    themeSelector.value = getCurrentThemeName();

    // Add event listener for theme changes
    themeSelector.addEventListener('change', async event => {
      const selectedTheme = (event.target as HTMLSelectElement).value;
      console.log('🎨 Switching to theme:', selectedTheme);

      const theme = await getThemeByName(selectedTheme);
      if (theme) {
        applyTheme(theme);
        console.log('✅ Theme applied:', theme.displayName);
      } else {
        console.error('❌ Failed to load theme:', selectedTheme);
      }
    });

    console.log('✅ Theme switcher initialized');
  } else {
    console.warn('⚠️ Theme selector not found in DOM');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeVisualizer);
} else {
  initializeVisualizer();
}

export default PointCloudVisualizer;
