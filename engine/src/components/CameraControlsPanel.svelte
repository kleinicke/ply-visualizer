<script lang="ts">
  import { viewerState } from '../state/viewer.svelte';

  let { host }: { host: any } = $props();

  function onFovSliderInput(e: Event) {
    const newFov = parseFloat((e.target as HTMLInputElement).value);
    host.camera.fov = newFov;
    host.camera.updateProjectionMatrix();
    viewerState.cameraFov = newFov;
    host.requestRender();
  }

  function onFovInputCommit(e: Event) {
    const input = e.target as HTMLInputElement;
    const newFov = parseFloat(input.value);
    if (!isNaN(newFov) && newFov > 0) {
      host.camera.fov = newFov;
      host.camera.updateProjectionMatrix();
      viewerState.cameraFov = newFov;
      host.requestRender();
    } else {
      input.value = host.camera.fov.toFixed(2);
    }
  }

  function onFovInputKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      onFovInputCommit(e);
      (e.target as HTMLInputElement).blur();
    }
  }

  function onFovInputFocus(e: Event) {
    (e.target as HTMLInputElement).select();
  }

  function onResetCamera() {
    host.resetCameraToDefault();
  }
  function onModifyPosition() {
    host.showCameraPositionDialog();
  }
  function onModifyRotation() {
    host.showCameraRotationDialog();
  }
  function onModifyRotationCenter() {
    host.showRotationCenterDialog();
  }
</script>

<div class="camera-controls-section">
  <label for="camera-fov" style="font-size:10px;">Field of View:</label><br />
  <input
    type="range"
    id="camera-fov"
    min="10"
    max="150"
    step="1"
    value={viewerState.cameraFov}
    style="width:100%;margin:2px 0;"
    oninput={onFovSliderInput}
  />
  <input
    type="text"
    id="fov-input"
    value={viewerState.cameraFov.toFixed(2)}
    style="font-size: 10px; width: 30px; border: none; background: transparent; color: var(--vscode-foreground); text-align: left; padding: 0; margin: 0; outline: none; cursor: text;"
    onblur={onFovInputCommit}
    onkeydown={onFovInputKeydown}
    onfocus={onFovInputFocus}
  /><span style="font-size:10px;">°</span>
</div>

<div class="camera-controls-section">
  <span style="font-size:10px;font-weight:bold;">Camera Position &amp; Rotation:</span>
  <div class="matrix-display">
    <div style="font-size:10px;margin:4px 0;">
      <div><strong>Position:</strong> {viewerState.cameraPositionText}</div>
      <div><strong>Rotation:</strong> {viewerState.cameraRotationText}</div>
      <div><strong>Rotation Center:</strong> {viewerState.cameraTargetText}</div>
    </div>
  </div>
  <div style="display:flex;gap:4px;margin-top:4px;">
    <button
      id="modify-camera-position"
      class="control-button"
      style="flex:1;font-size:9px;"
      onclick={onModifyPosition}>Modify Position</button
    >
  </div>
  <div style="display:flex;gap:4px;margin-top:4px;">
    <button
      id="modify-camera-rotation"
      class="control-button"
      style="flex:1;font-size:9px;"
      onclick={onModifyRotation}>Modify Rotation</button
    >
  </div>
  <div style="display:flex;gap:4px;margin-top:4px;">
    <button
      id="modify-rotation-center"
      class="control-button"
      style="flex:1;font-size:9px;"
      onclick={onModifyRotationCenter}>Modify Rotation Center</button
    >
  </div>
  <button id="reset-camera-matrix" class="control-button" style="margin-top:12px;" onclick={onResetCamera}
    >Reset Camera</button
  >
</div>
