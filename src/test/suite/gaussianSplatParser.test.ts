import * as assert from 'assert';
import { PlyParser } from '../../../engine/src/parsers/plyParser';

// Minimal binary 3DGS PLY (INRIA layout, deg-0): one gaussian per color anchor.
function buildBinary3dgs(): Uint8Array {
  const SH_C0 = 0.28209479177387814;
  const props = [
    'x',
    'y',
    'z',
    'f_dc_0',
    'f_dc_1',
    'f_dc_2',
    'opacity',
    'scale_0',
    'scale_1',
    'scale_2',
    'rot_0',
    'rot_1',
    'rot_2',
    'rot_3',
  ];
  const vertices = [
    // position          color (0..1)
    { pos: [0, 0, 0], color: [0.8, 0.2, 0.2] },
    { pos: [1, 0, 0], color: [0.2, 0.8, 0.2] },
  ];
  const header =
    ['ply', 'format binary_little_endian 1.0', `element vertex ${vertices.length}`]
      .concat(props.map(p => `property float ${p}`))
      .join('\n') + '\nend_header\n';
  const headerBytes = new TextEncoder().encode(header);
  const body = new ArrayBuffer(vertices.length * props.length * 4);
  const view = new DataView(body);
  vertices.forEach((v, i) => {
    const base = i * props.length * 4;
    const values = [
      ...v.pos,
      ...v.color.map(c => (c - 0.5) / SH_C0),
      -2.5, // opacity logit
      -4,
      -4,
      -4, // log scales
      1,
      0,
      0,
      0, // rotation quaternion
    ];
    values.forEach((value, j) => view.setFloat32(base + j * 4, value, true));
  });
  const out = new Uint8Array(headerBytes.length + body.byteLength);
  out.set(headerBytes, 0);
  out.set(new Uint8Array(body), headerBytes.length);
  return out;
}

suite('Gaussian Splat PLY Support', () => {
  test('binary 3DGS layout is detected and DC coefficients become colors', async () => {
    const result = await new PlyParser().parse(buildBinary3dgs(), () => {});

    assert.strictEqual(result.isGaussianSplat, true);
    assert.strictEqual(result.hasColors, true);
    assert.strictEqual(result.vertexCount, 2);
    assert.deepStrictEqual(Array.from(result.colorsArray!.slice(0, 6)), [204, 51, 51, 51, 204, 51]);
  });

  test('opacity and scales become scalar fields; f_dc/rot do not', async () => {
    const result = await new PlyParser().parse(buildBinary3dgs(), () => {});

    const fields = Object.keys(result.scalarFields ?? {});
    assert.ok(fields.includes('opacity'));
    assert.ok(fields.includes('scale_0'));
    assert.ok(!fields.some(f => f.startsWith('f_dc_') || f.startsWith('rot_')));
    assert.ok(Math.abs(result.scalarFields!.opacity[0] - -2.5) < 1e-6);
  });

  test('parseHeaderOnly reports the splat layout for the ultimate path', async () => {
    const header = await new PlyParser().parseHeaderOnly(buildBinary3dgs(), () => {});

    assert.strictEqual(header.headerInfo.isGaussianSplat, true);
    assert.strictEqual(header.headerInfo.hasColors, true);
    assert.strictEqual(header.vertexStride, 14 * 4);
    assert.ok(header.propertyOffsets.has('f_dc_0'));
  });

  test('a PLY without f_dc properties is not flagged as a splat', async () => {
    const ascii = [
      'ply',
      'format ascii 1.0',
      'element vertex 1',
      'property float x',
      'property float y',
      'property float z',
      'end_header',
      '0 0 0',
      '',
    ].join('\n');
    const result = await new PlyParser().parse(new TextEncoder().encode(ascii), () => {});

    assert.strictEqual(result.isGaussianSplat, false);
    assert.strictEqual(result.hasColors, false);
  });
});
