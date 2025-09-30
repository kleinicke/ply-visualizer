/**
 * ThreeManager - Phase 2: Three.js functionality extraction
 *
 * This class extracts the core Three.js rendering functionality from the monolithic
 * main.ts file, making it reusable and easier to manage. This is the first step
 * in the Svelte migration process.
 *
 * Phase 2 Goal: Extract Three.js functionality without changing any behavior
 */

import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { CustomArcballControls, TurntableControls } from '../controls';

export class ThreeManager {
  // Core Three.js objects
  public scene!: THREE.Scene;
  public camera!: THREE.PerspectiveCamera;
  public renderer!: THREE.WebGLRenderer;
  public controls!: any; // Union type of different control types

  // Animation and rendering state
  private animationId: number | null = null;
  private needsRender: boolean = false;

  // Control type selection
  private controlType: 'trackball' | 'orbit' | 'inverse-trackball' | 'arcball' | 'cloudcompare' =
    'trackball';
  private useFlatLighting: boolean = false;

  // Event callbacks
  private onRenderCallback?: () => void;
  private onCameraChangeCallback?: () => void;

  // Container reference
  private container: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;

  // FPS tracking
  private fpsFrameTimes: number[] = [];
  private lastFpsUpdate: number = 0;
  private currentFps: number = 0;

  // Frame time tracking
  private lastFrameTime: number = 0;
  private frameRenderTimes: number[] = [];

  // GPU timing
  private gpuTimerExtension: any = null;
  private gpuQueries: any[] = [];
  private gpuTimes: number[] = [];
  private currentGpuTime: number = 0;

  // Camera tracking
  private lastCameraPosition = new THREE.Vector3();
  private lastCameraQuaternion = new THREE.Quaternion();
  private lastRotationCenter = new THREE.Vector3();

  // Movement tracking for render optimization
  private movementHistory: { position: THREE.Vector3; rotation: THREE.Quaternion; time: number }[] =
    [];
  private lastRenderTime: number = 0;
  private renderCooldown: number = 0; // Frames to skip after movement stops

  // References to scene objects
  private axesGroup: THREE.Group | null = null;
  private axesHelper: THREE.AxesHelper | null = null;

  constructor() {
    console.log('ThreeManager created');
  }

  initialize(container: HTMLElement): void {
    this.container = container;
    this.initThreeJS();
  }

  private initThreeJS(): void {
    if (!this.container) {
      throw new Error('Container not provided to ThreeManager');
    }

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x222222);

    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      this.container.clientWidth / this.container.clientHeight,
      0.001,
      1000000 // Far plane for disparity files
    );
    this.camera.position.set(1, 1, 1);

    // Initialize last camera state for change detection
    this.lastCameraPosition.copy(this.camera.position);
    this.lastCameraQuaternion.copy(this.camera.quaternion);

    // Renderer - look for existing canvas or create container
    let canvas = this.container.querySelector('canvas') as HTMLCanvasElement;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.style.width = '100%';
      canvas.style.height = '100%';
      this.container.appendChild(canvas);
    }

    this.renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      antialias: true,
      alpha: true,
      preserveDrawingBuffer: false, // better performance
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.sortObjects = true;

    // Initialize GPU timing if supported
    this.initGPUTiming();

    // Initialize controls
    this.initializeControls();

    // Lighting
    this.initSceneLighting();

    // Add coordinate axes helper
    this.addAxesHelper();

    // Setup resize handling
    this.setupResizeObserver();

    // Event listeners for rendering
    this.setupEventListeners();

    // Start render loop
    this.startRenderLoop();

    console.log('ThreeManager initialized successfully');
  }

  private initializeControls(): void {
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
    } else if (this.controlType === 'orbit') {
      this.controls = new OrbitControls(this.camera, this.renderer.domElement);
      const orbitControls = this.controls as OrbitControls;
      orbitControls.enableDamping = true;
      orbitControls.dampingFactor = 0.25;
      orbitControls.enableZoom = true;
      orbitControls.enableRotate = true;
      orbitControls.enablePan = true;
    }

    // Restore camera state
    this.camera.position.copy(currentCameraPosition);
    this.camera.up.copy(currentUp);
    this.controls.target.copy(currentTarget);
    this.controls.update();

    // Set up control event listeners
    this.controls.addEventListener('change', () => {
      this.requestRender();
    });
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
  }

  private addAxesHelper(): void {
    // Create a group to hold axes and labels
    this.axesGroup = new THREE.Group();

    // Create coordinate axes helper (X=red, Y=green, Z=blue)
    this.axesHelper = new THREE.AxesHelper(1); // Size of 1 unit
    this.axesGroup.add(this.axesHelper);

    // Scale the axes based on the scene size once we have objects
    this.axesGroup.scale.setScalar(0.5);

    // Position at the rotation center (initially at origin)
    this.axesGroup.position.copy(this.controls.target);

    // Initially hide the axes
    this.axesGroup.visible = false;

    // Add to scene
    this.scene.add(this.axesGroup);
  }

  private initGPUTiming(): void {
    this.gpuTimerExtension = this.renderer
      .getContext()
      .getExtension('EXT_disjoint_timer_query_webgl2');
    if (this.gpuTimerExtension) {
      console.log('GPU timing extension available');
    }
  }

  private setupResizeObserver(): void {
    if (!this.container) {
      return;
    }

    this.resizeObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        this.onWindowResize();
      }
    });

    this.resizeObserver.observe(this.container);
  }

  private onWindowResize(): void {
    if (!this.container) {
      return;
    }

    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.requestRender();
  }

  private setupEventListeners(): void {
    if (!this.container) {
      return;
    }

    // Double-click event handling can be added here
    this.renderer.domElement.addEventListener('dblclick', event => {
      // Will be implemented when selection system is added
      console.log('Double-click detected');
    });
  }

  private animate(): void {
    this.animationId = requestAnimationFrame(this.animate.bind(this));

    // Update controls
    this.controls.update();

    // Check if camera position, rotation, or rotation center has changed
    const positionChanged = !this.camera.position.equals(this.lastCameraPosition);
    const rotationChanged = !this.camera.quaternion.equals(this.lastCameraQuaternion);
    const rotationCenterChanged = !this.controls.target.equals(this.lastRotationCenter);

    const now = performance.now();
    const hasMovement = positionChanged || rotationChanged || rotationCenterChanged;

    // Track movement for velocity-based rendering optimization
    if (hasMovement) {
      // Record current state for velocity tracking
      this.movementHistory.push({
        position: this.camera.position.clone(),
        rotation: this.camera.quaternion.clone(),
        time: now,
      });

      // Keep only last 5 frames for velocity calculation
      if (this.movementHistory.length > 5) {
        this.movementHistory.shift();
      }

      this.renderCooldown = 0; // Reset cooldown on movement
    } else if (this.renderCooldown > 0) {
      this.renderCooldown--; // Countdown frames after movement stops
    }

    // Determine if we should render based on movement and momentum
    const shouldRender =
      this.needsRender || hasMovement || this.renderCooldown > 0 || this.isControlsMoving();

    if (shouldRender) {
      // Update FPS calculation only when actually rendering
      this.updateFPSCalculation();

      // Call business logic callback for camera changes
      if (hasMovement && this.onCameraChangeCallback) {
        this.onCameraChangeCallback();
      }

      this.render();
      this.needsRender = false;
      this.lastRenderTime = now;

      // Update camera state
      this.lastCameraPosition.copy(this.camera.position);
      this.lastCameraQuaternion.copy(this.camera.quaternion);
      this.lastRotationCenter.copy(this.controls.target);

      // Set cooldown frames after movement to catch damping tail
      if (hasMovement) {
        this.renderCooldown = 10; // Render for 10 more frames after movement stops
      }
    }
  }

  private render(): void {
    const startTime = performance.now();

    // Start GPU timing if available
    this.startGPUTiming();

    // Render the scene
    this.renderer.render(this.scene, this.camera);

    // End GPU timing
    this.endGPUTiming();

    // Track frame time
    const endTime = performance.now();
    this.trackFrameTime(endTime - startTime);
  }

  private updateFPSCalculation(): void {
    const now = performance.now();
    this.fpsFrameTimes.push(now);

    // Keep only the last second of frame times
    const oneSecondAgo = now - 1000;
    this.fpsFrameTimes = this.fpsFrameTimes.filter(time => time > oneSecondAgo);

    // Update FPS every 100ms
    if (now - this.lastFpsUpdate > 100) {
      this.currentFps = this.fpsFrameTimes.length;
      this.lastFpsUpdate = now;
    }
  }

  private trackFrameTime(frameTime: number): void {
    this.frameRenderTimes.push(frameTime);
    if (this.frameRenderTimes.length > 60) {
      this.frameRenderTimes.shift();
    }
  }

  private startGPUTiming(): void {
    if (!this.gpuTimerExtension) {
      return;
    }
    // GPU timing implementation
  }

  private endGPUTiming(): void {
    if (!this.gpuTimerExtension) {
      return;
    }
    // GPU timing implementation
  }

  private isControlsMoving(): boolean {
    // Check if controls have internal momentum/damping still active
    if (this.controlType === 'orbit' && this.controls) {
      // OrbitControls has damping - check if it's still moving
      const orbitControls = this.controls as any;
      if (orbitControls.enableDamping) {
        // If damping is enabled, check if there's significant movement in recent history
        if (this.movementHistory.length >= 2) {
          const recent = this.movementHistory[this.movementHistory.length - 1];
          const previous = this.movementHistory[this.movementHistory.length - 2];
          const timeDiff = recent.time - previous.time;

          if (timeDiff > 0) {
            const positionDelta = recent.position.distanceTo(previous.position);
            const velocity = (positionDelta / timeDiff) * 1000; // pixels per second

            // If velocity is very low, consider movement stopped
            return velocity > 0.001; // Threshold for "still moving"
          }
        }
      }
    }

    // For trackball controls, we rely on the cooldown period
    // since they don't have built-in damping detection
    return false;
  }

  public startRenderLoop(): void {
    if (this.animationId === null) {
      this.animate();
    }
  }

  public stopRenderLoop(): void {
    if (this.animationId !== null) {
      cancelAnimationFrame(this.animationId);
      this.animationId = null;
    }
  }

  // Public API methods
  requestRender(): void {
    this.needsRender = true;
  }

  setControlType(
    type: 'trackball' | 'orbit' | 'inverse-trackball' | 'arcball' | 'cloudcompare'
  ): void {
    this.controlType = type;
    this.initializeControls();
  }

  setLightingMode(flatLighting: boolean): void {
    this.useFlatLighting = flatLighting;
    this.initSceneLighting();
  }

  toggleAxesVisibility(visible: boolean): void {
    if (this.axesGroup) {
      this.axesGroup.visible = visible;
      this.requestRender();
    }
  }

  setOnCameraChangeCallback(callback: () => void): void {
    this.onCameraChangeCallback = callback;
  }

  // Scene management methods for spatial data
  clearScene(): void {
    // Remove all objects except lights and helpers
    const objectsToRemove = this.scene.children.filter(
      child =>
        !(child instanceof THREE.Light) &&
        !(child instanceof THREE.AxesHelper) &&
        child !== this.axesGroup
    );

    objectsToRemove.forEach(object => {
      this.scene.remove(object);
      // Dispose geometry and material if they exist
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
        if (object.geometry) {
          object.geometry.dispose();
        }
        if (object.material) {
          if (Array.isArray(object.material)) {
            object.material.forEach(mat => mat.dispose());
          } else {
            object.material.dispose();
          }
        }
      }
    });

    this.requestRender();
  }

  addToScene(object: THREE.Object3D, name?: string): void {
    if (name) {
      object.name = name;
    }
    this.scene.add(object);
    this.requestRender();
  }

  fitToView(): void {
    // Calculate bounding box of all objects in scene
    const box = new THREE.Box3();
    this.scene.traverse(object => {
      if (object instanceof THREE.Mesh || object instanceof THREE.Points) {
        const objectBox = new THREE.Box3().setFromObject(object);
        box.union(objectBox);
      }
    });

    if (!box.isEmpty()) {
      const center = box.getCenter(new THREE.Vector3());
      const size = box.getSize(new THREE.Vector3());
      const maxDim = Math.max(size.x, size.y, size.z);
      const fov = this.camera.fov * (Math.PI / 180);
      const distance = maxDim / (2 * Math.tan(fov / 2));

      this.camera.position.copy(center);
      this.camera.position.z += distance * 1.5;
      this.controls.target.copy(center);
      this.controls.update();
      this.requestRender();
    }
  }

  // Getters for external access
  getScene(): THREE.Scene {
    return this.scene;
  }

  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  getRenderer(): THREE.WebGLRenderer {
    return this.renderer;
  }

  getControls() {
    return this.controls;
  }

  getCurrentFps(): number {
    return this.currentFps;
  }

  getLastFrameTime(): number | null {
    if (this.frameRenderTimes.length === 0) {
      return null; // No recent rendering
    }
    return this.frameRenderTimes[this.frameRenderTimes.length - 1];
  }

  isRendering(): boolean {
    // Check if we've rendered in the last 100ms
    const now = performance.now();
    return now - this.lastRenderTime < 100;
  }

  dispose(): void {
    console.log('ThreeManager disposing...');

    this.stopRenderLoop();

    if (this.controls) {
      this.controls.dispose();
    }

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    if (this.renderer) {
      this.renderer.dispose();
    }

    // Clear scene
    while (this.scene.children.length > 0) {
      this.scene.remove(this.scene.children[0]);
    }
  }
}
