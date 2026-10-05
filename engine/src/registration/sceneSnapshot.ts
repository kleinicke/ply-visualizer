import type { FileEntryRegistry } from '../state/fileEntries';

/** Reject stale solver results, including index shifts caused by unrelated removals. */
export function snapshotRegistrationScene(entries: FileEntryRegistry) {
  const snapshots = entries.ofKind('spatial').map(entry => ({
    id: entry.id,
    index: entries.indexOf(entry.id),
    spatial: entry.spatial,
    data: entry.spatial?.data,
    positions: entry.spatial?.data.positionsArray,
    vertices: entry.spatial?.data.vertices,
    depthVersion: entry.depthUpdate.version,
    transform: entry.transform.clone(),
  }));
  return {
    isCurrent(): boolean {
      return (
        entries.ofKind('spatial').length === snapshots.length &&
        snapshots.every(snapshot => {
          const entry = entries.get(snapshot.id);
          return (
            entry?.spatial === snapshot.spatial &&
            entry?.spatial?.data === snapshot.data &&
            entry?.spatial?.data.vertices === snapshot.vertices &&
            entries.indexOf(snapshot.id) === snapshot.index &&
            entry?.spatial?.data.positionsArray === snapshot.positions &&
            entry.depthUpdate.version === snapshot.depthVersion &&
            entry.transform.equals(snapshot.transform)
          );
        })
      );
    },
    acceptTransform(index: number): void {
      const snapshot = snapshots.find(item => item.index === index);
      if (snapshot) {
        snapshot.transform.copy(entries.require(index).transform);
      }
    },
  };
}
