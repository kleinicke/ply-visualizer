import { mount } from 'svelte';
import RemoteFileLoader from './components/RemoteFileLoader.svelte';
import { detectFileType } from './fileHandler';
import { downloadRemoteFile } from './remoteFile';
import { handleBrowserFiles, type BrowserFileDragDropHost } from './browserFileDragDrop';

export function setupRemoteFileLoader(host: BrowserFileDragDropHost, extension: boolean): void {
  const target = document.getElementById('remote-file-mount');
  if (!target) {
    return;
  }
  const load = async (url: string, name: string, signal?: AbortSignal, updateHistory = true) => {
    if (extension) {
      host.vscode.postMessage({ type: 'openRemoteUrl' });
      return;
    }
    const downloaded = await downloadRemoteFile(url, signal);
    const fileName = name.trim() || downloaded.name;
    if (!detectFileType(fileName)) {
      throw new Error(
        'Cannot determine the format. Enter a filename with a supported extension, such as cloud.ply.'
      );
    }
    if (signal?.aborted) {
      throw new DOMException('Download cancelled', 'AbortError');
    }
    if (updateHistory) {
      const location = new URL(window.location.href);
      location.searchParams.delete('url');
      location.searchParams.set('source', downloaded.url);
      if (name.trim()) {
        location.searchParams.set('filename', name.trim());
      } else {
        location.searchParams.delete('filename');
      }
      window.history.replaceState(null, '', location);
    }
    await handleBrowserFiles(host, [new File([downloaded.bytes], fileName)]);
  };
  mount(RemoteFileLoader, { target, props: { load, extension } });
  if (!extension) {
    const restore = () => {
      const params = new URL(window.location.href).searchParams;
      const source = params.get('source') || params.get('url');
      if (source) {
        void load(source, params.get('filename') || '', undefined, false).catch(error =>
          host.showError(
            `Unable to load remote file: ${error.message}. The server must allow cross-origin requests (CORS).`
          )
        );
      }
    };
    window.addEventListener('visualizer-ready', restore, { once: true });
  }
}
