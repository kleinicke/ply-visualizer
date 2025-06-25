import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls';

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
    private controls!: TrackballControls;
    
    // Unified file management
    private plyFiles: PlyData[] = [];
    private meshes: (THREE.Mesh | THREE.Points)[] = [];
    private fileVisibility: boolean[] = [];
    private useOriginalColors = true; // Default to original colors
    
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

        // Controls - Trackball for better point cloud navigation
        this.controls = new TrackballControls(this.camera, this.renderer.domElement);
        this.controls.rotateSpeed = 2.0;  // Responsive rotation
        this.controls.zoomSpeed = 2.5;    // Fast zooming
        this.controls.panSpeed = 1.5;     // Good panning speed
        this.controls.noZoom = false;
        this.controls.noPan = false;
        this.controls.staticMoving = false; // Enable smooth movement
        this.controls.dynamicDampingFactor = 0.15; // Smooth damping
        
        // Set up screen coordinates for proper rotation
        this.controls.screen.left = 0;
        this.controls.screen.top = 0;
        this.controls.screen.width = this.renderer.domElement.clientWidth;
        this.controls.screen.height = this.renderer.domElement.clientHeight;
        
        // Fix Z-axis rotation direction
        this.setupZAxisRotationFix();

        // Lighting
        this.initSceneLighting();

        // Add coordinate axes helper
        this.addAxesHelper();

        // Window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));

        // Double-click to change rotation center (like CloudCompare)
        this.renderer.domElement.addEventListener('dblclick', this.onDoubleClick.bind(this));

        // Start render loop
        this.animate();
    }

    private setupZAxisRotationFix(): void {
        // Simple approach: just invert the rotateSpeed to fix Z-axis rotation direction
        // This affects all rotations but should make Z-axis feel more natural
        this.controls.rotateSpeed *= -1;
    }

    private addAxesHelper(): void {
        // Create coordinate axes helper (X=red, Y=green, Z=blue)
        const axesHelper = new THREE.AxesHelper(1); // Size of 1 unit
        
        // Scale the axes based on the scene size once we have objects
        // For now, use a reasonable default size
        axesHelper.scale.setScalar(0.5);
        
        // Position it at the origin
        axesHelper.position.set(0, 0, 0);
        
        // Add to scene
        this.scene.add(axesHelper);
        
        // Store reference for potential resizing later
        (this as any).axesHelper = axesHelper;
    }

    private updateAxesSize(): void {
        const axesHelper = (this as any).axesHelper;
        if (!axesHelper || this.meshes.length === 0) {return;}

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

        axesHelper.scale.setScalar(axesSize);
        
        // Position axes at the bottom-left corner of the bounding box
        const center = box.getCenter(new THREE.Vector3());
        const min = box.min;
        axesHelper.position.set(
            min.x + axesSize * 0.5,
            min.y + axesSize * 0.5,
            min.z + axesSize * 0.5
        );
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
        
        // Update trackball controls screen size for proper rotation
        this.controls.screen.width = container.clientWidth;
        this.controls.screen.height = container.clientHeight;
        this.controls.handleResize();
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
            
            // Set this point as the new rotation center
            this.setRotationCenter(intersectionPoint);
            
            console.log('New rotation center set at:', intersectionPoint);
        }
    }

    private setRotationCenter(point: THREE.Vector3): void {
        // Set the new target for the trackball controls
        this.controls.target.copy(point);
        
        // Optionally adjust camera position to maintain good viewing angle
        const currentDistance = this.camera.position.distanceTo(this.controls.target);
        
        // Update controls
        this.controls.update();
        
        // Visual feedback - could add a temporary marker here
        this.showRotationCenterFeedback(point);
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
        document.getElementById('reset-camera')?.addEventListener('click', this.resetCamera.bind(this));
        document.getElementById('toggle-wireframe')?.addEventListener('click', this.toggleWireframe.bind(this));
        document.getElementById('toggle-points')?.addEventListener('click', this.togglePoints.bind(this));
        document.getElementById('toggle-axes')?.addEventListener('click', this.toggleAxes.bind(this));
        
        // File management event listeners
        document.getElementById('add-file')?.addEventListener('click', this.requestAddFile.bind(this));
        document.getElementById('toggle-all')?.addEventListener('click', this.toggleAllFiles.bind(this));
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
        
        // Re-add axes helper if it was removed
        const hasAxes = this.scene.children.some(child => child instanceof THREE.AxesHelper);
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
            
            const geometry = this.createGeometryFromPlyData(data);
            const material = this.createMaterialForFile(data, i);
            
            const shouldShowAsPoints = data.faceCount === 0;
            const mesh = shouldShowAsPoints ?
                new THREE.Points(geometry, material) :
                new THREE.Mesh(geometry, material);
            
            this.scene.add(mesh);
            this.meshes.push(mesh);
            this.fileVisibility.push(true);
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
        this.updateFileStats();
        this.updateFileList();

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
                size: 0.001,
                sizeAttenuation: false,
                transparent: false
            };
            
            if (this.useOriginalColors && data.hasColors) {
                materialParams.vertexColors = true;
            } else {
                const color = this.fileColors[fileIndex % this.fileColors.length];
                materialParams.color = new THREE.Color(color[0], color[1], color[2]);
            }
            
            return new THREE.PointsMaterial(materialParams);
        } else {
            const materialParams: any = {
                side: THREE.DoubleSide,
                wireframe: false
            };
            
            if (this.useOriginalColors && data.hasColors) {
                materialParams.vertexColors = true;
            } else {
                const color = this.fileColors[fileIndex % this.fileColors.length];
                materialParams.color = new THREE.Color(color[0], color[1], color[2]);
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
        if (!fileListDiv) {return;}

        if (this.plyFiles.length === 0) {
            fileListDiv.innerHTML = '<p class="no-files">No files loaded. Click "Add PLY File" to get started.</p>';
            return;
        }

        let html = `<div class="color-mode-section">
            <label>Color Mode:</label>
            <button id="toggle-colors" class="small-button">${this.useOriginalColors ? 'Use Assigned Colors' : 'Use Original Colors'}</button>
        </div>`;
        
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
                </div>
            `;
        }
        
        fileListDiv.innerHTML = html;
        
        // Add event listeners after setting innerHTML  
        for (let i = 0; i < this.plyFiles.length; i++) {
            const checkbox = document.getElementById(`file-${i}`);
            if (checkbox) {
                checkbox.addEventListener('change', () => this.toggleFileVisibility(i));
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

    private toggleAllFiles(): void {
        const allVisible = this.fileVisibility.every(visible => visible);
        const newVisibility = !allVisible;
        
        for (let i = 0; i < this.fileVisibility.length; i++) {
            this.fileVisibility[i] = newVisibility;
            this.meshes[i].visible = newVisibility;
        }
        
        this.updateFileList();
    }

    private toggleColorMode(): void {
        this.useOriginalColors = !this.useOriginalColors;
        console.log('Toggling color mode to:', this.useOriginalColors ? 'Original Colors' : 'Assigned Colors');
        
        // Recreate materials for all meshes
        for (let i = 0; i < this.meshes.length; i++) {
            const oldMaterial = this.meshes[i].material;
            const newMaterial = this.createMaterialForFile(this.plyFiles[i], i);
            this.meshes[i].material = newMaterial;
            
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

    private resetCamera(): void {
        this.fitCameraToAllObjects();
    }

    private toggleWireframe(): void {
        // Toggle wireframe for all mesh materials
        for (let i = 0; i < this.meshes.length; i++) {
            const mesh = this.meshes[i];
            if (mesh instanceof THREE.Mesh && mesh.material instanceof THREE.MeshLambertMaterial) {
                mesh.material.wireframe = !mesh.material.wireframe;
            }
        }
    }

    private togglePoints(): void {
        // Convert between mesh and points representation
        for (let i = 0; i < this.meshes.length; i++) {
            const oldMesh = this.meshes[i];
            const data = this.plyFiles[i];
            
            this.scene.remove(oldMesh);
            
            const isCurrentlyMesh = oldMesh instanceof THREE.Mesh;
            const shouldShowAsPoints = !isCurrentlyMesh;
            
            const material = this.createMaterialForFile(data, i);
            const newMesh = shouldShowAsPoints ?
                new THREE.Points(oldMesh.geometry, material) :
                new THREE.Mesh(oldMesh.geometry, material);
            
            this.scene.add(newMesh);
            this.meshes[i] = newMesh;
            
            // Dispose old material
            if (oldMesh.material) {
                if (Array.isArray(oldMesh.material)) {
                    oldMesh.material.forEach(mat => mat.dispose());
                } else {
                    oldMesh.material.dispose();
                }
            }
        }
    }

    private toggleAxes(): void {
        const axesHelper = (this as any).axesHelper;
        if (axesHelper) {
            axesHelper.visible = !axesHelper.visible;
            console.log('Axes helper', axesHelper.visible ? 'shown' : 'hidden');
        }
    }

    private showImmediateLoading(fileName: string): void {
        const uiStartTime = performance.now();
        console.log(`🎬 UI: Showing immediate loading for ${fileName} at ${uiStartTime.toFixed(1)}ms`);
        
        // Store timing for complete analysis
        (window as any).loadingStartTime = uiStartTime;
        
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
        }

        // Update UI
        this.updateFileList();
        this.updateFileStats();
        this.fitCameraToAllObjects();

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

        // Reassign file indices
        for (let i = 0; i < this.plyFiles.length; i++) {
            this.plyFiles[i].fileIndex = i;
        }

        // Update UI
        this.updateFileList();
        this.updateFileStats();
        
        if (this.plyFiles.length > 0) {
            this.fitCameraToAllObjects();
        }

        console.log(`Removed file at index ${fileIndex}`);
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
        const loadingStartTime = (window as any).loadingStartTime || 0;
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
        console.log(`🎯 COMPLETE LOADING TIME: ${completeLoadTime.toFixed(1)}ms (UI show → Point cloud visible)`);
        console.log(`📊 Breakdown: Extension ${extensionProcessingTime.toFixed(1)}ms + Conversion ${conversionTime.toFixed(1)}ms + Geometry ${(totalTime - startTime - conversionTime).toFixed(1)}ms`);
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
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new PLYVisualizer());
} else {
    new PLYVisualizer();
} 