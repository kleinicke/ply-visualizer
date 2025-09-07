import * as THREE from 'three';

export interface CameraUtilsCallbacks {
    // Scene access
    getScene: () => THREE.Scene;
    getCameraGroups: () => THREE.Group[];
    getCameraVisibility: () => boolean;
    setCameraVisibility: (visible: boolean) => void;
    
    // UI updates  
    updateCameraButtonState: () => void;
    showStatus?: (message: string) => void;
}

/**
 * Camera visualization utilities - extracted from main.ts
 * Handles camera profile visualization, labels, and controls
 */
export class CameraUtils {
    constructor(private callbacks: CameraUtilsCallbacks) {}

    /**
     * Create camera visualization group - extracted from main.ts
     */
    createCameraVisualization(
        cameraName: string, 
        location: [number, number, number], 
        rotationQuaternion: [number, number, number, number], 
        rotationType?: string
    ): THREE.Group {
        const group = new THREE.Group();
        group.name = `camera_${cameraName}`;
        
        // Set camera position
        group.position.set(location[0], location[1], location[2]);
        
        // Set camera rotation from quaternion. Respect type if provided.
        // blender_quaternion is typically [w, x, y, z]
        let qx = rotationQuaternion[0];
        let qy = rotationQuaternion[1];
        let qz = rotationQuaternion[2];
        let qw = rotationQuaternion[3];
        if (rotationType && rotationType.toLowerCase().includes('blender')) {
            qw = rotationQuaternion[0];
            qx = rotationQuaternion[1];
            qy = rotationQuaternion[2];
            qz = rotationQuaternion[3];
        }
        const quaternion = new THREE.Quaternion(qx, qy, qz, qw).normalize();
        group.setRotationFromQuaternion(quaternion);
        
        // Create camera body (triangle shape)
        const cameraBody = this.createCameraBodyGeometry();
        group.add(cameraBody);
        
        // Create direction line
        const directionLine = this.createDirectionArrow();
        group.add(directionLine);
        
        // Create text label
        const textLabel = this.createCameraLabel(cameraName);
        textLabel.name = 'cameraLabel';
        textLabel.visible = false; // Hide labels by default
        group.add(textLabel);
        
        // Store original position for coordinate label
        (group as any).originalPosition = { x: location[0], y: location[1], z: location[2] };
        
        return group;
    }

    /**
     * Create camera body geometry - extracted from main.ts
     */
    createCameraBodyGeometry(): THREE.Mesh {
        // Create a 4-sided pyramid shape 
        const size = 0.02; // 2cm base size
        const height = size * 1.5;
        
        const geometry = new THREE.ConeGeometry(size, height, 4); // 4 sides for square pyramid
        // Align one face flat to the axes (avoid 45° appearance) by rotating the base square
        geometry.rotateY(Math.PI / 4);
        const material = new THREE.MeshBasicMaterial({ 
            color: 0x4CAF50, // Green color for cameras
            transparent: true,
            opacity: 0.9
        });
        
        // Translate geometry so the tip (originally at +Y * height/2) sits at the local origin.
        // This ensures scaling does not move the tip from the origin.
        geometry.translate(0, -height / 2, 0);
        
        const mesh = new THREE.Mesh(geometry, material);
        // Orient pyramid to extend forward along +Z with tip anchored at origin
        mesh.rotation.x = -Math.PI / 2;
        
        return mesh;
    }

    /**
     * Create direction arrow - extracted from main.ts
     */
    createDirectionArrow(): THREE.Line {
        // Simple line showing camera direction
        const lineLength = 0.05; // 5cm direction line
        
        const geometry = new THREE.BufferGeometry();
        // Start at camera origin (tip) and extend forward
        const positions = new Float32Array([
            0, 0, 0,
            0, 0, lineLength
        ]);
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const material = new THREE.LineBasicMaterial({ 
            color: 0x4CAF50, // Same green as triangle
            linewidth: 2
        });
        
        const line = new THREE.Line(geometry, material);
        line.name = 'directionLine'; // Add name for identification
        return line;
    }

    /**
     * Create camera label sprite - extracted from main.ts
     */
    createCameraLabel(cameraName: string): THREE.Sprite {
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        
        // Use higher resolution for crisp text
        const pixelRatio = 3; // 3x resolution for sharp text
        const baseFontSize = 28;
        const fontSize = baseFontSize * pixelRatio;
        
        // Set font first to measure text accurately
        context.font = `Bold ${fontSize}px Arial`;
        const textMetrics = context.measureText(cameraName);
        
        // Make canvas size fit the text with padding (high resolution)
        const padding = 20 * pixelRatio;
        canvas.width = Math.max(textMetrics.width + padding * 2, 200 * pixelRatio);
        canvas.height = 48 * pixelRatio;
        
        // Set font again after canvas resize and configure for high quality
        context.font = `Bold ${fontSize}px Arial`;
        context.fillStyle = 'white';
        context.strokeStyle = 'black';
        context.lineWidth = 3 * pixelRatio;
        context.textAlign = 'center';
        context.textBaseline = 'middle';
        
        // Enable anti-aliasing for smooth text
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = 'high';
        
        // Clear background
        context.clearRect(0, 0, canvas.width, canvas.height);
        
        // Draw text with outline (centered)
        const x = canvas.width / 2;
        const y = canvas.height / 2;
        
        context.strokeText(cameraName, x, y);
        context.fillText(cameraName, x, y);
        
        // Create sprite from high-resolution canvas
        const texture = new THREE.CanvasTexture(canvas);
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        
        const material = new THREE.SpriteMaterial({ map: texture });
        const sprite = new THREE.Sprite(material);
        
        // Position label above camera (closer)
        sprite.position.set(0, 0.04, 0);
        
        // Scale proportionally to canvas aspect ratio, accounting for pixel ratio
        const aspectRatio = canvas.width / canvas.height;
        // Match label height roughly to the pyramid height at base scale
        const pyramidHeight = 0.03; // must stay in sync with createCameraBodyGeometry
        const baseScaleY = pyramidHeight; // label height ~= pyramid height
        const baseScaleX = baseScaleY * aspectRatio;
        sprite.scale.set(baseScaleX, baseScaleY, 1);
        // Preserve original scale for proper proportional scaling later
        (sprite as any).userData = (sprite as any).userData || {};
        (sprite as any).userData.baseScale = { x: baseScaleX, y: baseScaleY };
        
        return sprite;
    }

    /**
     * Toggle camera visibility - extracted from main.ts
     */
    toggleCameraVisibility(): void {
        const currentVisibility = this.callbacks.getCameraVisibility();
        const newVisibility = !currentVisibility;
        this.callbacks.setCameraVisibility(newVisibility);
        
        const cameraGroups = this.callbacks.getCameraGroups();
        cameraGroups.forEach(group => {
            group.visible = newVisibility;
        });
        
        this.callbacks.updateCameraButtonState();
    }

    /**
     * Toggle camera profile labels - extracted from main.ts
     */
    toggleCameraProfileLabels(cameraProfileIndex: number, showLabels: boolean): void {
        const cameraGroups = this.callbacks.getCameraGroups();
        if (cameraProfileIndex < 0 || cameraProfileIndex >= cameraGroups.length) return;
        
        const profileGroup = cameraGroups[cameraProfileIndex];
        // Iterate through all cameras in the profile
        profileGroup.children.forEach(child => {
            if (child instanceof THREE.Group && child.name.startsWith('camera_')) {
                const label = child.getObjectByName('cameraLabel');
                if (label) {
                    label.visible = showLabels;
                }
            }
        });
    }

    /**
     * Toggle camera profile coordinates - extracted from main.ts
     */
    toggleCameraProfileCoordinates(cameraProfileIndex: number, showCoords: boolean): void {
        const cameraGroups = this.callbacks.getCameraGroups();
        if (cameraProfileIndex < 0 || cameraProfileIndex >= cameraGroups.length) return;
        
        const profileGroup = cameraGroups[cameraProfileIndex];
        // Iterate through all cameras in the profile
        profileGroup.children.forEach(child => {
            if (child instanceof THREE.Group && child.name.startsWith('camera_')) {
                if (showCoords) {
                    // Create or update coordinate label
                    const originalPos = (child as any).originalPosition;
                    if (originalPos) {
                        const coordText = `(${originalPos.x.toFixed(3)}, ${originalPos.y.toFixed(3)}, ${originalPos.z.toFixed(3)})`;
                        let coordLabel = child.getObjectByName('coordinateLabel') as THREE.Sprite;
                        
                        if (!coordLabel) {
                            coordLabel = this.createCameraLabel(coordText);
                            coordLabel.name = 'coordinateLabel';
                            coordLabel.position.set(0, 0.08, 0); // Position below name label
                            child.add(coordLabel);
                        } else {
                            // Update existing label
                            this.updateSpriteText(coordLabel, coordText);
                        }
                        coordLabel.visible = true;
                    }
                } else {
                    // Hide coordinate label
                    const coordLabel = child.getObjectByName('coordinateLabel');
                    if (coordLabel) {
                        coordLabel.visible = false;
                    }
                }
            }
        });
    }

    /**
     * Update sprite text - helper method
     */
    private updateSpriteText(sprite: THREE.Sprite, newText: string): void {
        // Remove old texture
        const oldMaterial = sprite.material as THREE.SpriteMaterial;
        if (oldMaterial.map) {
            oldMaterial.map.dispose();
        }
        oldMaterial.dispose();
        
        // Create new label with updated text
        const newSprite = this.createCameraLabel(newText);
        const newMaterial = newSprite.material as THREE.SpriteMaterial;
        sprite.material = newMaterial;
        sprite.scale.copy(newSprite.scale);
        
        // Clean up temporary sprite
        newSprite.material.dispose();
        if ((newSprite.material as THREE.SpriteMaterial).map) {
            (newSprite.material as THREE.SpriteMaterial).map!.dispose();
        }
    }

    /**
     * Apply camera scaling - extracted from main.ts
     */
    applyCameraScale(cameraIndex: number, scale: number): void {
        const cameraGroups = this.callbacks.getCameraGroups();
        if (cameraIndex < 0 || cameraIndex >= cameraGroups.length) return;
        
        const profileGroup = cameraGroups[cameraIndex];
        // Apply scale to each individual camera's visual elements
        profileGroup.children.forEach(child => {
            if (child instanceof THREE.Group && child.name.startsWith('camera_')) {
                // Scale all visual elements including text labels
                child.children.forEach(visualElement => {
                    // Reset scale to 1.0 first to prevent accumulation
                    visualElement.scale.setScalar(1.0);
                    
                    if (visualElement.name === 'cameraLabel') {
                        // Preserve aspect ratio and scale relative to original base scale
                        const base = (visualElement as any).userData?.baseScale;
                        if (base) {
                            visualElement.scale.set(base.x * scale, base.y * scale, 1);
                        }
                        // Adjust position to scale with pyramid
                        visualElement.position.set(0, 0.04 * scale, 0);
                    } else if (visualElement.name === 'coordinateLabel') {
                        // Preserve aspect ratio and scale relative to original base scale, but smaller than name label
                        const base = (visualElement as any).userData?.baseScale;
                        if (base) {
                            const shrink = 0.6; // make coordinates label smaller
                            visualElement.scale.set(base.x * scale * shrink, base.y * scale * shrink, 1);
                        }
                        // Position coordinate label slightly below base
                        visualElement.position.set(0, -0.035 * scale, 0);
                    } else if (visualElement.name === 'directionLine') {
                        // For direction line, recreate geometry with scaled length
                        const line = visualElement as THREE.Line;
                        const lineLength = 0.05 * scale; // Scale the line length
                        const positions = new Float32Array([
                            0, 0, 0,          // Start at camera origin (tip)
                            0, 0, lineLength  // Extend forward with scaled length
                        ]);
                        line.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
                        line.geometry.attributes.position.needsUpdate = true;
                    } else {
                        // Scale pyramid normally
                        visualElement.scale.setScalar(scale);
                    }
                });
            }
        });
    }

    /**
     * Add camera profile to scene - extracted from main.ts
     */
    addCameraProfileToScene(cameras: any[], profileName: string): THREE.Group {
        const scene = this.callbacks.getScene();
        const profileGroup = new THREE.Group();
        profileGroup.name = `cameraProfile_${profileName}`;
        
        cameras.forEach(cameraData => {
            if (cameraData.location && cameraData.rotation_quaternion) {
                const cameraGroup = this.createCameraVisualization(
                    cameraData.name || 'camera',
                    cameraData.location,
                    cameraData.rotation_quaternion,
                    cameraData.rotation_quaternion_type
                );
                profileGroup.add(cameraGroup);
            }
        });
        
        scene.add(profileGroup);
        return profileGroup;
    }

    /**
     * Remove camera profile from scene - helper method
     */
    removeCameraProfileFromScene(profileIndex: number): void {
        const scene = this.callbacks.getScene();
        const cameraGroups = this.callbacks.getCameraGroups();
        
        if (profileIndex >= 0 && profileIndex < cameraGroups.length) {
            const profileGroup = cameraGroups[profileIndex];
            scene.remove(profileGroup);
            
            // Dispose of materials and geometries
            this.disposeCameraGroup(profileGroup);
            
            // Remove from camera groups array
            cameraGroups.splice(profileIndex, 1);
        }
    }

    /**
     * Dispose of camera group resources - helper method
     */
    private disposeCameraGroup(group: THREE.Group): void {
        group.traverse(child => {
            if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
                if (child.geometry) {
                    child.geometry.dispose();
                }
                if (child.material) {
                    if (Array.isArray(child.material)) {
                        child.material.forEach(mat => mat.dispose());
                    } else {
                        child.material.dispose();
                    }
                }
            } else if (child instanceof THREE.Sprite) {
                const spriteMaterial = child.material as THREE.SpriteMaterial;
                if (spriteMaterial.map) {
                    spriteMaterial.map.dispose();
                }
                spriteMaterial.dispose();
            }
        });
    }

    /**
     * Update camera button state - helper for UI integration
     */
    updateCameraButtonStateHelper(): void {
        const toggleBtn = document.getElementById('toggle-cameras');
        if (!toggleBtn) return;
        
        const cameraVisibility = this.callbacks.getCameraVisibility();
        if (cameraVisibility) {
            toggleBtn.classList.add('active');
            toggleBtn.innerHTML = 'Hide Cameras';
        } else {
            toggleBtn.classList.remove('active');
            toggleBtn.innerHTML = 'Show Cameras';
        }
    }

    /**
     * Get camera count for UI display
     */
    getCameraCount(): number {
        const cameraGroups = this.callbacks.getCameraGroups();
        let totalCameras = 0;
        
        cameraGroups.forEach(profileGroup => {
            profileGroup.children.forEach(child => {
                if (child instanceof THREE.Group && child.name.startsWith('camera_')) {
                    totalCameras++;
                }
            });
        });
        
        return totalCameras;
    }

    /**
     * Dispose all camera resources
     */
    dispose(): void {
        const cameraGroups = this.callbacks.getCameraGroups();
        cameraGroups.forEach(group => this.disposeCameraGroup(group));
    }
}