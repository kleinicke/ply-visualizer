import { c as D } from './chunk-XWHK7DEW.js';
import { a as R } from './chunk-BU6XBOGD.js';
import { b as h, q as p, r as b, s as _, t as f, u as y } from './chunk-JGPZW56V.js';
var I = class {
  constructor(e, a) {
    ((this.settingsManager = e),
      (this.vscode = a),
      (this._lastRaw = null),
      (this._pendingRenderData = null),
      (this._isInitialLoad = !0),
      (this._cachedStats = void 0),
      (this._decodedStats = void 0),
      (this._lastRenderHistogram = null),
      (this._lastRenderUsedWebGL = !1),
      (this._webglRenderer = new y()),
      (this.loadSignal = void 0),
      (this.decodeWorker = null));
  }
  async processPfm(e) {
    let a = this.loadSignal,
      r = await f.takeSpeculativeDecode(e, a, 'pfm'),
      l;
    if (r?.ok) l = r.result;
    else {
      let u = r?.buffer instanceof ArrayBuffer ? r.buffer : await f.fetchArrayBuffer(e, a, 'pfm');
      if (a?.aborted) throw new DOMException('Load superseded', 'AbortError');
      l = await f.decodeWithFallback(
        this.decodeWorker,
        'pfm',
        u,
        e,
        a,
        g => D(g) || R(g, { topDown: !0 })
      );
    }
    let { width: t, height: n, channels: o, data: m, stats: d } = l,
      s = m;
    ((this._cachedStats = void 0),
      (this._decodedStats = d),
      (this._lastRaw = { width: t, height: n, data: s, channels: o }));
    let i = document.createElement('canvas');
    if (((i.width = t), (i.height = n), this._isInitialLoad)) {
      (this._postFormatInfo(t, n, o, 'PFM'),
        (this._pendingRenderData = { displayData: s, width: t, height: n, channels: o }));
      let u = new ImageData(t, n);
      return { canvas: i, imageData: u };
    }
    this._postFormatInfo(t, n, o, 'PFM');
    let c = this._toImageDataFloat(s, t, n, o);
    return (this.vscode.postMessage({ type: 'refresh-status' }), { canvas: i, imageData: c });
  }
  _toImageDataFloat(e, a, r, l = 1, t = {}) {
    ((this._lastRenderHistogram = null), (this._lastRenderUsedWebGL = !1));
    let n = this.settingsManager.settings,
      o = n.normalization?.gammaMode || !1,
      m = t.typeMin ?? 0,
      d = t.typeMax ?? 1,
      s = this._cachedStats;
    !s &&
      p.needsStats(n) &&
      ((s = this._decodedStats || b.calculateFloatStats(e, a, r, l)),
      (this._cachedStats = s),
      this.vscode && s && this.vscode.postMessage({ type: 'stats', value: s }));
    let i = this._getNanColor(n);
    if (
      t.targetCanvas &&
      this._webglRenderer.canRender({
        data: e,
        width: a,
        height: r,
        channels: l,
        isFloat: !0,
        settings: n,
        collectHistogram: t.collectHistogram === !0,
      }) &&
      this._webglRenderer.render(t.targetCanvas, {
        data: e,
        width: a,
        height: r,
        min: s && Number.isFinite(s.min) ? s.min : 0,
        max: s && Number.isFinite(s.max) ? s.max : 1,
        typeMin: m,
        typeMax: d,
        settings: n,
        nanColor: i,
        channels: l,
      })
    )
      return ((this._lastRenderUsedWebGL = !0), t.placeholderImageData || new ImageData(a, r));
    let c = { nanColor: i, collectHistogram: t.collectHistogram === !0, typeMin: m, typeMax: d },
      u = _.render(e, a, r, l, !0, s || { min: 0, max: 1 }, n, c);
    return ((this._lastRenderHistogram = c.renderHistogramResult || null), u);
  }
  getColorAtPixel(e, a, r, l) {
    if (!this._lastRaw) return '';
    let { width: t, height: n, data: o, channels: m } = this._lastRaw;
    if (t !== r || n !== l) return '';
    let d = a * t + e,
      s = i =>
        Number.isNaN(i)
          ? 'NaN'
          : i === 1 / 0
            ? 'Inf'
            : i === -1 / 0
              ? '-Inf'
              : parseFloat(i.toFixed(6)).toString();
    if (m === 3) {
      let i = d * 3;
      if (i >= 0 && i + 2 < o.length) {
        let c = o[i],
          u = o[i + 1],
          g = o[i + 2];
        return `${s(c)} ${s(u)} ${s(g)}`;
      }
    } else {
      let i = o[d];
      return s(i);
    }
    return '';
  }
  _getNanColor(e) {
    return h(e);
  }
  _postFormatInfo(e, a, r, l) {
    this.vscode &&
      this.vscode.postMessage({
        type: 'formatInfo',
        value: {
          width: e,
          height: a,
          compression: '1',
          predictor: 3,
          photometricInterpretation: r === 3 ? 2 : 1,
          planarConfig: 1,
          samplesPerPixel: r,
          bitsPerSample: 32,
          sampleFormat: 3,
          formatLabel: l,
          formatType: 'pfm',
          isInitialLoad: this._isInitialLoad,
        },
      });
  }
  performDeferredRender(e = {}) {
    if (!this._pendingRenderData) return null;
    let { displayData: a, width: r, height: l, channels: t } = this._pendingRenderData;
    ((this._pendingRenderData = null), (this._isInitialLoad = !1));
    let n = this._toImageDataFloat(a, r, l, t, e);
    return (this.vscode.postMessage({ type: 'refresh-status' }), n);
  }
  renderPfmWithSettings(e = {}) {
    if (!this._lastRaw) return null;
    let { width: a, height: r, data: l, channels: t } = this._lastRaw;
    return this._toImageDataFloat(l, a, r, t, e);
  }
  updateSettings(e) {
    (this.settingsManager.updateSettings(e),
      e.normalization?.autoNormalize !==
        this.settingsManager.settings.normalization?.autoNormalize && (this._cachedStats = void 0),
      this.vscode && this.vscode.postMessage({ type: 'settings-updated' }));
  }
  _flipImageVertically(e, a, r, l = 1) {
    let t = new Float32Array(e.length);
    for (let n = 0; n < r; n++)
      for (let o = 0; o < a; o++)
        if (l === 3) {
          let m = (n * a + o) * 3,
            d = ((r - 1 - n) * a + o) * 3;
          ((t[d] = e[m]), (t[d + 1] = e[m + 1]), (t[d + 2] = e[m + 2]));
        } else {
          let m = n * a + o,
            d = (r - 1 - n) * a + o;
          t[d] = e[m];
        }
    return t;
  }
};
export { I as a };
