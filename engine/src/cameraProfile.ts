import * as THREE from 'three';

export interface CameraProfileHost {
  scene: THREE.Scene;
  cameraGroups: THREE.Group[];
  cameraNames: string[];
  cameraVisibility: boolean;
  cameraShowLabels: boolean[];
  cameraShowCoords: boolean[];
  spatialFiles: { length: number };
  poseGroups: { length: number };
  fileVisibility: boolean[];
  pointSizes: number[];
  individualColorModes: string[];
  transformationMatrices: THREE.Matrix4[];
  updateFileList(): void;
  updateFileStats(): void;
  autoFitCameraOnFirstLoad(): void;
  applyTransformationMatrix(fileIndex: number): void;
  showError(message: string): void;
}

export function handleCameraProfile(host: CameraProfileHost, data: any, fileName: string): void {
  try {
    const cameras = data.cameras;
    const cameraNames = Object.keys(cameras);

    console.log(`Loading camera profile with ${cameraNames.length} cameras:`, cameraNames);

    // Create a single group to contain all cameras
    const cameraProfileGroup = new THREE.Group();
    cameraProfileGroup.name = `camera_profile_${fileName}`;

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
            camera.local_extrinsics.type
          );
          cameraProfileGroup.add(cameraViz);
          cameraCount++;
        }
      }
    }

    if (cameraCount > 0) {
      host.scene.add(cameraProfileGroup);
      host.cameraGroups.push(cameraProfileGroup);
      host.cameraNames.push(fileName); // Store filename instead of individual camera names

      // Initialize as single file entry (like poses)
      // Use camera-specific index arrays instead of unified arrays to avoid conflicts with spatialFiles
      const cameraIndex = host.cameraGroups.length - 1;

      // Ensure visibility array has enough space
      while (
        host.fileVisibility.length <=
        host.spatialFiles.length + host.poseGroups.length + cameraIndex
      ) {
        host.fileVisibility.push(false);
      }

      const unifiedIndex = host.spatialFiles.length + host.poseGroups.length + cameraIndex;
      host.fileVisibility[unifiedIndex] = true;
      host.pointSizes[unifiedIndex] = 1.0; // Default camera scale (different from point size)
      host.individualColorModes[unifiedIndex] = 'assigned';

      // Initialize transformation matrix for camera profile
      host.transformationMatrices.push(new THREE.Matrix4());
      host.applyTransformationMatrix(unifiedIndex);

      // Initialize camera UI state arrays
      host.cameraShowLabels.push(false);
      host.cameraShowCoords.push(false);
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

export function createCameraVisualization(
  cameraName: string,
  location: number[],
  rotationQuaternion: number[],
  rotationType?: string
): THREE.Group {
  const group = new THREE.Group();
  group.name = `camera_${cameraName}`;

  // Set camera position
  const position = new THREE.Vector3(location[0], location[1], location[2]);
  group.position.copy(position);

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
  group.setRotationFromQuaternion(quaternion);

  // Create camera body (triangle shape)
  const cameraBody = createCameraBodyGeometry();
  group.add(cameraBody);

  // Create up arrow on the flat side of the pyramid
  const upArrow = createCameraUpArrow();
  group.add(upArrow);

  // Create text label
  const textLabel = createCameraLabel(cameraName);
  textLabel.name = 'cameraLabel';
  textLabel.visible = false; // Hide labels by default
  group.add(textLabel);

  // Store original position for coordinate label
  (group as any).originalPosition = { x: location[0], y: location[1], z: location[2] };

  return group;
}

export function createCameraBodyGeometry(): THREE.Mesh {
  // Create a 4-sided pyramid shape
  const size = 0.02; // 2cm base size
  const height = size * 1.5;

  const geometry = new THREE.ConeGeometry(size, height, 4); // 4 sides for square pyramid
  // Align one face flat to the axes (avoid 45° appearance) by rotating the base square
  geometry.rotateY(Math.PI / 4);
  const material = new THREE.MeshBasicMaterial({
    color: 0x4caf50, // Green color for cameras
    transparent: true,
    opacity: 0.9,
  });

  // Translate geometry so the tip (originally at +Y * height/2) sits at the local origin.
  // This ensures scaling does not move the tip from the origin.
  geometry.translate(0, -height / 2, 0);

  const mesh = new THREE.Mesh(geometry, material);
  // Orient pyramid to extend forward along +Z with tip anchored at origin
  mesh.rotation.x = -Math.PI / 2;
  // Rotate pyramid 180 degrees so flat side faces forward (camera look direction)
  mesh.rotation.z = Math.PI;

  return mesh;
}

export function createCameraUpArrow(): THREE.Group {
  // Create a red arrow on the flat side of the pyramid pointing in the camera's up direction (+Y in local camera space)
  const group = new THREE.Group();
  const arrowLength = 0.012; // 1.2cm arrow length
  const arrowColor = 0xff0000; // Red

  // Create arrow shaft (line) - starts at origin and extends upward
  const shaftGeometry = new THREE.BufferGeometry();
  const shaftPositions = new Float32Array([0, 0, 0, 0, arrowLength, 0]); // Starts at origin
  shaftGeometry.setAttribute('position', new THREE.BufferAttribute(shaftPositions, 3));

  const lineMaterial = new THREE.LineBasicMaterial({
    color: arrowColor,
    linewidth: 2,
  });

  const shaft = new THREE.Line(shaftGeometry, lineMaterial);
  group.add(shaft);

  // Create arrow head (cone)
  const headGeometry = new THREE.ConeGeometry(0.003, 0.005, 8); // Small cone for arrowhead
  const headMaterial = new THREE.MeshBasicMaterial({ color: arrowColor });

  // Position arrowhead at the tip of the shaft
  headGeometry.translate(0, arrowLength, 0);
  const arrowHead = new THREE.Mesh(headGeometry, headMaterial);
  group.add(arrowHead);

  // Arrow origin stays at (0,0,0) where the camera is located
  // The flat side of the pyramid faces forward along +Z

  group.name = 'upArrow';
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
  // Match label height roughly to the pyramid height at base scale
  const pyramidHeight = 0.03; // must stay in sync with createCameraBodyGeometry
  const baseScaleY = pyramidHeight; // label height ~= pyramid height
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
  host.cameraShowLabels[cameraProfileIndex] = showLabels;
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
  host.cameraShowCoords[cameraProfileIndex] = showCoords;
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
