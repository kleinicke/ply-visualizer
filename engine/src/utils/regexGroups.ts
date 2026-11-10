/**
 * Groups names by the value a regular expression captures.
 *
 * The first capture group's text is the group key (the whole match if the
 * pattern has no group). Names that do not match, or capture an empty
 * string, go to the NO_MATCH group. Groups keep the order of their first
 * member. `rests` is each name with the captured text removed: two files in
 * different groups with the same rest are "the same item" in their groups
 * (e.g. kitchen/methodA.ply and office/methodA.ply), which is how a selection
 * carries over when switching groups.
 */
export interface RegexGroup<T> {
  key: string;
  members: T[];
  rests: string[];
}

export const NO_MATCH = '(no match)';

export type CompiledGroupRegex = { ok: true; regex: RegExp } | { ok: false; error: string };

export function compileGroupRegex(source: string): CompiledGroupRegex {
  if (!source) {
    return { ok: false, error: 'Enter a regular expression.' };
  }
  try {
    // `d` gives match indices, needed to cut the captured text out of rests.
    return { ok: true, regex: new RegExp(source, 'd') };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export function groupByRegex<T>(
  items: readonly T[],
  nameOf: (item: T) => string,
  regex: RegExp
): RegexGroup<T>[] {
  const order: string[] = [];
  const byKey = new Map<string, RegexGroup<T>>();
  for (const item of items) {
    const name = nameOf(item);
    regex.lastIndex = 0;
    const match = regex.exec(name);
    const captured = match ? (match[1] ?? match[0]) : undefined;
    let key = NO_MATCH;
    let rest = name;
    if (match && captured) {
      key = captured;
      const span = (match as RegExpExecArray & { indices?: [number, number][] }).indices?.[
        match[1] !== undefined ? 1 : 0
      ];
      if (span) {
        rest = name.slice(0, span[0]) + name.slice(span[1]);
      }
    }
    let group = byKey.get(key);
    if (!group) {
      group = { key, members: [], rests: [] };
      byKey.set(key, group);
      order.push(key);
    }
    group.members.push(item);
    group.rests.push(rest);
  }
  // "(no match)" last, so the real groups come first.
  return order
    .filter(key => key !== NO_MATCH)
    .concat(byKey.has(NO_MATCH) ? [NO_MATCH] : [])
    .map(key => byKey.get(key)!);
}

/** Path separator of the host OS ('/' outside the desktop app). */
export function hostPathSeparator(): string {
  const sep = (globalThis as { plyDesktop?: { pathSep?: string } }).plyDesktop?.pathSep;
  return sep === '\\' ? '\\' : '/';
}

function escapeForClass(sep: string): string {
  return sep === '\\' ? '\\\\' : sep;
}

/** Ready-made patterns; the folder one follows the OS separator. */
export function groupRegexPresets(): { label: string; source: string }[] {
  const s = escapeForClass(hostPathSeparator());
  return [
    { label: 'Top-level folder', source: `^([^${s}]+)${s}` },
    { label: 'First name part (before _ - . or space)', source: '^([^_\\-.\\s]+)' },
    { label: 'Everything before the last _', source: '^(.*)_[^_]*$' },
    { label: 'Trailing number', source: '(\\d+)\\.[^.]+$' },
  ];
}

export function folderGroupRegex(): string {
  return groupRegexPresets()[0].source;
}
