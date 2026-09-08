import {
  A as $e,
  B as Ge,
  a as Me,
  c as Q,
  d as Z,
  e as ee,
  f as se,
  h as Ce,
  i as De,
  n as pe,
  o as Ae,
  s as Be,
  t as Ie,
  v as oe,
  w as We,
  y as fe,
  z as Le,
} from './chunk-RKUAQ6AC.js';
import {
  b as Re,
  d as D,
  l as ke,
  p as Ne,
  q as _e,
  s as we,
  t as Se,
  u as Te,
} from './chunk-JGPZW56V.js';
import {
  a as ye,
  d as Fe,
  e as le,
  f as ce,
  g as be,
  k as te,
  l as ae,
  m as ve,
} from './chunk-W2ORCHQ2.js';
import { a as Ee, d as Ue } from './chunk-H437L57U.js';
import './chunk-Y6SLVHK3.js';
var Ke = 160 * 1024 * 1024;
function Oe(Pe, e) {
  return Q(Pe, e) ? Float32Array : e > 8 ? Uint16Array : Uint8Array;
}
var je = class {
  constructor(e, t) {
    this.displayRgbBands = null;
    this._regionWebglRenderer = new Te();
    this._regionGpuCanvas = null;
    this._remoteTiff = null;
    this._remoteTiffUrl = null;
    this._remoteDecodePool = null;
    this._regionSourceGeneration = 0;
    this._regionWorkerPrimed = !1;
    this._regionDecodeQueue = Promise.resolve();
    this._regionSampleCache = new Map();
    this._regionSampleCacheBytes = 0;
    this._regionSampleCacheMaxBytes = Ke;
    this._lastWasmFailure = '';
    ((this.settingsManager = e),
      (this.vscode = t),
      (this.rawTiffData = null),
      (this._pendingRenderData = null),
      (this._isInitialLoad = !0),
      (this._lastImageData = null),
      (this._lastStatistics = null),
      (this._lastStatisticsRgb24Mode = !1),
      (this._lastRenderHistogram = null),
      (this._lastAllTags = []),
      (this._lastRenderUsedWebGL = !1),
      (this._gdalNodata = void 0),
      (this._extraSamplesAreAlpha = void 0),
      (this.displayBand = 0),
      (this.displayRgbBands = null),
      (this.pageDirectory = []),
      (this.gdalMetadata = null),
      (this._convertedFloatData = null),
      (this.loadSignal = void 0),
      (this.decodeWorker = null),
      (this._wasmProcessor = new ve()),
      (this._webglRenderer = new Te()),
      (this._wasmAvailable = !1),
      (this._wasmInitPromise = null),
      (this.pageIndex = 0),
      (this.pageCount = 1),
      (this._sourceBuffer = null),
      (this._sourceBufferSrc = null),
      (this.omeMetadata = null),
      (this.omeBinaryOnly = null),
      (this.omeXml = null),
      (this.geoReference = null));
  }
  get isRemoteSource() {
    return !!this._remoteTiff && !!this._remoteTiffUrl;
  }
  get isProgressiveRemoteBase() {
    return !!this.rawTiffData?.progressiveRemote;
  }
  get hasGeneratedPreview() {
    return this.pageDirectory.some(e => e.generated === !0);
  }
  get selectableBandCount() {
    let e = this.rawTiffData?.ifd,
      t = Math.max(1, Number(e?.t277 || 1));
    if (t < 2) return 0;
    let a = Number(e?.t262),
      n = a === 0 || a === 1,
      o = !!this.gdalMetadata?.bands.some(i => i.sample > 0);
    return !n || this._extraSamplesAreAlpha === !0
      ? 0
      : this._extraSamplesAreAlpha === !1 || o
        ? t
        : 0;
  }
  setDisplayBand(e) {
    let t = this.selectableBandCount;
    if (t < 2 || !Number.isFinite(e)) return !1;
    let a = Math.min(t - 1, Math.max(0, Math.floor(e)));
    return a === this.displayBand && !this.displayRgbBands
      ? !1
      : ((this.displayRgbBands = null),
        (this.displayBand = a),
        (this._lastStatistics = null),
        (this._lastRenderHistogram = null),
        !0);
  }
  setDisplayRgbBands(e) {
    let t = this.selectableBandCount;
    return t < 2 ||
      e.some(a => !Number.isInteger(a) || a < 0 || a >= t) ||
      this.displayRgbBands?.every((a, n) => a === e[n])
      ? !1
      : ((this.displayRgbBands = [...e]),
        (this._lastStatistics = null),
        (this._lastRenderHistogram = null),
        !0);
  }
  _clearRegionSampleCache() {
    (this._regionSampleCache.clear(), (this._regionSampleCacheBytes = 0));
  }
  _cacheRegionSamples(e, t, a, n) {
    let o = n?.data,
      i = Number(n?.width),
      l = Number(n?.height),
      r = Number(n?.channels);
    if (!(o instanceof Float32Array) || !(i > 0) || !(l > 0) || !(r > 0)) return;
    let f = Array.from(n?.sourceRasters || []),
      s = f.length === r && f.every(u => ArrayBuffer.isView(u)) ? f : void 0,
      h = s ? s.reduce((u, b) => u + b.byteLength, 0) : o.byteLength;
    if (!(h > 0) || h > this._regionSampleCacheMaxBytes) return;
    let g = `${e}:${t}:${a}:${i}:${l}`,
      x = this._regionSampleCache.get(g);
    for (
      x && (this._regionSampleCacheBytes -= x.bytes),
        this._regionSampleCache.delete(g),
        this._regionSampleCache.set(g, {
          pageIndex: e,
          x: t,
          y: a,
          width: i,
          height: l,
          channels: r,
          sampleFormat: Number(n.sampleFormat),
          data: s ? void 0 : o,
          planes: s,
          bytes: h,
        }),
        this._regionSampleCacheBytes += h;
      this._regionSampleCacheBytes > this._regionSampleCacheMaxBytes;
    ) {
      let u =
        [...this._regionSampleCache.entries()].find(([, b]) => b.pageIndex !== this.pageIndex) ||
        this._regionSampleCache.entries().next().value;
      if (!u) break;
      (this._regionSampleCache.delete(u[0]), (this._regionSampleCacheBytes -= u[1].bytes));
    }
  }
  _readCachedPagePixel(e, t, a) {
    let n = Math.floor(t),
      o = Math.floor(a),
      i = null;
    for (let [h, g] of this._regionSampleCache)
      g.pageIndex !== e ||
        n < g.x ||
        o < g.y ||
        n >= g.x + g.width ||
        o >= g.y + g.height ||
        (i = { key: h, region: g });
    if (!i) return null;
    (this._regionSampleCache.delete(i.key), this._regionSampleCache.set(i.key, i.region));
    let l = n - i.region.x,
      f = (o - i.region.y) * i.region.width + l,
      m = [];
    for (let h = 0; h < i.region.channels; h++) {
      let g = i.region.planes
        ? i.region.planes[h]?.[f]
        : i.region.data?.[f * i.region.channels + h];
      m.push(Number(g));
    }
    let s = this._formatDeclaredSamples(m);
    return s !== null
      ? s
      : m.map(h => (i.region.sampleFormat === 3 ? h.toPrecision(4) : String(h))).join(' ');
  }
  readCachedFullResolutionPixel(e, t) {
    let n = this.pageDirectory.find(o => o.index === this.pageIndex)?.parent ?? this.pageIndex;
    return this._readCachedPagePixel(n, e, t);
  }
  readCachedScenePixel(e, t) {
    let a = De(this.pageDirectory, this.pageIndex),
      n = Ce(this.pageDirectory, a);
    for (let l of n) {
      let r = Math.max(1, l.reduction),
        f = this._readCachedPagePixel(l.index, Math.floor(e / r), Math.floor(t / r));
      if (f !== null) return { value: f, exact: r === 1 };
    }
    let o = this.pageDirectory.find(l => l.index === this.pageIndex),
      i = this.rawTiffData?.data;
    if (o && i?.length) {
      let l = Math.max(1, o.reduction),
        r = Math.floor(e / l),
        f = Math.floor(t / l);
      if (r >= 0 && f >= 0 && r < o.width && f < o.height) {
        let m = this.getColorAtPixel(r, f, o.width, o.height);
        if (m) return { value: m, exact: l === 1 };
      }
    }
    return null;
  }
  _ensureLocalWasm() {
    return (
      this._wasmInitPromise ||
        (this._wasmInitPromise = this._wasmProcessor
          .init()
          .then(e => ((this._wasmAvailable = e), e))
          .catch(
            e => (
              console.warn('[TiffProcessor] WASM initialization failed:', e),
              (this._wasmAvailable = !1),
              !1
            )
          )),
      this._wasmInitPromise
    );
  }
  clamp(e, t, a) {
    return Math.min(Math.max(e, t), a);
  }
  _setOmeXml(e) {
    let t =
      e || this._lastAllTags.find(o => o.tag === 270 || o.name === 'ImageDescription')?.value || '';
    if (!t) return;
    this.omeBinaryOnly = Ge(t);
    let a = Le(t);
    if (a) {
      ((this.omeXml = t), (this.omeMetadata = a));
      return;
    }
    let n = (o, i) => Number(this._lastAllTags.find(l => l.tag === o || l.name === i)?.value);
    this.omeMetadata =
      this.omeMetadata || $e(t, n(256, 'ImageWidth'), n(257, 'ImageLength'), this.pageCount);
  }
  _getNanColor(e) {
    return Re(e);
  }
  _formatDeclaredSamples(e) {
    return this._gdalNodata !== void 0 && e[0] === this._gdalNodata
      ? 'nodata'
      : Ie(this.gdalMetadata)
        ? e
            .map((t, a) => Be(this.gdalMetadata, a, t))
            .map(t => Number(t.toPrecision(6)).toString())
            .join(' ')
        : null;
  }
  _getTiffLayoutInfo(e) {
    if (!e) return {};
    if (e.fileDirectory) {
      let t = e.fileDirectory,
        a =
          Array.isArray(t.StripByteCounts) || ArrayBuffer.isView(t.StripByteCounts)
            ? t.StripByteCounts
            : [],
        n = t.TileByteCounts || [],
        o = 0,
        i = 0;
      for (let l of a) {
        let r = Number(l || 0);
        ((o += r), r > i && (i = r));
      }
      return {
        rowsPerStrip: t.RowsPerStrip,
        stripCount: t.StripByteCounts?.length || void 0,
        stripByteCountTotal: a.length ? o : void 0,
        stripByteCountMax: a.length ? i : void 0,
        tileWidth: t.TileWidth,
        tileLength: t.TileLength,
        tileCount: n.length || void 0,
      };
    }
    return {
      rowsPerStrip: e.rowsPerStrip,
      stripCount: e.stripCount,
      stripByteCountTotal: e.stripByteCountTotal,
      stripByteCountMax: e.stripByteCountMax,
      tileWidth: e.tileWidth,
      tileLength: e.tileLength,
      tileCount: e.tileCount,
      directDecode: e.directDecode,
    };
  }
  _logTiffLayout(e) {
    let t = [];
    (e.rowsPerStrip && t.push(`rows/strip=${e.rowsPerStrip}`),
      e.stripCount && t.push(`strips=${e.stripCount}`),
      e.stripByteCountMax && t.push(`maxStripBytes=${e.stripByteCountMax}`),
      e.tileCount && t.push(`tiles=${e.tileCount}`),
      e.tileWidth && e.tileLength && t.push(`tile=${e.tileWidth}x${e.tileLength}`),
      e.directDecode && t.push('direct-uncompressed-path=yes'),
      t.length && console.log(`[TiffProcessor] TIFF layout: ${t.join(', ')}`));
  }
  async processTiff(e, t = 0, a) {
    let n = performance.now();
    this._lastRenderHistogram = null;
    let o = this.loadSignal,
      i = this.settingsManager.settings.remoteTiffUrl;
    if (i) return this._processRemoteTiff(i, t, a, n);
    (this._remoteDecodePool?.destroy?.(),
      (this._remoteDecodePool = null),
      (this._remoteTiff = null),
      (this._remoteTiffUrl = null));
    let l = null;
    try {
      this._sourceBufferSrc !== e &&
        ((this.displayBand = 0),
        (this.displayRgbBands = null),
        this._clearRegionSampleCache(),
        this._regionSourceGeneration++,
        (this._regionWorkerPrimed = !1),
        (this.omeMetadata = null),
        (this.omeBinaryOnly = null),
        (this.omeXml = null),
        (this.geoReference = null),
        (this.pageDirectory = []),
        (this.gdalMetadata = null));
      let r = t === 0 ? await Se.takeSpeculativeDecode(e, o, 'tiff') : null,
        f = r?.ok && r.result?.deferToParallelTiff === !0,
        m = r?.ok && !f ? r.result : null;
      f &&
        D.note(
          'decode-tiff-bootstrap',
          `parallel route (${Number(r.result?.stripCount || 0)} strips)`
        );
      let s,
        h = 0,
        g =
          r?.sourceBuffer instanceof ArrayBuffer
            ? r.sourceBuffer
            : r?.buffer instanceof ArrayBuffer
              ? r.buffer
              : null;
      if (g?.byteLength) ((this._sourceBuffer = g), (this._sourceBufferSrc = e), (s = g.slice(0)));
      else if (this._sourceBufferSrc === e && this._sourceBuffer)
        ((s = this._sourceBuffer.slice(0)), D.mark('tiff-source-cache-hit'));
      else {
        let d = performance.now(),
          y = await Se.fetchArrayBuffer(e, o, 'tiff');
        ((h = performance.now() - d),
          (this._sourceBuffer = y),
          (this._sourceBufferSrc = e),
          (s = y.slice(0)));
      }
      let x = s.byteLength / (1024 * 1024);
      if (
        (D.note('fetch-tiff-bytes', `${x.toFixed(1)}MB`),
        h > 0 && D.note('fetch-tiff-arrayBuffer-rate', `${(x / (h / 1e3)).toFixed(0)}MB/s`),
        o?.aborted)
      )
        throw new DOMException('Load superseded', 'AbortError');
      let u = performance.now() - n;
      (console.log(`[TiffProcessor] Fetch time: ${u.toFixed(2)}ms`), r || D.mark('fetch'));
      let b = (d, y) =>
        !a || (d <= a.maxAxis && y <= a.maxAxis && d * y <= a.maxArea && d * y * 4 <= a.maxBytes);
      if (a && m && t === 0 && !b(Number(m.width), Number(m.height))) {
        let d = se(m.pageDirectoryJson),
          y = pe(d, 0, a.displayWidth, b, 1, a.pixelBudget);
        y &&
          y.index !== 0 &&
          (console.log(
            `[TiffProcessor] Bootstrap decode is not displayable; reopening at level 1/${y.reduction} (${y.width}x${y.height})`
          ),
          D.note('tiff-open-level', `1/${y.reduction} ${y.width}x${y.height}`),
          (t = y.index),
          (this.pageIndex = y.index),
          (m = null));
      }
      let _ = this.settingsManager.settings.rgbAs24BitGrayscale || !1;
      if (
        (!m &&
          this.decodeWorker &&
          !this.decodeWorker.canDecode('tiff') &&
          (await Promise.race([this.decodeWorker.start(), new Promise(d => setTimeout(d, 500))])),
        o?.aborted)
      )
        throw new DOMException('Load superseded', 'AbortError');
      let c = m,
        M = !1,
        I = !1;
      if (
        c &&
        ((l = {
          engine: c.decodedWith || 'wasm (bootstrap worker)',
          durationMs: Number(r?.bootstrapDecodeDurationMs || 0),
        }),
        Array.isArray(c.decodeTimings))
      )
        for (let y of c.decodeTimings) {
          let p = Number(y?.durationMs);
          Number.isFinite(p) && D.detail(String(y.name || 'decode-worker-detail'), p);
        }
      if (!c && t === 0 && s.byteLength >= 512 * 1024)
        try {
          let d = ae() || (await te());
          if (d && a) {
            let y = this._chooseOpenLevel(d, s, a);
            y > 0 && ((t = y), (this.pageIndex = y));
          }
          if (d && t === 0 && !(d.tiff_preview_reduction?.(new Uint8Array(s)) > 0)) {
            let y = performance.now(),
              p = await Ue(s, d);
            if (o?.aborted) throw new DOMException('Load superseded', 'AbortError');
            if (p) {
              let O = p.width * p.height,
                X = p.data.constructor,
                k = [];
              if (p.channels === 1) k.push(p.data);
              else
                for (let E = 0; E < p.channels; E++) {
                  let q = new X(O);
                  for (let Y = 0; Y < O; Y++) q[Y] = p.data[Y * p.channels + E];
                  k.push(q);
                }
              ((c = {
                pageIndex: 0,
                pageCount: p.pageCount,
                width: p.width,
                height: p.height,
                channels: p.channels,
                bitsPerSample: p.bitsPerSample,
                sampleFormat: p.sampleFormat,
                compression: p.compression,
                predictor: p.predictor,
                photometricInterpretation: p.photometricInterpretation,
                planarConfiguration: p.planarConfiguration,
                rowsPerStrip: p.tileLength ? void 0 : p.rowsPerStrip,
                stripCount: p.tileLength ? void 0 : p.stripCount,
                tileWidth: p.tileWidth,
                tileLength: p.tileLength,
                tileCount: p.tileCount,
                directDecode: !0,
                data: p.data,
                rasters: k,
                min: p.min,
                max: p.max,
                allTagsJson: p.allTagsJson,
                omeXml: p.omeXml,
                geoJson: p.geoJson,
                pageDirectoryJson: p.pageDirectoryJson,
                decodedWith: `wasm (${p.workers} ${p.tileLength ? 'tile-row' : 'strip'} workers)`,
                decodeTimings: p.timings,
              }),
                (l = { engine: c.decodedWith, durationMs: performance.now() - y }),
                D.mark('decode-wasm-strip-pool'));
              for (let E of p.timings) D.detail(String(E.name), Number(E.durationMs) || 0);
              console.log(
                `[TiffProcessor] Strip-parallel decode: ${l.durationMs.toFixed(2)}ms across ${p.workers} workers`
              );
            }
          }
        } catch (d) {
          if (d?.name === 'AbortError') throw d;
          (console.warn('[TiffProcessor] Strip-parallel decode failed, using the normal path:', d),
            (c = null));
        }
      let T = s;
      if ((c && (T = null), !c && this.decodeWorker?.canDecode('tiff'))) {
        let d = performance.now(),
          y = await this.decodeWorker.decode('tiff', s, { pageIndex: t });
        if (o?.aborted) throw new DOMException('Load superseded', 'AbortError');
        if (y?.ok) {
          ((c = y.result), (T = null));
          let p = Number(c.pageIndex);
          Number.isFinite(p) &&
            p !== t &&
            (console.log(
              `[TiffProcessor] Opened at level index ${p}: full resolution is either not displayable or larger than is worth decoding for this window`
            ),
            D.note('tiff-open-level', `page ${p}`),
            (t = p),
            (this.pageIndex = p));
          let O = c.decodedWith || 'wasm (worker)';
          if (
            ((l = { engine: O, durationMs: performance.now() - d }),
            console.log(
              `[TiffProcessor] Worker TIFF decode time: ${l.durationMs.toFixed(2)}ms (${O})`
            ),
            c.wasmFallbackReason &&
              (console.warn(
                '[TiffProcessor] Worker used geotiff.js because WASM rejected the TIFF:',
                c.wasmFallbackReason
              ),
              this.vscode?.postMessage({
                type: 'log',
                value: `[TiffProcessor] WASM rejected TIFF; using geotiff.js worker fallback: ${c.wasmFallbackReason}`,
              })),
            D.mark(O.startsWith('geotiff.js') ? 'decode-geotiff-worker' : 'decode-wasm-worker'),
            Array.isArray(c.decodeTimings))
          ) {
            let X = 0;
            for (let k of c.decodeTimings) {
              let E = Number(k?.durationMs);
              Number.isFinite(E) &&
                ((X += E), D.detail(String(k.name || 'decode-worker-detail'), E));
            }
            D.detail('decode-worker-transfer+overhead', l.durationMs - X);
          }
        } else
          ((M = !0),
            (T = y?.buffer && y.buffer.byteLength > 0 ? y.buffer : null),
            (I = /\[external-codec:/.test(String(y?.error ?? ''))),
            console.warn(
              I
                ? '[TiffProcessor] Worker decode needs an external codec module:'
                : '[TiffProcessor] Worker decode failed, falling back to geotiff.js:',
              y?.error
            ));
      }
      (!c && (!M || I) && !this.decodeWorker?.canDecode('tiff') && (await this._ensureLocalWasm()),
        I && (await this._ensureLocalWasm()));
      let v = !c && (!M || I) && this._wasmAvailable;
      if (
        (console.log(
          `[TiffProcessor] Decode decision: worker=${!!c}, wasmAvailable=${this._wasmAvailable}, 24BitMode=${_}, willUseWasm=${v}`
        ),
        v && T)
      )
        try {
          let d = performance.now();
          c = await this._wasmProcessor.decode(T.slice(0), t);
          let y = performance.now() - d;
          ((l = { engine: 'wasm (main thread)', durationMs: y }),
            console.log(`[TiffProcessor] WASM decode time: ${y.toFixed(2)}ms`),
            D.mark('decode-wasm-local'));
        } catch (d) {
          (console.warn('[TiffProcessor] WASM decoding failed, falling back to geotiff.js:', d),
            /\[external-codec:/.test(String(d?.message ?? d)) || (this._wasmAvailable = !1),
            (c = null));
        }
      if (c)
        try {
          ((this.pageIndex = Number(c.pageIndex ?? t)),
            (this.pageCount = Math.max(1, Number(c.pageCount ?? 1))));
          let d = c.width,
            y = c.height,
            p = c.channels,
            O = c.bitsPerSample,
            X = c.sampleFormat,
            k;
          if (c.rasters) k = c.rasters;
          else if (p === 1) k = [c.data];
          else {
            k = [];
            let ge = c.data.constructor;
            for (let K = 0; K < p; K++) {
              let ie = new ge(d * y);
              for (let ne = 0; ne < d * y; ne++) ie[ne] = c.data[ne * p + K];
              k.push(ie);
            }
            D.mark('deinterleave');
          }
          let E = c.data,
            q = c.compression,
            Y = c.predictor,
            de = c.photometricInterpretation,
            Ve = c.planarConfiguration;
          ke(Ne(de));
          let xe = this._getTiffLayoutInfo(c);
          (console.log(
            `[TiffProcessor] Using metadata from WASM: compression=${q}, predictor=${Y}`
          ),
            this._logTiffLayout(xe));
          let he = {
            getWidth: () => d,
            getHeight: () => y,
            getSamplesPerPixel: () => p,
            getBitsPerSample: () => O,
            getSampleFormat: () => X,
          };
          if (
            ((this.rawTiffData = {
              image: he,
              rasters: k,
              ifd: {
                width: d,
                height: y,
                t339: X,
                t277: p,
                t284: 1,
                t258: O,
                t262: de,
                pageIndex: this.pageIndex,
                pageCount: this.pageCount,
              },
              data: E,
            }),
            Number.isFinite(c.min) &&
              Number.isFinite(c.max) &&
              ((this._lastStatistics = { min: c.min, max: c.max }),
              (this._lastStatisticsRgb24Mode = !1)),
            (this._lastAllTags = Fe(c.allTagsJson)),
            this._setOmeXml(c.omeXml || fe(this._lastAllTags)),
            (this.geoReference = We(c.geoJson)),
            (this.rawTiffData.ome = this.omeMetadata),
            (this._gdalNodata = le(this._lastAllTags)),
            (this._extraSamplesAreAlpha = ce(this._lastAllTags)),
            (this.pageDirectory = se(c.pageDirectoryJson)),
            (this.gdalMetadata = oe(this._lastAllTags)),
            this.selectableBandCount > 1 && (this._lastStatistics = null),
            this._gdalNodata !== void 0 &&
              this._lastStatistics &&
              (this._lastStatistics.min === this._gdalNodata ||
                this._lastStatistics.max === this._gdalNodata) &&
              (this._lastStatistics = null),
            this.vscode && this._isInitialLoad)
          ) {
            let ge = ee(X, O);
            ((this._pendingRenderData = { image: he, rasters: k }),
              this.vscode.postMessage({
                type: 'formatInfo',
                value: {
                  width: d,
                  height: y,
                  sampleFormat: X,
                  compression: q,
                  predictor: Y,
                  photometricInterpretation: de,
                  planarConfig: Ve,
                  samplesPerPixel: p,
                  bitsPerSample: O,
                  ...xe,
                  formatType: ge,
                  isInitialLoad: !0,
                  decodedWith: c.decodedWith || 'wasm',
                  pageIndex: this.pageIndex,
                  pageCount: this.pageCount,
                  ...this._omeFormatInfo(),
                },
              }));
            let K = document.createElement('canvas');
            ((K.width = d), (K.height = y));
            let ie = new ImageData(d, y);
            return { canvas: K, imageData: ie, tiffData: this.rawTiffData, decodeInfo: l };
          }
          let ue = document.createElement('canvas');
          ((ue.width = d), (ue.height = y));
          let Je = await this.renderTiff(he, k),
            Ye = performance.now() - n;
          return (
            console.log(`[TiffProcessor] Total WASM processing time: ${Ye.toFixed(2)}ms`),
            { canvas: ue, imageData: Je, tiffData: this.rawTiffData, decodeInfo: l }
          );
        } catch (d) {
          (console.warn('[TiffProcessor] WASM decoding failed, falling back to geotiff.js:', d),
            (this._lastWasmFailure = String(d instanceof Error ? d.message : d)),
            (this._wasmAvailable = !1));
        }
      (!T || T.byteLength === 0) &&
        (this._sourceBufferSrc === e && this._sourceBuffer
          ? (T = this._sourceBuffer.slice(0))
          : (T = await (await fetch(e, { signal: o })).arrayBuffer()));
      let A = performance.now(),
        F;
      try {
        F = await (await ye()).fromArrayBuffer(T);
      } catch (d) {
        throw new Error(
          this._lastWasmFailure
            ? `${this._lastWasmFailure} (the geotiff.js fallback also failed: ${d instanceof Error ? d.message : d})`
            : String(d instanceof Error ? d.message : d)
        );
      }
      if (((this.pageCount = Math.max(1, await F.getImageCount())), t < 0 || t >= this.pageCount))
        throw new Error(`TIFF page index ${t} is out of range (page count: ${this.pageCount})`);
      this.pageIndex = t;
      let C = await F.getImage(t),
        N = t === 0 ? C : await F.getImage(0),
        z = String(N?.fileDirectory?.ImageDescription || '');
      this._setOmeXml(z);
      let H = C.getSampleFormat(),
        S = C.getWidth(),
        B = C.getHeight(),
        $ = C.fileDirectory || {},
        W = $.Compression || 'Unknown',
        U = $.Predictor,
        R = $.PhotometricInterpretation,
        P = $.PlanarConfiguration,
        j = this._getTiffLayoutInfo(C);
      this._logTiffLayout(j);
      let G = document.createElement('canvas');
      ((G.width = S), (G.height = B));
      let L = await C.readRasters(),
        re = performance.now() - A;
      ((l = {
        engine: _ ? 'geotiff.js (main thread, 24-bit mode)' : 'geotiff.js (main thread)',
        durationMs: re,
      }),
        console.log(`[TiffProcessor] geotiff.js decode time: ${re.toFixed(2)}ms`),
        D.mark('decode-geotiff'));
      let J = C.getSamplesPerPixel(),
        V = C.getBitsPerSample(),
        ze = Oe(H, V),
        me = new ze(S * B * J);
      if (J === 1) me.set(L[0]);
      else
        for (let d = 0; d < L[0].length; d++) for (let y = 0; y < J; y++) me[d * J + y] = L[y][d];
      if (
        (D.mark('interleave-raw'),
        (this.rawTiffData = {
          image: C,
          rasters: L,
          ifd: {
            width: S,
            height: B,
            t339: Array.isArray(H) ? H[0] : H,
            t277: J,
            t284: 1,
            t258: V,
            t262: R,
            pageIndex: this.pageIndex,
            pageCount: this.pageCount,
          },
          data: me,
        }),
        (this._lastAllTags = be(C)),
        this._setOmeXml(fe(this._lastAllTags)),
        (this.rawTiffData.ome = this.omeMetadata),
        (this._gdalNodata = le(this._lastAllTags)),
        (this._extraSamplesAreAlpha = ce(this._lastAllTags)),
        (this.gdalMetadata = oe(this._lastAllTags)),
        this.selectableBandCount > 1 && (this._lastStatistics = null),
        this.vscode && this._isInitialLoad)
      ) {
        let d = ee(H, V);
        ((this._pendingRenderData = { image: C, rasters: L }),
          this.vscode.postMessage({
            type: 'formatInfo',
            value: {
              width: S,
              height: B,
              sampleFormat: H,
              compression: W,
              predictor: U,
              photometricInterpretation: R,
              planarConfig: P,
              samplesPerPixel: C.getSamplesPerPixel(),
              bitsPerSample: C.getBitsPerSample(),
              ...j,
              formatType: d,
              isInitialLoad: !0,
              decodedWith: _ ? 'geotiff.js (24-bit mode)' : 'geotiff.js',
              pageIndex: this.pageIndex,
              pageCount: this.pageCount,
              ...this._omeFormatInfo(),
            },
          }));
        let y = new ImageData(S, B);
        return { canvas: G, imageData: y, tiffData: this.rawTiffData, decodeInfo: l };
      }
      let Xe = await this.renderTiff(C, L),
        He = performance.now() - n;
      return (
        console.log(`[TiffProcessor] Total geotiff.js processing time: ${He.toFixed(2)}ms`),
        { canvas: G, imageData: Xe, tiffData: this.rawTiffData, decodeInfo: l }
      );
    } catch (r) {
      throw (console.error('Error processing TIFF:', r), r);
    }
  }
  async _processRemoteTiff(e, t, a, n) {
    let o = await ye();
    (this._remoteTiffUrl !== e || !this._remoteTiff) &&
      ((this.displayBand = 0),
      (this.displayRgbBands = null),
      this._clearRegionSampleCache(),
      this._remoteDecodePool?.destroy?.(),
      await this._remoteTiff?.close?.(),
      (this._lastStatistics = null),
      (this._remoteTiff = await Me(e, o, ae() || (await te()), this.loadSignal)),
      (this._remoteTiffUrl = e),
      (this._remoteDecodePool =
        typeof o.Pool == 'function'
          ? new o.Pool(Math.max(1, Math.min(4, navigator.hardwareConcurrency || 2)))
          : null),
      (this._sourceBuffer = null),
      (this._sourceBufferSrc = null),
      this._regionSourceGeneration++,
      (this._regionWorkerPrimed = !1),
      (this.pageDirectory = await this._buildRemotePageDirectory(this._remoteTiff)));
    let i = this._remoteTiff;
    if (
      (i.setLoadSignal?.(this.loadSignal),
      (this.pageCount = Math.max(1, await i.getImageCount())),
      a && t === 0 && this.pageDirectory.length > 1)
    ) {
      let A = (C, N) =>
          C <= a.maxAxis && N <= a.maxAxis && C * N <= a.maxArea && C * N * 4 <= a.maxBytes,
        F = Ae(this.pageDirectory, 0, a.displayWidth, A, a.pixelBudget);
      F && (t = F.index);
    }
    if (t < 0 || t >= this.pageCount)
      throw new Error(`TIFF page index ${t} is out of range (page count: ${this.pageCount})`);
    this.pageIndex = t;
    let l = performance.now(),
      r = await i.getImage(t),
      f = t === 0 ? r : await i.getImage(0);
    this._setOmeXml(String(f?.fileDirectory?.ImageDescription || ''));
    let m = r.getWidth(),
      s = r.getHeight(),
      h = !!a && m * s > a.pixelBudget,
      g = h ? null : await this._readRemoteRasters(r, { signal: this.loadSignal }),
      x = { engine: 'geotiff.js (HTTP ranges)', durationMs: performance.now() - l };
    (D.mark('decode-geotiff-ranges'), D.note('tiff-byte-source', 'HTTP Range'));
    let u = r.getSampleFormat(),
      b = r.getSamplesPerPixel(),
      w = r.getBitsPerSample(),
      _ = Oe(u, w),
      c = h ? new _(0) : new _(m * s * b);
    if (!h && b === 1) c.set(g[0]);
    else if (!h)
      for (let A = 0; A < g[0].length; A++) for (let F = 0; F < b; F++) c[A * b + F] = g[F][A];
    let M = r.fileDirectory || {};
    ((this.rawTiffData = {
      image: r,
      rasters: g,
      ifd: {
        width: m,
        height: s,
        t339: Array.isArray(u) ? u[0] : u,
        t277: b,
        t284: 1,
        t258: w,
        t262: M.PhotometricInterpretation,
        pageIndex: t,
        pageCount: this.pageCount,
      },
      data: c,
      progressiveRemote: h,
    }),
      (this._lastAllTags = be(r)),
      this._setOmeXml(fe(this._lastAllTags)),
      (this.rawTiffData.ome = this.omeMetadata),
      (this._gdalNodata = le(this._lastAllTags)),
      (this._extraSamplesAreAlpha = ce(this._lastAllTags)),
      (this.gdalMetadata = oe(this._lastAllTags)),
      this.selectableBandCount > 1 && (this._lastStatistics = null));
    try {
      let A = f.getOrigin(),
        F = f.getResolution(),
        C = f.getGeoKeys?.() || {},
        N = Number(C.ProjectedCSTypeGeoKey || 0),
        z = Number(C.GeographicTypeGeoKey || 0);
      this.geoReference = {
        crs: N ? `EPSG:${N}` : z ? `EPSG:${z}` : void 0,
        isGeographic: !N && !!z,
        pixelIsPoint: Number(C.GTRasterTypeGeoKey || 1) === 2,
        unit: !N && z ? 'degree' : 'metre',
        transform: [Number(F[0]), 0, Number(A[0]), 0, Number(F[1]), Number(A[1])],
      };
    } catch {
      this.geoReference = null;
    }
    let I = this._getTiffLayoutInfo(r);
    this._logTiffLayout(I);
    let T = document.createElement('canvas');
    if (((T.width = m), (T.height = s), this.vscode && this._isInitialLoad))
      return (
        (this._pendingRenderData = { image: r, rasters: g, progressiveRemote: h }),
        this.vscode.postMessage({
          type: 'formatInfo',
          value: {
            width: m,
            height: s,
            sampleFormat: u,
            compression: M.Compression || 'Unknown',
            predictor: M.Predictor,
            photometricInterpretation: M.PhotometricInterpretation,
            planarConfig: M.PlanarConfiguration,
            samplesPerPixel: b,
            bitsPerSample: w,
            ...I,
            formatType: ee(u, w),
            isInitialLoad: !0,
            decodedWith: x.engine,
            pageIndex: t,
            pageCount: this.pageCount,
            ...this._omeFormatInfo(),
          },
        }),
        {
          canvas: T,
          imageData: h ? new ImageData(1, 1) : new ImageData(m, s),
          tiffData: this.rawTiffData,
          decodeInfo: x,
        }
      );
    if (h)
      return (
        (this._isInitialLoad = !1),
        { canvas: T, imageData: new ImageData(1, 1), tiffData: this.rawTiffData, decodeInfo: x }
      );
    let v = await this.renderTiff(r, g);
    return (
      console.log(
        `[TiffProcessor] HTTP-range TIFF ready in ${(performance.now() - n).toFixed(2)}ms`
      ),
      { canvas: T, imageData: v, tiffData: this.rawTiffData, decodeInfo: x }
    );
  }
  async _buildRemotePageDirectory(e) {
    let t = Math.max(1, await e.getImageCount()),
      a = [],
      n = null;
    for (let o = 0; o < t; o++) {
      let i = await e.getImage(o),
        l = Number(i.getWidth()),
        r = Number(i.getHeight()),
        f = i.fileDirectory || {},
        m = Number(f.NewSubfileType || 0),
        s = !!(m & 1) || (!!n && l < n.width && r < n.height),
        h = !!(m & 4);
      if (!n || (!s && !h)) {
        ((n = {
          index: o,
          width: l,
          height: r,
          samplesPerPixel: Number(i.getSamplesPerPixel()) || 1,
          subfileType: m,
          kind: 'image',
          parent: null,
          reduction: 1,
          subIfdCount: Number(f.SubIFDs?.length || 0),
          blockWidth: Number(f.TileWidth || l),
          blockHeight: Number(f.TileLength || f.RowsPerStrip || r),
        }),
          a.push(n));
        continue;
      }
      a.push({
        index: o,
        width: l,
        height: r,
        samplesPerPixel: Number(i.getSamplesPerPixel()) || 1,
        subfileType: m,
        kind: h ? 'mask' : 'overview',
        parent: n.index,
        reduction: Math.max(1, Math.round(n.width / Math.max(1, l))),
        subIfdCount: Number(f.SubIFDs?.length || 0),
        blockWidth: Number(f.TileWidth || l),
        blockHeight: Number(f.TileLength || f.RowsPerStrip || r),
      });
    }
    return a;
  }
  async _readRemoteRasters(e, t) {
    if (this._remoteDecodePool)
      try {
        return await e.readRasters({ ...t, pool: this._remoteDecodePool });
      } catch (a) {
        if (a?.name === 'AbortError') throw a;
        (console.warn(
          '[TiffProcessor] Remote decode pool unavailable; decoding fetched blocks locally:',
          a
        ),
          this._remoteDecodePool.destroy?.(),
          (this._remoteDecodePool = null));
      }
    return e.readRasters(t);
  }
  _omeFormatInfo() {
    let e = this.omeMetadata;
    return e
      ? {
          isOmeTiff: !0,
          formatLabel: 'OME-TIFF',
          omeSizeC: e.planeSizeC,
          omeSizeZ: e.sizeZ,
          omeSizeT: e.sizeT,
          dimensionOrder: e.dimensionOrder,
          channelNames: e.channels.map(t => t.name),
          physicalSizeX: e.physicalSizeX,
          physicalSizeXUnit: e.physicalSizeXUnit,
          physicalSizeY: e.physicalSizeY,
          physicalSizeYUnit: e.physicalSizeYUnit,
          physicalSizeZ: e.physicalSizeZ,
          physicalSizeZUnit: e.physicalSizeZUnit,
        }
      : {};
  }
  async renderTiffWithSettings(e, t, a = {}) {
    ((this._lastRenderHistogram = null), (this._lastRenderUsedWebGL = !1));
    let n = this.settingsManager.settings,
      o = e.getWidth(),
      i = e.getHeight(),
      l = e.getSampleFormat(),
      r = e.getBitsPerSample(),
      f = this.selectableBandCount,
      m = f > 1 ? Math.min(f - 1, Math.max(0, this.displayBand)) : 0,
      s =
        f > 1 && this.displayRgbBands
          ? this.displayRgbBands.map(S => t[S])
          : f > 1 && t?.[m]
            ? [t[m]]
            : t,
      h = f > 1 && Array.isArray(l) ? (l[m] ?? l[0]) : l;
    D.mark('raster-copy-skipped');
    let g = s.length,
      u = (Array.isArray(h) ? h.includes(3) : h === 3) || Q(h, r),
      b =
        s.length > 0 &&
        s.every(
          S => ArrayBuffer.isView(S) && !(S instanceof Float32Array) && !(S instanceof Float64Array)
        );
    if (!u && b) D.mark('finite-scan-skipped');
    else if (!u) {
      e: for (let S = 0; S < s.length; S++)
        for (let B = 0; B < s[S].length; B++)
          if (!Number.isFinite(s[S][B])) {
            u = !0;
            break e;
          }
      D.mark('finite-scan');
    }
    let w = n.rgbAs24BitGrayscale || !1;
    this._lastStatisticsRgb24Mode !== w && (this._lastStatistics = null);
    let _ = this._lastStatistics,
      c = n.normalization?.gammaMode || !1,
      M = this._gdalNodata;
    if (!_ && _e.needsStats(n)) {
      if (u) {
        let S = 1 / 0,
          B = -1 / 0;
        if (n.rgbAs24BitGrayscale && s.length >= 3) {
          let $ = s[0],
            W = s[1],
            U = s[2];
          for (let R = 0; R < s[0].length; R++) {
            let P = $[R],
              j = W[R],
              G = U[R],
              L =
                P === P && P !== 1 / 0 && P !== -1 / 0
                  ? Math.round(Math.max(0, Math.min(255, P)))
                  : 0,
              re =
                j === j && j !== 1 / 0 && j !== -1 / 0
                  ? Math.round(Math.max(0, Math.min(255, j)))
                  : 0,
              J =
                G === G && G !== 1 / 0 && G !== -1 / 0
                  ? Math.round(Math.max(0, Math.min(255, G)))
                  : 0,
              V = (L << 16) | (re << 8) | J;
            (V < S && (S = V), V > B && (B = V));
          }
        } else {
          let $ = s.length === 2 ? 1 : Math.min(s.length, 3);
          for (let W = 0; W < $; W++) {
            let U = s[W];
            for (let R = 0; R < U.length; R++) {
              let P = U[R];
              P === P &&
                P !== 1 / 0 &&
                P !== -1 / 0 &&
                P !== M &&
                (P < S && (S = P), P > B && (B = P));
            }
          }
        }
        _ = { min: S, max: B };
      } else {
        let S = 1 / 0,
          B = -1 / 0;
        if (n.rgbAs24BitGrayscale && s.length >= 3) {
          let $ = s[0],
            W = s[1],
            U = s[2];
          for (let R = 0; R < s[0].length; R++) {
            let P = Math.round(Math.max(0, Math.min(255, $[R]))),
              j = Math.round(Math.max(0, Math.min(255, W[R]))),
              G = Math.round(Math.max(0, Math.min(255, U[R]))),
              L = (P << 16) | (j << 8) | G;
            (L < S && (S = L), L > B && (B = L));
          }
        } else {
          let $ = s.length === 2 ? 1 : Math.min(s.length, 3);
          for (let W = 0; W < $; W++) {
            let U = s[W];
            for (let R = 0; R < U.length; R++) {
              let P = U[R];
              P === P &&
                P !== 1 / 0 &&
                P !== -1 / 0 &&
                P !== M &&
                (P < S && (S = P), P > B && (B = P));
            }
          }
        }
        _ = { min: S, max: B };
      }
      ((this._lastStatistics = _), (this._lastStatisticsRgb24Mode = w), D.mark('stats'));
    }
    this.vscode && _ && this.vscode.postMessage({ type: 'stats', value: _ });
    let I = this._getNanColor(n),
      T,
      v = o * i,
      A = f > 1 ? s[0] : this.rawTiffData?.data;
    if (
      A &&
      A.length === v * g &&
      (u
        ? A instanceof Float32Array
        : r > 8
          ? A instanceof Uint16Array
          : A instanceof Uint8Array || A instanceof Uint8ClampedArray)
    )
      ((T = A), D.mark('interleave-skipped'));
    else {
      if (
        (u
          ? (T = new Float32Array(v * g))
          : r > 8
            ? (T = new Uint16Array(v * g))
            : (T = new Uint8Array(v * g)),
        g === 1)
      )
        T.set(s[0]);
      else for (let S = 0; S < v; S++) for (let B = 0; B < g; B++) T[S * g + B] = s[B][S];
      D.mark('interleave');
    }
    let C = Z(h, r),
      N = {
        nanColor: I,
        rgbAs24BitGrayscale: n.rgbAs24BitGrayscale,
        typeMax: C,
        collectHistogram: a.collectHistogram === !0,
        extraSamplesAreAlpha: f > 1 ? !1 : this._extraSamplesAreAlpha,
        nodataValue: this._gdalNodata,
      },
      z = a.targetCanvas;
    if (
      z &&
      this._webglRenderer.canRender({
        data: T,
        width: o,
        height: i,
        channels: g,
        isFloat: u,
        settings: n,
        collectHistogram: a.collectHistogram === !0,
      }) &&
      this._webglRenderer.render(z, {
        data: T,
        width: o,
        height: i,
        isFloat: u,
        min: _ && Number.isFinite(_.min) ? _.min : 0,
        max: _ && Number.isFinite(_.max) ? _.max : C,
        typeMax: C,
        settings: n,
        nanColor: I,
        nodataValue: this._gdalNodata,
        channels: g,
      })
    )
      return (
        (this._lastRenderUsedWebGL = !0),
        (this._lastRenderHistogram = null),
        a.placeholderImageData || new ImageData(o, i)
      );
    let H = we.render(T, o, i, g, u, _ || { min: 0, max: 1 }, n, N);
    return ((this._lastRenderHistogram = N.renderHistogramResult || null), H);
  }
  _chooseOpenLevel(e, t, a) {
    if (typeof e?.tiff_page_directory != 'function') return 0;
    let n = [];
    try {
      n = se(e.tiff_page_directory(new Uint8Array(t)));
    } catch {
      return 0;
    }
    if (n.length < 2) return 0;
    let o = (l, r) =>
        l <= a.maxAxis && r <= a.maxAxis && l * r <= a.maxArea && l * r * 4 <= a.maxBytes,
      i = pe(n, 0, a.displayWidth, o, 1, a.pixelBudget);
    return !i || i.index === 0
      ? 0
      : (console.log(
          `[TiffProcessor] Opening at level 1/${i.reduction} (${i.width}x${i.height}): full resolution is either not displayable or larger than is worth decoding for this window`
        ),
        D.note('tiff-open-level', `1/${i.reduction} ${i.width}x${i.height}`),
        i.index);
  }
  async readStoredPixel(e, t) {
    if (!this._sourceBuffer && !this._remoteTiff) return null;
    let a = this.pageDirectory.find(i => i.index === this.pageIndex),
      n = a && a.reduction > 1 ? a.reduction : 1;
    if (n === 1) return null;
    let o = a?.parent ?? 0;
    try {
      let i = Math.floor(e * n + n / 2),
        l = Math.floor(t * n + n / 2),
        r = await this._decodeRegionRaw(o, { x: i, y: l, width: 1, height: 1 });
      if (!r) return null;
      let f = Array.from(r.data);
      if (!f.length) return null;
      let m = this._formatDeclaredSamples(f);
      if (m !== null) return m;
      let s = Number(r.sampleFormat ?? this.rawTiffData?.ifd?.t339);
      return f.map(h => (s === 3 ? h.toPrecision(4) : String(h))).join(' ');
    } catch {
      return null;
    }
  }
  async readFullResolutionPixel(e, t) {
    let n = this.pageDirectory.find(r => r.index === this.pageIndex)?.parent ?? this.pageIndex,
      o = Math.floor(e),
      i = Math.floor(t),
      l = this.readCachedFullResolutionPixel(o, i);
    if (l !== null) return l;
    try {
      let r = this.pageDirectory.find(_ => _.index === n),
        f = Math.max(1, Number(r?.blockWidth || 1)),
        m = Math.max(1, Number(r?.blockHeight || 1)),
        h =
          f * m * Math.max(1, Number(r?.samplesPerPixel || 1)) <= 2e6
            ? {
                x: Math.floor(o / f) * f,
                y: Math.floor(i / m) * m,
                width: Math.min(f, Math.max(1, Number(r?.width || o + 1) - Math.floor(o / f) * f)),
                height: Math.min(
                  m,
                  Math.max(1, Number(r?.height || i + 1) - Math.floor(i / m) * m)
                ),
              }
            : { x: o, y: i, width: 1, height: 1 },
        g = await this._decodeRegionRaw(n, h);
      if (!g?.data?.length) return null;
      this._cacheRegionSamples(n, h.x, h.y, g);
      let x = this.readCachedFullResolutionPixel(o, i);
      if (x !== null) return x;
      let u = Array.from(g.data),
        b = this._formatDeclaredSamples(u);
      if (b !== null) return b;
      let w = Number(g.sampleFormat ?? this.rawTiffData?.ifd?.t339);
      return u.map(_ => (w === 3 ? _.toPrecision(4) : String(_))).join(' ');
    } catch {
      return null;
    }
  }
  async _decodeRegionRaw(e, t, a) {
    if (this._remoteTiff && this._remoteTiffUrl) {
      let r = this._remoteTiff,
        f = await this._decodeRemoteRegionRaw(e, t, a);
      return r === this._remoteTiff && !a?.aborted ? f : null;
    }
    let n = this._sourceBuffer,
      o = this._regionSourceGeneration;
    if (n && e === 0 && this.hasGeneratedPreview && !a?.aborted) {
      let r = ae() || (await te()),
        f = await Ee(n, r, t, a);
      if (a?.aborted || o !== this._regionSourceGeneration || n !== this._sourceBuffer) return null;
      if (f) return f;
    }
    let i = () => {},
      l = new Promise(r => {
        i = r;
      });
    return (
      (this._regionDecodeQueue = this._regionDecodeQueue
        .then(async () => {
          let r = n;
          if (a?.aborted || !r || o !== this._regionSourceGeneration || r !== this._sourceBuffer) {
            i(null);
            return;
          }
          let f = `${this._sourceBufferSrc || 'tiff'}#regions-${this._regionSourceGeneration}`;
          if (
            (this.decodeWorker &&
              !this.decodeWorker.canDecode('tiff-region') &&
              (await Promise.race([
                this.decodeWorker.start(),
                new Promise(m => setTimeout(m, 750)),
              ])),
            a?.aborted || o !== this._regionSourceGeneration)
          ) {
            i(null);
            return;
          }
          if (this.decodeWorker?.canDecode('tiff-region')) {
            let m = async h =>
                this.decodeWorker.decode('tiff-region', h ? r.slice(0) : new ArrayBuffer(0), {
                  pageIndex: e,
                  rect: t,
                  sourceCacheKey: f,
                }),
              s = await m(!this._regionWorkerPrimed);
            if (
              (!s?.ok &&
                this._regionWorkerPrimed &&
                ((this._regionWorkerPrimed = !1), (s = await m(!0))),
              s?.ok)
            ) {
              ((this._regionWorkerPrimed = !0), i(s.result));
              return;
            }
          }
          try {
            let m = ae() || (await te());
            if (!m || typeof m.decode_tiff_region != 'function') {
              i(null);
              return;
            }
            let s = m.decode_tiff_region(new Uint8Array(r), e, t.x, t.y, t.width, t.height);
            i({
              width: Number(s.width),
              height: Number(s.height),
              channels: Number(s.channels),
              bitsPerSample: Number(s.bits_per_sample),
              sampleFormat: Number(s.sample_format),
              blocksDecoded: Number(s.blocks_decoded),
              data: s.take_data_as_f32(),
            });
          } catch {
            i(null);
          }
        })
        .catch(() => {
          i(null);
        })),
      l
    );
  }
  async _decodeRemoteRegionRaw(e, t, a) {
    try {
      let n = await this._remoteTiff.getImage(e),
        o = Math.max(0, Math.min(Math.floor(t.x), n.getWidth() - 1)),
        i = Math.max(0, Math.min(Math.floor(t.y), n.getHeight() - 1)),
        l = Math.max(1, Math.min(Math.ceil(t.width), n.getWidth() - o)),
        r = Math.max(1, Math.min(Math.ceil(t.height), n.getHeight() - i));
      if (a?.aborted) return null;
      let m =
          this._regionSampleCache.get(`${e}:${o}:${i}:${l}:${r}`)?.planes ||
          (await this._readRemoteRasters(n, {
            window: [o, i, o + l, i + r],
            signal: a || this.loadSignal,
          })),
        s = m.length,
        h = new Float32Array(l * r * s);
      for (let x = 0; x < l * r; x++) for (let u = 0; u < s; u++) h[x * s + u] = Number(m[u][x]);
      let g = n.getSampleFormat();
      return {
        width: l,
        height: r,
        channels: s,
        data: h,
        sourceRasters: m,
        bitsPerSample: Number(n.getBitsPerSample()),
        sampleFormat: Number(Array.isArray(g) ? g[0] : g),
        blocksDecoded: void 0,
      };
    } catch {
      return null;
    }
  }
  async renderRegion(e, t, a) {
    return this._renderRegion(e, t, a, !1);
  }
  async renderRegionCanvas(e, t, a) {
    return this._renderRegion(e, t, a, !0);
  }
  async _renderRegion(e, t, a, n) {
    if (!this._sourceBuffer && !this._remoteTiff) return null;
    try {
      let o = this._regionSourceGeneration,
        i = await this._decodeRegionRaw(e, t, a);
      if (!i || a?.aborted || o !== this._regionSourceGeneration) return null;
      let l = Number(i.width),
        r = Number(i.height),
        f = Number(i.channels),
        m = i.data;
      if (!m.length) return null;
      this._cacheRegionSamples(e, Math.floor(t.x), Math.floor(t.y), i);
      let s = this.settingsManager.settings,
        h = this.rawTiffData?.ifd?.t258 ?? i.bitsPerSample,
        g = this.rawTiffData?.ifd?.t339 ?? i.sampleFormat,
        x = this.selectableBandCount,
        u = x > 1 ? Math.min(f - 1, Math.max(0, this.displayBand)) : 0,
        b = f,
        w = m;
      if (x > 1 && f > 1) {
        let c = this.displayRgbBands || [u];
        ((b = c.length), (w = new Float32Array(l * r * b)));
        for (let M = 0; M < l * r; M++) for (let I = 0; I < b; I++) w[M * b + I] = m[M * f + c[I]];
      }
      if (!this._lastStatistics && _e.needsStats(s)) {
        let c = b === 2 ? 1 : Math.min(b, 3),
          M = 1 / 0,
          I = -1 / 0;
        for (let T = 0; T < l * r; T++)
          for (let v = 0; v < c; v++) {
            let A = w[T * b + v];
            !Number.isFinite(A) || A === this._gdalNodata || (A < M && (M = A), A > I && (I = A));
          }
        Number.isFinite(M) &&
          Number.isFinite(I) &&
          ((this._lastStatistics = { min: M, max: I }),
          this.vscode?.postMessage?.({ type: 'stats', value: this._lastStatistics }));
      }
      if (a?.aborted) return null;
      let _ = {
        data: w,
        width: l,
        height: r,
        channels: b,
        isFloat: !0,
        settings: s,
        typeMax: Z(g, h),
        min: this._lastStatistics?.min ?? 0,
        max: this._lastStatistics?.max ?? 1,
        nanColor: this._getNanColor(s),
        nodataValue: this._gdalNodata,
      };
      if (
        n &&
        b === 1 &&
        (!s.displayColormap || s.displayColormap === 'none') &&
        this._regionWebglRenderer.canRender(_) &&
        (this._regionGpuCanvas || (this._regionGpuCanvas = document.createElement('canvas')),
        this._regionWebglRenderer.render(this._regionGpuCanvas, _))
      ) {
        let c = document.createElement('canvas');
        ((c.width = l), (c.height = r));
        let M = c.getContext('2d');
        if (M)
          return (M.drawImage(this._regionGpuCanvas, 0, 0), (c.dataset.renderBackend = 'webgl'), c);
      }
      return we.render(
        w,
        l,
        r,
        b,
        g === 3 || (x > 1 && Q(g, h)),
        this._lastStatistics || { min: 0, max: 1 },
        s,
        {
          nanColor: this._getNanColor(s),
          typeMax: Z(g, h),
          extraSamplesAreAlpha: x > 1 ? !1 : this._extraSamplesAreAlpha,
          nodataValue: this._gdalNodata,
        }
      );
    } catch {
      return null;
    }
  }
  async renderTiffWithSettingsFast(e, t, a = {}) {
    return this.renderTiffWithSettings(e, t, a);
  }
  async renderTiff(e, t, a = {}) {
    return this.renderTiffWithSettings(e, t, a);
  }
  getColorAtPixel(e, t, a, n) {
    if (this._convertedFloatData) {
      let u = t * a + e,
        b = this._convertedFloatData.floatData[u];
      return b === void 0 ? '' : b.toPrecision(6);
    }
    if (
      !this.rawTiffData ||
      !Number.isFinite(e) ||
      !Number.isFinite(t) ||
      e < 0 ||
      t < 0 ||
      e >= a ||
      t >= n
    )
      return '';
    let o = this.rawTiffData.ifd,
      i = this.rawTiffData.data;
    if (!o || !i?.length) return '';
    let l = t * a + e,
      r = o.t339,
      f = o.t277,
      m = o.t284,
      s = o.t258,
      h = this.settingsManager.settings,
      g = [];
    if (m === 2) {
      let u = a * n;
      for (let b = 0; b < f; b++) g.push(i[l + b * u]);
    } else for (let u = 0; u < f; u++) g.push(i[l * f + u]);
    if (g.some(u => u === void 0)) return '';
    let x = this._formatDeclaredSamples(g);
    if (x !== null) return x;
    if (f === 1) {
      let u = i[l];
      if (h.normalizedFloatMode && r !== 3) {
        let b = Z(r, s);
        return (u / b).toPrecision(4);
      }
      return r === 3 ? u.toPrecision(4) : u.toString();
    } else if (f === 2) {
      let u = c => (r === 3 ? c.toPrecision(4) : c.toString()),
        b = this._extraSamplesAreAlpha === !0 ? '\u03B1' : 'C2',
        w,
        _;
      if (m === 2) {
        let c = a * n;
        ((w = i[l]), (_ = i[l + c]));
      } else ((w = i[l * 2]), (_ = i[l * 2 + 1]));
      if (h.normalizedFloatMode && r !== 3) {
        let c = Z(r, s);
        return `${(w / c).toPrecision(4)} ${b}:${(_ / c).toPrecision(4)}`;
      }
      return `${u(w)} ${b}:${u(_)}`;
    } else if (f >= 3) {
      let u = w =>
          r === 3 ? w.toPrecision(4) : r === 2 ? w.toString() : w.toString().padStart(3, '0'),
        b = [];
      if (m === 2) {
        let w = a * n;
        for (let _ = 0; _ < f; _++) b.push(u(i[l + _ * w]));
      } else for (let w = 0; w < f; w++) b.push(u(i[l * f + w]));
      if (h.rgbAs24BitGrayscale && f >= 3) {
        let w = parseInt(b[0]),
          _ = parseInt(b[1]),
          c = parseInt(b[2]),
          M = (w << 16) | (_ << 8) | c,
          I = h.scale24BitFactor || 1e3;
        return (M / I).toFixed(3);
      }
      return r === 3 ? b.join(' ') : b.slice(0, 3).join(' ');
    }
    return '';
  }
  async fastParameterUpdate(e) {
    return null;
  }
  async performDeferredRender(e = {}) {
    let t = performance.now();
    if (!this._pendingRenderData) return null;
    let { image: a, rasters: n, progressiveRemote: o } = this._pendingRenderData;
    if (((this._pendingRenderData = null), (this._isInitialLoad = !1), o))
      return e.placeholderImageData || new ImageData(1, 1);
    let i = await this.renderTiff(a, n, e);
    return (
      console.log(`[TiffProcessor] Deferred render took ${(performance.now() - t).toFixed(2)}ms`),
      i
    );
  }
};
export {
  je as TiffProcessor,
  ee as tiffFormatTypeFor,
  Q as tiffNeedsFloatCarrier,
  Z as tiffTypeMax,
};
