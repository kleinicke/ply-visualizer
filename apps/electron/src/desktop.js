// Runs in the page after the engine bundle. Feeds files the desktop host opens
// (CLI arguments, file manager, File > Open) into the engine's normal browser
// file path, exactly as if they had been dropped onto the window.
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

  const loaded = [];
  function updateTitle() {
    const names = loaded.slice(0, 3).join(', ');
    const more = loaded.length > 3 ? ` +${loaded.length - 3}` : '';
    bridge.setTitle(loaded.length ? `${names}${more} — PLY Visualizer` : 'PLY Visualizer');
  }

  let chain = Promise.resolve();
  bridge.onOpenFiles(files => {
    // Serialize batches so file order (and therefore solo key 1-9) matches
    // the order they were opened in.
    chain = chain
      .then(async () => {
        const viewer = await whenReady();
        const objects = await Promise.all(
          files.map(async file => {
            const response = await fetch(file.url);
            if (!response.ok) {
              throw new Error(`Could not read ${file.name}`);
            }
            return new File([await response.blob()], file.name);
          })
        );
        await viewer.handleBrowserFiles(objects);
        loaded.push(...files.map(file => file.name));
        updateTitle();
      })
      .catch(error => {
        console.error(error);
        window.visualizer?.showError?.(String(error && error.message ? error.message : error));
      });
  });

  // "+ Add Point Cloud" keeps working through the page's own file input; Ctrl+O
  // and the File menu use the native dialog, which also supports multi-select.
  whenReady().then(() => bridge.ready());
})();
