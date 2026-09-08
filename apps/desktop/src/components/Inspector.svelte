<script lang="ts">
  import type { SourceDocument } from '../documents';
  let {
    document: doc,
    snapshot = {},
    action,
    ondepth,
    onadd,
  }: {
    document: SourceDocument;
    snapshot: any;
    action: (name: string, ...args: any[]) => Promise<any>;
    ondepth: () => void;
    onadd: () => void;
  } = $props();
  let tab = $state('appearance');
  let selected = $state('0');
  let histogram = $state<number[]>([]);
  const image = $derived(
    doc.kind === 'image' && !/\.gif$/i.test(doc.sources[doc.index]?.name || '')
  );
  $effect(() => {
    doc.id;
    doc.index;
    histogram = [];
    selected = '0';
  });
  const settings = $derived(snapshot.settings || {});
  const selectedObject = $derived(
    snapshot.objects?.find((o: any) => o.id === selected) || snapshot.objects?.[0]
  );
  const layers = $derived(snapshot.layers || []);
  function patch(key: string, value: any) {
    void action('settings', { [key]: value });
  }
  function normalization(key: string, value: any) {
    patch('normalization', { ...(settings.normalization || { min: 0, max: 1 }), [key]: value });
  }
  const depth = $derived(
    image &&
      /\.(tiff?|png|npy|npz|pfm|exr)$/i.test(doc.sources[doc.index]?.name || '') &&
      Number(snapshot.format?.samplesPerPixel || 1) === 1
  );
</script>

<aside class="inspector" aria-label="Inspector">
  <div class="heading">
    <span>INSPECTOR</span><span class="kind"
      >{doc.kind === 'scene' ? '3D' : doc.kind === 'image' ? 'IMAGE' : doc.kind.toUpperCase()}</span
    >
  </div>
  <nav aria-label="Inspector sections">
    {#each ['contents', 'appearance', 'tools'] as section}<button
        class:active={tab === section}
        onclick={() => (tab = section)}>{section[0].toUpperCase() + section.slice(1)}</button
      >{/each}
  </nav>
  <div class="body">
    {#if tab === 'contents'}
      <h3>{image ? 'Layers' : 'Objects'}</h3>
      {#if doc.kind === 'scene'}
        {#each snapshot.objects || [] as object}<div
            class="object"
            class:chosen={selectedObject?.id === object.id}
          >
            <input
              type="checkbox"
              aria-label={`Show ${object.name}`}
              checked={object.visible}
              onclick={e => void action(e.shiftKey ? 'isolate' : 'visibility', Number(object.id))}
            />
            <button class="name" onclick={() => (selected = object.id)}
              >{object.name}<small>{object.count?.toLocaleString()} points</small></button
            >
            <button
              class="quiet"
              aria-label={`Remove ${object.name}`}
              onclick={() => void action('remove', Number(object.id))}>×</button
            >
          </div>{/each}
      {:else if image}
        {#each layers as layer}<div class="layer">
            <div class="row">
              <input
                type="checkbox"
                aria-label={`Show ${layer.name}`}
                checked={layer.visible}
                onclick={e => void action('layerVisibility', layer.id, e.shiftKey)}
              /><span class="name">{layer.name}</span><button
                class="quiet"
                aria-label={`Remove ${layer.name}`}
                onclick={() => void action('removeLayer', layer.id)}>×</button
              >
            </div>
            <label
              >Opacity<input
                aria-label={`Opacity ${layer.name}`}
                type="range"
                min="0"
                max="1"
                step=".01"
                value={layer.opacity ?? 1}
                oninput={e =>
                  void action('layer', layer.id, { opacity: Number(e.currentTarget.value) })}
                ondblclick={() => void action('layer', layer.id, { opacity: 1 })}
                title="Double-click to reset"
              /></label
            >
            <label
              >Blend<select
                value={layer.blendMode || 'normal'}
                onchange={e => void action('layer', layer.id, { blendMode: e.currentTarget.value })}
                >{#each ['normal', 'difference', 'subtract', 'add', 'multiply', 'screen', 'divide', 'overlay'] as mode}<option
                    >{mode}</option
                  >{/each}</select
              ></label
            >
          </div>{/each}
        {#if !layers.length && /\.(psd|psb|ora|kra|xcf|afphoto)$/i.test(doc.name)}<button
            class="wide"
            onclick={() => void action('exploreLayers')}>Explore file layers</button
          >{/if}
        {#if !layers.length}<div class="single-source">
            {doc.sources[doc.index]?.name}<small>Single image</small>
          </div>{/if}
      {/if}
      {#if image || doc.kind === 'scene'}<button class="wide" onclick={onadd}
          >+ Add selected files {image ? 'as layers' : 'to scene'}</button
        >{/if}
    {:else if tab === 'appearance'}
      {#if image && settings.normalization}
        <h3>Display range</h3>
        <label class="check"
          ><input
            type="checkbox"
            checked={settings.normalization.autoNormalize}
            onchange={e => normalization('autoNormalize', e.currentTarget.checked)}
          />Automatic range</label
        >
        <div class="pair">
          <label
            >Minimum<input
              aria-label="Minimum"
              type="number"
              step="any"
              value={settings.normalization.min}
              onchange={e => normalization('min', Number(e.currentTarget.value))}
            /></label
          ><label
            >Maximum<input
              aria-label="Maximum"
              type="number"
              step="any"
              value={settings.normalization.max}
              onchange={e => normalization('max', Number(e.currentTarget.value))}
            /></label
          >
        </div>
        <label class="check"
          ><input
            type="checkbox"
            checked={settings.normalization.gammaMode}
            onchange={e => normalization('gammaMode', e.currentTarget.checked)}
          />Use gamma / exposure</label
        >
        <label
          >Exposure <span>{settings.brightness?.offset || 0} EV</span><input
            aria-label="Exposure"
            type="range"
            min="-8"
            max="8"
            step=".1"
            value={settings.brightness?.offset || 0}
            oninput={e => patch('brightness', { offset: Number(e.currentTarget.value) })}
            ondblclick={() => patch('brightness', { offset: 0 })}
            title="Double-click to reset"
          /></label
        >
        <label
          >Gamma<input
            aria-label="Gamma"
            type="number"
            min=".1"
            max="8"
            step=".1"
            value={settings.gamma?.out || 2.2}
            onchange={e =>
              patch('gamma', { in: settings.gamma?.in || 2.2, out: Number(e.currentTarget.value) })}
          /></label
        >
        <label
          >Colormap<select
            aria-label="Colormap"
            value={settings.displayColormap || ''}
            onchange={e =>
              void action('command', 'setDisplayColormap', { colormap: e.currentTarget.value })}
            ><option value="">Original</option
            >{#each ['gray', 'viridis', 'plasma', 'inferno', 'magma', 'turbo', 'jet'] as map}<option
                >{map}</option
              >{/each}</select
          ></label
        >
        <button class="wide" onclick={async () => (histogram = (await action('histogram')) || [])}
          >Inspect histogram</button
        >
        {#if histogram.length}<div class="histogram" aria-label="Sampled histogram">
            {#each histogram as bin}<i style:height={`${(100 * bin) / Math.max(1, ...histogram)}%`}
              ></i>{/each}
          </div>
          <small>Sampled distribution · original values</small>{/if}
        <button class="wide" onclick={() => void action('channels')}>Inspect channels</button>
        {#if snapshot.channels?.length}<h3>Channels</h3>
          {#each snapshot.channels as channel}<label class="check"
              ><input
                type="checkbox"
                checked={channel.enabled}
                onclick={e =>
                  void action('channel', channel.index, e.currentTarget.checked, e.shiftKey)}
              />{channel.name}</label
            >{/each}{/if}
      {:else if doc.kind === 'scene' && selectedObject}
        <h3>Point appearance</h3>
        <label
          >Object<select
            value={selectedObject.id}
            onchange={e => (selected = e.currentTarget.value)}
            >{#each snapshot.objects || [] as object}<option value={object.id}>{object.name}</option
              >{/each}</select
          ></label
        >
        <label
          >Point size<input
            aria-label="Point size"
            type="number"
            min=".00001"
            step=".001"
            value={selectedObject.size}
            onchange={e =>
              void action('size', Number(selectedObject.id), Number(e.currentTarget.value))}
          /></label
        >
        <label
          >Colour<select
            aria-label="Point colour"
            value={selectedObject.colorMode}
            onchange={e => void action('color', Number(selectedObject.id), e.currentTarget.value)}
            ><option value="assigned">Uniform</option>{#if selectedObject.colors}<option
                value="original">Original RGB</option
              >{/if}</select
          ></label
        >
        <p class="hint">
          Drag to orbit · scroll to zoom<br />Shift-click visibility to isolate an object.
        </p>
      {:else}<p class="hint">Select a visual document to adjust its appearance.</p>{/if}
    {:else}
      {#if image || doc.kind === 'scene'}<h3>View</h3>
        <button class="wide" onclick={() => void action('fit')}>Fit to view</button>{:else}<p
          class="hint"
        >
          This preview uses the original file. No visual adjustments are available.
        </p>{/if}
      {#if depth}<button class="wide" onclick={ondepth}>Create 3D view…</button>
        <p class="hint">Interpret original samples as depth and configure the camera.</p>{/if}
      {#if doc.kind === 'scene'}<h3>Measure</h3>
        <button class="wide" onclick={() => void action('measure')}>Toggle point picking</button
        ><button class="wide" onclick={() => void action('clearMeasurements')}
          >Clear measurements</button
        >{/if}
      {#if image && layers.length}<h3>Composition</h3>
        <div class="pair">
          <button onclick={() => void action('undo')}>Undo</button><button
            onclick={() => void action('redo')}>Redo</button
          >
        </div>{/if}
      {#if image || doc.kind === 'scene'}<h3>Export</h3>
        <button class="wide" onclick={() => void action('export')}>Save rendered view…</button>{/if}
    {/if}
    <details>
      <summary>Details</summary>
      <p>{doc.sources[doc.index]?.name}</p>
      {#if snapshot.size}<p>{snapshot.size}</p>{/if}{#if snapshot.format}<pre>{JSON.stringify(
            snapshot.format,
            null,
            2
          )}</pre>{/if}
      <p>{doc.sources.length} source file{doc.sources.length === 1 ? '' : 's'}</p>
    </details>
  </div>
</aside>

<style>
  .inspector {
    height: 100%;
    display: flex;
    flex-direction: column;
    background: #1b1d20;
    border-left: 1px solid #303338;
    min-width: 0;
  }
  .heading {
    height: 42px;
    padding: 0 14px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 10px;
    letter-spacing: 1.2px;
    color: #939ca8;
  }
  .kind {
    font-size: 9px;
    letter-spacing: 0.5px;
    background: #2a2e34;
    padding: 3px 5px;
    border-radius: 3px;
  }
  nav {
    display: flex;
    border-bottom: 1px solid #303338;
    padding: 0 8px;
    gap: 5px;
  }
  nav button {
    flex: 1;
    border: 0;
    border-bottom: 2px solid transparent;
    border-radius: 0;
    padding: 10px 3px;
    color: #9fa7b2;
  }
  nav .active {
    color: #eee;
    border-bottom-color: #409fdb;
    background: none;
  }
  .body {
    padding: 0 14px 20px;
    overflow: auto;
    flex: 1;
  }
  h3 {
    font-size: 11px;
    margin: 20px 0 12px;
    font-weight: 600;
    color: #eee;
  }
  label {
    display: flex;
    align-items: center;
    justify-content: space-between;
    flex-wrap: wrap;
    font-size: 11px;
    gap: 8px;
    margin: 12px 0;
    color: #aeb5bf;
  }
  label input[type='range'] {
    width: 100%;
    accent-color: #419edb;
    height: 4px;
    margin: 5px 0 8px;
  }
  label input[type='number'] {
    width: 88px;
  }
  label select {
    max-width: 150px;
  }
  .check {
    justify-content: flex-start;
  }
  .check input {
    accent-color: #419edb;
  }
  .pair {
    display: flex;
    gap: 8px;
  }
  .pair > * {
    flex: 1;
    min-width: 0;
  }
  .pair label {
    display: block;
  }
  .pair input {
    margin-top: 7px;
    width: 100% !important;
  }
  .wide {
    width: 100%;
    margin: 5px 0;
    text-align: left;
    padding: 8px 10px;
  }
  .hint,
  small {
    font-size: 10px;
    line-height: 1.7;
    color: #828d9a;
  }
  small {
    display: block;
  }
  .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
    border: 0;
    background: none;
    color: #d6dae0;
    font: inherit;
  }
  .object {
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 7px;
    border: 1px solid transparent;
    border-radius: 4px;
    margin-bottom: 6px;
  }
  .object.chosen {
    border-color: #42576b;
    background: #242d36;
  }
  .quiet {
    border: 0;
    background: none;
    padding: 2px 5px;
    color: #9aa6b5;
  }
  .single-source,
  .layer {
    background: #24272b;
    padding: 10px;
    border-radius: 4px;
    font-size: 11px;
    margin-bottom: 10px;
    overflow-wrap: anywhere;
  }
  .row {
    display: flex;
    gap: 6px;
    align-items: center;
  }
  .histogram {
    height: 70px;
    display: flex;
    align-items: flex-end;
    border-bottom: 1px solid #555;
    gap: 1px;
    margin-top: 12px;
  }
  .histogram i {
    flex: 1;
    background: #459bc8;
  }
  details {
    margin-top: 24px;
    border-top: 1px solid #303338;
    padding-top: 13px;
    color: #858f9c;
    font-size: 11px;
  }
  details p {
    overflow-wrap: anywhere;
  }
  summary {
    cursor: pointer;
  }
  pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: 10px;
  }
</style>
