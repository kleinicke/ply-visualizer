import * as THREE from 'three';
import { PlyData } from '../../webview/interfaces';

export interface MaterialUtilsCallbacks {
    // State access
    getFiles: () => PlyData[];
    getMeshes: () => THREE.Object3D[];
    getIndividualColorModes: () => string[];
    getFileColors: () => [number, number, number][];
    getPointSizes: () => number[];
    
    // Material state
    getLightingMode: () => 'normal' | 'flat' | 'unlit';
    getConvertSrgbToLinear: () => boolean;
    
    // Color processing
    ensureSrgbLUT?: () => void;
    getSrgbToLinearLUT?: () => Float32Array;
    optimizeForPointCount?: (material: THREE.PointsMaterial, pointCount: number) => void;
    
    // UI updates
    updateRenderModeButtonStates: () => void;
}

/**
 * Material management utilities - extracted from main.ts
 * Handles PLY material creation, rebuilding, and mode switching
 */
export class MaterialUtils {
    constructor(private callbacks: MaterialUtilsCallbacks) {}

    /**
     * Create material for PLY file - extracted from main.ts
     */
    createMaterialForFile(data: PlyData, fileIndex: number): THREE.Material {
        const lightingMode = this.callbacks.getLightingMode();
        const convertSrgbToLinear = this.callbacks.getConvertSrgbToLinear();
        const individualColorModes = this.callbacks.getIndividualColorModes();
        const fileColors = this.callbacks.getFileColors();
        const pointSizes = this.callbacks.getPointSizes();
        
        const colorMode = individualColorModes[fileIndex] || 'assigned';
        
        if (data.faceCount > 0) {
            // Mesh material
            const material: THREE.MeshBasicMaterial | THREE.MeshLambertMaterial = lightingMode === 'unlit'
                ? new THREE.MeshBasicMaterial()
                : new THREE.MeshLambertMaterial();
            material.side = THREE.DoubleSide; // More robust visibility if face winding varies
            
            // For files without explicit normals, prefer flat shading to avoid odd gradients
            if (material instanceof THREE.MeshLambertMaterial) {
                material.flatShading = !data.hasNormals;
            }
            
            this.applyColorModeToMaterial(material, data, fileIndex, colorMode, convertSrgbToLinear, fileColors);
            material.needsUpdate = true;
            return material;
        } else {
            // Points material
            const material = new THREE.PointsMaterial();
            
            // Initialize point size if not set
            if (!pointSizes[fileIndex]) {
                pointSizes[fileIndex] = 0.001;  // Universal default for all file types
            }
            
            material.size = pointSizes[fileIndex];
            material.sizeAttenuation = true; // Always use distance-based scaling
            
            // Apply point count-based optimizations
            const pointCount = data.vertices?.length || 0;
            this.callbacks.optimizeForPointCount?.(material, pointCount);
            
            this.applyColorModeToMaterial(material, data, fileIndex, colorMode, convertSrgbToLinear, fileColors);
            return material;
        }
    }

    /**
     * Apply color mode to material - helper function
     */
    private applyColorModeToMaterial(
        material: THREE.Material,
        data: PlyData,
        fileIndex: number,
        colorMode: string,
        convertSrgbToLinear: boolean,
        fileColors: [number, number, number][]
    ): void {
        if (colorMode === 'original' && data.hasColors) {
            // Use original colors from the PLY file
            const colors = new Float32Array(data.vertices.length * 3);
            if (material instanceof THREE.MeshBasicMaterial || material instanceof THREE.MeshLambertMaterial) {
                // Mesh materials - handle sRGB conversion
                if (convertSrgbToLinear) {
                    this.callbacks.ensureSrgbLUT?.();
                    const lut = this.callbacks.getSrgbToLinearLUT?.();
                    if (lut) {
                        for (let i = 0; i < data.vertices.length; i++) {
                            const v = data.vertices[i];
                            const r8 = (v.red || 0) & 255;
                            const g8 = (v.green || 0) & 255;
                            const b8 = (v.blue || 0) & 255;
                            colors[i * 3] = lut[r8];
                            colors[i * 3 + 1] = lut[g8];
                            colors[i * 3 + 2] = lut[b8];
                        }
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
            } else if (material instanceof THREE.PointsMaterial) {
                // Points materials - simpler color handling
                for (let i = 0; i < data.vertices.length; i++) {
                    const vertex = data.vertices[i];
                    colors[i * 3] = (vertex.red || 0) / 255;
                    colors[i * 3 + 1] = (vertex.green || 0) / 255;
                    colors[i * 3 + 2] = (vertex.blue || 0) / 255;
                }
                material.vertexColors = true;
                material.color = new THREE.Color(1, 1, 1); // White base color
            }
        } else if (colorMode === 'assigned') {
            // Use assigned color
            const color = fileColors[fileIndex % fileColors.length];
            if ((material as any).color) {
                (material as any).color.setRGB(color[0], color[1], color[2]);
            }
        } else {
            // Use color index
            const colorIndex = parseInt(colorMode);
            if (!isNaN(colorIndex) && colorIndex >= 0 && colorIndex < fileColors.length) {
                const color = fileColors[colorIndex];
                if ((material as any).color) {
                    (material as any).color.setRGB(color[0], color[1], color[2]);
                }
            }
        }
    }

    /**
     * Rebuild all PLY materials - extracted from main.ts
     */
    rebuildAllPlyMaterials(): void {
        const files = this.callbacks.getFiles();
        const meshes = this.callbacks.getMeshes();
        
        // Rebuild material for each file
        for (let i = 0; i < files.length && i < meshes.length; i++) {
            this.rebuildMaterialForFile(i);
        }
        
        this.callbacks.updateRenderModeButtonStates();
    }

    /**
     * Rebuild material for specific file - extracted from main.ts
     */
    rebuildMaterialForFile(fileIndex: number): void {
        const files = this.callbacks.getFiles();
        const meshes = this.callbacks.getMeshes();
        
        if (fileIndex < 0 || fileIndex >= files.length || fileIndex >= meshes.length) {
            return;
        }
        
        const data = files[fileIndex];
        const mesh = meshes[fileIndex];
        
        if (!data || !mesh) return;
        
        // Dispose old material
        if ((mesh as any).material) {
            const oldMaterial = (mesh as any).material;
            if (Array.isArray(oldMaterial)) {
                oldMaterial.forEach(mat => mat.dispose?.());
            } else {
                oldMaterial.dispose?.();
            }
        }
        
        // Create new material
        const newMaterial = this.createMaterialForFile(data, fileIndex);
        (mesh as any).material = newMaterial;
        
        // Force material update
        newMaterial.needsUpdate = true;
    }

    /**
     * Toggle universal render mode - extracted from main.ts
     */
    toggleUniversalRenderMode(fileIndex: number, mode: string): void {
        const meshes = this.callbacks.getMeshes();
        
        if (fileIndex < 0 || fileIndex >= meshes.length) return;
        
        const mesh = meshes[fileIndex];
        if (!mesh || !(mesh as any).material) return;
        
        const material = (mesh as any).material;
        
        // Apply mode-specific changes
        switch (mode) {
            case 'solid':
                this.setSolidMode(material);
                break;
            case 'wireframe':
                this.setWireframeMode(material);
                break;
            case 'points':
                this.setPointsMode(material);
                break;
        }
        
        material.needsUpdate = true;
    }

    /**
     * Set solid rendering mode - helper function
     */
    private setSolidMode(material: THREE.Material): void {
        if ((material as any).wireframe !== undefined) {
            (material as any).wireframe = false;
        }
        
        // Ensure proper material type for solid rendering
        if (material instanceof THREE.PointsMaterial) {
            // Convert to mesh material if needed
            // This is a complex operation that might require geometry changes
            console.warn('Cannot convert PointsMaterial to solid mode');
        }
    }

    /**
     * Set wireframe rendering mode - helper function
     */
    private setWireframeMode(material: THREE.Material): void {
        if ((material as any).wireframe !== undefined) {
            (material as any).wireframe = true;
        }
    }

    /**
     * Set points rendering mode - helper function
     */
    private setPointsMode(material: THREE.Material): void {
        if (material instanceof THREE.PointsMaterial) {
            // Already points material
            material.size = Math.max(material.size, 2.0);
        } else {
            // Convert to points rendering
            console.warn('Converting mesh material to points mode requires geometry changes');
        }
    }

    /**
     * Update material lighting mode - extracted from main.ts
     */
    updateMaterialLightingMode(material: THREE.Material, lightingMode: 'normal' | 'flat' | 'unlit'): void {
        if (lightingMode === 'unlit') {
            // Convert to unlit material
            if (material instanceof THREE.MeshLambertMaterial || material instanceof THREE.MeshPhongMaterial) {
                // Note: This is a simplified conversion - in practice you might want to 
                // create a new MeshBasicMaterial with the same properties
                console.warn('Material lighting conversion requires creating new material');
            }
        } else if (lightingMode === 'flat') {
            // Set flat shading
            if ((material as any).flatShading !== undefined) {
                (material as any).flatShading = true;
            }
        } else {
            // Normal lighting
            if ((material as any).flatShading !== undefined) {
                (material as any).flatShading = false;
            }
        }
        
        material.needsUpdate = true;
    }

    /**
     * Apply color to material - utility function
     */
    applyColorToMaterial(material: THREE.Material, color: THREE.Color | number): void {
        if ((material as any).color) {
            if (typeof color === 'number') {
                (material as any).color.setHex(color);
            } else {
                (material as any).color.copy(color);
            }
            material.needsUpdate = true;
        }
    }

    /**
     * Set material opacity - utility function
     */
    setMaterialOpacity(material: THREE.Material, opacity: number): void {
        material.opacity = Math.max(0, Math.min(1, opacity));
        material.transparent = opacity < 1;
        material.needsUpdate = true;
    }

    /**
     * Clone material - utility function
     */
    cloneMaterial(material: THREE.Material): THREE.Material {
        return material.clone();
    }

    /**
     * Dispose material safely - utility function
     */
    disposeMaterial(material: THREE.Material | THREE.Material[]): void {
        if (Array.isArray(material)) {
            material.forEach(mat => mat.dispose?.());
        } else {
            material.dispose?.();
        }
    }

    /**
     * Check if material supports wireframe - utility function
     */
    supportsWireframe(material: THREE.Material): boolean {
        return (material as any).wireframe !== undefined;
    }

    /**
     * Check if material supports vertex colors - utility function
     */
    supportsVertexColors(material: THREE.Material): boolean {
        return (material as any).vertexColors !== undefined;
    }

    /**
     * Get material type string - utility function
     */
    getMaterialType(material: THREE.Material): string {
        return material.constructor.name;
    }
}