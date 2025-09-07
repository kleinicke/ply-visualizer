import * as THREE from 'three';
import { MathUtils } from '../utils/MathUtils';

export interface TransformationManagerCallbacks {
    // Mesh and object access
    getMeshes: () => THREE.Object3D[];
    getPoseGroups: () => THREE.Group[];
    getCameraGroups: () => THREE.Group[];
    getFileCount: () => number;
    
    // Point size and scaling
    getPointSizes: () => number[];
    applyCameraScale: (cameraIndex: number, size: number) => void;
    
    // UI updates
    updateMatrixTextarea: (fileIndex: number) => void;
    showError: (message: string) => void;
}

/**
 * Transformation matrix management - extracted from main.ts
 * Handles per-file transformation matrices and matrix operations
 */
export class TransformationManager {
    private transformationMatrices: THREE.Matrix4[] = [];
    
    constructor(private callbacks: TransformationManagerCallbacks) {}

    /**
     * Initialize transformation matrices for all files
     */
    initializeMatrices(fileCount: number): void {
        // Resize matrix array to match file count
        while (this.transformationMatrices.length < fileCount) {
            this.transformationMatrices.push(new THREE.Matrix4()); // Identity matrix
        }
        
        // Remove excess matrices
        if (this.transformationMatrices.length > fileCount) {
            this.transformationMatrices.splice(fileCount);
        }
    }

    /**
     * Set transformation matrix for specific file - extracted from main.ts
     */
    setTransformationMatrix(fileIndex: number, matrix: THREE.Matrix4): void {
        if (fileIndex >= 0 && fileIndex < this.transformationMatrices.length) {
            this.transformationMatrices[fileIndex].copy(matrix);
            this.applyTransformationMatrix(fileIndex);
        }
    }

    /**
     * Get transformation matrix for specific file - extracted from main.ts
     */
    getTransformationMatrix(fileIndex: number): THREE.Matrix4 {
        if (fileIndex >= 0 && fileIndex < this.transformationMatrices.length) {
            return this.transformationMatrices[fileIndex].clone();
        }
        return new THREE.Matrix4(); // Return identity matrix if index is invalid
    }

    /**
     * Get transformation matrix as array - extracted from main.ts
     */
    getTransformationMatrixAsArray(fileIndex: number): number[] {
        if (fileIndex >= 0 && fileIndex < this.transformationMatrices.length) {
            return this.transformationMatrices[fileIndex].elements.slice();
        }
        return new THREE.Matrix4().elements.slice(); // Return identity matrix if index is invalid
    }

    /**
     * Apply transformation matrix to objects - extracted from main.ts
     */
    applyTransformationMatrix(fileIndex: number): void {
        if (fileIndex < 0 || fileIndex >= this.transformationMatrices.length) return;
        
        const matrix = this.transformationMatrices[fileIndex];
        const meshes = this.callbacks.getMeshes();
        const poseGroups = this.callbacks.getPoseGroups();
        const cameraGroups = this.callbacks.getCameraGroups();
        const pointSizes = this.callbacks.getPointSizes();
        
        // Handle PLY/mesh files
        if (fileIndex < meshes.length) {
            const mesh = meshes[fileIndex];
            if (mesh) {
                mesh.matrix.copy(matrix);
                mesh.matrixAutoUpdate = false;
            }
            return;
        }
        
        // Handle poses
        const poseIndex = fileIndex - meshes.length;
        if (poseIndex >= 0 && poseIndex < poseGroups.length) {
            const group = poseGroups[poseIndex];
            if (group) {
                group.matrix.copy(matrix);
                group.matrixAutoUpdate = false;
            }
            return;
        }
        
        // Handle cameras
        const cameraIndex = fileIndex - meshes.length - poseGroups.length;
        if (cameraIndex >= 0 && cameraIndex < cameraGroups.length) {
            const group = cameraGroups[cameraIndex];
            if (group) {
                // Apply transformation matrix to camera profile group
                group.matrix.copy(matrix);
                group.matrixAutoUpdate = false;
                
                // Apply scaling only to visual elements, not position
                const size = pointSizes[fileIndex] ?? 1.0;
                this.callbacks.applyCameraScale(cameraIndex, size);
            }
        }
    }

    /**
     * Reset transformation matrix to identity - extracted from main.ts
     */
    resetTransformationMatrix(fileIndex: number): void {
        if (fileIndex >= 0 && fileIndex < this.transformationMatrices.length) {
            this.transformationMatrices[fileIndex].identity();
            this.applyTransformationMatrix(fileIndex);
        }
    }

    /**
     * Multiply transformation matrix by another matrix - extracted from main.ts
     */
    multiplyTransformationMatrices(fileIndex: number, matrix: THREE.Matrix4): void {
        if (fileIndex >= 0 && fileIndex < this.transformationMatrices.length) {
            this.transformationMatrices[fileIndex].multiply(matrix);
            this.applyTransformationMatrix(fileIndex);
        }
    }

    /**
     * Add translation to transformation matrix - extracted from main.ts
     */
    addTranslationToMatrix(fileIndex: number, x: number, y: number, z: number): void {
        if (fileIndex >= 0 && fileIndex < this.transformationMatrices.length) {
            const translationMatrix = MathUtils.createTranslationMatrix(x, y, z);
            this.multiplyTransformationMatrices(fileIndex, translationMatrix);
        }
    }

    /**
     * Apply matrix from text input - extracted from main.ts
     */
    applyMatrixFromTextarea(fileIndex: number, textareaValue: string): boolean {
        try {
            const values = MathUtils.parseSpaceSeparatedValues(textareaValue.replace(/\\n/g, ' '));
            
            if (values.length !== 16) {
                this.callbacks.showError(`Expected 16 matrix values, got ${values.length}`);
                return false;
            }
            
            const matrix = MathUtils.parseMatrixFromString(textareaValue);
            this.setTransformationMatrix(fileIndex, matrix);
            return true;
        } catch (error) {
            this.callbacks.showError(`Invalid matrix format: ${error instanceof Error ? error.message : String(error)}`);
            return false;
        }
    }

    /**
     * Invert transformation matrix - extracted from main.ts
     */
    invertTransformationMatrix(fileIndex: number): void {
        if (fileIndex >= 0 && fileIndex < this.transformationMatrices.length) {
            const currentMatrix = this.getTransformationMatrix(fileIndex);
            
            if (!MathUtils.isInvertible(currentMatrix)) {
                this.callbacks.showError('Matrix is not invertible (determinant is zero)');
                return;
            }
            
            const inverted = currentMatrix.clone().invert();
            this.setTransformationMatrix(fileIndex, inverted);
            this.callbacks.updateMatrixTextarea(fileIndex);
        }
    }

    /**
     * Add rotation to transformation matrix - extracted from main.ts
     */
    addRotationToMatrix(fileIndex: number, axis: 'x' | 'y' | 'z', angle: number): void {
        const rotationMatrix = MathUtils.createRotationMatrix(axis, angle);
        this.multiplyTransformationMatrices(fileIndex, rotationMatrix);
    }

    /**
     * Add quaternion rotation to transformation matrix - extracted from main.ts  
     */
    addQuaternionToMatrix(fileIndex: number, x: number, y: number, z: number, w: number): void {
        const quaternionMatrix = MathUtils.createQuaternionMatrix(x, y, z, w);
        this.multiplyTransformationMatrices(fileIndex, quaternionMatrix);
    }

    /**
     * Add angle-axis rotation to transformation matrix - extracted from main.ts
     */
    addAngleAxisToMatrix(fileIndex: number, axis: THREE.Vector3, angle: number): void {
        const angleAxisMatrix = MathUtils.createAngleAxisMatrix(axis, angle);
        this.multiplyTransformationMatrices(fileIndex, angleAxisMatrix);
    }

    /**
     * Get matrix display string for UI - extracted from main.ts
     */
    getMatrixDisplayString(fileIndex: number): string {
        if (fileIndex >= 0 && fileIndex < this.transformationMatrices.length) {
            return MathUtils.matrixToDisplayString(this.transformationMatrices[fileIndex]);
        }
        return MathUtils.matrixToDisplayString(new THREE.Matrix4()); // Identity matrix
    }

    /**
     * Update matrix textarea in UI - extracted from main.ts
     */
    updateMatrixTextarea(fileIndex: number): void {
        const textareaElement = document.getElementById(`matrix-${fileIndex}`) as HTMLTextAreaElement | null;
        if (textareaElement) {
            textareaElement.value = this.getMatrixDisplayString(fileIndex);
        }
    }

    /**
     * Validate matrix values
     */
    validateMatrix(fileIndex: number): boolean {
        if (fileIndex >= 0 && fileIndex < this.transformationMatrices.length) {
            const matrix = this.transformationMatrices[fileIndex];
            return MathUtils.isValidMatrix(matrix);
        }
        return false;
    }

    /**
     * Get total number of transformation matrices
     */
    getMatrixCount(): number {
        return this.transformationMatrices.length;
    }

    /**
     * Remove transformation matrix at index
     */
    removeTransformationMatrix(fileIndex: number): void {
        if (fileIndex >= 0 && fileIndex < this.transformationMatrices.length) {
            this.transformationMatrices.splice(fileIndex, 1);
        }
    }

    /**
     * Insert identity transformation matrix at index
     */
    insertTransformationMatrix(fileIndex: number): void {
        if (fileIndex >= 0 && fileIndex <= this.transformationMatrices.length) {
            this.transformationMatrices.splice(fileIndex, 0, new THREE.Matrix4());
        }
    }

    /**
     * Clear all transformation matrices
     */
    clearAllMatrices(): void {
        this.transformationMatrices = [];
    }

    /**
     * Copy transformation matrix from one file to another
     */
    copyTransformationMatrix(fromIndex: number, toIndex: number): void {
        if (fromIndex >= 0 && fromIndex < this.transformationMatrices.length &&
            toIndex >= 0 && toIndex < this.transformationMatrices.length) {
            const sourceMatrix = this.transformationMatrices[fromIndex];
            this.setTransformationMatrix(toIndex, sourceMatrix.clone());
        }
    }

    // Dispose resources
    dispose(): void {
        this.transformationMatrices = [];
    }
}