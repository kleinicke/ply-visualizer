import { b as x } from './chunk-XWHK7DEW.js';
import { c as F } from './chunk-BU6XBOGD.js';
import './chunk-DZXXIB7W.js';
import { b as M, q as R, r as D, s as S, t as _, u as I } from './chunk-JGPZW56V.js';
import './chunk-W2ORCHQ2.js';
import './chunk-V6CXALVX.js';
import './chunk-Y6SLVHK3.js';
var w = class {
  constructor(a, n) {
    ((this.settingsManager = a),
      (this.vscode = n),
      (this._lastRaw = null),
      (this._pendingRenderData = null),
      (this._isInitialLoad = !0),
      (this._cachedStats = void 0),
      (this._cachedStatsRgb24Mode = !1),
      (this._decodedStats = void 0),
      (this._lastRenderHistogram = null),
      (this._lastRenderUsedWebGL = !1),
      (this._webglRenderer = new I()),
      (this.loadSignal = void 0),
      (this.decodeWorker = null));
  }
  async processNpy(a) {
    let n = this.loadSignal;
    ((this._cachedStats = void 0), (this._cachedStatsRgb24Mode = !1));
    let r = await _.takeSpeculativeDecode(a, n, 'npy'),
      o;
    if (r?.ok) o = r.result;
    else {
      let e = r?.buffer instanceof ArrayBuffer ? r.buffer : await _.fetchArrayBuffer(a, n, 'npy');
      if (n?.aborted) throw new DOMException('Load superseded', 'AbortError');
      o = await _.decodeWithFallback(
        this.decodeWorker,
        'npy',
        e,
        a,
        n,
        (c, g) => x(c, g?.computeStats !== !1) || F(c),
        { computeStats: R.needsStats(this.settingsManager.settings) }
      );
    }
    let { data: l, width: s, height: t, metadata: m, numericDomain: u, channels: f, stats: i } = o,
      p = (m && m.dtype) || '';
    ((this._lastRaw = { width: s, height: t, data: l, dtype: p, numericDomain: u, channels: f }),
      (this._decodedStats = i));
    let h = document.createElement('canvas');
    if (((h.width = s), (h.height = t), this._isInitialLoad)) {
      (this._postFormatInfo(s, t, 'NPY'),
        (this._pendingRenderData = { data: l, width: s, height: t }));
      let e = new ImageData(s, t);
      return { canvas: h, imageData: e };
    }
    let d = this._toImageDataFloat(l, s, t);
    return (this.vscode.postMessage({ type: 'refresh-status' }), { canvas: h, imageData: d });
  }
  _toImageDataFloat(a, n, r, o = {}) {
    ((this._lastRenderHistogram = null), (this._lastRenderUsedWebGL = !1));
    let l = this._lastRaw?.channels || 1,
      s = this.settingsManager.settings,
      t = (s.rgbAs24BitGrayscale ?? !1) && l === 3,
      m = this._lastRaw?.numericDomain,
      u = (m?.sampleFormat ?? 3) === 3,
      f = s.normalization?.gammaMode || !1;
    this._cachedStatsRgb24Mode !== t && (this._cachedStats = void 0);
    let i = this._cachedStats;
    !i &&
      R.needsStats(s) &&
      (t
        ? (i = D.calculateIntegerStats(a, n, r, l, !0))
        : (i = this._decodedStats || D.calculateFloatStats(a, n, r, l)),
      (this._cachedStats = i),
      (this._cachedStatsRgb24Mode = t),
      this.vscode && i && this.vscode.postMessage({ type: 'stats', value: i }));
    let p = this._getNanColor(s),
      h = u ? void 0 : m?.typeMax,
      d = h ?? 1;
    if (
      o.targetCanvas &&
      this._webglRenderer.canRender({
        data: a,
        width: n,
        height: r,
        channels: l,
        isFloat: u,
        settings: s,
        collectHistogram: o.collectHistogram === !0,
      }) &&
      this._webglRenderer.render(o.targetCanvas, {
        data: a,
        width: n,
        height: r,
        min: i && Number.isFinite(i.min) ? i.min : 0,
        max: i && Number.isFinite(i.max) ? i.max : d,
        typeMax: d,
        settings: s,
        nanColor: p,
        channels: l,
      })
    )
      return ((this._lastRenderUsedWebGL = !0), o.placeholderImageData || new ImageData(n, r));
    let e = {
        nanColor: p,
        rgbAs24BitGrayscale: t,
        flipY: !1,
        typeMax: h,
        collectHistogram: o.collectHistogram === !0,
      },
      c = S.render(a, n, r, l, !0, i || { min: 0, max: 1 }, s, e);
    return ((this._lastRenderHistogram = e.renderHistogramResult || null), c);
  }
  renderNpyWithSettings(a = {}) {
    if (!this._lastRaw) return null;
    let { width: n, height: r, data: o } = this._lastRaw;
    return this._toImageDataFloat(o, n, r, a);
  }
  getColorAtPixel(a, n, r, o) {
    if (!this._lastRaw) return '';
    let { width: l, height: s, data: t, channels: m, dtype: u } = this._lastRaw;
    if (l !== r || s !== o) return '';
    let f = n * l + a,
      i = this.settingsManager.settings,
      p = (i.rgbAs24BitGrayscale ?? !1) && m === 3,
      h = i.normalizedFloatMode,
      d = e =>
        Number.isNaN(e)
          ? 'NaN'
          : e === 1 / 0
            ? 'Inf'
            : e === -1 / 0
              ? '-Inf'
              : parseFloat(e.toFixed(6)).toString();
    if (p) {
      let e = f * 3,
        c = Math.round(Math.max(0, Math.min(255, t[e + 0]))),
        g = Math.round(Math.max(0, Math.min(255, t[e + 1]))),
        b = Math.round(Math.max(0, Math.min(255, t[e + 2]))),
        y = (c << 16) | (g << 8) | b,
        v = i.scale24BitFactor || 1e3;
      return (y / v).toFixed(3);
    } else if (m === 3) {
      let e = f * 3,
        c = t[e + 0],
        g = t[e + 1],
        b = t[e + 2];
      return `${d(c)} ${d(g)} ${d(b)}`;
    } else if (m === 4) {
      let e = f * 4,
        c = t[e + 0],
        g = t[e + 1],
        b = t[e + 2],
        y = t[e + 3];
      return `${d(c)} ${d(g)} ${d(b)} \u03B1:${d(y)}`;
    } else {
      let e = t[f];
      if (h && u && !u.includes('f') && Number.isFinite(e)) {
        let c = 255;
        u.includes('u2') || u.includes('i2')
          ? (c = u.includes('u') ? 65535 : 32767)
          : (u.includes('u4') || u.includes('i4')) &&
            (c = u.includes('u') ? 4294967295 : 2147483647);
        let g = e / c;
        return d(g);
      }
      return d(e);
    }
    return '';
  }
  _postFormatInfo(a, n, r) {
    if (!this.vscode) return;
    let o = this._lastRaw?.numericDomain,
      l = o?.bitsPerSample ?? 32,
      s = o?.sampleFormat ?? 3,
      t = this._lastRaw?.channels || 1,
      m = 'npy';
    (s === 3 ? (m = 'npy-float') : (s === 1 || s === 2) && (m = 'npy-uint'),
      this.vscode.postMessage({
        type: 'formatInfo',
        value: {
          width: a,
          height: n,
          compression: '1',
          predictor: 3,
          photometricInterpretation: t >= 3 ? 2 : 1,
          planarConfig: 1,
          samplesPerPixel: t,
          bitsPerSample: l,
          sampleFormat: s,
          formatLabel: r,
          formatType: m,
          isInitialLoad: this._isInitialLoad,
        },
      }));
  }
  performDeferredRender(a = {}) {
    if (!this._pendingRenderData) return null;
    let { data: n, width: r, height: o } = this._pendingRenderData;
    ((this._pendingRenderData = null), (this._isInitialLoad = !1));
    let l = this._toImageDataFloat(n, r, o, a);
    return (this.vscode.postMessage({ type: 'refresh-status' }), l);
  }
  _getNanColor(a) {
    return M(a);
  }
};
export { w as NpyProcessor };
