import * as assert from 'assert';
import { hasSourceRows, sourceRowAt, sourceRowsOf } from '../../../engine/src/utils/sourceRows';
import { parsePcdWasm, toPcdPayload } from '../../../engine/src/parsers/pointcloudWasm';

/**
 * A PCD that keeps every row reports an identity row map instead of one index
 * per point; one that drops a NaN row keeps the explicit map. The agent tools
 * read rows through these helpers and must not see a difference.
 */
suite('Source-row maps', () => {
  const header =
    'FIELDS x y z\nSIZE 4 4 4\nTYPE F F F\nCOUNT 1 1 1\nWIDTH 3\nHEIGHT 1\nPOINTS 3\nDATA ascii\n';

  test('every row kept: an identity map without an index array', async () => {
    const parsed = await parsePcdWasm(new TextEncoder().encode(`${header}1 2 3\n4 5 6\n7 8 9\n`));
    const payload = toPcdPayload(parsed) as any;
    assert.strictEqual(payload.sourcePointIndices, undefined);
    assert.strictEqual(payload.sourceRowsIdentity, true);
    const data = { ...payload, vertexCount: 3 };
    assert.strictEqual(hasSourceRows(data), true);
    assert.deepStrictEqual(
      [0, 1, 2, 3].map(i => sourceRowAt(data, i)),
      [0, 1, 2, null]
    );
    assert.deepStrictEqual(Array.from(sourceRowsOf(data)!), [0, 1, 2]);
  });

  test('a dropped NaN row: the explicit map is kept and read the same way', async () => {
    const parsed = await parsePcdWasm(new TextEncoder().encode(`${header}1 2 3\nnan 5 6\n7 8 9\n`));
    const data = { ...(toPcdPayload(parsed) as any), vertexCount: 2 };
    assert.strictEqual(data.sourceRowsIdentity, undefined);
    assert.deepStrictEqual(
      [0, 1].map(i => sourceRowAt(data, i)),
      [0, 2]
    );
    assert.deepStrictEqual(Array.from(sourceRowsOf(data)!), [0, 2]);
  });

  test('formats without row tracking report none', () => {
    const data = { vertexCount: 2 };
    assert.strictEqual(hasSourceRows(data), false);
    assert.strictEqual(sourceRowAt(data, 0), null);
    assert.strictEqual(sourceRowsOf(data), undefined);
  });
});
