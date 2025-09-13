import * as THREE from 'three';

// Minimal, self-contained Arcball-like controls that expose a .target similar to Trackball/Orbit
export class CustomArcballControls {
  public object: THREE.PerspectiveCamera;
  public domElement: HTMLElement;
  public enabled = true;
  public target: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public rotateSpeed = 2.0; // doubled XY rotation sensitivity
  public zoomSpeed = 1.0;
  public panSpeed = 1.0;
  public minDistance = 0.001;
  public maxDistance = 50000;
  public invertRotation = false; // legacy global flip
  public horizontalSign = 1; // left/right drag sense
  public verticalSign = 1; // up/down drag sense
  public rollSign = 1; // circular gesture roll sense
  public rollSpeed = 1.0;
  public maxStep = 0.25; // rad clamp per frame
  public rollRadiusMin = 0.1; // normalized radius threshold for roll

  private isRotating = false;
  private isPanning = false;
  private lastArcVec: THREE.Vector3 = new THREE.Vector3(); // for legacy mapping
  private lastCenterVec: THREE.Vector2 = new THREE.Vector2(); // for roll
  private panStart: THREE.Vector2 = new THREE.Vector2();
  private lastX = 0;
  private lastY = 0;
  private listeners: Map<string, Set<(e?: any) => void>> = new Map();

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.object = camera;
    this.domElement = domElement;
    this.addDOMListeners();
  }

  private addDOMListeners(): void {
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onWheel = this.onWheel.bind(this);

    this.domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.domElement.addEventListener('wheel', this.onWheel, { passive: false });
  }

  addEventListener(type: 'start' | 'end' | 'change', listener: (e?: any) => void): void {
    if (!this.listeners.has(type)) {this.listeners.set(type, new Set());}
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: 'start' | 'end' | 'change', listener: (e?: any) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  private dispatchEvent(type: 'start' | 'end' | 'change'): void {
    const set = this.listeners.get(type);
    if (!set) {return;}
    for (const l of set) {l();}
  }

  private getCanvasRect(): DOMRect {
    return this.domElement.getBoundingClientRect();
  }

  private projectOnUnitSphere(clientX: number, clientY: number): THREE.Vector3 {
    const rect = this.getCanvasRect();
    const x = (2 * (clientX - rect.left)) / rect.width - 1;
    const y = 1 - (2 * (clientY - rect.top)) / rect.height;
    const v = new THREE.Vector3(x, y, 0);
    const len2 = x * x + y * y;
    if (len2 <= 1) {
      v.z = Math.sqrt(1 - len2);
    } else {
      v.normalize();
    }
    return v;
  }

  private vectorFromCenter(clientX: number, clientY: number): THREE.Vector2 {
    const rect = this.getCanvasRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const vx = (clientX - cx) / (rect.width / 2);
    const vy = (cy - clientY) / (rect.height / 2);
    const v = new THREE.Vector2(vx, vy);
    if (v.lengthSq() > 1) {v.normalize();}
    return v;
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.enabled) {return;}
    this.domElement.setPointerCapture(e.pointerId);
    if (e.button === 0 && !e.shiftKey) {
      this.isRotating = true;
      this.lastArcVec.copy(this.projectOnUnitSphere(e.clientX, e.clientY));
      this.lastCenterVec.copy(this.vectorFromCenter(e.clientX, e.clientY));
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.dispatchEvent('start');
    } else {
      this.isPanning = true;
      this.panStart.set(e.clientX, e.clientY);
      this.dispatchEvent('start');
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.enabled) {return;}
    if (!this.isRotating && !this.isPanning) {return;}

    if (this.isRotating) {
      const rect = this.getCanvasRect();
      const currSphere = this.projectOnUnitSphere(e.clientX, e.clientY);
      const currCenter2d = this.vectorFromCenter(e.clientX, e.clientY);

      // Basis
      const forward = this.object.getWorldDirection(new THREE.Vector3()).normalize();
      const right = new THREE.Vector3().crossVectors(forward, this.object.up).normalize();
      const up = new THREE.Vector3().crossVectors(right, forward).normalize();

      // Yaw/Pitch from incremental straight drags, with independent signs
      const dx = (e.clientX - this.lastX) / rect.width;
      const dy = (e.clientY - this.lastY) / rect.height;
      const maxStep = this.maxStep; // rad per frame cap to avoid jumps
      let yawAngle = -this.horizontalSign * dx * this.rotateSpeed * Math.PI;
      let pitchAngle = -this.verticalSign * dy * this.rotateSpeed * Math.PI;
      yawAngle = THREE.MathUtils.clamp(yawAngle, -maxStep, maxStep);
      pitchAngle = THREE.MathUtils.clamp(pitchAngle, -maxStep, maxStep);
      const qYaw = new THREE.Quaternion().setFromAxisAngle(up, yawAngle);
      const qPitch = new THREE.Quaternion().setFromAxisAngle(right, pitchAngle);
      const qYawPitch = new THREE.Quaternion().multiplyQuaternions(qYaw, qPitch);

      // Roll from circular gesture around center
      const prev2 = this.lastCenterVec.clone();
      const curr2 = currCenter2d.clone();
      let rollAngle = 0;
      const rMin = this.rollRadiusMin;
      if (prev2.length() > rMin && curr2.length() > rMin) {
        prev2.normalize();
        curr2.normalize();
        const ang = Math.atan2(
          prev2.x * curr2.y - prev2.y * curr2.x,
          prev2.x * curr2.x + prev2.y * curr2.y
        );
        rollAngle = THREE.MathUtils.clamp(this.rollSign * this.rollSpeed * ang, -maxStep, maxStep);
      }
      const qRoll = new THREE.Quaternion().setFromAxisAngle(forward, rollAngle);

      // Combine
      let q = new THREE.Quaternion().multiplyQuaternions(qRoll, qYawPitch);
      if (this.invertRotation) {q.invert();}

      // Apply
      const eye = this.object.position.clone().sub(this.target);
      eye.applyQuaternion(q);
      this.object.up.applyQuaternion(q);
      this.object.position.copy(this.target.clone().add(eye));
      this.object.lookAt(this.target);

      // Update refs
      this.lastArcVec.copy(currSphere);
      this.lastCenterVec.copy(currCenter2d);
      this.lastX = e.clientX;
      this.lastY = e.clientY;
      this.dispatchEvent('change');
    } else if (this.isPanning) {
      const rect = this.getCanvasRect();
      const deltaX = e.clientX - this.panStart.x;
      const deltaY = e.clientY - this.panStart.y;
      this.panStart.set(e.clientX, e.clientY);

      const distance = this.object.position.distanceTo(this.target);
      const fov = this.object.fov * (Math.PI / 180);
      const scale = (2 * Math.tan(fov / 2) * distance) / rect.height;

      const right = new THREE.Vector3();
      const up = new THREE.Vector3();
      right
        .crossVectors(this.object.getWorldDirection(new THREE.Vector3()), this.object.up)
        .normalize();
      up.copy(this.object.up).normalize();

      const move = new THREE.Vector3();
      move.addScaledVector(right, -deltaX * scale * this.panSpeed);
      move.addScaledVector(up, deltaY * scale * this.panSpeed);

      this.target.add(move);
      this.object.position.add(move);
      this.object.lookAt(this.target);
      this.dispatchEvent('change');
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (this.isRotating || this.isPanning) {
      this.isRotating = false;
      this.isPanning = false;
      try {
        this.domElement.releasePointerCapture(e.pointerId);
      } catch (_) {}
      this.dispatchEvent('end');
    }
  }

  private onWheel(e: WheelEvent): void {
    if (!this.enabled) {return;}
    e.preventDefault();
    const delta = e.deltaY; // positive: typically zoom out (move away)
    const scale = Math.exp((delta / 100) * this.zoomSpeed);
    const eye = this.object.position.clone().sub(this.target);
    let newLen = eye.length() * scale;
    newLen = Math.max(this.minDistance, Math.min(this.maxDistance, newLen));
    eye.setLength(newLen);
    this.object.position.copy(this.target.clone().add(eye));
    this.object.lookAt(this.target);
    this.dispatchEvent('start');
    this.dispatchEvent('change');
    this.dispatchEvent('end');
  }

  update(): void {
    // No damping; nothing to do per frame
  }

  dispose(): void {
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.domElement.removeEventListener('wheel', this.onWheel as any);
  }
}

// CloudCompare-like Turntable controls: object-centered orbit with world-up yaw and pitch
export class TurntableControls {
  public object: THREE.PerspectiveCamera;
  public domElement: HTMLElement;
  public enabled = true;
  public target: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public rotateSpeed = 1.0;
  public zoomSpeed = 1.0;
  public panSpeed = 1.0;
  public minDistance = 0.001;
  public maxDistance = 50000;
  public worldUp: THREE.Vector3 = new THREE.Vector3(0, 1, 0);
  public yawSign = 1; // flip left/right sense
  public pitchSign = 1; // flip up/down sense
  public maxPolarClampDeg = 85; // avoid pole flips

  private isRotating = false;
  private isPanning = false;
  private lastX = 0;
  private lastY = 0;
  private lastHorizontal: THREE.Vector3 = new THREE.Vector3(1, 0, 0);
  private listeners: Map<string, Set<(e?: any) => void>> = new Map();

  constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
    this.object = camera;
    this.domElement = domElement;
    this.addDOMListeners();
  }

  addEventListener(type: 'start' | 'end' | 'change', listener: (e?: any) => void): void {
    if (!this.listeners.has(type)) {this.listeners.set(type, new Set());}
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: 'start' | 'end' | 'change', listener: (e?: any) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  private dispatchEvent(type: 'start' | 'end' | 'change'): void {
    const set = this.listeners.get(type);
    if (!set) {return;}
    for (const l of set) {l();}
  }

  private addDOMListeners(): void {
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerUp = this.onPointerUp.bind(this);
    this.onWheel = this.onWheel.bind(this);

    this.domElement.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    this.domElement.addEventListener('wheel', this.onWheel, { passive: false });
  }

  private getCanvasRect(): DOMRect {
    return this.domElement.getBoundingClientRect();
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.enabled) {return;}
    this.domElement.setPointerCapture(e.pointerId);
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    if (e.button === 0 && !e.shiftKey) {
      this.isRotating = true;
      this.dispatchEvent('start');
    } else {
      this.isPanning = true;
      this.dispatchEvent('start');
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.enabled) {return;}
    if (!this.isRotating && !this.isPanning) {return;}

    const rect = this.getCanvasRect();
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;

    if (this.isRotating) {
      const dxNorm = dx / rect.width;
      const dyNorm = dy / rect.height;
      const yawAngle = -this.yawSign * dxNorm * this.rotateSpeed * Math.PI * 2;
      const pitchDelta = -this.pitchSign * dyNorm * this.rotateSpeed * Math.PI;

      const worldUp = this.worldUp.clone().normalize();
      const eye = this.object.position.clone().sub(this.target);
      const radius = eye.length();

      // Horizontal direction (project eye onto plane orthogonal to worldUp)
      let h = eye.clone().projectOnPlane(worldUp);
      if (h.lengthSq() < 1e-12) {
        // Fallback horizontal from previous frame or camera right
        const fallbackRight = new THREE.Vector3().crossVectors(
          this.object.getWorldDirection(new THREE.Vector3()),
          worldUp
        );
        h = fallbackRight.lengthSq() > 1e-12 ? fallbackRight : this.lastHorizontal.clone();
      }
      h.normalize();

      // Apply yaw to horizontal direction
      h.applyAxisAngle(worldUp, yawAngle).normalize();
      this.lastHorizontal.copy(h);

      // Current polar angle from worldUp
      const eyeDir = eye.clone().normalize();
      let polar = Math.acos(THREE.MathUtils.clamp(eyeDir.dot(worldUp), -1, 1));
      polar += pitchDelta;

      // Clamp polar away from poles to avoid flips
      const eps = THREE.MathUtils.degToRad(90 - this.maxPolarClampDeg); // e.g., 5°
      polar = THREE.MathUtils.clamp(polar, eps, Math.PI - eps);

      // Reconstruct eye direction from polar and horizontal
      const newDir = new THREE.Vector3()
        .addScaledVector(worldUp, Math.cos(polar))
        .addScaledVector(h, Math.sin(polar))
        .normalize();
      const newEye = newDir.multiplyScalar(radius);

      this.object.position.copy(this.target.clone().add(newEye));
      this.object.up.copy(worldUp);
      this.object.lookAt(this.target);
      this.dispatchEvent('change');
    } else if (this.isPanning) {
      const distance = this.object.position.distanceTo(this.target);
      const fov = this.object.fov * (Math.PI / 180);
      const scale = (2 * Math.tan(fov / 2) * distance) / rect.height;
      const forward = this.object.getWorldDirection(new THREE.Vector3()).normalize();
      const right = new THREE.Vector3().crossVectors(forward, this.worldUp).normalize();
      const up = this.worldUp.clone().normalize();
      const move = new THREE.Vector3()
        .addScaledVector(right, -dx * scale * this.panSpeed)
        .addScaledVector(up, dy * scale * this.panSpeed);
      this.target.add(move);
      this.object.position.add(move);
      this.object.lookAt(this.target);
      this.dispatchEvent('change');
    }
  }

  private onPointerUp(e: PointerEvent): void {
    if (this.isRotating || this.isPanning) {
      this.isRotating = false;
      this.isPanning = false;
      try {
        this.domElement.releasePointerCapture(e.pointerId);
      } catch (_) {}
      this.dispatchEvent('end');
    }
  }

  private onWheel(e: WheelEvent): void {
    if (!this.enabled) {return;}
    e.preventDefault();
    const scale = Math.exp((e.deltaY / 100) * this.zoomSpeed);
    const eye = this.object.position.clone().sub(this.target);
    let newLen = eye.length() * scale;
    newLen = Math.max(this.minDistance, Math.min(this.maxDistance, newLen));
    eye.setLength(newLen);
    this.object.position.copy(this.target.clone().add(eye));
    this.object.lookAt(this.target);
    this.dispatchEvent('start');
    this.dispatchEvent('change');
    this.dispatchEvent('end');
  }

  update(): void {}

  dispose(): void {
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.domElement.removeEventListener('wheel', this.onWheel as any);
  }
}
