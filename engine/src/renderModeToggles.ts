import * as THREE from 'three';
import { SpatialData } from './interfaces';

/**
 * Per-file solid/wireframe/points/normals render-mode toggles and the mesh
 * visibility/material updates they drive.
 */
export interface RenderModeHost {
  spatialFiles: SpatialData[];
  solidVisible: boolean[];
  wireframeVisible: boolean[];
  pointsVisible: boolean[];
  normalsVisible: boolean[];
  meshes: (THREE.Mesh | THREE.Points | THREE.LineSegments | null)[];
  multiMaterialGroups: (THREE.Group | null)[];
  materialMeshes: (THREE.Object3D[] | null)[];
  vertexPointsObjects: (THREE.Points | null)[];
  normalsVisualizers: (THREE.LineSegments | null)[];
  fileVisibility: boolean[];
  pointSizes: number[];
  allowTransparency: boolean;
  scene: THREE.Scene;
  /** Present on the full visualizer host; drives the per-file splat mode. */
  splatMode?: {
    isActive(fileIndex: number): boolean;
    canEnable(data: SpatialData | undefined): boolean;
    toggle(fileIndex: number): Promise<void>;
    disable(fileIndex: number): void;
    getMesh(fileIndex: number): THREE.Object3D | null;
    syncVisibility(fileIndex: number): void;
  };
  requestRender(): void;
  createNormalsVisualizer(data: SpatialData): THREE.LineSegments;
  createComputedNormalsVisualizer(
    data: SpatialData,
    mesh: THREE.Object3D
  ): THREE.LineSegments | null;
  createPointCloudNormalsVisualizer(
    data: SpatialData,
    mesh: THREE.Object3D
  ): THREE.LineSegments | null;
}

export function toggleUniversalRenderMode(
  host: RenderModeHost,
  fileIndex: number,
  mode: string
): void {
  console.log(`🔄 toggleUniversalRenderMode called: fileIndex=${fileIndex}, mode=${mode}`);
  if (fileIndex < 0 || fileIndex >= host.spatialFiles.length) {
    console.log(
      `❌ Invalid fileIndex: ${fileIndex}, spatialFiles.length=${host.spatialFiles.length}`
    );
    return;
  }

  const data = host.spatialFiles[fileIndex];
  console.log(`📋 File data:`, data?.fileName);

  switch (mode) {
    case 'solid':
    case 'mesh':
      toggleSolidRendering(host, fileIndex);
      break;
    case 'wireframe':
      toggleWireframeRendering(host, fileIndex);
      break;
    case 'points':
      if (host.splatMode?.canEnable(data)) {
        // Gaussian files use Points/Splats as an exclusive mode selector.
        // File visibility is controlled by the checkbox, so selecting the
        // already-active Points mode must not hide the file.
        host.pointsVisible[fileIndex] = true;
        if (host.splatMode.isActive(fileIndex)) {
          host.splatMode.disable(fileIndex);
        } else {
          updateMeshVisibilityAndMaterial(host, fileIndex);
          host.requestRender();
        }
      } else {
        togglePointsRendering(host, fileIndex);
      }
      break;
    case 'normals':
      toggleNormalsRendering(host, fileIndex);
      break;
    case 'splat':
      // Async (first use lazy-loads Spark); the manager refreshes visibility
      // and button states itself once the state actually flips.
      if (!host.splatMode?.isActive(fileIndex)) {
        void host.splatMode?.toggle(fileIndex);
      }
      return;
  }

  // Update button states after mode change
  updateUniversalRenderButtonStates(host);
}

export function toggleSolidRendering(host: RenderModeHost, fileIndex: number): void {
  if (fileIndex < 0 || fileIndex >= host.spatialFiles.length) {
    return;
  }

  // Ensure array is properly sized with default values
  while (host.solidVisible.length <= fileIndex) {
    const data = host.spatialFiles[host.solidVisible.length];
    const defaultValue = data && data.faceCount > 0; // Default true for meshes, false for point clouds
    host.solidVisible.push(defaultValue);
  }

  // Toggle solid visibility state
  host.solidVisible[fileIndex] = !host.solidVisible[fileIndex];

  updateMeshVisibilityAndMaterial(host, fileIndex);
  host.requestRender();
}

export function toggleWireframeRendering(host: RenderModeHost, fileIndex: number): void {
  if (fileIndex < 0 || fileIndex >= host.spatialFiles.length) {
    return;
  }

  // Ensure array is properly sized with default values
  while (host.wireframeVisible.length <= fileIndex) {
    host.wireframeVisible.push(false); // Wireframe always defaults to false
  }

  // Toggle wireframe visibility state
  host.wireframeVisible[fileIndex] = !host.wireframeVisible[fileIndex];

  updateMeshVisibilityAndMaterial(host, fileIndex);
  host.requestRender();
}

export function togglePointsRendering(host: RenderModeHost, fileIndex: number): void {
  if (fileIndex < 0 || fileIndex >= host.spatialFiles.length) {
    return;
  }

  // Ensure array is properly sized with default values
  while (host.pointsVisible.length <= fileIndex) {
    const data = host.spatialFiles[host.pointsVisible.length];
    const defaultValue = !data || data.faceCount === 0; // Default true for point clouds, false for meshes
    host.pointsVisible.push(defaultValue);
  }

  // Toggle points visibility state
  host.pointsVisible[fileIndex] = !host.pointsVisible[fileIndex];

  updateMeshVisibilityAndMaterial(host, fileIndex);
  host.requestRender();
}

export function updateMeshVisibilityAndMaterial(host: RenderModeHost, fileIndex: number): void {
  const mesh = host.meshes[fileIndex];
  const multiMaterialGroup = host.multiMaterialGroups[fileIndex];

  // Handle either regular mesh or multi-material OBJ group
  const target = multiMaterialGroup || mesh;
  if (!target) {
    console.log(`No mesh or multi-material group found for file ${fileIndex}`);
    return;
  }

  const solidVisible = host.solidVisible[fileIndex] ?? true;
  const wireframeVisible = host.wireframeVisible[fileIndex] ?? false;
  const pointsVisible = host.pointsVisible[fileIndex] ?? true;
  const fileVisible = host.fileVisibility[fileIndex] ?? true;

  // Set visibility for the target (mesh or multi-material group)
  if (mesh && mesh.type === 'Points') {
    // Point cloud case. In splat mode the points are hidden (Spark renders
    // the file) but stay loaded: picking/measurement iterate the meshes via
    // fileVisibility, not mesh.visible, so they keep working on the centers.
    const splatActive = !!host.splatMode?.isActive(fileIndex);
    mesh.visible = pointsVisible && fileVisible && !splatActive;
    host.splatMode?.syncVisibility(fileIndex);
  } else {
    // Triangle mesh or multi-material group case
    target.visible = (solidVisible || wireframeVisible) && fileVisible;

    // Handle vertex points visualization for triangle meshes
    if (mesh) {
      // Only for regular meshes, not multi-material groups
      updateVertexPointsVisualization(
        host,
        fileIndex,
        pointsVisible,
        solidVisible,
        wireframeVisible,
        fileVisible
      );
    } else if (multiMaterialGroup) {
      // Handle points for multi-material OBJ groups independently
      updateMultiMaterialPointsVisualization(host, fileIndex, pointsVisible, fileVisible);
    }
  }

  // Handle different rendering combinations:
  // 1. Only solid active: show solid mesh
  // 2. Only wireframe active: show wireframe mesh
  // 3. Both active: show solid mesh (mesh takes precedence)
  // 4. Neither active: mesh is hidden (handled by visibility check above)

  // Update materials for wireframe mode
  if (multiMaterialGroup) {
    // Handle multi-material OBJ groups
    const subMeshes = host.materialMeshes[fileIndex];
    if (subMeshes) {
      subMeshes.forEach(subMesh => {
        if (subMesh instanceof THREE.Mesh && subMesh.material) {
          const material = subMesh.material as THREE.Material;
          if (
            material instanceof THREE.MeshBasicMaterial ||
            material instanceof THREE.MeshLambertMaterial
          ) {
            material.wireframe = wireframeVisible && !solidVisible;
            material.opacity = 1.0;
            material.transparent = false;
          }
        }
      });
    }
  } else if (mesh && (mesh as any).material) {
    // Handle regular single mesh
    const meshWithMaterial = mesh as THREE.Mesh;
    if (Array.isArray(meshWithMaterial.material)) {
      meshWithMaterial.material.forEach(material => {
        if (
          material instanceof THREE.MeshBasicMaterial ||
          material instanceof THREE.MeshLambertMaterial
        ) {
          material.wireframe = wireframeVisible && !solidVisible;
          material.opacity = 1.0;
          material.transparent = false;
        }
      });
    } else if (
      meshWithMaterial.material instanceof THREE.MeshBasicMaterial ||
      meshWithMaterial.material instanceof THREE.MeshLambertMaterial
    ) {
      meshWithMaterial.material.wireframe = wireframeVisible && !solidVisible;
      meshWithMaterial.material.opacity = 1.0;
      meshWithMaterial.material.transparent = false;
    }
  }
}

export function updateVertexPointsVisualization(
  host: RenderModeHost,
  fileIndex: number,
  pointsVisible: boolean,
  solidVisible: boolean,
  wireframeVisible: boolean,
  fileVisible: boolean
): void {
  const mesh = host.meshes[fileIndex];
  if (!mesh || mesh.type === 'Points') {
    return;
  } // Skip if it's already a point cloud

  const shouldShowVertexPoints = pointsVisible && fileVisible;
  let vertexPointsObject = host.vertexPointsObjects[fileIndex];

  if (shouldShowVertexPoints && !vertexPointsObject) {
    // Create vertex points object
    vertexPointsObject = createVertexPointsFromMesh(host, mesh, fileIndex);
    if (vertexPointsObject) {
      host.vertexPointsObjects[fileIndex] = vertexPointsObject;
      host.scene.add(vertexPointsObject);
    }
  }

  if (vertexPointsObject) {
    vertexPointsObject.visible = shouldShowVertexPoints;
    // Update point size from slider
    if (vertexPointsObject.material instanceof THREE.PointsMaterial) {
      vertexPointsObject.material.size = host.pointSizes[fileIndex] || 1.0;
    }
  }
}

export function createVertexPointsFromMesh(
  host: RenderModeHost,
  mesh: THREE.Object3D,
  fileIndex: number
): THREE.Points | null {
  let geometry: THREE.BufferGeometry | null = null;

  // Extract geometry from mesh
  if (mesh instanceof THREE.Mesh) {
    geometry = mesh.geometry as THREE.BufferGeometry;
  } else if (mesh instanceof THREE.Group) {
    // For groups, find the first mesh child
    mesh.traverse(child => {
      if (child instanceof THREE.Mesh && !geometry) {
        geometry = child.geometry as THREE.BufferGeometry;
      }
    });
  }

  if (!geometry || !geometry.attributes.position) {
    return null;
  }

  // Create points geometry from mesh vertices
  const pointsGeometry = new THREE.BufferGeometry();
  pointsGeometry.setAttribute('position', geometry.attributes.position);

  // Copy colors if available
  if (geometry.attributes.color) {
    pointsGeometry.setAttribute('color', geometry.attributes.color);
  }

  // Create point material with current point size
  const currentPointSize = host.pointSizes[fileIndex] || 1.0;
  const pointsMaterial = new THREE.PointsMaterial({
    size: currentPointSize,
    vertexColors: geometry.attributes.color ? true : false,
    color: geometry.attributes.color ? undefined : 0x888888,
    sizeAttenuation: true,
    // Apply transparency settings
    transparent: host.allowTransparency,
    alphaTest: host.allowTransparency ? 0.1 : 0,
    opacity: 1.0,
    depthWrite: true,
    depthTest: true,
    side: THREE.FrontSide,
  });

  const points = new THREE.Points(pointsGeometry, pointsMaterial);
  points.name = 'Vertex Points';
  return points;
}

export function updateMultiMaterialPointsVisualization(
  host: RenderModeHost,
  fileIndex: number,
  pointsVisible: boolean,
  fileVisible: boolean
): void {
  const multiMaterialGroup = host.multiMaterialGroups[fileIndex];
  const subMeshes = host.materialMeshes[fileIndex];

  if (!multiMaterialGroup || !subMeshes) {
    return;
  }

  const shouldShowPoints = pointsVisible && fileVisible;

  // Update visibility for all point objects in the multi-material group
  for (const subMesh of subMeshes) {
    if ((subMesh as any).isPoints && subMesh instanceof THREE.Points) {
      subMesh.visible = shouldShowPoints;
    }
  }
}

export function toggleNormalsRendering(host: RenderModeHost, fileIndex: number): void {
  if (fileIndex < 0 || fileIndex >= host.spatialFiles.length) {
    return;
  }

  // Ensure array is properly sized with default values
  while (host.normalsVisible.length <= fileIndex) {
    host.normalsVisible.push(false); // Normals always default to false
  }

  // Toggle normals visibility state
  host.normalsVisible[fileIndex] = !host.normalsVisible[fileIndex];

  // Check if we have a normals visualizer, if not try to create one
  let normalsVisualizer = host.normalsVisualizers[fileIndex];

  console.log(
    `Normals toggle for file ${fileIndex}: visible=${host.normalsVisible[fileIndex]}, existing visualizer=${!!normalsVisualizer}`
  );

  if (!normalsVisualizer && host.normalsVisible[fileIndex]) {
    // Try to create normals visualizer
    const spatialData = host.spatialFiles[fileIndex];
    const mesh = host.meshes[fileIndex];

    console.log(
      `Creating normals for file ${fileIndex}: hasNormals=${spatialData?.hasNormals}, faceCount=${spatialData?.faceCount}, meshType=${mesh?.type}`
    );

    if (spatialData && mesh) {
      // Try to create normals visualizer in multiple ways:

      // 1. For PLY point clouds, try to use original normals data first
      if (spatialData.fileName?.toLowerCase().endsWith('.ply') && mesh.type === 'Points') {
        if (spatialData.hasNormals && spatialData.vertices.length > 0) {
          normalsVisualizer = host.createNormalsVisualizer(spatialData);
        } else {
          // Try to extract normals from Points geometry
          normalsVisualizer = host.createPointCloudNormalsVisualizer(spatialData, mesh);
        }
      }
      // 2. For PLY triangle meshes, use computed normals from mesh geometry
      else if (spatialData.fileName?.toLowerCase().endsWith('.ply')) {
        normalsVisualizer = host.createComputedNormalsVisualizer(spatialData, mesh);
      }
      // 3. If PLY data has explicit normals and populated vertices array
      else if (spatialData.hasNormals && spatialData.vertices.length > 0) {
        normalsVisualizer = host.createNormalsVisualizer(spatialData);
      }
      // 4. If it's a triangle mesh, compute from geometry
      else if (mesh.type !== 'Points') {
        normalsVisualizer = host.createComputedNormalsVisualizer(spatialData, mesh);
      }
      // 5. Fallback: try any available data
      else if (spatialData.faceCount > 0) {
        normalsVisualizer = host.createComputedNormalsVisualizer(spatialData, mesh);
      }

      if (normalsVisualizer) {
        console.log(`✅ Created normals visualizer for file ${fileIndex}`);
        host.normalsVisualizers[fileIndex] = normalsVisualizer;
        host.scene.add(normalsVisualizer);
      } else {
        console.log(`❌ Failed to create normals visualizer for file ${fileIndex}`);
      }
    }
  }

  if (normalsVisualizer) {
    const shouldBeVisible =
      host.normalsVisible[fileIndex] && (host.fileVisibility[fileIndex] ?? true);
    console.log(
      `Setting normals visualizer visibility: ${shouldBeVisible} (normals=${host.normalsVisible[fileIndex]}, file=${host.fileVisibility[fileIndex] ?? true})`
    );

    // Debug the normals visualizer
    const geometry = (normalsVisualizer as any).geometry;
    const material = (normalsVisualizer as any).material;
    console.log(`📏 Normals visualizer info:`, {
      name: normalsVisualizer.name,
      visible: normalsVisualizer.visible,
      geometryVertices: geometry?.attributes?.position?.count || 0,
      materialColor: material?.color?.getHexString?.() || 'unknown',
      position: normalsVisualizer.position,
      scale: normalsVisualizer.scale,
    });

    normalsVisualizer.visible = shouldBeVisible;
  } else {
    console.log(`No normals visualizer found for file ${fileIndex}`);
  }
  host.requestRender();
}

export function updateUniversalRenderButtonStates(host: RenderModeHost): void {
  const renderModeButtons = document.querySelectorAll('.render-mode-btn');
  renderModeButtons.forEach(button => {
    const target = button as HTMLElement;
    const fileIndex = parseInt(target.getAttribute('data-file-index') || '0');
    const mode = target.getAttribute('data-mode') || 'solid';

    let isActive = false;
    switch (mode) {
      case 'solid':
      case 'mesh':
        isActive = host.solidVisible[fileIndex] ?? true;
        break;
      case 'wireframe':
        isActive = host.wireframeVisible[fileIndex] ?? false;
        break;
      case 'points':
        isActive = host.splatMode?.canEnable(host.spatialFiles[fileIndex])
          ? !host.splatMode.isActive(fileIndex)
          : (host.pointsVisible[fileIndex] ?? true);
        break;
      case 'normals':
        isActive = host.normalsVisible[fileIndex] ?? false;
        break;
      case 'splat':
        isActive = !!host.splatMode?.isActive(fileIndex);
        break;
    }

    // Update button visual state
    if (isActive) {
      target.style.background = 'var(--vscode-button-background)';
      target.style.color = 'var(--vscode-button-foreground)';
      target.classList.add('active');
    } else {
      target.style.background = 'var(--vscode-button-secondaryBackground)';
      target.style.color = 'var(--vscode-button-secondaryForeground)';
      target.classList.remove('active');
    }
  });
}
