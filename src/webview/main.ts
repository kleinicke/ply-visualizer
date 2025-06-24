import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

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
    private controls!: OrbitControls;
    
    // Unified file management
    private plyFiles: PlyData[] = [];
    private meshes: (THREE.Mesh | THREE.Points)[] = [];
    private fileVisibility: boolean[] = [];
    private useOriginalColors = true; // Default to original colors
    
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

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.1;

        // Lighting
        this.initSceneLighting();

        // Window resize
        window.addEventListener('resize', this.onWindowResize.bind(this));

        // Start render loop
        this.animate();
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
    }

    private animate(): void {
        requestAnimationFrame(this.animate.bind(this));
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    private createGeometryFromPlyData(data: PlyData): THREE.BufferGeometry {
        const geometry = new THREE.BufferGeometry();
        
        // Extract vertices
        const vertices = new Float32Array(data.vertices.length * 3);
        const colors = data.hasColors ? new Float32Array(data.vertices.length * 3) : null;
        const normals = data.hasNormals ? new Float32Array(data.vertices.length * 3) : null;

        for (let i = 0; i < data.vertices.length; i++) {
            const vertex = data.vertices[i];
            const i3 = i * 3;
            
            vertices[i3] = vertex.x;
            vertices[i3 + 1] = vertex.y;
            vertices[i3 + 2] = vertex.z;

            if (colors && vertex.red !== undefined) {
                colors[i3] = vertex.red / 255;
                colors[i3 + 1] = (vertex.green || 0) / 255;
                colors[i3 + 2] = (vertex.blue || 0) / 255;
            }

            if (normals && vertex.nx !== undefined) {
                normals[i3] = vertex.nx;
                normals[i3 + 1] = vertex.ny || 0;
                normals[i3 + 2] = vertex.nz || 0;
            }
        }

        geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
        
        if (colors) {
            geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        }

        if (normals) {
            geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
        } else {
            geometry.computeVertexNormals();
        }

        // Add faces if available
        if (data.faces.length > 0) {
            const indices: number[] = [];
            for (const face of data.faces) {
                if (face.indices.length >= 3) {
                    // Triangulate faces (simple fan triangulation)
                    for (let i = 1; i < face.indices.length - 1; i++) {
                        indices.push(face.indices[0], face.indices[i], face.indices[i + 1]);
                    }
                }
            }
            if (indices.length > 0) {
                geometry.setIndex(indices);
            }
        }

        geometry.computeBoundingBox();
        return geometry;
    }

    private setupEventListeners(): void {
        document.getElementById('reset-camera')?.addEventListener('click', this.resetCamera.bind(this));
        document.getElementById('toggle-wireframe')?.addEventListener('click', this.toggleWireframe.bind(this));
        document.getElementById('toggle-points')?.addEventListener('click', this.togglePoints.bind(this));
        
        // File management event listeners
        document.getElementById('add-file')?.addEventListener('click', this.requestAddFile.bind(this));
        document.getElementById('toggle-all')?.addEventListener('click', this.toggleAllFiles.bind(this));
    }

    private setupMessageHandler(): void {
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'plyData':
                case 'multiPlyData':
                    try {
                        // Both single and multi-file data are handled the same way now
                        const dataArray = Array.isArray(message.data) ? message.data : [message.data];
                        this.displayFiles(dataArray);
                    } catch (error) {
                        console.error('Error displaying PLY data:', error);
                        this.showError('Failed to display PLY data: ' + (error instanceof Error ? error.message : String(error)));
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

            }
        });
    }

    private displayFiles(dataArray: PlyData[]): void {
        this.plyFiles = dataArray;
        this.meshes = [];
        this.fileVisibility = [];

        // Clear existing meshes
        while (this.scene.children.length > 0) {
            const child = this.scene.children[0];
            if (child instanceof THREE.Mesh || child instanceof THREE.Points) {
                if (child.geometry) {child.geometry.dispose();}
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            }
            this.scene.remove(child);
        }

        // Re-add lights
        this.initSceneLighting();

        // Create mesh for each file
        for (let i = 0; i < dataArray.length; i++) {
            const data = dataArray[i];
            const geometry = this.createGeometryFromPlyData(data);
            
            console.log(`Creating geometry for file ${i}:`, {
                vertices: data.vertexCount,
                faces: data.faceCount,
                hasColors: data.hasColors
            });
            
            const material = this.createMaterialForFile(data, i);
            
            const shouldShowAsPoints = data.faceCount === 0;
            const mesh = shouldShowAsPoints ?
                new THREE.Points(geometry, material) :
                new THREE.Mesh(geometry, material);
            
            this.scene.add(mesh);
            this.meshes.push(mesh);
            this.fileVisibility.push(true);
        }

        // Fit camera to all objects
        this.fitCameraToAllObjects();

        // Update UI
        this.updateFileStats();
        this.updateFileList();

        // Hide loading indicator
        document.getElementById('loading')?.classList.add('hidden');
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
        this.controls.maxDistance = cameraZ * 10;
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
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new PLYVisualizer());
} else {
    new PLYVisualizer();
} 