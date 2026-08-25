import * as THREE from 'three';

export interface TouchNavigationControls {
  enabled: boolean;
  target: THREE.Vector3;
  minDistance?: number;
  maxDistance?: number;
  update(): void;
}

interface Options {
  camera: THREE.PerspectiveCamera;
  element: HTMLElement;
  getControls(): TouchNavigationControls;
  onChange(): void;
  onDoubleTap(clientX: number, clientY: number): void;
}

interface Pair {
  distance: number;
  angle: number;
}

interface Tap {
  pointerId: number;
  start: THREE.Vector2;
  current: THREE.Vector2;
  startedAt: number;
}

const TAP_MOVE = 14;
const TAP_TIME = 450;
const DOUBLE_TAP_DISTANCE = 32;
const DOUBLE_TAP_TIME = 450;
const POLAR_EPSILON = 1e-4;

function wrappedAngleDelta(next: number, previous: number): number {
  let delta = next - previous;
  while (delta > Math.PI) {delta -= Math.PI * 2;}
  while (delta < -Math.PI) {delta += Math.PI * 2;}
  return delta;
}

/** Purpose-built touch navigation, intentionally independent of mouse controls. */
export class TouchNavigationController {
  private readonly camera: THREE.PerspectiveCamera;
  private readonly element: HTMLElement;
  private readonly getControls: () => TouchNavigationControls;
  private readonly onChange: () => void;
  private readonly onDoubleTap: (x: number, y: number) => void;
  private readonly pointers = new Map<number, THREE.Vector2>();
  private inputMode: 'pointer' | 'touch' | null = null;
  private sessionControls: TouchNavigationControls | null = null;
  private controlsWereEnabled = true;
  private worldUp = new THREE.Vector3(0, 1, 0);
  private lastOne: THREE.Vector2 | null = null;
  private lastPair: Pair | null = null;
  private hadMultiple = false;
  private tap: Tap | null = null;
  private previousTap: { position: THREE.Vector2; completedAt: number } | null = null;

  constructor(options: Options) {
    this.camera = options.camera;
    this.element = options.element;
    this.getControls = options.getControls;
    this.onChange = options.onChange;
    this.onDoubleTap = options.onDoubleTap;
    this.element.addEventListener('pointerdown', this.onPointerDown, { capture: true });
    window.addEventListener('pointermove', this.onPointerMove, { capture: true, passive: false });
    window.addEventListener('pointerup', this.onPointerUp, { capture: true });
    window.addEventListener('pointercancel', this.onPointerUp, { capture: true });
    this.element.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.element.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.element.addEventListener('touchend', this.onTouchEnd);
    this.element.addEventListener('touchcancel', this.onTouchEnd);
  }

  dispose(): void {
    this.element.removeEventListener('pointerdown', this.onPointerDown, { capture: true });
    window.removeEventListener('pointermove', this.onPointerMove, { capture: true });
    window.removeEventListener('pointerup', this.onPointerUp, { capture: true });
    window.removeEventListener('pointercancel', this.onPointerUp, { capture: true });
    this.element.removeEventListener('touchstart', this.onTouchStart);
    this.element.removeEventListener('touchmove', this.onTouchMove);
    this.element.removeEventListener('touchend', this.onTouchEnd);
    this.element.removeEventListener('touchcancel', this.onTouchEnd);
    this.endSession();
    this.pointers.clear();
  }

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch') {return;}
    this.claim(event);
    this.inputMode = 'pointer';
    this.pointers.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
    if (this.pointers.size === 1) {
      this.beginSession();
      this.lastOne = this.pointers.get(event.pointerId)!.clone();
      this.startTap(event.pointerId, event.clientX, event.clientY);
    } else {
      this.startPair();
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch' || !this.pointers.has(event.pointerId)) {return;}
    this.claim(event);
    this.pointers.set(event.pointerId, new THREE.Vector2(event.clientX, event.clientY));
    this.updateTap(event.pointerId, event.clientX, event.clientY);
    this.applyGesture();
  };

  private readonly onPointerUp = (event: PointerEvent): void => {
    if (event.pointerType !== 'touch' || !this.pointers.has(event.pointerId)) {return;}
    this.claim(event);
    if (!this.hadMultiple && event.type !== 'pointercancel') {
      this.finishTap(event.pointerId, event.clientX, event.clientY);
    }
    this.pointers.delete(event.pointerId);
    this.afterFingerLift();
  };

  private readonly onTouchStart = (event: TouchEvent): void => {
    if (this.inputMode === 'pointer') {return;}
    event.preventDefault();
    this.inputMode = 'touch';
    this.syncTouches(event.touches);
    if (this.pointers.size === 1) {
      this.beginSession();
      const [id, point] = [...this.pointers.entries()][0];
      this.lastOne = point.clone();
      this.startTap(id, point.x, point.y);
    } else {
      this.startPair();
    }
  };

  private readonly onTouchMove = (event: TouchEvent): void => {
    if (this.inputMode !== 'touch') {return;}
    event.preventDefault();
    this.syncTouches(event.touches);
    if (this.pointers.size === 1 && this.tap) {
      const point = this.pointers.get(this.tap.pointerId);
      if (point) {this.updateTap(this.tap.pointerId, point.x, point.y);}
    }
    this.applyGesture();
  };

  private readonly onTouchEnd = (event: TouchEvent): void => {
    if (this.inputMode !== 'touch') {return;}
    if (!this.hadMultiple && event.type !== 'touchcancel' && this.tap) {
      this.finishTap(this.tap.pointerId, this.tap.current.x, this.tap.current.y);
    }
    this.syncTouches(event.touches);
    this.afterFingerLift();
  };

  private beginSession(): void {
    if (this.sessionControls) {return;}
    const controls = this.getControls();
    this.sessionControls = controls;
    this.controlsWereEnabled = controls.enabled;
    controls.enabled = false;
    this.stopMomentum(controls);
    this.worldUp.copy(this.camera.up);
    if (this.worldUp.lengthSq() === 0) {this.worldUp.set(0, 1, 0);}
    this.worldUp.normalize();
    this.camera.up.copy(this.worldUp);
    this.hadMultiple = false;
  }

  private endSession(): void {
    if (!this.sessionControls) {return;}
    this.stopMomentum(this.sessionControls);
    this.sessionControls.enabled = this.controlsWereEnabled;
    this.sessionControls = null;
    this.lastOne = null;
    this.lastPair = null;
    this.hadMultiple = false;
    this.tap = null;
  }

  private startPair(): void {
    this.hadMultiple = true;
    this.tap = null;
    this.previousTap = null;
    this.lastOne = null;
    this.lastPair = this.pair();
  }

  private afterFingerLift(): void {
    if (this.pointers.size === 1) {
      this.lastPair = null;
      this.lastOne = [...this.pointers.values()][0].clone();
    } else if (this.pointers.size === 0) {
      this.endSession();
      this.inputMode = null;
    }
  }

  private applyGesture(): void {
    if (this.pointers.size === 1) {
      const point = [...this.pointers.values()][0];
      if (this.lastOne) {this.orbit(point.x - this.lastOne.x, point.y - this.lastOne.y);}
      this.lastOne = point.clone();
      return;
    }
    if (this.pointers.size < 2) {return;}
    const next = this.pair();
    const previous = this.lastPair;
    this.lastPair = next;
    if (!previous) {return;}

    // Two-finger translation deliberately does nothing: yaw/pitch orbit belongs
    // exclusively to one-finger dragging. Pinching zooms and twisting rolls the
    // view, allowing the user to choose a new up direction.
    this.roll(wrappedAngleDelta(next.angle, previous.angle));
    const controls = this.getControls();
    const eye = this.camera.position.clone().sub(controls.target);
    eye.setLength(
      THREE.MathUtils.clamp(
        eye.length() * (previous.distance / next.distance),
        controls.minDistance ?? 0.001,
        controls.maxDistance ?? 50000
      )
    );
    this.camera.position.copy(controls.target).add(eye);
    this.camera.lookAt(controls.target);
    this.onChange();
  }

  private orbit(dx: number, dy: number, notify = true): void {
    if (dx === 0 && dy === 0) {return;}
    const controls = this.getControls();
    const eye = this.camera.position.clone().sub(controls.target);
    if (eye.lengthSq() === 0) {return;}
    const yUp = new THREE.Vector3(0, 1, 0);
    const toY = new THREE.Quaternion().setFromUnitVectors(this.worldUp, yUp);
    eye.applyQuaternion(toY);
    const spherical = new THREE.Spherical().setFromVector3(eye);
    const height = Math.max(1, this.element.getBoundingClientRect().height);
    spherical.theta -= (2 * Math.PI * dx) / height;
    spherical.phi -= (2 * Math.PI * dy) / height;
    spherical.phi = THREE.MathUtils.clamp(spherical.phi, POLAR_EPSILON, Math.PI - POLAR_EPSILON);
    eye.setFromSpherical(spherical).applyQuaternion(toY.invert());
    this.camera.position.copy(controls.target).add(eye);
    this.camera.up.copy(this.worldUp);
    this.camera.lookAt(controls.target);
    if (notify) {this.onChange();}
  }

  private roll(angle: number): void {
    if (angle === 0) {return;}
    const controls = this.getControls();
    const viewDirection = controls.target.clone().sub(this.camera.position);
    if (viewDirection.lengthSq() === 0) {return;}
    viewDirection.normalize();
    this.camera.up.applyAxisAngle(viewDirection, -angle).normalize();
    // If one finger remains after the twist, its stable-up orbit must preserve
    // the newly chosen up direction rather than snapping back to the old one.
    this.worldUp.copy(this.camera.up);
    this.camera.lookAt(controls.target);
  }

  private pair(): Pair {
    const [first, second] = [...this.pointers.values()];
    return {
      distance: Math.max(1, first.distanceTo(second)),
      angle: Math.atan2(second.y - first.y, second.x - first.x),
    };
  }

  private syncTouches(touches: TouchList): void {
    this.pointers.clear();
    for (let i = 0; i < touches.length; i++) {
      const touch = touches.item(i);
      if (touch) {this.pointers.set(touch.identifier, new THREE.Vector2(touch.clientX, touch.clientY));}
    }
  }

  private claim(event: PointerEvent): void {
    event.preventDefault();
    event.stopImmediatePropagation();
  }

  private startTap(pointerId: number, x: number, y: number): void {
    const point = new THREE.Vector2(x, y);
    this.tap = { pointerId, start: point.clone(), current: point, startedAt: performance.now() };
  }

  private updateTap(pointerId: number, x: number, y: number): void {
    if (!this.tap || this.tap.pointerId !== pointerId) {return;}
    this.tap.current.set(x, y);
    if (this.tap.current.distanceTo(this.tap.start) > TAP_MOVE) {this.tap = null;}
  }

  private finishTap(pointerId: number, x: number, y: number): void {
    const tap = this.tap;
    this.tap = null;
    if (!tap || tap.pointerId !== pointerId) {return;}
    const now = performance.now();
    const position = new THREE.Vector2(x, y);
    if (now - tap.startedAt > TAP_TIME || position.distanceTo(tap.start) > TAP_MOVE) {return;}
    if (
      this.previousTap &&
      now - this.previousTap.completedAt <= DOUBLE_TAP_TIME &&
      position.distanceTo(this.previousTap.position) <= DOUBLE_TAP_DISTANCE
    ) {
      this.previousTap = null;
      this.onDoubleTap(x, y);
    } else {
      this.previousTap = { position, completedAt: now };
    }
  }

  private stopMomentum(controls: TouchNavigationControls): void {
    const native = controls as TouchNavigationControls & {
      _panStart?: THREE.Vector2;
      _panEnd?: THREE.Vector2;
      _zoomStart?: THREE.Vector2;
      _zoomEnd?: THREE.Vector2;
      _lastAngle?: number;
    };
    if (native._panStart && native._panEnd) {native._panStart.copy(native._panEnd);}
    if (native._zoomStart && native._zoomEnd) {native._zoomStart.copy(native._zoomEnd);}
    if (native._lastAngle !== undefined) {native._lastAngle = 0;}
  }
}
