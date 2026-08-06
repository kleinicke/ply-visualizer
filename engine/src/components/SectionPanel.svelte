<script lang="ts">
  let { host, fileIndex }: { host: any; fileIndex: number } = $props();
  let axis = $state(2);
  let ranges = $state<Array<[number, number]>>(
    [0, 1, 2].map(value => host.sectionPlanes.getBoundsRange(fileIndex, value))
  );

  function setEdge(edge: 0 | 1, value: number) {
    const next = ranges.map(range => [...range] as [number, number]);
    if (edge === 0) next[axis][0] = Math.min(value, next[axis][1]);
    else next[axis][1] = Math.max(value, next[axis][0]);
    ranges = next;
    const bounds = host.meshes[fileIndex]?.geometry?.boundingBox;
    if (!bounds) return;
    host.sectionPlanes.setBoundsRange(
      fileIndex,
      bounds,
      axis,
      next[axis][0],
      next[axis][1],
      host.transformationMatrices[fileIndex]
    );
    host.requestRender();
  }
</script>

<details class="panel-section" style="margin-top:5px;padding:4px 6px;">
  <summary style="font-size:10px;cursor:pointer;">Cross section</summary>
  <div style="display:grid;grid-template-columns:auto 1fr;gap:4px;align-items:center;margin-top:5px;font-size:10px;">
    <label for={`section-axis-${fileIndex}`}>Axis:</label>
    <select id={`section-axis-${fileIndex}`} value={axis} onchange={(event) => (axis = Number((event.target as HTMLSelectElement).value))}>
      <option value="0">X</option>
      <option value="1">Y</option>
      <option value="2">Z</option>
    </select>
    <span>Min:</span>
    <label style="display:flex;align-items:center;gap:4px;">
      <input aria-label="Cross section minimum" type="range" min="0" max="100" step="1" value={ranges[axis][0]} oninput={(event) => setEdge(0, Number((event.target as HTMLInputElement).value))} style="width:100%;" />
      <span style="min-width:28px;text-align:right;">{ranges[axis][0]}%</span>
    </label>
    <span>Max:</span>
    <label style="display:flex;align-items:center;gap:4px;">
      <input aria-label="Cross section maximum" type="range" min="0" max="100" step="1" value={ranges[axis][1]} oninput={(event) => setEdge(1, Number((event.target as HTMLInputElement).value))} style="width:100%;" />
      <span style="min-width:28px;text-align:right;">{ranges[axis][1]}%</span>
    </label>
  </div>
</details>
