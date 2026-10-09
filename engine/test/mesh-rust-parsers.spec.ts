import { expect, test, type Page } from '@playwright/test';

/**
 * STL, OFF and OBJ are decoded by the Rust crate into packed buffers.
 *
 * The TypeScript parsers they replace built one object per triangle or vertex;
 * the extension posted those to the webview as JSON, which took 20 s for a
 * two-million-face OBJ and failed outright for a two-million-triangle STL.
 * These tests pin what the viewer used to build from the object form - welded
 * STL corners with first-facet normals, fan-triangulated polygons, OBJ
 * material groups - so the faster path cannot quietly change the geometry.
 */

async function load(page: Page, name: string, buffer: Buffer) {
  await page.goto('/');
  await page.waitForSelector('#three-canvas');
  await page.locator('#hiddenFileInput').setInputFiles({
    name,
    mimeType: 'application/octet-stream',
    buffer,
  });
  await expect(page.locator('#file-list .file-item')).toHaveCount(1, { timeout: 10_000 });
}

function loaded(page: Page) {
  return page.evaluate(() => {
    const viewer = (window as any).visualizer;
    const file = viewer.spatialFiles[0];
    const geometry = viewer.meshes[0].geometry;
    return {
      fileName: file.fileName as string,
      vertexCount: file.vertexCount as number,
      faceCount: file.faceCount as number,
      hasColors: !!file.hasColors,
      hasNormals: !!file.hasNormals,
      positions: Array.from((file.positionsArray as Float32Array) ?? []),
      normals: Array.from((file.normalsArray as Float32Array) ?? []),
      colors: Array.from((file.colorsArray as Uint8Array) ?? []),
      indices: Array.from(geometry.index?.array ?? []),
      geometryHasNormals: !!geometry.getAttribute('normal'),
    };
  });
}

function binaryStl(facets: { normal: number[]; corners: number[][]; attribute?: number }[]) {
  const out = Buffer.alloc(84 + facets.length * 50);
  out.write('generated', 0);
  out.writeUInt32LE(facets.length, 80);
  facets.forEach((facet, i) => {
    const at = 84 + i * 50;
    [...facet.normal, ...facet.corners.flat()].forEach((v, k) => out.writeFloatLE(v, at + k * 4));
    out.writeUInt16LE(facet.attribute ?? 0, at + 48);
  });
  return out;
}

test('binary STL: shared corners are welded and keep their first facet normal', async ({
  page,
}) => {
  const a = [0, 0, 0];
  const b = [1, 0, 0];
  const c = [0, 1, 0];
  const d = [1, 1, 0];
  await load(
    page,
    'quad.stl',
    binaryStl([
      { normal: [0, 0, 1], corners: [a, b, c] },
      // RGB565 pure red on the second facet only.
      { normal: [0, 0, -1], corners: [b, d, c], attribute: 0xf800 },
    ])
  );
  const file = await loaded(page);
  // The standalone page lists an STL under its own name (the extension
  // renames it to `quad_mesh.ply`).
  expect(file.fileName).toBe('quad.stl');
  expect(file.vertexCount).toBe(4);
  expect(file.faceCount).toBe(2);
  expect(file.indices).toEqual([0, 1, 2, 1, 3, 2]);
  // d is the only corner the second facet introduces.
  expect(file.normals.slice(9, 12)).toEqual([0, 0, -1]);
  expect(file.colors).toEqual([180, 180, 180, 180, 180, 180, 180, 180, 180, 248, 0, 0]);
  expect(file.geometryHasNormals).toBe(true);
});

test('ASCII STL: facets parse and an empty solid loads as an empty mesh', async ({ page }) => {
  const facet = (z: number) =>
    `facet normal 0 0 1\nouter loop\nvertex 0 0 ${z}\nvertex 1 0 ${z}\nvertex 0 1 ${z}\nendloop\nendfacet\n`;
  await load(page, 'two.stl', Buffer.from(`solid two\n${facet(0)}${facet(1)}endsolid two\n`));
  const file = await loaded(page);
  expect(file.vertexCount).toBe(6);
  expect(file.faceCount).toBe(2);
  expect(file.positions.slice(9, 12)).toEqual([0, 0, 1]);

  await load(page, 'empty.stl', Buffer.from('solid empty\nendsolid empty\n'));
  const empty = await loaded(page);
  expect(empty.fileName).toBe('empty_empty.ply');
  expect(empty.vertexCount).toBe(0);
});

test('OFF: polygons fan-triangulate and COFF colours reach the geometry', async ({ page }) => {
  await load(
    page,
    'quad.off',
    Buffer.from(
      'COFF\n4 1 0\n0 0 0 255 0 0\n1 0 0 0 255 0\n1 1 0 0 0 255\n0 1 0 9 9 9\n4 0 1 2 3\n'
    )
  );
  const file = await loaded(page);
  expect(file.faceCount).toBe(2);
  expect(file.indices).toEqual([0, 1, 2, 0, 2, 3]);
  expect(file.hasColors).toBe(true);
  expect(file.colors).toEqual([255, 0, 0, 0, 255, 0, 0, 0, 255, 9, 9, 9]);
  // No normals in the file, so the mesh computes its own for lighting.
  expect(file.geometryHasNormals).toBe(true);
});

test('OBJ: material groups, polylines and relative indices', async ({ page }) => {
  await load(
    page,
    'groups.obj',
    Buffer.from(
      [
        'v 0 0 0',
        'v 1 0 0',
        'v 1 1 0',
        'v 0 1 0',
        'usemtl red',
        'f 1 2 3 4',
        'usemtl blue',
        'f -4 -2 -1',
        'l 1 2 3',
        '',
      ].join('\n')
    )
  );
  const state = await page.evaluate(() => {
    const viewer = (window as any).visualizer;
    const file = viewer.spatialFiles[0];
    const groups = file.objData.materialGroups.map((g: any) => ({
      material: g.material,
      faces: Array.from(g.faces),
      lines: Array.from(g.lines),
    }));
    const subMeshes = viewer.fileEntries.require(0).resources.materialMeshes.map((m: any) => ({
      type: m.type,
      material: m.materialName,
      vertices: m.geometry.getAttribute('position').count,
    }));
    return { faceCount: file.faceCount, groups, subMeshes };
  });
  // A quad and a triangle: three triangles on the GPU.
  expect(state.faceCount).toBe(3);
  expect(state.groups).toEqual([
    { material: 'blue', faces: [1], lines: [0, 1] },
    { material: 'red', faces: [0], lines: [] },
  ]);
  expect(state.groups.length).toBe(2);
  // The quad keeps its four corners in its sub-mesh; the polyline is two segments.
  expect(state.subMeshes).toEqual([
    { type: 'Mesh', material: 'blue', vertices: 3 },
    { type: 'LineSegments', material: 'blue', vertices: 4 },
    { type: 'Mesh', material: 'red', vertices: 4 },
  ]);
});

test('PLY export writes the faces of a packed mesh', async ({ page }) => {
  await load(page, 'tri.off', Buffer.from('OFF\n3 1 0\n0 0 0\n1 0 0\n0 1 0\n3 0 1 2\n'));
  const exported = await page.evaluate(() => {
    const viewer = (window as any).visualizer;
    let content = '';
    viewer.vscode.postMessage = (message: any) => {
      if (message.type === 'savePlyFile') {
        content = message.content;
      }
    };
    viewer.savePlyFile(0);
    return content;
  });
  expect(exported).toContain('element face 1');
  expect(exported.trim().split('\n').pop()).toBe('3 0 1 2');
});

test('PLY: polygon faces fan-triangulate instead of losing corners', async ({ page }) => {
  const header = [
    'ply',
    'format ascii 1.0',
    'element vertex 4',
    'property float x',
    'property float y',
    'property float z',
    'element face 1',
    'property list uchar int vertex_indices',
    'end_header',
  ].join('\n');
  await load(page, 'quad.ply', Buffer.from(`${header}\n0 0 0\n1 0 0\n1 1 0\n0 1 0\n4 0 1 2 3\n`));
  const file = await loaded(page);
  expect(file.faceCount).toBe(2);
  expect(file.indices).toEqual([0, 1, 2, 0, 2, 3]);
});

test('normals of a packed point cloud are built on first toggle, in the file frame', async ({
  page,
}) => {
  await load(page, 'normals.xyzn', Buffer.from('0 0 0 0 0 1\n1 0 0 0 1 0\n2 0 0 1 0 0\n'));
  const state = await page.evaluate(() => {
    const viewer = (window as any).visualizer;
    const entry = viewer.fileEntries.require(0);
    const before = entry.resources.normals;
    entry.transform.makeTranslation(5, 0, 0);
    viewer.applyTransformationMatrix(0);
    viewer.toggleNormalsRendering(0);
    const normals = entry.resources.normals;
    return {
      before: before ?? null,
      segments: normals.geometry.getAttribute('position').count / 2,
      firstTip: Array.from(normals.geometry.getAttribute('position').array.slice(3, 6)),
      offset: normals.matrix.elements[12],
      visible: normals.visible,
    };
  });
  expect(state.before).toBeNull();
  expect(state.segments).toBe(3);
  expect(state.firstTip[2]).toBeCloseTo(0.1, 6);
  expect(state.offset).toBe(5);
  expect(state.visible).toBe(true);
});
