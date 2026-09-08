// Compiled inside the image engine's closure, in the desktop artifact only.
// No DOM scraping or legacy inspector commands: expose operations and snapshots.
let desktopUrl = '';
let desktopError = '';
let desktopPixel = '';
let desktopFrameCount = 1;
let desktopFrameIndex = 0;
let desktopIsolation: { id: string; visibility: Map<string, boolean> } | null = null;
const desktopOriginalPost = originalVscode.postMessage.bind(originalVscode);
originalVscode.postMessage = (message: any) => {
  if (message.type === 'pixelFocus') {
    desktopPixel = String(message.value || '');
  }
  if (message.type === 'pixelBlur') {
    desktopPixel = '';
  }
  if (message.type === 'registerDicomFrames') {
    desktopFrameCount = Number(message.frames) || 1;
  }
  if (message.type === 'show-error' || message.type === 'error') {
    desktopError = String(message.message || message.value || 'Image decoding failed');
  }
  if (message.type === 'formatInfo' && message.value?.isInitialLoad) {
    const generation = _loadGeneration;
    setTimeout(async () => {
      const deadline = performance.now() + 60000;
      while (!canvas && generation === _loadGeneration && performance.now() < deadline) {
        await new Promise(r => setTimeout(r, 10));
      }
      if (generation === _loadGeneration && canvas) {
        await handleVSCodeMessage({
          type: 'updateSettings',
          settings: settingsManager.settings,
          isInitialRender: true,
        });
      }
    }, 0);
  }
  desktopOriginalPost(message);
};
function desktopNavigation() {
  if (currentLoadFormat === 'DICOM' && desktopFrameCount > 1) {
    return [
      {
        key: 'frame',
        label: 'Frame',
        size: desktopFrameCount,
        value: desktopFrameIndex,
        go: (value: number) => {
          desktopFrameIndex = value;
          switchToNewImage(settingsManager.settings.src!, settingsManager.settings.resourceUri!, {
            frameIndex: value,
          });
        },
      },
    ];
  }
  if (currentLoadFormat === 'TIFF') {
    return tiffControls();
  }
  const processor = allProcessors.find((p: any) => p.config?.formatLabel === currentLoadFormat);
  const metadata = (processor as any)?._lastRaw?.metadata;
  return metadata?.selectors ? planeControlsFromSelectors(metadata) : [];
}
function desktopFit() {
  zoomController.updateScale('fit');
  if (!canvas || !imageElement) {
    return;
  }
  const fit = Math.min((innerWidth - 32) / canvas.width, (innerHeight - 32) / canvas.height);
  imageElement.style.width = `${canvas.width * fit}px`;
  imageElement.style.height = `${canvas.height * fit}px`;
}
window.addEventListener('resize', () => {
  if (zoomController.getCurrentState().scale === 'fit') {
    desktopFit();
  }
});
(window as any).desktopImage = {
  fit: desktopFit,
  async open(file: File) {
    desktopError = '';
    desktopIsolation = null;
    desktopFrameCount = 1;
    desktopFrameIndex = 0;
    desktopPixel = '';
    if (desktopUrl) {
      URL.revokeObjectURL(desktopUrl);
    }
    desktopUrl = URL.createObjectURL(file);
    await handleVSCodeMessage({ type: 'clearImage' });
    await handleVSCodeMessage({
      type: 'switchToImage',
      uri: desktopUrl,
      resourceUri: file.name,
      zoomState: { scale: 'fit', x: 0, y: 0 },
    });
    const generation = _loadGeneration;
    const start = performance.now();
    while (
      !hasLoadedImage ||
      !imageElement?.isConnected ||
      !container.classList.contains('ready')
    ) {
      if (_loadGeneration !== generation) {
        throw new Error('Image open superseded');
      }
      if (desktopError || container.classList.contains('error')) {
        throw new Error(desktopError || 'Image decoding failed');
      }
      if (performance.now() - start > 60000) {
        throw new Error('Image decoding timed out');
      }
      await new Promise(resolve => setTimeout(resolve, 20));
    }
    desktopFit();
  },
  snapshot() {
    return {
      ready: hasLoadedImage && !!imageElement?.isConnected && container.classList.contains('ready'),
      pixel: desktopPixel,
      format: currentFormatInfo,
      settings: structuredClone(settingsManager.settings),
      axes: desktopNavigation().map(({ go, ...axis }: any) => axis),
      layers: layerManager.layers.map(({ data, rasterMask, ...layer }: any) => layer),
      size: canvas
        ? `${canvas.width} × ${canvas.height}`
        : imageElement
          ? `${imageElement.naturalWidth} × ${imageElement.naturalHeight}`
          : '',
      zoom: zoomController.getCurrentState().scale,
      error: desktopError,
      channels: channelPlanes.map((plane: any, i: number) => ({
        index: i,
        name: plane.name || `Channel ${i + 1}`,
        enabled: channelSolo === null ? channelSettings[i]?.visible !== false : channelSolo === i,
      })),
    };
  },
  capture() {
    return {
      layers: layerManager.layers.map((l: any) => ({
        name: l.name,
        visible: l.visible,
        opacity: l.opacity,
        blendMode: l.blendMode,
      })),
      channels: channelSettings.map((c: any) => c.visible),
      composite: compositeEnabled,
    };
  },
  restore(saved: any) {
    if (saved.layers?.length) {
      for (const layer of [...layerManager.layers]) {
        const props = saved.layers.find((p: any) => p.name === layer.name);
        if (props) {
          layerManager.updateLayer(layer.id, props);
        } else {
          layerManager.removeLayer(layer.id);
        }
      }
      recompositeLayers();
    }
    if (saved.composite) {
      rebuildChannelPlanes();
      saved.channels?.forEach((visible: boolean, index: number) => {
        if (channelSettings[index]) {
          channelSettings[index].visible = visible;
        }
      });
      compositeEnabled = true;
      scheduleCompositeRender();
    }
  },
  channels() {
    rebuildChannelPlanes();
  },
  sample(x: number, y: number) {
    const source = getMeasurementSource();
    if (!source?.data || x < 0 || y < 0 || x >= source.width || y >= source.height) {
      return [];
    }
    return Array.from(
      source.data.slice(
        (y * source.width + x) * source.channels,
        (y * source.width + x + 1) * source.channels
      )
    );
  },
  histogram() {
    const raw = getMeasurementSource();
    if (!raw?.data) {
      return [];
    }
    const values: number[] = [];
    const stride = Math.max(1, Math.ceil(raw.data.length / 16384));
    for (let i = 0; i < raw.data.length; i += stride) {
      const v = Number(raw.data[i]);
      if (Number.isFinite(v)) {
        values.push(v);
      }
    }
    if (!values.length) {
      return [];
    }
    const min = Math.min(...values),
      max = Math.max(...values);
    const bins = Array(64).fill(0);
    for (const v of values) {
      bins[Math.min(63, Math.floor(((v - min) / (max - min || 1)) * 64))]++;
    }
    return bins;
  },
  channel(index: number, enabled: boolean, isolate = false) {
    rebuildChannelPlanes();
    if (channelSettings[index]) {
      if (isolate) {
        channelSolo = channelSolo === index ? null : index;
      } else {
        channelSolo = null;
        channelSettings[index].visible = enabled;
      }
      compositeEnabled = true;
      scheduleCompositeRender();
    }
  },
  async settings(patch: any) {
    const allowed = [
      'normalization',
      'gamma',
      'brightness',
      'nanColor',
      'showScaleBar',
      'gpuAcceleration',
      'displayColormap',
      'normalizedFloatMode',
    ];
    const changes = Object.fromEntries(
      Object.entries(patch).filter(([key]) => allowed.includes(key))
    );
    const next = { ...settingsManager.settings, ...changes };
    if (
      next.normalization &&
      (!Number.isFinite(next.normalization.min) ||
        !Number.isFinite(next.normalization.max) ||
        next.normalization.min >= next.normalization.max)
    ) {
      throw new Error('Display minimum must be smaller than maximum.');
    }
    await handleVSCodeMessage({ type: 'updateSettings', settings: next });
  },
  command(type: string, args: any = {}) {
    return handleVSCodeMessage({ type, ...args });
  },
  axis(key: string, value: number) {
    desktopNavigation()
      .find((axis: any) => axis.key === key)
      ?.go(value);
  },
  async addLayer(file: File) {
    if (layerManager.isEmpty()) {
      syncBaseLayer();
    }
    layerManager.active = true;
    const url = URL.createObjectURL(file);
    try {
      const layer = await decodeLayer(url, file.name);
      if (!layer) {
        throw new Error('Cannot decode image layer');
      }
      layerManager.addLayer(layer);
    } finally {
      URL.revokeObjectURL(url);
    }
    recompositeLayers();
  },
  layerVisibility(id: string, isolate = false) {
    if (!isolate) {
      const layer = layerManager.layers.find((l: any) => l.id === id);
      if (layer) {
        layerManager.updateLayer(id, { visible: !layer.visible });
      }
      desktopIsolation = null;
    } else if (desktopIsolation?.id === id) {
      for (const layer of layerManager.layers) {
        layerManager.updateLayer(layer.id, {
          visible: desktopIsolation.visibility.get(layer.id) !== false,
        });
      }
      desktopIsolation = null;
    } else {
      desktopIsolation = {
        id,
        visibility: new Map(layerManager.layers.map((l: any) => [l.id, l.visible !== false])),
      };
      for (const layer of layerManager.layers) {
        layerManager.updateLayer(layer.id, { visible: layer.id === id });
      }
    }
    recompositeLayers();
  },
  layer(id: string, props: any) {
    layerManager.updateLayer(id, props);
    recompositeLayers();
  },
  removeLayer(id: string) {
    layerManager.removeLayer(id);
    recompositeLayers();
  },
  exploreLayers() {
    if (!installLayeredDocumentLayers()) {
      throw new Error('Editable layer pixels are not available for this document');
    }
    layerManager.active = true;
    recompositeLayers();
  },
  undo() {
    if (layerManager.undo()) {
      recompositeLayers();
    }
  },
  redo() {
    if (layerManager.redo()) {
      recompositeLayers();
    }
  },
  async exportPng() {
    const source = canvas;
    if (source) {
      return new Promise<Blob>((resolve, reject) =>
        source.toBlob(
          blob => (blob ? resolve(blob) : reject(new Error('Export failed'))),
          'image/png'
        )
      );
    }
    if (!imageElement) {
      throw new Error('No image to export');
    }
    const copy = document.createElement('canvas');
    copy.width = imageElement.naturalWidth;
    copy.height = imageElement.naturalHeight;
    copy.getContext('2d')!.drawImage(imageElement, 0, 0);
    return new Promise<Blob>((resolve, reject) =>
      copy.toBlob(blob => (blob ? resolve(blob) : reject(new Error('Export failed'))), 'image/png')
    );
  },
};
