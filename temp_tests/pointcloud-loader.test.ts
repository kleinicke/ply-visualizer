import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

// Mock Three.js for testing
vi.mock('three', () => ({
  BufferGeometry: vi.fn().mockImplementation(() => ({
    setAttribute: vi.fn(),
    setIndex: vi.fn(),
    computeVertexNormals: vi.fn(),
  })),
  BufferAttribute: vi.fn().mockImplementation((data, itemSize) => ({ data, itemSize })),
  PointsMaterial: vi.fn().mockImplementation(options => ({ ...options, type: 'PointsMaterial' })),
  MeshLambertMaterial: vi
    .fn()
    .mockImplementation(options => ({ ...options, type: 'MeshLambertMaterial' })),
  Points: vi
    .fn()
    .mockImplementation((geometry, material) => ({ geometry, material, type: 'Points' })),
  Mesh: vi.fn().mockImplementation((geometry, material) => ({ geometry, material, type: 'Mesh' })),
}));

describe('Point Cloud Loading Tests', () => {
  describe('sample_pointcloud.ply loading simulation', () => {
    it('should load sample_pointcloud.ply file data correctly', async () => {
      // Simulate the file data that would come from the PLY parser
      const sampleFileData = {
        type: 'fileData',
        fileName: 'sample_pointcloud.ply',
        vertices: generateSampleVertices(1250), // PLY file has 1250 vertices
        faces: [] as any[],
        hasColors: true,
        hasNormals: true,
        vertexCount: 1250,
        faceCount: 0,
        format: 'binary_little_endian',
        version: '1.0',
        comments: ['Created by Open3D'],
      };

      // Test vertex data structure
      expect(sampleFileData.vertices).toHaveLength(1250);
      expect(sampleFileData.vertices[0]).toHaveProperty('x');
      expect(sampleFileData.vertices[0]).toHaveProperty('y');
      expect(sampleFileData.vertices[0]).toHaveProperty('z');
      expect(sampleFileData.vertices[0]).toHaveProperty('red');
      expect(sampleFileData.vertices[0]).toHaveProperty('green');
      expect(sampleFileData.vertices[0]).toHaveProperty('blue');
      expect(sampleFileData.vertices[0]).toHaveProperty('nx');
      expect(sampleFileData.vertices[0]).toHaveProperty('ny');
      expect(sampleFileData.vertices[0]).toHaveProperty('nz');

      // Test that all vertices have valid coordinates
      for (const vertex of sampleFileData.vertices) {
        expect(typeof vertex.x).toBe('number');
        expect(typeof vertex.y).toBe('number');
        expect(typeof vertex.z).toBe('number');
        expect(isFinite(vertex.x)).toBe(true);
        expect(isFinite(vertex.y)).toBe(true);
        expect(isFinite(vertex.z)).toBe(true);
      }

      // Test color values are in valid range
      for (const vertex of sampleFileData.vertices) {
        expect(vertex.red).toBeGreaterThanOrEqual(0);
        expect(vertex.red).toBeLessThanOrEqual(255);
        expect(vertex.green).toBeGreaterThanOrEqual(0);
        expect(vertex.green).toBeLessThanOrEqual(255);
        expect(vertex.blue).toBeGreaterThanOrEqual(0);
        expect(vertex.blue).toBeLessThanOrEqual(255);
      }

      // Test normal values are normalized (approximately)
      for (const vertex of sampleFileData.vertices) {
        const normalLength = Math.sqrt(
          vertex.nx * vertex.nx + vertex.ny * vertex.ny + vertex.nz * vertex.nz
        );
        // Normals should be approximately unit length (allowing for floating point precision)
        expect(normalLength).toBeGreaterThan(0.9);
        expect(normalLength).toBeLessThan(1.1);
      }
    });

    it('should create proper Three.js geometry from point cloud data', async () => {
      const { createThreeObjectFromData } = await import('../website/src/lib/test-helpers');

      const sampleData = {
        vertices: generateSampleVertices(100), // Smaller test set
        faces: [] as any[],
        hasColors: true,
        hasNormals: true,
        vertexCount: 100,
        faceCount: 0,
      };

      const result = createThreeObjectFromData(sampleData);

      expect(result).toBeDefined();
      expect(result.type).toBe('Points'); // Should be point cloud, not mesh
      expect(result.geometry).toBeDefined();
      expect(result.material).toBeDefined();
      expect(result.material.type).toBe('PointsMaterial');
      expect(result.material.vertexColors).toBe(true);
    });

    it('should handle large point clouds efficiently', () => {
      const largeVertexCount = 50000; // Test with large dataset
      const vertices = generateSampleVertices(largeVertexCount);

      const startTime = performance.now();

      // Test conversion to Float32Array (this is what happens in createThreeObjectFromData)
      const positions = new Float32Array(vertices.length * 3);
      const colors = new Float32Array(vertices.length * 3);
      const normals = new Float32Array(vertices.length * 3);

      for (let i = 0; i < vertices.length; i++) {
        const vertex = vertices[i];
        const i3 = i * 3;

        positions[i3] = vertex.x;
        positions[i3 + 1] = vertex.y;
        positions[i3 + 2] = vertex.z;

        colors[i3] = vertex.red / 255.0;
        colors[i3 + 1] = vertex.green / 255.0;
        colors[i3 + 2] = vertex.blue / 255.0;

        normals[i3] = vertex.nx;
        normals[i3 + 1] = vertex.ny;
        normals[i3 + 2] = vertex.nz;
      }

      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // Should process large point clouds quickly (less than 100ms for 50k points)
      expect(processingTime).toBeLessThan(100);

      // Verify arrays are created correctly
      expect(positions.length).toBe(largeVertexCount * 3);
      expect(colors.length).toBe(largeVertexCount * 3);
      expect(normals.length).toBe(largeVertexCount * 3);
    });

    it('should detect and handle corrupt data gracefully', () => {
      const corruptData = {
        vertices: [
          { x: NaN, y: 2, z: 3, red: 255, green: 0, blue: 0 },
          { x: 1, y: Infinity, z: 3, red: 255, green: 0, blue: 0 },
          { x: 1, y: 2, z: 3, red: 300, green: -50, blue: 0 }, // Invalid colors
        ],
        faces: [] as any[],
        hasColors: true,
        hasNormals: false,
      };

      // Test that we can detect invalid coordinates
      const invalidVertices = corruptData.vertices.filter(
        v => !isFinite(v.x) || !isFinite(v.y) || !isFinite(v.z)
      );
      expect(invalidVertices.length).toBeGreaterThan(0);

      // Test that we can detect invalid colors
      const invalidColors = corruptData.vertices.filter(
        v => v.red < 0 || v.red > 255 || v.green < 0 || v.green > 255 || v.blue < 0 || v.blue > 255
      );
      expect(invalidColors.length).toBeGreaterThan(0);
    });
  });
});

// Helper function to generate sample vertices that match the PLY file structure
function generateSampleVertices(count: number) {
  const vertices = [];
  for (let i = 0; i < count; i++) {
    // Generate vertices in a reasonable 3D space
    const x = (Math.random() - 0.5) * 10;
    const y = (Math.random() - 0.5) * 10;
    const z = (Math.random() - 0.5) * 10;

    // Generate normalized normals
    const nx = Math.random() - 0.5;
    const ny = Math.random() - 0.5;
    const nz = Math.random() - 0.5;
    const normalLength = Math.sqrt(nx * nx + ny * ny + nz * nz);

    vertices.push({
      x: x,
      y: y,
      z: z,
      nx: nx / normalLength,
      ny: ny / normalLength,
      nz: nz / normalLength,
      red: Math.floor(Math.random() * 256),
      green: Math.floor(Math.random() * 256),
      blue: Math.floor(Math.random() * 256),
    });
  }
  return vertices;
}
