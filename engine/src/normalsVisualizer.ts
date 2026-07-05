import * as THREE from 'three';
import { SpatialData } from './interfaces';

export function createNormalsVisualizer(data: SpatialData): THREE.LineSegments {
  const normalsGeometry = new THREE.BufferGeometry();
  const lines = [];
  const normalLength = 0.1; // Controls how long the normal lines are
  const normalColor = new THREE.Color(0x00ffff); // Cyan color for visibility

  console.log(
    `🔍 Creating normals visualizer for ${data.fileName}: hasNormals=${data.hasNormals}, vertices=${data.vertices.length}`
  );

  let validNormals = 0;
  for (const p of data.vertices) {
    if (p.nx === undefined || p.ny === undefined || p.nz === undefined) {
      // Debug first few vertices to see what properties they have
      if (validNormals === 0) {
        console.log(`❌ Vertex missing normals:`, Object.keys(p), p);
      }
      continue;
    }
    validNormals++;
    if (validNormals === 1) {
      console.log(`✅ Found vertex with normals:`, { nx: p.nx, ny: p.ny, nz: p.nz }, p);
    }

    const start = new THREE.Vector3(p.x, p.y, p.z);
    const end = new THREE.Vector3(
      p.x + p.nx * normalLength,
      p.y + p.ny * normalLength,
      p.z + p.nz * normalLength
    );
    lines.push(start, end);
  }

  console.log(
    `📊 Normals summary: ${validNormals} valid normals out of ${data.vertices.length} vertices, ${lines.length} line points`
  );

  normalsGeometry.setFromPoints(lines);

  const normalsMaterial = new THREE.LineBasicMaterial({ color: normalColor });

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
