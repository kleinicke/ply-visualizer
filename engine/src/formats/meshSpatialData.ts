import type { SpatialData } from '../interfaces';
import type { ObjMesh, OffMesh, StlMesh } from '../parsers/pointcloudWasm';

/**
 * Packed mesh decodes (Rust STL/OFF/OBJ) turned into the viewer's file data.
 *
 * Shared by every host - the extension's webview handlers and the standalone
 * page's format registry - so a mesh looks the same wherever it was opened.
 * Each produces the typed-array form `MeshBuilder` consumes directly; the
 * vertex/face object arrays stay empty.
 */

interface FileFacts {
  fileName: string;
  shortPath?: string;
  fileSizeInBytes?: number;
}

/** Uniform grey for formats that have no colour of their own (OBJ). */
function greyColors(vertexCount: number, level: number): Uint8Array {
  return new Uint8Array(vertexCount * 3).fill(level);
}

export function stlSpatialData(stl: StlMesh, facts: FileFacts): SpatialData {
  const format = stl.format === 'binary' ? 'binary_little_endian' : 'ascii';
  const header = stl.header ? [`Header: ${stl.header}`] : [];
  if (stl.triangleCount === 0) {
    return {
      vertices: [],
      faces: [],
      format,
      version: '1.0',
      comments: [`Empty STL mesh: ${facts.fileName}`, `Original format: ${stl.format}`, ...header],
      vertexCount: 0,
      faceCount: 0,
      hasColors: false,
      hasNormals: false,
      fileName: facts.fileName.replace(/\.stl$/i, '_empty.ply'),
      shortPath: facts.shortPath,
      fileSizeInBytes: facts.fileSizeInBytes,
    };
  }
  return Object.assign(
    {
      vertices: [],
      faces: [],
      format,
      version: '1.0',
      comments: [
        `Converted from STL file: ${facts.fileName}`,
        `Original format: ${stl.format}`,
        `Triangle count: ${stl.triangleCount}`,
        ...header,
      ],
      vertexCount: stl.vertexCount,
      faceCount: stl.triangleCount,
      // Every welded vertex has a colour: the file's RGB565 one, or grey.
      hasColors: true,
      hasNormals: true,
      fileName: facts.fileName,
      shortPath: facts.shortPath,
      fileSizeInBytes: facts.fileSizeInBytes,
      useTypedArrays: true,
      positionsArray: stl.positionsArray,
      normalsArray: stl.normalsArray,
      colorsArray: stl.colorsArray,
      indicesArray: stl.indicesArray,
    } satisfies SpatialData,
    {
      isStlFile: true,
      stlFormat: stl.format,
      stlTriangleCount: stl.triangleCount,
      stlData: {
        format: stl.format,
        header: stl.header,
        triangleCount: stl.triangleCount,
        hasColors: stl.sourceHasColors,
      },
    }
  );
}

export function offSpatialData(off: OffMesh, facts: FileFacts): SpatialData {
  return {
    vertices: [],
    faces: [],
    format: 'ascii',
    version: '1.0',
    comments: [
      `Converted from OFF: ${facts.fileName}`,
      `OFF variant: ${off.offVariant}`,
      ...off.comments,
    ],
    vertexCount: off.vertexCount,
    faceCount: off.triangleCount,
    hasColors: off.hasColors,
    hasNormals: off.hasNormals,
    fileName: facts.fileName,
    shortPath: facts.shortPath,
    fileSizeInBytes: facts.fileSizeInBytes,
    useTypedArrays: true,
    positionsArray: off.positionsArray,
    normalsArray: off.normalsArray,
    colorsArray: off.colorsArray,
    indicesArray: off.indicesArray,
  };
}

/** Faces, line segments and points that share one `usemtl` material. */
export interface ObjMaterialGroup {
  material: string;
  /** Polygon ids into the OBJ's face list. */
  faces: Uint32Array;
  /** Segment ids into `lineIndices` (two vertices each). */
  lines: Uint32Array;
  /** Point ids into `pointIndices`. */
  points: Uint32Array;
}

/** The OBJ facts the viewer keeps beside the geometry. */
export interface ObjFileData extends ObjMesh {
  materialGroups: ObjMaterialGroup[];
}

/**
 * Group geometry by material in the order the viewer always used: materials
 * as first met among the points, then the lines, then the faces. Elements
 * with no `usemtl` belong to `default`.
 */
export function objMaterialGroups(obj: ObjMesh): ObjMaterialGroup[] {
  // Grouped by name, as before: an explicit `usemtl default` shares its group
  // with the elements that have no material at all.
  const nameOf = (id: number) => (id === 0 ? 'default' : obj.materialNames[id]);
  const order: string[] = [];
  const buckets = new Map<string, { faces: number; lines: number; points: number }>();
  const kinds = [
    { kind: 'points', count: obj.pointCount, ids: obj.pointMaterials },
    { kind: 'lines', count: obj.lineCount, ids: obj.lineMaterials },
    { kind: 'faces', count: obj.faceCount, ids: obj.faceMaterials },
  ] as const;
  for (const { kind, count, ids } of kinds) {
    for (let i = 0; i < count; i++) {
      const name = nameOf(ids ? ids[i] : 0);
      let sizes = buckets.get(name);
      if (!sizes) {
        sizes = { faces: 0, lines: 0, points: 0 };
        buckets.set(name, sizes);
        order.push(name);
      }
      sizes[kind]++;
      if (!ids) {
        // One material for the whole list: count it without visiting each.
        sizes[kind] += count - 1;
        break;
      }
    }
  }
  const groups = new Map<string, ObjMaterialGroup>();
  for (const name of order) {
    const sizes = buckets.get(name)!;
    groups.set(name, {
      material: name,
      faces: new Uint32Array(sizes.faces),
      lines: new Uint32Array(sizes.lines),
      points: new Uint32Array(sizes.points),
    });
  }
  // Fill each group's id lists in file order.
  for (const { kind, count, ids } of kinds) {
    if (!ids) {
      const list = count > 0 ? groups.get('default')![kind] : null;
      for (let i = 0; i < count; i++) {
        list![i] = i;
      }
      continue;
    }
    const filled = new Map<string, number>();
    for (let i = 0; i < count; i++) {
      const name = nameOf(ids ? ids[i] : 0);
      const at = filled.get(name) ?? 0;
      groups.get(name)![kind][at] = i;
      filled.set(name, at + 1);
    }
  }
  return order.map(name => groups.get(name)!);
}

/**
 * The polygon corners of an OBJ face, recovered from its fan triangulation:
 * triangle k of a face is (c0, c[k+1], c[k+2]), so the corners are the first
 * triangle plus the last vertex of each later one.
 */
export function objFaceCorners(obj: ObjMesh, triangleStarts: Uint32Array, face: number): number[] {
  const first = triangleStarts[face];
  const triangles = triangleStarts[face + 1] - first;
  const at = first * 3;
  const corners = [obj.indicesArray[at], obj.indicesArray[at + 1], obj.indicesArray[at + 2]];
  for (let t = 1; t < triangles; t++) {
    corners.push(obj.indicesArray[at + t * 3 + 2]);
  }
  return corners;
}

/** First triangle of each face, plus one past the last, from `faceSizes`. */
export function objTriangleStarts(obj: ObjMesh): Uint32Array {
  const starts = new Uint32Array(obj.faceCount + 1);
  for (let face = 0; face < obj.faceCount; face++) {
    const size = obj.faceSizes ? obj.faceSizes[face] : 3;
    starts[face + 1] = starts[face] + size - 2;
  }
  return starts;
}

export function objSpatialData(obj: ObjMesh, facts: FileFacts): SpatialData {
  const hasFaces = obj.faceCount > 0;
  const objData: ObjFileData = { ...obj, materialGroups: objMaterialGroups(obj) };
  return Object.assign(
    {
      vertices: [],
      faces: [],
      format: 'ascii',
      version: '1.0',
      comments: [`Converted from OBJ file: ${facts.fileName}`],
      vertexCount: obj.vertexCount,
      faceCount: hasFaces ? obj.indicesArray.length / 3 : 0,
      // The viewer has always drawn OBJ vertices in a flat mid grey.
      hasColors: true,
      // OBJ normals are indexed per face corner, not per vertex; they stay in
      // objData and the geometry gets its own.
      hasNormals: false,
      fileName: facts.fileName,
      shortPath: facts.shortPath,
      fileSizeInBytes: facts.fileSizeInBytes,
      useTypedArrays: true,
      positionsArray: obj.positionsArray,
      colorsArray: greyColors(obj.vertexCount, 128),
      normalsArray: null,
      indicesArray: hasFaces ? obj.indicesArray : null,
    } satisfies SpatialData,
    {
      objData,
      isObjFile: true,
      objRenderType: hasFaces ? 'mesh' : 'wireframe',
      ...(obj.lineCount > 0 ? { objLines: obj.lineIndices, hasWireframe: true } : {}),
      ...(obj.pointCount > 0 ? { objPoints: obj.pointIndices, hasPoints: true } : {}),
    }
  );
}
