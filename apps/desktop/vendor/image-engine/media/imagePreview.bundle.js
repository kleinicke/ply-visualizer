import {
  C as os,
  D as xi,
  b as qo,
  c as ya,
  d as va,
  e as Ko,
  g as yi,
  h as dn,
  i as gt,
  j as Tt,
  k as as,
  l as rs,
  m as Jo,
  p as Zo,
  q as Xn,
  r as xa,
  u as ss,
  x as dl,
} from './chunks/chunk-RKUAQ6AC.js';
import {
  a as Qo,
  b as vi,
  c as el,
  d as ne,
  e as wa,
  f as Ln,
  g as tl,
  h as Ma,
  i as rl,
  j as Ca,
  k as sl,
  m as ol,
  n as ll,
  o as cl,
  q as kt,
  r as St,
  s as bt,
  t as rt,
  u as ul,
} from './chunks/chunk-JGPZW56V.js';
import { b as nl, h as il, i as al, j as ht } from './chunks/chunk-W2ORCHQ2.js';
import './chunks/chunk-Y6SLVHK3.js';
function hl() {
  return { message() {} };
}
function ls(l, e, t) {
  return (
    !!l &&
    typeof e == 'string' &&
    typeof t == 'string' &&
    l.extensionVersion === e &&
    l.vscodeVersion === t
  );
}
function cs(l, e, t) {
  return { ...l, extensionVersion: e, vscodeVersion: t };
}
var ka = class {
  constructor() {
    ((this._settings = this._loadSettings()),
      (this._constants = {
        PIXELATION_THRESHOLD: 3,
        SCALE_PINCH_FACTOR: 0.075,
        MAX_SCALE: 200,
        MIN_SCALE: 0.1,
        ZOOM_LEVELS: [
          0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.5, 2, 3, 5, 7, 10, 15, 20, 30, 50, 70,
          100, 200,
        ],
      }),
      (this._isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0));
  }
  _loadSettings() {
    let e = document.getElementById('image-preview-settings');
    if (e) {
      let t = e.getAttribute('data-settings');
      if (t) return JSON.parse(t);
    }
    throw new Error('Could not load settings');
  }
  get settings() {
    return this._settings;
  }
  get constants() {
    return this._constants;
  }
  get isMac() {
    return this._isMac;
  }
  updateSettings(e) {
    if (!e) return { changed: !1, changedKeys: [], parametersOnly: !1, changedStructure: !1 };
    let t = { changed: !1, changedKeys: [], parametersOnly: !1, changedStructure: !1 },
      n = this._settings,
      i = e.gamma !== void 0 && JSON.stringify(n.gamma) !== JSON.stringify(e.gamma),
      a = e.brightness !== void 0 && JSON.stringify(n.brightness) !== JSON.stringify(e.brightness),
      r =
        e.normalization !== void 0 &&
        (n.normalization?.min !== e.normalization.min ||
          n.normalization?.max !== e.normalization.max),
      s =
        e.normalization !== void 0 &&
        n.normalization?.autoNormalize !== e.normalization.autoNormalize,
      o = e.normalization !== void 0 && n.normalization?.gammaMode !== e.normalization.gammaMode,
      h = e.rgbAs24BitGrayscale !== void 0 && n.rgbAs24BitGrayscale !== e.rgbAs24BitGrayscale,
      u = e.scale24BitFactor !== void 0 && n.scale24BitFactor !== e.scale24BitFactor,
      d = e.normalizedFloatMode !== void 0 && n.normalizedFloatMode !== e.normalizedFloatMode,
      m = e.nanColor !== void 0 && (n.nanColor ?? 'black') !== e.nanColor,
      p = e.displayColormap !== void 0 && (n.displayColormap ?? 'none') !== e.displayColormap,
      v = e.gpuAcceleration !== void 0 && (n.gpuAcceleration ?? !0) !== e.gpuAcceleration,
      g = e.debayer !== void 0 && JSON.stringify(n.debayer ?? null) !== JSON.stringify(e.debayer),
      w =
        e.colorPickerShowModified !== void 0 &&
        n.colorPickerShowModified !== e.colorPickerShowModified,
      k = [
        [i, 'gamma'],
        [a, 'brightness'],
        [r, 'normalization.range'],
        [s, 'normalization.auto'],
        [o, 'normalization.gammaMode'],
        [h, 'rgbAs24BitGrayscale'],
        [u, 'scale24BitFactor'],
        [d, 'normalizedFloatMode'],
        [m, 'nanColor'],
        [p, 'displayColormap'],
        [g, 'debayer'],
        [v, 'gpuAcceleration'],
        [w, 'colorPickerShowModified'],
      ];
    return (
      (t.changedKeys = k.filter(([E]) => E).map(([, E]) => E)),
      (t.changed = t.changedKeys.length > 0),
      (h || u || d || v) && (t.changedStructure = !0),
      t.changed && (i || a || r || s || o || m || p || g || w) && !h && !u && !d && !v
        ? (t.parametersOnly = !0)
        : t.changedStructure &&
          console.log('\u26A0\uFE0F Structural changes detected:', {
            rgbModeChanged: h,
            scaleModeChanged: u,
            floatModeChanged: d,
            nanColorChanged: m,
          }),
      (this._settings = {
        ...this._settings,
        ...e,
        normalization: e.normalization ? { ...e.normalization } : this._settings.normalization,
        gamma: e.gamma ? { ...e.gamma } : this._settings.gamma,
        brightness: e.brightness ? { ...e.brightness } : this._settings.brightness,
      }),
      t
    );
  }
};
function ml(l, e, t) {
  let n = Math.max(0, Math.min(Math.floor(l.x), Math.max(0, e - 1))),
    i = Math.max(0, Math.min(Math.floor(l.y), Math.max(0, t - 1)));
  return {
    x: n,
    y: i,
    width: Math.max(1, Math.min(Math.ceil(l.width), e - n)),
    height: Math.max(1, Math.min(Math.ceil(l.height), t - i)),
  };
}
function us(l, e, t, n, i, a) {
  return n > 0
    ? ml({ x: i / n, y: a / n, width: e / n, height: t / n }, l.imageWidth, l.imageHeight)
    : { x: 0, y: 0, width: l.imageWidth, height: l.imageHeight };
}
function Ld(l, e, t = 0.5) {
  let n = l.width * t,
    i = l.height * t,
    a = Math.max(0, l.x - n / 2),
    r = Math.max(0, l.y - i / 2);
  return ml({ x: a, y: r, width: l.width + n, height: l.height + i }, e.imageWidth, e.imageHeight);
}
function ds(l, e) {
  let t = Math.max(1, e.blockWidth),
    n = Math.max(1, e.blockHeight),
    i = Math.floor(l.x / t) * t,
    a = Math.floor(l.y / n) * n,
    r = Math.min(e.imageWidth, Math.ceil((l.x + l.width) / t) * t),
    s = Math.min(e.imageHeight, Math.ceil((l.y + l.height) / n) * n);
  return { x: i, y: a, width: Math.max(1, r - i), height: Math.max(1, s - a) };
}
function Td(l, e) {
  return (
    e.x >= l.x && e.y >= l.y && e.x + e.width <= l.x + l.width && e.y + e.height <= l.y + l.height
  );
}
function _d(l, e) {
  return !l || !e
    ? l === e
    : l.x === e.x && l.y === e.y && l.width === e.width && l.height === e.height;
}
function fl(l, e, t, n = 0.5, i = 0.6) {
  let a = l.imageWidth * l.imageHeight;
  if (a <= 0) return { kind: 'whole-page' };
  if ((e.width * e.height) / a >= i) return { kind: 'whole-page' };
  if (t && Td(t, e)) return { kind: 'keep' };
  let r = ds(Ld(e, l, n), l);
  return t && _d(t, r)
    ? { kind: 'keep' }
    : r.width * r.height >= a
      ? { kind: 'whole-page' }
      : { kind: 'region', rect: r };
}
function pl(l) {
  let e = window.__tiffVisualizerBootstrap?.nativeImage;
  return e instanceof HTMLImageElement && (e.src === l || e.currentSrc === l) ? e : null;
}
var wi = class {
  constructor(e, t) {
    ((this.settingsManager = e),
      (this.vscode = t),
      (this._lastRaw = null),
      (this._pendingRenderData = null),
      (this._isInitialLoad = !0),
      (this._cachedStats = void 0),
      (this._cachedStatsRgb24Mode = !1),
      (this._lastRenderReusedOriginalImageData = !1),
      (this._lastRenderUsedWebGL = !1),
      (this._webglRenderer = new ul()),
      (this._lazyNativeReadback = null),
      (this.loadSignal = void 0),
      (this.decodeWorker = null),
      (this._lastAllTags = []),
      (this.onMetadataTagsReady = null));
  }
  async processPng(e) {
    let t = this.loadSignal,
      n = e.toLowerCase().includes('.jpg') || e.toLowerCase().includes('.jpeg');
    if (((this._lastAllTags = []), n)) {
      let i = await this._processWithNativeAPI(e);
      return (t?.aborted || this._scheduleJpegExifTags(e, t), i);
    }
    try {
      ((this._cachedStats = void 0), (this._cachedStatsRgb24Mode = !1));
      let i = await rt.fetchArrayBuffer(e, t, 'png'),
        { exifBlob: a, textEntries: r } = await al(new Uint8Array(i));
      if (
        ((this._lastAllTags = r.map(({ name: E, value: L }) => ({
          tag: null,
          name: E,
          group: 'PNG',
          value: L,
        }))),
        a && this._scheduleEmbeddedExifTags(a.slice(), t, !0),
        t?.aborted)
      )
        throw new DOMException('Load superseded', 'AbortError');
      let s = this._detectPngBitDepth(i);
      if (s === 8 || s === null)
        return this._processWithNativeAPI(e, i, this._detectPngChannels(i));
      if ((await this.decodeWorker?.start(), t?.aborted))
        throw new DOMException('Load superseded', 'AbortError');
      let o = await rt.decodeWithFallback(this.decodeWorker, 'png16', i, e, t, async () => {
        throw new Error('Precise PNG decoding failed in the Rust decoder');
      });
      o.wasmFallbackReason &&
        console.warn('[PngProcessor] Rust PNG decoder fell back to UPNG:', o.wasmFallbackReason);
      let h = o.width,
        u = o.height,
        d = o.depth,
        m = o.ctype,
        p;
      switch (m) {
        case 0:
          p = 1;
          break;
        case 2:
          p = 3;
          break;
        case 3:
          p = 3;
          break;
        case 4:
          p = 2;
          break;
        case 6:
          p = 4;
          break;
        default:
          p = 3;
      }
      let v;
      if (m === 3) {
        let E = (await nl()).toRGBA8(o);
        ((v = new Uint8Array(E[0])), (p = 4), (d = 8));
      } else if (d === 16)
        if (o.decodedData instanceof Uint16Array) v = o.decodedData;
        else {
          let E = performance.now(),
            L = new Uint8Array(o.data),
            M = new Uint16Array(L.length / 2),
            T = 0;
          for (let _ = 0; _ < M.length; _++, T += 2) M[_] = (L[T] << 8) | L[T + 1];
          (ne.detail('png16-main-byte-swap', performance.now() - E), (v = M));
        }
      else v = new Uint8Array(o.data);
      this._lastRaw = {
        width: h,
        height: u,
        data: v,
        channels: p,
        bitDepth: d,
        maxValue: d === 16 ? 65535 : 255,
        isRgbaFormat: !1,
      };
      let g = document.createElement('canvas');
      ((g.width = h), (g.height = u));
      let w = pl(e);
      if (w && this.canDisplayNativeForSettings(this.settingsManager.settings))
        return (
          this._postFormatInfo(h, u, p, d, 'PNG'),
          (this._pendingRenderData = !1),
          (this._isInitialLoad = !1),
          { canvas: g, imageData: null, canvasAlreadyRendered: !0, displayElement: w }
        );
      if (this._isInitialLoad) {
        (this._postFormatInfo(h, u, p, s, 'PNG'), (this._pendingRenderData = !0));
        let E = new ImageData(h, u);
        return { canvas: g, imageData: E };
      }
      this._postFormatInfo(h, u, p, d, 'PNG');
      let k = this._renderToImageData();
      return (this.vscode.postMessage({ type: 'refresh-status' }), { canvas: g, imageData: k });
    } catch (i) {
      throw i;
    }
  }
  _scheduleJpegExifTags(e, t) {
    let n = () => {
        t?.aborted || this._loadJpegExifTags(e, t);
      },
      i = globalThis.requestIdleCallback;
    i ? i(n, { timeout: 1e3 }) : setTimeout(n, 250);
  }
  _scheduleEmbeddedExifTags(e, t, n) {
    let i = async () => {
        if (!t?.aborted)
          try {
            let { extractExifTagsFromBlob: r } =
                await import('./chunks/tiff-wasm-wrapper-RCEFXZ3G.js'),
              s = await r(e);
            if (t?.aborted) return;
            ((this._lastAllTags = n ? [...this._lastAllTags, ...s] : s),
              this.onMetadataTagsReady?.());
          } catch (r) {
            console.warn('[PngProcessor] Failed to read embedded Exif tags:', r);
          }
      },
      a = globalThis.requestIdleCallback;
    a
      ? a(
          () => {
            i();
          },
          { timeout: 1e3 }
        )
      : setTimeout(() => {
          i();
        }, 250);
  }
  async _loadJpegExifTags(e, t) {
    try {
      let n = await rt.fetchArrayBuffer(e, t, 'jpeg-exif');
      if (t?.aborted) return;
      let i = il(new Uint8Array(n));
      if (!i) return;
      this._scheduleEmbeddedExifTags(i.slice(), t, !1);
    } catch (n) {
      console.warn('[PngProcessor] Failed to read JPEG Exif tags:', n);
    }
  }
  async _processWithNativeAPI(e, t, n) {
    let i = e.toLowerCase(),
      a = i.includes('.jpg') || i.includes('.jpeg'),
      r = pl(e),
      s = r || new Image(),
      o = document.createElement('canvas');
    o.classList.add('scale-to-fit');
    let h = o.getContext('2d', { willReadFrequently: !0 });
    if (!h) throw new Error('Could not get canvas context');
    let u = t && !r ? URL.createObjectURL(new Blob([t], { type: 'image/png' })) : null,
      d = () => {
        u && URL.revokeObjectURL(u);
      };
    return new Promise((m, p) => {
      let v = !1,
        g = () => {
          if (!v) {
            v = !0;
            try {
              ((o.width = s.naturalWidth), (o.height = s.naturalHeight));
              let k = i.includes('.png') ? 'PNG' : a ? 'JPEG' : 'Image';
              if (a && (r || o.width * o.height > 1e5)) {
                (s.classList.add('scale-to-fit'),
                  (this._lastRaw = null),
                  (this._cachedStats = void 0),
                  (this._cachedStatsRgb24Mode = !1),
                  (this._lazyNativeReadback = {
                    image: s,
                    canvas: o,
                    ctx: h,
                    width: o.width,
                    height: o.height,
                    format: 'JPEG',
                  }),
                  this._postFormatInfo(o.width, o.height, 3, 8, 'JPEG'),
                  (this._pendingRenderData = !1),
                  (this._isInitialLoad = !1),
                  m({
                    canvas: o,
                    imageData: null,
                    canvasAlreadyRendered: !0,
                    lazyPixelData: !0,
                    displayElement: s,
                  }));
                return;
              }
              h.drawImage(s, 0, 0);
              let E = h.getImageData(0, 0, o.width, o.height),
                L = E.data,
                M = !1;
              if (!a) {
                for (let _ = 3; _ < L.length; _ += 4)
                  if (L[_] < 255) {
                    M = !0;
                    break;
                  }
              }
              ((this._cachedStats = void 0),
                (this._cachedStatsRgb24Mode = !1),
                (this._lastRaw = {
                  width: o.width,
                  height: o.height,
                  data: L,
                  channels: 4,
                  sourceChannels: n ?? void 0,
                  bitDepth: 8,
                  maxValue: 255,
                  isRgbaFormat: !0,
                  hasAlpha: M,
                  originalImageData: E,
                }));
              let T = a ? 3 : n || (M ? 4 : 3);
              if (
                (this._postFormatInfo(o.width, o.height, T, 8, k),
                r && this.canDisplayNativeForSettings(this.settingsManager.settings))
              ) {
                ((this._pendingRenderData = !1),
                  (this._isInitialLoad = !1),
                  m({ canvas: o, imageData: null, canvasAlreadyRendered: !0, displayElement: s }));
                return;
              }
              ((this._pendingRenderData = !0),
                m({ canvas: o, imageData: E, canvasAlreadyRendered: !0 }));
            } catch (k) {
              p(k);
            } finally {
              d();
            }
          }
        },
        w = () => {
          v || ((v = !0), d(), p(new Error('Failed to load image')));
        };
      (s.addEventListener('load', g, { once: !0 }),
        s.addEventListener('error', w, { once: !0 }),
        r?.complete
          ? queueMicrotask(() => (r.naturalWidth > 0 ? g() : w()))
          : r || (s.src = u || e));
    });
  }
  canDisplayNativeForSettings(e) {
    let t = e.normalization?.gammaMode || !1,
      n = kt.isIdentityTransformation(e),
      i = e.rgbAs24BitGrayscale === !0,
      a = !!e.displayColormap && e.displayColormap !== 'none';
    return t && n && !i && !a;
  }
  _renderToImageData(e = {}) {
    if (!this._lastRaw) return new ImageData(1, 1);
    ((this._lastRenderReusedOriginalImageData = !1), (this._lastRenderUsedWebGL = !1));
    let {
        width: t,
        height: n,
        data: i,
        channels: a,
        bitDepth: r,
        maxValue: s,
        originalImageData: o,
      } = this._lastRaw,
      h = this.settingsManager.settings,
      u = !1,
      d = kt.isIdentityTransformation(h),
      m = h.normalization?.gammaMode || !1,
      p = h.rgbAs24BitGrayscale && a >= 3;
    if (o && m && d && !p && r === 8) return ((this._lastRenderReusedOriginalImageData = !0), o);
    this._cachedStatsRgb24Mode !== p && (this._cachedStats = void 0);
    let v = this._cachedStats;
    (!v &&
      kt.needsStats(h) &&
      ((v = St.calculateIntegerStats(i, t, n, a, p)),
      (this._cachedStats = v),
      (this._cachedStatsRgb24Mode = p),
      this.vscode && this.vscode.postMessage({ type: 'stats', value: v })),
      m && !v && (v = { min: 0, max: p ? 16777215 : s }));
    let g = { rgbAs24BitGrayscale: h.rgbAs24BitGrayscale && a >= 3, typeMax: p ? 16777215 : s },
      w = p ? 16777215 : s;
    return e.targetCanvas &&
      this._webglRenderer.canRender({
        data: i,
        width: t,
        height: n,
        channels: a,
        isFloat: !1,
        settings: h,
      }) &&
      this._webglRenderer.render(e.targetCanvas, {
        data: i,
        width: t,
        height: n,
        channels: a,
        isFloat: !1,
        min: v && Number.isFinite(v.min) ? v.min : 0,
        max: v && Number.isFinite(v.max) ? v.max : w,
        typeMax: w,
        settings: h,
        nanColor: { r: 0, g: 0, b: 0 },
      })
      ? ((this._lastRenderUsedWebGL = !0), e.placeholderImageData || new ImageData(t, n))
      : bt.render(i, t, n, a, u, v, h, g);
  }
  hasLazyNativeReadback() {
    return !!this._lazyNativeReadback;
  }
  canUseLazyNativeCanvasForSettings(e) {
    return this._lazyNativeReadback ? this.canDisplayNativeForSettings(e) : !1;
  }
  _ensureLazyNativeImageData() {
    if (this._lastRaw?.originalImageData) return this._lastRaw.originalImageData;
    if (!this._lazyNativeReadback) return null;
    let { image: e, canvas: t, ctx: n } = this._lazyNativeReadback;
    n.drawImage(e, 0, 0);
    let i = n.getImageData(0, 0, t.width, t.height);
    return (
      (this._lastRaw = {
        width: t.width,
        height: t.height,
        data: i.data,
        channels: 4,
        bitDepth: 8,
        maxValue: 255,
        isRgbaFormat: !0,
        hasAlpha: !1,
        originalImageData: i,
      }),
      (this._lazyNativeReadback = null),
      i
    );
  }
  getLazyNativeHistogramImageData(e = 1e6) {
    if (!this._lazyNativeReadback) return null;
    let { image: t, width: n, height: i } = this._lazyNativeReadback,
      a = n * i,
      r = a > e ? Math.sqrt(e / a) : 1,
      s = Math.max(1, Math.round(n * r)),
      o = Math.max(1, Math.round(i * r)),
      h = document.createElement('canvas');
    ((h.width = s), (h.height = o));
    let u = h.getContext('2d', { willReadFrequently: !0 });
    return u ? (u.drawImage(t, 0, 0, s, o), u.getImageData(0, 0, s, o)) : null;
  }
  renderPngWithSettings(e = {}) {
    return !this._lastRaw && !this._ensureLazyNativeImageData() ? null : this._renderToImageData(e);
  }
  getColorAtPixel(e, t, n, i) {
    if (!this._lastRaw && this._lazyNativeReadback) {
      let k = this._lazyNativeReadback;
      if (
        k.width !== n ||
        k.height !== i ||
        (k.tempCanvas ||
          ((k.tempCanvas = document.createElement('canvas')),
          (k.tempCanvas.width = 1),
          (k.tempCanvas.height = 1),
          (k.tempCtx = k.tempCanvas.getContext('2d', { willReadFrequently: !0 }))),
        !k.tempCtx)
      )
        return '';
      (k.tempCtx.clearRect(0, 0, 1, 1), k.tempCtx.drawImage(k.image, e, t, 1, 1, 0, 0, 1, 1));
      let E = k.tempCtx.getImageData(0, 0, 1, 1).data;
      return `${E[0].toString().padStart(3, '0')} ${E[1].toString().padStart(3, '0')} ${E[2].toString().padStart(3, '0')}`;
    }
    if (!this._lastRaw) return '';
    let {
      width: a,
      height: r,
      data: s,
      channels: o,
      bitDepth: h,
      maxValue: u,
      hasAlpha: d,
      sourceChannels: m,
      isRgbaFormat: p,
    } = this._lastRaw;
    if (a !== n || r !== i) return '';
    let g = (t * a + e) * o,
      w = this.settingsManager.settings;
    if (g >= 0 && g < s.length) {
      if ((o === 1 || (p && m === 1)) && !d) {
        let E = s[g];
        return w.normalizedFloatMode ? (E / u).toPrecision(4) : E.toString();
      } else if (o === 2 || (p && (m === 1 || m === 2))) {
        let E = h === 16 ? 65535 : 255,
          L = s[g],
          M = s[g + (p ? 3 : 1)];
        return `${L} \u03B1:${(M / E).toFixed(2)}`;
      } else if (o === 3 || o === 4) {
        let E = s[g],
          L = s[g + 1],
          M = s[g + 2];
        if (w.rgbAs24BitGrayscale && o >= 3) {
          let _ = h === 16 ? Math.round(E / 257) : E,
            I = h === 16 ? Math.round(L / 257) : L,
            A = h === 16 ? Math.round(M / 257) : M,
            N = (_ << 16) | (I << 8) | A,
            z = w.scale24BitFactor || 1e3,
            X = (N / z).toFixed(3);
          if (o === 4 && d !== !1) {
            let ae = h === 16 ? 65535 : 255,
              Q = s[g + 3];
            return `${X} \u03B1:${(Q / ae).toFixed(2)}`;
          } else return X;
        }
        if (o === 4 && d !== !1) {
          let _ = h === 16 ? 65535 : 255,
            I = s[g + 3];
          return h === 16
            ? `${E} ${L} ${M} \u03B1:${(I / _).toFixed(2)}`
            : `${E.toString().padStart(3, '0')} ${L.toString().padStart(3, '0')} ${M.toString().padStart(3, '0')} \u03B1:${(I / _).toFixed(2)}`;
        } else
          return h === 16
            ? `${E} ${L} ${M}`
            : `${E.toString().padStart(3, '0')} ${L.toString().padStart(3, '0')} ${M.toString().padStart(3, '0')}`;
      }
    }
    return '';
  }
  _postFormatInfo(e, t, n, i, a) {
    if (!this.vscode) return;
    let r = a === 'JPEG' ? 'jpg' : 'png';
    this.vscode.postMessage({
      type: 'formatInfo',
      value: {
        width: e,
        height: t,
        compression: 'Deflate',
        predictor: 1,
        photometricInterpretation: n >= 3 ? 2 : 1,
        planarConfig: 1,
        samplesPerPixel: n,
        bitsPerSample: i,
        sampleFormat: 1,
        formatLabel: `${a} (${i}-bit)`,
        formatType: r,
        isInitialLoad: this._isInitialLoad,
      },
    });
  }
  performDeferredRender(e = {}) {
    if (!this._pendingRenderData || !this._lastRaw) return null;
    ((this._pendingRenderData = null),
      (this._isInitialLoad = !1),
      ne.mark('png-deferred-render-start'));
    let t = this._renderToImageData(e);
    return (this.vscode.postMessage({ type: 'refresh-status' }), t);
  }
  _detectPngBitDepth(e) {
    try {
      let t = new Uint8Array(e);
      return t.length < 8 || t[0] !== 137 || t[1] !== 80 || t[2] !== 78 || t[3] !== 71
        ? (console.warn('PNG: Invalid PNG signature'), null)
        : t[24];
    } catch (t) {
      return (console.error('PNG: Failed to detect bit depth:', t), null);
    }
  }
  _detectPngChannels(e) {
    let t = new Uint8Array(e);
    return t.length < 26 || t[0] !== 137 || t[1] !== 80 || t[2] !== 78 || t[3] !== 71
      ? null
      : ({ 0: 1, 2: 3, 3: 3, 4: 2, 6: 4 }[t[25]] ?? null);
  }
};
var Sa = class {
  _checkHeader() {
    let l = this.header;
    if (l.imageType === 0) throw Error('No data');
    if (l.hasColorMap) {
      if (l.colorMapLength > 256 || l.colorMapDepth !== 24 || l.colorMapType !== 1)
        throw Error('Invalid colormap for indexed type');
    } else if (l.colorMapType) throw Error('Why does the image contain a palette ?');
    if (!l.width || !l.height) throw Error('Invalid image size');
    if (l.pixelDepth !== 8 && l.pixelDepth !== 16 && l.pixelDepth !== 24 && l.pixelDepth !== 32)
      throw Error('Invalid pixel size "' + l.pixelDepth + '"');
  }
  _decodeRLE(l, e, t, n) {
    let i = new Uint8Array(n),
      a = new Uint8Array(t),
      r = 0;
    for (; r < n;) {
      let s = l[e++],
        o = 1 + (127 & s);
      if (128 & s) {
        for (let h = 0; h < t; ++h) a[h] = l[e + h];
        e += t;
        for (let h = 0; h < o; ++h) (i.set(a, r), (r += t));
      } else {
        o *= t;
        for (let h = 0; h < o; ++h) i[r + h] = l[e + h];
        ((r += o), (e += o));
      }
    }
    return i;
  }
  _getImageData8bits(l, e, t, n, i, a, r, s, o, h) {
    for (let u = 0, d = i; d !== r; d += a)
      for (let m = s; m !== h; m += o, u++) {
        let p = e[u];
        ((l[4 * (m + n * d) + 3] = 255),
          (l[4 * (m + n * d) + 2] = t[3 * p + 0]),
          (l[4 * (m + n * d) + 1] = t[3 * p + 1]),
          (l[4 * (m + n * d) + 0] = t[3 * p + 2]));
      }
    return l;
  }
  _getImageData16bits(l, e, t, n, i, a, r, s, o, h) {
    for (let u = 0, d = i; d !== r; d += a)
      for (let m = s; m !== h; m += o, u += 2) {
        let p = e[u + 0] | (e[u + 1] << 8);
        ((l[4 * (m + n * d) + 0] = (31744 & p) >> 7),
          (l[4 * (m + n * d) + 1] = (992 & p) >> 2),
          (l[4 * (m + n * d) + 2] = (31 & p) >> 3),
          (l[4 * (m + n * d) + 3] = 32768 & p ? 0 : 255));
      }
    return l;
  }
  _getImageData24bits(l, e, t, n, i, a, r, s, o, h) {
    for (let u = 0, d = i; d !== r; d += a)
      for (let m = s; m !== h; m += o, u += 3)
        ((l[4 * (m + n * d) + 3] = 255),
          (l[4 * (m + n * d) + 2] = e[u + 0]),
          (l[4 * (m + n * d) + 1] = e[u + 1]),
          (l[4 * (m + n * d) + 0] = e[u + 2]));
    return l;
  }
  _getImageData32bits(l, e, t, n, i, a, r, s, o, h) {
    for (let u = 0, d = i; d !== r; d += a)
      for (let m = s; m !== h; m += o, u += 4)
        ((l[4 * (m + n * d) + 2] = e[u + 0]),
          (l[4 * (m + n * d) + 1] = e[u + 1]),
          (l[4 * (m + n * d) + 0] = e[u + 2]),
          (l[4 * (m + n * d) + 3] = e[u + 3]));
    return l;
  }
  _getImageDataGrey8bits(l, e, t, n, i, a, r, s, o, h) {
    for (let u = 0, d = i; d !== r; d += a)
      for (let m = s; m !== h; m += o, u++) {
        let p = e[u];
        ((l[4 * (m + n * d) + 0] = p),
          (l[4 * (m + n * d) + 1] = p),
          (l[4 * (m + n * d) + 2] = p),
          (l[4 * (m + n * d) + 3] = 255));
      }
    return l;
  }
  _getImageDataGrey16bits(l, e, t, n, i, a, r, s, o, h) {
    for (let u = 0, d = i; d !== r; d += a)
      for (let m = s; m !== h; m += o, u += 2)
        ((l[4 * (m + n * d) + 0] = e[u + 0]),
          (l[4 * (m + n * d) + 1] = e[u + 0]),
          (l[4 * (m + n * d) + 2] = e[u + 0]),
          (l[4 * (m + n * d) + 3] = e[u + 1]));
    return l;
  }
  open(l, e) {
    let t = new XMLHttpRequest();
    ((t.responseType = 'arraybuffer'),
      t.open('GET', l, !0),
      (t.onload = () => {
        t.status === 200 && (this.load(new Uint8Array(t.response)), e && e());
      }),
      t.send(null));
  }
  load(l) {
    let e = 0;
    if (l.length < 18) throw Error('Not enough data to contain header');
    let t = {
      idLength: l[e++],
      colorMapType: l[e++],
      imageType: l[e++],
      colorMapIndex: l[e++] | (l[e++] << 8),
      colorMapLength: l[e++] | (l[e++] << 8),
      colorMapDepth: l[e++],
      offsetX: l[e++] | (l[e++] << 8),
      offsetY: l[e++] | (l[e++] << 8),
      width: l[e++] | (l[e++] << 8),
      height: l[e++] | (l[e++] << 8),
      pixelDepth: l[e++],
      flags: l[e++],
    };
    if (
      ((t.hasEncoding = t.imageType === 9 || t.imageType === 10 || t.imageType === 11),
      (t.hasColorMap = t.imageType === 9 || t.imageType === 1),
      (t.isGreyColor = t.imageType === 11 || t.imageType === 3),
      (this.header = t),
      this._checkHeader(),
      (e += t.idLength) >= l.length)
    )
      throw Error('No data');
    if (t.hasColorMap) {
      let r = t.colorMapLength * (t.colorMapDepth >> 3);
      ((this.palette = l.subarray(e, e + r)), (e += r));
    }
    let n = t.pixelDepth >> 3,
      i = t.width * t.height,
      a = i * n;
    t.hasEncoding
      ? (this.imageData = this._decodeRLE(l, e, n, a))
      : (this.imageData = l.subarray(e, e + (t.hasColorMap ? i : a)));
  }
  getImageData(l) {
    let { width: e, height: t, flags: n, pixelDepth: i, isGreyColor: a } = this.header,
      r = (n & 48) >> 4,
      s,
      o,
      h,
      u,
      d,
      m,
      p;
    switch (
      (l ||
        (l = document
          ? document.createElement('canvas').getContext('2d').createImageData(e, t)
          : { width: e, height: t, data: new Uint8ClampedArray(e * t * 4) }),
      r === 2 || r === 3 ? ((u = 0), (d = 1), (m = t)) : ((u = t - 1), (d = -1), (m = -1)),
      r === 2 || r === 0 ? ((s = 0), (o = 1), (h = e)) : ((s = e - 1), (o = -1), (h = -1)),
      i)
    ) {
      case 8:
        p = a ? this._getImageDataGrey8bits : this._getImageData8bits;
        break;
      case 16:
        p = a ? this._getImageDataGrey16bits : this._getImageData16bits;
        break;
      case 24:
        p = this._getImageData24bits;
        break;
      case 32:
        p = this._getImageData32bits;
    }
    return (p.call(this, l.data, this.imageData, this.palette, e, u, d, m, s, o, h), l);
  }
  getCanvas() {
    let { width: l, height: e } = this.header,
      t = document.createElement('canvas'),
      n = t.getContext('2d'),
      i = n.createImageData(l, e);
    return ((t.width = l), (t.height = e), n.putImageData(this.getImageData(i), 0, 0), t);
  }
  getDataURL(l) {
    return this.getCanvas().toDataURL(l || 'image/png');
  }
};
var Ra = class {
  constructor(e, t) {
    ((this.settingsManager = e),
      (this.vscode = t),
      (this._lastRaw = null),
      (this._pendingRenderData = null),
      (this._isInitialLoad = !0),
      (this._cachedStats = void 0),
      (this.loadSignal = void 0));
  }
  async processTga(e) {
    let t = this.loadSignal;
    try {
      this._cachedStats = void 0;
      let n = await rt.fetchArrayBuffer(e, t, 'tga');
      if (t?.aborted) throw new DOMException('Load superseded', 'AbortError');
      let i = new Sa();
      i.load(new Uint8Array(n));
      let a = i.header.width,
        r = i.header.height,
        s = i.header.pixelDepth,
        o = i.header.isGreyColor,
        h = new ImageData(a, r);
      i.getImageData(h);
      let u = s === 32 || (o && s === 16);
      this._lastRaw = {
        width: a,
        height: r,
        data: h.data,
        channels: 4,
        bitDepth: 8,
        maxValue: 255,
        originalBitDepth: s,
        originalIsGrey: o,
        hasAlpha: u,
        originalImageData: h,
      };
      let d = document.createElement('canvas');
      ((d.width = a), (d.height = r));
      let m = o ? 1 : u ? 4 : 3;
      if (this._isInitialLoad)
        return (
          this._postFormatInfo(a, r, m, s),
          (this._pendingRenderData = !0),
          { canvas: d, imageData: new ImageData(1, 1) }
        );
      this._postFormatInfo(a, r, m, s);
      let p = this._renderToImageData();
      return (
        this.vscode && this.vscode.postMessage({ type: 'refresh-status' }),
        { canvas: d, imageData: p }
      );
    } catch (n) {
      let i = n instanceof Error ? n.message : String(n);
      throw new Error(`Failed to process TGA image: ${i}`);
    }
  }
  _renderToImageData() {
    if (!this._lastRaw) return new ImageData(1, 1);
    let { width: e, height: t, data: n, channels: i, originalImageData: a } = this._lastRaw,
      r = this.settingsManager.settings,
      s = kt.isIdentityTransformation(r),
      o = r.normalization?.gammaMode || !1,
      h = r.rgbAs24BitGrayscale && i >= 3;
    if (a && o && s && !h) return a;
    let u = this._cachedStats;
    return (
      !u &&
        !o &&
        ((u = St.calculateIntegerStats(n, e, t, i)),
        (this._cachedStats = u),
        this.vscode && this.vscode.postMessage({ type: 'stats', value: u })),
      o && !u && (u = { min: 0, max: 255 }),
      bt.render(n, e, t, i, !1, u, r, { rgbAs24BitGrayscale: h, typeMax: 255 })
    );
  }
  renderTgaWithSettings() {
    return this._lastRaw ? this._renderToImageData() : null;
  }
  getColorAtPixel(e, t, n, i) {
    if (!this._lastRaw) return '';
    let {
      width: a,
      height: r,
      data: s,
      originalBitDepth: o,
      originalIsGrey: h,
      hasAlpha: u,
    } = this._lastRaw;
    if (a !== n || r !== i) return '';
    let m = (t * a + e) * 4,
      p = this.settingsManager.settings;
    if (m < 0 || m + 3 >= s.length) return '';
    let v = s[m],
      g = s[m + 1],
      w = s[m + 2],
      k = s[m + 3];
    if (h) return u ? `${v} \u03B1:${(k / 255).toFixed(2)}` : v.toString();
    if (p.rgbAs24BitGrayscale) {
      let E = (v << 16) | (g << 8) | w,
        L = p.scale24BitFactor || 1e3,
        M = (E / L).toFixed(3);
      return u ? `${M} \u03B1:${(k / 255).toFixed(2)}` : M;
    }
    return u
      ? `${v.toString().padStart(3, '0')} ${g.toString().padStart(3, '0')} ${w.toString().padStart(3, '0')} \u03B1:${(k / 255).toFixed(2)}`
      : `${v.toString().padStart(3, '0')} ${g.toString().padStart(3, '0')} ${w.toString().padStart(3, '0')}`;
  }
  _getNanColor(e) {
    return vi(e);
  }
  _postFormatInfo(e, t, n, i) {
    this.vscode &&
      this.vscode.postMessage({
        type: 'formatInfo',
        value: {
          width: e,
          height: t,
          compression: 'None/RLE',
          predictor: 1,
          photometricInterpretation: n >= 3 ? 2 : 1,
          planarConfig: 1,
          samplesPerPixel: n,
          bitsPerSample: i,
          sampleFormat: 1,
          formatLabel: `TGA (${i}-bit)`,
          formatType: 'tga',
          isInitialLoad: this._isInitialLoad,
        },
      });
  }
  performDeferredRender() {
    if (!this._pendingRenderData || !this._lastRaw) return null;
    ((this._pendingRenderData = null), (this._isInitialLoad = !1));
    let e = this._renderToImageData();
    return (this.vscode && this.vscode.postMessage({ type: 'refresh-status' }), e);
  }
};
function Pd(l) {
  let e = window.__tiffVisualizerBootstrap?.nativeImage;
  return e instanceof HTMLImageElement && (e.src === l || e.currentSrc === l) ? e : null;
}
var Ea = class {
  constructor(e, t) {
    ((this.settingsManager = e),
      (this.vscode = t),
      (this._lastRaw = null),
      (this._pendingRenderData = null),
      (this._isInitialLoad = !0),
      (this._cachedStats = void 0),
      (this.loadSignal = void 0));
  }
  async processWebImage(e) {
    let t = e.toLowerCase(),
      n = 'WebP',
      i = 'webp';
    (t.includes('.avif')
      ? ((n = 'AVIF'), (i = 'avif'))
      : t.includes('.bmp')
        ? ((n = 'BMP'), (i = 'bmp'))
        : t.includes('.ico') && ((n = 'ICO'), (i = 'ico')),
      (this._cachedStats = void 0));
    let a = Pd(e),
      r = a || new Image(),
      s = document.createElement('canvas'),
      o = s.getContext('2d', { willReadFrequently: !0 });
    if (!o) throw new Error('Could not get canvas context');
    return new Promise((h, u) => {
      let d = !1,
        m = () => {
          if (!d) {
            d = !0;
            try {
              ((s.width = r.naturalWidth), (s.height = r.naturalHeight), o.drawImage(r, 0, 0));
              let v = o.getImageData(0, 0, s.width, s.height),
                g = v.data,
                w = !1;
              for (let L = 3; L < g.length; L += 4)
                if (g[L] < 255) {
                  w = !0;
                  break;
                }
              if (
                ((this._lastRaw = {
                  width: s.width,
                  height: s.height,
                  data: g,
                  channels: 4,
                  bitDepth: 8,
                  maxValue: 255,
                  hasAlpha: w,
                  originalImageData: v,
                }),
                !!a &&
                  this.settingsManager.settings.normalization?.gammaMode === !0 &&
                  kt.isIdentityTransformation(this.settingsManager.settings) &&
                  this.settingsManager.settings.rgbAs24BitGrayscale !== !0 &&
                  (!this.settingsManager.settings.displayColormap ||
                    this.settingsManager.settings.displayColormap === 'none'))
              ) {
                (this._postFormatInfo(s.width, s.height, w ? 4 : 3, 8, n, i),
                  (this._pendingRenderData = !1),
                  (this._isInitialLoad = !1),
                  h({ canvas: s, imageData: null, canvasAlreadyRendered: !0, displayElement: r }));
                return;
              }
              if (this._isInitialLoad) {
                (this._postFormatInfo(s.width, s.height, w ? 4 : 3, 8, n, i),
                  (this._pendingRenderData = !0),
                  h({ canvas: s, imageData: new ImageData(s.width, s.height) }));
                return;
              }
              this._postFormatInfo(s.width, s.height, w ? 4 : 3, 8, n, i);
              let E = this._renderToImageData();
              (this.vscode && this.vscode.postMessage({ type: 'refresh-status' }),
                h({ canvas: s, imageData: E }));
            } catch (v) {
              u(v);
            }
          }
        },
        p = () => {
          d ||
            ((d = !0),
            u(
              new Error(
                `Failed to load ${n} image. Check that ${n} is supported by your VS Code/Electron version.`
              )
            ));
        };
      (r.addEventListener('load', m, { once: !0 }),
        r.addEventListener('error', p, { once: !0 }),
        a?.complete ? queueMicrotask(() => (a.naturalWidth > 0 ? m() : p())) : a || (r.src = e));
    });
  }
  _renderToImageData() {
    if (!this._lastRaw) return new ImageData(1, 1);
    let { width: e, height: t, data: n, channels: i, originalImageData: a } = this._lastRaw,
      r = this.settingsManager.settings,
      s = r.normalization?.gammaMode || !1,
      o = kt.isIdentityTransformation(r),
      h = r.rgbAs24BitGrayscale && i >= 3;
    if (a && s && o && !h) return a;
    let u = this._cachedStats;
    return (
      !u &&
        !s &&
        ((u = St.calculateIntegerStats(n, e, t, i)),
        (this._cachedStats = u),
        this.vscode && this.vscode.postMessage({ type: 'stats', value: u })),
      s && !u && (u = { min: 0, max: 255 }),
      bt.render(n, e, t, i, !1, u, r, { rgbAs24BitGrayscale: h, typeMax: 255 })
    );
  }
  renderWebImageWithSettings() {
    return this._lastRaw ? this._renderToImageData() : null;
  }
  getColorAtPixel(e, t, n, i) {
    if (!this._lastRaw) return '';
    let { width: a, height: r, data: s, hasAlpha: o } = this._lastRaw;
    if (a !== n || r !== i) return '';
    let h = (t * a + e) * 4;
    if (h < 0 || h + 3 >= s.length) return '';
    let u = s[h],
      d = s[h + 1],
      m = s[h + 2],
      p = s[h + 3],
      v = this.settingsManager.settings;
    if (v.rgbAs24BitGrayscale) {
      let g = (u << 16) | (d << 8) | m,
        w = v.scale24BitFactor || 1e3,
        k = (g / w).toFixed(3);
      return o ? `${k} \u03B1:${(p / 255).toFixed(2)}` : k;
    }
    return o
      ? `${u.toString().padStart(3, '0')} ${d.toString().padStart(3, '0')} ${m.toString().padStart(3, '0')} \u03B1:${(p / 255).toFixed(2)}`
      : `${u.toString().padStart(3, '0')} ${d.toString().padStart(3, '0')} ${m.toString().padStart(3, '0')}`;
  }
  _postFormatInfo(e, t, n, i, a, r) {
    this.vscode &&
      this.vscode.postMessage({
        type: 'formatInfo',
        value: {
          width: e,
          height: t,
          compression: r === 'bmp' ? 'None' : 'Lossy/Lossless',
          predictor: 1,
          photometricInterpretation: n >= 3 ? 2 : 1,
          planarConfig: 1,
          samplesPerPixel: n,
          bitsPerSample: i,
          sampleFormat: 1,
          formatLabel: `${a} (${i}-bit)`,
          formatType: r,
          isInitialLoad: this._isInitialLoad,
        },
      });
  }
  performDeferredRender() {
    if (!this._pendingRenderData || !this._lastRaw) return null;
    ((this._pendingRenderData = null), (this._isInitialLoad = !1));
    let e = this._renderToImageData();
    return (this.vscode && this.vscode.postMessage({ type: 'refresh-status' }), e);
  }
};
var La = class {
  constructor(e, t) {
    this.onScaleChanged = null;
    this.gestureScale = null;
    ((this.settingsManager = e), (this.vscode = t));
    let n = t.getState() || {},
      i = {
        ...n,
        scale: n.scale ?? 'fit',
        offsetX: Number.isFinite(n.offsetX) ? n.offsetX : 0,
        offsetY: Number.isFinite(n.offsetY) ? n.offsetY : 0,
      };
    ((this.scale = i.scale),
      (this.initialState = i),
      (this.container = document.body),
      (this.imageElement = null),
      (this.canvas = null),
      (this.hasLoadedImage = !1));
  }
  viewport() {
    let e = getComputedStyle(this.container),
      t = parseFloat(e.paddingLeft) || 0,
      n = parseFloat(e.paddingRight) || 0,
      i = parseFloat(e.paddingTop) || 0,
      a = parseFloat(e.paddingBottom) || 0,
      r = document.documentElement.clientWidth,
      s = document.documentElement.clientHeight;
    return { width: Math.max(1, r - t - n), height: Math.max(1, s - i - a), left: t, top: i };
  }
  setImageElement(e) {
    this.imageElement = e;
  }
  setCanvas(e) {
    this.canvas = e;
  }
  _getNaturalSize(e) {
    let t = e,
      n = Number(e.dataset?.sceneWidth),
      i = Number(e.dataset?.sceneHeight);
    return {
      width: n > 0 ? n : t.naturalWidth || t.width || 0,
      height: i > 0 ? i : t.naturalHeight || t.height || 0,
    };
  }
  setImageLoaded() {
    this.hasLoadedImage = !0;
  }
  updateScale(e) {
    if (!this.imageElement || !this.hasLoadedImage || !this.imageElement.parentElement) return;
    let t = this.settingsManager.constants,
      n = this.scale === 'fit';
    this.container.classList.contains('web-app') &&
      this.container.classList.toggle('web-image-zoomed', e !== 'fit');
    let i = this.viewport(),
      a = i.left + i.width / 2,
      r = i.top + i.height / 2;
    if (e === 'fit') {
      if (
        ((this.scale = 'fit'),
        this.imageElement.classList.add('scale-to-fit'),
        this.imageElement.classList.remove('pixelated'),
        (this.imageElement.style.transform = ''),
        (this.imageElement.style.transformOrigin = ''),
        (this.imageElement.style.width = ''),
        (this.imageElement.style.height = ''),
        (this.imageElement.style.margin = ''),
        this.imageElement.classList.contains('pyramid-scene') ||
          this.container.classList.contains('web-app'))
      ) {
        let { width: o, height: h } = this._getNaturalSize(this.imageElement),
          u = Math.min(
            this.container.classList.contains('web-app') ? 1 / 0 : 1,
            Math.max(1, i.width - 20) / o,
            Math.max(1, i.height - 20) / h
          );
        ((this.imageElement.style.width = `${o * u}px`),
          (this.imageElement.style.height = `${h * u}px`),
          (this.imageElement.style.margin = 'auto'));
      }
      window.scrollTo(0, 0);
      let s = this.vscode.getState() || {};
      this.vscode.setState({ ...s, scale: 'fit', offsetX: 0, offsetY: 0 });
    } else {
      let s = this.scale;
      ((this.scale = this._clamp(e, this._minimumScale(), t.MAX_SCALE)),
        this.scale >= t.PIXELATION_THRESHOLD
          ? this.imageElement.classList.add('pixelated')
          : this.imageElement.classList.remove('pixelated'));
      let { width: o, height: h } = this._getNaturalSize(this.imageElement),
        u = n ? this.imageElement.clientWidth / o : s,
        d = window.scrollX + a,
        m = window.scrollY + r,
        p = this.imageElement.getBoundingClientRect(),
        v = window.scrollX + p.left,
        g = window.scrollY + p.top,
        w = (d - v) / u,
        k = (m - g) / u;
      (this.imageElement.classList.remove('scale-to-fit'),
        (this.imageElement.style.transform = ''),
        (this.imageElement.style.transformOrigin = ''),
        (this.imageElement.style.width = `${o * this.scale}px`),
        (this.imageElement.style.height = `${h * this.scale}px`));
      let E = o * this.scale > i.width,
        L = h * this.scale > i.height;
      ((this.imageElement.style.marginLeft = E ? '0' : 'auto'),
        (this.imageElement.style.marginRight = E ? '0' : 'auto'),
        (this.imageElement.style.marginTop = L ? '0' : 'auto'),
        (this.imageElement.style.marginBottom = L ? '0' : 'auto'));
      let M = this.imageElement.getBoundingClientRect(),
        T = window.scrollX + M.left,
        _ = window.scrollY + M.top,
        I = w * this.scale + T - a,
        A = k * this.scale + _ - r,
        N = document.scrollingElement || this.container,
        z = Math.max(0, N.scrollWidth - document.documentElement.clientWidth),
        X = Math.max(0, N.scrollHeight - document.documentElement.clientHeight);
      ((I = Math.min(Math.max(0, I), z)), (A = Math.min(Math.max(0, A), X)), window.scrollTo(I, A));
      let ae = this.vscode.getState() || {};
      this.vscode.setState({ ...ae, scale: this.scale, offsetX: I, offsetY: A });
    }
    (this.vscode.postMessage({ type: 'zoom', value: this.scale }), this.onScaleChanged?.());
  }
  zoomIn() {
    if (!this.imageElement || !this.hasLoadedImage) return;
    this.scale === 'fit' && this.firstZoom();
    let e = this.settingsManager.constants.ZOOM_LEVELS,
      t = 0;
    for (; t < e.length && !(e[t] > this.scale); ++t);
    this.updateScale(e[t] || this.settingsManager.constants.MAX_SCALE);
  }
  zoomOut() {
    if (!this.imageElement || !this.hasLoadedImage) return;
    this.scale === 'fit' && this.firstZoom();
    let e = this.settingsManager.constants.ZOOM_LEVELS,
      t = e.length - 1;
    for (; t >= 0 && !(e[t] < this.scale); --t);
    this.updateScale(e[t] || this._minimumScale());
  }
  firstZoom() {
    if (!this.imageElement || !this.hasLoadedImage) return;
    let { width: e } = this._getNaturalSize(this.imageElement);
    ((this.scale = this.imageElement.clientWidth / e), this.updateScale(this.scale));
  }
  resetZoom() {
    this.updateScale('fit');
  }
  handleWheelZoom(e, t, n) {
    if (
      !(
        !this.imageElement ||
        !this.hasLoadedImage ||
        (!(this.settingsManager.isMac ? e.altKey || n : e.ctrlKey || t) && !e.ctrlKey)
      ) &&
      (e.preventDefault(), e.stopPropagation(), this.gestureScale === null && e.deltaY)
    )
      if (
        (this.scale === 'fit' && this.firstZoom(), this.container.classList.contains('web-app'))
      ) {
        let a = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? this.viewport().height : 1,
          r = Math.max(-100, Math.min(100, e.deltaY * a));
        this.updateScale(this.scale * Math.exp(-r * (e.ctrlKey ? 0.01 : 0.0025)));
      } else {
        let a = e.deltaY > 0 ? 1 : -1;
        this.updateScale(this.scale * (1 - a * this.settingsManager.constants.SCALE_PINCH_FACTOR));
      }
  }
  handleGesture(e) {
    if (!(!this.imageElement || !this.hasLoadedImage)) {
      if ((e.preventDefault(), e.type === 'gestureend')) {
        this.gestureScale = null;
        return;
      }
      if (e.type === 'gesturestart') {
        this.gestureScale =
          this.imageElement.clientWidth / this._getNaturalSize(this.imageElement).width;
        return;
      }
      this.gestureScale !== null &&
        Number.isFinite(e.scale) &&
        e.scale > 0 &&
        this.updateScale(this.gestureScale * e.scale);
    }
  }
  applyInitialZoom() {
    (this.updateScale(this.scale),
      this.initialState.scale !== 'fit' &&
        window.scrollTo(this.initialState.offsetX, this.initialState.offsetY));
  }
  saveState() {
    let e = this.vscode.getState() || {};
    this.vscode.setState({
      ...e,
      scale: this.scale,
      offsetX: window.scrollX,
      offsetY: window.scrollY,
    });
  }
  getCurrentState() {
    return { scale: this.scale, x: window.scrollX, y: window.scrollY };
  }
  restoreState(e) {
    e &&
      e.scale !== void 0 &&
      (this.updateScale(e.scale),
      e.x !== void 0 &&
        e.y !== void 0 &&
        requestAnimationFrame(() => {
          window.scrollTo(e.x, e.y);
        }));
  }
  _minimumScale() {
    let e = this.settingsManager.constants;
    if (!this.imageElement) return e.MIN_SCALE;
    let { width: t, height: n } = this._getNaturalSize(this.imageElement);
    if (!(t > 0 && n > 0)) return e.MIN_SCALE;
    let i = Math.min(this.container.clientWidth / t, this.container.clientHeight / n);
    return i > 0 ? Math.min(e.MIN_SCALE, i / 2) : e.MIN_SCALE;
  }
  _clamp(e, t, n) {
    return Math.min(Math.max(e, t), n);
  }
};
var Ta = class {
  constructor(e, t, n) {
    this.coordinateScale = 1;
    this._storedValueUnavailable = !1;
    this.storedValueResolver = null;
    this._immediateStoredValueResolver = null;
    this._storedValuesOnly = !1;
    this._upgradeApproximateStoredValues = !0;
    this._storedValuePixel = '';
    this._storedValueInFlight = !1;
    this._storedResolverGeneration = 0;
    this._storedValueCache = new Map();
    this._pointerClient = null;
    ((this.settingsManager = e),
      (this.vscode = t),
      (this.tiffProcessor = n),
      (this.exrProcessor = null),
      (this.npyProcessor = null),
      (this.pfmProcessor = null),
      (this.ppmProcessor = null),
      (this.pngProcessor = null),
      (this.hdrProcessor = null),
      (this.tgaProcessor = null),
      (this.webImageProcessor = null),
      (this.scientificProcessors = []),
      (this.layeredPreviewProcessor = null),
      (this.ctrlPressed = !1),
      (this.altPressed = !1),
      (this.isActive = !1),
      (this.consumeClick = !0),
      (this.compositeValueProvider = null),
      (this.decodedValueProvider = null),
      (this.debayerValueProvider = null),
      (this.physicalPixelSize = null),
      (this.geoReference = null),
      (this.container = document.body),
      (this.imageElement = null),
      this._setupKeyboardListeners());
  }
  setImageElement(e) {
    this.imageElement = e;
  }
  setPhysicalPixelSize(e) {
    this.physicalPixelSize = e;
  }
  setGeoReference(e) {
    this.geoReference = e;
  }
  setCoordinateScale(e) {
    this.coordinateScale = Number.isFinite(e) && e > 0 ? e : 1;
  }
  setStoredValueResolver(e, t = {}) {
    ((this.storedValueResolver = e),
      (this._immediateStoredValueResolver = (e && t.immediateResolver) || null),
      (this._storedValuesOnly = !!e && t.exactOnly === !0),
      (this._upgradeApproximateStoredValues = !e || t.upgradeApproximate !== !1),
      this._storedValueCache.clear(),
      (this._storedValueUnavailable = !1),
      (this._storedValuePixel = ''),
      (this._storedValueInFlight = !1),
      this._storedResolverGeneration++);
  }
  setExrProcessor(e) {
    this.exrProcessor = e;
  }
  setNpyProcessor(e) {
    this.npyProcessor = e;
  }
  setPfmProcessor(e) {
    this.pfmProcessor = e;
  }
  setPpmProcessor(e) {
    this.ppmProcessor = e;
  }
  setPngProcessor(e) {
    this.pngProcessor = e;
  }
  setHdrProcessor(e) {
    this.hdrProcessor = e;
  }
  setTgaProcessor(e) {
    this.tgaProcessor = e;
  }
  setWebImageProcessor(e) {
    this.webImageProcessor = e;
  }
  setScientificProcessors(e) {
    this.scientificProcessors = e || [];
  }
  setLayeredPreviewProcessor(e) {
    this.layeredPreviewProcessor = e;
  }
  setActive(e) {
    ((this.isActive = e),
      e
        ? (this.settingsManager.isMac ? this.altPressed : this.ctrlPressed)
          ? (this.container.classList.remove('zoom-in'), this.container.classList.add('zoom-out'))
          : (this.container.classList.remove('zoom-out'), this.container.classList.add('zoom-in'))
        : ((this.ctrlPressed = !1),
          (this.altPressed = !1),
          this.container.classList.remove('zoom-out'),
          this.container.classList.remove('zoom-in')));
  }
  addMouseListeners(e) {
    (e.addEventListener('mouseenter', t => this._handleMouseEnter(t)),
      e.addEventListener('mousemove', t => this._handleMouseMove(t)),
      e.addEventListener('mouseleave', t => this._handleMouseLeave(t)));
  }
  _handleMouseEnter(e) {
    this.imageElement &&
      ((this._pointerClient = { x: e.clientX, y: e.clientY }), this._publishAtPointer(e));
  }
  _publishAtPointer(e) {
    if (!this.imageElement) return;
    if (this._storedValuesOnly) {
      let n = this._pixelPosition(e);
      if (!n) {
        ((this._storedValuePixel = ''), this.vscode.postMessage({ type: 'pixelBlur' }));
        return;
      }
      let i = `${n.x},${n.y}`;
      this._storedValuePixel = i;
      let a = this._immediateStoredValueResolver?.(n.x, n.y);
      if (
        a &&
        (a.exact &&
          (this._storedValueCache.size > 512 && this._storedValueCache.clear(),
          this._storedValueCache.set(i, a.value)),
        this.vscode.postMessage({
          type: 'pixelFocus',
          value: this._composeReadout(n.x, n.y, a.value),
        }),
        a.exact || !this._upgradeApproximateStoredValues)
      )
        return;
      if (!this._upgradeApproximateStoredValues) {
        this.vscode.postMessage({
          type: 'pixelFocus',
          value: this._composeReadout(n.x, n.y, '\u2026'),
        });
        return;
      }
      this._upgradeToStoredValue(e);
      return;
    }
    let t = this._getPixelInfo(e);
    t
      ? (this.vscode.postMessage({ type: 'pixelFocus', value: t }), this._upgradeToStoredValue(e))
      : this.vscode.postMessage({ type: 'pixelBlur' });
  }
  _handleMouseMove(e) {
    this.imageElement &&
      ((this._pointerClient = { x: e.clientX, y: e.clientY }), this._publishAtPointer(e));
  }
  refreshAtPointer() {
    this._pointerClient &&
      this._publishAtPointer({ clientX: this._pointerClient.x, clientY: this._pointerClient.y });
  }
  _upgradeToStoredValue(e) {
    let t = this.storedValueResolver;
    if (!t || (this.coordinateScale <= 1 && !this._storedValuesOnly)) return;
    let n = this._pixelPosition(e);
    if (!n) return;
    let i = `${n.x},${n.y}`;
    this._storedValuePixel = i;
    let a = this._storedValueCache.get(i);
    if (a !== void 0) {
      this.vscode.postMessage({ type: 'pixelFocus', value: this._composeReadout(n.x, n.y, a) });
      return;
    }
    this._storedValueInFlight || this._readStoredValue(t, n.x, n.y, i);
  }
  _readStoredValue(e, t, n, i) {
    this._storedValueInFlight = !0;
    let a = this._storedResolverGeneration;
    e(t, n)
      .then(r => {
        if (a === this._storedResolverGeneration) {
          if (!r) {
            this._storedValueUnavailable = !0;
            return;
          }
          (this._storedValueCache.size > 512 && this._storedValueCache.clear(),
            this._storedValueCache.set(i, r),
            this._storedValuePixel === i &&
              this.vscode.postMessage({
                type: 'pixelFocus',
                value: this._composeReadout(t, n, r),
              }));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (a !== this._storedResolverGeneration) return;
        this._storedValueInFlight = !1;
        let r = this._storedValuePixel;
        if (r === i || this._storedValueUnavailable) return;
        let [s, o] = r.split(',').map(Number);
        Number.isFinite(s) &&
          Number.isFinite(o) &&
          !this._storedValueCache.has(r) &&
          this._readStoredValue(e, s, o, r);
      });
  }
  _handleMouseLeave(e) {
    ((this._pointerClient = null),
      (this._storedValuePixel = ''),
      this.vscode.postMessage({ type: 'pixelBlur' }));
  }
  _pixelPosition(e) {
    if (!this.imageElement) return null;
    let t = this.imageElement.getBoundingClientRect(),
      n = this.imageElement,
      i = Number(this.imageElement.dataset?.sceneWidth),
      a = Number(this.imageElement.dataset?.sceneHeight),
      r = i > 0 ? i : n.naturalWidth || n.width,
      s = a > 0 ? a : n.naturalHeight || n.height;
    if (
      e.clientX < t.left ||
      e.clientX > t.right ||
      e.clientY < t.top ||
      e.clientY > t.bottom ||
      t.width <= 0 ||
      t.height <= 0
    )
      return null;
    let o = (e.clientX - t.left) / t.width,
      h = (e.clientY - t.top) / t.height,
      u = Math.min(Math.max(0, Math.floor(o * r)), Math.max(0, r - 1)),
      d = Math.min(Math.max(0, Math.floor(h * s)), Math.max(0, s - 1));
    return { x: u, y: d, width: r, height: s };
  }
  _getPixelInfo(e) {
    let t = this._pixelPosition(e);
    if (!t) return '';
    let { x: n, y: i, width: a, height: r } = t,
      s = this._getColorAtPixel(n, i, a, r);
    return this._composeReadout(n, i, s);
  }
  _composeReadout(e, t, n) {
    ((e = Math.round(e * this.coordinateScale)), (t = Math.round(t * this.coordinateScale)));
    let i = dl(this.geoReference, e, t);
    if (i) return `${e}x${t} (${i}) ${n}`;
    let a = this.physicalPixelSize;
    if (a && Number.isFinite(a.x) && Number.isFinite(a.y)) {
      let r = e * Number(a.x),
        s = t * Number(a.y),
        o = a.xUnit || '',
        h = a.yUnit || o,
        u =
          o === h
            ? `${r.toPrecision(5)}\xD7${s.toPrecision(5)} ${o}`.trim()
            : `${r.toPrecision(5)} ${o} \xD7 ${s.toPrecision(5)} ${h}`.trim();
      return `${e}x${t} (${u}) ${n}`;
    }
    return `${e}x${t} ${n}`;
  }
  _applyGammaBrightness(e) {
    let t = this.settingsManager.settings.gamma || { in: 1, out: 1 },
      n = this.settingsManager.settings.brightness || { offset: 0 },
      i = Math.pow(e, t.in),
      a = n.offset;
    return ((i = i * Math.pow(2, a)), Math.pow(Math.max(0, i), 1 / t.out));
  }
  _formatCompositeValues(e) {
    let t = n =>
      Number.isNaN(n)
        ? 'NaN'
        : n === 1 / 0
          ? 'Inf'
          : n === -1 / 0
            ? '-Inf'
            : parseFloat(n.toFixed(6)).toString();
    return e.length === 4
      ? `${t(e[0])} ${t(e[1])} ${t(e[2])} \u03B1:${t(e[3])}`
      : e.map(t).join(' ');
  }
  _getColorAtPixel(e, t, n, i) {
    if (this.compositeValueProvider) {
      let s = this.compositeValueProvider(e, t);
      if (s) return this._formatCompositeValues(s);
    }
    if (this.decodedValueProvider) {
      let s = this.decodedValueProvider(e, t);
      if (s != null) return this._formatCompositeValues([s]);
    }
    if (this.debayerValueProvider) {
      let s = this.debayerValueProvider(e, t);
      if (s) return this._formatCompositeValues(s);
    }
    let r =
      this.settingsManager.settings.normalization &&
      this.settingsManager.settings.normalization.gammaMode &&
      (this.settingsManager.settings.colorPickerShowModified || !1);
    if (this.layeredPreviewProcessor?._lastRaw) {
      let s = this.layeredPreviewProcessor.getColorAtPixel(e, t, n, i);
      if (s) return s;
    }
    if (this.tiffProcessor) {
      let s = this.tiffProcessor.getColorAtPixel(e, t, n, i);
      if (s) {
        if (r) {
          let o = /^(\S+) (α|C2):(\S+)$/.exec(s);
          if (o) return `${this._applyGammaBrightness(Number(o[1])).toFixed(6)} ${o[2]}:${o[3]}`;
          let h = this._parseTiffColor(s);
          if (h) {
            let u = h.map(d => this._applyGammaBrightness(d));
            return this._formatColorValues(u, h.length);
          }
        }
        return s;
      }
    }
    if (this.exrProcessor && this.exrProcessor.rawExrData) {
      let s = this.exrProcessor.getPixelValue(e, t);
      if (s)
        if (r) {
          let o = [];
          for (let h = 0; h < s.length; h++) {
            let u = s[h];
            isNaN(u) || !isFinite(u) || (h === 3 && s.length === 4)
              ? o.push(u)
              : o.push(this._applyGammaBrightness(u));
          }
          if (o.length === 1) return o[0].toFixed(6);
          if (o.length === 3) return `${o[0].toFixed(6)} ${o[1].toFixed(6)} ${o[2].toFixed(6)}`;
          if (o.length === 4)
            return `${o[0].toFixed(6)} ${o[1].toFixed(6)} ${o[2].toFixed(6)} \u03B1:${o[3].toFixed(6)}`;
        } else {
          if (s.length === 1) return s[0].toFixed(6);
          if (s.length === 3) return `${s[0].toFixed(6)} ${s[1].toFixed(6)} ${s[2].toFixed(6)}`;
          if (s.length === 4)
            return `${s[0].toFixed(6)} ${s[1].toFixed(6)} ${s[2].toFixed(6)} \u03B1:${s[3].toFixed(6)}`;
        }
    }
    if (this.npyProcessor) {
      let s = this.npyProcessor.getColorAtPixel(e, t, n, i);
      if (s) {
        if (r) {
          let o = this._parseFloatColor(s);
          if (o) {
            let h = o.map(u => this._applyGammaBrightness(u));
            return this._formatColorValues(h, o.length);
          }
        }
        return s;
      }
    }
    if (this.pfmProcessor) {
      let s = this.pfmProcessor.getColorAtPixel(e, t, n, i);
      if (s) {
        if (r) {
          let o = this._parseFloatColor(s);
          if (o) {
            let h = o.map(u => this._applyGammaBrightness(u));
            return this._formatColorValues(h, o.length);
          }
        }
        return s;
      }
    }
    for (let s of this.scientificProcessors) {
      let o = s.getColorAtPixel(e, t, n, i);
      if (o) {
        if (r) {
          let h = this._parseFloatColor(o);
          if (h) {
            let u = h.map(d => this._applyGammaBrightness(d));
            return this._formatColorValues(u, h.length);
          }
        }
        return o;
      }
    }
    if (this.ppmProcessor) {
      let s = this.ppmProcessor.getColorAtPixel(e, t, n, i);
      if (s) {
        if (r) {
          let o = this._parseIntColor(s);
          if (o) {
            let d = o
              .map(m => m / 255)
              .map((m, p) => (p === 3 ? m : this._applyGammaBrightness(m)))
              .map(m => Math.round(Math.max(0, Math.min(1, m)) * 255));
            return this._formatColorValues(d, o.length, !0);
          }
        }
        return s;
      }
    }
    if (this.pngProcessor) {
      let s = this.pngProcessor.getColorAtPixel(e, t, n, i);
      if (s) {
        if (r) {
          let o = this._parseIntColor(s);
          if (o) {
            let d = o
              .map(m => m / 255)
              .map((m, p) => (p === 3 ? m : this._applyGammaBrightness(m)))
              .map(m => Math.round(Math.max(0, Math.min(1, m)) * 255));
            return this._formatColorValues(d, o.length, !0);
          }
        }
        return s;
      }
    }
    if (this.hdrProcessor) {
      let s = this.hdrProcessor.getColorAtPixel(e, t, n, i);
      if (s) {
        if (r) {
          let o = this._parseFloatColor(s);
          if (o) {
            let h = o.map(u => this._applyGammaBrightness(u));
            return this._formatColorValues(h, o.length);
          }
        }
        return s;
      }
    }
    if (this.tgaProcessor) {
      let s = this.tgaProcessor.getColorAtPixel(e, t, n, i);
      if (s) {
        if (r) {
          let o = this._parseIntColor(s);
          if (o) {
            let d = o
              .map(m => m / 255)
              .map((m, p) => (p === 3 ? m : this._applyGammaBrightness(m)))
              .map(m => Math.round(Math.max(0, Math.min(1, m)) * 255));
            return this._formatColorValues(d, o.length, !0);
          }
        }
        return s;
      }
    }
    if (this.webImageProcessor) {
      let s = this.webImageProcessor.getColorAtPixel(e, t, n, i);
      if (s) {
        if (r) {
          let o = this._parseIntColor(s);
          if (o) {
            let d = o
              .map(m => m / 255)
              .map((m, p) => (p === 3 ? m : this._applyGammaBrightness(m)))
              .map(m => Math.round(Math.max(0, Math.min(1, m)) * 255));
            return this._formatColorValues(d, o.length, !0);
          }
        }
        return s;
      }
    }
    if (this.imageElement instanceof HTMLCanvasElement) {
      let o = this.imageElement.getContext('2d', { willReadFrequently: !0 });
      if (o) {
        let h = o.getImageData(e, t, 1, 1).data;
        if (r) {
          let m = Array.from(h.slice(0, 3))
            .map(p => p / 255)
            .map(p => this._applyGammaBrightness(p))
            .map(p => Math.round(Math.max(0, Math.min(1, p)) * 255));
          return `${m[0].toString().padStart(3, '0')} ${m[1].toString().padStart(3, '0')} ${m[2].toString().padStart(3, '0')}`;
        }
        return `${h[0].toString().padStart(3, '0')} ${h[1].toString().padStart(3, '0')} ${h[2].toString().padStart(3, '0')}`;
      }
    }
    return '';
  }
  _parseTiffColor(e) {
    try {
      let n = e
        .trim()
        .split(/\s+/)
        .map(i => {
          let a = parseFloat(i);
          return isNaN(a) ? null : a;
        });
      return n.every(i => i !== null) ? n : null;
    } catch {
      return null;
    }
  }
  _parseFloatColor(e) {
    try {
      let n = e
        .trim()
        .split(/\s+/)
        .map(i => {
          let a = i.replace(/^[Aα]:/, '');
          if (a === 'NaN') return NaN;
          if (a === 'Inf') return 1 / 0;
          if (a === '-Inf') return -1 / 0;
          let r = parseFloat(a);
          return isNaN(r) && a !== 'NaN' ? null : r;
        });
      return n.every(i => i !== null) ? n : null;
    } catch {
      return null;
    }
  }
  _parseIntColor(e) {
    try {
      let n = e
        .trim()
        .split(/\s+/)
        .map(i => {
          if (i.startsWith('\u03B1:')) {
            let r = parseFloat(i.slice(2));
            return isNaN(r) ? null : Math.round(r * 255);
          }
          let a = parseInt(i, 10);
          return isNaN(a) ? null : a;
        });
      return n.every(i => i !== null) ? n : null;
    } catch {
      return null;
    }
  }
  _formatColorValues(e, t, n = !1) {
    let i = e
      .slice(0, Math.min(3, t))
      .map(a => (n ? Math.round(a).toString().padStart(3, '0') : a.toFixed(6)));
    if (t === 4) {
      let a = n ? (e[3] / 255).toFixed(2) : e[3].toFixed(6);
      return `${i.join(' ')} \u03B1:${a}`;
    }
    return i.join(' ');
  }
  _setupKeyboardListeners() {
    (window.addEventListener('keydown', e => this._handleKeyDown(e)),
      window.addEventListener('keyup', e => this._handleKeyUp(e)),
      window.addEventListener('blur', () => this._handleBlur()));
  }
  _handleKeyDown(e) {
    this.imageElement &&
      (e.key === 'Control' ? (this.ctrlPressed = !0) : e.key === 'Alt' && (this.altPressed = !0),
      this._updateCursorState());
  }
  _handleKeyUp(e) {
    this.imageElement &&
      (e.key === 'Control' ? (this.ctrlPressed = !1) : e.key === 'Alt' && (this.altPressed = !1),
      this._updateCursorState());
  }
  _handleBlur() {
    ((this.ctrlPressed = !1), (this.altPressed = !1), this._updateCursorState());
  }
  _updateCursorState() {
    this.isActive &&
      ((this.settingsManager.isMac ? this.altPressed : this.ctrlPressed)
        ? (this.container.classList.remove('zoom-in'), this.container.classList.add('zoom-out'))
        : (this.container.classList.remove('zoom-out'), this.container.classList.add('zoom-in')));
  }
  getKeyboardState() {
    return { ctrlPressed: this.ctrlPressed, altPressed: this.altPressed };
  }
};
var _a = class {
  constructor(e, t) {
    this.channelHistograms = [];
    ((this.settingsManager = e),
      (this.vscode = t),
      (this.overlay = null),
      (this.canvas = null),
      (this.ctx = null),
      (this.isVisible = !1),
      (this.histogramData = null),
      (this.numBins = 256),
      (this.scaleMode = 'sqrt'),
      (this.valueRange = { min: 0, max: 255, isFloat: !1 }),
      (this.originalStats = null),
      (this.isDragging = !1),
      (this.dragOffset = { x: 0, y: 0 }),
      (this.hoveredBin = -1),
      (this.tooltip = null),
      (this.minLabel = null),
      (this.maxLabel = null),
      this.createOverlay());
  }
  createOverlay() {
    ((this.overlay = document.createElement('div')),
      (this.overlay.className = 'histogram-overlay'),
      (this.overlay.style.display = 'none'));
    let e = document.createElement('div');
    e.className = 'histogram-header';
    let t = document.createElement('div');
    ((t.className = 'histogram-title'), (t.textContent = 'Histogram'));
    let n = document.createElement('button');
    ((n.className = 'histogram-button'),
      (n.textContent = 'Sqrt Mode'),
      (n.title = 'Toggle Linear/Sqrt scale'),
      (n.onclick = () => this.toggleScaleMode(n)));
    let i = document.createElement('button');
    ((i.className = 'histogram-close'),
      (i.textContent = '\xD7'),
      (i.title = 'Close histogram'),
      (i.onclick = () => this.hide()),
      e.appendChild(t),
      e.appendChild(n),
      e.appendChild(i),
      (this.canvas = document.createElement('canvas')),
      (this.canvas.className = 'histogram-canvas'),
      (this.canvas.width = 300),
      (this.canvas.height = 150),
      (this.ctx = this.canvas.getContext('2d')),
      this.canvas.addEventListener('mousemove', s => this.handleMouseMove(s)),
      this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave()));
    let a = document.createElement('div');
    ((a.className = 'histogram-labels'),
      (a.style.display = 'flex'),
      (a.style.justifyContent = 'space-between'),
      (a.style.fontSize = '10px'),
      (a.style.color = '#cccccc'),
      (this.minLabel = document.createElement('span')),
      (this.minLabel.textContent = '0'),
      (this.maxLabel = document.createElement('span')),
      (this.maxLabel.textContent = '255'),
      a.appendChild(this.minLabel),
      a.appendChild(this.maxLabel));
    let r = document.createElement('div');
    ((r.className = 'histogram-stats'),
      (r.id = 'histogram-stats'),
      (this.tooltip = document.createElement('div')),
      (this.tooltip.className = 'histogram-tooltip'),
      (this.tooltip.style.position = 'absolute'),
      (this.tooltip.style.display = 'none'),
      (this.tooltip.style.backgroundColor = 'rgba(0, 0, 0, 0.8)'),
      (this.tooltip.style.color = 'white'),
      (this.tooltip.style.padding = '4px 8px'),
      (this.tooltip.style.borderRadius = '4px'),
      (this.tooltip.style.fontSize = '11px'),
      (this.tooltip.style.pointerEvents = 'none'),
      (this.tooltip.style.zIndex = '1000'),
      this.overlay.appendChild(e),
      this.overlay.appendChild(this.canvas),
      this.overlay.appendChild(a),
      this.overlay.appendChild(r),
      this.overlay.appendChild(this.tooltip),
      (e.style.cursor = 'move'),
      (e.onmousedown = s => this.startDrag(s)),
      document.body.appendChild(this.overlay),
      (this.themeObserver = new MutationObserver(() => {
        (this.render(), this.updateStatsDisplay());
      })),
      this.themeObserver.observe(document.body, {
        attributes: !0,
        attributeFilter: ['class', 'style'],
      }));
  }
  handleMouseMove(e) {
    if (!this.histogramData || !this.canvas) return;
    let t = this.canvas.getBoundingClientRect(),
      n = this.canvas.width / t.width,
      i = (e.clientX - t.left) * n,
      a = this.canvas.width,
      r = 5,
      o = (a - 2 * r) / this.numBins,
      h = Math.floor((i - r) / o);
    ((h = Math.max(0, Math.min(h, this.numBins - 1))),
      this.hoveredBin !== h && ((this.hoveredBin = h), this.render()),
      this.updateTooltip(e.clientX, e.clientY, h));
  }
  handleMouseLeave() {
    ((this.hoveredBin = -1), this.tooltip && (this.tooltip.style.display = 'none'), this.render());
  }
  formatValue(e, t) {
    return t
      ? Math.abs(e) < 0.001 || Math.abs(e) >= 1e3
        ? e.toExponential(2)
        : e.toPrecision(4)
      : Math.round(e).toString();
  }
  binToValue(e) {
    let { min: t, max: n } = this.valueRange;
    return t + (e / 255) * (n - t);
  }
  updateTooltip(e, t, n) {
    if (!this.histogramData || n < 0) return;
    let i = this.histogramData.r[n] ?? 0,
      a = this.histogramData.g[n] ?? 0,
      r = this.histogramData.b[n] ?? 0;
    if (!this.tooltip) return;
    this.tooltip.innerHTML = '';
    let { min: s, max: o, isFloat: h } = this.valueRange,
      u = o - s,
      d = u / 256,
      m = s + n * d,
      p = m + d,
      v = document.createElement('div'),
      g = document.createElement('strong'),
      w = !h && (u === 255 || u === 256);
    if (h) g.textContent = `Value: ${this.formatValue(m, !0)} - ${this.formatValue(p, !0)}`;
    else if (w) g.textContent = `Value: ${n + Math.round(s)}`;
    else {
      let _ = Math.floor(m),
        I = Math.floor(p);
      _ === I ? (g.textContent = `Value: ${_}`) : (g.textContent = `Value: ${_} - ${I}`);
    }
    (v.appendChild(g), this.tooltip.appendChild(v));
    let k = i === a && a === r,
      E = (_, I, A) => {
        let N = document.createElement('div'),
          z = document.createElement('span');
        return (
          A && (z.style.color = A),
          (z.textContent = `${_}: ${I.toLocaleString()}`),
          N.appendChild(z),
          N
        );
      };
    if (
      (k
        ? this.tooltip.appendChild(E('Count', i, null))
        : (this.tooltip.appendChild(E('R', i, '#ff8888')),
          this.tooltip.appendChild(E('G', a, '#88ff88')),
          this.tooltip.appendChild(E('B', r, '#8888ff'))),
      (this.tooltip.style.display = 'block'),
      !this.overlay)
    )
      return;
    let L = this.overlay.getBoundingClientRect(),
      M = e - L.left + 10,
      T = t - L.top + 10;
    ((this.tooltip.style.left = `${M}px`), (this.tooltip.style.top = `${T}px`));
  }
  show(e = !1) {
    ((this.isVisible = !0),
      this.overlay && (this.overlay.style.display = 'flex'),
      this.vscode.postMessage({ type: 'requestHistogram' }),
      e || this.vscode.postMessage({ type: 'histogramVisibilityChanged', isVisible: !0 }));
  }
  hide(e = !1) {
    ((this.isVisible = !1),
      this.overlay && (this.overlay.style.display = 'none'),
      e || this.vscode.postMessage({ type: 'histogramVisibilityChanged', isVisible: !1 }));
  }
  toggle() {
    this.isVisible ? this.hide() : this.show();
  }
  toggleScaleMode(e) {
    let t = ['linear', 'sqrt'],
      n = t.indexOf(this.scaleMode);
    this.scaleMode = t[(n + 1) % t.length];
    let i = 'Linear';
    (this.scaleMode === 'sqrt' && (i = 'Sqrt'),
      (e.textContent = `${i} Mode`),
      this.render(),
      this.vscode.postMessage({ type: 'histogramScaleModeChanged', mode: this.scaleMode }));
  }
  generateTransformLUT(e, t) {
    let n = t + 1,
      i = new Uint8Array(n),
      a = e.gamma?.in ?? 1,
      r = e.gamma?.out ?? 1,
      s = Math.pow(2, e.brightness?.offset ?? 0),
      o = 1 / r;
    for (let h = 0; h < n; h++) {
      let u = h / t,
        d = Math.pow(u, a);
      d *= s;
      let m = Math.pow(Math.max(0, d), o);
      i[h] = Math.max(0, Math.min(255, (m * 255) | 0));
    }
    return i;
  }
  generateFloatLUT(e) {
    let t = new Uint8Array(65536),
      n = e.gamma?.in ?? 1,
      i = e.gamma?.out ?? 1,
      a = Math.pow(2, e.brightness?.offset ?? 0),
      r = 1 / i;
    for (let s = 0; s < 65536; s++) {
      let o = s / 65535,
        h = Math.pow(o, n);
      h *= a;
      let u = Math.pow(Math.max(0, h), r);
      t[s] = Math.max(0, Math.min(255, (u * 255) | 0));
    }
    return t;
  }
  computeHistogram(e, t = {}) {
    if (!e && !t.rawData && !t.planarData) return null;
    let n = performance.now(),
      i = Math.max(1, Math.floor(t.sampleStep || 1)),
      a = new Uint32Array(256),
      r = new Uint32Array(256),
      s = new Uint32Array(256),
      o = new Uint32Array(256),
      h = 0,
      u = t.settings || this.settingsManager.settings,
      d = u.normalization?.gammaMode || !1,
      m = u.normalization?.autoNormalize || !1,
      p = t.isFloat || !1,
      v = t.typeMin ?? 0,
      g = t.typeMax ?? (p ? 1 : 255),
      w,
      k;
    (m && t.stats
      ? ((w = t.stats.min), (k = t.stats.max))
      : d
        ? ((w = v), (k = g))
        : u.normalization?.min !== void 0 && u.normalization?.max !== void 0
          ? ((w = u.normalization.min), (k = u.normalization.max))
          : ((w = v), (k = g)),
      (this.valueRange = { min: w, max: k, isFloat: p }));
    let E = k - w,
      L = E > 0 ? 1 / E : 0,
      M = !!(t.rawData || t.planarData),
      T = 0;
    t.planarData
      ? (T = t.planarData[0].length)
      : t.rawData
        ? (T = t.rawData.length / (t.channels || 3))
        : e && (T = e.width * e.height);
    let _ = 1 / 0,
      I = -1 / 0,
      A = 0,
      N = 0,
      z = 1 / 0,
      X = -1 / 0,
      ae = 0,
      Q = 0,
      j = 1 / 0,
      q = -1 / 0,
      oe = 0,
      U = 0,
      Z = t.lut || null,
      G = g | 0,
      re = d && !p && M && (G === 255 || G === 65535),
      ee = d && p && M;
    re && !Z
      ? ((Z = this.generateTransformLUT(u, G)), ne.mark('histogram-lut'))
      : ee && !Z && ((Z = this.generateFloatLUT(u)), ne.mark('histogram-lut'));
    let ye = Z,
      ve = ee ? 65535 / E : 0;
    if (t.rawData || t.planarData) {
      let { rawData: le, planarData: Le } = t,
        me = t.channels || 3,
        Ce = me === 1 || (Le && Le.length === 1);
      if (Ce) {
        let de = Le ? Le[0] : le;
        if (de) {
          let ce = de.length;
          if (re)
            for (let ue = 0; ue < ce; ue += i) {
              let V = de[ue];
              if (!Number.isFinite(V)) {
                h++;
                continue;
              }
              (a[ye[Math.max(0, Math.min(G, V | 0))]]++,
                V < _ && (_ = V),
                V > I && (I = V),
                (A += V),
                N++);
            }
          else if (ee)
            for (let ue = 0; ue < ce; ue += i) {
              let V = de[ue];
              if (!Number.isFinite(V)) {
                h++;
                continue;
              }
              let he = Math.max(0, Math.min(65535, ((V - w) * ve) | 0));
              (a[ye[he]]++, V < _ && (_ = V), V > I && (I = V), (A += V), N++);
            }
          else
            for (let ue = 0; ue < ce; ue += i) {
              let V = de[ue];
              if (!Number.isFinite(V)) {
                h++;
                continue;
              }
              let he = Math.max(0, Math.min(255, ((V - w) * L * 255) | 0));
              (a[he]++, V < _ && (_ = V), V > I && (I = V), (A += V), N++);
            }
          (r.set(a), s.set(a));
        }
      } else if (Le) {
        let de = Le[0].length,
          ce = Le[0],
          ue = Le.length > 1 ? Le[1] : ce,
          V = Le.length > 2 ? Le[2] : ce;
        if (re)
          for (let he = 0; he < de; he += i) {
            let ke = ce[he],
              be = ue[he],
              pe = V[he];
            if (!Number.isFinite(ke) || !Number.isFinite(be) || !Number.isFinite(pe)) {
              h++;
              continue;
            }
            (a[ye[Math.max(0, Math.min(G, ke | 0))]]++,
              r[ye[Math.max(0, Math.min(G, be | 0))]]++,
              s[ye[Math.max(0, Math.min(G, pe | 0))]]++,
              ke < _ && (_ = ke),
              ke > I && (I = ke),
              (A += ke),
              N++,
              Ce ||
                (be < z && (z = be),
                be > X && (X = be),
                (ae += be),
                Q++,
                pe < j && (j = pe),
                pe > q && (q = pe),
                (oe += pe),
                U++));
          }
        else if (ee)
          for (let he = 0; he < de; he += i) {
            let ke = ce[he],
              be = ue[he],
              pe = V[he];
            if (!Number.isFinite(ke) || !Number.isFinite(be) || !Number.isFinite(pe)) {
              h++;
              continue;
            }
            let We = Math.max(0, Math.min(65535, ((ke - w) * ve) | 0)),
              je = Math.max(0, Math.min(65535, ((be - w) * ve) | 0)),
              pn = Math.max(0, Math.min(65535, ((pe - w) * ve) | 0));
            (a[ye[We]]++,
              r[ye[je]]++,
              s[ye[pn]]++,
              ke < _ && (_ = ke),
              ke > I && (I = ke),
              (A += ke),
              N++,
              Ce ||
                (be < z && (z = be),
                be > X && (X = be),
                (ae += be),
                Q++,
                pe < j && (j = pe),
                pe > q && (q = pe),
                (oe += pe),
                U++));
          }
        else
          for (let he = 0; he < de; he += i) {
            let ke = ce[he],
              be = ue[he],
              pe = V[he];
            if (!Number.isFinite(ke) || !Number.isFinite(be) || !Number.isFinite(pe)) {
              h++;
              continue;
            }
            let We = Math.max(0, Math.min(255, ((ke - w) * L * 255) | 0)),
              je = Math.max(0, Math.min(255, ((be - w) * L * 255) | 0)),
              pn = Math.max(0, Math.min(255, ((pe - w) * L * 255) | 0));
            (a[We]++,
              r[je]++,
              s[pn]++,
              ke < _ && (_ = ke),
              ke > I && (I = ke),
              (A += ke),
              N++,
              Ce ||
                (be < z && (z = be),
                be > X && (X = be),
                (ae += be),
                Q++,
                pe < j && (j = pe),
                pe > q && (q = pe),
                (oe += pe),
                U++));
          }
      } else if (le) {
        let de = le.length;
        if (re)
          for (let ce = 0; ce < de; ce += me * i) {
            let ue = le[ce],
              V = me > 1 ? le[ce + 1] : ue,
              he = me > 2 ? le[ce + 2] : ue;
            if (!Number.isFinite(ue) || !Number.isFinite(V) || !Number.isFinite(he)) {
              h++;
              continue;
            }
            (a[ye[Math.max(0, Math.min(G, ue | 0))]]++,
              r[ye[Math.max(0, Math.min(G, V | 0))]]++,
              s[ye[Math.max(0, Math.min(G, he | 0))]]++,
              ue < _ && (_ = ue),
              ue > I && (I = ue),
              (A += ue),
              N++,
              me > 1 &&
                (V < z && (z = V),
                V > X && (X = V),
                (ae += V),
                Q++,
                me > 2 && (he < j && (j = he), he > q && (q = he), (oe += he), U++)));
          }
        else if (ee)
          for (let ce = 0; ce < de; ce += me * i) {
            let ue = le[ce],
              V = me > 1 ? le[ce + 1] : ue,
              he = me > 2 ? le[ce + 2] : ue;
            if (!Number.isFinite(ue) || !Number.isFinite(V) || !Number.isFinite(he)) {
              h++;
              continue;
            }
            let ke = Math.max(0, Math.min(65535, ((ue - w) * ve) | 0)),
              be = Math.max(0, Math.min(65535, ((V - w) * ve) | 0)),
              pe = Math.max(0, Math.min(65535, ((he - w) * ve) | 0));
            (a[ye[ke]]++,
              r[ye[be]]++,
              s[ye[pe]]++,
              ue < _ && (_ = ue),
              ue > I && (I = ue),
              (A += ue),
              N++,
              me > 1 &&
                (V < z && (z = V),
                V > X && (X = V),
                (ae += V),
                Q++,
                me > 2 && (he < j && (j = he), he > q && (q = he), (oe += he), U++)));
          }
        else
          for (let ce = 0; ce < de; ce += me * i) {
            let ue = le[ce],
              V = me > 1 ? le[ce + 1] : ue,
              he = me > 2 ? le[ce + 2] : ue;
            if (!Number.isFinite(ue) || !Number.isFinite(V) || !Number.isFinite(he)) {
              h++;
              continue;
            }
            let ke = Math.max(0, Math.min(255, ((ue - w) * L * 255) | 0)),
              be = Math.max(0, Math.min(255, ((V - w) * L * 255) | 0)),
              pe = Math.max(0, Math.min(255, ((he - w) * L * 255) | 0));
            (a[ke]++,
              r[be]++,
              s[pe]++,
              ue < _ && (_ = ue),
              ue > I && (I = ue),
              (A += ue),
              N++,
              me > 1 &&
                (V < z && (z = V),
                V > X && (X = V),
                (ae += V),
                Q++,
                me > 2 && (he < j && (j = he), he > q && (q = he), (oe += he), U++)));
          }
      }
      Ce && ((z = j = _), (X = q = I), (ae = oe = A), (Q = U = N));
    } else if (e) {
      this.valueRange = { min: 0, max: 255, isFloat: !1 };
      let le = e.data,
        Le = le.length;
      for (let me = 0; me < Le; me += 4 * i) {
        if (le[me + 3] === 0) continue;
        let Ce = le[me],
          de = le[me + 1],
          ce = le[me + 2];
        (a[Ce]++,
          r[de]++,
          s[ce]++,
          Ce < _ && (_ = Ce),
          Ce > I && (I = Ce),
          (A += Ce),
          N++,
          de < z && (z = de),
          de > X && (X = de),
          (ae += de),
          Q++,
          ce < j && (j = ce),
          ce > q && (q = ce),
          (oe += ce),
          U++);
      }
    }
    ne.mark(i > 1 ? 'histogram-sampled-scan' : 'histogram-scan');
    let Ae = le => {
      let Le = 0,
        me = 255,
        Ce = 0,
        de = 0;
      for (let ce = 0; ce < 256; ce++)
        le[ce] > 0 && (de === 0 && (Le = ce), (me = ce), (Ce += ce * le[ce]), (de += le[ce]));
      return { minBin: Le, maxBin: me, meanBin: de > 0 ? Ce / de : 0, total: de };
    };
    if (
      ((this.originalStats = {
        r: { min: N > 0 ? _ : 0, max: N > 0 ? I : 0, mean: N > 0 ? A / N : 0, total: N },
        g: { min: Q > 0 ? z : 0, max: Q > 0 ? X : 0, mean: Q > 0 ? ae / Q : 0, total: Q },
        b: { min: U > 0 ? j : 0, max: U > 0 ? q : 0, mean: U > 0 ? oe / U : 0, total: U },
      }),
      a.every((le, Le) => le === r[Le] && le === s[Le]))
    )
      o.set(a);
    else
      for (let le = 0; le < 256; le++)
        o[le] = Math.round(0.299 * a[le] + 0.587 * r[le] + 0.114 * s[le]);
    return (
      console.log(
        `[Histogram] ${(performance.now() - n).toFixed(1)}ms (${T} pixels${i > 1 ? `, sampled every ${i}` : ''})`
      ),
      ne.mark('histogram-stats'),
      {
        r: a,
        g: r,
        b: s,
        luminance: o,
        nanCount: h,
        stats: { r: Ae(a), g: Ae(r), b: Ae(s), luminance: Ae(o) },
      }
    );
  }
  update(e, t = {}) {
    ((this.histogramData = this.computeHistogram(e, t)), this.isVisible && this.render());
  }
  updateFromPrecomputed(e) {
    ((this.histogramData = e.histogramData),
      e.originalStats && (this.originalStats = e.originalStats),
      e.valueRange && (this.valueRange = e.valueRange),
      this.isVisible && this.render());
  }
  updateFromChannels(e) {
    this.channelHistograms = [];
    let t = 256;
    for (let n of e) {
      if (!n.visible) continue;
      let i = new Int32Array(t),
        a = n.max - n.min,
        r = a !== 0 ? t / a : 0,
        s = Math.max(1, Math.floor(n.data.length / 5e5)),
        o = 0;
      for (let h = 0; h < n.data.length; h += s) {
        let u = Number(n.data[h]);
        if (!Number.isFinite(u)) continue;
        let d = Math.floor((u - n.min) * r);
        (d < 0 && (d = 0), d >= t && (d = t - 1), i[d]++, o++);
      }
      this.channelHistograms.push({
        name: n.name,
        color: n.color,
        min: n.min,
        max: n.max,
        counts: i,
        total: o,
      });
    }
    this.isVisible && this.render();
  }
  clearChannelHistograms() {
    this.channelHistograms.length !== 0 &&
      ((this.channelHistograms = []), this.isVisible && this.render());
  }
  renderChannelHistograms() {
    if (this.channelHistograms.length === 0 || !this.ctx || !this.canvas) return !1;
    let e = this.ctx,
      t = this.canvas.width,
      n = this.canvas.height,
      i = 5,
      a = t - 2 * i,
      r = n - 2 * i;
    e.clearRect(0, 0, t, n);
    let s = this.scaleMode === 'sqrt';
    for (let o of this.channelHistograms) {
      let h = 1;
      for (let d = 0; d < o.counts.length; d++) o.counts[d] > h && (h = o.counts[d]);
      let u = d => {
        let m = d / h;
        return (s ? Math.sqrt(m) : m) * r;
      };
      ((e.strokeStyle = o.color), (e.lineWidth = 1.25), (e.globalAlpha = 0.9), e.beginPath());
      for (let d = 0; d < o.counts.length; d++) {
        let m = i + (d / (o.counts.length - 1)) * a,
          p = i + r - u(o.counts[d]);
        d === 0 ? e.moveTo(m, p) : e.lineTo(m, p);
      }
      (e.stroke(),
        (e.globalAlpha = 0.18),
        (e.fillStyle = o.color),
        e.lineTo(i + a, i + r),
        e.lineTo(i, i + r),
        e.closePath(),
        e.fill(),
        (e.globalAlpha = 1));
    }
    return (
      (e.fillStyle = 'rgba(160, 160, 160, 0.85)'),
      (e.font = '9px var(--vscode-editor-font-family, monospace)'),
      (e.textAlign = 'left'),
      e.fillText('black point', i + 1, n - 1),
      (e.textAlign = 'right'),
      e.fillText('white point', i + a - 1, n - 1),
      !0
    );
  }
  render() {
    if (this.renderChannelHistograms() || !this.histogramData || !this.ctx || !this.canvas) return;
    let e = this.canvas.width,
      t = this.canvas.height,
      n = 5,
      i = t - 2 * n,
      a = e - 2 * n,
      r =
        getComputedStyle(document.body).getPropertyValue('--vscode-editor-background') || '#1e1e1e',
      s = !0;
    if (r.startsWith('#')) {
      let v = parseInt(r.substr(1, 2), 16),
        g = parseInt(r.substr(3, 2), 16),
        w = parseInt(r.substr(5, 2), 16);
      s = v + g + w < 384;
    } else if (r.startsWith('rgb')) {
      let v = r.match(/\d+/g);
      v && v.length >= 3 && (s = parseInt(v[0]) + parseInt(v[1]) + parseInt(v[2]) < 384);
    }
    ((this.ctx.fillStyle = r), this.ctx.fillRect(0, 0, e, t));
    let o = [this.histogramData.r, this.histogramData.g, this.histogramData.b],
      h = s
        ? ['rgba(255, 100, 100, 0.5)', 'rgba(100, 255, 100, 0.5)', 'rgba(100, 100, 255, 0.5)']
        : ['rgba(255, 180, 180, 0.8)', 'rgba(180, 255, 180, 0.8)', 'rgba(180, 180, 255, 0.8)'],
      u = 0;
    for (let v of o) {
      let g = 0;
      for (let w = 0; w < v.length; w++) v[w] > g && (g = v[w]);
      u = Math.max(u, g);
    }
    let d = v => (this.scaleMode === 'sqrt' ? Math.sqrt(v) : v),
      m = d(u);
    ((this.ctx.shadowBlur = 0), (this.ctx.globalCompositeOperation = s ? 'screen' : 'multiply'));
    let p = a / this.numBins;
    for (let v = 0; v < o.length; v++) {
      let g = o[v],
        w = h[v];
      (v === 0
        ? (w = '#ff0000')
        : v === 1
          ? (w = '#00ff00')
          : v === 2
            ? (w = '#0000ff')
            : (w = '#888888'),
        (this.ctx.fillStyle = w),
        (this.ctx.strokeStyle = w),
        (this.ctx.lineWidth = 2),
        this.ctx.beginPath(),
        this.ctx.moveTo(n, t - n));
      let k = [];
      k.push({ x: n, y: t - n });
      for (let E = 0; E < this.numBins; E++) {
        let L = n + E * p + p / 2,
          M = d(g[E]),
          T = m > 0 ? (M / m) * i * 0.95 : 0,
          _ = t - n - T;
        k.push({ x: L, y: _ });
      }
      if ((k.push({ x: n + a, y: t - n }), k.length > 2)) {
        this.ctx.moveTo(k[0].x, k[0].y);
        for (let E = 1; E < k.length - 2; E++) {
          let L = (k[E].x + k[E + 1].x) / 2,
            M = (k[E].y + k[E + 1].y) / 2;
          this.ctx.quadraticCurveTo(k[E].x, k[E].y, L, M);
        }
        this.ctx.quadraticCurveTo(
          k[k.length - 2].x,
          k[k.length - 2].y,
          k[k.length - 1].x,
          k[k.length - 1].y
        );
      } else for (let E of k) this.ctx.lineTo(E.x, E.y);
      (this.ctx.lineTo(n + a, t - n),
        this.ctx.lineTo(n, t - n),
        this.ctx.closePath(),
        this.ctx.fill(),
        this.ctx.stroke());
    }
    if (
      ((this.ctx.shadowBlur = 0),
      (this.ctx.globalCompositeOperation = 'source-over'),
      this.hoveredBin >= 0 && this.hoveredBin < this.numBins)
    ) {
      let v = n + this.hoveredBin * p;
      ((this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'),
        this.ctx.fillRect(v, n, Math.max(1, p - 0.5), i),
        (this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)'),
        (this.ctx.lineWidth = 1),
        this.ctx.beginPath(),
        this.ctx.moveTo(v + p / 2, n),
        this.ctx.lineTo(v + p / 2, t - n),
        this.ctx.stroke());
    }
    (this.updateStatsDisplay(), ne.mark('histogram-draw'));
  }
  updateStatsDisplay() {
    if (!this.histogramData) return;
    let e = document.getElementById('histogram-stats');
    if (!e) return;
    let t = this.originalStats,
      { isFloat: n } = this.valueRange,
      i =
        t &&
        Math.abs(t.r.min - t.g.min) < 0.001 &&
        Math.abs(t.g.min - t.b.min) < 0.001 &&
        Math.abs(t.r.max - t.g.max) < 0.001 &&
        Math.abs(t.g.max - t.b.max) < 0.001;
    e.innerHTML = '';
    let a = d =>
        n
          ? Math.abs(d) < 0.001 || Math.abs(d) >= 1e4
            ? d.toExponential(2)
            : d.toPrecision(4)
          : Math.round(d).toString(),
      r = (d, m = 'histogram-stat-item') => {
        let p = document.createElement('span');
        return ((p.textContent = d), m && (p.className = m), p);
      },
      s = (d, m = []) => {
        let p = document.createElement('div');
        return (
          (p.className = 'histogram-stat-line'),
          d.forEach((v, g) => {
            let w = r(v);
            (m[g] && (w.style.color = m[g]), p.appendChild(w));
          }),
          p
        );
      },
      o = () => {
        let d = document.createElement('div');
        d.className = 'histogram-stat-line histogram-stat-nan';
        let m = r(
          `NaN/Inf: ${this.histogramData ? this.histogramData.nanCount.toLocaleString() : '0'}`,
          'histogram-stat-item histogram-stat-nan'
        );
        return (
          d.appendChild(m),
          (!this.histogramData || this.histogramData.nanCount <= 0) &&
            (d.style.visibility = 'hidden'),
          d
        );
      };
    if (i && t) {
      let d = t.r;
      e.appendChild(s([`Min: ${a(d.min)}`, `Max: ${a(d.max)}`, `Mean: ${a(d.mean)}`]));
    } else if (t)
      e.appendChild(
        s(
          [
            `R: ${a(t.r.min)}-${a(t.r.max)} \u03BC=${a(t.r.mean)}`,
            `G: ${a(t.g.min)}-${a(t.g.max)} \u03BC=${a(t.g.mean)}`,
            `B: ${a(t.b.min)}-${a(t.b.max)} \u03BC=${a(t.b.mean)}`,
          ],
          ['#ff6666', '#66ff66', '#6666ff']
        )
      );
    else {
      let d = this.histogramData.stats;
      e.appendChild(
        s(
          [
            `R: ${d.r.minBin}-${d.r.maxBin} \u03BC=${a(d.r.meanBin)}`,
            `G: ${d.g.minBin}-${d.g.maxBin} \u03BC=${a(d.g.meanBin)}`,
            `B: ${d.b.minBin}-${d.b.maxBin} \u03BC=${a(d.b.meanBin)}`,
          ],
          ['#ff6666', '#66ff66', '#6666ff']
        )
      );
    }
    e.appendChild(o());
    let h =
        getComputedStyle(document.body).getPropertyValue('--vscode-editor-background') || '#1e1e1e',
      u = !0;
    if (h.startsWith('#')) {
      let d = parseInt(h.substr(1, 2), 16),
        m = parseInt(h.substr(3, 2), 16),
        p = parseInt(h.substr(5, 2), 16);
      u = d + m + p < 384;
    } else if (h.startsWith('rgb')) {
      let d = h.match(/\d+/g);
      d && d.length >= 3 && (u = parseInt(d[0]) + parseInt(d[1]) + parseInt(d[2]) < 384);
    }
    ((e.style.backgroundColor = u ? 'rgba(0, 0, 0, 0.8)' : 'rgba(255, 255, 255, 0.8)'),
      (e.style.color = u ? '#ffffff' : '#000000'),
      (e.style.left = 'auto'),
      (e.style.right = 'auto'),
      (e.style.marginLeft = '0'),
      (e.style.marginRight = '0'),
      this.updateRangeLabels());
  }
  updateRangeLabels() {
    if (!this.minLabel || !this.maxLabel) return;
    let { min: e, max: t, isFloat: n } = this.valueRange;
    n
      ? Math.abs(e) < 0.001 && Math.abs(t) < 10
        ? ((this.minLabel.textContent = e.toPrecision(3)),
          (this.maxLabel.textContent = t.toPrecision(3)))
        : Math.abs(t) >= 1e4 || Math.abs(e) >= 1e4
          ? ((this.minLabel.textContent = e.toExponential(1)),
            (this.maxLabel.textContent = t.toExponential(1)))
          : ((this.minLabel.textContent = e.toPrecision(4)),
            (this.maxLabel.textContent = t.toPrecision(4)))
      : ((this.minLabel.textContent = Math.round(e).toString()),
        (this.maxLabel.textContent = Math.round(t).toString()));
  }
  startDrag(e) {
    if (!this.overlay) return;
    let t = this.overlay.getBoundingClientRect();
    ((this.isDragging = !0), (this.dragOffset = { x: e.clientX - t.left, y: e.clientY - t.top }));
    let n = a => {
        if (!this.isDragging || !this.overlay) return;
        let r = a.clientX - this.dragOffset.x,
          s = a.clientY - this.dragOffset.y,
          o = window.innerWidth - this.overlay.offsetWidth,
          h = window.innerHeight - this.overlay.offsetHeight;
        ((this.overlay.style.left = Math.max(0, Math.min(r, o)) + 'px'),
          (this.overlay.style.top = Math.max(0, Math.min(s, h)) + 'px'),
          (this.overlay.style.right = 'auto'),
          (this.overlay.style.bottom = 'auto'));
      },
      i = () => {
        ((this.isDragging = !1),
          document.removeEventListener('mousemove', n),
          document.removeEventListener('mouseup', i));
        let a = this.getPosition();
        a && this.vscode.postMessage({ type: 'histogramPositionChanged', position: a });
      };
    (document.addEventListener('mousemove', n),
      document.addEventListener('mouseup', i),
      e.preventDefault());
  }
  getVisibility() {
    return this.isVisible;
  }
  setPosition(e, t) {
    this.overlay &&
      ((this.overlay.style.left = `${e}px`),
      (this.overlay.style.top = `${t}px`),
      (this.overlay.style.right = 'auto'),
      (this.overlay.style.bottom = 'auto'));
  }
  getPosition() {
    if (this.overlay) {
      let e = this.overlay.getBoundingClientRect();
      return { left: e.left, top: e.top };
    }
    return null;
  }
  setScaleMode(e) {
    if (e === 'linear' || e === 'sqrt') {
      this.scaleMode = e;
      let t = this.overlay?.querySelector('.histogram-button');
      (t && (t.textContent = e === 'sqrt' ? 'Sqrt Mode' : 'Linear Mode'), this.render());
    }
  }
  getScaleMode() {
    return this.scaleMode;
  }
};
var Pa = class {
  constructor(e) {
    this.overlay = null;
    this.settings = { ...Ma };
    this.isDragging = !1;
    this.dragOffset = { x: 0, y: 0 };
    this.enableCheckbox = null;
    this.offsetButtons = [];
    this.viewButtons = [];
    this.gainInputs = [];
    this.offsetRow = null;
    this.statusLine = null;
    ((this.onChange = e), this.createOverlay());
  }
  getSettings() {
    return { ...this.settings };
  }
  setSettings(e) {
    ((this.settings = { ...this.settings, ...e }), this.syncControls());
  }
  emit() {
    (this.syncControls(), this.onChange(this.getSettings()));
  }
  createOverlay() {
    ((this.overlay = document.createElement('div')),
      (this.overlay.className = 'debayer-panel'),
      (this.overlay.style.display = 'none'));
    let e = document.createElement('div');
    e.className = 'debayer-header';
    let t = document.createElement('div');
    ((t.className = 'debayer-title'), (t.textContent = 'Debayer'));
    let n = document.createElement('label');
    n.className = 'debayer-enable';
    let i = document.createElement('input');
    ((i.type = 'checkbox'),
      (i.checked = this.settings.enabled),
      (i.onchange = () => {
        ((this.settings.enabled = i.checked), this.emit());
      }),
      (this.enableCheckbox = i),
      n.appendChild(i),
      n.appendChild(document.createTextNode('On')));
    let a = document.createElement('button');
    ((a.className = 'debayer-close'),
      (a.textContent = '\xD7'),
      (a.title = 'Close debayer panel'),
      (a.onclick = () => this.hide()),
      e.appendChild(t),
      e.appendChild(n),
      e.appendChild(a));
    let r = document.createElement('div');
    r.className = 'debayer-body';
    let s = document.createElement('select');
    s.className = 'debayer-select';
    for (let M of rl) {
      let T = document.createElement('option');
      ((T.value = M.id), (T.textContent = M.label), (T.title = M.description), s.appendChild(T));
    }
    ((s.value = this.settings.pattern),
      (s.onchange = () => {
        ((this.settings.pattern = s.value), (this.settings.enabled = !0));
        let M = Ca(this.settings.pattern);
        (this.settings.view === 'i' && M.channels < 4 && (this.settings.view = 'rgb'), this.emit());
      }),
      r.appendChild(this.row('Pattern', s)));
    let o = document.createElement('select');
    o.className = 'debayer-select';
    let h = [
      {
        id: 'malvar',
        label: 'Malvar-He-Cutler',
        title:
          'Gradient-corrected linear. Best quality on detail. 2\xD72 Bayer only; other patterns use bilinear.',
      },
      {
        id: 'bilinear',
        label: 'Bilinear',
        title: 'Plain linear interpolation. Works for every pattern.',
      },
      {
        id: 'nearest',
        label: 'Nearest (no interpolation)',
        title:
          'Copies the nearest sampled site. Invents no values \u2014 preferred for measurement.',
      },
    ];
    for (let M of h) {
      let T = document.createElement('option');
      ((T.value = M.id), (T.textContent = M.label), (T.title = M.title), o.appendChild(T));
    }
    ((o.value = this.settings.algorithm),
      (o.onchange = () => {
        ((this.settings.algorithm = o.value), this.emit());
      }),
      r.appendChild(this.row('Method', o)));
    let u = document.createElement('div');
    ((u.className = 'debayer-offset'),
      (this.offsetButtons = ['X', 'Y'].map(M => {
        let T = document.createElement('button');
        return (
          (T.className = 'debayer-button'),
          (T.dataset.axis = M),
          (T.title = `Shift the CFA phase by one pixel in ${M}. Wraps at the pattern period.`),
          (T.onclick = () => {
            let _ = Ca(this.settings.pattern).period;
            (M === 'X'
              ? (this.settings.offsetX = (this.settings.offsetX + 1) % _)
              : (this.settings.offsetY = (this.settings.offsetY + 1) % _),
              (this.settings.enabled = !0),
              this.emit());
          }),
          u.appendChild(T),
          T
        );
      })),
      (this.offsetRow = this.row('Phase', u)),
      r.appendChild(this.offsetRow));
    let d = document.createElement('div');
    d.className = 'debayer-levels';
    let m = this.numberInput('Black', this.settings.blackLevel, M => {
        ((this.settings.blackLevel = M), this.emit());
      }),
      p = this.numberInput('White', this.settings.whiteLevel, M => {
        ((this.settings.whiteLevel = M), this.emit());
      });
    (d.appendChild(m), d.appendChild(p));
    let v = this.row('Levels', d);
    ((v.title =
      'Sensor black/white level in raw units, e.g. 256 / 4351 for 12-bit data in uint16. Leave both at 0 to skip.'),
      r.appendChild(v));
    let g = document.createElement('div');
    g.className = 'debayer-wb';
    let w = document.createElement('button');
    ((w.className = 'debayer-button'),
      (w.textContent = 'Auto (gray world)'),
      (w.title =
        'Estimate gains by assuming the scene averages to neutral. Fails on strongly tinted scenes \u2014 enter gains manually there.'),
      (w.onclick = () => {
        ((this.settings.autoWb = !this.settings.autoWb), (this.settings.enabled = !0), this.emit());
      }),
      g.appendChild(w));
    let k = document.createElement('div');
    ((k.className = 'debayer-gains'),
      (this.gainInputs = ['R', 'G', 'B'].map((M, T) => {
        let _ = document.createElement('input');
        ((_.type = 'number'),
          (_.step = '0.01'),
          (_.min = '0'),
          (_.className = 'debayer-number'),
          (_.title = `${M} gain`),
          (_.value = String([this.settings.gainR, this.settings.gainG, this.settings.gainB][T])),
          (_.onchange = () => {
            let A = parseFloat(_.value);
            !Number.isFinite(A) ||
              A < 0 ||
              (T === 0
                ? (this.settings.gainR = A)
                : T === 1
                  ? (this.settings.gainG = A)
                  : (this.settings.gainB = A),
              (this.settings.autoWb = !1),
              (this.settings.enabled = !0),
              this.emit());
          }));
        let I = document.createElement('label');
        return (
          (I.className = 'debayer-gain-label'),
          I.appendChild(document.createTextNode(M)),
          I.appendChild(_),
          k.appendChild(I),
          _
        );
      })),
      r.appendChild(this.row('White balance', g)),
      r.appendChild(this.row('Gains', k)));
    let E = document.createElement('div');
    E.className = 'debayer-views';
    let L = [
      { id: 'rgb', label: 'RGB', title: 'Full colour composite' },
      { id: 'r', label: 'R', title: 'Red channel only' },
      { id: 'g', label: 'G', title: 'Green channel only' },
      { id: 'b', label: 'B', title: 'Blue channel only' },
      {
        id: 'i',
        label: 'IR',
        title: 'Fourth channel (IR / clear / white), if the pattern has one',
      },
      { id: 'mosaic', label: 'Raw', title: 'Undemosaiced mosaic, as stored' },
    ];
    ((this.viewButtons = L.map(M => {
      let T = document.createElement('button');
      return (
        (T.className = 'debayer-button debayer-view-button'),
        (T.textContent = M.label),
        (T.title = M.title),
        (T.dataset.view = M.id),
        (T.onclick = () => {
          ((this.settings.view = M.id),
            M.id !== 'mosaic' && (this.settings.enabled = !0),
            this.emit());
        }),
        E.appendChild(T),
        T
      );
    })),
      r.appendChild(this.row('View', E)),
      (this.statusLine = document.createElement('div')),
      (this.statusLine.className = 'debayer-status'),
      r.appendChild(this.statusLine),
      this.overlay.appendChild(e),
      this.overlay.appendChild(r),
      (e.style.cursor = 'move'),
      (e.onmousedown = M => this.startDrag(M)));
    for (let M of ['mousedown', 'click', 'dblclick', 'wheel', 'contextmenu'])
      this.overlay.addEventListener(M, T => T.stopPropagation());
    (document.body.appendChild(this.overlay), this.syncControls());
  }
  row(e, t) {
    let n = document.createElement('div');
    n.className = 'debayer-row';
    let i = document.createElement('div');
    return (
      (i.className = 'debayer-label'),
      (i.textContent = e),
      n.appendChild(i),
      n.appendChild(t),
      n
    );
  }
  numberInput(e, t, n) {
    let i = document.createElement('input');
    ((i.type = 'number'),
      (i.step = '1'),
      (i.className = 'debayer-number'),
      (i.value = String(t)),
      (i.onchange = () => {
        let r = parseFloat(i.value);
        Number.isFinite(r) && n(r);
      }));
    let a = document.createElement('label');
    return (
      (a.className = 'debayer-gain-label'),
      a.appendChild(document.createTextNode(e)),
      a.appendChild(i),
      a
    );
  }
  syncControls() {
    if (!this.overlay) return;
    let e = Ca(this.settings.pattern);
    this.enableCheckbox && (this.enableCheckbox.checked = this.settings.enabled);
    for (let a of this.viewButtons) {
      let r = a.dataset.view;
      if ((a.classList.toggle('active', this.settings.view === r), r === 'i')) {
        let s = e.channels === 4;
        ((a.disabled = !s),
          (a.textContent = e.fourthLabel || 'IR'),
          (a.style.opacity = s ? '1' : '0.4'));
      }
    }
    let t = [this.settings.gainR, this.settings.gainG, this.settings.gainB];
    (this.gainInputs.forEach((a, r) => {
      (document.activeElement !== a && (a.value = t[r].toFixed(2)),
        (a.disabled = this.settings.autoWb));
    }),
      this.overlay
        .querySelector('.debayer-wb .debayer-button')
        ?.classList.toggle('active', this.settings.autoWb));
    let i = e.period;
    for (let a of this.offsetButtons) {
      let s = a.dataset.axis === 'X' ? this.settings.offsetX : this.settings.offsetY;
      ((a.textContent = `${a.dataset.axis}: ${s}`),
        a.classList.toggle('active', s !== 0),
        (a.disabled = i < 2));
    }
    if (this.offsetRow) {
      let a = this.offsetRow.querySelector('.debayer-label');
      a && (a.textContent = `Phase (0-${i - 1})`);
    }
    this.statusLine &&
      (this.settings.enabled
        ? this.settings.view === 'mosaic'
          ? (this.statusLine.textContent = 'Showing the undemosaiced mosaic.')
          : this.settings.view === 'rgb'
            ? (this.statusLine.textContent = `${e.label}, ${e.period}\xD7${e.period} period.`)
            : (this.statusLine.textContent =
                'Single channel \u2014 Apply Colormap works on this view.')
        : (this.statusLine.textContent = 'Off \u2014 showing the raw mosaic.'));
  }
  reportGains(e) {
    this.settings.autoWb &&
      ((this.settings.gainR = e.r),
      (this.settings.gainG = e.g),
      (this.settings.gainB = e.b),
      this.syncControls());
  }
  startDrag(e) {
    if (!this.overlay) return;
    let t = this.overlay.getBoundingClientRect();
    ((this.isDragging = !0), (this.dragOffset = { x: e.clientX - t.left, y: e.clientY - t.top }));
    let n = a => {
        if (!this.isDragging || !this.overlay) return;
        let r = a.clientX - this.dragOffset.x,
          s = a.clientY - this.dragOffset.y,
          o = window.innerWidth - this.overlay.offsetWidth,
          h = window.innerHeight - this.overlay.offsetHeight;
        ((this.overlay.style.left = Math.max(0, Math.min(r, o)) + 'px'),
          (this.overlay.style.top = Math.max(0, Math.min(s, h)) + 'px'),
          (this.overlay.style.right = 'auto'),
          (this.overlay.style.bottom = 'auto'));
      },
      i = () => {
        ((this.isDragging = !1),
          document.removeEventListener('mousemove', n, !0),
          document.removeEventListener('mouseup', i, !0),
          window.removeEventListener('blur', i));
      };
    (document.addEventListener('mousemove', n, !0),
      document.addEventListener('mouseup', i, !0),
      window.addEventListener('blur', i));
  }
  show() {
    this.overlay && (this.overlay.style.display = 'flex');
  }
  hide() {
    this.overlay && (this.overlay.style.display = 'none');
  }
  isVisible() {
    return !!this.overlay && this.overlay.style.display !== 'none';
  }
  toggle() {
    this.isVisible() ? this.hide() : this.show();
  }
};
var Ia = class {
  constructor(e, t) {
    ((this.settingsManager = e),
      (this.vscode = t),
      (this.overlay = null),
      (this.body = null),
      (this.copyButton = null),
      (this.isVisible = !1),
      (this.lastInfo = null),
      this.createOverlay());
  }
  createOverlay() {
    ((this.overlay = document.createElement('div')),
      (this.overlay.className = 'metadata-panel'),
      (this.overlay.style.display = 'none'));
    let e = document.createElement('div');
    e.className = 'metadata-panel-header';
    let t = document.createElement('div');
    ((t.className = 'metadata-panel-title'),
      (t.textContent = 'Metadata'),
      (this.copyButton = document.createElement('button')),
      (this.copyButton.className = 'metadata-panel-button'),
      (this.copyButton.textContent = 'Copy as JSON'),
      (this.copyButton.title = 'Copy all metadata and statistics as JSON'),
      (this.copyButton.onclick = () => this.copyAsJson()));
    let n = document.createElement('button');
    ((n.className = 'metadata-panel-close'),
      (n.textContent = '\xD7'),
      (n.title = 'Close metadata panel'),
      (n.onclick = () => this.hide()),
      e.appendChild(t),
      e.appendChild(this.copyButton),
      e.appendChild(n),
      (this.body = document.createElement('div')),
      (this.body.className = 'metadata-panel-body'),
      this.overlay.appendChild(e),
      this.overlay.appendChild(this.body),
      document.body.appendChild(this.overlay));
  }
  show(e = !1) {
    ((this.isVisible = !0),
      this.overlay && (this.overlay.style.display = 'flex'),
      e || this.vscode.postMessage({ type: 'metadataVisibilityChanged', isVisible: !0 }));
  }
  hide(e = !1) {
    ((this.isVisible = !1),
      this.overlay && (this.overlay.style.display = 'none'),
      e || this.vscode.postMessage({ type: 'metadataVisibilityChanged', isVisible: !1 }));
  }
  toggle() {
    this.isVisible ? this.hide() : this.show();
  }
  getVisibility() {
    return this.isVisible;
  }
  formatNumber(e) {
    return Number.isFinite(e)
      ? Math.abs(e) !== 0 && (Math.abs(e) < 0.001 || Math.abs(e) >= 1e5)
        ? e.toExponential(3)
        : e.toPrecision(6).replace(/\.?0+$/, '') || '0'
      : String(e);
  }
  createSection(e, t) {
    let n = document.createElement('details');
    ((n.className = 'metadata-panel-section'), (n.open = t));
    let i = document.createElement('summary');
    ((i.textContent = e), n.appendChild(i));
    let a = document.createElement('div');
    return (
      (a.className = 'metadata-panel-section-content'),
      n.appendChild(a),
      { details: n, content: a }
    );
  }
  appendRow(e, t, n) {
    let i = document.createElement('div');
    i.className = 'metadata-panel-row';
    let a = document.createElement('span');
    ((a.className = 'metadata-panel-row-name'), (a.textContent = t));
    let r = document.createElement('span');
    ((r.className = 'metadata-panel-row-value'),
      (r.textContent = n),
      (r.title = n),
      i.appendChild(a),
      i.appendChild(r),
      e.appendChild(i));
  }
  render(e) {
    if (((this.lastInfo = e), !this.body)) return;
    if (((this.body.textContent = ''), !e)) {
      let n = document.createElement('div');
      ((n.className = 'metadata-panel-empty'),
        (n.textContent = 'No metadata available for this image.'),
        this.body.appendChild(n));
      return;
    }
    let t = this.createSection(`File (${e.formatLabel})`, !0);
    for (let [n, i] of Object.entries(e.fileFields)) this.appendRow(t.content, n, i);
    if ((this.body.appendChild(t.details), e.stats)) {
      let n = this.createSection('Statistics', !0),
        i = e.stats;
      (this.appendRow(n.content, 'Min', this.formatNumber(i.min)),
        this.appendRow(n.content, 'Max', this.formatNumber(i.max)),
        this.appendRow(n.content, 'Mean', this.formatNumber(i.mean)),
        this.appendRow(n.content, 'Std Dev', this.formatNumber(i.std)),
        this.appendRow(
          n.content,
          'Valid Samples',
          `${i.validCount.toLocaleString()} / ${i.totalCount.toLocaleString()}`
        ),
        i.nonFiniteCount > 0 &&
          this.appendRow(n.content, 'NaN/Infinite', i.nonFiniteCount.toLocaleString()),
        this.body.appendChild(n.details));
    }
    if (e.tags && e.tags.length > 0) {
      let n = new Map();
      for (let r of e.tags) {
        let s = r.group || 'Tags';
        (n.has(s) || n.set(s, []), n.get(s).push(r));
      }
      let i = ['TIFF', 'GeoKeys', 'Exif', 'GPS'],
        a = [...i.filter(r => n.has(r)), ...Array.from(n.keys()).filter(r => !i.includes(r))];
      for (let r of a) {
        let s = n.get(r) || [],
          o = this.createSection(`${r} Tags (${s.length})`, r === 'TIFF');
        for (let h of s) this.appendRow(o.content, h.name, h.value);
        this.body.appendChild(o.details);
      }
    }
  }
  async copyAsJson() {
    if (!this.lastInfo || !this.copyButton) return;
    let e = JSON.stringify(this.lastInfo, null, 2),
      t = this.copyButton.textContent;
    try {
      (await navigator.clipboard.writeText(e), (this.copyButton.textContent = 'Copied!'));
    } catch {
      this.copyButton.textContent = 'Copy failed';
    }
    setTimeout(() => {
      this.copyButton && (this.copyButton.textContent = t);
    }, 1500);
  }
};
var Id = ['rect', 'ellipse', 'polygon', 'freehand', 'mask'],
  Ad = ['line', 'polyline'];
function hn(l) {
  return Id.indexOf(l) >= 0;
}
function Yn(l) {
  return Ad.indexOf(l) >= 0;
}
var Mi = { pixelWidth: 1, pixelHeight: 1, unit: 'px', origin: 'none' };
function yt(l, e, t, n) {
  let i = t * l.width + e;
  if (l.planar) {
    let s = l.planar[Math.min(n, l.planar.length - 1)];
    return s ? Number(s[i]) : NaN;
  }
  let a = l.data;
  if (!a) return NaN;
  let r = l.channels || 1;
  return Number(a[i * r + Math.min(n, r - 1)]);
}
function Dd(l, e, t) {
  let n = l.channels || 1;
  if (n === 1) return yt(l, e, t, 0);
  let i = yt(l, e, t, 0),
    a = yt(l, e, t, 1),
    r = n >= 3 ? yt(l, e, t, 2) : a;
  return n === 2 ? (i + a) / 2 : 0.2126 * i + 0.7152 * a + 0.0722 * r;
}
function hs(l) {
  let { width: e, height: t } = l,
    n = new Float32Array(e * t);
  if ((l.channels || 1) === 1) {
    if (l.planar) {
      let r = l.planar[0];
      for (let s = 0; s < n.length; s++) n[s] = Number(r[s]);
    } else if (l.data) {
      let r = l.data;
      for (let s = 0; s < n.length; s++) n[s] = Number(r[s]);
    }
    return n;
  }
  let a = 0;
  for (let r = 0; r < t; r++) for (let s = 0; s < e; s++) n[a++] = Dd(l, s, r);
  return n;
}
var gl = ['area', 'perimeter', 'length', 'intensity', 'minMax', 'shape', 'feret'],
  ms = [
    { id: 'area', label: 'Area', keys: ['area'] },
    { id: 'perimeter', label: 'Perimeter', keys: ['perimeter'] },
    { id: 'length', label: 'Length (lines)', keys: ['length'] },
    { id: 'intensity', label: 'Mean and StdDev', keys: ['mean', 'stdDev'] },
    { id: 'minMax', label: 'Min and max', keys: ['min', 'max'] },
    { id: 'median', label: 'Median', keys: ['median'] },
    { id: 'mode', label: 'Mode', keys: ['mode'] },
    { id: 'moments', label: 'Skewness and kurtosis', keys: ['skewness', 'kurtosis'] },
    {
      id: 'integratedDensity',
      label: 'Integrated density',
      keys: ['integratedDensity', 'rawIntegratedDensity'],
    },
    { id: 'centroid', label: 'Centroid', keys: ['centroidX', 'centroidY'] },
    { id: 'centerOfMass', label: 'Centre of mass', keys: ['centerOfMassX', 'centerOfMassY'] },
    { id: 'bounds', label: 'Bounding box', keys: ['bx', 'by', 'width', 'height'] },
    { id: 'fitEllipse', label: 'Fitted ellipse', keys: ['major', 'minor', 'angle'] },
    { id: 'feret', label: 'Feret diameter', keys: ['feret', 'minFeret', 'feretAngle'] },
    {
      id: 'shape',
      label: 'Shape descriptors',
      keys: ['circularity', 'aspectRatio', 'roundness', 'solidity'],
    },
  ],
  bl = {
    area: 'Area',
    perimeter: 'Perim.',
    length: 'Length',
    mean: 'Mean',
    stdDev: 'StdDev',
    min: 'Min',
    max: 'Max',
    median: 'Median',
    mode: 'Mode',
    skewness: 'Skew',
    kurtosis: 'Kurt',
    integratedDensity: 'IntDen',
    rawIntegratedDensity: 'RawIntDen',
    centroidX: 'X',
    centroidY: 'Y',
    centerOfMassX: 'XM',
    centerOfMassY: 'YM',
    bx: 'BX',
    by: 'BY',
    width: 'W',
    height: 'H',
    major: 'Major',
    minor: 'Minor',
    angle: 'Angle',
    feret: 'Feret',
    minFeret: 'MinFeret',
    feretAngle: 'FeretAng',
    circularity: 'Circ.',
    aspectRatio: 'AR',
    roundness: 'Round',
    solidity: 'Solidity',
  },
  yl = [
    'perimeter',
    'length',
    'major',
    'minor',
    'feret',
    'minFeret',
    'centroidX',
    'centroidY',
    'centerOfMassX',
    'centerOfMassY',
    'bx',
    'by',
    'width',
    'height',
  ];
var Fd = 1,
  vl = 2,
  Nd = 3;
function Ci(l) {
  if (typeof l == 'number') return Number.isFinite(l) ? l : void 0;
  if (Array.isArray(l))
    return l.length === 1
      ? Ci(l[0])
      : l.length === 2 && typeof l[0] == 'number' && typeof l[1] == 'number'
        ? l[1] !== 0
          ? l[0] / l[1]
          : void 0
        : Ci(l[0]);
}
function xl(l) {
  if (!l) return null;
  let e = Ci(l.t282),
    t = Ci(l.t283),
    n = Ci(l.t296) ?? vl;
  if (!e || !t || e <= 0 || t <= 0 || n === Fd) return null;
  let i = n === Nd ? 'cm' : n === vl ? 'inch' : null;
  return !i || (e === 1 && t === 1)
    ? null
    : { pixelWidth: 1 / e, pixelHeight: 1 / t, unit: i, origin: 'tiff-resolution' };
}
function wl(l) {
  if (!Array.isArray(l)) return null;
  let e = t => {
    for (let n of l) {
      if (!n?.name || !t.test(String(n.name))) continue;
      let a = String(n.value ?? '')
        .trim()
        .split(',')
        .map(r => parseFloat(r.trim()));
      if (a.length >= 2 && Number.isFinite(a[0]) && Number.isFinite(a[1]) && a[1] !== 0)
        return a[0] / a[1];
      if (Number.isFinite(a[0])) return a[0];
    }
  };
  return xl({ t282: e(/^xresolution$/i), t283: e(/^yresolution$/i), t296: e(/^resolutionunit$/i) });
}
function Bd(l) {
  if (!l) return null;
  let e = l.physicalSizeX,
    t = l.physicalSizeY;
  if (!e || !t || !Number.isFinite(e) || !Number.isFinite(t) || e <= 0 || t <= 0) return null;
  let n = l.physicalSizeXUnit || '\xB5m';
  return (l.physicalSizeYUnit || n) !== n
    ? null
    : { pixelWidth: e, pixelHeight: t, pixelDepth: l.physicalSizeZ, unit: n, origin: 'ome' };
}
function Ml(l) {
  if (!l) return null;
  let e = s =>
      String(s ?? '')
        .split('\\')
        .map(o => parseFloat(o.trim()))
        .filter(o => Number.isFinite(o) && o > 0),
    t = s => e(s)[0],
    n = e(l.pixelSpacing),
    i = e(l.imagerPixelSpacing),
    a = n.length >= 2 ? n : i;
  if (a.length < 2) return null;
  let r = t(l.spacingBetweenSlices) ?? t(l.sliceThickness);
  return {
    pixelWidth: a[1],
    pixelHeight: a[0],
    pixelDepth: r,
    unit: 'mm',
    origin: a === n ? 'dicom' : 'dicom-detector',
  };
}
function Cl(l) {
  if (!l) return null;
  let e = i => {
      let a = typeof i == 'number' ? i : Number(i);
      return Number.isFinite(a) && a > 0 ? a : void 0;
    },
    t = e(l.scalingXUm),
    n = e(l.scalingYUm) ?? t;
  return !t || !n
    ? null
    : { pixelWidth: t, pixelHeight: n, pixelDepth: e(l.scalingZUm), unit: '\xB5m', origin: 'czi' };
}
function kl(l, e) {
  return Bd(l) || xl(e) || { ...Mi };
}
function Sl(l, e, t) {
  if (!(l > 0) || !(e > 0)) return null;
  let n = e / l;
  return { pixelWidth: n, pixelHeight: n, unit: t || 'px', origin: 'manual' };
}
function fs(l) {
  if (l.origin === 'none') return 'Uncalibrated \u2014 measurements are in pixels.';
  let t =
      Math.abs(l.pixelWidth - l.pixelHeight) < 1e-9
        ? `${Se(l.pixelWidth)} ${l.unit}/px`
        : `${Se(l.pixelWidth)} \xD7 ${Se(l.pixelHeight)} ${l.unit}/px`,
    n =
      l.origin === 'ome'
        ? 'from OME metadata'
        : l.origin === 'tiff-resolution'
          ? 'from TIFF resolution tags'
          : l.origin === 'dicom'
            ? 'from DICOM Pixel Spacing'
            : l.origin === 'dicom-detector'
              ? 'from DICOM Imager Pixel Spacing (detector plane)'
              : l.origin === 'czi'
                ? 'from CZI scaling metadata'
                : l.origin === 'imported'
                  ? 'from the ROI file'
                  : 'set manually';
  return `${t} (${n})`;
}
function Aa(l) {
  return l.origin === 'none' ? 'px\xB2' : `${l.unit}\xB2`;
}
function Se(l, e = 4) {
  if (!Number.isFinite(l)) return Number.isNaN(l) ? 'NaN' : l > 0 ? '\u221E' : '\u2212\u221E';
  if (l === 0) return '0';
  let t = Math.abs(l);
  if (t < 1e-4 || t >= 1e7) return l.toExponential(Math.max(1, e - 1));
  let n = Math.max(0, e - Math.max(1, Math.floor(Math.log10(t)) + 1));
  return l.toFixed(n).replace(/\.?0+$/, '') || '0';
}
function Rl(l, e, t = 0.2) {
  if (e.origin === 'none' || !(l > 0)) return null;
  let n = l * e.pixelWidth * t;
  if (!(n > 0)) return null;
  let i = Math.floor(Math.log10(n)),
    a = Math.pow(10, i),
    r = [a, a * 2, a * 5, a * 10],
    s = r[0];
  for (let o of r) Math.abs(o - n) < Math.abs(s - n) && (s = o);
  return { lengthPixels: s / e.pixelWidth, label: `${Se(s)} ${e.unit}` };
}
var ps = { x: 0, y: 0, width: 0, height: 0, mask: new Uint8Array(0), count: 0 };
function El(l, e, t, n, i) {
  if (!i) return [l, e];
  let a = Math.cos(i),
    r = Math.sin(i),
    s = l - t,
    o = e - n;
  return [t + s * a - o * r, n + s * r + o * a];
}
function Da(l) {
  let { x: e, y: t, width: n, height: i } = l,
    a = e + n / 2,
    r = t + i / 2,
    s = l.angle || 0,
    o = [];
  for (let [h, u] of [
    [e, t],
    [e + n, t],
    [e + n, t + i],
    [e, t + i],
  ]) {
    let [d, m] = El(h, u, a, r, s);
    o.push(d, m);
  }
  return o;
}
function Fa(l, e = 96) {
  let t = l.width / 2,
    n = l.height / 2,
    i = l.x + t,
    a = l.y + n,
    r = l.angle || 0,
    s = [];
  for (let o = 0; o < e; o++) {
    let h = (o / e) * Math.PI * 2,
      [u, d] = El(i + t * Math.cos(h), a + n * Math.sin(h), i, a, r);
    s.push(u, d);
  }
  return s;
}
function zt(l) {
  switch (l.kind) {
    case 'rect':
      return Da(l);
    case 'ellipse':
      return Fa(l);
    case 'polygon':
    case 'freehand':
    case 'line':
    case 'polyline':
    case 'point':
      return (l.points || []).slice();
    case 'mask':
      return Jt(l);
    default:
      return [];
  }
}
function Ll(l, e, t) {
  if (!hn(l.kind)) return ps;
  if (l.kind === 'mask') {
    let i = l;
    return Ud(i.x, i.y, i.width, i.height, i.mask, e, t);
  }
  if (l.kind === 'rect' && !l.angle) {
    let i = l,
      a = Math.max(0, Math.round(i.x)),
      r = Math.max(0, Math.round(i.y)),
      s = Math.min(e, Math.round(i.x + i.width)),
      o = Math.min(t, Math.round(i.y + i.height)),
      h = Math.max(0, s - a),
      u = Math.max(0, o - r),
      d = new Uint8Array(h * u);
    return (d.fill(1), { x: a, y: r, width: h, height: u, mask: d, count: h * u });
  }
  let n = l.kind === 'ellipse' ? Fa(l, 256) : l.kind === 'rect' ? Da(l) : l.points || [];
  return $d(n, e, t);
}
function $d(l, e, t) {
  let n = Math.floor(l.length / 2);
  if (n < 3) return ps;
  let i = 1 / 0,
    a = 1 / 0,
    r = -1 / 0,
    s = -1 / 0;
  for (let k = 0; k < n; k++) {
    let E = l[k * 2],
      L = l[k * 2 + 1];
    (E < i && (i = E), E > r && (r = E), L < a && (a = L), L > s && (s = L));
  }
  let o = Math.max(0, Math.floor(i)),
    h = Math.max(0, Math.floor(a)),
    u = Math.min(e, Math.ceil(r) + 1),
    d = Math.min(t, Math.ceil(s) + 1),
    m = Math.max(0, u - o),
    p = Math.max(0, d - h);
  if (m === 0 || p === 0) return ps;
  let v = new Uint8Array(m * p),
    g = 0,
    w = [];
  for (let k = 0; k < p; k++) {
    let E = h + k + 0.5;
    w.length = 0;
    for (let L = 0; L < n; L++) {
      let M = l[L * 2],
        T = l[L * 2 + 1],
        _ = (L + 1) % n,
        I = l[_ * 2],
        A = l[_ * 2 + 1];
      ((T <= E && A > E) || (A <= E && T > E)) && w.push(M + ((E - T) / (A - T)) * (I - M));
    }
    if (!(w.length < 2)) {
      w.sort((L, M) => L - M);
      for (let L = 0; L + 1 < w.length; L += 2) {
        let M = Math.max(o, Math.ceil(w[L] - 0.5)),
          T = Math.min(u - 1, Math.floor(w[L + 1] - 0.5));
        for (let _ = M; _ <= T; _++) {
          let I = k * m + (_ - o);
          v[I] || ((v[I] = 1), g++);
        }
      }
    }
  }
  return { x: o, y: h, width: m, height: p, mask: v, count: g };
}
function Ud(l, e, t, n, i, a, r) {
  let s = Math.max(0, l),
    o = Math.max(0, e),
    h = Math.min(a, l + t),
    u = Math.min(r, e + n),
    d = Math.max(0, h - s),
    m = Math.max(0, u - o);
  if (d === t && m === n && s === l && o === e) {
    let g = 0;
    for (let w = 0; w < i.length; w++) i[w] && g++;
    return { x: l, y: e, width: t, height: n, mask: i, count: g };
  }
  let p = new Uint8Array(d * m),
    v = 0;
  for (let g = 0; g < m; g++) {
    let w = (g + o - e) * t + (s - l);
    for (let k = 0; k < d; k++) i[w + k] && ((p[g * d + k] = 1), v++);
  }
  return { x: s, y: o, width: d, height: m, mask: p, count: v };
}
function Jt(l) {
  let { width: e, height: t, mask: n } = l,
    i = (v, g) => v >= 0 && g >= 0 && v < e && g < t && n[g * e + v] !== 0,
    a = -1,
    r = -1;
  for (let v = 0; v < t && a < 0; v++)
    for (let g = 0; g < e; g++)
      if (i(g, v)) {
        ((a = g), (r = v));
        break;
      }
  if (a < 0) return [];
  let s = [-1, -1, 0, 1, 1, 1, 0, -1],
    o = [0, -1, -1, -1, 0, 1, 1, 1],
    h = [],
    u = a,
    d = r,
    m = 4,
    p = e * t * 8 + 16;
  for (let v = 0; v < p; v++) {
    h.push(l.x + u, l.y + d);
    let g = !1;
    for (let w = 0; w < 8; w++) {
      let k = (m + 5 + w) % 8,
        E = u + s[k],
        L = d + o[k];
      if (i(E, L)) {
        ((u = E), (d = L), (m = k), (g = !0));
        break;
      }
    }
    if (!g || (u === a && d === r)) break;
  }
  return h;
}
function gs(l, e = 1, t = 1) {
  let n = Math.floor(l.length / 2);
  if (n < 2) return 0;
  let i = 0;
  for (let a = 0; a < n; a++) {
    let r = (a + 1) % n,
      s = (l[r * 2] - l[a * 2]) * e,
      o = (l[r * 2 + 1] - l[a * 2 + 1]) * t;
    i += Math.hypot(s, o);
  }
  return i;
}
function bs(l, e = 1, t = 1) {
  let n = Math.floor(l.length / 2);
  if (n < 2) return 0;
  let i = 0;
  for (let a = 0; a + 1 < n; a++) {
    let r = (l[(a + 1) * 2] - l[a * 2]) * e,
      s = (l[(a + 1) * 2 + 1] - l[a * 2 + 1]) * t;
    i += Math.hypot(r, s);
  }
  return i;
}
function Tl(l, e = 1, t = 1) {
  let n = Math.floor(l.length / 2);
  if (n < 3) return 0;
  let i = 0;
  for (let a = 0; a < n; a++) {
    let r = (a + 1) % n;
    i += l[a * 2] * l[r * 2 + 1] - l[r * 2] * l[a * 2 + 1];
  }
  return (Math.abs(i) / 2) * e * t;
}
function _l(l, e = 1, t = 1) {
  let n = Jt(l),
    i = Math.floor(n.length / 2);
  if (i < 2) return 0;
  let a = 0,
    r = 0;
  for (let o = 0; o < i; o++) {
    let h = (o + 1) % i,
      u = Math.abs(n[h * 2] - n[o * 2]),
      d = Math.abs(n[h * 2 + 1] - n[o * 2 + 1]);
    u && d ? r++ : (u || d) && a++;
  }
  let s = (e + t) / 2;
  return (a * 0.948 + r * 1.34) * s;
}
function ys(l) {
  let e = Math.floor(l.length / 2);
  if (e < 3) return l.slice();
  let t = [];
  for (let s = 0; s < e; s++) t.push([l[s * 2], l[s * 2 + 1]]);
  t.sort((s, o) => s[0] - o[0] || s[1] - o[1]);
  let n = (s, o, h) => (o[0] - s[0]) * (h[1] - s[1]) - (o[1] - s[1]) * (h[0] - s[0]),
    i = [];
  for (let s of t) {
    for (; i.length >= 2 && n(i[i.length - 2], i[i.length - 1], s) <= 0;) i.pop();
    i.push(s);
  }
  let a = [];
  for (let s = t.length - 1; s >= 0; s--) {
    let o = t[s];
    for (; a.length >= 2 && n(a[a.length - 2], a[a.length - 1], o) <= 0;) a.pop();
    a.push(o);
  }
  (i.pop(), a.pop());
  let r = [];
  for (let s of i.concat(a)) r.push(s[0], s[1]);
  return r;
}
function Pl(l, e = 1, t = 1) {
  let n = ys(l),
    i = Math.floor(n.length / 2),
    a = { feret: 0, feretAngle: 0, minFeret: 0, feretX: 0, feretY: 0 };
  if (i === 0 || i === 1) return a;
  let r = new Float64Array(i),
    s = new Float64Array(i);
  for (let u = 0; u < i; u++) ((r[u] = n[u * 2] * e), (s[u] = n[u * 2 + 1] * t));
  let o = -1;
  for (let u = 0; u < i; u++)
    for (let d = u + 1; d < i; d++) {
      let m = Math.hypot(r[d] - r[u], s[d] - s[u]);
      if (m > o) {
        ((o = m), (a.feret = m));
        let p = (Math.atan2(-(s[d] - s[u]), r[d] - r[u]) * 180) / Math.PI;
        (p < 0 && (p += 180), (a.feretAngle = p), (a.feretX = n[u * 2]), (a.feretY = n[u * 2 + 1]));
      }
    }
  if (i < 3) return ((a.minFeret = 0), a);
  let h = 1 / 0;
  for (let u = 0; u < i; u++) {
    let d = (u + 1) % i,
      m = r[d] - r[u],
      p = s[d] - s[u],
      v = Math.hypot(m, p);
    if (v === 0) continue;
    let g = 0;
    for (let w = 0; w < i; w++) {
      let k = Math.abs((r[w] - r[u]) * p - (s[w] - s[u]) * m) / v;
      k > g && (g = k);
    }
    g < h && (h = g);
  }
  return ((a.minFeret = Number.isFinite(h) ? h : 0), a);
}
function Il(l, e = 1, t = 1) {
  let { width: n, height: i, mask: a } = l,
    r = 0,
    s = 0,
    o = 0;
  for (let _ = 0; _ < i; _++) for (let I = 0; I < n; I++) a[_ * n + I] && (r++, (s += I), (o += _));
  if (r === 0) return { major: 0, minor: 0, angle: 0, centroidX: 0, centroidY: 0 };
  let h = s / r,
    u = o / r,
    d = 0,
    m = 0,
    p = 0;
  for (let _ = 0; _ < i; _++)
    for (let I = 0; I < n; I++) {
      if (!a[_ * n + I]) continue;
      let A = (I - h) * e,
        N = (_ - u) * t;
      ((d += A * A), (m += N * N), (p += A * N));
    }
  ((d /= r), (m /= r), (p /= r), (d += (e * e) / 12), (m += (t * t) / 12));
  let v = Math.sqrt(Math.max(0, (d - m) * (d - m) + 4 * p * p)),
    g = (d + m + v) / 2,
    w = (d + m - v) / 2,
    k = 4 * Math.sqrt(Math.max(0, g)),
    E = 4 * Math.sqrt(Math.max(0, w)),
    L = r * e * t,
    M = (Math.PI / 4) * k * E;
  if (M > 0) {
    let _ = Math.sqrt(L / M);
    ((k *= _), (E *= _));
  }
  let T = (0.5 * Math.atan2(2 * p, d - m) * 180) / Math.PI;
  return (
    (T = -T),
    T < 0 && (T += 180),
    T >= 180 && (T -= 180),
    { major: k, minor: E, angle: T, centroidX: l.x + h, centroidY: l.y + u }
  );
}
function Al(l, e, t) {
  if (!hn(l.kind)) return !1;
  if (l.kind === 'mask') {
    let i = l,
      a = Math.floor(e) - i.x,
      r = Math.floor(t) - i.y;
    return a < 0 || r < 0 || a >= i.width || r >= i.height ? !1 : i.mask[r * i.width + a] !== 0;
  }
  if (l.kind === 'rect' && !l.angle) {
    let i = l;
    return e >= i.x && t >= i.y && e <= i.x + i.width && t <= i.y + i.height;
  }
  let n = zt(l);
  return Hd(n, e, t);
}
function Hd(l, e, t) {
  let n = Math.floor(l.length / 2),
    i = !1;
  for (let a = 0, r = n - 1; a < n; r = a++) {
    let s = l[a * 2],
      o = l[a * 2 + 1],
      h = l[r * 2],
      u = l[r * 2 + 1];
    o > t != u > t && e < ((h - s) * (t - o)) / (u - o) + s && (i = !i);
  }
  return i;
}
function Na(l, e, t) {
  let n = Math.floor(l.length / 2);
  if (n === 0) return 1 / 0;
  if (n === 1) return Math.hypot(l[0] - e, l[1] - t);
  let i = 1 / 0;
  for (let a = 0; a + 1 < n; a++) {
    let r = l[a * 2],
      s = l[a * 2 + 1],
      o = l[(a + 1) * 2],
      h = l[(a + 1) * 2 + 1],
      u = o - r,
      d = h - s,
      m = u * u + d * d,
      p = m === 0 ? 0 : ((e - r) * u + (t - s) * d) / m;
    p = Math.max(0, Math.min(1, p));
    let v = Math.hypot(r + p * u - e, s + p * d - t);
    v < i && (i = v);
  }
  return i;
}
function vs(l, e = 0.75) {
  let t = Math.floor(l.length / 2);
  if (t < 3) return l.slice();
  let n = new Uint8Array(t);
  ((n[0] = 1), (n[t - 1] = 1));
  let i = [[0, t - 1]];
  for (; i.length;) {
    let [r, s] = i.pop();
    if (s <= r + 1) continue;
    let o = l[r * 2],
      h = l[r * 2 + 1],
      u = l[s * 2],
      d = l[s * 2 + 1],
      m = u - o,
      p = d - h,
      v = m * m + p * p,
      g = -1,
      w = -1;
    for (let k = r + 1; k < s; k++) {
      let E = l[k * 2],
        L = l[k * 2 + 1],
        M;
      if (v === 0) M = Math.hypot(E - o, L - h);
      else {
        let T = ((E - o) * m + (L - h) * p) / v;
        ((T = Math.max(0, Math.min(1, T))), (M = Math.hypot(o + T * m - E, h + T * p - L)));
      }
      M > g && ((g = M), (w = k));
    }
    g > e && w > 0 && ((n[w] = 1), i.push([r, w], [w, s]));
  }
  let a = [];
  for (let r = 0; r < t; r++) n[r] && a.push(l[r * 2], l[r * 2 + 1]);
  return a;
}
var zd = {
    abs: Math.abs,
    sqrt: Math.sqrt,
    log: Math.log,
    log10: Math.log10,
    log2: Math.log2,
    exp: Math.exp,
    min: Math.min,
    max: Math.max,
    pow: Math.pow,
    round: Math.round,
    floor: Math.floor,
    ceil: Math.ceil,
    sin: Math.sin,
    cos: Math.cos,
    tan: Math.tan,
    atan2: Math.atan2,
    sign: Math.sign,
  },
  jd = { pi: Math.PI, e: Math.E },
  _t = class extends Error {
    constructor(e, t) {
      (super(e), (this.name = 'ExpressionError'), (this.position = t));
    }
  };
function Gd(l) {
  let e = [],
    t = 0;
  for (; t < l.length;) {
    let n = l[t];
    if (
      n === ' ' ||
      n === '	' ||
      n ===
        `
` ||
      n === '\r'
    ) {
      t++;
      continue;
    }
    if ((n >= '0' && n <= '9') || (n === '.' && /[0-9]/.test(l[t + 1] || ''))) {
      let i = t;
      for (; i < l.length && /[0-9.]/.test(l[i]);) i++;
      if (i < l.length && (l[i] === 'e' || l[i] === 'E')) {
        let a = i + 1;
        if (((l[a] === '+' || l[a] === '-') && a++, /[0-9]/.test(l[a] || ''))) {
          for (; a < l.length && /[0-9]/.test(l[a]);) a++;
          i = a;
        }
      }
      (e.push({ kind: 'number', value: l.slice(t, i), position: t }), (t = i));
      continue;
    }
    if (/[A-Za-z_]/.test(n)) {
      let i = t;
      for (; i < l.length && /[A-Za-z0-9_.]/.test(l[i]);) i++;
      (e.push({ kind: 'name', value: l.slice(t, i), position: t }), (t = i));
      continue;
    }
    if ('+-*/%^(),'.includes(n)) {
      (e.push({ kind: 'op', value: n, position: t }), t++);
      continue;
    }
    throw new _t(`Unexpected character "${n}"`, t);
  }
  return e;
}
function ki(l) {
  let e = Gd(l),
    t = 0,
    n = () => e[t],
    i = d => {
      let m = e[t];
      if (!m || m.value !== d) throw new _t(`Expected "${d}"`, m ? m.position : l.length);
      t++;
    },
    a = () => {
      let d = r();
      for (;;) {
        let m = n();
        if (!m || m.kind !== 'op' || (m.value !== '+' && m.value !== '-')) break;
        t++;
        let p = r(),
          v = d;
        d = m.value === '+' ? g => v(g) + p(g) : g => v(g) - p(g);
      }
      return d;
    },
    r = () => {
      let d = s();
      for (;;) {
        let m = n();
        if (!m || m.kind !== 'op' || !'*/%'.includes(m.value)) break;
        t++;
        let p = s(),
          v = d;
        m.value === '*'
          ? (d = g => v(g) * p(g))
          : m.value === '/'
            ? (d = g => v(g) / p(g))
            : (d = g => v(g) % p(g));
      }
      return d;
    },
    s = () => {
      let d = o(),
        m = n();
      if (m && m.kind === 'op' && m.value === '^') {
        t++;
        let p = s();
        return v => Math.pow(d(v), p(v));
      }
      return d;
    },
    o = () => {
      let d = n();
      if (d && d.kind === 'op' && (d.value === '-' || d.value === '+')) {
        t++;
        let m = o();
        return d.value === '-' ? p => -m(p) : m;
      }
      return h();
    },
    h = () => {
      let d = n();
      if (!d) throw new _t('Unexpected end of expression', l.length);
      if (d.kind === 'number') {
        t++;
        let m = parseFloat(d.value);
        if (!Number.isFinite(m)) throw new _t(`Invalid number "${d.value}"`, d.position);
        return () => m;
      }
      if (d.kind === 'op' && d.value === '(') {
        t++;
        let m = a();
        return (i(')'), m);
      }
      if (d.kind === 'name') {
        t++;
        let m = d.value,
          p = n();
        if (p && p.kind === 'op' && p.value === '(') {
          t++;
          let g = [];
          if (n() && n().value !== ')')
            for (g.push(a()); n() && n().value === ',';) (t++, g.push(a()));
          i(')');
          let w = zd[m.toLowerCase()];
          if (!w) throw new _t(`Unknown function "${m}"`, d.position);
          return k => w(...g.map(E => E(k)));
        }
        let v = jd[m.toLowerCase()];
        return v !== void 0
          ? () => v
          : g => {
              let w = g[m];
              return typeof w == 'number' ? w : NaN;
            };
      }
      throw new _t(`Unexpected token "${d.value}"`, d.position);
    },
    u = a();
  if (t < e.length) throw new _t(`Unexpected token "${e[t].value}"`, e[t].position);
  return u;
}
async function Wd(l, e, t, n = 8) {
  let i = await ht();
  if (!i || typeof i.label_components_fast != 'function')
    throw new Error(
      'Connected-component labelling requires the Rust/WASM module, which failed to load.'
    );
  let a = i.label_components_fast(l, e, t, n);
  return { labels: a.take_labels_as_i32(), count: a.count, width: e, height: t };
}
function Od(l) {
  let { labels: e, count: t, width: n, height: i } = l;
  if (t === 0) return [];
  let a = new Int32Array(t + 1).fill(n),
    r = new Int32Array(t + 1).fill(i),
    s = new Int32Array(t + 1).fill(-1),
    o = new Int32Array(t + 1).fill(-1),
    h = new Int32Array(t + 1),
    u = new Uint8Array(t + 1);
  for (let m = 0; m < i; m++)
    for (let p = 0; p < n; p++) {
      let v = e[m * n + p];
      v &&
        (p < a[v] && (a[v] = p),
        p > s[v] && (s[v] = p),
        m < r[v] && (r[v] = m),
        m > o[v] && (o[v] = m),
        h[v]++,
        (p === 0 || m === 0 || p === n - 1 || m === i - 1) && (u[v] = 1));
    }
  let d = [];
  for (let m = 1; m <= t; m++) {
    if (s[m] < 0) continue;
    let p = a[m],
      v = r[m],
      g = s[m] - p + 1,
      w = o[m] - v + 1,
      k = new Uint8Array(g * w);
    for (let E = 0; E < w; E++) {
      let L = (v + E) * n + p;
      for (let M = 0; M < g; M++) e[L + M] === m && (k[E * g + M] = 1);
    }
    d.push({
      label: m,
      x: p,
      y: v,
      width: g,
      height: w,
      mask: k,
      area: h[m],
      touchesEdge: u[m] !== 0,
    });
  }
  return d;
}
async function Vd(l, e, t) {
  let n = await ht();
  if (!n || typeof n.fill_mask_holes_fast != 'function')
    throw new Error('Hole filling requires the Rust/WASM module, which failed to load.');
  return n.fill_mask_holes_fast(l, e, t);
}
async function Xd(l, e, t) {
  let n = await ht();
  if (!n || typeof n.distance_transform_fast != 'function')
    throw new Error('Distance transform requires the Rust/WASM module, which failed to load.');
  return n.distance_transform_fast(l, e, t);
}
function xs(l, e, t, n, i) {
  let a = t * n,
    r = new Int32Array(a),
    s = -1 / 0,
    o = 1 / 0;
  for (let A = 0; A < a; A++) {
    if (!e[A]) continue;
    let N = l[A];
    Number.isFinite(N) && (N > s && (s = N), N < o && (o = N));
  }
  if (!Number.isFinite(s) || s === o) {
    let A = 0;
    for (let N = 0; N < a; N++) e[N] && ((r[N] = 1), (A = 1));
    return { labels: r, count: A };
  }
  let h = 4096,
    u = (h - 1) / (s - o),
    d = new Int32Array(h + 1),
    m = new Int32Array(a);
  for (let A = 0; A < a; A++) {
    if (!e[A] || !Number.isFinite(l[A])) {
      m[A] = -1;
      continue;
    }
    let N = Math.round((l[A] - o) * u);
    ((m[A] = N), d[N]++);
  }
  let p = new Int32Array(h + 2);
  for (let A = h - 1; A >= 0; A--) p[A] = p[A + 1] + d[A + 1];
  let v = new Int32Array(a),
    g = p.slice(),
    w = 0;
  for (let A = 0; A < a; A++) {
    let N = m[A];
    N < 0 || ((v[g[N]++] = A), w++);
  }
  let k = -1,
    E = [0],
    L = [0],
    M = A => {
      let N = A;
      for (; L[N] !== N;) N = L[N];
      let z = A;
      for (; L[z] !== N;) {
        let X = L[z];
        ((L[z] = N), (z = X));
      }
      return N;
    },
    T = 0;
  for (let A = 0; A < w; A++) {
    let N = v[A],
      z = N % t,
      X = (N / t) | 0,
      ae = l[N],
      Q = 0,
      j = !1;
    for (let q = -1; q <= 1; q++) {
      let oe = X + q;
      if (!(oe < 0 || oe >= n))
        for (let U = -1; U <= 1; U++) {
          if (!U && !q) continue;
          let Z = z + U;
          if (Z < 0 || Z >= t) continue;
          let G = r[oe * t + Z];
          if (G <= 0) continue;
          let re = M(G);
          if (Q === 0) {
            Q = re;
            continue;
          }
          if (Q === re) continue;
          if (Math.min(E[Q], E[re]) - ae <= i) {
            let ye = Math.min(Q, re),
              ve = Math.max(Q, re);
            ((L[ve] = ye), (E[ye] = Math.max(E[ye], E[ve])), (Q = ye));
          } else j = !0;
        }
    }
    j ? (r[N] = k) : Q === 0 ? (T++, (L[T] = T), (E[T] = ae), (r[N] = T)) : (r[N] = Q);
  }
  let _ = new Int32Array(T + 1),
    I = 0;
  for (let A = 0; A < a; A++) {
    let N = r[A];
    if (N <= 0) {
      r[A] = 0;
      continue;
    }
    let z = M(N);
    (_[z] === 0 && (_[z] = ++I), (r[A] = _[z]));
  }
  return { labels: r, count: I };
}
async function Yd(l, e, t, n = 0.5) {
  let i = await Xd(l, e, t),
    a = new Float64Array(i.length);
  for (let o = 0; o < i.length; o++) a[o] = Math.sqrt(i[o]);
  let { labels: r } = xs(a, l, e, t, n),
    s = new Uint8Array(l.length);
  for (let o = 0; o < s.length; o++) s[o] = r[o] > 0 ? 1 : 0;
  return s;
}
function qd(l, e, t, n, i) {
  let { labels: a } = xs(l, e, t, n, i),
    r = new Uint8Array(e.length);
  for (let s = 0; s < r.length; s++) r[s] = a[s] > 0 ? 1 : 0;
  return r;
}
function Dl(l, e, t, n, i) {
  return xs(l, e, t, n, i).count;
}
async function Fl(l, e, t, n = {}, i = {}) {
  let a = l,
    r = i.split ?? (i.watershed ? 'shape' : 'none');
  r === 'shape'
    ? (a = await Yd(a, e, t, i.watershedTolerance ?? 0.5))
    : r === 'intensity' && i.plane && (a = qd(i.plane, a, e, t, i.prominence ?? 0));
  let s = await Wd(a, e, t, n.connectivity ?? 8),
    o = Od(s),
    h = o.length;
  if (n.fillHoles)
    for (let d of o) {
      d.mask = await Vd(d.mask, d.width, d.height);
      let m = 0;
      for (let p = 0; p < d.mask.length; p++) d.mask[p] && m++;
      d.area = m;
    }
  let u = { tooSmall: 0, tooLarge: 0, shape: 0, edge: 0 };
  return (
    (o = o.filter(d => {
      if (n.excludeEdges && d.touchesEdge) return (u.edge++, !1);
      if (n.minArea !== void 0 && d.area < n.minArea) return (u.tooSmall++, !1);
      if (n.maxArea !== void 0 && d.area > n.maxArea) return (u.tooLarge++, !1);
      if (n.minCircularity !== void 0 || n.maxCircularity !== void 0) {
        let m = Kd(d);
        if (
          (n.minCircularity !== void 0 && m < n.minCircularity) ||
          (n.maxCircularity !== void 0 && m > n.maxCircularity)
        )
          return (u.shape++, !1);
      }
      return !0;
    })),
    { particles: o, rejected: u, totalBeforeFilters: h }
  );
}
function Kd(l) {
  let { mask: e, width: t, height: n, area: i } = l,
    a = 0;
  for (let s = 0; s < n; s++)
    for (let o = 0; o < t; o++)
      e[s * t + o] &&
        ((o === 0 || !e[s * t + o - 1]) && a++,
        (o === t - 1 || !e[s * t + o + 1]) && a++,
        (s === 0 || !e[(s - 1) * t + o]) && a++,
        (s === n - 1 || !e[(s + 1) * t + o]) && a++);
  let r = a * 0.95;
  return r <= 0 ? 0 : Math.min(1, (4 * Math.PI * i) / (r * r));
}
function Nl(l, e, t) {
  return {
    id: e,
    name: t,
    kind: 'mask',
    source: 'threshold',
    x: l.x,
    y: l.y,
    width: l.width,
    height: l.height,
    mask: l.mask,
  };
}
var $l = 2;
function Jd(l) {
  let e = [],
    t = 0,
    n = 0;
  for (let i = 0; i < l.length; i++) {
    let a = l[i] ? 1 : 0;
    a === t ? n++ : (e.push(n), (t = a), (n = 1));
  }
  return (e.push(n), e);
}
function Zd(l, e) {
  let t = new Uint8Array(e),
    n = 0,
    i = 0;
  for (let a of l) {
    if (i) {
      let r = Math.min(e, n + a);
      t.fill(1, n, r);
    }
    if (((n += a), (i = i ? 0 : 1), n >= e)) break;
  }
  return t;
}
function ws(l) {
  if (l.kind === 'mask') {
    let { mask: e, ...t } = l;
    return { ...t, maskRuns: Jd(e) };
  }
  return { ...l };
}
function Ms(l) {
  if (!l || typeof l != 'object' || !l.kind) return null;
  if (l.kind === 'mask') {
    let { maskRuns: e, ...t } = l,
      n = (t.width || 0) * (t.height || 0);
    return !e || n <= 0 ? null : { ...t, mask: Zd(e, n) };
  }
  return l;
}
function Ul(l, e, t) {
  return {
    version: $l,
    image: t.image,
    imageWidth: t.imageWidth,
    imageHeight: t.imageHeight,
    calibration: e,
    columns: t.columns,
    derivedColumns: t.derivedColumns,
    rois: l.map(ws),
    createdBy: t.version ? `tiff-visualizer ${t.version}` : 'tiff-visualizer',
    createdAt: new Date().toISOString(),
  };
}
function Hl(l) {
  let e = [],
    t;
  try {
    t = JSON.parse(l);
  } catch (i) {
    return { rois: [], warnings: [`Could not parse the ROI file: ${i.message}`] };
  }
  if (!t || !Array.isArray(t.rois))
    return { rois: [], warnings: ['The ROI file has no "rois" array.'] };
  t.version > $l &&
    e.push(`The file was written by a newer version (${t.version}); unknown fields were ignored.`);
  let n = [];
  for (let i of t.rois) {
    let a = Ms(i);
    a ? n.push(a) : e.push('Skipped an ROI entry that could not be read.');
  }
  return {
    rois: n,
    calibration: t.calibration,
    columns: t.columns,
    derivedColumns: t.derivedColumns,
    warnings: e,
  };
}
var Bl = [
    'fileName',
    'unit',
    'pixelWidth',
    'pixelHeight',
    'calibrationOrigin',
    'thresholdMethod',
    'thresholdLow',
    'thresholdHigh',
    'preprocessing',
    'extensionVersion',
    'settingsHash',
  ],
  Qd = [
    'fileName',
    'page',
    'roiId',
    'roiName',
    'roiKind',
    'group',
    'channel',
    'pixelCount',
    'area',
    'perimeter',
    'length',
    'bx',
    'by',
    'width',
    'height',
    'major',
    'minor',
    'angle',
    'feret',
    'minFeret',
    'feretAngle',
    'feretX',
    'feretY',
    'circularity',
    'aspectRatio',
    'roundness',
    'solidity',
    'centroidX',
    'centroidY',
    'centerOfMassX',
    'centerOfMassY',
    'mean',
    'stdDev',
    'min',
    'max',
    'median',
    'mode',
    'skewness',
    'kurtosis',
    'integratedDensity',
    'rawIntegratedDensity',
    'nonFiniteCount',
  ];
function Cs(l, e, t = {}) {
  let n = t.delimiter ?? ',',
    i = t.decimal ?? '.',
    a = t.precision ?? 6,
    r = t.includeProvenance !== !1,
    s = (t.derivedColumns || [])
      .map(w => {
        try {
          return { name: w.name, evaluate: ki(w.expression) };
        } catch {
          return null;
        }
      })
      .filter(w => !!w),
    o = new Set(Object.keys(t.extraColumns || {}));
  if (t.extraColumnsForRow)
    for (let w of l) for (let k of Object.keys(t.extraColumnsForRow(w) || {})) o.add(k);
  let h = Array.from(o),
    u = Qd.filter(w => l.some(k => k[w] !== void 0 && k[w] !== null)),
    d = [
      ...h,
      ...u.map(String),
      ...s.map(w => w.name),
      ...(r ? Bl.filter(w => e[w] !== void 0).map(String) : []),
    ],
    m = w => {
      if (w == null) return '';
      if (typeof w == 'number') {
        if (!Number.isFinite(w)) return Number.isNaN(w) ? 'NaN' : w > 0 ? 'Inf' : '-Inf';
        let k = Number.isInteger(w) ? String(w) : eh(w, a);
        return i === ',' ? k.replace('.', ',') : k;
      }
      return String(w);
    },
    p = w =>
      w.includes(n) ||
      w.includes('"') ||
      w.includes(`
`)
        ? `"${w.replace(/"/g, '""')}"`
        : w,
    v = [d.map(p).join(n)];
  for (let w of l) {
    let k = {};
    for (let M of u) {
      let T = w[M];
      typeof T == 'number' && (k[String(M)] = T);
    }
    let E = [],
      L = t.extraColumnsForRow ? t.extraColumnsForRow(w) || {} : t.extraColumns || {};
    for (let M of h) E.push(p(m(L[M])));
    for (let M of u) E.push(p(m(w[M])));
    for (let M of s) {
      let T;
      try {
        T = M.evaluate(k);
      } catch {
        T = NaN;
      }
      E.push(p(m(T)));
    }
    if (r) {
      let M = (t.provenanceForRow && t.provenanceForRow(w)) || e;
      for (let T of Bl) e[T] !== void 0 && E.push(p(m(M[T])));
    }
    v.push(E.join(n));
  }
  let g =
    v.join(`
`) +
    `
`;
  return t.bom ? `\uFEFF${g}` : g;
}
function eh(l, e) {
  let t = Math.abs(l);
  return t !== 0 && (t < 1e-4 || t >= 1e10)
    ? l.toExponential(Math.max(1, e - 1))
    : l.toFixed(e).replace(/\.?0+$/, '') || '0';
}
function ks(l, e) {
  if (!e) return null;
  let t = [],
    n = '^';
  for (let o = 0; o < e.length; o++) {
    let h = e[o];
    if (h === '{') {
      let u = e.indexOf('}', o);
      if (u < 0) return null;
      let d = e.slice(o + 1, u).trim();
      if (!d) return null;
      (t.push(d), (n += '(.+?)'), (o = u));
      continue;
    }
    if (h === '*') {
      n += '.*';
      continue;
    }
    n += h.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
  n += '$';
  let i;
  try {
    i = new RegExp(n);
  } catch {
    return null;
  }
  let a = l.split('/').pop() || l,
    r = i.exec(a);
  if (!r) return null;
  let s = {};
  for (let o = 0; o < t.length; o++) s[t[o]] = r[o + 1] ?? '';
  return s;
}
function Ss(l, e, t) {
  let n = new Map();
  for (let a of l) {
    let r = a[e];
    if (typeof r != 'number' || !Number.isFinite(r)) continue;
    let s = t(a),
      o = n.get(s);
    o ? o.push(r) : n.set(s, [r]);
  }
  let i = [];
  for (let [a, r] of n) {
    let s = r.length,
      o = 0;
    for (let d of r) o += d;
    o /= s;
    let h = 0;
    for (let d of r) h += (d - o) * (d - o);
    h = s > 1 ? h / (s - 1) : 0;
    let u = Math.sqrt(h);
    i.push({
      key: a,
      n: s,
      mean: o,
      stdDev: u,
      sem: s > 0 ? u / Math.sqrt(s) : 0,
      min: Math.min(...r),
      max: Math.max(...r),
    });
  }
  return (i.sort((a, r) => a.key.localeCompare(r.key)), i);
}
var th = new Set(['roiId', 'roiName', 'roiKind', 'group', 'fileName', 'channel', 'page']);
function zl(l) {
  if (l.length === 0) return [];
  let e = [];
  for (let t of l)
    for (let n of Object.keys(t))
      th.has(n) || (typeof t[n] == 'number' && e.indexOf(n) < 0 && e.push(n));
  return e.map(t => ({ column: t, summary: Ss(l, t, () => 'all')[0] })).filter(t => !!t.summary);
}
function nh(l) {
  return l.replace(/\^/g, '**');
}
function jl(l) {
  let e = h => l.columns.indexOf(h) >= 0,
    t =
      ['area', 'mean', 'length', 'integratedDensity', 'pixelCount'].find(e) ||
      l.columns.find(h => h !== 'channel') ||
      'area',
    n = l.groupColumns.length > 0 ? l.groupColumns : e('group') ? ['group'] : ['fileName'],
    i = n.map(h => JSON.stringify(h)).join(', '),
    a =
      l.calibrationOrigin === 'none'
        ? 'Uncalibrated: lengths are in pixels and areas in pixels squared.'
        : `Calibrated at ${l.pixelWidth} \xD7 ${l.pixelHeight} ${l.unit} per pixel (${l.calibrationOrigin}), so "area" is in ${l.unit}\xB2 and lengths in ${l.unit}.`,
    r = l.thresholdMethod
      ? `Objects came from the "${l.thresholdMethod}" threshold; the exact cut is in the
thresholdLow/thresholdHigh columns.`
      : 'ROIs were drawn or imported rather than thresholded.',
    s =
      l.derivedColumns.length > 0
        ? `
# Derived columns, carried over from the measurement panel.
` +
          l.derivedColumns.map(
            h => `df[${JSON.stringify(h.name)}] = df.eval(${JSON.stringify(nh(h.expression))})`
          ).join(`
`) +
          `
`
        : '',
    o =
      l.channelCount > 1
        ? `
# This image has ${l.channelCount} channels and the export has one row per ROI
# per channel. Aggregating without picking one would count every object once per
# channel.
df = df[df["channel"] == 0]
`
        : '';
  return `"""Analysis of ${l.csvName}.

Written by the Scientific Image Visualizer measurement panel from the session
that produced this CSV.

${a}
${r}
${l.roiCount} ROI(s) measured. Intensity columns (mean, min, max, StdDev,
integratedDensity) are raw sample values and are never affected by display
settings such as normalisation or gamma.

The CSV is long/tidy \u2014 one row per ROI per channel with provenance repeated on
every row \u2014 so several exports concatenate with pd.concat and no bookkeeping.

Available columns: ${l.columns.join(', ')}
"""

import pandas as pd

df = pd.read_csv(${JSON.stringify(l.csvName)})
${o}${s}
# Grouped by ${n.join(' and ')}; change this to whatever your comparison is.
summary = (
    df.groupby([${i}])[${JSON.stringify(t)}]
      .agg(["count", "mean", "std", "sem", "min", "max"])
      .reset_index()
)

print(summary.to_string(index=False))

# summary.to_csv("summary.csv", index=False)
`;
}
var Gl = {
  count: 0,
  nonFiniteCount: 0,
  mean: NaN,
  stdDev: NaN,
  min: NaN,
  max: NaN,
  sum: 0,
  median: NaN,
  mode: NaN,
  skewness: NaN,
  kurtosis: NaN,
  centerOfMassX: NaN,
  centerOfMassY: NaN,
};
function ih(l, e, t) {
  if (e.count === 0) return { ...Gl };
  let n = new Float64Array(e.count),
    i = 0,
    a = 0,
    r = 1 / 0,
    s = -1 / 0,
    o = 0,
    h = 0,
    u = 0,
    d = 0,
    m = 0,
    p = 0;
  for (let z = 0; z < e.height; z++) {
    let X = e.y + z;
    for (let ae = 0; ae < e.width; ae++) {
      if (!e.mask[z * e.width + ae]) continue;
      let Q = e.x + ae,
        j = yt(l, Q, X, t);
      if (!Number.isFinite(j)) {
        a++;
        continue;
      }
      ((n[i] = j), i++, (u += j), j < r && (r = j), j > s && (s = j));
      let q = j - o;
      ((o += q / i), (h += q * (j - o)), (d += j * Q), (m += j * X), (p += j));
    }
  }
  if (i === 0) return { ...Gl, nonFiniteCount: a };
  let v = i > 1 ? h / (i - 1) : 0,
    g = Math.sqrt(Math.max(0, v)),
    w = 0,
    k = 0;
  for (let z = 0; z < i; z++) {
    let X = n[z] - o;
    ((w += X * X * X), (k += X * X * X * X));
  }
  let E = h / i,
    L = Math.sqrt(Math.max(0, E)),
    M = L > 0 ? w / i / (L * L * L) : 0,
    T = L > 0 ? k / i / (E * E) - 3 : 0,
    _ = n.slice(0, i).sort(),
    I = i % 2 === 1 ? _[(i - 1) / 2] : (_[i / 2 - 1] + _[i / 2]) / 2,
    A = p !== 0 ? d / p : NaN,
    N = p !== 0 ? m / p : NaN;
  if (r < 0) {
    let z = 0,
      X = 0,
      ae = 0;
    for (let Q = 0; Q < e.height; Q++) {
      let j = e.y + Q;
      for (let q = 0; q < e.width; q++) {
        if (!e.mask[Q * e.width + q]) continue;
        let oe = e.x + q,
          U = yt(l, oe, j, t);
        if (!Number.isFinite(U)) continue;
        let Z = U - r;
        ((z += Z), (X += Z * oe), (ae += Z * j));
      }
    }
    ((A = z > 0 ? X / z : NaN), (N = z > 0 ? ae / z : NaN));
  }
  return {
    count: i,
    nonFiniteCount: a,
    mean: o,
    stdDev: g,
    min: r,
    max: s,
    sum: u,
    median: I,
    mode: ah(_, i, r, s),
    skewness: M,
    kurtosis: T,
    centerOfMassX: A,
    centerOfMassY: N,
  };
}
function ah(l, e, t, n) {
  if (e === 0 || !Number.isFinite(t) || !Number.isFinite(n)) return NaN;
  if (n === t) return t;
  let i = 256,
    a = new Int32Array(i),
    r = i / (n - t);
  for (let o = 0; o < e; o++) {
    let h = Math.floor((l[o] - t) * r);
    (h >= i && (h = i - 1), h < 0 && (h = 0), a[h]++);
  }
  let s = 0;
  for (let o = 1; o < i; o++) a[o] > a[s] && (s = o);
  return t + (s + 0.5) / r;
}
function Ba(l, e, t) {
  let n = e.points || [],
    i = Math.floor(n.length / 2);
  if (i < 2) return { distance: new Float64Array(0), value: new Float64Array(0) };
  let a = Math.max(1, Math.round(e.lineWidth || 1)),
    r = bs(n),
    s = Math.max(2, Math.round(r) + 1),
    o = new Float64Array(s),
    h = new Float64Array(s),
    u = new Float64Array(i);
  for (let m = 1; m < i; m++)
    u[m] = u[m - 1] + Math.hypot(n[m * 2] - n[(m - 1) * 2], n[m * 2 + 1] - n[(m - 1) * 2 + 1]);
  let d = 0;
  for (let m = 0; m < s; m++) {
    let p = (m / (s - 1)) * r;
    for (; d + 2 < i && u[d + 1] < p;) d++;
    let v = u[d],
      g = u[d + 1],
      w = g > v ? (p - v) / (g - v) : 0,
      k = n[d * 2],
      E = n[d * 2 + 1],
      L = n[(d + 1) * 2],
      M = n[(d + 1) * 2 + 1],
      T = k + w * (L - k),
      _ = E + w * (M - E),
      I = 0,
      A = 0;
    if (a <= 1) {
      let N = Wl(l, T, _, t);
      Number.isFinite(N) && ((I = N), (A = 1));
    } else {
      let N = L - k,
        z = M - E,
        X = Math.hypot(N, z) || 1,
        ae = -z / X,
        Q = N / X;
      for (let j = 0; j < a; j++) {
        let q = j - (a - 1) / 2,
          oe = Wl(l, T + ae * q, _ + Q * q, t);
        Number.isFinite(oe) && ((I += oe), A++);
      }
    }
    ((o[m] = p), (h[m] = A > 0 ? I / A : NaN));
  }
  return { distance: o, value: h };
}
function Wl(l, e, t, n) {
  if (!(e >= -0.5) || !(t >= -0.5) || e > l.width - 0.5 || t > l.height - 0.5) return NaN;
  let i = Math.min(Math.max(e, 0), l.width - 1),
    a = Math.min(Math.max(t, 0), l.height - 1),
    r = Math.floor(i),
    s = Math.floor(a),
    o = Math.min(r + 1, l.width - 1),
    h = Math.min(s + 1, l.height - 1),
    u = i - r,
    d = a - s,
    m = yt(l, r, s, n),
    p = yt(l, o, s, n),
    v = yt(l, r, h, n),
    g = yt(l, o, h, n);
  if (!Number.isFinite(m) || !Number.isFinite(p) || !Number.isFinite(v) || !Number.isFinite(g))
    return yt(l, Math.round(i), Math.round(a), n);
  let w = m + u * (p - m),
    k = v + u * (g - v);
  return w + d * (k - w);
}
function rh(l, e, t, n) {
  let i = t.pixelWidth || 1,
    a = t.pixelHeight || 1,
    r = {
      roiId: l.id,
      roiName: l.name,
      roiKind: l.kind,
      group: l.group,
      channel: n,
      page: e.page,
      fileName: e.fileName,
    };
  if (l.kind === 'point') {
    let d = l.points || [],
      m = Math.floor(d.length / 2);
    if (((r.pixelCount = m), m > 0)) {
      let p = 0,
        v = 0,
        g = 0,
        w = 0,
        k = 0,
        E = 1 / 0,
        L = -1 / 0;
      for (let M = 0; M < m; M++) {
        let T = Math.round(d[M * 2]),
          _ = Math.round(d[M * 2 + 1]);
        ((p += T), (v += _));
        let I = yt(e, T, _, n);
        Number.isFinite(I) ? ((g += I), w++, I < E && (E = I), I > L && (L = I)) : k++;
      }
      ((r.centroidX = (p / m) * i),
        (r.centroidY = (v / m) * a),
        (r.mean = w > 0 ? g / w : NaN),
        (r.min = w > 0 ? E : NaN),
        (r.max = w > 0 ? L : NaN),
        (r.nonFiniteCount = k));
    }
    return r;
  }
  if (Yn(l.kind)) {
    let d = l;
    r.length = bs(d.points || [], i, a);
    let m = Ba(e, d, n),
      p = 0,
      v = 0,
      g = 1 / 0,
      w = -1 / 0,
      k = 0,
      E = 0,
      L = 0;
    for (let T = 0; T < m.value.length; T++) {
      let _ = m.value[T];
      if (!Number.isFinite(_)) {
        L++;
        continue;
      }
      (v++, (p += _), _ < g && (g = _), _ > w && (w = _));
      let I = _ - k;
      ((k += I / v), (E += I * (_ - k)));
    }
    ((r.pixelCount = v),
      (r.nonFiniteCount = L),
      (r.mean = v > 0 ? k : NaN),
      (r.stdDev = v > 1 ? Math.sqrt(E / (v - 1)) : 0),
      (r.min = v > 0 ? g : NaN),
      (r.max = v > 0 ? w : NaN),
      (r.rawIntegratedDensity = p));
    let M = d.points || [];
    if (M.length === 4) {
      let T = (Math.atan2(-(M[3] - M[1]) * a, (M[2] - M[0]) * i) * 180) / Math.PI;
      (T < 0 && (T += 180), (r.angle = T));
    }
    return r;
  }
  if (!hn(l.kind)) return r;
  let s = Ll(l, e.width, e.height);
  if (
    ((r.pixelCount = s.count),
    (r.area = s.count * i * a),
    (r.bx = s.x * i),
    (r.by = s.y * a),
    (r.width = s.width * i),
    (r.height = s.height * a),
    s.count === 0)
  )
    return r;
  l.kind === 'rect' || l.kind === 'polygon' || l.kind === 'freehand'
    ? (r.perimeter = gs(zt(l), i, a))
    : l.kind === 'ellipse'
      ? (r.perimeter = gs(zt(l), i, a))
      : (r.perimeter = _l(s, i, a));
  let o = Il(s, i, a);
  ((r.major = o.major),
    (r.minor = o.minor),
    (r.angle = o.angle),
    (r.centroidX = o.centroidX * i),
    (r.centroidY = o.centroidY * a));
  let h = l.kind === 'mask' ? zt(l) : zt(l);
  if (h.length >= 6) {
    let d = Pl(h, i, a);
    ((r.feret = d.feret),
      (r.minFeret = d.minFeret),
      (r.feretAngle = d.feretAngle),
      (r.feretX = d.feretX * i),
      (r.feretY = d.feretY * a));
    let m = ys(h),
      p = Tl(m, i, a);
    r.solidity = p > 0 ? r.area / p : NaN;
  }
  (r.perimeter &&
    r.perimeter > 0 &&
    (r.circularity = Math.min(1, (4 * Math.PI * r.area) / (r.perimeter * r.perimeter))),
    r.minor && r.minor > 0 && (r.aspectRatio = r.major / r.minor),
    r.major && r.major > 0 && (r.roundness = (4 * r.area) / (Math.PI * r.major * r.major)));
  let u = ih(e, s, n);
  return (
    (r.mean = u.mean),
    (r.stdDev = u.stdDev),
    (r.min = u.min),
    (r.max = u.max),
    (r.median = u.median),
    (r.mode = u.mode),
    (r.skewness = u.skewness),
    (r.kurtosis = u.kurtosis),
    (r.nonFiniteCount = u.nonFiniteCount),
    (r.rawIntegratedDensity = u.sum),
    (r.integratedDensity = r.area * u.mean),
    (r.centerOfMassX = u.centerOfMassX * i),
    (r.centerOfMassY = u.centerOfMassY * a),
    r
  );
}
function Ol(l, e, t, n) {
  let i = [];
  for (let a of l) for (let r of n) i.push(rh(a, e, t, r));
  return i;
}
var Rs = { x: 0, y: 0, width: 0, height: 0, mask: new Uint8Array(0), count: 0, tolerance: 0 };
function Vl(l, e, t, n, i, a = 4) {
  let r = [];
  for (let u = Math.max(0, i - a); u <= Math.min(t - 1, i + a); u++)
    for (let d = Math.max(0, n - a); d <= Math.min(e - 1, n + a); d++) {
      let m = l[u * e + d];
      Number.isFinite(m) && r.push(m);
    }
  if (r.length < 3) return 0;
  r.sort((u, d) => u - d);
  let s = r[Math.floor(r.length / 2)],
    o = r.map(u => Math.abs(u - s));
  return (o.sort((u, d) => u - d), o[Math.floor(o.length / 2)] * 1.4826);
}
function $a(l, e, t, n, i, a = {}) {
  if (n < 0 || i < 0 || n >= e || i >= t) return { ...Rs };
  let r = l[i * e + n];
  if (!Number.isFinite(r)) return { ...Rs };
  let s = Vl(l, e, t, n, i),
    o = a.tolerance !== void 0 ? a.tolerance : Math.max(s * (a.noiseMultiple ?? 3), 1e-9),
    h = Math.floor(e * t * (a.maxAreaFraction ?? 0.5)),
    u = a.connectivity ?? 8,
    d = a.adaptive === !0,
    m = new Uint8Array(e * t),
    p = new Int32Array(e * t),
    v = 0,
    g = i * e + n;
  ((p[v++] = g), (m[g] = 1));
  let w = 0,
    k = 0,
    E = n,
    L = n,
    M = i,
    T = i,
    _ = new Uint8Array(e * t);
  for (; v > 0 && w < h;) {
    let z = p[--v],
      X = l[z],
      ae = d && w > 0 ? k / w : r;
    if (!Number.isFinite(X) || Math.abs(X - ae) > o) continue;
    ((_[z] = 1), w++, (k += X));
    let Q = z % e,
      j = (z / e) | 0;
    (Q < E && (E = Q), Q > L && (L = Q), j < M && (M = j), j > T && (T = j));
    let q = (oe, U) => {
      if (oe < 0 || U < 0 || oe >= e || U >= t) return;
      let Z = U * e + oe;
      m[Z] || ((m[Z] = 1), (p[v++] = Z));
    };
    (q(Q - 1, j),
      q(Q + 1, j),
      q(Q, j - 1),
      q(Q, j + 1),
      u === 8 && (q(Q - 1, j - 1), q(Q + 1, j - 1), q(Q - 1, j + 1), q(Q + 1, j + 1)));
  }
  if (w === 0) return { ...Rs, tolerance: o };
  let I = L - E + 1,
    A = T - M + 1,
    N = new Uint8Array(I * A);
  for (let z = M; z <= T; z++)
    for (let X = E; X <= L; X++) _[z * e + X] && (N[(z - M) * I + (X - E)] = 1);
  return { x: E, y: M, width: I, height: A, mask: N, count: w, tolerance: o };
}
function Xl(l, e, t, n, i, a = {}) {
  let r = Math.max(Vl(l, e, t, n, i), 1e-9),
    s = a.steps ?? 14,
    o = [];
  for (let d = 0; d < s; d++) {
    let m = r * Math.pow(1.5, d),
      p = $a(l, e, t, n, i, { ...a, tolerance: m });
    if (p.count === 0) continue;
    if (p.count / (e * t) > (a.maxAreaFraction ?? 0.5)) break;
    o.push(p);
  }
  if (o.length === 0) return $a(l, e, t, n, i, a);
  if (o.length <= 2) return o[o.length - 1];
  let h = 0,
    u = 1 / 0;
  for (let d = 0; d + 1 < o.length; d++) {
    let m = (o[d + 1].count - o[d].count) / Math.max(1, o[d].count);
    o[d].count < 12 || (m < u && ((u = m), (h = d)));
  }
  return o[h];
}
function Yl(l, e, t) {
  let n = new Float32Array(e * t);
  for (let i = 0; i < t; i++)
    for (let a = 0; a < e; a++) {
      let r = i * e + a,
        s = l[i * e + Math.max(0, a - 1)],
        o = l[i * e + Math.min(e - 1, a + 1)],
        h = l[Math.max(0, i - 1) * e + a],
        u = l[Math.min(t - 1, i + 1) * e + a];
      if (
        !Number.isFinite(s) ||
        !Number.isFinite(o) ||
        !Number.isFinite(h) ||
        !Number.isFinite(u)
      ) {
        n[r] = 0;
        continue;
      }
      n[r] = Math.hypot((o - s) / 2, (u - h) / 2);
    }
  return n;
}
function ql(l, e, t, n, i, a, r, s = 64) {
  let o = Math.max(0, Math.min(n, a) - s),
    h = Math.max(0, Math.min(i, r) - s),
    u = Math.min(e - 1, Math.max(n, a) + s),
    d = Math.min(t - 1, Math.max(i, r) + s),
    m = u - o + 1,
    p = d - h + 1;
  if (m <= 0 || p <= 0) return [n, i, a, r];
  let v = 0;
  for (let G = h; G <= d; G++)
    for (let re = o; re <= u; re++) {
      let ee = l[G * e + re];
      ee > v && (v = ee);
    }
  if (v <= 0) return [n, i, a, r];
  let g = new Uint16Array(m * p);
  for (let G = 0; G < p; G++)
    for (let re = 0; re < m; re++) {
      let ee = l[(G + h) * e + (re + o)] / v;
      g[G * m + re] = 1 + Math.round((1 - ee) * 1023);
    }
  let w = new Float64Array(m * p).fill(1 / 0),
    k = new Int32Array(m * p).fill(-1),
    E = new Uint8Array(m * p),
    L = (i - h) * m + (n - o),
    M = (r - h) * m + (a - o);
  w[L] = 0;
  let T = 1024 * 2,
    _ = [],
    I = G => Math.min(_.length - 1, Math.floor(G)),
    A = T * (m + p) + 4;
  for (let G = 0; G <= T; G++) _.push([]);
  let N = 0;
  _[0].push(L);
  let z = [-1, 0, 1, -1, 1, -1, 0, 1],
    X = [-1, -1, -1, 0, 0, 1, 1, 1],
    ae = [Math.SQRT2, 1, Math.SQRT2, 1, 1, Math.SQRT2, 1, Math.SQRT2],
    Q = m * p,
    j = 0;
  for (; Q > 0 && j <= T * 4;) {
    let G = _[N % _.length];
    if (G.length === 0) {
      (N++, j++);
      continue;
    }
    let re = G.pop();
    if (E[re]) continue;
    if (((E[re] = 1), Q--, re === M)) break;
    let ee = re % m,
      ye = (re / m) | 0;
    for (let ve = 0; ve < 8; ve++) {
      let Ae = ee + z[ve],
        _e = ye + X[ve];
      if (Ae < 0 || _e < 0 || Ae >= m || _e >= p) continue;
      let le = _e * m + Ae;
      if (E[le]) continue;
      let Le = w[re] + g[le] * ae[ve];
      if (Le < w[le]) {
        ((w[le] = Le), (k[le] = re));
        let me = I(Le - w[re] + N);
        _[Math.max(N % _.length, me)].push(le);
      }
    }
  }
  if (k[M] < 0 && M !== L) return [n, i, a, r];
  let q = [],
    oe = M,
    U = 0;
  for (; oe >= 0 && U++ < m * p && (q.push((oe % m) + o, ((oe / m) | 0) + h), oe !== L);)
    oe = k[oe];
  q.reverse();
  let Z = [];
  for (let G = q.length - 2; G >= 0; G -= 2) Z.push(q[G], q[G + 1]);
  return Z.length >= 4 ? Z : [n, i, a, r];
}
function Kl(l, e, t, n, i, a, r) {
  let s = Math.max(0, Math.floor(e - n)),
    o = Math.max(0, Math.floor(t - n)),
    h = Math.min(a - 1, Math.ceil(e + n)),
    u = Math.min(r - 1, Math.ceil(t + n)),
    d = i ? l.x : Math.min(l.x, s),
    m = i ? l.y : Math.min(l.y, o),
    p = i ? l.x + l.width : Math.max(l.x + l.width, h + 1),
    v = i ? l.y + l.height : Math.max(l.y + l.height, u + 1),
    g = Math.max(0, p - d),
    w = Math.max(0, v - m),
    k = l.mask;
  if (d !== l.x || m !== l.y || g !== l.width || w !== l.height) {
    let M = new Uint8Array(g * w);
    for (let T = 0; T < l.height; T++) {
      let _ = (T + l.y - m) * g + (l.x - d);
      for (let I = 0; I < l.width; I++) l.mask[T * l.width + I] && (M[_ + I] = 1);
    }
    k = M;
  } else k = l.mask.slice();
  let E = n * n;
  for (let M = o; M <= u; M++) {
    let T = M - m;
    if (!(T < 0 || T >= w))
      for (let _ = s; _ <= h; _++) {
        let I = _ - d;
        if (I < 0 || I >= g) continue;
        let A = _ - e,
          N = M - t;
        A * A + N * N > E || (k[T * g + I] = i ? 0 : 1);
      }
  }
  let L = 0;
  for (let M = 0; M < k.length; M++) k[M] && L++;
  return { x: d, y: m, width: g, height: w, mask: k, count: L };
}
async function Jl(l, e, t, n, i = !1) {
  let a = await ht();
  if (!a || typeof a.subtract_background_fast != 'function')
    throw new Error('Background subtraction requires the Rust/WASM module, which failed to load.');
  return a.subtract_background_fast(l, e, t, n, i);
}
async function Zl(l, e, t, n) {
  let i = await ht();
  if (!i || typeof i.gaussian_blur_fast != 'function')
    throw new Error('Gaussian blur requires the Rust/WASM module, which failed to load.');
  return i.gaussian_blur_fast(l, e, t, n);
}
var Ls = [
    {
      id: 'otsu',
      label: 'Otsu',
      hint: 'Maximises between-class variance. The safe default for bimodal data.',
    },
    {
      id: 'isodata',
      label: 'IsoData',
      hint: `Iterative midpoint between the two class means. ImageJ's "Default".`,
    },
    {
      id: 'li',
      label: 'Li',
      hint: 'Minimum cross-entropy. Good when the object is a small fraction of the frame.',
    },
    {
      id: 'triangle',
      label: 'Triangle',
      hint: 'Geometric; strong when one peak dominates and objects are faint.',
    },
    {
      id: 'yen',
      label: 'Yen',
      hint: 'Maximum correlation criterion. Tends to keep more of the object.',
    },
    {
      id: 'huang',
      label: 'Huang',
      hint: 'Fuzzy-set measure. Tolerant of a broad background peak.',
    },
    {
      id: 'maxEntropy',
      label: 'MaxEntropy',
      hint: 'Kapur-Sahoo-Wong entropy split. Favours faint structure.',
    },
    { id: 'mean', label: 'Mean', hint: 'The image mean. Crude, but a useful sanity reference.' },
    { id: 'moments', label: 'Moments', hint: 'Preserves the first three histogram moments.' },
    { id: 'percentile', label: 'Percentile', hint: 'Assumes a fixed 50% foreground fraction.' },
    { id: 'shanbhag', label: 'Shanbhag', hint: 'Information-measure variant of MaxEntropy.' },
    {
      id: 'minimum',
      label: 'Minimum',
      hint: 'Valley between two peaks after smoothing. Needs a truly bimodal histogram.',
    },
    { id: 'intermodes', label: 'Intermodes', hint: 'Midpoint between two peaks after smoothing.' },
  ],
  Es = 256;
function sh(l, e) {
  return l.max === l.min ? l.min : l.min + (e / Es) * (l.max - l.min);
}
function Si(l, e) {
  return sh(l, e + 1);
}
function Ql(l, e) {
  if (l.max === l.min) return 0;
  let t = Math.floor(((e - l.min) / (l.max - l.min)) * Es);
  return Math.min(Es - 1, Math.max(0, t));
}
function qn(l, e) {
  throw new Error(`${e} requires the Rust/WASM module (${l}), which failed to load.`);
}
async function ec(l, e = 1) {
  let t = await ht();
  (!t || typeof t.build_histogram_fast != 'function') &&
    qn('build_histogram_fast', 'buildHistogram');
  let n = t.build_histogram_fast(l, e);
  return {
    counts: n.counts,
    min: n.min,
    max: n.max,
    total: n.total,
    nonFiniteCount: n.non_finite_count,
  };
}
async function Ts(l, e) {
  let t = await ht();
  return (
    (!t || typeof t.auto_threshold_bin_fast != 'function') &&
      qn('auto_threshold_bin_fast', 'autoThresholdBin'),
    t.auto_threshold_bin_fast(l, e)
  );
}
async function tc(l, e, t, n, i = {}) {
  let a = await ht();
  (!a || typeof a.compute_stability_curve_fast != 'function') &&
    qn('compute_stability_curve_fast', 'computeStabilityCurve');
  let r = a.compute_stability_curve_fast(
      l,
      e,
      t,
      n.min,
      n.max,
      i.samples ?? 64,
      i.maxPixels ?? 25e4,
      i.darkBackground !== !1
    ),
    s = r.bins,
    o = r.values,
    h = r.object_counts,
    u = r.area_fractions,
    d = [];
  for (let m = 0; m < s.length; m++)
    d.push({ bin: s[m], value: o[m], objectCount: h[m], areaFraction: u[m] });
  return { points: d, suggestedBin: r.suggested_bin, plateauWidth: r.plateau_width };
}
var nc = [
  { id: 'none', label: 'Global', hint: 'One threshold for the whole image.' },
  {
    id: 'sauvola',
    label: 'Sauvola',
    hint: 'Local mean and standard deviation. The usual first choice for uneven illumination.',
  },
  {
    id: 'niblack',
    label: 'Niblack',
    hint: 'Local mean minus k\xB7\u03C3. Sensitive in flat background regions.',
  },
  {
    id: 'phansalkar',
    label: 'Phansalkar',
    hint: 'Sauvola variant tuned for low-contrast stained images.',
  },
  { id: 'mean', label: 'Local mean', hint: 'Local mean minus a constant offset.' },
  {
    id: 'median',
    label: 'Local median',
    hint: 'Local median minus a constant offset. Robust to speckle.',
  },
];
async function _s(l, e, t, n) {
  let i = await ht();
  return (
    (!i || typeof i.local_threshold_mask_fast != 'function') &&
      qn('local_threshold_mask_fast', 'localThresholdMask'),
    i.local_threshold_mask_fast(
      l,
      e,
      t,
      n.method,
      n.radius,
      n.k,
      n.r ?? NaN,
      n.offset ?? NaN,
      n.darkBackground !== !1
    )
  );
}
async function Ps(l, e, t, n) {
  let i = await ht();
  return (
    (!i || typeof i.local_auto_threshold_mask_fast != 'function') &&
      qn('local_auto_threshold_mask_fast', 'localAutoThresholdMask'),
    i.local_auto_threshold_mask_fast(
      l,
      e,
      t,
      n.method,
      n.radius,
      n.darkBackground !== !1,
      n.minContrast ?? NaN
    )
  );
}
async function Ua(l, e, t) {
  let n = await ht();
  return (
    (!n || typeof n.global_threshold_mask_fast != 'function') &&
      qn('global_threshold_mask_fast', 'globalThresholdMask'),
    n.global_threshold_mask_fast(l, e, t)
  );
}
var it = Uint8Array,
  vt = Uint16Array,
  Bs = Int32Array,
  $s = new it([
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0, 0,
  ]),
  Us = new it([
    0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13,
    13, 0, 0,
  ]),
  ic = new it([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]),
  uc = function (l, e) {
    for (var t = new vt(31), n = 0; n < 31; ++n) t[n] = e += 1 << l[n - 1];
    for (var i = new Bs(t[30]), n = 1; n < 30; ++n)
      for (var a = t[n]; a < t[n + 1]; ++a) i[a] = ((a - t[n]) << 5) | n;
    return { b: t, r: i };
  },
  dc = uc($s, 2),
  oh = dc.b,
  As = dc.r;
((oh[28] = 258), (As[258] = 28));
var hc = uc(Us, 0),
  of = hc.b,
  ac = hc.r,
  Ds = new vt(32768);
for (Pe = 0; Pe < 32768; ++Pe)
  ((Zt = ((Pe & 43690) >> 1) | ((Pe & 21845) << 1)),
    (Zt = ((Zt & 52428) >> 2) | ((Zt & 13107) << 2)),
    (Zt = ((Zt & 61680) >> 4) | ((Zt & 3855) << 4)),
    (Ds[Pe] = (((Zt & 65280) >> 8) | ((Zt & 255) << 8)) >> 1));
var Zt,
  Pe,
  Li = function (l, e, t) {
    for (var n = l.length, i = 0, a = new vt(e); i < n; ++i) l[i] && ++a[l[i] - 1];
    var r = new vt(e);
    for (i = 1; i < e; ++i) r[i] = (r[i - 1] + a[i - 1]) << 1;
    var s;
    if (t) {
      s = new vt(1 << e);
      var o = 15 - e;
      for (i = 0; i < n; ++i)
        if (l[i])
          for (
            var h = (i << 4) | l[i], u = e - l[i], d = r[l[i] - 1]++ << u, m = d | ((1 << u) - 1);
            d <= m;
            ++d
          )
            s[Ds[d] >> o] = h;
    } else for (s = new vt(n), i = 0; i < n; ++i) l[i] && (s[i] = Ds[r[l[i] - 1]++] >> (15 - l[i]));
    return s;
  },
  Tn = new it(288);
for (Pe = 0; Pe < 144; ++Pe) Tn[Pe] = 8;
var Pe;
for (Pe = 144; Pe < 256; ++Pe) Tn[Pe] = 9;
var Pe;
for (Pe = 256; Pe < 280; ++Pe) Tn[Pe] = 7;
var Pe;
for (Pe = 280; Pe < 288; ++Pe) Tn[Pe] = 8;
var Pe,
  Ha = new it(32);
for (Pe = 0; Pe < 32; ++Pe) Ha[Pe] = 5;
var Pe,
  lh = Li(Tn, 9, 0);
var ch = Li(Ha, 5, 0);
var mc = function (l) {
    return ((l + 7) / 8) | 0;
  },
  fc = function (l, e, t) {
    return (
      (e == null || e < 0) && (e = 0),
      (t == null || t > l.length) && (t = l.length),
      new it(l.subarray(e, t))
    );
  };
var uh = [
    'unexpected EOF',
    'invalid block type',
    'invalid length/literal',
    'invalid distance',
    'stream finished',
    'no stream handler',
    ,
    'no callback',
    'invalid UTF-8 data',
    'extra field too long',
    'date not in range 1980-2099',
    'filename too long',
    'stream finishing',
    'invalid zip data',
  ],
  za = function (l, e, t) {
    var n = new Error(e || uh[l]);
    if (((n.code = l), Error.captureStackTrace && Error.captureStackTrace(n, za), !t)) throw n;
    return n;
  };
var Qt = function (l, e, t) {
    t <<= e & 7;
    var n = (e / 8) | 0;
    ((l[n] |= t), (l[n + 1] |= t >> 8));
  },
  Ri = function (l, e, t) {
    t <<= e & 7;
    var n = (e / 8) | 0;
    ((l[n] |= t), (l[n + 1] |= t >> 8), (l[n + 2] |= t >> 16));
  },
  Is = function (l, e) {
    for (var t = [], n = 0; n < l.length; ++n) l[n] && t.push({ s: n, f: l[n] });
    var i = t.length,
      a = t.slice();
    if (!i) return { t: gc, l: 0 };
    if (i == 1) {
      var r = new it(t[0].s + 1);
      return ((r[t[0].s] = 1), { t: r, l: 1 });
    }
    (t.sort(function (T, _) {
      return T.f - _.f;
    }),
      t.push({ s: -1, f: 25001 }));
    var s = t[0],
      o = t[1],
      h = 0,
      u = 1,
      d = 2;
    for (t[0] = { s: -1, f: s.f + o.f, l: s, r: o }; u != i - 1;)
      ((s = t[t[h].f < t[d].f ? h++ : d++]),
        (o = t[h != u && t[h].f < t[d].f ? h++ : d++]),
        (t[u++] = { s: -1, f: s.f + o.f, l: s, r: o }));
    for (var m = a[0].s, n = 1; n < i; ++n) a[n].s > m && (m = a[n].s);
    var p = new vt(m + 1),
      v = Fs(t[u - 1], p, 0);
    if (v > e) {
      var n = 0,
        g = 0,
        w = v - e,
        k = 1 << w;
      for (
        a.sort(function (_, I) {
          return p[I.s] - p[_.s] || _.f - I.f;
        });
        n < i;
        ++n
      ) {
        var E = a[n].s;
        if (p[E] > e) ((g += k - (1 << (v - p[E]))), (p[E] = e));
        else break;
      }
      for (g >>= w; g > 0;) {
        var L = a[n].s;
        p[L] < e ? (g -= 1 << (e - p[L]++ - 1)) : ++n;
      }
      for (; n >= 0 && g; --n) {
        var M = a[n].s;
        p[M] == e && (--p[M], ++g);
      }
      v = e;
    }
    return { t: new it(p), l: v };
  },
  Fs = function (l, e, t) {
    return l.s == -1 ? Math.max(Fs(l.l, e, t + 1), Fs(l.r, e, t + 1)) : (e[l.s] = t);
  },
  rc = function (l) {
    for (var e = l.length; e && !l[--e];);
    for (
      var t = new vt(++e),
        n = 0,
        i = l[0],
        a = 1,
        r = function (o) {
          t[n++] = o;
        },
        s = 1;
      s <= e;
      ++s
    )
      if (l[s] == i && s != e) ++a;
      else {
        if (!i && a > 2) {
          for (; a > 138; a -= 138) r(32754);
          a > 2 && (r(a > 10 ? ((a - 11) << 5) | 28690 : ((a - 3) << 5) | 12305), (a = 0));
        } else if (a > 3) {
          for (r(i), --a; a > 6; a -= 6) r(8304);
          a > 2 && (r(((a - 3) << 5) | 8208), (a = 0));
        }
        for (; a--;) r(i);
        ((a = 1), (i = l[s]));
      }
    return { c: t.subarray(0, n), n: e };
  },
  Ei = function (l, e) {
    for (var t = 0, n = 0; n < e.length; ++n) t += l[n] * e[n];
    return t;
  },
  pc = function (l, e, t) {
    var n = t.length,
      i = mc(e + 2);
    ((l[i] = n & 255), (l[i + 1] = n >> 8), (l[i + 2] = l[i] ^ 255), (l[i + 3] = l[i + 1] ^ 255));
    for (var a = 0; a < n; ++a) l[i + a + 4] = t[a];
    return (i + 4 + n) * 8;
  },
  sc = function (l, e, t, n, i, a, r, s, o, h, u) {
    (Qt(e, u++, t), ++i[256]);
    for (
      var d = Is(i, 15),
        m = d.t,
        p = d.l,
        v = Is(a, 15),
        g = v.t,
        w = v.l,
        k = rc(m),
        E = k.c,
        L = k.n,
        M = rc(g),
        T = M.c,
        _ = M.n,
        I = new vt(19),
        A = 0;
      A < E.length;
      ++A
    )
      ++I[E[A] & 31];
    for (var A = 0; A < T.length; ++A) ++I[T[A] & 31];
    for (var N = Is(I, 7), z = N.t, X = N.l, ae = 19; ae > 4 && !z[ic[ae - 1]]; --ae);
    var Q = (h + 5) << 3,
      j = Ei(i, Tn) + Ei(a, Ha) + r,
      q = Ei(i, m) + Ei(a, g) + r + 14 + 3 * ae + Ei(I, z) + 2 * I[16] + 3 * I[17] + 7 * I[18];
    if (o >= 0 && Q <= j && Q <= q) return pc(e, u, l.subarray(o, o + h));
    var oe, U, Z, G;
    if ((Qt(e, u, 1 + (q < j)), (u += 2), q < j)) {
      ((oe = Li(m, p, 0)), (U = m), (Z = Li(g, w, 0)), (G = g));
      var re = Li(z, X, 0);
      (Qt(e, u, L - 257), Qt(e, u + 5, _ - 1), Qt(e, u + 10, ae - 4), (u += 14));
      for (var A = 0; A < ae; ++A) Qt(e, u + 3 * A, z[ic[A]]);
      u += 3 * ae;
      for (var ee = [E, T], ye = 0; ye < 2; ++ye)
        for (var ve = ee[ye], A = 0; A < ve.length; ++A) {
          var Ae = ve[A] & 31;
          (Qt(e, u, re[Ae]),
            (u += z[Ae]),
            Ae > 15 && (Qt(e, u, (ve[A] >> 5) & 127), (u += ve[A] >> 12)));
        }
    } else ((oe = lh), (U = Tn), (Z = ch), (G = Ha));
    for (var A = 0; A < s; ++A) {
      var _e = n[A];
      if (_e > 255) {
        var Ae = (_e >> 18) & 31;
        (Ri(e, u, oe[Ae + 257]),
          (u += U[Ae + 257]),
          Ae > 7 && (Qt(e, u, (_e >> 23) & 31), (u += $s[Ae])));
        var le = _e & 31;
        (Ri(e, u, Z[le]), (u += G[le]), le > 3 && (Ri(e, u, (_e >> 5) & 8191), (u += Us[le])));
      } else (Ri(e, u, oe[_e]), (u += U[_e]));
    }
    return (Ri(e, u, oe[256]), u + U[256]);
  },
  dh = new Bs([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]),
  gc = new it(0),
  hh = function (l, e, t, n, i, a) {
    var r = a.z || l.length,
      s = new it(n + r + 5 * (1 + Math.ceil(r / 7e3)) + i),
      o = s.subarray(n, s.length - i),
      h = a.l,
      u = (a.r || 0) & 7;
    if (e) {
      u && (o[0] = a.r >> 3);
      for (
        var d = dh[e - 1],
          m = d >> 13,
          p = d & 8191,
          v = (1 << t) - 1,
          g = a.p || new vt(32768),
          w = a.h || new vt(v + 1),
          k = Math.ceil(t / 3),
          E = 2 * k,
          L = function (he) {
            return (l[he] ^ (l[he + 1] << k) ^ (l[he + 2] << E)) & v;
          },
          M = new Bs(25e3),
          T = new vt(288),
          _ = new vt(32),
          I = 0,
          A = 0,
          N = a.i || 0,
          z = 0,
          X = a.w || 0,
          ae = 0;
        N + 2 < r;
        ++N
      ) {
        var Q = L(N),
          j = N & 32767,
          q = w[Q];
        if (((g[j] = q), (w[Q] = j), X <= N)) {
          var oe = r - N;
          if ((I > 7e3 || z > 24576) && (oe > 423 || !h)) {
            ((u = sc(l, o, 0, M, T, _, A, z, ae, N - ae, u)), (z = I = A = 0), (ae = N));
            for (var U = 0; U < 286; ++U) T[U] = 0;
            for (var U = 0; U < 30; ++U) _[U] = 0;
          }
          var Z = 2,
            G = 0,
            re = p,
            ee = (j - q) & 32767;
          if (oe > 2 && Q == L(N - ee))
            for (
              var ye = Math.min(m, oe) - 1, ve = Math.min(32767, N), Ae = Math.min(258, oe);
              ee <= ve && --re && j != q;
            ) {
              if (l[N + Z] == l[N + Z - ee]) {
                for (var _e = 0; _e < Ae && l[N + _e] == l[N + _e - ee]; ++_e);
                if (_e > Z) {
                  if (((Z = _e), (G = ee), _e > ye)) break;
                  for (var le = Math.min(ee, _e - 2), Le = 0, U = 0; U < le; ++U) {
                    var me = (N - ee + U) & 32767,
                      Ce = g[me],
                      de = (me - Ce) & 32767;
                    de > Le && ((Le = de), (q = me));
                  }
                }
              }
              ((j = q), (q = g[j]), (ee += (j - q) & 32767));
            }
          if (G) {
            M[z++] = 268435456 | (As[Z] << 18) | ac[G];
            var ce = As[Z] & 31,
              ue = ac[G] & 31;
            ((A += $s[ce] + Us[ue]), ++T[257 + ce], ++_[ue], (X = N + Z), ++I);
          } else ((M[z++] = l[N]), ++T[l[N]]);
        }
      }
      for (N = Math.max(N, X); N < r; ++N) ((M[z++] = l[N]), ++T[l[N]]);
      ((u = sc(l, o, h, M, T, _, A, z, ae, N - ae, u)),
        h ||
          ((a.r = (u & 7) | (o[(u / 8) | 0] << 3)),
          (u -= 7),
          (a.h = w),
          (a.p = g),
          (a.i = N),
          (a.w = X)));
    } else {
      for (var N = a.w || 0; N < r + h; N += 65535) {
        var V = N + 65535;
        (V >= r && ((o[(u / 8) | 0] = h), (V = r)), (u = pc(o, u + 1, l.subarray(N, V))));
      }
      a.i = r;
    }
    return fc(s, 0, n + mc(u) + i);
  },
  mh = (function () {
    for (var l = new Int32Array(256), e = 0; e < 256; ++e) {
      for (var t = e, n = 9; --n;) t = (t & 1 && -306674912) ^ (t >>> 1);
      l[e] = t;
    }
    return l;
  })(),
  fh = function () {
    var l = -1;
    return {
      p: function (e) {
        for (var t = l, n = 0; n < e.length; ++n) t = mh[(t & 255) ^ e[n]] ^ (t >>> 8);
        l = t;
      },
      d: function () {
        return ~l;
      },
    };
  };
var ph = function (l, e, t, n, i) {
    if (!i && ((i = { l: 1 }), e.dictionary)) {
      var a = e.dictionary.subarray(-32768),
        r = new it(a.length + l.length);
      (r.set(a), r.set(l, a.length), (l = r), (i.w = a.length));
    }
    return hh(
      l,
      e.level == null ? 6 : e.level,
      e.mem == null
        ? i.l
          ? Math.ceil(Math.max(8, Math.min(13, Math.log(l.length))) * 1.5)
          : 20
        : 12 + e.mem,
      t,
      n,
      i
    );
  },
  bc = function (l, e) {
    var t = {};
    for (var n in l) t[n] = l[n];
    for (var n in e) t[n] = e[n];
    return t;
  };
var Ze = function (l, e, t) {
  for (; t; ++e) ((l[e] = t), (t >>>= 8));
};
function gh(l, e) {
  return ph(l, e || {}, 0, 0);
}
var yc = function (l, e, t, n) {
    for (var i in l) {
      var a = l[i],
        r = e + i,
        s = n;
      (Array.isArray(a) && ((s = bc(n, a[1])), (a = a[0])),
        ArrayBuffer.isView(a)
          ? (t[r] = [a, s])
          : ((t[(r += '/')] = [new it(0), s]), yc(a, r, t, n)));
    }
  },
  oc = typeof TextEncoder < 'u' && new TextEncoder(),
  bh = typeof TextDecoder < 'u' && new TextDecoder(),
  yh = 0;
try {
  (bh.decode(gc, { stream: !0 }), (yh = 1));
} catch {}
function lc(l, e) {
  if (e) {
    for (var t = new it(l.length), n = 0; n < l.length; ++n) t[n] = l.charCodeAt(n);
    return t;
  }
  if (oc) return oc.encode(l);
  for (
    var i = l.length,
      a = new it(l.length + (l.length >> 1)),
      r = 0,
      s = function (u) {
        a[r++] = u;
      },
      n = 0;
    n < i;
    ++n
  ) {
    if (r + 5 > a.length) {
      var o = new it(r + 8 + ((i - n) << 1));
      (o.set(a), (a = o));
    }
    var h = l.charCodeAt(n);
    h < 128 || e
      ? s(h)
      : h < 2048
        ? (s(192 | (h >> 6)), s(128 | (h & 63)))
        : h > 55295 && h < 57344
          ? ((h = (65536 + (h & 1047552)) | (l.charCodeAt(++n) & 1023)),
            s(240 | (h >> 18)),
            s(128 | ((h >> 12) & 63)),
            s(128 | ((h >> 6) & 63)),
            s(128 | (h & 63)))
          : (s(224 | (h >> 12)), s(128 | ((h >> 6) & 63)), s(128 | (h & 63)));
  }
  return fc(a, 0, r);
}
var Ns = function (l) {
    var e = 0;
    if (l)
      for (var t in l) {
        var n = l[t].length;
        (n > 65535 && za(9), (e += n + 4));
      }
    return e;
  },
  cc = function (l, e, t, n, i, a, r, s) {
    var o = n.length,
      h = t.extra,
      u = s && s.length,
      d = Ns(h);
    (Ze(l, e, r != null ? 33639248 : 67324752),
      (e += 4),
      r != null && ((l[e++] = 20), (l[e++] = t.os)),
      (l[e] = 20),
      (e += 2),
      (l[e++] = (t.flag << 1) | (a < 0 && 8)),
      (l[e++] = i && 8),
      (l[e++] = t.compression & 255),
      (l[e++] = t.compression >> 8));
    var m = new Date(t.mtime == null ? Date.now() : t.mtime),
      p = m.getFullYear() - 1980;
    if (
      ((p < 0 || p > 119) && za(10),
      Ze(
        l,
        e,
        (p << 25) |
          ((m.getMonth() + 1) << 21) |
          (m.getDate() << 16) |
          (m.getHours() << 11) |
          (m.getMinutes() << 5) |
          (m.getSeconds() >> 1)
      ),
      (e += 4),
      a != -1 && (Ze(l, e, t.crc), Ze(l, e + 4, a < 0 ? -a - 2 : a), Ze(l, e + 8, t.size)),
      Ze(l, e + 12, o),
      Ze(l, e + 14, d),
      (e += 16),
      r != null && (Ze(l, e, u), Ze(l, e + 6, t.attrs), Ze(l, e + 10, r), (e += 14)),
      l.set(n, e),
      (e += o),
      d)
    )
      for (var v in h) {
        var g = h[v],
          w = g.length;
        (Ze(l, e, +v), Ze(l, e + 2, w), l.set(g, e + 4), (e += 4 + w));
      }
    return (u && (l.set(s, e), (e += u)), e);
  },
  vh = function (l, e, t, n, i) {
    (Ze(l, e, 101010256), Ze(l, e + 8, t), Ze(l, e + 10, t), Ze(l, e + 12, n), Ze(l, e + 16, i));
  };
function vc(l, e) {
  e || (e = {});
  var t = {},
    n = [];
  yc(l, '', t, e);
  var i = 0,
    a = 0;
  for (var r in t) {
    var s = t[r],
      o = s[0],
      h = s[1],
      u = h.level == 0 ? 0 : 8,
      d = lc(r),
      m = d.length,
      p = h.comment,
      v = p && lc(p),
      g = v && v.length,
      w = Ns(h.extra);
    m > 65535 && za(11);
    var k = u ? gh(o, h) : o,
      E = k.length,
      L = fh();
    (L.p(o),
      n.push(
        bc(h, {
          size: o.length,
          crc: L.d(),
          c: k,
          f: d,
          m: v,
          u: m != r.length || (v && p.length != g),
          o: i,
          compression: u,
        })
      ),
      (i += 30 + m + w + E),
      (a += 76 + 2 * (m + w) + (g || 0) + E));
  }
  for (var M = new it(a + 22), T = i, _ = a - i, I = 0; I < n.length; ++I) {
    var d = n[I];
    cc(M, d.o, d, d.f, d.u, d.c.length);
    var A = 30 + d.f.length + Ns(d.extra);
    (M.set(d.c, d.o + A),
      cc(M, i, d, d.f, d.u, d.c.length, d.o, d.m),
      (i += 16 + A + (d.m ? d.m.length : 0)));
  }
  return (vh(M, i, n.length, _, T), M);
}
function xc(l) {
  return l
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
}
function xh(l) {
  let e = '',
    t = l;
  do ((e = String.fromCharCode(65 + (t % 26)) + e), (t = Math.floor(t / 26) - 1));
  while (t >= 0);
  return e;
}
function wh(l, e, t) {
  if (t == null || t === '') return '';
  let n = `${xh(e)}${l}`;
  if (typeof t == 'number') {
    if (!Number.isFinite(t)) {
      let i = Number.isNaN(t) ? 'NaN' : t > 0 ? 'Inf' : '-Inf';
      return `<c r="${n}" t="inlineStr"><is><t>${i}</t></is></c>`;
    }
    return `<c r="${n}"><v>${t}</v></c>`;
  }
  return `<c r="${n}" t="inlineStr"><is><t xml:space="preserve">${xc(String(t))}</t></is></c>`;
}
function wc(l) {
  let e = new TextEncoder(),
    t = xc(l.name.replace(/[\\/*?:[\]]/g, '_').slice(0, 31) || 'Results'),
    i = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${l.rows
      .map((h, u) => {
        let d = u + 1,
          m = h.map((p, v) => wh(d, v, p)).join('');
        return `<row r="${d}">${m}</row>`;
      })
      .join('')}</sheetData></worksheet>`,
    a = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${t}" sheetId="1" r:id="rId1"/></sheets></workbook>`;
  return vc({
    '[Content_Types].xml': e.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>`),
    '_rels/.rels': e.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`),
    'xl/workbook.xml': e.encode(a),
    'xl/_rels/workbook.xml.rels': e.encode(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`),
    'xl/worksheets/sheet1.xml': e.encode(i),
  });
}
function Mh(l) {
  let e = window.CSS;
  return e && typeof e.escape == 'function' ? e.escape(l) : l.replace(/["\\]/g, '\\$&');
}
var Ch = {
    method: 'otsu',
    localMethod: 'none',
    localizeGlobal: !1,
    localRadius: 15,
    localK: 0.25,
    low: 0,
    high: 1,
    darkBackground: !0,
    blurSigma: 0,
    backgroundRadius: 0,
    split: 'none',
    prominence: 0,
    fillHoles: !0,
    excludeEdges: !1,
    minArea: 10,
    maxArea: Number.POSITIVE_INFINITY,
    minCircularity: 0,
    maxCircularity: 1,
    manual: !1,
  },
  Mc = [
    { id: 'select', label: 'Select', key: 'V' },
    { id: 'rect', label: 'Rect', key: 'R' },
    { id: 'ellipse', label: 'Ellipse', key: 'E' },
    { id: 'polygon', label: 'Polygon', key: 'P' },
    { id: 'freehand', label: 'Freehand', key: 'F' },
    { id: 'line', label: 'Line', key: 'L' },
    { id: 'polyline', label: 'Polyline' },
    { id: 'point', label: 'Points', key: 'N' },
    { id: 'wand', label: 'Wand', key: 'W' },
    { id: 'brush', label: 'Brush', key: 'B' },
    { id: 'livewire', label: 'Trace edge' },
  ],
  Ti = class Ti {
    constructor(e) {
      this.tabButtons = new Map();
      this.tab = 'tools';
      this.rows = [];
      this.derivedColumns = [];
      this.visibleColumns = [...gl];
      this.collecting = !1;
      this.collected = new Map();
      this.groupPattern = '';
      this.channelMode = 'first';
      this.threshold = { ...Ch };
      this.histogram = null;
      this.stability = null;
      this.thresholdMask = null;
      this.previewPlane = null;
      this.thresholdToken = 0;
      this.thresholdPrepareBusy = !1;
      this.thresholdApplyBusy = !1;
      this.stabilityBusy = !1;
      this.methodBins = null;
      this.methodBinsBusy = !1;
      this.hoverToken = 0;
      this.pendingCalibrationDistance = 0;
      this.measureHandle = 0;
      this.particleResult = null;
      this.particleToken = 0;
      this.particleAnalysisRunning = !1;
      this.showMaskOverlay = !0;
      this.isDragging = !1;
      this.dragOffset = { x: 0, y: 0 };
      this.maskToggle = null;
      this.roiToggle = null;
      this.scrollOffsets = new Map();
      this.selectionFromTable = !1;
      this.lastSelectionKey = '';
      this.pendingRowReveal = null;
      ((this.host = e),
        (this.overlayRoot = document.createElement('div')),
        (this.overlayRoot.className = 'measure-panel'),
        (this.overlayRoot.style.display = 'none'));
      let t = document.createElement('div');
      t.className = 'measure-header';
      let n = document.createElement('div');
      ((n.className = 'measure-title'), (n.textContent = 'Measure'));
      let i = document.createElement('div');
      i.className = 'measure-spacer';
      let a = document.createElement('button');
      ((a.className = 'measure-chip'),
        (a.textContent = 'Mask'),
        (a.title = 'Show the threshold over the image (M)'),
        (a.onclick = () => {
          ((this.showMaskOverlay = !this.showMaskOverlay),
            this.refreshMaskOverlay(),
            this.syncHeaderToggles());
        }));
      let r = document.createElement('button');
      ((r.className = 'measure-chip'),
        (r.textContent = 'ROIs'),
        (r.title = 'Show the ROI outlines (O). Hiding them does not delete anything.'),
        (r.onclick = () => {
          (this.host.overlay.setShowRois(!this.host.overlay.getShowRois()),
            this.syncHeaderToggles());
        }),
        (this.maskToggle = a),
        (this.roiToggle = r));
      let s = document.createElement('button');
      ((s.className = 'measure-close'),
        (s.textContent = '\xD7'),
        (s.title = 'Close the measure panel'),
        (s.onclick = () => this.hide()),
        t.append(n, i, a, r, s),
        (t.style.cursor = 'move'),
        (t.onmousedown = u => this.startDrag(u)));
      let o = document.createElement('div');
      o.className = 'measure-tabs';
      let h = [
        { id: 'tools', label: 'Tools' },
        { id: 'rois', label: 'ROIs' },
        { id: 'results', label: 'Results' },
        { id: 'segment', label: 'Segment' },
        { id: 'setup', label: 'Scale' },
      ];
      for (let u of h) {
        let d = document.createElement('button');
        ((d.className = 'measure-tab'),
          (d.textContent = u.label),
          (d.onclick = () => this.setTab(u.id)),
          o.appendChild(d),
          this.tabButtons.set(u.id, d));
      }
      ((this.body = document.createElement('div')),
        (this.body.className = 'measure-body'),
        (this.hintLine = document.createElement('div')),
        (this.hintLine.className = 'measure-hint'),
        this.overlayRoot.append(t, o, this.body, this.hintLine));
      for (let u of ['mousedown', 'click', 'dblclick', 'wheel', 'contextmenu'])
        this.overlayRoot.addEventListener(u, d => d.stopPropagation());
      (document.body.appendChild(this.overlayRoot), this.setTab('tools'), this.syncHeaderToggles());
    }
    syncHeaderToggles() {
      (this.maskToggle?.classList.toggle('active', this.showMaskOverlay),
        this.roiToggle?.classList.toggle('active', this.host.overlay.getShowRois()));
    }
    show() {
      ((this.overlayRoot.style.display = 'flex'), this.host.overlay.setActive(!0), this.refresh());
    }
    hide() {
      ((this.overlayRoot.style.display = 'none'),
        this.host.overlay.setActive(!1),
        this.host.overlay.setTool('select'),
        this.host.overlay.setMaskPreview(null));
    }
    isVisible() {
      return this.overlayRoot.style.display !== 'none';
    }
    toggle() {
      this.isVisible() ? this.hide() : this.show();
    }
    setHint(e) {
      this.hintLine.textContent = e;
    }
    setTab(e) {
      this.tab = e;
      for (let [t, n] of this.tabButtons) n.classList.toggle('active', t === e);
      if (e === 'results') {
        let t = this.host.manager.selectedIds();
        t.length > 0 && (this.pendingRowReveal = t[0]);
      }
      this.render();
    }
    onImageChanged() {
      ((this.histogram = null),
        (this.stability = null),
        (this.thresholdMask = null),
        (this.previewPlane = null),
        (this.particleResult = null),
        this.particleToken++,
        (this.showMaskOverlay = !0),
        this.host.overlay.invalidateImage(),
        this.scheduleMeasure());
    }
    scheduleMeasure() {
      this.measureHandle ||
        (this.measureHandle = requestAnimationFrame(() => {
          ((this.measureHandle = 0),
            this.measure(),
            (this.tab === 'results' || this.tab === 'rois' || this.tab === 'tools') &&
              this.render());
        }));
    }
    measure() {
      let e = this.host.getSource();
      if (!e) {
        this.rows = [];
        return;
      }
      let t =
        this.channelMode === 'all' ? Array.from({ length: e.channels || 1 }, (n, i) => i) : [0];
      ((this.rows = Ol(this.host.manager.list(), e, this.host.getCalibration(), t)),
        this.collecting &&
          e.fileName &&
          this.rows.length > 0 &&
          this.collected.set(e.fileName, {
            rows: this.rows.map(n => ({ ...n })),
            provenance: this.provenance(),
            extraColumns: this.extraColumns(),
          }));
    }
    exportRows() {
      if (!this.collecting) return this.rows;
      let e = [];
      for (let t of this.collected.values()) e.push(...t.rows);
      return e;
    }
    snapshotFor(e) {
      return e.fileName ? this.collected.get(e.fileName) : void 0;
    }
    getRows() {
      return this.rows;
    }
    refresh() {
      (this.measure(), this.render());
    }
    render() {
      switch (
        (this.syncHeaderToggles(),
        this.captureScrollOffsets(),
        this.noteSelectionChange(),
        (this.body.textContent = ''),
        this.tab)
      ) {
        case 'tools':
          this.renderTools();
          break;
        case 'rois':
          this.renderRois();
          break;
        case 'results':
          this.renderResults();
          break;
        case 'segment':
          this.renderSegment();
          break;
        case 'setup':
          this.renderSetup();
          break;
      }
      this.restoreScrollOffsets();
    }
    captureScrollOffsets() {
      for (let e of Ti.SCROLLABLES) {
        let t = this.body.querySelector(e);
        t && this.scrollOffsets.set(e, t.scrollTop);
      }
    }
    restoreScrollOffsets() {
      for (let e of Ti.SCROLLABLES) {
        let t = this.body.querySelector(e),
          n = this.scrollOffsets.get(e);
        t && n !== void 0 && (t.scrollTop = n);
      }
      if (this.pendingRowReveal) {
        let e = this.pendingRowReveal;
        this.pendingRowReveal = null;
        let t = this.body.querySelector('.measure-results-wrapper'),
          n = t?.querySelector(`[data-roi-id="${Mh(e)}"]`);
        if (t && n) {
          let i = n.offsetTop - (t.clientHeight - n.offsetHeight) / 2;
          ((t.scrollTop = Math.max(0, i)),
            this.scrollOffsets.set('.measure-results-wrapper', t.scrollTop));
        }
      }
    }
    noteSelectionChange() {
      let e = this.host.manager.selectedIds().join(',');
      (e !== this.lastSelectionKey &&
        (!this.selectionFromTable && e && (this.pendingRowReveal = e.split(',')[0]),
        (this.lastSelectionKey = e)),
        (this.selectionFromTable = !1));
    }
    renderTools() {
      let e = this.section('Tool'),
        t = document.createElement('div');
      t.className = 'measure-tool-grid';
      for (let s of Mc) {
        let o = document.createElement('button');
        ((o.className = 'measure-tool'),
          (o.textContent = s.label),
          (o.title = s.key ? `${s.label} (${s.key})` : s.label),
          o.classList.toggle('active', this.host.overlay.getTool() === s.id),
          (o.onclick = () => {
            (this.host.overlay.setTool(s.id), this.render());
          }),
          t.appendChild(o));
      }
      e.appendChild(t);
      let n = this.host.overlay.getTool();
      if (n === 'wand') {
        let s = this.section('Wand'),
          o = this.host.overlay.getWandTolerance() === null;
        (s.appendChild(
          this.checkbox(
            'Choose tolerance automatically',
            o,
            h => {
              (this.host.overlay.setWandTolerance(h ? null : 1), this.render());
            },
            'Sweeps the tolerance and keeps the value at which the region stops growing \u2014 the object boundary \u2014 instead of asking you to guess one.'
          )
        ),
          o ||
            s.appendChild(
              this.numberRow(
                'Tolerance',
                this.host.overlay.getWandTolerance() ?? 1,
                h => this.host.overlay.setWandTolerance(h),
                { step: 'any', min: 0 }
              )
            ),
          s.appendChild(
            this.note(
              'Hover to preview, scroll to adjust, Shift-click to merge into the selected object.'
            )
          ));
      }
      if (n === 'brush') {
        let s = this.section('Brush');
        (s.appendChild(
          this.numberRow(
            'Radius (px)',
            this.host.overlay.getBrushRadius(),
            o => this.host.overlay.setBrushRadius(o),
            { step: '1', min: 1 }
          )
        ),
          s.appendChild(
            this.note('Paints into the selected object. Alt-drag erases, scroll resizes.')
          ));
      }
      let i = this.section('Overlay');
      (i.appendChild(
        this.checkbox(
          'Show all ROI names',
          !1,
          s => this.host.overlay.setShowLabels(s),
          'Off by default: only the object you point at or have selected is named, so a segmented field stays readable.'
        )
      ),
        i.appendChild(
          this.note(
            'Mask and ROIs toggle from the header, or with M and O. The scale bar toggles from the image right-click menu. Hold H to hide everything and look at the raw image.'
          )
        ));
      let a = this.host.manager.selectedRois(),
        r = a.find(s => Yn(s.kind));
      r
        ? this.body.appendChild(this.buildProfileSection(r))
        : a.length === 1 && this.body.appendChild(this.buildQuickStats(a[0]));
    }
    renderRois() {
      let e = this.host.manager,
        t = this.section(`ROIs (${e.count()})`);
      if (e.count() === 0)
        t.appendChild(
          this.note(
            'No ROIs yet. Pick a tool and draw on the image, or import an ImageJ ROI set below.'
          )
        );
      else {
        let s = document.createElement('div');
        s.className = 'measure-roi-list';
        for (let o of e.list()) s.appendChild(this.buildRoiRow(o));
        t.appendChild(s);
      }
      let n = this.section('Edit'),
        i = document.createElement('div');
      ((i.className = 'measure-button-row'),
        i.append(
          this.button('Undo', () => e.undo(), !e.canUndo()),
          this.button('Redo', () => e.redo(), !e.canRedo()),
          this.button(
            'Delete selected',
            () => e.remove(e.selectedIds()),
            e.selectedIds().length === 0
          ),
          this.button('Renumber', () => e.renumber(), e.count() === 0),
          this.button('Clear all', () => e.clear(), e.count() === 0)
        ),
        n.appendChild(i));
      let a = this.section('Store and exchange'),
        r = document.createElement('div');
      ((r.className = 'measure-button-row'),
        r.append(
          this.button('Save ROIs', () => this.saveSidecar(), e.count() === 0),
          this.button('Load ROIs', () => this.host.requestImport('sidecar')),
          this.button('Import ImageJ\u2026', () => this.host.requestImport('imagej')),
          this.button('Export ImageJ', () => this.exportImageJ(), e.count() === 0)
        ),
        a.appendChild(r),
        a.appendChild(
          this.note(
            'ROIs are saved as a readable JSON file next to the image, so they diff in review and can be edited by hand. ImageJ .roi / RoiSet.zip is supported for exchange.'
          )
        ));
    }
    buildRoiRow(e) {
      let t = this.host.manager,
        n = document.createElement('div');
      ((n.className = 'measure-roi-row'), n.classList.toggle('selected', t.isSelected(e.id)));
      let i = document.createElement('span');
      ((i.className = 'measure-roi-swatch'), (i.style.background = e.color || '#ffd400'));
      let a = document.createElement('input');
      ((a.className = 'measure-roi-name'),
        (a.value = e.name),
        (a.onchange = () => t.rename(e.id, a.value.trim() || e.name)),
        (a.onkeydown = o => o.stopPropagation()));
      let r = document.createElement('span');
      ((r.className = 'measure-roi-kind'), (r.textContent = e.kind));
      let s = document.createElement('button');
      return (
        (s.className = 'measure-roi-remove'),
        (s.textContent = '\xD7'),
        (s.title = 'Delete this ROI'),
        (s.onclick = o => {
          (o.stopPropagation(), t.remove([e.id]));
        }),
        n.append(i, a, r, s),
        (n.onmouseenter = () => this.host.overlay.setHoveredRoi(e.id)),
        (n.onmouseleave = () => this.host.overlay.setHoveredRoi(null)),
        (n.onclick = o => {
          if (o.target === a) return;
          let h = o.shiftKey || o.ctrlKey || o.metaKey;
          ((this.selectionFromTable = !0),
            t.select([e.id], { additive: h }),
            h || this.host.overlay.revealRoi(e.id));
        }),
        n
      );
    }
    buildQuickStats(e) {
      let t = document.createElement('div');
      t.className = 'measure-section';
      let n = document.createElement('div');
      ((n.className = 'measure-section-title'), (n.textContent = e.name), t.appendChild(n));
      let i = this.rows.find(o => o.roiId === e.id);
      if (!i) return (t.appendChild(this.note('Not measurable on this image.')), t);
      let a = this.host.getCalibration(),
        r = document.createElement('div');
      r.className = 'measure-quick-stats';
      let s = [];
      (i.area !== void 0 && s.push(['Area', `${Se(i.area)} ${Aa(a)}`]),
        i.length !== void 0 && s.push(['Length', `${Se(i.length)} ${a.unit}`]),
        i.perimeter !== void 0 && s.push(['Perimeter', `${Se(i.perimeter)} ${a.unit}`]),
        i.mean !== void 0 && s.push(['Mean', Se(i.mean, 6)]),
        i.stdDev !== void 0 && s.push(['StdDev', Se(i.stdDev, 6)]),
        i.min !== void 0 && s.push(['Min / Max', `${Se(i.min, 6)} / ${Se(i.max, 6)}`]),
        i.circularity !== void 0 && s.push(['Circularity', Se(i.circularity, 3)]),
        i.feret !== void 0 && s.push(['Feret', `${Se(i.feret)} ${a.unit}`]),
        i.pixelCount !== void 0 && s.push(['Pixels', String(i.pixelCount)]),
        i.nonFiniteCount && s.push(['NaN / Inf pixels', String(i.nonFiniteCount)]));
      for (let [o, h] of s) {
        let u = document.createElement('div');
        ((u.className = 'measure-quick-label'), (u.textContent = o));
        let d = document.createElement('div');
        ((d.className = 'measure-quick-value'), (d.textContent = h), r.append(u, d));
      }
      return (t.appendChild(r), t);
    }
    buildProfileSection(e) {
      let t = document.createElement('div');
      t.className = 'measure-section';
      let n = document.createElement('div');
      ((n.className = 'measure-section-title'),
        (n.textContent = `Profile \u2014 ${e.name}`),
        t.appendChild(n));
      let i = this.host.getSource();
      if (!i) return (t.appendChild(this.note('No image loaded.')), t);
      let a = this.host.getCalibration(),
        r = Math.min(i.channels || 1, 4),
        s = [],
        o = ['#ff6b6b', '#5ac85a', '#5a9cff', '#cccccc'],
        h = new Float64Array(0);
      for (let m = 0; m < r; m++) {
        let p = Ba(i, e, m);
        ((h = p.distance), s.push({ values: p.value, color: r === 1 ? '#ffd400' : o[m] }));
      }
      let u = document.createElement('canvas');
      ((u.className = 'measure-profile'),
        (u.width = 460),
        (u.height = 150),
        this.drawProfile(u, h, s, a),
        t.appendChild(u));
      let d = document.createElement('div');
      return (
        (d.className = 'measure-row'),
        d.appendChild(
          this.numberRow(
            'Line width (px)',
            e.lineWidth || 1,
            m =>
              this.host.manager.update(e.id, p => ({
                ...p,
                lineWidth: Math.max(1, Math.round(m)),
              })),
            { step: '1', min: 1 }
          )
        ),
        t.appendChild(d),
        t.appendChild(this.button('Export profile as CSV', () => this.exportProfile(e))),
        t
      );
    }
    drawProfile(e, t, n, i) {
      let a = e.getContext('2d');
      if (!a || t.length === 0) return;
      let r = e.width,
        s = e.height,
        o = { left: 46, right: 8, top: 8, bottom: 20 },
        h = 1 / 0,
        u = -1 / 0;
      for (let v of n)
        for (let g = 0; g < v.values.length; g++) {
          let w = v.values[g];
          Number.isFinite(w) && (w < h && (h = w), w > u && (u = w));
        }
      if (!Number.isFinite(h) || !Number.isFinite(u)) return;
      (u === h && (u = h + 1), a.clearRect(0, 0, r, s));
      let d = r - o.left - o.right,
        m = s - o.top - o.bottom;
      ((a.strokeStyle = 'rgba(128, 128, 128, 0.4)'),
        (a.lineWidth = 1),
        a.strokeRect(o.left, o.top, d, m),
        (a.fillStyle = 'rgba(160, 160, 160, 0.9)'),
        (a.font = '10px var(--vscode-editor-font-family, monospace)'),
        (a.textAlign = 'right'),
        a.fillText(Se(u, 4), o.left - 4, o.top + 8),
        a.fillText(Se(h, 4), o.left - 4, o.top + m),
        (a.textAlign = 'center'));
      let p = t[t.length - 1] * i.pixelWidth;
      (a.fillText('0', o.left, s - 6), a.fillText(`${Se(p, 4)} ${i.unit}`, o.left + d, s - 6));
      for (let v of n) {
        ((a.strokeStyle = v.color), (a.lineWidth = 1.25), a.beginPath());
        let g = !1;
        for (let w = 0; w < v.values.length; w++) {
          let k = v.values[w];
          if (!Number.isFinite(k)) {
            g = !1;
            continue;
          }
          let E = o.left + (w / Math.max(1, v.values.length - 1)) * d,
            L = o.top + m - ((k - h) / (u - h)) * m;
          g ? a.lineTo(E, L) : (a.moveTo(E, L), (g = !0));
        }
        a.stroke();
      }
    }
    renderResults() {
      let e = this.host.getSource(),
        t = this.host.getCalibration(),
        n = this.section('Table');
      (e &&
        (e.channels || 1) > 1 &&
        n.appendChild(
          this.checkbox(
            'Measure every channel',
            this.channelMode === 'all',
            v => {
              ((this.channelMode = v ? 'all' : 'first'), this.refresh());
            },
            'One row per ROI per channel. Off measures only the first channel.'
          )
        ),
        n.appendChild(this.note(fs(t))));
      let i = this.section('Columns');
      i.appendChild(
        this.note(
          'What the table shows. Exports always contain every measured column \u2014 a results file that quietly omits a number because of a display setting is a trap.'
        )
      );
      let a = document.createElement('div');
      a.className = 'measure-column-grid';
      for (let v of ms)
        a.appendChild(
          this.checkbox(v.label, this.visibleColumns.indexOf(v.id) >= 0, g => {
            let w = this.visibleColumns.indexOf(v.id);
            (g && w < 0 && this.visibleColumns.push(v.id),
              !g && w >= 0 && this.visibleColumns.splice(w, 1),
              this.render());
          })
        );
      i.appendChild(a);
      let r = this.section(`Measurements (${this.rows.length} rows)`);
      this.rows.length === 0
        ? r.appendChild(this.note('Draw or import an ROI to populate the table.'))
        : r.appendChild(this.buildResultsTable());
      let s = this.section('Derived columns');
      s.appendChild(
        this.note(
          'Expressions over the columns above, e.g. rawIntegratedDensity / area. Saved with the ROIs and included in exports.'
        )
      );
      for (let v = 0; v < this.derivedColumns.length; v++) s.appendChild(this.buildDerivedRow(v));
      s.appendChild(
        this.button('Add column', () => {
          (this.derivedColumns.push({
            name: `derived${this.derivedColumns.length + 1}`,
            expression: 'mean',
          }),
            this.render());
        })
      );
      let o = this.section('Grouping');
      o.appendChild(
        this.textRow(
          'Filename pattern',
          this.groupPattern,
          v => {
            ((this.groupPattern = v), this.render());
          },
          'e.g. {condition}_{replicate}_{index}.tif \u2014 braces become columns.'
        )
      );
      let h = this.groupPattern && e?.fileName ? ks(e.fileName, this.groupPattern) : null;
      if (
        (this.groupPattern &&
          o.appendChild(
            this.note(
              h
                ? `Matched: ${Object.entries(h)
                    .map(([v, g]) => `${v}=${g}`)
                    .join(', ')}`
                : 'The pattern does not match this filename.'
            )
          ),
        h && this.rows.length > 0)
      ) {
        let v = Ss(this.rows, 'area', () => Object.values(h).join(' / '));
        for (let g of v)
          o.appendChild(
            this.note(`${g.key}: n=${g.n}, mean area ${Se(g.mean)} \xB1 ${Se(g.sem)} (SEM)`)
          );
      }
      let u = this.section('Across images');
      if (
        (u.appendChild(
          this.checkbox(
            'Collect results from every image I measure',
            this.collecting,
            v => {
              ((this.collecting = v), v || this.collected.clear(), this.refresh());
            },
            "Keeps each image's rows as you step through a collection, so one export covers the whole folder. Each row keeps the scale and threshold it was measured with."
          )
        ),
        this.collecting)
      ) {
        let v = this.collected.size,
          g = this.exportRows().length;
        (u.appendChild(
          this.note(
            v === 0
              ? 'Nothing collected yet. Step to the next image and its rows are added.'
              : `${g} row(s) from ${v} image(s). The table below still shows this image, so clicking a row still finds its object.`
          )
        ),
          v > 0 &&
            u.appendChild(
              this.button('Forget collected rows', () => {
                (this.collected.clear(), this.refresh());
              })
            ));
      }
      let d = this.exportRows();
      if (d.length > 1) {
        let v = this.section('Summary');
        (v.appendChild(
          this.note(
            this.collecting && this.collected.size > 1
              ? `${d.length} row(s) across ${this.collected.size} images. This is the line you actually write down.`
              : `${d.length} measured row(s). This is the line you actually write down.`
          )
        ),
          v.appendChild(this.buildSummaryTable(d)));
      }
      let m = this.section('Export'),
        p = document.createElement('div');
      ((p.className = 'measure-button-row'),
        p.append(
          this.button('CSV', () => this.exportTable('csv'), d.length === 0),
          this.button('CSV (de)', () => this.exportTable('csv-de'), d.length === 0),
          this.button('Excel .xlsx', () => this.exportTable('xlsx'), d.length === 0),
          this.button('pandas script', () => this.exportPandasScript(), d.length === 0)
        ),
        m.appendChild(p),
        m.appendChild(
          this.note(
            'Long/tidy form: one row per ROI per channel with provenance on every row, so several exports concatenate without manual bookkeeping. "CSV (de)" uses a semicolon separator and a comma decimal mark for German-locale Excel. The pandas script is written from this session \u2014 the columns that exist, the scale in force, the threshold used, and your derived columns as real expressions.'
          )
        ));
    }
    buildResultsTable() {
      let e = this.host.getCalibration(),
        t = document.createElement('div');
      t.className = 'measure-table-wrapper measure-results-wrapper';
      let n = document.createElement('table');
      n.className = 'measure-table';
      let i = [
        { key: 'roiName', label: 'ROI' },
        { key: 'channel', label: 'Ch' },
      ];
      for (let u of ms)
        if (!(this.visibleColumns.indexOf(u.id) < 0))
          for (let d of u.keys) {
            let m = bl[d] || String(d),
              p = d === 'area' ? ` (${Aa(e)})` : yl.indexOf(d) >= 0 ? ` (${e.unit})` : '',
              v =
                ['mean', 'stdDev', 'min', 'max', 'median', 'mode'].indexOf(String(d)) >= 0
                  ? 6
                  : ['circularity', 'aspectRatio', 'roundness', 'solidity'].indexOf(String(d)) >= 0
                    ? 3
                    : void 0;
            i.push({ key: d, label: m + p, digits: v });
          }
      let a = i.filter(
          u =>
            u.key === 'roiName' ||
            u.key === 'channel' ||
            this.rows.some(d => d[u.key] !== void 0 && d[u.key] !== null)
        ),
        r = document.createElement('thead'),
        s = document.createElement('tr');
      for (let u of a) {
        let d = document.createElement('th');
        ((d.textContent = u.label), s.appendChild(d));
      }
      for (let u of this.derivedColumns) {
        let d = document.createElement('th');
        ((d.textContent = u.name), s.appendChild(d));
      }
      (r.appendChild(s), n.appendChild(r));
      let o = document.createElement('tbody'),
        h = this.derivedColumns.map(u => {
          try {
            return ki(u.expression);
          } catch {
            return null;
          }
        });
      for (let u of this.rows) {
        let d = document.createElement('tr');
        ((d.dataset.roiId = u.roiId),
          d.classList.toggle('selected', this.host.manager.isSelected(u.roiId)),
          (d.onmouseenter = () => this.host.overlay.setHoveredRoi(u.roiId)),
          (d.onmouseleave = () => this.host.overlay.setHoveredRoi(null)),
          (d.onclick = p => {
            let v = p.shiftKey || p.ctrlKey || p.metaKey;
            ((this.selectionFromTable = !0),
              this.host.manager.select([u.roiId], { additive: v }),
              v || this.host.overlay.revealRoi(u.roiId));
          }));
        for (let p of a) {
          let v = document.createElement('td'),
            g = u[p.key];
          ((v.textContent =
            typeof g == 'number' ? Se(g, p.digits ?? 4) : g == null ? '' : String(g)),
            d.appendChild(v));
        }
        let m = {};
        for (let p of Object.keys(u)) {
          let v = u[p];
          typeof v == 'number' && (m[p] = v);
        }
        for (let p of h) {
          let v = document.createElement('td'),
            g = '';
          if (p)
            try {
              g = Se(p(m), 5);
            } catch {
              g = '';
            }
          ((v.textContent = g), d.appendChild(v));
        }
        o.appendChild(d);
      }
      return (n.appendChild(o), t.appendChild(n), t);
    }
    buildSummaryTable(e) {
      let t = this.host.getCalibration(),
        n = document.createElement('div');
      n.className = 'measure-table-wrapper';
      let i = document.createElement('table');
      i.className = 'measure-table';
      let a = document.createElement('thead'),
        r = document.createElement('tr');
      for (let h of ['Column', 'n', 'Mean', 'SD', 'SEM', 'Min', 'Max']) {
        let u = document.createElement('th');
        ((u.textContent = h), r.appendChild(u));
      }
      (a.appendChild(r), i.appendChild(a));
      let s = document.createElement('tbody'),
        o = h =>
          h === 'area'
            ? ` ${Aa(t)}`
            : [
                  'perimeter',
                  'length',
                  'feret',
                  'minFeret',
                  'major',
                  'minor',
                  'width',
                  'height',
                ].indexOf(h) >= 0
              ? ` ${t.unit}`
              : '';
      for (let h of zl(e)) {
        let u = document.createElement('tr'),
          d = o(h.column),
          m = [
            h.column + d,
            String(h.summary.n),
            Se(h.summary.mean, 5),
            Se(h.summary.stdDev, 5),
            Se(h.summary.sem, 5),
            Se(h.summary.min, 5),
            Se(h.summary.max, 5),
          ];
        for (let p of m) {
          let v = document.createElement('td');
          ((v.textContent = p), u.appendChild(v));
        }
        s.appendChild(u);
      }
      return (i.appendChild(s), n.appendChild(i), n);
    }
    buildDerivedRow(e) {
      let t = this.derivedColumns[e],
        n = document.createElement('div');
      n.className = 'measure-derived-row';
      let i = document.createElement('input');
      ((i.className = 'measure-input measure-derived-name'),
        (i.value = t.name),
        (i.onchange = () => {
          ((t.name = i.value.trim() || t.name), this.render());
        }),
        (i.onkeydown = u => u.stopPropagation()));
      let a = document.createElement('input');
      ((a.className = 'measure-input measure-derived-expression'),
        (a.value = t.expression),
        (a.onkeydown = u => u.stopPropagation()));
      let r = document.createElement('div');
      r.className = 'measure-error';
      let s = () => {
        try {
          (ki(a.value), (r.textContent = ''), a.classList.remove('invalid'));
        } catch (u) {
          let d = u instanceof _t ? `${u.message} at position ${u.position + 1}` : u.message;
          ((r.textContent = d), a.classList.add('invalid'));
        }
      };
      ((a.oninput = s),
        (a.onchange = () => {
          ((t.expression = a.value), s(), this.render());
        }),
        s());
      let o = document.createElement('button');
      ((o.className = 'measure-roi-remove'),
        (o.textContent = '\xD7'),
        (o.onclick = () => {
          (this.derivedColumns.splice(e, 1), this.render());
        }),
        n.append(i, a, o));
      let h = document.createElement('div');
      return (h.append(n, r), h);
    }
    renderSegment() {
      let e = this.host.getSource(),
        t = this.host.getScalarPlane();
      if (!e || !t) {
        this.section('Threshold').appendChild(this.note('No measurable image is loaded.'));
        return;
      }
      (this.histogram || this.prepareThreshold(),
        this.body.appendChild(this.buildHistogramSlider()));
      let n = this.section('Preprocess (segmentation only)');
      (n.appendChild(
        this.note('Applied to a copy used for thresholding. The displayed image is never modified.')
      ),
        n.appendChild(
          this.numberRow(
            'Gaussian blur \u03C3',
            this.threshold.blurSigma,
            h => {
              ((this.threshold.blurSigma = Math.max(0, h)), this.prepareThreshold(), this.render());
            },
            { step: '0.5', min: 0 }
          )
        ),
        n.appendChild(
          this.numberRow(
            'Background radius',
            this.threshold.backgroundRadius,
            h => {
              ((this.threshold.backgroundRadius = Math.max(0, Math.round(h))),
                this.prepareThreshold(),
                this.render());
            },
            { step: '5', min: 0 },
            'Rolling-ball background subtraction. 0 disables it. Fixes uneven illumination, the usual reason a global threshold appears to have no right value.'
          )
        ));
      let i = this.section('Method');
      if (
        (i.appendChild(
          this.checkbox(
            'Objects are brighter than the background',
            this.threshold.darkBackground,
            h => {
              ((this.threshold.darkBackground = h), this.applyThreshold(), this.render());
            }
          )
        ),
        i.appendChild(
          this.note(
            this.threshold.manual
              ? 'Range set by hand. Pick a method below to go back to an automatic cut.'
              : 'Hover any entry to see it on the image; click to keep it.'
          )
        ),
        i.appendChild(
          this.checkbox(
            'Apply the chosen method per window',
            this.threshold.localizeGlobal,
            h => {
              ((this.threshold.localizeGlobal = h),
                h && ((this.threshold.localMethod = 'none'), (this.threshold.manual = !1)),
                this.applyThreshold(),
                this.render());
            },
            `Runs the selected method on the histogram of a local neighbourhood instead of the whole image \u2014 ImageJ's "Auto Local Threshold". Use it when the same criterion is right but the illumination is not even.`
          )
        ),
        i.appendChild(this.buildMethodGallery()),
        this.threshold.localMethod !== 'none' || this.threshold.localizeGlobal)
      ) {
        let h = this.section('Neighbourhood');
        (h.appendChild(
          this.numberRow(
            'Window radius',
            this.threshold.localRadius,
            u => {
              ((this.threshold.localRadius = Math.max(1, Math.round(u))),
                this.applyThreshold(),
                this.render());
            },
            { step: '1', min: 1 },
            'Somewhat larger than your objects: the window has to contain both object and background to tell them apart.'
          )
        ),
          this.threshold.localMethod !== 'none' &&
            h.appendChild(
              this.numberRow(
                'Sensitivity (k)',
                this.threshold.localK,
                u => {
                  ((this.threshold.localK = u), this.applyThreshold(), this.render());
                },
                { step: '0.05' },
                'Higher is stricter \u2014 fewer pixels pass. 0.25 is a good starting point.'
              )
            ));
      }
      this.body.appendChild(this.buildStabilitySection());
      let a = this.section('Particles'),
        r = () => {
          ((this.particleResult = null),
            this.particleToken++,
            this.refreshMaskOverlay(),
            this.render());
        },
        s = document.createElement('select');
      s.className = 'measure-select';
      let o = [
        { id: 'none', label: 'Do not split', title: 'Each connected region is one object.' },
        {
          id: 'shape',
          label: 'By shape (watershed)',
          title: 'Distance-transform watershed. Separates round objects that overlap.',
        },
        {
          id: 'intensity',
          label: 'By intensity maxima',
          title: `Splits at local intensity peaks \u2014 ImageJ's Find Maxima with "Segmented Particles", restricted to the threshold mask. Use when objects touch without their outline pinching.`,
        },
      ];
      for (let h of o) {
        let u = document.createElement('option');
        ((u.value = h.id), (u.textContent = h.label), (u.title = h.title), s.appendChild(u));
      }
      if (
        ((s.value = this.threshold.split),
        (s.onchange = () => {
          if (
            ((this.threshold.split = s.value),
            this.threshold.split === 'intensity' && this.threshold.prominence <= 0)
          ) {
            let h = this.histogram;
            this.threshold.prominence = h ? (h.max - h.min) / 10 : 1;
          }
          r();
        }),
        a.appendChild(this.labelled('Split touching', s)),
        this.threshold.split === 'intensity')
      ) {
        a.appendChild(
          this.numberRow(
            'Prominence',
            this.threshold.prominence,
            u => {
              ((this.threshold.prominence = Math.max(0, u)), r());
            },
            { step: 'any', min: 0 },
            'How far a peak must rise above the saddle joining it to a brighter one before it counts as its own object. Raise it until the centre count matches what you see.'
          )
        );
        let h = this.countMaxima();
        h !== null && a.appendChild(this.note(`${h} centre(s) at this prominence.`));
      }
      (a.appendChild(
        this.checkbox('Fill holes', this.threshold.fillHoles, h => {
          ((this.threshold.fillHoles = h), r());
        })
      ),
        a.appendChild(
          this.checkbox(
            'Exclude objects touching the edge',
            this.threshold.excludeEdges,
            h => {
              ((this.threshold.excludeEdges = h), r());
            },
            'Edge objects are cut off, so their area and shape are not measurable.'
          )
        ),
        a.appendChild(
          this.numberRow(
            'Min area (px)',
            this.threshold.minArea,
            h => {
              ((this.threshold.minArea = Math.max(0, h)), r());
            },
            { step: '1', min: 0 }
          )
        ),
        a.appendChild(
          this.numberRow(
            'Max area (px)',
            Number.isFinite(this.threshold.maxArea) ? this.threshold.maxArea : 0,
            h => {
              ((this.threshold.maxArea = h > 0 ? h : Number.POSITIVE_INFINITY), r());
            },
            { step: '1', min: 0 },
            '0 means no upper limit. Use it to drop merged clumps that survived splitting.'
          )
        ),
        a.appendChild(
          this.numberRow(
            'Min circularity',
            this.threshold.minCircularity,
            h => {
              ((this.threshold.minCircularity = h), r());
            },
            { step: '0.05', min: 0, max: 1 }
          )
        ),
        a.appendChild(this.note(this.currentMaskStats())),
        a.appendChild(this.buildOverlayLegend()),
        this.body.appendChild(this.buildCommitAction()),
        this.refreshMaskOverlay());
    }
    buildOverlayLegend() {
      let e = document.createElement('div');
      e.className = 'measure-legend';
      let t = [
        ['rgb(40, 220, 120)', 'Green', 'part of an object that will be added'],
        [
          'rgb(255, 60, 60)',
          'Red',
          'passed the threshold but was filtered out \u2014 too small or large, wrong shape, on the edge, or a line where two touching objects were split',
        ],
      ];
      for (let [n, i, a] of t) {
        let r = document.createElement('div');
        r.className = 'measure-legend-row';
        let s = document.createElement('span');
        ((s.className = 'measure-legend-swatch'), (s.style.background = n));
        let o = document.createElement('span');
        ((o.textContent = `${i} \u2014 ${a}`), r.append(s, o), e.appendChild(r));
      }
      return e;
    }
    buildCommitAction() {
      let e = document.createElement('div');
      e.className = 'measure-cta';
      let t = this.thresholdMask ? this.ensureParticles() : null,
        n = !!this.thresholdMask && !t,
        i = t ? t.particles.length : 0,
        a = document.createElement('button');
      ((a.className = 'measure-cta-button'),
        (a.disabled = n || i === 0),
        (a.textContent = n
          ? 'Analyzing objects\u2026'
          : i === 0
            ? 'No objects to add'
            : `Add ${i} object${i === 1 ? '' : 's'} as ROIs`),
        (a.onclick = () => this.commitParticles()),
        e.appendChild(a));
      let r = document.createElement('div');
      return (
        (r.className = 'measure-cta-caption'),
        (r.textContent = n
          ? 'Applying the size, shape, edge, and splitting settings to the current mask.'
          : i === 0
            ? this.thresholdMask
              ? 'Every object was filtered out. Loosen the size or shape limits above.'
              : 'Pick a threshold method above first.'
            : 'They become measurable ROIs: the Results table fills in, and each one can be renamed, exported, or measured on another channel.'),
        e.appendChild(r),
        e
      );
    }
    buildHistogramSlider() {
      let e = document.createElement('div');
      e.className = 'measure-section';
      let t = document.createElement('div');
      ((t.className = 'measure-section-title'), (t.textContent = 'Histogram'), e.appendChild(t));
      let n = this.histogram;
      if (!n) return e;
      let i = document.createElement('canvas');
      ((i.className = 'measure-histogram'), (i.width = 460), (i.height = 120), e.appendChild(i));
      let a = { left: 8, right: 8, top: 6, bottom: 14 },
        r = i.width - a.left - a.right,
        s = m => {
          let p = i.getBoundingClientRect(),
            v = (((m - p.left) / p.width) * i.width - a.left) / r,
            g = Math.max(0, Math.min(1, v));
          return n.min + g * (n.max - n.min);
        },
        o = () => this.drawHistogramSlider(i, a);
      o();
      let h = null;
      (i.addEventListener('pointerdown', m => {
        let p = s(m.clientX);
        ((h =
          Math.abs(p - this.threshold.low) <= Math.abs(p - this.threshold.high) ? 'low' : 'high'),
          i.setPointerCapture(m.pointerId),
          (this.threshold.manual = !0),
          (this.threshold.localMethod = 'none'),
          (this.threshold.localizeGlobal = !1),
          h === 'low' ? (this.threshold.low = p) : (this.threshold.high = p),
          this.applyThreshold(),
          o(),
          m.preventDefault());
      }),
        i.addEventListener('pointermove', m => {
          if (!h) return;
          let p = s(m.clientX);
          (h === 'low'
            ? (this.threshold.low = Math.min(p, this.threshold.high))
            : (this.threshold.high = Math.max(p, this.threshold.low)),
            this.applyThreshold(),
            o());
        }));
      let u = () => {
        h && ((h = null), this.render());
      };
      (i.addEventListener('pointerup', u), i.addEventListener('pointercancel', u));
      let d = this.threshold.localMethod !== 'none' || this.threshold.localizeGlobal;
      return (
        e.appendChild(
          this.note(
            d
              ? 'An adaptive method is active, so it computes its own threshold per neighbourhood and this range is not in use. Drag a handle to take manual control.'
              : `Drag either edge of the shaded band to set the range. Currently ${Se(this.threshold.low, 4)} \u2013 ${Se(this.threshold.high, 4)}.`
          )
        ),
        d && i.classList.add('measure-histogram-inactive'),
        e
      );
    }
    drawHistogramSlider(e, t) {
      let n = e.getContext('2d'),
        i = this.histogram;
      if (!n || !i) return;
      let a = e.width - t.left - t.right,
        r = e.height - t.top - t.bottom;
      n.clearRect(0, 0, e.width, e.height);
      let s = 1;
      for (let m = 0; m < i.counts.length; m++) i.counts[m] > s && (s = i.counts[m]);
      let o = m => (Math.log1p(m) / Math.log1p(s)) * r,
        h = m => {
          let p = i.max - i.min,
            v = p > 0 ? (m - i.min) / p : 0;
          return t.left + Math.max(0, Math.min(1, v)) * a;
        },
        u = h(this.threshold.low),
        d = h(this.threshold.high);
      ((n.fillStyle = 'rgba(255, 80, 80, 0.18)'), n.fillRect(u, t.top, Math.max(1, d - u), r));
      for (let m = 0; m < a; m++) {
        let p = Math.floor((m / a) * i.counts.length),
          v = o(i.counts[p]),
          g = i.min + (p / i.counts.length) * (i.max - i.min),
          w = g >= this.threshold.low && g <= this.threshold.high;
        ((n.fillStyle = w ? 'rgba(255, 110, 110, 0.95)' : 'rgba(150, 150, 150, 0.65)'),
          n.fillRect(t.left + m, t.top + r - v, 1, v));
      }
      for (let m of [u, d])
        ((n.strokeStyle = '#ffffff'),
          (n.lineWidth = 1.5),
          n.beginPath(),
          n.moveTo(m, t.top),
          n.lineTo(m, t.top + r),
          n.stroke(),
          (n.fillStyle = '#ffffff'),
          n.fillRect(m - 3, t.top + r / 2 - 7, 6, 14));
      ((n.fillStyle = 'rgba(160, 160, 160, 0.9)'),
        (n.font = '10px var(--vscode-editor-font-family, monospace)'),
        (n.textAlign = 'left'),
        n.fillText(Se(i.min, 4), t.left, e.height - 3),
        (n.textAlign = 'right'),
        n.fillText(Se(i.max, 4), t.left + a, e.height - 3));
    }
    buildMethodGallery() {
      let e = document.createElement('div');
      e.className = 'measure-method-grid';
      let t = this.histogram,
        n = this.host.getSource();
      if (!t || !n) return e;
      let i = this.ensureMethodBins();
      for (let a of Ls) {
        let r = i?.get(a.id) ?? -1,
          s = !i,
          o = this.threshold.localizeGlobal,
          h =
            !this.threshold.manual &&
            this.threshold.localMethod === 'none' &&
            this.threshold.method === a.id,
          u = this.methodButton({
            label: o ? `${a.label} \xB7 per window` : a.label,
            hint: s
              ? `${a.hint}

Computing\u2026`
              : r < 0
                ? `${a.hint}

No threshold found for this histogram.`
                : a.hint,
            value: o
              ? `r=${this.threshold.localRadius}`
              : s
                ? '\u2026'
                : r < 0
                  ? '\u2014'
                  : Se(Si(t, r), 4),
            active: h,
            disabled: s || (r < 0 && !o),
            spark: o || s ? void 0 : this.buildHistogramSpark(t, r),
            computeMask: async () => {
              if (!this.previewPlane) return null;
              if (o)
                return Ps(this.previewPlane, n.width, n.height, {
                  method: a.id,
                  radius: this.threshold.localRadius,
                  darkBackground: this.threshold.darkBackground,
                });
              if (r < 0) return null;
              let d = Si(t, r);
              return this.threshold.darkBackground
                ? Ua(this.previewPlane, d, t.max)
                : Ua(this.previewPlane, t.min, d);
            },
            apply: () => {
              ((this.threshold.method = a.id),
                (this.threshold.localMethod = 'none'),
                (this.threshold.manual = !1));
            },
          });
        e.appendChild(u);
      }
      for (let a of nc) {
        if (a.id === 'none') continue;
        let r = this.threshold.localMethod === a.id,
          s = this.methodButton({
            label: `${a.label} (local)`,
            hint: a.hint,
            value: `r=${this.threshold.localRadius}, k=${Se(this.threshold.localK, 2)}`,
            active: r,
            disabled: !1,
            computeMask: async () =>
              this.previewPlane
                ? _s(this.previewPlane, n.width, n.height, {
                    method: a.id,
                    radius: this.threshold.localRadius,
                    k: this.threshold.localK,
                    darkBackground: this.threshold.darkBackground,
                  })
                : null,
            apply: () => {
              ((this.threshold.localMethod = a.id),
                (this.threshold.localizeGlobal = !1),
                (this.threshold.manual = !1));
            },
          });
        e.appendChild(s);
      }
      return e;
    }
    ensureMethodBins() {
      return this.methodBins
        ? this.methodBins
        : (this.computeMethodBins(this.thresholdToken), null);
    }
    async computeMethodBins(e) {
      if (this.methodBinsBusy) return;
      let t = this.histogram;
      if (t) {
        this.methodBinsBusy = !0;
        try {
          let n = new Map();
          for (let i of Ls) {
            let a = await Ts(t.counts, i.id);
            if (e !== this.thresholdToken) return;
            n.set(i.id, a);
          }
          ((this.methodBins = n), this.render());
        } finally {
          this.methodBinsBusy = !1;
        }
      }
    }
    methodButton(e) {
      let t = document.createElement('button');
      ((t.className = 'measure-method'),
        t.classList.toggle('active', e.active),
        (t.disabled = e.disabled),
        (t.title = e.hint));
      let n = document.createElement('div');
      ((n.className = 'measure-method-label'), (n.textContent = e.label));
      let i = document.createElement('div');
      return (
        (i.className = 'measure-method-value'),
        (i.textContent = e.value),
        t.append(n, i),
        e.spark && t.appendChild(e.spark),
        (t.onmouseenter = () => {
          if (e.disabled) return;
          let a = ++this.hoverToken;
          (async () => {
            let r = await e.computeMask();
            a !== this.hoverToken ||
              !r ||
              (this.showTemporaryMask(r),
              this.setHint(
                `${e.label}: preview in red \u2014 click to keep it, then the filters mark kept objects green.`
              ));
          })();
        }),
        (t.onmouseleave = () => {
          (this.hoverToken++, this.showTemporaryMask(null));
        }),
        (t.onclick = () => {
          (e.apply(), this.applyThreshold(), this.render());
        }),
        t
      );
    }
    buildHistogramSpark(e, t) {
      let n = document.createElement('canvas');
      ((n.className = 'measure-spark'), (n.width = 96), (n.height = 24));
      let i = n.getContext('2d');
      if (!i) return n;
      let a = 1;
      for (let s = 0; s < e.counts.length; s++) e.counts[s] > a && (a = e.counts[s]);
      let r = s => Math.log1p(s) / Math.log1p(a);
      i.fillStyle = 'rgba(140, 140, 140, 0.55)';
      for (let s = 0; s < n.width; s++) {
        let o = Math.floor((s / n.width) * e.counts.length),
          h = r(e.counts[o]) * n.height;
        i.fillRect(s, n.height - h, 1, h);
      }
      if (t >= 0) {
        i.fillStyle = '#ff6b6b';
        let s = (t / e.counts.length) * n.width;
        i.fillRect(s, 0, 1.5, n.height);
      }
      return n;
    }
    buildStabilitySection() {
      let e = document.createElement('div');
      e.className = 'measure-section';
      let t = document.createElement('div');
      if (
        ((t.className = 'measure-section-title'),
        (t.textContent = 'How robust is this threshold?'),
        e.appendChild(t),
        !this.stability || !this.histogram)
      )
        return (
          e.appendChild(
            this.note(
              'Sweeps the threshold across the whole range and plots how many objects each value gives. Flat stretches are values where the count does not depend on your exact choice \u2014 pick one of those and the result stops being a guess.'
            )
          ),
          e.appendChild(
            this.button('Compute', () => {
              (this.computeStability(), this.render());
            })
          ),
          e
        );
      let n = document.createElement('canvas');
      ((n.className = 'measure-stability'),
        (n.width = 460),
        (n.height = 120),
        this.drawStability(n));
      let i = { left: 34, right: 8 },
        a = n.width - i.left - i.right,
        r = u => {
          let d = n.getBoundingClientRect(),
            p = (((u - d.left) / d.width) * n.width - i.left) / a,
            v = this.stability.points,
            g = Math.round(Math.max(0, Math.min(1, p)) * (v.length - 1));
          return v[g];
        },
        s = !1;
      (n.addEventListener('pointerdown', u => {
        ((s = !0),
          n.setPointerCapture(u.pointerId),
          this.adoptThresholdValue(r(u.clientX).value),
          this.drawStability(n),
          u.preventDefault());
      }),
        n.addEventListener('pointermove', u => {
          s && (this.adoptThresholdValue(r(u.clientX).value), this.drawStability(n));
        }));
      let o = () => {
        s && ((s = !1), this.render());
      };
      (n.addEventListener('pointerup', o),
        n.addEventListener('pointercancel', o),
        e.appendChild(n));
      let h = Si(this.histogram, this.stability.suggestedBin);
      return (
        e.appendChild(
          this.note(
            this.stability.plateauWidth > 1
              ? `Widest plateau spans ${this.stability.plateauWidth} of ${this.stability.points.length} sampled thresholds; its centre is ${Se(h, 4)}.`
              : 'No clear plateau \u2014 the object count changes continuously, so this image may need local adaptive thresholding instead.'
          )
        ),
        e.appendChild(this.note('Click or drag across the plot to set the threshold.')),
        e.appendChild(
          this.button('Use the most stable threshold', () => {
            (this.adoptThresholdValue(h), this.render());
          })
        ),
        e
      );
    }
    drawStability(e) {
      let t = e.getContext('2d'),
        n = this.stability;
      if (!t || !n || n.points.length === 0) return;
      let i = e.width,
        a = e.height,
        r = { left: 34, right: 8, top: 8, bottom: 18 },
        s = i - r.left - r.right,
        o = a - r.top - r.bottom,
        h = 1;
      for (let u of n.points) u.objectCount > h && (h = u.objectCount);
      if (
        (t.clearRect(0, 0, i, a),
        (t.strokeStyle = 'rgba(128, 128, 128, 0.4)'),
        t.strokeRect(r.left, r.top, s, o),
        (t.fillStyle = 'rgba(90, 156, 255, 0.18)'),
        t.beginPath(),
        t.moveTo(r.left, r.top + o),
        n.points.forEach((u, d) => {
          let m = r.left + (d / (n.points.length - 1)) * s;
          t.lineTo(m, r.top + o - u.areaFraction * o);
        }),
        t.lineTo(r.left + s, r.top + o),
        t.closePath(),
        t.fill(),
        (t.strokeStyle = '#ffd400'),
        (t.lineWidth = 1.5),
        t.beginPath(),
        n.points.forEach((u, d) => {
          let m = r.left + (d / (n.points.length - 1)) * s,
            p = r.top + o - (u.objectCount / h) * o;
          d === 0 ? t.moveTo(m, p) : t.lineTo(m, p);
        }),
        t.stroke(),
        this.histogram)
      ) {
        let u = Ql(
            this.histogram,
            this.threshold.darkBackground ? this.threshold.low : this.threshold.high
          ),
          d = n.points.findIndex(m => m.bin >= u);
        if (d >= 0) {
          let m = r.left + (d / (n.points.length - 1)) * s;
          ((t.strokeStyle = '#ff6b6b'),
            (t.lineWidth = 1),
            t.beginPath(),
            t.moveTo(m, r.top),
            t.lineTo(m, r.top + o),
            t.stroke());
        }
      }
      ((t.fillStyle = 'rgba(160, 160, 160, 0.9)'),
        (t.font = '10px var(--vscode-editor-font-family, monospace)'),
        (t.textAlign = 'right'),
        t.fillText(String(h), r.left - 4, r.top + 8),
        t.fillText('0', r.left - 4, r.top + o),
        (t.textAlign = 'left'),
        t.fillText('objects (line) \xB7 area (fill)', r.left + 2, a - 5));
    }
    async preprocessedPlane() {
      let e = this.host.getScalarPlane(),
        t = this.host.getSource();
      if (!e || !t) return null;
      let n = e;
      return (
        this.threshold.blurSigma > 0 &&
          (n = await Zl(n, t.width, t.height, this.threshold.blurSigma)),
        this.threshold.backgroundRadius > 0 &&
          (n = await Jl(
            n,
            t.width,
            t.height,
            this.threshold.backgroundRadius,
            !this.threshold.darkBackground
          )),
        n
      );
    }
    prepareThreshold() {
      (this.thresholdToken++,
        (this.histogram = null),
        (this.stability = null),
        (this.methodBins = null),
        this.runPrepareThreshold(this.thresholdToken));
    }
    async runPrepareThreshold(e) {
      if (!this.thresholdPrepareBusy) {
        this.thresholdPrepareBusy = !0;
        try {
          let t = this.host.getSource(),
            n = await this.preprocessedPlane();
          if (!t || !n) return;
          let i = Math.max(1, Math.floor(n.length / 1e6)),
            a = await ec(n, i);
          if (
            e !== this.thresholdToken ||
            ((this.previewPlane = n),
            (this.histogram = a),
            !this.threshold.manual && (await this.runApplyThreshold(e), e !== this.thresholdToken))
          )
            return;
          this.render();
        } finally {
          this.thresholdPrepareBusy = !1;
        }
      }
    }
    applyThreshold() {
      (this.thresholdToken++, this.runApplyThreshold(this.thresholdToken));
    }
    async runApplyThreshold(e) {
      if (!this.thresholdApplyBusy) {
        this.thresholdApplyBusy = !0;
        try {
          let t = this.host.getSource(),
            n = this.previewPlane,
            i = this.histogram;
          if (!t || !n || !i) return;
          if (
            !this.threshold.manual &&
            this.threshold.localMethod === 'none' &&
            !this.threshold.localizeGlobal
          ) {
            let s = await Ts(i.counts, this.threshold.method);
            if (e !== this.thresholdToken) return;
            if (s >= 0) {
              let o = Si(i, s);
              this.threshold.darkBackground
                ? ((this.threshold.low = o), (this.threshold.high = i.max))
                : ((this.threshold.low = i.min), (this.threshold.high = o));
            }
          }
          let r;
          if (
            (this.threshold.localMethod !== 'none'
              ? (r = await _s(n, t.width, t.height, {
                  method: this.threshold.localMethod,
                  radius: this.threshold.localRadius,
                  k: this.threshold.localK,
                  darkBackground: this.threshold.darkBackground,
                }))
              : this.threshold.localizeGlobal && !this.threshold.manual
                ? (r = await Ps(n, t.width, t.height, {
                    method: this.threshold.method,
                    radius: this.threshold.localRadius,
                    darkBackground: this.threshold.darkBackground,
                  }))
                : (r = await Ua(n, this.threshold.low, this.threshold.high)),
            e !== this.thresholdToken)
          )
            return;
          ((this.thresholdMask = r),
            (this.particleResult = null),
            this.particleToken++,
            this.refreshMaskOverlay({ withParticles: !1 }),
            this.render());
        } finally {
          this.thresholdApplyBusy = !1;
        }
      }
    }
    refreshMaskOverlay(e = {}) {
      let t = this.host.getSource();
      if (!this.showMaskOverlay || !this.thresholdMask || !t) {
        this.host.overlay.setMaskPreview(null);
        return;
      }
      let n = null;
      if (e.withParticles !== !1) {
        let i = this.ensureParticles();
        if (i) {
          n = new Uint8Array(t.width * t.height);
          for (let a of i.particles)
            for (let r = 0; r < a.height; r++) {
              let s = (a.y + r) * t.width + a.x;
              for (let o = 0; o < a.width; o++) a.mask[r * a.width + o] && (n[s + o] = 1);
            }
        }
      }
      this.host.overlay.setMaskPreview({
        width: t.width,
        height: t.height,
        mask: this.thresholdMask,
        accepted: n,
      });
    }
    showTemporaryMask(e) {
      let t = this.host.getSource();
      if (!(!this.showMaskOverlay || !t)) {
        if (!e) {
          this.refreshMaskOverlay();
          return;
        }
        this.host.overlay.setMaskPreview({
          width: t.width,
          height: t.height,
          mask: e,
          accepted: null,
        });
      }
    }
    adoptThresholdValue(e) {
      this.histogram &&
        ((this.threshold.manual = !0),
        this.threshold.darkBackground
          ? ((this.threshold.low = e), (this.threshold.high = this.histogram.max))
          : ((this.threshold.low = this.histogram.min), (this.threshold.high = e)),
        this.applyThreshold());
    }
    computeStability() {
      this.runComputeStability(this.thresholdToken);
    }
    async runComputeStability(e) {
      if (!this.stabilityBusy) {
        this.stabilityBusy = !0;
        try {
          let t = this.host.getSource(),
            n = this.previewPlane,
            i = this.histogram;
          if (!t || !n || !i) return;
          let a = await tc(n, t.width, t.height, i, {
            darkBackground: this.threshold.darkBackground,
          });
          if (e !== this.thresholdToken) return;
          ((this.stability = a), this.render());
        } finally {
          this.stabilityBusy = !1;
        }
      }
    }
    currentMaskStats() {
      let e = this.host.getSource();
      if (!this.thresholdMask || !e) return 'No threshold applied yet.';
      let t = this.ensureParticles();
      if (!t) return 'Analyzing objects\u2026';
      let n = t.rejected,
        i = n.tooSmall + n.tooLarge + n.shape + n.edge,
        a = [`${t.particles.length} objects`];
      if (i > 0) {
        let r = [];
        (n.tooSmall && r.push(`${n.tooSmall} too small`),
          n.tooLarge && r.push(`${n.tooLarge} too large`),
          n.shape && r.push(`${n.shape} by shape`),
          n.edge && r.push(`${n.edge} on the edge`),
          a.push(`${i} filtered out (${r.join(', ')})`));
      }
      return a.join(' \xB7 ');
    }
    ensureParticles() {
      return this.particleResult ? this.particleResult : (this.startParticleAnalysis(), null);
    }
    async startParticleAnalysis() {
      if (this.particleAnalysisRunning) return;
      let e = this.particleToken;
      this.particleAnalysisRunning = !0;
      try {
        let t = await this.runParticles();
        if (e !== this.particleToken) return;
        ((this.particleResult = t), t && this.isVisible() && this.render());
      } catch (t) {
        console.warn('[MeasurePanel] Particle analysis failed:', t);
      } finally {
        ((this.particleAnalysisRunning = !1),
          e !== this.particleToken &&
            this.thresholdMask &&
            this.isVisible() &&
            this.startParticleAnalysis());
      }
    }
    async runParticles() {
      let e = this.host.getSource();
      return !this.thresholdMask || !e
        ? null
        : await Fl(
            this.thresholdMask,
            e.width,
            e.height,
            {
              minArea: this.threshold.minArea,
              maxArea: Number.isFinite(this.threshold.maxArea) ? this.threshold.maxArea : void 0,
              minCircularity:
                this.threshold.minCircularity > 0 ? this.threshold.minCircularity : void 0,
              maxCircularity:
                this.threshold.maxCircularity < 1 ? this.threshold.maxCircularity : void 0,
              excludeEdges: this.threshold.excludeEdges,
              fillHoles: this.threshold.fillHoles,
            },
            {
              split: this.threshold.split,
              prominence: this.threshold.prominence,
              plane: this.previewPlane || void 0,
            }
          );
    }
    countMaxima() {
      let e = this.host.getSource();
      return !this.thresholdMask || !this.previewPlane || !e
        ? null
        : Dl(this.previewPlane, this.thresholdMask, e.width, e.height, this.threshold.prominence);
    }
    commitParticles() {
      let e = this.ensureParticles();
      if (!e || e.particles.length === 0) return;
      let t = this.host.manager,
        n = e.particles.map((i, a) => Nl(i, t.nextId(), `Object ${a + 1}`));
      (t.addMany(n, { select: !1 }),
        (this.showMaskOverlay = !1),
        this.host.overlay.setMaskPreview(null),
        this.setHint(
          `Added ${n.length} objects as ROIs. Their outlines are on the image; click a table row to highlight one.`
        ),
        this.setTab('results'));
    }
    renderSetup() {
      let e = this.host.getCalibration(),
        t = this.section('Spatial calibration');
      (t.appendChild(this.note(fs(e))),
        t.appendChild(
          this.numberRow(
            'Pixel width',
            e.pixelWidth,
            a => {
              (this.host.setCalibration({ ...e, pixelWidth: a, origin: 'manual' }), this.refresh());
            },
            { step: 'any', min: 0 }
          )
        ),
        t.appendChild(
          this.numberRow(
            'Pixel height',
            e.pixelHeight,
            a => {
              (this.host.setCalibration({ ...e, pixelHeight: a, origin: 'manual' }),
                this.refresh());
            },
            { step: 'any', min: 0 }
          )
        ),
        t.appendChild(
          this.textRow('Unit', e.unit, a => {
            (this.host.setCalibration({ ...e, unit: a || 'px', origin: 'manual' }), this.refresh());
          })
        ));
      let n = this.section('Set scale from a known distance');
      if (
        (n.appendChild(
          this.note(
            'Draw a line along a feature whose real length you know \u2014 a scale bar, a calibration grid \u2014 and enter that length.'
          )
        ),
        n.appendChild(
          this.button('Draw calibration line', () => {
            (this.host.overlay.setTool('calibrate'), this.setTab('setup'));
          })
        ),
        this.pendingCalibrationDistance > 0)
      ) {
        n.appendChild(this.note(`Measured ${Se(this.pendingCalibrationDistance, 5)} px.`));
        let a = document.createElement('input');
        ((a.className = 'measure-input'),
          (a.type = 'number'),
          (a.step = 'any'),
          (a.placeholder = 'Known length'),
          (a.onkeydown = h => h.stopPropagation()));
        let r = document.createElement('input');
        ((r.className = 'measure-input measure-unit-input'),
          (r.value = e.unit === 'px' ? '\xB5m' : e.unit),
          (r.onkeydown = h => h.stopPropagation()));
        let s = this.button('Apply', () => {
            let h = Sl(this.pendingCalibrationDistance, parseFloat(a.value), r.value.trim());
            h &&
              (this.host.setCalibration(h),
              (this.pendingCalibrationDistance = 0),
              this.host.overlay.setTool('select'),
              this.refresh());
          }),
          o = document.createElement('div');
        ((o.className = 'measure-button-row'), o.append(a, r, s), n.appendChild(o));
      }
      this.section('Reset').appendChild(
        this.button('Back to pixels', () => {
          (this.host.setCalibration({ pixelWidth: 1, pixelHeight: 1, unit: 'px', origin: 'none' }),
            this.refresh());
        })
      );
    }
    onCalibrationLine(e) {
      ((this.pendingCalibrationDistance = e), this.setTab('setup'));
    }
    provenance() {
      let e = this.host.getCalibration(),
        t = this.host.getSource(),
        n = [];
      return (
        this.threshold.blurSigma > 0 && n.push(`gaussian:${this.threshold.blurSigma}`),
        this.threshold.backgroundRadius > 0 &&
          n.push(`rollingBall:${this.threshold.backgroundRadius}`),
        {
          fileName: t?.fileName,
          unit: e.unit,
          pixelWidth: e.pixelWidth,
          pixelHeight: e.pixelHeight,
          calibrationOrigin: e.origin,
          thresholdMethod: this.thresholdMask
            ? this.threshold.localMethod !== 'none'
              ? `local:${this.threshold.localMethod}`
              : this.threshold.manual
                ? 'manual'
                : this.threshold.method
            : void 0,
          thresholdLow: this.thresholdMask ? this.threshold.low : void 0,
          thresholdHigh: this.thresholdMask ? this.threshold.high : void 0,
          preprocessing:
            [
              ...n,
              this.threshold.split === 'shape' ? 'watershed' : '',
              this.threshold.split === 'intensity' ? `maxima:${this.threshold.prominence}` : '',
            ]
              .filter(Boolean)
              .join(' ') || void 0,
          extensionVersion: this.host.extensionVersion,
        }
      );
    }
    baseName() {
      let t = this.host.getSource()?.fileName || 'image';
      return (t.split('/').pop() || t).replace(/\.[^.]+$/, '');
    }
    extraColumns() {
      let e = this.host.getSource();
      return !this.groupPattern || !e?.fileName ? {} : ks(e.fileName, this.groupPattern) || {};
    }
    exportTable(e) {
      let t = this.provenance(),
        n = this.extraColumns(),
        i = this.exportRows(),
        a = this.collecting ? h => this.snapshotFor(h)?.provenance : void 0,
        r = this.collecting ? h => this.snapshotFor(h)?.extraColumns : void 0;
      if (e === 'xlsx') {
        let d = Cs(i, t, {
          delimiter: '	',
          derivedColumns: this.derivedColumns,
          extraColumns: n,
          provenanceForRow: a,
          extraColumnsForRow: r,
        })
          .trimEnd()
          .split(
            `
`
          )
          .map(m =>
            m.split('	').map(p => {
              let v = p.replace(/^"|"$/g, '').replace(/""/g, '"'),
                g = Number(v);
              return v !== '' && Number.isFinite(g) ? g : v;
            })
          );
        this.host.saveBinaryFile(
          `${this.baseName()}-results.xlsx`,
          wc({ name: 'Results', rows: d })
        );
        return;
      }
      let s = e === 'csv-de',
        o = Cs(i, t, {
          delimiter: s ? ';' : ',',
          decimal: s ? ',' : '.',
          bom: !0,
          derivedColumns: this.derivedColumns,
          extraColumns: n,
          provenanceForRow: a,
          extraColumnsForRow: r,
        });
      this.host.saveTextFile(`${this.baseName()}-results.csv`, o, { open: !0 });
    }
    exportPandasScript() {
      let e = this.host.getCalibration(),
        t = this.host.getSource(),
        n = new Set();
      for (let r of this.exportRows())
        for (let s of Object.keys(r)) {
          let o = r[s];
          o != null && n.add(s);
        }
      let i = this.provenance(),
        a = jl({
          csvName: `${this.baseName()}-results.csv`,
          columns: Array.from(n).sort(),
          unit: e.unit,
          pixelWidth: e.pixelWidth,
          pixelHeight: e.pixelHeight,
          calibrationOrigin: e.origin,
          groupColumns: Object.keys(this.extraColumns()),
          derivedColumns: this.derivedColumns,
          thresholdMethod: i.thresholdMethod,
          roiCount: this.collecting ? this.exportRows().length : this.host.manager.count(),
          channelCount: (this.channelMode === 'all' && t?.channels) || 1,
        });
      this.host.saveTextFile(`${this.baseName()}-analysis.py`, a, { open: !0 });
    }
    exportProfile(e) {
      let t = this.host.getSource();
      if (!t) return;
      let n = this.host.getCalibration(),
        i = t.channels || 1,
        a = Array.from({ length: i }, (h, u) => Ba(t, e, u)),
        s = [
          ['distance_px', `distance_${n.unit}`]
            .concat(Array.from({ length: i }, (h, u) => `channel_${u}`))
            .join(','),
        ],
        o = a[0]?.distance.length || 0;
      for (let h = 0; h < o; h++) {
        let u = a[0].distance[h],
          d = [String(u), String(u * n.pixelWidth), ...a.map(m => String(m.value[h]))];
        s.push(d.join(','));
      }
      this.host.saveTextFile(
        `${this.baseName()}-profile.csv`,
        s.join(`
`) +
          `
`,
        { open: !0 }
      );
    }
    saveSidecar() {
      let e = this.host.getSource(),
        t = Ul(this.host.manager.list(), this.host.getCalibration(), {
          image: e?.fileName,
          imageWidth: e?.width,
          imageHeight: e?.height,
          columns: this.visibleColumns,
          derivedColumns: this.derivedColumns,
          version: this.host.extensionVersion,
        });
      this.host.saveSidecar(JSON.stringify(t, null, 2));
    }
    async exportImageJ() {
      let e = window.__tiffVisualizerVendorAssets?.imagejRoi;
      if (!e) throw new Error('ImageJ ROI asset is unavailable');
      let { exportImageJRois: t } = await import(e),
        n = t(this.host.manager.list(), i => (i.kind === 'mask' ? Jt(i) : []));
      (this.host.saveBinaryFile(`${this.baseName()}-RoiSet.zip`, n.bytes),
        this.setHint(
          n.skipped.length > 0
            ? `Exported ${n.exported} ROIs. Skipped: ${n.skipped.join(', ')}.`
            : `Exported ${n.exported} ROIs as RoiSet.zip.`
        ));
    }
    applyLoadedDerivedColumns(e, t) {
      (e && e.length > 0 && (this.derivedColumns = e.slice()),
        t && t.length > 0 && (this.visibleColumns = t.slice()),
        this.refresh());
    }
    handleKeyUp(e) {
      return this.isVisible() && e.key.toLowerCase() === 'h' && this.host.overlay.isPeeking()
        ? (this.host.overlay.setPeeking(!1), !0)
        : !1;
    }
    handleKey(e) {
      if (!this.isVisible()) return !1;
      if (this.host.overlay.handleKey(e)) return !0;
      if (e.ctrlKey || e.metaKey || e.altKey)
        return (e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z'
          ? (e.shiftKey ? this.host.manager.redo() : this.host.manager.undo(), !0)
          : !1;
      let t = e.key.toLowerCase();
      if (t === 'm')
        return (
          (this.showMaskOverlay = !this.showMaskOverlay),
          this.refreshMaskOverlay(),
          this.syncHeaderToggles(),
          !0
        );
      if (t === 'o')
        return (
          this.host.overlay.setShowRois(!this.host.overlay.getShowRois()),
          this.syncHeaderToggles(),
          !0
        );
      if (t === 'h' && !e.repeat)
        return (
          this.host.overlay.setPeeking(!0),
          this.setHint('Holding H \u2014 release to bring the overlay back.'),
          !0
        );
      let n = Mc.find(i => i.key && i.key.toLowerCase() === e.key.toLowerCase());
      return n ? (this.host.overlay.setTool(n.id), this.render(), !0) : !1;
    }
    section(e) {
      let t = document.createElement('div');
      t.className = 'measure-section';
      let n = document.createElement('div');
      return (
        (n.className = 'measure-section-title'),
        (n.textContent = e),
        t.appendChild(n),
        this.body.appendChild(t),
        t
      );
    }
    note(e) {
      let t = document.createElement('div');
      return ((t.className = 'measure-note'), (t.textContent = e), t);
    }
    button(e, t, n = !1) {
      let i = document.createElement('button');
      return (
        (i.className = 'measure-button'),
        (i.textContent = e),
        (i.disabled = n),
        (i.onclick = t),
        i
      );
    }
    labelled(e, t) {
      let n = document.createElement('div');
      n.className = 'measure-row';
      let i = document.createElement('div');
      return ((i.className = 'measure-label'), (i.textContent = e), n.append(i, t), n);
    }
    checkbox(e, t, n, i) {
      let a = document.createElement('label');
      ((a.className = 'measure-checkbox'), i && (a.title = i));
      let r = document.createElement('input');
      return (
        (r.type = 'checkbox'),
        (r.checked = t),
        (r.onchange = () => n(r.checked)),
        a.append(r, document.createTextNode(e)),
        a
      );
    }
    numberRow(e, t, n, i = {}, a) {
      let r = document.createElement('input');
      ((r.type = 'number'),
        (r.className = 'measure-input'),
        (r.value = Number.isFinite(t) ? String(t) : ''),
        i.step && (r.step = i.step),
        i.min !== void 0 && (r.min = String(i.min)),
        i.max !== void 0 && (r.max = String(i.max)),
        (r.onkeydown = o => o.stopPropagation()),
        (r.onchange = () => {
          let o = parseFloat(r.value);
          Number.isFinite(o) && n(o);
        }));
      let s = this.labelled(e, r);
      return (a && (s.title = a), s);
    }
    textRow(e, t, n, i) {
      let a = document.createElement('input');
      return (
        (a.type = 'text'),
        (a.className = 'measure-input'),
        (a.value = t),
        i && (a.placeholder = i),
        (a.onkeydown = r => r.stopPropagation()),
        (a.onchange = () => n(a.value)),
        this.labelled(e, a)
      );
    }
    startDrag(e) {
      let t = this.overlayRoot.getBoundingClientRect();
      ((this.isDragging = !0), (this.dragOffset = { x: e.clientX - t.left, y: e.clientY - t.top }));
      let n = a => {
          if (!this.isDragging) return;
          let r = a.clientX - this.dragOffset.x,
            s = a.clientY - this.dragOffset.y,
            o = window.innerWidth - this.overlayRoot.offsetWidth,
            h = window.innerHeight - this.overlayRoot.offsetHeight;
          ((this.overlayRoot.style.left = `${Math.max(0, Math.min(r, o))}px`),
            (this.overlayRoot.style.top = `${Math.max(0, Math.min(s, h))}px`),
            (this.overlayRoot.style.right = 'auto'),
            (this.overlayRoot.style.bottom = 'auto'));
        },
        i = () => {
          ((this.isDragging = !1),
            document.removeEventListener('mousemove', n, !0),
            document.removeEventListener('mouseup', i, !0),
            window.removeEventListener('blur', i));
        };
      (document.addEventListener('mousemove', n, !0),
        document.addEventListener('mouseup', i, !0),
        window.addEventListener('blur', i));
    }
  };
Ti.SCROLLABLES = ['.measure-results-wrapper', '.measure-roi-list'];
var ja = Ti;
var Cc = ['#00ff00', '#ff0040', '#3399ff', '#ffcc00', '#ff8000', '#00ffcc', '#cc66ff', '#ffffff'];
function kh(l, e) {
  return e && /^#[0-9a-f]{6}$/i.test(e) ? e : Cc[l % Cc.length];
}
function Sh(l) {
  let e = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(l.trim());
  return e ? [parseInt(e[1], 16), parseInt(e[2], 16), parseInt(e[3], 16)] : [255, 255, 255];
}
function _i(l, e = 1) {
  let t = 1 / 0,
    n = -1 / 0,
    i = 0,
    a = 0,
    r = l.data;
  for (let s = 0; s < r.length; s += e) {
    let o = Number(r[s]);
    if (!Number.isFinite(o)) {
      a++;
      continue;
    }
    (o < t && (t = o), o > n && (n = o), i++);
  }
  return i === 0
    ? { min: 0, max: 1, count: 0, nonFiniteCount: a }
    : { min: t, max: n, count: i, nonFiniteCount: a };
}
function Ga(l, e = 0.001, t = 0.999) {
  let n = _i(l);
  if (n.count === 0 || n.max === n.min) return { min: n.min, max: n.max || n.min + 1 };
  let i = 4096,
    a = new Int32Array(i),
    r = i / (n.max - n.min),
    s = l.data;
  for (let v = 0; v < s.length; v++) {
    let g = Number(s[v]);
    if (!Number.isFinite(g)) continue;
    let w = Math.floor((g - n.min) * r);
    (w >= i && (w = i - 1), w < 0 && (w = 0), a[w]++);
  }
  let o = n.count * e,
    h = n.count * t,
    u = 0,
    d = n.min,
    m = n.max,
    p = !1;
  for (let v = 0; v < i; v++)
    if (
      ((u += a[v]), !p && u >= o && ((d = n.min + (v / i) * (n.max - n.min)), (p = !0)), u >= h)
    ) {
      m = n.min + ((v + 1) / i) * (n.max - n.min);
      break;
    }
  return (m > d || (m = d + (n.max - n.min) / i || 1), { min: d, max: m });
}
var Pt = 1024;
function Hs(l, e, t, n, i = {}) {
  let a = i.gamma && i.gamma > 0 ? i.gamma : 1,
    r = i.identityGamma ?? Math.abs(a - 1) < 1e-6,
    s = i.solo ?? null,
    o = [];
  for (let h = 0; h < l.length; h++) {
    let u = l[h],
      d = e[h];
    if (!d || !d.visible || (s !== null && u.index !== s) || u.width !== t || u.height !== n)
      continue;
    let m = d.max - d.min,
      p = m !== 0 ? 1 / m : 0,
      v = Math.max(0, Math.min(1, d.opacity)),
      g = d.colormap && d.colormap !== 'none' ? Ln(d.colormap) : null,
      [w, k, E] = Sh(d.color),
      L = new Float32Array(Pt * 3);
    for (let M = 0; M < Pt; M++) {
      let T = M / (Pt - 1);
      if ((r || (T = Math.pow(T, a)), g)) {
        let _ = Math.min(255, Math.max(0, Math.round(T * 255)));
        ((L[M * 3] = g[_ * 3] * v),
          (L[M * 3 + 1] = g[_ * 3 + 1] * v),
          (L[M * 3 + 2] = g[_ * 3 + 2] * v));
      } else ((L[M * 3] = w * T * v), (L[M * 3 + 1] = k * T * v), (L[M * 3 + 2] = E * T * v));
    }
    o.push({ plane: u, lut: L, min: d.min, scale: p });
  }
  return o;
}
function kc(l, e, t, n, i = {}) {
  let a = t * n,
    r = new Uint8ClampedArray(a * 4),
    s = i.gamma && i.gamma > 0 ? i.gamma : 1,
    o = Math.abs(s - 1) < 1e-6,
    h = i.soloIndex ?? null,
    u = Hs(l, e, t, n, { gamma: s, solo: h, identityGamma: o }),
    [d, m, p] = i.nanColor || [0, 0, 0];
  for (let v = 0; v < a; v++) {
    let g = 0,
      w = 0,
      k = 0,
      E = !1;
    for (let M = 0; M < u.length; M++) {
      let T = u[M],
        _ = Number(T.plane.data[v]);
      if (!Number.isFinite(_)) continue;
      E = !0;
      let I = (_ - T.min) * T.scale;
      if (I <= 0) continue;
      I > 1 && (I = 1);
      let A = ((I * (Pt - 1)) | 0) * 3;
      ((g += T.lut[A]), (w += T.lut[A + 1]), (k += T.lut[A + 2]));
    }
    let L = v * 4;
    (!E && u.length > 0
      ? ((r[L] = d), (r[L + 1] = m), (r[L + 2] = p))
      : ((r[L] = g), (r[L + 1] = w), (r[L + 2] = k)),
      (r[L + 3] = 255));
  }
  return new ImageData(r, t, n);
}
function Sc(l, e, t, n, i) {
  let a = e * t,
    r = [];
  for (let s = 0; s < n; s++) {
    let o = new Float32Array(a);
    for (let h = 0; h < a; h++) o[h] = Number(l[h * n + s]);
    r.push({ index: s, name: i?.[s] || Rh(s, n), data: o, width: e, height: t });
  }
  return r;
}
function Rh(l, e) {
  return e === 3 || e === 4
    ? ['Red', 'Green', 'Blue', 'Alpha'][l] || `Channel ${l + 1}`
    : `Channel ${l + 1}`;
}
function Rc(l, e = {}) {
  return l.map((t, n) => {
    let i = e.useAutoRange === !1 ? _i(t) : Ga(t);
    return {
      visible: !(l.length === 4 && n === 3),
      color: kh(n, e.colors?.[n]),
      opacity: 1,
      min: i.min,
      max: i.max,
    };
  });
}
var Wa = class {
  constructor(e) {
    this.isDragging = !1;
    this.dragOffset = { x: 0, y: 0 };
    ((this.host = e),
      (this.root = document.createElement('div')),
      (this.root.className = 'channels-panel'),
      (this.root.style.display = 'none'));
    let t = document.createElement('div');
    t.className = 'channels-header';
    let n = document.createElement('div');
    ((n.className = 'channels-title'), (n.textContent = 'Channels'));
    let i = document.createElement('div');
    i.className = 'channels-spacer';
    let a = document.createElement('button');
    ((a.className = 'measure-chip'),
      (a.textContent = 'Composite'),
      (a.title = 'Show all visible channels at once, additively blended (C)'),
      (a.onclick = () => {
        (this.host.setComposite(!this.host.isComposite()), this.render());
      }),
      (this.compositeToggle = a));
    let r = document.createElement('button');
    ((r.className = 'measure-close'),
      (r.textContent = '\xD7'),
      (r.title = 'Close the channels panel'),
      (r.onclick = () => this.hide()),
      t.append(n, i, a, r),
      (t.style.cursor = 'move'),
      (t.onmousedown = s => this.startDrag(s)),
      (this.body = document.createElement('div')),
      (this.body.className = 'channels-body'),
      this.root.append(t, this.body));
    for (let s of ['mousedown', 'click', 'dblclick', 'wheel', 'contextmenu'])
      this.root.addEventListener(s, o => o.stopPropagation());
    document.body.appendChild(this.root);
  }
  show() {
    ((this.root.style.display = 'flex'), this.render());
  }
  hide() {
    this.root.style.display = 'none';
  }
  isVisible() {
    return this.root.style.display !== 'none';
  }
  toggle() {
    this.isVisible() ? this.hide() : this.show();
  }
  render() {
    (this.compositeToggle.classList.toggle('active', this.host.isComposite()),
      (this.body.textContent = ''));
    let e = this.host.getPlanes();
    if (e.length < 2) {
      let s = document.createElement('div');
      ((s.className = 'measure-note'),
        (s.textContent = 'This image has a single channel.'),
        this.body.appendChild(s));
      return;
    }
    let t = this.host.getSettings(),
      n = this.host.getSolo();
    for (let s = 0; s < e.length; s++) this.body.appendChild(this.buildRow(e[s], t[s], s, n));
    let i = document.createElement('div');
    ((i.className = 'measure-button-row'),
      i.append(
        this.button('Auto range all', () => {
          let s = this.host.getSettings().map((o, h) => ({ ...o, ...Ga(e[h]) }));
          (this.host.setSettings(s), this.host.onChange(), this.render());
        }),
        this.button('Full range all', () => {
          let s = this.host.getSettings().map((o, h) => {
            let u = _i(e[h]);
            return { ...o, min: u.min, max: u.max };
          });
          (this.host.setSettings(s), this.host.onChange(), this.render());
        }),
        this.button('Show all', () => {
          (this.host.setSolo(null),
            this.host.setSettings(this.host.getSettings().map(s => ({ ...s, visible: !0 }))),
            this.host.onChange(),
            this.render());
        })
      ),
      this.body.appendChild(i));
    let a = document.createElement('div');
    a.className = 'measure-note';
    let r = this.host.getBackend?.() ?? 'cpu';
    ((a.textContent = this.host.isComposite()
      ? `Channels are added together, each scaled by its own range \u2014 the way emission combines at the detector. Compositing on ${r === 'webgpu' ? 'the GPU (WebGPU)' : 'the CPU'}.`
      : 'Composite is off; the image is shown as decoded. Turn it on to blend the channels.'),
      this.body.appendChild(a));
  }
  buildRow(e, t, n, i) {
    let a = document.createElement('div');
    ((a.className = 'channel-row'), i !== null && i !== e.index && a.classList.add('dimmed'));
    let r = document.createElement('div');
    r.className = 'channel-row-top';
    let s = document.createElement('input');
    ((s.type = 'checkbox'),
      (s.checked = t.visible),
      (s.title = 'Include this channel in the composite'),
      (s.onchange = () => this.update(n, { visible: s.checked })));
    let o = document.createElement('input');
    ((o.type = 'color'),
      (o.className = 'channel-swatch'),
      (o.value = t.color),
      (o.title = 'Channel tint'),
      (o.oninput = () => this.update(n, { color: o.value }, { interactive: !0 })),
      (o.onchange = () => this.update(n, { color: o.value })));
    let h = document.createElement('span');
    ((h.className = 'channel-name'), (h.textContent = e.name), (h.title = e.name));
    let u = document.createElement('button');
    ((u.className = 'measure-chip channel-solo'),
      (u.textContent = 'Solo'),
      (u.title = 'Show only this channel. Solo is a view, not a change to the settings.'),
      u.classList.toggle('active', i === e.index),
      (u.onclick = () => {
        (this.host.setSolo(i === e.index ? null : e.index), this.host.onChange(), this.render());
      }),
      r.append(s, o, h, u),
      a.appendChild(r));
    let d = _i(e, Math.max(1, Math.floor(e.data.length / 2e5))),
      m = d.max - d.min || 1,
      p = document.createElement('div');
    p.className = 'channel-range';
    let v = M => {
      let T = document.createElement('input');
      ((T.type = 'range'),
        (T.min = '0'),
        (T.max = '1000'),
        (T.step = '1'),
        (T.className = 'channel-slider'),
        (T.value = String(Math.round(((t[M] - d.min) / m) * 1e3))),
        (T.title = M === 'min' ? 'Black point' : 'White point'));
      let _ = I => {
        let A = d.min + (Number(T.value) / 1e3) * m,
          N = this.host.getSettings()[n],
          z = M === 'min' ? { min: Math.min(A, N.max) } : { max: Math.max(A, N.min) };
        this.update(n, z, { interactive: I, skipRender: I });
      };
      return ((T.oninput = () => _(!0)), (T.onchange = () => _(!1)), T);
    };
    (p.append(v('min'), v('max')), a.appendChild(p));
    let g = document.createElement('div');
    ((g.className = 'channel-readout'),
      (g.textContent = `${Ec(t.min)} \u2013 ${Ec(t.max)}`),
      a.appendChild(g));
    let w = document.createElement('div');
    w.className = 'channel-controls';
    let k = document.createElement('input');
    ((k.type = 'range'),
      (k.min = '0'),
      (k.max = '100'),
      (k.value = String(Math.round(t.opacity * 100))),
      (k.className = 'channel-slider'),
      (k.title = 'Channel opacity'),
      (k.oninput = () =>
        this.update(n, { opacity: Number(k.value) / 100 }, { interactive: !0, skipRender: !0 })),
      (k.onchange = () => this.update(n, { opacity: Number(k.value) / 100 })));
    let E = document.createElement('select');
    ((E.className = 'measure-select channel-colormap'),
      (E.title = 'Use a colormap instead of a flat tint'));
    for (let M of ['none', ...wa]) {
      let T = document.createElement('option');
      ((T.value = M), (T.textContent = M === 'none' ? 'Tint' : M), E.appendChild(T));
    }
    ((E.value = t.colormap || 'none'),
      (E.onchange = () => this.update(n, { colormap: E.value })),
      w.append(k, E),
      a.appendChild(w));
    let L = this.button('Auto', () => {
      this.update(n, Ga(e));
    });
    return (L.classList.add('channel-auto'), a.appendChild(L), a);
  }
  update(e, t, n = {}) {
    let i = this.host.getSettings().slice();
    ((i[e] = { ...i[e], ...t }),
      this.host.setSettings(i),
      this.host.onChange({ interactive: n.interactive }),
      n.skipRender || this.render());
  }
  button(e, t) {
    let n = document.createElement('button');
    return ((n.className = 'measure-button'), (n.textContent = e), (n.onclick = t), n);
  }
  startDrag(e) {
    let t = this.root.getBoundingClientRect();
    ((this.isDragging = !0), (this.dragOffset = { x: e.clientX - t.left, y: e.clientY - t.top }));
    let n = a => {
        if (!this.isDragging) return;
        let r = a.clientX - this.dragOffset.x,
          s = a.clientY - this.dragOffset.y;
        ((this.root.style.left = `${Math.max(0, Math.min(r, window.innerWidth - this.root.offsetWidth))}px`),
          (this.root.style.top = `${Math.max(0, Math.min(s, window.innerHeight - this.root.offsetHeight))}px`),
          (this.root.style.right = 'auto'),
          (this.root.style.bottom = 'auto'));
      },
      i = () => {
        ((this.isDragging = !1),
          document.removeEventListener('mousemove', n, !0),
          document.removeEventListener('mouseup', i, !0),
          window.removeEventListener('blur', i));
      };
    (document.addEventListener('mousemove', n, !0),
      document.addEventListener('mouseup', i, !0),
      window.addEventListener('blur', i));
  }
};
function Ec(l) {
  if (!Number.isFinite(l)) return '\u2014';
  let e = Math.abs(l);
  return e !== 0 && (e < 0.01 || e >= 1e5) ? l.toExponential(2) : String(Math.round(l * 100) / 100);
}
var Kn = { TEXTURE_BINDING: 4, COPY_DST: 2, RENDER_ATTACHMENT: 16, COPY_SRC: 1 },
  Lc = { UNIFORM: 64, COPY_DST: 8 },
  Pi = 8,
  Eh = `
struct ChannelParams {
	// x: min, y: 1/(max-min), z: layer index, w: unused
	range : vec4<f32>,
};

struct Uniforms {
	channelCount : u32,
	_pad0 : u32,
	_pad1 : u32,
	_pad2 : u32,
	nanColor : vec4<f32>,
	channels : array<ChannelParams, ${Pi}>,
};

@group(0) @binding(0) var<uniform> uniforms : Uniforms;
@group(0) @binding(1) var planes : texture_2d_array<f32>;
@group(0) @binding(2) var luts : texture_2d<f32>;

struct VertexOutput {
	@builtin(position) position : vec4<f32>,
};

@vertex
fn vertexMain(@builtin(vertex_index) index : u32) -> VertexOutput {
	// Full-screen triangle. Cheaper than a quad and avoids the diagonal seam
	// that a two-triangle quad can show under some rasterisation rules.
	var positions = array<vec2<f32>, 3>(
		vec2<f32>(-1.0, -3.0),
		vec2<f32>(-1.0,  1.0),
		vec2<f32>( 3.0,  1.0),
	);
	var output : VertexOutput;
	output.position = vec4<f32>(positions[index], 0.0, 1.0);
	return output;
}

@fragment
fn fragmentMain(@builtin(position) position : vec4<f32>) -> @location(0) vec4<f32> {
	let coord = vec2<i32>(i32(position.x), i32(position.y));
	var accumulated = vec3<f32>(0.0, 0.0, 0.0);
	var sawFinite = false;

	for (var c : u32 = 0u; c < uniforms.channelCount; c = c + 1u) {
		let params = uniforms.channels[c].range;
		let value = textureLoad(planes, coord, i32(params.z), 0).r;

		// NaN and infinities contribute nothing rather than clamping to the
		// bottom of the range \u2014 the same rule the CPU path and the measurement
		// subsystem apply. WGSL has no isnan(), and a fast-math build may fold
		// value != value away, so the finite test is written as a bounds check.
		let finite = value > -3.4e38 && value < 3.4e38;
		if (finite) {
			sawFinite = true;
			var t = (value - params.x) * params.y;
			t = clamp(t, 0.0, 1.0);
			let step = i32(t * ${Pt - 1}.0);
			accumulated = accumulated + textureLoad(luts, vec2<i32>(step, i32(c)), 0).rgb;
		}
	}

	if (!sawFinite && uniforms.channelCount > 0u) {
		return vec4<f32>(uniforms.nanColor.rgb, 1.0);
	}
	// Saturating add, matching the CPU path's Uint8ClampedArray.
	return vec4<f32>(clamp(accumulated, vec3<f32>(0.0), vec3<f32>(1.0)), 1.0);
}
`,
  Ii = class {
    constructor(e = t => console.warn(t)) {
      this.device = null;
      this.context = null;
      this.canvas = null;
      this.pipeline = null;
      this.uniformBuffer = null;
      this.planeTexture = null;
      this.lutTexture = null;
      this.planeKey = '';
      this.initPromise = null;
      this.unavailable = !1;
      this.logger = e;
    }
    static isSupported() {
      return typeof navigator < 'u' && !!navigator.gpu;
    }
    isReady() {
      return !!this.device && !!this.pipeline;
    }
    isUnavailable() {
      return this.unavailable;
    }
    async initialize() {
      return this.unavailable
        ? !1
        : this.device && this.pipeline
          ? !0
          : this.initPromise
            ? (await this.initPromise, !!this.device && !!this.pipeline)
            : ((this.initPromise = (async () => {
                let e = navigator.gpu;
                if (!e) throw new Error('navigator.gpu is unavailable');
                let t = await e.requestAdapter({ powerPreference: 'high-performance' });
                if (!t) throw new Error('No WebGPU adapter is available');
                let n = await t.requestDevice(),
                  i = document.createElement('canvas'),
                  a = i.getContext('webgpu');
                if (!a) throw new Error('Could not create a WebGPU canvas context');
                let r = e.getPreferredCanvasFormat();
                (a.configure({
                  device: n,
                  format: r,
                  alphaMode: 'opaque',
                  usage: Kn.RENDER_ATTACHMENT | Kn.COPY_SRC,
                }),
                  n.lost.then(h => {
                    this.device === n &&
                      (this.logger(
                        `[Channels] WebGPU device lost: ${h?.message || h?.reason || 'unknown reason'}`
                      ),
                      this.dispose());
                  }),
                  n.addEventListener?.('uncapturederror', h =>
                    this.logger(
                      `[Channels] WebGPU validation error: ${h.error?.message || h.error}`
                    )
                  ));
                let s = n.createShaderModule({ code: Eh, label: 'Channel composite shader' }),
                  o = await n.createRenderPipelineAsync({
                    label: 'Channel composite pipeline',
                    layout: 'auto',
                    vertex: { module: s, entryPoint: 'vertexMain' },
                    fragment: { module: s, entryPoint: 'fragmentMain', targets: [{ format: r }] },
                    primitive: { topology: 'triangle-list' },
                  });
                ((this.uniformBuffer = n.createBuffer({
                  size: 32 + Pi * 16,
                  usage: Lc.UNIFORM | Lc.COPY_DST,
                  label: 'Channel composite uniforms',
                })),
                  (this.device = n),
                  (this.canvas = i),
                  (this.context = a),
                  (this.pipeline = o));
              })()
                .catch(e => {
                  (this.logger(`[Channels] WebGPU unavailable, using the CPU compositor: ${e}`),
                    (this.unavailable = !0),
                    (this.device = null),
                    (this.pipeline = null));
                })
                .finally(() => {
                  this.initPromise = null;
                })),
              await this.initPromise,
              !!this.device && !!this.pipeline);
    }
    render(e, t, n, i, a = {}) {
      if (!this.device || !this.pipeline || !this.context || !this.canvas || n <= 0 || i <= 0)
        return null;
      let r = Hs(e, t, n, i, { gamma: a.gamma, solo: a.soloIndex ?? null });
      if (r.length === 0 || r.length > Pi) return null;
      let s = this.device;
      (this.canvas.width !== n || this.canvas.height !== i) &&
        ((this.canvas.width = n), (this.canvas.height = i), (this.planeKey = ''));
      let o = `${n}x${i}:${r.map(g => g.plane.index).join(',')}:${e.length}`;
      if (o !== this.planeKey || !this.planeTexture) {
        (this.planeTexture?.destroy?.(),
          (this.planeTexture = s.createTexture({
            size: { width: n, height: i, depthOrArrayLayers: r.length },
            format: 'r32float',
            usage: Kn.TEXTURE_BINDING | Kn.COPY_DST,
            label: 'Channel planes',
          })));
        for (let g = 0; g < r.length; g++) {
          let w = r[g].plane.data,
            k = w instanceof Float32Array ? w : Float32Array.from(w);
          s.queue.writeTexture(
            { texture: this.planeTexture, origin: { x: 0, y: 0, z: g } },
            k,
            { bytesPerRow: n * 4, rowsPerImage: i },
            { width: n, height: i, depthOrArrayLayers: 1 }
          );
        }
        this.planeKey = o;
      }
      this.lutTexture ||
        (this.lutTexture = s.createTexture({
          size: { width: Pt, height: Pi },
          format: 'rgba32float',
          usage: Kn.TEXTURE_BINDING | Kn.COPY_DST,
          label: 'Channel colour tables',
        }));
      let h = new Float32Array(Pt * 4);
      for (let g = 0; g < r.length; g++) {
        let w = r[g].lut;
        for (let k = 0; k < Pt; k++)
          ((h[k * 4] = w[k * 3] / 255),
            (h[k * 4 + 1] = w[k * 3 + 1] / 255),
            (h[k * 4 + 2] = w[k * 3 + 2] / 255),
            (h[k * 4 + 3] = 1));
        s.queue.writeTexture(
          { texture: this.lutTexture, origin: { x: 0, y: g, z: 0 } },
          h,
          { bytesPerRow: Pt * 16, rowsPerImage: 1 },
          { width: Pt, height: 1, depthOrArrayLayers: 1 }
        );
      }
      let u = new ArrayBuffer(32 + Pi * 16);
      new Uint32Array(u, 0, 1)[0] = r.length;
      let d = new Float32Array(u),
        [m, p, v] = a.nanColor || [0, 0, 0];
      ((d[4] = m / 255), (d[5] = p / 255), (d[6] = v / 255), (d[7] = 1));
      for (let g = 0; g < r.length; g++) {
        let w = 8 + g * 4;
        ((d[w] = r[g].min), (d[w + 1] = r[g].scale), (d[w + 2] = g), (d[w + 3] = 0));
      }
      s.queue.writeBuffer(this.uniformBuffer, 0, u);
      try {
        let g = s.createBindGroup({
            layout: this.pipeline.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: { buffer: this.uniformBuffer } },
              { binding: 1, resource: this.planeTexture.createView({ dimension: '2d-array' }) },
              { binding: 2, resource: this.lutTexture.createView() },
            ],
          }),
          w = s.createCommandEncoder({ label: 'Channel composite' }),
          k = w.beginRenderPass({
            colorAttachments: [
              {
                view: this.context.getCurrentTexture().createView(),
                loadOp: 'clear',
                storeOp: 'store',
                clearValue: { r: 0, g: 0, b: 0, a: 1 },
              },
            ],
          });
        (k.setPipeline(this.pipeline),
          k.setBindGroup(0, g),
          k.draw(3),
          k.end(),
          s.queue.submit([w.finish()]));
      } catch (g) {
        return (
          this.logger(`[Channels] WebGPU composite failed, using the CPU compositor: ${g}`),
          null
        );
      }
      return this.canvas;
    }
    dispose() {
      (this.planeTexture?.destroy?.(),
        this.lutTexture?.destroy?.(),
        this.uniformBuffer?.destroy?.(),
        this.device?.destroy?.(),
        (this.device = null),
        (this.context = null),
        (this.canvas = null),
        (this.pipeline = null),
        (this.uniformBuffer = null),
        (this.planeTexture = null),
        (this.lutTexture = null),
        (this.planeKey = ''));
    }
  };
var Tc = [
    '#ffd400',
    '#00d4ff',
    '#ff6ec7',
    '#7cff5a',
    '#ff8c42',
    '#b58cff',
    '#4cd4a0',
    '#ff5a5a',
    '#5a9cff',
    '#d4c65a',
  ],
  Oa = class {
    constructor() {
      this.rois = [];
      this.selected = new Set();
      this.undoStack = [];
      this.redoStack = [];
      this.listeners = [];
      this.counter = 0;
      this.paletteIndex = 0;
      this.suppressHistory = !1;
    }
    onChange(e) {
      this.listeners.push(e);
    }
    emit(e = !1) {
      let t = { rois: this.rois, selectedIds: Array.from(this.selected), interactive: e };
      for (let n of this.listeners) n(t);
    }
    list() {
      return this.rois;
    }
    count() {
      return this.rois.length;
    }
    get(e) {
      return this.rois.find(t => t.id === e);
    }
    selectedIds() {
      return Array.from(this.selected);
    }
    selectedRois() {
      return this.rois.filter(e => this.selected.has(e.id));
    }
    isSelected(e) {
      return this.selected.has(e);
    }
    nextId() {
      return (this.counter++, `roi-${Date.now().toString(36)}-${this.counter.toString(36)}`);
    }
    nextColor() {
      let e = Tc[this.paletteIndex % Tc.length];
      return (this.paletteIndex++, e);
    }
    nextName(e) {
      let t =
          e === 'point'
            ? 'Points'
            : e === 'line' || e === 'polyline'
              ? 'Line'
              : e === 'mask'
                ? 'Object'
                : 'ROI',
        n = 1,
        i = new Set(this.rois.map(a => a.name));
      for (; i.has(`${t} ${n}`);) n++;
      return `${t} ${n}`;
    }
    beginEdit() {
      this.suppressHistory ||
        (this.undoStack.push(this.snapshot()),
        this.undoStack.length > 100 && this.undoStack.shift(),
        (this.redoStack.length = 0));
    }
    snapshot() {
      return JSON.stringify(this.rois, (e, t) =>
        t instanceof Uint8Array ? { __mask: Array.from(t) } : t
      );
    }
    restore(e) {
      this.rois = JSON.parse(e, (n, i) =>
        i && typeof i == 'object' && Array.isArray(i.__mask) ? Uint8Array.from(i.__mask) : i
      );
      let t = new Set(this.rois.map(n => n.id));
      for (let n of Array.from(this.selected)) t.has(n) || this.selected.delete(n);
    }
    canUndo() {
      return this.undoStack.length > 0;
    }
    canRedo() {
      return this.redoStack.length > 0;
    }
    undo() {
      let e = this.undoStack.pop();
      e !== void 0 && (this.redoStack.push(this.snapshot()), this.restore(e), this.emit());
    }
    redo() {
      let e = this.redoStack.pop();
      e !== void 0 && (this.undoStack.push(this.snapshot()), this.restore(e), this.emit());
    }
    withoutHistory(e) {
      let t = this.suppressHistory;
      this.suppressHistory = !0;
      try {
        e();
      } finally {
        this.suppressHistory = t;
      }
    }
    add(e, t = {}) {
      return (
        this.beginEdit(),
        e.color || (e.color = this.nextColor()),
        this.rois.push(e),
        t.select !== !1 && (this.selected.clear(), this.selected.add(e.id)),
        this.emit(t.interactive === !0),
        e
      );
    }
    addMany(e, t = {}) {
      if (e.length !== 0) {
        this.beginEdit();
        for (let n of e) (n.color || (n.color = this.nextColor()), this.rois.push(n));
        if (t.select) {
          this.selected.clear();
          for (let n of e) this.selected.add(n.id);
        }
        this.emit();
      }
    }
    update(e, t, n = {}) {
      let i = this.rois.findIndex(a => a.id === e);
      i < 0 ||
        (n.interactive || this.beginEdit(),
        (this.rois[i] = t(this.rois[i])),
        this.emit(n.interactive === !0));
    }
    remove(e) {
      if (e.length === 0) return;
      this.beginEdit();
      let t = new Set(e);
      this.rois = this.rois.filter(n => !t.has(n.id));
      for (let n of e) this.selected.delete(n);
      this.emit();
    }
    clear() {
      this.rois.length !== 0 &&
        (this.beginEdit(), (this.rois = []), this.selected.clear(), this.emit());
    }
    rename(e, t) {
      this.update(e, n => ({ ...n, name: t }));
    }
    setGroup(e, t) {
      if (e.length === 0) return;
      this.beginEdit();
      let n = new Set(e);
      ((this.rois = this.rois.map(i => (n.has(i.id) ? { ...i, group: t } : i))), this.emit());
    }
    setColor(e, t) {
      this.update(e, n => ({ ...n, color: t }));
    }
    reorder(e, t) {
      let n = this.rois.findIndex(a => a.id === e);
      if (n < 0 || t === n) return;
      this.beginEdit();
      let [i] = this.rois.splice(n, 1);
      (this.rois.splice(Math.max(0, Math.min(this.rois.length, t)), 0, i), this.emit());
    }
    select(e, t = {}) {
      t.additive || this.selected.clear();
      for (let n of e) this.selected.add(n);
      this.emit();
    }
    toggleSelection(e) {
      (this.selected.has(e) ? this.selected.delete(e) : this.selected.add(e), this.emit());
    }
    selectAll() {
      this.selected.clear();
      for (let e of this.rois) this.selected.add(e.id);
      this.emit();
    }
    clearSelection() {
      this.selected.size !== 0 && (this.selected.clear(), this.emit());
    }
    replaceAll(e, t = {}) {
      (t.recordHistory !== !1 && this.beginEdit(),
        (this.rois = e.slice()),
        this.selected.clear(),
        (this.paletteIndex = e.length),
        this.emit());
    }
    renumber() {
      this.beginEdit();
      let e = new Map();
      ((this.rois = this.rois.map(t => {
        let n = t.name.replace(/\s*\d+$/, '') || 'ROI',
          i = (e.get(n) || 0) + 1;
        return (e.set(n, i), { ...t, name: `${n} ${i}` });
      })),
        this.emit());
    }
  };
var Ai = 4.5,
  _c = 6,
  Va = class {
    constructor(e, t) {
      this.tool = 'select';
      this.active = !1;
      this.drag = null;
      this.pending = [];
      this.pendingLivewirePath = [];
      this.hoverImagePoint = null;
      this.wandPreview = null;
      this.wandPreviewKey = '';
      this.gradientCache = null;
      this.brushRadius = 8;
      this.wandTolerance = null;
      this.showScaleBar = !0;
      this.scaleBarPosition = null;
      this.scaleBarDragOffset = null;
      this.scaleBarWhenIdle = !0;
      this.showLabels = !1;
      this.redrawHandle = 0;
      this.hoveredRoiId = null;
      this.showRois = !0;
      this.showMask = !0;
      this.peeking = !1;
      this.consumeNextClick = !1;
      this.maskPreview = null;
      this.maskPreviewCanvas = null;
      this.maskPreviewToken = null;
      this.boundRedraw = () => this.scheduleRedraw();
      this.moveScaleBar = e => {
        if (!this.scaleBarDragOffset) return;
        let t = Number.parseFloat(
            getComputedStyle(document.documentElement).getPropertyValue(
              '--measure-scale-bar-bottom-inset'
            )
          ),
          n = Number.isFinite(t) ? Math.max(0, t) : 0,
          i = Math.max(1, window.innerHeight - n),
          a = e.clientX - this.scaleBarDragOffset.x,
          r = e.clientY - this.scaleBarDragOffset.y;
        ((this.scaleBarPosition = {
          x: Math.max(0, Math.min(1, a / Math.max(1, window.innerWidth))),
          y: Math.max(0, Math.min(1, r / i)),
        }),
          this.scheduleRedraw());
      };
      this.endScaleBarDrag = () => {
        this.scaleBarDragOffset &&
          ((this.scaleBarDragOffset = null), this.host.onScaleBarPositionChanged?.());
      };
      this.lastWandTolerance = 0;
      ((this.manager = e),
        (this.host = t),
        (this.canvas = document.createElement('canvas')),
        (this.canvas.className = 'measure-overlay'),
        (this.canvas.style.display = 'none'),
        (this.ctx = this.canvas.getContext('2d')),
        document.body.appendChild(this.canvas),
        (this.scaleBarHandle = document.createElement('div')),
        (this.scaleBarHandle.className = 'measure-scale-bar-handle'),
        (this.scaleBarHandle.title =
          'Drag to move the scale bar; double-click to restore automatic placement'),
        document.body.appendChild(this.scaleBarHandle),
        this.manager.onChange(n => {
          (this.scheduleRedraw(), this.host.onRoiEdited(n.interactive));
        }),
        window.addEventListener('scroll', this.boundRedraw, !0),
        window.addEventListener('resize', this.boundRedraw),
        this.canvas.addEventListener('mousedown', n => this.onMouseDown(n)),
        this.canvas.addEventListener('mousemove', n => this.onMouseMove(n)),
        this.canvas.addEventListener('mouseup', n => this.onMouseUp(n)),
        this.canvas.addEventListener('mouseleave', () => this.onMouseLeave()),
        this.canvas.addEventListener('click', n => {
          ((this.tool !== 'select' || this.consumeNextClick) &&
            (n.preventDefault(), n.stopPropagation()),
            (this.consumeNextClick = !1));
        }),
        this.canvas.addEventListener('dblclick', n => this.onDoubleClick(n)),
        this.canvas.addEventListener('contextmenu', n => this.onContextMenu(n)),
        this.canvas.addEventListener('wheel', n => this.onWheel(n), { passive: !1 }),
        this.scaleBarHandle.addEventListener('mousedown', n => this.beginScaleBarDrag(n)),
        this.scaleBarHandle.addEventListener('dblclick', n => {
          (n.preventDefault(), n.stopPropagation(), this.resetScaleBarPosition());
        }),
        window.addEventListener('mousemove', this.moveScaleBar),
        window.addEventListener('mouseup', this.endScaleBarDrag));
    }
    dispose() {
      (window.removeEventListener('scroll', this.boundRedraw, !0),
        window.removeEventListener('resize', this.boundRedraw),
        window.removeEventListener('mousemove', this.moveScaleBar),
        window.removeEventListener('mouseup', this.endScaleBarDrag),
        this.canvas.remove(),
        this.scaleBarHandle.remove());
    }
    setActive(e) {
      ((this.active = e), this.updateVisibility(), this.scheduleRedraw());
    }
    isActive() {
      return this.active;
    }
    setTool(e) {
      (this.cancelPending(),
        (this.tool = e),
        this.updatePointerEvents(),
        this.host.onHint(_h[e] || ''),
        this.scheduleRedraw());
    }
    getTool() {
      return this.tool;
    }
    setBrushRadius(e) {
      ((this.brushRadius = Math.max(1, e)), this.scheduleRedraw());
    }
    getBrushRadius() {
      return this.brushRadius;
    }
    setWandTolerance(e) {
      ((this.wandTolerance = e), (this.wandPreviewKey = ''), this.scheduleRedraw());
    }
    getWandTolerance() {
      return this.wandTolerance;
    }
    setShowScaleBar(e) {
      ((this.showScaleBar = e), this.updateVisibility(), this.scheduleRedraw());
    }
    getShowScaleBar() {
      return this.showScaleBar;
    }
    getScaleBarPosition() {
      return this.scaleBarPosition ? { ...this.scaleBarPosition } : null;
    }
    setScaleBarPosition(e) {
      ((this.scaleBarPosition =
        e && Number.isFinite(e.x) && Number.isFinite(e.y)
          ? { x: Math.max(0, Math.min(1, e.x)), y: Math.max(0, Math.min(1, e.y)) }
          : null),
        this.scheduleRedraw());
    }
    hasCustomScaleBarPosition() {
      return this.scaleBarPosition !== null;
    }
    resetScaleBarPosition() {
      this.scaleBarPosition &&
        ((this.scaleBarPosition = null),
        this.host.onScaleBarPositionChanged?.(),
        this.scheduleRedraw());
    }
    toggleScaleBar() {
      return (
        (this.showScaleBar = !this.showScaleBar),
        this.updateVisibility(),
        this.scheduleRedraw(),
        this.showScaleBar
      );
    }
    setShowLabels(e) {
      ((this.showLabels = e), this.scheduleRedraw());
    }
    setShowRois(e) {
      ((this.showRois = e), this.scheduleRedraw());
    }
    getShowRois() {
      return this.showRois;
    }
    setShowMask(e) {
      ((this.showMask = e), this.scheduleRedraw());
    }
    getShowMask() {
      return this.showMask;
    }
    setPeeking(e) {
      this.peeking !== e && ((this.peeking = e), this.scheduleRedraw());
    }
    isPeeking() {
      return this.peeking;
    }
    setHoveredRoi(e) {
      this.hoveredRoiId !== e && ((this.hoveredRoiId = e), this.scheduleRedraw());
    }
    invalidateImage() {
      ((this.gradientCache = null),
        (this.wandPreview = null),
        (this.wandPreviewKey = ''),
        this.setMaskPreview(null),
        this.scheduleRedraw());
    }
    setMaskPreview(e) {
      ((this.maskPreview = e),
        (this.maskPreviewCanvas = null),
        (this.maskPreviewToken = null),
        this.scheduleRedraw());
    }
    hasMaskPreview() {
      return this.maskPreview !== null;
    }
    ensureMaskPreviewCanvas() {
      let e = this.maskPreview;
      if (!e || e.width <= 0 || e.height <= 0) return null;
      if (this.maskPreviewCanvas && this.maskPreviewToken === e) return this.maskPreviewCanvas;
      let t = document.createElement('canvas');
      ((t.width = e.width), (t.height = e.height));
      let n = t.getContext('2d');
      if (!n) return null;
      let i = n.createImageData(e.width, e.height),
        a = i.data,
        r = Math.round(255 * (e.opacity ?? 0.45)),
        s = e.accepted;
      for (let o = 0; o < e.mask.length; o++) {
        if (!e.mask[o]) continue;
        let h = o * 4;
        (s && s[o]
          ? ((a[h] = 40), (a[h + 1] = 220), (a[h + 2] = 120))
          : ((a[h] = 255), (a[h + 1] = 60), (a[h + 2] = 60)),
          (a[h + 3] = r));
      }
      return (
        n.putImageData(i, 0, 0),
        (this.maskPreviewCanvas = t),
        (this.maskPreviewToken = e),
        t
      );
    }
    updatePointerEvents() {
      this.canvas.style.pointerEvents = this.active ? 'auto' : 'none';
    }
    isIdleScaleBarVisible() {
      return (
        !this.active &&
        this.showScaleBar &&
        this.scaleBarWhenIdle &&
        this.host.getCalibration().origin !== 'none'
      );
    }
    updateVisibility() {
      ((this.canvas.style.display = this.active || this.isIdleScaleBarVisible() ? 'block' : 'none'),
        this.updatePointerEvents());
    }
    imageRect() {
      let e = this.host.getImageElement();
      if (!e) return null;
      let t = e.getBoundingClientRect();
      return t.width <= 0 || t.height <= 0 ? null : t;
    }
    naturalSize() {
      let e = this.host.getImageElement();
      if (!e) return null;
      let t = e.naturalWidth || e.width || 0,
        n = e.naturalHeight || e.height || 0;
      return !t || !n ? null : { width: t, height: n };
    }
    toImage(e, t) {
      let n = this.imageRect(),
        i = this.naturalSize();
      return !n || !i
        ? null
        : { x: ((e - n.left) / n.width) * i.width, y: ((t - n.top) / n.height) * i.height };
    }
    toClient(e, t) {
      let n = this.imageRect(),
        i = this.naturalSize();
      return !n || !i
        ? null
        : { x: n.left + (e / i.width) * n.width, y: n.top + (t / i.height) * n.height };
    }
    pixelScale() {
      let e = this.imageRect(),
        t = this.naturalSize();
      return !e || !t ? 1 : e.width / t.width;
    }
    scheduleRedraw() {
      this.redrawHandle ||
        (this.redrawHandle = requestAnimationFrame(() => {
          ((this.redrawHandle = 0), this.redraw());
        }));
    }
    redraw() {
      if (!this.ctx) return;
      ((this.scaleBarHandle.style.display = 'none'), this.updateVisibility());
      let e = !this.active;
      if (e && !this.isIdleScaleBarVisible()) return;
      this.canvas.isConnected || document.body.appendChild(this.canvas);
      let t = window.devicePixelRatio || 1,
        n = window.innerWidth,
        i = window.innerHeight;
      (this.canvas.width !== Math.round(n * t) || this.canvas.height !== Math.round(i * t)) &&
        ((this.canvas.width = Math.round(n * t)),
        (this.canvas.height = Math.round(i * t)),
        (this.canvas.style.width = `${n}px`),
        (this.canvas.style.height = `${i}px`));
      let a = this.ctx;
      (a.setTransform(t, 0, 0, t, 0, 0), a.clearRect(0, 0, n, i));
      let r = this.imageRect();
      if (!r) return;
      if (e) {
        this.drawScaleBar(a, r);
        return;
      }
      if (
        (a.save(), a.beginPath(), a.rect(r.left, r.top, r.width, r.height), a.clip(), this.peeking)
      ) {
        a.restore();
        return;
      }
      let s = this.showMask ? this.ensureMaskPreviewCanvas() : null;
      if (
        (s &&
          ((a.imageSmoothingEnabled = !1),
          a.drawImage(s, r.left, r.top, r.width, r.height),
          (a.imageSmoothingEnabled = !0)),
        this.showRois)
      )
        for (let o of this.manager.list()) this.drawRoi(a, o, this.manager.isSelected(o.id));
      (this.drawPending(a),
        this.drawWandPreview(a),
        this.drawBrushCursor(a),
        a.restore(),
        this.showScaleBar && this.drawScaleBar(a, r));
    }
    drawRoi(e, t, n) {
      let i = this.hoveredRoiId === t.id,
        a = t.color || '#ffd400';
      if (
        ((e.lineWidth = n ? 2 : i ? 1.75 : 1.25),
        (e.strokeStyle = a),
        e.setLineDash([]),
        t.kind === 'point')
      ) {
        let h = t.points || [];
        e.fillStyle = a;
        for (let u = 0; u + 1 < h.length; u += 2) {
          let d = this.toClient(h[u] + 0.5, h[u + 1] + 0.5);
          d &&
            (e.beginPath(),
            e.arc(d.x, d.y, n ? 5 : 4, 0, Math.PI * 2),
            e.fill(),
            e.beginPath(),
            e.moveTo(d.x - 8, d.y),
            e.lineTo(d.x + 8, d.y),
            e.moveTo(d.x, d.y - 8),
            e.lineTo(d.x, d.y + 8),
            e.stroke(),
            this.showLabels && this.drawLabel(e, String(u / 2 + 1), d.x + 7, d.y - 7, a));
        }
        return;
      }
      let r = t.kind === 'mask' ? Jt(t) : zt(t);
      if (r.length < 4) return;
      e.beginPath();
      let s = !1;
      for (let h = 0; h + 1 < r.length; h += 2) {
        let u = this.toClient(r[h] + 0.5, r[h + 1] + 0.5);
        u && (s ? e.lineTo(u.x, u.y) : (e.moveTo(u.x, u.y), (s = !0)));
      }
      if (
        (hn(t.kind) && e.closePath(),
        (i || n) &&
          (e.save(),
          (e.strokeStyle = 'rgba(255, 255, 255, 0.85)'),
          (e.lineWidth = (n ? 2 : 1.75) + 2.5),
          e.stroke(),
          e.restore()),
        e.stroke(),
        (n || i) &&
          hn(t.kind) &&
          (e.save(), (e.globalAlpha = n ? 0.18 : 0.1), (e.fillStyle = a), e.fill(), e.restore()),
        n && this.drawHandles(e, t),
        (n || i) && this.drawSelectionMarker(e, r),
        ((this.showLabels && this.roiScreenExtent(r) >= 26) || n || i) && t.name)
      ) {
        let h = this.toClient(r[0] + 0.5, r[1] + 0.5);
        h && this.drawLabel(e, t.name, h.x + 6, h.y - 6, a);
      }
    }
    drawSelectionMarker(e, t) {
      if (t.length < 4) return;
      let n = 1 / 0,
        i = 1 / 0,
        a = -1 / 0,
        r = -1 / 0;
      for (let m = 0; m + 1 < t.length; m += 2) {
        let p = this.toClient(t[m] + 0.5, t[m + 1] + 0.5);
        p &&
          ((n = Math.min(n, p.x)),
          (a = Math.max(a, p.x)),
          (i = Math.min(i, p.y)),
          (r = Math.max(r, p.y)));
      }
      if (!Number.isFinite(n)) return;
      let s = 6,
        o = (n + a) / 2,
        h = (i + r) / 2,
        u = Math.max((a - n) / 2 + s, 9),
        d = Math.max((r - i) / 2 + s, 9);
      (e.save(),
        e.setLineDash([4, 3]),
        (e.strokeStyle = '#ffffff'),
        (e.lineWidth = 1),
        e.strokeRect(o - u, h - d, u * 2, d * 2),
        e.restore());
    }
    revealRoi(e) {
      let t = this.manager.get(e);
      if (!t) return;
      let n = t.kind === 'mask' ? Jt(t) : zt(t);
      if (n.length < 2) return;
      let i = 0,
        a = 0,
        r = 0;
      for (let u = 0; u + 1 < n.length; u += 2) ((i += n[u]), (a += n[u + 1]), r++);
      let s = this.toClient(i / r, a / r);
      if (!s) return;
      let o = 80;
      (s.x < o || s.y < o || s.x > window.innerWidth - o || s.y > window.innerHeight - o) &&
        window.scrollBy({
          left: s.x - window.innerWidth / 2,
          top: s.y - window.innerHeight / 2,
          behavior: 'smooth',
        });
    }
    roiScreenExtent(e) {
      if (e.length < 4) return 0;
      let t = 1 / 0,
        n = 1 / 0,
        i = -1 / 0,
        a = -1 / 0;
      for (let s = 0; s + 1 < e.length; s += 2)
        (e[s] < t && (t = e[s]),
          e[s] > i && (i = e[s]),
          e[s + 1] < n && (n = e[s + 1]),
          e[s + 1] > a && (a = e[s + 1]));
      let r = this.pixelScale();
      return Math.max(i - t, a - n) * r;
    }
    drawHandles(e, t) {
      let n = this.handlePositions(t),
        i = t.kind === 'rect' || t.kind === 'ellipse';
      ((e.fillStyle = '#ffffff'), (e.strokeStyle = t.color || '#ffd400'), (e.lineWidth = 1.5));
      for (let a = 0; a < n.length; a++) {
        let r = this.toClient(n[a].x + 0.5, n[a].y + 0.5);
        if (!r) continue;
        let s = i && a === 4;
        (e.beginPath(),
          s ? e.arc(r.x, r.y, Ai, 0, Math.PI * 2) : e.rect(r.x - Ai, r.y - Ai, Ai * 2, Ai * 2),
          e.fill(),
          e.stroke());
      }
    }
    handlePositions(e) {
      switch (e.kind) {
        case 'rect':
        case 'ellipse': {
          let t = e,
            n = t.angle || 0,
            i = t.x + t.width / 2,
            a = t.y + t.height / 2,
            r = (o, h) => {
              if (!n) return { x: o, y: h };
              let u = Math.cos(n),
                d = Math.sin(n),
                m = o - i,
                p = h - a;
              return { x: i + m * u - p * d, y: a + m * d + p * u };
            },
            s = Math.max(12, t.height * 0.25);
          return [
            r(t.x, t.y),
            r(t.x + t.width, t.y),
            r(t.x + t.width, t.y + t.height),
            r(t.x, t.y + t.height),
            r(i, t.y - s),
          ];
        }
        case 'polygon':
        case 'freehand':
        case 'line':
        case 'polyline':
        case 'point': {
          let t = e.points || [],
            n = [],
            i = t.length / 2 > 64 ? Math.ceil(t.length / 2 / 64) : 1;
          for (let a = 0; a + 1 < t.length; a += 2 * i) n.push({ x: t[a], y: t[a + 1] });
          return n;
        }
        default:
          return [];
      }
    }
    drawPending(e) {
      let t = this.drag;
      if (t && (t.tool === 'rect' || t.tool === 'ellipse')) {
        let n = this.dragRectRoi(t);
        if (n) {
          (e.save(), e.setLineDash([4, 3]), (e.strokeStyle = '#ffffff'), (e.lineWidth = 1.25));
          let i = t.tool === 'rect' ? Da(n) : Fa(n);
          (this.strokePath(e, i, !0), e.restore());
        }
      }
      if (
        (t &&
          t.tool === 'freehand' &&
          t.points &&
          (e.save(),
          (e.strokeStyle = '#ffffff'),
          (e.lineWidth = 1.5),
          this.strokePath(e, t.points, !1),
          e.restore()),
        t &&
          (t.tool === 'line' || t.tool === 'calibrate') &&
          (e.save(),
          e.setLineDash([4, 3]),
          (e.strokeStyle = t.tool === 'calibrate' ? '#4cd4a0' : '#ffffff'),
          (e.lineWidth = 1.5),
          this.strokePath(e, [t.startX, t.startY, t.currentX, t.currentY], !1),
          e.restore(),
          t.tool === 'calibrate'))
      ) {
        let n = Math.hypot(t.currentX - t.startX, t.currentY - t.startY),
          i = this.toClient((t.startX + t.currentX) / 2, (t.startY + t.currentY) / 2);
        i && this.drawLabel(e, `${n.toFixed(1)} px`, i.x + 8, i.y - 8, '#4cd4a0');
      }
      if (this.pending.length >= 2) {
        let i = (
          this.pendingLivewirePath.length >= 4 ? this.pendingLivewirePath : this.pending
        ).slice();
        (this.hoverImagePoint && i.push(this.hoverImagePoint.x, this.hoverImagePoint.y),
          e.save(),
          e.setLineDash([5, 3]),
          (e.strokeStyle = '#ffffff'),
          (e.lineWidth = 1.5),
          this.strokePath(e, i, !1),
          e.restore(),
          (e.fillStyle = '#ffffff'));
        for (let a = 0; a + 1 < this.pending.length; a += 2) {
          let r = this.toClient(this.pending[a], this.pending[a + 1]);
          r && (e.beginPath(), e.arc(r.x, r.y, 3, 0, Math.PI * 2), e.fill());
        }
      }
    }
    drawWandPreview(e) {
      if (this.tool !== 'wand' || !this.wandPreview) return;
      let t = Jt(this.wandPreview);
      t.length < 4 ||
        (e.save(),
        e.setLineDash([3, 2]),
        (e.strokeStyle = '#00d4ff'),
        (e.lineWidth = 1.5),
        this.strokePath(e, t, !0),
        (e.globalAlpha = 0.15),
        (e.fillStyle = '#00d4ff'),
        e.fill(),
        e.restore());
    }
    drawBrushCursor(e) {
      if (this.tool !== 'brush' || !this.hoverImagePoint) return;
      let t = this.toClient(this.hoverImagePoint.x, this.hoverImagePoint.y);
      t &&
        (e.save(),
        (e.strokeStyle = '#ffffff'),
        (e.lineWidth = 1),
        e.setLineDash([2, 2]),
        e.beginPath(),
        e.arc(t.x, t.y, this.brushRadius * this.pixelScale(), 0, Math.PI * 2),
        e.stroke(),
        e.restore());
    }
    drawScaleBar(e, t) {
      let n = this.host.getCalibration();
      if (!this.naturalSize()) return;
      let a = Math.min(t.width, window.innerWidth) / this.pixelScale(),
        r = Rl(a, n);
      if (!r) return;
      let s = r.lengthPixels * this.pixelScale();
      if (!(s > 20) || s > window.innerWidth * 0.6) return;
      let o = Number.parseFloat(
          getComputedStyle(document.documentElement).getPropertyValue(
            '--measure-scale-bar-bottom-inset'
          )
        ),
        h = Number.isFinite(o) ? Math.max(0, o) : 0,
        u = window.innerHeight - h,
        d = 8,
        m = Math.max(t.left, 0) + 16,
        p = Math.min(t.bottom, u) - 22,
        v = this.scaleBarPosition ? this.scaleBarPosition.x * window.innerWidth : m,
        g = this.scaleBarPosition ? this.scaleBarPosition.y * u : p,
        w = Math.max(d, Math.min(window.innerWidth - s - d, v)),
        k = Math.max(20, Math.min(u - d, g));
      (e.save(),
        (e.fillStyle = 'rgba(0, 0, 0, 0.55)'),
        e.fillRect(w - 6, k - 16, s + 12, 30),
        (e.strokeStyle = '#ffffff'),
        (e.fillStyle = '#ffffff'),
        (e.lineWidth = 3),
        e.beginPath(),
        e.moveTo(w, k),
        e.lineTo(w + s, k),
        e.stroke(),
        (e.font = '11px var(--vscode-editor-font-family, monospace)'),
        (e.textAlign = 'center'),
        e.fillText(r.label, w + s / 2, k - 5),
        e.restore(),
        (this.scaleBarHandle.style.left = `${w - 6}px`),
        (this.scaleBarHandle.style.top = `${k - 16}px`),
        (this.scaleBarHandle.style.width = `${s + 12}px`),
        (this.scaleBarHandle.style.height = '30px'),
        (this.scaleBarHandle.style.display = 'block'));
    }
    beginScaleBarDrag(e) {
      if (e.button !== 0) return;
      let t = this.scaleBarHandle.getBoundingClientRect();
      ((this.scaleBarDragOffset = { x: e.clientX - (t.left + 6), y: e.clientY - (t.top + 16) }),
        e.preventDefault(),
        e.stopPropagation());
    }
    strokePath(e, t, n) {
      e.beginPath();
      let i = !1;
      for (let a = 0; a + 1 < t.length; a += 2) {
        let r = this.toClient(t[a] + 0.5, t[a + 1] + 0.5);
        r && (i ? e.lineTo(r.x, r.y) : (e.moveTo(r.x, r.y), (i = !0)));
      }
      (n && e.closePath(), e.stroke());
    }
    drawLabel(e, t, n, i, a) {
      (e.save(), (e.font = '11px var(--vscode-font-family, sans-serif)'));
      let r = e.measureText(t);
      ((e.fillStyle = 'rgba(0, 0, 0, 0.6)'),
        e.fillRect(n - 2, i - 11, r.width + 4, 14),
        (e.fillStyle = a),
        e.fillText(t, n, i),
        e.restore());
    }
    onMouseDown(e) {
      if (!this.active || e.button !== 0) return;
      let t = this.toImage(e.clientX, e.clientY);
      if (t) {
        if (this.tool === 'select') {
          this.beginSelectDrag(e, t);
          return;
        }
        switch ((e.preventDefault(), e.stopPropagation(), this.tool)) {
          case 'rect':
          case 'ellipse':
          case 'line':
          case 'calibrate':
            this.drag = { tool: this.tool, startX: t.x, startY: t.y, currentX: t.x, currentY: t.y };
            break;
          case 'freehand':
            this.drag = {
              tool: 'freehand',
              startX: t.x,
              startY: t.y,
              currentX: t.x,
              currentY: t.y,
              points: [t.x, t.y],
            };
            break;
          case 'polygon':
          case 'polyline':
            (this.pending.push(t.x, t.y),
              this.host.onHint(
                'Click to add points. Double-click or press Enter to finish, Escape to cancel.'
              ));
            break;
          case 'livewire':
            this.addLivewirePoint(t);
            break;
          case 'point':
            this.addCounterPoint(t, e.altKey);
            break;
          case 'wand':
            this.commitWand(t, e.shiftKey);
            break;
          case 'brush':
            this.beginBrush(t, e.altKey || e.shiftKey);
            break;
        }
        this.scheduleRedraw();
      }
    }
    onMouseMove(e) {
      if (!this.active) return;
      let t = this.toImage(e.clientX, e.clientY);
      if (((this.hoverImagePoint = t), !!t)) {
        if (this.drag) {
          if (
            ((this.drag.currentX = t.x),
            (this.drag.currentY = t.y),
            this.drag.tool === 'freehand' && this.drag.points)
          ) {
            let n = this.drag.points,
              i = n[n.length - 2],
              a = n[n.length - 1];
            Math.hypot(t.x - i, t.y - a) >= 1 && n.push(t.x, t.y);
          } else
            this.drag.tool === 'brush'
              ? this.applyBrush(t, this.drag.erase === !0)
              : this.drag.tool === 'select' && this.updateSelectDrag(t);
          this.scheduleRedraw();
          return;
        }
        if (this.tool === 'select') {
          let n = this.hitTest(t, _c / this.pixelScale());
          this.setHoveredRoi(n ? n.id : null);
        }
        (this.tool === 'wand' && this.updateWandPreview(t),
          this.tool === 'livewire' && this.pending.length >= 2 && this.updateLivewirePreview(t),
          (this.tool === 'brush' || this.pending.length >= 2) && this.scheduleRedraw());
      }
    }
    onMouseUp(e) {
      if (!this.active || !this.drag) return;
      let t = this.drag;
      this.drag = null;
      let n = this.toImage(e.clientX, e.clientY) || { x: t.currentX, y: t.currentY };
      switch (((t.currentX = n.x), (t.currentY = n.y), t.tool)) {
        case 'rect':
        case 'ellipse': {
          let i = this.dragRectRoi(t);
          i &&
            i.width >= 1 &&
            i.height >= 1 &&
            this.manager.add({
              ...i,
              id: this.manager.nextId(),
              name: this.manager.nextName(t.tool),
              source: 'manual',
            });
          break;
        }
        case 'line': {
          Math.hypot(t.currentX - t.startX, t.currentY - t.startY) >= 1 &&
            this.manager.add({
              id: this.manager.nextId(),
              name: this.manager.nextName('line'),
              kind: 'line',
              source: 'manual',
              points: [t.startX, t.startY, t.currentX, t.currentY],
              lineWidth: 1,
            });
          break;
        }
        case 'calibrate': {
          let i = Math.hypot(t.currentX - t.startX, t.currentY - t.startY);
          i >= 1 && this.host.onCalibrationLine(i);
          break;
        }
        case 'freehand': {
          let i = vs(t.points || [], 0.75);
          i.length >= 6 &&
            this.manager.add({
              id: this.manager.nextId(),
              name: this.manager.nextName('freehand'),
              kind: 'freehand',
              source: 'manual',
              points: i,
            });
          break;
        }
        case 'brush':
          this.host.onRoiEdited(!1);
          break;
        case 'select':
          this.host.onRoiEdited(!1);
          break;
      }
      this.scheduleRedraw();
    }
    onMouseLeave() {
      ((this.hoverImagePoint = null), (this.wandPreview = null), this.scheduleRedraw());
    }
    onDoubleClick(e) {
      this.active &&
        this.pending.length >= 4 &&
        (e.preventDefault(), e.stopPropagation(), this.commitPending());
    }
    onContextMenu(e) {
      this.active &&
        this.pending.length >= 4 &&
        (e.preventDefault(), e.stopPropagation(), this.commitPending());
    }
    onWheel(e) {
      if (this.active) {
        if (this.tool === 'brush') {
          (e.preventDefault(),
            e.stopPropagation(),
            this.setBrushRadius(this.brushRadius * (e.deltaY > 0 ? 0.85 : 1.18)),
            this.host.onHint(`Brush radius ${this.brushRadius.toFixed(1)} px`));
          return;
        }
        if (this.tool === 'wand' && this.wandPreview) {
          (e.preventDefault(), e.stopPropagation());
          let t = this.wandTolerance ?? this.lastWandTolerance,
            n = Math.max(1e-9, t * (e.deltaY > 0 ? 0.8 : 1.25));
          (this.setWandTolerance(n),
            this.host.onHint(`Wand tolerance ${Se(n)}`),
            this.hoverImagePoint && this.updateWandPreview(this.hoverImagePoint));
        }
      }
    }
    handleKey(e) {
      return this.active
        ? e.key === 'Escape'
          ? this.pending.length > 0 || this.drag
            ? (this.cancelPending(), !0)
            : this.tool !== 'select'
              ? (this.setTool('select'), !0)
              : !1
          : e.key === 'Enter' && this.pending.length >= 4
            ? (this.commitPending(), !0)
            : (e.key === 'Delete' || e.key === 'Backspace') && this.manager.selectedIds().length > 0
              ? (this.manager.remove(this.manager.selectedIds()), !0)
              : !1
        : !1;
    }
    cancelPending() {
      ((this.pending = []),
        (this.pendingLivewirePath = []),
        (this.drag = null),
        this.scheduleRedraw());
    }
    commitPending() {
      let e = this.pendingLivewirePath.length >= 6 ? this.pendingLivewirePath : this.pending,
        t = vs(e, 0.5),
        n = this.tool === 'polyline' ? 'polyline' : (this.tool === 'livewire', 'polygon');
      (t.length >= (n === 'polyline' ? 4 : 6) &&
        this.manager.add({
          id: this.manager.nextId(),
          name: this.manager.nextName(n),
          kind: n,
          source: 'manual',
          points: t,
          ...(n === 'polyline' ? { lineWidth: 1 } : {}),
        }),
        this.cancelPending());
    }
    dragRectRoi(e) {
      let t = Math.min(e.startX, e.currentX),
        n = Math.min(e.startY, e.currentY),
        i = Math.abs(e.currentX - e.startX),
        a = Math.abs(e.currentY - e.startY);
      return !(i > 0) || !(a > 0)
        ? null
        : {
            id: 'preview',
            name: 'preview',
            kind: e.tool === 'ellipse' ? 'ellipse' : 'rect',
            x: t,
            y: n,
            width: i,
            height: a,
          };
    }
    beginSelectDrag(e, t) {
      let n = _c / this.pixelScale();
      for (let a of this.manager.selectedRois()) {
        let r = this.handlePositions(a);
        for (let s = 0; s < r.length; s++)
          if (Math.hypot(r[s].x - t.x, r[s].y - t.y) <= n) {
            (e.preventDefault(),
              e.stopPropagation(),
              (this.consumeNextClick = !0),
              this.manager.beginEdit(),
              (this.drag = {
                tool: 'select',
                startX: t.x,
                startY: t.y,
                currentX: t.x,
                currentY: t.y,
                roiId: a.id,
                vertexIndex: s,
                originalRoi: a,
              }));
            return;
          }
      }
      let i = this.hitTest(t, n);
      if (!i) {
        ((this.consumeNextClick = !1), this.manager.clearSelection(), this.forwardToImage(e));
        return;
      }
      (e.preventDefault(),
        e.stopPropagation(),
        (this.consumeNextClick = !0),
        e.shiftKey || e.ctrlKey || e.metaKey
          ? this.manager.toggleSelection(i.id)
          : this.manager.isSelected(i.id) || this.manager.select([i.id]),
        this.manager.beginEdit(),
        (this.drag = {
          tool: 'select',
          startX: t.x,
          startY: t.y,
          currentX: t.x,
          currentY: t.y,
          roiId: i.id,
          moving: !0,
          originalRoi: i,
        }));
    }
    updateSelectDrag(e) {
      let t = this.drag;
      if (!t || !t.roiId || !t.originalRoi) return;
      let n = e.x - t.startX,
        i = e.y - t.startY,
        a = t.originalRoi;
      if (t.moving) {
        this.manager.update(t.roiId, () => Lh(a, n, i), { interactive: !0 });
        return;
      }
      if (t.vertexIndex === void 0) return;
      let r = t.vertexIndex;
      if (a.kind === 'rect' || a.kind === 'ellipse') {
        let u = a,
          d = u.x + u.width / 2,
          m = u.y + u.height / 2;
        if (r === 4) {
          let T = Math.atan2(e.y - m, e.x - d) + Math.PI / 2;
          this.manager.update(t.roiId, () => ({ ...u, angle: T }), { interactive: !0 });
          return;
        }
        let p = u.angle || 0,
          g = ((T, _) => {
            if (!p) return { x: T, y: _ };
            let I = Math.cos(-p),
              A = Math.sin(-p),
              N = T - d,
              z = _ - m;
            return { x: d + N * I - z * A, y: m + N * A + z * I };
          })(e.x, e.y),
          w = u.x,
          k = u.y,
          E = u.x + u.width,
          L = u.y + u.height;
        r === 0
          ? ((w = g.x), (k = g.y))
          : r === 1
            ? ((E = g.x), (k = g.y))
            : r === 2
              ? ((E = g.x), (L = g.y))
              : ((w = g.x), (L = g.y));
        let M = {
          ...u,
          x: Math.min(w, E),
          y: Math.min(k, L),
          width: Math.abs(E - w),
          height: Math.abs(L - k),
        };
        this.manager.update(t.roiId, () => M, { interactive: !0 });
        return;
      }
      let s = (a.points || []).slice(),
        o = s.length / 2 > 64 ? Math.ceil(s.length / 2 / 64) : 1,
        h = r * o;
      h * 2 + 1 < s.length &&
        ((s[h * 2] = e.x),
        (s[h * 2 + 1] = e.y),
        this.manager.update(t.roiId, u => ({ ...u, points: s }), { interactive: !0 }));
    }
    hitTest(e, t) {
      let n = this.manager.list();
      for (let i = n.length - 1; i >= 0; i--) {
        let a = n[i];
        if (a.kind === 'point') {
          let s = a.points || [];
          for (let o = 0; o + 1 < s.length; o += 2)
            if (Math.hypot(s[o] - e.x, s[o + 1] - e.y) <= t * 1.5) return a;
          continue;
        }
        if (Yn(a.kind)) {
          if (Na(a.points || [], e.x, e.y) <= t) return a;
          continue;
        }
        if (Al(a, e.x, e.y)) return a;
        let r = a.kind === 'mask' ? Jt(a) : zt(a);
        if (r.length >= 4 && Na(r, e.x, e.y) <= t) return a;
      }
      return null;
    }
    forwardToImage(e) {
      let t = this.host.getImageElement();
      if (!t) return;
      let n = new MouseEvent(e.type, {
        bubbles: !0,
        cancelable: !0,
        clientX: e.clientX,
        clientY: e.clientY,
        button: e.button,
        buttons: e.buttons,
        ctrlKey: e.ctrlKey,
        shiftKey: e.shiftKey,
        altKey: e.altKey,
        metaKey: e.metaKey,
      });
      t.dispatchEvent(n);
    }
    updateWandPreview(e) {
      let t = this.host.getScalarPlane(),
        n = this.host.getSource();
      if (!t || !n) {
        this.wandPreview = null;
        return;
      }
      let i = Math.floor(e.x),
        a = Math.floor(e.y);
      if (i < 0 || a < 0 || i >= n.width || a >= n.height) {
        ((this.wandPreview = null), this.scheduleRedraw());
        return;
      }
      let r = `${i},${a},${this.wandTolerance ?? 'auto'}`;
      if (r === this.wandPreviewKey) return;
      this.wandPreviewKey = r;
      let s =
        this.wandTolerance === null
          ? Xl(t, n.width, n.height, i, a)
          : $a(t, n.width, n.height, i, a, { tolerance: this.wandTolerance });
      ((this.lastWandTolerance = s.tolerance),
        (this.wandPreview = s.count > 0 ? s : null),
        this.host.onHint(
          s.count > 0
            ? `${s.count} px \xB7 tolerance ${Se(s.tolerance)} (scroll to adjust)`
            : 'No region at this point.'
        ),
        this.scheduleRedraw());
    }
    commitWand(e, t) {
      this.updateWandPreview(e);
      let n = this.wandPreview;
      if (n) {
        if (t) {
          let i = this.manager.selectedRois().find(a => a.kind === 'mask');
          if (i) {
            this.manager.update(i.id, a => Th(a, n));
            return;
          }
        }
        this.manager.add({
          id: this.manager.nextId(),
          name: this.manager.nextName('mask'),
          kind: 'mask',
          source: 'wand',
          x: n.x,
          y: n.y,
          width: n.width,
          height: n.height,
          mask: n.mask,
        });
      }
    }
    ensureGradient() {
      let e = this.host.getScalarPlane(),
        t = this.host.getSource();
      if (!e || !t) return null;
      if (this.gradientCache && this.gradientCache.plane === e) return this.gradientCache.gradient;
      let n = Yl(e, t.width, t.height);
      return ((this.gradientCache = { plane: e, gradient: n }), n);
    }
    addLivewirePoint(e) {
      if (this.pending.length === 0) {
        (this.pending.push(e.x, e.y),
          (this.pendingLivewirePath = [e.x, e.y]),
          this.host.onHint(
            'Click along the boundary. The path snaps to the strongest edge. Double-click to close.'
          ));
        return;
      }
      ((this.pendingLivewirePath = this.livewirePathTo(e)), this.pending.push(e.x, e.y));
    }
    updateLivewirePreview(e) {
      ((this.pendingLivewirePath = this.livewirePathTo(e)), this.scheduleRedraw());
    }
    livewirePathTo(e) {
      let t = this.ensureGradient(),
        n = this.host.getSource();
      if (!t || !n || this.pending.length < 2) return this.pending.slice();
      let i =
          this.pendingLivewirePath.length >= 2
            ? this.pendingLivewirePath.slice(0, this.pendingLivewirePath.length)
            : this.pending.slice(),
        a = Math.round(this.pending[this.pending.length - 2]),
        r = Math.round(this.pending[this.pending.length - 1]),
        s = Math.max(0, Math.min(n.width - 1, Math.round(e.x))),
        o = Math.max(0, Math.min(n.height - 1, Math.round(e.y))),
        h = ql(t, n.width, n.height, a, r, s, o);
      return i.concat(h.slice(2));
    }
    addCounterPoint(e, t) {
      let n =
          this.manager.selectedRois().find(r => r.kind === 'point') ??
          this.manager.list().find(r => r.kind === 'point'),
        i = Math.floor(e.x),
        a = Math.floor(e.y);
      if (!n) {
        if (t) return;
        this.manager.add({
          id: this.manager.nextId(),
          name: this.manager.nextName('point'),
          kind: 'point',
          source: 'manual',
          points: [i, a],
        });
        return;
      }
      if (t) {
        let r = n.points.slice(),
          s = -1,
          o = 1 / 0;
        for (let h = 0; h + 1 < r.length; h += 2) {
          let u = Math.hypot(r[h] - e.x, r[h + 1] - e.y);
          u < o && ((o = u), (s = h));
        }
        s >= 0 &&
          o <= 12 / this.pixelScale() &&
          (r.splice(s, 2), this.manager.update(n.id, h => ({ ...h, points: r })));
        return;
      }
      this.manager.update(n.id, r => ({ ...r, points: (r.points || []).concat([i, a]) }));
    }
    beginBrush(e, t) {
      let n = this.manager.selectedRois().find(i => i.kind === 'mask');
      if (!n) {
        if (t) return;
        n = this.manager.add({
          id: this.manager.nextId(),
          name: this.manager.nextName('mask'),
          kind: 'mask',
          source: 'manual',
          x: Math.max(0, Math.floor(e.x)),
          y: Math.max(0, Math.floor(e.y)),
          width: 1,
          height: 1,
          mask: new Uint8Array([0]),
        });
      }
      (this.manager.beginEdit(),
        (this.drag = {
          tool: 'brush',
          startX: e.x,
          startY: e.y,
          currentX: e.x,
          currentY: e.y,
          roiId: n.id,
          erase: t,
        }),
        this.applyBrush(e, t));
    }
    applyBrush(e, t) {
      let n = this.drag,
        i = this.host.getSource();
      !n ||
        !n.roiId ||
        !i ||
        this.manager.update(
          n.roiId,
          a => {
            if (a.kind !== 'mask') return a;
            let r = a,
              s = Kl(r, e.x, e.y, this.brushRadius, t, i.width, i.height);
            return { ...r, x: s.x, y: s.y, width: s.width, height: s.height, mask: s.mask };
          },
          { interactive: !0 }
        );
    }
  };
function Lh(l, e, t) {
  switch (l.kind) {
    case 'rect':
    case 'ellipse': {
      let n = l;
      return { ...n, x: n.x + e, y: n.y + t };
    }
    case 'mask': {
      let n = l;
      return { ...n, x: n.x + Math.round(e), y: n.y + Math.round(t) };
    }
    default: {
      let n = (l.points || []).slice();
      for (let i = 0; i + 1 < n.length; i += 2) ((n[i] += e), (n[i + 1] += t));
      return { ...l, points: n };
    }
  }
}
function Th(l, e) {
  let t = Math.min(l.x, e.x),
    n = Math.min(l.y, e.y),
    i = Math.max(l.x + l.width, e.x + e.width),
    a = Math.max(l.y + l.height, e.y + e.height),
    r = i - t,
    s = a - n,
    o = new Uint8Array(r * s),
    h = u => {
      for (let d = 0; d < u.height; d++) {
        let m = (d + u.y - n) * r + (u.x - t);
        for (let p = 0; p < u.width; p++) u.mask[d * u.width + p] && (o[m + p] = 1);
      }
    };
  return (h(l), h(e), { ...l, x: t, y: n, width: r, height: s, mask: o });
}
var _h = {
  select:
    'Click an ROI to select it, drag to move, drag a handle to reshape. Delete removes the selection.',
  rect: 'Drag to draw a rectangle.',
  ellipse: 'Drag to draw an ellipse.',
  polygon: 'Click to add vertices. Double-click or Enter closes the polygon, Escape cancels.',
  freehand: 'Drag to trace an outline freehand.',
  line: 'Drag to draw a measurement line. Its profile appears in the panel.',
  polyline: 'Click to add segments. Double-click or Enter finishes, Escape cancels.',
  point: 'Click to drop counter markers. Alt-click removes the nearest one.',
  wand: 'Hover to preview the region, click to keep it. Scroll adjusts tolerance, Shift-click merges into the selected object.',
  brush: 'Drag to paint into the selected object. Alt-drag erases, scroll changes the brush size.',
  livewire:
    'Click along an edge; the path snaps to the strongest boundary between clicks. Double-click closes.',
  calibrate: 'Drag along a feature of known length, then enter that length.',
};
var Xa = class {
  constructor() {
    this.colormapNames = wa;
  }
  convertToFloat(e, t, n, i, a = !1, r = !1) {
    return this.decodeRgb(e.data, e.width, e.height, 4, t, n, i, a, r);
  }
  decodeRgb(e, t, n, i, a, r, s, o = !1, h = !1) {
    if (this.colormapNames.indexOf(a) === -1) throw new Error(`Unknown colormap: ${a}`);
    let u = t * n,
      d = new Float32Array(u),
      m = h === !0,
      p = m ? Math.log10(Math.max(1e-10, Math.abs(r))) : 0,
      v = m ? Math.log10(Math.max(1e-10, Math.abs(s))) : 0;
    for (let g = 0; g < u; g++) {
      let w = g * i,
        k = e[w],
        E = e[w + 1],
        L = e[w + 2],
        M = tl(a, k, E, L);
      (M < 0 && (M = 0), o && (M = 255 - M));
      let T = M / 255,
        _;
      (m
        ? ((_ = Math.pow(10, p + T * (v - p))),
          r < 0 && s < 0 ? (_ = -_) : r < 0 && (_ = r + T * (s - r)))
        : (_ = r + T * (s - r)),
        (d[g] = _));
    }
    return d;
  }
};
var Ya = class {
  constructor(e = null) {
    this.worker = null;
    this.ready = !1;
    this.startPromise = null;
    this.blobUrl = null;
    this.nextId = 1;
    this.pending = new Map();
    this.fallback = e;
  }
  start() {
    return (
      this.startPromise ||
        (this.startPromise = this.boot().catch(e => {
          (console.warn('[FastRawWorker] Unavailable; using the Rust fallback:', e),
            this.teardown());
        })),
      this.startPromise
    );
  }
  canDecode(e) {
    return this.ready && (e === 'ppm' || e === 'npy' || e === 'pfm');
  }
  async boot() {
    let e = globalThis.__tiffVisualizerDecoderWarmup;
    if (e?.bundleName === 'fastRawWorker.bundle.js' && e.workerPromise)
      try {
        let r = await e.workerPromise;
        ((this.worker = r.worker),
          (this.blobUrl = r.blobUrl),
          (r.worker.onmessage = s => {
            if (s.data?.type === 'ready') {
              this.ready = !0;
              return;
            }
            let o = this.pending.get(s.data?.id);
            o && (this.pending.delete(s.data.id), o(s.data));
          }),
          (r.worker.onerror = () => this.teardown()),
          (this.ready = !0));
        return;
      } catch {}
    let t = [
        new URL('./fastRawWorker.bundle.js', import.meta.url).href,
        new URL('../fastRawWorker.bundle.js', import.meta.url).href,
      ],
      n = null;
    if (e?.bundleName === 'fastRawWorker.bundle.js' && e.sourcePromise)
      try {
        n = await e.sourcePromise;
      } catch {}
    for (let r of t) {
      if (n) break;
      try {
        let s = await fetch(r);
        if (s.ok) {
          n = await s.text();
          break;
        }
      } catch {}
    }
    if (!n) throw new Error('fastRawWorker.bundle.js not found');
    this.blobUrl = URL.createObjectURL(new Blob([n], { type: 'text/javascript' }));
    let i = new Worker(this.blobUrl);
    ((this.worker = i),
      (i.onmessage = r => {
        if (r.data?.type === 'ready') {
          this.ready = !0;
          return;
        }
        let s = this.pending.get(r.data?.id);
        s && (this.pending.delete(r.data.id), s(r.data));
      }),
      (i.onerror = () => this.teardown()),
      i.postMessage({ type: 'init' }));
    let a = performance.now() + 1e4;
    for (; !this.ready && this.worker === i && performance.now() < a;)
      await new Promise(r => setTimeout(r, 1));
    if (!this.ready) throw new Error('fast raw worker init timeout');
  }
  decode(e, t, n = {}) {
    return e !== 'ppm' && e !== 'npy' && e !== 'pfm'
      ? null
      : !this.ready || !this.worker
        ? this.start().then(() =>
            this.ready && this.worker
              ? this.decode(e, t, n)
              : { ok: !1, error: 'fast raw worker unavailable', buffer: t }
          )
        : this.decodeFast(e, t, n).then(async i =>
            i?.ok || !i?.buffer || !this.fallback
              ? i
              : (await this.fallback.start(), this.fallback.decode(e, i.buffer, n) || i)
          );
  }
  decodeFast(e, t, n) {
    let i = this.nextId++,
      a = this.worker;
    return new Promise(r => {
      let s = setTimeout(() => {
        (this.teardown(), r({ ok: !1, error: 'fast raw worker timeout' }));
      }, 3e4);
      this.pending.set(i, o => {
        (clearTimeout(s), r(o));
      });
      try {
        a.postMessage({ id: i, format: e, buffer: t, options: n }, [t]);
      } catch (o) {
        (clearTimeout(s), this.pending.delete(i), r({ ok: !1, error: String(o), buffer: t }));
      }
    });
  }
  cancelActiveDecodes() {
    this.pending.size && this.teardown();
  }
  dispose() {
    this.teardown();
  }
  teardown() {
    try {
      this.worker?.terminate();
    } catch {}
    ((this.worker = null), (this.ready = !1));
    for (let e of this.pending.values()) e({ ok: !1, error: 'fast raw worker unavailable' });
    (this.pending.clear(),
      this.blobUrl && URL.revokeObjectURL(this.blobUrl),
      (this.blobUrl = null),
      (this.startPromise = null));
  }
};
function Ka(l, e) {
  return l > 1500 || e > 1500;
}
function Pc(l, e, t = !1) {
  let n = Math.max(1, l, e);
  return t && Ka(l, e) ? Math.min(1, 768 / n) : 1;
}
function Ph(l) {
  if (ArrayBuffer.isView(l)) {
    let e = l,
      t = e.constructor;
    return new t(e);
  }
  return Float32Array.from(l);
}
function Ih(l, e, t) {
  return JSON.stringify({
    id: l.id,
    kind: l.kind,
    parentId: l.parentId,
    width: l.width,
    height: l.height,
    channels: l.channels,
    isFloat: l.isFloat,
    typeMax: l.typeMax,
    offsetX: l.offsetX,
    offsetY: l.offsetY,
    opacity: l.opacity,
    blendMode: l.blendMode,
    visible: l.visible,
    clipped: l.clipped,
    maskCondition: l.maskCondition,
    adjustment: l.adjustment,
    dataAssetId: e,
    maskAssetId: t,
    rasterMask: l.rasterMask
      ? {
          width: l.rasterMask.width,
          height: l.rasterMask.height,
          channels: l.rasterMask.channels,
          typeMax: l.rasterMask.typeMax,
          offsetX: l.rasterMask.offsetX,
          offsetY: l.rasterMask.offsetY,
          invert: l.rasterMask.invert,
        }
      : void 0,
  });
}
var It = class It {
  constructor() {
    this.logger = e => console.log(e);
    this.worker = null;
    this.ready = !1;
    this.startPromise = null;
    this.readyResolve = null;
    this.blobUrl = null;
    this.nextRequestId = 1;
    this.nextAssetId = 1;
    this.assetIds = new WeakMap();
    this.sentAssets = new Set();
    this.active = null;
    this.queued = null;
    this.rustCompositor = !1;
    this.rustCapabilityKnown = !1;
    this.rustCapabilityWaiters = [];
    this.lastResult = null;
    this.lastStates = null;
    this.lastWidth = 0;
    this.lastHeight = 0;
    this.lastBackend = null;
    this.lastTileStats = null;
  }
  setLogger(e) {
    this.logger = e;
  }
  invalidateCompositeCache() {
    ((this.lastResult = null),
      (this.lastStates = null),
      (this.lastWidth = 0),
      (this.lastHeight = 0),
      (this.lastBackend = null),
      (this.lastTileStats = null));
  }
  start() {
    return (
      this.startPromise ||
        (this.startPromise = this.boot().catch(e => {
          (console.warn('[LayerCompositorWorker] Unavailable; using main-thread fallback:', e),
            this.teardown());
        })),
      this.startPromise
    );
  }
  async isWasmAvailable() {
    if ((await this.start(), !this.ready || !this.worker)) return !1;
    if (this.rustCapabilityKnown) return this.rustCompositor;
    try {
      return (await this.waitForRustCapability(), !0);
    } catch {
      return !1;
    }
  }
  async boot() {
    let e = [
        new URL('./layerCompositorWorker.bundle.js', import.meta.url).href,
        new URL('../layerCompositorWorker.bundle.js', import.meta.url).href,
      ],
      t = [
        new URL('./wasm/tiff-wasm.wasm', import.meta.url).href,
        new URL('../wasm/tiff-wasm.wasm', import.meta.url).href,
      ],
      n = null;
    for (let s of e)
      try {
        let o = await fetch(s);
        if (o.ok) {
          n = await o.text();
          break;
        }
      } catch {}
    if (!n) throw new Error('layerCompositorWorker.bundle.js not found');
    this.blobUrl = URL.createObjectURL(new Blob([n], { type: 'text/javascript' }));
    let i = new Worker(this.blobUrl);
    ((this.worker = i),
      (i.onmessage = s => this.onMessage(s.data)),
      (i.onerror = s => {
        (console.warn('[LayerCompositorWorker] Worker error:', s.message || s), this.teardown());
      }));
    let a = new Promise((s, o) => {
        ((this.readyResolve = s), setTimeout(() => o(new Error('worker init timeout')), 2e4));
      }),
      r = !1;
    for (let s of t)
      try {
        let o = await fetch(s);
        if (!o.ok) continue;
        let h = await o.arrayBuffer();
        (i.postMessage({ type: 'init-wasm', buffer: h }, [h]), (r = !0));
        break;
      } catch {}
    (r || this.resolveRustCapability(!1), await a, (this.ready = !0));
  }
  waitForRustCapability() {
    return this.rustCapabilityKnown
      ? this.rustCompositor
        ? Promise.resolve()
        : Promise.reject(new Error('Rust/Wasm compositor initialization failed'))
      : new Promise((e, t) => {
          let n = { resolve: e, reject: t };
          (this.rustCapabilityWaiters.push(n),
            setTimeout(() => {
              let i = this.rustCapabilityWaiters.indexOf(n);
              i < 0 ||
                (this.rustCapabilityWaiters.splice(i, 1),
                t(new Error('Timed out waiting for the Rust/Wasm compositor to initialize')));
            }, 2e4));
        });
  }
  resolveRustCapability(e) {
    ((this.rustCompositor = e), (this.rustCapabilityKnown = !0));
    let t = this.rustCapabilityWaiters.splice(0);
    for (let n of t)
      e ? n.resolve() : n.reject(new Error('Rust/Wasm compositor initialization failed'));
  }
  compose(e, t, n, i = 1, a) {
    if (!this.ready || !this.worker)
      return a
        ? this.start().then(() => {
            if (!this.ready || !this.worker)
              throw new Error(
                `The ${a === 'wasm' ? 'Rust/Wasm' : 'JavaScript'} compositor worker is unavailable`
              );
            return this.compose(e, t, n, i, a);
          })
        : null;
    if (a === 'wasm' && !this.rustCompositor)
      return this.waitForRustCapability().then(() => this.compose(e, t, n, i, a));
    let r = a || (this.rustCompositor ? 'wasm' : 'javascript');
    return new Promise((s, o) => {
      let h = { layers: e, width: t, height: n, scale: i, backend: r, resolve: s, reject: o };
      if (this.active) {
        if (i < 1 && this.active.scale === 1) {
          let u = this.active;
          (clearTimeout(u.timer),
            (this.active = null),
            u.resolve(null),
            this.queued?.resolve(null),
            (this.queued = null),
            this.teardown(),
            this.start()
              .then(() => {
                if (!this.ready || !this.worker)
                  throw new Error(
                    `The ${r === 'wasm' ? 'Rust/Wasm' : 'JavaScript'} compositor worker could not restart`
                  );
                this.dispatch(h);
              })
              .catch(o));
          return;
        }
        (this.queued?.resolve(null), (this.queued = h));
      } else this.dispatch(h);
    });
  }
  assetId(e, t, n) {
    if (!e || (typeof e != 'object' && typeof e != 'function')) return;
    let i = e,
      a = this.assetIds.get(i);
    if ((a || ((a = this.nextAssetId++), this.assetIds.set(i, a)), !this.sentAssets.has(a))) {
      let r = Ph(e);
      (t.push({ id: a, data: r }), n.push(r.buffer), this.sentAssets.add(a));
    }
    return a;
  }
  dispatch(e) {
    let t = this.worker;
    if (!t || !this.ready) {
      e.resolve(null);
      return;
    }
    let n = [],
      i = [],
      a = [],
      r = e.layers.map((u, d) => {
        let m = this.assetId(u.data, n, i),
          p = this.assetId(u.rasterMask?.data, n, i),
          v =
            u.rasterMask && p !== void 0
              ? {
                  width: u.rasterMask.width,
                  height: u.rasterMask.height,
                  channels: u.rasterMask.channels,
                  typeMax: u.rasterMask.typeMax,
                  offsetX: u.rasterMask.offsetX,
                  offsetY: u.rasterMask.offsetY,
                  invert: u.rasterMask.invert,
                  dataAssetId: p,
                }
              : void 0,
          g = Ih(u, m, p),
          w = String(u.id || `index-${d}`);
        return (
          a.push({
            key: w,
            signature: g,
            kind: u.kind || 'raster',
            parentId: u.parentId,
            clipped: !!u.clipped,
            hasMask: !!u.rasterMask,
            visible: u.visible !== !1,
            opacity: u.opacity ?? 1,
            blendMode: u.blendMode || 'normal',
            channels: u.channels,
            isFloat: !!u.isFloat,
            typeMax: u.typeMax ?? 1,
            x: Math.round(u.offsetX || 0),
            y: Math.round(u.offsetY || 0),
            width: u.width,
            height: u.height,
          }),
          { ...u, key: w, signature: g, data: void 0, dataAssetId: m, rasterMask: v }
        );
      }),
      s;
    if (
      e.backend === 'javascript' &&
      this.lastBackend === 'javascript' &&
      e.scale === 1 &&
      this.lastResult &&
      this.lastStates &&
      this.lastWidth === e.width &&
      this.lastHeight === e.height
    ) {
      let u = this.dirtyRegion(this.lastStates, a, e.width, e.height);
      if (u === 'unchanged') {
        e.resolve(this.lastResult);
        let d = this.queued;
        ((this.queued = null), d && this.dispatch(d));
        return;
      }
      u && (s = u);
    }
    let o = this.nextRequestId++,
      h = setTimeout(() => {
        this.active?.id === o &&
          (console.warn('[LayerCompositorWorker] Composition timed out; restarting worker'),
          this.active.reject(new Error(`${e.backend} composition timed out after 120000ms`)),
          (this.active = null),
          this.teardown());
      }, 12e4);
    ((this.active = {
      id: o,
      timer: h,
      resolve: e.resolve,
      reject: e.reject,
      states: a,
      width: e.width,
      height: e.height,
      scale: e.scale,
      backend: e.backend,
      region: s,
    }),
      t.postMessage(
        {
          type: 'compose',
          id: o,
          layers: r,
          assets: n,
          width: e.width,
          height: e.height,
          scale: e.scale,
          region: s,
          requestedBackend: e.backend,
        },
        i
      ));
  }
  dirtyRegion(e, t, n, i) {
    if (
      e.length !== t.length ||
      e.some((d, m) => d.key !== t[m].key) ||
      this.outputFormat(e) !== this.outputFormat(t)
    )
      return null;
    let a = [];
    for (let d = 0; d < t.length; d++) e[d].signature !== t[d].signature && a.push(d);
    if (!a.length) return 'unchanged';
    let r = n,
      s = i,
      o = 0,
      h = 0;
    for (let d of a) {
      let m = e[d],
        p = t[d];
      if (
        m.kind !== 'raster' ||
        p.kind !== 'raster' ||
        m.clipped ||
        p.clipped ||
        m.hasMask ||
        p.hasMask ||
        m.parentId !== p.parentId ||
        m.channels !== p.channels ||
        m.isFloat !== p.isFloat ||
        m.typeMax !== p.typeMax
      )
        return null;
      for (let v of [m, p])
        ((r = Math.min(r, v.x)),
          (s = Math.min(s, v.y)),
          (o = Math.max(o, v.x + v.width)),
          (h = Math.max(h, v.y + v.height)));
    }
    return (
      (r = Math.max(0, Math.min(n, r))),
      (s = Math.max(0, Math.min(i, s))),
      (o = Math.max(r, Math.min(n, o))),
      (h = Math.max(s, Math.min(i, h))),
      o <= r || h <= s || (o - r) * (h - s) >= n * i * 0.65
        ? null
        : { x: r, y: s, width: o - r, height: h - s }
    );
  }
  outputFormat(e) {
    let t = e.filter(o => o.visible && o.opacity > 0),
      n = new Set([
        'add',
        'subtract',
        'raw-difference',
        'raw-multiply',
        'divide',
        'min',
        'max',
        'average',
      ]),
      i = t.some(o => n.has(o.blendMode)),
      a = i
        ? t.some(o => o.channels >= 3)
          ? 3
          : 1
        : t.some(o => o.channels === 2 || o.channels === 4)
          ? 4
          : t.some(o => o.channels >= 3)
            ? 3
            : 1,
      r = t.some(o => o.isFloat) || i,
      s = t[0]?.typeMax ?? 1;
    return `${a}:${r}:${s}`;
  }
  mergeRegion(e, t, n) {
    if (
      e.channels !== t.channels ||
      e.typeMax !== t.typeMax ||
      e.isFloat !== t.isFloat ||
      t.width !== n.width ||
      t.height !== n.height
    )
      return null;
    for (let h = 0; h < n.height; h++) {
      let u = h * n.width * t.channels,
        d = ((n.y + h) * e.width + n.x) * e.channels;
      e.data.set(t.data.subarray(u, u + n.width * t.channels), d);
    }
    this.lastTileStats || (this.lastTileStats = this.buildTileStats(e));
    let i = Math.ceil(e.width / It.TILE_SIZE),
      a = Math.floor(n.x / It.TILE_SIZE),
      r = Math.floor(n.y / It.TILE_SIZE),
      s = Math.floor((n.x + n.width - 1) / It.TILE_SIZE),
      o = Math.floor((n.y + n.height - 1) / It.TILE_SIZE);
    for (let h = r; h <= o; h++)
      for (let u = a; u <= s; u++) this.lastTileStats[h * i + u] = this.scanTile(e, u, h);
    return (this.applyTileStats(e, this.lastTileStats), e);
  }
  scanTile(e, t, n) {
    let i = It.TILE_SIZE,
      a = t * i,
      r = n * i,
      s = Math.min(e.width, a + i),
      o = Math.min(e.height, r + i),
      h = e.channels === 4 ? 3 : e.channels,
      u = 1 / 0,
      d = -1 / 0,
      m = 0;
    for (let p = r; p < o; p++)
      for (let v = a; v < s; v++) {
        let g = (p * e.width + v) * e.channels,
          w = e.channels === 4 ? Number(e.data[g + 3]) > 0 : !1;
        if (e.channels !== 4) {
          for (let k = 0; k < h; k++)
            if (Number.isFinite(e.data[g + k])) {
              w = !0;
              break;
            }
        }
        if (w) {
          m++;
          for (let k = 0; k < h; k++) {
            let E = e.data[g + k];
            Number.isFinite(E) && ((u = Math.min(u, E)), (d = Math.max(d, E)));
          }
        }
      }
    return { min: u, max: d, covered: m };
  }
  buildTileStats(e) {
    let t = Math.ceil(e.width / It.TILE_SIZE),
      n = Math.ceil(e.height / It.TILE_SIZE),
      i = [];
    for (let a = 0; a < n; a++) for (let r = 0; r < t; r++) i[a * t + r] = this.scanTile(e, r, a);
    return i;
  }
  applyTileStats(e, t) {
    let n = 1 / 0,
      i = -1 / 0,
      a = 0;
    for (let r of t) ((a += r.covered), r.min < n && (n = r.min), r.max > i && (i = r.max));
    ((e.stats = n === 1 / 0 ? { min: 0, max: 0 } : { min: n, max: i }), (e.coveredCount = a));
  }
  onMessage(e) {
    if (e?.type === 'caps') {
      this.resolveRustCapability(!!e.rustCompositor);
      return;
    }
    if (e?.type === 'ready') {
      ((this.rustCompositor = !!e.caps?.rustCompositor),
        this.readyResolve?.(),
        (this.readyResolve = null));
      return;
    }
    if (!this.active || e?.id !== this.active.id) return;
    clearTimeout(this.active.timer);
    let t = this.active,
      n = t.resolve;
    if (((this.active = null), e.type === 'composite-result')) {
      let a = e.result;
      if (
        ((a.compositorTiming = {
          backend: String(e.backend || t.backend),
          durationMs: Number(e.durationMs || 0),
        }),
        t.scale === 1 && t.region && this.lastResult)
      ) {
        let r = this.mergeRegion(this.lastResult, a, t.region);
        if (!r) {
          ((this.lastResult = null),
            (this.lastStates = null),
            (this.lastTileStats = null),
            n(null));
          let s = this.queued;
          ((this.queued = null), s && this.dispatch(s));
          return;
        }
        a = r;
      }
      (t.scale === 1 &&
        (t.backend === 'javascript'
          ? ((this.lastResult = a),
            (this.lastStates = t.states),
            (this.lastWidth = t.width),
            (this.lastHeight = t.height),
            (this.lastBackend = t.backend),
            t.region || (this.lastTileStats = null))
          : this.invalidateCompositeCache()),
        this.logger(
          `[LayerCompositorWorker] ${a.width}\xD7${a.height} at ${Math.round(t.scale * 100)}% via ${e.backend || 'unknown'} in ${Number(e.durationMs).toFixed(1)}ms`
        ),
        n(a));
    } else {
      let a = new Error(e.error || `${t.backend} composition failed`);
      (this.logger(`[LayerCompositorWorker] ${t.backend} failed: ${a.message}`), t.reject(a));
    }
    let i = this.queued;
    ((this.queued = null), i && this.dispatch(i));
  }
  teardown() {
    ((this.ready = !1), (this.rustCompositor = !1), (this.rustCapabilityKnown = !1));
    for (let e of this.rustCapabilityWaiters.splice(0))
      e.reject(new Error('Layer compositor worker stopped during Rust/Wasm initialization'));
    try {
      this.worker?.terminate();
    } catch {}
    ((this.worker = null),
      this.active &&
        (clearTimeout(this.active.timer),
        this.active.reject(
          new Error('Layer compositor worker stopped before completing the strict render')
        ),
        (this.active = null)),
      this.queued?.resolve(null),
      (this.queued = null),
      this.blobUrl && (URL.revokeObjectURL(this.blobUrl), (this.blobUrl = null)),
      this.sentAssets.clear(),
      (this.assetIds = new WeakMap()),
      (this.lastResult = null),
      (this.lastStates = null),
      (this.lastWidth = 0),
      (this.lastHeight = 0),
      (this.lastBackend = null),
      (this.lastTileStats = null),
      (this.readyResolve = null),
      (this.startPromise = null));
  }
  dispose() {
    this.teardown();
  }
};
It.TILE_SIZE = 256;
var qa = It;
var mn = [
    { id: 'normal', label: 'Normal', arithmetic: !1 },
    { id: 'multiply', label: 'Multiply', arithmetic: !1 },
    { id: 'screen', label: 'Screen', arithmetic: !1 },
    { id: 'overlay', label: 'Overlay', arithmetic: !1 },
    { id: 'darken', label: 'Darken', arithmetic: !1 },
    { id: 'lighten', label: 'Lighten', arithmetic: !1 },
    { id: 'difference', label: 'Difference', arithmetic: !1 },
    { id: 'exclusion', label: 'Exclusion', arithmetic: !1 },
    { id: 'add', label: 'Add', arithmetic: !0 },
    { id: 'subtract', label: 'Subtract', arithmetic: !0 },
    { id: 'raw-difference', label: 'Difference (raw)', arithmetic: !0 },
    { id: 'raw-multiply', label: 'Multiply (raw)', arithmetic: !0 },
    { id: 'divide', label: 'Divide', arithmetic: !0 },
    { id: 'min', label: 'Darken (min)', arithmetic: !0 },
    { id: 'max', label: 'Lighten (max)', arithmetic: !0 },
    { id: 'average', label: 'Average', arithmetic: !0 },
    { id: 'mask', label: 'Brightness Mask', arithmetic: !1, mask: !0 },
  ],
  Ah = new Set(mn.map(l => l.id)),
  zs = new Set(mn.filter(l => l.arithmetic).map(l => l.id)),
  Dh = new Set([
    'normal',
    'multiply',
    'screen',
    'overlay',
    'darken',
    'lighten',
    'difference',
    'exclusion',
  ]),
  Gs = [
    { id: 'gt', label: 'brighter than', needsThreshold: !0 },
    { id: 'ge', label: 'at least', needsThreshold: !0 },
    { id: 'lt', label: 'darker than', needsThreshold: !0 },
    { id: 'le', label: 'at most', needsThreshold: !0 },
    { id: 'eq', label: 'equal to', needsThreshold: !0 },
    { id: 'isfinite', label: 'is finite', needsThreshold: !1 },
    { id: 'isnan', label: 'is NaN/Inf', needsThreshold: !1 },
  ];
function Fh(l, e) {
  if (!e) return !0;
  let t = e.threshold ?? 0;
  switch (e.op) {
    case 'gt':
      return l > t;
    case 'ge':
      return l >= t;
    case 'lt':
      return l < t;
    case 'le':
      return l <= t;
    case 'eq':
      return l === t;
    case 'isfinite':
      return Number.isFinite(l);
    case 'isnan':
      return !Number.isFinite(l);
    default:
      return !0;
  }
}
function Nh(l, e, t) {
  switch (t) {
    case 'add':
      return l + e;
    case 'subtract':
      return l - e;
    case 'difference':
    case 'raw-difference':
      return Math.abs(l - e);
    case 'raw-multiply':
      return l * e;
    case 'divide':
      return e === 0 ? NaN : l / e;
    case 'min':
      return Math.min(l, e);
    case 'max':
      return Math.max(l, e);
    case 'average':
      return (l + e) * 0.5;
    case 'normal':
    default:
      return e;
  }
}
function Bh(l, e, t, n = 1) {
  let i = Number.isFinite(n) && n > 0 ? n : 1;
  switch (t) {
    case 'multiply':
      return (l * e) / i;
    case 'screen':
      return i - ((i - l) * (i - e)) / i;
    case 'overlay':
      return l <= i * 0.5 ? (2 * l * e) / i : i - (2 * (i - l) * (i - e)) / i;
    case 'darken':
      return Math.min(l, e);
    case 'lighten':
      return Math.max(l, e);
    case 'difference':
      return Math.abs(l - e);
    case 'exclusion':
      return l + e - (2 * l * e) / i;
    case 'normal':
    default:
      return e;
  }
}
function jt(l, e, t) {
  return t <= 0 ? l : t >= 1 ? e : Number.isFinite(l) && Number.isFinite(e) ? l + (e - l) * t : NaN;
}
function _n(l, e, t, n, i) {
  return n <= 0 || t >= 1
    ? e
    : !Number.isFinite(l) || !Number.isFinite(e)
      ? NaN
      : (e * t + l * n * (1 - t)) / i;
}
function Nc(l, e, t, n, i, a, r) {
  if (i <= 0) return e;
  if (t === 'normal') return _n(l, e, n, i, a);
  if (!Number.isFinite(l) || !Number.isFinite(e)) return NaN;
  let s = Bh(l, e, t, r);
  return ((1 - n) * i * l + (1 - i) * n * e + i * n * s) / a;
}
function Di(l, e, t, n, i) {
  let a = e[t] > 0,
    r = i === 4 ? 3 : i;
  for (let s = 0; s < r; s++) l[n + s] = NaN;
  return ((e[t] = 1), i === 4 && (l[n + 3] = 1), a ? 0 : 1);
}
function $h(l) {
  return l.some(e => zs.has(e.blendMode ?? 'normal'))
    ? l.some(e => e.channels >= 3)
      ? 3
      : 1
    : l.some(e => e.channels === 2 || e.channels === 4)
      ? 4
      : l.some(e => e.channels >= 3)
        ? 3
        : 1;
}
function Uh(l, e, t, n, i, a = 1) {
  let r = (t * l.width + e) * l.channels,
    s = l.data;
  if (l.channels === 1) {
    let o = s[r] * a;
    for (let h = 0; h < n; h++) i[h] = h === 3 ? l.typeMax || 1 : o;
  } else if (l.channels === 2) {
    let o = s[r] * a;
    for (let h = 0; h < n; h++) i[h] = h === 3 ? s[r + 1] : o;
  } else
    for (let o = 0; o < n; o++) {
      let h = s[r + Math.min(o, l.channels - 1)];
      i[o] = o === 3 ? h : h * a;
    }
}
function Hh(l, e, t, n, i, a, r, s, o, h, u, d, m, p) {
  let v = l.data,
    g = l.channels,
    w = d >= 1,
    k = p / (l.typeMax || p);
  if (n === 4 && g <= 2) {
    for (let E = r; E < o; E++) {
      let L = E * i + a,
        M = L * 4,
        T = ((E - u) * l.width + (a - h)) * g;
      for (let _ = a; _ < s; _++, L++, M += 4, T += g) {
        let I = g === 2 ? Number(v[T + 1]) / (l.typeMax || p) : 1;
        if (!Number.isFinite(I)) {
          m += Di(e, t, L, M, 4);
          continue;
        }
        let A = Math.max(0, Math.min(1, I * d));
        if (A <= 0) continue;
        let N = Number(v[T]) * k,
          z = t[L],
          X = A + z * (1 - A);
        (z <= 0
          ? ((e[M] = e[M + 1] = e[M + 2] = N), m++)
          : ((e[M] = _n(e[M], N, A, z, X)),
            (e[M + 1] = _n(e[M + 1], N, A, z, X)),
            (e[M + 2] = _n(e[M + 2], N, A, z, X))),
          (t[L] = X),
          (e[M + 3] = X));
      }
    }
    return m;
  }
  if (n === 4 && g >= 3) {
    for (let E = r; E < o; E++) {
      let L = E * i + a,
        M = L * 4,
        T = ((E - u) * l.width + (a - h)) * g;
      for (let _ = a; _ < s; _++, L++, M += 4, T += g) {
        let I = g === 4 ? Number(v[T + 3]) / (l.typeMax || 255) : 1;
        if (!Number.isFinite(I)) {
          m += Di(e, t, L, M, 4);
          continue;
        }
        let A = Math.max(0, Math.min(1, I * d));
        if (A <= 0) continue;
        let N = t[L],
          z = A + N * (1 - A),
          X = v[T] * k,
          ae = v[T + 1] * k,
          Q = v[T + 2] * k;
        (N <= 0
          ? ((e[M] = X), (e[M + 1] = ae), (e[M + 2] = Q), m++)
          : ((e[M] = _n(e[M], X, A, N, z)),
            (e[M + 1] = _n(e[M + 1], ae, A, N, z)),
            (e[M + 2] = _n(e[M + 2], Q, A, N, z))),
          (t[L] = z),
          (e[M + 3] = z));
      }
    }
    return m;
  }
  if (n === 1 && g === 1) {
    for (let E = r; E < o; E++) {
      let L = E * i + a,
        M = (E - u) * l.width + (a - h);
      for (let T = a; T < s; T++, L++, M++) {
        let _ = v[M] * k;
        t[L] ? (e[L] = jt(e[L], _, d)) : ((e[L] = _), (t[L] = 1), m++);
      }
    }
    return m;
  }
  if (n === 3 && g === 1) {
    for (let E = r; E < o; E++) {
      let L = E * i + a,
        M = L * 3,
        T = (E - u) * l.width + (a - h);
      for (let _ = a; _ < s; _++, L++, M += 3, T++) {
        let I = v[T] * k;
        t[L]
          ? w
            ? ((e[M] = I), (e[M + 1] = I), (e[M + 2] = I))
            : ((e[M] = jt(e[M], I, d)),
              (e[M + 1] = jt(e[M + 1], I, d)),
              (e[M + 2] = jt(e[M + 2], I, d)))
          : ((e[M] = I), (e[M + 1] = I), (e[M + 2] = I), (t[L] = 1), m++);
      }
    }
    return m;
  }
  if (n === 3 && g === 4) {
    for (let E = r; E < o; E++) {
      let L = E * i + a,
        M = L * 3,
        T = ((E - u) * l.width + (a - h)) * 4;
      for (let _ = a; _ < s; _++, L++, M += 3, T += 4) {
        let I = Number(v[T + 3]) / (l.typeMax || 255);
        if (!Number.isFinite(I)) {
          m += Di(e, t, L, M, 3);
          continue;
        }
        let A = Math.max(0, Math.min(1, I * d));
        if (A <= 0) continue;
        let N = v[T] * k,
          z = v[T + 1] * k,
          X = v[T + 2] * k;
        t[L]
          ? ((e[M] = jt(e[M], N, A)),
            (e[M + 1] = jt(e[M + 1], z, A)),
            (e[M + 2] = jt(e[M + 2], X, A)))
          : ((e[M] = N), (e[M + 1] = z), (e[M + 2] = X), (t[L] = 1), m++);
      }
    }
    return m;
  }
  if (n === 3 && g >= 3)
    for (let E = r; E < o; E++) {
      let L = E * i + a,
        M = L * 3,
        T = ((E - u) * l.width + (a - h)) * g;
      for (let _ = a; _ < s; _++, L++, M += 3, T += g) {
        let I = v[T] * k,
          A = v[T + 1] * k,
          N = v[T + 2] * k;
        t[L]
          ? w
            ? ((e[M] = I), (e[M + 1] = A), (e[M + 2] = N))
            : ((e[M] = jt(e[M], I, d)),
              (e[M + 1] = jt(e[M + 1], A, d)),
              (e[M + 2] = jt(e[M + 2], N, d)))
          : ((e[M] = I), (e[M + 1] = A), (e[M + 2] = N), (t[L] = 1), m++);
      }
    }
  return m;
}
function zh(l, e, t, n, i, a, r) {
  let s = l.data,
    o = l.typeMax || r,
    h = r / o;
  for (let u = 0, d = 0; u < t.length; u++, d += 4) {
    let m = Math.max(0, Math.min(1, (Number(s[d + 3]) / o) * i));
    if (!Number.isFinite(m)) {
      a += Di(e, t, u, d, 4);
      continue;
    }
    if (m <= 0) continue;
    let p = t[u],
      v = m + p * (1 - m);
    if (p <= 0) ((e[d] = s[d] * h), (e[d + 1] = s[d + 1] * h), (e[d + 2] = s[d + 2] * h), a++);
    else
      for (let g = 0; g < 3; g++) {
        let w = Number(s[d + g]) * h,
          k = e[d + g];
        e[d + g] = Nc(k, w, n, m, p, v, r);
      }
    ((t[u] = v), (e[d + 3] = v));
  }
  return a;
}
function js(l, e, t) {
  let n = l.rasterMask;
  if (!n) return 1;
  let i = e - Math.round(n.offsetX ?? l.offsetX ?? 0),
    a = t - Math.round(n.offsetY ?? l.offsetY ?? 0);
  if (i < 0 || a < 0 || i >= n.width || a >= n.height) return n.invert ? 1 : 0;
  let r = Math.max(1, n.channels ?? 1),
    s = Number(n.data[(a * n.width + i) * r]),
    o = Number.isFinite(s) ? s / (n.typeMax || 255) : 0;
  return ((o = Math.max(0, Math.min(1, o))), n.invert ? 1 - o : o);
}
function Bc(l, e, t) {
  let n = e - Math.round(l.offsetX ?? 0),
    i = t - Math.round(l.offsetY ?? 0);
  if (n < 0 || i < 0 || n >= l.width || i >= l.height || !l.data) return 0;
  let a = (i * l.width + n) * l.channels,
    r = js(l, e, t) * Math.max(0, Math.min(1, l.opacity ?? 1));
  if (r <= 0) return 0;
  let s =
    l.channels === 2 || l.channels === 4
      ? Number(l.data[a + l.channels - 1]) / (l.typeMax || 255)
      : 1;
  return Number.isFinite(s) ? Math.max(0, Math.min(1, s * r)) : NaN;
}
function jh(l, e, t) {
  let n = new Float32Array(e * t),
    i = Math.max(0, Math.round(l.offsetX ?? 0)),
    a = Math.max(0, Math.round(l.offsetY ?? 0)),
    r = Math.min(e, Math.round(l.offsetX ?? 0) + l.width),
    s = Math.min(t, Math.round(l.offsetY ?? 0) + l.height);
  for (let o = a; o < s; o++) for (let h = i; h < r; h++) n[o * e + h] = Bc(l, h, o);
  return n;
}
var Ic = new WeakMap(),
  Za = { groupHits: 0, groupMisses: 0, clippingHits: 0, clippingMisses: 0 };
function $c(l, e, t, n, i = new Set()) {
  let a = l.filter(s => (s.parentId || void 0) === n),
    r = [];
  for (let s of a) {
    if (s.kind !== 'group') {
      (s.data || (s.kind === 'adjustment' && s.adjustment)) && r.push(s);
      continue;
    }
    let o = s.id || '';
    if (!o || i.has(o)) continue;
    let h = new Set(i);
    h.add(o);
    let u = $c(l, e, t, o, h),
      d = u.map(v => zc(v)),
      m = Ic.get(s),
      p;
    (m && m.width === e && m.height === t && jc(m.snapshots, d)
      ? (Za.groupHits++, (p = m.surface))
      : (Za.groupMisses++,
        (p = Gc(u, e, t)),
        Ic.set(s, { snapshots: d, width: e, height: t, surface: p })),
      r.push({
        ...s,
        kind: 'raster',
        parentId: void 0,
        data: p.data,
        width: e,
        height: t,
        channels: p.channels,
        isFloat: p.isFloat,
        typeMax: p.typeMax,
        offsetX: s.offsetX ?? 0,
        offsetY: s.offsetY ?? 0,
      }));
  }
  return r;
}
function Pn(l, e) {
  let t = l
    .filter(n => Number.isFinite(n.input) && Number.isFinite(n.output))
    .sort((n, i) => n.input - i.input)
    .filter((n, i, a) => i === 0 || n.input !== a[i - 1].input);
  if (!t.length) return e;
  if (e <= t[0].input) return t[0].output;
  for (let n = 1; n < t.length; n++)
    if (e <= t[n].input) {
      let i = t[n - 1],
        a = t[n],
        r = a.input - i.input;
      if (!r) return a.output;
      let s = t[Math.max(0, n - 2)],
        o = t[Math.min(t.length - 1, n + 1)],
        h = (k, E) => (E.output - k.output) / Math.max(1e-6, E.input - k.input),
        u = h(i, a),
        d = n === 1 ? u : (h(s, i) + u) / 2,
        m = n === t.length - 1 ? u : (u + h(a, o)) / 2;
      ((!u || d * u < 0) && (d = 0), (!u || m * u < 0) && (m = 0));
      let p = (e - i.input) / r,
        v = p * p,
        g = v * p,
        w =
          (2 * g - 3 * v + 1) * i.output +
          (g - 2 * v + p) * r * d +
          (-2 * g + 3 * v) * a.output +
          (g - v) * r * m;
      return Math.max(Math.min(i.output, a.output), Math.min(Math.max(i.output, a.output), w));
    }
  return t[t.length - 1].output;
}
function Ac(l, e, t) {
  if (!e) return l;
  if (Array.isArray(e)) return (Pn(e, (l * 255) / t) * t) / 255;
  let n = (l * 255) / t,
    i = e.shadowInput ?? 0,
    a = e.highlightInput ?? 255,
    r = Math.max(0.01, e.midtoneInput ?? 1),
    s = Math.max(0, Math.min(1, (n - i) / Math.max(1e-6, a - i))),
    o = e.shadowOutput ?? 0,
    h = e.highlightOutput ?? 255;
  return ((o + Math.pow(s, 1 / r) * (h - o)) * t) / 255;
}
function Ja(l, e, t) {
  let n = Math.max(l, e, t),
    i = Math.min(l, e, t),
    a = n - i,
    r = 0,
    s = (n + i) / 2;
  a && (r = 60 * (n === l ? ((e - t) / a) % 6 : n === e ? (t - l) / a + 2 : (l - e) / a + 4));
  let o = a ? a / (1 - Math.abs(2 * s - 1)) : 0;
  return [(r + 360) % 360, o, s];
}
function Uc(l, e, t) {
  let n = (1 - Math.abs(2 * t - 1)) * e,
    i = n * (1 - Math.abs(((l / 60) % 2) - 1)),
    a = t - n / 2,
    [r, s, o] =
      l < 60
        ? [n, i, 0]
        : l < 120
          ? [i, n, 0]
          : l < 180
            ? [0, n, i]
            : l < 240
              ? [0, i, n]
              : l < 300
                ? [i, 0, n]
                : [n, 0, i];
  return [r + a, s + a, o + a];
}
function Hc(l, e) {
  let t = Math.abs(((l - e + 540) % 360) - 180);
  return t <= 30 ? 1 : t >= 60 ? 0 : (60 - t) / 30;
}
function Gh(l, e, t) {
  if (!e || !['a', 'b', 'c', 'd'].every(o => Number.isFinite(e[o]))) return Hc(l, t);
  let n = e.a,
    i = e.b,
    a = e.c,
    r = e.d;
  for (; i < n;) i += 360;
  for (; a < i;) a += 360;
  for (; r < a;) r += 360;
  let s = 0;
  for (let o = l - 360; o <= l + 720; o += 360)
    o < n ||
      o > r ||
      (s = Math.max(
        s,
        o < i ? (o - n) / Math.max(1e-6, i - n) : o <= a ? 1 : (r - o) / Math.max(1e-6, r - a)
      ));
  return Math.max(0, Math.min(1, s));
}
var Dc = new WeakMap();
function Wh(l, e) {
  let t = Dc.get(l);
  t || ((t = new Map()), Dc.set(l, t));
  let n = t.get(e);
  if (n) return n;
  let i;
  return (
    l.type === 'levels' || l.type === 'curves'
      ? (i = {
          kind: 'lut',
          tables: ['red', 'green', 'blue'].map(s => {
            let o = new Float32Array(256);
            for (let h = 0; h < 256; h++) {
              let u = (h * e) / 255;
              o[h] = Ac(Ac(u, l.rgb, e), l[s], e);
            }
            return o;
          }),
        })
      : l.type === 'hue/saturation'
        ? (i = { kind: 'hue', value: l })
        : (i = { kind: 'direct', value: l }),
    t.set(e, i),
    i
  );
}
function Oh(l, e, t) {
  let n = Math.max(0, Math.min(255, (e * 255) / t)),
    i = Math.floor(n),
    a = Math.min(255, i + 1),
    r = n - i;
  return l[i] + (l[a] - l[i]) * r;
}
function Gt(l) {
  return Math.max(0, Math.min(1, l));
}
function Vh(l, e, t = !1) {
  let n = [
      { position: 0, color: { r: 0, g: 0, b: 0 } },
      { position: 1, color: { r: 255, g: 255, b: 255 } },
    ],
    i = (l?.length ? l : n)
      .map(s => ({ ...s, position: Gt(s.position) }))
      .sort((s, o) => s.position - o.position),
    a = t ? 1 - e : e;
  if (a <= i[0].position) {
    let s = i[0].color;
    return [s.r / 255, s.g / 255, s.b / 255];
  }
  for (let s = 1; s < i.length; s++)
    if (a <= i[s].position) {
      let o = i[s - 1],
        h = i[s],
        u = (a - o.position) / Math.max(1e-6, h.position - o.position);
      return [
        o.color.r + (h.color.r - o.color.r) * u,
        o.color.g + (h.color.g - o.color.g) * u,
        o.color.b + (h.color.b - o.color.b) * u,
      ].map(d => d / 255);
    }
  let r = i[i.length - 1].color;
  return [r.r / 255, r.g / 255, r.b / 255];
}
function Xh(l, e, t, n) {
  let i = e,
    a = t,
    r = n,
    s = () => 0.2126 * i + 0.7152 * a + 0.0722 * r;
  if (l.type === 'brightness/contrast') {
    let o = (l.brightness || 0) / 100,
      h = Math.max(-0.99, Math.min(0.99, (l.contrast || 0) / 100)),
      u = (1 + h) / (1 - h);
    ((i = (i - 0.5) * u + 0.5 + o), (a = (a - 0.5) * u + 0.5 + o), (r = (r - 0.5) * u + 0.5 + o));
  } else if (l.type === 'exposure') {
    let o = Math.pow(2, l.exposure || 0),
      h = l.offset || 0,
      u = Math.max(0.01, l.gamma ?? 1);
    ((i = Math.pow(Math.max(0, i * o + h), 1 / u)),
      (a = Math.pow(Math.max(0, a * o + h), 1 / u)),
      (r = Math.pow(Math.max(0, r * o + h), 1 / u)));
  } else if (l.type === 'invert') ((i = 1 - i), (a = 1 - a), (r = 1 - r));
  else if (l.type === 'channel mixer') {
    let o = (h, u) => {
      let d = h || u;
      return (
        (i * (d.red ?? 0)) / 100 +
        (a * (d.green ?? 0)) / 100 +
        (r * (d.blue ?? 0)) / 100 +
        (d.constant ?? 0) / 100
      );
    };
    l.monochrome
      ? (i = a = r = o(l.gray, { red: 40, green: 40, blue: 20 }))
      : ([i, a, r] = [
          o(l.red, { red: 100 }),
          o(l.green, { green: 100 }),
          o(l.blue, { blue: 100 }),
        ]);
  } else if (l.type === 'color balance') {
    let o = Ja(i, a, r)[2],
      h = s(),
      u = [
        { value: l.shadows, weight: Gt((0.5 - h) * 2) },
        { value: l.midtones, weight: 1 - Math.abs(h - 0.5) * 2 },
        { value: l.highlights, weight: Gt((h - 0.5) * 2) },
      ];
    for (let { value: d, weight: m } of u)
      d &&
        m > 0 &&
        ((i += ((d.cyanRed || 0) / 100) * m),
        (a += ((d.magentaGreen || 0) / 100) * m),
        (r += ((d.yellowBlue || 0) / 100) * m));
    if (l.preserveLuminosity) {
      let [d, m] = Ja(Gt(i), Gt(a), Gt(r));
      [i, a, r] = Uc(d, m, o);
    }
  } else if (l.type === 'black & white') {
    let [o, h] = Ja(i, a, r),
      u = [0, 60, 120, 180, 240, 300],
      d = [
        l.reds ?? 40,
        l.yellows ?? 60,
        l.greens ?? 40,
        l.cyans ?? 60,
        l.blues ?? 20,
        l.magentas ?? 80,
      ],
      m = 0,
      p = 0;
    for (let g = 0; g < u.length; g++) {
      let w = Hc(o, u[g]);
      ((m += d[g] * w), (p += w));
    }
    i = a = r = s() + (((p ? m / p : 50) - 50) / 100) * h * 0.5;
  } else if (l.type === 'threshold') i = a = r = s() * 255 >= (l.level ?? 128) ? 1 : 0;
  else if (l.type === 'posterize') {
    let o = Math.max(2, Math.min(255, Math.round(l.levels ?? 4))),
      h = u => Math.round(u * (o - 1)) / (o - 1);
    ((i = h(i)), (a = h(a)), (r = h(r)));
  } else l.type === 'gradient map' && ([i, a, r] = Vh(l.stops, Gt(s()), l.reverse));
  return [Gt(i), Gt(a), Gt(r)];
}
function Yh(l, e, t, n, i, a) {
  let r = t === 4 ? 3 : t;
  if (n.kind === 'lut') {
    for (let s = 0; s < r; s++) {
      let o = l[e + s],
        h = Oh(n.tables[Math.min(s, 2)], o, i);
      l[e + s] = o + (h - o) * a;
    }
    return;
  }
  if (n.kind === 'direct') {
    if (r >= 3) {
      let s = l[e],
        o = l[e + 1],
        h = l[e + 2],
        u = Xh(n.value, s / i, o / i, h / i);
      ((l[e] = s + (u[0] * i - s) * a),
        (l[e + 1] = o + (u[1] * i - o) * a),
        (l[e + 2] = h + (u[2] * i - h) * a));
    }
    return;
  }
  if (r >= 3) {
    let s = n.value,
      o = l[e],
      h = l[e + 1],
      u = l[e + 2],
      [d, m, p] = Ja(o / i, h / i, u / i);
    if (s.colorize && s.colorizeEnabled !== !1) {
      ((d = (s.colorize.hue + 360) % 360),
        (m = Math.max(0, Math.min(1, s.colorize.saturation / 100))));
      let E = Math.max(-1, Math.min(1, s.colorize.lightness / 100));
      p = E < 0 ? p * (1 + E) : p + (1 - p) * E;
    } else {
      let E = d,
        L = (T, _) => {
          !T ||
            _ <= 0 ||
            ((d = (d + (T.hue || 0) * _ + 360) % 360),
            (m = Math.max(0, Math.min(1, m + ((T.saturation || 0) / 100) * _))),
            (p = Math.max(0, Math.min(1, p + ((T.lightness || 0) / 100) * _))));
        };
      L(s.master, 1);
      let M = [
        ['reds', 0],
        ['yellows', 60],
        ['greens', 120],
        ['cyans', 180],
        ['blues', 240],
        ['magentas', 300],
      ];
      for (let [T, _] of M) {
        let I = s[T];
        L(I, Gh(E, I, _));
      }
    }
    let v = Uc(d, m, p),
      g = v[0] * i,
      w = v[1] * i,
      k = v[2] * i;
    ((l[e] = o + (g - o) * a), (l[e + 1] = h + (w - h) * a), (l[e + 2] = u + (k - u) * a));
  }
}
var Fc = new WeakMap();
function zc(l, e = !1) {
  return {
    id: l.id,
    data: l.data,
    adjustment: l.adjustment,
    visible: e ? !0 : l.visible,
    opacity: e ? 1 : l.opacity,
    blendMode: e ? 'normal' : l.blendMode,
    offsetX: l.offsetX,
    offsetY: l.offsetY,
    clipped: e ? !1 : l.clipped,
    width: l.width,
    height: l.height,
    channels: l.channels,
    isFloat: l.isFloat,
    typeMax: l.typeMax,
    maskCondition: l.maskCondition,
    mask: l.rasterMask,
    maskData: l.rasterMask?.data,
  };
}
function jc(l, e) {
  if (l.length !== e.length) return !1;
  for (let t = 0; t < l.length; t++) {
    let n = l[t],
      i = e[t];
    if (
      n.id !== i.id ||
      n.data !== i.data ||
      n.adjustment !== i.adjustment ||
      n.visible !== i.visible ||
      n.opacity !== i.opacity ||
      n.blendMode !== i.blendMode ||
      n.offsetX !== i.offsetX ||
      n.offsetY !== i.offsetY ||
      n.clipped !== i.clipped ||
      n.width !== i.width ||
      n.height !== i.height ||
      n.channels !== i.channels ||
      n.isFloat !== i.isFloat ||
      n.typeMax !== i.typeMax ||
      n.maskCondition !== i.maskCondition ||
      n.mask !== i.mask ||
      n.maskData !== i.maskData
    )
      return !1;
  }
  return !0;
}
function qh(l, e, t) {
  let n = [];
  for (let i = 0; i < l.length;) {
    let a = l[i];
    if (a.clipped || !a.data) {
      (n.push(a), i++);
      continue;
    }
    let r = i + 1;
    for (; r < l.length && l[r].clipped;) r++;
    if (r === i + 1) {
      (n.push(a), i++);
      continue;
    }
    let s = l.slice(i, r),
      o = s.map((d, m) => zc(d, m === 0)),
      h = Fc.get(a),
      u;
    if (h && h.width === e && h.height === t && jc(h.snapshots, o))
      (Za.clippingHits++, (u = h.surface));
    else {
      Za.clippingMisses++;
      let d = { ...a, visible: !0, opacity: 1, blendMode: 'normal', clipped: !1 };
      ((u = Wc([d, ...s.slice(1)], e, t)),
        Fc.set(a, { snapshots: o, width: e, height: t, surface: u }));
    }
    (n.push({
      ...a,
      data: u.data,
      width: e,
      height: t,
      channels: u.channels,
      isFloat: u.isFloat,
      typeMax: u.typeMax,
      offsetX: 0,
      offsetY: 0,
      rasterMask: void 0,
      clipped: !1,
    }),
      (i = r));
  }
  return n;
}
function Gc(l, e, t) {
  return Wc(qh(l, e, t), e, t);
}
function Wc(l, e, t) {
  let n = l.filter(
      k =>
        k &&
        k.visible !== !1 &&
        (k.opacity ?? 1) > 0 &&
        (k.data || (k.kind === 'adjustment' && k.adjustment))
    ),
    i = n.length ? $h(n) : 1,
    a = n.find(k => k.data)?.typeMax ?? 1,
    r = e * t,
    s = new Float32Array(r * i);
  i !== 4 && s.fill(NaN);
  let o = new Float32Array(r),
    h = new Float32Array(i),
    u = 0,
    d = null;
  for (let k = 0; k < n.length; k++) {
    let E = n[k],
      L = Math.round(E.offsetX ?? 0),
      M = Math.round(E.offsetY ?? 0),
      T = Math.max(0, Math.min(1, E.opacity ?? 1)),
      _ = Ah.has(E.blendMode ?? 'normal') ? (E.blendMode ?? 'normal') : 'normal',
      I = zs.has(_),
      A = Dh.has(_),
      N = _ === 'mask',
      z = Math.max(0, L),
      X = Math.max(0, M),
      ae = Math.min(e, L + E.width),
      Q = Math.min(t, M + E.height),
      j = E.clipped ? d : null;
    if (!(E.clipped && !j)) {
      if (E.kind === 'adjustment' && E.adjustment) {
        let q = a,
          oe = Wh(E.adjustment, q);
        for (let U = 0; U < t; U++)
          for (let Z = 0; Z < e; Z++) {
            let G = U * e + Z;
            if (!o[G]) continue;
            let re = j ? (j[G] > 0 ? 1 : 0) : 1,
              ee = T * js(E, Z, U) * re;
            ee > 0 && Yh(s, G * i, i, oe, q, ee);
          }
        continue;
      }
      if (_ === 'normal' && !E.rasterMask && !E.clipped)
        u = Hh(E, s, o, i, e, z, X, ae, Q, L, M, T, u, a);
      else if (
        A &&
        i === 4 &&
        E.channels === 4 &&
        !E.rasterMask &&
        !E.clipped &&
        L === 0 &&
        M === 0 &&
        E.width === e &&
        E.height === t
      )
        u = zh(E, s, o, _, T, u, a);
      else
        for (let q = X; q < Q; q++) {
          let oe = q - M;
          for (let U = z; U < ae; U++) {
            let Z = U - L,
              G = q * e + U,
              re = G * i,
              ee = !I && !N ? a / (E.typeMax || a) : 1;
            if ((Uh(E, Z, oe, i, h, ee), N)) {
              let Ce = E.channels >= 3 ? 0.2126 * h[0] + 0.7152 * h[1] + 0.0722 * h[2] : h[0];
              if (o[G] && !Fh(Ce, E.maskCondition)) {
                for (let de = 0; de < i; de++) s[re + de] = i === 4 ? 0 : NaN;
                ((o[G] = 0), u--);
              }
              continue;
            }
            let ye = js(E, U, q),
              ve = j ? j[G] : 1;
            if (I) {
              let Ce = T * ye * ve;
              if (Ce <= 0) continue;
              if (!o[G]) {
                for (let de = 0; de < i; de++) s[re + de] = h[de];
                ((o[G] = 1), u++);
                continue;
              }
              for (let de = 0; de < i; de++) {
                let ce = s[re + de],
                  ue = Nh(ce, h[de], _);
                s[re + de] =
                  Ce >= 1
                    ? ue
                    : Number.isFinite(ue) && Number.isFinite(ce)
                      ? ce + (ue - ce) * Ce
                      : NaN;
              }
              continue;
            }
            if (!A) continue;
            let Ae = Bc(E, U, q);
            if (Ae <= 0 || ve <= 0) continue;
            if (!Number.isFinite(Ae) || !Number.isFinite(ve)) {
              u += Di(s, o, G, re, i);
              continue;
            }
            let _e = Ae * ve;
            if (_e <= 0) continue;
            let le = o[G],
              Le = _e + le * (1 - _e),
              me = i === 4 ? 3 : i;
            for (let Ce = 0; Ce < me; Ce++) {
              let de = h[Ce],
                ce = s[re + Ce];
              s[re + Ce] = Nc(ce, de, _, _e, le, Le, a);
            }
            (le || u++, (o[G] = Le), i === 4 && (s[re + 3] = Le));
          }
        }
      E.clipped || (d = n[k + 1]?.clipped ? jh(E, e, t) : null);
    }
  }
  let m = n.some(k => k.isFloat) || n.some(k => zs.has(k.blendMode ?? 'normal')),
    p = a;
  if (i === 4) for (let k = 0; k < r; k++) s[k * 4 + 3] *= p;
  let v = 1 / 0,
    g = -1 / 0,
    w = i === 4 ? 3 : i;
  for (let k = 0; k < r; k++)
    if (o[k])
      for (let E = 0; E < w; E++) {
        let L = s[k * i + E];
        Number.isFinite(L) && ((v = Math.min(v, L)), (g = Math.max(g, L)));
      }
  return (
    v === 1 / 0 && ((v = 0), (g = 0)),
    {
      data: s,
      width: e,
      height: t,
      channels: i,
      isFloat: m,
      typeMax: p,
      stats: { min: v, max: g },
      coveredCount: u,
    }
  );
}
function Jn(l, e, t) {
  return Gc($c(l, e, t), e, t);
}
function In(l, e, t, n) {
  let i = Math.max(0, Math.min(e, Math.floor(n.x))),
    a = Math.max(0, Math.min(t, Math.floor(n.y))),
    r = Math.max(0, Math.min(e - i, Math.ceil(n.width))),
    s = Math.max(0, Math.min(t - a, Math.ceil(n.height)));
  if (!r || !s) return Jn([], Math.max(1, r), Math.max(1, s));
  let o = new Map(l.filter(d => d.kind === 'group' && d.id).map(d => [d.id, d])),
    h = d => {
      let m = d.parentId,
        p = 0,
        v = 0,
        g = new Set();
      for (; m && !g.has(m);) {
        g.add(m);
        let w = o.get(m);
        if (!w) break;
        ((p += w.offsetX || 0), (v += w.offsetY || 0), (m = w.parentId));
      }
      return { x: p, y: v };
    },
    u = l.map(d => {
      let m = h(d),
        p = d.kind === 'group' ? 0 : (d.offsetX || 0) + m.x - i,
        v = d.kind === 'group' ? 0 : (d.offsetY || 0) + m.y - a;
      return {
        ...d,
        offsetX: p,
        offsetY: v,
        rasterMask: d.rasterMask
          ? {
              ...d.rasterMask,
              offsetX: (d.rasterMask.offsetX ?? d.offsetX ?? 0) + m.x - i,
              offsetY: (d.rasterMask.offsetY ?? d.offsetY ?? 0) + m.y - a,
            }
          : void 0,
      };
    });
  return Jn(u, r, s);
}
function Oc(l, e, t, n) {
  return { offsetX: Math.round((t - l) / 2), offsetY: Math.round((n - e) / 2) };
}
var Qa = new Map([
    ['normal', 0],
    ['multiply', 1],
    ['screen', 2],
    ['overlay', 3],
    ['darken', 4],
    ['lighten', 5],
    ['difference', 6],
    ['exclusion', 7],
    ['add', 8],
    ['subtract', 9],
    ['raw-difference', 10],
    ['raw-multiply', 11],
    ['divide', 12],
    ['min', 13],
    ['max', 14],
    ['average', 15],
    ['mask', 16],
  ]),
  er = class {
    constructor() {
      this.canvas = null;
      this.gl = null;
      this.blendProgram = null;
      this.adjustmentProgram = null;
      this.displayProgram = null;
      this.reductionProgram = null;
      this.vao = null;
      this.outputTextures = null;
      this.framebuffers = null;
      this.surfaceCache = new Map();
      this.isolatedStackCache = new WeakMap();
      this.cachedFramebuffers = new Set();
      this.objectIds = new WeakMap();
      this.nextObjectId = 1;
      this.outputWidth = 0;
      this.outputHeight = 0;
      this.outputUsesFloat = !1;
      this.compositionTypeMax = 1;
      this.textureCache = new Map();
      this.adjustmentLutCache = new Map();
      this.ownedTextures = new Set();
      this.dummyFloat = null;
      this.dummyUint = null;
      this.dummyInt = null;
      this.colormapTexture = null;
      this.colormapName = 'none';
      this.reductionTextures = [];
      this.reductionFramebuffers = [];
      this.reductionSize = '';
      this.failed = !1;
      this.logger = e => console.warn(e);
    }
    canRender(e, t, n, i) {
      return this.unsupportedReason(e, t, n, i) === null;
    }
    isAvailable() {
      if (this.failed) return !1;
      try {
        return this.ensureContext(1, 1);
      } catch {
        return !1;
      }
    }
    setLogger(e) {
      this.logger = e;
    }
    retry() {
      this.failed = !1;
    }
    unsupportedReason(e, t, n, i) {
      if (t.gpuAcceleration === !1) return 'GPU acceleration is disabled in the image settings';
      if (n <= 0 || i <= 0) return `the document size ${n}\xD7${i} is invalid`;
      if (typeof WebGL2RenderingContext > 'u') return 'WebGL2 is unavailable in this webview';
      for (let a of e) {
        let r = a.name || String(a.id || 'unnamed layer');
        if (a.rasterMask && !this.isSupportedPixels(a.rasterMask.data))
          return `"${r}" has an unsupported ${a.rasterMask.data.constructor?.name || 'mask'} storage`;
        if (a.kind === 'group') {
          if (!a.id) return `"${r}" is a group without an id`;
          if (!Qa.has(a.blendMode || 'normal'))
            return `"${r}" uses unsupported blend mode "${a.blendMode}"`;
          continue;
        }
        if (a.kind === 'adjustment') {
          if (!a.adjustment) return `"${r}" has no adjustment parameters`;
          if (!this.isSupportedAdjustment(a.adjustment))
            return `"${r}" uses unsupported ${a.adjustment.type} parameters`;
          continue;
        }
        if (!(a.visible === !1 || (a.opacity ?? 1) <= 0)) {
          if (!a.data) return `"${r}" has no raster pixels`;
          if (!Qa.has(a.blendMode || 'normal'))
            return `"${r}" uses unsupported blend mode "${a.blendMode}"`;
          if (a.channels < 1 || a.channels > 4)
            return `"${r}" has unsupported ${a.channels}-channel pixels`;
          if (!this.isSupportedPixels(a.data))
            return `"${r}" uses unsupported ${a.data.constructor?.name || 'pixel'} storage`;
        }
      }
      return null;
    }
    render(e, t, n, i, a, r, s = !1) {
      let o = this.unsupportedReason(e, a, t, n);
      if (o) {
        let h = new Error(`WebGL2 compositor cannot render this document: ${o}`);
        if (s) throw h;
        return null;
      }
      try {
        let h = Math.max(1, Math.round(t * i)),
          u = Math.max(1, Math.round(n * i));
        if (!this.ensureContext(h, u))
          throw new Error('WebGL2 or EXT_color_buffer_float is unavailable');
        let d = this.gl;
        for (; d.getError() !== d.NO_ERROR;);
        let m = d.getParameter(d.MAX_TEXTURE_SIZE);
        if (h > m || u > m)
          throw new Error(`document surface ${h}\xD7${u} exceeds MAX_TEXTURE_SIZE ${m}`);
        let p = this.foldGroupOffsets(e);
        (this.pruneTextureCache(
          new Set(
            p.flatMap(M => [
              ...(M.data && this.isSupportedPixels(M.data) ? [M.data] : []),
              ...(M.rasterMask?.data && this.isSupportedPixels(M.rasterMask.data)
                ? [M.rasterMask.data]
                : []),
            ])
          )
        ),
          this.pruneAdjustmentLutCache(
            new Set(p.flatMap(M => (M.adjustment ? [M.adjustment] : [])))
          ));
        for (let M of p)
          if (!(M.visible === !1 || (M.opacity ?? 1) <= 0 || !M.data)) {
            if (M.width > m || M.height > m)
              throw new Error(`layer "${M.name || M.id}" exceeds MAX_TEXTURE_SIZE ${m}`);
            (this.textureFor(M.data, M.width, M.height, M.channels),
              M.rasterMask &&
                this.isSupportedPixels(M.rasterMask.data) &&
                this.textureFor(
                  M.rasterMask.data,
                  M.rasterMask.width,
                  M.rasterMask.height,
                  Math.max(1, M.rasterMask.channels ?? 1)
                ));
          }
        let v =
            p.some(M =>
              [
                'add',
                'subtract',
                'raw-difference',
                'raw-multiply',
                'divide',
                'min',
                'max',
                'average',
              ].includes(M.blendMode || '')
            ) ||
            p.some(
              M =>
                M.data &&
                (!(M.data instanceof Uint8Array || M.data instanceof Uint8ClampedArray) ||
                  (M.typeMax || 255) !== 255)
            ),
          g = new Map(p.filter(M => M.kind === 'group' && M.id).map(M => [M.id, M])),
          w = 0;
        for (let M of p) {
          let T = 0,
            _ = M.parentId,
            I = new Set();
          for (; _ && !I.has(_);) {
            I.add(_);
            let A = g.get(_);
            if (!A) break;
            (T++, (_ = A.parentId));
          }
          w = Math.max(w, T);
        }
        let k = (w + 1) * 2 + 3;
        (this.ensureOutputSurfaces(h, u, v, k),
          (this.compositionTypeMax =
            p.find(M => M.visible !== !1 && (M.opacity ?? 1) > 0 && M.data)?.typeMax || 1));
        let E = this.drawStack(p, void 0, i, 0, new Set());
        (this.drawDisplay(E, a, e, r), d.finish());
        let L = d.getError();
        if (L !== d.NO_ERROR || d.isContextLost())
          throw new Error(`GPU composition did not complete (${L})`);
        return (i === 1 && this.validateNativeSamples(e, t, n, E), this.canvas);
      } catch (h) {
        let u = h instanceof Error ? h.message : String(h);
        if (
          (this.logger(`[LayerCompositor] WebGL2 failed: ${u}`),
          this.dispose(),
          (this.failed = !1),
          s)
        )
          throw h;
        return null;
      }
    }
    foldGroupOffsets(e) {
      let t = new Map(e.filter(i => i.kind === 'group' && i.id).map(i => [i.id, i])),
        n = i => {
          let a = i.parentId,
            r = 0,
            s = 0,
            o = new Set();
          for (; a && !o.has(a);) {
            o.add(a);
            let h = t.get(a);
            if (!h) break;
            ((r += h.offsetX || 0), (s += h.offsetY || 0), (a = h.parentId));
          }
          return { x: r, y: s };
        };
      return e.map(i => {
        let a = n(i);
        return i.kind === 'group'
          ? {
              ...i,
              offsetX: 0,
              offsetY: 0,
              rasterMask: i.rasterMask
                ? {
                    ...i.rasterMask,
                    offsetX: (i.rasterMask.offsetX ?? i.offsetX ?? 0) + a.x,
                    offsetY: (i.rasterMask.offsetY ?? i.offsetY ?? 0) + a.y,
                  }
                : void 0,
            }
          : !a.x && !a.y
            ? i
            : {
                ...i,
                offsetX: (i.offsetX || 0) + a.x,
                offsetY: (i.offsetY || 0) + a.y,
                rasterMask: i.rasterMask
                  ? {
                      ...i.rasterMask,
                      offsetX: (i.rasterMask.offsetX ?? i.offsetX ?? 0) + a.x,
                      offsetY: (i.rasterMask.offsetY ?? i.offsetY ?? 0) + a.y,
                    }
                  : void 0,
              };
      });
    }
    drawStack(e, t, n, i, a) {
      let r = i * 2,
        s = r + 1;
      this.clearSurface(r);
      let o = r,
        h = e.filter(u => (u.parentId || void 0) === t);
      for (let u = 0; u < h.length;) {
        let d = h[u],
          m = u + 1;
        for (; m < h.length && h[m].clipped;) m++;
        let p = h.slice(u + 1, m);
        if (d.visible === !1 || (d.opacity ?? 1) <= 0) {
          u = m;
          continue;
        }
        if (d.kind === 'group') {
          let v = d.id || '';
          if (!v || a.has(v)) {
            u = m;
            continue;
          }
          let g = new Set(a);
          g.add(v);
          let w = this.drawStack(e, v, n, i + 1, g);
          o = this.drawIsolatedSurfaceStack(d, p, w, n, o);
        } else if (d.data)
          if (p.length) o = this.drawIsolatedStack(d, p, n, o);
          else {
            let v = o === r ? s : r;
            (this.drawLayer(d, n, o, v), (o = v));
          }
        else if (d.kind === 'adjustment' && d.adjustment) {
          let v = o === r ? s : r;
          (this.drawAdjustment(d, o, v, n), (o = v));
        }
        u = m;
      }
      return o;
    }
    drawIsolatedSurfaceStack(e, t, n, i, a) {
      let r = this.outputTextures.length - 3,
        s = r + 1,
        o = s + 1,
        h = r,
        u = h + 1;
      (this.clearSurface(h),
        this.drawSurfaceLayer(this.outputTextures[n], h, u, 1, 'normal'),
        (h = u),
        this.drawSurfaceLayer(this.outputTextures[h], r, o, 1, 'normal'));
      for (let p of t)
        if (!(p.visible === !1 || (p.opacity ?? 1) <= 0)) {
          if (((u = h === r ? s : r), p.kind === 'adjustment' && p.adjustment))
            this.drawAdjustment(p, h, u, i);
          else if (p.data) this.drawLayer(p, i, h, u, {}, this.outputTextures[o]);
          else continue;
          h = u;
        }
      let d = Math.max(0, Math.min(1, e.opacity ?? 1));
      (d < 1 || e.rasterMask) &&
        ((u = h === r ? s : r),
        this.clearSurface(o),
        this.drawSurfaceLayer(this.outputTextures[h], o, u, d, 'normal', 0, 0, e, i),
        (h = u));
      let m = a % 2 === 0 ? a + 1 : a - 1;
      return (
        this.drawSurfaceLayer(
          this.outputTextures[h],
          a,
          m,
          1,
          e.blendMode || 'normal',
          Math.round((e.offsetX || 0) * i),
          Math.round((e.offsetY || 0) * i)
        ),
        m
      );
    }
    dispose() {
      let e = this.gl;
      if (e) {
        for (let t of this.ownedTextures) e.deleteTexture(t);
        for (let t of this.surfaceCache.values())
          for (let n of t.framebuffers) e.deleteFramebuffer(n);
        for (let t of this.cachedFramebuffers) e.deleteFramebuffer(t);
        (this.blendProgram && e.deleteProgram(this.blendProgram),
          this.adjustmentProgram && e.deleteProgram(this.adjustmentProgram),
          this.displayProgram && e.deleteProgram(this.displayProgram),
          this.reductionProgram && e.deleteProgram(this.reductionProgram),
          this.vao && e.deleteVertexArray(this.vao));
      }
      ((this.canvas = null),
        (this.gl = null),
        (this.blendProgram = null),
        (this.adjustmentProgram = null),
        (this.displayProgram = null),
        (this.reductionProgram = null),
        (this.vao = null),
        (this.outputTextures = null),
        (this.framebuffers = null),
        this.surfaceCache.clear(),
        (this.isolatedStackCache = new WeakMap()),
        this.cachedFramebuffers.clear(),
        (this.objectIds = new WeakMap()),
        (this.nextObjectId = 1),
        (this.outputWidth = 0),
        (this.outputHeight = 0),
        (this.outputUsesFloat = !1),
        (this.compositionTypeMax = 1),
        this.textureCache.clear(),
        this.adjustmentLutCache.clear(),
        this.ownedTextures.clear(),
        (this.dummyFloat = null),
        (this.dummyUint = null),
        (this.dummyInt = null),
        (this.colormapTexture = null),
        (this.colormapName = 'none'),
        (this.reductionTextures = []),
        (this.reductionFramebuffers = []),
        (this.reductionSize = ''));
    }
    isSupportedPixels(e) {
      return (
        e instanceof Uint8Array ||
        e instanceof Uint8ClampedArray ||
        e instanceof Uint16Array ||
        e instanceof Uint32Array ||
        e instanceof Int8Array ||
        e instanceof Int16Array ||
        e instanceof Int32Array ||
        e instanceof Float32Array ||
        e instanceof Float64Array
      );
    }
    isSupportedAdjustment(e) {
      return !!e;
    }
    ensureContext(e, t) {
      if (
        this.gl &&
        this.canvas &&
        this.blendProgram &&
        this.adjustmentProgram &&
        this.displayProgram &&
        this.reductionProgram &&
        this.vao
      )
        return (
          this.canvas.width !== e && (this.canvas.width = e),
          this.canvas.height !== t && (this.canvas.height = t),
          !0
        );
      let n = document.createElement('canvas');
      ((n.width = e), (n.height = t));
      let i = n.getContext('webgl2', {
        alpha: !0,
        antialias: !1,
        depth: !1,
        stencil: !1,
        preserveDrawingBuffer: !0,
        premultipliedAlpha: !1,
      });
      if (!i || !i.getExtension('EXT_color_buffer_float')) return ((this.failed = !0), !1);
      let a = this.createProgram(i, Jh),
        r = this.createProgram(i, Zh),
        s = this.createProgram(i, Qh),
        o = this.createProgram(i, em),
        h = i.createVertexArray(),
        u = i.createBuffer();
      if (!a || !r || !s || !o || !h || !u) return ((this.failed = !0), !1);
      (i.bindVertexArray(h),
        i.bindBuffer(i.ARRAY_BUFFER, u),
        i.bufferData(
          i.ARRAY_BUFFER,
          new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
          i.STATIC_DRAW
        ));
      let d = i.getAttribLocation(a, 'a_position');
      (i.enableVertexAttribArray(d), i.vertexAttribPointer(d, 2, i.FLOAT, !1, 0, 0));
      let m = i.getAttribLocation(s, 'a_position');
      return (
        i.enableVertexAttribArray(m),
        i.vertexAttribPointer(m, 2, i.FLOAT, !1, 0, 0),
        (this.canvas = n),
        (this.gl = i),
        (this.blendProgram = a),
        (this.adjustmentProgram = r),
        (this.displayProgram = s),
        (this.reductionProgram = o),
        (this.vao = h),
        (this.dummyFloat = this.createDummyTexture(
          i,
          i.R8,
          i.RED,
          i.UNSIGNED_BYTE,
          new Uint8Array([0])
        )),
        (this.dummyUint = this.createDummyTexture(
          i,
          i.R8UI,
          i.RED_INTEGER,
          i.UNSIGNED_BYTE,
          new Uint8Array([0])
        )),
        (this.dummyInt = this.createDummyTexture(
          i,
          i.R8I,
          i.RED_INTEGER,
          i.BYTE,
          new Int8Array([0])
        )),
        !!this.dummyFloat && !!this.dummyUint && !!this.dummyInt
      );
    }
    createDummyTexture(e, t, n, i, a) {
      let r = e.createTexture();
      return r
        ? (this.ownedTextures.add(r),
          e.bindTexture(e.TEXTURE_2D, r),
          this.configureTexture(),
          e.texImage2D(e.TEXTURE_2D, 0, t, 1, 1, 0, n, i, a),
          r)
        : null;
    }
    ensureOutputSurfaces(e, t, n, i) {
      if (
        this.outputTextures &&
        this.framebuffers &&
        this.outputWidth === e &&
        this.outputHeight === t &&
        this.outputUsesFloat === n &&
        this.outputTextures.length === i
      )
        return;
      let a = this.gl,
        r = `${e}x${t}:${n ? 'float' : 'byte'}:${i}`,
        s = this.surfaceCache.get(r);
      if (s) {
        ((this.outputTextures = s.textures),
          (this.framebuffers = s.framebuffers),
          (this.outputWidth = e),
          (this.outputHeight = t),
          (this.outputUsesFloat = n));
        return;
      }
      let o = [],
        h = [];
      for (let u = 0; u < i; u++) {
        let d = a.createTexture(),
          m = a.createFramebuffer();
        if (!d || !m) throw new Error('Could not allocate GPU composite surface');
        if (
          (this.ownedTextures.add(d),
          a.bindTexture(a.TEXTURE_2D, d),
          this.configureTexture(),
          a.texImage2D(
            a.TEXTURE_2D,
            0,
            n ? a.RGBA16F : a.RGBA8,
            e,
            t,
            0,
            a.RGBA,
            n ? a.HALF_FLOAT : a.UNSIGNED_BYTE,
            null
          ),
          a.bindFramebuffer(a.FRAMEBUFFER, m),
          a.framebufferTexture2D(a.FRAMEBUFFER, a.COLOR_ATTACHMENT0, a.TEXTURE_2D, d, 0),
          a.checkFramebufferStatus(a.FRAMEBUFFER) !== a.FRAMEBUFFER_COMPLETE)
        )
          throw new Error('Float composite framebuffer is incomplete');
        (o.push(d), h.push(m));
      }
      ((this.outputTextures = o),
        (this.framebuffers = h),
        this.surfaceCache.set(r, { textures: o, framebuffers: h }),
        (this.outputWidth = e),
        (this.outputHeight = t),
        (this.outputUsesFloat = n));
    }
    textureFor(e, t, n, i) {
      let a = this.textureCache.get(e);
      if (a && a.width === t && a.height === n && a.channels === i) return a;
      let r = this.gl;
      a && (r.deleteTexture(a.texture), this.ownedTextures.delete(a.texture));
      let s = r.createTexture();
      if (!s) throw new Error('Could not allocate layer texture');
      (this.ownedTextures.add(s),
        r.bindTexture(r.TEXTURE_2D, s),
        this.configureTexture(),
        r.pixelStorei(r.UNPACK_ALIGNMENT, 1));
      let o = [r.RED, r.RG, r.RGB, r.RGBA],
        h,
        u = o[i - 1],
        d,
        m,
        p;
      if (e instanceof Float32Array || e instanceof Float64Array)
        ((h = [r.R32F, r.RG32F, r.RGB32F, r.RGBA32F][i - 1]), (d = r.FLOAT), (m = 0), (p = 1));
      else if (e instanceof Uint8Array || e instanceof Uint8ClampedArray)
        ((h = [r.R8, r.RG8, r.RGB8, r.RGBA8][i - 1]), (d = r.UNSIGNED_BYTE), (m = 0), (p = 255));
      else if (e instanceof Uint16Array || e instanceof Uint32Array)
        ((h =
          e instanceof Uint16Array
            ? [r.R16UI, r.RG16UI, r.RGB16UI, r.RGBA16UI][i - 1]
            : [r.R32UI, r.RG32UI, r.RGB32UI, r.RGBA32UI][i - 1]),
          (u = [r.RED_INTEGER, r.RG_INTEGER, r.RGB_INTEGER, r.RGBA_INTEGER][i - 1]),
          (d = e instanceof Uint16Array ? r.UNSIGNED_SHORT : r.UNSIGNED_INT),
          (m = 1),
          (p = e instanceof Uint16Array ? 65535 : 4294967295));
      else {
        let k = e instanceof Int16Array,
          E = e instanceof Int32Array;
        ((h = k
          ? [r.R16I, r.RG16I, r.RGB16I, r.RGBA16I][i - 1]
          : E
            ? [r.R32I, r.RG32I, r.RGB32I, r.RGBA32I][i - 1]
            : [r.R8I, r.RG8I, r.RGB8I, r.RGBA8I][i - 1]),
          (u = [r.RED_INTEGER, r.RG_INTEGER, r.RGB_INTEGER, r.RGBA_INTEGER][i - 1]),
          (d = k ? r.SHORT : E ? r.INT : r.BYTE),
          (m = 2),
          (p = 1));
      }
      let v = e instanceof Float64Array ? Float32Array.from(e) : e;
      r.texImage2D(r.TEXTURE_2D, 0, h, t, n, 0, u, d, v);
      let g = r.getError();
      if (g !== r.NO_ERROR) throw new Error(`Layer texture upload failed (${g})`);
      let w = { texture: s, width: t, height: n, channels: i, encoding: m, nativeMaximum: p };
      return (this.textureCache.set(e, w), w);
    }
    pruneTextureCache(e) {
      let t = this.gl;
      for (let [n, i] of this.textureCache)
        e.has(n) ||
          (t.deleteTexture(i.texture),
          this.ownedTextures.delete(i.texture),
          this.textureCache.delete(n));
    }
    configureTexture() {
      let e = this.gl;
      (e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MIN_FILTER, e.NEAREST),
        e.texParameteri(e.TEXTURE_2D, e.TEXTURE_MAG_FILTER, e.NEAREST),
        e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_S, e.CLAMP_TO_EDGE),
        e.texParameteri(e.TEXTURE_2D, e.TEXTURE_WRAP_T, e.CLAMP_TO_EDGE));
    }
    clearSurface(e) {
      let t = this.gl;
      (t.bindFramebuffer(t.FRAMEBUFFER, this.framebuffers[e]),
        t.clearColor(0, 0, 0, 0),
        t.clear(t.COLOR_BUFFER_BIT));
    }
    drawIsolatedStack(e, t, n, i) {
      let a = this.isolatedStackSignature(e, t, n),
        r = `${this.outputWidth}x${this.outputHeight}:${this.outputUsesFloat ? 'float' : 'byte'}`,
        s = this.isolatedStackCache.get(e)?.get(r);
      if (s?.signature === a) {
        let g = i % 2 === 0 ? i + 1 : i - 1;
        return (this.drawSurfaceLayer(s.texture, i, g, e.opacity ?? 1, e.blendMode || 'normal'), g);
      }
      let o = this.outputTextures.length - 3,
        h = o + 1,
        u = h + 1,
        d = o,
        m = d + 1;
      (this.clearSurface(d),
        this.drawLayer(e, n, d, m, { opacity: 1, blendMode: 'normal' }),
        (d = m),
        this.drawSurfaceLayer(this.outputTextures[d], o, u, 1, 'normal'));
      for (let g of t)
        if (!(g.visible === !1 || (g.opacity ?? 1) <= 0)) {
          if (((m = d === o ? h : o), g.kind === 'adjustment' && g.adjustment))
            this.drawAdjustment(g, d, m, n);
          else if (g.data) this.drawLayer(g, n, d, m, {}, this.outputTextures[u]);
          else continue;
          d = m;
        }
      let p = this.retainIsolatedStack(e, r, a, d),
        v = i % 2 === 0 ? i + 1 : i - 1;
      return (this.drawSurfaceLayer(p, i, v, e.opacity ?? 1, e.blendMode || 'normal'), v);
    }
    objectId(e) {
      if (!e) return 0;
      let t = this.objectIds.get(e);
      return (t || ((t = this.nextObjectId++), this.objectIds.set(e, t)), t);
    }
    isolatedStackSignature(e, t, n) {
      let i = (r, s) => ({
          kind: r.kind,
          data: this.objectId(r.data),
          adjustment: r.adjustment || null,
          width: r.width,
          height: r.height,
          channels: r.channels,
          typeMax: r.typeMax,
          offsetX: s ? Math.round((r.offsetX || 0) * n) : 0,
          offsetY: s ? Math.round((r.offsetY || 0) * n) : 0,
          opacity: r.opacity ?? 1,
          blendMode: r.blendMode || 'normal',
          visible: r.visible !== !1,
          clipped: !!r.clipped,
          mask: r.rasterMask
            ? {
                data: this.objectId(r.rasterMask.data),
                width: r.rasterMask.width,
                height: r.rasterMask.height,
                channels: r.rasterMask.channels,
                typeMax: r.rasterMask.typeMax,
                offsetX: r.rasterMask.offsetX,
                offsetY: r.rasterMask.offsetY,
                invert: r.rasterMask.invert,
              }
            : null,
        }),
        a = i(e, !0);
      return (
        (a.opacity = 1),
        (a.blendMode = 'normal'),
        JSON.stringify([a, ...t.map(r => i(r, !0))])
      );
    }
    retainIsolatedStack(e, t, n, i) {
      let a = this.gl,
        r = this.isolatedStackCache.get(e);
      r || ((r = new Map()), this.isolatedStackCache.set(e, r));
      let s = r.get(t);
      if (!s) {
        let h = a.createTexture(),
          u = a.createFramebuffer();
        if (!h || !u) throw new Error('Could not allocate retained GPU layer surface');
        if (
          (this.ownedTextures.add(h),
          this.cachedFramebuffers.add(u),
          a.bindTexture(a.TEXTURE_2D, h),
          this.configureTexture(),
          a.texImage2D(
            a.TEXTURE_2D,
            0,
            this.outputUsesFloat ? a.RGBA16F : a.RGBA8,
            this.outputWidth,
            this.outputHeight,
            0,
            a.RGBA,
            this.outputUsesFloat ? a.HALF_FLOAT : a.UNSIGNED_BYTE,
            null
          ),
          a.bindFramebuffer(a.FRAMEBUFFER, u),
          a.framebufferTexture2D(a.FRAMEBUFFER, a.COLOR_ATTACHMENT0, a.TEXTURE_2D, h, 0),
          a.checkFramebufferStatus(a.FRAMEBUFFER) !== a.FRAMEBUFFER_COMPLETE)
        )
          throw new Error('Retained GPU layer framebuffer is incomplete');
        ((s = {
          signature: '',
          texture: h,
          framebuffer: u,
          width: this.outputWidth,
          height: this.outputHeight,
          usesFloat: this.outputUsesFloat,
        }),
          r.set(t, s));
      }
      (a.bindFramebuffer(a.FRAMEBUFFER, this.framebuffers[i]),
        a.bindTexture(a.TEXTURE_2D, s.texture),
        a.copyTexSubImage2D(a.TEXTURE_2D, 0, 0, 0, 0, 0, this.outputWidth, this.outputHeight));
      let o = a.getError();
      if (o !== a.NO_ERROR) throw new Error(`Could not retain GPU layer surface (${o})`);
      return ((s.signature = n), s.texture);
    }
    drawLayer(e, t, n, i, a = {}, r) {
      let s = this.gl,
        o = this.blendProgram,
        h = this.textureFor(e.data, e.width, e.height, e.channels),
        u =
          e.rasterMask && this.isSupportedPixels(e.rasterMask.data)
            ? this.textureFor(
                e.rasterMask.data,
                e.rasterMask.width,
                e.rasterMask.height,
                Math.max(1, e.rasterMask.channels ?? 1)
              )
            : null;
      (s.bindFramebuffer(s.FRAMEBUFFER, this.framebuffers[i]),
        s.viewport(0, 0, this.outputWidth, this.outputHeight),
        s.useProgram(o),
        s.bindVertexArray(this.vao),
        this.bindTexture(o, 'u_previous', 0, this.outputTextures[n]),
        this.bindTexture(o, 'u_sourceFloat', 1, h.encoding === 0 ? h.texture : this.dummyFloat),
        this.bindTexture(o, 'u_sourceUint', 2, h.encoding === 1 ? h.texture : this.dummyUint),
        this.bindTexture(o, 'u_sourceInt', 3, h.encoding === 2 ? h.texture : this.dummyInt),
        this.bindTexture(o, 'u_maskFloat', 4, u?.encoding === 0 ? u.texture : this.dummyFloat),
        this.bindTexture(o, 'u_maskUint', 5, u?.encoding === 1 ? u.texture : this.dummyUint),
        this.bindTexture(o, 'u_maskInt', 6, u?.encoding === 2 ? u.texture : this.dummyInt),
        this.bindTexture(o, 'u_clipSurface', 7, r || this.dummyFloat),
        s.uniform2i(s.getUniformLocation(o, 'u_outputSize'), this.outputWidth, this.outputHeight),
        s.uniform2i(s.getUniformLocation(o, 'u_sourceSize'), e.width, e.height),
        s.uniform2i(
          s.getUniformLocation(o, 'u_layerOffset'),
          Math.round((e.offsetX || 0) * t),
          Math.round((e.offsetY || 0) * t)
        ),
        s.uniform2i(
          s.getUniformLocation(o, 'u_layerSize'),
          Math.max(1, Math.round(e.width * t)),
          Math.max(1, Math.round(e.height * t))
        ),
        s.uniform1i(s.getUniformLocation(o, 'u_channels'), e.channels),
        s.uniform1i(s.getUniformLocation(o, 'u_encoding'), h.encoding),
        s.uniform1i(s.getUniformLocation(o, 'u_sourceIsSurface'), 0),
        s.uniform1i(s.getUniformLocation(o, 'u_hasMask'), u ? 1 : 0),
        s.uniform1i(s.getUniformLocation(o, 'u_maskEncoding'), u?.encoding ?? 0),
        s.uniform1i(
          s.getUniformLocation(o, 'u_maskChannels'),
          Math.max(1, e.rasterMask?.channels ?? 1)
        ),
        s.uniform1i(s.getUniformLocation(o, 'u_maskInvert'), e.rasterMask?.invert ? 1 : 0),
        s.uniform2i(
          s.getUniformLocation(o, 'u_maskSourceSize'),
          e.rasterMask?.width ?? 1,
          e.rasterMask?.height ?? 1
        ),
        s.uniform2i(
          s.getUniformLocation(o, 'u_maskOffset'),
          Math.round((e.rasterMask?.offsetX ?? e.offsetX ?? 0) * t),
          Math.round((e.rasterMask?.offsetY ?? e.offsetY ?? 0) * t)
        ),
        s.uniform2i(
          s.getUniformLocation(o, 'u_maskLayerSize'),
          Math.max(1, Math.round((e.rasterMask?.width ?? 1) * t)),
          Math.max(1, Math.round((e.rasterMask?.height ?? 1) * t))
        ));
      let d = u
        ? u.encoding === 0 && u.nativeMaximum > 1
          ? u.nativeMaximum / (e.rasterMask?.typeMax || u.nativeMaximum)
          : 1 / (e.rasterMask?.typeMax || 1)
        : 1;
      (s.uniform1f(s.getUniformLocation(o, 'u_maskValueScale'), d),
        s.uniform1i(s.getUniformLocation(o, 'u_hasClip'), r ? 1 : 0));
      let p = [
          'add',
          'subtract',
          'raw-difference',
          'raw-multiply',
          'divide',
          'min',
          'max',
          'average',
        ].includes(a.blendMode ?? e.blendMode ?? '')
          ? this.compositionTypeMax
          : e.typeMax || 1,
        v = h.encoding === 0 && h.nativeMaximum > 1 ? h.nativeMaximum / p : 1 / p;
      (s.uniform1f(s.getUniformLocation(o, 'u_valueScale'), v),
        s.uniform1f(s.getUniformLocation(o, 'u_outputMaximum'), this.compositionTypeMax),
        s.uniform1f(
          s.getUniformLocation(o, 'u_opacity'),
          Math.max(0, Math.min(1, a.opacity ?? e.opacity ?? 1))
        ),
        s.uniform1i(
          s.getUniformLocation(o, 'u_blendMode'),
          Qa.get(a.blendMode ?? e.blendMode ?? 'normal') || 0
        ));
      let g = e.maskCondition;
      (s.uniform1i(
        s.getUniformLocation(o, 'u_maskCondition'),
        ['gt', 'ge', 'lt', 'le', 'eq', 'isfinite', 'isnan'].indexOf(g?.op || '') + 1
      ),
        s.uniform1f(
          s.getUniformLocation(o, 'u_maskThreshold'),
          (g?.threshold || 0) / (e.typeMax || this.compositionTypeMax)
        ),
        s.drawArrays(s.TRIANGLE_STRIP, 0, 4));
    }
    drawSurfaceLayer(e, t, n, i, a, r = 0, s = 0, o, h = 1) {
      let u = this.gl,
        d = this.blendProgram,
        m =
          o?.rasterMask && this.isSupportedPixels(o.rasterMask.data)
            ? this.textureFor(
                o.rasterMask.data,
                o.rasterMask.width,
                o.rasterMask.height,
                Math.max(1, o.rasterMask.channels ?? 1)
              )
            : null;
      (u.bindFramebuffer(u.FRAMEBUFFER, this.framebuffers[n]),
        u.viewport(0, 0, this.outputWidth, this.outputHeight),
        u.useProgram(d),
        u.bindVertexArray(this.vao),
        this.bindTexture(d, 'u_previous', 0, this.outputTextures[t]),
        this.bindTexture(d, 'u_sourceFloat', 1, e),
        this.bindTexture(d, 'u_sourceUint', 2, this.dummyUint),
        this.bindTexture(d, 'u_sourceInt', 3, this.dummyInt),
        this.bindTexture(d, 'u_maskFloat', 4, m?.encoding === 0 ? m.texture : this.dummyFloat),
        this.bindTexture(d, 'u_maskUint', 5, m?.encoding === 1 ? m.texture : this.dummyUint),
        this.bindTexture(d, 'u_maskInt', 6, m?.encoding === 2 ? m.texture : this.dummyInt),
        this.bindTexture(d, 'u_clipSurface', 7, this.dummyFloat),
        u.uniform2i(u.getUniformLocation(d, 'u_outputSize'), this.outputWidth, this.outputHeight),
        u.uniform2i(u.getUniformLocation(d, 'u_sourceSize'), this.outputWidth, this.outputHeight),
        u.uniform2i(u.getUniformLocation(d, 'u_layerOffset'), r, s),
        u.uniform2i(u.getUniformLocation(d, 'u_layerSize'), this.outputWidth, this.outputHeight),
        u.uniform1i(u.getUniformLocation(d, 'u_channels'), 4),
        u.uniform1i(u.getUniformLocation(d, 'u_encoding'), 0),
        u.uniform1i(u.getUniformLocation(d, 'u_sourceIsSurface'), 1),
        u.uniform1i(u.getUniformLocation(d, 'u_hasMask'), m ? 1 : 0),
        u.uniform1i(u.getUniformLocation(d, 'u_maskEncoding'), m?.encoding ?? 0),
        u.uniform1i(
          u.getUniformLocation(d, 'u_maskChannels'),
          Math.max(1, o?.rasterMask?.channels ?? 1)
        ),
        u.uniform1i(u.getUniformLocation(d, 'u_maskInvert'), o?.rasterMask?.invert ? 1 : 0),
        u.uniform2i(
          u.getUniformLocation(d, 'u_maskSourceSize'),
          o?.rasterMask?.width ?? 1,
          o?.rasterMask?.height ?? 1
        ),
        u.uniform2i(
          u.getUniformLocation(d, 'u_maskOffset'),
          Math.round((o?.rasterMask?.offsetX ?? o?.offsetX ?? 0) * h),
          Math.round((o?.rasterMask?.offsetY ?? o?.offsetY ?? 0) * h)
        ),
        u.uniform2i(
          u.getUniformLocation(d, 'u_maskLayerSize'),
          Math.max(1, Math.round((o?.rasterMask?.width ?? 1) * h)),
          Math.max(1, Math.round((o?.rasterMask?.height ?? 1) * h))
        ));
      let p = m
        ? m.encoding === 0 && m.nativeMaximum > 1
          ? m.nativeMaximum / (o?.rasterMask?.typeMax || m.nativeMaximum)
          : 1 / (o?.rasterMask?.typeMax || 1)
        : 1;
      (u.uniform1f(u.getUniformLocation(d, 'u_maskValueScale'), p),
        u.uniform1i(u.getUniformLocation(d, 'u_hasClip'), 0),
        u.uniform1f(u.getUniformLocation(d, 'u_valueScale'), 1),
        u.uniform1f(u.getUniformLocation(d, 'u_outputMaximum'), this.compositionTypeMax),
        u.uniform1f(u.getUniformLocation(d, 'u_opacity'), Math.max(0, Math.min(1, i))),
        u.uniform1i(u.getUniformLocation(d, 'u_blendMode'), Qa.get(a) || 0),
        u.uniform1i(u.getUniformLocation(d, 'u_maskCondition'), 0),
        u.uniform1f(u.getUniformLocation(d, 'u_maskThreshold'), 0),
        u.drawArrays(u.TRIANGLE_STRIP, 0, 4));
    }
    drawAdjustment(e, t, n, i) {
      let a = e.adjustment,
        r = this.gl,
        s = this.adjustmentProgram,
        o =
          e.rasterMask && this.isSupportedPixels(e.rasterMask.data)
            ? this.textureFor(
                e.rasterMask.data,
                e.rasterMask.width,
                e.rasterMask.height,
                Math.max(1, e.rasterMask.channels ?? 1)
              )
            : null;
      (r.bindFramebuffer(r.FRAMEBUFFER, this.framebuffers[n]),
        r.viewport(0, 0, this.outputWidth, this.outputHeight),
        r.useProgram(s),
        r.bindVertexArray(this.vao),
        this.bindTexture(s, 'u_source', 0, this.outputTextures[t]),
        r.uniform1f(r.getUniformLocation(s, 'u_amount'), Math.max(0, Math.min(1, e.opacity ?? 1))),
        this.bindTexture(
          s,
          'u_adjustmentMaskFloat',
          2,
          o?.encoding === 0 ? o.texture : this.dummyFloat
        ),
        this.bindTexture(
          s,
          'u_adjustmentMaskUint',
          3,
          o?.encoding === 1 ? o.texture : this.dummyUint
        ),
        this.bindTexture(
          s,
          'u_adjustmentMaskInt',
          4,
          o?.encoding === 2 ? o.texture : this.dummyInt
        ),
        r.uniform1i(r.getUniformLocation(s, 'u_hasAdjustmentMask'), o ? 1 : 0),
        r.uniform1i(r.getUniformLocation(s, 'u_adjustmentMaskEncoding'), o?.encoding ?? 0),
        r.uniform1i(
          r.getUniformLocation(s, 'u_adjustmentMaskInvert'),
          e.rasterMask?.invert ? 1 : 0
        ),
        r.uniform2i(
          r.getUniformLocation(s, 'u_adjustmentOutputSize'),
          this.outputWidth,
          this.outputHeight
        ),
        r.uniform2i(
          r.getUniformLocation(s, 'u_adjustmentMaskSourceSize'),
          e.rasterMask?.width ?? 1,
          e.rasterMask?.height ?? 1
        ),
        r.uniform2i(
          r.getUniformLocation(s, 'u_adjustmentMaskOffset'),
          Math.round((e.rasterMask?.offsetX ?? e.offsetX ?? 0) * i),
          Math.round((e.rasterMask?.offsetY ?? e.offsetY ?? 0) * i)
        ),
        r.uniform2i(
          r.getUniformLocation(s, 'u_adjustmentMaskLayerSize'),
          Math.max(1, Math.round((e.rasterMask?.width ?? 1) * i)),
          Math.max(1, Math.round((e.rasterMask?.height ?? 1) * i))
        ));
      let h = o
        ? o.encoding === 0 && o.nativeMaximum > 1
          ? o.nativeMaximum / (e.rasterMask?.typeMax || o.nativeMaximum)
          : 1 / (e.rasterMask?.typeMax || 1)
        : 1;
      r.uniform1f(r.getUniformLocation(s, 'u_adjustmentMaskValueScale'), h);
      let u = new Float32Array(45);
      if (
        (r.uniform1iv(r.getUniformLocation(s, 'u_flags'), new Int32Array(8)),
        a.type === 'levels' || a.type === 'curves')
      ) {
        let p = this.createAdjustmentLut(a);
        (this.bindTexture(s, 'u_source', 0, this.outputTextures[t]),
          this.bindTexture(s, 'u_lut', 1, p),
          this.bindTexture(
            s,
            'u_adjustmentMaskFloat',
            2,
            o?.encoding === 0 ? o.texture : this.dummyFloat
          ),
          this.bindTexture(
            s,
            'u_adjustmentMaskUint',
            3,
            o?.encoding === 1 ? o.texture : this.dummyUint
          ),
          this.bindTexture(
            s,
            'u_adjustmentMaskInt',
            4,
            o?.encoding === 2 ? o.texture : this.dummyInt
          ),
          r.uniform1i(r.getUniformLocation(s, 'u_type'), 0),
          r.drawArrays(r.TRIANGLE_STRIP, 0, 4));
        return;
      }
      let d = 1,
        m = new Int32Array(8);
      if (a.type === 'hue/saturation') {
        let p = !!a.colorize && a.colorizeEnabled !== !1;
        if (((m[0] = p ? 1 : 0), p))
          u.set([
            a.colorize.hue || 0,
            (a.colorize.saturation || 0) / 100,
            (a.colorize.lightness || 0) / 100,
          ]);
        else {
          let v = a.master || {};
          u.set([v.hue || 0, v.saturation || 0, v.lightness || 0]);
          for (let g = 0; g < 6; g++) {
            let w = a[['reds', 'yellows', 'greens', 'cyans', 'blues', 'magentas'][g]],
              k = 3 + g * 7,
              E = !!w && ['a', 'b', 'c', 'd'].every(L => Number.isFinite(w[L]));
            ((m[g + 1] = E ? 1 : 0),
              u.set(
                [
                  w?.a || 0,
                  w?.b || 0,
                  w?.c || 0,
                  w?.d || 0,
                  w?.hue || 0,
                  w?.saturation || 0,
                  w?.lightness || 0,
                ],
                k
              ));
          }
        }
      } else if (a.type === 'brightness/contrast')
        ((d = 2), u.set([a.brightness || 0, a.contrast || 0]));
      else if (a.type === 'exposure')
        ((d = 3), u.set([a.exposure || 0, a.offset || 0, a.gamma ?? 1]));
      else if (a.type === 'invert') d = 4;
      else if (a.type === 'channel mixer') {
        ((d = 5), (m[0] = a.monochrome ? 1 : 0));
        let p = (v, g) => {
          let w = v || g;
          return [w.red ?? 0, w.green ?? 0, w.blue ?? 0, w.constant ?? 0];
        };
        u.set([
          ...p(a.red, { red: 100 }),
          ...p(a.green, { green: 100 }),
          ...p(a.blue, { blue: 100 }),
          ...p(a.gray, { red: 40, green: 40, blue: 20 }),
        ]);
      } else if (a.type === 'color balance') {
        ((d = 6), (m[0] = a.preserveLuminosity ? 1 : 0));
        let p = v => [v?.cyanRed || 0, v?.magentaGreen || 0, v?.yellowBlue || 0];
        u.set([...p(a.shadows), ...p(a.midtones), ...p(a.highlights)]);
      } else if (a.type === 'black & white')
        ((d = 7),
          u.set([
            a.reds ?? 40,
            a.yellows ?? 60,
            a.greens ?? 40,
            a.cyans ?? 60,
            a.blues ?? 20,
            a.magentas ?? 80,
          ]));
      else if (a.type === 'threshold') ((d = 8), (u[0] = a.level ?? 128));
      else if (a.type === 'posterize') ((d = 9), (u[0] = a.levels ?? 4));
      else if (a.type === 'gradient map') {
        d = 10;
        let p = this.createAdjustmentLut(a);
        (this.bindTexture(s, 'u_source', 0, this.outputTextures[t]),
          this.bindTexture(s, 'u_lut', 1, p),
          this.bindTexture(
            s,
            'u_adjustmentMaskFloat',
            2,
            o?.encoding === 0 ? o.texture : this.dummyFloat
          ),
          this.bindTexture(
            s,
            'u_adjustmentMaskUint',
            3,
            o?.encoding === 1 ? o.texture : this.dummyUint
          ),
          this.bindTexture(
            s,
            'u_adjustmentMaskInt',
            4,
            o?.encoding === 2 ? o.texture : this.dummyInt
          ));
      }
      (r.uniform1i(r.getUniformLocation(s, 'u_type'), d),
        r.uniform1fv(r.getUniformLocation(s, 'u_parameters'), u),
        r.uniform1iv(r.getUniformLocation(s, 'u_flags'), m),
        r.drawArrays(r.TRIANGLE_STRIP, 0, 4));
    }
    createAdjustmentLut(e) {
      let t = this.gl,
        n = this.adjustmentLutCache.get(e);
      if (n) return n;
      let i = new Uint8Array(256 * 4);
      for (let r = 0; r < 256; r++) {
        if (e.type === 'gradient map') {
          let s = [
              { position: 0, color: { r: 0, g: 0, b: 0 } },
              { position: 1, color: { r: 255, g: 255, b: 255 } },
            ],
            o = (e.stops?.length ? e.stops : s)
              .map(p => ({ ...p, position: Math.max(0, Math.min(1, p.position)) }))
              .sort((p, v) => p.position - v.position),
            h = e.reverse ? 1 - r / 255 : r / 255,
            u = o[0],
            d = o[0],
            m = 0;
          if (h >= o[o.length - 1].position) u = d = o[o.length - 1];
          else if (h > o[0].position) {
            for (let p = 1; p < o.length; p++)
              if (h <= o[p].position) {
                ((u = o[p - 1]),
                  (d = o[p]),
                  (m = (h - u.position) / Math.max(1e-6, d.position - u.position)));
                break;
              }
          }
          for (let p = 0; p < 3; p++) {
            let v = ['r', 'g', 'b'][p];
            i[r * 4 + p] = Math.max(
              0,
              Math.min(255, Math.round(u.color[v] + (d.color[v] - u.color[v]) * m))
            );
          }
        } else
          for (let s = 0; s < 3; s++) {
            let o = ['red', 'green', 'blue'][s];
            i[r * 4 + s] = Math.max(
              0,
              Math.min(255, Math.round(this.adjustmentCurve(this.adjustmentCurve(r, e.rgb), e[o])))
            );
          }
        i[r * 4 + 3] = 255;
      }
      let a = t.createTexture();
      if (!a) throw new Error('Could not create adjustment LUT');
      return (
        this.ownedTextures.add(a),
        t.bindTexture(t.TEXTURE_2D, a),
        this.configureTexture(),
        t.texImage2D(t.TEXTURE_2D, 0, t.RGBA8, 256, 1, 0, t.RGBA, t.UNSIGNED_BYTE, i),
        this.adjustmentLutCache.set(e, a),
        a
      );
    }
    pruneAdjustmentLutCache(e) {
      let t = this.gl;
      for (let [n, i] of this.adjustmentLutCache)
        e.has(n) ||
          (t.deleteTexture(i), this.ownedTextures.delete(i), this.adjustmentLutCache.delete(n));
    }
    adjustmentCurve(e, t) {
      if (!t) return e;
      if (Array.isArray(t)) return Pn(t, e);
      let n = t.shadowInput ?? 0,
        i = t.highlightInput ?? 255,
        a = Math.max(0.01, t.midtoneInput ?? 1),
        r = Math.max(0, Math.min(1, (e - n) / Math.max(1e-6, i - n))),
        s = t.shadowOutput ?? 0,
        o = t.highlightOutput ?? 255;
      return s + Math.pow(r, 1 / a) * (o - s);
    }
    validateNativeSamples(e, t, n, i) {
      let a = this.gl,
        r = [
          [0, 0],
          [Math.floor(t / 2), 0],
          [t - 1, 0],
          [0, Math.floor(n / 2)],
          [Math.floor(t / 2), Math.floor(n / 2)],
          [t - 1, Math.floor(n / 2)],
          [0, n - 1],
          [Math.floor(t / 2), n - 1],
          [t - 1, n - 1],
        ];
      a.bindFramebuffer(a.FRAMEBUFFER, this.framebuffers[i]);
      for (let [s, o] of r) {
        let h = this.outputUsesFloat ? new Float32Array(4) : new Uint8Array(4);
        a.readPixels(
          s,
          n - 1 - o,
          1,
          1,
          a.RGBA,
          this.outputUsesFloat ? a.FLOAT : a.UNSIGNED_BYTE,
          h
        );
        let u = a.getError();
        if (u !== a.NO_ERROR) throw new Error(`GPU validation read failed (${u})`);
        let d = In(e, t, n, { x: s, y: o, width: 1, height: 1 }),
          m = d.typeMax || 1,
          p =
            d.coveredCount <= 0
              ? [0, 0, 0, 0]
              : d.channels === 1
                ? [d.data[0] / m, d.data[0] / m, d.data[0] / m, 1]
                : d.channels === 3
                  ? [d.data[0] / m, d.data[1] / m, d.data[2] / m, 1]
                  : [d.data[0] / m, d.data[1] / m, d.data[2] / m, d.data[3] / m];
        for (let v = 0; v < 4; v++) {
          let g = Number(h[v]) / (this.outputUsesFloat ? 1 : 255),
            w = p[v];
          if (
            !(!Number.isFinite(g) && !Number.isFinite(w)) &&
            (!Number.isFinite(g) ||
              !Number.isFinite(w) ||
              Math.abs(g - w) > (this.outputUsesFloat ? 0.004 : 3 / 255))
          )
            throw new Error(`GPU parity mismatch at ${s},${o} channel ${v}: ${g} != ${w}`);
        }
      }
    }
    uploadColormap(e) {
      if (!e || e === 'none') {
        this.colormapName = 'none';
        return;
      }
      if (this.colormapName === e && this.colormapTexture) return;
      let t = Ln(e);
      if (!t) {
        this.colormapName = 'none';
        return;
      }
      let n = this.gl;
      if (!this.colormapTexture) {
        if (((this.colormapTexture = n.createTexture()), !this.colormapTexture))
          throw new Error('Could not allocate display colormap texture');
        this.ownedTextures.add(this.colormapTexture);
      }
      (n.activeTexture(n.TEXTURE1),
        n.bindTexture(n.TEXTURE_2D, this.colormapTexture),
        n.texParameteri(n.TEXTURE_2D, n.TEXTURE_MIN_FILTER, n.LINEAR),
        n.texParameteri(n.TEXTURE_2D, n.TEXTURE_MAG_FILTER, n.LINEAR),
        n.texParameteri(n.TEXTURE_2D, n.TEXTURE_WRAP_S, n.CLAMP_TO_EDGE),
        n.texParameteri(n.TEXTURE_2D, n.TEXTURE_WRAP_T, n.CLAMP_TO_EDGE),
        n.pixelStorei(n.UNPACK_ALIGNMENT, 1),
        n.texImage2D(n.TEXTURE_2D, 0, n.RGB8, 256, 1, 0, n.RGB, n.UNSIGNED_BYTE, t),
        (this.colormapName = e));
    }
    ensureReductionSurfaces(e, t) {
      let n = `${e}x${t}`;
      if (this.reductionSize === n) return;
      let i = this.gl;
      for (let s of this.reductionTextures) (i.deleteTexture(s), this.ownedTextures.delete(s));
      for (let s of this.reductionFramebuffers)
        (i.deleteFramebuffer(s), this.cachedFramebuffers.delete(s));
      ((this.reductionTextures = []), (this.reductionFramebuffers = []));
      let a = e,
        r = t;
      for (; a > 1 || r > 1;) {
        ((a = Math.max(1, Math.ceil(a / 2))), (r = Math.max(1, Math.ceil(r / 2))));
        let s = i.createTexture(),
          o = i.createFramebuffer();
        if (!s || !o) throw new Error('Could not allocate auto-normalization reduction surface');
        if (
          (this.ownedTextures.add(s),
          this.cachedFramebuffers.add(o),
          i.bindTexture(i.TEXTURE_2D, s),
          this.configureTexture(),
          i.texImage2D(i.TEXTURE_2D, 0, i.RG32F, a, r, 0, i.RG, i.FLOAT, null),
          i.bindFramebuffer(i.FRAMEBUFFER, o),
          i.framebufferTexture2D(i.FRAMEBUFFER, i.COLOR_ATTACHMENT0, i.TEXTURE_2D, s, 0),
          i.checkFramebufferStatus(i.FRAMEBUFFER) !== i.FRAMEBUFFER_COMPLETE)
        )
          throw new Error('Auto-normalization reduction framebuffer is incomplete');
        (this.reductionTextures.push(s), this.reductionFramebuffers.push(o));
      }
      this.reductionSize = n;
    }
    autoNormalizationRange(e) {
      if (
        (this.ensureReductionSurfaces(this.outputWidth, this.outputHeight),
        !this.reductionTextures.length)
      ) {
        let o = this.gl;
        o.bindFramebuffer(o.FRAMEBUFFER, this.framebuffers[e]);
        let h = this.outputUsesFloat ? new Float32Array(4) : new Uint8Array(4);
        o.readPixels(0, 0, 1, 1, o.RGBA, this.outputUsesFloat ? o.FLOAT : o.UNSIGNED_BYTE, h);
        let u = this.outputUsesFloat ? 1 : 255,
          d = Array.from(h.slice(0, 3), m => m / u).filter(Number.isFinite);
        return d.length ? [Math.min(...d), Math.max(...d)] : [0, 1];
      }
      let t = this.gl,
        n = this.reductionProgram,
        i = this.outputTextures[e],
        a = this.outputWidth,
        r = this.outputHeight;
      for (let o = 0; o < this.reductionTextures.length; o++) {
        let h = Math.max(1, Math.ceil(a / 2)),
          u = Math.max(1, Math.ceil(r / 2));
        (t.bindFramebuffer(t.FRAMEBUFFER, this.reductionFramebuffers[o]),
          t.viewport(0, 0, h, u),
          t.useProgram(n),
          t.bindVertexArray(this.vao),
          this.bindTexture(n, 'u_reduceSource', 0, i),
          t.uniform2i(t.getUniformLocation(n, 'u_reduceSourceSize'), a, r),
          t.uniform1i(t.getUniformLocation(n, 'u_reduceFirstPass'), o === 0 ? 1 : 0),
          t.drawArrays(t.TRIANGLE_STRIP, 0, 4),
          (i = this.reductionTextures[o]),
          (a = h),
          (r = u));
      }
      let s = new Float32Array(2);
      return (
        t.bindFramebuffer(
          t.FRAMEBUFFER,
          this.reductionFramebuffers[this.reductionFramebuffers.length - 1]
        ),
        t.readPixels(0, 0, 1, 1, t.RG, t.FLOAT, s),
        !Number.isFinite(s[0]) || !Number.isFinite(s[1]) || s[1] < s[0] ? [0, 1] : [s[0], s[1]]
      );
    }
    drawDisplay(e, t, n, i) {
      let a = this.gl,
        r = this.displayProgram,
        s = n.find(p => p.visible !== !1 && (p.opacity ?? 1) > 0 && p.data)?.typeMax || 1,
        o = t.normalization?.gammaMode ? 0 : (t.normalization?.min ?? 0) / s,
        h = t.normalization?.gammaMode ? 1 : (t.normalization?.max ?? s) / s;
      t.normalization?.autoNormalize && ([o, h] = this.autoNormalizationRange(e));
      let u = t.displayColormap || 'none';
      this.uploadColormap(u);
      let d =
        t.rgbAs24BitGrayscale === !0 &&
        n.some(p => p.visible !== !1 && (p.opacity ?? 1) > 0 && !!p.data && p.channels >= 3);
      (a.bindFramebuffer(a.FRAMEBUFFER, null),
        a.viewport(0, 0, this.outputWidth, this.outputHeight),
        a.useProgram(r),
        a.bindVertexArray(this.vao),
        this.bindTexture(r, 'u_composite', 0, this.outputTextures[e]),
        this.bindTexture(r, 'u_displayColormap', 1, this.colormapTexture || this.dummyFloat),
        a.uniform2i(a.getUniformLocation(r, 'u_outputSize'), this.outputWidth, this.outputHeight),
        a.uniform1f(a.getUniformLocation(r, 'u_min'), o),
        a.uniform1f(a.getUniformLocation(r, 'u_inverseRange'), h > o ? 1 / (h - o) : 0),
        a.uniform1f(a.getUniformLocation(r, 'u_gammaIn'), t.gamma?.in ?? 1),
        a.uniform1f(a.getUniformLocation(r, 'u_gammaOut'), t.gamma?.out ?? 1),
        a.uniform1f(a.getUniformLocation(r, 'u_exposure'), t.brightness?.offset ?? 0),
        a.uniform3f(a.getUniformLocation(r, 'u_nanColor'), i.r / 255, i.g / 255, i.b / 255),
        a.uniform1i(
          a.getUniformLocation(r, 'u_useDisplayColormap'),
          this.colormapName !== 'none' && this.colormapTexture ? 1 : 0
        ),
        a.uniform1i(a.getUniformLocation(r, 'u_rgb24'), d ? 1 : 0),
        a.uniform1f(a.getUniformLocation(r, 'u_rgb24Maximum'), s),
        a.uniform1f(a.getUniformLocation(r, 'u_rgb24Divisor'), s > 255 ? 257 : 1),
        a.uniform1f(a.getUniformLocation(r, 'u_rgb24Min'), t.normalization?.min ?? 0));
      let m = t.normalization?.max ?? 16777215;
      (a.uniform1f(
        a.getUniformLocation(r, 'u_rgb24InverseRange'),
        m > (t.normalization?.min ?? 0) ? 1 / (m - (t.normalization?.min ?? 0)) : 0
      ),
        a.drawArrays(a.TRIANGLE_STRIP, 0, 4));
    }
    bindTexture(e, t, n, i) {
      let a = this.gl;
      (a.activeTexture(a.TEXTURE0 + n),
        a.bindTexture(a.TEXTURE_2D, i),
        a.uniform1i(a.getUniformLocation(e, t), n));
    }
    createProgram(e, t) {
      let n = this.compile(e, e.VERTEX_SHADER, Kh),
        i = this.compile(e, e.FRAGMENT_SHADER, t);
      if (!n || !i) return null;
      let a = e.createProgram();
      if (!a) return null;
      if (
        (e.attachShader(a, n),
        e.attachShader(a, i),
        e.linkProgram(a),
        e.deleteShader(n),
        e.deleteShader(i),
        !e.getProgramParameter(a, e.LINK_STATUS))
      ) {
        let r = e.getProgramInfoLog(a);
        throw (e.deleteProgram(a), new Error(`Layer compositor program link failed: ${r}`));
      }
      return a;
    }
    compile(e, t, n) {
      let i = e.createShader(t);
      if (!i) return null;
      if ((e.shaderSource(i, n), e.compileShader(i), !e.getShaderParameter(i, e.COMPILE_STATUS))) {
        let a = e.getShaderInfoLog(i);
        throw (e.deleteShader(i), new Error(`Layer compositor shader failed: ${a}`));
      }
      return i;
    }
  },
  Kh = `#version 300 es
layout(location = 0) in vec2 a_position;
void main() { gl_Position = vec4(a_position, 0.0, 1.0); }`,
  Jh = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
precision highp usampler2D;
precision highp isampler2D;
uniform sampler2D u_previous;
uniform sampler2D u_sourceFloat;
uniform usampler2D u_sourceUint;
uniform isampler2D u_sourceInt;
uniform sampler2D u_maskFloat;
uniform usampler2D u_maskUint;
uniform isampler2D u_maskInt;
uniform sampler2D u_clipSurface;
uniform ivec2 u_outputSize;
uniform ivec2 u_sourceSize;
uniform ivec2 u_layerOffset;
uniform ivec2 u_layerSize;
uniform int u_channels;
uniform int u_encoding;
uniform int u_sourceIsSurface;
uniform int u_hasMask;
uniform int u_maskEncoding;
uniform int u_maskChannels;
uniform int u_maskInvert;
uniform int u_hasClip;
uniform ivec2 u_maskSourceSize;
uniform ivec2 u_maskOffset;
uniform ivec2 u_maskLayerSize;
uniform float u_maskValueScale;
uniform int u_blendMode;
uniform int u_maskCondition;
uniform float u_valueScale;
uniform float u_outputMaximum;
uniform float u_opacity;
uniform float u_maskThreshold;
out vec4 outColor;
bool invalid3(vec3 value) {
	return any(isnan(value)) || any(isinf(value));
}
float nanValue() {
	return uintBitsToFloat(0x7fc00000u);
}
vec4 sourceValue(ivec2 coordinate) {
	vec4 value = u_encoding == 0 ? texelFetch(u_sourceFloat, coordinate, 0)
		: u_encoding == 1 ? vec4(texelFetch(u_sourceUint, coordinate, 0))
		: vec4(texelFetch(u_sourceInt, coordinate, 0));
	if (u_channels == 1) { return vec4(value.rrr * u_valueScale, 1.0); }
	if (u_channels == 2) { return vec4(value.rrr * u_valueScale, value.g * u_valueScale); }
	if (u_channels == 3) { return vec4(value.rgb * u_valueScale, 1.0); }
	return value * u_valueScale;
}
float maskFactor(ivec2 outputPixel, int logicalY) {
	if (u_hasMask == 0) { return 1.0; }
	ivec2 local = ivec2(outputPixel.x - u_maskOffset.x, logicalY - u_maskOffset.y);
	if (local.x < 0 || local.y < 0 || local.x >= u_maskLayerSize.x || local.y >= u_maskLayerSize.y) {
		return u_maskInvert == 1 ? 1.0 : 0.0;
	}
	ivec2 coordinate = ivec2(
		min(u_maskSourceSize.x - 1, int((float(local.x) + 0.5) * float(u_maskSourceSize.x) / float(u_maskLayerSize.x))),
		min(u_maskSourceSize.y - 1, int((float(local.y) + 0.5) * float(u_maskSourceSize.y) / float(u_maskLayerSize.y)))
	);
	vec4 value = u_maskEncoding == 0 ? texelFetch(u_maskFloat, coordinate, 0)
		: u_maskEncoding == 1 ? vec4(texelFetch(u_maskUint, coordinate, 0))
		: vec4(texelFetch(u_maskInt, coordinate, 0));
	float factor = isinf(value.r) || isnan(value.r) ? 0.0 : clamp(value.r * u_maskValueScale, 0.0, 1.0);
	return u_maskInvert == 1 ? 1.0 - factor : factor;
}
vec3 blendValue(vec3 below, vec3 source) {
	if (u_blendMode == 1) { return below * source; }
	if (u_blendMode == 2) { return vec3(1.0) - (vec3(1.0) - below) * (vec3(1.0) - source); }
	if (u_blendMode == 3) {
		return mix(2.0 * below * source, vec3(1.0) - 2.0 * (vec3(1.0) - below) * (vec3(1.0) - source), step(vec3(0.5), below));
	}
	if (u_blendMode == 4) { return min(below, source); }
	if (u_blendMode == 5) { return max(below, source); }
	if (u_blendMode == 6) { return abs(below - source); }
	if (u_blendMode == 7) { return below + source - 2.0 * below * source; }
	if (u_blendMode == 8) { return below + source; }
	if (u_blendMode == 9) { return below - source; }
	if (u_blendMode == 10) { return abs(below - source); }
	if (u_blendMode == 11) { return below * source * u_outputMaximum; }
	if (u_blendMode == 12) {
		return vec3(
			source.r == 0.0 ? nanValue() : below.r / source.r,
			source.g == 0.0 ? nanValue() : below.g / source.g,
			source.b == 0.0 ? nanValue() : below.b / source.b
		) / u_outputMaximum;
	}
	if (u_blendMode == 13) { return min(below, source); }
	if (u_blendMode == 14) { return max(below, source); }
	if (u_blendMode == 15) { return (below + source) * 0.5; }
	return source;
}
bool keepMask(float value) {
	if (u_maskCondition == 1) { return value > u_maskThreshold; }
	if (u_maskCondition == 2) { return value >= u_maskThreshold; }
	if (u_maskCondition == 3) { return value < u_maskThreshold; }
	if (u_maskCondition == 4) { return value <= u_maskThreshold; }
	if (u_maskCondition == 5) { return abs(value - u_maskThreshold) <= 1e-6; }
	if (u_maskCondition == 6) { return !isnan(value) && !isinf(value); }
	if (u_maskCondition == 7) { return isnan(value) || isinf(value); }
	return true;
}
void main() {
	ivec2 outputPixel = ivec2(gl_FragCoord.xy);
	vec4 below = texelFetch(u_previous, outputPixel, 0);
	int logicalY = u_outputSize.y - 1 - outputPixel.y;
	ivec2 local = ivec2(outputPixel.x - u_layerOffset.x, logicalY - u_layerOffset.y);
	if (local.x < 0 || local.y < 0 || local.x >= u_layerSize.x || local.y >= u_layerSize.y) {
		outColor = below;
		return;
	}
	ivec2 sourcePixel = u_sourceIsSurface == 1
		? ivec2(local.x, u_sourceSize.y - 1 - local.y)
		: ivec2(
			min(u_sourceSize.x - 1, int((float(local.x) + 0.5) * float(u_sourceSize.x) / float(u_layerSize.x))),
			min(u_sourceSize.y - 1, int((float(local.y) + 0.5) * float(u_sourceSize.y) / float(u_layerSize.y)))
		);
	vec4 source = sourceValue(sourcePixel);
	if (u_blendMode == 16) {
		float value = u_channels >= 3 ? dot(source.rgb, vec3(0.2126, 0.7152, 0.0722)) : source.r;
		outColor = keepMask(value) ? below : vec4(0.0);
		return;
	}
	if (isnan(source.a) || isinf(source.a)) { outColor = vec4(vec3(nanValue()), 1.0); return; }
	float clipAlpha = u_hasClip == 1 ? texelFetch(u_clipSurface, outputPixel, 0).a : 1.0;
	float sourceAlpha = clamp(source.a * u_opacity * maskFactor(outputPixel, logicalY) * clipAlpha, 0.0, 1.0);
	if (sourceAlpha <= 0.0) { outColor = below; return; }
	float destinationAlpha = below.a;
	if (u_blendMode >= 8 && u_blendMode <= 15) {
		float amount = clamp(u_opacity * maskFactor(outputPixel, logicalY) * clipAlpha, 0.0, 1.0);
		if (destinationAlpha <= 0.0) { outColor = vec4(source.rgb, 1.0); return; }
		vec3 result = blendValue(below.rgb, source.rgb);
		outColor = vec4(mix(below.rgb, result, amount), below.a);
		return;
	}
	float outputAlpha = sourceAlpha + destinationAlpha * (1.0 - sourceAlpha);
	if (destinationAlpha <= 0.0 || (u_blendMode == 0 && sourceAlpha >= 1.0)) {
		outColor = vec4(source.rgb, outputAlpha);
		return;
	}
	if (invalid3(source.rgb) || invalid3(below.rgb)) {
		outColor = vec4(vec3(nanValue()), outputAlpha);
		return;
	}
	vec3 blended = blendValue(below.rgb, source.rgb);
	vec3 color = u_blendMode == 0
		? (source.rgb * sourceAlpha + below.rgb * destinationAlpha * (1.0 - sourceAlpha)) / outputAlpha
		: ((1.0 - sourceAlpha) * destinationAlpha * below.rgb
			+ (1.0 - destinationAlpha) * sourceAlpha * source.rgb
			+ destinationAlpha * sourceAlpha * blended) / outputAlpha;
outColor = vec4(color, outputAlpha);
}`,
  Zh = `#version 300 es
precision highp float;
precision highp int;
precision highp sampler2D;
precision highp usampler2D;
precision highp isampler2D;
uniform sampler2D u_source;
uniform sampler2D u_lut;
uniform sampler2D u_adjustmentMaskFloat;
uniform usampler2D u_adjustmentMaskUint;
uniform isampler2D u_adjustmentMaskInt;
uniform int u_type;
uniform float u_amount;
uniform float u_parameters[45];
uniform int u_flags[8];
uniform int u_hasAdjustmentMask;
uniform int u_adjustmentMaskEncoding;
uniform int u_adjustmentMaskInvert;
uniform ivec2 u_adjustmentOutputSize;
uniform ivec2 u_adjustmentMaskSourceSize;
uniform ivec2 u_adjustmentMaskOffset;
uniform ivec2 u_adjustmentMaskLayerSize;
uniform float u_adjustmentMaskValueScale;
out vec4 outColor;
vec3 sampleLut(vec3 color) {
	vec3 position = clamp(color, 0.0, 1.0) * 255.0;
	ivec3 low = ivec3(floor(position));
	ivec3 high = min(low + ivec3(1), ivec3(255));
	vec3 fraction = position - vec3(low);
	vec3 lowValue = vec3(
		texelFetch(u_lut, ivec2(low.r, 0), 0).r,
		texelFetch(u_lut, ivec2(low.g, 0), 0).g,
		texelFetch(u_lut, ivec2(low.b, 0), 0).b
	);
	vec3 highValue = vec3(
		texelFetch(u_lut, ivec2(high.r, 0), 0).r,
		texelFetch(u_lut, ivec2(high.g, 0), 0).g,
		texelFetch(u_lut, ivec2(high.b, 0), 0).b
	);
	return mix(lowValue, highValue, fraction);
}
vec3 rgbToHsl(vec3 color) {
	float maximum = max(color.r, max(color.g, color.b));
	float minimum = min(color.r, min(color.g, color.b));
	float delta = maximum - minimum;
	float lightness = (maximum + minimum) * 0.5;
	float hue = 0.0;
	if (delta > 0.0) {
		if (maximum == color.r) { hue = mod((color.g - color.b) / delta, 6.0); }
		else if (maximum == color.g) { hue = (color.b - color.r) / delta + 2.0; }
		else { hue = (color.r - color.g) / delta + 4.0; }
		hue = mod(hue * 60.0 + 360.0, 360.0);
	}
	float saturation = delta > 0.0 ? delta / max(1e-6, 1.0 - abs(2.0 * lightness - 1.0)) : 0.0;
	return vec3(hue, saturation, lightness);
}
vec3 hslToRgb(vec3 hsl) {
	float c = (1.0 - abs(2.0 * hsl.z - 1.0)) * hsl.y;
	float section = hsl.x / 60.0;
	float x = c * (1.0 - abs(mod(section, 2.0) - 1.0));
	vec3 rgb = section < 1.0 ? vec3(c, x, 0.0)
		: section < 2.0 ? vec3(x, c, 0.0)
		: section < 3.0 ? vec3(0.0, c, x)
		: section < 4.0 ? vec3(0.0, x, c)
		: section < 5.0 ? vec3(x, 0.0, c)
		: vec3(c, 0.0, x);
	return rgb + vec3(hsl.z - c * 0.5);
}
float luminance(vec3 color) {
	return dot(color, vec3(0.2126, 0.7152, 0.0722));
}
float hueRangeWeight(float hue, float center) {
	float distance = abs(mod(hue - center + 540.0, 360.0) - 180.0);
	return distance <= 30.0 ? 1.0 : distance >= 60.0 ? 0.0 : (60.0 - distance) / 30.0;
}
float configuredHueRangeWeight(float hue, int range, float center) {
	if (u_flags[range + 1] == 0) { return hueRangeWeight(hue, center); }
	int base = 3 + range * 7;
	float a = u_parameters[base], b = u_parameters[base + 1];
	float c = u_parameters[base + 2], d = u_parameters[base + 3];
	while (b < a) { b += 360.0; }
	while (c < b) { c += 360.0; }
	while (d < c) { d += 360.0; }
	float weight = 0.0;
	for (int turn = -1; turn <= 2; turn++) {
		float candidate = hue + float(turn) * 360.0;
		if (candidate < a || candidate > d) { continue; }
		float value = candidate < b ? (candidate - a) / max(1e-6, b - a)
			: candidate <= c ? 1.0 : (d - candidate) / max(1e-6, d - c);
		weight = max(weight, value);
	}
	return clamp(weight, 0.0, 1.0);
}
float mixer(vec3 color, int base) {
	return dot(color, vec3(u_parameters[base], u_parameters[base + 1], u_parameters[base + 2])) / 100.0
		+ u_parameters[base + 3] / 100.0;
}
vec3 directAdjustment(vec3 color) {
	vec3 result = color;
	if (u_type == 2) {
		float brightness = u_parameters[0] / 100.0;
		float contrast = clamp(u_parameters[1] / 100.0, -0.99, 0.99);
		float factor = (1.0 + contrast) / (1.0 - contrast);
		result = (result - vec3(0.5)) * factor + vec3(0.5 + brightness);
	} else if (u_type == 3) {
		float multiplier = exp2(u_parameters[0]);
		result = pow(max(vec3(0.0), result * multiplier + vec3(u_parameters[1])), vec3(1.0 / max(0.01, u_parameters[2])));
	} else if (u_type == 4) {
		result = vec3(1.0) - result;
	} else if (u_type == 5) {
		if (u_flags[0] == 1) { result = vec3(mixer(result, 12)); }
		else { result = vec3(mixer(result, 0), mixer(result, 4), mixer(result, 8)); }
	} else if (u_type == 6) {
		float originalLightness = rgbToHsl(result).z;
		float light = luminance(result);
		vec3 weights = vec3(clamp((0.5 - light) * 2.0, 0.0, 1.0), 1.0 - abs(light - 0.5) * 2.0, clamp((light - 0.5) * 2.0, 0.0, 1.0));
		for (int range = 0; range < 3; range++) {
			int base = range * 3;
			result += vec3(u_parameters[base], u_parameters[base + 1], u_parameters[base + 2]) / 100.0 * weights[range];
		}
		if (u_flags[0] == 1) {
			vec3 hsl = rgbToHsl(clamp(result, 0.0, 1.0));
			result = hslToRgb(vec3(hsl.xy, originalLightness));
		}
	} else if (u_type == 7) {
		vec3 hsl = rgbToHsl(result);
		float weighted = 0.0, total = 0.0;
		for (int range = 0; range < 6; range++) {
			float weight = hueRangeWeight(hsl.x, float(range) * 60.0);
			weighted += u_parameters[range] * weight;
			total += weight;
		}
		float gray = luminance(result) + (((total > 0.0 ? weighted / total : 50.0) - 50.0) / 100.0) * hsl.y * 0.5;
		result = vec3(gray);
	} else if (u_type == 8) {
		result = vec3(luminance(result) * 255.0 >= u_parameters[0] ? 1.0 : 0.0);
	} else if (u_type == 9) {
		float levels = clamp(floor(u_parameters[0] + 0.5), 2.0, 255.0);
		result = floor(result * (levels - 1.0) + 0.5) / (levels - 1.0);
	} else if (u_type == 10) {
		float position = clamp(luminance(result), 0.0, 1.0) * 255.0;
		int low = int(floor(position)), high = min(255, low + 1);
		result = mix(texelFetch(u_lut, ivec2(low, 0), 0).rgb, texelFetch(u_lut, ivec2(high, 0), 0).rgb, position - float(low));
	}
	return clamp(result, 0.0, 1.0);
}
float adjustmentMaskFactor(ivec2 outputPixel) {
	if (u_hasAdjustmentMask == 0) { return 1.0; }
	int logicalY = u_adjustmentOutputSize.y - 1 - outputPixel.y;
	ivec2 local = ivec2(outputPixel.x - u_adjustmentMaskOffset.x, logicalY - u_adjustmentMaskOffset.y);
	if (local.x < 0 || local.y < 0 || local.x >= u_adjustmentMaskLayerSize.x || local.y >= u_adjustmentMaskLayerSize.y) {
		return u_adjustmentMaskInvert == 1 ? 1.0 : 0.0;
	}
	ivec2 coordinate = ivec2(
		min(u_adjustmentMaskSourceSize.x - 1, int((float(local.x) + 0.5) * float(u_adjustmentMaskSourceSize.x) / float(u_adjustmentMaskLayerSize.x))),
		min(u_adjustmentMaskSourceSize.y - 1, int((float(local.y) + 0.5) * float(u_adjustmentMaskSourceSize.y) / float(u_adjustmentMaskLayerSize.y)))
	);
	vec4 value = u_adjustmentMaskEncoding == 0 ? texelFetch(u_adjustmentMaskFloat, coordinate, 0)
		: u_adjustmentMaskEncoding == 1 ? vec4(texelFetch(u_adjustmentMaskUint, coordinate, 0))
		: vec4(texelFetch(u_adjustmentMaskInt, coordinate, 0));
	float factor = isnan(value.r) || isinf(value.r) ? 0.0 : clamp(value.r * u_adjustmentMaskValueScale, 0.0, 1.0);
	return u_adjustmentMaskInvert == 1 ? 1.0 - factor : factor;
}
void main() {
	ivec2 pixel = ivec2(gl_FragCoord.xy);
	vec4 source = texelFetch(u_source, pixel, 0);
	if (source.a <= 0.0 || any(isnan(source.rgb)) || any(isinf(source.rgb))) {
		outColor = source;
		return;
	}
	vec3 adjusted;
	if (u_type == 0) {
		adjusted = sampleLut(source.rgb);
	} else if (u_type == 1) {
		vec3 hsl = rgbToHsl(clamp(source.rgb, 0.0, 1.0));
		if (u_flags[0] == 1) {
			hsl.x = mod(u_parameters[0] + 360.0, 360.0);
			hsl.y = clamp(u_parameters[1], 0.0, 1.0);
			float delta = clamp(u_parameters[2], -1.0, 1.0);
			hsl.z = delta < 0.0 ? hsl.z * (1.0 + delta) : hsl.z + (1.0 - hsl.z) * delta;
		} else {
			float sourceHue = hsl.x;
			hsl.x = mod(hsl.x + u_parameters[0] + 360.0, 360.0);
			hsl.y = clamp(hsl.y + u_parameters[1] / 100.0, 0.0, 1.0);
			hsl.z = clamp(hsl.z + u_parameters[2] / 100.0, 0.0, 1.0);
			for (int range = 0; range < 6; range++) {
				int base = 3 + range * 7;
				float weight = configuredHueRangeWeight(sourceHue, range, float(range) * 60.0);
				hsl.x = mod(hsl.x + u_parameters[base + 4] * weight + 360.0, 360.0);
				hsl.y = clamp(hsl.y + u_parameters[base + 5] / 100.0 * weight, 0.0, 1.0);
				hsl.z = clamp(hsl.z + u_parameters[base + 6] / 100.0 * weight, 0.0, 1.0);
			}
		}
		adjusted = hslToRgb(hsl);
	} else {
		adjusted = directAdjustment(source.rgb);
	}
	float amount = u_amount * adjustmentMaskFactor(pixel);
	outColor = vec4(mix(source.rgb, adjusted, amount), source.a);
}`,
  Qh = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D u_composite;
uniform sampler2D u_displayColormap;
uniform ivec2 u_outputSize;
uniform float u_min;
uniform float u_inverseRange;
uniform float u_gammaIn;
uniform float u_gammaOut;
uniform float u_exposure;
uniform vec3 u_nanColor;
uniform int u_useDisplayColormap;
uniform int u_rgb24;
uniform float u_rgb24Maximum;
uniform float u_rgb24Divisor;
uniform float u_rgb24Min;
uniform float u_rgb24InverseRange;
out vec4 outColor;
void main() {
	ivec2 outputPixel = ivec2(gl_FragCoord.xy);
	ivec2 compositePixel = outputPixel;
	vec4 value = texelFetch(u_composite, compositePixel, 0);
	if (value.a <= 0.0) { outColor = vec4(0.0); return; }
	if (any(isnan(value.rgb)) || any(isinf(value.rgb))) { outColor = vec4(u_nanColor, 1.0); return; }
	if (u_rgb24 == 1) {
		vec3 raw = value.rgb * u_rgb24Maximum;
		vec3 bytes = floor(clamp(raw / u_rgb24Divisor, 0.0, 255.0) + 0.5);
		float packed = bytes.r * 65536.0 + bytes.g * 256.0 + bytes.b;
		float gray = clamp((packed - u_rgb24Min) * u_rgb24InverseRange, 0.0, 1.0);
		gray = pow(gray, max(0.0001, u_gammaIn));
		gray *= exp2(u_exposure);
		gray = pow(max(gray, 0.0), 1.0 / max(0.0001, u_gammaOut));
		outColor = vec4(vec3(clamp(gray, 0.0, 1.0)), value.a);
		return;
	}
	vec3 normalized = clamp((value.rgb - vec3(u_min)) * u_inverseRange, 0.0, 1.0);
	normalized = pow(max(normalized, vec3(0.0)), vec3(max(0.0001, u_gammaIn)));
	normalized *= exp2(u_exposure);
	normalized = pow(max(normalized, vec3(0.0)), vec3(1.0 / max(0.0001, u_gammaOut)));
	if (u_useDisplayColormap == 1) {
		outColor = vec4(texture(u_displayColormap, vec2(normalized.r, 0.5)).rgb, value.a);
		return;
	}
	outColor = vec4(clamp(normalized, 0.0, 1.0), value.a);
}`,
  em = `#version 300 es
precision highp float;
precision highp int;
uniform sampler2D u_reduceSource;
uniform ivec2 u_reduceSourceSize;
uniform int u_reduceFirstPass;
out vec2 outRange;
void main() {
	ivec2 destination = ivec2(gl_FragCoord.xy);
	ivec2 origin = destination * 2;
	float minimum = 3.402823466e+38;
	float maximum = -3.402823466e+38;
	for (int y = 0; y < 2; y++) for (int x = 0; x < 2; x++) {
		ivec2 coordinate = origin + ivec2(x, y);
		if (coordinate.x >= u_reduceSourceSize.x || coordinate.y >= u_reduceSourceSize.y) { continue; }
		vec4 value = texelFetch(u_reduceSource, coordinate, 0);
		if (u_reduceFirstPass == 1) {
			if (value.a <= 0.0) { continue; }
			for (int channel = 0; channel < 3; channel++) {
				float sampleValue = value[channel];
				if (isnan(sampleValue) || isinf(sampleValue)) { continue; }
				minimum = min(minimum, sampleValue);
				maximum = max(maximum, sampleValue);
			}
		} else {
			if (value.r <= value.g) {
				minimum = min(minimum, value.r);
				maximum = max(maximum, value.g);
			}
		}
	}
	outRange = vec2(minimum, maximum);
}`;
var Qe = {
    COPY_SRC: 1,
    COPY_DST: 2,
    TEXTURE_BINDING: 4,
    STORAGE_BINDING: 8,
    RENDER_ATTACHMENT: 16,
  },
  fn = { MAP_READ: 1, COPY_DST: 8, UNIFORM: 64, STORAGE: 128 },
  Ws = 1,
  tr = new Map([
    ['normal', 0],
    ['multiply', 1],
    ['screen', 2],
    ['overlay', 3],
    ['darken', 4],
    ['lighten', 5],
    ['difference', 6],
    ['exclusion', 7],
    ['add', 8],
    ['subtract', 9],
    ['raw-difference', 10],
    ['raw-multiply', 11],
    ['divide', 12],
    ['min', 13],
    ['max', 14],
    ['average', 15],
    ['mask', 16],
  ]),
  tm = new Set([
    'levels',
    'curves',
    'hue/saturation',
    'brightness/contrast',
    'exposure',
    'invert',
    'channel mixer',
    'color balance',
    'black & white',
    'threshold',
    'posterize',
    'gradient map',
  ]),
  ir = class ir {
    constructor() {
      this.canvas = null;
      this.context = null;
      this.adapter = null;
      this.device = null;
      this.canvasFormat = 'bgra8unorm';
      this.initPromise = null;
      this.blendPipeline = null;
      this.blendFloatPipeline = null;
      this.blendBytePipeline = null;
      this.adjustmentPipeline = null;
      this.adjustmentFloatPipeline = null;
      this.adjustmentBytePipeline = null;
      this.displayPipeline = null;
      this.reductionPipeline = null;
      this.textureCache = new WeakMap();
      this.textureEntries = new Set();
      this.ownedTextures = new Set();
      this.surfaces = [];
      this.surfaceKey = '';
      this.surfaceCache = new Map();
      this.currentSurfaceEntry = null;
      this.outputUsesFloat = !0;
      this.dummyTexture = null;
      this.colormapTexture = null;
      this.colormapName = 'none';
      this.renderQueue = Promise.resolve();
      this.activeTiming = null;
      this.objectIds = new WeakMap();
      this.nextObjectId = 1;
      this.generation = 0;
      this.logger = e => console.warn(e);
    }
    setLogger(e) {
      this.logger = e;
    }
    retry() {
      this.device || (this.initPromise = null);
    }
    async isAvailable() {
      try {
        return (await this.ensureDevice(), !0);
      } catch {
        return !1;
      }
    }
    pendingUpload(e) {
      let t = new Set(),
        n = 0,
        i = (a, r, s, o, h) => {
          if (!a || !this.isPixels(a) || t.has(a)) return;
          let u = this.textureCache.get(a);
          if (u && u.width === r && u.height === s && u.channels === o && u.typeMax === h) return;
          t.add(a);
          let d = a instanceof Uint8Array || a instanceof Uint8ClampedArray;
          n += r * s * (d ? 4 : 16);
        };
      for (let a of e)
        (i(a.data, a.width, a.height, a.channels, a.typeMax || 1),
          a.rasterMask &&
            i(
              a.rasterMask.data,
              a.rasterMask.width,
              a.rasterMask.height,
              Math.max(1, a.rasterMask.channels || 1),
              a.rasterMask.typeMax || 1
            ));
      return { count: t.size, bytes: n };
    }
    unsupportedReason(e, t, n, i) {
      if (t.gpuAcceleration === !1) return 'GPU acceleration is disabled in the image settings';
      if (n <= 0 || i <= 0) return `the document size ${n}\xD7${i} is invalid`;
      if (!navigator.gpu) return 'WebGPU is unavailable in this webview';
      for (let a of e) {
        let r = a.name || a.id || 'unnamed layer';
        if (a.rasterMask && !this.isPixels(a.rasterMask.data))
          return `"${r}" uses unsupported mask storage`;
        if (a.kind === 'group') {
          if (!a.id) return `"${r}" is a group without an id`;
          if (!tr.has(a.blendMode || 'normal')) return `"${r}" uses an unsupported blend mode`;
          continue;
        }
        if (a.kind === 'adjustment') {
          if (!a.adjustment || !tm.has(a.adjustment.type))
            return `"${r}" uses an unsupported adjustment`;
          continue;
        }
        if (a.kind && a.kind !== 'raster') return `"${r}" is an unsupported ${a.kind} node`;
        if (a.channels < 1 || a.channels > 4) return `"${r}" has ${a.channels} channels`;
        if (a.data && !this.isPixels(a.data)) return `"${r}" uses unsupported pixel storage`;
        if (!tr.has(a.blendMode || 'normal'))
          return `"${r}" uses unsupported blend mode "${a.blendMode}"`;
      }
      return null;
    }
    render(e, t, n, i, a, r, s = !1) {
      return this.renderWithMetrics(e, t, n, i, a, r, s).then(o => o.canvas);
    }
    renderWithMetrics(e, t, n, i, a, r, s = !1) {
      let o = this.snapshotLayers(e),
        h = this.snapshotSettings(a),
        u = { ...r },
        d = this.generation,
        m = {
          requestedAt: performance.now(),
          startedAt: 0,
          queueMs: 0,
          initializationMs: 0,
          prepareMs: 0,
          encodeMs: 0,
          gpuMs: 0,
          validationMs: 0,
          renderMs: 0,
          uploadCount: 0,
          uploadBytes: 0,
          uploadCpuMs: 0,
          surfaceAllocationBytes: 0,
          surfaceCacheHit: !1,
          compositionCacheHit: !1,
        },
        p = this.renderQueue.then(async () => {
          if (d !== this.generation)
            throw new Error('WebGPU render cancelled because the compositor was reset');
          ((m.startedAt = performance.now()),
            (m.queueMs = m.startedAt - m.requestedAt),
            (this.activeTiming = m));
          try {
            let v = await this.renderNow(o, t, n, i, h, u, s);
            return ((m.renderMs = performance.now() - m.startedAt), { canvas: v, timing: m });
          } finally {
            this.activeTiming = null;
          }
        });
      return (
        (this.renderQueue = p.then(
          () => {},
          () => {}
        )),
        p
      );
    }
    snapshotLayers(e) {
      return e.map(t => ({
        ...t,
        adjustment: t.adjustment ? JSON.parse(JSON.stringify(t.adjustment)) : void 0,
        maskCondition: t.maskCondition ? { ...t.maskCondition } : void 0,
        rasterMask: t.rasterMask ? { ...t.rasterMask } : void 0,
        groupPath: t.groupPath ? [...t.groupPath] : void 0,
        groupIds: t.groupIds ? [...t.groupIds] : void 0,
      }));
    }
    snapshotSettings(e) {
      return {
        ...e,
        normalization: e.normalization ? { ...e.normalization } : void 0,
        gamma: e.gamma ? { ...e.gamma } : void 0,
        brightness: e.brightness ? { ...e.brightness } : void 0,
      };
    }
    async renderNow(e, t, n, i, a, r, s) {
      let o = this.unsupportedReason(e, a, t, n);
      if (o) {
        let u = new Error(`WebGPU compositor cannot render this document: ${o}`);
        if (s) throw u;
        return null;
      }
      let h = !1;
      try {
        let u = performance.now();
        (await this.ensureDevice(),
          this.device.pushErrorScope('out-of-memory'),
          this.device.pushErrorScope('validation'),
          (h = !0),
          this.activeTiming && (this.activeTiming.initializationMs = performance.now() - u));
        let d = performance.now(),
          m = Math.max(1, Math.round(t * i)),
          p = Math.max(1, Math.round(n * i)),
          v = Number(this.device.limits.maxTextureDimension2D || 0);
        if (m > v || p > v)
          throw new Error(`document surface ${m}\xD7${p} exceeds maxTextureDimension2D ${v}`);
        for (let G of e)
          if (G.data && (G.width > v || G.height > v))
            throw new Error(`layer "${G.name || G.id}" exceeds maxTextureDimension2D ${v}`);
        let g = this.foldGroupOffsets(e);
        this.pruneTextureCache(
          new Set(
            g.flatMap(G => [
              ...(G.data && this.isPixels(G.data) ? [G.data] : []),
              ...(G.rasterMask?.data && this.isPixels(G.rasterMask.data)
                ? [G.rasterMask.data]
                : []),
            ])
          )
        );
        let w = new Map(g.filter(G => G.kind === 'group' && G.id).map(G => [G.id, G])),
          k = 0;
        for (let G of g) {
          let re = 0,
            ee = G.parentId,
            ye = new Set();
          for (; ee && !ye.has(ee);) {
            ye.add(ee);
            let ve = w.get(ee);
            if (!ve) break;
            (re++, (ee = ve.parentId));
          }
          k = Math.max(k, re);
        }
        let E =
            g.some(G =>
              [
                'add',
                'subtract',
                'raw-difference',
                'raw-multiply',
                'divide',
                'min',
                'max',
                'average',
              ].includes(G.blendMode || '')
            ) ||
            g.some(
              G =>
                G.data &&
                (!(G.data instanceof Uint8Array || G.data instanceof Uint8ClampedArray) ||
                  (G.typeMax || 255) !== 255)
            ),
          L = g.some(G => G.kind === 'group' || G.clipped === !0);
        (this.ensureSurfaces(m, p, (k + 1) * 2 + (L ? 3 : 0), E),
          (this.blendPipeline = E ? this.blendFloatPipeline : this.blendBytePipeline),
          (this.adjustmentPipeline = E
            ? this.adjustmentFloatPipeline
            : this.adjustmentBytePipeline));
        let M = g.find(G => G.visible !== !1 && (G.opacity ?? 1) > 0 && G.data)?.typeMax || 1,
          T = this.compositionSignature(g);
        this.activeTiming && (this.activeTiming.prepareMs = performance.now() - d);
        let _ = performance.now(),
          I = this.device.createCommandEncoder({ label: 'Layer compositor' }),
          A = [],
          N;
        if (
          this.currentSurfaceEntry?.compositionSignature === T &&
          this.currentSurfaceEntry.finalSurface !== void 0
        )
          ((N = this.currentSurfaceEntry.finalSurface),
            this.activeTiming && (this.activeTiming.compositionCacheHit = !0));
        else {
          for (let G = 0; G <= k; G++) this.clearTexture(I, this.surfaces[G * 2]);
          ((N = this.drawStack(I, A, g, m, p, i, M, void 0, 0, new Set())),
            this.currentSurfaceEntry &&
              ((this.currentSurfaceEntry.compositionSignature = T),
              (this.currentSurfaceEntry.finalSurface = N)));
        }
        let z;
        if (a.normalization?.autoNormalize) {
          let G = this.encodeAutoRange(I, N, m, p, A);
          this.activeTiming && (this.activeTiming.encodeMs += performance.now() - _);
          let re = performance.now();
          (this.device.queue.submit([I.finish()]),
            (z = await this.readAutoRange(G)),
            this.activeTiming && (this.activeTiming.gpuMs += performance.now() - re),
            (I = this.device.createCommandEncoder({ label: 'Layer display' })),
            (_ = performance.now()));
        }
        let X = this.drawDisplay(I, A, N, m, p, a, r, M, e, z),
          ae = s && i === 1 ? this.encodeDisplaySamples(I, X, m, p) : null,
          Q = s && i === 1 ? this.encodeValidation(I, N, t, n) : null;
        this.activeTiming && (this.activeTiming.encodeMs += performance.now() - _);
        let j = performance.now();
        (this.device.queue.submit([I.finish()]),
          await this.device.queue.onSubmittedWorkDone(),
          this.activeTiming && (this.activeTiming.gpuMs += performance.now() - j),
          (h = !1));
        let q = await this.device.popErrorScope(),
          oe = await this.device.popErrorScope(),
          U = q || oe;
        if (U) throw new Error(`WebGPU render failed: ${U.message || U}`);
        let Z = performance.now();
        (Q && (await this.validateSamples(Q, e, t, n)),
          ae && (await this.validateDisplaySamples(ae, e, t, n, a, r, M, z)),
          this.activeTiming && (this.activeTiming.validationMs = performance.now() - Z));
        for (let G of A) G.destroy();
        return this.canvas;
      } catch (u) {
        if (
          (this.logger(
            `[LayerCompositor] WebGPU failed: ${u instanceof Error ? u.message : String(u)}`
          ),
          s)
        )
          throw u;
        return null;
      } finally {
        if (h && this.device) {
          h = !1;
          try {
            (await this.device.popErrorScope(), await this.device.popErrorScope());
          } catch {}
        }
      }
    }
    dispose() {
      this.generation++;
      for (let e of this.ownedTextures)
        try {
          e.destroy();
        } catch {}
      (this.ownedTextures.clear(),
        (this.textureCache = new WeakMap()),
        this.textureEntries.clear(),
        (this.surfaces = []),
        (this.surfaceKey = ''),
        this.surfaceCache.clear(),
        (this.currentSurfaceEntry = null),
        (this.dummyTexture = null),
        (this.colormapTexture = null),
        (this.colormapName = 'none'));
      try {
        this.device?.destroy();
      } catch {}
      ((this.device = null),
        (this.adapter = null),
        (this.context = null),
        (this.canvas = null),
        (this.initPromise = null),
        (this.blendPipeline = null),
        (this.blendFloatPipeline = null),
        (this.blendBytePipeline = null),
        (this.adjustmentPipeline = null),
        (this.adjustmentFloatPipeline = null),
        (this.adjustmentBytePipeline = null),
        (this.displayPipeline = null),
        (this.reductionPipeline = null),
        (this.objectIds = new WeakMap()),
        (this.nextObjectId = 1));
    }
    async ensureDevice() {
      if (!this.device) {
        if (this.initPromise) return this.initPromise;
        this.initPromise = (async () => {
          let e = navigator.gpu;
          if (!e) throw new Error('navigator.gpu is unavailable');
          let t = await e.requestAdapter({ powerPreference: 'high-performance' });
          if (!t) throw new Error('No WebGPU adapter is available');
          let n = await t.requestDevice(),
            i = document.createElement('canvas'),
            a = i.getContext('webgpu');
          if (!a) throw new Error('Could not create a WebGPU canvas context');
          let r = e.getPreferredCanvasFormat();
          (a.configure({
            device: n,
            format: r,
            alphaMode: 'premultiplied',
            usage: Qe.RENDER_ATTACHMENT | Qe.COPY_SRC,
          }),
            n.lost.then(d => {
              this.device === n &&
                (this.logger(
                  `[LayerCompositor] WebGPU device lost: ${d?.message || d?.reason || 'unknown reason'}`
                ),
                this.dispose());
            }),
            n.addEventListener?.('uncapturederror', d =>
              this.logger(
                `[LayerCompositor] WebGPU validation error: ${d.error?.message || d.error}`
              )
            ),
            (this.adapter = t),
            (this.device = n),
            (this.canvas = i),
            (this.context = a),
            (this.canvasFormat = r));
          let [s, o, h, u] = await Promise.all([
            this.createPipelines(nm, 'blend', ['rgba16float', 'rgba8unorm']),
            this.createPipelines(im, 'adjustment', ['rgba16float', 'rgba8unorm']),
            this.createPipeline(am, 'display', r),
            this.createReductionPipeline(),
          ]);
          (([this.blendFloatPipeline, this.blendBytePipeline] = s),
            ([this.adjustmentFloatPipeline, this.adjustmentBytePipeline] = o),
            (this.blendPipeline = this.blendFloatPipeline),
            (this.adjustmentPipeline = this.adjustmentFloatPipeline),
            (this.displayPipeline = h),
            (this.reductionPipeline = u),
            (this.dummyTexture = this.createTexture(
              1,
              1,
              'rgba8unorm',
              Qe.TEXTURE_BINDING | Qe.COPY_DST
            )),
            n.queue.writeTexture(
              { texture: this.dummyTexture },
              new Uint8Array([0, 0, 0, 0]),
              { bytesPerRow: 4, rowsPerImage: 1 },
              { width: 1, height: 1 }
            ));
        })();
        try {
          await this.initPromise;
        } catch (e) {
          throw ((this.initPromise = null), e);
        }
      }
    }
    async createPipeline(e, t, n) {
      return (await this.createPipelines(e, t, [n]))[0];
    }
    async createPipelines(e, t, n) {
      let i = this.device.createShaderModule({ code: e, label: `Layer ${t} shader` }),
        r = (await i.getCompilationInfo()).messages.filter(s => s.type === 'error');
      if (r.length)
        throw new Error(
          `${t} WGSL failed: ${r.map(s => `${s.lineNum}:${s.linePos} ${s.message}`).join('; ')}`
        );
      return Promise.all(
        n.map(s =>
          this.device.createRenderPipelineAsync({
            label: `Layer ${t} ${s} pipeline`,
            layout: 'auto',
            vertex: { module: i, entryPoint: 'vertexMain' },
            fragment: { module: i, entryPoint: t, targets: [{ format: s }] },
            primitive: { topology: 'triangle-list' },
          })
        )
      );
    }
    async createReductionPipeline() {
      let e = this.device.createShaderModule({ code: rm, label: 'Layer reduction shader' }),
        n = (await e.getCompilationInfo()).messages.filter(i => i.type === 'error');
      if (n.length) throw new Error(`reduction WGSL failed: ${n.map(i => i.message).join('; ')}`);
      return this.device.createComputePipelineAsync({
        label: 'Layer auto-normalization pipeline',
        layout: 'auto',
        compute: { module: e, entryPoint: 'reduce' },
      });
    }
    createTexture(e, t, n, i) {
      let a = ir.BYTES_PER_PIXEL[n] ?? 16,
        r = e * t * a,
        s = Number(this.device.limits?.maxBufferSize || 0);
      if (s > 0 && r > s)
        throw new Error(
          `texture ${e}\xD7${t} ${n} needs ${(r / 1048576).toFixed(0)} MB, over this device's ${(s / 1048576).toFixed(0)} MB budget (tiled upload for large images is not implemented yet)`
        );
      let o = this.device.createTexture({ size: { width: e, height: t }, format: n, usage: i });
      return (this.ownedTextures.add(o), o);
    }
    ensureSurfaces(e, t, n, i) {
      let a = `${e}x${t}:${n}:${i ? 'float' : 'byte'}`;
      if (this.surfaceKey === a && this.surfaces.length === n) {
        this.activeTiming && (this.activeTiming.surfaceCacheHit = !0);
        return;
      }
      let r = this.surfaceCache.get(a);
      if (r) {
        (this.surfaceCache.delete(a),
          this.surfaceCache.set(a, r),
          (this.surfaces = r.textures),
          (this.currentSurfaceEntry = r),
          (this.outputUsesFloat = r.usesFloat),
          (this.surfaceKey = a),
          this.activeTiming && (this.activeTiming.surfaceCacheHit = !0),
          this.canvas && ((this.canvas.width = e), (this.canvas.height = t)));
        return;
      }
      this.surfaces = Array.from({ length: n }, () =>
        this.createTexture(
          e,
          t,
          i ? 'rgba16float' : 'rgba8unorm',
          Qe.TEXTURE_BINDING | Qe.RENDER_ATTACHMENT | Qe.COPY_SRC | Qe.COPY_DST
        )
      );
      let s = { textures: this.surfaces, usesFloat: i };
      for (
        this.surfaceCache.set(a, s),
          this.currentSurfaceEntry = s,
          this.activeTiming &&
            (this.activeTiming.surfaceAllocationBytes = e * t * 4 * (i ? 2 : 1) * n);
        this.surfaceCache.size > 2;
      ) {
        let o = this.surfaceCache.keys().next().value;
        if (!o || o === a) break;
        let h = this.surfaceCache.get(o);
        if (h) for (let u of h.textures) (u.destroy(), this.ownedTextures.delete(u));
        this.surfaceCache.delete(o);
      }
      ((this.surfaceKey = a),
        (this.outputUsesFloat = i),
        this.canvas && ((this.canvas.width = e), (this.canvas.height = t)));
    }
    clearTexture(e, t) {
      e.beginRenderPass({
        colorAttachments: [
          {
            view: t.createView(),
            loadOp: 'clear',
            storeOp: 'store',
            clearValue: { r: 0, g: 0, b: 0, a: 0 },
          },
        ],
      }).end();
    }
    drawStack(e, t, n, i, a, r, s, o, h, u) {
      let d = h * 2,
        m = d + 1,
        p = d,
        v = n.filter(g => (g.parentId || void 0) === o);
      for (let g = 0; g < v.length;) {
        let w = v[g],
          k = g + 1;
        for (; k < v.length && v[k].clipped;) k++;
        let E = v.slice(g + 1, k);
        if (w.visible === !1 || (w.opacity ?? 1) <= 0) {
          g = k;
          continue;
        }
        if (w.kind === 'adjustment' && w.adjustment) {
          let L = p === d ? m : d;
          (this.drawAdjustment(e, t, w, p, L, i, a, r), (p = L), (g = k));
          continue;
        }
        if (w.kind === 'group') {
          let L = w.id || '';
          if (!L || u.has(L)) {
            g = k;
            continue;
          }
          let M = new Set(u);
          M.add(L);
          let T = this.drawStack(e, t, n, i, a, r, s, L, h + 1, M);
          ((p = this.drawIsolatedSurfaceStack(e, t, w, E, T, p, d, m, i, a, r, s)), (g = k));
          continue;
        }
        if (!w.data) {
          g = k;
          continue;
        }
        if (E.length) {
          let L = this.surfaces.length - 3,
            M = L + 1,
            T = L + 2;
          (this.clearTexture(e, this.surfaces[M]),
            this.drawLayer(e, t, w, M, L, i, a, r, s, { opacity: 1, blendMode: 'normal' }),
            e.copyTextureToTexture(
              { texture: this.surfaces[L] },
              { texture: this.surfaces[T] },
              { width: i, height: a }
            ));
          let _ = L;
          for (let A of E) {
            if (A.visible === !1 || (A.opacity ?? 1) <= 0) continue;
            let N = _ === L ? M : L;
            if (A.kind === 'adjustment' && A.adjustment)
              this.drawAdjustment(e, t, A, _, N, i, a, r);
            else if (A.data)
              this.drawLayer(e, t, A, _, N, i, a, r, s, { clipTexture: this.surfaces[T] });
            else continue;
            _ = N;
          }
          let I = p === d ? m : d;
          (this.drawSurface(
            e,
            t,
            this.surfaces[_],
            p,
            I,
            i,
            a,
            w.opacity ?? 1,
            w.blendMode || 'normal',
            s
          ),
            (p = I));
        } else {
          let L = p === d ? m : d;
          (this.drawLayer(e, t, w, p, L, i, a, r, s), (p = L));
        }
        g = k;
      }
      return p;
    }
    drawIsolatedSurfaceStack(e, t, n, i, a, r, s, o, h, u, d, m) {
      let p = this.surfaces.length - 3,
        v = p + 1,
        g = p + 2;
      (this.clearTexture(e, this.surfaces[v]),
        this.drawSurface(e, t, this.surfaces[a], v, p, h, u, 1, 'normal', m),
        e.copyTextureToTexture(
          { texture: this.surfaces[p] },
          { texture: this.surfaces[g] },
          { width: h, height: u }
        ));
      let w = p;
      for (let E of i) {
        if (E.visible === !1 || (E.opacity ?? 1) <= 0) continue;
        let L = w === p ? v : p;
        if (E.kind === 'adjustment' && E.adjustment) this.drawAdjustment(e, t, E, w, L, h, u, d);
        else if (E.data)
          this.drawLayer(e, t, E, w, L, h, u, d, m, { clipTexture: this.surfaces[g] });
        else continue;
        w = L;
      }
      let k = r === s ? o : s;
      return (
        this.drawSurface(
          e,
          t,
          this.surfaces[w],
          r,
          k,
          h,
          u,
          n.opacity ?? 1,
          n.blendMode || 'normal',
          m,
          n,
          d
        ),
        k
      );
    }
    drawLayer(e, t, n, i, a, r, s, o, h, u = {}) {
      let d = this.textureFor(n.data, n.width, n.height, n.channels, n.typeMax || 1),
        m = n.rasterMask
          ? this.textureFor(
              n.rasterMask.data,
              n.rasterMask.width,
              n.rasterMask.height,
              Math.max(1, n.rasterMask.channels || 1),
              n.rasterMask.typeMax || 1
            )
          : null,
        p = new Float32Array(32);
      (p.set([
        r,
        s,
        d.width,
        d.height,
        Math.round((n.offsetX || 0) * o),
        Math.round((n.offsetY || 0) * o),
        Math.max(1, Math.round(n.width * o)),
        Math.max(1, Math.round(n.height * o)),
        m ? 1 : 0,
        n.rasterMask?.width || 1,
        n.rasterMask?.height || 1,
        Math.round((n.rasterMask?.offsetX ?? n.offsetX ?? 0) * o),
        Math.round((n.rasterMask?.offsetY ?? n.offsetY ?? 0) * o),
        Math.max(1, Math.round((n.rasterMask?.width || 1) * o)),
        Math.max(1, Math.round((n.rasterMask?.height || 1) * o)),
        n.rasterMask?.invert ? 1 : 0,
        u.clipTexture ? 1 : 0,
        tr.get(u.blendMode || n.blendMode || 'normal') || 0,
        Math.max(0, Math.min(1, u.opacity ?? n.opacity ?? 1)),
        ['gt', 'ge', 'lt', 'le', 'eq', 'isfinite', 'isnan'].indexOf(n.maskCondition?.op || '') + 1,
        (n.maskCondition?.threshold || 0) / (n.typeMax || h),
        h,
        d.shaderChannels,
      ]),
        this.runBlend(
          e,
          t,
          this.surfaces[i],
          d.texture,
          m?.texture || this.dummyTexture,
          u.clipTexture || this.dummyTexture,
          this.surfaces[a],
          p
        ));
    }
    drawSurface(e, t, n, i, a, r, s, o, h, u, d, m = 1) {
      let p = d?.rasterMask
          ? this.textureFor(
              d.rasterMask.data,
              d.rasterMask.width,
              d.rasterMask.height,
              Math.max(1, d.rasterMask.channels || 1),
              d.rasterMask.typeMax || 1
            )
          : null,
        v = new Float32Array(32);
      (v.set([
        r,
        s,
        r,
        s,
        0,
        0,
        r,
        s,
        p ? 1 : 0,
        d?.rasterMask?.width || 1,
        d?.rasterMask?.height || 1,
        Math.round((d?.rasterMask?.offsetX ?? 0) * m),
        Math.round((d?.rasterMask?.offsetY ?? 0) * m),
        Math.max(1, Math.round((d?.rasterMask?.width || 1) * m)),
        Math.max(1, Math.round((d?.rasterMask?.height || 1) * m)),
        d?.rasterMask?.invert ? 1 : 0,
        0,
        tr.get(h) || 0,
        Math.max(0, Math.min(1, o)),
        0,
        0,
        u,
      ]),
        this.runBlend(
          e,
          t,
          this.surfaces[i],
          n,
          p?.texture || this.dummyTexture,
          this.dummyTexture,
          this.surfaces[a],
          v
        ));
    }
    foldGroupOffsets(e) {
      let t = new Map(e.filter(i => i.kind === 'group' && i.id).map(i => [i.id, i])),
        n = i => {
          let a = i.parentId,
            r = 0,
            s = 0,
            o = new Set();
          for (; a && !o.has(a);) {
            o.add(a);
            let h = t.get(a);
            if (!h) break;
            ((r += h.offsetX || 0), (s += h.offsetY || 0), (a = h.parentId));
          }
          return { x: r, y: s };
        };
      return e.map(i => {
        let a = n(i);
        return i.kind === 'group'
          ? {
              ...i,
              offsetX: 0,
              offsetY: 0,
              rasterMask: i.rasterMask
                ? {
                    ...i.rasterMask,
                    offsetX: (i.rasterMask.offsetX ?? i.offsetX ?? 0) + a.x,
                    offsetY: (i.rasterMask.offsetY ?? i.offsetY ?? 0) + a.y,
                  }
                : void 0,
            }
          : !a.x && !a.y
            ? i
            : {
                ...i,
                offsetX: (i.offsetX || 0) + a.x,
                offsetY: (i.offsetY || 0) + a.y,
                rasterMask: i.rasterMask
                  ? {
                      ...i.rasterMask,
                      offsetX: (i.rasterMask.offsetX ?? i.offsetX ?? 0) + a.x,
                      offsetY: (i.rasterMask.offsetY ?? i.offsetY ?? 0) + a.y,
                    }
                  : void 0,
              };
      });
    }
    runBlend(e, t, n, i, a, r, s, o) {
      let h = this.parameterBuffer(o, t),
        u = this.device.createBindGroup({
          layout: this.blendPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: n.createView() },
            { binding: 1, resource: i.createView() },
            { binding: 2, resource: a.createView() },
            { binding: 3, resource: r.createView() },
            { binding: 4, resource: { buffer: h } },
          ],
        });
      this.renderPass(e, this.blendPipeline, u, s);
    }
    drawAdjustment(e, t, n, i, a, r, s, o) {
      let h = n.adjustment,
        u = n.rasterMask
          ? this.textureFor(
              n.rasterMask.data,
              n.rasterMask.width,
              n.rasterMask.height,
              Math.max(1, n.rasterMask.channels || 1),
              n.rasterMask.typeMax || 1
            )
          : null,
        d = this.adjustmentParameters(h);
      ((d[1] = Math.max(0, Math.min(1, n.opacity ?? 1))),
        d.set(
          [
            u ? 1 : 0,
            n.rasterMask?.width || 1,
            n.rasterMask?.height || 1,
            Math.round((n.rasterMask?.offsetX ?? n.offsetX ?? 0) * o),
            Math.round((n.rasterMask?.offsetY ?? n.offsetY ?? 0) * o),
            Math.max(1, Math.round((n.rasterMask?.width || 1) * o)),
            Math.max(1, Math.round((n.rasterMask?.height || 1) * o)),
            n.rasterMask?.invert ? 1 : 0,
            r,
            s,
          ],
          2
        ));
      let m = this.parameterBuffer(d, t),
        p = this.device.createBindGroup({
          layout: this.adjustmentPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: this.surfaces[i].createView() },
            { binding: 1, resource: (u?.texture || this.dummyTexture).createView() },
            { binding: 2, resource: { buffer: m } },
          ],
        });
      this.renderPass(e, this.adjustmentPipeline, p, this.surfaces[a]);
    }
    adjustmentParameters(e) {
      let t = new Float32Array(896),
        n = ['levels', 'curves'].includes(e.type)
          ? 0
          : e.type === 'hue/saturation'
            ? 1
            : [
                'brightness/contrast',
                'exposure',
                'invert',
                'channel mixer',
                'color balance',
                'black & white',
                'threshold',
                'posterize',
                'gradient map',
              ].indexOf(e.type) + 2;
      t[0] = n;
      let i = t.subarray(32, 77),
        a = t.subarray(80, 88);
      if (e.type === 'levels' || e.type === 'curves')
        this.fillAdjustmentLut(t.subarray(96, 864), e);
      else if (e.type === 'hue/saturation') {
        let r = !!e.colorize && e.colorizeEnabled !== !1;
        if (((a[0] = r ? 1 : 0), r))
          i.set([
            e.colorize.hue || 0,
            (e.colorize.saturation || 0) / 100,
            (e.colorize.lightness || 0) / 100,
          ]);
        else {
          let s = e.master || {};
          i.set([s.hue || 0, s.saturation || 0, s.lightness || 0]);
          for (let o = 0; o < 6; o++) {
            let h = e[['reds', 'yellows', 'greens', 'cyans', 'blues', 'magentas'][o]],
              u = 3 + o * 7;
            ((a[o + 1] = h && ['a', 'b', 'c', 'd'].every(d => Number.isFinite(h[d])) ? 1 : 0),
              i.set(
                [
                  h?.a || 0,
                  h?.b || 0,
                  h?.c || 0,
                  h?.d || 0,
                  h?.hue || 0,
                  h?.saturation || 0,
                  h?.lightness || 0,
                ],
                u
              ));
          }
        }
      } else this.fillDirectParameters(t, e, a);
      return t;
    }
    fillDirectParameters(e, t, n) {
      let i = e.subarray(32, 77),
        a = (r, s) => {
          let o = r || s;
          return [o.red ?? 0, o.green ?? 0, o.blue ?? 0, o.constant ?? 0];
        };
      if (t.type === 'brightness/contrast') i.set([t.brightness || 0, t.contrast || 0]);
      else if (t.type === 'exposure') i.set([t.exposure || 0, t.offset || 0, t.gamma ?? 1]);
      else if (t.type === 'channel mixer')
        ((n[0] = t.monochrome ? 1 : 0),
          i.set([
            ...a(t.red, { red: 100 }),
            ...a(t.green, { green: 100 }),
            ...a(t.blue, { blue: 100 }),
            ...a(t.gray, { red: 40, green: 40, blue: 20 }),
          ]));
      else if (t.type === 'color balance') {
        n[0] = t.preserveLuminosity ? 1 : 0;
        let r = s => [s?.cyanRed || 0, s?.magentaGreen || 0, s?.yellowBlue || 0];
        i.set([...r(t.shadows), ...r(t.midtones), ...r(t.highlights)]);
      } else
        t.type === 'black & white'
          ? i.set([
              t.reds ?? 40,
              t.yellows ?? 60,
              t.greens ?? 40,
              t.cyans ?? 60,
              t.blues ?? 20,
              t.magentas ?? 80,
            ])
          : t.type === 'threshold'
            ? (i[0] = t.level ?? 128)
            : t.type === 'posterize'
              ? (i[0] = t.levels ?? 4)
              : t.type === 'gradient map' && this.fillGradientLut(e.subarray(96, 864), t);
    }
    fillAdjustmentLut(e, t) {
      for (let n = 0; n < 3; n++) {
        let i = ['red', 'green', 'blue'][n];
        for (let a = 0; a < 256; a++)
          e[n * 256 + a] = this.adjustmentCurve(this.adjustmentCurve(a, t.rgb), t[i]) / 255;
      }
    }
    adjustmentCurve(e, t) {
      if (!t) return e;
      if (Array.isArray(t)) return Pn(t, e);
      let n = t.shadowInput ?? 0,
        i = t.highlightInput ?? 255,
        a = Math.max(0, Math.min(1, (e - n) / Math.max(1e-6, i - n)));
      return (
        (t.shadowOutput ?? 0) +
        Math.pow(a, 1 / Math.max(0.01, t.midtoneInput ?? 1)) *
          ((t.highlightOutput ?? 255) - (t.shadowOutput ?? 0))
      );
    }
    fillGradientLut(e, t) {
      let n = [
          { position: 0, color: { r: 0, g: 0, b: 0 } },
          { position: 1, color: { r: 255, g: 255, b: 255 } },
        ],
        i = (t.stops?.length ? t.stops : n)
          .map(a => ({ ...a, position: Math.max(0, Math.min(1, a.position)) }))
          .sort((a, r) => a.position - r.position);
      for (let a = 0; a < 256; a++) {
        let r = t.reverse ? 1 - a / 255 : a / 255,
          s = i[0],
          o = i[0],
          h = 0;
        if (r >= i.at(-1).position) s = o = i.at(-1);
        else
          for (let u = 1; u < i.length; u++)
            if (r <= i[u].position) {
              ((s = i[u - 1]),
                (o = i[u]),
                (h = (r - s.position) / Math.max(1e-6, o.position - s.position)));
              break;
            }
        for (let u = 0; u < 3; u++) {
          let d = ['r', 'g', 'b'][u];
          e[u * 256 + a] = (s.color[d] + (o.color[d] - s.color[d]) * h) / 255;
        }
      }
    }
    renderPass(e, t, n, i, a = 'load') {
      let r = e.beginRenderPass({
        colorAttachments: [
          {
            view: i.createView(),
            loadOp: a,
            storeOp: 'store',
            ...(a === 'clear' ? { clearValue: { r: 0, g: 0, b: 0, a: 0 } } : {}),
          },
        ],
      });
      (r.setPipeline(t), r.setBindGroup(0, n), r.draw(3), r.end());
    }
    parameterBuffer(e, t) {
      let n = Math.max(128, Math.ceil(e.byteLength / 16) * 16),
        i = this.device.createBuffer({ size: n, usage: fn.STORAGE | fn.COPY_DST });
      return (this.device.queue.writeBuffer(i, 0, e), t.push(i), i);
    }
    textureFor(e, t, n, i, a) {
      let r = this.textureCache.get(e);
      if (r && r.width === t && r.height === n && r.channels === i && r.typeMax === a) return r;
      r &&
        (r.texture.destroy(), this.ownedTextures.delete(r.texture), this.textureEntries.delete(r));
      let s = performance.now(),
        o = e instanceof Uint8Array || e instanceof Uint8ClampedArray,
        h = o ? 0 : i === 1 ? 1 : i === 2 ? 2 : 0,
        u = o ? 'rgba8unorm' : h === 1 ? 'r32float' : h === 2 ? 'rg32float' : 'rgba32float',
        d = o || h === 1 ? 4 : h === 2 ? 8 : 16,
        m = this.createTexture(t, n, u, Qe.TEXTURE_BINDING | Qe.COPY_DST);
      if (o) {
        let v = i === 4 && e instanceof Uint8Array ? e : this.expandBytes(e, t, n, i);
        this.device.queue.writeTexture(
          { texture: m },
          v,
          { bytesPerRow: t * 4, rowsPerImage: n },
          { width: t, height: n }
        );
      } else {
        let v = h === 0 ? this.expandFloats(e, t, n, i, a) : this.narrowFloats(e, t, n, i, h, a);
        this.device.queue.writeTexture(
          { texture: m },
          v,
          { bytesPerRow: t * d, rowsPerImage: n },
          { width: t, height: n }
        );
      }
      let p = {
        key: e,
        texture: m,
        width: t,
        height: n,
        channels: i,
        typeMax: a,
        shaderChannels: h,
      };
      return (
        this.textureCache.set(e, p),
        this.textureEntries.add(p),
        this.activeTiming &&
          (this.activeTiming.uploadCount++,
          (this.activeTiming.uploadBytes += t * n * d),
          (this.activeTiming.uploadCpuMs += performance.now() - s)),
        p
      );
    }
    compositionSignature(e) {
      return JSON.stringify(
        e.map(t => ({
          id: t.id,
          kind: t.kind || 'raster',
          parentId: t.parentId,
          adjustment: t.adjustment,
          data: t.data ? this.objectId(t.data) : 0,
          width: t.width,
          height: t.height,
          channels: t.channels,
          isFloat: !!t.isFloat,
          typeMax: t.typeMax,
          offsetX: t.offsetX || 0,
          offsetY: t.offsetY || 0,
          opacity: t.opacity ?? 1,
          blendMode: t.blendMode || 'normal',
          visible: t.visible !== !1,
          clipped: !!t.clipped,
          maskCondition: t.maskCondition,
          rasterMask: t.rasterMask
            ? {
                data: this.objectId(t.rasterMask.data),
                width: t.rasterMask.width,
                height: t.rasterMask.height,
                channels: t.rasterMask.channels,
                typeMax: t.rasterMask.typeMax,
                offsetX: t.rasterMask.offsetX,
                offsetY: t.rasterMask.offsetY,
                invert: !!t.rasterMask.invert,
              }
            : null,
        }))
      );
    }
    objectId(e) {
      let t = this.objectIds.get(e);
      return (t || ((t = this.nextObjectId++), this.objectIds.set(e, t)), t);
    }
    pruneTextureCache(e) {
      for (let t of this.textureEntries)
        e.has(t.key) ||
          (t.texture.destroy(),
          this.ownedTextures.delete(t.texture),
          this.textureEntries.delete(t),
          this.textureCache.delete(t.key));
    }
    expandBytes(e, t, n, i) {
      let a = new Uint8Array(t * n * 4);
      for (let r = 0; r < t * n; r++) {
        let s = r * i,
          o = r * 4,
          h = Number(e[s] || 0);
        ((a[o] = i < 3 ? h : Number(e[s])),
          (a[o + 1] = i < 3 ? h : Number(e[s + 1])),
          (a[o + 2] = i < 3 ? h : Number(e[s + 2])),
          (a[o + 3] = i === 2 ? Number(e[s + 1]) : i === 4 ? Number(e[s + 3]) : 255));
      }
      return a;
    }
    narrowFloats(e, t, n, i, a, r) {
      let s = new Float32Array(t * n * a),
        o = r || 1;
      for (let h = 0; h < t * n; h++) {
        let u = h * i,
          d = h * a;
        ((s[d] = Number(e[u]) / o), a === 2 && (s[d + 1] = Number(e[u + 1]) / o));
      }
      return s;
    }
    expandFloats(e, t, n, i, a) {
      let r = new Float32Array(t * n * 4),
        s = a || 1;
      for (let o = 0; o < t * n; o++) {
        let h = o * i,
          u = o * 4,
          d = Number(e[h]) / s;
        ((r[u] = i < 3 ? d : Number(e[h]) / s),
          (r[u + 1] = i < 3 ? d : Number(e[h + 1]) / s),
          (r[u + 2] = i < 3 ? d : Number(e[h + 2]) / s),
          (r[u + 3] = i === 2 ? Number(e[h + 1]) / s : i === 4 ? Number(e[h + 3]) / s : 1));
      }
      return r;
    }
    drawDisplay(e, t, n, i, a, r, s, o, h, u) {
      let d = this.uploadColormap(r.displayColormap || 'none'),
        m = new Float32Array(24),
        p = u?.[0] ?? (r.normalization?.gammaMode ? 0 : (r.normalization?.min ?? 0) / o),
        v = u?.[1] ?? (r.normalization?.gammaMode ? 1 : (r.normalization?.max ?? o) / o),
        g = r.rgbAs24BitGrayscale === !0 && h.some(L => !!L.data && L.channels >= 3);
      m.set([
        i,
        a,
        p,
        v > p ? 1 / (v - p) : 0,
        r.gamma?.in ?? 1,
        r.gamma?.out ?? 1,
        r.brightness?.offset ?? 0,
        s.r / 255,
        s.g / 255,
        s.b / 255,
        d ? 1 : 0,
        g ? 1 : 0,
        o,
        r.normalization?.min ?? 0,
        (r.normalization?.max ?? 16777215) > (r.normalization?.min ?? 0)
          ? 1 / ((r.normalization?.max ?? 16777215) - (r.normalization?.min ?? 0))
          : 0,
      ]);
      let w = this.parameterBuffer(m, t);
      this.context.configure({
        device: this.device,
        format: this.canvasFormat,
        alphaMode: 'premultiplied',
        usage: Qe.RENDER_ATTACHMENT | Qe.COPY_SRC,
      });
      let k = this.context.getCurrentTexture(),
        E = this.device.createBindGroup({
          layout: this.displayPipeline.getBindGroupLayout(0),
          entries: [
            { binding: 0, resource: this.surfaces[n].createView() },
            { binding: 1, resource: (d || this.dummyTexture).createView() },
            { binding: 2, resource: { buffer: w } },
          ],
        });
      return (this.renderPass(e, this.displayPipeline, E, k, 'clear'), k);
    }
    encodeDisplaySamples(e, t, n, i) {
      let a = [
          [0, 0],
          [Math.floor(n / 2), 0],
          [n - 1, 0],
          [0, Math.floor(i / 2)],
          [Math.floor(n / 2), Math.floor(i / 2)],
          [n - 1, Math.floor(i / 2)],
          [0, i - 1],
          [Math.floor(n / 2), i - 1],
          [n - 1, i - 1],
        ],
        r = this.device.createBuffer({ size: a.length * 256, usage: fn.MAP_READ | fn.COPY_DST });
      for (let s = 0; s < a.length; s++)
        e.copyTextureToBuffer(
          { texture: t, origin: { x: a[s][0], y: a[s][1] } },
          { buffer: r, offset: s * 256, bytesPerRow: 256, rowsPerImage: 1 },
          { width: 1, height: 1 }
        );
      return { buffer: r, coordinates: a };
    }
    encodeAutoRange(e, t, n, i, a) {
      let r = [],
        s = this.surfaces[t],
        o = n,
        h = i,
        u = 1;
      for (; o > 1 || h > 1;) {
        let m = Math.max(1, Math.ceil(o / 2)),
          p = Math.max(1, Math.ceil(h / 2)),
          v = this.createTexture(
            m,
            p,
            'rg32float',
            Qe.TEXTURE_BINDING | Qe.STORAGE_BINDING | Qe.COPY_SRC
          );
        r.push(v);
        let g = this.parameterBuffer(new Float32Array([o, h, u]), a),
          w = this.device.createBindGroup({
            layout: this.reductionPipeline.getBindGroupLayout(0),
            entries: [
              { binding: 0, resource: s.createView() },
              { binding: 1, resource: v.createView() },
              { binding: 2, resource: { buffer: g } },
            ],
          }),
          k = e.beginComputePass();
        (k.setPipeline(this.reductionPipeline),
          k.setBindGroup(0, w),
          k.dispatchWorkgroups(Math.ceil(m / 8), Math.ceil(p / 8)),
          k.end(),
          (s = v),
          (o = m),
          (h = p),
          (u = 0));
      }
      let d = this.device.createBuffer({ size: 256, usage: fn.MAP_READ | fn.COPY_DST });
      return (
        r.length
          ? e.copyTextureToBuffer(
              { texture: r[r.length - 1] },
              { buffer: d, bytesPerRow: 256, rowsPerImage: 1 },
              { width: 1, height: 1 }
            )
          : e.copyTextureToBuffer(
              { texture: s },
              { buffer: d, bytesPerRow: 256, rowsPerImage: 1 },
              { width: 1, height: 1 }
            ),
        { buffer: d, textures: r, sourceUsesFloat: this.outputUsesFloat }
      );
    }
    async readAutoRange(e) {
      await e.buffer.mapAsync(Ws);
      let t = new DataView(e.buffer.getMappedRange()),
        n,
        i;
      (e.textures.length
        ? ((n = t.getFloat32(0, !0)), (i = t.getFloat32(4, !0)))
        : (n = i = e.sourceUsesFloat ? this.halfToFloat(t.getUint16(0, !0)) : t.getUint8(0) / 255),
        e.buffer.unmap(),
        e.buffer.destroy());
      for (let a of e.textures) (a.destroy(), this.ownedTextures.delete(a));
      return Number.isFinite(n) && Number.isFinite(i) && i >= n ? [n, i] : [0, 1];
    }
    uploadColormap(e) {
      if (!e || e === 'none') return ((this.colormapName = 'none'), null);
      if (e === this.colormapName && this.colormapTexture) return this.colormapTexture;
      let t = Ln(e);
      if (!t) return ((this.colormapName = 'none'), null);
      let n = new Uint8Array(256 * 4);
      for (let i = 0; i < 256; i++)
        ((n[i * 4] = t[i * 3]),
          (n[i * 4 + 1] = t[i * 3 + 1]),
          (n[i * 4 + 2] = t[i * 3 + 2]),
          (n[i * 4 + 3] = 255));
      return (
        this.colormapTexture ||
          (this.colormapTexture = this.createTexture(
            256,
            1,
            'rgba8unorm',
            Qe.TEXTURE_BINDING | Qe.COPY_DST
          )),
        this.device.queue.writeTexture(
          { texture: this.colormapTexture },
          n,
          { bytesPerRow: 1024, rowsPerImage: 1 },
          { width: 256, height: 1 }
        ),
        (this.colormapName = e),
        this.colormapTexture
      );
    }
    encodeValidation(e, t, n, i) {
      let a = [
          [0, 0],
          [Math.floor(n / 2), 0],
          [n - 1, 0],
          [0, Math.floor(i / 2)],
          [Math.floor(n / 2), Math.floor(i / 2)],
          [n - 1, Math.floor(i / 2)],
          [0, i - 1],
          [Math.floor(n / 2), i - 1],
          [n - 1, i - 1],
        ],
        r = this.device.createBuffer({ size: a.length * 256, usage: fn.MAP_READ | fn.COPY_DST });
      for (let s = 0; s < a.length; s++)
        e.copyTextureToBuffer(
          { texture: this.surfaces[t], origin: { x: a[s][0], y: a[s][1] } },
          { buffer: r, offset: s * 256, bytesPerRow: 256, rowsPerImage: 1 },
          { width: 1, height: 1 }
        );
      return { buffer: r, coordinates: a };
    }
    async validateSamples(e, t, n, i) {
      await e.buffer.mapAsync(Ws);
      let a = new Uint8Array(e.buffer.getMappedRange());
      for (let r = 0; r < e.coordinates.length; r++) {
        let [s, o] = e.coordinates[r],
          h = new DataView(a.buffer, a.byteOffset + r * 256, 8),
          u = this.outputUsesFloat
            ? [0, 1, 2, 3].map(v => this.halfToFloat(h.getUint16(v * 2, !0)))
            : [0, 1, 2, 3].map(v => h.getUint8(v) / 255),
          d = In(t, n, i, { x: s, y: o, width: 1, height: 1 }),
          m = d.typeMax || 1,
          p =
            d.coveredCount <= 0
              ? [0, 0, 0, 0]
              : d.channels === 1
                ? [d.data[0] / m, d.data[0] / m, d.data[0] / m, 1]
                : d.channels === 3
                  ? [d.data[0] / m, d.data[1] / m, d.data[2] / m, 1]
                  : [d.data[0] / m, d.data[1] / m, d.data[2] / m, d.data[3] / m];
        for (let v = 0; v < 4; v++)
          if (!(!Number.isFinite(u[v]) && !Number.isFinite(p[v])) && Math.abs(u[v] - p[v]) > 0.006)
            throw (
              e.buffer.unmap(),
              e.buffer.destroy(),
              new Error(`WebGPU parity mismatch at ${s},${o} channel ${v}: ${u[v]} != ${p[v]}`)
            );
      }
      (e.buffer.unmap(), e.buffer.destroy());
    }
    async validateDisplaySamples(e, t, n, i, a, r, s, o) {
      await e.buffer.mapAsync(Ws);
      let h = new Uint8Array(e.buffer.getMappedRange()),
        u = this.canvasFormat.startsWith('bgra');
      for (let d = 0; d < e.coordinates.length; d++) {
        let [m, p] = e.coordinates[d],
          v = d * 256,
          g = u ? [h[v + 2], h[v + 1], h[v], h[v + 3]] : [h[v], h[v + 1], h[v + 2], h[v + 3]],
          w = this.expectedDisplayPixel(t, n, i, m, p, a, r, s, o);
        for (let k = 0; k < 4; k++)
          if (Math.abs(g[k] - w[k]) > 4)
            throw (
              e.buffer.unmap(),
              e.buffer.destroy(),
              new Error(`WebGPU display mismatch at ${m},${p} channel ${k}: ${g[k]} != ${w[k]}`)
            );
      }
      (e.buffer.unmap(), e.buffer.destroy());
    }
    expectedDisplayPixel(e, t, n, i, a, r, s, o, h) {
      let u = In(e, t, n, { x: i, y: a, width: 1, height: 1 });
      if (u.coveredCount <= 0) return [0, 0, 0, 0];
      let d = u.typeMax || o || 1,
        m =
          u.channels === 1
            ? [u.data[0] / d, u.data[0] / d, u.data[0] / d, 1]
            : u.channels === 2
              ? [u.data[0] / d, u.data[0] / d, u.data[0] / d, u.data[1] / d]
              : u.channels === 3
                ? [u.data[0] / d, u.data[1] / d, u.data[2] / d, 1]
                : [u.data[0] / d, u.data[1] / d, u.data[2] / d, u.data[3] / d];
      if (m[3] <= 0) return [0, 0, 0, 0];
      if (!m.slice(0, 3).every(Number.isFinite)) return [s.r, s.g, s.b, 255];
      let p = Math.max(1e-4, r.gamma?.in ?? 1),
        v = Math.max(1e-4, r.gamma?.out ?? 1),
        g = 2 ** (r.brightness?.offset ?? 0),
        w = M => {
          let T = Math.max(0, Math.min(1, M)) ** p * g;
          return Math.max(0, Math.min(1, Math.max(0, T) ** (1 / v)));
        },
        k;
      if (r.rgbAs24BitGrayscale === !0 && e.some(M => !!M.data && M.channels >= 3)) {
        let M = m.slice(0, 3).map(N => Math.floor(Math.max(0, Math.min(255, N * o)) + 0.5)),
          T = M[0] * 65536 + M[1] * 256 + M[2],
          _ = r.normalization?.min ?? 0,
          I = r.normalization?.max ?? 16777215,
          A = w(I > _ ? (T - _) / (I - _) : 0);
        k = [A, A, A];
      } else {
        let M = h?.[0] ?? (r.normalization?.gammaMode ? 0 : (r.normalization?.min ?? 0) / o),
          T = h?.[1] ?? (r.normalization?.gammaMode ? 1 : (r.normalization?.max ?? o) / o);
        k = m.slice(0, 3).map(_ => w(T > M ? (_ - M) / (T - M) : 0));
      }
      let L = Ln(r.displayColormap || 'none');
      if (L) {
        let M = Math.max(0, Math.min(255, Math.round(k[0] * 255)));
        k = [L[M * 3], L[M * 3 + 1], L[M * 3 + 2]].map(T => T / 255);
      }
      return [
        Math.round(k[0] * 255),
        Math.round(k[1] * 255),
        Math.round(k[2] * 255),
        Math.round(Math.max(0, Math.min(1, m[3])) * 255),
      ];
    }
    halfToFloat(e) {
      let t = e & 32768 ? -1 : 1,
        n = (e >> 10) & 31,
        i = e & 1023;
      return n === 31
        ? i
          ? Number.NaN
          : t * (1 / 0)
        : n === 0
          ? t * 2 ** -14 * (i / 1024)
          : t * 2 ** (n - 15) * (1 + i / 1024);
    }
    isPixels(e) {
      return (
        e instanceof Uint8Array ||
        e instanceof Uint8ClampedArray ||
        e instanceof Uint16Array ||
        e instanceof Uint32Array ||
        e instanceof Int8Array ||
        e instanceof Int16Array ||
        e instanceof Int32Array ||
        e instanceof Float32Array ||
        e instanceof Float64Array
      );
    }
  };
ir.BYTES_PER_PIXEL = { rgba8unorm: 4, rgba16float: 8, rgba32float: 16 };
var nr = ir,
  Os = `
@vertex fn vertexMain(@builtin(vertex_index) index: u32) -> @builtin(position) vec4f {
	var positions = array<vec2f, 3>(vec2f(-1.0, -1.0), vec2f(3.0, -1.0), vec2f(-1.0, 3.0));
	return vec4f(positions[index], 0.0, 1.0);
}`,
  nm = `${Os}
@group(0) @binding(0) var previousTexture: texture_2d<f32>;
@group(0) @binding(1) var sourceTexture: texture_2d<f32>;
@group(0) @binding(2) var maskTexture: texture_2d<f32>;
@group(0) @binding(3) var clipTexture: texture_2d<f32>;
@group(0) @binding(4) var<storage, read> p: array<f32>;
fn nanValue() -> f32 { return bitcast<f32>(bitcast<u32>(p[0]) | 0x7fc00000u); }
fn invalidF(value: f32) -> bool { return (bitcast<u32>(value) & 0x7f800000u) == 0x7f800000u; }
fn invalid3(value: vec3f) -> bool {
	let bits = bitcast<vec3u>(value) & vec3u(0x7f800000u);
	return any(bits == vec3u(0x7f800000u));
}
fn blendValue(below: vec3f, source: vec3f, mode: i32) -> vec3f {
	if (mode == 1) { return below * source; }
	if (mode == 2) { return vec3f(1.0) - (vec3f(1.0) - below) * (vec3f(1.0) - source); }
	if (mode == 3) { return select(2.0 * below * source, vec3f(1.0) - 2.0 * (vec3f(1.0) - below) * (vec3f(1.0) - source), below >= vec3f(0.5)); }
	if (mode == 4) { return min(below, source); }
	if (mode == 5) { return max(below, source); }
	if (mode == 6 || mode == 10) { return abs(below - source); }
	if (mode == 7) { return below + source - 2.0 * below * source; }
	if (mode == 8) { return below + source; }
	if (mode == 9) { return below - source; }
	if (mode == 11) { return below * source * p[21]; }
	if (mode == 12) {
		return vec3f(select(below.r / source.r / p[21], nanValue(), source.r == 0.0),
			select(below.g / source.g / p[21], nanValue(), source.g == 0.0),
			select(below.b / source.b / p[21], nanValue(), source.b == 0.0));
	}
	if (mode == 13) { return min(below, source); }
	if (mode == 14) { return max(below, source); }
	if (mode == 15) { return (below + source) * 0.5; }
	return source;
}
fn maskFactor(pixel: vec2i) -> f32 {
	if (i32(p[8]) == 0) { return 1.0; }
	let local = pixel - vec2i(i32(p[11]), i32(p[12]));
	let size = vec2i(i32(p[13]), i32(p[14]));
	if (any(local < vec2i(0)) || any(local >= size)) { return select(0.0, 1.0, i32(p[15]) == 1); }
	let sourceSize = vec2i(i32(p[9]), i32(p[10]));
	let coordinate = min(sourceSize - 1, vec2i((vec2f(local) + 0.5) * vec2f(sourceSize) / vec2f(size)));
	let value = textureLoad(maskTexture, coordinate, 0).r;
	let factor = select(clamp(value, 0.0, 1.0), 0.0, invalidF(value));
	return select(factor, 1.0 - factor, i32(p[15]) == 1);
}
fn keepMask(value: f32, condition: i32) -> bool {
	if (condition == 1) { return value > p[20]; }
	if (condition == 2) { return value >= p[20]; }
	if (condition == 3) { return value < p[20]; }
	if (condition == 4) { return value <= p[20]; }
	if (condition == 5) { return abs(value - p[20]) <= 1e-6; }
	if (condition == 6) { return !invalidF(value); }
	if (condition == 7) { return invalidF(value); }
	return true;
}
@fragment fn blend(@builtin(position) position: vec4f) -> @location(0) vec4f {
	let pixel = vec2i(position.xy);
	let below = textureLoad(previousTexture, pixel, 0);
	let local = pixel - vec2i(i32(p[4]), i32(p[5]));
	let layerSize = vec2i(i32(p[6]), i32(p[7]));
	if (any(local < vec2i(0)) || any(local >= layerSize)) { return below; }
	let sourceSize = vec2i(i32(p[2]), i32(p[3]));
	let coordinate = min(sourceSize - 1, vec2i((vec2f(local) + 0.5) * vec2f(sourceSize) / vec2f(layerSize)));
	var source = textureLoad(sourceTexture, coordinate, 0);
	// Narrow float sources (r32float / rg32float) carry the same information
	// as a full rgba32float upload at a quarter or half the memory; rebuild
	// the vec4 the rest of this shader expects. p[22] == 0 means the texture
	// is already RGBA, which is the byte and 3+ channel float case.
	let sourceChannels = i32(p[22]);
	if (sourceChannels == 1) {
		source = vec4f(source.r, source.r, source.r, 1.0);
	} else if (sourceChannels == 2) {
		source = vec4f(source.r, source.r, source.r, source.g);
	}
	let mode = i32(p[17]);
	if (mode == 16) {
		let value = dot(source.rgb, vec3f(0.2126, 0.7152, 0.0722));
		return select(vec4f(0.0), below, keepMask(value, i32(p[19])));
	}
	if (invalidF(source.a)) { return vec4f(vec3f(nanValue()), 1.0); }
	let clipAlpha = select(1.0, textureLoad(clipTexture, pixel, 0).a, i32(p[16]) == 1);
	let factor = maskFactor(pixel);
	let sourceAlpha = clamp(source.a * p[18] * factor * clipAlpha, 0.0, 1.0);
	if (sourceAlpha <= 0.0) { return below; }
	if (mode >= 8 && mode <= 15) {
		if (below.a <= 0.0) { return vec4f(source.rgb, 1.0); }
		return vec4f(mix(below.rgb, blendValue(below.rgb, source.rgb, mode), clamp(p[18] * factor * clipAlpha, 0.0, 1.0)), below.a);
	}
	let outputAlpha = sourceAlpha + below.a * (1.0 - sourceAlpha);
	if (below.a <= 0.0 || (mode == 0 && sourceAlpha >= 1.0)) { return vec4f(source.rgb, outputAlpha); }
	if (invalid3(source.rgb) || invalid3(below.rgb)) { return vec4f(vec3f(nanValue()), outputAlpha); }
	let blended = blendValue(below.rgb, source.rgb, mode);
	let color = select(
		((1.0 - sourceAlpha) * below.a * below.rgb + (1.0 - below.a) * sourceAlpha * source.rgb + below.a * sourceAlpha * blended) / outputAlpha,
		(source.rgb * sourceAlpha + below.rgb * below.a * (1.0 - sourceAlpha)) / outputAlpha,
		mode == 0,
	);
	return vec4f(color, outputAlpha);
}`,
  im = `${Os}
@group(0) @binding(0) var sourceTexture: texture_2d<f32>;
@group(0) @binding(1) var maskTexture: texture_2d<f32>;
@group(0) @binding(2) var<storage, read> p: array<f32>;
fn invalidF(value: f32) -> bool { return (bitcast<u32>(value) & 0x7f800000u) == 0x7f800000u; }
fn invalid3(value: vec3f) -> bool {
	let bits = bitcast<vec3u>(value) & vec3u(0x7f800000u);
	return any(bits == vec3u(0x7f800000u));
}
fn rgbToHsl(color: vec3f) -> vec3f {
	let maximum = max(color.r, max(color.g, color.b)); let minimum = min(color.r, min(color.g, color.b));
	let delta = maximum - minimum; let lightness = (maximum + minimum) * 0.5; var hue = 0.0;
	if (delta > 0.0) {
		if (maximum == color.r) { hue = (color.g - color.b) / delta % 6.0; }
		else if (maximum == color.g) { hue = (color.b - color.r) / delta + 2.0; }
		else { hue = (color.r - color.g) / delta + 4.0; }
		hue = (hue * 60.0 + 360.0) % 360.0;
	}
	let saturation = select(0.0, delta / max(1e-6, 1.0 - abs(2.0 * lightness - 1.0)), delta > 0.0);
	return vec3f(hue, saturation, lightness);
}
fn hslToRgb(hsl: vec3f) -> vec3f {
	let c = (1.0 - abs(2.0 * hsl.z - 1.0)) * hsl.y; let section = hsl.x / 60.0;
	let x = c * (1.0 - abs(section % 2.0 - 1.0)); var rgb = vec3f(c, x, 0.0);
	if (section >= 5.0) { rgb = vec3f(c, 0.0, x); } else if (section >= 4.0) { rgb = vec3f(x, 0.0, c); }
	else if (section >= 3.0) { rgb = vec3f(0.0, x, c); } else if (section >= 2.0) { rgb = vec3f(0.0, c, x); }
	else if (section >= 1.0) { rgb = vec3f(x, c, 0.0); }
	return rgb + vec3f(hsl.z - c * 0.5);
}
fn luminance(color: vec3f) -> f32 { return dot(color, vec3f(0.2126, 0.7152, 0.0722)); }
fn hueWeight(hue: f32, center: f32) -> f32 {
	let distance = abs((hue - center + 540.0) % 360.0 - 180.0);
	return select(select((60.0 - distance) / 30.0, 0.0, distance >= 60.0), 1.0, distance <= 30.0);
}
fn configuredHueWeight(hue: f32, range: u32) -> f32 {
	if (i32(p[81u + range]) == 0) { return hueWeight(hue, f32(range) * 60.0); }
	let base = 35u + range * 7u;
	var a = p[base]; var b = p[base + 1u]; var c = p[base + 2u]; var d = p[base + 3u];
	if (b < a) { b += 360.0; } if (c < b) { c += 360.0; } if (d < c) { d += 360.0; }
	var weight = 0.0;
	for (var turn = -1; turn <= 2; turn++) {
		let candidate = hue + f32(turn) * 360.0;
		if (candidate >= a && candidate <= d) {
			let value = select(select((d - candidate) / max(1e-6, d - c), 1.0, candidate <= c),
				(candidate - a) / max(1e-6, b - a), candidate < b);
			weight = max(weight, value);
		}
	}
	return clamp(weight, 0.0, 1.0);
}
fn lut(color: vec3f) -> vec3f {
	let position = clamp(color, vec3f(0.0), vec3f(1.0)) * 255.0;
	let low = vec3u(floor(position)); let high = min(low + 1u, vec3u(255)); let fraction = position - vec3f(low);
	let a = vec3f(p[96u + low.r], p[352u + low.g], p[608u + low.b]);
	let b = vec3f(p[96u + high.r], p[352u + high.g], p[608u + high.b]);
	return mix(a, b, fraction);
}
fn mixer(color: vec3f, base: u32) -> f32 {
	return dot(color, vec3f(p[32u + base], p[33u + base], p[34u + base])) / 100.0 + p[35u + base] / 100.0;
}
fn direct(color: vec3f, kind: i32) -> vec3f {
	var result = color;
	if (kind == 2) {
		let contrast = clamp(p[33] / 100.0, -0.99, 0.99); let factor = (1.0 + contrast) / (1.0 - contrast);
		result = (result - 0.5) * factor + 0.5 + p[32] / 100.0;
	} else if (kind == 3) { result = pow(max(vec3f(0.0), result * exp2(p[32]) + p[33]), vec3f(1.0 / max(0.01, p[34]))); }
	else if (kind == 4) { result = vec3f(1.0) - result; }
	else if (kind == 5) { result = select(vec3f(mixer(result, 0u), mixer(result, 4u), mixer(result, 8u)), vec3f(mixer(result, 12u)), i32(p[80]) == 1); }
	else if (kind == 6) {
		let originalLightness = rgbToHsl(result).z; let light = luminance(result);
		let weights = vec3f(clamp((0.5-light)*2.0,0.0,1.0),1.0-abs(light-0.5)*2.0,clamp((light-0.5)*2.0,0.0,1.0));
		for (var range = 0u; range < 3u; range++) { let base=32u+range*3u; result += vec3f(p[base],p[base+1u],p[base+2u])/100.0*weights[range]; }
		if (i32(p[80]) == 1) { let hsl=rgbToHsl(clamp(result,vec3f(0.0),vec3f(1.0))); result=hslToRgb(vec3f(hsl.xy,originalLightness)); }
	} else if (kind == 7) {
		let hsl=rgbToHsl(result); var weighted=0.0; var total=0.0;
		for(var range=0u;range<6u;range++){let weight=hueWeight(hsl.x,f32(range)*60.0);weighted+=p[32u+range]*weight;total+=weight;}
		result=vec3f(luminance(result)+((select(50.0,weighted/total,total>0.0)-50.0)/100.0)*hsl.y*0.5);
	} else if (kind == 8) { result=vec3f(select(0.0,1.0,luminance(result)*255.0>=p[32])); }
	else if (kind == 9) { let levels=clamp(floor(p[32]+0.5),2.0,255.0);result=floor(result*(levels-1.0)+0.5)/(levels-1.0); }
	else if (kind == 10) { result=lut(vec3f(luminance(result))); }
	return clamp(result,vec3f(0.0),vec3f(1.0));
}
fn maskFactor(pixel: vec2i) -> f32 {
	if (i32(p[2]) == 0) { return 1.0; }
	let local=pixel-vec2i(i32(p[5]),i32(p[6]));let size=vec2i(i32(p[7]),i32(p[8]));
	if(any(local<vec2i(0))||any(local>=size)){return select(0.0,1.0,i32(p[9])==1);}
	let sourceSize=vec2i(i32(p[3]),i32(p[4]));let coordinate=min(sourceSize-1,vec2i((vec2f(local)+0.5)*vec2f(sourceSize)/vec2f(size)));
	let value=textureLoad(maskTexture,coordinate,0).r;let factor=select(clamp(value,0.0,1.0),0.0,invalidF(value));
	return select(factor,1.0-factor,i32(p[9])==1);
}
@fragment fn adjustment(@builtin(position) position: vec4f) -> @location(0) vec4f {
	let pixel=vec2i(position.xy);let source=textureLoad(sourceTexture,pixel,0);
	if(source.a<=0.0||invalid3(source.rgb)){return source;}
	let kind=i32(p[0]);var adjusted=source.rgb;
	if(kind==0){adjusted=lut(source.rgb);}
	else if(kind==1){
		var hsl=rgbToHsl(clamp(source.rgb,vec3f(0.0),vec3f(1.0)));
		if(i32(p[80])==1){hsl.x=(p[32]+360.0)%360.0;hsl.y=clamp(p[33],0.0,1.0);let d=clamp(p[34],-1.0,1.0);hsl.z=select(hsl.z+(1.0-hsl.z)*d,hsl.z*(1.0+d),d<0.0);}
		else{
			let sourceHue=hsl.x;hsl.x=(hsl.x+p[32]+360.0)%360.0;hsl.y=clamp(hsl.y+p[33]/100.0,0.0,1.0);hsl.z=clamp(hsl.z+p[34]/100.0,0.0,1.0);
			for(var range=0u;range<6u;range++){let base=35u+range*7u;let weight=configuredHueWeight(sourceHue,range);
				hsl.x=(hsl.x+p[base+4u]*weight+360.0)%360.0;hsl.y=clamp(hsl.y+p[base+5u]/100.0*weight,0.0,1.0);hsl.z=clamp(hsl.z+p[base+6u]/100.0*weight,0.0,1.0);}
		}
		adjusted=hslToRgb(hsl);
	}else{adjusted=direct(source.rgb,kind);}
	return vec4f(mix(source.rgb,adjusted,p[1]*maskFactor(pixel)),source.a);
}`,
  am = `${Os}
@group(0) @binding(0) var sourceTexture: texture_2d<f32>;
@group(0) @binding(1) var colormapTexture: texture_2d<f32>;
@group(0) @binding(2) var<storage, read> p: array<f32>;
fn invalid3(value: vec3f) -> bool {
	let bits = bitcast<vec3u>(value) & vec3u(0x7f800000u);
	return any(bits == vec3u(0x7f800000u));
}
@fragment fn display(@builtin(position) position: vec4f) -> @location(0) vec4f {
	let value=textureLoad(sourceTexture,vec2i(position.xy),0);
	if(value.a<=0.0){return vec4f(0.0);}
	if(invalid3(value.rgb)){return vec4f(vec3f(p[7],p[8],p[9]),1.0);}
	if(i32(p[11])==1){
		let bytes=floor(clamp(value.rgb*p[12],vec3f(0.0),vec3f(255.0))+0.5);
		let packed=bytes.r*65536.0+bytes.g*256.0+bytes.b;
		var gray=clamp((packed-p[13])*p[14],0.0,1.0);gray=pow(gray,max(0.0001,p[4]))*exp2(p[6]);gray=pow(max(gray,0.0),1.0/max(0.0001,p[5]));
		return vec4f(vec3f(clamp(gray,0.0,1.0)),value.a);
	}
	var normalized=clamp((value.rgb-p[2])*p[3],vec3f(0.0),vec3f(1.0));
	normalized=pow(max(normalized,vec3f(0.0)),vec3f(max(0.0001,p[4])))*exp2(p[6]);
	normalized=pow(max(normalized,vec3f(0.0)),vec3f(1.0/max(0.0001,p[5])));
	if(i32(p[10])==1){let index=i32(clamp(round(normalized.r*255.0),0.0,255.0));return vec4f(textureLoad(colormapTexture,vec2i(index,0),0).rgb,value.a);}
	return vec4f(clamp(normalized,vec3f(0.0),vec3f(1.0)),value.a);
}`,
  rm = `
@group(0) @binding(0) var sourceTexture: texture_2d<f32>;
@group(0) @binding(1) var destinationTexture: texture_storage_2d<rg32float, write>;
@group(0) @binding(2) var<storage, read> p: array<f32>;
fn invalidF(value: f32) -> bool { return (bitcast<u32>(value) & 0x7f800000u) == 0x7f800000u; }
@compute @workgroup_size(8, 8)
fn reduce(@builtin(global_invocation_id) id: vec3u) {
	let sourceSize = vec2u(u32(p[0]), u32(p[1]));
	let outputSize = (sourceSize + vec2u(1)) / 2u;
	if (any(id.xy >= outputSize)) { return; }
	let origin = id.xy * 2u;
	var minimum = 3.402823466e+38; var maximum = -3.402823466e+38;
	for (var y = 0u; y < 2u; y++) { for (var x = 0u; x < 2u; x++) {
		let coordinate = origin + vec2u(x, y);
		if (any(coordinate >= sourceSize)) { continue; }
		let value = textureLoad(sourceTexture, vec2i(coordinate), 0);
		if (i32(p[2]) == 1) {
			if (value.a <= 0.0) { continue; }
			for (var channel = 0u; channel < 3u; channel++) {
				let sampleValue = value[channel];
				if (!invalidF(sampleValue)) { minimum = min(minimum, sampleValue); maximum = max(maximum, sampleValue); }
			}
		} else if (value.r <= value.g) {
			minimum = min(minimum, value.r); maximum = max(maximum, value.g);
		}
	} }
	textureStore(destinationTexture, vec2i(id.xy), vec4f(minimum, maximum, 0.0, 0.0));
}`;
var Vs = 1;
function Fi(l) {
  return {
    ...l,
    groupPath: l.groupPath ? [...l.groupPath] : void 0,
    groupIds: l.groupIds ? [...l.groupIds] : void 0,
    maskCondition: l.maskCondition ? { ...l.maskCondition } : void 0,
    rasterMask: l.rasterMask ? { ...l.rasterMask } : void 0,
    adjustment: l.adjustment ? JSON.parse(JSON.stringify(l.adjustment)) : void 0,
  };
}
var ar = class {
  constructor() {
    ((this.layers = []),
      (this.active = !1),
      (this.canvasWidth = 0),
      (this.canvasHeight = 0),
      (this._lastComposite = null),
      (this.documentExpanded = !1),
      (this._undoStack = []),
      (this._redoStack = []),
      (this._historyGroupDepth = 0),
      (this._historyGroupStart = null),
      (this._historyGroupChanged = !1));
  }
  _snapshot() {
    return { layers: this.layers.map(Fi), documentExpanded: this.documentExpanded };
  }
  _pushUndo(e) {
    (this._undoStack.push(e), this._undoStack.length > 50 && this._undoStack.shift());
  }
  _recordHistory() {
    if (this._historyGroupDepth > 0) {
      (this._historyGroupChanged || (this._redoStack = []), (this._historyGroupChanged = !0));
      return;
    }
    ((this._redoStack = []), this._pushUndo(this._snapshot()));
  }
  beginHistoryGroup() {
    this._historyGroupDepth++ === 0 &&
      ((this._historyGroupStart = this._snapshot()), (this._historyGroupChanged = !1));
  }
  endHistoryGroup() {
    this._historyGroupDepth <= 0 ||
      (--this._historyGroupDepth === 0 &&
        (this._historyGroupChanged &&
          this._historyGroupStart &&
          this._pushUndo(this._historyGroupStart),
        (this._historyGroupStart = null),
        (this._historyGroupChanged = !1)));
  }
  canUndo() {
    return this._undoStack.length > 0 || (this._historyGroupDepth > 0 && this._historyGroupChanged);
  }
  canRedo() {
    return this._redoStack.length > 0;
  }
  undo() {
    for (; this._historyGroupDepth > 0;) this.endHistoryGroup();
    let e = this._undoStack.pop();
    return e
      ? (this._redoStack.push(this._snapshot()),
        this._redoStack.length > 50 && this._redoStack.shift(),
        (this.layers = e.layers.map(Fi)),
        (this.documentExpanded = e.documentExpanded),
        (this._lastComposite = null),
        !0)
      : !1;
  }
  redo() {
    for (; this._historyGroupDepth > 0;) this.endHistoryGroup();
    let e = this._redoStack.pop();
    return e
      ? (this._pushUndo(this._snapshot()),
        (this.layers = e.layers.map(Fi)),
        (this.documentExpanded = e.documentExpanded),
        (this._lastComposite = null),
        !0)
      : !1;
  }
  clearHistory() {
    ((this._undoStack = []),
      (this._redoStack = []),
      (this._historyGroupDepth = 0),
      (this._historyGroupStart = null),
      (this._historyGroupChanged = !1));
  }
  hasExtraLayers() {
    return this.layers.length > 1;
  }
  hasCompositeStack() {
    return this.hasExtraLayers() || this.documentExpanded;
  }
  isEmpty() {
    return this.layers.length === 0;
  }
  invalidateComposite() {
    this._lastComposite = null;
  }
  setBaseLayer(e) {
    let t = this._toLayer(e, 0, 0);
    ((t.name = e.name || 'Background'),
      (this.canvasWidth = e.width),
      (this.canvasHeight = e.height),
      (this.layers = [t]),
      (this._lastComposite = null),
      (this.documentExpanded = !1),
      this.clearHistory());
  }
  addLayer(e) {
    this._recordHistory();
    let { offsetX: t, offsetY: n } = Oc(
        e.width,
        e.height,
        this.canvasWidth || e.width,
        this.canvasHeight || e.height
      ),
      i = this._toLayer(e, t, n);
    return (
      (i.name = e.name || `Layer ${this.layers.length}`),
      (i.blendMode = 'normal'),
      this.layers.push(i),
      (this._lastComposite = null),
      i.id
    );
  }
  addAdjustmentLayer(e, t) {
    let n = this.layers.findIndex(m => m.id === e);
    if (n < 0) return null;
    this._recordHistory();
    let i = this.layers[n],
      r = {
        levels: () => ({
          type: 'levels',
          rgb: {
            shadowInput: 0,
            highlightInput: 255,
            shadowOutput: 0,
            highlightOutput: 255,
            midtoneInput: 1,
          },
        }),
        curves: () => ({
          type: 'curves',
          rgb: [
            { input: 0, output: 0 },
            { input: 255, output: 255 },
          ],
        }),
        'hue/saturation': () => ({
          type: 'hue/saturation',
          master: { hue: 0, saturation: 0, lightness: 0 },
          colorize: { hue: 0, saturation: 100, lightness: 0 },
          colorizeEnabled: !1,
        }),
        'brightness/contrast': () => ({ type: 'brightness/contrast', brightness: 0, contrast: 0 }),
        exposure: () => ({ type: 'exposure', exposure: 0, offset: 0, gamma: 1 }),
        invert: () => ({ type: 'invert' }),
        'channel mixer': () => ({
          type: 'channel mixer',
          red: { red: 100, green: 0, blue: 0, constant: 0 },
          green: { red: 0, green: 100, blue: 0, constant: 0 },
          blue: { red: 0, green: 0, blue: 100, constant: 0 },
        }),
        'color balance': () => ({
          type: 'color balance',
          shadows: {},
          midtones: {},
          highlights: {},
          preserveLuminosity: !0,
        }),
        'black & white': () => ({
          type: 'black & white',
          reds: 40,
          yellows: 60,
          greens: 40,
          cyans: 60,
          blues: 20,
          magentas: 80,
        }),
        threshold: () => ({ type: 'threshold', level: 128 }),
        posterize: () => ({ type: 'posterize', levels: 4 }),
        'gradient map': () => ({
          type: 'gradient map',
          stops: [
            { position: 0, color: { r: 0, g: 0, b: 0 } },
            { position: 1, color: { r: 255, g: 255, b: 255 } },
          ],
        }),
      }[t](),
      o = {
        levels: 'Levels',
        curves: 'Curves',
        'hue/saturation': 'Hue/Saturation',
        'brightness/contrast': 'Brightness/Contrast',
        exposure: 'Exposure',
        invert: 'Invert',
        'channel mixer': 'Channel Mixer',
        'color balance': 'Color Balance',
        'black & white': 'Black & White',
        threshold: 'Threshold',
        posterize: 'Posterize',
        'gradient map': 'Gradient Map',
      }[t],
      h = this.layers.filter(m => m.kind === 'adjustment' && m.adjustment?.type === t).length,
      u = this.createLayer(
        {
          width: 1,
          height: 1,
          channels: 4,
          isFloat: !1,
          typeMax: i.typeMax || 255,
          name: `${o} ${h + 1}`,
          kind: 'adjustment',
          adjustment: r,
          parentId: i.parentId,
          clipped: !0,
          groupPath: i.groupPath,
          groupIds: i.groupIds,
        },
        { adjustment: r, clipped: !0, parentId: i.parentId }
      ),
      d = n + 1;
    for (
      ;
      d < this.layers.length &&
      this.layers[d].clipped &&
      (this.layers[d].parentId || void 0) === (i.parentId || void 0);
    )
      d++;
    return (this.layers.splice(d, 0, u), (this._lastComposite = null), u.id);
  }
  duplicateLayerWithAdjustments(e) {
    let t = this.layers.findIndex(r => r.id === e),
      n = this.layers[t];
    if (t < 0 || !n || n.kind === 'adjustment' || !n.data) return null;
    this._recordHistory();
    let i = t + 1;
    for (
      ;
      i < this.layers.length &&
      this.layers[i].kind === 'adjustment' &&
      this.layers[i].clipped &&
      (this.layers[i].parentId || void 0) === (n.parentId || void 0);
    )
      i++;
    let a = this.layers.slice(t, i).map((r, s) => {
      let o = Fi(r);
      return (
        (o.id = `layer-${Vs++}`),
        (o.sourceNodeId = void 0),
        s === 0 && (o.name = `${r.name || 'Layer'} copy`),
        o
      );
    });
    return (this.layers.splice(i, 0, ...a), (this._lastComposite = null), a[0].id);
  }
  copyAdjustmentLayer(e, t) {
    let n = this.layers.find(o => o.id === e),
      i = this.layers.findIndex(o => o.id === t),
      a = this.layers[i];
    if (!n?.adjustment || n.kind !== 'adjustment' || i < 0 || !a?.data || a.kind === 'adjustment')
      return null;
    this._recordHistory();
    let r = Fi(n);
    ((r.id = `layer-${Vs++}`),
      (r.name = `${n.name || 'Filter'} copy`),
      (r.parentId = a.parentId),
      (r.groupPath = a.groupPath ? [...a.groupPath] : void 0),
      (r.groupIds = a.groupIds ? [...a.groupIds] : void 0),
      (r.clipped = !0),
      (r.sourceNodeId = void 0),
      (r.typeMax = a.typeMax || r.typeMax));
    let s = i + 1;
    for (
      ;
      s < this.layers.length &&
      this.layers[s].kind === 'adjustment' &&
      this.layers[s].clipped &&
      (this.layers[s].parentId || void 0) === (a.parentId || void 0);
    )
      s++;
    return (this.layers.splice(s, 0, r), (this._lastComposite = null), r.id);
  }
  removeLayer(e) {
    let t = this.layers.findIndex(n => n.id === e);
    if (t >= 0 && this.layers.length > 1) {
      this._recordHistory();
      let n = new Set([e]);
      if (!this.layers[t].clipped)
        for (
          let r = t + 1;
          r < this.layers.length &&
          this.layers[r].clipped &&
          (this.layers[r].parentId || void 0) === (this.layers[t].parentId || void 0);
          r++
        )
          n.add(this.layers[r].id);
      let i = !0;
      for (; i;) {
        i = !1;
        for (let r of this.layers)
          r.parentId && n.has(r.parentId) && !n.has(r.id) && (n.add(r.id), (i = !0));
      }
      let a = this.layers.filter(r => !n.has(r.id));
      a.length && ((this.layers = a), (this._lastComposite = null));
    }
  }
  updateLayer(e, t) {
    let n = this.layers.find(i => i.id === e);
    n &&
      Object.entries(t).some(([i, a]) => n[i] !== a) &&
      (this._recordHistory(), Object.assign(n, t), (this._lastComposite = null));
  }
  showOnlyLayer(e) {
    let t = this.layers.find(n => n.id === e);
    t?.data && t.kind !== 'adjustment' && t.kind !== 'group'
      ? this.toggleSoloImageLayers(new Set([e]))
      : this.toggleSoloLayers(new Set([e]));
  }
  toggleSoloImageLayers(e) {
    let t = this.layers.filter(a => !!a.data && a.kind !== 'adjustment' && a.kind !== 'group');
    if (!t.length) return;
    let n = t.every(a => (e.has(a.id) ? a.visible !== !1 : a.visible === !1));
    if (t.some(a => a.visible !== (n || e.has(a.id)))) {
      this._recordHistory();
      for (let a of t) a.visible = n || e.has(a.id);
      this._lastComposite = null;
    }
  }
  toggleSoloLayers(e) {
    let t =
      this.layers.length > 0 &&
      this.layers.every(i => (e.has(i.id) ? i.visible !== !1 : i.visible === !1));
    if (this.layers.some(i => i.visible !== (t || e.has(i.id)))) {
      this._recordHistory();
      for (let i of this.layers) i.visible = t || e.has(i.id);
      this._lastComposite = null;
    }
  }
  moveLayer(e, t, n) {
    let i = this.layers.find(a => a.id === e);
    i &&
      (t !== 0 || n !== 0) &&
      (this._recordHistory(),
      (i.offsetX = (i.offsetX ?? 0) + t),
      (i.offsetY = (i.offsetY ?? 0) + n),
      (this._lastComposite = null));
  }
  reorderLayer(e, t) {
    let n = this.layers.findIndex(d => d.id === e);
    if (n < 0) return;
    let i = this.layers[n],
      a = Math.sign(t - n);
    if (!a) return;
    if (i.kind === 'adjustment' && i.clipped) {
      let d = n - 1;
      for (
        ;
        d >= 0 &&
        this.layers[d].clipped &&
        (this.layers[d].parentId || void 0) === (i.parentId || void 0);
      )
        d--;
      if (d < 0) return;
      let m = d + 1;
      for (
        ;
        m < this.layers.length &&
        this.layers[m].kind === 'adjustment' &&
        this.layers[m].clipped &&
        (this.layers[m].parentId || void 0) === (i.parentId || void 0);
      )
        m++;
      let p = Math.max(d + 1, Math.min(m - 1, t));
      if (p === n) return;
      this._recordHistory();
      let [v] = this.layers.splice(n, 1);
      (this.layers.splice(p, 0, v), (this._lastComposite = null));
      return;
    }
    let r = n + 1;
    for (
      ;
      r < this.layers.length &&
      this.layers[r].kind === 'adjustment' &&
      this.layers[r].clipped &&
      (this.layers[r].parentId || void 0) === (i.parentId || void 0);
    )
      r++;
    let s = a > 0 ? r : n - 1;
    for (; s >= 0 && s < this.layers.length;) {
      let d = this.layers[s];
      if ((d.parentId || void 0) === (i.parentId || void 0) && d.kind !== 'adjustment' && d.data)
        break;
      s += a;
    }
    if (s < 0 || s >= this.layers.length) return;
    let o = this.layers[s];
    this._recordHistory();
    let h = this.layers.splice(n, r - n),
      u = this.layers.indexOf(o);
    if (a > 0) {
      let d = u + 1;
      for (
        ;
        d < this.layers.length &&
        this.layers[d].kind === 'adjustment' &&
        this.layers[d].clipped &&
        (this.layers[d].parentId || void 0) === (o.parentId || void 0);
      )
        d++;
      this.layers.splice(d, 0, ...h);
    } else this.layers.splice(u, 0, ...h);
    this._lastComposite = null;
  }
  getComposite() {
    return !this.canvasWidth || !this.canvasHeight
      ? null
      : (this._lastComposite ||
          (this._lastComposite = Jn(this.layers, this.canvasWidth, this.canvasHeight)),
        this._lastComposite);
  }
  renderToImageData(e, t = {}) {
    let n = performance.now(),
      i = this.getComposite();
    if (!i) return null;
    (ne.detail('layer-composite', performance.now() - n), (this._lastComposite = i));
    let a = performance.now(),
      r = bt.render(i.data, i.width, i.height, i.channels, i.isFloat, i.stats, e, {
        nanColor: t.nanColor,
        typeMax: i.typeMax,
      });
    return (ne.detail('layer-render-total', performance.now() - a), r);
  }
  renderCompositeToImageData(e, t, n = {}) {
    return (
      n.cache !== !1 && (this._lastComposite = e),
      bt.render(e.data, e.width, e.height, e.channels, e.isFloat, e.stats, t, {
        nanColor: n.nanColor,
        typeMax: e.typeMax,
      })
    );
  }
  getCompositeValueAt(e, t) {
    if (e < 0 || t < 0 || e >= this.canvasWidth || t >= this.canvasHeight) return null;
    let n =
        this._lastComposite ||
        In(this.layers, this.canvasWidth, this.canvasHeight, { x: e, y: t, width: 1, height: 1 }),
      i = n === this._lastComposite ? e : 0,
      r = ((n === this._lastComposite ? t : 0) * n.width + i) * n.channels,
      s = [];
    for (let o = 0; o < n.channels; o++) s.push(n.data[r + o]);
    return s;
  }
  createLayer(e, t = {}) {
    let n = this._toLayer(e, t.offsetX ?? 0, t.offsetY ?? 0);
    return (
      (n.opacity = t.opacity ?? 1),
      (n.blendMode = t.blendMode ?? 'normal'),
      (n.visible = t.visible !== !1),
      (n.maskCondition = t.maskCondition),
      (n.name = t.name ?? e.name),
      (n.groupPath = t.groupPath ?? e.groupPath),
      (n.groupIds = t.groupIds ?? e.groupIds),
      (n.sourceNodeId = t.sourceNodeId ?? e.sourceNodeId),
      (n.sourceSupport = t.sourceSupport ?? e.sourceSupport),
      (n.sourceBlendMode = t.sourceBlendMode ?? e.sourceBlendMode),
      (n.kind = t.kind ?? e.kind ?? 'raster'),
      (n.adjustment = t.adjustment ?? e.adjustment),
      (n.parentId = t.parentId ?? e.parentId),
      (n.clipped = t.clipped ?? e.clipped),
      (n.rasterMask = t.rasterMask ?? e.rasterMask),
      n
    );
  }
  setLayers(e, t, n) {
    ((this.layers = e),
      (this.canvasWidth = t),
      (this.canvasHeight = n),
      (this._lastComposite = null),
      this.clearHistory());
  }
  _toLayer(e, t, n) {
    return {
      id: `layer-${Vs++}`,
      data: e.data,
      width: e.width,
      height: e.height,
      channels: e.channels,
      isFloat: e.isFloat,
      typeMax: e.typeMax,
      offsetX: t,
      offsetY: n,
      opacity: 1,
      blendMode: 'normal',
      visible: !0,
      name: e.name,
      uri: e.uri,
      groupPath: e.groupPath,
      groupIds: e.groupIds,
      sourceNodeId: e.sourceNodeId,
      sourceSupport: e.sourceSupport,
      sourceBlendMode: e.sourceBlendMode,
      sourceNumericType: e.sourceNumericType,
      kind: e.kind ?? 'raster',
      adjustment: e.adjustment,
      parentId: e.parentId,
      clipped: e.clipped,
      rasterMask: e.rasterMask,
    };
  }
};
function sm(l, e) {
  let t = { blendMode: e };
  return (
    e === 'mask'
      ? (l.maskCondition || (t.maskCondition = { op: 'gt', threshold: (l.typeMax || 1) * 0.5 }),
        (t.maskPreviousClipped = !!l.clipped),
        (t.clipped = !1))
      : l.blendMode === 'mask' &&
        ((t.clipped = l.maskPreviousClipped ?? !1), (t.maskPreviousClipped = void 0)),
    t
  );
}
var Vc = new WeakMap();
function Xc(l, e) {
  let t = new Map();
  for (let i = 0; i < e.length; i++) {
    let a = e[i],
      r = a.kind === 'adjustment' ? Ni(e, i) : void 0;
    if (!r?.id) continue;
    let s = t.get(r.id) || [];
    (s.push({ kind: 'layer', layer: a, index: i }), t.set(r.id, s));
  }
  let n = i => {
    let a = [];
    for (let r of i) {
      if (r.kind === 'group') {
        a.push({ ...r, items: n(r.items) });
        continue;
      }
      if (r.layer.kind === 'adjustment' && Ni(e, r.index)) continue;
      let s = r.layer.id ? t.get(r.layer.id) : void 0;
      a.push({ ...r, effects: s });
    }
    return a;
  };
  return n(l);
}
function om(l) {
  return l
    ? {
        levels: 'Levels',
        curves: 'Curves',
        'hue/saturation':
          l.type === 'hue/saturation' && l.colorize && l.colorizeEnabled !== !1
            ? 'Hue/Saturation \xB7 Colorize'
            : 'Hue/Saturation',
        'brightness/contrast': 'Brightness/Contrast',
        exposure: 'Exposure',
        invert: 'Invert',
        'channel mixer': 'Channel Mixer',
        'color balance': 'Color Balance',
        'black & white': 'Black & White',
        threshold: 'Threshold',
        posterize: 'Posterize',
        'gradient map': 'Gradient Map',
      }[l.type]
    : 'Adjustment';
}
function Yc(l) {
  if (!l) return 'No editable parameters';
  if (l.type === 'levels') {
    let e = Array.isArray(l.rgb) ? void 0 : l.rgb;
    return `Input ${e?.shadowInput ?? 0}\u2013${e?.highlightInput ?? 255} \xB7 \u03B3 ${(e?.midtoneInput ?? 1).toFixed(2)}`;
  }
  if (l.type === 'curves')
    return `${(Array.isArray(l.rgb) ? l.rgb.length : 0) || 2} RGB control points`;
  if (l.type === 'hue/saturation') {
    let e = !!l.colorize && l.colorizeEnabled !== !1,
      t = e ? l.colorize : l.master || {};
    return `${e ? 'Colorize \xB7 ' : ''}H ${t.hue ?? 0}\xB0 \xB7 S ${t.saturation ?? 0} \xB7 L ${t.lightness ?? 0}`;
  }
  return l.type === 'brightness/contrast'
    ? `Brightness ${l.brightness ?? 0} \xB7 Contrast ${l.contrast ?? 0}`
    : l.type === 'exposure'
      ? `Exposure ${(l.exposure ?? 0).toFixed(1)} EV \xB7 Gamma ${(l.gamma ?? 1).toFixed(2)}`
      : l.type === 'invert'
        ? 'Invert RGB values'
        : l.type === 'channel mixer'
          ? l.monochrome
            ? 'Monochrome channel mix'
            : 'RGB channel matrix'
          : l.type === 'color balance'
            ? l.preserveLuminosity
              ? 'Preserve luminosity'
              : 'Independent channel balance'
            : l.type === 'black & white'
              ? 'Color-weighted grayscale'
              : l.type === 'threshold'
                ? `Threshold ${l.level ?? 128}`
                : l.type === 'posterize'
                  ? `${l.levels ?? 4} levels per channel`
                  : `${l.stops?.length || 2} color stops${l.reverse ? ' \xB7 reversed' : ''}`;
}
function Ni(l, e) {
  let t = l[e];
  if (t?.clipped)
    for (let n = e - 1; n >= 0; n--) {
      let i = l[n];
      if ((i.parentId || void 0) === (t.parentId || void 0) && !i.clipped) return i;
    }
}
function qc(l) {
  if (l.some(n => n.kind === 'group')) {
    let n = (i, a = []) =>
      l
        .map((r, s) => ({ layer: r, index: s }))
        .filter(r => (r.layer.parentId || void 0) === i)
        .reverse()
        .map(({ layer: r, index: s }) => {
          if (r.kind !== 'group') return { kind: 'layer', layer: r, index: s };
          let o = [...a, r.name || 'Group'],
            h = n(r.id, o),
            u = [],
            d = m =>
              m.forEach(p => {
                p.kind === 'layer' ? u.push(p.layer) : (p.group && u.push(p.group), d(p.items));
              });
          return (
            d(h),
            {
              kind: 'group',
              key: r.id,
              name: r.name || 'Group',
              path: o,
              items: h,
              layers: u,
              group: r,
            }
          );
        });
    return Xc(n(), l);
  }
  let e = [],
    t = new Map();
  for (let n = l.length - 1; n >= 0; n--) {
    let i = l[n],
      a = e,
      r = i.groupPath || [],
      s = i.groupIds || [];
    for (let o = 0; o < r.length; o++) {
      let h = s[o] || `group:${r.slice(0, o + 1).join('/')}`,
        u = t.get(h);
      (u ||
        ((u = {
          kind: 'group',
          key: h,
          name: r[o],
          path: r.slice(0, o + 1),
          items: [],
          layers: [],
        }),
        t.set(h, u),
        a.push(u)),
        u.layers.push(i),
        (a = u.items));
    }
    a.push({ kind: 'layer', layer: i, index: n });
  }
  return Xc(e, l);
}
var rr = class {
  constructor(e, t, n = {}) {
    this.resolvedCompositorBackend = 'javascript';
    ((this.manager = e),
      (this.onChange = t.onChange),
      (this.onBackgroundChange = t.onBackgroundChange),
      (this.onVisibilityChange = t.onVisibilityChange),
      (this.onPersist = t.onPersist),
      (this.onAddLayer = t.onAddLayer),
      (this.onExport = t.onExport),
      (this.onCompositorBackendChange = t.onCompositorBackendChange),
      (this.closable = n.closable !== !1),
      (this.root = null),
      (this.listEl = null),
      (this.titleEl = null),
      (this.minimizeBtn = null),
      (this.groupsBtn = null),
      (this.backgroundEl = null),
      (this.backgroundSlider = null),
      (this.backgroundBrightness = null),
      (this.compositorBackend = 'auto'),
      (this.compositorSelect = null),
      (this.themeBackgroundBrightness = 50),
      (this.movingLayerId = null),
      (this._pendingRemoveId = null),
      (this._pendingRemoveTimer = null),
      (this.collapsed = !1),
      (this.collapsedGroups = new Set()),
      (this.expandedAdjustments = new Set()),
      (this.expandedEffectStacks = new Set()));
  }
  _clearPendingRemove(e = !1) {
    (this._pendingRemoveTimer &&
      (clearTimeout(this._pendingRemoveTimer), (this._pendingRemoveTimer = null)),
      (this._pendingRemoveId = null),
      e && this.refresh());
  }
  mount() {
    if (this.root) return;
    let e = document.createElement('div');
    ((e.className = 'layers-panel'), e.setAttribute('hidden', ''));
    let t = document.createElement('div');
    t.className = 'layers-panel-header';
    let n = document.createElement('span');
    ((n.className = 'layers-panel-title'), (n.textContent = 'Layers'), (this.titleEl = n));
    let i = document.createElement('button');
    ((i.className = 'layers-btn layers-add'),
      (i.title = 'Add image(s) as layers'),
      (i.textContent = '+'),
      i.addEventListener('click', () => this.onAddLayer?.()));
    let a = document.createElement('button');
    ((a.className = 'layers-btn layers-export'),
      (a.title = 'Export as PNG, ORA, XCF, KRA, or PSD'),
      (a.textContent = 'Export\u2026'),
      a.addEventListener('click', () => this.onExport?.()));
    let r = document.createElement('select');
    ((r.className = 'layers-compositor-select'),
      (r.title = 'Strict layer compositor: unsupported features fail instead of falling back'));
    for (let [p, v] of [
      ['auto', 'Auto'],
      ['webgpu', 'WebGPU'],
      ['gpu', 'WebGL'],
      ['wasm', 'Wasm'],
      ['javascript', 'JS (diagnostic)'],
    ]) {
      let g = document.createElement('option');
      ((g.value = p), (g.textContent = v), r.appendChild(g));
    }
    ((r.value = this.compositorBackend),
      r.addEventListener('change', () => {
        ((this.compositorBackend = r.value),
          this.onCompositorBackendChange?.(this.compositorBackend));
      }),
      (this.compositorSelect = r));
    let s = document.createElement('button');
    ((s.className = 'layers-btn layers-minimize'),
      (s.title = 'Minimize / expand panel'),
      (s.textContent = '\u2013'),
      s.addEventListener('click', () => this.toggleCollapsed()),
      (this.minimizeBtn = s));
    let o = document.createElement('button');
    if (
      ((o.className = 'layers-btn layers-groups'),
      (o.title = 'Collapse or expand all document groups'),
      (o.textContent = '\u25A6'),
      o.addEventListener('click', () => {
        let p = [],
          v = g => {
            for (let w of g) w.kind === 'group' && (p.push(w.key), v(w.items));
          };
        if ((v(qc(this.manager.layers)), this.collapsedGroups.size)) this.collapsedGroups.clear();
        else for (let g of p) this.collapsedGroups.add(g);
        (this.refresh(), this.onPersist?.());
      }),
      (this.groupsBtn = o),
      t.appendChild(n),
      t.appendChild(r),
      t.appendChild(i),
      t.appendChild(a),
      t.appendChild(o),
      t.appendChild(s),
      this.closable)
    ) {
      let p = document.createElement('button');
      ((p.className = 'layers-btn layers-close'),
        (p.title = 'Close panel'),
        (p.textContent = '\xD7'),
        p.addEventListener('click', () => this.hide()),
        t.appendChild(p));
    }
    let h = document.createElement('div');
    h.className = 'layers-list';
    let u = document.createElement('label');
    u.className = 'layers-background';
    let d = document.createElement('span');
    d.textContent = 'Background';
    let m = document.createElement('input');
    ((m.type = 'range'),
      (m.className = 'layers-background-slider'),
      (m.min = '0'),
      (m.max = '100'),
      (m.step = '1'),
      (m.dataset.defaultValue = String(this.themeBackgroundBrightness)),
      (m.value = String(this.backgroundBrightness ?? this.themeBackgroundBrightness)),
      (m.title =
        'Preview background: darker to lighter while retaining the theme tint \xB7 Double-click to restore the VS Code theme background'),
      m.addEventListener('input', () => {
        ((this.backgroundBrightness = Number(m.value)),
          this.onBackgroundChange?.(this.backgroundBrightness));
      }),
      m.addEventListener('dblclick', p => {
        (p.preventDefault(),
          p.stopPropagation(),
          (this.backgroundBrightness = null),
          (m.value = String(this.themeBackgroundBrightness)),
          this.onBackgroundChange?.(null));
      }),
      u.append(d, m),
      (this.backgroundEl = u),
      (this.backgroundSlider = m),
      e.appendChild(t),
      e.appendChild(h),
      document.body.appendChild(e),
      (this.root = e),
      (this.listEl = h),
      window.addEventListener(
        'keydown',
        p => {
          if (
            !this.isVisible() ||
            p.key.toLowerCase() !== 'z' ||
            (!p.ctrlKey && !p.metaKey) ||
            p.altKey ||
            p.target?.matches(
              'textarea, [contenteditable="true"], input:not([type="range"]):not([type="checkbox"]):not([type="color"])'
            )
          )
            return;
          let g = p.shiftKey;
          (p.preventDefault(),
            p.stopPropagation(),
            p.stopImmediatePropagation(),
            g && this.manager.canRedo()
              ? this._redo()
              : !g && this.manager.canUndo() && this._undo());
        },
        !0
      ),
      this._applyCollapsed(),
      this.refresh());
  }
  _undo() {
    (this._clearPendingRemove(!1), this.manager.undo() && this._afterHistoryRestore());
  }
  _redo() {
    (this._clearPendingRemove(!1), this.manager.redo() && this._afterHistoryRestore());
  }
  _afterHistoryRestore() {
    (this.movingLayerId &&
      !this.manager.layers.some(e => e.id === this.movingLayerId) &&
      (this.movingLayerId = null),
      this.refresh(),
      this.onChange());
  }
  setThemeBackgroundBrightness(e) {
    ((this.themeBackgroundBrightness = Math.max(0, Math.min(100, Math.round(e)))),
      this.backgroundSlider &&
        ((this.backgroundSlider.dataset.defaultValue = String(this.themeBackgroundBrightness)),
        this.backgroundBrightness === null &&
          (this.backgroundSlider.value = String(this.themeBackgroundBrightness))));
  }
  setCompositorBackend(e) {
    ((this.compositorBackend = e), this.compositorSelect && (this.compositorSelect.value = e));
  }
  setResolvedCompositorBackend(e) {
    this.resolvedCompositorBackend = e;
    let t = this.compositorSelect?.querySelector('option[value="auto"]');
    if (t) {
      let n = { webgpu: 'WebGPU', gpu: 'WebGL', wasm: 'Wasm', javascript: 'JS' };
      t.textContent = `Auto (${n[e]})`;
    }
  }
  isVisible() {
    return !!this.root && !this.root.hasAttribute('hidden');
  }
  toggle() {
    this.isVisible() ? this.hide() : this.show();
  }
  show(e = {}) {
    let t = this.isVisible();
    (this.mount(),
      this.root?.removeAttribute('hidden'),
      this.refresh(),
      !t && e.notify !== !1 && this.onVisibilityChange?.(!0));
  }
  hide() {
    (this.root?.setAttribute('hidden', ''),
      (this.movingLayerId = null),
      this.onVisibilityChange?.(!1));
  }
  toggleCollapsed() {
    ((this.collapsed = !this.collapsed), this._applyCollapsed(), this.onPersist?.());
  }
  _applyCollapsed() {
    if (this.root) {
      if (
        (this.root.classList.toggle('layers-panel--collapsed', this.collapsed),
        this.minimizeBtn && (this.minimizeBtn.textContent = this.collapsed ? '\u25B8' : '\u2013'),
        this.titleEl)
      ) {
        let e = this.manager.layers.length;
        this.titleEl.textContent = `${e} layer${e === 1 ? '' : 's'}`;
      }
      this.groupsBtn &&
        (this.groupsBtn.disabled = !this.manager.layers.some(
          e => e.kind === 'group' || e.groupPath?.length
        ));
    }
  }
  refresh() {
    if (!this.listEl) return;
    this.listEl.textContent = '';
    let e = this.manager.layers,
      t = qc(e),
      n = document.createDocumentFragment(),
      i = (a, r) => {
        for (let s of a) {
          if (s.kind === 'layer') {
            let o = s.effects || [];
            if (
              (n.appendChild(this._buildRow(s.layer, s.index, r, !1, o)),
              s.layer.kind !== 'adjustment' &&
                !!s.layer.data &&
                this.expandedEffectStacks.has(s.layer.id))
            ) {
              n.appendChild(this._buildFilterShelf(s.layer, r));
              for (let u of [...o].reverse())
                n.appendChild(this._buildRow(u.layer, u.index, r + 1, !0));
            }
            continue;
          }
          (n.appendChild(this._buildGroupRow(s, r)),
            this.collapsedGroups.has(s.key) || i(s.items, r + 1));
        }
      };
    (i(t, 0),
      this.listEl.appendChild(n),
      this.backgroundEl && this.listEl.appendChild(this.backgroundEl),
      this._applyCollapsed());
  }
  _buildFilterShelf(e, t) {
    let n = e.id,
      i = document.createElement('div');
    ((i.className = 'layer-filter-shelf expanded'),
      i.style.setProperty('--layer-depth', String(t)));
    let a = document.createElement('select');
    ((a.className = 'layer-add-filter'), (a.title = 'Add a non-destructive filter to this layer'));
    for (let [r, s] of [
      ['', '+ Add filter\u2026'],
      ['levels', 'Levels'],
      ['curves', 'Curves'],
      ['hue/saturation', 'Hue/Saturation'],
      ['brightness/contrast', 'Brightness/Contrast'],
      ['exposure', 'Exposure / Gamma'],
      ['invert', 'Invert'],
      ['channel mixer', 'Channel Mixer'],
      ['color balance', 'Color Balance'],
      ['black & white', 'Black & White'],
      ['threshold', 'Threshold'],
      ['posterize', 'Posterize'],
      ['gradient map', 'Gradient Map'],
    ]) {
      let o = document.createElement('option');
      ((o.value = r), (o.textContent = s), a.appendChild(o));
    }
    return (
      a.addEventListener('change', () => {
        if (!a.value) return;
        let r = this.manager.addAdjustmentLayer(n, a.value);
        (r && this.expandedAdjustments.add(r), this.refresh(), this.onChange());
      }),
      i.appendChild(a),
      i
    );
  }
  _buildGroupRow(e, t) {
    let n = document.createElement('div');
    ((n.className = 'layer-group-row'),
      n.style.setProperty('--layer-depth', String(t)),
      (n.title = e.path.join(' / ')));
    let i = document.createElement('button');
    ((i.className = 'layer-group-toggle'),
      (i.textContent = this.collapsedGroups.has(e.key) ? '\u25B8' : '\u25BE'),
      (i.title = this.collapsedGroups.has(e.key) ? 'Expand group' : 'Collapse group'),
      i.addEventListener('click', u => {
        (u.stopPropagation(),
          this.collapsedGroups.has(e.key)
            ? this.collapsedGroups.delete(e.key)
            : this.collapsedGroups.add(e.key),
          this.refresh(),
          this.onPersist?.());
      }),
      n.appendChild(i));
    let a = e.group ? [e.group] : e.layers,
      r = a.filter(u => u.visible !== !1).length,
      s = document.createElement('input');
    ((s.type = 'checkbox'),
      (s.className = 'layer-visible layer-group-visible'),
      (s.checked = r === a.length),
      (s.indeterminate = r > 0 && r < a.length),
      (s.title =
        'Toggle all layers in this group (Shift-click to solo; Shift-click again to show all)'),
      s.addEventListener('click', u => {
        if (!u.shiftKey) return;
        (u.preventDefault(), u.stopPropagation());
        let d = new Set([...(e.group ? [e.group] : []), ...e.layers].map(m => m.id));
        (this.manager.toggleSoloLayers(d), this.refresh(), this.onChange());
      }),
      s.addEventListener('change', () => {
        let u = r !== a.length;
        this.manager.beginHistoryGroup();
        for (let d of a) this.manager.updateLayer(d.id, { visible: u });
        (this.manager.endHistoryGroup(), this.refresh(), this.onChange());
      }),
      n.appendChild(s));
    let o = document.createElement('span');
    ((o.className = 'layer-group-name'),
      (o.textContent = e.name),
      o.addEventListener('click', () => i.click()),
      n.appendChild(o));
    let h = document.createElement('span');
    if (
      ((h.className = 'layer-group-count'),
      (h.textContent = String(e.layers.filter(u => u.kind !== 'group').length)),
      n.appendChild(h),
      e.group)
    ) {
      let u = document.createElement('div');
      u.className = 'layer-group-controls';
      let d = document.createElement('select');
      ((d.className = 'layer-blend layer-group-blend'), (d.title = 'Group blend mode'));
      for (let p of mn.filter(v => !v.mask)) {
        let v = document.createElement('option');
        ((v.value = p.id),
          (v.textContent = p.label),
          (v.selected = (e.group.blendMode || 'normal') === p.id),
          d.appendChild(v));
      }
      (d.addEventListener('change', () => {
        (this.manager.updateLayer(e.key, { blendMode: d.value }), this.onChange());
      }),
        u.appendChild(d));
      let m = document.createElement('input');
      ((m.type = 'range'),
        (m.className = 'layer-opacity layer-group-opacity'),
        (m.min = '0'),
        (m.max = '100'),
        (m.dataset.defaultValue = '100'),
        (m.value = String(Math.round((e.group.opacity ?? 1) * 100))),
        (m.title = 'Group opacity \xB7 Double-click to reset to 100%'),
        this._bindContinuousHistory(m, () => this.onChange({ settled: !0 })),
        m.addEventListener('input', () => {
          (this.manager.updateLayer(e.key, { opacity: Number(m.value) / 100 }),
            this.onChange({ interactive: !0 }));
        }),
        m.addEventListener('change', () => m.blur()),
        u.appendChild(m),
        n.appendChild(u));
    }
    return n;
  }
  _paintLayerThumbnail(e, t, n) {
    if (!t.data || t.width <= 0 || t.height <= 0) return;
    let i = t.data,
      a = Vc.get(i);
    if (!a) {
      let E = 0,
        L = 0,
        M = t.width,
        T = t.height;
      if (t.channels === 2 || t.channels === 4) {
        ((E = t.width), (L = t.height), (M = 0), (T = 0));
        for (let _ = 0; _ < t.height; _++)
          for (let I = 0; I < t.width; I++)
            Number(t.data[(_ * t.width + I) * t.channels + t.channels - 1]) > 0 &&
              ((E = Math.min(E, I)),
              (L = Math.min(L, _)),
              (M = Math.max(M, I + 1)),
              (T = Math.max(T, _ + 1)));
        (M <= E || T <= L) && ((E = 0), (L = 0), (M = t.width), (T = t.height));
      }
      ((a = { left: E, top: L, right: M, bottom: T }), Vc.set(i, a));
    }
    let r = Math.max(1, a.right - a.left),
      s = Math.max(1, a.bottom - a.top),
      o = Math.min(44 / r, 44 / s),
      h = Math.max(1, Math.round(r * o)),
      u = Math.max(1, Math.round(s * o)),
      d = new Uint8Array(h * u * 4),
      m = t.typeMax || 255;
    for (let E = 0; E < u; E++)
      for (let L = 0; L < h; L++) {
        let M = Math.min(a.right - 1, a.left + Math.floor(((L + 0.5) * r) / h)),
          _ =
            (Math.min(a.bottom - 1, a.top + Math.floor(((E + 0.5) * s) / u)) * t.width + M) *
            t.channels,
          I = (E * h + L) * 4,
          A = N =>
            Math.max(
              0,
              Math.min(255, Math.round((Number(t.data[_ + Math.min(N, t.channels - 1)]) * 255) / m))
            );
        t.channels <= 2
          ? ((d[I] = d[I + 1] = d[I + 2] = A(0)), (d[I + 3] = t.channels === 2 ? A(1) : 255))
          : ((d[I] = A(0)),
            (d[I + 1] = A(1)),
            (d[I + 2] = A(2)),
            (d[I + 3] = t.channels === 4 ? A(3) : 255));
      }
    let p = {
        ...t,
        data: d,
        width: h,
        height: u,
        channels: 4,
        typeMax: 255,
        offsetX: 0,
        offsetY: 0,
        opacity: 1,
        blendMode: 'normal',
        visible: !0,
        rasterMask: void 0,
      },
      v = n.map(E => ({ ...E, width: 1, height: 1, offsetX: 0, offsetY: 0, rasterMask: void 0 })),
      g = Jn([p, ...v], h, u),
      w = e.getContext('2d');
    if (!w) return;
    w.clearRect(0, 0, e.width, e.height);
    let k = w.createImageData(h, u);
    for (let E = 0; E < h * u; E++) {
      let L = E * g.channels,
        M = E * 4;
      if (g.channels === 1) {
        let T = Math.max(0, Math.min(255, Math.round(g.data[L])));
        ((k.data[M] = k.data[M + 1] = k.data[M + 2] = T), (k.data[M + 3] = 255));
      } else
        ((k.data[M] = Math.max(0, Math.min(255, Math.round(g.data[L])))),
          (k.data[M + 1] = Math.max(0, Math.min(255, Math.round(g.data[L + 1])))),
          (k.data[M + 2] = Math.max(0, Math.min(255, Math.round(g.data[L + 2])))),
          (k.data[M + 3] =
            g.channels === 4 ? Math.max(0, Math.min(255, Math.round(g.data[L + 3]))) : 255));
    }
    w.putImageData(k, Math.floor((e.width - h) / 2), Math.floor((e.height - u) / 2));
  }
  _refreshAdjustmentThumbnail(e) {
    let t = this.manager.layers.indexOf(e),
      n = Ni(this.manager.layers, t);
    if (!n?.id || !this.listEl) return;
    let i = this.manager.layers.indexOf(n),
      a = [];
    for (let r = i + 1; r < this.manager.layers.length && this.manager.layers[r].clipped; r++)
      (this.manager.layers[r].parentId || void 0) === (n.parentId || void 0) &&
        a.push(this.manager.layers[r]);
    this.listEl.querySelectorAll('.layer-thumbnail').forEach(r => {
      r.dataset.layerId === n.id && this._paintLayerThumbnail(r, n, a);
    });
  }
  _buildAdjustmentEditor(e, t) {
    let n = document.createElement('details');
    ((n.className = 'layer-adjustment-editor'),
      (n.open = this.expandedAdjustments.has(t)),
      n.addEventListener('toggle', () => {
        n.open ? this.expandedAdjustments.add(t) : this.expandedAdjustments.delete(t);
      }));
    let i = document.createElement('summary');
    ((i.className = 'layer-adjustment-summary'),
      (i.textContent = Yc(e.adjustment)),
      (i.title = 'Expand to edit this adjustment'),
      n.appendChild(i));
    let a = document.createElement('div');
    ((a.className = 'layer-adjustment-controls'), n.appendChild(a));
    let r = (o, h = !0) => {
      (this.manager.updateLayer(t, { adjustment: o }),
        (i.textContent = Yc(o)),
        this._refreshAdjustmentThumbnail(e),
        this.onChange({ interactive: h }));
    };
    if (e.adjustment?.type === 'levels') this._buildLevelsControls(e, a, r);
    else if (e.adjustment?.type === 'curves') this._buildCurvesControls(e, a, r);
    else if (e.adjustment?.type === 'hue/saturation')
      this._buildHueControls(e, a, r, () => this.refresh());
    else if (e.adjustment?.type === 'brightness/contrast' || e.adjustment?.type === 'exposure')
      this._buildToneControls(e, a, r);
    else if (e.adjustment?.type === 'channel mixer') this._buildChannelMixerControls(e, a, r);
    else if (e.adjustment?.type === 'color balance') this._buildColorBalanceControls(e, a, r);
    else if (e.adjustment?.type === 'black & white') this._buildBlackWhiteControls(e, a, r);
    else if (e.adjustment?.type === 'threshold' || e.adjustment?.type === 'posterize')
      this._buildQuantizeControls(e, a, r);
    else if (e.adjustment?.type === 'gradient map') this._buildGradientMapControls(e, a, r);
    else if (e.adjustment?.type === 'invert') {
      let o = document.createElement('div');
      ((o.className = 'layer-adjustment-note'),
        (o.textContent = 'No parameters \u2014 every RGB value is replaced by its inverse.'),
        a.appendChild(o));
    }
    let s = document.createElement('button');
    return (
      (s.type = 'button'),
      (s.className = 'layers-btn layer-filter-remove'),
      (s.textContent = '\xD7'),
      s.setAttribute('aria-label', 'Remove filter'),
      (s.title = 'Remove this filter (can be undone)'),
      s.addEventListener('click', () => {
        (this.expandedAdjustments.delete(t),
          this.manager.removeLayer(t),
          this.refresh(),
          this.onChange());
      }),
      a.appendChild(s),
      n
    );
  }
  _buildLevelsControls(e, t, n) {
    let i = this._adjustmentChannelSelect();
    t.appendChild(this._labeledAdjustmentControl('Channel', i));
    let a = document.createElement('div');
    ((a.className = 'layer-adjustment-channel-controls'), t.appendChild(a));
    let r = () => {
      a.textContent = '';
      let s = i.value,
        o = e.adjustment,
        h = Array.isArray(o[s]) ? void 0 : o[s],
        u = (d, m) => {
          let p = e.adjustment,
            v = Array.isArray(p[s]) ? void 0 : p[s];
          n({ ...p, [s]: { ...v, [d]: m } });
        };
      a.append(
        this._adjustmentRange('Black in', 0, 255, 1, h?.shadowInput ?? 0, 0, d =>
          u('shadowInput', d)
        ),
        this._adjustmentRange(
          'Gamma',
          0.1,
          9.99,
          0.01,
          h?.midtoneInput ?? 1,
          1,
          d => u('midtoneInput', d),
          2
        ),
        this._adjustmentRange('White in', 0, 255, 1, h?.highlightInput ?? 255, 255, d =>
          u('highlightInput', d)
        ),
        this._adjustmentRange('Black out', 0, 255, 1, h?.shadowOutput ?? 0, 0, d =>
          u('shadowOutput', d)
        ),
        this._adjustmentRange('White out', 0, 255, 1, h?.highlightOutput ?? 255, 255, d =>
          u('highlightOutput', d)
        )
      );
    };
    (i.addEventListener('change', r), r());
  }
  _buildCurvesControls(e, t, n) {
    let i = this._adjustmentChannelSelect();
    t.appendChild(this._labeledAdjustmentControl('Channel', i));
    let a = 'http://www.w3.org/2000/svg',
      r = document.createElementNS(a, 'svg');
    (r.classList.add('layer-curve-graph'),
      r.setAttribute('viewBox', '0 0 255 255'),
      r.setAttribute('role', 'img'),
      r.setAttribute('aria-label', 'Editable tone curve'),
      t.appendChild(r));
    let s = document.createElement('label');
    s.className = 'layer-adjustment-field layer-adjustment-points';
    let o = document.createElement('span');
    o.textContent = 'Points';
    let h = document.createElement('input');
    ((h.type = 'text'),
      (h.className = 'layer-adjustment-points-input'),
      (h.title = 'Comma-separated input:output control points, for example 0:0, 128:160, 255:255'));
    let u = () => {
        let g = e.adjustment[i.value];
        return Array.isArray(g) && g.length
          ? g.map(w => ({ ...w })).sort((w, k) => w.input - k.input)
          : [
              { input: 0, output: 0 },
              { input: 255, output: 255 },
            ];
      },
      d = (v, g = !0) => {
        let w = e.adjustment;
        (n({ ...w, [i.value]: v }, g), p());
      },
      m = v => {
        let g = r.getBoundingClientRect();
        return {
          input: Math.max(
            0,
            Math.min(255, Math.round(((v.clientX - g.left) / Math.max(1, g.width)) * 255))
          ),
          output: Math.max(
            0,
            Math.min(255, Math.round(255 - ((v.clientY - g.top) / Math.max(1, g.height)) * 255))
          ),
        };
      },
      p = () => {
        let v = u();
        ((h.value = v.map(M => `${M.input}:${M.output}`).join(', ')),
          h.classList.remove('invalid'),
          (r.textContent = ''));
        let g = document.createElementNS(a, 'title');
        ((g.textContent =
          'Drag points \xB7 Double-click empty space to add \xB7 Double-click a point to remove'),
          r.appendChild(g));
        let w = document.createElementNS(a, 'rect');
        (w.setAttribute('width', '255'),
          w.setAttribute('height', '255'),
          w.classList.add('layer-curve-background'),
          r.appendChild(w));
        for (let M of [63.75, 127.5, 191.25])
          for (let T of [!0, !1]) {
            let _ = document.createElementNS(a, 'line');
            (_.classList.add('layer-curve-grid'),
              _.setAttribute('x1', String(T ? M : 0)),
              _.setAttribute('x2', String(T ? M : 255)),
              _.setAttribute('y1', String(T ? 0 : M)),
              _.setAttribute('y2', String(T ? 255 : M)),
              r.appendChild(_));
          }
        let k = document.createElementNS(a, 'line');
        (k.classList.add('layer-curve-identity'),
          k.setAttribute('x1', '0'),
          k.setAttribute('y1', '255'),
          k.setAttribute('x2', '255'),
          k.setAttribute('y2', '0'),
          r.appendChild(k));
        let E = document.createElementNS(a, 'path');
        E.classList.add('layer-curve-path', `layer-curve-${i.value}`);
        let L = '';
        for (let M = 0; M <= 255; M = Math.min(255, M + 2)) {
          let T = Pn(v, M);
          if (((L += `${M ? ' L' : 'M'} ${M} ${255 - T}`), M === 255)) break;
        }
        (E.setAttribute('d', L),
          r.appendChild(E),
          v.forEach((M, T) => {
            let _ = document.createElementNS(a, 'circle');
            (_.classList.add('layer-curve-point', `layer-curve-${i.value}`),
              _.setAttribute('cx', String(M.input)),
              _.setAttribute('cy', String(255 - M.output)),
              _.setAttribute('r', '5'),
              _.setAttribute('tabindex', '0'),
              _.setAttribute('aria-label', `Input ${M.input}, output ${M.output}`),
              _.addEventListener('pointerdown', I => {
                (I.preventDefault(), I.stopPropagation(), this.manager.beginHistoryGroup());
                let A = z => {
                    let X = m(z),
                      ae = u(),
                      Q = T === 0 ? 0 : ae[T - 1].input + 1,
                      j = T === ae.length - 1 ? 255 : ae[T + 1].input - 1;
                    ((ae[T] = { input: Math.max(Q, Math.min(j, X.input)), output: X.output }),
                      d(ae));
                  },
                  N = () => {
                    (window.removeEventListener('pointermove', A),
                      window.removeEventListener('pointerup', N),
                      this.manager.endHistoryGroup(),
                      this._applyCollapsed(),
                      this.onChange({ settled: !0 }));
                  };
                (window.addEventListener('pointermove', A),
                  window.addEventListener('pointerup', N));
              }),
              _.addEventListener('dblclick', I => {
                (I.preventDefault(),
                  I.stopPropagation(),
                  !(v.length <= 2) &&
                    d(
                      v.filter((A, N) => N !== T),
                      !1
                    ));
              }),
              r.appendChild(_));
          }));
      };
    (r.addEventListener('dblclick', v => {
      if (v.target.classList.contains('layer-curve-point')) return;
      let g = m(v),
        w = u();
      w.some(k => k.input === g.input) ||
        (w.push(g), w.sort((k, E) => k.input - E.input), d(w, !1));
    }),
      h.addEventListener('change', () => {
        let v = h.value
          .split(',')
          .map(w => w.trim().split(':').map(Number))
          .filter(w => w.length === 2 && w.every(Number.isFinite))
          .map(([w, k]) => ({
            input: Math.max(0, Math.min(255, w)),
            output: Math.max(0, Math.min(255, k)),
          }))
          .sort((w, k) => w.input - k.input);
        if (v.length < 2) {
          h.classList.add('invalid');
          return;
        }
        let g = e.adjustment;
        (n({ ...g, [i.value]: v }, !1), p());
      }),
      i.addEventListener('change', p),
      s.append(o, h),
      t.appendChild(s),
      p());
  }
  _buildHueControls(e, t, n, i) {
    let a = e.adjustment,
      r = !!a.colorize && a.colorizeEnabled !== !1,
      s = document.createElement('label');
    ((s.className = 'layer-adjustment-colorize'),
      (s.title =
        'Colorize assigns a hue and saturation to every pixel, including neutral grayscale. Off: rotate colors that already exist.'));
    let o = document.createElement('input');
    ((o.type = 'checkbox'),
      (o.checked = r),
      s.append(o, ' Colorize'),
      t.appendChild(s),
      o.addEventListener('change', () => {
        let v = e.adjustment;
        (n({
          ...v,
          colorizeEnabled: o.checked,
          colorize: v.colorize || { hue: 0, saturation: 100, lightness: 0 },
        }),
          i());
      }));
    let h = this._adjustmentChannelSelect(!0);
    r || t.appendChild(this._labeledAdjustmentControl('Range', h));
    let u = () => (r ? 'colorize' : h.value),
      d = () => e.adjustment[u()] || {},
      m = document.createElement('div');
    ((m.className = 'layer-adjustment-channel-controls'), t.appendChild(m));
    let p = () => {
      m.textContent = '';
      let v = d(),
        g = (w, k) => {
          let E = e.adjustment,
            L = r ? 'colorize' : h.value;
          n({ ...E, [L]: { ...(E[L] || {}), [w]: k } });
        };
      m.append(
        this._adjustmentRange(
          'Hue (\xB0)',
          -180,
          180,
          1,
          v.hue ?? 0,
          0,
          w => g('hue', w),
          0,
          '\xB0'
        ),
        this._adjustmentRange(
          'Saturation',
          r ? 0 : -100,
          100,
          1,
          v.saturation ?? (r ? 100 : 0),
          r ? 100 : 0,
          w => g('saturation', w)
        ),
        this._adjustmentRange('Lightness', -100, 100, 1, v.lightness ?? 0, 0, w =>
          g('lightness', w)
        )
      );
    };
    (h.addEventListener('change', p), p());
  }
  _buildToneControls(e, t, n) {
    if (e.adjustment?.type === 'brightness/contrast') {
      let r = (s, o) => n({ ...e.adjustment, [s]: o });
      t.append(
        this._adjustmentRange('Brightness', -100, 100, 1, e.adjustment.brightness ?? 0, 0, s =>
          r('brightness', s)
        ),
        this._adjustmentRange('Contrast', -100, 100, 1, e.adjustment.contrast ?? 0, 0, s =>
          r('contrast', s)
        )
      );
      return;
    }
    let i = e.adjustment,
      a = (r, s) => n({ ...e.adjustment, [r]: s });
    t.append(
      this._adjustmentRange(
        'Exposure',
        -5,
        5,
        0.1,
        i.exposure ?? 0,
        0,
        r => a('exposure', r),
        1,
        ' EV'
      ),
      this._adjustmentRange('Offset', -0.5, 0.5, 0.01, i.offset ?? 0, 0, r => a('offset', r), 2),
      this._adjustmentRange('Gamma', 0.1, 5, 0.01, i.gamma ?? 1, 1, r => a('gamma', r), 2)
    );
  }
  _buildChannelMixerControls(e, t, n) {
    let i = e.adjustment,
      a = document.createElement('label');
    a.className = 'layer-adjustment-colorize';
    let r = document.createElement('input');
    ((r.type = 'checkbox'),
      (r.checked = !!i.monochrome),
      a.append(r, ' Monochrome'),
      t.appendChild(a));
    let s = document.createElement('select');
    s.className = 'layer-adjustment-channel';
    for (let [u, d] of i.monochrome
      ? [['gray', 'Gray']]
      : [
          ['red', 'Red output'],
          ['green', 'Green output'],
          ['blue', 'Blue output'],
        ]) {
      let m = document.createElement('option');
      ((m.value = u), (m.textContent = d), s.appendChild(m));
    }
    t.appendChild(this._labeledAdjustmentControl('Output', s));
    let o = document.createElement('div');
    ((o.className = 'layer-adjustment-channel-controls'), t.appendChild(o));
    let h = () => {
      o.textContent = '';
      let u = e.adjustment,
        d = s.value,
        m =
          d === 'red'
            ? { red: 100, green: 0, blue: 0, constant: 0 }
            : d === 'green'
              ? { red: 0, green: 100, blue: 0, constant: 0 }
              : d === 'blue'
                ? { red: 0, green: 0, blue: 100, constant: 0 }
                : { red: 40, green: 40, blue: 20, constant: 0 },
        p = u[d] || m,
        v = (g, w) => {
          let k = e.adjustment;
          n({ ...k, [d]: { ...(k[d] || m), [g]: w } });
        };
      for (let g of ['red', 'green', 'blue', 'constant'])
        o.appendChild(
          this._adjustmentRange(
            g[0].toUpperCase() + g.slice(1),
            -200,
            200,
            1,
            p[g] ?? m[g],
            m[g],
            w => v(g, w),
            0,
            '%'
          )
        );
    };
    (r.addEventListener('change', () => {
      (n({ ...e.adjustment, monochrome: r.checked }), this.refresh());
    }),
      s.addEventListener('change', h),
      h());
  }
  _buildColorBalanceControls(e, t, n) {
    let i = e.adjustment,
      a = document.createElement('select');
    a.className = 'layer-adjustment-channel';
    for (let u of ['shadows', 'midtones', 'highlights']) {
      let d = document.createElement('option');
      ((d.value = u), (d.textContent = u[0].toUpperCase() + u.slice(1)), a.appendChild(d));
    }
    t.appendChild(this._labeledAdjustmentControl('Range', a));
    let r = document.createElement('label');
    r.className = 'layer-adjustment-colorize';
    let s = document.createElement('input');
    ((s.type = 'checkbox'),
      (s.checked = i.preserveLuminosity !== !1),
      r.append(s, ' Preserve luminosity'),
      t.appendChild(r));
    let o = document.createElement('div');
    ((o.className = 'layer-adjustment-channel-controls'), t.appendChild(o));
    let h = () => {
      o.textContent = '';
      let u = a.value,
        d = e.adjustment[u] || {},
        m = (p, v) => {
          let g = e.adjustment;
          n({ ...g, [u]: { ...(g[u] || {}), [p]: v } });
        };
      o.append(
        this._adjustmentRange('Cyan \u2194 Red', -100, 100, 1, d.cyanRed ?? 0, 0, p =>
          m('cyanRed', p)
        ),
        this._adjustmentRange('Magenta \u2194 Green', -100, 100, 1, d.magentaGreen ?? 0, 0, p =>
          m('magentaGreen', p)
        ),
        this._adjustmentRange('Yellow \u2194 Blue', -100, 100, 1, d.yellowBlue ?? 0, 0, p =>
          m('yellowBlue', p)
        )
      );
    };
    (s.addEventListener('change', () => n({ ...e.adjustment, preserveLuminosity: s.checked })),
      a.addEventListener('change', h),
      h());
  }
  _buildBlackWhiteControls(e, t, n) {
    let i = { reds: 40, yellows: 60, greens: 40, cyans: 60, blues: 20, magentas: 80 };
    for (let a of Object.keys(i)) {
      let r = e.adjustment;
      t.appendChild(
        this._adjustmentRange(
          a[0].toUpperCase() + a.slice(1),
          -200,
          300,
          1,
          r[a] ?? i[a],
          i[a],
          s => {
            n({ ...e.adjustment, [a]: s });
          },
          0,
          '%'
        )
      );
    }
  }
  _buildQuantizeControls(e, t, n) {
    if (e.adjustment?.type === 'threshold')
      t.appendChild(
        this._adjustmentRange('Threshold', 0, 255, 1, e.adjustment.level ?? 128, 128, i =>
          n({ ...e.adjustment, level: i })
        )
      );
    else {
      let i = e.adjustment;
      t.appendChild(
        this._adjustmentRange('Levels', 2, 32, 1, i.levels ?? 4, 4, a =>
          n({ ...e.adjustment, levels: a })
        )
      );
    }
  }
  _buildGradientMapControls(e, t, n) {
    let i = e.adjustment,
      a = i.stops?.length
        ? i.stops
        : [
            { position: 0, color: { r: 0, g: 0, b: 0 } },
            { position: 1, color: { r: 255, g: 255, b: 255 } },
          ],
      r = d =>
        `#${[d.r, d.g, d.b]
          .map(m =>
            Math.max(0, Math.min(255, Math.round(m)))
              .toString(16)
              .padStart(2, '0')
          )
          .join('')}`,
      s = d => ({
        r: parseInt(d.slice(1, 3), 16),
        g: parseInt(d.slice(3, 5), 16),
        b: parseInt(d.slice(5, 7), 16),
      }),
      o = document.createElement('div');
    o.className = 'layer-gradient-colors';
    for (let [d, m] of [
      ['Dark', 0],
      ['Light', a.length - 1],
    ]) {
      let p = document.createElement('input');
      ((p.type = 'color'),
        (p.value = r(a[m].color)),
        (p.title = `${d} gradient color`),
        this._bindContinuousHistory(p, () => this.onChange({ settled: !0 })));
      let v = this._labeledAdjustmentControl(d, p);
      (o.appendChild(v),
        p.addEventListener('input', () => {
          let g = e.adjustment,
            w = [...(g.stops || a)];
          ((w[m] = { ...w[m], color: s(p.value) }), n({ ...g, stops: w }));
        }));
    }
    let h = document.createElement('label');
    h.className = 'layer-adjustment-colorize';
    let u = document.createElement('input');
    ((u.type = 'checkbox'),
      (u.checked = !!i.reverse),
      h.append(u, ' Reverse'),
      u.addEventListener('change', () => n({ ...e.adjustment, reverse: u.checked })),
      t.append(o, h));
  }
  _adjustmentChannelSelect(e = !1) {
    let t = document.createElement('select');
    t.className = 'layer-adjustment-channel';
    let n = e
      ? [
          ['master', 'Master'],
          ['reds', 'Reds'],
          ['yellows', 'Yellows'],
          ['greens', 'Greens'],
          ['cyans', 'Cyans'],
          ['blues', 'Blues'],
          ['magentas', 'Magentas'],
        ]
      : [
          ['rgb', 'RGB'],
          ['red', 'Red'],
          ['green', 'Green'],
          ['blue', 'Blue'],
        ];
    for (let [i, a] of n) {
      let r = document.createElement('option');
      ((r.value = i), (r.textContent = a), t.appendChild(r));
    }
    return t;
  }
  _labeledAdjustmentControl(e, t) {
    let n = document.createElement('label');
    n.className = 'layer-adjustment-field';
    let i = document.createElement('span');
    return ((i.textContent = e), n.append(i, t), n);
  }
  _bindContinuousHistory(e, t) {
    let n = !1,
      i = () => {
        n || ((n = !0), this.manager.beginHistoryGroup());
      },
      a = () => {
        n && ((n = !1), this.manager.endHistoryGroup(), this._applyCollapsed(), t?.());
      };
    (e.addEventListener('pointerdown', i),
      e.addEventListener('keydown', i),
      e.addEventListener('input', i),
      e.addEventListener('change', a),
      e.addEventListener('blur', a));
  }
  _adjustmentRange(e, t, n, i, a, r, s, o = 0, h = '') {
    let u = document.createElement('label');
    u.className = 'layer-adjustment-range';
    let d = document.createElement('span');
    d.textContent = e;
    let m = document.createElement('input');
    ((m.type = 'range'),
      (m.min = String(t)),
      (m.max = String(n)),
      (m.step = String(i)),
      (m.value = String(a)),
      (m.dataset.defaultValue = String(r)),
      (m.title = `${e} \xB7 Double-click to reset`));
    let p = document.createElement('output');
    return (
      (p.textContent = `${Number(a).toFixed(o)}${h}`),
      this._bindContinuousHistory(m, () => this.onChange({ settled: !0 })),
      m.addEventListener('input', () => {
        let v = Number(m.value);
        ((p.textContent = `${v.toFixed(o)}${h}`), s(v));
      }),
      u.append(d, m, p),
      u
    );
  }
  _openFilterCopyMenu(e, t, n) {
    document.querySelector('.layer-filter-copy-menu')?.remove();
    let i = document.createElement('div');
    ((i.className = 'custom-context-menu layer-filter-copy-menu'), i.setAttribute('role', 'menu'));
    let a = Ni(this.manager.layers, this.manager.layers.indexOf(e));
    for (let h of [...this.manager.layers].reverse()) {
      if (h.kind === 'adjustment' || !h.data || !h.id) continue;
      let u = document.createElement('button');
      ((u.type = 'button'),
        (u.className = 'context-menu-item'),
        u.setAttribute('role', 'menuitem'),
        (u.textContent = `Copy filter to \u201C${h.name || h.id}\u201D${h === a ? ' (duplicate here)' : ''}`),
        u.addEventListener('click', d => {
          d.stopPropagation();
          let m = h.id,
            p = this.manager.copyAdjustmentLayer(t, m);
          (document.removeEventListener('pointerdown', o),
            i.remove(),
            p &&
              (this.expandedEffectStacks.add(m),
              this.expandedAdjustments.add(p),
              this.refresh(),
              this.onChange()));
        }),
        i.appendChild(u));
    }
    document.body.appendChild(i);
    let r = n.getBoundingClientRect(),
      s = i.getBoundingClientRect();
    ((i.style.left = `${Math.max(4, Math.min(window.innerWidth - s.width - 4, r.right - s.width))}px`),
      (i.style.top = `${Math.max(4, Math.min(window.innerHeight - s.height - 4, r.bottom + 2))}px`));
    let o = h => {
      i.contains(h.target) ||
        h.target === n ||
        (i.remove(), document.removeEventListener('pointerdown', o));
    };
    document.addEventListener('pointerdown', o);
  }
  _buildRow(e, t, n = 0, i = !1, a = []) {
    let r = e.id,
      s = t === 0 && !this.manager.documentExpanded,
      o = e.kind === 'adjustment' && !!e.adjustment,
      h = Ni(this.manager.layers, t),
      u = document.createElement('div');
    ((u.className =
      'layer-row' +
      (s ? ' layer-row-base' : '') +
      (o ? ' layer-row-adjustment' : '') +
      (e.clipped ? ' layer-row-clipped' : '') +
      (i ? ' layer-row-filter-child' : '')),
      (u.dataset.id = r),
      u.style.setProperty('--layer-depth', String(n)));
    let d = document.createElement('input');
    ((d.type = 'checkbox'),
      (d.className = 'layer-visible'),
      (d.checked = e.visible !== !1),
      (d.title = o
        ? 'Toggle filter visibility'
        : 'Toggle visibility (Shift-click to show only this image; Shift-click again to show all images)'),
      d.addEventListener('click', U => {
        U.shiftKey && (U.preventDefault(), U.stopPropagation(), this._showOnlyLayer(r));
      }),
      d.addEventListener('change', () => {
        (this.manager.updateLayer(r, { visible: d.checked }), this.onChange());
      }),
      u.appendChild(d));
    let m = document.createElement('div');
    if (((m.className = 'layer-title-line'), !o && e.data)) {
      let U = document.createElement('canvas');
      ((U.className = 'layer-thumbnail'),
        (U.width = 48),
        (U.height = 48),
        (U.dataset.layerId = r),
        (U.title = 'Layer content with its filters applied'),
        m.appendChild(U),
        this._paintLayerThumbnail(
          U,
          e,
          a.map(Z => Z.layer)
        ));
    }
    let p = document.createElement('span');
    if (
      ((p.className = 'layer-name'),
      (p.textContent = e.name || r),
      (p.title = `${e.uri || e.name || r}
Double-click to rename \xB7 Shift-click to show only`),
      p.addEventListener('dblclick', U => {
        (U.preventDefault(), U.stopPropagation());
        let Z = document.createElement('input');
        ((Z.className = 'layer-name-input'),
          (Z.value = e.name || r),
          p.replaceWith(Z),
          Z.focus(),
          Z.select());
        let G = !1,
          re = () => {
            if (G) return;
            G = !0;
            let ee = Z.value.trim();
            (ee && ee !== e.name && (this.manager.updateLayer(r, { name: ee }), this.onPersist?.()),
              this.refresh());
          };
        (Z.addEventListener('blur', re),
          Z.addEventListener('keydown', ee => {
            ee.key === 'Enter' ? Z.blur() : ee.key === 'Escape' && ((G = !0), this.refresh());
          }));
      }),
      m.appendChild(p),
      o)
    ) {
      let U = document.createElement('span');
      ((U.className = 'layer-adjustment-badge'),
        (U.textContent = om(e.adjustment)),
        (U.title = 'Non-destructive adjustment layer'),
        m.appendChild(U));
    } else {
      let U = document.createElement('span');
      ((U.className = 'layer-dimensions'),
        (U.textContent = `${e.width}\xD7${e.height}`),
        m.appendChild(U));
    }
    if (e.sourceSupport && e.sourceSupport !== 'native') {
      let U = document.createElement('span');
      ((U.className = `layer-support-badge layer-support-${e.sourceSupport}`),
        (U.textContent =
          e.sourceSupport === 'approximate'
            ? '\u2248'
            : e.sourceSupport === 'cached-raster'
              ? 'cached'
              : e.sourceSupport),
        (U.title = `Source compatibility: ${e.sourceSupport}${e.sourceBlendMode ? ` \xB7 ${e.sourceBlendMode}` : ''}`),
        m.appendChild(U));
    } else if (this.manager.documentExpanded) {
      let U = document.createElement('span');
      ((U.className = 'layer-support-badge layer-support-native'),
        (U.textContent = 'native'),
        (U.title = 'This source layer is represented natively'),
        m.appendChild(U));
    }
    if (
      (u.appendChild(m),
      u.addEventListener('click', U => {
        if (!U.shiftKey) return;
        let Z = U.target;
        (Z !== d && Z.closest('button, select, input')) ||
          (U.preventDefault(), this._showOnlyLayer(r));
      }),
      s)
    ) {
      let U = document.createElement('span');
      ((U.className = 'layer-base-tag'), (U.textContent = 'base'), u.appendChild(U));
    }
    let v = document.createElement('div');
    v.className = 'layer-controls';
    let g = document.createElement('select');
    ((g.className = 'layer-blend'), (g.title = 'Blend mode'));
    for (let U of mn) {
      let Z = document.createElement('option');
      ((Z.value = U.id),
        (Z.textContent = U.label),
        (e.blendMode || 'normal') === U.id && (Z.selected = !0),
        g.appendChild(Z));
    }
    (g.addEventListener('change', () => {
      (this.manager.updateLayer(r, sm(e, g.value)), this.refresh(), this.onChange());
    }),
      o || v.appendChild(g));
    let w = document.createElement('input');
    ((w.type = 'range'),
      (w.className = 'layer-opacity'),
      (w.min = '0'),
      (w.max = '100'),
      (w.dataset.defaultValue = '100'),
      (w.value = String(Math.round((e.opacity ?? 1) * 100))),
      (w.title = 'Opacity \xB7 Double-click to reset to 100%'),
      (w.disabled = e.blendMode === 'mask'));
    let k = document.createElement('span');
    if (
      ((k.className = 'layer-opacity-value'),
      (k.textContent = `${w.value}%`),
      this._bindContinuousHistory(w, () => this.onChange({ settled: !0 })),
      w.addEventListener('input', () => {
        (this.manager.updateLayer(r, { opacity: Number(w.value) / 100 }),
          (k.textContent = `${w.value}%`),
          this.onChange({ interactive: !0 }));
      }),
      w.addEventListener('change', () => {
        (this.manager.updateLayer(r, { opacity: Number(w.value) / 100 }), w.blur());
      }),
      w.addEventListener('pointerup', () => w.blur()),
      o)
    ) {
      let U = document.createElement('span');
      ((U.className = 'layer-adjustment-strength-label'),
        (U.textContent = 'Strength'),
        v.appendChild(U));
    }
    (v.appendChild(w), v.appendChild(k), u.appendChild(v));
    let E = document.createElement('label');
    E.className = 'layer-clipping';
    let L = document.createElement('input');
    ((L.type = 'checkbox'),
      (L.checked = !!e.clipped),
      (L.title = h
        ? `Applied only to \u201C${h.name || h.id}\u201D`
        : 'Clip this layer to the nearest unclipped layer below'),
      L.addEventListener('change', () => {
        (this.manager.updateLayer(r, { clipped: L.checked }), this.refresh(), this.onChange());
      }),
      E.appendChild(L),
      E.append(e.clipped ? ' Clipped' : ' Clip'));
    let M = null;
    if (
      (e.rasterMask &&
        ((M = document.createElement('span')),
        (M.className = 'layer-mask-badge'),
        (M.textContent = 'mask'),
        (M.title = `${e.rasterMask.width}\xD7${e.rasterMask.height} raster mask`)),
      o)
    ) {
      if (!i) {
        let U = document.createElement('div');
        U.className = 'layer-adjustment-scope';
        let Z = document.createElement('span');
        ((Z.className = 'layer-adjustment-target'),
          (Z.textContent = e.clipped
            ? h
              ? `Applied to \u201C${h.name || h.id}\u201D`
              : 'Clipped, but no base layer was found'
            : 'Applied to the composite below'),
          U.append(Z, E),
          M && (U.appendChild(M), (M = null)),
          u.appendChild(U));
      }
      u.appendChild(this._buildAdjustmentEditor(e, r));
    }
    e.blendMode === 'mask' && u.appendChild(this._buildMaskRow(e, r));
    let T = document.createElement('div');
    T.className = 'layer-position';
    let _ = this._offsetInput(
        e.offsetX ?? 0,
        U => {
          (this.manager.updateLayer(r, { offsetX: U }), this.onChange());
        },
        'X offset'
      ),
      I = this._offsetInput(
        e.offsetY ?? 0,
        U => {
          (this.manager.updateLayer(r, { offsetY: U }), this.onChange());
        },
        'Y offset'
      ),
      A = document.createElement('label');
    ((A.className = 'layer-pos-label'), (A.textContent = 'X'), A.appendChild(_));
    let N = document.createElement('label');
    ((N.className = 'layer-pos-label'),
      (N.textContent = 'Y'),
      N.appendChild(I),
      T.appendChild(A),
      T.appendChild(N));
    let z = document.createElement('button');
    ((z.className = 'layers-btn layer-move' + (this.movingLayerId === r ? ' active' : '')),
      (z.textContent = '\u2725'),
      (z.title = 'Drag on the image to move this layer'),
      z.addEventListener('click', () => {
        ((this.movingLayerId = this.movingLayerId === r ? null : r), this.refresh());
      }),
      T.appendChild(z),
      !o && e.blendMode !== 'mask' && T.appendChild(E),
      M && T.appendChild(M),
      o || u.appendChild(T));
    let X = document.createElement('div');
    if (((X.className = 'layer-actions'), !i && !o && e.data)) {
      let U = this.expandedEffectStacks.has(r),
        Z = document.createElement('button');
      ((Z.type = 'button'),
        (Z.className = 'layers-btn layer-filter-toggle-inline'),
        (Z.textContent = `${U ? '\u25BE' : '\u25B8'} Filters${a.length ? ` (${a.length})` : ''}`),
        (Z.title = U
          ? 'Hide filters applied to this layer'
          : 'Show and add filters for this layer'),
        Z.addEventListener('click', () => {
          (U ? this.expandedEffectStacks.delete(r) : this.expandedEffectStacks.add(r),
            this.refresh());
        }),
        X.appendChild(Z));
    }
    let ae = document.createElement('button');
    ((ae.className = 'layers-btn'),
      (ae.textContent = '\u25B2'),
      (ae.title = 'Move layer up'),
      ae.addEventListener('click', () => {
        (this.manager.reorderLayer(r, t + 1), this.refresh(), this.onChange());
      }));
    let Q = document.createElement('button');
    ((Q.className = 'layers-btn'),
      (Q.textContent = '\u25BC'),
      (Q.title = 'Move layer down'),
      Q.addEventListener('click', () => {
        (this.manager.reorderLayer(r, t - 1), this.refresh(), this.onChange());
      }));
    let j = null;
    !i && !o && e.data
      ? ((j = document.createElement('button')),
        (j.className = 'layers-btn'),
        (j.textContent = '\u29C9'),
        (j.title = 'Duplicate this layer with all attached filters'),
        j.setAttribute('aria-label', 'Duplicate layer with filters'),
        j.addEventListener('click', () => {
          let U = this.manager.duplicateLayerWithAdjustments(r);
          (U && this.expandedEffectStacks.has(r) && this.expandedEffectStacks.add(U),
            this.refresh(),
            this.onChange());
        }))
      : o &&
        e.adjustment &&
        ((j = document.createElement('button')),
        (j.className = 'layers-btn'),
        (j.textContent = '\u29C9'),
        (j.title = 'Copy this filter to an image layer'),
        j.setAttribute('aria-label', 'Copy filter to layer'),
        j.addEventListener('click', U => {
          (U.stopPropagation(), this._openFilterCopyMenu(e, r, j));
        }));
    let q = document.createElement('button');
    q.className = 'layers-btn layer-remove';
    let oe = this._pendingRemoveId === r;
    return (
      (q.textContent = oe ? 'again' : '\u{1F5D1}'),
      (q.title = oe ? 'Click again to remove this layer' : 'Remove layer'),
      q.classList.toggle('pending', oe),
      q.addEventListener('click', () => {
        if (this._pendingRemoveId !== r) {
          (this._clearPendingRemove(!1),
            (this._pendingRemoveId = r),
            (q.textContent = 'again'),
            (q.title = 'Click again to remove this layer'),
            q.classList.add('pending'),
            (this._pendingRemoveTimer = setTimeout(() => {
              this._clearPendingRemove(!0);
            }, 1600)));
          return;
        }
        (this._clearPendingRemove(!1),
          this.movingLayerId === r && (this.movingLayerId = null),
          this.manager.removeLayer(r),
          this.refresh(),
          this.onChange());
      }),
      j && X.appendChild(j),
      X.appendChild(ae),
      X.appendChild(Q),
      X.appendChild(q),
      u.appendChild(X),
      u
    );
  }
  _showOnlyLayer(e) {
    (this.manager.showOnlyLayer(e), this.refresh(), this.onChange());
  }
  _buildMaskRow(e, t) {
    let n = e.maskCondition || { op: 'gt', threshold: (e.typeMax || 1) * 0.5 },
      i = document.createElement('div');
    i.className = 'layer-mask';
    let a = document.createElement('span');
    ((a.className = 'layer-mask-label'),
      (a.textContent = 'Show layer where mask is'),
      i.appendChild(a));
    let r = document.createElement('select');
    ((r.className = 'layer-mask-op'), (r.title = 'Mask condition'));
    for (let u of Gs) {
      let d = document.createElement('option');
      ((d.value = u.id),
        (d.textContent = u.label),
        n.op === u.id && (d.selected = !0),
        r.appendChild(d));
    }
    i.appendChild(r);
    let s = document.createElement('input');
    ((s.type = 'number'),
      (s.step = 'any'),
      (s.min = '0'),
      (s.max = String(e.typeMax || 1)),
      (s.className = 'layer-mask-threshold'),
      (s.value = String(n.threshold ?? (e.typeMax || 1) * 0.5)),
      (s.title = 'Threshold'));
    let o = Gs.find(u => u.id === n.op);
    (o && !o.needsThreshold && (s.style.display = 'none'),
      i.appendChild(s),
      this._bindContinuousHistory(s, () => this.onChange({ settled: !0 })));
    let h = () => ({ op: r.value, threshold: parseFloat(s.value) });
    return (
      r.addEventListener('change', () => {
        (this.manager.updateLayer(t, { maskCondition: h() }), this.refresh(), this.onChange());
      }),
      s.addEventListener('input', () => {
        (this.manager.updateLayer(t, { maskCondition: h() }), this.onChange({ interactive: !0 }));
      }),
      i
    );
  }
  _offsetInput(e, t, n) {
    let i = document.createElement('input');
    return (
      (i.type = 'number'),
      (i.className = 'layer-offset-input'),
      (i.value = String(e)),
      (i.title = n),
      i.addEventListener('change', () => {
        let a = parseInt(i.value, 10);
        Number.isFinite(a) && t(a);
      }),
      i
    );
  }
};
function lm(l) {
  let e = l.dataset.defaultValue,
    t = l.getAttribute('value'),
    n = e ?? t ?? (l.min || '0'),
    i = Number(n),
    a = Number(l.min),
    r = Number(l.max);
  if (Number.isFinite(i)) {
    let s = i;
    (l.min !== '' && Number.isFinite(a) && (s = Math.max(a, s)),
      l.max !== '' && Number.isFinite(r) && (s = Math.min(r, s)),
      (n = String(s)));
  }
  return l.value === n
    ? !1
    : ((l.value = n),
      l.dispatchEvent(new Event('input', { bubbles: !0 })),
      l.dispatchEvent(new Event('change', { bubbles: !0 })),
      !0);
}
function Kc(l) {
  l.addEventListener('dblclick', e => {
    let t = e.target instanceof HTMLInputElement && e.target.type === 'range' ? e.target : null;
    t && (e.preventDefault(), e.stopPropagation(), lm(t));
  });
}
async function Jc(l, e, t) {
  let n = window.__tiffVisualizerVendorAssets?.layeredPreviewFallback;
  if (!n) throw new Error('Layered preview fallback asset is unavailable');
  return (await import(n)).decodeLayeredPreview(l, e, t || {});
}
var Bi = class {
  constructor(e, t) {
    this.decodeWorker = null;
    this._isInitialLoad = !0;
    this._pendingRenderData = null;
    this._lastRenderUsedWebGL = !1;
    this._lastRaw = null;
    this.document = null;
    this.metadata = {};
    this.previewMode = 'integrated';
    this.decodeEditableLayers = !0;
    this.onLayersReady = null;
    this._deferredDecodeToken = 0;
    this._deferredLayersPromise = null;
    ((this.settingsManager = e), (this.vscode = t));
  }
  async process(e, t) {
    let n = this.loadSignal,
      i = await rt.fetchArrayBuffer(e, n, t);
    if (n?.aborted) throw new DOMException('Load superseded', 'AbortError');
    let a = this.decodeEditableLayers && (t === 'psd' || t === 'psb' || t === 'ora' || t === 'kra'),
      r = await rt.decodeWithFallback(
        this.decodeWorker,
        t,
        i,
        e,
        n,
        (o, h) => Jc(t, o, h),
        a ? { previewOnly: !0 } : {}
      );
    ((this._cachedStats = void 0),
      (this._lastRaw = r),
      (this.previewMode = 'integrated'),
      (this.document = r.document),
      (this.metadata = r.metadata || {}),
      this._postFormatInfo(r),
      a && this._startDeferredLayerDecode(e, t, n));
    let s = document.createElement('canvas');
    return (
      (s.width = r.width),
      (s.height = r.height),
      this._isInitialLoad
        ? ((this._pendingRenderData = !0),
          { canvas: s, imageData: new ImageData(r.width, r.height) })
        : { canvas: s, imageData: this.renderWithSettings() }
    );
  }
  _startDeferredLayerDecode(e, t, n) {
    let i = ++this._deferredDecodeToken;
    this._deferredLayersPromise = new Promise(a => setTimeout(a, 0))
      .then(async () => {
        let a = await rt.fetchArrayBuffer(e, n, `${t}-layers`);
        if (n?.aborted || i !== this._deferredDecodeToken) return;
        let r = await rt.decodeWithFallback(this.decodeWorker, t, a, e, n, (o, h) => Jc(t, o, h), {
          layersOnly: !0,
        });
        if (n?.aborted || i !== this._deferredDecodeToken || !this._lastRaw) return;
        let s = this._lastRaw;
        ((this._lastRaw = { ...r, data: s.data, integratedData: s.integratedData || s.data }),
          (this.document = r.document),
          (this.metadata = r.metadata || {}),
          this.onLayersReady?.(this._lastRaw));
      })
      .catch(a => {
        !n?.aborted &&
          i === this._deferredDecodeToken &&
          console.warn(`[LayeredPreview] Deferred ${t.toUpperCase()} layer decode failed:`, a);
      })
      .finally(() => {
        i === this._deferredDecodeToken && (this._deferredLayersPromise = null);
      });
  }
  _postFormatInfo(e) {
    this.vscode.postMessage({
      type: 'formatInfo',
      value: {
        width: e.width,
        height: e.height,
        compression: 'document-defined',
        photometricInterpretation: 2,
        planarConfig: 1,
        samplesPerPixel: e.channels,
        bitsPerSample: e.bitDepth,
        sampleFormat: e.sampleFormat,
        formatLabel: e.formatLabel,
        formatType: e.formatType,
        isInitialLoad: this._isInitialLoad,
        layerCount: e.document.layerCount,
        previewKind: e.document.previewKind,
        previewIsAuthoritative: e.document.previewIsAuthoritative,
        previewWarnings: e.document.warnings,
        ...e.metadata,
      },
    });
  }
  _render(e, t = {}) {
    if (!this._lastRaw) return new ImageData(1, 1);
    let n = this._lastRaw,
      i = n.sampleFormat === 3,
      a = this._cachedStats;
    !a &&
      kt.needsStats(this.settingsManager.settings) &&
      ((a = i
        ? St.calculateFloatStats(e, n.width, n.height, n.channels)
        : St.calculateIntegerStats(e, n.width, n.height, n.channels, !1)),
      (this._cachedStats = a),
      this.vscode.postMessage({ type: 'stats', value: a }));
    let r = i ? 1 : n.bitDepth === 16 ? 65535 : 255,
      s = this.settingsManager.settings.normalization;
    if (
      n.bitDepth === 8 &&
      n.channels === 4 &&
      (e instanceof Uint8Array || e instanceof Uint8ClampedArray) &&
      !t.collectHistogram &&
      !this.settingsManager.settings.rgbAs24BitGrayscale &&
      (!this.settingsManager.settings.displayColormap ||
        this.settingsManager.settings.displayColormap === 'none') &&
      kt.isIdentityTransformation(this.settingsManager.settings) &&
      (s?.gammaMode === !0 || (s?.autoNormalize === !1 && s.min === 0 && s.max === 255))
    ) {
      let h = e,
        u =
          h.buffer instanceof ArrayBuffer
            ? new Uint8ClampedArray(h.buffer, h.byteOffset, h.byteLength)
            : new Uint8ClampedArray(h);
      return new ImageData(u, n.width, n.height);
    }
    return bt.render(e, n.width, n.height, n.channels, i, a, this.settingsManager.settings, {
      typeMax: r,
      collectHistogram: t.collectHistogram === !0,
    });
  }
  renderWithSettings(e = {}) {
    return this._lastRaw
      ? ((this._lastRenderUsedWebGL = !1), this._render(this.activeData(), e))
      : null;
  }
  hasReconstruction() {
    return !!this._lastRaw?.reconstructedData;
  }
  hasDeferredLayersPending() {
    return this._deferredLayersPromise !== null;
  }
  activeData() {
    return this._lastRaw
      ? this.previewMode === 'reconstructed' && this._lastRaw.reconstructedData
        ? this._lastRaw.reconstructedData
        : this._lastRaw.integratedData || this._lastRaw.data
      : new Uint8Array();
  }
  setPreviewMode(e) {
    return (e === 'reconstructed' && !this.hasReconstruction()) || this.previewMode === e
      ? !1
      : ((this.previewMode = e), (this._cachedStats = void 0), !0);
  }
  performDeferredRender(e = {}) {
    if (!this._pendingRenderData || !this._lastRaw) return null;
    ((this._pendingRenderData = null), (this._isInitialLoad = !1));
    let t = this.renderWithSettings(e);
    return (this.vscode.postMessage({ type: 'refresh-status' }), t);
  }
  getColorAtPixel(e, t, n, i) {
    let a = this._lastRaw;
    if (!a || a.width !== n || a.height !== i || e < 0 || t < 0 || e >= a.width || t >= a.height)
      return '';
    let r = (t * a.width + e) * a.channels,
      s = [],
      o = this.activeData();
    for (let u = 0; u < a.channels; u++) s.push(Number(o[r + u]));
    let h = u => (a.sampleFormat === 3 ? parseFloat(u.toFixed(6)).toString() : String(u));
    return s.length === 4
      ? `${h(s[0])} ${h(s[1])} ${h(s[2])} \u03B1:${h(s[3])}`
      : s.map(h).join(' ');
  }
  reset() {
    (this._deferredDecodeToken++,
      (this._deferredLayersPromise = null),
      (this._lastRaw = null),
      (this.document = null),
      (this.metadata = {}),
      (this._pendingRenderData = null),
      (this._cachedStats = void 0),
      (this._isInitialLoad = !0),
      (this.previewMode = 'integrated'));
  }
};
var Xs = [
    { kind: 'tiff', label: 'TIFF', extensions: ['tif', 'tiff', 'tf2', 'tf8', 'btf'] },
    { kind: 'exr', label: 'OpenEXR', extensions: ['exr'] },
    { kind: 'pfm', label: 'PFM', extensions: ['pfm'] },
    { kind: 'netpbm', label: 'NetPBM', extensions: ['ppm', 'pgm', 'pbm'] },
    { kind: 'png', label: 'PNG/JPEG', extensions: ['png', 'jpg', 'jpeg'] },
    { kind: 'npy', label: 'NumPy', extensions: ['npy', 'npz'] },
    { kind: 'hdr', label: 'Radiance HDR', extensions: ['hdr'] },
    { kind: 'tga', label: 'TGA', extensions: ['tga'] },
    { kind: 'web-image', label: 'Browser image', extensions: ['webp', 'avif', 'bmp', 'ico'] },
    { kind: 'jxl', label: 'JPEG XL', extensions: ['jxl'] },
    { kind: 'jxr', label: 'JPEG XR', extensions: ['jxr', 'wdp', 'hdp'] },
    { kind: 'jp2', label: 'JPEG 2000', extensions: ['jp2', 'jpf', 'jpx', 'j2k', 'j2c', 'jpc'] },
    { kind: 'fits', label: 'FITS', extensions: ['fits', 'fit', 'fts'] },
    { kind: 'dicom', label: 'DICOM', extensions: ['dcm', 'dicom'] },
    { kind: 'netcdf', label: 'NetCDF', extensions: ['nc', 'cdf'] },
    { kind: 'czi', label: 'Zeiss CZI', extensions: ['czi'] },
    { kind: 'nd2', label: 'Nikon ND2', extensions: ['nd2'] },
    { kind: 'lif', label: 'Leica LIF', extensions: ['lif'] },
    { kind: 'sdt', label: 'Becker & Hickl SDT', extensions: ['sdt'] },
    { kind: 'layered', label: 'OpenRaster', extensions: ['ora'], layeredFormat: 'ora' },
    { kind: 'layered', label: 'Krita', extensions: ['kra'], layeredFormat: 'kra' },
    { kind: 'layered', label: 'Photoshop', extensions: ['psd'], layeredFormat: 'psd' },
    { kind: 'layered', label: 'Photoshop Large', extensions: ['psb'], layeredFormat: 'psb' },
    { kind: 'layered', label: 'GIMP XCF', extensions: ['xcf'], layeredFormat: 'xcf' },
    {
      kind: 'layered',
      label: 'Affinity Photo',
      extensions: ['afphoto', 'af'],
      layeredFormat: 'affinity',
    },
  ],
  Zc = (() => {
    let l = new Map();
    for (let e of Xs)
      for (let t of e.extensions) {
        if (l.has(t))
          throw new Error(
            `format-registry: '.${t}' is claimed by both '${l.get(t).label}' and '${e.label}'`
          );
        l.set(t, e);
      }
    return l;
  })();
function cm(l) {
  if (/^[a-z][a-z0-9+.-]*:/i.test(l) && !/^[a-z]:[\\/]/i.test(l))
    try {
      l = new URL(l).pathname;
    } catch {}
  let e = l.split('/').pop() || '',
    t = e.lastIndexOf('.');
  return t <= 0 ? '' : e.slice(t + 1).toLowerCase();
}
function An(l, e) {
  if (e) {
    let n = e.replace(/^\./, '').toLowerCase(),
      i = Zc.get(n) || Xs.find(a => a.kind === n);
    if (i) return i;
  }
  let t = cm(l);
  return t ? Zc.get(t) || null : Xs.find(n => n.kind === 'dicom') || null;
}
function Qc(l) {
  return An(l)?.kind === 'tiff';
}
function eu(l) {
  let e = An(l);
  return e?.kind === 'layered' ? e.layeredFormat : null;
}
var sr = class {
  constructor(e, t, n, i = 32e6) {
    this._tiles = new Map();
    this._baseBlocks = new Set();
    this._clock = 0;
    this._tilePixels = 0;
    ((this.fullWidth = Math.max(1, t)),
      (this.fullHeight = Math.max(1, n)),
      (this._maxTilePixels = Math.max(1, i)),
      (this._baseCanvas = e),
      (this.element = document.createElement('div')),
      (this.element.className = 'pyramid-scene scale-to-fit'),
      (this.element.dataset.sceneWidth = String(this.fullWidth)),
      (this.element.dataset.sceneHeight = String(this.fullHeight)),
      (this.element.style.aspectRatio = `${this.fullWidth} / ${this.fullHeight}`),
      e.classList.remove('scale-to-fit', 'pixelated'),
      e.classList.add('pyramid-base'),
      (e.style.width = '100%'),
      (e.style.height = '100%'),
      this.element.appendChild(e));
  }
  _baseKey(e, t) {
    return `${e}:${t}`;
  }
  missingBaseRects(e, t) {
    let n = t.x + t.width / 2,
      i = t.y + t.height / 2;
    return this._addresses(e, t)
      .filter(a => !this._baseBlocks.has(this._baseKey(a.column, a.row)))
      .map(a => this._rectForAddress(e, a))
      .sort((a, r) => {
        let s = Math.abs(a.x + a.width / 2 - n) + Math.abs(a.y + a.height / 2 - i),
          o = Math.abs(r.x + r.width / 2 - n) + Math.abs(r.y + r.height / 2 - i);
        return s - o;
      });
  }
  commitBaseRegion(e, t, n) {
    let i = this._baseCanvas.getContext('2d');
    if (i) {
      'data' in n ? i.putImageData(n, t.x, t.y) : i.drawImage(n, t.x, t.y);
      for (let a of this._addresses(e, t)) this._baseBlocks.add(this._baseKey(a.column, a.row));
    }
  }
  baseLoadedSummary(e, t) {
    let n = this._addresses(e, t),
      i = 0,
      a = 0;
    for (let r of n) {
      if (!this._baseBlocks.has(this._baseKey(r.column, r.row))) continue;
      i++;
      let s = this._rectForAddress(e, r);
      a += s.width * s.height;
    }
    return { blocks: i, totalBlocks: n.length, pixels: a };
  }
  dispose() {
    (this.clearTiles(), this.element.remove());
  }
  clearTiles() {
    for (let e of this._tiles.values()) e.element.remove();
    (this._tiles.clear(), (this._tilePixels = 0));
  }
  clearBase() {
    (this._baseCanvas
      .getContext('2d')
      ?.clearRect(0, 0, this._baseCanvas.width, this._baseCanvas.height),
      this._baseBlocks.clear());
  }
  retainOnlyLevel(e) {
    let t = 0;
    for (let [n, i] of this._tiles)
      i.level !== e &&
        (this._tiles.delete(n), (this._tilePixels -= i.pixels), i.element.remove(), t++);
    return t;
  }
  sceneScale() {
    return this.element.clientWidth > 0 ? this.element.clientWidth / this.fullWidth : 0;
  }
  _key(e, t, n) {
    return `${e}:${t}:${n}`;
  }
  _addresses(e, t) {
    let n = Math.max(1, e.blockWidth),
      i = Math.max(1, e.blockHeight),
      a = Math.max(0, Math.floor(t.x / n)),
      r = Math.max(0, Math.floor(t.y / i)),
      s = Math.min(Math.ceil(e.width / n) - 1, Math.floor(Math.max(t.x, t.x + t.width - 1) / n)),
      o = Math.min(Math.ceil(e.height / i) - 1, Math.floor(Math.max(t.y, t.y + t.height - 1) / i)),
      h = [];
    for (let u = r; u <= o; u++) for (let d = a; d <= s; d++) h.push({ column: d, row: u });
    return h;
  }
  _rectForAddress(e, t) {
    let n = Math.max(1, e.blockWidth),
      i = Math.max(1, e.blockHeight),
      a = t.column * n,
      r = t.row * i;
    return { x: a, y: r, width: Math.min(n, e.width - a), height: Math.min(i, e.height - r) };
  }
  missingRects(e, t) {
    let n = t.x + t.width / 2,
      i = t.y + t.height / 2,
      a = [];
    for (let r of this._addresses(e, t)) {
      let s = this._tiles.get(this._key(e.index, r.column, r.row));
      if (s) {
        s.lastUsed = ++this._clock;
        continue;
      }
      a.push(this._rectForAddress(e, r));
    }
    return a.sort((r, s) => {
      let o = Math.abs(r.x + r.width / 2 - n) + Math.abs(r.y + r.height / 2 - i),
        h = Math.abs(s.x + s.width / 2 - n) + Math.abs(s.y + s.height / 2 - i);
      return o - h;
    });
  }
  canRetain(e, t) {
    return (
      this._addresses(e, t)
        .map(i => this._rectForAddress(e, i))
        .reduce((i, a) => i + a.width * a.height, 0) <= this._maxTilePixels
    );
  }
  loadedBounds(e, t) {
    let n = this._addresses(e, t)
      .filter(o => this._tiles.has(this._key(e.index, o.column, o.row)))
      .map(o => this._rectForAddress(e, o));
    if (!n.length) return null;
    let i = Math.min(...n.map(o => o.x)),
      a = Math.min(...n.map(o => o.y)),
      r = Math.max(...n.map(o => o.x + o.width)),
      s = Math.max(...n.map(o => o.y + o.height));
    return { x: i, y: a, width: r - i, height: s - a };
  }
  loadedSummary(e, t) {
    let n = this._addresses(e, t).filter(a => this._tiles.has(this._key(e.index, a.column, a.row))),
      i = 0;
    for (let a of n) {
      let r = this._rectForAddress(e, a);
      i += r.width * r.height;
    }
    return { blocks: n.length, pixels: i, bounds: this.loadedBounds(e, t) };
  }
  missingRect(e, t) {
    let n = this.missingRects(e, t);
    if (!n.length) return null;
    let i = Math.min(...n.map(o => o.x)),
      a = Math.min(...n.map(o => o.y)),
      r = Math.max(...n.map(o => o.x + o.width)),
      s = Math.max(...n.map(o => o.y + o.height));
    return { x: i, y: a, width: r - i, height: s - a };
  }
  commitRegion(e, t, n) {
    let i = Math.max(1, e.blockWidth),
      a = Math.max(1, e.blockHeight);
    for (let r of this._addresses(e, t)) {
      let s = this._key(e.index, r.column, r.row);
      if (this._tiles.has(s)) continue;
      let o = r.column * i,
        h = r.row * a,
        u = Math.min(i, e.width - o),
        d = Math.min(a, e.height - h),
        m = o - t.x,
        p = h - t.y;
      if (m < 0 || p < 0 || m + u > n.width || p + d > n.height) continue;
      let v = document.createElement('canvas');
      ((v.className = 'pyramid-tile'), (v.width = u), (v.height = d));
      let g = v.getContext('2d');
      if (!g) continue;
      'data' in n ? g.putImageData(n, -m, -p) : g.drawImage(n, -m, -p);
      let w = Math.max(1, e.reduction);
      ((v.style.left = `${((o * w) / this.fullWidth) * 100}%`),
        (v.style.top = `${((h * w) / this.fullHeight) * 100}%`),
        (v.style.width = `${((u * w) / this.fullWidth) * 100}%`),
        (v.style.height = `${((d * w) / this.fullHeight) * 100}%`),
        (v.style.zIndex = String(1e6 - w)),
        this.element.appendChild(v));
      let k = u * d;
      (this._tiles.set(s, {
        ...r,
        key: s,
        level: e.index,
        reduction: w,
        pixels: k,
        lastUsed: ++this._clock,
        element: v,
      }),
        (this._tilePixels += k));
    }
    this._evict();
  }
  finestVisibleLevel(e, t) {
    for (let n of e) {
      let i = Math.max(1, n.reduction),
        a = { x: t.x / i, y: t.y / i, width: t.width / i, height: t.height / i },
        r = this._addresses(n, a);
      if (r.length > 0 && r.every(s => this._tiles.has(this._key(n.index, s.column, s.row))))
        return n;
    }
    return null;
  }
  get tileCount() {
    return this._tiles.size;
  }
  get tilePixels() {
    return this._tilePixels;
  }
  _evict() {
    if (this._tilePixels <= this._maxTilePixels) return;
    let e = [...this._tiles.values()].sort((t, n) => t.lastUsed - n.lastUsed);
    for (let t of e) {
      if (this._tilePixels <= this._maxTilePixels) break;
      (this._tiles.delete(t.key), (this._tilePixels -= t.pixels), t.element.remove());
    }
  }
};
(function () {
  let l = window.__tiffVisualizerBootstrap,
    e = null,
    t = null;
  function n() {
    if (!e) {
      let c = window.__tiffVisualizerVendorAssets?.layerDocumentWriter;
      if (!c) return Promise.reject(new Error('Layer document writer asset is unavailable'));
      e = import(c);
    }
    return e;
  }
  function i() {
    if (!t) {
      let c = window.__tiffVisualizerVendorAssets?.imagejRoi;
      if (!c) return Promise.reject(new Error('ImageJ ROI asset is unavailable'));
      t = import(c);
    }
    return t;
  }
  let a = l?.vscode || acquireVsCodeApi(),
    r = new ka(),
    s = hl(r.settings, c => a.postMessage(c)),
    o = r.settings.extensionVersion,
    h = r.settings.vscodeVersion,
    u = a.getState();
  u &&
    !ls(u, o, h) &&
    (console.info(
      `[State] Discarding persisted preview state from extension ${u.extensionVersion || 'unknown'} / VS Code ${u.vscodeVersion || 'unknown'}`
    ),
    a.setState(cs({}, o, h)));
  let d = null,
    m = null,
    p = {
      postMessage: c => (
        c.type === 'formatInfo' &&
          c.value &&
          ((c = { ...c, value: { ...c.value, resourceUri: r.settings.resourceUri } }),
          (d = c.value),
          (m = {
            time: performance.now(),
            generation: ie,
            formatType: String(c.value.formatType || ''),
          })),
        s.message(c),
        a.postMessage(c)
      ),
      setState: c => a.setState(cs(c || {}, o, h)),
      getState: () => {
        let c = a.getState();
        return ls(c, o, h) ? c : void 0;
      },
    },
    v = () => ({
      _isInitialLoad: !0,
      _pendingRenderData: null,
      _lastRaw: null,
      _lastAllTags: [],
      metadata: {},
      rawTiffData: null,
      rawExrData: null,
      pageIndex: 0,
      pageCount: 1,
      pageDirectory: [],
      omeMetadata: null,
      omeBinaryOnly: null,
      selectableBandCount: 0,
      getColorAtPixel: () => '',
    }),
    g = v(),
    w = v(),
    k = new La(r, p),
    E = new Ta(r, p, g),
    L = v(),
    M = v(),
    T = v(),
    _ = new wi(r, p);
  _.onMetadataTagsReady = () => sa();
  let I = v(),
    A = new Ra(r, p),
    N = new Ea(r, p),
    z = v(),
    X = v(),
    ae = v(),
    Q = v(),
    j = v(),
    q = v(),
    oe = v(),
    U = v(),
    Z = v(),
    G = v(),
    re = [],
    ee = new Bi(r, p),
    ye = [_, A, N, ee],
    ve = new rt(),
    Ae = new rt('pngDecodeWorker.bundle.js'),
    _e = new rt('layeredDecodeWorker.bundle.js', !1),
    le = new Ya(ve),
    Le = new Map(),
    me = (c, f = ve) => (
      (c.decodeWorker = f),
      (c._isInitialLoad = !0),
      typeof wt < 'u' && (c.loadSignal = wt.signal),
      ye.push(c),
      c
    );
  function Ce(c) {
    let f = ['fits', 'dicom', 'netcdf', 'czi', 'nd2', 'lif', 'sdt', 'jxr', 'jp2', 'jxl'].includes(c)
        ? 'scientific'
        : c,
      b = Le.get(f);
    if (b) return b;
    let y = (async () => {
      if (f === 'tiff') {
        let x = Number(g.pageIndex || 0),
          [{ TiffProcessor: C }, R, P] = await Promise.all([
            import('./chunks/tiff-processor-JXNMQK7E.js'),
            import('./chunks/tiff-wasm-wrapper-RCEFXZ3G.js'),
            import('./chunks/strip-parallel-decode-TB6NTATY.js'),
          ]);
        ((g = me(new C(r, p))),
          (g.pageIndex = x),
          (E.tiffProcessor = g),
          R.getWasmModule(),
          P.prewarmStripPool());
      } else if (f === 'exr') {
        let [{ ExrProcessor: x }, C] = await Promise.all([
          import('./chunks/exr-processor-AE35OER4.js'),
          import('./chunks/strip-parallel-decode-TB6NTATY.js'),
        ]);
        ((w = me(new x(r, p))), E.setExrProcessor(w), C.prewarmStripPool());
      } else if (f === 'npy') {
        let { NpyProcessor: x } = await import('./chunks/npy-processor-LTUIKHHL.js');
        ((L = me(new x(r, p), le)), E.setNpyProcessor(L));
      } else if (f === 'pfm') {
        let { PfmProcessor: x } = await import('./chunks/pfm-processor-7XAYNJ4U.js');
        ((M = me(new x(r, p), le)), E.setPfmProcessor(M));
      } else if (f === 'netpbm') {
        let { PpmProcessor: x } = await import('./chunks/ppm-processor-M7AZSND5.js');
        ((T = me(new x(r, p), le)), E.setPpmProcessor(T));
      } else if (f === 'hdr') {
        let { HdrProcessor: x } = await import('./chunks/hdr-processor-QF3AEILZ.js');
        ((I = me(new x(r, p))), E.setHdrProcessor(I));
      } else if (f === 'scientific') {
        let [{ ScientificArrayProcessor: x }, C] = await Promise.all([
          import('./chunks/scientific-array-processor-FOMDWA4V.js'),
          import('./chunks/main-thread-decode-IEKINN25.js'),
        ]);
        ((z = me(
          new x(r, p, {
            workerFormat: 'fits',
            formatLabel: 'FITS',
            formatType: 'fits',
            parse: C.decodeFitsLocal,
          })
        )),
          (ae = me(
            new x(r, p, {
              workerFormat: 'jxr',
              formatLabel: 'JPEG XR',
              formatType: 'jxr',
              parse: C.decodeJxrLocal,
            })
          )),
          (Q = me(
            new x(r, p, {
              workerFormat: 'jp2',
              formatLabel: 'JPEG 2000',
              formatType: 'jp2',
              parse: C.decodeJp2Local,
            })
          )),
          (X = me(
            new x(r, p, {
              workerFormat: 'jxl',
              formatLabel: 'JPEG XL',
              formatType: 'jxl',
              formatTypeFor: R => (R.sampleFormat === 3 ? 'jxl-float' : 'jxl'),
              parse: C.decodeJxlLocal,
            })
          )),
          (j = me(
            new x(r, p, {
              workerFormat: 'dicom',
              formatLabel: 'DICOM',
              formatType: 'dicom',
              parse: (R, P) => C.decodeDicomLocal(R, { frameIndex: Number(P?.frameIndex || 0) }),
            })
          )),
          (q = me(
            new x(r, p, {
              workerFormat: 'netcdf',
              formatLabel: 'NetCDF',
              formatType: 'netcdf',
              parse: (R, P) => C.decodeNetcdfLocal(R, P || {}),
            })
          )),
          (oe = me(
            new x(r, p, {
              workerFormat: 'czi',
              formatLabel: 'CZI',
              formatType: 'czi',
              cacheSourceInWorker: !0,
              parse: (R, P) => C.decodeCziLocal(R, P || {}),
            })
          )),
          (U = me(
            new x(r, p, {
              workerFormat: 'nd2',
              formatLabel: 'ND2',
              formatType: 'nd2',
              cacheSourceInWorker: !0,
              parse: (R, P) => C.decodeNd2Local(R, P || {}),
            })
          )),
          (Z = me(
            new x(r, p, {
              workerFormat: 'lif',
              formatLabel: 'LIF',
              formatType: 'lif',
              cacheSourceInWorker: !0,
              parse: (R, P) => C.decodeLifLocal(R, P || {}),
            })
          )),
          (G = me(
            new x(r, p, {
              workerFormat: 'sdt',
              formatLabel: 'SDT',
              formatType: 'sdt',
              cacheSourceInWorker: !0,
              parse: (R, P) => C.decodeSdtLocal(R, P || {}),
            })
          )),
          (re = [z, ae, Q, X, j, q, oe, U, Z, G]),
          E.setScientificProcessors(re),
          (so = [oe, U, Z, G]));
      }
    })();
    return (Le.set(f, y), y);
  }
  let de = new qa();
  de.start();
  let ce = new er(),
    ue = new nr();
  ((_.decodeWorker = Ae), (ee.decodeWorker = _e));
  let V = new _a(r, p),
    he = new Ia(r, p),
    ke = new Pa(c => {
      zr(c);
    });
  window.addEventListener(sl, c => {
    c.detail?.detected && (ke.show(), zr(ke.getSettings()));
  });
  let be = [],
    pe = [],
    We = null,
    je = !1,
    pn = -1,
    or = 0,
    $i = new Ii(),
    lr = 'cpu',
    Ys = !1;
  function gn() {
    if (pn === ie) return;
    pn = ie;
    let c = pe;
    ((be = []), (pe = []), (We = null));
    let f = Fn();
    if (!f) return;
    let b = g.rawTiffData?.ome || null,
      y = b?.sizeC || 0;
    if (y > 1 && (f.channels || 1) === 1) {
      tu(y, ie);
      return;
    }
    if ((f.channels || 1) < 2 || !f.data) return;
    let x = Array.from({ length: f.channels }, (P, S) => ss(g.gdalMetadata, S)).filter(Boolean),
      C = b?.channels?.map(P => P?.name).filter(Boolean),
      R = C?.length ? C : x.length === f.channels ? x : void 0;
    ((be = Sc(f.data, f.width, f.height, f.channels, R)),
      (pe = qs(be, c, { colors: b?.channels?.map(P => P?.colorCss) })),
      Wt.render());
  }
  async function tu(c, f) {
    let b = g.omeMetadata,
      y = r.settings.src || '';
    if (!b || !y) return;
    let x = xi(b, g.pageIndex),
      C = [];
    for (let R = 0; R < c; R++) {
      if (f !== ie) return;
      let P = os(b, { ...x, c: R }),
        S = null;
      if (P === g.pageIndex && g.rawTiffData?.data)
        S = {
          data: g.rawTiffData.data,
          width: g.rawTiffData.ifd.width,
          height: g.rawTiffData.ifd.height,
          channels: g.rawTiffData.ifd.t277 || 1,
        };
      else
        try {
          let W = await (await fetch(y)).arrayBuffer(),
            K = await ve.decode('tiff', W, { pageIndex: P });
          K?.ok && K.result?.data && (S = K.result);
        } catch ($) {
          console.warn('[Channels] Could not decode channel page', P, $);
        }
      if (!S?.data || !S.width || !S.height) continue;
      let F = S.width * S.height,
        H = S.channels || 1,
        D = new Float32Array(F);
      for (let $ = 0; $ < F; $++) D[$] = Number(S.data[$ * H]);
      C.push({
        index: R,
        name: b.channels?.[R]?.name || `Channel ${R + 1}`,
        data: D,
        width: S.width,
        height: S.height,
      });
    }
    f !== ie ||
      C.length < 2 ||
      ((be = C),
      (pe = qs(C, pe, { colors: b.channels?.map(R => R?.colorCss) })),
      Wt.render(),
      je && Dn());
  }
  function cr() {
    if (!je || be.length < 2) return;
    let c = be[0].width,
      f = be[0].height,
      b = vi(r.settings),
      y = [b.r, b.g, b.b],
      x = { soloIndex: We, nanColor: y };
    if (
      (!Ys &&
        Ii.isSupported() &&
        ((Ys = !0),
        $i.initialize().then(P => {
          P && je && Dn();
        })),
      $i.isReady())
    ) {
      let P = $i.render(be, pe, c, f, x);
      if (P) {
        let S = tt();
        if (S) {
          (B && (B.width !== c || B.height !== f) && ((B.width = c), (B.height = f)),
            S.clearRect(0, 0, c, f),
            S.drawImage(P, 0, 0),
            (Y = S.getImageData(0, 0, c, f)),
            (lr = 'webgpu'));
          return;
        }
      }
    }
    let C = kc(be, pe, c, f, x),
      R = tt();
    R && (Fe(C, R), (Y = C), (lr = 'cpu'));
  }
  function Dn() {
    or ||
      (or = requestAnimationFrame(() => {
        ((or = 0), cr(), V.getVisibility() && Ne());
      }));
  }
  let Wt = new Wa({
    getPlanes: () => (gn(), be),
    getSettings: () => pe,
    setSettings: c => {
      pe = c;
    },
    isComposite: () => je,
    setComposite: c => {
      ((je = c), c ? (gn(), cr()) : sn(null), ot());
    },
    getSolo: () => We,
    setSolo: c => {
      We = c;
    },
    onChange: () => {
      (Dn(), ot());
    },
    getBackend: () => ($i.isReady() ? lr : 'cpu'),
  });
  function qs(c, f, b) {
    let y = Rc(c, b);
    return f.length !== c.length
      ? y
      : y.map((x, C) => ({
          ...x,
          visible: f[C].visible,
          color: f[C].color,
          opacity: f[C].opacity,
          colormap: f[C].colormap,
        }));
  }
  function Ks() {
    return (gn(), be.length >= 2);
  }
  let en = new Oa(),
    At = { ...Mi },
    Ui = null,
    Hi = null;
  function nu() {
    let c = r.settings.resourceUri || r.settings.src || void 0;
    if (g.rawTiffData?.data) {
      let y = g.rawTiffData.ifd,
        x = y.width,
        C = y.height;
      if (!x || !C) return null;
      let R = y.t258 || 8,
        P = y.t339;
      return {
        width: x,
        height: C,
        channels: y.t277 || 1,
        data: g.rawTiffData.data,
        isFloat: ya(P, R),
        typeMax: va(P, R),
        fileName: c,
        page: y.pageIndex,
        pageCount: y.pageCount,
      };
    }
    let f = [
        { processor: w, isFloat: !0, typeMax: () => 1 },
        { processor: M, isFloat: !0, typeMax: () => 1 },
        { processor: I, isFloat: !0, typeMax: () => 1 },
        {
          processor: L,
          isFloat: !0,
          typeMax: y =>
            String(y.dtype || '').includes('f') ? 1 : String(y.dtype).includes('16') ? 65535 : 255,
        },
        { processor: T, isFloat: !1, typeMax: y => y.maxval || 255 },
        { processor: _, isFloat: !1, typeMax: y => y.maxValue || 255 },
        { processor: A, isFloat: !1, typeMax: () => 255 },
        { processor: N, isFloat: !1, typeMax: () => 255 },
        ...re.map(y => ({
          processor: y,
          isFloat: !0,
          typeMax: () => y.numericDomain?.typeMax ?? 1,
        })),
      ],
      b = w?.rawExrData;
    if (b?.data && b.width && b.height)
      return {
        width: b.width,
        height: b.height,
        channels: b.channels || 1,
        data: b.data,
        isFloat: !0,
        typeMax: 1,
        fileName: c,
      };
    for (let y of f) {
      let x = y.processor?._lastRaw;
      if (!(!x?.data || !x.width || !x.height))
        return {
          width: x.width,
          height: x.height,
          channels: x.channels || 1,
          data: x.data,
          isFloat: y.isFloat,
          typeMax: y.typeMax(x),
          fileName: c,
        };
    }
    return null;
  }
  function Fn() {
    if (Ui?.generation === ie) return Ui.source;
    let c = nu();
    return ((Ui = { generation: ie, source: c }), c);
  }
  function Js() {
    if (Hi?.generation === ie) return Hi.plane;
    let c = Fn(),
      f = c ? hs(c) : null;
    return ((Hi = { generation: ie, plane: f }), f);
  }
  let mt = new Va(en, {
    getImageElement: () => te,
    getSource: () => Fn(),
    getScalarPlane: () => Js(),
    getCalibration: () => At,
    onCalibrationLine: c => Oe.onCalibrationLine(c),
    onRoiEdited: () => {
      (Oe.scheduleMeasure(), ot());
    },
    onHint: c => Oe.setHint(c),
    onScaleBarPositionChanged: () => ot(),
  });
  typeof r.settings.showScaleBar == 'boolean' && mt.setShowScaleBar(r.settings.showScaleBar);
  function Dt() {
    (ii++, ai?.abort(), (ai = null), (da = !1), (ha = !1));
  }
  (window.addEventListener('resize', () => {
    (ge.classList.contains('web-app') && k.scale === 'fit' && k.updateScale('fit'), Dt(), Zr());
  }),
    window.addEventListener(
      'scroll',
      () => {
        (Dt(), E.refreshAtPointer(), Zr());
      },
      { passive: !0 }
    ),
    (k.onScaleChanged = () => {
      (Dt(), mt.scheduleRedraw(), E.refreshAtPointer(), Zr());
    }));
  let Oe = new ja({
    manager: en,
    overlay: mt,
    getSource: () => Fn(),
    getScalarPlane: () => Js(),
    getCalibration: () => At,
    setCalibration: c => {
      ((At = c), mt.scheduleRedraw(), ot());
    },
    saveTextFile: (c, f, b) =>
      p.postMessage({ type: 'measureSaveText', fileName: c, content: f, open: b?.open !== !1 }),
    saveBinaryFile: (c, f) =>
      p.postMessage({ type: 'measureSaveBinary', fileName: c, bytes: Array.from(f) }),
    requestImport: c => p.postMessage({ type: 'measureRequestImport', kind: c }),
    saveSidecar: c => p.postMessage({ type: 'measureSaveSidecar', content: c }),
  });
  function iu() {
    if (At.origin === 'manual') return;
    let c = j._lastRaw ? Ml(j.metadata) : null,
      f = oe._lastRaw ? Cl(oe.metadata) : null,
      b = g.rawTiffData?.ome || null,
      y = wl(g._lastAllTags);
    ((At = c || f || (b ? kl(b, null) : y || { ...Mi })), mt.scheduleRedraw());
  }
  function au(c) {
    return c.map(f => ws(f));
  }
  function ru(c) {
    let f = [];
    for (let b of c) {
      let y = Ms(b);
      y && f.push(y);
    }
    return f;
  }
  function Zs() {
    ((Ui = null),
      (Hi = null),
      iu(),
      Oe.onImageChanged(),
      (pn = -1),
      (be = []),
      (We = null),
      (je || Wt.isVisible()) && gn(),
      je && Dn(),
      p.postMessage({ type: 'measureCheckSidecar' }));
  }
  let su = new Xa();
  (E.setNpyProcessor(L),
    E.setPfmProcessor(M),
    E.setPpmProcessor(T),
    E.setPngProcessor(_),
    E.setHdrProcessor(I),
    E.setTgaProcessor(A),
    E.setWebImageProcessor(N),
    E.setExrProcessor(w),
    E.setScientificProcessors(re),
    E.setLayeredPreviewProcessor(ee));
  function zi() {
    (ce.dispose(), ue.dispose(), (yr = 'cpu'));
    for (let c of ye) {
      let f = c?._webglRenderer;
      f && typeof f.dispose == 'function' && f.dispose();
    }
  }
  let Ue = 0,
    bn = new Map(),
    Ot = new Map(),
    Zn = new Set(),
    ji = new Set(),
    ur = new Set(),
    yn = null,
    ou = 1,
    Qn = null,
    Gi = new Map(),
    ei = new Map(),
    xt = 'javascript',
    Ft = 'auto',
    dr = 0,
    ti = { red: 30, green: 30, blue: 30 },
    tn = null,
    O = new ar(),
    Ie = new rr(
      O,
      {
        onChange: (c = {}) => {
          let f = c.settled ? Ue : ++Ue;
          c.settled ? Fu(f) : Ar(f, c.interactive === !0);
          let b = Ka(O.canvasWidth, O.canvasHeight);
          (c.settled
            ? b && Bu(f)
            : c.interactive
              ? b
                ? (Et(0, !0, f), Et(180, !1, f))
                : Et(0, !1, f)
              : aa(f, 60),
            ot());
        },
        onBackgroundChange: c => {
          (yu(c), ot());
        },
        onPersist: () => {
          ot();
        },
        onAddLayer: () => {
          p.postMessage({ type: 'executeCommand', command: 'tiffVisualizer.addLayer' });
        },
        onExport: () => {
          p.postMessage({ type: 'executeCommand', command: 'tiffVisualizer.exportLayers' });
        },
        onCompositorBackendChange: c => {
          ((Ft = c), Er(), c === 'auto' ? Qi(!0, !0) : Lr(c, !0, !0));
        },
        onVisibilityChange: c => {
          if (
            ((O.active = c), c || Ue++, p.postMessage({ type: 'layerModeChanged', active: c }), c)
          ) {
            (Ft === 'auto' && Qi(!0), ta() || zn());
            let f = ++Ue;
            aa(f, 60);
          } else sn(null);
          (Gn(), ot());
        },
      },
      { closable: r.settings.surfaceMode !== 'layers' }
    );
  ((ee.onLayersReady = () => {
    if (fe === 'Layered Document') {
      if ((Gn(), Bt)) {
        (($r = !1), ko());
        return;
      }
      if (r.settings.surfaceMode === 'layers' && !ci) {
        ((ci = !0), Ie.show(), p.postMessage({ type: 'requestInitialLayers' }));
        return;
      }
      if (
        !(!O.active && !Ie.isVisible() && r.settings.surfaceMode !== 'layers') &&
        ((Wi = void 0), ta())
      ) {
        let c = ++Ue;
        (aa(c, 60), ot());
      }
    }
  }),
    (E.compositeValueProvider = (c, f) =>
      O.active && O.hasCompositeStack() ? O.getCompositeValueAt(c, f) : null),
    (E.decodedValueProvider = (c, f) => {
      if (!Mn) return null;
      let { floatData: b, width: y, height: x } = Mn;
      return c < 0 || f < 0 || c >= y || f >= x ? null : b[f * y + c];
    }),
    (E.debayerValueProvider = (c, f) => {
      let b = r.settings.debayer;
      if (!b?.enabled || b.view === 'mosaic') return null;
      let y = B?.width;
      return !y || c < 0 || f < 0 ? null : ll(c, f, y);
    }));
  let hr,
    vn,
    Wi,
    Qs = c => Qc(c),
    lu = (c, f) => {
      try {
        let b = new URL(c),
          y = An('', f)?.kind === 'tiff';
        return /^(?:http|https):$/.test(b.protocol) && (y || Qs(b.pathname.toLowerCase()))
          ? c
          : void 0;
      } catch {
        return;
      }
    },
    eo = c => eu(c),
    Me = !1,
    B = null,
    to = 16384,
    no = 16384 * 16384,
    io = 2 ** 31 - 1,
    mr = 268435456;
  function ni(c) {
    return (
      !!c.closest('.histogram-overlay') ||
      c.classList.contains('measure-overlay') ||
      c.classList.contains('detail-patch')
    );
  }
  let te = null,
    Ee = null,
    ii = 0,
    ai = null,
    Oi = 0,
    et = null,
    Y = null,
    ri = null,
    fr = null,
    pr = null,
    gr = null,
    br = null,
    Nt = [],
    st = null,
    Vi = !1,
    Xi = null,
    ie = 0,
    wt = null,
    ao,
    Yi = null,
    xn = !1,
    Ve = 0,
    De = 0,
    nn = l?.visibleTotalMs ?? null,
    Nn = nn === null ? null : Promise.resolve(nn),
    fe = '',
    Xe = null,
    si = null,
    qi = null,
    Bn = null,
    yr = 'cpu',
    vr = null,
    xr = null,
    wn = null,
    an = !1,
    oi = !1;
  function um() {
    return Xe ? `, decode: ${Xe.engine} ${Xe.durationMs.toFixed(2)}ms` : '';
  }
  let cu = /^fetch(\(.*\))?$/,
    ro = /^decode-(worker|local)\(.*\)$|^decode-(wasm|geotiff)(-worker|-local|-strip-pool)?$/,
    uu = /^(stats|finite-scan|histogram-stats)$/,
    du = /^(interleave|deinterleave|raster-copy)$/,
    hu = /^(render|render-webgl|canvas-upload|webgl-context-setup|webgl-texture-upload)$/;
  function mu(c, f, b) {
    let y = ne.totalMatching(cu),
      x = ne.totalMatching(ro),
      C = ne.firstMatching(ro),
      R = Xe?.engine || '';
    if (!R && C) {
      let $ = C.match(/^decode-(?:worker|local)\((.*)\)$/);
      $
        ? (R = `${$[1]} (${C.startsWith('decode-worker') ? 'worker' : 'main'})`)
        : C === 'decode-wasm-strip-pool'
          ? (R = 'wasm (strip pool)')
          : C.startsWith('decode-wasm')
            ? (R = `wasm (${C.endsWith('-local') ? 'main' : 'worker'})`)
            : C.startsWith('decode-geotiff') &&
              (R = `geotiff.js (${C.endsWith('-worker') ? 'worker' : 'main'})`);
    }
    let P = ne.totalMatching(uu),
      S = ne.totalMatching(du),
      F = ne.totalMatching(hu),
      H = Math.max(0, Number(f) - y - x - P - S - F),
      D = [];
    return (
      y > 0 && D.push(`read ${y.toFixed(0)}ms`),
      x > 0 && D.push(`decode ${x.toFixed(0)}ms${R ? ` [${R}]` : ''}`),
      P > 0 && D.push(`stats ${P.toFixed(0)}ms`),
      S > 0 && D.push(`reshape ${S.toFixed(0)}ms`),
      F > 0 && D.push(`render ${F.toFixed(0)}ms`),
      H >= 1 && D.push(`other ${H.toFixed(0)}ms`),
      D.push(`webview ${f}ms`),
      D.push(`total ${b}ms`),
      `[Perf] ${c}: ${D.join(' | ')}`
    );
  }
  function fu() {
    nn !== null ||
      Nn ||
      (Nn = new Promise(c => {
        let f = !1,
          b = () => {
            f ||
              ((f = !0),
              (nn = De ? Math.max(0, Date.now() - De) : Math.max(0, performance.now() - Ve)),
              c(nn));
          };
        (requestAnimationFrame(() => requestAnimationFrame(b)), setTimeout(b, 100));
      }));
  }
  function pu(c) {
    let f = ie,
      b = () =>
        window.setTimeout(() => {
          f === ie && c();
        }, 0);
    Nn ? Nn.then(b) : requestAnimationFrame(() => requestAnimationFrame(b));
  }
  function gu(c) {
    let f = [],
      b = B?.width || te?.naturalWidth || te?.width,
      y = B?.height || te?.naturalHeight || te?.height;
    b && y && f.push(`${b}x${y}`);
    let x = m?.generation === ie ? d : null,
      C = Number(x?.samplesPerPixel ?? 0);
    C > 0 && f.push(`${C} sample${C === 1 ? '' : 's'}`);
    let R = Number(x?.bitsPerSample ?? 0);
    if (R > 0) {
      let K = x?.sampleFormat === 3 ? 'float' : x?.sampleFormat === 2 ? 'int' : 'uint';
      f.push(`${K}${R}`);
    }
    let P = g.pageDirectory,
      S = f.length;
    if (Tt(P)) {
      let K = gt(P, g.pageIndex),
        J = dn(P, K),
        se = J.findIndex(Te => Te.index === g.pageIndex),
        Re = yi(P);
      (Re.length > 1 && f.push(`page ${Re.findIndex(Te => Te.index === K) + 1}/${Re.length}`),
        f.push(`level ${se + 1}/${J.length} (${Xn(J[se] ?? J[0])})`));
    } else g.pageCount > 1 && f.push(`page ${g.pageIndex + 1}/${g.pageCount}`);
    let F = f.length > S,
      H = Number(x?.width) === b && Number(x?.height) === y;
    if (!F && H) return null;
    let D = String(r.settings.resourceUri || r.settings.src || ''),
      $ = D ? decodeURIComponent(D.split(/[\\/]/).pop() || '') : '',
      W = $ ? ` \u2014 ${$}` : '';
    return `[Visible] ${c}: ${f.join(', ')}${W}`;
  }
  function Rt(c, f, b) {
    let y = mu(c, f, b),
      x = Nn,
      C = gu(c),
      R = () => {
        C && ct(C);
      };
    nn !== null
      ? (ct(`${y} | visible ${nn.toFixed(0)}ms`), R())
      : x
        ? x.then(P => {
            (ct(`${y} | visible ${P.toFixed(0)}ms`), R());
          })
        : (ct(y), R());
  }
  function wr() {
    ((nn = null), (Nn = null));
  }
  function Mr() {
    (Yi?.(),
      (ao = new Promise(c => {
        Yi = c;
      })));
  }
  function Cr() {
    (Yi?.(), (Yi = null));
  }
  Mr();
  let $n = null,
    bu = null,
    kr = !1,
    Mn = null,
    Un = null,
    xe = p.getState(),
    Bt = null;
  if (xe) {
    if (
      ((Nt = xe.peerImageUris || []),
      (xn = xe.isShowingPeer || !1),
      ($n = xe.colormapConversionState || null),
      (g.pageIndex = Math.max(0, Number(xe.tiffPageIndex || 0))),
      xe.displayColormap && (r.settings.displayColormap = xe.displayColormap),
      xe.debayer &&
        ((r.settings.debayer = xe.debayer),
        ke.setSettings(xe.debayer),
        xe.isDebayerPanelVisible && ke.show()),
      xe.measureCalibration && (At = xe.measureCalibration),
      xe.scaleBarPosition && mt.setScaleBarPosition(xe.scaleBarPosition),
      Array.isArray(xe.measureRois) && xe.measureRois.length > 0)
    ) {
      let y = ru(xe.measureRois);
      en.withoutHistory(() => en.replaceAll(y, { recordHistory: !1 }));
    }
    (xe.isMeasurePanelVisible && Oe.show(),
      Array.isArray(xe.channelSettings) && (pe = xe.channelSettings),
      typeof xe.channelSolo == 'number' && (We = xe.channelSolo),
      (je = xe.compositeEnabled === !0),
      xe.isChannelsPanelVisible && Wt.show(),
      Array.isArray(xe.layerGroupCollapsed) &&
        (Ie.collapsedGroups = new Set(xe.layerGroupCollapsed.map(String))),
      Number.isFinite(xe.layerBackgroundBrightness) &&
        (Ie.backgroundBrightness = Math.max(
          0,
          Math.min(100, Number(xe.layerBackgroundBrightness))
        )));
    let c = xe.layerCompositorBackendSelection;
    (c === 'auto' || c === 'webgpu' || c === 'gpu' || c === 'wasm' || c === 'javascript') &&
      ((Ft = c), Ie.setCompositorBackend(Ft));
    let f = xe.layerBackgroundTint;
    f &&
      [f.red, f.green, f.blue].every(Number.isFinite) &&
      (tn = {
        red: Math.max(0, Math.min(255, Number(f.red))),
        green: Math.max(0, Math.min(255, Number(f.green))),
        blue: Math.max(0, Math.min(255, Number(f.blue))),
      });
    let b = xe.layers;
    Array.isArray(b) &&
      (b.length > 1 || xe.layerActive) &&
      (Bt = {
        layers: b,
        active: !!xe.layerActive,
        collapsed: !!xe.layerCollapsed,
        documentUri: xe.layerDocumentUri,
      });
  }
  let He = { totalImages: 1, currentIndex: 0, show: !1 },
    Ye = null,
    Vt = null,
    $t =
      xe?.netcdfSelection && typeof xe.netcdfSelection == 'object'
        ? {
            variableName: xe.netcdfSelection.variableName,
            indices: { ...(xe.netcdfSelection.indices || {}) },
          }
        : { indices: {} },
    so = [],
    oo = null,
    lo = c => so.includes(c),
    ft =
      xe?.planeSelection && typeof xe.planeSelection == 'object'
        ? { indices: { ...(xe.planeSelection.indices || {}) } }
        : { indices: {} },
    dm = '',
    Ki = !1,
    Sr = !1,
    Mt = null,
    rn = 0,
    Ut = {},
    Ji = !1,
    Zi = '',
    Ge = null,
    Cn = null;
  function Xt() {
    let c = k.getCurrentState(),
      f = {
        peerImageUris: Nt,
        isShowingPeer: xn,
        currentResourceUri: r.settings.resourceUri,
        colormapConversionState: $n,
        displayColormap: r.settings.displayColormap,
        debayer: r.settings.debayer,
        isDebayerPanelVisible: ke.isVisible(),
        isMeasurePanelVisible: Oe.isVisible(),
        isChannelsPanelVisible: Wt.isVisible(),
        compositeEnabled: je,
        channelSettings: pe,
        channelSolo: We,
        measureRois: au(en.list()),
        measureCalibration: At,
        scaleBarPosition: mt.getScaleBarPosition(),
        isHistogramVisible: V.getVisibility(),
        netcdfSelection: $t,
        planeSelection: ft,
        scale: c.scale,
        offsetX: c.x,
        offsetY: c.y,
        layerDocumentUri: r.settings.resourceUri,
        layers: O.layers.map(b => ({
          id: b.id,
          resourceUri: b.uri,
          name: b.name,
          offsetX: b.offsetX,
          offsetY: b.offsetY,
          opacity: b.opacity,
          blendMode: b.blendMode,
          visible: b.visible,
          maskCondition: b.maskCondition,
          kind: b.kind,
          adjustment: b.adjustment,
          parentId: b.parentId,
          clipped: b.clipped,
          groupPath: b.groupPath,
          groupIds: b.groupIds,
          sourceNodeId: b.sourceNodeId,
          sourceSupport: b.sourceSupport,
          sourceBlendMode: b.sourceBlendMode,
          sourceNumericType: b.sourceNumericType,
          isBase: b.id === vn,
        })),
        layerActive: O.active,
        layerCollapsed: Ie.collapsed,
        layerGroupCollapsed: [...Ie.collapsedGroups],
        layerCompositorBackend: xt,
        layerCompositorBackendSelection: Ft,
        layerBackgroundBrightness: Ie.backgroundBrightness,
        layerBackgroundTint: Ie.backgroundBrightness === null ? null : tn,
        tiffPageIndex: g.pageIndex,
        timestamp: Date.now(),
      };
    p.setState(f);
  }
  let Rr = null;
  function ot() {
    Rr ||
      (Rr = setTimeout(() => {
        ((Rr = null), Xt());
      }, 150));
  }
  let ge = document.body,
    lt = document.createElement('img');
  function co({ red: c, green: f, blue: b }) {
    let y = c / 255,
      x = f / 255,
      C = b / 255,
      R = Math.max(y, x, C),
      P = Math.min(y, x, C),
      S = R - P,
      F = (R + P) / 2;
    if (S === 0) return { hue: 0, saturation: 0, lightness: F * 100 };
    let H = S / (1 - Math.abs(2 * F - 1)),
      D = R === y ? ((x - C) / S) % 6 : R === x ? (C - y) / S + 2 : (y - x) / S + 4;
    return ((D = (D * 60 + 360) % 360), { hue: D, saturation: H * 100, lightness: F * 100 });
  }
  function uo(c) {
    if (c === null) {
      (delete ge.dataset.layerBackgroundOverride,
        ge.style.removeProperty('--layer-preview-background'));
      return;
    }
    let f = co(tn || ti),
      b = Math.max(0, Math.min(100, c));
    ((ge.dataset.layerBackgroundOverride = 'true'),
      ge.style.setProperty('--layer-preview-background', `hsl(${f.hue}, ${f.saturation}%, ${b}%)`));
  }
  function yu(c) {
    (c === null ? (tn = null) : tn || (tn = { ...ti }), uo(c));
  }
  function ho() {
    let c = document.createElement('span');
    ((c.style.color = 'var(--vscode-editor-background, #1e1e1e)'),
      (c.style.display = 'none'),
      document.body.appendChild(c));
    let f = getComputedStyle(c).color.match(/[\d.]+/g);
    if ((c.remove(), !f || f.length < 3)) return;
    let [b, y, x] = f.slice(0, 3).map(Number);
    ((ti = { red: b, green: y, blue: x }), Ie.setThemeBackgroundBrightness(co(ti).lightness));
  }
  (ho(), Ie.backgroundBrightness !== null && !tn && (tn = { ...ti }), uo(Ie.backgroundBrightness));
  let mo = new MutationObserver(ho);
  (mo.observe(document.documentElement, { attributes: !0, attributeFilter: ['class', 'style'] }),
    mo.observe(document.body, { attributes: !0, attributeFilter: ['class', 'style'] }));
  function vu() {
    ((Ve = performance.now()), (De = r.settings.loadStartTime || 0), (wt = new AbortController()));
    for (let y of ye) y.loadSignal = wt.signal;
    (Mu(),
      Hu(),
      Gu(),
      Wu(),
      Qu(),
      qu(),
      gd(),
      window.addEventListener('beforeunload', Xt),
      window.addEventListener('pagehide', Xt));
    let c = r.settings,
      f = c.resourceUri ?? '',
      b = c.src ?? '';
    if ((po('open', f), b && Qr(b, f, ie, c.formatHint), Nt.length > 0)) {
      for (let y of Nt) p.postMessage({ type: 'restorePeerImage', peerUri: y });
      setTimeout(() => {
        for (let y of Nt) ts(y);
      }, 1e3);
    }
    if ($n) {
      let y = $n,
        x = async () => {
          Me && B
            ? await Io(y.colormapName, y.minValue, y.maxValue, y.inverted, y.logarithmic)
            : setTimeout(x, 50);
        };
      setTimeout(x, 100);
    }
  }
  function fo() {
    (wr(),
      (Me = !1),
      (B = null),
      (te = null),
      (Ee = null),
      (et = null),
      Dt(),
      (Y = null),
      (ri = null),
      E.setPhysicalPixelSize(null),
      E.setGeoReference(null),
      E.setCoordinateScale(1),
      E.setStoredValueResolver(null),
      zi());
    for (let C of ye) C._isInitialLoad = !0;
    (p.postMessage({ type: 'stats', value: null }),
      (ge.className = 'container image'),
      (Ee = null),
      (et = null),
      ge.querySelectorAll('img, canvas, .pyramid-scene').forEach(C => {
        ni(C) || C.remove();
      }));
    let f = ge.querySelector('.loading-indicator');
    (f && f.remove(), ge.classList.add('loading'), ge.classList.remove('error'));
    let b = r.settings,
      y = b.resourceUri || '';
    k.resetZoom();
    let x = b.src ?? '';
    (po('reload', y), Qr(x, y, ie, b.formatHint));
  }
  function xu(c) {
    p.postMessage({ type: 'formatInfo', value: c });
  }
  function ct(c) {
    p.postMessage({ type: 'log', value: c });
  }
  let wu = !1;
  function kn(c) {
    (console.log(c),
      (wu || /\b(failed|device lost|validation error|unavailable)\b/i.test(c)) && ct(c));
  }
  (de.setLogger(kn), ce.setLogger(kn), ue.setLogger(kn));
  function Er() {
    (dr++, de.dispose(), ce.dispose(), ue.dispose(), O.invalidateComposite());
  }
  function Lr(c, f, b = !1) {
    let y = xt !== c;
    if (((xt = c), Ie.setResolvedCompositorBackend(c), !y && !b)) {
      f && ot();
      return;
    }
    if (
      (de.invalidateCompositeCache(),
      c === 'gpu' && ce.retry(),
      c === 'webgpu' && ue.retry(),
      f && O.active && !O.isEmpty())
    ) {
      let x = ++Ue;
      aa(x, 60);
    }
    ot();
  }
  async function Qi(c, f = !1) {
    let b = ++dr,
      y = 'javascript';
    (r.settings.gpuAcceleration !== !1 && (await ue.isAvailable())
      ? (y = 'webgpu')
      : r.settings.gpuAcceleration !== !1 && ce.isAvailable()
        ? (y = 'gpu')
        : (await de.isWasmAvailable()) && (y = 'wasm'),
      !(b !== dr || Ft !== 'auto') && Lr(y, c, f));
  }
  (Ft !== 'auto' && Lr(Ft, !1),
    ne.setLogger(c => {
      (console.log(c), ct(c));
    }));
  function po(c, f) {
    let b = f || 'image';
    try {
      b = decodeURIComponent(b.split('/').pop() || b);
    } catch {
      b = b.split('/').pop() || b;
    }
    ne.begin(`${c} ${b}`);
  }
  async function Fe(c, f, b = () => !0) {
    if (!f || !b()) return;
    let y = c.width * c.height;
    if (y > mr) {
      let R = `Image is ${c.width}x${c.height} (${(y / 1e6).toFixed(0)} megapixels), above the ${(mr / 1e6).toFixed(0)} megapixel limit a browser canvas can display. The pixel data decoded correctly and values can still be inspected; tiled rendering for images this large is not implemented yet.`;
      (console.warn(`[Canvas] ${R}`),
        ct(`[Canvas] ${R}`),
        p.postMessage({ type: 'show-error', message: R }));
      return;
    }
    (f.canvas.width !== c.width || f.canvas.height !== c.height) &&
      ((f.canvas.width = c.width), (f.canvas.height = c.height));
    let x = performance.now();
    if (c.width * c.height > 25e6) {
      (b() && f.putImageData(c, 0, 0),
        console.log(`[Canvas] putImageData upload took ${(performance.now() - x).toFixed(2)}ms`),
        ne.mark('canvas-upload'));
      return;
    }
    try {
      let R = await createImageBitmap(c);
      (b() && (f.save(), (f.globalCompositeOperation = 'copy'), f.drawImage(R, 0, 0), f.restore()),
        R.close(),
        console.log(`[Canvas] ImageBitmap upload took ${(performance.now() - x).toFixed(2)}ms`));
    } catch (R) {
      console.error('Error creating ImageBitmap, falling back to putImageData', R);
      let P = performance.now();
      (b() && f.putImageData(c, 0, 0),
        console.log(`[Canvas] putImageData fallback took ${(performance.now() - P).toFixed(2)}ms`));
    }
    ne.mark('canvas-upload');
  }
  function tt() {
    if (!B) return null;
    let c = B.getContext('2d', { willReadFrequently: !0 });
    if (c) return c;
    let f = document.createElement('canvas');
    return (
      (f.width = B.width),
      (f.height = B.height),
      (f.className = B.className),
      (f.style.cssText = B.style.cssText),
      Ee && B.parentElement === Ee.element
        ? (B.replaceWith(f), Ee.clearTiles())
        : te === B && B.parentElement && B.replaceWith(f),
      (B = f),
      (te = Ee?.element || f),
      k.setCanvas(B),
      k.setImageElement(te),
      E.setImageElement(te),
      E.addMouseListeners(te),
      (c = B.getContext('2d', { willReadFrequently: !0 })),
      c
    );
  }
  function Tr(c) {
    let f = c.getContext('2d', { willReadFrequently: !0 });
    if (f) return f.getImageData(0, 0, c.width, c.height);
    let b = c.getContext('webgl2');
    if (!b) return null;
    let y = c.width,
      x = c.height,
      C = new Uint8Array(y * x * 4);
    b.readPixels(0, 0, y, x, b.RGBA, b.UNSIGNED_BYTE, C);
    let R = new Uint8ClampedArray(C.length),
      P = y * 4;
    for (let S = 0; S < x; S++) {
      let F = (x - 1 - S) * P,
        H = S * P;
      R.set(C.subarray(F, F + P), H);
    }
    return new ImageData(R, y, x);
  }
  function Mu() {
    (ge.classList.add('image'),
      lt.classList.add('scale-to-fit'),
      lt.addEventListener('load', () => {
        Me || Cu();
      }),
      lt.addEventListener('error', () => {
        Me || Je();
      }));
  }
  async function Cu() {
    ((Me = !0),
      (B = document.createElement('canvas')),
      (B.width = lt.naturalWidth),
      (B.height = lt.naturalHeight),
      B.classList.add('scale-to-fit'));
    let c = B.getContext('2d');
    if (!c) {
      Je();
      return;
    }
    (c.drawImage(lt, 0, 0), (te = B), at());
  }
  function ea(c, f) {
    if (!(c > 0 && f > 0) || c * f > mr || c * f * 4 > io) return !1;
    let b = to,
      y = no;
    if (c <= b && f <= b && c * f <= y) return !0;
    try {
      let x = document.createElement('canvas');
      return (
        (x.width = c),
        (x.height = f),
        x.width !== c || x.height !== f || !x.getContext('2d')
          ? !1
          : ((x.width = 1), (x.height = 1), !0)
      );
    } catch {
      return !1;
    }
  }
  function go(c, f) {
    let b = ((c * f) / 1e6).toFixed(1);
    return `This image is ${c} x ${f} (${b} megapixels), which exceeds the maximum canvas size this browser can allocate. The file decoded correctly; it cannot be displayed at full resolution.`;
  }
  function Je(c = '') {
    (ne.cancel(),
      (Me = !0),
      Cr(),
      Ur(),
      ra(),
      ge.querySelectorAll('img, canvas, .pyramid-scene').forEach(b => {
        ni(b) || b.remove();
      }),
      ge.classList.add('error'),
      ge.classList.remove('loading'));
    let f = ge.querySelector('.image-load-error p');
    f && (f.textContent = c || 'An error occurred while loading the image.');
  }
  async function bo(c, f = ie, b = g.pageIndex, { chooseLevel: y = !0 } = {}) {
    ((fe = 'TIFF'), (Xe = null));
    try {
      let x = await g.processTiff(
        c,
        b,
        y
          ? {
              displayWidth:
                (ge.clientWidth || window.innerWidth || 1024) * (window.devicePixelRatio || 1),
              maxAxis: to,
              maxArea: no,
              maxBytes: io,
              pixelBudget: rs,
            }
          : void 0
      );
      if (f !== ie) return;
      if (!ea(x.canvas.width, x.canvas.height)) {
        let P = pd(b);
        if (P && P.index !== b) {
          (ct(
            `[Level] ${x.canvas.width}x${x.canvas.height} exceeds this browser's canvas limit; showing overview ${Xn(P)}`
          ),
            await Rn(P.index));
          return;
        }
        Je(go(x.canvas.width, x.canvas.height));
        return;
      }
      let C = g.omeMetadata;
      if (C && !Mt) {
        let P = C.images?.length ? C.images : [C],
          S = P.flatMap(H => Object.values(H.coordinateToPlane || {})).filter(
            H => !!H.fileName
          ).length,
          F = `${C.uuid || C.imageId || ''}:${P.length}:${S}`;
        S > 0 &&
          F !== Zi &&
          ((Zi = F),
          p.postMessage({
            type: 'registerOmeDataset',
            dataset: {
              uuid: C.uuid,
              series: P.map(H => ({
                imageId: H.imageId,
                imageName: H.imageName,
                sizeC: H.planeSizeC,
                sizeZ: H.sizeZ,
                sizeT: H.sizeT,
                channelNames: H.channels.map(D => D.name),
                planes: Object.values(H.coordinateToPlane || {}),
              })),
              currentResourceUri: r.settings.resourceUri,
              currentPageIndex: g.pageIndex,
            },
          }));
      } else if (g.omeBinaryOnly && !Mt) {
        let P = g.omeBinaryOnly,
          S = `binary-only:${P.metadataFile}:${r.settings.resourceUri}`;
        S !== Zi &&
          ((Zi = S),
          p.postMessage({
            type: 'registerOmeDataset',
            dataset: {
              metadataFile: P.metadataFile,
              metadataUuid: P.uuid,
              currentResourceUri: r.settings.resourceUri,
              currentPageIndex: g.pageIndex,
            },
          }));
      }
      (E.setPhysicalPixelSize(
        C
          ? {
              x: C.physicalSizeX,
              y: C.physicalSizeY,
              xUnit: C.physicalSizeXUnit,
              yUnit: C.physicalSizeYUnit,
            }
          : null
      ),
        E.setGeoReference(g.geoReference || null),
        (Xe = x.decodeInfo),
        (Ee = null),
        (et = null),
        Dt(),
        (B = x.canvas),
        (Y = x.imageData),
        (te = B));
      let R = g._pendingRenderData ? null : B.getContext('2d');
      if (
        (R && Y && (await Fe(Y, R)),
        (Me = !0),
        Cr(),
        g._pendingRenderData && Ke(!0),
        !g._pendingRenderData)
      ) {
        (jo(), Go(), at(), Ke(), fi());
        let S = (performance.now() - Ve).toFixed(2),
          F = De ? Date.now() - De : S;
        Rt('TIFF', S, F);
      }
    } catch (x) {
      if (f !== ie) return;
      console.error('Error handling TIFF:', x);
      let C = String(x instanceof Error ? x.message : x);
      C.toLowerCase().includes('compression')
        ? Je(`Unsupported TIFF compression: ${C}`)
        : Je(`Failed to load TIFF: ${C}`);
    }
  }
  async function ku(c, f = ie) {
    ((fe = 'EXR'), (Xe = null));
    try {
      let b = await w.processExr(c);
      if (f !== ie) return;
      ((Xe = w._lastDecodeInfo), (B = b.canvas), (Y = b.imageData), (te = B));
      let y = w._pendingRenderData ? null : B.getContext('2d');
      if ((y && Y && (await Fe(Y, y)), (Me = !0), !w._pendingRenderData)) {
        at();
        let C = (performance.now() - Ve).toFixed(2),
          R = De ? Date.now() - De : C;
        Rt('EXR', C, R);
      }
    } catch (b) {
      if (f !== ie) return;
      (console.error('Error handling EXR:', b), Je());
    }
  }
  async function Su(c, f = ie) {
    ((fe = 'PFM'), (Xe = null));
    try {
      let b = await M.processPfm(c);
      if (f !== ie) return;
      ((B = b.canvas), (Y = b.imageData), (te = B));
      let y = M._pendingRenderData ? null : B.getContext('2d');
      if ((y && Y && (await Fe(Y, y)), (Me = !0), !M._pendingRenderData)) {
        at();
        let C = (performance.now() - Ve).toFixed(2),
          R = De ? Date.now() - De : C;
        Rt('PFM', C, R);
      }
    } catch (b) {
      if (f !== ie) return;
      (console.error('Error handling PFM:', b), Je());
    }
  }
  async function Ht(c, f, b = ie, y = {}) {
    ((fe = c.config.formatLabel), (Xe = null));
    try {
      let x = await c.process(f, y);
      if (b !== ie) return;
      if (!ea(x.canvas.width, x.canvas.height)) {
        Je(go(x.canvas.width, x.canvas.height));
        return;
      }
      (c === j &&
        !Mt &&
        Number(c.metadata.frames || 1) > 1 &&
        p.postMessage({
          type: 'registerDicomFrames',
          frames: Number(c.metadata.frames),
          frameLabels: Array.isArray(c.metadata.frameLabels) ? c.metadata.frameLabels : void 0,
        }),
        lo(c) &&
          ((oo = c),
          (ft = { indices: { ...(c.metadata.selectedIndices || {}) } }),
          id(c.metadata, !1),
          $o()),
        c === q &&
          (($t = {
            variableName: String(c.metadata.variable || ''),
            indices: { ...(c.metadata.selectedIndices || {}) },
          }),
          sd(c.metadata, !1)),
        (B = x.canvas),
        (Y = x.imageData),
        (te = B));
      let C = c._pendingRenderData ? null : B.getContext('2d');
      (C && Y && (await Fe(Y, C)), (Me = !0), c._pendingRenderData || at());
    } catch (x) {
      if (b !== ie) return;
      (c === q && Be?.classList.remove('dataset-overlay--loading'),
        lo(c) && (Be?.classList.remove('dataset-overlay--loading'), $o()),
        console.error(`Error handling ${c.config.formatLabel}:`, x),
        Je(
          `Failed to load ${c.config.formatLabel}: ${x instanceof Error ? x.message : String(x)}`
        ));
    }
  }
  async function Ru(c, f, b = ie) {
    ((fe = 'Layered Document'), (Xe = null));
    try {
      let y = await ee.process(f, c);
      if (b !== ie) return;
      ((B = y.canvas), (Y = y.imageData), (te = B));
      let x = ee._pendingRenderData ? null : B.getContext('2d');
      (x && Y && (await Fe(Y, x)), (Me = !0), Gn(), ee._pendingRenderData || at());
    } catch (y) {
      if (b !== ie) return;
      (console.error(`Error handling layered ${c} document:`, y),
        Je(`Failed to load ${c.toUpperCase()}: ${y instanceof Error ? y.message : String(y)}`));
    }
  }
  async function Eu(c, f = ie) {
    ((fe = 'PPM/PGM'), (Xe = null));
    try {
      let b = await T.processPpm(c);
      if (f !== ie) return;
      ((B = b.canvas), (Y = b.imageData), (te = B));
      let y = T._pendingRenderData ? null : B.getContext('2d');
      if ((y && Y && (await Fe(Y, y)), (Me = !0), !T._pendingRenderData)) {
        at();
        let C = (performance.now() - Ve).toFixed(2),
          R = De ? Date.now() - De : C;
        Rt('PPM/PGM', C, R);
      }
    } catch (b) {
      if (f !== ie) return;
      (console.error('Error handling PPM/PGM:', b), Je());
    }
  }
  async function Lu(c, f = ie) {
    ((fe = 'PNG/JPEG'), (Xe = null));
    try {
      let b = await _.processPng(c);
      if (f !== ie) return;
      ((B = b.canvas), (Y = b.imageData), (te = b.displayElement || B));
      let y = _._pendingRenderData ? null : B.getContext('2d');
      if (
        (y && Y && !b.canvasAlreadyRendered && (await Fe(Y, y)),
        (Me = !0),
        !_._pendingRenderData && !b.lazyPixelData)
      ) {
        at();
        let C = (performance.now() - Ve).toFixed(2),
          R = De ? Date.now() - De : C;
        Rt('PNG/JPEG', C, R);
      }
    } catch (b) {
      if (f !== ie) return;
      (console.error('Error handling PNG/JPEG:', b), Je());
    }
  }
  async function Tu(c, f = ie) {
    ((fe = 'NPY/NPZ'), (Xe = null));
    try {
      let b = await L.processNpy(c);
      if (f !== ie) return;
      ((B = b.canvas), (Y = b.imageData), (te = B));
      let y = L._pendingRenderData ? null : B.getContext('2d');
      if ((y && Y && (await Fe(Y, y)), (Me = !0), !L._pendingRenderData)) {
        at();
        let C = (performance.now() - Ve).toFixed(2),
          R = De ? Date.now() - De : C;
        Rt('NPY/NPZ', C, R);
      }
    } catch (b) {
      if (f !== ie) return;
      (console.error('Error handling NPY/NPZ:', b), Je());
    }
  }
  async function _u(c, f = ie) {
    ((fe = 'HDR'), (Xe = null));
    try {
      let b = await I.processHdr(c);
      if (f !== ie) return;
      ((B = b.canvas), (Y = b.imageData), (te = B));
      let y = I._pendingRenderData ? null : B.getContext('2d');
      if ((y && (await Fe(Y, y)), (Me = !0), !I._pendingRenderData)) {
        at();
        let C = (performance.now() - Ve).toFixed(2),
          R = De ? Date.now() - De : C;
        Rt('HDR', C, R);
      }
    } catch (b) {
      if (f !== ie) return;
      (console.error('Error handling HDR:', b), Je());
    }
  }
  async function Pu(c, f = ie) {
    ((fe = 'TGA'), (Xe = null));
    try {
      let b = await A.processTga(c);
      if (f !== ie) return;
      ((B = b.canvas), (Y = b.imageData), (te = B));
      let y = A._pendingRenderData ? null : B.getContext('2d');
      if ((y && (await Fe(Y, y)), (Me = !0), !A._pendingRenderData)) {
        at();
        let C = (performance.now() - Ve).toFixed(2),
          R = De ? Date.now() - De : C;
        Rt('TGA', C, R);
      }
    } catch (b) {
      if (f !== ie) return;
      (console.error('Error handling TGA:', b), Je());
    }
  }
  async function Iu(c, f = ie) {
    ((fe = 'Web Image'), (Xe = null));
    try {
      let b = await N.processWebImage(c);
      if (f !== ie) return;
      ((B = b.canvas), (Y = b.imageData), (te = b.displayElement || B));
      let y = N._pendingRenderData ? null : B.getContext('2d');
      if (
        (y && Y && !b.canvasAlreadyRendered && (await Fe(Y, y)), (Me = !0), !N._pendingRenderData)
      ) {
        at();
        let C = (performance.now() - Ve).toFixed(2),
          R = De ? Date.now() - De : C;
        Rt('Web', C, R);
      }
    } catch (b) {
      if (f !== ie) return;
      (console.error('Error handling Web Image:', b), Je());
    }
  }
  function at() {
    if (!te || !B) return;
    let c = te;
    (an && !Vi && (st = k.getCurrentState()),
      k.setImageElement(c),
      k.setCanvas(B),
      k.setImageLoaded(),
      E.setImageElement(c));
    let f = je || Wt.isVisible() || Oe.isVisible();
    f && Zs();
    let b = c,
      y = Number(c.dataset?.sceneWidth) || B?.width || b.naturalWidth || b.width,
      x = Number(c.dataset?.sceneHeight) || B?.height || b.naturalHeight || b.height;
    wn && wn !== c && wn.parentElement === ge ? wn.replaceWith(c) : c.isConnected || ge.append(c);
    for (let R of Array.from(ge.children)) {
      if (!(R instanceof HTMLElement)) continue;
      (R.tagName === 'IMG' || R.tagName === 'CANVAS' || R.classList.contains('pyramid-scene')) &&
        R !== c &&
        !ni(R) &&
        R.remove();
    }
    (ge.classList.remove('loading'),
      ge.classList.remove('error'),
      ge.classList.add('ready'),
      Xi && st && typeof st.scale == 'number' && (st = { ...st, scale: st.scale * Xi }),
      (Xi = null),
      st ? k.restoreState(st) : k.applyInitialZoom(),
      (st = null),
      (Vi = !1),
      Ur(),
      p.postMessage({ type: 'size', value: `${y}x${x}` }));
    let C =
      g._pendingRenderData ||
      ee._pendingRenderData ||
      L._pendingRenderData ||
      _._pendingRenderData ||
      T._pendingRenderData ||
      M._pendingRenderData ||
      w._pendingRenderData ||
      I._pendingRenderData ||
      A._pendingRenderData ||
      N._pendingRenderData ||
      re.some(R => !!R._pendingRenderData);
    (C || (fu(), ra()),
      E.addMouseListeners(te),
      ne.mark('finalize-dom'),
      Du() ? (zn(), ne.mark('layers-sync')) : ne.detail('layers-sync-skipped', 0),
      ko(),
      ne.mark('layers-restore'),
      O.active && O.hasCompositeStack() && (Ct(), ne.mark('layers-recomposite')),
      ne.mark('finalize'),
      C ||
        (ne.end(),
        pu(() => {
          (f || Zs(),
            Ne(),
            r.settings.surfaceMode === 'layers' &&
              !ci &&
              !ee.hasDeferredLayersPending() &&
              ((ci = !0), Ie.show(), Bt || p.postMessage({ type: 'requestInitialLayers' })));
        })));
  }
  function yo(c) {
    try {
      return decodeURIComponent((c || '').split('/').pop() || c || 'layer');
    } catch {
      return (c || '').split('/').pop() || 'layer';
    }
  }
  function Hn() {
    return vi(r.settings);
  }
  function vo(c) {
    let f = String(c || '').toLowerCase(),
      b = f.match(/^[<>=|]?([fiu])(\d+)$/),
      y = b ? Number(b[2]) * 8 : parseInt(f.replace(/\D/g, ''), 10) || 8;
    if (f.includes('f'))
      return {
        isFloat: !0,
        typeMax: 1,
        sourceNumericType: y <= 16 ? 'float16' : y <= 32 ? 'float32' : 'float64',
      };
    let C = `${(b ? b[1] === 'i' : f.includes('i') && !f.includes('u')) ? 'int' : 'uint'}${y <= 8 ? 8 : y <= 16 ? 16 : 32}`;
    return { isFloat: !1, typeMax: y >= 16 ? 65535 : 255, sourceNumericType: C };
  }
  function $e(c, f, b, y) {
    if (!c || !c.data) return null;
    let x =
      c.data instanceof Uint16Array
        ? 'uint16'
        : c.data instanceof Uint8Array || c.data instanceof Uint8ClampedArray
          ? 'uint8'
          : c.data instanceof Float64Array
            ? 'float64'
            : 'float32';
    return {
      data: c.data,
      width: c.width,
      height: c.height,
      channels: c.channels,
      isFloat: f.isFloat,
      typeMax: f.typeMax,
      sourceNumericType: f.sourceNumericType || x,
      name: b,
      uri: y,
    };
  }
  function Yt(c) {
    return {
      isFloat: !0,
      typeMax: c.numericDomain.typeMax,
      sourceNumericType: c.numericDomain.sourceNumericType,
    };
  }
  function xo(c, f, b) {
    if (!c || !c.data || !c.ifd) return null;
    let y = c.ifd,
      x = ya(y.t339, y.t258),
      C = va(y.t339, y.t258),
      R = Array.isArray(y.t339) ? y.t339[0] : y.t339,
      P = Array.isArray(y.t258) ? y.t258[0] : y.t258,
      S =
        R === 3
          ? P <= 16
            ? 'float16'
            : P <= 32
              ? 'float32'
              : 'float64'
          : `${R === 2 ? 'int' : 'uint'}${P <= 8 ? 8 : P <= 16 ? 16 : 32}`;
    return {
      data: c.data,
      width: y.width,
      height: y.height,
      channels: y.t277,
      isFloat: x,
      typeMax: C,
      sourceNumericType: S,
      name: f,
      uri: b,
    };
  }
  function wo(c, f, b) {
    return !c || !c.data
      ? null
      : {
          data: c.data,
          width: c.width,
          height: c.height,
          channels: c.channels,
          isFloat: !0,
          typeMax: 1,
          sourceNumericType: c.type === 1016 ? 'float16' : 'float32',
          name: f,
          uri: b,
        };
  }
  function qe(c, f) {
    if (!B) return null;
    let b = B.width,
      y = B.height,
      x = Tr(B);
    if (!x) return null;
    let C = new Float32Array(x.data.length);
    for (let R = 0; R < x.data.length; R++) C[R] = x.data[R];
    return {
      data: C,
      width: b,
      height: y,
      channels: 4,
      isFloat: !1,
      typeMax: 255,
      name: c,
      uri: f,
    };
  }
  function Au() {
    let c = r.settings.resourceUri || '',
      f = yo(c);
    switch (fe) {
      case 'TIFF':
        return xo(g.rawTiffData, f, c) || qe(f, c);
      case 'EXR':
        return wo(w.rawExrData, f, c) || qe(f, c);
      case 'PFM':
        return $e(M._lastRaw, { isFloat: !0, typeMax: 1 }, f, c) || qe(f, c);
      case 'PPM/PGM':
        return (
          $e(
            T._lastRaw,
            { isFloat: !1, typeMax: (T._lastRaw && T._lastRaw.maxval) || 255 },
            f,
            c
          ) || qe(f, c)
        );
      case 'PNG/JPEG':
        return (
          $e(
            _._lastRaw,
            { isFloat: !1, typeMax: (_._lastRaw && _._lastRaw.maxValue) || 255 },
            f,
            c
          ) || qe(f, c)
        );
      case 'NPY/NPZ':
        return $e(L._lastRaw, vo(L._lastRaw && L._lastRaw.dtype), f, c) || qe(f, c);
      case 'HDR':
        return $e(I._lastRaw, { isFloat: !0, typeMax: 1 }, f, c) || qe(f, c);
      case 'TGA':
        return $e(A._lastRaw, { isFloat: !1, typeMax: 255 }, f, c) || qe(f, c);
      case 'Web Image':
        return $e(N._lastRaw, { isFloat: !1, typeMax: 255 }, f, c) || qe(f, c);
      case 'JPEG XL':
        return $e(X._lastRaw, Yt(X), f, c) || qe(f, c);
      case 'FITS':
        return $e(z._lastRaw, Yt(z), f, c) || qe(f, c);
      case 'DICOM':
        return $e(j._lastRaw, Yt(j), f, c) || qe(f, c);
      case 'NetCDF':
        return $e(q._lastRaw, Yt(q), f, c) || qe(f, c);
      case 'CZI':
        return $e(oe._lastRaw, Yt(oe), f, c) || qe(f, c);
      case 'ND2':
        return $e(U._lastRaw, Yt(U), f, c) || qe(f, c);
      case 'LIF':
        return $e(Z._lastRaw, Yt(Z), f, c) || qe(f, c);
      case 'SDT':
        return $e(G._lastRaw, Yt(G), f, c) || qe(f, c);
      case 'Layered Document': {
        let b = ee._lastRaw,
          y = b ? { ...b, data: ee.activeData() } : null;
        return (
          $e(
            y,
            {
              isFloat: b?.sampleFormat === 3,
              typeMax: b?.sampleFormat === 3 ? 1 : b?.bitDepth === 16 ? 65535 : 255,
            },
            f,
            c
          ) || qe(f, c)
        );
      }
      default:
        return qe(f, c);
    }
  }
  async function _r(c, f) {
    let b = (f || c || '').toLowerCase(),
      y = yo(f || c),
      x = { postMessage() {}, setState() {}, getState: () => {} };
    try {
      let C = eo(b);
      if (C) {
        let S = new Bi(r, x);
        ((S._isInitialLoad = !1),
          (S.decodeEditableLayers = !1),
          (S.decodeWorker = _e),
          await S.process(c, C));
        let F = S._lastRaw;
        return $e(
          F,
          {
            isFloat: F?.sampleFormat === 3,
            typeMax: F?.sampleFormat === 3 ? 1 : F?.bitDepth === 16 ? 65535 : 255,
          },
          y,
          f
        );
      }
      if (Qs(b)) {
        await Ce('tiff');
        let S = new g.constructor(r, x);
        return (
          (S._isInitialLoad = !1),
          (S.decodeWorker = ve),
          await S.processTiff(c),
          xo(S.rawTiffData, y, f)
        );
      }
      if (b.endsWith('.exr')) {
        await Ce('exr');
        let S = new w.constructor(r, x);
        return (
          (S._isInitialLoad = !1),
          (S.decodeWorker = ve),
          await S.processExr(c),
          wo(S.rawExrData, y, f)
        );
      }
      if (b.endsWith('.pfm')) {
        await Ce('pfm');
        let S = new M.constructor(r, x);
        return (
          (S._isInitialLoad = !1),
          (S.decodeWorker = le),
          await S.processPfm(c),
          $e(S._lastRaw, { isFloat: !0, typeMax: 1 }, y, f)
        );
      }
      if (b.match(/\.(ppm|pgm|pbm)$/)) {
        await Ce('netpbm');
        let S = new T.constructor(r, x);
        return (
          (S._isInitialLoad = !1),
          (S.decodeWorker = le),
          await S.processPpm(c),
          $e(S._lastRaw, { isFloat: !1, typeMax: (S._lastRaw && S._lastRaw.maxval) || 255 }, y, f)
        );
      }
      if (b.match(/\.(png|jpg|jpeg)$/)) {
        let S = new wi(r, x);
        return (
          (S._isInitialLoad = !1),
          (S.decodeWorker = Ae),
          await S.processPng(c),
          $e(
            S._lastRaw,
            { isFloat: !1, typeMax: (S._lastRaw && S._lastRaw.maxValue) || 255 },
            y,
            f
          ) || Mo(c, y, f)
        );
      }
      if (b.match(/\.(npy|npz)$/)) {
        await Ce('npy');
        let S = new L.constructor(r, x);
        return (
          (S._isInitialLoad = !1),
          (S.decodeWorker = b.endsWith('.npy') ? le : ve),
          await S.processNpy(c),
          $e(S._lastRaw, vo(S._lastRaw && S._lastRaw.dtype), y, f)
        );
      }
      /\.(fits|fit|fts|dcm|dicom|nc|cdf|czi|nd2|lif|sdt)$/.test(b) && (await Ce('scientific'));
      let P = b.match(/\.(fits|fit|fts)$/)
        ? z.config
        : b.match(/\.(dcm|dicom)$/)
          ? j.config
          : b.match(/\.(nc|cdf)$/)
            ? q.config
            : b.match(/\.czi$/)
              ? oe.config
              : b.match(/\.nd2$/)
                ? U.config
                : b.match(/\.lif$/)
                  ? Z.config
                  : b.match(/\.sdt$/)
                    ? G.config
                    : null;
      if (P) {
        let S = new z.constructor(r, x, P);
        return (
          (S._isInitialLoad = !1),
          (S.decodeWorker = ve),
          await S.process(c),
          $e(S._lastRaw, Yt(S), y, f)
        );
      }
      return Mo(c, y, f);
    } catch (C) {
      return (console.error('Failed to decode layer', f, C), null);
    }
  }
  function Mo(c, f, b) {
    return new Promise(y => {
      let x = new Image();
      ((x.onload = () => {
        let C = document.createElement('canvas');
        ((C.width = x.naturalWidth), (C.height = x.naturalHeight));
        let R = C.getContext('2d');
        if (!R) {
          y(null);
          return;
        }
        R.drawImage(x, 0, 0);
        let P = R.getImageData(0, 0, C.width, C.height),
          S = new Float32Array(P.data.length);
        for (let F = 0; F < P.data.length; F++) S[F] = P.data[F];
        y({
          data: S,
          width: C.width,
          height: C.height,
          channels: 4,
          isFloat: !1,
          typeMax: 255,
          name: f,
          uri: b,
        });
      }),
        (x.onerror = () => y(null)),
        (x.src = c));
    });
  }
  function Du() {
    return (
      O.active ||
      Ie.isVisible() ||
      !!Bt ||
      r.settings.surfaceMode === 'layers' ||
      O.hasExtraLayers()
    );
  }
  function ta() {
    let c = ee._lastRaw,
      f = r.settings.resourceUri || '';
    if (!c?.layerAssets?.length) return !1;
    if (Wi === f && O.layers.length === c.layerAssets.length) return !0;
    let b = new Set(mn.map(R => R.id)),
      y = c.layerOrder === 'bottom-to-top' ? c.layerAssets : [...c.layerAssets].reverse(),
      x = y.map(R =>
        O.createLayer(
          {
            data: R.data,
            width: R.width,
            height: R.height,
            channels: R.channels ?? 4,
            isFloat: R.isFloat ?? !1,
            typeMax: R.typeMax ?? 255,
            sourceNumericType: R.sourceNumericType,
            name: R.name,
            kind: R.kind || 'raster',
            adjustment: R.adjustment,
            parentId: R.parentId,
            clipped: R.clipped,
            rasterMask: R.rasterMask
              ? {
                  data: R.rasterMask.data,
                  width: R.rasterMask.width,
                  height: R.rasterMask.height,
                  channels: R.rasterMask.channels,
                  typeMax: R.rasterMask.typeMax,
                  offsetX: R.rasterMask.x,
                  offsetY: R.rasterMask.y,
                }
              : void 0,
            groupPath: R.groupPath,
            groupIds: R.groupIds,
            sourceNodeId: R.nodeId,
            sourceSupport: R.support,
            sourceBlendMode: R.blendMode,
          },
          {
            offsetX: R.x,
            offsetY: R.y,
            opacity: R.opacity,
            visible: R.visible,
            blendMode: b.has(R.blendMode) ? R.blendMode : 'normal',
            adjustment: R.adjustment,
          }
        )
      );
    if (!x.length) return !1;
    let C = new Map();
    for (let R = 0; R < y.length; R++) {
      let P = y[R].nodeId,
        S = x[R].id;
      P && S && C.set(P, S);
    }
    for (let R of x) R.parentId && C.has(R.parentId) && (R.parentId = C.get(R.parentId));
    return (
      O.setLayers(x, c.document.width, c.document.height),
      (O.documentExpanded = !0),
      (Wi = f),
      (hr = f),
      (vn = void 0),
      Ie.refresh(),
      !0
    );
  }
  function zn() {
    let c = Au();
    if (c)
      if (hr !== c.uri || O.isEmpty())
        ((hr = c.uri), O.setBaseLayer(c), (vn = O.layers[0]?.id), Ie.isVisible() && Ie.refresh());
      else {
        let f = O.layers.find(b => b.id === vn) || O.layers.find(b => b.uri === c.uri);
        f &&
          ((vn = f.id),
          Object.assign(f, {
            data: c.data,
            width: c.width,
            height: c.height,
            channels: c.channels,
            isFloat: c.isFloat,
            typeMax: c.typeMax,
          }),
          (O.canvasWidth = c.width),
          (O.canvasHeight = c.height),
          O.invalidateComposite());
      }
  }
  function Ct(c = !1, f) {
    if (!O.active || !B) return !1;
    let b = f ?? ++Ue,
      y = bn.get(b) ?? performance.now(),
      x = O.canvasWidth,
      C = O.canvasHeight,
      R = Pc(x, C, c),
      P = c ? 'preview' : 'native',
      S = W => `${W.toFixed(1)}ms`,
      F = W =>
        W >= 1024 * 1024 ? `${(W / (1024 * 1024)).toFixed(1)}MiB` : `${(W / 1024).toFixed(1)}KiB`;
    if (xt === 'webgpu') {
      if (c) {
        let W = ue.pendingUpload(O.layers);
        if (W.count > 0)
          return (
            Zn.delete(b),
            yn === b && (yn = null),
            kn(
              `[LayerCompositor] webgpu preview skipped | pending-uploads=${W.count}/${F(W.bytes)} delay=${S(performance.now() - y)}; starting native immediately`
            ),
            Nu(b, 'cold upload'),
            Et(0, !1, b),
            !0
          );
      }
      return (
        ue
          .renderWithMetrics(O.layers, x, C, R, r.settings, Hn(), !0)
          .then(({ canvas: W, timing: K }) => {
            if (!W || b !== Ue || !O.active || !B) return;
            let J = tt();
            if (!J) return;
            let se = performance.now();
            ((J.canvas.width !== x || J.canvas.height !== C) &&
              ((J.canvas.width = x), (J.canvas.height = C)),
              J.save(),
              (J.globalCompositeOperation = 'copy'),
              (J.imageSmoothingEnabled = !0),
              J.drawImage(W, 0, 0, x, C),
              J.restore(),
              oa(b, c));
            let Re = performance.now();
            c
              ? (Dr(b, 'webgpu', W.width, W.height, K.renderMs), Nr(b, Re))
              : Fr(
                  b,
                  'webgpu',
                  W.width,
                  W.height,
                  K.renderMs,
                  `uploads=${K.uploadCount}, composition=${K.compositionCacheHit ? 'cached' : 'rendered'}`
                );
            let Te = !c && Ot.has(b) ? Re - Ot.get(b) : null;
            (kn(
              `[LayerCompositor] webgpu ${P} ${W.width}\xD7${W.height} at ${Math.round(R * 100)}% | delay=${S(K.requestedAt - y)} queue=${S(K.queueMs)} init=${S(K.initializationMs)} prepare=${S(K.prepareMs)} encode=${S(K.encodeMs)} gpu=${S(K.gpuMs)} validate=${S(K.validationMs)} copy=${S(Re - se)} render=${S(K.renderMs)} total=${S(Re - y)} uploads=${K.uploadCount}/${F(K.uploadBytes)}/${S(K.uploadCpuMs)} composition=${K.compositionCacheHit ? 'cached' : 'rendered'} surfaces=${K.surfaceCacheHit ? 'cached' : `new/${F(K.surfaceAllocationBytes)}`} ` +
                `${Te === null ? '' : `preview-visible=${S(Te)}`}`.trimEnd()
            ),
              c || (Br(b), bn.delete(b), Ot.delete(b)));
          })
          .catch(W => {
            b === Ue &&
              (na('WebGPU', W, b),
              setTimeout(() => {
                throw W;
              }, 0));
          }),
        !0
      );
    }
    if (xt === 'gpu') {
      let W = performance.now(),
        K;
      try {
        K = ce.render(O.layers, x, C, R, r.settings, Hn(), !0);
      } catch (Lt) {
        throw (na('GPU', Lt, b), Lt);
      }
      let J = tt();
      if (!J) return !1;
      let se = performance.now(),
        Re = performance.now();
      ((J.canvas.width !== x || J.canvas.height !== C) &&
        ((J.canvas.width = x), (J.canvas.height = C)),
        J.save(),
        (J.globalCompositeOperation = 'copy'),
        (J.imageSmoothingEnabled = !0),
        J.drawImage(K, 0, 0, x, C),
        J.restore(),
        oa(b, c));
      let Te = performance.now(),
        we = se - W;
      c
        ? (Dr(b, 'webgl2', K.width, K.height, we), Nr(b, Te))
        : Fr(b, 'webgl2', K.width, K.height, we);
      let ze = !c && Ot.has(b) ? Te - Ot.get(b) : null;
      return (
        kn(
          `[LayerCompositor] webgl2 ${P} ${K.width}\xD7${K.height} at ${Math.round(R * 100)}% | delay=${S(W - y)} queue=0.0ms render=${S(se - W)} copy=${S(Te - Re)} total=${S(Te - y)} ` +
            `${ze === null ? '' : `preview-visible=${S(ze)}`}`.trimEnd()
        ),
        c || (Br(b), bn.delete(b), Ot.delete(b)),
        !0
      );
    }
    let H = xt === 'wasm' ? 'wasm' : 'javascript',
      D = de.compose(O.layers, x, C, R, H);
    if (D)
      return (
        D.then(async W => {
          if (!W || b !== Ue || !O.active || !B) return;
          let K = O.renderCompositeToImageData(W, r.settings, { nanColor: Hn(), cache: R === 1 }),
            J = tt();
          if (J) {
            if (R < 1) {
              (J.canvas.width !== x || J.canvas.height !== C) &&
                ((J.canvas.width = x), (J.canvas.height = C));
              try {
                let se = await createImageBitmap(K);
                (b === Ue &&
                  O.active &&
                  (J.save(),
                  (J.globalCompositeOperation = 'copy'),
                  (J.imageSmoothingEnabled = !0),
                  J.drawImage(se, 0, 0, x, C),
                  J.restore()),
                  se.close());
              } catch {
                let se = document.createElement('canvas');
                ((se.width = K.width),
                  (se.height = K.height),
                  se.getContext('2d')?.putImageData(K, 0, 0),
                  b === Ue &&
                    O.active &&
                    (J.save(),
                    (J.globalCompositeOperation = 'copy'),
                    J.drawImage(se, 0, 0, x, C),
                    J.restore()));
              }
            } else (await Fe(K, J, () => b === Ue && O.active), b === Ue && O.active && (Y = K));
            if ((oa(b, c), c && b === Ue && O.active)) {
              let se = W.compositorTiming;
              (Dr(b, se?.backend || H, W.width, W.height, se?.durationMs || 0),
                Nr(b, performance.now()));
            } else if (!c && b === Ue && O.active) {
              let se = W.compositorTiming;
              (Fr(b, se?.backend || H, W.width, W.height, se?.durationMs || 0), Br(b));
            }
          }
        }).catch(W => {
          b === Ue &&
            (na(xt === 'wasm' ? 'Rust/Wasm' : 'JavaScript', W, b),
            setTimeout(() => {
              throw W;
            }, 0));
        }),
        !0
      );
    let $ = new Error(`${H} compositor worker is unavailable`);
    throw (na(H === 'wasm' ? 'Rust/Wasm' : 'JavaScript', $, b), $);
  }
  function na(c, f, b) {
    if (b !== Ue) return;
    pt && (clearTimeout(pt), (pt = null));
    let y = f instanceof Error ? f.message : String(f),
      x = `[LayerCompositor] Strict ${c} render failed: ${y}`;
    (kn(x), p.postMessage({ type: 'show-error', message: x }));
  }
  let Pr = !1,
    ia = !1,
    Ir = 0,
    pt = null;
  function Ar(c, f) {
    let b;
    if ((f && Qn !== null && (b = Gi.get(Qn)), !b)) {
      let y = ou++;
      ((b = {
        id: y,
        latestRevision: c,
        backend: xt,
        settled: !f,
        emitted: !1,
        previewCount: 0,
        previewWidth: 0,
        previewHeight: 0,
        previewLastMs: 0,
        previewMaxMs: 0,
        nativeWidth: 0,
        nativeHeight: 0,
        nativeMs: 0,
        nativeRevision: -1,
      }),
        Gi.set(y, b),
        f && (Qn = y));
    }
    return ((b.latestRevision = c), (b.backend = xt), ei.set(c, b.id), b);
  }
  function li(c, f) {
    let b = ei.get(c);
    return (b !== void 0 ? Gi.get(b) : void 0) || Ar(c, f);
  }
  function Fu(c) {
    let f = li(c, !0);
    ((f.settled = !0), Qn === f.id && (Qn = null), Co(f));
  }
  function Dr(c, f, b, y, x) {
    let C = li(c, !0);
    ((C.backend = f),
      C.previewCount++,
      (C.previewWidth = b),
      (C.previewHeight = y),
      (C.previewLastMs = x),
      (C.previewMaxMs = Math.max(C.previewMaxMs, x)));
  }
  function Nu(c, f) {
    li(c, !0).previewSkipped = f;
  }
  function Fr(c, f, b, y, x, C) {
    let R = li(c, !1);
    c === R.latestRevision &&
      ((R.backend = f),
      (R.nativeWidth = b),
      (R.nativeHeight = y),
      (R.nativeMs = x),
      (R.nativeRevision = c),
      (R.nativeNote = C),
      Co(R));
  }
  function Co(c) {
    if (c.emitted || !c.settled || c.nativeWidth <= 0 || c.nativeRevision !== c.latestRevision)
      return;
    c.emitted = !0;
    let f =
      c.previewCount > 0
        ? `${c.previewCount}\xD7 ${c.previewWidth}\xD7${c.previewHeight}, last ${c.previewLastMs.toFixed(1)}ms` +
          (c.previewCount > 1 ? `, max ${c.previewMaxMs.toFixed(1)}ms` : '')
        : `skipped${c.previewSkipped ? ` (${c.previewSkipped})` : ''}`;
    ct(
      `[LayerCompositor] ${c.backend} change | preview=${f} | native=${c.nativeWidth}\xD7${c.nativeHeight} ${c.nativeMs.toFixed(1)}ms${c.nativeNote ? ` | ${c.nativeNote}` : ''}`
    );
    for (let [b, y] of ei) y === c.id && ei.delete(b);
    Gi.delete(c.id);
  }
  function Nr(c, f) {
    (Zn.delete(c), Ot.set(c, f), yn === c && ((yn = null), Et(0, !1, c)));
  }
  function Bu(c) {
    if ((pt && (clearTimeout(pt), (pt = null)), ji.has(c) || ur.has(c))) {
      yn = null;
      return;
    }
    if (Zn.has(c) && !Ot.has(c)) {
      yn = c;
      return;
    }
    ((yn = null), Et(0, !1, c));
  }
  function aa(c, f) {
    if ((ei.has(c) || Ar(c, !1), !Ka(O.canvasWidth, O.canvasHeight))) {
      ((li(c, !1).previewSkipped = 'document \u22641500px'), Et(0, !1, c));
      return;
    }
    (Et(0, !0, c), Et(f, !1, c));
  }
  function Br(c) {
    (ji.delete(c), ur.add(c));
  }
  function Et(c = 0, f = !1, b = Ue) {
    if (!bn.has(b)) {
      bn.set(b, performance.now());
      for (let y of bn.keys())
        y < b - 2 && (bn.delete(y), Ot.delete(y), Zn.delete(y), ji.delete(y), ur.delete(y));
    }
    if (c > 0) {
      (pt && clearTimeout(pt),
        (pt = setTimeout(() => {
          ((pt = null), Et(0, f, b));
        }, c)));
      return;
    }
    if ((f ? Zn.add(b) : ji.add(b), pt && !f && (clearTimeout(pt), (pt = null)), Pr)) {
      (f || (ia = !1), (Ir = b));
      return;
    }
    ((Pr = !0),
      (ia = f),
      (Ir = b),
      requestAnimationFrame(() => {
        Pr = !1;
        let y = ia,
          x = Ir;
        ((ia = !1), Ct(y, x));
      }));
  }
  let $r = !1,
    ci = !1;
  function ko() {
    if ($r || !Bt) return;
    let c = Bt.layers || [];
    if (
      c.some(R => !!R.sourceNodeId) &&
      ee.hasDeferredLayersPending() &&
      !ee._lastRaw?.layerAssets?.length
    )
      return;
    $r = !0;
    let b = c.find(R => R.isBase),
      y = r.settings.resourceUri,
      x = Bt.documentUri || b?.resourceUri;
    if (x && y && x !== y) {
      Bt = null;
      return;
    }
    let C = c.filter(R => !R.isBase && R.resourceUri);
    C.length === 0
      ? So({})
      : p.postMessage({ type: 'resolveLayerUris', resourceUris: C.map(R => R.resourceUri) });
  }
  async function So(c) {
    let f = Bt;
    if (((Bt = null), !f)) return;
    f.layers.some(S => !!S.sourceNodeId) && !!ee._lastRaw?.layerAssets?.length ? ta() : zn();
    let y =
        O.layers.find(S => S.id === vn) ||
        O.layers.find(S => S.uri === r.settings.resourceUri) ||
        O.layers[0],
      x = new Map();
    for (let S of O.layers) {
      if (!S.sourceNodeId) continue;
      let F = x.get(S.sourceNodeId) || [];
      (F.push(S), x.set(S.sourceNodeId, F));
    }
    let C = [],
      R = new Map(),
      P = (S, F) => (
        Object.assign(S, {
          name: F.name ?? S.name,
          offsetX: F.offsetX ?? S.offsetX ?? 0,
          offsetY: F.offsetY ?? S.offsetY ?? 0,
          opacity: F.opacity ?? S.opacity ?? 1,
          blendMode: F.blendMode ?? S.blendMode ?? 'normal',
          visible: F.visible !== !1,
          maskCondition: F.maskCondition,
          kind: F.kind ?? S.kind,
          adjustment: F.adjustment ?? S.adjustment,
          parentId: F.parentId,
          clipped: F.clipped,
          groupPath: F.groupPath ?? S.groupPath,
          groupIds: F.groupIds ?? S.groupIds,
          sourceNodeId: F.sourceNodeId ?? S.sourceNodeId,
          sourceSupport: F.sourceSupport ?? S.sourceSupport,
          sourceBlendMode: F.sourceBlendMode ?? S.sourceBlendMode,
          sourceNumericType: F.sourceNumericType ?? S.sourceNumericType,
        }),
        F.id && S.id && R.set(F.id, S.id),
        S
      );
    for (let S of f.layers)
      if (S.sourceNodeId) {
        let H = x.get(S.sourceNodeId)?.shift();
        if (H) C.push(P(H, S));
        else {
          let D = O.layers.find($ => $.sourceNodeId === S.sourceNodeId);
          D &&
            C.push(
              P(
                O.createLayer(
                  {
                    ...D,
                    isFloat: D.isFloat ?? !1,
                    typeMax: D.typeMax ?? 255,
                    channels: D.channels ?? 4,
                  },
                  S
                ),
                S
              )
            );
        }
      } else if (S.isBase) y && (C.push(P(y, S)), (vn = y.id));
      else {
        if (S.kind === 'adjustment' && S.adjustment) {
          let D = O.createLayer(
            {
              width: 1,
              height: 1,
              channels: 4,
              isFloat: !1,
              typeMax: y?.typeMax || 255,
              name: S.name || 'Adjustment',
              kind: 'adjustment',
              adjustment: S.adjustment,
              parentId: S.parentId,
              clipped: S.clipped,
              groupPath: S.groupPath,
              groupIds: S.groupIds,
            },
            S
          );
          C.push(P(D, S));
          continue;
        }
        let F = c[S.resourceUri];
        if (!F) continue;
        let H = await _r(F, S.resourceUri);
        H && C.push(P(O.createLayer(H, S), S));
      }
    for (let S of C) S.parentId && R.has(S.parentId) && (S.parentId = R.get(S.parentId));
    if (C.length === 0)
      if (y) C.push(y);
      else return;
    (O.setLayers(C, O.canvasWidth, O.canvasHeight),
      (Ie.collapsed = !!f.collapsed),
      f.active || r.settings.surfaceMode === 'layers'
        ? (r.settings.surfaceMode === 'layers' && (ci = !0), Ie.show())
        : Ie.refresh());
  }
  let qt = null;
  function $u() {
    (ge.addEventListener(
      'mousedown',
      c => {
        if (!O.active || !Ie.movingLayerId || !te) return;
        let f = c.target;
        (Ie.root && f && Ie.root.contains(f)) ||
          !(f === te || f === B || (f && te.contains && te.contains(f))) ||
          ((qt = { id: Ie.movingLayerId, lastX: c.clientX, lastY: c.clientY }),
          O.beginHistoryGroup(),
          c.preventDefault(),
          c.stopPropagation());
      },
      !0
    ),
      window.addEventListener('mousemove', c => {
        if (!qt || !B || !te) return;
        let f = te.getBoundingClientRect();
        if (f.width <= 0 || f.height <= 0) return;
        let b = Math.round(((c.clientX - qt.lastX) / f.width) * B.width),
          y = Math.round(((c.clientY - qt.lastY) / f.height) * B.height);
        (b !== 0 || y !== 0) &&
          (O.moveLayer(qt.id, b, y), (qt.lastX = c.clientX), (qt.lastY = c.clientY), Et());
      }),
      window.addEventListener('mouseup', () => {
        qt && ((qt = null), O.endHistoryGroup(), Ie.refresh(), ot());
      }));
  }
  function Ro() {
    if (!B || te === B) return;
    let c = te;
    (c &&
      ((B.className = c.className),
      (B.style.cssText = c.style.cssText),
      c.parentElement && c.replaceWith(B)),
      (te = B),
      k.setCanvas(B),
      k.setImageElement(te),
      E.setImageElement(te),
      E.addMouseListeners(te));
  }
  function ra() {
    if (Ye) {
      if (He.show) {
        let c = Ye.querySelector('.image-counter');
        c &&
          ((c.textContent = `${He.currentIndex + 1} of ${He.totalImages}`),
          c.removeAttribute('aria-label'));
      }
      Ye.classList.remove('image-collection-overlay--loading');
    }
    (Ge && Ge.classList.remove('filename-badge--loading'), (oi = !1), (Ji = !1), ca(!1), Ke(!1));
  }
  function Uu() {
    for (let c of Array.from(ge.children))
      if (
        c instanceof HTMLElement &&
        !ni(c) &&
        (c.tagName === 'IMG' || c.tagName === 'CANVAS' || c.classList.contains('pyramid-scene'))
      )
        return c;
    return null;
  }
  function Eo(c = !1) {
    ((wn = Uu()),
      (an = wn !== null),
      (oi = c),
      an
        ? (ge.classList.remove('loading', 'error'),
          ge.classList.add('ready', 'image-transition-pending'),
          ge.setAttribute('aria-busy', 'true'))
        : ge.classList.add('loading'));
  }
  function Ur() {
    ((wn = null),
      (an = !1),
      ge.classList.remove('image-transition-pending'),
      ge.removeAttribute('aria-busy'));
  }
  function Hr() {
    if (!Ye || !He.show || !oi) return;
    let c = Ye.querySelector('.image-counter');
    if (c && !Cn) {
      let f = `${He.currentIndex + 1} of ${He.totalImages}`;
      ((c.textContent = f), c.setAttribute('aria-label', `Loading image ${f}`));
    }
    Ye.classList.add('image-collection-overlay--loading');
  }
  function Lo(c) {
    He.totalImages <= 1 ||
      ((oi = !0),
      Hr(),
      Ge && Ge.classList.add('filename-badge--loading'),
      p.postMessage({ type: c === 'next' ? 'toggleImage' : 'toggleImageReverse' }));
  }
  function Hu() {
    (window.addEventListener('message', async c => {
      if (c.origin !== window.origin) {
        console.error('Dropping message from unknown origin in image preview');
        return;
      }
      await jn(c.data);
    }),
      $u(),
      p.postMessage({ type: 'get-initial-data' }));
  }
  async function jn(c) {
    switch (c.type) {
      case 'clearImage': {
        (s.message(c),
          ie++,
          wt?.abort(),
          Cr(),
          Dt(),
          Sn !== null && (clearTimeout(Sn), (Sn = null)));
        for (let D of [ve, Ae, _e, le]) D.cancelActiveDecodes();
        for (let D of ye) D._pendingRenderData = null;
        (Ee?.dispose(),
          (Ee = null),
          Kt(),
          (et = null),
          (Me = !1),
          (k.hasLoadedImage = !1),
          (k.imageElement = null),
          (k.canvas = null),
          (k.scale = 'fit'),
          (E.imageElement = null),
          E.setStoredValueResolver(null),
          (B = null),
          (te = null),
          (Y = null),
          (st = null),
          (Vi = !1),
          (vr = null),
          (xr = null));
        for (let D of Array.from(ge.children))
          D instanceof HTMLElement &&
            !ni(D) &&
            (D.tagName === 'IMG' ||
              D.tagName === 'CANVAS' ||
              D.classList.contains('pyramid-scene')) &&
            D.remove();
        (Ur(),
          zi(),
          hi(),
          ge.classList.remove('ready', 'loading', 'error', 'web-image-zoomed'),
          window.scrollTo(0, 0));
        break;
      }
      case 'setScale':
        k.updateScale(c.scale);
        break;
      case 'addLayerImages': {
        let D = c.images || [],
          $ = `${D.length} image${D.length === 1 ? '' : 's'}`;
        (ne.begin(`add-layer ${$}`, { conciseLabel: `Layer add (${$}) completed` }),
          zn(),
          ne.mark('layers-base-sync'));
        let W = O.active;
        (Ie.show({ notify: !1 }),
          W ||
            ((O.active = !0),
            p.postMessage({ type: 'layerModeChanged', active: !0 }),
            Ft === 'auto' && Qi(!0)),
          ne.mark('layers-panel-show'));
        let K = 0;
        for (let J of D) {
          let se = await _r(J.src, J.resourceUri);
          (ne.mark('layer-decode'), se && (O.addLayer(se), K++));
        }
        (K > 0
          ? (Ie.refresh(),
            ne.mark('layers-panel-refresh'),
            Ct(),
            ne.mark('layers-recomposite-submit'),
            ot(),
            ne.mark('layers-state-save-scheduled'))
          : (p.postMessage({
              type: 'show-error',
              message: 'Could not load the selected image(s) as layers.',
            }),
            ne.mark('layers-add-failed')),
          ne.end());
        break;
      }
      case 'layerUrisResolved':
        So(c.map || {});
        break;
      case 'setActive':
        E.setActive(c.value);
        break;
      case 'zoomIn':
        k.zoomIn();
        break;
      case 'zoomOut':
        k.zoomOut();
        break;
      case 'resetZoom':
        k.resetZoom();
        break;
      case 'getLayerExportCompatibility':
        let f = O.hasCompositeStack() ? await n() : null;
        p.postMessage({
          type: 'didGetLayerExportCompatibility',
          options: O.hasCompositeStack()
            ? f.analyzeLayerExports(O.layers)
            : [
                {
                  format: 'png',
                  label: 'PNG',
                  description: '\u2713 Rendered image',
                  detail: 'Exports exactly the current rendered image.',
                  compatible: !0,
                },
              ],
        });
        break;
      case 'exportLayerDocument':
        wd(c.format);
        break;
      case 'start-comparison':
        ts(c.peerUri);
        break;
      case 'copyImage':
        es();
        break;
      case 'showContextMenu':
        document.dispatchEvent(
          new MouseEvent('contextmenu', {
            bubbles: !0,
            cancelable: !0,
            clientX: Number(c.x || 8),
            clientY: Number(c.y || 8),
          })
        );
        break;
      case 'pastePosition':
        Md(c.state);
        break;
      case 'updateSettings':
        let b = performance.now(),
          y = r.settings.resourceUri,
          x = performance.now(),
          C = r.updateSettings(c.settings);
        s.message({ type: 'updateSettings', settings: r.settings });
        let R = performance.now() - x,
          P = r.settings.resourceUri;
        (typeof c.settings?.showScaleBar == 'boolean' &&
          mt.setShowScaleBar(c.settings.showScaleBar),
          ge.toggleAttribute('data-no-value-transparent', el(r.settings)));
        let S = c.reason || (c.isInitialRender ? 'initial-render' : 'unspecified');
        if (
          (C.changedKeys.includes('gpuAcceleration') && Ft === 'auto' && (Er(), await Qi(!1, !0)),
          c.isInitialRender && fe === 'TIFF' && !B)
        ) {
          let D = ie,
            $ = performance.now();
          if (
            (await ao,
            ne.detail('await-settings-tiff-canvas-wait', performance.now() - $),
            D !== ie)
          )
            break;
        }
        if (c.isInitialRender && B) {
          let D = ie;
          (m && m.generation === ie && ne.detail('await-settings-roundtrip', b - m.time),
            ne.detail('settings-apply', R),
            ne.mark('await-settings'));
          let $ = null,
            W = !1,
            K = re.find(J => !!J._pendingRenderData);
          if (
            (g._pendingRenderData
              ? (($ = await g.performDeferredRender({
                  collectHistogram: V.getVisibility(),
                  targetCanvas: B,
                  placeholderImageData: Y,
                })),
                (W = g._lastRenderUsedWebGL === !0 || g.isProgressiveRemoteBase))
              : ee._pendingRenderData
                ? ($ = ee.performDeferredRender({
                    collectHistogram: V.getVisibility(),
                    targetCanvas: B,
                    placeholderImageData: Y,
                  }))
                : L._pendingRenderData
                  ? (($ = L.performDeferredRender({
                      collectHistogram: V.getVisibility(),
                      targetCanvas: B,
                      placeholderImageData: Y,
                    })),
                    (W = L._lastRenderUsedWebGL === !0))
                  : _._pendingRenderData
                    ? (($ = _.performDeferredRender({
                        collectHistogram: V.getVisibility(),
                        targetCanvas: B,
                        placeholderImageData: Y,
                      })),
                      (W =
                        _._lastRenderReusedOriginalImageData === !0 ||
                        _._lastRenderUsedWebGL === !0))
                    : T._pendingRenderData
                      ? (($ = T.performDeferredRender({
                          collectHistogram: V.getVisibility(),
                          targetCanvas: B,
                          placeholderImageData: Y,
                        })),
                        (W = T._lastRenderUsedWebGL === !0))
                      : M._pendingRenderData
                        ? (($ = M.performDeferredRender({
                            collectHistogram: V.getVisibility(),
                            targetCanvas: B,
                            placeholderImageData: Y,
                          })),
                          (W = M._lastRenderUsedWebGL === !0))
                        : K
                          ? (($ = K.performDeferredRender({
                              collectHistogram: V.getVisibility(),
                              targetCanvas: B,
                              placeholderImageData: Y,
                            })),
                            (W = K._lastRenderUsedWebGL === !0))
                          : w._pendingRenderData
                            ? (($ = w.updateSettings(r.settings, {
                                collectHistogram: V.getVisibility(),
                                targetCanvas: B,
                                placeholderImageData: Y,
                              })),
                              (W = w._lastRenderUsedWebGL === !0))
                            : I._pendingRenderData
                              ? (($ = I.performDeferredRender({
                                  collectHistogram: V.getVisibility(),
                                  targetCanvas: B,
                                  placeholderImageData: Y,
                                })),
                                (W = I._lastRenderUsedWebGL === !0))
                              : A._pendingRenderData
                                ? ($ = A.performDeferredRender())
                                : N._pendingRenderData && ($ = N.performDeferredRender()),
            D !== ie)
          )
            break;
          if ($) {
            if (W) (ne.mark('canvas-upload-skipped'), (Y = $));
            else {
              let J = tt();
              J && (await Fe($, J), (Y = $));
            }
            if (
              (fe === 'TIFF' && (jo(), Go()), at(), fe === 'TIFF' && (Ke(), fi()), ra(), Ve > 0)
            ) {
              let se = (performance.now() - Ve).toFixed(2),
                Re = De ? Date.now() - De : se;
              (Rt(`${fe}`, se, Re), (Ve = 0));
            }
          } else if (
            _.hasLazyNativeReadback() &&
            (_.canUseLazyNativeCanvasForSettings(r.settings) || (await sn(C)), at(), ra(), Ve > 0)
          ) {
            let se = (performance.now() - Ve).toFixed(2),
              Re = De ? Date.now() - De : se;
            (Rt(`${fe}`, se, Re), (Ve = 0));
          }
        } else if (y !== P && Me) (cl(), fo());
        else {
          let D =
            g._pendingRenderData ||
            ee._pendingRenderData ||
            (L && L._pendingRenderData) ||
            (_ && _._pendingRenderData) ||
            (T && T._pendingRenderData) ||
            (M && M._pendingRenderData) ||
            (w && w._pendingRenderData) ||
            (I && I._pendingRenderData) ||
            (A && A._pendingRenderData) ||
            (N && N._pendingRenderData) ||
            re.some($ => !!$._pendingRenderData);
          if (Me && !D && C.changed) {
            let $ = performance.now();
            await sn(C);
            let W = performance.now();
            ct(
              `[Perf] Settings re-render (${S}; ${C.changedKeys.join(', ')}) took ${(W - $).toFixed(2)}ms`
            );
          } else Me && !D && !C.changed && ct(`[Perf] Skipped no-op settings update (${S})`);
        }
        break;
      case 'updateLoadStartTime':
        De = c.timestamp;
        break;
      case 'updateImageCollectionOverlay':
        Vo(c.data);
        break;
      case 'setDataset':
        ((Mt = c.manifest || null),
          (rn = Number(c.seriesIndex || 0)),
          (Ut = { ...(c.coordinates || {}) }),
          (He = { totalImages: 1, currentIndex: 0, show: !1 }),
          Vo(He),
          ca(!1));
        {
          let D = Mt?.series[rn],
            $ = D?.planes.find(J =>
              D.axes.every(se => (J.coordinates[se.key] || 0) === (Ut[se.key] || 0))
            ),
            W = r.settings.resourceUri;
          (!!$ &&
            $.resourceUri === W &&
            ($.format === 'dicom'
              ? Number($.frameIndex || 0) === Number(j.metadata.frameIndex || 0) && !!j._lastRaw
              : Number($.pageIndex || 0) === g.pageIndex && !!g.rawTiffData)) ||
            Gr(rn, Ut);
        }
        break;
      case 'getZoomState':
        let F = k.getCurrentState();
        p.postMessage({ type: 'zoomStateResponse', state: F });
        break;
      case 'getComparisonState':
        let H = { peerUris: Nt, isShowingPeer: xn };
        p.postMessage({ type: 'comparisonStateResponse', state: H });
        break;
      case 'restoreZoomState':
        c.state && k.restoreState(c.state);
        break;
      case 'restoreComparisonState':
        if (c.state && c.state.peerUris && c.state.peerUris.length > 0) {
          ((Nt = c.state.peerUris), (xn = c.state.isShowingPeer));
          for (let D of Nt) ts(D);
        }
        break;
      case 'switchToImage':
        if (
          ((Vi = !!c.zoomState),
          Number.isFinite(Number(c.loadStartTime)) && (De = Number(c.loadStartTime)),
          c.collection && (He = c.collection),
          c.zoomState?.scale === 'fit')
        )
          st = { scale: 'fit', x: 0, y: 0 };
        else if (st === null) {
          let D = k.getCurrentState();
          if (D.scale !== 'fit' && D.x === 0 && D.y === 0) {
            let $ = p.getState();
            $ && $.scale === D.scale && ((D.x = $.offsetX || 0), (D.y = $.offsetY || 0));
          }
          st = c.zoomState || D;
        }
        pi(c.uri, c.resourceUri, { formatHint: c.formatHint });
        break;
      case 'switchToDatasetPlane':
        ((rn = Number(c.seriesIndex || 0)),
          (Ut = { ...(c.coordinates || {}) }),
          (Ji = !0),
          ca(!0),
          pi(c.uri, c.resourceUri, {
            formatHint: c.formatHint,
            pageIndex: c.pageIndex,
            frameIndex: c.frameIndex,
          }));
        break;
      case 'toggleHistogram':
        (V.toggle(),
          Ne(),
          p.postMessage({ type: 'histogramVisibilityChanged', isVisible: V.getVisibility() }));
        break;
      case 'toggleMetadata':
        (he.toggle(), sa());
        break;
      case 'toggleScaleBar': {
        (typeof c.shown == 'boolean'
          ? (mt.setShowScaleBar(c.shown), c.shown)
          : mt.toggleScaleBar()) &&
          At.origin === 'none' &&
          p.postMessage({
            type: 'showMessage',
            level: 'info',
            message:
              'This image carries no physical pixel size, so no scale bar can be drawn. Set the scale in the Measure panel.',
          });
        break;
      }
      case 'toggleChannels':
        (Ks() || console.log('[Channels] This image has a single channel.'), Wt.toggle());
        break;
      case 'toggleMeasure':
        (Oe.toggle(),
          p.postMessage({ type: 'measureVisibilityChanged', isVisible: Oe.isVisible() }));
        break;
      case 'measureHint':
        Oe.setHint(String(c.text || ''));
        break;
      case 'measureImportResult': {
        let D = new Uint8Array(c.bytes || []);
        if (c.kind === 'imagej') {
          let $ = (await i()).importImageJRois(D, c.fileName || 'RoiSet');
          if ($.length === 0) Oe.setHint('No ROIs could be read from that file.');
          else {
            en.addMany(
              $.map(K => K.roi),
              { select: !1 }
            );
            let W = $.flatMap(K => K.notes);
            Oe.setHint(
              W.length > 0
                ? `Imported ${$.length} ROIs. ${W[0]}`
                : `Imported ${$.length} ROIs from ImageJ.`
            );
          }
        } else {
          if (c.automatic && en.count() > 0) {
            Oe.setHint(
              'This image has a saved ROI file. Load it from the ROIs tab to replace what is on screen.'
            );
            break;
          }
          let $ = Hl(new TextDecoder().decode(D));
          ($.rois.length > 0 && en.replaceAll($.rois),
            $.calibration && (At = { ...$.calibration, origin: 'imported' }),
            Oe.applyLoadedDerivedColumns($.derivedColumns, $.columns),
            Oe.setHint(
              $.warnings.length > 0
                ? $.warnings[0]
                : `Loaded ${$.rois.length} ROIs${c.automatic ? ' saved next to this image' : ''}.`
            ));
        }
        Oe.refresh();
        break;
      }
      case 'restoreHistogramState':
        (c.isVisible && !V.getVisibility()
          ? (V.show(!0), Ne())
          : !c.isVisible && V.getVisibility() && V.hide(!0),
          c.position && V.setPosition(c.position.left, c.position.top),
          c.scaleMode && V.setScaleMode(c.scaleMode));
        break;
      case 'requestHistogram':
        Ne();
        break;
      case 'convertColormapToFloat':
        await Io(c.colormap, c.min, c.max, c.inverted || !1, c.logarithmic || !1);
        break;
      case 'revertToOriginal':
        ju();
        break;
      case 'setDisplayColormap':
        await To(c.colormap || 'none');
        break;
      case 'toggleDebayer':
        if ((ke.toggle(), ke.isVisible() && !r.settings.debayer?.enabled)) {
          let D = r.settings.debayer ?? Ma;
          (ke.setSettings({ enabled: !0 }), await zr({ ...D, enabled: !0 }));
        }
        break;
    }
  }
  async function zr(c) {
    if (
      ((r.settings.debayer = c),
      Xt(),
      await sn({ changed: !0, changedKeys: ['debayer'], parametersOnly: !0, changedStructure: !1 }),
      c.autoWb)
    ) {
      let f = ol();
      f && ke.reportGains(f);
    }
  }
  async function To(c) {
    ((r.settings.displayColormap = c),
      Xt(),
      await sn({
        changed: !0,
        changedKeys: ['displayColormap'],
        parametersOnly: !0,
        changedStructure: !1,
      }));
  }
  function zu() {
    let c,
      f,
      b = [],
      y = null,
      x = 0,
      C = 0,
      R = 1;
    if (g.rawTiffData) {
      let S = g.rawTiffData.ifd;
      ((x = S.width), (C = S.height), (R = S.t277 || 1));
      let F = S.t258 || 8,
        H = S.t339,
        D = H === 3 ? 'IEEE float' : H === 2 ? 'signed int' : 'unsigned int';
      ((c = 'TIFF'),
        (f = {
          Dimensions: `${x} x ${C}`,
          Channels: String(R),
          'Bits/Sample': String(F),
          'Sample Format': D,
        }));
      let $ = g.omeMetadata;
      if ($) {
        let W = xi($, g.pageIndex);
        if (
          ((f['OME Dimensions'] = `C ${$.planeSizeC} \xD7 Z ${$.sizeZ} \xD7 T ${$.sizeT}`),
          (f['Current Plane'] = `C ${W.c + 1}, Z ${W.z + 1}, T ${W.t + 1} (IFD ${g.pageIndex})`),
          (f['Dimension Order'] = $.dimensionOrder),
          $.imageName && (f['Image Name'] = $.imageName),
          $.pixelType && (f['OME Pixel Type'] = $.pixelType),
          $.channels.length && (f['OME Channels'] = $.channels.map(K => K.name).join(', ')),
          $.physicalSizeX !== void 0 &&
            (f['Physical Size X'] = `${$.physicalSizeX} ${$.physicalSizeXUnit || ''}`.trim()),
          $.physicalSizeY !== void 0 &&
            (f['Physical Size Y'] = `${$.physicalSizeY} ${$.physicalSizeYUnit || ''}`.trim()),
          $.physicalSizeZ !== void 0 &&
            (f['Physical Size Z'] = `${$.physicalSizeZ} ${$.physicalSizeZUnit || ''}`.trim()),
          $.timeIncrement !== void 0 &&
            (f['Time Increment'] = `${$.timeIncrement} ${$.timeIncrementUnit || ''}`.trim()),
          $.objective)
        ) {
          let K = $.objective;
          ((f.Objective = [K.manufacturer, K.model].filter(Boolean).join(' ') || K.id || 'n/a'),
            K.nominalMagnification !== void 0 &&
              (f.Magnification = `${K.nominalMagnification}\xD7`),
            K.lensNA !== void 0 && (f['Objective NA'] = String(K.lensNA)),
            K.immersion && (f.Immersion = K.immersion));
        }
      }
      ((b = g._lastAllTags || []), (y = g.rawTiffData.data));
    } else if (w.rawExrData) {
      let S = w.rawExrData;
      ((x = S.width),
        (C = S.height),
        (R = S.channels || 1),
        (c = 'EXR'),
        (f = {
          Dimensions: `${x} x ${C}`,
          Channels: String(R),
          'Channel Names': (S.channelNames || []).join(', ') || 'n/a',
          Precision: S.type === 1016 ? 'half (float16)' : 'float32',
        }),
        (b = w._lastAllTags || []),
        (y = S.data));
    } else if (ee._lastRaw) {
      let S = ee._lastRaw,
        F = S.document;
      ((x = S.width),
        (C = S.height),
        (R = S.channels),
        (c = S.formatLabel),
        (f = {
          Dimensions: `${x} x ${C}`,
          Channels: String(R),
          'Bit Depth': String(S.bitDepth),
          Layers: String(F.layerCount),
          Preview: `${F.previewKind} (${ee.previewMode})`,
          'Preview Fidelity': F.previewIsAuthoritative
            ? 'authoritative embedded preview'
            : 'reconstructed or heuristic',
        }),
        F.warnings.length && (f['Compatibility Notes'] = F.warnings.join(' \xB7 ')));
      for (let [H, D] of Object.entries(ee.metadata))
        f[H.replace(/([a-z])([A-Z])/g, '$1 $2')] = String(D);
      (F.reconstruction?.available &&
        (f['Reconstruction Difference'] =
          F.reconstruction.differentPixelRatio === void 0
            ? 'available; integrated preview dimensions differ'
            : `${(F.reconstruction.differentPixelRatio * 100).toFixed(3)}% pixels`),
        (y = ee.activeData()));
    } else if (L._lastRaw) {
      let S = L._lastRaw;
      ((x = S.width),
        (C = S.height),
        (R = S.channels || 1),
        (c = 'NPY/NPZ'),
        (f = { Dimensions: `${x} x ${C}`, Channels: String(R), Dtype: S.dtype || 'n/a' }),
        (y = S.data));
    } else if (M._lastRaw) {
      let S = M._lastRaw;
      ((x = S.width),
        (C = S.height),
        (R = S.channels || 1),
        (c = 'PFM'),
        (f = { Dimensions: `${x} x ${C}`, Channels: String(R) }),
        (y = S.data));
    } else if (re.some(S => !!S._lastRaw)) {
      let S = re.find(H => !!H._lastRaw),
        F = S._lastRaw;
      ((x = F.width),
        (C = F.height),
        (R = F.channels || 1),
        (c = S.config.formatLabel),
        (f = { Dimensions: `${x} x ${C}`, Channels: String(R) }));
      for (let [H, D] of Object.entries(S.metadata))
        D == null || typeof D == 'object' || (f[H.replace(/([a-z])([A-Z])/g, '$1 $2')] = String(D));
      y = F.data;
    } else if (I._lastRaw) {
      let S = I._lastRaw;
      ((x = S.width),
        (C = S.height),
        (R = S.channels || 3),
        (c = 'HDR (Radiance)'),
        (f = { Dimensions: `${x} x ${C}`, Channels: String(R) }),
        (b = I._lastAllTags || []),
        (y = S.data));
    } else if (T._lastRaw) {
      let S = T._lastRaw;
      ((x = S.width),
        (C = S.height),
        (R = S.channels || 1),
        (c = S.format || 'PPM/PGM/PBM'),
        (f = { Dimensions: `${x} x ${C}`, Channels: String(R), 'Max Value': String(S.maxval) }),
        (y = S.data));
    } else if (_._lastRaw || _._lazyNativeReadback) {
      let S = _._lastRaw,
        F = _._lazyNativeReadback;
      ((c = d?.formatType === 'jpg' ? 'JPEG' : 'PNG'),
        S
          ? ((x = S.width),
            (C = S.height),
            (R = S.channels || 4),
            (f = {
              Dimensions: `${x} x ${C}`,
              Channels: String(R),
              'Bit Depth': String(S.bitDepth || 8),
            }),
            (y = S.data))
          : (f = { Dimensions: `${F.width} x ${F.height}` }),
        (b = _._lastAllTags || []));
    } else return null;
    let P = null;
    if (y && x && C)
      try {
        P = St.calculateExtendedStats(y, x, C, R || 1);
      } catch {
        P = null;
      }
    return (
      O.active
        ? (f.Renderer =
            xt === 'gpu'
              ? 'WebGL2'
              : xt === 'webgpu'
                ? 'WebGPU'
                : xt === 'wasm'
                  ? 'Rust/Wasm'
                  : 'JavaScript')
        : ((yr =
            (fe === 'TIFF'
              ? g
              : fe === 'EXR'
                ? w
                : fe === 'PFM'
                  ? M
                  : fe === 'PPM/PGM'
                    ? T
                    : fe === 'PNG/JPEG'
                      ? _
                      : fe === 'NPY/NPZ'
                        ? L
                        : fe === 'HDR'
                          ? I
                          : fe === 'TGA'
                            ? A
                            : fe === 'JPEG XL'
                              ? X
                              : fe === 'FITS'
                                ? z
                                : fe === 'DICOM'
                                  ? j
                                  : fe === 'NetCDF'
                                    ? q
                                    : fe === 'CZI'
                                      ? oe
                                      : fe === 'ND2'
                                        ? U
                                        : fe === 'LIF'
                                          ? Z
                                          : fe === 'SDT'
                                            ? G
                                            : fe === 'Layered Document'
                                              ? ee
                                              : N
            )?._lastRenderUsedWebGL === !0
              ? 'webgl2'
              : 'cpu'),
          (f.Renderer = yr === 'webgl2' ? 'WebGL2' : 'CPU')),
      { formatLabel: c, fileFields: f, tags: b, stats: P }
    );
  }
  function sa() {
    if (!(!B || !Me || !he.getVisibility()))
      try {
        he.render(zu());
      } catch (c) {
        console.warn('[MetadataPanel] Failed to gather metadata:', c);
      }
  }
  function oa(c = Ue, f = !1) {
    !V.getVisibility() ||
      !O.active ||
      !B ||
      (qi !== null && clearTimeout(qi),
      (qi = window.setTimeout(
        () => {
          if (((qi = null), !V.getVisibility() || !O.active || c !== Ue || !B)) return;
          let b = B.width,
            y = B.height;
          if (b < 1 || y < 1) return;
          let C = Math.min(1, Math.sqrt(262144 / (b * y))),
            R = Math.max(1, Math.round(b * C)),
            P = Math.max(1, Math.round(y * C));
          (Bn || (Bn = document.createElement('canvas')),
            Bn.width !== R && (Bn.width = R),
            Bn.height !== P && (Bn.height = P));
          let S = Bn.getContext('2d', { willReadFrequently: !0 });
          if (!S) return;
          (S.clearRect(0, 0, R, P), S.drawImage(B, 0, 0, R, P));
          let F = S.getImageData(0, 0, R, P);
          (ne.mark('histogram-layer-composite'),
            V.update(F, { settings: r.settings, sampleStep: 1 }));
        },
        f ? 80 : 0
      )));
  }
  function Ne() {
    if ((sa(), !(!B || !Me) && V.getVisibility())) {
      if (O.active && O.hasCompositeStack()) {
        oa();
        return;
      }
      try {
        if ((si !== null && (clearTimeout(si), (si = null)), _ && _.hasLazyNativeReadback())) {
          let R = _.getLazyNativeHistogramImageData(1e6);
          if (R) {
            (ne.mark('histogram-prepare'), V.update(R, { settings: r.settings, sampleStep: 1 }));
            return;
          }
          let P = _.renderPngWithSettings();
          P && (Y = P);
        }
        if (g.rawTiffData && g._lastRenderHistogram) {
          (ne.mark('histogram-prepare'),
            V.updateFromPrecomputed(g._lastRenderHistogram),
            ne.mark('histogram-from-render'));
          return;
        }
        if (w.rawExrData && w._lastRenderHistogram) {
          (ne.mark('histogram-prepare'),
            V.updateFromPrecomputed(w._lastRenderHistogram),
            ne.mark('histogram-from-render'));
          return;
        }
        if (L._lastRaw && L._lastRenderHistogram) {
          (ne.mark('histogram-prepare'),
            V.updateFromPrecomputed(L._lastRenderHistogram),
            ne.mark('histogram-from-render'));
          return;
        }
        if (M._lastRaw && M._lastRenderHistogram) {
          (ne.mark('histogram-prepare'),
            V.updateFromPrecomputed(M._lastRenderHistogram),
            ne.mark('histogram-from-render'));
          return;
        }
        let c = re.find(R => R._lastRaw && R._lastRenderHistogram);
        if (c) {
          (ne.mark('histogram-prepare'),
            V.updateFromPrecomputed(c._lastRenderHistogram),
            ne.mark('histogram-from-render'));
          return;
        }
        if (I._lastRaw && I._lastRenderHistogram) {
          (ne.mark('histogram-prepare'),
            V.updateFromPrecomputed(I._lastRenderHistogram),
            ne.mark('histogram-from-render'));
          return;
        }
        if (je && be.length >= 2) {
          V.updateFromChannels(
            be.map((R, P) => ({
              name: R.name,
              color: pe[P]?.color || '#ffffff',
              min: pe[P]?.min ?? 0,
              max: pe[P]?.max ?? 1,
              visible: (pe[P]?.visible ?? !0) && (We === null || We === R.index),
              data: R.data,
            }))
          );
          return;
        }
        V.clearChannelHistograms();
        let b = { settings: r.settings };
        if (g.rawTiffData) {
          let R = g.rawTiffData.ifd,
            P = g.rawTiffData.rasters,
            S = R.t339,
            F = R.t258 || 8,
            H = R.t277 || 1,
            D = ya(S, F),
            $ = va(S, F),
            W = g._lastStatistics || null;
          b = { ...b, planarData: P, channels: H, isFloat: D, typeMax: $, stats: W };
        } else if (ee._lastRaw) {
          let R = ee._lastRaw;
          b = {
            ...b,
            rawData: ee.activeData(),
            channels: R.channels,
            isFloat: R.sampleFormat === 3,
            typeMax: R.sampleFormat === 3 ? 1 : R.bitDepth === 16 ? 65535 : 255,
            stats: ee._cachedStats || null,
          };
        } else if (w && w.rawExrData) {
          let { width: R, height: P, data: S, channels: F } = w.rawExrData,
            H = w._cachedStats || null;
          b = { ...b, rawData: S, channels: F, isFloat: !0, typeMax: 1, stats: H };
        } else if (L && L._lastRaw) {
          let { width: R, height: P, data: S, dtype: F, channels: H } = L._lastRaw,
            D = F.includes('f'),
            $ = L._cachedStats || null,
            W;
          (D
            ? (W = 1)
            : F.includes('16') || F.includes('u2') || F.includes('i2')
              ? (W = 65535)
              : (W = 255),
            (b = { ...b, rawData: S, channels: H, isFloat: D, typeMax: W, stats: $ }));
        } else if (M && M._lastRaw) {
          let { width: R, height: P, data: S, channels: F } = M._lastRaw,
            H = M._cachedStats || null;
          b = { ...b, rawData: S, channels: F, isFloat: !0, typeMax: 1, stats: H };
        } else if (re.some(R => !!R._lastRaw)) {
          let R = re.find(F => !!F._lastRaw),
            { data: P, channels: S } = R._lastRaw;
          b = {
            ...b,
            rawData: P,
            channels: S,
            isFloat: !0,
            typeMin: R.numericDomain.typeMin,
            typeMax: R.numericDomain.typeMax,
            stats: R._cachedStats || null,
          };
        } else if (I && I._lastRaw) {
          let { width: R, height: P, data: S, channels: F } = I._lastRaw,
            H = I._cachedStats || null;
          b = { ...b, rawData: S, channels: F, isFloat: !0, typeMax: 1, stats: H };
        } else if (T && T._lastRaw) {
          let { width: R, height: P, data: S, maxval: F, channels: H } = T._lastRaw,
            D = T._cachedStats || null;
          b = { ...b, rawData: S, channels: H, isFloat: !1, typeMax: F, stats: D };
        } else if (_ && _._lastRaw) {
          let { width: R, height: P, data: S, channels: F, bitDepth: H, maxValue: D } = _._lastRaw,
            $ = _._cachedStats || null;
          b = { ...b, rawData: S, channels: F, isFloat: !1, typeMax: D || 255, stats: $ };
        }
        ne.mark('histogram-prepare');
        let y = null;
        if (!b.rawData && !b.planarData) {
          if (((y = Tr(B)), !y)) return;
          ne.mark('histogram-canvas-readback');
        }
        let x = b.planarData
          ? b.planarData[0]?.length || 0
          : b.rawData
            ? Math.floor(b.rawData.length / (b.channels || 1))
            : 0;
        if (x > 4e6 && (b.rawData || b.planarData)) {
          let R = Math.max(2, Math.ceil(x / 1e6));
          V.update(y, { ...b, sampleStep: R });
          let P = ie,
            S = () => {
              if (((si = null), !(P !== ie || !V.getVisibility())))
                try {
                  let F = performance.now();
                  (V.update(y, b),
                    console.log(
                      `[Histogram] Deferred exact update took ${(performance.now() - F).toFixed(1)}ms`
                    ));
                } catch (F) {
                  console.error('Error updating exact histogram:', F);
                }
            };
          si = window.setTimeout(S, 250);
          return;
        }
        V.update(y, b);
      } catch (c) {
        console.error('Error updating histogram:', c);
      }
    }
  }
  function _o() {
    ((g.rawTiffData = null),
      w && (w.rawExrData = void 0),
      L && (L._lastRaw = null),
      T && (T._lastRaw = null),
      M && (M._lastRaw = null),
      _ && (_._lastRaw = null),
      I && (I._lastRaw = null),
      A && (A._lastRaw = null),
      N && (N._lastRaw = null),
      ee.reset(),
      Gn());
    for (let c of re) c._lastRaw = null;
    zi();
  }
  async function Po() {
    if (!Mn || !B) return;
    let c = B.getContext('2d', { willReadFrequently: !0 });
    if (!c) return;
    let { floatData: f, width: b, height: y } = Mn,
      x = St.calculateFloatStats(f, b, y, 1),
      C = bt.render(f, b, y, 1, !0, x, r.settings, { nanColor: Hn() });
    (await Fe(C, c), (Y = C), Ne());
  }
  async function Io(c, f, b, y, x) {
    if (!B || !Me) {
      console.error('No image loaded for colormap conversion');
      return;
    }
    try {
      let C = Tr(B);
      if (!C) {
        console.error('Could not get canvas context');
        return;
      }
      let R = C.width,
        P = C.height;
      ((Mn = { floatData: su.convertToFloat(C, c, f, b, y, x), width: R, height: P }),
        _o(),
        r.settings.normalization &&
          ((r.settings.normalization.autoNormalize = !0),
          (r.settings.normalization.min = f),
          (r.settings.normalization.max = b)),
        await Po(),
        k.updateScale(k.scale || 'fit'),
        p.postMessage({ type: 'stats', value: { min: f, max: b } }),
        xu({
          width: R,
          height: P,
          bitsPerSample: 32,
          sampleFormat: 3,
          samplesPerPixel: 1,
          formatType: 'colormap-converted',
          isInitialLoad: !1,
        }),
        ($n = { colormapName: c, minValue: f, maxValue: b, inverted: y, logarithmic: x }),
        (kr = !0),
        Xt(),
        console.log(`Colormap decode complete: ${c} [${f}, ${b}]`));
    } catch (C) {
      (console.error('Error during colormap conversion:', C),
        p.postMessage({ type: 'error', message: `Colormap conversion failed: ${C.message}` }));
    }
  }
  function ju() {
    if (!B || !Me) {
      console.error('No image loaded to revert');
      return;
    }
    try {
      let f = r.settings.resourceUri || '';
      (($n = null),
        (kr = !1),
        (bu = null),
        (Mn = null),
        _o(),
        fo(),
        p.postMessage({ type: 'notifyRevert', message: 'Reverted to original image' }),
        console.log('Reverted to original image'));
    } catch (c) {
      (console.error('Error reverting to original image:', c),
        p.postMessage({
          type: 'error',
          message: `Failed to revert to original image: ${c.message}`,
        }));
    }
  }
  async function sn(c) {
    let f = _ && _.hasLazyNativeReadback();
    if (!B || (!Y && !f) || (f && _.canUseLazyNativeCanvasForSettings(r.settings))) return;
    if (je && be.length >= 2) {
      cr();
      return;
    }
    if (O.active && O.hasCompositeStack() && Ct()) return;
    if (Mn) {
      await Po();
      return;
    }
    if (Y && ee._lastRaw) {
      let y = ee.renderWithSettings({ collectHistogram: V.getVisibility() }),
        x = tt();
      y && x && (await Fe(y, x), (Y = y), Ne());
      return;
    }
    if (
      (c ||
        (c = {
          changed: !0,
          changedKeys: ['unspecified'],
          parametersOnly: !1,
          changedStructure: !1,
        }),
      Y && g.rawTiffData)
    ) {
      try {
        if (g.isProgressiveRemoteBase && Ee) {
          (Ee.clearTiles(), Ee.clearBase(), (et = null), Dt(), Kr());
          return;
        }
        if ((Ee?.clearTiles(), c.parametersOnly)) {
          let x = await g.renderTiffWithSettingsFast(
            g.rawTiffData.image,
            g.rawTiffData.rasters,
            !0,
            { collectHistogram: V.getVisibility(), targetCanvas: B, placeholderImageData: Y }
          );
          if (g._lastRenderUsedWebGL && x) (ne.mark('canvas-upload-skipped'), (Y = x), Ne());
          else {
            let C = tt();
            C && x && (await Fe(x, C), (Y = x), Ne());
          }
          fi();
          return;
        }
        let y = await g.renderTiffWithSettings(g.rawTiffData.image, g.rawTiffData.rasters, {
          collectHistogram: V.getVisibility(),
          targetCanvas: B,
          placeholderImageData: Y,
        });
        if (g._lastRenderUsedWebGL && y) (ne.mark('canvas-upload-skipped'), (Y = y), Ne());
        else {
          let x = tt();
          x &&
            y &&
            (console.log('\u2705 CANVAS UPDATE (TIFF slow path): Applying new ImageData to canvas'),
            await Fe(y, x),
            (Y = y),
            Ne());
        }
        (fi(), console.log('\u2728 Slow path complete, returning'));
        return;
      } catch (y) {
        console.error('\u274C Error updating TIFF image with new settings:', y);
      }
      console.log('\u21A9\uFE0F Returning after TIFF processing (even on error)');
      return;
    }
    if (Y && w && w.rawExrData) {
      console.log('\u{1F4C4} Processing EXR update');
      try {
        let y = w.updateSettings(r.settings, {
          collectHistogram: V.getVisibility(),
          targetCanvas: B,
          placeholderImageData: Y,
        });
        if (y)
          if (w._lastRenderUsedWebGL) (ne.mark('canvas-upload-skipped'), (Y = y), Ne());
          else {
            let x = tt();
            x &&
              (console.log('\u2705 CANVAS UPDATE (EXR): Applying new ImageData to canvas'),
              await Fe(y, x),
              (Y = y),
              Ne());
          }
      } catch (y) {
        console.error('\u274C Error updating EXR image with new settings:', y);
      }
      return;
    }
    if (Y && T && T._lastRaw) {
      try {
        let y = T.renderPgmWithSettings({
          collectHistogram: V.getVisibility(),
          targetCanvas: B,
          placeholderImageData: Y,
        });
        if (y)
          if (T._lastRenderUsedWebGL) (ne.mark('canvas-upload-skipped'), (Y = y), Ne());
          else {
            let x = tt();
            x && (await Fe(y, x), (Y = y), Ro(), Ne());
          }
      } catch (y) {
        console.error('Error updating PGM image with new settings:', y);
      }
      return;
    }
    if (Y && M && M._lastRaw) {
      try {
        let y = M.renderPfmWithSettings({
          collectHistogram: V.getVisibility(),
          targetCanvas: B,
          placeholderImageData: Y,
        });
        if (y)
          if (M._lastRenderUsedWebGL) (ne.mark('canvas-upload-skipped'), (Y = y), Ne());
          else {
            let x = tt();
            x && (await Fe(y, x), (Y = y), Ne());
          }
      } catch (y) {
        console.error('Error updating PFM image with new settings:', y);
      }
      return;
    }
    let b = re.find(y => !!y._lastRaw);
    if (Y && b) {
      try {
        let y = b.renderWithSettings({
          collectHistogram: V.getVisibility(),
          targetCanvas: B,
          placeholderImageData: Y,
        });
        if (y) {
          if (b._lastRenderUsedWebGL) Y = y;
          else {
            let x = tt();
            x && (await Fe(y, x), (Y = y));
          }
          Ne();
        }
      } catch (y) {
        console.error(`Error updating ${b.config.formatLabel} with new settings:`, y);
      }
      return;
    }
    if (Y && L && L._lastRaw) {
      try {
        let y = L.renderNpyWithSettings({
          collectHistogram: V.getVisibility(),
          targetCanvas: B,
          placeholderImageData: Y,
        });
        if (y)
          if (L._lastRenderUsedWebGL) (ne.mark('canvas-upload-skipped'), (Y = y), Ne());
          else {
            let x = tt();
            x && (await Fe(y, x), (Y = y), Ne());
          }
      } catch (y) {
        console.error('Error updating NPY image with new settings:', y);
      }
      return;
    }
    if (_ && (_._lastRaw || _.hasLazyNativeReadback())) {
      try {
        let y = _.renderPngWithSettings({
          collectHistogram: V.getVisibility(),
          targetCanvas: B,
          placeholderImageData: Y,
        });
        if (y)
          if (_._lastRenderUsedWebGL) (ne.mark('canvas-upload-skipped'), (Y = y), Ne());
          else {
            let x = tt();
            x && (await Fe(y, x), (Y = y), Ro(), Ne());
          }
      } catch (y) {
        console.error('Error updating PNG/JPEG image with new settings:', y);
      }
      return;
    }
    if (Y && I && I._lastRaw) {
      try {
        let y = I.renderHdrWithSettings({
          collectHistogram: V.getVisibility(),
          targetCanvas: B,
          placeholderImageData: Y,
        });
        if (y)
          if (I._lastRenderUsedWebGL) (ne.mark('canvas-upload-skipped'), (Y = y), Ne());
          else {
            let x = tt();
            x && (await Fe(y, x), (Y = y), Ne());
          }
      } catch (y) {
        console.error('Error updating HDR image with new settings:', y);
      }
      return;
    }
    if (Y && A && A._lastRaw) {
      try {
        let y = A.renderTgaWithSettings();
        if (y) {
          let x = B.getContext('2d');
          x && (await Fe(y, x), (Y = y), Ne());
        }
      } catch (y) {
        console.error('Error updating TGA image with new settings:', y);
      }
      return;
    }
    if (Y && N && N._lastRaw) {
      try {
        let y = N.renderWebImageWithSettings();
        if (y) {
          let x = B.getContext('2d');
          x && (await Fe(y, x), (Y = y), Ne());
        }
      } catch (y) {
        console.error('Error updating Web Image with new settings:', y);
      }
      return;
    }
  }
  function Gu() {
    if ((Kc(document), ge.classList.contains('web-app')))
      for (let f of ['gesturestart', 'gesturechange', 'gestureend'])
        ge.addEventListener(f, b => k.handleGesture(b), { passive: !1 });
    (ge.addEventListener(
      'wheel',
      f => {
        f.ctrlKey && f.preventDefault();
        let b = E.getKeyboardState();
        k.handleWheelZoom(f, b.ctrlPressed, b.altPressed);
      },
      { passive: !1 }
    ),
      ge.addEventListener('mousedown', f => {
        if (!te || !Me || f.button !== 0 || f.target !== te) return;
        let b = E.getKeyboardState();
        E.consumeClick = !E.isActive;
      }),
      ge.addEventListener('click', f => {
        if (!te || !Me || f.button !== 0 || f.target !== te || (O.active && Ie.movingLayerId))
          return;
        if (E.consumeClick) {
          E.consumeClick = !1;
          return;
        }
        k.scale === 'fit' && k.firstZoom();
        let b = E.getKeyboardState();
        (r.isMac ? b.altPressed : b.ctrlPressed) ? k.zoomOut() : k.zoomIn();
      }),
      window.addEventListener(
        'scroll',
        () => {
          if (!te || !Me || !te.parentElement || k.scale === 'fit') return;
          let f = p.getState();
          f && p.setState({ ...f, offsetX: window.scrollX, offsetY: window.scrollY });
        },
        { passive: !0 }
      ));
    let c = f =>
      f instanceof HTMLElement
        ? f.isContentEditable || f.closest('[contenteditable="true"]')
          ? !0
          : f.closest('.nav-overlay')
            ? !1
            : f instanceof HTMLTextAreaElement || f instanceof HTMLSelectElement
              ? !0
              : f instanceof HTMLInputElement
                ? ![
                    'button',
                    'checkbox',
                    'color',
                    'file',
                    'image',
                    'radio',
                    'range',
                    'reset',
                    'submit',
                  ].includes(f.type)
                : !1
        : !1;
    (document.addEventListener(
      'pointerup',
      f => {
        let b = f.target;
        b instanceof HTMLElement &&
          (c(b) ||
            (!(b instanceof HTMLInputElement) && !(b instanceof HTMLButtonElement)) ||
            b.blur());
      },
      !0
    ),
      document.addEventListener(
        'change',
        f => {
          f.target instanceof HTMLSelectElement && f.target.blur();
        },
        !0
      ),
      document.addEventListener('copy', f => {
        c(f.target) || es();
      }),
      document.addEventListener('contextmenu', f => {
        if (c(f.target)) return;
        f.preventDefault();
        let b = document.querySelector('.custom-context-menu');
        b && b.remove();
        let y = document.createElement('div');
        ((y.className = 'custom-context-menu'),
          (y.style.left = `${f.clientX}px`),
          (y.style.top = `${f.clientY}px`));
        let x = (we, ze) => {
            let Lt = document.createElement('div');
            return (
              (Lt.className = 'context-menu-item'),
              (Lt.textContent = we),
              Lt.addEventListener('click', ba => {
                (ba.stopPropagation(), y.remove(), setTimeout(() => ze(), 0));
              }),
              Lt
            );
          },
          C = () => {
            let we = document.createElement('div');
            return ((we.className = 'context-menu-separator'), we);
          };
        (y.appendChild(
          x('Copy Image and Position', () => {
            p.postMessage({ type: 'executeCommand', command: 'tiffVisualizer.copyImage' });
          })
        ),
          y.appendChild(
            x('Paste Position', () => {
              p.postMessage({ type: 'executeCommand', command: 'tiffVisualizer.pastePosition' });
            })
          ),
          y.appendChild(
            x('Export\u2026', () => {
              p.postMessage({ type: 'executeCommand', command: 'tiffVisualizer.exportLayers' });
            })
          ),
          y.appendChild(C()),
          y.appendChild(
            x('Add Images to Collection', () => {
              p.postMessage({
                type: 'executeCommand',
                command: 'tiffVisualizer.browseAndAddToCollection',
              });
            })
          ),
          y.appendChild(C()),
          y.appendChild(
            x('Toggle Histogram', () => {
              p.postMessage({ type: 'executeCommand', command: 'tiffVisualizer.toggleHistogram' });
            })
          ),
          Ks() &&
            y.appendChild(
              x(Wt.isVisible() ? 'Close Channels Panel' : 'Channels\u2026', () => {
                p.postMessage({ type: 'executeCommand', command: 'tiffVisualizer.toggleChannels' });
              })
            ),
          y.appendChild(
            x(Oe.isVisible() ? 'Close Measure Panel' : 'Measure\u2026', () => {
              p.postMessage({ type: 'executeCommand', command: 'tiffVisualizer.toggleMeasure' });
            })
          ),
          At.origin !== 'none' &&
            (y.appendChild(
              x(mt.getShowScaleBar() ? 'Hide Scale Bar' : 'Show Scale Bar', () => {
                p.postMessage({ type: 'executeCommand', command: 'tiffVisualizer.toggleScaleBar' });
              })
            ),
            mt.hasCustomScaleBarPosition() &&
              y.appendChild(x('Reset Scale Bar Position', () => mt.resetScaleBarPosition()))));
        let R = d && (d.samplesPerPixel ?? 0) >= 3 && d.bitsPerSample === 8 && d.sampleFormat !== 3,
          P = d && (d.samplesPerPixel ?? 0) >= 3,
          S = !!d && (d.samplesPerPixel ?? 1) <= 1;
        if (R) {
          y.appendChild(C());
          let we = r.settings.rgbAs24BitGrayscale || !1;
          y.appendChild(
            x(we ? '\u2713 Interpret as 24-bit Grayscale' : 'Interpret as 24-bit Grayscale', () => {
              p.postMessage({ type: 'executeCommand', command: 'tiffVisualizer.toggleRgb24Mode' });
            })
          );
        }
        if (S) {
          y.appendChild(C());
          let we = r.settings.displayColormap,
            ze = we && we !== 'none';
          (y.appendChild(
            x(ze ? `Apply Colormap\u2026 (${we})` : 'Apply Colormap\u2026', () => {
              p.postMessage({ type: 'executeCommand', command: 'tiffVisualizer.applyColormap' });
            })
          ),
            ze &&
              y.appendChild(
                x('Remove Colormap', () => {
                  To('none');
                })
              ));
        }
        (P &&
          (R || y.appendChild(C()),
          y.appendChild(
            x('Decode Colormap to Float', () => {
              p.postMessage({
                type: 'executeCommand',
                command: 'tiffVisualizer.convertColormapToFloat',
              });
            })
          )),
          kr &&
            (y.appendChild(C()),
            y.appendChild(
              x('Revert to Original', () => {
                p.postMessage({
                  type: 'executeCommand',
                  command: 'tiffVisualizer.revertToOriginal',
                });
              })
            )),
          y.appendChild(C()),
          y.appendChild(
            x('Open Layers View', () => {
              p.postMessage({ type: 'executeCommand', command: 'tiffVisualizer.toggleLayers' });
            })
          ),
          y.appendChild(C()));
        let F = Qo(r.settings.nanColor);
        if (
          (y.appendChild(
            x(`Show No-Value Pixels as ${F}`, () => {
              p.postMessage({ type: 'executeCommand', command: 'tiffVisualizer.toggleNanColor' });
            })
          ),
          r.settings.normalization && r.settings.normalization.gammaMode && !O.active)
        ) {
          let ze = r.settings.colorPickerShowModified || !1 ? 'Original Values' : 'Modified Values';
          y.appendChild(
            x(`Color Picker: Show ${ze}`, () => {
              p.postMessage({
                type: 'executeCommand',
                command: 'tiffVisualizer.toggleColorPickerMode',
              });
            })
          );
        }
        y.appendChild(
          x('Toggle Metadata Panel', () => {
            p.postMessage({ type: 'executeCommand', command: 'tiffVisualizer.toggleMetadata' });
          })
        );
        let D = [
          'tiff-float',
          'tiff-int',
          'tiff-int-signed',
          'tiff-int-wide',
          'tiff-uint16',
          'pfm',
          'npy',
          'npy-float',
          'npy-uint',
          'png',
        ];
        (r.settings.plyVisualizerInstalled &&
          d &&
          D.includes(d.formatType ?? '') &&
          (y.appendChild(C()),
          y.appendChild(
            x('Open as Point Cloud', () => {
              p.postMessage({ type: 'executeCommand', command: 'tiffVisualizer.openAsPointCloud' });
            })
          )),
          document.body.appendChild(y));
        let $ = 8,
          W = Math.max(
            0,
            Number.parseFloat(
              getComputedStyle(document.documentElement).getPropertyValue(
                '--context-menu-bottom-inset'
              )
            ) || 0
          ),
          K = window.innerHeight - W - $,
          J = y.getBoundingClientRect(),
          se = f.clientX,
          Re = f.clientY;
        (se + J.width > window.innerWidth - $ &&
          (se = Math.max($, window.innerWidth - J.width - $)),
          Re + J.height > K && (Re = Math.max($, K - J.height)),
          (y.style.left = `${se}px`),
          (y.style.top = `${Re}px`));
        let Te = we => {
          y.contains(we.target) || (y.remove(), document.removeEventListener('click', Te));
        };
        setTimeout(() => {
          document.addEventListener('click', Te);
        }, 0);
      }),
      document.addEventListener('cut', f => {
        c(f.target) || f.preventDefault();
      }),
      document.addEventListener('paste', f => {
        c(f.target) ||
          (f.preventDefault(),
          p.postMessage({ type: 'executeCommand', command: 'tiffVisualizer.pastePosition' }));
      }),
      document.addEventListener(
        'keydown',
        f => {
          c(f.target) || (Oe.handleKey(f) && (f.preventDefault(), f.stopPropagation()));
        },
        !0
      ),
      document.addEventListener(
        'keyup',
        f => {
          Oe.handleKeyUp(f) && (f.preventDefault(), f.stopPropagation());
        },
        !0
      ),
      document.addEventListener('keydown', async f => {
        if (
          f.key.toLowerCase() === 'c' &&
          !f.metaKey &&
          !f.ctrlKey &&
          !f.altKey &&
          !c(f.target) &&
          ri
        ) {
          xn = !xn;
          let b = g.rawTiffData,
            y = g._lastStatistics;
          ((g.rawTiffData = fr), (g._lastStatistics = pr), (fr = b), (pr = y));
          let x = w.rawExrData,
            C = w._cachedStats;
          ((w.rawExrData = gr), (w._cachedStats = br), (gr = x), (br = C));
          let R = xn ? ri : Y,
            P = B && B.getContext('2d');
          (P && R && (await Fe(R, P), Ne()), Xt());
        }
      }),
      document.querySelector('.open-file-link')?.addEventListener('click', f => {
        (f.preventDefault(), p.postMessage({ type: 'reopen-as-text' }));
      }),
      window.addEventListener(
        'keydown',
        f => {
          let b = c(f.target),
            y = !f.altKey && !f.ctrlKey && !f.metaKey && !f.shiftKey,
            x = f.key === 'ArrowRight' || f.code === 'ArrowRight',
            C = f.key === 'ArrowLeft' || f.code === 'ArrowLeft',
            R = He.totalImages <= 1,
            P = on.length === 1 && !on[0]?.isChoice ? 0 : 1,
            S = R ? Ao(P) : void 0;
          if (!b && y && (x || C) && S) {
            (f.preventDefault(), f.stopPropagation(), jr(S, x ? 1 : -1));
            return;
          }
          let F = Tt(g.pageDirectory) ? yi(g.pageDirectory).length : g.pageCount;
          if (!b && y && (x || C) && (He.totalImages > 1 || F > 1)) {
            (f.preventDefault(),
              f.stopPropagation(),
              He.totalImages > 1 ? Lo(x ? 'next' : 'previous') : Yr(x ? 1 : -1));
            return;
          }
          if (!b && on.length > 1) {
            let H = [
              [0, '[', ']'],
              [2, '<', '>'],
              [3, '{', '}'],
            ];
            for (let [D, $, W] of H) {
              let K = Ao(D);
              if (K) {
                if (f.key === W || (D === 0 && f.code === 'PageDown')) {
                  (f.preventDefault(), jr(K, 1));
                  return;
                }
                if (f.key === $ || (D === 0 && f.code === 'PageUp')) {
                  (f.preventDefault(), jr(K, -1));
                  return;
                }
              }
            }
          }
          if (!b && g.pageCount > 1) {
            if (f.key === ']' || f.code === 'PageDown') {
              (f.preventDefault(), Yr(1));
              return;
            } else if (f.key === '[' || f.code === 'PageUp') {
              (f.preventDefault(), Yr(-1));
              return;
            }
          }
        },
        !0
      ),
      window.addEventListener('beforeunload', () => {
        (k.saveState(), Er());
      }));
  }
  function Wu() {
    ((Ye = document.createElement('div')),
      Ye.classList.add('image-collection-overlay'),
      (Ye.style.display = 'none'),
      (Ye.innerHTML = `
			<div class="overlay-content">
				<div class="overlay-controls">
					<button class="collection-nav-btn collection-prev-btn" type="button" tabindex="-1" title="Previous image (Left Arrow)" aria-label="Previous image">&#x2039;</button>
					<span class="image-counter" title="Click to jump to image">1 of 1</span>
					<button class="collection-nav-btn collection-next-btn" type="button" tabindex="-1" title="Next image (Right Arrow)" aria-label="Next image">&#x203a;</button>
					<button class="collection-remove-btn" title="Remove from collection">&#x2715;</button>
				</div>
				<span class="toggle-hint">Left / Right Arrow keys to navigate</span>
			</div>
		`));
    let c = (y, x) => {
      let C = Ye?.querySelector(y);
      (C?.addEventListener('pointerdown', R => {
        (R.preventDefault(), R.stopPropagation());
      }),
        C?.addEventListener('click', R => {
          (R.preventDefault(), R.stopPropagation(), C.blur(), Lo(x));
        }),
        C?.addEventListener('keydown', R => {
          (R.key === 'Enter' || R.key === ' ') && (R.preventDefault(), R.stopPropagation());
        }));
    };
    (c('.collection-prev-btn', 'previous'), c('.collection-next-btn', 'next'));
    let f = Ye.querySelector('.image-counter');
    f.addEventListener('click', () => {
      let y = He.totalImages,
        x = document.createElement('input');
      ((x.type = 'number'),
        (x.min = '1'),
        (x.max = String(y)),
        (x.value = String(He.currentIndex + 1)),
        (x.className = 'image-counter-input'),
        (x.title = `1 \u2013 ${y}`),
        (Cn = x),
        f.replaceWith(x),
        x.select());
      let C = () => {
        x.isConnected &&
          ((Cn = null),
          (f.textContent = `${He.currentIndex + 1} of ${He.totalImages}`),
          x.replaceWith(f));
      };
      (x.addEventListener('keydown', R => {
        if (R.key === 'Enter') {
          R.stopPropagation();
          let P = parseInt(x.value, 10);
          (!isNaN(P) &&
            P >= 1 &&
            P <= He.totalImages &&
            p.postMessage({ type: 'jumpToCollectionIndex', index: P - 1 }),
            C());
        } else if (R.key === 'Escape') ((Cn = null), x.replaceWith(f));
        else if (R.key === 'ArrowRight' || R.key === 'ArrowLeft') {
          (R.preventDefault(), R.stopPropagation());
          let P = parseInt(x.value, 10),
            S = isNaN(P) ? He.currentIndex + 1 : P,
            F = He.totalImages,
            H = R.key === 'ArrowRight' ? (S >= F ? 1 : S + 1) : S <= 1 ? F : S - 1;
          ((x.value = String(H)),
            x.select(),
            p.postMessage({ type: 'jumpToCollectionIndex', index: H - 1 }));
        }
      }),
        x.addEventListener('blur', C));
    });
    let b = null;
    (Ye.addEventListener('mousedown', y => {
      y.target.classList.contains('collection-remove-btn') && y.preventDefault();
    }),
      Ye.addEventListener('click', y => {
        let x = y.target;
        x.classList.contains('collection-remove-btn') &&
          (y.stopPropagation(),
          x.classList.contains('collection-remove-btn--confirm')
            ? (b !== null && clearTimeout(b),
              (b = null),
              x.classList.remove('collection-remove-btn--confirm'),
              (x.textContent = '\u2715'),
              (x.title = 'Remove from collection'),
              p.postMessage({ type: 'removeFromCollection' }))
            : (x.classList.add('collection-remove-btn--confirm'),
              (x.textContent = '\u2713'),
              (x.title = 'Click to confirm removal'),
              (b = setTimeout(() => {
                (x.classList.remove('collection-remove-btn--confirm'),
                  (x.textContent = '\u2715'),
                  (x.title = 'Remove from collection'),
                  (b = null));
              }, 1500))));
      }),
      document.body.appendChild(Ye));
  }
  let on = [];
  function Ou(c) {
    return c.length === 1 && !c[0]?.isChoice
      ? ['\u2190 \u2192']
      : ['[ ]', '\u2190 \u2192', '< >', '{ }'];
  }
  function Ao(c) {
    let f = on[c];
    return f && f.size > 1 ? f : void 0;
  }
  function jr(c, f) {
    if (!c || c.size <= 1) return;
    let b = (c.value + f + c.size) % c.size;
    c.go(b);
  }
  function Vu(c) {
    let f = Ou(on);
    c.forEach((b, y) => {
      if (!b) return;
      let x = b.querySelector('.dataset-axis-hint');
      x ||
        ((x = document.createElement('span')),
        (x.className = 'dataset-axis-hint'),
        b.appendChild(x));
      let C = on[y],
        R = C && C.size > 1 && f[y] ? f[y] : '';
      ((x.textContent = R), (x.title = R ? `Step ${C.label} with ${R}` : ''));
    });
  }
  let la = new Map();
  function Xu(c, f, b) {
    let y = null,
      x = (S, F) => {
        let H = c.getBoundingClientRect(),
          D = Math.max(0, window.innerWidth - H.width),
          $ = Math.max(0, window.innerHeight - H.height);
        return { x: Math.min(Math.max(0, S), D), y: Math.min(Math.max(0, F), $) };
      },
      C = (S, F) => {
        c.style.transform = 'none';
        let H = x(S, F);
        (la.set(f, H),
          (c.style.left = `${H.x}px`),
          (c.style.top = `${H.y}px`),
          (c.style.right = 'auto'),
          (c.style.bottom = 'auto'));
      },
      R = la.get(f);
    R && C(R.x, R.y);
    let P = () => {
      la.delete(f);
      for (let S of ['left', 'top', 'right', 'bottom', 'transform']) c.style.removeProperty(S);
    };
    for (let S of ['mousedown', 'click', 'dblclick', 'wheel'])
      c.addEventListener(S, F => {
        F.stopPropagation();
      });
    (c.addEventListener('dblclick', S => {
      S.target.closest('input, select, button, a, textarea') ||
        (S.preventDefault(), y !== null && (window.clearTimeout(y), (y = null)), P());
    }),
      c.addEventListener('pointerdown', S => {
        let F = S.target;
        if (
          (S.stopPropagation(), F.closest('input, select, button, a, textarea') || S.button !== 0)
        )
          return;
        let H = !!F.closest('.dataset-title'),
          D = c.getBoundingClientRect(),
          $ = S.clientX - D.left,
          W = S.clientY - D.top,
          K = S.clientX,
          J = S.clientY,
          se = !1,
          Re = !1;
        c.setPointerCapture(S.pointerId);
        let Te = ze => {
            (!se && Math.hypot(ze.clientX - K, ze.clientY - J) < 4) ||
              ((se = !0),
              Re || (C(D.left, D.top), c.classList.add('dataset-overlay--dragging'), (Re = !0)),
              C(ze.clientX - $, ze.clientY - W));
          },
          we = ze => {
            (c.classList.remove('dataset-overlay--dragging'),
              c.removeEventListener('pointermove', Te),
              c.removeEventListener('pointerup', we),
              c.removeEventListener('pointercancel', we),
              ze.type === 'pointerup' &&
                !se &&
                H &&
                b &&
                (y !== null && window.clearTimeout(y),
                (y = window.setTimeout(() => {
                  ((y = null), b());
                }, 250))));
          };
        (c.addEventListener('pointermove', Te),
          c.addEventListener('pointerup', we),
          c.addEventListener('pointercancel', we),
          S.preventDefault());
      }),
      window.addEventListener('resize', () => {
        let S = la.get(f);
        S && C(S.x, S.y);
      }));
    for (let S of ['pointerup', 'pointercancel'])
      window.addEventListener(S, () => {
        Vr = !1;
      });
  }
  function Yu(c, f, b) {
    if (!c.planes.length) return f;
    let y = null,
      x = Number.POSITIVE_INFINITY;
    for (let C of c.planes) {
      if ((C.coordinates[b] || 0) !== (f[b] || 0)) continue;
      let R = 0;
      for (let P of c.axes)
        P.key !== b && (R += Math.abs((C.coordinates[P.key] || 0) - (f[P.key] || 0)));
      R < x && ((x = R), (y = C.coordinates));
    }
    return y ? { ...y } : f;
  }
  function Gr(c, f) {
    Mt &&
      ((Ji = !0),
      ca(!0),
      p.postMessage({ type: 'navigateDataset', seriesIndex: c, coordinates: f }));
  }
  function ca(c = Ji) {
    let f = Mt;
    if (!f || f.series.length === 0) {
      cn === 'dataset' && hi('dataset');
      return;
    }
    (ua({ owner: 'dataset', title: f.label, controls: Ku(), loading: c }),
      Ge && (Ge.style.display = 'block'));
  }
  function qu() {
    if (Vt) return;
    let c = document.createElement('div');
    ((c.className = 'layered-preview-overlay'),
      c.setAttribute('hidden', ''),
      (c.innerHTML = `
			<span class="layered-preview-label">Document preview</span>
			<button type="button" data-preview-mode="integrated">Integrated</button>
			<button type="button" data-preview-mode="reconstructed">Reconstructed</button>
			<button type="button" data-layer-action hidden>Open Layers</button>
			<span class="layered-preview-fidelity"></span>`),
      c.querySelectorAll('button[data-preview-mode]').forEach(b => {
        b.addEventListener('click', async y => {
          (y.preventDefault(), y.stopPropagation(), b.blur());
          let x = b.dataset.previewMode;
          ee.setPreviewMode(x) && (Gn(), await sn(null), O.active || zn(), sa());
        });
      }));
    let f = c.querySelector('button[data-layer-action]');
    (f?.addEventListener('click', b => {
      (b.preventDefault(), b.stopPropagation(), f.blur(), Ie.show());
    }),
      document.body.appendChild(c),
      (Vt = c));
  }
  function Gn() {
    if (!Vt) return;
    let c = ee._lastRaw;
    if (!c || O.active) {
      Vt.setAttribute('hidden', '');
      return;
    }
    Vt.removeAttribute('hidden');
    let f = !!c.reconstructedData;
    Vt.querySelectorAll('button[data-preview-mode]').forEach(F => {
      F.hidden = !f;
      let H = F.dataset.previewMode === ee.previewMode;
      (F.classList.toggle('active', H), F.setAttribute('aria-pressed', String(H)));
    });
    let b = { ora: 'ORA', kra: 'KRA', psd: 'PSD', psb: 'PSB', xcf: 'XCF', affinity: 'Affinity' },
      y = {
        integrated: 'integrated',
        merged: 'merged',
        embedded: 'embedded',
        reconstructed: 'reconstructed',
      },
      x = Vt.querySelector('.layered-preview-label');
    x &&
      (x.textContent = `${b[c.formatType]} \xB7 ${y[c.document.previewKind] || c.document.previewKind} preview`);
    let C = Vt.querySelector('button[data-layer-action]'),
      R = c.layerAssets?.filter(F => F.kind !== 'group' && !!F.data).length || 0;
    C && (C.hidden = R === 0);
    let P = Vt.querySelector('.layered-preview-fidelity'),
      S = c.document.reconstruction?.differentPixelRatio;
    P &&
      (f && S !== void 0
        ? ((P.textContent = `${(S * 100).toFixed(2)}% differ`),
          (P.title = 'Pixels differing by more than one channel value from the integrated preview'))
        : c.document.previewKind === 'embedded'
          ? ((P.textContent = 'non-authoritative \xB7 layers unavailable'),
            (P.title = 'This embedded preview may not match the full document'))
          : R
            ? ((P.textContent = `${R} raster layer${R === 1 ? '' : 's'}`),
              (P.title = 'Compatible raster layers can be opened in the Layers View'))
            : ((P.textContent = `${c.document.layerCount} node${c.document.layerCount === 1 ? '' : 's'} \xB7 preview only`),
              (P.title =
                'Layer structure may be inspected, but layer pixels are not available in the Layers View')));
  }
  function ln(c, f, b) {
    return f.map(y => ({
      key: `${c}:${y.name}`,
      label: y.name,
      size: Math.max(1, y.size),
      value: y.value,
      labels: y.labels && y.labels.length === y.size ? y.labels : void 0,
      go: x => b(y, x),
    }));
  }
  function Do(c) {
    return (Array.isArray(c.selectors) ? c.selectors : []).map(b => ({
      name: String(b.name),
      size: Math.max(1, Number(b.size)),
      value: Number(b.value ?? 0) || 0,
      labels: Array.isArray(b.labels) && b.labels.length ? b.labels.map(y => String(y)) : void 0,
    }));
  }
  function Fo(c) {
    let f = Do(c).map(b => ({ ...b, value: Number(ft.indices[b.name] ?? b.value) || 0 }));
    return ln('sel', f, (b, y) => {
      ((ft.indices = { ...ft.indices, [b.name]: y }), Xr());
    });
  }
  function Ku() {
    let c = Mt;
    if (!c || !c.series.length) return [];
    let f = Math.max(0, Math.min(c.series.length - 1, rn)),
      b = c.series[f],
      y = [];
    c.series.length > 1 &&
      y.push({
        name: 'Series',
        size: c.series.length,
        value: f,
        labels: c.series.map(x => String(x.label)),
      });
    for (let x of b.axes) {
      let C = Math.max(1, x.size),
        R =
          Array.isArray(x.valueLabels) &&
          x.valueLabels.length === C &&
          x.valueLabels.every(P => !!P);
      y.push({
        name: x.label,
        size: C,
        value: Ut[x.key] || 0,
        labels: R ? x.valueLabels.map(P => String(P)) : void 0,
      });
    }
    return ln('dicom', y, (x, C) => {
      if (x.name === 'Series') {
        rn = C;
        let P = c.series[C];
        ((Ut = Object.fromEntries((P?.axes || []).map(S => [S.key, 0]))), Gr(rn, Ut));
        return;
      }
      let R = b.axes.find(P => P.label === x.name);
      R && ((Ut = Yu(b, { ...Ut, [R.key]: C }, R.key)), Gr(rn, Ut));
    });
  }
  function Ju(c) {
    let b = (Array.isArray(c.variables) ? c.variables : []).map(x => String(x.name ?? x)),
      y = [];
    b.length > 1 &&
      y.push({
        name: 'Variable',
        size: b.length,
        value: Math.max(0, b.indexOf(String($t.variableName ?? ''))),
        labels: b,
      });
    for (let x of Do(c)) y.push({ ...x, value: Number($t.indices[x.name] ?? x.value) || 0 });
    return ln('nc', y, (x, C) => {
      (x.name === 'Variable'
        ? ($t = { variableName: b[C], indices: {} })
        : ($t.indices = { ...$t.indices, [x.name]: C }),
        rd());
    });
  }
  function Zu() {
    let c = g.selectableBandCount;
    if (fe !== 'TIFF' || !Number.isInteger(c) || c < 2) return [];
    let f = Array.from({ length: c }, (C, R) => ss(g.gdalMetadata, R) || `Band ${R + 1}`),
      b = g.displayRgbBands,
      y = ln(
        'tiff-mode',
        [{ name: 'View', size: 2, value: b ? 1 : 0, labels: ['Single band', 'RGB bands'] }],
        (C, R) => {
          R === 0 ? No(g.displayBand) : g.setDisplayRgbBands([0, 1, Math.min(2, c - 1)]) && Wr();
        }
      ),
      x = b
        ? ['Red', 'Green', 'Blue'].map((C, R) => ({ name: C, size: c, value: b[R], labels: f }))
        : [
            {
              name: 'Band',
              size: c,
              value: Math.min(c - 1, Math.max(0, g.displayBand)),
              labels: f,
            },
          ];
    return [
      ...y,
      ...ln('tiff', x, (C, R) => {
        if (!b) {
          No(R);
          return;
        }
        let P = [b[0], b[1], b[2]];
        ((P[['Red', 'Green', 'Blue'].indexOf(C.name)] = R), g.setDisplayRgbBands(P) && Wr());
      }),
    ];
  }
  async function No(c) {
    g.setDisplayBand(c) && (await Wr());
  }
  async function Wr() {
    (Dt(), qr++, Kt(), (je = !1), (We = null), await sn(null), Wt.render(), Ke());
  }
  function Bo() {
    let c = Zu();
    if (g.pageCount <= 1 || g.hasGeneratedPreview) return c;
    let f = g.omeMetadata;
    if (!f) {
      let S = g.pageDirectory;
      if (Tt(S)) {
        let F = yi(S),
          H = gt(S, g.pageIndex),
          D = [];
        return (
          F.length > 1 &&
            D.push(
              ...ln(
                'tiff',
                [
                  {
                    name: 'Page',
                    size: F.length,
                    value: Math.max(
                      0,
                      F.findIndex($ => $.index === H)
                    ),
                  },
                ],
                ($, W) => {
                  Rn(F[W]?.index ?? 0);
                }
              )
            ),
          [...D, ...c]
        );
      }
      return [
        ...ln('tiff', [{ name: 'Page', size: g.pageCount, value: g.pageIndex }], (F, H) => {
          Rn(H);
        }),
        ...c,
      ];
    }
    let b = xi(f, g.pageIndex),
      y = { C: b.c, Z: b.z, T: b.t },
      x = { C: f.planeSizeC, Z: f.sizeZ, T: f.sizeT },
      C = f.channels.map(S => String(S?.name || '')),
      R = C.length === x.C && C.every(S => !!S),
      P = ['C', 'Z', 'T'].map(S => ({
        name: S,
        size: x[S],
        value: y[S],
        labels: S === 'C' && R ? C : void 0,
      }));
    return [
      ...ln('ome', P, (S, F) => {
        cd(S.name, F);
      }),
      ...c,
    ];
  }
  let Be = null,
    ui = !1;
  function Or() {
    if (!Be) return;
    Be.classList.toggle('dataset-overlay--collapsed', ui);
    let c = Be.querySelector('.dataset-title');
    if (c) {
      let f = Be.classList.contains('dataset-overlay--readonly');
      if (((c.tabIndex = f ? -1 : 0), f)) {
        (c.removeAttribute('role'), c.removeAttribute('aria-expanded'), (c.title = 'Drag to move'));
        return;
      }
      (c.setAttribute('role', 'button'),
        c.setAttribute('aria-expanded', String(!ui)),
        (c.title = ui ? 'Click to expand' : 'Click to collapse'));
    }
  }
  let cn = null,
    Vr = !1;
  function Qu() {
    ((Be = document.createElement('div')),
      (Be.className = 'dataset-overlay nav-overlay'),
      (Be.style.display = 'none'),
      (Be.innerHTML = `
			<div class="dataset-title" role="button" tabindex="0" aria-expanded="true"><span class="dataset-title-label"></span></div>
			<div class="dataset-resolution" hidden><span>Preview <b data-resolution="preview"></b></span><span class="dataset-detail">Detail <b data-resolution="detail"></b></span></div>
			<div class="dataset-axis-controls"></div>
			<div class="dataset-note" hidden></div>
		`));
    let c = () => {
      Be?.classList.contains('dataset-overlay--readonly') || ((ui = !ui), Or());
    };
    (Xu(Be, 'plane', c),
      Be.querySelector('.dataset-title').addEventListener('keydown', f => {
        (f.key === 'Enter' || f.key === ' ') && (f.preventDefault(), f.stopPropagation(), c());
      }),
      Or(),
      document.body.appendChild(Be));
  }
  function ed(c) {
    return c.map(f => `${f.key}:${f.size}:${f.labels ? 'choice' : 'axis'}`).join(',');
  }
  function ua(c) {
    if (!Be) return;
    let { owner: f, title: b, loading: y = !1 } = c,
      x = c.controls.filter(D => D.size > 1),
      C = c.note || '';
    if (!x.length && !C && !c.resolution) {
      (cn === f || cn === null) && hi(f);
      return;
    }
    ((cn = f),
      Be.classList.toggle('dataset-overlay--readonly', x.length === 0 && !C),
      (on = x.map(D => ({
        label: D.label,
        size: D.size,
        value: D.value,
        isChoice: !!D.labels && D.size > 1,
        go: D.go,
      }))));
    let R = Be.querySelector('.dataset-resolution');
    ((R.hidden = !c.resolution),
      Be.classList.toggle('dataset-overlay--resolution', !!c.resolution),
      c.resolution &&
        ((R.querySelector('[data-resolution="preview"]').textContent = c.resolution.preview),
        (R.querySelector('[data-resolution="detail"]').textContent =
          c.resolution.detail || '\u2014'),
        R.querySelector('.dataset-detail').classList.toggle(
          'dataset-detail--empty',
          !c.resolution.detail
        ),
        (R.title = c.resolution.description),
        R.setAttribute(
          'aria-label',
          `Automatic resolution. Preview ${c.resolution.preview}. ${c.resolution.detail ? `Loaded detail ${c.resolution.detail}.` : ''} ${c.resolution.description}`
        )));
    let P = Be.querySelector('.dataset-title-label');
    P.textContent !== b && (P.textContent = b);
    let S = Be.querySelector('.dataset-axis-controls'),
      F = ed(x);
    if (S.dataset.signature !== F) {
      let D =
        (document.activeElement instanceof HTMLElement &&
          document.activeElement.closest('[data-nav-key]')?.getAttribute('data-nav-key')) ||
        '';
      (S.replaceChildren(...x.map($ => td($))),
        (S.dataset.signature = F),
        D &&
          S.querySelector(
            `[data-nav-key="${CSS.escape(D)}"] input, [data-nav-key="${CSS.escape(D)}"] select`
          )?.focus());
    }
    x.forEach((D, $) => {
      let W = S.children[$];
      if (!W) return;
      di.set(W, D);
      let K = Math.min(Math.max(0, D.value), Math.max(0, D.size - 1)),
        J = W.querySelector('select');
      if (J) {
        document.activeElement !== J && (J.value = String(K));
        return;
      }
      let se = W.querySelector('input'),
        Re = W.querySelector('.dataset-axis-value');
      if (!se || !Re) return;
      (!(Vr && document.activeElement === se) &&
        document.activeElement !== se &&
        (se.value = String(K)),
        (Re.textContent = `${Number(se.value) + 1} / ${D.size}`));
    });
    let H = Be.querySelector('.dataset-note');
    (H.textContent !== C && (H.textContent = C),
      (H.hidden = !C),
      Vu(Array.from(S.children)),
      Be.classList.toggle('dataset-overlay--loading', y),
      Or(),
      (Be.style.display = c.resolution ? 'grid' : 'flex'));
  }
  let di = new WeakMap();
  function td(c) {
    let f = !!c.labels && c.size > 1,
      b = document.createElement('label');
    ((b.className = f ? 'dataset-series-row' : 'dataset-axis'),
      (b.dataset.navKey = c.key),
      (b.dataset.axis = c.label));
    let y = document.createElement('span');
    ((y.className = 'dataset-axis-label'), (y.textContent = c.label));
    let x = document.createElement('span');
    if (((x.className = 'dataset-axis-hint'), f)) {
      let P = document.createElement('select');
      return (
        (P.tabIndex = -1),
        (P.className = 'dataset-series'),
        P.replaceChildren(
          ...c.labels.map((S, F) => {
            let H = document.createElement('option');
            return ((H.value = String(F)), (H.text = S || `${c.label} ${F + 1}`), H);
          })
        ),
        P.addEventListener('change', () => {
          di.get(b)?.go(Number(P.value));
        }),
        b.append(y, P, x),
        di.set(b, c),
        b
      );
    }
    let C = document.createElement('input');
    ((C.tabIndex = -1),
      (C.type = 'range'),
      (C.min = '0'),
      (C.max = String(Math.max(0, c.size - 1))),
      (C.step = '1'),
      (C.dataset.defaultValue = '0'),
      (C.title = `${c.label} \xB7 Double-click to reset`));
    let R = document.createElement('span');
    return (
      (R.className = 'dataset-axis-value'),
      (R.style.minWidth = `${String(c.size).length * 2 + 3}ch`),
      C.addEventListener('input', () => {
        di.get(b)?.go(Number(C.value));
      }),
      C.addEventListener('pointerdown', () => {
        Vr = !0;
      }),
      b.append(y, C, R, x),
      di.set(b, c),
      b
    );
  }
  function nd() {
    cn = null;
  }
  function hi(c) {
    (c && cn && cn !== c) || ((cn = null), (on = []), Be && (Be.style.display = 'none'));
  }
  function id(c, f = !1) {
    ua({ owner: 'plane', title: oo?.config.formatLabel || 'Image', controls: Fo(c), loading: f });
  }
  function hm(c, f) {
    if (!c || c.size <= 1) return;
    let y = ((Number(ft.indices[c.name] ?? c.value) || 0) + f + c.size) % c.size;
    ((ft.indices = { ...ft.indices, [c.name]: y }), (c.value = y), Xr());
  }
  function Xr() {
    if (Ki) {
      Sr = !0;
      return;
    }
    ((Ki = !0), ad());
  }
  function $o() {
    ((Ki = !1), Sr && ((Sr = !1), Xr()));
  }
  function ad() {
    let c = r.settings.src || '',
      f = r.settings.resourceUri || '';
    if (!c || !f) {
      Ki = !1;
      return;
    }
    (Be?.classList.add('dataset-overlay--loading'),
      pi(c, f, { planeOptions: { indices: { ...ft.indices } }, planeChange: !0 }));
  }
  function rd() {
    let c = r.settings.src || '',
      f = r.settings.resourceUri || '';
    !c ||
      !f ||
      (Be?.classList.add('dataset-overlay--loading'),
      pi(c, f, { netcdfOptions: { ...$t, indices: { ...$t.indices } } }));
  }
  function sd(c, f = !1) {
    ua({ owner: 'netcdf', title: 'NetCDF', controls: Ju(c), loading: f });
  }
  function Ke(c = !1) {
    if (Mt) return;
    if (fe !== 'TIFF') {
      hi('tiff');
      return;
    }
    let f = g.omeMetadata;
    ua({
      owner: 'tiff',
      title: f?.metadataFormat === 'ImageJ' ? 'ImageJ TIFF' : f ? 'OME-TIFF' : 'TIFF',
      controls: Bo(),
      loading: c || mi || Oi > 0,
      resolution: od(),
    });
  }
  function Uo() {
    (Oi++, fe === 'TIFF' && Ke());
  }
  function Ho() {
    ((Oi = Math.max(0, Oi - 1)), fe === 'TIFF' && Ke());
  }
  function od() {
    let c = ld();
    if (!c) return;
    let f = xa(g.pageDirectory),
      b = f.find(S => S.index === g.pageIndex);
    if (!b || b.reduction <= 1) return;
    let y = Ee ? et : dt,
      x = y && f.find(S => S.index === y.level),
      C = x && x.reduction < b.reduction && (!Ee || Ee.loadedSummary(x, y.rect).blocks > 0),
      R = S => (S <= 1 ? '1:1' : `1/${S}`),
      P = f.find(S => S.index === gt(f, b.index));
    return {
      preview: R(b.reduction),
      detail: C ? R(x.reduction) : '',
      description: `${c}. Original: ${P?.width ?? b.width} \xD7 ${P?.height ?? b.height}px. Resolution adjusts automatically as you zoom.`,
    };
  }
  function ld() {
    let c = xa(g.pageDirectory),
      f = Tt(c);
    if (!f && !Ee && !g.isProgressiveRemoteBase) return '';
    let b = gt(c, g.pageIndex),
      y = dn(c, b),
      x = y[0],
      C = c.find(F => F.index === g.pageIndex);
    if (!x || !C) return '';
    let R = C.reduction <= 1 ? 'Full' : `1/${C.reduction}`,
      P = [
        C.generated ? `Generated preview: ${R}` : f ? `Scene overview: ${R}` : `Resolution: ${R}`,
      ];
    if (!Ee && g.isProgressiveRemoteBase) {
      let F = Math.ceil(C.width / Math.max(1, C.blockWidth)),
        H = Math.ceil(C.height / Math.max(1, C.blockHeight));
      P[0] += ` \xB7 0/${F * H} tiles loaded`;
    }
    if (Ee) {
      if (g.isProgressiveRemoteBase) {
        let D = Ee.baseLoadedSummary(C, { x: 0, y: 0, width: C.width, height: C.height });
        D.totalBlocks > 0 &&
          (!f || D.blocks < D.totalBlocks) &&
          (P[0] += ` \xB7 ${D.blocks}/${D.totalBlocks} tiles loaded`);
      }
      let F = et,
        H = F ? y.find(D => D.index === F.level) : void 0;
      if (F && H) {
        let D = Ee.loadedSummary(H, F.rect),
          $ = H.reduction <= 1 ? 'Full' : `1/${H.reduction}`;
        P[0] += ` \xB7 Resolution: ${$}, ${D.blocks} tile${D.blocks === 1 ? '' : 's'}, each ${Math.max(1, H.blockWidth)}x${Math.max(1, H.blockHeight)}px`;
      }
      return P[0];
    }
    let S = dt ? c.find(F => F.index === dt.level) : void 0;
    if (S && S.width > C.width) {
      let F = S.reduction <= 1 ? 'Full' : `1/${S.reduction}`,
        H = dt.rect;
      P[0] += ` \xB7 Resolution: ${F}, 1 tile, each ${H.width}x${H.height}px`;
    }
    return P[0];
  }
  async function Yr(c) {
    if (Tt(g.pageDirectory)) {
      let y = yi(g.pageDirectory);
      if (y.length <= 1) return;
      let x = y.findIndex(C => C.index === gt(g.pageDirectory, g.pageIndex));
      await Rn(y[(x + c + y.length) % y.length].index);
      return;
    }
    let f = g.pageCount;
    if (f <= 1) return;
    let b = (g.pageIndex + c + f) % f;
    await Rn(b);
  }
  async function cd(c, f) {
    let b = g.omeMetadata;
    if (!b) return;
    let y = xi(b, g.pageIndex);
    (c === 'C' ? (y.c = f) : c === 'Z' ? (y.z = f) : (y.t = f), await Rn(os(b, y)));
  }
  let mi = !1,
    Sn = null,
    zo = 0;
  function ud() {
    let c = g.pageDirectory;
    if (!Tt(c)) return 1;
    let f = c.find(b => b.index === g.pageIndex);
    return f ? Math.max(1, f.reduction) : 1;
  }
  function dd() {
    let c = g.pageDirectory,
      f = gt(c, g.pageIndex),
      b = dn(c, f),
      y = b[0];
    return y
      ? g.isProgressiveRemoteBase || g.hasGeneratedPreview || (Tt(c) && y.width * y.height > Jo)
        ? b
        : []
      : [];
  }
  function jo() {
    if (!B || Ee) return;
    let c = dd();
    if (!c.length) return;
    Kt();
    let f = B.parentNode,
      b = B.nextSibling;
    ((Ee = new sr(B, c[0].width, c[0].height)),
      (te = Ee.element),
      f && f.insertBefore(Ee.element, b));
  }
  function Go() {
    if (Ee) {
      (E.setCoordinateScale(1),
        E.setStoredValueResolver((c, f) => g.readFullResolutionPixel(c, f), {
          exactOnly: !0,
          upgradeApproximate: g.hasGeneratedPreview,
          immediateResolver: (c, f) => g.readCachedScenePixel(c, f),
        }));
      return;
    }
    (E.setCoordinateScale(ud()), E.setStoredValueResolver((c, f) => g.readStoredPixel(c, f)));
  }
  let ut = null,
    dt = null,
    qr = -1,
    Wo = -1,
    da = !1,
    ha = !1;
  function Kt() {
    let c = !!dt;
    (ut?.remove(), (ut = null), (dt = null), c && Ke());
  }
  async function fi() {
    if (Ee) {
      await Kr();
      return;
    }
    let c = te,
      f = g.pageDirectory;
    if (!c || !Me || an) return;
    if (!Tt(f)) {
      Kt();
      return;
    }
    let b = gt(f, g.pageIndex),
      y = dn(f, b),
      x = f.find(J => J.index === g.pageIndex);
    if (!x || !y.length) {
      Kt();
      return;
    }
    let C = as(f, b, Jr()),
      R = dt ? f.find(J => J.index === dt.level) : void 0;
    if (!C || C.width <= x.width) {
      R && R.width > x.width ? ma(c, x, R, c.clientWidth / x.width) : Kt();
      return;
    }
    let P = c.clientWidth / x.width,
      S = C.width / x.width,
      F = c.getBoundingClientRect(),
      H = us(
        { imageWidth: x.width, imageHeight: x.height },
        Math.min(window.innerWidth, F.width),
        Math.min(window.innerHeight, F.height),
        P,
        Math.max(0, -F.left),
        Math.max(0, -F.top)
      ),
      D = {
        imageWidth: C.width,
        imageHeight: C.height,
        blockWidth: C.blockWidth,
        blockHeight: C.blockHeight,
      },
      $ = { x: H.x * S, y: H.y * S, width: H.width * S, height: H.height * S },
      W = fl(D, $, dt?.level === C.index ? dt.rect : null);
    if (W.kind === 'keep') {
      ma(c, x, C, P);
      return;
    }
    if (W.kind === 'whole-page') {
      R && R.width > x.width ? ma(c, x, R, P) : Kt();
      return;
    }
    let K = ++qr;
    ((Wo = ie), Uo());
    try {
      let J = await g.renderRegion(C.index, W.rect);
      if (!J || K !== qr || ie !== Wo) return;
      (ut ||
        ((ut = document.createElement('canvas')),
        (ut.className = 'detail-patch'),
        ge.appendChild(ut)),
        (ut.width = J.width),
        (ut.height = J.height));
      let se = ut.getContext('2d');
      if (!se) {
        Kt();
        return;
      }
      se.putImageData(J, 0, 0);
      let Re = dt?.level !== C.index;
      ((dt = { level: C.index, rect: W.rect }), ma(c, x, C, P), Ke());
      let Te = `[Detail] ${Xn(C)} over ${W.rect.width}x${W.rect.height} at ${W.rect.x},${W.rect.y}`;
      Re ? ct(Te) : console.log(Te);
    } finally {
      Ho();
    }
  }
  async function Kr() {
    let c = Ee;
    if (!c || !Me || an) return;
    if (da) {
      ha = !0;
      return;
    }
    let f = xa(g.pageDirectory),
      b = gt(f, g.pageIndex),
      y = dn(f, b),
      x = f.find(we => we.index === g.pageIndex),
      C = as(f, b, Jr());
    if (!x || !C) return;
    let R = g.isProgressiveRemoteBase && C.index === x.index;
    if (C.width <= x.width && !R) {
      ((et = null), c.tileCount && (c.clearTiles(), Ke()));
      return;
    }
    let P = c.element.getBoundingClientRect(),
      S = c.sceneScale();
    if (!(S > 0)) return;
    let F = us(
        { imageWidth: c.fullWidth, imageHeight: c.fullHeight },
        Math.min(window.innerWidth, P.width),
        Math.min(window.innerHeight, P.height),
        S,
        Math.max(0, -P.left),
        Math.max(0, -P.top)
      ),
      H = Math.max(1, C.reduction),
      D = { x: F.x / H, y: F.y / H, width: F.width / H, height: F.height / H },
      $ = ds(D, {
        imageWidth: C.width,
        imageHeight: C.height,
        blockWidth: C.blockWidth,
        blockHeight: C.blockHeight,
      });
    if (!R && C.sourceIndex === void 0 && (D.width * D.height) / (C.width * C.height) >= 0.6) {
      ((et = null), c.tileCount && (c.clearTiles(), Ke()));
      return;
    }
    if (!R && !c.canRetain(C, D)) {
      ((et = null), c.tileCount && c.clearTiles(), Ke());
      return;
    }
    let W = R ? c.missingBaseRects(C, D) : c.missingRects(C, D);
    if (!W.length) {
      (R || ((et = { level: C.index, rect: $ }), c.retainOnlyLevel(C.index)), Ke());
      return;
    }
    if (!R) {
      let we = c.loadedBounds(C, D);
      we && (et = { level: C.index, rect: we });
    }
    let K =
        g.isRemoteSource ||
        (g.hasGeneratedPreview && C.blockWidth === C.width && C.blockWidth * C.blockHeight <= 8e6),
      J = K
        ? W
        : [
            {
              x: Math.min(...W.map(we => we.x)),
              y: Math.min(...W.map(we => we.y)),
              width: Math.max(...W.map(we => we.x + we.width)) - Math.min(...W.map(we => we.x)),
              height: Math.max(...W.map(we => we.y + we.height)) - Math.min(...W.map(we => we.y)),
            },
          ];
    da = !0;
    let se = ie,
      Re = ii,
      Te = new AbortController();
    ((ai = Te), Uo());
    try {
      let we = zo || performance.now(),
        ze = 0,
        Lt = 0,
        ba = async nt => {
          let bi;
          if (C.sourceIndex !== void 0) {
            let On = f.find(Ed => Ed.index === C.sourceIndex),
              Vn = C.reduction,
              Rd = {
                x: nt.x * Vn,
                y: nt.y * Vn,
                width: Math.min(nt.width * Vn, On.width - nt.x * Vn),
                height: Math.min(nt.height * Vn, On.height - nt.y * Vn),
              },
              Yo = await g.renderRegion(On.index, Rd, Te.signal);
            bi = Yo && !Te.signal.aborted ? hd(Yo, nt.width, nt.height) : null;
          } else
            bi = g.isRemoteSource
              ? await g.renderRegionCanvas(C.index, nt, Te.signal)
              : await g.renderRegion(C.index, nt, Te.signal);
          if (!(c !== Ee || se !== ie || Te.signal.aborted) && bi) {
            if (R) c.commitBaseRegion(C, nt, bi);
            else {
              c.commitRegion(C, nt, bi);
              let On = c.loadedBounds(C, D);
              On && (et = { level: C.index, rect: On });
            }
            (ze || (ze = performance.now() - we),
              E.refreshAtPointer(),
              Ke(),
              console.log(`[Tiles] painted ${Xn(C)} ${nt.width}x${nt.height} at ${nt.x},${nt.y}`));
          }
        };
      R && !g._lastStatistics && J.length && (await ba(J[Lt++]));
      let kd = async () => {
          for (; Lt < J.length && Re === ii && !Te.signal.aborted;) await ba(J[Lt++]);
        },
        Sd = Math.min(
          J.length,
          g.isRemoteSource ? qo(C.blockWidth, C.blockHeight, C.samplesPerPixel) : K ? 4 : 1
        );
      (await Promise.all(Array.from({ length: Sd }, () => kd())),
        ze &&
          !Te.signal.aborted &&
          requestAnimationFrame(() =>
            setTimeout(() => {
              c === Ee &&
                Re === ii &&
                ct(
                  `[Refine] first commit ${ze.toFixed(0)}ms | visible ${(performance.now() - we).toFixed(0)}ms | ${J.length} regions`
                );
            }, 0)
          ),
        !R &&
          Re === ii &&
          !c.missingRect(C, D) &&
          ((et = { level: C.index, rect: $ }), c.retainOnlyLevel(C.index)),
        Ke());
    } finally {
      (ai === Te && ((ai = null), (da = !1), ha && ((ha = !1), Kr())), Ho());
    }
  }
  function hd(c, f, b) {
    let y = document.createElement('canvas');
    ((y.width = c.width), (y.height = c.height));
    let x = document.createElement('canvas');
    ((x.width = f), (x.height = b));
    let C = y.getContext('2d'),
      R = x.getContext('2d');
    if (!C || !R) return null;
    (C.putImageData(c, 0, 0),
      (R.imageSmoothingEnabled = !0),
      (R.imageSmoothingQuality = 'high'),
      R.drawImage(y, 0, 0, f, b));
    let P = R.getImageData(0, 0, f, b);
    return ((y.width = y.height = x.width = x.height = 0), P);
  }
  function ma(c, f, b, y) {
    if (!ut || !dt) return;
    let x = dt.rect,
      C = b.width / f.width,
      R = c.getBoundingClientRect(),
      P = R.left + window.scrollX + (x.x / C) * y,
      S = R.top + window.scrollY + (x.y / C) * y;
    ((ut.style.left = `${P}px`),
      (ut.style.top = `${S}px`),
      (ut.style.width = `${(x.width / C) * y}px`),
      (ut.style.height = `${(x.height / C) * y}px`));
  }
  function Jr() {
    return (te?.clientWidth || B?.width || 0) * (window.devicePixelRatio || 1);
  }
  async function md(c, f) {
    if (mi || c.index === g.pageIndex) return;
    let b = g.pageDirectory.find(x => x.index === g.pageIndex),
      y = b && c.width > 0 ? b.width / c.width : 1;
    ((mi = !0), ct(`[Level] ${f}: ${Xn(c)}`));
    try {
      await Rn(c.index, { scaleMultiplier: y });
    } finally {
      mi = !1;
    }
  }
  function fd() {
    if (Ee || mi || !Me || an || oi) return;
    let c = g.pageDirectory;
    if (!Tt(c)) return;
    let f = gt(c, g.pageIndex),
      b = dn(c, f),
      y = c.find(C => C.index === g.pageIndex);
    if (!y) return;
    let x = Zo(c, f, g.pageIndex, Jr(), ea, rs);
    x && md(x, x.width > y.width ? 'zoomed in, refining to' : 'zoomed out, dropping to');
  }
  function Zr() {
    ((zo = performance.now()),
      Sn !== null && window.clearTimeout(Sn),
      (Sn = window.setTimeout(
        () => {
          ((Sn = null), Tt(g.pageDirectory) && Ke(), fd(), fi());
        },
        Ee ? 80 : 250
      )));
  }
  function pd(c) {
    let f = dn(g.pageDirectory, gt(g.pageDirectory, c));
    for (let b of f) if (ea(b.width, b.height)) return b;
    return null;
  }
  async function Rn(c, f = {}) {
    if (g.hasGeneratedPreview) return;
    let b = g.pageCount;
    if (c < 0 || c >= b || c === g.pageIndex) return;
    let y = r.settings.src || '';
    if (!y) return;
    let x = ++ie;
    (wr(),
      (Ve = performance.now()),
      (De = Date.now()),
      (st = k.getCurrentState()),
      (Xi = f.scaleMultiplier ?? null),
      wt?.abort(),
      ve.cancelActiveDecodes(),
      Ae.cancelActiveDecodes(),
      _e.cancelActiveDecodes(),
      le.cancelActiveDecodes(),
      (wt = new AbortController()));
    for (let C of ye) C.loadSignal = wt.signal;
    (Mr(),
      Eo(!1),
      gt(g.pageDirectory, c) !== gt(g.pageDirectory, g.pageIndex) && Kt(),
      (g.pageIndex = c),
      (g._isInitialLoad = !0),
      (g._pendingRenderData = null),
      (g.rawTiffData = null),
      (g._lastStatistics = null),
      (g._convertedFloatData = null),
      (Me = !1),
      (B = null),
      (te = null),
      (Ee = null),
      (et = null),
      Dt(),
      (Y = null),
      Ke(!0),
      Xt(),
      await bo(y, x, c, { chooseLevel: !1 }));
  }
  function gd() {
    ((Ge = document.createElement('div')),
      Ge.classList.add('filename-badge'),
      (Ge.style.display = 'none'),
      document.body.appendChild(Ge),
      Oo(r.settings.resourceUri || ''));
    let c = null,
      f = Ge;
    (f.addEventListener('mouseenter', () => {
      let b = f.dataset.tooltip;
      if (!b) return;
      ((c = document.createElement('div')),
        (c.className = 'filename-tooltip'),
        (c.textContent = b),
        document.body.appendChild(c));
      let y = f.getBoundingClientRect();
      ((c.style.left = y.left + 'px'), (c.style.bottom = window.innerHeight - y.top + 6 + 'px'));
    }),
      f.addEventListener('mouseleave', () => {
        (c?.remove(), (c = null));
      }));
  }
  function Oo(c) {
    if (!Ge || !c) return;
    let f = decodeURIComponent(c),
      y = (f.split(/[/\\]/).filter(Boolean).pop() || f).split('?')[0],
      x = f.replace(/^[a-z-]+:\/\/[^/]*/i, '').split('?')[0];
    ((Ge.textContent = y), (Ge.dataset.tooltip = x));
    let C = document.querySelector('.filename-tooltip');
    C && (C.textContent = x);
  }
  function Vo(c) {
    if (Ye)
      if (((He = c), c.show && c.totalImages > 1)) {
        if (Cn) ((Cn.value = String(c.currentIndex + 1)), Cn.select());
        else {
          let f = Ye.querySelector('.image-counter');
          f && (f.textContent = `${c.currentIndex + 1} of ${c.totalImages}`);
        }
        ((Ye.style.display = 'block'), Ge && (Ge.style.display = 'block'), Hr());
      } else ((Ye.style.display = 'none'), Ge && (Ge.style.display = Mt ? 'block' : 'none'));
  }
  function bd() {
    let c = r.settings.resourceUri;
    if (!c || !Me) return;
    let f = An(c, r.settings.formatHint)?.kind,
      b = null;
    (f === 'tiff' && g.rawTiffData
      ? (b = {
          resourceUri: c,
          cacheKey: `${c}#tiff-page=${g.pageIndex}`,
          format: 'tiff',
          raw: {
            tiffData: g.rawTiffData,
            lastStatistics: g._lastStatistics,
            lastStatisticsRgb24Mode: g._lastStatisticsRgb24Mode,
            convertedFloatData: g._convertedFloatData,
            pageIndex: g.pageIndex,
            pageCount: g.pageCount,
            displayBand: g.displayBand,
            displayRgbBands: g.displayRgbBands,
            geoReference: g.geoReference,
            pageDirectory: g.pageDirectory,
            formatInfo: d ? { ...d } : null,
          },
        })
      : f === 'exr' && w.rawExrData
        ? (b = { resourceUri: c, cacheKey: c, format: 'exr', raw: w.rawExrData })
        : f === 'npy' && L._lastRaw
          ? (b = { resourceUri: c, cacheKey: c, format: 'npy', raw: L._lastRaw })
          : f === 'pfm' && M._lastRaw
            ? (b = { resourceUri: c, cacheKey: c, format: 'pfm', raw: M._lastRaw })
            : f === 'netpbm' && T._lastRaw
              ? (b = { resourceUri: c, cacheKey: c, format: 'ppm', raw: T._lastRaw })
              : f === 'png' && _._lastRaw && _._lastRaw.bitDepth > 8
                ? (b = { resourceUri: c, cacheKey: c, format: 'png', raw: _._lastRaw })
                : f === 'hdr' && I._lastRaw
                  ? (b = { resourceUri: c, cacheKey: c, format: 'hdr', raw: I._lastRaw })
                  : j._lastRaw &&
                    (Mt?.kind === 'dicom' || f === 'dicom') &&
                    (b = {
                      resourceUri: c,
                      cacheKey: `${c}#dicom-frame=${Number(j.metadata.frameIndex || 0)}`,
                      format: 'dicom',
                      raw: { image: j._lastRaw, metadata: { ...j.metadata } },
                    }),
      (vr = b));
  }
  function un(c, f) {
    ((B = document.createElement('canvas')),
      (B.width = c),
      (B.height = f),
      B.classList.add('scale-to-fit'),
      (Y = new ImageData(c, f)),
      (te = B),
      (Me = !0),
      ne.mark('decoded-cache-hit'));
  }
  function yd(c) {
    p.postMessage({
      type: 'formatInfo',
      value: {
        width: c.width,
        height: c.height,
        channels: c.channels,
        samplesPerPixel: c.channels,
        dataType: c.type === 1016 ? 'float16' : 'float32',
        isHdr: !0,
        formatLabel: 'EXR',
        formatType: 'exr-float',
        isInitialLoad: !0,
        channelNames: c.channelNames || [],
        displayedChannels: c.displayedChannels || c.channelNames || [],
      },
    });
  }
  function vd(c, f, b = 0, y = 0) {
    let x = xr,
      C = An(c, f)?.kind,
      R =
        C === 'tiff'
          ? `${c}#tiff-page=${b}`
          : C === 'dicom' || Mt?.kind === 'dicom'
            ? `${c}#dicom-frame=${y}`
            : c;
    if (!x || x.cacheKey !== R) return !1;
    let P = x.raw;
    switch (((Xe = null), x.format)) {
      case 'tiff': {
        let S = P.tiffData,
          F = S?.image,
          H = S?.rasters;
        if (!F || !H) return !1;
        ((fe = 'TIFF'),
          (Xe = { engine: 'decoded-cache', durationMs: 0 }),
          (g.rawTiffData = S),
          (g.displayBand = Math.max(0, Number(P.displayBand || 0))),
          (g.displayRgbBands = P.displayRgbBands || null),
          (g._lastStatistics = P.lastStatistics || null),
          (g._lastStatisticsRgb24Mode = P.lastStatisticsRgb24Mode === !0),
          (g._convertedFloatData = P.convertedFloatData || null),
          (g.pageIndex = Number(P.pageIndex || 0)),
          (g.pageCount = Math.max(1, Number(P.pageCount || 1))),
          (g.pageDirectory = Array.isArray(P.pageDirectory) ? P.pageDirectory : []),
          (g.omeMetadata = S.ome || null));
        let D = g.omeMetadata;
        (E.setPhysicalPixelSize(
          D
            ? {
                x: D.physicalSizeX,
                y: D.physicalSizeY,
                xUnit: D.physicalSizeXUnit,
                yUnit: D.physicalSizeYUnit,
              }
            : null
        ),
          (g.geoReference = P.geoReference || null),
          E.setGeoReference(g.geoReference),
          Ke(),
          (g._lastRenderHistogram = null),
          (g._lastRenderUsedWebGL = !1),
          (g._isInitialLoad = !0),
          (g._pendingRenderData = { image: F, rasters: H }),
          un(F.getWidth(), F.getHeight()));
        let $ = F.getSampleFormat?.(),
          W = F.getBitsPerSample?.(),
          K = F.getSamplesPerPixel?.(),
          J = Array.isArray($) ? $[0] : $;
        return (
          p.postMessage({
            type: 'formatInfo',
            value: {
              width: F.getWidth(),
              height: F.getHeight(),
              sampleFormat: $,
              samplesPerPixel: K,
              bitsPerSample: W,
              planarConfig: S.ifd?.t284 ?? 1,
              formatType: Ko(J, W),
              ...(P.formatInfo || {}),
              isInitialLoad: !0,
              decodedWith: 'decoded-cache',
              ...g._omeFormatInfo(),
            },
          }),
          !0
        );
      }
      case 'exr':
        return (
          (fe = 'EXR'),
          (w.rawExrData = P),
          (w._cachedStats = void 0),
          (w._isInitialLoad = !0),
          (w._pendingRenderData = {
            width: P.width,
            height: P.height,
            data: P.data,
            channels: P.channels,
            type: P.type,
            format: P.format,
          }),
          un(P.width, P.height),
          yd(P),
          !0
        );
      case 'npy':
        return (
          (fe = 'NPY/NPZ'),
          (L._lastRaw = P),
          (L._cachedStats = void 0),
          (L._cachedStatsRgb24Mode = !1),
          (L._isInitialLoad = !0),
          (L._pendingRenderData = { data: P.data, width: P.width, height: P.height }),
          un(P.width, P.height),
          L._postFormatInfo(P.width, P.height, 'NPY'),
          !0
        );
      case 'pfm':
        return (
          (fe = 'PFM'),
          (M._lastRaw = P),
          (M._cachedStats = void 0),
          (M._isInitialLoad = !0),
          (M._pendingRenderData = {
            displayData: P.data,
            width: P.width,
            height: P.height,
            channels: P.channels,
          }),
          un(P.width, P.height),
          M._postFormatInfo(P.width, P.height, P.channels, 'PFM'),
          !0
        );
      case 'ppm':
        return (
          (fe = 'PPM/PGM'),
          (T._lastRaw = P),
          (T._cachedStats = void 0),
          (T._cachedStatsRgb24Mode = !1),
          (T._isInitialLoad = !0),
          (T._pendingRenderData = {
            displayData: P.data,
            width: P.width,
            height: P.height,
            maxval: P.maxval,
            channels: P.channels,
          }),
          un(P.width, P.height),
          T._postFormatInfo(P.width, P.height, P.channels, P.format || 'PPM/PGM', P.maxval),
          !0
        );
      case 'png':
        return (
          (fe = 'PNG/JPEG'),
          (_._lastRaw = P),
          (_._cachedStats = void 0),
          (_._cachedStatsRgb24Mode = !1),
          (_._isInitialLoad = !0),
          (_._pendingRenderData = !0),
          un(P.width, P.height),
          _._postFormatInfo(P.width, P.height, P.channels, P.bitDepth, 'PNG'),
          !0
        );
      case 'hdr':
        return (
          (fe = 'HDR'),
          (I._lastRaw = P),
          (I._cachedStats = void 0),
          (I._cachedWebglRgb = null),
          (I._isInitialLoad = !0),
          (I._pendingRenderData = {
            data: P.data,
            width: P.width,
            height: P.height,
            renderChannels: P.channels,
          }),
          un(P.width, P.height),
          I._postFormatInfo(P.width, P.height, 3, 'HDR'),
          !0
        );
      case 'dicom': {
        let S = P.image;
        return S?.data
          ? ((fe = 'DICOM'),
            (j._lastRaw = S),
            (j.metadata = P.metadata || {}),
            (j._cachedStats = void 0),
            (j._isInitialLoad = !0),
            (j._pendingRenderData = {
              displayData: S.data,
              width: S.width,
              height: S.height,
              channels: S.channels,
            }),
            un(S.width, S.height),
            j._postScientificFormatInfo({ ...S, metadata: j.metadata }),
            !0)
          : !1;
      }
      default:
        return !1;
    }
  }
  function pi(c, f, b = {}) {
    let y = ++ie;
    (wr(), (Ve = performance.now()));
    let x = !!b.planeChange,
      C = f.split('/').pop() || 'image';
    try {
      C = decodeURIComponent(C);
    } catch {}
    (ne.begin(x ? `plane ${C}` : `switch ${C}`),
      x || ((xr = vr), bd(), Eo(!0)),
      wt && wt.abort(),
      x ||
        (ve.cancelActiveDecodes(),
        Ae.cancelActiveDecodes(),
        _e.cancelActiveDecodes(),
        le.cancelActiveDecodes(),
        Mr()),
      (wt = new AbortController()));
    for (let R of ye) R.loadSignal = wt.signal;
    if (
      ((r.settings.resourceUri = f),
      (r.settings.src = c),
      (r.settings.formatHint = b.formatHint),
      (r.settings.remoteTiffUrl = lu(f, b.formatHint)),
      x ||
        (nd(),
        (g.pageIndex = Math.max(0, Number(b.pageIndex || 0))),
        (g.pageCount = 1),
        Ke(),
        Oo(f),
        Hr(),
        Ge && Ge.classList.add('filename-badge--loading')),
      (Me = !1),
      (B = null),
      (te = null),
      (Ee = null),
      (et = null),
      Dt(),
      (Y = null),
      E.setPhysicalPixelSize(null),
      E.setGeoReference(null),
      E.setCoordinateScale(1),
      E.setStoredValueResolver(null),
      x || zi(),
      !x)
    )
      for (let R of ye) R._isInitialLoad = !0;
    if (!x) {
      ((g.rawTiffData = null),
        (g._lastStatistics = null),
        (g._convertedFloatData = null),
        (w.rawExrData = void 0),
        (w._cachedStats = void 0));
      let R = [w, L, M, T, _, I, A, N, ...re];
      for (let P of R) P._lastRaw = null;
      (ee.reset(), (Wi = void 0), Gn());
    }
    if (!x) {
      for (let R of ye) R._pendingRenderData = null;
      _._lazyNativeReadback = null;
    }
    Qr(c, f, y, b.formatHint, b.pageIndex, b.frameIndex, b.netcdfOptions, b.planeOptions, x);
  }
  async function Qr(c, f, b, y, x, C, R, P, S = !1) {
    let F = an || S;
    if (
      (F &&
        (await new Promise(se => {
          (requestAnimationFrame(() => setTimeout(se, 0)), setTimeout(se, 100));
        })),
      b !== ie)
    )
      return;
    ne.mark(F ? 'paint-yield' : 'load-start');
    let H = f.toLowerCase(),
      D = An(f, y),
      $ = (D?.kind === 'layered' ? D.layeredFormat : null) || eo(H);
    if (
      (D &&
        [
          'tiff',
          'exr',
          'npy',
          'pfm',
          'netpbm',
          'hdr',
          'jxr',
          'jp2',
          'jxl',
          'fits',
          'dicom',
          'netcdf',
          'czi',
          'nd2',
          'lif',
          'sdt',
        ].includes(D.kind) &&
        (await Ce(D.kind), b !== ie)) ||
      (!S && vd(f, y, Number(x || 0), Number(C || 0)))
    )
      return;
    (!D || !['tiff', 'dicom', 'netcdf', 'czi', 'nd2', 'lif', 'sdt'].includes(D.kind)) && hi();
    let K = D?.kind === 'netpbm' && H.endsWith('.pgm');
    if (
      (D?.kind === 'pfm' ||
      (D?.kind === 'netpbm' && H.endsWith('.ppm')) ||
      (D?.kind === 'npy' && H.endsWith('.npy'))
        ? le.start()
        : D && !K && !['png', 'tga', 'web-image'].includes(D.kind) && ve.start(),
      D?.kind === 'layered' && $)
    )
      Ru($, c, b);
    else if (D?.kind === 'tiff') bo(c, b, x);
    else if (D?.kind === 'exr') ku(c, b);
    else if (D?.kind === 'pfm') Su(c, b);
    else if (D?.kind === 'netpbm') Eu(c, b);
    else if (D?.kind === 'png') Lu(c, b);
    else if (D?.kind === 'npy') Tu(c, b);
    else if (D?.kind === 'hdr') _u(c, b);
    else if (D?.kind === 'tga') Pu(c, b);
    else if (D?.kind === 'web-image') Iu(c, b);
    else if (D?.kind === 'jxl') Ht(X, c, b);
    else if (D?.kind === 'jxr') Ht(ae, c, b);
    else if (D?.kind === 'jp2') Ht(Q, c, b);
    else if (D?.kind === 'fits') Ht(z, c, b);
    else if (D?.kind === 'dicom') Ht(j, c, b, { frameIndex: Number(C || 0) });
    else if (D?.kind === 'netcdf') Ht(q, c, b, R || $t);
    else if (D?.kind === 'czi') Ht(oe, c, b, P || ft);
    else if (D?.kind === 'nd2') Ht(U, c, b, P || ft);
    else if (D?.kind === 'lif') Ht(Z, c, b, P || ft);
    else if (D?.kind === 'sdt') Ht(G, c, b, P || ft);
    else {
      let se = document.createElement('img');
      (se.classList.add('scale-to-fit'),
        (se.src = c),
        se.addEventListener('load', () => {
          if (b !== ie) return;
          ((B = document.createElement('canvas')),
            (B.width = se.naturalWidth),
            (B.height = se.naturalHeight),
            B.classList.add('scale-to-fit'));
          let Re = B.getContext('2d');
          (Re && Re.drawImage(se, 0, 0), (te = B), at());
        }),
        se.addEventListener('error', () => {
          b === ie && Je();
        }));
    }
  }
  async function xd() {
    if (O.active && O.hasCompositeStack()) {
      let f = await de.compose(O.layers, O.canvasWidth, O.canvasHeight, 1),
        b = f
          ? O.renderCompositeToImageData(f, r.settings, { nanColor: Hn() })
          : O.renderToImageData(r.settings, { nanColor: Hn() });
      if (b) {
        let y = document.createElement('canvas');
        ((y.width = b.width), (y.height = b.height));
        let x = y.getContext('2d');
        if (x) {
          x.putImageData(b, 0, 0);
          let C = x.getImageData(0, 0, y.width, y.height);
          return (y.remove(), C);
        }
      }
    }
    let c = te?.tagName === 'IMG' ? te : null;
    if (c) {
      let f = document.createElement('canvas');
      ((f.width = c.naturalWidth), (f.height = c.naturalHeight));
      let b = f.getContext('2d');
      if (b) {
        b.drawImage(c, 0, 0);
        let y = b.getImageData(0, 0, f.width, f.height);
        return (f.remove(), y);
      }
    } else if (B) {
      let f = B.getContext('2d');
      return f ? f.getImageData(0, 0, B.width, B.height) : null;
    } else if (lt && lt.src) {
      let f = document.createElement('canvas');
      ((f.width = lt.naturalWidth), (f.height = lt.naturalHeight));
      let b = f.getContext('2d');
      if (b) {
        b.drawImage(lt, 0, 0);
        let y = b.getImageData(0, 0, f.width, f.height);
        return (f.remove(), y);
      }
    }
    return null;
  }
  async function wd(c) {
    try {
      let f = await xd();
      if (!f) throw new Error('The current image has no rendered pixels to export');
      if (c !== 'png' && !O.hasCompositeStack())
        throw new Error(`${c.toUpperCase()} layered export requires an active Layers composition`);
      let b = (await n()).writeLayerDocument(c, O.layers, f.width, f.height, f),
        y = '';
      for (let x = 0; x < b.data.length; x += 32768)
        y += String.fromCharCode(...b.data.subarray(x, Math.min(b.data.length, x + 32768)));
      p.postMessage({
        type: 'didExportLayerDocument',
        format: c,
        payload: btoa(y),
        warnings: b.warnings,
      });
    } catch (f) {
      p.postMessage({
        type: 'didExportLayerDocument',
        format: c,
        error: f instanceof Error ? f.message : String(f),
        warnings: [],
      });
    }
  }
  function En(c, f = 'success') {
    let b = document.querySelector('.copy-notification');
    b && b.remove();
    let y = document.createElement('div');
    ((y.className = `copy-notification copy-notification-${f}`),
      (y.textContent = c),
      document.body.appendChild(y),
      f === 'success' &&
        setTimeout(() => {
          (y.classList.add('copy-notification-fadeout'),
            setTimeout(() => {
              y.parentElement && y.remove();
            }, 300));
        }, 3e3),
      y.addEventListener('click', () => {
        (y.classList.add('copy-notification-fadeout'),
          setTimeout(() => {
            y.parentElement && y.remove();
          }, 300));
      }));
  }
  async function es() {
    if (!B) return;
    if (!document.hasFocus() && 5 > 0) {
      setTimeout(() => {
        es();
      }, 20);
      return;
    }
    if (!B && (!lt || !lt.naturalWidth)) {
      (En('No image loaded to copy', 'error'), console.error('Copy failed: No image available'));
      return;
    }
    if (B && te) {
      let f = k.getCurrentState(),
        b = B.width,
        y = B.height,
        x,
        C;
      if (f.scale === 'fit') ((x = b / 2), (C = y / 2));
      else {
        let R = b * f.scale,
          P = y * f.scale,
          S = te.getBoundingClientRect(),
          F = window.scrollX + S.left,
          H = window.scrollY + S.top,
          D = window.scrollX + ge.clientWidth / 2,
          $ = window.scrollY + ge.clientHeight / 2;
        ((x = (D - F) / f.scale),
          (C = ($ - H) / f.scale),
          (x = Math.max(0, Math.min(b, x))),
          (C = Math.max(0, Math.min(y, C))));
      }
      ((Un = {
        relativeX: x / b,
        relativeY: C / y,
        scale: f.scale,
        sourceWidth: b,
        sourceHeight: y,
      }),
        p.postMessage({ type: 'positionCopied', state: Un }),
        console.log('Position copied:', Un));
    }
    try {
      (await navigator.clipboard.write([
        new ClipboardItem({
          'image/png': new Promise((b, y) => {
            let x = document.createElement('canvas'),
              C = x.getContext('2d');
            if (!C) return y(new Error('Could not get canvas context'));
            let R = te?.tagName === 'IMG' ? te : B || lt,
              P = R.naturalWidth || R.width,
              S = R.naturalHeight || R.height;
            ((x.width = P),
              (x.height = S),
              C.drawImage(R, 0, 0),
              x.toBlob(F => {
                (F ? b(F) : y(new Error('Could not create blob')), x.remove());
              }, 'image/png'));
          }),
        }),
      ]),
        En(`Image${Un ? ' + position' : ''} copied to clipboard`, 'success'));
    } catch (f) {
      (console.error('Copy failed:', f), En(`Failed to copy image: ${f.message}`, 'error'));
    }
  }
  function Md(c) {
    let f = c || Un;
    if (!f) {
      En('No position copied. Copy an image first (Ctrl+C)', 'error');
      return;
    }
    if (!B || !te || !Me) {
      En('No image loaded to apply position to', 'error');
      return;
    }
    let b = B.width,
      y = B.height,
      x = f.sourceWidth,
      C = f.sourceHeight,
      R = f.relativeX * b,
      P = f.relativeY * y,
      S = f.scale;
    if (S !== 'fit') {
      let H = b / x,
        D = y / C,
        $ = Math.sqrt(H * D);
      S = f.scale * $;
      let W = r.constants;
      S = Math.max(W.MIN_SCALE, Math.min(W.MAX_SCALE, S));
    }
    S === 'fit'
      ? k.updateScale('fit')
      : (k.updateScale(S),
        setTimeout(() => {
          if (!te) return;
          let H = te.getBoundingClientRect(),
            D = window.scrollX + H.left,
            $ = window.scrollY + H.top,
            W = D + R * S,
            K = $ + P * S,
            J = W - ge.clientWidth / 2,
            se = K - ge.clientHeight / 2,
            Re = Math.max(0, document.documentElement.scrollWidth - ge.clientWidth),
            Te = Math.max(0, document.documentElement.scrollHeight - ge.clientHeight);
          window.scrollTo(Math.max(0, Math.min(Re, J)), Math.max(0, Math.min(Te, se)));
        }, 50));
    let F = x === b && C === y;
    if (F) En('Position applied', 'success');
    else {
      let H = Math.round((b / x) * 100);
      En(`Position applied (scaled to ${H}% size)`, 'success');
    }
    console.log('Position pasted:', {
      targetCenter: { x: R, y: P },
      targetScale: S,
      sameSize: F,
      sourceSize: { w: x, h: C },
      targetSize: { w: b, h: y },
    });
  }
  function mm() {
    return Un !== null;
  }
  async function ts(c) {
    try {
      (p.postMessage({ type: 'show-loading' }), Nt.includes(c) || Nt.push(c));
      let f = c.toLowerCase(),
        b;
      if (f.includes('.exr')) {
        let y = w.rawExrData,
          x = w._cachedStats;
        ((b = await w.processExr(c)),
          (ri = b.imageData),
          (gr = w.rawExrData),
          (br = w._cachedStats),
          (w.rawExrData = y),
          (w._cachedStats = x));
      } else {
        let y = g.rawTiffData,
          x = g._lastStatistics;
        ((b = await g.processTiff(c)),
          (ri = b.imageData),
          (fr = g.rawTiffData),
          (pr = g._lastStatistics),
          (g.rawTiffData = y),
          (g._lastStatistics = x));
      }
      (Xt(), p.postMessage({ type: 'comparison-ready' }));
    } catch (f) {
      (console.error('Failed to load peer image for comparison:', f),
        p.postMessage({ type: 'show-error', message: 'Failed to load comparison image.' }));
    }
  }
  let fa = '',
    gi = '',
    pa = '',
    ga = 1,
    ns = 0,
    Wn = null,
    Cd = a.postMessage.bind(a);
  a.postMessage = c => {
    if (
      (c.type === 'pixelFocus' && (pa = String(c.value || '')),
      c.type === 'pixelBlur' && (pa = ''),
      c.type === 'registerDicomFrames' && (ga = Number(c.frames) || 1),
      (c.type === 'show-error' || c.type === 'error') &&
        (gi = String(c.message || c.value || 'Image decoding failed')),
      c.type === 'formatInfo' && c.value?.isInitialLoad)
    ) {
      let f = ie;
      setTimeout(async () => {
        let b = performance.now() + 6e4;
        for (; !B && f === ie && performance.now() < b;) await new Promise(y => setTimeout(y, 10));
        f === ie &&
          B &&
          (await jn({ type: 'updateSettings', settings: r.settings, isInitialRender: !0 }));
      }, 0);
    }
    Cd(c);
  };
  function Xo() {
    if (fe === 'DICOM' && ga > 1)
      return [
        {
          key: 'frame',
          label: 'Frame',
          size: ga,
          value: ns,
          go: b => {
            ((ns = b), pi(r.settings.src, r.settings.resourceUri, { frameIndex: b }));
          },
        },
      ];
    if (fe === 'TIFF') return Bo();
    let f = ye.find(b => b.config?.formatLabel === fe)?._lastRaw?.metadata;
    return f?.selectors ? Fo(f) : [];
  }
  function is() {
    if ((k.updateScale('fit'), !B || !te)) return;
    let c = Math.min((innerWidth - 32) / B.width, (innerHeight - 32) / B.height);
    ((te.style.width = `${B.width * c}px`), (te.style.height = `${B.height * c}px`));
  }
  (window.addEventListener('resize', () => {
    k.getCurrentState().scale === 'fit' && is();
  }),
    (window.desktopImage = {
      fit: is,
      async open(c) {
        ((gi = ''),
          (Wn = null),
          (ga = 1),
          (ns = 0),
          (pa = ''),
          fa && URL.revokeObjectURL(fa),
          (fa = URL.createObjectURL(c)),
          await jn({ type: 'clearImage' }),
          await jn({
            type: 'switchToImage',
            uri: fa,
            resourceUri: c.name,
            zoomState: { scale: 'fit', x: 0, y: 0 },
          }));
        let f = ie,
          b = performance.now();
        for (; !Me || !te?.isConnected || !ge.classList.contains('ready');) {
          if (ie !== f) throw new Error('Image open superseded');
          if (gi || ge.classList.contains('error')) throw new Error(gi || 'Image decoding failed');
          if (performance.now() - b > 6e4) throw new Error('Image decoding timed out');
          await new Promise(y => setTimeout(y, 20));
        }
        is();
      },
      snapshot() {
        return {
          ready: Me && !!te?.isConnected && ge.classList.contains('ready'),
          pixel: pa,
          format: d,
          settings: structuredClone(r.settings),
          axes: Xo().map(({ go: c, ...f }) => f),
          layers: O.layers.map(({ data: c, rasterMask: f, ...b }) => b),
          size: B
            ? `${B.width} \xD7 ${B.height}`
            : te
              ? `${te.naturalWidth} \xD7 ${te.naturalHeight}`
              : '',
          zoom: k.getCurrentState().scale,
          error: gi,
          channels: be.map((c, f) => ({
            index: f,
            name: c.name || `Channel ${f + 1}`,
            enabled: We === null ? pe[f]?.visible !== !1 : We === f,
          })),
        };
      },
      capture() {
        return {
          layers: O.layers.map(c => ({
            name: c.name,
            visible: c.visible,
            opacity: c.opacity,
            blendMode: c.blendMode,
          })),
          channels: pe.map(c => c.visible),
          composite: je,
        };
      },
      restore(c) {
        if (c.layers?.length) {
          for (let f of [...O.layers]) {
            let b = c.layers.find(y => y.name === f.name);
            b ? O.updateLayer(f.id, b) : O.removeLayer(f.id);
          }
          Ct();
        }
        c.composite &&
          (gn(),
          c.channels?.forEach((f, b) => {
            pe[b] && (pe[b].visible = f);
          }),
          (je = !0),
          Dn());
      },
      channels() {
        gn();
      },
      sample(c, f) {
        let b = Fn();
        return !b?.data || c < 0 || f < 0 || c >= b.width || f >= b.height
          ? []
          : Array.from(
              b.data.slice((f * b.width + c) * b.channels, (f * b.width + c + 1) * b.channels)
            );
      },
      histogram() {
        let c = Fn();
        if (!c?.data) return [];
        let f = [],
          b = Math.max(1, Math.ceil(c.data.length / 16384));
        for (let R = 0; R < c.data.length; R += b) {
          let P = Number(c.data[R]);
          Number.isFinite(P) && f.push(P);
        }
        if (!f.length) return [];
        let y = Math.min(...f),
          x = Math.max(...f),
          C = Array(64).fill(0);
        for (let R of f) C[Math.min(63, Math.floor(((R - y) / (x - y || 1)) * 64))]++;
        return C;
      },
      channel(c, f, b = !1) {
        (gn(),
          pe[c] &&
            (b ? (We = We === c ? null : c) : ((We = null), (pe[c].visible = f)), (je = !0), Dn()));
      },
      async settings(c) {
        let f = [
            'normalization',
            'gamma',
            'brightness',
            'nanColor',
            'showScaleBar',
            'gpuAcceleration',
            'displayColormap',
            'normalizedFloatMode',
          ],
          b = Object.fromEntries(Object.entries(c).filter(([x]) => f.includes(x))),
          y = { ...r.settings, ...b };
        if (
          y.normalization &&
          (!Number.isFinite(y.normalization.min) ||
            !Number.isFinite(y.normalization.max) ||
            y.normalization.min >= y.normalization.max)
        )
          throw new Error('Display minimum must be smaller than maximum.');
        await jn({ type: 'updateSettings', settings: y });
      },
      command(c, f = {}) {
        return jn({ type: c, ...f });
      },
      axis(c, f) {
        Xo()
          .find(b => b.key === c)
          ?.go(f);
      },
      async addLayer(c) {
        (O.isEmpty() && zn(), (O.active = !0));
        let f = URL.createObjectURL(c);
        try {
          let b = await _r(f, c.name);
          if (!b) throw new Error('Cannot decode image layer');
          O.addLayer(b);
        } finally {
          URL.revokeObjectURL(f);
        }
        Ct();
      },
      layerVisibility(c, f = !1) {
        if (f)
          if (Wn?.id === c) {
            for (let b of O.layers)
              O.updateLayer(b.id, { visible: Wn.visibility.get(b.id) !== !1 });
            Wn = null;
          } else {
            Wn = { id: c, visibility: new Map(O.layers.map(b => [b.id, b.visible !== !1])) };
            for (let b of O.layers) O.updateLayer(b.id, { visible: b.id === c });
          }
        else {
          let b = O.layers.find(y => y.id === c);
          (b && O.updateLayer(c, { visible: !b.visible }), (Wn = null));
        }
        Ct();
      },
      layer(c, f) {
        (O.updateLayer(c, f), Ct());
      },
      removeLayer(c) {
        (O.removeLayer(c), Ct());
      },
      exploreLayers() {
        if (!ta()) throw new Error('Editable layer pixels are not available for this document');
        ((O.active = !0), Ct());
      },
      undo() {
        O.undo() && Ct();
      },
      redo() {
        O.redo() && Ct();
      },
      async exportPng() {
        let c = B;
        if (c)
          return new Promise((b, y) =>
            c.toBlob(x => (x ? b(x) : y(new Error('Export failed'))), 'image/png')
          );
        if (!te) throw new Error('No image to export');
        let f = document.createElement('canvas');
        return (
          (f.width = te.naturalWidth),
          (f.height = te.naturalHeight),
          f.getContext('2d').drawImage(te, 0, 0),
          new Promise((b, y) =>
            f.toBlob(x => (x ? b(x) : y(new Error('Export failed'))), 'image/png')
          )
        );
      },
    }),
    vu());
})();
/*! Bundled license information:

tga-js/dist/esm/tga.js:
  (**
   * @license tga-js 1.1.1
   * Copyright (c) 2013-2020 Vincent Thibault, Inc.
   * License: MIT
   *)
*/
