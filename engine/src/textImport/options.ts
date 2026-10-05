export interface TextImportOptions {
  mode: 'xyz' | 'grid';
  delimiter: string;
  skipRows: number;
  columns: [number, number, number];
  spacing: [number, number];
  scale: number;
  missing: string;
}

export function suggestTextOptions(sample: string): TextImportOptions {
  const lines = sample
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .slice(0, 30);
  const delimiter = lines.some(l => l.includes('\t'))
    ? 'tab'
    : lines.some(l => l.includes(';'))
      ? 'semicolon'
      : lines.some(l => l.includes(','))
        ? 'comma'
        : 'whitespace';
  const split = (line: string) =>
    (delimiter === 'whitespace' ? line.trim() : line)
      .split(
        delimiter === 'tab'
          ? '\t'
          : delimiter === 'semicolon'
            ? ';'
            : delimiter === 'comma'
              ? ','
              : /\s+/
      )
      .map(v => v.trim().replace(/^"|"$/g, ''));
  const header = lines.findIndex(l =>
    ['x', 'y', 'z'].every(axis =>
      split(l)
        .map(v => v.toLowerCase())
        .includes(axis)
    )
  );
  const firstNumeric = lines.findIndex(
    l =>
      l.trim().length > 0 &&
      split(l).every(v => v === '' || Number.isFinite(Number(v)) || /^(nan|na)$/i.test(v))
  );
  const columns =
    header >= 0
      ? (['x', 'y', 'z'].map(axis =>
          split(lines[header])
            .map(v => v.toLowerCase())
            .indexOf(axis)
        ) as [number, number, number])
      : ([0, 1, 2] as [number, number, number]);
  const width = firstNumeric >= 0 ? split(lines[firstNumeric]).length : 3;
  return {
    mode: header >= 0 || width === 3 ? 'xyz' : 'grid',
    delimiter,
    skipRows: header >= 0 ? header + 1 : Math.max(0, firstNumeric),
    columns,
    spacing: [1, 1],
    scale: 1,
    missing: '',
  };
}
