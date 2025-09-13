/**
 * Parser for GLTF (GL Transmission Format) and GLB formats
 * Basic support for extracting mesh geometry
 */

export interface GltfData {
  vertices: Array<{
    x: number;
    y: number;
    z: number;
    red?: number;
    green?: number;
    blue?: number;
    nx?: number;
    ny?: number;
    nz?: number;
  }>;
  faces: Array<{ indices: number[] }>;
  vertexCount: number;
  faceCount: number;
  hasColors: boolean;
  hasNormals: boolean;
  format: 'gltf' | 'glb';
  fileName: string;
  fileIndex?: number;
  comments: string[];
  meshCount: number;
  materialCount: number;
}

export class GltfParser {
  async parse(data: Uint8Array, timingCallback?: (message: string) => void): Promise<GltfData> {
    const startTime = performance.now();
    timingCallback?.('🔍 GLTF: Starting parsing...');

    let gltfJson: any;
    let binaryData: Uint8Array | null = null;
    let format: 'gltf' | 'glb' = 'gltf';

    // Determine if this is GLB (binary) or GLTF (text)
    const header = new DataView(data.buffer, data.byteOffset, Math.min(12, data.length));

    if (data.length >= 12 && header.getUint32(0, true) === 0x46546c67) {
      // 'glTF' magic
      // GLB format
      format = 'glb';
      timingCallback?.('📦 GLTF: Detected GLB (binary) format');

      const version = header.getUint32(4, true);
      const totalLength = header.getUint32(8, true);

      if (version !== 2) {
        throw new Error(`Unsupported GLB version: ${version} (only version 2 is supported)`);
      }

      let offset = 12;

      // Read JSON chunk
      if (offset + 8 > data.length) {
        throw new Error('GLB file too short for JSON chunk header');
      }

      const jsonChunkLength = new DataView(data.buffer, data.byteOffset + offset, 4).getUint32(
        0,
        true
      );
      const jsonChunkType = new DataView(data.buffer, data.byteOffset + offset + 4, 4).getUint32(
        0,
        true
      );
      offset += 8;

      if (jsonChunkType !== 0x4e4f534a) {
        // 'JSON'
        throw new Error('GLB: Expected JSON chunk');
      }

      const jsonBytes = data.slice(offset, offset + jsonChunkLength);
      const jsonText = new TextDecoder('utf-8').decode(jsonBytes);
      gltfJson = JSON.parse(jsonText);
      offset += jsonChunkLength;

      // Read binary chunk (if present)
      if (offset + 8 <= data.length) {
        const binChunkLength = new DataView(data.buffer, data.byteOffset + offset, 4).getUint32(
          0,
          true
        );
        const binChunkType = new DataView(data.buffer, data.byteOffset + offset + 4, 4).getUint32(
          0,
          true
        );
        offset += 8;

        if (binChunkType === 0x004e4942) {
          // 'BIN\0'
          binaryData = data.slice(offset, offset + binChunkLength);
        }
      }
    } else {
      // GLTF format (JSON)
      format = 'gltf';
      timingCallback?.('📄 GLTF: Detected GLTF (JSON) format');

      const decoder = new TextDecoder('utf-8');
      const text = decoder.decode(data);
      gltfJson = JSON.parse(text);
    }

    timingCallback?.(`📊 GLTF: JSON parsed, extracting geometry...`);

    const vertices: Array<{
      x: number;
      y: number;
      z: number;
      red?: number;
      green?: number;
      blue?: number;
      nx?: number;
      ny?: number;
      nz?: number;
    }> = [];
    const faces: Array<{ indices: number[] }> = [];
    const comments: string[] = [];

    let hasColors = false;
    let hasNormals = false;
    let meshCount = 0;
    let materialCount = gltfJson.materials ? gltfJson.materials.length : 0;

    // Add asset info as comments
    if (gltfJson.asset) {
      if (gltfJson.asset.generator) {comments.push(`Generator: ${gltfJson.asset.generator}`);}
      if (gltfJson.asset.version) {comments.push(`Version: ${gltfJson.asset.version}`);}
      if (gltfJson.asset.copyright) {comments.push(`Copyright: ${gltfJson.asset.copyright}`);}
    }

    // Process meshes
    if (gltfJson.meshes) {
      meshCount = gltfJson.meshes.length;
      timingCallback?.(`🔧 GLTF: Processing ${meshCount} meshes...`);

      for (const mesh of gltfJson.meshes) {
        if (!mesh.primitives) {continue;}

        for (const primitive of mesh.primitives) {
          if (!primitive.attributes) {continue;}

          // Get position accessor
          const positionAccessorIndex = primitive.attributes.POSITION;
          if (positionAccessorIndex === undefined) {continue;}

          const positionAccessor = gltfJson.accessors[positionAccessorIndex];
          if (!positionAccessor || positionAccessor.type !== 'VEC3') {continue;}

          // Get positions
          const positions = this.getAccessorData(
            gltfJson,
            positionAccessorIndex,
            binaryData,
            timingCallback
          );
          if (!positions) {
            console.warn('GLTF: Could not load position data - missing external buffers');
            continue;
          }

          // Get colors if available
          let colors: Float32Array | Uint16Array | Uint32Array | null = null;
          if (primitive.attributes.COLOR_0 !== undefined) {
            colors = this.getAccessorData(
              gltfJson,
              primitive.attributes.COLOR_0,
              binaryData,
              timingCallback
            );
            if (colors) {hasColors = true;}
          }

          // Get normals if available
          let normals: Float32Array | Uint16Array | Uint32Array | null = null;
          if (primitive.attributes.NORMAL !== undefined) {
            normals = this.getAccessorData(
              gltfJson,
              primitive.attributes.NORMAL,
              binaryData,
              timingCallback
            );
            if (normals) {hasNormals = true;}
          }

          // Create vertices
          const vertexOffset = vertices.length;
          for (let i = 0; i < positionAccessor.count; i++) {
            const vertex: any = {
              x: positions[i * 3],
              y: positions[i * 3 + 1],
              z: positions[i * 3 + 2],
            };

            if (colors) {
              vertex.red = Math.round(Math.min(255, Math.max(0, colors[i * 3] * 255)));
              vertex.green = Math.round(Math.min(255, Math.max(0, colors[i * 3 + 1] * 255)));
              vertex.blue = Math.round(Math.min(255, Math.max(0, colors[i * 3 + 2] * 255)));
            }

            if (normals) {
              vertex.nx = normals[i * 3];
              vertex.ny = normals[i * 3 + 1];
              vertex.nz = normals[i * 3 + 2];
            }

            vertices.push(vertex);
          }

          // Get indices if available
          if (primitive.indices !== undefined) {
            const indices = this.getAccessorData(
              gltfJson,
              primitive.indices,
              binaryData,
              timingCallback
            );
            if (indices) {
              for (let i = 0; i < indices.length; i += 3) {
                faces.push({
                  indices: [
                    vertexOffset + indices[i],
                    vertexOffset + indices[i + 1],
                    vertexOffset + indices[i + 2],
                  ],
                });
              }
            }
          }
        }
      }
    }

    const totalTime = performance.now() - startTime;
    timingCallback?.(
      `✅ GLTF: Parsing complete - ${vertices.length} vertices, ${faces.length} triangles in ${totalTime.toFixed(1)}ms`
    );

    return {
      vertices,
      faces,
      vertexCount: vertices.length,
      faceCount: faces.length,
      hasColors,
      hasNormals,
      format,
      fileName: '',
      comments,
      meshCount,
      materialCount,
    };
  }

  private getAccessorData(
    gltfJson: any,
    accessorIndex: number,
    binaryData: Uint8Array | null,
    timingCallback?: (message: string) => void
  ): Float32Array | Uint16Array | Uint32Array | null {
    const accessor = gltfJson.accessors[accessorIndex];
    if (!accessor) {
      console.warn(`GLTF: Accessor ${accessorIndex} not found`);
      return null;
    }

    if (accessor.bufferView === undefined) {
      console.warn(`GLTF: Accessor ${accessorIndex} has no bufferView`);
      return null;
    }

    const bufferView = gltfJson.bufferViews[accessor.bufferView];
    if (!bufferView) {
      console.warn(`GLTF: BufferView ${accessor.bufferView} not found`);
      return null;
    }

    if (!gltfJson.buffers || !gltfJson.buffers[bufferView.buffer]) {
      console.warn(
        `GLTF: Buffer ${bufferView.buffer} not found - this GLTF file is missing buffer data`
      );
      return null;
    }

    const buffer = gltfJson.buffers[bufferView.buffer];

    let bufferData: Uint8Array | null = binaryData;

    // Handle inline base64 data URIs
    if (!bufferData && buffer.uri && buffer.uri.startsWith('data:')) {
      try {
        const base64Match = buffer.uri.match(/^data:[^;]+;base64,(.*)$/);
        if (base64Match) {
          const base64Data = base64Match[1];
          const binaryString = atob(base64Data);
          bufferData = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bufferData[i] = binaryString.charCodeAt(i);
          }
          timingCallback?.(`📦 GLTF: Decoded ${bufferData.length} bytes from base64 data URI`);
        }
      } catch (error) {
        console.warn('GLTF: Failed to decode base64 buffer data:', error);
        return null;
      }
    }

    // For GLTF with external buffer files (not implemented)
    if (!bufferData && buffer.uri && !buffer.uri.startsWith('data:')) {
      console.warn('GLTF: External buffer references not supported in GLTF parser');
      return null;
    }

    if (!bufferData) {
      console.warn('GLTF: No binary data available for buffer access');
      return null;
    }

    const byteOffset = (bufferView.byteOffset || 0) + (accessor.byteOffset || 0);
    const componentType = accessor.componentType;
    const count = accessor.count;
    const type = accessor.type;

    let componentsPerElement = 1;
    switch (type) {
      case 'SCALAR':
        componentsPerElement = 1;
        break;
      case 'VEC2':
        componentsPerElement = 2;
        break;
      case 'VEC3':
        componentsPerElement = 3;
        break;
      case 'VEC4':
        componentsPerElement = 4;
        break;
      case 'MAT2':
        componentsPerElement = 4;
        break;
      case 'MAT3':
        componentsPerElement = 9;
        break;
      case 'MAT4':
        componentsPerElement = 16;
        break;
    }

    const totalComponents = count * componentsPerElement;
    const dataView = new DataView(bufferData.buffer, bufferData.byteOffset + byteOffset);

    switch (componentType) {
      case 5120: // BYTE
        const byteArray = new Int8Array(totalComponents);
        for (let i = 0; i < totalComponents; i++) {
          byteArray[i] = dataView.getInt8(i);
        }
        return new Float32Array(byteArray);

      case 5121: // UNSIGNED_BYTE
        const ubyteArray = new Uint8Array(totalComponents);
        for (let i = 0; i < totalComponents; i++) {
          ubyteArray[i] = dataView.getUint8(i);
        }
        return new Float32Array(ubyteArray);

      case 5122: // SHORT
        const shortArray = new Int16Array(totalComponents);
        for (let i = 0; i < totalComponents; i++) {
          shortArray[i] = dataView.getInt16(i * 2, true);
        }
        return new Float32Array(shortArray);

      case 5123: // UNSIGNED_SHORT
        const ushortArray = new Uint16Array(totalComponents);
        for (let i = 0; i < totalComponents; i++) {
          ushortArray[i] = dataView.getUint16(i * 2, true);
        }
        return ushortArray;

      case 5125: // UNSIGNED_INT
        const uintArray = new Uint32Array(totalComponents);
        for (let i = 0; i < totalComponents; i++) {
          uintArray[i] = dataView.getUint32(i * 4, true);
        }
        return uintArray;

      case 5126: // FLOAT
        const floatArray = new Float32Array(totalComponents);
        for (let i = 0; i < totalComponents; i++) {
          floatArray[i] = dataView.getFloat32(i * 4, true);
        }
        return floatArray;

      default:
        console.warn(`Unsupported component type: ${componentType}`);
        return null;
    }
  }
}
