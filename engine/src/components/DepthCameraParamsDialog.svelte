<script lang="ts">
  import type { CameraParams } from '../interfaces';

  let {
    fileName,
    onSubmit,
    onCancel,
  }: {
    fileName: string;
    onSubmit: (params: CameraParams) => void;
    onCancel: () => void;
  } = $props();

  let depthType = $state<'euclidean' | 'orthogonal' | 'disparity' | 'inverse_depth'>('euclidean');

  let fxInputEl: HTMLInputElement;

  $effect(() => {
    setTimeout(() => fxInputEl?.focus(), 100);
  });

  function submit() {
    const fx = parseFloat((document.getElementById('depth-fx') as HTMLInputElement).value);
    const fyRaw = (document.getElementById('depth-fy') as HTMLInputElement).value;
    const fy = fyRaw ? parseFloat(fyRaw) : fx;
    const cxRaw = (document.getElementById('depth-cx') as HTMLInputElement).value;
    const cyRaw = (document.getElementById('depth-cy') as HTMLInputElement).value;
    const cx = cxRaw ? parseFloat(cxRaw) : undefined;
    const cy = cyRaw ? parseFloat(cyRaw) : undefined;
    const cameraModel = (document.getElementById('camera-model') as HTMLSelectElement).value as
      | 'pinhole-ideal'
      | 'pinhole-opencv'
      | 'fisheye-equidistant'
      | 'fisheye-opencv'
      | 'fisheye-kannala-brandt';
    const baseline = parseFloat((document.getElementById('depth-baseline') as HTMLInputElement).value);
    const disparityOffset = parseFloat(
      (document.getElementById('depth-disparity-offset') as HTMLInputElement).value
    );

    if (isNaN(fx) || fx <= 0) {
      alert('Invalid focal length X (fx)');
      return;
    }
    if (depthType === 'disparity' && (isNaN(baseline) || baseline <= 0)) {
      alert('Invalid baseline for disparity mode');
      return;
    }

    onSubmit({
      fx,
      fy,
      cx,
      cy,
      depthType,
      cameraModel,
      baseline: depthType === 'disparity' ? baseline : undefined,
      disparityOffset: depthType === 'disparity' ? disparityOffset : undefined,
    });
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  style="position: fixed; top: 0; left: 0; right: 0; bottom: 0; background-color: rgba(0, 0, 0, 0.5); display: flex; align-items: center; justify-content: center; z-index: 10000;"
>
  <div
    style="background-color: var(--vscode-editor-background); color: var(--vscode-editor-foreground); padding: 20px; border-radius: 8px; border: 1px solid var(--vscode-input-border); min-width: 400px; max-width: 600px; max-height: 80vh; overflow: auto;"
  >
    <h3 style="margin-top: 0;">Camera Parameters for {fileName}</h3>
    <p style="color: var(--vscode-descriptionForeground); margin-bottom: 20px;">
      Enter camera intrinsic parameters to convert depth image to point cloud:
    </p>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 20px;">
      <div>
        <label style="display: block; margin-bottom: 5px;">Focal Length X (fx):</label>
        <input
          bind:this={fxInputEl}
          type="number"
          id="depth-fx"
          step="0.1"
          value="525"
          style="width: 100%; padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px;"
        />
      </div>
      <div>
        <label style="display: block; margin-bottom: 5px;">Focal Length Y (fy):</label>
        <input
          type="number"
          id="depth-fy"
          step="0.1"
          placeholder="Same as fx"
          style="width: 100%; padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px;"
        />
      </div>
      <div>
        <label style="display: block; margin-bottom: 5px;">Principal Point X (cx):</label>
        <input
          type="number"
          id="depth-cx"
          step="0.1"
          placeholder="Auto (width/2)"
          style="width: 100%; padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px;"
        />
      </div>
      <div>
        <label style="display: block; margin-bottom: 5px;">Principal Point Y (cy):</label>
        <input
          type="number"
          id="depth-cy"
          step="0.1"
          placeholder="Auto (height/2)"
          style="width: 100%; padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px;"
        />
      </div>
    </div>

    <div style="margin-bottom: 20px;">
      <label style="display: block; margin-bottom: 5px;">Depth Type:</label>
      <select
        id="depth-type"
        style="width: 100%; padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px;"
        bind:value={depthType}
      >
        <option value="euclidean">Euclidean Distance (depth)</option>
        <option value="orthogonal">Orthogonal Distance (z)</option>
        <option value="disparity">Disparity</option>
        <option value="inverse_depth">Inverse Depth</option>
      </select>
    </div>

    <div
      id="disparity-params"
      style="display: {depthType === 'disparity'
        ? 'block'
        : 'none'}; margin-bottom: 20px; padding: 15px; background: var(--vscode-sideBar-background); border-radius: 4px;"
    >
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
        <div>
          <label style="display: block; margin-bottom: 5px;">Baseline (mm):</label>
          <input
            type="number"
            id="depth-baseline"
            step="0.1"
            value="120"
            style="width: 100%; padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px;"
          />
        </div>
        <div>
          <label style="display: block; margin-bottom: 5px;">Disparity Offset:</label>
          <input
            type="number"
            id="depth-disparity-offset"
            step="0.1"
            value="0"
            style="width: 100%; padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px;"
          />
        </div>
      </div>
    </div>

    <div style="margin-bottom: 20px;">
      <label style="display: block; margin-bottom: 5px;">Camera Model:</label>
      <select
        id="camera-model"
        style="width: 100%; padding: 8px; background: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px;"
      >
        <option value="pinhole-ideal">Pinhole (Ideal)</option>
        <option value="pinhole-opencv">Pinhole (OpenCV)</option>
        <option value="fisheye-equidistant">Fisheye (Equidistant)</option>
        <option value="fisheye-opencv">Fisheye (OpenCV)</option>
        <option value="fisheye-kannala-brandt">Fisheye (Kannala-Brandt)</option>
      </select>
    </div>

    <div style="display: flex; justify-content: flex-end; gap: 10px;">
      <button
        id="depth-cancel"
        style="padding: 10px 20px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-input-border); border-radius: 4px; cursor: pointer;"
        onclick={onCancel}>Cancel</button
      >
      <button
        id="depth-ok"
        style="padding: 10px 20px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; border-radius: 4px; cursor: pointer;"
        onclick={submit}>Convert to Point Cloud</button
      >
    </div>
  </div>
</div>
