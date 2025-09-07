import * as THREE from 'three';

export interface EventUtilsCallbacks {
    // Camera and controls
    getCamera: () => THREE.PerspectiveCamera;
    getControls: () => any;
    getRenderer: () => THREE.WebGLRenderer;
    
    // Object access
    getMeshes: () => THREE.Object3D[];
    getFileVisibility: () => boolean[];
    getPointSizes: () => number[];
    
    // Camera operations
    fitCameraToObject: (obj: THREE.Object3D) => void;
    
    // State updates
    updateCameraMatrix: () => void;
    updateCameraControlsPanel: () => void;
    updateRotationOriginButtonState: () => void;
    updateAdaptiveDecimation: () => void;
    
    // Axes helpers
    showAxesTemporarily?: () => void;
    updateAxesForUpVector?: (upVector: THREE.Vector3) => void;
    
    // Feedback
    showRotationCenterFeedback?: (point: THREE.Vector3) => void;
    showUpVectorFeedback?: (upVector: THREE.Vector3) => void;
    showStatus?: (message: string) => void;
}

/**
 * Event handling utilities - extracted from main.ts
 * Handles mouse interactions, camera controls, and user input events
 */
export class EventUtils {
    constructor(private callbacks: EventUtilsCallbacks) {}

    /**
     * Handle double-click events for rotation center setting - extracted from main.ts
     */
    onDoubleClick(event: MouseEvent): void {
        const camera = this.callbacks.getCamera();
        const renderer = this.callbacks.getRenderer();
        const meshes = this.callbacks.getMeshes();
        const fileVisibility = this.callbacks.getFileVisibility();
        const pointSizes = this.callbacks.getPointSizes();
        
        // Convert mouse coordinates to normalized device coordinates (-1 to +1)
        const canvas = renderer.domElement;
        const rect = canvas.getBoundingClientRect();
        const mouse = new THREE.Vector2();
        
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        // Create raycaster
        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, camera);
        
        // Progressive threshold approach for double-click detection
        const validPointSizes = pointSizes.filter(size => size > 0);
        const maxPointSize = validPointSizes.length > 0 ? Math.max(...validPointSizes) : 0.001;
        
        // Find intersections with all visible meshes
        const visibleMeshes = meshes.filter((mesh, index) => fileVisibility[index]);
        
        // Try progressive thresholds until we find an intersection
        const thresholds = [
            Math.max(maxPointSize * 10, 0.001), // Start with point-size based threshold
            0.01,  // Small threshold
            0.05,  // Medium threshold  
            0.1,   // Larger threshold
            0.5,   // Large threshold
            2.0    // Very large threshold for distant point clouds
        ];
        
        let intersects: THREE.Intersection[] = [];
        
        for (const threshold of thresholds) {
            raycaster.params.Points.threshold = threshold;
            intersects = raycaster.intersectObjects(visibleMeshes, false);
            
            if (intersects.length > 0) {
                break;
            }
        }

        if (intersects.length > 0) {
            // Get the closest intersection point
            const intersectionPoint = intersects[0].point;
            
            // Check if the point is too close to the camera
            const distance = camera.position.distanceTo(intersectionPoint);
            const minDistance = 0.005; // Very small minimum distance
            
            if (distance < minDistance) {
                return; // Don't set rotation center for points too close
            }
            
            // Set this point as the new rotation center
            this.setRotationCenter(intersectionPoint);
            this.callbacks.updateRotationOriginButtonState();
        }
    }

    /**
     * Set rotation center point - extracted from main.ts
     */
    setRotationCenter(point: THREE.Vector3): void {
        const camera = this.callbacks.getCamera();
        const controls = this.callbacks.getControls();
        
        // Check if the point is too close to the camera or behind it
        const cameraToPoint = point.clone().sub(camera.position);
        const distance = cameraToPoint.length();
        const minDistance = 0.01; // Minimum distance to prevent issues
        
        // If point is too close or behind camera, adjust it
        if (distance < minDistance) {
            // Move the point away from camera along the camera's forward direction
            const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
            const adjustedPoint = camera.position.clone().add(cameraDirection.multiplyScalar(minDistance));
            
            // Set the adjusted point as rotation center
            controls.target.copy(adjustedPoint);
            
            // Update axes position if callback is available
            this.callbacks.updateAxesForUpVector?.(adjustedPoint);
            this.callbacks.updateRotationOriginButtonState();
        } else {
            // Point is at a safe distance, use it directly
            controls.target.copy(point);
            controls.update();
            
            // Update axes position if callback is available
            this.callbacks.updateAxesForUpVector?.(point);
            
            // Show feedback if callback is available
            this.callbacks.showRotationCenterFeedback?.(point);
            this.callbacks.updateRotationOriginButtonState();
        }
    }

    /**
     * Set rotation center to origin - extracted from main.ts
     */
    setRotationCenterToOrigin(): void {
        const controls = this.callbacks.getControls();
        
        // Set rotation center (target) to origin (0, 0, 0)
        controls.target.set(0, 0, 0);
        controls.update();
        
        // Update axes position if callback is available
        const origin = new THREE.Vector3(0, 0, 0);
        this.callbacks.updateAxesForUpVector?.(origin);
        
        // Show axes temporarily if callback is available
        this.callbacks.showAxesTemporarily?.();
        
        this.callbacks.updateRotationOriginButtonState();
    }

    /**
     * Reset camera to default position - extracted from main.ts
     */
    resetCameraToDefault(): void {
        const camera = this.callbacks.getCamera();
        const controls = this.callbacks.getControls();
        
        // Reset camera to default position and orientation
        camera.position.set(1, 1, 1);
        
        // Reset quaternion to identity (no rotation)
        camera.quaternion.set(0, 0, 0, 1);
        
        camera.fov = 75;
        camera.updateProjectionMatrix();
        
        // Reset controls
        controls.target.set(0, 0, 0);
        controls.update();
        
        // Update camera state
        this.callbacks.updateCameraMatrix();
        this.callbacks.updateCameraControlsPanel();
    }

    /**
     * Set up vector for camera orientation - extracted from main.ts
     */
    setUpVector(upVector: THREE.Vector3): void {
        const camera = this.callbacks.getCamera();
        const controls = this.callbacks.getControls();
        
        // Normalize the up vector
        const normalizedUp = upVector.clone().normalize();
        
        // Set camera up vector
        camera.up.copy(normalizedUp);
        camera.updateMatrixWorld();
        
        // Update controls if they have up vector property
        if ((controls as any).up) {
            (controls as any).up.copy(normalizedUp);
        }
        
        // For CloudCompare-style controls, update worldUp
        if ((controls as any).worldUp) {
            (controls as any).worldUp.copy(normalizedUp);
        }
        
        controls.update();
        
        // Update axes orientation if callback is available
        this.callbacks.updateAxesForUpVector?.(normalizedUp);
        
        // Show feedback if callback is available
        this.callbacks.showUpVectorFeedback?.(normalizedUp);
        
        // Update camera state
        this.callbacks.updateCameraMatrix();
        this.callbacks.updateCameraControlsPanel();
    }

    /**
     * Handle keyboard shortcuts - extracted from main.ts
     */
    setupKeyboardShortcuts(): void {
        document.addEventListener('keydown', (event) => {
            // Only handle shortcuts when not typing in input fields
            const activeElement = document.activeElement;
            if (activeElement && (
                activeElement.tagName === 'INPUT' || 
                activeElement.tagName === 'TEXTAREA' ||
                (activeElement as HTMLElement).contentEditable === 'true'
            )) {
                return;
            }

            const key = event.code;
            
            switch (key) {
                case 'KeyF':
                    // Fit camera to all objects
                    event.preventDefault();
                    const meshes = this.callbacks.getMeshes();
                    if (meshes.length > 0) {
                        // Fit to all visible objects
                        const visibleMeshes = meshes.filter((_, i) => this.callbacks.getFileVisibility()[i]);
                        if (visibleMeshes.length > 0) {
                            this.callbacks.fitCameraToObject(visibleMeshes[0]); // Fit to first visible
                        }
                    }
                    break;
                    
                case 'KeyR':
                    // Reset camera
                    event.preventDefault();
                    this.resetCameraToDefault();
                    break;
                    
                case 'KeyA':
                    // Toggle axes
                    event.preventDefault();
                    this.callbacks.showAxesTemporarily?.();
                    break;
                    
                case 'KeyO':
                    // Set rotation center to origin
                    event.preventDefault();
                    this.setRotationCenterToOrigin();
                    break;
                    
                case 'Space':
                    // Emergency brake - pause any animations
                    event.preventDefault();
                    this.callbacks.showStatus?.('Space pressed - animations paused');
                    break;
            }
        });
    }

    /**
     * Show rotation center feedback - extracted from main.ts
     */
    showRotationCenterFeedback(point: THREE.Vector3): void {
        // This method can be implemented to show visual feedback
        // when rotation center is changed
        this.callbacks.showRotationCenterFeedback?.(point);
        
        // Show status message if callback is available
        const message = `Rotation center set to (${point.x.toFixed(3)}, ${point.y.toFixed(3)}, ${point.z.toFixed(3)})`;
        this.callbacks.showStatus?.(message);
    }

    /**
     * Show up vector feedback - extracted from main.ts
     */
    showUpVectorFeedback(upVector: THREE.Vector3): void {
        // This method can be implemented to show visual feedback
        // when up vector is changed
        this.callbacks.showUpVectorFeedback?.(upVector);
        
        // Show status message if callback is available
        const message = `Up vector set to (${upVector.x.toFixed(3)}, ${upVector.y.toFixed(3)}, ${upVector.z.toFixed(3)})`;
        this.callbacks.showStatus?.(message);
    }

    /**
     * Handle camera position dialog - extracted from main.ts
     */
    showCameraPositionDialog(): void {
        const camera = this.callbacks.getCamera();
        const currentPos = camera.position;
        
        // Create simple prompt for camera position
        const input = prompt(
            'Enter camera position (x y z):',
            `${currentPos.x.toFixed(3)} ${currentPos.y.toFixed(3)} ${currentPos.z.toFixed(3)}`
        );
        
        if (input) {
            const coords = input.trim().split(/\s+/).map(Number);
            if (coords.length === 3 && coords.every(n => !isNaN(n))) {
                camera.position.set(coords[0], coords[1], coords[2]);
                this.callbacks.getControls().update();
                this.callbacks.updateCameraMatrix();
                this.callbacks.updateCameraControlsPanel();
                this.callbacks.updateAdaptiveDecimation();
            }
        }
    }

    /**
     * Handle camera rotation dialog - extracted from main.ts
     */
    showCameraRotationDialog(): void {
        const camera = this.callbacks.getCamera();
        const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'XYZ');
        
        // Convert to degrees for user-friendly input
        const degX = THREE.MathUtils.radToDeg(euler.x);
        const degY = THREE.MathUtils.radToDeg(euler.y);
        const degZ = THREE.MathUtils.radToDeg(euler.z);
        
        // Create simple prompt for camera rotation
        const input = prompt(
            'Enter camera rotation in degrees (x y z):',
            `${degX.toFixed(1)} ${degY.toFixed(1)} ${degZ.toFixed(1)}`
        );
        
        if (input) {
            const angles = input.trim().split(/\s+/).map(Number);
            if (angles.length === 3 && angles.every(n => !isNaN(n))) {
                const radX = THREE.MathUtils.degToRad(angles[0]);
                const radY = THREE.MathUtils.degToRad(angles[1]);
                const radZ = THREE.MathUtils.degToRad(angles[2]);
                
                camera.rotation.set(radX, radY, radZ);
                this.callbacks.getControls().update();
                this.callbacks.updateCameraMatrix();
                this.callbacks.updateCameraControlsPanel();
            }
        }
    }

    /**
     * Handle rotation center dialog - extracted from main.ts
     */
    showRotationCenterDialog(): void {
        const controls = this.callbacks.getControls();
        const currentTarget = controls.target;
        
        // Create simple prompt for rotation center
        const input = prompt(
            'Enter rotation center (x y z):',
            `${currentTarget.x.toFixed(3)} ${currentTarget.y.toFixed(3)} ${currentTarget.z.toFixed(3)}`
        );
        
        if (input) {
            const coords = input.trim().split(/\s+/).map(Number);
            if (coords.length === 3 && coords.every(n => !isNaN(n))) {
                const newCenter = new THREE.Vector3(coords[0], coords[1], coords[2]);
                this.setRotationCenter(newCenter);
            }
        }
    }
}