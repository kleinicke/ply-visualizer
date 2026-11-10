// Minimal, explicit bridge: the page gets no Node access.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('plyDesktop', {
  ready: () => ipcRenderer.send('renderer-ready'),
  openDialog: () => ipcRenderer.invoke('open-dialog'),
  setTitle: title => ipcRenderer.send('set-title', String(title)),
  onOpenFiles: callback => {
    ipcRenderer.on('open-files', (_event, files) => callback(files));
  },
});
