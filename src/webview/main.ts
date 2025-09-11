import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import {
    PlyVertex,
    PlyFace,
    PlyData,
    CameraParams,
    DepthConversionResult
} from './interfaces';
import { CameraModel } from './depth/types';
import { CalibTxtParser } from './depth/CalibTxtParser';
import { YamlCalibrationParser } from './depth/YamlCalibrationParser';
import { ColmapParser } from './depth/ColmapParser';
import { ZedParser } from './depth/ZedParser';
import { RealSenseParser } from './depth/RealSenseParser';
import { TumParser } from './depth/TumParser';
import { CustomArcballControls, TurntableControls } from './controls';

declare const acquireVsCodeApi: () => any;
declare const GeoTIFF: any;


/**
 * Modern point cloud visualizer with unified file management and Depth image processing
 */

class PointCloudVisualizer {
    private vscode = acquireVsCodeApi();
    private scene!: THREE.Scene;
    private camera!: THREE.PerspectiveCamera;
    private renderer!: THREE.WebGLRenderer;
    private controls!: TrackballControls | OrbitControls | CustomArcballControls | TurntableControls;
    
    // Camera control state
    private controlType: 'trackball' | 'orbit' | 'inverse-trackball' | 'arcball' | 'cloudcompare' = 'trackball';
    
    // On-demand rendering state
    private needsRender: boolean = false;
    private animationId: number | null = null;
    
    // Unified file management
    private plyFiles: PlyData[] = [];
    private meshes: (THREE.Mesh | THREE.Points | THREE.LineSegments)[] = [];
    private normalsVisualizers: (THREE.LineSegments | null)[] = [];
    private vertexPointsObjects: (THREE.Points | null)[] = []; // Vertex points for triangle meshes
    private multiMaterialGroups: (THREE.Group | null)[] = []; // Multi-material Groups for OBJ files
    private materialMeshes: (THREE.Object3D[] | null)[] = []; // Sub-meshes for multi-material OBJ files
    private fileVisibility: boolean[] = [];
    
    // Universal rendering mode states for each file
    private solidVisible: boolean[] = []; // Solid mesh rendering
    private wireframeVisible: boolean[] = []; // Wireframe rendering
    private pointsVisible: boolean[] = []; // Points rendering
    private normalsVisible: boolean[] = []; // Normals lines rendering
    
    private useOriginalColors = true; // Default to original colors
    private pointSizes: number[] = []; // Individual point sizes for each point cloud

    // Sequence mode state
    private sequenceMode = false;
    private sequenceFiles: string[] = [];
    private sequenceIndex = 0;
    private sequenceTargetIndex = 0;
    private sequenceDidInitialFit = false;
    private sequenceTimer: number | null = null;
    private sequenceFps = 2; // ~2 frames per second
    private isSequencePlaying = false;
    private sequenceCache = new Map<number, THREE.Object3D>();
    private sequenceCacheOrder: number[] = [];
    private maxSequenceCache = 6; // keep more frames when navigating back
    private individualColorModes: string[] = []; // Individual color modes: 'original', 'assigned', or color index
    private appliedMtlColors: (number | null)[] = []; // Store applied MTL hex colors for each file
    private appliedMtlNames: (string | null)[] = []; // Store applied MTL material names for each file
    private appliedMtlData: (any | null)[] = []; // Store applied MTL data for each file
    
    // Per-file Depth data storage for reprocessing
    private fileDepthData: Map<number, {
        originalData: ArrayBuffer;
        cameraParams: CameraParams;
        fileName: string;
        depthDimensions: { width: number; height: number };
        colorImageData?: ImageData;
        colorImageName?: string;
    }> = new Map();

    // Calibration data storage for each depth file
    private calibrationData?: Map<number, any>;

    // Pose entries managed like files but stored as Object3D groups
    private poseGroups: THREE.Group[] = [];
    private poseMeta: { 
        jointCount: number; 
        edgeCount: number; 
        fileName: string;
        invalidJoints?: number;
        // Dataset extras (Halpe or similar)
        jointColors?: [number, number, number][]; // normalized 0-1
        linkColors?: [number, number, number][];  // normalized 0-1
        keypointNames?: string[];
        skeletonLinks?: Array<[number, number]>;
        jointScores?: number[];
        jointUncertainties?: Array<[number, number, number]>;
    }[] = [];
    // Per-pose feature toggles
    private poseUseDatasetColors: boolean[] = [];
    private poseShowLabels: boolean[] = [];
    private poseScaleByScore: boolean[] = [];
    private poseScaleByUncertainty: boolean[] = [];
    private poseConvention: ('opencv'|'opengl')[] = [];
    private poseMinScoreThreshold: number[] = [];
    private poseMaxUncertaintyThreshold: number[] = [];
    private poseLabelsGroups: (THREE.Group | null)[] = [];
    private poseJoints: Array<Array<{ x:number; y:number; z:number; valid?: boolean }>> = [];
    private poseEdges: Array<Array<[number, number]>> = [];
    
    // Camera visualization
    private cameraGroups: THREE.Group[] = [];
    private cameraNames: string[] = [];
    private cameraVisibility: boolean = true;
    
    // Rotation matrices
    private cameraMatrix: THREE.Matrix4 = new THREE.Matrix4(); // Current camera position and rotation
    private transformationMatrices: THREE.Matrix4[] = []; // Individual transformation matrices for each point cloud
    private frameCount: number = 0; // Frame counter for UI updates
    private lastCameraPosition: THREE.Vector3 = new THREE.Vector3(); // Track camera position changes
    private lastCameraQuaternion: THREE.Quaternion = new THREE.Quaternion(); // Track camera rotation changes
    private arcballInvertRotation: boolean = false; // preference for arcball handedness
    
    // Lighting/material toggles
    private useUnlitPly: boolean = false;
    private useFlatLighting: boolean = false;
    private lightingMode: 'normal' | 'flat' | 'unlit' = 'normal';
    
    // Large file chunked loading state
    private chunkedFileState: Map<string, {
        fileName: string;
        totalVertices: number;
        totalChunks: number;
        receivedChunks: number;
        vertices: PlyVertex[];
        hasColors: boolean;
        hasNormals: boolean;
        faces: PlyFace[];
        format: string;
        comments: string[];
        messageType: string;
        startTime: number;
        firstChunkTime: number;
        lastChunkTime: number;
    }> = new Map();
    
    // Adaptive decimation tracking
    private lastCameraDistance: number = 0;
    
    // Depth processing state - support multiple pending Depth files
    private pendingDepthFiles: Map<string, {
        data: ArrayBuffer;
        fileName: string;
        isAddFile: boolean;
        requestId: string;
    }> = new Map();
    
    // Depth conversion tracking
    private originalDepthFileName: string | null = null;
    private currentCameraParams: CameraParams | null = null;
    private depthDimensions: { width: number; height: number } | null = null;
    private useLinearColorSpace: boolean = true; // Default: toggle is inactive; renderer still outputs sRGB
    private axesPermanentlyVisible: boolean = false; // Persistent axes visibility toggle
    // Color space handling: always output sRGB, optionally convert source sRGB colors to linear before shading

    // Default depth settings for new files
    private defaultDepthSettings: CameraParams = {
        fx: 1000,
        fy: undefined, // Optional, defaults to fx if not provided
        cx: undefined, // Will be auto-calculated per image based on dimensions
        cy: undefined, // Will be auto-calculated per image based on dimensions
        cameraModel: 'pinhole-ideal',
        depthType: 'euclidean',
        convention: 'opengl',
        pngScaleFactor: 1000, // Default for PNG files
        depthScale: 1.0, // Default scale factor for mono depth networks
        depthBias: 0.0 // Default bias for mono depth networks
    };
    private convertSrgbToLinear: boolean = true; // Default: remove gamma from source colors
    private srgbToLinearLUT: Float32Array | null = null;
    private lastGeometryMs: number = 0;
    private lastAbsoluteMs: number = 0;

    private ensureSrgbLUT(): void {
        if (this.srgbToLinearLUT) return;
        const lut = new Float32Array(256);
        for (let i = 0; i < 256; i++) {
            const s = i / 255;
            lut[i] = s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
        }
        this.srgbToLinearLUT = lut;
    }

    private optimizeForPointCount(material: THREE.PointsMaterial, pointCount: number): void {
        // Keep original visual quality settings
        material.transparent = true;
        material.alphaTest = 0.1;
        material.depthTest = true;
        material.depthWrite = true;
        material.sizeAttenuation = true; // Keep world-space sizing
        
        // Force material update
        material.needsUpdate = true;
    }
    
    private createOptimizedPointCloud(geometry: THREE.BufferGeometry, material: THREE.PointsMaterial): THREE.Points {
        // Optimize geometry for GPU
        const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
        if (positions && positions.count > 50000) {
            // For very large point clouds, try to reduce vertex data transfer
            geometry.deleteAttribute('normal'); // Points don't need normals
            geometry.computeBoundingBox(); // Help with frustum culling
            geometry.computeBoundingSphere();
        }
        
        const points = new THREE.Points(geometry, material);
        
        // Add adaptive decimation for large point clouds
        if (positions && positions.count > 100000) {
            (points as any).originalGeometry = geometry.clone(); // Store full geometry
            (points as any).hasAdaptiveDecimation = true;
            points.frustumCulled = false;
        }
        
        return points;
    }
    
    private decimateGeometryByDistance(originalGeometry: THREE.BufferGeometry, cameraDistance: number): THREE.BufferGeometry {
        const positions = originalGeometry.getAttribute('position') as THREE.BufferAttribute;
        const colors = originalGeometry.getAttribute('color') as THREE.BufferAttribute;
        
        let decimationFactor = 1;
        
        // Aggressive decimation when zoomed out (high camera distance)
        if (cameraDistance > 50) decimationFactor = 10;      // Keep every 10th point
        else if (cameraDistance > 20) decimationFactor = 5;  // Keep every 5th point  
        else if (cameraDistance > 10) decimationFactor = 3;  // Keep every 3rd point
        else if (cameraDistance > 5) decimationFactor = 2;   // Keep every 2nd point
        
        if (decimationFactor === 1) return originalGeometry;
        
        const totalPoints = positions.count;
        const decimatedCount = Math.floor(totalPoints / decimationFactor);
        
        const newPositions = new Float32Array(decimatedCount * 3);
        const newColors = colors ? new Float32Array(decimatedCount * 3) : null;
        
        let writeIndex = 0;
        for (let i = 0; i < totalPoints; i += decimationFactor) {
            // Copy position
            newPositions[writeIndex * 3] = positions.array[i * 3];
            newPositions[writeIndex * 3 + 1] = positions.array[i * 3 + 1];
            newPositions[writeIndex * 3 + 2] = positions.array[i * 3 + 2];
            
            // Copy color if available
            if (newColors && colors) {
                newColors[writeIndex * 3] = colors.array[i * 3];
                newColors[writeIndex * 3 + 1] = colors.array[i * 3 + 1];
                newColors[writeIndex * 3 + 2] = colors.array[i * 3 + 2];
            }
            
            writeIndex++;
        }
        
        const newGeometry = new THREE.BufferGeometry();
        newGeometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
        if (newColors) {
            newGeometry.setAttribute('color', new THREE.BufferAttribute(newColors, 3));
        }
        
        return newGeometry;
    }
    
    private updateAdaptiveDecimation(): void {
        // Calculate average distance to all point clouds
        let totalDistance = 0;
        let pointCloudCount = 0;
        
        for (let i = 0; i < this.meshes.length; i++) {
            const mesh = this.meshes[i];
            if (mesh && (mesh instanceof THREE.Points) && (mesh as any).hasAdaptiveDecimation) {
                if (mesh.geometry.boundingBox) {
                    const center = mesh.geometry.boundingBox.getCenter(new THREE.Vector3());
                    center.applyMatrix4(mesh.matrixWorld);
                    totalDistance += this.camera.position.distanceTo(center);
                    pointCloudCount++;
                }
            }
        }
        
        if (pointCloudCount === 0) return;
        
        const avgDistance = totalDistance / pointCloudCount;
        
        // Update geometries if distance changed significantly
        const distanceThreshold = 2.0; // Only update if camera moved significantly
        if (Math.abs(avgDistance - this.lastCameraDistance) > distanceThreshold) {
            let decimationLog = `🔄 Adaptive decimation: distance=${avgDistance.toFixed(1)}`;
            
            for (let i = 0; i < this.meshes.length; i++) {
                const mesh = this.meshes[i];
                if (mesh && (mesh instanceof THREE.Points) && (mesh as any).hasAdaptiveDecimation) {
                    const originalGeometry = (mesh as any).originalGeometry;
                    if (originalGeometry) {
                        const decimatedGeometry = this.decimateGeometryByDistance(originalGeometry, avgDistance);
                        
                        // Update mesh geometry
                        mesh.geometry.dispose();
                        mesh.geometry = decimatedGeometry;
                        
                        decimationLog += `\n📊 File ${i}: ${originalGeometry.getAttribute('position').count} → ${decimatedGeometry.getAttribute('position').count} points`;
                    }
                }
            }
            
            console.log(decimationLog);
            
            this.lastCameraDistance = avgDistance;
        }
    }
    
    // Predefined colors for different files
    private readonly fileColors: [number, number, number][] = [
        [1.0, 1.0, 1.0], // White
        [1.0, 0.0, 0.0], // Red
        [0.0, 1.0, 0.0], // Green
        [0.0, 0.0, 1.0], // Blue
        [1.0, 1.0, 0.0], // Yellow
        [1.0, 0.0, 1.0], // Magenta
        [0.0, 1.0, 1.0], // Cyan
        [1.0, 0.5, 0.0], // Orange
        [0.5, 0.0, 1.0], // Purple
        [0.0, 0.5, 0.0], // Dark Green
        [0.5, 0.5, 0.5]  // Gray
    ];

    constructor() {
        this.init();
    }

    private async init(): Promise<void> {
        try {
            this.initThreeJS();
            this.setupEventListeners();
            this.setupMessageHandler();
            
            // Request default depth settings from extension
            console.log('📤 Requesting default depth settings from extension...');
            this.vscode.postMessage({
                type: 'requestDefaultDepthSettings'
            });
        } catch (error) {
            this.showError(`Failed to initialize PLY Visualizer: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private initThreeJS(): void {
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x222222);

        // Camera
        const container = document.getElementById('viewer-container');
        if (!container) {throw new Error('Viewer container not found');}
        
        this.camera = new THREE.PerspectiveCamera(
            75,
            container.clientWidth / container.clientHeight,
            0.001,
            1000000  // Further increased far plane for disparity files
        );
        this.camera.position.set(1, 1, 1);
        
        // Initialize last camera state for change detection
        this.lastCameraPosition.copy(this.camera.position);
        this.lastCameraQuaternion.copy(this.camera.quaternion);

        // Renderer
        const canvas = document.getElementById('three-canvas') as HTMLCanvasElement;
        if (!canvas) {throw new Error('Canvas not found');}
        
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas,
            antialias: true, // Re-enable antialiasing for quality
            alpha: true,
            powerPreference: "high-performance" // Keep discrete GPU preference
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true; // Re-enable shadows
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
        // Re-enable object sorting for better visual quality
        this.renderer.sortObjects = true;
        
        // Set initial color space based on preference
        this.updateRendererColorSpace();

        // Initialize controls
        this.initializeControls();

        // Lighting
        this.initSceneLighting();

        // Add coordinate axes helper with labels
        this.addAxesHelper();

        // Window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));

        // Global UI interaction listener - triggers render on any button/input change
        document.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.tagName === 'BUTTON' || target.classList.contains('btn') || 
                target.closest('button') || target.closest('.btn')) {
                this.requestRender();
                // this.requestRender();
            }
        });
        
        document.addEventListener('input', (e) => {
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
            
            // Set up screen coordinates for proper rotation
            trackballControls.screen.left = 0;
            trackballControls.screen.top = 0;
            trackballControls.screen.width = this.renderer.domElement.clientWidth;
            trackballControls.screen.height = this.renderer.domElement.clientHeight;
        } else if (this.controlType === 'inverse-trackball') {
            this.controls = new TrackballControls(this.camera, this.renderer.domElement);
            const trackballControls = this.controls as TrackballControls;
            trackballControls.rotateSpeed = 1.0;  // Reduced to 1.0 as requested
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
            cc.worldUp.copy(this.camera.up.lengthSq() > 0 ? this.camera.up : new THREE.Vector3(0,1,0));
        } else {
            this.controls = new OrbitControls(this.camera, this.renderer.domElement);
            const orbitControls = this.controls as OrbitControls;
            orbitControls.enableDamping = true;
            orbitControls.dampingFactor = 0.2;
            orbitControls.screenSpacePanning = false;
            orbitControls.minDistance = 0.001;
            orbitControls.maxDistance = 50000;  // Increased to match camera far plane
        }
        
        // Set up axes visibility for all control types
        this.setupAxesVisibility();
        
        // Restore camera state to prevent jumps
        this.camera.position.copy(currentCameraPosition);
        this.camera.up.copy(currentUp);
        this.controls.target.copy(currentTarget);
        this.controls.update();
        
        // Update control status to highlight active button
        this.updateControlStatus();
    }

    private setupAxesVisibility(): void {
        // Track interaction state for axes visibility
        let axesHideTimeout: NodeJS.Timeout | null = null;
        
        const showAxes = () => {
            const axesGroup = (this as any).axesGroup;
            const axesPermanentlyVisible = (this as any).axesPermanentlyVisible;
            
            if (axesGroup && !axesPermanentlyVisible) {
                axesGroup.visible = true;
                
                if (axesHideTimeout) {
                    clearTimeout(axesHideTimeout);
                    axesHideTimeout = null;
                }
            }
        };
        
        const hideAxesAfterDelay = () => {
            if (axesHideTimeout) {
                clearTimeout(axesHideTimeout);
            }
            
            axesHideTimeout = setTimeout(() => {
                const axesGroup = (this as any).axesGroup;
                const axesPermanentlyVisible = (this as any).axesPermanentlyVisible;
                
                if (axesGroup && !axesPermanentlyVisible) {
                    axesGroup.visible = false;
                }
                axesHideTimeout = null;
            }, 500);
        };
        
        // Add event listeners for axes visibility based on control type
        if (this.controlType === 'trackball' || this.controlType === 'inverse-trackball' || this.controlType === 'arcball' || this.controlType === 'cloudcompare') {
            (this.controls as any).addEventListener('start', showAxes);
            (this.controls as any).addEventListener('end', hideAxesAfterDelay);
            (this.controls as any).addEventListener('change', () => this.requestRender());
        } else {
            const orbitControls = this.controls as OrbitControls;
            orbitControls.addEventListener('start', showAxes);
            orbitControls.addEventListener('end', hideAxesAfterDelay);
            orbitControls.addEventListener('change', () => this.requestRender());
        }
        
        // debug: axes visibility init

        // Initialize button state
        this.updateAxesButtonState();
        // Only mark rotation-origin button active if target is exactly at origin right now
        this.updateRotationOriginButtonState();
    }

    private setupInvertedControls(): void {
        if (this.controlType !== 'inverse-trackball') return;
        
        // TRACKBALL ROTATION DIRECTION INVERSION - Override the _rotateCamera method
        // debug: controls inversion setup
        
        const controls = this.controls as TrackballControls;
        
        // Override _rotateCamera to invert up vector rotation using quaternion.invert()
        (controls as any)._rotateCamera = function() {
            const _moveDirection = new THREE.Vector3();
            const _eyeDirection = new THREE.Vector3();
            const _objectUpDirection = new THREE.Vector3();
            const _objectSidewaysDirection = new THREE.Vector3();
            const _axis = new THREE.Vector3();
            const _quaternion = new THREE.Quaternion();
            
            _moveDirection.set(this._moveCurr.x - this._movePrev.x, this._moveCurr.y - this._movePrev.y, 0);
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
        // Create a group to hold axes and labels
        const axesGroup = new THREE.Group();
        
        // Create coordinate axes helper (X=red, Y=green, Z=blue)
        const axesHelper = new THREE.AxesHelper(1); // Size of 1 unit
        axesGroup.add(axesHelper);
        
        // Create text labels for each axis
        this.createAxisLabels(axesGroup);
        
        // Scale the axes based on the scene size once we have objects
        // For now, use a reasonable default size
        axesGroup.scale.setScalar(0.5);
        
        // Position at the rotation center (initially at origin)
        axesGroup.position.copy(this.controls.target);
        
        // Initially hide the axes
        axesGroup.visible = false;
        
        // Add to scene
        this.scene.add(axesGroup);
        
        // Store reference for updating position and size
        (this as any).axesGroup = axesGroup;
        (this as any).axesHelper = axesHelper;
    }

    private createAxisLabels(axesGroup: THREE.Group): void {
        // Function to create text texture (creates new canvas for each call)
        const createTextTexture = (text: string, color: string) => {
            // Create separate canvas for each texture
            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d')!;
            canvas.width = 256;
            canvas.height = 256;
            
            // Set text properties
            context.font = 'Bold 48px Arial';
            context.fillStyle = color;
            context.textAlign = 'center';
            context.textBaseline = 'middle';
            
            // Draw text
            context.fillText(text, canvas.width / 2, canvas.height / 2);
            
            // Create texture
            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;
            return texture;
        };
        
        // Create materials for each axis label (each gets its own canvas)
        const xTexture = createTextTexture('X', '#ff0000');
        const yTexture = createTextTexture('Y', '#00ff00'); 
        const zTexture = createTextTexture('Z', '#0080ff');
        
        const labelMaterial = (texture: THREE.Texture) => new THREE.SpriteMaterial({ 
            map: texture,
            transparent: true,
            alphaTest: 0.1
        });
        
        // Create sprite labels
        const xLabel = new THREE.Sprite(labelMaterial(xTexture));
        const yLabel = new THREE.Sprite(labelMaterial(yTexture));
        const zLabel = new THREE.Sprite(labelMaterial(zTexture));
        
        // Scale labels appropriately
        const labelScale = 0.3;
        xLabel.scale.set(labelScale, labelScale, labelScale);
        yLabel.scale.set(labelScale, labelScale, labelScale);
        zLabel.scale.set(labelScale, labelScale, labelScale);
        
        // Position labels at the end of each axis (will be scaled with the group)
        xLabel.position.set(1.2, 0, 0); // X-axis end
        yLabel.position.set(0, 1.2, 0); // Y-axis end
        zLabel.position.set(0, 0, 1.2); // Z-axis end
        
        // Add labels to the group
        axesGroup.add(xLabel);
        axesGroup.add(yLabel);
        axesGroup.add(zLabel);
        
        // Store references for potential updates
        (this as any).axisLabels = { x: xLabel, y: yLabel, z: zLabel };
    }

    private initSceneLighting(): void {
        // Remove existing lights
        const lightsToRemove = this.scene.children.filter(child => 
            child instanceof THREE.AmbientLight || child instanceof THREE.DirectionalLight || child instanceof THREE.HemisphereLight
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
            if (this.lightingMode === 'unlit') unlitBtn.classList.add('active');
            else unlitBtn.classList.remove('active');
        }
    }

    private updateRendererColorSpace(): void {
        // Always output sRGB for correct display on standard monitors
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
        // concise summary already printed elsewhere
    }

    private toggleGammaCorrection(): void {
        // Toggle whether we convert sRGB source colors to linear
        this.convertSrgbToLinear = !this.convertSrgbToLinear;
        // Keep the legacy flag loosely in sync (not used elsewhere for logic)
        this.useLinearColorSpace = !this.convertSrgbToLinear;
        const statusMessage = this.convertSrgbToLinear 
            ? 'Treat source colors as sRGB (convert to linear before shading)' 
            : 'Treat source colors as linear (no sRGB-to-linear conversion)';
        this.showStatus(statusMessage);
        this.updateGammaButtonState();
        // Rebuild color attributes to reflect new conversion setting
        this.rebuildAllColorAttributesForCurrentGammaSetting();
        this.requestRender();
        // this.requestRender();
    }

    private updateGammaButtonState(): void {
        const btn = document.getElementById('toggle-gamma-correction');
        if (!btn) return;
        // Active (blue) when we apply additional gamma (i.e., we do NOT convert input sRGB → linear)
        // This matches the UX: blue means extra gamma appearance compared to default pipeline
        if (!this.convertSrgbToLinear) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
        // Keep label text unchanged per request
    }

    private rebuildAllColorAttributesForCurrentGammaSetting(): void {
        // Update colors for all meshes based on current convertSrgbToLinear flag
        try {
            for (let i = 0; i < this.plyFiles.length && i < this.meshes.length; i++) {
                const plyData = this.plyFiles[i];
                const mesh = this.meshes[i];
                if (!mesh || !plyData || !plyData.hasColors) continue;
                const geometry = mesh.geometry as THREE.BufferGeometry;
                const positionAttr = geometry.getAttribute('position') as THREE.BufferAttribute | undefined;
                if (!positionAttr) continue;
                const vertexCount = positionAttr.count;

                let colorsFloat = new Float32Array(vertexCount * 3);
                let filled = false;

                // Prefer original byte colors when available (typed arrays path)
                const typedColors: Uint8Array | null = (plyData as any).colorsArray || null;
                if (typedColors && typedColors.length === colorsFloat.length) {
                    if (this.convertSrgbToLinear) {
                        this.ensureSrgbLUT();
                        const lut = this.srgbToLinearLUT!;
                        for (let j = 0; j < typedColors.length; j++) colorsFloat[j] = lut[typedColors[j]];
                    } else {
                        for (let j = 0; j < typedColors.length; j++) colorsFloat[j] = typedColors[j] / 255;
                    }
                    filled = true;
                }

                // Fallback: derive from per-vertex properties if present
                if (!filled && Array.isArray((plyData as any).vertices)) {
                    const verts: any[] = (plyData as any).vertices;
                    const count = Math.min(vertexCount, verts.length);
                    if (this.convertSrgbToLinear) {
                        this.ensureSrgbLUT();
                        const lut = this.srgbToLinearLUT!;
                        for (let v = 0, o = 0; v < count; v++, o += 3) {
                            const vert = verts[v];
                            const r8 = (vert.red || 0) & 255;
                            const g8 = (vert.green || 0) & 255;
                            const b8 = (vert.blue || 0) & 255;
                            colorsFloat[o] = lut[r8];
                            colorsFloat[o + 1] = lut[g8];
                            colorsFloat[o + 2] = lut[b8];
                        }
                    } else {
                        for (let v = 0, o = 0; v < count; v++, o += 3) {
                            const vert = verts[v];
                            colorsFloat[o] = ((vert.red || 0) & 255) / 255;
                            colorsFloat[o + 1] = ((vert.green || 0) & 255) / 255;
                            colorsFloat[o + 2] = ((vert.blue || 0) & 255) / 255;
                        }
                    }
                    filled = true;
                }

                if (filled) {
                    geometry.setAttribute('color', new THREE.BufferAttribute(colorsFloat, 3));
                    const colorAttr = geometry.getAttribute('color');
                    if (colorAttr) (colorAttr as any).needsUpdate = true;
                    // Ensure material uses vertex colors
                    if (mesh instanceof THREE.Points && mesh.material instanceof THREE.PointsMaterial) {
                        mesh.material.vertexColors = true;
                    }
                }
            }
        } catch (err) {
            console.warn('Gamma rebuild failed:', err);
        }
    }

    private onWindowResize(): void {
        const container = document.getElementById('viewer-container');
        if (!container) {return;}
        
        this.camera.aspect = container.clientWidth / container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        
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
    }

    private animate(): void {
        this.animationId = requestAnimationFrame(this.animate.bind(this));
        
        // Update controls
        this.controls.update();
        
        // Check if camera position or rotation has changed
        const positionChanged = !this.camera.position.equals(this.lastCameraPosition);
        const rotationChanged = !this.camera.quaternion.equals(this.lastCameraQuaternion);
        
        // Only update camera matrix and UI when camera actually changes
        if (positionChanged || rotationChanged) {
            this.updateCameraMatrix();
            this.updateCameraControlsPanel();
            
            // Apply adaptive decimation based on camera distance
            this.updateAdaptiveDecimation();
            
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
        
        // Always render when needed (this covers camera damping/momentum)
        if (this.needsRender) {
            this.renderer.render(this.scene, this.camera);
            this.needsRender = false;
        }
    }

    private requestRender(): void {
        this.needsRender = true;
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
            
            if (!isVisible) continue; // Skip if manually hidden
            
            // Check if mesh should be visible but might be culled
            if (mesh && mesh.geometry && mesh.geometry.boundingBox) {
                const box = mesh.geometry.boundingBox.clone();
                box.applyMatrix4(mesh.matrixWorld);
                
                // Simple frustum check - if bounding box is completely outside view
                const center = box.getCenter(new THREE.Vector3());
                const distanceToCamera = this.camera.position.distanceTo(center);
                
                // Check if it's within camera range
                const withinNearFar = distanceToCamera >= this.camera.near && distanceToCamera <= this.camera.far;
                
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
        // Create a matrix that represents the camera's current position and rotation
        this.cameraMatrix.identity();
        
        // Apply camera position
        const positionMatrix = new THREE.Matrix4();
        positionMatrix.makeTranslation(-this.camera.position.x, -this.camera.position.y, -this.camera.position.z);
        
        // Apply camera rotation (inverse of camera quaternion)
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationFromQuaternion(this.camera.quaternion.clone().invert());
        
        // Combine position and rotation
        this.cameraMatrix.multiply(rotationMatrix).multiply(positionMatrix);
    }

    private setTransformationMatrix(fileIndex: number, matrix: THREE.Matrix4): void {
        if (fileIndex >= 0 && fileIndex < this.transformationMatrices.length) {
            this.transformationMatrices[fileIndex].copy(matrix);
            this.applyTransformationMatrix(fileIndex);
        }
    }

    private getTransformationMatrix(fileIndex: number): THREE.Matrix4 {
        if (fileIndex >= 0 && fileIndex < this.transformationMatrices.length) {
            return this.transformationMatrices[fileIndex].clone();
        }
        return new THREE.Matrix4(); // Return identity matrix if index is invalid
    }

    private getTransformationMatrixAsArray(fileIndex: number): number[] {
        if (fileIndex >= 0 && fileIndex < this.transformationMatrices.length) {
            return this.transformationMatrices[fileIndex].elements.slice();
        }
        return new THREE.Matrix4().elements.slice(); // Return identity matrix if index is invalid
    }

    private applyTransformationMatrix(fileIndex: number): void {
        if (fileIndex < 0 || fileIndex >= this.transformationMatrices.length) return;
        
        const matrix = this.transformationMatrices[fileIndex];
        
        // Handle PLY/mesh files
        if (fileIndex < this.meshes.length) {
            const mesh = this.meshes[fileIndex];
            if (mesh) {
                mesh.matrix.copy(matrix);
                mesh.matrixAutoUpdate = false;
            }
            
            // Also apply transformation to vertex points visualization
            const vertexPoints = this.vertexPointsObjects[fileIndex];
            if (vertexPoints) {
                vertexPoints.matrix.copy(matrix);
                vertexPoints.matrixAutoUpdate = false;
            }
            
            // Also apply transformation to normals visualizer
            const normalsVisualizer = this.normalsVisualizers[fileIndex];
            if (normalsVisualizer) {
                normalsVisualizer.matrix.copy(matrix);
                normalsVisualizer.matrixAutoUpdate = false;
            }
            
            // Also apply transformation to multi-material groups (for OBJ files)
            const multiMaterialGroup = this.multiMaterialGroups[fileIndex];
            if (multiMaterialGroup) {
                multiMaterialGroup.matrix.copy(matrix);
                multiMaterialGroup.matrixAutoUpdate = false;
            }
            
            return;
        }
        
        // Handle poses
        const poseIndex = fileIndex - this.plyFiles.length;
        if (poseIndex >= 0 && poseIndex < this.poseGroups.length) {
            const group = this.poseGroups[poseIndex];
            if (group) {
                group.matrix.copy(matrix);
                group.matrixAutoUpdate = false;
            }
            return;
        }
        
        // Handle cameras
        const cameraIndex = fileIndex - this.plyFiles.length - this.poseGroups.length;
        if (cameraIndex >= 0 && cameraIndex < this.cameraGroups.length) {
            const group = this.cameraGroups[cameraIndex];
            if (group) {
                // Apply transformation matrix to camera profile group
                group.matrix.copy(matrix);
                group.matrixAutoUpdate = false;
                
                // Apply scaling only to visual elements, not position
                const size = this.pointSizes[fileIndex] ?? 1.0;
                this.applyCameraScale(cameraIndex, size);
            }
        }
    }

    private resetTransformationMatrix(fileIndex: number): void {
        if (fileIndex >= 0 && fileIndex < this.transformationMatrices.length) {
            this.transformationMatrices[fileIndex].identity();
            this.applyTransformationMatrix(fileIndex);
        }
    }

    private createRotationMatrix(axis: 'x' | 'y' | 'z', angle: number): THREE.Matrix4 {
        const matrix = new THREE.Matrix4();
        switch (axis) {
            case 'x':
                matrix.makeRotationX(angle);
                break;
            case 'y':
                matrix.makeRotationY(angle);
                break;
            case 'z':
                matrix.makeRotationZ(angle);
                break;
        }
        return matrix;
    }

    private createTranslationMatrix(x: number, y: number, z: number): THREE.Matrix4 {
        const matrix = new THREE.Matrix4();
        matrix.makeTranslation(x, y, z);
        return matrix;
    }

    private createQuaternionMatrix(x: number, y: number, z: number, w: number): THREE.Matrix4 {
        const quaternion = new THREE.Quaternion(x, y, z, w);
        quaternion.normalize();
        const matrix = new THREE.Matrix4();
        matrix.makeRotationFromQuaternion(quaternion);
        return matrix;
    }

    private createAngleAxisMatrix(axis: THREE.Vector3, angle: number): THREE.Matrix4 {
        const quaternion = new THREE.Quaternion();
        quaternion.setFromAxisAngle(axis.normalize(), angle);
        const matrix = new THREE.Matrix4();
        matrix.makeRotationFromQuaternion(quaternion);
        return matrix;
    }

    private parseSpaceSeparatedValues(input: string): number[] {
        if (!input.trim()) {
            return [];
        }
        
        // Remove brackets, parentheses, and normalize whitespace/separators
        let cleaned = input
            .replace(/[\[\](){}]/g, '') // Remove brackets/parentheses
            .replace(/[,;]/g, ' ')      // Replace commas/semicolons with spaces
            .replace(/\s+/g, ' ')       // Normalize multiple spaces to single
            .trim();
        
        // Split by spaces and parse numbers
        return cleaned.split(' ')
            .map(s => parseFloat(s))
            .filter(n => !isNaN(n));
    }

    private multiplyTransformationMatrices(fileIndex: number, matrix: THREE.Matrix4): void {
        if (fileIndex >= 0 && fileIndex < this.transformationMatrices.length) {
            this.transformationMatrices[fileIndex].multiply(matrix);
            this.applyTransformationMatrix(fileIndex);
        }
    }

    private addTranslationToMatrix(fileIndex: number, x: number, y: number, z: number): void {
        if (fileIndex >= 0 && fileIndex < this.transformationMatrices.length) {
            const translationMatrix = this.createTranslationMatrix(x, y, z);
            this.multiplyTransformationMatrices(fileIndex, translationMatrix);
        }
    }

    private updateMatrixTextarea(fileIndex: number): void {
        const textarea = document.getElementById(`matrix-${fileIndex}`) as HTMLTextAreaElement;
        if (textarea) {
            const matrixArr = this.getTransformationMatrixAsArray(fileIndex);
            let matrixStr = '';
            // Three.js stores matrices in column-major order: [m00, m10, m20, m30, m01, m11, m21, m31, m02, m12, m22, m32, m03, m13, m23, m33]
            // Display in row-major order to match the input format: each row should be [m0r, m1r, m2r, m3r]
            for (let row = 0; row < 4; ++row) {
                const displayRow = [
                    matrixArr[row],           // m0r (column r, row 0)
                    matrixArr[row + 4],       // m1r (column r, row 1)
                    matrixArr[row + 8],       // m2r (column r, row 2)
                    matrixArr[row + 12]       // m3r (column r, row 3)
                ].map(v => {
                    // Format numbers consistently: 6 decimal places, no padding
                    return v.toFixed(6);
                });
                matrixStr += displayRow.join(' ') + '\n';
            }
            textarea.value = matrixStr.trim();
            // debug: matrix display updated
        }
    }

    private updateCameraMatrixDisplay(): void {
        // Camera matrix is now displayed in the camera controls panel
        // This method is kept for compatibility but doesn't display anything
    }

    private updateCameraControlsPanel(): void {
        const controlsPanel = document.getElementById('camera-controls-panel');
        if (controlsPanel) {
            // Show simple camera position and rotation instead of complex matrix
            const pos = this.camera.position;
            
            // Get rotation from quaternion to handle all camera operations consistently
            const euler = new THREE.Euler();
            euler.setFromQuaternion(this.camera.quaternion, 'XYZ');
            const rotX = (euler.x * 180 / Math.PI);
            const rotY = (euler.y * 180 / Math.PI);
            const rotZ = (euler.z * 180 / Math.PI);
            
            // Only update the matrix display, not the entire panel
            const matrixDisplay = controlsPanel.querySelector('.matrix-display');
            if (matrixDisplay) {
                // Get rotation center (controls target)
                const target = this.controls.target;
                let matrixHtml = `
                    <div style="font-size:10px;margin:4px 0;">
                        <div><strong>Position:</strong> (${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)})</div>
                        <div><strong>Rotation:</strong> (${rotX.toFixed(1)}°, ${rotY.toFixed(1)}°, ${rotZ.toFixed(1)}°)</div>
                        <div><strong>Rotation Center:</strong> (${target.x.toFixed(3)}, ${target.y.toFixed(3)}, ${target.z.toFixed(3)})</div>
                    </div>
                `;
                matrixDisplay.innerHTML = matrixHtml;
            } else {
                // First time setup - create the entire panel
                let html = `
                    <div class="camera-controls-section">
                        <label style="font-size:10px;">Field of View:</label><br>
                        <input type="range" id="camera-fov" min="10" max="150" step="1" value="${this.camera.fov}" style="width:100%;margin:2px 0;">
                        <span id="fov-value" style="font-size:10px;">${this.camera.fov.toFixed(1)}°</span>
                    </div>
                    
                    <div class="camera-controls-section">
                        <label style="font-size:10px;font-weight:bold;">Camera Position & Rotation:</label>
                        <div class="matrix-display">
                            <div style="font-size:10px;margin:4px 0;">
                                <div><strong>Position:</strong> (${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)})</div>
                                <div><strong>Rotation:</strong> (${rotX.toFixed(1)}°, ${rotY.toFixed(1)}°, ${rotZ.toFixed(1)}°)</div>
                                <div><strong>Rotation Center:</strong> (${this.controls.target.x.toFixed(3)}, ${this.controls.target.y.toFixed(3)}, ${this.controls.target.z.toFixed(3)})</div>
                            </div>
                        </div>
                        <div style="display:flex;gap:4px;margin-top:4px;">
                            <button id="modify-camera-position" class="control-button" style="flex:1;font-size:9px;">Modify Position</button>
                        </div>
                        <div style="display:flex;gap:4px;margin-top:4px;">
                            <button id="modify-camera-rotation" class="control-button" style="flex:1;font-size:9px;">Modify Rotation</button>
                        </div>
                        <div style="display:flex;gap:4px;margin-top:4px;">
                            <button id="modify-rotation-center" class="control-button" style="flex:1;font-size:9px;">Modify Rotation Center</button>
                        </div>
                        <button id="reset-camera-matrix" class="control-button" style="margin-top:12px;">Reset Camera</button>
                    </div>
                `;
                
                controlsPanel.innerHTML = html;

                // Add event listeners only once
                this.setupCameraControlEventListeners('');
            }
        }
    }

    private setupCameraControlEventListeners(matrixStr: string): void {
        const fovSlider = document.getElementById('camera-fov') as HTMLInputElement;
        const fovValue = document.getElementById('fov-value');
        if (fovSlider && fovValue) {
            fovSlider.addEventListener('input', (e) => {
                const newFov = parseFloat((e.target as HTMLInputElement).value);
                this.camera.fov = newFov;
                this.camera.updateProjectionMatrix();
                if (fovValue) {
                    fovValue.textContent = newFov.toFixed(1) + '°';
                }
                this.requestRender();
                // this.requestRender();
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
        // Reset camera to default position and orientation
        this.camera.position.set(1, 1, 1);
        
        // Reset quaternion to identity (no rotation)
        this.camera.quaternion.set(0, 0, 0, 1);
        
        this.camera.fov = 75;
        this.camera.updateProjectionMatrix();
        
        // Reset controls
        this.controls.target.set(0, 0, 0);
        this.controls.update();
        
        // Update last known camera state to prevent unnecessary UI updates
        this.lastCameraPosition.copy(this.camera.position);
        this.lastCameraQuaternion.copy(this.camera.quaternion);
        
        // Force update camera matrix and UI
        this.updateCameraMatrix();
        this.updateCameraControlsPanel();
    }

    private setRotationCenterToOrigin(): void {
        // Set rotation center (target) to origin (0, 0, 0)
        this.controls.target.set(0, 0, 0);
        this.controls.update();
        
        // Update axes position to the new rotation center
        const axesGroup = (this as any).axesGroup;
        if (axesGroup) {
            axesGroup.position.copy(this.controls.target);
        }
        
        // Show axes temporarily to indicate new rotation center
        const showAxesTemporarily = (this as any).showAxesTemporarily;
        if (showAxesTemporarily) {
            showAxesTemporarily();
        }
        
        // debug
        this.updateRotationOriginButtonState();
    }

    private onDoubleClick(event: MouseEvent): void {
        // Convert mouse coordinates to normalized device coordinates (-1 to +1)
        const canvas = this.renderer.domElement;
        const rect = canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Create raycaster
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);
        
        // Progressive threshold approach for double-click detection
        const validPointSizes = this.pointSizes.filter(size => size > 0);
        const maxPointSize = validPointSizes.length > 0 ? Math.max(...validPointSizes) : 0.001;
        
        // Find intersections with all visible meshes
        const visibleMeshes = this.meshes.filter((mesh, index) => this.fileVisibility[index]);
        
        // Debug camera and ray information
        // debug: camera/mouse
        
        // Debug visible meshes
        visibleMeshes.forEach((mesh, index) => {
            const realIndex = this.meshes.indexOf(mesh);
            const geometry = mesh.geometry as THREE.BufferGeometry;
            const positionAttribute = geometry.getAttribute('position');
            const pointCount = positionAttribute ? positionAttribute.count : 0;
            // debug: mesh info
        });
        
        // Try progressive thresholds until we find an intersection
        const thresholds = [
            Math.max(maxPointSize * 10, 0.001), // Start with point-size based threshold
            0.01,  // Small threshold
            0.05,  // Medium threshold  
            0.1,   // Larger threshold
            0.5,   // Large threshold
            2.0    // Very large threshold for distant point clouds
        ];
        
        let intersects: THREE.Intersection[] = [];
        let usedThreshold = 0;
        
        for (const threshold of thresholds) {
            raycaster.params.Points.threshold = threshold;
            intersects = raycaster.intersectObjects(visibleMeshes, false);
            usedThreshold = threshold;
            
            // debug: intersection threshold
            
            if (intersects.length > 0) {
                // debug: success threshold
                break;
            }
        }
        
        // debug: final intersections result

        if (intersects.length > 0) {
            // debug list
            intersects.forEach((intersect, i) => {
                // debug details
            });
            // Get the closest intersection point
            const intersectionPoint = intersects[0].point;
            
            // Check if the point is too close to the camera
            const distance = this.camera.position.distanceTo(intersectionPoint);
            const minDistance = 0.005; // Very small minimum distance
            
            if (distance < minDistance) {
                // debug
                return; // Don't set rotation center for points too close
            }
            
            // Set this point as the new rotation center
            this.setRotationCenter(intersectionPoint);
            
            // debug
            this.updateRotationOriginButtonState();
        }
    }

    private setRotationCenter(point: THREE.Vector3): void {
        // Check if the point is too close to the camera or behind it
        const cameraToPoint = point.clone().sub(this.camera.position);
        const distance = cameraToPoint.length();
        const minDistance = 0.01; // Minimum distance to prevent issues
        
        // If point is too close or behind camera, adjust it
        if (distance < minDistance) {
            // debug
            
            // Move the point away from camera along the camera's forward direction
            const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(this.camera.quaternion);
            const adjustedPoint = this.camera.position.clone().add(cameraDirection.multiplyScalar(minDistance));
            
            // Set the adjusted point as rotation center
            this.controls.target.copy(adjustedPoint);
            
            // Update axes position
            const axesGroup = (this as any).axesGroup;
            if (axesGroup) {
                axesGroup.position.copy(adjustedPoint);
            }
            
            // debug
            this.updateRotationOriginButtonState();
        } else {
            // Point is at a safe distance, use it directly
            this.controls.target.copy(point);
            
            // Update axes position to the new rotation center
            const axesGroup = (this as any).axesGroup;
            if (axesGroup) {
                axesGroup.position.copy(point);
            }
            
            // debug
            this.updateRotationOriginButtonState();
        }
        
        // Show axes temporarily for 1 second to indicate new rotation center
        const showAxesTemporarily = (this as any).showAxesTemporarily;
        if (showAxesTemporarily) {
            showAxesTemporarily();
        }
        
        // Update controls
        this.controls.update();
        
        // Visual feedback
        this.showRotationCenterFeedback(this.controls.target);
    }

    private showRotationCenterFeedback(point: THREE.Vector3): void {
        // Create a temporary visual indicator at the rotation center
        const geometry = new THREE.SphereGeometry(0.01, 8, 6);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0xff0000, 
            transparent: true, 
            opacity: 0.8 
        });
        const sphere = new THREE.Mesh(geometry, material);
        sphere.position.copy(point);
        
        this.scene.add(sphere);
        
        // Remove the indicator after 2 seconds
        setTimeout(() => {
            this.scene.remove(sphere);
            geometry.dispose();
            material.dispose();
        }, 2000);
    }

    private createGeometryFromPlyData(data: PlyData): THREE.BufferGeometry {
        const geometry = new THREE.BufferGeometry();
        
        const startTime = performance.now();
        
        // Check if we have direct TypedArrays (new ultra-fast path)
        if ((data as any).useTypedArrays) {
            
            const positions = (data as any).positionsArray as Float32Array;
            const colors = (data as any).colorsArray as Uint8Array | null;
            const normals = (data as any).normalsArray as Float32Array | null;
            
            // Direct assignment - zero copying, zero processing!
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            
            if (colors && data.hasColors) {
                const colorFloats = new Float32Array(colors.length);
                if (this.convertSrgbToLinear) {
                    this.ensureSrgbLUT();
                    const lut = this.srgbToLinearLUT!;
                    for (let i = 0; i < colors.length; i++) {
                        colorFloats[i] = lut[colors[i]];
                    }
                } else {
                    for (let i = 0; i < colors.length; i++) {
                        colorFloats[i] = colors[i] / 255;
                    }
                }
                geometry.setAttribute('color', new THREE.BufferAttribute(colorFloats, 3));
            }
            
            if (normals && data.hasNormals) {
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
                        this.ensureSrgbLUT();
                        const lut = this.srgbToLinearLUT!;
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

            if (normals) {
                geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
            }
        }

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
        // Add file button
        const addFileBtn = document.getElementById('add-file');
        if (addFileBtn) {
            addFileBtn.addEventListener('click', () => {
                this.requestAddFile();
            });
        }

        // Sequence controls (overlay)
        const playBtn = document.getElementById('seq-play');
        const pauseBtn = document.getElementById('seq-pause');
        const stopBtn = document.getElementById('seq-stop');
        const prevBtn = document.getElementById('seq-prev');
        const nextBtn = document.getElementById('seq-next');
        const slider = document.getElementById('seq-slider') as HTMLInputElement | null;
        if (playBtn) playBtn.addEventListener('click', () => this.playSequence());
        if (pauseBtn) pauseBtn.addEventListener('click', () => this.pauseSequence());
        if (stopBtn) stopBtn.addEventListener('click', () => this.stopSequence());
        if (prevBtn) prevBtn.addEventListener('click', () => this.stepSequence(-1));
        if (nextBtn) nextBtn.addEventListener('click', () => this.stepSequence(1));
        if (slider) slider.addEventListener('input', () => this.seekSequence(parseInt(slider.value, 10) || 0));

        // Tab navigation
        const tabButtons = document.querySelectorAll('.tab-button');
        tabButtons.forEach(button => {
            button.addEventListener('click', (e) => {
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
                if (!this.sequenceMode) this.fitCameraToAllObjects();
            });
        }

        const resetCameraBtn = document.getElementById('reset-camera');
        if (resetCameraBtn) {
            resetCameraBtn.addEventListener('click', () => {
                if (!this.sequenceMode) this.resetCameraToDefault();
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

        // Camera convention buttons
        const opencvBtn = document.getElementById('opencv-convention');
        if (opencvBtn) {
            opencvBtn.addEventListener('click', () => {
                this.setOpenCVCameraConvention();
            });
        }

        const openglBtn = document.getElementById('opengl-convention');
        if (openglBtn) {
            openglBtn.addEventListener('click', () => {
                this.setOpenGLCameraConvention();
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

        // Arcball settings UI removed per request

        // Color settings
        const toggleGammaCorrectionBtn = document.getElementById('toggle-gamma-correction');
        if (toggleGammaCorrectionBtn) {
            toggleGammaCorrectionBtn.addEventListener('click', () => {
                this.toggleGammaCorrection();
                this.updateGammaButtonState();
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

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when not typing in input fields
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
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
                    e.preventDefault();
                    break;
                case 'b':
                    this.setOpenGLCameraConvention();
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
                case 'l': // legacy handedness toggle kept for convenience
                    if (this.controlType === 'arcball') {
                        const arc = this.controls as any;
                        if (arc) { arc.invertRotation = !arc.invertRotation; }
                        this.showStatus(`Arcball invertRotation: ${arc && arc.invertRotation ? 'On' : 'Off'}`);
                        e.preventDefault();
                    }
                    break;
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
                case 'l':
                    this.arcballInvertRotation = !this.arcballInvertRotation;
                    if (this.controlType === 'arcball') {
                        const arc = this.controls as any;
                        if (arc && typeof arc.invertRotation === 'boolean') {
                            arc.invertRotation = this.arcballInvertRotation;
                        }
                    }
                    this.showStatus(`Arcball handedness: ${this.arcballInvertRotation ? 'Inverted' : 'Normal'}`);
                    e.preventDefault();
                    break;
            }
        });

        // Depth control handlers are now handled per-file in updateFileList

        // Global color mode toggle (removed - now handled per file)
    }

    private initializeSequence(files: string[], wildcard: string): void {
        this.sequenceMode = true;
        this.sequenceFiles = files;
        this.sequenceIndex = 0;
        this.sequenceTargetIndex = 0;
        this.sequenceDidInitialFit = false;
        this.isSequencePlaying = false;
        this.sequenceCache.clear();
        this.sequenceCacheOrder = [];
        // Show overlay
        document.getElementById('sequence-overlay')?.classList.remove('hidden');
        const wildcardInput = document.getElementById('seq-wildcard') as HTMLInputElement | null;
        if (wildcardInput) wildcardInput.value = wildcard;
        this.updateSequenceUI();
        // Clear any existing meshes from normal mode
        for (const obj of this.meshes) this.scene.remove(obj);
        this.meshes = [];
        this.plyFiles = [];
        // Load first frame
        if (files.length > 0) this.loadSequenceFrame(0);
        this.updateFileList();
    }

    private updateSequenceUI(): void {
        const slider = document.getElementById('seq-slider') as HTMLInputElement | null;
        const label = document.getElementById('seq-label') as HTMLElement | null;
        if (slider) {
            slider.max = Math.max(0, this.sequenceFiles.length - 1).toString();
            slider.value = Math.min(this.sequenceIndex, this.sequenceFiles.length ? this.sequenceFiles.length - 1 : 0).toString();
        }
        if (label) {
            label.textContent = `${this.sequenceFiles.length ? this.sequenceIndex + 1 : 0} / ${this.sequenceFiles.length}`;
        }
    }

    private playSequence(): void {
        if (!this.sequenceFiles.length) return;
        if (this.isSequencePlaying) return;
        this.isSequencePlaying = true;
        const intervalMs = Math.max(50, Math.floor(1000 / this.sequenceFps));
        this.sequenceTimer = window.setInterval(() => {
            const nextIndex = (this.sequenceIndex + 1) % this.sequenceFiles.length;
            this.seekSequence(nextIndex);
        }, intervalMs) as unknown as number;
    }

    private pauseSequence(): void {
        this.isSequencePlaying = false;
        if (this.sequenceTimer !== null) {
            window.clearInterval(this.sequenceTimer as unknown as number);
            this.sequenceTimer = null;
        }
    }
    private stopSequence(): void {
        this.pauseSequence();
    }

    private stepSequence(delta: number): void {
        if (!this.sequenceFiles.length) return;
        this.pauseSequence(); // do not auto-play when stepping
        const count = this.sequenceFiles.length;
        const next = (this.sequenceIndex + delta + count) % count;
        this.seekSequence(next);
    }

    private seekSequence(index: number): void {
        if (!this.sequenceFiles.length) return;
        const clamped = Math.max(0, Math.min(index, this.sequenceFiles.length - 1));
        this.sequenceTargetIndex = clamped;
        this.loadSequenceFrame(clamped);
    }

    private async sequenceHandleUltimate(message: any): Promise<void> {
        const plyMsg = { ...message, type: 'ultimateRawBinaryData', messageType: 'addFiles' };
        const startFilesLen = this.plyFiles.length;
        await this.handleUltimateRawBinaryData(plyMsg);
        const created = this.meshes[this.meshes.length - 1];
        if (created) {
            if (message.index === this.sequenceTargetIndex) this.useSequenceObject(created, message.index);
            else this.cacheSequenceOnly(created, message.index);
        }
        this.trimNormalModeArraysFrom(startFilesLen);
    }

    private async sequenceHandlePly(message: any): Promise<void> {
        const startFilesLen = this.plyFiles.length;
        await this.displayFiles([message.data]);
        const created = this.meshes[this.meshes.length - 1];
        if (created) {
            if (message.index === this.sequenceTargetIndex) this.useSequenceObject(created, message.index);
            else this.cacheSequenceOnly(created, message.index);
        }
        this.trimNormalModeArraysFrom(startFilesLen);
    }

    private async sequenceHandleXyz(message: any): Promise<void> {
        const startFilesLen = this.plyFiles.length;
        await this.handleXyzData({ type: 'xyzData', fileName: message.fileName, data: message.data, isAddFile: true });
        const created = this.meshes[this.meshes.length - 1];
        if (created) {
            if (message.index === this.sequenceTargetIndex) this.useSequenceObject(created, message.index);
            else this.cacheSequenceOnly(created, message.index);
        }
        this.trimNormalModeArraysFrom(startFilesLen);
    }

    private async sequenceHandleObj(message: any): Promise<void> {
        const startFilesLen = this.plyFiles.length;
        await this.handleObjData({ type: 'objData', fileName: message.fileName, data: message.data, isAddFile: true });
        const created = this.meshes[this.meshes.length - 1];
        if (created) {
            if (message.index === this.sequenceTargetIndex) this.useSequenceObject(created, message.index);
            else this.cacheSequenceOnly(created, message.index);
        }
        this.trimNormalModeArraysFrom(startFilesLen);
    }

    private async sequenceHandleStl(message: any): Promise<void> {
        const startFilesLen = this.plyFiles.length;
        await this.handleStlData({ type: 'stlData', fileName: message.fileName, data: message.data, isAddFile: true });
        const created = this.meshes[this.meshes.length - 1];
        if (created) {
            if (message.index === this.sequenceTargetIndex) this.useSequenceObject(created, message.index);
            else this.cacheSequenceOnly(created, message.index);
        }
        this.trimNormalModeArraysFrom(startFilesLen);
    }

    private async sequenceHandleDepth(message: any): Promise<void> {
        const startFilesLen = this.plyFiles.length;
        await this.handleDepthData({ type: 'depthData', fileName: message.fileName, data: message.data, isAddFile: true });
        const created = this.meshes[this.meshes.length - 1];
        if (created) this.useSequenceObject(created, message.index);
        this.trimNormalModeArraysFrom(startFilesLen);
    }

    private trimNormalModeArraysFrom(startIndex: number): void {
        if (this.plyFiles.length > startIndex) this.plyFiles.splice(startIndex);
        if (this.multiMaterialGroups.length > startIndex) this.multiMaterialGroups.splice(startIndex);
        if (this.materialMeshes.length > startIndex) this.materialMeshes.splice(startIndex);
        if (this.fileVisibility.length > startIndex) this.fileVisibility.splice(startIndex);
        if (this.pointSizes.length > startIndex) this.pointSizes.splice(startIndex);
        if (this.individualColorModes.length > startIndex) this.individualColorModes.splice(startIndex);
    }

    private async loadSequenceFrame(index: number): Promise<void> {
        const filePath = this.sequenceFiles[index];
        if (!filePath) return;
        // If cached, display immediately
        const cached = this.sequenceCache.get(index);
        if (cached) {
            this.swapSequenceObject(cached, index);
            return;
        }
        // If a request is in-flight and for a different index, let it finish but ignore on arrival
        const requestId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        // Request from extension with requestId for matching
        this.vscode.postMessage({ type: 'sequence:requestFile', path: filePath, index, requestId });
        // Show a lightweight loading hint
        try { (document.getElementById('loading') as HTMLElement)?.classList.remove('hidden'); } catch {}
    }

    private useSequenceObject(obj: THREE.Object3D, index: number): void {
        // Cache management
        if (!this.sequenceCache.has(index)) {
            this.sequenceCache.set(index, obj);
            this.sequenceCacheOrder.push(index);
            // Evict if over capacity
            while (this.sequenceCacheOrder.length > this.maxSequenceCache) {
                const evictIndex = this.sequenceCacheOrder.shift()!;
                if (evictIndex !== this.sequenceIndex) {
                    const evictObj = this.sequenceCache.get(evictIndex);
                    if (evictObj) {
                        this.scene.remove(evictObj);
                        if ((evictObj as any).geometry) (evictObj as any).geometry.dispose?.();
                        if ((evictObj as any).material) {
                            const mat = (evictObj as any).material;
                            if (Array.isArray(mat)) mat.forEach(m => m.dispose?.()); else mat.dispose?.();
                        }
                    }
                    this.sequenceCache.delete(evictIndex);
                }
            }
        }
        this.swapSequenceObject(obj, index);
    }

    private cacheSequenceOnly(obj: THREE.Object3D, index: number): void {
        if (obj.parent) this.scene.remove(obj);
        if (!this.sequenceCache.has(index)) {
            this.sequenceCache.set(index, obj);
            this.sequenceCacheOrder.push(index);
            while (this.sequenceCacheOrder.length > this.maxSequenceCache) {
                const evictIndex = this.sequenceCacheOrder.shift()!;
                const evictObj = this.sequenceCache.get(evictIndex);
                if (evictObj) {
                    this.scene.remove(evictObj);
                    if ((evictObj as any).geometry) (evictObj as any).geometry.dispose?.();
                    if ((evictObj as any).material) {
                        const mat = (evictObj as any).material;
                        if (Array.isArray(mat)) mat.forEach(m => m.dispose?.()); else mat.dispose?.();
                    }
                }
                this.sequenceCache.delete(evictIndex);
            }
        }
    }

    private swapSequenceObject(obj: THREE.Object3D, index: number): void {
        // Remove current
        const current = this.sequenceCache.get(this.sequenceIndex);
        if (current && current !== obj) {
            current.visible = false;
            this.scene.remove(current);
        }
        // Add new
        if (!obj.parent) this.scene.add(obj);
        obj.visible = true;
        // Hide axes when new object is added to rule out looking-only-at-axes confusion
        try { (this as any).axesGroup.visible = true; } catch {}
        
        this.requestRender();
        this.sequenceIndex = index;
        // Make points clearly visible in sequence mode
        this.ensureSequenceVisibility(obj);
        // Fit camera only once on the first visible frame
        if (!this.sequenceDidInitialFit) {
            this.fitCameraToObject(obj);
            this.sequenceDidInitialFit = true;
        }
        this.updateSequenceUI();
        this.updateFileList();
        // Hide loading if it was shown
        try { (document.getElementById('loading') as HTMLElement)?.classList.add('hidden'); } catch {}
        // Preload next
        const next = (index + 1) % this.sequenceFiles.length;
        const nextPath = this.sequenceFiles[next] || '';
        const isDepth = /\.(tif|tiff|pfm|npy|npz|png|exr)$/i.test(nextPath);
        if (!isDepth && !this.sequenceCache.get(next)) {
            this.vscode.postMessage({ type: 'sequence:requestFile', path: nextPath, index: next });
        }
    }

    private ensureSequenceVisibility(obj: THREE.Object3D): void {
        if ((obj as any).isPoints && (obj as any).material && (obj as any).material instanceof THREE.PointsMaterial) {
            const mat = (obj as any).material as THREE.PointsMaterial;
            // Use a sensible on-screen size for sequence mode; avoid tiny defaults
            if (!mat.size || mat.size < 0.5) {
                mat.size = 2.5;
            }
            // Use screen-space size for clarity regardless of distance
            mat.sizeAttenuation = false;
            mat.needsUpdate = true;
        }
    }

    private fitCameraToObject(obj: THREE.Object3D): void {
        const box = new THREE.Box3().setFromObject(obj);
        if (!box.isEmpty()) {
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = this.camera.fov * (Math.PI / 180);
            const distance = (maxDim / 2) / Math.tan(fov / 2) * 1.5;

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

    private getDepthSettingsFromFileUI(fileIndex: number): CameraParams {
        const cameraModelSelect = document.getElementById(`camera-model-${fileIndex}`) as HTMLSelectElement;
        const fxInput = document.getElementById(`fx-${fileIndex}`) as HTMLInputElement;
        const fyInput = document.getElementById(`fy-${fileIndex}`) as HTMLInputElement;
        const cxInput = document.getElementById(`cx-${fileIndex}`) as HTMLInputElement;
        const cyInput = document.getElementById(`cy-${fileIndex}`) as HTMLInputElement;
        const depthTypeSelect = document.getElementById(`depth-type-${fileIndex}`) as HTMLSelectElement;
        const baselineInput = document.getElementById(`baseline-${fileIndex}`) as HTMLInputElement;
        const disparityOffsetInput = document.getElementById(`disparity-offset-${fileIndex}`) as HTMLInputElement;
        const depthScaleInput = document.getElementById(`depth-scale-${fileIndex}`) as HTMLInputElement;
        const depthBiasInput = document.getElementById(`depth-bias-${fileIndex}`) as HTMLInputElement;
        const conventionSelect = document.getElementById(`convention-${fileIndex}`) as HTMLSelectElement;
        const pngScaleFactorInput = document.getElementById(`png-scale-factor-${fileIndex}`) as HTMLInputElement;
        
        // Get distortion coefficient inputs
        const k1Input = document.getElementById(`k1-${fileIndex}`) as HTMLInputElement;
        const k2Input = document.getElementById(`k2-${fileIndex}`) as HTMLInputElement;
        const k3Input = document.getElementById(`k3-${fileIndex}`) as HTMLInputElement;
        const k4Input = document.getElementById(`k4-${fileIndex}`) as HTMLInputElement;
        const k5Input = document.getElementById(`k5-${fileIndex}`) as HTMLInputElement;
        const p1Input = document.getElementById(`p1-${fileIndex}`) as HTMLInputElement;
        const p2Input = document.getElementById(`p2-${fileIndex}`) as HTMLInputElement;

        const cx = cxInput?.value && cxInput.value.trim() !== '' ? parseFloat(cxInput.value) : undefined; // Will be auto-calculated if not provided
        const cy = cyInput?.value && cyInput.value.trim() !== '' ? parseFloat(cyInput.value) : undefined; // Will be auto-calculated if not provided 
        const fx = parseFloat(fxInput?.value || '1000');
        const fyValue = fyInput?.value?.trim();
        const fy = fyValue && fyValue !== '' ? parseFloat(fyValue) : undefined;
        
        // Parse distortion coefficients (only if they have values)
        const k1 = k1Input?.value && k1Input.value.trim() !== '' ? parseFloat(k1Input.value) : undefined;
        const k2 = k2Input?.value && k2Input.value.trim() !== '' ? parseFloat(k2Input.value) : undefined;
        const k3 = k3Input?.value && k3Input.value.trim() !== '' ? parseFloat(k3Input.value) : undefined;
        const k4 = k4Input?.value && k4Input.value.trim() !== '' ? parseFloat(k4Input.value) : undefined;
        const k5 = k5Input?.value && k5Input.value.trim() !== '' ? parseFloat(k5Input.value) : undefined;
        const p1 = p1Input?.value && p1Input.value.trim() !== '' ? parseFloat(p1Input.value) : undefined;
        const p2 = p2Input?.value && p2Input.value.trim() !== '' ? parseFloat(p2Input.value) : undefined;
        
        // Log the focal length and principle point values read from form
        console.log(`📐 Reading camera parameters from form for file ${fileIndex}:
   Focal lengths: fx = ${fx}, fy = ${fy || 'same as fx'}
   Principle point: cx = ${cx}, cy = ${cy}
   Distortion coefficients: k1=${k1}, k2=${k2}, k3=${k3}, k4=${k4}, k5=${k5}, p1=${p1}, p2=${p2}`);
        
        return {
            cameraModel: (cameraModelSelect?.value as any) || 'pinhole-ideal',
            fx: fx,
            fy: fy,
            cx: cx,
            cy: cy,
            depthType: (depthTypeSelect?.value as 'euclidean' | 'orthogonal' | 'disparity' | 'inverse_depth') || 'euclidean',
            baseline: depthTypeSelect?.value === 'disparity' ? parseFloat(baselineInput?.value || '120') : undefined,
            disparityOffset: depthTypeSelect?.value === 'disparity' ? parseFloat(disparityOffsetInput?.value || '0') : undefined,
            depthScale: depthScaleInput?.value ? parseFloat(depthScaleInput.value) : undefined,
            depthBias: depthBiasInput?.value ? parseFloat(depthBiasInput.value) : undefined,
            convention: (conventionSelect?.value as 'opengl' | 'opencv') || 'opengl',
            pngScaleFactor: pngScaleFactorInput ? parseFloat(pngScaleFactorInput.value || '1000') || 1000 : undefined,
            k1: k1,
            k2: k2,
            k3: k3,
            k4: k4,
            k5: k5,
            p1: p1,
            p2: p2
        };
    }

    private rebuildAllPlyMaterials(): void {
        for (let i = 0; i < this.meshes.length && i < this.plyFiles.length; i++) {
            const data = this.plyFiles[i];
            const mesh = this.meshes[i];
            if (!data || !mesh) { continue; }
            // Only update triangle meshes, not points or line segments
            const isTriangleMesh = (mesh.type === 'Mesh') && !(mesh as any).isLineSegments;
            if (!isTriangleMesh) { continue; }
            const oldMaterial = (mesh as any).material as THREE.Material | THREE.Material[] | undefined;
            const newMaterial = this.createMaterialForFile(data, i);
            (mesh as any).material = newMaterial;
            if (oldMaterial) {
                if (Array.isArray(oldMaterial)) { oldMaterial.forEach(m => m.dispose()); }
                else { oldMaterial.dispose(); }
            }
        }
        // Trigger a single render after material changes
        try { (this as any).renderOnce?.(); } catch {}
    }

    private switchTab(tabName: string): void {
        // Remove active class from all tabs and panels
        document.querySelectorAll('.tab-button').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelectorAll('.tab-panel').forEach(panel => {
            panel.classList.remove('active');
        });

        // Add active class to selected tab and panel
        const activeTabBtn = document.querySelector(`[data-tab="${tabName}"]`);
        const activePanel = document.getElementById(`${tabName}-tab`);
        
        if (activeTabBtn) {
            activeTabBtn.classList.add('active');
        }
        if (activePanel) {
            activePanel.classList.add('active');
        }
    }

    private toggleAxesVisibility(): void {
        const axesGroup = (this as any).axesGroup;
        if (!axesGroup) return;

        // Flip persistent visibility flag
        this.axesPermanentlyVisible = !this.axesPermanentlyVisible;

        // Apply visibility immediately
        axesGroup.visible = this.axesPermanentlyVisible;

        // When permanently visible, keep axes shown regardless of idle timeout in setupAxesVisibility
        // When turned off, allow setupAxesVisibility handlers to hide them after interactions
        
        this.requestRender();
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
        if (fileIndex < 0 || fileIndex >= this.meshes.length) return;
        
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
        if (fileIndex < 0 || fileIndex >= this.normalsVisualizers.length) return;
        
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
            
            const baseStyle = 'flex: 1; padding: 4px 8px; border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 10px;';
            if (isVisible) {
                button.setAttribute('style', baseStyle + ' background: var(--vscode-button-background); color: var(--vscode-button-foreground);');
            } else {
                button.setAttribute('style', baseStyle + ' background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);');
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
            
            const baseStyle = 'flex: 1; padding: 4px 8px; border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 10px;';
            if (isVisible) {
                button.setAttribute('style', baseStyle + ' background: var(--vscode-button-background); color: var(--vscode-button-foreground);');
            } else {
                button.setAttribute('style', baseStyle + ' background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground);');
            }
        });
    }

    private updateAxesButtonState(): void {
        const toggleBtn = document.getElementById('toggle-axes');
        if (!toggleBtn) return;
        // Active (blue) when axes are permanently visible
        if (this.axesPermanentlyVisible) {
            toggleBtn.classList.add('active');
            toggleBtn.innerHTML = 'Show Axes <span class="button-shortcut">A</span>';
        } else {
            toggleBtn.classList.remove('active');
            toggleBtn.innerHTML = 'Show Axes <span class="button-shortcut">A</span>';
        }
    }

    private updateRotationOriginButtonState(): void {
        const btn = document.getElementById('set-rotation-origin');
        if (!btn) return;
        const t = this.controls?.target;
        const atOrigin = !!t && Math.abs(t.x) < 1e-9 && Math.abs(t.y) < 1e-9 && Math.abs(t.z) < 1e-9;
        if (atOrigin) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    }

    private setUpVector(upVector: THREE.Vector3): void {
        // debug
        
        // Normalize the up vector
        upVector.normalize();
        
        // Set the camera's up vector
        this.camera.up.copy(upVector);
        
        // Force the camera to look at the current target with the new up vector
        this.camera.lookAt(this.controls.target);
        
        // Update the controls (works for both TrackballControls and OrbitControls)
        this.controls.update();
        
        // Show feedback
        this.showUpVectorFeedback(upVector);
        
        // Update axes helper to match the new up vector
        this.updateAxesForUpVector(upVector);
        
        // Show visual indicator
        this.showUpVectorIndicator(upVector);
    }

    private showUpVectorFeedback(upVector: THREE.Vector3): void {
        const axisName = upVector.x === 1 ? 'X' : upVector.y === 1 ? 'Y' : upVector.z === 1 ? 'Z' : 'Custom';
        // debug
    }

    private updateAxesForUpVector(upVector: THREE.Vector3): void {
        // Update the axes helper orientation to match the new up vector
        const axesGroup = (this as any).axesGroup;
        if (axesGroup) {
            // Simple approach: just update the axes to reflect the current coordinate system
            // debug
        }
    }

    private showUpVectorIndicator(upVector: THREE.Vector3): void {
        // Create a temporary arrow indicator showing the up direction
        const origin = new THREE.Vector3(0, 0, 0);
        const direction = upVector.clone();
        const length = 2;
        const color = 0xffff00; // Yellow
        
        const arrowHelper = new THREE.ArrowHelper(direction, origin, length, color, length * 0.2, length * 0.1);
        this.scene.add(arrowHelper);
        
        // Remove after 2 seconds
        setTimeout(() => {
            this.scene.remove(arrowHelper);
            arrowHelper.dispose();
        }, 2000);
    }

    private showKeyboardShortcuts(): void {
        // debug
        console.log(`Keyboard Shortcuts:
  X: Set X-up
  Y: Set Y-up (default)
  Z: Set Z-up (CAD style)
  R: Reset camera and up vector
  T: Switch to TrackballControls
  O: Switch to OrbitControls
  I: Switch to Inverse TrackballControls
  C: Set OpenCV camera convention (Y-down)
  B: Set OpenGL camera convention (Y-up)
  W: Set rotation center to world origin (0,0,0)`);
        
        // Create permanent shortcuts UI section
        this.createShortcutsUI();
    }

    private createShortcutsUI(): void {
        // Find or create the shortcuts container
        let shortcutsDiv = document.getElementById('shortcuts-info');
        if (!shortcutsDiv) {
            shortcutsDiv = document.createElement('div');
            shortcutsDiv.id = 'shortcuts-info';
            shortcutsDiv.style.cssText = `
                margin-top: 15px;
                padding: 10px;
                background: var(--vscode-editor-background);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 4px;
                font-size: 11px;
                color: var(--vscode-foreground);
            `;
            
            // Insert after file stats
            const fileStats = document.getElementById('file-stats');
            if (fileStats && fileStats.parentNode) {
                fileStats.parentNode.insertBefore(shortcutsDiv, fileStats.nextSibling);
            }
        }
        
        shortcutsDiv.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 8px; color: var(--vscode-textLink-foreground);">⌨️ Keyboard Shortcuts</div>
            <div style="font-family: var(--vscode-editor-font-family); line-height: 1.4;">
                <div><span style="font-weight: bold;">X</span> Set X-up orientation</div>
                <div><span style="font-weight: bold;">Y</span> Set Y-up orientation (default)</div>
                <div><span style="font-weight: bold;">Z</span> Set Z-up orientation (CAD style)</div>
                <div><span style="font-weight: bold;">R</span> Reset camera and up vector</div>
                <div><span style="font-weight: bold;">T</span> Switch to TrackballControls</div>
                <div><span style="font-weight: bold;">O</span> Switch to OrbitControls</div>
                <div><span style="font-weight: bold;">I</span> Switch to Inverse TrackballControls</div>
                <div><span style="font-weight: bold;">K</span> Switch to ArcballControls</div>
            </div>
            <div style="font-weight: bold; margin: 8px 0 4px 0; color: var(--vscode-textLink-foreground);">📷 Camera Conventions</div>
            <div style="font-family: var(--vscode-editor-font-family); line-height: 1.4; margin-bottom: 8px;">
                <div><span id="opencv-camera" style="color: var(--vscode-textLink-foreground); cursor: pointer; text-decoration: underline;">OpenCV (Y↓) [C]</span></div>
                <div><span id="opengl-camera" style="color: var(--vscode-textLink-foreground); cursor: pointer; text-decoration: underline;">OpenGL (Y↑) [B]</span></div>
                <div><span style="color: var(--vscode-foreground);">World Origin [W]</span></div>
            </div>
            <div style="font-weight: bold; margin: 8px 0 4px 0; color: var(--vscode-textLink-foreground);">🖱️ Mouse Interactions</div>
            <div style="font-family: var(--vscode-editor-font-family); line-height: 1.4;">
                <div><span style="font-weight: bold;">Left Click + Drag</span> Move camera around</div>
                <div><span style="font-weight: bold;">Shift+Click</span> Solo point cloud (hide others)</div>
                <div><span style="font-weight: bold;">Double-Click</span> Set rotation center</div>
            </div>
            <div style="font-weight: bold; margin: 8px 0 4px 0; color: var(--vscode-textLink-foreground);">📊 Camera Controls</div>
            <div id="camera-control-status" style="font-family: var(--vscode-editor-font-family); padding: 4px; background: var(--vscode-input-background); border-radius: 2px;">
                TRACKBALL
            </div>
        `;
        
        // Initialize the status display
        this.updateControlStatus();
    }

    private setupMessageHandler(): void {
        window.addEventListener('message', async (event) => {
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
                    if (typeof message.message === 'string' && message.message.includes('🧪 Header face types')) {
                        console.log(message.message);
                    }
                    break;
                case 'loadingError':
                    this.showError(`Failed to load PLY file: ${message.error}`);
                    break;
                case 'plyData':
                case 'multiPlyData':
                    try {
                        // Both single and multi-file data are handled the same way now
                        const dataArray = Array.isArray(message.data) ? message.data : [message.data];
                        await this.displayFiles(dataArray);
                    } catch (error) {
                        console.error('Error displaying PLY data:', error);
                        this.showError('Failed to display PLY data: ' + (error instanceof Error ? error.message : String(error)));
                    }
                    break;
                case 'ultimateRawBinaryData':
                    try {
                        await this.handleUltimateRawBinaryData(message);
                    } catch (error) {
                        console.error('Error handling ultimate raw binary data:', error);
                        this.showError('Failed to handle ultimate raw binary data: ' + (error instanceof Error ? error.message : String(error)));
                    }
                    break;
                case 'directTypedArrayData':
                    try {
                        await this.handleDirectTypedArrayData(message);
                    } catch (error) {
                        console.error('Error handling direct TypedArray data:', error);
                        this.showError('Failed to handle direct TypedArray data: ' + (error instanceof Error ? error.message : String(error)));
                    }
                    break;
                case 'binaryPlyData':
                    try {
                        await this.handleBinaryPlyData(message);
                    } catch (error) {
                        console.error('Error handling binary PLY data:', error);
                        this.showError('Failed to handle binary PLY data: ' + (error instanceof Error ? error.message : String(error)));
                    }
                    break;
                case 'addFiles':
                    try {
                        this.addNewFiles(message.data);
                    } catch (error) {
                        console.error('Error adding new files:', error);
                        this.showError('Failed to add files: ' + (error instanceof Error ? error.message : String(error)));
                    }
                    break;
                case 'sequence:init':
                    try {
                        this.initializeSequence(message.files as string[], message.wildcard as string);
                    } catch (error) {
                        console.error('Error starting sequence:', error);
                        this.showError('Failed to start sequence: ' + (error instanceof Error ? error.message : String(error)));
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
                        this.showError('Failed to remove file: ' + (error instanceof Error ? error.message : String(error)));
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
                    this.handleObjData(message);
                    break;
                case 'stlData':
                    this.handleStlData(message);
                    break;
                case 'xyzData':
                    this.handleXyzData(message);
                    break;
                case 'pcdData':
                    this.handlePcdData(message);
                    break;
                case 'ptsData':
                    this.handlePtsData(message);
                    break;
                case 'offData':
                    this.handleOffData(message);
                    break;
                case 'gltfData':
                    this.handleGltfData(message);
                    break;
                case 'xyzVariantData':
                    this.handleXyzVariantData(message);
                    break;
                case 'cameraParams':
                    this.handleCameraParams(message);
                    break;
                case 'cameraParamsCancelled':
                    this.handleCameraParamsCancelled(message.requestId);
                    break;
                case 'cameraParamsError':
                    this.handleCameraParamsError(message.error, message.requestId);
                    break;
                case 'savePlyFileResult':
                    this.handleSavePlyFileResult(message);
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
                        this.showError('Failed to handle pose data: ' + (error instanceof Error ? error.message : String(error)));
                    }
                    break;
            }
        });
    }

    private currentTiming: { kind: string; startAt?: string; readMs?: number; parseMs?: number; convertMs?: number; totalMs?: number; format?: string } | null = null;
    private handleTimingMessage(msg: any): void {
        if (!this.currentTiming) this.currentTiming = { kind: msg.kind };
        if (msg.phase === 'start') {
            this.currentTiming = { kind: msg.kind, startAt: msg.at };
        } else if (msg.phase === 'read') {
            this.currentTiming = { ...(this.currentTiming || { kind: msg.kind }), readMs: msg.ms };
        } else if (msg.phase === 'parse') {
            this.currentTiming = { ...(this.currentTiming || { kind: msg.kind }), parseMs: msg.ms, format: msg.format || this.currentTiming?.format };
        } else if (msg.phase === 'convert') {
            this.currentTiming = { ...(this.currentTiming || { kind: msg.kind }), convertMs: msg.ms };
        } else if (msg.phase === 'total') {
            this.currentTiming = { ...(this.currentTiming || { kind: msg.kind }), totalMs: msg.ms, startAt: this.currentTiming?.startAt || msg.at };
            // Emit final summary line with exact timestamp
        const iso = msg.at ? new Date(msg.at).toISOString() : new Date().toISOString();
        const timeOnly = `${new Date(iso).toTimeString().split(' ')[0]}.${new Date(iso).getMilliseconds().toString().padStart(3,'0')}`;
            const kind = (this.currentTiming.kind || 'unknown').toUpperCase();
            const fmt = this.currentTiming.format ? `, format=${this.currentTiming.format}` : '';
            const read = this.currentTiming.readMs != null ? `read ${this.currentTiming.readMs}ms` : null;
            const parse = this.currentTiming.parseMs != null ? `parse ${this.currentTiming.parseMs}ms` : null;
            const convert = this.currentTiming.convertMs != null ? `convert ${this.currentTiming.convertMs}ms` : null;
        const render = this.lastGeometryMs ? `render ${this.lastGeometryMs}ms` : null;
            const parts = [read, parse, convert, render].filter(Boolean).join(', ');
        const totalAbs = this.lastAbsoluteMs ? this.lastAbsoluteMs.toFixed(1) : (this.currentTiming.totalMs ?? 0).toFixed(1);
        console.log(`[${timeOnly}] Summary: ${kind}${fmt} - ${parts} | total ${totalAbs}ms`);
            this.currentTiming = null;
        }
    }

    private async displayFiles(dataArray: PlyData[]): Promise<void> {
        // concise summary printed separately
        // In sequence mode: do not auto-fit camera or heavy UI work
        if (this.sequenceMode) {
            this.addNewFiles(dataArray);
            this.updateFileList();
            try { (document.getElementById('loading') as HTMLElement)?.classList.add('hidden'); } catch {}
            return;
        }

        // Normal mode
        this.addNewFiles(dataArray);
        this.updateFileStats();
        this.updateFileList();
        this.updateCameraControlsPanel();
        this.fitCameraToAllObjects();
        (document.getElementById('loading') as HTMLElement)?.classList.add('hidden');
        this.clearError();
        const absStart = (window as any).absoluteStartTime || performance.now();
        this.lastAbsoluteMs = performance.now() - absStart;
    }

    private async yieldToUI(): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    private createMaterialForFile(data: PlyData, fileIndex: number): THREE.Material {
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
            
            if (colorMode === 'original' && data.hasColors) {
                // Use original colors from the PLY file
                const colors = new Float32Array(data.vertices.length * 3);
                if (this.convertSrgbToLinear) {
                    this.ensureSrgbLUT();
                    const lut = this.srgbToLinearLUT!;
                    for (let i = 0; i < data.vertices.length; i++) {
                        const v = data.vertices[i];
                        const r8 = (v.red || 0) & 255;
                        const g8 = (v.green || 0) & 255;
                        const b8 = (v.blue || 0) & 255;
                        colors[i * 3] = lut[r8];
                        colors[i * 3 + 1] = lut[g8];
                        colors[i * 3 + 2] = lut[b8];
                    }
                } else {
                    for (let i = 0; i < data.vertices.length; i++) {
                        const v = data.vertices[i];
                        colors[i * 3] = ((v.red || 0) & 255) / 255;
                        colors[i * 3 + 1] = ((v.green || 0) & 255) / 255;
                        colors[i * 3 + 2] = ((v.blue || 0) & 255) / 255;
                    }
                }
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
                this.pointSizes[fileIndex] = 0.001;  // Universal default for all file types
            }
            
            material.size = this.pointSizes[fileIndex];
            material.sizeAttenuation = true; // Always use distance-based scaling
            
            // Apply point count-based optimizations
            const pointCount = data.vertices?.length || 0;
            this.optimizeForPointCount(material, pointCount);
            
            // debug
            
            if (colorMode === 'original' && data.hasColors) {
                // Use original colors from the PLY file
                const colors = new Float32Array(data.vertices.length * 3);
                for (let i = 0; i < data.vertices.length; i++) {
                    const vertex = data.vertices[i];
                    colors[i * 3] = (vertex.red || 0) / 255;
                    colors[i * 3 + 1] = (vertex.green || 0) / 255;
                    colors[i * 3 + 2] = (vertex.blue || 0) / 255;
                }
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
            
            return material;
        }
    }

    private fitCameraToAllObjects(): void {
        if (this.meshes.length === 0 && this.poseGroups.length === 0 && this.cameraGroups.length === 0) {return;}

        const box = new THREE.Box3();
        for (const obj of this.meshes) { box.expandByObject(obj); }
        for (const group of this.poseGroups) { box.expandByObject(group); }
        for (const group of this.cameraGroups) { box.expandByObject(group); }

        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

        cameraZ *= 2; // Add some padding

        this.camera.position.set(center.x, center.y, center.z + cameraZ);
        this.camera.lookAt(center);
        
        this.controls.target.copy(center);
        this.controls.update();
    }

    private updateFileStats(): void {
        const statsDiv = document.getElementById('file-stats');
        if (!statsDiv) {return;}
        
        if (this.plyFiles.length === 0 && this.poseGroups.length === 0 && this.cameraGroups.length === 0) {
            statsDiv.innerHTML = '<div>No objects loaded</div>';
            // Also clear camera matrix panel
            const cameraPanel = document.getElementById('camera-matrix-panel');
            if (cameraPanel) cameraPanel.innerHTML = '';
            return;
        }
        
        if (this.plyFiles.length + this.poseGroups.length + this.cameraGroups.length === 1 && this.plyFiles.length === 1) {
            // Single file view
            const data = this.plyFiles[0];
            const renderingMode = data.faceCount === 0 ? 'Points' : 'Mesh';
            statsDiv.innerHTML = `
                <div><strong>Vertices:</strong> ${data.vertexCount.toLocaleString()}</div>
                <div><strong>Faces:</strong> ${data.faceCount.toLocaleString()}</div>
                <div><strong>Format:</strong> ${data.format}</div>
                <div><strong>Colors:</strong> ${data.hasColors ? 'Yes' : 'No'}</div>
                <div><strong>Normals:</strong> ${data.hasNormals ? 'Yes' : 'No'}</div>
                <div><strong>Rendering Mode:</strong> ${renderingMode}</div>
                ${Array.isArray((data as any).comments) && (data as any).comments.length > 0 ? `<div><strong>Comments:</strong><br>${(data as any).comments.join('<br>')}</div>` : ''}
            `;
        } else {
            // Multiple files view
            const totalVertices = this.plyFiles.reduce((sum: number, data: PlyData) => sum + data.vertexCount, 0);
            const totalFaces = this.plyFiles.reduce((sum: number, data: PlyData) => sum + data.faceCount, 0);
            const totalObjects = this.plyFiles.length + this.poseGroups.length + this.cameraGroups.length;
            
            statsDiv.innerHTML = `
                <div><strong>Total Objects:</strong> ${totalObjects} (Pointclouds: ${this.plyFiles.length}, Poses: ${this.poseGroups.length}, Cameras: ${this.cameraGroups.length})</div>
                <div><strong>Total Vertices:</strong> ${totalVertices.toLocaleString()}</div>
                <div><strong>Total Faces:</strong> ${totalFaces.toLocaleString()}</div>
            `;
        }

        // Update camera matrix panel
        this.updateCameraMatrixDisplay();
        this.updateCameraControlsPanel();
    }

    private updateFileList(): void {
        const fileListDiv = document.getElementById('file-list');
        if (!fileListDiv) return;

        if (this.plyFiles.length === 0 && this.poseGroups.length === 0 && this.cameraGroups.length === 0) {
            fileListDiv.innerHTML = '<div class="no-files">No objects loaded</div>';
            return;
        }

        let html = '';
        // In sequence mode, show only the current frame information
        if (this.sequenceMode && this.sequenceFiles.length > 0) {
            const name = this.sequenceFiles[this.sequenceIndex]?.split(/[\\/]/).pop() || `Frame ${this.sequenceIndex + 1}`;
            html += `
                <div class="file-item">
                    <div class="file-item-main">
                        <input type="checkbox" id="file-0" checked disabled>
                        <span class="color-indicator" style="background-color: #888"></span>
                        <label for="file-0" class="file-name">${name}</label>
                    </div>
                    <div class="file-info">Frame ${this.sequenceIndex + 1} of ${this.sequenceFiles.length}</div>
                </div>
            `;
            fileListDiv.innerHTML = html;
            return;
        }

        // Render point clouds and meshes
        for (let i = 0; i < this.plyFiles.length; i++) {
            const data = this.plyFiles[i];
            
            // Color indicator
            let colorIndicator = '';
            if (this.individualColorModes[i] === 'original' && data.hasColors) {
                colorIndicator = '<span class="color-indicator" style="background: linear-gradient(45deg, #ff0000, #00ff00, #0000ff); border: 1px solid #666;"></span>';
            } else {
                const color = this.fileColors[i % this.fileColors.length];
                const colorHex = `#${Math.round(color[0] * 255).toString(16).padStart(2, '0')}${Math.round(color[1] * 255).toString(16).padStart(2, '0')}${Math.round(color[2] * 255).toString(16).padStart(2, '0')}`;
                colorIndicator = `<span class="color-indicator" style="background-color: ${colorHex}"></span>`;
            }
            
            // Transformation matrix UI
            const matrixArr = this.getTransformationMatrixAsArray(i);
            let matrixStr = '';
            for (let r = 0; r < 4; ++r) {
                const row = matrixArr.slice(r * 4, r * 4 + 4).map(v => v.toFixed(6));
                matrixStr += row.join(' ') + '\n';
            }
            
            html += `
                <div class="file-item">
                    <div class="file-item-main">
                        <input type="checkbox" id="file-${i}" ${this.fileVisibility[i] ? 'checked' : ''}>
                        ${colorIndicator}
                        <label for="file-${i}" class="file-name">${data.fileName || `File ${i + 1}`}</label>
                        <button class="remove-file" data-file-index="${i}" title="Remove file">✕</button>
                    </div>
                    <div class="file-info">${data.vertexCount.toLocaleString()} vertices, ${data.faceCount.toLocaleString()} faces</div>
                    
                    ${this.isDepthDerivedFile(data) ? `
                    <!-- Depth Settings (First) -->
                    <div class="depth-controls" style="margin-top: 8px;">
                        <button class="depth-settings-toggle" data-file-index="${i}" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 1px solid var(--vscode-panel-border); padding: 4px 8px; border-radius: 2px; cursor: pointer; font-size: 11px; width: 100%;">
                            <span class="toggle-icon">▶</span> Depth Settings
                        </button>
                        <div class="depth-settings-panel" id="depth-panel-${i}" style="display:none; margin-top: 8px; padding: 8px; background: var(--vscode-input-background); border: 1px solid var(--vscode-panel-border); border-radius: 2px;">
                            <div id="image-size-${i}" style="font-size: 9px; color: var(--vscode-descriptionForeground); margin-top: 1px;">Image Size: Width: -, Height: -</div>
                            
                            <!-- Calibration File Loading -->
                            <div class="depth-group" style="margin-bottom: 8px;">
                                <label style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">Load Calibration:</label>
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
                                <label style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">Principle Point (px):</label>
                                <div style="display: flex; gap: 4px; align-items: end;">
                                    <div style="flex: 1;">
                                        <label for="cx-${i}" style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">cx:</label>
                                        <input type="number" id="cx-${i}" value="${this.getDepthCx(data)}" step="0.1" style="width: 100%; padding: 2px; font-size: 11px;">
                                    </div>
                                    <div style="flex: 1;">
                                        <label for="cy-${i}" style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">cy:</label>
                                        <input type="number" id="cy-${i}" value="${this.getDepthCy(data)}" step="0.1" style="width: 100%; padding: 2px; font-size: 11px;">
                                    </div>
                                    <div style="flex: 0 0 auto;">
                                        <button class="reset-principle-point" data-file-index="${i}" style="padding: 2px 6px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 9px; height: 24px;" title="Reset to auto-calculated center">↺</button>
                                    </div>
                                </div>
                                <div style="font-size: 9px; color: var(--vscode-descriptionForeground); margin-top: 1px;">Auto-calculated as (width-1)/2 and (height-1)/2</div>
                            </div>
                            <div class="depth-group" id="distortion-params-${i}" style="margin-bottom: 8px; display: none;">
                                <label style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">Distortion Parameters:</label>
                                
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
                            <div class="depth-group" id="baseline-group-${i}" style="margin-bottom: 8px; ${this.getDepthSetting(data, 'depth').includes('disparity') ? '' : 'display:none;'}">
                                <label for="baseline-${i}" style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">Baseline (mm) ⭐:</label>
                                <input type="number" id="baseline-${i}" value="${this.getDepthBaseline(data)}" min="0.1" step="0.1" style="width: 100%; padding: 2px; font-size: 11px;">
                            </div>
                            <div class="depth-group" id="disparity-offset-group-${i}" style="margin-bottom: 8px; ${this.getDepthSetting(data, 'depth').includes('disparity') ? '' : 'display:none;'}">
                                <label for="disparity-offset-${i}" style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">Disparity Offset:</label>
                                <div style="display: flex; gap: 4px; align-items: center;">
                                    <input type="number" id="disparity-offset-${i}" value="0" step="0.1" style="flex: 1; padding: 2px; font-size: 11px;" placeholder="Offset added to disparity values">
                                    <button class="reset-disparity-offset" data-file-index="${i}" style="padding: 2px 6px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 9px; height: 24px; flex: 0 0 auto;" title="Reset to 0">↺</button>
                                </div>
                            </div>
                            <div class="depth-group" style="margin-bottom: 8px;">
                                <label style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 4px;">Depth from Mono Parameters ⭐:</label>
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
                            ${this.isPngDerivedFile(data) ? `
                            <div class="depth-group" style="margin-bottom: 8px;">
                                <label for="png-scale-factor-${i}" style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">Scale Factor ⭐:</label>
                                <input type="number" id="png-scale-factor-${i}" value="${this.getPngScaleFactor(data)}" min="0.1" step="0.1" style="width: 100%; padding: 2px; font-size: 11px;" placeholder="1000 for mm, 256 for disparity">
                                <div style="font-size: 9px; color: var(--vscode-descriptionForeground); margin-top: 1px;">The depth/disparity is divided to get the applied value in meters/disparities</div>
                            </div>
                            ` : ''}
                            <div class="depth-group" style="margin-bottom: 8px;">
                                <label for="convention-${i}" style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">Coordinate Convention ⭐:</label>
                                <select id="convention-${i}" style="width: 100%; padding: 2px; font-size: 11px;">
                                    <option value="opengl" ${this.getDepthConvention(data) === 'opengl' ? 'selected' : ''}>OpenGL (Y-up, Z-backward)</option>
                                    <option value="opencv" ${this.getDepthConvention(data) === 'opencv' ? 'selected' : ''}>OpenCV (Y-down, Z-forward)</option>
                                </select>
                            </div>
                            <div class="depth-group" style="margin-bottom: 8px;">
                                <label style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">Color Image (optional):</label>
                                <button class="select-color-image" data-file-index="${i}" style="width: 100%; padding: 4px 8px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 11px; text-align: left;">📁 Select Color Image...</button>
                                ${this.getStoredColorImageName(i) ? `<div style="font-size: 9px; color: var(--vscode-textLink-foreground); margin-top: 2px; display: flex; align-items: center; gap: 4px;">📷 Current: ${this.getStoredColorImageName(i)} <button class="remove-color-image" data-file-index="${i}" style="font-size: 8px; padding: 1px 4px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer;">✕</button></div>` : ''}
                            </div>
                            <div class="depth-group" style="margin-bottom: 8px;">
                                <div style="display: flex; gap: 4px;">
                                    <button class="apply-depth-settings" data-file-index="${i}" style="flex: 1; padding: 4px 8px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 11px;">Apply Settings</button>
                                    <button class="save-ply-file" data-file-index="${i}" style="flex: 1; padding: 4px 8px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 11px;">💾 Save as PLY</button>
                                </div>
                                <div style="display: flex; gap: 4px; margin-top: 4px;">
                                    <button class="use-as-default-settings" data-file-index="${i}" style="flex: 1; padding: 4px 8px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 11px;">⭐ Use as Default</button>
                                    <button class="reset-to-default-settings" data-file-index="${i}" style="flex: 1; padding: 4px 8px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 11px;">⭐ Reset to Default</button>
                                </div>
                            </div>
                        </div>
                    </div>
                    ` : ''}
                    
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
                            const hasLines = (data as any).objData && (data as any).objData.lineCount > 0;
                            const hasGeometry = hasFaces || hasLines; // Either faces or lines enable mesh/wireframe modes
                            const hasNormalsData = data.hasNormals || hasFaces; // Faces can generate normals
                            const buttons = [];
                            
                            // Debug logging
                            console.log(`File ${i}: ${data.fileName}, faceCount=${data.faceCount}, lineCount=${(data as any).objData?.lineCount || 0}, hasNormals=${data.hasNormals}, hasFaces=${hasFaces}, hasLines=${hasLines}, hasGeometry=${hasGeometry}`);
                            
                            // Always show points button
                            buttons.push(`<button class="render-mode-btn points-btn" data-file-index="${i}" data-mode="points" style="padding: 3px 6px; border: 1px solid var(--vscode-panel-border); border-radius: 2px; font-size: 9px; cursor: pointer;">👁️ Points</button>`);
                            
                            // Show mesh/wireframe buttons if there are faces OR lines (OBJ wireframes)
                            if (hasGeometry) {
                                buttons.push(`<button class="render-mode-btn mesh-btn" data-file-index="${i}" data-mode="mesh" style="padding: 3px 6px; border: 1px solid var(--vscode-panel-border); border-radius: 2px; font-size: 9px; cursor: pointer;">🔷 Mesh</button>`);
                                buttons.push(`<button class="render-mode-btn wireframe-btn" data-file-index="${i}" data-mode="wireframe" style="padding: 3px 6px; border: 1px solid var(--vscode-panel-border); border-radius: 2px; font-size: 9px; cursor: pointer;">📐 Wireframe</button>`);
                            }
                            
                            // Show normals button if there are normals or faces (can compute normals)
                            // Exception: Don't show for PTS files unless they actually have normals in vertices
                            const isPtsFile = data.fileName?.toLowerCase().endsWith('.pts');
                            const shouldShowNormals = hasNormalsData && (!isPtsFile || (data.vertices.length > 0 && data.vertices[0]?.nx !== undefined));
                            
                            if (shouldShowNormals) {
                                buttons.push(`<button class="render-mode-btn normals-btn" data-file-index="${i}" data-mode="normals" style="padding: 3px 6px; border: 1px solid var(--vscode-panel-border); border-radius: 2px; font-size: 9px; cursor: pointer;">📏 Normals</button>`);
                            }
                            
                            // Determine grid layout based on number of buttons
                            const buttonCount = buttons.length;
                            let gridColumns = '';
                            if (buttonCount === 1) gridColumns = '1fr';
                            else if (buttonCount === 2) gridColumns = '1fr 1fr';
                            else if (buttonCount === 3) gridColumns = '1fr 1fr 1fr';
                            else if (buttonCount === 4) gridColumns = '1fr 1fr 1fr 1fr';
                            
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
                            <span class="size-value" style="font-size: 10px;">${sizeValue.toFixed(4)}</span>`;
                        })()
                        }
                    </div>
                    
                    ${((data as any).isObjWireframe || (data as any).isObjFile) ? `
                    <!-- OBJ Controls -->
                    <div class="obj-controls" style="margin-top: 8px;">
                        <!-- MTL Material Control -->
                        <button class="load-mtl-btn" data-file-index="${i}" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 1px solid var(--vscode-panel-border); padding: 4px 8px; border-radius: 2px; cursor: pointer; font-size: 11px; width: 100%; margin-bottom: 4px;">
                            🎨 Load MTL Material
                        </button>
                        ${this.appliedMtlNames[i] ? `
                        <div class="mtl-status" style="font-size: 9px; color: var(--vscode-textLink-foreground); margin-bottom: 4px; text-align: center;">
                            📄 ${this.appliedMtlNames[i]} applied
                        </div>
                        ` : ''}
                    </div>
                    ` : ''}
                    
                    <!-- Color Control (Fourth) -->
                    <div class="color-control">
                        <label for="color-${i}">Color:</label>
                        <select id="color-${i}" class="color-selector">
                            ${data.hasColors ? `<option value="original" ${this.individualColorModes[i] === 'original' ? 'selected' : ''}>Original</option>` : ''}
                            <option value="assigned" ${this.individualColorModes[i] === 'assigned' ? 'selected' : ''}>Assigned (${this.getColorName(i)})</option>
                            ${this.getColorOptions(i)}
                        </select>
                    </div>
                </div>
            `;
        }

        // Render pose entries appended after point clouds
        const baseIndex = this.plyFiles.length;
        for (let p = 0; p < this.poseGroups.length; p++) {
            const i = baseIndex + p;
            const meta = this.poseMeta[p];
            const color = this.fileColors[i % this.fileColors.length];
            const colorHex = `#${Math.round(color[0] * 255).toString(16).padStart(2, '0')}${Math.round(color[1] * 255).toString(16).padStart(2, '0')}${Math.round(color[2] * 255).toString(16).padStart(2, '0')}`;
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

            html += `
                <div class="file-item">
                    <div class="file-item-main">
                        <input type="checkbox" id="file-${i}" ${visible ? 'checked' : ''}>
                        ${colorIndicator}
                        <label for="file-${i}" class="file-name">${meta.fileName || `Pose ${p + 1}`}</label>
                        <button class="remove-file" data-file-index="${i}" title="Remove object">✕</button>
                    </div>
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
                        <span class="size-value">${sizeVal.toFixed(3)}</span>
                    </div>
                    <div class="color-control">
                        <label for="color-${i}">Color:</label>
                        <select id="color-${i}" class="color-selector">
                            <option value="assigned" ${this.individualColorModes[i] === 'assigned' ? 'selected' : ''}>Assigned (Red)</option>
                            ${this.getColorOptions(i)}
                        </select>
                    </div>
                </div>
            `;
        }
        
        // Render camera profiles (like poses)
        for (let c = 0; c < this.cameraGroups.length; c++) {
            const i = this.plyFiles.length + this.poseGroups.length + c; // Unified index
            const cameraProfileName = this.cameraNames[c];
            const color = this.fileColors[i % this.fileColors.length];
            const colorHex = `#${Math.round(color[0] * 255).toString(16).padStart(2, '0')}${Math.round(color[1] * 255).toString(16).padStart(2, '0')}${Math.round(color[2] * 255).toString(16).padStart(2, '0')}`;
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

            html += `
                <div class="file-item">
                    <div class="file-item-main">
                        <input type="checkbox" id="file-${i}" ${visible ? 'checked' : ''}>
                        ${colorIndicator}
                        <label for="file-${i}" class="file-name">📷 ${cameraProfileName}</label>
                        <button class="remove-file" data-file-index="${i}" title="Remove camera profile">✕</button>
                    </div>
                    <div class="file-info">${cameraCount} cameras</div>
                    <div class="panel-section" style="margin-top:6px;">
                        <div class="control-buttons">
                            <label style="font-size:10px;display:flex;align-items:center;gap:6px;">
                                <input type="checkbox" id="camera-show-labels-${i}">
                                Show labels
                            </label>
                            <label style="font-size:10px;display:flex;align-items:center;gap:6px;">
                                <input type="checkbox" id="camera-show-coords-${i}">
                                Show coordinates
                            </label>
                        </div>
                    </div>
                    <div class="size-control">
                        <label for="size-${i}">Scale:</label>
                        <input type="range" id="size-${i}" min="0.1" max="5.0" step="0.1" value="${sizeVal}">
                        <span id="size-value-${i}">${sizeVal.toFixed(1)}</span>
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
                </div>
            `;
        }
        
        fileListDiv.innerHTML = html;
        
        // Add event listeners after setting innerHTML
        const totalEntries = this.plyFiles.length + this.poseGroups.length + this.cameraGroups.length;
        for (let i = 0; i < totalEntries; i++) {
            const checkbox = document.getElementById(`file-${i}`);
            if (checkbox) {
                checkbox.addEventListener('click', (e) => {
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
            
            // Transform toggle logic with improved UI (handle both point clouds and cameras)
            const transformBtn = document.querySelector(`.transform-toggle[data-file-index="${i}"]`);
            const transformationBtn = document.querySelector(`.transformation-toggle[data-file-index="${i}"]`);
            const transformPanel = document.getElementById(`transform-panel-${i}`);
            const transformationPanel = document.getElementById(`transformation-panel-${i}`);
            
            const activeBtn = transformBtn || transformationBtn;
            const activePanel = transformPanel || transformationPanel;
            
            if (activeBtn && activePanel) {
                // Always hide by default and set triangle to side
                activePanel.style.display = 'none';
                const toggleIcon = activeBtn.querySelector('.toggle-icon');
                if (toggleIcon) toggleIcon.textContent = '▶';
                
                activeBtn.addEventListener('click', () => {
                    const isVisible = activePanel.style.display !== 'none';
                    activePanel.style.display = isVisible ? 'none' : 'block';
                    if (toggleIcon) toggleIcon.textContent = isVisible ? '▶' : '▼';
                });
            }
            
            // Apply matrix logic with improved parsing
            const applyBtn = document.querySelector(`.apply-matrix[data-file-index="${i}"]`);
            if (applyBtn && activePanel) {
                applyBtn.addEventListener('click', () => {
                    const textarea = document.getElementById(`matrix-${i}`) as HTMLTextAreaElement;
                    if (textarea) {
                        const values = this.parseMatrixInput(textarea.value);
                        if (values && values.length === 16) {
                            const mat = new THREE.Matrix4();
                            // Read matrix in row-major order (as displayed in UI)
                            mat.set(
                                values[0], values[1], values[2],  values[3],
                                values[4], values[5], values[6],  values[7],
                                values[8], values[9], values[10], values[11],
                                values[12], values[13], values[14], values[15]
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
                        textarea.value = '1.000000 0.000000 0.000000 0.000000\n0.000000 1.000000 0.000000 0.000000\n0.000000 0.000000 1.000000 0.000000\n0.000000 0.000000 0.000000 1.000000';
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
                    const rotationMatrix = this.createRotationMatrix('x', Math.PI / 2); // 90 degrees
                    this.multiplyTransformationMatrices(i, rotationMatrix);
                    this.updateMatrixTextarea(i);
                });
            }

            const rotateYBtn = document.querySelector(`.rotate-y[data-file-index="${i}"]`);
            if (rotateYBtn) {
                rotateYBtn.addEventListener('click', () => {
                    const rotationMatrix = this.createRotationMatrix('y', Math.PI / 2); // 90 degrees
                    this.multiplyTransformationMatrices(i, rotationMatrix);
                    this.updateMatrixTextarea(i);
                });
            }

            const rotateZBtn = document.querySelector(`.rotate-z[data-file-index="${i}"]`);
            if (rotateZBtn) {
                rotateZBtn.addEventListener('click', () => {
                    const rotationMatrix = this.createRotationMatrix('z', Math.PI / 2); // 90 degrees
                    this.multiplyTransformationMatrices(i, rotationMatrix);
                    this.updateMatrixTextarea(i);
                });
            }
            
            // Pose controls listeners
            const datasetColorsCb = document.getElementById(`pose-dataset-colors-${i}`) as HTMLInputElement;
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
                    const cameraProfileIndex = i - this.plyFiles.length - this.poseGroups.length;
                    this.toggleCameraProfileLabels(cameraProfileIndex, cameraLabelCb.checked);
                });
            }
            
            const cameraCoordsCb = document.getElementById(`camera-show-coords-${i}`) as HTMLInputElement;
            if (cameraCoordsCb) {
                cameraCoordsCb.addEventListener('change', () => {
                    const cameraProfileIndex = i - this.plyFiles.length - this.poseGroups.length;
                    this.toggleCameraProfileCoordinates(cameraProfileIndex, cameraCoordsCb.checked);
                });
            }
            
            // Add size slider listeners for point clouds and OBJ files
            const sizeSlider = document.getElementById(`size-${i}`) as HTMLInputElement;
            const isPose = i >= this.plyFiles.length && i < this.plyFiles.length + this.poseGroups.length;
            const isCamera = i >= this.plyFiles.length + this.poseGroups.length;
            const isObjFile = !isPose && !isCamera && (this.plyFiles[i] as any).isObjFile;
            if (sizeSlider) {
                sizeSlider.addEventListener('input', (e) => {
                    const newSize = parseFloat((e.target as HTMLInputElement).value);
                    this.updatePointSize(i, newSize);
                    this.requestRender();
                    // this.requestRender();
                    
                    // Update the displayed value
                    const sizeValue = document.querySelector(`#size-${i} + .size-value`) as HTMLElement;
                    if (sizeValue) {
                        if (isPose) {
                            sizeValue.textContent = newSize.toFixed(3); // Joint radius precision
                        } else if (isCamera) {
                            sizeValue.textContent = newSize.toFixed(1); // Camera scale precision
                        } else {
                            sizeValue.textContent = newSize.toFixed(4); // Universal point size precision
                        }
                    }
                });
            }
            
            // Color selector listeners
            const colorSelector = document.getElementById(`color-${i}`) as HTMLSelectElement;
            if (colorSelector) {
                colorSelector.addEventListener('change', () => {
                    const value = colorSelector.value;
                        this.individualColorModes[i] = value;
                    const isPose = i >= this.plyFiles.length;
                    if (isPose) {
                        // Update pose group material color
                        const poseIndex = i - this.plyFiles.length;
                        const group = this.poseGroups[poseIndex];
                        if (group) {
                            const colorIdx = value === 'assigned' ? (i % this.fileColors.length) : parseInt(value);
                            const color = isNaN(colorIdx) ? this.fileColors[i % this.fileColors.length] : this.fileColors[colorIdx];
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
                        const oldMaterial = this.meshes[i].material as any;
                            const newMaterial = this.createMaterialForFile(this.plyFiles[i], i);
                        (this.meshes[i] as any).material = newMaterial;
                            if (oldMaterial) {
                            if (Array.isArray(oldMaterial)) { oldMaterial.forEach((m: any) => m.dispose()); } else { oldMaterial.dispose(); }
                        }
                    }
                });
            }

            // Depth settings toggle and controls
            if (this.isDepthDerivedFile(this.plyFiles[i])) {
                const depthToggleBtn = document.querySelector(`.depth-settings-toggle[data-file-index="${i}"]`);
                const depthPanel = document.getElementById(`depth-panel-${i}`);
                if (depthToggleBtn && depthPanel) {
                    // Hide by default
                    depthPanel.style.display = 'none';
                    const toggleIcon = depthToggleBtn.querySelector('.toggle-icon');
                    if (toggleIcon) toggleIcon.textContent = '▶';
                    
                    depthToggleBtn.addEventListener('click', () => {
                        const isVisible = depthPanel.style.display !== 'none';
                        depthPanel.style.display = isVisible ? 'none' : 'block';
                        if (toggleIcon) toggleIcon.textContent = isVisible ? '▶' : '▼';
                    });
                }

                // Calibration file loading
                const loadCalibrationBtn = document.querySelector(`.load-calibration-btn[data-file-index="${i}"]`);
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
                    fxInput.addEventListener('wheel', (e) => {
                        (e.target as HTMLInputElement).blur();
                    });
                }
                if (fyInput && !fyInput.hasAttribute('data-listener-attached')) {
                    fyInput.setAttribute('data-listener-attached', 'true');
                    fyInput.addEventListener('input', () => this.updateSingleDefaultButtonState(i));
                    // Prevent scroll wheel from changing value but allow page scrolling
                    fyInput.addEventListener('wheel', (e) => {
                        (e.target as HTMLInputElement).blur();
                    });
                }

                const cxInput = document.getElementById(`cx-${i}`) as HTMLInputElement;
                if (cxInput) {
                    cxInput.addEventListener('input', () => this.updateSingleDefaultButtonState(i));
                    // Prevent scroll wheel from changing value but allow page scrolling
                    cxInput.addEventListener('wheel', (e) => {
                        (e.target as HTMLInputElement).blur();
                    });
                }

                const cyInput = document.getElementById(`cy-${i}`) as HTMLInputElement;
                if (cyInput) {
                    cyInput.addEventListener('input', () => this.updateSingleDefaultButtonState(i));
                    // Prevent scroll wheel from changing value but allow page scrolling
                    cyInput.addEventListener('wheel', (e) => {
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
                        input.addEventListener('wheel', (e) => {
                            (e.target as HTMLInputElement).blur();
                        });
                    }
                });

                const baselineInput = document.getElementById(`baseline-${i}`) as HTMLInputElement;
                if (baselineInput) {
                    baselineInput.addEventListener('input', () => this.updateSingleDefaultButtonState(i));
                    // Prevent scroll wheel from changing value but allow page scrolling
                    baselineInput.addEventListener('wheel', (e) => {
                        (e.target as HTMLInputElement).blur();
                    });
                }

                const depthScaleInput = document.getElementById(`depth-scale-${i}`) as HTMLInputElement;
                if (depthScaleInput) {
                    depthScaleInput.addEventListener('input', () => this.updateSingleDefaultButtonState(i));
                    // Prevent scroll wheel from changing value but allow page scrolling
                    depthScaleInput.addEventListener('wheel', (e) => {
                        (e.target as HTMLInputElement).blur();
                    });
                }

                const depthBiasInput = document.getElementById(`depth-bias-${i}`) as HTMLInputElement;
                if (depthBiasInput) {
                    depthBiasInput.addEventListener('input', () => this.updateSingleDefaultButtonState(i));
                    // Prevent scroll wheel from changing value but allow page scrolling
                    depthBiasInput.addEventListener('wheel', (e) => {
                        (e.target as HTMLInputElement).blur();
                    });
                }

                const pngScaleFactorInput = document.getElementById(`png-scale-factor-${i}`) as HTMLInputElement;
                if (pngScaleFactorInput) {
                    pngScaleFactorInput.addEventListener('input', () => this.updateSingleDefaultButtonState(i));
                    // Prevent scroll wheel from changing value but allow page scrolling
                    pngScaleFactorInput.addEventListener('wheel', (e) => {
                        (e.target as HTMLInputElement).blur();
                    });
                }

                const conventionSelect = document.getElementById(`convention-${i}`) as HTMLSelectElement;
                if (conventionSelect) {
                    conventionSelect.addEventListener('change', () => this.updateSingleDefaultButtonState(i));
                }

                // Apply Deptn settings button
                const applyDepthBtn = document.querySelector(`.apply-depth-settings[data-file-index="${i}"]`);
                if (applyDepthBtn) {
                    applyDepthBtn.addEventListener('click', async () => {
                        await this.applyDepthSettings(i);
                    });
                }

                // Use as Default settings button
                const useAsDefaultBtn = document.querySelector(`.use-as-default-settings[data-file-index="${i}"]`);
                if (useAsDefaultBtn) {
                    useAsDefaultBtn.addEventListener('click', async () => {
                        await this.useAsDefaultSettings(i);
                    });
                }

                // Reset to Default settings button
                const resetToDefaultBtn = document.querySelector(`.reset-to-default-settings[data-file-index="${i}"]`);
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
                const selectColorImageBtn = document.querySelector(`.select-color-image[data-file-index="${i}"]`);
                if (selectColorImageBtn) {
                    selectColorImageBtn.addEventListener('click', () => {
                        this.requestColorImageForDepth(i);
                    });
                }

                // Remove color image button
                const removeColorBtn = document.querySelector(`.remove-color-image[data-file-index="${i}"]`);
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
                const resetDisparityOffsetBtn = document.querySelector(`.reset-disparity-offset[data-file-index="${i}"]`);
                if (resetDisparityOffsetBtn) {
                    resetDisparityOffsetBtn.addEventListener('click', () => {
                        this.resetDisparityOffset(i);
                    });
                }

                // Reset principle point button
                const resetPrinciplePointBtn = document.querySelector(`.reset-principle-point[data-file-index="${i}"]`);
                if (resetPrinciplePointBtn) {
                    resetPrinciplePointBtn.addEventListener('click', () => {
                        this.resetPrinciplePoint(i);
                    });
                }
            }
        }
        
        // Add remove button listeners
        const removeButtons = fileListDiv.querySelectorAll('.remove-file:not([data-listener-attached])');
        removeButtons.forEach(button => {
            button.setAttribute('data-listener-attached', 'true');
            button.addEventListener('click', (e) => {
                const fileIndex = parseInt((e.target as HTMLElement).getAttribute('data-file-index') || '0');
                this.requestRemoveFile(fileIndex);
            });
        });

        // Add MTL button listeners for OBJ files
        const mtlButtons = fileListDiv.querySelectorAll('.load-mtl-btn:not([data-listener-attached])');
        mtlButtons.forEach(button => {
            button.setAttribute('data-listener-attached', 'true');
            button.addEventListener('click', (e) => {
                const fileIndex = parseInt((e.target as HTMLElement).getAttribute('data-file-index') || '0');
                this.requestLoadMtl(fileIndex);
            });
        });
        
        // Add universal render mode button listeners (solid, wireframe, points, normals)
        const renderModeButtons = fileListDiv.querySelectorAll('.render-mode-btn:not([data-listener-attached])');
        if (renderModeButtons.length > 0) {
            console.log(`Found ${renderModeButtons.length} render mode buttons to attach listeners to`);
            renderModeButtons.forEach(button => {
                button.setAttribute('data-listener-attached', 'true');
                button.addEventListener('click', (e) => {
                    const target = e.target as HTMLElement;
                    const fileIndex = parseInt(target.getAttribute('data-file-index') || '0');
                    const mode = target.getAttribute('data-mode') || 'solid';
                    console.log(`🔘 Render button clicked: fileIndex=${fileIndex}, mode=${mode}`);
                    this.toggleUniversalRenderMode(fileIndex, mode);
                });
            });
        }
        
        // Add points/normals toggle button listeners
        const pointsToggleButtons = fileListDiv.querySelectorAll('.points-toggle-btn:not([data-listener-attached])');
        pointsToggleButtons.forEach(button => {
            button.setAttribute('data-listener-attached', 'true');
            button.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                const fileIndex = parseInt(target.getAttribute('data-file-index') || '0');
                this.togglePointsVisibility(fileIndex);
                this.updatePointsNormalsButtonStates();
            });
        });
        
        const normalsToggleButtons = fileListDiv.querySelectorAll('.normals-toggle-btn:not([data-listener-attached])');
        normalsToggleButtons.forEach(button => {
            button.setAttribute('data-listener-attached', 'true');
            button.addEventListener('click', (e) => {
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
        if (fileIndex < 0) return;
        // Determine desired visibility from checkbox state
        const checkboxEl = document.getElementById(`file-${fileIndex}`) as HTMLInputElement | null;
        const desiredVisible = checkboxEl ? !!checkboxEl.checked : !(this.fileVisibility[fileIndex] ?? true);
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
        const poseIndex = fileIndex - this.plyFiles.length;
        if (poseIndex >= 0 && poseIndex < this.poseGroups.length) {
            const group = this.poseGroups[poseIndex];
            if (group) group.visible = desiredVisible;
            const labels = this.poseLabelsGroups[poseIndex];
            if (labels) labels.visible = desiredVisible;
            return;
        }
        
        // Camera entries are appended after poses
        const cameraIndex = fileIndex - this.plyFiles.length - this.poseGroups.length;
        if (cameraIndex >= 0 && cameraIndex < this.cameraGroups.length) {
            const group = this.cameraGroups[cameraIndex];
            if (group) group.visible = desiredVisible;
        }
    }
    
    /**
     * Universal render mode toggle for all file types
     * Handles solid, wireframe, points, and normals rendering modes
     */
    private toggleUniversalRenderMode(fileIndex: number, mode: string): void {
        console.log(`🔄 toggleUniversalRenderMode called: fileIndex=${fileIndex}, mode=${mode}`);
        if (fileIndex < 0 || fileIndex >= this.plyFiles.length) {
            console.log(`❌ Invalid fileIndex: ${fileIndex}, plyFiles.length=${this.plyFiles.length}`);
            return;
        }
        
        const data = this.plyFiles[fileIndex];
        console.log(`📋 File data:`, data?.fileName);
        
        switch (mode) {
            case 'solid':
            case 'mesh':
                this.toggleSolidRendering(fileIndex);
                break;
            case 'wireframe':
                this.toggleWireframeRendering(fileIndex);
                break;
            case 'points':
                this.togglePointsRendering(fileIndex);
                break;
            case 'normals':
                this.toggleNormalsRendering(fileIndex);
                break;
        }
        
        // Update button states after mode change
        this.updateUniversalRenderButtonStates();
    }
    
    private toggleSolidRendering(fileIndex: number): void {
        if (fileIndex < 0 || fileIndex >= this.plyFiles.length) return;
        
        // Ensure array is properly sized with default values
        while (this.solidVisible.length <= fileIndex) {
            const data = this.plyFiles[this.solidVisible.length];
            const defaultValue = data && data.faceCount > 0; // Default true for meshes, false for point clouds
            this.solidVisible.push(defaultValue);
        }
        
        // Toggle solid visibility state
        this.solidVisible[fileIndex] = !this.solidVisible[fileIndex];
        
        this.updateMeshVisibilityAndMaterial(fileIndex);
        this.requestRender();
        // this.requestRender();
    }
    
    private toggleWireframeRendering(fileIndex: number): void {
        if (fileIndex < 0 || fileIndex >= this.plyFiles.length) return;
        
        // Ensure array is properly sized with default values
        while (this.wireframeVisible.length <= fileIndex) {
            this.wireframeVisible.push(false); // Wireframe always defaults to false
        }
        
        // Toggle wireframe visibility state
        this.wireframeVisible[fileIndex] = !this.wireframeVisible[fileIndex];
        
        this.updateMeshVisibilityAndMaterial(fileIndex);
        this.requestRender();
        // this.requestRender();
    }
    
    private togglePointsRendering(fileIndex: number): void {
        if (fileIndex < 0 || fileIndex >= this.plyFiles.length) return;
        
        // Ensure array is properly sized with default values
        while (this.pointsVisible.length <= fileIndex) {
            const data = this.plyFiles[this.pointsVisible.length];
            const defaultValue = !data || data.faceCount === 0; // Default true for point clouds, false for meshes
            this.pointsVisible.push(defaultValue);
        }
        
        // Toggle points visibility state
        this.pointsVisible[fileIndex] = !this.pointsVisible[fileIndex];
        
        this.updateMeshVisibilityAndMaterial(fileIndex);
        this.requestRender();
        // this.requestRender();
    }
    
    private updateMeshVisibilityAndMaterial(fileIndex: number): void {
        const mesh = this.meshes[fileIndex];
        const multiMaterialGroup = this.multiMaterialGroups[fileIndex];
        
        // Handle either regular mesh or multi-material OBJ group
        const target = multiMaterialGroup || mesh;
        if (!target) {
            console.log(`No mesh or multi-material group found for file ${fileIndex}`);
            return;
        }
        
        const solidVisible = this.solidVisible[fileIndex] ?? true;
        const wireframeVisible = this.wireframeVisible[fileIndex] ?? false;
        const pointsVisible = this.pointsVisible[fileIndex] ?? true;
        const fileVisible = this.fileVisibility[fileIndex] ?? true;
        
        // Set visibility for the target (mesh or multi-material group)
        if (mesh && mesh.type === 'Points') {
            // Point cloud case
            mesh.visible = pointsVisible && fileVisible;
        } else {
            // Triangle mesh or multi-material group case
            target.visible = (solidVisible || wireframeVisible) && fileVisible;
            
            // Handle vertex points visualization for triangle meshes
            if (mesh) { // Only for regular meshes, not multi-material groups
                this.updateVertexPointsVisualization(fileIndex, pointsVisible, solidVisible, wireframeVisible, fileVisible);
            } else if (multiMaterialGroup) {
                // Handle points for multi-material OBJ groups independently
                this.updateMultiMaterialPointsVisualization(fileIndex, pointsVisible, fileVisible);
            }
        }
        
        // Handle different rendering combinations:
        // 1. Only solid active: show solid mesh
        // 2. Only wireframe active: show wireframe mesh  
        // 3. Both active: show solid mesh (mesh takes precedence)
        // 4. Neither active: mesh is hidden (handled by visibility check above)
        
        // Update materials for wireframe mode
        if (multiMaterialGroup) {
            // Handle multi-material OBJ groups
            const subMeshes = this.materialMeshes[fileIndex];
            if (subMeshes) {
                subMeshes.forEach(subMesh => {
                    if (subMesh instanceof THREE.Mesh && subMesh.material) {
                        const material = subMesh.material as THREE.Material;
                        if (material instanceof THREE.MeshBasicMaterial || material instanceof THREE.MeshLambertMaterial) {
                            material.wireframe = wireframeVisible && !solidVisible;
                            material.opacity = 1.0;
                            material.transparent = false;
                        }
                    }
                });
            }
        } else if (mesh && mesh.material) {
            // Handle regular single mesh
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(material => {
                    if (material instanceof THREE.MeshBasicMaterial || material instanceof THREE.MeshLambertMaterial) {
                        material.wireframe = wireframeVisible && !solidVisible;
                        material.opacity = 1.0;
                        material.transparent = false;
                    }
                });
            } else if (mesh.material instanceof THREE.MeshBasicMaterial || mesh.material instanceof THREE.MeshLambertMaterial) {
                mesh.material.wireframe = wireframeVisible && !solidVisible;
                mesh.material.opacity = 1.0;
                mesh.material.transparent = false;
            }
        }
    }
    
    private updateVertexPointsVisualization(fileIndex: number, pointsVisible: boolean, solidVisible: boolean, wireframeVisible: boolean, fileVisible: boolean): void {
        const mesh = this.meshes[fileIndex];
        if (!mesh || mesh.type === 'Points') return; // Skip if it's already a point cloud
        
        const shouldShowVertexPoints = pointsVisible && fileVisible;
        let vertexPointsObject = this.vertexPointsObjects[fileIndex];
        
        if (shouldShowVertexPoints && !vertexPointsObject) {
            // Create vertex points object
            vertexPointsObject = this.createVertexPointsFromMesh(mesh, fileIndex);
            if (vertexPointsObject) {
                this.vertexPointsObjects[fileIndex] = vertexPointsObject;
                this.scene.add(vertexPointsObject);
            }
        }
        
        if (vertexPointsObject) {
            vertexPointsObject.visible = shouldShowVertexPoints;
            // Update point size from slider
            if (vertexPointsObject.material instanceof THREE.PointsMaterial) {
                vertexPointsObject.material.size = this.pointSizes[fileIndex] || 1.0;
            }
        }
    }
    
    private createVertexPointsFromMesh(mesh: THREE.Object3D, fileIndex: number): THREE.Points | null {
        let geometry: THREE.BufferGeometry | null = null;
        
        // Extract geometry from mesh
        if (mesh instanceof THREE.Mesh) {
            geometry = mesh.geometry as THREE.BufferGeometry;
        } else if (mesh instanceof THREE.Group) {
            // For groups, find the first mesh child
            mesh.traverse((child) => {
                if (child instanceof THREE.Mesh && !geometry) {
                    geometry = child.geometry as THREE.BufferGeometry;
                }
            });
        }
        
        if (!geometry || !geometry.attributes.position) return null;
        
        // Create points geometry from mesh vertices
        const pointsGeometry = new THREE.BufferGeometry();
        pointsGeometry.setAttribute('position', geometry.attributes.position);
        
        // Copy colors if available
        if (geometry.attributes.color) {
            pointsGeometry.setAttribute('color', geometry.attributes.color);
        }
        
        // Create point material with current point size
        const currentPointSize = this.pointSizes[fileIndex] || 1.0;
        const pointsMaterial = new THREE.PointsMaterial({
            size: currentPointSize,
            vertexColors: geometry.attributes.color ? true : false,
            color: geometry.attributes.color ? undefined : 0x888888,
            sizeAttenuation: true,
            // Restore original quality settings
            transparent: true,
            alphaTest: 0.1,
            depthWrite: true,
            depthTest: true
        });
        
        const points = new THREE.Points(pointsGeometry, pointsMaterial);
        points.name = "Vertex Points";
        return points;
    }
    
    private updateMultiMaterialPointsVisualization(fileIndex: number, pointsVisible: boolean, fileVisible: boolean): void {
        const multiMaterialGroup = this.multiMaterialGroups[fileIndex];
        const subMeshes = this.materialMeshes[fileIndex];
        
        if (!multiMaterialGroup || !subMeshes) {
            return;
        }
        
        const shouldShowPoints = pointsVisible && fileVisible;
        
        // Update visibility for all point objects in the multi-material group
        for (const subMesh of subMeshes) {
            if ((subMesh as any).isPoints && subMesh instanceof THREE.Points) {
                subMesh.visible = shouldShowPoints;
            }
        }
    }
    
    private toggleNormalsRendering(fileIndex: number): void {
        if (fileIndex < 0 || fileIndex >= this.plyFiles.length) return;
        
        // Ensure array is properly sized with default values
        while (this.normalsVisible.length <= fileIndex) {
            this.normalsVisible.push(false); // Normals always default to false
        }
        
        // Toggle normals visibility state
        this.normalsVisible[fileIndex] = !this.normalsVisible[fileIndex];
        
        // Check if we have a normals visualizer, if not try to create one
        let normalsVisualizer = this.normalsVisualizers[fileIndex];
        
        console.log(`Normals toggle for file ${fileIndex}: visible=${this.normalsVisible[fileIndex]}, existing visualizer=${!!normalsVisualizer}`);
        
        if (!normalsVisualizer && this.normalsVisible[fileIndex]) {
            // Try to create normals visualizer 
            const plyData = this.plyFiles[fileIndex];
            const mesh = this.meshes[fileIndex];
            
            console.log(`Creating normals for file ${fileIndex}: hasNormals=${plyData?.hasNormals}, faceCount=${plyData?.faceCount}, meshType=${mesh?.type}`);
            
            if (plyData && mesh) {
                // Try to create normals visualizer in multiple ways:
                
                // 1. For PLY point clouds, try to use original normals data first
                if (plyData.fileName?.toLowerCase().endsWith('.ply') && mesh.type === 'Points') {
                    if (plyData.hasNormals && plyData.vertices.length > 0) {
                        normalsVisualizer = this.createNormalsVisualizer(plyData);
                    } else {
                        // Try to extract normals from Points geometry
                        normalsVisualizer = this.createPointCloudNormalsVisualizer(plyData, mesh);
                    }
                }
                // 2. For PLY triangle meshes, use computed normals from mesh geometry 
                else if (plyData.fileName?.toLowerCase().endsWith('.ply')) {
                    normalsVisualizer = this.createComputedNormalsVisualizer(plyData, mesh);
                }
                // 3. If PLY data has explicit normals and populated vertices array
                else if (plyData.hasNormals && plyData.vertices.length > 0) {
                    normalsVisualizer = this.createNormalsVisualizer(plyData);
                }
                // 4. If it's a triangle mesh, compute from geometry
                else if (mesh.type !== 'Points') {
                    normalsVisualizer = this.createComputedNormalsVisualizer(plyData, mesh);
                }
                // 5. Fallback: try any available data
                else if (plyData.faceCount > 0) {
                    normalsVisualizer = this.createComputedNormalsVisualizer(plyData, mesh);
                }
                
                if (normalsVisualizer) {
                    console.log(`✅ Created normals visualizer for file ${fileIndex}`);
                    this.normalsVisualizers[fileIndex] = normalsVisualizer;
                    this.scene.add(normalsVisualizer);
                } else {
                    console.log(`❌ Failed to create normals visualizer for file ${fileIndex}`);
                }
            }
        }
        
        if (normalsVisualizer) {
            const shouldBeVisible = this.normalsVisible[fileIndex] && (this.fileVisibility[fileIndex] ?? true);
            console.log(`Setting normals visualizer visibility: ${shouldBeVisible} (normals=${this.normalsVisible[fileIndex]}, file=${this.fileVisibility[fileIndex] ?? true})`);
            
            // Debug the normals visualizer
            const geometry = (normalsVisualizer as any).geometry;
            const material = (normalsVisualizer as any).material;
            console.log(`📏 Normals visualizer info:`, {
                name: normalsVisualizer.name,
                visible: normalsVisualizer.visible,
                geometryVertices: geometry?.attributes?.position?.count || 0,
                materialColor: material?.color?.getHexString?.() || 'unknown',
                position: normalsVisualizer.position,
                scale: normalsVisualizer.scale
            });
            
            normalsVisualizer.visible = shouldBeVisible;
        } else {
            console.log(`No normals visualizer found for file ${fileIndex}`);
        }
        this.requestRender();
        // this.requestRender();
    }
    
    private updateUniversalRenderButtonStates(): void {
        const renderModeButtons = document.querySelectorAll('.render-mode-btn');
        renderModeButtons.forEach(button => {
            const target = button as HTMLElement;
            const fileIndex = parseInt(target.getAttribute('data-file-index') || '0');
            const mode = target.getAttribute('data-mode') || 'solid';
            
            let isActive = false;
            switch (mode) {
                case 'solid':
                case 'mesh':
                    isActive = this.solidVisible[fileIndex] ?? true;
                    break;
                case 'wireframe':
                    isActive = this.wireframeVisible[fileIndex] ?? false;
                    break;
                case 'points':
                    isActive = this.pointsVisible[fileIndex] ?? true;
                    break;
                case 'normals':
                    isActive = this.normalsVisible[fileIndex] ?? false;
                    break;
            }
            
            // Update button visual state
            if (isActive) {
                target.style.background = 'var(--vscode-button-background)';
                target.style.color = 'var(--vscode-button-foreground)';
                target.classList.add('active');
            } else {
                target.style.background = 'var(--vscode-button-secondaryBackground)';
                target.style.color = 'var(--vscode-button-secondaryForeground)';
                target.classList.remove('active');
            }
        });
    }
    
    private showImmediateLoading(message: any): void {
        const fileName = message.fileName;
        const uiStartTime = performance.now();
        console.log(`Load: UI start ${fileName} at ${uiStartTime.toFixed(1)}ms`);
        
        // Store timing for complete analysis
        (window as any).loadingStartTime = uiStartTime;
        (window as any).absoluteStartTime = uiStartTime;
        
        // Show loading indicator immediately
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.classList.remove('hidden');
            loadingEl.innerHTML = `
                <div class="spinner"></div>
                <p>Loading ${fileName}...</p>
                <p class="loading-detail">Starting file processing...</p>
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

    private showError(message: string): void {
        // Log to console for developer tools visibility
        try { console.error(message); } catch (_) {}
        document.getElementById('loading')?.classList.add('hidden');
        const errorMsg = document.getElementById('error-message');
        const errorDiv = document.getElementById('error');
        
        if (errorMsg) {
            errorMsg.textContent = message;
        }
        
        if (errorDiv) {
            errorDiv.classList.remove('hidden');
            
            // Set up close button (only once)
            const closeBtn = document.getElementById('error-close');
            if (closeBtn) {
                    // debug
                if (!closeBtn.hasAttribute('data-listener-added')) {
                    closeBtn.setAttribute('data-listener-added', 'true');
                    closeBtn.addEventListener('click', () => {
                        // debug
                        this.clearError();
                    });
                    // debug
                } else {
                    // debug
                }
            } else {
                // debug
            }
        }
        
        // keep error visible in UI only
    }

    private clearError(): void {
        const errorDiv = document.getElementById('error');
        if (errorDiv) {
            errorDiv.classList.add('hidden');
        }
    }

    // File management methods
    private requestAddFile(): void {
        this.vscode.postMessage({
            type: 'addFile'
        });
    }

    private requestRemoveFile(fileIndex: number): void {
        this.vscode.postMessage({
            type: 'removeFile',
            fileIndex: fileIndex
        });
    }

    private requestLoadMtl(fileIndex: number): void {
        this.vscode.postMessage({
            type: 'loadMtl',
            fileIndex: fileIndex
        });
    }

    private requestColorImageForDepth(fileIndex: number): void {
        this.vscode.postMessage({
            type: 'selectColorImage',
            fileIndex: fileIndex
        });
    }

    private addNewFiles(newFiles: PlyData[]): void {
        for (const data of newFiles) {
            // Assign new file index
            data.fileIndex = this.plyFiles.length;
            
            // Add to data array
            this.plyFiles.push(data);
            
            // Initialize visibility states based on file type
            const isObjFile = (data as any).isObjFile;
            const objData = (data as any).objData;
            const isMultiMaterial = isObjFile && objData && objData.materialGroups && objData.materialGroups.length > 1;
            
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
                this.solidVisible.push(false);  // No mesh surface exists
                this.pointsVisible.push(true);  // Show actual point data
            }
            
            // Wireframe and normals always start disabled
            this.wireframeVisible.push(false);
            this.normalsVisible.push(false);
            
            // Initialize vertex points object (null initially, created on demand)
            this.vertexPointsObjects.push(null);
            
            // Initialize color mode before creating material
            const initialColorMode = this.useOriginalColors ? 'original' : 'assigned';
            this.individualColorModes.push(initialColorMode);
            // debug
            
            // Create geometry and material
            const geometry = this.createGeometryFromPlyData(data);
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
                        color: 0xff0000 // Red wireframe
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
                                    groupGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(faceVertices), 3));
                                    groupGeometry.setIndex(faceIndices);
                                    groupGeometry.computeVertexNormals();
                                    
                                    const groupMaterial = new THREE.MeshBasicMaterial({
                                        color: 0x808080, // Default gray - will be colored by MTL
                                        side: THREE.DoubleSide
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
                                    color: 0xff0000 // Default red - will be colored by MTL
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
                                pointGeometry.setAttribute('position', new THREE.BufferAttribute(pointPositions, 3));
                                
                                const pointMaterial = new THREE.PointsMaterial({ 
                                    color: 0xff0000, // Default red - will be colored by MTL
                                    size: this.pointSizes[data.fileIndex] || 0.001, // Use stored point size (world units)
                                    sizeAttenuation: true, // Use world-space sizing like other file types
                                    // Restore original quality settings
                                    transparent: true,
                                    alphaTest: 0.1,
                                    depthWrite: true,
                                    depthTest: true
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
                            vertexColors: data.hasColors
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
                        color: 0xff0000
                    });
                    
                    const wireframeMesh = new THREE.LineSegments(lineGeometry, lineMaterial);
                    (wireframeMesh as any).isLineSegments = true;
                    this.scene.add(wireframeMesh);
                    this.meshes.push(wireframeMesh);
                    this.requestRender();
                } else {
                    // Create regular mesh for PLY files
                    const shouldShowAsPoints = data.faceCount === 0;
                    const mesh = shouldShowAsPoints ?
                        this.createOptimizedPointCloud(geometry, material as THREE.PointsMaterial) :
                        new THREE.Mesh(geometry, material);
                    
                    this.scene.add(mesh);
                    this.meshes.push(mesh);
                    this.requestRender();
                }
            }
            // If sequence mode is active, only the current frame stays visible to avoid overloading the scene
            const isSeqMode = this.sequenceFiles.length > 0;
            const shouldBeVisible = !isSeqMode || (data.fileIndex === this.sequenceIndex);
            this.fileVisibility.push(shouldBeVisible);
            const lastObject = this.meshes[this.meshes.length - 1];
            if (lastObject) lastObject.visible = shouldBeVisible;
            const isObjFile3 = (data as any).isObjFile;
            // Universal default point size for all file types (now that all use world-space sizing)
            this.pointSizes.push(0.001);
            this.appliedMtlColors.push(null); // No MTL color applied initially
            this.appliedMtlNames.push(null); // No MTL material applied initially
            this.appliedMtlData.push(null); // No MTL data applied initially
            this.multiMaterialGroups.push(null); // No multi-material group initially
            this.materialMeshes.push(null); // No sub-meshes initially
            
            // Initialize transformation matrix for this file
            this.transformationMatrices.push(new THREE.Matrix4());
        }

        // Update UI
        this.updateFileList();
        this.updateFileStats();

        // debug
    }

    private removeFileByIndex(fileIndex: number): void {
        if (fileIndex < 0) { return; }

        // Determine if this index refers to a pose or a pointcloud/mesh
        if (fileIndex >= this.plyFiles.length) {
            const poseIndex = fileIndex - this.plyFiles.length;
            if (poseIndex < 0 || poseIndex >= this.poseGroups.length) { return; }

            const group = this.poseGroups[poseIndex];
            this.scene.remove(group);
            group.traverse((obj: any) => {
                if (obj.geometry && typeof obj.geometry.dispose === 'function') obj.geometry.dispose();
                if (obj.material) {
                    if (Array.isArray(obj.material)) obj.material.forEach((m: any) => m.dispose && m.dispose());
                    else if (typeof obj.material.dispose === 'function') obj.material.dispose();
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
            this.updateFileList();
            this.updateFileStats();
            return;
        }

        if (fileIndex >= this.plyFiles.length) { return; }

        // Remove mesh from scene
        const mesh = this.meshes[fileIndex];
        this.scene.remove(mesh);
        if (mesh.geometry) {mesh.geometry.dispose();}
        if (mesh.material) {
            if (Array.isArray(mesh.material)) {
                mesh.material.forEach(mat => mat.dispose());
            } else {
                mesh.material.dispose();
            }
        }

        // Remove from arrays
        this.plyFiles.splice(fileIndex, 1);
        this.meshes.splice(fileIndex, 1);
        this.fileVisibility.splice(fileIndex, 1);
        this.pointSizes.splice(fileIndex, 1); // Remove point size for this file
        this.individualColorModes.splice(fileIndex, 1); // Remove color mode for this file
        this.appliedMtlColors.splice(fileIndex, 1); // Remove MTL color for this file
        this.appliedMtlNames.splice(fileIndex, 1); // Remove MTL name for this file
        this.appliedMtlData.splice(fileIndex, 1); // Remove MTL data for this file
        this.multiMaterialGroups.splice(fileIndex, 1); // Remove multi-material group for this file
        this.materialMeshes.splice(fileIndex, 1); // Remove sub-meshes for this file
        
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

        // Reassign file indices
        for (let i = 0; i < this.plyFiles.length; i++) {
            this.plyFiles[i].fileIndex = i;
        }

        // Update UI
        this.updateFileList();
        this.updateFileStats();
        
        // debug
    }

    private async handleUltimateRawBinaryData(message: any): Promise<void> {
        const startTime = performance.now();
        
        // Parse raw binary data directly in webview
        const rawData = new Uint8Array(message.rawBinaryData);
        const dataView = new DataView(rawData.buffer, rawData.byteOffset, rawData.byteLength);
        const propertyOffsets = new Map(message.propertyOffsets);
        const vertexStride = message.vertexStride;
        const vertexCount = message.vertexCount;
        const littleEndian = message.littleEndian;
        const faceCountType = message.faceCountType as (string | undefined);
        const faceIndexType = message.faceIndexType as (string | undefined);
        
        // concise timing printed after
        
        // Pre-allocate TypedArrays for maximum performance
        const positions = new Float32Array(vertexCount * 3);
        const colors = message.hasColors ? new Uint8Array(vertexCount * 3) : null;
        const normals = message.hasNormals ? new Float32Array(vertexCount * 3) : null;
        
        // Get property offsets
        const xOffset = propertyOffsets.get('x');
        const yOffset = propertyOffsets.get('y');
        const zOffset = propertyOffsets.get('z');
        const redOffset = propertyOffsets.get('red');
        const greenOffset = propertyOffsets.get('green');
        const blueOffset = propertyOffsets.get('blue');
        const nxOffset = propertyOffsets.get('nx');
        const nyOffset = propertyOffsets.get('ny');
        const nzOffset = propertyOffsets.get('nz');
        
        // Helper function to read binary value based on type
        const readBinaryValue = (offset: number, type: string): number => {
            switch (type) {
                case 'char': case 'int8':
                    return dataView.getInt8(offset);
                case 'uchar': case 'uint8':
                    return dataView.getUint8(offset);
                case 'short': case 'int16':
                    return dataView.getInt16(offset, littleEndian);
                case 'ushort': case 'uint16':
                    return dataView.getUint16(offset, littleEndian);
                case 'int': case 'int32':
                    return dataView.getInt32(offset, littleEndian);
                case 'uint': case 'uint32':
                    return dataView.getUint32(offset, littleEndian);
                case 'float': case 'float32':
                    return dataView.getFloat32(offset, littleEndian);
                case 'double': case 'float64':
                    return dataView.getFloat64(offset, littleEndian);
                default:
                    throw new Error(`Unsupported data type: ${type}`);
            }
        };

        // Ultra-fast direct binary parsing with proper type handling
        for (let i = 0; i < vertexCount; i++) {
            const vertexOffset = i * vertexStride;
            const i3 = i * 3;
            
            // Read positions with correct data type
            if (xOffset) positions[i3] = readBinaryValue(vertexOffset + (xOffset as any).offset, (xOffset as any).type);
            if (yOffset) positions[i3 + 1] = readBinaryValue(vertexOffset + (yOffset as any).offset, (yOffset as any).type);
            if (zOffset) positions[i3 + 2] = readBinaryValue(vertexOffset + (zOffset as any).offset, (zOffset as any).type);
            
            // Read colors with correct data type
            if (colors && redOffset) colors[i3] = readBinaryValue(vertexOffset + (redOffset as any).offset, (redOffset as any).type);
            if (colors && greenOffset) colors[i3 + 1] = readBinaryValue(vertexOffset + (greenOffset as any).offset, (greenOffset as any).type);
            if (colors && blueOffset) colors[i3 + 2] = readBinaryValue(vertexOffset + (blueOffset as any).offset, (blueOffset as any).type);
            
            // Read normals with correct data type
            if (normals && nxOffset) normals[i3] = readBinaryValue(vertexOffset + (nxOffset as any).offset, (nxOffset as any).type);
            if (normals && nyOffset) normals[i3 + 1] = readBinaryValue(vertexOffset + (nyOffset as any).offset, (nyOffset as any).type);
            if (normals && nzOffset) normals[i3 + 2] = readBinaryValue(vertexOffset + (nzOffset as any).offset, (nzOffset as any).type);
        }
        
        const parseTime = performance.now();
        console.log(`Load: parse ${message.fileName} ${(parseTime - startTime).toFixed(1)}ms`);
        
        // Create PLY data object with TypedArrays
        const plyData: PlyData = {
            vertices: [], // Empty - not used
            faces: [],
            format: message.format,
            version: '1.0',
            comments: message.comments || [],
            vertexCount: message.vertexCount,
            faceCount: message.faceCount,
            hasColors: message.hasColors,
            hasNormals: message.hasNormals,
            fileName: message.fileName
        };
        
        // Attach TypedArrays
        (plyData as any).useTypedArrays = true;
        (plyData as any).positionsArray = positions;
        (plyData as any).colorsArray = colors;
        (plyData as any).normalsArray = normals;

        // Faces: if face info was provided in header, read faces after vertex block
        // Note: rawBinaryData starts at vertex buffer; if faces follow, they are after vertexStride * vertexCount bytes
        if (message.faceCount && faceCountType && faceIndexType) {
            const faceStart = vertexStride * vertexCount;
            // debug faces summary
            if (faceStart < rawData.byteLength) {
                let offs = 0; // Offset within the face DataView (already anchored at faceStart)
                const dv = new DataView(rawData.buffer, rawData.byteOffset + faceStart, rawData.byteLength - faceStart);
                const readVal = (off: number, type: string): { val: number, next: number } => {
                    switch (type) {
                        case 'char': case 'int8': return { val: dv.getInt8(off), next: off + 1 };
                        case 'uchar': case 'uint8': return { val: dv.getUint8(off), next: off + 1 };
                        case 'short': case 'int16': return { val: dv.getInt16(off, littleEndian), next: off + 2 };
                        case 'ushort': case 'uint16': return { val: dv.getUint16(off, littleEndian), next: off + 2 };
                        case 'int': case 'int32': return { val: dv.getInt32(off, littleEndian), next: off + 4 };
                        case 'uint': case 'uint32': return { val: dv.getUint32(off, littleEndian), next: off + 4 };
                        case 'float': case 'float32': return { val: dv.getFloat32(off, littleEndian), next: off + 4 };
                        case 'double': case 'float64': return { val: dv.getFloat64(off, littleEndian), next: off + 8 };
                        default: throw new Error(`Unsupported face type: ${type}`);
                    }
                };
                // Sample first few faces for sanity logging
                const sampleCount = Math.min(5, message.faceCount);
                const sampleSummary: Array<{ count: number, firstIdxs: number[] }> = [];
                let sampleOffs = 0;
                for (let sf = 0; sf < sampleCount && sampleOffs < dv.byteLength; sf++) {
                    let r = readVal(sampleOffs, faceCountType);
                    const cnt = r.val >>> 0; sampleOffs = r.next;
                    const firstIdxs: number[] = [];
                    for (let j = 0; j < Math.min(cnt, 4) && sampleOffs < dv.byteLength; j++) {
                        r = readVal(sampleOffs, faceIndexType);
                        firstIdxs.push(r.val >>> 0);
                        sampleOffs = r.next;
                    }
                    // Skip rest of indices for sampling
                    for (let j = Math.min(cnt, 4); j < cnt && sampleOffs < dv.byteLength; j++) {
                        r = readVal(sampleOffs, faceIndexType);
                        sampleOffs = r.next;
                    }
                    sampleSummary.push({ count: cnt, firstIdxs });
                }
                // debug sample
                for (let f = 0; f < message.faceCount; f++) {
                    let res = readVal(offs, faceCountType);
                    const cnt = res.val >>> 0; // count is non-negative
                    offs = res.next;
                    const indices: number[] = new Array(cnt);
                    for (let j = 0; j < cnt; j++) {
                        res = readVal(offs, faceIndexType);
                        indices[j] = res.val >>> 0;
                        offs = res.next;
                    }
                    plyData.faces.push({ indices });
                }
            }
        }
        
        console.log(`Load: total ${(performance.now() - startTime).toFixed(1)}ms`);
        
        // Process as normal
        const displayStartTime = performance.now();
        if (message.messageType === 'multiPlyData') {
            await this.displayFiles([plyData]);
        } else if (message.messageType === 'addFiles') {
            this.addNewFiles([plyData]);
        }
        
        // Normals visualizer will be created on-demand when user clicks normals button
        // This ensures vertices are fully parsed before creating normals
        const displayTime = performance.now() - displayStartTime;
        
        // Comprehensive timing analysis
        // For add files, use message receive time as absolute start since there's no UI loading phase
        const absoluteStartTime = message.messageType === 'addFiles' ? startTime : ((window as any).absoluteStartTime || startTime);
        const absoluteCompleteTime = performance.now() - absoluteStartTime;
        this.lastAbsoluteMs = absoluteCompleteTime;
        const webviewCompleteTime = performance.now() - startTime;
        
        console.log(`Load: visible ${webviewCompleteTime.toFixed(1)}ms @ ${new Date().toISOString()}`);
        
        if (message.messageType === 'addFiles') {
            console.log(`Load: add-file total ${absoluteCompleteTime.toFixed(1)}ms @ ${new Date().toISOString()}`);
        } else {
            console.log(`Load: absolute total ${absoluteCompleteTime.toFixed(1)}ms @ ${new Date().toISOString()}`);
        }
        
        // Calculate performance metrics
        const totalVertices = message.vertexCount;
        const verticesPerSecond = Math.round(totalVertices / (absoluteCompleteTime / 1000));
        const modeLabel = message.messageType === 'addFiles' ? 'ADD FILE' : 'ULTIMATE';
        // concise metrics printed above
    }

    private async handleDirectTypedArrayData(message: any): Promise<void> {
        // debug
        const startTime = performance.now();
        
        // Create PLY data object with direct TypedArrays
        const plyData: PlyData = {
            vertices: [], // Empty - not used
            faces: [],
            format: message.format,
            version: '1.0',
            comments: message.comments || [],
            vertexCount: message.vertexCount,
            faceCount: message.faceCount,
            hasColors: message.hasColors,
            hasNormals: message.hasNormals,
            fileName: message.fileName
        };
        
        // Attach direct TypedArrays
        (plyData as any).useTypedArrays = true;
        (plyData as any).positionsArray = new Float32Array(message.positionsBuffer);
        (plyData as any).colorsArray = message.colorsBuffer ? new Uint8Array(message.colorsBuffer) : null;
        (plyData as any).normalsArray = message.normalsBuffer ? new Float32Array(message.normalsBuffer) : null;
        
        console.log(`Load: typedarray ${(performance.now() - startTime).toFixed(1)}ms`);
        
        // Process as normal - but now with TypedArrays!
        if (message.messageType === 'multiPlyData') {
            await this.displayFiles([plyData]);
        } else if (message.messageType === 'addFiles') {
            this.addNewFiles([plyData]);
        }
        
        // Normals visualizer will be created on-demand when user clicks normals button
    }

    private async handleBinaryPlyData(message: any): Promise<void> {
        const receiveTime = performance.now();
        // For add files, we don't have a loadingStartTime, so use receiveTime as reference
        const loadingStartTime = (window as any).loadingStartTime || receiveTime;
        const extensionProcessingTime = receiveTime - loadingStartTime;
        
        console.log(`Load: received ${message.fileName}, ext ${(extensionProcessingTime).toFixed(1)}ms`);
        
        const startTime = performance.now();
        
        // Convert binary ArrayBuffers back to PLY data format
        const plyData: PlyData = {
            vertices: [],
            faces: [],
            format: message.format,
            version: '1.0',
            comments: message.comments || [],
            vertexCount: message.vertexCount,
            faceCount: message.faceCount,
            hasColors: message.hasColors,
            hasNormals: message.hasNormals,
            fileName: message.fileName
        };
        
        // Convert position buffer
        const positionArray = new Float32Array(message.positionBuffer);
        
        // Convert color buffer if present
        let colorArray: Uint8Array | null = null;
        if (message.colorBuffer) {
            colorArray = new Uint8Array(message.colorBuffer);
        }
        
        // Convert normal buffer if present
        let normalArray: Float32Array | null = null;
        if (message.normalBuffer) {
            normalArray = new Float32Array(message.normalBuffer);
        }
        
        // Reconstruct vertices from binary data
        for (let i = 0; i < message.vertexCount; i++) {
            const vertex: PlyVertex = {
                x: positionArray[i * 3],
                y: positionArray[i * 3 + 1],
                z: positionArray[i * 3 + 2]
            };
            
            // Add colors if present
            if (colorArray && message.hasColors) {
                vertex.red = colorArray[i * 3];
                vertex.green = colorArray[i * 3 + 1];
                vertex.blue = colorArray[i * 3 + 2];
            }
            
            // Add normals if present
            if (normalArray && message.hasNormals) {
                vertex.nx = normalArray[i * 3];
                vertex.ny = normalArray[i * 3 + 1];
                vertex.nz = normalArray[i * 3 + 2];
            }
            
            plyData.vertices.push(vertex);
        }
        
        // Convert face buffer if present
        if (message.indexBuffer) {
            const indexArray = new Uint32Array(message.indexBuffer);
            // The buffer already represents triangulated indices; push as triples
            for (let i = 0; i < indexArray.length; i += 3) {
                plyData.faces.push({
                    indices: [indexArray[i], indexArray[i + 1], indexArray[i + 2]]
                });
            }
        }
        
        const conversionTime = performance.now() - startTime;
        console.log(`Load: convert ${(conversionTime).toFixed(1)}ms`);
        
        // Handle based on message type
        if (message.messageType === 'addFiles') {
            this.addNewFiles([plyData]);
        } else {
            await this.displayFiles([plyData]);
        }
        
        // Normals visualizer will be created on-demand when user clicks normals button
        
        // Complete timing analysis
        const totalTime = performance.now();
        const completeLoadTime = totalTime - loadingStartTime;
        // For add files, use receive time as absolute start since there's no UI loading phase
        const absoluteStartTime = message.messageType === 'addFiles' ? receiveTime : ((window as any).absoluteStartTime || loadingStartTime);
        const absoluteCompleteTime = totalTime - absoluteStartTime;
        const geometryTime = totalTime - startTime - conversionTime;
        
        const ts = new Date().toISOString();
        
        // Calculate hidden time gaps
        const measuredTime = extensionProcessingTime + conversionTime + geometryTime;
        const hiddenTime = completeLoadTime - measuredTime;
        
        // Performance summary
        const totalVertices = message.vertexCount;
        const verticesPerSecond = Math.round(totalVertices / (absoluteCompleteTime / 1000));
        
        const performanceLog = `Load: complete ${completeLoadTime.toFixed(1)}ms, absolute ${absoluteCompleteTime.toFixed(1)}ms @ ${ts}
📊 Breakdown: Extension ${extensionProcessingTime.toFixed(1)}ms + Conversion ${conversionTime.toFixed(1)}ms + Geometry ${geometryTime.toFixed(1)}ms`;
        
        if (hiddenTime > 10) {
            console.log(performanceLog + `\n🔍 HIDDEN TIME: ${hiddenTime.toFixed(1)}ms (unmeasured overhead)\n🚀 PERFORMANCE: ${totalVertices.toLocaleString()} vertices in ${absoluteCompleteTime.toFixed(1)}ms (${verticesPerSecond.toLocaleString()} vertices/sec)`);
        } else {
            console.log(performanceLog + `\n🚀 PERFORMANCE: ${totalVertices.toLocaleString()} vertices in ${absoluteCompleteTime.toFixed(1)}ms (${verticesPerSecond.toLocaleString()} vertices/sec)`);
        }
    }

    private handleStartLargeFile(message: any): void {
        const startTime = performance.now();
        console.log(`Starting chunked loading for ${message.fileName} (${message.totalVertices} vertices, ${message.totalChunks} chunks)`);
        
        // Show loading progress
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.classList.remove('hidden');
            loadingEl.textContent = `Loading ${message.fileName} (0/${message.totalChunks} chunks)...`;
        }

        // Initialize chunked file state
        this.chunkedFileState.set(message.fileName, {
            fileName: message.fileName,
            totalVertices: message.totalVertices,
            totalChunks: message.totalChunks,
            receivedChunks: 0,
            vertices: new Array(message.totalVertices),
            hasColors: message.hasColors,
            hasNormals: message.hasNormals,
            faces: message.faces || [],
            format: message.format,
            comments: message.comments || [],
            messageType: '',
            startTime: startTime,
            firstChunkTime: 0,
            lastChunkTime: 0
        });
    }

    private handleLargeFileChunk(message: any): void {
        const chunkReceiveTime = performance.now();
        const fileState = this.chunkedFileState.get(message.fileName);
        if (!fileState) {
            console.error(`No state found for chunked file: ${message.fileName}`);
            return;
        }

        // Record timing for first and last chunks
        if (fileState.receivedChunks === 0) {
            fileState.firstChunkTime = chunkReceiveTime;
            const timeSinceStart = chunkReceiveTime - fileState.startTime;
            console.log(`First chunk received after ${timeSinceStart.toFixed(2)}ms`);
        }

        // Add chunk vertices to the appropriate position  
        const startIndex = message.chunkIndex * 1000000; // Must match ultra-fast CHUNK_SIZE
        const chunkVertices = message.vertices;
        
        const copyStartTime = performance.now();
        for (let i = 0; i < chunkVertices.length; i++) {
            fileState.vertices[startIndex + i] = chunkVertices[i];
        }
        const copyTime = performance.now() - copyStartTime;

        fileState.receivedChunks++;
        fileState.lastChunkTime = chunkReceiveTime;

        // Update loading progress
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            const progress = Math.round((fileState.receivedChunks / fileState.totalChunks) * 100);
            loadingEl.textContent = `Loading ${message.fileName} (${fileState.receivedChunks}/${fileState.totalChunks} chunks, ${progress}%)...`;
        }

        // Only log every 10th chunk to reduce console spam
        if (message.chunkIndex % 10 === 0 || fileState.receivedChunks === fileState.totalChunks) {
            console.log(`Chunk ${message.chunkIndex + 1}/${message.totalChunks} (${chunkVertices.length} vertices, copy: ${copyTime.toFixed(2)}ms)`);
        }
    }

    private async handleLargeFileComplete(message: any): Promise<void> {
        const completeTime = performance.now();
        const fileState = this.chunkedFileState.get(message.fileName);
        if (!fileState) {
            console.error(`No state found for completed chunked file: ${message.fileName}`);
            return;
        }

        // Calculate comprehensive timing
        const totalTransferTime = completeTime - fileState.startTime;
        const firstChunkDelay = fileState.firstChunkTime - fileState.startTime;
        const transferTime = fileState.lastChunkTime - fileState.firstChunkTime;
        const assemblyStartTime = performance.now();

        console.log(`📊 Chunked loading timing for ${message.fileName}:
  • Total transfer time: ${totalTransferTime.toFixed(2)}ms
  • Time to first chunk: ${firstChunkDelay.toFixed(2)}ms
  • Chunk transfer time: ${transferTime.toFixed(2)}ms
  • Chunks: ${fileState.totalChunks} (${(transferTime / fileState.totalChunks).toFixed(2)}ms avg)`);

        // Create complete PLY data object
        const plyData: PlyData = {
            vertices: fileState.vertices,
            faces: fileState.faces,
            format: fileState.format as any,
            version: '1.0',
            comments: fileState.comments,
            vertexCount: fileState.totalVertices,
            faceCount: fileState.faces.length,
            hasColors: fileState.hasColors,
            hasNormals: fileState.hasNormals,
            fileName: fileState.fileName,
            fileIndex: 0
        };

        const assemblyTime = performance.now() - assemblyStartTime;

        // Process the completed file based on original message type
        const processStartTime = performance.now();
        if (message.messageType === 'multiPlyData') {
            await this.displayFiles([plyData]);
        } else if (message.messageType === 'addFiles') {
            this.addNewFiles([plyData]);
        }
        
        // Normals visualizer will be created on-demand when user clicks normals button
        const processTime = performance.now() - processStartTime;
        
        const totalTime = performance.now() - fileState.startTime;
        console.log(`  • PLY assembly time: ${assemblyTime.toFixed(2)}ms
  • File processing time: ${processTime.toFixed(2)}ms
  • TOTAL TIME: ${totalTime.toFixed(2)}ms`);

        // Hide loading indicator
        document.getElementById('loading')?.classList.add('hidden');

        // Clean up chunked file state
        this.chunkedFileState.delete(message.fileName);
    }

    private updatePointSize(fileIndex: number, newSize: number): void {
        if (fileIndex >= 0 && fileIndex < this.pointSizes.length) {
            const oldSize = this.pointSizes[fileIndex];
            console.log(`🎚️ Updating point size for file ${fileIndex}: ${oldSize} → ${newSize}`);
            this.pointSizes[fileIndex] = newSize;
            
            const isPose = fileIndex >= this.plyFiles.length && fileIndex < this.plyFiles.length + this.poseGroups.length;
            const isCamera = fileIndex >= this.plyFiles.length + this.poseGroups.length;
            const data = !isPose && !isCamera ? this.plyFiles[fileIndex] : undefined as any;
            const isObjFile = data ? (data as any).isObjFile : false;
            
            if (isCamera) {
                // Handle camera scaling by applying transformation matrix with scale
                this.applyTransformationMatrix(fileIndex);
            } else if (isPose) {
                // Update instanced sphere scale in pose group if stored using PointsMaterial size semantics is different.
                const poseIndex = fileIndex - this.plyFiles.length;
                const group = this.poseGroups[poseIndex];
                if (group) {
                    group.traverse((obj) => {
                        if ((obj as any).isInstancedMesh && obj instanceof THREE.InstancedMesh) {
                            // Rebuild or update instance matrices scaling
                            const count = obj.count;
                            const dummy = new THREE.Object3D();
                            for (let i = 0; i < count; i++) {
                                obj.getMatrixAt(i, dummy.matrix);
                                // Reset scale part and apply uniform scale by newSize
                                dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
                                dummy.scale.setScalar(newSize);
                                dummy.updateMatrix();
                                obj.setMatrixAt(i, dummy.matrix);
                            }
                            obj.instanceMatrix.needsUpdate = true;
                        }
                    });
                }
            } else if (isObjFile) {
                // Handle OBJ files - update both points and lines in multi-material groups
                const multiMaterialGroup = this.multiMaterialGroups[fileIndex];
                const subMeshes = this.materialMeshes[fileIndex];
                
                if (multiMaterialGroup && subMeshes) {
                    // Update all sub-meshes in multi-material OBJ
                    let pointsUpdated = 0;
                    
                    for (const subMesh of subMeshes) {
                        if ((subMesh as any).isPoints && subMesh instanceof THREE.Points) {
                            // Update point size
                            const material = (subMesh as any).material;
                            if (material instanceof THREE.PointsMaterial) {
                                material.size = newSize; // Use direct size for OBJ points
                                pointsUpdated++;
                            }
                        }
                        // Line width is now controlled separately by updateLineWidth method
                    }
                    
                    console.log(`✅ Updated ${pointsUpdated} point materials for OBJ file ${fileIndex}`);
                } else {
                    // Single OBJ mesh
                    const mesh = this.meshes[fileIndex];
                    if (mesh instanceof THREE.Points && mesh.material instanceof THREE.PointsMaterial) {
                        mesh.material.size = newSize; // Use direct size for OBJ points
                        console.log(`✅ Point size applied to single OBJ mesh for file ${fileIndex}: ${newSize}`);
                    }
                }
            } else {
                // Handle regular point clouds and mesh files (PLY, STL, etc.)
                const mesh = this.meshes[fileIndex];
                const data = this.plyFiles[fileIndex];
                
                if (mesh instanceof THREE.Points && mesh.material instanceof THREE.PointsMaterial) {
                    // Point cloud files
                    mesh.material.size = newSize;
                    console.log(`✅ Point size applied to point cloud for file ${fileIndex}: ${newSize}`);
                } else if (mesh instanceof THREE.Mesh && data && data.faceCount > 0) {
                    // Triangle mesh files (STL, PLY with faces) - create a point representation
                    // Check if we already have a points overlay for this mesh
                    let pointsOverlay = (mesh as any).__pointsOverlay;
                    
                    if (!pointsOverlay && mesh.geometry) {
                        // Create a points overlay using the same geometry
                        const pointsMaterial = new THREE.PointsMaterial({ 
                            color: 0xffffff, 
                            size: newSize,
                            sizeAttenuation: true,
                            // Restore original quality settings
                            transparent: true,
                            alphaTest: 0.1,
                            depthWrite: true,
                            depthTest: true
                        });
                        pointsOverlay = new THREE.Points(mesh.geometry, pointsMaterial);
                        pointsOverlay.visible = false; // Hidden by default
                        (mesh as any).__pointsOverlay = pointsOverlay;
                        mesh.add(pointsOverlay);
                    }
                    
                    if (pointsOverlay && pointsOverlay.material instanceof THREE.PointsMaterial) {
                        pointsOverlay.material.size = newSize;
                        // For meshes, we'll show the points overlay when point size is adjusted
                        pointsOverlay.visible = newSize > 0.5; // Show points when size is meaningful
                        console.log(`✅ Point size applied to mesh overlay for file ${fileIndex}: ${newSize}`);
                    }
                    
                } else {
                    console.warn(`⚠️ Could not apply point size for file ${fileIndex}: unsupported mesh type\nMesh type: ${mesh?.constructor.name}, Material type: ${mesh?.material?.constructor.name}`);
                }
            }
            
            // Always update vertex points object if it exists (used by render modes for ALL file types)
            const vertexPointsObject = this.vertexPointsObjects[fileIndex];
            if (vertexPointsObject && vertexPointsObject.material instanceof THREE.PointsMaterial) {
                vertexPointsObject.material.size = newSize;
                console.log(`✅ Point size applied to vertex points for file ${fileIndex}: ${newSize}`);
            }
        } else {
            console.error(`❌ Invalid fileIndex ${fileIndex} for pointSizes array of length ${this.pointSizes.length}`);
        }
    }

    private getColorName(fileIndex: number): string {
        const colorNames = ['White', 'Red', 'Green', 'Blue', 'Yellow', 'Magenta', 'Cyan', 'Orange', 'Purple', 'Dark Green', 'Gray'];
        return colorNames[fileIndex % colorNames.length];
    }

    private getColorOptions(fileIndex: number): string {
        let options = '';
        for (let i = 0; i < this.fileColors.length; i++) {
            const isSelected = this.individualColorModes[fileIndex] === i.toString();
            options += `<option value="${i}" ${isSelected ? 'selected' : ''}>${this.getColorName(i)}</option>`;
        }
        return options;
    }

    // ===== Pose feature updaters =====
    private updatePoseAppearance(fileIndex: number): void {
        const poseIndex = fileIndex - this.plyFiles.length;
        if (poseIndex < 0 || poseIndex >= this.poseGroups.length) return;
        const group = this.poseGroups[poseIndex];
        const meta = this.poseMeta[poseIndex];
        const useDataset = this.poseUseDatasetColors[fileIndex];
        const paletteColor = this.fileColors[fileIndex % this.fileColors.length];
        group.traverse(obj => {
            if ((obj as any).isInstancedMesh && obj instanceof THREE.InstancedMesh) {
                const material = obj.material as THREE.MeshBasicMaterial;
                if (useDataset && meta.jointColors && meta.jointColors.length > 0) {
                    // Apply per-instance colors
                    const count = obj.count;
                    const colors = new Float32Array(count * 3);
                    for (let k = 0; k < count; k++) {
                        const c = meta.jointColors[k % meta.jointColors.length];
                        colors[k*3] = c[0]; colors[k*3+1] = c[1]; colors[k*3+2] = c[2];
                    }
                    obj.instanceColor = new THREE.InstancedBufferAttribute(colors, 3);
                    if (obj.instanceColor) { (obj.instanceColor as any).needsUpdate = true; }
                    material.vertexColors = true;
                    material.needsUpdate = true;
                } else {
                    // Use single color
                    obj.instanceColor = null;
                    material.vertexColors = false;
                    material.color.setRGB(paletteColor[0], paletteColor[1], paletteColor[2]);
                    material.needsUpdate = true;
                }
            } else if ((obj as any).isLineSegments && obj instanceof THREE.LineSegments) {
                const material = obj.material as THREE.LineBasicMaterial;
                if (useDataset && meta.linkColors && meta.linkColors.length > 0) {
                    // Build a new color buffer matching current positions
                    const posAttr = (obj.geometry.getAttribute('position') as THREE.BufferAttribute);
                    const segCount = posAttr.count / 2;
                    const colors = new Float32Array(posAttr.count * 3);
                    for (let s = 0; s < segCount; s++) {
                        const lc = meta.linkColors[s % meta.linkColors.length];
                        // two vertices per segment
                        colors[(2*s)*3] = lc[0]; colors[(2*s)*3+1] = lc[1]; colors[(2*s)*3+2] = lc[2];
                        colors[(2*s+1)*3] = lc[0]; colors[(2*s+1)*3+1] = lc[1]; colors[(2*s+1)*3+2] = lc[2];
                    }
                    // Remove old color attribute first to avoid interleaved conflicts
                    if (obj.geometry.getAttribute('color')) {
                        obj.geometry.deleteAttribute('color');
                    }
                    obj.geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
                    material.vertexColors = true;
                    material.needsUpdate = true;
                } else {
                    // Remove per-vertex colors and set solid color
                    if (obj.geometry.getAttribute('color')) {
                        obj.geometry.deleteAttribute('color');
                    }
                    material.vertexColors = false;
                    material.color.setRGB(paletteColor[0], paletteColor[1], paletteColor[2]);
                    material.needsUpdate = true;
                }
            }
        });
    }

    private updatePoseLabels(fileIndex: number): void {
        const poseIndex = fileIndex - this.plyFiles.length;
        if (poseIndex < 0 || poseIndex >= this.poseGroups.length) return;
        const show = this.poseShowLabels[fileIndex];
        const group = this.poseGroups[poseIndex];
        const joints = this.poseJoints[poseIndex] || [];
        const validMap: number[] = ((group as any).userData?.validJointIndices) || [];
        // Remove existing labels
        const existing = this.poseLabelsGroups[poseIndex];
        if (existing) { this.scene.remove(existing); this.poseLabelsGroups[poseIndex] = null; }
        if (!show) return;
        // Build a new labels group using simple Sprites
        const labelsGroup = new THREE.Group();
        const meta = this.poseMeta[poseIndex];
        const names = meta.keypointNames || [];
        const count = validMap.length > 0 ? validMap.length : joints.length;
        const makeLabel = (text: string): THREE.Sprite => {
            const canvas = document.createElement('canvas');
            const size = 256;
            canvas.width = size; canvas.height = size;
            const ctx = canvas.getContext('2d')!;
            ctx.clearRect(0,0,size,size);
            ctx.fillStyle = '#ffffff';
            ctx.font = '48px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(text, size/2, size/2);
            const texture = new THREE.CanvasTexture(canvas);
            const material = new THREE.SpriteMaterial({ map: texture, depthTest: false });
            const sprite = new THREE.Sprite(material);
            sprite.scale.set(0.1, 0.1, 1); // 10cm label size
            return sprite;
        };
        for (let k = 0; k < count; k++) {
            const originalIndex = (validMap.length === count) ? validMap[k] : k;
            const j = joints[originalIndex];
            if (!j || j.valid !== true) continue;
            const label = makeLabel(names[originalIndex] || `${originalIndex}`);
            label.position.set(j.x, j.y + (this.pointSizes[fileIndex] ?? 0.02) * 1.5, j.z);
            labelsGroup.add(label);
        }
        this.scene.add(labelsGroup);
        this.poseLabelsGroups[poseIndex] = labelsGroup;
    }

    private updatePoseScaling(fileIndex: number): void {
        const poseIndex = fileIndex - this.plyFiles.length;
        if (poseIndex < 0 || poseIndex >= this.poseGroups.length) return;
        const group = this.poseGroups[poseIndex];
        const baseRadius = this.pointSizes[fileIndex] ?? 0.02;
        const scaleByScore = this.poseScaleByScore[fileIndex];
        const scaleByUnc = this.poseScaleByUncertainty[fileIndex];
        // Fetch scores/uncertainties if available
        const meta = this.poseMeta[poseIndex];
        // Traverse instances and update scales
        group.traverse(obj => {
            if ((obj as any).isInstancedMesh && obj instanceof THREE.InstancedMesh) {
                const count = obj.count;
                const dummy = new THREE.Object3D();
                for (let k = 0; k < count; k++) {
                    obj.getMatrixAt(k, dummy.matrix);
                    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
                    let factor = 1.0;
                    if (scaleByScore && meta.jointScores && meta.jointScores[k] != null && isFinite(meta.jointScores[k]!)) {
                        const s = Math.max(0.01, Math.min(1.0, meta.jointScores[k]!));
                        factor *= (0.5 + 0.5 * s); // 0.5x .. 1x
                    }
                    if (scaleByUnc && meta.jointUncertainties && meta.jointUncertainties[k]) {
                        const u = meta.jointUncertainties[k];
                        const mag = Math.sqrt(u[0]*u[0] + u[1]*u[1] + u[2]*u[2]);
                        const mapped = 1.0 / (1.0 + mag); // higher uncertainty → smaller
                        factor *= (0.5 + 0.5 * mapped);
                    }
                    dummy.scale.setScalar(baseRadius * factor);
                    dummy.updateMatrix();
                    obj.setMatrixAt(k, dummy.matrix);
                }
                obj.instanceMatrix.needsUpdate = true;
            }
        });
    }

    private applyPoseConvention(fileIndex: number, conv: 'opengl'|'opencv'): void {
        const poseIndex = fileIndex - this.plyFiles.length;
        if (poseIndex < 0 || poseIndex >= this.poseGroups.length) return;
        const group = this.poseGroups[poseIndex];
        const prev = this.poseConvention[fileIndex] || 'opengl';
        if (prev === conv) return; // already applied
        // Toggle flip each time we switch; inverse = same flip
        const mat = new THREE.Matrix4().set(1,0,0,0, 0,-1,0,0, 0,0,-1,0, 0,0,0,1);
        group.applyMatrix4(mat);
        group.updateMatrixWorld(true);
        this.poseConvention[fileIndex] = conv;
    }

    private applyPoseFilters(fileIndex: number): void {
        const poseIndex = fileIndex - this.plyFiles.length;
        if (poseIndex < 0 || poseIndex >= this.poseGroups.length) return;
        const group = this.poseGroups[poseIndex];
        const meta = this.poseMeta[poseIndex];
        const minScore = this.poseMinScoreThreshold[fileIndex] ?? 0;
        const maxUnc = this.poseMaxUncertaintyThreshold[fileIndex] ?? 1;
        // Compute uncertainty magnitude per joint if available
        const uncMag = (meta.jointUncertainties || []).map(u => Math.sqrt(u[0]*u[0] + u[1]*u[1] + u[2]*u[2]));
        group.traverse(obj => {
                if ((obj as any).isInstancedMesh && obj instanceof THREE.InstancedMesh) {
                const count = obj.count;
                const dummy = new THREE.Object3D();
                    // Map instance index back to original joint index
                    const validMap: number[] = ((group as any).userData?.validJointIndices) || [];
                for (let k = 0; k < count; k++) {
                    obj.getMatrixAt(k, dummy.matrix);
                    dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
                    // Determine visibility by thresholds
                    let visible = true;
                        const originalIndex = (validMap.length === count) ? validMap[k] : k;
                        if (meta.jointScores && meta.jointScores[originalIndex] != null && isFinite(meta.jointScores[originalIndex]!)) {
                            if (meta.jointScores[originalIndex]! < minScore) visible = false;
                        }
                        if (uncMag && uncMag[originalIndex] != null && isFinite(uncMag[originalIndex]!)) {
                            if (uncMag[originalIndex]! > maxUnc) visible = false;
                        }
                    const targetScale = visible ? (this.pointSizes[fileIndex] ?? 0.02) : 0;
                    dummy.scale.setScalar(targetScale);
                    dummy.updateMatrix();
                    obj.setMatrixAt(k, dummy.matrix);
                }
                obj.instanceMatrix.needsUpdate = true;
            } else if ((obj as any).isLineSegments && obj instanceof THREE.LineSegments) {
                // Rebuild edges to drop hidden joints based on thresholds
                const validMap: number[] = ((group as any).userData?.validJointIndices) || [];
                const joints = this.poseJoints[poseIndex] || [];
                const edges = this.poseEdges[poseIndex] || [];
                const hidden = new Set<number>();
                // Determine hidden joints via thresholds
                const uncMagArr = (meta.jointUncertainties || []).map(u => Math.sqrt(u[0]*u[0] + u[1]*u[1] + u[2]*u[2]));
                for (let k = 0; k < joints.length; k++) {
                    const scoreOk = !(meta.jointScores && meta.jointScores[k] != null && isFinite(meta.jointScores[k]!) && meta.jointScores[k]! < minScore);
                    const uncOk = !(uncMagArr && uncMagArr[k] != null && isFinite(uncMagArr[k]!) && uncMagArr[k]! > maxUnc);
                    const visible = scoreOk && uncOk && joints[k] && joints[k].valid === true;
                    if (!visible) hidden.add(k);
                }
                const tempPositions: number[] = [];
                for (const [a, b] of edges) {
                    if (hidden.has(a) || hidden.has(b)) continue;
                    const pa = joints[a]; const pb = joints[b];
                    if (!pa || !pb) continue;
                    tempPositions.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
                }
                const newGeo = new THREE.BufferGeometry();
                newGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tempPositions), 3));
                obj.geometry.dispose();
                obj.geometry = newGeo;
            }
        });
    }

    private soloPointCloud(fileIndex: number): void {
        // Hide all objects (point clouds and poses)
        const totalEntries = this.plyFiles.length + this.poseGroups.length;
        for (let i = 0; i < totalEntries; i++) {
            this.fileVisibility[i] = false;
            if (i < this.meshes.length) {
                const obj = this.meshes[i];
                if (obj) obj.visible = false;
            } else {
                const poseIndex = i - this.plyFiles.length;
                const group = this.poseGroups[poseIndex];
                if (group) group.visible = false;
            }
        }
        // Show only the selected entry
        this.fileVisibility[fileIndex] = true;
        if (fileIndex < this.meshes.length) {
            const obj = this.meshes[fileIndex];
            if (obj) obj.visible = true;
        } else {
            const poseIndex = fileIndex - this.plyFiles.length;
            const group = this.poseGroups[poseIndex];
            if (group) group.visible = true;
        }
        // Update UI
        this.updateFileList();
    }

    private switchToTrackballControls(): void {
        if (this.controlType === 'trackball') return;
        
        console.log('🔄 Switching to TrackballControls');
        this.controlType = 'trackball';
        this.initializeControls();
        this.updateControlStatus();
        this.showStatus('Switched to Trackball controls');
    }

    private switchToOrbitControls(): void {
        if (this.controlType === 'orbit') return;
        
        console.log('🔄 Switching to OrbitControls');
        this.controlType = 'orbit';
        this.initializeControls();
        this.updateControlStatus();
        this.showStatus('Switched to Orbit controls');
    }

    private switchToInverseTrackballControls(): void {
        if (this.controlType === 'inverse-trackball') return;
        
        console.log('🔄 Switching to Inverse TrackballControls');
        this.controlType = 'inverse-trackball';
        this.initializeControls();
        this.updateControlStatus();
        this.showStatus('Switched to Inverse Trackball controls');
    }

    private switchToArcballControls(): void {
        if (this.controlType === 'arcball') return;
        
        console.log('🔄 Switching to ArcballControls');
        this.controlType = 'arcball';
        this.initializeControls();
        this.updateControlStatus();
        this.showStatus('Switched to Arcball controls');
    }

    // Removed CloudCompare button/shortcut per user request; turntable impl remains unused

    private updateControlStatus(): void {
        const status = this.controlType.toUpperCase();
        console.log(`📊 Camera Controls: ${status}`);
        
        // Update UI if there's a status display
        const statusElement = document.getElementById('camera-control-status');
        if (statusElement) {
            statusElement.textContent = status;
        }

        // Update button active states
        const controlButtons = [
            { id: 'trackball-controls', type: 'trackball' },
            { id: 'orbit-controls', type: 'orbit' },
            { id: 'inverse-trackball-controls', type: 'inverse-trackball' },
            { id: 'arcball-controls', type: 'arcball' },
            { id: 'cloudcompare-controls', type: 'cloudcompare' }
        ];

        controlButtons.forEach(button => {
            const btn = document.getElementById(button.id);
            if (btn) {
                if (button.type === this.controlType) {
                    btn.classList.add('active');
                } else {
                    btn.classList.remove('active');
                }
            }
        });
    }

    private setOpenCVCameraConvention(): void {
        console.log('📷 Setting camera to OpenCV convention (Y-down, Z-forward)');
        
        // OpenCV convention: Y-down, Z-forward
        // Camera looks along +Z axis, Y points down
        
        // Store current target position
        const currentTarget = this.controls.target.clone();
        
        // Set up vector to Y-down
        this.camera.up.set(0, -1, 0);
        
        // Calculate current camera direction relative to target
        const cameraDirection = this.camera.position.clone().sub(currentTarget).normalize();
        const distance = this.camera.position.distanceTo(currentTarget);
        
        // Position camera to look along +Z axis while maintaining focus on current target
        // Move camera to negative Z relative to target so it looks toward positive Z
        this.camera.position.copy(currentTarget).add(new THREE.Vector3(0, 0, -distance));
        
        // Keep the same target (don't reset to origin)
        this.controls.target.copy(currentTarget);
        
        // Make camera look at target
        this.camera.lookAt(this.controls.target);
        
        // Update controls
        this.controls.update();
        
        // Update axes helper to reflect OpenCV convention
        this.updateAxesForCameraConvention('opencv');
        
        // Show feedback
        this.showCameraConventionFeedback('OpenCV');
    }

    private setOpenGLCameraConvention(): void {
        console.log('📷 Setting camera to OpenGL convention (Y-up, Z-backward)');
        
        // OpenGL convention: Y-up, Z-backward
        // Camera looks along -Z axis, Y points up (standard Three.js)
        
        // Store current target position
        const currentTarget = this.controls.target.clone();
        
        // Set up vector to Y-up
        this.camera.up.set(0, 1, 0);
        
        // Calculate current camera direction relative to target
        const cameraDirection = this.camera.position.clone().sub(currentTarget).normalize();
        const distance = this.camera.position.distanceTo(currentTarget);
        
        // Position camera to look along -Z axis while maintaining focus on current target
        // Move camera to positive Z relative to target so it looks toward negative Z
        this.camera.position.copy(currentTarget).add(new THREE.Vector3(0, 0, distance));
        
        // Keep the same target (don't reset to origin)
        this.controls.target.copy(currentTarget);
        
        // Make camera look at target
        this.camera.lookAt(this.controls.target);
        
        // Update controls
        this.controls.update();
        
        // Update axes helper to reflect OpenGL convention
        this.updateAxesForCameraConvention('opengl');
        
        // Show feedback
        this.showCameraConventionFeedback('OpenGL');
    }

    private updateAxesForCameraConvention(convention: 'opencv' | 'opengl'): void {
        // Update the axes helper orientation to match the camera convention
        const axesGroup = (this as any).axesGroup;
        if (axesGroup) {
            console.log(`🎯 Axes updated for ${convention} camera convention`);
        }
    }

    private showCameraConventionFeedback(convention: string): void {
        console.log(`✅ Camera set to ${convention} convention`);
        
        // Create a temporary visual indicator
        const origin = new THREE.Vector3(0, 0, 0);
        const upVector = convention === 'OpenCV' ? new THREE.Vector3(0, -1, 0) : new THREE.Vector3(0, 1, 0);
        const length = 2;
        const color = convention === 'OpenCV' ? 0xff0000 : 0x00ff00; // Red for OpenCV, Green for OpenGL
        
        const arrowHelper = new THREE.ArrowHelper(upVector, origin, length, color, length * 0.2, length * 0.1);
        this.scene.add(arrowHelper);
        
        // Remove after 2 seconds
        setTimeout(() => {
            this.scene.remove(arrowHelper);
            arrowHelper.dispose();
        }, 2000);
    }

    private showTranslationDialog(fileIndex: number): void {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;
        
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            min-width: 300px;
            max-width: 400px;
        `;
        
        dialog.innerHTML = `
            <h3 style="margin-top:0;">Add Translation</h3>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:5px;font-weight:bold;">Enter translation vector (X Y Z):</label>
                <div style="font-size:11px;color:#666;margin-bottom:8px;">
                    Format: X Y Z (space-separated)<br>
                    Commas, brackets, and line breaks are automatically handled<br>
                    Example: 1 0 0 (move 1 unit along X-axis)
                </div>
                <textarea id="translation-input" 
                    placeholder="1 0 0" 
                    style="width:100%;height:80px;padding:8px;font-family:monospace;font-size:12px;border:1px solid #ccc;border-radius:4px;resize:vertical;"
                >1 0 0</textarea>
            </div>
            <div style="text-align:right;">
                <button id="cancel-translation" style="margin-right:10px;padding:8px 15px;">Cancel</button>
                <button id="apply-translation" style="padding:8px 15px;background:#007acc;color:white;border:none;border-radius:4px;">Apply</button>
            </div>
        `;
        
        modal.appendChild(dialog);
        document.body.appendChild(modal);
        
        const closeModal = () => {
            modal.remove();
        };
        
        const cancelBtn = dialog.querySelector('#cancel-translation');
        const applyBtn = dialog.querySelector('#apply-translation');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', closeModal);
        }
        
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const input = (dialog.querySelector('#translation-input') as HTMLTextAreaElement).value;
                const values = this.parseSpaceSeparatedValues(input);
                
                if (values.length === 3) {
                    const [x, y, z] = values;
                    this.addTranslationToMatrix(fileIndex, x, y, z);
                    this.updateMatrixTextarea(fileIndex);
                    closeModal();
                } else {
                    alert('Please enter exactly 3 numbers for translation (X Y Z)');
                }
            });
        }
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        // Close on Escape key
        const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    }

    private showQuaternionDialog(fileIndex: number): void {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;
        
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            min-width: 300px;
            max-width: 400px;
        `;
        
        dialog.innerHTML = `
            <h3 style="margin-top:0;">Add Quaternion Rotation</h3>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:5px;font-weight:bold;">Enter quaternion values (X Y Z W):</label>
                <div style="font-size:11px;color:#666;margin-bottom:8px;">
                    Format: X Y Z W (space-separated)<br>
                    Commas, brackets, and line breaks are automatically handled<br>
                    Example: 0 0 0 1 (identity quaternion)
                </div>
                <textarea id="quaternion-input" 
                    placeholder="0 0 0 1" 
                    style="width:100%;height:80px;padding:8px;font-family:monospace;font-size:12px;border:1px solid #ccc;border-radius:4px;resize:vertical;"
                >0 0 0 1</textarea>
            </div>
            <div style="text-align:right;">
                <button id="cancel-quaternion" style="margin-right:10px;padding:8px 15px;">Cancel</button>
                <button id="apply-quaternion" style="padding:8px 15px;background:#007acc;color:white;border:none;border-radius:4px;">Apply</button>
            </div>
        `;
        
        modal.appendChild(dialog);
        document.body.appendChild(modal);
        
        const closeModal = () => {
            modal.remove();
        };
        
        const cancelBtn = dialog.querySelector('#cancel-quaternion');
        const applyBtn = dialog.querySelector('#apply-quaternion');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', closeModal);
        }
        
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const input = (dialog.querySelector('#quaternion-input') as HTMLTextAreaElement).value;
                const values = this.parseSpaceSeparatedValues(input);
                
                if (values.length === 4) {
                    const [x, y, z, w] = values;
                    const quaternionMatrix = this.createQuaternionMatrix(x, y, z, w);
                    this.multiplyTransformationMatrices(fileIndex, quaternionMatrix);
                    this.updateMatrixTextarea(fileIndex);
                    closeModal();
                } else {
                    alert('Please enter exactly 4 numbers for the quaternion (X Y Z W)');
                }
            });
        }
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        // Close on Escape key
        const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    }

    private showAngleAxisDialog(fileIndex: number): void {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;
        
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            min-width: 300px;
            max-width: 400px;
        `;
        
        dialog.innerHTML = `
            <h3 style="margin-top:0;">Add Angle-Axis Rotation</h3>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:5px;font-weight:bold;">Enter axis and angle (X Y Z angle):</label>
                <div style="font-size:11px;color:#666;margin-bottom:8px;">
                    Format: X Y Z angle (space-separated, angle in degrees)<br>
                    Commas, brackets, and line breaks are automatically handled<br>
                    Example: 0 1 0 90 (90° rotation around Y-axis)
                </div>
                <textarea id="angle-axis-input" 
                    placeholder="0 1 0 90" 
                    style="width:100%;height:80px;padding:8px;font-family:monospace;font-size:12px;border:1px solid #ccc;border-radius:4px;resize:vertical;"
                >0 1 0 90</textarea>
            </div>
            <div style="text-align:right;">
                <button id="cancel-angle-axis" style="margin-right:10px;padding:8px 15px;">Cancel</button>
                <button id="apply-angle-axis" style="padding:8px 15px;background:#007acc;color:white;border:none;border-radius:4px;">Apply</button>
            </div>
        `;
        
        modal.appendChild(dialog);
        document.body.appendChild(modal);
        
        const closeModal = () => {
            modal.remove();
        };
        
        const cancelBtn = dialog.querySelector('#cancel-angle-axis');
        const applyBtn = dialog.querySelector('#apply-angle-axis');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', closeModal);
        }
        
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const input = (dialog.querySelector('#angle-axis-input') as HTMLTextAreaElement).value;
                const values = this.parseSpaceSeparatedValues(input);
                
                if (values.length === 4) {
                    const [axisX, axisY, axisZ, angleDegrees] = values;
                    const axis = new THREE.Vector3(axisX, axisY, axisZ);
                    const angle = (angleDegrees * Math.PI) / 180; // Convert to radians
                    const angleAxisMatrix = this.createAngleAxisMatrix(axis, angle);
                    this.multiplyTransformationMatrices(fileIndex, angleAxisMatrix);
                    this.updateMatrixTextarea(fileIndex);
                    closeModal();
                } else {
                    alert('Please enter exactly 4 numbers for axis and angle (X Y Z angle in degrees)');
                }
            });
        }
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        // Close on Escape key
        const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    }

    private showCameraPositionDialog(): void {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;
        
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            min-width: 300px;
            max-width: 400px;
        `;
        
        const currentPos = this.camera.position;
        
        dialog.innerHTML = `
            <h3 style="margin-top:0;">Modify Camera Position</h3>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:5px;">Camera Position X Y Z in Meter:</label>
                <textarea id="camera-position-input" 
                    placeholder="${currentPos.x.toFixed(3)} ${currentPos.y.toFixed(3)} ${currentPos.z.toFixed(3)}" 
                    style="width:100%;height:60px;padding:8px;font-family:monospace;font-size:12px;border:1px solid #ccc;border-radius:4px;resize:vertical;"
                >${currentPos.x.toFixed(3)} ${currentPos.y.toFixed(3)} ${currentPos.z.toFixed(3)}</textarea>
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:8px;">Keep constant when changing:</label>
                <div style="display:flex;gap:15px;align-items:center;">
                    <label style="display:flex;align-items:center;gap:5px;cursor:pointer;">
                        <input type="radio" name="position-constraint" value="rotation" style="margin:0;">
                        <span>Rotation (angle)</span>
                    </label>
                    <label style="display:flex;align-items:center;gap:5px;cursor:pointer;">
                        <input type="radio" name="position-constraint" value="center" checked style="margin:0;">
                        <span>Rotation center</span>
                    </label>
                </div>
            </div>
            <div style="text-align:right;">
                <button id="set-all-pos-zero" style="margin-right:10px;padding:6px 12px;background:#f0f0f0;border:1px solid #ccc;border-radius:4px;font-size:11px;">Set All to 0</button>
                <button id="cancel-camera-pos" style="margin-right:10px;padding:8px 15px;">Cancel</button>
                <button id="apply-camera-pos" style="padding:8px 15px;background:#007acc;color:white;border:none;border-radius:4px;">Apply</button>
            </div>
        `;
        
        modal.appendChild(dialog);
        document.body.appendChild(modal);
        
        const closeModal = () => {
            modal.remove();
        };
        
        const cancelBtn = dialog.querySelector('#cancel-camera-pos');
        const applyBtn = dialog.querySelector('#apply-camera-pos');
        const setAllZeroBtn = dialog.querySelector('#set-all-pos-zero');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', closeModal);
        }
        
        if (setAllZeroBtn) {
            setAllZeroBtn.addEventListener('click', () => {
                (dialog.querySelector('#camera-position-input') as HTMLTextAreaElement).value = '0 0 0';
            });
        }
        
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const input = (dialog.querySelector('#camera-position-input') as HTMLTextAreaElement).value;
                const constraint = (dialog.querySelector('input[name="position-constraint"]:checked') as HTMLInputElement).value;
                const values = this.parseSpaceSeparatedValues(input);
                
                if (values.length === 3) {
                    const [x, y, z] = values;
                    
                    // Store current camera state
                    const currentQuaternion = this.camera.quaternion.clone();
                    const currentTarget = this.controls.target.clone();
                    
                    // Update position
                    this.camera.position.set(x, y, z);
                    
                    // Apply constraint logic
                    if (constraint === 'rotation') {
                        // Keep rotation (angle) - restore quaternion
                        this.camera.quaternion.copy(currentQuaternion);
                        
                        // Update target based on new position and preserved rotation
                        const direction = new THREE.Vector3(0, 0, -1);
                        direction.applyQuaternion(currentQuaternion);
                        this.controls.target.copy(this.camera.position.clone().add(direction));
                    } else {
                        // Keep rotation center (target) - restore target (default behavior)
                        this.controls.target.copy(currentTarget);
                        
                        // Adjust camera rotation to look at the preserved target
                        this.camera.lookAt(currentTarget);
                    }
                    
                    this.controls.update();
                    this.updateCameraControlsPanel();
                    closeModal();
                } else {
                    alert('Please enter exactly 3 numbers for position (X Y Z)');
                }
            });
        }
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        // Close on Escape key
        const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    }

    private showCameraRotationDialog(): void {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;
        
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            min-width: 300px;
            max-width: 400px;
        `;
        
        // Get rotation from quaternion to handle all camera operations consistently
        const euler = new THREE.Euler();
        euler.setFromQuaternion(this.camera.quaternion, 'XYZ');
        const rotX = (euler.x * 180 / Math.PI);
        const rotY = (euler.y * 180 / Math.PI);
        const rotZ = (euler.z * 180 / Math.PI);
        
        dialog.innerHTML = `
            <h3 style="margin-top:0;">Modify Camera Rotation</h3>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:5px;">Rotation around X Y Z Axis in degrees:</label>
                <textarea id="camera-rotation-input" 
                    placeholder="${rotX.toFixed(1)} ${rotY.toFixed(1)} ${rotZ.toFixed(1)}" 
                    style="width:100%;height:60px;padding:8px;font-family:monospace;font-size:12px;border:1px solid #ccc;border-radius:4px;resize:vertical;"
                >${rotX.toFixed(1)} ${rotY.toFixed(1)} ${rotZ.toFixed(1)}</textarea>
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:8px;">Keep constant when changing:</label>
                <div style="display:flex;gap:15px;align-items:center;">
                    <label style="display:flex;align-items:center;gap:5px;cursor:pointer;">
                        <input type="radio" name="rotation-constraint" value="position" style="margin:0;">
                        <span>Position</span>
                    </label>
                    <label style="display:flex;align-items:center;gap:5px;cursor:pointer;">
                        <input type="radio" name="rotation-constraint" value="center" checked style="margin:0;">
                        <span>Rotation center</span>
                    </label>
                </div>
            </div>
            <div style="text-align:right;">
                <button id="set-all-rot-zero" style="margin-right:10px;padding:6px 12px;background:#f0f0f0;border:1px solid #ccc;border-radius:4px;font-size:11px;">Set All to 0</button>
                <button id="cancel-camera-rot" style="margin-right:10px;padding:8px 15px;">Cancel</button>
                <button id="apply-camera-rot" style="padding:8px 15px;background:#007acc;color:white;border:none;border-radius:4px;">Apply</button>
            </div>
        `;
        
        modal.appendChild(dialog);
        document.body.appendChild(modal);
        
        const closeModal = () => {
            modal.remove();
        };
        
        const cancelBtn = dialog.querySelector('#cancel-camera-rot');
        const applyBtn = dialog.querySelector('#apply-camera-rot');
        const setAllZeroBtn = dialog.querySelector('#set-all-rot-zero');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', closeModal);
        }
        
        if (setAllZeroBtn) {
            setAllZeroBtn.addEventListener('click', () => {
                (dialog.querySelector('#camera-rotation-input') as HTMLTextAreaElement).value = '0 0 0';
            });
        }
        
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const input = (dialog.querySelector('#camera-rotation-input') as HTMLTextAreaElement).value;
                const constraint = (dialog.querySelector('input[name="rotation-constraint"]:checked') as HTMLInputElement).value;
                const values = this.parseSpaceSeparatedValues(input);
                
                if (values.length === 3) {
                    const [x, y, z] = values;
                    
                    // Store current camera state
                    const currentPosition = this.camera.position.clone();
                    const currentTarget = this.controls.target.clone();
                    
                    // Create quaternion from Euler angles
                    const euler = new THREE.Euler(
                        (x * Math.PI) / 180,
                        (y * Math.PI) / 180,
                        (z * Math.PI) / 180,
                        'XYZ'
                    );
                    const quaternion = new THREE.Quaternion();
                    quaternion.setFromEuler(euler);
                    
                    // Apply constraint logic
                    if (constraint === 'position') {
                        // Keep position - restore position and apply rotation directly
                        this.camera.position.copy(currentPosition);
                        this.camera.quaternion.copy(quaternion);
                        
                        // Update target based on new rotation and preserved position
                        const direction = new THREE.Vector3(0, 0, -1);
                        direction.applyQuaternion(quaternion);
                        this.controls.target.copy(this.camera.position.clone().add(direction));
                    } else {
                        // Keep rotation center - restore target and adjust position (default behavior)
                        const distance = currentPosition.distanceTo(currentTarget);
                        this.controls.target.copy(currentTarget);
                        
                        // Position camera relative to preserved target
                        const direction = new THREE.Vector3(0, 0, distance);
                        direction.applyQuaternion(quaternion);
                        this.camera.position.copy(currentTarget).add(direction);
                        
                        // Set up vector and look at target
                        const up = new THREE.Vector3(0, 1, 0);
                        up.applyQuaternion(quaternion);
                        this.camera.up.copy(up);
                        this.camera.lookAt(currentTarget);
                    }
                    
                    this.controls.update();
                    this.updateCameraControlsPanel();
                    closeModal();
                } else {
                    alert('Please enter exactly 3 numbers for rotation (X Y Z degrees)');
                }
            });
        }
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        // Close on Escape key
        const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    }

    private showRotationCenterDialog(): void {
        const modal = document.createElement('div');
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;
        
        const dialog = document.createElement('div');
        dialog.style.cssText = `
            background: white;
            padding: 20px;
            border-radius: 8px;
            min-width: 300px;
            max-width: 400px;
        `;
        
        // Get current rotation center (controls target)
        const target = this.controls.target;
        
        dialog.innerHTML = `
            <h3 style="margin-top:0;">Modify Rotation Center</h3>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:5px;">Rotation Center X Y Z in Meter:</label>
                <textarea id="rotation-center-input" 
                    placeholder="${target.x.toFixed(3)} ${target.y.toFixed(3)} ${target.z.toFixed(3)}" 
                    style="width:100%;height:60px;padding:8px;font-family:monospace;font-size:12px;border:1px solid #ccc;border-radius:4px;resize:vertical;"
                >${target.x.toFixed(3)} ${target.y.toFixed(3)} ${target.z.toFixed(3)}</textarea>
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:8px;">Keep constant when changing:</label>
                <div style="display:flex;gap:15px;align-items:center;">
                    <label style="display:flex;align-items:center;gap:5px;cursor:pointer;">
                        <input type="radio" name="center-constraint" value="position" checked style="margin:0;">
                        <span>Position</span>
                    </label>
                    <label style="display:flex;align-items:center;gap:5px;cursor:pointer;">
                        <input type="radio" name="center-constraint" value="rotation" style="margin:0;">
                        <span>Rotation (angle)</span>
                    </label>
                </div>
            </div>
            <div style="text-align:right;">
                <button id="set-center-origin" style="margin-right:10px;padding:6px 12px;background:#f0f0f0;border:1px solid #ccc;border-radius:4px;font-size:11px;">Set to Origin (0,0,0)</button>
                <button id="cancel-rotation-center" style="margin-right:10px;padding:8px 15px;">Cancel</button>
                <button id="apply-rotation-center" style="padding:8px 15px;background:#007acc;color:white;border:none;border-radius:4px;">Apply</button>
            </div>
        `;
        
        modal.appendChild(dialog);
        document.body.appendChild(modal);
        
        const closeModal = () => {
            document.body.removeChild(modal);
        };
        
        // Event listeners
        const setOriginBtn = dialog.querySelector('#set-center-origin');
        const cancelBtn = dialog.querySelector('#cancel-rotation-center');
        const applyBtn = dialog.querySelector('#apply-rotation-center');
        
        if (setOriginBtn) {
            setOriginBtn.addEventListener('click', () => {
                (dialog.querySelector('#rotation-center-input') as HTMLTextAreaElement).value = '0 0 0';
            });
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', closeModal);
        }
        
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const input = (dialog.querySelector('#rotation-center-input') as HTMLTextAreaElement).value;
                const constraint = (dialog.querySelector('input[name="center-constraint"]:checked') as HTMLInputElement).value;
                const values = this.parseSpaceSeparatedValues(input);
                
                if (values.length === 3) {
                    const [x, y, z] = values;
                    
                    // Store current camera state
                    const currentPosition = this.camera.position.clone();
                    const currentQuaternion = this.camera.quaternion.clone();
                    const currentTarget = this.controls.target.clone();
                    
                    // Set the new rotation center
                    this.controls.target.set(x, y, z);
                    
                    // Apply constraint logic
                    if (constraint === 'rotation') {
                        // Keep rotation - restore quaternion and adjust position to maintain distance from new center
                        const distance = currentPosition.distanceTo(currentTarget);
                        this.camera.quaternion.copy(currentQuaternion);
                        
                        // Position camera at distance from new center in same direction as rotation
                        const direction = new THREE.Vector3(0, 0, distance);
                        direction.applyQuaternion(currentQuaternion);
                        this.camera.position.copy(this.controls.target).add(direction);
                    } else {
                        // Keep position - restore position and adjust rotation to look at new center (default behavior)
                        this.camera.position.copy(currentPosition);
                        this.camera.lookAt(this.controls.target);
                    }
                    
                    // Update controls and camera panel
                    this.controls.update();
                    this.updateCameraControlsPanel();
                    
                    // Update axes position to show new rotation center
                    if ((this as any).axesHelper) {
                        (this as any).axesHelper.position.copy(this.controls.target);
                    }
                    
                    console.log(`🎯 Rotation center set to: (${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)})`);
                    this.updateRotationOriginButtonState();
                    closeModal();
                } else {
                    alert('Please enter exactly 3 numbers for center (X Y Z)');
                }
            });
        }
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
        
        // Close on Escape key
        const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
    }

    private openCalibrationFileDialog(fileIndex: number): void {
        // Use VS Code's file picker instead of browser's for better directory control
        this.vscode.postMessage({
            type: 'selectCalibrationFile',
            fileIndex: fileIndex
        });
    }

    private async loadCalibrationFile(file: File, fileIndex: number): Promise<void> {
        try {
            const text = await file.text();
            let calibrationData: any;

            // Parse calibration file based on format
            calibrationData = this.parseCalibrationFile(text, file.name);
            if (!calibrationData) {
                return; // Error already shown by parseCalibrationFile
            }

            // Display calibration file info and populate camera selection
            this.displayCalibrationInfo(calibrationData, file.name, fileIndex);
            
        } catch (error) {
            console.error('Error loading calibration file:', error);
            alert(`Failed to load calibration file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private displayCalibrationInfo(calibrationData: any, fileName: string, fileIndex: number): void {
        const calibrationInfo = document.getElementById(`calibration-info-${fileIndex}`);
        const calibrationFilename = document.getElementById(`calibration-filename-${fileIndex}`);
        const cameraSelect = document.getElementById(`camera-select-${fileIndex}`) as HTMLSelectElement;
        
        if (!calibrationInfo || !calibrationFilename || !cameraSelect) {
            console.error('Calibration UI elements not found');
            return;
        }

        // Show calibration info panel
        calibrationInfo.style.display = 'block';
        calibrationFilename.textContent = `📄 ${fileName}`;
        
        // Clear and populate camera selection dropdown
        cameraSelect.innerHTML = '<option value="">Select camera...</option>';
        
        // Store calibration data for this file index
        if (!this.calibrationData) {
            this.calibrationData = new Map();
        }
        this.calibrationData.set(fileIndex, calibrationData);

        // Extract camera names from calibration data and automatically select the first one
        if (calibrationData.cameras && typeof calibrationData.cameras === 'object') {
            const cameraNames = Object.keys(calibrationData.cameras);
            
            // Populate dropdown with all cameras
            cameraNames.forEach(cameraName => {
                const option = document.createElement('option');
                option.value = cameraName;
                option.textContent = cameraName;
                cameraSelect.appendChild(option);
            });
            
            if (cameraNames.length > 0) {
                // Automatically select the first camera
                const firstCamera = cameraNames[0];
                cameraSelect.value = firstCamera;
                
                // Auto-populate form fields from the first camera
                const cameraData = calibrationData.cameras[firstCamera];
                this.populateFormFromCalibration(cameraData, fileIndex);
                
                console.log(`📷 Loaded calibration file with ${cameraNames.length} cameras: ${cameraNames.join(', ')}\n✅ Automatically selected first camera: ${firstCamera}`);
            } else {
                console.warn('No cameras found in calibration file');
                alert('No cameras found in the calibration file. Please check the file format.');
            }
        } else {
            console.warn('No cameras found in calibration file');
            alert('No cameras found in the calibration file. Please check the file format.');
        }
    }

    private onCameraSelectionChange(fileIndex: number, selectedCamera: string): void {
        if (!selectedCamera || !this.calibrationData || !this.calibrationData.has(fileIndex)) {
            return;
        }

        const calibrationData = this.calibrationData.get(fileIndex);
        const cameraData = calibrationData.cameras[selectedCamera];
        
        if (!cameraData) {
            console.warn(`Camera "${selectedCamera}" not found in calibration data`);
            return;
        }

        // Auto-populate form fields from camera data
        this.populateFormFromCalibration(cameraData, fileIndex);
        
        console.log(`📷 Applied calibration for camera "${selectedCamera}" to file ${fileIndex}`);
    }

    /**
     * Parse calibration file content based on format
     */
    private parseCalibrationFile(content: string, fileName: string): any {
        const lowerFileName = fileName.toLowerCase();
        
        try {
            // Try different parsers based on file extension and content
            
            // JSON formats (PLY Visualizer, RealSense)
            if (lowerFileName.endsWith('.json')) {
                // Check if it's RealSense format
                if (RealSenseParser.isRealSenseFormat(content)) {
                    console.log('🔍 Detected RealSense JSON format');
                    const result = RealSenseParser.parse(content);
                    return RealSenseParser.toCameraFormat(result);
                } else {
                    // Standard PLY Visualizer JSON format
                    console.log('🔍 Detected PLY Visualizer JSON format');
                    return JSON.parse(content);
                }
            }
            
            // YAML formats (OpenCV, ROS, Stereo, Kalibr)
            else if (lowerFileName.endsWith('.yml') || lowerFileName.endsWith('.yaml')) {
                console.log('🔍 Detected YAML format');
                const result = YamlCalibrationParser.parse(content, fileName);
                return YamlCalibrationParser.toCameraFormat(result);
            }
            
            // XML formats (OpenCV)
            else if (lowerFileName.endsWith('.xml')) {
                alert('XML format parsing is not yet implemented. Please use YAML format for OpenCV calibrations.');
                return null;
            }
            
            // Conf formats (ZED)
            else if (lowerFileName.endsWith('.conf')) {
                console.log('🔍 Detected ZED .conf format');
                const result = ZedParser.parse(content);
                return ZedParser.toCameraFormat(result);
            }
            
            // Text formats (TXT)
            else if (lowerFileName.endsWith('.txt')) {
                // Try different TXT parsers
                
                // Check for Middlebury calib.txt format
                if (lowerFileName.includes('calib') || content.includes('cam0=') || content.includes('baseline=')) {
                    console.log('🔍 Detected Middlebury calib.txt format');
                    const calibTxtData = CalibTxtParser.parse(content);
                    CalibTxtParser.validate(calibTxtData);
                    
                    const calibrationData = CalibTxtParser.toCameraFormat(calibTxtData);
                    (calibrationData as any)._calibTxtData = calibTxtData;
                    
                    console.log(`✅ Loaded calib.txt with cameras: ${Object.keys(calibrationData.cameras).join(', ')}\n📏 Baseline: ${calibTxtData.baseline} mm\n🔍 Image size: ${calibTxtData.width}x${calibTxtData.height}`);
                    
                    return calibrationData;
                }
                
                // Check for COLMAP format
                else if (ColmapParser.validate(content)) {
                    console.log('🔍 Detected COLMAP cameras.txt format');
                    const result = ColmapParser.parse(content);
                    return ColmapParser.toCameraFormat(result);
                }
                
                // Check for TUM format
                else if (TumParser.isTumFormat(content, fileName)) {
                    console.log('🔍 Detected TUM camera.txt format');
                    const result = TumParser.parse(content, fileName);
                    return TumParser.toCameraFormat(result);
                }
                
                else {
                    alert('Unknown TXT calibration format. Supported TXT formats: Middlebury calib.txt, COLMAP cameras.txt, TUM camera.txt');
                    return null;
                }
            }
            
            // INI formats
            else if (lowerFileName.endsWith('.ini')) {
                alert('INI format parsing is not yet implemented.');
                return null;
            }
            
            else {
                alert(`Unsupported calibration file format: ${fileName}\n\nSupported formats:\n• JSON (.json) - PLY Visualizer, RealSense\n• YAML (.yml, .yaml) - OpenCV, ROS, Stereo, Kalibr\n• TXT (.txt) - Middlebury calib.txt, COLMAP cameras.txt, TUM camera.txt\n• CONF (.conf) - ZED calibration`);
                return null;
            }
            
        } catch (error) {
            console.error('Error parsing calibration file:', error);
            alert(`Failed to parse calibration file: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }

    private handleCalibrationFileSelected(message: any): void {
        try {
            const fileIndex = message.fileIndex;
            const fileName = message.fileName;
            const content = message.content;
            
            // Parse calibration file using the universal parser
            const calibrationData = this.parseCalibrationFile(content, fileName);
            if (!calibrationData) {
                return; // Error already shown by parseCalibrationFile
            }

            // Display calibration file info and populate camera selection
            this.displayCalibrationInfo(calibrationData, fileName, fileIndex);
            
        } catch (error) {
            console.error('Error processing calibration file:', error);
            alert(`Failed to process calibration file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private populateFormFromCalibration(cameraData: any, fileIndex: number): void {
        // Get form elements
        const fxInput = document.getElementById(`fx-${fileIndex}`) as HTMLInputElement;
        const fyInput = document.getElementById(`fy-${fileIndex}`) as HTMLInputElement;
        const cxInput = document.getElementById(`cx-${fileIndex}`) as HTMLInputElement;
        const cyInput = document.getElementById(`cy-${fileIndex}`) as HTMLInputElement;
        const cameraModelSelect = document.getElementById(`camera-model-${fileIndex}`) as HTMLSelectElement;
        const baselineInput = document.getElementById(`baseline-${fileIndex}`) as HTMLInputElement;
        const depthTypeSelect = document.getElementById(`depth-type-${fileIndex}`) as HTMLSelectElement;

        // Populate focal lengths
        if (cameraData.fx !== undefined && fxInput) {
            fxInput.value = String(cameraData.fx);
        }
        if (cameraData.fy !== undefined && fyInput) {
            fyInput.value = String(cameraData.fy);
        }

        // Populate principal point
        if (cameraData.cx !== undefined && cxInput) {
            cxInput.value = String(cameraData.cx);
        }
        if (cameraData.cy !== undefined && cyInput) {
            cyInput.value = String(cameraData.cy);
        }

        // Populate baseline if available (from calib.txt files)
        if (cameraData.baseline !== undefined && baselineInput) {
            baselineInput.value = String(cameraData.baseline);
            
            // Smart auto-detection: If baseline is present and depth type is still at default (euclidean),
            // auto-switch to disparity mode since baseline is typically used for disparity data.
            // But only if the user hasn't explicitly changed the depth type from default.
            // TODO: This is very handcrafted and should be more general in the future
            if (depthTypeSelect && depthTypeSelect.value === 'euclidean') {
                console.log(`📐 Baseline detected (${cameraData.baseline}mm), auto-switching depth type to 'disparity'`);
                depthTypeSelect.value = 'disparity';
                
                // Show baseline and disparity offset groups since we switched to disparity
                const baselineGroup = document.getElementById(`baseline-group-${fileIndex}`);
                const disparityOffsetGroup = document.getElementById(`disparity-offset-group-${fileIndex}`);
                if (baselineGroup) baselineGroup.style.display = '';
                if (disparityOffsetGroup) disparityOffsetGroup.style.display = '';
            } else if (depthTypeSelect) {
                console.log(`📐 Baseline detected but depth type already set to '${depthTypeSelect.value}', keeping user choice`);
            }
        }

        // Set disparity offset (doffs) from calib.txt data if available
        const calibrationData = this.calibrationData?.get(fileIndex);
        if (calibrationData && calibrationData._calibTxtData) {
            const disparityOffsetInput = document.getElementById(`disparity-offset-${fileIndex}`) as HTMLInputElement;
            if (disparityOffsetInput) {
                disparityOffsetInput.value = String(calibrationData._calibTxtData.doffs);
            }
        }

        // Try to set camera model if available
        if (cameraData.camera_model && cameraModelSelect) {
            // Map common camera model names to our options
            const modelMapping: { [key: string]: string } = {
                'pinhole': 'pinhole-ideal',
                'pinhole_ideal': 'pinhole-ideal',
                'opencv': 'pinhole-opencv',
                'pinhole_opencv': 'pinhole-opencv',
                'fisheye': 'fisheye-equidistant',
                'fisheye_equidistant': 'fisheye-equidistant',
                'kannala_brandt': 'fisheye-kannala-brandt'
            };
            
            const modelName = modelMapping[cameraData.camera_model.toLowerCase()] || cameraData.camera_model;
            if (modelName) {
                // Check if this model exists in our select options
                const option = Array.from(cameraModelSelect.options).find(opt => opt.value === modelName);
                if (option) {
                    cameraModelSelect.value = modelName;
                    // CRITICAL FIX: Trigger change event to show/hide distortion parameter fields
                    cameraModelSelect.dispatchEvent(new Event('change'));
                }
            }
        }
        
        // Populate distortion coefficients if available
        if (cameraData.k1 !== undefined) {
            const k1Input = document.getElementById(`k1-${fileIndex}`) as HTMLInputElement;
            if (k1Input) k1Input.value = String(cameraData.k1);
        }
        if (cameraData.k2 !== undefined) {
            const k2Input = document.getElementById(`k2-${fileIndex}`) as HTMLInputElement;
            if (k2Input) k2Input.value = String(cameraData.k2);
        }
        if (cameraData.k3 !== undefined) {
            const k3Input = document.getElementById(`k3-${fileIndex}`) as HTMLInputElement;
            if (k3Input) k3Input.value = String(cameraData.k3);
        }
        if (cameraData.k4 !== undefined) {
            const k4Input = document.getElementById(`k4-${fileIndex}`) as HTMLInputElement;
            if (k4Input) k4Input.value = String(cameraData.k4);
        }
        if (cameraData.p1 !== undefined) {
            const p1Input = document.getElementById(`p1-${fileIndex}`) as HTMLInputElement;
            if (p1Input) p1Input.value = String(cameraData.p1);
        }
        if (cameraData.p2 !== undefined) {
            const p2Input = document.getElementById(`p2-${fileIndex}`) as HTMLInputElement;
            if (p2Input) p2Input.value = String(cameraData.p2);
        }

        // Trigger update of default button state
        this.updateSingleDefaultButtonState(fileIndex);
        
        console.log('📐 Camera parameters populated from calibration:', {
            fx: cameraData.fx,
            fy: cameraData.fy,
            cx: cameraData.cx,
            cy: cameraData.cy,
            baseline: cameraData.baseline,
            model: cameraData.camera_model
        });
    }

    private async handleDepthData(message: any): Promise<void> {
        try {
            console.log('Received depth data for processing:', message.fileName);
            
            // Generate unique request ID for this depth file
            const requestId = `depth_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Store depth data in the map
            this.pendingDepthFiles.set(requestId, {
                data: message.data,
                fileName: message.fileName,
                isAddFile: message.isAddFile || false,
                requestId: requestId
            });

            const isTif = /\.(tif|tiff)$/i.test(message.fileName);
            const isPfm = /\.pfm$/i.test(message.fileName);
            const isNpy = /\.(npy|npz)$/i.test(message.fileName);
            const isPng = /\.png$/i.test(message.fileName);

            if (isTif) {
                // For TIF files, check if it's a depth image
                const tiff = await GeoTIFF.fromArrayBuffer(message.data);
                const image = await tiff.getImage();
                
                const samplesPerPixel = image.getSamplesPerPixel();
                const sampleFormat = image.getSampleFormat ? image.getSampleFormat() : null;
                const bitsPerSample = image.getBitsPerSample();
                
                const isDepthImage = this.isDepthTifImage(samplesPerPixel, sampleFormat, bitsPerSample);
                
                if (!isDepthImage) {
                    const bitDepth = bitsPerSample && bitsPerSample.length > 0 ? bitsPerSample[0] : 'unknown';
                    const formatDesc = sampleFormat === 3 ? 'float' : sampleFormat === 1 ? 'uint' : sampleFormat === 2 ? 'int' : 'unknown';
                    console.log('Detected regular TIF image - not suitable for point cloud conversion');
                    this.showError(`This TIF file appears to be a regular image (${samplesPerPixel} channel(s), ${bitDepth}-bit ${formatDesc}) rather than a depth/disparity image. Please use a single-channel depth TIF (floating-point) or disparity TIF (integer or floating-point) for point cloud conversion.`);
                    this.pendingDepthFiles.delete(requestId);
                    return;
                }
            } else if (isNpy) {
                // NPY files are assumed to be depth data - no additional validation needed
                console.log('Detected NPY/NPZ file - treating as depth data');
            } else if (isPng) {
                // PNG files are assumed to be depth data - need scale factor
                console.log('Detected PNG file - treating as depth data');
            }

            // For all depth file types (TIF, PFM, NPY, PNG), we need to read the image first to get dimensions
            // This will be done in processDepthWithParams after reading the actual image
            const defaultSettings: CameraParams = {
                cameraModel: this.defaultDepthSettings.cameraModel,
                fx: this.defaultDepthSettings.fx,
                fy: this.defaultDepthSettings.fy,
                cx: undefined, // Will be auto-calculated from image dimensions
                cy: undefined, // Will be auto-calculated from image dimensions
                depthType: this.defaultDepthSettings.depthType,
                baseline: this.defaultDepthSettings.baseline,
                convention: this.defaultDepthSettings.convention || 'opengl',
                pngScaleFactor: isPng ? (this.defaultDepthSettings.pngScaleFactor || 1000) : undefined
            };
            console.log('✅ Using saved default depth settings for initial conversion:', defaultSettings);
            const fileTypeLabel = isPng ? 'PNG' : isPfm ? 'PFM' : isNpy ? 'NPY' : 'TIF';
            const scaleInfo = isPng ? `, scale factor ${defaultSettings.pngScaleFactor}` : '';
            const fyInfo = defaultSettings.fy ? ` / fy=${defaultSettings.fy}` : '';
            this.showStatus(`Converting ${fileTypeLabel} depth image: ${defaultSettings.cameraModel} camera, fx=${defaultSettings.fx}${fyInfo}px, ${defaultSettings.depthType} depth${scaleInfo}...`);
            await this.processDepthWithParams(requestId, defaultSettings);

        } catch (error) {
            console.error('Error handling depth data:', error);
            const isTif = /\.(tif|tiff)$/i.test(message.fileName);
            const isNpy = /\.(npy|npz)$/i.test(message.fileName);
            const isPng = /\.png$/i.test(message.fileName);
            const label = isTif ? 'TIF' : isNpy ? 'NPY' : isPng ? 'PNG' : 'depth';
            this.showError(`Failed to process ${label} data: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async processDepthWithParams(requestId: string, cameraParams: CameraParams): Promise<void> {
        const depthFileData = this.pendingDepthFiles.get(requestId);
        if (!depthFileData) {
            console.error('Depth file data not found for requestId:', requestId);
            return;
        }

        console.log('Processing depth with camera params:', cameraParams);
        this.showStatus('Converting depth image to point cloud...');

        // Store original data for re-processing
        this.originalDepthFileName = depthFileData.fileName;
        this.currentCameraParams = cameraParams;

        // Process the depth data using the new depth processing system
        const result = await this.processDepthToPointCloud(depthFileData.data, depthFileData.fileName, cameraParams);

        const isPfm = /\.pfm$/i.test(depthFileData.fileName);
        const isTif = /\.(tif|tiff)$/i.test(depthFileData.fileName);
        const isNpy = /\.(npy|npz)$/i.test(depthFileData.fileName);
        const isPng = /\.png$/i.test(depthFileData.fileName);
        const fileType = isPfm ? 'PFM' : isNpy ? 'NPY' : isPng ? 'PNG' : 'TIF';

        // Create PLY data structure with vertices converted from typed arrays
        const vertices: PlyVertex[] = [];
        for (let i = 0; i < result.pointCount; i++) {
            const vertex: PlyVertex = {
                x: result.vertices[i * 3],
                y: result.vertices[i * 3 + 1],
                z: result.vertices[i * 3 + 2]
            };
            if (result.colors) {
                vertex.red = Math.round(result.colors[i * 3] * 255);
                vertex.green = Math.round(result.colors[i * 3 + 1] * 255);
                vertex.blue = Math.round(result.colors[i * 3 + 2] * 255);
            }
            vertices.push(vertex);
        }

        const plyData: PlyData = {
            vertices: vertices,
            faces: [],
            vertexCount: result.pointCount,
            hasColors: !!result.colors,
            hasNormals: false,
            faceCount: 0,
            fileName: depthFileData.fileName,
            fileIndex: depthFileData.isAddFile ? this.plyFiles.length : 0,
            format: 'binary_little_endian',
            version: '1.0',
            comments: [
                `Converted from ${fileType} depth image: ${depthFileData.fileName}`, 
                `Camera: ${cameraParams.cameraModel}`, 
                `Depth type: ${cameraParams.depthType}`,
                `fx: ${cameraParams.fx}px${cameraParams.fy ? `, fy: ${cameraParams.fy}px` : ''}`,
                ...(cameraParams.baseline ? [`Baseline: ${cameraParams.baseline}mm`] : []),
                ...(cameraParams.pngScaleFactor ? [`Scale factor: scale=${cameraParams.pngScaleFactor}`] : [])
            ]
        };

        console.log(`${fileType} to PLY conversion complete: ${result.pointCount} points`);

        // Add to scene
        if (depthFileData.isAddFile) {
            this.addNewFiles([plyData]);
        } else {
            await this.displayFiles([plyData]);
        }

        // Cache the depth file data for later reprocessing (using the file index)
        const fileIndex = plyData.fileIndex || 0;
        const dimensions = {
            width: (result as any).width || 0,
            height: (result as any).height || 0
        };
        
        // Log depth image dimensions when storing
        console.log(`📐 Storing depth data for file ${fileIndex} (${fileType}):\n   Dimensions: ${dimensions.width} × ${dimensions.height}\n   Computed principle point would be: cx = ${(dimensions.width-1)/2}, cy = ${(dimensions.height-1)/2}`);
        
        this.fileDepthData.set(fileIndex, {
            originalData: depthFileData.data,
            fileName: depthFileData.fileName,
            cameraParams: cameraParams,
            depthDimensions: dimensions
        });

        // Update the cx/cy form fields with the actual computed values
        this.updatePrinciplePointFields(fileIndex, dimensions);

        // Clean up
        this.pendingDepthFiles.delete(requestId);
        this.showStatus(`${fileType} to point cloud conversion complete: ${result.pointCount} points`);
    }

    private async processDepthToPointCloud(depthData: ArrayBuffer, fileName: string, cameraParams: CameraParams): Promise<DepthConversionResult> {
        const { registerDefaultReaders, readDepth } = await import('./depth/DepthRegistry');
        const { normalizeDepth, projectToPointCloud } = await import('./depth/DepthProjector');
        try {
            // DEBUG: Log what parameters we received
            console.log(`🔬 PROCESS DEPTH DEBUG for ${fileName}:\n  Received cameraParams: ${JSON.stringify(cameraParams, null, 2)}\n  depthType specifically: ${cameraParams.depthType}\n  baseline specifically: ${cameraParams.baseline}`);
            
            registerDefaultReaders();
            
            // Configure PNG reader with scale factor if processing PNG file
            if (/\.png$/i.test(fileName) && cameraParams.pngScaleFactor) {
                const { PngReader } = await import('./depth/readers/PngReader');
                const pngReader = new PngReader();
                pngReader.setConfig({
                    pngScaleFactor: cameraParams.pngScaleFactor,
                    invalidValue: 0
                });
                
                // Re-register the configured PNG reader
                const { registerReader } = await import('./depth/DepthRegistry');
                registerReader(pngReader);
                console.log(`🎯 Configured PNG reader with scale factor: ${cameraParams.pngScaleFactor}`);
            }
            
            const { image, meta: baseMeta } = await readDepth(fileName, depthData);
            
            // Update cx/cy with computed values if they are still placeholder values
            const computedCx = (image.width - 1) / 2;
            const computedCy = (image.height - 1) / 2;
            
            // If cx/cy are not provided, replace with computed values
            const shouldUpdateCx = cameraParams.cx === undefined;
            const shouldUpdateCy = cameraParams.cy === undefined;
            
            if (shouldUpdateCx) {
                cameraParams.cx = computedCx;
                console.log(`📐 Updated cx from placeholder to computed value: ${computedCx}`);
            }
            
            if (shouldUpdateCy) {
                cameraParams.cy = computedCy;  
                console.log(`📐 Updated cy from placeholder to computed value: ${computedCy}`);
            }
            
            // Log image dimensions and principle point information
            console.log(`📐 Depth image loaded: ${fileName}\n   Image dimensions: ${image.width} × ${image.height} pixels\n   Auto-computed principle point: cx = ${computedCx}, cy = ${computedCy}\n   Using cx/cy values from camera parameters: cx = ${cameraParams.cx}, cy = ${cameraParams.cy}\n   🎯 Camera parameters are the source of truth for principle point`);
            
            // Set up camera parameters (use values from camera parameters, which may have been updated)
            const fx = cameraParams.fx;
            const fy = cameraParams.fy || cameraParams.fx; // Use fx if fy is not provided
            const cx = cameraParams.cx !== undefined ? cameraParams.cx : (image.width - 1) / 2; // Use provided value or auto-calculate
            const cy = cameraParams.cy !== undefined ? cameraParams.cy : (image.height - 1) / 2; // Use provided value or auto-calculate

            // Override depth kind based on UI selection
            const meta: any = { ...baseMeta };
            console.log(`  📋 Original baseMeta.kind: ${baseMeta.kind}\n  ⚙️ Checking depthType: ${cameraParams.depthType}`);
            
            if (cameraParams.depthType === 'disparity') {
                const fxOk = !!cameraParams.fx && cameraParams.fx > 0;
                const blOk = !!cameraParams.baseline && cameraParams.baseline > 0;
                console.log(`  🔍 Disparity checks: fxOk=${fxOk} (${cameraParams.fx}), blOk=${blOk} (${cameraParams.baseline})`);
                if (fxOk && blOk) {
                    meta.kind = 'disparity';
                    meta.baseline = cameraParams.baseline! / 1000; // Convert mm to meters
                    meta.disparityOffset = cameraParams.disparityOffset || 0; // Default to 0
                    console.log(`  ✅ Set meta.kind to 'disparity', baseline=${meta.baseline}m, offset=${meta.disparityOffset}`);
                } else {
                    console.warn('Disparity selected but baseline/focal missing; keeping original kind:', baseMeta.kind);
                }
            } else if (cameraParams.depthType === 'orthogonal') {
                meta.kind = 'z';
                console.log(`  ✅ Set meta.kind to 'z' (orthogonal)`);
            } else if (cameraParams.depthType === 'euclidean') {
                meta.kind = 'depth';
                console.log(`  ✅ Set meta.kind to 'depth' (euclidean)`);
            } else if (cameraParams.depthType === 'inverse_depth') {
                meta.kind = 'inverse_depth';
                console.log(`  ✅ Set meta.kind to 'inverse_depth'`);
            }
            
            console.log(`  📋 Final meta.kind: ${meta.kind}`);

            const norm = normalizeDepth(image, {
                ...meta,
                fx, fy, cx, cy,
                baseline: meta.baseline,
                depthScale: cameraParams.depthScale,
                depthBias: cameraParams.depthBias
            });

            // Prepare projection parameters
            const projectionParams = {
                kind: meta.kind,
                fx, fy, cx, cy,
                cameraModel: cameraParams.cameraModel,
                convention: cameraParams.convention || 'opengl',
                k1: cameraParams.k1 ? parseFloat(cameraParams.k1.toString()) : undefined,
                k2: cameraParams.k2 ? parseFloat(cameraParams.k2.toString()) : undefined,
                k3: cameraParams.k3 ? parseFloat(cameraParams.k3.toString()) : undefined,
                k4: cameraParams.k4 ? parseFloat(cameraParams.k4.toString()) : undefined,
                k5: cameraParams.k5 ? parseFloat(cameraParams.k5.toString()) : undefined,
                p1: cameraParams.p1 ? parseFloat(cameraParams.p1.toString()) : undefined,
                p2: cameraParams.p2 ? parseFloat(cameraParams.p2.toString()) : undefined
            };

            // 🚀 DETAILED LOGGING: All parameters used for point cloud computation
            console.log(`🚀 DEPTH-TO-POINT-CLOUD CONVERSION
📁 File: ${fileName}
📏 Image Dimensions: ${norm.width}×${norm.height}
🎯 Depth Type (kind): ${meta.kind}
📷 Camera Model: ${projectionParams.cameraModel}
🔧 Coordinate Convention: ${projectionParams.convention}
🔍 Intrinsic Parameters:
  - fx (focal length x): ${fx}
  - fy (focal length y): ${fy}
  - cx (principal point x): ${cx}
  - cy (principal point y): ${cy}
📐 Distortion Coefficients:
  - k1 (radial): ${projectionParams.k1 ?? 'not set'}
  - k2 (radial): ${projectionParams.k2 ?? 'not set'}
  - k3 (radial): ${projectionParams.k3 ?? 'not set'}
  - k4 (radial): ${projectionParams.k4 ?? 'not set'}
  - k5 (radial): ${projectionParams.k5 ?? 'not set'}
  - p1 (tangential): ${projectionParams.p1 ?? 'not set'}
  - p2 (tangential): ${projectionParams.p2 ?? 'not set'}
💾 Normalization Parameters:
  - baseline: ${meta.baseline ?? 'not set'}
  - depthScale: ${cameraParams.depthScale ?? 'not set'}
  - depthBias: ${cameraParams.depthBias ?? 'not set'}`);

            const result = projectToPointCloud(norm, projectionParams);
            
            // 🎉 CONVERSION RESULTS LOGGING
            console.log(`🎉 DEPTH-TO-POINT-CLOUD CONVERSION COMPLETED
📊 Results:
  - Points generated: ${result.pointCount}
  - Has colors: ${!!result.colors}
  - Vertices array size: ${result.vertices.length}
  - Colors array size: ${result.colors?.length ?? 0}`);
            
            return result as unknown as DepthConversionResult;
        } catch (error) {
            throw new Error(`Failed to process depth file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async handleObjData(message: any): Promise<void> {
        try {
                console.log(`Load: recv OBJ ${message.fileName}`);
                this.showStatus(`OBJ: processing ${message.fileName}`);
            
            const objData = message.data;
            const hasFaces = objData.faceCount > 0;
            const hasLines = objData.lineCount > 0;
            const hasPoints = objData.pointCount > 0;
            
                console.log(`OBJ: v=${objData.vertexCount}, pts=${objData.pointCount}, f=${objData.faceCount}, lines=${objData.lineCount}, groups=${objData.materialGroups ? objData.materialGroups.length : 0}`);
            
            // Convert OBJ vertices to PLY format
            const vertices: PlyVertex[] = objData.vertices.map((v: any) => ({
                x: v.x,
                y: v.y,
                z: v.z,
                red: 128,  // Default gray color
                green: 128,
                blue: 128
            }));
            
            // Convert OBJ faces to PLY format if they exist
            const faces: PlyFace[] = [];
            if (hasFaces) {
                for (const objFace of objData.faces) {
                    if (objFace.indices.length >= 3) {
                        faces.push({
                            indices: objFace.indices
                        });
                    }
                }
            }
            
            // Create PLY data structure
            const plyData: PlyData = {
                vertices,
                faces,
                format: 'ascii',
                version: '1.0',
                comments: [`Converted from OBJ file: ${message.fileName}`],
                vertexCount: vertices.length,
                faceCount: faces.length,
                hasColors: true,
                hasNormals: objData.hasNormals,
                fileName: message.fileName, // Keep original OBJ filename
                fileIndex: this.plyFiles.length
            };
            
            // Store OBJ-specific data for enhanced rendering
            (plyData as any).objData = objData;
            (plyData as any).isObjFile = true;
            (plyData as any).objRenderType = hasFaces ? 'mesh' : 'wireframe';
            
            // Store line data for wireframe rendering (either as primary or secondary visualization)
            if (hasLines) {
                (plyData as any).objLines = objData.lines;
                (plyData as any).hasWireframe = true;
            }
            
            // Store point data for point rendering
            if (hasPoints) {
                (plyData as any).objPoints = objData.points;
                (plyData as any).hasPoints = true;
            }
            
            // Add to visualization
            if (message.isAddFile) {
                this.addNewFiles([plyData]);
            } else {
                await this.displayFiles([plyData]);
            }
            
            // Status message based on what was loaded
            let statusParts = [`${vertices.length.toLocaleString()} vertices`];
            if (hasPoints) statusParts.push(`${objData.pointCount} points`);
            if (hasFaces) statusParts.push(`${faces.length.toLocaleString()} faces`);
            if (hasLines) statusParts.push(`${objData.lineCount} line segments`);
            if (objData.hasTextures) statusParts.push(`${objData.textureCoordCount} texture coords`);
            if (objData.hasNormals) statusParts.push(`${objData.normalCount} normals`);
            
            this.showStatus(`OBJ ${hasFaces ? 'mesh' : 'wireframe'} loaded: ${statusParts.join(', ')}`);
            
        } catch (error) {
            console.error('Error handling OBJ data:', error);
            this.showError(`Failed to process OBJ file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async handleStlData(message: any): Promise<void> {
        try {
            console.log(`Load: recv STL ${message.fileName}`);
            this.showStatus(`STL: processing ${message.fileName}`);
            
            const stlData = message.data;
            const hasColors = stlData.hasColors;
            
            console.log(`STL: ${stlData.triangleCount} triangles, format=${stlData.format}, colors=${hasColors}`);
            
            // Handle empty STL files
            if (stlData.triangleCount === 0 || !stlData.triangles || stlData.triangles.length === 0) {
                console.log('STL: Empty mesh detected');
                this.showStatus(`STL: Empty mesh loaded (${message.fileName})`);
                
                // Create minimal PLY data for empty mesh
                const plyData: PlyData = {
                    vertices: [],
                    faces: [],
                    format: stlData.format === 'binary' ? 'binary_little_endian' : 'ascii',
                    version: '1.0',
                    comments: [
                        `Empty STL mesh: ${message.fileName}`,
                        `Original format: ${stlData.format}`,
                        ...(stlData.header ? [`Header: ${stlData.header}`] : [])
                    ],
                    vertexCount: 0,
                    faceCount: 0,
                    hasColors: false,
                    hasNormals: false,
                    fileName: message.fileName.replace(/\.stl$/i, '_empty.ply'),
                    fileIndex: this.plyFiles.length
                };
                
                // Add to visualization (even empty files should be tracked)
                if (message.isAddFile) {
                    this.addNewFiles([plyData]);
                } else {
                    await this.displayFiles([plyData]);
                }
                
                return;
            }
            
            // Convert STL triangles to PLY vertices and faces
            const vertices: PlyVertex[] = [];
            const faces: PlyFace[] = [];
            const vertexMap = new Map<string, number>(); // For deduplication
            
            let vertexIndex = 0;
            
            for (let i = 0; i < stlData.triangles.length; i++) {
                const triangle = stlData.triangles[i];
                const faceIndices: number[] = [];
                
                // Process each vertex of the triangle
                for (let j = 0; j < 3; j++) {
                    const vertex = triangle.vertices[j];
                    const key = `${vertex.x},${vertex.y},${vertex.z}`;
                    
                    let vIndex = vertexMap.get(key);
                    if (vIndex === undefined) {
                        // New vertex
                        vIndex = vertexIndex++;
                        vertexMap.set(key, vIndex);
                        
                        const plyVertex: PlyVertex = {
                            x: vertex.x,
                            y: vertex.y,
                            z: vertex.z,
                            nx: triangle.normal.x,
                            ny: triangle.normal.y,
                            nz: triangle.normal.z
                        };
                        
                        // Add color if available
                        if (hasColors && triangle.color) {
                            plyVertex.red = triangle.color.red;
                            plyVertex.green = triangle.color.green;
                            plyVertex.blue = triangle.color.blue;
                        } else {
                            // Default gray color
                            plyVertex.red = 180;
                            plyVertex.green = 180;
                            plyVertex.blue = 180;
                        }
                        
                        vertices.push(plyVertex);
                    }
                    
                    faceIndices.push(vIndex);
                }
                
                // Add the face
                faces.push({
                    indices: faceIndices
                });
            }
            
            // Create PLY data structure
            const plyData: PlyData = {
                vertices,
                faces,
                format: stlData.format === 'binary' ? 'binary_little_endian' : 'ascii',
                version: '1.0',
                comments: [
                    `Converted from STL file: ${message.fileName}`,
                    `Original format: ${stlData.format}`,
                    `Triangle count: ${stlData.triangleCount}`,
                    ...(stlData.header ? [`Header: ${stlData.header}`] : [])
                ],
                vertexCount: vertices.length,
                faceCount: faces.length,
                hasColors: true,
                hasNormals: true,
                fileName: message.fileName.replace(/\.stl$/i, '_mesh.ply'),
                fileIndex: this.plyFiles.length
            };
            
            // Store STL-specific data for enhanced rendering
            (plyData as any).stlData = stlData;
            (plyData as any).isStlFile = true;
            (plyData as any).stlFormat = stlData.format;
            (plyData as any).stlTriangleCount = stlData.triangleCount;
            
            // Add to visualization
            if (message.isAddFile) {
                this.addNewFiles([plyData]);
            } else {
                await this.displayFiles([plyData]);
            }
            
            // Status message
            const statusParts = [
                `${vertices.length.toLocaleString()} vertices`,
                `${faces.length.toLocaleString()} triangles`,
                `${stlData.format} format`
            ];
            if (hasColors) {
                statusParts.push('with colors');
            }
            
            this.showStatus(`STL mesh loaded: ${statusParts.join(', ')}`);
            
        } catch (error) {
            console.error('Error handling STL data:', error);
            this.showError(`Failed to process STL file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async handleXyzData(message: any): Promise<void> {
        try {
            console.log('Received XYZ data for processing:', message.fileName);
            this.showStatus('Parsing XYZ file...');
            
            // Parse XYZ file (simple format: x y z [r g b] per line)
            const decoder = new TextDecoder('utf-8');
            const text = decoder.decode(message.data);
            const lines = text.split('\n').filter(line => line.trim().length > 0);
            
            const vertices: PlyVertex[] = [];
            let hasColors = false;
            
            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 3) {
                    const x = parseFloat(parts[0]);
                    const y = parseFloat(parts[1]);
                    const z = parseFloat(parts[2]);
                    
                    if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                        const vertex: PlyVertex = { x, y, z };
                        
                        // Check for color data (RGB values)
                        if (parts.length >= 6) {
                            const r = parseInt(parts[3]);
                            const g = parseInt(parts[4]);
                            const b = parseInt(parts[5]);
                            
                            if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
                                vertex.red = Math.max(0, Math.min(255, r));
                                vertex.green = Math.max(0, Math.min(255, g));
                                vertex.blue = Math.max(0, Math.min(255, b));
                                hasColors = true;
                            }
                        }
                        
                        vertices.push(vertex);
                    }
                }
            }
            
            if (vertices.length === 0) {
                throw new Error('No valid vertices found in XYZ file');
            }
            
            // Create PLY data structure
            const plyData: PlyData = {
                vertices,
                faces: [],
                format: 'ascii',
                version: '1.0',
                comments: [`Converted from XYZ file: ${message.fileName}`],
                vertexCount: vertices.length,
                faceCount: 0,
                hasColors,
                hasNormals: false,
                fileName: message.fileName.replace(/\.xyz$/i, '_pointcloud.ply'),
                fileIndex: this.plyFiles.length
            };
            
            // Add to visualization
            if (message.isAddFile) {
                this.addNewFiles([plyData]);
            } else {
                await this.displayFiles([plyData]);
            }
            
            this.showStatus(`XYZ file loaded successfully! ${vertices.length.toLocaleString()} points${hasColors ? ' with colors' : ''}`);
            
        } catch (error) {
            console.error('Error handling XYZ data:', error);
            this.showError(`Failed to process XYZ file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async handleCameraParams(message: any): Promise<void> {
        try {
            const requestId = message.requestId;
            if (!requestId || !this.pendingDepthFiles.has(requestId)) {
                throw new Error('No Deptn data available for processing');
            }

            console.log('Processing Depth with camera params:', message);
            
            const cameraParams: CameraParams = {
                cameraModel: message.cameraModel,
                fx: message.fx,
                fy: message.fy,
                cx: message.cx, // Will be calculated from image dimensions if not provided
                cy: message.cy, // Will be calculated from image dimensions if not provided
                depthType: message.depthType || 'euclidean', // Default to euclidean for backward compatibility
                baseline: message.baseline,
                convention: message.convention || 'opengl' // Default to OpenGL convention
            };

            // Save camera parameters for future use
            this.saveCameraParams(cameraParams);
            console.log('✅ Camera parameters saved for future Depth files');
            
            // Process the depth file (could be TIF or PFM)
            await this.processDepthWithParams(requestId, cameraParams);
            
        } catch (error) {
            console.error('Error processing Depth with camera params:', error);
            this.showError(`Depth conversion failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private loadSavedCameraParams(): CameraParams | null {
        try {
            const saved = localStorage.getItem('plyVisualizerCameraParams');
            if (saved) {
                return JSON.parse(saved);
            }
        } catch (error) {
            console.warn('Failed to load saved camera parameters:', error);
        }
        return null;
    }

    private saveCameraParams(params: CameraParams): void {
        try {
            localStorage.setItem('plyVisualizerCameraParams', JSON.stringify(params));
            console.log('Camera parameters saved for future use');
        } catch (error) {
            console.warn('Failed to save camera parameters:', error);
        }
    }

    private handleCameraParamsCancelled(requestId?: string): void {
        console.log('Camera parameter selection cancelled');
        if (requestId && this.pendingDepthFiles.has(requestId)) {
            // Remove only the specific cancelled Depth file
            const depthData = this.pendingDepthFiles.get(requestId);
            this.pendingDepthFiles.delete(requestId);
            this.showError(`Depth conversion cancelled for ${depthData?.fileName || 'file'}`);
        } else {
            // Fallback: clear all pending Depth files
            this.pendingDepthFiles.clear();
            this.showError('Depth conversion cancelled by user');
        }
    }

    private handleCameraParamsError(error: string, requestId?: string): void {
        console.error('Camera parameter error:', error);
        if (requestId && this.pendingDepthFiles.has(requestId)) {
            // Remove only the specific Deptj file with error
            const depthData = this.pendingDepthFiles.get(requestId);
            this.pendingDepthFiles.delete(requestId);
            this.showError(`Camera parameter error for ${depthData?.fileName || 'file'}: ${error}`);
        } else {
            // Fallback: clear all pending Depth files
            this.pendingDepthFiles.clear();
            this.showError(`Camera parameter error: ${error}`);
        }
    }

    private handleSavePlyFileResult(message: any): void {
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
        try {
            console.log(`Load: recv PCD ${message.fileName}`);
            this.showStatus(`PCD: processing ${message.fileName}`);
            
            const pcdData = message.data;
            console.log(`PCD: ${pcdData.vertexCount} points, format=${pcdData.format}, colors=${pcdData.hasColors}, normals=${pcdData.hasNormals}`);
            
            // Convert PCD data to PLY format for rendering
            const plyData: PlyData = {
                vertices: pcdData.vertices,
                faces: [], // PCD files are point clouds, no faces
                format: pcdData.format === 'binary' ? 'binary_little_endian' : 'ascii',
                version: '1.0',
                comments: [
                    `Converted from PCD: ${message.fileName}`,
                    `Original format: ${pcdData.format}`,
                    `Width: ${pcdData.width}, Height: ${pcdData.height}`,
                    `Fields: ${pcdData.fields?.join(', ') || 'unknown'}`,
                    ...pcdData.comments
                ],
                vertexCount: pcdData.vertexCount,
                faceCount: 0,
                hasColors: pcdData.hasColors,
                hasNormals: pcdData.hasNormals,
                fileName: message.fileName
            };

            if (message.isAddFile) {
                this.addNewFiles([plyData]);
            } else {
                await this.displayFiles([plyData]);
            }

            // Create normals visualizer if PCD has normals
            if (plyData.hasNormals) {
                const normalsVisualizer = this.createNormalsVisualizer(plyData);
                
                // Set initial visibility based on stored state (default true)
                const fileIndex = plyData.fileIndex || (this.plyFiles.length - 1);
                const initialVisible = this.normalsVisible[fileIndex] !== false;
                normalsVisualizer.visible = initialVisible;
                
                this.scene.add(normalsVisualizer);
                
                // Ensure the array has the correct size and place the visualizer at the right index
                while (this.normalsVisualizers.length <= fileIndex) {
                    this.normalsVisualizers.push(null);
                }
                this.normalsVisualizers[fileIndex] = normalsVisualizer;
            }
            
            this.showStatus(`PCD: loaded ${pcdData.vertexCount} points from ${message.fileName}`);
            
        } catch (error) {
            console.error('Error handling PCD data:', error);
            this.showError(`PCD processing failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async handlePtsData(message: any): Promise<void> {
        try {
            console.log(`Load: recv PTS ${message.fileName}`);
            this.showStatus(`PTS: processing ${message.fileName}`);
            
            const ptsData = message.data;
            console.log(`PTS: ${ptsData.vertexCount} points, format=${ptsData.detectedFormat}, colors=${ptsData.hasColors}, normals=${ptsData.hasNormals}, intensity=${ptsData.hasIntensity}`);
            
            // Convert PTS data to PLY format for rendering
            const plyData: PlyData = {
                vertices: ptsData.vertices,
                faces: [], // PTS files are point clouds, no faces
                format: 'ascii',
                version: '1.0',
                comments: [
                    `Converted from PTS: ${message.fileName}`,
                    `Detected format: ${ptsData.detectedFormat}`,
                    ...ptsData.comments
                ],
                vertexCount: ptsData.vertexCount,
                faceCount: 0,
                hasColors: ptsData.hasColors,
                hasNormals: ptsData.hasNormals,
                fileName: message.fileName
            };

            if (message.isAddFile) {
                this.addNewFiles([plyData]);
            } else {
                await this.displayFiles([plyData]);
            }

            // Create normals visualizer if PTS has normals
            if (plyData.hasNormals) {
                const normalsVisualizer = this.createNormalsVisualizer(plyData);
                
                // Set initial visibility based on stored state (default true)
                const fileIndex = plyData.fileIndex || (this.plyFiles.length - 1);
                const initialVisible = this.normalsVisible[fileIndex] !== false;
                normalsVisualizer.visible = initialVisible;
                
                this.scene.add(normalsVisualizer);
                
                // Ensure the array has the correct size and place the visualizer at the right index
                while (this.normalsVisualizers.length <= fileIndex) {
                    this.normalsVisualizers.push(null);
                }
                this.normalsVisualizers[fileIndex] = normalsVisualizer;
            }
            
            this.showStatus(`PTS: loaded ${ptsData.vertexCount} points from ${message.fileName}`);
            
        } catch (error) {
            console.error('Error handling PTS data:', error);
            this.showError(`PTS processing failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async handleOffData(message: any): Promise<void> {
        try {
            console.log(`Load: recv OFF ${message.fileName}`);
            this.showStatus(`OFF: processing ${message.fileName}`);
            
            const offData = message.data;
            console.log(`OFF: ${offData.vertexCount} vertices, ${offData.faceCount} faces, variant=${offData.offVariant}, colors=${offData.hasColors}, normals=${offData.hasNormals}`);
            
            // Convert OFF data to PLY format for rendering
            const plyData: PlyData = {
                vertices: offData.vertices,
                faces: offData.faces,
                format: 'ascii',
                version: '1.0',
                comments: [
                    `Converted from OFF: ${message.fileName}`,
                    `OFF variant: ${offData.offVariant}`,
                    ...offData.comments
                ],
                vertexCount: offData.vertexCount,
                faceCount: offData.faceCount,
                hasColors: offData.hasColors,
                hasNormals: offData.hasNormals,
                fileName: message.fileName
            };

            if (message.isAddFile) {
                this.addNewFiles([plyData]);
            } else {
                await this.displayFiles([plyData]);
            }

            // Create normals visualizer if OFF has normals (for both meshes and point clouds)
            if (plyData.hasNormals) {
                const normalsVisualizer = this.createNormalsVisualizer(plyData);
                
                // Set initial visibility based on stored state (default true)
                const fileIndex = plyData.fileIndex || (this.plyFiles.length - 1);
                const initialVisible = this.normalsVisible[fileIndex] !== false;
                normalsVisualizer.visible = initialVisible;
                
                this.scene.add(normalsVisualizer);
                
                // Ensure the array has the correct size and place the visualizer at the right index
                while (this.normalsVisualizers.length <= fileIndex) {
                    this.normalsVisualizers.push(null);
                }
                this.normalsVisualizers[fileIndex] = normalsVisualizer;
            }
            
            const meshType = offData.faceCount > 0 ? 'mesh' : 'point cloud';
            this.showStatus(`OFF: loaded ${offData.vertexCount} vertices, ${offData.faceCount} faces as ${meshType} from ${message.fileName}`);
            
        } catch (error) {
            console.error('Error handling OFF data:', error);
            this.showError(`OFF processing failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async handleGltfData(message: any): Promise<void> {
        try {
            console.log(`Load: recv GLTF/GLB ${message.fileName}`);
            this.showStatus(`GLTF: processing ${message.fileName}`);
            
            const gltfData = message.data;
            console.log(`GLTF: ${gltfData.vertexCount} vertices, ${gltfData.faceCount} faces, ${gltfData.meshCount} meshes, ${gltfData.materialCount} materials, colors=${gltfData.hasColors}, normals=${gltfData.hasNormals}`);
            
            // Convert GLTF data to PLY format for rendering
            const plyData: PlyData = {
                vertices: gltfData.vertices,
                faces: gltfData.faces,
                format: 'ascii',
                version: '1.0',
                comments: [
                    `Converted from GLTF/GLB: ${message.fileName}`,
                    `Format: ${gltfData.format}`,
                    `Meshes: ${gltfData.meshCount}, Materials: ${gltfData.materialCount}`,
                    ...gltfData.comments
                ],
                vertexCount: gltfData.vertexCount,
                faceCount: gltfData.faceCount,
                hasColors: gltfData.hasColors,
                hasNormals: gltfData.hasNormals,
                fileName: message.fileName
            };

            if (message.isAddFile) {
                this.addNewFiles([plyData]);
            } else {
                await this.displayFiles([plyData]);
            }
            
            const meshType = gltfData.faceCount > 0 ? 'mesh' : 'point cloud';
            this.showStatus(`GLTF: loaded ${gltfData.vertexCount} vertices, ${gltfData.faceCount} faces as ${meshType} from ${message.fileName}`);
            
        } catch (error) {
            console.error('Error handling GLTF data:', error);
            this.showError(`GLTF processing failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async handleXyzVariantData(message: any): Promise<void> {
        try {
            console.log(`Load: recv XYZ variant (${message.variant}) ${message.fileName}`);
            this.showStatus(`XYZ: processing ${message.fileName} (${message.variant})`);
            
            // Parse XYZ variant data
            const plyData = this.parseXyzVariantData(message.data, message.variant, message.fileName);

            if (message.isAddFile) {
                this.addNewFiles([plyData]);
            } else {
                await this.displayFiles([plyData]);
            }

            if (plyData.hasNormals) {
                const normalsVisualizer = this.createNormalsVisualizer(plyData);
                
                // Set initial visibility based on stored state (default true)
                const fileIndex = plyData.fileIndex || (this.plyFiles.length - 1);
                const initialVisible = this.normalsVisible[fileIndex] !== false;
                normalsVisualizer.visible = initialVisible;
                
                this.scene.add(normalsVisualizer);
                
                // Ensure the array has the correct size and place the visualizer at the right index
                while (this.normalsVisualizers.length <= fileIndex) {
                    this.normalsVisualizers.push(null);
                }
                this.normalsVisualizers[fileIndex] = normalsVisualizer;
            }
            
            this.showStatus(`${message.variant.toUpperCase()}: loaded ${plyData.vertexCount} points from ${message.fileName}`);
            
        } catch (error) {
            console.error('Error handling XYZ variant data:', error);
            this.showError(`${message.variant.toUpperCase()} processing failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private parseXyzVariantData(data: ArrayBuffer, variant: string, fileName: string): PlyData {
        const decoder = new TextDecoder('utf-8');
        const text = decoder.decode(data);
        const lines = text.split('\n').filter(line => line.trim() !== '');
        
        const vertices: PlyVertex[] = [];
        let hasColors = false;
        let hasNormals = false;
        
        if (variant === 'xyzn') {
            hasNormals = true;
        } else if (variant === 'xyzrgb') {
            hasColors = true;
        }
        
        for (const line of lines) {
            const parts = line.trim().split(/\s+/);
            if (parts.length < 3) continue;
            
            const vertex: PlyVertex = {
                x: parseFloat(parts[0]),
                y: parseFloat(parts[1]),
                z: parseFloat(parts[2])
            };
            
            if (variant === 'xyzn' && parts.length >= 6) {
                vertex.nx = parseFloat(parts[3]);
                vertex.ny = parseFloat(parts[4]);
                vertex.nz = parseFloat(parts[5]);
            } else if (variant === 'xyzrgb' && parts.length >= 6) {
                const r = parseFloat(parts[3]);
                const g = parseFloat(parts[4]);
                const b = parseFloat(parts[5]);
                
                if (r <= 1.0 && g <= 1.0 && b <= 1.0) {
                    vertex.red = Math.round(r * 255);
                    vertex.green = Math.round(g * 255);
                    vertex.blue = Math.round(b * 255);
                } else {
                    vertex.red = Math.round(Math.min(255, Math.max(0, r)));
                    vertex.green = Math.round(Math.min(255, Math.max(0, g)));
                    vertex.blue = Math.round(Math.min(255, Math.max(0, b)));
                }
            }
            
            vertices.push(vertex);
        }
        
        return {
            vertices,
            faces: [],
            format: 'ascii',
            version: '1.0',
            comments: [
                `Converted from ${variant.toUpperCase()}: ${fileName}`,
                `Format variant: ${variant}`
            ],
            vertexCount: vertices.length,
            faceCount: 0,
            hasColors,
            hasNormals,
            fileName: fileName
        };
    }

    private createNormalsVisualizer(data: PlyData): THREE.LineSegments {
        const normalsGeometry = new THREE.BufferGeometry();
        const lines = [];
        const normalLength = 0.1; // Controls how long the normal lines are
        const normalColor = new THREE.Color(0x00ffff); // Cyan color for visibility

        console.log(`🔍 Creating normals visualizer for ${data.fileName}: hasNormals=${data.hasNormals}, vertices=${data.vertices.length}`);
        
        let validNormals = 0;
        for (const p of data.vertices) {
            if (p.nx === undefined || p.ny === undefined || p.nz === undefined) {
                // Debug first few vertices to see what properties they have
                if (validNormals === 0) {
                    console.log(`❌ Vertex missing normals:`, Object.keys(p), p);
                }
                continue;
            }
            validNormals++;
            if (validNormals === 1) {
                console.log(`✅ Found vertex with normals:`, {nx: p.nx, ny: p.ny, nz: p.nz}, p);
            }

            const start = new THREE.Vector3(p.x, p.y, p.z);
            const end = new THREE.Vector3(
                p.x + p.nx * normalLength,
                p.y + p.ny * normalLength,
                p.z + p.nz * normalLength
            );
            lines.push(start, end);
        }

        console.log(`📊 Normals summary: ${validNormals} valid normals out of ${data.vertices.length} vertices, ${lines.length} line points`);
        
        normalsGeometry.setFromPoints(lines);

        const normalsMaterial = new THREE.LineBasicMaterial({ color: normalColor });

        const normalsVisualizer = new THREE.LineSegments(normalsGeometry, normalsMaterial);
        normalsVisualizer.name = "Normals";
        return normalsVisualizer;
    }

    private createComputedNormalsVisualizer(data: PlyData, mesh: THREE.Object3D): THREE.LineSegments | null {
        // Compute normals from the mesh geometry for triangle meshes
        console.log(`🔧 createComputedNormalsVisualizer for ${data.fileName}: faceCount=${data.faceCount}, meshType=${mesh?.type}`);
        
        if (!mesh) {
            console.log('❌ No mesh provided');
            return null;
        }
        
        const normalsGeometry = new THREE.BufferGeometry();
        const lines = [];
        const normalLength = 0.1;
        const normalColor = new THREE.Color(0x00ffff); // Cyan color for visibility
        
        // Get the mesh geometry
        let geometry: THREE.BufferGeometry | null = null;
        if (mesh instanceof THREE.Mesh) {
            geometry = mesh.geometry as THREE.BufferGeometry;
        } else if (mesh instanceof THREE.Group) {
            // For groups, find the first mesh child
            mesh.traverse((child) => {
                if (child instanceof THREE.Mesh && !geometry) {
                    geometry = child.geometry as THREE.BufferGeometry;
                }
            });
        }
        
        if (!geometry) {
            console.log('❌ No geometry found in mesh');
            return null;
        }
        
        console.log(`📐 Found geometry with ${geometry.attributes.position?.count || 0} vertices`);
        
        // Ensure normals are computed
        if (!geometry.attributes.normal) {
            console.log('🔄 Computing vertex normals...');
            geometry.computeVertexNormals();
        } else {
            console.log('✅ Geometry already has normals');
        }
        
        const positions = geometry.attributes.position;
        const normals = geometry.attributes.normal;
        
        if (!positions || !normals) {
            console.log('❌ Missing position or normal attributes');
            return null;
        }
        
        // Create normal lines from vertices
        const vertexCount = positions.count;
        for (let i = 0; i < vertexCount; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = positions.getZ(i);
            
            const nx = normals.getX(i);
            const ny = normals.getY(i);
            const nz = normals.getZ(i);
            
            const start = new THREE.Vector3(x, y, z);
            const end = new THREE.Vector3(
                x + nx * normalLength,
                y + ny * normalLength,
                z + nz * normalLength
            );
            lines.push(start, end);
        }
        
        console.log(`✅ Created ${lines.length / 2} normal lines for ${data.fileName}`);
        
        normalsGeometry.setFromPoints(lines);
        const normalsMaterial = new THREE.LineBasicMaterial({ color: normalColor });
        
        const normalsVisualizer = new THREE.LineSegments(normalsGeometry, normalsMaterial);
        normalsVisualizer.name = "Computed Normals";
        return normalsVisualizer;
    }

    private createPointCloudNormalsVisualizer(data: PlyData, mesh: THREE.Object3D): THREE.LineSegments | null {
        // Extract normals from Three.js Points geometry for point clouds
        console.log(`🔧 createPointCloudNormalsVisualizer for ${data.fileName}`);
        
        if (!mesh || mesh.type !== 'Points') {
            console.log('❌ Not a point cloud mesh');
            return null;
        }
        
        const geometry = (mesh as THREE.Points).geometry as THREE.BufferGeometry;
        if (!geometry) {
            console.log('❌ No geometry found');
            return null;
        }
        
        const positions = geometry.attributes.position;
        const normals = geometry.attributes.normal;
        
        if (!positions) {
            console.log('❌ No position attributes');
            return null;
        }
        
        if (!normals) {
            console.log('❌ No normal attributes in point cloud geometry');
            return null;
        }
        
        console.log(`📐 Found point cloud with ${positions.count} points and normals`);
        
        const normalsGeometry = new THREE.BufferGeometry();
        const lines = [];
        const normalLength = 0.1;
        const normalColor = new THREE.Color(0x00ffff); // Cyan color for visibility
        
        // Create normal lines from point cloud vertices
        const vertexCount = positions.count;
        for (let i = 0; i < vertexCount; i++) {
            const x = positions.getX(i);
            const y = positions.getY(i);
            const z = positions.getZ(i);
            
            const nx = normals.getX(i);
            const ny = normals.getY(i);
            const nz = normals.getZ(i);
            
            const start = new THREE.Vector3(x, y, z);
            const end = new THREE.Vector3(
                x + nx * normalLength,
                y + ny * normalLength,
                z + nz * normalLength
            );
            lines.push(start, end);
        }
        
        console.log(`✅ Created ${lines.length / 2} normal lines for point cloud ${data.fileName}`);
        
        normalsGeometry.setFromPoints(lines);
        const normalsMaterial = new THREE.LineBasicMaterial({ color: normalColor });
        
        const normalsVisualizer = new THREE.LineSegments(normalsGeometry, normalsMaterial);
        normalsVisualizer.name = "Point Cloud Normals";
        return normalsVisualizer;
    }

    private async handleColorImageData(message: any): Promise<void> {
        try {
            console.log('Received color image data for file index:', message.fileIndex);
            
            // Convert the ArrayBuffer back to a File-like object for processing
            const blob = new Blob([message.data], { type: message.mimeType || 'image/png' });
            const file = new File([blob], message.fileName, { type: message.mimeType || 'image/png' });
            
            // Get depth data first to access dimensions
            const fileIndex = message.fileIndex;
            const depthData = this.fileDepthData.get(fileIndex);
            if (!depthData) {
                throw new Error('No cached depth data found for this file');
            }

            // Load and validate the color image
            const imageData = await this.loadAndValidateColorImage(file, depthData.depthDimensions);
            
            if (!imageData) {
                return; // Error already shown in loadAndValidateColorImage
            }

            // Store color image data and name in depth data for future reprocessing
            depthData.colorImageData = imageData;
            depthData.colorImageName = message.fileName;

            // Reprocess depth image with color data
            const result = await this.processDepthToPointCloud(depthData.originalData, depthData.fileName, depthData.cameraParams);
            await this.applyColorToDepthResult(result, imageData, depthData);

            // Update the PLY data
            const plyData = this.plyFiles[fileIndex];
            plyData.vertices = this.convertDepthResultToVertices(result);
            plyData.hasColors = true;

            // Update the mesh with colored data
            const oldMaterial = this.meshes[fileIndex].material;
            const newMaterial = this.createMaterialForFile(plyData, fileIndex);
            this.meshes[fileIndex].material = newMaterial;
            
            // Ensure point size is correctly applied to the new material
            if (this.meshes[fileIndex] instanceof THREE.Points && newMaterial instanceof THREE.PointsMaterial) {
                const currentPointSize = this.pointSizes[fileIndex] || 0.001;
                newMaterial.size = currentPointSize;
                console.log(`🔧 Applied point size ${currentPointSize} to color-updated depth material for file ${fileIndex}`);
            }
            
            // Update geometry with colors
            const geometry = this.meshes[fileIndex].geometry as THREE.BufferGeometry;
            
            // Create position array
            const positions = new Float32Array(plyData.vertices.length * 3);
            for (let i = 0, i3 = 0; i < plyData.vertices.length; i++, i3 += 3) {
                const vertex = plyData.vertices[i];
                positions[i3] = vertex.x;
                positions[i3 + 1] = vertex.y;
                positions[i3 + 2] = vertex.z;
            }
            const positionAttribute = new THREE.BufferAttribute(positions, 3);
            geometry.setAttribute('position', positionAttribute);
            positionAttribute.needsUpdate = true;
            
            // Create color array
            const colors = new Float32Array(plyData.vertices.length * 3);
            if (this.convertSrgbToLinear) {
                this.ensureSrgbLUT();
                const lut = this.srgbToLinearLUT!;
                for (let i = 0, i3 = 0; i < plyData.vertices.length; i++, i3 += 3) {
                    const v = plyData.vertices[i];
                    const r8 = (v.red || 0) & 255;
                    const g8 = (v.green || 0) & 255;
                    const b8 = (v.blue || 0) & 255;
                    colors[i3] = lut[r8];
                    colors[i3 + 1] = lut[g8];
                    colors[i3 + 2] = lut[b8];
                }
            } else {
                for (let i = 0, i3 = 0; i < plyData.vertices.length; i++, i3 += 3) {
                    const v = plyData.vertices[i];
                    colors[i3] = ((v.red || 0) & 255) / 255;
                    colors[i3 + 1] = ((v.green || 0) & 255) / 255;
                    colors[i3 + 2] = ((v.blue || 0) & 255) / 255;
                }
            }
            const colorAttribute = new THREE.BufferAttribute(colors, 3);
            geometry.setAttribute('color', colorAttribute);
            colorAttribute.needsUpdate = true;
            
            // Invalidate old bounding box and force recomputation  
            geometry.boundingBox = null;
            geometry.boundingSphere = null;
            geometry.computeBoundingBox();
            geometry.computeBoundingSphere();
            
            // Dispose old material
            if (oldMaterial) {
                if (Array.isArray(oldMaterial)) {
                    oldMaterial.forEach(mat => mat.dispose());
                } else {
                    oldMaterial.dispose();
                }
            }

            // Update UI (preserve depth panel states)
            const openPanelStates = this.captureDepthPanelStates();
            this.updateFileStats();
            this.updateFileList();
            this.restoreDepthPanelStates(openPanelStates);
            this.showStatus(`Color image "${message.fileName}" applied successfully!`);

        } catch (error) {
            console.error('Error handling color image data:', error);
            this.showError(`Failed to apply color image: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    
    /**
     * Convert depth image to 3D point cloud
     * Based on the Python reference implementation
     */
    private depthToPointCloud(
        depthData: Float32Array,
        width: number,
        height: number,
        fx: number,
        fy: number,
        cx: number,
        cy: number,
        cameraModel: CameraModel,
        depthType: 'euclidean' | 'orthogonal' | 'disparity' | 'inverse_depth' = 'euclidean',
        baseline?: number,
        disparityOffset?: number
    ): DepthConversionResult {
        
        // Pre-allocate typed arrays for better performance
        const totalPixels = width * height;
        const tempPoints = new Float32Array(totalPixels * 3);  // Pre-allocate max size
        const tempColors = new Float32Array(totalPixels * 3);
        const tempPixelCoords = new Float32Array(totalPixels * 2);
        const tempLogDepths = new Float32Array(totalPixels);
        
        let pointIndex = 0; // Track actual points added
        
        // Track depth statistics for debugging disappearing point clouds
        let minDepth = Infinity;
        let maxDepth = -Infinity;
        let validPointCount = 0;
        let skippedPoints = 0;
        
        if (cameraModel === 'fisheye-equidistant') {
            // Fisheye (equidistant) projection model
            for (let i = 0; i < width; i++) {
                for (let j = 0; j < height; j++) {
                    const depthIndex = j * width + i; // Note: j*width + i for proper indexing
                    const depth = depthData[depthIndex];
                    
                    // Skip invalid depth values (NaN, 0, ±Infinity)
                    if (isNaN(depth) || !isFinite(depth) || depth <= 0) {
                        skippedPoints++;
                        continue;
                    }
                    
                    // Track depth statistics for fisheye
                    minDepth = Math.min(minDepth, depth);
                    maxDepth = Math.max(maxDepth, depth);
                    validPointCount++;
                    
                    // Compute offset from principal point
                    const u = i - cx;
                    const v = j - cy;
                    const r = Math.sqrt(u * u + v * v);
                    
                    const pointBase = pointIndex * 3;
                    const pixelBase = pointIndex * 2;
                    
                    if (r === 0) {
                        // Handle center point with coordinate conversion
                        tempPoints[pointBase] = 0;
                        tempPoints[pointBase + 1] = 0;
                        tempPoints[pointBase + 2] = -depth;  // Apply Z flip immediately
                    } else {
                        // Normalize offset
                        const u_norm = u / r;
                        const v_norm = v / r;
                        
                        // Compute angle for equidistant fisheye
                        const theta = r / fx;
                        
                        // Create 3D unit vector and scale by depth with coordinate conversion
                        tempPoints[pointBase] = u_norm * Math.sin(theta) * depth;
                        tempPoints[pointBase + 1] = -v_norm * Math.sin(theta) * depth;  // Apply Y flip immediately
                        tempPoints[pointBase + 2] = -Math.cos(theta) * depth;  // Apply Z flip immediately
                    }
                    
                    // Store original pixel coordinates (i,j) for this point
                    tempPixelCoords[pixelBase] = i;
                    tempPixelCoords[pixelBase + 1] = j;
                    
                    // Store log depth for color mapping
                    tempLogDepths[pointIndex] = Math.log(depth);
                    pointIndex++;
                }
            }
        } else {
            // Pinhole camera model
            for (let v = 0; v < height; v++) {
                for (let u = 0; u < width; u++) {
                    const depthIndex = v * width + u;
                    let depth = depthData[depthIndex];
                    
                    // Skip invalid depth values (NaN, 0, ±Infinity)
                    if (isNaN(depth) || !isFinite(depth) || depth <= 0) {
                        skippedPoints++;
                        continue;
                    }
                    
                    // Convert disparity to depth if needed
                    if (depthType === 'disparity') {
                        if (!baseline || baseline <= 0) {
                            console.warn('Baseline is required for disparity conversion, skipping point');
                            skippedPoints++;
                            continue;
                        }
                        
                        const originalDisparity = depth;
                        // Convert disparity to depth: Z = baseline * fx / (disparity + disparityOffset)
                        const dWithOffset = depth + (disparityOffset || 0);
                        depth = (baseline * fx) / dWithOffset;
                        
                        // Log conversion for debugging (only for first few pixels)
                        if (v === 0 && u < 5) {
                            console.log(`🔄 Disparity conversion: disparity=${originalDisparity} → depth=${depth} (baseline=${baseline}, fx=${fx})`);
                        }
                        
                        // Re-validate depth after conversion (disparity could be 0 → depth = Infinity)
                        if (isNaN(depth) || !isFinite(depth) || depth <= 0) {
                            skippedPoints++;
                            continue;
                        }
                    }
                    
                    // Track depth statistics
                    minDepth = Math.min(minDepth, depth);
                    maxDepth = Math.max(maxDepth, depth);
                    validPointCount++;
                    
                    // Compute normalized pixel coordinates
                    const X = (u - cx) / fx;
                    const Y = (v - cy) / fy;
                    const Z = 1.0;
                    
                    let dirX = X;
                    let dirY = Y;
                    let dirZ = Z;
                    
                    if (depthType === 'euclidean') {
                        // For euclidean depth, normalize the direction vector
                        const norm = Math.sqrt(X * X + Y * Y + Z * Z);
                        dirX = X / norm;
                        dirY = Y / norm;
                        dirZ = Z / norm;
                    }
                    // For orthogonal depth, use direction vector as-is (no normalization)
                    
                    const pointBase = pointIndex * 3;
                    const pixelBase = pointIndex * 2;
                    
                    // Store 3D point directly with coordinate conversion
                    tempPoints[pointBase] = dirX * depth;
                    tempPoints[pointBase + 1] = -dirY * depth;  // Apply Y flip immediately
                    tempPoints[pointBase + 2] = -dirZ * depth;  // Apply Z flip immediately
                    
                    // Store original pixel coordinates (u,v) for this point
                    tempPixelCoords[pixelBase] = u;
                    tempPixelCoords[pixelBase + 1] = v;
                    
                    // Store log depth for color mapping
                    tempLogDepths[pointIndex] = Math.log(depth);
                    pointIndex++;
                }
            }
        }
        
        // Compute log-normalized, gamma-corrected grayscale colors directly to typed array
        if (pointIndex > 0) {
            const logMin = Math.log(minDepth);
            const logMax = Math.log(maxDepth);
            const denom = logMax - logMin;
            const invDenom = denom > 0 ? 1 / denom : 0;
            const gamma = 2.2; // standard display gamma
            const minGray = 0.2; // lift darkest values to 0.2
            
            for (let i = 0; i < pointIndex; i++) {
                const colorBase = i * 3;
                const s = denom > 0 ? (tempLogDepths[i] - logMin) * invDenom : 1.0;
                const g = Math.pow(s, 1 / gamma);
                const mapped = minGray + (1 - minGray) * g;
                tempColors[colorBase] = mapped;
                tempColors[colorBase + 1] = mapped;
                tempColors[colorBase + 2] = mapped;
            }
        }

        console.log(`Generated ${pointIndex} points from ${width}x${height} depth image\n📊 Depth statistics: min=${minDepth.toFixed(3)}, max=${maxDepth.toFixed(3)}, valid=${validPointCount}, skipped=${skippedPoints}\n🎥 Camera range: near=${0.001}, far=${1000000}`);
        
        // Check for potential clipping issues
        if (minDepth < 0.001) {
            console.warn(`⚠️ Some points (${minDepth.toFixed(6)}) are closer than camera near plane (0.001) - may be clipped!`);
        }
        if (maxDepth > 100000) {
            console.warn(`⚠️ Some points (${maxDepth.toFixed(3)}) are farther than camera far plane (100000) - may be clipped!`);
        }
        
        // Coordinate conversion already applied during processing for better performance
        console.log('🔄 Coordinates already converted from OpenCV to OpenGL/Three.js convention (Y↑, Z←)');
        
        // Create properly sized arrays from the pre-allocated ones
        const actualVertices = tempPoints.slice(0, pointIndex * 3);
        const actualColors = tempColors.slice(0, pointIndex * 3);
        const actualPixelCoords = tempPixelCoords.slice(0, pointIndex * 2);
        
        return {
            vertices: actualVertices,
            colors: actualColors,
            pixelCoords: actualPixelCoords,
            pointCount: pointIndex
        };
    }

    /**
     * Convert Depth processing result to PLY vertex format
     */
    private convertDepthResultToVertices(result: DepthConversionResult): PlyVertex[] {
        const vertices: PlyVertex[] = [];
        
        for (let i = 0; i < result.pointCount; i++) {
            const i3 = i * 3;
            const vertex: PlyVertex = {
                x: result.vertices[i3],
                y: result.vertices[i3 + 1],
                z: result.vertices[i3 + 2]
            };
            
            if (result.colors) {
                vertex.red = Math.round(result.colors[i3] * 255);
                vertex.green = Math.round(result.colors[i3 + 1] * 255);
                vertex.blue = Math.round(result.colors[i3 + 2] * 255);
            }
            
            vertices.push(vertex);
        }
        
        return vertices;
    }

    private showStatus(message: string): void {
        const ts = new Date().toISOString();
        console.log(`[${ts}] ${message}`);
        
        // Clear any existing errors when showing a status update
        this.clearError();
        
        // You could also update UI here if needed
    }

    /**
     * Load and validate color image dimensions
     */
    private async loadAndValidateColorImage(file: File, depthDimensions?: { width: number; height: number }): Promise<ImageData | null> {
        return new Promise((resolve) => {
            if (!depthDimensions && !this.depthDimensions) {
                this.showColorMappingStatus('No depth image dimensions available for validation', 'error');
                resolve(null);
                return;
            }
            
            const dimensions = depthDimensions || this.depthDimensions!;

            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            img.onload = () => {
                // Validate dimensions
                if (img.width !== dimensions.width || img.height !== dimensions.height) {
                    this.showColorMappingStatus(
                        `Image dimensions (${img.width}×${img.height}) don't match depth image (${dimensions.width}×${dimensions.height})`,
                        'error'
                    );
                    resolve(null);
                    return;
                }

                // Extract image data
                canvas.width = img.width;
                canvas.height = img.height;
                ctx!.drawImage(img, 0, 0);
                const imageData = ctx!.getImageData(0, 0, img.width, img.height);
                
                resolve(imageData);
            };

            img.onerror = () => {
                this.showColorMappingStatus('Failed to load color image', 'error');
                resolve(null);
            };

            // Handle different file types
            console.log(`Loading color image: ${file.name}, type: ${file.type}, size: ${file.size} bytes`);
            
            if (file.name.toLowerCase().endsWith('.ppm')) {
                // Handle PPM files
                console.log('Loading as PPM file');
                this.loadPpmImage(file, dimensions, resolve);
            } else if (file.type.startsWith('image/') && !file.type.includes('tiff') && !file.type.includes('tif')) {
                // Regular image files (PNG, JPEG, etc.) - not TIF
                console.log('Loading as regular image file');
                img.src = URL.createObjectURL(file);
            } else {
                // Handle TIF files using GeoTIFF
                console.log('Loading as TIF file using GeoTIFF');
                const reader = new FileReader();
                reader.onload = async (e) => {
                    try {
                        const buffer = e.target!.result as ArrayBuffer;
                        const tiff = await GeoTIFF.fromArrayBuffer(buffer);
                        const image = await tiff.getImage();
                        const rasters = await image.readRasters();
                        
                        // Validate dimensions
                        const width = image.getWidth();
                        const height = image.getHeight();
                        
                        if (width !== dimensions.width || height !== dimensions.height) {
                            this.showColorMappingStatus(
                                `TIF dimensions (${width}×${height}) don't match depth image (${dimensions.width}×${dimensions.height})`,
                                'error'
                            );
                            resolve(null);
                            return;
                        }

                        // Convert TIF data to ImageData
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        canvas.width = width;
                        canvas.height = height;
                        
                        const imageData = ctx!.createImageData(width, height);
                        const data = imageData.data;
                        
                        if (rasters.length >= 3) {
                            // RGB TIF - handle different data types
                            const r = rasters[0];
                            const g = rasters[1];
                            const b = rasters[2];
                            
                            for (let i = 0; i < width * height; i++) {
                                // Normalize to 0-255 range regardless of input data type
                                data[i * 4] = Math.min(255, Math.max(0, Math.round(r[i])));
                                data[i * 4 + 1] = Math.min(255, Math.max(0, Math.round(g[i])));
                                data[i * 4 + 2] = Math.min(255, Math.max(0, Math.round(b[i])));
                                data[i * 4 + 3] = 255; // Alpha
                            }
                        } else {
                            // Grayscale TIF - handle different data types
                            const gray = rasters[0];
                            for (let i = 0; i < width * height; i++) {
                                const grayValue = Math.min(255, Math.max(0, Math.round(gray[i])));
                                data[i * 4] = grayValue;
                                data[i * 4 + 1] = grayValue;
                                data[i * 4 + 2] = grayValue;
                                data[i * 4 + 3] = 255; // Alpha
                            }
                        }
                        
                        resolve(imageData);
                        
                    } catch (error) {
                        console.error('Error processing TIF color image:', error);
                        this.showColorMappingStatus(`Failed to process TIF color image: ${error instanceof Error ? error.message : String(error)}`, 'error');
                        resolve(null);
                    }
                };
                reader.readAsArrayBuffer(file);
            }
        });
    }

    /**
     * Show color mapping status message
     */
    private showColorMappingStatus(message: string, type: 'success' | 'error' | 'warning'): void {
        const statusElement = document.getElementById('color-mapping-status');
        if (statusElement) {
            statusElement.textContent = message;
            statusElement.className = `status-text ${type}`;
            
            // Clear after 5 seconds
            setTimeout(() => {
                statusElement.textContent = '';
                statusElement.className = 'status-text';
            }, 5000);
        }
    }

    /**
     * Load PPM image file and convert to ImageData
     */
    private loadPpmImage(file: File, dimensions: { width: number; height: number }, resolve: (value: ImageData | null) => void): void {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target!.result as string;
                const imageData = this.parsePpmImage(text, dimensions);
                resolve(imageData);
            } catch (error) {
                console.error('Error parsing PPM file:', error);
                this.showColorMappingStatus('Failed to parse PPM file: ' + (error instanceof Error ? error.message : String(error)), 'error');
                resolve(null);
            }
        };
        
        reader.onerror = () => {
            this.showColorMappingStatus('Failed to read PPM file', 'error');
            resolve(null);
        };
        
        reader.readAsText(file);
    }

    /**
     * Parse PPM image format (P3 - ASCII RGB)
     */
    private parsePpmImage(text: string, expectedDimensions: { width: number; height: number }): ImageData {
        const lines = text.split('\n').map(line => line.trim()).filter(line => line && !line.startsWith('#'));
        
        if (lines.length < 4) {
            throw new Error('Invalid PPM format: insufficient data');
        }
        
        // Check magic number
        if (lines[0] !== 'P3') {
            throw new Error('Unsupported PPM format: only P3 (ASCII RGB) is supported');
        }
        
        // Parse dimensions
        const dimensions = lines[1].split(/\s+/).map(Number);
        if (dimensions.length !== 2) {
            throw new Error('Invalid PPM format: invalid dimensions line');
        }
        
        const [width, height] = dimensions;
        
        // Validate dimensions match depth image
        if (width !== expectedDimensions.width || height !== expectedDimensions.height) {
            throw new Error(`PPM dimensions (${width}×${height}) don't match depth image (${expectedDimensions.width}×${expectedDimensions.height})`);
        }
        
        // Parse max value
        const maxVal = parseInt(lines[2]);
        if (isNaN(maxVal) || maxVal <= 0) {
            throw new Error('Invalid PPM format: invalid maximum value');
        }
        
        // Parse RGB data
        const rgbValues = [];
        for (let i = 3; i < lines.length; i++) {
            const values = lines[i].split(/\s+/).map(Number);
            rgbValues.push(...values);
        }
        
        // Validate RGB data length
        const expectedPixels = width * height * 3;
        if (rgbValues.length !== expectedPixels) {
            throw new Error(`Invalid PPM format: expected ${expectedPixels} RGB values, got ${rgbValues.length}`);
        }
        
        // Create ImageData
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;
        const imageData = ctx.createImageData(width, height);
        
        // Convert PPM data to ImageData format
        for (let i = 0; i < rgbValues.length; i += 3) {
            const pixelIndex = (i / 3) * 4;
            const r = Math.round((rgbValues[i] / maxVal) * 255);
            const g = Math.round((rgbValues[i + 1] / maxVal) * 255);
            const b = Math.round((rgbValues[i + 2] / maxVal) * 255);
            
            imageData.data[pixelIndex] = r;
            imageData.data[pixelIndex + 1] = g;
            imageData.data[pixelIndex + 2] = b;
            imageData.data[pixelIndex + 3] = 255; // Alpha
        }
        
        console.log(`✅ Successfully parsed PPM image: ${width}×${height}, maxVal: ${maxVal}`);
        return imageData;
    }

    /**
     * Determine if a Depth image is a depth image suitable for point cloud conversion
     * Accepts both floating-point and integer formats (for disparity images)
     */
    private isDepthTifImage(samplesPerPixel: number, sampleFormat: number | null, bitsPerSample: number[]): boolean {
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
        
        console.log(`✅ TIF validated as depth/disparity image: samples=${samplesPerPixel}, format=${sampleFormat}, bits=${bitsPerSample?.[0]}`);
        return true;
    }

    private isDepthDerivedFile(data: PlyData): boolean {
        const comments = (data as any)?.comments;
        if (!Array.isArray(comments)) return false;
        return comments.some((comment: string) => 
            typeof comment === 'string' && 
            (comment.includes('Converted from TIF depth image') || 
             comment.includes('Converted from PFM depth image') ||
             comment.includes('Converted from PNG depth image') ||
             comment.includes('Converted from NPY depth image'))
        );
    }

    private isPngDerivedFile(data: PlyData): boolean {
        const comments = (data as any)?.comments;
        if (!Array.isArray(comments)) return false;
        return comments.some((comment: string) => 
            typeof comment === 'string' && comment.includes('Converted from PNG depth image')
        );
    }

    private getPngScaleFactor(data: PlyData): number {
        const comments = (data as any)?.comments;
        if (!Array.isArray(comments)) return 1000; // Default
        
        for (const comment of comments) {
            if (typeof comment === 'string' && comment.includes('scale=')) {
                const match = comment.match(/scale=(\d+(?:\.\d+)?)/);
                if (match) {
                    return parseFloat(match[1]);
                }
            }
        }
        return 1000; // Default to millimeters
    }

    private getDepthSetting(data: PlyData, setting: 'camera' | 'depth'): string {
        const comments = (data as any)?.comments;
        if (!Array.isArray(comments)) {
            if (setting === 'camera') return this.defaultDepthSettings.cameraModel;
            if (setting === 'depth') return this.defaultDepthSettings.depthType;
            return '';
        }
        for (const comment of comments) {
            if (setting === 'camera' && comment.startsWith('Camera: ')) {
                return comment.replace('Camera: ', '').toLowerCase();
            }
            if (setting === 'depth' && comment.startsWith('Depth: ')) {
                return comment.replace('Depth: ', '').toLowerCase();
            }
        }
        // Return default settings if no setting found in comments
        if (setting === 'camera') return this.defaultDepthSettings.cameraModel;
        if (setting === 'depth') return this.defaultDepthSettings.depthType;
        return '';
    }

    private getDepthFx(data: PlyData): number {
        const comments = (data as any)?.comments;
        if (!Array.isArray(comments)) return this.defaultDepthSettings.fx;
        for (const comment of comments) {
            if (comment.startsWith('fx: ')) {
                const match = comment.match(/(\d+(?:\.\d+)?)px/);
                return match ? parseFloat(match[1]) : this.defaultDepthSettings.fx;
            }
            // Legacy support for 'Focal length:' format
            if (comment.startsWith('Focal length: ')) {
                const match = comment.match(/(\d+(?:\.\d+)?)px/);
                return match ? parseFloat(match[1]) : this.defaultDepthSettings.fx;
            }
        }
        return this.defaultDepthSettings.fx;
    }

    private getDepthFy(data: PlyData): string {
        const comments = (data as any)?.comments;
        if (!Array.isArray(comments)) return this.defaultDepthSettings.fy?.toString() || '';
        for (const comment of comments) {
            if (comment.startsWith('fy: ')) {
                const match = comment.match(/(\d+(?:\.\d+)?)px/);
                return match ? match[1] : (this.defaultDepthSettings.fy?.toString() || '');
            }
        }
        return this.defaultDepthSettings.fy?.toString() || '';
    }

    private getDepthBaseline(data: PlyData): number {
        const comments = (data as any)?.comments;
        if (!Array.isArray(comments)) return this.defaultDepthSettings.baseline || 50;
        for (const comment of comments) {
            if (comment.startsWith('Baseline: ')) {
                const match = comment.match(/(\d+(?:\.\d+)?)mm/);
                return match ? parseFloat(match[1]) : this.defaultDepthSettings.baseline || 50;
            }
        }
        return this.defaultDepthSettings.baseline || 50; // Use default baseline
    }

    private getDepthCx(data: PlyData): string {
        // Auto-calculate cx as (width - 1) / 2
        const dimensions = (data as any)?.depthDimensions;
        if (dimensions && dimensions.width) {
            const cx = (dimensions.width - 1) / 2;
            console.log(`📐 Image dimensions: ${dimensions.width}×${dimensions.height}, computed cx = ${cx}`);
            return cx.toString();
        }
        // Return empty string when dimensions aren't available yet (will be auto-calculated)
        console.log('📐 Image dimensions not yet available, will auto-calculate cx');
        return ''; // Empty = will be auto-calculated once image is processed
    }

    private getDepthCy(data: PlyData): string {
        // Auto-calculate cy as (height - 1) / 2
        const dimensions = (data as any)?.depthDimensions;
        if (dimensions && dimensions.height) {
            const cy = (dimensions.height - 1) / 2;
            console.log(`📐 Image dimensions: ${dimensions.width}×${dimensions.height}, computed cy = ${cy}`);
            return cy.toString();
        }
        // Return empty string when dimensions aren't available yet (will be auto-calculated)
        console.log('📐 Image dimensions not yet available, will auto-calculate cy');
        return ''; // Empty = will be auto-calculated once image is processed
    }

    private getDepthConvention(data: PlyData): 'opengl' | 'opencv' {
        // Check if this file was processed with a specific convention
        const comments = (data as any)?.comments;
        if (Array.isArray(comments)) {
            for (const comment of comments) {
                if (comment.includes('Convention: ')) {
                    const convention = comment.replace('Convention: ', '').toLowerCase();
                    if (convention === 'opencv' || convention === 'opengl') {
                        return convention as 'opengl' | 'opencv';
                    }
                }
            }
        }
        // Use default convention from settings
        return this.defaultDepthSettings.convention || 'opengl';
    }

    private getStoredColorImageName(fileIndex: number): string | null {
        const depthData = this.fileDepthData.get(fileIndex);
        return depthData?.colorImageName || null;
    }

    private parseMatrixInput(input: string): number[] | null {
        try {
            // Remove brackets, commas, and other unwanted characters, keep numbers, spaces, dots, minus signs
            const cleaned = input.replace(/[\[\],]/g, ' ').replace(/\s+/g, ' ').trim();
            
            // Split by whitespace and parse numbers
            const values = cleaned.split(/\s+/).map(str => {
                const num = parseFloat(str);
                return isNaN(num) ? null : num;
            }).filter(val => val !== null) as number[];
            
            // Should have exactly 16 numbers
            if (values.length !== 16) {
                console.warn(`Matrix parsing: Expected 16 numbers, got ${values.length}`);
                return null;
            }
            
            console.log(`✅ Matrix parsed successfully: ${values.length} numbers`);
            return values;
            
        } catch (error) {
            console.error('Matrix parsing error:', error);
            return null;
        }
    }

    private async applyDepthSettings(fileIndex: number): Promise<void> {
        try {
            // Get the current values from the form using the helper method
            const newCameraParams = this.getDepthSettingsFromFileUI(fileIndex);
            
            // DEBUG: Log what we read from the form
            console.log(`🔍 APPLY SETTINGS DEBUG for file ${fileIndex}:\n  Form read values: ${JSON.stringify(newCameraParams, null, 2)}\n  depthType specifically: ${newCameraParams.depthType}\n  baseline specifically: ${newCameraParams.baseline}`);

            // Validate parameters
            if (!newCameraParams.fx || newCameraParams.fx <= 0) {
                throw new Error('fx (focal length x) must be a positive number');
            }
            if (newCameraParams.depthType === 'disparity' && (!newCameraParams.baseline || newCameraParams.baseline <= 0)) {
                throw new Error('Baseline must be a positive number for disparity mode');
            }
            if (newCameraParams.pngScaleFactor !== undefined && (!newCameraParams.pngScaleFactor || newCameraParams.pngScaleFactor <= 0)) {
                throw new Error('Scale factor must be a positive number for PNG files');
            }

            // Check if we have cached depth data for this file
            const depthData = this.fileDepthData.get(fileIndex);
            if (!depthData) {
                throw new Error('No cached depth data found for this file. Please reload the depth file.');
            }

            const isPfm = /\.pfm$/i.test(depthData.fileName);
            const isNpy = /\.(npy|npz)$/i.test(depthData.fileName);
            const isPng = /\.png$/i.test(depthData.fileName);
            const fileType = isPfm ? 'PFM' : isNpy ? 'NPY' : isPng ? 'PNG' : 'TIF';
            this.showStatus(`Reprocessing ${fileType} with new settings...`);

            // Process the depth data with new parameters using the new system
            const result = await this.processDepthToPointCloud(depthData.originalData, depthData.fileName, newCameraParams);
            
            // Update the stored camera parameters with the processed values (cx/cy might have been updated)
            depthData.cameraParams = newCameraParams;
            
            // If there's a stored color image, reapply it (works for all depth formats)
            if (depthData.colorImageData) {
                console.log(`🎨 Reapplying stored color image: ${depthData.colorImageName}\n🎯 Using updated camera params: cx=${newCameraParams.cx}, cy=${newCameraParams.cy}`);
                await this.applyColorToDepthResult(result, depthData.colorImageData, { cameraParams: newCameraParams });
            }
            
            // Update the PLY data
            const plyData = this.plyFiles[fileIndex];
            plyData.vertices = this.convertDepthResultToVertices(result);
            plyData.vertexCount = result.pointCount;
            plyData.hasColors = !!result.colors;
            plyData.comments = [
                `Converted from ${fileType} depth image: ${depthData.fileName}`,
                `Camera: ${newCameraParams.cameraModel}`,
                `Depth type: ${newCameraParams.depthType}`,
                `fx: ${newCameraParams.fx}px${newCameraParams.fy ? `, fy: ${newCameraParams.fy}px` : ''}`,
                ...(newCameraParams.baseline ? [`Baseline: ${newCameraParams.baseline}mm`] : [])
            ];

            // Update cached parameters
            depthData.cameraParams = newCameraParams;

            // Update the mesh with new data
            const oldMaterial = this.meshes[fileIndex].material;
            const newMaterial = this.createMaterialForFile(plyData, fileIndex);
            this.meshes[fileIndex].material = newMaterial;
            
            // Ensure point size is correctly applied to the new material
            if (this.meshes[fileIndex] instanceof THREE.Points && newMaterial instanceof THREE.PointsMaterial) {
                const currentPointSize = this.pointSizes[fileIndex] || 0.001;
                newMaterial.size = currentPointSize;
                console.log(`🔧 Applied point size ${currentPointSize} to updated ${fileType} material for file ${fileIndex}`);
            }
            
            // NUCLEAR OPTION: Completely recreate the mesh object to avoid any caching
            const oldMesh = this.meshes[fileIndex];
            
            // Remove old mesh from scene
            this.scene.remove(oldMesh);
            
            // Dispose old geometry and material completely
            if (oldMesh.geometry) {
                oldMesh.geometry.dispose();
            }
            
            // Create completely new geometry
            const geometry = new THREE.BufferGeometry();
            
            // Create completely new mesh with new geometry and material
            const newMesh = new THREE.Points(geometry, newMaterial);
            
            // Copy transformation from old mesh
            newMesh.matrix.copy(oldMesh.matrix);
            newMesh.matrixAutoUpdate = oldMesh.matrixAutoUpdate;
            
            // Replace the mesh in our array and scene
            this.meshes[fileIndex] = newMesh;
            this.scene.add(newMesh);
            
            // Create position array
            const positions = new Float32Array(plyData.vertices.length * 3);
            for (let i = 0, i3 = 0; i < plyData.vertices.length; i++, i3 += 3) {
                const vertex = plyData.vertices[i];
                positions[i3] = vertex.x;
                positions[i3 + 1] = vertex.y;
                positions[i3 + 2] = vertex.z;
            }
            const positionAttribute = new THREE.BufferAttribute(positions, 3);
            geometry.setAttribute('position', positionAttribute);
            // CRITICAL FIX: Mark position attribute as needing update
            positionAttribute.needsUpdate = true;
            
            if (plyData.hasColors) {
                // Create color array
                const colors = new Float32Array(plyData.vertices.length * 3);
            if (this.convertSrgbToLinear) {
                this.ensureSrgbLUT();
                const lut = this.srgbToLinearLUT!;
                for (let i = 0, i3 = 0; i < plyData.vertices.length; i++, i3 += 3) {
                    const v = plyData.vertices[i];
                    const r8 = (v.red || 0) & 255;
                    const g8 = (v.green || 0) & 255;
                    const b8 = (v.blue || 0) & 255;
                    colors[i3] = lut[r8];
                    colors[i3 + 1] = lut[g8];
                    colors[i3 + 2] = lut[b8];
                }
            } else {
                for (let i = 0, i3 = 0; i < plyData.vertices.length; i++, i3 += 3) {
                    const v = plyData.vertices[i];
                    colors[i3] = ((v.red || 0) & 255) / 255;
                    colors[i3 + 1] = ((v.green || 0) & 255) / 255;
                    colors[i3 + 2] = ((v.blue || 0) & 255) / 255;
                }
            }
                const colorAttribute = new THREE.BufferAttribute(colors, 3);
                geometry.setAttribute('color', colorAttribute);
                colorAttribute.needsUpdate = true;
            }
            
            // CRITICAL FIX: Invalidate old bounding box and force recomputation
            geometry.boundingBox = null;
            geometry.boundingSphere = null;
            geometry.computeBoundingBox();
            geometry.computeBoundingSphere();
            
            // CRITICAL FIX: Force complete geometry refresh
            geometry.attributes.position.needsUpdate = true;
            if (geometry.attributes.color) {
                geometry.attributes.color.needsUpdate = true;
            }
            
            // Force immediate render to show updated geometry
            this.renderer.render(this.scene, this.camera);
            
            // Dispose old material
            if (oldMaterial) {
                if (Array.isArray(oldMaterial)) {
                    oldMaterial.forEach(mat => mat.dispose());
                } else {
                    oldMaterial.dispose();
                }
            }

            // Update UI
            this.updateFileStats();
            this.showStatus(`${fileType} settings applied successfully!`);

        } catch (error) {
            console.error(`Error applying depth settings:`, error);
            this.showError(`Failed to apply depth settings: ${error instanceof Error ? error.message : String(error)}`);
        }
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
                depthBias: message.settings.depthBias !== undefined ? message.settings.depthBias : 0.0
            };
            console.log('✅ Loaded default depth settings from extension:', this.defaultDepthSettings);
            
            // Update any existing depth file forms to use new defaults
            this.refreshDepthFileFormsWithDefaults();
            this.updateDefaultButtonState();
        } else {
            console.log('⚠️ No settings in default depth settings message');
        }
    }

    private refreshDepthFileFormsWithDefaults(): void {
        // Update existing depth file forms to use the new default settings
        for (let i = 0; i < this.plyFiles.length; i++) {
            const data = this.plyFiles[i];
            if (this.isDepthDerivedFile(data)) {
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
            console.log(`📐 Preserving computed cx = ${computedCx} for file ${fileIndex} (not overriding with defaults)`);
        }
        
        if (cyInput && depthData?.depthDimensions) {
            // Keep the computed cy value based on actual image dimensions  
            const computedCy = (depthData.depthDimensions.height - 1) / 2;
            cyInput.value = computedCy.toString();
            console.log(`📐 Preserving computed cy = ${computedCy} for file ${fileIndex} (not overriding with defaults)`);
        }

        const cameraModelSelect = document.getElementById(`camera-model-${fileIndex}`) as HTMLSelectElement;
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

        const conventionSelect = document.getElementById(`convention-${fileIndex}`) as HTMLSelectElement;
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

    private updatePrinciplePointFields(fileIndex: number, dimensions: { width: number; height: number }): void {
        // Update cx and cy form fields with computed values based on actual image dimensions
        const cxInput = document.getElementById(`cx-${fileIndex}`) as HTMLInputElement;
        const cyInput = document.getElementById(`cy-${fileIndex}`) as HTMLInputElement;
        
        const computedCx = (dimensions.width - 1) / 2;
        const computedCy = (dimensions.height - 1) / 2;
        
        if (cxInput) {
            cxInput.value = computedCx.toString();
            console.log(`📐 Updated cx field for file ${fileIndex}: ${computedCx} (from ${dimensions.width}×${dimensions.height})`);
        }
        
        if (cyInput) {
            cyInput.value = computedCy.toString();
            console.log(`📐 Updated cy field for file ${fileIndex}: ${computedCy} (from ${dimensions.width}×${dimensions.height})`);
        }

        // Update image size display
        const imageSizeDiv = document.getElementById(`image-size-${fileIndex}`);
        if (imageSizeDiv) {
            imageSizeDiv.textContent = `Image Size: Width: ${dimensions.width}, Height: ${dimensions.height}`;
            console.log(`📐 Updated image size display for file ${fileIndex}: ${dimensions.width}×${dimensions.height}`);
        }
        
        // Update button state since form values changed
        this.updateSingleDefaultButtonState(fileIndex);
    }

    private updateDefaultButtonState(): void {
        // Update all "Use as Default" buttons to reflect current state
        const buttons = document.querySelectorAll('.use-as-default-settings');
        buttons.forEach((button, index) => {
            this.updateSingleDefaultButtonState(index);
        });
    }

    private updateSingleDefaultButtonState(fileIndex: number): void {
        const button = document.querySelector(`.use-as-default-settings[data-file-index="${fileIndex}"]`) as HTMLButtonElement;
        if (!button) return;

        try {
            // Get current form values
            const currentParams = this.getDepthSettingsFromFileUI(fileIndex);
            
            // Debug logging
            console.log(`🔍 Button state check for file ${fileIndex}:\n  Current params: ${JSON.stringify(currentParams, null, 2)}\n  Default settings: ${JSON.stringify(this.defaultDepthSettings, null, 2)}`);
            
            // Check if current settings match defaults
            const fxMatch = currentParams.fx === this.defaultDepthSettings.fx;
            const fyMatch = (currentParams.fy === undefined && this.defaultDepthSettings.fy === undefined) || currentParams.fy === this.defaultDepthSettings.fy;
            const cameraMatch = currentParams.cameraModel === this.defaultDepthSettings.cameraModel;
            const depthMatch = currentParams.depthType === this.defaultDepthSettings.depthType;
            const conventionMatch = currentParams.convention === this.defaultDepthSettings.convention;
            const baselineMatch = (currentParams.baseline || undefined) === (this.defaultDepthSettings.baseline || undefined);
            const depthScaleMatch = (currentParams.depthScale !== undefined ? currentParams.depthScale : 1.0) === (this.defaultDepthSettings.depthScale !== undefined ? this.defaultDepthSettings.depthScale : 1.0);
            const depthBiasMatch = (currentParams.depthBias !== undefined ? currentParams.depthBias : 0.0) === (this.defaultDepthSettings.depthBias !== undefined ? this.defaultDepthSettings.depthBias : 0.0);
            // Handle scale factor comparison more carefully (only for PNG files)
            const currentScale = currentParams.pngScaleFactor;
            const defaultScale = this.defaultDepthSettings.pngScaleFactor;
            const isPngFile = fileIndex < this.plyFiles.length && this.isPngDerivedFile(this.plyFiles[fileIndex]);
            const pngScaleFactorMatch = !isPngFile ? true : // For non-PNG files, scale factor is irrelevant
                                   currentScale === undefined && defaultScale === undefined ? true : 
                                   currentScale !== undefined && defaultScale !== undefined ? currentScale === defaultScale : false;
            
            console.log(`  fx match: ${fxMatch} (${currentParams.fx} === ${this.defaultDepthSettings.fx})\n  fy match: ${fyMatch} (${currentParams.fy} === ${this.defaultDepthSettings.fy})\n  Camera match: ${cameraMatch} (${currentParams.cameraModel} === ${this.defaultDepthSettings.cameraModel})\n  Depth match: ${depthMatch} (${currentParams.depthType} === ${this.defaultDepthSettings.depthType})\n  Convention match: ${conventionMatch} (${currentParams.convention} === ${this.defaultDepthSettings.convention})\n  Baseline match: ${baselineMatch} (${currentParams.baseline} === ${this.defaultDepthSettings.baseline})\n  Depth scale match: ${depthScaleMatch} (${currentParams.depthScale} === ${this.defaultDepthSettings.depthScale})\n  Depth bias match: ${depthBiasMatch} (${currentParams.depthBias} === ${this.defaultDepthSettings.depthBias})\n  Scale factor match: ${pngScaleFactorMatch} (current: ${currentScale}, default: ${defaultScale}, isPNG: ${isPngFile})`);
            
            const isDefault = fxMatch && fyMatch && cameraMatch && depthMatch && conventionMatch && baselineMatch && depthScaleMatch && depthBiasMatch && pngScaleFactorMatch;

            if (isDefault) {
                // Current settings are already default - make button blue
                button.style.background = 'var(--vscode-button-background)';
                button.style.color = 'var(--vscode-button-foreground)';
                button.innerHTML = '✓ Current Default';
            } else {
                // Current settings differ from default - normal secondary style
                button.style.background = 'var(--vscode-button-secondaryBackground)';
                button.style.color = 'var(--vscode-button-secondaryForeground)';
                button.innerHTML = '⭐ Use as Default';
            }
        } catch (error) {
            // If we can't get form values, just show normal state
            button.style.background = 'var(--vscode-button-secondaryBackground)';
            button.style.color = 'var(--vscode-button-secondaryForeground)';
            button.innerHTML = '⭐ Use as Default';
        }
    }

    private async useAsDefaultSettings(fileIndex: number): Promise<void> {
        try {
            // Get the current values from the form
            const currentParams = this.getDepthSettingsFromFileUI(fileIndex);
            
            // Store as default settings for future files (exclude cx and cy as they are auto-calculated per image)
            this.defaultDepthSettings = {
                fx: currentParams.fx,
                fy: currentParams.fy,
                cx: this.defaultDepthSettings.cx, // Keep existing cx, don't update from form
                cy: this.defaultDepthSettings.cy, // Keep existing cy, don't update from form
                cameraModel: currentParams.cameraModel,
                depthType: currentParams.depthType,
                baseline: currentParams.baseline,
                convention: currentParams.convention || 'opengl',
                pngScaleFactor: currentParams.pngScaleFactor,
                depthScale: currentParams.depthScale,
                depthBias: currentParams.depthBias
            };
            
            // Save to extension global state for persistence across webview instances
            this.vscode.postMessage({
                type: 'saveDefaultDepthSettings',
                settings: this.defaultDepthSettings
            });
            
            // Show confirmation message with more detail
            const fyInfo = currentParams.fy ? `, fy=${currentParams.fy}` : '';
            this.showStatus(`✅ Default settings saved: ${currentParams.cameraModel}, fx=${currentParams.fx}${fyInfo}px, ${currentParams.depthType}, ${currentParams.convention}`);
            
            // Update button state immediately
            this.updateDefaultButtonState();
            
            console.log('🎯 Default depth settings updated:', this.defaultDepthSettings);
            
        } catch (error) {
            console.error('Error saving default settings:', error);
            this.showError(`Failed to save default settings: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async resetToDefaultSettings(fileIndex: number): Promise<void> {
        try {
            // Get all the form elements
            const setValue = (elementId: string, value: any) => {
                const element = document.getElementById(elementId) as HTMLInputElement | HTMLSelectElement;
                if (element && value !== undefined && value !== null) {
                    element.value = value.toString();
                }
            };

            // Only reset fields that have stars (default values)
            setValue(`camera-model-${fileIndex}`, this.defaultDepthSettings.cameraModel);
            setValue(`fx-${fileIndex}`, this.defaultDepthSettings.fx);
            
            // Handle fy field - clear it if default is same as fx, otherwise set the value
            const fyElement = document.getElementById(`fy-${fileIndex}`) as HTMLInputElement;
            if (fyElement) {
                if (this.defaultDepthSettings.fy && this.defaultDepthSettings.fy !== this.defaultDepthSettings.fx) {
                    fyElement.value = this.defaultDepthSettings.fy.toString();
                } else {
                    fyElement.value = ''; // Clear to use "Same as fx"
                }
            }
            
            setValue(`depth-type-${fileIndex}`, this.defaultDepthSettings.depthType);
            setValue(`baseline-${fileIndex}`, this.defaultDepthSettings.baseline);
            setValue(`depth-scale-${fileIndex}`, this.defaultDepthSettings.depthScale);
            setValue(`depth-bias-${fileIndex}`, this.defaultDepthSettings.depthBias);
            setValue(`convention-${fileIndex}`, this.defaultDepthSettings.convention);
            
            // Handle PNG scale factor only if it exists
            const pngScaleElement = document.getElementById(`png-scale-factor-${fileIndex}`) as HTMLInputElement;
            if (pngScaleElement && this.defaultDepthSettings.pngScaleFactor) {
                pngScaleElement.value = this.defaultDepthSettings.pngScaleFactor.toString();
            }

            // Update button states
            this.updateSingleDefaultButtonState(fileIndex);
            
            this.showStatus('Reset starred fields to default values');
        } catch (error) {
            console.error('Error resetting to default settings:', error);
            this.showError(`Failed to reset to default settings: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private resetMonoParameters(fileIndex: number): void {
        try {
            // Reset scale to 1.0 and bias to 0.0
            const scaleElement = document.getElementById(`depth-scale-${fileIndex}`) as HTMLInputElement;
            const biasElement = document.getElementById(`depth-bias-${fileIndex}`) as HTMLInputElement;
            
            if (scaleElement) {
                scaleElement.value = '1.0';
            }
            if (biasElement) {
                biasElement.value = '0.0';
            }
            
            // Update button state since values changed
            this.updateSingleDefaultButtonState(fileIndex);
            
            this.showStatus('Reset mono parameters to Scale=1.0, Bias=0.0');
        } catch (error) {
            console.error('Error resetting mono parameters:', error);
            this.showError(`Failed to reset mono parameters: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private resetDisparityOffset(fileIndex: number): void {
        try {
            // Reset disparity offset to 0
            const offsetElement = document.getElementById(`disparity-offset-${fileIndex}`) as HTMLInputElement;
            
            if (offsetElement) {
                offsetElement.value = '0';
            }
            
            this.showStatus('Reset disparity offset to 0');
        } catch (error) {
            console.error('Error resetting disparity offset:', error);
            this.showError(`Failed to reset disparity offset: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private resetPrinciplePoint(fileIndex: number): void {
        try {
            // Reset cx and cy to auto-calculated center values based on image dimensions
            const cxElement = document.getElementById(`cx-${fileIndex}`) as HTMLInputElement;
            const cyElement = document.getElementById(`cy-${fileIndex}`) as HTMLInputElement;
            
            // Get image dimensions from stored depth data
            const depthData = this.fileDepthData.get(fileIndex);
            if (depthData?.depthDimensions) {
                const computedCx = (depthData.depthDimensions.width - 1) / 2;
                const computedCy = (depthData.depthDimensions.height - 1) / 2;
                
                if (cxElement) {
                    cxElement.value = computedCx.toString();
                }
                if (cyElement) {
                    cyElement.value = computedCy.toString();
                }
                
                this.showStatus(`Reset principle point to center: cx=${computedCx}, cy=${computedCy}`);
            } else {
                // This should not happen for depth-derived files, but handle gracefully
                console.error(`No depth dimensions found for file ${fileIndex}`);
                this.showError('Cannot reset principle point: image dimensions not available');
            }
        } catch (error) {
            console.error('Error resetting principle point:', error);
            this.showError(`Failed to reset principle point: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async applyColorToDepthResult(result: DepthConversionResult, imageData: ImageData, depthData: any): Promise<void> {
        const colorData = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        // Create color array for vertices
        const colors = new Float32Array(result.pointCount * 3);
        let colorIndex = 0;

        // Use stored pixel coordinates instead of reprojecting 3D points
        if (result.pixelCoords && result.pixelCoords.length === result.pointCount * 2) {
            console.log('🎨 Using stored pixel coordinates for color mapping');
            
            for (let i = 0; i < result.pointCount; i++) {
                const pixelIndex = i * 2;
                const u = Math.round(result.pixelCoords[pixelIndex]);
                const v = Math.round(result.pixelCoords[pixelIndex + 1]);

                // Check bounds and get color from original 2D pixel position
                if (u >= 0 && u < width && v >= 0 && v < height) {
                    const colorPixelIndex = (v * width + u) * 4;
                    colors[colorIndex++] = colorData[colorPixelIndex] / 255.0;     // R
                    colors[colorIndex++] = colorData[colorPixelIndex + 1] / 255.0; // G
                    colors[colorIndex++] = colorData[colorPixelIndex + 2] / 255.0; // B
                } else {
                    // Default gray for out-of-bounds (shouldn't happen with stored coords)
                    colors[colorIndex++] = 0.5;
                    colors[colorIndex++] = 0.5;
                    colors[colorIndex++] = 0.5;
                }
            }
        } else {
            // Fallback: use the old 3D-to-2D reprojection method (for backwards compatibility)
            console.log('⚠️ Falling back to 3D-to-2D reprojection for color mapping');
            
            for (let i = 0; i < result.pointCount; i++) {
                const vertexIndex = i * 3;
                let x = result.vertices[vertexIndex];
                let y = result.vertices[vertexIndex + 1];
                let z = result.vertices[vertexIndex + 2];

                // Skip invalid points (NaN, 0, ±Infinity)
                // In OpenGL convention, negative Z values are valid (pointing backward into scene)
                if (z >= 0 || isNaN(x) || isNaN(y) || isNaN(z) || !isFinite(x) || !isFinite(y) || !isFinite(z)) {
                    colors[colorIndex++] = 0.5;
                    colors[colorIndex++] = 0.5; 
                    colors[colorIndex++] = 0.5;
                    continue;
                }

                // Convert back from OpenGL convention to OpenCV convention for color lookup
                // (Undo the Y and Z flip that was applied in depthToPointCloud)
                y = -y; // Flip Y back: Y-up → Y-down
                z = -z; // Flip Z back: Z-backward → Z-forward (now positive, valid in OpenCV)

                // Project 3D point to image coordinates (using original OpenCV coordinates)
                let u, v;
                if (depthData.cameraParams.cameraModel === 'fisheye-equidistant') {
                    // Fisheye projection - use the actual camera parameters that were used for depth processing
                    const fx = depthData.cameraParams.fx;
                    const fy = depthData.cameraParams.fy || depthData.cameraParams.fx;
                    const cx = depthData.cameraParams.cx;
                    const cy = depthData.cameraParams.cy;
                    
                    const r = Math.sqrt(x * x + y * y);
                    const theta = Math.atan2(r, z);
                    const phi = Math.atan2(y, x);
                    
                    const rFish = fx * theta;
                    u = Math.round(cx + rFish * Math.cos(phi));
                    v = Math.round(cy + rFish * Math.sin(phi));
                } else {
                    // Pinhole projection - use the actual camera parameters that were used for depth processing
                    const fx = depthData.cameraParams.fx;
                    const fy = depthData.cameraParams.fy || depthData.cameraParams.fx;
                    const cx = depthData.cameraParams.cx;
                    const cy = depthData.cameraParams.cy;
                    
                    u = Math.round(fx * (x / z) + cx);
                    v = Math.round(fy * (y / z) + cy);
                }

                // Check bounds and get color
                if (u >= 0 && u < width && v >= 0 && v < height) {
                    const pixelIndex = (v * width + u) * 4;
                    colors[colorIndex++] = colorData[pixelIndex] / 255.0;     // R
                    colors[colorIndex++] = colorData[pixelIndex + 1] / 255.0; // G
                    colors[colorIndex++] = colorData[pixelIndex + 2] / 255.0; // B
                } else {
                    // Default gray for out-of-bounds
                    colors[colorIndex++] = 0.5;
                    colors[colorIndex++] = 0.5;
                    colors[colorIndex++] = 0.5;
                }
            }
        }

        result.colors = colors;
    }

    private async removeColorImageFromDepth(fileIndex: number): Promise<void> {
        try {
            const depthData = this.fileDepthData.get(fileIndex);
            if (!depthData) {
                throw new Error('No cached Depth data found for this file');
            }

            this.showStatus('Removing color image and reverting to default colors...');

            // Remove stored color image data
            delete depthData.colorImageData;
            delete depthData.colorImageName;

            // Reprocess depth image without color data (will use default grayscale colors)
            const result = await this.processDepthToPointCloud(depthData.originalData, depthData.fileName, depthData.cameraParams);

            // Update the PLY data
            const plyData = this.plyFiles[fileIndex];
            plyData.vertices = this.convertDepthResultToVertices(result);
            plyData.hasColors = !!result.colors;

            // Update the mesh with default colors
            const oldMaterial = this.meshes[fileIndex].material;
            const newMaterial = this.createMaterialForFile(plyData, fileIndex);
            this.meshes[fileIndex].material = newMaterial;
            
            // Ensure point size is correctly applied to the new material
            if (this.meshes[fileIndex] instanceof THREE.Points && newMaterial instanceof THREE.PointsMaterial) {
                const currentPointSize = this.pointSizes[fileIndex] || 0.001;
                newMaterial.size = currentPointSize;
                console.log(`🔧 Applied point size ${currentPointSize} to default-color Depth material for file ${fileIndex}`);
            }
            
            // Update geometry
            const geometry = this.meshes[fileIndex].geometry as THREE.BufferGeometry;
            
            // Create position array
            const positions = new Float32Array(plyData.vertices.length * 3);
            for (let i = 0, i3 = 0; i < plyData.vertices.length; i++, i3 += 3) {
                const vertex = plyData.vertices[i];
                positions[i3] = vertex.x;
                positions[i3 + 1] = vertex.y;
                positions[i3 + 2] = vertex.z;
            }
            const positionAttribute = new THREE.BufferAttribute(positions, 3);
            geometry.setAttribute('position', positionAttribute);
            positionAttribute.needsUpdate = true;
            
            if (plyData.hasColors) {
                // Create color array with default grayscale colors
                const colors = new Float32Array(plyData.vertices.length * 3);
                for (let i = 0, i3 = 0; i < plyData.vertices.length; i++, i3 += 3) {
                    const vertex = plyData.vertices[i];
                    colors[i3] = (vertex.red || 0) / 255;
                    colors[i3 + 1] = (vertex.green || 0) / 255;
                    colors[i3 + 2] = (vertex.blue || 0) / 255;
                }
                const colorAttribute = new THREE.BufferAttribute(colors, 3);
                geometry.setAttribute('color', colorAttribute);
                colorAttribute.needsUpdate = true;
            }
            
            // Invalidate old bounding box and force recomputation  
            geometry.boundingBox = null;
            geometry.boundingSphere = null;
            geometry.computeBoundingBox();
            geometry.computeBoundingSphere();
            
            // Dispose old material
            if (oldMaterial) {
                if (Array.isArray(oldMaterial)) {
                    oldMaterial.forEach(mat => mat.dispose());
                } else {
                    oldMaterial.dispose();
                }
            }

            // Update UI (preserve depth panel states)
            const openPanelStates = this.captureDepthPanelStates();
            this.updateFileStats();
            this.updateFileList();
            this.restoreDepthPanelStates(openPanelStates);
            this.showStatus('Color image removed - reverted to default depth-based colors');

        } catch (error) {
            console.error('Error removing color image:', error);
            this.showError(`Failed to remove color image: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private savePlyFile(fileIndex: number): void {
        try {
            if (fileIndex < 0 || fileIndex >= this.plyFiles.length) {
                throw new Error('Invalid file index');
            }

            const plyData = this.plyFiles[fileIndex];
            this.showStatus(`Generating PLY file for ${plyData.fileName}...`);

            // Generate PLY file content with current state (including transformations and colors)
            const plyContent = this.generatePlyFileContent(plyData, fileIndex);
            
            // Use VS Code save dialog instead of automatic download
            const defaultFileName = plyData.fileName || `pointcloud_${fileIndex + 1}.ply`;
            
            this.vscode.postMessage({
                type: 'savePlyFile',
                content: plyContent,
                defaultFileName: defaultFileName,
                fileIndex: fileIndex
            });
            
            this.showStatus(`Opening save dialog for ${defaultFileName}...`);
            
        } catch (error) {
            console.error('Error preparing PLY file:', error);
            this.showError(`Failed to prepare PLY file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private generatePlyFileContent(plyData: PlyData, fileIndex: number): string {
        // Get current transformed vertices from the actual geometry
        const mesh = this.meshes[fileIndex];
        const geometry = mesh.geometry as THREE.BufferGeometry;
        const positionAttribute = geometry.getAttribute('position') as THREE.BufferAttribute;
        const colorAttribute = geometry.getAttribute('color') as THREE.BufferAttribute;
        
        const vertexCount = positionAttribute.count;
        
        // PLY header
        let content = 'ply\n';
        content += `format ascii 1.0\n`;
        
        // Add comments including transformation info
        content += `comment Generated from ${plyData.fileName || 'point cloud'}\n`;
        content += `comment Coordinate system: OpenGL (Y-up, Z-backward)\n`;
        if (plyData.comments.length > 0) {
            plyData.comments.forEach(comment => {
                content += `comment ${comment}\n`;
            });
        }
        
        // Vertex element definition
        content += `element vertex ${vertexCount}\n`;
        content += 'property float x\n';
        content += 'property float y\n';
        content += 'property float z\n';
        
        const hasColors = !!colorAttribute;
        if (hasColors) {
            content += 'property uchar red\n';
            content += 'property uchar green\n';
            content += 'property uchar blue\n';
        }
        
        if (plyData.hasNormals) {
            content += 'property float nx\n';
            content += 'property float ny\n';
            content += 'property float nz\n';
        }
        
        // Face element definition (if any)
        if (plyData.faceCount > 0) {
            content += `element face ${plyData.faceCount}\n`;
            content += 'property list uchar int vertex_indices\n';
        }
        
        content += 'end_header\n';
        
        // Vertex data from current geometry (includes transformations)
        for (let i = 0; i < vertexCount; i++) {
            const i3 = i * 3;
            const x = positionAttribute.array[i3];
            const y = positionAttribute.array[i3 + 1];
            const z = positionAttribute.array[i3 + 2];
            
            content += `${x} ${y} ${z}`;
            
            if (hasColors) {
                const r = Math.round(colorAttribute.array[i3] * 255);
                const g = Math.round(colorAttribute.array[i3 + 1] * 255);
                const b = Math.round(colorAttribute.array[i3 + 2] * 255);
                content += ` ${r} ${g} ${b}`;
            }
            
            if (plyData.hasNormals && plyData.vertices[i]) {
                const vertex = plyData.vertices[i];
                content += ` ${vertex.nx || 0} ${vertex.ny || 0} ${vertex.nz || 0}`;
            }
            
            content += '\n';
        }
        
        // Face data (if any) - these don't change with transformations
        plyData.faces.forEach(face => {
            content += `${face.indices.length}`;
            face.indices.forEach(index => {
                content += ` ${index}`;
            });
            content += '\n';
        });
        
        return content;
    }

    // ========== Pose loading ==========
    private async handlePoseData(message: any): Promise<void> {
        const fileName: string = message.fileName || 'pose.json';
        const data = message.data;
        try {
            // Check if this is a camera profile JSON
            if (data && data.cameras && typeof data.cameras === 'object') {
                this.handleCameraProfile(data, fileName);
                return;
            }
            
            // If Halpe meta with multiple instances, add each instance as a separate pose
            if (data && data.meta_info && Array.isArray(data.instance_info) && data.instance_info.length > 1) {
                for (let i = 0; i < data.instance_info.length; i++) {
                    const single = { ...data, instance_info: [data.instance_info[i]] };
                    const pose = this.normalizePose(single);
                    const group = this.buildPoseGroup(pose);
                    this.scene.add(group);
                    this.poseGroups.push(group);
                    this.poseJoints.push(pose.joints as any);
                    this.poseEdges.push(pose.edges);
                    const invalidJoints = pose.joints.filter((j: any) => j.valid !== true).length;
                    const extras = (data as any).__poseExtras || {};
                    // Extract scores/uncertainties when available
                    let jointScores: number[] | undefined;
                    let jointUnc: Array<[number, number, number]> | undefined;
                    try {
                        const instInfo = data.instance_info[i];
                        if (instInfo?.keypoint_scores && Array.isArray(instInfo.keypoint_scores)) {
                            jointScores = instInfo.keypoint_scores.slice();
                        }
                        if (instInfo?.keypoint_uncertainties && Array.isArray(instInfo.keypoint_uncertainties)) {
                            jointUnc = instInfo.keypoint_uncertainties.slice();
                        }
                    } catch {}
                    this.poseMeta.push({ 
                        jointCount: pose.joints.length, 
                        edgeCount: pose.edges.length, 
                        fileName: `${fileName} [${i+1}/${data.instance_info.length}]`,
                        invalidJoints,
                        jointColors: extras.jointColors || [],
                        linkColors: extras.linkColors || [],
                        keypointNames: extras.keypointNames ? Object.values(extras.keypointNames) : undefined,
                        skeletonLinks: extras.skeletonLinks || [],
                        jointScores,
                        jointUncertainties: jointUnc
                    });
                    const unifiedIndex = this.plyFiles.length + (this.poseGroups.length - 1);
                    this.fileVisibility[unifiedIndex] = true;
                    this.pointSizes[unifiedIndex] = 0.02; // 20x larger for 2cm joint radius
                    this.individualColorModes[unifiedIndex] = 'assigned';
                    // Per-pose defaults
                    this.poseUseDatasetColors[unifiedIndex] = false;
                    this.poseShowLabels[unifiedIndex] = false;
                    this.poseScaleByScore[unifiedIndex] = false;
                    this.poseScaleByUncertainty[unifiedIndex] = false;
                    this.poseConvention[unifiedIndex] = 'opengl';
                    this.transformationMatrices.push(new THREE.Matrix4());
                    this.applyTransformationMatrix(unifiedIndex);
                }
                this.updateFileList();
                this.updateFileStats();
                this.fitCameraToAllObjects();
                // Hide loading overlay for pose JSONs
                document.getElementById('loading')?.classList.add('hidden');
            } else {
            const pose = this.normalizePose(data);
            const group = this.buildPoseGroup(pose);
            this.scene.add(group);
            // Track pose group and meta
            this.poseGroups.push(group);
                this.poseJoints.push(pose.joints as any);
                this.poseEdges.push(pose.edges);
                const invalidJoints = pose.joints.filter((j: any) => j.valid !== true).length;
                const extras = (data as any).__poseExtras || {};
                // Extract scores/uncertainties for non-Halpe formats
                let jointScores: number[] | undefined;
                let jointUnc: Array<[number, number, number]> | undefined;
                try {
                    // Human3.6M-style confidence
                    if (Array.isArray((data as any).confidence)) {
                        jointScores = (data as any).confidence.slice();
                    }
                    // OpenPose-like: people[].pose_keypoints_3d/_2d
                    if (Array.isArray((data as any).people) && (data as any).people.length > 0) {
                        const p = (data as any).people[0];
                        const arr = p.pose_keypoints_3d || p.pose_keypoints_2d;
                        if (Array.isArray(arr)) {
                            const step = p.pose_keypoints_3d ? 4 : 3; // x,y,z,(c) or x,y,(c)
                            const scores: number[] = [];
                            for (let idx = 0; idx + (step - 1) < arr.length; idx += step) {
                                const cRaw = step === 4 ? arr[idx + 3] : arr[idx + 2];
                                const c = Number(cRaw);
                                scores.push(isFinite(c) ? c : 0);
                            }
                            jointScores = scores;
                        }
                    }
                } catch {}
                this.poseMeta.push({ 
                    jointCount: pose.joints.length, 
                    edgeCount: pose.edges.length, 
                    fileName,
                    invalidJoints,
                    jointColors: extras.jointColors || [],
                    linkColors: extras.linkColors || [],
                    keypointNames: extras.keypointNames ? Object.values(extras.keypointNames) : undefined,
                    skeletonLinks: extras.skeletonLinks || [],
                    jointScores,
                    jointUncertainties: jointUnc
                });
            // Initialize UI state slots aligned after plyFiles
            const unifiedIndex = this.plyFiles.length + (this.poseGroups.length - 1);
            this.fileVisibility[unifiedIndex] = true;
                this.pointSizes[unifiedIndex] = 0.02; // 20x larger for 2cm joint radius
            this.individualColorModes[unifiedIndex] = 'assigned';
                // Per-pose defaults
                this.poseUseDatasetColors[unifiedIndex] = false;
                this.poseShowLabels[unifiedIndex] = false;
                this.poseScaleByScore[unifiedIndex] = false;
                this.poseScaleByUncertainty[unifiedIndex] = false;
                this.poseConvention[unifiedIndex] = 'opengl';
            // Initialize transformation matrix for this pose
            this.transformationMatrices.push(new THREE.Matrix4());
            this.applyTransformationMatrix(unifiedIndex);
            // Update UI
            this.updateFileList();
            this.updateFileStats();
            this.fitCameraToAllObjects();
                // Hide loading overlay for pose JSONs
                document.getElementById('loading')?.classList.add('hidden');
            }
        } catch (err) {
            this.showError('Pose parse error: ' + (err instanceof Error ? err.message : String(err)));
        }
    }

    // ========== Camera Profile handling ==========
    private handleCameraProfile(data: any, fileName: string): void {
        try {
            const cameras = data.cameras;
            const cameraNames = Object.keys(cameras);
            
            console.log(`Loading camera profile with ${cameraNames.length} cameras:`, cameraNames);
            
            // Create a single group to contain all cameras
            const cameraProfileGroup = new THREE.Group();
            cameraProfileGroup.name = `camera_profile_${fileName}`;
            
            let cameraCount = 0;
            for (const cameraName of cameraNames) {
                const camera = cameras[cameraName];
                if (camera.local_extrinsics && camera.local_extrinsics.params) {
                    const params = camera.local_extrinsics.params;
                    if (params.location && params.rotation_quaternion) {
                        const cameraViz = this.createCameraVisualization(
                            cameraName,
                            params.location,
                            params.rotation_quaternion,
                            camera.local_extrinsics.type
                        );
                        cameraProfileGroup.add(cameraViz);
                        cameraCount++;
                    }
                }
            }
            
            if (cameraCount > 0) {
                this.scene.add(cameraProfileGroup);
                this.cameraGroups.push(cameraProfileGroup);
                this.cameraNames.push(fileName); // Store filename instead of individual camera names
                
                // Initialize as single file entry (like poses)
                const unifiedIndex = this.plyFiles.length + this.poseGroups.length + this.cameraGroups.length - 1;
                this.fileVisibility[unifiedIndex] = true;
                this.pointSizes[unifiedIndex] = 1.0; // Default camera scale (different from point size)
                this.individualColorModes[unifiedIndex] = 'assigned';
                
                // Initialize transformation matrix for camera profile
                this.transformationMatrices.push(new THREE.Matrix4());
                this.applyTransformationMatrix(unifiedIndex);
            }
            
            // Update UI
            this.updateFileList();
            this.updateFileStats();
            this.fitCameraToAllObjects();
            
            // Hide loading overlay
            document.getElementById('loading')?.classList.add('hidden');
            
            console.log(`Successfully loaded camera profile with ${cameraCount} cameras from ${fileName}`);
        } catch (err) {
            this.showError('Camera profile parse error: ' + (err instanceof Error ? err.message : String(err)));
        }
    }

    private createCameraVisualization(cameraName: string, location: number[], rotationQuaternion: number[], rotationType?: string): THREE.Group {
        const group = new THREE.Group();
        group.name = `camera_${cameraName}`;
        
        // Set camera position
        const position = new THREE.Vector3(location[0], location[1], location[2]);
        group.position.copy(position);
        
        // Set camera rotation from quaternion. Respect type if provided.
        // blender_quaternion is typically [w, x, y, z]
        let qx = rotationQuaternion[0];
        let qy = rotationQuaternion[1];
        let qz = rotationQuaternion[2];
        let qw = rotationQuaternion[3];
        if (rotationType && rotationType.toLowerCase().includes('blender')) {
            qw = rotationQuaternion[0];
            qx = rotationQuaternion[1];
            qy = rotationQuaternion[2];
            qz = rotationQuaternion[3];
        }
        const quaternion = new THREE.Quaternion(qx, qy, qz, qw).normalize();
        group.setRotationFromQuaternion(quaternion);
        
        // Create camera body (triangle shape)
        const cameraBody = this.createCameraBodyGeometry();
        group.add(cameraBody);
        
        // Create direction line
        const directionLine = this.createDirectionArrow();
        group.add(directionLine);
        
        // Create text label
        const textLabel = this.createCameraLabel(cameraName);
        textLabel.name = 'cameraLabel';
        textLabel.visible = false; // Hide labels by default
        group.add(textLabel);
        
        // Store original position for coordinate label
        (group as any).originalPosition = { x: location[0], y: location[1], z: location[2] };
        
        return group;
    }

    private createCameraBodyGeometry(): THREE.Mesh {
        // Create a 4-sided pyramid shape 
        const size = 0.02; // 2cm base size
        const height = size * 1.5;
        
        const geometry = new THREE.ConeGeometry(size, height, 4); // 4 sides for square pyramid
        // Align one face flat to the axes (avoid 45° appearance) by rotating the base square
        geometry.rotateY(Math.PI / 4);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0x4CAF50, // Green color for cameras
            transparent: true,
            opacity: 0.9
        });
        
        // Translate geometry so the tip (originally at +Y * height/2) sits at the local origin.
        // This ensures scaling does not move the tip from the origin.
        geometry.translate(0, -height / 2, 0);
        
        const mesh = new THREE.Mesh(geometry, material);
        // Orient pyramid to extend forward along +Z with tip anchored at origin
        mesh.rotation.x = -Math.PI / 2;
        
        return mesh;
    }

    private createDirectionArrow(): THREE.Line {
        // Simple line showing camera direction
        const lineLength = 0.05; // 5cm direction line
        
        const geometry = new THREE.BufferGeometry();
        // Start at camera origin (tip) and extend forward
        const positions = new Float32Array([
            0, 0, 0,
            0, 0, lineLength
        ]);
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const material = new THREE.LineBasicMaterial({ 
            color: 0x4CAF50, // Same green as triangle
            linewidth: 2
        });
        
        const line = new THREE.Line(geometry, material);
        line.name = 'directionLine'; // Add name for identification
        return line;
    }

    private createCameraLabel(cameraName: string): THREE.Sprite {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        
        // Use higher resolution for crisp text
        const pixelRatio = 3; // 3x resolution for sharp text
        const baseFontSize = 28;
        const fontSize = baseFontSize * pixelRatio;
        
        // Set font first to measure text accurately
        context.font = `Bold ${fontSize}px Arial`;
        const textMetrics = context.measureText(cameraName);
        
        // Make canvas size fit the text with padding (high resolution)
        const padding = 20 * pixelRatio;
        canvas.width = Math.max(textMetrics.width + padding * 2, 200 * pixelRatio);
        canvas.height = 48 * pixelRatio;
        
        // Set font again after canvas resize and configure for high quality
        context.font = `Bold ${fontSize}px Arial`;
        context.fillStyle = 'white';
        context.strokeStyle = 'black';
        context.lineWidth = 3 * pixelRatio;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Enable anti-aliasing for smooth text
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        
        // Clear background
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw text with outline (centered)
        const x = canvas.width / 2;
        const y = canvas.height / 2;
        
        context.strokeText(cameraName, x, y);
        context.fillText(cameraName, x, y);
        
        // Create sprite from high-resolution canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        
        // Position label above camera (closer)
        sprite.position.set(0, 0.04, 0);
        
        // Scale proportionally to canvas aspect ratio, accounting for pixel ratio
        const aspectRatio = canvas.width / canvas.height;
        // Match label height roughly to the pyramid height at base scale
        const pyramidHeight = 0.03; // must stay in sync with createCameraBodyGeometry
        const baseScaleY = pyramidHeight; // label height ~= pyramid height
        const baseScaleX = baseScaleY * aspectRatio;
        sprite.scale.set(baseScaleX, baseScaleY, 1);
        // Preserve original scale for proper proportional scaling later
        (sprite as any).userData = (sprite as any).userData || {};
        (sprite as any).userData.baseScale = { x: baseScaleX, y: baseScaleY };
        
        return sprite;
    }

    private toggleCameraVisibility(): void {
        this.cameraVisibility = !this.cameraVisibility;
        this.cameraGroups.forEach(group => {
            group.visible = this.cameraVisibility;
        });
    }

    private updateCameraButtonState(): void {
        const toggleBtn = document.getElementById('toggle-cameras');
        if (!toggleBtn) return;
        
        if (this.cameraVisibility) {
            toggleBtn.classList.add('active');
            toggleBtn.innerHTML = 'Show Cameras';
        } else {
            toggleBtn.classList.remove('active');
            toggleBtn.innerHTML = 'Show Cameras';
        }
    }

    private toggleCameraProfileLabels(cameraProfileIndex: number, showLabels: boolean): void {
        if (cameraProfileIndex < 0 || cameraProfileIndex >= this.cameraGroups.length) return;
        
        const profileGroup = this.cameraGroups[cameraProfileIndex];
        // Iterate through all cameras in the profile
        profileGroup.children.forEach(child => {
            if (child instanceof THREE.Group && child.name.startsWith('camera_')) {
                const label = child.getObjectByName('cameraLabel');
                if (label) {
                    label.visible = showLabels;
                }
            }
        });
    }

    private toggleCameraProfileCoordinates(cameraProfileIndex: number, showCoords: boolean): void {
        if (cameraProfileIndex < 0 || cameraProfileIndex >= this.cameraGroups.length) return;
        
        const profileGroup = this.cameraGroups[cameraProfileIndex];
        // Iterate through all cameras in the profile
        profileGroup.children.forEach(child => {
            if (child instanceof THREE.Group && child.name.startsWith('camera_')) {
                if (showCoords) {
                    // Create or update coordinate label
                    const originalPos = (child as any).originalPosition;
                    if (originalPos) {
                        const coordText = `(${originalPos.x.toFixed(3)}, ${originalPos.y.toFixed(3)}, ${originalPos.z.toFixed(3)})`;
                        let coordLabel = child.getObjectByName('coordinateLabel') as THREE.Sprite;
                        
                        if (!coordLabel) {
                            coordLabel = this.createCameraLabel(coordText);
                            coordLabel.name = 'coordinateLabel';
                            coordLabel.position.set(0, -0.03, 0); // Position below camera base
                            child.add(coordLabel);
                        } else {
                            // Update existing label text
                            const newLabel = this.createCameraLabel(coordText);
                            coordLabel.material = newLabel.material;
                        }
                        coordLabel.visible = true;
                    }
                } else {
                    // Hide coordinate label
                    const coordLabel = child.getObjectByName('coordinateLabel');
                    if (coordLabel) {
                        coordLabel.visible = false;
                    }
                }
            }
        });
    }

    private applyCameraScale(cameraProfileIndex: number, scale: number): void {
        if (cameraProfileIndex < 0 || cameraProfileIndex >= this.cameraGroups.length) return;
        
        const profileGroup = this.cameraGroups[cameraProfileIndex];
        // Apply scale to each individual camera's visual elements
        profileGroup.children.forEach(child => {
            if (child instanceof THREE.Group && child.name.startsWith('camera_')) {
                // Scale all visual elements including text labels
                child.children.forEach(visualElement => {
                    // Reset scale to 1.0 first to prevent accumulation
                    visualElement.scale.setScalar(1.0);
                    
                    if (visualElement.name === 'cameraLabel') {
                        // Preserve aspect ratio and scale relative to original base scale
                        const base = (visualElement as any).userData?.baseScale;
                        if (base) {
                            visualElement.scale.set(base.x * scale, base.y * scale, 1);
                        }
                        // Adjust position to scale with pyramid
                        visualElement.position.set(0, 0.04 * scale, 0);
                    } else if (visualElement.name === 'coordinateLabel') {
                        // Preserve aspect ratio and scale relative to original base scale, but smaller than name label
                        const base = (visualElement as any).userData?.baseScale;
                        if (base) {
                            const shrink = 0.6; // make coordinates label smaller
                            visualElement.scale.set(base.x * scale * shrink, base.y * scale * shrink, 1);
                        }
                        // Position coordinate label slightly below base
                        visualElement.position.set(0, -0.035 * scale, 0);
                    } else if (visualElement.name === 'directionLine') {
                        // For direction line, recreate geometry with scaled length
                        const line = visualElement as THREE.Line;
                        const lineLength = 0.05 * scale; // Scale the line length
                        const positions = new Float32Array([
                            0, 0, 0,          // Start at camera origin (tip)
                            0, 0, lineLength  // Extend forward with scaled length
                        ]);
                        line.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                        line.geometry.attributes.position.needsUpdate = true;
                    } else {
                        // Scale pyramid normally
                        visualElement.scale.setScalar(scale);
                    }
                });
            }
        });
    }

    private normalizePose(raw: any): { joints: Array<{ x: number; y: number; z: number; score?: number; valid?: boolean }>; edges: Array<[number, number]> } {
        // If already in generic shape
        if (raw && Array.isArray(raw.joints) && Array.isArray(raw.edges)) {
            const joints = raw.joints.map((j: any) => {
                const hasX = j?.x !== null && j?.x !== undefined;
                const hasY = j?.y !== null && j?.y !== undefined;
                const hasZ = j?.z !== null && j?.z !== undefined;
                const x = hasX ? Number(j.x) : NaN;
                const y = hasY ? Number(j.y) : NaN;
                const z = hasZ ? Number(j.z) : NaN;
                const valid = hasX && hasY && hasZ && isFinite(x) && isFinite(y) && isFinite(z);
                return { x: valid ? x : 0, y: valid ? y : 0, z: valid ? z : 0, score: j.score, valid };
            });
            const edges = raw.edges.map((e: any) => [e[0] | 0, e[1] | 0] as [number, number]);
            return { joints, edges };
        }

        // Human3.6M-like: positions_3d + skeleton.connections (and optional confidence array)
        if (raw && Array.isArray(raw.positions_3d)) {
            const joints = raw.positions_3d.map((p: any, idx: number) => {
                const hasX = Array.isArray(p) && p.length > 0 && p[0] !== null && p[0] !== undefined;
                const hasY = Array.isArray(p) && p.length > 1 && p[1] !== null && p[1] !== undefined;
                const hasZ = Array.isArray(p) && p.length > 2 && p[2] !== null && p[2] !== undefined;
                const x = hasX ? Number(p[0]) : NaN;
                const y = hasY ? Number(p[1]) : NaN;
                const z = hasZ ? Number(p[2]) : NaN;
                const valid = hasX && hasY && hasZ && isFinite(x) && isFinite(y) && isFinite(z);
                return {
                    x: valid ? x : 0,
                    y: valid ? y : 0,
                    z: valid ? z : 0,
                    score: Array.isArray(raw.confidence) && typeof raw.confidence[idx] === 'number' ? +raw.confidence[idx] : undefined,
                    valid
                };
            });
            let edges: Array<[number, number]> = [];
            if (raw.skeleton && Array.isArray(raw.skeleton.connections)) {
                edges = raw.skeleton.connections.map((e: any) => [e[0] | 0, e[1] | 0] as [number, number]);
            } else if (Array.isArray(raw.connections)) {
                edges = raw.connections.map((e: any) => [e[0] | 0, e[1] | 0] as [number, number]);
            } else {
                edges = this.autoConnectKnn(joints, 2);
            }
            return { joints, edges };
        }

        // Halpe meta format: meta_info + instance_info array
        if (raw && raw.meta_info && Array.isArray(raw.instance_info)) {
            // Use skeleton_links when available
            const links: Array<[number, number]> = Array.isArray(raw.meta_info.skeleton_links)
                ? raw.meta_info.skeleton_links.map((e: any) => [e[0] | 0, e[1] | 0] as [number, number])
                : [];

            // If multiple instances, we only normalize the first here; caller will split if needed
            const inst = raw.instance_info[0];
            const rawKpts: any[] = Array.isArray(inst?.keypoints) ? inst.keypoints : [];
            const joints: Array<{ x: number; y: number; z: number; score?: number; valid?: boolean }> = rawKpts.map((p: any, idx: number) => {
                const hasX = Array.isArray(p) && p.length > 0 && p[0] !== null && p[0] !== undefined;
                const hasY = Array.isArray(p) && p.length > 1 && p[1] !== null && p[1] !== undefined;
                const hasZ = Array.isArray(p) && p.length > 2 && p[2] !== null && p[2] !== undefined;
                const x = hasX ? Number(p[0]) : NaN;
                const y = hasY ? Number(p[1]) : NaN;
                const z = hasZ ? Number(p[2]) : NaN;
                const isValid = hasX && hasY && hasZ && isFinite(x) && isFinite(y) && isFinite(z);
                const score = Array.isArray(inst.keypoint_scores) && typeof inst.keypoint_scores[idx] === 'number'
                    ? Number(inst.keypoint_scores[idx])
                    : undefined;
                return { x: isValid ? x : 0, y: isValid ? y : 0, z: isValid ? z : 0, score, valid: isValid };
            });

            // Filter edges to valid joint indices
            const edges = (links.length > 0 ? links : this.autoConnectKnn(joints, 2)).filter(([a, b]) =>
                a >= 0 && a < joints.length && b >= 0 && b < joints.length
            );
            // Attach dataset extras to the last meta entry provisionally (will be moved per-pose)
            const toColor = (arr: any): [number, number, number][] => {
                if (!arr || !Array.isArray(arr.__ndarray__)) return [];
                return arr.__ndarray__.map((rgb: number[]) => [rgb[0]/255, rgb[1]/255, rgb[2]/255]);
            };
            const jointColors = toColor(raw.meta_info.keypoint_colors);
            const linkColors = toColor(raw.meta_info.skeleton_link_colors);
            // Store on a temporary field of raw to pass through
            (raw as any).__poseExtras = { jointColors, linkColors, keypointNames: raw.meta_info.keypoint_id2name, skeletonLinks: links };
            return { joints, edges };
        }

        // OpenPose / Halpe flat arrays: people[0].pose_keypoints_3d or _2d
        if (raw && Array.isArray(raw.people) && raw.people.length > 0) {
            const p = raw.people[0];
            const arr = p.pose_keypoints_3d || p.pose_keypoints_2d;
            if (Array.isArray(arr)) {
                const step = p.pose_keypoints_3d ? 4 : 3; // x,y,z,(c?) or x,y,c
            const joints: Array<{ x: number; y: number; z: number; score?: number; valid?: boolean }> = [];
                for (let i = 0; i + (step - 1) < arr.length; i += step) {
                    const hasX = arr[i] !== null && arr[i] !== undefined;
                    const hasY = arr[i + 1] !== null && arr[i + 1] !== undefined;
                    const hasZ = step === 4 ? (arr[i + 2] !== null && arr[i + 2] !== undefined) : true;
                    const x = hasX ? Number(arr[i]) : NaN;
                    const y = hasY ? Number(arr[i + 1]) : NaN;
                    const z = step === 4 ? (hasZ ? Number(arr[i + 2]) : NaN) : 0;
                    const cRaw = step === 4 ? arr[i + 3] : arr[i + 2];
                    const c = Number(cRaw);
                    const valid = hasX && hasY && (step === 4 ? hasZ : true) && isFinite(x) && isFinite(y) && (step === 4 ? isFinite(z) : true);
                    joints.push({ x: valid ? x : 0, y: valid ? y : 0, z: valid ? z : 0, score: isFinite(c) ? c : undefined, valid });
                }
                let edges: Array<[number, number]> = [];
                if (Array.isArray((raw as any).connections)) {
                    edges = (raw as any).connections.map((e: any) => [e[0] | 0, e[1] | 0] as [number, number]);
                } else {
                    edges = this.autoConnectKnn(joints, 2);
                }
                return { joints, edges };
            }
        }

        // COCO-like flat keypoints
        if (raw && Array.isArray(raw.keypoints)) {
            const arr = raw.keypoints;
            const step = arr.length % 4 === 0 ? 4 : 3;
            const joints: Array<{ x: number; y: number; z: number; score?: number; valid?: boolean }> = [];
            for (let i = 0; i + (step - 1) < arr.length; i += step) {
                const hasX = arr[i] !== null && arr[i] !== undefined;
                const hasY = arr[i + 1] !== null && arr[i + 1] !== undefined;
                const hasZ = step === 4 ? (arr[i + 2] !== null && arr[i + 2] !== undefined) : true;
                const x = hasX ? Number(arr[i]) : NaN;
                const y = hasY ? Number(arr[i + 1]) : NaN;
                const z = step === 4 ? (hasZ ? Number(arr[i + 2]) : NaN) : 0;
                const cRaw = step === 4 ? arr[i + 3] : arr[i + 2];
                const c = Number(cRaw);
                const valid = hasX && hasY && (step === 4 ? hasZ : true) && isFinite(x) && isFinite(y) && (step === 4 ? isFinite(z) : true);
                joints.push({ x: valid ? x : 0, y: valid ? y : 0, z: valid ? z : 0, score: isFinite(c) ? c : undefined, valid });
            }
            const edges = Array.isArray((raw as any).connections)
                ? (raw as any).connections.map((e: any) => [e[0] | 0, e[1] | 0] as [number, number])
                : this.autoConnectKnn(joints, 2);
            return { joints, edges };
        }

        // Generic arrays
        if (raw && Array.isArray(raw.points)) {
            const joints = raw.points.map((p: any) => {
                const rx = (Array.isArray(p) ? p[0] : p?.x);
                const ry = (Array.isArray(p) ? p[1] : p?.y);
                const rz = (Array.isArray(p) ? p[2] : p?.z);
                const hasX = rx !== null && rx !== undefined;
                const hasY = ry !== null && ry !== undefined;
                const hasZ = rz !== null && rz !== undefined;
                const x = hasX ? Number(rx) : NaN;
                const y = hasY ? Number(ry) : NaN;
                const z = hasZ ? Number(rz) : NaN;
                const valid = hasX && hasY && hasZ && isFinite(x) && isFinite(y) && isFinite(z);
                return { x: valid ? x : 0, y: valid ? y : 0, z: valid ? z : 0, valid };
            });
            const edges = Array.isArray(raw.connections) ? raw.connections.map((e: any) => [e[0]|0, e[1]|0] as [number, number]) : this.autoConnectKnn(joints, 2);
            return { joints, edges };
        }

        // Last resort: array of [x,y,(z)]
        if (Array.isArray(raw) && raw.length && Array.isArray(raw[0])) {
            const joints = raw.map((p: any[]) => {
                const hasX = Array.isArray(p) && p.length > 0 && p[0] !== null && p[0] !== undefined;
                const hasY = Array.isArray(p) && p.length > 1 && p[1] !== null && p[1] !== undefined;
                const hasZ = Array.isArray(p) && p.length > 2 && p[2] !== null && p[2] !== undefined;
                const x = hasX ? Number(p[0]) : NaN;
                const y = hasY ? Number(p[1]) : NaN;
                const z = hasZ ? Number(p[2]) : NaN;
                const valid = hasX && hasY && (hasZ ? isFinite(z) : true) && isFinite(x) && isFinite(y);
                return { x: valid ? x : 0, y: valid ? y : 0, z: valid ? (isFinite(z) ? z : 0) : 0, valid };
            });
            const edges = this.autoConnectKnn(joints, 2);
            return { joints, edges };
        }
        throw new Error('Unsupported pose JSON structure');
    }

    private autoConnectKnn(joints: Array<{ x: number; y: number; z: number }>, k: number): Array<[number, number]> {
        const edges: Array<[number, number]> = [];
        for (let i = 0; i < joints.length; i++) {
            const distances: Array<{ j: number; d: number }> = [];
            for (let j = 0; j < joints.length; j++) {
                if (i === j) continue;
                const dx = joints[i].x - joints[j].x;
                const dy = joints[i].y - joints[j].y;
                const dz = joints[i].z - joints[j].z;
                distances.push({ j, d: dx*dx + dy*dy + dz*dz });
            }
            distances.sort((a, b) => a.d - b.d);
            for (let n = 0; n < Math.min(k, distances.length); n++) {
                const j = distances[n].j;
                const a = Math.min(i, j);
                const b = Math.max(i, j);
                edges.push([a, b]);
            }
        }
        const set = new Set<string>();
        const dedup: Array<[number, number]> = [];
        for (const [a, b] of edges) {
            const key = `${a}-${b}`;
            if (!set.has(key)) { set.add(key); dedup.push([a, b]); }
        }
        return dedup;
    }

    private buildPoseGroup(pose: { joints: Array<{ x: number; y: number; z: number; score?: number }>; edges: Array<[number, number]> }): THREE.Group {
        const group = new THREE.Group();
        const unifiedIndex = this.plyFiles.length + this.poseGroups.length;
        // Default pose color: use assigned color for this index
        const colorMode = this.individualColorModes[unifiedIndex] ?? 'assigned';
        let baseRGB: [number, number, number];
        if (colorMode === 'assigned') {
            baseRGB = this.fileColors[unifiedIndex % this.fileColors.length];
        } else {
            const colorIndex = parseInt(colorMode as string);
            if (!isNaN(colorIndex) && colorIndex >= 0 && colorIndex < this.fileColors.length) {
                baseRGB = this.fileColors[colorIndex];
            } else {
                baseRGB = this.fileColors[unifiedIndex % this.fileColors.length];
            }
        }
        const baseColor = new THREE.Color(baseRGB[0], baseRGB[1], baseRGB[2]);

        // Joints as instanced spheres (only for valid joints)
        const radius = this.pointSizes[unifiedIndex] ?? 0.02; // 2 cm default
        const sphereGeo = new THREE.SphereGeometry(1, 12, 12);
        const mat = new THREE.MeshBasicMaterial({ color: baseColor, transparent: true, opacity: 0.95 });
        const validJointIndices: number[] = [];
        for (let i = 0; i < pose.joints.length; i++) {
            const p = pose.joints[i] as any;
            if (p && p.valid === true) validJointIndices.push(i);
        }
        const inst = new THREE.InstancedMesh(sphereGeo, mat, validJointIndices.length);
        const dummy = new THREE.Object3D();
        for (let k = 0; k < validJointIndices.length; k++) {
            const p = pose.joints[validJointIndices[k]];
            dummy.position.set(p.x, p.y, p.z);
            dummy.scale.setScalar(radius);
            dummy.updateMatrix();
            inst.setMatrixAt(k, dummy.matrix);
        }
        inst.instanceMatrix.needsUpdate = true;
        group.add(inst);
        // Store mapping and references for later updates
        (group as any).userData = (group as any).userData || {};
        (group as any).userData.validJointIndices = validJointIndices.slice();
        (group as any).userData.instancedMesh = inst;

        // Edges as line segments (skip invalid joints)
        if (pose.edges.length > 0) {
            const tempPositions: number[] = [];
            for (const [a, b] of pose.edges) {
                const pa = pose.joints[a] as any;
                const pb = pose.joints[b] as any;
                if (!(pa && pb)) continue;
                if (pa.valid !== true || pb.valid !== true) continue;
                // Also skip edges where endpoint equals origin due to sanitized NaN
                const aIsOrigin = pa.x === 0 && pa.y === 0 && pa.z === 0;
                const bIsOrigin = pb.x === 0 && pb.y === 0 && pb.z === 0;
                if (aIsOrigin || bIsOrigin) continue;
                tempPositions.push(pa.x, pa.y, pa.z, pb.x, pb.y, pb.z);
            }
            const lineGeo = new THREE.BufferGeometry();
            const positions = new Float32Array(tempPositions);
            if (positions.length > 0) {
            lineGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            } else {
                lineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(0), 3));
            }
            const lineMat = new THREE.LineBasicMaterial({ color: baseColor, transparent: true, opacity: 0.8 });
            const lines = new THREE.LineSegments(lineGeo, lineMat);
            group.add(lines);
            (group as any).userData.lineSegments = lines;
        }

        return group;
    }

    private handleMtlData(message: any): void {
        try {
            console.log('Received MTL data for file index:', message.fileIndex);
            const fileIndex = message.fileIndex;
            const mtlData = message.data;
            console.log('MTL data structure:', mtlData);
            console.log('Available materials:', Object.keys(mtlData.materials || {}));
            
            if (fileIndex < 0 || fileIndex >= this.plyFiles.length) {
                console.error('Invalid file index for MTL data:', fileIndex);
                return;
            }
            
            const objFile = this.plyFiles[fileIndex];
            const isObjFile = (objFile as any).isObjFile || (objFile as any).isObjWireframe;
            
            console.log('OBJ file data:', {
                isObjFile: (objFile as any).isObjFile,
                isObjWireframe: (objFile as any).isObjWireframe,
                objRenderType: (objFile as any).objRenderType,
                fileName: objFile.fileName
            });
            
            if (!isObjFile) {
                console.error('File is not an OBJ file:', fileIndex);
                return;
            }
            
            // Find the material to use - prioritize the current material from OBJ, then first material
            let materialColor = { r: 1.0, g: 0.0, b: 0.0 }; // Default red
            let materialName = '';
            
            if (mtlData.materials && Object.keys(mtlData.materials).length > 0) {
                const objData = (objFile as any).objData;
                const materialNames = Object.keys(mtlData.materials);
                
                // Try to use the material referenced in the OBJ file first
                if (objData && objData.currentMaterial && mtlData.materials[objData.currentMaterial]) {
                    const material = mtlData.materials[objData.currentMaterial];
                    if (material.diffuseColor) {
                        materialColor = material.diffuseColor;
                        materialName = objData.currentMaterial;
                    }
                } else {
                    // Fall back to first available material
                    const firstMaterial = mtlData.materials[materialNames[0]];
                    if (firstMaterial && firstMaterial.diffuseColor) {
                        materialColor = firstMaterial.diffuseColor;
                        materialName = materialNames[0];
                    }
                }
                
                console.log(`Using material '${materialName}' with color: RGB(${materialColor.r}, ${materialColor.g}, ${materialColor.b})`);
            }
            
            // Convert RGB 0-1 to Three.js hex color
            const hexColor = (Math.round(materialColor.r * 255) << 16) | 
                           (Math.round(materialColor.g * 255) << 8) | 
                           Math.round(materialColor.b * 255);
            
            // Update the mesh color based on current render type
            const mesh = this.meshes[fileIndex];
            const multiMaterialGroup = this.multiMaterialGroups[fileIndex];
            const subMeshes = this.materialMeshes[fileIndex];
            
            console.log('Mesh info:', {
                meshExists: !!mesh,
                meshType: mesh?.type,
                isLineSegments: (mesh as any)?.isLineSegments,
                isObjMesh: (mesh as any)?.isObjMesh,
                isMultiMaterial: (mesh as any)?.isMultiMaterial,
                multiMaterialGroupExists: !!multiMaterialGroup,
                subMeshCount: subMeshes?.length || 0,
                materialType: (mesh as any)?.material?.type
            });
            
            if (multiMaterialGroup && subMeshes) {
                // Multi-material OBJ: apply materials to each sub-mesh
                let appliedCount = 0;
                
                for (const subMesh of subMeshes) {
                    const subMaterialName = (subMesh as any).materialName;
                    if (subMaterialName && mtlData.materials[subMaterialName]) {
                        const subMaterial = mtlData.materials[subMaterialName];
                        if (subMaterial.diffuseColor) {
                            const subHexColor = (Math.round(subMaterial.diffuseColor.r * 255) << 16) | 
                                               (Math.round(subMaterial.diffuseColor.g * 255) << 8) | 
                                               Math.round(subMaterial.diffuseColor.b * 255);
                            
                            const subMeshMaterial = (subMesh as any).material;
                            if (subMeshMaterial && subMeshMaterial.color) {
                                subMeshMaterial.color.setHex(subHexColor);
                                console.log(`Applied ${subMaterialName} color #${subHexColor.toString(16).padStart(6, '0')} to sub-mesh`);
                                appliedCount++;
                            }
                        }
                    }
                }
                
                console.log(`Applied materials to ${appliedCount}/${subMeshes.length} sub-meshes`);
                materialName = message.fileName; // For multi-material, show filename
            } else if (mesh && (mesh as any).isLineSegments) {
                // Update wireframe color
                const lineMaterial = (mesh as any).material;
                if (lineMaterial) {
                    lineMaterial.color.setHex(hexColor);
                    console.log(`Updated wireframe color to #${hexColor.toString(16).padStart(6, '0')}`);
                }
                materialName = message.fileName; // For single-material, show filename
            } else if (mesh && ((mesh as any).isObjMesh || mesh.type === 'Mesh')) {
                // Update solid mesh color
                const meshMaterial = (mesh as any).material;
                if (meshMaterial) {
                    meshMaterial.color.setHex(hexColor);
                    console.log(`Updated solid mesh color to #${hexColor.toString(16).padStart(6, '0')}`);
                }
                materialName = message.fileName; // For single-material, show filename
            } else if (mesh) {
                console.warn('Unknown mesh type, trying to update material anyway');
                const anyMaterial = (mesh as any).material;
                if (anyMaterial && anyMaterial.color) {
                    anyMaterial.color.setHex(hexColor);
                    console.log(`Updated generic material color to #${hexColor.toString(16).padStart(6, '0')}`);
                }
                materialName = message.fileName; // For single-material, show filename
            } else {
                console.error('No mesh or multi-material group found at index:', fileIndex);
            }
            
            // Store the applied MTL color, name, and data for future use
            this.appliedMtlColors[fileIndex] = hexColor;
            this.appliedMtlNames[fileIndex] = materialName;
            this.appliedMtlData[fileIndex] = mtlData;
            
            // Update UI to show loaded MTL
            this.updateFileList();
            
            const materialCount = mtlData.materialCount || Object.keys(mtlData.materials || {}).length;
            this.showStatus(`MTL material applied! Using material '${materialName}' from ${message.fileName}`);
            
        } catch (error) {
            console.error('Error handling MTL data:', error);
            this.showError(`Failed to apply MTL material: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Capture the current open/closed state of depth settings panels and form values
     */
    private captureDepthPanelStates(): Map<number, {panelOpen: boolean, formValues: any}> {
        const states = new Map<number, {panelOpen: boolean, formValues: any}>();
        
        // Look for all depth settings panels and capture their display state
        const panels = document.querySelectorAll('[id^="depth-panel-"]');
        panels.forEach(panel => {
            const id = panel.id;
            const match = id.match(/depth-panel-(\d+)/);
            if (match) {
                const fileIndex = parseInt(match[1]);
                const displayStyle = (panel as HTMLElement).style.display;
                const isVisible = displayStyle === 'block' || (displayStyle === '' && (panel as HTMLElement).offsetHeight > 0);
                
                // Capture current form values
                const formValues = this.captureDepthFormValues(fileIndex);
                
                states.set(fileIndex, {
                    panelOpen: isVisible,
                    formValues: formValues
                });
                
                console.log(`📋 Captured state for file ${fileIndex}: ${isVisible ? 'open' : 'closed'}, fx=${formValues.fx}, cx=${formValues.cx}`);
            }
        });
        
        return states;
    }
    
    /**
     * Capture current form values for a depth settings panel
     */
    private captureDepthFormValues(fileIndex: number): any {
        const getValue = (id: string) => {
            const element = document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
            return element ? element.value : null;
        };
        
        return {
            fx: getValue(`fx-${fileIndex}`),
            fy: getValue(`fy-${fileIndex}`),
            cx: getValue(`cx-${fileIndex}`),
            cy: getValue(`cy-${fileIndex}`),
            cameraModel: getValue(`camera-model-${fileIndex}`),
            depthType: getValue(`depth-type-${fileIndex}`),
            baseline: getValue(`baseline-${fileIndex}`),
            disparityOffset: getValue(`disparity-offset-${fileIndex}`),
            convention: getValue(`convention-${fileIndex}`),
            pngScaleFactor: getValue(`png-scale-factor-${fileIndex}`),
            depthScale: getValue(`depth-scale-${fileIndex}`),
            depthBias: getValue(`depth-bias-${fileIndex}`),
            k1: getValue(`k1-${fileIndex}`),
            k2: getValue(`k2-${fileIndex}`),
            k3: getValue(`k3-${fileIndex}`),
            k4: getValue(`k4-${fileIndex}`),
            k5: getValue(`k5-${fileIndex}`),
            p1: getValue(`p1-${fileIndex}`),
            p2: getValue(`p2-${fileIndex}`)
        };
    }

    /**
     * Restore the open/closed state of depth settings panels and form values
     */
    private restoreDepthPanelStates(states: Map<number, {panelOpen: boolean, formValues: any}>): void {
        // Wait a bit for the DOM to be updated
        setTimeout(() => {
            // First, restore panel visibility states and form values
            states.forEach((state, fileIndex) => {
                const panel = document.getElementById(`depth-panel-${fileIndex}`);
                const toggleButton = document.querySelector(`[data-file-index="${fileIndex}"].depth-settings-toggle`) as HTMLElement;
                
                if (panel && toggleButton) {
                    console.log(`🔄 Restoring state for file ${fileIndex}: ${state.panelOpen ? 'open' : 'closed'}`);
                    
                    // Restore panel visibility
                    if (state.panelOpen) {
                        (panel as HTMLElement).style.display = 'block';
                        const icon = toggleButton.querySelector('.toggle-icon');
                        if (icon) icon.textContent = '▼';
                    } else {
                        (panel as HTMLElement).style.display = 'none';
                        const icon = toggleButton.querySelector('.toggle-icon');
                        if (icon) icon.textContent = '▶';
                    }
                    
                    // Restore form values
                    this.restoreDepthFormValues(fileIndex, state.formValues);
                } else {
                    console.warn(`⚠️ Could not find panel or toggle button for file ${fileIndex}`);
                }
            });
            
            // For any depth files not captured in states (edge case), restore dimensions
            this.fileDepthData.forEach((depthData, fileIndex) => {
                if (!states.has(fileIndex)) {
                    const panel = document.getElementById(`depth-panel-${fileIndex}`);
                    if (panel) {
                        console.log(`📐 Restoring dimensions for uncaptured file ${fileIndex}: ${depthData.depthDimensions.width}×${depthData.depthDimensions.height}`);
                        this.updatePrinciplePointFields(fileIndex, depthData.depthDimensions);
                    }
                }
            });
        }, 10);
    }
    
    /**
     * Restore form values for a depth settings panel
     */
    private restoreDepthFormValues(fileIndex: number, formValues: any): void {
        const setValue = (id: string, value: string | null) => {
            if (value !== null) {
                const element = document.getElementById(id) as HTMLInputElement | HTMLSelectElement;
                if (element) element.value = value;
            }
        };
        
        // Restore all captured form values
        setValue(`fx-${fileIndex}`, formValues.fx);
        setValue(`fy-${fileIndex}`, formValues.fy);
        setValue(`cx-${fileIndex}`, formValues.cx);
        setValue(`cy-${fileIndex}`, formValues.cy);
        setValue(`camera-model-${fileIndex}`, formValues.cameraModel);
        setValue(`depth-type-${fileIndex}`, formValues.depthType);
        setValue(`baseline-${fileIndex}`, formValues.baseline);
        setValue(`disparity-offset-${fileIndex}`, formValues.disparityOffset);
        setValue(`convention-${fileIndex}`, formValues.convention);
        setValue(`png-scale-factor-${fileIndex}`, formValues.pngScaleFactor);
        setValue(`depth-scale-${fileIndex}`, formValues.depthScale);
        setValue(`depth-bias-${fileIndex}`, formValues.depthBias);
        setValue(`k1-${fileIndex}`, formValues.k1);
        setValue(`k2-${fileIndex}`, formValues.k2);
        setValue(`k3-${fileIndex}`, formValues.k3);
        setValue(`k4-${fileIndex}`, formValues.k4);
        setValue(`k5-${fileIndex}`, formValues.k5);
        setValue(`p1-${fileIndex}`, formValues.p1);
        setValue(`p2-${fileIndex}`, formValues.p2);
        
        // Show/hide distortion parameters based on camera model
        const distortionGroup = document.getElementById(`distortion-params-${fileIndex}`);
        const pinholeParams = document.getElementById(`pinhole-params-${fileIndex}`);
        const fisheyeOpencvParams = document.getElementById(`fisheye-opencv-params-${fileIndex}`);
        const kannalaBrandtParams = document.getElementById(`kannala-brandt-params-${fileIndex}`);
        
        if (distortionGroup && pinholeParams && fisheyeOpencvParams && kannalaBrandtParams) {
            // Hide all parameter sections first
            pinholeParams.style.display = 'none';
            fisheyeOpencvParams.style.display = 'none';
            kannalaBrandtParams.style.display = 'none';
            
            // Show appropriate parameter section based on model
            if (formValues.cameraModel === 'pinhole-opencv') {
                distortionGroup.style.display = '';
                pinholeParams.style.display = '';
            } else if (formValues.cameraModel === 'fisheye-opencv') {
                distortionGroup.style.display = '';
                fisheyeOpencvParams.style.display = '';
            } else if (formValues.cameraModel === 'fisheye-kannala-brandt') {
                distortionGroup.style.display = '';
                kannalaBrandtParams.style.display = '';
            } else {
                distortionGroup.style.display = 'none';
            }
        }
        
        // Also ensure dimensions are displayed correctly
        const depthData = this.fileDepthData.get(fileIndex);
        if (depthData) {
            const imageSizeDiv = document.getElementById(`image-size-${fileIndex}`);
            if (imageSizeDiv) {
                imageSizeDiv.textContent = `Image Size: Width: ${depthData.depthDimensions.width}, Height: ${depthData.depthDimensions.height}`;
                console.log(`📐 Restored image size display for file ${fileIndex}: ${depthData.depthDimensions.width}×${depthData.depthDimensions.height}`);
            }
        }
        
        console.log(`📝 Restored form values for file ${fileIndex}: fx=${formValues.fx}, cx=${formValues.cx}`);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new PointCloudVisualizer());
} else {
    new PointCloudVisualizer();
}