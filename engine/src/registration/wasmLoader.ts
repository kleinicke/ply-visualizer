/**
 * Loads the registration wasm for callers that have no `Worker`.
 *
 * Two of those exist: the VS Code extension host, which is already its own
 * process so blocking it does not freeze the viewer, and Node (the test
 * suite). Both take the `nodejs` wasm-pack build, which is CommonJS and
 * initializes itself on require; the browser's `web` build is loaded by
 * `registrationWorker.ts` instead.
 *
 * The Node globals are declared locally with structural types rather than
 * pulled from `@types/node`: this file lives under `engine/src/`, which
 * type-checks as a browser bundle with no node types, while the same source is
 * compiled again for the extension host where they do exist. Module-scoped
 * declarations satisfy the first without colliding with the second.
 */

// eslint-disable-next-line @typescript-eslint/naming-convention -- defined by webpack
declare const __non_webpack_require__: ((id: string) => unknown) | undefined;
// eslint-disable-next-line @typescript-eslint/naming-convention -- CommonJS globals
declare const __dirname: string;
declare const require: ((id: string) => unknown) | undefined;

export interface RegistrationWasm {
  register_pair(source: Float32Array, target: Float32Array, settings: string): any;
  coarse_align(source: Float32Array, target: Float32Array, settings: string): any;
  icp_refine(source: Float32Array, target: Float32Array, settings: string): any;
  fit_correspondences(source: Float32Array, target: Float32Array): any;
}

let instance: RegistrationWasm | null = null;
let attempted = false;

/**
 * The same compiled file is reached from three layouts, so the candidates are
 * tried in turn: the extension bundle (webpack copies the pkg beside it, as
 * `src/wasmPointcloud.ts` documents), `out/` from `tsc` for the node tests, and
 * the source tree.
 */
function candidatePaths(join: (...parts: string[]) => string): string[] {
  const pkg = ['wasm', 'pointcloud-parser'];
  return [
    join(__dirname, ...pkg, 'pointcloud_parser.js'),
    join(__dirname, '..', '..', '..', '..', ...pkg, 'pkg', 'pointcloud_parser.js'),
    join(__dirname, '..', '..', '..', ...pkg, 'pkg', 'pointcloud_parser.js'),
  ];
}

export async function loadRegistrationWasm(): Promise<RegistrationWasm | null> {
  if (attempted) {
    return instance;
  }
  attempted = true;
  try {
    const req = typeof __non_webpack_require__ !== 'undefined' ? __non_webpack_require__ : require;
    if (!req || typeof __dirname === 'undefined') {
      return null;
    }
    const { join } = req('path') as { join: (...parts: string[]) => string };

    let lastError: unknown = null;
    for (const candidate of candidatePaths(join)) {
      try {
        instance = req(candidate) as RegistrationWasm;
        return instance;
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError ?? new Error('no candidate path resolved');
  } catch (error) {
    console.warn('[registration] wasm module unavailable:', error);
    instance = null;
  }
  return instance;
}
