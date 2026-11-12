// Minimal, explicit bridge: the page gets no Node access.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

contextBridge.exposeInMainWorld('plyDesktop', {
  /** OS path separator; names of files opened from a folder use it. */
  pathSep: process.platform === 'win32' ? '\\' : '/',
  ready: () => ipcRenderer.send('renderer-ready'),
  setTitle: title => ipcRenderer.send('set-title', String(title)),
  onOpenFiles: callback => {
    ipcRenderer.on('open-files', (_event, payload) => callback(payload));
  },
  onShowShortcuts: callback => {
    ipcRenderer.on('show-shortcuts', () => callback());
  },
  onToggleSoloPanel: callback => {
    ipcRenderer.on('toggle-solo-panel', () => callback());
  },
  /** File > Advanced Open: the host asks how to subsample; answer with options or null. */
  onAskSubsample: callback => {
    ipcRenderer.on('ask-subsample', (_event, request) => callback(request));
  },
  answerSubsample: (id, options) => ipcRenderer.send('subsample-answer', { id, options }),
  reportSoloPanel: visible => ipcRenderer.send('solo-panel-visibility', visible === true),
});

// Dropping a folder (or a mix with folders) onto the window opens it like
// File > Add Folder…: the page itself only understands plain files, so such
// drops go to the desktop host, which scans the folder. So do large drops,
// so the host can check them against free memory. Small plain-file drops
// keep going to the page's own handler.
const LARGE_DROP_BYTES = 256 * 1024 * 1024;
window.addEventListener(
  'drop',
  event => {
    const transfer = event.dataTransfer;
    if (!transfer || !transfer.files.length) return;
    const hasFolder = [...transfer.items].some(item => item.webkitGetAsEntry?.()?.isDirectory);
    // Large drops go through the host too, which warns when they will not
    // fit in memory (and offers subsampling).
    const bytes = [...transfer.files].reduce((sum, file) => sum + file.size, 0);
    if (!hasFolder && bytes < LARGE_DROP_BYTES) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const paths = [...transfer.files].map(file => webUtils.getPathForFile(file)).filter(Boolean);
    ipcRenderer.send('drop-paths', paths);
  },
  true
);
