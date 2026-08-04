import * as assert from 'assert';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { extract7z } from '../../dataset/sevenZip';

// A tiny .7z built once and committed as base64 rather than as a binary
// fixture, so the extraction path is covered without adding a blob to the repo
// or depending on a 7z binary being installed to generate one. It contains
// two files: hello.txt ("hello 7z\n") and nested/inner.txt ("inner\n").
const SAMPLE_7Z_BASE64 =
  'N3q8ryccAARTHrJrhwAAAAAAAAAhAAAAAAAAAJdkXBwBAA5oZWxsbyA3egppbm5lcgoAAACBMweuD88n8IwHyEN/QbH6/eEttTvW' +
  'R9r2+t7mZFvdTGnuKh3l7d6tQGDRDgmDf8vu4Ope6cbYbqNFSDB0TkKRAF+paowXvynTHuc7NTNvB0QetXm3LZvZY+jgyt2iUl6l' +
  '7CSZYinpp94VYVtoBT2AAAAXBhMBCXQABwsBAAEjAwEBBV0AEAAADICiCgFb5L0FAAA=';

suite('7z extraction (WASM)', () => {
  let tmpDir: string;

  setup(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ply-7z-test-'));
  });

  teardown(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  test('extracts an archive to disk, preserving nested paths', async function () {
    // Instantiating the WASM module dominates this; the archive itself is tiny.
    this.timeout(30000);

    const archivePath = path.join(tmpDir, 'sample.7z');
    fs.writeFileSync(archivePath, Buffer.from(SAMPLE_7Z_BASE64, 'base64'));
    const outDir = path.join(tmpDir, 'out');
    fs.mkdirSync(outDir);

    await extract7z(archivePath, outDir);

    assert.strictEqual(fs.readFileSync(path.join(outDir, 'hello.txt'), 'utf8'), 'hello 7z\n');
    assert.strictEqual(
      fs.readFileSync(path.join(outDir, 'nested', 'inner.txt'), 'utf8'),
      'inner\n'
    );
  });

  test('rejects a corrupt archive instead of silently producing nothing', async function () {
    this.timeout(30000);

    const archivePath = path.join(tmpDir, 'broken.7z');
    // Valid 7z signature, garbage body — this is the case that used to surface
    // as an empty output directory rather than an error.
    fs.writeFileSync(
      archivePath,
      Buffer.concat([Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]), Buffer.alloc(64, 0xff)])
    );
    const outDir = path.join(tmpDir, 'out');
    fs.mkdirSync(outDir);

    await assert.rejects(() => extract7z(archivePath, outDir), /7z extraction .* failed/);
  });
});
