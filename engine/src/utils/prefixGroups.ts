/**
 * Groups names by their first `depth` parts. Parts are separated by any run of
 * `_ - . = space`; the extension is ignored. Only prefixes shared by at least
 * two names form a group. Groups keep the order of their first member.
 *
 *   kitchen_noise=0.01.ply, kitchen_noise=0.05.ply, office_a.ply
 *     depth 1 -> { kitchen: [0, 1] }      (office has one member: no group)
 *     depth 2 -> { kitchen_noise: [0, 1] }
 */
export interface PrefixGroup<T> {
  prefix: string;
  members: T[];
  /** Name with the prefix (and a following separator) removed. */
  rests: string[];
}

const SEP = /[_\-.=\s]+/g;

export function namePrefix(name: string, depth: number): string | null {
  const stem = name.replace(/\.[A-Za-z0-9]+$/, '');
  let end = 0;
  let parts = 0;
  SEP.lastIndex = 0;
  // Walk separator runs; the prefix ends at the depth-th one.
  for (let match = SEP.exec(stem); match; match = SEP.exec(stem)) {
    if (match.index === 0) {
      continue;
    }
    parts++;
    end = match.index;
    if (parts === depth) {
      return stem.slice(0, end);
    }
  }
  // Fewer separators than depth: the whole stem has no shared prefix to offer
  // unless it is exactly `depth` parts long.
  return parts + 1 === depth && stem ? stem : null;
}

export function groupByPrefix<T>(
  items: readonly T[],
  nameOf: (item: T) => string,
  depth: number,
  options: { minMembers?: number; fallbackToStem?: boolean } = {}
): PrefixGroup<T>[] {
  const minMembers = options.minMembers ?? 2;
  const order: string[] = [];
  const byPrefix = new Map<string, { members: T[]; rests: string[] }>();
  for (const item of items) {
    const name = nameOf(item);
    const prefix =
      namePrefix(name, depth) ??
      (options.fallbackToStem ? name.replace(/\.[A-Za-z0-9]+$/, '') || name : null);
    if (!prefix) {
      continue;
    }
    let group = byPrefix.get(prefix);
    if (!group) {
      group = { members: [], rests: [] };
      byPrefix.set(prefix, group);
      order.push(prefix);
    }
    group.members.push(item);
    group.rests.push(name.slice(prefix.length).replace(/^[_\-.=\s]+/, '') || name);
  }
  return order
    .map(prefix => ({ prefix, ...byPrefix.get(prefix)! }))
    .filter(group => group.members.length >= minMembers);
}
