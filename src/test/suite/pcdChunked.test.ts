import * as assert from 'assert';
import { loadRegistrationWasm } from '../../../engine/src/registration/wasmLoader';
import {
  marshalWasmPointCloud,
  parsePcdWasm,
  type WasmPointCloudResult,
} from '../../../engine/src/parsers/pointcloudWasm';

/**
 * Large `DATA binary` PCDs are parsed a slice of rows at a time so wasm memory
 * never holds the whole file. The result must be exactly the whole-file
 * `parse_pcd` result: same arrays, same bounds, same source-row map.
 */
suite('Chunked binary PCD parse', () => {
  function binaryPcd(
    fields: Array<{ name: string; type: 'F' | 'U'; size: number }>,
    rows: number,
    value: (row: number, field: string) => number
  ): Uint8Array {
    const header =
      `VERSION .7\nFIELDS ${fields.map(f => f.name).join(' ')}\n` +
      `SIZE ${fields.map(f => f.size).join(' ')}\nTYPE ${fields.map(f => f.type).join(' ')}\n` +
      `COUNT ${fields.map(() => 1).join(' ')}\nWIDTH ${rows}\nHEIGHT 1\n` +
      `VIEWPOINT 1 2 3 1 0 0 0\nPOINTS ${rows}\nDATA binary\n`;
    const head = new TextEncoder().encode(header);
    const stride = fields.reduce((sum, f) => sum + f.size, 0);
    const bytes = new Uint8Array(head.length + rows * stride);
    bytes.set(head);
    const view = new DataView(bytes.buffer);
    for (let row = 0; row < rows; row++) {
      let offset = head.length + row * stride;
      for (const f of fields) {
        const v = value(row, f.name);
        if (f.type === 'F') {
          view.setFloat32(offset, v, true);
        } else if (f.size === 4) {
          view.setUint32(offset, v, true);
        } else if (f.size === 2) {
          view.setUint16(offset, v, true);
        } else {
          view.setUint8(offset, v);
        }
        offset += f.size;
      }
    }
    return bytes;
  }

  async function whole(bytes: Uint8Array): Promise<WasmPointCloudResult> {
    const wasm = (await loadRegistrationWasm()) as any;
    return marshalWasmPointCloud(wasm.parse_pcd(bytes));
  }

  function assertSame(actual: WasmPointCloudResult, expected: WasmPointCloudResult) {
    for (const key of [
      'vertexCount',
      'hasColors',
      'hasNormals',
      'hasIntensity',
      'metadataJson',
      'sourcePointCount',
      'sourceRowsIdentity',
    ] as const) {
      assert.deepStrictEqual(actual[key], expected[key], key);
    }
    for (const key of [
      'positionsArray',
      'colorsArray',
      'normalsArray',
      'intensityArray',
      'bbox',
      'sourcePointIndices',
    ] as const) {
      assert.deepStrictEqual(actual[key], expected[key], key);
    }
    assert.deepStrictEqual(
      Object.keys(actual.scalarFields ?? {}),
      Object.keys(expected.scalarFields ?? {})
    );
    for (const name of Object.keys(expected.scalarFields ?? {})) {
      assert.deepStrictEqual(actual.scalarFields![name], expected.scalarFields![name], name);
    }
  }

  // Deterministic pseudo-random values.
  const noise = (row: number, salt: number) => {
    const x = Math.sin(row * 12.9898 + salt * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  const xyz = [
    { name: 'x', type: 'F' as const, size: 4 },
    { name: 'y', type: 'F' as const, size: 4 },
    { name: 'z', type: 'F' as const, size: 4 },
  ];

  test('xyz + rgb + intensity + extra field, every row kept', async () => {
    const fields = [
      ...xyz,
      { name: 'rgb', type: 'U' as const, size: 4 },
      { name: 'intensity', type: 'F' as const, size: 4 },
      { name: 'ring', type: 'U' as const, size: 2 },
    ];
    // 22-byte stride: chunk boundaries never align with the 4 MB slice size.
    const bytes = binaryPcd(fields, 260000, (row, name) =>
      name === 'rgb'
        ? (row * 2654435761) >>> 8
        : name === 'ring'
          ? row % 64
          : name === 'intensity'
            ? noise(row, 9)
            : noise(row, name.charCodeAt(0)) * 200 - 100
    );
    assert.ok(bytes.length > 4 * 1024 * 1024);
    const chunked = await parsePcdWasm(bytes);
    assertSame(chunked, await whole(bytes));
    assert.strictEqual(chunked.sourceRowsIdentity, true);
    assert.deepStrictEqual(chunked.header.viewpoint, [1, 2, 3, 1, 0, 0, 0]);
  });

  test('non-finite rows in several chunks keep the explicit row map', async () => {
    const fields = [...xyz, { name: 'normal_x', type: 'F' as const, size: 4 }];
    const bytes = binaryPcd(fields, 400000, (row, name) =>
      name === 'x' && (row % 97 === 3 || (row > 200000 && row < 200100))
        ? NaN
        : noise(row, name.length + name.charCodeAt(0))
    );
    const chunked = await parsePcdWasm(bytes);
    assertSame(chunked, await whole(bytes));
    assert.ok(chunked.sourcePointIndices && chunked.vertexCount < 400000);
  });

  test('only the last chunk drops a row', async () => {
    const bytes = binaryPcd(xyz, 400000, (row, name) =>
      row === 399999 && name === 'z' ? Infinity : noise(row, name.charCodeAt(0))
    );
    assertSame(await parsePcdWasm(bytes), await whole(bytes));
  });

  test('a truncated file decodes the whole records present', async () => {
    const full = binaryPcd(xyz, 400000, (row, name) => noise(row, name.charCodeAt(0)));
    const bytes = full.subarray(0, full.length - 1000 - 5);
    assertSame(await parsePcdWasm(bytes), await whole(bytes));
  });
});
