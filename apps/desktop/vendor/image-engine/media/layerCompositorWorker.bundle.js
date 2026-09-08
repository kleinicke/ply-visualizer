'use strict';
(() => {
  var re = [
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
    We = new Set(re.map(r => r.id)),
    $t = new Set(re.filter(r => r.arithmetic).map(r => r.id)),
    Ke = new Set([
      'normal',
      'multiply',
      'screen',
      'overlay',
      'darken',
      'lighten',
      'difference',
      'exclusion',
    ]);
  function Je(r, t) {
    if (!t) return !0;
    let e = t.threshold ?? 0;
    switch (t.op) {
      case 'gt':
        return r > e;
      case 'ge':
        return r >= e;
      case 'lt':
        return r < e;
      case 'le':
        return r <= e;
      case 'eq':
        return r === e;
      case 'isfinite':
        return Number.isFinite(r);
      case 'isnan':
        return !Number.isFinite(r);
      default:
        return !0;
    }
  }
  function Qe(r, t, e) {
    switch (e) {
      case 'add':
        return r + t;
      case 'subtract':
        return r - t;
      case 'difference':
      case 'raw-difference':
        return Math.abs(r - t);
      case 'raw-multiply':
        return r * t;
      case 'divide':
        return t === 0 ? NaN : r / t;
      case 'min':
        return Math.min(r, t);
      case 'max':
        return Math.max(r, t);
      case 'average':
        return (r + t) * 0.5;
      case 'normal':
      default:
        return t;
    }
  }
  function Ze(r, t, e, n = 1) {
    let s = Number.isFinite(n) && n > 0 ? n : 1;
    switch (e) {
      case 'multiply':
        return (r * t) / s;
      case 'screen':
        return s - ((s - r) * (s - t)) / s;
      case 'overlay':
        return r <= s * 0.5 ? (2 * r * t) / s : s - (2 * (s - r) * (s - t)) / s;
      case 'darken':
        return Math.min(r, t);
      case 'lighten':
        return Math.max(r, t);
      case 'difference':
        return Math.abs(r - t);
      case 'exclusion':
        return r + t - (2 * r * t) / s;
      case 'normal':
      default:
        return t;
    }
  }
  function D(r, t, e) {
    return e <= 0
      ? r
      : e >= 1
        ? t
        : Number.isFinite(r) && Number.isFinite(t)
          ? r + (t - r) * e
          : NaN;
  }
  function P(r, t, e, n, s) {
    return n <= 0 || e >= 1
      ? t
      : !Number.isFinite(r) || !Number.isFinite(t)
        ? NaN
        : (t * e + r * n * (1 - e)) / s;
  }
  function ne(r, t, e, n, s, i, _) {
    if (s <= 0) return t;
    if (e === 'normal') return P(r, t, n, s, i);
    if (!Number.isFinite(r) || !Number.isFinite(t)) return NaN;
    let a = Ze(r, t, e, _);
    return ((1 - n) * s * r + (1 - s) * n * t + s * n * a) / i;
  }
  function tt(r, t, e, n, s) {
    let i = t[e] > 0,
      _ = s === 4 ? 3 : s;
    for (let a = 0; a < _; a++) r[n + a] = NaN;
    return ((t[e] = 1), s === 4 && (r[n + 3] = 1), i ? 0 : 1);
  }
  function He(r) {
    return r.some(t => $t.has(t.blendMode ?? 'normal'))
      ? r.some(t => t.channels >= 3)
        ? 3
        : 1
      : r.some(t => t.channels === 2 || t.channels === 4)
        ? 4
        : r.some(t => t.channels >= 3)
          ? 3
          : 1;
  }
  function tr(r, t, e, n, s, i = 1) {
    let _ = (e * r.width + t) * r.channels,
      a = r.data;
    if (r.channels === 1) {
      let c = a[_] * i;
      for (let l = 0; l < n; l++) s[l] = l === 3 ? r.typeMax || 1 : c;
    } else if (r.channels === 2) {
      let c = a[_] * i;
      for (let l = 0; l < n; l++) s[l] = l === 3 ? a[_ + 1] : c;
    } else
      for (let c = 0; c < n; c++) {
        let l = a[_ + Math.min(c, r.channels - 1)];
        s[c] = c === 3 ? l : l * i;
      }
  }
  function er(r, t, e, n, s, i, _, a, c, l, d, u, f, x) {
    let b = r.data,
      m = r.channels,
      v = u >= 1,
      w = x / (r.typeMax || x);
    if (n === 4 && m <= 2) {
      for (let p = _; p < c; p++) {
        let y = p * s + i,
          g = y * 4,
          h = ((p - d) * r.width + (i - l)) * m;
        for (let M = i; M < a; M++, y++, g += 4, h += m) {
          let F = m === 2 ? Number(b[h + 1]) / (r.typeMax || x) : 1;
          if (!Number.isFinite(F)) {
            f += tt(t, e, y, g, 4);
            continue;
          }
          let j = Math.max(0, Math.min(1, F * u));
          if (j <= 0) continue;
          let L = Number(b[h]) * w,
            S = e[y],
            C = j + S * (1 - j);
          (S <= 0
            ? ((t[g] = t[g + 1] = t[g + 2] = L), f++)
            : ((t[g] = P(t[g], L, j, S, C)),
              (t[g + 1] = P(t[g + 1], L, j, S, C)),
              (t[g + 2] = P(t[g + 2], L, j, S, C))),
            (e[y] = C),
            (t[g + 3] = C));
        }
      }
      return f;
    }
    if (n === 4 && m >= 3) {
      for (let p = _; p < c; p++) {
        let y = p * s + i,
          g = y * 4,
          h = ((p - d) * r.width + (i - l)) * m;
        for (let M = i; M < a; M++, y++, g += 4, h += m) {
          let F = m === 4 ? Number(b[h + 3]) / (r.typeMax || 255) : 1;
          if (!Number.isFinite(F)) {
            f += tt(t, e, y, g, 4);
            continue;
          }
          let j = Math.max(0, Math.min(1, F * u));
          if (j <= 0) continue;
          let L = e[y],
            S = j + L * (1 - j),
            C = b[h] * w,
            Q = b[h + 1] * w,
            Z = b[h + 2] * w;
          (L <= 0
            ? ((t[g] = C), (t[g + 1] = Q), (t[g + 2] = Z), f++)
            : ((t[g] = P(t[g], C, j, L, S)),
              (t[g + 1] = P(t[g + 1], Q, j, L, S)),
              (t[g + 2] = P(t[g + 2], Z, j, L, S))),
            (e[y] = S),
            (t[g + 3] = S));
        }
      }
      return f;
    }
    if (n === 1 && m === 1) {
      for (let p = _; p < c; p++) {
        let y = p * s + i,
          g = (p - d) * r.width + (i - l);
        for (let h = i; h < a; h++, y++, g++) {
          let M = b[g] * w;
          e[y] ? (t[y] = D(t[y], M, u)) : ((t[y] = M), (e[y] = 1), f++);
        }
      }
      return f;
    }
    if (n === 3 && m === 1) {
      for (let p = _; p < c; p++) {
        let y = p * s + i,
          g = y * 3,
          h = (p - d) * r.width + (i - l);
        for (let M = i; M < a; M++, y++, g += 3, h++) {
          let F = b[h] * w;
          e[y]
            ? v
              ? ((t[g] = F), (t[g + 1] = F), (t[g + 2] = F))
              : ((t[g] = D(t[g], F, u)),
                (t[g + 1] = D(t[g + 1], F, u)),
                (t[g + 2] = D(t[g + 2], F, u)))
            : ((t[g] = F), (t[g + 1] = F), (t[g + 2] = F), (e[y] = 1), f++);
        }
      }
      return f;
    }
    if (n === 3 && m === 4) {
      for (let p = _; p < c; p++) {
        let y = p * s + i,
          g = y * 3,
          h = ((p - d) * r.width + (i - l)) * 4;
        for (let M = i; M < a; M++, y++, g += 3, h += 4) {
          let F = Number(b[h + 3]) / (r.typeMax || 255);
          if (!Number.isFinite(F)) {
            f += tt(t, e, y, g, 3);
            continue;
          }
          let j = Math.max(0, Math.min(1, F * u));
          if (j <= 0) continue;
          let L = b[h] * w,
            S = b[h + 1] * w,
            C = b[h + 2] * w;
          e[y]
            ? ((t[g] = D(t[g], L, j)),
              (t[g + 1] = D(t[g + 1], S, j)),
              (t[g + 2] = D(t[g + 2], C, j)))
            : ((t[g] = L), (t[g + 1] = S), (t[g + 2] = C), (e[y] = 1), f++);
        }
      }
      return f;
    }
    if (n === 3 && m >= 3)
      for (let p = _; p < c; p++) {
        let y = p * s + i,
          g = y * 3,
          h = ((p - d) * r.width + (i - l)) * m;
        for (let M = i; M < a; M++, y++, g += 3, h += m) {
          let F = b[h] * w,
            j = b[h + 1] * w,
            L = b[h + 2] * w;
          e[y]
            ? v
              ? ((t[g] = F), (t[g + 1] = j), (t[g + 2] = L))
              : ((t[g] = D(t[g], F, u)),
                (t[g + 1] = D(t[g + 1], j, u)),
                (t[g + 2] = D(t[g + 2], L, u)))
            : ((t[g] = F), (t[g + 1] = j), (t[g + 2] = L), (e[y] = 1), f++);
        }
      }
    return f;
  }
  function rr(r, t, e, n, s, i, _) {
    let a = r.data,
      c = r.typeMax || _,
      l = _ / c;
    for (let d = 0, u = 0; d < e.length; d++, u += 4) {
      let f = Math.max(0, Math.min(1, (Number(a[u + 3]) / c) * s));
      if (!Number.isFinite(f)) {
        i += tt(t, e, d, u, 4);
        continue;
      }
      if (f <= 0) continue;
      let x = e[d],
        b = f + x * (1 - f);
      if (x <= 0) ((t[u] = a[u] * l), (t[u + 1] = a[u + 1] * l), (t[u + 2] = a[u + 2] * l), i++);
      else
        for (let m = 0; m < 3; m++) {
          let v = Number(a[u + m]) * l,
            w = t[u + m];
          t[u + m] = ne(w, v, n, f, x, b, _);
        }
      ((e[d] = b), (t[u + 3] = b));
    }
    return i;
  }
  function Pt(r, t, e) {
    let n = r.rasterMask;
    if (!n) return 1;
    let s = t - Math.round(n.offsetX ?? r.offsetX ?? 0),
      i = e - Math.round(n.offsetY ?? r.offsetY ?? 0);
    if (s < 0 || i < 0 || s >= n.width || i >= n.height) return n.invert ? 1 : 0;
    let _ = Math.max(1, n.channels ?? 1),
      a = Number(n.data[(i * n.width + s) * _]),
      c = Number.isFinite(a) ? a / (n.typeMax || 255) : 0;
    return ((c = Math.max(0, Math.min(1, c))), n.invert ? 1 - c : c);
  }
  function se(r, t, e) {
    let n = t - Math.round(r.offsetX ?? 0),
      s = e - Math.round(r.offsetY ?? 0);
    if (n < 0 || s < 0 || n >= r.width || s >= r.height || !r.data) return 0;
    let i = (s * r.width + n) * r.channels,
      _ = Pt(r, t, e) * Math.max(0, Math.min(1, r.opacity ?? 1));
    if (_ <= 0) return 0;
    let a =
      r.channels === 2 || r.channels === 4
        ? Number(r.data[i + r.channels - 1]) / (r.typeMax || 255)
        : 1;
    return Number.isFinite(a) ? Math.max(0, Math.min(1, a * _)) : NaN;
  }
  function nr(r, t, e) {
    let n = new Float32Array(t * e),
      s = Math.max(0, Math.round(r.offsetX ?? 0)),
      i = Math.max(0, Math.round(r.offsetY ?? 0)),
      _ = Math.min(t, Math.round(r.offsetX ?? 0) + r.width),
      a = Math.min(e, Math.round(r.offsetY ?? 0) + r.height);
    for (let c = i; c < a; c++) for (let l = s; l < _; l++) n[c * t + l] = se(r, l, c);
    return n;
  }
  var Zt = new WeakMap(),
    gt = { groupHits: 0, groupMisses: 0, clippingHits: 0, clippingMisses: 0 };
  function oe(r, t, e, n, s = new Set()) {
    let i = r.filter(a => (a.parentId || void 0) === n),
      _ = [];
    for (let a of i) {
      if (a.kind !== 'group') {
        (a.data || (a.kind === 'adjustment' && a.adjustment)) && _.push(a);
        continue;
      }
      let c = a.id || '';
      if (!c || s.has(c)) continue;
      let l = new Set(s);
      l.add(c);
      let d = oe(r, t, e, c, l),
        u = d.map(b => _e(b)),
        f = Zt.get(a),
        x;
      (f && f.width === t && f.height === e && ce(f.snapshots, u)
        ? (gt.groupHits++, (x = f.surface))
        : (gt.groupMisses++,
          (x = le(d, t, e)),
          Zt.set(a, { snapshots: u, width: t, height: e, surface: x })),
        _.push({
          ...a,
          kind: 'raster',
          parentId: void 0,
          data: x.data,
          width: t,
          height: e,
          channels: x.channels,
          isFloat: x.isFloat,
          typeMax: x.typeMax,
          offsetX: a.offsetX ?? 0,
          offsetY: a.offsetY ?? 0,
        }));
    }
    return _;
  }
  function Bt(r, t) {
    let e = r
      .filter(n => Number.isFinite(n.input) && Number.isFinite(n.output))
      .sort((n, s) => n.input - s.input)
      .filter((n, s, i) => s === 0 || n.input !== i[s - 1].input);
    if (!e.length) return t;
    if (t <= e[0].input) return e[0].output;
    for (let n = 1; n < e.length; n++)
      if (t <= e[n].input) {
        let s = e[n - 1],
          i = e[n],
          _ = i.input - s.input;
        if (!_) return i.output;
        let a = e[Math.max(0, n - 2)],
          c = e[Math.min(e.length - 1, n + 1)],
          l = (w, p) => (p.output - w.output) / Math.max(1e-6, p.input - w.input),
          d = l(s, i),
          u = n === 1 ? d : (l(a, s) + d) / 2,
          f = n === e.length - 1 ? d : (d + l(i, c)) / 2;
        ((!d || u * d < 0) && (u = 0), (!d || f * d < 0) && (f = 0));
        let x = (t - s.input) / _,
          b = x * x,
          m = b * x,
          v =
            (2 * m - 3 * b + 1) * s.output +
            (m - 2 * b + x) * _ * u +
            (-2 * m + 3 * b) * i.output +
            (m - b) * _ * f;
        return Math.max(Math.min(s.output, i.output), Math.min(Math.max(s.output, i.output), v));
      }
    return e[e.length - 1].output;
  }
  function Ht(r, t, e) {
    if (!t) return r;
    if (Array.isArray(t)) return (Bt(t, (r * 255) / e) * e) / 255;
    let n = (r * 255) / e,
      s = t.shadowInput ?? 0,
      i = t.highlightInput ?? 255,
      _ = Math.max(0.01, t.midtoneInput ?? 1),
      a = Math.max(0, Math.min(1, (n - s) / Math.max(1e-6, i - s))),
      c = t.shadowOutput ?? 0,
      l = t.highlightOutput ?? 255;
    return ((c + Math.pow(a, 1 / _) * (l - c)) * e) / 255;
  }
  function pt(r, t, e) {
    let n = Math.max(r, t, e),
      s = Math.min(r, t, e),
      i = n - s,
      _ = 0,
      a = (n + s) / 2;
    i && (_ = 60 * (n === r ? ((t - e) / i) % 6 : n === t ? (e - r) / i + 2 : (r - t) / i + 4));
    let c = i ? i / (1 - Math.abs(2 * a - 1)) : 0;
    return [(_ + 360) % 360, c, a];
  }
  function ie(r, t, e) {
    let n = (1 - Math.abs(2 * e - 1)) * t,
      s = n * (1 - Math.abs(((r / 60) % 2) - 1)),
      i = e - n / 2,
      [_, a, c] =
        r < 60
          ? [n, s, 0]
          : r < 120
            ? [s, n, 0]
            : r < 180
              ? [0, n, s]
              : r < 240
                ? [0, s, n]
                : r < 300
                  ? [s, 0, n]
                  : [n, 0, s];
    return [_ + i, a + i, c + i];
  }
  function ae(r, t) {
    let e = Math.abs(((r - t + 540) % 360) - 180);
    return e <= 30 ? 1 : e >= 60 ? 0 : (60 - e) / 30;
  }
  function sr(r, t, e) {
    if (!t || !['a', 'b', 'c', 'd'].every(c => Number.isFinite(t[c]))) return ae(r, e);
    let n = t.a,
      s = t.b,
      i = t.c,
      _ = t.d;
    for (; s < n;) s += 360;
    for (; i < s;) i += 360;
    for (; _ < i;) _ += 360;
    let a = 0;
    for (let c = r - 360; c <= r + 720; c += 360)
      c < n ||
        c > _ ||
        (a = Math.max(
          a,
          c < s ? (c - n) / Math.max(1e-6, s - n) : c <= i ? 1 : (_ - c) / Math.max(1e-6, _ - i)
        ));
    return Math.max(0, Math.min(1, a));
  }
  var te = new WeakMap();
  function or(r, t) {
    let e = te.get(r);
    e || ((e = new Map()), te.set(r, e));
    let n = e.get(t);
    if (n) return n;
    let s;
    return (
      r.type === 'levels' || r.type === 'curves'
        ? (s = {
            kind: 'lut',
            tables: ['red', 'green', 'blue'].map(a => {
              let c = new Float32Array(256);
              for (let l = 0; l < 256; l++) {
                let d = (l * t) / 255;
                c[l] = Ht(Ht(d, r.rgb, t), r[a], t);
              }
              return c;
            }),
          })
        : r.type === 'hue/saturation'
          ? (s = { kind: 'hue', value: r })
          : (s = { kind: 'direct', value: r }),
      e.set(t, s),
      s
    );
  }
  function ir(r, t, e) {
    let n = Math.max(0, Math.min(255, (t * 255) / e)),
      s = Math.floor(n),
      i = Math.min(255, s + 1),
      _ = n - s;
    return r[s] + (r[i] - r[s]) * _;
  }
  function X(r) {
    return Math.max(0, Math.min(1, r));
  }
  function ar(r, t, e = !1) {
    let n = [
        { position: 0, color: { r: 0, g: 0, b: 0 } },
        { position: 1, color: { r: 255, g: 255, b: 255 } },
      ],
      s = (r?.length ? r : n)
        .map(a => ({ ...a, position: X(a.position) }))
        .sort((a, c) => a.position - c.position),
      i = e ? 1 - t : t;
    if (i <= s[0].position) {
      let a = s[0].color;
      return [a.r / 255, a.g / 255, a.b / 255];
    }
    for (let a = 1; a < s.length; a++)
      if (i <= s[a].position) {
        let c = s[a - 1],
          l = s[a],
          d = (i - c.position) / Math.max(1e-6, l.position - c.position);
        return [
          c.color.r + (l.color.r - c.color.r) * d,
          c.color.g + (l.color.g - c.color.g) * d,
          c.color.b + (l.color.b - c.color.b) * d,
        ].map(u => u / 255);
      }
    let _ = s[s.length - 1].color;
    return [_.r / 255, _.g / 255, _.b / 255];
  }
  function _r(r, t, e, n) {
    let s = t,
      i = e,
      _ = n,
      a = () => 0.2126 * s + 0.7152 * i + 0.0722 * _;
    if (r.type === 'brightness/contrast') {
      let c = (r.brightness || 0) / 100,
        l = Math.max(-0.99, Math.min(0.99, (r.contrast || 0) / 100)),
        d = (1 + l) / (1 - l);
      ((s = (s - 0.5) * d + 0.5 + c), (i = (i - 0.5) * d + 0.5 + c), (_ = (_ - 0.5) * d + 0.5 + c));
    } else if (r.type === 'exposure') {
      let c = Math.pow(2, r.exposure || 0),
        l = r.offset || 0,
        d = Math.max(0.01, r.gamma ?? 1);
      ((s = Math.pow(Math.max(0, s * c + l), 1 / d)),
        (i = Math.pow(Math.max(0, i * c + l), 1 / d)),
        (_ = Math.pow(Math.max(0, _ * c + l), 1 / d)));
    } else if (r.type === 'invert') ((s = 1 - s), (i = 1 - i), (_ = 1 - _));
    else if (r.type === 'channel mixer') {
      let c = (l, d) => {
        let u = l || d;
        return (
          (s * (u.red ?? 0)) / 100 +
          (i * (u.green ?? 0)) / 100 +
          (_ * (u.blue ?? 0)) / 100 +
          (u.constant ?? 0) / 100
        );
      };
      r.monochrome
        ? (s = i = _ = c(r.gray, { red: 40, green: 40, blue: 20 }))
        : ([s, i, _] = [
            c(r.red, { red: 100 }),
            c(r.green, { green: 100 }),
            c(r.blue, { blue: 100 }),
          ]);
    } else if (r.type === 'color balance') {
      let c = pt(s, i, _)[2],
        l = a(),
        d = [
          { value: r.shadows, weight: X((0.5 - l) * 2) },
          { value: r.midtones, weight: 1 - Math.abs(l - 0.5) * 2 },
          { value: r.highlights, weight: X((l - 0.5) * 2) },
        ];
      for (let { value: u, weight: f } of d)
        u &&
          f > 0 &&
          ((s += ((u.cyanRed || 0) / 100) * f),
          (i += ((u.magentaGreen || 0) / 100) * f),
          (_ += ((u.yellowBlue || 0) / 100) * f));
      if (r.preserveLuminosity) {
        let [u, f] = pt(X(s), X(i), X(_));
        [s, i, _] = ie(u, f, c);
      }
    } else if (r.type === 'black & white') {
      let [c, l] = pt(s, i, _),
        d = [0, 60, 120, 180, 240, 300],
        u = [
          r.reds ?? 40,
          r.yellows ?? 60,
          r.greens ?? 40,
          r.cyans ?? 60,
          r.blues ?? 20,
          r.magentas ?? 80,
        ],
        f = 0,
        x = 0;
      for (let m = 0; m < d.length; m++) {
        let v = ae(c, d[m]);
        ((f += u[m] * v), (x += v));
      }
      s = i = _ = a() + (((x ? f / x : 50) - 50) / 100) * l * 0.5;
    } else if (r.type === 'threshold') s = i = _ = a() * 255 >= (r.level ?? 128) ? 1 : 0;
    else if (r.type === 'posterize') {
      let c = Math.max(2, Math.min(255, Math.round(r.levels ?? 4))),
        l = d => Math.round(d * (c - 1)) / (c - 1);
      ((s = l(s)), (i = l(i)), (_ = l(_)));
    } else r.type === 'gradient map' && ([s, i, _] = ar(r.stops, X(a()), r.reverse));
    return [X(s), X(i), X(_)];
  }
  function cr(r, t, e, n, s, i) {
    let _ = e === 4 ? 3 : e;
    if (n.kind === 'lut') {
      for (let a = 0; a < _; a++) {
        let c = r[t + a],
          l = ir(n.tables[Math.min(a, 2)], c, s);
        r[t + a] = c + (l - c) * i;
      }
      return;
    }
    if (n.kind === 'direct') {
      if (_ >= 3) {
        let a = r[t],
          c = r[t + 1],
          l = r[t + 2],
          d = _r(n.value, a / s, c / s, l / s);
        ((r[t] = a + (d[0] * s - a) * i),
          (r[t + 1] = c + (d[1] * s - c) * i),
          (r[t + 2] = l + (d[2] * s - l) * i));
      }
      return;
    }
    if (_ >= 3) {
      let a = n.value,
        c = r[t],
        l = r[t + 1],
        d = r[t + 2],
        [u, f, x] = pt(c / s, l / s, d / s);
      if (a.colorize && a.colorizeEnabled !== !1) {
        ((u = (a.colorize.hue + 360) % 360),
          (f = Math.max(0, Math.min(1, a.colorize.saturation / 100))));
        let p = Math.max(-1, Math.min(1, a.colorize.lightness / 100));
        x = p < 0 ? x * (1 + p) : x + (1 - x) * p;
      } else {
        let p = u,
          y = (h, M) => {
            !h ||
              M <= 0 ||
              ((u = (u + (h.hue || 0) * M + 360) % 360),
              (f = Math.max(0, Math.min(1, f + ((h.saturation || 0) / 100) * M))),
              (x = Math.max(0, Math.min(1, x + ((h.lightness || 0) / 100) * M))));
          };
        y(a.master, 1);
        let g = [
          ['reds', 0],
          ['yellows', 60],
          ['greens', 120],
          ['cyans', 180],
          ['blues', 240],
          ['magentas', 300],
        ];
        for (let [h, M] of g) {
          let F = a[h];
          y(F, sr(p, F, M));
        }
      }
      let b = ie(u, f, x),
        m = b[0] * s,
        v = b[1] * s,
        w = b[2] * s;
      ((r[t] = c + (m - c) * i), (r[t + 1] = l + (v - l) * i), (r[t + 2] = d + (w - d) * i));
    }
  }
  var ee = new WeakMap();
  function _e(r, t = !1) {
    return {
      id: r.id,
      data: r.data,
      adjustment: r.adjustment,
      visible: t ? !0 : r.visible,
      opacity: t ? 1 : r.opacity,
      blendMode: t ? 'normal' : r.blendMode,
      offsetX: r.offsetX,
      offsetY: r.offsetY,
      clipped: t ? !1 : r.clipped,
      width: r.width,
      height: r.height,
      channels: r.channels,
      isFloat: r.isFloat,
      typeMax: r.typeMax,
      maskCondition: r.maskCondition,
      mask: r.rasterMask,
      maskData: r.rasterMask?.data,
    };
  }
  function ce(r, t) {
    if (r.length !== t.length) return !1;
    for (let e = 0; e < r.length; e++) {
      let n = r[e],
        s = t[e];
      if (
        n.id !== s.id ||
        n.data !== s.data ||
        n.adjustment !== s.adjustment ||
        n.visible !== s.visible ||
        n.opacity !== s.opacity ||
        n.blendMode !== s.blendMode ||
        n.offsetX !== s.offsetX ||
        n.offsetY !== s.offsetY ||
        n.clipped !== s.clipped ||
        n.width !== s.width ||
        n.height !== s.height ||
        n.channels !== s.channels ||
        n.isFloat !== s.isFloat ||
        n.typeMax !== s.typeMax ||
        n.maskCondition !== s.maskCondition ||
        n.mask !== s.mask ||
        n.maskData !== s.maskData
      )
        return !1;
    }
    return !0;
  }
  function lr(r, t, e) {
    let n = [];
    for (let s = 0; s < r.length;) {
      let i = r[s];
      if (i.clipped || !i.data) {
        (n.push(i), s++);
        continue;
      }
      let _ = s + 1;
      for (; _ < r.length && r[_].clipped;) _++;
      if (_ === s + 1) {
        (n.push(i), s++);
        continue;
      }
      let a = r.slice(s, _),
        c = a.map((u, f) => _e(u, f === 0)),
        l = ee.get(i),
        d;
      if (l && l.width === t && l.height === e && ce(l.snapshots, c))
        (gt.clippingHits++, (d = l.surface));
      else {
        gt.clippingMisses++;
        let u = { ...i, visible: !0, opacity: 1, blendMode: 'normal', clipped: !1 };
        ((d = ue([u, ...a.slice(1)], t, e)),
          ee.set(i, { snapshots: c, width: t, height: e, surface: d }));
      }
      (n.push({
        ...i,
        data: d.data,
        width: t,
        height: e,
        channels: d.channels,
        isFloat: d.isFloat,
        typeMax: d.typeMax,
        offsetX: 0,
        offsetY: 0,
        rasterMask: void 0,
        clipped: !1,
      }),
        (s = _));
    }
    return n;
  }
  function le(r, t, e) {
    return ue(lr(r, t, e), t, e);
  }
  function ue(r, t, e) {
    let n = r.filter(
        w =>
          w &&
          w.visible !== !1 &&
          (w.opacity ?? 1) > 0 &&
          (w.data || (w.kind === 'adjustment' && w.adjustment))
      ),
      s = n.length ? He(n) : 1,
      i = n.find(w => w.data)?.typeMax ?? 1,
      _ = t * e,
      a = new Float32Array(_ * s);
    s !== 4 && a.fill(NaN);
    let c = new Float32Array(_),
      l = new Float32Array(s),
      d = 0,
      u = null;
    for (let w = 0; w < n.length; w++) {
      let p = n[w],
        y = Math.round(p.offsetX ?? 0),
        g = Math.round(p.offsetY ?? 0),
        h = Math.max(0, Math.min(1, p.opacity ?? 1)),
        M = We.has(p.blendMode ?? 'normal') ? (p.blendMode ?? 'normal') : 'normal',
        F = $t.has(M),
        j = Ke.has(M),
        L = M === 'mask',
        S = Math.max(0, y),
        C = Math.max(0, g),
        Q = Math.min(t, y + p.width),
        Z = Math.min(e, g + p.height),
        H = p.clipped ? u : null;
      if (!(p.clipped && !H)) {
        if (p.kind === 'adjustment' && p.adjustment) {
          let $ = i,
            Ut = or(p.adjustment, $);
          for (let O = 0; O < e; O++)
            for (let q = 0; q < t; q++) {
              let N = O * t + q;
              if (!c[N]) continue;
              let E = H ? (H[N] > 0 ? 1 : 0) : 1,
                ut = h * Pt(p, q, O) * E;
              ut > 0 && cr(a, N * s, s, Ut, $, ut);
            }
          continue;
        }
        if (M === 'normal' && !p.rasterMask && !p.clipped)
          d = er(p, a, c, s, t, S, C, Q, Z, y, g, h, d, i);
        else if (
          j &&
          s === 4 &&
          p.channels === 4 &&
          !p.rasterMask &&
          !p.clipped &&
          y === 0 &&
          g === 0 &&
          p.width === t &&
          p.height === e
        )
          d = rr(p, a, c, M, h, d, i);
        else
          for (let $ = C; $ < Z; $++) {
            let Ut = $ - g;
            for (let O = S; O < Q; O++) {
              let q = O - y,
                N = $ * t + O,
                E = N * s,
                ut = !F && !L ? i / (p.typeMax || i) : 1;
              if ((tr(p, q, Ut, s, l, ut), L)) {
                let T = p.channels >= 3 ? 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2] : l[0];
                if (c[N] && !Je(T, p.maskCondition)) {
                  for (let z = 0; z < s; z++) a[E + z] = s === 4 ? 0 : NaN;
                  ((c[N] = 0), d--);
                }
                continue;
              }
              let qe = Pt(p, O, $),
                dt = H ? H[N] : 1;
              if (F) {
                let T = h * qe * dt;
                if (T <= 0) continue;
                if (!c[N]) {
                  for (let z = 0; z < s; z++) a[E + z] = l[z];
                  ((c[N] = 1), d++);
                  continue;
                }
                for (let z = 0; z < s; z++) {
                  let V = a[E + z],
                    Yt = Qe(V, l[z], M);
                  a[E + z] =
                    T >= 1
                      ? Yt
                      : Number.isFinite(Yt) && Number.isFinite(V)
                        ? V + (Yt - V) * T
                        : NaN;
                }
                continue;
              }
              if (!j) continue;
              let Et = se(p, O, $);
              if (Et <= 0 || dt <= 0) continue;
              if (!Number.isFinite(Et) || !Number.isFinite(dt)) {
                d += tt(a, c, N, E, s);
                continue;
              }
              let ft = Et * dt;
              if (ft <= 0) continue;
              let Dt = c[N],
                Xt = ft + Dt * (1 - ft),
                Ve = s === 4 ? 3 : s;
              for (let T = 0; T < Ve; T++) {
                let z = l[T],
                  V = a[E + T];
                a[E + T] = ne(V, z, M, ft, Dt, Xt, i);
              }
              (Dt || d++, (c[N] = Xt), s === 4 && (a[E + 3] = Xt));
            }
          }
        p.clipped || (u = n[w + 1]?.clipped ? nr(p, t, e) : null);
      }
    }
    let f = n.some(w => w.isFloat) || n.some(w => $t.has(w.blendMode ?? 'normal')),
      x = i;
    if (s === 4) for (let w = 0; w < _; w++) a[w * 4 + 3] *= x;
    let b = 1 / 0,
      m = -1 / 0,
      v = s === 4 ? 3 : s;
    for (let w = 0; w < _; w++)
      if (c[w])
        for (let p = 0; p < v; p++) {
          let y = a[w * s + p];
          Number.isFinite(y) && ((b = Math.min(b, y)), (m = Math.max(m, y)));
        }
    return (
      b === 1 / 0 && ((b = 0), (m = 0)),
      {
        data: a,
        width: t,
        height: e,
        channels: s,
        isFloat: f,
        typeMax: x,
        stats: { min: b, max: m },
        coveredCount: d,
      }
    );
  }
  function bt(r, t, e) {
    return le(oe(r, t, e), t, e);
  }
  function de(r, t, e, n) {
    let s = Math.max(0, Math.min(t, Math.floor(n.x))),
      i = Math.max(0, Math.min(e, Math.floor(n.y))),
      _ = Math.max(0, Math.min(t - s, Math.ceil(n.width))),
      a = Math.max(0, Math.min(e - i, Math.ceil(n.height)));
    if (!_ || !a) return bt([], Math.max(1, _), Math.max(1, a));
    let c = new Map(r.filter(u => u.kind === 'group' && u.id).map(u => [u.id, u])),
      l = u => {
        let f = u.parentId,
          x = 0,
          b = 0,
          m = new Set();
        for (; f && !m.has(f);) {
          m.add(f);
          let v = c.get(f);
          if (!v) break;
          ((x += v.offsetX || 0), (b += v.offsetY || 0), (f = v.parentId));
        }
        return { x, y: b };
      },
      d = r.map(u => {
        let f = l(u),
          x = u.kind === 'group' ? 0 : (u.offsetX || 0) + f.x - s,
          b = u.kind === 'group' ? 0 : (u.offsetY || 0) + f.y - i;
        return {
          ...u,
          offsetX: x,
          offsetY: b,
          rasterMask: u.rasterMask
            ? {
                ...u.rasterMask,
                offsetX: (u.rasterMask.offsetX ?? u.offsetX ?? 0) + f.x - s,
                offsetY: (u.rasterMask.offsetY ?? u.offsetY ?? 0) + f.y - i,
              }
            : void 0,
        };
      });
    return bt(d, _, a);
  }
  var yr = {},
    o,
    et = null;
  function K() {
    return ((et === null || et.byteLength === 0) && (et = new Uint8Array(o.memory.buffer)), et);
  }
  var ht = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 });
  ht.decode();
  var ur = 2146435072,
    Gt = 0;
  function dr(r, t) {
    return (
      (Gt += t),
      Gt >= ur &&
        ((ht = new TextDecoder('utf-8', { ignoreBOM: !0, fatal: !0 })), ht.decode(), (Gt = t)),
      ht.decode(K().subarray(r, r + t))
    );
  }
  function R(r, t) {
    return ((r = r >>> 0), dr(r, t));
  }
  var rt = null;
  function Ce() {
    return ((rt === null || rt.byteLength === 0) && (rt = new Uint16Array(o.memory.buffer)), rt);
  }
  function qt(r, t) {
    return ((r = r >>> 0), Ce().subarray(r / 2, r / 2 + t));
  }
  function J(r, t) {
    return ((r = r >>> 0), K().subarray(r / 1, r / 1 + t));
  }
  var nt = null;
  function Ne() {
    return ((nt === null || nt.byteLength === 0) && (nt = new Float32Array(o.memory.buffer)), nt);
  }
  function U(r, t) {
    return ((r = r >>> 0), Ne().subarray(r / 4, r / 4 + t));
  }
  var A = 0,
    at = new TextEncoder();
  'encodeInto' in at ||
    (at.encodeInto = function (r, t) {
      let e = at.encode(r);
      return (t.set(e), { read: r.length, written: e.length });
    });
  function fr(r, t, e) {
    if (e === void 0) {
      let a = at.encode(r),
        c = t(a.length, 1) >>> 0;
      return (
        K()
          .subarray(c, c + a.length)
          .set(a),
        (A = a.length),
        c
      );
    }
    let n = r.length,
      s = t(n, 1) >>> 0,
      i = K(),
      _ = 0;
    for (; _ < n; _++) {
      let a = r.charCodeAt(_);
      if (a > 127) break;
      i[s + _] = a;
    }
    if (_ !== n) {
      (_ !== 0 && (r = r.slice(_)), (s = e(s, n, (n = _ + r.length * 3), 1) >>> 0));
      let a = K().subarray(s + _, s + n),
        c = at.encodeInto(r, a);
      ((_ += c.written), (s = e(s, n, _, 1) >>> 0));
    }
    return ((A = _), s);
  }
  var B = null;
  function fe() {
    return (
      (B === null ||
        B.buffer.detached === !0 ||
        (B.buffer.detached === void 0 && B.buffer !== o.memory.buffer)) &&
        (B = new DataView(o.memory.buffer)),
      B
    );
  }
  function G(r, t) {
    let e = t(r.length * 1, 1) >>> 0;
    return (K().set(r, e / 1), (A = r.length), e);
  }
  function k(r) {
    let t = o.__wbindgen_externrefs.get(r);
    return (o.__externref_table_dealloc(r), t);
  }
  function I(r, t) {
    let e = t(r.length * 4, 4) >>> 0;
    return (Ne().set(r, e / 4), (A = r.length), e);
  }
  var st = null;
  function Ie() {
    return ((st === null || st.byteLength === 0) && (st = new Float64Array(o.memory.buffer)), st);
  }
  function pr(r, t) {
    let e = t(r.length * 8, 8) >>> 0;
    return (Ie().set(r, e / 8), (A = r.length), e);
  }
  function W(r, t) {
    let e = t(r.length * 2, 2) >>> 0;
    return (Ce().set(r, e / 2), (A = r.length), e);
  }
  var ot = null;
  function Oe() {
    return ((ot === null || ot.byteLength === 0) && (ot = new Uint32Array(o.memory.buffer)), ot);
  }
  function pe(r, t) {
    let e = t(r.length * 4, 4) >>> 0;
    return (Oe().set(r, e / 4), (A = r.length), e);
  }
  var it = null;
  function gr() {
    return ((it === null || it.byteLength === 0) && (it = new Int32Array(o.memory.buffer)), it);
  }
  function Nt(r, t) {
    return ((r = r >>> 0), gr().subarray(r / 4, r / 4 + t));
  }
  function Te(r, t) {
    return ((r = r >>> 0), Oe().subarray(r / 4, r / 4 + t));
  }
  function _t(r, t) {
    return ((r = r >>> 0), Ie().subarray(r / 8, r / 8 + t));
  }
  var ge =
      typeof FinalizationRegistry > 'u'
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(r => o.__wbg_decodedarray_free(r >>> 0, 1)),
    mt = class r {
      static __wrap(t) {
        t = t >>> 0;
        let e = Object.create(r.prototype);
        return ((e.__wbg_ptr = t), ge.register(e, e.__wbg_ptr, e), e);
      }
      __destroy_into_raw() {
        let t = this.__wbg_ptr;
        return ((this.__wbg_ptr = 0), ge.unregister(this), t);
      }
      free() {
        let t = this.__destroy_into_raw();
        o.__wbg_decodedarray_free(t, 0);
      }
      get sample_kind() {
        return o.decodedarray_sample_kind(this.__wbg_ptr) >>> 0;
      }
      get valid_count() {
        return o.decodedarray_valid_count(this.__wbg_ptr);
      }
      discard_data() {
        o.decodedarray_discard_data(this.__wbg_ptr);
      }
      get format_label() {
        let t, e;
        try {
          let n = o.decodedarray_format_label(this.__wbg_ptr);
          return ((t = n[0]), (e = n[1]), R(n[0], n[1]));
        } finally {
          o.__wbindgen_free(t, e, 1);
        }
      }
      get metadata_json() {
        let t, e;
        try {
          let n = o.decodedarray_metadata_json(this.__wbg_ptr);
          return ((t = n[0]), (e = n[1]), R(n[0], n[1]));
        } finally {
          o.__wbindgen_free(t, e, 1);
        }
      }
      get sample_format() {
        return o.decodedarray_sample_format(this.__wbg_ptr) >>> 0;
      }
      get bits_per_sample() {
        return o.decodedarray_bits_per_sample(this.__wbg_ptr) >>> 0;
      }
      take_data_as_u8() {
        let t = o.decodedarray_take_data_as_u8(this.__wbg_ptr);
        if (t[3]) throw k(t[2]);
        var e = J(t[0], t[1]).slice();
        return (o.__wbindgen_free(t[0], t[1] * 1, 1), e);
      }
      get can_reuse_source() {
        return o.decodedarray_can_reuse_source(this.__wbg_ptr) !== 0;
      }
      get non_finite_count() {
        return o.decodedarray_non_finite_count(this.__wbg_ptr);
      }
      take_data_as_f32() {
        let t = o.decodedarray_take_data_as_f32(this.__wbg_ptr);
        if (t[3]) throw k(t[2]);
        var e = U(t[0], t[1]).slice();
        return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
      }
      take_data_as_u16() {
        let t = o.decodedarray_take_data_as_u16(this.__wbg_ptr);
        if (t[3]) throw k(t[2]);
        var e = qt(t[0], t[1]).slice();
        return (o.__wbindgen_free(t[0], t[1] * 2, 2), e);
      }
      get source_data_offset() {
        return o.decodedarray_source_data_offset(this.__wbg_ptr) >>> 0;
      }
      get source_numeric_type() {
        let t, e;
        try {
          let n = o.decodedarray_source_numeric_type(this.__wbg_ptr);
          return ((t = n[0]), (e = n[1]), R(n[0], n[1]));
        } finally {
          o.__wbindgen_free(t, e, 1);
        }
      }
      copy_data_as_u8_into(t) {
        let e = o.decodedarray_copy_data_as_u8_into(this.__wbg_ptr, t);
        if (e[1]) throw k(e[0]);
      }
      copy_data_as_f32_into(t) {
        let e = o.decodedarray_copy_data_as_f32_into(this.__wbg_ptr, t);
        if (e[1]) throw k(e[0]);
      }
      copy_data_as_u16_into(t) {
        let e = o.decodedarray_copy_data_as_u16_into(this.__wbg_ptr, t);
        if (e[1]) throw k(e[0]);
      }
      get width() {
        return o.decodedarray_width(this.__wbg_ptr) >>> 0;
      }
      get height() {
        return o.decodedarray_height(this.__wbg_ptr) >>> 0;
      }
      get channels() {
        return o.decodedarray_channels(this.__wbg_ptr) >>> 0;
      }
      get data_len() {
        return o.decodedarray_data_len(this.__wbg_ptr) >>> 0;
      }
      get data_max() {
        return o.decodedarray_data_max(this.__wbg_ptr);
      }
      get data_min() {
        return o.decodedarray_data_min(this.__wbg_ptr);
      }
      get type_max() {
        return o.decodedarray_type_max(this.__wbg_ptr);
      }
      get type_min() {
        return o.decodedarray_type_min(this.__wbg_ptr);
      }
    };
  Symbol.dispose && (mt.prototype[Symbol.dispose] = mt.prototype.free);
  var be =
      typeof FinalizationRegistry > 'u'
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(r => o.__wbg_demosaicresult_free(r >>> 0, 1)),
    wt = class r {
      static __wrap(t) {
        t = t >>> 0;
        let e = Object.create(r.prototype);
        return ((e.__wbg_ptr = t), be.register(e, e.__wbg_ptr, e), e);
      }
      __destroy_into_raw() {
        let t = this.__wbg_ptr;
        return ((this.__wbg_ptr = 0), be.unregister(this), t);
      }
      free() {
        let t = this.__destroy_into_raw();
        o.__wbg_demosaicresult_free(t, 0);
      }
      get width() {
        return o.demosaicresult_width(this.__wbg_ptr) >>> 0;
      }
      get gain_b() {
        return o.demosaicresult_gain_b(this.__wbg_ptr);
      }
      get gain_g() {
        return o.demosaicresult_gain_g(this.__wbg_ptr);
      }
      get gain_r() {
        return o.demosaicresult_gain_r(this.__wbg_ptr);
      }
      get height() {
        return o.demosaicresult_height(this.__wbg_ptr) >>> 0;
      }
      get channels() {
        return o.demosaicresult_channels(this.__wbg_ptr) >>> 0;
      }
      take_data() {
        let t = o.demosaicresult_take_data(this.__wbg_ptr);
        var e = U(t[0], t[1]).slice();
        return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
      }
    };
  Symbol.dispose && (wt.prototype[Symbol.dispose] = wt.prototype.free);
  var he =
      typeof FinalizationRegistry > 'u'
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(r => o.__wbg_exrresult_free(r >>> 0, 1)),
    yt = class r {
      static __wrap(t) {
        t = t >>> 0;
        let e = Object.create(r.prototype);
        return ((e.__wbg_ptr = t), he.register(e, e.__wbg_ptr, e), e);
      }
      __destroy_into_raw() {
        let t = this.__wbg_ptr;
        return ((this.__wbg_ptr = 0), he.unregister(this), t);
      }
      free() {
        let t = this.__destroy_into_raw();
        o.__wbg_exrresult_free(t, 0);
      }
      get all_tags_json() {
        let t, e;
        try {
          let n = o.exrresult_all_tags_json(this.__wbg_ptr);
          return ((t = n[0]), (e = n[1]), R(n[0], n[1]));
        } finally {
          o.__wbindgen_free(t, e, 1);
        }
      }
      get timing_pack_ms() {
        return o.decodedarray_type_max(this.__wbg_ptr);
      }
      get timing_read_ms() {
        return o.decodedarray_type_min(this.__wbg_ptr);
      }
      get timing_total_ms() {
        return o.decodedarray_data_min(this.__wbg_ptr);
      }
      take_data_as_f32() {
        let t = o.exrresult_take_data_as_f32(this.__wbg_ptr);
        var e = U(t[0], t[1]).slice();
        return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
      }
      get channel_names_csv() {
        let t, e;
        try {
          let n = o.exrresult_channel_names_csv(this.__wbg_ptr);
          return ((t = n[0]), (e = n[1]), R(n[0], n[1]));
        } finally {
          o.__wbindgen_free(t, e, 1);
        }
      }
      get displayed_channels_csv() {
        let t, e;
        try {
          let n = o.exrresult_displayed_channels_csv(this.__wbg_ptr);
          return ((t = n[0]), (e = n[1]), R(n[0], n[1]));
        } finally {
          o.__wbindgen_free(t, e, 1);
        }
      }
      get width() {
        return o.exrresult_width(this.__wbg_ptr) >>> 0;
      }
      get format() {
        return o.decodedarray_height(this.__wbg_ptr) >>> 0;
      }
      get height() {
        return o.exrresult_height(this.__wbg_ptr) >>> 0;
      }
      get channels() {
        return o.decodedarray_width(this.__wbg_ptr) >>> 0;
      }
      get data_max() {
        return o.decodedarray_non_finite_count(this.__wbg_ptr);
      }
      get data_min() {
        return o.decodedarray_data_max(this.__wbg_ptr);
      }
      get data_type() {
        return o.decodedarray_channels(this.__wbg_ptr) >>> 0;
      }
    };
  Symbol.dispose && (yt.prototype[Symbol.dispose] = yt.prototype.free);
  var me =
      typeof FinalizationRegistry > 'u'
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(r => o.__wbg_exrzipplanjs_free(r >>> 0, 1)),
    xt = class r {
      static __wrap(t) {
        t = t >>> 0;
        let e = Object.create(r.prototype);
        return ((e.__wbg_ptr = t), me.register(e, e.__wbg_ptr, e), e);
      }
      __destroy_into_raw() {
        let t = this.__wbg_ptr;
        return ((this.__wbg_ptr = 0), me.unregister(this), t);
      }
      free() {
        let t = this.__destroy_into_raw();
        o.__wbg_exrzipplanjs_free(t, 0);
      }
      get channel_name() {
        let t, e;
        try {
          let n = o.exrzipplanjs_channel_name(this.__wbg_ptr);
          return ((t = n[0]), (e = n[1]), R(n[0], n[1]));
        } finally {
          o.__wbindgen_free(t, e, 1);
        }
      }
      get all_tags_json() {
        let t, e;
        try {
          let n = o.exrzipplanjs_all_tags_json(this.__wbg_ptr);
          return ((t = n[0]), (e = n[1]), R(n[0], n[1]));
        } finally {
          o.__wbindgen_free(t, e, 1);
        }
      }
      get y_coordinates() {
        let t = o.exrzipplanjs_y_coordinates(this.__wbg_ptr);
        var e = Nt(t[0], t[1]).slice();
        return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
      }
      take_compressed() {
        let t = o.exrzipplanjs_take_compressed(this.__wbg_ptr);
        var e = J(t[0], t[1]).slice();
        return (o.__wbindgen_free(t[0], t[1] * 1, 1), e);
      }
      get width() {
        return o.exrzipplanjs_width(this.__wbg_ptr) >>> 0;
      }
      get counts() {
        let t = o.exrzipplanjs_counts(this.__wbg_ptr);
        var e = Te(t[0], t[1]).slice();
        return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
      }
      get data_y() {
        return o.exrzipplanjs_data_y(this.__wbg_ptr);
      }
      get height() {
        return o.decodedarray_bits_per_sample(this.__wbg_ptr) >>> 0;
      }
    };
  Symbol.dispose && (xt.prototype[Symbol.dispose] = xt.prototype.free);
  var we =
      typeof FinalizationRegistry > 'u'
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(r => o.__wbg_hdrresult_free(r >>> 0, 1)),
    Mt = class r {
      static __wrap(t) {
        t = t >>> 0;
        let e = Object.create(r.prototype);
        return ((e.__wbg_ptr = t), we.register(e, e.__wbg_ptr, e), e);
      }
      __destroy_into_raw() {
        let t = this.__wbg_ptr;
        return ((this.__wbg_ptr = 0), we.unregister(this), t);
      }
      free() {
        let t = this.__destroy_into_raw();
        o.__wbg_hdrresult_free(t, 0);
      }
      get all_tags_json() {
        let t, e;
        try {
          let n = o.hdrresult_all_tags_json(this.__wbg_ptr);
          return ((t = n[0]), (e = n[1]), R(n[0], n[1]));
        } finally {
          o.__wbindgen_free(t, e, 1);
        }
      }
      take_data_as_f32() {
        let t = o.hdrresult_take_data_as_f32(this.__wbg_ptr);
        var e = U(t[0], t[1]).slice();
        return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
      }
      take_metadata_as_f64() {
        let t = o.hdrresult_take_metadata_as_f64(this.__wbg_ptr);
        var e = _t(t[0], t[1]).slice();
        return (o.__wbindgen_free(t[0], t[1] * 8, 8), e);
      }
      get channels() {
        return o.hdrresult_channels(this.__wbg_ptr) >>> 0;
      }
    };
  Symbol.dispose && (Mt.prototype[Symbol.dispose] = Mt.prototype.free);
  var ye =
      typeof FinalizationRegistry > 'u'
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(r => o.__wbg_histogramresult_free(r >>> 0, 1)),
    kt = class r {
      static __wrap(t) {
        t = t >>> 0;
        let e = Object.create(r.prototype);
        return ((e.__wbg_ptr = t), ye.register(e, e.__wbg_ptr, e), e);
      }
      __destroy_into_raw() {
        let t = this.__wbg_ptr;
        return ((this.__wbg_ptr = 0), ye.unregister(this), t);
      }
      free() {
        let t = this.__destroy_into_raw();
        o.__wbg_histogramresult_free(t, 0);
      }
      get non_finite_count() {
        return o.histogramresult_non_finite_count(this.__wbg_ptr) >>> 0;
      }
      get max() {
        return o.decodedarray_type_max(this.__wbg_ptr);
      }
      get min() {
        return o.decodedarray_type_min(this.__wbg_ptr);
      }
      get total() {
        return o.histogramresult_total(this.__wbg_ptr) >>> 0;
      }
      get counts() {
        let t = o.histogramresult_counts(this.__wbg_ptr);
        var e = Nt(t[0], t[1]).slice();
        return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
      }
    };
  Symbol.dispose && (kt.prototype[Symbol.dispose] = kt.prototype.free);
  var xe =
      typeof FinalizationRegistry > 'u'
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(r => o.__wbg_imagestats_free(r >>> 0, 1)),
    At = class r {
      static __wrap(t) {
        t = t >>> 0;
        let e = Object.create(r.prototype);
        return ((e.__wbg_ptr = t), xe.register(e, e.__wbg_ptr, e), e);
      }
      __destroy_into_raw() {
        let t = this.__wbg_ptr;
        return ((this.__wbg_ptr = 0), xe.unregister(this), t);
      }
      free() {
        let t = this.__destroy_into_raw();
        o.__wbg_imagestats_free(t, 0);
      }
      get total_count() {
        return o.imagestats_total_count(this.__wbg_ptr);
      }
      get valid_count() {
        return o.decodedarray_non_finite_count(this.__wbg_ptr);
      }
      get non_finite_count() {
        return o.decodedarray_valid_count(this.__wbg_ptr);
      }
      get max() {
        return o.decodedarray_type_max(this.__wbg_ptr);
      }
      get min() {
        return o.decodedarray_type_min(this.__wbg_ptr);
      }
      get std() {
        return o.decodedarray_data_max(this.__wbg_ptr);
      }
      get mean() {
        return o.decodedarray_data_min(this.__wbg_ptr);
      }
    };
  Symbol.dispose && (At.prototype[Symbol.dispose] = At.prototype.free);
  var Me =
      typeof FinalizationRegistry > 'u'
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(r => o.__wbg_jpegresult_free(r >>> 0, 1)),
    vt = class r {
      static __wrap(t) {
        t = t >>> 0;
        let e = Object.create(r.prototype);
        return ((e.__wbg_ptr = t), Me.register(e, e.__wbg_ptr, e), e);
      }
      __destroy_into_raw() {
        let t = this.__wbg_ptr;
        return ((this.__wbg_ptr = 0), Me.unregister(this), t);
      }
      free() {
        let t = this.__destroy_into_raw();
        o.__wbg_jpegresult_free(t, 0);
      }
      take_data_as_u8() {
        let t = o.jpegresult_take_data_as_u8(this.__wbg_ptr);
        var e = J(t[0], t[1]).slice();
        return (o.__wbindgen_free(t[0], t[1] * 1, 1), e);
      }
      get width() {
        return o.demosaicresult_width(this.__wbg_ptr) >>> 0;
      }
      get height() {
        return o.demosaicresult_height(this.__wbg_ptr) >>> 0;
      }
      get channels() {
        return o.demosaicresult_channels(this.__wbg_ptr) >>> 0;
      }
    };
  Symbol.dispose && (vt.prototype[Symbol.dispose] = vt.prototype.free);
  var ke =
      typeof FinalizationRegistry > 'u'
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(r => o.__wbg_labelresult_free(r >>> 0, 1)),
    Ft = class r {
      static __wrap(t) {
        t = t >>> 0;
        let e = Object.create(r.prototype);
        return ((e.__wbg_ptr = t), ke.register(e, e.__wbg_ptr, e), e);
      }
      __destroy_into_raw() {
        let t = this.__wbg_ptr;
        return ((this.__wbg_ptr = 0), ke.unregister(this), t);
      }
      free() {
        let t = this.__destroy_into_raw();
        o.__wbg_labelresult_free(t, 0);
      }
      take_labels_as_i32() {
        let t = o.labelresult_take_labels_as_i32(this.__wbg_ptr);
        if (t[3]) throw k(t[2]);
        var e = Nt(t[0], t[1]).slice();
        return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
      }
      get count() {
        return o.demosaicresult_width(this.__wbg_ptr) >>> 0;
      }
      get width() {
        return o.demosaicresult_height(this.__wbg_ptr) >>> 0;
      }
      get height() {
        return o.demosaicresult_channels(this.__wbg_ptr) >>> 0;
      }
    };
  Symbol.dispose && (Ft.prototype[Symbol.dispose] = Ft.prototype.free);
  var Ae =
      typeof FinalizationRegistry > 'u'
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(r => o.__wbg_pngresult_free(r >>> 0, 1)),
    jt = class r {
      static __wrap(t) {
        t = t >>> 0;
        let e = Object.create(r.prototype);
        return ((e.__wbg_ptr = t), Ae.register(e, e.__wbg_ptr, e), e);
      }
      __destroy_into_raw() {
        let t = this.__wbg_ptr;
        return ((this.__wbg_ptr = 0), Ae.unregister(this), t);
      }
      free() {
        let t = this.__destroy_into_raw();
        o.__wbg_pngresult_free(t, 0);
      }
      get color_type() {
        return o.decodedarray_width(this.__wbg_ptr) >>> 0;
      }
      get timing_total_ms() {
        return o.decodedarray_data_max(this.__wbg_ptr);
      }
      take_data_as_u16() {
        let t = o.pngresult_take_data_as_u16(this.__wbg_ptr);
        var e = qt(t[0], t[1]).slice();
        return (o.__wbindgen_free(t[0], t[1] * 2, 2), e);
      }
      get timing_decode_ms() {
        return o.decodedarray_type_max(this.__wbg_ptr);
      }
      get timing_convert_ms() {
        return o.decodedarray_data_min(this.__wbg_ptr);
      }
      get timing_read_info_ms() {
        return o.decodedarray_type_min(this.__wbg_ptr);
      }
      get width() {
        return o.pngresult_width(this.__wbg_ptr) >>> 0;
      }
      get height() {
        return o.pngresult_height(this.__wbg_ptr) >>> 0;
      }
      get channels() {
        return o.exrresult_width(this.__wbg_ptr) >>> 0;
      }
      get bit_depth() {
        return o.exrresult_height(this.__wbg_ptr) >>> 0;
      }
    };
  Symbol.dispose && (jt.prototype[Symbol.dispose] = jt.prototype.free);
  var ve =
      typeof FinalizationRegistry > 'u'
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(r => o.__wbg_rgbalayercompositor_free(r >>> 0, 1)),
    Y = class {
      __destroy_into_raw() {
        let t = this.__wbg_ptr;
        return ((this.__wbg_ptr = 0), ve.unregister(this), t);
      }
      free() {
        let t = this.__destroy_into_raw();
        o.__wbg_rgbalayercompositor_free(t, 0);
      }
      get covered_count() {
        return o.exrzipplanjs_width(this.__wbg_ptr) >>> 0;
      }
      add_channels_i8(t, e, n, s, i, _, a, c, l) {
        let d = G(t, o.__wbindgen_malloc),
          u = A,
          f = o.rgbalayercompositor_add_channels_i8(this.__wbg_ptr, d, u, e, n, s, i, _, a, c, l);
        if (f[1]) throw k(f[0]);
      }
      add_channels_u8(t, e, n, s, i, _, a, c, l) {
        let d = G(t, o.__wbindgen_malloc),
          u = A,
          f = o.rgbalayercompositor_add_channels_u8(this.__wbg_ptr, d, u, e, n, s, i, _, a, c, l);
        if (f[1]) throw k(f[0]);
      }
      finish_isolated(t, e) {
        let n = o.rgbalayercompositor_finish_isolated(this.__wbg_ptr, t, e);
        if (n[1]) throw k(n[0]);
      }
      add_channels_f32(t, e, n, s, i, _, a, c, l) {
        let d = I(t, o.__wbindgen_malloc),
          u = A,
          f = o.rgbalayercompositor_add_channels_f32(this.__wbg_ptr, d, u, e, n, s, i, _, a, c, l);
        if (f[1]) throw k(f[0]);
      }
      add_channels_f64(t, e, n, s, i, _, a, c, l) {
        let d = pr(t, o.__wbindgen_malloc),
          u = A,
          f = o.rgbalayercompositor_add_channels_f64(this.__wbg_ptr, d, u, e, n, s, i, _, a, c, l);
        if (f[1]) throw k(f[0]);
      }
      add_channels_i16(t, e, n, s, i, _, a, c, l) {
        let d = W(t, o.__wbindgen_malloc),
          u = A,
          f = o.rgbalayercompositor_add_channels_i16(this.__wbg_ptr, d, u, e, n, s, i, _, a, c, l);
        if (f[1]) throw k(f[0]);
      }
      add_channels_i32(t, e, n, s, i, _, a, c, l) {
        let d = pe(t, o.__wbindgen_malloc),
          u = A,
          f = o.rgbalayercompositor_add_channels_i32(this.__wbg_ptr, d, u, e, n, s, i, _, a, c, l);
        if (f[1]) throw k(f[0]);
      }
      add_channels_u16(t, e, n, s, i, _, a, c, l) {
        let d = W(t, o.__wbindgen_malloc),
          u = A,
          f = o.rgbalayercompositor_add_channels_u16(this.__wbg_ptr, d, u, e, n, s, i, _, a, c, l);
        if (f[1]) throw k(f[0]);
      }
      add_channels_u32(t, e, n, s, i, _, a, c, l) {
        let d = pe(t, o.__wbindgen_malloc),
          u = A,
          f = o.rgbalayercompositor_add_channels_u32(this.__wbg_ptr, d, u, e, n, s, i, _, a, c, l);
        if (f[1]) throw k(f[0]);
      }
      begin_isolated_u8(t, e, n, s, i) {
        let _ = G(t, o.__wbindgen_malloc),
          a = A,
          c = o.rgbalayercompositor_begin_isolated_u8(this.__wbg_ptr, _, a, e, n, s, i);
        if (c[1]) throw k(c[0]);
      }
      begin_isolated_f32(t, e, n, s, i, _) {
        let a = I(t, o.__wbindgen_malloc),
          c = A,
          l = o.rgbalayercompositor_begin_isolated_f32(this.__wbg_ptr, a, c, e, n, s, i, _);
        if (l[1]) throw k(l[0]);
      }
      begin_isolated_u16(t, e, n, s, i, _) {
        let a = W(t, o.__wbindgen_malloc),
          c = A,
          l = o.rgbalayercompositor_begin_isolated_u16(this.__wbg_ptr, a, c, e, n, s, i, _);
        if (l[1]) throw k(l[0]);
      }
      isolated_apply_hue(t, e, n, s, i) {
        let _ = o.rgbalayercompositor_isolated_apply_hue(this.__wbg_ptr, t, e, n, s, i);
        if (_[1]) throw k(_[0]);
      }
      isolated_apply_lut(t, e) {
        let n = I(t, o.__wbindgen_malloc),
          s = A,
          i = o.rgbalayercompositor_isolated_apply_lut(this.__wbg_ptr, n, s, e);
        if (i[1]) throw k(i[0]);
      }
      isolated_apply_direct(t, e, n) {
        let s = I(e, o.__wbindgen_malloc),
          i = A,
          _ = o.rgbalayercompositor_isolated_apply_direct(this.__wbg_ptr, t, s, i, n);
        if (_[1]) throw k(_[0]);
      }
      take_data_as_channels(t) {
        let e = o.rgbalayercompositor_take_data_as_channels(this.__wbg_ptr, t);
        if (e[3]) throw k(e[2]);
        var n = U(e[0], e[1]).slice();
        return (o.__wbindgen_free(e[0], e[1] * 4, 4), n);
      }
      take_isolated_surface() {
        let t = o.rgbalayercompositor_take_isolated_surface(this.__wbg_ptr);
        if (t[3]) throw k(t[2]);
        var e = U(t[0], t[1]).slice();
        return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
      }
      isolated_add_f32_surface(t, e, n, s) {
        let i = I(t, o.__wbindgen_malloc),
          _ = A,
          a = o.rgbalayercompositor_isolated_add_f32_surface(this.__wbg_ptr, i, _, e, n, s);
        if (a[1]) throw k(a[0]);
      }
      add_arithmetic_f32_surface(t, e, n, s) {
        let i = I(t, o.__wbindgen_malloc),
          _ = A,
          a = o.rgbalayercompositor_add_arithmetic_f32_surface(this.__wbg_ptr, i, _, e, n, s);
        if (a[1]) throw k(a[0]);
      }
      isolated_apply_alpha_mask_u8(t, e, n, s, i, _, a, c) {
        let l = G(t, o.__wbindgen_malloc),
          d = A,
          u = o.rgbalayercompositor_isolated_apply_alpha_mask_u8(
            this.__wbg_ptr,
            l,
            d,
            e,
            n,
            s,
            i,
            _,
            a,
            c
          );
        if (u[1]) throw k(u[0]);
      }
      isolated_apply_selective_hue(t, e) {
        let n = I(t, o.__wbindgen_malloc),
          s = A,
          i = o.rgbalayercompositor_isolated_apply_selective_hue(this.__wbg_ptr, n, s, e);
        if (i[1]) throw k(i[0]);
      }
      isolated_apply_alpha_mask_f32(t, e, n, s, i, _, a, c) {
        let l = I(t, o.__wbindgen_malloc),
          d = A,
          u = o.rgbalayercompositor_isolated_apply_alpha_mask_f32(
            this.__wbg_ptr,
            l,
            d,
            e,
            n,
            s,
            i,
            _,
            a,
            c
          );
        if (u[1]) throw k(u[0]);
      }
      isolated_apply_alpha_mask_u16(t, e, n, s, i, _, a, c) {
        let l = W(t, o.__wbindgen_malloc),
          d = A,
          u = o.rgbalayercompositor_isolated_apply_alpha_mask_u16(
            this.__wbg_ptr,
            l,
            d,
            e,
            n,
            s,
            i,
            _,
            a,
            c
          );
        if (u[1]) throw k(u[0]);
      }
      isolated_begin_masked_adjustment() {
        let t = o.rgbalayercompositor_isolated_begin_masked_adjustment(this.__wbg_ptr);
        if (t[1]) throw k(t[0]);
      }
      apply_brightness_mask_f32_surface(t, e, n, s) {
        let i = I(t, o.__wbindgen_malloc),
          _ = A,
          a = o.rgbalayercompositor_apply_brightness_mask_f32_surface(
            this.__wbg_ptr,
            i,
            _,
            e,
            n,
            s
          );
        if (a[1]) throw k(a[0]);
      }
      isolated_add_arithmetic_f32_surface(t, e, n, s) {
        let i = I(t, o.__wbindgen_malloc),
          _ = A,
          a = o.rgbalayercompositor_isolated_add_arithmetic_f32_surface(
            this.__wbg_ptr,
            i,
            _,
            e,
            n,
            s
          );
        if (a[1]) throw k(a[0]);
      }
      isolated_finish_masked_adjustment_u8(t, e, n, s, i, _, a, c) {
        let l = G(t, o.__wbindgen_malloc),
          d = A,
          u = o.rgbalayercompositor_isolated_finish_masked_adjustment_u8(
            this.__wbg_ptr,
            l,
            d,
            e,
            n,
            s,
            i,
            _,
            a,
            c
          );
        if (u[1]) throw k(u[0]);
      }
      isolated_finish_masked_adjustment_f32(t, e, n, s, i, _, a, c) {
        let l = I(t, o.__wbindgen_malloc),
          d = A,
          u = o.rgbalayercompositor_isolated_finish_masked_adjustment_f32(
            this.__wbg_ptr,
            l,
            d,
            e,
            n,
            s,
            i,
            _,
            a,
            c
          );
        if (u[1]) throw k(u[0]);
      }
      isolated_finish_masked_adjustment_u16(t, e, n, s, i, _, a, c) {
        let l = W(t, o.__wbindgen_malloc),
          d = A,
          u = o.rgbalayercompositor_isolated_finish_masked_adjustment_u16(
            this.__wbg_ptr,
            l,
            d,
            e,
            n,
            s,
            i,
            _,
            a,
            c
          );
        if (u[1]) throw k(u[0]);
      }
      constructor(t, e, n) {
        let s = o.rgbalayercompositor_new(t, e, n);
        if (s[2]) throw k(s[1]);
        return ((this.__wbg_ptr = s[0] >>> 0), ve.register(this, this.__wbg_ptr, this), this);
      }
      add_u8(t, e, n, s, i, _, a) {
        let c = G(t, o.__wbindgen_malloc),
          l = A,
          d = o.rgbalayercompositor_add_u8(this.__wbg_ptr, c, l, e, n, s, i, _, a);
        if (d[1]) throw k(d[0]);
      }
      add_f32(t, e, n, s, i, _, a, c) {
        let l = I(t, o.__wbindgen_malloc),
          d = A,
          u = o.rgbalayercompositor_add_f32(this.__wbg_ptr, l, d, e, n, s, i, _, a, c);
        if (u[1]) throw k(u[0]);
      }
      add_u16(t, e, n, s, i, _, a, c) {
        let l = W(t, o.__wbindgen_malloc),
          d = A,
          u = o.rgbalayercompositor_add_u16(this.__wbg_ptr, l, d, e, n, s, i, _, a, c);
        if (u[1]) throw k(u[0]);
      }
      get max_value() {
        return o.rgbalayercompositor_max_value(this.__wbg_ptr);
      }
      get min_value() {
        return o.rgbalayercompositor_min_value(this.__wbg_ptr);
      }
      take_data() {
        let t = o.rgbalayercompositor_take_data(this.__wbg_ptr);
        var e = U(t[0], t[1]).slice();
        return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
      }
    };
  Symbol.dispose && (Y.prototype[Symbol.dispose] = Y.prototype.free);
  var Fe =
      typeof FinalizationRegistry > 'u'
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(r => o.__wbg_stabilitycurveresult_free(r >>> 0, 1)),
    Lt = class r {
      static __wrap(t) {
        t = t >>> 0;
        let e = Object.create(r.prototype);
        return ((e.__wbg_ptr = t), Fe.register(e, e.__wbg_ptr, e), e);
      }
      __destroy_into_raw() {
        let t = this.__wbg_ptr;
        return ((this.__wbg_ptr = 0), Fe.unregister(this), t);
      }
      free() {
        let t = this.__destroy_into_raw();
        o.__wbg_stabilitycurveresult_free(t, 0);
      }
      get object_counts() {
        let t = o.stabilitycurveresult_object_counts(this.__wbg_ptr);
        var e = Te(t[0], t[1]).slice();
        return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
      }
      get plateau_width() {
        return o.stabilitycurveresult_plateau_width(this.__wbg_ptr);
      }
      get suggested_bin() {
        return o.exrresult_height(this.__wbg_ptr);
      }
      get area_fractions() {
        let t = o.stabilitycurveresult_area_fractions(this.__wbg_ptr);
        var e = _t(t[0], t[1]).slice();
        return (o.__wbindgen_free(t[0], t[1] * 8, 8), e);
      }
      get bins() {
        let t = o.stabilitycurveresult_bins(this.__wbg_ptr);
        var e = Nt(t[0], t[1]).slice();
        return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
      }
      get values() {
        let t = o.stabilitycurveresult_values(this.__wbg_ptr);
        var e = _t(t[0], t[1]).slice();
        return (o.__wbindgen_free(t[0], t[1] * 8, 8), e);
      }
    };
  Symbol.dispose && (Lt.prototype[Symbol.dispose] = Lt.prototype.free);
  var je =
      typeof FinalizationRegistry > 'u'
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(r => o.__wbg_tifffloatstripplanjs_free(r >>> 0, 1)),
    Rt = class r {
      static __wrap(t) {
        t = t >>> 0;
        let e = Object.create(r.prototype);
        return ((e.__wbg_ptr = t), je.register(e, e.__wbg_ptr, e), e);
      }
      __destroy_into_raw() {
        let t = this.__wbg_ptr;
        return ((this.__wbg_ptr = 0), je.unregister(this), t);
      }
      free() {
        let t = this.__destroy_into_raw();
        o.__wbg_tifffloatstripplanjs_free(t, 0);
      }
      get tile_width() {
        return o.exrzipplanjs_data_y(this.__wbg_ptr) >>> 0;
      }
      get block_count() {
        return o.tifffloatstripplanjs_block_count(this.__wbg_ptr) >>> 0;
      }
      get compression() {
        return o.pngresult_height(this.__wbg_ptr) >>> 0;
      }
      get orientation() {
        return o.decodedarray_height(this.__wbg_ptr) >>> 0;
      }
      get strip_count() {
        return o.tifffloatstripplanjs_strip_count(this.__wbg_ptr) >>> 0;
      }
      get tile_length() {
        return o.decodedarray_sample_kind(this.__wbg_ptr) >>> 0;
      }
      get blocks_across() {
        return o.tifffloatstripplanjs_blocks_across(this.__wbg_ptr) >>> 0;
      }
      get little_endian() {
        return o.tifffloatstripplanjs_little_endian(this.__wbg_ptr) !== 0;
      }
      get sample_format() {
        return o.exrresult_height(this.__wbg_ptr) >>> 0;
      }
      get rows_per_strip() {
        return o.decodedarray_bits_per_sample(this.__wbg_ptr) >>> 0;
      }
      get bits_per_sample() {
        return o.hdrresult_channels(this.__wbg_ptr) >>> 0;
      }
      get blocks_per_unit() {
        return o.tifffloatstripplanjs_blocks_per_unit(this.__wbg_ptr) >>> 0;
      }
      get planar_configuration() {
        return o.stabilitycurveresult_plateau_width(this.__wbg_ptr) >>> 0;
      }
      get photometric_interpretation() {
        return o.exrzipplanjs_width(this.__wbg_ptr) >>> 0;
      }
      get lerc_additional_compression() {
        return o.tifffloatstripplanjs_lerc_additional_compression(this.__wbg_ptr) >>> 0;
      }
      get width() {
        return o.histogramresult_non_finite_count(this.__wbg_ptr) >>> 0;
      }
      get counts() {
        let t = o.tifffloatstripplanjs_counts(this.__wbg_ptr);
        var e = _t(t[0], t[1]).slice();
        return (o.__wbindgen_free(t[0], t[1] * 8, 8), e);
      }
      get height() {
        return o.tifffloatstripplanjs_height(this.__wbg_ptr) >>> 0;
      }
      get offsets() {
        let t = o.tifffloatstripplanjs_offsets(this.__wbg_ptr);
        var e = _t(t[0], t[1]).slice();
        return (o.__wbindgen_free(t[0], t[1] * 8, 8), e);
      }
      get channels() {
        return o.tifffloatstripplanjs_channels(this.__wbg_ptr) >>> 0;
      }
      get predictor() {
        return o.tifffloatstripplanjs_predictor(this.__wbg_ptr) >>> 0;
      }
    };
  Symbol.dispose && (Rt.prototype[Symbol.dispose] = Rt.prototype.free);
  var Le =
      typeof FinalizationRegistry > 'u'
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(r => o.__wbg_tiffregiondecoder_free(r >>> 0, 1)),
    St = class {
      __destroy_into_raw() {
        let t = this.__wbg_ptr;
        return ((this.__wbg_ptr = 0), Le.unregister(this), t);
      }
      free() {
        let t = this.__destroy_into_raw();
        o.__wbg_tiffregiondecoder_free(t, 0);
      }
      constructor(t) {
        let e = G(t, o.__wbindgen_malloc),
          n = A,
          s = o.tiffregiondecoder_new(e, n);
        return ((this.__wbg_ptr = s >>> 0), Le.register(this, this.__wbg_ptr, this), this);
      }
      decode(t, e, n, s, i) {
        let _ = o.tiffregiondecoder_decode(this.__wbg_ptr, t, e, n, s, i);
        if (_[2]) throw k(_[1]);
        return ct.__wrap(_[0]);
      }
    };
  Symbol.dispose && (St.prototype[Symbol.dispose] = St.prototype.free);
  var Re =
      typeof FinalizationRegistry > 'u'
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(r => o.__wbg_tiffregionjs_free(r >>> 0, 1)),
    ct = class r {
      static __wrap(t) {
        t = t >>> 0;
        let e = Object.create(r.prototype);
        return ((e.__wbg_ptr = t), Re.register(e, e.__wbg_ptr, e), e);
      }
      __destroy_into_raw() {
        let t = this.__wbg_ptr;
        return ((this.__wbg_ptr = 0), Re.unregister(this), t);
      }
      free() {
        let t = this.__destroy_into_raw();
        o.__wbg_tiffregionjs_free(t, 0);
      }
      get sample_format() {
        return o.hdrresult_channels(this.__wbg_ptr) >>> 0;
      }
      get blocks_decoded() {
        return o.pngresult_height(this.__wbg_ptr) >>> 0;
      }
      get bits_per_sample() {
        return o.tifffloatstripplanjs_channels(this.__wbg_ptr) >>> 0;
      }
      take_data_as_f32() {
        let t = o.tiffregionjs_take_data_as_f32(this.__wbg_ptr);
        var e = U(t[0], t[1]).slice();
        return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
      }
      get x() {
        return o.demosaicresult_width(this.__wbg_ptr) >>> 0;
      }
      get y() {
        return o.demosaicresult_height(this.__wbg_ptr) >>> 0;
      }
      get width() {
        return o.demosaicresult_channels(this.__wbg_ptr) >>> 0;
      }
      get height() {
        return o.histogramresult_non_finite_count(this.__wbg_ptr) >>> 0;
      }
      get channels() {
        return o.tifffloatstripplanjs_height(this.__wbg_ptr) >>> 0;
      }
    };
  Symbol.dispose && (ct.prototype[Symbol.dispose] = ct.prototype.free);
  var Se =
      typeof FinalizationRegistry > 'u'
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(r => o.__wbg_tiffresult_free(r >>> 0, 1)),
    zt = class r {
      static __wrap(t) {
        t = t >>> 0;
        let e = Object.create(r.prototype);
        return ((e.__wbg_ptr = t), Se.register(e, e.__wbg_ptr, e), e);
      }
      __destroy_into_raw() {
        let t = this.__wbg_ptr;
        return ((this.__wbg_ptr = 0), Se.unregister(this), t);
      }
      free() {
        let t = this.__destroy_into_raw();
        o.__wbg_tiffresult_free(t, 0);
      }
      get tile_count() {
        return o.tiffresult_tile_count(this.__wbg_ptr) >>> 0;
      }
      get tile_width() {
        return o.tiffresult_tile_width(this.__wbg_ptr) >>> 0;
      }
      get compression() {
        return o.tiffresult_compression(this.__wbg_ptr) >>> 0;
      }
      get sample_kind() {
        return o.tiffresult_sample_kind(this.__wbg_ptr) >>> 0;
      }
      get strip_count() {
        return o.tiffresult_strip_count(this.__wbg_ptr) >>> 0;
      }
      get tile_length() {
        return o.tiffresult_tile_length(this.__wbg_ptr) >>> 0;
      }
      get all_tags_json() {
        let t, e;
        try {
          let n = o.tiffresult_all_tags_json(this.__wbg_ptr);
          return ((t = n[0]), (e = n[1]), R(n[0], n[1]));
        } finally {
          o.__wbindgen_free(t, e, 1);
        }
      }
      get direct_decode() {
        return o.tiffresult_direct_decode(this.__wbg_ptr) !== 0;
      }
      get sample_format() {
        return o.tiffresult_sample_format(this.__wbg_ptr) >>> 0;
      }
      get_data_bytes() {
        let t = o.tiffresult_get_data_bytes(this.__wbg_ptr);
        var e = J(t[0], t[1]).slice();
        return (o.__wbindgen_free(t[0], t[1] * 1, 1), e);
      }
      get rows_per_strip() {
        return o.tiffresult_rows_per_strip(this.__wbg_ptr) >>> 0;
      }
      get timing_pack_ms() {
        return o.tiffresult_timing_pack_ms(this.__wbg_ptr);
      }
      get bits_per_sample() {
        return o.tiffresult_bits_per_sample(this.__wbg_ptr) >>> 0;
      }
      get_data_as_f32() {
        let t = o.tiffresult_get_data_as_f32(this.__wbg_ptr);
        var e = U(t[0], t[1]).slice();
        return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
      }
      take_data_as_u8() {
        let t = o.tiffresult_take_data_as_u8(this.__wbg_ptr);
        var e = J(t[0], t[1]).slice();
        return (o.__wbindgen_free(t[0], t[1] * 1, 1), e);
      }
      get timing_stats_ms() {
        return o.tiffresult_timing_stats_ms(this.__wbg_ptr);
      }
      take_data_as_f32() {
        let t = o.tiffresult_take_data_as_f32(this.__wbg_ptr);
        var e = U(t[0], t[1]).slice();
        return (o.__wbindgen_free(t[0], t[1] * 4, 4), e);
      }
      get timing_decode_ms() {
        return o.decodedarray_valid_count(this.__wbg_ptr);
      }
      get timing_convert_ms() {
        return o.imagestats_total_count(this.__wbg_ptr);
      }
      get timing_metadata_ms() {
        return o.decodedarray_non_finite_count(this.__wbg_ptr);
      }
      get page_directory_json() {
        let t, e;
        try {
          let n = o.tiffresult_page_directory_json(this.__wbg_ptr);
          return ((t = n[0]), (e = n[1]), R(n[0], n[1]));
        } finally {
          o.__wbindgen_free(t, e, 1);
        }
      }
      get planar_configuration() {
        return o.tiffresult_planar_configuration(this.__wbg_ptr) >>> 0;
      }
      get strip_byte_count_max() {
        return o.tiffresult_strip_byte_count_max(this.__wbg_ptr);
      }
      get strip_byte_count_total() {
        return o.tiffresult_strip_byte_count_total(this.__wbg_ptr);
      }
      get photometric_interpretation() {
        return o.tiffresult_photometric_interpretation(this.__wbg_ptr) >>> 0;
      }
      get width() {
        return o.decodedarray_source_data_offset(this.__wbg_ptr) >>> 0;
      }
      get height() {
        return o.tifffloatstripplanjs_lerc_additional_compression(this.__wbg_ptr) >>> 0;
      }
      get ome_xml() {
        let t, e;
        try {
          let n = o.tiffresult_ome_xml(this.__wbg_ptr);
          return ((t = n[0]), (e = n[1]), R(n[0], n[1]));
        } finally {
          o.__wbindgen_free(t, e, 1);
        }
      }
      get channels() {
        return o.tiffresult_channels(this.__wbg_ptr) >>> 0;
      }
      get data_len() {
        return o.tiffresult_data_len(this.__wbg_ptr) >>> 0;
      }
      get geo_json() {
        let t, e;
        try {
          let n = o.tiffresult_geo_json(this.__wbg_ptr);
          return ((t = n[0]), (e = n[1]), R(n[0], n[1]));
        } finally {
          o.__wbindgen_free(t, e, 1);
        }
      }
      get max_value() {
        return o.decodedarray_data_max(this.__wbg_ptr);
      }
      get min_value() {
        return o.decodedarray_data_min(this.__wbg_ptr);
      }
      get predictor() {
        return o.tiffresult_predictor(this.__wbg_ptr) >>> 0;
      }
    };
  Symbol.dispose && (zt.prototype[Symbol.dispose] = zt.prototype.free);
  var ze =
      typeof FinalizationRegistry > 'u'
        ? { register: () => {}, unregister: () => {} }
        : new FinalizationRegistry(r => o.__wbg_tiffstripmetadatajs_free(r >>> 0, 1)),
    Ct = class r {
      static __wrap(t) {
        t = t >>> 0;
        let e = Object.create(r.prototype);
        return ((e.__wbg_ptr = t), ze.register(e, e.__wbg_ptr, e), e);
      }
      __destroy_into_raw() {
        let t = this.__wbg_ptr;
        return ((this.__wbg_ptr = 0), ze.unregister(this), t);
      }
      free() {
        let t = this.__destroy_into_raw();
        o.__wbg_tiffstripmetadatajs_free(t, 0);
      }
      get page_count() {
        return o.exrresult_height(this.__wbg_ptr) >>> 0;
      }
      get all_tags_json() {
        let t, e;
        try {
          let n = o.tiffstripmetadatajs_all_tags_json(this.__wbg_ptr);
          return ((t = n[0]), (e = n[1]), R(n[0], n[1]));
        } finally {
          o.__wbindgen_free(t, e, 1);
        }
      }
      get page_directory_json() {
        let t, e;
        try {
          let n = o.tiffstripmetadatajs_page_directory_json(this.__wbg_ptr);
          return ((t = n[0]), (e = n[1]), R(n[0], n[1]));
        } finally {
          o.__wbindgen_free(t, e, 1);
        }
      }
      get photometric_interpretation() {
        return o.stabilitycurveresult_plateau_width(this.__wbg_ptr) >>> 0;
      }
      get ome_xml() {
        let t, e;
        try {
          let n = o.tiffstripmetadatajs_ome_xml(this.__wbg_ptr);
          return ((t = n[0]), (e = n[1]), R(n[0], n[1]));
        } finally {
          o.__wbindgen_free(t, e, 1);
        }
      }
      get geo_json() {
        let t, e;
        try {
          let n = o.tiffstripmetadatajs_geo_json(this.__wbg_ptr);
          return ((t = n[0]), (e = n[1]), R(n[0], n[1]));
        } finally {
          o.__wbindgen_free(t, e, 1);
        }
      }
    };
  Symbol.dispose && (Ct.prototype[Symbol.dispose] = Ct.prototype.free);
  var br = new Set(['basic', 'cors', 'default']);
  async function hr(r, t) {
    if (typeof Response == 'function' && r instanceof Response) {
      if (typeof WebAssembly.instantiateStreaming == 'function')
        try {
          return await WebAssembly.instantiateStreaming(r, t);
        } catch (n) {
          if (r.ok && br.has(r.type) && r.headers.get('Content-Type') !== 'application/wasm')
            console.warn(
              '`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n',
              n
            );
          else throw n;
        }
      let e = await r.arrayBuffer();
      return await WebAssembly.instantiate(e, t);
    } else {
      let e = await WebAssembly.instantiate(r, t);
      return e instanceof WebAssembly.Instance ? { instance: e, module: r } : e;
    }
  }
  function mr() {
    let r = {};
    return (
      (r.wbg = {}),
      (r.wbg.__wbg___wbindgen_throw_b855445ff6a94295 = function (t, e) {
        throw new Error(R(t, e));
      }),
      (r.wbg.__wbg_error_7534b8e9a36f1ab4 = function (t, e) {
        let n, s;
        try {
          ((n = t), (s = e), console.error(R(t, e)));
        } finally {
          o.__wbindgen_free(n, s, 1);
        }
      }),
      (r.wbg.__wbg_length_4126f257d88ef51e = function (t) {
        return t.length;
      }),
      (r.wbg.__wbg_length_58bec3c3f0487eb5 = function (t) {
        return t.length;
      }),
      (r.wbg.__wbg_length_69bca3cb64fc8748 = function (t) {
        return t.length;
      }),
      (r.wbg.__wbg_new_8a6f238a6ece86ea = function () {
        return new Error();
      }),
      (r.wbg.__wbg_now_793306c526e2e3b6 = function () {
        return Date.now();
      }),
      (r.wbg.__wbg_set_7a75d83ea249c6e0 = function (t, e, n) {
        t.set(qt(e, n));
      }),
      (r.wbg.__wbg_set_9e6516df7b7d0f19 = function (t, e, n) {
        t.set(J(e, n));
      }),
      (r.wbg.__wbg_set_eaa55bcb7597ecca = function (t, e, n) {
        t.set(U(e, n));
      }),
      (r.wbg.__wbg_stack_0ed75d68575b0f3c = function (t, e) {
        let n = e.stack,
          s = fr(n, o.__wbindgen_malloc, o.__wbindgen_realloc),
          i = A;
        (fe().setInt32(t + 4, i, !0), fe().setInt32(t + 0, s, !0));
      }),
      (r.wbg.__wbg_subarray_480600f3d6a9f26c = function (t, e, n) {
        return t.subarray(e >>> 0, n >>> 0);
      }),
      (r.wbg.__wbg_subarray_b24c6237257bcd4d = function (t, e, n) {
        return t.subarray(e >>> 0, n >>> 0);
      }),
      (r.wbg.__wbg_subarray_e9ae4d887d066081 = function (t, e, n) {
        return t.subarray(e >>> 0, n >>> 0);
      }),
      (r.wbg.__wbindgen_cast_2241b6af4c4b2941 = function (t, e) {
        return R(t, e);
      }),
      (r.wbg.__wbindgen_init_externref_table = function () {
        let t = o.__wbindgen_externrefs,
          e = t.grow(4);
        (t.set(0, void 0),
          t.set(e + 0, void 0),
          t.set(e + 1, null),
          t.set(e + 2, !0),
          t.set(e + 3, !1));
      }),
      r
    );
  }
  function wr(r, t) {
    return (
      (o = r.exports),
      (Ue.__wbindgen_wasm_module = t),
      (B = null),
      (nt = null),
      (st = null),
      (it = null),
      (rt = null),
      (ot = null),
      (et = null),
      o.__wbindgen_start(),
      o
    );
  }
  async function Ue(r) {
    if (o !== void 0) return o;
    (typeof r < 'u' &&
      (Object.getPrototypeOf(r) === Object.prototype
        ? ({ module_or_path: r } = r)
        : console.warn(
            'using deprecated parameters for the initialization function; pass a single object instead'
          )),
      typeof r > 'u' && (r = new URL('wasm/tiff-wasm.wasm', yr.url)));
    let t = mr();
    (typeof r == 'string' ||
      (typeof Request == 'function' && r instanceof Request) ||
      (typeof URL == 'function' && r instanceof URL)) &&
      (r = fetch(r));
    let { instance: e, module: n } = await hr(await r, t);
    return wr(e, n);
  }
  var Ee = Ue;
  var Vt = new Map(),
    It = new Map(),
    De = new Map(),
    Xe = new WeakMap(),
    Wt = !1,
    lt = new Map([
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
    Ot = new Set([
      'add',
      'subtract',
      'raw-difference',
      'raw-multiply',
      'divide',
      'min',
      'max',
      'average',
    ]);
  function xr(r) {
    let t = r.filter(e => e.visible !== !1 && (e.opacity ?? 1) > 0);
    return t.some(e => Ot.has(e.blendMode || 'normal'))
      ? t.some(e => e.channels >= 3)
        ? 3
        : 1
      : t.some(e => e.channels === 2 || e.channels === 4)
        ? 4
        : t.some(e => e.channels >= 3)
          ? 3
          : 1;
  }
  function Ye(r, t, e) {
    if (!t) return r;
    if (Array.isArray(t)) return (Bt(t, (r * 255) / e) * e) / 255;
    let n = (r * 255) / e,
      s = t.shadowInput ?? 0,
      i = t.highlightInput ?? 255,
      _ = Math.max(0.01, t.midtoneInput ?? 1),
      a = Math.max(0, Math.min(1, (n - s) / Math.max(1e-6, i - s))),
      c = t.shadowOutput ?? 0,
      l = t.highlightOutput ?? 255;
    return ((c + Math.pow(a, 1 / _) * (l - c)) * e) / 255;
  }
  function Mr(r, t) {
    let e = new Float32Array(768);
    for (let n = 0; n < 3; n++) {
      let s = ['red', 'green', 'blue'][n];
      for (let i = 0; i < 256; i++) {
        let _ = (i * t) / 255;
        e[n * 256 + i] = Ye(Ye(_, r.rgb, t), r[s], t);
      }
    }
    return e;
  }
  function kr(r) {
    let t = [
        { position: 0, color: { r: 0, g: 0, b: 0 } },
        { position: 1, color: { r: 255, g: 255, b: 255 } },
      ],
      e = (r.stops?.length ? r.stops : t)
        .map(s => ({ ...s, position: Math.max(0, Math.min(1, s.position)) }))
        .sort((s, i) => s.position - i.position),
      n = new Float32Array(256 * 3);
    for (let s = 0; s < 256; s++) {
      let i = r.reverse ? 1 - s / 255 : s / 255,
        _ = e[0],
        a = e[0],
        c = 0;
      if (i >= e[e.length - 1].position) _ = a = e[e.length - 1];
      else if (i > e[0].position) {
        for (let l = 1; l < e.length; l++)
          if (i <= e[l].position) {
            ((_ = e[l - 1]),
              (a = e[l]),
              (c = (i - _.position) / Math.max(1e-6, a.position - _.position)));
            break;
          }
      }
      for (let l = 0; l < 3; l++) {
        let d = ['r', 'g', 'b'][l];
        n[l * 256 + s] = (_.color[d] + (a.color[d] - _.color[d]) * c) / 255;
      }
    }
    return n;
  }
  function Ar(r) {
    let t = (n, s) => {
        let i = n || s;
        return [i.red ?? 0, i.green ?? 0, i.blue ?? 0, i.constant ?? 0];
      },
      e = n => [n?.cyanRed || 0, n?.magentaGreen || 0, n?.yellowBlue || 0];
    switch (r.type) {
      case 'brightness/contrast':
        return { operation: 2, parameters: new Float32Array([r.brightness || 0, r.contrast || 0]) };
      case 'exposure':
        return {
          operation: 3,
          parameters: new Float32Array([r.exposure || 0, r.offset || 0, r.gamma ?? 1]),
        };
      case 'invert':
        return { operation: 4, parameters: new Float32Array() };
      case 'channel mixer':
        return {
          operation: 5,
          parameters: new Float32Array([
            r.monochrome ? 1 : 0,
            ...t(r.red, { red: 100 }),
            ...t(r.green, { green: 100 }),
            ...t(r.blue, { blue: 100 }),
            ...t(r.gray, { red: 40, green: 40, blue: 20 }),
          ]),
        };
      case 'color balance':
        return {
          operation: 6,
          parameters: new Float32Array([
            ...e(r.shadows),
            ...e(r.midtones),
            ...e(r.highlights),
            r.preserveLuminosity ? 1 : 0,
          ]),
        };
      case 'black & white':
        return {
          operation: 7,
          parameters: new Float32Array([
            r.reds ?? 40,
            r.yellows ?? 60,
            r.greens ?? 40,
            r.cyans ?? 60,
            r.blues ?? 20,
            r.magentas ?? 80,
          ]),
        };
      case 'threshold':
        return { operation: 8, parameters: new Float32Array([r.level ?? 128]) };
      case 'posterize':
        return { operation: 9, parameters: new Float32Array([r.levels ?? 4]) };
      case 'gradient map':
        return { operation: 10, parameters: kr(r) };
    }
  }
  function vr(r) {
    let t = [];
    (n => {
      t.push(n?.hue || 0, n?.saturation || 0, n?.lightness || 0);
    })(r.master);
    for (let n of ['reds', 'yellows', 'greens', 'cyans', 'blues', 'magentas']) {
      let s = r[n],
        i = !!s && ['a', 'b', 'c', 'd'].every(_ => Number.isFinite(s[_]));
      t.push(
        i ? s.a : Number.NaN,
        i ? s.b : Number.NaN,
        i ? s.c : Number.NaN,
        i ? s.d : Number.NaN,
        s?.hue || 0,
        s?.saturation || 0,
        s?.lightness || 0
      );
    }
    return new Float32Array(t);
  }
  function Fr(r) {
    return !!r;
  }
  function jr(r) {
    if (!Wt) return 'Rust/Wasm compositor is not initialized';
    for (let t of r.filter(e => e.visible !== !1 && (e.opacity ?? 1) > 0)) {
      let e = t.name || String(t.id || 'unnamed layer');
      if (t.rasterMask && !ArrayBuffer.isView(t.rasterMask.data))
        return `"${e}" uses unsupported ${t.rasterMask.data.constructor?.name || 'mask'} storage`;
      if (t.kind === 'group') {
        if (!t.id) return `"${e}" is a group without an id`;
        if (!lt.has(t.blendMode || 'normal'))
          return `"${e}" uses unsupported blend mode "${t.blendMode}"`;
        continue;
      }
      if (t.kind === 'adjustment') {
        if (!Fr(t.adjustment)) return `"${e}" uses an adjustment not yet implemented in Rust/Wasm`;
        continue;
      }
      if (t.kind && t.kind !== 'raster') return `"${e}" is a ${t.kind} layer`;
      if (t.channels < 1 || t.channels > 4)
        return `"${e}" has unsupported ${t.channels}-channel pixels`;
      if (!t.data) return `"${e}" has no raster pixels`;
      if (!lt.has(t.blendMode || 'normal'))
        return `"${e}" uses unsupported blend mode "${t.blendMode}"`;
      if (!(
        t.data instanceof Uint8Array ||
        t.data instanceof Uint8ClampedArray ||
        t.data instanceof Uint16Array ||
        t.data instanceof Uint32Array ||
        t.data instanceof Int8Array ||
        t.data instanceof Int16Array ||
        t.data instanceof Int32Array ||
        t.data instanceof Float32Array ||
        t.data instanceof Float64Array
      ))
        return `"${e}" uses unsupported ${t.data.constructor?.name || 'pixel'} storage`;
    }
    return null;
  }
  function Qt(r, t, e, n, s) {
    let i = Math.round(t.offsetX || 0),
      _ = Math.round(t.offsetY || 0);
    if (t.channels === 4) {
      if (t.data instanceof Uint8Array || t.data instanceof Uint8ClampedArray) {
        let c =
          t.data instanceof Uint8Array
            ? t.data
            : new Uint8Array(t.data.buffer, t.data.byteOffset, t.data.byteLength);
        if ((t.typeMax || 255) === 255) {
          r.begin_isolated_u8(c, t.width, t.height, i, _);
          return;
        }
      } else if (t.data instanceof Uint16Array) {
        r.begin_isolated_u16(t.data, t.width, t.height, t.typeMax || 65535, i, _);
        return;
      } else if (t.data instanceof Float32Array) {
        r.begin_isolated_f32(t.data, t.width, t.height, t.typeMax || 1, i, _);
        return;
      }
    }
    let a = new Y(e, n, s);
    try {
      Be(a, t, 1, 0);
      let c = a.take_data();
      r.begin_isolated_f32(c, e, n, s, 0, 0);
    } finally {
      a.free();
    }
  }
  function Lr(r, t, e, n) {
    if (t.type === 'levels' || t.type === 'curves') r.isolated_apply_lut(Mr(t, n), e);
    else if (t.type === 'hue/saturation')
      if (!!t.colorize && t.colorizeEnabled !== !1) {
        let i = t.colorize;
        r.isolated_apply_hue(
          i.hue || 0,
          (i.saturation || 0) / 100,
          (i.lightness || 0) / 100,
          !0,
          e
        );
      } else r.isolated_apply_selective_hue(vr(t), e);
    else {
      let s = Ar(t);
      r.isolated_apply_direct(s.operation, s.parameters, e);
    }
  }
  function Tt(r, t, e) {
    let n = t.rasterMask;
    if (!n) return;
    let s = Math.max(1, n.channels ?? 1),
      i = n.typeMax || 255,
      _ = Math.round(n.offsetX ?? t.offsetX ?? 0),
      a = Math.round(n.offsetY ?? t.offsetY ?? 0),
      c =
        n.data instanceof Uint16Array
          ? 'u16'
          : n.data instanceof Uint8Array || n.data instanceof Uint8ClampedArray
            ? 'u8'
            : 'f32',
      l;
    if (n.data instanceof Uint8ClampedArray)
      l = new Uint8Array(n.data.buffer, n.data.byteOffset, n.data.byteLength);
    else if (c === 'f32' && !(n.data instanceof Float32Array)) {
      let u = n.data,
        f = Xe.get(u);
      (f || ((f = Float32Array.from(n.data)), Xe.set(u, f)), (l = f));
    } else l = n.data;
    let d = e ? `isolated_finish_masked_adjustment_${c}` : `isolated_apply_alpha_mask_${c}`;
    r[d](l, n.width, n.height, s, i, _, a, !!n.invert);
  }
  function Kt(r, t, e) {
    t.adjustment &&
      (t.rasterMask && r.isolated_begin_masked_adjustment(),
      Lr(r, t.adjustment, Math.max(0, Math.min(1, t.opacity ?? 1)), e),
      t.rasterMask && Tt(r, t, !0));
  }
  function Be(r, t, e, n) {
    let s = Math.round(t.offsetX || 0),
      i = Math.round(t.offsetY || 0),
      _ = t.channels,
      a = t.typeMax || 1,
      c = t.data;
    if (c instanceof Uint8Array || c instanceof Uint8ClampedArray) {
      let l = c instanceof Uint8Array ? c : new Uint8Array(c.buffer, c.byteOffset, c.byteLength);
      r.add_channels_u8(l, t.width, t.height, _, a, s, i, e, n);
    } else
      c instanceof Uint16Array
        ? r.add_channels_u16(c, t.width, t.height, _, a, s, i, e, n)
        : c instanceof Uint32Array
          ? r.add_channels_u32(c, t.width, t.height, _, a, s, i, e, n)
          : c instanceof Int8Array
            ? r.add_channels_i8(c, t.width, t.height, _, a, s, i, e, n)
            : c instanceof Int16Array
              ? r.add_channels_i16(c, t.width, t.height, _, a, s, i, e, n)
              : c instanceof Int32Array
                ? r.add_channels_i32(c, t.width, t.height, _, a, s, i, e, n)
                : c instanceof Float64Array
                  ? r.add_channels_f64(c, t.width, t.height, _, a, s, i, e, n)
                  : r.add_channels_f32(c, t.width, t.height, _, a, s, i, e, n);
  }
  function Jt(r, t, e, n) {
    let s = new Y(t, e, n);
    try {
      return (
        Qt(s, { ...r, opacity: 1, blendMode: 'normal' }, t, e, n),
        r.rasterMask && Tt(s, r, !1),
        s.finish_isolated(1, 0),
        s.take_data()
      );
    } finally {
      s.free();
    }
  }
  function Rr(r, t, e, n, s) {
    let i = new Y(e, n, s);
    try {
      (Qt(i, { ...r, opacity: 1, blendMode: 'normal' }, e, n, s), r.rasterMask && Tt(i, r, !1));
      for (let _ of t)
        if (!(_.visible === !1 || (_.opacity ?? 1) <= 0)) {
          if (_.kind === 'adjustment' && _.adjustment) Kt(i, _, s);
          else if (_.data) {
            let a = Ot.has(_.blendMode || 'normal'),
              c = (a && _.typeMax) || s,
              l = Jt(_, e, n, c),
              d = lt.get(_.blendMode || 'normal') || 0;
            i[a ? 'isolated_add_arithmetic_f32_surface' : 'isolated_add_f32_surface'](
              l,
              c,
              Math.max(0, Math.min(1, _.opacity ?? 1)),
              d
            );
          }
        }
      return i.take_isolated_surface();
    } finally {
      i.free();
    }
  }
  function Ge(r, t, e, n, s, i, _ = !1) {
    let a = new Y(t, e, n);
    try {
      let c = r.filter(b => (b.parentId || void 0) === s);
      for (let b = 0; b < c.length;) {
        let m = c[b],
          v = b + 1;
        for (; v < c.length && c[v].clipped;) v++;
        let w = c.slice(b + 1, v);
        if (m.visible === !1 || (m.opacity ?? 1) <= 0) {
          b = v;
          continue;
        }
        if (m.kind === 'adjustment' && m.adjustment) {
          let h = a.take_data();
          (a.free(),
            (a = new Y(t, e, n)),
            a.begin_isolated_f32(h, t, e, n, 0, 0),
            Kt(a, m, n),
            a.finish_isolated(1, 0),
            (b = v));
          continue;
        }
        let p = m;
        if (m.kind === 'group') {
          let h = m.id || '';
          if (!h || i.has(h)) {
            b = v;
            continue;
          }
          let M = new Set(i);
          M.add(h);
          let F = Ge(r, t, e, n, h, M, !0);
          p = {
            ...m,
            kind: 'raster',
            parentId: void 0,
            data: F.data,
            width: t,
            height: e,
            channels: 4,
            typeMax: n,
          };
        }
        if (!p.data) {
          b = v;
          continue;
        }
        let y = Math.max(0, Math.min(1, p.opacity ?? 1)),
          g = lt.get(p.blendMode || 'normal') || 0;
        if ((p.blendMode || 'normal') === 'mask') {
          let h = Jt(p, t, e, n),
            M =
              ['gt', 'ge', 'lt', 'le', 'eq', 'isfinite', 'isnan'].indexOf(
                p.maskCondition?.op || ''
              ) + 1,
            F = ((p.maskCondition?.threshold || 0) * n) / (p.typeMax || n);
          (a.apply_brightness_mask_f32_surface(h, n, M, F), (b = v));
          continue;
        }
        if (Ot.has(p.blendMode || 'normal') && (w.length || p.rasterMask)) {
          let h = p.typeMax || n,
            M = Rr(p, w, t, e, h);
          (a.add_arithmetic_f32_surface(M, h, y, g), (b = v));
          continue;
        }
        if (w.length || p.rasterMask) {
          (Qt(a, { ...p, opacity: 1, blendMode: 'normal' }, t, e, n), p.rasterMask && Tt(a, p, !1));
          for (let h of w)
            if (!(h.visible === !1 || (h.opacity ?? 1) <= 0)) {
              if (h.kind === 'adjustment' && h.adjustment) Kt(a, h, n);
              else if (h.data) {
                let M = Ot.has(h.blendMode || 'normal'),
                  F = (M && h.typeMax) || n,
                  j = Jt(h, t, e, F),
                  L = lt.get(h.blendMode || 'normal') || 0;
                a[M ? 'isolated_add_arithmetic_f32_surface' : 'isolated_add_f32_surface'](
                  j,
                  F,
                  Math.max(0, Math.min(1, h.opacity ?? 1)),
                  L
                );
              }
            }
          a.finish_isolated(y, g);
        } else Be(a, p, y, g);
        b = v;
      }
      let l = a.covered_count,
        d = a.min_value,
        u = a.max_value,
        f = _ ? 4 : xr(r);
      return {
        data: a.take_data_as_channels(f),
        width: t,
        height: e,
        channels: f,
        isFloat: r.some(b => !!b.isFloat),
        typeMax: n,
        stats: { min: d, max: u },
        coveredCount: l,
      };
    } finally {
      a?.free();
    }
  }
  function $e(r, t, e, n = !1) {
    let s = jr(r);
    if (s) {
      if (n) throw new Error(`Rust/Wasm compositor cannot render this document: ${s}`);
      return null;
    }
    let _ =
      r.filter(a => a.visible !== !1 && (a.opacity ?? 1) > 0).find(a => !!a.data)?.typeMax || 1;
    try {
      return Ge(r, t, e, _, void 0, new Set());
    } catch (a) {
      if (
        (console.warn(
          '[LayerCompositorWorker] Rust composition failed; retaining TypeScript fallback:',
          a
        ),
        n)
      )
        throw a;
      return null;
    }
  }
  function Pe(r, t, e, n, s, i, _) {
    if (t === s && e === i) return r;
    let a = De.get(_);
    if (a) return a;
    let c = r.constructor,
      l = new c(s * i * n);
    for (let d = 0; d < i; d++) {
      let u = Math.min(e - 1, Math.floor(((d + 0.5) * e) / i));
      for (let f = 0; f < s; f++) {
        let x = Math.min(t - 1, Math.floor(((f + 0.5) * t) / s)),
          b = (u * t + x) * n,
          m = (d * s + f) * n;
        for (let v = 0; v < n; v++) l[m + v] = r[b + v];
      }
    }
    return (De.set(_, l), l);
  }
  function Sr(r, t) {
    let e = r.dataAssetId === void 0 ? void 0 : Vt.get(r.dataAssetId),
      n = Math.max(1, Math.round(r.width * t)),
      s = Math.max(1, Math.round(r.height * t)),
      i =
        e && r.dataAssetId !== void 0
          ? Pe(e, r.width, r.height, r.channels, n, s, `${r.dataAssetId}:${n}x${s}:${r.channels}`)
          : void 0,
      _;
    if (r.rasterMask) {
      let u = Vt.get(r.rasterMask.dataAssetId);
      if (u) {
        let f = Math.max(1, r.rasterMask.channels || 1),
          x = Math.max(1, Math.round(r.rasterMask.width * t)),
          b = Math.max(1, Math.round(r.rasterMask.height * t));
        ((_ = {
          ...r.rasterMask,
          data: Pe(
            u,
            r.rasterMask.width,
            r.rasterMask.height,
            f,
            x,
            b,
            `mask:${r.rasterMask.dataAssetId}:${x}x${b}:${f}`
          ),
          width: x,
          height: b,
          offsetX: Math.round((r.rasterMask.offsetX || 0) * t),
          offsetY: Math.round((r.rasterMask.offsetY || 0) * t),
        }),
          delete _.dataAssetId);
      }
    }
    let a = `${r.signature}@${t}`,
      c = `${r.key}@${t}`,
      l = It.get(c);
    if (l?.signature === a) return l.layer;
    let d = {
      ...r,
      data: i,
      width: n,
      height: s,
      offsetX: Math.round((r.offsetX || 0) * t),
      offsetY: Math.round((r.offsetY || 0) * t),
      rasterMask: _,
    };
    return (
      delete d.key,
      delete d.signature,
      delete d.dataAssetId,
      It.set(c, { signature: a, layer: d }),
      d
    );
  }
  self.onmessage = async r => {
    let t = r.data;
    if (t?.type === 'init-wasm') {
      try {
        t.buffer?.byteLength && (await Ee({ module_or_path: t.buffer }), (Wt = !0));
      } catch (n) {
        console.warn(
          '[LayerCompositorWorker] Rust/WASM initialization failed; retaining TypeScript fallback:',
          n
        );
      }
      self.postMessage({ type: 'caps', rustCompositor: Wt });
      return;
    }
    if (t?.type !== 'compose') return;
    let e = performance.now();
    try {
      for (let f of t.assets) Vt.set(f.id, f.data);
      let n = Math.max(0.01, Math.min(1, Number(t.scale) || 1)),
        s = Math.max(1, Math.round(t.width * n)),
        i = Math.max(1, Math.round(t.height * n)),
        _ = new Set(),
        a = t.layers.map(f => (_.add(f.key), Sr(f, n)));
      for (let f of It.keys()) {
        let x = f.slice(0, f.lastIndexOf('@'));
        _.has(x) || It.delete(f);
      }
      let c =
          t.requestedBackend === 'wasm'
            ? 'wasm'
            : t.requestedBackend === 'javascript'
              ? 'javascript'
              : 'auto',
        l = c === 'javascript' && t.region && n === 1 ? t.region : void 0,
        d = c === 'wasm' ? $e(a, s, i, !0) : c === 'auto' && !l ? $e(a, s, i) : null,
        u = l ? de(a, s, i, l) : c === 'wasm' ? d : d || bt(a, s, i);
      self.postMessage(
        {
          type: 'composite-result',
          id: t.id,
          result: u,
          backend: d ? 'rust-wasm' : 'typescript',
          scale: n,
          durationMs: performance.now() - e,
          region: l,
        },
        [u.data.buffer]
      );
    } catch (n) {
      self.postMessage({
        type: 'composite-error',
        id: t.id,
        error: n instanceof Error ? n.message : String(n),
      });
    }
  };
  self.postMessage({ type: 'ready', caps: { rustCompositor: !1 } });
})();
