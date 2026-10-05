<script lang="ts">
  import { onMount, untrack } from 'svelte';
  import { suggestTextOptions, type TextImportOptions } from '../textImport/options';
  let {
    fileName,
    sample,
    onImport,
    onCancel,
  }: {
    fileName: string;
    sample: string;
    onImport: (options: TextImportOptions) => Promise<void>;
    onCancel: () => void;
  } = $props();
  let options = $state(untrack(() => suggestTextOptions(sample)));
  let dialog: HTMLDialogElement;
  let error = $state('');
  let busy = $state(false);
  let x = $state(options.columns[0] + 1);
  let y = $state(options.columns[1] + 1);
  let z = $state(options.columns[2] + 1);
  onMount(() => {
    dialog.showModal();
  });
  async function submit(event: SubmitEvent) {
    event.preventDefault();
    error = '';
    busy = true;
    try {
      await onImport({ ...options, columns: [x - 1, y - 1, z - 1] });
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    } finally {
      busy = false;
    }
  }
</script>

<dialog bind:this={dialog} aria-labelledby="text-import-title" oncancel={(e) => { e.preventDefault(); if (!busy) onCancel(); }}>
  <form onsubmit={submit}>
    <h2 id="text-import-title">Import 3D text</h2>
    <p class="filename">{fileName}</p>
    <label>Layout
      <select bind:value={options.mode}>
        <option value="xyz">XYZ columns — one point per row</option>
        <option value="grid">Height grid — one height per cell</option>
      </select>
    </label>
    <div class="row">
      <label>Separator<select bind:value={options.delimiter}>
        <option value="comma">Comma</option><option value="tab">Tab</option>
        <option value="semicolon">Semicolon</option><option value="whitespace">Spaces</option>
      </select></label>
      <label>Skip header rows<input type="number" min="0" step="1" required bind:value={options.skipRows} /></label>
    </div>
    {#if options.mode === 'xyz'}
      <div class="row">
        <label>X column<input type="number" min="1" step="1" required bind:value={x} /></label>
        <label>Y column<input type="number" min="1" step="1" required bind:value={y} /></label>
        <label>Z column<input type="number" min="1" step="1" required bind:value={z} /></label>
      </div>
    {:else}
      <div class="row">
        <label>X spacing<input type="number" min="0.000000000001" step="any" required bind:value={options.spacing[0]} /></label>
        <label>Y spacing<input type="number" min="0.000000000001" step="any" required bind:value={options.spacing[1]} /></label>
      </div>
      <p class="help">Enter the distance between samples in the same units as the heights. The first cell starts at X=0, Y=0.</p>
    {/if}
    <label>Units (all axes)<select bind:value={options.scale}>
      <option value={1}>As supplied</option>
      <option value={0.001}>Micrometres → millimetres</option>
      <option value={1000}>Metres → millimetres</option>
    </select></label>
    <details open><summary>Preview and missing values</summary>
      <pre>{sample.split('\n').slice(0, 12).join('\n')}</pre>
      <label>Missing-value marker<input placeholder="e.g. -99999" bind:value={options.missing} /></label>
      <p class="help">Empty cells, NaN and NA are skipped. Numbers must use a decimal point.</p>
    </details>
    {#if error}<p role="alert">{error}</p>{/if}
    <div class="actions"><button type="button" disabled={busy} onclick={onCancel}>Cancel</button><button class="primary" type="submit" disabled={busy}>{busy ? 'Importing…' : 'Import'}</button></div>
  </form>
</dialog>

<style>
  dialog {
    color: var(--vscode-foreground, #ddd);
    background: var(--vscode-editor-background, #252526);
    border: 1px solid #777;
    border-radius: 8px;
    padding: 24px;
    width: min(460px, calc(100vw - 64px));
    max-height: 85vh;
    overflow: auto;
  }
  dialog::backdrop {
    background: #0008;
  }
  h2 {
    margin: 0 0 4px;
    font-size: 18px;
  }
  .filename {
    overflow-wrap: anywhere;
    opacity: 0.75;
    margin: 0 0 18px;
  }
  label {
    display: flex;
    flex-direction: column;
    gap: 5px;
    margin-bottom: 12px;
    flex: 1;
    min-width: 0;
  }
  input,
  select,
  button {
    font: inherit;
    color: inherit;
    background: var(--vscode-input-background, #333);
    border: 1px solid #777;
    border-radius: 4px;
    padding: 7px;
    min-width: 0;
  }
  .row {
    display: flex;
    gap: 12px;
  }
  .help {
    font-size: 12px;
    opacity: 0.8;
    margin: 0 0 12px;
  }
  summary {
    cursor: pointer;
    margin-bottom: 10px;
  }
  pre {
    overflow: auto;
    max-height: 150px;
    font-size: 12px;
    background: #0003;
    padding: 8px;
  }
  [role='alert'] {
    color: #ff9494;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 18px;
  }
  button {
    cursor: pointer;
  }
  .primary {
    background: var(--vscode-button-background, #0078d4);
    color: white;
  }
</style>
