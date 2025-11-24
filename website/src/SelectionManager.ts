import * as THREE from 'three';

/**
 * Result from a selection operation with logging information
 */
export interface SelectionResult {
  point: THREE.Vector3;
  info: string;
}

/**
 * Context interface providing access to scene state needed for selection
 */
export interface SelectionContext {
  camera: THREE.PerspectiveCamera;
  meshes: THREE.Object3D[];
  spatialFiles: any[];
  poseGroups: THREE.Group[];
  cameraGroups: THREE.Group[];
  fileVisibility: boolean[];
  pointSizes: number[];
  screenSpaceScaling: boolean;
}

/**
 * Manages point selection and raycasting for 3D objects in the scene
 * Handles selection for cameras, poses, triangle meshes, and point clouds
 */
export class SelectionManager {
  private context: SelectionContext;

  constructor(context: SelectionContext) {
    this.context = context;
  }

  /**
   * Update the context reference (useful when context changes)
   */
  updateContext(context: SelectionContext): void {
    this.context = context;
  }

  /**
   * Select a point from any visible object at the given screen coordinates
   * Tries selection in priority order: camera profiles, poses, triangle meshes, point clouds
   *
   * @returns Selected point or null if nothing was clicked
   */
  selectPoint(
    mouseScreenX: number,
    mouseScreenY: number,
    canvas: HTMLCanvasElement
  ): THREE.Vector3 | null {
    // 1. Check camera profiles first (highest priority for precision)
    let selectedPoint = this.selectCameraProfile(mouseScreenX, mouseScreenY, canvas);
    if (selectedPoint) {
      return selectedPoint;
    }

    // 2. Check pose data (body poses/keypoints)
    selectedPoint = this.selectPoseKeypoint(mouseScreenX, mouseScreenY, canvas);
    if (selectedPoint) {
      return selectedPoint;
    }

    // 3. Check triangle meshes with raycasting (more precise for surfaces)
    selectedPoint = this.selectTriangleMesh(mouseScreenX, mouseScreenY, canvas);
    if (selectedPoint) {
      return selectedPoint;
    }

    // 4. Check point clouds with size-aware selection
    selectedPoint = this.selectPointCloud(mouseScreenX, mouseScreenY, canvas);
    if (selectedPoint) {
      return selectedPoint;
    }

    return null;
  }

  /**
   * Select a point with detailed logging information
   */
  selectPointWithLogging(
    mouseScreenX: number,
    mouseScreenY: number,
    canvas: HTMLCanvasElement
  ): SelectionResult | null {
    // 1. Check camera profiles first
    let selectedPoint = this.selectCameraProfile(mouseScreenX, mouseScreenY, canvas);
    if (selectedPoint) {
      const distance = this.context.camera.position.distanceTo(selectedPoint);
      return {
        point: selectedPoint,
        info: `camera profile at distance ${distance.toFixed(4)}m`,
      };
    }

    // 2. Check pose data
    selectedPoint = this.selectPoseKeypoint(mouseScreenX, mouseScreenY, canvas);
    if (selectedPoint) {
      const distance = this.context.camera.position.distanceTo(selectedPoint);
      return {
        point: selectedPoint,
        info: `pose keypoint at distance ${distance.toFixed(4)}m`,
      };
    }

    // 3. Check triangle meshes
    selectedPoint = this.selectTriangleMesh(mouseScreenX, mouseScreenY, canvas);
    if (selectedPoint) {
      const distance = this.context.camera.position.distanceTo(selectedPoint);
      return {
        point: selectedPoint,
        info: `triangle mesh surface at distance ${distance.toFixed(4)}m`,
      };
    }

    // 4. Check point clouds with detailed logging
    const pointResult = this.selectPointCloudWithLogging(mouseScreenX, mouseScreenY, canvas);
    if (pointResult) {
      return pointResult;
    }

    return null;
  }

  /**
   * Select a camera profile at the given screen coordinates
   * Returns the closest camera origin if multiple cameras are selectable
   */
  private selectCameraProfile(
    mouseScreenX: number,
    mouseScreenY: number,
    canvas: HTMLCanvasElement
  ): THREE.Vector3 | null {
    const cameraStartIndex = this.context.spatialFiles.length + this.context.poseGroups.length;

    let closestCamera: THREE.Vector3 | null = null;
    let closestDistance = Infinity;
    let camerasChecked = 0;
    let camerasHit = 0;

    for (let i = 0; i < this.context.cameraGroups.length; i++) {
      const unifiedIndex = cameraStartIndex + i;
      if (!this.context.fileVisibility[unifiedIndex]) {
        continue;
      }

      const cameraGroup = this.context.cameraGroups[i];
      const cameraScale = this.context.pointSizes[unifiedIndex] || 1.0;

      // Check each camera in the profile
      for (const cameraChild of cameraGroup.children) {
        if (cameraChild instanceof THREE.Group && cameraChild.name.startsWith('camera_')) {
          camerasChecked++;
          const selectedPoint = this.selectCameraObject(
            cameraChild,
            mouseScreenX,
            mouseScreenY,
            canvas,
            cameraScale
          );
          if (selectedPoint) {
            camerasHit++;
            // Calculate distance from viewer camera to this camera
            const distance = this.context.camera.position.distanceTo(selectedPoint);
            if (distance < closestDistance) {
              closestDistance = distance;
              closestCamera = selectedPoint;
            }
          }
        }
      }
    }
    console.log(
      `📷 Camera profile check: ${camerasChecked} cameras checked, ${camerasHit} cameras hit`
    );
    return closestCamera;
  }

  /**
   * Select a specific camera object
   * Returns the camera's origin position (0,0,0 in its local coordinate system)
   * Uses screen-space proximity check (like pose keypoint selection) for accurate detection
   */
  private selectCameraObject(
    cameraGroup: THREE.Group,
    mouseScreenX: number,
    mouseScreenY: number,
    canvas: HTMLCanvasElement,
    scale: number
  ): THREE.Vector3 | null {
    // Get the camera's origin position (0,0,0 in world space)
    const cameraPosition = new THREE.Vector3();
    cameraPosition.setFromMatrixPosition(cameraGroup.matrixWorld);

    // Project camera position to screen space
    const screenPosition = cameraPosition.clone().project(this.context.camera);
    const screenX = (screenPosition.x * 0.5 + 0.5) * canvas.clientWidth;
    const screenY = (screenPosition.y * -0.5 + 0.5) * canvas.clientHeight;

    // Calculate selection radius based on camera scale (same approach as pose keypoints)
    // This ensures the selection area scales with the camera visualization
    const selectionRadius = Math.max(15, Math.min(60, scale * 20));

    // Calculate pixel distance from click to camera center
    const pixelDistance = Math.sqrt(
      Math.pow(screenX - mouseScreenX, 2) + Math.pow(screenY - mouseScreenY, 2)
    );

    // Only select if click is within selection radius
    if (pixelDistance <= selectionRadius) {
      const distance = this.context.camera.position.distanceTo(cameraPosition);
      if (distance >= 0.0001) {
        console.log(
          `🎯 Selected camera ${cameraGroup.name} (pixel distance: ${pixelDistance.toFixed(1)}px)`
        );
        return cameraPosition;
      }
    } else {
      console.log(
        `✗ Camera ${cameraGroup.name} too far (pixel distance: ${pixelDistance.toFixed(1)}px, radius: ${selectionRadius}px)`
      );
    }

    return null;
  }

  /**
   * Select a pose keypoint at the given screen coordinates
   */
  private selectPoseKeypoint(
    mouseScreenX: number,
    mouseScreenY: number,
    canvas: HTMLCanvasElement
  ): THREE.Vector3 | null {
    for (let i = 0; i < this.context.poseGroups.length; i++) {
      const unifiedIndex = this.context.spatialFiles.length + i;
      if (!this.context.fileVisibility[unifiedIndex]) {
        continue;
      }

      const poseGroup = this.context.poseGroups[i];
      const poseScale = this.context.pointSizes[unifiedIndex] || 1.0;

      // Check keypoint spheres and connection lines
      const selectedPoint = this.selectPoseObject(
        poseGroup,
        mouseScreenX,
        mouseScreenY,
        canvas,
        poseScale
      );
      if (selectedPoint) {
        return selectedPoint;
      }
    }
    return null;
  }

  /**
   * Select a specific pose object (keypoint or connection)
   */
  private selectPoseObject(
    poseGroup: THREE.Group,
    mouseScreenX: number,
    mouseScreenY: number,
    canvas: HTMLCanvasElement,
    scale: number
  ): THREE.Vector3 | null {
    const mouse = new THREE.Vector2();
    mouse.x = (mouseScreenX / canvas.clientWidth) * 2 - 1;
    mouse.y = -(mouseScreenY / canvas.clientHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.context.camera);

    // First try raycasting for precise intersection
    const intersects = raycaster.intersectObject(poseGroup, true);
    if (intersects.length > 0) {
      const intersectionPoint = intersects[0].point;
      const distance = this.context.camera.position.distanceTo(intersectionPoint);
      if (distance >= 0.0001) {
        return intersectionPoint;
      }
    }

    // Fallback: check proximity to keypoint positions
    let closestKeypointPosition: THREE.Vector3 | null = null;
    let closestDistance = Infinity;

    poseGroup.traverse(child => {
      if (child instanceof THREE.Mesh && child.geometry instanceof THREE.SphereGeometry) {
        const keypointPosition = new THREE.Vector3();
        keypointPosition.setFromMatrixPosition(child.matrixWorld);

        const screenPosition = keypointPosition.clone().project(this.context.camera);
        const screenX = (screenPosition.x * 0.5 + 0.5) * canvas.clientWidth;
        const screenY = (screenPosition.y * -0.5 + 0.5) * canvas.clientHeight;

        // Use pose scale to determine selection radius
        const selectionRadius = Math.max(8, Math.min(30, scale * 10));
        const pixelDistance = Math.sqrt(
          Math.pow(screenX - mouseScreenX, 2) + Math.pow(screenY - mouseScreenY, 2)
        );

        if (pixelDistance <= selectionRadius) {
          const distance = this.context.camera.position.distanceTo(keypointPosition);
          if (distance >= 0.0001 && pixelDistance < closestDistance) {
            closestDistance = pixelDistance;
            closestKeypointPosition = keypointPosition;
          }
        }
      }
    });

    return closestKeypointPosition;
  }

  /**
   * Select a triangle mesh surface at the given screen coordinates
   */
  private selectTriangleMesh(
    mouseScreenX: number,
    mouseScreenY: number,
    canvas: HTMLCanvasElement
  ): THREE.Vector3 | null {
    // Find all visible triangle meshes
    const visibleMeshes = this.context.meshes.filter(
      (mesh, index) => this.context.fileVisibility[index]
    );
    const triangleMeshes = visibleMeshes.filter(mesh => {
      const geometry = (mesh as THREE.Mesh).geometry;
      if (!geometry) {
        return false;
      }
      const indexAttribute = geometry.getIndex();
      // Triangle meshes have indices (faces), point clouds typically don't
      return indexAttribute && indexAttribute.count > 0;
    });

    if (triangleMeshes.length === 0) {
      return null;
    }

    const mouse = new THREE.Vector2();
    mouse.x = (mouseScreenX / canvas.clientWidth) * 2 - 1;
    mouse.y = -(mouseScreenY / canvas.clientHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.context.camera);

    const intersects = raycaster.intersectObjects(triangleMeshes, false);

    if (intersects.length > 0) {
      // Found mesh surface intersection - use the exact intersection point on the surface
      const intersectionPoint = intersects[0].point;

      // Check if the point is too close to the camera
      const distance = this.context.camera.position.distanceTo(intersectionPoint);
      const minDistance = 0.0001;

      if (distance >= minDistance) {
        return intersectionPoint;
      }
    }

    return null;
  }

  /**
   * Select a point from point clouds
   */
  private selectPointCloud(
    mouseScreenX: number,
    mouseScreenY: number,
    canvas: HTMLCanvasElement
  ): THREE.Vector3 | null {
    const pointCloudMeshes = this.getVisiblePointClouds();

    if (pointCloudMeshes.length === 0) {
      return null;
    }

    // Use efficient raycast with dynamic radius calculation
    return this.efficientRaycastPointSelection(
      mouseScreenX,
      mouseScreenY,
      canvas,
      pointCloudMeshes
    );
  }

  /**
   * Select a point from point clouds with detailed logging
   */
  private selectPointCloudWithLogging(
    mouseScreenX: number,
    mouseScreenY: number,
    canvas: HTMLCanvasElement
  ): SelectionResult | null {
    const pointCloudMeshes = this.getVisiblePointClouds();

    if (pointCloudMeshes.length === 0) {
      return null;
    }

    // Use efficient raycast with detailed logging
    return this.efficientRaycastPointSelectionWithLogging(
      mouseScreenX,
      mouseScreenY,
      canvas,
      pointCloudMeshes
    );
  }

  /**
   * Get all visible point cloud meshes
   */
  private getVisiblePointClouds(): THREE.Points[] {
    const visibleMeshes = this.context.meshes.filter(
      (mesh, index) => this.context.fileVisibility[index]
    );
    const pointCloudMeshes = visibleMeshes.filter(mesh => {
      // Only target THREE.Points instances with PointsMaterial and no index buffer
      if (!(mesh instanceof THREE.Points)) {
        return false;
      }
      if (!(mesh.material instanceof THREE.PointsMaterial)) {
        return false;
      }

      const geometry = mesh.geometry;
      const indexAttribute = geometry.getIndex();
      return !indexAttribute || indexAttribute.count === 0;
    });

    return pointCloudMeshes as THREE.Points[];
  }

  /**
   * Compute the rendered point size on screen
   */
  private computeRenderedPointSize(
    material: THREE.PointsMaterial,
    distance: number,
    canvas: HTMLCanvasElement
  ): number {
    let renderedSize = material.size;

    if (material.sizeAttenuation) {
      if (this.context.screenSpaceScaling) {
        // Material size is already modified by screen-space scaling
        renderedSize = material.size;
      } else {
        // Standard Three.js size attenuation formula
        const scale = canvas.clientHeight * 0.5;
        renderedSize = (material.size * scale) / Math.max(distance, 0.001);
      }
    }

    return renderedSize;
  }

  /**
   * Compute the selection pixel radius for a rendered point
   */
  private computeSelectionPixelRadius(
    renderedSize: number,
    distance: number,
    clamp: boolean = true
  ): number {
    // Base padding and extra padding for large points
    const basePadding = 3;
    const extraPadding = Math.min(20, renderedSize * 0.2);

    let pixelRadius = renderedSize * 0.5 + basePadding + extraPadding;

    // For very close points, be more generous
    if (distance < 0.01) {
      pixelRadius = Math.max(pixelRadius, renderedSize * 0.75);
    }

    // Optional clamping to prevent excessive selection areas
    if (clamp) {
      pixelRadius = Math.min(150, pixelRadius);
    }

    return pixelRadius;
  }

  /**
   * Convert pixels to world units based on camera projection
   */
  private convertPixelsToWorldUnits(
    pixelRadius: number,
    distance: number,
    canvas: HTMLCanvasElement
  ): number {
    const fov = this.context.camera.fov;
    const halfHeight = Math.tan((fov * Math.PI) / 360) * distance;
    const pixelsPerWorldUnit = canvas.clientHeight / (2 * halfHeight);
    return pixelRadius / pixelsPerWorldUnit;
  }

  /**
   * Efficient raycast-based point selection
   */
  private efficientRaycastPointSelection(
    mouseScreenX: number,
    mouseScreenY: number,
    canvas: HTMLCanvasElement,
    pointCloudMeshes: THREE.Points[]
  ): THREE.Vector3 | null {
    const mouse = new THREE.Vector2();
    mouse.x = (mouseScreenX / canvas.clientWidth) * 2 - 1;
    mouse.y = -(mouseScreenY / canvas.clientHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.context.camera);

    const pixelBuffer = 4; // 4 pixel buffer around point

    let closestPoint: THREE.Vector3 | null = null;
    let closestDistance = Infinity;

    for (const mesh of pointCloudMeshes) {
      const material = mesh.material as THREE.PointsMaterial;
      const geometry = mesh.geometry;
      const positionAttribute = geometry.getAttribute('position');

      if (!positionAttribute) {
        continue;
      }

      // Calculate an approximate distance to this mesh for initial radius estimation
      geometry.computeBoundingSphere();
      const meshCenter = new THREE.Vector3();
      if (geometry.boundingSphere) {
        meshCenter.copy(geometry.boundingSphere.center).applyMatrix4(mesh.matrixWorld);
      }

      const approxDistance = this.context.camera.position.distanceTo(meshCenter);

      // Calculate dynamic radius
      const renderedPointSize = this.computeRenderedPointSize(material, approxDistance, canvas);
      const pointSizeInWorld = this.convertPixelsToWorldUnits(
        renderedPointSize * 0.5,
        approxDistance,
        canvas
      );
      const pixelBufferInWorld = this.convertPixelsToWorldUnits(
        pixelBuffer,
        approxDistance,
        canvas
      );

      const dynamicThreshold = pointSizeInWorld + pixelBufferInWorld;
      raycaster.params.Points!.threshold = dynamicThreshold;

      // Perform raycast
      const intersects = raycaster.intersectObject(mesh, false);

      for (const intersection of intersects) {
        if (intersection.index !== undefined) {
          const worldPoint = new THREE.Vector3();
          worldPoint.fromBufferAttribute(positionAttribute, intersection.index);
          worldPoint.applyMatrix4(mesh.matrixWorld);

          const actualDistance = this.context.camera.position.distanceTo(worldPoint);

          // Recalculate threshold for this specific point's distance
          const actualRenderedSize = this.computeRenderedPointSize(
            material,
            actualDistance,
            canvas
          );
          const actualPointSizeInWorld = this.convertPixelsToWorldUnits(
            actualRenderedSize * 0.5,
            actualDistance,
            canvas
          );
          const actualPixelBufferInWorld = this.convertPixelsToWorldUnits(
            pixelBuffer,
            actualDistance,
            canvas
          );
          const actualThreshold = actualPointSizeInWorld + actualPixelBufferInWorld;

          // Verify intersection is within refined threshold
          const rayToPoint = worldPoint.clone().sub(raycaster.ray.origin);
          const rayDirection = raycaster.ray.direction.clone().normalize();
          const projectedDistance = rayToPoint.dot(rayDirection);
          const rayPoint = raycaster.ray.origin
            .clone()
            .add(rayDirection.multiplyScalar(projectedDistance));
          const perpendicularDistance = worldPoint.distanceTo(rayPoint);

          if (perpendicularDistance <= actualThreshold) {
            // Safety checks
            if (actualDistance >= 0.0001) {
              const cameraToPoint = worldPoint.clone().sub(this.context.camera.position);
              const dotProduct = cameraToPoint.dot(
                this.context.camera.getWorldDirection(new THREE.Vector3())
              );
              if (dotProduct > 0.0001) {
                // Pick the closest to camera (front-most)
                if (actualDistance < closestDistance) {
                  closestDistance = actualDistance;
                  closestPoint = worldPoint;
                }
              }
            }
          }
        }
      }
    }

    // Final safety check
    if (closestPoint) {
      const distance = this.context.camera.position.distanceTo(closestPoint);
      if (distance < 0.0001) {
        const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(
          this.context.camera.quaternion
        );
        closestPoint = this.context.camera.position
          .clone()
          .add(cameraDirection.multiplyScalar(0.0001));
      }
    }

    return closestPoint;
  }

  /**
   * Efficient raycast-based point selection with detailed logging
   */
  private efficientRaycastPointSelectionWithLogging(
    mouseScreenX: number,
    mouseScreenY: number,
    canvas: HTMLCanvasElement,
    pointCloudMeshes: THREE.Points[]
  ): SelectionResult | null {
    const mouse = new THREE.Vector2();
    mouse.x = (mouseScreenX / canvas.clientWidth) * 2 - 1;
    mouse.y = -(mouseScreenY / canvas.clientHeight) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, this.context.camera);

    const pixelBuffer = 4;

    let closestPoint: THREE.Vector3 | null = null;
    let closestDistance = Infinity;
    let bestSelectionInfo = '';

    for (const mesh of pointCloudMeshes) {
      const material = mesh.material as THREE.PointsMaterial;
      const geometry = mesh.geometry;
      const positionAttribute = geometry.getAttribute('position');

      if (!positionAttribute) {
        continue;
      }

      const fileIndex = this.context.meshes.indexOf(mesh);

      geometry.computeBoundingSphere();
      const meshCenter = new THREE.Vector3();
      if (geometry.boundingSphere) {
        meshCenter.copy(geometry.boundingSphere.center).applyMatrix4(mesh.matrixWorld);
      }

      const approxDistance = this.context.camera.position.distanceTo(meshCenter);

      const renderedPointSize = this.computeRenderedPointSize(material, approxDistance, canvas);
      const pointSizeInWorld = this.convertPixelsToWorldUnits(
        renderedPointSize * 0.5,
        approxDistance,
        canvas
      );
      const pixelBufferInWorld = this.convertPixelsToWorldUnits(
        pixelBuffer,
        approxDistance,
        canvas
      );

      const dynamicThreshold = pointSizeInWorld + pixelBufferInWorld;
      raycaster.params.Points!.threshold = dynamicThreshold;

      const intersects = raycaster.intersectObject(mesh, false);

      for (const intersection of intersects) {
        if (intersection.index !== undefined) {
          const worldPoint = new THREE.Vector3();
          worldPoint.fromBufferAttribute(positionAttribute, intersection.index);
          worldPoint.applyMatrix4(mesh.matrixWorld);

          const actualDistance = this.context.camera.position.distanceTo(worldPoint);

          const actualRenderedSize = this.computeRenderedPointSize(
            material,
            actualDistance,
            canvas
          );
          const actualPointSizeInWorld = this.convertPixelsToWorldUnits(
            actualRenderedSize * 0.5,
            actualDistance,
            canvas
          );
          const actualPixelBufferInWorld = this.convertPixelsToWorldUnits(
            pixelBuffer,
            actualDistance,
            canvas
          );
          const actualThreshold = actualPointSizeInWorld + actualPixelBufferInWorld;

          const rayToPoint = worldPoint.clone().sub(raycaster.ray.origin);
          const rayDirection = raycaster.ray.direction.clone().normalize();
          const projectedDistance = rayToPoint.dot(rayDirection);
          const rayPoint = raycaster.ray.origin
            .clone()
            .add(rayDirection.multiplyScalar(projectedDistance));
          const perpendicularDistance = worldPoint.distanceTo(rayPoint);

          if (perpendicularDistance <= actualThreshold) {
            if (actualDistance >= 0.0001) {
              const cameraToPoint = worldPoint.clone().sub(this.context.camera.position);
              const dotProduct = cameraToPoint.dot(
                this.context.camera.getWorldDirection(new THREE.Vector3())
              );
              if (dotProduct > 0.0001) {
                if (actualDistance < closestDistance) {
                  closestDistance = actualDistance;
                  closestPoint = worldPoint;

                  bestSelectionInfo =
                    `efficient raycast: point #${intersection.index} in mesh ${fileIndex}, distance=${actualDistance.toFixed(4)}m, ` +
                    `materialSize=${material.size.toFixed(1)}px, renderedSize=${actualRenderedSize.toFixed(1)}px, ` +
                    `pointSizeWorld=${actualPointSizeInWorld.toFixed(6)}m, pixelBuffer=${pixelBuffer}px, ` +
                    `bufferWorld=${actualPixelBufferInWorld.toFixed(6)}m, threshold=${actualThreshold.toFixed(6)}m, ` +
                    `perpDist=${perpendicularDistance.toFixed(6)}m, sizeAttenuation=${material.sizeAttenuation}`;
                }
              }
            }
          }
        }
      }
    }

    if (closestPoint) {
      const distance = this.context.camera.position.distanceTo(closestPoint);
      if (distance < 0.0001) {
        const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(
          this.context.camera.quaternion
        );
        closestPoint = this.context.camera.position
          .clone()
          .add(cameraDirection.multiplyScalar(0.0001));
        bestSelectionInfo += `, adjusted for min distance`;
      }

      return { point: closestPoint, info: bestSelectionInfo };
    }

    return null;
  }
}
