import * as THREE from 'three';
import {
  createAngleAxisMatrix,
  createQuaternionMatrix,
  parseSpaceSeparatedValues,
} from './utils/matrix';
import {
  angleAxisDialogTemplate,
  cameraPositionDialogTemplate,
  cameraRotationDialogTemplate,
  createModalDialog,
  quaternionDialogTemplate,
  rotationCenterDialogTemplate,
  translationDialogTemplate,
} from './ui/dialogs';

export interface TransformDialogsHost {
  camera: THREE.PerspectiveCamera;
  controls: { target: THREE.Vector3; update(): void };
  addTranslationToMatrix(fileIndex: number, x: number, y: number, z: number): void;
  multiplyTransformationMatrices(fileIndex: number, matrix: THREE.Matrix4): void;
  updateMatrixTextarea(fileIndex: number): void;
  updateCameraControlsPanel(): void;
  updateRotationOriginButtonState(): void;
}

export function showTranslationDialog(host: TransformDialogsHost, fileIndex: number): void {
  const { dialog, close } = createModalDialog(translationDialogTemplate());

  const cancelBtn = dialog.querySelector('#cancel-translation');
  const applyBtn = dialog.querySelector('#apply-translation');

  if (cancelBtn) {
    cancelBtn.addEventListener('click', close);
  }

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const input = (dialog.querySelector('#translation-input') as HTMLTextAreaElement).value;
      const values = parseSpaceSeparatedValues(input);

      if (values.length === 3) {
        const [x, y, z] = values;
        host.addTranslationToMatrix(fileIndex, x, y, z);
        host.updateMatrixTextarea(fileIndex);
        close();
      } else {
        alert('Please enter exactly 3 numbers for translation (X Y Z)');
      }
    });
  }
}

export function showQuaternionDialog(host: TransformDialogsHost, fileIndex: number): void {
  const { dialog, close } = createModalDialog(quaternionDialogTemplate());

  const cancelBtn = dialog.querySelector('#cancel-quaternion');
  const applyBtn = dialog.querySelector('#apply-quaternion');

  if (cancelBtn) {
    cancelBtn.addEventListener('click', close);
  }

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const input = (dialog.querySelector('#quaternion-input') as HTMLTextAreaElement).value;
      const values = parseSpaceSeparatedValues(input);

      if (values.length === 4) {
        const [x, y, z, w] = values;
        const quaternionMatrix = createQuaternionMatrix(x, y, z, w);
        host.multiplyTransformationMatrices(fileIndex, quaternionMatrix);
        host.updateMatrixTextarea(fileIndex);
        close();
      } else {
        alert('Please enter exactly 4 numbers for the quaternion (X Y Z W)');
      }
    });
  }
}

export function showAngleAxisDialog(host: TransformDialogsHost, fileIndex: number): void {
  const { dialog, close } = createModalDialog(angleAxisDialogTemplate());

  const cancelBtn = dialog.querySelector('#cancel-angle-axis');
  const applyBtn = dialog.querySelector('#apply-angle-axis');

  if (cancelBtn) {
    cancelBtn.addEventListener('click', close);
  }

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const input = (dialog.querySelector('#angle-axis-input') as HTMLTextAreaElement).value;
      const values = parseSpaceSeparatedValues(input);

      if (values.length === 4) {
        const [axisX, axisY, axisZ, angleDegrees] = values;
        const axis = new THREE.Vector3(axisX, axisY, axisZ);
        const angle = (angleDegrees * Math.PI) / 180; // Convert to radians
        const angleAxisMatrix = createAngleAxisMatrix(axis, angle);
        host.multiplyTransformationMatrices(fileIndex, angleAxisMatrix);
        host.updateMatrixTextarea(fileIndex);
        close();
      } else {
        alert('Please enter exactly 4 numbers for axis and angle (X Y Z angle in degrees)');
      }
    });
  }
}

export function showCameraPositionDialog(host: TransformDialogsHost): void {
  const currentPos = host.camera.position;
  const { dialog, close } = createModalDialog(
    cameraPositionDialogTemplate(
      currentPos.x.toFixed(3),
      currentPos.y.toFixed(3),
      currentPos.z.toFixed(3)
    )
  );

  const cancelBtn = dialog.querySelector('#cancel-camera-pos');
  const applyBtn = dialog.querySelector('#apply-camera-pos');
  const setAllZeroBtn = dialog.querySelector('#set-all-pos-zero');

  if (cancelBtn) {
    cancelBtn.addEventListener('click', close);
  }

  if (setAllZeroBtn) {
    setAllZeroBtn.addEventListener('click', () => {
      (dialog.querySelector('#camera-position-input') as HTMLTextAreaElement).value = '0 0 0';
    });
  }

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const input = (dialog.querySelector('#camera-position-input') as HTMLTextAreaElement).value;
      const constraint = (
        dialog.querySelector('input[name="position-constraint"]:checked') as HTMLInputElement
      ).value;
      const values = parseSpaceSeparatedValues(input);

      if (values.length === 3) {
        const [x, y, z] = values;

        // Store current camera state
        const currentQuaternion = host.camera.quaternion.clone();
        const currentTarget = host.controls.target.clone();

        // Update position
        host.camera.position.set(x, y, z);

        // Apply constraint logic
        if (constraint === 'rotation') {
          // Keep rotation (angle) - restore quaternion
          host.camera.quaternion.copy(currentQuaternion);

          // Update target based on new position and preserved rotation
          const direction = new THREE.Vector3(0, 0, -1);
          direction.applyQuaternion(currentQuaternion);
          host.controls.target.copy(host.camera.position.clone().add(direction));
        } else {
          // Keep rotation center (target) - restore target (default behavior)
          host.controls.target.copy(currentTarget);

          // Adjust camera rotation to look at the preserved target
          host.camera.lookAt(currentTarget);
        }

        host.controls.update();
        host.updateCameraControlsPanel();
        close();
      } else {
        alert('Please enter exactly 3 numbers for position (X Y Z)');
      }
    });
  }
}

export function showCameraRotationDialog(host: TransformDialogsHost): void {
  // Get rotation from quaternion to handle all camera operations consistently
  const euler = new THREE.Euler();
  euler.setFromQuaternion(host.camera.quaternion, 'XYZ');
  const rotX = (euler.x * 180) / Math.PI;
  const rotY = (euler.y * 180) / Math.PI;
  const rotZ = (euler.z * 180) / Math.PI;

  const { dialog, close } = createModalDialog(
    cameraRotationDialogTemplate(rotX.toFixed(1), rotY.toFixed(1), rotZ.toFixed(1))
  );

  const cancelBtn = dialog.querySelector('#cancel-camera-rot');
  const applyBtn = dialog.querySelector('#apply-camera-rot');
  const setAllZeroBtn = dialog.querySelector('#set-all-rot-zero');

  if (cancelBtn) {
    cancelBtn.addEventListener('click', close);
  }

  if (setAllZeroBtn) {
    setAllZeroBtn.addEventListener('click', () => {
      (dialog.querySelector('#camera-rotation-input') as HTMLTextAreaElement).value = '0 0 0';
    });
  }

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const input = (dialog.querySelector('#camera-rotation-input') as HTMLTextAreaElement).value;
      const constraint = (
        dialog.querySelector('input[name="rotation-constraint"]:checked') as HTMLInputElement
      ).value;
      const values = parseSpaceSeparatedValues(input);

      if (values.length === 3) {
        const [x, y, z] = values;

        // Store current camera state
        const currentPosition = host.camera.position.clone();
        const currentTarget = host.controls.target.clone();

        // Create quaternion from Euler angles
        const rotationEuler = new THREE.Euler(
          (x * Math.PI) / 180,
          (y * Math.PI) / 180,
          (z * Math.PI) / 180,
          'XYZ'
        );
        const quaternion = new THREE.Quaternion();
        quaternion.setFromEuler(rotationEuler);

        // Apply constraint logic
        if (constraint === 'position') {
          // Keep position - restore position and apply rotation directly
          host.camera.position.copy(currentPosition);
          host.camera.quaternion.copy(quaternion);

          // Update target based on new rotation and preserved position
          const direction = new THREE.Vector3(0, 0, -1);
          direction.applyQuaternion(quaternion);
          host.controls.target.copy(host.camera.position.clone().add(direction));
        } else {
          // Keep rotation center - restore target and adjust position (default behavior)
          const distance = currentPosition.distanceTo(currentTarget);
          host.controls.target.copy(currentTarget);

          // Position camera relative to preserved target
          const direction = new THREE.Vector3(0, 0, distance);
          direction.applyQuaternion(quaternion);
          host.camera.position.copy(currentTarget).add(direction);

          // Set up vector and look at target
          const up = new THREE.Vector3(0, 1, 0);
          up.applyQuaternion(quaternion);
          host.camera.up.copy(up);
          host.camera.lookAt(currentTarget);
        }

        host.controls.update();
        host.updateCameraControlsPanel();
        close();
      } else {
        alert('Please enter exactly 3 numbers for rotation (X Y Z degrees)');
      }
    });
  }
}

export function showRotationCenterDialog(host: TransformDialogsHost): void {
  // Get current rotation center (controls target)
  const target = host.controls.target;
  const { dialog, close } = createModalDialog(
    rotationCenterDialogTemplate(target.x.toFixed(3), target.y.toFixed(3), target.z.toFixed(3))
  );

  // Event listeners
  const setOriginBtn = dialog.querySelector('#set-center-origin');
  const cancelBtn = dialog.querySelector('#cancel-rotation-center');
  const applyBtn = dialog.querySelector('#apply-rotation-center');

  if (setOriginBtn) {
    setOriginBtn.addEventListener('click', () => {
      (dialog.querySelector('#rotation-center-input') as HTMLTextAreaElement).value = '0 0 0';
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', close);
  }

  if (applyBtn) {
    applyBtn.addEventListener('click', () => {
      const input = (dialog.querySelector('#rotation-center-input') as HTMLTextAreaElement).value;
      const constraint = (
        dialog.querySelector('input[name="center-constraint"]:checked') as HTMLInputElement
      ).value;
      const values = parseSpaceSeparatedValues(input);

      if (values.length === 3) {
        const [x, y, z] = values;

        // Store current camera state
        const currentPosition = host.camera.position.clone();
        const currentQuaternion = host.camera.quaternion.clone();
        const currentTarget = host.controls.target.clone();

        // Set the new rotation center
        host.controls.target.set(x, y, z);

        // Apply constraint logic
        if (constraint === 'rotation') {
          // Keep rotation - restore quaternion and adjust position to maintain distance from new center
          const distance = currentPosition.distanceTo(currentTarget);
          host.camera.quaternion.copy(currentQuaternion);

          // Position camera at distance from new center in same direction as rotation
          const direction = new THREE.Vector3(0, 0, distance);
          direction.applyQuaternion(currentQuaternion);
          host.camera.position.copy(host.controls.target).add(direction);
        } else {
          // Keep position - restore position and adjust rotation to look at new center (default behavior)
          host.camera.position.copy(currentPosition);
          host.camera.lookAt(host.controls.target);
        }

        // Update controls and camera panel
        host.controls.update();
        host.updateCameraControlsPanel();

        // Update axes position to show new rotation center
        if ((host as any).axesHelper) {
          (host as any).axesHelper.position.copy(host.controls.target);
        }

        console.log(
          `🎯 Rotation center set to: (${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)})`
        );
        host.updateRotationOriginButtonState();
        close();
      } else {
        alert('Please enter exactly 3 numbers for center (X Y Z)');
      }
    });
  }
}
