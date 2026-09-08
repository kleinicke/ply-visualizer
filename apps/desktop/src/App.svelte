<script lang="ts">
  import { onMount } from 'svelte';
  import FolderTree from './components/FolderTree.svelte';
  import ViewerPane from './components/ViewerPane.svelte';
  import Inspector from './components/Inspector.svelte';
  import {
    routeDocument,
    orderedSources,
    matchesFilter,
    type SourceDocument,
    type FileRef,
  } from './documents';
  import {
    native,
    openWorkspace,
    listDirectory,
    openReferences,
    pendingReferences,
    type FolderEntry,
    type Workspace,
  } from './host';
  let workspace = $state<Workspace | null>(null),
    entries = $state<FolderEntry[]>([]),
    loose = $state<FileRef[]>([]);
  let documents = $state<SourceDocument[]>([]),
    activeId = $state(''),
    snapshot = $state<any>({});
  let selected = $state(new Set<string>()),
    query = $state(''),
    error = $state(''),
    loading = $state(false),
    playing = $state(false),
    rate = $state(5),
    paneIndex = $state(0);
  let explorerVisible = $state(true),
    inspectorVisible = $state(true);
  let picker: HTMLInputElement, folderPicker: HTMLInputElement;
  let pane = $state<ViewerPane>();
  let comparePanes: ViewerPane[] = [];
  const active = $derived(documents.find(d => d.id === activeId));
  const current = $derived(active?.sources[active.index] || active?.sources[0]);
  const compareDocuments = $derived(
    active?.mode === 'compare'
      ? active.sources.map(
          ref =>
            ({
              id: `${active.id}:${ref.id}`,
              name: ref.name,
              sources: [ref],
              kind: routeDocument(ref.name)[0],
              mode: 'single',
              pinned: true,
              index: 0,
            }) as SourceDocument
        )
      : []
  );
  function allFiles(nodes = entries): FileRef[] {
    return nodes.flatMap(e => (e.document ? [e.document] : e.children ? allFiles(e.children) : []));
  }
  const availableFiles = $derived([...new Map([...allFiles(), ...loose].map(f => [f.id, f])).values()]);
  const chosen = $derived(availableFiles.filter(f => selected.has(f.id)));
  function setSelected(ref: FileRef, checked: boolean) {
    const next = new Set(selected);
    checked ? next.add(ref.id) : next.delete(ref.id);
    selected = next;
  }
  function show(ref: FileRef, pin = false) {
    playing = false;
    error = '';
    snapshot = {};
    paneIndex = 0;
    loading = true;
    const existing = documents.find(d => d.mode === 'single' && d.sources[0]?.id === ref.id);
    if (existing) {
      if (pin) existing.pinned = true;
      activeId = existing.id;
      loading = false;
      return;
    }
    const doc: SourceDocument = {
      id: crypto.randomUUID(),
      name: ref.name,
      sources: [ref],
      kind: routeDocument(ref.name)[0],
      mode: 'single',
      pinned: pin,
      index: 0,
    };
    documents = [...documents.filter(d => d.pinned), doc];
    activeId = doc.id;
  }
  function activate(doc: SourceDocument) {
    if (activeId === doc.id) return;
    playing = false;
    error = '';
    snapshot = {};
    activeId = doc.id;
    paneIndex = 0;
    loading = true;
  }
  function close(id: string) {
    playing = false;
    documents = documents.filter(d => d.id !== id);
    if (activeId === id) {
      activeId = documents.at(-1)?.id || '';
      snapshot = {};
    }
  }
  async function openFiles() {
    try {
      if (!native) {
        picker.click();
        return;
      }
      const files = await openReferences();
      loose = [...new Map([...loose, ...files].map(f => [f.id, f])).values()];
      if (files[0]) show(files[0], true);
    } catch (e) {
      error = String(e);
    }
  }
  async function openFolder() {
    try {
      if (!native) {
        folderPicker.click();
        return;
      }
      const result = await openWorkspace();
      if (result) {
        workspace = result;
        entries = await listDirectory(result.id);
        selected = new Set();
      }
    } catch (e) {
      error = String(e);
    }
  }
  async function toggle(entry: FolderEntry) {
    try {
      entry.expanded = !entry.expanded;
      if (entry.expanded && !entry.children && workspace)
        entry.children = await listDirectory(workspace.id, entry.path);
      entries = [...entries];
    } catch (e) {
      entry.expanded = false;
      error = String(e);
    }
  }
  function receive(files: FileList | File[], folder = false) {
    const refs = Array.from(files, file => ({
      id: crypto.randomUUID(),
      name: file.name,
      size: file.size,
      file,
      path: file.webkitRelativePath || file.name,
    }));
    if (folder) {
      workspace = { id: 'browser', name: refs[0]?.path?.split('/')[0] || 'Folder' };
      const root: FolderEntry[] = [];
      for (const ref of refs) {
        const parts = ref.path!.split('/').slice(1);
        let children = root;
        let prefix = '';
        for (const name of parts.slice(0, -1)) {
          prefix += name + '/';
          let dir = children.find(e => e.directory && e.name === name);
          if (!dir) {
            dir = { name, path: prefix, directory: true, children: [] };
            children.push(dir);
          }
          children = dir.children!;
        }
        children.push({ name: ref.name, path: ref.path!, directory: false, document: ref });
      }
      const sort = (list: FolderEntry[]) => {
        list.sort(
          (a, b) =>
            Number(b.directory) - Number(a.directory) ||
            a.name.localeCompare(b.name, undefined, { numeric: true })
        );
        list.forEach(e => e.children && sort(e.children));
      };
      sort(root);
      entries = root;
      selected = new Set();
    } else {
      loose = [...loose, ...refs];
      if (refs[0]) show(refs[0], true);
    }
  }
  function group(mode: SourceDocument['mode']) {
    let files = orderedSources(chosen);
    if (files.length < 2) {
      error = 'Select at least two files in the workspace.';
      return;
    }
    const kinds = files.map(f => routeDocument(f.name)[0]);
    if (kinds.some(k => !['image', 'scene'].includes(k))) {
      error = 'Select image or 3D files for this view.';
      return;
    }
    if (mode !== 'compare' && kinds.some(k => k !== kinds[0])) {
      error = 'A collection or composition needs sources of the same view type.';
      return;
    }
    if (mode === 'compare' && files.length > 4) {
      error = 'Compare up to four files at once.';
      return;
    }
    const doc: SourceDocument = {
      id: crypto.randomUUID(),
      name: `${mode === 'composition' ? (kinds[0] === 'image' ? 'Layers' : 'Scene') : mode === 'sequence' ? 'Sequence' : mode === 'compare' ? 'Compare' : 'Collection'} · ${files.length}`,
      sources: files,
      kind: kinds[0],
      mode,
      pinned: true,
      index: 0,
    };
    documents = [...documents.filter(d => d.pinned), doc];
    activeId = doc.id;
    snapshot = {};
    error = '';
    playing = false;
    loading = true;
    paneIndex = 0;
  }
  function addToActive() {
    if (!active) return;
    active.presentation = undefined;
    const files = chosen.filter(f => !active.sources.some(s => s.id === f.id));
    if (!files.length) {
      error = 'Select files in the browser to add.';
      return;
    }
    if (files.some(f => routeDocument(f.name)[0] !== active.kind)) {
      error = 'Choose sources that match this view.';
      return;
    }
    active.sources = [...active.sources, ...files];
    active.mode = 'composition';
    active.pinned = true;
    active.index = 0;
    loading = true;
  }
  function depth() {
    if (!active || !current) return;
    active.pinned = true;
    const doc: SourceDocument = {
      id: crypto.randomUUID(),
      name: `${current.name} · 3D`,
      sources: [current],
      kind: 'scene',
      mode: 'single',
      pinned: true,
      index: 0,
    };
    documents = [...documents, doc];
    activeId = doc.id;
    snapshot = {};
    loading = true;
  }
  function step(delta: number) {
    if (!active) return;
    if (active.sources.length > 1 && ['collection', 'sequence'].includes(active.mode)) {
      active.index = (active.index + delta + active.sources.length) % active.sources.length;
      loading = true;
      snapshot = {};
    } else {
      const files = availableFiles.filter(f => matchesFilter(f.name, query));
      const index = files.findIndex(f => f.id === current?.id);
      if (files[index + delta]) show(files[index + delta]);
    }
  }
  async function action(name: string, ...args: any[]) {
    const target = active?.mode === 'compare' ? comparePanes[paneIndex] : pane;
    return target?.action(name, ...args);
  }
  function updateState(next: any) {
    snapshot = next;
    if (active?.kind === 'image' && next.settings) active.settings = next.settings;
  }
  function ready() {
    loading = false;
    void native?.core.invoke('diagnostic', {
      message: `Opened ${current?.name} as ${active?.kind}`,
    });
  }
  function fail(message: string) {
    error = message;
    loading = false;
    playing = false;
  }
  let playback: ReturnType<typeof setTimeout>;
  $effect(() => {
    clearTimeout(playback);
    if (playing && !loading && active?.mode === 'sequence')
      playback = setTimeout(() => step(1), 1000 / Math.max(0.1, rate));
    return () => clearTimeout(playback);
  });
  onMount(() => {
    let cleanup: Array<() => void> = [];
    let disposed = false;
    if (native)
      void (async () => {
        const drain = async () => {
          const refs = await pendingReferences();
          if (refs.length) {
            loose = [...loose, ...refs];
            show(refs[0], true);
          }
        };
        await drain();
        const off = await native.event.listen(
          'files-pending',
          () => void drain().catch(e => fail(String(e)))
        );
        if (disposed) off();
        else cleanup.push(off);
      })().catch(e => fail(String(e)));
    return () => {
      disposed = true;
      cleanup.forEach(fn => fn());
    };
  });
</script>

<svelte:window
  onkeydown={e => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      void (e.shiftKey ? openFolder() : openFiles());
    } else if (
      !(e.target instanceof HTMLInputElement) &&
      !(e.target instanceof HTMLSelectElement)
    ) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        step(1);
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        step(-1);
      }
    }
  }}
  ondragover={e => e.preventDefault()}
  ondrop={e => {
    e.preventDefault();
    if (!native && e.dataTransfer?.files) receive(e.dataTransfer.files);
  }}
/>
<div class="workspace">
  <header>
    <div class="brand">
      <span class="mark">◈</span> Visualizer <span class="preview-label">WORKSPACE</span>
    </div>
    <div class="top-actions">
      <button onclick={() => void openFolder()}>Open folder…</button><button
        onclick={() => void openFiles()}>Open files…</button
      >
    </div>
    <span class="header-spacer"></span><button
      class="icon-button"
      class:pressed={explorerVisible}
      onclick={() => (explorerVisible = !explorerVisible)}
      title="Toggle file browser">☷</button
    ><button
      class="icon-button"
      class:pressed={inspectorVisible}
      onclick={() => (inspectorVisible = !inspectorVisible)}
      title="Toggle inspector">☰</button
    >
  </header>
  <div class="layout" class:no-explorer={!explorerVisible} class:no-inspector={!inspectorVisible}>
    {#if explorerVisible}<aside class="explorer" aria-label="Workspace files">
        <div class="explorer-title">
          {workspace?.name || 'FILES'}<button
            title="Refresh folder"
            onclick={async () => {
              try {
                if (workspace && native) {
                  entries = await listDirectory(workspace.id);
                  selected = new Set();
                }
              } catch (e) {
                fail(String(e));
              }
            }}>↻</button
          >
        </div>
        <div class="filter">
          <input aria-label="Filter files" placeholder="Filter files · *.tif" bind:value={query} />
        </div>
        <div class="tree">
          <FolderTree
            {entries}
            {query}
            {selected}
            active={current?.id}
            onopen={show}
            ontoggle={toggle}
            onselect={setSelected}
          />{#if loose.length}<div class="section-label">OPENED FILES</div>
            {#each loose.filter(f => matchesFilter(f.name, query)) as ref}<div
                class="loose"
                class:current={ref.id === current?.id}
              >
                <input
                  type="checkbox"
                  aria-label={`Select ${ref.name}`}
                  checked={selected.has(ref.id)}
                  onchange={e => setSelected(ref, e.currentTarget.checked)}
                /><button
                  title={ref.name}
                  onclick={() => show(ref)}
                  ondblclick={() => show(ref, true)}>{ref.name}</button
                >
              </div>{/each}{/if}{#if !workspace && !loose.length}<p class="empty-files">
              Open a folder to browse your files.<br />Click a file to preview it.
            </p>{/if}
        </div>
        <div class="selection-actions">
          <span
            >{selected.size
              ? `${selected.size} selected`
              : 'Select files to combine or compare'}</span
          >
          <div>
            <button disabled={selected.size < 2} onclick={() => group('compare')}>Compare</button
            ><button disabled={selected.size < 2} onclick={() => group('composition')}
              >Combine</button
            >
          </div>
          <div>
            <button disabled={selected.size < 2} onclick={() => group('collection')}
              >Collection</button
            ><button disabled={selected.size < 2} onclick={() => group('sequence')}>Sequence</button
            >
          </div>
        </div>
      </aside>{/if}
    <main>
      <div class="tabs" aria-label="Open documents">
        {#each documents as doc}<div
            class="tab"
            class:active={doc.id === activeId}
            class:temporary={!doc.pinned}
          >
            <button
              onclick={() => activate(doc)}
              ondblclick={() => (doc.pinned = true)}
              title={doc.name}>{doc.name}</button
            ><button class="close" onclick={() => close(doc.id)} aria-label={`Close ${doc.name}`}
              >×</button
            >
          </div>{/each}
      </div>
      {#if active}<div class="view-toolbar">
          <span class="document-title">{current?.name || active.name}</span
          >{#if !active.pinned}<button onclick={() => (active.pinned = true)}>Keep open</button
            >{/if}<button onclick={() => step(-1)} title="Previous file">←</button><button
            onclick={() => step(1)}
            title="Next file">→</button
          ><button
            onclick={() => void action('fit')}
            disabled={active.kind === 'text' ||
              active.kind === 'video' ||
              /\.gif$/i.test(current?.name || '')}>Fit</button
          ><button
            onclick={() => void action('export')}
            disabled={active.kind === 'text' ||
              active.kind === 'video' ||
              /\.gif$/i.test(current?.name || '')}>Export…</button
          >
        </div>
        <div class="view-area" class:compare={active.mode === 'compare'}>
          {#if active.mode === 'compare'}{#each compareDocuments as doc, i (doc.id)}<section
                class:selected-pane={paneIndex === i}
              >
                <button
                  class="pane-title"
                  onclick={() => {
                    paneIndex = i;
                    snapshot = {};
                  }}>{doc.name}</button
                ><ViewerPane
                  bind:this={comparePanes[i]}
                  document={doc}
                  onstate={s => {
                    if (paneIndex === i) snapshot = s;
                  }}
                  onerror={fail}
                  onready={ready}
                />
              </section>{/each}{:else}<ViewerPane
              bind:this={pane}
              document={active}
              onstate={updateState}
              onerror={fail}
              onready={ready}
            />{/if}
        </div>
        {#if snapshot.axes?.length}<div class="axes">
            {#each snapshot.axes as axis}<label
                >{axis.label}{#if axis.labels}<select
                    value={axis.value}
                    onchange={e => void action('axis', axis.key, Number(e.currentTarget.value))}
                    >{#each axis.labels as label, i}<option value={i}>{label}</option
                      >{/each}</select
                  >{:else}<input
                    aria-label={axis.label}
                    type="range"
                    min="0"
                    max={axis.size - 1}
                    step="1"
                    value={axis.value}
                    oninput={e => void action('axis', axis.key, Number(e.currentTarget.value))}
                    ondblclick={() => void action('axis', axis.key, 0)}
                    title="Double-click to reset"
                  /><span>{axis.value + 1} / {axis.size}</span>{/if}</label
              >{/each}
          </div>{/if}
        {#if ['collection', 'sequence'].includes(active.mode)}<div class="filmstrip">
            {#each active.sources as source, i}<button
                class:active={i === active.index}
                onclick={() => {
                  active.index = i;
                  loading = true;
                }}
                title={source.name}
                ><small>{String(i + 1).padStart(2, '0')}</small>{source.name}</button
              >{/each}
          </div>{/if}
        {#if active.mode === 'sequence'}<div class="timeline">
            <button onclick={() => (playing = !playing)}>{playing ? 'Pause' : 'Play'}</button><input
              aria-label="Sequence frame"
              type="range"
              min="0"
              max={active.sources.length - 1}
              step="1"
              bind:value={active.index}
              ondblclick={() => (active.index = 0)}
              title="Double-click to reset"
            /><span>{active.index + 1} / {active.sources.length}</span><label
              ><input
                aria-label="Playback rate"
                type="number"
                min=".1"
                max="60"
                step="1"
                bind:value={rate}
              /> fps</label
            ><small>Every frame · loops · decoding may slow playback</small>
          </div>{/if}
      {:else}<div class="welcome">
          <div class="welcome-mark">◈</div>
          <h1>Your data, one workspace.</h1>
          <p>Browse images, point clouds and the files around them.</p>
          <div>
            <button class="primary" onclick={() => void openFolder()}>Open a folder</button><button
              onclick={() => void openFiles()}>Open files</button
            >
          </div>
          <div class="welcome-hints">
            <span><b>Browse</b>Click to preview. Double-click to keep.</span><span
              ><b>Inspect</b>One panel for images and 3D.</span
            ><span><b>Compare</b>Select files to arrange or combine.</span>
          </div>
        </div>{/if}
      {#if error}<div class="error" role="alert">
          <span>{error}</span><button onclick={() => (error = '')} aria-label="Dismiss error"
            >×</button
          >
        </div>{/if}
    </main>
    {#if inspectorVisible}{#if active}<Inspector
          document={active.mode === 'compare' ? compareDocuments[paneIndex] : active}
          {snapshot}
          {action}
          ondepth={depth}
          onadd={addToActive}
        />{:else}<aside class="inspector-empty">
          <span>INSPECTOR</span>
          <p>Select a file to explore its contents and appearance.</p>
        </aside>{/if}{/if}
  </div>
  <footer>
    <span
      >{loading ? 'Opening…' : snapshot.size || current?.name || 'Ready'}{snapshot.pixel
        ? ' · ' + snapshot.pixel
        : ''}</span
    ><span
      >{snapshot.fps ||
        (snapshot.zoom === 'fit'
          ? 'Fit'
          : typeof snapshot.zoom === 'number'
            ? `${Math.round(snapshot.zoom * 100)}%`
            : '')}{snapshot.fps || snapshot.zoom ? ' · ' : ''}Local files</span
    >
  </footer>
</div>
<input
  bind:this={picker}
  class="file-picker"
  type="file"
  multiple
  onchange={() => {
    if (picker.files) receive(picker.files);
    picker.value = '';
  }}
/>
<input
  bind:this={folderPicker}
  class="file-picker"
  type="file"
  multiple
  webkitdirectory
  onchange={() => {
    if (folderPicker.files) receive(folderPicker.files, true);
    folderPicker.value = '';
  }}
/>

<style>
  :global(html),
  :global(body),
  :global(#app) {
    margin: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #202020;
    color: #c7cdd5;
    font:
      12px -apple-system,
      BlinkMacSystemFont,
      'Segoe UI',
      sans-serif;
  }
  :global(*) {
    box-sizing: border-box;
  }
  :global(button),
  :global(input),
  :global(select) {
    font: inherit;
  }
  :global(button) {
    color: #bec7d2;
    background: #282c32;
    border: 1px solid #3a4048;
    border-radius: 4px;
    padding: 5px 9px;
    cursor: pointer;
    white-space: nowrap;
  }
  :global(button:hover:not(:disabled)) {
    background: #343b44;
    color: #fff;
  }
  :global(button:disabled) {
    opacity: 0.4;
    cursor: default;
  }
  :global(button:focus-visible),
  :global(input:focus-visible),
  :global(select:focus-visible) {
    outline: 1px solid #4da8e7;
    outline-offset: 1px;
  }
  :global(input:not([type='checkbox']):not([type='range'])),
  :global(select) {
    background: #22262b;
    color: #d7dde5;
    border: 1px solid #3d444e;
    border-radius: 3px;
    padding: 5px 7px;
    min-width: 0;
  }
  :global(input[type='range']) {
    accent-color: #439fdc;
  }
  :global(input[type='checkbox']) {
    accent-color: #439fdc;
  }
  .workspace {
    height: 100%;
    display: grid;
    grid-template-rows: 48px 1fr 25px;
  }
  header {
    display: flex;
    align-items: center;
    gap: 18px;
    background: #17191c;
    border-bottom: 1px solid #303338;
    padding: 0 14px;
  }
  .brand {
    font-size: 14px;
    color: #eceff3;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 9px;
  }
  .mark {
    color: #58b9d7;
    font-size: 27px;
  }
  .preview-label {
    font-size: 9px;
    color: #7c8794;
    letter-spacing: 1.4px;
    font-weight: 400;
    margin-left: 7px;
  }
  .top-actions {
    display: flex;
    gap: 6px;
  }
  .top-actions button {
    background: none;
    border-color: #353b43;
    font-size: 11px;
  }
  .header-spacer {
    flex: 1;
  }
  .icon-button {
    font-size: 17px;
    background: none;
    border-color: transparent;
    padding: 2px 6px;
  }
  .icon-button.pressed {
    color: #7fbee8;
  }
  .layout {
    display: grid;
    grid-template-columns: 230px minmax(0, 1fr) 275px;
    min-height: 0;
  }
  .layout.no-explorer {
    grid-template-columns: minmax(0, 1fr) 275px;
  }
  .layout.no-inspector {
    grid-template-columns: 230px minmax(0, 1fr);
  }
  .layout.no-explorer.no-inspector {
    grid-template-columns: minmax(0, 1fr);
  }
  .explorer {
    min-height: 0;
    display: flex;
    flex-direction: column;
    background: #1b1d20;
    border-right: 1px solid #303338;
  }
  .explorer-title {
    height: 43px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 13px;
    font-size: 11px;
    color: #acb5bf;
    overflow: hidden;
  }
  .explorer-title button {
    border: 0;
    background: none;
    color: #929daa;
  }
  .filter {
    padding: 0 10px 10px;
  }
  .filter input {
    width: 100%;
    font-size: 11px;
  }
  .tree {
    flex: 1;
    overflow: auto;
    min-height: 0;
  }
  .empty-files {
    font-size: 11px;
    line-height: 1.8;
    color: #737f8d;
    margin: 15px;
  }
  .section-label {
    font-size: 9px;
    letter-spacing: 1px;
    color: #6f7b8a;
    padding: 16px 12px 7px;
  }
  .loose {
    height: 30px;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 0 10px;
  }
  .loose.current {
    background: #173a52;
  }
  .loose button {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    text-align: left;
    border: 0;
    background: none;
    padding: 3px;
    font-size: 11px;
  }
  .loose input {
    width: 12px;
  }
  .selection-actions {
    padding: 12px 10px;
    border-top: 1px solid #303338;
  }
  .selection-actions span {
    display: block;
    font-size: 10px;
    color: #8793a2;
    margin-bottom: 8px;
  }
  .selection-actions > div {
    display: flex;
    gap: 6px;
    margin-top: 6px;
  }
  .selection-actions button {
    flex: 1;
    font-size: 10px;
  }
  main {
    display: flex;
    flex-direction: column;
    min-height: 0;
    min-width: 0;
    position: relative;
  }
  .tabs {
    display: flex;
    height: 35px;
    min-height: 35px;
    background: #181a1d;
    border-bottom: 1px solid #303338;
    overflow: auto;
  }
  .tab {
    display: flex;
    min-width: 100px;
    max-width: 230px;
    border-right: 1px solid #303338;
    border-top: 2px solid transparent;
  }
  .tab.active {
    background: #25282d;
    border-top-color: #49a4df;
  }
  .tab > button {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    background: none;
    border: 0;
    border-radius: 0;
    font-size: 11px;
    padding: 7px 10px;
  }
  .tab.temporary > button:first-child {
    font-style: italic;
  }
  .tab .close {
    padding-left: 3px;
    padding-right: 9px;
    color: #8793a2;
  }
  .view-toolbar {
    height: 37px;
    min-height: 37px;
    display: flex;
    align-items: center;
    gap: 5px;
    padding: 0 10px;
    border-bottom: 1px solid #2c2f34;
    background: #202226;
  }
  .document-title {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: #919ba8;
    font-size: 10px;
  }
  .view-toolbar button {
    font-size: 10px;
    padding: 3px 8px;
    background: none;
    border-color: #363c44;
  }
  .view-area {
    flex: 1;
    min-height: 0;
    min-width: 0;
  }
  .view-area.compare {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-auto-rows: minmax(0, 1fr);
    gap: 2px;
    background: #393d43;
  }
  .compare section {
    min-height: 0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    outline: 1px solid transparent;
    outline-offset: -1px;
  }
  .compare .selected-pane {
    outline-color: #489ed5;
  }
  .pane-title {
    text-align: left;
    border: 0;
    border-radius: 0;
    font-size: 10px;
    background: #292d33;
    overflow: hidden;
    text-overflow: ellipsis;
    flex-shrink: 0;
  }
  .welcome {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-direction: column;
    padding: 30px;
  }
  .welcome-mark {
    font-size: 70px;
    color: #4e9aa9;
    margin-bottom: 12px;
  }
  h1 {
    font-size: 27px;
    font-weight: 500;
    letter-spacing: -0.7px;
    color: #e8edf3;
    margin: 0 0 12px;
  }
  .welcome > p {
    font-size: 12px;
    color: #8d99a8;
    margin-bottom: 24px;
  }
  .welcome > div > button {
    padding: 8px 14px;
    margin: 0 3px;
  }
  .primary {
    background: #2379af;
    border-color: #328bc1;
    color: white;
  }
  .welcome-hints {
    margin-top: 60px;
    display: flex;
    gap: 28px;
    max-width: 580px;
  }
  .welcome-hints span {
    display: block;
    color: #798695;
    font-size: 10px;
    line-height: 1.7;
    max-width: 150px;
  }
  .welcome-hints b {
    display: block;
    color: #bdc7d1;
    font-weight: 500;
    margin-bottom: 4px;
  }
  .inspector-empty {
    background: #1b1d20;
    border-left: 1px solid #303338;
    padding: 17px 14px;
  }
  .inspector-empty span {
    color: #939ca8;
    font-size: 10px;
    letter-spacing: 1px;
  }
  .inspector-empty p {
    color: #697583;
    font-size: 11px;
    line-height: 1.8;
    margin-top: 28px;
  }
  .axes {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    padding: 8px 12px;
    background: #202329;
    border-top: 1px solid #363c43;
    font-size: 11px;
  }
  .axes label {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .axes input {
    width: 130px;
  }
  .axes span {
    color: #8f9aa8;
  }
  .filmstrip {
    display: flex;
    overflow: auto;
    background: #1b1e22;
    border-top: 1px solid #343940;
    padding: 8px;
    gap: 6px;
    min-height: 54px;
  }
  .filmstrip button {
    max-width: 180px;
    min-width: 90px;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 10px;
    background: #25292f;
    text-align: left;
    border-color: #343b44;
  }
  .filmstrip button.active {
    border-color: #4b9ed4;
    background: #263746;
  }
  .filmstrip small {
    display: block;
    color: #7f909f;
    font-size: 9px;
    margin-bottom: 4px;
  }
  .timeline {
    height: 40px;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 6px 10px;
    font-size: 10px;
    background: #1b1e22;
  }
  .timeline > input {
    flex: 1;
  }
  .timeline label input {
    width: 48px;
  }
  .timeline small {
    color: #72808e;
  }
  .error {
    position: absolute;
    bottom: 12px;
    left: 12px;
    right: 12px;
    background: #472c2e;
    border: 1px solid #7c4649;
    color: #f1c1c3;
    border-radius: 4px;
    padding: 10px 12px;
    display: flex;
    gap: 10px;
    align-items: center;
    z-index: 10;
    font-size: 11px;
  }
  .error span {
    flex: 1;
  }
  .error button {
    background: none;
    border: 0;
    color: inherit;
  }
  footer {
    display: flex;
    justify-content: space-between;
    gap: 20px;
    padding: 5px 12px;
    border-top: 1px solid #303338;
    background: #17191c;
    font-size: 10px;
    color: #8792a0;
  }
  footer span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .file-picker {
    position: fixed;
    left: -100px;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }
  @media (max-width: 1050px) {
    .layout {
      grid-template-columns: 190px minmax(0, 1fr) 245px;
    }
    .preview-label {
      display: none;
    }
    .timeline small {
      display: none;
    }
    .welcome-hints {
      gap: 15px;
    }
  }
</style>
