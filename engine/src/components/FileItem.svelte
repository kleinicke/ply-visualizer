<script lang="ts">
  import { filesState } from '../state/files.svelte';
  import { getExtraScalarFieldNames } from '../utils/scalarFields';
  import DepthSettingsPanel from './DepthSettingsPanel.svelte';
  import TransformSection from './TransformSection.svelte';

  let {
    host,
    index,
    kind,
  }: { host: any; index: number; kind: 'pointcloud' | 'pose' | 'camera' } = $props();

  const data = $derived(kind === 'pointcloud' ? host.spatialFiles[index] : null);
  const poseIndex = $derived(index - host.spatialFiles.length);
  const meta = $derived(kind === 'pose' ? host.poseMeta[poseIndex] : null);
  const cameraIndex = $derived(index - host.spatialFiles.length - host.poseGroups.length);
  const cameraGroup = $derived(kind === 'camera' ? host.cameraGroups[cameraIndex] : null);
  const cameraProfileName = $derived(kind === 'camera' ? host.cameraNames[cameraIndex] : '');

  const visible = $derived(filesState.visibility[index] ?? true);
  const collapsed = $derived(filesState.collapsed[index] ?? false);
  const colorMode = $derived(filesState.colorModes[index] ?? 'assigned');

  const isDepthDerivedFile = $derived(
    kind === 'pointcloud' &&
      data &&
      (host.isDepthDerivedFile(data) || (data as any).isDepthDerived)
  );

  const scalarFieldNames = $derived(
    kind === 'pointcloud' && data ? getExtraScalarFieldNames(data) : []
  );

  function colorIndicatorStyle(): string {
    if (kind === 'pointcloud' && colorMode === 'original' && data?.hasColors) {
      return 'background: linear-gradient(45deg, #ff0000, #00ff00, #0000ff); border: 1px solid #666;';
    }
    if (kind === 'pointcloud' && colorMode?.startsWith('intensity') && host.hasIntensityData(data)) {
      return 'background: linear-gradient(90deg, #111, #fff); border: 1px solid #666;';
    }
    if (kind === 'pointcloud' && colorMode?.startsWith('scalar:')) {
      if (colorMode.endsWith(':grayscale')) {
        return 'background: linear-gradient(90deg, #111, #fff); border: 1px solid #666;';
      }
      // Viridis-ish ramp for scalar-field modes.
      return 'background: linear-gradient(90deg, #440154, #31688e, #35b779, #fde725); border: 1px solid #666;';
    }
    const color = host.fileColors[index % host.fileColors.length];
    const colorHex = `#${Math.round(color[0] * 255)
      .toString(16)
      .padStart(2, '0')}${Math.round(color[1] * 255)
      .toString(16)
      .padStart(2, '0')}${Math.round(color[2] * 255)
      .toString(16)
      .padStart(2, '0')}`;
    return `background-color: ${colorHex}`;
  }

  function toggleCollapse() {
    const newCollapsed = !collapsed;
    host.fileItemsCollapsed[index] = newCollapsed;
    filesState.collapsed[index] = newCollapsed;
  }

  function onVisibilityClick(e: MouseEvent) {
    if (e.shiftKey) {
      e.preventDefault();
      host.soloPointCloud(index);
    }
  }

  function onVisibilityChange() {
    host.toggleFileVisibility(index);
  }

  function onRemove() {
    host.requestRemoveFile(index);
  }

  function onColorModeChange(e: Event) {
    const value = (e.target as HTMLSelectElement).value;
    host.onFileColorModeChange(index, value);
  }

  // Render-mode button availability, matching the original updateFileList() logic.
  const hasFaces = $derived(kind === 'pointcloud' && data?.faceCount > 0);
  const hasLines = $derived(
    kind === 'pointcloud' && (data as any)?.objData && (data as any).objData.lineCount > 0
  );
  const hasGeometry = $derived(hasFaces || hasLines);
  const hasNormalsData = $derived(kind === 'pointcloud' && (data?.hasNormals || hasFaces));
  const isPtsFile = $derived(kind === 'pointcloud' && data?.fileName?.toLowerCase().endsWith('.pts'));
  const shouldShowNormals = $derived(
    hasNormalsData && (!isPtsFile || (data?.vertices.length > 0 && data.vertices[0]?.nx !== undefined))
  );
  const renderModeButtons = $derived(
    (() => {
      if (kind === 'pointcloud' && data) {
        // Kept for parity with the pre-Phase-3 updateFileList(), which
        // Playwright specs assert on (faceCount/hasFaces/hasGeometry signal
        // that parsing + render-mode computation completed for this file).
        console.log(
          `File ${index}: ${data.fileName}, faceCount=${data.faceCount}, lineCount=${(data as any).objData?.lineCount || 0}, hasNormals=${data.hasNormals}, hasFaces=${hasFaces}, hasLines=${hasLines}, hasGeometry=${hasGeometry}`
        );
      }
      const buttons: Array<{ mode: string; label: string; cls: string }> = [
        { mode: 'points', label: '👁️ Points', cls: 'points-btn' },
      ];
      if (kind === 'pointcloud' && data && host.splatMode?.canEnable(data)) {
        buttons.push({ mode: 'splat', label: '✨ Splats', cls: 'splat-btn' });
      }
      if (hasGeometry) {
        buttons.push({ mode: 'mesh', label: '🔷 Mesh', cls: 'mesh-btn' });
        buttons.push({ mode: 'wireframe', label: '📐 Wireframe', cls: 'wireframe-btn' });
      }
      if (shouldShowNormals) {
        buttons.push({ mode: 'normals', label: '📏 Normals', cls: 'normals-btn' });
      }
      return buttons;
    })()
  );
  const renderModeGridColumns = $derived(
    { 1: '1fr', 2: '1fr 1fr', 3: '1fr 1fr 1fr', 4: '1fr 1fr 1fr 1fr' }[renderModeButtons.length] ||
      '1fr'
  );

  function onRenderModeClick(mode: string) {
    host.toggleUniversalRenderMode(index, mode);
  }

  const pointSize = $derived(
    kind === 'pose'
      ? (filesState.pointSizes[index] ?? 0.02)
      : kind === 'camera'
        ? (filesState.pointSizes[index] ?? 1.0)
        : filesState.pointSizes[index] || 0.001
  );
  const sizePrecision = $derived(kind === 'pose' ? 3 : kind === 'camera' ? 1 : 4);

  function onSizeSliderInput(e: Event) {
    const newSize = parseFloat((e.target as HTMLInputElement).value);
    host.updatePointSize(index, newSize);
    host.requestRender();
  }

  function onSizeInputCommit(e: Event) {
    const input = e.target as HTMLInputElement;
    const newSize = parseFloat(input.value);
    if (!isNaN(newSize) && newSize > 0) {
      host.updatePointSize(index, newSize);
      host.requestRender();
      input.value = newSize.toFixed(sizePrecision);
    } else {
      const currentSize = host.pointSizes[index] || 0.001;
      input.value = currentSize.toFixed(sizePrecision);
    }
  }

  function onSizeInputKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      onSizeInputCommit(e);
      (e.target as HTMLInputElement).blur();
    }
  }

  function onSizeInputFocus(e: Event) {
    (e.target as HTMLInputElement).select();
  }

  const isObjFile = $derived(kind === 'pointcloud' && (data as any)?.isObjFile);
  const isObjWireframeOrFile = $derived(
    kind === 'pointcloud' && ((data as any)?.isObjWireframe || (data as any)?.isObjFile)
  );

  function onLoadMtl() {
    host.requestLoadMtl(index);
  }

  function onPoseDatasetColorsChange(e: Event) {
    host.poseUseDatasetColors[poseIndex] = (e.target as HTMLInputElement).checked;
    host.updatePoseAppearance(poseIndex);
  }
  function onPoseShowLabelsChange(e: Event) {
    host.poseShowLabels[poseIndex] = (e.target as HTMLInputElement).checked;
    host.updatePoseLabels(poseIndex);
  }
  function onPoseScaleScoreChange(e: Event) {
    host.poseScaleByScore[poseIndex] = (e.target as HTMLInputElement).checked;
    host.updatePoseScaling(poseIndex);
  }
  function onPoseScaleUncertaintyChange(e: Event) {
    host.poseScaleByUncertainty[poseIndex] = (e.target as HTMLInputElement).checked;
    host.updatePoseScaling(poseIndex);
  }
  function onPoseConventionChange(e: Event) {
    const val = (e.target as HTMLSelectElement).value === 'opencv' ? 'opencv' : 'opengl';
    host.applyPoseConvention(poseIndex, val);
  }
  function onPoseMinScoreInput(e: Event) {
    const v = Math.max(0, Math.min(1, parseFloat((e.target as HTMLInputElement).value)));
    host.poseMinScoreThreshold[poseIndex] = v;
    host.applyPoseFilters(poseIndex);
  }
  function onPoseMaxUncInput(e: Event) {
    const v = Math.max(0, Math.min(1, parseFloat((e.target as HTMLInputElement).value)));
    host.poseMaxUncertaintyThreshold[poseIndex] = v;
    host.applyPoseFilters(poseIndex);
  }

  function onCameraShowLabelsChange(e: Event) {
    host.toggleCameraProfileLabels(cameraIndex, (e.target as HTMLInputElement).checked);
  }
  function onCameraShowCoordsChange(e: Event) {
    host.toggleCameraProfileCoordinates(cameraIndex, (e.target as HTMLInputElement).checked);
  }

  const matrixText = $derived(
    (() => {
      const arr = host.getTransformationMatrixAsArray(index);
      let str = '';
      for (let r = 0; r < 4; ++r) {
        str += arr
          .slice(r * 4, r * 4 + 4)
          .map((v: number) => v.toFixed(6))
          .join(' ');
        str += '\n';
      }
      return str;
    })()
  );

  const name = $derived(
    kind === 'pointcloud'
      ? data?.fileName || `File ${index + 1}`
      : kind === 'pose'
        ? meta?.fileName || `Pose ${poseIndex + 1}`
        : `📷 ${cameraProfileName}`
  );
  const shortPath = $derived(
    kind === 'pointcloud'
      ? data?.shortPath || data?.fileName || ''
      : kind === 'pose'
        ? (meta as any)?.shortPath || meta?.fileName || ''
        : cameraProfileName
  );
  const removeTitle = $derived(
    kind === 'pointcloud' ? 'Remove file' : kind === 'pose' ? 'Remove object' : 'Remove camera profile'
  );
</script>

<div class="file-item">
  <div class="file-item-main">
    <button
      class="collapse-toggle"
      data-file-index={index}
      title={collapsed ? 'Expand' : 'Collapse'}
      onclick={(e: MouseEvent) => {
        e.stopPropagation();
        toggleCollapse();
      }}
    >
      <span class="collapse-icon">{collapsed ? '▶' : '▼'}</span>
    </button>
    <input
      type="checkbox"
      id={`file-${index}`}
      checked={visible}
      onclick={onVisibilityClick}
      onchange={onVisibilityChange}
    />
    <span class="color-indicator" style={colorIndicatorStyle()}></span>
    <label for={`file-${index}`} class="file-name" data-short-path={shortPath}>{name}</label>
    <button class="remove-file" data-file-index={index} title={removeTitle} onclick={onRemove}
      >✕</button
    >
  </div>
  <div class="file-item-content" id={`file-content-${index}`} style="display: {collapsed ? 'none' : 'block'}">
    {#if kind === 'pointcloud' && data}
      <div class="file-info">{data.vertexCount.toLocaleString()} vertices, {data.faceCount.toLocaleString()} faces{data.isGaussianSplat ? ' · 3DGS' : ''}</div>

      {#if isDepthDerivedFile}
        <DepthSettingsPanel {host} fileIndex={index} {data} />
      {/if}

      <TransformSection {host} fileIndex={index} {matrixText} />

      <div class="rendering-controls" style="margin-top: 4px; margin-bottom: 6px;">
        <div style="display: grid; grid-template-columns: {renderModeGridColumns}; gap: 3px;">
          {#each renderModeButtons as btn (btn.mode)}
            <button
              class={`render-mode-btn ${btn.cls}`}
              data-file-index={index}
              data-mode={btn.mode}
              style="padding: 3px 6px; border: 1px solid var(--vscode-panel-border); border-radius: 2px; font-size: 9px; cursor: pointer;"
              onclick={() => onRenderModeClick(btn.mode)}>{btn.label}</button
            >
          {/each}
        </div>
      </div>

      <div class="point-size-control" style="margin-top: 4px;">
        <label for={`size-${index}`} style="font-size: 11px;">Point Size:</label>
        <input
          type="range"
          id={`size-${index}`}
          min="0.0001"
          max="0.1"
          step="0.0001"
          value={pointSize}
          class="size-slider"
          style="width: 100%;"
          oninput={onSizeSliderInput}
        />
        <input
          type="text"
          id={`size-input-${index}`}
          class="size-input"
          value={pointSize.toFixed(4)}
          style="font-size: 10px; width: 30px; border: none; background: transparent; color: var(--vscode-foreground); text-align: left; padding: 0; margin: 0; outline: none; cursor: text;"
          onblur={onSizeInputCommit}
          onkeydown={onSizeInputKeydown}
          onfocus={onSizeInputFocus}
        />
      </div>

      {#if isObjWireframeOrFile}
        <div class="obj-controls" style="margin-top: 8px;">
          <button
            class="load-mtl-btn"
            data-file-index={index}
            style="background: var(--vscode-button-background); color: var(--vscode-button-foreground); border: 1px solid var(--vscode-panel-border); padding: 4px 8px; border-radius: 2px; cursor: pointer; font-size: 11px; width: 100%; margin-bottom: 4px;"
            onclick={onLoadMtl}
          >
            🎨 Load MTL Material
          </button>
          {#if host.appliedMtlNames[index]}
            <div class="mtl-status" style="font-size: 9px; color: var(--vscode-textLink-foreground); margin-bottom: 4px; text-align: center;">
              📄 {host.appliedMtlNames[index]} applied
            </div>
          {/if}
        </div>
      {/if}

      <div class="color-control">
        <label for={`color-${index}`}>Color:</label>
        <select id={`color-${index}`} class="color-selector" value={colorMode} onchange={onColorModeChange}>
          {#if data.hasColors}
            <option value="original">Original</option>
          {/if}
          {#if host.hasIntensityData(data)}
            <option value="intensity">Intensity</option>
            <option value="intensity-viridis">Intensity (Viridis)</option>
            <option value="intensity-colors">Intensity (Colors)</option>
          {/if}
          {#each scalarFieldNames as fieldName (fieldName)}
            <option value={`scalar:${fieldName}:viridis`}>{fieldName} (Viridis)</option>
            <option value={`scalar:${fieldName}:grayscale`}>{fieldName} (Gray)</option>
          {/each}
          <option value="assigned">Assigned ({host.getColorName(index)})</option>
          {@html host.getColorOptions(index)}
        </select>
      </div>
    {:else if kind === 'pose' && meta}
      <div class="file-info">
        {meta.jointCount} joints, {meta.edgeCount} edges{meta.invalidJoints
          ? `, ${meta.invalidJoints} invalid`
          : ''}
      </div>
      <div class="panel-section" style="margin-top:6px;">
        <div class="control-buttons">
          <label style="font-size:10px;display:flex;align-items:center;gap:6px;">
            <input
              type="checkbox"
              id={`pose-dataset-colors-${index}`}
              checked={host.poseUseDatasetColors[poseIndex]}
              onchange={onPoseDatasetColorsChange}
            />
            Use dataset colors
          </label>
          <label style="font-size:10px;display:flex;align-items:center;gap:6px;">
            <input
              type="checkbox"
              id={`pose-show-labels-${index}`}
              checked={host.poseShowLabels[poseIndex]}
              onchange={onPoseShowLabelsChange}
            />
            Show labels
          </label>
          <label style="font-size:10px;display:flex;align-items:center;gap:6px;">
            <input
              type="checkbox"
              id={`pose-scale-score-${index}`}
              checked={host.poseScaleByScore[poseIndex]}
              onchange={onPoseScaleScoreChange}
            />
            Scale by score
          </label>
          <label style="font-size:10px;display:flex;align-items:center;gap:6px;">
            <input
              type="checkbox"
              id={`pose-scale-uncertainty-${index}`}
              checked={host.poseScaleByUncertainty[poseIndex]}
              onchange={onPoseScaleUncertaintyChange}
            />
            Scale by uncertainty
          </label>
          <div style="display:flex;gap:6px;align-items:center;">
            <span style="font-size:10px;">Pose Convention:</span>
            <select id={`pose-conv-${index}`} style="font-size:10px;" value={host.poseConvention[poseIndex]} onchange={onPoseConventionChange}>
              <option value="opengl">OpenGL</option>
              <option value="opencv">OpenCV</option>
            </select>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <span style="font-size:10px;">Min score:</span>
            <input
              type="range"
              id={`pose-minscore-${index}`}
              min="0"
              max="1"
              step="0.01"
              value={(host.poseMinScoreThreshold[poseIndex] ?? 0).toFixed(2)}
              style="flex:1;"
              oninput={onPoseMinScoreInput}
            />
            <span id={`pose-minscore-val-${index}`} style="font-size:10px;">{(host.poseMinScoreThreshold[poseIndex] ?? 0).toFixed(2)}</span>
          </div>
          <div style="display:flex;gap:6px;align-items:center;">
            <span style="font-size:10px;">Max uncertainty:</span>
            <input
              type="range"
              id={`pose-maxunc-${index}`}
              min="0"
              max="1"
              step="0.01"
              value={(host.poseMaxUncertaintyThreshold[poseIndex] ?? 1).toFixed(2)}
              style="flex:1;"
              oninput={onPoseMaxUncInput}
            />
            <span id={`pose-maxunc-val-${index}`} style="font-size:10px;">{(host.poseMaxUncertaintyThreshold[poseIndex] ?? 1).toFixed(2)}</span>
          </div>
        </div>
      </div>
      <TransformSection {host} fileIndex={index} {matrixText} />
      <div class="point-size-control">
        <label for={`size-${index}`}>Joint Radius (m):</label>
        <input type="range" id={`size-${index}`} min="0.001" max="0.1" step="0.001" value={pointSize} class="size-slider" oninput={onSizeSliderInput} />
        <input
          type="text"
          id={`size-input-${index}`}
          class="size-input"
          value={pointSize.toFixed(3)}
          style="font-size: 10px; width: 30px; border: none; background: transparent; color: var(--vscode-foreground); text-align: left; padding: 0; margin: 0; outline: none; cursor: text;"
          onblur={onSizeInputCommit}
          onkeydown={onSizeInputKeydown}
          onfocus={onSizeInputFocus}
        />
      </div>
      <div class="color-control">
        <label for={`color-${index}`}>Color:</label>
        <select id={`color-${index}`} class="color-selector" value={colorMode} onchange={onColorModeChange}>
          <option value="assigned">Assigned (Red)</option>
          {@html host.getColorOptions(index)}
        </select>
      </div>
    {:else if kind === 'camera' && cameraGroup}
      <div class="file-info">{cameraGroup.children.length} cameras</div>
      <div class="panel-section" style="margin-top:6px;">
        <div class="control-buttons">
          <label style="font-size:10px;display:flex;align-items:center;gap:6px;">
            <input
              type="checkbox"
              id={`camera-show-labels-${index}`}
              checked={host.cameraShowLabels[cameraIndex]}
              onchange={onCameraShowLabelsChange}
            />
            Show labels
          </label>
          <label style="font-size:10px;display:flex;align-items:center;gap:6px;">
            <input
              type="checkbox"
              id={`camera-show-coords-${index}`}
              checked={host.cameraShowCoords[cameraIndex]}
              onchange={onCameraShowCoordsChange}
            />
            Show coordinates
          </label>
        </div>
      </div>
      <div class="size-control">
        <label for={`size-${index}`}>Scale:</label>
        <input type="range" id={`size-${index}`} min="0.1" max="5.0" step="0.1" value={pointSize} oninput={onSizeSliderInput} />
        <input
          type="text"
          id={`size-input-${index}`}
          class="size-input"
          value={pointSize.toFixed(1)}
          style="font-size: 10px; width: 20px; border: none; background: transparent; color: var(--vscode-foreground); text-align: left; padding: 0; margin: 0; outline: none; cursor: text;"
          onblur={onSizeInputCommit}
          onkeydown={onSizeInputKeydown}
          onfocus={onSizeInputFocus}
        />
      </div>
      <TransformSection {host} fileIndex={index} {matrixText} matrixOnly variant="transformation" />
    {/if}
  </div>
</div>
