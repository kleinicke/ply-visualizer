// Electron host for the shared 3D visualizer engine.
//
// The engine is the standalone web build (engine/dist) served from a private
// `app://` scheme, so WASM, workers and fetch behave as on a normal origin.
// Local files reach the page through `app://file/<token>`: only paths the user
// opened (CLI, file manager, dialog) are given a token, so the page cannot read
// arbitrary files.
const { app, BrowserWindow, Menu, dialog, ipcMain, net, protocol, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const crypto = require('node:crypto');

const WEB_ROOT = path.join(__dirname, '..', 'web');
const SUPPORTED = [
  'ply',
  'xyz',
  'xyzn',
  'xyzrgb',
  'pcd',
  'pts',
  'obj',
  'mtl',
  'stl',
  'off',
  'gltf',
  'glb',
  'las',
  'laz',
  'e57',
  'bin',
  'x3a',
  'x3r',
  'npy',
  'npz',
  'tif',
  'tiff',
  'pfm',
  'png',
  'exr',
  'json',
  'splat',
  'spz',
  'ksplat',
  'sog',
  'nrrd',
  'step',
  'stp',
  'iges',
  'igs',
  'fbx',
  '3mf',
];

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
]);

/** token -> absolute path, for files the user chose to open. */
const openedFiles = new Map();
/** Per-window: whether the viewer is ready, and files waiting for it. */
const windowState = new WeakMap();

function filesFromArgv(argv) {
  // argv[0] is the executable; in dev, argv[1] is the app directory.
  const args = argv.slice(app.isPackaged ? 1 : 2);
  return args
    .filter(arg => !arg.startsWith('-'))
    .map(arg => path.resolve(arg))
    .filter(p => {
      try {
        return fs.statSync(p).isFile();
      } catch {
        return false;
      }
    });
}

function targetWindow() {
  return BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? createWindow([]);
}

function sendFiles(paths, win = targetWindow()) {
  if (!paths.length) {
    return;
  }
  const state = windowState.get(win);
  if (!state.ready) {
    state.queued.push(...paths);
    return;
  }
  const files = paths.map(p => {
    const token = crypto.randomUUID();
    openedFiles.set(token, p);
    return { name: path.basename(p), url: `app://file/${token}`, size: fs.statSync(p).size };
  });
  win.webContents.send('open-files', files);
  for (const p of paths) {
    app.addRecentDocument(p);
  }
}

async function openDialog(win = targetWindow()) {
  const result = await dialog.showOpenDialog(win, {
    title: 'Open point clouds / meshes',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: '3D data', extensions: SUPPORTED },
      { name: 'All files', extensions: ['*'] },
    ],
  });
  if (!result.canceled) {
    sendFiles(result.filePaths, win);
  }
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Open / Add Files…', accelerator: 'CmdOrCtrl+O', click: () => openDialog() },
        {
          label: 'New Window',
          accelerator: 'CmdOrCtrl+Shift+N',
          click: () => createWindow([]),
        },
        { type: 'separator' },
        {
          label: 'Clear Scene',
          accelerator: 'CmdOrCtrl+Shift+W',
          click: () => BrowserWindow.getFocusedWindow()?.webContents.reload(),
        },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    {
      label: 'View',
      submenu: [
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'toggleDevTools' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Keyboard Shortcuts (H in viewer)',
          click: () =>
            BrowserWindow.getFocusedWindow()?.webContents.sendInputEvent({
              type: 'keyDown',
              keyCode: 'h',
            }),
        },
        {
          label: 'Viewer Guide',
          click: () => shell.openExternal('https://3d.f-kleinicke.de/guide.html'),
        },
        {
          label: 'Upstream Project (ply-visualizer)',
          click: () => shell.openExternal('https://github.com/kleinicke/ply-visualizer'),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow(initialPaths) {
  const win = new BrowserWindow({
    width: 1600,
    height: 1000,
    backgroundColor: '#1e1e1e',
    title: 'PLY Visualizer',
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
      backgroundThrottling: false,
    },
  });
  // External links (guide, upstream) open in the system browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('app://')) {
      event.preventDefault();
      if (/^https?:/.test(url)) {
        shell.openExternal(url);
      }
    }
  });
  windowState.set(win, { ready: false, queued: [...initialPaths] });
  // A reload (Clear Scene) re-runs the page, which announces itself again.
  win.webContents.on('did-start-loading', () => {
    windowState.get(win).ready = false;
  });
  win.loadURL('app://web/index.html');
  return win;
}

ipcMain.on('renderer-ready', event => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const state = win && windowState.get(win);
  if (state) {
    state.ready = true;
    const paths = state.queued;
    state.queued = [];
    sendFiles(paths, win);
  }
});
ipcMain.handle('open-dialog', event => openDialog(BrowserWindow.fromWebContents(event.sender)));
ipcMain.on('set-title', (event, title) => {
  BrowserWindow.fromWebContents(event.sender)?.setTitle(title);
});

// Every launch is its own independent instance with its own window; files
// given on the command line open there, never in an already running window.
{
  app.on('open-file', (event, filePath) => {
    event.preventDefault();
    sendFiles([filePath]);
  });

  app.whenReady().then(() => {
    protocol.handle('app', request => {
      const url = new URL(request.url);
      if (url.host === 'file') {
        const filePath = openedFiles.get(url.pathname.slice(1));
        if (!filePath) {
          return new Response('Not found', { status: 404 });
        }
        return net.fetch(pathToFileURL(filePath).toString());
      }
      if (url.host === 'web') {
        const resolved = path.normalize(path.join(WEB_ROOT, decodeURIComponent(url.pathname)));
        if (!resolved.startsWith(WEB_ROOT)) {
          return new Response('Forbidden', { status: 403 });
        }
        return net.fetch(pathToFileURL(resolved).toString());
      }
      return new Response('Not found', { status: 404 });
    });
    buildMenu();
    createWindow(filesFromArgv(process.argv));
    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow([]);
    });
  });

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit();
  });
}
