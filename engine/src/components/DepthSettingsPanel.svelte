<script lang="ts">
  import { isPngDerivedFile } from '../depth/commentSettings';
  import { depthSettingsState } from '../state/depthSettings.svelte';
  import CalibrationSection from './CalibrationSection.svelte';

  let { host, fileIndex, data }: { host: any; fileIndex: number; data: any } = $props();

  let open = $state(false);
  let principalPointOpen = $state(false);
  let distortionOpen = $state(false);
  let disparityOffsetOpen = $state(false);
  let monoParamsOpen = $state(false);
  let rgb24Open = $state(false);
  let conventionOpen = $state(false);
  let colorImageOpen = $state(false);

  // Intentional: seed local UI state from the host once at mount; the change
  // handlers keep it in sync afterwards
  // svelte-ignore state_referenced_locally
  let cameraModel = $state(host.getDepthSetting(data, 'camera'));
  // svelte-ignore state_referenced_locally
  let depthType = $state(host.getDepthSetting(data, 'depth'));

  const isDisparity = $derived(depthType === 'disparity');
  const isPinholeOpencv = $derived(cameraModel === 'pinhole-opencv');
  const isFisheyeOpencv = $derived(cameraModel === 'fisheye-opencv');
  const isKannalaBrandt = $derived(cameraModel === 'fisheye-kannala-brandt');
  const showDistortionGroup = $derived(isPinholeOpencv || isFisheyeOpencv || isKannalaBrandt);

  const liveUpdateEnabled = $derived(depthSettingsState.liveUpdateFileIndices.includes(fileIndex));

  function toggle() {
    open = !open;
  }

  function blurOnWheel(e: WheelEvent) {
    (e.target as HTMLInputElement).blur();
  }

  function onFieldInput() {
    host.updateSingleDefaultButtonState(fileIndex);
  }

  function onCameraModelChange(e: Event) {
    cameraModel = (e.target as HTMLSelectElement).value;
    host.updateSingleDefaultButtonState(fileIndex);
  }

  function onDepthTypeChange(e: Event) {
    depthType = (e.target as HTMLSelectElement).value;
    host.updateSingleDefaultButtonState(fileIndex);
  }

  function onConventionChange() {
    host.updateSingleDefaultButtonState(fileIndex);
  }

  function onLiveUpdateChange(e: Event) {
    const checked = (e.target as HTMLInputElement).checked;
    host.setLiveDepthUpdateEnabled(fileIndex, checked);
    if (checked) {
      host.scheduleLiveDepthUpdate(fileIndex, 0);
    }
  }

  // Delegated commit handling for the whole panel, matching the original
  // depthPanel-level keydown/focusout/change listeners in updateFileList().
  function onPanelKeydown(event: KeyboardEvent) {
    if (event.key !== 'Enter' || !host.isDepthCommitTarget(event.target)) {
      return;
    }
    event.preventDefault();
    (event.target as HTMLElement).blur();
    host.scheduleLiveDepthUpdate(fileIndex, 0);
  }

  function onPanelFocusout(event: FocusEvent) {
    if (host.isDepthCommitTarget(event.target)) {
      host.scheduleLiveDepthUpdate(fileIndex);
    }
  }

  function onPanelChange(event: Event) {
    if (!host.isDepthCommitTarget(event.target)) {
      return;
    }
    host.updateSingleDefaultButtonState(fileIndex);
    host.scheduleLiveDepthUpdate(fileIndex, 0);
  }

  async function applyDepthSettings() {
    await host.applyDepthSettings(fileIndex);
  }
  async function useAsDefaultSettings() {
    await host.useAsDefaultSettings(fileIndex);
  }
  async function resetToDefaultSettings() {
    await host.resetToDefaultSettings(fileIndex);
  }
  function savePlyFile() {
    host.savePlyFile(fileIndex);
  }
  function selectColorImage() {
    host.requestColorImageForDepth(fileIndex);
  }
  async function removeColorImage() {
    await host.removeColorImageFromDepth(fileIndex);
  }
  function resetMonoParams() {
    host.resetMonoParameters(fileIndex);
  }
  function resetDisparityOffset() {
    host.resetDisparityOffset(fileIndex);
  }
  function resetPrinciplePoint() {
    host.resetPrinciplePoint(fileIndex);
  }
</script>

<div class="depth-controls" style="margin-top: 8px;">
  <button
    class="depth-settings-toggle"
    data-file-index={fileIndex}
    style="background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 1px solid var(--vscode-panel-border); padding: 4px 8px; border-radius: 2px; cursor: pointer; font-size: 11px; width: 100%;"
    onclick={toggle}
  >
    <span class="toggle-icon">{open ? '▼' : '▶'}</span> Depth Settings
  </button>
  <!-- The listeners only delegate for events bubbling from the form controls
       inside; the panel itself is not interactive -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="depth-settings-panel"
    id={`depth-panel-${fileIndex}`}
    role="group"
    style="display:{open ? 'block' : 'none'}; margin-top: 8px; padding: 8px; background: var(--vscode-input-background); border: 1px solid var(--vscode-panel-border); border-radius: 2px;"
    onkeydown={onPanelKeydown}
    onfocusout={onPanelFocusout}
    onchange={onPanelChange}
  >
    <div
      style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 1px; margin-bottom: 6px;"
    >
      <div
        id={`image-size-${fileIndex}`}
        style="font-size: 9px; color: var(--vscode-descriptionForeground); min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;"
      >
        {host.getImageSizeDisplay(fileIndex)}
      </div>
      <label
        title="Apply depth settings when a field is committed"
        style="display: inline-flex; align-items: center; gap: 3px; flex: 0 0 auto; font-size: 9px; color: var(--vscode-descriptionForeground); white-space: nowrap; cursor: pointer;"
      >
        <input
          type="checkbox"
          class="live-depth-update"
          data-file-index={fileIndex}
          checked={liveUpdateEnabled}
          style="margin: 0; width: 12px; height: 12px;"
          onchange={onLiveUpdateChange}
        /> Live
      </label>
    </div>

    <CalibrationSection {host} {fileIndex} />

    <div class="depth-group" style="margin-bottom: 8px;">
      <label for={`camera-model-${fileIndex}`} style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;"
        >Camera Model ⭐:</label
      >
      <select
        id={`camera-model-${fileIndex}`}
        style="width: 100%; padding: 2px; font-size: 11px;"
        value={cameraModel}
        onchange={onCameraModelChange}
      >
        <option value="pinhole-ideal">Pinhole Ideal</option>
        <option value="pinhole-opencv">Pinhole + OpenCV Distortion (beta)</option>
        <option value="fisheye-equidistant">Fisheye Equidistant</option>
        <option value="fisheye-opencv">Fisheye + OpenCV Distortion (beta)</option>
        <option value="fisheye-kannala-brandt">Fisheye Kannala-Brandt (beta)</option>
      </select>
    </div>
    <div class="depth-group" style="margin-bottom: 8px;">
      <label for={`depth-type-${fileIndex}`} style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;"
        >Depth Type ⭐:</label
      >
      <select
        id={`depth-type-${fileIndex}`}
        style="width: 100%; padding: 2px; font-size: 11px;"
        value={depthType}
        onchange={onDepthTypeChange}
      >
        <option value="euclidean">Euclidean</option>
        <option value="orthogonal">Orthogonal</option>
        <option value="disparity">Disparity</option>
        <option value="inverse_depth">Inverse Depth</option>
      </select>
    </div>
    <div class="depth-group" style="margin-bottom: 8px;">
      <span style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">Focal Length (px) ⭐:</span>
      <div style="display: flex; gap: 4px;">
        <div style="flex: 1;">
          <label for={`fx-${fileIndex}`} style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">fx:</label>
          <input
            type="number"
            id={`fx-${fileIndex}`}
            value={host.getDepthFx(data)}
            min="1"
            step="0.1"
            style="width: 100%; padding: 2px; font-size: 11px;"
            oninput={onFieldInput}
            onwheel={blurOnWheel}
          />
        </div>
        <div style="flex: 1;">
          <label for={`fy-${fileIndex}`} style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">fy:</label>
          <input
            type="number"
            id={`fy-${fileIndex}`}
            value={host.getDepthFy(data)}
            step="0.1"
            style="width: 100%; padding: 2px; font-size: 11px;"
            placeholder="Same as fx"
            oninput={onFieldInput}
            onwheel={blurOnWheel}
          />
        </div>
      </div>
    </div>
    <div class="depth-group" style="margin-bottom: 8px;">
      <button
        class="depth-section-toggle"
        data-section={`principal-point-${fileIndex}`}
        style="width: 100%; text-align: left; background: transparent; border: none; color: var(--vscode-foreground); cursor: pointer; padding: 2px 0; font-size: 10px; font-weight: bold; display: flex; align-items: center; gap: 4px;"
        onclick={() => (principalPointOpen = !principalPointOpen)}
      >
        <span class="toggle-icon" style="font-size: 8px;">{principalPointOpen ? '▼' : '▶'}</span> Principal Point (px)
      </button>
      <div
        class="depth-section-content"
        id={`principal-point-${fileIndex}`}
        style="display: {principalPointOpen ? 'block' : 'none'}; margin-top: 4px;"
      >
        <div style="display: flex; gap: 4px; align-items: end;">
          <div style="flex: 1;">
            <label for={`cx-${fileIndex}`} style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">cx:</label>
            <input
              type="number"
              id={`cx-${fileIndex}`}
              value={host.getDepthCx(data, fileIndex)}
              step="0.1"
              style="width: 100%; padding: 2px; font-size: 11px;"
              oninput={onFieldInput}
              onwheel={blurOnWheel}
            />
          </div>
          <div style="flex: 1;">
            <label for={`cy-${fileIndex}`} style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">cy:</label>
            <input
              type="number"
              id={`cy-${fileIndex}`}
              value={host.getDepthCy(data, fileIndex)}
              step="0.1"
              style="width: 100%; padding: 2px; font-size: 11px;"
              oninput={onFieldInput}
              onwheel={blurOnWheel}
            />
          </div>
          <div style="flex: 0 0 auto;">
            <button
              class="reset-principle-point"
              data-file-index={fileIndex}
              style="padding: 2px 6px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 9px; height: 24px;"
              title="Reset to auto-calculated center"
              onclick={resetPrinciplePoint}>↺</button
            >
          </div>
        </div>
        <div style="font-size: 9px; color: var(--vscode-descriptionForeground); margin-top: 1px;">
          Auto-calculated as (width-1)/2 and (height-1)/2
        </div>
      </div>
    </div>
    <div
      class="depth-group"
      id={`distortion-params-${fileIndex}`}
      style="margin-bottom: 8px; display: {showDistortionGroup ? '' : 'none'};"
    >
      <button
        class="depth-section-toggle"
        data-section={`distortion-content-${fileIndex}`}
        style="width: 100%; text-align: left; background: transparent; border: none; color: var(--vscode-foreground); cursor: pointer; padding: 2px 0; font-size: 10px; font-weight: bold; display: flex; align-items: center; gap: 4px;"
        onclick={() => (distortionOpen = !distortionOpen)}
      >
        <span class="toggle-icon" style="font-size: 8px;">{distortionOpen ? '▼' : '▶'}</span> Distortion Parameters (beta)
      </button>
      <div
        class="depth-section-content"
        id={`distortion-content-${fileIndex}`}
        style="display: {distortionOpen ? 'block' : 'none'}; margin-top: 4px;"
      >
        <div id={`pinhole-params-${fileIndex}`} style="display: {isPinholeOpencv ? '' : 'none'};">
          <div style="display: flex; gap: 4px; margin-bottom: 4px;">
            {#each ['k1', 'k2', 'k3'] as p (p)}
              <div style="flex: 1;">
                <label for={`${p}-${fileIndex}`} style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">{p}:</label>
                <input type="number" id={`${p}-${fileIndex}`} value="0" step="0.001" style="width: 100%; padding: 2px; font-size: 11px;" placeholder="0" oninput={onFieldInput} onwheel={blurOnWheel} />
              </div>
            {/each}
          </div>
          <div style="display: flex; gap: 4px; margin-bottom: 4px;">
            {#each ['p1', 'p2'] as p (p)}
              <div style="flex: 1;">
                <label for={`${p}-${fileIndex}`} style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">{p}:</label>
                <input type="number" id={`${p}-${fileIndex}`} value="0" step="0.001" style="width: 100%; padding: 2px; font-size: 11px;" placeholder="0" oninput={onFieldInput} onwheel={blurOnWheel} />
              </div>
            {/each}
            <div style="flex: 1;"></div>
          </div>
          <div style="font-size: 9px; color: var(--vscode-descriptionForeground);">k1,k2,k3: radial; p1,p2: tangential</div>
        </div>

        <div id={`fisheye-opencv-params-${fileIndex}`} style="display: {isFisheyeOpencv ? '' : 'none'};">
          <div style="display: flex; gap: 4px; margin-bottom: 4px;">
            {#each ['k1', 'k2', 'k3', 'k4'] as p (p)}
              <div style="flex: 1;">
                <label for={`${p}-${fileIndex}`} style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">{p}:</label>
                <input type="number" id={`${p}-${fileIndex}`} value="0" step="0.001" style="width: 100%; padding: 2px; font-size: 11px;" placeholder="0" oninput={onFieldInput} onwheel={blurOnWheel} />
              </div>
            {/each}
          </div>
          <div style="font-size: 9px; color: var(--vscode-descriptionForeground);">Fisheye radial distortion coefficients</div>
        </div>

        <div id={`kannala-brandt-params-${fileIndex}`} style="display: {isKannalaBrandt ? '' : 'none'};">
          <div style="display: flex; gap: 4px; margin-bottom: 4px;">
            {#each ['k1', 'k2', 'k3'] as p (p)}
              <div style="flex: 1;">
                <label for={`${p}-${fileIndex}`} style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">{p}:</label>
                <input type="number" id={`${p}-${fileIndex}`} value="0" step="0.001" style="width: 100%; padding: 2px; font-size: 11px;" placeholder="0" oninput={onFieldInput} onwheel={blurOnWheel} />
              </div>
            {/each}
          </div>
          <div style="display: flex; gap: 4px; margin-bottom: 4px;">
            {#each ['k4', 'k5'] as p (p)}
              <div style="flex: 1;">
                <label for={`${p}-${fileIndex}`} style="display: block; font-size: 9px; margin-bottom: 1px; color: var(--vscode-descriptionForeground);">{p}:</label>
                <input type="number" id={`${p}-${fileIndex}`} value="0" step="0.001" style="width: 100%; padding: 2px; font-size: 11px;" placeholder="0" oninput={onFieldInput} onwheel={blurOnWheel} />
              </div>
            {/each}
            <div style="flex: 1;"></div>
          </div>
          <div style="font-size: 9px; color: var(--vscode-descriptionForeground);">Polynomial fisheye coefficients</div>
        </div>
      </div>
    </div>
    <div class="depth-group" id={`baseline-group-${fileIndex}`} style="margin-bottom: 8px; {isDisparity ? '' : 'display:none;'}">
      <label for={`baseline-${fileIndex}`} style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">Baseline (mm) ⭐:</label>
      <input
        type="number"
        id={`baseline-${fileIndex}`}
        value={host.getDepthBaseline(data)}
        min="0.1"
        step="0.1"
        style="width: 100%; padding: 2px; font-size: 11px;"
        oninput={onFieldInput}
        onwheel={blurOnWheel}
      />
    </div>
    <div class="depth-group" id={`disparity-offset-group-${fileIndex}`} style="margin-bottom: 8px; {isDisparity ? '' : 'display:none;'}">
      <button
        class="depth-section-toggle"
        data-section={`disparity-offset-content-${fileIndex}`}
        style="width: 100%; text-align: left; background: transparent; border: none; color: var(--vscode-foreground); cursor: pointer; padding: 2px 0; font-size: 10px; font-weight: bold; display: flex; align-items: center; gap: 4px;"
        onclick={() => (disparityOffsetOpen = !disparityOffsetOpen)}
      >
        <span class="toggle-icon" style="font-size: 8px;">{disparityOffsetOpen ? '▼' : '▶'}</span> Disparity Offset
      </button>
      <div
        class="depth-section-content"
        id={`disparity-offset-content-${fileIndex}`}
        style="display: {disparityOffsetOpen ? 'block' : 'none'}; margin-top: 4px;"
      >
        <div style="display: flex; gap: 4px; align-items: center;">
          <input
            type="number"
            id={`disparity-offset-${fileIndex}`}
            value="0"
            step="0.1"
            style="flex: 1; padding: 2px; font-size: 11px;"
            placeholder="Offset added to disparity values"
            oninput={onFieldInput}
            onwheel={blurOnWheel}
          />
          <button
            class="reset-disparity-offset"
            data-file-index={fileIndex}
            style="padding: 2px 6px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 9px; height: 24px; flex: 0 0 auto;"
            title="Reset to 0"
            onclick={resetDisparityOffset}>↺</button
          >
        </div>
      </div>
    </div>
    <div class="depth-group" style="margin-bottom: 8px;">
      <button
        class="depth-section-toggle"
        data-section={`mono-params-${fileIndex}`}
        style="width: 100%; text-align: left; background: transparent; border: none; color: var(--vscode-foreground); cursor: pointer; padding: 2px 0; font-size: 10px; font-weight: bold; display: flex; align-items: center; gap: 4px;"
        onclick={() => (monoParamsOpen = !monoParamsOpen)}
      >
        <span class="toggle-icon" style="font-size: 8px;">{monoParamsOpen ? '▼' : '▶'}</span> Depth from Mono Parameters ⭐
      </button>
      <div
        class="depth-section-content"
        id={`mono-params-${fileIndex}`}
        style="display: {monoParamsOpen ? 'block' : 'none'}; margin-top: 4px;"
      >
        <div style="display: flex; gap: 6px; align-items: end;">
          <div style="flex: 1;">
            <label for={`depth-scale-${fileIndex}`} style="display: block; font-size: 9px; font-weight: bold; margin-bottom: 2px;">Scale:</label>
            <input type="number" id={`depth-scale-${fileIndex}`} value="1.0" step="0.1" style="width: 100%; padding: 2px; font-size: 11px;" placeholder="Scale factor" oninput={onFieldInput} onwheel={blurOnWheel} />
          </div>
          <div style="flex: 1;">
            <label for={`depth-bias-${fileIndex}`} style="display: block; font-size: 9px; font-weight: bold; margin-bottom: 2px;">Bias:</label>
            <input type="number" id={`depth-bias-${fileIndex}`} value="0.0" step="0.1" style="width: 100%; padding: 2px; font-size: 11px;" placeholder="Bias offset" oninput={onFieldInput} onwheel={blurOnWheel} />
          </div>
          <div style="flex: 0 0 auto;">
            <button
              class="reset-mono-params"
              data-file-index={fileIndex}
              style="padding: 2px 6px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 9px; height: 24px;"
              title="Reset to Scale=1.0, Bias=0.0"
              onclick={resetMonoParams}>↺</button
            >
          </div>
        </div>
      </div>
    </div>
    {#if isPngDerivedFile(data)}
      <div class="depth-group" style="margin-bottom: 8px;">
        <label for={`png-scale-factor-${fileIndex}`} style="display: block; font-size: 10px; font-weight: bold; margin-bottom: 2px;">Scale Factor ⭐:</label>
        <input
          type="number"
          id={`png-scale-factor-${fileIndex}`}
          value={host.getPngScaleFactor(data)}
          min="0.1"
          step="0.1"
          style="width: 100%; padding: 2px; font-size: 11px;"
          placeholder="1000 for mm, 256 for disparity"
          oninput={onFieldInput}
          onwheel={blurOnWheel}
        />
        <div style="font-size: 9px; color: var(--vscode-descriptionForeground); margin-top: 1px;">
          The depth/disparity is divided to get the applied value in meters/disparities
        </div>
      </div>
    {/if}
    <div class="depth-group" style="margin-bottom: 8px;">
      <button
        class="depth-section-toggle"
        data-section={`rgb24-params-${fileIndex}`}
        style="width: 100%; text-align: left; background: transparent; border: none; color: var(--vscode-foreground); cursor: pointer; padding: 2px 0; font-size: 10px; font-weight: bold; display: flex; align-items: center; gap: 4px;"
        onclick={() => (rgb24Open = !rgb24Open)}
      >
        <span class="toggle-icon" style="font-size: 8px;">{rgb24Open ? '▼' : '▶'}</span> RGB to 24bit Conversion Mode
      </button>
      <div
        class="depth-section-content"
        id={`rgb24-params-${fileIndex}`}
        style="display: {rgb24Open ? 'block' : 'none'}; margin-top: 4px;"
      >
        <label for={`rgb24-conversion-mode-${fileIndex}`} style="display: block; font-size: 9px; font-weight: bold; margin-bottom: 2px;">Conversion Mode:</label>
        <select id={`rgb24-conversion-mode-${fileIndex}`} style="width: 100%; padding: 2px; font-size: 11px;" value={host.getRgb24ConversionMode(data)} onchange={onFieldInput}>
          <option value="shift">RGB as 24-bit</option>
          <option value="multiply">Shift 255</option>
          <option value="red">Red Channel Only</option>
          <option value="green">Green Channel Only</option>
          <option value="blue">Blue Channel Only</option>
        </select>
        <div style="font-size: 9px; color: var(--vscode-descriptionForeground); margin-top: 1px;">How to extract depth from RGB channels (only used if image is RGB)</div>

        <label for={`rgb24-scale-factor-${fileIndex}`} style="display: block; font-size: 9px; font-weight: bold; margin-bottom: 2px; margin-top: 8px;">RGB24 Scale Factor:</label>
        <input type="number" id={`rgb24-scale-factor-${fileIndex}`} value={host.getRgb24ScaleFactor(data)} style="width: 100%; padding: 2px; font-size: 11px;" step="1" min="1" oninput={onFieldInput} />
        <div style="font-size: 9px; color: var(--vscode-descriptionForeground); margin-top: 1px;">Divider for 24 bit image (e.g., 1000, so max value is 16777.215)</div>
      </div>
    </div>
    <div class="depth-group" style="margin-bottom: 8px;">
      <button
        class="depth-section-toggle"
        data-section={`coordinate-convention-${fileIndex}`}
        style="width: 100%; text-align: left; background: transparent; border: none; color: var(--vscode-foreground); cursor: pointer; padding: 2px 0; font-size: 10px; font-weight: bold; display: flex; align-items: center; gap: 4px;"
        onclick={() => (conventionOpen = !conventionOpen)}
      >
        <span class="toggle-icon" style="font-size: 8px;">{conventionOpen ? '▼' : '▶'}</span> Coordinate Convention ⭐
      </button>
      <div
        class="depth-section-content"
        id={`coordinate-convention-${fileIndex}`}
        style="display: {conventionOpen ? 'block' : 'none'}; margin-top: 4px;"
      >
        <select id={`convention-${fileIndex}`} style="width: 100%; padding: 2px; font-size: 11px;" value={host.getDepthConvention(data)} onchange={onConventionChange}>
          <option value="opengl">OpenGL (Y-up, Z-backward)</option>
          <option value="opencv">OpenCV (Y-down, Z-forward)</option>
        </select>
      </div>
    </div>
    <div class="depth-group" style="margin-bottom: 8px;">
      <button
        class="depth-section-toggle"
        data-section={`color-image-${fileIndex}`}
        style="width: 100%; text-align: left; background: transparent; border: none; color: var(--vscode-foreground); cursor: pointer; padding: 2px 0; font-size: 10px; font-weight: bold; display: flex; align-items: center; gap: 4px;"
        onclick={() => (colorImageOpen = !colorImageOpen)}
      >
        <span class="toggle-icon" style="font-size: 8px;">{colorImageOpen ? '▼' : '▶'}</span> Color Image (optional)
      </button>
      <div
        class="depth-section-content"
        id={`color-image-${fileIndex}`}
        style="display: {colorImageOpen ? 'block' : 'none'}; margin-top: 4px;"
      >
        <button
          class="select-color-image"
          data-file-index={fileIndex}
          style="width: 100%; padding: 4px 8px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 11px; text-align: left;"
          onclick={selectColorImage}
          >📁 Select Color Image...</button
        >
        {#if host.getStoredColorImageName(fileIndex)}
          <div style="font-size: 9px; color: var(--vscode-textLink-foreground); margin-top: 2px; display: flex; align-items: center; gap: 4px;">
            📷 Current: {host.getStoredColorImageName(fileIndex)}
            <button
              class="remove-color-image"
              data-file-index={fileIndex}
              style="font-size: 8px; padding: 1px 4px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer;"
              onclick={removeColorImage}>✕</button
            >
          </div>
        {/if}
      </div>
    </div>
    <div class="depth-group" style="margin-bottom: 8px;">
      <div style="display: flex; gap: 4px;">
        <button
          class="apply-depth-settings"
          data-file-index={fileIndex}
          style="flex: 1; padding: 4px 8px; background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 11px; {liveUpdateEnabled ? 'display:none;' : ''}"
          onclick={applyDepthSettings}>Apply Settings</button
        >
        <button
          class="save-ply-file"
          data-file-index={fileIndex}
          style="flex: 1; padding: 4px 8px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 11px;"
          onclick={savePlyFile}>💾 Save as PLY</button
        >
      </div>
      <div style="display: flex; gap: 4px; margin-top: 4px;">
        <button
          class="use-as-default-settings"
          data-file-index={fileIndex}
          style="flex: 1; padding: 4px 8px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 11px;"
          onclick={useAsDefaultSettings}>⭐ Use as Default</button
        >
        <button
          class="reset-to-default-settings"
          data-file-index={fileIndex}
          style="flex: 1; padding: 4px 8px; background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); border: 1px solid var(--vscode-panel-border); border-radius: 2px; cursor: pointer; font-size: 11px;"
          onclick={resetToDefaultSettings}>⭐ Reset to Default</button
        >
      </div>
    </div>
  </div>
</div>
