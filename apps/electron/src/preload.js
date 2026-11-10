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
});

// Dropping a folder (or a mix with folders) onto the window opens it like
// File > Add Folder…: the page itself only understands plain files, so such
// drops go to the desktop host, which scans the folder. Plain-file drops keep
// going to the page's own handler.
window.addEventListener(
  'drop',
  event => {
    const transfer = event.dataTransfer;
    if (!transfer || !transfer.files.length) return;
    const hasFolder = [...transfer.items].some(item => item.webkitGetAsEntry?.()?.isDirectory);
    if (!hasFolder) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const paths = [...transfer.files].map(file => webUtils.getPathForFile(file)).filter(Boolean);
    ipcRenderer.send('drop-paths', paths);
  },
  true
);
