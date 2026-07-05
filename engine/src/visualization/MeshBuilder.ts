import * as THREE from 'three';
import { SpatialData } from '../interfaces';

export interface MeshBuilderHost {
  individualColorModes: string[];
  convertSrgbToLinear: boolean;
  colorProcessor: { ensureSrgbLUT(): Float32Array };
  applyColorModeToGeometry(
    data: SpatialData,
    geometry: THREE.BufferGeometry,
    colorMode: string
  ): void;
}

/**
 * Builds a THREE.BufferGeometry from parsed point cloud / mesh data. Returns
 * the geometry plus how long it took to build (callers use this for the perf
 * readout main.ts already surfaces).
 */
export function createGeometryFromSpatialData(
  host: MeshBuilderHost,
  data: SpatialData
): { geometry: THREE.BufferGeometry; geometryMs: number } {
  const geometry = new THREE.BufferGeometry();

  const startTime = performance.now();

  // Point clouds (no faces) are drawn with PointsMaterial, which never uses
  // normals (points aren't lit, and EDL works off depth). Uploading a normal
  // attribute for them just wastes ~12 bytes/point of VRAM — significant when
  // many large clouds are open at once. So only attach normals for MESHES;
  // the CPU normals stay in spatialData for PLY export, and the
  // normal-visualization tool is mesh-only anyway.
  const isMesh = (data.faces?.length || 0) > 0 || (data.faceCount || 0) > 0;

  // Check if we have direct TypedArrays (new ultra-fast path)
  if ((data as any).useTypedArrays) {
    const positions = (data as any).positionsArray as Float32Array;
    const normals = (data as any).normalsArray as Float32Array | null;

    // Direct assignment - zero copying, zero processing!
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    // NOTE: the 'color' attribute is intentionally NOT built here. The
    // unconditional applyColorModeToGeometry() call below fully determines the
    // final color attribute for every mode (original/intensity rebuild it,
    // assigned deletes it), so building it here was a redundant full-size
    // Float32 allocation + per-channel loop on every colored load.

    if (normals && data.hasNormals && isMesh) {
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    }
  } else {
    // Fallback to traditional vertex object processing
    const vertexCount = data.vertices.length;

    // Pre-allocate typed arrays for better performance
    const vertices = new Float32Array(vertexCount * 3);
    const colors = data.hasColors ? new Float32Array(vertexCount * 3) : null;
    const normals = data.hasNormals ? new Float32Array(vertexCount * 3) : null;

    // Optimized vertex processing - batch operations
    const vertexArray = data.vertices;
    for (let i = 0, i3 = 0; i < vertexCount; i++, i3 += 3) {
      const vertex = vertexArray[i];

      // Position data (required)
      vertices[i3] = vertex.x;
      vertices[i3 + 1] = vertex.y;
      vertices[i3 + 2] = vertex.z;

      // Color data (optional)
      if (colors && vertex.red !== undefined) {
        const r8 = (vertex.red || 0) & 255;
        const g8 = (vertex.green || 0) & 255;
        const b8 = (vertex.blue || 0) & 255;
        if (host.convertSrgbToLinear) {
          const lut = host.colorProcessor.ensureSrgbLUT();
          colors[i3] = lut[r8];
          colors[i3 + 1] = lut[g8];
          colors[i3 + 2] = lut[b8];
        } else {
          colors[i3] = r8 / 255;
          colors[i3 + 1] = g8 / 255;
          colors[i3 + 2] = b8 / 255;
        }
      }

      // Normal data (optional)
      if (normals && vertex.nx !== undefined) {
        normals[i3] = vertex.nx;
        normals[i3 + 1] = vertex.ny || 0;
        normals[i3 + 2] = vertex.nz || 0;
      }
    }

    // Set attributes
    geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));

    if (colors) {
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }

    if (normals && isMesh) {
      geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    }
  }

  const colorMode =
    data.fileIndex !== undefined
      ? host.individualColorModes[data.fileIndex] || 'assigned'
      : 'assigned';
  host.applyColorModeToGeometry(data, geometry, colorMode);

  // Optimized face processing
  if (data.faces.length > 0) {
    // Estimate index count for pre-allocation
    let estimatedIndexCount = 0;
    for (const face of data.faces) {
      if (face.indices.length >= 3) {
        estimatedIndexCount += (face.indices.length - 2) * 3;
      }
    }

    const indices = new Uint32Array(estimatedIndexCount);
    let indexOffset = 0;

    for (const face of data.faces) {
      if (face.indices.length >= 3) {
        // Optimized fan triangulation
        const faceIndices = face.indices;
        const firstIndex = faceIndices[0];

        for (let i = 1; i < faceIndices.length - 1; i++) {
          indices[indexOffset++] = firstIndex;
          indices[indexOffset++] = faceIndices[i];
          indices[indexOffset++] = faceIndices[i + 1];
        }
      }
    }

    if (indexOffset > 0) {
      // Trim array if we over-estimated
      const finalIndices = indexOffset < indices.length ? indices.slice(0, indexOffset) : indices;
      geometry.setIndex(new THREE.BufferAttribute(finalIndices, 1));
    }
  }

  // Ensure normals are available for proper lighting after indices are set
  if (!geometry.getAttribute('normal') && data.faces.length > 0) {
    geometry.computeVertexNormals();
  }

  geometry.computeBoundingBox();

  const endTime = performance.now();
  const geometryMs = +(endTime - startTime).toFixed(1);
  console.log(`Render: geometry ${geometryMs}ms`);

  return { geometry, geometryMs };
}
