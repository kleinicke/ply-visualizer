import * as THREE from 'three';
import { PlyData } from '../../webview/interfaces';

export interface FileUtilsCallbacks {
    // Scene and object management
    getScene: () => THREE.Scene;
    getMeshes: () => THREE.Object3D[];
    getPoseGroups: () => THREE.Group[];
    getCameraGroups: () => THREE.Group[];
    getFiles: () => PlyData[];
    getFileVisibility: () => boolean[];
    
    // Camera operations
    getCamera: () => THREE.PerspectiveCamera;
    getControls: () => any;
    
    // UI and messaging
    postMessage: (message: any) => void;
    showErrorDialog?: (message: string) => void;
    
    // File operations
    updateFileList: () => void;
    updateFileStats: () => void;
}

/**
 * File management utilities - extracted from main.ts
 * Handles file operations, error display, camera fitting, and object management
 */
export class FileUtils {
    constructor(private callbacks: FileUtilsCallbacks) {}

    /**
     * Display error message to user - extracted from main.ts
     */
    showError(message: string): void {
        // Log to console for developer tools visibility
        console.error('PLY Visualizer Error:', message);
        
        // Try to use custom error dialog if available
        if (this.callbacks.showErrorDialog) {
            this.callbacks.showErrorDialog(message);
            return;
        }
        
        // Use DOM-based error display for webview context
        try {
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
                if (closeBtn && !closeBtn.hasAttribute('data-listener-added')) {
                    closeBtn.setAttribute('data-listener-added', 'true');
                    closeBtn.addEventListener('click', () => {
                        this.clearError();
                    });
                }
            }
        } catch (domError) {
            // Fallback to basic alert if DOM manipulation fails
            if (typeof window !== 'undefined' && typeof window.alert === 'function') {
                window.alert(message);
            }
        }
    }

    /**
     * Clear error display - extracted from main.ts
     */
    clearError(): void {
        const errorDiv = document.getElementById('error');
        if (errorDiv) {
            errorDiv.classList.add('hidden');
        }
    }

    /**
     * Clear all mesh objects from scene - extracted from main.ts
     */
    clearMeshes(): void {
        const scene = this.callbacks.getScene();
        const meshes = this.callbacks.getMeshes();
        
        // Remove all mesh objects from scene
        for (const mesh of meshes) {
            if (mesh.parent) {
                mesh.parent.remove(mesh);
            }
            
            // Dispose geometry and materials
            if ((mesh as any).geometry) {
                (mesh as any).geometry.dispose();
            }
            if ((mesh as any).material) {
                const material = (mesh as any).material;
                if (Array.isArray(material)) {
                    material.forEach((mat: any) => mat.dispose && mat.dispose());
                } else if (material.dispose) {
                    material.dispose();
                }
            }
        }
        
        // Clear the meshes array
        meshes.length = 0;
    }

    /**
     * Clear PLY file data - extracted from main.ts
     */
    clearPlyFiles(): void {
        const files = this.callbacks.getFiles();
        files.length = 0;
    }

    /**
     * Fit camera to view all objects - extracted from main.ts
     */
    fitCameraToAllObjects(): void {
        const meshes = this.callbacks.getMeshes();
        const poseGroups = this.callbacks.getPoseGroups();
        const cameraGroups = this.callbacks.getCameraGroups();
        const camera = this.callbacks.getCamera();
        const controls = this.callbacks.getControls();
        
        // Combine all visible objects
        const allObjects: THREE.Object3D[] = [
            ...meshes.filter((_, i) => this.callbacks.getFileVisibility()[i]),
            ...poseGroups.filter((_, i) => {
                const poseIndex = meshes.length + i;
                return this.callbacks.getFileVisibility()[poseIndex];
            }),
            ...cameraGroups.filter((_, i) => {
                const cameraIndex = meshes.length + poseGroups.length + i;
                return this.callbacks.getFileVisibility()[cameraIndex];
            })
        ];

        if (allObjects.length === 0) return;

        // Calculate bounding box for all visible objects
        const box = new THREE.Box3();
        for (const obj of allObjects) {
            box.expandByObject(obj);
        }

        if (box.isEmpty()) return;

        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        // Calculate optimal camera distance
        const fov = camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        cameraZ *= 2; // Add padding

        // Position camera
        camera.position.set(center.x, center.y, center.z + cameraZ);
        camera.lookAt(center);

        // Update controls target
        if (controls && controls.target) {
            controls.target.copy(center);
            controls.update();
        }

        // Update camera clipping planes for large datasets
        camera.near = Math.max(0.001, Math.min(0.1, cameraZ / 10000));
        camera.far = Math.max(cameraZ * 100, 1000000);
        camera.updateProjectionMatrix();
    }

    /**
     * Check mesh visibility for debugging - extracted from main.ts
     */
    checkMeshVisibility(): void {
        const meshes = this.callbacks.getMeshes();
        const camera = this.callbacks.getCamera();
        
        // Count visible vs total meshes for debugging
        let visibleCount = 0;
        let totalCount = 0;
        
        for (const mesh of meshes) {
            totalCount++;
            if (mesh.visible && this.isObjectInCameraView(mesh, camera)) {
                visibleCount++;
            }
        }
        
        // Only log if there are significant culling issues
        if (totalCount > 0 && visibleCount / totalCount < 0.5) {
            console.debug(`Mesh visibility: ${visibleCount}/${totalCount} meshes visible`);
        }
    }

    /**
     * Check if object is in camera view - helper for checkMeshVisibility
     */
    private isObjectInCameraView(obj: THREE.Object3D, camera: THREE.PerspectiveCamera): boolean {
        // Simple frustum culling check
        const frustum = new THREE.Frustum();
        const matrix = new THREE.Matrix4().multiplyMatrices(
            camera.projectionMatrix, 
            camera.matrixWorldInverse
        );
        frustum.setFromProjectionMatrix(matrix);

        // Get object bounding box
        const box = new THREE.Box3().setFromObject(obj);
        return frustum.intersectsBox(box);
    }

    /**
     * Create camera visualization object - extracted from main.ts
     */
    createCameraVisualization(
        cameraName: string, 
        location: number[], 
        rotationQuaternion: number[], 
        rotationType?: string
    ): THREE.Group {
        const cameraGroup = new THREE.Group();
        cameraGroup.name = `camera_${cameraName}`;

        // Create camera frustum visualization
        const frustumGeometry = new THREE.ConeGeometry(0.1, 0.3, 4);
        const frustumMaterial = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00, 
            wireframe: true 
        });
        const frustumMesh = new THREE.Mesh(frustumGeometry, frustumMaterial);
        
        // Create camera body
        const bodyGeometry = new THREE.BoxGeometry(0.2, 0.15, 0.1);
        const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x444444 });
        const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
        
        cameraGroup.add(frustumMesh);
        cameraGroup.add(bodyMesh);

        // Set position
        if (location && location.length >= 3) {
            cameraGroup.position.set(location[0], location[1], location[2]);
        }

        // Set rotation
        if (rotationQuaternion && rotationQuaternion.length >= 4) {
            const [x, y, z, w] = rotationQuaternion;
            cameraGroup.quaternion.set(x, y, z, w);
        }

        return cameraGroup;
    }

    /**
     * Remove file by index - extracted from main.ts
     */
    removeFileByIndex(fileIndex: number): void {
        const meshes = this.callbacks.getMeshes();
        const poseGroups = this.callbacks.getPoseGroups();
        const cameraGroups = this.callbacks.getCameraGroups();
        const files = this.callbacks.getFiles();
        const scene = this.callbacks.getScene();

        // Determine which type of object we're removing
        if (fileIndex < meshes.length) {
            // Remove mesh
            const mesh = meshes[fileIndex];
            if (mesh) {
                scene.remove(mesh);
                if ((mesh as any).geometry) (mesh as any).geometry.dispose();
                if ((mesh as any).material) {
                    const mat = (mesh as any).material;
                    if (Array.isArray(mat)) mat.forEach(m => m.dispose?.());
                    else mat.dispose?.();
                }
            }
            meshes.splice(fileIndex, 1);
            files.splice(fileIndex, 1);
        } else if (fileIndex < meshes.length + poseGroups.length) {
            // Remove pose
            const poseIndex = fileIndex - meshes.length;
            const poseGroup = poseGroups[poseIndex];
            if (poseGroup) {
                scene.remove(poseGroup);
            }
            poseGroups.splice(poseIndex, 1);
        } else {
            // Remove camera
            const cameraIndex = fileIndex - meshes.length - poseGroups.length;
            const cameraGroup = cameraGroups[cameraIndex];
            if (cameraGroup) {
                scene.remove(cameraGroup);
            }
            cameraGroups.splice(cameraIndex, 1);
        }

        // Update UI
        this.callbacks.updateFileList();
        this.callbacks.updateFileStats();
    }

    /**
     * Send message to extension host - extracted from main.ts
     */
    postMessage(message: any): void {
        this.callbacks.postMessage(message);
    }

    /**
     * Request file removal from extension - extracted from main.ts
     */
    requestRemoveFile(fileIndex: number): void {
        this.postMessage({
            type: 'removeFile',
            fileIndex
        });
    }

    /**
     * Save PLY file data - extracted from main.ts
     */
    savePlyFile(fileName: string, data: PlyData): void {
        try {
            this.postMessage({
                type: 'savePly',
                fileName,
                data
            });
        } catch (error) {
            this.showError(`Failed to save PLY file: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Validate file data integrity - utility function
     */
    validateFileData(data: PlyData): boolean {
        if (!data) return false;
        if (!data.vertices || data.vertices.length === 0) return false;
        if (data.vertices.length % 3 !== 0) return false;
        return true;
    }

    /**
     * Get file extension from filename - utility function
     */
    getFileExtension(fileName: string): string {
        const lastDot = fileName.lastIndexOf('.');
        return lastDot >= 0 ? fileName.substring(lastDot + 1).toLowerCase() : '';
    }

    /**
     * Format file size for display - utility function
     */
    formatFileSize(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Format vertex count for display - utility function
     */
    formatVertexCount(count: number): string {
        if (count < 1000) return count.toString();
        if (count < 1000000) return (count / 1000).toFixed(1) + 'K';
        return (count / 1000000).toFixed(1) + 'M';
    }
}