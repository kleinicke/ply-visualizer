/**
 * In-page fallback for the registration solvers.
 *
 * Webpack aliases this over `wasmLoader.ts` in the browser build (see
 * webpack.config.js), because that file's CommonJS `require` is for the
 * extension host and Node only.
 *
 * It exists as a working fallback rather than a stub because the worker cannot
 * always be created. The standalone page is fine — same origin — but a VS Code
 * webview loads its bundle from `vscode-cdn.net` while the page itself is a
 * `vscode-webview://` document, and a worker script cannot be constructed
 * across that boundary. Without this path, clicking Align in the extension did
 * nothing at all.
 *
 * Running here blocks the render thread for the duration. That is survivable
 * now that a station pair refines in about two seconds, and it is the only
 * option that works everywhere; moving the work to the extension host (a
 * genuinely separate process) is the way to get it off the UI thread there.
 */

import * as wasm from '../../../wasm/pointcloud-parser/pkg-web/pointcloud_parser';
import type { RegistrationWasm } from './wasmLoader';

let ready: Promise<RegistrationWasm | null> | null = null;

/**
 * Resolves to the whole module namespace, not just the four registration
 * entries, because the Node loader this stands in for hands back the entire
 * CommonJS module and callers rely on that: `parsers/stonexWasm.ts` and
 * `parsers/pointcloudWasm.ts` both cast the result to their own view of the
 * crate. Exporting a hand-picked subset here silently left those two with
 * `null` in the browser while they worked in the extension host.
 *
 * `memory` is attached to the namespace because it is not one of its exports -
 * it belongs to the object `init()` resolves to - and the parsers need it to
 * write a file into wasm memory instead of handing it across the boundary.
 */
export function loadRegistrationWasm(): Promise<RegistrationWasm | null> {
  if (!ready) {
    ready = wasm
      .default()
      .then(instance => {
        const module = wasm as unknown as Record<string, unknown>;
        return { ...module, memory: instance.memory } as unknown as RegistrationWasm;
      })
      .catch((error: unknown): RegistrationWasm | null => {
        console.warn('[registration] in-page wasm failed to initialize:', error);
        return null;
      });
  }
  return ready;
}
