import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  // Enable compatibility mode to avoid runes issues
  compilerOptions: {
    compatibility: {
      componentApi: 4,
    },
  },
};
