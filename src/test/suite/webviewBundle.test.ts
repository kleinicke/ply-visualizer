import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Guards the two webpack configs against a drift that is invisible until a
 * user clicks a button and nothing happens.
 *
 * `engine/src/registration/wasmLoader.ts` loads the solvers through CommonJS
 * `require`, which is right for the extension host and for Node and useless in
 * a browser. Both web builds alias it to `wasmLoader.browser.ts`. When only one
 * of them did, the standalone page worked, every Playwright spec passed, and
 * the extension's Align button silently did nothing — the webview fell through
 * to a `require()` it could never resolve.
 *
 * Two levels: the alias must be present in both configs, and — when the bundles
 * have actually been built — the wrong loader must not appear in either.
 */

const root = path.resolve(__dirname, '..', '..', '..', '..');

/** A string only the Node loader emits, and one only the browser loader emits. */
const NODE_LOADER_MARKER = 'registration] wasm module unavailable';
const BROWSER_LOADER_MARKER = 'in-page wasm failed to initialize';

function readIfPresent(relativePath: string): string | null {
  const full = path.join(root, relativePath);
  return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null;
}

suite('Web bundles', () => {
  test('runtime sources never use the unresolved package-import loader', () => {
    for (const file of ['engine/src/registration/index.ts', 'engine/src/parsers/stonexWasm.ts']) {
      const source = readIfPresent(file);
      assert.ok(source, `${file} should exist`);
      assert.ok(
        !source!.includes("'#registration-wasm-loader'"),
        `${file} must import a real relative module; webpack can emit #registration-wasm-loader ` +
          'as an activation-time missing-module stub without failing the build'
      );
    }
  });

  test('both webpack configs alias the registration wasm loader for the browser', () => {
    for (const config of ['webpack.config.js', 'engine/webpack.config.js']) {
      const source = readIfPresent(config);
      assert.ok(source, `${config} should exist`);
      assert.ok(
        source!.includes('registration/wasmLoader.browser'),
        `${config} must alias registration/wasmLoader.ts to the browser build, or the ` +
          `bundle it produces cannot run registration at all`
      );
    }
  });

  test('built extension resolves the Node wasm loader', function () {
    const source = readIfPresent('out/extension.js');
    if (!source) {
      this.skip();
      return;
    }
    assert.ok(
      !source.includes("Cannot find module '#registration-wasm-loader'"),
      'out/extension.js contains a missing-module stub and will fail during activation'
    );
    assert.ok(
      source.includes(NODE_LOADER_MARKER),
      'out/extension.js is missing the Node registration wasm loader'
    );
  });

  test('built web bundles carry the browser loader, not the Node one', function () {
    const bundles = [
      ['out/webview/main.js', readIfPresent('out/webview/main.js')] as const,
      ['engine/dist/bundle.js', readIfPresent('engine/dist/bundle.js')] as const,
    ].filter(([, source]) => source !== null);

    if (bundles.length === 0) {
      // `test:node` runs without webpack; the source-level check above still
      // applies, and `npm test`'s pretest builds these before getting here.
      this.skip();
      return;
    }

    for (const [name, source] of bundles) {
      // The regression this guards against is the Node loader reaching a web
      // bundle, so that assertion is unconditional.
      assert.ok(
        !source!.includes(NODE_LOADER_MARKER),
        `${name} bundles the Node-only wasm loader; registration will fail in the webview`
      );
      // The positive check only applies to a bundle that finished being
      // written: a build running alongside the tests leaves a partial file, and
      // failing on that says nothing about the aliases.
      const complete = source!.includes('registrationWorker') || source!.includes('icp_refine');
      if (complete) {
        assert.ok(
          source!.includes(BROWSER_LOADER_MARKER),
          `${name} is missing the browser wasm loader`
        );
      }
    }
  });
});
