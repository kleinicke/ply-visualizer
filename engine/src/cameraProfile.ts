import * as THREE from 'three';
import {
  createFrustumObjects,
  frustumDepthForExtent,
  FrustumIntrinsics,
} from './visualization/cameraFrustum';
import { parseCameraRig, RigCamera } from './formats/cameraRig';
import { FileEntryRegistry } from './state/fileEntries';
import { registerCameraEntry } from './state/fileEntryState';

export interface CameraProfileHost {
  scene: THREE.Scene;
  cameraGroups: readonly THREE.Group[];
  cameraNames: readonly string[];
  cameraVisibility: boolean;
  cameraShowLabels: readonly boolean[];
  cameraShowCoords: readonly boolean[];
  spatialFiles: { length: number };
  poseGroups: { length: number };
  updateFileList(): void;
  updateFileStats(): void;
  autoFitCameraOnFirstLoad(): void;
  applyTransformationMatrix(fileIndex: number): void;
  showError(message: string): void;
  fileEntries: FileEntryRegistry;
}

/** The `cameras.<name>.local_extrinsics` profile this viewer has always read. */
function isLegacyProfile(data: any): boolean {
  return (
    !!data &&
    !!data.cameras &&
    typeof data.cameras === 'object' &&
    !Array.isArray(data.cameras) &&
    Object.values(data.cameras).some((camera: any) => camera?.local_extrinsics)
  );
}

/**
 * Whether a JSON document holds cameras (a legacy profile or any rig layout
 * `formats/cameraRig.ts` recognises) rather than a skeletal pose.
 */
export function isCameraProfileData(data: any): boolean {
  return isLegacyProfile(data) || parseCameraRig(data) !== null;
}

export function handleCameraProfile(host: CameraProfileHost, data: any, fileName: string): void {
  if (!isLegacyProfile(data)) {
    handleCameraRig(host, data, fileName);
    return;
  }
  try {
    const cameras = data.cameras;
    const cameraNames = Object.keys(cameras);

    console.log(`Loading camera profile with ${cameraNames.length} cameras:`, cameraNames);

    // Create a single group to contain all cameras
    const cameraProfileGroup = new THREE.Group();
    cameraProfileGroup.name = `camera_profile_${fileName}`;

    // Frustum size comes from how far apart the cameras are, so a profile in
    // millimetres and one in metres both read sensibly. A fixed size only ever
    // suited one of them.
    const locations: number[][] = cameraNames
      .map(name => cameras[name]?.local_extrinsics?.params?.location)
      .filter((location: unknown): location is number[] => Array.isArray(location));
    const frustumDepth = frustumDepthForExtent(spreadOf(locations));

    let cameraCount = 0;
    for (const cameraName of cameraNames) {
      const camera = cameras[cameraName];
      if (camera.local_extrinsics && camera.local_extrinsics.params) {
        const params = camera.local_extrinsics.params;
        if (params.location && params.rotation_quaternion) {
          const cameraViz = createCameraVisualization(
            cameraName,
            params.location,
            params.rotation_quaternion,
            camera.local_extrinsics.type,
            frustumDepth
          );
          cameraProfileGroup.add(cameraViz);
          cameraCount++;
        }
      }
    }

    if (cameraCount > 0) {
      host.scene.add(cameraProfileGroup);

      const unifiedIndex = registerCameraEntry(host, cameraProfileGroup, fileName);
      host.applyTransformationMatrix(unifiedIndex);
    }

    // Update UI
    host.updateFileList();
    host.updateFileStats();
    host.autoFitCameraOnFirstLoad();

    // Hide loading overlay
    document.getElementById('loading')?.classList.add('hidden');

    console.log(`Successfully loaded camera profile with ${cameraCount} cameras from ${fileName}`);
  } catch (err) {
    host.showError(
      'Camera profile parse error: ' + (err instanceof Error ? err.message : String(err))
    );
  }
}

function handleCameraRig(host: CameraProfileHost, data: any, fileName: string): void {
  try {
    const cameras = parseCameraRig(data);
    if (!cameras) {
      host.showError(`No cameras found in ${fileName}`);
      return;
    }
    const group = new THREE.Group();
    group.name = `camera_profile_${fileName}`;
    const frustumDepth = frustumDepthForExtent(spreadOf(cameras.map(camera => camera.position)));
    for (const camera of cameras) {
      group.add(createRigCameraVisualization(camera, frustumDepth));
    }
    host.scene.add(group);
    const unifiedIndex = registerCameraEntry(host, group, fileName);
    host.applyTransformationMatrix(unifiedIndex);

    host.updateFileList();
    host.updateFileStats();
    host.autoFitCameraOnFirstLoad();
    document.getElementById('loading')?.classList.add('hidden');
    console.log(`Loaded ${cameras.length} rig cameras (${cameras[0].convention}) from ${fileName}`);
  } catch (err) {
    host.showError('Camera rig parse error: ' + (err instanceof Error ? err.message : String(err)));
  }
}

function createRigCameraVisualization(camera: RigCamera, frustumDepth: number): THREE.Group {
  const r = camera.rotation;
  const quaternion = new THREE.Quaternion().setFromRotationMatrix(
    new THREE.Matrix4().set(
      r[0],
      r[1],
      r[2],
      0,
      r[3],
      r[4],
      r[5],
      0,
      r[6],
      r[7],
      r[8],
      0,
      0,
      0,
      0,
      1
    )
  );
  const group = buildCameraGroup(
    camera.name,
    camera.position,
    quaternion,
    frustumDepth,
    camera.intrinsics
  );
  const details = group.userData.frameDetails as Array<{ label: string; value: string }>;
  details.push({ label: 'Convention', value: camera.convention });
  if (camera.intrinsics) {
    const { fx, fy, cx, cy, imageWidth, imageHeight } = camera.intrinsics;
    details.push({
      label: 'Intrinsics',
      value: `${imageWidth}×${imageHeight}, fx ${fx.toFixed(1)}, fy ${fy.toFixed(1)}, cx ${cx.toFixed(1)}, cy ${cy.toFixed(1)}`,
    });
  }
  return group;
}

/**
 * Diagonal of the box containing every point, for scaling decisions. Returns 0
 * for a single point, which frustumDepthForExtent turns into its own default.
 */
export function spreadOf(points: number[][]): number {
  if (points.length < 2) {
    return 0;
  }
  const box = new THREE.Box3();
  for (const point of points) {
    box.expandByPoint(new THREE.Vector3(point[0], point[1], point[2]));
  }
  return box.getSize(new THREE.Vector3()).length();
}

export function createCameraVisualization(
  cameraName: string,
  location: number[],
  rotationQuaternion: number[],
  rotationType?: string,
  frustumDepth = 0.05
): THREE.Group {
  // Set camera rotation from quaternion. Respect type if provided.
  // blender_quaternion is typically [w, x, y, z]
  let qx = rotationQuaternion[0];
  let qy = rotationQuaternion[1];
  let qz = rotationQuaternion[2];
  let qw = rotationQuaternion[3];
  if (rotationType && rotationType.toLowerCase().includes('blender')) {
    qw = rotationQuaternion[0];
    qx = rotationQuaternion[1];
    qy = rotationQuaternion[2];
    qz = rotationQuaternion[3];
  }
  const quaternion = new THREE.Quaternion(qx, qy, qz, qw).normalize();
  const group = buildCameraGroup(cameraName, location, quaternion, frustumDepth);
  if (rotationType) {
    group.userData.frameDetails.push({ label: 'Convention', value: rotationType });
  }
  return group;
}

function buildCameraGroup(
  cameraName: string,
  location: number[],
  quaternion: THREE.Quaternion,
  frustumDepth: number,
  intrinsics?: FrustumIntrinsics
): THREE.Group {
  const group = new THREE.Group();
  group.name = `camera_${cameraName}`;
  group.position.set(location[0], location[1], location[2]);
  group.setRotationFromQuaternion(quaternion);

  // A wireframe frustum, the same shape X3A, E57 and COLMAP draw. Without
  // intrinsics (legacy JSON profiles carry only a pose) it uses the generic
  // fallback field of view rather than claiming one the file never gave.
  for (const object of createFrustumObjects({ depth: frustumDepth, intrinsics })) {
    group.add(object);
  }

  // Create text label
  const textLabel = createCameraLabel(cameraName);
  textLabel.name = 'cameraLabel';
  textLabel.visible = false; // Hide labels by default
  group.add(textLabel);

  // Store original position for coordinate label
  (group as any).originalPosition = { x: location[0], y: location[1], z: location[2] };

  // Rows for the per-camera panel list. The group carries a real rotation and
  // the frustum is built looking along local +Z, so no explicit look-through
  // view is needed.
  group.userData.frameDetails = [
    {
      label: 'Rotation',
      value: `x ${quaternion.x.toFixed(5)}, y ${quaternion.y.toFixed(5)}, z ${quaternion.z.toFixed(5)}, w ${quaternion.w.toFixed(5)}`,
    },
  ];

  return group;
}

export function createCameraLabel(cameraName: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;

  // Use higher resolution for crisp text
  const pixelRatio = 3; // 3x resolution for sharp text
  const baseFontSize = 28;
  const fontSize = baseFontSize * pixelRatio;

  // Set font first to measure text accurately
  context.font = `Bold ${fontSize}px Arial`;
  const textMetrics = context.measureText(cameraName);

  // Make canvas size fit the text with padding (high resolution)
  const padding = 20 * pixelRatio;
  canvas.width = Math.max(textMetrics.width + padding * 2, 200 * pixelRatio);
  canvas.height = 48 * pixelRatio;

  // Set font again after canvas resize and configure for high quality
  context.font = `Bold ${fontSize}px Arial`;
  context.fillStyle = 'white';
  context.strokeStyle = 'black';
  context.lineWidth = 3 * pixelRatio;
  context.textAlign = 'center';
  context.textBaseline = 'middle';

  // Enable anti-aliasing for smooth text
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = 'high';

  // Clear background
  context.clearRect(0, 0, canvas.width, canvas.height);

  // Draw text with outline (centered)
  const x = canvas.width / 2;
  const y = canvas.height / 2;

  context.strokeText(cameraName, x, y);
  context.fillText(cameraName, x, y);

  // Create sprite from high-resolution canvas
  const texture = new THREE.CanvasTexture(canvas);
  texture.generateMipmaps = true;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;

  const material = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(material);

  // Position label above camera (closer)
  sprite.position.set(0, 0.04, 0);

  // Scale proportionally to canvas aspect ratio, accounting for pixel ratio
  const aspectRatio = canvas.width / canvas.height;
  // Label height is a fixed fraction of a metre; applyCameraScale rescales it
  // with the rest of the frame.
  const baseScaleY = 0.03;
  const baseScaleX = baseScaleY * aspectRatio;
  sprite.scale.set(baseScaleX, baseScaleY, 1);
  // Preserve original scale for proper proportional scaling later
  (sprite as any).userData = (sprite as any).userData || {};
  (sprite as any).userData.baseScale = { x: baseScaleX, y: baseScaleY };

  return sprite;
}

export function toggleCameraVisibility(host: CameraProfileHost): void {
  host.cameraVisibility = !host.cameraVisibility;
  host.cameraGroups.forEach(group => {
    group.visible = host.cameraVisibility;
  });
}

export function updateCameraButtonState(host: CameraProfileHost): void {
  const toggleBtn = document.getElementById('toggle-cameras');
  if (!toggleBtn) {
    return;
  }

  if (host.cameraVisibility) {
    toggleBtn.classList.add('active');
    toggleBtn.innerHTML = 'Show Cameras';
  } else {
    toggleBtn.classList.remove('active');
    toggleBtn.innerHTML = 'Show Cameras';
  }
}

export function toggleCameraProfileLabels(
  host: CameraProfileHost,
  cameraProfileIndex: number,
  showLabels: boolean
): void {
  if (cameraProfileIndex < 0 || cameraProfileIndex >= host.cameraGroups.length) {
    return;
  }

  const profileGroup = host.cameraGroups[cameraProfileIndex];
  // Iterate through all cameras in the profile
  profileGroup.children.forEach(child => {
    if (child instanceof THREE.Group && child.name.startsWith('camera_')) {
      const label = child.getObjectByName('cameraLabel');
      if (label) {
        label.visible = showLabels;
      }
    }
  });

  // Update state array
  host.fileEntries.camera(cameraProfileIndex).showLabels = showLabels;
}

export function toggleCameraProfileCoordinates(
  host: CameraProfileHost,
  cameraProfileIndex: number,
  showCoords: boolean
): void {
  if (cameraProfileIndex < 0 || cameraProfileIndex >= host.cameraGroups.length) {
    return;
  }

  const profileGroup = host.cameraGroups[cameraProfileIndex];
  // Iterate through all cameras in the profile
  profileGroup.children.forEach(child => {
    if (child instanceof THREE.Group && child.name.startsWith('camera_')) {
      if (showCoords) {
        // Create or update coordinate label
        const originalPos = (child as any).originalPosition;
        if (originalPos) {
          const coordText = `(${originalPos.x.toFixed(3)}, ${originalPos.y.toFixed(3)}, ${originalPos.z.toFixed(3)})`;
          let coordLabel = child.getObjectByName('coordinateLabel') as THREE.Sprite;

          if (!coordLabel) {
            coordLabel = createCameraLabel(coordText);
            coordLabel.name = 'coordinateLabel';
            coordLabel.position.set(0, -0.03, 0); // Position below camera base
            child.add(coordLabel);
          } else {
            // Update existing label text
            const newLabel = createCameraLabel(coordText);
            coordLabel.material = newLabel.material;
          }
          coordLabel.visible = true;
        }
      } else {
        // Hide coordinate label
        const coordLabel = child.getObjectByName('coordinateLabel');
        if (coordLabel) {
          coordLabel.visible = false;
        }
      }
    }
  });

  // Update state array
  host.fileEntries.camera(cameraProfileIndex).showCoords = showCoords;
}

export function applyCameraScale(
  host: CameraProfileHost,
  cameraProfileIndex: number,
  scale: number
): void {
  if (cameraProfileIndex < 0 || cameraProfileIndex >= host.cameraGroups.length) {
    return;
  }

  const profileGroup = host.cameraGroups[cameraProfileIndex];
  // Apply scale to each individual camera's visual elements
  profileGroup.children.forEach(child => {
    if (child instanceof THREE.Group && child.name.startsWith('camera_')) {
      // Scale all visual elements including text labels
      child.children.forEach(visualElement => {
        // Reset scale to 1.0 first to prevent accumulation
        visualElement.scale.setScalar(1.0);

        if (visualElement.name === 'cameraLabel') {
          // Preserve aspect ratio and scale relative to original base scale
          const base = (visualElement as any).userData?.baseScale;
          if (base) {
            visualElement.scale.set(base.x * scale, base.y * scale, 1);
          }
          // Adjust position to scale with pyramid
          visualElement.position.set(0, 0.04 * scale, 0);
        } else if (visualElement.name === 'coordinateLabel') {
          // Preserve aspect ratio and scale relative to original base scale, but smaller than name label
          const base = (visualElement as any).userData?.baseScale;
          if (base) {
            const shrink = 0.6; // make coordinates label smaller
            visualElement.scale.set(base.x * scale * shrink, base.y * scale * shrink, 1);
          }
          // Position coordinate label slightly below base
          visualElement.position.set(0, -0.035 * scale, 0);
        } else if (visualElement.name === 'directionLine') {
          // For direction line, recreate geometry with scaled length
          const line = visualElement as THREE.Line;
          const lineLength = 0.05 * scale; // Scale the line length
          const positions = new Float32Array([
            0,
            0,
            0, // Start at camera origin (tip)
            0,
            0,
            lineLength, // Extend forward with scaled length
          ]);
          line.geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
          line.geometry.attributes.position.needsUpdate = true;
        } else {
          // Scale pyramid normally
          visualElement.scale.setScalar(scale);
        }
      });
    }
  });
}
