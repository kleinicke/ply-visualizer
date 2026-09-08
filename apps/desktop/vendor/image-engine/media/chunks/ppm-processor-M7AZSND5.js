import { a as v } from './chunk-XWHK7DEW.js';
import { b as w } from './chunk-BU6XBOGD.js';
import './chunk-DZXXIB7W.js';
import { d as I, q as M, r as A, s as S, t as R, u as x } from './chunk-JGPZW56V.js';
import './chunk-W2ORCHQ2.js';
import './chunk-V6CXALVX.js';
import './chunk-Y6SLVHK3.js';
var z = new Uint8Array(new Uint16Array([1]).buffer)[0] === 1,
  L = class {
    constructor(e, n) {
      ((this.settingsManager = e),
        (this.vscode = n),
        (this._lastRaw = null),
        (this._pendingRenderData = null),
        (this._isInitialLoad = !0),
        (this._cachedStats = void 0),
        (this._cachedStatsRgb24Mode = !1),
        (this._decodedStats = void 0),
        (this._lastRenderUsedWebGL = !1),
        (this._webglRenderer = new x()),
        (this.loadSignal = void 0),
        (this.decodeWorker = null));
    }
    async processPpm(e) {
      let n = this.loadSignal,
        r = await R.takeSpeculativeDecode(e, n, 'ppm'),
        o;
      if (r?.ok) o = r.result;
      else {
        let h = r?.buffer instanceof ArrayBuffer ? r.buffer : await R.fetchArrayBuffer(e, n, 'ppm');
        if (n?.aborted) throw new DOMException('Load superseded', 'AbortError');
        let l = new Uint8Array(h, 0, Math.min(2, h.byteLength)),
          b = l.length === 2 && l[0] === 80 && l[1] === 53 ? null : this.decodeWorker;
        o = await R.decodeWithFallback(b, 'ppm', h, e, n, p => v(p) || w(p));
      }
      let {
          width: t,
          height: s,
          channels: a,
          data: c,
          numericDomain: d,
          formatLabel: f,
          stats: _,
        } = o,
        u = d.typeMax,
        m = c;
      ((this._cachedStats = void 0),
        (this._cachedStatsRgb24Mode = !1),
        (this._decodedStats = _),
        (this._lastRaw = { width: t, height: s, data: m, maxval: u, channels: a, format: f }));
      let i = document.createElement('canvas');
      if (((i.width = t), (i.height = s), this._isInitialLoad)) {
        (this._postFormatInfo(t, s, a, f, u),
          (this._pendingRenderData = {
            displayData: m,
            width: t,
            height: s,
            maxval: u,
            channels: a,
          }));
        let h = new ImageData(t, s);
        return { canvas: i, imageData: h };
      }
      this._postFormatInfo(t, s, a, f, u);
      let g = this._toImageDataWithNormalization(m, t, s, u, a);
      return (this.vscode.postMessage({ type: 'refresh-status' }), { canvas: i, imageData: g });
    }
    _toImageDataWithNormalization(e, n, r, o, t = 1, s = {}) {
      this._lastRenderUsedWebGL = !1;
      let a = this.settingsManager.settings,
        c = (a.rgbAs24BitGrayscale ?? !1) && t === 3;
      this._cachedStatsRgb24Mode !== c && (this._cachedStats = void 0);
      let d = this._cachedStats;
      if (!d && M.needsStats(a)) {
        if (c) {
          let u = 1 / 0,
            m = -1 / 0,
            i = n * r,
            g = e instanceof Uint16Array;
          for (let h = 0; h < i; h++) {
            let l = h * 3,
              b,
              p,
              y;
            g
              ? ((b = Math.round(e[l] / 257)),
                (p = Math.round(e[l + 1] / 257)),
                (y = Math.round(e[l + 2] / 257)))
              : ((b = e[l]), (p = e[l + 1]), (y = e[l + 2]));
            let D = (b << 16) | (p << 8) | y;
            (D < u && (u = D), D > m && (m = D));
          }
          d = { min: u, max: m };
        } else d = this._decodedStats || A.calculateIntegerStats(e, n, r, t, !1);
        ((this._cachedStats = d),
          (this._cachedStatsRgb24Mode = c),
          this.vscode && d && this.vscode.postMessage({ type: 'stats', value: d }));
      }
      let f = { rgbAs24BitGrayscale: c, typeMax: c ? 16777215 : o },
        _ = c ? 16777215 : o;
      return s.targetCanvas &&
        this._webglRenderer.canRender({
          data: e,
          width: n,
          height: r,
          channels: t,
          isFloat: !1,
          settings: a,
        }) &&
        this._webglRenderer.render(s.targetCanvas, {
          data: e,
          width: n,
          height: r,
          channels: t,
          isFloat: !1,
          min: d && Number.isFinite(d.min) ? d.min : 0,
          max: d && Number.isFinite(d.max) ? d.max : _,
          typeMax: _,
          settings: a,
          nanColor: { r: 0, g: 0, b: 0 },
        })
        ? ((this._lastRenderUsedWebGL = !0), s.placeholderImageData || new ImageData(n, r))
        : S.render(e, n, r, t, !1, d, a, f);
    }
    renderPgmWithSettings(e = {}) {
      if (!this._lastRaw) return null;
      let { width: n, height: r, data: o, maxval: t, channels: s } = this._lastRaw;
      return this._toImageDataWithNormalization(o, n, r, t, s, e);
    }
    getColorAtPixel(e, n, r, o) {
      if (!this._lastRaw) return '';
      let { width: t, height: s, data: a, channels: c, maxval: d } = this._lastRaw;
      if (t !== r || s !== o) return '';
      let f = this.settingsManager.settings,
        _ = (f.rgbAs24BitGrayscale ?? !1) && c === 3,
        u = f.normalizedFloatMode,
        m = n * t + e;
      if (_) {
        let i = m * 3;
        if (i >= 0 && i + 2 < a.length) {
          let g = Math.round(Math.max(0, Math.min(255, a[i]))),
            h = Math.round(Math.max(0, Math.min(255, a[i + 1]))),
            l = Math.round(Math.max(0, Math.min(255, a[i + 2]))),
            b = (g << 16) | (h << 8) | l,
            p = f.scale24BitFactor || 1e3;
          return (b / p).toFixed(3);
        }
      } else if (c === 3) {
        let i = m * 3;
        if (i >= 0 && i + 2 < a.length) {
          let g = a[i],
            h = a[i + 1],
            l = a[i + 2];
          return `${g} ${h} ${l}`;
        }
      } else if (m >= 0 && m < a.length) {
        let i = a[m];
        return u ? (i / d).toPrecision(4) : i.toString();
      }
      return '';
    }
    _flipImageVertically(e, n, r) {
      let o = new e.constructor(e.length);
      for (let t = 0; t < r; t++)
        for (let s = 0; s < n; s++) {
          let a = t * n + s,
            c = (r - 1 - t) * n + s;
          o[c] = e[a];
        }
      return o;
    }
    _postFormatInfo(e, n, r, o, t) {
      this.vscode &&
        this.vscode.postMessage({
          type: 'formatInfo',
          value: {
            width: e,
            height: n,
            compression: 'None',
            predictor: 1,
            photometricInterpretation: r === 3 ? 2 : 1,
            planarConfig: 1,
            samplesPerPixel: r,
            bitsPerSample: t > 255 ? 16 : 8,
            sampleFormat: 1,
            formatLabel: o,
            maxval: t,
            formatType: 'ppm',
            isInitialLoad: this._isInitialLoad,
          },
        });
    }
    performDeferredRender(e = {}) {
      if (!this._pendingRenderData) return null;
      let { displayData: n, width: r, height: o, maxval: t, channels: s } = this._pendingRenderData;
      ((this._pendingRenderData = null),
        (this._isInitialLoad = !1),
        I.mark('ppm-deferred-render-start'));
      let a = this._toImageDataWithNormalization(n, r, o, t, s, e);
      return (this.vscode.postMessage({ type: 'refresh-status' }), a);
    }
  };
export { L as PpmProcessor };
