<script lang="ts">
  import { onMount } from 'svelte';
  import { routeDocument, type SourceDocument, type ViewKind } from './documents';
  import { native, openNative, pendingNative, saveExport } from './host';
  import { previewImage } from './imageProvider';
  import type { EmbeddedViewer } from '../../../engine/src/hosts/embeddedViewer';

  let documents = $state<SourceDocument[]>([]);
  let activeId = $state<string | null>(null);
  let view = $state<ViewKind>('scene');
  let error = $state('');
  let status = $state('Drop files here or open a file');
  let busy = $state(false);
  let previewUrl = $state('');
  let previewDescription = $state('');
  let zoom = $state(1);
  let frame: HTMLIFrameElement;
  let picker: HTMLInputElement;
  let adapter: EmbeddedViewer;
  let generation = 0;
  const active = $derived(documents.find(doc => doc.id === activeId));

  async function getAdapter(): Promise<EmbeddedViewer> {
    const deadline = Date.now() + 60000;
    while (!adapter) {
      adapter = (frame?.contentWindow as (Window & { embeddedViewer?: EmbeddedViewer }) | null)?.embeddedViewer!;
      if (Date.now() > deadline) throw new Error('Viewer did not initialize');
      if (!adapter) await new Promise(resolve => setTimeout(resolve, 30));
    }
    await adapter.ready();
    return adapter;
  }

  async function select(doc: SourceDocument, nextView = doc.defaultView) {
    const request = ++generation;
    activeId = doc.id; view = nextView; error = ''; zoom = 1;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    previewUrl = ''; previewDescription = '';
    busy = true; status = `Opening ${doc.name}…`;
    try {
      if (nextView === 'scene') {
        const imported = await (await getAdapter()).open(doc.file, doc.id);
        if (!imported && request === generation) { status = '3D import cancelled or failed'; return; }
      } else {
        const result = await previewImage(doc.file, getAdapter);
        if (request === generation) {
          previewDescription = result.description;
          previewUrl = URL.createObjectURL(result.blob);
        }
      }
      if (request === generation) status = doc.name;
      void native?.core.invoke('diagnostic', { message: `Opened ${doc.name} as ${nextView}` });
    } catch (cause) {
      if (request === generation) { error = String(cause); status = 'Could not open file'; }
    } finally { if (request === generation) busy = false; }
  }

  async function addFiles(entries: Array<{ id: string; file: File }>) {
    for (const entry of entries) {
      try {
        const views = routeDocument(entry.file.name);
        let doc = documents.find(doc => doc.id === entry.id);
        if (!doc) {
          doc = { ...entry, name: entry.file.name, views, defaultView: views[0] };
          documents = [...documents, doc];
        }
        await select(doc);
      } catch (cause) { error = String(cause); }
    }
  }

  async function open() {
    if (!native) { picker.click(); return; }
    try { await addFiles(await openNative()); } catch (cause) { error = String(cause); }
  }

  function browserFiles(files: FileList | File[]) {
    return addFiles(Array.from(files, file => ({ id: crypto.randomUUID(), file })));
  }

  function switchView(next: ViewKind) { if (active) void select(active, next); }

  onMount(() => {
    const cleanups: Array<() => void> = [];
    let disposed = false;
    const drain = async () => {
      try { await addFiles(await pendingNative()); } catch (cause) { error = String(cause); }
    };
    void (async () => {
      if (native) {
        for (const [event, callback] of [
          ['files-pending', () => void drain()],
          ['file-error', (event: { payload: unknown }) => { error = String(event.payload); }],
        ] as const) {
          const cleanup = await native.event.listen(event, callback);
          if (disposed) cleanup(); else cleanups.push(cleanup);
        }
        await drain();
      }
      const viewer = await getAdapter();
      viewer.configureExport(async (name, blob) => {
        try {
          const saved = await saveExport(name, blob);
          status = saved ? `Saved ${name}` : 'Export cancelled';
          return saved;
        } catch (cause) { error = `Export failed: ${String(cause)}`; throw cause; }
      });
      const child = frame.contentDocument!;
      const reportError = (event: ErrorEvent) => {
        error = event.message;
        void native?.core.invoke('diagnostic', { message: `Viewer error: ${event.message}` });
      };
      frame.contentWindow!.addEventListener('error', reportError);
      cleanups.push(() => frame.contentWindow?.removeEventListener('error', reportError));
      // Keep opening and saving owned by the host even when invoked inside 3D.
      const intercept = (event: MouseEvent) => {
        const target = event.target as Element;
        if (target.closest('#add-file, #welcome-add-cloud, #hiddenFileInput')) {
          event.preventDefault(); event.stopImmediatePropagation(); void open();
        }
      };
      child.addEventListener('click', intercept, true);
      cleanups.push(() => child.removeEventListener('click', intercept, true));
      const shortcut = (event: KeyboardEvent) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'o') {
          event.preventDefault(); event.stopImmediatePropagation(); void open();
        }
      };
      child.addEventListener('keydown', shortcut, true);
      cleanups.push(() => child.removeEventListener('keydown', shortcut, true));
      // Native smoke evidence comes from the actual system webview and engine.
      if (native) {
        const timer = setInterval(() => {
          if (viewer.objectCount() > 0) {
            void native?.core.invoke('diagnostic', { message: `3D rendered: ${viewer.objectCount()} object(s)` });
            clearInterval(timer);
          }
        }, 500);
        cleanups.push(() => clearInterval(timer));
      }
    })().catch(cause => { error = String(cause); });
    return () => { disposed = true; generation++; cleanups.forEach(cleanup => cleanup()); if (previewUrl) URL.revokeObjectURL(previewUrl); };
  });
</script>

<svelte:window onkeydown={event => { if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'o') { event.preventDefault(); void open(); } }}
  ondragover={event => event.preventDefault()}
  ondrop={event => { event.preventDefault(); if (!native && event.dataTransfer?.files.length) void browserFiles(event.dataTransfer.files); }} />

<div class="workspace">
  <header>
    <strong>Visualizer</strong>
    <button class="primary" onclick={() => void open()}>Open files…</button>
    <div class="documents" aria-label="Open documents">
      {#each documents as doc (doc.id)}
        <button class:active={doc.id === activeId} onclick={() => void select(doc)} title={doc.name}>{doc.name}</button>
      {/each}
    </div>
    {#if active?.views.length === 2}
      <div class="view-switch" aria-label="Document view">
        <button class:active={view === 'image'} onclick={() => switchView('image')}>Image</button>
        <button class:active={view === 'scene'} onclick={() => switchView('scene')}>View in 3D</button>
      </div>
    {/if}
  </header>
  <main>
    <iframe bind:this={frame} src="viewers/3d/index.html?host=desktop" title="3D viewer" class:hidden={view !== 'scene'}></iframe>
    {#if view === 'image'}
      <section class="image-view" aria-label="Image viewer">
        <div class="image-tools">
          <span>{active?.name}</span>
          <button onclick={() => zoom = Math.max(.1, zoom / 1.25)} aria-label="Zoom out">−</button>
          <button onclick={() => zoom = 1}>Fit</button>
          <button onclick={() => zoom = Math.min(8, zoom * 1.25)} aria-label="Zoom in">+</button>
        </div>
        <div class="image-canvas">
          {#if previewUrl}<img src={previewUrl} alt={active?.name || 'Image'} style:transform={`scale(${zoom})`} onerror={() => { error = 'This image cannot be previewed by the built-in image viewer.'; }} />{/if}
          {#if busy}<p class="loading">Preparing image…</p>{/if}
        </div>
        <div class="image-info">{previewDescription || 'Image preview'}{#if active?.views.includes('scene')} · Choose View in 3D to configure depth interpretation.{/if}</div>
      </section>
    {/if}
    {#if error}<div class="error" role="alert">{error}<button onclick={() => error = ''} aria-label="Dismiss error">×</button></div>{/if}
  </main>
  <footer><span>{busy ? '◌ ' : ''}{status}</span><span>{view === 'scene' ? '3D scene' : 'Image'} · Local files</span></footer>
</div>
<input bind:this={picker} class="file-picker" type="file" multiple onchange={() => { if (picker.files) void browserFiles(picker.files); picker.value = ''; }} />

<style>
  :global(html), :global(body), :global(#app) { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #1e1e1e; color: #ccc; font: 12px -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }
  :global(*) { box-sizing: border-box; }
  .workspace { display: grid; grid-template-rows: 42px 1fr 25px; height: 100%; }
  header { display: flex; align-items: center; gap: 12px; padding: 0 12px; background: #181818; border-bottom: 1px solid #303030; }
  header strong { color: #eee; font-weight: 600; }
  button { color: #ccc; background: transparent; border: 1px solid #414141; border-radius: 3px; padding: 5px 10px; font: inherit; white-space: nowrap; cursor: pointer; }
  button:hover { background: #333; }
  button:focus-visible { outline: 1px solid #007acc; outline-offset: 2px; }
  button.primary { background: #007acc; border-color: #007acc; color: white; }
  button.active { color: white; background: #2b2b2b; border-bottom-color: #007acc; }
  .documents { flex: 1; min-width: 0; display: flex; gap: 4px; overflow-x: auto; }
  .documents button { max-width: 230px; overflow: hidden; text-overflow: ellipsis; border-color: transparent; }
  .documents button.active { border-bottom-color: #007acc; }
  .view-switch { display: flex; gap: 4px; }
  main { position: relative; min-height: 0; }
  iframe { display: block; width: 100%; height: 100%; border: 0; }
  iframe.hidden { visibility: hidden; position: absolute; pointer-events: none; }
  .image-view { display: grid; grid-template-rows: 38px 1fr 30px; height: 100%; }
  .image-tools { display: flex; align-items: center; gap: 8px; padding: 0 16px; border-bottom: 1px solid #303030; }
  .image-tools span { flex: 1; }
  .image-canvas { position: relative; display: flex; align-items: center; justify-content: center; overflow: auto; padding: 24px; }
  img { width: 100%; height: 100%; object-fit: contain; image-rendering: pixelated; }
  .image-info { padding: 6px 16px; color: #999; border-top: 1px solid #303030; }
  .loading { position: absolute; }
  .error { position: absolute; top: 10px; left: 10px; right: 10px; padding: 12px; background: #512626; color: #fff; display: flex; justify-content: space-between; z-index: 10; }
  footer { display: flex; justify-content: space-between; padding: 5px 12px; background: #181818; color: #999; border-top: 1px solid #303030; }
  .file-picker { position: fixed; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
</style>
