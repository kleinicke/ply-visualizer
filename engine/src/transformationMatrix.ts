import * as THREE from 'three';
import { SpatialData } from './interfaces';
import { createTranslationMatrix } from './utils/matrix';
import { viewerState } from './state/viewer.svelte';

export interface TransformationMatrixHost {
  camera: THREE.PerspectiveCamera;
  cameraMatrix: THREE.Matrix4;
  controls: { target: THREE.Vector3 };
  transformationMatrices: THREE.Matrix4[];
  meshes: (THREE.Mesh | THREE.Points | THREE.LineSegments | null)[];
  vertexPointsObjects: (THREE.Points | null)[];
  normalsVisualizers: (THREE.LineSegments | null)[];
  multiMaterialGroups: (THREE.Group | null)[];
  spatialFiles: SpatialData[];
  poseGroups: THREE.Group[];
  cameraGroups: THREE.Group[];
  pointSizes: number[];
  applyCameraScale(cameraProfileIndex: number, scale: number): void;
}

export function updateCameraMatrix(host: TransformationMatrixHost): void {
  // Create a matrix that represents the camera's current position and rotation
  host.cameraMatrix.identity();

  // Apply camera position
  const positionMatrix = new THREE.Matrix4();
  positionMatrix.makeTranslation(
    -host.camera.position.x,
    -host.camera.position.y,
    -host.camera.position.z
  );

  // Apply camera rotation (inverse of camera quaternion)
  const rotationMatrix = new THREE.Matrix4();
  rotationMatrix.makeRotationFromQuaternion(host.camera.quaternion.clone().invert());

  // Combine position and rotation
  host.cameraMatrix.multiply(rotationMatrix).multiply(positionMatrix);
}

export function setTransformationMatrix(
  host: TransformationMatrixHost,
  fileIndex: number,
  matrix: THREE.Matrix4
): void {
  if (fileIndex >= 0 && fileIndex < host.transformationMatrices.length) {
    host.transformationMatrices[fileIndex].copy(matrix);
    applyTransformationMatrix(host, fileIndex);
  }
}

export function getTransformationMatrix(
  host: TransformationMatrixHost,
  fileIndex: number
): THREE.Matrix4 {
  if (fileIndex >= 0 && fileIndex < host.transformationMatrices.length) {
    return host.transformationMatrices[fileIndex].clone();
  }
  return new THREE.Matrix4(); // Return identity matrix if index is invalid
}

export function getTransformationMatrixAsArray(
  host: TransformationMatrixHost,
  fileIndex: number
): number[] {
  if (fileIndex >= 0 && fileIndex < host.transformationMatrices.length) {
    return host.transformationMatrices[fileIndex].elements.slice();
  }
  return new THREE.Matrix4().elements.slice(); // Return identity matrix if index is invalid
}

export function applyTransformationMatrix(host: TransformationMatrixHost, fileIndex: number): void {
  if (fileIndex < 0 || fileIndex >= host.transformationMatrices.length) {
    return;
  }

  const matrix = host.transformationMatrices[fileIndex];

  // Handle PLY/mesh files
  if (fileIndex < host.meshes.length) {
    const mesh = host.meshes[fileIndex];
    if (mesh) {
      mesh.matrix.copy(matrix);
      mesh.matrixAutoUpdate = false;
    }

    // Also apply transformation to vertex points visualization
    const vertexPoints = host.vertexPointsObjects[fileIndex];
    if (vertexPoints) {
      vertexPoints.matrix.copy(matrix);
      vertexPoints.matrixAutoUpdate = false;
    }

    // Also apply transformation to normals visualizer
    const normalsVisualizer = host.normalsVisualizers[fileIndex];
    if (normalsVisualizer) {
      normalsVisualizer.matrix.copy(matrix);
      normalsVisualizer.matrixAutoUpdate = false;
    }

    // Also apply transformation to multi-material groups (for OBJ files)
    const multiMaterialGroup = host.multiMaterialGroups[fileIndex];
    if (multiMaterialGroup) {
      multiMaterialGroup.matrix.copy(matrix);
      multiMaterialGroup.matrixAutoUpdate = false;
    }

    return;
  }

  // Handle poses
  const poseIndex = fileIndex - host.spatialFiles.length;
  if (poseIndex >= 0 && poseIndex < host.poseGroups.length) {
    const group = host.poseGroups[poseIndex];
    if (group) {
      group.matrix.copy(matrix);
      group.matrixAutoUpdate = false;
    }
    return;
  }

  // Handle cameras
  const cameraIndex = fileIndex - host.spatialFiles.length - host.poseGroups.length;
  if (cameraIndex >= 0 && cameraIndex < host.cameraGroups.length) {
    const group = host.cameraGroups[cameraIndex];
    if (group) {
      // Apply transformation matrix to camera profile group
      group.matrix.copy(matrix);
      group.matrixAutoUpdate = false;

      // Apply scaling only to visual elements, not position
      const size = host.pointSizes[fileIndex] ?? 1.0;
      host.applyCameraScale(cameraIndex, size);
    }
  }
}

export function resetTransformationMatrix(host: TransformationMatrixHost, fileIndex: number): void {
  if (fileIndex >= 0 && fileIndex < host.transformationMatrices.length) {
    host.transformationMatrices[fileIndex].identity();
    applyTransformationMatrix(host, fileIndex);
  }
}

export function multiplyTransformationMatrices(
  host: TransformationMatrixHost,
  fileIndex: number,
  matrix: THREE.Matrix4
): void {
  if (fileIndex >= 0 && fileIndex < host.transformationMatrices.length) {
    host.transformationMatrices[fileIndex].multiply(matrix);
    applyTransformationMatrix(host, fileIndex);
  }
}

export function addTranslationToMatrix(
  host: TransformationMatrixHost,
  fileIndex: number,
  x: number,
  y: number,
  z: number
): void {
  if (fileIndex >= 0 && fileIndex < host.transformationMatrices.length) {
    const translationMatrix = createTranslationMatrix(x, y, z);
    multiplyTransformationMatrices(host, fileIndex, translationMatrix);
  }
}

export function updateMatrixTextarea(host: TransformationMatrixHost, fileIndex: number): void {
  const textarea = document.getElementById(`matrix-${fileIndex}`) as HTMLTextAreaElement;
  if (textarea) {
    const matrixArr = getTransformationMatrixAsArray(host, fileIndex);
    let matrixStr = '';
    // Three.js stores matrices in column-major order: [m00, m10, m20, m30, m01, m11, m21, m31, m02, m12, m22, m32, m03, m13, m23, m33]
    // Display in row-major order to match the input format: each row should be [m0r, m1r, m2r, m3r]
    for (let row = 0; row < 4; ++row) {
      const displayRow = [
        matrixArr[row], // m0r (column r, row 0)
        matrixArr[row + 4], // m1r (column r, row 1)
        matrixArr[row + 8], // m2r (column r, row 2)
        matrixArr[row + 12], // m3r (column r, row 3)
      ].map(v => {
        // Format numbers consistently: 6 decimal places, no padding
        return v.toFixed(6);
      });
      matrixStr += displayRow.join(' ') + '\n';
    }
    textarea.value = matrixStr.trim();
  }
}

export function updateCameraMatrixDisplay(_host: TransformationMatrixHost): void {
  // Camera matrix is now displayed in the camera controls panel
  // This method is kept for compatibility but doesn't display anything
}

export function updateCameraControlsPanel(host: TransformationMatrixHost): void {
  // Phase 4 (docs/SVELTE_MIGRATION_PLAN.md): CameraControlsPanel.svelte reads
  // these reactively instead of this function building/patching innerHTML.
  const pos = host.camera.position;

  const euler = new THREE.Euler();
  euler.setFromQuaternion(host.camera.quaternion, 'XYZ');
  const rotX = (euler.x * 180) / Math.PI;
  const rotY = (euler.y * 180) / Math.PI;
  const rotZ = (euler.z * 180) / Math.PI;

  const target = host.controls.target;

  viewerState.cameraFov = host.camera.fov;
  viewerState.cameraPositionText = `(${pos.x.toFixed(3)}, ${pos.y.toFixed(3)}, ${pos.z.toFixed(3)})`;
  viewerState.cameraRotationText = `(${rotX.toFixed(1)}°, ${rotY.toFixed(1)}°, ${rotZ.toFixed(1)}°)`;
  viewerState.cameraTargetText = `(${target.x.toFixed(3)}, ${target.y.toFixed(3)}, ${target.z.toFixed(3)})`;
}
