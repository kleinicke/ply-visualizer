'use strict';

window.__tiffVisualizerVendorAssets = {
  wasm: './media/wasm/tiff-wasm.wasm',
  workers: {
    'decodeWorker.bundle.js': './media/decodeWorker.bundle.js',
    'fastRawWorker.bundle.js': './media/fastRawWorker.bundle.js',
    'layeredDecodeWorker.bundle.js': './media/layeredDecodeWorker.bundle.js',
  },
  jxlWasm: './media/wasm/jxl-wasm.wasm',
  codecWasm: './media/wasm/codec-wasm.wasm',
  geotiff: './media/geotiff.min.js',
  pako: './media/pako.min.js',
  parseExr: './media/parse-exr.js',
  layeredPreviewFallback: './media/layeredPreviewFallback.bundle.js',
  imagejRoi: './media/imagejRoi.bundle.js',
};

window.__tiffVisualizerVendorAssets.workers['pngDecodeWorker.bundle.js'] =
  './media/pngDecodeWorker.bundle.js';
(function absoluteAssets(assets) {
  for (const key of Object.keys(assets)) {
    if (typeof assets[key] === 'string') assets[key] = new URL(assets[key], document.baseURI).href;
    else if (assets[key] && typeof assets[key] === 'object') absoluteAssets(assets[key]);
  }
})(window.__tiffVisualizerVendorAssets);
