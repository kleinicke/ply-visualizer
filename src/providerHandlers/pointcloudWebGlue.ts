import { existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

/**
 * The point-cloud crate's `web` build, for the decoder workers.
 *
 * Unlike the Node build, which compiles its own module on load, the web glue
 * can be initialized from an already compiled `WebAssembly.Module`
 * (`initSync`). The pool compiles that module once per session and shares it
 * with every worker (see parsePool.ts).
 *
 * Found at runtime among the layouts this file is reached from - the
 * extension bundle (webpack copies the package beside it) and `out/` from
 * `tsc` for the Node tests - the same way registration/wasmLoader.ts finds
 * the Node build. The glue is an ES module; Node 22.12+ (every supported VS
 * Code) can `require` it.
 */

// eslint-disable-next-line @typescript-eslint/naming-convention -- defined by webpack
declare const __non_webpack_require__: NodeRequire | undefined;

function packageDirs(): string[] {
  return [
    join(__dirname, 'wasm', 'pointcloud-parser-web'),
    join(__dirname, '..', '..', '..', 'wasm', 'pointcloud-parser', 'pkg-web'),
    join(__dirname, '..', '..', 'wasm', 'pointcloud-parser', 'pkg-web'),
  ];
}

/** The web build's wasm file, or null when this layout does not ship it. */
export function webWasmPath(): string | null {
  for (const dir of packageDirs()) {
    const file = join(dir, 'pointcloud_parser_bg.wasm');
    if (existsSync(file)) {
      return file;
    }
  }
  return null;
}

export interface WebGlue {
  initSync(options: { module: WebAssembly.Module }): { memory: WebAssembly.Memory };
  [name: string]: unknown;
}

/** The web build's JavaScript glue, or null when it cannot be loaded. */
export function loadWebGlue(): WebGlue | null {
  const req =
    typeof __non_webpack_require__ !== 'undefined'
      ? __non_webpack_require__
      : createRequire(__filename);
  for (const dir of packageDirs()) {
    const file = join(dir, 'pointcloud_parser.js');
    if (!existsSync(file)) {
      continue;
    }
    try {
      return req(file) as WebGlue;
    } catch (error) {
      console.warn('[pointcloud-wasm] web glue failed to load:', error);
    }
  }
  return null;
}
