import * as THREE from 'three';
import { SpatialData, SpatialFace, SpatialVertex } from './interfaces';

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

export async function handleKittiBinData(
  host: FormatDataHandlersHost,
  message: any
): Promise<void> {
  try {
    console.log(`Load: recv KITTI BIN ${message.fileName}`);
    host.showStatus(`KITTI BIN: processing ${message.fileName}`);

    const kittiData = message.data;
    console.log(
      `KITTI BIN: ${kittiData.vertexCount} points, format=${kittiData.detectedFormat}, intensity=${kittiData.hasIntensity}`
    );

    // Convert KITTI BIN data to the shared spatial format for rendering
    const spatialData: SpatialData = {
      vertices: [],
      faces: [],
      format: 'binary_little_endian',
      version: '1.0',
      comments: [
        `Converted from KITTI BIN: ${message.fileName}`,
        `Detected format: ${kittiData.detectedFormat}`,
        ...(kittiData.comments ?? []),
      ],
      vertexCount: kittiData.vertexCount,
      faceCount: 0,
      hasColors: kittiData.hasColors,
      hasNormals: kittiData.hasNormals,
      hasIntensity: kittiData.hasIntensity,
      fileName: message.fileName,
      shortPath: message.shortPath,
      fileSizeInBytes: message.fileSizeInBytes,
    };
    (spatialData as any).useTypedArrays = true;
    (spatialData as any).positionsArray = kittiData.positionsArray;
    (spatialData as any).colorsArray = kittiData.colorsArray;
    (spatialData as any).normalsArray = kittiData.normalsArray;
    (spatialData as any).intensityArray = kittiData.intensityArray;
    (spatialData as any).scalarFields = kittiData.scalarFields ?? {};

    if (message.isAddFile) {
      host.addNewFiles([spatialData]);
    } else {
      await host.displayFiles([spatialData]);
    }

    host.showStatus(`KITTI BIN: loaded ${kittiData.vertexCount} points from ${message.fileName}`);
  } catch (error) {
    console.error('Error handling KITTI BIN data:', error);
    host.showError(
      `KITTI BIN processing failed: ${error instanceof Error ? error.message : String(error)}`
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

export async function handleObjData(host: FormatDataHandlersHost, message: any): Promise<void> {
  try {
    console.log(`Load: recv OBJ ${message.fileName}`);
    host.showStatus(`OBJ: processing ${message.fileName}`);

    const objData = message.data;
    const hasFaces = objData.faceCount > 0;
    const hasLines = objData.lineCount > 0;
    const hasPoints = objData.pointCount > 0;

    console.log(
      `OBJ: v=${objData.vertexCount}, pts=${objData.pointCount}, f=${objData.faceCount}, lines=${objData.lineCount}, groups=${objData.materialGroups ? objData.materialGroups.length : 0}`
    );

    // Convert OBJ vertices to PLY format
    const vertices: SpatialVertex[] = objData.vertices.map((v: any) => ({
      x: v.x,
      y: v.y,
      z: v.z,
      red: 128, // Default gray color
      green: 128,
      blue: 128,
    }));

    // Convert OBJ faces to PLY format if they exist
    const faces: SpatialFace[] = [];
    if (hasFaces) {
      for (const objFace of objData.faces) {
        if (objFace.indices.length >= 3) {
          faces.push({
            indices: objFace.indices,
          });
        }
      }
    }

    // Create PLY data structure
    const spatialData: SpatialData = {
      vertices,
      faces,
      format: 'ascii',
      version: '1.0',
      comments: [`Converted from OBJ file: ${message.fileName}`],
      vertexCount: vertices.length,
      faceCount: faces.length,
      hasColors: true,
      hasNormals: objData.hasNormals,
      fileName: message.fileName, // Keep original OBJ filename
      shortPath: message.shortPath,
      fileIndex: host.spatialFiles.length,
      fileSizeInBytes: message.fileSizeInBytes,
    };

    // Store OBJ-specific data for enhanced rendering
    (spatialData as any).objData = objData;
    (spatialData as any).isObjFile = true;
    (spatialData as any).objRenderType = hasFaces ? 'mesh' : 'wireframe';

    // Store line data for wireframe rendering (either as primary or secondary visualization)
    if (hasLines) {
      (spatialData as any).objLines = objData.lines;
      (spatialData as any).hasWireframe = true;
    }

    // Store point data for point rendering
    if (hasPoints) {
      (spatialData as any).objPoints = objData.points;
      (spatialData as any).hasPoints = true;
    }

    // Add to visualization
    if (message.isAddFile) {
      host.addNewFiles([spatialData]);
    } else {
      await host.displayFiles([spatialData]);
    }

    // Status message based on what was loaded
    const statusParts = [`${vertices.length.toLocaleString()} vertices`];
    if (hasPoints) {
      statusParts.push(`${objData.pointCount} points`);
    }
    if (hasFaces) {
      statusParts.push(`${faces.length.toLocaleString()} faces`);
    }
    if (hasLines) {
      statusParts.push(`${objData.lineCount} line segments`);
    }
    if (objData.hasTextures) {
      statusParts.push(`${objData.textureCoordCount} texture coords`);
    }
    if (objData.hasNormals) {
      statusParts.push(`${objData.normalCount} normals`);
    }

    host.showStatus(`OBJ ${hasFaces ? 'mesh' : 'wireframe'} loaded: ${statusParts.join(', ')}`);
  } catch (error) {
    console.error('Error handling OBJ data:', error);
    host.showError(
      `Failed to process OBJ file: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function handleStlData(host: FormatDataHandlersHost, message: any): Promise<void> {
  try {
    console.log(`Load: recv STL ${message.fileName}`);
    host.showStatus(`STL: processing ${message.fileName}`);

    const stlData = message.data;
    const hasColors = stlData.hasColors;

    console.log(
      `STL: ${stlData.triangleCount} triangles, format=${stlData.format}, colors=${hasColors}`
    );

    // Handle empty STL files
    if (stlData.triangleCount === 0 || !stlData.triangles || stlData.triangles.length === 0) {
      console.log('STL: Empty mesh detected');
      host.showStatus(`STL: Empty mesh loaded (${message.fileName})`);

      // Create minimal PLY data for empty mesh
      const spatialData: SpatialData = {
        vertices: [],
        faces: [],
        format: stlData.format === 'binary' ? 'binary_little_endian' : 'ascii',
        version: '1.0',
        comments: [
          `Empty STL mesh: ${message.fileName}`,
          `Original format: ${stlData.format}`,
          ...(stlData.header ? [`Header: ${stlData.header}`] : []),
        ],
        vertexCount: 0,
        faceCount: 0,
        hasColors: false,
        hasNormals: false,
        fileName: message.fileName.replace(/\.stl$/i, '_empty.ply'),
        shortPath: message.shortPath,
        fileIndex: host.spatialFiles.length,
        fileSizeInBytes: message.fileSizeInBytes,
      };

      // Add to visualization (even empty files should be tracked)
      if (message.isAddFile) {
        host.addNewFiles([spatialData]);
      } else {
        await host.displayFiles([spatialData]);
      }

      return;
    }

    // Convert STL triangles to PLY vertices and faces
    const vertices: SpatialVertex[] = [];
    const faces: SpatialFace[] = [];
    const vertexMap = new Map<string, number>(); // For deduplication

    let vertexIndex = 0;

    for (let i = 0; i < stlData.triangles.length; i++) {
      const triangle = stlData.triangles[i];
      const faceIndices: number[] = [];

      // Process each vertex of the triangle
      for (let j = 0; j < 3; j++) {
        const vertex = triangle.vertices[j];
        const key = `${vertex.x},${vertex.y},${vertex.z}`;

        let vIndex = vertexMap.get(key);
        if (vIndex === undefined) {
          // New vertex
          vIndex = vertexIndex++;
          vertexMap.set(key, vIndex);

          const plyVertex: SpatialVertex = {
            x: vertex.x,
            y: vertex.y,
            z: vertex.z,
            nx: triangle.normal.x,
            ny: triangle.normal.y,
            nz: triangle.normal.z,
          };

          // Add color if available
          if (hasColors && triangle.color) {
            plyVertex.red = triangle.color.red;
            plyVertex.green = triangle.color.green;
            plyVertex.blue = triangle.color.blue;
          } else {
            // Default gray color
            plyVertex.red = 180;
            plyVertex.green = 180;
            plyVertex.blue = 180;
          }

          vertices.push(plyVertex);
        }

        faceIndices.push(vIndex);
      }

      // Add the face
      faces.push({
        indices: faceIndices,
      });
    }

    // Create PLY data structure
    const spatialData: SpatialData = {
      vertices,
      faces,
      format: stlData.format === 'binary' ? 'binary_little_endian' : 'ascii',
      version: '1.0',
      comments: [
        `Converted from STL file: ${message.fileName}`,
        `Original format: ${stlData.format}`,
        `Triangle count: ${stlData.triangleCount}`,
        ...(stlData.header ? [`Header: ${stlData.header}`] : []),
      ],
      vertexCount: vertices.length,
      faceCount: faces.length,
      hasColors: true,
      hasNormals: true,
      fileName: message.fileName.replace(/\.stl$/i, '_mesh.ply'),
      shortPath: message.shortPath,
      fileIndex: host.spatialFiles.length,
      fileSizeInBytes: message.fileSizeInBytes,
    };

    // Store STL-specific data for enhanced rendering
    (spatialData as any).stlData = stlData;
    (spatialData as any).isStlFile = true;
    (spatialData as any).stlFormat = stlData.format;
    (spatialData as any).stlTriangleCount = stlData.triangleCount;

    // Add to visualization
    if (message.isAddFile) {
      host.addNewFiles([spatialData]);
    } else {
      await host.displayFiles([spatialData]);
    }

    // Status message
    const statusParts = [
      `${vertices.length.toLocaleString()} vertices`,
      `${faces.length.toLocaleString()} triangles`,
      `${stlData.format} format`,
    ];
    if (hasColors) {
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
