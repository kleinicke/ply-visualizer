import type { FileEntry, FileEntryRegistry } from './state/fileEntries';
import { soloState } from './state/solo.svelte';
import { fileGroupsState, saveFileGroups } from './state/fileGroups.svelte';
import { groupByPrefix, type PrefixGroup } from './utils/prefixGroups';
import type { ViewerLifetime } from './utils/viewerLifetime';

/**
 * Layered visibility: scene scope + DAW-style solo, over each entry's own
 * visibility setting (its checkbox, "mute").
 *
 *   effective = inActiveScene && (soloActive ? soloed : ownVisible)
 *
 * While any layer is active, the own settings live in `soloState.saved` and
 * `entry.state.visible` holds the effective value, so every renderer/picker
 * that reads it stays correct without knowing about layers. When the last
 * layer ends, the own settings are written back.
 *
 * Scenes ("Group by prefix"): files whose names share their first N parts form
 * a scene; only one scene is listed and drawn at a time. Switching scenes
 * keeps the solo on the same method (the name after the scene prefix).
 *
 * Solo: 1-9 / click S = exclusive solo (again = end); Shift+1-9 / Ctrl-click =
 * add/remove; [ ] ↑ ↓ step; 0 / Esc end. Scenes: ← → , . PageUp PageDown
 * (← → step solo instead when there is only one scene).
 * Children (camera frames of a scan, …) follow their top-level parent.
 */
export interface SoloHost {
  lifetime: ViewerLifetime;
  fileEntries: FileEntryRegistry;
  sequenceMode: boolean;
  setFileEntryVisibility(index: number, visible: boolean): void;
  requestRender(): void;
  showStatus(message: string): void;
}

export function entryDisplayName(entry: FileEntry): string {
  return (
    entry.spatial?.data.fileName ??
    entry.pose?.meta.fileName ??
    entry.camera?.name ??
    `Object ${entry.id}`
  );
}

export class SoloController {
  private reconcileQueued = false;

  constructor(private readonly host: SoloHost) {}

  /** Solo is active. */
  get active(): boolean {
    return soloState.ids.length > 0;
  }

  /** Any layer (solo or scene scope) is active; own settings are in `saved`. */
  get layered(): boolean {
    return soloState.layered;
  }

  // ---- ordering and scenes -------------------------------------------------

  /** Every top-level entry in sidebar order. */
  topLevel(): FileEntry[] {
    return this.host.fileEntries.all
      .map((entry, index) => ({ entry, index }))
      .filter(({ entry }) => entry.parentId === null)
      .sort(
        (a, b) =>
          (a.entry.state.listOrder ?? Number.MAX_SAFE_INTEGER) -
            (b.entry.state.listOrder ?? Number.MAX_SAFE_INTEGER) || a.index - b.index
      )
      .map(({ entry }) => entry);
  }

  /** Top-level entries of the active scene; what number keys and stepping address. */
  soloable(): FileEntry[] {
    const scope = soloState.scopeIds;
    const all = this.topLevel();
    return scope ? all.filter(entry => scope.includes(entry.id)) : all;
  }

  /** Scenes, when grouping is on; every file belongs to exactly one. */
  groups(): PrefixGroup<FileEntry>[] {
    if (!fileGroupsState.enabled) {
      return [];
    }
    return groupByPrefix(this.topLevel(), entryDisplayName, fileGroupsState.depth, {
      minMembers: 1,
      fallbackToStem: true,
    });
  }

  activeGroup(groups = this.groups()): PrefixGroup<FileEntry> | null {
    return groups.find(group => group.prefix === fileGroupsState.active) ?? groups[0] ?? null;
  }

  /** Is this entry (or its top-level ancestor) in the active scene? */
  inScope(entry: FileEntry): boolean {
    const scope = soloState.scopeIds;
    if (!scope) {
      return true;
    }
    return scope.includes(this.topLevelOf(entry).id);
  }

  setGroupingEnabled(enabled: boolean): void {
    fileGroupsState.enabled = enabled;
    saveFileGroups();
    this.refreshScope();
  }

  setGroupDepth(depth: number): void {
    fileGroupsState.depth = Math.min(8, Math.max(1, depth));
    saveFileGroups();
    this.refreshScope();
  }

  setActiveGroup(prefix: string): void {
    const groups = this.groups();
    const previous = this.activeGroup(groups);
    const next = groups.find(group => group.prefix === prefix);
    if (!next) {
      return;
    }
    // Solo carries over by method: the part of the name after the prefix.
    let soloIds: number[] = [];
    let primaryId: number | null = null;
    if (this.active && previous && previous !== next) {
      const restOf = (group: PrefixGroup<FileEntry>, id: number) =>
        group.rests[group.members.findIndex(member => member.id === id)];
      for (const id of soloState.ids) {
        const rest = restOf(previous, id);
        const position = previous.members.findIndex(member => member.id === id);
        const match =
          next.members[next.rests.indexOf(rest)] ??
          (position >= 0 ? next.members[position] : undefined);
        if (match && !soloIds.includes(match.id)) {
          soloIds.push(match.id);
          if (id === soloState.primaryId) {
            primaryId = match.id;
          }
        }
      }
      primaryId ??= soloIds[soloIds.length - 1] ?? null;
    } else {
      soloIds = soloState.ids;
      primaryId = soloState.primaryId;
    }
    fileGroupsState.active = next.prefix;
    saveFileGroups();
    soloState.ids = soloIds;
    soloState.primaryId = primaryId;
    this.refreshScope();
  }

  stepGroup(delta: number): void {
    const groups = this.groups();
    if (groups.length < 2) {
      return;
    }
    const current = groups.indexOf(this.activeGroup(groups)!);
    const next = groups[(current + delta + groups.length) % groups.length];
    this.setActiveGroup(next.prefix);
    this.host.showStatus(`Scene: ${next.prefix}`);
  }

  /** Recomputes the active scene from the current files and settings. */
  refreshScope(): void {
    const group = this.activeGroup();
    const scope = fileGroupsState.enabled && group ? group.members.map(member => member.id) : null;
    if (scope) {
      this.begin();
      soloState.scopeIds = scope;
      // Solo outside the scene means nothing; drop it.
      const ids = soloState.ids.filter(id => scope.includes(id));
      if (ids.length !== soloState.ids.length) {
        soloState.ids = ids;
        if (soloState.primaryId !== null && !ids.includes(soloState.primaryId)) {
          soloState.primaryId = ids[ids.length - 1] ?? null;
        }
      }
      this.apply();
    } else {
      soloState.scopeIds = null;
      this.settle();
    }
  }

  // ---- own visibility ------------------------------------------------------

  isSoloed(id: number): boolean {
    return soloState.ids.includes(id);
  }

  /** The user's own visibility setting, which the layers leave untouched. */
  baseVisible(entry: FileEntry): boolean {
    if (this.layered && entry.id in soloState.saved) {
      return soloState.saved[entry.id];
    }
    return entry.state.visible ?? true;
  }

  /** Changes an entry's own setting; takes effect now or when layers end. */
  setBaseVisible(entry: FileEntry, visible: boolean): void {
    if (!this.layered) {
      const index = this.host.fileEntries.indexOf(entry.id);
      if (index >= 0) {
        this.host.setFileEntryVisibility(index, visible);
      }
      return;
    }
    soloState.saved[entry.id] = visible;
    this.apply();
  }

  // ---- solo ----------------------------------------------------------------

  soloExclusive(id: number): void {
    if (soloState.ids.length === 1 && soloState.ids[0] === id) {
      this.exit();
      return;
    }
    this.begin();
    soloState.ids = [id];
    soloState.primaryId = id;
    this.apply();
  }

  toggleAdditive(id: number): void {
    if (this.isSoloed(id)) {
      const ids = soloState.ids.filter(other => other !== id);
      if (!ids.length) {
        this.exit();
        return;
      }
      soloState.ids = ids;
      if (soloState.primaryId === id) {
        soloState.primaryId = ids[ids.length - 1];
      }
    } else {
      this.begin();
      soloState.ids = [...soloState.ids, id];
      soloState.primaryId = id;
    }
    this.apply();
  }

  soloNth(n: number, additive: boolean): void {
    const target = this.soloable()[n];
    if (!target) {
      return;
    }
    if (additive) {
      this.toggleAdditive(target.id);
    } else {
      this.soloExclusive(target.id);
    }
  }

  step(delta: number): void {
    const list = this.soloable();
    if (!list.length) {
      return;
    }
    const current = list.findIndex(entry => entry.id === soloState.primaryId);
    const next =
      !this.active || current < 0
        ? delta > 0
          ? 0
          : list.length - 1
        : (current + delta + list.length) % list.length;
    const id = list[next].id;
    this.begin();
    soloState.ids = [id];
    soloState.primaryId = id;
    this.apply();
  }

  /** Ends solo; the scene scope (if any) stays. */
  exit(): void {
    if (!this.active) {
      return;
    }
    soloState.ids = [];
    soloState.primaryId = null;
    this.settle();
  }

  // ---- layer bookkeeping ---------------------------------------------------

  /** Called whenever the registry changes (load, remove, reorder). */
  entriesChanged(): void {
    if (this.reconcileQueued || (!this.layered && !fileGroupsState.enabled)) {
      return;
    }
    // A loader commits an entry and then assigns its initial visibility in the
    // same synchronous block; reconcile after that so the layers have the last word.
    this.reconcileQueued = true;
    setTimeout(() => {
      this.reconcileQueued = false;
      this.reconcile();
    }, 0);
  }

  private reconcile(): void {
    const present = new Set(this.host.fileEntries.all.map(entry => entry.id));
    if (this.layered) {
      for (const key of Object.keys(soloState.saved)) {
        if (!present.has(Number(key))) {
          delete soloState.saved[Number(key)];
        }
      }
      for (const entry of this.host.fileEntries.all) {
        if (!(entry.id in soloState.saved)) {
          soloState.saved[entry.id] = entry.state.visible ?? true;
        }
      }
    }
    const ids = soloState.ids.filter(id => present.has(id));
    if (ids.length !== soloState.ids.length) {
      soloState.ids = ids;
    }
    if (soloState.primaryId !== null && !present.has(soloState.primaryId)) {
      soloState.primaryId = ids[ids.length - 1] ?? null;
    }
    this.refreshScope();
  }

  private begin(): void {
    if (this.layered) {
      return;
    }
    const saved: Record<number, boolean> = {};
    for (const entry of this.host.fileEntries.all) {
      saved[entry.id] = entry.state.visible ?? true;
    }
    soloState.saved = saved;
    soloState.layered = true;
  }

  /** Re-applies, or, when no layer is left, restores the own settings. */
  private settle(): void {
    if (!this.layered) {
      return;
    }
    if (this.active || soloState.scopeIds) {
      this.apply();
      return;
    }
    const saved = soloState.saved;
    soloState.layered = false;
    soloState.saved = {};
    this.host.fileEntries.all.forEach((entry, index) => {
      const visible = entry.id in saved ? saved[entry.id] : (entry.state.visible ?? true);
      if ((entry.state.visible ?? true) !== visible) {
        this.host.setFileEntryVisibility(index, visible);
      }
    });
    this.host.requestRender();
  }

  private topLevelOf(entry: FileEntry): FileEntry {
    let current = entry;
    while (current.parentId !== null) {
      const parent = this.host.fileEntries.get(current.parentId);
      if (!parent) {
        break;
      }
      current = parent;
    }
    return current;
  }

  private shownBySolo(entry: FileEntry): boolean {
    const ids = new Set(soloState.ids);
    for (
      let current: FileEntry | undefined = entry;
      current;
      current = current.parentId === null ? undefined : this.host.fileEntries.get(current.parentId)
    ) {
      if (ids.has(current.id)) {
        return true;
      }
    }
    return false;
  }

  private apply(): void {
    if (!this.layered) {
      return;
    }
    this.host.fileEntries.all.forEach((entry, index) => {
      const own = entry.id in soloState.saved ? soloState.saved[entry.id] : true;
      const visible = this.inScope(entry) && (this.active ? this.shownBySolo(entry) : own);
      if ((entry.state.visible ?? true) !== visible) {
        this.host.setFileEntryVisibility(index, visible);
      }
    });
    this.host.requestRender();
  }

  /** Keyboard bindings; installed once per viewer. */
  installShortcuts(): void {
    this.host.lifetime.listen(document, 'keydown', (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey || this.host.sequenceMode) {
        return;
      }
      const digit = /^Digit([0-9])$/.exec(event.code) ?? /^Numpad([0-9])$/.exec(event.code);
      if (digit) {
        const n = Number(digit[1]);
        if (n === 0) {
          this.exit();
        } else {
          this.soloNth(n - 1, event.shiftKey);
        }
        event.preventDefault();
        return;
      }
      // ←/→ switch scenes when there are scenes, otherwise they step solo.
      const scenes = this.groups().length > 1;
      switch (event.key) {
        case 'ArrowLeft':
        case 'ArrowRight':
          if (scenes) {
            this.stepGroup(event.key === 'ArrowLeft' ? -1 : 1);
          } else {
            this.step(event.key === 'ArrowLeft' ? -1 : 1);
          }
          event.preventDefault();
          return;
        case '[':
        case 'ArrowUp':
          this.step(-1);
          event.preventDefault();
          return;
        case ']':
        case 'ArrowDown':
          this.step(1);
          event.preventDefault();
          return;
        case ',':
        case 'PageUp':
          this.stepGroup(-1);
          event.preventDefault();
          return;
        case '.':
        case 'PageDown':
          this.stepGroup(1);
          event.preventDefault();
          return;
        case 'Escape':
          if (this.active) {
            this.exit();
          }
          return;
      }
    });
  }
}
