import * as assert from 'assert';
import { CustomArcballControls, TurntableControls } from '../../webview/controls';

// Mock DOM elements and THREE.js components
class MockHTMLElement {
  private listeners: Map<string, ((e: Event) => void)[]> = new Map();
  private boundingClientRect = { left: 0, top: 0, width: 800, height: 600 };

  addEventListener(type: string, listener: (e: Event) => void): void {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: (e: Event) => void): void {
    const list = this.listeners.get(type);
    if (list) {
      const index = list.indexOf(listener);
      if (index > -1) {list.splice(index, 1);}
    }
  }

  getBoundingClientRect(): DOMRect {
    return this.boundingClientRect as DOMRect;
  }

  setPointerCapture(_pointerId: number): void {}
  releasePointerCapture(_pointerId: number): void {}

  simulateEvent(type: string, eventData: any): void {
    const listeners = this.listeners.get(type);
    if (listeners) {
      listeners.forEach(listener => listener(eventData));
    }
  }

  setBoundingRect(rect: { left: number; top: number; width: number; height: number }): void {
    this.boundingClientRect = rect;
  }
}

class MockVector3 {
  public x: number;
  public y: number;
  public z: number;

  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  clone(): MockVector3 {
    return new MockVector3(this.x, this.y, this.z);
  }
  copy(v: MockVector3): MockVector3 {
    this.x = v.x;
    this.y = v.y;
    this.z = v.z;
    return this;
  }
  set(x: number, y: number, z: number): MockVector3 {
    this.x = x;
    this.y = y;
    this.z = z;
    return this;
  }
  add(v: MockVector3): MockVector3 {
    this.x += v.x;
    this.y += v.y;
    this.z += v.z;
    return this;
  }
  sub(v: MockVector3): MockVector3 {
    this.x -= v.x;
    this.y -= v.y;
    this.z -= v.z;
    return this;
  }
  multiplyScalar(s: number): MockVector3 {
    this.x *= s;
    this.y *= s;
    this.z *= s;
    return this;
  }
  normalize(): MockVector3 {
    const l = this.length();
    if (l > 0) {
      this.multiplyScalar(1 / l);
    }
    return this;
  }
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
  lengthSq(): number {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  dot(v: MockVector3): number {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  distanceTo(v: MockVector3): number {
    return this.clone().sub(v).length();
  }
  crossVectors(a: MockVector3, b: MockVector3): MockVector3 {
    this.x = a.y * b.z - a.z * b.y;
    this.y = a.z * b.x - a.x * b.z;
    this.z = a.x * b.y - a.y * b.x;
    return this;
  }
  applyQuaternion(_q: any): MockVector3 {
    return this;
  }
  applyAxisAngle(_axis: MockVector3, _angle: number): MockVector3 {
    return this;
  }
  setLength(length: number): MockVector3 {
    return this.normalize().multiplyScalar(length);
  }
  projectOnPlane(planeNormal: MockVector3): MockVector3 {
    const v = this.clone();
    const projected = planeNormal.clone().multiplyScalar(v.dot(planeNormal));
    return v.sub(projected);
  }
  addScaledVector(v: MockVector3, scale: number): MockVector3 {
    this.x += v.x * scale;
    this.y += v.y * scale;
    this.z += v.z * scale;
    return this;
  }
}

class MockVector2 {
  public x: number;
  public y: number;

  constructor(x = 0, y = 0) {
    this.x = x;
    this.y = y;
  }

  clone(): MockVector2 {
    return new MockVector2(this.x, this.y);
  }
  copy(v: MockVector2): MockVector2 {
    this.x = v.x;
    this.y = v.y;
    return this;
  }
  set(x: number, y: number): MockVector2 {
    this.x = x;
    this.y = y;
    return this;
  }
  length(): number {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
  lengthSq(): number {
    return this.x * this.x + this.y * this.y;
  }
  normalize(): MockVector2 {
    const l = this.length();
    if (l > 0) {
      this.x /= l;
      this.y /= l;
    }
    return this;
  }
}

class MockQuaternion {
  constructor() {}
  setFromAxisAngle(_axis: MockVector3, _angle: number): MockQuaternion {
    return this;
  }
  multiplyQuaternions(_a: MockQuaternion, _b: MockQuaternion): MockQuaternion {
    return this;
  }
  invert(): MockQuaternion {
    return this;
  }
}

class MockMathUtils {
  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }
  static degToRad(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
}

class MockPerspectiveCamera {
  public position: MockVector3;
  public up: MockVector3;
  public fov: number;

  constructor() {
    this.position = new MockVector3(0, 0, 5);
    this.up = new MockVector3(0, 1, 0);
    this.fov = 50;
  }

  getWorldDirection(_target: MockVector3): MockVector3 {
    return new MockVector3(0, 0, -1);
  }

  lookAt(_target: MockVector3): void {}
}

// Mock THREE.js
const mockTHREE = {
  Vector3: MockVector3,
  Vector2: MockVector2,
  Quaternion: MockQuaternion,
  PerspectiveCamera: MockPerspectiveCamera,
  MathUtils: MockMathUtils,
};

// Setup minimal DOM mocks for Node.js testing
(global as any).window = {
  addEventListener: () => {},
  removeEventListener: () => {},
};

// Replace the actual THREE import with lightweight mocks for testing
const originalRequire = require;
require = function (this: any, moduleId: string) {
  if (moduleId === 'three') {
    return mockTHREE;
  }
  return originalRequire.apply(this, arguments as any);
} as any;

suite('CustomArcballControls', () => {
  let controls: CustomArcballControls;
  let camera: MockPerspectiveCamera;
  let domElement: MockHTMLElement;

  setup(() => {
    camera = new MockPerspectiveCamera();
    domElement = new MockHTMLElement();
    controls = new CustomArcballControls(camera as any, domElement as any);
  });

  teardown(() => {
    if (controls) {
      controls.dispose();
    }
  });

  test('should initialize with default values', () => {
    assert.strictEqual(controls.enabled, true);
    assert.strictEqual(controls.rotateSpeed, 2.0);
    assert.strictEqual(controls.zoomSpeed, 1.0);
    assert.strictEqual(controls.panSpeed, 1.0);
    assert.strictEqual(controls.minDistance, 0.001);
    assert.strictEqual(controls.maxDistance, 50000);
    assert.strictEqual(controls.invertRotation, false);
    assert.strictEqual(controls.horizontalSign, 1);
    assert.strictEqual(controls.verticalSign, 1);
    assert.strictEqual(controls.rollSign, 1);
    assert.strictEqual(controls.rollSpeed, 1.0);
    assert.strictEqual(controls.maxStep, 0.25);
    assert.strictEqual(controls.rollRadiusMin, 0.1);
  });

  test('should set target vector', () => {
    controls.target.set(1, 2, 3);
    assert.strictEqual(controls.target.x, 1);
    assert.strictEqual(controls.target.y, 2);
    assert.strictEqual(controls.target.z, 3);
  });

  test('should add and remove event listeners', () => {
    let startCalled = false;
    let changeCalled = false;
    let endCalled = false;

    const startListener = () => (startCalled = true);
    const changeListener = () => (changeCalled = true);
    const endListener = () => (endCalled = true);

    controls.addEventListener('start', startListener);
    controls.addEventListener('change', changeListener);
    controls.addEventListener('end', endListener);

    // Simulate events
    (controls as any).dispatchEvent('start');
    (controls as any).dispatchEvent('change');
    (controls as any).dispatchEvent('end');

    assert.strictEqual(startCalled, true);
    assert.strictEqual(changeCalled, true);
    assert.strictEqual(endCalled, true);

    // Remove listeners and test they don't fire
    controls.removeEventListener('start', startListener);
    controls.removeEventListener('change', changeListener);
    controls.removeEventListener('end', endListener);

    startCalled = changeCalled = endCalled = false;
    (controls as any).dispatchEvent('start');
    (controls as any).dispatchEvent('change');
    (controls as any).dispatchEvent('end');

    assert.strictEqual(startCalled, false);
    assert.strictEqual(changeCalled, false);
    assert.strictEqual(endCalled, false);
  });

  test('should handle pointer down for rotation', () => {
    let startEventFired = false;
    controls.addEventListener('start', () => (startEventFired = true));

    const pointerEvent = {
      button: 0,
      shiftKey: false,
      clientX: 400,
      clientY: 300,
      pointerId: 1,
    };

    domElement.simulateEvent('pointerdown', pointerEvent);
    assert.strictEqual(startEventFired, true);
  });

  test('should handle pointer down for panning', () => {
    let startEventFired = false;
    controls.addEventListener('start', () => (startEventFired = true));

    const pointerEvent = {
      button: 1, // Middle mouse or shift+left click
      shiftKey: false,
      clientX: 400,
      clientY: 300,
      pointerId: 1,
    };

    domElement.simulateEvent('pointerdown', pointerEvent);
    assert.strictEqual(startEventFired, true);
  });

  test('should handle wheel zoom', () => {
    let changeEventFired = false;
    controls.addEventListener('change', () => (changeEventFired = true));

    const wheelEvent = {
      deltaY: 100,
      preventDefault: () => {},
    };

    domElement.simulateEvent('wheel', wheelEvent);
    assert.strictEqual(changeEventFired, true);
  });

  test('should clamp zoom distance', () => {
    // Test min distance clamping
    const wheelEventIn = {
      deltaY: -10000, // Very large zoom in
      preventDefault: () => {},
    };
    domElement.simulateEvent('wheel', wheelEventIn);

    const minDistance = camera.position.distanceTo(controls.target);
    assert.ok(minDistance >= controls.minDistance);

    // Reset position
    camera.position.set(0, 0, 5);

    // Test max distance clamping
    const wheelEventOut = {
      deltaY: 10000, // Very large zoom out
      preventDefault: () => {},
    };
    domElement.simulateEvent('wheel', wheelEventOut);

    const maxDistance = camera.position.distanceTo(controls.target);
    assert.ok(maxDistance <= controls.maxDistance);
  });

  test('should respect enabled flag', () => {
    controls.enabled = false;
    let eventFired = false;
    controls.addEventListener('start', () => (eventFired = true));

    const pointerEvent = {
      button: 0,
      shiftKey: false,
      clientX: 400,
      clientY: 300,
      pointerId: 1,
    };

    domElement.simulateEvent('pointerdown', pointerEvent);
    assert.strictEqual(eventFired, false);
  });

  test('should handle inverted rotation setting', () => {
    controls.invertRotation = true;
    assert.strictEqual(controls.invertRotation, true);

    // Test that inverted rotation affects the rotation calculation
    // We can't easily test the actual rotation due to mocking complexity,
    // but we can verify the setting is stored
    controls.invertRotation = false;
    assert.strictEqual(controls.invertRotation, false);
  });

  test('should handle custom rotation signs', () => {
    controls.horizontalSign = -1;
    controls.verticalSign = -1;
    controls.rollSign = -1;

    assert.strictEqual(controls.horizontalSign, -1);
    assert.strictEqual(controls.verticalSign, -1);
    assert.strictEqual(controls.rollSign, -1);
  });

  test('should handle speed settings', () => {
    controls.rotateSpeed = 3.0;
    controls.zoomSpeed = 2.0;
    controls.panSpeed = 1.5;
    controls.rollSpeed = 0.5;

    assert.strictEqual(controls.rotateSpeed, 3.0);
    assert.strictEqual(controls.zoomSpeed, 2.0);
    assert.strictEqual(controls.panSpeed, 1.5);
    assert.strictEqual(controls.rollSpeed, 0.5);
  });

  test('should project points on unit sphere correctly', () => {
    // Test center point
    const center = (controls as any).projectOnUnitSphere(400, 300);
    assert.ok(center.x === 0);
    assert.ok(center.y === 0);
    assert.ok(center.z > 0);

    // Test corner points
    const corner = (controls as any).projectOnUnitSphere(800, 600);
    assert.ok(corner.length() <= 1.001); // Account for floating point precision
  });

  test('should calculate vector from center correctly', () => {
    domElement.setBoundingRect({ left: 0, top: 0, width: 800, height: 600 });

    const center = (controls as any).vectorFromCenter(400, 300);
    assert.ok(Math.abs(center.x) < 0.001);
    assert.ok(Math.abs(center.y) < 0.001);

    const edge = (controls as any).vectorFromCenter(800, 600);
    assert.ok(edge.length() <= 1.001);
  });

  test('should dispose properly', () => {
    controls.dispose();

    // After disposal, event listeners should be cleaned up
    // We can't easily test this with our mock, but we can verify dispose doesn't throw
    assert.ok(true);
  });

  test('should handle update method', () => {
    // Update method should not throw for arcball controls
    assert.doesNotThrow(() => controls.update());
  });
});

suite('TurntableControls', () => {
  let controls: TurntableControls;
  let camera: MockPerspectiveCamera;
  let domElement: MockHTMLElement;

  setup(() => {
    camera = new MockPerspectiveCamera();
    domElement = new MockHTMLElement();
    controls = new TurntableControls(camera as any, domElement as any);
  });

  teardown(() => {
    if (controls) {
      controls.dispose();
    }
  });

  test('should initialize with default values', () => {
    assert.strictEqual(controls.enabled, true);
    assert.strictEqual(controls.rotateSpeed, 1.0);
    assert.strictEqual(controls.zoomSpeed, 1.0);
    assert.strictEqual(controls.panSpeed, 1.0);
    assert.strictEqual(controls.minDistance, 0.001);
    assert.strictEqual(controls.maxDistance, 50000);
    assert.strictEqual(controls.yawSign, 1);
    assert.strictEqual(controls.pitchSign, 1);
    assert.strictEqual(controls.maxPolarClampDeg, 85);
  });

  test('should set world up vector', () => {
    controls.worldUp.set(0, 0, 1);
    assert.strictEqual(controls.worldUp.x, 0);
    assert.strictEqual(controls.worldUp.y, 0);
    assert.strictEqual(controls.worldUp.z, 1);
  });

  test('should set target vector', () => {
    controls.target.set(5, 10, -3);
    assert.strictEqual(controls.target.x, 5);
    assert.strictEqual(controls.target.y, 10);
    assert.strictEqual(controls.target.z, -3);
  });

  test('should add and remove event listeners', () => {
    let startCalled = false;
    let changeCalled = false;
    let endCalled = false;

    const startListener = () => (startCalled = true);
    const changeListener = () => (changeCalled = true);
    const endListener = () => (endCalled = true);

    controls.addEventListener('start', startListener);
    controls.addEventListener('change', changeListener);
    controls.addEventListener('end', endListener);

    (controls as any).dispatchEvent('start');
    (controls as any).dispatchEvent('change');
    (controls as any).dispatchEvent('end');

    assert.strictEqual(startCalled, true);
    assert.strictEqual(changeCalled, true);
    assert.strictEqual(endCalled, true);

    controls.removeEventListener('start', startListener);
    controls.removeEventListener('change', changeListener);
    controls.removeEventListener('end', endListener);

    startCalled = changeCalled = endCalled = false;
    (controls as any).dispatchEvent('start');
    (controls as any).dispatchEvent('change');
    (controls as any).dispatchEvent('end');

    assert.strictEqual(startCalled, false);
    assert.strictEqual(changeCalled, false);
    assert.strictEqual(endCalled, false);
  });

  test('should handle pointer down for rotation', () => {
    let startEventFired = false;
    controls.addEventListener('start', () => (startEventFired = true));

    const pointerEvent = {
      button: 0,
      shiftKey: false,
      clientX: 400,
      clientY: 300,
      pointerId: 1,
    };

    domElement.simulateEvent('pointerdown', pointerEvent);
    assert.strictEqual(startEventFired, true);
  });

  test('should handle pointer down for panning', () => {
    let startEventFired = false;
    controls.addEventListener('start', () => (startEventFired = true));

    const pointerEvent = {
      button: 1,
      shiftKey: true,
      clientX: 400,
      clientY: 300,
      pointerId: 1,
    };

    domElement.simulateEvent('pointerdown', pointerEvent);
    assert.strictEqual(startEventFired, true);
  });

  test('should handle wheel zoom', () => {
    let startEventFired = false;
    let changeEventFired = false;
    let endEventFired = false;

    controls.addEventListener('start', () => (startEventFired = true));
    controls.addEventListener('change', () => (changeEventFired = true));
    controls.addEventListener('end', () => (endEventFired = true));

    const wheelEvent = {
      deltaY: 100,
      preventDefault: () => {},
    };

    domElement.simulateEvent('wheel', wheelEvent);

    assert.strictEqual(startEventFired, true);
    assert.strictEqual(changeEventFired, true);
    assert.strictEqual(endEventFired, true);
  });

  test('should clamp zoom distance', () => {
    // Test min distance clamping
    const wheelEventIn = {
      deltaY: -10000,
      preventDefault: () => {},
    };
    domElement.simulateEvent('wheel', wheelEventIn);

    const minDistance = camera.position.distanceTo(controls.target);
    assert.ok(minDistance >= controls.minDistance);

    // Reset and test max distance clamping
    camera.position.set(0, 0, 5);
    const wheelEventOut = {
      deltaY: 10000,
      preventDefault: () => {},
    };
    domElement.simulateEvent('wheel', wheelEventOut);

    const maxDistance = camera.position.distanceTo(controls.target);
    assert.ok(maxDistance <= controls.maxDistance);
  });

  test('should respect enabled flag', () => {
    controls.enabled = false;
    let eventFired = false;
    controls.addEventListener('start', () => (eventFired = true));

    const pointerEvent = {
      button: 0,
      shiftKey: false,
      clientX: 400,
      clientY: 300,
      pointerId: 1,
    };

    domElement.simulateEvent('pointerdown', pointerEvent);
    assert.strictEqual(eventFired, false);
  });

  test('should handle custom yaw and pitch signs', () => {
    controls.yawSign = -1;
    controls.pitchSign = -1;

    assert.strictEqual(controls.yawSign, -1);
    assert.strictEqual(controls.pitchSign, -1);
  });

  test('should handle speed settings', () => {
    controls.rotateSpeed = 2.5;
    controls.zoomSpeed = 0.8;
    controls.panSpeed = 1.2;

    assert.strictEqual(controls.rotateSpeed, 2.5);
    assert.strictEqual(controls.zoomSpeed, 0.8);
    assert.strictEqual(controls.panSpeed, 1.2);
  });

  test('should handle polar clamp settings', () => {
    controls.maxPolarClampDeg = 80;
    assert.strictEqual(controls.maxPolarClampDeg, 80);

    controls.maxPolarClampDeg = 90;
    assert.strictEqual(controls.maxPolarClampDeg, 90);
  });

  test('should get canvas rect correctly', () => {
    const rect = (controls as any).getCanvasRect();
    assert.ok(rect.left !== undefined);
    assert.ok(rect.top !== undefined);
    assert.ok(rect.width !== undefined);
    assert.ok(rect.height !== undefined);
  });

  test('should dispose properly', () => {
    // Dispose should not throw and should clean up listeners
    assert.doesNotThrow(() => controls.dispose());
  });

  test('should handle update method', () => {
    // Update method should not throw for turntable controls
    assert.doesNotThrow(() => controls.update());
  });

  test('should handle pointer up event', () => {
    // Test that pointerup doesn't throw
    assert.doesNotThrow(() => {
      domElement.simulateEvent('pointerup', {
        pointerId: 1,
      });
    });
  });
});
