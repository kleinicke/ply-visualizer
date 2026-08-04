/**
 * Stable identity and ordering for everything the file list shows.
 *
 * The panel addresses entries by a single "unified index" that spans three
 * collections in display order: `spatialFiles`, then `poseGroups`, then
 * `cameraGroups`. That index used to be recomputed at every call site as
 * `spatialFiles.length + poseGroups.length + cameraIndex`, which made an
 * existing entry's address depend on what was loaded *after* it: adding a point
 * cloud once a camera profile was on screen shifted every camera up one slot
 * while their per-entry state (visibility, scale, colour mode, transform)
 * stayed put, so the state silently attached to the wrong row.
 *
 * This registry owns the ordering instead. An entry's `id` is assigned once and
 * never reused, callers ask for indices rather than deriving them, and
 * insertion happens at the end of the entry's own kind block instead of the end
 * of the array.
 *
 * `parentId` is unused by the current loaders but is the reason the registry
 * exists in this shape: container formats that publish a cloud *and* their own
 * cameras (X3A and E57 today, COLMAP reconstructions later) need to say which
 * entries belong to which, rather than encoding it in a scene-graph name
 * prefix the way visualization/cameraFrames.ts has to.
 */

export type FileEntryKind = 'spatial' | 'pose' | 'camera';

export interface FileEntry {
  /** Assigned once, never reused, stable across insertions and removals. */
  readonly id: number;
  readonly kind: FileEntryKind;
  /** Entry that produced this one, for container formats; null at top level. */
  parentId: number | null;
}

/**
 * Display order of the kind blocks. The unified index follows it, so the
 * registry keeps its entries sorted this way and nothing else has to know.
 */
const KIND_ORDER: readonly FileEntryKind[] = ['spatial', 'pose', 'camera'];

export class FileEntryRegistry {
  private entries: FileEntry[] = [];
  private nextId = 1;

  /** Number of entries across every kind; the file list's row count. */
  get length(): number {
    return this.entries.length;
  }

  countOf(kind: FileEntryKind): number {
    return this.entries.reduce((total, entry) => total + (entry.kind === kind ? 1 : 0), 0);
  }

  /**
   * First unified index of a kind's block. Also where the next entry of that
   * kind is inserted, which is what makes ordering independent of load order.
   */
  startOf(kind: FileEntryKind): number {
    const rank = KIND_ORDER.indexOf(kind);
    let start = 0;
    for (const entry of this.entries) {
      if (KIND_ORDER.indexOf(entry.kind) < rank) {
        start++;
      }
    }
    return start;
  }

  /** Appends to the end of `kind`'s block and reports where it landed. */
  add(kind: FileEntryKind, parentId: number | null = null): { entry: FileEntry; index: number } {
    const entry: FileEntry = { id: this.nextId++, kind, parentId };
    const index = this.startOf(kind) + this.countOf(kind);
    this.entries.splice(index, 0, entry);
    return { entry, index };
  }

  /**
   * Drops the entry at a unified index, and any entry that named it as a
   * parent, and so on down.
   *
   * Returns everything removed in **descending index order**, which is what
   * makes the caller's job safe: splicing its own per-entry arrays from the
   * highest index first leaves earlier positions valid. Removing a container
   * without its children would strand their scene objects with no row to
   * control them.
   */
  removeAt(index: number): { entry: FileEntry; index: number }[] {
    if (!this.entries[index]) {
      return [];
    }
    const doomed = new Set<number>([this.entries[index].id]);
    // Repeat to a fixed point so grandchildren go too, whatever the order.
    for (let changed = true; changed; ) {
      changed = false;
      for (const entry of this.entries) {
        if (entry.parentId !== null && doomed.has(entry.parentId) && !doomed.has(entry.id)) {
          doomed.add(entry.id);
          changed = true;
        }
      }
    }

    const removed: { entry: FileEntry; index: number }[] = [];
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (doomed.has(this.entries[i].id)) {
        removed.push({ entry: this.entries[i], index: i });
        this.entries.splice(i, 1);
      }
    }
    return removed;
  }

  at(index: number): FileEntry | null {
    return this.entries[index] ?? null;
  }

  kindAt(index: number): FileEntryKind | null {
    return this.entries[index]?.kind ?? null;
  }

  /** Unified index of an entry id, or -1 if it is no longer registered. */
  indexOf(id: number): number {
    return this.entries.findIndex(entry => entry.id === id);
  }

  /** Unified index of the `kindIndex`-th entry of `kind`, or -1. */
  indexOfKind(kind: FileEntryKind, kindIndex: number): number {
    if (kindIndex < 0 || kindIndex >= this.countOf(kind)) {
      return -1;
    }
    return this.startOf(kind) + kindIndex;
  }

  /**
   * Position of a unified index inside its own kind's collection - the index
   * into `spatialFiles`, `poseGroups` or `cameraGroups` - or -1.
   */
  kindIndexAt(index: number): number {
    const entry = this.entries[index];
    if (!entry) {
      return -1;
    }
    return index - this.startOf(entry.kind);
  }

  childrenOf(id: number): FileEntry[] {
    return this.entries.filter(entry => entry.parentId === id);
  }

  clear(): void {
    this.entries = [];
  }
}
