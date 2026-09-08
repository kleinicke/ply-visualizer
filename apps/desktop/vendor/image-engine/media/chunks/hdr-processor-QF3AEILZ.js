import { b as x, d as S, q as M, r as W, s as L, t as F, u as C } from './chunk-JGPZW56V.js';
import { d as E } from './chunk-W2ORCHQ2.js';
import { a as T, b as B } from './chunk-Y6SLVHK3.js';
var H = T((O, N) => {
  var G = '#\\?RADIANCE',
    U = '#.*',
    j = 'EXPOSURE=\\s*([0-9]*[.][0-9]*)',
    V = 'FORMAT=32-bit_rle_rgbe',
    $ = '-Y ([0-9]+) \\+X ([0-9]+)';
  function z(p, e, t, o, a, s) {
    var r = new Array(4),
      i = null,
      n,
      l,
      d,
      g = new Array(2),
      h = p.length;
    function u(m) {
      var b = 0;
      do m[b++] = p[o];
      while (++o < h && b < m.length);
      return b;
    }
    function f(m, b, w) {
      var v = 0;
      do m[b + v++] = p[o];
      while (++o < h && v < w);
      return v;
    }
    function A(m, b, w, v) {
      var _ = 4 * v,
        R = f(b, w, _);
      if (R < _) throw new Error('Error reading raw pixels: got ' + R + ' bytes, expected ' + _);
    }
    for (; s > 0;) {
      if (u(r) < r.length) throw new Error('Error reading bytes: expected ' + r.length);
      if (r[0] != 2 || r[1] != 2 || (r[2] & 128) != 0) {
        ((e[t++] = r[0]), (e[t++] = r[1]), (e[t++] = r[2]), (e[t++] = r[3]), A(p, e, t, a * s - 1));
        return;
      }
      if ((((r[2] & 255) << 8) | (r[3] & 255)) != a)
        throw new Error(
          'Wrong scanline width ' + (((r[2] & 255) << 8) | (r[3] & 255)) + ', expected ' + a
        );
      (i == null && (i = new Array(4 * a)), (n = 0));
      for (var c = 0; c < 4; c++)
        for (l = (c + 1) * a; n < l;) {
          if (u(g) < g.length) throw new Error('Error reading 2-byte buffer');
          if ((g[0] & 255) > 128) {
            if (((d = (g[0] & 255) - 128), d == 0 || d > l - n))
              throw new Error('Bad scanline data');
            for (; d-- > 0;) i[n++] = g[1];
          } else {
            if (((d = g[0] & 255), d == 0 || d > l - n)) throw new Error('Bad scanline data');
            if (((i[n++] = g[1]), --d > 0)) {
              if (f(i, n, d) < d) throw new Error('Error reading non-run data');
              n += d;
            }
          }
        }
      for (var c = 0; c < a; c++)
        ((e[t + 0] = i[c]),
          (e[t + 1] = i[c + a]),
          (e[t + 2] = i[c + 2 * a]),
          (e[t + 3] = i[c + 3 * a]),
          (t += 4));
      s--;
    }
  }
  function J(p) {
    p instanceof ArrayBuffer && (p = new Uint8Array(p));
    var e = 0,
      t = p.length,
      o = 10;
    function a() {
      var D = '';
      do {
        var I = p[e];
        if (I == o) {
          ++e;
          break;
        }
        D += String.fromCharCode(I);
      } while (++e < t);
      return D;
    }
    for (var s = 0, r = 0, i = 1, n = 1, l = !1, d = 0; d < 20; d++) {
      var g = a(),
        h;
      if (!(h = g.match(G))) {
        if ((h = g.match(V))) l = !0;
        else if ((h = g.match(j))) i = Number(h[1]);
        else if (!(h = g.match(U))) {
          if ((h = g.match($))) {
            ((r = Number(h[1])), (s = Number(h[2])));
            break;
          }
        }
      }
    }
    if (!l) throw new Error('File is not run length encoded!');
    var u = new Uint8Array(s * r * 4),
      f = s,
      A = r;
    z(p, u, 0, e, f, A);
    for (var c = new Float32Array(s * r * 4), m = 0; m < u.length; m += 4) {
      var b = u[m + 0] / 255,
        w = u[m + 1] / 255,
        v = u[m + 2] / 255,
        _ = u[m + 3],
        R = Math.pow(2, _ - 128);
      ((b *= R), (w *= R), (v *= R));
      var y = m;
      ((c[y + 0] = b), (c[y + 1] = w), (c[y + 2] = v), (c[y + 3] = 1));
    }
    return { shape: [s, r], exposure: i, gamma: n, data: c };
  }
  N.exports = J;
});
var k = B(H());
var P = class {
  constructor(e, t) {
    ((this.settingsManager = e),
      (this.vscode = t),
      (this._lastRaw = null),
      (this._lastAllTags = []),
      (this._pendingRenderData = null),
      (this._isInitialLoad = !0),
      (this._cachedStats = void 0),
      (this._lastRenderHistogram = null),
      (this._lastRenderUsedWebGL = !1),
      (this._cachedWebglRgb = null),
      (this._webglRenderer = new C()),
      (this.loadSignal = void 0),
      (this.decodeWorker = null));
  }
  async processHdr(e) {
    let t = this.loadSignal,
      o = await F.takeSpeculativeDecode(e, t, 'hdr'),
      a;
    if (o?.ok) a = o.result;
    else {
      let h = o?.buffer instanceof ArrayBuffer ? o.buffer : await F.fetchArrayBuffer(e, t, 'hdr');
      if (t?.aborted) throw new DOMException('Load superseded', 'AbortError');
      a = await F.decodeWithFallback(this.decodeWorker, 'hdr', h, e, t, u => (0, k.default)(u));
    }
    let s = a.shape[0],
      r = a.shape[1];
    this._lastAllTags = E(a.allTagsJson);
    let i = a.data,
      n = 3,
      l = a.channels === 3 ? 3 : 4;
    ((this._cachedStats = void 0),
      (this._cachedWebglRgb = null),
      (this._lastRaw = { width: s, height: r, data: i, channels: l }));
    let d = document.createElement('canvas');
    if (((d.width = s), (d.height = r), this._isInitialLoad))
      return (
        this._postFormatInfo(s, r, n, 'HDR'),
        (this._pendingRenderData = { data: i, width: s, height: r, renderChannels: l }),
        { canvas: d, imageData: new ImageData(s, r) }
      );
    this._postFormatInfo(s, r, n, 'HDR');
    let g = this._toImageDataFloat(i, s, r, l);
    return (
      this.vscode && this.vscode.postMessage({ type: 'refresh-status' }),
      { canvas: d, imageData: g }
    );
  }
  _toImageDataFloat(e, t, o, a, s = {}) {
    ((this._lastRenderHistogram = null), (this._lastRenderUsedWebGL = !1));
    let r = this.settingsManager.settings,
      i = r.normalization?.gammaMode || !1,
      n = this._cachedStats;
    !n &&
      M.needsStats(r) &&
      ((n = W.calculateFloatStats(e, t, o, a)),
      (this._cachedStats = n),
      this.vscode && this.vscode.postMessage({ type: 'stats', value: n }));
    let l = this._getNanColor(r),
      d = null;
    if (
      d &&
      s.targetCanvas &&
      this._webglRenderer.canRender({
        data: d,
        width: t,
        height: o,
        channels: 4,
        isFloat: !0,
        settings: r,
      }) &&
      this._webglRenderer.render(s.targetCanvas, {
        data: d,
        width: t,
        height: o,
        channels: 4,
        isFloat: !0,
        min: n && Number.isFinite(n.min) ? n.min : 0,
        max: n && Number.isFinite(n.max) ? n.max : 1,
        typeMax: 1,
        settings: r,
        nanColor: l,
      })
    )
      return ((this._lastRenderUsedWebGL = !0), s.placeholderImageData || new ImageData(t, o));
    let g = { nanColor: l, collectHistogram: s.collectHistogram === !0 },
      h = L.render(e, t, o, a, !0, n || { min: 0, max: 1 }, r, g);
    return ((this._lastRenderHistogram = g.renderHistogramResult || null), h);
  }
  _getWebglRgbaData(e, t, o, a) {
    if (a === 4) return e;
    if (a !== 3) return null;
    if (this._cachedWebglRgb?.source === e) return this._cachedWebglRgb.data;
    let s = performance.now(),
      r = t * o,
      i = new Float32Array(r * 4);
    for (let n = 0, l = 0; n < e.length; n += 3, l += 4)
      ((i[l] = e[n]), (i[l + 1] = e[n + 1]), (i[l + 2] = e[n + 2]), (i[l + 3] = 1));
    return (
      (this._cachedWebglRgb = { source: e, data: i }),
      S.detail('hdr-pack-rgba', performance.now() - s),
      i
    );
  }
  _getNanColor(e) {
    return x(e);
  }
  getColorAtPixel(e, t, o, a) {
    if (!this._lastRaw) return '';
    let { width: s, height: r, data: i, channels: n } = this._lastRaw;
    if (s !== o || r !== a) return '';
    let l = (t * s + e) * n;
    if (l < 0 || l + 2 >= i.length) return '';
    let d = i[l],
      g = i[l + 1],
      h = i[l + 2],
      u = f =>
        Number.isNaN(f)
          ? 'NaN'
          : f === 1 / 0
            ? 'Inf'
            : f === -1 / 0
              ? '-Inf'
              : parseFloat(f.toFixed(6)).toString();
    return `${u(d)} ${u(g)} ${u(h)}`;
  }
  _postFormatInfo(e, t, o, a) {
    this.vscode &&
      this.vscode.postMessage({
        type: 'formatInfo',
        value: {
          width: e,
          height: t,
          compression: 'RLE',
          predictor: 1,
          photometricInterpretation: 2,
          planarConfig: 1,
          samplesPerPixel: o,
          bitsPerSample: 32,
          sampleFormat: 3,
          formatLabel: a,
          formatType: 'hdr',
          isInitialLoad: this._isInitialLoad,
        },
      });
  }
  performDeferredRender(e = {}) {
    if (!this._pendingRenderData) return null;
    let { data: t, width: o, height: a, renderChannels: s } = this._pendingRenderData;
    ((this._pendingRenderData = null), (this._isInitialLoad = !1));
    let r = this._toImageDataFloat(t, o, a, s, e);
    return (this.vscode && this.vscode.postMessage({ type: 'refresh-status' }), r);
  }
  renderHdrWithSettings(e = {}) {
    if (!this._lastRaw) return null;
    let { width: t, height: o, data: a, channels: s } = this._lastRaw;
    return this._toImageDataFloat(a, t, o, s, e);
  }
};
export { P as HdrProcessor };
