const sveltePreprocess = require('svelte-preprocess');

module.exports = {
  preprocess: sveltePreprocess({
    typescript: {
      // Scoped to how svelte-preprocess transpiles <script lang="ts"> blocks
      // inside .svelte files only. Deliberately NOT set on
      // engine/src/tsconfig.json (the config ts-loader uses for the other
      // ~180 plain .ts files) - that would force every existing type-only
      // import in the codebase to be rewritten as `import type`, which is
      // unrelated cleanup outside Svelte Phase 0's scope.
      compilerOptions: {
        verbatimModuleSyntax: true,
      },
    },
  }),
};
