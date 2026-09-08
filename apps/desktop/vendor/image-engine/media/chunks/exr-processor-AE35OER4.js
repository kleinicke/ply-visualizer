import { b as _, d as w, q as S, r as I, s as N, t as y, u as T } from './chunk-JGPZW56V.js';
import { c as A, d as M } from './chunk-W2ORCHQ2.js';
import { c as v } from './chunk-H437L57U.js';
import './chunk-Y6SLVHK3.js';
async function C(b, a) {
  if (!a?.canDecode('exr-zip-plan') || b.byteLength === 0) return { result: null, source: b };
  let t = await a.decode('exr-zip-plan', b),
    e = t?.ok ? t.result : null,
    s =
      e?.source instanceof ArrayBuffer
        ? e.source
        : t?.buffer instanceof ArrayBuffer
          ? t.buffer
          : new ArrayBuffer(0);
  if (!e?.supported) return { result: null, source: s };
  let r = await v({
    width: Number(e.width),
    height: Number(e.height),
    dataY: Number(e.dataY),
    counts: e.counts,
    yCoordinates: e.yCoordinates,
    compressed: e.compressed,
  });
  if (!r) return { result: null, source: s };
  (a.retireAfterDecode?.(),
    w.mark('decode-worker(exr)'),
    w.detail('decode-exr-zip-plan', Number(e.planMs || 0)),
    w.detail('decode-exr-zip-workers', r.durationMs));
  let i = String(e.channelName || 'Y');
  return {
    source: new ArrayBuffer(0),
    result: {
      width: Number(e.width),
      height: Number(e.height),
      data: r.data,
      format: 1028,
      type: 1015,
      channelNames: [i],
      displayedChannels: [i],
      flipY: !1,
      allTagsJson: String(e.allTagsJson || '[]'),
      stats: { min: r.min, max: r.max },
      channels: 1,
      decodedWith: `wasm (${r.workers} EXR ZIP workers)`,
      decodeTimings: [
        { name: 'decode-exr-zip-plan', durationMs: Number(e.planMs || 0) },
        { name: 'decode-exr-zip-workers', durationMs: r.durationMs },
      ],
    },
  };
}
var k = class {
  constructor(a, t) {
    ((this.settingsManager = a),
      (this.vscode = t),
      (this._lastRaw = null),
      (this._lastAllTags = []),
      (this._pendingRenderData = null),
      (this._isInitialLoad = !0),
      (this._cachedStats = void 0),
      (this._lastRenderHistogram = null),
      (this._lastRenderUsedWebGL = !1),
      (this._webglRenderer = new T()),
      (this.loadSignal = void 0),
      (this.decodeWorker = null),
      (this._lastDecodeInfo = null));
  }
  clamp(a, t, e) {
    return Math.min(Math.max(a, t), e);
  }
  _getNanColor(a) {
    return _(a);
  }
  async processExr(a) {
    let t = this.loadSignal;
    try {
      ((this._lastDecodeInfo = null), (this._cachedStats = void 0));
      let e = 1015,
        s = await y.takeSpeculativeDecode(a, t, 'exr'),
        r;
      if (s?.ok) r = s.result;
      else {
        let m = s?.buffer instanceof ArrayBuffer ? s.buffer : await y.fetchArrayBuffer(a, t, 'exr');
        if (t?.aborted) throw new DOMException('Load superseded', 'AbortError');
        let c = null;
        try {
          c = await C(m, this.decodeWorker);
        } catch (p) {
          console.warn('[ExrProcessor] Parallel ZIP path failed, using the full decoder:', p);
        }
        if (t?.aborted) throw new DOMException('Load superseded', 'AbortError');
        c?.result
          ? (r = c.result)
          : ((m =
              c?.source instanceof ArrayBuffer && c.source.byteLength
                ? c.source
                : m.byteLength
                  ? m
                  : await (await fetch(a, { signal: t })).arrayBuffer()),
            (r = await y.decodeWithFallback(this.decodeWorker, 'exr', m, a, t, async p =>
              (await A())(p, e)
            )));
      }
      if (
        (r.wasmFallbackReason &&
          console.warn(
            '[ExrProcessor] Rust EXR decoder fell back to parse-exr:',
            r.wasmFallbackReason
          ),
        r.decodedWith)
      ) {
        let c = (Array.isArray(r.decodeTimings) ? r.decodeTimings : []).reduce((p, W) => {
          let R = Number(W?.durationMs);
          return p + (Number.isFinite(R) ? R : 0);
        }, 0);
        this._lastDecodeInfo = { engine: String(r.decodedWith), durationMs: c };
      }
      let {
          width: i,
          height: l,
          data: u,
          format: n,
          type: o,
          channelNames: f,
          displayedChannels: h,
        } = r,
        D = r.flipY !== !1;
      this._lastAllTags = M(r.allTagsJson);
      let d,
        E = i * l;
      Array.isArray(h) && h.length > 0 && u.length === E * h.length
        ? (d = h.length)
        : n === 1023
          ? (d = 4)
          : n === 1028
            ? (d = 1)
            : (d = u.length / E);
      let x = document.createElement('canvas');
      ((x.width = i), (x.height = l));
      let g = r,
        L =
          g.stats &&
          Number.isFinite(g.stats.min) &&
          Number.isFinite(g.stats.max) &&
          (g.channels === void 0 || g.channels === d)
            ? { min: g.stats.min, max: g.stats.max }
            : void 0;
      if (
        ((this._cachedStats = L),
        (this.rawExrData = {
          width: i,
          height: l,
          data: u,
          channels: d,
          type: o,
          format: n,
          isFloat: !0,
          channelNames: f || [],
          flipY: D,
        }),
        this.vscode && this._isInitialLoad)
      ) {
        (this.vscode.postMessage({
          type: 'formatInfo',
          value: {
            width: i,
            height: l,
            channels: d,
            samplesPerPixel: d,
            bitsPerSample: o === 1016 ? 16 : 32,
            sampleFormat: 3,
            dataType: o === 1016 ? 'float16' : 'float32',
            isHdr: !0,
            formatLabel: 'EXR',
            formatType: 'exr-float',
            isInitialLoad: !0,
            channelNames: f || [],
            displayedChannels: h || [],
          },
        }),
          (this._pendingRenderData = {
            width: i,
            height: l,
            data: u,
            channels: d,
            type: o,
            format: n,
          }));
        let m = new ImageData(i, l);
        return { canvas: x, imageData: m, exrData: this.rawExrData };
      }
      let F = this.renderExrToCanvas(this.settingsManager.settings);
      return { canvas: x, imageData: F, exrData: this.rawExrData };
    } catch (e) {
      throw (console.error('Error processing EXR:', e), e);
    }
  }
  renderExrToCanvas(a, t = {}) {
    if (((this._lastRenderHistogram = null), (this._lastRenderUsedWebGL = !1), !this.rawExrData))
      throw new Error('No EXR data loaded');
    let { width: e, height: s, data: r, channels: i, flipY: l } = this.rawExrData,
      u = a.normalization?.gammaMode || !1,
      n = this._cachedStats;
    !n &&
      S.needsStats(a) &&
      ((n = I.calculateFloatStats(r, e, s, i)),
      (this._cachedStats = n),
      this.vscode && n && this.vscode.postMessage({ type: 'stats', value: n }),
      a.normalization?.autoNormalize !== !1 &&
        this.settingsManager &&
        this.settingsManager.settings.normalization &&
        ((this.settingsManager.settings.normalization.min = n.min),
        (this.settingsManager.settings.normalization.max = n.max)));
    let o = this._getNanColor(a);
    if (
      t.targetCanvas &&
      this._webglRenderer.canRender({
        data: r,
        width: e,
        height: s,
        channels: i,
        isFloat: !0,
        settings: a,
        collectHistogram: t.collectHistogram === !0,
      }) &&
      this._webglRenderer.render(t.targetCanvas, {
        data: r,
        width: e,
        height: s,
        min: n && Number.isFinite(n.min) ? n.min : 0,
        max: n && Number.isFinite(n.max) ? n.max : 1,
        typeMax: 1,
        settings: a,
        nanColor: o,
        channels: i,
        flipY: l,
      })
    )
      return ((this._lastRenderUsedWebGL = !0), t.placeholderImageData || new ImageData(e, s));
    let f = { nanColor: o, flipY: l, collectHistogram: t.collectHistogram === !0 },
      h = N.render(r, e, s, i, !0, n || { min: 0, max: 1 }, a, f);
    return ((this._lastRenderHistogram = f.renderHistogramResult || null), h);
  }
  getPixelValue(a, t) {
    if (!this.rawExrData) return null;
    let { width: e, height: s, data: r, channels: i } = this.rawExrData;
    if (a < 0 || a >= e || t < 0 || t >= s) return null;
    let u = ((this.rawExrData.flipY ? s - 1 - t : t) * e + a) * i,
      n = [];
    for (let o = 0; o < i; o++) n.push(r[u + o]);
    return n;
  }
  updateSettings(a, t = {}) {
    if (this._pendingRenderData && this._isInitialLoad) {
      let e = this.renderExrToCanvas(a, t);
      return ((this._isInitialLoad = !1), (this._pendingRenderData = null), e);
    } else if (this.rawExrData) {
      let { width: e, height: s } = this.rawExrData;
      return this.renderExrToCanvas(a);
    }
    return null;
  }
};
export { k as ExrProcessor };
