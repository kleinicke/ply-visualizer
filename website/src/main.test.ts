// Temporary test entry point for Phase 1 - Build System Test
import App from './App.svelte';
import { setupMessageHandler } from './lib/message-handler';

console.log('Phase 1 Test: Svelte App Loading...');

// Initialize message handler
setupMessageHandler();

// Mount Svelte app
const app = new App({
  target: document.body,
  props: {
    vscode:
      typeof window !== 'undefined' && (window as any).acquireVsCodeApi
        ? (window as any).acquireVsCodeApi()
        : null,
  },
});

console.log('Phase 1 Test: Svelte App Mounted Successfully');

export default app;
