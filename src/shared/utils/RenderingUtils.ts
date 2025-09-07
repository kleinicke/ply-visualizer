import * as THREE from 'three';
import { PlyData } from '../../webview/interfaces';

export interface RenderingUtilsCallbacks {
    // Scene access
    getScene: () => THREE.Scene;
    getRenderer: () => THREE.WebGLRenderer;
    getMeshes: () => THREE.Object3D[];
    getFiles: () => PlyData[];
    
    // State access
    getLightingMode: () => 'normal' | 'flat' | 'unlit';
    setLightingMode: (mode: 'normal' | 'flat' | 'unlit') => void;
    getUseLinearColorSpace: () => boolean;
    
    // Material rebuilding
    rebuildAllPlyMaterials: () => void;
}

/**
 * Rendering utilities - extracted from main.ts
 * Handles lighting, gamma correction, and rendering settings
 */
export class RenderingUtils {
    constructor(private callbacks: RenderingUtilsCallbacks) {}

    /**
     * Initialize scene lighting based on mode - extracted from main.ts
     */
    initSceneLighting(): void {
        const scene = this.callbacks.getScene();
        const lightingMode = this.callbacks.getLightingMode();
        
        // Remove existing lights
        const lightsToRemove = scene.children.filter(child => 
            child instanceof THREE.AmbientLight || 
            child instanceof THREE.DirectionalLight || 
            child instanceof THREE.HemisphereLight
        );
        lightsToRemove.forEach(light => scene.remove(light));

        // Add fresh lighting based on mode
        if (lightingMode === 'flat') {
            const ambient = new THREE.AmbientLight(0xffffff, 0.9);
            scene.add(ambient);
            const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 0.6);
            scene.add(hemi);
        } else {
            const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
            scene.add(ambientLight);
            const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
            directionalLight.position.set(10, 10, 5);
            directionalLight.castShadow = true;
            directionalLight.shadow.mapSize.width = 2048;
            directionalLight.shadow.mapSize.height = 2048;
            scene.add(directionalLight);
        }

        // Ensure initial UI states reflect current settings
        setTimeout(() => {
            this.updateGammaButtonState();
            this.updateLightingButtonsState();
        }, 0);
    }

    /**
     * Update lighting button states in UI - extracted from main.ts
     */
    updateLightingButtonsState(): void {
        const normalBtn = document.getElementById('use-normal-lighting');
        const flatBtn = document.getElementById('use-flat-lighting');
        const lightingMode = this.callbacks.getLightingMode();
        
        if (normalBtn && flatBtn) {
            if (lightingMode === 'flat') {
                normalBtn.classList.remove('active');
                flatBtn.classList.add('active');
            } else if (lightingMode === 'normal') {
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
            if (lightingMode === 'unlit') {
                unlitBtn.classList.add('active');
            } else {
                unlitBtn.classList.remove('active');
            }
        }
    }

    /**
     * Update renderer color space - extracted from main.ts
     */
    updateRendererColorSpace(): void {
        const renderer = this.callbacks.getRenderer();
        // Always output sRGB for correct display on standard monitors
        renderer.outputColorSpace = THREE.SRGBColorSpace;
    }

    /**
     * Toggle gamma correction and rebuild materials - extracted from main.ts
     */
    toggleGammaCorrection(): void {
        // Toggle the gamma correction state and rebuild materials
        this.callbacks.rebuildAllPlyMaterials();
        this.updateGammaButtonState();
    }

    /**
     * Update gamma button state in UI - extracted from main.ts
     */
    updateGammaButtonState(): void {
        const gammaBtn = document.getElementById('toggle-gamma-correction');
        const useLinear = this.callbacks.getUseLinearColorSpace();
        
        if (gammaBtn) {
            if (useLinear) {
                gammaBtn.classList.add('active');
                gammaBtn.textContent = 'Linear Color Space: ON';
            } else {
                gammaBtn.classList.remove('active');
                gammaBtn.textContent = 'Linear Color Space: OFF';
            }
        }
    }

    /**
     * Rebuild all color attributes for gamma setting - extracted from main.ts
     */
    rebuildAllColorAttributesForCurrentGammaSetting(): void {
        const meshes = this.callbacks.getMeshes();
        const files = this.callbacks.getFiles();
        const useLinear = this.callbacks.getUseLinearColorSpace();
        
        // Process each mesh and rebuild its color attributes
        for (let i = 0; i < meshes.length && i < files.length; i++) {
            const mesh = meshes[i];
            const data = files[i];
            
            if (!mesh || !data) continue;
            
            const geometry = (mesh as any).geometry as THREE.BufferGeometry;
            if (!geometry) continue;
            
            // Rebuild color attribute if the file has colors
            if (data.hasColors && data.vertices) {
                this.rebuildColorAttributeForMesh(geometry, data, useLinear);
            }
        }
        
        // Update UI to reflect current state
        this.updateGammaButtonState();
    }

    /**
     * Rebuild color attribute for a single mesh - helper for gamma correction
     */
    private rebuildColorAttributeForMesh(
        geometry: THREE.BufferGeometry, 
        data: PlyData, 
        useLinear: boolean
    ): void {
        if (!data.vertices || data.vertices.length === 0) return;
        
        const vertexCount = Math.floor(data.vertices.length / 3);
        const colors = new Uint8Array(vertexCount * 3);
        
        // Extract colors from vertex data
        for (let i = 0; i < vertexCount; i++) {
            const vertex = data.vertices[i];
            if (vertex && typeof vertex === 'object' && 'r' in vertex) {
                const r = Math.max(0, Math.min(255, Math.round(Number(vertex.r) || 0)));
                const g = Math.max(0, Math.min(255, Math.round(Number((vertex as any).g) || 0)));
                const b = Math.max(0, Math.min(255, Math.round(Number((vertex as any).b) || 0)));
                
                if (useLinear) {
                    // Convert sRGB to linear for proper lighting calculations
                    colors[i * 3] = this.srgbToLinear(r);
                    colors[i * 3 + 1] = this.srgbToLinear(g);
                    colors[i * 3 + 2] = this.srgbToLinear(b);
                } else {
                    // Use colors directly (assume already in correct space)
                    colors[i * 3] = r;
                    colors[i * 3 + 1] = g;
                    colors[i * 3 + 2] = b;
                }
            }
        }
        
        // Update geometry with new color attribute
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3, true));
        geometry.attributes.color.needsUpdate = true;
    }

    /**
     * Convert sRGB color value to linear - helper for gamma correction
     */
    private srgbToLinear(srgbValue: number): number {
        const normalized = srgbValue / 255.0;
        const linear = normalized <= 0.04045 
            ? normalized / 12.92 
            : Math.pow((normalized + 0.055) / 1.055, 2.4);
        return Math.round(linear * 255);
    }

    /**
     * Optimize material for point count - extracted from main.ts
     */
    optimizeForPointCount(material: THREE.PointsMaterial, pointCount: number): void {
        // Adjust rendering settings based on point count for performance
        if (pointCount > 1000000) {
            // Large point clouds: prioritize performance
            material.sizeAttenuation = false;
            material.size = Math.max(1.0, material.size);
        } else if (pointCount > 100000) {
            // Medium point clouds: balanced settings
            material.sizeAttenuation = true;
            material.size = Math.max(1.5, material.size);
        } else {
            // Small point clouds: prioritize quality
            material.sizeAttenuation = true;
            material.size = Math.max(2.0, material.size);
        }
        
        material.needsUpdate = true;
    }

    /**
     * Handle window resize for renderer - extracted from main.ts
     */
    onWindowResize(camera: THREE.PerspectiveCamera, controls: any): void {
        const container = document.getElementById('viewer-container');
        if (!container) return;
        
        const renderer = this.callbacks.getRenderer();
        
        // Update camera and renderer
        camera.aspect = container.clientWidth / container.clientHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(container.clientWidth, container.clientHeight);
        
        // Update controls based on type
        if (controls && (controls as any).screen) {
            // Trackball controls
            const trackballControls = controls as any;
            trackballControls.screen.width = container.clientWidth;
            trackballControls.screen.height = container.clientHeight;
            if (trackballControls.handleResize) {
                trackballControls.handleResize();
            }
        }
        // OrbitControls automatically handle resize
    }

    /**
     * Set lighting mode and update scene - utility function
     */
    setLightingMode(mode: 'normal' | 'flat' | 'unlit'): void {
        this.callbacks.setLightingMode(mode);
        this.initSceneLighting();
        this.callbacks.rebuildAllPlyMaterials();
    }
}