<script lang="ts">
  import * as THREE from 'three';
  import { createRotationMatrix, parseMatrixInput } from '../utils/matrix';

  let {
    host,
    fileIndex,
    matrixText,
    matrixOnly = false,
    variant = 'transform',
  }: {
    host: any;
    fileIndex: number;
    matrixText: string;
    matrixOnly?: boolean;
    variant?: 'transform' | 'transformation';
  } = $props();

  let open = $state(false);

  function toggle() {
    open = !open;
  }

  function applyMatrix() {
    const textarea = document.getElementById(`matrix-${fileIndex}`) as HTMLTextAreaElement | null;
    if (!textarea) {
      return;
    }
    const values = parseMatrixInput(textarea.value);
    if (values && values.length === 16) {
      const mat = new THREE.Matrix4();
      mat.set(...(values as [number, number, number, number, number, number, number, number, number, number, number, number, number, number, number, number]));
      host.setTransformationMatrix(fileIndex, mat);
      host.updateMatrixTextarea(fileIndex);
    } else {
      alert('Please enter 16 valid numbers for the 4x4 matrix.');
    }
  }

  function invertMatrix() {
    const currentMatrix = host.getTransformationMatrix(fileIndex);
    try {
      const invertedMatrix = currentMatrix.clone().invert();
      host.setTransformationMatrix(fileIndex, invertedMatrix);
      host.updateMatrixTextarea(fileIndex);
    } catch (_error) {
      alert('Matrix is not invertible (determinant is zero).');
    }
  }

  function resetMatrix() {
    host.resetTransformationMatrix(fileIndex);
    const textarea = document.getElementById(`matrix-${fileIndex}`) as HTMLTextAreaElement | null;
    if (textarea) {
      textarea.value =
        '1.000000 0.000000 0.000000 0.000000\n0.000000 1.000000 0.000000 0.000000\n0.000000 0.000000 1.000000 0.000000\n0.000000 0.000000 0.000000 1.000000';
    }
  }

  function rotate(axis: 'x' | 'y' | 'z') {
    const rotationMatrix = createRotationMatrix(axis, Math.PI / 2);
    host.multiplyTransformationMatrices(fileIndex, rotationMatrix);
    host.updateMatrixTextarea(fileIndex);
  }
</script>

{#if variant === 'transformation'}
  <div class="transformation-panel" style="margin-top:8px;">
    <div class="panel-header" style="display:flex;align-items:center;margin-bottom:4px;">
      <button
        class="toggle-panel transformation-toggle"
        data-file-index={fileIndex}
        style="background:none;border:none;color:var(--vscode-foreground);cursor:pointer;display:flex;align-items:center;gap:4px;padding:2px;font-size:10px;"
        onclick={toggle}
      >
        <span class="toggle-icon">{open ? '▼' : '▶'}</span> Transform Matrix
      </button>
    </div>
    <div
      id={`transformation-panel-${fileIndex}`}
      class="transformation-content"
      style="display:{open
        ? 'block'
        : 'none'};background:var(--vscode-editor-background);border:1px solid var(--vscode-panel-border);border-radius:4px;padding:8px;margin-top:4px;"
    >
      <div class="transform-group">
        <label for={`matrix-${fileIndex}`} style="font-size:10px;font-weight:bold;">Matrix (4x4):</label>
        <textarea
          id={`matrix-${fileIndex}`}
          rows="4"
          cols="50"
          style="width:100%;font-size:9px;font-family:monospace;"
          placeholder={'1.000000 0.000000 0.000000 0.000000\n0.000000 1.000000 0.000000 0.000000\n0.000000 0.000000 1.000000 0.000000\n0.000000 0.000000 0.000000 1.000000'}
          >{matrixText.trim()}</textarea
        >
        <div class="transform-buttons" style="margin-top:4px;">
          <button class="apply-matrix" data-file-index={fileIndex} onclick={applyMatrix}
            >Apply Matrix</button
          >
          <button class="invert-matrix" data-file-index={fileIndex} onclick={invertMatrix}
            >Invert</button
          >
          <button class="reset-matrix" data-file-index={fileIndex} onclick={resetMatrix}
            >Reset</button
          >
        </div>
      </div>
    </div>
  </div>
{:else}
  <div class="transform-section">
    <button class="transform-toggle" data-file-index={fileIndex} onclick={toggle}>
      <span class="toggle-icon">{open ? '▼' : '▶'}</span> Transform
    </button>
    <div id={`transform-panel-${fileIndex}`} class="transform-panel" style="display:{open ? 'block' : 'none'};">
      {#if !matrixOnly}
        <div class="transform-group">
          <span class="transform-group-label" style="font-size:10px;font-weight:bold;">Transformations:</span>
          <div class="transform-buttons">
            <button
              class="add-translation"
              data-file-index={fileIndex}
              onclick={() => host.showTranslationDialog(fileIndex)}>Add Translation</button
            >
            <button
              class="add-quaternion"
              data-file-index={fileIndex}
              onclick={() => host.showQuaternionDialog(fileIndex)}>Add Quaternion</button
            >
            <button
              class="add-angle-axis"
              data-file-index={fileIndex}
              onclick={() => host.showAngleAxisDialog(fileIndex)}>Add Angle-Axis</button
            >
          </div>
        </div>

        <div class="transform-group">
          <span class="transform-group-label" style="font-size:10px;font-weight:bold;">Rotation (90°):</span>
          <div class="transform-buttons">
            <button class="rotate-x" data-file-index={fileIndex} onclick={() => rotate('x')}
              >X</button
            >
            <button class="rotate-y" data-file-index={fileIndex} onclick={() => rotate('y')}
              >Y</button
            >
            <button class="rotate-z" data-file-index={fileIndex} onclick={() => rotate('z')}
              >Z</button
            >
          </div>
        </div>
      {/if}

      <div class="transform-group">
        <label for={`matrix-${fileIndex}`} style="font-size:10px;font-weight:bold;">Matrix (4x4):</label>
        <textarea
          id={`matrix-${fileIndex}`}
          rows="4"
          cols="50"
          style="width:100%;font-size:9px;font-family:monospace;"
          placeholder={'1.000000 0.000000 0.000000 0.000000\n0.000000 1.000000 0.000000 0.000000\n0.000000 0.000000 1.000000 0.000000\n0.000000 0.000000 0.000000 1.000000'}
          >{matrixText.trim()}</textarea
        >
        <div class="transform-buttons" style="margin-top:4px;">
          <button class="apply-matrix" data-file-index={fileIndex} onclick={applyMatrix}
            >Apply Matrix</button
          >
          <button class="invert-matrix" data-file-index={fileIndex} onclick={invertMatrix}
            >Invert</button
          >
          <button class="reset-matrix" data-file-index={fileIndex} onclick={resetMatrix}
            >Reset</button
          >
        </div>
      </div>
    </div>
  </div>
{/if}
