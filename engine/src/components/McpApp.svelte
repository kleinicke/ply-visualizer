<script lang="ts">
  import { onMount } from 'svelte';
  import { App } from '@modelcontextprotocol/ext-apps';

  let url = $state('');
  let error = $state('');
  let loaded = $state(false);
  let app: App;

  onMount(() => {
    app = new App({ name: 'ply-visualizer', version: '0.3.0.dev0' }, {});
    app.ontoolresult = result => {
      try {
        if (result.isError) throw new Error('The scene could not be opened.');
        const text = result.content?.find(item => item.type === 'text');
        const scene = result.structuredContent ?? (text?.type === 'text' ? JSON.parse(text.text) : null);
        const next = new URL(scene?.url);
        if (next.protocol !== 'http:' || next.hostname !== '127.0.0.1' || !next.port ||
            next.username || next.password || !/^\/[A-Za-z0-9_-]{32,}\/$/.test(next.pathname)) {
          throw new Error('The tool returned an invalid local viewer URL.');
        }
        next.search = '?ui=collapsed';
        next.hash = '';
        if (next.href !== url) { loaded = false; url = next.href; }
        error = '';
      } catch (cause) {
        error = cause instanceof Error ? cause.message : String(cause);
      }
    };
    app.ontoolcancelled = () => { error = 'Scene creation was cancelled.'; };
    void app.connect().catch(() => { error = 'Could not connect to the chat host.'; });
    return () => { void app.close(); };
  });

  async function openBrowser() {
    try {
      const result = await app.openLink({ url });
      if (result.isError) error = 'The host could not open the browser link.';
    } catch { error = 'The host could not open the browser link.'; }
  }
</script>

<svelte:head><title>3D viewer</title></svelte:head>
<section aria-label="Interactive 3D viewer">
  <header>
    <strong>3D viewer</strong>
    {#if url}<button onclick={openBrowser}>Open in browser</button>{/if}
  </header>
  {#if error}<p role="alert">{error}</p>{/if}
  {#if url}
    <iframe title="Point cloud and mesh viewer" src={url} onload={() => { loaded = true; }}
      sandbox="allow-scripts allow-same-origin allow-downloads" allow="fullscreen"></iframe>
    <p class="hint">{loaded ? 'Drag to rotate · Scroll to zoom' : 'Loading scene…'} · If the view stays blank, open it in your browser. Keep the local MCP server running.</p>
  {:else}
    <p>Waiting for a 3D scene…</p>
  {/if}
</section>

<style>
  :global(body) { margin: 0; font: 13px system-ui, sans-serif; color: var(--color-text-primary, #ddd); background: var(--color-background-primary, #181b20); }
  section { width: 100%; }
  header { display: flex; align-items: center; justify-content: space-between; padding: 10px 12px; gap: 12px; }
  button { font: inherit; cursor: pointer; color: inherit; background: transparent; border: 1px solid #777; border-radius: 6px; padding: 5px 10px; }
  iframe { display: block; border: 0; width: 100%; height: 480px; }
  p { margin: 0; padding: 10px 12px; }
  .hint { opacity: .7; font-size: 12px; }
  [role='alert'] { color: #ffae93; }
</style>
