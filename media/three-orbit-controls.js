// OrbitControls for Three.js - Simplified version for webview use
// This is a minimal implementation of OrbitControls specifically for the PLY viewer

(function() {
    'use strict';

    class OrbitControls {
        constructor(object, domElement) {
            if (domElement === undefined) {
                console.warn('THREE.OrbitControls: The second parameter "domElement" is now mandatory.');
                domElement = document;
            }

            this.object = object;
            this.domElement = domElement;

            // Set to false to disable this control
            this.enabled = true;

            // "target" sets the location of focus, where the object orbits around
            this.target = new THREE.Vector3();

            // How far you can dolly in and out (PerspectiveCamera only)
            this.minDistance = 0;
            this.maxDistance = Infinity;

            // How far you can zoom in and out (OrthographicCamera only)
            this.minZoom = 0;
            this.maxZoom = Infinity;

            // How far you can orbit vertically, upper and lower limits.
            this.minPolarAngle = 0; // radians
            this.maxPolarAngle = Math.PI; // radians

            // How far you can orbit horizontally, upper and lower limits.
            this.minAzimuthAngle = -Infinity; // radians
            this.maxAzimuthAngle = Infinity; // radians

            // Set to true to enable damping (inertia)
            this.enableDamping = false;
            this.dampingFactor = 0.05;

            // This option actually enables dollying in and out; left as "zoom" for backwards compatibility.
            this.enableZoom = true;
            this.zoomSpeed = 1.0;

            // Set to false to disable rotating
            this.enableRotate = true;
            this.rotateSpeed = 1.0;

            // Set to false to disable panning
            this.enablePan = true;
            this.panSpeed = 1.0;
            this.screenSpacePanning = true;

            // Set to false to disable use of the keys
            this.enableKeys = true;

            // The four arrow keys
            this.keys = { LEFT: 'ArrowLeft', UP: 'ArrowUp', RIGHT: 'ArrowRight', BOTTOM: 'ArrowDown' };

            // Mouse buttons
            this.mouseButtons = { LEFT: 0, MIDDLE: 1, RIGHT: 2 };

            // Touch fingers
            this.touches = { ONE: 1, TWO: 2 };

            // Internal state
            this.target0 = this.target.clone();
            this.position0 = this.object.position.clone();
            this.zoom0 = this.object.zoom;

            // Internal variables
            this.spherical = new THREE.Spherical();
            this.sphericalDelta = new THREE.Spherical();
            this.scale = 1;
            this.panOffset = new THREE.Vector3();
            this.zoomChanged = false;

            this.rotateStart = new THREE.Vector2();
            this.rotateEnd = new THREE.Vector2();
            this.rotateDelta = new THREE.Vector2();

            this.panStart = new THREE.Vector2();
            this.panEnd = new THREE.Vector2();
            this.panDelta = new THREE.Vector2();

            this.dollyStart = new THREE.Vector2();
            this.dollyEnd = new THREE.Vector2();
            this.dollyDelta = new THREE.Vector2();

            this.state = 'NONE';
            this.STATES = { NONE: 'NONE', ROTATE: 'ROTATE', DOLLY: 'DOLLY', PAN: 'PAN', TOUCH_ROTATE: 'TOUCH_ROTATE', TOUCH_PAN: 'TOUCH_PAN', TOUCH_DOLLY_PAN: 'TOUCH_DOLLY_PAN', TOUCH_DOLLY_ROTATE: 'TOUCH_DOLLY_ROTATE' };

            // Event listeners
            this.onContextMenu = this.onContextMenu.bind(this);
            this.onMouseDown = this.onMouseDown.bind(this);
            this.onMouseWheel = this.onMouseWheel.bind(this);
            this.onTouchStart = this.onTouchStart.bind(this);
            this.onTouchEnd = this.onTouchEnd.bind(this);
            this.onTouchMove = this.onTouchMove.bind(this);
            this.onKeyDown = this.onKeyDown.bind(this);

            this.domElement.addEventListener('contextmenu', this.onContextMenu, false);
            this.domElement.addEventListener('mousedown', this.onMouseDown, false);
            this.domElement.addEventListener('wheel', this.onMouseWheel, false);
            this.domElement.addEventListener('touchstart', this.onTouchStart, false);
            this.domElement.addEventListener('touchend', this.onTouchEnd, false);
            this.domElement.addEventListener('touchmove', this.onTouchMove, false);
            this.domElement.addEventListener('keydown', this.onKeyDown, false);

            // Force an update at start
            this.update();
        }

        update() {
            const offset = new THREE.Vector3();
            const quat = new THREE.Quaternion().setFromUnitVectors(this.object.up, new THREE.Vector3(0, 1, 0));
            const quatInverse = quat.clone().invert();
            const lastPosition = new THREE.Vector3();
            const lastQuaternion = new THREE.Quaternion();

            const position = this.object.position;

            offset.copy(position).sub(this.target);
            offset.applyQuaternion(quat);

            this.spherical.setFromVector3(offset);

            if (this.enableDamping) {
                this.spherical.theta += this.sphericalDelta.theta * this.dampingFactor;
                this.spherical.phi += this.sphericalDelta.phi * this.dampingFactor;
            } else {
                this.spherical.theta += this.sphericalDelta.theta;
                this.spherical.phi += this.sphericalDelta.phi;
            }

            // Restrict theta to be between desired limits
            this.spherical.theta = Math.max(this.minAzimuthAngle, Math.min(this.maxAzimuthAngle, this.spherical.theta));

            // Restrict phi to be between desired limits
            this.spherical.phi = Math.max(this.minPolarAngle, Math.min(this.maxPolarAngle, this.spherical.phi));

            this.spherical.makeSafe();

            this.spherical.radius *= this.scale;

            // Restrict radius to be between desired limits
            this.spherical.radius = Math.max(this.minDistance, Math.min(this.maxDistance, this.spherical.radius));

            // Move target to panned location
            if (this.enableDamping) {
                this.target.addScaledVector(this.panOffset, this.dampingFactor);
            } else {
                this.target.add(this.panOffset);
            }

            offset.setFromSpherical(this.spherical);
            offset.applyQuaternion(quatInverse);

            position.copy(this.target).add(offset);

            this.object.lookAt(this.target);

            if (this.enableDamping) {
                this.sphericalDelta.theta *= (1 - this.dampingFactor);
                this.sphericalDelta.phi *= (1 - this.dampingFactor);
                this.panOffset.multiplyScalar(1 - this.dampingFactor);
            } else {
                this.sphericalDelta.set(0, 0, 0);
                this.panOffset.set(0, 0, 0);
            }

            this.scale = 1;

            // Update condition is:
            if (this.zoomChanged ||
                lastPosition.distanceToSquared(this.object.position) > 1e-6 ||
                8 * (1 - lastQuaternion.dot(this.object.quaternion)) > 1e-6) {

                lastPosition.copy(this.object.position);
                lastQuaternion.copy(this.object.quaternion);
                this.zoomChanged = false;

                return true;
            }

            return false;
        }

        dispose() {
            this.domElement.removeEventListener('contextmenu', this.onContextMenu, false);
            this.domElement.removeEventListener('mousedown', this.onMouseDown, false);
            this.domElement.removeEventListener('wheel', this.onMouseWheel, false);
            this.domElement.removeEventListener('touchstart', this.onTouchStart, false);
            this.domElement.removeEventListener('touchend', this.onTouchEnd, false);
            this.domElement.removeEventListener('touchmove', this.onTouchMove, false);
            this.domElement.removeEventListener('keydown', this.onKeyDown, false);
        }

        // Event handlers
        onContextMenu(event) {
            if (!this.enabled) return;
            event.preventDefault();
        }

        onMouseDown(event) {
            if (!this.enabled) return;

            event.preventDefault();

            let mouseAction;

            switch (event.button) {
                case 0:
                    mouseAction = this.mouseButtons.LEFT;
                    break;
                case 1:
                    mouseAction = this.mouseButtons.MIDDLE;
                    break;
                case 2:
                    mouseAction = this.mouseButtons.RIGHT;
                    break;
                default:
                    mouseAction = -1;
            }

            switch (mouseAction) {
                case this.mouseButtons.LEFT:
                    if (this.enableRotate === false) return;
                    this.rotateStart.set(event.clientX, event.clientY);
                    this.state = this.STATES.ROTATE;
                    break;

                case this.mouseButtons.MIDDLE:
                    if (this.enableZoom === false) return;
                    this.dollyStart.set(event.clientX, event.clientY);
                    this.state = this.STATES.DOLLY;
                    break;

                case this.mouseButtons.RIGHT:
                    if (this.enablePan === false) return;
                    this.panStart.set(event.clientX, event.clientY);
                    this.state = this.STATES.PAN;
                    break;
            }

            if (this.state !== this.STATES.NONE) {
                document.addEventListener('mousemove', this.onMouseMove.bind(this), false);
                document.addEventListener('mouseup', this.onMouseUp.bind(this), false);
            }
        }

        onMouseMove(event) {
            if (!this.enabled) return;

            event.preventDefault();

            switch (this.state) {
                case this.STATES.ROTATE:
                    if (this.enableRotate === false) return;
                    this.rotateEnd.set(event.clientX, event.clientY);
                    this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart).multiplyScalar(this.rotateSpeed);
                    
                    const element = this.domElement;
                    this.sphericalDelta.theta -= 2 * Math.PI * this.rotateDelta.x / element.clientHeight;
                    this.sphericalDelta.phi -= 2 * Math.PI * this.rotateDelta.y / element.clientHeight;
                    
                    this.rotateStart.copy(this.rotateEnd);
                    break;

                case this.STATES.DOLLY:
                    if (this.enableZoom === false) return;
                    this.dollyEnd.set(event.clientX, event.clientY);
                    this.dollyDelta.subVectors(this.dollyEnd, this.dollyStart);
                    
                    if (this.dollyDelta.y > 0) {
                        this.scale /= Math.pow(0.95, this.zoomSpeed);
                    } else if (this.dollyDelta.y < 0) {
                        this.scale *= Math.pow(0.95, this.zoomSpeed);
                    }
                    
                    this.dollyStart.copy(this.dollyEnd);
                    break;

                case this.STATES.PAN:
                    if (this.enablePan === false) return;
                    this.panEnd.set(event.clientX, event.clientY);
                    this.panDelta.subVectors(this.panEnd, this.panStart).multiplyScalar(this.panSpeed);
                    this.pan(this.panDelta.x, this.panDelta.y);
                    this.panStart.copy(this.panEnd);
                    break;
            }
        }

        onMouseUp() {
            if (!this.enabled) return;

            document.removeEventListener('mousemove', this.onMouseMove.bind(this), false);
            document.removeEventListener('mouseup', this.onMouseUp.bind(this), false);

            this.state = this.STATES.NONE;
        }

        onMouseWheel(event) {
            if (!this.enabled || !this.enableZoom || (this.state !== this.STATES.NONE && this.state !== this.STATES.ROTATE)) return;

            event.preventDefault();
            event.stopPropagation();

            if (event.deltaY < 0) {
                this.scale *= Math.pow(0.95, this.zoomSpeed);
            } else if (event.deltaY > 0) {
                this.scale /= Math.pow(0.95, this.zoomSpeed);
            }
        }

        onTouchStart(event) {
            if (!this.enabled) return;

            event.preventDefault();

            switch (event.touches.length) {
                case 1:
                    if (this.enableRotate === false) return;
                    this.rotateStart.set(event.touches[0].pageX, event.touches[0].pageY);
                    this.state = this.STATES.TOUCH_ROTATE;
                    break;

                case 2:
                    if (this.enableZoom === false && this.enablePan === false) return;

                    if (this.enableZoom) {
                        const dx = event.touches[0].pageX - event.touches[1].pageX;
                        const dy = event.touches[0].pageY - event.touches[1].pageY;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        this.dollyStart.set(0, distance);
                    }

                    if (this.enablePan) {
                        const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
                        const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);
                        this.panStart.set(x, y);
                    }

                    this.state = this.STATES.TOUCH_DOLLY_PAN;
                    break;

                default:
                    this.state = this.STATES.NONE;
            }
        }

        onTouchMove(event) {
            if (!this.enabled) return;

            event.preventDefault();
            event.stopPropagation();

            switch (this.state) {
                case this.STATES.TOUCH_ROTATE:
                    if (this.enableRotate === false) return;
                    this.rotateEnd.set(event.touches[0].pageX, event.touches[0].pageY);
                    this.rotateDelta.subVectors(this.rotateEnd, this.rotateStart).multiplyScalar(this.rotateSpeed);
                    
                    const element = this.domElement;
                    this.sphericalDelta.theta -= 2 * Math.PI * this.rotateDelta.x / element.clientHeight;
                    this.sphericalDelta.phi -= 2 * Math.PI * this.rotateDelta.y / element.clientHeight;
                    
                    this.rotateStart.copy(this.rotateEnd);
                    break;

                case this.STATES.TOUCH_DOLLY_PAN:
                    if (this.enableZoom === false && this.enablePan === false) return;

                    if (this.enableZoom) {
                        const dx = event.touches[0].pageX - event.touches[1].pageX;
                        const dy = event.touches[0].pageY - event.touches[1].pageY;
                        const distance = Math.sqrt(dx * dx + dy * dy);
                        this.dollyEnd.set(0, distance);
                        this.dollyDelta.set(0, Math.pow(this.dollyEnd.y / this.dollyStart.y, this.zoomSpeed));
                        this.scale *= this.dollyDelta.y;
                        this.dollyStart.copy(this.dollyEnd);
                    }

                    if (this.enablePan) {
                        const x = 0.5 * (event.touches[0].pageX + event.touches[1].pageX);
                        const y = 0.5 * (event.touches[0].pageY + event.touches[1].pageY);
                        this.panEnd.set(x, y);
                        this.panDelta.subVectors(this.panEnd, this.panStart).multiplyScalar(this.panSpeed);
                        this.pan(this.panDelta.x, this.panDelta.y);
                        this.panStart.copy(this.panEnd);
                    }
                    break;

                default:
                    this.state = this.STATES.NONE;
            }
        }

        onTouchEnd() {
            if (!this.enabled) return;
            this.state = this.STATES.NONE;
        }

        onKeyDown(event) {
            if (!this.enabled || !this.enableKeys || !this.enablePan) return;

            let needsUpdate = false;

            switch (event.code) {
                case this.keys.UP:
                    this.pan(0, this.panSpeed);
                    needsUpdate = true;
                    break;

                case this.keys.BOTTOM:
                    this.pan(0, -this.panSpeed);
                    needsUpdate = true;
                    break;

                case this.keys.LEFT:
                    this.pan(this.panSpeed, 0);
                    needsUpdate = true;
                    break;

                case this.keys.RIGHT:
                    this.pan(-this.panSpeed, 0);
                    needsUpdate = true;
                    break;
            }

            if (needsUpdate) {
                event.preventDefault();
            }
        }

        pan(deltaX, deltaY) {
            const offset = new THREE.Vector3();

            if (this.object.isPerspectiveCamera) {
                // perspective
                const position = this.object.position;
                offset.copy(position).sub(this.target);
                let targetDistance = offset.length();

                // half of the fov is center to top of screen
                targetDistance *= Math.tan((this.object.fov / 2) * Math.PI / 180.0);

                // we use only clientHeight here so aspect ratio does not distort speed
                this.panLeft(2 * deltaX * targetDistance / this.domElement.clientHeight, this.object.matrix);
                this.panUp(2 * deltaY * targetDistance / this.domElement.clientHeight, this.object.matrix);

            } else if (this.object.isOrthographicCamera) {
                // orthographic
                this.panLeft(deltaX * (this.object.right - this.object.left) / this.object.zoom / this.domElement.clientWidth, this.object.matrix);
                this.panUp(deltaY * (this.object.top - this.object.bottom) / this.object.zoom / this.domElement.clientHeight, this.object.matrix);

            } else {
                // camera neither orthographic nor perspective
                console.warn('WARNING: OrbitControls.js encountered an unknown camera type - pan disabled.');
                this.enablePan = false;
            }
        }

        panLeft(distance, objectMatrix) {
            const v = new THREE.Vector3();
            v.setFromMatrixColumn(objectMatrix, 0); // get X column of objectMatrix
            v.multiplyScalar(-distance);
            this.panOffset.add(v);
        }

        panUp(distance, objectMatrix) {
            const v = new THREE.Vector3();
            if (this.screenSpacePanning === true) {
                v.setFromMatrixColumn(objectMatrix, 1);
            } else {
                v.setFromMatrixColumn(objectMatrix, 0);
                v.crossVectors(this.object.up, v);
            }
            v.multiplyScalar(distance);
            this.panOffset.add(v);
        }

        reset() {
            this.target.copy(this.target0);
            this.object.position.copy(this.position0);
            this.object.zoom = this.zoom0;

            this.object.updateProjectionMatrix();

            this.sphericalDelta.set(0, 0, 0);
            this.scale = 1;
            this.panOffset.set(0, 0, 0);

            this.update();
        }
    }

    // Make OrbitControls available globally
    if (typeof THREE !== 'undefined') {
        THREE.OrbitControls = OrbitControls;
    }

})(); 