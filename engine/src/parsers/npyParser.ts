/**
 * NPY arrays as point clouds.
 *
 * The array is a point list when its last dimension is 3 - `(N,3)`, `(H,W,3)`,
 * `(B,H,W,3)`, any rank - and everything before that dimension is flattened, so
 * a grid of points and a list of points read the same way.
 *
 * The reading itself is Rust (`wasm/pointcloud-parser/src/npy.rs`), shared with
 * the depth reader, which used to carry its own copy of the header parser. What
 * is left here is the point-cloud interpretation of the result.
 */

import { isNpyPointCloudShape, readNpyWasm } from './pointcloudWasm';
import { SpatialData } from './plyParser';

export class NpyParser {
  async parse(data: Uint8Array, timingCallback?: (message: string) => void): Promise<SpatialData> {
    const log = timingCallback || console.log;
    log(`📋 Parser: Starting NPY point cloud parsing (${data.length} bytes)...`);

    const array = await readNpyWasm(data);
    if (!isNpyPointCloudShape(array.shape)) {
      throw new Error(
        `Expected NPY array ending with dimension 3 for XYZ coordinates, got shape [${array.shape.join(', ')}]`
      );
    }

    const vertexCount = array.values.length / 3;
    log(
      `📋 Parser: NPY array shape [${array.shape.join(', ')}] contains ${vertexCount} points ` +
        `(${array.shape.length}D array flattened)`
    );

    return {
      vertices: [],
      faces: [],
      // NPY is binary, but the viewer's format field distinguishes PLY
      // encodings; 'ascii' is what this path has always reported.
      format: 'ascii',
      version: '1.0',
      comments: [
        `Converted from NPY array with shape [${array.shape.join(', ')}]`,
        `Data type: ${array.dtype}`,
      ],
      vertexCount,
      faceCount: 0,
      hasColors: false,
      hasNormals: false,
      // The Rust reader returns the flat XYZ buffer the geometry wants, so this
      // path no longer builds a JavaScript object per point.
      useTypedArrays: true,
      positionsArray: array.values,
      colorsArray: null,
      normalsArray: null,
      intensityArray: null,
      scalarFields: {},
    };
  }
}
