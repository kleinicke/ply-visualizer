import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';

declare const acquireVsCodeApi: () => {
    postMessage: (message: any) => void;
    setState: (state: any) => void;
    getState: () => any;
};

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
 * Modern PLY Visualizer with TypeScript and proper Three.js imports
 */
class PLYVisualizer {
    private vscode = acquireVsCodeApi();
    private scene!: THREE.Scene;
    private camera!: THREE.PerspectiveCamera;
    private renderer!: THREE.WebGLRenderer;
    private controls!: OrbitControls;
    private currentMesh: THREE.Mesh | THREE.Points | null = null;
    private currentGeometry: THREE.BufferGeometry | null = null;
    private currentMaterial: THREE.Material | null = null;
    private isWireframe = false;
    private showAsPoints = false;
    private plyData: PlyData | null = null;
    
    // Multi-file support
    private isMultiViewer = false;
    private multiPlyData: PlyData[] = [];
    private multiMeshes: (THREE.Mesh | THREE.Points)[] = [];
    private fileVisibility: boolean[] = [];
    private useOriginalColors = false;
    
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
            console.log('Three.js loaded successfully, version:', THREE.REVISION);
            
            this.initThreeJS();
            this.setupEventListeners();
            this.setupMessageHandler();
            
        } catch (error) {
            this.showError(`Failed to initialize PLY Visualizer: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private initThreeJS(): void {
        const container = document.getElementById('viewer-container');
        const canvas = document.getElementById('three-canvas') as HTMLCanvasElement;
        
        if (!container || !canvas) {
            throw new Error('Required DOM elements not found');
        }
        
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x1e1e1e);

        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            container.clientWidth / container.clientHeight,
            0.1,
            10000
        );

        // Renderer
        this.renderer = new THREE.WebGLRenderer({ 
            canvas: canvas,
            antialias: true 
        });
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.screenSpacePanning = false;
        this.controls.minDistance = 0.1;
        this.controls.maxDistance = 1000;

        // Lights
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        directionalLight.castShadow = true;
        directionalLight.shadow.mapSize.width = 2048;
        directionalLight.shadow.mapSize.height = 2048;
        this.scene.add(directionalLight);

        // Handle window resize
        window.addEventListener('resize', this.onWindowResize.bind(this), false);

        // Start render loop
        this.animate();
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
        if (data.faces && data.faces.length > 0) {
            const indices: number[] = [];
            for (const face of data.faces) {
                if (face.indices.length >= 3) {
                    // Triangulate face (simple fan triangulation)
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
        geometry.computeBoundingSphere();

        return geometry;
    }

    private createMaterial(hasColors: boolean, hasNormals: boolean): THREE.Material {
        const materialParams: any = {
            vertexColors: hasColors,
            side: THREE.DoubleSide,
        };

        if (this.showAsPoints) {
            const pointSize = 0.001; // Small to prevent z-fighting
            console.log('Using fixed point size:', pointSize);
            
            return new THREE.PointsMaterial({
                ...materialParams,
                size: pointSize,
                sizeAttenuation: false,
                transparent: false
            });
        } else if (this.isWireframe) {
            return new THREE.MeshBasicMaterial({
                ...materialParams,
                wireframe: true
            });
        } else {
            return new THREE.MeshLambertMaterial(materialParams);
        }
    }

    private displayPlyData(data: PlyData): void {
        // Remove existing mesh
        if (this.currentMesh) {
            this.scene.remove(this.currentMesh);
            if (this.currentGeometry) {this.currentGeometry.dispose();}
            if (this.currentMaterial) {this.currentMaterial.dispose();}
        }

        // Create geometry
        this.currentGeometry = this.createGeometryFromPlyData(data);
        
        // Create mesh or points - default to points for point clouds, mesh for models with faces
        const shouldShowAsPoints = this.showAsPoints || data.faceCount === 0;
        this.showAsPoints = shouldShowAsPoints;
        
        // Create material AFTER updating showAsPoints
        this.currentMaterial = this.createMaterial(data.hasColors, data.hasNormals);
        
        // Store the rendering mode for display in info panel
        const renderingMode = shouldShowAsPoints ? 'Points' : 'Mesh';
        
        if (shouldShowAsPoints) {
            this.currentMesh = new THREE.Points(this.currentGeometry, this.currentMaterial);
            console.log('Rendering as POINTS');
        } else {
            this.currentMesh = new THREE.Mesh(this.currentGeometry, this.currentMaterial);
            console.log('Rendering as MESH');
        }

        this.scene.add(this.currentMesh);

        // Fit camera to object
        this.fitCameraToObject(this.currentMesh);

        // Update file statistics
        this.updateFileStats(data, renderingMode);

        // Hide loading indicator
        document.getElementById('loading')?.classList.add('hidden');
    }

    private setupEventListeners(): void {
        document.getElementById('reset-camera')?.addEventListener('click', this.resetCamera.bind(this));
        document.getElementById('toggle-wireframe')?.addEventListener('click', this.toggleWireframe.bind(this));
        document.getElementById('toggle-points')?.addEventListener('click', this.togglePoints.bind(this));
        
        // Multi-viewer event listeners
        const toggleAllBtn = document.getElementById('toggle-all');
        if (toggleAllBtn) {
            toggleAllBtn.addEventListener('click', this.toggleAllFiles.bind(this));
        }
    }

    private setupMessageHandler(): void {
        window.addEventListener('message', event => {
            const message = event.data;
            
            switch (message.type) {
                case 'plyData':
                    try {
                        this.plyData = message.data;
                        if (this.plyData) {
                            this.displayPlyData(this.plyData);
                        }
                    } catch (error) {
                        console.error('Error displaying PLY data:', error);
                        this.showError('Failed to display PLY data: ' + (error instanceof Error ? error.message : String(error)));
                    }
                    break;
                case 'multiPlyData':
                    try {
                        this.displayMultiPlyData(message.data);
                    } catch (error) {
                        console.error('Error displaying multi PLY data:', error);
                        this.showError('Failed to display PLY data: ' + (error instanceof Error ? error.message : String(error)));
                    }
                    break;
            }
        });
    }

    // Additional methods would be implemented here...
    private displayMultiPlyData(dataArray: PlyData[]): void {
        this.isMultiViewer = true;
        this.multiPlyData = dataArray;
        this.multiMeshes = [];
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
        const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
        this.scene.add(ambientLight);
        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
        directionalLight.position.set(10, 10, 5);
        this.scene.add(directionalLight);

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
            this.multiMeshes.push(mesh);
            this.fileVisibility.push(true);
        }

        // Fit camera to all objects
        this.fitCameraToAllObjects();

        // Update UI
        this.updateMultiFileStats();
        this.updateFileList();

        // Hide loading indicator
        document.getElementById('loading')?.classList.add('hidden');
    }

    private createMaterialForFile(data: PlyData, fileIndex: number): THREE.Material {
        const shouldShowAsPoints = data.faceCount === 0;
        
        console.log(`Creating material for file ${fileIndex}:`, {
            useOriginalColors: this.useOriginalColors,
            hasColors: data.hasColors,
            shouldShowAsPoints,
            isWireframe: this.isWireframe
        });

        if (shouldShowAsPoints) {
            const materialParams: any = {
                size: 0.001,
                sizeAttenuation: false,
                transparent: false
            };
            
            if (this.useOriginalColors) {
                if (data.hasColors) {
                    materialParams.vertexColors = true;
                    console.log(`Using original vertex colors for points file ${fileIndex}`);
                } else {
                    const color = this.fileColors[fileIndex % this.fileColors.length];
                    materialParams.color = new THREE.Color(color[0], color[1], color[2]);
                    console.log(`Using assigned color for points file ${fileIndex}:`, color);
                }
            } else {
                const color = this.fileColors[fileIndex % this.fileColors.length];
                materialParams.color = new THREE.Color(color[0], color[1], color[2]);
                console.log(`Using assigned color for points file ${fileIndex}:`, color);
            }
            
            return new THREE.PointsMaterial(materialParams);
        } else {
            const materialParams: any = {
                side: THREE.DoubleSide,
                wireframe: this.isWireframe
            };
            
            if (this.useOriginalColors) {
                if (data.hasColors) {
                    materialParams.vertexColors = true;
                    console.log(`Using original vertex colors for mesh file ${fileIndex}`);
                } else {
                    const color = this.fileColors[fileIndex % this.fileColors.length];
                    materialParams.color = new THREE.Color(color[0], color[1], color[2]);
                    console.log(`Using assigned color for mesh file ${fileIndex}:`, color);
                }
            } else {
                const color = this.fileColors[fileIndex % this.fileColors.length];
                materialParams.color = new THREE.Color(color[0], color[1], color[2]);
                console.log(`Using assigned color for mesh file ${fileIndex}:`, color);
            }
            
            return this.isWireframe ? 
                new THREE.MeshBasicMaterial(materialParams) :
                new THREE.MeshLambertMaterial(materialParams);
        }
    }

    private fitCameraToAllObjects(): void {
        if (this.multiMeshes.length === 0) {return;}

        const box = new THREE.Box3();
        for (const mesh of this.multiMeshes) {
            if (mesh.visible) {
                box.expandByObject(mesh);
            }
        }

        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = this.camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

        cameraZ *= 2;

        this.camera.position.set(center.x, center.y, center.z + cameraZ);
        this.camera.lookAt(center);
        
        this.controls.target.copy(center);
        this.controls.maxDistance = cameraZ * 10;
        this.controls.update();
    }

    private updateMultiFileStats(): void {
        const totalVertices = this.multiPlyData.reduce((sum, data) => sum + data.vertexCount, 0);
        const totalFaces = this.multiPlyData.reduce((sum, data) => sum + data.faceCount, 0);
        
        const statsDiv = document.getElementById('file-stats');
        if (!statsDiv) {return;}
        
        statsDiv.innerHTML = `
            <div><strong>Total Files:</strong> ${this.multiPlyData.length}</div>
            <div><strong>Total Vertices:</strong> ${totalVertices.toLocaleString()}</div>
            <div><strong>Total Faces:</strong> ${totalFaces.toLocaleString()}</div>
        `;
    }

    private updateFileList(): void {
        const fileListDiv = document.getElementById('file-list');
        if (!fileListDiv) {return;}

        let html = `<h5>Files (${this.useOriginalColors ? 'Original Colors' : 'Assigned Colors'}):</h5>`;
        html += `<button id="toggle-colors" style="margin-bottom: 8px; font-size: 10px; padding: 4px 8px;">${this.useOriginalColors ? 'Use Assigned Colors' : 'Use Original Colors'}</button>`;
        
        for (let i = 0; i < this.multiPlyData.length; i++) {
            const data = this.multiPlyData[i];
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
                    <input type="checkbox" id="file-${i}" ${this.fileVisibility[i] ? 'checked' : ''}>
                    ${colorIndicator}
                    <label for="file-${i}">${data.fileName || `File ${i + 1}`}</label>
                    <span class="file-info">(${data.vertexCount} vertices)</span>
                </div>
            `;
        }
        
        fileListDiv.innerHTML = html;
        
        // Add event listeners after setting innerHTML
        for (let i = 0; i < this.multiPlyData.length; i++) {
            const checkbox = document.getElementById(`file-${i}`);
            if (checkbox) {
                checkbox.addEventListener('change', () => this.toggleFileVisibility(i));
            }
        }
        
        const colorToggleBtn = document.getElementById('toggle-colors');
        if (colorToggleBtn) {
            colorToggleBtn.addEventListener('click', this.toggleColorMode.bind(this));
        }
    }

    private toggleFileVisibility(fileIndex: number): void {
        if (fileIndex >= 0 && fileIndex < this.multiMeshes.length) {
            this.fileVisibility[fileIndex] = !this.fileVisibility[fileIndex];
            this.multiMeshes[fileIndex].visible = this.fileVisibility[fileIndex];
        }
    }

    private toggleAllFiles(): void {
        const allVisible = this.fileVisibility.every(visible => visible);
        const newVisibility = !allVisible;
        
        for (let i = 0; i < this.fileVisibility.length; i++) {
            this.fileVisibility[i] = newVisibility;
            this.multiMeshes[i].visible = newVisibility;
        }
        
        this.updateFileList();
    }

    private toggleColorMode(): void {
        if (!this.isMultiViewer) {return;}
        
        this.useOriginalColors = !this.useOriginalColors;
        console.log('Toggling color mode to:', this.useOriginalColors ? 'Original Colors' : 'Assigned Colors');
        
        // Recreate materials for all meshes
        for (let i = 0; i < this.multiMeshes.length; i++) {
            const oldMaterial = this.multiMeshes[i].material;
            const newMaterial = this.createMaterialForFile(this.multiPlyData[i], i);
            this.multiMeshes[i].material = newMaterial;
            
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

    private fitCameraToObject(object: THREE.Object3D): void {
        const box = new THREE.Box3().setFromObject(object);
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

    private updateFileStats(data: PlyData, renderingMode?: string): void {
        const statsDiv = document.getElementById('file-stats');
        if (!statsDiv) {return;}
        
        statsDiv.innerHTML = `
            <div><strong>Vertices:</strong> ${data.vertexCount.toLocaleString()}</div>
            <div><strong>Faces:</strong> ${data.faceCount.toLocaleString()}</div>
            <div><strong>Format:</strong> ${data.format}</div>
            <div><strong>Colors:</strong> ${data.hasColors ? 'Yes' : 'No'}</div>
            <div><strong>Normals:</strong> ${data.hasNormals ? 'Yes' : 'No'}</div>
            <div><strong>Rendering Mode:</strong> ${renderingMode || (this.showAsPoints ? 'Points' : 'Mesh')}</div>
            ${data.comments.length > 0 ? `<div><strong>Comments:</strong><br>${data.comments.join('<br>')}</div>` : ''}
        `;
    }

    private showError(message: string): void {
        document.getElementById('loading')?.classList.add('hidden');
        const errorMsg = document.getElementById('error-message');
        if (errorMsg) {errorMsg.textContent = message;}
        document.getElementById('error')?.classList.remove('hidden');
    }

    private resetCamera(): void {
        if (this.currentMesh) {
            this.fitCameraToObject(this.currentMesh);
        }
    }

    private toggleWireframe(): void {
        if (!this.currentMesh || !this.plyData || !this.currentGeometry) {return;}
        
        this.isWireframe = !this.isWireframe;
        
        // Recreate material
        const oldMaterial = this.currentMaterial;
        this.currentMaterial = this.createMaterial(this.plyData.hasColors, this.plyData.hasNormals);
        this.currentMesh.material = this.currentMaterial;
        
        if (oldMaterial) {oldMaterial.dispose();}
        
        // Update the file stats to reflect current mode
        this.updateFileStats(this.plyData);
    }

    private togglePoints(): void {
        if (!this.currentMesh || !this.plyData || !this.currentGeometry) {return;}
        
        this.showAsPoints = !this.showAsPoints;
        
        // Remove current mesh
        this.scene.remove(this.currentMesh);
        
        // Create new mesh/points
        const oldMaterial = this.currentMaterial;
        this.currentMaterial = this.createMaterial(this.plyData.hasColors, this.plyData.hasNormals);
        
        if (this.showAsPoints) {
            this.currentMesh = new THREE.Points(this.currentGeometry, this.currentMaterial);
        } else {
            this.currentMesh = new THREE.Mesh(this.currentGeometry, this.currentMaterial);
        }
        
        this.scene.add(this.currentMesh);
        
        if (oldMaterial) {oldMaterial.dispose();}
        
        // Update the file stats to show new rendering mode
        this.updateFileStats(this.plyData);
    }
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => new PLYVisualizer());
} else {
    new PLYVisualizer();
} 