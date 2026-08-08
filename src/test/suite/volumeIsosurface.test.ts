import * as assert from 'assert';
import * as zlib from 'zlib';
import { NrrdParser, type VolumeData } from '../../../engine/src/parsers/nrrdParser';
import {
  extractIsosurface,
  extractIsosurfaceAsync,
  chooseStep,
} from '../../../engine/src/visualization/marchingCubes';
import {
  triTable,
  edgeTable,
  edgeCorners,
} from '../../../engine/src/visualization/marchingCubesTables';
import {
  buildVolumeMesh,
  defaultThreshold,
  otsuThreshold,
  sampleRange,
} from '../../../engine/src/visualization/isosurface';
import { buildVolumePoints } from '../../../engine/src/visualization/volumePoints';
import { buildVolumeSlicesAsync } from '../../../engine/src/visualization/volumeSlices';
import {
  boundingBoxSectionPlanes,
  volumeSectionPlanes,
} from '../../../engine/src/visualization/sectionPlanes';
import * as THREE from 'three';
import { SelectionManager } from '../../../engine/src/SelectionManager';

/** Assembles an NRRD file in memory from a header block and raw sample bytes. */
function makeNrrd(headerLines: string[], payload: Uint8Array): Uint8Array {
  const header = `NRRD0004\n${headerLines.join('\n')}\n\n`;
  const headerBytes = new Uint8Array(header.length);
  for (let i = 0; i < header.length; i++) {
    headerBytes[i] = header.charCodeAt(i);
  }
  const out = new Uint8Array(headerBytes.length + payload.length);
  out.set(headerBytes);
  out.set(payload, headerBytes.length);
  return out;
}

function bytesOf(array: ArrayBufferView): Uint8Array {
  return new Uint8Array(array.buffer, array.byteOffset, array.byteLength);
}

/**
 * A ball of radius `radius` voxels, sampled as `radius - distance` so the
 * surface at threshold 0 is an exact analytic sphere. Any error in the
 * isosurface then shows up as a measurable deviation rather than as something
 * that has to be eyeballed.
 */
function makeBall(size: number, radius: number): VolumeData {
  const samples = new Float32Array(size * size * size);
  const centre = (size - 1) / 2;
  for (let k = 0; k < size; k++) {
    for (let j = 0; j < size; j++) {
      for (let i = 0; i < size; i++) {
        const distance = Math.hypot(i - centre, j - centre, k - centre);
        samples[i + j * size + k * size * size] = radius - distance;
      }
    }
  }
  return {
    sizes: [size, size, size],
    samples,
    ijkToWorld: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
    spaceUnits: 'mm',
    channels: 1,
    header: {},
  };
}

suite('NRRD parsing', () => {
  test('reads a raw little-endian volume with spacing', async () => {
    const samples = new Int16Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    const file = makeNrrd(
      [
        'type: short',
        'dimension: 3',
        'sizes: 3 2 2',
        'encoding: raw',
        'endian: little',
        'spacings: 0.5 0.5 2',
      ],
      bytesOf(samples)
    );

    const volume = await new NrrdParser().parse(file);

    assert.deepStrictEqual(volume.sizes, [3, 2, 2]);
    assert.strictEqual(volume.samples.length, 12);
    assert.strictEqual(volume.samples[0], 1);
    assert.strictEqual(volume.samples[11], 12);
    // No `space directions`, so the axis-aligned `spacings` become the affine.
    assert.strictEqual(volume.ijkToWorld[0], 0.5);
    assert.strictEqual(volume.ijkToWorld[5], 0.5);
    assert.strictEqual(volume.ijkToWorld[10], 2);
  });

  test('converts an LPS affine to RAS', async () => {
    const samples = new Uint8Array([0, 1, 2, 3, 4, 5, 6, 7]);
    const file = makeNrrd(
      [
        'type: uchar',
        'dimension: 3',
        'sizes: 2 2 2',
        'encoding: raw',
        'space: left-posterior-superior',
        'space directions: (0.7,0,0) (0,0.7,0) (0,0,1.5)',
        'space origin: (-10,-20,5)',
      ],
      samples
    );

    const volume = await new NrrdParser().parse(file);

    // x and y negate, z does not: this is what keeps a CT from loading
    // mirrored.
    assert.ok(Math.abs(volume.ijkToWorld[0] - -0.7) < 1e-9);
    assert.ok(Math.abs(volume.ijkToWorld[5] - -0.7) < 1e-9);
    assert.ok(Math.abs(volume.ijkToWorld[10] - 1.5) < 1e-9);
    assert.ok(Math.abs(volume.ijkToWorld[3] - 10) < 1e-9);
    assert.ok(Math.abs(volume.ijkToWorld[7] - 20) < 1e-9);
    assert.ok(Math.abs(volume.ijkToWorld[11] - 5) < 1e-9);
  });

  test('reads an oblique affine unchanged in a non-medical space', async () => {
    const file = makeNrrd(
      [
        'type: uchar',
        'dimension: 3',
        'sizes: 2 2 2',
        'encoding: raw',
        'space directions: (1,0.25,0) (0,1,0) (0,0,1)',
      ],
      new Uint8Array(8)
    );

    const volume = await new NrrdParser().parse(file);

    // Column 0 is the i axis, so its y component lands in row 1, column 0.
    assert.strictEqual(volume.ijkToWorld[0], 1);
    assert.strictEqual(volume.ijkToWorld[4], 0.25);
  });

  test('decodes gzip payloads', async () => {
    const samples = new Uint16Array([10, 20, 30, 40, 50, 60, 70, 80]);
    const gzipped = new Uint8Array(zlib.gzipSync(Buffer.from(bytesOf(samples))));
    const file = makeNrrd(
      ['type: ushort', 'dimension: 3', 'sizes: 2 2 2', 'encoding: gzip', 'endian: little'],
      gzipped
    );

    const volume = await new NrrdParser().parse(file);

    assert.deepStrictEqual(Array.from(volume.samples), [10, 20, 30, 40, 50, 60, 70, 80]);
  });

  test('swaps big-endian samples', async () => {
    const samples = new Uint8Array([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
    const file = makeNrrd(
      ['type: ushort', 'dimension: 3', 'sizes: 2 2 1', 'encoding: raw', 'endian: big'],
      samples
    );

    const volume = await new NrrdParser().parse(file);

    assert.strictEqual(volume.samples[0], 0x0102);
    assert.strictEqual(volume.samples[3], 0x0708);
  });

  test('reads intensity units from a key/value pair', async () => {
    const file = makeNrrd(
      ['type: uchar', 'dimension: 3', 'sizes: 2 2 2', 'encoding: raw', 'units:=HU'],
      new Uint8Array(8)
    );

    const volume = await new NrrdParser().parse(file);

    assert.strictEqual(volume.intensityUnits, 'HU');
  });

  test('infers Hounsfield units from a CT modality', async () => {
    const file = makeNrrd(
      ['type: short', 'dimension: 3', 'sizes: 2 2 2', 'encoding: raw', 'modality:=CT'],
      new Uint8Array(16)
    );

    const volume = await new NrrdParser().parse(file);

    assert.strictEqual(volume.intensityUnits, 'HU');
  });

  test('takes channel 0 of a channel-first 4D volume', async () => {
    // Two channels interleaved: channel 0 is 1,3,5..., channel 1 is 2,4,6...
    const samples = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    const file = makeNrrd(
      [
        'type: uchar',
        'dimension: 4',
        'sizes: 2 2 2 2',
        'kinds: vector domain domain domain',
        'encoding: raw',
      ],
      samples
    );

    const volume = await new NrrdParser().parse(file);

    assert.strictEqual(volume.channels, 2);
    assert.deepStrictEqual(Array.from(volume.samples), [1, 3, 5, 7, 9, 11, 13, 15]);
  });

  test('rejects a truncated payload rather than rendering garbage', async () => {
    const file = makeNrrd(
      ['type: short', 'dimension: 3', 'sizes: 4 4 4', 'encoding: raw'],
      new Uint8Array(10)
    );

    await assert.rejects(() => new NrrdParser().parse(file), /truncated/i);
  });

  test('rejects an unsupported encoding with an actionable message', async () => {
    const file = makeNrrd(
      ['type: uchar', 'dimension: 3', 'sizes: 2 2 2', 'encoding: bzip2'],
      new Uint8Array(8)
    );

    await assert.rejects(() => new NrrdParser().parse(file), /bzip2.*not supported|gzip/i);
  });
});

suite('Marching cubes tables', () => {
  test('every case has complete triangles and valid edge indices', () => {
    assert.strictEqual(triTable.length, 256);
    for (let cube = 0; cube < 256; cube++) {
      const row = triTable[cube];
      const edges = row.filter(value => value !== -1);
      assert.strictEqual(
        edges.length % 3,
        0,
        `case ${cube} has ${edges.length} edge references, not a multiple of 3`
      );
      for (const edge of edges) {
        assert.ok(edge >= 0 && edge < 12, `case ${cube} references edge ${edge}`);
      }
      // No triangle may reuse an edge; that would be a degenerate face.
      for (let t = 0; t < edges.length; t += 3) {
        const [a, b, c] = [edges[t], edges[t + 1], edges[t + 2]];
        assert.ok(a !== b && b !== c && a !== c, `case ${cube} has a degenerate triangle`);
      }
    }
  });

  test('a case is empty exactly when all corners agree', () => {
    for (let cube = 0; cube < 256; cube++) {
      const empty = edgeTable[cube] === 0;
      assert.strictEqual(
        empty,
        cube === 0 || cube === 255,
        `case ${cube} emptiness disagrees with its corner mask`
      );
    }
  });

  test('each case cuts exactly the edges its corner signs demand', () => {
    // An edge is crossed if and only if its two corners disagree. A row copied
    // into the wrong slot almost always violates this, which the per-row shape
    // checks above cannot see.
    //
    // (Note what is deliberately *not* asserted: that complementary cases have
    // equal triangle counts. They do not. Lorensen's table resolves ambiguous
    // faces asymmetrically — case 5 cuts two corners off with 2 triangles
    // while case 250 joins them with 4 — and that asymmetry is the classic
    // source of cracks between neighbouring cells, not a transcription error.)
    for (let cube = 0; cube < 256; cube++) {
      const used = new Set(triTable[cube].filter(value => value !== -1));
      for (let edge = 0; edge < 12; edge++) {
        const [a, b] = edgeCorners[edge];
        const crossed = ((cube >> a) & 1) !== ((cube >> b) & 1);
        assert.strictEqual(
          used.has(edge),
          crossed,
          `case ${cube}: edge ${edge} is ${used.has(edge) ? 'used' : 'unused'} but ${
            crossed ? 'is' : 'is not'
          } crossed`
        );
      }
    }
  });

  test('each case is a closed patch across the cube boundary', () => {
    // Segments used by one triangle are the patch's boundary, and they lie on
    // the cube's faces. For the patch to close up against its neighbours,
    // every crossed edge must be visited by exactly two boundary segments.
    for (let cube = 0; cube < 256; cube++) {
      const flat = triTable[cube].filter(value => value !== -1);
      const segmentUse = new Map<string, number>();
      for (let t = 0; t < flat.length; t += 3) {
        const tri = [flat[t], flat[t + 1], flat[t + 2]];
        for (let i = 0; i < 3; i++) {
          const a = tri[i];
          const b = tri[(i + 1) % 3];
          const key = a < b ? `${a}:${b}` : `${b}:${a}`;
          segmentUse.set(key, (segmentUse.get(key) || 0) + 1);
        }
      }

      const degree = new Map<number, number>();
      for (const [key, count] of segmentUse) {
        if (count === 1) {
          for (const endpoint of key.split(':').map(Number)) {
            degree.set(endpoint, (degree.get(endpoint) || 0) + 1);
          }
        }
      }

      for (const edge of new Set(flat)) {
        assert.strictEqual(
          degree.get(edge) || 0,
          2,
          `case ${cube}: edge ${edge} has boundary degree ${degree.get(edge) || 0}, not 2`
        );
      }
    }
  });
});

suite('Orthogonal volume slices', () => {
  test('maps original voxel samples through window/level on three physical planes', async () => {
    const volume: VolumeData = {
      sizes: [2, 2, 2],
      samples: new Float32Array([0, 25, 50, 75, 100, 125, 150, 200]),
      ijkToWorld: [0.001, 0, 0, 1, 0, 0.002, 0, 2, 0, 0, 0.003, 3, 0, 0, 0, 1],
      spaceUnits: 'm',
      channels: 1,
      header: { 'photometric interpretation': 'MONOCHROME2' },
    };

    const result = await buildVolumeSlicesAsync(
      volume,
      { windowCenter: 100, windowWidth: 200, slices: [1, 0, 1] },
      () => false
    );

    assert.ok(result);
    assert.deepStrictEqual(result.slices, [1, 0, 1]);
    assert.strictEqual(result.data.vertexCount, 12);
    assert.strictEqual(result.data.faceCount, 6);
    assert.deepStrictEqual(
      Array.from(result.data.colorsArray!.slice(0, 6)),
      [32, 32, 32, 96, 96, 96]
    );
    assert.ok(Math.abs(result.data.positionsArray![0] - 1.001) < 1e-6);
    assert.strictEqual(result.data.positionsArray![1], 2);
    assert.strictEqual(result.data.positionsArray![2], 3);
    assert.strictEqual(result.data.metadata?.windowCenter, 100);
  });

  test('honours MONOCHROME1 presentation without changing stored intensities', async () => {
    const volume: VolumeData = {
      sizes: [2, 2, 2],
      samples: new Uint8Array([0, 100, 0, 100, 0, 100, 0, 100]),
      ijkToWorld: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      spaceUnits: 'm',
      channels: 1,
      header: { 'photometric interpretation': 'MONOCHROME1' },
    };
    const result = await buildVolumeSlicesAsync(
      volume,
      { windowCenter: 50, windowWidth: 100, slices: [0, 0, 0] },
      () => false
    );
    assert.ok(result);
    assert.deepStrictEqual(
      Array.from(result.data.colorsArray!.slice(12, 18)),
      [255, 255, 255, 0, 0, 0]
    );
    assert.strictEqual(volume.samples[0], 0);
  });
});

suite('Isosurface extraction', () => {
  test('produces a closed manifold surface', () => {
    const volume = makeBall(32, 10);
    const mesh = extractIsosurface(volume, { threshold: 0 });

    assert.ok(mesh.triangleCount > 500, `expected a substantial mesh, got ${mesh.triangleCount}`);

    // Every edge of a closed surface is shared by exactly two triangles. This
    // is the real check on the 256-row case table: almost any transcription
    // error leaves a hole or a doubled face, and shows up here.
    const edgeUse = new Map<string, number>();
    for (let t = 0; t < mesh.indices.length; t += 3) {
      const corners = [mesh.indices[t], mesh.indices[t + 1], mesh.indices[t + 2]];
      for (let e = 0; e < 3; e++) {
        const a = corners[e];
        const b = corners[(e + 1) % 3];
        const key = a < b ? `${a}:${b}` : `${b}:${a}`;
        edgeUse.set(key, (edgeUse.get(key) || 0) + 1);
      }
    }

    const nonManifold = [...edgeUse.values()].filter(count => count !== 2).length;
    assert.strictEqual(
      nonManifold,
      0,
      `${nonManifold} of ${edgeUse.size} edges are not shared by exactly two triangles`
    );
  });

  test('places vertices on the analytic sphere', () => {
    const size = 32;
    const radius = 10;
    const volume = makeBall(size, radius);
    const mesh = extractIsosurface(volume, { threshold: 0 });

    const centre = (size - 1) / 2;
    let worst = 0;
    for (let v = 0; v < mesh.vertexCount; v++) {
      const distance = Math.hypot(
        mesh.positions[v * 3] - centre,
        mesh.positions[v * 3 + 1] - centre,
        mesh.positions[v * 3 + 2] - centre
      );
      worst = Math.max(worst, Math.abs(distance - radius));
    }
    // Linear interpolation along cube edges; a fraction of a voxel is the
    // expected accuracy, and anything larger means the interpolation or the
    // index-to-world mapping is wrong.
    assert.ok(worst < 0.2, `worst radial error was ${worst.toFixed(3)} voxels`);
  });

  test('orients normals outward', () => {
    const size = 32;
    const volume = makeBall(size, 10);
    const mesh = extractIsosurface(volume, { threshold: 0 });

    const centre = (size - 1) / 2;
    let inward = 0;
    for (let v = 0; v < mesh.vertexCount; v++) {
      const dot =
        (mesh.positions[v * 3] - centre) * mesh.normals[v * 3] +
        (mesh.positions[v * 3 + 1] - centre) * mesh.normals[v * 3 + 1] +
        (mesh.positions[v * 3 + 2] - centre) * mesh.normals[v * 3 + 2];
      if (dot <= 0) {
        inward++;
      }
    }
    assert.strictEqual(inward, 0, `${inward} normals point into the surface`);
  });

  test('applies the volume affine to vertex positions', () => {
    const volume = makeBall(32, 10);
    // 2 mm in x, 3 mm in z, with an origin offset.
    volume.ijkToWorld = [2, 0, 0, 100, 0, 1, 0, 0, 0, 0, 3, -50, 0, 0, 0, 1];

    const mesh = extractIsosurface(volume, { threshold: 0 });

    const centre = (32 - 1) / 2;
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let v = 0; v < mesh.vertexCount; v++) {
      minX = Math.min(minX, mesh.positions[v * 3]);
      maxX = Math.max(maxX, mesh.positions[v * 3]);
      minZ = Math.min(minZ, mesh.positions[v * 3 + 2]);
      maxZ = Math.max(maxZ, mesh.positions[v * 3 + 2]);
    }

    // A radius-10 ball spans 20 voxels, so 40 mm in x and 60 mm in z.
    assert.ok(Math.abs(maxX - minX - 40) < 1, `x extent was ${(maxX - minX).toFixed(2)}`);
    assert.ok(Math.abs(maxZ - minZ - 60) < 1.5, `z extent was ${(maxZ - minZ).toFixed(2)}`);
    // And the origin offset moved it, rather than being dropped.
    assert.ok(Math.abs((minX + maxX) / 2 - (2 * centre + 100)) < 1);
  });

  test('decimation keeps the surface in the same place', () => {
    const size = 48;
    const radius = 16;
    const volume = makeBall(size, radius);

    const coarse = extractIsosurface(volume, { threshold: 0, step: 2 });
    const centre = (size - 1) / 2;
    let worst = 0;
    for (let v = 0; v < coarse.vertexCount; v++) {
      const distance = Math.hypot(
        coarse.positions[v * 3] - centre,
        coarse.positions[v * 3 + 1] - centre,
        coarse.positions[v * 3 + 2] - centre
      );
      worst = Math.max(worst, Math.abs(distance - radius));
    }
    assert.deepStrictEqual(coarse.step, [2, 2, 2]);
    // Coarser sampling, but the vertices must still land on the sphere - a
    // step handled inconsistently between positions and the affine would show
    // up as a systematic scale error here.
    assert.ok(worst < 0.6, `worst radial error at step 2 was ${worst.toFixed(3)} voxels`);
  });

  test('chooseStep decimates only when the volume is large', () => {
    assert.deepStrictEqual(chooseStep([256, 256, 256]), [1, 1, 1]);
    assert.ok(chooseStep([1024, 1024, 1024]).some(value => value > 1));
  });

  test('chooses per-axis strides from anisotropic voxel spacing', () => {
    const affine = [0.2344, 0, 0, 0, 0, 0.2344, 0, 0, 0, 0, 3.3, 0, 0, 0, 0, 1];
    assert.deepStrictEqual(chooseStep([640, 640, 44], affine), [14, 14, 1]);
  });

  test('anisotropic decimation keeps a physical sphere spherical', () => {
    const sizes: [number, number, number] = [65, 65, 17];
    const spacing: [number, number, number] = [0.25, 0.25, 1];
    const samples = new Float32Array(sizes[0] * sizes[1] * sizes[2]);
    const centre = [8, 8, 8];
    const radius = 6;
    for (let k = 0; k < sizes[2]; k++) {
      for (let j = 0; j < sizes[1]; j++) {
        for (let i = 0; i < sizes[0]; i++) {
          samples[i + j * sizes[0] + k * sizes[0] * sizes[1]] =
            radius -
            Math.hypot(i * spacing[0] - centre[0], j * spacing[1] - centre[1], k - centre[2]);
        }
      }
    }
    const volume: VolumeData = {
      sizes,
      samples,
      ijkToWorld: [0.25, 0, 0, 0, 0, 0.25, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      spaceUnits: 'mm',
      channels: 1,
      header: {},
    };
    const mesh = extractIsosurface(volume, { threshold: 0, step: [4, 4, 1] });
    const extents = [0, 1, 2].map(axis => {
      let min = Infinity;
      let max = -Infinity;
      for (let v = axis; v < mesh.positions.length; v += 3) {
        min = Math.min(min, mesh.positions[v]);
        max = Math.max(max, mesh.positions[v]);
      }
      return max - min;
    });
    for (const extent of extents) {
      assert.ok(Math.abs(extent - radius * 2) < 0.7, `physical extent was ${extent}`);
    }
    assert.strictEqual(mesh.gradientMagnitudes.length, mesh.vertexCount);
  });

  test('a uniform volume yields no surface', () => {
    const volume = makeBall(16, 10);
    volume.samples = new Float32Array(16 * 16 * 16).fill(5);

    const mesh = extractIsosurface(volume, { threshold: 5 });

    assert.strictEqual(mesh.triangleCount, 0);
  });

  test('cooperative extraction cancels a superseded request', async () => {
    let cancelled = false;
    const result = await extractIsosurfaceAsync(
      makeBall(32, 10),
      { threshold: 0, onProgress: () => (cancelled = true) },
      () => cancelled
    );
    assert.strictEqual(result, null);
  });
});

suite('Volume points and clipping', () => {
  test('point picking ignores voxels removed by active slice clipping', () => {
    const camera = new THREE.PerspectiveCamera(60, 1, 0.01, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      'position',
      new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0, 0]), 3)
    );
    const points = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({ size: 0.1, sizeAttenuation: true })
    );
    points.updateMatrixWorld(true);
    const manager = new SelectionManager({
      fileEntries: {} as any,
      camera,
      meshes: [points],
      spatialFiles: [],
      poseGroups: [],
      cameraGroups: [],
      fileVisibility: [true],
      pointSizes: [0.1],
      screenSpaceScaling: false,
      // Keep z <= 0.5, clipping the front point at z=1.
      clippingPlanes: [new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.5)],
    });

    const hit = (manager as any).pickPointScreenSpace(
      50,
      50,
      {
        clientWidth: 100,
        clientHeight: 100,
      },
      [points]
    );
    assert.ok(hit);
    assert.strictEqual(hit.pointIndex, 1);
  });

  test('emits thresholded points in world space with intensity', () => {
    const volume = makeBall(8, 3);
    volume.ijkToWorld = [2, 0, 0, 10, 0, 3, 0, 20, 0, 0, 4, 30, 0, 0, 0, 1];
    const result = buildVolumePoints(volume, {
      threshold: 2,
      step: [1, 1, 1],
      maxPoints: 10_000,
    });
    assert.ok(result.data.vertexCount > 0);
    assert.strictEqual(result.data.intensityArray?.length, result.data.vertexCount);
    assert.ok(result.data.positionsArray![0] >= 10);
    assert.ok(result.data.positionsArray![1] >= 20);
    assert.ok(result.data.positionsArray![2] >= 30);
    assert.deepStrictEqual(result.data.metadata?.effectiveSpacing, [2, 3, 4]);
    assert.strictEqual(result.data.metadata?.renderedPointCount, result.data.vertexCount);
    assert.strictEqual(result.data.metadata?.sourceVoxelCount, 512);
  });

  test('uses every retained voxel at unit stride by default', () => {
    const volume = makeBall(8, 3);
    const result = buildVolumePoints(volume, {
      threshold: -Infinity,
      windowCenter: 0,
      windowWidth: 10,
    });

    assert.deepStrictEqual(result.step, [1, 1, 1]);
    assert.strictEqual(result.data.vertexCount, 8 * 8 * 8);
  });

  test('colours points with the fixed DICOM window rather than the retained range', () => {
    const volume = makeBall(2, 1);
    volume.samples = new Float32Array([0, 50, 100, 150, 0, 50, 100, 150]);
    volume.header['photometric interpretation'] = 'MONOCHROME2';

    const result = buildVolumePoints(volume, {
      threshold: 50,
      windowCenter: 75,
      windowWidth: 150,
    });

    assert.deepStrictEqual(Array.from(result.data.intensityArray!), [50, 100, 150, 50, 100, 150]);
    assert.deepStrictEqual(
      Array.from(result.data.colorsArray!.slice(0, 9)),
      [85, 85, 85, 170, 170, 170, 255, 255, 255]
    );
    assert.strictEqual(result.data.hasColors, true);
  });

  test('uses reciprocal affine normals for sheared slice planes', () => {
    const affine = [1, 0.3, 0.2, 10, 0, 1, 0.4, 20, 0, 0, 2, 30, 0, 0, 0, 1];
    const [lower, upper] = volumeSectionPlanes(affine, 2, 3, 7);
    const pointAt = (i: number, j: number, k: number) =>
      new THREE.Vector3(
        affine[0] * i + affine[1] * j + affine[2] * k + affine[3],
        affine[4] * i + affine[5] * j + affine[6] * k + affine[7],
        affine[8] * i + affine[9] * j + affine[10] * k + affine[11]
      );
    // Selected outer layers lie safely inside; planes sit between voxel
    // centres so no rendered point is coplanar with a GPU clipping boundary.
    assert.ok(lower.distanceToPoint(pointAt(5, 9, 3)) > 0);
    assert.ok(upper.distanceToPoint(pointAt(2, 4, 7)) > 0);
    assert.ok(Math.abs(lower.distanceToPoint(pointAt(5, 9, 2.5))) < 1e-9);
    assert.ok(Math.abs(upper.distanceToPoint(pointAt(2, 4, 7.5))) < 1e-9);
    assert.ok(lower.distanceToPoint(pointAt(1, 1, 2)) < 0);
    assert.ok(upper.distanceToPoint(pointAt(1, 1, 8)) < 0);
    assert.ok(lower.distanceToPoint(pointAt(1, 1, 5)) > 0);
    assert.ok(upper.distanceToPoint(pointAt(1, 1, 5)) > 0);
  });

  test('falls back to percentage ranges for data without an affine', () => {
    const bounds = new THREE.Box3(new THREE.Vector3(-10, 20, 5), new THREE.Vector3(30, 40, 15));
    const [lower, upper] = boundingBoxSectionPlanes(bounds, 0, 0.25, 0.75);
    assert.ok(Math.abs(lower.distanceToPoint(new THREE.Vector3(0, 100, 100))) < 1e-9);
    assert.ok(Math.abs(upper.distanceToPoint(new THREE.Vector3(20, -100, -100))) < 1e-9);
    assert.ok(lower.distanceToPoint(new THREE.Vector3(10, 0, 0)) > 0);
    assert.ok(upper.distanceToPoint(new THREE.Vector3(10, 0, 0)) > 0);
  });
});

suite('Threshold defaults', () => {
  test('CT defaults to the bone Hounsfield value', () => {
    const volume = makeBall(16, 6);
    volume.intensityUnits = 'HU';

    assert.strictEqual(defaultThreshold(volume), 300);
  });

  test('Otsu separates a bimodal volume', () => {
    const samples = new Float32Array(1000);
    for (let i = 0; i < samples.length; i++) {
      samples[i] = i < 600 ? 10 : 200;
    }
    const volume: VolumeData = {
      sizes: [10, 10, 10],
      samples,
      ijkToWorld: [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
      spaceUnits: 'mm',
      channels: 1,
      header: {},
    };

    const threshold = otsuThreshold(volume);

    assert.ok(threshold > 10 && threshold < 200, `Otsu returned ${threshold}`);
  });

  test('sampleRange prefers the declared range', () => {
    const volume = makeBall(8, 3);
    volume.range = { min: -1000, max: 3000 };

    assert.deepStrictEqual(sampleRange(volume), { min: -1000, max: 3000 });
  });
});

suite('Volume to SpatialData', () => {
  test('moves the extracted mesh when its scalar threshold changes', () => {
    const size = 8;
    const volume = makeBall(size, 1);
    volume.samples = new Float32Array(size * size * size);
    for (let k = 0; k < size; k++) {
      for (let j = 0; j < size; j++) {
        for (let i = 0; i < size; i++) {
          volume.samples[i + j * size + k * size * size] = i;
        }
      }
    }

    const low = buildVolumeMesh(volume, { threshold: 2, step: [1, 1, 1] }).data;
    const high = buildVolumeMesh(volume, { threshold: 5, step: [1, 1, 1] }).data;
    const meanX = (positions: Float32Array) => {
      let sum = 0;
      for (let i = 0; i < positions.length; i += 3) {
        sum += positions[i];
      }
      return sum / (positions.length / 3);
    };

    assert.ok(meanX(high.positionsArray!) > meanX(low.positionsArray!) + 2);
    assert.strictEqual(low.metadata?.threshold, 2);
    assert.strictEqual(high.metadata?.threshold, 5);
  });

  test('delivers a typed-array mesh the geometry builder can consume', () => {
    const volume = makeBall(32, 10);
    volume.intensityUnits = 'HU';

    const { data, threshold } = buildVolumeMesh(volume, { threshold: 0 });

    assert.strictEqual(threshold, 0);
    assert.strictEqual(data.useTypedArrays, true);
    assert.ok(data.positionsArray instanceof Float32Array);
    assert.ok(data.indicesArray instanceof Uint32Array);
    assert.strictEqual(data.positionsArray!.length, data.vertexCount * 3);
    assert.strictEqual(data.indicesArray!.length, data.faceCount * 3);
    assert.strictEqual(data.hasNormals, true);
    // `faces` stays empty on this path; faceCount is what marks it a mesh.
    assert.strictEqual(data.faces.length, 0);
    assert.ok(data.faceCount > 0);
    assert.ok(data.comments.some(line => line.includes('HU')));
  });

  test('every index addresses a real vertex', () => {
    const volume = makeBall(24, 8);
    const { data } = buildVolumeMesh(volume, { threshold: 0 });

    let maxIndex = 0;
    for (const index of data.indicesArray!) {
      maxIndex = Math.max(maxIndex, index);
    }
    assert.ok(
      maxIndex < data.vertexCount,
      `index ${maxIndex} is out of range for ${data.vertexCount} vertices`
    );
  });
});
