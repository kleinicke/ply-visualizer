import { test, expect } from '@playwright/test';
import { FileEntryRegistry } from '../src/state/fileEntries';

/**
 * Container entries and their children.
 *
 * A COLMAP reconstruction publishes its camera profile as a child of the point
 * cloud, so removing the cloud has to take the cameras with it. The descending
 * index order of the result is part of the contract: callers splice their own
 * per-entry arrays with it.
 */

test('removing a parent removes its children', () => {
  const registry = new FileEntryRegistry();
  const cloud = registry.add('spatial');
  const cameras = registry.add('camera', cloud.entry.id);
  const unrelated = registry.add('spatial');

  const removed = registry.removeAt(cloud.index);

  expect(removed.map(entry => entry.entry.id).sort()).toEqual(
    [cloud.entry.id, cameras.entry.id].sort()
  );
  expect(registry.length).toBe(1);
  expect(registry.at(0)!.id).toBe(unrelated.entry.id);
});

test('removals come back highest index first', () => {
  const registry = new FileEntryRegistry();
  const cloud = registry.add('spatial');
  registry.add('camera', cloud.entry.id);

  const indices = registry.removeAt(cloud.index).map(entry => entry.index);
  expect(indices).toEqual([...indices].sort((a, b) => b - a));
});

test('grandchildren are removed too', () => {
  const registry = new FileEntryRegistry();
  const root = registry.add('spatial');
  const child = registry.add('pose', root.entry.id);
  registry.add('camera', child.entry.id);

  expect(registry.removeAt(root.index)).toHaveLength(3);
  expect(registry.length).toBe(0);
});

test('a childless entry removes only itself', () => {
  const registry = new FileEntryRegistry();
  registry.add('spatial');
  const second = registry.add('spatial');
  registry.add('camera');

  expect(registry.removeAt(second.index)).toHaveLength(1);
  expect(registry.length).toBe(2);
});

test('removing a child leaves its parent alone', () => {
  const registry = new FileEntryRegistry();
  const cloud = registry.add('spatial');
  const cameras = registry.add('camera', cloud.entry.id);

  expect(registry.removeAt(cameras.index)).toHaveLength(1);
  expect(registry.length).toBe(1);
  expect(registry.at(0)!.id).toBe(cloud.entry.id);
});

test('an out-of-range index removes nothing', () => {
  const registry = new FileEntryRegistry();
  registry.add('spatial');
  expect(registry.removeAt(7)).toEqual([]);
  expect(registry.length).toBe(1);
});
