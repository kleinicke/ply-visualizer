import { a as m } from './chunk-QWXO6ZKU.js';
import './chunk-XWHK7DEW.js';
import './chunk-BU6XBOGD.js';
import './chunk-DZXXIB7W.js';
import { t as s } from './chunk-JGPZW56V.js';
import './chunk-W2ORCHQ2.js';
import './chunk-V6CXALVX.js';
import './chunk-Y6SLVHK3.js';
var h = class extends m {
  constructor(t, i, r) {
    super(t, i);
    this.metadata = {};
    this._workerCachedSource = '';
    this.numericDomain = {
      bitsPerSample: 32,
      sampleFormat: 3,
      typeMin: 0,
      typeMax: 1,
      sourceNumericType: 'float32',
    };
    this.config = r;
  }
  async process(t, i = {}) {
    let r = this.loadSignal,
      a = this.config.cacheSourceInWorker ? t : '',
      d =
        !!a &&
        this._workerCachedSource === a &&
        !!this.decodeWorker?.canDecode(this.config.workerFormat)
          ? new ArrayBuffer(0)
          : await s.fetchArrayBuffer(t, r, this.config.workerFormat);
    if (r?.aborted) throw new DOMException('Load superseded', 'AbortError');
    let f = a ? { ...i, sourceCacheKey: a } : i,
      e;
    try {
      e = await s.decodeWithFallback(
        this.decodeWorker,
        this.config.workerFormat,
        d,
        t,
        r,
        (o, g) => this.config.parse(o, g),
        f
      );
    } catch (o) {
      throw ((this._workerCachedSource = ''), o);
    }
    ((this._workerCachedSource = a),
      (this._cachedStats = void 0),
      (this._decodedStats = e.stats),
      (this.metadata = e.metadata || {}),
      (this.numericDomain = e.numericDomain),
      (this._lastRaw = { width: e.width, height: e.height, data: e.data, channels: e.channels }));
    let n = document.createElement('canvas');
    if (
      ((n.width = e.width),
      (n.height = e.height),
      this._postScientificFormatInfo(e),
      this._isInitialLoad)
    )
      return (
        (this._pendingRenderData = {
          displayData: e.data,
          width: e.width,
          height: e.height,
          channels: e.channels,
        }),
        { canvas: n, imageData: new ImageData(e.width, e.height) }
      );
    let p = this._toImageDataFloat(e.data, e.width, e.height, e.channels, {
      typeMin: this.numericDomain.typeMin,
      typeMax: this.numericDomain.typeMax,
    });
    return (this.vscode.postMessage({ type: 'refresh-status' }), { canvas: n, imageData: p });
  }
  _postScientificFormatInfo(t) {
    let i = t.metadata || this.metadata;
    this.vscode.postMessage({
      type: 'formatInfo',
      value: {
        width: t.width,
        height: t.height,
        compression: 'none',
        photometricInterpretation: t.channels >= 3 ? 2 : 1,
        planarConfig: 1,
        samplesPerPixel: t.channels,
        bitsPerSample: this.numericDomain.bitsPerSample,
        sampleFormat: this.numericDomain.sampleFormat,
        typeMin: this.numericDomain.typeMin,
        typeMax: this.numericDomain.typeMax,
        sourceNumericType: this.numericDomain.sourceNumericType,
        floatCarrier: !0,
        formatLabel: this.config.formatLabel,
        formatType: this.config.formatTypeFor?.(this.numericDomain) ?? this.config.formatType,
        isInitialLoad: this._isInitialLoad,
        ...i,
      },
    });
  }
  renderWithSettings(t = {}) {
    if (!this._lastRaw) return null;
    let { width: i, height: r, data: a, channels: c } = this._lastRaw;
    return this._toImageDataFloat(a, i, r, c, this._withNumericDomain(t));
  }
  _withNumericDomain(t) {
    return { ...t, typeMin: this.numericDomain.typeMin, typeMax: this.numericDomain.typeMax };
  }
  performDeferredRender(t = {}) {
    return super.performDeferredRender(this._withNumericDomain(t));
  }
};
export { h as ScientificArrayProcessor };
