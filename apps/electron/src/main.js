// Electron host for the shared 3D visualizer engine.
//
// The engine is the standalone web build (engine/dist) served from a private
// `app://` scheme, so WASM, workers and fetch behave as on a normal origin.
// Local files reach the page through `app://file/<token>`: only paths the user
// opened (CLI, dialogs, drag and drop, recent list) are given a token, so the
// page cannot read arbitrary files.
//
// Every launch is its own independent instance with its own window.
const { app, BrowserWindow, Menu, dialog, ipcMain, net, protocol, shell } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');
const crypto = require('node:crypto');

const WEB_ROOT = path.join(__dirname, '..', 'web');
const SUPPORTED = new Set([
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
]);
/** Formats picked up when scanning a folder: geometry only, not images/JSON. */
const FOLDER_SCAN = new Set([
  'ply',
  'xyz',
  'xyzn',
  'xyzrgb',
  'pcd',
  'pts',
  'obj',
  'stl',
  'off',
  'gltf',
  'glb',
  'las',
  'laz',
  'e57',
  'x3a',
  'splat',
  'spz',
  'ksplat',
  'sog',
]);
const MAX_FOLDER_FILES = 5000;
const MAX_RECENT = 12;

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

// ---- preferences (recent items, remembered answers) ------------------------

const prefsFile = () => path.join(app.getPath('userData'), 'desktop-prefs.json');
let prefs = { recent: [], folderGrouping: null };
function loadPrefs() {
  try {
    const parsed = JSON.parse(fs.readFileSync(prefsFile(), 'utf8'));
    prefs = {
      recent: Array.isArray(parsed.recent)
        ? parsed.recent.filter(r => r && typeof r.path === 'string')
        : [],
      folderGrouping:
        parsed.folderGrouping === 'group' || parsed.folderGrouping === 'all'
          ? parsed.folderGrouping
          : null,
    };
  } catch {
    // first run or unreadable: defaults
  }
}
function savePrefs() {
  try {
    fs.mkdirSync(path.dirname(prefsFile()), { recursive: true });
    fs.writeFileSync(prefsFile(), JSON.stringify(prefs, null, 2));
  } catch (error) {
    console.error('Could not save preferences', error);
  }
}
function addRecent(kind, p) {
  prefs.recent = [{ kind, path: p }, ...prefs.recent.filter(r => r.path !== p)].slice(
    0,
    MAX_RECENT
  );
  savePrefs();
  app.addRecentDocument(p);
  buildMenu();
}

// ---- files and folders -----------------------------------------------------

const extOf = p => path.extname(p).slice(1).toLowerCase();
const isDir = p => {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
};
const isFile = p => {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
};
const natural = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

/** Supported geometry under `root`, as paths relative to it, naturally sorted. */
function scanFolder(root) {
  const found = [];
  const walk = dir => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (found.length >= MAX_FOLDER_FILES) return;
      if (entry.name.startsWith('.')) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') walk(full);
      } else if (entry.isFile() && FOLDER_SCAN.has(extOf(entry.name))) {
        found.push(path.relative(root, full));
      }
    }
  };
  walk(root);
  return found.sort(natural.compare);
}

/**
 * Expands what the user opened into files with display names. A single folder
 * gives names relative to it, so its subfolders become part of the names (and
 * can be grouped by); several items keep each folder's own name in front.
 */
function collect(paths) {
  if (paths.length === 1 && isDir(paths[0])) {
    const root = paths[0];
    const rel = scanFolder(root);
    const nested = rel.filter(name => name.includes(path.sep));
    return {
      items: rel.map(name => ({ abs: path.join(root, name), name })),
      folder: {
        root,
        hasRootFiles: nested.length < rel.length,
        subfolders: new Set(nested.map(name => name.split(path.sep)[0])).size,
      },
    };
  }
  const items = [];
  for (const p of paths) {
    if (isDir(p)) {
      for (const name of scanFolder(p)) {
        items.push({ abs: path.join(p, name), name: path.join(path.basename(p), name) });
      }
    } else if (isFile(p)) {
      items.push({ abs: p, name: path.basename(p) });
    }
  }
  return { items, folder: null };
}

async function askFolderGrouping(win, folder, count) {
  if (prefs.folderGrouping) {
    return prefs.folderGrouping;
  }
  const { response, checkboxChecked } = await dialog.showMessageBox(win, {
    type: 'question',
    title: 'Open Folder',
    message: 'Group the files by subfolder?',
    detail:
      `“${path.basename(folder.root)}” has no files at its top level; its ${count} files are in ` +
      `${folder.subfolders} subfolder${folder.subfolders === 1 ? '' : 's'}.\n\n` +
      'Grouping shows one subfolder at a time (← / → to switch). You can change this later with ' +
      'Group in the file list.',
    buttons: ['Group by Subfolder', 'Show Everything'],
    defaultId: 0,
    cancelId: 1,
    checkboxLabel: "Don't ask again",
    noLink: true,
  });
  const choice = response === 0 ? 'group' : 'all';
  if (checkboxChecked) {
    prefs.folderGrouping = choice;
    savePrefs();
  }
  return choice;
}

/** Opens files/folders in `win`: replacing its scene or adding to it. */
async function openPaths(win, paths, { replace }) {
  const resolved = paths.map(p => path.resolve(p));
  const { items, folder } = collect(resolved);
  if (!items.length) {
    await dialog.showMessageBox(win, {
      type: 'info',
      title: 'Nothing to open',
      message: 'No supported 3D files found.',
      detail: resolved.join('\n'),
    });
    return;
  }
  // Grouping is decided for a whole folder only: grouped by subfolder when
  // everything sits in subfolders (and the user agrees), otherwise ungrouped.
  let grouping;
  if (folder) {
    const group =
      !folder.hasRootFiles && (await askFolderGrouping(win, folder, items.length)) === 'group';
    grouping = group ? 'folder' : 'off';
    addRecent('folder', folder.root);
  } else {
    for (const p of resolved) addRecent(isDir(p) ? 'folder' : 'file', p);
  }
  const title = folder
    ? path.basename(folder.root)
    : items.length === 1
      ? items[0].name
      : `${items[0].name} +${items.length - 1}`;
  deliver(win, {
    files: items.map(item => {
      const token = crypto.randomUUID();
      openedFiles.set(token, item.abs);
      return { name: item.name, url: `app://file/${token}`, size: fs.statSync(item.abs).size };
    }),
    grouping,
    title,
    replace,
  });
}

// ---- windows ---------------------------------------------------------------

/** token -> absolute path, for files the user chose to open. */
const openedFiles = new Map();
/** Per window: viewer ready, payloads waiting for it, whether it shows files. */
const windowState = new WeakMap();

function deliver(win, payload) {
  const state = windowState.get(win);
  if (payload.replace && state.hasContent) {
    // "Open" replaces the scene: start from a fresh page, then load.
    state.queued = [{ ...payload, replace: false }];
    state.hasContent = false;
    win.webContents.reload();
    return;
  }
  state.hasContent = true;
  if (!state.ready) {
    state.queued.push(payload);
    return;
  }
  win.webContents.send('open-files', payload);
}

const focusedWindow = () =>
  BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? createWindow([]);

async function pick(win, kind, replace) {
  const folder = kind === 'folder';
  const result = await dialog.showOpenDialog(win, {
    title: `${replace ? 'Open' : 'Add'} ${folder ? 'Folder' : 'Files'}`,
    properties: folder ? ['openDirectory'] : ['openFile', 'multiSelections'],
    filters: folder
      ? undefined
      : [
          { name: '3D data', extensions: [...SUPPORTED] },
          { name: 'All files', extensions: ['*'] },
        ],
  });
  if (!result.canceled && result.filePaths.length) {
    await openPaths(win, result.filePaths, { replace });
  }
}

function clearScene(win) {
  windowState.get(win).hasContent = false;
  win.webContents.reload();
}

/** The focused window's solo panel visibility, as last reported by its page. */
function soloPanelChecked() {
  const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0];
  return win ? windowState.get(win)?.soloPanelVisible !== false : true;
}

function syncSoloPanelMenuItem() {
  const item = Menu.getApplicationMenu()?.getMenuItemById('solo-panel');
  if (item) item.checked = soloPanelChecked();
}

function buildMenu() {
  const isMac = process.platform === 'darwin';
  const recent = prefs.recent.filter(r => (r.kind === 'folder' ? isDir(r.path) : isFile(r.path)));
  const template = [
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: '&File',
      submenu: [
        {
          label: '&Open Files…',
          accelerator: 'CmdOrCtrl+O',
          click: () => pick(focusedWindow(), 'files', true),
        },
        {
          label: 'Open &Folder…',
          accelerator: 'CmdOrCtrl+Shift+O',
          click: () => pick(focusedWindow(), 'folder', true),
        },
        {
          label: 'Open &Recent',
          submenu: [
            ...(recent.length
              ? recent.map(r => ({
                  label: r.kind === 'folder' ? `${r.path}${path.sep}` : r.path,
                  click: () => openPaths(focusedWindow(), [r.path], { replace: true }),
                }))
              : [{ label: 'No recent items', enabled: false }]),
            { type: 'separator' },
            {
              label: 'Clear Recently Opened',
              enabled: recent.length > 0,
              click: () => {
                prefs.recent = [];
                savePrefs();
                app.clearRecentDocuments();
                buildMenu();
              },
            },
          ],
        },
        { type: 'separator' },
        {
          label: '&Add Files…',
          accelerator: 'CmdOrCtrl+Alt+O',
          click: () => pick(focusedWindow(), 'files', false),
        },
        { label: 'Add Fol&der…', click: () => pick(focusedWindow(), 'folder', false) },
        { type: 'separator' },
        { label: '&Clear Scene', click: () => clearScene(focusedWindow()) },
        { type: 'separator' },
        { label: '&New Window', accelerator: 'CmdOrCtrl+Shift+N', click: () => createWindow([]) },
        {
          label: 'Close &Window',
          accelerator: 'CmdOrCtrl+W',
          click: () => BrowserWindow.getFocusedWindow()?.close(),
        },
        ...(isMac
          ? []
          : [{ type: 'separator' }, { label: '&Quit', accelerator: 'CmdOrCtrl+Q', role: 'quit' }]),
      ],
    },
    {
      label: '&Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
      ],
    },
    {
      label: '&View',
      submenu: [
        {
          id: 'solo-panel',
          label: '&Solo Panel',
          type: 'checkbox',
          checked: soloPanelChecked(),
          click: () => BrowserWindow.getFocusedWindow()?.webContents.send('toggle-solo-panel'),
        },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        { label: 'Zoom &In', role: 'zoomIn' },
        { label: 'Zoom &Out', role: 'zoomOut' },
        { label: '&Actual Size', role: 'resetZoom' },
        { type: 'separator' },
        { label: '&Developer', submenu: [{ role: 'toggleDevTools' }, { role: 'forceReload' }] },
      ],
    },
    {
      label: '&Help',
      submenu: [
        {
          label: '&Keyboard Shortcuts',
          accelerator: 'F1',
          click: () => BrowserWindow.getFocusedWindow()?.webContents.send('show-shortcuts'),
        },
        {
          label: 'Viewer &Guide',
          click: () => shell.openExternal('https://3d.f-kleinicke.de/guide.html'),
        },
        {
          label: '&Upstream Project',
          click: () => shell.openExternal('https://github.com/kleinicke/ply-visualizer'),
        },
        { type: 'separator' },
        { label: '&About PLY Visualizer', role: 'about' },
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
    if (/^https?:/.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!url.startsWith('app://')) {
      event.preventDefault();
      if (/^https?:/.test(url)) shell.openExternal(url);
    }
  });
  windowState.set(win, { ready: false, queued: [], hasContent: false, soloPanelVisible: true });
  win.on('focus', syncSoloPanelMenuItem);
  win.webContents.on('did-start-loading', () => {
    windowState.get(win).ready = false;
  });
  win.loadURL('app://web/index.html');
  if (initialPaths.length) {
    void openPaths(win, initialPaths, { replace: false });
  }
  return win;
}

ipcMain.on('renderer-ready', event => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const state = win && windowState.get(win);
  if (!state) return;
  state.ready = true;
  const queued = state.queued;
  state.queued = [];
  for (const payload of queued) {
    state.hasContent = true;
    win.webContents.send('open-files', payload);
  }
});
ipcMain.on('drop-paths', (event, paths) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  if (win && Array.isArray(paths) && paths.length) {
    void openPaths(
      win,
      paths.filter(p => typeof p === 'string' && p),
      { replace: false }
    );
  }
});
ipcMain.on('solo-panel-visibility', (event, visible) => {
  const win = BrowserWindow.fromWebContents(event.sender);
  const state = win && windowState.get(win);
  if (state) {
    state.soloPanelVisible = visible !== false;
    syncSoloPanelMenuItem();
  }
});
ipcMain.on('set-title', (event, title) => {
  BrowserWindow.fromWebContents(event.sender)?.setTitle(String(title));
});

app.setAboutPanelOptions({
  applicationName: 'PLY Visualizer',
  applicationVersion: app.getVersion(),
  credits: 'Desktop build of kleinicke/ply-visualizer (MIT), with solo and grouping.',
  website: 'https://github.com/kleinicke/ply-visualizer',
});

app.whenReady().then(() => {
  loadPrefs();
  protocol.handle('app', request => {
    const url = new URL(request.url);
    if (url.host === 'file') {
      const filePath = openedFiles.get(url.pathname.slice(1));
      if (!filePath) return new Response('Not found', { status: 404 });
      return net.fetch(pathToFileURL(filePath).toString());
    }
    if (url.host === 'web') {
      const resolved = path.normalize(path.join(WEB_ROOT, decodeURIComponent(url.pathname)));
      if (!resolved.startsWith(WEB_ROOT)) return new Response('Forbidden', { status: 403 });
      return net.fetch(pathToFileURL(resolved).toString());
    }
    return new Response('Not found', { status: 404 });
  });
  buildMenu();
  // argv[0] is the executable; in development argv[1] is the app directory.
  // Launchers may put flags before the app path, so drop the app path itself too.
  const appPath = path.resolve(app.getAppPath());
  const args = process.argv
    .slice(1)
    .filter(arg => !arg.startsWith('-') && path.resolve(arg) !== appPath);
  createWindow(args.filter(arg => isFile(arg) || isDir(arg)));
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow([]);
  });
});

app.on('open-file', (event, filePath) => {
  event.preventDefault();
  if (app.isReady()) void openPaths(focusedWindow(), [filePath], { replace: false });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
