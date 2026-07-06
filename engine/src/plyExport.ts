import * as THREE from 'three';
import { SpatialData } from './interfaces';

export interface PlyExportHost {
  spatialFiles: SpatialData[];
  meshes: (THREE.Mesh | THREE.Points | THREE.LineSegments)[];
  vscode: { postMessage(message: any): void };
  showStatus(message: string): void;
  showError(message: string): void;
}

export function savePlyFile(host: PlyExportHost, fileIndex: number): void {
  try {
    if (fileIndex < 0 || fileIndex >= host.spatialFiles.length) {
      throw new Error('Invalid file index');
    }

    const spatialData = host.spatialFiles[fileIndex];
    host.showStatus(`Generating PLY file for ${spatialData.fileName}...`);

    // Generate PLY file content with current state (including transformations and colors)
    const plyContent = generatePlyFileContent(host, spatialData, fileIndex);

    // Use VS Code save dialog instead of automatic download
    const defaultFileName = spatialData.fileName || `pointcloud_${fileIndex + 1}.ply`;

    host.vscode.postMessage({
      type: 'savePlyFile',
      content: plyContent,
      defaultFileName: defaultFileName,
      fileIndex: fileIndex,
    });

    host.showStatus(`Opening save dialog for ${defaultFileName}...`);
  } catch (error) {
    console.error('Error preparing PLY file:', error);
    host.showError(
      `Failed to prepare PLY file: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export function generatePlyFileContent(
  host: PlyExportHost,
  spatialData: SpatialData,
  fileIndex: number
): string {
  // Get current transformed vertices from the actual geometry
  const mesh = host.meshes[fileIndex];
  const geometry = mesh.geometry as THREE.BufferGeometry;
  const positionAttribute = geometry.getAttribute('position') as THREE.BufferAttribute;
  const colorAttribute = geometry.getAttribute('color') as THREE.BufferAttribute;

  const vertexCount = positionAttribute.count;

  // PLY header
  let content = 'ply\n';
  content += `format ascii 1.0\n`;

  // Add comments including transformation info
  content += `comment Generated from ${spatialData.fileName || 'point cloud'}\n`;
  content += `comment Coordinate system: OpenGL (Y-up, Z-backward)\n`;
  if (spatialData.comments.length > 0) {
    spatialData.comments.forEach(comment => {
      content += `comment ${comment}\n`;
    });
  }

  // Vertex element definition
  content += `element vertex ${vertexCount}\n`;
  content += 'property float x\n';
  content += 'property float y\n';
  content += 'property float z\n';

  const hasColors = !!colorAttribute;
  if (hasColors) {
    content += 'property uchar red\n';
    content += 'property uchar green\n';
    content += 'property uchar blue\n';
  }

  if (spatialData.hasNormals) {
    content += 'property float nx\n';
    content += 'property float ny\n';
    content += 'property float nz\n';
  }

  // Face element definition (if any)
  if (spatialData.faceCount > 0) {
    content += `element face ${spatialData.faceCount}\n`;
    content += 'property list uchar int vertex_indices\n';
  }

  content += 'end_header\n';

  // Point-cloud colors are stored as raw 8-bit sRGB (Uint8); mesh/intensity
  // colors as Float32 [0,1]. Scale accordingly so export matches what's shown.
  const colorIsByte =
    hasColors &&
    (colorAttribute.array instanceof Uint8Array ||
      colorAttribute.array instanceof Uint8ClampedArray);
  const colorScale = colorIsByte ? 1 : 255;

  // Vertex data from current geometry (includes transformations)
  for (let i = 0; i < vertexCount; i++) {
    const i3 = i * 3;
    const x = positionAttribute.array[i3];
    const y = positionAttribute.array[i3 + 1];
    const z = positionAttribute.array[i3 + 2];

    content += `${x} ${y} ${z}`;

    if (hasColors) {
      const r = Math.round(colorAttribute.array[i3] * colorScale);
      const g = Math.round(colorAttribute.array[i3 + 1] * colorScale);
      const b = Math.round(colorAttribute.array[i3 + 2] * colorScale);
      content += ` ${r} ${g} ${b}`;
    }

    if (spatialData.hasNormals && spatialData.vertices[i]) {
      const vertex = spatialData.vertices[i];
      content += ` ${vertex.nx || 0} ${vertex.ny || 0} ${vertex.nz || 0}`;
    }

    content += '\n';
  }

  // Face data (if any) - these don't change with transformations
  spatialData.faces.forEach(face => {
    content += `${face.indices.length}`;
    face.indices.forEach(index => {
      content += ` ${index}`;
    });
    content += '\n';
  });

  return content;
}
