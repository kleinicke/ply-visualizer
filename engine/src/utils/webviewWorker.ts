/**
 * Web workers that also start inside a VS Code webview.
 *
 * A webview page and its packaged scripts live on different origins: the page
 * is `vscode-webview://…`, the bundle's chunks are served from
 * `https://file+.vscode-resource…`. `new Worker(chunkUrl)` therefore throws,
 * and every caller silently fell back to doing the work on the main thread —
 * a 26-megapixel depth image projected in one band, on the UI thread, in the
 * extension, while the standalone page used eight workers. The resource
 * service worker also does not serve `importScripts` or `fetch` from a blob
 * worker, so the worker cannot fetch its own dependencies either (see
 * models/cadDecoder.ts, which hit the same wall).
 *
 * So, across origins, the page fetches the worker's script itself and starts
 * it from a blob URL (allowed by the webview's `worker-src blob:`), with any
 * classic scripts it needs (the wasm-bindgen glue) prepended, and with the
 * sources of the workers *it* will start handed down, so a worker can start
 * its own pool the same way. Same-origin pages — the standalone viewer and
 * the tests — get an ordinary `new Worker(url)`.
 *
 * Call sites name the worker as `new WorkerScript(new URL('./x.ts',
 * import.meta.url))`: webpack recognises `new WorkerScript()` imported from
 * this module as worker syntax (`module.parser.javascript.worker` in both
 * webpack configs) and turns the URL into the emitted worker chunk. (A plain
 * function call is not recognised: webpack's own import handling claims calls
 * of imported bindings first.) The option names the import path, so call
 * sites import this module as `../utils/webviewWorker`. A `webpack --watch`
 * started before the option existed keeps emitting the URL as a raw `.ts`
 * asset; restart it.
 */

declare let __webpack_public_path__: string;

interface WorkerGlobals {
  /** Scripts handed down by the page that started this worker, by URL. */
  __PLY_WORKER_SOURCES__?: Record<string, string>;
  /** The real base of the bundle, which a blob worker cannot work out. */
  __PLY_PUBLIC_PATH__?: string;
}

const globals = globalThis as typeof globalThis & WorkerGlobals;
const sources = new Map<string, Promise<string>>(
  Object.entries(globals.__PLY_WORKER_SOURCES__ ?? {}).map(([href, text]) => [
    href,
    Promise.resolve(text),
  ])
);

export interface SpawnWorkerOptions extends WorkerOptions {
  /** Classic scripts the worker needs before its own code (by absolute URL). */
  scripts?: string[];
  /** Worker scripts this worker will itself start. */
  nested?: WorkerScript[];
}

/** A bundled worker chunk, named but not started. */
export class WorkerScript {
  constructor(readonly url: URL) {}
}

function crossOrigin(url: URL): boolean {
  return typeof location !== 'undefined' && url.origin !== location.origin;
}

function source(href: string): Promise<string> {
  let text = sources.get(href);
  if (!text) {
    text = fetch(href).then(response => {
      if (!response.ok) {
        throw new Error(`Could not load worker script ${href}: HTTP ${response.status}`);
      }
      return response.text();
    });
    // A failed fetch must not poison the next attempt.
    text.catch(() => sources.delete(href));
    sources.set(href, text);
  }
  return text;
}

export async function spawnWorker(
  script: WorkerScript,
  options: SpawnWorkerOptions = {}
): Promise<Worker> {
  const { url } = script;
  const { scripts = [], nested = [], ...workerOptions } = options;
  if (!crossOrigin(url)) {
    return new Worker(url, workerOptions);
  }
  const [main, prepended, handedDown] = await Promise.all([
    source(url.href),
    Promise.all(scripts.map(source)),
    Promise.all(
      [...nested.map(entry => entry.url.href), ...scripts].map(
        async href => [href, await source(href)] as const
      )
    ),
  ]);
  const publicPath = new URL('./', url).href;
  const prelude =
    `self.__PLY_PUBLIC_PATH__=${JSON.stringify(publicPath)};` +
    `self.__PLY_WORKER_SOURCES__=${JSON.stringify(Object.fromEntries(handedDown))};\n`;
  const blobUrl = URL.createObjectURL(
    new Blob([prelude, ...prepended.flatMap(text => [text, '\n']), main], {
      type: 'text/javascript',
    })
  );
  try {
    return new Worker(blobUrl, workerOptions);
  } finally {
    // The worker resolves its blob URL when it is constructed.
    setTimeout(() => URL.revokeObjectURL(blobUrl), 30_000);
  }
}

/**
 * Point webpack's chunk URLs at the real bundle inside a blob worker. Import
 * this first in a worker entry that starts workers of its own: webpack derives
 * the public path from the script's location, which for a blob is the page.
 */
export function adoptWorkerPublicPath(): void {
  if (globals.__PLY_PUBLIC_PATH__) {
    __webpack_public_path__ = globals.__PLY_PUBLIC_PATH__;
  }
}
