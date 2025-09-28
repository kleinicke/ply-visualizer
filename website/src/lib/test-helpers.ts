// Test helpers for point cloud loading tests

// Mock Three.js objects for testing
export function createThreeObjectFromData(data: any): any {
  if (!data.vertices || data.vertices.length === 0) {
    return null;
  }

  // Simulate the geometry creation
  const geometry = {
    type: 'BufferGeometry',
    attributes: {
      position: { array: new Float32Array(data.vertices.length * 3), itemSize: 3 },
      color: data.hasColors
        ? { array: new Float32Array(data.vertices.length * 3), itemSize: 3 }
        : null,
      normal: data.hasNormals
        ? { array: new Float32Array(data.vertices.length * 3), itemSize: 3 }
        : null,
    },
  };

  // Simulate the material creation
  let material;
  if (data.faces && data.faces.length > 0) {
    material = {
      type: 'MeshLambertMaterial',
      vertexColors: !!data.hasColors,
      color: data.hasColors ? 0xffffff : 0x888888,
    };

    return {
      type: 'Mesh',
      geometry,
      material,
    };
  } else {
    material = {
      type: 'PointsMaterial',
      size: 0.01,
      vertexColors: !!data.hasColors,
      color: data.hasColors ? 0xffffff : 0x888888,
    };

    return {
      type: 'Points',
      geometry,
      material,
    };
  }
}

// Helper to validate point cloud data structure
export function validatePointCloudData(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.vertices || !Array.isArray(data.vertices)) {
    errors.push('Missing or invalid vertices array');
    return { valid: false, errors };
  }

  if (data.vertices.length === 0) {
    errors.push('Empty vertices array');
    return { valid: false, errors };
  }

  // Check vertex structure
  for (let i = 0; i < Math.min(data.vertices.length, 100); i++) {
    // Sample first 100 vertices
    const vertex = data.vertices[i];

    if (
      typeof vertex.x !== 'number' ||
      typeof vertex.y !== 'number' ||
      typeof vertex.z !== 'number'
    ) {
      errors.push(`Vertex ${i}: Missing or invalid x,y,z coordinates`);
    }

    if (!isFinite(vertex.x) || !isFinite(vertex.y) || !isFinite(vertex.z)) {
      errors.push(`Vertex ${i}: Non-finite coordinates (NaN or Infinity)`);
    }

    if (data.hasColors) {
      if (vertex.red === undefined || vertex.green === undefined || vertex.blue === undefined) {
        errors.push(`Vertex ${i}: Missing color data`);
      } else if (
        vertex.red < 0 ||
        vertex.red > 255 ||
        vertex.green < 0 ||
        vertex.green > 255 ||
        vertex.blue < 0 ||
        vertex.blue > 255
      ) {
        errors.push(`Vertex ${i}: Invalid color values (should be 0-255)`);
      }
    }

    if (data.hasNormals) {
      if (vertex.nx === undefined || vertex.ny === undefined || vertex.nz === undefined) {
        errors.push(`Vertex ${i}: Missing normal data`);
      } else {
        const normalLength = Math.sqrt(
          vertex.nx * vertex.nx + vertex.ny * vertex.ny + vertex.nz * vertex.nz
        );
        if (normalLength < 0.1 || normalLength > 2.0) {
          // Allow some tolerance
          errors.push(`Vertex ${i}: Invalid normal length (${normalLength})`);
        }
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

// Helper to create test data that matches the actual PLY file structure
export function createSamplePlyData() {
  return {
    type: 'fileData',
    fileName: 'sample_pointcloud.ply',
    vertices: [
      { x: 1.0, y: 1.0, z: 0.0, nx: 0.0, ny: 0.0, nz: 1.0, red: 255, green: 255, blue: 255 },
      { x: -1.0, y: 1.0, z: 0.0, nx: 0.0, ny: 0.0, nz: 1.0, red: 255, green: 255, blue: 255 },
      { x: -1.0, y: -1.0, z: 0.0, nx: 0.0, ny: 0.0, nz: 1.0, red: 255, green: 255, blue: 255 },
      { x: 1.0, y: -1.0, z: 0.0, nx: 0.0, ny: 0.0, nz: 1.0, red: 255, green: 255, blue: 255 },
    ],
    faces: [] as any[],
    hasColors: true,
    hasNormals: true,
    vertexCount: 4,
    faceCount: 0,
    format: 'binary_little_endian',
    version: '1.0',
    comments: ['Created by Open3D'],
  };
}
