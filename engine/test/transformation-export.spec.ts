import { expect, test } from '@playwright/test';
import * as THREE from 'three';
import { SpatialData } from '../src/interfaces';
import { generatePlyFileContent } from '../src/plyExport';

test('PLY export applies the current object transform', () => {
  const data: SpatialData = {
    vertices: [{ x: 1, y: 2, z: 3 }],
    faces: [],
    format: 'ascii',
    version: '1.0',
    comments: [],
    vertexCount: 1,
    faceCount: 0,
    hasColors: false,
    hasNormals: false,
    fileName: 'transformed.ply',
  };
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([1, 2, 3]), 3));
  const points = new THREE.Points(geometry, new THREE.PointsMaterial());
  points.matrixAutoUpdate = false;
  points.matrix.makeTranslation(3, -4, 5);
  points.matrixWorldNeedsUpdate = true;

  const content = generatePlyFileContent(
    {
      spatialFiles: [data],
      meshes: [points],
      vscode: { postMessage: () => undefined },
      showStatus: () => undefined,
      showError: () => undefined,
    },
    data,
    0
  );

  expect(content).toContain('\n4 -2 8\n');
});
