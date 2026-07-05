import * as THREE from 'three';
import { SpatialData } from './interfaces';

export interface FormatDataHandlersHost {
  scene: THREE.Scene;
  spatialFiles: SpatialData[];
  meshes: (THREE.Mesh | THREE.Points | THREE.LineSegments | null)[];
  multiMaterialGroups: (THREE.Group | null)[];
  materialMeshes: (THREE.Object3D[] | null)[];
  normalsVisualizers: (THREE.LineSegments | null)[];
  normalsVisible: boolean[];
  transformationMatrices: THREE.Matrix4[];
  appliedMtlColors: (number | null)[];
  appliedMtlNames: (string | null)[];
  appliedMtlData: (any | null)[];
  showStatus(message: string): void;
  showError(message: string): void;
  addNewFiles(newFiles: SpatialData[]): void;
  displayFiles(dataArray: SpatialData[]): Promise<void>;
  createNormalsVisualizer(data: SpatialData): THREE.LineSegments;
  setTransformationMatrix(fileIndex: number, matrix: THREE.Matrix4): void;
  updateFileList(): void;
}

function attachNormalsVisualizer(host: FormatDataHandlersHost, spatialData: SpatialData): void {
  const normalsVisualizer = host.createNormalsVisualizer(spatialData);

  // Set initial visibility based on stored state (default true)
  const fileIndex = spatialData.fileIndex || host.spatialFiles.length - 1;
  const initialVisible = host.normalsVisible[fileIndex] !== false;
  normalsVisualizer.visible = initialVisible;

  host.scene.add(normalsVisualizer);

  // Ensure the array has the correct size and place the visualizer at the right index
  while (host.normalsVisualizers.length <= fileIndex) {
    host.normalsVisualizers.push(null);
  }
  host.normalsVisualizers[fileIndex] = normalsVisualizer;
}

export async function handlePcdData(host: FormatDataHandlersHost, message: any): Promise<void> {
  try {
    console.log(`Load: recv PCD ${message.fileName}`);
    host.showStatus(`PCD: processing ${message.fileName}`);

    const pcdData = message.data;
    console.log(
      `PCD: ${pcdData.vertexCount} points, format=${pcdData.format}, colors=${pcdData.hasColors}, normals=${pcdData.hasNormals}, intensity=${pcdData.hasIntensity}`
    );

    // Convert PCD data to PLY format for rendering
    const spatialData: SpatialData = {
      vertices: [],
      faces: [],
      format: pcdData.format === 'binary' ? 'binary_little_endian' : 'ascii',
      version: '1.0',
      comments: [
        `Converted from PCD: ${message.fileName}`,
        `Original format: ${pcdData.format}`,
        `Width: ${pcdData.width}, Height: ${pcdData.height}`,
        `Fields: ${pcdData.fields?.join(', ') || 'unknown'}`,
        ...pcdData.comments,
      ],
      vertexCount: pcdData.vertexCount,
      faceCount: 0,
      hasColors: pcdData.hasColors,
      hasNormals: pcdData.hasNormals,
      hasIntensity: pcdData.hasIntensity,
      fileName: message.fileName,
      shortPath: message.shortPath,
      fileSizeInBytes: message.fileSizeInBytes,
    };
    (spatialData as any).useTypedArrays = true;
    (spatialData as any).positionsArray = pcdData.positionsArray;
    (spatialData as any).colorsArray = pcdData.colorsArray;
    (spatialData as any).normalsArray = pcdData.normalsArray;
    (spatialData as any).intensityArray = pcdData.intensityArray;
    (spatialData as any).scalarFields = pcdData.scalarFields ?? {};

    // Carry the PCD viewpoint so we can set the initial transform after the
    // file is registered (at which point we know the fileIndex).
    const vp: number[] = pcdData.viewpoint ?? [0, 0, 0, 1, 0, 0, 0];
    const isIdentityViewpoint =
      vp[0] === 0 &&
      vp[1] === 0 &&
      vp[2] === 0 &&
      vp[3] === 1 &&
      vp[4] === 0 &&
      vp[5] === 0 &&
      vp[6] === 0;

    if (message.isAddFile) {
      host.addNewFiles([spatialData]);
    } else {
      await host.displayFiles([spatialData]);
    }

    // Apply PCD VIEWPOINT as the initial object transform (skip identity — it's the default).
    // The point coordinates are stored as-is from the file (no axis conversion), so the
    // viewpoint quaternion/translation is applied in the same PCL coordinate space.
    // The user's OpenCV/OpenGL convention toggle handles the overall viewing perspective
    // on top of this, just as it does for all other PCD data.
    if (!isIdentityViewpoint) {
      const fileIndex = spatialData.fileIndex ?? host.spatialFiles.length - 1;
      if (fileIndex >= 0 && fileIndex < host.transformationMatrices.length) {
        // PCD viewpoint: tx ty tz  qw qx qy qz
        const [tx, ty, tz, qw, qx, qy, qz] = vp;
        const q = new THREE.Quaternion(qx, qy, qz, qw).normalize();
        const viewpointMatrix = new THREE.Matrix4();
        viewpointMatrix.makeRotationFromQuaternion(q);
        viewpointMatrix.setPosition(tx, ty, tz);
        host.setTransformationMatrix(fileIndex, viewpointMatrix);
      }
    }

    // Create normals visualizer if PCD has normals
    if (spatialData.hasNormals) {
      attachNormalsVisualizer(host, spatialData);
    }

    host.showStatus(`PCD: loaded ${pcdData.vertexCount} points from ${message.fileName}`);
  } catch (error) {
    console.error('Error handling PCD data:', error);
    host.showError(
      `PCD processing failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function handleNpyData(host: FormatDataHandlersHost, message: any): Promise<void> {
  try {
    console.log(`Load: recv NPY point cloud ${message.fileName}`);
    host.showStatus(`NPY: processing point cloud data from ${message.fileName}`);

    const npyData = message.data;
    console.log(
      `NPY: ${npyData.vertexCount} points, format=${npyData.format}, colors=${npyData.hasColors}, normals=${npyData.hasNormals}`
    );

    // NPY data is already in PLY format from the parser
    const spatialData: SpatialData = {
      ...npyData,
      fileName: message.fileName,
      shortPath: message.shortPath,
    };

    if (message.isAddFile) {
      spatialData.fileIndex = host.spatialFiles.length;
    }

    await host.displayFiles([spatialData]);

    // Handle normals visualization if available
    const fileIndex = spatialData.fileIndex!;
    if (npyData.hasNormals) {
      // Ensure normalsVisualizers array is properly sized
      while (host.normalsVisualizers.length <= fileIndex) {
        host.normalsVisualizers.push(null);
      }

      const normalsVisualizer = host.createNormalsVisualizer(spatialData);
      if (normalsVisualizer) {
        host.scene.add(normalsVisualizer);
      }
      host.normalsVisualizers[fileIndex] = normalsVisualizer;
    } else {
      // Ensure array is properly sized even without normals
      while (host.normalsVisualizers.length <= fileIndex) {
        host.normalsVisualizers.push(null);
      }
      host.normalsVisualizers[fileIndex] = null;
    }

    host.showStatus(`NPY: loaded ${npyData.vertexCount} points from ${message.fileName}`);
  } catch (error) {
    console.error('Error handling NPY data:', error);
    host.showError(
      `NPY processing failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function handlePtsData(host: FormatDataHandlersHost, message: any): Promise<void> {
  try {
    console.log(`Load: recv PTS ${message.fileName}`);
    host.showStatus(`PTS: processing ${message.fileName}`);

    const ptsData = message.data;
    console.log(
      `PTS: ${ptsData.vertexCount} points, format=${ptsData.detectedFormat}, colors=${ptsData.hasColors}, normals=${ptsData.hasNormals}, intensity=${ptsData.hasIntensity}`
    );

    // Convert PTS data to PLY format for rendering
    const spatialData: SpatialData = {
      vertices: [],
      faces: [],
      format: 'ascii',
      version: '1.0',
      comments: [
        `Converted from PTS: ${message.fileName}`,
        `Detected format: ${ptsData.detectedFormat}`,
        ...ptsData.comments,
      ],
      vertexCount: ptsData.vertexCount,
      faceCount: 0,
      hasColors: ptsData.hasColors,
      hasNormals: ptsData.hasNormals,
      hasIntensity: ptsData.hasIntensity,
      fileName: message.fileName,
      shortPath: message.shortPath,
      fileSizeInBytes: message.fileSizeInBytes,
    };
    (spatialData as any).useTypedArrays = true;
    (spatialData as any).positionsArray = ptsData.positionsArray;
    (spatialData as any).colorsArray = ptsData.colorsArray;
    (spatialData as any).normalsArray = ptsData.normalsArray;
    (spatialData as any).intensityArray = ptsData.intensityArray;
    (spatialData as any).scalarFields = ptsData.scalarFields ?? {};

    if (message.isAddFile) {
      host.addNewFiles([spatialData]);
    } else {
      await host.displayFiles([spatialData]);
    }

    // Create normals visualizer if PTS has normals
    if (spatialData.hasNormals) {
      attachNormalsVisualizer(host, spatialData);
    }

    host.showStatus(`PTS: loaded ${ptsData.vertexCount} points from ${message.fileName}`);
  } catch (error) {
    console.error('Error handling PTS data:', error);
    host.showError(
      `PTS processing failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function handleOffData(host: FormatDataHandlersHost, message: any): Promise<void> {
  try {
    console.log(`Load: recv OFF ${message.fileName}`);
    host.showStatus(`OFF: processing ${message.fileName}`);

    const offData = message.data;
    console.log(
      `OFF: ${offData.vertexCount} vertices, ${offData.faceCount} faces, variant=${offData.offVariant}, colors=${offData.hasColors}, normals=${offData.hasNormals}`
    );

    // Convert OFF data to PLY format for rendering
    const spatialData: SpatialData = {
      vertices: offData.vertices,
      faces: offData.faces,
      format: 'ascii',
      version: '1.0',
      comments: [
        `Converted from OFF: ${message.fileName}`,
        `OFF variant: ${offData.offVariant}`,
        ...offData.comments,
      ],
      vertexCount: offData.vertexCount,
      faceCount: offData.faceCount,
      hasColors: offData.hasColors,
      hasNormals: offData.hasNormals,
      fileName: message.fileName,
      shortPath: message.shortPath,
      fileSizeInBytes: message.fileSizeInBytes,
    };

    if (message.isAddFile) {
      host.addNewFiles([spatialData]);
    } else {
      await host.displayFiles([spatialData]);
    }

    // Create normals visualizer if OFF has normals (for both meshes and point clouds)
    if (spatialData.hasNormals) {
      attachNormalsVisualizer(host, spatialData);
    }

    const meshType = offData.faceCount > 0 ? 'mesh' : 'point cloud';
    host.showStatus(
      `OFF: loaded ${offData.vertexCount} vertices, ${offData.faceCount} faces as ${meshType} from ${message.fileName}`
    );
  } catch (error) {
    console.error('Error handling OFF data:', error);
    host.showError(
      `OFF processing failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function handleGltfData(host: FormatDataHandlersHost, message: any): Promise<void> {
  try {
    console.log(`Load: recv GLTF/GLB ${message.fileName}`);
    host.showStatus(`GLTF: processing ${message.fileName}`);

    const gltfData = message.data;
    console.log(
      `GLTF: ${gltfData.vertexCount} vertices, ${gltfData.faceCount} faces, ${gltfData.meshCount} meshes, ${gltfData.materialCount} materials, colors=${gltfData.hasColors}, normals=${gltfData.hasNormals}`
    );

    // Convert GLTF data to PLY format for rendering
    const spatialData: SpatialData = {
      vertices: gltfData.vertices,
      faces: gltfData.faces,
      format: 'ascii',
      version: '1.0',
      comments: [
        `Converted from GLTF/GLB: ${message.fileName}`,
        `Format: ${gltfData.format}`,
        `Meshes: ${gltfData.meshCount}, Materials: ${gltfData.materialCount}`,
        ...gltfData.comments,
      ],
      vertexCount: gltfData.vertexCount,
      faceCount: gltfData.faceCount,
      hasColors: gltfData.hasColors,
      hasNormals: gltfData.hasNormals,
      fileName: message.fileName,
      shortPath: message.shortPath,
      fileSizeInBytes: message.fileSizeInBytes,
    };

    if (message.isAddFile) {
      host.addNewFiles([spatialData]);
    } else {
      await host.displayFiles([spatialData]);
    }

    const meshType = gltfData.faceCount > 0 ? 'mesh' : 'point cloud';
    host.showStatus(
      `GLTF: loaded ${gltfData.vertexCount} vertices, ${gltfData.faceCount} faces as ${meshType} from ${message.fileName}`
    );
  } catch (error) {
    console.error('Error handling GLTF data:', error);
    host.showError(
      `GLTF processing failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function handleXyzVariantData(
  host: FormatDataHandlersHost,
  message: any
): Promise<void> {
  try {
    console.log(`Load: recv XYZ variant (${message.variant}) ${message.fileName}`);
    host.showStatus(`XYZ: processing ${message.fileName} (${message.variant})`);

    // Data is already parsed into typed arrays by the extension (XyzVariantParser).
    const xyzData = message.data;
    const spatialData: SpatialData = {
      vertices: [],
      faces: [],
      format: 'ascii',
      version: '1.0',
      comments: [
        `Converted from ${message.variant.toUpperCase()}: ${message.fileName}`,
        `Format variant: ${message.variant}`,
      ],
      vertexCount: xyzData.vertexCount,
      faceCount: 0,
      hasColors: xyzData.hasColors,
      hasNormals: xyzData.hasNormals,
      hasIntensity: xyzData.hasIntensity,
      fileName: message.fileName,
      shortPath: message.shortPath,
      fileSizeInBytes: message.fileSizeInBytes,
    };
    (spatialData as any).useTypedArrays = true;
    (spatialData as any).positionsArray = xyzData.positionsArray;
    (spatialData as any).colorsArray = xyzData.colorsArray;
    (spatialData as any).normalsArray = xyzData.normalsArray;
    (spatialData as any).intensityArray = xyzData.intensityArray;
    (spatialData as any).scalarFields = xyzData.intensityArray
      ? { intensity: xyzData.intensityArray }
      : {};

    if (message.isAddFile) {
      host.addNewFiles([spatialData]);
    } else {
      await host.displayFiles([spatialData]);
    }

    if (spatialData.hasNormals) {
      attachNormalsVisualizer(host, spatialData);
    }

    host.showStatus(
      `${message.variant.toUpperCase()}: loaded ${spatialData.vertexCount} points from ${message.fileName}`
    );
  } catch (error) {
    console.error('Error handling XYZ variant data:', error);
    host.showError(
      `${message.variant.toUpperCase()} processing failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function handleMtlData(host: FormatDataHandlersHost, message: any): void {
  try {
    console.log('Received MTL data for file index:', message.fileIndex);
    const fileIndex = message.fileIndex;
    const mtlData = message.data;
    console.log('MTL data structure:', mtlData);
    console.log('Available materials:', Object.keys(mtlData.materials || {}));

    if (fileIndex < 0 || fileIndex >= host.spatialFiles.length) {
      console.error('Invalid file index for MTL data:', fileIndex);
      return;
    }

    const objFile = host.spatialFiles[fileIndex];
    const isObjFile = (objFile as any).isObjFile || (objFile as any).isObjWireframe;

    console.log('OBJ file data:', {
      isObjFile: (objFile as any).isObjFile,
      isObjWireframe: (objFile as any).isObjWireframe,
      objRenderType: (objFile as any).objRenderType,
      fileName: objFile.fileName,
    });

    if (!isObjFile) {
      console.error('File is not an OBJ file:', fileIndex);
      return;
    }

    // Find the material to use - prioritize the current material from OBJ, then first material
    let materialColor = { r: 1.0, g: 0.0, b: 0.0 }; // Default red
    let materialName = '';

    if (mtlData.materials && Object.keys(mtlData.materials).length > 0) {
      const objData = (objFile as any).objData;
      const materialNames = Object.keys(mtlData.materials);

      // Try to use the material referenced in the OBJ file first
      if (objData && objData.currentMaterial && mtlData.materials[objData.currentMaterial]) {
        const material = mtlData.materials[objData.currentMaterial];
        if (material.diffuseColor) {
          materialColor = material.diffuseColor;
          materialName = objData.currentMaterial;
        }
      } else {
        // Fall back to first available material
        const firstMaterial = mtlData.materials[materialNames[0]];
        if (firstMaterial && firstMaterial.diffuseColor) {
          materialColor = firstMaterial.diffuseColor;
          materialName = materialNames[0];
        }
      }

      console.log(
        `Using material '${materialName}' with color: RGB(${materialColor.r}, ${materialColor.g}, ${materialColor.b})`
      );
    }

    // Convert RGB 0-1 to Three.js hex color
    const hexColor =
      (Math.round(materialColor.r * 255) << 16) |
      (Math.round(materialColor.g * 255) << 8) |
      Math.round(materialColor.b * 255);

    // Update the mesh color based on current render type
    const mesh = host.meshes[fileIndex];
    const multiMaterialGroup = host.multiMaterialGroups[fileIndex];
    const subMeshes = host.materialMeshes[fileIndex];

    console.log('Mesh info:', {
      meshExists: !!mesh,
      meshType: mesh?.type,
      isLineSegments: (mesh as any)?.isLineSegments,
      isObjMesh: (mesh as any)?.isObjMesh,
      isMultiMaterial: (mesh as any)?.isMultiMaterial,
      multiMaterialGroupExists: !!multiMaterialGroup,
      subMeshCount: subMeshes?.length || 0,
      materialType: (mesh as any)?.material?.type,
    });

    if (multiMaterialGroup && subMeshes) {
      // Multi-material OBJ: apply materials to each sub-mesh
      let appliedCount = 0;

      for (const subMesh of subMeshes) {
        const subMaterialName = (subMesh as any).materialName;
        if (subMaterialName && mtlData.materials[subMaterialName]) {
          const subMaterial = mtlData.materials[subMaterialName];
          if (subMaterial.diffuseColor) {
            const subHexColor =
              (Math.round(subMaterial.diffuseColor.r * 255) << 16) |
              (Math.round(subMaterial.diffuseColor.g * 255) << 8) |
              Math.round(subMaterial.diffuseColor.b * 255);

            const subMeshMaterial = (subMesh as any).material;
            if (subMeshMaterial && subMeshMaterial.color) {
              subMeshMaterial.color.setHex(subHexColor);
              console.log(
                `Applied ${subMaterialName} color #${subHexColor.toString(16).padStart(6, '0')} to sub-mesh`
              );
              appliedCount++;
            }
          }
        }
      }

      console.log(`Applied materials to ${appliedCount}/${subMeshes.length} sub-meshes`);
      materialName = message.fileName; // For multi-material, show filename
    } else if (mesh && (mesh as any).isLineSegments) {
      // Update wireframe color
      const lineMaterial = (mesh as any).material;
      if (lineMaterial) {
        lineMaterial.color.setHex(hexColor);
        console.log(`Updated wireframe color to #${hexColor.toString(16).padStart(6, '0')}`);
      }
      materialName = message.fileName; // For single-material, show filename
    } else if (mesh && ((mesh as any).isObjMesh || mesh.type === 'Mesh')) {
      // Update solid mesh color
      const meshMaterial = (mesh as any).material;
      if (meshMaterial) {
        meshMaterial.color.setHex(hexColor);
        console.log(`Updated solid mesh color to #${hexColor.toString(16).padStart(6, '0')}`);
      }
      materialName = message.fileName; // For single-material, show filename
    } else if (mesh) {
      console.warn('Unknown mesh type, trying to update material anyway');
      const anyMaterial = (mesh as any).material;
      if (anyMaterial && anyMaterial.color) {
        anyMaterial.color.setHex(hexColor);
        console.log(`Updated generic material color to #${hexColor.toString(16).padStart(6, '0')}`);
      }
      materialName = message.fileName; // For single-material, show filename
    } else {
      console.error('No mesh or multi-material group found at index:', fileIndex);
    }

    // Store the applied MTL color, name, and data for future use
    host.appliedMtlColors[fileIndex] = hexColor;
    host.appliedMtlNames[fileIndex] = materialName;
    host.appliedMtlData[fileIndex] = mtlData;

    // Update UI to show loaded MTL
    host.updateFileList();

    host.showStatus(
      `MTL material applied! Using material '${materialName}' from ${message.fileName}`
    );
  } catch (error) {
    console.error('Error handling MTL data:', error);
    host.showError(
      `Failed to apply MTL material: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}
