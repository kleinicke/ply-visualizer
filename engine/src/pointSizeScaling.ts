import * as THREE from 'three';
import { SpatialData } from './interfaces';

export interface PointSizeScalingHost {
  screenSpaceScaling: boolean;
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  meshes: (THREE.Mesh | THREE.Points | THREE.LineSegments | null)[];
  pointSizes: number[];
  vertexPointsObjects: (THREE.Points | null)[];
  multiMaterialGroups: (THREE.Group | null)[];
  spatialFiles: SpatialData[];
  poseGroups: THREE.Group[];
  materialMeshes: (THREE.Object3D[] | null)[];
  requestRender(): void;
  showStatus(message: string): void;
  applyTransformationMatrix(fileIndex: number): void;
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

export function updatePointSize(
  host: PointSizeScalingHost,
  fileIndex: number,
  newSize: number
): void {
  if (fileIndex >= 0 && fileIndex < host.pointSizes.length) {
    const oldSize = host.pointSizes[fileIndex];
    console.log(`🎚️ Updating point size for file ${fileIndex}: ${oldSize} → ${newSize}`);
    host.pointSizes[fileIndex] = newSize;

    const isPose =
      fileIndex >= host.spatialFiles.length &&
      fileIndex < host.spatialFiles.length + host.poseGroups.length;
    const isCamera = fileIndex >= host.spatialFiles.length + host.poseGroups.length;
    const data = !isPose && !isCamera ? host.spatialFiles[fileIndex] : (undefined as any);
    const isObjFile = data ? (data as any).isObjFile : false;

    if (isCamera) {
      // Handle camera scaling by applying transformation matrix with scale
      host.applyTransformationMatrix(fileIndex);
    } else if (isPose) {
      // Update instanced sphere scale in pose group if stored using PointsMaterial size semantics is different.
      const poseIndex = fileIndex - host.spatialFiles.length;
      const group = host.poseGroups[poseIndex];
      if (group) {
        group.traverse(obj => {
          if ((obj as any).isInstancedMesh && obj instanceof THREE.InstancedMesh) {
            // Rebuild or update instance matrices scaling
            const count = obj.count;
            const dummy = new THREE.Object3D();
            for (let i = 0; i < count; i++) {
              obj.getMatrixAt(i, dummy.matrix);
              // Reset scale part and apply uniform scale by newSize
              dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);
              dummy.scale.setScalar(newSize);
              dummy.updateMatrix();
              obj.setMatrixAt(i, dummy.matrix);
            }
            obj.instanceMatrix.needsUpdate = true;
          }
        });
      }
    } else if (isObjFile) {
      // Handle OBJ files - update both points and lines in multi-material groups
      const multiMaterialGroup = host.multiMaterialGroups[fileIndex];
      const subMeshes = host.materialMeshes[fileIndex];

      if (multiMaterialGroup && subMeshes) {
        // Update all sub-meshes in multi-material OBJ
        let pointsUpdated = 0;

        for (const subMesh of subMeshes) {
          if ((subMesh as any).isPoints && subMesh instanceof THREE.Points) {
            // Update point size
            const material = (subMesh as any).material;
            if (material instanceof THREE.PointsMaterial) {
              material.size = newSize; // Use direct size for OBJ points
              pointsUpdated++;
            }
          }
          // Line width is now controlled separately by updateLineWidth method
        }

        console.log(`✅ Updated ${pointsUpdated} point materials for OBJ file ${fileIndex}`);
      } else {
        // Single OBJ mesh
        const mesh = host.meshes[fileIndex];
        if (mesh instanceof THREE.Points && mesh.material instanceof THREE.PointsMaterial) {
          mesh.material.size = newSize; // Use direct size for OBJ points
          console.log(`✅ Point size applied to single OBJ mesh for file ${fileIndex}: ${newSize}`);
        }
      }
    } else {
      // Handle regular point clouds and mesh files (PLY, STL, etc.)
      const mesh = host.meshes[fileIndex];
      const data = host.spatialFiles[fileIndex];

      if (mesh instanceof THREE.Points && mesh.material instanceof THREE.PointsMaterial) {
        // Point cloud files
        mesh.material.size = newSize;
        console.log(`✅ Point size applied to point cloud for file ${fileIndex}: ${newSize}`);
      } else if (mesh instanceof THREE.Mesh && data && data.faceCount > 0) {
        // Triangle mesh files (STL, PLY with faces) - create a point representation
        // Check if we already have a points overlay for this mesh
        let pointsOverlay = (mesh as any).__pointsOverlay;

        if (!pointsOverlay && mesh.geometry) {
          // Create a points overlay using the same geometry
          const pointsMaterial = new THREE.PointsMaterial({
            color: 0xffffff,
            size: newSize,
            sizeAttenuation: true,
            // Restore original quality settings
            transparent: true,
            alphaTest: 0.1,
            depthWrite: true,
            depthTest: true,
          });
          pointsOverlay = new THREE.Points(mesh.geometry, pointsMaterial);
          pointsOverlay.visible = false; // Hidden by default
          (mesh as any).__pointsOverlay = pointsOverlay;
          mesh.add(pointsOverlay);
        }

        if (pointsOverlay && pointsOverlay.material instanceof THREE.PointsMaterial) {
          pointsOverlay.material.size = newSize;
          // For meshes, we'll show the points overlay when point size is adjusted
          pointsOverlay.visible = newSize > 0.5; // Show points when size is meaningful
          console.log(`✅ Point size applied to mesh overlay for file ${fileIndex}: ${newSize}`);
        }
      } else {
        console.warn(
          `⚠️ Could not apply point size for file ${fileIndex}: unsupported mesh type\nMesh type: ${mesh?.constructor.name}, Material type: ${mesh?.material?.constructor.name}`
        );
      }
    }

    // Always update vertex points object if it exists (used by render modes for ALL file types)
    const vertexPointsObject = host.vertexPointsObjects[fileIndex];
    if (vertexPointsObject && vertexPointsObject.material instanceof THREE.PointsMaterial) {
      vertexPointsObject.material.size = newSize;
      console.log(`✅ Point size applied to vertex points for file ${fileIndex}: ${newSize}`);
    }
  } else {
    console.error(
      `❌ Invalid fileIndex ${fileIndex} for pointSizes array of length ${host.pointSizes.length}`
    );
  }
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
