/** Browser host for the Python/CLI package; decoding stays in the shared engine. */
import '../main';
import { handleBrowserFiles, type BrowserFileDragDropHost } from '../browserFileDragDrop';

async function openSession(): Promise<void> {
  const host = (window as Window & { visualizer?: BrowserFileDragDropHost }).visualizer!;
  try {
    const response = await fetch('session.json');
    if (!response.ok) {
      throw new Error(`Session unavailable (${response.status})`);
    }
    const session: { version: number; files: { name: string; url: string }[] } =
      await response.json();
    if (session.version !== 1) {
      throw new Error('Unsupported viewer session version');
    }
    // Load sequentially to avoid fetching every large cloud into memory at once.
    for (const source of session.files) {
      const response = await fetch(source.url);
      if (!response.ok) {
        throw new Error(`Cannot read ${source.name} (${response.status})`);
      }
      const before = host.spatialFiles.length;
      await handleBrowserFiles(host, [new File([await response.blob()], source.name)]);
      if (host.spatialFiles.length === before) {
        throw new Error(`Could not load ${source.name}`);
      }
    }
    document.documentElement.dataset.localSession = 'loaded';
  } catch (error) {
    document.documentElement.dataset.localSession = 'error';
    host.showError(error instanceof Error ? error.message : String(error));
  }
}

if (document.documentElement.dataset.visualizerReady === 'true') {
  void openSession();
} else {
  window.addEventListener('visualizer-ready', () => void openSession(), { once: true });
}
