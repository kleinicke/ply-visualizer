// Runs in the page after the engine bundle. Feeds files the desktop host opens
// (command line, File menu, recent list, dropped folders) into the engine's
// normal browser file path, exactly as if they had been dropped onto the
// window, and applies the host's grouping decision for opened folders.
(function () {
  const bridge = window.plyDesktop;
  if (!bridge) {
    return;
  }

  function whenReady() {
    if (document.documentElement.dataset.visualizerReady === 'true' && window.visualizer) {
      return Promise.resolve(window.visualizer);
    }
    return new Promise(resolve => {
      window.addEventListener('visualizer-ready', () => resolve(window.visualizer), { once: true });
    });
  }

  // Same text as the engine's "Top-level folder" preset, so it is one entry
  // in the recent-patterns list.
  const folderRegex = bridge.pathSep === '\\' ? '^([^\\\\]+)\\\\' : '^([^/]+)/';

  const titles = [];
  function updateTitle() {
    const extra = titles.length > 1 ? ` +${titles.length - 1} more` : '';
    bridge.setTitle(titles.length ? `${titles[0]}${extra} — PLY Visualizer` : 'PLY Visualizer');
  }

  let chain = Promise.resolve();
  bridge.onOpenFiles(payload => {
    // Serialize batches so file order (and therefore solo keys 1-9) matches
    // the order they were opened in.
    chain = chain
      .then(async () => {
        const viewer = await whenReady();
        // Decide grouping before the files arrive, so a grouped folder never
        // flashes every cloud at once.
        if (payload.grouping === 'folder') {
          viewer.solo.setGroupRegex(folderRegex, true);
        } else if (payload.grouping === 'off') {
          viewer.solo.setGroupingEnabled(false);
        }
        const objects = await Promise.all(
          payload.files.map(async file => {
            const response = await fetch(file.url);
            if (!response.ok) {
              throw new Error(`Could not read ${file.name}`);
            }
            return new File([await response.blob()], file.name);
          })
        );
        await viewer.handleBrowserFiles(objects);
        if (payload.title) titles.push(payload.title);
        updateTitle();
      })
      .catch(error => {
        console.error(error);
        window.visualizer?.showError?.(String(error && error.message ? error.message : error));
      });
  });

  bridge.onShowShortcuts(() => window.visualizer?.showKeyboardShortcuts?.());

  // View → Solo Panel mirrors the panel; the page reports every change
  // (its own ✕ and file-list button included).
  bridge.onToggleSoloPanel(() => window.visualizer?.solo?.togglePanel());
  window.addEventListener('solo-panel-visibility', event =>
    bridge.reportSoloPanel(event.detail.visible)
  );
  whenReady().then(viewer => bridge.reportSoloPanel(!viewer.solo.panelHidden));

  // "+ Add Point Cloud" keeps working through the page's own file input; the
  // File menu uses native dialogs (files or folders).
  whenReady().then(() => bridge.ready());
})();
