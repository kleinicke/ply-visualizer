import * as THREE from 'three';

/**
 * Sphere-projected ("virtual ball") trackball controls.
 *
 * The decisive difference from three.js TrackballControls is that rotation is
 * computed from the mouse's *position on a virtual ball*, not from mouse
 * deltas. Consequences that delta-based trackballs cannot reproduce:
 *
 * - Center drags give yaw/pitch in the same direction as a normal trackball
 *   (the scene front follows the mouse).
 * - Drags near the rim, or tangential/circular gestures, ROLL the scene under
 *   the cursor — the ball follows the finger. This is "the rotation" that was
 *   always backwards here: a delta-based trackball's only roll is the
 *   accumulation (holonomy) of its yaw/pitch steps, which comes out in the
 *   opposite direction of the finger, and no sign flip can fix it because the
 *   per-step math has no roll term at all (see docs/BACKLOG.md post-mortem).
 *
 * To keep those properties while allowing sensitivity well above the natural
 * grab-the-ball speed, the gesture is split into two independently scaled
 * parts (naively multiplying incremental step angles does NOT work — the
 * amplified yaw/pitch steps rebuild the counter-holonomy and circular-drag
 * roll flips back to the wrong direction):
 *
 * - SWING (yaw/pitch) is Shoemake-arcball style: the twist-free part of the
 *   single rotation from the drag-start ball point to the current one, angle
 *   scaled by `rotateSpeed`. Being endpoint-based it is path-independent, so
 *   a closed mouse loop contributes exactly zero swing at any speed.
 * - TWIST (roll) is the integral of each step's view-axis component, scaled
 *   by `rollSpeed` — for circular gestures this is precisely the
 *   ball-follows-finger roll.
 *
 * Each pointer move recomputes the camera pose from the drag-start pose with
 * one rigid quaternion (conjugated from view space into world space), so the
 * camera frame stays orthonormal — no decomposition drift, no momentum state.
 */
/** Scale a rotation's angle by `factor`, keeping its axis. */
function scaleRotation(q: THREE.Quaternion, factor: number): THREE.Quaternion {
  const angle = 2 * Math.acos(THREE.MathUtils.clamp(q.w, -1, 1));
  if (angle < 1e-12) {
    return q.clone();
  }
  const s = Math.sin(angle / 2);
  const axis = new THREE.Vector3(q.x / s, q.y / s, q.z / s);
  return new THREE.Quaternion().setFromAxisAngle(axis, angle * factor);
}

export class VirtualBallControls {
  public object: THREE.PerspectiveCamera;
  public domElement: HTMLElement;
  public enabled = true;
  public target: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  // Orbit (yaw/pitch, "swing") multiplier. 1.0 = true grab-the-ball feel
  // (center-to-rim drag = 90°); higher values trade the exact ball metaphor
  // for faster orbiting.
  public rotateSpeed = 1.0;
  // Roll ("twist") multiplier, independent of the orbit speed.
  public rollSpeed = 1.0;
  // Upper bound (rad) for the scaled swing of one drag. Must stay below π:
  // a rotation past π wraps around and the view lurches backwards. The
  // scaled swing approaches this limit smoothly (tanh), so small drags keep
  // exactly rotateSpeed slope and long drags saturate instead of wrapping —
  // re-grab to keep orbiting.
  public swingLimit = 2.5;
  // Wheel-zoom speed with the same semantics as three.js TrackballControls
  // (2.5 here feels like 2.5 there): a wheel notch contributes
  // deltaY·0.00125·zoomSpeed of log-zoom, eased in over several frames.
  public zoomSpeed = 1.0;
  // Fraction of the outstanding zoom applied per animation frame.
  public zoomDampingFactor = 0.2;
  public panSpeed = 1.0;
  public minDistance = 0.001;
  public maxDistance = 50000;

  private isRotating = false;
  private isPanning = false;
  // Rotation drag session state: ball points and the camera pose the drag
  // started from (poses are recomputed absolutely from here every move).
  private dragStartSphere: THREE.Vector3 = new THREE.Vector3();
  private prevSphere: THREE.Vector3 = new THREE.Vector3();
  private twistAccum = 0;
  private eyeStart: THREE.Vector3 = new THREE.Vector3();
  private upStart: THREE.Vector3 = new THREE.Vector3();
  private camQStart: THREE.Quaternion = new THREE.Quaternion();
  private panStart: THREE.Vector2 = new THREE.Vector2();
  // Outstanding wheel zoom (log scale), eased toward zero in update().
  private pendingZoomLog = 0;
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
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: 'start' | 'end' | 'change', listener: (e?: any) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  private dispatchEvent(type: 'start' | 'end' | 'change'): void {
    const set = this.listeners.get(type);
    if (!set) {
      return;
    }
    for (const l of set) {
      l();
    }
  }

  /**
   * Project a client-space cursor position onto the virtual unit ball in view
   * coordinates (x right, y up, z out of the screen). The ball is ROUND: both
   * axes are normalized by the smaller half-dimension (the ball is inscribed
   * in the canvas). Normalizing per-axis instead would make the ball
   * elliptical, which slows horizontal drags relative to vertical ones and
   * exaggerates the tangential (roll) fraction of off-center horizontal
   * drags. Inside the ball the point sits on the sphere surface; outside it
   * is clamped to the rim, which is what makes rim drags purely tangential
   * (roll).
   */
  private projectOnUnitSphere(clientX: number, clientY: number): THREE.Vector3 {
    const rect = this.domElement.getBoundingClientRect();
    const halfMin = Math.min(rect.width, rect.height) / 2;
    const x = (clientX - rect.left - rect.width / 2) / halfMin;
    const y = (rect.top + rect.height / 2 - clientY) / halfMin;
    const v = new THREE.Vector3(x, y, 0);
    const len2 = x * x + y * y;
    if (len2 <= 1) {
      v.z = Math.sqrt(1 - len2);
    } else {
      v.normalize();
    }
    return v;
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.enabled) {
      return;
    }
    this.domElement.setPointerCapture(e.pointerId);
    if (e.button === 0 && !e.shiftKey) {
      this.isRotating = true;
      this.dragStartSphere.copy(this.projectOnUnitSphere(e.clientX, e.clientY));
      this.prevSphere.copy(this.dragStartSphere);
      this.twistAccum = 0;
      this.eyeStart.copy(this.object.position).sub(this.target);
      this.upStart.copy(this.object.up);
      this.camQStart.copy(this.object.quaternion);
      this.dispatchEvent('start');
    } else {
      this.isPanning = true;
      this.panStart.set(e.clientX, e.clientY);
      this.dispatchEvent('start');
    }
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.enabled) {
      return;
    }
    if (this.isRotating) {
      const curr = this.projectOnUnitSphere(e.clientX, e.clientY);
      if (this.prevSphere.distanceToSquared(curr) < 1e-14) {
        return;
      }

      // TWIST: integrate the view-axis component of this step (the tangential
      // part of the motion — for circular gestures, the ball-follows-finger
      // roll), independent of the swing.
      const qStep = new THREE.Quaternion().setFromUnitVectors(this.prevSphere, curr);
      this.twistAccum += 2 * Math.atan2(qStep.z, qStep.w) * this.rollSpeed;
      this.prevSphere.copy(curr);

      // SWING: single endpoint-based rotation from the drag-start ball point
      // to the current one, with its own twist component removed (roll is
      // owned entirely by twistAccum — keeping it here would double-count).
      // Endpoint-based means path-independent: closed loops add zero swing,
      // so scaling its angle cannot create counter-roll.
      const qFull = new THREE.Quaternion().setFromUnitVectors(this.dragStartSphere, curr);
      const twistPart = new THREE.Quaternion(0, 0, qFull.z, qFull.w).normalize();
      const swing = qFull.clone().multiply(twistPart.clone().invert());

      // Scale the swing with soft saturation (see swingLimit): factor is
      // rotateSpeed for small chords, then eases toward the cap.
      const swingAngle = 2 * Math.acos(THREE.MathUtils.clamp(swing.w, -1, 1));
      let swingFactor = this.rotateSpeed;
      if (swingAngle > 1e-12) {
        const scaled =
          this.swingLimit * Math.tanh((swingAngle * this.rotateSpeed) / this.swingLimit);
        swingFactor = scaled / swingAngle;
      }

      // Total apparent scene rotation for this drag, in view space.
      const qView = scaleRotation(swing, swingFactor).multiply(
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), this.twistAccum)
      );

      // Recompute the pose from the drag-start state: camera rig rotates by
      // the inverse, conjugated from view space into world space using the
      // drag-start orientation (camQStart maps camera-local to world).
      const qWorld = this.camQStart
        .clone()
        .multiply(qView.invert())
        .multiply(this.camQStart.clone().invert());

      const eye = this.eyeStart.clone().applyQuaternion(qWorld);
      this.object.up.copy(this.upStart).applyQuaternion(qWorld);
      this.object.position.copy(this.target).add(eye);
      this.object.lookAt(this.target);

      this.dispatchEvent('change');
    } else if (this.isPanning) {
      const rect = this.domElement.getBoundingClientRect();
      const deltaX = e.clientX - this.panStart.x;
      const deltaY = e.clientY - this.panStart.y;
      this.panStart.set(e.clientX, e.clientY);

      const distance = this.object.position.distanceTo(this.target);
      const fov = this.object.fov * (Math.PI / 180);
      const scale = (2 * Math.tan(fov / 2) * distance) / rect.height;

      const right = new THREE.Vector3()
        .crossVectors(this.object.getWorldDirection(new THREE.Vector3()), this.object.up)
        .normalize();
      const up = this.object.up.clone().normalize();

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
    if (!this.enabled) {
      return;
    }
    e.preventDefault();
    // Same per-notch calibration as three.js TrackballControls: it offsets an
    // eased value by deltaY·0.00025 (pixels; ×40 lines, ×100 pages) and its
    // damped catch-up multiplies the total by zoomSpeed/dampingFactor — i.e.
    // deltaY·0.00125·zoomSpeed of log-zoom, arriving smoothly, not at once.
    const perPixel = e.deltaMode === 2 ? 0.025 : e.deltaMode === 1 ? 0.01 : 0.00025;
    this.pendingZoomLog += e.deltaY * perPixel * 5 * this.zoomSpeed;
    this.dispatchEvent('start');
    this.dispatchEvent('end');
  }

  update(): void {
    // Ease any outstanding wheel zoom toward zero (legacy-trackball feel:
    // each notch glides in over several frames instead of jumping).
    if (this.pendingZoomLog !== 0) {
      let step = this.pendingZoomLog * this.zoomDampingFactor;
      if (Math.abs(this.pendingZoomLog - step) < 1e-4) {
        step = this.pendingZoomLog;
      }
      this.pendingZoomLog -= step;

      const eye = this.object.position.clone().sub(this.target);
      let newLen = eye.length() * Math.exp(step);
      newLen = Math.max(this.minDistance, Math.min(this.maxDistance, newLen));
      eye.setLength(newLen);
      this.object.position.copy(this.target.clone().add(eye));
      this.object.lookAt(this.target);
      // Rotation poses are recomputed from the drag-start eye each move, so a
      // zoom during an active drag must be folded into that baseline too.
      if (this.isRotating) {
        this.eyeStart.setLength(newLen);
      }
      this.dispatchEvent('change');
    }
  }

  dispose(): void {
    this.domElement.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    this.domElement.removeEventListener('wheel', this.onWheel as any);
  }
}

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
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: 'start' | 'end' | 'change', listener: (e?: any) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  private dispatchEvent(type: 'start' | 'end' | 'change'): void {
    const set = this.listeners.get(type);
    if (!set) {
      return;
    }
    for (const l of set) {
      l();
    }
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
    if (v.lengthSq() > 1) {
      v.normalize();
    }
    return v;
  }

  private onPointerDown(e: PointerEvent): void {
    if (!this.enabled) {
      return;
    }
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
    if (!this.enabled) {
      return;
    }
    if (!this.isRotating && !this.isPanning) {
      return;
    }

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
      if (this.invertRotation) {
        q.invert();
      }

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
    if (!this.enabled) {
      return;
    }
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

// Turntable controls: object-centered orbit with world-up yaw and pitch
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
    if (!this.listeners.has(type)) {
      this.listeners.set(type, new Set());
    }
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: 'start' | 'end' | 'change', listener: (e?: any) => void): void {
    this.listeners.get(type)?.delete(listener);
  }

  private dispatchEvent(type: 'start' | 'end' | 'change'): void {
    const set = this.listeners.get(type);
    if (!set) {
      return;
    }
    for (const l of set) {
      l();
    }
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
    if (!this.enabled) {
      return;
    }
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
    if (!this.enabled) {
      return;
    }
    if (!this.isRotating && !this.isPanning) {
      return;
    }

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
    if (!this.enabled) {
      return;
    }
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
