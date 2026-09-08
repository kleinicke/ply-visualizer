import * as assert from 'assert';
import { normalizeUrlHistory, rememberUrl, UrlHistoryCursor } from '../../urlHistory';

suite('Remote URL history', () => {
  test('recalls newest URLs first and restores the draft with Down', () => {
    const cursor = new UrlHistoryCursor([
      'https://example.com/old.ply',
      'https://example.com/new.ply',
    ]);
    assert.strictEqual(cursor.previous('draft'), 'https://example.com/new.ply');
    assert.strictEqual(cursor.previous(''), 'https://example.com/old.ply');
    assert.strictEqual(cursor.previous(''), 'https://example.com/old.ply');
    assert.strictEqual(cursor.next(), 'https://example.com/new.ply');
    assert.strictEqual(cursor.next(), 'draft');
    assert.strictEqual(cursor.next(), null);
    cursor.reset();
    assert.strictEqual(cursor.previous('edited draft'), 'https://example.com/new.ply');
    assert.strictEqual(cursor.next(), 'edited draft');
  });
  test('deduplicates, bounds, and normalizes persisted history', () => {
    assert.deepStrictEqual(normalizeUrlHistory([null, '', 'a', 'b', 'a']), ['b', 'a']);
    assert.deepStrictEqual(rememberUrl(['a', 'b'], 'c', 2), ['b', 'c']);
    assert.deepStrictEqual(rememberUrl(['a', 'b'], 'a'), ['b', 'a']);
    assert.strictEqual(new UrlHistoryCursor([]).previous('draft'), null);
  });
});
