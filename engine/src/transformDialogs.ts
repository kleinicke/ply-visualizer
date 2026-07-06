import * as THREE from 'three';
import { mount, unmount } from 'svelte';
import {
  createAngleAxisMatrix,
  createQuaternionMatrix,
  parseSpaceSeparatedValues,
} from './utils/matrix';
import VectorInputDialog from './components/VectorInputDialog.svelte';
import CameraVectorDialog from './components/CameraVectorDialog.svelte';

export interface TransformDialogsHost {
  camera: THREE.PerspectiveCamera;
  controls: { target: THREE.Vector3; update(): void };
  addTranslationToMatrix(fileIndex: number, x: number, y: number, z: number): void;
  multiplyTransformationMatrices(fileIndex: number, matrix: THREE.Matrix4): void;
  updateMatrixTextarea(fileIndex: number): void;
  updateCameraControlsPanel(): void;
  updateRotationOriginButtonState(): void;
}

function mountDialog<Props extends Record<string, any>>(Component: any, props: Props): () => void {
  const target = document.createElement('div');
  document.body.appendChild(target);
  const component = mount(Component, { target, props });
  return () => {
    unmount(component);
    target.remove();
  };
}

export function showTranslationDialog(host: TransformDialogsHost, fileIndex: number): void {
  const close = mountDialog(VectorInputDialog, {
    title: 'Add Translation',
    label: 'Enter translation vector (X Y Z):',
    helpLines: [
      'Format: X Y Z (space-separated)',
      'Commas, brackets, and line breaks are automatically handled',
      'Example: 1 0 0 (move 1 unit along X-axis)',
    ],
    defaultValue: '1 0 0',
    expectedCount: 3,
    errorMessage: 'Please enter exactly 3 numbers for translation (X Y Z)',
    inputId: 'translation-input',
    onApply: (values: number[]) => {
      const [x, y, z] = values;
      host.addTranslationToMatrix(fileIndex, x, y, z);
      host.updateMatrixTextarea(fileIndex);
    },
    onClose: () => close(),
  });
}

export function showQuaternionDialog(host: TransformDialogsHost, fileIndex: number): void {
  const close = mountDialog(VectorInputDialog, {
    title: 'Add Quaternion Rotation',
    label: 'Enter quaternion values (X Y Z W):',
    helpLines: [
      'Format: X Y Z W (space-separated)',
      'Commas, brackets, and line breaks are automatically handled',
      'Example: 0 0 0 1 (identity quaternion)',
    ],
    defaultValue: '0 0 0 1',
    expectedCount: 4,
    errorMessage: 'Please enter exactly 4 numbers for the quaternion (X Y Z W)',
    inputId: 'quaternion-input',
    onApply: (values: number[]) => {
      const [x, y, z, w] = values;
      const quaternionMatrix = createQuaternionMatrix(x, y, z, w);
      host.multiplyTransformationMatrices(fileIndex, quaternionMatrix);
      host.updateMatrixTextarea(fileIndex);
    },
    onClose: () => close(),
  });
}

export function showAngleAxisDialog(host: TransformDialogsHost, fileIndex: number): void {
  const close = mountDialog(VectorInputDialog, {
    title: 'Add Angle-Axis Rotation',
    label: 'Enter axis and angle (X Y Z angle):',
    helpLines: [
      'Format: X Y Z angle (space-separated, angle in degrees)',
      'Commas, brackets, and line breaks are automatically handled',
      'Example: 0 1 0 90 (90° rotation around Y-axis)',
    ],
    defaultValue: '0 1 0 90',
    expectedCount: 4,
    errorMessage: 'Please enter exactly 4 numbers for axis and angle (X Y Z angle in degrees)',
    inputId: 'angle-axis-input',
    onApply: (values: number[]) => {
      const [axisX, axisY, axisZ, angleDegrees] = values;
      const axis = new THREE.Vector3(axisX, axisY, axisZ);
      const angle = (angleDegrees * Math.PI) / 180;
      const angleAxisMatrix = createAngleAxisMatrix(axis, angle);
      host.multiplyTransformationMatrices(fileIndex, angleAxisMatrix);
      host.updateMatrixTextarea(fileIndex);
    },
    onClose: () => close(),
  });
}

export function showCameraPositionDialog(host: TransformDialogsHost): void {
  const currentPos = host.camera.position;
  const close = mountDialog(CameraVectorDialog, {
    title: 'Modify Camera Position',
    label: 'Camera Position X Y Z in Meter:',
    defaultValue: `${currentPos.x.toFixed(3)} ${currentPos.y.toFixed(3)} ${currentPos.z.toFixed(3)}`,
    inputId: 'camera-position-input',
    radioName: 'position-constraint',
    radioOptions: [
      { value: 'rotation', label: 'Rotation (angle)', checked: false },
      { value: 'center', label: 'Rotation center', checked: true },
    ],
    resetButtonLabel: 'Set All to 0',
    resetValue: '0 0 0',
    errorMessage: 'Please enter exactly 3 numbers for position (X Y Z)',
    onApply: (values: number[], constraint: string) => {
      const [x, y, z] = values;
      const currentQuaternion = host.camera.quaternion.clone();
      const currentTarget = host.controls.target.clone();

      host.camera.position.set(x, y, z);

      if (constraint === 'rotation') {
        host.camera.quaternion.copy(currentQuaternion);
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(currentQuaternion);
        host.controls.target.copy(host.camera.position.clone().add(direction));
      } else {
        host.controls.target.copy(currentTarget);
        host.camera.lookAt(currentTarget);
      }

      host.controls.update();
      host.updateCameraControlsPanel();
    },
    onClose: () => close(),
  });
}

export function showCameraRotationDialog(host: TransformDialogsHost): void {
  const euler = new THREE.Euler();
  euler.setFromQuaternion(host.camera.quaternion, 'XYZ');
  const rotX = (euler.x * 180) / Math.PI;
  const rotY = (euler.y * 180) / Math.PI;
  const rotZ = (euler.z * 180) / Math.PI;

  const close = mountDialog(CameraVectorDialog, {
    title: 'Modify Camera Rotation',
    label: 'Rotation around X Y Z Axis in degrees:',
    defaultValue: `${rotX.toFixed(1)} ${rotY.toFixed(1)} ${rotZ.toFixed(1)}`,
    inputId: 'camera-rotation-input',
    radioName: 'rotation-constraint',
    radioOptions: [
      { value: 'position', label: 'Position', checked: false },
      { value: 'center', label: 'Rotation center', checked: true },
    ],
    resetButtonLabel: 'Set All to 0',
    resetValue: '0 0 0',
    errorMessage: 'Please enter exactly 3 numbers for rotation (X Y Z degrees)',
    onApply: (values: number[], constraint: string) => {
      const [x, y, z] = values;
      const currentPosition = host.camera.position.clone();
      const currentTarget = host.controls.target.clone();

      const rotationEuler = new THREE.Euler(
        (x * Math.PI) / 180,
        (y * Math.PI) / 180,
        (z * Math.PI) / 180,
        'XYZ'
      );
      const quaternion = new THREE.Quaternion();
      quaternion.setFromEuler(rotationEuler);

      if (constraint === 'position') {
        host.camera.position.copy(currentPosition);
        host.camera.quaternion.copy(quaternion);
        const direction = new THREE.Vector3(0, 0, -1);
        direction.applyQuaternion(quaternion);
        host.controls.target.copy(host.camera.position.clone().add(direction));
      } else {
        const distance = currentPosition.distanceTo(currentTarget);
        host.controls.target.copy(currentTarget);
        const direction = new THREE.Vector3(0, 0, distance);
        direction.applyQuaternion(quaternion);
        host.camera.position.copy(currentTarget).add(direction);
        const up = new THREE.Vector3(0, 1, 0);
        up.applyQuaternion(quaternion);
        host.camera.up.copy(up);
        host.camera.lookAt(currentTarget);
      }

      host.controls.update();
      host.updateCameraControlsPanel();
    },
    onClose: () => close(),
  });
}

export function showRotationCenterDialog(host: TransformDialogsHost): void {
  const target = host.controls.target;
  const close = mountDialog(CameraVectorDialog, {
    title: 'Modify Rotation Center',
    label: 'Rotation Center X Y Z in Meter:',
    defaultValue: `${target.x.toFixed(3)} ${target.y.toFixed(3)} ${target.z.toFixed(3)}`,
    inputId: 'rotation-center-input',
    radioName: 'center-constraint',
    radioOptions: [
      { value: 'position', label: 'Position', checked: true },
      { value: 'rotation', label: 'Rotation (angle)', checked: false },
    ],
    resetButtonLabel: 'Set to Origin (0,0,0)',
    resetValue: '0 0 0',
    errorMessage: 'Please enter exactly 3 numbers for center (X Y Z)',
    onApply: (values: number[], constraint: string) => {
      const [x, y, z] = values;
      const currentPosition = host.camera.position.clone();
      const currentQuaternion = host.camera.quaternion.clone();
      const currentTarget = host.controls.target.clone();

      host.controls.target.set(x, y, z);

      if (constraint === 'rotation') {
        const distance = currentPosition.distanceTo(currentTarget);
        host.camera.quaternion.copy(currentQuaternion);
        const direction = new THREE.Vector3(0, 0, distance);
        direction.applyQuaternion(currentQuaternion);
        host.camera.position.copy(host.controls.target).add(direction);
      } else {
        host.camera.position.copy(currentPosition);
        host.camera.lookAt(host.controls.target);
      }

      host.controls.update();
      host.updateCameraControlsPanel();

      if ((host as any).axesHelper) {
        (host as any).axesHelper.position.copy(host.controls.target);
      }

      console.log(`🎯 Rotation center set to: (${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)})`);
      host.updateRotationOriginButtonState();
    },
    onClose: () => close(),
  });
}
