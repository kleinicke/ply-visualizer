import * as THREE from 'three';

/**
 * Mathematical utilities for matrix operations
 * Independent of VS Code APIs
 */
export class MathUtils {
    /**
     * Create a rotation matrix around specified axis
     */
    static createRotationMatrix(axis: 'x' | 'y' | 'z', radians: number): THREE.Matrix4 {
        const matrix = new THREE.Matrix4();
        // const radians = THREE.MathUtils.degToRad(angle);
        
        switch (axis) {
            case 'x':
                matrix.makeRotationX(radians);
                break;
            case 'y':
                matrix.makeRotationY(radians);
                break;
            case 'z':
                matrix.makeRotationZ(radians);
                break;
        }
        
        return matrix;
    }

    /**
     * Create a translation matrix
     */
    static createTranslationMatrix(x: number, y: number, z: number): THREE.Matrix4 {
        const matrix = new THREE.Matrix4();
        matrix.makeTranslation(x, y, z);
        return matrix;
    }

    /**
     * Create a matrix from quaternion
     */
    static createQuaternionMatrix(x: number, y: number, z: number, w: number): THREE.Matrix4 {
        const quaternion = new THREE.Quaternion(x, y, z, w);
        quaternion.normalize(); // Ensure it's a unit quaternion
        const matrix = new THREE.Matrix4();
        matrix.makeRotationFromQuaternion(quaternion);
        return matrix;
    }

    /**
     * Create a matrix from angle-axis representation
     */
    static createAngleAxisMatrix(axis: THREE.Vector3, angle: number): THREE.Matrix4 {
        const quaternion = new THREE.Quaternion();
        quaternion.setFromAxisAngle(axis.normalize(), angle);
        const matrix = new THREE.Matrix4();
        matrix.makeRotationFromQuaternion(quaternion);
        return matrix;
    }

    /**
     * Parse space-separated values into number array
     */
    static parseSpaceSeparatedValues(input: string): number[] {
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

    /**
     * Convert matrix to display format (row-major for UI)
     */
    static matrixToDisplayString(matrix: THREE.Matrix4): string {
        const elements = matrix.elements;
        let matrixStr = '';
        for (let row = 0; row < 4; ++row) {
            for (let col = 0; col < 4; ++col) {
                const index = col * 4 + row; // Three.js uses column-major
                const value = elements[index];
                matrixStr += value.toFixed(6);
                if (col < 3) matrixStr += '  '; // Space between columns
            }
            if (row < 3) matrixStr += '\n'; // Proper newline, not escaped
        }
        return matrixStr;
    }

    /**
     * Parse display format string back to matrix
     */
    static parseMatrixFromString(input: string): THREE.Matrix4 {
        const values = MathUtils.parseSpaceSeparatedValues(input.replace(/\\n/g, ' '));
        if (values.length !== 16) {
            throw new Error(`Expected 16 values, got ${values.length}`);
        }
        
        const matrix = new THREE.Matrix4();
        // Convert from row-major (display) to column-major (Three.js)
        for (let row = 0; row < 4; ++row) {
            for (let col = 0; col < 4; ++col) {
                const displayIndex = row * 4 + col; // Row-major
                const threeIndex = col * 4 + row;   // Column-major
                matrix.elements[threeIndex] = values[displayIndex];
            }
        }
        
        return matrix;
    }

    /**
     * Get camera matrix from camera object
     */
    static getCameraMatrix(camera: THREE.PerspectiveCamera): THREE.Matrix4 {
        const cameraMatrix = new THREE.Matrix4();
        
        // Apply camera position
        const positionMatrix = new THREE.Matrix4();
        positionMatrix.makeTranslation(-camera.position.x, -camera.position.y, -camera.position.z);
        
        // Apply camera rotation (inverse of camera quaternion)
        const rotationMatrix = new THREE.Matrix4();
        rotationMatrix.makeRotationFromQuaternion(camera.quaternion.clone().invert());
        
        // Combine position and rotation
        cameraMatrix.multiply(rotationMatrix).multiply(positionMatrix);
        
        return cameraMatrix;
    }

    /**
     * Check if matrix is valid (not NaN or Infinity)
     */
    static isValidMatrix(matrix: THREE.Matrix4): boolean {
        return matrix.elements.every(element => 
            isFinite(element) && !isNaN(element)
        );
    }

    /**
     * Check if matrix is invertible (determinant != 0)
     */
    static isInvertible(matrix: THREE.Matrix4): boolean {
        return Math.abs(matrix.determinant()) > Number.EPSILON;
    }
}