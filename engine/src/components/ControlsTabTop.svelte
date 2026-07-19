<script lang="ts">
  import { viewerState } from '../state/viewer.svelte';
  import { measurementState } from '../state/measurement.svelte';
  import { formatDistance } from '../MeasurementManager';

  let { host }: { host: any } = $props();

  // Intentional: seed local UI state from the host once at mount; the change
  // handlers below keep it in sync afterwards
  // svelte-ignore state_referenced_locally
  let axesVisible = $state(host.axesPermanentlyVisible);
  // svelte-ignore state_referenced_locally
  let camerasVisible = $state(host.cameraVisibility);
  // svelte-ignore state_referenced_locally
  let gammaEnabled = $state(!host.convertSrgbToLinear);
  // svelte-ignore state_referenced_locally
  let rotationCenterMode = $state(host.rotationCenterManager.getMode());

  function onBrightnessInput(e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value);
    host.brightnessStops = Number.isFinite(val) ? val : 0;
    viewerState.brightnessStops = host.brightnessStops;
    host.applySceneBrightness();
    host.requestRender();
  }

  function resetBrightness(e: MouseEvent) {
    e.preventDefault();
    host.brightnessStops = 0;
    viewerState.brightnessStops = 0;
    host.applySceneBrightness();
    host.requestRender();
  }

  function onBackgroundInput(e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value);
    host.backgroundBrightness = Number.isFinite(val) ? val : 13;
    viewerState.backgroundBrightness = host.backgroundBrightness;
    host.applyBackgroundBrightness();
    host.requestRender();
  }

  function resetBackground(e: MouseEvent) {
    e.preventDefault();
    host.backgroundBrightness = 13;
    viewerState.backgroundBrightness = 13;
    host.applyBackgroundBrightness();
    host.requestRender();
  }

  function backgroundLabel(value: number): string {
    const channel = Math.max(0, Math.min(255, Math.round((value / 100) * 255)));
    const hex = channel.toString(16).padStart(2, '0');
    return `${Math.round(value)}% (#${hex}${hex}${hex})`;
  }

  function onToggleEdl() {
    host.toggleEDL();
  }

  function onEdlSecondRingInput(e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value);
    host.edlSecondRingWeight = Number.isFinite(val) ? val : 0.0;
    const value = document.getElementById('edl-second-ring-value');
    if (value) value.textContent = host.edlSecondRingWeight.toFixed(2);
    if (host.edlPass) {
      host.edlPass.secondRingWeight = host.edlSecondRingWeight;
    }
    host.showStatus(
      host.edlSecondRingWeight > 0
        ? `Advanced EDL neighborhood: ON (${host.edlSecondRingWeight.toFixed(2)})`
        : 'Advanced EDL neighborhood: OFF'
    );
    host.requestRender();
  }

  function resetEdlSecondRing(e: MouseEvent) {
    e.preventDefault();
    (e.currentTarget as HTMLInputElement).value = '0';
    onEdlSecondRingInput(e);
  }

  function onEdlStrengthInput(e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value);
    host.edlStrength = val;
    viewerState.edlStrength = val;
    if (host.edlPass) {
      host.edlPass.edlStrength = val;
    }
    host.requestRender();
  }

  function onEdlRadiusInput(e: Event) {
    const val = parseFloat((e.target as HTMLInputElement).value);
    host.edlRadius = val;
    viewerState.edlRadius = val;
    if (host.edlPass) {
      host.edlPass.edlRadius = val;
    }
    host.requestRender();
  }

  function resetEdlStrength(e: MouseEvent) {
    e.preventDefault();
    const input = e.currentTarget as HTMLInputElement;
    input.value = '1';
    onEdlStrengthInput(e);
  }

  function resetEdlRadius(e: MouseEvent) {
    e.preventDefault();
    const input = e.currentTarget as HTMLInputElement;
    input.value = '1.4';
    onEdlRadiusInput(e);
  }

  function onFitCamera() {
    if (!host.sequenceMode) {
      host.fitCameraToAllObjects();
    }
  }
  function onResetCamera() {
    if (!host.sequenceMode) {
      host.resetCameraToDefault();
    }
  }
  function onToggleAxes() {
    host.toggleAxesVisibility();
    host.updateAxesButtonState();
    axesVisible = host.axesPermanentlyVisible;
  }
  function onToggleCameras() {
    host.toggleCameraVisibility();
    host.updateCameraButtonState();
    camerasVisible = host.cameraVisibility;
  }
  function onSetRotationOrigin() {
    host.setRotationCenterToOrigin();
    host.updateRotationOriginButtonState();
  }

  function onUndoPathPoint() {
    if (host.measurementManager) {
      host.measurementManager.undoLastPathPoint();
      host.requestRender();
    }
  }
  function onClearPath() {
    if (host.measurementManager) {
      host.measurementManager.clearPath();
      host.requestRender();
      host.showStatus('Measurement path cleared');
    }
  }
  function onTogglePathClosed() {
    if (host.measurementManager) {
      host.measurementManager.togglePathClosed();
      host.requestRender();
    }
  }
  function onNewPath() {
    if (host.measurementManager) {
      host.measurementManager.togglePathStartMode('free');
      host.requestRender();
      host.showStatus(
        measurementState.pathStartMode === 'free'
          ? 'New free path armed for the next Shift + Double-click'
          : 'New free path cancelled; continuing the current path'
      );
    }
  }
  function onNewPathFromCenter() {
    if (host.measurementManager) {
      host.measurementManager.togglePathStartMode('center');
      host.requestRender();
      host.showStatus(
        measurementState.pathStartMode === 'center'
          ? 'Path from center armed for the next Shift + Double-click'
          : 'Path from center cancelled; continuing the current path'
      );
    }
  }
  function onClearAllPaths() {
    if (host.measurementManager) {
      host.measurementManager.clearAllPaths();
      host.requestRender();
      host.showStatus('All measurement paths cleared');
    }
  }

  function onOpenCVConvention() {
    host.setOpenCVCameraConvention();
    if (host.vscode) {
      host.vscode.postMessage({ type: 'saveCameraConvention', convention: 'opencv' });
    }
  }
  function onOpenGLConvention() {
    host.setOpenGLCameraConvention();
    if (host.vscode) {
      host.vscode.postMessage({ type: 'saveCameraConvention', convention: 'opengl' });
    }
  }

  function onTrackball() {
    host.switchToTrackballControls();
  }
  function onOrbit() {
    host.switchToOrbitControls();
  }
  function onLegacyTrackball() {
    host.switchToLegacyTrackballControls();
  }
  function onArcball() {
    host.switchToArcballControls();
  }

  function setRotationCenterMode(mode: 'move-camera' | 'keep-camera' | 'keep-distance') {
    host.rotationCenterManager.setMode(mode);
    host.updateRotationCenterModeButtons();
    rotationCenterMode = mode;
    const messages = {
      'move-camera': 'Rotation center: Camera moves laterally',
      'keep-camera': 'Rotation center: Camera stays in place',
      'keep-distance': 'Rotation center: Camera keeps distance',
    };
    host.showStatus(messages[mode]);
  }

  function onToggleGammaCorrection() {
    host.toggleGammaCorrection();
    host.updateGammaButtonState();
    gammaEnabled = !host.convertSrgbToLinear;
  }

  function onToggleUnlitPly() {
    host.lightingMode = 'unlit';
    viewerState.lightingMode = 'unlit';
    host.useUnlitPly = true;
    host.useFlatLighting = false;
    host.rebuildAllPlyMaterials();
    host.initSceneLighting();
    host.updateLightingButtonsState();
    host.showStatus('Using unlit PLY (uniform)');
  }
  function onUseNormalLighting() {
    host.lightingMode = 'normal';
    viewerState.lightingMode = 'normal';
    host.useFlatLighting = false;
    host.useUnlitPly = false;
    host.rebuildAllPlyMaterials();
    host.initSceneLighting();
    host.updateLightingButtonsState();
    host.showStatus('Using normal lighting');
  }
  function onUseFlatLighting() {
    host.lightingMode = 'flat';
    viewerState.lightingMode = 'flat';
    host.useFlatLighting = true;
    host.useUnlitPly = false;
    host.rebuildAllPlyMaterials();
    host.initSceneLighting();
    host.updateLightingButtonsState();
    host.showStatus('Using flat lighting');
  }
</script>

<div class="panel-section">
  <h4>Brightness &amp; Background</h4>
  <div>
    <div class="control-group" style="margin-bottom: 8px;">
      <label for="brightness-slider" style="font-size: 11px;">Brightness:</label>
      <input
        id="brightness-slider"
        type="range"
        min="-2.0"
        max="2.0"
        step="0.1"
        value={viewerState.brightnessStops}
        class="control-input"
        style="flex: 1; margin: 0 8px;"
        oninput={onBrightnessInput}
        ondblclick={resetBrightness}
        title="Double-click to reset"
      />
      <span id="brightness-value" style="font-size: 11px; min-width: 32px; text-align: right;"
        >{viewerState.brightnessStops.toFixed(1)}</span
      >
    </div>
    <div class="control-group" style="margin-bottom: 8px;">
      <label for="background-brightness-slider" style="font-size: 11px;">Background:</label>
      <input
        id="background-brightness-slider"
        type="range"
        min="0"
        max="100"
        step="1"
        value={viewerState.backgroundBrightness}
        class="control-input"
        style="flex: 1; margin: 0 8px;"
        oninput={onBackgroundInput}
        ondblclick={resetBackground}
        title="Double-click to reset"
      />
      <span
        id="background-brightness-value"
        style="font-size: 11px; min-width: 88px; text-align: right;"
        >{backgroundLabel(viewerState.backgroundBrightness)}</span
      >
    </div>
    <p class="setting-description" style="margin-top: 0;">
      Brightness adjusts the rendered geometry. Background adjusts only the neutral backdrop.
      Double-click a slider to reset it.
    </p>
  </div>
  <div
    style="margin-top: 12px; padding-top: 8px; border-top: 1px solid var(--vscode-panel-border, rgba(255,255,255,0.1));"
  >
    <div class="control-buttons">
      <button
        id="toggle-edl"
        class="control-button"
        class:active={viewerState.edlEnabled}
        onclick={onToggleEdl}
      >
        Eye Dome Lighting <span class="button-shortcut">E</span>
      </button>
    </div>
    <p class="setting-description">
      Eye Dome Lighting enhances depth perception by darkening edges and silhouettes. Works with
      all geometry types and combines with any lighting mode.
    </p>
    <div id="edl-settings" style="display: {viewerState.edlEnabled ? 'block' : 'none'}; margin-top: 8px;">
      <div id="edl-advanced-settings" style="margin-bottom: 6px;">
        <div class="control-group" style="margin-bottom: 6px;">
          <label for="edl-second-ring-slider" style="font-size: 11px;">Second Ring:</label>
          <input
            id="edl-second-ring-slider"
            type="range"
            min="0.0"
            max="0.6"
            step="0.05"
            value={host.edlSecondRingWeight}
            class="control-input"
            style="flex: 1; margin: 0 8px;"
            oninput={onEdlSecondRingInput}
            ondblclick={resetEdlSecondRing}
            title="Double-click to reset"
          />
          <span id="edl-second-ring-value" style="font-size: 11px; min-width: 28px; text-align: right;"
            >{host.edlSecondRingWeight.toFixed(2)}</span
          >
        </div>
        <p class="setting-description" style="margin-top: 0;">
          Controls how much the wider neighborhood contributes (0.00 = off).
        </p>
      </div>
      <div class="control-group" style="margin-bottom: 6px;">
        <label for="edl-strength-slider" style="font-size: 11px;">Strength:</label>
        <input
          id="edl-strength-slider"
          type="range"
          min="0.1"
          max="5.0"
          step="0.1"
          value={viewerState.edlStrength}
          class="control-input"
          style="flex: 1; margin: 0 8px;"
          oninput={onEdlStrengthInput}
          ondblclick={resetEdlStrength}
          title="Double-click to reset"
        />
        <span id="edl-strength-value" style="font-size: 11px; min-width: 28px; text-align: right;"
          >{viewerState.edlStrength.toFixed(1)}</span
        >
      </div>
      <div class="control-group">
        <label for="edl-radius-slider" style="font-size: 11px;">Radius:</label>
        <input
          id="edl-radius-slider"
          type="range"
          min="0.5"
          max="5.0"
          step="0.1"
          value={viewerState.edlRadius}
          class="control-input"
          style="flex: 1; margin: 0 8px;"
          oninput={onEdlRadiusInput}
          ondblclick={resetEdlRadius}
          title="Double-click to reset"
        />
        <span id="edl-radius-value" style="font-size: 11px; min-width: 28px; text-align: right;"
          >{viewerState.edlRadius.toFixed(1)}</span
        >
      </div>
    </div>
  </div>
</div>
<div class="panel-section">
  <h4>View Controls</h4>
  <div class="control-buttons">
    <button id="fit-camera" class="control-button" onclick={onFitCamera}>
      Fit to View <span class="button-shortcut">F</span>
    </button>
    <button id="reset-camera" class="control-button" onclick={onResetCamera}>
      Reset Camera <span class="button-shortcut">R</span>
    </button>
    <button id="toggle-axes" class="control-button" class:active={axesVisible} onclick={onToggleAxes}>
      Toggle Axes <span class="button-shortcut">A</span>
    </button>
    <button
      id="toggle-cameras"
      class="control-button"
      class:active={camerasVisible}
      onclick={onToggleCameras}>Show Cameras</button
    >
    <button id="set-rotation-origin" class="control-button" onclick={onSetRotationOrigin}>
      Set Rotation Center to Origin <span class="button-shortcut">W</span>
    </button>
  </div>
</div>
<div class="panel-section">
  <h4 style="display: flex; align-items: baseline; justify-content: space-between; gap: 8px;">
    <span>Measurements</span>
    <span style="font-size: 9px; font-weight: normal; color: var(--vscode-descriptionForeground);">
      Shift + Double-click
    </span>
  </h4>
  <div class="control-buttons">
    <button
      id="new-measurement-path"
      class="control-button"
      class:active={measurementState.pathStartMode === 'free'}
      aria-pressed={measurementState.pathStartMode === 'free'}
      onclick={onNewPath}
    >
      New Free Path
    </button>
    <button
      id="new-measurement-path-from-center"
      class="control-button"
      class:active={measurementState.pathStartMode === 'center'}
      aria-pressed={measurementState.pathStartMode === 'center'}
      onclick={onNewPathFromCenter}
      title="Use the current rotation center as point A on the next measurement pick"
    >
      New Path from Center
    </button>
    {#if measurementState.pathPointCount > 0}
      <button id="undo-path-point" class="control-button" onclick={onUndoPathPoint}>
        Undo Last Point
      </button>
      <button id="clear-measurement-path" class="control-button" onclick={onClearPath}>
        Clear Path
      </button>
    {/if}
    <button
      id="close-measurement-path"
      class="control-button"
      class:active={measurementState.pathClosed}
      onclick={onTogglePathClosed}
      title="Keep the active path connected from its last point back to its first"
    >
      {measurementState.pathClosed ? 'Open Loop' : 'Close Loop'}
    </button>
    {#if measurementState.pathCount > 0}
      <button id="clear-all-measurement-paths" class="control-button" onclick={onClearAllPaths}>
        Clear All Paths
      </button>
    {/if}
  </div>
  {#if measurementState.pathPointCount > 0}
    <div id="measurement-path-info" style="font-size: 11px; margin-top: 8px; font-family: monospace;">
      {#if measurementState.segmentLengths.length > 0}
        {#each measurementState.segmentLengths as length, i}
          <div>Segment {i + 1}: {formatDistance(length)}</div>
        {/each}
        <div style="margin-top: 4px; font-weight: bold;">
          Total: {formatDistance(measurementState.totalLength)}
        </div>
      {:else}
        <div>1 point picked — double-click the next point.</div>
      {/if}
    </div>
  {/if}
  <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 8px">
    Shift + Double-click adds points. By default the first path starts at the rotation center;
    use New Free Path when the first picked point should be point A.
  </div>
</div>
<div class="panel-section">
  <h4>Camera Conventions</h4>
  <div class="control-buttons camera-conventions">
    <button
      id="opencv-convention"
      class="control-button"
      class:active={viewerState.cameraConvention === 'opencv'}
      onclick={onOpenCVConvention}
    >
      OpenCV (Y down) <span class="button-shortcut">C</span>
    </button>
    <button
      id="opengl-convention"
      class="control-button"
      class:active={viewerState.cameraConvention === 'opengl'}
      onclick={onOpenGLConvention}
    >
      OpenGL (Y up) <span class="button-shortcut">B</span>
    </button>
  </div>
</div>
<div class="panel-section">
  <h4>Control Type</h4>
  <div class="control-buttons">
    <button
      id="trackball-controls"
      class="control-button"
      class:active={viewerState.controlScheme === 'trackball'}
      onclick={onTrackball}
      title="Virtual ball: center drags orbit; drags near the edge and circular gestures roll the scene under the cursor"
    >
      Trackball <span class="button-shortcut">T</span>
    </button>
    <button
      id="orbit-controls"
      class="control-button"
      class:active={viewerState.controlScheme === 'orbit'}
      onclick={onOrbit}
    >
      Orbit <span class="button-shortcut">O</span>
    </button>
    <button
      id="legacy-trackball-controls"
      class="control-button"
      class:active={viewerState.controlScheme === 'legacy-trackball'}
      onclick={onLegacyTrackball}
      title="The previous default: delta-based three.js TrackballControls with momentum"
    >
      Legacy Trackball <span class="button-shortcut">I</span>
    </button>
    <button
      id="arcball-controls"
      class="control-button"
      class:active={viewerState.controlScheme === 'arcball'}
      onclick={onArcball}
    >
      Arcball <span class="button-shortcut">K</span>
    </button>
  </div>
</div>
<div class="panel-section">
  <h4>Rotation Center Behavior</h4>
  <p class="setting-description">When double-clicking to set rotation center:</p>
  <div class="control-buttons">
    <button
      id="rotation-center-move-camera"
      class="control-button"
      class:active={rotationCenterMode === 'move-camera'}
      onclick={() => setRotationCenterMode('move-camera')}
    >
      Move Camera (Lateral)
    </button>
    <button
      id="rotation-center-keep-camera"
      class="control-button"
      class:active={rotationCenterMode === 'keep-camera'}
      onclick={() => setRotationCenterMode('keep-camera')}
    >
      Keep Camera Position
    </button>
    <button
      id="rotation-center-keep-distance"
      class="control-button"
      class:active={rotationCenterMode === 'keep-distance'}
      onclick={() => setRotationCenterMode('keep-distance')}
    >
      Keep Distance
    </button>
  </div>
  <p class="setting-description">
    Move Camera: Camera slides on view plane to center clicked point. Keep Camera: Only rotation
    target changes, camera stays in place. Keep Distance: Camera moves to maintain same distance
    from new center.
  </p>
</div>
<div class="panel-section">
  <h4>Color &amp; Lighting</h4>
  <div class="control-buttons">
    <button
      id="toggle-gamma-correction"
      class="control-button"
      class:active={gammaEnabled}
      onclick={onToggleGammaCorrection}
    >
      Toggle Gamma Correction <span class="button-shortcut">G</span>
    </button>
  </div>
  <p class="setting-description">
    Gamma affects original vertex colors. Unlit PLY ignores scene lights. Choose Normal or Flat
    lighting for scene illumination.
  </p>
  <div class="control-buttons">
    <button
      id="toggle-unlit-ply"
      class="control-button"
      class:active={viewerState.lightingMode === 'unlit'}
      onclick={onToggleUnlitPly}>Use Unlit PLY (Uniform)</button
    >
    <button
      id="use-normal-lighting"
      class="control-button"
      class:active={viewerState.lightingMode === 'normal'}
      onclick={onUseNormalLighting}>Use Normal Lighting</button
    >
    <button
      id="use-flat-lighting"
      class="control-button"
      class:active={viewerState.lightingMode === 'flat'}
      onclick={onUseFlatLighting}>Use Flat Lighting</button
    >
  </div>
  <p class="setting-description">Shading options are only effecting PLY files with faces.</p>
</div>
