import * as THREE from 'three';

/**
 * Result from a selection operation with logging information
 */
export interface SelectionResult {
  point: THREE.Vector3;
  info: string;
}

/**
 * Best candidate found by the screen-space point cloud scan
 */
interface PointPickHit {
  mesh: THREE.Points;
  pointIndex: number;
  viewDepth: number;
  pixelDistance: number;
  renderedSize: number;
  pixelRadius: number;
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
    const result = this.selectPointCloudWithLogging(mouseScreenX, mouseScreenY, canvas);
    return result ? result.point : null;
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

    const hit = this.pickPointScreenSpace(mouseScreenX, mouseScreenY, canvas, pointCloudMeshes);
    return hit ? this.resolvePickHit(hit) : null;
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
   * Screen-space point cloud picking.
   *
   * Projects every point of the visible clouds to pixel coordinates and, among
   * the points whose rendered footprint (plus padding) covers the cursor,
   * returns the one closest to the camera. Unlike Raycaster-based picking, the
   * per-point cost is constant and the hot loop allocates nothing, so a
   * zoomed-out click where the whole cloud lands near the cursor costs the
   * same as a zoomed-in one.
   */
  private pickPointScreenSpace(
    mouseScreenX: number,
    mouseScreenY: number,
    canvas: HTMLCanvasElement,
    pointCloudMeshes: THREE.Points[]
  ): PointPickHit | null {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const camera = this.context.camera;
    camera.updateMatrixWorld();

    const viewProjection = new THREE.Matrix4().multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse
    );
    const mvp = new THREE.Matrix4();
    const sphereCenter = new THREE.Vector3();

    // computeSelectionPixelRadius clamps to 150px, so no point farther than
    // this from the cursor can ever be selected
    const maxPickRadius = 150;
    const maxPickRadiusSq = maxPickRadius * maxPickRadius;

    let bestMesh: THREE.Points | null = null;
    let bestIndex = -1;
    let bestDepth = Infinity;
    let bestPixelDistanceSq = Infinity;
    let bestRenderedSize = 0;
    let bestPixelRadius = 0;

    for (const mesh of pointCloudMeshes) {
      const material = mesh.material as THREE.PointsMaterial;
      const geometry = mesh.geometry;
      const positionAttribute = geometry.getAttribute('position');

      if (!positionAttribute) {
        continue;
      }

      mesh.updateMatrixWorld();

      // Skip clouds whose projected bounding sphere cannot reach the cursor
      if (!geometry.boundingSphere) {
        geometry.computeBoundingSphere();
      }
      const sphere = geometry.boundingSphere;
      if (sphere && sphere.radius > 0 && isFinite(sphere.radius)) {
        sphereCenter.copy(sphere.center).applyMatrix4(mesh.matrixWorld);
        const worldRadius = sphere.radius * mesh.matrixWorld.getMaxScaleOnAxis();
        const screenDistance = this.screenDistanceToBoundingSphere(
          sphereCenter,
          worldRadius,
          mouseScreenX,
          mouseScreenY,
          canvas
        );
        if (screenDistance !== null && screenDistance > maxPickRadius) {
          continue;
        }
      }

      const mvpElements = mvp.multiplyMatrices(viewProjection, mesh.matrixWorld).elements;
      const e0 = mvpElements[0];
      const e1 = mvpElements[1];
      const e3 = mvpElements[3];
      const e4 = mvpElements[4];
      const e5 = mvpElements[5];
      const e7 = mvpElements[7];
      const e8 = mvpElements[8];
      const e9 = mvpElements[9];
      const e11 = mvpElements[11];
      const e12 = mvpElements[12];
      const e13 = mvpElements[13];
      const e15 = mvpElements[15];

      const interleaved = (positionAttribute as any).isInterleavedBufferAttribute === true;
      const array: ArrayLike<number> = interleaved
        ? (positionAttribute as any).data.array
        : (positionAttribute as THREE.BufferAttribute).array;
      const stride = interleaved ? (positionAttribute as any).data.stride : 3;
      const count = positionAttribute.count;

      for (
        let i = 0, base = interleaved ? (positionAttribute as any).offset : 0;
        i < count;
        i++, base += stride
      ) {
        const x = array[base];
        const y = array[base + 1];
        const z = array[base + 2];

        // Clip-space w equals the view depth for a perspective projection
        const w = e3 * x + e7 * y + e11 * z + e15;
        if (w < 1e-6) {
          continue; // behind the camera
        }

        const invW = 1 / w;
        const sx = ((e0 * x + e4 * y + e8 * z + e12) * invW * 0.5 + 0.5) * width;
        const sy = ((e1 * x + e5 * y + e9 * z + e13) * invW * -0.5 + 0.5) * height;
        const dx = sx - mouseScreenX;
        const dy = sy - mouseScreenY;
        const pixelDistanceSq = dx * dx + dy * dy;

        // Front-most within pick radius wins; skip anything that cannot win
        // before doing the per-point radius math
        if (pixelDistanceSq > maxPickRadiusSq || w > bestDepth) {
          continue;
        }
        if (w === bestDepth && pixelDistanceSq >= bestPixelDistanceSq) {
          continue;
        }

        const renderedSize = this.computeRenderedPointSize(material, w, canvas);
        const pixelRadius = this.computeSelectionPixelRadius(renderedSize, w);
        if (pixelDistanceSq > pixelRadius * pixelRadius) {
          continue;
        }

        bestMesh = mesh;
        bestIndex = i;
        bestDepth = w;
        bestPixelDistanceSq = pixelDistanceSq;
        bestRenderedSize = renderedSize;
        bestPixelRadius = pixelRadius;
      }
    }

    if (!bestMesh) {
      return null;
    }

    return {
      mesh: bestMesh,
      pointIndex: bestIndex,
      viewDepth: bestDepth,
      pixelDistance: Math.sqrt(bestPixelDistanceSq),
      renderedSize: bestRenderedSize,
      pixelRadius: bestPixelRadius,
    };
  }

  /**
   * Distance in CSS pixels from a screen position to the (conservatively
   * enlarged) projected disc of a world-space bounding sphere. Returns 0 when
   * the position lies inside the disc, Infinity when the sphere is entirely
   * behind the camera, and null when the sphere crosses the near plane —
   * there the projection is unreliable and callers should treat the object
   * as close.
   */
  private screenDistanceToBoundingSphere(
    worldCenter: THREE.Vector3,
    worldRadius: number,
    screenX: number,
    screenY: number,
    canvas: HTMLCanvasElement
  ): number | null {
    const camera = this.context.camera;
    const height = canvas.clientHeight;
    const scratch = new THREE.Vector3().copy(worldCenter).applyMatrix4(camera.matrixWorldInverse);
    const centerDepth = -scratch.z;

    if (centerDepth + worldRadius < 0) {
      return Infinity;
    }
    const nearDepth = centerDepth - worldRadius;
    if (nearDepth <= 0) {
      return null;
    }

    scratch.copy(worldCenter).project(camera);
    const cx = (scratch.x * 0.5 + 0.5) * canvas.clientWidth;
    const cy = (scratch.y * -0.5 + 0.5) * height;

    // Bound the sphere's screen extent conservatively: project its radius at
    // the nearest depth and widen it, so an underestimate can never classify
    // a covered position as "far"
    const pixelsPerWorldUnit =
      (height * 0.5) / (Math.tan((camera.fov * Math.PI) / 360) * nearDepth);
    const projectedRadius = worldRadius * pixelsPerWorldUnit * 1.5;

    return Math.max(0, Math.hypot(cx - screenX, cy - screenY) - projectedRadius);
  }

  /**
   * True when the given screen position is farther than marginPx from the
   * projected bounds of every visible object (point clouds, meshes, poses,
   * camera profiles). Used to distinguish a double-click into genuinely empty
   * space — an "I'm lost" recovery gesture — from a near-miss next to
   * something selectable.
   */
  isFarFromAllVisibleObjects(
    mouseScreenX: number,
    mouseScreenY: number,
    canvas: HTMLCanvasElement,
    marginPx: number = 150
  ): boolean {
    this.context.camera.updateMatrixWorld();
    const worldCenter = new THREE.Vector3();

    for (let i = 0; i < this.context.meshes.length; i++) {
      if (!this.context.fileVisibility[i]) {
        continue;
      }
      const mesh = this.context.meshes[i];
      const geometry = (mesh as THREE.Mesh).geometry;
      if (!geometry) {
        continue;
      }
      if (!geometry.boundingSphere) {
        geometry.computeBoundingSphere();
      }
      const sphere = geometry.boundingSphere;
      if (!sphere || !isFinite(sphere.radius) || sphere.radius < 0) {
        continue;
      }
      mesh.updateMatrixWorld();
      worldCenter.copy(sphere.center).applyMatrix4(mesh.matrixWorld);
      const worldRadius = sphere.radius * mesh.matrixWorld.getMaxScaleOnAxis();
      const distance = this.screenDistanceToBoundingSphere(
        worldCenter,
        worldRadius,
        mouseScreenX,
        mouseScreenY,
        canvas
      );
      if (distance === null || distance <= marginPx) {
        return false;
      }
    }

    // Pose and camera groups use the unified visibility index layout
    // (spatial files, then poses, then cameras)
    const groupSets = [
      { groups: this.context.poseGroups, indexOffset: this.context.spatialFiles.length },
      {
        groups: this.context.cameraGroups,
        indexOffset: this.context.spatialFiles.length + this.context.poseGroups.length,
      },
    ];
    const box = new THREE.Box3();
    const sphere = new THREE.Sphere();

    for (const { groups, indexOffset } of groupSets) {
      for (let i = 0; i < groups.length; i++) {
        if (!this.context.fileVisibility[indexOffset + i]) {
          continue;
        }
        box.setFromObject(groups[i]);
        if (box.isEmpty()) {
          continue;
        }
        box.getBoundingSphere(sphere);
        const distance = this.screenDistanceToBoundingSphere(
          sphere.center,
          sphere.radius,
          mouseScreenX,
          mouseScreenY,
          canvas
        );
        if (distance === null || distance <= marginPx) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Convert a pick hit into the world-space point plus logging info
   */
  private resolvePickHit(hit: PointPickHit): SelectionResult {
    const positionAttribute = hit.mesh.geometry.getAttribute('position');
    const worldPoint = new THREE.Vector3()
      .fromBufferAttribute(positionAttribute, hit.pointIndex)
      .applyMatrix4(hit.mesh.matrixWorld);

    let adjusted = '';
    if (this.context.camera.position.distanceTo(worldPoint) < 0.0001) {
      const cameraDirection = new THREE.Vector3(0, 0, -1).applyQuaternion(
        this.context.camera.quaternion
      );
      worldPoint.copy(this.context.camera.position).add(cameraDirection.multiplyScalar(0.0001));
      adjusted = ', adjusted for min distance';
    }

    const fileIndex = this.context.meshes.indexOf(hit.mesh);
    const material = hit.mesh.material as THREE.PointsMaterial;
    const info =
      `screen-space pick: point #${hit.pointIndex} in mesh ${fileIndex}, depth=${hit.viewDepth.toFixed(4)}m, ` +
      `pixelDist=${hit.pixelDistance.toFixed(1)}px, pickRadius=${hit.pixelRadius.toFixed(1)}px, ` +
      `materialSize=${material.size.toFixed(1)}px, renderedSize=${hit.renderedSize.toFixed(1)}px, ` +
      `sizeAttenuation=${material.sizeAttenuation}${adjusted}`;

    return { point: worldPoint, info };
  }
}
