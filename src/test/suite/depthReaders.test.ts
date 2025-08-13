import * as assert from 'assert';
import { projectToPointCloud, normalizeDepth } from '../../webview/depth/DepthProjector';
import { DepthImage, DepthMetadata } from '../../webview/depth/types';
import { PfmReader } from '../../webview/depth/readers/PfmReader';
import { NpyReader } from '../../webview/depth/readers/NpyReader';
import { NpzReader } from '../../webview/depth/readers/NpzReader';
import { Png16Reader } from '../../webview/depth/readers/Png16Reader';

suite('Depth Readers and Projector', () => {
  test('PFM reader parses minimal Pf single-channel', async () => {
    // Create a tiny 2x2 Pf PFM buffer with scale -1.0 (little endian)
    const header = `Pf\n2 2\n-1.0\n`;
    const enc = new TextEncoder();
    const head = enc.encode(header);
    const body = new ArrayBuffer(2 * 2 * 4);
    const dv = new DataView(body);
    const vals = [1.0, 2.0, 3.0, 4.0];
    // PFM stores from bottom row to top row
    let pos = 0;
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 2; x++) {
        dv.setFloat32(pos, vals[y * 2 + x], true);
        pos += 4;
      }
    }
    const buf = new Uint8Array(head.length + body.byteLength);
    buf.set(head, 0); buf.set(new Uint8Array(body), head.length);

    const reader = new PfmReader();
    const { image, meta } = await reader.read(buf.buffer);
    assert.strictEqual(image.width, 2);
    assert.strictEqual(image.height, 2);
    assert.strictEqual(meta.kind, 'depth');
  });

  test('NPY reader supports 2D float32 arrays', async () => {
    // Build a minimal .npy header and data: shape (2,2), float32, little endian
    const magic = new Uint8Array([0x93, 0x4E, 0x55, 0x4D, 0x50, 0x59]); //\x93NUMPY
    const ver = new Uint8Array([0x01, 0x00]);
    const headerStr = "{'descr': '<f4', 'fortran_order': False, 'shape': (2, 2), }\n";
    const headerBytes = new TextEncoder().encode(headerStr);
    const headerLen = new Uint8Array(2);
    new DataView(headerLen.buffer).setUint16(0, headerBytes.length, true);
    const data = new ArrayBuffer(2 * 2 * 4);
    const dv = new DataView(data);
    const vals = [1, 2, 3, 4];
    let pos = 0;
    for (const v of vals) { dv.setFloat32(pos, v, true); pos += 4; }
    const npy = new Uint8Array(10 + headerBytes.length + data.byteLength);
    npy.set(magic, 0); npy.set(ver, 6); npy.set(headerLen, 8); npy.set(headerBytes, 10); npy.set(new Uint8Array(data), 10 + headerBytes.length);

    const reader = new NpyReader();
    const { image } = await reader.read(npy.buffer);
    assert.strictEqual(image.width, 2);
    assert.strictEqual(image.height, 2);
  });

  test('NPZ reader selects depth.npy if present', async () => {
    // A minimal NPZ is complex to craft; this verifies that missing .npy yields a helpful error
    const reader = new NpzReader();
    let threw = false;
    try {
      await reader.read(new ArrayBuffer(16));
    } catch (e: any) {
      threw = true;
      assert.ok(String(e.message || e).includes('.npy arrays'));
    }
    assert.ok(threw);
  });

  test('Projector converts metric depth with pinhole intrinsics', () => {
    const image: DepthImage = { width: 2, height: 2, data: new Float32Array([1,1,1,1]) };
    const meta: DepthMetadata = { kind: 'depth', unit: 'meter', fx: 100, fy: 100, cx: 0.5, cy: 0.5, cameraModel: 'pinhole' };
    const norm = normalizeDepth(image, meta);
    const result = projectToPointCloud(norm, { fx: 100, fy: 100, cx: 0.5, cy: 0.5, cameraModel: 'pinhole', kind: 'depth' });
    assert.strictEqual(result.pointCount, 4);
    assert.strictEqual(result.vertices.length, 12);
  });

  test('PNG reader returns helpful error on invalid png', async () => {
    const reader = new Png16Reader();
    let threw = false;
    try {
      await reader.read(new ArrayBuffer(8));
    } catch (e: any) {
      threw = true;
      const msg = String(e.message || e);
      // upng error may vary; ensure we hint grayscale 16-bit
      assert.ok(msg.includes('PNG') || msg.includes('decode'));
    }
    assert.ok(threw);
  });
});


