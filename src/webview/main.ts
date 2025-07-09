import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

declare const acquireVsCodeApi: () => any;

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

/**
 * Modern PLY Visualizer with unified file management
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
            1000
        );
        this.camera.position.set(1, 1, 1);

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
            trackballControls.dynamicDampingFactor = 0.15;
            
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
            trackballControls.dynamicDampingFactor = 0.15;
            
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
            orbitControls.dampingFactor = 0.15;
            orbitControls.screenSpacePanning = false;
            orbitControls.minDistance = 0.001;
            orbitControls.maxDistance = 1000;
        }
        
        // Set up axes visibility for all control types
        this.setupAxesVisibility();
        
        // Restore camera state to prevent jumps
        this.camera.position.copy(currentCameraPosition);
        this.camera.up.copy(currentUp);
        this.controls.target.copy(currentTarget);
        this.controls.update();
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
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
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
        
        // Set parameters for better point cloud picking
        raycaster.params.Points.threshold = 0.01; // Increase threshold for easier point picking

        // Find intersections with all visible meshes
        const visibleMeshes = this.meshes.filter((mesh, index) => this.fileVisibility[index]);
        const intersects = raycaster.intersectObjects(visibleMeshes, false);

        if (intersects.length > 0) {
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
        
        const endTime = performance.now();
        console.log(`Geometry creation took ${(endTime - startTime).toFixed(2)}ms`);
        
        return geometry;
    }

    private setupEventListeners(): void {
        // File management event listeners
        document.getElementById('add-file')?.addEventListener('click', this.requestAddFile.bind(this));

        // Camera convention buttons
        document.addEventListener('click', (e) => {
            const target = e.target as HTMLElement;
            if (target.id === 'opencv-camera') {
                this.setOpenCVCameraConvention();
                e.preventDefault();
            } else if (target.id === 'blender-camera') {
                this.setBlenderOpenGLCameraConvention();
                e.preventDefault();
            }
        });

        // Color mode change event
        document.addEventListener('change', (e) => {
            const target = e.target as HTMLElement;
            if (target.classList.contains('color-selector')) {
                const fileIndex = parseInt(target.id.split('-')[1]);
                const value = (target as HTMLSelectElement).value;
                
                if (fileIndex >= 0 && fileIndex < this.individualColorModes.length) {
                    this.individualColorModes[fileIndex] = value;
                    
                    // Recreate material with new color mode
                    if (fileIndex < this.plyFiles.length && fileIndex < this.meshes.length) {
                        const oldMaterial = this.meshes[fileIndex].material;
                        const newMaterial = this.createMaterialForFile(this.plyFiles[fileIndex], fileIndex);
                        this.meshes[fileIndex].material = newMaterial;
                        
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
            }
        });

        // Keyboard shortcuts for up vector control, camera reset, and camera controls
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when not typing in input fields
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement) {
                return;
            }

            switch (e.key.toLowerCase()) {
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
                case 'r':
                    this.resetCameraAndUpVector();
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
                case 'c':
                    this.setOpenCVCameraConvention();
                    e.preventDefault();
                    break;
                case 'b':
                    this.setBlenderOpenGLCameraConvention();
                    e.preventDefault();
                    break;
                case 'w':
                    console.log('🔑 W key pressed - setting rotation center to world origin (0,0,0)');
                    this.setRotationCenter(new THREE.Vector3(0, 0, 0));
                    e.preventDefault();
                    break;
            }
        });

        // Show keyboard shortcuts info
        this.showKeyboardShortcuts();
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
            }
        });
    }

    private async displayFiles(dataArray: PlyData[]): Promise<void> {
        this.plyFiles = dataArray;
        this.meshes = [];
        this.fileVisibility = [];
        this.pointSizes = []; // Reset point sizes
        this.individualColorModes = []; // Reset individual color modes

        // Show loading indicator
        document.getElementById('loading')?.classList.remove('hidden');
        const loadingEl = document.getElementById('loading');
        if (loadingEl) {
            loadingEl.textContent = 'Processing point cloud...';
        }

        // Clear existing meshes but preserve axes helper and lights
        const childrenToRemove = this.scene.children.filter(child => 
            child instanceof THREE.Mesh || child instanceof THREE.Points
        );
        
        for (const child of childrenToRemove) {
            if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
                if (child.geometry) {child.geometry.dispose();}
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach((mat: any) => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
            this.scene.remove(child);
        }

        // Re-add lights (in case they were accidentally removed)
        this.initSceneLighting();
        
        // Re-add axes group if it was removed
        const axesGroup = (this as any).axesGroup;
        const hasAxes = axesGroup && this.scene.children.includes(axesGroup);
        if (!hasAxes) {
            this.addAxesHelper();
        }

        // Process files asynchronously to prevent UI freezing
        for (let i = 0; i < dataArray.length; i++) {
            const data = dataArray[i];
            
            // Update progress
            if (loadingEl) {
                loadingEl.textContent = `Processing file ${i + 1}/${dataArray.length} (${data.vertexCount.toLocaleString()} vertices)...`;
            }
            
            console.log(`Processing file ${i}:`, {
                vertices: data.vertexCount,
                faces: data.faceCount,
                hasColors: data.hasColors
            });
            
            // Yield control to prevent UI freezing on large files
            await this.yieldToUI();
            
            // Initialize color mode before creating material
            const initialColorMode = this.useOriginalColors ? 'original' : 'assigned';
            this.individualColorModes.push(initialColorMode);
            console.log(`DisplayFiles: Initializing file ${i} with color mode: ${initialColorMode}, useOriginalColors: ${this.useOriginalColors}, hasColors: ${data.hasColors}`);
            
            const geometry = this.createGeometryFromPlyData(data);
            const material = this.createMaterialForFile(data, i);
            
            const shouldShowAsPoints = data.faceCount === 0;
            const mesh = shouldShowAsPoints ?
                new THREE.Points(geometry, material) :
                new THREE.Mesh(geometry, material);
            
            this.scene.add(mesh);
            this.meshes.push(mesh);
            this.fileVisibility.push(true);
            this.pointSizes.push(0.001); // Initialize with default point size
        }

        // Update progress
        if (loadingEl) {
            loadingEl.textContent = 'Finalizing...';
        }

        // Fit camera to all objects
        this.fitCameraToAllObjects();

        // Update axes size based on scene content
        this.updateAxesSize();

        // Update UI
        this.updateFileList();
        this.updateFileStats();

        // Hide loading indicator
        document.getElementById('loading')?.classList.add('hidden');
    }

    private async yieldToUI(): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    private createMaterialForFile(data: PlyData, fileIndex: number): THREE.Material {
        const shouldShowAsPoints = data.faceCount === 0;
        
        if (shouldShowAsPoints) {
            const materialParams: any = {
                size: this.pointSizes[fileIndex] || 0.001, // Use individual point size or default
                sizeAttenuation: true,
                transparent: false
            };
            
            // Use individual color mode for this file
            const colorMode = this.individualColorModes[fileIndex];
            console.log(`Creating material for file ${fileIndex}, colorMode: ${colorMode}, hasColors: ${data.hasColors}`);
            
            if (colorMode === 'original' && data.hasColors) {
                materialParams.vertexColors = true;
                console.log(`Using original colors for file ${fileIndex}`);
            } else {
                let colorIndex = fileIndex % this.fileColors.length; // Default to assigned color
                if (colorMode !== 'original' && colorMode !== 'assigned') {
                    colorIndex = parseInt(colorMode) || fileIndex % this.fileColors.length;
                }
                const color = this.fileColors[colorIndex];
                materialParams.color = new THREE.Color(color[0], color[1], color[2]);
                console.log(`Using assigned color ${colorIndex} (${color}) for file ${fileIndex}`);
            }
            
            return new THREE.PointsMaterial(materialParams);
        } else {
            const materialParams: any = {
                side: THREE.DoubleSide,
                wireframe: false
            };
            
            // Use individual color mode for this file
            const colorMode = this.individualColorModes[fileIndex];
            console.log(`Creating material for file ${fileIndex}, colorMode: ${colorMode}, hasColors: ${data.hasColors}`);
            
            if (colorMode === 'original' && data.hasColors) {
                materialParams.vertexColors = true;
                console.log(`Using original colors for file ${fileIndex}`);
            } else {
                let colorIndex = fileIndex % this.fileColors.length; // Default to assigned color
                if (colorMode !== 'original' && colorMode !== 'assigned') {
                    colorIndex = parseInt(colorMode) || fileIndex % this.fileColors.length;
                }
                const color = this.fileColors[colorIndex];
                materialParams.color = new THREE.Color(color[0], color[1], color[2]);
                console.log(`Using assigned color ${colorIndex} (${color}) for file ${fileIndex}`);
            }
            
            return new THREE.MeshLambertMaterial(materialParams);
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
    }

    private updateFileList(): void {
        const fileListDiv = document.getElementById('file-list');
        if (!fileListDiv) return;

        let html = '';
        
        for (let i = 0; i < this.plyFiles.length; i++) {
            const data = this.plyFiles[i];
            let colorIndicator = '';
            
            if (this.useOriginalColors && data.hasColors) {
                colorIndicator = '<span class="color-indicator" style="background: linear-gradient(45deg, #ff0000, #00ff00, #0000ff); border: 1px solid #666;"></span>';
            } else {
                const color = this.fileColors[i % this.fileColors.length];
                const colorHex = `#${Math.round(color[0] * 255).toString(16).padStart(2, '0')}${Math.round(color[1] * 255).toString(16).padStart(2, '0')}${Math.round(color[2] * 255).toString(16).padStart(2, '0')}`;
                colorIndicator = `<span class="color-indicator" style="background-color: ${colorHex}"></span>`;
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
                    ${data.faceCount === 0 ? `
                    <div class="point-size-control">
                        <label for="size-${i}">Point Size:</label>
                        <input type="range" id="size-${i}" min="0.0001" max="0.01" step="0.0001" value="${this.pointSizes[i] || 0.001}" class="size-slider">
                        <span class="size-value">${(this.pointSizes[i] || 0.001).toFixed(4)}</span>
                    </div>
                    ` : ''}
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
            
            // Add size slider listeners for point clouds
            const sizeSlider = document.getElementById(`size-${i}`) as HTMLInputElement;
            if (sizeSlider && this.plyFiles[i].faceCount === 0) {
                sizeSlider.addEventListener('input', (e) => {
                    const newSize = parseFloat((e.target as HTMLInputElement).value);
                    this.updatePointSize(i, newSize);
                    
                    // Update the displayed value
                    const sizeValue = document.querySelector(`#size-${i} + .size-value`) as HTMLElement;
                    if (sizeValue) {
                        sizeValue.textContent = newSize.toFixed(4);
                    }
                });
            }
            
            // OLD COLOR SELECTOR LISTENERS REMOVED - now handled globally
        }
        
        // Add remove button listeners
        const removeButtons = fileListDiv.querySelectorAll('.remove-file');
        removeButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                const fileIndex = parseInt((e.target as HTMLElement).getAttribute('data-file-index') || '0');
                this.requestRemoveFile(fileIndex);
            });
        });
        
        const colorToggleBtn = document.getElementById('toggle-colors');
        if (colorToggleBtn) {
            colorToggleBtn.addEventListener('click', this.toggleColorMode.bind(this));
        }
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
        if (errorMsg) {errorMsg.textContent = message;}
        document.getElementById('error')?.classList.remove('hidden');
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
            this.pointSizes.push(0.001); // Initialize with default point size
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
            this.pointSizes[fileIndex] = newSize;
            
            // Update the material if it's a Points material
            const mesh = this.meshes[fileIndex];
            if (mesh instanceof THREE.Points && mesh.material instanceof THREE.PointsMaterial) {
                mesh.material.size = newSize;
            }
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
    }

    private switchToOrbitControls(): void {
        if (this.controlType === 'orbit') return;
        
        console.log('🔄 Switching to OrbitControls');
        this.controlType = 'orbit';
        this.initializeControls();
        this.updateControlStatus();
    }

    private switchToInverseTrackballControls(): void {
        if (this.controlType === 'inverse-trackball') return;
        
        console.log('🔄 Switching to Inverse TrackballControls');
        this.controlType = 'inverse-trackball';
        this.initializeControls();
        this.updateControlStatus();
    }

    private updateControlStatus(): void {
        const status = this.controlType.toUpperCase();
        console.log(`📊 Camera Controls: ${status}`);
        
        // Update UI if there's a status display
        const statusElement = document.getElementById('camera-control-status');
        if (statusElement) {
            statusElement.textContent = status;
        }
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
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new PLYVisualizer());
} else {
    new PLYVisualizer();
} 