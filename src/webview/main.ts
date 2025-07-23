import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

declare const acquireVsCodeApi: () => any;
declare const GeoTIFF: any;

interface PlyVertex {
    x: number;
    y: number;
    z: number;
    red?: number;
    green?: number;
    blue?: number;
    alpha?: number;
    nx?: number;
    ny?: number;
    nz?: number;
}

interface PlyFace {
    indices: number[];
}

interface PlyData {
    vertices: PlyVertex[];
    faces: PlyFace[];
    format: 'ascii' | 'binary_little_endian' | 'binary_big_endian';
    version: string;
    comments: string[];
    vertexCount: number;
    faceCount: number;
    hasColors: boolean;
    hasNormals: boolean;
    fileName?: string;
    fileIndex?: number;
}

interface CameraParams {
    cameraModel: 'pinhole' | 'fisheye';
    focalLength: number;
    depthType: 'euclidean' | 'orthogonal' | 'disparity';
    baseline?: number; // Required for disparity mode
}

interface TifConversionResult {
    vertices: Float32Array;
    colors?: Float32Array;
    pointCount: number;
}

/**
 * Modern PLY Visualizer with unified file management and TIF processing
 */
class PLYVisualizer {
    private vscode = acquireVsCodeApi();
    private scene!: THREE.Scene;
    private camera!: THREE.PerspectiveCamera;
    private renderer!: THREE.WebGLRenderer;
    private controls!: TrackballControls | OrbitControls;
    
    // Camera control state
    private controlType: 'trackball' | 'orbit' | 'inverse-trackball' = 'trackball';
    
    // Unified file management
    private plyFiles: PlyData[] = [];
    private meshes: (THREE.Mesh | THREE.Points)[] = [];
    private fileVisibility: boolean[] = [];
    private useOriginalColors = true; // Default to original colors
    private pointSizes: number[] = []; // Individual point sizes for each point cloud
    private individualColorModes: string[] = []; // Individual color modes: 'original', 'assigned', or color index
    
    // Per-file TIF data storage for reprocessing
    private fileTifData: Map<number, {
        originalData: ArrayBuffer;
        cameraParams: CameraParams;
        fileName: string;
        tifDimensions: { width: number; height: number };
        colorImageData?: ImageData;
        colorImageName?: string;
    }> = new Map();
    
    // Rotation matrices
    private cameraMatrix: THREE.Matrix4 = new THREE.Matrix4(); // Current camera position and rotation
    private transformationMatrices: THREE.Matrix4[] = []; // Individual transformation matrices for each point cloud
    private frameCount: number = 0; // Frame counter for UI updates
    private lastCameraPosition: THREE.Vector3 = new THREE.Vector3(); // Track camera position changes
    private lastCameraQuaternion: THREE.Quaternion = new THREE.Quaternion(); // Track camera rotation changes
    
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
    
    // TIF processing state - support multiple pending TIF files
    private pendingTifFiles: Map<string, {
        data: ArrayBuffer;
        fileName: string;
        isAddFile: boolean;
        requestId: string;
    }> = new Map();
    
    // TIF conversion tracking
    private originalTifData: ArrayBuffer | null = null;
    private originalTifFileName: string | null = null;
    private currentCameraParams: CameraParams | null = null;
    private tifDimensions: { width: number; height: number } | null = null;
    private currentColorImageData: ImageData | null = null;
    private useLinearColorSpace: boolean = true; // Default to linear to disable gamma correction
    
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
            1000000  // Further increased far plane for disparity TIF files
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
            antialias: true,
            alpha: true
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        
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

        // Double-click to change rotation center (like CloudCompare)
        this.renderer.domElement.addEventListener('dblclick', this.onDoubleClick.bind(this));

        // Start render loop
        this.animate();
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
        if (this.controlType === 'trackball' || this.controlType === 'inverse-trackball') {
            const trackballControls = this.controls as TrackballControls;
            trackballControls.addEventListener('start', showAxes);
            trackballControls.addEventListener('end', hideAxesAfterDelay);
        } else {
            const orbitControls = this.controls as OrbitControls;
            orbitControls.addEventListener('start', showAxes);
            orbitControls.addEventListener('end', hideAxesAfterDelay);
        }
        
        console.log('✅ Axes visibility set up for', this.controlType);
    }

    private setupInvertedControls(): void {
        if (this.controlType !== 'inverse-trackball') return;
        
        // TRACKBALL ROTATION DIRECTION INVERSION - Override the _rotateCamera method
        console.log('🔄 Setting up TrackballControls rotation direction inversion');
        
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
        
        console.log('✅ Up vector rotation direction inversion applied using quaternion.invert()');
        console.log('✅ TrackballControls rotation direction inversion applied');
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

    private updateAxesSize(): void {
        const axesGroup = (this as any).axesGroup;
        if (!axesGroup || this.meshes.length === 0) {return;}

        // Calculate the bounding box of all visible objects
        const box = new THREE.Box3();
        for (let i = 0; i < this.meshes.length; i++) {
            if (this.fileVisibility[i]) {
                box.expandByObject(this.meshes[i]);
            }
        }

        if (box.isEmpty()) {return;}

        // Size the axes to be about 15% of the largest dimension
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const axesSize = maxDim * 0.15;

        axesGroup.scale.setScalar(axesSize);
        
        // Position axes at the current rotation center (controls.target)
        axesGroup.position.copy(this.controls.target);
        
        console.log('✅ Axes updated - Size:', axesSize.toFixed(3), 'Position:', this.controls.target);
    }

    private initSceneLighting(): void {
        // Remove existing lights
        const lightsToRemove = this.scene.children.filter(child => 
            child instanceof THREE.AmbientLight || child instanceof THREE.DirectionalLight
        );
        lightsToRemove.forEach(light => this.scene.remove(light));

        // Add fresh lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);
    }

    private updateRendererColorSpace(): void {
        if (this.useLinearColorSpace) {
            this.renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
            console.log('🎨 Using Linear color space (no gamma correction)');
        } else {
            this.renderer.outputColorSpace = THREE.SRGBColorSpace;
            console.log('🎨 Using sRGB color space (with gamma correction)');
        }
    }

    private toggleGammaCorrection(): void {
        this.useLinearColorSpace = !this.useLinearColorSpace;
        this.updateRendererColorSpace();
        
        const statusMessage = this.useLinearColorSpace 
            ? 'Gamma correction disabled (Linear color space)' 
            : 'Gamma correction enabled (sRGB color space)';
        this.showStatus(statusMessage);
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
        requestAnimationFrame(this.animate.bind(this));
        
        // Update controls
        this.controls.update();
        
        // Check if camera position or rotation has changed
        const positionChanged = !this.camera.position.equals(this.lastCameraPosition);
        const rotationChanged = !this.camera.quaternion.equals(this.lastCameraQuaternion);
        
        // Only update camera matrix and UI when camera actually changes
        if (positionChanged || rotationChanged) {
            this.updateCameraMatrix();
            this.updateCameraControlsPanel();
            
            // Debug: Check if any TIF-derived point clouds are being culled
            // Only log every 60 frames to avoid spam
            this.frameCount++;
            if (this.frameCount % 60 === 0) {
                this.checkMeshVisibility();
            }
            
            // Update last known position and rotation
            this.lastCameraPosition.copy(this.camera.position);
            this.lastCameraQuaternion.copy(this.camera.quaternion);
        }
        
        this.renderer.render(this.scene, this.camera);
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
                    console.log(`👻 Mesh ${i} may be culled: distance=${distanceToCamera.toFixed(3)}, camera range=[${this.camera.near}, ${this.camera.far}]`);
                }
                
                // Check if bounding box is extremely large
                const size = box.getSize(new THREE.Vector3());
                const maxDim = Math.max(size.x, size.y, size.z);
                if (maxDim > 50000) {
                    console.log(`📏 Mesh ${i} has very large bounds: ${maxDim.toFixed(3)} - may cause culling issues`);
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

    private getCameraMatrixForDisplay(): THREE.Matrix4 {
        // Return the direct camera transformation (not the inverse) for display/editing
        const displayMatrix = new THREE.Matrix4();
        
        // Create direct camera transformation
        const positionMatrix = new THREE.Matrix4();
        positionMatrix.makeTranslation(this.camera.position.x, this.camera.position.y, this.camera.position.z);
        
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationFromQuaternion(this.camera.quaternion);
        
        // Combine: first translate, then rotate
        displayMatrix.multiply(rotationMatrix).multiply(positionMatrix);
        
        return displayMatrix;
    }

    private getCameraMatrix(): THREE.Matrix4 {
        return this.cameraMatrix.clone();
    }

    private getCameraMatrixAsArray(): number[] {
        return this.cameraMatrix.elements.slice();
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
        if (fileIndex >= 0 && fileIndex < this.meshes.length && fileIndex < this.transformationMatrices.length) {
            const mesh = this.meshes[fileIndex];
            const matrix = this.transformationMatrices[fileIndex];
            mesh.matrix.copy(matrix);
            mesh.matrixAutoUpdate = false; // Disable auto-update to use our custom matrix
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

    private createScaleMatrix(x: number, y: number, z: number): THREE.Matrix4 {
        const matrix = new THREE.Matrix4();
        matrix.makeScale(x, y, z);
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

    private multiplyTransformationMatrices(fileIndex: number, matrix: THREE.Matrix4): void {
        if (fileIndex >= 0 && fileIndex < this.transformationMatrices.length) {
            this.transformationMatrices[fileIndex].multiply(matrix);
            this.applyTransformationMatrix(fileIndex);
        }
    }

    private getTransformationTranslation(fileIndex: number): THREE.Vector3 {
        if (fileIndex >= 0 && fileIndex < this.transformationMatrices.length) {
            const matrix = this.transformationMatrices[fileIndex];
            return new THREE.Vector3(matrix.elements[12], matrix.elements[13], matrix.elements[14]);
        }
        return new THREE.Vector3(0, 0, 0);
    }

    private setTransformationTranslation(fileIndex: number, x: number, y: number, z: number): void {
        if (fileIndex >= 0 && fileIndex < this.transformationMatrices.length) {
            const matrix = this.transformationMatrices[fileIndex];
            matrix.elements[12] = x;
            matrix.elements[13] = y;
            matrix.elements[14] = z;
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
            console.log(`📐 Matrix display updated for file ${fileIndex}`);
        }
    }

    private updateCameraMatrixDisplay(): void {
        // Camera matrix is now displayed in the camera controls panel
        // This method is kept for compatibility but doesn't display anything
    }

    private updateCameraControlsPanel(): void {
        const controlsPanel = document.getElementById('camera-controls-panel');
        if (controlsPanel && this.plyFiles.length > 0) {
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

    private showCameraMatrixEditor(currentMatrix: string): void {
        // Create modal overlay
        const modal = document.createElement('div');
        modal.className = 'matrix-modal-overlay';
        modal.innerHTML = `
            <div class="matrix-modal">
                <div class="matrix-modal-header">
                    <h4>Edit Camera Matrix</h4>
                    <button class="close-modal">✕</button>
                </div>
                <div class="matrix-modal-content">
                    <p style="font-size:11px;margin-bottom:8px;">Enter 16 numbers for the 4x4 camera matrix (space or newline separated):</p>
                    <textarea id="modal-camera-matrix" rows="6" cols="50" style="width:100%;font-size:10px;font-family:monospace;" placeholder="1.000000 0.000000 0.000000 0.000000&#10;0.000000 1.000000 0.000000 0.000000&#10;0.000000 0.000000 1.000000 0.000000&#10;0.000000 0.000000 0.000000 1.000000">${currentMatrix}</textarea>
                </div>
                <div class="matrix-modal-footer">
                    <button id="apply-modal-matrix" class="primary-button">Apply</button>
                    <button id="cancel-modal-matrix" class="secondary-button">Cancel</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Focus on textarea
        const textarea = document.getElementById('modal-camera-matrix') as HTMLTextAreaElement;
        if (textarea) {
            textarea.focus();
            textarea.select();
        }
        
        // Event listeners
        const closeBtn = modal.querySelector('.close-modal');
        const cancelBtn = modal.querySelector('#cancel-modal-matrix');
        const applyBtn = modal.querySelector('#apply-modal-matrix');
        
        const closeModal = () => {
            document.body.removeChild(modal);
        };
        
        closeBtn?.addEventListener('click', closeModal);
        cancelBtn?.addEventListener('click', closeModal);
        
        applyBtn?.addEventListener('click', () => {
            const values = textarea.value.trim().split(/\s+/).map(Number);
            if (values.length === 16 && values.every(v => !isNaN(v))) {
                const mat = new THREE.Matrix4();
                // Fix: Read matrix in row-major order (as displayed in UI)
                // values are in row-major order: [row0col0, row0col1, row0col2, row0col3, row1col0, ...]
                mat.set(
                    values[0], values[1], values[2],  values[3],
                    values[4], values[5], values[6],  values[7],
                    values[8], values[9], values[10], values[11],
                    values[12], values[13], values[14], values[15]
                );
                this.applyCameraMatrix(mat);
                closeModal();
            } else {
                alert('Please enter 16 valid numbers for the 4x4 camera matrix.');
            }
        });
        
        // Close on escape key
        const handleKeydown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                closeModal();
                document.removeEventListener('keydown', handleKeydown);
            }
        };
        document.addEventListener('keydown', handleKeydown);
        
        // Close on overlay click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    private applyCameraMatrixFromInput(): void {
        const textarea = document.getElementById('camera-matrix-input') as HTMLTextAreaElement;
        if (textarea) {
            const values = textarea.value.trim().split(/\s+/).map(Number);
            if (values.length === 16 && values.every(v => !isNaN(v))) {
                const mat = new THREE.Matrix4();
                // Fix: Read matrix in row-major order (as displayed in UI)
                mat.set(
                    values[0], values[1], values[2],  values[3],
                    values[4], values[5], values[6],  values[7],
                    values[8], values[9], values[10], values[11],
                    values[12], values[13], values[14], values[15]
                );
                this.applyCameraMatrix(mat);
            } else {
                alert('Please enter 16 valid numbers for the 4x4 camera matrix.');
            }
        }
    }

    private applyCameraMatrix(matrix: THREE.Matrix4): void {
        // The input matrix represents the direct camera transformation
        // We need to extract the camera position and rotation from it
        
        // Extract position from the matrix (last column in row-major format)
        const position = new THREE.Vector3();
        position.setFromMatrixPosition(matrix);
        
        // Extract rotation from the matrix
        const quaternion = new THREE.Quaternion();
        quaternion.setFromRotationMatrix(matrix);
        
        // Apply to camera
        this.camera.position.copy(position);
        this.camera.quaternion.copy(quaternion);
        
        // Update controls target to maintain proper orientation
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(quaternion);
        this.controls.target.copy(position.clone().add(direction));
        this.controls.update();
        
        // Update last known camera state to prevent unnecessary UI updates
        this.lastCameraPosition.copy(this.camera.position);
        this.lastCameraQuaternion.copy(this.camera.quaternion);
        
        // Update camera matrix and refresh UI
        this.updateCameraMatrix();
        this.updateCameraControlsPanel();
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

    private setCameraToDiagonalMatrix(): void {
        // Create a proper diagonal matrix (identity matrix)
        const diagonalMatrix = new THREE.Matrix4();
        diagonalMatrix.identity(); // This creates a proper 4x4 identity matrix
        
        // Apply the diagonal matrix to the camera
        this.applyCameraMatrix(diagonalMatrix);
        
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
        
        console.log('🎯 Rotation center set to origin (0, 0, 0)');
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
        console.log(`📷 Camera position: [${this.camera.position.x.toFixed(3)}, ${this.camera.position.y.toFixed(3)}, ${this.camera.position.z.toFixed(3)}]`);
        console.log(`🎯 Mouse coordinates: [${mouse.x.toFixed(3)}, ${mouse.y.toFixed(3)}]`);
        
        // Debug visible meshes
        visibleMeshes.forEach((mesh, index) => {
            const realIndex = this.meshes.indexOf(mesh);
            const geometry = mesh.geometry as THREE.BufferGeometry;
            const positionAttribute = geometry.getAttribute('position');
            const pointCount = positionAttribute ? positionAttribute.count : 0;
            console.log(`🔍 Mesh ${realIndex}: ${mesh.constructor.name}, ${pointCount} points, material size: ${(mesh.material as any).size || 'N/A'}`);
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
            
            console.log(`🎯 Trying threshold ${threshold}: ${intersects.length} intersections found`);
            
            if (intersects.length > 0) {
                console.log(`✅ Success with threshold ${threshold}! Distance to closest point: ${intersects[0].distance.toFixed(3)}`);
                break;
            }
        }
        
        console.log(`🔍 Final result: ${intersects.length} intersections found using threshold ${usedThreshold}`);

        if (intersects.length > 0) {
            console.log(`🎯 Found ${intersects.length} intersections:`);
            intersects.forEach((intersect, i) => {
                console.log(`  ${i}: distance=${intersect.distance.toFixed(3)}, point=[${intersect.point.x.toFixed(3)}, ${intersect.point.y.toFixed(3)}, ${intersect.point.z.toFixed(3)}]`);
            });
            // Get the closest intersection point
            const intersectionPoint = intersects[0].point;
            
            // Check if the point is too close to the camera
            const distance = this.camera.position.distanceTo(intersectionPoint);
            const minDistance = 0.005; // Very small minimum distance
            
            if (distance < minDistance) {
                console.log('⚠️ Point too close to camera, ignoring double-click');
                return; // Don't set rotation center for points too close
            }
            
            // Set this point as the new rotation center
            this.setRotationCenter(intersectionPoint);
            
            console.log('New rotation center set at:', intersectionPoint);
        }
    }

    private setRotationCenter(point: THREE.Vector3): void {
        // Check if the point is too close to the camera or behind it
        const cameraToPoint = point.clone().sub(this.camera.position);
        const distance = cameraToPoint.length();
        const minDistance = 0.01; // Minimum distance to prevent issues
        
        // If point is too close or behind camera, adjust it
        if (distance < minDistance) {
            console.log('⚠️ Point too close to camera, adjusting rotation center');
            
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
            
            console.log('🎯 Adjusted rotation center to:', adjustedPoint.x.toFixed(3), adjustedPoint.y.toFixed(3), adjustedPoint.z.toFixed(3));
        } else {
            // Point is at a safe distance, use it directly
            this.controls.target.copy(point);
            
            // Update axes position to the new rotation center
            const axesGroup = (this as any).axesGroup;
            if (axesGroup) {
                axesGroup.position.copy(point);
            }
            
            console.log('🎯 Rotation center and axes moved to:', point.x.toFixed(3), point.y.toFixed(3), point.z.toFixed(3));
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
        
        console.log(`Creating geometry for ${data.vertexCount} vertices...`);
        const startTime = performance.now();
        
        // Check if we have direct TypedArrays (new ultra-fast path)
        console.log(`🔍 Debug: useTypedArrays = ${(data as any).useTypedArrays}, positionsArray = ${!!(data as any).positionsArray}`);
        if ((data as any).useTypedArrays) {
            console.log(`🚀 Using direct TypedArray geometry creation - MAXIMUM PERFORMANCE!`);
            
            const positions = (data as any).positionsArray as Float32Array;
            const colors = (data as any).colorsArray as Uint8Array | null;
            const normals = (data as any).normalsArray as Float32Array | null;
            
            // Direct assignment - zero copying, zero processing!
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            
            if (colors && data.hasColors) {
                // Convert Uint8Array colors to Float32Array for Three.js
                const colorFloats = new Float32Array(colors.length);
                for (let i = 0; i < colors.length; i++) {
                    colorFloats[i] = colors[i] / 255;
                }
                geometry.setAttribute('color', new THREE.BufferAttribute(colorFloats, 3));
            }
            
            if (normals && data.hasNormals) {
                geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
            }
            
        } else {
            // Fallback to traditional vertex object processing
            const vertexCount = data.vertices.length;
            console.log(`Using traditional vertex object processing for ${vertexCount} vertices...`);
            
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
                    colors[i3] = vertex.red / 255;
                    colors[i3 + 1] = (vertex.green || 0) / 255;
                    colors[i3 + 2] = (vertex.blue || 0) / 255;
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
            } else if (data.faces.length > 0) {
                // Only compute normals for meshes, not point clouds
                geometry.computeVertexNormals();
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

        geometry.computeBoundingBox();
        
        // Debug bounding box for disparity TIF files (may help with disappearing issue)
        if (geometry.boundingBox) {
            const box = geometry.boundingBox;
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            
            console.log(`📦 Geometry bounding box:`);
            console.log(`   Min: [${box.min.x.toFixed(3)}, ${box.min.y.toFixed(3)}, ${box.min.z.toFixed(3)}]`);
            console.log(`   Max: [${box.max.x.toFixed(3)}, ${box.max.y.toFixed(3)}, ${box.max.z.toFixed(3)}]`);
            console.log(`   Size: [${size.x.toFixed(3)}, ${size.y.toFixed(3)}, ${size.z.toFixed(3)}]`);
            console.log(`   Center: [${center.x.toFixed(3)}, ${center.y.toFixed(3)}, ${center.z.toFixed(3)}]`);
            
            // Check for extreme values that might cause culling issues
            const maxDimension = Math.max(size.x, size.y, size.z);
            if (maxDimension > 10000) {
                console.warn(`⚠️ Very large bounding box (${maxDimension.toFixed(3)}) may cause rendering issues!`);
            }
            
            // Check distance from origin
            const distanceFromOrigin = center.length();
            if (distanceFromOrigin > 1000) {
                console.warn(`⚠️ Point cloud center very far from origin (${distanceFromOrigin.toFixed(3)}) - may cause culling issues!`);
            }
        }
        
        const endTime = performance.now();
        console.log(`Geometry creation took ${(endTime - startTime).toFixed(2)}ms`);
        
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
                this.fitCameraToAllObjects();
            });
        }

        const resetCameraBtn = document.getElementById('reset-camera');
        if (resetCameraBtn) {
            resetCameraBtn.addEventListener('click', () => {
                this.resetCameraToDefault();
            });
        }

        const toggleAxesBtn = document.getElementById('toggle-axes');
        if (toggleAxesBtn) {
            toggleAxesBtn.addEventListener('click', () => {
                this.toggleAxesVisibility();
            });
        }

        const setRotationOriginBtn = document.getElementById('set-rotation-origin');
        if (setRotationOriginBtn) {
            setRotationOriginBtn.addEventListener('click', () => {
                this.setRotationCenterToOrigin();
            });
        }

        // Camera convention buttons
        const opencvBtn = document.getElementById('opencv-convention');
        if (opencvBtn) {
            opencvBtn.addEventListener('click', () => {
                this.setOpenCVCameraConvention();
            });
        }

        const blenderBtn = document.getElementById('blender-convention');
        if (blenderBtn) {
            blenderBtn.addEventListener('click', () => {
                this.setBlenderOpenGLCameraConvention();
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

        // Color settings
        const toggleGammaCorrectionBtn = document.getElementById('toggle-gamma-correction');
        if (toggleGammaCorrectionBtn) {
            toggleGammaCorrectionBtn.addEventListener('click', () => {
                this.toggleGammaCorrection();
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
                    this.fitCameraToAllObjects();
                    e.preventDefault();
                    break;
                case 'r':
                    this.resetCameraToDefault();
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
                    this.setBlenderOpenGLCameraConvention();
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
                    console.log('🔑 W key pressed - setting rotation center to world origin (0,0,0)');
                    this.setRotationCenterToOrigin();
                    e.preventDefault();
                    break;
                case 'g':
                    this.toggleGammaCorrection();
                    e.preventDefault();
                    break;
            }
        });

        // Global color mode toggle (removed - now handled per file)
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
        if (axesGroup) {
            axesGroup.visible = !axesGroup.visible;
            const toggleBtn = document.getElementById('toggle-axes');
            if (toggleBtn) {
                toggleBtn.innerHTML = axesGroup.visible ? 'Hide Axes <span class="button-shortcut">A</span>' : 'Show Axes <span class="button-shortcut">A</span>';
            }
        }
    }

    private setUpVector(upVector: THREE.Vector3): void {
        console.log(`🔄 Setting up vector to: [${upVector.x}, ${upVector.y}, ${upVector.z}]`);
        
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

    private resetCameraAndUpVector(): void {
        console.log('🔄 Resetting camera and up vector to defaults');
        
        // Reset up vector to Y-up
        this.camera.up.set(0, 1, 0);
        
        // Reset camera position and target if we have objects
        if (this.meshes.length > 0) {
            this.fitCameraToAllObjects();
        } else {
            // Default camera position if no objects
            this.camera.position.set(0, 0, 5);
            this.camera.lookAt(0, 0, 0);
            this.controls.target.set(0, 0, 0);
        }
        
        // Update controls (works for both TrackballControls and OrbitControls)
        this.controls.update();
        
        // Update axes helper
        this.updateAxesForUpVector(new THREE.Vector3(0, 1, 0));
        
        console.log('✅ Camera and up vector reset completed');
    }

    private showUpVectorFeedback(upVector: THREE.Vector3): void {
        const axisName = upVector.x === 1 ? 'X' : upVector.y === 1 ? 'Y' : upVector.z === 1 ? 'Z' : 'Custom';
        console.log(`Up vector set to ${axisName}-axis: [${upVector.x.toFixed(1)}, ${upVector.y.toFixed(1)}, ${upVector.z.toFixed(1)}]`);
    }

    private updateAxesForUpVector(upVector: THREE.Vector3): void {
        // Update the axes helper orientation to match the new up vector
        const axesGroup = (this as any).axesGroup;
        if (axesGroup) {
            // Simple approach: just update the axes to reflect the current coordinate system
            console.log(`🎯 Axes updated for up vector: [${upVector.x}, ${upVector.y}, ${upVector.z}]`);
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
        console.log('⌨️ Keyboard shortcuts:');
        console.log('  X: Set X-up');
        console.log('  Y: Set Y-up (default)');
        console.log('  Z: Set Z-up (CAD style)');
        console.log('  R: Reset camera and up vector');
        console.log('  T: Switch to TrackballControls');
        console.log('  O: Switch to OrbitControls');
        console.log('  I: Switch to Inverse TrackballControls');
        console.log('  C: Set OpenCV camera convention (Y-down)');
        console.log('  B: Set Blender/OpenGL camera convention (Y-up)');
        console.log('  W: Set rotation center to world origin (0,0,0)');
        
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
            </div>
            <div style="font-weight: bold; margin: 8px 0 4px 0; color: var(--vscode-textLink-foreground);">📷 Camera Conventions</div>
            <div style="font-family: var(--vscode-editor-font-family); line-height: 1.4; margin-bottom: 8px;">
                <div><span id="opencv-camera" style="color: var(--vscode-textLink-foreground); cursor: pointer; text-decoration: underline;">OpenCV (Y↓) [C]</span></div>
                <div><span id="blender-camera" style="color: var(--vscode-textLink-foreground); cursor: pointer; text-decoration: underline;">Blender/OpenGL (Y↑) [B]</span></div>
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
                case 'startLoading':
                    this.showImmediateLoading(message.fileName);
                    break;
                case 'timingUpdate':
                    console.log(message.message);
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
                case 'tifData':
                    this.handleTifData(message);
                    break;
                case 'xyzData':
                    this.handleXyzData(message);
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
            }
        });
    }

    private async displayFiles(dataArray: PlyData[]): Promise<void> {
        console.log(`📁 Displaying ${dataArray.length} PLY file(s)`);
        
        // Add new files to the existing array
        this.addNewFiles(dataArray);
        
        // Update UI
        this.updateFileStats();
        this.updateFileList();
        this.updateCameraControlsPanel();
        
        // Fit camera to show all objects
        this.fitCameraToAllObjects();
        
        // Hide loading indicator and clear any errors
        document.getElementById('loading')?.classList.add('hidden');
        this.clearError();
    }

    private async yieldToUI(): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    private createMaterialForFile(data: PlyData, fileIndex: number): THREE.Material {
        const colorMode = this.individualColorModes[fileIndex] || 'assigned';
        
        if (data.faceCount > 0) {
            // Mesh material
            const material = new THREE.MeshLambertMaterial();
            
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
        } else {
            // Points material
            const material = new THREE.PointsMaterial();
            
            // Initialize point size if not set
            if (!this.pointSizes[fileIndex]) {
                this.pointSizes[fileIndex] = 0.001;  // Default point size for better visibility
            }
            
            material.size = this.pointSizes[fileIndex];
            material.sizeAttenuation = true; // Always use distance-based scaling
            
            // Improve point rendering quality
            material.transparent = true;
            material.alphaTest = 0.1; // Helps with point edge quality
            
            console.log(`📍 Created PointsMaterial for file ${fileIndex}: size=${material.size}, sizeAttenuation=${material.sizeAttenuation}`);
            
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
        if (this.meshes.length === 0) {return;}

        const box = new THREE.Box3();
        for (const mesh of this.meshes) {
            box.expandByObject(mesh);
        }

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
        
        if (this.plyFiles.length === 0) {
            statsDiv.innerHTML = '<div>No files loaded</div>';
            // Also clear camera matrix panel
            const cameraPanel = document.getElementById('camera-matrix-panel');
            if (cameraPanel) cameraPanel.innerHTML = '';
            return;
        }
        
        if (this.plyFiles.length === 1) {
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
                ${data.comments.length > 0 ? `<div><strong>Comments:</strong><br>${data.comments.join('<br>')}</div>` : ''}
            `;
        } else {
            // Multiple files view
            const totalVertices = this.plyFiles.reduce((sum: number, data: PlyData) => sum + data.vertexCount, 0);
            const totalFaces = this.plyFiles.reduce((sum: number, data: PlyData) => sum + data.faceCount, 0);
            
            statsDiv.innerHTML = `
                <div><strong>Total Files:</strong> ${this.plyFiles.length}</div>
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

        if (this.plyFiles.length === 0) {
            fileListDiv.innerHTML = '<div class="no-files">No PLY files loaded</div>';
            return;
        }

        let html = '';
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
                    
                    ${this.isTifDerivedFile(data) ? `
                    <!-- TIF Settings (First) -->
                    <div class="tif-controls" style="margin-top: 8px;">
                        <button class="tif-settings-toggle" data-file-index="${i}" style="background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 1px solid var(--vscode-panel-border); padding: 4px 8px; border-radius: 2px; cursor: pointer; font-size: 11px; width: 100%;">
                            <span class="toggle-icon">▶</span> TIF Settings
                        </button>
                        <div class="tif-settings-panel" id="tif-panel-${i}" style="display:none; margin-top: 8px; padding: 8px; background: var(--vscode-input-background); border: 1px solid var(--vscode-panel-border); border-radius: 2px;">
                            <div class="tif-group" style="margin-bottom: 8px;">
                                <label for="camera-model-${i}" style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">Camera Model:</label>
                                <select id="camera-model-${i}" style="width: 100%; padding: 2px; font-size: 11px;">
                                    <option value="pinhole" ${this.getTifSetting(data, 'camera').includes('pinhole') ? 'selected' : ''}>Pinhole</option>
                                    <option value="fisheye" ${this.getTifSetting(data, 'camera').includes('fisheye') ? 'selected' : ''}>Fisheye</option>
                                </select>
                            </div>
                            <div class="tif-group" style="margin-bottom: 8px;">
                                <label for="focal-length-${i}" style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">Focal Length (px):</label>
                                <input type="number" id="focal-length-${i}" value="${this.getTifFocalLength(data)}" min="1" step="0.1" style="width: 100%; padding: 2px; font-size: 11px;">
                            </div>
                            <div class="tif-group" style="margin-bottom: 8px;">
                                <label for="depth-type-${i}" style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">Depth Type:</label>
                                <select id="depth-type-${i}" style="width: 100%; padding: 2px; font-size: 11px;">
                                    <option value="euclidean" ${this.getTifSetting(data, 'depth').includes('euclidean') ? 'selected' : ''}>Euclidean</option>
                                    <option value="orthogonal" ${this.getTifSetting(data, 'depth').includes('orthogonal') ? 'selected' : ''}>Orthogonal</option>
                                    <option value="disparity" ${this.getTifSetting(data, 'depth').includes('disparity') ? 'selected' : ''}>Disparity</option>
                                </select>
                            </div>
                            <div class="tif-group" id="baseline-group-${i}" style="margin-bottom: 8px; ${this.getTifSetting(data, 'depth').includes('disparity') ? '' : 'display:none;'}">
                                <label for="baseline-${i}" style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">Baseline (mm):</label>
                                <input type="number" id="baseline-${i}" value="${this.getTifBaseline(data)}" min="0.1" step="0.1" style="width: 100%; padding: 2px; font-size: 11px;">
                            </div>
                            <div class="tif-group" style="margin-bottom: 8px;">
                                <label style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">Color Image (optional):</label>
                                <button class="select-color-image" data-file-index="${i}" style="width: 100%; padding: 4px 8px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 11px; text-align: left;">📁 Select Color Image...</button>
                                ${this.getStoredColorImageName(i) ? `<div style="font-size: 9px; color: var(--vscode-textLink-foreground); margin-top: 2px; display: flex; align-items: center; gap: 4px;">📷 Current: ${this.getStoredColorImageName(i)} <button class="remove-color-image" data-file-index="${i}" style="font-size: 8px; padding: 1px 4px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer;">✕</button></div>` : ''}
                            </div>
                            <div class="tif-group" style="margin-bottom: 8px;">
                                <div style="display: flex; gap: 4px;">
                                    <button class="apply-tif-settings" data-file-index="${i}" style="flex: 1; padding: 4px 8px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 11px;">Apply Settings</button>
                                    <button class="save-ply-file" data-file-index="${i}" style="flex: 1; padding: 4px 8px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 11px;">💾 Save PLY</button>
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
                    
                    ${data.faceCount === 0 ? `
                    <!-- Point Size Control (Third) -->
                    <div class="point-size-control">
                        <label for="size-${i}">Point Size:</label>
                        <input type="range" id="size-${i}" min="0.00001" max="0.01" step="0.00001" value="${this.pointSizes[i] || 0.001}" class="size-slider">
                        <span class="size-value">${(this.pointSizes[i] || 0.001).toFixed(5)}</span>
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
        
        fileListDiv.innerHTML = html;
        
        // Add event listeners after setting innerHTML  
        for (let i = 0; i < this.plyFiles.length; i++) {
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
            
            // Transform toggle logic with improved UI
            const transformBtn = document.querySelector(`.transform-toggle[data-file-index="${i}"]`);
            const transformPanel = document.getElementById(`transform-panel-${i}`);
            if (transformBtn && transformPanel) {
                // Always hide by default and set triangle to side
                transformPanel.style.display = 'none';
                const toggleIcon = transformBtn.querySelector('.toggle-icon');
                if (toggleIcon) toggleIcon.textContent = '▶';
                
                transformBtn.addEventListener('click', () => {
                    const isVisible = transformPanel.style.display !== 'none';
                    transformPanel.style.display = isVisible ? 'none' : 'block';
                    if (toggleIcon) toggleIcon.textContent = isVisible ? '▶' : '▼';
                });
            }
            
            // Apply matrix logic with improved parsing
            const applyBtn = document.querySelector(`.apply-matrix[data-file-index="${i}"]`);
            if (applyBtn && transformPanel) {
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
            
            // Add size slider listeners for point clouds
            const sizeSlider = document.getElementById(`size-${i}`) as HTMLInputElement;
            if (sizeSlider && this.plyFiles[i].faceCount === 0) {
                sizeSlider.addEventListener('input', (e) => {
                    const newSize = parseFloat((e.target as HTMLInputElement).value);
                    this.updatePointSize(i, newSize);
                    
                    // Update the displayed value
                    const sizeValue = document.querySelector(`#size-${i} + .size-value`) as HTMLElement;
                    if (sizeValue) {
                        sizeValue.textContent = newSize.toFixed(5);
                    }
                });
            }
            
            // Color selector listeners
            const colorSelector = document.getElementById(`color-${i}`) as HTMLSelectElement;
            if (colorSelector) {
                colorSelector.addEventListener('change', () => {
                    const value = colorSelector.value;
                    
                    if (i >= 0 && i < this.individualColorModes.length) {
                        this.individualColorModes[i] = value;
                        
                        // Recreate material with new color mode
                        if (i < this.plyFiles.length && i < this.meshes.length) {
                            const oldMaterial = this.meshes[i].material;
                            const newMaterial = this.createMaterialForFile(this.plyFiles[i], i);
                            this.meshes[i].material = newMaterial;
                            
                            // Dispose of old material to prevent memory leaks
                            if (oldMaterial) {
                                if (Array.isArray(oldMaterial)) {
                                    oldMaterial.forEach(mat => mat.dispose());
                                } else {
                                    oldMaterial.dispose();
                                }
                            }
                        }
                    }
                });
            }

            // TIF settings toggle and controls
            if (this.isTifDerivedFile(this.plyFiles[i])) {
                const tifToggleBtn = document.querySelector(`.tif-settings-toggle[data-file-index="${i}"]`);
                const tifPanel = document.getElementById(`tif-panel-${i}`);
                if (tifToggleBtn && tifPanel) {
                    // Hide by default
                    tifPanel.style.display = 'none';
                    const toggleIcon = tifToggleBtn.querySelector('.toggle-icon');
                    if (toggleIcon) toggleIcon.textContent = '▶';
                    
                    tifToggleBtn.addEventListener('click', () => {
                        const isVisible = tifPanel.style.display !== 'none';
                        tifPanel.style.display = isVisible ? 'none' : 'block';
                        if (toggleIcon) toggleIcon.textContent = isVisible ? '▶' : '▼';
                    });
                }

                // Depth type change handler for baseline visibility
                const depthTypeSelect = document.getElementById(`depth-type-${i}`) as HTMLSelectElement;
                const baselineGroup = document.getElementById(`baseline-group-${i}`);
                if (depthTypeSelect && baselineGroup) {
                    depthTypeSelect.addEventListener('change', () => {
                        baselineGroup.style.display = depthTypeSelect.value === 'disparity' ? '' : 'none';
                    });
                }

                // Apply TIF settings button
                const applyTifBtn = document.querySelector(`.apply-tif-settings[data-file-index="${i}"]`);
                if (applyTifBtn) {
                    applyTifBtn.addEventListener('click', async () => {
                        await this.applyTifSettings(i);
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
                        this.requestColorImageForTif(i);
                    });
                }

                // Remove color image button
                const removeColorBtn = document.querySelector(`.remove-color-image[data-file-index="${i}"]`);
                if (removeColorBtn) {
                    removeColorBtn.addEventListener('click', async () => {
                        await this.removeColorImageFromTif(i);
                    });
                }
            }
        }
        
        // Add remove button listeners
        const removeButtons = fileListDiv.querySelectorAll('.remove-file');
        removeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const fileIndex = parseInt((e.target as HTMLElement).getAttribute('data-file-index') || '0');
                this.requestRemoveFile(fileIndex);
            });
        });
    }

    private toggleFileVisibility(fileIndex: number): void {
        if (fileIndex >= 0 && fileIndex < this.meshes.length) {
            this.fileVisibility[fileIndex] = !this.fileVisibility[fileIndex];
            this.meshes[fileIndex].visible = this.fileVisibility[fileIndex];
        }
    }

    private toggleColorMode(): void {
        this.useOriginalColors = !this.useOriginalColors;
        console.log('Toggling color mode to:', this.useOriginalColors ? 'Original Colors' : 'Assigned Colors');
        
        // Recreate materials for all meshes
        for (let i = 0; i < this.meshes.length; i++) {
            const oldMaterial = this.meshes[i].material;
            const newMaterial = this.createMaterialForFile(this.plyFiles[i], i);
            this.meshes[i].material = newMaterial;
            
            // Dispose of old material to prevent memory leaks
            if (oldMaterial) {
                if (Array.isArray(oldMaterial)) {
                    oldMaterial.forEach(mat => mat.dispose());
                } else {
                    oldMaterial.dispose();
                }
            }
        }
        
        // Update the file list to show current color mode
        this.updateFileList();
    }

    private showImmediateLoading(fileName: string): void {
        const uiStartTime = performance.now();
        console.log(`🎬 UI: Showing immediate loading for ${fileName} at ${uiStartTime.toFixed(1)}ms`);
        
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
                console.log('✅ Error close button found');
                if (!closeBtn.hasAttribute('data-listener-added')) {
                    closeBtn.setAttribute('data-listener-added', 'true');
                    closeBtn.addEventListener('click', () => {
                        console.log('🔴 Error close button clicked');
                        this.clearError();
                    });
                    console.log('✅ Error close button listener added');
                } else {
                    console.log('ℹ️ Error close button listener already exists');
                }
            } else {
                console.warn('⚠️ Error close button not found!');
            }
        }
        
        console.error('Error displayed:', message);
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

    private requestColorImageForTif(fileIndex: number): void {
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
            
            // Initialize color mode before creating material
            const initialColorMode = this.useOriginalColors ? 'original' : 'assigned';
            this.individualColorModes.push(initialColorMode);
            console.log(`Initializing file ${data.fileIndex} with color mode: ${initialColorMode}, useOriginalColors: ${this.useOriginalColors}, hasColors: ${data.hasColors}`);
            
            // Create geometry and material
            const geometry = this.createGeometryFromPlyData(data);
            const material = this.createMaterialForFile(data, data.fileIndex);
            
            // Create mesh
            const shouldShowAsPoints = data.faceCount === 0;
            const mesh = shouldShowAsPoints ?
                new THREE.Points(geometry, material) :
                new THREE.Mesh(geometry, material);
            
            this.scene.add(mesh);
            this.meshes.push(mesh);
            this.fileVisibility.push(true);
            this.pointSizes.push(0.001); // Default point size for good visibility
            
            // Initialize transformation matrix for this file
            this.transformationMatrices.push(new THREE.Matrix4());
        }

        // Update UI
        this.updateFileList();
        this.updateFileStats();

        console.log(`Added ${newFiles.length} new files`);
    }

    private removeFileByIndex(fileIndex: number): void {
        if (fileIndex < 0 || fileIndex >= this.plyFiles.length) {
            return;
        }

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
        
        // Remove TIF data if it exists for this file
        this.fileTifData.delete(fileIndex);
        
        // Update TIF data indices for remaining files (shift down)
        const newTifData = new Map<number, any>();
        for (const [key, value] of this.fileTifData) {
            if (key > fileIndex) {
                newTifData.set(key - 1, value);
            } else if (key < fileIndex) {
                newTifData.set(key, value);
            }
        }
        this.fileTifData = newTifData;

        // Reassign file indices
        for (let i = 0; i < this.plyFiles.length; i++) {
            this.plyFiles[i].fileIndex = i;
        }

        // Update UI
        this.updateFileList();
        this.updateFileStats();
        
        console.log(`Removed file at index ${fileIndex}`);
    }

    private async handleUltimateRawBinaryData(message: any): Promise<void> {
        console.log(`🚀 ULTIMATE: Parsing raw binary data in webview for ${message.fileName}`);
        const startTime = performance.now();
        
        // Parse raw binary data directly in webview
        const rawData = new Uint8Array(message.rawBinaryData);
        const dataView = new DataView(rawData.buffer);
        const propertyOffsets = new Map(message.propertyOffsets);
        const vertexStride = message.vertexStride;
        const vertexCount = message.vertexCount;
        const littleEndian = message.littleEndian;
        
        console.log(`⚡ ULTIMATE: Direct binary parsing ${vertexCount} vertices (${vertexStride} bytes/vertex)`);
        
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
        console.log(`🎯 ULTIMATE: Webview binary parsing took ${(parseTime - startTime).toFixed(1)}ms`);
        
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
        
        console.log(`⚡ ULTIMATE: Total webview processing took ${(performance.now() - startTime).toFixed(1)}ms`);
        
        // Process as normal
        const displayStartTime = performance.now();
        if (message.messageType === 'multiPlyData') {
            await this.displayFiles([plyData]);
        } else if (message.messageType === 'addFiles') {
            this.addNewFiles([plyData]);
        }
        const displayTime = performance.now() - displayStartTime;
        
        // Comprehensive timing analysis
        // For add files, use message receive time as absolute start since there's no UI loading phase
        const absoluteStartTime = message.messageType === 'addFiles' ? startTime : ((window as any).absoluteStartTime || startTime);
        const absoluteCompleteTime = performance.now() - absoluteStartTime;
        const webviewCompleteTime = performance.now() - startTime;
        
        console.log(`🎯 ULTIMATE COMPLETE TIME: ${webviewCompleteTime.toFixed(1)}ms (Data received → Point cloud visible)`);
        
        if (message.messageType === 'addFiles') {
            console.log(`⏰ ADD FILE TOTAL TIME: ${absoluteCompleteTime.toFixed(1)}ms (Add button → Point cloud visible)`);
        } else {
            console.log(`⏰ ABSOLUTE TOTAL TIME: ${absoluteCompleteTime.toFixed(1)}ms (File open → Point cloud visible)`);
        }
        
        // Calculate performance metrics
        const totalVertices = message.vertexCount;
        const verticesPerSecond = Math.round(totalVertices / (absoluteCompleteTime / 1000));
        const modeLabel = message.messageType === 'addFiles' ? 'ADD FILE' : 'ULTIMATE';
        console.log(`🚀 ${modeLabel} PERFORMANCE: ${totalVertices.toLocaleString()} vertices in ${absoluteCompleteTime.toFixed(1)}ms (${verticesPerSecond.toLocaleString()} vertices/sec)`);
    }

    private async handleDirectTypedArrayData(message: any): Promise<void> {
        console.log(`🚀 REVOLUTIONARY: Handling direct TypedArray data for ${message.fileName}`);
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
        
        console.log(`⚡ Direct TypedArray reconstruction took ${(performance.now() - startTime).toFixed(1)}ms`);
        
        // Process as normal - but now with TypedArrays!
        if (message.messageType === 'multiPlyData') {
            await this.displayFiles([plyData]);
        } else if (message.messageType === 'addFiles') {
            this.addNewFiles([plyData]);
        }
    }

    private async handleBinaryPlyData(message: any): Promise<void> {
        const receiveTime = performance.now();
        // For add files, we don't have a loadingStartTime, so use receiveTime as reference
        const loadingStartTime = (window as any).loadingStartTime || receiveTime;
        const extensionProcessingTime = receiveTime - loadingStartTime;
        
        console.log(`📦 Received binary PLY data for ${message.fileName} (${message.vertexCount} vertices)`);
        console.log(`⏱️ Extension processing took: ${extensionProcessingTime.toFixed(1)}ms (UI→Data received)`);
        
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
            const faceCount = indexArray.length / 3; // Assuming triangles
            
            for (let i = 0; i < faceCount; i++) {
                plyData.faces.push({
                    indices: [
                        indexArray[i * 3],
                        indexArray[i * 3 + 1],
                        indexArray[i * 3 + 2]
                    ]
                });
            }
        }
        
        const conversionTime = performance.now() - startTime;
        console.log(`⚡ Binary conversion took ${conversionTime.toFixed(1)}ms`);
        
        // Handle based on message type
        if (message.messageType === 'addFiles') {
            this.addNewFiles([plyData]);
        } else {
            await this.displayFiles([plyData]);
        }
        
        // Complete timing analysis
        const totalTime = performance.now();
        const completeLoadTime = totalTime - loadingStartTime;
        // For add files, use receive time as absolute start since there's no UI loading phase
        const absoluteStartTime = message.messageType === 'addFiles' ? receiveTime : ((window as any).absoluteStartTime || loadingStartTime);
        const absoluteCompleteTime = totalTime - absoluteStartTime;
        const geometryTime = totalTime - startTime - conversionTime;
        
        console.log(`🎯 COMPLETE LOADING TIME: ${completeLoadTime.toFixed(1)}ms (UI show → Point cloud visible)`);
        console.log(`⏰ ABSOLUTE TOTAL TIME: ${absoluteCompleteTime.toFixed(1)}ms (File open → Point cloud visible)`);
        console.log(`📊 Breakdown: Extension ${extensionProcessingTime.toFixed(1)}ms + Conversion ${conversionTime.toFixed(1)}ms + Geometry ${geometryTime.toFixed(1)}ms`);
        
        // Calculate hidden time gaps
        const measuredTime = extensionProcessingTime + conversionTime + geometryTime;
        const hiddenTime = completeLoadTime - measuredTime;
        if (hiddenTime > 10) {
            console.log(`🔍 HIDDEN TIME: ${hiddenTime.toFixed(1)}ms (unmeasured overhead)`);
        }
        
        // Performance summary
        const totalVertices = message.vertexCount;
        const verticesPerSecond = Math.round(totalVertices / (absoluteCompleteTime / 1000));
        console.log(`🚀 PERFORMANCE: ${totalVertices.toLocaleString()} vertices in ${absoluteCompleteTime.toFixed(1)}ms (${verticesPerSecond.toLocaleString()} vertices/sec)`);
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

        console.log(`📊 Chunked loading timing for ${message.fileName}:`);
        console.log(`  • Total transfer time: ${totalTransferTime.toFixed(2)}ms`);
        console.log(`  • Time to first chunk: ${firstChunkDelay.toFixed(2)}ms`);
        console.log(`  • Chunk transfer time: ${transferTime.toFixed(2)}ms`);
        console.log(`  • Chunks: ${fileState.totalChunks} (${(transferTime / fileState.totalChunks).toFixed(2)}ms avg)`);

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
        console.log(`  • PLY assembly time: ${assemblyTime.toFixed(2)}ms`);

        // Process the completed file based on original message type
        const processStartTime = performance.now();
        if (message.messageType === 'multiPlyData') {
            await this.displayFiles([plyData]);
        } else if (message.messageType === 'addFiles') {
            this.addNewFiles([plyData]);
        }
        const processTime = performance.now() - processStartTime;
        
        const totalTime = performance.now() - fileState.startTime;
        console.log(`  • File processing time: ${processTime.toFixed(2)}ms`);
        console.log(`  • TOTAL TIME: ${totalTime.toFixed(2)}ms`);

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
            
            // Update the material if it's a Points material
            const mesh = this.meshes[fileIndex];
            if (mesh instanceof THREE.Points && mesh.material instanceof THREE.PointsMaterial) {
                mesh.material.size = newSize;
                console.log(`✅ Point size applied to material for file ${fileIndex}: ${newSize}`);
            } else {
                console.warn(`⚠️ Could not apply point size for file ${fileIndex}: mesh is not Points or material is not PointsMaterial`);
                console.log(`Mesh type: ${mesh?.constructor.name}, Material type: ${mesh?.material?.constructor.name}`);
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

    private soloPointCloud(fileIndex: number): void {
        // Hide all point clouds first
        for (let i = 0; i < this.meshes.length; i++) {
            this.fileVisibility[i] = false;
            this.meshes[i].visible = false;
        }
        
        // Show only the selected point cloud
        if (fileIndex >= 0 && fileIndex < this.meshes.length) {
            this.fileVisibility[fileIndex] = true;
            this.meshes[fileIndex].visible = true;
        }
        
        // Update checkboxes to reflect the new state
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
            { id: 'inverse-trackball-controls', type: 'inverse-trackball' }
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

    private setBlenderOpenGLCameraConvention(): void {
        console.log('📷 Setting camera to Blender/OpenGL convention (Y-up, Z-backward)');
        
        // Blender/OpenGL convention: Y-up, Z-backward
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
        
        // Update axes helper to reflect Blender/OpenGL convention
        this.updateAxesForCameraConvention('blender');
        
        // Show feedback
        this.showCameraConventionFeedback('Blender/OpenGL');
    }

    private updateAxesForCameraConvention(convention: 'opencv' | 'blender'): void {
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
        const color = convention === 'OpenCV' ? 0xff0000 : 0x00ff00; // Red for OpenCV, Green for Blender
        
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
                <label style="display:block;margin-bottom:5px;">Translation Amount:</label>
                <input type="number" id="translation-amount" value="1" step="0.1" style="width:100%;padding:5px;">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:5px;">Direction:</label>
                <div style="display:flex;gap:10px;margin-top:5px;">
                    <button id="translate-x" style="flex:1;padding:8px;background:#f0f0f0;border:1px solid #ccc;border-radius:4px;">X Axis</button>
                    <button id="translate-y" style="flex:1;padding:8px;background:#f0f0f0;border:1px solid #ccc;border-radius:4px;">Y Axis</button>
                    <button id="translate-z" style="flex:1;padding:8px;background:#f0f0f0;border:1px solid #ccc;border-radius:4px;">Z Axis</button>
                </div>
            </div>
            <div style="text-align:right;">
                <button id="cancel-translation" style="margin-right:10px;padding:8px 15px;">Cancel</button>
            </div>
        `;
        
        modal.appendChild(dialog);
        document.body.appendChild(modal);
        
        const closeModal = () => {
            modal.remove();
        };
        
        const cancelBtn = dialog.querySelector('#cancel-translation');
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', closeModal);
        }
        
        // Translation direction buttons
        const translateXBtn = dialog.querySelector('#translate-x');
        const translateYBtn = dialog.querySelector('#translate-y');
        const translateZBtn = dialog.querySelector('#translate-z');
        
        const applyTranslation = (x: number, y: number, z: number) => {
            const amount = parseFloat((dialog.querySelector('#translation-amount') as HTMLInputElement).value);
            if (!isNaN(amount)) {
                this.addTranslationToMatrix(fileIndex, x * amount, y * amount, z * amount);
                this.updateMatrixTextarea(fileIndex);
            }
            closeModal();
        };
        
        if (translateXBtn) {
            translateXBtn.addEventListener('click', () => applyTranslation(1, 0, 0));
        }
        
        if (translateYBtn) {
            translateYBtn.addEventListener('click', () => applyTranslation(0, 1, 0));
        }
        
        if (translateZBtn) {
            translateZBtn.addEventListener('click', () => applyTranslation(0, 0, 1));
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
                <label style="display:block;margin-bottom:5px;">Quaternion X:</label>
                <input type="number" id="quaternion-x" value="0" step="0.1" style="width:100%;padding:5px;">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:5px;">Quaternion Y:</label>
                <input type="number" id="quaternion-y" value="0" step="0.1" style="width:100%;padding:5px;">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:5px;">Quaternion Z:</label>
                <input type="number" id="quaternion-z" value="0" step="0.1" style="width:100%;padding:5px;">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:5px;">Quaternion W:</label>
                <input type="number" id="quaternion-w" value="1" step="0.1" style="width:100%;padding:5px;">
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
                const x = parseFloat((dialog.querySelector('#quaternion-x') as HTMLInputElement).value);
                const y = parseFloat((dialog.querySelector('#quaternion-y') as HTMLInputElement).value);
                const z = parseFloat((dialog.querySelector('#quaternion-z') as HTMLInputElement).value);
                const w = parseFloat((dialog.querySelector('#quaternion-w') as HTMLInputElement).value);
                
                if (!isNaN(x) && !isNaN(y) && !isNaN(z) && !isNaN(w)) {
                    const quaternionMatrix = this.createQuaternionMatrix(x, y, z, w);
                    this.multiplyTransformationMatrices(fileIndex, quaternionMatrix);
                    this.updateMatrixTextarea(fileIndex);
                }
                
                closeModal();
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
                <label style="display:block;margin-bottom:5px;">Axis X:</label>
                <input type="number" id="axis-x" value="0" step="0.1" style="width:100%;padding:5px;">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:5px;">Axis Y:</label>
                <input type="number" id="axis-y" value="1" step="0.1" style="width:100%;padding:5px;">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:5px;">Axis Z:</label>
                <input type="number" id="axis-z" value="0" step="0.1" style="width:100%;padding:5px;">
            </div>
            <div style="margin-bottom: 20px;">
                <label style="display:block;margin-bottom:5px;">Angle (degrees):</label>
                <input type="number" id="angle-degrees" value="90" step="1" min="0" max="360" style="width:100%;padding:5px;">
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
                const axisX = parseFloat((dialog.querySelector('#axis-x') as HTMLInputElement).value);
                const axisY = parseFloat((dialog.querySelector('#axis-y') as HTMLInputElement).value);
                const axisZ = parseFloat((dialog.querySelector('#axis-z') as HTMLInputElement).value);
                const angleDegrees = parseFloat((dialog.querySelector('#angle-degrees') as HTMLInputElement).value);
                
                if (!isNaN(axisX) && !isNaN(axisY) && !isNaN(axisZ) && !isNaN(angleDegrees)) {
                    const axis = new THREE.Vector3(axisX, axisY, axisZ);
                    const angle = (angleDegrees * Math.PI) / 180; // Convert to radians
                    const angleAxisMatrix = this.createAngleAxisMatrix(axis, angle);
                    this.multiplyTransformationMatrices(fileIndex, angleAxisMatrix);
                    this.updateMatrixTextarea(fileIndex);
                }
                
                closeModal();
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
                <label style="display:block;margin-bottom:5px;">X Position:</label>
                <input type="number" id="camera-pos-x" value="${currentPos.x.toFixed(3)}" step="0.1" style="width:100%;padding:5px;">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:5px;">Y Position:</label>
                <input type="number" id="camera-pos-y" value="${currentPos.y.toFixed(3)}" step="0.1" style="width:100%;padding:5px;">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:5px;">Z Position:</label>
                <input type="number" id="camera-pos-z" value="${currentPos.z.toFixed(3)}" step="0.1" style="width:100%;padding:5px;">
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
                (dialog.querySelector('#camera-pos-x') as HTMLInputElement).value = '0';
                (dialog.querySelector('#camera-pos-y') as HTMLInputElement).value = '0';
                (dialog.querySelector('#camera-pos-z') as HTMLInputElement).value = '0';
            });
        }
        
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const x = parseFloat((dialog.querySelector('#camera-pos-x') as HTMLInputElement).value);
                const y = parseFloat((dialog.querySelector('#camera-pos-y') as HTMLInputElement).value);
                const z = parseFloat((dialog.querySelector('#camera-pos-z') as HTMLInputElement).value);
                
                if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                    // Store current camera orientation
                    const currentQuaternion = this.camera.quaternion.clone();
                    const currentTarget = this.controls.target.clone();
                    
                    // Update position
                    this.camera.position.set(x, y, z);
                    
                    // Restore orientation
                    this.camera.quaternion.copy(currentQuaternion);
                    
                    // Update controls target to maintain proper orientation
                    const direction = new THREE.Vector3(0, 0, -1);
                    direction.applyQuaternion(currentQuaternion);
                    this.controls.target.copy(this.camera.position.clone().add(direction));
                    
                    this.controls.update();
                    this.updateCameraControlsPanel();
                }
                
                closeModal();
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
                <label style="display:block;margin-bottom:5px;">X Rotation (degrees):</label>
                <input type="number" id="camera-rot-x" value="${rotX.toFixed(1)}" step="1" style="width:100%;padding:5px;">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:5px;">Y Rotation (degrees):</label>
                <input type="number" id="camera-rot-y" value="${rotY.toFixed(1)}" step="1" style="width:100%;padding:5px;">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:5px;">Z Rotation (degrees):</label>
                <input type="number" id="camera-rot-z" value="${rotZ.toFixed(1)}" step="1" style="width:100%;padding:5px;">
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
                (dialog.querySelector('#camera-rot-x') as HTMLInputElement).value = '0';
                (dialog.querySelector('#camera-rot-y') as HTMLInputElement).value = '0';
                (dialog.querySelector('#camera-rot-z') as HTMLInputElement).value = '0';
            });
        }
        
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const x = parseFloat((dialog.querySelector('#camera-rot-x') as HTMLInputElement).value);
                const y = parseFloat((dialog.querySelector('#camera-rot-y') as HTMLInputElement).value);
                const z = parseFloat((dialog.querySelector('#camera-rot-z') as HTMLInputElement).value);
                
                if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                    // Store current camera distance from target for orbit controls
                    const target = this.controls.target.clone();
                    const distance = this.camera.position.distanceTo(target);
                    
                    // Create quaternion from Euler angles
                    const euler = new THREE.Euler(
                        (x * Math.PI) / 180,
                        (y * Math.PI) / 180,
                        (z * Math.PI) / 180,
                        'XYZ'
                    );
                    const quaternion = new THREE.Quaternion();
                    quaternion.setFromEuler(euler);
                    
                    // Apply rotation by positioning camera relative to target
                    // Start with a forward vector and apply rotation
                    const direction = new THREE.Vector3(0, 0, distance);
                    direction.applyQuaternion(quaternion);
                    
                    // Position camera at target + rotated direction vector
                    this.camera.position.copy(target).add(direction);
                    
                    // Set up vector based on rotation (extract up vector from quaternion)
                    const up = new THREE.Vector3(0, 1, 0);
                    up.applyQuaternion(quaternion);
                    this.camera.up.copy(up);
                    
                    // Make camera look at target
                    this.camera.lookAt(target);
                    
                    this.controls.update();
                    this.updateCameraControlsPanel();
                }
                
                closeModal();
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
                <label style="display:block;margin-bottom:5px;">X Coordinate:</label>
                <input type="number" id="rotation-center-x" value="${target.x.toFixed(3)}" step="0.1" style="width:100%;padding:5px;">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:5px;">Y Coordinate:</label>
                <input type="number" id="rotation-center-y" value="${target.y.toFixed(3)}" step="0.1" style="width:100%;padding:5px;">
            </div>
            <div style="margin-bottom: 15px;">
                <label style="display:block;margin-bottom:5px;">Z Coordinate:</label>
                <input type="number" id="rotation-center-z" value="${target.z.toFixed(3)}" step="0.1" style="width:100%;padding:5px;">
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
                (dialog.querySelector('#rotation-center-x') as HTMLInputElement).value = '0';
                (dialog.querySelector('#rotation-center-y') as HTMLInputElement).value = '0';
                (dialog.querySelector('#rotation-center-z') as HTMLInputElement).value = '0';
            });
        }
        
        if (cancelBtn) {
            cancelBtn.addEventListener('click', closeModal);
        }
        
        if (applyBtn) {
            applyBtn.addEventListener('click', () => {
                const x = parseFloat((dialog.querySelector('#rotation-center-x') as HTMLInputElement).value);
                const y = parseFloat((dialog.querySelector('#rotation-center-y') as HTMLInputElement).value);
                const z = parseFloat((dialog.querySelector('#rotation-center-z') as HTMLInputElement).value);
                
                if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
                    // Set the new rotation center
                    this.controls.target.set(x, y, z);
                    
                    // Update controls and camera panel
                    this.controls.update();
                    this.updateCameraControlsPanel();
                    
                    // Update axes position to show new rotation center
                    if ((this as any).axesHelper) {
                        (this as any).axesHelper.position.copy(this.controls.target);
                    }
                    
                    console.log(`🎯 Rotation center set to: (${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)})`);
                }
                
                closeModal();
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

    private async handleTifData(message: any): Promise<void> {
        try {
            console.log('Received TIF data for processing:', message.fileName);
            
            // Generate unique request ID for this TIF file
            const requestId = `tif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            
            // Store TIF data in the map
            this.pendingTifFiles.set(requestId, {
                data: message.data,
                fileName: message.fileName,
                isAddFile: message.isAddFile || false,
                requestId: requestId
            });
            
            // First, analyze the TIF to determine if it's a depth image or regular image
            const tiff = await GeoTIFF.fromArrayBuffer(message.data);
            const image = await tiff.getImage();
            
            const width = image.getWidth();
            const height = image.getHeight();
            const samplesPerPixel = image.getSamplesPerPixel();
            const sampleFormat = image.getSampleFormat ? image.getSampleFormat() : null;
            const bitsPerSample = image.getBitsPerSample();
            
            console.log(`TIF Analysis: ${width}x${height}, samples: ${samplesPerPixel}, format: ${sampleFormat}, bits: ${bitsPerSample}`);
            
            // Determine if this is a depth image or regular image
            const isDepthImage = this.isDepthTifImage(samplesPerPixel, sampleFormat, bitsPerSample);
            
            console.log(`🔍 TIF image classification: ${isDepthImage ? 'DEPTH/DISPARITY IMAGE' : 'REGULAR IMAGE'}`);
            
            if (isDepthImage) {
                console.log('Detected depth TIF image - checking for saved camera parameters...');
                
                // Check for saved camera parameters in localStorage
                const savedParams = this.loadSavedCameraParams();
                
                console.log(`🔍 Debug - localStorage key exists: ${!!localStorage.getItem('plyVisualizerCameraParams')}`);
                console.log(`🔍 Debug - savedParams: ${savedParams ? JSON.stringify(savedParams) : 'null'}`);
                console.log(`🔍 Debug - First TIF file: ${this.plyFiles.length === 0 ? 'YES' : 'NO'}`);
                console.log(`🔍 Debug - requestId: ${requestId}`);
                
                if (savedParams) {
                    console.log('✅ Using saved camera parameters:', savedParams);
                    this.showStatus(`Using saved settings: ${savedParams.cameraModel} camera, focal length ${savedParams.focalLength}px, ${savedParams.depthType} depth...`);
                    
                    // Use saved parameters directly
                    await this.processTifWithParams(requestId, savedParams);
                } else {
                    console.log('❓ No saved parameters found - requesting camera parameters from user');
                    
                    // Request camera parameters from the extension for depth conversion
                    this.vscode.postMessage({
                        type: 'requestCameraParams',
                        fileName: message.fileName,
                        requestId: requestId
                    });
                    
                    this.showStatus('Waiting for camera parameters...');
                }
            } else {
                const bitDepth = bitsPerSample && bitsPerSample.length > 0 ? bitsPerSample[0] : 'unknown';
                const formatDesc = sampleFormat === 3 ? 'float' : sampleFormat === 1 ? 'uint' : sampleFormat === 2 ? 'int' : 'unknown';
                
                console.log('Detected regular TIF image - not suitable for point cloud conversion');
                this.showError(`This TIF file appears to be a regular image (${samplesPerPixel} channel(s), ${bitDepth}-bit ${formatDesc}) rather than a depth/disparity image. Please use a single-channel depth TIF (floating-point) or disparity TIF (integer or floating-point) for point cloud conversion.`);
                
                // Remove from pending files since we won't process this
                this.pendingTifFiles.delete(requestId);
            }
            
        } catch (error) {
            console.error('Error handling TIF data:', error);
            this.showError(`Failed to process TIF data: ${error instanceof Error ? error.message : String(error)}`);
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
            if (!requestId || !this.pendingTifFiles.has(requestId)) {
                throw new Error('No TIF data available for processing');
            }

            console.log('Processing TIF with camera params:', message);
            
            const cameraParams: CameraParams = {
                cameraModel: message.cameraModel,
                focalLength: message.focalLength,
                depthType: message.depthType || 'euclidean', // Default to euclidean for backward compatibility
                baseline: message.baseline
            };

            // Save camera parameters for future use
            this.saveCameraParams(cameraParams);
            console.log('✅ Camera parameters saved for future TIF files');
            
            // Process the TIF file
            await this.processTifWithParams(requestId, cameraParams);
            
        } catch (error) {
            console.error('Error processing TIF with camera params:', error);
            this.showError(`TIF conversion failed: ${error instanceof Error ? error.message : String(error)}`);
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

    private async processTifWithParams(requestId: string, cameraParams: CameraParams): Promise<void> {
        const tifFileData = this.pendingTifFiles.get(requestId);
        if (!tifFileData) {
            throw new Error('TIF data not found for processing');
        }

        console.log('Processing TIF with camera params:', cameraParams);
        this.showStatus('Converting depth image to point cloud...');

        // Store original data for re-processing (for the first/current TIF file)
        this.originalTifData = tifFileData.data;
        this.originalTifFileName = tifFileData.fileName;
        this.currentCameraParams = cameraParams;

        // Process the TIF data
        const result = await this.processTifToPointCloud(tifFileData.data, cameraParams);
        
        // Store TIF dimensions for color validation
        const tiff = await GeoTIFF.fromArrayBuffer(tifFileData.data);
        const image = await tiff.getImage();
        this.tifDimensions = {
            width: image.getWidth(),
            height: image.getHeight()
        };

        // Store TIF data for this specific file (will be updated with fileIndex after adding to plyFiles)
        const tempTifData = {
            originalData: tifFileData.data,
            cameraParams: cameraParams,
            fileName: tifFileData.fileName,
            tifDimensions: this.tifDimensions
        };
        
        // Create PLY data structure
        const plyData: PlyData = {
            vertices: this.convertTifResultToVertices(result),
            faces: [],
            format: 'binary_little_endian',
            version: '1.0',
            comments: [
            `Converted from TIF depth image: ${tifFileData.fileName}`, 
            `Camera: ${cameraParams.cameraModel}`, 
            `Depth type: ${cameraParams.depthType}`,
            `Focal length: ${cameraParams.focalLength}px`,
            ...(cameraParams.baseline ? [`Baseline: ${cameraParams.baseline}mm`] : [])
        ],
            vertexCount: result.pointCount,
            faceCount: 0,
            hasColors: !!result.colors,
            hasNormals: false,
            fileName: tifFileData.fileName.replace(/\.(tif|tiff)$/i, '_pointcloud.ply'),
            fileIndex: this.plyFiles.length
        };

        // Add to visualization based on whether this is an add file or initial load
        if (tifFileData.isAddFile) {
            this.addNewFiles([plyData]);
            // Store TIF data for the newly added file
            const fileIndex = this.plyFiles.length - 1;
            this.fileTifData.set(fileIndex, tempTifData);
        } else {
            await this.displayFiles([plyData]);
            // Store TIF data for the replaced file (index 0)
            this.fileTifData.set(0, tempTifData);
        }
        
        // Remove from pending files
        this.pendingTifFiles.delete(requestId);
        
        // TIF file processed successfully
        const settingsSaved = localStorage.getItem('plyVisualizerCameraParams') ? true : false;
        this.showStatus(`TIF conversion completed successfully!${settingsSaved ? ' (Settings saved for future use)' : ''}`);
    }

    private handleCameraParamsCancelled(requestId?: string): void {
        console.log('Camera parameter selection cancelled');
        if (requestId && this.pendingTifFiles.has(requestId)) {
            // Remove only the specific cancelled TIF file
            const tifData = this.pendingTifFiles.get(requestId);
            this.pendingTifFiles.delete(requestId);
            this.showError(`TIF conversion cancelled for ${tifData?.fileName || 'file'}`);
        } else {
            // Fallback: clear all pending TIF files
            this.pendingTifFiles.clear();
            this.showError('TIF conversion cancelled by user');
        }
    }

    private handleCameraParamsError(error: string, requestId?: string): void {
        console.error('Camera parameter error:', error);
        if (requestId && this.pendingTifFiles.has(requestId)) {
            // Remove only the specific TIF file with error
            const tifData = this.pendingTifFiles.get(requestId);
            this.pendingTifFiles.delete(requestId);
            this.showError(`Camera parameter error for ${tifData?.fileName || 'file'}: ${error}`);
        } else {
            // Fallback: clear all pending TIF files
            this.pendingTifFiles.clear();
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

    private async handleColorImageData(message: any): Promise<void> {
        try {
            console.log('Received color image data for file index:', message.fileIndex);
            
            // Convert the ArrayBuffer back to a File-like object for processing
            const blob = new Blob([message.data], { type: message.mimeType || 'image/png' });
            const file = new File([blob], message.fileName, { type: message.mimeType || 'image/png' });
            
            // Load and validate the color image
            const imageData = await this.loadAndValidateColorImage(file);
            
            if (!imageData) {
                return; // Error already shown in loadAndValidateColorImage
            }

            const fileIndex = message.fileIndex;
            const tifData = this.fileTifData.get(fileIndex);
            if (!tifData) {
                throw new Error('No cached TIF data found for this file');
            }

            // Validate dimensions match TIF
            if (imageData.width !== tifData.tifDimensions.width || imageData.height !== tifData.tifDimensions.height) {
                throw new Error(`Color image dimensions (${imageData.width}x${imageData.height}) do not match TIF dimensions (${tifData.tifDimensions.width}x${tifData.tifDimensions.height})`);
            }

            // Store color image data and name in TIF data for future reprocessing
            tifData.colorImageData = imageData;
            tifData.colorImageName = message.fileName;

            // Reprocess TIF with color data
            const result = await this.processTifToPointCloud(tifData.originalData, tifData.cameraParams);
            await this.applyColorToTifResult(result, imageData, tifData);

            // Update the PLY data
            const plyData = this.plyFiles[fileIndex];
            plyData.vertices = this.convertTifResultToVertices(result);
            plyData.hasColors = true;

            // Update the mesh with colored data
            const oldMaterial = this.meshes[fileIndex].material;
            const newMaterial = this.createMaterialForFile(plyData, fileIndex);
            this.meshes[fileIndex].material = newMaterial;
            
            // Ensure point size is correctly applied to the new material
            if (this.meshes[fileIndex] instanceof THREE.Points && newMaterial instanceof THREE.PointsMaterial) {
                const currentPointSize = this.pointSizes[fileIndex] || 0.001;
                newMaterial.size = currentPointSize;
                console.log(`🔧 Applied point size ${currentPointSize} to color-updated TIF material for file ${fileIndex}`);
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
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            
            // Create color array
            const colors = new Float32Array(plyData.vertices.length * 3);
            for (let i = 0, i3 = 0; i < plyData.vertices.length; i++, i3 += 3) {
                const vertex = plyData.vertices[i];
                colors[i3] = (vertex.red || 0) / 255;
                colors[i3 + 1] = (vertex.green || 0) / 255;
                colors[i3 + 2] = (vertex.blue || 0) / 255;
            }
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            geometry.computeBoundingBox();
            
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
            this.updateFileList();
            this.showStatus(`Color image "${message.fileName}" applied successfully!`);

        } catch (error) {
            console.error('Error handling color image data:', error);
            this.showError(`Failed to apply color image: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Process TIF file data and convert to point cloud
     */
    private async processTifToPointCloud(tifData: ArrayBuffer, cameraParams: CameraParams): Promise<TifConversionResult> {
        try {
            // Load TIF using GeoTIFF
            const tiff = await GeoTIFF.fromArrayBuffer(tifData);
            const image = await tiff.getImage();
            
            // Get image dimensions and data
            const width = image.getWidth();
            const height = image.getHeight();
            const rasters = await image.readRasters();
            
            console.log(`Processing TIF: ${width}x${height}, camera: ${cameraParams.cameraModel}, focal: ${cameraParams.focalLength}`);
            
            // Extract depth data - handle different data types properly
            const rawDepthData = rasters[0];
            let depthData: Float32Array;
            
            console.log(`📊 Raw TIF data: type=${rawDepthData.constructor.name}, length=${rawDepthData.length}, depthType=${cameraParams.depthType}`);
            
            if (rawDepthData instanceof Float32Array) {
                depthData = rawDepthData;
                console.log('Using original Float32Array depth data');
            } else if (rawDepthData instanceof Uint16Array) {
                // Convert uint16 to float32 for processing
                depthData = new Float32Array(rawDepthData.length);
                for (let i = 0; i < rawDepthData.length; i++) {
                    depthData[i] = rawDepthData[i];
                }
                console.log('Converted Uint16Array to Float32Array for depth/disparity processing');
                
                // Log sample values for debugging disparity conversion
                if (cameraParams.depthType === 'disparity') {
                    const sampleValues = Array.from(depthData.slice(0, 10));
                    console.log(`📈 Sample disparity values: [${sampleValues.join(', ')}]`);
                }
            } else if (rawDepthData instanceof Uint8Array) {
                // Convert uint8 to float32 for processing
                depthData = new Float32Array(rawDepthData.length);
                for (let i = 0; i < rawDepthData.length; i++) {
                    depthData[i] = rawDepthData[i];
                }
                console.log('Converted Uint8Array to Float32Array for depth/disparity processing');
                
                // Log sample values for debugging disparity conversion
                if (cameraParams.depthType === 'disparity') {
                    const sampleValues = Array.from(depthData.slice(0, 10));
                    console.log(`📈 Sample disparity values: [${sampleValues.join(', ')}]`);
                }
            } else {
                // Fallback: convert whatever we have to Float32Array
                depthData = new Float32Array(rawDepthData);
                console.log(`Converted ${rawDepthData.constructor.name} to Float32Array for depth/disparity processing`);
                
                // Log sample values for debugging
                const sampleValues = Array.from(depthData.slice(0, 10));
                console.log(`📈 Sample values after conversion: [${sampleValues.join(', ')}]`);
            }
            
            // Calculate camera intrinsics (principal point at image center)
            // For 0-based pixel indexing, center is at (width/2 - 0.5, height/2 - 0.5)
            const fx = cameraParams.focalLength;
            const fy = cameraParams.focalLength;
            const cx = width / 2 - 0.5;
            const cy = height / 2 - 0.5;
            
            // Convert depth image to point cloud
            const result = this.depthToPointCloud(
                depthData,
                width,
                height,
                fx,
                fy,
                cx,
                cy,
                cameraParams.cameraModel,
                cameraParams.depthType,
                cameraParams.baseline
            );
            
            return result;
            
        } catch (error) {
            console.error('Error processing TIF:', error);
            throw new Error(`Failed to process TIF file: ${error instanceof Error ? error.message : String(error)}`);
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
        cameraModel: 'pinhole' | 'fisheye',
        depthType: 'euclidean' | 'orthogonal' | 'disparity' = 'euclidean',
        baseline?: number
    ): TifConversionResult {
        
        const points: number[] = [];
        const colors: number[] = [];
        
        // Track depth statistics for debugging disappearing point clouds
        let minDepth = Infinity;
        let maxDepth = -Infinity;
        let validPointCount = 0;
        let skippedPoints = 0;
        
        if (cameraModel === 'fisheye') {
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
                    
                    if (r === 0) {
                        // Handle center point
                        points.push(0, 0, depth);
                    } else {
                        // Normalize offset
                        const u_norm = u / r;
                        const v_norm = v / r;
                        
                        // Compute angle for equidistant fisheye
                        const theta = r / fx;
                        
                        // Create 3D unit vector
                        const x_norm = u_norm * Math.sin(theta);
                        const y_norm = v_norm * Math.sin(theta);
                        const z_norm = Math.cos(theta);
                        
                        // Scale by depth
                        points.push(
                            x_norm * depth,
                            y_norm * depth,
                            z_norm * depth
                        );
                    }
                    
                    // Add color based on depth (grayscale visualization)
                    const normalizedDepth = Math.min(depth / 10, 1); // Scale depth for visualization
                    colors.push(normalizedDepth, normalizedDepth, normalizedDepth);
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
                        // Convert disparity to depth: depth = baseline * focal_length / disparity
                        depth = (baseline * fx) / depth;
                        
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
                    
                    // Scale by depth
                    points.push(
                        dirX * depth,
                        dirY * depth,
                        dirZ * depth
                    );
                    
                    // Add color based on depth (grayscale visualization)
                    const normalizedDepth = Math.min(depth / 10, 1); // Scale depth for visualization
                    colors.push(normalizedDepth, normalizedDepth, normalizedDepth);
                }
            }
        }
        
        console.log(`Generated ${points.length / 3} points from ${width}x${height} depth image`);
        console.log(`📊 Depth statistics: min=${minDepth.toFixed(3)}, max=${maxDepth.toFixed(3)}, valid=${validPointCount}, skipped=${skippedPoints}`);
        console.log(`🎥 Camera range: near=${0.001}, far=${1000000}`);
        
        // Check for potential clipping issues
        if (minDepth < 0.001) {
            console.warn(`⚠️ Some points (${minDepth.toFixed(6)}) are closer than camera near plane (0.001) - may be clipped!`);
        }
        if (maxDepth > 100000) {
            console.warn(`⚠️ Some points (${maxDepth.toFixed(3)}) are farther than camera far plane (100000) - may be clipped!`);
        }
        
        // Convert from OpenCV convention (Y-down, Z-forward) to Blender/OpenGL/Three.js convention (Y-up, Z-backward)
        // Multiply Y and Z coordinates by -1
        console.log('🔄 Converting coordinates from OpenCV to Blender/OpenGL/Three.js convention (Y↑, Z←)');
        for (let i = 0; i < points.length; i += 3) {
            // X stays the same (i+0)
            points[i + 1] = -points[i + 1]; // Y coordinate: flip from down to up
            points[i + 2] = -points[i + 2]; // Z coordinate: flip from forward to backward
        }
        
        return {
            vertices: new Float32Array(points),
            colors: new Float32Array(colors),
            pointCount: points.length / 3
        };
    }

    /**
     * Convert TIF processing result to PLY vertex format
     */
    private convertTifResultToVertices(result: TifConversionResult): PlyVertex[] {
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
        console.log('Status:', message);
        
        // Clear any existing errors when showing a status update
        this.clearError();
        
        // You could also update UI here if needed
    }

    /**
     * Initialize TIF controls UI
     */
    private initializeTifControls(): void {
        if (!this.currentCameraParams || !this.tifDimensions) {
            return;
        }

        // Set current values in UI
        const focalLengthInput = document.getElementById('focal-length-input') as HTMLInputElement;
        const cameraModelSelect = document.getElementById('camera-model-select') as HTMLSelectElement;
        const depthTypeSelect = document.getElementById('depth-type-select') as HTMLSelectElement;
        const baselineInput = document.getElementById('baseline-input') as HTMLInputElement;
        const baselineGroup = document.getElementById('baseline-input-group') as HTMLDivElement;
        
        if (focalLengthInput) {
            focalLengthInput.value = this.currentCameraParams.focalLength.toString();
        }
        
        if (cameraModelSelect) {
            cameraModelSelect.value = this.currentCameraParams.cameraModel;
        }
        
        if (depthTypeSelect) {
            depthTypeSelect.value = this.currentCameraParams.depthType;
        }
        
        if (baselineInput && this.currentCameraParams.baseline !== undefined) {
            baselineInput.value = this.currentCameraParams.baseline.toString();
        }
        
        // Show/hide baseline input based on depth type
        if (baselineGroup) {
            baselineGroup.style.display = this.currentCameraParams.depthType === 'disparity' ? 'flex' : 'none';
        }

        // Update TIF info display
        const tifInfoDisplay = document.getElementById('tif-info-display');
        if (tifInfoDisplay) {
            let baselineInfo = '';
            if (this.currentCameraParams.depthType === 'disparity' && this.currentCameraParams.baseline) {
                baselineInfo = `<div><strong>Baseline:</strong> ${this.currentCameraParams.baseline}mm</div>`;
            }
            
            tifInfoDisplay.innerHTML = `
                <div><strong>Original File:</strong> ${this.originalTifFileName}</div>
                <div><strong>Dimensions:</strong> ${this.tifDimensions.width} × ${this.tifDimensions.height}</div>
                <div><strong>Camera Model:</strong> ${this.currentCameraParams.cameraModel}</div>
                <div><strong>Depth Type:</strong> ${this.currentCameraParams.depthType}</div>
                <div><strong>Focal Length:</strong> ${this.currentCameraParams.focalLength}px</div>
                ${baselineInfo}
            `;
        }

        // Add event listeners
        this.setupTifControlEventListeners();
    }

    /**
     * Setup event listeners for TIF controls
     */
    private setupTifControlEventListeners(): void {
        // Update focal length
        const updateFocalLengthBtn = document.getElementById('update-focal-length');
        if (updateFocalLengthBtn) {
            updateFocalLengthBtn.addEventListener('click', () => this.updateFocalLength());
        }

        // Update camera model
        const updateCameraModelBtn = document.getElementById('update-camera-model');
        if (updateCameraModelBtn) {
            updateCameraModelBtn.addEventListener('click', () => this.updateCameraModel());
        }

        // Update depth type
        const updateDepthTypeBtn = document.getElementById('update-depth-type');
        if (updateDepthTypeBtn) {
            updateDepthTypeBtn.addEventListener('click', () => this.updateDepthType());
        }

        // Update baseline
        const updateBaselineBtn = document.getElementById('update-baseline');
        if (updateBaselineBtn) {
            updateBaselineBtn.addEventListener('click', () => this.updateBaseline());
        }

        // Show/hide baseline controls when depth type changes
        const depthTypeSelect = document.getElementById('depth-type-select') as HTMLSelectElement;
        if (depthTypeSelect) {
            depthTypeSelect.addEventListener('change', () => this.toggleBaselineControls());
        }

        // Apply color image
        const applyColorImageBtn = document.getElementById('apply-color-image');
        if (applyColorImageBtn) {
            applyColorImageBtn.addEventListener('click', () => this.applyColorImage());
        }

        // Remove color mapping
        const removeColorMappingBtn = document.getElementById('remove-color-mapping');
        if (removeColorMappingBtn) {
            removeColorMappingBtn.addEventListener('click', () => this.removeColorMapping());
        }
    }

    /**
     * Update focal length and re-process TIF
     */
    private async updateFocalLength(): Promise<void> {
        try {
            const focalLengthInput = document.getElementById('focal-length-input') as HTMLInputElement;
            if (!focalLengthInput || !this.currentCameraParams || !this.originalTifData) {
                return;
            }

            const newFocalLength = parseFloat(focalLengthInput.value);
            if (isNaN(newFocalLength) || newFocalLength <= 0) {
                this.showColorMappingStatus('Please enter a valid focal length', 'error');
                return;
            }

            this.currentCameraParams.focalLength = newFocalLength;
            await this.reprocessTifData();
            // Focal length updated
            
        } catch (error) {
            console.error('Error updating focal length:', error);
            this.showColorMappingStatus(`Failed to update focal length: ${error instanceof Error ? error.message : String(error)}`, 'error');
        }
    }

    /**
     * Update camera model and re-process TIF
     */
    private async updateCameraModel(): Promise<void> {
        try {
            const cameraModelSelect = document.getElementById('camera-model-select') as HTMLSelectElement;
            if (!cameraModelSelect || !this.currentCameraParams || !this.originalTifData) {
                return;
            }

            const newCameraModel = cameraModelSelect.value as 'pinhole' | 'fisheye';
            this.currentCameraParams.cameraModel = newCameraModel;
            await this.reprocessTifData();
            // Camera model updated
            
        } catch (error) {
            console.error('Error updating camera model:', error);
            this.showColorMappingStatus(`Failed to update camera model: ${error instanceof Error ? error.message : String(error)}`, 'error');
        }
    }

    /**
     * Update depth type and re-process TIF
     */
    private async updateDepthType(): Promise<void> {
        try {
            const depthTypeSelect = document.getElementById('depth-type-select') as HTMLSelectElement;
            if (!depthTypeSelect || !this.currentCameraParams || !this.originalTifData) {
                return;
            }

            const newDepthType = depthTypeSelect.value as 'euclidean' | 'orthogonal' | 'disparity';
            this.currentCameraParams.depthType = newDepthType;
            
            // If switching to disparity mode and no baseline is set, prompt for it
            if (newDepthType === 'disparity' && !this.currentCameraParams.baseline) {
                this.showColorMappingStatus('Please set baseline for disparity conversion', 'warning');
                this.toggleBaselineControls();
                return;
            }
            
            await this.reprocessTifData();
            // Depth type updated
            
        } catch (error) {
            console.error('Error updating depth type:', error);
            this.showColorMappingStatus(`Failed to update depth type: ${error instanceof Error ? error.message : String(error)}`, 'error');
        }
    }

    /**
     * Update baseline parameter and re-process TIF
     */
    private async updateBaseline(): Promise<void> {
        try {
            const baselineInput = document.getElementById('baseline-input') as HTMLInputElement;
            if (!baselineInput || !this.currentCameraParams || !this.originalTifData) {
                return;
            }

            const newBaseline = parseFloat(baselineInput.value);
            if (isNaN(newBaseline) || newBaseline <= 0) {
                this.showColorMappingStatus('Please enter a valid baseline value', 'error');
                return;
            }

            this.currentCameraParams.baseline = newBaseline;
            await this.reprocessTifData();
            // Baseline updated
            
        } catch (error) {
            console.error('Error updating baseline:', error);
            this.showColorMappingStatus(`Failed to update baseline: ${error instanceof Error ? error.message : String(error)}`, 'error');
        }
    }

    /**
     * Toggle baseline controls visibility based on depth type
     */
    private toggleBaselineControls(): void {
        const depthTypeSelect = document.getElementById('depth-type-select') as HTMLSelectElement;
        const baselineGroup = document.getElementById('baseline-input-group') as HTMLDivElement;
        
        if (depthTypeSelect && baselineGroup) {
            const isDisparity = depthTypeSelect.value === 'disparity';
            baselineGroup.style.display = isDisparity ? 'flex' : 'none';
        }
    }

    /**
     * Re-process TIF data with updated parameters
     */
    private async reprocessTifData(): Promise<void> {
        if (!this.originalTifData || !this.currentCameraParams || !this.originalTifFileName) {
            throw new Error('No TIF data available for re-processing');
        }

        this.showStatus('Re-processing point cloud with updated parameters...');

        // Process the TIF data with updated parameters
        const result = await this.processTifToPointCloud(this.originalTifData, this.currentCameraParams);
        
        // Apply current color mapping if available
        if (this.currentColorImageData) {
            await this.applyColorToResult(result);
        }
        
        // Create updated PLY data structure
        const plyData: PlyData = {
            vertices: this.convertTifResultToVertices(result),
            faces: [],
            format: 'binary_little_endian',
            version: '1.0',
            comments: [
                `Converted from TIF depth image: ${this.originalTifFileName}`, 
                `Camera: ${this.currentCameraParams.cameraModel}`, 
                `Depth type: ${this.currentCameraParams.depthType}`,
                `Focal length: ${this.currentCameraParams.focalLength}px`,
                ...(this.currentCameraParams.baseline ? [`Baseline: ${this.currentCameraParams.baseline}mm`] : [])
            ],
            vertexCount: result.pointCount,
            faceCount: 0,
            hasColors: !!result.colors,
            hasNormals: false,
            fileName: this.originalTifFileName.replace(/\.(tif|tiff)$/i, '_pointcloud.ply'),
            fileIndex: 0
        };

        // Find and replace the specific TIF file instead of removing all files
        let tifFileIndex = -1;
        for (let i = 0; i < this.plyFiles.length; i++) {
            const originalFileName = this.originalTifFileName?.replace(/\.(tif|tiff)$/i, '_pointcloud.ply');
            if (this.plyFiles[i].fileName === originalFileName) {
                tifFileIndex = i;
                break;
            }
        }
        
        if (tifFileIndex >= 0) {
            // Update existing TIF file
            plyData.fileIndex = tifFileIndex;
            
            // Remove old file
            this.removeFileByIndex(tifFileIndex);
            
            // Insert updated file at the same position
            this.plyFiles.splice(tifFileIndex, 0, plyData);
            
            // Recreate geometry and material
            const geometry = this.createGeometryFromPlyData(plyData);
            const material = this.createMaterialForFile(plyData, tifFileIndex);
            
            // Ensure point size is correctly applied to the new material
            if (material instanceof THREE.PointsMaterial) {
                const currentPointSize = this.pointSizes[tifFileIndex] || 0.001;
                material.size = currentPointSize;
                console.log(`🔧 Applied point size ${currentPointSize} to reprocessed TIF material for file ${tifFileIndex}`);
            }
            
            const mesh = new THREE.Points(geometry, material);
            
            // Replace mesh at the same position
            this.scene.remove(this.meshes[tifFileIndex]);
            this.meshes[tifFileIndex] = mesh;
            this.scene.add(mesh);
            
            // Update UI
            this.updateFileList();
            this.updateFileStats();
        } else {
            // If TIF file not found, add as new file
            this.addNewFiles([plyData]);
        }
        
        this.showStatus('Point cloud updated successfully!');
    }

    /**
     * Apply color image to point cloud
     */
    private async applyColorImage(): Promise<void> {
        try {
            const colorImageInput = document.getElementById('color-image-input') as HTMLInputElement;
            if (!colorImageInput || !colorImageInput.files || colorImageInput.files.length === 0) {
                this.showColorMappingStatus('Please select a color image file', 'error');
                return;
            }

            const file = colorImageInput.files[0];
            
            // Load and validate image
            const imageData = await this.loadAndValidateColorImage(file);
            if (!imageData) {
                return; // Error already shown in loadAndValidateColorImage
            }

            this.currentColorImageData = imageData;
            
            // Re-process point cloud with color mapping
            await this.reprocessTifData();
            
            this.showColorMappingStatus(`Color mapping applied successfully from ${file.name}`, 'success');
            
        } catch (error) {
            console.error('Error applying color image:', error);
            this.showColorMappingStatus(`Failed to apply color image: ${error instanceof Error ? error.message : String(error)}`, 'error');
        }
    }

    /**
     * Remove color mapping and revert to depth-based colors
     */
    private async removeColorMapping(): Promise<void> {
        try {
            this.currentColorImageData = null;
            await this.reprocessTifData();
            this.showColorMappingStatus('Color mapping removed, reverted to depth-based colors', 'success');
            
        } catch (error) {
            console.error('Error removing color mapping:', error);
            this.showColorMappingStatus(`Failed to remove color mapping: ${error instanceof Error ? error.message : String(error)}`, 'error');
        }
    }

    /**
     * Load and validate color image dimensions
     */
    private async loadAndValidateColorImage(file: File): Promise<ImageData | null> {
        return new Promise((resolve) => {
            if (!this.tifDimensions) {
                this.showColorMappingStatus('No TIF dimensions available for validation', 'error');
                resolve(null);
                return;
            }

            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            img.onload = () => {
                // Validate dimensions
                if (img.width !== this.tifDimensions!.width || img.height !== this.tifDimensions!.height) {
                    this.showColorMappingStatus(
                        `Image dimensions (${img.width}×${img.height}) don't match depth image (${this.tifDimensions!.width}×${this.tifDimensions!.height})`,
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
            
            if (file.type.startsWith('image/') && !file.type.includes('tiff') && !file.type.includes('tif')) {
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
                        
                        if (width !== this.tifDimensions!.width || height !== this.tifDimensions!.height) {
                            this.showColorMappingStatus(
                                `TIF dimensions (${width}×${height}) don't match depth image (${this.tifDimensions!.width}×${this.tifDimensions!.height})`,
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
     * Apply color mapping to TIF conversion result
     */
    private async applyColorToResult(result: TifConversionResult): Promise<void> {
        if (!this.currentColorImageData || !this.tifDimensions || !this.originalTifData || !this.currentCameraParams) {
            return;
        }

        const colorData = this.currentColorImageData.data;
        const width = this.tifDimensions.width;
        const height = this.tifDimensions.height;
        
        // Re-load the depth data to match the exact same processing logic
        const tiff = await GeoTIFF.fromArrayBuffer(this.originalTifData);
        const image = await tiff.getImage();
        const rasters = await image.readRasters();
        const depthData = new Float32Array(rasters[0]);
        
        // Create new color array
        const newColors = new Float32Array(result.pointCount * 3);
        let colorIndex = 0;
        
        if (this.currentCameraParams.cameraModel === 'fisheye') {
            // Calculate camera intrinsics (matching processTifToPointCloud logic)
            const fx = this.currentCameraParams.focalLength;
            const cx = width / 2 - 0.5;
            const cy = height / 2 - 0.5;
            
            // Fisheye processing - match the exact same logic as depthToPointCloud
            for (let i = 0; i < width; i++) {
                for (let j = 0; j < height; j++) {
                    const depthIndex = j * width + i;
                    const depth = depthData[depthIndex];
                    
                    // Skip invalid depth values (same logic as in depthToPointCloud)
                    if (isNaN(depth) || !isFinite(depth) || depth <= 0) {
                        continue;
                    }
                    
                    // Get color from image data
                    const colorPixelIndex = depthIndex * 4;
                    const r = colorData[colorPixelIndex] / 255;
                    const g = colorData[colorPixelIndex + 1] / 255;
                    const b = colorData[colorPixelIndex + 2] / 255;
                    
                    newColors[colorIndex * 3] = r;
                    newColors[colorIndex * 3 + 1] = g;
                    newColors[colorIndex * 3 + 2] = b;
                    colorIndex++;
                }
            }
        } else {
            // Pinhole processing - match the exact same logic as depthToPointCloud
            for (let v = 0; v < height; v++) {
                for (let u = 0; u < width; u++) {
                    const depthIndex = v * width + u;
                    const depth = depthData[depthIndex];
                    
                    // Skip invalid depth values (same logic as in depthToPointCloud)
                    if (isNaN(depth) || !isFinite(depth) || depth <= 0) {
                        continue;
                    }
                    
                    // Get color from image data
                    const colorPixelIndex = depthIndex * 4;
                    const r = colorData[colorPixelIndex] / 255;
                    const g = colorData[colorPixelIndex + 1] / 255;
                    const b = colorData[colorPixelIndex + 2] / 255;
                    
                    newColors[colorIndex * 3] = r;
                    newColors[colorIndex * 3 + 1] = g;
                    newColors[colorIndex * 3 + 2] = b;
                    colorIndex++;
                }
            }
        }
        
        result.colors = newColors;
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
     * Determine if a TIF image is a depth image suitable for point cloud conversion
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

    private isTifDerivedFile(data: PlyData): boolean {
        return data.comments.some(comment => comment.includes('Converted from TIF depth image'));
    }

    private getTifSetting(data: PlyData, setting: 'camera' | 'depth'): string {
        for (const comment of data.comments) {
            if (setting === 'camera' && comment.startsWith('Camera: ')) {
                return comment.replace('Camera: ', '').toLowerCase();
            }
            if (setting === 'depth' && comment.startsWith('Depth type: ')) {
                return comment.replace('Depth type: ', '').toLowerCase();
            }
        }
        return '';
    }

    private getTifFocalLength(data: PlyData): number {
        for (const comment of data.comments) {
            if (comment.startsWith('Focal length: ')) {
                const match = comment.match(/(\d+(?:\.\d+)?)px/);
                return match ? parseFloat(match[1]) : 500;
            }
        }
        return 500; // Default focal length
    }

    private getTifBaseline(data: PlyData): number {
        for (const comment of data.comments) {
            if (comment.startsWith('Baseline: ')) {
                const match = comment.match(/(\d+(?:\.\d+)?)mm/);
                return match ? parseFloat(match[1]) : 50;
            }
        }
        return 50; // Default baseline for disparity
    }

    private getStoredColorImageName(fileIndex: number): string | null {
        const tifData = this.fileTifData.get(fileIndex);
        return tifData?.colorImageName || null;
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

    private async applyTifSettings(fileIndex: number): Promise<void> {
        try {
            // Get the current values from the form
            const cameraModelSelect = document.getElementById(`camera-model-${fileIndex}`) as HTMLSelectElement;
            const focalLengthInput = document.getElementById(`focal-length-${fileIndex}`) as HTMLInputElement;
            const depthTypeSelect = document.getElementById(`depth-type-${fileIndex}`) as HTMLSelectElement;
            const baselineInput = document.getElementById(`baseline-${fileIndex}`) as HTMLInputElement;

            if (!cameraModelSelect || !focalLengthInput || !depthTypeSelect) {
                throw new Error('TIF settings form elements not found');
            }

            const newCameraParams: CameraParams = {
                cameraModel: cameraModelSelect.value as 'pinhole' | 'fisheye',
                focalLength: parseFloat(focalLengthInput.value),
                depthType: depthTypeSelect.value as 'euclidean' | 'orthogonal' | 'disparity',
                baseline: depthTypeSelect.value === 'disparity' ? parseFloat(baselineInput.value) : undefined
            };

            // Validate parameters
            if (!newCameraParams.focalLength || newCameraParams.focalLength <= 0) {
                throw new Error('Focal length must be a positive number');
            }
            if (newCameraParams.depthType === 'disparity' && (!newCameraParams.baseline || newCameraParams.baseline <= 0)) {
                throw new Error('Baseline must be a positive number for disparity mode');
            }

            // Check if we have cached TIF data for this file
            const tifData = this.fileTifData.get(fileIndex);
            if (!tifData) {
                throw new Error('No cached TIF data found for this file. Please reload the TIF file.');
            }

            this.showStatus('Reprocessing TIF with new settings...');

            // Process the TIF data with new parameters
            const result = await this.processTifToPointCloud(tifData.originalData, newCameraParams);
            
            // If there's a stored color image, reapply it
            if (tifData.colorImageData) {
                console.log(`🎨 Reapplying stored color image: ${tifData.colorImageName}`);
                await this.applyColorToTifResult(result, tifData.colorImageData, { cameraParams: newCameraParams });
            }
            
            // Update the PLY data
            const plyData = this.plyFiles[fileIndex];
            plyData.vertices = this.convertTifResultToVertices(result);
            plyData.vertexCount = result.pointCount;
            plyData.hasColors = !!result.colors;
            plyData.comments = [
                `Converted from TIF depth image: ${tifData.fileName}`,
                `Camera: ${newCameraParams.cameraModel}`,
                `Depth type: ${newCameraParams.depthType}`,
                `Focal length: ${newCameraParams.focalLength}px`,
                ...(newCameraParams.baseline ? [`Baseline: ${newCameraParams.baseline}mm`] : [])
            ];

            // Update cached parameters
            tifData.cameraParams = newCameraParams;

            // Update the mesh with new data
            const oldMaterial = this.meshes[fileIndex].material;
            const newMaterial = this.createMaterialForFile(plyData, fileIndex);
            this.meshes[fileIndex].material = newMaterial;
            
            // Ensure point size is correctly applied to the new material
            if (this.meshes[fileIndex] instanceof THREE.Points && newMaterial instanceof THREE.PointsMaterial) {
                const currentPointSize = this.pointSizes[fileIndex] || 0.001;
                newMaterial.size = currentPointSize;
                console.log(`🔧 Applied point size ${currentPointSize} to updated TIF material for file ${fileIndex}`);
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
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            
            if (plyData.hasColors) {
                // Create color array
                const colors = new Float32Array(plyData.vertices.length * 3);
                for (let i = 0, i3 = 0; i < plyData.vertices.length; i++, i3 += 3) {
                    const vertex = plyData.vertices[i];
                    colors[i3] = (vertex.red || 0) / 255;
                    colors[i3 + 1] = (vertex.green || 0) / 255;
                    colors[i3 + 2] = (vertex.blue || 0) / 255;
                }
                geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            }
            geometry.computeBoundingBox();
            
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
            this.showStatus('TIF settings applied successfully!');

        } catch (error) {
            console.error('Error applying TIF settings:', error);
            this.showError(`Failed to apply TIF settings: ${error instanceof Error ? error.message : String(error)}`);
        }
    }



    private async applyColorToTifResult(result: TifConversionResult, imageData: ImageData, tifData: any): Promise<void> {
        const colorData = imageData.data;
        const width = imageData.width;
        const height = imageData.height;
        
        // Create color array for vertices
        const colors = new Float32Array(result.pointCount * 3);
        let colorIndex = 0;

        for (let i = 0; i < result.pointCount; i++) {
            const vertexIndex = i * 3;
            let x = result.vertices[vertexIndex];
            let y = result.vertices[vertexIndex + 1];
            let z = result.vertices[vertexIndex + 2];

            // Skip invalid points (NaN, 0, ±Infinity)
            // In Blender convention, negative Z values are valid (pointing backward into scene)
            if (z >= 0 || isNaN(x) || isNaN(y) || isNaN(z) || !isFinite(x) || !isFinite(y) || !isFinite(z)) {
                colors[colorIndex++] = 0.5;
                colors[colorIndex++] = 0.5; 
                colors[colorIndex++] = 0.5;
                continue;
            }

            // Convert back from Blender/OpenGL convention to OpenCV convention for color lookup
            // (Undo the Y and Z flip that was applied in depthToPointCloud)
            y = -y; // Flip Y back: Y-up → Y-down
            z = -z; // Flip Z back: Z-backward → Z-forward (now positive, valid in OpenCV)

            // Project 3D point to image coordinates (using original OpenCV coordinates)
            let u, v;
            if (tifData.cameraParams.cameraModel === 'fisheye') {
                // Fisheye projection
                const fx = tifData.cameraParams.focalLength;
                const fy = fx;
                const cx = width / 2 - 0.5;
                const cy = height / 2 - 0.5;
                
                const r = Math.sqrt(x * x + y * y);
                const theta = Math.atan2(r, z);
                const phi = Math.atan2(y, x);
                
                const rFish = fx * theta;
                u = Math.round(cx + rFish * Math.cos(phi));
                v = Math.round(cy + rFish * Math.sin(phi));
            } else {
                // Pinhole projection
                const fx = tifData.cameraParams.focalLength;
                const fy = fx;
                const cx = width / 2 - 0.5;
                const cy = height / 2 - 0.5;
                
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

        result.colors = colors;
    }

    private async removeColorImageFromTif(fileIndex: number): Promise<void> {
        try {
            const tifData = this.fileTifData.get(fileIndex);
            if (!tifData) {
                throw new Error('No cached TIF data found for this file');
            }

            this.showStatus('Removing color image and reverting to default colors...');

            // Remove stored color image data
            delete tifData.colorImageData;
            delete tifData.colorImageName;

            // Reprocess TIF without color data (will use default grayscale colors)
            const result = await this.processTifToPointCloud(tifData.originalData, tifData.cameraParams);

            // Update the PLY data
            const plyData = this.plyFiles[fileIndex];
            plyData.vertices = this.convertTifResultToVertices(result);
            plyData.hasColors = !!result.colors;

            // Update the mesh with default colors
            const oldMaterial = this.meshes[fileIndex].material;
            const newMaterial = this.createMaterialForFile(plyData, fileIndex);
            this.meshes[fileIndex].material = newMaterial;
            
            // Ensure point size is correctly applied to the new material
            if (this.meshes[fileIndex] instanceof THREE.Points && newMaterial instanceof THREE.PointsMaterial) {
                const currentPointSize = this.pointSizes[fileIndex] || 0.001;
                newMaterial.size = currentPointSize;
                console.log(`🔧 Applied point size ${currentPointSize} to default-color TIF material for file ${fileIndex}`);
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
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            
            if (plyData.hasColors) {
                // Create color array with default grayscale colors
                const colors = new Float32Array(plyData.vertices.length * 3);
                for (let i = 0, i3 = 0; i < plyData.vertices.length; i++, i3 += 3) {
                    const vertex = plyData.vertices[i];
                    colors[i3] = (vertex.red || 0) / 255;
                    colors[i3 + 1] = (vertex.green || 0) / 255;
                    colors[i3 + 2] = (vertex.blue || 0) / 255;
                }
                geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
            }
            geometry.computeBoundingBox();
            
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
            this.updateFileList();
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
        content += `comment Coordinate system: Blender/OpenGL (Y-up, Z-backward)\n`;
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
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new PLYVisualizer());
} else {
    new PLYVisualizer();
}