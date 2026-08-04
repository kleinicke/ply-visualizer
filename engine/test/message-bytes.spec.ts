import { test, expect } from '@playwright/test';
import { messageBytes } from '../src/utils/messageBytes';

/**
 * Binary payloads crossing the extension-host boundary.
 *
 * The plain-object case is the one that matters: `new Uint8Array({0: 1, ...})`
 * yields a zero-length array without throwing, so a dropped payload looks like
 * an empty file. That turned a COLMAP transfer bug into a misleading "model has
 * no points3D" message.
 */

const source = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);

test('passes a Uint8Array through unchanged', () => {
  expect(messageBytes(source)).toEqual(source);
});

test('accepts an ArrayBuffer', () => {
  expect(messageBytes(source.buffer.slice(0))).toEqual(source);
});

test('accepts a view with a non-zero byte offset', () => {
  const view = new Uint8Array(source.buffer, 2, 4);
  expect(Array.from(messageBytes(view))).toEqual([78, 71, 13, 10]);
});

test('accepts a plain array', () => {
  expect(messageBytes(Array.from(source))).toEqual(source);
});

test('reconstructs a numeric-keyed object rather than yielding nothing', () => {
  // What a JSON round trip of a Uint8Array actually looks like.
  const cloned = JSON.parse(JSON.stringify(source));
  expect(cloned).not.toBeInstanceOf(Uint8Array);
  expect(new Uint8Array(cloned).byteLength).toBe(0); // the trap
  expect(messageBytes(cloned)).toEqual(source); // the fix
});

test('returns an empty array for genuinely missing data', () => {
  expect(messageBytes(undefined).byteLength).toBe(0);
  expect(messageBytes(null).byteLength).toBe(0);
});
