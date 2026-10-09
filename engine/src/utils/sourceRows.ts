import type { SpatialData } from '../interfaces';

/**
 * The original source row of each decoded point, where a format tracks it.
 *
 * Formats that drop rows (PCD writes invalid range pixels as NaN points)
 * carry an explicit map. When none was dropped the map is the identity, and
 * the parser says so with `sourceRowsIdentity` instead of an index per point.
 * Read rows through these helpers so both forms answer the same.
 */
type RowSource = Pick<SpatialData, 'sourcePointIndices' | 'sourceRowsIdentity' | 'vertexCount'>;

export function hasSourceRows(data: RowSource): boolean {
  return !!data.sourcePointIndices?.length || data.sourceRowsIdentity === true;
}

export function sourceRowAt(data: RowSource, index: number): number | null {
  if (data.sourcePointIndices?.length) {
    return data.sourcePointIndices[index] ?? null;
  }
  return data.sourceRowsIdentity && index >= 0 && index < data.vertexCount ? index : null;
}

/** The whole map as an array, built on demand for the identity case. */
export function sourceRowsOf(data: RowSource): Uint32Array | undefined {
  if (data.sourcePointIndices?.length) {
    return data.sourcePointIndices;
  }
  if (data.sourceRowsIdentity) {
    const rows = new Uint32Array(data.vertexCount);
    for (let i = 0; i < rows.length; i++) {
      rows[i] = i;
    }
    return rows;
  }
  return undefined;
}
