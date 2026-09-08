<script lang="ts">
  let { load, extension = false }: { load: (url: string, name: string, signal: AbortSignal) => Promise<void>; extension?: boolean } = $props();
  let expanded = $state(false);
  let url = $state('');
  let name = $state('');
  let busy = $state(false);
  let error = $state('');
  let controller: AbortController | undefined;
  async function submit() {
    busy = true;
    error = '';
    controller = new AbortController();
    try {
      await load(url, name, controller.signal);
      expanded = false;
    } catch (cause) {
      error = controller.signal.aborted ? 'Download cancelled.' : `${cause instanceof Error ? cause.message : String(cause)}${extension ? '' : ' If the URL works in another tab, the server may need to allow cross-origin requests (CORS).'}`;
    } finally { busy = false; }
  }
</script>
<button class="secondary-button" onclick={() => { if (extension) { void submit(); } else { expanded = !expanded; } }}>Load Remote URL</button>
{#if expanded}
  <form onsubmit={event => { event.preventDefault(); void submit(); }}>
    <label>File URL <input aria-label="File URL" bind:value={url} placeholder="https://example.com/cloud.ply" required disabled={busy} /></label>
    <label>Filename (optional) <input aria-label="Filename (optional)" bind:value={name} placeholder="cloud.ply — for URLs without a file extension" disabled={busy} /></label>
    <button type="submit" disabled={busy}>{busy ? 'Downloading…' : 'Load'}</button>
    {#if busy}<button type="button" onclick={() => controller?.abort()}>Cancel</button>{/if}
    {#if error}<p role="alert">{error}</p>{/if}
  </form>
{/if}
<style>
  form { flex-basis: 100%; display: grid; gap: 8px; padding: 8px 0; }
  label { display: grid; gap: 4px; }
  input { width: 100%; box-sizing: border-box; }
  p { overflow-wrap: anywhere; }
</style>
