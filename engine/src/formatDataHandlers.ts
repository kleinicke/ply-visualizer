import {
  replaceSpatialGeometry,
  type GeometryReplacementHost,
} from './visualization/replaceSpatialGeometry';
import type { FileEntryRegistry } from './state/fileEntries';
import { decodeFileMessage, readFileDataMessage } from './formats/fileMessage';
import * as THREE from 'three';
import { SpatialData, SpatialVertex } from './interfaces';
import type { ObjMesh, OffMesh, StlMesh } from './parsers/pointcloudWasm';
import { objSpatialData, offSpatialData, stlSpatialData } from './formats/meshSpatialData';

export interface FormatDataHandlersHost extends GeometryReplacementHost {
  scene: THREE.Scene;
  spatialFiles: readonly SpatialData[];
  meshes: readonly (THREE.Mesh | THREE.Points | THREE.LineSegments | null)[];

  showStatus(message: string): void;
  showError(message: string): void;
  addNewFiles(newFiles: SpatialData[]): void;
  displayFiles(dataArray: SpatialData[]): Promise<void>;
  createNormalsVisualizer(data: SpatialData): THREE.LineSegments;
  setTransformationMatrix(fileIndex: number, matrix: THREE.Matrix4): void;
  updateFileList(): void;
  updateFileStats(): void;
  requestRender(): void;
  createGeometryFromSpatialData(data: SpatialData): THREE.BufferGeometry;
  createMaterialForFile(data: SpatialData, fileIndex: number): THREE.Material;

  fileEntries: FileEntryRegistry;
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
      sourcePointCount: pcdData.sourcePointCount,
      sourcePointIndices: pcdData.sourcePointIndices,
      sourceRowsIdentity: pcdData.sourceRowsIdentity,
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
      if (fileIndex >= 0 && fileIndex < host.fileEntries.length) {
        // PCD viewpoint: tx ty tz  qw qx qy qz
        const [tx, ty, tz, qw, qx, qy, qz] = vp;
        const q = new THREE.Quaternion(qx, qy, qz, qw).normalize();
        const viewpointMatrix = new THREE.Matrix4();
        viewpointMatrix.makeRotationFromQuaternion(q);
        viewpointMatrix.setPosition(tx, ty, tz);
        host.setTransformationMatrix(fileIndex, viewpointMatrix);
      }
    }

    host.showStatus(`PCD: loaded ${pcdData.vertexCount} points from ${message.fileName}`);
  } catch (error) {
    console.error('Error handling PCD data:', error);
    host.showError(
      `PCD processing failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function handleOffData(host: FormatDataHandlersHost, message: any): Promise<void> {
  try {
    const off = message.data as OffMesh;
    const spatialData = offSpatialData(off, message);
    if (message.isAddFile) {
      host.addNewFiles([spatialData]);
    } else {
      await host.displayFiles([spatialData]);
    }
    const meshType = off.triangleCount > 0 ? 'mesh' : 'point cloud';
    host.showStatus(
      `OFF: loaded ${off.vertexCount} vertices, ${off.triangleCount} faces as ${meshType} from ${message.fileName}`
    );
  } catch (error) {
    console.error('Error handling OFF data:', error);
    host.showError(
      `OFF processing failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

/**
 * An isosurface extracted from a volume (NRRD, or a stack handed over by
 * tiff-visualizer).
 *
 * The extension host has already done the marching-cubes pass, so what arrives
 * is finished `SpatialData` on the typed-array path rather than a
 * format-specific shape needing conversion — which is exactly the point of
 * routing volumes through the mesh pipeline instead of building a second
 * renderer.
 */
export async function handleVolumeData(host: FormatDataHandlersHost, message: any): Promise<void> {
  try {
    console.log(`Load: recv volume ${message.fileName}`);
    host.showStatus(`Volume: processing ${message.fileName}`);

    const replacing = Number.isInteger(message.replaceFileIndex);
    const oldData = replacing ? host.spatialFiles[message.replaceFileIndex] : undefined;
    const spatialData: SpatialData = {
      ...message.data,
      fileName: message.fileName,
      shortPath: message.shortPath ?? oldData?.shortPath,
      fileSizeInBytes: message.fileSizeInBytes ?? oldData?.fileSizeInBytes,
    };

    if (replacing) {
      replaceVolumeGeometry(host, message.replaceFileIndex, spatialData);
    } else if (message.isAddFile) {
      host.addNewFiles([spatialData]);
    } else {
      await host.displayFiles([spatialData]);
    }

    const threshold = (spatialData.metadata as any)?.threshold;
    const units = (spatialData.metadata as any)?.intensityUnits;
    const renderMode = (spatialData.metadata as any)?.volumeRenderMode;
    const at =
      renderMode === 'slices' || threshold === undefined
        ? ''
        : ` at ${Math.round(threshold)}${units ? ` ${units}` : ''}`;
    const summary =
      renderMode === 'points'
        ? `${spatialData.vertexCount.toLocaleString()} points`
        : renderMode === 'slices'
          ? `orthogonal slices at ${(spatialData.metadata as any)?.sliceIndices?.join(' / ') || 'centre'}`
          : renderMode === 'voxels'
            ? `${Number((spatialData.metadata as any)?.renderedVoxelCount ?? 0).toLocaleString()} voxels, ${spatialData.faceCount.toLocaleString()} triangles`
            : `${spatialData.vertexCount.toLocaleString()} vertices, ${spatialData.faceCount.toLocaleString()} triangles`;
    const modeLabel =
      renderMode === 'points'
        ? 'point cloud'
        : renderMode === 'slices'
          ? 'slices'
          : renderMode === 'voxels'
            ? 'voxels'
            : 'mesh';
    host.showStatus(`Volume: ${modeLabel}${at} — ${summary} from ${message.fileName}`);
  } catch (error) {
    console.error('Error handling volume data:', error);
    host.showError(
      `Volume processing failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function replaceVolumeGeometry(
  host: FormatDataHandlersHost,
  fileIndex: number,
  data: SpatialData
): void {
  const entry = host.fileEntries.require(fileIndex);
  const previousMode = entry.spatial?.data.metadata?.volumeRenderMode;
  const mode = data.metadata?.volumeRenderMode;
  data.fileIndex = fileIndex;
  replaceSpatialGeometry(host, entry, data, fileIndex, {
    colorMode:
      mode !== previousMode ? (mode === 'mesh' ? 'assigned' : 'original') : entry.state.colorMode,
    solidVisible: data.faceCount > 0,
    pointsVisible: data.faceCount === 0,
    wireframeVisible: false,
  });
  host.updateFileList();
  host.updateFileStats();
  host.requestRender();
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

export async function handleObjData(host: FormatDataHandlersHost, message: any): Promise<void> {
  try {
    const obj = message.data as ObjMesh;
    const spatialData = objSpatialData(obj, message);
    spatialData.fileIndex = host.spatialFiles.length;
    if (message.isAddFile) {
      host.addNewFiles([spatialData]);
    } else {
      await host.displayFiles([spatialData]);
    }

    const statusParts = [`${obj.vertexCount.toLocaleString()} vertices`];
    if (obj.pointCount > 0) {
      statusParts.push(`${obj.pointCount} points`);
    }
    if (obj.faceCount > 0) {
      statusParts.push(`${obj.faceCount.toLocaleString()} faces`);
    }
    if (obj.lineCount > 0) {
      statusParts.push(`${obj.lineCount} line segments`);
    }
    if (obj.hasTextures) {
      statusParts.push(`${obj.textureCoordCount} texture coords`);
    }
    if (obj.hasNormals) {
      statusParts.push(`${obj.normalCount} normals`);
    }
    host.showStatus(
      `OBJ ${obj.faceCount > 0 ? 'mesh' : 'wireframe'} loaded: ${statusParts.join(', ')}`
    );
  } catch (error) {
    console.error('Error handling OBJ data:', error);
    host.showError(
      `Failed to process OBJ file: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function handleStlData(host: FormatDataHandlersHost, message: any): Promise<void> {
  try {
    const stl = message.data as StlMesh;
    const spatialData = stlSpatialData(stl, message);
    // The extension has always listed an STL as `<name>_mesh.ply`; the
    // standalone page keeps the file's own name.
    spatialData.fileName = message.fileName.replace(/\.stl$/i, '_mesh.ply');
    spatialData.fileIndex = host.spatialFiles.length;
    if (message.isAddFile) {
      host.addNewFiles([spatialData]);
    } else {
      await host.displayFiles([spatialData]);
    }
    if (stl.triangleCount === 0) {
      host.showStatus(`STL: Empty mesh loaded (${message.fileName})`);
      return;
    }
    const statusParts = [
      `${stl.vertexCount.toLocaleString()} vertices`,
      `${stl.triangleCount.toLocaleString()} triangles`,
      `${stl.format} format`,
    ];
    if (stl.sourceHasColors) {
      statusParts.push('with colors');
    }
    host.showStatus(`STL mesh loaded: ${statusParts.join(', ')}`);
  } catch (error) {
    console.error('Error handling STL data:', error);
    host.showError(
      `Failed to process STL file: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function handleXyzData(host: FormatDataHandlersHost, message: any): Promise<void> {
  try {
    console.log('Received XYZ data for processing:', message.fileName);
    host.showStatus('Parsing XYZ file...');

    // Parse XYZ file (simple format: x y z [r g b] per line)
    const decoder = new TextDecoder('utf-8');
    const text = decoder.decode(message.data);
    const lines = text.split('\n').filter(line => line.trim().length > 0);

    const vertices: SpatialVertex[] = [];
    let hasColors = false;

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length >= 3) {
        const x = parseFloat(parts[0]);
        const y = parseFloat(parts[1]);
        const z = parseFloat(parts[2]);

        if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
          const vertex: SpatialVertex = { x, y, z };

          // Check for color data (RGB values)
          if (parts.length >= 6) {
            const r = parseInt(parts[3]);
            const g = parseInt(parts[4]);
            const b = parseInt(parts[5]);

            if (!isNaN(r) && !isNaN(g) && !isNaN(b)) {
              vertex.red = Math.max(0, Math.min(255, r));
              vertex.green = Math.max(0, Math.min(255, g));
              vertex.blue = Math.max(0, Math.min(255, b));
              hasColors = true;
            }
          }

          vertices.push(vertex);
        }
      }
    }

    if (vertices.length === 0) {
      throw new Error('No valid vertices found in XYZ file');
    }

    // Create PLY data structure
    const spatialData: SpatialData = {
      vertices,
      faces: [],
      format: 'ascii',
      version: '1.0',
      comments: [`Converted from XYZ file: ${message.fileName}`],
      vertexCount: vertices.length,
      faceCount: 0,
      hasColors,
      hasNormals: false,
      fileName: message.fileName.replace(/\.xyz$/i, '_pointcloud.ply'),
      shortPath: message.shortPath,
      fileIndex: host.spatialFiles.length,
    };

    // Add to visualization
    if (message.isAddFile) {
      host.addNewFiles([spatialData]);
    } else {
      await host.displayFiles([spatialData]);
    }

    host.showStatus(
      `XYZ file loaded successfully! ${vertices.length.toLocaleString()} points${hasColors ? ' with colors' : ''}`
    );
  } catch (error) {
    console.error('Error handling XYZ data:', error);
    host.showError(
      `Failed to process XYZ file: ${error instanceof Error ? error.message : String(error)}`
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
    const multiMaterialGroup = host.fileEntries.require(fileIndex).resources.materialGroup;
    const subMeshes = host.fileEntries.require(fileIndex).resources.materialMeshes;

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
    host.fileEntries.require(fileIndex).resources.materialColor = hexColor;
    host.fileEntries.require(fileIndex).resources.materialName = materialName;
    host.fileEntries.require(fileIndex).resources.materialData = mtlData;

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

export async function handleFileData(
  host: FormatDataHandlersHost,
  message: unknown
): Promise<void> {
  try {
    const input = readFileDataMessage(message);
    const data = await decodeFileMessage(input);
    if (input.isAddFile) {
      host.addNewFiles([data]);
    } else {
      await host.displayFiles([data]);
    }
    host.showStatus(`Loaded ${data.vertexCount.toLocaleString()} points from ${input.fileName}`);
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      host.showStatus('Import cancelled');
    } else {
      host.showError(
        `File import failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/** Shared finalization for already-decoded point buffers from either host. */
export async function handlePointData(
  host: FormatDataHandlersHost,
  message: {
    type: 'ptsData' | 'kittiBinData' | 'npyData' | 'xyzVariantData';
    data: import('./interfaces').PointDataPayload;
    fileName: string;
    shortPath?: string;
    fileSizeInBytes?: number;
    isAddFile?: boolean;
  }
): Promise<void> {
  const input = message.data;
  const data: SpatialData = {
    ...input,
    vertices: input.vertices ?? [],
    faces: input.faces ?? [],
    version: input.version ?? '1.0',
    format: message.type === 'kittiBinData' ? 'binary_little_endian' : 'ascii',
    comments: input.comments ?? [],
    faceCount: input.faceCount ?? 0,
    fileName: message.fileName,
    shortPath: message.shortPath,
    fileSizeInBytes: message.fileSizeInBytes,
    useTypedArrays: input.positionsArray !== undefined,
    scalarFields:
      input.scalarFields ?? (input.intensityArray ? { intensity: input.intensityArray } : {}),
  };
  if (message.isAddFile) {
    host.addNewFiles([data]);
  } else {
    await host.displayFiles([data]);
  }
  host.showStatus(`Loaded ${data.vertexCount.toLocaleString()} points from ${message.fileName}`);
}
