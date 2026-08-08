/**
 * Constructs the registration worker.
 *
 * Split out of `index.ts` for one reason: `new URL(..., import.meta.url)` is
 * the bundler's worker idiom, and leaving it in a module the extension host and
 * the Node test suite import makes `tsc`'s CommonJS output contain ESM syntax,
 * which Node then refuses to load as CJS. `index.ts` reaches this module
 * through a dynamic import that only runs in a browser, so the CommonJS
 * consumers never evaluate it.
 */

export function createRegistrationWorker(): Worker {
  // @ts-ignore -- the extension-host tsconfig type-checks shared files as
  // CommonJS, while this expression is emitted only by the web bundle.
  return new Worker(new URL('./registrationWorker.ts', import.meta.url), { type: 'module' });
}
