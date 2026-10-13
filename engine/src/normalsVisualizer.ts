import * as THREE from 'three';
import { SpatialData } from './interfaces';

/** True when the file carries its own per-vertex normals on the CPU side. */
export function hasCpuNormals(data: SpatialData): boolean {
  return data.hasNormals && (!!data.normalsArray || data.vertices.length > 0);
}

/**
 * Line segments from each vertex along its stored normal.
 *
 * Reads the packed `normalsArray` when the parser produced one - which every
 * Rust-decoded format does - and the legacy vertex objects otherwise. Built
 * on demand when the user first shows normals, never during a load: normals
 * start hidden, and for a large cloud this is two extra vertices per point.
 */
export function createNormalsVisualizer(data: SpatialData): THREE.LineSegments {
  const normalLength = 0.1; // Controls how long the normal lines are
  const typed = data.normalsArray && data.positionsArray;
  const count = typed ? data.positionsArray!.length / 3 : data.vertices.length;
  const segments = new Float32Array(count * 6);
  let written = 0;
  if (typed) {
    const positions = data.positionsArray!;
    const normals = data.normalsArray!;
    // Packed point-cloud normals are snorm16 (utils/normals.ts).
    const length = normals instanceof Int16Array ? normalLength / 32767 : normalLength;
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];
      segments[written++] = x;
      segments[written++] = y;
      segments[written++] = z;
      segments[written++] = x + normals[i] * length;
      segments[written++] = y + normals[i + 1] * length;
      segments[written++] = z + normals[i + 2] * length;
    }
  } else {
    for (const p of data.vertices) {
      if (p.nx === undefined || p.ny === undefined || p.nz === undefined) {
        continue;
      }
      segments[written++] = p.x;
      segments[written++] = p.y;
      segments[written++] = p.z;
      segments[written++] = p.x + p.nx * normalLength;
      segments[written++] = p.y + p.ny * normalLength;
      segments[written++] = p.z + p.nz * normalLength;
    }
  }

  const normalsGeometry = new THREE.BufferGeometry();
  normalsGeometry.setAttribute(
    'position',
    new THREE.BufferAttribute(written < segments.length ? segments.slice(0, written) : segments, 3)
  );
  const normalsMaterial = new THREE.LineBasicMaterial({ color: new THREE.Color(0x00ffff) });

  const normalsVisualizer = new THREE.LineSegments(normalsGeometry, normalsMaterial);
  normalsVisualizer.name = 'Normals';
  return normalsVisualizer;
}

export function createComputedNormalsVisualizer(
  data: SpatialData,
  mesh: THREE.Object3D
): THREE.LineSegments | null {
  // Compute normals from the mesh geometry for triangle meshes
  console.log(
    `🔧 createComputedNormalsVisualizer for ${data.fileName}: faceCount=${data.faceCount}, meshType=${mesh?.type}`
  );

  if (!mesh) {
    console.log('❌ No mesh provided');
    return null;
  }

  const normalsGeometry = new THREE.BufferGeometry();
  const lines = [];
  const normalLength = 0.1;
  const normalColor = new THREE.Color(0x00ffff); // Cyan color for visibility

  // Get the mesh geometry
  let geometry: THREE.BufferGeometry | null = null;
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

  if (!geometry) {
    console.log('❌ No geometry found in mesh');
    return null;
  }

  console.log(`📐 Found geometry with ${geometry.attributes.position?.count || 0} vertices`);

  // Ensure normals are computed
  if (!geometry.attributes.normal) {
    console.log('🔄 Computing vertex normals...');
    geometry.computeVertexNormals();
  } else {
    console.log('✅ Geometry already has normals');
  }

  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;

  if (!positions || !normals) {
    console.log('❌ Missing position or normal attributes');
    return null;
  }

  // Create normal lines from vertices
  const vertexCount = positions.count;
  for (let i = 0; i < vertexCount; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);

    const nx = normals.getX(i);
    const ny = normals.getY(i);
    const nz = normals.getZ(i);

    const start = new THREE.Vector3(x, y, z);
    const end = new THREE.Vector3(
      x + nx * normalLength,
      y + ny * normalLength,
      z + nz * normalLength
    );
    lines.push(start, end);
  }

  console.log(`✅ Created ${lines.length / 2} normal lines for ${data.fileName}`);

  normalsGeometry.setFromPoints(lines);
  const normalsMaterial = new THREE.LineBasicMaterial({ color: normalColor });

  const normalsVisualizer = new THREE.LineSegments(normalsGeometry, normalsMaterial);
  normalsVisualizer.name = 'Computed Normals';
  return normalsVisualizer;
}

export function createPointCloudNormalsVisualizer(
  data: SpatialData,
  mesh: THREE.Object3D
): THREE.LineSegments | null {
  // Extract normals from Three.js Points geometry for point clouds
  console.log(`🔧 createPointCloudNormalsVisualizer for ${data.fileName}`);

  if (!mesh || mesh.type !== 'Points') {
    console.log('❌ Not a point cloud mesh');
    return null;
  }

  const geometry = (mesh as THREE.Points).geometry as THREE.BufferGeometry;
  if (!geometry) {
    console.log('❌ No geometry found');
    return null;
  }

  const positions = geometry.attributes.position;
  const normals = geometry.attributes.normal;

  if (!positions) {
    console.log('❌ No position attributes');
    return null;
  }

  if (!normals) {
    console.log('❌ No normal attributes in point cloud geometry');
    return null;
  }

  console.log(`📐 Found point cloud with ${positions.count} points and normals`);

  const normalsGeometry = new THREE.BufferGeometry();
  const lines = [];
  const normalLength = 0.1;
  const normalColor = new THREE.Color(0x00ffff); // Cyan color for visibility

  // Create normal lines from point cloud vertices
  const vertexCount = positions.count;
  for (let i = 0; i < vertexCount; i++) {
    const x = positions.getX(i);
    const y = positions.getY(i);
    const z = positions.getZ(i);

    const nx = normals.getX(i);
    const ny = normals.getY(i);
    const nz = normals.getZ(i);

    const start = new THREE.Vector3(x, y, z);
    const end = new THREE.Vector3(
      x + nx * normalLength,
      y + ny * normalLength,
      z + nz * normalLength
    );
    lines.push(start, end);
  }

  console.log(`✅ Created ${lines.length / 2} normal lines for point cloud ${data.fileName}`);

  normalsGeometry.setFromPoints(lines);
  const normalsMaterial = new THREE.LineBasicMaterial({ color: normalColor });

  const normalsVisualizer = new THREE.LineSegments(normalsGeometry, normalsMaterial);
  normalsVisualizer.name = 'Point Cloud Normals';
  return normalsVisualizer;
}
