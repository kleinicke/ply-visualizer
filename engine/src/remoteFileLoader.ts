import { detectFileType } from './fileHandler';
import { downloadRemoteFile } from './remoteFile';
import { handleBrowserFiles, type BrowserFileDragDropHost } from './browserFileDragDrop';

/** Website links remain available without a remote URL button in the viewer. */
export function setupRemoteFileLoader(host: BrowserFileDragDropHost, extension: boolean): void {
  if (extension) {
    return;
  }
  const restore = async () => {
    const params = new URL(window.location.href).searchParams;
    const source = params.get('source') || params.get('url');
    if (!source) {
      return;
    }
    try {
      const downloaded = await downloadRemoteFile(source);
      const fileName = params.get('filename')?.trim() || downloaded.name;
      if (!detectFileType(fileName)) {
        throw new Error(
          'Cannot determine the format. Supply a filename query parameter with a supported extension.'
        );
      }
      await handleBrowserFiles(host, [new File([downloaded.bytes], fileName)]);
    } catch (error) {
      host.showError(
        `Unable to load remote file: ${error instanceof Error ? error.message : String(error)}. The server must allow cross-origin requests (CORS).`
      );
    }
  };
  window.addEventListener(
    'visualizer-ready',
    () => {
      void restore();
    },
    { once: true }
  );
}
