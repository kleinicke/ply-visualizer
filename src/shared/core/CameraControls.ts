import * as THREE from 'three';
import { TrackballControls } from 'three/examples/jsm/controls/TrackballControls';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { CustomArcballControls, TurntableControls } from '../../webview/controls';

export type ControlType = 'trackball' | 'orbit' | 'inverse-trackball' | 'arcball' | 'cloudcompare';

/**
 * Camera control management - extracted from main.ts
 * Handles initialization and management of different camera control types
 */
export class CameraControls {
    private controls!: TrackballControls | OrbitControls | CustomArcballControls | TurntableControls;
    private controlType: ControlType = 'trackball';
    private arcballInvertRotation: boolean = false;

    // Callbacks for external integration
    private onControlStatusUpdate?: () => void;
    private onAxesSetup?: () => void;

    constructor(
        private camera: THREE.PerspectiveCamera,
        private renderer: THREE.WebGLRenderer
    ) {}

    /**
     * Initialize camera controls based on control type
     * Massive 82-line function extracted from main.ts
     */
    initializeControls(): void {
        // Store current camera state before disposing old controls
        const currentCameraPosition = this.camera.position.clone();
        const currentTarget = this.controls ? this.controls.target.clone() : new THREE.Vector3(0, 0, 0);
        const currentUp = this.camera.up.clone();
        
        // Dispose of existing controls if any
        if (this.controls) {
            this.controls.dispose();
        }

        if (this.controlType === 'trackball') {
            this.controls = new TrackballControls(this.camera, this.renderer.domElement);
            const trackballControls = this.controls as TrackballControls;
            trackballControls.rotateSpeed = 5.0;
            trackballControls.zoomSpeed = 2.5;
            trackballControls.panSpeed = 1.5;
            trackballControls.noZoom = false;
            trackballControls.noPan = false;
            trackballControls.staticMoving = false;
            trackballControls.dynamicDampingFactor = 0.2;
            
            // Set up screen coordinates for proper rotation
            trackballControls.screen.left = 0;
            trackballControls.screen.top = 0;
            trackballControls.screen.width = this.renderer.domElement.clientWidth;
            trackballControls.screen.height = this.renderer.domElement.clientHeight;
        } else if (this.controlType === 'inverse-trackball') {
            this.controls = new TrackballControls(this.camera, this.renderer.domElement);
            const trackballControls = this.controls as TrackballControls;
            trackballControls.rotateSpeed = 1.0;  // Reduced to 1.0 as requested
            trackballControls.zoomSpeed = 2.5;
            trackballControls.panSpeed = 1.5;
            trackballControls.noZoom = false;
            trackballControls.noPan = false;
            trackballControls.staticMoving = false;
            trackballControls.dynamicDampingFactor = 0.2;
            
            // Set up screen coordinates for proper rotation
            trackballControls.screen.left = 0;
            trackballControls.screen.top = 0;
            trackballControls.screen.width = this.renderer.domElement.clientWidth;
            trackballControls.screen.height = this.renderer.domElement.clientHeight;
            
            // Apply inversion
            this.setupInvertedControls();
        } else if (this.controlType === 'arcball') {
            this.controls = new CustomArcballControls(this.camera, this.renderer.domElement);
            const arc = this.controls as CustomArcballControls;
            arc.rotateSpeed = 1.0;
            arc.zoomSpeed = 1.0;
            arc.panSpeed = 1.0;
            // Apply preference
            arc.invertRotation = this.arcballInvertRotation;
        } else if (this.controlType === 'cloudcompare') {
            this.controls = new TurntableControls(this.camera, this.renderer.domElement);
            const cc = this.controls as TurntableControls;
            cc.rotateSpeed = 1.0;
            cc.zoomSpeed = 1.0;
            cc.panSpeed = 1.0;
            cc.worldUp.copy(this.camera.up.lengthSq() > 0 ? this.camera.up : new THREE.Vector3(0,1,0));
        } else {
            this.controls = new OrbitControls(this.camera, this.renderer.domElement);
            const orbitControls = this.controls as OrbitControls;
            orbitControls.enableDamping = true;
            orbitControls.dampingFactor = 0.2;
            orbitControls.screenSpacePanning = false;
            orbitControls.minDistance = 0.001;
            orbitControls.maxDistance = 50000;  // Increased to match camera far plane
        }
        
        // Set up axes visibility for all control types
        this.onAxesSetup?.();
        
        // Restore camera state to prevent jumps
        this.camera.position.copy(currentCameraPosition);
        this.camera.up.copy(currentUp);
        this.controls.target.copy(currentTarget);
        this.controls.update();
        
        // Update control status to highlight active button
        this.onControlStatusUpdate?.();
    }

    /**
     * Setup inverted controls for inverse-trackball mode
     */
    private setupInvertedControls(): void {
        if (this.controlType !== 'inverse-trackball') return;
        
        const controls = this.controls as TrackballControls;
        
        // Override _rotateCamera to invert up vector rotation using quaternion.invert()
        (controls as any)._rotateCamera = function() {
            const _moveDirection = new THREE.Vector3();
            const _eyeDirection = new THREE.Vector3();
            const _objectUpDirection = new THREE.Vector3();
            const _objectSidewaysDirection = new THREE.Vector3();
            const _axis = new THREE.Vector3();
            const _quaternion = new THREE.Quaternion();
            
            _moveDirection.set(this._moveCurr.x - this._movePrev.x, this._moveCurr.y - this._movePrev.y, 0);
            let angle = _moveDirection.length();

            if (angle) {
                this._eye.copy(this.object.position).sub(this.target);

                _eyeDirection.copy(this._eye).normalize();
                _objectUpDirection.copy(this.object.up).normalize();
                _objectSidewaysDirection.crossVectors(_objectUpDirection, _eyeDirection).normalize();

                _objectUpDirection.setLength(this._moveCurr.y - this._movePrev.y);
                _objectSidewaysDirection.setLength(this._moveCurr.x - this._movePrev.x);

                _moveDirection.copy(_objectUpDirection.add(_objectSidewaysDirection));

                _axis.crossVectors(_moveDirection, this._eye).normalize();

                angle *= this.rotateSpeed;
                _quaternion.setFromAxisAngle(_axis, angle);

                // Apply normal rotation to camera position
                this._eye.applyQuaternion(_quaternion);
                
                // Apply inverted rotation to up vector
                this.object.up.applyQuaternion(_quaternion.clone().invert());

                this._lastAxis.copy(_axis);
                this._lastAngle = angle;

            } else if (!this.staticMoving && this._lastAngle) {
                this._lastAngle *= Math.sqrt(1.0 - this.dynamicDampingFactor);
                this._eye.copy(this.object.position).sub(this.target);
                
                _quaternion.setFromAxisAngle(this._lastAxis, this._lastAngle);
                
                // Apply normal rotation to camera position
                this._eye.applyQuaternion(_quaternion);
                
                // Apply inverted rotation to up vector
                this.object.up.applyQuaternion(_quaternion.clone().invert());
            }

            this._movePrev.copy(this._moveCurr);
        };
    }

    /**
     * Handle double click events for camera focusing
     */
    onDoubleClick(event: MouseEvent, objects: THREE.Object3D[]): void {
        const mouse = new THREE.Vector2();
        const canvas = this.renderer.domElement;
        const rect = canvas.getBoundingClientRect();
        
        mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
        mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

        const raycaster = new THREE.Raycaster();
        raycaster.setFromCamera(mouse, this.camera);

        // Test intersection with all objects
        const intersects = raycaster.intersectObjects(objects, true);
        
        if (intersects.length > 0) {
            const point = intersects[0].point;
            
            // Smoothly move the camera target to the clicked point
            if (this.controls.target) {
                this.controls.target.copy(point);
                this.controls.update();
            }
        }
    }

    /**
     * Reset camera to default position - updated to match main.ts implementation
     */
    resetCameraToDefault(onUpdate?: () => void): void {
        // Reset camera to default position and orientation
        this.camera.position.set(1, 1, 1);
        
        // Reset quaternion to identity (no rotation)
        this.camera.quaternion.set(0, 0, 0, 1);
        
        this.camera.fov = 75;
        this.camera.updateProjectionMatrix();
        
        // Reset controls
        this.controls.target.set(0, 0, 0);
        this.controls.update();
        
        // Callback for external state updates
        onUpdate?.();
    }

    /**
     * Fit camera to view all objects - updated to match main.ts implementation
     */
    fitCameraToObjects(objects: THREE.Object3D[]): void {
        if (objects.length === 0) return;

        const box = new THREE.Box3();
        for (const obj of objects) { 
            box.expandByObject(obj); 
        }

        if (box.isEmpty()) return;

        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        // Calculate camera position based on field of view
        const fov = this.camera.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));

        cameraZ *= 2; // Add some padding

        this.camera.position.set(center.x, center.y, center.z + cameraZ);
        this.camera.lookAt(center);
        
        this.controls.target.copy(center);
        this.controls.update();
    }

    /**
     * Fit camera to single object - updated to match main.ts implementation
     */
    fitCameraToObject(obj: THREE.Object3D): void {
        const box = new THREE.Box3().setFromObject(obj);
        if (!box.isEmpty()) {
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const fov = this.camera.fov * (Math.PI / 180);
            const distance = (maxDim / 2) / Math.tan(fov / 2) * 1.5;

            // Move camera along its current direction to the new distance
            const dir = this.camera.getWorldDirection(new THREE.Vector3()).normalize();
            this.camera.position.copy(center.clone().sub(dir.multiplyScalar(distance)));
            // Conservative clipping planes for massive point clouds
            this.camera.near = Math.max(0.001, Math.min(0.1, distance / 10000));
            this.camera.far = Math.max(distance * 100, 1000000);
            this.camera.updateProjectionMatrix();

            // Update controls target if present
            if (this.controls && (this.controls as any).target) {
                (this.controls as any).target.copy(center);
            }
        }
    }

    // Public API
    setControlType(type: ControlType): void {
        this.controlType = type;
        this.initializeControls();
    }

    getControlType(): ControlType {
        return this.controlType;
    }

    setArcballInvertRotation(invert: boolean): void {
        this.arcballInvertRotation = invert;
        if (this.controlType === 'arcball') {
            (this.controls as CustomArcballControls).invertRotation = invert;
        }
    }

    getControls(): TrackballControls | OrbitControls | CustomArcballControls | TurntableControls {
        return this.controls;
    }

    update(): void {
        this.controls.update();
    }

    dispose(): void {
        if (this.controls) {
            this.controls.dispose();
        }
    }

    // Callbacks
    setCallbacks(callbacks: {
        onControlStatusUpdate?: () => void;
        onAxesSetup?: () => void;
    }): void {
        this.onControlStatusUpdate = callbacks.onControlStatusUpdate;
        this.onAxesSetup = callbacks.onAxesSetup;
    }
}