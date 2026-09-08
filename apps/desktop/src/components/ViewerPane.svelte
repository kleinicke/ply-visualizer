<script lang="ts">
  import { onMount, untrack, tick } from 'svelte';
  import type { SourceDocument, FileRef, ViewKind } from '../documents';
  import { resolveFile, readText, saveExport } from '../host';
  let {
    document: doc,
    onstate,
    onerror,
    onready = () => {},
  }: {
    document: SourceDocument;
    onstate: (state: any) => void;
    onerror: (message: string) => void;
    onready?: () => void;
  } = $props();
  let imageMounted = $state(false),
    sceneMounted = $state(false);
  let imageFrame = $state<HTMLIFrameElement>();
  let sceneFrame = $state<HTMLIFrameElement>();
  let text = $state('');
  let busy = $state(false);
  let mediaUrl = $state('');
  let request = 0;
  const resident: Partial<Record<ViewKind, string>> = {};
  let retain: (() => void) | undefined;
  let disposed = false;
  let localError = $state('');
  let loadKey = $derived(
    `${doc.id}:${doc.index}:${doc.kind}:${doc.mode}:${doc.sources.map(s => s.id).join(',')}`
  );
  const animated = $derived(
    doc.kind === 'image' && /\.gif$/i.test(doc.sources[doc.index]?.name || '')
  );
  async function api(kind: ViewKind = doc.kind) {
    const start = performance.now();
    while (!disposed) {
      const win = (kind === 'scene' ? sceneFrame : imageFrame)?.contentWindow as any;
      const result = kind === 'scene' ? win?.desktopScene : win?.desktopImage;
      if (result) return result;
      if (performance.now() - start > 60000) throw new Error('Viewer initialization timed out');
      await new Promise(resolve => setTimeout(resolve, 25));
    }
    throw new Error('Viewer closed');
  }
  async function load() {
    if (!busy) retain?.();
    retain = undefined;
    const mine = ++request;
    busy = true;
    localError = '';
    text = '';
    const source = doc.sources[doc.index] || doc.sources[0];
    if (!source) {
      busy = false;
      return;
    }
    const kind = doc.kind,
      key = loadKey;
    try {
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
      mediaUrl = '';
      if (kind === 'text') {
        const content = await readText(source);
        if (mine === request) text = content;
      } else if (kind === 'video' || animated) {
        const file = await resolveFile(source);
        if (mine === request) mediaUrl = URL.createObjectURL(file);
      } else {
        if (kind === 'image') imageMounted = true;
        else sceneMounted = true;
        await tick();
        const adapter = await api(kind);
        if (resident[kind] !== key) {
          resident[kind] = undefined;
          const file = await resolveFile(source);
          if (mine !== request) return;
          if (kind === 'scene') {
            adapter.configureExport(saveExport);
            if (!(await adapter.open(file, source.id, false, doc.mode === 'sequence')))
              throw new Error('Opening cancelled or no renderable geometry found.');
          } else await adapter.open(file);
          if (mine !== request) return;
          if (doc.mode === 'composition') {
            for (const extra of doc.sources.slice(1)) {
              const file = await resolveFile(extra);
              if (mine !== request) return;
              if (kind === 'scene') await adapter.open(file, extra.id, true);
              else await adapter.addLayer(file);
            }
          }
          if (kind === 'scene' && doc.mode === 'composition') adapter.fit();
          if (doc.settings && kind === 'image') await adapter.settings(doc.settings);
          if (kind === 'image') adapter.fit();
          if (doc.presentation && ['single', 'composition'].includes(doc.mode))
            await adapter.restore(doc.presentation);
          if (mine !== request) return;
          resident[kind] = key;
        }
        const loadedDoc = doc,
          sources = doc.sources.map(s => s.id).join(',');
        retain = () => {
          if (
            ['single', 'composition'].includes(loadedDoc.mode) &&
            loadedDoc.sources.map(s => s.id).join(',') === sources
          )
            loadedDoc.presentation = adapter.capture();
        };
        if (mine === request) onstate(adapter.snapshot());
      }
      if (mine === request) onready();
    } catch (error) {
      if (mine === request) {
        localError = String(error);
        onerror(localError);
      }
    } finally {
      if (mine === request) busy = false;
    }
  }
  $effect(() => {
    loadKey;
    untrack(() => void load());
  });
  onMount(() => {
    const timer = setInterval(() => {
      if (busy || disposed || !['image', 'scene'].includes(doc.kind) || animated) return;
      const win = (doc.kind === 'scene' ? sceneFrame : imageFrame)?.contentWindow as any;
      const adapter = doc.kind === 'scene' ? win?.desktopScene : win?.desktopImage;
      if (adapter) onstate(adapter.snapshot());
    }, 300);
    return () => {
      if (!busy) retain?.();
      disposed = true;
      request++;
      clearInterval(timer);
      if (mediaUrl) URL.revokeObjectURL(mediaUrl);
    };
  });
  export async function action(name: string, ...args: any[]) {
    try {
      const adapter = await api();
      if (name === 'export') {
        const blob = await adapter.exportPng();
        return saveExport(`${doc.name.replace(/\.[^.]+$/, '')}-view.png`, blob);
      }
      if (name === 'fit') return adapter.fit();
      if (name === 'settings') return adapter.settings(args[0]);
      if (name === 'command') return adapter.command(args[0], args[1]);
      if (typeof adapter[name] === 'function') {
        const result = await adapter[name](...args);
        onstate(adapter.snapshot());
        return result;
      }
    } catch (error) {
      onerror(String(error));
    }
  }
</script>

<div class="pane" aria-label="Document viewer">
  {#if imageMounted}<iframe
      bind:this={imageFrame}
      src="viewers/image/index.html"
      title="Image engine"
      class:inactive={doc.kind !== 'image' || animated}
    ></iframe>{/if}
  {#if sceneMounted}<iframe
      bind:this={sceneFrame}
      src="viewers/3d/index.html?host=desktop"
      title="3D engine"
      class:inactive={doc.kind !== 'scene'}
    ></iframe>{/if}
  {#if doc.kind === 'text'}<pre aria-label="Text preview">{text}</pre>{/if}
  {#if doc.kind === 'video' && mediaUrl}<video
      src={mediaUrl}
      controls
      onerror={() => onerror('This video codec is not supported by the system webview.')}
      ><track kind="captions" /></video
    >{/if}
  {#if animated && mediaUrl}<div class="animation"><img src={mediaUrl} alt={doc.name} /></div>{/if}
  {#if busy}<div class="loading" role="status">
      <span class="spinner"></span> Opening {doc.sources[doc.index]?.name}…
    </div>{/if}
  {#if localError}<div class="local-error">{localError}</div>{/if}
</div>

<style>
  .pane {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    background: #202020;
    overflow: hidden;
  }
  iframe {
    border: 0;
    width: 100%;
    height: 100%;
    display: block;
  }
  iframe.inactive {
    visibility: hidden;
    position: absolute;
    pointer-events: none;
    top: 0;
    left: 0;
  }
  pre {
    position: absolute;
    inset: 0;
    overflow: auto;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    text-align: left;
    margin: 0;
    padding: 24px;
    color: #d2d5da;
    font:
      12px/1.7 ui-monospace,
      SFMono-Regular,
      monospace;
    user-select: text;
  }
  video,
  .animation {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
  .animation {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .animation img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }
  .loading {
    position: absolute;
    bottom: 18px;
    left: 18px;
    border: 1px solid #414852;
    background: #25292eed;
    color: #c7ced6;
    border-radius: 5px;
    padding: 10px 14px;
    font-size: 12px;
    display: flex;
    gap: 9px;
    align-items: center;
  }
  .spinner {
    width: 12px;
    height: 12px;
    border: 2px solid #46505c;
    border-top-color: #5baff0;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .local-error {
    position: absolute;
    top: 25px;
    left: 25px;
    right: 25px;
    color: #ffbdbd;
    background: #432828;
    padding: 16px;
    border-radius: 4px;
  }
</style>
