import { Object3D, Mesh, Points, Line, type BufferGeometry } from 'three';
import type { SpatialData } from '../interfaces';

/** Validate decoded geometry before allocating GPU resources. Scalar NaNs are
 * deliberate missing values; polygon faces need not already be triangulated. */
export function validateSpatialData(value: unknown): asserts value is SpatialData {
  const fail = (field: string, detail: string): never => {
    throw new Error(`Invalid geometry: ${field} ${detail}`);
  };
  if (!value || typeof value !== 'object') {
    fail('data', 'must be an object');
  }
  const data = value as SpatialData;
  for (const key of ['vertexCount', 'faceCount'] as const) {
    if (!Number.isSafeInteger(data[key]) || data[key] < 0) {
      fail(key, 'must be a non-negative integer');
    }
  }
  if (!Array.isArray(data.vertices) || !Array.isArray(data.faces)) {
    fail('vertices/faces', 'must be arrays');
  }
  if (typeof data.hasColors !== 'boolean' || typeof data.hasNormals !== 'boolean') {
    fail('attribute flags', 'must be booleans');
  }
  if (
    !['ascii', 'binary_little_endian', 'binary_big_endian'].includes(data.format) ||
    typeof data.version !== 'string' ||
    !Array.isArray(data.comments) ||
    !data.comments.every(x => typeof x === 'string')
  ) {
    fail('metadata', 'requires format, version and string comments');
  }
  for (const key of ['useTypedArrays', 'hasIntensity'] as const) {
    if (data[key] !== undefined && typeof data[key] !== 'boolean') {
      fail(key, 'must be a boolean');
    }
  }
  const typed = data.useTypedArrays === true;
  const length = (name: string, array: ArrayLike<unknown>, expected: number) => {
    if (array.length !== expected) {
      fail(name, `has ${array.length} values; expected ${expected}`);
    }
  };
  if (typed) {
    if (!(data.positionsArray instanceof Float32Array)) {
      fail('positionsArray', 'must be Float32Array');
    }
    length('positionsArray', data.positionsArray!, data.vertexCount * 3);
  } else {
    length('vertices', data.vertices, data.vertexCount);
    for (let i = 0; i < data.vertices.length; i++) {
      const vertex = data.vertices[i];
      for (const key of ['x', 'y', 'z'] as const) {
        if (!vertex || typeof vertex[key] !== 'number') {
          fail(`vertices[${i}].${key}`, 'must be numeric');
        }
      }
      for (const [enabled, keys] of [
        [data.hasColors, ['red', 'green', 'blue']],
        [data.hasNormals, ['nx', 'ny', 'nz']],
      ] as const) {
        if (enabled && keys.some(key => typeof vertex[key] !== 'number')) {
          fail(`vertices[${i}]`, `is missing ${keys.join('/')}`);
        }
      }
    }
  }
  for (const [key, Type, count] of [
    ['positionsArray', Float32Array, data.vertexCount * 3],
    ['colorsArray', Uint8Array, data.vertexCount * 3],
    ['normalsArray', Float32Array, data.vertexCount * 3],
    ['intensityArray', Float32Array, data.vertexCount],
    ['sourcePointIndices', Uint32Array, data.vertexCount],
  ] as const) {
    const array = data[key];
    if (array != null) {
      // A built point cloud's normals may already be packed (utils/normals.ts).
      const packedNormals = key === 'normalsArray' && array instanceof Int16Array;
      if (!(array instanceof Type) && !packedNormals) {
        fail(key, `must be ${Type.name}`);
      }
      length(key, array, count);
    }
  }
  if (typed && data.hasColors && !data.colorsArray) {
    fail('colorsArray', 'is required when hasColors is true');
  }
  if (typed && data.hasNormals && !data.normalsArray) {
    fail('normalsArray', 'is required when hasNormals is true');
  }
  if (data.scalarFields != null) {
    if (typeof data.scalarFields !== 'object' || Array.isArray(data.scalarFields)) {
      fail('scalarFields', 'must be a record');
    }
    for (const [name, array] of Object.entries(data.scalarFields)) {
      if (!(
        array instanceof Float32Array ||
        array instanceof Uint8Array ||
        array instanceof Uint16Array ||
        array instanceof Int16Array
      )) {
        fail(`scalarFields.${name}`, 'must be Float32Array, Uint8Array, Uint16Array or Int16Array');
      }
      length(`scalarFields.${name}`, array, data.vertexCount);
    }
  }
  const checkIndex = (index: number) => {
    if (!Number.isInteger(index) || index < 0 || index >= data.vertexCount) {
      fail('face index', `${index} is outside 0..${data.vertexCount - 1}`);
    }
  };
  if (data.indicesArray != null) {
    if (!(data.indicesArray instanceof Uint32Array)) {
      fail('indicesArray', 'must be Uint32Array');
    }
    length('indicesArray', data.indicesArray, data.faceCount * 3);
    // Uint32 entries are non-negative integers by construction, so only the
    // upper bound needs checking - one tight loop over millions of indices.
    const indices = data.indicesArray;
    let max = 0;
    for (let i = 0; i < indices.length; i++) {
      if (indices[i] > max) {
        max = indices[i];
      }
    }
    if (indices.length > 0) {
      checkIndex(max);
    }
  } else if (data.sceneModel) {
    // Native loaders preserve their original scene. faceCount summarizes that
    // scene; the wrapper's positions are only a bounds/selection snapshot.
    if (
      !(data.sceneModel.root instanceof Object3D) ||
      typeof data.sceneModel.dispose !== 'function'
    ) {
      fail('sceneModel', 'requires an owned Three.js scene');
    }
    data.sceneModel.root.traverse(object => {
      if (!(object instanceof Mesh || object instanceof Points || object instanceof Line)) {
        return;
      }
      const geometry: BufferGeometry = object.geometry;
      const position = geometry.getAttribute('position');
      if (!position || position.itemSize !== 3 || !Number.isSafeInteger(position.count)) {
        fail('scene position', 'must contain complete XYZ vertices');
      }
      for (const [name, attribute] of Object.entries(geometry.attributes)) {
        if (
          attribute.count !== position.count &&
          !(attribute as { isInstancedBufferAttribute?: boolean }).isInstancedBufferAttribute
        ) {
          fail(`scene ${name}`, 'count must match the position count');
        }
      }
      if (geometry.index) {
        for (let i = 0; i < geometry.index.count; i++) {
          const index = geometry.index.getX(i);
          if (!Number.isInteger(index) || index < 0 || index >= position.count) {
            fail('scene face index', `${index} is outside the position buffer`);
          }
        }
      }
    });
  } else {
    length('faces', data.faces, data.faceCount);
    for (const face of data.faces) {
      if (!face || !Array.isArray(face.indices) || face.indices.length < 3) {
        fail('face', 'must have at least three indices');
      }
      for (const index of face.indices) {
        checkIndex(index);
      }
    }
  }
}
