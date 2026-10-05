import { Matrix4, type LineSegments, type Points, type Group, type Object3D } from 'three';
import type { MtlData } from '../parsers/mtlParser';

export type FileEntryKind = 'spatial' | 'pose' | 'camera';

export interface EntryPresentation {
  depthIsDefault: boolean;
  depthForm: import('../depth/panelState').DepthForm | null;
  visible: boolean;
  pointSize: number;
  colorMode: string;
  collapsed: boolean;
  liveDepth: boolean;
  depthPanelOpen: boolean;
  solidVisible: boolean;
  wireframeVisible: boolean;
  pointsVisible: boolean;
  normalsVisible: boolean;
  splatModeActive: boolean;
}

export function defaultEntryPresentation(): EntryPresentation {
  return {
    depthIsDefault: false,
    depthForm: null,
    visible: true,
    pointSize: 1,
    colorMode: 'assigned',
    collapsed: false,
    liveDepth: false,
    depthPanelOpen: false,
    solidVisible: false,
    wireframeVisible: false,
    pointsVisible: true,
    normalsVisible: false,
    splatModeActive: false,
  };
}

/** GPU resources stay outside Svelte's deep reactive state. */
export class FileEntry {
  readonly resources = {
    normals: null as LineSegments | null,
    vertexPoints: null as Points | null,
    materialGroup: null as Group | null,
    materialMeshes: null as Object3D[] | null,
    materialColor: null as number | null,
    materialName: null as string | null,
    materialData: null as MtlData | null,
  };
  readonly transform = new Matrix4();
  readonly depthUpdate = {
    version: 0,
    inFlight: false,
    queued: false,
    timer: undefined as number | undefined,
  };

  constructor(
    readonly id: number,
    readonly kind: FileEntryKind,
    public parentId: number | null,
    readonly state: EntryPresentation
  ) {}
}

/**
 * Display order of the kind blocks. The unified index follows it, so the
 * registry keeps its entries sorted this way and nothing else has to know.
 */
const KIND_ORDER: readonly FileEntryKind[] = ['spatial', 'pose', 'camera'];

export class FileEntryRegistry {
  private entries: FileEntry[] = [];
  private nextId = 1;

  constructor(
    private readonly presentation: () => EntryPresentation = defaultEntryPresentation,
    private readonly changed: (entries: readonly FileEntry[]) => void = () => {}
  ) {}

  get all(): readonly FileEntry[] {
    return this.entries;
  }

  require(index: number): FileEntry {
    const entry = this.entries[index];
    if (!entry) {
      throw new RangeError(`No file entry at index ${index}`);
    }
    return entry;
  }

  get(id: number): FileEntry | undefined {
    return this.entries.find(entry => entry.id === id);
  }

  private publish(): void {
    this.changed([...this.entries]);
  }

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

  prepare(kind: FileEntryKind, parentId: number | null = null): FileEntry {
    return new FileEntry(this.nextId++, kind, parentId, this.presentation());
  }

  commit(entry: FileEntry): number {
    if (this.get(entry.id)) {
      throw new Error('Entry already committed');
    }
    const index = this.startOf(entry.kind) + this.countOf(entry.kind);
    this.entries.splice(index, 0, entry);
    this.publish();
    return index;
  }

  /** Appends to the end of `kind`'s block and reports where it landed. */
  add(kind: FileEntryKind, parentId: number | null = null): { entry: FileEntry; index: number } {
    const entry = this.prepare(kind, parentId);
    const index = this.commit(entry);
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
    for (let changed = true; changed;) {
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
        const entry = this.entries[i];
        entry.depthUpdate.version++;
        if (entry.depthUpdate.timer !== undefined) {
          clearTimeout(entry.depthUpdate.timer);
        }
        removed.push({ entry, index: i });
        this.entries.splice(i, 1);
      }
    }
    this.publish();
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
    for (const entry of this.entries) {
      entry.depthUpdate.version++;
      clearTimeout(entry.depthUpdate.timer);
    }
    this.entries = [];
    this.publish();
  }
}
