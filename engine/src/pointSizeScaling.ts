import * as THREE from 'three';

export interface PointSizeScalingHost {
  screenSpaceScaling: boolean;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  meshes: (THREE.Mesh | THREE.Points | THREE.LineSegments | null)[];
  pointSizes: number[];
  vertexPointsObjects: (THREE.Points | null)[];
  multiMaterialGroups: (THREE.Group | null)[];
  requestRender(): void;
  showStatus(message: string): void;
}

export function toggleScreenSpaceScaling(host: PointSizeScalingHost): void {
  host.screenSpaceScaling = !host.screenSpaceScaling;
  console.log(`Screen-space scaling ${host.screenSpaceScaling ? 'enabled' : 'disabled'}`);

  // Update UI button state
  const button = document.getElementById('toggle-screenspace-scaling');
  if (button) {
    button.classList.toggle('active', host.screenSpaceScaling);
  }

  // Update all point sizes immediately
  updateAllPointSizesForDistance(host);

  // Show status message
  host.showStatus(
    `Screen-space scaling ${host.screenSpaceScaling ? 'enabled' : 'disabled'}: ${host.screenSpaceScaling ? 'Point sizes adjust with camera distance' : 'Fixed point sizes restored'}`
  );

  host.requestRender();
}

export function updateAllPointSizesForDistance(host: PointSizeScalingHost): void {
  if (!host.screenSpaceScaling) {
    // Restore original point sizes
    restoreOriginalPointSizes(host);
    return;
  }

  // Calculate camera distance to scene center
  const sceneCenter = new THREE.Vector3();
  const box = new THREE.Box3();

  // Calculate overall scene bounding box
  host.scene.traverse(object => {
    if (object instanceof THREE.Points || object instanceof THREE.Mesh) {
      const geometry = object.geometry;
      if (geometry) {
        geometry.computeBoundingBox();
        if (geometry.boundingBox) {
          const transformedBox = geometry.boundingBox.clone().applyMatrix4(object.matrixWorld);
          box.union(transformedBox);
        }
      }
    }
  });

  if (!box.isEmpty()) {
    box.getCenter(sceneCenter);
  }

  const cameraDistance = host.camera.position.distanceTo(sceneCenter);

  // Apply distance-based scaling to all point materials
  host.meshes.forEach((mesh, index) => {
    if (mesh instanceof THREE.Points && mesh.material instanceof THREE.PointsMaterial) {
      const material = mesh.material as THREE.PointsMaterial;
      const baseSize = host.pointSizes[index] || 1.0;
      material.size = calculateScreenSpacePointSize(baseSize, cameraDistance);
      material.needsUpdate = true;
    }
  });

  // Update vertex points objects
  host.vertexPointsObjects.forEach((vertexPoints, index) => {
    if (vertexPoints && vertexPoints.material instanceof THREE.PointsMaterial) {
      const material = vertexPoints.material as THREE.PointsMaterial;
      const baseSize = host.pointSizes[index] || 1.0;
      material.size = calculateScreenSpacePointSize(baseSize, cameraDistance);
      material.needsUpdate = true;
    }
  });

  // Update multi-material groups
  host.multiMaterialGroups.forEach((group, index) => {
    if (group) {
      group.traverse(child => {
        if (child instanceof THREE.Points && child.material instanceof THREE.PointsMaterial) {
          const material = child.material as THREE.PointsMaterial;
          const baseSize = host.pointSizes[index] || 0.001;
          material.size = calculateScreenSpacePointSize(baseSize, cameraDistance);
          material.needsUpdate = true;
        }
      });
    }
  });
}

export function calculateScreenSpacePointSize(baseSize: number, cameraDistance: number): number {
  // Scale point size inversely with distance, with reasonable limits
  const minSize = baseSize * 0.1; // Don't go below 10% of original
  const maxSize = baseSize * 3.0; // Don't go above 300% of original
  const scaledSize = baseSize * (20 / Math.max(1, cameraDistance));
  return Math.max(minSize, Math.min(maxSize, scaledSize));
}

export function restoreOriginalPointSizes(host: PointSizeScalingHost): void {
  // Restore original point sizes from stored values
  host.meshes.forEach((mesh, index) => {
    if (mesh instanceof THREE.Points && mesh.material instanceof THREE.PointsMaterial) {
      const material = mesh.material as THREE.PointsMaterial;
      material.size = host.pointSizes[index] || 1.0;
      material.needsUpdate = true;
    }
  });

  host.vertexPointsObjects.forEach((vertexPoints, index) => {
    if (vertexPoints && vertexPoints.material instanceof THREE.PointsMaterial) {
      const material = vertexPoints.material as THREE.PointsMaterial;
      material.size = host.pointSizes[index] || 1.0;
      material.needsUpdate = true;
    }
  });

  host.multiMaterialGroups.forEach((group, index) => {
    if (group) {
      group.traverse(child => {
        if (child instanceof THREE.Points && child.material instanceof THREE.PointsMaterial) {
          const material = child.material as THREE.PointsMaterial;
          material.size = host.pointSizes[index] || 0.001;
          material.needsUpdate = true;
        }
      });
    }
  });
}
