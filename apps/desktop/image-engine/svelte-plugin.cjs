const { readFile } = require('node:fs/promises');
const { compile } = require('svelte/compiler');

// Shared by the IDE and browser builds. External CSS respects the webview CSP;
// Svelte never injects an unnonced style element at runtime.
module.exports = function sveltePlugin() {
  const styles = new Map();
  return {
    name: 'viewer-svelte',
    setup(build) {
      build.onResolve({ filter: /\.svelte\.css$/ }, args => ({ path: args.path, namespace: 'svelte-css' }));
      build.onLoad({ filter: /.*/, namespace: 'svelte-css' }, args => ({ contents: styles.get(args.path), loader: 'css' }));
      build.onLoad({ filter: /\.svelte$/ }, async args => {
        const result = compile(await readFile(args.path, 'utf8'), {
          filename: args.path, generate: 'client', css: 'external', dev: false,
        });
        const cssPath = `${args.path}.css`;
        styles.set(cssPath, result.css?.code || '');
        return {
          contents: `${result.js.code}\nimport ${JSON.stringify(cssPath)};`,
          loader: 'js',
          warnings: result.warnings.map(w => ({ text: `${args.path}: ${w.message}` })),
        };
      });
    },
  };
};
