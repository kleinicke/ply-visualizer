var _h = Object.create;
var gl = Object.defineProperty;
var vh = Object.getOwnPropertyDescriptor;
var xh = Object.getOwnPropertyNames;
var Sh = Object.getPrototypeOf,
  kh = Object.prototype.hasOwnProperty;
var he = (e, n) => () => (n || e((n = { exports: {} }).exports, n), n.exports);
var Ah = (e, n, t, i) => {
  if ((n && typeof n == 'object') || typeof n == 'function')
    for (let r of xh(n))
      !kh.call(e, r) &&
        r !== t &&
        gl(e, r, { get: () => n[r], enumerable: !(i = vh(n, r)) || i.enumerable });
  return e;
};
var Ih = (e, n, t) => (
  (t = e != null ? _h(Sh(e)) : {}),
  Ah(n || !e || !e.__esModule ? gl(t, 'default', { value: e, enumerable: !0 }) : t, e)
);
var $l = he((g2, Yn) => {
  'use strict';
  function Wn(e) {
    let n = e.length;
    for (; --n >= 0;) e[n] = 0;
  }
  var $h = 0,
    Dl = 1,
    Zh = 2,
    Hh = 3,
    Xh = 258,
    ra = 29,
    Ti = 256,
    Oi = Ti + 1 + ra,
    Kn = 30,
    oa = 19,
    Ml = 2 * Oi + 1,
    kn = 15,
    Jo = 16,
    Kh = 7,
    aa = 256,
    Cl = 16,
    Ol = 17,
    Ll = 18,
    na = new Uint8Array([
      0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
    ]),
    Cr = new Uint8Array([
      0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13,
      13,
    ]),
    Wh = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7]),
    Ul = new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]),
    Yh = 512,
    Zt = new Array((Oi + 2) * 2);
  Wn(Zt);
  var Ci = new Array(Kn * 2);
  Wn(Ci);
  var Li = new Array(Yh);
  Wn(Li);
  var Ui = new Array(Xh - Hh + 1);
  Wn(Ui);
  var sa = new Array(ra);
  Wn(sa);
  var Or = new Array(Kn);
  Wn(Or);
  function Qo(e, n, t, i, r) {
    ((this.static_tree = e),
      (this.extra_bits = n),
      (this.extra_base = t),
      (this.elems = i),
      (this.max_length = r),
      (this.has_stree = e && e.length));
  }
  var Pl, Tl, Rl;
  function ea(e, n) {
    ((this.dyn_tree = e), (this.max_code = 0), (this.stat_desc = n));
  }
  var Bl = e => (e < 256 ? Li[e] : Li[256 + (e >>> 7)]),
    Pi = (e, n) => {
      ((e.pending_buf[e.pending++] = n & 255), (e.pending_buf[e.pending++] = (n >>> 8) & 255));
    },
    Ke = (e, n, t) => {
      e.bi_valid > Jo - t
        ? ((e.bi_buf |= (n << e.bi_valid) & 65535),
          Pi(e, e.bi_buf),
          (e.bi_buf = n >> (Jo - e.bi_valid)),
          (e.bi_valid += t - Jo))
        : ((e.bi_buf |= (n << e.bi_valid) & 65535), (e.bi_valid += t));
    },
    At = (e, n, t) => {
      Ke(e, t[n * 2], t[n * 2 + 1]);
    },
    zl = (e, n) => {
      let t = 0;
      do ((t |= e & 1), (e >>>= 1), (t <<= 1));
      while (--n > 0);
      return t >>> 1;
    },
    qh = e => {
      e.bi_valid === 16
        ? (Pi(e, e.bi_buf), (e.bi_buf = 0), (e.bi_valid = 0))
        : e.bi_valid >= 8 &&
          ((e.pending_buf[e.pending++] = e.bi_buf & 255), (e.bi_buf >>= 8), (e.bi_valid -= 8));
    },
    Jh = (e, n) => {
      let t = n.dyn_tree,
        i = n.max_code,
        r = n.stat_desc.static_tree,
        o = n.stat_desc.has_stree,
        a = n.stat_desc.extra_bits,
        s = n.stat_desc.extra_base,
        c = n.stat_desc.max_length,
        l,
        f,
        d,
        u,
        h,
        p,
        _ = 0;
      for (u = 0; u <= kn; u++) e.bl_count[u] = 0;
      for (t[e.heap[e.heap_max] * 2 + 1] = 0, l = e.heap_max + 1; l < Ml; l++)
        ((f = e.heap[l]),
          (u = t[t[f * 2 + 1] * 2 + 1] + 1),
          u > c && ((u = c), _++),
          (t[f * 2 + 1] = u),
          !(f > i) &&
            (e.bl_count[u]++,
            (h = 0),
            f >= s && (h = a[f - s]),
            (p = t[f * 2]),
            (e.opt_len += p * (u + h)),
            o && (e.static_len += p * (r[f * 2 + 1] + h))));
      if (_ !== 0) {
        do {
          for (u = c - 1; e.bl_count[u] === 0;) u--;
          (e.bl_count[u]--, (e.bl_count[u + 1] += 2), e.bl_count[c]--, (_ -= 2));
        } while (_ > 0);
        for (u = c; u !== 0; u--)
          for (f = e.bl_count[u]; f !== 0;)
            ((d = e.heap[--l]),
              !(d > i) &&
                (t[d * 2 + 1] !== u &&
                  ((e.opt_len += (u - t[d * 2 + 1]) * t[d * 2]), (t[d * 2 + 1] = u)),
                f--));
      }
    },
    Nl = (e, n, t) => {
      let i = new Array(kn + 1),
        r = 0,
        o,
        a;
      for (o = 1; o <= kn; o++) ((r = (r + t[o - 1]) << 1), (i[o] = r));
      for (a = 0; a <= n; a++) {
        let s = e[a * 2 + 1];
        s !== 0 && (e[a * 2] = zl(i[s]++, s));
      }
    },
    Qh = () => {
      let e,
        n,
        t,
        i,
        r,
        o = new Array(kn + 1);
      for (t = 0, i = 0; i < ra - 1; i++) for (sa[i] = t, e = 0; e < 1 << na[i]; e++) Ui[t++] = i;
      for (Ui[t - 1] = i, r = 0, i = 0; i < 16; i++)
        for (Or[i] = r, e = 0; e < 1 << Cr[i]; e++) Li[r++] = i;
      for (r >>= 7; i < Kn; i++)
        for (Or[i] = r << 7, e = 0; e < 1 << (Cr[i] - 7); e++) Li[256 + r++] = i;
      for (n = 0; n <= kn; n++) o[n] = 0;
      for (e = 0; e <= 143;) ((Zt[e * 2 + 1] = 8), e++, o[8]++);
      for (; e <= 255;) ((Zt[e * 2 + 1] = 9), e++, o[9]++);
      for (; e <= 279;) ((Zt[e * 2 + 1] = 7), e++, o[7]++);
      for (; e <= 287;) ((Zt[e * 2 + 1] = 8), e++, o[8]++);
      for (Nl(Zt, Oi + 1, o), e = 0; e < Kn; e++) ((Ci[e * 2 + 1] = 5), (Ci[e * 2] = zl(e, 5)));
      ((Pl = new Qo(Zt, na, Ti + 1, Oi, kn)),
        (Tl = new Qo(Ci, Cr, 0, Kn, kn)),
        (Rl = new Qo(new Array(0), Wh, 0, oa, Kh)));
    },
    jl = e => {
      let n;
      for (n = 0; n < Oi; n++) e.dyn_ltree[n * 2] = 0;
      for (n = 0; n < Kn; n++) e.dyn_dtree[n * 2] = 0;
      for (n = 0; n < oa; n++) e.bl_tree[n * 2] = 0;
      ((e.dyn_ltree[aa * 2] = 1), (e.opt_len = e.static_len = 0), (e.sym_next = e.matches = 0));
    },
    Vl = e => {
      (e.bi_valid > 8 ? Pi(e, e.bi_buf) : e.bi_valid > 0 && (e.pending_buf[e.pending++] = e.bi_buf),
        (e.bi_buf = 0),
        (e.bi_valid = 0));
    },
    kl = (e, n, t, i) => {
      let r = n * 2,
        o = t * 2;
      return e[r] < e[o] || (e[r] === e[o] && i[n] <= i[t]);
    },
    ta = (e, n, t) => {
      let i = e.heap[t],
        r = t << 1;
      for (
        ;
        r <= e.heap_len &&
        (r < e.heap_len && kl(n, e.heap[r + 1], e.heap[r], e.depth) && r++,
        !kl(n, i, e.heap[r], e.depth));
      )
        ((e.heap[t] = e.heap[r]), (t = r), (r <<= 1));
      e.heap[t] = i;
    },
    Al = (e, n, t) => {
      let i,
        r,
        o = 0,
        a,
        s;
      if (e.sym_next !== 0)
        do
          ((i = e.pending_buf[e.sym_buf + o++] & 255),
            (i += (e.pending_buf[e.sym_buf + o++] & 255) << 8),
            (r = e.pending_buf[e.sym_buf + o++]),
            i === 0
              ? At(e, r, n)
              : ((a = Ui[r]),
                At(e, a + Ti + 1, n),
                (s = na[a]),
                s !== 0 && ((r -= sa[a]), Ke(e, r, s)),
                i--,
                (a = Bl(i)),
                At(e, a, t),
                (s = Cr[a]),
                s !== 0 && ((i -= Or[a]), Ke(e, i, s))));
        while (o < e.sym_next);
      At(e, aa, n);
    },
    ia = (e, n) => {
      let t = n.dyn_tree,
        i = n.stat_desc.static_tree,
        r = n.stat_desc.has_stree,
        o = n.stat_desc.elems,
        a,
        s,
        c = -1,
        l;
      for (e.heap_len = 0, e.heap_max = Ml, a = 0; a < o; a++)
        t[a * 2] !== 0 ? ((e.heap[++e.heap_len] = c = a), (e.depth[a] = 0)) : (t[a * 2 + 1] = 0);
      for (; e.heap_len < 2;)
        ((l = e.heap[++e.heap_len] = c < 2 ? ++c : 0),
          (t[l * 2] = 1),
          (e.depth[l] = 0),
          e.opt_len--,
          r && (e.static_len -= i[l * 2 + 1]));
      for (n.max_code = c, a = e.heap_len >> 1; a >= 1; a--) ta(e, t, a);
      l = o;
      do
        ((a = e.heap[1]),
          (e.heap[1] = e.heap[e.heap_len--]),
          ta(e, t, 1),
          (s = e.heap[1]),
          (e.heap[--e.heap_max] = a),
          (e.heap[--e.heap_max] = s),
          (t[l * 2] = t[a * 2] + t[s * 2]),
          (e.depth[l] = (e.depth[a] >= e.depth[s] ? e.depth[a] : e.depth[s]) + 1),
          (t[a * 2 + 1] = t[s * 2 + 1] = l),
          (e.heap[1] = l++),
          ta(e, t, 1));
      while (e.heap_len >= 2);
      ((e.heap[--e.heap_max] = e.heap[1]), Jh(e, n), Nl(t, c, e.bl_count));
    },
    Il = (e, n, t) => {
      let i,
        r = -1,
        o,
        a = n[1],
        s = 0,
        c = 7,
        l = 4;
      for (a === 0 && ((c = 138), (l = 3)), n[(t + 1) * 2 + 1] = 65535, i = 0; i <= t; i++)
        ((o = a),
          (a = n[(i + 1) * 2 + 1]),
          !(++s < c && o === a) &&
            (s < l
              ? (e.bl_tree[o * 2] += s)
              : o !== 0
                ? (o !== r && e.bl_tree[o * 2]++, e.bl_tree[Cl * 2]++)
                : s <= 10
                  ? e.bl_tree[Ol * 2]++
                  : e.bl_tree[Ll * 2]++,
            (s = 0),
            (r = o),
            a === 0 ? ((c = 138), (l = 3)) : o === a ? ((c = 6), (l = 3)) : ((c = 7), (l = 4))));
    },
    Fl = (e, n, t) => {
      let i,
        r = -1,
        o,
        a = n[1],
        s = 0,
        c = 7,
        l = 4;
      for (a === 0 && ((c = 138), (l = 3)), i = 0; i <= t; i++)
        if (((o = a), (a = n[(i + 1) * 2 + 1]), !(++s < c && o === a))) {
          if (s < l)
            do At(e, o, e.bl_tree);
            while (--s !== 0);
          else
            o !== 0
              ? (o !== r && (At(e, o, e.bl_tree), s--), At(e, Cl, e.bl_tree), Ke(e, s - 3, 2))
              : s <= 10
                ? (At(e, Ol, e.bl_tree), Ke(e, s - 3, 3))
                : (At(e, Ll, e.bl_tree), Ke(e, s - 11, 7));
          ((s = 0),
            (r = o),
            a === 0 ? ((c = 138), (l = 3)) : o === a ? ((c = 6), (l = 3)) : ((c = 7), (l = 4)));
        }
    },
    ep = e => {
      let n;
      for (
        Il(e, e.dyn_ltree, e.l_desc.max_code),
          Il(e, e.dyn_dtree, e.d_desc.max_code),
          ia(e, e.bl_desc),
          n = oa - 1;
        n >= 3 && e.bl_tree[Ul[n] * 2 + 1] === 0;
        n--
      );
      return ((e.opt_len += 3 * (n + 1) + 5 + 5 + 4), n);
    },
    tp = (e, n, t, i) => {
      let r;
      for (Ke(e, n - 257, 5), Ke(e, t - 1, 5), Ke(e, i - 4, 4), r = 0; r < i; r++)
        Ke(e, e.bl_tree[Ul[r] * 2 + 1], 3);
      (Fl(e, e.dyn_ltree, n - 1), Fl(e, e.dyn_dtree, t - 1));
    },
    np = e => {
      let n = 4093624447,
        t;
      for (t = 0; t <= 31; t++, n >>>= 1) if (n & 1 && e.dyn_ltree[t * 2] !== 0) return 0;
      if (e.dyn_ltree[18] !== 0 || e.dyn_ltree[20] !== 0 || e.dyn_ltree[26] !== 0) return 1;
      for (t = 32; t < Ti; t++) if (e.dyn_ltree[t * 2] !== 0) return 1;
      return 0;
    },
    El = !1,
    ip = e => {
      (El || (Qh(), (El = !0)),
        (e.l_desc = new ea(e.dyn_ltree, Pl)),
        (e.d_desc = new ea(e.dyn_dtree, Tl)),
        (e.bl_desc = new ea(e.bl_tree, Rl)),
        (e.bi_buf = 0),
        (e.bi_valid = 0),
        jl(e));
    },
    Gl = (e, n, t, i) => {
      (Ke(e, ($h << 1) + (i ? 1 : 0), 3),
        Vl(e),
        Pi(e, t),
        Pi(e, ~t),
        t && e.pending_buf.set(e.window.subarray(n, n + t), e.pending),
        (e.pending += t));
    },
    rp = e => {
      (Ke(e, Dl << 1, 3), At(e, aa, Zt), qh(e));
    },
    op = (e, n, t, i) => {
      let r,
        o,
        a = 0;
      (e.level > 0
        ? (e.strm.data_type === 2 && (e.strm.data_type = np(e)),
          ia(e, e.l_desc),
          ia(e, e.d_desc),
          (a = ep(e)),
          (r = (e.opt_len + 3 + 7) >>> 3),
          (o = (e.static_len + 3 + 7) >>> 3),
          o <= r && (r = o))
        : (r = o = t + 5),
        t + 4 <= r && n !== -1
          ? Gl(e, n, t, i)
          : e.strategy === 4 || o === r
            ? (Ke(e, (Dl << 1) + (i ? 1 : 0), 3), Al(e, Zt, Ci))
            : (Ke(e, (Zh << 1) + (i ? 1 : 0), 3),
              tp(e, e.l_desc.max_code + 1, e.d_desc.max_code + 1, a + 1),
              Al(e, e.dyn_ltree, e.dyn_dtree)),
        jl(e),
        i && Vl(e));
    },
    ap = (e, n, t) => (
      (e.pending_buf[e.sym_buf + e.sym_next++] = n),
      (e.pending_buf[e.sym_buf + e.sym_next++] = n >> 8),
      (e.pending_buf[e.sym_buf + e.sym_next++] = t),
      n === 0
        ? e.dyn_ltree[t * 2]++
        : (e.matches++, n--, e.dyn_ltree[(Ui[t] + Ti + 1) * 2]++, e.dyn_dtree[Bl(n) * 2]++),
      e.sym_next === e.sym_end
    );
  Yn.exports._tr_init = ip;
  Yn.exports._tr_stored_block = Gl;
  Yn.exports._tr_flush_block = op;
  Yn.exports._tr_tally = ap;
  Yn.exports._tr_align = rp;
});
var la = he((m2, Zl) => {
  'use strict';
  var sp = (e, n, t, i) => {
    let r = (e & 65535) | 0,
      o = ((e >>> 16) & 65535) | 0,
      a = 0;
    for (; t !== 0;) {
      ((a = t > 2e3 ? 2e3 : t), (t -= a));
      do ((r = (r + n[i++]) | 0), (o = (o + r) | 0));
      while (--a);
      ((r %= 65521), (o %= 65521));
    }
    return r | (o << 16) | 0;
  };
  Zl.exports = sp;
});
var ca = he((b2, Hl) => {
  'use strict';
  var lp = () => {
      let e,
        n = [];
      for (var t = 0; t < 256; t++) {
        e = t;
        for (var i = 0; i < 8; i++) e = e & 1 ? 3988292384 ^ (e >>> 1) : e >>> 1;
        n[t] = e;
      }
      return n;
    },
    cp = new Uint32Array(lp()),
    fp = (e, n, t, i) => {
      let r = cp,
        o = i + t;
      e ^= -1;
      for (let a = i; a < o; a++) e = (e >>> 8) ^ r[(e ^ n[a]) & 255];
      return e ^ -1;
    };
  Hl.exports = fp;
});
var Lr = he((y2, Xl) => {
  'use strict';
  Xl.exports = {
    2: 'need dictionary',
    1: 'stream end',
    0: '',
    '-1': 'file error',
    '-2': 'stream error',
    '-3': 'data error',
    '-4': 'insufficient memory',
    '-5': 'buffer error',
    '-6': 'incompatible version',
  };
});
var nn = he((w2, Kl) => {
  'use strict';
  Kl.exports = {
    Z_NO_FLUSH: 0,
    Z_PARTIAL_FLUSH: 1,
    Z_SYNC_FLUSH: 2,
    Z_FULL_FLUSH: 3,
    Z_FINISH: 4,
    Z_BLOCK: 5,
    Z_TREES: 6,
    Z_OK: 0,
    Z_STREAM_END: 1,
    Z_NEED_DICT: 2,
    Z_ERRNO: -1,
    Z_STREAM_ERROR: -2,
    Z_DATA_ERROR: -3,
    Z_MEM_ERROR: -4,
    Z_BUF_ERROR: -5,
    Z_NO_COMPRESSION: 0,
    Z_BEST_SPEED: 1,
    Z_BEST_COMPRESSION: 9,
    Z_DEFAULT_COMPRESSION: -1,
    Z_FILTERED: 1,
    Z_HUFFMAN_ONLY: 2,
    Z_RLE: 3,
    Z_FIXED: 4,
    Z_DEFAULT_STRATEGY: 0,
    Z_BINARY: 0,
    Z_TEXT: 1,
    Z_UNKNOWN: 2,
    Z_DEFLATED: 8,
  };
});
var rc = he((_2, Dt) => {
  'use strict';
  var {
      _tr_init: up,
      _tr_stored_block: da,
      _tr_flush_block: dp,
      _tr_tally: sn,
      _tr_align: hp,
    } = $l(),
    Jl = la(),
    rn = ca(),
    pp = Lr(),
    {
      Z_NO_FLUSH: ln,
      Z_PARTIAL_FLUSH: gp,
      Z_FULL_FLUSH: mp,
      Z_FINISH: lt,
      Z_BLOCK: Wl,
      Z_OK: Pe,
      Z_STREAM_END: Yl,
      Z_STREAM_ERROR: Ft,
      Z_DATA_ERROR: bp,
      Z_BUF_ERROR: fa,
      Z_DEFAULT_COMPRESSION: yp,
      Z_FILTERED: wp,
      Z_HUFFMAN_ONLY: Ur,
      Z_RLE: _p,
      Z_FIXED: vp,
      Z_DEFAULT_STRATEGY: xp,
      Z_UNKNOWN: Sp,
      Z_DEFLATED: Pr,
    } = nn(),
    kp = 9,
    Ap = 15,
    Ip = 8,
    Fp = 29,
    Ep = 256,
    ha = Ep + 1 + Fp,
    Dp = 30,
    Mp = 19,
    Cp = 2 * ha + 1,
    Op = 15,
    fe = 3,
    an = 258,
    Et = an + fe + 1,
    Lp = 32,
    Jn = 42,
    wa = 57,
    pa = 69,
    ga = 73,
    ma = 91,
    ba = 103,
    An = 113,
    Bi = 666,
    Ge = 1,
    ei = 2,
    Fn = 3,
    ti = 4,
    Up = 3,
    In = (e, n) => ((e.msg = pp[n]), n),
    ql = e => e * 2 - (e > 4 ? 9 : 0),
    on = e => {
      let n = e.length;
      for (; --n >= 0;) e[n] = 0;
    },
    Pp = e => {
      let n,
        t,
        i,
        r = e.w_size;
      ((n = e.hash_size), (i = n));
      do ((t = e.head[--i]), (e.head[i] = t >= r ? t - r : 0));
      while (--n);
      ((n = r), (i = n));
      do ((t = e.prev[--i]), (e.prev[i] = t >= r ? t - r : 0));
      while (--n);
    },
    Tp = (e, n, t) => ((n << e.hash_shift) ^ t) & e.hash_mask,
    cn = Tp,
    Je = e => {
      let n = e.state,
        t = n.pending;
      (t > e.avail_out && (t = e.avail_out),
        t !== 0 &&
          (e.output.set(n.pending_buf.subarray(n.pending_out, n.pending_out + t), e.next_out),
          (e.next_out += t),
          (n.pending_out += t),
          (e.total_out += t),
          (e.avail_out -= t),
          (n.pending -= t),
          n.pending === 0 && (n.pending_out = 0)));
    },
    Qe = (e, n) => {
      (dp(e, e.block_start >= 0 ? e.block_start : -1, e.strstart - e.block_start, n),
        (e.block_start = e.strstart),
        Je(e.strm));
    },
    me = (e, n) => {
      e.pending_buf[e.pending++] = n;
    },
    Ri = (e, n) => {
      ((e.pending_buf[e.pending++] = (n >>> 8) & 255), (e.pending_buf[e.pending++] = n & 255));
    },
    ya = (e, n, t, i) => {
      let r = e.avail_in;
      return (
        r > i && (r = i),
        r === 0
          ? 0
          : ((e.avail_in -= r),
            n.set(e.input.subarray(e.next_in, e.next_in + r), t),
            e.state.wrap === 1
              ? (e.adler = Jl(e.adler, n, r, t))
              : e.state.wrap === 2 && (e.adler = rn(e.adler, n, r, t)),
            (e.next_in += r),
            (e.total_in += r),
            r)
      );
    },
    Ql = (e, n) => {
      let t = e.max_chain_length,
        i = e.strstart,
        r,
        o,
        a = e.prev_length,
        s = e.nice_match,
        c = e.strstart > e.w_size - Et ? e.strstart - (e.w_size - Et) : 0,
        l = e.window,
        f = e.w_mask,
        d = e.prev,
        u = e.strstart + an,
        h = l[i + a - 1],
        p = l[i + a];
      (e.prev_length >= e.good_match && (t >>= 2), s > e.lookahead && (s = e.lookahead));
      do
        if (
          ((r = n), !(l[r + a] !== p || l[r + a - 1] !== h || l[r] !== l[i] || l[++r] !== l[i + 1]))
        ) {
          ((i += 2), r++);
          do;
          while (
            l[++i] === l[++r] &&
            l[++i] === l[++r] &&
            l[++i] === l[++r] &&
            l[++i] === l[++r] &&
            l[++i] === l[++r] &&
            l[++i] === l[++r] &&
            l[++i] === l[++r] &&
            l[++i] === l[++r] &&
            i < u
          );
          if (((o = an - (u - i)), (i = u - an), o > a)) {
            if (((e.match_start = n), (a = o), o >= s)) break;
            ((h = l[i + a - 1]), (p = l[i + a]));
          }
        }
      while ((n = d[n & f]) > c && --t !== 0);
      return a <= e.lookahead ? a : e.lookahead;
    },
    Qn = e => {
      let n = e.w_size,
        t,
        i,
        r;
      do {
        if (
          ((i = e.window_size - e.lookahead - e.strstart),
          e.strstart >= n + (n - Et) &&
            (e.window.set(e.window.subarray(n, n + n - i), 0),
            (e.match_start -= n),
            (e.strstart -= n),
            (e.block_start -= n),
            e.insert > e.strstart && (e.insert = e.strstart),
            Pp(e),
            (i += n)),
          e.strm.avail_in === 0)
        )
          break;
        if (
          ((t = ya(e.strm, e.window, e.strstart + e.lookahead, i)),
          (e.lookahead += t),
          e.lookahead + e.insert >= fe)
        )
          for (
            r = e.strstart - e.insert,
              e.ins_h = e.window[r],
              e.ins_h = cn(e, e.ins_h, e.window[r + 1]);
            e.insert &&
            ((e.ins_h = cn(e, e.ins_h, e.window[r + fe - 1])),
            (e.prev[r & e.w_mask] = e.head[e.ins_h]),
            (e.head[e.ins_h] = r),
            r++,
            e.insert--,
            !(e.lookahead + e.insert < fe));
          );
      } while (e.lookahead < Et && e.strm.avail_in !== 0);
    },
    ec = (e, n) => {
      let t = e.pending_buf_size - 5 > e.w_size ? e.w_size : e.pending_buf_size - 5,
        i,
        r,
        o,
        a = 0,
        s = e.strm.avail_in;
      do {
        if (
          ((i = 65535),
          (o = (e.bi_valid + 42) >> 3),
          e.strm.avail_out < o ||
            ((o = e.strm.avail_out - o),
            (r = e.strstart - e.block_start),
            i > r + e.strm.avail_in && (i = r + e.strm.avail_in),
            i > o && (i = o),
            i < t && ((i === 0 && n !== lt) || n === ln || i !== r + e.strm.avail_in)))
        )
          break;
        ((a = n === lt && i === r + e.strm.avail_in ? 1 : 0),
          da(e, 0, 0, a),
          (e.pending_buf[e.pending - 4] = i),
          (e.pending_buf[e.pending - 3] = i >> 8),
          (e.pending_buf[e.pending - 2] = ~i),
          (e.pending_buf[e.pending - 1] = ~i >> 8),
          Je(e.strm),
          r &&
            (r > i && (r = i),
            e.strm.output.set(e.window.subarray(e.block_start, e.block_start + r), e.strm.next_out),
            (e.strm.next_out += r),
            (e.strm.avail_out -= r),
            (e.strm.total_out += r),
            (e.block_start += r),
            (i -= r)),
          i &&
            (ya(e.strm, e.strm.output, e.strm.next_out, i),
            (e.strm.next_out += i),
            (e.strm.avail_out -= i),
            (e.strm.total_out += i)));
      } while (a === 0);
      return (
        (s -= e.strm.avail_in),
        s &&
          (s >= e.w_size
            ? ((e.matches = 2),
              e.window.set(e.strm.input.subarray(e.strm.next_in - e.w_size, e.strm.next_in), 0),
              (e.strstart = e.w_size),
              (e.insert = e.strstart))
            : (e.window_size - e.strstart <= s &&
                ((e.strstart -= e.w_size),
                e.window.set(e.window.subarray(e.w_size, e.w_size + e.strstart), 0),
                e.matches < 2 && e.matches++,
                e.insert > e.strstart && (e.insert = e.strstart)),
              e.window.set(e.strm.input.subarray(e.strm.next_in - s, e.strm.next_in), e.strstart),
              (e.strstart += s),
              (e.insert += s > e.w_size - e.insert ? e.w_size - e.insert : s)),
          (e.block_start = e.strstart)),
        e.high_water < e.strstart && (e.high_water = e.strstart),
        a
          ? ti
          : n !== ln && n !== lt && e.strm.avail_in === 0 && e.strstart === e.block_start
            ? ei
            : ((o = e.window_size - e.strstart),
              e.strm.avail_in > o &&
                e.block_start >= e.w_size &&
                ((e.block_start -= e.w_size),
                (e.strstart -= e.w_size),
                e.window.set(e.window.subarray(e.w_size, e.w_size + e.strstart), 0),
                e.matches < 2 && e.matches++,
                (o += e.w_size),
                e.insert > e.strstart && (e.insert = e.strstart)),
              o > e.strm.avail_in && (o = e.strm.avail_in),
              o &&
                (ya(e.strm, e.window, e.strstart, o),
                (e.strstart += o),
                (e.insert += o > e.w_size - e.insert ? e.w_size - e.insert : o)),
              e.high_water < e.strstart && (e.high_water = e.strstart),
              (o = (e.bi_valid + 42) >> 3),
              (o = e.pending_buf_size - o > 65535 ? 65535 : e.pending_buf_size - o),
              (t = o > e.w_size ? e.w_size : o),
              (r = e.strstart - e.block_start),
              (r >= t || ((r || n === lt) && n !== ln && e.strm.avail_in === 0 && r <= o)) &&
                ((i = r > o ? o : r),
                (a = n === lt && e.strm.avail_in === 0 && i === r ? 1 : 0),
                da(e, e.block_start, i, a),
                (e.block_start += i),
                Je(e.strm)),
              a ? Fn : Ge)
      );
    },
    ua = (e, n) => {
      let t, i;
      for (;;) {
        if (e.lookahead < Et) {
          if ((Qn(e), e.lookahead < Et && n === ln)) return Ge;
          if (e.lookahead === 0) break;
        }
        if (
          ((t = 0),
          e.lookahead >= fe &&
            ((e.ins_h = cn(e, e.ins_h, e.window[e.strstart + fe - 1])),
            (t = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h]),
            (e.head[e.ins_h] = e.strstart)),
          t !== 0 && e.strstart - t <= e.w_size - Et && (e.match_length = Ql(e, t)),
          e.match_length >= fe)
        )
          if (
            ((i = sn(e, e.strstart - e.match_start, e.match_length - fe)),
            (e.lookahead -= e.match_length),
            e.match_length <= e.max_lazy_match && e.lookahead >= fe)
          ) {
            e.match_length--;
            do
              (e.strstart++,
                (e.ins_h = cn(e, e.ins_h, e.window[e.strstart + fe - 1])),
                (t = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h]),
                (e.head[e.ins_h] = e.strstart));
            while (--e.match_length !== 0);
            e.strstart++;
          } else
            ((e.strstart += e.match_length),
              (e.match_length = 0),
              (e.ins_h = e.window[e.strstart]),
              (e.ins_h = cn(e, e.ins_h, e.window[e.strstart + 1])));
        else ((i = sn(e, 0, e.window[e.strstart])), e.lookahead--, e.strstart++);
        if (i && (Qe(e, !1), e.strm.avail_out === 0)) return Ge;
      }
      return (
        (e.insert = e.strstart < fe - 1 ? e.strstart : fe - 1),
        n === lt
          ? (Qe(e, !0), e.strm.avail_out === 0 ? Fn : ti)
          : e.sym_next && (Qe(e, !1), e.strm.avail_out === 0)
            ? Ge
            : ei
      );
    },
    qn = (e, n) => {
      let t, i, r;
      for (;;) {
        if (e.lookahead < Et) {
          if ((Qn(e), e.lookahead < Et && n === ln)) return Ge;
          if (e.lookahead === 0) break;
        }
        if (
          ((t = 0),
          e.lookahead >= fe &&
            ((e.ins_h = cn(e, e.ins_h, e.window[e.strstart + fe - 1])),
            (t = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h]),
            (e.head[e.ins_h] = e.strstart)),
          (e.prev_length = e.match_length),
          (e.prev_match = e.match_start),
          (e.match_length = fe - 1),
          t !== 0 &&
            e.prev_length < e.max_lazy_match &&
            e.strstart - t <= e.w_size - Et &&
            ((e.match_length = Ql(e, t)),
            e.match_length <= 5 &&
              (e.strategy === wp || (e.match_length === fe && e.strstart - e.match_start > 4096)) &&
              (e.match_length = fe - 1)),
          e.prev_length >= fe && e.match_length <= e.prev_length)
        ) {
          ((r = e.strstart + e.lookahead - fe),
            (i = sn(e, e.strstart - 1 - e.prev_match, e.prev_length - fe)),
            (e.lookahead -= e.prev_length - 1),
            (e.prev_length -= 2));
          do
            ++e.strstart <= r &&
              ((e.ins_h = cn(e, e.ins_h, e.window[e.strstart + fe - 1])),
              (t = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h]),
              (e.head[e.ins_h] = e.strstart));
          while (--e.prev_length !== 0);
          if (
            ((e.match_available = 0),
            (e.match_length = fe - 1),
            e.strstart++,
            i && (Qe(e, !1), e.strm.avail_out === 0))
          )
            return Ge;
        } else if (e.match_available) {
          if (
            ((i = sn(e, 0, e.window[e.strstart - 1])),
            i && Qe(e, !1),
            e.strstart++,
            e.lookahead--,
            e.strm.avail_out === 0)
          )
            return Ge;
        } else ((e.match_available = 1), e.strstart++, e.lookahead--);
      }
      return (
        e.match_available && ((i = sn(e, 0, e.window[e.strstart - 1])), (e.match_available = 0)),
        (e.insert = e.strstart < fe - 1 ? e.strstart : fe - 1),
        n === lt
          ? (Qe(e, !0), e.strm.avail_out === 0 ? Fn : ti)
          : e.sym_next && (Qe(e, !1), e.strm.avail_out === 0)
            ? Ge
            : ei
      );
    },
    Rp = (e, n) => {
      let t,
        i,
        r,
        o,
        a = e.window;
      for (;;) {
        if (e.lookahead <= an) {
          if ((Qn(e), e.lookahead <= an && n === ln)) return Ge;
          if (e.lookahead === 0) break;
        }
        if (
          ((e.match_length = 0),
          e.lookahead >= fe &&
            e.strstart > 0 &&
            ((r = e.strstart - 1), (i = a[r]), i === a[++r] && i === a[++r] && i === a[++r]))
        ) {
          o = e.strstart + an;
          do;
          while (
            i === a[++r] &&
            i === a[++r] &&
            i === a[++r] &&
            i === a[++r] &&
            i === a[++r] &&
            i === a[++r] &&
            i === a[++r] &&
            i === a[++r] &&
            r < o
          );
          ((e.match_length = an - (o - r)),
            e.match_length > e.lookahead && (e.match_length = e.lookahead));
        }
        if (
          (e.match_length >= fe
            ? ((t = sn(e, 1, e.match_length - fe)),
              (e.lookahead -= e.match_length),
              (e.strstart += e.match_length),
              (e.match_length = 0))
            : ((t = sn(e, 0, e.window[e.strstart])), e.lookahead--, e.strstart++),
          t && (Qe(e, !1), e.strm.avail_out === 0))
        )
          return Ge;
      }
      return (
        (e.insert = 0),
        n === lt
          ? (Qe(e, !0), e.strm.avail_out === 0 ? Fn : ti)
          : e.sym_next && (Qe(e, !1), e.strm.avail_out === 0)
            ? Ge
            : ei
      );
    },
    Bp = (e, n) => {
      let t;
      for (;;) {
        if (e.lookahead === 0 && (Qn(e), e.lookahead === 0)) {
          if (n === ln) return Ge;
          break;
        }
        if (
          ((e.match_length = 0),
          (t = sn(e, 0, e.window[e.strstart])),
          e.lookahead--,
          e.strstart++,
          t && (Qe(e, !1), e.strm.avail_out === 0))
        )
          return Ge;
      }
      return (
        (e.insert = 0),
        n === lt
          ? (Qe(e, !0), e.strm.avail_out === 0 ? Fn : ti)
          : e.sym_next && (Qe(e, !1), e.strm.avail_out === 0)
            ? Ge
            : ei
      );
    };
  function It(e, n, t, i, r) {
    ((this.good_length = e),
      (this.max_lazy = n),
      (this.nice_length = t),
      (this.max_chain = i),
      (this.func = r));
  }
  var zi = [
      new It(0, 0, 0, 0, ec),
      new It(4, 4, 8, 4, ua),
      new It(4, 5, 16, 8, ua),
      new It(4, 6, 32, 32, ua),
      new It(4, 4, 16, 16, qn),
      new It(8, 16, 32, 32, qn),
      new It(8, 16, 128, 128, qn),
      new It(8, 32, 128, 256, qn),
      new It(32, 128, 258, 1024, qn),
      new It(32, 258, 258, 4096, qn),
    ],
    zp = e => {
      ((e.window_size = 2 * e.w_size),
        on(e.head),
        (e.max_lazy_match = zi[e.level].max_lazy),
        (e.good_match = zi[e.level].good_length),
        (e.nice_match = zi[e.level].nice_length),
        (e.max_chain_length = zi[e.level].max_chain),
        (e.strstart = 0),
        (e.block_start = 0),
        (e.lookahead = 0),
        (e.insert = 0),
        (e.match_length = e.prev_length = fe - 1),
        (e.match_available = 0),
        (e.ins_h = 0));
    };
  function Np() {
    ((this.strm = null),
      (this.status = 0),
      (this.pending_buf = null),
      (this.pending_buf_size = 0),
      (this.pending_out = 0),
      (this.pending = 0),
      (this.wrap = 0),
      (this.gzhead = null),
      (this.gzindex = 0),
      (this.method = Pr),
      (this.last_flush = -1),
      (this.w_size = 0),
      (this.w_bits = 0),
      (this.w_mask = 0),
      (this.window = null),
      (this.window_size = 0),
      (this.prev = null),
      (this.head = null),
      (this.ins_h = 0),
      (this.hash_size = 0),
      (this.hash_bits = 0),
      (this.hash_mask = 0),
      (this.hash_shift = 0),
      (this.block_start = 0),
      (this.match_length = 0),
      (this.prev_match = 0),
      (this.match_available = 0),
      (this.strstart = 0),
      (this.match_start = 0),
      (this.lookahead = 0),
      (this.prev_length = 0),
      (this.max_chain_length = 0),
      (this.max_lazy_match = 0),
      (this.level = 0),
      (this.strategy = 0),
      (this.good_match = 0),
      (this.nice_match = 0),
      (this.dyn_ltree = new Uint16Array(Cp * 2)),
      (this.dyn_dtree = new Uint16Array((2 * Dp + 1) * 2)),
      (this.bl_tree = new Uint16Array((2 * Mp + 1) * 2)),
      on(this.dyn_ltree),
      on(this.dyn_dtree),
      on(this.bl_tree),
      (this.l_desc = null),
      (this.d_desc = null),
      (this.bl_desc = null),
      (this.bl_count = new Uint16Array(Op + 1)),
      (this.heap = new Uint16Array(2 * ha + 1)),
      on(this.heap),
      (this.heap_len = 0),
      (this.heap_max = 0),
      (this.depth = new Uint16Array(2 * ha + 1)),
      on(this.depth),
      (this.sym_buf = 0),
      (this.lit_bufsize = 0),
      (this.sym_next = 0),
      (this.sym_end = 0),
      (this.opt_len = 0),
      (this.static_len = 0),
      (this.matches = 0),
      (this.insert = 0),
      (this.bi_buf = 0),
      (this.bi_valid = 0));
  }
  var Ni = e => {
      if (!e) return 1;
      let n = e.state;
      return !n ||
        n.strm !== e ||
        (n.status !== Jn &&
          n.status !== wa &&
          n.status !== pa &&
          n.status !== ga &&
          n.status !== ma &&
          n.status !== ba &&
          n.status !== An &&
          n.status !== Bi)
        ? 1
        : 0;
    },
    tc = e => {
      if (Ni(e)) return In(e, Ft);
      ((e.total_in = e.total_out = 0), (e.data_type = Sp));
      let n = e.state;
      return (
        (n.pending = 0),
        (n.pending_out = 0),
        n.wrap < 0 && (n.wrap = -n.wrap),
        (n.status = n.wrap === 2 ? wa : n.wrap ? Jn : An),
        (e.adler = n.wrap === 2 ? 0 : 1),
        (n.last_flush = -2),
        up(n),
        Pe
      );
    },
    nc = e => {
      let n = tc(e);
      return (n === Pe && zp(e.state), n);
    },
    jp = (e, n) => (Ni(e) || e.state.wrap !== 2 ? Ft : ((e.state.gzhead = n), Pe)),
    ic = (e, n, t, i, r, o) => {
      if (!e) return Ft;
      let a = 1;
      if (
        (n === yp && (n = 6),
        i < 0 ? ((a = 0), (i = -i)) : i > 15 && ((a = 2), (i -= 16)),
        r < 1 ||
          r > kp ||
          t !== Pr ||
          i < 8 ||
          i > 15 ||
          n < 0 ||
          n > 9 ||
          o < 0 ||
          o > vp ||
          (i === 8 && a !== 1))
      )
        return In(e, Ft);
      i === 8 && (i = 9);
      let s = new Np();
      return (
        (e.state = s),
        (s.strm = e),
        (s.status = Jn),
        (s.wrap = a),
        (s.gzhead = null),
        (s.w_bits = i),
        (s.w_size = 1 << s.w_bits),
        (s.w_mask = s.w_size - 1),
        (s.hash_bits = r + 7),
        (s.hash_size = 1 << s.hash_bits),
        (s.hash_mask = s.hash_size - 1),
        (s.hash_shift = ~~((s.hash_bits + fe - 1) / fe)),
        (s.window = new Uint8Array(s.w_size * 2)),
        (s.head = new Uint16Array(s.hash_size)),
        (s.prev = new Uint16Array(s.w_size)),
        (s.lit_bufsize = 1 << (r + 6)),
        (s.pending_buf_size = s.lit_bufsize * 4),
        (s.pending_buf = new Uint8Array(s.pending_buf_size)),
        (s.sym_buf = s.lit_bufsize),
        (s.sym_end = (s.lit_bufsize - 1) * 3),
        (s.level = n),
        (s.strategy = o),
        (s.method = t),
        nc(e)
      );
    },
    Vp = (e, n) => ic(e, n, Pr, Ap, Ip, xp),
    Gp = (e, n) => {
      if (Ni(e) || n > Wl || n < 0) return e ? In(e, Ft) : Ft;
      let t = e.state;
      if (!e.output || (e.avail_in !== 0 && !e.input) || (t.status === Bi && n !== lt))
        return In(e, e.avail_out === 0 ? fa : Ft);
      let i = t.last_flush;
      if (((t.last_flush = n), t.pending !== 0)) {
        if ((Je(e), e.avail_out === 0)) return ((t.last_flush = -1), Pe);
      } else if (e.avail_in === 0 && ql(n) <= ql(i) && n !== lt) return In(e, fa);
      if (t.status === Bi && e.avail_in !== 0) return In(e, fa);
      if ((t.status === Jn && t.wrap === 0 && (t.status = An), t.status === Jn)) {
        let r = (Pr + ((t.w_bits - 8) << 4)) << 8,
          o = -1;
        if (
          (t.strategy >= Ur || t.level < 2
            ? (o = 0)
            : t.level < 6
              ? (o = 1)
              : t.level === 6
                ? (o = 2)
                : (o = 3),
          (r |= o << 6),
          t.strstart !== 0 && (r |= Lp),
          (r += 31 - (r % 31)),
          Ri(t, r),
          t.strstart !== 0 && (Ri(t, e.adler >>> 16), Ri(t, e.adler & 65535)),
          (e.adler = 1),
          (t.status = An),
          Je(e),
          t.pending !== 0)
        )
          return ((t.last_flush = -1), Pe);
      }
      if (t.status === wa) {
        if (((e.adler = 0), me(t, 31), me(t, 139), me(t, 8), t.gzhead))
          (me(
            t,
            (t.gzhead.text ? 1 : 0) +
              (t.gzhead.hcrc ? 2 : 0) +
              (t.gzhead.extra ? 4 : 0) +
              (t.gzhead.name ? 8 : 0) +
              (t.gzhead.comment ? 16 : 0)
          ),
            me(t, t.gzhead.time & 255),
            me(t, (t.gzhead.time >> 8) & 255),
            me(t, (t.gzhead.time >> 16) & 255),
            me(t, (t.gzhead.time >> 24) & 255),
            me(t, t.level === 9 ? 2 : t.strategy >= Ur || t.level < 2 ? 4 : 0),
            me(t, t.gzhead.os & 255),
            t.gzhead.extra &&
              t.gzhead.extra.length &&
              (me(t, t.gzhead.extra.length & 255), me(t, (t.gzhead.extra.length >> 8) & 255)),
            t.gzhead.hcrc && (e.adler = rn(e.adler, t.pending_buf, t.pending, 0)),
            (t.gzindex = 0),
            (t.status = pa));
        else if (
          (me(t, 0),
          me(t, 0),
          me(t, 0),
          me(t, 0),
          me(t, 0),
          me(t, t.level === 9 ? 2 : t.strategy >= Ur || t.level < 2 ? 4 : 0),
          me(t, Up),
          (t.status = An),
          Je(e),
          t.pending !== 0)
        )
          return ((t.last_flush = -1), Pe);
      }
      if (t.status === pa) {
        if (t.gzhead.extra) {
          let r = t.pending,
            o = (t.gzhead.extra.length & 65535) - t.gzindex;
          for (; t.pending + o > t.pending_buf_size;) {
            let s = t.pending_buf_size - t.pending;
            if (
              (t.pending_buf.set(t.gzhead.extra.subarray(t.gzindex, t.gzindex + s), t.pending),
              (t.pending = t.pending_buf_size),
              t.gzhead.hcrc &&
                t.pending > r &&
                (e.adler = rn(e.adler, t.pending_buf, t.pending - r, r)),
              (t.gzindex += s),
              Je(e),
              t.pending !== 0)
            )
              return ((t.last_flush = -1), Pe);
            ((r = 0), (o -= s));
          }
          let a = new Uint8Array(t.gzhead.extra);
          (t.pending_buf.set(a.subarray(t.gzindex, t.gzindex + o), t.pending),
            (t.pending += o),
            t.gzhead.hcrc &&
              t.pending > r &&
              (e.adler = rn(e.adler, t.pending_buf, t.pending - r, r)),
            (t.gzindex = 0));
        }
        t.status = ga;
      }
      if (t.status === ga) {
        if (t.gzhead.name) {
          let r = t.pending,
            o;
          do {
            if (t.pending === t.pending_buf_size) {
              if (
                (t.gzhead.hcrc &&
                  t.pending > r &&
                  (e.adler = rn(e.adler, t.pending_buf, t.pending - r, r)),
                Je(e),
                t.pending !== 0)
              )
                return ((t.last_flush = -1), Pe);
              r = 0;
            }
            (t.gzindex < t.gzhead.name.length
              ? (o = t.gzhead.name.charCodeAt(t.gzindex++) & 255)
              : (o = 0),
              me(t, o));
          } while (o !== 0);
          (t.gzhead.hcrc &&
            t.pending > r &&
            (e.adler = rn(e.adler, t.pending_buf, t.pending - r, r)),
            (t.gzindex = 0));
        }
        t.status = ma;
      }
      if (t.status === ma) {
        if (t.gzhead.comment) {
          let r = t.pending,
            o;
          do {
            if (t.pending === t.pending_buf_size) {
              if (
                (t.gzhead.hcrc &&
                  t.pending > r &&
                  (e.adler = rn(e.adler, t.pending_buf, t.pending - r, r)),
                Je(e),
                t.pending !== 0)
              )
                return ((t.last_flush = -1), Pe);
              r = 0;
            }
            (t.gzindex < t.gzhead.comment.length
              ? (o = t.gzhead.comment.charCodeAt(t.gzindex++) & 255)
              : (o = 0),
              me(t, o));
          } while (o !== 0);
          t.gzhead.hcrc &&
            t.pending > r &&
            (e.adler = rn(e.adler, t.pending_buf, t.pending - r, r));
        }
        t.status = ba;
      }
      if (t.status === ba) {
        if (t.gzhead.hcrc) {
          if (t.pending + 2 > t.pending_buf_size && (Je(e), t.pending !== 0))
            return ((t.last_flush = -1), Pe);
          (me(t, e.adler & 255), me(t, (e.adler >> 8) & 255), (e.adler = 0));
        }
        if (((t.status = An), Je(e), t.pending !== 0)) return ((t.last_flush = -1), Pe);
      }
      if (e.avail_in !== 0 || t.lookahead !== 0 || (n !== ln && t.status !== Bi)) {
        let r =
          t.level === 0
            ? ec(t, n)
            : t.strategy === Ur
              ? Bp(t, n)
              : t.strategy === _p
                ? Rp(t, n)
                : zi[t.level].func(t, n);
        if (((r === Fn || r === ti) && (t.status = Bi), r === Ge || r === Fn))
          return (e.avail_out === 0 && (t.last_flush = -1), Pe);
        if (
          r === ei &&
          (n === gp
            ? hp(t)
            : n !== Wl &&
              (da(t, 0, 0, !1),
              n === mp &&
                (on(t.head),
                t.lookahead === 0 && ((t.strstart = 0), (t.block_start = 0), (t.insert = 0)))),
          Je(e),
          e.avail_out === 0)
        )
          return ((t.last_flush = -1), Pe);
      }
      return n !== lt
        ? Pe
        : t.wrap <= 0
          ? Yl
          : (t.wrap === 2
              ? (me(t, e.adler & 255),
                me(t, (e.adler >> 8) & 255),
                me(t, (e.adler >> 16) & 255),
                me(t, (e.adler >> 24) & 255),
                me(t, e.total_in & 255),
                me(t, (e.total_in >> 8) & 255),
                me(t, (e.total_in >> 16) & 255),
                me(t, (e.total_in >> 24) & 255))
              : (Ri(t, e.adler >>> 16), Ri(t, e.adler & 65535)),
            Je(e),
            t.wrap > 0 && (t.wrap = -t.wrap),
            t.pending !== 0 ? Pe : Yl);
    },
    $p = e => {
      if (Ni(e)) return Ft;
      let n = e.state.status;
      return ((e.state = null), n === An ? In(e, bp) : Pe);
    },
    Zp = (e, n) => {
      let t = n.length;
      if (Ni(e)) return Ft;
      let i = e.state,
        r = i.wrap;
      if (r === 2 || (r === 1 && i.status !== Jn) || i.lookahead) return Ft;
      if ((r === 1 && (e.adler = Jl(e.adler, n, t, 0)), (i.wrap = 0), t >= i.w_size)) {
        r === 0 && (on(i.head), (i.strstart = 0), (i.block_start = 0), (i.insert = 0));
        let c = new Uint8Array(i.w_size);
        (c.set(n.subarray(t - i.w_size, t), 0), (n = c), (t = i.w_size));
      }
      let o = e.avail_in,
        a = e.next_in,
        s = e.input;
      for (e.avail_in = t, e.next_in = 0, e.input = n, Qn(i); i.lookahead >= fe;) {
        let c = i.strstart,
          l = i.lookahead - (fe - 1);
        do
          ((i.ins_h = cn(i, i.ins_h, i.window[c + fe - 1])),
            (i.prev[c & i.w_mask] = i.head[i.ins_h]),
            (i.head[i.ins_h] = c),
            c++);
        while (--l);
        ((i.strstart = c), (i.lookahead = fe - 1), Qn(i));
      }
      return (
        (i.strstart += i.lookahead),
        (i.block_start = i.strstart),
        (i.insert = i.lookahead),
        (i.lookahead = 0),
        (i.match_length = i.prev_length = fe - 1),
        (i.match_available = 0),
        (e.next_in = a),
        (e.input = s),
        (e.avail_in = o),
        (i.wrap = r),
        Pe
      );
    };
  Dt.exports.deflateInit = Vp;
  Dt.exports.deflateInit2 = ic;
  Dt.exports.deflateReset = nc;
  Dt.exports.deflateResetKeep = tc;
  Dt.exports.deflateSetHeader = jp;
  Dt.exports.deflate = Gp;
  Dt.exports.deflateEnd = $p;
  Dt.exports.deflateSetDictionary = Zp;
  Dt.exports.deflateInfo = 'pako deflate (from Nodeca project)';
});
var va = he((v2, _a) => {
  'use strict';
  var Hp = (e, n) => Object.prototype.hasOwnProperty.call(e, n);
  _a.exports.assign = function (e) {
    let n = Array.prototype.slice.call(arguments, 1);
    for (; n.length;) {
      let t = n.shift();
      if (t) {
        if (typeof t != 'object') throw new TypeError(t + 'must be non-object');
        for (let i in t) Hp(t, i) && (e[i] = t[i]);
      }
    }
    return e;
  };
  _a.exports.flattenChunks = e => {
    let n = 0;
    for (let i = 0, r = e.length; i < r; i++) n += e[i].length;
    let t = new Uint8Array(n);
    for (let i = 0, r = 0, o = e.length; i < o; i++) {
      let a = e[i];
      (t.set(a, r), (r += a.length));
    }
    return t;
  };
});
var xa = he((x2, Tr) => {
  'use strict';
  var oc = !0;
  try {
    String.fromCharCode.apply(null, new Uint8Array(1));
  } catch {
    oc = !1;
  }
  var ji = new Uint8Array(256);
  for (let e = 0; e < 256; e++)
    ji[e] = e >= 252 ? 6 : e >= 248 ? 5 : e >= 240 ? 4 : e >= 224 ? 3 : e >= 192 ? 2 : 1;
  ji[254] = ji[254] = 1;
  Tr.exports.string2buf = e => {
    if (typeof TextEncoder == 'function' && TextEncoder.prototype.encode)
      return new TextEncoder().encode(e);
    let n,
      t,
      i,
      r,
      o,
      a = e.length,
      s = 0;
    for (r = 0; r < a; r++)
      ((t = e.charCodeAt(r)),
        (t & 64512) === 55296 &&
          r + 1 < a &&
          ((i = e.charCodeAt(r + 1)),
          (i & 64512) === 56320 && ((t = 65536 + ((t - 55296) << 10) + (i - 56320)), r++)),
        (s += t < 128 ? 1 : t < 2048 ? 2 : t < 65536 ? 3 : 4));
    for (n = new Uint8Array(s), o = 0, r = 0; o < s; r++)
      ((t = e.charCodeAt(r)),
        (t & 64512) === 55296 &&
          r + 1 < a &&
          ((i = e.charCodeAt(r + 1)),
          (i & 64512) === 56320 && ((t = 65536 + ((t - 55296) << 10) + (i - 56320)), r++)),
        t < 128
          ? (n[o++] = t)
          : t < 2048
            ? ((n[o++] = 192 | (t >>> 6)), (n[o++] = 128 | (t & 63)))
            : t < 65536
              ? ((n[o++] = 224 | (t >>> 12)),
                (n[o++] = 128 | ((t >>> 6) & 63)),
                (n[o++] = 128 | (t & 63)))
              : ((n[o++] = 240 | (t >>> 18)),
                (n[o++] = 128 | ((t >>> 12) & 63)),
                (n[o++] = 128 | ((t >>> 6) & 63)),
                (n[o++] = 128 | (t & 63))));
    return n;
  };
  var Xp = (e, n) => {
    if (n < 65534 && e.subarray && oc)
      return String.fromCharCode.apply(null, e.length === n ? e : e.subarray(0, n));
    let t = '';
    for (let i = 0; i < n; i++) t += String.fromCharCode(e[i]);
    return t;
  };
  Tr.exports.buf2string = (e, n) => {
    let t = n || e.length;
    if (typeof TextDecoder == 'function' && TextDecoder.prototype.decode)
      return new TextDecoder().decode(e.subarray(0, n));
    let i,
      r,
      o = new Array(t * 2);
    for (r = 0, i = 0; i < t;) {
      let a = e[i++];
      if (a < 128) {
        o[r++] = a;
        continue;
      }
      let s = ji[a];
      if (s > 4) {
        ((o[r++] = 65533), (i += s - 1));
        continue;
      }
      for (a &= s === 2 ? 31 : s === 3 ? 15 : 7; s > 1 && i < t;)
        ((a = (a << 6) | (e[i++] & 63)), s--);
      if (s > 1) {
        o[r++] = 65533;
        continue;
      }
      a < 65536
        ? (o[r++] = a)
        : ((a -= 65536), (o[r++] = 55296 | ((a >> 10) & 1023)), (o[r++] = 56320 | (a & 1023)));
    }
    return Xp(o, r);
  };
  Tr.exports.utf8border = (e, n) => {
    ((n = n || e.length), n > e.length && (n = e.length));
    let t = n - 1;
    for (; t >= 0 && (e[t] & 192) === 128;) t--;
    return t < 0 || t === 0 ? n : t + ji[e[t]] > n ? t : n;
  };
});
var Sa = he((S2, ac) => {
  'use strict';
  function Kp() {
    ((this.input = null),
      (this.next_in = 0),
      (this.avail_in = 0),
      (this.total_in = 0),
      (this.output = null),
      (this.next_out = 0),
      (this.avail_out = 0),
      (this.total_out = 0),
      (this.msg = ''),
      (this.state = null),
      (this.data_type = 2),
      (this.adler = 0));
  }
  ac.exports = Kp;
});
var fc = he((k2, ni) => {
  'use strict';
  var Vi = rc(),
    sc = va(),
    lc = xa(),
    ka = Lr(),
    Wp = Sa(),
    cc = Object.prototype.toString,
    {
      Z_NO_FLUSH: Yp,
      Z_SYNC_FLUSH: qp,
      Z_FULL_FLUSH: Jp,
      Z_FINISH: Qp,
      Z_OK: Rr,
      Z_STREAM_END: eg,
      Z_DEFAULT_COMPRESSION: tg,
      Z_DEFAULT_STRATEGY: ng,
      Z_DEFLATED: ig,
    } = nn();
  function Gi(e) {
    this.options = sc.assign(
      { level: tg, method: ig, chunkSize: 16384, windowBits: 15, memLevel: 8, strategy: ng },
      e || {}
    );
    let n = this.options;
    (n.raw && n.windowBits > 0
      ? (n.windowBits = -n.windowBits)
      : n.gzip && n.windowBits > 0 && n.windowBits < 16 && (n.windowBits += 16),
      (this.err = 0),
      (this.msg = ''),
      (this.ended = !1),
      (this.chunks = []),
      (this.strm = new Wp()),
      (this.strm.avail_out = 0));
    let t = Vi.deflateInit2(this.strm, n.level, n.method, n.windowBits, n.memLevel, n.strategy);
    if (t !== Rr) throw new Error(ka[t]);
    if ((n.header && Vi.deflateSetHeader(this.strm, n.header), n.dictionary)) {
      let i;
      if (
        (typeof n.dictionary == 'string'
          ? (i = lc.string2buf(n.dictionary))
          : cc.call(n.dictionary) === '[object ArrayBuffer]'
            ? (i = new Uint8Array(n.dictionary))
            : (i = n.dictionary),
        (t = Vi.deflateSetDictionary(this.strm, i)),
        t !== Rr)
      )
        throw new Error(ka[t]);
      this._dict_set = !0;
    }
  }
  Gi.prototype.push = function (e, n) {
    let t = this.strm,
      i = this.options.chunkSize,
      r,
      o;
    if (this.ended) return !1;
    for (
      n === ~~n ? (o = n) : (o = n === !0 ? Qp : Yp),
        typeof e == 'string'
          ? (t.input = lc.string2buf(e))
          : cc.call(e) === '[object ArrayBuffer]'
            ? (t.input = new Uint8Array(e))
            : (t.input = e),
        t.next_in = 0,
        t.avail_in = t.input.length;
      ;
    ) {
      if (
        (t.avail_out === 0 && ((t.output = new Uint8Array(i)), (t.next_out = 0), (t.avail_out = i)),
        (o === qp || o === Jp) && t.avail_out <= 6)
      ) {
        (this.onData(t.output.subarray(0, t.next_out)), (t.avail_out = 0));
        continue;
      }
      if (((r = Vi.deflate(t, o)), r === eg))
        return (
          t.next_out > 0 && this.onData(t.output.subarray(0, t.next_out)),
          (r = Vi.deflateEnd(this.strm)),
          this.onEnd(r),
          (this.ended = !0),
          r === Rr
        );
      if (t.avail_out === 0) {
        this.onData(t.output);
        continue;
      }
      if (o > 0 && t.next_out > 0) {
        (this.onData(t.output.subarray(0, t.next_out)), (t.avail_out = 0));
        continue;
      }
      if (t.avail_in === 0) break;
    }
    return !0;
  };
  Gi.prototype.onData = function (e) {
    this.chunks.push(e);
  };
  Gi.prototype.onEnd = function (e) {
    (e === Rr && (this.result = sc.flattenChunks(this.chunks)),
      (this.chunks = []),
      (this.err = e),
      (this.msg = this.strm.msg));
  };
  function Aa(e, n) {
    let t = new Gi(n);
    if ((t.push(e, !0), t.err)) throw t.msg || ka[t.err];
    return t.result;
  }
  function rg(e, n) {
    return ((n = n || {}), (n.raw = !0), Aa(e, n));
  }
  function og(e, n) {
    return ((n = n || {}), (n.gzip = !0), Aa(e, n));
  }
  ni.exports.Deflate = Gi;
  ni.exports.deflate = Aa;
  ni.exports.deflateRaw = rg;
  ni.exports.gzip = og;
  ni.exports.constants = nn();
});
var dc = he((A2, uc) => {
  'use strict';
  uc.exports = function (n, t) {
    let i,
      r,
      o,
      a,
      s,
      c,
      l,
      f,
      d,
      u,
      h,
      p,
      _,
      b,
      g,
      y,
      w,
      m,
      A,
      M,
      k,
      E,
      F,
      I,
      C = n.state;
    ((i = n.next_in),
      (F = n.input),
      (r = i + (n.avail_in - 5)),
      (o = n.next_out),
      (I = n.output),
      (a = o - (t - n.avail_out)),
      (s = o + (n.avail_out - 257)),
      (c = C.dmax),
      (l = C.wsize),
      (f = C.whave),
      (d = C.wnext),
      (u = C.window),
      (h = C.hold),
      (p = C.bits),
      (_ = C.lencode),
      (b = C.distcode),
      (g = (1 << C.lenbits) - 1),
      (y = (1 << C.distbits) - 1));
    e: do {
      (p < 15 && ((h += F[i++] << p), (p += 8), (h += F[i++] << p), (p += 8)), (w = _[h & g]));
      t: for (;;) {
        if (((m = w >>> 24), (h >>>= m), (p -= m), (m = (w >>> 16) & 255), m === 0))
          I[o++] = w & 65535;
        else if (m & 16) {
          ((A = w & 65535),
            (m &= 15),
            m &&
              (p < m && ((h += F[i++] << p), (p += 8)),
              (A += h & ((1 << m) - 1)),
              (h >>>= m),
              (p -= m)),
            p < 15 && ((h += F[i++] << p), (p += 8), (h += F[i++] << p), (p += 8)),
            (w = b[h & y]));
          n: for (;;) {
            if (((m = w >>> 24), (h >>>= m), (p -= m), (m = (w >>> 16) & 255), m & 16)) {
              if (
                ((M = w & 65535),
                (m &= 15),
                p < m && ((h += F[i++] << p), (p += 8), p < m && ((h += F[i++] << p), (p += 8))),
                (M += h & ((1 << m) - 1)),
                M > c)
              ) {
                ((n.msg = 'invalid distance too far back'), (C.mode = 16209));
                break e;
              }
              if (((h >>>= m), (p -= m), (m = o - a), M > m)) {
                if (((m = M - m), m > f && C.sane)) {
                  ((n.msg = 'invalid distance too far back'), (C.mode = 16209));
                  break e;
                }
                if (((k = 0), (E = u), d === 0)) {
                  if (((k += l - m), m < A)) {
                    A -= m;
                    do I[o++] = u[k++];
                    while (--m);
                    ((k = o - M), (E = I));
                  }
                } else if (d < m) {
                  if (((k += l + d - m), (m -= d), m < A)) {
                    A -= m;
                    do I[o++] = u[k++];
                    while (--m);
                    if (((k = 0), d < A)) {
                      ((m = d), (A -= m));
                      do I[o++] = u[k++];
                      while (--m);
                      ((k = o - M), (E = I));
                    }
                  }
                } else if (((k += d - m), m < A)) {
                  A -= m;
                  do I[o++] = u[k++];
                  while (--m);
                  ((k = o - M), (E = I));
                }
                for (; A > 2;) ((I[o++] = E[k++]), (I[o++] = E[k++]), (I[o++] = E[k++]), (A -= 3));
                A && ((I[o++] = E[k++]), A > 1 && (I[o++] = E[k++]));
              } else {
                k = o - M;
                do ((I[o++] = I[k++]), (I[o++] = I[k++]), (I[o++] = I[k++]), (A -= 3));
                while (A > 2);
                A && ((I[o++] = I[k++]), A > 1 && (I[o++] = I[k++]));
              }
            } else if ((m & 64) === 0) {
              w = b[(w & 65535) + (h & ((1 << m) - 1))];
              continue n;
            } else {
              ((n.msg = 'invalid distance code'), (C.mode = 16209));
              break e;
            }
            break;
          }
        } else if ((m & 64) === 0) {
          w = _[(w & 65535) + (h & ((1 << m) - 1))];
          continue t;
        } else if (m & 32) {
          C.mode = 16191;
          break e;
        } else {
          ((n.msg = 'invalid literal/length code'), (C.mode = 16209));
          break e;
        }
        break;
      }
    } while (i < r && o < s);
    ((A = p >> 3),
      (i -= A),
      (p -= A << 3),
      (h &= (1 << p) - 1),
      (n.next_in = i),
      (n.next_out = o),
      (n.avail_in = i < r ? 5 + (r - i) : 5 - (i - r)),
      (n.avail_out = o < s ? 257 + (s - o) : 257 - (o - s)),
      (C.hold = h),
      (C.bits = p));
  };
});
var pc = he((I2, hc) => {
  'use strict';
  var ag = new Uint16Array([
      3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
      163, 195, 227, 258, 0, 0,
    ]),
    sg = new Uint8Array([
      16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19, 19, 20, 20, 20,
      20, 21, 21, 21, 21, 16, 72, 78,
    ]),
    lg = new Uint16Array([
      1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537,
      2049, 3073, 4097, 6145, 8193, 12289, 16385, 24577, 0, 0,
    ]),
    cg = new Uint8Array([
      16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25, 25, 26,
      26, 27, 27, 28, 28, 29, 29, 64, 64,
    ]),
    fg = (e, n, t, i, r, o, a, s) => {
      let c = s.bits,
        l = 0,
        f = 0,
        d = 0,
        u = 0,
        h = 0,
        p = 0,
        _ = 0,
        b = 0,
        g = 0,
        y = 0,
        w,
        m,
        A,
        M,
        k,
        E = null,
        F,
        I = new Uint16Array(16),
        C = new Uint16Array(16),
        B = null,
        ee,
        $,
        U;
      for (l = 0; l <= 15; l++) I[l] = 0;
      for (f = 0; f < i; f++) I[n[t + f]]++;
      for (h = c, u = 15; u >= 1 && I[u] === 0; u--);
      if ((h > u && (h = u), u === 0))
        return (
          (r[o++] = (1 << 24) | (64 << 16) | 0),
          (r[o++] = (1 << 24) | (64 << 16) | 0),
          (s.bits = 1),
          0
        );
      for (d = 1; d < u && I[d] === 0; d++);
      for (h < d && (h = d), b = 1, l = 1; l <= 15; l++)
        if (((b <<= 1), (b -= I[l]), b < 0)) return -1;
      if (b > 0 && (e === 0 || u !== 1)) return -1;
      for (C[1] = 0, l = 1; l < 15; l++) C[l + 1] = C[l] + I[l];
      for (f = 0; f < i; f++) n[t + f] !== 0 && (a[C[n[t + f]]++] = f);
      if (
        (e === 0
          ? ((E = B = a), (F = 20))
          : e === 1
            ? ((E = ag), (B = sg), (F = 257))
            : ((E = lg), (B = cg), (F = 0)),
        (y = 0),
        (f = 0),
        (l = d),
        (k = o),
        (p = h),
        (_ = 0),
        (A = -1),
        (g = 1 << h),
        (M = g - 1),
        (e === 1 && g > 852) || (e === 2 && g > 592))
      )
        return 1;
      for (;;) {
        ((ee = l - _),
          a[f] + 1 < F
            ? (($ = 0), (U = a[f]))
            : a[f] >= F
              ? (($ = B[a[f] - F]), (U = E[a[f] - F]))
              : (($ = 96), (U = 0)),
          (w = 1 << (l - _)),
          (m = 1 << p),
          (d = m));
        do ((m -= w), (r[k + (y >> _) + m] = (ee << 24) | ($ << 16) | U | 0));
        while (m !== 0);
        for (w = 1 << (l - 1); y & w;) w >>= 1;
        if ((w !== 0 ? ((y &= w - 1), (y += w)) : (y = 0), f++, --I[l] === 0)) {
          if (l === u) break;
          l = n[t + a[f]];
        }
        if (l > h && (y & M) !== A) {
          for (
            _ === 0 && (_ = h), k += d, p = l - _, b = 1 << p;
            p + _ < u && ((b -= I[p + _]), !(b <= 0));
          )
            (p++, (b <<= 1));
          if (((g += 1 << p), (e === 1 && g > 852) || (e === 2 && g > 592))) return 1;
          ((A = y & M), (r[A] = (h << 24) | (p << 16) | (k - o) | 0));
        }
      }
      return (y !== 0 && (r[k + y] = ((l - _) << 24) | (64 << 16) | 0), (s.bits = h), 0);
    };
  hc.exports = fg;
});
var Wc = he((F2, _t) => {
  'use strict';
  var Ca = la(),
    Mt = ca(),
    ug = dc(),
    $i = pc(),
    dg = 0,
    Nc = 1,
    jc = 2,
    {
      Z_FINISH: gc,
      Z_BLOCK: hg,
      Z_TREES: Br,
      Z_OK: En,
      Z_STREAM_END: pg,
      Z_NEED_DICT: gg,
      Z_STREAM_ERROR: ct,
      Z_DATA_ERROR: Vc,
      Z_MEM_ERROR: Oa,
      Z_BUF_ERROR: mg,
      Z_DEFLATED: mc,
    } = nn(),
    Vr = 16180,
    bc = 16181,
    yc = 16182,
    wc = 16183,
    _c = 16184,
    vc = 16185,
    xc = 16186,
    Sc = 16187,
    kc = 16188,
    Ac = 16189,
    jr = 16190,
    Ht = 16191,
    Ia = 16192,
    Ic = 16193,
    Fa = 16194,
    Fc = 16195,
    Ec = 16196,
    Dc = 16197,
    Mc = 16198,
    zr = 16199,
    Nr = 16200,
    Cc = 16201,
    Oc = 16202,
    Lc = 16203,
    Uc = 16204,
    Pc = 16205,
    Ea = 16206,
    Tc = 16207,
    Rc = 16208,
    Ie = 16209,
    La = 16210,
    Gc = 16211,
    bg = 852,
    yg = 592,
    wg = 15,
    _g = wg,
    Bc = e => ((e >>> 24) & 255) + ((e >>> 8) & 65280) + ((e & 65280) << 8) + ((e & 255) << 24);
  function vg() {
    ((this.strm = null),
      (this.mode = 0),
      (this.last = !1),
      (this.wrap = 0),
      (this.havedict = !1),
      (this.flags = 0),
      (this.dmax = 0),
      (this.check = 0),
      (this.total = 0),
      (this.head = null),
      (this.wbits = 0),
      (this.wsize = 0),
      (this.whave = 0),
      (this.wnext = 0),
      (this.window = null),
      (this.hold = 0),
      (this.bits = 0),
      (this.length = 0),
      (this.offset = 0),
      (this.extra = 0),
      (this.lencode = null),
      (this.distcode = null),
      (this.lenbits = 0),
      (this.distbits = 0),
      (this.ncode = 0),
      (this.nlen = 0),
      (this.ndist = 0),
      (this.have = 0),
      (this.next = null),
      (this.lens = new Uint16Array(320)),
      (this.work = new Uint16Array(288)),
      (this.lendyn = null),
      (this.distdyn = null),
      (this.sane = 0),
      (this.back = 0),
      (this.was = 0));
  }
  var Dn = e => {
      if (!e) return 1;
      let n = e.state;
      return !n || n.strm !== e || n.mode < Vr || n.mode > Gc ? 1 : 0;
    },
    $c = e => {
      if (Dn(e)) return ct;
      let n = e.state;
      return (
        (e.total_in = e.total_out = n.total = 0),
        (e.msg = ''),
        n.wrap && (e.adler = n.wrap & 1),
        (n.mode = Vr),
        (n.last = 0),
        (n.havedict = 0),
        (n.flags = -1),
        (n.dmax = 32768),
        (n.head = null),
        (n.hold = 0),
        (n.bits = 0),
        (n.lencode = n.lendyn = new Int32Array(bg)),
        (n.distcode = n.distdyn = new Int32Array(yg)),
        (n.sane = 1),
        (n.back = -1),
        En
      );
    },
    Zc = e => {
      if (Dn(e)) return ct;
      let n = e.state;
      return ((n.wsize = 0), (n.whave = 0), (n.wnext = 0), $c(e));
    },
    Hc = (e, n) => {
      let t;
      if (Dn(e)) return ct;
      let i = e.state;
      return (
        n < 0 ? ((t = 0), (n = -n)) : ((t = (n >> 4) + 5), n < 48 && (n &= 15)),
        n && (n < 8 || n > 15)
          ? ct
          : (i.window !== null && i.wbits !== n && (i.window = null),
            (i.wrap = t),
            (i.wbits = n),
            Zc(e))
      );
    },
    Xc = (e, n) => {
      if (!e) return ct;
      let t = new vg();
      ((e.state = t), (t.strm = e), (t.window = null), (t.mode = Vr));
      let i = Hc(e, n);
      return (i !== En && (e.state = null), i);
    },
    xg = e => Xc(e, _g),
    zc = !0,
    Da,
    Ma,
    Sg = e => {
      if (zc) {
        ((Da = new Int32Array(512)), (Ma = new Int32Array(32)));
        let n = 0;
        for (; n < 144;) e.lens[n++] = 8;
        for (; n < 256;) e.lens[n++] = 9;
        for (; n < 280;) e.lens[n++] = 7;
        for (; n < 288;) e.lens[n++] = 8;
        for ($i(Nc, e.lens, 0, 288, Da, 0, e.work, { bits: 9 }), n = 0; n < 32;) e.lens[n++] = 5;
        ($i(jc, e.lens, 0, 32, Ma, 0, e.work, { bits: 5 }), (zc = !1));
      }
      ((e.lencode = Da), (e.lenbits = 9), (e.distcode = Ma), (e.distbits = 5));
    },
    Kc = (e, n, t, i) => {
      let r,
        o = e.state;
      return (
        o.window === null &&
          ((o.wsize = 1 << o.wbits),
          (o.wnext = 0),
          (o.whave = 0),
          (o.window = new Uint8Array(o.wsize))),
        i >= o.wsize
          ? (o.window.set(n.subarray(t - o.wsize, t), 0), (o.wnext = 0), (o.whave = o.wsize))
          : ((r = o.wsize - o.wnext),
            r > i && (r = i),
            o.window.set(n.subarray(t - i, t - i + r), o.wnext),
            (i -= r),
            i
              ? (o.window.set(n.subarray(t - i, t), 0), (o.wnext = i), (o.whave = o.wsize))
              : ((o.wnext += r),
                o.wnext === o.wsize && (o.wnext = 0),
                o.whave < o.wsize && (o.whave += r))),
        0
      );
    },
    kg = (e, n) => {
      let t,
        i,
        r,
        o,
        a,
        s,
        c,
        l,
        f,
        d,
        u,
        h,
        p,
        _,
        b = 0,
        g,
        y,
        w,
        m,
        A,
        M,
        k,
        E,
        F = new Uint8Array(4),
        I,
        C,
        B = new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
      if (Dn(e) || !e.output || (!e.input && e.avail_in !== 0)) return ct;
      ((t = e.state),
        t.mode === Ht && (t.mode = Ia),
        (a = e.next_out),
        (r = e.output),
        (c = e.avail_out),
        (o = e.next_in),
        (i = e.input),
        (s = e.avail_in),
        (l = t.hold),
        (f = t.bits),
        (d = s),
        (u = c),
        (E = En));
      e: for (;;)
        switch (t.mode) {
          case Vr:
            if (t.wrap === 0) {
              t.mode = Ia;
              break;
            }
            for (; f < 16;) {
              if (s === 0) break e;
              (s--, (l += i[o++] << f), (f += 8));
            }
            if (t.wrap & 2 && l === 35615) {
              (t.wbits === 0 && (t.wbits = 15),
                (t.check = 0),
                (F[0] = l & 255),
                (F[1] = (l >>> 8) & 255),
                (t.check = Mt(t.check, F, 2, 0)),
                (l = 0),
                (f = 0),
                (t.mode = bc));
              break;
            }
            if (
              (t.head && (t.head.done = !1), !(t.wrap & 1) || (((l & 255) << 8) + (l >> 8)) % 31)
            ) {
              ((e.msg = 'incorrect header check'), (t.mode = Ie));
              break;
            }
            if ((l & 15) !== mc) {
              ((e.msg = 'unknown compression method'), (t.mode = Ie));
              break;
            }
            if (
              ((l >>>= 4),
              (f -= 4),
              (k = (l & 15) + 8),
              t.wbits === 0 && (t.wbits = k),
              k > 15 || k > t.wbits)
            ) {
              ((e.msg = 'invalid window size'), (t.mode = Ie));
              break;
            }
            ((t.dmax = 1 << t.wbits),
              (t.flags = 0),
              (e.adler = t.check = 1),
              (t.mode = l & 512 ? Ac : Ht),
              (l = 0),
              (f = 0));
            break;
          case bc:
            for (; f < 16;) {
              if (s === 0) break e;
              (s--, (l += i[o++] << f), (f += 8));
            }
            if (((t.flags = l), (t.flags & 255) !== mc)) {
              ((e.msg = 'unknown compression method'), (t.mode = Ie));
              break;
            }
            if (t.flags & 57344) {
              ((e.msg = 'unknown header flags set'), (t.mode = Ie));
              break;
            }
            (t.head && (t.head.text = (l >> 8) & 1),
              t.flags & 512 &&
                t.wrap & 4 &&
                ((F[0] = l & 255), (F[1] = (l >>> 8) & 255), (t.check = Mt(t.check, F, 2, 0))),
              (l = 0),
              (f = 0),
              (t.mode = yc));
          case yc:
            for (; f < 32;) {
              if (s === 0) break e;
              (s--, (l += i[o++] << f), (f += 8));
            }
            (t.head && (t.head.time = l),
              t.flags & 512 &&
                t.wrap & 4 &&
                ((F[0] = l & 255),
                (F[1] = (l >>> 8) & 255),
                (F[2] = (l >>> 16) & 255),
                (F[3] = (l >>> 24) & 255),
                (t.check = Mt(t.check, F, 4, 0))),
              (l = 0),
              (f = 0),
              (t.mode = wc));
          case wc:
            for (; f < 16;) {
              if (s === 0) break e;
              (s--, (l += i[o++] << f), (f += 8));
            }
            (t.head && ((t.head.xflags = l & 255), (t.head.os = l >> 8)),
              t.flags & 512 &&
                t.wrap & 4 &&
                ((F[0] = l & 255), (F[1] = (l >>> 8) & 255), (t.check = Mt(t.check, F, 2, 0))),
              (l = 0),
              (f = 0),
              (t.mode = _c));
          case _c:
            if (t.flags & 1024) {
              for (; f < 16;) {
                if (s === 0) break e;
                (s--, (l += i[o++] << f), (f += 8));
              }
              ((t.length = l),
                t.head && (t.head.extra_len = l),
                t.flags & 512 &&
                  t.wrap & 4 &&
                  ((F[0] = l & 255), (F[1] = (l >>> 8) & 255), (t.check = Mt(t.check, F, 2, 0))),
                (l = 0),
                (f = 0));
            } else t.head && (t.head.extra = null);
            t.mode = vc;
          case vc:
            if (
              t.flags & 1024 &&
              ((h = t.length),
              h > s && (h = s),
              h &&
                (t.head &&
                  ((k = t.head.extra_len - t.length),
                  t.head.extra || (t.head.extra = new Uint8Array(t.head.extra_len)),
                  t.head.extra.set(i.subarray(o, o + h), k)),
                t.flags & 512 && t.wrap & 4 && (t.check = Mt(t.check, i, h, o)),
                (s -= h),
                (o += h),
                (t.length -= h)),
              t.length)
            )
              break e;
            ((t.length = 0), (t.mode = xc));
          case xc:
            if (t.flags & 2048) {
              if (s === 0) break e;
              h = 0;
              do
                ((k = i[o + h++]),
                  t.head && k && t.length < 65536 && (t.head.name += String.fromCharCode(k)));
              while (k && h < s);
              if (
                (t.flags & 512 && t.wrap & 4 && (t.check = Mt(t.check, i, h, o)),
                (s -= h),
                (o += h),
                k)
              )
                break e;
            } else t.head && (t.head.name = null);
            ((t.length = 0), (t.mode = Sc));
          case Sc:
            if (t.flags & 4096) {
              if (s === 0) break e;
              h = 0;
              do
                ((k = i[o + h++]),
                  t.head && k && t.length < 65536 && (t.head.comment += String.fromCharCode(k)));
              while (k && h < s);
              if (
                (t.flags & 512 && t.wrap & 4 && (t.check = Mt(t.check, i, h, o)),
                (s -= h),
                (o += h),
                k)
              )
                break e;
            } else t.head && (t.head.comment = null);
            t.mode = kc;
          case kc:
            if (t.flags & 512) {
              for (; f < 16;) {
                if (s === 0) break e;
                (s--, (l += i[o++] << f), (f += 8));
              }
              if (t.wrap & 4 && l !== (t.check & 65535)) {
                ((e.msg = 'header crc mismatch'), (t.mode = Ie));
                break;
              }
              ((l = 0), (f = 0));
            }
            (t.head && ((t.head.hcrc = (t.flags >> 9) & 1), (t.head.done = !0)),
              (e.adler = t.check = 0),
              (t.mode = Ht));
            break;
          case Ac:
            for (; f < 32;) {
              if (s === 0) break e;
              (s--, (l += i[o++] << f), (f += 8));
            }
            ((e.adler = t.check = Bc(l)), (l = 0), (f = 0), (t.mode = jr));
          case jr:
            if (t.havedict === 0)
              return (
                (e.next_out = a),
                (e.avail_out = c),
                (e.next_in = o),
                (e.avail_in = s),
                (t.hold = l),
                (t.bits = f),
                gg
              );
            ((e.adler = t.check = 1), (t.mode = Ht));
          case Ht:
            if (n === hg || n === Br) break e;
          case Ia:
            if (t.last) {
              ((l >>>= f & 7), (f -= f & 7), (t.mode = Ea));
              break;
            }
            for (; f < 3;) {
              if (s === 0) break e;
              (s--, (l += i[o++] << f), (f += 8));
            }
            switch (((t.last = l & 1), (l >>>= 1), (f -= 1), l & 3)) {
              case 0:
                t.mode = Ic;
                break;
              case 1:
                if ((Sg(t), (t.mode = zr), n === Br)) {
                  ((l >>>= 2), (f -= 2));
                  break e;
                }
                break;
              case 2:
                t.mode = Ec;
                break;
              case 3:
                ((e.msg = 'invalid block type'), (t.mode = Ie));
            }
            ((l >>>= 2), (f -= 2));
            break;
          case Ic:
            for (l >>>= f & 7, f -= f & 7; f < 32;) {
              if (s === 0) break e;
              (s--, (l += i[o++] << f), (f += 8));
            }
            if ((l & 65535) !== ((l >>> 16) ^ 65535)) {
              ((e.msg = 'invalid stored block lengths'), (t.mode = Ie));
              break;
            }
            if (((t.length = l & 65535), (l = 0), (f = 0), (t.mode = Fa), n === Br)) break e;
          case Fa:
            t.mode = Fc;
          case Fc:
            if (((h = t.length), h)) {
              if ((h > s && (h = s), h > c && (h = c), h === 0)) break e;
              (r.set(i.subarray(o, o + h), a),
                (s -= h),
                (o += h),
                (c -= h),
                (a += h),
                (t.length -= h));
              break;
            }
            t.mode = Ht;
            break;
          case Ec:
            for (; f < 14;) {
              if (s === 0) break e;
              (s--, (l += i[o++] << f), (f += 8));
            }
            if (
              ((t.nlen = (l & 31) + 257),
              (l >>>= 5),
              (f -= 5),
              (t.ndist = (l & 31) + 1),
              (l >>>= 5),
              (f -= 5),
              (t.ncode = (l & 15) + 4),
              (l >>>= 4),
              (f -= 4),
              t.nlen > 286 || t.ndist > 30)
            ) {
              ((e.msg = 'too many length or distance symbols'), (t.mode = Ie));
              break;
            }
            ((t.have = 0), (t.mode = Dc));
          case Dc:
            for (; t.have < t.ncode;) {
              for (; f < 3;) {
                if (s === 0) break e;
                (s--, (l += i[o++] << f), (f += 8));
              }
              ((t.lens[B[t.have++]] = l & 7), (l >>>= 3), (f -= 3));
            }
            for (; t.have < 19;) t.lens[B[t.have++]] = 0;
            if (
              ((t.lencode = t.lendyn),
              (t.lenbits = 7),
              (I = { bits: t.lenbits }),
              (E = $i(dg, t.lens, 0, 19, t.lencode, 0, t.work, I)),
              (t.lenbits = I.bits),
              E)
            ) {
              ((e.msg = 'invalid code lengths set'), (t.mode = Ie));
              break;
            }
            ((t.have = 0), (t.mode = Mc));
          case Mc:
            for (; t.have < t.nlen + t.ndist;) {
              for (
                ;
                (b = t.lencode[l & ((1 << t.lenbits) - 1)]),
                  (g = b >>> 24),
                  (y = (b >>> 16) & 255),
                  (w = b & 65535),
                  !(g <= f);
              ) {
                if (s === 0) break e;
                (s--, (l += i[o++] << f), (f += 8));
              }
              if (w < 16) ((l >>>= g), (f -= g), (t.lens[t.have++] = w));
              else {
                if (w === 16) {
                  for (C = g + 2; f < C;) {
                    if (s === 0) break e;
                    (s--, (l += i[o++] << f), (f += 8));
                  }
                  if (((l >>>= g), (f -= g), t.have === 0)) {
                    ((e.msg = 'invalid bit length repeat'), (t.mode = Ie));
                    break;
                  }
                  ((k = t.lens[t.have - 1]), (h = 3 + (l & 3)), (l >>>= 2), (f -= 2));
                } else if (w === 17) {
                  for (C = g + 3; f < C;) {
                    if (s === 0) break e;
                    (s--, (l += i[o++] << f), (f += 8));
                  }
                  ((l >>>= g), (f -= g), (k = 0), (h = 3 + (l & 7)), (l >>>= 3), (f -= 3));
                } else {
                  for (C = g + 7; f < C;) {
                    if (s === 0) break e;
                    (s--, (l += i[o++] << f), (f += 8));
                  }
                  ((l >>>= g), (f -= g), (k = 0), (h = 11 + (l & 127)), (l >>>= 7), (f -= 7));
                }
                if (t.have + h > t.nlen + t.ndist) {
                  ((e.msg = 'invalid bit length repeat'), (t.mode = Ie));
                  break;
                }
                for (; h--;) t.lens[t.have++] = k;
              }
            }
            if (t.mode === Ie) break;
            if (t.lens[256] === 0) {
              ((e.msg = 'invalid code -- missing end-of-block'), (t.mode = Ie));
              break;
            }
            if (
              ((t.lenbits = 9),
              (I = { bits: t.lenbits }),
              (E = $i(Nc, t.lens, 0, t.nlen, t.lencode, 0, t.work, I)),
              (t.lenbits = I.bits),
              E)
            ) {
              ((e.msg = 'invalid literal/lengths set'), (t.mode = Ie));
              break;
            }
            if (
              ((t.distbits = 6),
              (t.distcode = t.distdyn),
              (I = { bits: t.distbits }),
              (E = $i(jc, t.lens, t.nlen, t.ndist, t.distcode, 0, t.work, I)),
              (t.distbits = I.bits),
              E)
            ) {
              ((e.msg = 'invalid distances set'), (t.mode = Ie));
              break;
            }
            if (((t.mode = zr), n === Br)) break e;
          case zr:
            t.mode = Nr;
          case Nr:
            if (s >= 6 && c >= 258) {
              ((e.next_out = a),
                (e.avail_out = c),
                (e.next_in = o),
                (e.avail_in = s),
                (t.hold = l),
                (t.bits = f),
                ug(e, u),
                (a = e.next_out),
                (r = e.output),
                (c = e.avail_out),
                (o = e.next_in),
                (i = e.input),
                (s = e.avail_in),
                (l = t.hold),
                (f = t.bits),
                t.mode === Ht && (t.back = -1));
              break;
            }
            for (
              t.back = 0;
              (b = t.lencode[l & ((1 << t.lenbits) - 1)]),
                (g = b >>> 24),
                (y = (b >>> 16) & 255),
                (w = b & 65535),
                !(g <= f);
            ) {
              if (s === 0) break e;
              (s--, (l += i[o++] << f), (f += 8));
            }
            if (y && (y & 240) === 0) {
              for (
                m = g, A = y, M = w;
                (b = t.lencode[M + ((l & ((1 << (m + A)) - 1)) >> m)]),
                  (g = b >>> 24),
                  (y = (b >>> 16) & 255),
                  (w = b & 65535),
                  !(m + g <= f);
              ) {
                if (s === 0) break e;
                (s--, (l += i[o++] << f), (f += 8));
              }
              ((l >>>= m), (f -= m), (t.back += m));
            }
            if (((l >>>= g), (f -= g), (t.back += g), (t.length = w), y === 0)) {
              t.mode = Pc;
              break;
            }
            if (y & 32) {
              ((t.back = -1), (t.mode = Ht));
              break;
            }
            if (y & 64) {
              ((e.msg = 'invalid literal/length code'), (t.mode = Ie));
              break;
            }
            ((t.extra = y & 15), (t.mode = Cc));
          case Cc:
            if (t.extra) {
              for (C = t.extra; f < C;) {
                if (s === 0) break e;
                (s--, (l += i[o++] << f), (f += 8));
              }
              ((t.length += l & ((1 << t.extra) - 1)),
                (l >>>= t.extra),
                (f -= t.extra),
                (t.back += t.extra));
            }
            ((t.was = t.length), (t.mode = Oc));
          case Oc:
            for (
              ;
              (b = t.distcode[l & ((1 << t.distbits) - 1)]),
                (g = b >>> 24),
                (y = (b >>> 16) & 255),
                (w = b & 65535),
                !(g <= f);
            ) {
              if (s === 0) break e;
              (s--, (l += i[o++] << f), (f += 8));
            }
            if ((y & 240) === 0) {
              for (
                m = g, A = y, M = w;
                (b = t.distcode[M + ((l & ((1 << (m + A)) - 1)) >> m)]),
                  (g = b >>> 24),
                  (y = (b >>> 16) & 255),
                  (w = b & 65535),
                  !(m + g <= f);
              ) {
                if (s === 0) break e;
                (s--, (l += i[o++] << f), (f += 8));
              }
              ((l >>>= m), (f -= m), (t.back += m));
            }
            if (((l >>>= g), (f -= g), (t.back += g), y & 64)) {
              ((e.msg = 'invalid distance code'), (t.mode = Ie));
              break;
            }
            ((t.offset = w), (t.extra = y & 15), (t.mode = Lc));
          case Lc:
            if (t.extra) {
              for (C = t.extra; f < C;) {
                if (s === 0) break e;
                (s--, (l += i[o++] << f), (f += 8));
              }
              ((t.offset += l & ((1 << t.extra) - 1)),
                (l >>>= t.extra),
                (f -= t.extra),
                (t.back += t.extra));
            }
            if (t.offset > t.dmax) {
              ((e.msg = 'invalid distance too far back'), (t.mode = Ie));
              break;
            }
            t.mode = Uc;
          case Uc:
            if (c === 0) break e;
            if (((h = u - c), t.offset > h)) {
              if (((h = t.offset - h), h > t.whave && t.sane)) {
                ((e.msg = 'invalid distance too far back'), (t.mode = Ie));
                break;
              }
              (h > t.wnext ? ((h -= t.wnext), (p = t.wsize - h)) : (p = t.wnext - h),
                h > t.length && (h = t.length),
                (_ = t.window));
            } else ((_ = r), (p = a - t.offset), (h = t.length));
            (h > c && (h = c), (c -= h), (t.length -= h));
            do r[a++] = _[p++];
            while (--h);
            t.length === 0 && (t.mode = Nr);
            break;
          case Pc:
            if (c === 0) break e;
            ((r[a++] = t.length), c--, (t.mode = Nr));
            break;
          case Ea:
            if (t.wrap) {
              for (; f < 32;) {
                if (s === 0) break e;
                (s--, (l |= i[o++] << f), (f += 8));
              }
              if (
                ((u -= c),
                (e.total_out += u),
                (t.total += u),
                t.wrap & 4 &&
                  u &&
                  (e.adler = t.check =
                    t.flags ? Mt(t.check, r, u, a - u) : Ca(t.check, r, u, a - u)),
                (u = c),
                t.wrap & 4 && (t.flags ? l : Bc(l)) !== t.check)
              ) {
                ((e.msg = 'incorrect data check'), (t.mode = Ie));
                break;
              }
              ((l = 0), (f = 0));
            }
            t.mode = Tc;
          case Tc:
            if (t.wrap && t.flags) {
              for (; f < 32;) {
                if (s === 0) break e;
                (s--, (l += i[o++] << f), (f += 8));
              }
              if (t.wrap & 4 && l !== (t.total & 4294967295)) {
                ((e.msg = 'incorrect length check'), (t.mode = Ie));
                break;
              }
              ((l = 0), (f = 0));
            }
            t.mode = Rc;
          case Rc:
            E = pg;
            break e;
          case Ie:
            E = Vc;
            break e;
          case La:
            return Oa;
          case Gc:
          default:
            return ct;
        }
      return (
        (e.next_out = a),
        (e.avail_out = c),
        (e.next_in = o),
        (e.avail_in = s),
        (t.hold = l),
        (t.bits = f),
        (t.wsize || (u !== e.avail_out && t.mode < Ie && (t.mode < Ea || n !== gc))) &&
        Kc(e, e.output, e.next_out, u - e.avail_out)
          ? ((t.mode = La), Oa)
          : ((d -= e.avail_in),
            (u -= e.avail_out),
            (e.total_in += d),
            (e.total_out += u),
            (t.total += u),
            t.wrap & 4 &&
              u &&
              (e.adler = t.check =
                t.flags ? Mt(t.check, r, u, e.next_out - u) : Ca(t.check, r, u, e.next_out - u)),
            (e.data_type =
              t.bits +
              (t.last ? 64 : 0) +
              (t.mode === Ht ? 128 : 0) +
              (t.mode === zr || t.mode === Fa ? 256 : 0)),
            ((d === 0 && u === 0) || n === gc) && E === En && (E = mg),
            E)
      );
    },
    Ag = e => {
      if (Dn(e)) return ct;
      let n = e.state;
      return (n.window && (n.window = null), (e.state = null), En);
    },
    Ig = (e, n) => {
      if (Dn(e)) return ct;
      let t = e.state;
      return (t.wrap & 2) === 0 ? ct : ((t.head = n), (n.done = !1), En);
    },
    Fg = (e, n) => {
      let t = n.length,
        i,
        r,
        o;
      return Dn(e) || ((i = e.state), i.wrap !== 0 && i.mode !== jr)
        ? ct
        : i.mode === jr && ((r = 1), (r = Ca(r, n, t, 0)), r !== i.check)
          ? Vc
          : ((o = Kc(e, n, t, t)), o ? ((i.mode = La), Oa) : ((i.havedict = 1), En));
    };
  _t.exports.inflateReset = Zc;
  _t.exports.inflateReset2 = Hc;
  _t.exports.inflateResetKeep = $c;
  _t.exports.inflateInit = xg;
  _t.exports.inflateInit2 = Xc;
  _t.exports.inflate = kg;
  _t.exports.inflateEnd = Ag;
  _t.exports.inflateGetHeader = Ig;
  _t.exports.inflateSetDictionary = Fg;
  _t.exports.inflateInfo = 'pako inflate (from Nodeca project)';
});
var qc = he((E2, Yc) => {
  'use strict';
  function Eg() {
    ((this.text = 0),
      (this.time = 0),
      (this.xflags = 0),
      (this.os = 0),
      (this.extra = null),
      (this.extra_len = 0),
      (this.name = ''),
      (this.comment = ''),
      (this.hcrc = 0),
      (this.done = !1));
  }
  Yc.exports = Eg;
});
var tf = he((D2, ii) => {
  'use strict';
  var Xt = Wc(),
    Qc = va(),
    Ta = xa(),
    Ra = Lr(),
    Dg = Sa(),
    Mg = qc(),
    ef = Object.prototype.toString,
    {
      Z_NO_FLUSH: Cg,
      Z_FINISH: Og,
      Z_OK: Zi,
      Z_STREAM_END: Ua,
      Z_NEED_DICT: Pa,
      Z_STREAM_ERROR: Lg,
      Z_DATA_ERROR: Jc,
      Z_MEM_ERROR: Ug,
    } = nn();
  function Hi(e) {
    this.options = Qc.assign({ chunkSize: 1024 * 64, windowBits: 15, to: '' }, e || {});
    let n = this.options;
    (n.raw &&
      n.windowBits >= 0 &&
      n.windowBits < 16 &&
      ((n.windowBits = -n.windowBits), n.windowBits === 0 && (n.windowBits = -15)),
      n.windowBits >= 0 && n.windowBits < 16 && !(e && e.windowBits) && (n.windowBits += 32),
      n.windowBits > 15 && n.windowBits < 48 && (n.windowBits & 15) === 0 && (n.windowBits |= 15),
      (this.err = 0),
      (this.msg = ''),
      (this.ended = !1),
      (this.chunks = []),
      (this.strm = new Dg()),
      (this.strm.avail_out = 0));
    let t = Xt.inflateInit2(this.strm, n.windowBits);
    if (t !== Zi) throw new Error(Ra[t]);
    if (
      ((this.header = new Mg()),
      Xt.inflateGetHeader(this.strm, this.header),
      n.dictionary &&
        (typeof n.dictionary == 'string'
          ? (n.dictionary = Ta.string2buf(n.dictionary))
          : ef.call(n.dictionary) === '[object ArrayBuffer]' &&
            (n.dictionary = new Uint8Array(n.dictionary)),
        n.raw && ((t = Xt.inflateSetDictionary(this.strm, n.dictionary)), t !== Zi)))
    )
      throw new Error(Ra[t]);
  }
  Hi.prototype.push = function (e, n) {
    let t = this.strm,
      i = this.options.chunkSize,
      r = this.options.dictionary,
      o,
      a,
      s;
    if (this.ended) return !1;
    for (
      n === ~~n ? (a = n) : (a = n === !0 ? Og : Cg),
        ef.call(e) === '[object ArrayBuffer]' ? (t.input = new Uint8Array(e)) : (t.input = e),
        t.next_in = 0,
        t.avail_in = t.input.length;
      ;
    ) {
      for (
        t.avail_out === 0 && ((t.output = new Uint8Array(i)), (t.next_out = 0), (t.avail_out = i)),
          o = Xt.inflate(t, a),
          o === Pa &&
            r &&
            ((o = Xt.inflateSetDictionary(t, r)),
            o === Zi ? (o = Xt.inflate(t, a)) : o === Jc && (o = Pa));
        t.avail_in > 0 && o === Ua && t.state.wrap > 0 && e[t.next_in] !== 0;
      )
        (Xt.inflateReset(t), (o = Xt.inflate(t, a)));
      switch (o) {
        case Lg:
        case Jc:
        case Pa:
        case Ug:
          return (this.onEnd(o), (this.ended = !0), !1);
      }
      if (((s = t.avail_out), t.next_out && (t.avail_out === 0 || o === Ua)))
        if (this.options.to === 'string') {
          let c = Ta.utf8border(t.output, t.next_out),
            l = t.next_out - c,
            f = Ta.buf2string(t.output, c);
          ((t.next_out = l),
            (t.avail_out = i - l),
            l && t.output.set(t.output.subarray(c, c + l), 0),
            this.onData(f));
        } else
          this.onData(t.output.length === t.next_out ? t.output : t.output.subarray(0, t.next_out));
      if (!(o === Zi && s === 0)) {
        if (o === Ua) return ((o = Xt.inflateEnd(this.strm)), this.onEnd(o), (this.ended = !0), !0);
        if (t.avail_in === 0) break;
      }
    }
    return !0;
  };
  Hi.prototype.onData = function (e) {
    this.chunks.push(e);
  };
  Hi.prototype.onEnd = function (e) {
    (e === Zi &&
      (this.options.to === 'string'
        ? (this.result = this.chunks.join(''))
        : (this.result = Qc.flattenChunks(this.chunks))),
      (this.chunks = []),
      (this.err = e),
      (this.msg = this.strm.msg));
  };
  function Ba(e, n) {
    let t = new Hi(n);
    if ((t.push(e), t.err)) throw t.msg || Ra[t.err];
    return t.result;
  }
  function Pg(e, n) {
    return ((n = n || {}), (n.raw = !0), Ba(e, n));
  }
  ii.exports.Inflate = Hi;
  ii.exports.inflate = Ba;
  ii.exports.inflateRaw = Pg;
  ii.exports.ungzip = Ba;
  ii.exports.constants = nn();
});
var za = he((M2, Ct) => {
  'use strict';
  var { Deflate: Tg, deflate: Rg, deflateRaw: Bg, gzip: zg } = fc(),
    { Inflate: Ng, inflate: jg, inflateRaw: Vg, ungzip: Gg } = tf(),
    $g = nn();
  Ct.exports.Deflate = Tg;
  Ct.exports.deflate = Rg;
  Ct.exports.deflateRaw = Bg;
  Ct.exports.gzip = zg;
  Ct.exports.Inflate = Ng;
  Ct.exports.inflate = jg;
  Ct.exports.inflateRaw = Vg;
  Ct.exports.ungzip = Gg;
  Ct.exports.constants = $g;
});
var rf = he(ja => {
  'use strict';
  Object.defineProperty(ja, '__esModule', { value: !0 });
  ja.decodeJpeg = qg;
  var Xi = new Int32Array([
      0, 1, 8, 16, 9, 2, 3, 10, 17, 24, 32, 25, 18, 11, 4, 5, 12, 19, 26, 33, 40, 48, 41, 34, 27,
      20, 13, 6, 7, 14, 21, 28, 35, 42, 49, 56, 57, 50, 43, 36, 29, 22, 15, 23, 30, 37, 44, 51, 58,
      59, 52, 45, 38, 31, 39, 46, 53, 60, 61, 54, 47, 55, 62, 63,
    ]),
    Gr = 4017,
    $r = 799,
    Zr = 3406,
    Hr = 2276,
    Xr = 1567,
    Kr = 3784,
    ri = 5793,
    Wr = 2896,
    Zg = 100,
    nf = 64 * 1024 * 1024,
    Na = 0;
  function oi(e) {
    let n = Na + e;
    if (n > nf) {
      let t = Math.ceil((n - nf) / 1024 / 1024);
      throw new Error(`Max memory limit exceeded by at least ${t}MB`);
    }
    Na = n;
  }
  function Hg(e, n) {
    let t = 16;
    for (; t > 0 && !e[t - 1];) t--;
    let i = [{ children: [], index: 0 }],
      r = 0,
      o = i[0];
    for (let a = 0; a < t; a++) {
      for (let s = 0; s < e[a]; s++) {
        for (o = i.pop(), o.children[o.index] = n[r]; o.index > 0;) {
          if (i.length === 0) throw new Error('Could not recreate Huffman Table');
          o = i.pop();
        }
        for (o.index++, i.push(o); i.length <= a;) {
          let c = { children: [], index: 0 };
          (i.push(c), (o.children[o.index] = c.children), (o = c));
        }
        r++;
      }
      if (a + 1 < t) {
        let s = { children: [], index: 0 };
        (i.push(s), (o.children[o.index] = s.children), (o = s));
      }
    }
    return i[0].children;
  }
  function Xg(e, n, t, i, r, o, a, s, c) {
    let l = t.mcusPerLine,
      f = t.progressive,
      d = n,
      u = 0,
      h = 0;
    function p() {
      if (h > 0) return (h--, (u >> h) & 1);
      if (((u = e[n++]), u == 255)) {
        let R = e[n++];
        if (R) throw new Error(`unexpected marker: ${((u << 8) | R).toString(16)}`);
      }
      return ((h = 7), u >>> 7);
    }
    function _(R) {
      let P = R;
      for (;;) {
        if (((P = P[p()]), typeof P == 'number')) return P;
        if (P === void 0) throw new Error('invalid huffman sequence');
      }
    }
    function b(R) {
      let P = 0;
      for (; R > 0;) ((P = (P << 1) | p()), R--);
      return P;
    }
    function g(R) {
      let P = b(R);
      return P >= 1 << (R - 1) ? P : P + (-1 << R) + 1;
    }
    function y(R, P) {
      let N = _(R.huffmanTableDC),
        z = N === 0 ? 0 : g(N);
      P[0] = R.pred += z;
      let Z = 1;
      for (; Z < 64;) {
        let te = _(R.huffmanTableAC),
          Y = te & 15,
          se = te >> 4;
        if (Y === 0) {
          if (se < 15) break;
          Z += 16;
          continue;
        }
        Z += se;
        let ke = Xi[Z];
        ((P[ke] = g(Y)), Z++);
      }
    }
    function w(R, P) {
      let N = _(R.huffmanTableDC),
        z = N === 0 ? 0 : g(N) << c;
      P[0] = R.pred += z;
    }
    function m(R, P) {
      P[0] |= p() << c;
    }
    let A = 0;
    function M(R, P) {
      if (A > 0) {
        A--;
        return;
      }
      let N = o,
        z = a;
      for (; N <= z;) {
        let Z = _(R.huffmanTableAC),
          te = Z & 15,
          Y = Z >> 4;
        if (te === 0) {
          if (Y < 15) {
            A = b(Y) + (1 << Y) - 1;
            break;
          }
          N += 16;
          continue;
        }
        N += Y;
        let se = Xi[N];
        ((P[se] = g(te) * (1 << c)), N++);
      }
    }
    let k = 0,
      E = 0;
    function F(R, P) {
      let N = o,
        z = a,
        Z = 0;
      for (; N <= z;) {
        let te = Xi[N],
          Y = P[te] < 0 ? -1 : 1;
        switch (k) {
          case 0:
            let se = _(R.huffmanTableAC),
              ke = se & 15;
            if (((Z = se >> 4), ke === 0))
              Z < 15 ? ((A = b(Z) + (1 << Z)), (k = 4)) : ((Z = 16), (k = 1));
            else {
              if (ke !== 1) throw new Error('invalid ACn encoding');
              ((E = g(ke)), (k = Z ? 2 : 3));
            }
            continue;
          case 1:
          case 2:
            P[te] ? (P[te] += (p() << c) * Y) : (Z--, Z === 0 && (k = k == 2 ? 3 : 0));
            break;
          case 3:
            P[te] ? (P[te] += (p() << c) * Y) : ((P[te] = E << c), (k = 0));
            break;
          case 4:
            P[te] && (P[te] += (p() << c) * Y);
            break;
        }
        N++;
      }
      k === 4 && (A--, A === 0 && (k = 0));
    }
    function I(R, P, N, z, Z) {
      let te = (N / l) | 0,
        Y = N % l,
        se = te * R.v + z,
        ke = Y * R.h + Z;
      R.blocks[se] !== void 0 && P(R, R.blocks[se][ke]);
    }
    function C(R, P, N) {
      let z = (N / R.blocksPerLine) | 0,
        Z = N % R.blocksPerLine;
      R.blocks[z] !== void 0 && P(R, R.blocks[z][Z]);
    }
    let B = i.length,
      ee,
      $;
    f ? (o === 0 ? ($ = s === 0 ? w : m) : ($ = s === 0 ? M : F)) : ($ = y);
    let U = 0,
      V;
    (B == 1 ? (V = i[0].blocksPerLine * i[0].blocksPerColumn) : (V = l * t.mcusPerColumn),
      r || (r = V));
    let X, ie, H;
    for (; U < V;) {
      for (let R = 0; R < B; R++) i[R].pred = 0;
      if (((A = 0), B == 1)) {
        ee = i[0];
        for (let R = 0; R < r; R++) (C(ee, $, U), U++);
      } else
        for (let R = 0; R < r; R++) {
          for (let P = 0; P < B; P++) {
            ((ee = i[P]), (X = ee.h), (ie = ee.v));
            for (let N = 0; N < ie; N++) for (let z = 0; z < X; z++) I(ee, $, U, N, z);
          }
          if ((U++, U === V)) break;
        }
      if (U === V)
        do {
          if (e[n] === 255 && e[n + 1] !== 0) break;
          n += 1;
        } while (n < e.length - 2);
      if (((h = 0), (H = (e[n] << 8) | e[n + 1]), H < 65280))
        throw new Error('marker was not found');
      if (H >= 65488 && H <= 65495) n += 2;
      else break;
    }
    return n - d;
  }
  function Kg(e) {
    let n = [],
      t = e.blocksPerLine,
      i = e.blocksPerColumn,
      r = t << 3,
      o = new Int32Array(64),
      a = new Uint8Array(64);
    function s(c, l, f) {
      let d = e.quantizationTable,
        u = f;
      for (let h = 0; h < 64; h++) u[h] = c[h] * d[h];
      for (let h = 0; h < 8; ++h) {
        let p = 8 * h;
        if (
          u[1 + p] == 0 &&
          u[2 + p] == 0 &&
          u[3 + p] == 0 &&
          u[4 + p] == 0 &&
          u[5 + p] == 0 &&
          u[6 + p] == 0 &&
          u[7 + p] == 0
        ) {
          let E = (ri * u[0 + p] + 512) >> 10;
          ((u[0 + p] = E),
            (u[1 + p] = E),
            (u[2 + p] = E),
            (u[3 + p] = E),
            (u[4 + p] = E),
            (u[5 + p] = E),
            (u[6 + p] = E),
            (u[7 + p] = E));
          continue;
        }
        let _ = (ri * u[0 + p] + 128) >> 8,
          b = (ri * u[4 + p] + 128) >> 8,
          g = u[2 + p],
          y = u[6 + p],
          w = (Wr * (u[1 + p] - u[7 + p]) + 128) >> 8,
          m = (Wr * (u[1 + p] + u[7 + p]) + 128) >> 8,
          A = u[3 + p] << 4,
          M = u[5 + p] << 4,
          k = (_ - b + 1) >> 1;
        ((_ = (_ + b + 1) >> 1),
          (b = k),
          (k = (g * Kr + y * Xr + 128) >> 8),
          (g = (g * Xr - y * Kr + 128) >> 8),
          (y = k),
          (k = (w - M + 1) >> 1),
          (w = (w + M + 1) >> 1),
          (M = k),
          (k = (m + A + 1) >> 1),
          (A = (m - A + 1) >> 1),
          (m = k),
          (k = (_ - y + 1) >> 1),
          (_ = (_ + y + 1) >> 1),
          (y = k),
          (k = (b - g + 1) >> 1),
          (b = (b + g + 1) >> 1),
          (g = k),
          (k = (w * Hr + m * Zr + 2048) >> 12),
          (w = (w * Zr - m * Hr + 2048) >> 12),
          (m = k),
          (k = (A * $r + M * Gr + 2048) >> 12),
          (A = (A * Gr - M * $r + 2048) >> 12),
          (M = k),
          (u[0 + p] = _ + m),
          (u[7 + p] = _ - m),
          (u[1 + p] = b + M),
          (u[6 + p] = b - M),
          (u[2 + p] = g + A),
          (u[5 + p] = g - A),
          (u[3 + p] = y + w),
          (u[4 + p] = y - w));
      }
      for (let h = 0; h < 8; ++h) {
        let p = h;
        if (
          u[8 + p] == 0 &&
          u[16 + p] == 0 &&
          u[24 + p] == 0 &&
          u[32 + p] == 0 &&
          u[40 + p] == 0 &&
          u[48 + p] == 0 &&
          u[56 + p] == 0
        ) {
          let E = (ri * f[h + 0] + 8192) >> 14;
          ((u[0 + p] = E),
            (u[8 + p] = E),
            (u[16 + p] = E),
            (u[24 + p] = E),
            (u[32 + p] = E),
            (u[40 + p] = E),
            (u[48 + p] = E),
            (u[56 + p] = E));
          continue;
        }
        let _ = (ri * u[0 + p] + 2048) >> 12,
          b = (ri * u[32 + p] + 2048) >> 12,
          g = u[16 + p],
          y = u[48 + p],
          w = (Wr * (u[8 + p] - u[56 + p]) + 2048) >> 12,
          m = (Wr * (u[8 + p] + u[56 + p]) + 2048) >> 12,
          A = u[24 + p],
          M = u[40 + p],
          k = (_ - b + 1) >> 1;
        ((_ = (_ + b + 1) >> 1),
          (b = k),
          (k = (g * Kr + y * Xr + 2048) >> 12),
          (g = (g * Xr - y * Kr + 2048) >> 12),
          (y = k),
          (k = (w - M + 1) >> 1),
          (w = (w + M + 1) >> 1),
          (M = k),
          (k = (m + A + 1) >> 1),
          (A = (m - A + 1) >> 1),
          (m = k),
          (k = (_ - y + 1) >> 1),
          (_ = (_ + y + 1) >> 1),
          (y = k),
          (k = (b - g + 1) >> 1),
          (b = (b + g + 1) >> 1),
          (g = k),
          (k = (w * Hr + m * Zr + 2048) >> 12),
          (w = (w * Zr - m * Hr + 2048) >> 12),
          (m = k),
          (k = (A * $r + M * Gr + 2048) >> 12),
          (A = (A * Gr - M * $r + 2048) >> 12),
          (M = k),
          (u[0 + p] = _ + m),
          (u[56 + p] = _ - m),
          (u[8 + p] = b + M),
          (u[48 + p] = b - M),
          (u[16 + p] = g + A),
          (u[40 + p] = g - A),
          (u[24 + p] = y + w),
          (u[32 + p] = y - w));
      }
      for (let h = 0; h < 64; ++h) {
        let p = 128 + ((u[h] + 8) >> 4);
        l[h] = p < 0 ? 0 : p > 255 ? 255 : p;
      }
    }
    oi(r * i * 8);
    for (let c = 0; c < i; c++) {
      let l = c << 3;
      for (let f = 0; f < 8; f++) n.push(new Uint8Array(r));
      for (let f = 0; f < t; f++) {
        s(e.blocks[c][f], a, o);
        let d = 0,
          u = f << 3;
        for (let h = 0; h < 8; h++) {
          let p = n[l + h];
          for (let _ = 0; _ < 8; _++) p[u + _] = a[d++];
        }
      }
    }
    return n;
  }
  function Kt(e) {
    return e < 0 ? 0 : e > 255 ? 255 : e;
  }
  function Wg(e) {
    let n = {
        width: 0,
        height: 0,
        adobe: void 0,
        components: [],
        exifBuffer: void 0,
        jfif: void 0,
      },
      t = Zg * 1e3 * 1e3,
      i = 0;
    function r() {
      let g = (e[i] << 8) | e[i + 1];
      return ((i += 2), g);
    }
    function o() {
      let g = r(),
        y = e.subarray(i, i + g - 2);
      return ((i += y.length), y);
    }
    function a(g) {
      let y = 0,
        w = 0;
      for (let M in g.components)
        if (g.components.hasOwnProperty(M)) {
          let k = g.components[M];
          (y < k.h && (y = k.h), w < k.v && (w = k.v));
        }
      let m = Math.ceil(g.samplesPerLine / 8 / y),
        A = Math.ceil(g.scanLines / 8 / w);
      for (let M in g.components)
        if (g.components.hasOwnProperty(M)) {
          let k = g.components[M],
            E = Math.ceil((Math.ceil(g.samplesPerLine / 8) * k.h) / y),
            F = Math.ceil((Math.ceil(g.scanLines / 8) * k.v) / w),
            I = m * k.h,
            C = A * k.v,
            B = C * I,
            ee = [];
          oi(B * 256);
          for (let $ = 0; $ < C; $++) {
            let U = [];
            for (let V = 0; V < I; V++) U.push(new Int32Array(64));
            ee.push(U);
          }
          ((k.blocksPerLine = E), (k.blocksPerColumn = F), (k.blocks = ee));
        }
      ((g.maxH = y), (g.maxV = w), (g.mcusPerLine = m), (g.mcusPerColumn = A));
    }
    let s = null,
      c = null,
      l,
      f = 0,
      d = [],
      u = [],
      h = [],
      p = [],
      _ = r(),
      b = -1;
    if (_ != 65496) throw new Error('SOI not found');
    for (_ = r(); _ != 65497;) {
      switch (_) {
        case 65280:
          break;
        case 65504:
        case 65505:
        case 65506:
        case 65507:
        case 65508:
        case 65509:
        case 65510:
        case 65511:
        case 65512:
        case 65513:
        case 65514:
        case 65515:
        case 65516:
        case 65517:
        case 65518:
        case 65519:
        case 65534: {
          let g = o();
          (_ === 65504 &&
            g[0] === 74 &&
            g[1] === 70 &&
            g[2] === 73 &&
            g[3] === 70 &&
            g[4] === 0 &&
            (s = {
              version: { major: g[5], minor: g[6] },
              densityUnits: g[7],
              xDensity: (g[8] << 8) | g[9],
              yDensity: (g[10] << 8) | g[11],
              thumbWidth: g[12],
              thumbHeight: g[13],
              thumbData: g.subarray(14, 14 + 3 * g[12] * g[13]),
            }),
            _ === 65505 &&
              g[0] === 69 &&
              g[1] === 120 &&
              g[2] === 105 &&
              g[3] === 102 &&
              g[4] === 0 &&
              (n.exifBuffer = g.subarray(5, g.length)),
            _ === 65518 &&
              g[0] === 65 &&
              g[1] === 100 &&
              g[2] === 111 &&
              g[3] === 98 &&
              g[4] === 101 &&
              g[5] === 0 &&
              (c = {
                version: g[6],
                flags0: (g[7] << 8) | g[8],
                flags1: (g[9] << 8) | g[10],
                transformCode: g[11],
              }));
          break;
        }
        case 65499: {
          let y = r() + i - 2;
          for (; i < y;) {
            let w = e[i++];
            oi(256);
            let m = new Int32Array(64);
            if (w >> 4 === 0)
              for (let A = 0; A < 64; A++) {
                let M = Xi[A];
                m[M] = e[i++];
              }
            else if (w >> 4 === 1)
              for (let A = 0; A < 64; A++) {
                let M = Xi[A];
                m[M] = r();
              }
            else throw new Error('DQT: invalid table spec');
            d[w & 15] = m;
          }
          break;
        }
        case 65472:
        case 65473:
        case 65474: {
          (r(),
            (l = {
              extended: _ === 65473,
              progressive: _ === 65474,
              precision: e[i++],
              scanLines: r(),
              samplesPerLine: r(),
              components: {},
              componentsOrder: [],
              maxH: 0,
              maxV: 0,
              mcusPerLine: 0,
              mcusPerColumn: 0,
            }));
          let g = l.scanLines * l.samplesPerLine;
          if (g > t) {
            let w = Math.ceil((g - t) / 1e6);
            throw new Error(`maxResolutionInMP limit exceeded by ${w}MP`);
          }
          let y = e[i++];
          for (let w = 0; w < y; w++) {
            let m = e[i],
              A = e[i + 1] >> 4,
              M = e[i + 1] & 15,
              k = e[i + 2];
            (l.componentsOrder.push(m),
              (l.components[m] = {
                h: A,
                v: M,
                quantizationIdx: k,
                blocksPerColumn: 0,
                blocksPerLine: 0,
                blocks: [],
                pred: 0,
              }),
              (i += 3));
          }
          (a(l), u.push(l));
          break;
        }
        case 65476: {
          let g = r();
          for (let y = 2; y < g;) {
            let w = e[i++],
              m = new Uint8Array(16),
              A = 0;
            for (let F = 0; F < 16; F++, i++) A += m[F] = e[i];
            oi(16 + A);
            let M = new Uint8Array(A);
            for (let F = 0; F < A; F++, i++) M[F] = e[i];
            y += 17 + A;
            let k = w & 15,
              E = w >> 4 === 0 ? p : h;
            E[k] = Hg(m, M);
          }
          break;
        }
        case 65501:
          (r(), (f = r()));
          break;
        case 65500:
          (r(), r());
          break;
        case 65498: {
          r();
          let g = e[i++],
            y = [];
          for (let k = 0; k < g; k++) {
            let E = l.components[e[i++]],
              F = e[i++];
            ((E.huffmanTableDC = p[F >> 4]), (E.huffmanTableAC = h[F & 15]), y.push(E));
          }
          let w = e[i++],
            m = e[i++],
            A = e[i++],
            M = Xg(e, i, l, y, f, w, m, A >> 4, A & 15);
          i += M;
          break;
        }
        case 65535:
          e[i] !== 255 && i--;
          break;
        default: {
          if (e[i - 3] == 255 && e[i - 2] >= 192 && e[i - 2] <= 254) {
            i -= 3;
            break;
          } else if (_ === 224 || _ == 225) {
            if (b !== -1)
              throw new Error(
                `first unknown JPEG marker at offset ${b.toString(16)}, second unknown JPEG marker ${_.toString(16)} at offset ${(i - 1).toString(16)}`
              );
            b = i - 1;
            let g = r();
            if (e[i + g - 2] === 255) {
              i += g - 2;
              break;
            }
          }
          throw new Error('unknown JPEG marker ' + _.toString(16));
        }
      }
      _ = r();
    }
    if (u.length != 1) throw new Error('only single frame JPEGs supported');
    for (let g = 0; g < u.length; g++) {
      let y = u[g].components;
      for (let w in y)
        ((y[w].quantizationTable = d[y[w].quantizationIdx]), delete y[w].quantizationIdx);
    }
    ((n.width = l.samplesPerLine),
      (n.height = l.scanLines),
      (n.jfif = s),
      (n.adobe = c),
      (n.components = []));
    for (let g = 0; g < l.componentsOrder.length; g++) {
      let y = l.components[l.componentsOrder[g]];
      n.components.push({ lines: Kg(y), scaleX: y.h / l.maxH, scaleY: y.v / l.maxV });
    }
    return n;
  }
  function Yg(e) {
    let n = 0,
      t = !1,
      i = e.width,
      r = e.height,
      o = i * r * e.components.length;
    oi(o);
    let a = new Uint8Array(o);
    switch (e.components.length) {
      case 1: {
        let s = e.components[0];
        for (let c = 0; c < r; c++) {
          let l = s.lines[0 | (c * s.scaleY)];
          for (let f = 0; f < i; f++) {
            let d = l[0 | (f * s.scaleX)];
            a[n++] = d;
          }
        }
        break;
      }
      case 2: {
        let s = e.components[0],
          c = e.components[1];
        for (let l = 0; l < r; l++) {
          let f = s.lines[0 | (l * s.scaleY)],
            d = c.lines[0 | (l * c.scaleY)];
          for (let u = 0; u < i; u++) {
            let h = f[0 | (u * s.scaleX)];
            a[n++] = h;
            let p = d[0 | (u * c.scaleX)];
            a[n++] = p;
          }
        }
        break;
      }
      case 3: {
        ((t = !0), e.adobe && e.adobe.transformCode && (t = !0));
        let s = e.components[0],
          c = e.components[1],
          l = e.components[2];
        for (let f = 0; f < r; f++) {
          let d = s.lines[0 | (f * s.scaleY)],
            u = c.lines[0 | (f * c.scaleY)],
            h = l.lines[0 | (f * l.scaleY)];
          for (let p = 0; p < i; p++) {
            let _, b, g, y, w, m;
            (t
              ? ((_ = d[0 | (p * s.scaleX)]),
                (b = u[0 | (p * c.scaleX)]),
                (g = h[0 | (p * l.scaleX)]),
                (y = Kt(_ + 1.402 * (g - 128))),
                (w = Kt(_ - 0.3441363 * (b - 128) - 0.71413636 * (g - 128))),
                (m = Kt(_ + 1.772 * (b - 128))))
              : ((y = d[0 | (p * s.scaleX)]),
                (w = u[0 | (p * c.scaleX)]),
                (m = h[0 | (p * l.scaleX)])),
              (a[n++] = y),
              (a[n++] = w),
              (a[n++] = m));
          }
        }
        break;
      }
      case 4: {
        if (!e.adobe) throw new Error('Unsupported color mode (4 components)');
        ((t = !1), e.adobe && e.adobe.transformCode && (t = !0));
        let s = e.components[0],
          c = e.components[1],
          l = e.components[2],
          f = e.components[3];
        for (let d = 0; d < r; d++) {
          let u = s.lines[0 | (d * s.scaleY)],
            h = c.lines[0 | (d * c.scaleY)],
            p = l.lines[0 | (d * l.scaleY)],
            _ = f.lines[0 | (d * f.scaleY)];
          for (let b = 0; b < i; b++) {
            let g, y, w, m, A, M, k;
            (t
              ? ((g = u[0 | (b * s.scaleX)]),
                (y = h[0 | (b * c.scaleX)]),
                (w = p[0 | (b * l.scaleX)]),
                (m = _[0 | (b * f.scaleX)]),
                (A = 255 - Kt(g + 1.402 * (w - 128))),
                (M = 255 - Kt(g - 0.3441363 * (y - 128) - 0.71413636 * (w - 128))),
                (k = 255 - Kt(g + 1.772 * (y - 128))))
              : ((A = u[0 | (b * s.scaleX)]),
                (M = h[0 | (b * c.scaleX)]),
                (k = p[0 | (b * l.scaleX)]),
                (m = _[0 | (b * f.scaleX)])),
              (a[n++] = 255 - A),
              (a[n++] = 255 - M),
              (a[n++] = 255 - k),
              (a[n++] = 255 - m));
          }
        }
        break;
      }
      default:
        throw new Error('Unsupported color mode');
    }
    return a;
  }
  function qg(e, n) {
    if (((Na = 0), e.length === 0)) throw new Error('Empty jpeg buffer');
    let t = Wg(e);
    oi(t.width * t.height * 4);
    let i = Yg(t),
      r = n(t.width, t.height),
      o = r.width,
      a = r.height,
      s = r.data,
      c = 0,
      l = 0;
    switch (t.components.length) {
      case 1:
        for (let f = 0; f < a; f++)
          for (let d = 0; d < o; d++) {
            let u = i[c++];
            ((s[l++] = u), (s[l++] = u), (s[l++] = u), (s[l++] = 255));
          }
        break;
      case 2:
        for (let f = 0; f < a; f++)
          for (let d = 0; d < o; d++) {
            let u = i[c++],
              h = i[c++];
            ((s[l++] = u), (s[l++] = u), (s[l++] = u), (s[l++] = h));
          }
        break;
      case 3:
        for (let f = 0; f < a; f++)
          for (let d = 0; d < o; d++) {
            let u = i[c++],
              h = i[c++],
              p = i[c++];
            ((s[l++] = u), (s[l++] = h), (s[l++] = p), (s[l++] = 255));
          }
        break;
      case 4:
        for (let f = 0; f < a; f++)
          for (let d = 0; d < o; d++) {
            let u = i[c++],
              h = i[c++],
              p = i[c++],
              _ = i[c++],
              b = 255 - Kt(u * (1 - _ / 255) + _),
              g = 255 - Kt(h * (1 - _ / 255) + _),
              y = 255 - Kt(p * (1 - _ / 255) + _);
            ((s[l++] = b), (s[l++] = g), (s[l++] = y), (s[l++] = 255));
          }
        break;
      default:
        throw new Error('Unsupported color mode');
    }
    return r;
  }
});
var fn = he(J => {
  'use strict';
  Object.defineProperty(J, '__esModule', { value: !0 });
  J.createImageData =
    J.createCanvas =
    J.MaskParams =
    J.LayerMaskFlags =
    J.ColorSpace =
    J.largeAdditionalInfoKeys =
    J.layerColors =
    J.toBlendMode =
    J.fromBlendMode =
    J.RAW_IMAGE_DATA =
    J.MOCK_HANDLERS =
      void 0;
  J.revMap = lf;
  J.createEnum = em;
  J.offsetForChannel = tm;
  J.clamp = nm;
  J.hasAlpha = im;
  J.resetImageData = rm;
  J.imageDataToCanvas = om;
  J.decodeBitmap = am;
  J.writeDataRaw = sm;
  J.writeDataRLE = lm;
  J.writeDataZipWithoutPrediction = cm;
  J.createCanvasFromData = fm;
  J.initializeCanvas = hm;
  var Jg = za(),
    Qg = rf();
  J.MOCK_HANDLERS = !1;
  J.RAW_IMAGE_DATA = !1;
  J.fromBlendMode = {};
  J.toBlendMode = {
    pass: 'pass through',
    norm: 'normal',
    diss: 'dissolve',
    dark: 'darken',
    'mul ': 'multiply',
    idiv: 'color burn',
    lbrn: 'linear burn',
    dkCl: 'darker color',
    lite: 'lighten',
    scrn: 'screen',
    'div ': 'color dodge',
    lddg: 'linear dodge',
    lgCl: 'lighter color',
    over: 'overlay',
    sLit: 'soft light',
    hLit: 'hard light',
    vLit: 'vivid light',
    lLit: 'linear light',
    pLit: 'pin light',
    hMix: 'hard mix',
    diff: 'difference',
    smud: 'exclusion',
    fsub: 'subtract',
    fdiv: 'divide',
    'hue ': 'hue',
    'sat ': 'saturation',
    colr: 'color',
    'lum ': 'luminosity',
  };
  Object.keys(J.toBlendMode).forEach(e => (J.fromBlendMode[J.toBlendMode[e]] = e));
  J.layerColors = ['none', 'red', 'orange', 'yellow', 'green', 'blue', 'violet', 'gray'];
  J.largeAdditionalInfoKeys = [
    'LMsk',
    'Lr16',
    'Lr32',
    'Layr',
    'Mt16',
    'Mt32',
    'Mtrn',
    'Alph',
    'FMsk',
    'lnk2',
    'FEid',
    'FXid',
    'PxSD',
    'cinf',
  ];
  function lf(e) {
    let n = {};
    return (Object.keys(e).forEach(t => (n[e[t]] = t)), n);
  }
  function em(e, n, t) {
    let i = lf(t);
    return {
      decode: a => {
        let s = a.split('.')[1];
        if (s && !i[s]) {
          if (Object.prototype.hasOwnProperty.call(t, s)) return s;
          let c = s.replace(/([A-Z])/g, ' $1').toLowerCase();
          if (Object.prototype.hasOwnProperty.call(t, c)) return c;
          throw new Error(`Unrecognized value for enum: '${a}'`);
        }
        return i[s] || n;
      },
      encode: a => {
        if (a && !t[a]) throw new Error(`Invalid value for enum: '${a}'`);
        return `${e}.${a ? t[a] : t[n]}`;
      },
    };
  }
  var of;
  (function (e) {
    ((e[(e.RGB = 0)] = 'RGB'),
      (e[(e.HSB = 1)] = 'HSB'),
      (e[(e.CMYK = 2)] = 'CMYK'),
      (e[(e.Lab = 7)] = 'Lab'),
      (e[(e.Grayscale = 8)] = 'Grayscale'));
  })(of || (J.ColorSpace = of = {}));
  var af;
  (function (e) {
    ((e[(e.PositionRelativeToLayer = 1)] = 'PositionRelativeToLayer'),
      (e[(e.LayerMaskDisabled = 2)] = 'LayerMaskDisabled'),
      (e[(e.InvertLayerMaskWhenBlending = 4)] = 'InvertLayerMaskWhenBlending'),
      (e[(e.LayerMaskFromRenderingOtherData = 8)] = 'LayerMaskFromRenderingOtherData'),
      (e[(e.MaskHasParametersAppliedToIt = 16)] = 'MaskHasParametersAppliedToIt'));
  })(af || (J.LayerMaskFlags = af = {}));
  var sf;
  (function (e) {
    ((e[(e.UserMaskDensity = 1)] = 'UserMaskDensity'),
      (e[(e.UserMaskFeather = 2)] = 'UserMaskFeather'),
      (e[(e.VectorMaskDensity = 4)] = 'VectorMaskDensity'),
      (e[(e.VectorMaskFeather = 8)] = 'VectorMaskFeather'));
  })(sf || (J.MaskParams = sf = {}));
  function tm(e, n) {
    switch (e) {
      case 0:
        return 0;
      case 1:
        return 1;
      case 2:
        return 2;
      case 3:
        return n ? 3 : e + 1;
      case -1:
        return n ? 4 : 3;
      default:
        return e + 1;
    }
  }
  function nm(e, n, t) {
    return e < n ? n : e > t ? t : e;
  }
  function im(e) {
    let n = e.width * e.height * 4;
    for (let t = 3; t < n; t += 4) if (e.data[t] !== 255) return !0;
    return !1;
  }
  function rm({ data: e }) {
    let n = e instanceof Float32Array ? 1 : e instanceof Uint16Array ? 65535 : 255;
    for (let t = 0, i = e.length | 0; t < i; t = (t + 4) | 0)
      ((e[t + 0] = 0), (e[t + 1] = 0), (e[t + 2] = 0), (e[t + 3] = n));
  }
  function om(e) {
    let n = (0, J.createCanvas)(e.width, e.height),
      t;
    if (e.data instanceof Uint8ClampedArray) t = e;
    else {
      t = (0, J.createImageData)(e.width, e.height);
      let i = e.data,
        r = t.data;
      if (i instanceof Float32Array)
        for (let o = 0, a = i.length; o < a; o += 4)
          ((r[o + 0] = Math.round(Math.pow(i[o + 0], 1 / 2.2) * 255)),
            (r[o + 1] = Math.round(Math.pow(i[o + 1], 1 / 2.2) * 255)),
            (r[o + 2] = Math.round(Math.pow(i[o + 2], 1 / 2.2) * 255)),
            (r[o + 3] = Math.round(i[o + 3] * 255)));
      else {
        let o = i instanceof Uint16Array ? 8 : 0;
        for (let a = 0, s = i.length; a < s; a++) r[a] = i[a] >>> o;
      }
    }
    return (n.getContext('2d').putImageData(t, 0, 0), n);
  }
  function am(e, n, t, i) {
    if (!(e instanceof Uint8Array || e instanceof Uint8ClampedArray))
      throw new Error('Invalid bit depth');
    for (let r = 0, o = 0, a = 0; r < i; r++)
      for (let s = 0; s < t;) {
        let c = e[a++];
        for (let l = 0; l < 8 && s < t; l++, s++, o += 4) {
          let f = c & 128 ? 0 : 255;
          ((c = c << 1), (n[o + 0] = f), (n[o + 1] = f), (n[o + 2] = f), (n[o + 3] = 255));
        }
      }
  }
  function sm(e, n, t, i) {
    if (!t || !i) return;
    let r = new Uint8Array(t * i);
    for (let o = 0; o < r.length; o++) r[o] = e.data[o * 4 + n];
    return r;
  }
  function lm(e, { data: n, width: t, height: i }, r, o) {
    if (!t || !i) return;
    let a = (4 * t) | 0,
      s = 0,
      c = (r.length * (o ? 4 : 2) * i) | 0;
    for (let l of r)
      for (let f = 0, d = l | 0; f < i; f++) {
        let u = (f * a) | 0,
          h = (u + a) | 0,
          p = (h + l - 4) | 0,
          _ = (p - 4) | 0,
          b = c;
        for (d = (u + l) | 0; d < h; d = (d + 4) | 0)
          if (d < _) {
            let y = n[d];
            d = (d + 4) | 0;
            let w = n[d];
            d = (d + 4) | 0;
            let m = n[d];
            if (y === w && y === m) {
              let A = 3;
              for (; A < 128 && d < p && n[(d + 4) | 0] === y;)
                ((A = (A + 1) | 0), (d = (d + 4) | 0));
              ((e[c++] = 1 - A), (e[c++] = y));
            } else {
              let A = c,
                M = !0,
                k = 1;
              for (e[c++] = 0, e[c++] = y; d < p && k < 128;)
                if (((d = (d + 4) | 0), (y = w), (w = m), (m = n[d]), y === w && y === m)) {
                  ((d = (d - 12) | 0), (M = !1));
                  break;
                } else (k++, (e[c++] = y));
              (M &&
                (k < 127
                  ? ((e[c++] = w), (e[c++] = m), (k += 2))
                  : k < 128
                    ? ((e[c++] = w), k++, (d = (d - 4) | 0))
                    : (d = (d - 8) | 0)),
                (e[A] = k - 1));
            }
          } else
            d === p
              ? ((e[c++] = 0), (e[c++] = n[d]))
              : ((e[c++] = 1), (e[c++] = n[d]), (d = (d + 4) | 0), (e[c++] = n[d]));
        let g = c - b;
        (o && ((e[s++] = (g >> 24) & 255), (e[s++] = (g >> 16) & 255)),
          (e[s++] = (g >> 8) & 255),
          (e[s++] = g & 255));
      }
    return e.slice(0, c);
  }
  function cm({ data: e, width: n, height: t }, i) {
    let r = n * t,
      o = new Uint8Array(r),
      a = [],
      s = 0;
    for (let c of i) {
      for (let f = 0, d = c; f < r; f++, d += 4) o[f] = e[d];
      let l = (0, Jg.deflate)(o);
      (a.push(l), (s += l.byteLength));
    }
    if (a.length > 0) {
      let c = new Uint8Array(s),
        l = 0;
      for (let f of a) (c.set(f, l), (l += f.byteLength));
      return c;
    } else return a[0];
  }
  function fm(e) {
    let n = (0, J.createCanvas)(100, 100);
    try {
      let t = n.getContext('2d'),
        i = (0, Qg.decodeJpeg)(e, (r, o) => t.createImageData(r, o));
      ((n.width = i.width), (n.height = i.height), t.putImageData(i, 0, 0));
    } catch (t) {
      console.error('JPEG decompression error', t.message);
    }
    return n;
  }
  var um = () => {
    throw new Error(
      'Canvas not initialized, use initializeCanvas method to set up createCanvas method'
    );
  };
  J.createCanvas = um;
  var Va,
    dm = (e, n) => (
      Va || (Va = (0, J.createCanvas)(1, 1)),
      Va.getContext('2d').createImageData(e, n)
    );
  J.createImageData = dm;
  typeof document < 'u' &&
    (J.createCanvas = (e, n) => {
      let t = document.createElement('canvas');
      return ((t.width = e), (t.height = n), t);
    });
  function hm(e, n) {
    ((J.createCanvas = e), (J.createImageData = n || J.createImageData));
  }
});
var qr = he(Yr => {
  'use strict';
  Yr.byteLength = gm;
  Yr.toByteArray = bm;
  Yr.fromByteArray = _m;
  var Ot = [],
    ft = [],
    pm = typeof Uint8Array < 'u' ? Uint8Array : Array,
    Ga = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  for (Mn = 0, cf = Ga.length; Mn < cf; ++Mn) ((Ot[Mn] = Ga[Mn]), (ft[Ga.charCodeAt(Mn)] = Mn));
  var Mn, cf;
  ft[45] = 62;
  ft[95] = 63;
  function ff(e) {
    var n = e.length;
    if (n % 4 > 0) throw new Error('Invalid string. Length must be a multiple of 4');
    var t = e.indexOf('=');
    t === -1 && (t = n);
    var i = t === n ? 0 : 4 - (t % 4);
    return [t, i];
  }
  function gm(e) {
    var n = ff(e),
      t = n[0],
      i = n[1];
    return ((t + i) * 3) / 4 - i;
  }
  function mm(e, n, t) {
    return ((n + t) * 3) / 4 - t;
  }
  function bm(e) {
    var n,
      t = ff(e),
      i = t[0],
      r = t[1],
      o = new pm(mm(e, i, r)),
      a = 0,
      s = r > 0 ? i - 4 : i,
      c;
    for (c = 0; c < s; c += 4)
      ((n =
        (ft[e.charCodeAt(c)] << 18) |
        (ft[e.charCodeAt(c + 1)] << 12) |
        (ft[e.charCodeAt(c + 2)] << 6) |
        ft[e.charCodeAt(c + 3)]),
        (o[a++] = (n >> 16) & 255),
        (o[a++] = (n >> 8) & 255),
        (o[a++] = n & 255));
    return (
      r === 2 &&
        ((n = (ft[e.charCodeAt(c)] << 2) | (ft[e.charCodeAt(c + 1)] >> 4)), (o[a++] = n & 255)),
      r === 1 &&
        ((n =
          (ft[e.charCodeAt(c)] << 10) |
          (ft[e.charCodeAt(c + 1)] << 4) |
          (ft[e.charCodeAt(c + 2)] >> 2)),
        (o[a++] = (n >> 8) & 255),
        (o[a++] = n & 255)),
      o
    );
  }
  function ym(e) {
    return Ot[(e >> 18) & 63] + Ot[(e >> 12) & 63] + Ot[(e >> 6) & 63] + Ot[e & 63];
  }
  function wm(e, n, t) {
    for (var i, r = [], o = n; o < t; o += 3)
      ((i = ((e[o] << 16) & 16711680) + ((e[o + 1] << 8) & 65280) + (e[o + 2] & 255)),
        r.push(ym(i)));
    return r.join('');
  }
  function _m(e) {
    for (var n, t = e.length, i = t % 3, r = [], o = 16383, a = 0, s = t - i; a < s; a += o)
      r.push(wm(e, a, a + o > s ? s : a + o));
    return (
      i === 1
        ? ((n = e[t - 1]), r.push(Ot[n >> 2] + Ot[(n << 4) & 63] + '=='))
        : i === 2 &&
          ((n = (e[t - 2] << 8) + e[t - 1]),
          r.push(Ot[n >> 10] + Ot[(n >> 4) & 63] + Ot[(n << 2) & 63] + '=')),
      r.join('')
    );
  }
});
var gf = he(ai => {
  'use strict';
  Object.defineProperty(ai, '__esModule', { value: !0 });
  ai.stringLengthInBytes = hf;
  ai.encodeStringTo = pf;
  ai.encodeString = xm;
  ai.decodeString = Sm;
  function uf(e) {
    return (e & 4294967168) === 0 ? 1 : (e & 4294965248) === 0 ? 2 : (e & 4294901760) === 0 ? 3 : 4;
  }
  function df(e, n) {
    let t = e.charCodeAt(n);
    if (t >= 55296 && t <= 56319 && n + 1 < e.length) {
      let i = e.charCodeAt(n + 1);
      if (i >= 56320 && i <= 57343)
        return { code: ((t & 1023) << 10) + (i & 1023) + 65536, size: 2 };
    }
    return t >= 55296 && t <= 57343 ? { code: 65533, size: 1 } : { code: t, size: 1 };
  }
  function hf(e) {
    let n = 0;
    for (let t = 0; t < e.length;) {
      let { code: i, size: r } = df(e, t);
      ((n += uf(i)), (t += r));
    }
    return n;
  }
  function vm(e, n, t) {
    let i = uf(t);
    switch (i) {
      case 1:
        e[n] = t;
        break;
      case 2:
        ((e[n] = ((t >> 6) & 31) | 192), (e[n + 1] = (t & 63) | 128));
        break;
      case 3:
        ((e[n] = ((t >> 12) & 15) | 224),
          (e[n + 1] = ((t >> 6) & 63) | 128),
          (e[n + 2] = (t & 63) | 128));
        break;
      default:
        ((e[n] = ((t >> 18) & 7) | 240),
          (e[n + 1] = ((t >> 12) & 63) | 128),
          (e[n + 2] = ((t >> 6) & 63) | 128),
          (e[n + 3] = (t & 63) | 128));
        break;
    }
    return i;
  }
  function pf(e, n, t) {
    for (let i = 0; i < t.length;) {
      let { code: r, size: o } = df(t, i);
      ((n += vm(e, n, r)), (i += o));
    }
    return n;
  }
  function xm(e) {
    if (e.length > 1e3 && typeof TextEncoder < 'u') return new TextEncoder().encode(e);
    let n = new Uint8Array(hf(e));
    return (pf(n, 0, e), n);
  }
  function Sm(e) {
    if (e.byteLength > 1e3 && typeof TextDecoder < 'u') return new TextDecoder().decode(e);
    let n = [];
    function t(c) {
      (c > 65535 &&
        ((c -= 65536),
        n.push(String.fromCharCode(((c >>> 10) & 1023) | 55296)),
        (c = 56320 | (c & 1023))),
        n.push(String.fromCharCode(c)));
    }
    let i = 0,
      r = 0,
      o = 0,
      a = 128,
      s = 191;
    for (let c = 0; c < e.length; c++) {
      let l = e[c];
      if (o === 0) {
        l <= 127
          ? t(l)
          : l >= 194 && l <= 223
            ? ((o = 1), (i = l & 31))
            : l >= 224 && l <= 239
              ? (l === 224 && (a = 160), l === 237 && (s = 159), (o = 2), (i = l & 15))
              : l >= 240 && l <= 244
                ? (l === 240 && (a = 144), l === 244 && (s = 143), (o = 3), (i = l & 7))
                : t(65533);
        continue;
      }
      if (l < a || l > s) {
        ((i = 0), (o = 0), (r = 0), (a = 128), (s = 191), t(65533), c--);
        continue;
      }
      ((a = 128),
        (s = 191),
        (i = (i << 6) | (l & 63)),
        r++,
        r === o && (t(i), (i = 0), (o = 0), (r = 0)));
    }
    return (o !== 0 && t(65533), n.join(''));
  }
});
var no = he(D => {
  'use strict';
  var km =
    (D && D.__rest) ||
    function (e, n) {
      var t = {};
      for (var i in e)
        Object.prototype.hasOwnProperty.call(e, i) && n.indexOf(i) < 0 && (t[i] = e[i]);
      if (e != null && typeof Object.getOwnPropertySymbols == 'function')
        for (var r = 0, i = Object.getOwnPropertySymbols(e); r < i.length; r++)
          n.indexOf(i[r]) < 0 &&
            Object.prototype.propertyIsEnumerable.call(e, i[r]) &&
            (t[i[r]] = e[i[r]]);
      return t;
    };
  Object.defineProperty(D, '__esModule', { value: !0 });
  D.IntC =
    D.IntE =
    D.Drct =
    D.WndM =
    D.CntE =
    D.FlCl =
    D.ExtR =
    D.ExtT =
    D.DfsM =
    D.blurType =
    D.Lns =
    D.MztT =
    D.Chnl =
    D.Dstr =
    D.ZZTy =
    D.Wvtp =
    D.SphM =
    D.RplS =
    D.Cnvr =
    D.UndA =
    D.DspM =
    D.SmBQ =
    D.SmBM =
    D.BlrQ =
    D.BlrM =
    D.strokeStyleLineAlignment =
    D.strokeStyleLineJoinType =
    D.strokeStyleLineCapType =
    D.ESliceBGColorType =
    D.ESliceOrigin =
    D.ESliceVertAlign =
    D.ESliceHorzAlign =
    D.ESliceType =
    D.FrFl =
    D.FStl =
    D.ClrS =
    D.gradientInterpolationMethodType =
    D.stdTrackID =
    D.animInterpStyleEnum =
    D.GrdT =
    D.IGSr =
    D.BETE =
    D.BESs =
    D.bvlT =
    D.BESl =
    D.BlnM =
    D.warpStyle =
    D.Annt =
    D.Ornt =
    D.textGridding =
      void 0;
  D.presetKindType = D.prjM = D.FlMd = void 0;
  D.setLogErrors = Im;
  D.readAsciiStringOrClassId = Lt;
  D.readDescriptorStructure = Ha;
  D.writeDescriptorStructure = Xa;
  D.readVersionAndDescriptor = Om;
  D.writeVersionAndDescriptor = Lm;
  D.horzVrtcToXY = Qr;
  D.xyToHorzVrtc = eo;
  D.descBoundsToBounds = Um;
  D.boundsToDescBounds = Pm;
  D.serializeEffects = Ff;
  D.parseEffects = Ef;
  D.parseTrackList = Tm;
  D.serializeTrackList = Rm;
  D.parseVectorContent = Bm;
  D.serializeVectorContent = zm;
  D.parseColor = On;
  D.serializeColor = Ln;
  D.parseAngle = Yi;
  D.parsePercent = Oe;
  D.parsePercentOrAngle = Pf;
  D.parseUnits = vt;
  D.parseUnitsOrNumber = Nm;
  D.parseUnitsToNumber = jm;
  D.unitsAngle = si;
  D.unitsPercent = Te;
  D.unitsPercentF = Za;
  D.unitsValue = Ut;
  D.frac = Vm;
  var W = fn(),
    ae = un(),
    ce = li();
  function Am(e) {
    let n = {};
    return (Object.keys(e).forEach(t => (n[e[t]] = t)), n);
  }
  var Ki = {
      '#Ang': 'Angle',
      '#Rsl': 'Density',
      '#Rlt': 'Distance',
      '#Nne': 'None',
      '#Prc': 'Percent',
      '#Pxl': 'Pixels',
      '#Mlm': 'Millimeters',
      '#Pnt': 'Points',
      RrPi: 'Picas',
      RrIn: 'Inches',
      RrCm: 'Centimeters',
    },
    Jr = Am(Ki),
    Wi = !1;
  function Im(e) {
    Wi = e;
  }
  function T(e, n) {
    return { name: e, classID: n };
  }
  var le = T('', 'null'),
    $a = !1,
    xf = {
      strokeStyleContent: T('', 'solidColorLayer'),
      printProofSetup: T($a ? '\u6821\u6837\u8BBE\u7F6E' : 'Proof Setup', 'proofSetup'),
      Grad: T($a ? '\u6E10\u53D8' : 'Gradient', 'Grdn'),
      Trnf: T($a ? '\u53D8\u6362' : 'Transform', 'Trnf'),
      patternFill: T('', 'patternFill'),
      ebbl: T('', 'ebbl'),
      SoFi: T('', 'SoFi'),
      GrFl: T('', 'GrFl'),
      sdwC: T('', 'RGBC'),
      hglC: T('', 'RGBC'),
      'Clr ': T('', 'RGBC'),
      tintColor: T('', 'RGBC'),
      Ofst: T('', 'Pnt '),
      ChFX: T('', 'ChFX'),
      MpgS: T('', 'ShpC'),
      DrSh: T('', 'DrSh'),
      IrSh: T('', 'IrSh'),
      OrGl: T('', 'OrGl'),
      IrGl: T('', 'IrGl'),
      TrnS: T('', 'ShpC'),
      Ptrn: T('', 'Ptrn'),
      FrFX: T('', 'FrFX'),
      phase: T('', 'Pnt '),
      frameStep: le,
      duration: le,
      workInTime: le,
      workOutTime: le,
      audioClipGroupList: le,
      bounds: T('', 'Rctn'),
      customEnvelopeWarp: T('', 'customEnvelopeWarp'),
      warp: T('', 'warp'),
      'Sz  ': T('', 'Pnt '),
      origin: T('', 'Pnt '),
      autoExpandOffset: T('', 'Pnt '),
      keyOriginShapeBBox: T('', 'unitRect'),
      Vrsn: le,
      psVersion: le,
      docDefaultNewArtboardBackgroundColor: T('', 'RGBC'),
      artboardRect: T('', 'classFloatRect'),
      keyOriginRRectRadii: T('', 'radii'),
      keyOriginBoxCorners: le,
      rectangleCornerA: T('', 'Pnt '),
      rectangleCornerB: T('', 'Pnt '),
      rectangleCornerC: T('', 'Pnt '),
      rectangleCornerD: T('', 'Pnt '),
      compInfo: le,
      quiltWarp: T('', 'quiltWarp'),
      generatorSettings: le,
      crema: le,
      FrIn: le,
      blendOptions: le,
      FXRf: le,
      Lefx: le,
      time: le,
      animKey: le,
      timeScope: le,
      inTime: le,
      outTime: le,
      sheetStyle: le,
      translation: le,
      Skew: le,
      boundingBox: T('', 'boundingBox'),
      'Lnk ': T('', 'ExternalFileLink'),
      frameReader: T('', 'FrameReader'),
      effectParams: T('', 'motionTrackEffectParams'),
      Impr: T('None', 'none'),
      Anch: T('', 'Pnt '),
      'Fwd ': T('', 'Pnt '),
      'Bwd ': T('', 'Pnt '),
      FlrC: T('', 'Pnt '),
      meshBoundaryPath: T('', 'pathClass'),
      filterFX: T('', 'filterFXStyle'),
      Fltr: T('', 'rigidTransform'),
      FrgC: T('', 'RGBC'),
      BckC: T('', 'RGBC'),
      sdwM: T('Parameters', 'adaptCorrectTones'),
      hglM: T('Parameters', 'adaptCorrectTones'),
      customShape: T('', 'customShape'),
      origFXRefPoint: le,
      FXRefPoint: le,
      ClMg: T('', 'ClMg'),
    },
    Sf = {
      'Crv ': T('', 'CrPt'),
      Clrs: T('', 'Clrt'),
      Trns: T('', 'TrnS'),
      keyDescriptorList: le,
      solidFillMulti: T('', 'SoFi'),
      gradientFillMulti: T('', 'GrFl'),
      dropShadowMulti: T('', 'DrSh'),
      innerShadowMulti: T('', 'IrSh'),
      frameFXMulti: T('', 'FrFX'),
      FrIn: le,
      FSts: le,
      LaSt: le,
      sheetTimelineOptions: le,
      trackList: T('', 'animationTrack'),
      globalTrackList: T('', 'animationTrack'),
      keyList: le,
      audioClipGroupList: le,
      audioClipList: le,
      countObjectList: T('', 'countObject'),
      countGroupList: T('', 'countGroup'),
      slices: T('', 'slice'),
      'Pts ': T('', 'Pthp'),
      SbpL: T('', 'SbpL'),
      pathComponents: T('', 'PaCm'),
      filterFXList: T('', 'filterFX'),
      puppetShapeList: T('', 'puppetShape'),
      channelDenoise: T('', 'channelDenoiseParams'),
      ShrP: T('', 'Pnt '),
      layerSettings: le,
      list: le,
      Adjs: T('', 'CrvA'),
    },
    mf = {
      TEXT: [
        'Txt ',
        'printerName',
        'Nm  ',
        'Idnt',
        'blackAndWhitePresetFileName',
        'LUT3DFileName',
        'presetFileName',
        'curvesPresetFileName',
        'mixerPresetFileName',
        'placed',
        'description',
        'reason',
        'artboardPresetName',
        'json',
        'clipID',
        'relPath',
        'fullPath',
        'mediaDescriptor',
        'Msge',
        'altTag',
        'url',
        'cellText',
        'preset',
        'KnNm',
        'FPth',
        'comment',
        'originalPath',
      ],
      tdta: [
        'EngineData',
        'LUT3DFileData',
        'indexArray',
        'originalVertexArray',
        'deformedVertexArray',
        'LqMe',
      ],
      long: [
        'TextIndex',
        'RndS',
        'Mdpn',
        'Smth',
        'Lctn',
        'strokeStyleVersion',
        'LaID',
        'Vrsn',
        'Cnt ',
        'Brgh',
        'Cntr',
        'means',
        'vibrance',
        'Strt',
        'bwPresetKind',
        'comp',
        'compID',
        'originalCompID',
        'curvesPresetKind',
        'mixerPresetKind',
        'uOrder',
        'vOrder',
        'PgNm',
        'totalPages',
        'Crop',
        'numerator',
        'denominator',
        'frameCount',
        'Annt',
        'keyOriginType',
        'unitValueQuadVersion',
        'keyOriginIndex',
        'major',
        'minor',
        'fix',
        'docDefaultNewArtboardBackgroundType',
        'artboardBackgroundType',
        'numModifyingFX',
        'deformNumRows',
        'deformNumCols',
        'FrID',
        'FrDl',
        'FsID',
        'LCnt',
        'AFrm',
        'AFSt',
        'numBefore',
        'numAfter',
        'Spcn',
        'minOpacity',
        'maxOpacity',
        'BlnM',
        'sheetID',
        'gblA',
        'globalAltitude',
        'descVersion',
        'frameReaderType',
        'LyrI',
        'zoomOrigin',
        'fontSize',
        'Rds ',
        'sliceID',
        'topOutset',
        'leftOutset',
        'bottomOutset',
        'rightOutset',
        'filterID',
        'meshQuality',
        'meshExpansion',
        'meshRigidity',
        'VrsM',
        'VrsN',
        'NmbG',
        'WLMn',
        'WLMx',
        'AmMn',
        'AmMx',
        'SclH',
        'SclV',
        'Lvl ',
        'TlNm',
        'TlOf',
        'FlRs',
        'Thsh',
        'ShrS',
        'ShrE',
        'FlRs',
        'Vrnc',
        'Strg',
        'ExtS',
        'ExtD',
        'HrzS',
        'VrtS',
        'NmbR',
        'EdgF',
        'Ang1',
        'Ang2',
        'Ang3',
        'Ang4',
        'lastAppliedComp',
        'capturedInfo',
      ],
      enum: [
        'textGridding',
        'Ornt',
        'warpStyle',
        'warpRotate',
        'Inte',
        'Bltn',
        'ClrS',
        'BlrQ',
        'bvlT',
        'bvlS',
        'bvlD',
        'Md  ',
        'glwS',
        'GrdF',
        'GlwT',
        'RplS',
        'BlrM',
        'SmBM',
        'strokeStyleLineCapType',
        'strokeStyleLineJoinType',
        'strokeStyleLineAlignment',
        'strokeStyleBlendMode',
        'PntT',
        'Styl',
        'lookupType',
        'LUTFormat',
        'dataOrder',
        'tableOrder',
        'enableCompCore',
        'enableCompCoreGPU',
        'compCoreSupport',
        'compCoreGPUSupport',
        'Engn',
        'enableCompCoreThreads',
        'gs99',
        'FrDs',
        'trackID',
        'animInterpStyle',
        'horzAlign',
        'vertAlign',
        'bgColorType',
        'shapeOperation',
        'UndA',
        'Wvtp',
        'Drct',
        'WndM',
        'Edg ',
        'FlCl',
        'IntE',
        'IntC',
        'Cnvr',
        'Fl  ',
        'Dstr',
        'MztT',
        'Lns ',
        'ExtT',
        'DspM',
        'ExtR',
        'ZZTy',
        'SphM',
        'SmBQ',
        'placedLayerOCIOConversion',
        'gradientsInterpolationMethod',
      ],
      bool: [
        'PstS',
        'printSixteenBit',
        'masterFXSwitch',
        'enab',
        'uglg',
        'antialiasGloss',
        'useShape',
        'useTexture',
        'uglg',
        'antialiasGloss',
        'useShape',
        'Vsbl',
        'useTexture',
        'Algn',
        'Rvrs',
        'Dthr',
        'Invr',
        'VctC',
        'ShTr',
        'layerConceals',
        'strokeEnabled',
        'fillEnabled',
        'strokeStyleScaleLock',
        'strokeStyleStrokeAdjust',
        'hardProof',
        'MpBl',
        'paperWhite',
        'useLegacy',
        'Auto',
        'Lab ',
        'useTint',
        'keyShapeInvalidated',
        'autoExpandEnabled',
        'autoNestEnabled',
        'autoPositionEnabled',
        'shrinkwrapOnSaveEnabled',
        'present',
        'showInDialog',
        'overprint',
        'sheetDisclosed',
        'lightsDisclosed',
        'meshesDisclosed',
        'materialsDisclosed',
        'hasMotion',
        'muted',
        'Effc',
        'selected',
        'autoScope',
        'fillCanvas',
        'cellTextIsHTML',
        'Smoo',
        'Clsp',
        'validAtPosition',
        'rigidType',
        'hasoptions',
        'filterMaskEnable',
        'filterMaskLinked',
        'filterMaskExtendWithWhite',
        'removeJPEGArtifact',
        'Mnch',
        'ExtF',
        'ExtM',
        'moreAccurate',
        'GpuY',
        'LIWy',
        'Cnty',
      ],
      doub: [
        'warpValue',
        'warpPerspective',
        'warpPerspectiveOther',
        'Intr',
        'Wdth',
        'Hght',
        'strokeStyleMiterLimit',
        'strokeStyleResolution',
        'layerTime',
        'keyOriginResolution',
        'xx',
        'xy',
        'yx',
        'yy',
        'tx',
        'ty',
        'FrGA',
        'frameRate',
        'audioLevel',
        'rotation',
        'X   ',
        'Y   ',
        'redFloat',
        'greenFloat',
        'blueFloat',
        'imageResolution',
        'PuX0',
        'PuX1',
        'PuX2',
        'PuX3',
        'PuY0',
        'PuY1',
        'PuY2',
        'PuY3',
      ],
      UntF: [
        'sdwO',
        'hglO',
        'lagl',
        'Lald',
        'srgR',
        'blur',
        'Sftn',
        'Opct',
        'Dstn',
        'Angl',
        'Ckmt',
        'Nose',
        'Inpr',
        'ShdN',
        'strokeStyleLineWidth',
        'strokeStyleLineDashOffset',
        'strokeStyleOpacity',
        'H   ',
        'Top ',
        'Left',
        'Btom',
        'Rght',
        'Rslt',
        'topRight',
        'topLeft',
        'bottomLeft',
        'bottomRight',
        'ClNs',
        'Shrp',
      ],
      VlLs: [
        'Crv ',
        'Clrs',
        'Mnm ',
        'Mxm ',
        'Trns',
        'pathList',
        'strokeStyleLineDashSet',
        'FrLs',
        'slices',
        'LaSt',
        'Trnf',
        'nonAffineTransform',
        'keyDescriptorList',
        'guideIndeces',
        'gradientFillMulti',
        'solidFillMulti',
        'frameFXMulti',
        'innerShadowMulti',
        'dropShadowMulti',
        'FrIn',
        'FSts',
        'FsFr',
        'sheetTimelineOptions',
        'audioClipList',
        'trackList',
        'globalTrackList',
        'keyList',
        'audioClipList',
        'warpValues',
        'selectedPin',
        'Pts ',
        'SbpL',
        'pathComponents',
        'pinOffsets',
        'posFinalPins',
        'pinVertexIndices',
        'PinP',
        'PnRt',
        'PnOv',
        'PnDp',
        'filterFXList',
        'puppetShapeList',
        'ShrP',
        'channelDenoise',
        'Mtrx',
        'layerSettings',
        'list',
        'compList',
        'Adjs',
      ],
      ObAr: ['meshPoints', 'quiltSliceX', 'quiltSliceY'],
      'obj ': ['null', 'Chnl'],
      'Pth ': ['DspF'],
    },
    Fm = [
      'Rd  ',
      'Grn ',
      'Bl  ',
      'Yllw',
      'Ylw ',
      'Cyn ',
      'Mgnt',
      'Blck',
      'Gry ',
      'Lmnc',
      'A   ',
      'B   ',
    ],
    kf = {
      'Mnm ': 'long',
      'Mxm ': 'long',
      FrLs: 'long',
      strokeStyleLineDashSet: 'UntF',
      Trnf: 'doub',
      nonAffineTransform: 'doub',
      keyDescriptorList: 'Objc',
      gradientFillMulti: 'Objc',
      solidFillMulti: 'Objc',
      frameFXMulti: 'Objc',
      innerShadowMulti: 'Objc',
      dropShadowMulti: 'Objc',
      LaSt: 'Objc',
      FrIn: 'Objc',
      FSts: 'Objc',
      FsFr: 'long',
      blendOptions: 'Objc',
      sheetTimelineOptions: 'Objc',
      keyList: 'Objc',
      warpValues: 'doub',
      selectedPin: 'long',
      'Pts ': 'Objc',
      SbpL: 'Objc',
      pathComponents: 'Objc',
      pinOffsets: 'doub',
      posFinalPins: 'doub',
      pinVertexIndices: 'long',
      PinP: 'doub',
      PnRt: 'long',
      PnOv: 'bool',
      PnDp: 'doub',
      filterFXList: 'Objc',
      puppetShapeList: 'Objc',
      ShrP: 'Objc',
      channelDenoise: 'Objc',
      Mtrx: 'long',
      compList: 'long',
      Chnl: 'enum',
    },
    to = {};
  for (let e of Object.keys(mf)) for (let n of mf[e]) to[n] = e;
  for (let e of Object.keys(xf)) to[e] || (to[e] = 'Objc');
  for (let e of Object.keys(Sf)) kf[e] = 'Objc';
  function Em(e, n, t, i) {
    return e === 'presetKind'
      ? typeof n == 'string'
        ? 'enum'
        : 'long'
      : e === 'null' && t === 'slices'
        ? 'TEXT'
        : e === 'groupID'
          ? t === 'slices'
            ? 'long'
            : 'TEXT'
          : e === 'Sz  '
            ? 'Wdth' in n
              ? 'Objc'
              : 'units' in n
                ? 'UntF'
                : 'doub'
            : e === 'Type'
              ? typeof n == 'string'
                ? 'enum'
                : 'long'
              : e === 'AntA'
                ? typeof n == 'string'
                  ? 'enum'
                  : 'bool'
                : (e === 'Hrzn' || e === 'Vrtc') &&
                    (i.Type === 'keyType.Pstn' || i._classID === 'Ofst')
                  ? 'long'
                  : e === 'Hrzn' ||
                      e === 'Vrtc' ||
                      e === 'Top ' ||
                      e === 'Left' ||
                      e === 'Btom' ||
                      e === 'Rght'
                    ? t === 'slices'
                      ? 'long'
                      : typeof n == 'number'
                        ? 'doub'
                        : 'UntF'
                    : e === 'Vrsn'
                      ? typeof n == 'number'
                        ? 'long'
                        : 'Objc'
                      : e === 'Rd  ' || e === 'Grn ' || e === 'Bl  '
                        ? t === 'artd'
                          ? 'long'
                          : 'doub'
                        : e === 'Trnf'
                          ? Array.isArray(n)
                            ? 'VlLs'
                            : 'Objc'
                          : to[e];
  }
  function Lt(e) {
    let n = (0, ae.readInt32)(e);
    return (0, ae.readAsciiString)(e, n || 4);
  }
  function Wt(e, n) {
    if (n.length === 4 && n !== 'warp' && n !== 'time' && n !== 'hold' && n !== 'list')
      ((0, ce.writeInt32)(e, 0), (0, ce.writeSignature)(e, n));
    else {
      (0, ce.writeInt32)(e, n.length);
      for (let t = 0; t < n.length; t++) (0, ce.writeUint8)(e, n.charCodeAt(t));
    }
  }
  function Ha(e, n) {
    let t = Cn(e),
      i = n ? { _name: t.name, _classID: t.classID } : {},
      r = (0, ae.readUint32)(e);
    for (let o = 0; o < r; o++) {
      let a = Lt(e),
        s = (0, ae.readSignature)(e),
        c = Af(e, s, n);
      i[a] = c;
    }
    return i;
  }
  function Xa(e, n, t, i, r) {
    (Wi && !t && console.log('Missing classId for: ', n, t, i),
      (0, ce.writeUnicodeStringWithPadding)(e, n),
      Wt(e, t));
    let o = Object.keys(i),
      a = o.length;
    ('_name' in i && a--, '_classID' in i && a--, (0, ce.writeUint32)(e, a));
    for (let s of o) {
      if (s === '_name' || s === '_classID') continue;
      let c = Em(s, i[s], r, i),
        l = xf[s];
      (s === 'bounds' && r === 'text'
        ? (l = T('', 'bounds'))
        : s === 'origin'
          ? (c = r === 'slices' ? 'enum' : 'Objc')
          : (s === 'Cyn ' || s === 'Mgnt' || s === 'Ylw ' || s === 'Blck') && i._classID === 'CMYC'
            ? (c = 'doub')
            : /^PN[a-z][a-z]$/.test(s)
              ? (c = 'TEXT')
              : /^PT[a-z][a-z]$/.test(s)
                ? (c = 'long')
                : /^PF[a-z][a-z]$/.test(s) ||
                    ((s === 'Rds ' || s === 'Thsh') &&
                      typeof i[s] == 'number' &&
                      i._classID === 'SmrB')
                  ? (c = 'doub')
                  : s === 'ClSz' || s === 'Rds ' || s === 'Amnt'
                    ? (c = typeof i[s] == 'number' ? 'long' : 'UntF')
                    : ((s === 'sdwM' || s === 'hglM') && typeof i[s] == 'string') ||
                        (s === 'blur' && typeof i[s] == 'string')
                      ? (c = 'enum')
                      : (s === 'Hght' && typeof i[s] == 'number' && i._classID === 'Embs') ||
                          (s === 'Angl' &&
                            typeof i[s] == 'number' &&
                            (i._classID === 'Embs' ||
                              i._classID === 'smartSharpen' ||
                              i._classID === 'Twrl' ||
                              i._classID === 'MtnB'))
                        ? (c = 'long')
                        : s === 'Angl' && typeof i[s] == 'number'
                          ? (c = 'doub')
                          : s === 'bounds' && r === 'slices'
                            ? ((c = 'Objc'), (l = T('', 'Rct1')))
                            : s === 'Scl '
                              ? typeof i[s] == 'object' && 'Hrzn' in i[s]
                                ? ((c = 'Objc'), (l = le))
                                : typeof i[s] == 'number'
                                  ? (c = 'long')
                                  : (c = 'UntF')
                              : s === 'audioClipGroupList' && o.length === 1
                                ? (c = 'VlLs')
                                : (s === 'Strt' || s === 'Brgh') && 'H   ' in i
                                  ? (c = 'doub')
                                  : s === 'Wdth' && typeof i[s] == 'object'
                                    ? (c = 'UntF')
                                    : s === 'Ofst' && typeof i[s] == 'number'
                                      ? (c = 'long')
                                      : s === 'Strt' && typeof i[s] == 'object'
                                        ? ((c = 'Objc'), (l = le))
                                        : Fm.indexOf(s) !== -1
                                          ? (c = t === 'RGBC' && r !== 'artd' ? 'doub' : 'long')
                                          : s === 'profile'
                                            ? (c = t === 'printOutput' ? 'TEXT' : 'tdta')
                                            : s === 'strokeStyleContent'
                                              ? i[s]['Clr ']
                                                ? (l = T('', 'solidColorLayer'))
                                                : i[s].Grad
                                                  ? (l = T('', 'gradientLayer'))
                                                  : i[s].Ptrn
                                                    ? (l = T('', 'patternLayer'))
                                                    : Wi &&
                                                      console.log(
                                                        'Invalid strokeStyleContent value',
                                                        i[s]
                                                      )
                                              : s === 'bounds' &&
                                                r === 'quiltWarp' &&
                                                (l = T('', 'classFloatRect')),
        l && l.classID === 'RGBC' && 'H   ' in i[s] && (l = { classID: 'HSBC', name: '' }),
        Wt(e, s),
        (0, ce.writeSignature)(e, c || 'long'),
        If(e, c || 'long', i[s], s, l, r),
        Wi && !c && console.log(`Missing descriptor field type for: '${s}' in`, i));
    }
  }
  function Af(e, n, t) {
    switch (n) {
      case 'obj ':
        return Mm(e);
      case 'Objc':
      case 'GlbO':
        return Ha(e, t);
      case 'VlLs': {
        let i = (0, ae.readInt32)(e),
          r = [];
        for (let o = 0; o < i; o++) {
          let a = (0, ae.readSignature)(e);
          r.push(Af(e, a, t));
        }
        return r;
      }
      case 'doub':
        return (0, ae.readFloat64)(e);
      case 'UntF': {
        let i = (0, ae.readSignature)(e),
          r = (0, ae.readFloat64)(e);
        if (!Ki[i]) throw new Error(`Invalid units: ${i}`);
        return { units: Ki[i], value: r };
      }
      case 'UnFl': {
        let i = (0, ae.readSignature)(e),
          r = (0, ae.readFloat32)(e);
        if (!Ki[i]) throw new Error(`Invalid units: ${i}`);
        return { units: Ki[i], value: r };
      }
      case 'TEXT':
        return (0, ae.readUnicodeString)(e);
      case 'enum': {
        let i = Lt(e),
          r = Lt(e);
        return `${i}.${r}`;
      }
      case 'long':
        return (0, ae.readInt32)(e);
      case 'comp': {
        let i = (0, ae.readUint32)(e),
          r = (0, ae.readUint32)(e);
        return { low: i, high: r };
      }
      case 'bool':
        return !!(0, ae.readUint8)(e);
      case 'type':
      case 'GlbC':
        return Cn(e);
      case 'alis': {
        let i = (0, ae.readInt32)(e);
        return (0, ae.readAsciiString)(e, i);
      }
      case 'tdta': {
        let i = (0, ae.readInt32)(e);
        return (0, ae.readBytes)(e, i);
      }
      case 'ObAr': {
        ((0, ae.readInt32)(e), (0, ae.readUnicodeString)(e), Lt(e));
        let i = (0, ae.readInt32)(e),
          r = [];
        for (let o = 0; o < i; o++) {
          let a = Lt(e);
          ((0, ae.readSignature)(e), (0, ae.readSignature)(e));
          let s = (0, ae.readInt32)(e),
            c = [];
          for (let l = 0; l < s; l++) c.push((0, ae.readFloat64)(e));
          r.push({ type: a, values: c });
        }
        return r;
      }
      case 'Pth ': {
        (0, ae.readInt32)(e);
        let i = (0, ae.readSignature)(e);
        (0, ae.readInt32LE)(e);
        let r = (0, ae.readInt32LE)(e),
          o = (0, ae.readUnicodeStringWithLengthLE)(e, r);
        return { sig: i, path: o };
      }
      default:
        throw new Error(`Invalid TySh descriptor OSType: ${n} at ${e.offset.toString(16)}`);
    }
  }
  var Dm = { meshPoints: 'rationalPoint', quiltSliceX: 'UntF', quiltSliceY: 'UntF' };
  function If(e, n, t, i, r, o) {
    switch (n) {
      case 'obj ':
        Cm(e, i, t);
        break;
      case 'Objc':
      case 'GlbO': {
        if (typeof t != 'object')
          throw new Error(`Invalid struct value: ${JSON.stringify(t)}, key: ${i}`);
        if (!r) throw new Error(`Missing ext type for: '${i}' (${JSON.stringify(t)})`);
        let a = t._name || r.name,
          s = t._classID || r.classID;
        Xa(e, a, s, t, o);
        break;
      }
      case 'VlLs':
        if (!Array.isArray(t))
          throw new Error(`Invalid list value: ${JSON.stringify(t)}, key: ${i}`);
        (0, ce.writeInt32)(e, t.length);
        for (let a = 0; a < t.length; a++) {
          let s = kf[i];
          ((0, ce.writeSignature)(e, s || 'long'),
            If(e, s || 'long', t[a], `${i}[]`, Sf[i], o),
            Wi && !s && console.log(`Missing descriptor array type for: '${i}' in`, t));
        }
        break;
      case 'doub':
        if (typeof t != 'number')
          throw new Error(`Invalid number value: ${JSON.stringify(t)}, key: ${i}`);
        (0, ce.writeFloat64)(e, t);
        break;
      case 'UntF':
        if (!Jr[t.units]) throw new Error(`Invalid units: ${t.units} in ${i}`);
        ((0, ce.writeSignature)(e, Jr[t.units]), (0, ce.writeFloat64)(e, t.value));
        break;
      case 'UnFl':
        if (!Jr[t.units]) throw new Error(`Invalid units: ${t.units} in ${i}`);
        ((0, ce.writeSignature)(e, Jr[t.units]), (0, ce.writeFloat32)(e, t.value));
        break;
      case 'TEXT':
        (0, ce.writeUnicodeStringWithPadding)(e, t);
        break;
      case 'enum': {
        if (typeof t != 'string')
          throw new Error(`Invalid enum value: ${JSON.stringify(t)}, key: ${i}`);
        let [a, s] = t.split('.');
        (Wt(e, a), Wt(e, s));
        break;
      }
      case 'long':
        if (typeof t != 'number')
          throw new Error(`Invalid integer value: ${JSON.stringify(t)}, key: ${i}`);
        (0, ce.writeInt32)(e, t);
        break;
      case 'bool':
        if (typeof t != 'boolean')
          throw new Error(`Invalid boolean value: ${JSON.stringify(t)}, key: ${i}`);
        (0, ce.writeUint8)(e, t ? 1 : 0);
        break;
      case 'tdta':
        ((0, ce.writeInt32)(e, t.byteLength), (0, ce.writeBytes)(e, t));
        break;
      case 'ObAr': {
        ((0, ce.writeInt32)(e, 16), (0, ce.writeUnicodeStringWithPadding)(e, ''));
        let a = Dm[i];
        if (!a) throw new Error(`Not implemented ObArType for: ${i}`);
        (Wt(e, a), (0, ce.writeInt32)(e, t.length));
        for (let s = 0; s < t.length; s++) {
          (Wt(e, t[s].type),
            (0, ce.writeSignature)(e, 'UnFl'),
            (0, ce.writeSignature)(e, '#Pxl'),
            (0, ce.writeInt32)(e, t[s].values.length));
          for (let c = 0; c < t[s].values.length; c++) (0, ce.writeFloat64)(e, t[s].values[c]);
        }
        break;
      }
      case 'Pth ': {
        let a = 12 + t.path.length * 2;
        ((0, ce.writeInt32)(e, a),
          (0, ce.writeSignature)(e, t.sig),
          (0, ce.writeInt32LE)(e, a),
          (0, ce.writeInt32LE)(e, t.path.length),
          (0, ce.writeUnicodeStringWithoutLengthLE)(e, t.path));
        break;
      }
      default:
        throw new Error(`Not implemented descriptor OSType: ${n}`);
    }
  }
  function Mm(e) {
    let n = (0, ae.readInt32)(e),
      t = [];
    for (let i = 0; i < n; i++) {
      let r = (0, ae.readSignature)(e);
      switch (r) {
        case 'prop': {
          Cn(e);
          let o = Lt(e);
          t.push(o);
          break;
        }
        case 'Clss':
          t.push(Cn(e));
          break;
        case 'Enmr': {
          Cn(e);
          let o = Lt(e),
            a = Lt(e);
          t.push(`${o}.${a}`);
          break;
        }
        case 'rele': {
          (Cn(e), t.push((0, ae.readUint32)(e)));
          break;
        }
        case 'Idnt':
          t.push((0, ae.readInt32)(e));
          break;
        case 'indx':
          t.push((0, ae.readInt32)(e));
          break;
        case 'name': {
          (Cn(e), t.push((0, ae.readUnicodeString)(e)));
          break;
        }
        default:
          throw new Error(`Invalid descriptor reference type: ${r}`);
      }
    }
    return t;
  }
  function Cm(e, n, t) {
    (0, ce.writeInt32)(e, t.length);
    for (let i = 0; i < t.length; i++) {
      let r = t[i],
        o = 'unknown';
      switch (
        (typeof r == 'string' && (/^[a-z ]+\.[a-z ]+$/i.test(r) ? (o = 'Enmr') : (o = 'name')),
        (0, ce.writeSignature)(e, o),
        o)
      ) {
        case 'Enmr': {
          let [a, s] = r.split('.');
          (bf(e, '\0', a), Wt(e, a), Wt(e, s));
          break;
        }
        case 'name': {
          (bf(e, '\0', 'Lyr '), (0, ce.writeUnicodeString)(e, r + '\0'));
          break;
        }
        default:
          throw new Error(`Invalid descriptor reference type: ${o}`);
      }
    }
    return t;
  }
  function Cn(e) {
    let n = (0, ae.readUnicodeString)(e),
      t = Lt(e);
    return { name: n, classID: t };
  }
  function bf(e, n, t) {
    ((0, ce.writeUnicodeString)(e, n), Wt(e, t));
  }
  function Om(e, n = !1) {
    let t = (0, ae.readUint32)(e);
    if (t !== 16) throw new Error(`Invalid descriptor version: ${t}`);
    return Ha(e, n);
  }
  function Lm(e, n, t, i, r = '') {
    ((0, ce.writeUint32)(e, 16), Xa(e, n, t, i, r));
  }
  function Qr(e) {
    return { x: e.Hrzn, y: e.Vrtc };
  }
  function eo(e) {
    return { Hrzn: e.x, Vrtc: e.y };
  }
  function Um(e) {
    return { top: vt(e['Top ']), left: vt(e.Left), right: vt(e.Rght), bottom: vt(e.Btom) };
  }
  function Pm(e) {
    return {
      Left: Ut(e.left, 'bounds.left'),
      'Top ': Ut(e.top, 'bounds.top'),
      Rght: Ut(e.right, 'bounds.right'),
      Btom: Ut(e.bottom, 'bounds.bottom'),
    };
  }
  function yf(e) {
    let n = {
      enabled: !!e.enab,
      position: D.FStl.decode(e.Styl),
      fillType: D.FrFl.decode(e.PntT),
      blendMode: D.BlnM.decode(e['Md  ']),
      opacity: Oe(e.Opct),
      size: vt(e['Sz  ']),
    };
    return (
      e.present !== void 0 && (n.present = e.present),
      e.showInDialog !== void 0 && (n.showInDialog = e.showInDialog),
      e.overprint !== void 0 && (n.overprint = e.overprint),
      e['Clr '] && (n.color = On(e['Clr '])),
      e.Grad && (n.gradient = Cf(e)),
      e.Ptrn && (n.pattern = Of(e)),
      n
    );
  }
  function wf(e) {
    let n = {};
    return (
      (n.enab = !!e.enabled),
      e.present !== void 0 && (n.present = !!e.present),
      e.showInDialog !== void 0 && (n.showInDialog = !!e.showInDialog),
      (n.Styl = D.FStl.encode(e.position)),
      (n.PntT = D.FrFl.encode(e.fillType)),
      (n['Md  '] = D.BlnM.encode(e.blendMode)),
      (n.Opct = Te(e.opacity)),
      (n['Sz  '] = Ut(e.size, 'size')),
      e.color && (n['Clr '] = Ln(e.color)),
      e.gradient && (n = Object.assign(Object.assign({}, n), Lf(e.gradient))),
      e.pattern && (n = Object.assign(Object.assign({}, n), Uf(e.pattern))),
      e.overprint !== void 0 && (n.overprint = !!e.overprint),
      n
    );
  }
  function Ff(e, n, t) {
    var i, r, o;
    let a = t
        ? {
            'Scl ': Za((i = e.scale) !== null && i !== void 0 ? i : 1),
            masterFXSwitch: !e.disabled,
          }
        : {
            masterFXSwitch: !e.disabled,
            'Scl ': Za((r = e.scale) !== null && r !== void 0 ? r : 1),
          },
      s = ['dropShadow', 'innerShadow', 'solidFill', 'gradientOverlay', 'stroke'];
    for (let f of s) if (e[f] && !Array.isArray(e[f])) throw new Error(`${f} should be an array`);
    let c = f => !!f && f.length > 1 && t,
      l = f => !!f && f.length >= 1 && (!t || f.length === 1);
    if (
      (l(e.dropShadow) && (a.DrSh = tt(e.dropShadow[0], 'dropShadow', n)),
      c(e.dropShadow) && (a.dropShadowMulti = e.dropShadow.map(f => tt(f, 'dropShadow', n))),
      l(e.innerShadow) && (a.IrSh = tt(e.innerShadow[0], 'innerShadow', n)),
      c(e.innerShadow) && (a.innerShadowMulti = e.innerShadow.map(f => tt(f, 'innerShadow', n))),
      e.outerGlow && (a.OrGl = tt(e.outerGlow, 'outerGlow', n)),
      c(e.solidFill) && (a.solidFillMulti = e.solidFill.map(f => tt(f, 'solidFill', n))),
      c(e.gradientOverlay) &&
        (a.gradientFillMulti = e.gradientOverlay.map(f => tt(f, 'gradientOverlay', n))),
      c(e.stroke) && (a.frameFXMulti = e.stroke.map(f => wf(f))),
      e.innerGlow && (a.IrGl = tt(e.innerGlow, 'innerGlow', n)),
      e.bevel && (a.ebbl = tt(e.bevel, 'bevel', n)),
      l(e.solidFill) && (a.SoFi = tt(e.solidFill[0], 'solidFill', n)),
      e.patternOverlay && (a.patternFill = tt(e.patternOverlay, 'patternOverlay', n)),
      l(e.gradientOverlay) && (a.GrFl = tt(e.gradientOverlay[0], 'gradientOverlay', n)),
      e.satin && (a.ChFX = tt(e.satin, 'satin', n)),
      l(e.stroke) && (a.FrFX = wf((o = e.stroke) === null || o === void 0 ? void 0 : o[0])),
      t)
    ) {
      a.numModifyingFX = 0;
      for (let f of Object.keys(e)) {
        let d = e[f];
        if (Array.isArray(d)) for (let u of d) u.enabled && a.numModifyingFX++;
        else d.enabled && a.numModifyingFX++;
      }
    }
    return a;
  }
  function Ef(e, n) {
    let t = {},
      {
        masterFXSwitch: i,
        DrSh: r,
        dropShadowMulti: o,
        IrSh: a,
        innerShadowMulti: s,
        OrGl: c,
        IrGl: l,
        ebbl: f,
        SoFi: d,
        solidFillMulti: u,
        patternFill: h,
        GrFl: p,
        gradientFillMulti: _,
        ChFX: b,
        FrFX: g,
        frameFXMulti: y,
        numModifyingFX: w,
      } = e,
      m = km(e, [
        'masterFXSwitch',
        'DrSh',
        'dropShadowMulti',
        'IrSh',
        'innerShadowMulti',
        'OrGl',
        'IrGl',
        'ebbl',
        'SoFi',
        'solidFillMulti',
        'patternFill',
        'GrFl',
        'gradientFillMulti',
        'ChFX',
        'FrFX',
        'frameFXMulti',
        'numModifyingFX',
      ]);
    return (
      i || (t.disabled = !0),
      e['Scl '] && (t.scale = Oe(e['Scl '])),
      r && (t.dropShadow = [et(r, n)]),
      o && (t.dropShadow = o.map(A => et(A, n))),
      a && (t.innerShadow = [et(a, n)]),
      s && (t.innerShadow = s.map(A => et(A, n))),
      c && (t.outerGlow = et(c, n)),
      l && (t.innerGlow = et(l, n)),
      f && (t.bevel = et(f, n)),
      d && (t.solidFill = [et(d, n)]),
      u && (t.solidFill = u.map(A => et(A, n))),
      h && (t.patternOverlay = et(h, n)),
      p && (t.gradientOverlay = [et(p, n)]),
      _ && (t.gradientOverlay = _.map(A => et(A, n))),
      b && (t.satin = et(b, n)),
      g && (t.stroke = [yf(g)]),
      y && (t.stroke = y.map(A => yf(A))),
      n && Object.keys(m).length > 1 && console.log('Unhandled effect keys:', m),
      t
    );
  }
  function _f(e, n) {
    let t = [];
    for (let i = 0; i < e.length; i++) {
      let r = e[i],
        {
          time: { denominator: o, numerator: a },
          selected: s,
          animKey: c,
        } = r,
        l = { numerator: a, denominator: o },
        f = D.animInterpStyleEnum.decode(r.animInterpStyle);
      switch (c.Type) {
        case 'keyType.Opct':
          t.push({ interpolation: f, time: l, selected: s, type: 'opacity', value: Oe(c.Opct) });
          break;
        case 'keyType.Pstn':
          t.push({
            interpolation: f,
            time: l,
            selected: s,
            type: 'position',
            x: c.Hrzn,
            y: c.Vrtc,
          });
          break;
        case 'keyType.Trnf':
          t.push({
            interpolation: f,
            time: l,
            selected: s,
            type: 'transform',
            scale: Qr(c['Scl ']),
            skew: Qr(c.Skew),
            rotation: c.rotation,
            translation: Qr(c.translation),
          });
          break;
        case 'keyType.sheetStyle': {
          let d = { interpolation: f, time: l, selected: s, type: 'style' };
          (c.sheetStyle.Lefx && (d.style = Ef(c.sheetStyle.Lefx, n)), t.push(d));
          break;
        }
        case 'keyType.globalLighting': {
          t.push({
            interpolation: f,
            time: l,
            selected: s,
            type: 'globalLighting',
            globalAngle: c.gblA,
            globalAltitude: c.globalAltitude,
          });
          break;
        }
        default:
          throw new Error('Unsupported keyType value');
      }
    }
    return t;
  }
  function vf(e) {
    let n = [];
    for (let t = 0; t < e.length; t++) {
      let i = e[t],
        { time: r, selected: o = !1, interpolation: a } = i,
        s = D.animInterpStyleEnum.encode(a),
        c;
      switch (i.type) {
        case 'opacity':
          c = { Type: 'keyType.Opct', Opct: Te(i.value) };
          break;
        case 'position':
          c = { Type: 'keyType.Pstn', Hrzn: i.x, Vrtc: i.y };
          break;
        case 'transform':
          c = {
            Type: 'keyType.Trnf',
            'Scl ': eo(i.scale),
            Skew: eo(i.skew),
            rotation: i.rotation,
            translation: eo(i.translation),
          };
          break;
        case 'style':
          ((c = { Type: 'keyType.sheetStyle', sheetStyle: { Vrsn: 1, blendOptions: {} } }),
            i.style && (c.sheetStyle = { Vrsn: 1, Lefx: Ff(i.style, !1, !1), blendOptions: {} }));
          break;
        case 'globalLighting': {
          c = {
            Type: 'keyType.globalLighting',
            gblA: i.globalAngle,
            globalAltitude: i.globalAltitude,
          };
          break;
        }
        default:
          throw new Error('Unsupported keyType value');
      }
      n.push({ Vrsn: 1, animInterpStyle: s, time: r, animKey: c, selected: o });
    }
    return n;
  }
  function Tm(e, n) {
    let t = [];
    for (let i = 0; i < e.length; i++) {
      let r = e[i],
        o = { type: D.stdTrackID.decode(r.trackID), enabled: r.enab, keys: _f(r.keyList, n) };
      (r.effectParams &&
        (o.effectParams = {
          fillCanvas: r.effectParams.fillCanvas,
          zoomOrigin: r.effectParams.zoomOrigin,
          keys: _f(r.effectParams.keyList, n),
        }),
        t.push(o));
    }
    return t;
  }
  function Rm(e) {
    let n = [];
    for (let t = 0; t < e.length; t++) {
      let i = e[t];
      n.push(
        Object.assign(
          Object.assign(
            {
              trackID: D.stdTrackID.encode(i.type),
              Vrsn: 1,
              enab: !!i.enabled,
              Effc: !!i.effectParams,
            },
            i.effectParams
              ? {
                  effectParams: {
                    keyList: vf(i.keys),
                    fillCanvas: i.effectParams.fillCanvas,
                    zoomOrigin: i.effectParams.zoomOrigin,
                  },
                }
              : {}
          ),
          { keyList: vf(i.keys) }
        )
      );
    }
    return n;
  }
  function et(e, n) {
    let t = {};
    for (let i of Object.keys(e)) {
      let r = e[i];
      switch (i) {
        case 'enab':
          t.enabled = !!r;
          break;
        case 'uglg':
          t.useGlobalLight = !!r;
          break;
        case 'AntA':
          t.antialiased = !!r;
          break;
        case 'Algn':
          t.align = !!r;
          break;
        case 'Dthr':
          t.dither = !!r;
          break;
        case 'Invr':
          t.invert = !!r;
          break;
        case 'Rvrs':
          t.reverse = !!r;
          break;
        case 'Clr ':
          t.color = On(r);
          break;
        case 'hglC':
          t.highlightColor = On(r);
          break;
        case 'sdwC':
          t.shadowColor = On(r);
          break;
        case 'Styl':
          t.position = D.FStl.decode(r);
          break;
        case 'Md  ':
          t.blendMode = D.BlnM.decode(r);
          break;
        case 'hglM':
          t.highlightBlendMode = D.BlnM.decode(r);
          break;
        case 'sdwM':
          t.shadowBlendMode = D.BlnM.decode(r);
          break;
        case 'bvlS':
          t.style = D.BESl.decode(r);
          break;
        case 'bvlD':
          t.direction = D.BESs.decode(r);
          break;
        case 'bvlT':
          t.technique = D.bvlT.decode(r);
          break;
        case 'GlwT':
          t.technique = D.BETE.decode(r);
          break;
        case 'glwS':
          t.source = D.IGSr.decode(r);
          break;
        case 'Type':
          t.type = D.GrdT.decode(r);
          break;
        case 'gs99':
          t.interpolationMethod = D.gradientInterpolationMethodType.decode(r);
          break;
        case 'Opct':
          t.opacity = Oe(r);
          break;
        case 'hglO':
          t.highlightOpacity = Oe(r);
          break;
        case 'sdwO':
          t.shadowOpacity = Oe(r);
          break;
        case 'lagl':
          t.angle = Yi(r);
          break;
        case 'Angl':
          t.angle = Yi(r);
          break;
        case 'Lald':
          t.altitude = Yi(r);
          break;
        case 'Sftn':
          t.soften = vt(r);
          break;
        case 'srgR':
          t.strength = Oe(r);
          break;
        case 'blur':
          t.size = vt(r);
          break;
        case 'Nose':
          t.noise = Oe(r);
          break;
        case 'Inpr':
          t.range = Oe(r);
          break;
        case 'Ckmt':
          t.choke = vt(r);
          break;
        case 'ShdN':
          t.jitter = Oe(r);
          break;
        case 'Dstn':
          t.distance = vt(r);
          break;
        case 'Scl ':
          t.scale = Oe(r);
          break;
        case 'Ptrn':
          t.pattern = { name: r['Nm  '], id: r.Idnt };
          break;
        case 'phase':
          t.phase = { x: r.Hrzn, y: r.Vrtc };
          break;
        case 'Ofst':
          t.offset = { x: Oe(r.Hrzn), y: Oe(r.Vrtc) };
          break;
        case 'MpgS':
        case 'TrnS':
          t.contour = { name: r['Nm  '], curve: r['Crv '].map(o => ({ x: o.Hrzn, y: o.Vrtc })) };
          break;
        case 'Grad':
          t.gradient = Df(r);
          break;
        case 'useTexture':
        case 'useShape':
        case 'layerConceals':
        case 'present':
        case 'showInDialog':
        case 'antialiasGloss':
          t[i] = r;
          break;
        case '_name':
        case '_classID':
          break;
        default:
          n && console.log(`Invalid effect key: '${i}', value:`, r);
      }
    }
    return t;
  }
  function tt(e, n, t) {
    let i = { enab: !1 };
    n === 'dropShadow' && (i.TrnS = { 'Nm  ': '', 'Crv ': [] });
    for (let r of Object.keys(e)) {
      let o = r,
        a = e[o];
      switch (o) {
        case 'enabled':
          i.enab = !!a;
          break;
        case 'useGlobalLight':
          i.uglg = !!a;
          break;
        case 'antialiased':
          i.AntA = !!a;
          break;
        case 'align':
          i.Algn = !!a;
          break;
        case 'dither':
          i.Dthr = !!a;
          break;
        case 'invert':
          i.Invr = !!a;
          break;
        case 'reverse':
          i.Rvrs = !!a;
          break;
        case 'color':
          i['Clr '] = Ln(a);
          break;
        case 'highlightColor':
          i.hglC = Ln(a);
          break;
        case 'shadowColor':
          i.sdwC = Ln(a);
          break;
        case 'position':
          i.Styl = D.FStl.encode(a);
          break;
        case 'blendMode':
          i['Md  '] = D.BlnM.encode(a);
          break;
        case 'highlightBlendMode':
          i.hglM = D.BlnM.encode(a);
          break;
        case 'shadowBlendMode':
          i.sdwM = D.BlnM.encode(a);
          break;
        case 'style':
          i.bvlS = D.BESl.encode(a);
          break;
        case 'direction':
          i.bvlD = D.BESs.encode(a);
          break;
        case 'technique':
          n === 'bevel' ? (i.bvlT = D.bvlT.encode(a)) : (i.GlwT = D.BETE.encode(a));
          break;
        case 'source':
          i.glwS = D.IGSr.encode(a);
          break;
        case 'type':
          i.Type = D.GrdT.encode(a);
          break;
        case 'interpolationMethod':
          i.gs99 = D.gradientInterpolationMethodType.encode(a);
          break;
        case 'opacity':
          i.Opct = Te(a);
          break;
        case 'highlightOpacity':
          i.hglO = Te(a);
          break;
        case 'shadowOpacity':
          i.sdwO = Te(a);
          break;
        case 'angle':
          n === 'gradientOverlay' || n === 'patternFill' ? (i.Angl = si(a)) : (i.lagl = si(a));
          break;
        case 'altitude':
          i.Lald = si(a);
          break;
        case 'soften':
          i.Sftn = Ut(a, o);
          break;
        case 'strength':
          i.srgR = Te(a);
          break;
        case 'size':
          i.blur = Ut(a, o);
          break;
        case 'noise':
          i.Nose = Te(a);
          break;
        case 'range':
          i.Inpr = Te(a);
          break;
        case 'choke':
          i.Ckmt = Ut(a, o);
          break;
        case 'jitter':
          i.ShdN = Te(a);
          break;
        case 'distance':
          i.Dstn = Ut(a, o);
          break;
        case 'scale':
          i['Scl '] = Te(a);
          break;
        case 'pattern':
          i.Ptrn = { 'Nm  ': a.name, Idnt: a.id };
          break;
        case 'phase':
          i.phase = { Hrzn: a.x, Vrtc: a.y };
          break;
        case 'offset':
          i.Ofst = { Hrzn: Te(a.x), Vrtc: Te(a.y) };
          break;
        case 'contour': {
          i[n === 'satin' ? 'MpgS' : 'TrnS'] = {
            'Nm  ': a.name,
            'Crv ': a.curve.map(s => ({ Hrzn: s.x, Vrtc: s.y })),
          };
          break;
        }
        case 'gradient':
          i.Grad = Mf(a);
          break;
        case 'useTexture':
        case 'useShape':
        case 'layerConceals':
        case 'present':
        case 'showInDialog':
        case 'antialiasGloss':
          i[o] = a;
          break;
        default:
          t && console.log(`Invalid effect key: '${o}', value:`, a);
      }
    }
    return i;
  }
  function Df(e) {
    if (e.GrdF === 'GrdF.CstS') {
      let n = e.Intr || 4096;
      return {
        type: 'solid',
        name: e['Nm  '],
        smoothness: e.Intr / 4096,
        colorStops: e.Clrs.map(t => ({
          color: On(t['Clr ']),
          location: t.Lctn / n,
          midpoint: t.Mdpn / 100,
        })),
        opacityStops: e.Trns.map(t => ({
          opacity: Oe(t.Opct),
          location: t.Lctn / n,
          midpoint: t.Mdpn / 100,
        })),
      };
    } else
      return {
        type: 'noise',
        name: e['Nm  '],
        roughness: e.Smth / 4096,
        colorModel: D.ClrS.decode(e.ClrS),
        randomSeed: e.RndS,
        restrictColors: !!e.VctC,
        addTransparency: !!e.ShTr,
        min: e['Mnm '].map(n => n / 100),
        max: e['Mxm '].map(n => n / 100),
      };
  }
  function Mf(e) {
    var n, t;
    if (e.type === 'solid') {
      let i = Math.round(((n = e.smoothness) !== null && n !== void 0 ? n : 1) * 4096);
      return {
        'Nm  ': e.name || '',
        GrdF: 'GrdF.CstS',
        Intr: i,
        Clrs: e.colorStops.map(r => {
          var o;
          return {
            'Clr ': Ln(r.color),
            Type: 'Clry.UsrS',
            Lctn: Math.round(r.location * i),
            Mdpn: Math.round(((o = r.midpoint) !== null && o !== void 0 ? o : 0.5) * 100),
          };
        }),
        Trns: e.opacityStops.map(r => {
          var o;
          return {
            Opct: Te(r.opacity),
            Lctn: Math.round(r.location * i),
            Mdpn: Math.round(((o = r.midpoint) !== null && o !== void 0 ? o : 0.5) * 100),
          };
        }),
      };
    } else
      return {
        GrdF: 'GrdF.ClNs',
        'Nm  ': e.name || '',
        ShTr: !!e.addTransparency,
        VctC: !!e.restrictColors,
        ClrS: D.ClrS.encode(e.colorModel),
        RndS: e.randomSeed || 0,
        Smth: Math.round(((t = e.roughness) !== null && t !== void 0 ? t : 1) * 4096),
        'Mnm ': (e.min || [0, 0, 0, 0]).map(i => i * 100),
        'Mxm ': (e.max || [1, 1, 1, 1]).map(i => i * 100),
      };
  }
  function Cf(e) {
    let n = Df(e.Grad);
    return (
      (n.style = D.GrdT.decode(e.Type)),
      e.Dthr !== void 0 && (n.dither = e.Dthr),
      e.gradientsInterpolationMethod !== void 0 &&
        (n.interpolationMethod = D.gradientInterpolationMethodType.decode(
          e.gradientsInterpolationMethod
        )),
      e.Rvrs !== void 0 && (n.reverse = e.Rvrs),
      e.Angl !== void 0 && (n.angle = Yi(e.Angl)),
      e['Scl '] !== void 0 && (n.scale = Oe(e['Scl '])),
      e.Algn !== void 0 && (n.align = e.Algn),
      e.Ofst !== void 0 && (n.offset = { x: Oe(e.Ofst.Hrzn), y: Oe(e.Ofst.Vrtc) }),
      n
    );
  }
  function Of(e) {
    let n = { name: e.Ptrn['Nm  '], id: e.Ptrn.Idnt };
    return (
      e.Lnkd !== void 0 && (n.linked = e.Lnkd),
      e.phase !== void 0 && (n.phase = { x: e.phase.Hrzn, y: e.phase.Vrtc }),
      n
    );
  }
  function Bm(e) {
    if ('Grad' in e) return Cf(e);
    if ('Ptrn' in e) return Object.assign({ type: 'pattern' }, Of(e));
    if ('Clr ' in e) return { type: 'color', color: On(e['Clr ']) };
    throw new Error('Invalid vector content');
  }
  function Lf(e) {
    let n = {};
    return (
      e.dither !== void 0 && (n.Dthr = e.dither),
      e.interpolationMethod !== void 0 &&
        (n.gradientsInterpolationMethod = D.gradientInterpolationMethodType.encode(
          e.interpolationMethod
        )),
      e.reverse !== void 0 && (n.Rvrs = e.reverse),
      e.angle !== void 0 && (n.Angl = si(e.angle)),
      (n.Type = D.GrdT.encode(e.style)),
      e.align !== void 0 && (n.Algn = e.align),
      e.scale !== void 0 && (n['Scl '] = Te(e.scale)),
      e.offset && (n.Ofst = { Hrzn: Te(e.offset.x), Vrtc: Te(e.offset.y) }),
      (n.Grad = Mf(e)),
      n
    );
  }
  function Uf(e) {
    let n = { Ptrn: { 'Nm  ': e.name || '', Idnt: e.id || '' } };
    return (
      e.linked !== void 0 && (n.Lnkd = !!e.linked),
      e.phase !== void 0 && (n.phase = { Hrzn: e.phase.x, Vrtc: e.phase.y }),
      n
    );
  }
  function zm(e) {
    return e.type === 'color'
      ? { key: 'SoCo', descriptor: { 'Clr ': Ln(e.color) } }
      : e.type === 'pattern'
        ? { key: 'PtFl', descriptor: Uf(e) }
        : { key: 'GdFl', descriptor: Lf(e) };
  }
  function On(e) {
    if ('H   ' in e) return { h: Pf(e['H   ']), s: e.Strt, b: e.Brgh };
    if ('Rd  ' in e) return { r: e['Rd  '], g: e['Grn '], b: e['Bl  '] };
    if ('Cyn ' in e) return { c: e['Cyn '], m: e.Mgnt, y: e['Ylw '], k: e.Blck };
    if ('Gry ' in e) return { k: e['Gry '] };
    if ('Lmnc' in e) return { l: e.Lmnc, a: e['A   '], b: e['B   '] };
    if ('redFloat' in e) return { fr: e.redFloat, fg: e.greenFloat, fb: e.blueFloat };
    throw new Error('Unsupported color descriptor');
  }
  function Ln(e) {
    if (e) {
      if ('r' in e)
        return {
          _name: '',
          _classID: 'RGBC',
          'Rd  ': e.r || 0,
          'Grn ': e.g || 0,
          'Bl  ': e.b || 0,
        };
      if ('fr' in e)
        return { _name: '', _classID: 'RGBC', redFloat: e.fr, greenFloat: e.fg, blueFloat: e.fb };
      if ('h' in e)
        return {
          _name: '',
          _classID: 'HSBC',
          'H   ': si(e.h * 360),
          Strt: e.s || 0,
          Brgh: e.b || 0,
        };
      if ('c' in e)
        return {
          _name: '',
          _classID: 'CMYC',
          'Cyn ': e.c || 0,
          Mgnt: e.m || 0,
          'Ylw ': e.y || 0,
          Blck: e.k || 0,
        };
      if ('l' in e)
        return { _name: '', _classID: 'LABC', Lmnc: e.l || 0, 'A   ': e.a || 0, 'B   ': e.b || 0 };
      if ('k' in e) return { _name: '', _classID: 'GRYC', 'Gry ': e.k };
      throw new Error('Invalid color value');
    } else return { _name: '', _classID: 'RGBC', 'Rd  ': 0, 'Grn ': 0, 'Bl  ': 0 };
  }
  function Yi(e) {
    if (e === void 0) return 0;
    if (e.units !== 'Angle') throw new Error(`Invalid units: ${e.units}`);
    return e.value;
  }
  function Oe(e) {
    if (e === void 0) return 1;
    if (e.units !== 'Percent') throw new Error(`Invalid units: ${e.units}`);
    return e.value / 100;
  }
  function Pf(e) {
    if (e === void 0) return 1;
    if (e.units === 'Percent') return e.value / 100;
    if (e.units === 'Angle') return e.value / 360;
    throw new Error(`Invalid units: ${e.units}`);
  }
  function vt({ units: e, value: n }) {
    if (
      e !== 'Pixels' &&
      e !== 'Millimeters' &&
      e !== 'Points' &&
      e !== 'None' &&
      e !== 'Picas' &&
      e !== 'Inches' &&
      e !== 'Centimeters' &&
      e !== 'Density'
    )
      throw new Error(`Invalid units: ${JSON.stringify({ units: e, value: n })}`);
    return { value: n, units: e };
  }
  function Nm(e, n = 'Pixels') {
    return typeof e == 'number' ? { value: e, units: n } : vt(e);
  }
  function jm({ units: e, value: n }, t) {
    if (e !== t) throw new Error(`Invalid units: ${JSON.stringify({ units: e, value: n })}`);
    return n;
  }
  function si(e) {
    return { units: 'Angle', value: e || 0 };
  }
  function Te(e) {
    return { units: 'Percent', value: Math.round((e || 0) * 100) };
  }
  function Za(e) {
    return { units: 'Percent', value: (e || 0) * 100 };
  }
  function Ut(e, n) {
    if (e == null) return { units: 'Pixels', value: 0 };
    if (typeof e != 'object')
      throw new Error(
        `Invalid value: ${JSON.stringify(e)} (key: ${n}) (should have value and units)`
      );
    let { units: t, value: i } = e;
    if (typeof i != 'number') throw new Error(`Invalid value in ${JSON.stringify(e)} (key: ${n})`);
    if (
      t !== 'Pixels' &&
      t !== 'Millimeters' &&
      t !== 'Points' &&
      t !== 'None' &&
      t !== 'Picas' &&
      t !== 'Inches' &&
      t !== 'Centimeters' &&
      t !== 'Density'
    )
      throw new Error(`Invalid units in ${JSON.stringify(e)} (key: ${n})`);
    return { units: t, value: i };
  }
  function Vm({ numerator: e, denominator: n }) {
    return { numerator: e, denominator: n };
  }
  D.textGridding = (0, W.createEnum)('textGridding', 'none', { none: 'None', round: 'Rnd ' });
  D.Ornt = (0, W.createEnum)('Ornt', 'horizontal', { horizontal: 'Hrzn', vertical: 'Vrtc' });
  D.Annt = (0, W.createEnum)('Annt', 'sharp', {
    none: 'Anno',
    sharp: 'antiAliasSharp',
    crisp: 'AnCr',
    strong: 'AnSt',
    smooth: 'AnSm',
    platform: 'antiAliasPlatformGray',
    platformLCD: 'antiAliasPlatformLCD',
  });
  D.warpStyle = (0, W.createEnum)('warpStyle', 'none', {
    none: 'warpNone',
    arc: 'warpArc',
    arcLower: 'warpArcLower',
    arcUpper: 'warpArcUpper',
    arch: 'warpArch',
    bulge: 'warpBulge',
    shellLower: 'warpShellLower',
    shellUpper: 'warpShellUpper',
    flag: 'warpFlag',
    wave: 'warpWave',
    fish: 'warpFish',
    rise: 'warpRise',
    fisheye: 'warpFisheye',
    inflate: 'warpInflate',
    squeeze: 'warpSqueeze',
    twist: 'warpTwist',
    cylinder: 'warpCylinder',
    custom: 'warpCustom',
  });
  D.BlnM = (0, W.createEnum)('BlnM', 'normal', {
    normal: 'Nrml',
    dissolve: 'Dslv',
    darken: 'Drkn',
    multiply: 'Mltp',
    'color burn': 'CBrn',
    'linear burn': 'linearBurn',
    'darker color': 'darkerColor',
    lighten: 'Lghn',
    screen: 'Scrn',
    'color dodge': 'CDdg',
    'linear dodge': 'linearDodge',
    'lighter color': 'lighterColor',
    overlay: 'Ovrl',
    'soft light': 'SftL',
    'hard light': 'HrdL',
    'vivid light': 'vividLight',
    'linear light': 'linearLight',
    'pin light': 'pinLight',
    'hard mix': 'hardMix',
    difference: 'Dfrn',
    exclusion: 'Xclu',
    subtract: 'blendSubtraction',
    divide: 'blendDivide',
    hue: 'H   ',
    saturation: 'Strt',
    color: 'Clr ',
    luminosity: 'Lmns',
    'linear height': 'linearHeight',
    height: 'Hght',
    subtraction: 'Sbtr',
    'pass through': '????',
  });
  D.BESl = (0, W.createEnum)('BESl', 'inner bevel', {
    'inner bevel': 'InrB',
    'outer bevel': 'OtrB',
    emboss: 'Embs',
    'pillow emboss': 'PlEb',
    'stroke emboss': 'strokeEmboss',
  });
  D.bvlT = (0, W.createEnum)('bvlT', 'smooth', {
    smooth: 'SfBL',
    'chisel hard': 'PrBL',
    'chisel soft': 'Slmt',
  });
  D.BESs = (0, W.createEnum)('BESs', 'up', { up: 'In  ', down: 'Out ' });
  D.BETE = (0, W.createEnum)('BETE', 'softer', { softer: 'SfBL', precise: 'PrBL' });
  D.IGSr = (0, W.createEnum)('IGSr', 'edge', { edge: 'SrcE', center: 'SrcC' });
  D.GrdT = (0, W.createEnum)('GrdT', 'linear', {
    linear: 'Lnr ',
    radial: 'Rdl ',
    angle: 'Angl',
    reflected: 'Rflc',
    diamond: 'Dmnd',
  });
  D.animInterpStyleEnum = (0, W.createEnum)('animInterpStyle', 'linear', {
    linear: 'Lnr ',
    hold: 'hold',
  });
  D.stdTrackID = (0, W.createEnum)('stdTrackID', 'opacity', {
    opacity: 'opacityTrack',
    style: 'styleTrack',
    sheetTransform: 'sheetTransformTrack',
    sheetPosition: 'sheetPositionTrack',
    globalLighting: 'globalLightingTrack',
  });
  D.gradientInterpolationMethodType = (0, W.createEnum)(
    'gradientInterpolationMethodType',
    'perceptual',
    { perceptual: 'Perc', linear: 'Lnr ', classic: 'Gcls', smooth: 'Smoo' }
  );
  D.ClrS = (0, W.createEnum)('ClrS', 'rgb', { rgb: 'RGBC', hsb: 'HSBl', lab: 'LbCl', hsl: 'HSLC' });
  D.FStl = (0, W.createEnum)('FStl', 'outside', {
    outside: 'OutF',
    center: 'CtrF',
    inside: 'InsF',
  });
  D.FrFl = (0, W.createEnum)('FrFl', 'color', { color: 'SClr', gradient: 'GrFl', pattern: 'Ptrn' });
  D.ESliceType = (0, W.createEnum)('ESliceType', 'image', { image: 'Img ', noImage: 'noImage' });
  D.ESliceHorzAlign = (0, W.createEnum)('ESliceHorzAlign', 'default', { default: 'default' });
  D.ESliceVertAlign = (0, W.createEnum)('ESliceVertAlign', 'default', { default: 'default' });
  D.ESliceOrigin = (0, W.createEnum)('ESliceOrigin', 'userGenerated', {
    userGenerated: 'userGenerated',
    autoGenerated: 'autoGenerated',
    layer: 'layer',
  });
  D.ESliceBGColorType = (0, W.createEnum)('ESliceBGColorType', 'none', {
    none: 'None',
    matte: 'matte',
    color: 'Clr ',
  });
  D.strokeStyleLineCapType = (0, W.createEnum)('strokeStyleLineCapType', 'butt', {
    butt: 'strokeStyleButtCap',
    round: 'strokeStyleRoundCap',
    square: 'strokeStyleSquareCap',
  });
  D.strokeStyleLineJoinType = (0, W.createEnum)('strokeStyleLineJoinType', 'miter', {
    miter: 'strokeStyleMiterJoin',
    round: 'strokeStyleRoundJoin',
    bevel: 'strokeStyleBevelJoin',
  });
  D.strokeStyleLineAlignment = (0, W.createEnum)('strokeStyleLineAlignment', 'inside', {
    inside: 'strokeStyleAlignInside',
    center: 'strokeStyleAlignCenter',
    outside: 'strokeStyleAlignOutside',
  });
  D.BlrM = (0, W.createEnum)('BlrM', 'spin', { spin: 'Spn ', zoom: 'Zm  ' });
  D.BlrQ = (0, W.createEnum)('BlrQ', 'good', { draft: 'Drft', good: 'Gd  ', best: 'Bst ' });
  D.SmBM = (0, W.createEnum)('SmBM', 'normal', {
    normal: 'SBMN',
    'edge only': 'SBME',
    'overlay edge': 'SBMO',
  });
  D.SmBQ = (0, W.createEnum)('SmBQ', 'medium', { low: 'SBQL', medium: 'SBQM', high: 'SBQH' });
  D.DspM = (0, W.createEnum)('DspM', 'stretch to fit', { 'stretch to fit': 'StrF', tile: 'Tile' });
  D.UndA = (0, W.createEnum)('UndA', 'repeat edge pixels', {
    'wrap around': 'WrpA',
    'repeat edge pixels': 'RptE',
  });
  D.Cnvr = (0, W.createEnum)('Cnvr', 'rectangular to polar', {
    'rectangular to polar': 'RctP',
    'polar to rectangular': 'PlrR',
  });
  D.RplS = (0, W.createEnum)('RplS', 'medium', { small: 'Sml ', medium: 'Mdm ', large: 'Lrg ' });
  D.SphM = (0, W.createEnum)('SphM', 'normal', {
    normal: 'Nrml',
    'horizontal only': 'HrzO',
    'vertical only': 'VrtO',
  });
  D.Wvtp = (0, W.createEnum)('Wvtp', 'sine', { sine: 'WvSn', triangle: 'WvTr', square: 'WvSq' });
  D.ZZTy = (0, W.createEnum)('ZZTy', 'pond ripples', {
    'around center': 'ArnC',
    'out from center': 'OtFr',
    'pond ripples': 'PndR',
  });
  D.Dstr = (0, W.createEnum)('Dstr', 'uniform', { uniform: 'Unfr', gaussian: 'Gsn ' });
  D.Chnl = (0, W.createEnum)('Chnl', 'composite', {
    red: 'Rd  ',
    green: 'Grn ',
    blue: 'Bl  ',
    composite: 'Cmps',
  });
  D.MztT = (0, W.createEnum)('MztT', 'fine dots', {
    'fine dots': 'FnDt',
    'medium dots': 'MdmD',
    'grainy dots': 'GrnD',
    'coarse dots': 'CrsD',
    'short lines': 'ShrL',
    'medium lines': 'MdmL',
    'long lines': 'LngL',
    'short strokes': 'ShSt',
    'medium strokes': 'MdmS',
    'long strokes': 'LngS',
  });
  D.Lns = (0, W.createEnum)('Lns ', '50-300mm zoom', {
    '50-300mm zoom': 'Zm  ',
    '32mm prime': 'Nkn ',
    '105mm prime': 'Nkn1',
    'movie prime': 'PnVs',
  });
  D.blurType = (0, W.createEnum)('blurType', 'gaussian blur', {
    'gaussian blur': 'GsnB',
    'lens blur': 'lensBlur',
    'motion blur': 'MtnB',
  });
  D.DfsM = (0, W.createEnum)('DfsM', 'normal', {
    normal: 'Nrml',
    'darken only': 'DrkO',
    'lighten only': 'LghO',
    anisotropic: 'anisotropic',
  });
  D.ExtT = (0, W.createEnum)('ExtT', 'blocks', { blocks: 'Blks', pyramids: 'Pyrm' });
  D.ExtR = (0, W.createEnum)('ExtR', 'random', { random: 'Rndm', 'level-based': 'LvlB' });
  D.FlCl = (0, W.createEnum)('FlCl', 'background color', {
    'background color': 'FlBc',
    'foreground color': 'FlFr',
    'inverse image': 'FlIn',
    'unaltered image': 'FlSm',
  });
  D.CntE = (0, W.createEnum)('CntE', 'upper', { lower: 'Lwr ', upper: 'Upr ' });
  D.WndM = (0, W.createEnum)('WndM', 'wind', { wind: 'Wnd ', blast: 'Blst', stagger: 'Stgr' });
  D.Drct = (0, W.createEnum)('Drct', 'right', { left: 'Left', right: 'Rght' });
  D.IntE = (0, W.createEnum)('IntE', 'odd lines', { 'odd lines': 'ElmO', 'even lines': 'ElmE' });
  D.IntC = (0, W.createEnum)('IntC', 'interpolation', {
    duplication: 'CrtD',
    interpolation: 'CrtI',
  });
  D.FlMd = (0, W.createEnum)('FlMd', 'wrap around', {
    'set to transparent': 'Bckg',
    'repeat edge pixels': 'Rpt ',
    'wrap around': 'Wrp ',
  });
  D.prjM = (0, W.createEnum)('prjM', 'fisheye', {
    fisheye: 'fisP',
    perspective: 'perP',
    auto: 'auto',
    'full spherical': 'fusP',
  });
  D.presetKindType = (0, W.createEnum)('presetKindType', 'custom', {
    custom: 'presetKindCustom',
    default: 'presetKindDefault',
  });
});
var Ya = he(dn => {
  'use strict';
  Object.defineProperty(dn, '__esModule', { value: !0 });
  dn.resourceHandlersMap = dn.resourceHandlers = void 0;
  var Gm = qr(),
    O = un(),
    L = li(),
    Re = fn(),
    lo = gf(),
    oe = no();
  dn.resourceHandlers = [];
  dn.resourceHandlersMap = {};
  function Q(e, n, t, i) {
    let r = { key: e, has: n, read: t, write: i };
    (dn.resourceHandlers.push(r), (dn.resourceHandlersMap[r.key] = r));
  }
  var ut = !1,
    io = [void 0, 'PPI', 'PPCM'],
    ro = [void 0, 'Inches', 'Centimeters', 'Points', 'Picas', 'Columns'],
    Tf = '0123456789abcdef';
  function Rf(e) {
    return e <= 57 ? e - 48 : e >= 97 ? e - 87 : e - 55;
  }
  function $m(e, n) {
    return (Rf(e.charCodeAt(n)) << 4) | Rf(e.charCodeAt(n + 1));
  }
  function Ka(e, n) {
    let t = (0, O.readBytes)(e, n);
    return (0, lo.decodeString)(t);
  }
  function Wa(e, n) {
    let t = (0, lo.encodeString)(n);
    (0, L.writeBytes)(e, t);
  }
  function Zm(e) {
    let n = (0, O.readUint8)(e),
      t = (0, O.readBytes)(e, n),
      i = !1;
    for (let r = 0; r < t.byteLength; r++)
      if (t[r] & 128) {
        i = !0;
        break;
      }
    if (i)
      try {
        return new TextDecoder('gbk').decode(t);
      } catch {}
    return (0, lo.decodeString)(t);
  }
  function Hm(e, n) {
    let t = '';
    for (let r = 0, o = n.codePointAt(r++); o !== void 0; o = n.codePointAt(r++))
      t += o > 127 ? '?' : String.fromCodePoint(o);
    let i = (0, lo.encodeString)(t);
    ((0, L.writeUint8)(e, i.byteLength), (0, L.writeBytes)(e, i));
  }
  Re.MOCK_HANDLERS &&
    Q(
      1028,
      e => e._ir1028 !== void 0,
      (e, n, t) => {
        (ut && console.log('image resource 1028', t()), (n._ir1028 = (0, O.readBytes)(e, t())));
      },
      (e, n) => {
        (0, L.writeBytes)(e, n._ir1028);
      }
    );
  Q(
    1061,
    e => e.captionDigest !== void 0,
    (e, n) => {
      let t = '';
      for (let i = 0; i < 16; i++) {
        let r = (0, O.readUint8)(e);
        ((t += Tf[r >> 4]), (t += Tf[r & 15]));
      }
      n.captionDigest = t;
    },
    (e, n) => {
      for (let t = 0; t < 16; t++) (0, L.writeUint8)(e, $m(n.captionDigest, t * 2));
    }
  );
  Q(
    1060,
    e => e.xmpMetadata !== void 0,
    (e, n, t) => {
      n.xmpMetadata = Ka(e, t());
    },
    (e, n) => {
      Wa(e, n.xmpMetadata);
    }
  );
  var oo = (0, Re.createEnum)('Inte', 'perceptual', {
    perceptual: 'Img ',
    saturation: 'Grp ',
    'relative colorimetric': 'Clrm',
    'absolute colorimetric': 'AClr',
  });
  Re.MOCK_HANDLERS &&
    Q(
      1085,
      e => e._ir1085 !== void 0,
      (e, n, t) => {
        n._ir1085 = (0, O.readBytes)(e, t());
      },
      (e, n) => {
        (0, L.writeBytes)(e, n._ir1085);
      }
    );
  Q(
    1082,
    e => e.printInformation !== void 0,
    (e, n) => {
      var t, i;
      let r = (0, oe.readVersionAndDescriptor)(e);
      n.printInformation = {
        printerName: r.printerName || '',
        renderingIntent: oo.decode((t = r.Inte) !== null && t !== void 0 ? t : 'Inte.Img '),
      };
      let o = n.printInformation;
      (r.PstS !== void 0 && (o.printerManagesColors = r.PstS),
        r['Nm  '] !== void 0 && (o.printerProfile = r['Nm  ']),
        r.MpBl !== void 0 && (o.blackPointCompensation = r.MpBl),
        r.printSixteenBit !== void 0 && (o.printSixteenBit = r.printSixteenBit),
        r.hardProof !== void 0 && (o.hardProof = r.hardProof),
        r.printProofSetup &&
          ('Bltn' in r.printProofSetup
            ? (o.proofSetup = { builtin: r.printProofSetup.Bltn.split('.')[1] })
            : (o.proofSetup = {
                profile: r.printProofSetup.profile,
                renderingIntent: oo.decode(
                  (i = r.printProofSetup.Inte) !== null && i !== void 0 ? i : 'Inte.Img '
                ),
                blackPointCompensation: !!r.printProofSetup.MpBl,
                paperWhite: !!r.printProofSetup.paperWhite,
              })));
    },
    (e, n) => {
      var t, i;
      let r = n.printInformation,
        o = {};
      (r.printerManagesColors
        ? (o.PstS = !0)
        : (r.hardProof !== void 0 && (o.hardProof = !!r.hardProof),
          (o.ClrS = 'ClrS.RGBC'),
          (o['Nm  '] = (t = r.printerProfile) !== null && t !== void 0 ? t : 'CIE RGB')),
        (o.Inte = oo.encode(r.renderingIntent)),
        r.printerManagesColors || (o.MpBl = !!r.blackPointCompensation),
        (o.printSixteenBit = !!r.printSixteenBit),
        (o.printerName = r.printerName || ''),
        r.proofSetup && 'profile' in r.proofSetup
          ? (o.printProofSetup = {
              profile: r.proofSetup.profile || '',
              Inte: oo.encode(r.proofSetup.renderingIntent),
              MpBl: !!r.proofSetup.blackPointCompensation,
              paperWhite: !!r.proofSetup.paperWhite,
            })
          : (o.printProofSetup = {
              Bltn:
                !((i = r.proofSetup) === null || i === void 0) && i.builtin
                  ? `builtinProof.${r.proofSetup.builtin}`
                  : 'builtinProof.proofCMYK',
            }),
        (0, oe.writeVersionAndDescriptor)(e, '', 'printOutput', o));
    }
  );
  Re.MOCK_HANDLERS &&
    Q(
      1083,
      e => e._ir1083 !== void 0,
      (e, n, t) => {
        (ut && console.log('image resource 1083', t()), (n._ir1083 = (0, O.readBytes)(e, t())));
      },
      (e, n) => {
        (0, L.writeBytes)(e, n._ir1083);
      }
    );
  Q(
    1005,
    e => e.resolutionInfo !== void 0,
    (e, n) => {
      let t = (0, O.readFixedPoint32)(e),
        i = (0, O.readUint16)(e),
        r = (0, O.readUint16)(e),
        o = (0, O.readFixedPoint32)(e),
        a = (0, O.readUint16)(e),
        s = (0, O.readUint16)(e);
      n.resolutionInfo = {
        horizontalResolution: t,
        horizontalResolutionUnit: io[i] || 'PPI',
        widthUnit: ro[r] || 'Inches',
        verticalResolution: o,
        verticalResolutionUnit: io[a] || 'PPI',
        heightUnit: ro[s] || 'Inches',
      };
    },
    (e, n) => {
      let t = n.resolutionInfo;
      ((0, L.writeFixedPoint32)(e, t.horizontalResolution || 0),
        (0, L.writeUint16)(e, Math.max(1, io.indexOf(t.horizontalResolutionUnit))),
        (0, L.writeUint16)(e, Math.max(1, ro.indexOf(t.widthUnit))),
        (0, L.writeFixedPoint32)(e, t.verticalResolution || 0),
        (0, L.writeUint16)(e, Math.max(1, io.indexOf(t.verticalResolutionUnit))),
        (0, L.writeUint16)(e, Math.max(1, ro.indexOf(t.heightUnit))));
    }
  );
  var Bf = ['centered', 'size to fit', 'user defined'];
  Q(
    1062,
    e => e.printScale !== void 0,
    (e, n) => {
      n.printScale = {
        style: Bf[(0, O.readInt16)(e)],
        x: (0, O.readFloat32)(e),
        y: (0, O.readFloat32)(e),
        scale: (0, O.readFloat32)(e),
      };
    },
    (e, n) => {
      let { style: t, x: i, y: r, scale: o } = n.printScale;
      ((0, L.writeInt16)(e, Math.max(0, Bf.indexOf(t))),
        (0, L.writeFloat32)(e, i || 0),
        (0, L.writeFloat32)(e, r || 0),
        (0, L.writeFloat32)(e, o || 0));
    }
  );
  Q(
    1006,
    e => e.alphaChannelNames !== void 0,
    (e, n, t) => {
      if (n.alphaChannelNames) (0, O.skipBytes)(e, t());
      else
        for (n.alphaChannelNames = []; t() > 0;) {
          let i = Zm(e);
          n.alphaChannelNames.push(i);
        }
    },
    (e, n) => {
      for (let t of n.alphaChannelNames) Hm(e, t);
    }
  );
  Q(
    1045,
    e => e.alphaChannelNames !== void 0,
    (e, n, t) => {
      for (n.alphaChannelNames = []; t() > 0;)
        n.alphaChannelNames.push((0, O.readUnicodeString)(e));
    },
    (e, n) => {
      for (let t of n.alphaChannelNames) (0, L.writeUnicodeStringWithPadding)(e, t);
    }
  );
  Re.MOCK_HANDLERS &&
    Q(
      1077,
      e => e._ir1077 !== void 0,
      (e, n, t) => {
        (ut && console.log('image resource 1077', t()), (n._ir1077 = (0, O.readBytes)(e, t())));
      },
      (e, n) => {
        (0, L.writeBytes)(e, n._ir1077);
      }
    );
  Q(
    1053,
    e => e.alphaIdentifiers !== void 0,
    (e, n, t) => {
      for (n.alphaIdentifiers = []; t() >= 4;) n.alphaIdentifiers.push((0, O.readUint32)(e));
    },
    (e, n) => {
      for (let t of n.alphaIdentifiers) (0, L.writeUint32)(e, t);
    }
  );
  Q(
    1010,
    e => e.backgroundColor !== void 0,
    (e, n) => (n.backgroundColor = (0, O.readColor)(e)),
    (e, n) => (0, L.writeColor)(e, n.backgroundColor)
  );
  Q(
    1037,
    e => e.globalAngle !== void 0,
    (e, n) => (n.globalAngle = (0, O.readInt32)(e)),
    (e, n) => (0, L.writeInt32)(e, n.globalAngle)
  );
  Q(
    1049,
    e => e.globalAltitude !== void 0,
    (e, n) => (n.globalAltitude = (0, O.readUint32)(e)),
    (e, n) => (0, L.writeUint32)(e, n.globalAltitude)
  );
  Q(
    1011,
    e => e.printFlags !== void 0,
    (e, n) => {
      n.printFlags = {
        labels: !!(0, O.readUint8)(e),
        cropMarks: !!(0, O.readUint8)(e),
        colorBars: !!(0, O.readUint8)(e),
        registrationMarks: !!(0, O.readUint8)(e),
        negative: !!(0, O.readUint8)(e),
        flip: !!(0, O.readUint8)(e),
        interpolate: !!(0, O.readUint8)(e),
        caption: !!(0, O.readUint8)(e),
        printFlags: !!(0, O.readUint8)(e),
      };
    },
    (e, n) => {
      let t = n.printFlags;
      ((0, L.writeUint8)(e, t.labels ? 1 : 0),
        (0, L.writeUint8)(e, t.cropMarks ? 1 : 0),
        (0, L.writeUint8)(e, t.colorBars ? 1 : 0),
        (0, L.writeUint8)(e, t.registrationMarks ? 1 : 0),
        (0, L.writeUint8)(e, t.negative ? 1 : 0),
        (0, L.writeUint8)(e, t.flip ? 1 : 0),
        (0, L.writeUint8)(e, t.interpolate ? 1 : 0),
        (0, L.writeUint8)(e, t.caption ? 1 : 0),
        (0, L.writeUint8)(e, t.printFlags ? 1 : 0));
    }
  );
  Q(
    1034,
    e => e.copyrighted !== void 0,
    (e, n) => {
      n.copyrighted = !!(0, O.readUint8)(e);
    },
    (e, n) => {
      (0, L.writeUint8)(e, n.copyrighted ? 1 : 0);
    }
  );
  Q(
    1035,
    e => e.url !== void 0,
    (e, n, t) => {
      n.url = (0, O.readAsciiString)(e, t());
    },
    (e, n) => {
      (0, L.writeAsciiString)(e, n.url);
    }
  );
  Re.MOCK_HANDLERS &&
    Q(
      1e4,
      e => e._ir10000 !== void 0,
      (e, n, t) => {
        (ut && console.log('image resource 10000', t()), (n._ir10000 = (0, O.readBytes)(e, t())));
      },
      (e, n) => {
        (0, L.writeBytes)(e, n._ir10000);
      }
    );
  Re.MOCK_HANDLERS &&
    Q(
      1013,
      e => e._ir1013 !== void 0,
      (e, n, t) => {
        (ut && console.log('image resource 1013', t()), (n._ir1013 = (0, O.readBytes)(e, t())));
      },
      (e, n) => {
        (0, L.writeBytes)(e, n._ir1013);
      }
    );
  Re.MOCK_HANDLERS &&
    Q(
      1016,
      e => e._ir1016 !== void 0,
      (e, n, t) => {
        (ut && console.log('image resource 1016', t()), (n._ir1016 = (0, O.readBytes)(e, t())));
      },
      (e, n) => {
        (0, L.writeBytes)(e, n._ir1016);
      }
    );
  Q(
    1080,
    e => e.countInformation !== void 0,
    (e, n) => {
      let t = (0, oe.readVersionAndDescriptor)(e);
      n.countInformation = t.countGroupList.map(i => ({
        color: { r: i['Rd  '], g: i['Grn '], b: i['Bl  '] },
        name: i['Nm  '],
        size: i['Rds '],
        fontSize: i.fontSize,
        visible: i.Vsbl,
        points: i.countObjectList.map(r => ({ x: r['X   '], y: r['Y   '] })),
      }));
    },
    (e, n) => {
      let t = {
        Vrsn: 1,
        countGroupList: n.countInformation.map(i => ({
          'Rd  ': i.color.r,
          'Grn ': i.color.g,
          'Bl  ': i.color.b,
          'Nm  ': i.name,
          'Rds ': i.size,
          fontSize: i.fontSize,
          Vsbl: i.visible,
          countObjectList: i.points.map(r => ({ 'X   ': r.x, 'Y   ': r.y })),
        })),
      };
      (0, oe.writeVersionAndDescriptor)(e, '', 'Cnt ', t);
    }
  );
  Q(
    1024,
    e => e.layerState !== void 0,
    (e, n) => (n.layerState = (0, O.readUint16)(e)),
    (e, n) => (0, L.writeUint16)(e, n.layerState)
  );
  Q(
    1026,
    e => e.layersGroup !== void 0,
    (e, n, t) => {
      for (n.layersGroup = []; t() > 0;) n.layersGroup.push((0, O.readUint16)(e));
    },
    (e, n) => {
      for (let t of n.layersGroup) (0, L.writeUint16)(e, t);
    }
  );
  Q(
    1072,
    e => e.layerGroupsEnabledId !== void 0,
    (e, n, t) => {
      for (n.layerGroupsEnabledId = []; t() > 0;) n.layerGroupsEnabledId.push((0, O.readUint8)(e));
    },
    (e, n) => {
      for (let t of n.layerGroupsEnabledId) (0, L.writeUint8)(e, t);
    }
  );
  Q(
    1069,
    e => e.layerSelectionIds !== void 0,
    (e, n) => {
      let t = (0, O.readUint16)(e);
      for (n.layerSelectionIds = []; t--;) n.layerSelectionIds.push((0, O.readUint32)(e));
    },
    (e, n) => {
      (0, L.writeUint16)(e, n.layerSelectionIds.length);
      for (let t of n.layerSelectionIds) (0, L.writeUint32)(e, t);
    }
  );
  Q(
    1032,
    e => e.gridAndGuidesInformation !== void 0,
    (e, n) => {
      let t = (0, O.readUint32)(e),
        i = (0, O.readUint32)(e),
        r = (0, O.readUint32)(e),
        o = (0, O.readUint32)(e);
      if (t !== 1) throw new Error(`Invalid 1032 resource version: ${t}`);
      n.gridAndGuidesInformation = { grid: { horizontal: i, vertical: r }, guides: [] };
      for (let a = 0; a < o; a++)
        n.gridAndGuidesInformation.guides.push({
          location: (0, O.readUint32)(e) / 32,
          direction: (0, O.readUint8)(e) ? 'horizontal' : 'vertical',
        });
    },
    (e, n) => {
      let t = n.gridAndGuidesInformation,
        i = t.grid || { horizontal: 576, vertical: 576 },
        r = t.guides || [];
      ((0, L.writeUint32)(e, 1),
        (0, L.writeUint32)(e, i.horizontal),
        (0, L.writeUint32)(e, i.vertical),
        (0, L.writeUint32)(e, r.length));
      for (let o of r)
        ((0, L.writeUint32)(e, o.location * 32),
          (0, L.writeUint8)(e, o.direction === 'horizontal' ? 1 : 0));
    }
  );
  Q(
    1065,
    e => e.layerComps !== void 0,
    (e, n) => {
      let t = (0, oe.readVersionAndDescriptor)(e, !0);
      n.layerComps = { list: [] };
      for (let i of t.list)
        (n.layerComps.list.push({ id: i.compID, name: i['Nm  '], capturedInfo: i.capturedInfo }),
          'comment' in i && (n.layerComps.list[n.layerComps.list.length - 1].comment = i.comment));
      'lastAppliedComp' in t && (n.layerComps.lastApplied = t.lastAppliedComp);
    },
    (e, n) => {
      let t = n.layerComps,
        i = { list: [] };
      for (let r of t.list) {
        let o = {};
        ((o._classID = 'Comp'),
          (o['Nm  '] = r.name),
          'comment' in r && (o.comment = r.comment),
          (o.compID = r.id),
          (o.capturedInfo = r.capturedInfo),
          i.list.push(o));
      }
      ('lastApplied' in t && (i.lastAppliedComp = t.lastApplied),
        (0, oe.writeVersionAndDescriptor)(e, '', 'CompList', i));
    }
  );
  Re.MOCK_HANDLERS &&
    Q(
      1092,
      e => e._ir1092 !== void 0,
      (e, n, t) => {
        (ut && console.log('image resource 1092', t()), (n._ir1092 = (0, O.readBytes)(e, t())));
      },
      (e, n) => {
        (0, L.writeBytes)(e, n._ir1092);
      }
    );
  var zf = [
    'normal',
    void 0,
    void 0,
    void 0,
    void 0,
    void 0,
    void 0,
    'multiply',
    'screen',
    void 0,
    void 0,
    void 0,
    void 0,
    void 0,
    void 0,
    void 0,
    void 0,
    void 0,
    void 0,
    void 0,
    void 0,
    void 0,
    void 0,
    'difference',
  ];
  Q(
    1078,
    e => e.onionSkins !== void 0,
    (e, n) => {
      let t = (0, oe.readVersionAndDescriptor)(e);
      n.onionSkins = {
        enabled: t.enab,
        framesBefore: t.numBefore,
        framesAfter: t.numAfter,
        frameSpacing: t.Spcn,
        minOpacity: t.minOpacity / 100,
        maxOpacity: t.maxOpacity / 100,
        blendMode: zf[t.BlnM] || 'normal',
      };
    },
    (e, n) => {
      let t = n.onionSkins,
        i = {
          Vrsn: 1,
          enab: t.enabled,
          numBefore: t.framesBefore,
          numAfter: t.framesAfter,
          Spcn: t.frameSpacing,
          minOpacity: (t.minOpacity * 100) | 0,
          maxOpacity: (t.maxOpacity * 100) | 0,
          BlnM: Math.max(0, zf.indexOf(t.blendMode)),
        };
      (0, oe.writeVersionAndDescriptor)(e, '', 'null', i);
    }
  );
  Q(
    1075,
    e => e.timelineInformation !== void 0,
    (e, n) => {
      var t, i;
      let r = (0, oe.readVersionAndDescriptor)(e);
      ((n.timelineInformation = {
        enabled: r.enab,
        frameStep: (0, oe.frac)(r.frameStep),
        frameRate: r.frameRate,
        time: (0, oe.frac)(r.time),
        duration: (0, oe.frac)(r.duration),
        workInTime: (0, oe.frac)(r.workInTime),
        workOutTime: (0, oe.frac)(r.workOutTime),
        repeats: r.LCnt,
        hasMotion: r.hasMotion,
        globalTracks: (0, oe.parseTrackList)(r.globalTrackList, !!e.logMissingFeatures),
      }),
        !(
          (i =
            (t = r.audioClipGroupList) === null || t === void 0 ? void 0 : t.audioClipGroupList) ===
            null || i === void 0
        ) &&
          i.length &&
          (n.timelineInformation.audioClipGroups = r.audioClipGroupList.audioClipGroupList.map(
            o => ({
              id: o.groupID,
              muted: o.muted,
              audioClips: o.audioClipList.map(
                ({ clipID: a, timeScope: s, muted: c, audioLevel: l, frameReader: f }) => ({
                  id: a,
                  start: (0, oe.frac)(s.Strt),
                  duration: (0, oe.frac)(s.duration),
                  inTime: (0, oe.frac)(s.inTime),
                  outTime: (0, oe.frac)(s.outTime),
                  muted: c,
                  audioLevel: l,
                  frameReader: {
                    type: f.frameReaderType,
                    mediaDescriptor: f.mediaDescriptor,
                    link: {
                      name: f['Lnk ']['Nm  '],
                      fullPath: f['Lnk '].fullPath,
                      relativePath: f['Lnk '].relPath,
                    },
                  },
                })
              ),
            })
          )));
    },
    (e, n) => {
      var t;
      let i = n.timelineInformation,
        r = {
          Vrsn: 1,
          enab: i.enabled,
          frameStep: i.frameStep,
          frameRate: i.frameRate,
          time: i.time,
          duration: i.duration,
          workInTime: i.workInTime,
          workOutTime: i.workOutTime,
          LCnt: i.repeats,
          globalTrackList: (0, oe.serializeTrackList)(i.globalTracks),
          audioClipGroupList: {
            audioClipGroupList:
              (t = i.audioClipGroups) === null || t === void 0
                ? void 0
                : t.map(o => ({
                    groupID: o.id,
                    muted: o.muted,
                    audioClipList: o.audioClips.map(a => ({
                      clipID: a.id,
                      timeScope: {
                        Vrsn: 1,
                        Strt: a.start,
                        duration: a.duration,
                        inTime: a.inTime,
                        outTime: a.outTime,
                      },
                      frameReader: {
                        frameReaderType: a.frameReader.type,
                        descVersion: 1,
                        'Lnk ': {
                          descVersion: 1,
                          'Nm  ': a.frameReader.link.name,
                          fullPath: a.frameReader.link.fullPath,
                          relPath: a.frameReader.link.relativePath,
                        },
                        mediaDescriptor: a.frameReader.mediaDescriptor,
                      },
                      muted: a.muted,
                      audioLevel: a.audioLevel,
                    })),
                  })),
          },
          hasMotion: i.hasMotion,
        };
      (0, oe.writeVersionAndDescriptor)(e, '', 'null', r, 'anim');
    }
  );
  Q(
    1076,
    e => e.sheetDisclosure !== void 0,
    (e, n) => {
      let t = (0, oe.readVersionAndDescriptor)(e);
      ((n.sheetDisclosure = {}),
        t.sheetTimelineOptions &&
          (n.sheetDisclosure.sheetTimelineOptions = t.sheetTimelineOptions.map(i => ({
            sheetID: i.sheetID,
            sheetDisclosed: i.sheetDisclosed,
            lightsDisclosed: i.lightsDisclosed,
            meshesDisclosed: i.meshesDisclosed,
            materialsDisclosed: i.materialsDisclosed,
          }))));
    },
    (e, n) => {
      let t = n.sheetDisclosure,
        i = { Vrsn: 1 };
      (t.sheetTimelineOptions &&
        (i.sheetTimelineOptions = t.sheetTimelineOptions.map(r => ({
          Vrsn: 2,
          sheetID: r.sheetID,
          sheetDisclosed: r.sheetDisclosed,
          lightsDisclosed: r.lightsDisclosed,
          meshesDisclosed: r.meshesDisclosed,
          materialsDisclosed: r.materialsDisclosed,
        }))),
        (0, oe.writeVersionAndDescriptor)(e, '', 'null', i));
    }
  );
  Q(
    1054,
    e => e.urlsList !== void 0,
    (e, n) => {
      let t = (0, O.readUint32)(e);
      n.urlsList = [];
      for (let i = 0; i < t; i++) {
        if ((0, O.readSignature)(e) !== 'slic' && e.throwForMissingFeatures)
          throw new Error('Unknown long');
        let o = (0, O.readUint32)(e),
          a = (0, O.readUnicodeString)(e);
        n.urlsList.push({ id: o, url: a, ref: 'slice' });
      }
    },
    (e, n) => {
      let t = n.urlsList;
      (0, L.writeUint32)(e, t.length);
      for (let i = 0; i < t.length; i++)
        ((0, L.writeSignature)(e, 'slic'),
          (0, L.writeUint32)(e, t[i].id),
          (0, L.writeUnicodeString)(e, t[i].url));
    }
  );
  function Nf(e) {
    return { 'Top ': e.top, Left: e.left, Btom: e.bottom, Rght: e.right };
  }
  function jf(e) {
    return { top: e['Top '], left: e.Left, bottom: e.Btom, right: e.Rght };
  }
  function ao(e, n) {
    return e[Math.max(0, Math.min(e.length - 1, n))];
  }
  var Vf = ['autoGenerated', 'layer', 'userGenerated'],
    Gf = ['noImage', 'image'],
    so = ['default'];
  Q(
    1050,
    e => (e.slices ? e.slices.length : 0),
    (e, n) => {
      let t = (0, O.readUint32)(e);
      if (t === 6) {
        n.slices || (n.slices = []);
        let i = (0, O.readInt32)(e),
          r = (0, O.readInt32)(e),
          o = (0, O.readInt32)(e),
          a = (0, O.readInt32)(e),
          s = (0, O.readUnicodeString)(e),
          c = (0, O.readUint32)(e);
        n.slices.push({
          bounds: { top: i, left: r, bottom: o, right: a },
          groupName: s,
          slices: [],
        });
        let l = n.slices[n.slices.length - 1].slices;
        for (let d = 0; d < c; d++) {
          let u = (0, O.readUint32)(e),
            h = (0, O.readUint32)(e),
            p = ao(Vf, (0, O.readUint32)(e)),
            _ = p == 'layer' ? (0, O.readUint32)(e) : 0,
            b = (0, O.readUnicodeString)(e),
            g = ao(Gf, (0, O.readUint32)(e)),
            y = (0, O.readInt32)(e),
            w = (0, O.readInt32)(e),
            m = (0, O.readInt32)(e),
            A = (0, O.readInt32)(e),
            M = (0, O.readUnicodeString)(e),
            k = (0, O.readUnicodeString)(e),
            E = (0, O.readUnicodeString)(e),
            F = (0, O.readUnicodeString)(e),
            I = !!(0, O.readUint8)(e),
            C = (0, O.readUnicodeString)(e),
            B = ao(so, (0, O.readUint32)(e)),
            ee = ao(so, (0, O.readUint32)(e)),
            $ = (0, O.readUint8)(e),
            U = (0, O.readUint8)(e),
            V = (0, O.readUint8)(e),
            X = (0, O.readUint8)(e),
            ie = $ + U + V + X === 0 ? 'none' : $ === 0 ? 'matte' : 'color';
          l.push({
            id: u,
            groupId: h,
            origin: p,
            associatedLayerId: _,
            name: b,
            target: k,
            message: E,
            altTag: F,
            cellTextIsHTML: I,
            cellText: C,
            horizontalAlignment: B,
            verticalAlignment: ee,
            type: g,
            url: M,
            bounds: { top: w, left: y, bottom: A, right: m },
            backgroundColorType: ie,
            backgroundColor: { r: U, g: V, b: X, a: $ },
          });
        }
        (0, oe.readVersionAndDescriptor)(e).slices.forEach(d => {
          let u = l.find(h => d.sliceID == h.id);
          u &&
            ((u.topOutset = d.topOutset),
            (u.leftOutset = d.leftOutset),
            (u.bottomOutset = d.bottomOutset),
            (u.rightOutset = d.rightOutset));
        });
      } else if (t === 7 || t === 8) {
        let i = (0, oe.readVersionAndDescriptor)(e);
        (n.slices || (n.slices = []),
          n.slices.push({
            groupName: i.baseName,
            bounds: jf(i.bounds),
            slices: i.slices.map(r =>
              Object.assign(Object.assign({}, r['Nm  '] ? { name: r['Nm  '] } : {}), {
                id: r.sliceID,
                groupId: r.groupID,
                associatedLayerId: 0,
                origin: oe.ESliceOrigin.decode(r.origin),
                type: oe.ESliceType.decode(r.Type),
                bounds: jf(r.bounds),
                url: r.url,
                target: r.null,
                message: r.Msge,
                altTag: r.altTag,
                cellTextIsHTML: r.cellTextIsHTML,
                cellText: r.cellText,
                horizontalAlignment: oe.ESliceHorzAlign.decode(r.horzAlign),
                verticalAlignment: oe.ESliceVertAlign.decode(r.vertAlign),
                backgroundColorType: oe.ESliceBGColorType.decode(r.bgColorType),
                backgroundColor: r.bgColor
                  ? {
                      r: r.bgColor['Rd  '],
                      g: r.bgColor['Grn '],
                      b: r.bgColor['Bl  '],
                      a: r.bgColor.alpha,
                    }
                  : { r: 0, g: 0, b: 0, a: 0 },
                topOutset: r.topOutset || 0,
                leftOutset: r.leftOutset || 0,
                bottomOutset: r.bottomOutset || 0,
                rightOutset: r.rightOutset || 0,
              })
            ),
          }));
      } else throw new Error(`Invalid slices version (${t})`);
    },
    (e, n, t) => {
      let { bounds: i, groupName: r, slices: o } = n.slices[t];
      ((0, L.writeUint32)(e, 6),
        (0, L.writeInt32)(e, i.top),
        (0, L.writeInt32)(e, i.left),
        (0, L.writeInt32)(e, i.bottom),
        (0, L.writeInt32)(e, i.right),
        (0, L.writeUnicodeString)(e, r),
        (0, L.writeUint32)(e, o.length));
      for (let s = 0; s < o.length; s++) {
        let c = o[s],
          { a: l, r: f, g: d, b: u } = c.backgroundColor;
        (c.backgroundColorType === 'none'
          ? (l = f = d = u = 0)
          : c.backgroundColorType === 'matte' && ((l = 0), (f = d = u = 255)),
          (0, L.writeUint32)(e, c.id),
          (0, L.writeUint32)(e, c.groupId),
          (0, L.writeUint32)(e, Vf.indexOf(c.origin)),
          c.origin === 'layer' && (0, L.writeUint32)(e, c.associatedLayerId),
          (0, L.writeUnicodeString)(e, c.name || ''),
          (0, L.writeUint32)(e, Gf.indexOf(c.type)),
          (0, L.writeInt32)(e, c.bounds.left),
          (0, L.writeInt32)(e, c.bounds.top),
          (0, L.writeInt32)(e, c.bounds.right),
          (0, L.writeInt32)(e, c.bounds.bottom),
          (0, L.writeUnicodeString)(e, c.url),
          (0, L.writeUnicodeString)(e, c.target),
          (0, L.writeUnicodeString)(e, c.message),
          (0, L.writeUnicodeString)(e, c.altTag),
          (0, L.writeUint8)(e, c.cellTextIsHTML ? 1 : 0),
          (0, L.writeUnicodeString)(e, c.cellText),
          (0, L.writeUint32)(e, so.indexOf(c.horizontalAlignment)),
          (0, L.writeUint32)(e, so.indexOf(c.verticalAlignment)),
          (0, L.writeUint8)(e, l),
          (0, L.writeUint8)(e, f),
          (0, L.writeUint8)(e, d),
          (0, L.writeUint8)(e, u));
      }
      let a = { bounds: Nf(i), slices: [] };
      (o.forEach(s => {
        let c = Object.assign(
          Object.assign(
            {
              sliceID: s.id,
              groupID: s.groupId,
              origin: oe.ESliceOrigin.encode(s.origin),
              Type: oe.ESliceType.encode(s.type),
              bounds: Nf(s.bounds),
            },
            s.name ? { 'Nm  ': s.name } : {}
          ),
          {
            url: s.url,
            null: s.target,
            Msge: s.message,
            altTag: s.altTag,
            cellTextIsHTML: s.cellTextIsHTML,
            cellText: s.cellText,
            horzAlign: oe.ESliceHorzAlign.encode(s.horizontalAlignment),
            vertAlign: oe.ESliceVertAlign.encode(s.verticalAlignment),
            bgColorType: oe.ESliceBGColorType.encode(s.backgroundColorType),
          }
        );
        if (s.backgroundColorType === 'color') {
          let { r: l, g: f, b: d, a: u } = s.backgroundColor;
          c.bgColor = { 'Rd  ': l, 'Grn ': f, 'Bl  ': d, alpha: u };
        }
        ((c.topOutset = s.topOutset || 0),
          (c.leftOutset = s.leftOutset || 0),
          (c.bottomOutset = s.bottomOutset || 0),
          (c.rightOutset = s.rightOutset || 0),
          a.slices.push(c));
      }),
        (0, oe.writeVersionAndDescriptor)(e, '', 'null', a, 'slices'));
    }
  );
  Q(
    1064,
    e => e.pixelAspectRatio !== void 0,
    (e, n) => {
      if ((0, O.readUint32)(e) > 2) throw new Error('Invalid pixelAspectRatio version');
      n.pixelAspectRatio = { aspect: (0, O.readFloat64)(e) };
    },
    (e, n) => {
      ((0, L.writeUint32)(e, 2), (0, L.writeFloat64)(e, n.pixelAspectRatio.aspect));
    }
  );
  Q(
    1041,
    e => e.iccUntaggedProfile !== void 0,
    (e, n) => {
      n.iccUntaggedProfile = !!(0, O.readUint8)(e);
    },
    (e, n) => {
      (0, L.writeUint8)(e, n.iccUntaggedProfile ? 1 : 0);
    }
  );
  Re.MOCK_HANDLERS &&
    Q(
      1039,
      e => e._ir1039 !== void 0,
      (e, n, t) => {
        (ut && console.log('image resource 1039', t()), (n._ir1039 = (0, O.readBytes)(e, t())));
      },
      (e, n) => {
        (0, L.writeBytes)(e, n._ir1039);
      }
    );
  Q(
    1044,
    e => e.idsSeedNumber !== void 0,
    (e, n) => (n.idsSeedNumber = (0, O.readUint32)(e)),
    (e, n) => (0, L.writeUint32)(e, n.idsSeedNumber)
  );
  Q(
    1036,
    e => e.thumbnail !== void 0 || e.thumbnailRaw !== void 0,
    (e, n, t) => {
      let i = (0, O.readUint32)(e),
        r = (0, O.readUint32)(e),
        o = (0, O.readUint32)(e);
      ((0, O.readUint32)(e), (0, O.readUint32)(e), (0, O.readUint32)(e));
      let a = (0, O.readUint16)(e),
        s = (0, O.readUint16)(e);
      if (i !== 1 || a !== 24 || s !== 1) {
        (e.logMissingFeatures &&
          e.log(`Invalid thumbnail data (format: ${i}, bitsPerPixel: ${a}, planes: ${s})`),
          (0, O.skipBytes)(e, t()));
        return;
      }
      let c = t(),
        l = (0, O.readBytes)(e, c);
      e.useRawThumbnail
        ? (n.thumbnailRaw = { width: r, height: o, data: l })
        : l.byteLength && (n.thumbnail = (0, Re.createCanvasFromData)(l));
    },
    (e, n) => {
      var t;
      let i = 0,
        r = 0,
        o = new Uint8Array(0);
      if (n.thumbnailRaw)
        ((i = n.thumbnailRaw.width), (r = n.thumbnailRaw.height), (o = n.thumbnailRaw.data));
      else
        try {
          let d =
            (t = n.thumbnail.toDataURL('image/jpeg', 1)) === null || t === void 0
              ? void 0
              : t.substring(23);
          d && ((o = (0, Gm.toByteArray)(d)), (i = n.thumbnail.width), (r = n.thumbnail.height));
        } catch {}
      let a = 24,
        s = Math.floor((i * a + 31) / 32) * 4,
        c = 1,
        l = s * r * c,
        f = o.length;
      ((0, L.writeUint32)(e, 1),
        (0, L.writeUint32)(e, i),
        (0, L.writeUint32)(e, r),
        (0, L.writeUint32)(e, s),
        (0, L.writeUint32)(e, l),
        (0, L.writeUint32)(e, f),
        (0, L.writeUint16)(e, a),
        (0, L.writeUint16)(e, c),
        (0, L.writeBytes)(e, o));
    }
  );
  Q(
    1057,
    e => e.versionInfo !== void 0,
    (e, n, t) => {
      if ((0, O.readUint32)(e) !== 1) throw new Error('Invalid versionInfo version');
      ((n.versionInfo = {
        hasRealMergedData: !!(0, O.readUint8)(e),
        writerName: (0, O.readUnicodeString)(e),
        readerName: (0, O.readUnicodeString)(e),
        fileVersion: (0, O.readUint32)(e),
      }),
        (0, O.skipBytes)(e, t()));
    },
    (e, n) => {
      let t = n.versionInfo;
      ((0, L.writeUint32)(e, 1),
        (0, L.writeUint8)(e, t.hasRealMergedData ? 1 : 0),
        (0, L.writeUnicodeString)(e, t.writerName),
        (0, L.writeUnicodeString)(e, t.readerName),
        (0, L.writeUint32)(e, t.fileVersion));
    }
  );
  Re.MOCK_HANDLERS &&
    Q(
      1058,
      e => e._ir1058 !== void 0,
      (e, n, t) => {
        (ut && console.log('image resource 1058', t()), (n._ir1058 = (0, O.readBytes)(e, t())));
      },
      (e, n) => {
        (0, L.writeBytes)(e, n._ir1058);
      }
    );
  Q(
    7e3,
    e => e.imageReadyVariables !== void 0,
    (e, n, t) => {
      n.imageReadyVariables = Ka(e, t());
    },
    (e, n) => {
      Wa(e, n.imageReadyVariables);
    }
  );
  Q(
    7001,
    e => e.imageReadyDataSets !== void 0,
    (e, n, t) => {
      n.imageReadyDataSets = Ka(e, t());
    },
    (e, n) => {
      Wa(e, n.imageReadyDataSets);
    }
  );
  Q(
    1088,
    e => e.pathSelectionState !== void 0,
    (e, n, t) => {
      let i = (0, oe.readVersionAndDescriptor)(e);
      n.pathSelectionState = i.null;
    },
    (e, n) => {
      let t = { null: n.pathSelectionState };
      (0, oe.writeVersionAndDescriptor)(e, '', 'null', t);
    }
  );
  Re.MOCK_HANDLERS &&
    Q(
      1025,
      e => e._ir1025 !== void 0,
      (e, n, t) => {
        (ut && console.log('image resource 1025', t()), (n._ir1025 = (0, O.readBytes)(e, t())));
      },
      (e, n) => {
        (0, L.writeBytes)(e, n._ir1025);
      }
    );
  var $f = (0, Re.createEnum)('FrmD', 'auto', { auto: 'Auto', none: 'None', dispose: 'Disp' });
  Q(
    4e3,
    e => e.animations !== void 0,
    (e, n, t) => {
      let i = (0, O.readSignature)(e);
      if (i === 'mani')
        ((0, O.checkSignature)(e, 'IRFR'),
          (0, O.readSection)(e, 1, r => {
            for (; r() > 0;) {
              (0, O.checkSignature)(e, '8BIM');
              let o = (0, O.readSignature)(e);
              (0, O.readSection)(e, 1, a => {
                if (o === 'AnDs') {
                  let s = (0, oe.readVersionAndDescriptor)(e);
                  n.animations = {
                    frames: s.FrIn.map(c => ({
                      id: c.FrID,
                      delay: (c.FrDl || 0) / 100,
                      dispose: c.FrDs ? $f.decode(c.FrDs) : 'auto',
                    })),
                    animations: s.FSts.map(c => ({
                      id: c.FsID,
                      frames: c.FsFr,
                      repeats: c.LCnt,
                      activeFrame: c.AFrm || 0,
                    })),
                  };
                } else if (o === 'Roll') {
                  let s = (0, O.readBytes)(e, a());
                  e.logDevFeatures && e.log('#4000 Roll', s);
                } else e.logMissingFeatures && e.log('Unhandled subsection in #4000', o);
              });
            }
          }));
      else if (i === 'mopt') {
        let r = (0, O.readBytes)(e, t());
        e.logDevFeatures && e.log('#4000 mopt', r);
      } else e.logMissingFeatures && e.log('Unhandled key in #4000:', i);
    },
    (e, n) => {
      n.animations &&
        ((0, L.writeSignature)(e, 'mani'),
        (0, L.writeSignature)(e, 'IRFR'),
        (0, L.writeSection)(e, 1, () => {
          ((0, L.writeSignature)(e, '8BIM'),
            (0, L.writeSignature)(e, 'AnDs'),
            (0, L.writeSection)(e, 1, () => {
              let t = { FrIn: [], FSts: [] };
              for (let i = 0; i < n.animations.frames.length; i++) {
                let r = n.animations.frames[i],
                  o = { FrID: r.id };
                (r.delay && (o.FrDl = (r.delay * 100) | 0),
                  (o.FrDs = $f.encode(r.dispose)),
                  t.FrIn.push(o));
              }
              for (let i = 0; i < n.animations.animations.length; i++) {
                let r = n.animations.animations[i],
                  o = { FsID: r.id, AFrm: r.activeFrame | 0, FsFr: r.frames, LCnt: r.repeats | 0 };
                t.FSts.push(o);
              }
              (0, oe.writeVersionAndDescriptor)(e, '', 'null', t);
            }));
        }));
    }
  );
  Re.MOCK_HANDLERS &&
    Q(
      4001,
      e => e._ir4001 !== void 0,
      (e, n, t) => {
        if (Re.MOCK_HANDLERS) {
          (ut && console.log('image resource 4001', t()), (n._ir4001 = (0, O.readBytes)(e, t())));
          return;
        }
        let i = (0, O.readSignature)(e);
        if (i === 'mfri') {
          if ((0, O.readUint32)(e) !== 2) throw new Error('Invalid mfri version');
          let o = (0, O.readUint32)(e),
            a = (0, O.readBytes)(e, o);
          e.logDevFeatures && e.log('mfri', a);
        } else if (i === 'mset') {
          let r = (0, oe.readVersionAndDescriptor)(e);
          e.logDevFeatures && e.log('mset', r);
        } else e.logMissingFeatures && e.log('Unhandled key in #4001', i);
      },
      (e, n) => {
        (0, L.writeBytes)(e, n._ir4001);
      }
    );
  Re.MOCK_HANDLERS &&
    Q(
      4002,
      e => e._ir4002 !== void 0,
      (e, n, t) => {
        (ut && console.log('image resource 4002', t()), (n._ir4002 = (0, O.readBytes)(e, t())));
      },
      (e, n) => {
        (0, L.writeBytes)(e, n._ir4002);
      }
    );
});
var un = he(q => {
  'use strict';
  var Xm =
    (q && q.__rest) ||
    function (e, n) {
      var t = {};
      for (var i in e)
        Object.prototype.hasOwnProperty.call(e, i) && n.indexOf(i) < 0 && (t[i] = e[i]);
      if (e != null && typeof Object.getOwnPropertySymbols == 'function')
        for (var r = 0, i = Object.getOwnPropertySymbols(e); r < i.length; r++)
          n.indexOf(i[r]) < 0 &&
            Object.prototype.propertyIsEnumerable.call(e, i[r]) &&
            (t[i[r]] = e[i[r]]);
      return t;
    };
  Object.defineProperty(q, '__esModule', { value: !0 });
  q.supportedColorModes = void 0;
  q.createReader = po;
  q.warnOrThrow = uo;
  q.readUint8 = Ae;
  q.peekUint8 = Kf;
  q.readInt16 = pn;
  q.readUint16 = pe;
  q.readUint16LE = Wf;
  q.readInt32 = $e;
  q.readInt32LE = Jm;
  q.readUint32 = Se;
  q.readFloat32 = Qm;
  q.readFloat64 = Qa;
  q.readFixedPoint32 = e1;
  q.readFixedPointPath32 = t1;
  q.readBytes = Pt;
  q.readSignature = qi;
  q.validSignatureAt = Yf;
  q.readPascalString = go;
  q.readUnicodeString = qf;
  q.readUnicodeStringWithLength = Jf;
  q.readUnicodeStringWithLengthLE = n1;
  q.readAsciiString = i1;
  q.skipBytes = De;
  q.checkSignature = rs;
  q.readPsd = o1;
  q.readLayerInfo = eu;
  q.getCompositeImageData = tu;
  q.getCompositeCanvas = f1;
  q.getLayerImageData = nu;
  q.getLayerMaskImageData = iu;
  q.getLayerRealMaskImageData = ru;
  q.getLayerCanvas = u1;
  q.getLayerMaskCanvas = d1;
  q.getLayerRealMaskCanvas = h1;
  q.decodeLayerPixels = p1;
  q.readGlobalLayerMaskInfo = au;
  q.readAdditionalLayerInfo = os;
  q.readDataZip = is;
  q.readDataRLE = hn;
  q.readSection = xt;
  q.readColor = w1;
  q.readPattern = _1;
  var Km = za(),
    Be = fn(),
    Wm = bo(),
    Ym = Ya();
  q.supportedColorModes = [0, 1, 3, 2];
  var qm = [
    'bitmap',
    'grayscale',
    'indexed',
    'RGB',
    'CMYK',
    '',
    '',
    'multichannel',
    'duotone',
    'lab',
  ];
  function fo(e) {
    let n = e.width * e.height * 4;
    for (let t = 0; t < n; t += 4) {
      let i = e.data[t];
      ((e.data[t + 1] = i), (e.data[t + 2] = i));
    }
  }
  function po(e, n, t) {
    return {
      view: new DataView(e, n, t),
      offset: 0,
      strict: !1,
      debug: !1,
      large: !1,
      globalAlpha: !1,
      log: console.log,
    };
  }
  function uo(e, n) {
    if (e.strict) throw new Error(n);
    e.debug && e.log(n);
  }
  function Ae(e) {
    return ((e.offset += 1), e.view.getUint8(e.offset - 1));
  }
  function Kf(e) {
    return e.view.getUint8(e.offset);
  }
  function pn(e) {
    return ((e.offset += 2), e.view.getInt16(e.offset - 2, !1));
  }
  function pe(e) {
    return ((e.offset += 2), e.view.getUint16(e.offset - 2, !1));
  }
  function Wf(e) {
    return ((e.offset += 2), e.view.getUint16(e.offset - 2, !0));
  }
  function $e(e) {
    return ((e.offset += 4), e.view.getInt32(e.offset - 4, !1));
  }
  function Jm(e) {
    return ((e.offset += 4), e.view.getInt32(e.offset - 4, !0));
  }
  function Se(e) {
    return ((e.offset += 4), e.view.getUint32(e.offset - 4, !1));
  }
  function Qm(e) {
    return ((e.offset += 4), e.view.getFloat32(e.offset - 4, !1));
  }
  function Qa(e) {
    return ((e.offset += 8), e.view.getFloat64(e.offset - 8, !1));
  }
  function e1(e) {
    return $e(e) / 65536;
  }
  function t1(e) {
    return $e(e) / (1 << 24);
  }
  function Pt(e, n) {
    let t = e.view.byteOffset + e.offset;
    if (((e.offset += n), t + n > e.view.buffer.byteLength)) {
      if ((uo(e, 'Reading bytes exceeding buffer length'), n > 100 * 1024 * 1024))
        throw new Error('Reading past end of file');
      let i = new Uint8Array(n),
        r = Math.min(n, e.view.byteLength - t);
      return (r > 0 && i.set(new Uint8Array(e.view.buffer, t, r)), i);
    } else return new Uint8Array(e.view.buffer, t, n);
  }
  function qi(e) {
    return Qf(e, 4);
  }
  function Yf(e, n) {
    let t =
      String.fromCharCode(e.view.getUint8(n)) +
      String.fromCharCode(e.view.getUint8(n + 1)) +
      String.fromCharCode(e.view.getUint8(n + 2)) +
      String.fromCharCode(e.view.getUint8(n + 3));
    return t == '8BIM' || t == '8B64';
  }
  function go(e, n) {
    let t = Ae(e),
      i = t ? Qf(e, t) : '';
    for (; ++t % n;) e.offset++;
    return i;
  }
  function qf(e) {
    let n = Se(e);
    return Jf(e, n);
  }
  function Jf(e, n) {
    let t = '';
    for (; n--;) {
      let i = pe(e);
      (i || n > 0) && (t += String.fromCharCode(i));
    }
    return t;
  }
  function n1(e, n) {
    let t = '';
    for (; n--;) {
      let i = Wf(e);
      (i || n > 0) && (t += String.fromCharCode(i));
    }
    return t;
  }
  function i1(e, n) {
    let t = '';
    for (; n--;) t += String.fromCharCode(Ae(e));
    return t;
  }
  function De(e, n) {
    e.offset += n;
  }
  function rs(e, n, t) {
    let i = e.offset,
      r = qi(e);
    if (r !== n && r !== t) throw new Error(`Invalid signature: '${r}' at 0x${i.toString(16)}`);
  }
  function Qf(e, n) {
    let t = Pt(e, n),
      i = '';
    for (let r = 0; r < t.length; r++) i += String.fromCharCode(t[r]);
    return i;
  }
  function r1(e) {
    return e === '8BIM' || e === 'MeSa' || e === 'AgHg' || e === 'PHUT' || e === 'DCSR';
  }
  function o1(e, n = {}) {
    var t;
    rs(e, '8BPS');
    let i = pe(e);
    if (i !== 1 && i !== 2) throw new Error(`Invalid PSD file version: ${i}`);
    De(e, 6);
    let r = pe(e),
      o = Se(e),
      a = Se(e),
      s = pe(e),
      c = pe(e),
      l = i === 1 ? 3e4 : 3e5;
    if (a > l || o > l) throw new Error(`Invalid size: ${a}x${o}`);
    if (r > 16) throw new Error(`Invalid channel count: ${r}`);
    if (![1, 8, 16, 32].includes(s)) throw new Error(`Invalid bitsPerChannel: ${s}`);
    if (q.supportedColorModes.indexOf(c) === -1)
      throw new Error(`Color mode not supported: ${(t = qm[c]) !== null && t !== void 0 ? t : c}`);
    let f = { width: a, height: o, channels: r, bitsPerChannel: s, colorMode: c };
    (Object.assign(e, n),
      (e.large = i === 2),
      (e.globalAlpha = !1),
      'totalMemoryLimit' in e || (e.totalMemoryLimit = 2 * 1024 * 1024 * 1024),
      xt(e, 1, g => {
        if (g()) {
          if (c === 2) {
            if (g() != 768) throw new Error('Invalid color palette size');
            f.palette = [];
            for (let y = 0; y < 256; y++) f.palette.push({ r: Ae(e), g: 0, b: 0 });
            for (let y = 0; y < 256; y++) f.palette[y].g = Ae(e);
            for (let y = 0; y < 256; y++) f.palette[y].b = Ae(e);
          }
          De(e, g());
        }
      }));
    let d = {};
    xt(e, 1, g => {
      for (; g() > 0;) {
        su(e, r1);
        let y = pe(e);
        (go(e, 2),
          xt(e, 2, w => {
            let m = Ym.resourceHandlersMap[y],
              A = y === 1036 && !!e.skipThumbnail;
            if (m && !A)
              try {
                m.read(e, d, w);
              } catch (M) {
                if (e.throwForMissingFeatures) throw M;
                De(e, w());
              }
            else De(e, w());
          }));
      }
    });
    let { layersGroup: u, layerGroupsEnabledId: h } = d,
      p = Xm(d, ['layersGroup', 'layerGroupsEnabledId']);
    (Object.keys(p).length && (f.imageResources = p),
      xt(
        e,
        1,
        g => {
          if (
            (xt(
              e,
              2,
              y => {
                (eu(e, f, d), De(e, y()));
              },
              void 0,
              e.large
            ),
            g() > 0)
          ) {
            let y = au(e);
            y && (f.globalLayerMaskInfo = y);
          } else De(e, g());
          for (; g() > 0;) {
            for (; g() && Kf(e) === 0;) De(e, 1);
            g() >= 12 ? os(e, f, f, d) : De(e, g());
          }
        },
        void 0,
        e.large
      ));
    let _ = f.children && f.children.length;
    if (!(e.skipCompositeImageData && (e.skipLayerImageData || _)))
      if (e.useRawData)
        f.rawCompositeData = new Uint8Array(e.view.buffer, e.view.byteOffset + e.offset);
      else {
        let g = lu(e, f);
        e.useImageData ? (f.imageData = g) : (f.canvas = (0, Be.imageDataToCanvas)(g));
      }
    return f;
  }
  function eu(e, n, t) {
    var i, r;
    let { layersGroup: o = [], layerGroupsEnabledId: a = [] } = t,
      s = pn(e);
    s < 0 && ((e.globalAlpha = !0), (s = -s));
    let c = [],
      l = [];
    for (let d = 0; d < s; d++) {
      let { layer: u, channels: h } = a1(e, n, t);
      (o[d] !== void 0 && (u.linkGroup = o[d]),
        a[d] !== void 0 && (u.linkGroupEnabled = !!a[d]),
        c.push(u),
        l.push(h));
    }
    for (let d = 0; d < s; d++) c1(e, n, c[d], l[d]);
    n.children || (n.children = []);
    let f = [n];
    for (let d = c.length - 1; d >= 0; d--) {
      let u = c[d],
        h = u.sectionDivider ? u.sectionDivider.type : 0;
      h === 1 || h === 2
        ? ((u.opened = h === 1),
          (u.children = []),
          !((i = u.sectionDivider) === null || i === void 0) &&
            i.key &&
            (u.blendMode =
              (r = Be.toBlendMode[u.sectionDivider.key]) !== null && r !== void 0
                ? r
                : u.blendMode),
          f[f.length - 1].children.unshift(u),
          f.push(u))
        : h === 3
          ? f.pop()
          : f[f.length - 1].children.unshift(u);
    }
  }
  function a1(e, n, t) {
    let i = {};
    if (((i.top = $e(e)), (i.left = $e(e)), (i.bottom = $e(e)), (i.right = $e(e)), !es(i, e)))
      throw new Error('Invalid layer size');
    let r = pe(e),
      o = [];
    for (let c = 0; c < r; c++) {
      let l = pn(e),
        f = Se(e);
      if (e.large) {
        if (f !== 0) throw new Error('Sizes larger than 4GB are not supported');
        f = Se(e);
      }
      o.push({ id: l, length: f });
    }
    rs(e, '8BIM');
    let a = qi(e);
    if (!Be.toBlendMode[a]) throw new Error(`Invalid blend mode: '${a}'`);
    ((i.blendMode = Be.toBlendMode[a]), (i.opacity = Ae(e) / 255), (i.clipping = Ae(e) === 1));
    let s = Ae(e);
    return (
      (i.transparencyProtected = (s & 1) !== 0),
      (i.hidden = (s & 2) !== 0),
      s & 32 && (i.effectsOpen = !0),
      De(e, 1),
      xt(e, 1, c => {
        s1(e, i);
        let l = l1(e);
        for (l && (i.blendingRanges = l), i.name = go(e, 1); c() > 4 && !Yf(e, e.offset);)
          e.offset++;
        for (; c() >= 12;) os(e, i, n, t);
        De(e, c());
      }),
      { layer: i, channels: o }
    );
  }
  function es(e, n) {
    let t = (e.right || 0) - (e.left || 0),
      i = (e.bottom || 0) - (e.top || 0),
      r = n.large ? 3e5 : 3e4;
    return t >= 0 && i >= 0 && t <= r && i <= r;
  }
  function s1(e, n) {
    return xt(e, 1, t => {
      if (!t()) return;
      let i = {};
      if (
        ((n.mask = i),
        (i.top = $e(e)),
        (i.left = $e(e)),
        (i.bottom = $e(e)),
        (i.right = $e(e)),
        !es(i, e))
      )
        throw new Error('Invalid mask size');
      i.defaultColor = Ae(e);
      let r = Ae(e);
      if (
        ((i.positionRelativeToLayer = (r & 1) !== 0),
        (i.disabled = (r & 2) !== 0),
        (i.fromVectorData = (r & 8) !== 0),
        t() >= 18)
      ) {
        let o = {};
        n.realMask = o;
        let a = Ae(e);
        if (
          ((o.positionRelativeToLayer = (a & 1) !== 0),
          (o.disabled = (a & 2) !== 0),
          (o.fromVectorData = (a & 8) !== 0),
          (o.defaultColor = Ae(e)),
          (o.top = $e(e)),
          (o.left = $e(e)),
          (o.bottom = $e(e)),
          (o.right = $e(e)),
          !es(o, e))
        )
          throw new Error('Invalid realMask size');
      }
      if (r & 16) {
        let o = Ae(e);
        (o & 1 && (i.userMaskDensity = Ae(e) / 255),
          o & 2 && (i.userMaskFeather = Qa(e)),
          o & 4 && (i.vectorMaskDensity = Ae(e) / 255),
          o & 8 && (i.vectorMaskFeather = Qa(e)));
      }
      De(e, t());
    });
  }
  function co(e) {
    return [Ae(e), Ae(e), Ae(e), Ae(e)];
  }
  function l1(e) {
    return xt(e, 1, n => {
      let t = co(e),
        i = co(e),
        r = [];
      for (; n() > 0;) {
        let o = co(e),
          a = co(e);
        r.push({ sourceRange: o, destRange: a });
      }
      return { compositeGrayBlendSource: t, compositeGraphBlendDestinationRange: i, ranges: r };
    });
  }
  function c1(e, n, t, i) {
    if (e.skipLayerImageData) return;
    let { colorMode: r = 3, bitsPerChannel: o = 8 } = n;
    t.rawData = { colorMode: r, bitsPerChannel: o, channels: [], large: e.large };
    for (let a of i) {
      let s = e.offset,
        c = 0,
        l;
      if (a.length === 1) throw new Error('Invalid channel length');
      if (a.length) {
        if (
          ((c = pe(e)),
          c > 3 && ((e.offset -= 1), (c = pe(e))),
          c > 3 && ((e.offset -= 3), (c = pe(e))),
          c > 3)
        )
          throw new Error(`Invalid compression: ${c}`);
        a.length > 2 && (l = Pt(e, a.length - 2));
      }
      ((e.offset = s + a.length), t.rawData.channels.push({ id: a.id, compression: c, data: l }));
    }
    e.useRawData || ou(t, e);
  }
  function Zf({ data: e }, n) {
    let t = e instanceof Float32Array ? 1 : e instanceof Uint16Array ? 65535 : 255,
      i = (n ? 4 : 3) | 0,
      r = e.length | 0,
      o = (n ? 5 : 4) | 0;
    for (let a = i; a < r; a = (a + o) | 0) e[a] = t;
  }
  function tu(e) {
    let n = e.rawCompositeData;
    if (!n) return;
    let t = po(n.buffer, n.byteOffset, n.byteLength);
    return lu(t, e);
  }
  function f1(e) {
    return mo(tu(e));
  }
  function nu(e) {
    return ci(e, nt.Layer, !1, void 0);
  }
  function iu(e) {
    return ci(e, nt.Mask, !1, void 0);
  }
  function ru(e) {
    return ci(e, nt.RealMask, !1, void 0);
  }
  function u1(e) {
    return mo(nu(e));
  }
  function d1(e) {
    return mo(iu(e));
  }
  function h1(e) {
    return mo(ru(e));
  }
  function mo(e) {
    return e && (0, Be.imageDataToCanvas)(e);
  }
  function qa(e, n, t) {
    n && (t ? (e.imageData = n) : (e.canvas = (0, Be.imageDataToCanvas)(n)));
  }
  function p1(e, n) {
    ou(e, { useImageData: n });
  }
  function ou(e, n) {
    var t, i, r;
    let { throwForMissingFeatures: o, useImageData: a } = n,
      s = ci(e, nt.Layer, o, n.totalMemoryLimit);
    if (
      (qa(e, s, a),
      n.totalMemoryLimit !== void 0 &&
        (n.totalMemoryLimit -= (t = s?.data.byteLength) !== null && t !== void 0 ? t : 0),
      e.mask)
    ) {
      let c = ci(e, nt.Mask, o, n.totalMemoryLimit);
      (qa(e.mask, c, a),
        n.totalMemoryLimit !== void 0 &&
          (n.totalMemoryLimit -= (i = c?.data.byteLength) !== null && i !== void 0 ? i : 0));
    }
    if (e.realMask) {
      let c = ci(e, nt.RealMask, o, n.totalMemoryLimit);
      (qa(e.realMask, c, a),
        n.totalMemoryLimit !== void 0 &&
          (n.totalMemoryLimit -= (r = c?.data.byteLength) !== null && r !== void 0 ? r : 0));
    }
    delete e.rawData;
  }
  var nt;
  (function (e) {
    ((e[(e.Layer = 0)] = 'Layer'), (e[(e.Mask = 1)] = 'Mask'), (e[(e.RealMask = 2)] = 'RealMask'));
  })(nt || (nt = {}));
  function ci(e, n, t, i) {
    if (!e.rawData) return;
    let { colorMode: r, bitsPerChannel: o, channels: a, large: s } = e.rawData,
      c = Math.max(0, (e.right || 0) - (e.left || 0)),
      l = Math.max(0, (e.bottom || 0) - (e.top || 0)),
      f = r === 4,
      d,
      u,
      h = !1;
    if (c && l && n === nt.Layer)
      if (f) {
        if (o !== 8) throw new Error('bitsPerChannel Not supproted');
        d = { width: c, height: l, data: new Uint8ClampedArray(c * l * 5) };
      } else d = ts(c, l, o, 4, i);
    Be.RAW_IMAGE_DATA && ((e.imageDataRaw = []), (e.imageDataRawCompression = []));
    for (let { id: p, compression: _, data: b } of a) {
      if (!b) continue;
      let g = po(b.buffer, b.byteOffset, b.byteLength);
      if (p === -2 || p === -3) {
        if ((p === -2 && n !== nt.Mask) || (p === -3 && n !== nt.RealMask)) continue;
        let y = p === -2 ? e.mask : e.realMask;
        if (!y) throw new Error(`Missing layer ${p === -2 ? 'mask' : 'real mask'} data`);
        let w = Math.max(0, (y.right || 0) - (y.left || 0)),
          m = Math.max(0, (y.bottom || 0) - (y.top || 0));
        w &&
          m &&
          ((u = ts(w, m, o, 4, i)),
          Hf(g, b.byteLength, u, _, w, m, o, 0, s, 4),
          Be.RAW_IMAGE_DATA &&
            (p === -2
              ? ((e.maskDataRawCompression = _), (e.maskDataRaw = b))
              : ((e.realMaskDataRawCompression = _), (e.realMaskDataRaw = b))),
          fo(u),
          Zf(u, !1));
      } else {
        if (n !== nt.Layer) continue;
        let y = (0, Be.offsetForChannel)(p, f),
          w = d;
        if (y < 0 && ((w = void 0), t)) throw new Error(`Channel not supported: ${p}`);
        (Hf(g, b.byteLength, w, _, c, l, o, y, s, f ? 5 : 4),
          Be.RAW_IMAGE_DATA && ((e.imageDataRawCompression[p] = _), (e.imageDataRaw[p] = b)),
          w && r === 1 && fo(w));
      }
      p === -1 && (h = !0);
    }
    if (d && (h || Zf(d, f), f)) {
      let p = d;
      ((d = (0, Be.createImageData)(p.width, p.height)), cu(p, d, !1));
    }
    return n === nt.Layer ? d : u;
  }
  function Hf(e, n, t, i, r, o, a, s, c, l) {
    if (n)
      if (i === 0) {
        n !== r * o * Math.floor(a / 8) &&
          e.log(`Invalid length (${n}, ${r * o * Math.floor(a / 8)})`);
        let f = Pt(e, n);
        uu(f, t, a, l, s);
      } else if (i === 1) hn(e, t, r, o, a, l, [s], c);
      else if (i === 2) {
        let f = Pt(e, n);
        is(f, t, r, o, a, l, s, !1);
      } else if (i === 3) {
        let f = Pt(e, n);
        is(f, t, r, o, a, l, s, !0);
      } else throw new Error(`Invalid Compression type: ${i}`);
  }
  function au(e) {
    return xt(e, 1, n => {
      if (!n()) return;
      let t = pe(e),
        i = pe(e),
        r = pe(e),
        o = pe(e),
        a = pe(e),
        s = pe(e) / 255,
        c = Ae(e);
      return (
        De(e, n()),
        {
          overlayColorSpace: t,
          colorSpace1: i,
          colorSpace2: r,
          colorSpace3: o,
          colorSpace4: a,
          opacity: s,
          kind: c,
        }
      );
    });
  }
  var g1 = [0, 1, -1, 2, -2, 3, -3, 4, -4];
  function su(e, n) {
    let t = e.offset,
      i = '';
    for (let r of g1) {
      try {
        ((e.offset = t + r), (i = qi(e)));
      } catch {}
      if (n(i)) break;
    }
    if (!n(i)) throw new Error(`Invalid signature: '${i}' at 0x${t.toString(16)}`);
    return i;
  }
  function m1(e) {
    return e === '8BIM' || e === '8B64';
  }
  function os(e, n, t, i) {
    let r = su(e, m1),
      o = qi(e),
      a = r === '8B64' || (e.large && Be.largeAdditionalInfoKeys.indexOf(o) !== -1);
    xt(
      e,
      2,
      s => {
        let c = Wm.infoHandlersMap[o];
        if (c)
          try {
            c.read(e, n, s, t, i);
          } catch (l) {
            if (e.throwForMissingFeatures) throw l;
          }
        else (e.logMissingFeatures && e.log(`Unhandled additional info: ${o}`), De(e, s()));
        s() &&
          (e.logMissingFeatures && e.log(`Unread ${s()} bytes left for additional info: ${o}`),
          De(e, s()));
      },
      !1,
      a
    );
  }
  function ts(e, n, t, i, r) {
    let o = e * n * i * Math.max(1, t / 8);
    if (r !== void 0 && o > r) throw new Error('Exceeded memory limit');
    if (t === 1 || t === 8)
      return i === 4
        ? (0, Be.createImageData)(e, n)
        : { width: e, height: n, data: new Uint8ClampedArray(e * n * i) };
    if (t === 16) return { width: e, height: n, data: new Uint16Array(e * n * i) };
    if (t === 32) return { width: e, height: n, data: new Float32Array(e * n * i) };
    throw new Error(`Invalid bitDepth (${t})`);
  }
  function lu(e, n) {
    var t;
    let i = pe(e),
      r = (t = n.bitsPerChannel) !== null && t !== void 0 ? t : 8;
    if (q.supportedColorModes.indexOf(n.colorMode) === -1)
      throw new Error(`Color mode not supported: ${n.colorMode}`);
    if (i !== 0 && i !== 1) throw new Error(`Compression type not supported: ${i}`);
    let o = ts(n.width, n.height, r, 4, e.totalMemoryLimit);
    switch (
      (e.totalMemoryLimit !== void 0 && (e.totalMemoryLimit -= o.data.byteLength),
      (0, Be.resetImageData)(o),
      n.colorMode)
    ) {
      case 0: {
        if (r !== 1) throw new Error('Invalid bitsPerChannel for bitmap color mode');
        let a;
        if (i === 0) a = Pt(e, Math.ceil(n.width / 8) * n.height);
        else if (i === 1)
          ((a = new Uint8Array(n.width * n.height)),
            hn(
              e,
              { data: a, width: n.width, height: n.height },
              n.width,
              n.height,
              8,
              1,
              [0],
              e.large
            ));
        else throw new Error(`Compression not supported: ${i}`);
        (0, Be.decodeBitmap)(a, o.data, n.width, n.height);
        break;
      }
      case 3:
      case 1: {
        let a = n.colorMode === 1 ? [0] : [0, 1, 2];
        if (n.channels && n.channels > 3) for (let s = 3; s < n.channels; s++) a.push(s);
        else e.globalAlpha && a.push(3);
        if (i === 0)
          for (let s = 0; s < a.length; s++) {
            let c = Pt(e, n.width * n.height * Math.floor(r / 8));
            uu(c, o, r, 4, a[s]);
          }
        else if (i === 1) {
          let s = e.offset;
          (hn(e, o, n.width, n.height, r, 4, a, e.large),
            Be.RAW_IMAGE_DATA &&
              (n.imageDataRaw = new Uint8Array(
                e.view.buffer,
                e.view.byteOffset + s,
                e.offset - s
              )));
        } else throw new Error(`Compression not supported: ${i}`);
        n.colorMode === 1 && fo(o);
        break;
      }
      case 2: {
        if (r !== 8) throw new Error('bitsPerChannel Not supproted');
        if (n.channels !== 1) throw new Error('Invalid channel count');
        if (!n.palette) throw new Error('Missing color palette');
        if (i === 0) throw new Error(`Compression not supported: ${i}`);
        if (i === 1) {
          let a = { width: o.width, height: o.height, data: new Uint8Array(o.width * o.height) };
          (hn(e, a, n.width, n.height, r, 1, [0], e.large), b1(a, o, n.palette));
        } else throw new Error(`Compression not supported: ${i}`);
        break;
      }
      case 4: {
        if (r !== 8) throw new Error('bitsPerChannel Not supproted');
        if (n.channels !== 4) throw new Error('Invalid channel count');
        let a = [0, 1, 2, 3];
        if ((e.globalAlpha && a.push(4), i === 0))
          throw new Error(`Compression not supported: ${i}`);
        if (i === 1) {
          let s = {
              width: o.width,
              height: o.height,
              data: new Uint8Array(o.width * o.height * 5),
            },
            c = e.offset;
          (hn(e, s, n.width, n.height, r, 5, a, e.large),
            cu(s, o, !0),
            Be.RAW_IMAGE_DATA &&
              (n.imageDataRaw = new Uint8Array(
                e.view.buffer,
                e.view.byteOffset + c,
                e.offset - c
              )));
        } else throw new Error(`Compression not supported: ${i}`);
        break;
      }
      default:
        throw new Error(`Color mode not supported: ${n.colorMode}`);
    }
    if (e.globalAlpha) {
      if (n.bitsPerChannel !== 8) throw new Error('bitsPerChannel Not supproted');
      let a = o.data,
        s = o.width * o.height * 4;
      for (let c = 0; c < s; c += 4) {
        let l = a[c + 3];
        if (l != 0 && l != 255) {
          let d = 1 / (l / 255),
            u = 255 * (1 - d);
          ((a[c + 0] = a[c + 0] * d + u),
            (a[c + 1] = a[c + 1] * d + u),
            (a[c + 2] = a[c + 2] * d + u));
        }
      }
    }
    return o;
  }
  function cu(e, n, t) {
    let i = n.width * n.height * 4,
      r = e.data,
      o = n.data;
    for (let a = 0, s = 0; s < i; a += 5, s += 4) {
      let c = r[a],
        l = r[a + 1],
        f = r[a + 2],
        d = r[a + 3];
      ((o[s] = (((c * d) | 0) / 255) | 0),
        (o[s + 1] = (((l * d) | 0) / 255) | 0),
        (o[s + 2] = (((f * d) | 0) / 255) | 0),
        (o[s + 3] = t ? 255 - r[a + 4] : r[a + 4]));
    }
  }
  function b1(e, n, t) {
    let i = e.width * e.height,
      r = e.data,
      o = n.data;
    for (let a = 0, s = 0; a < i; a++, s += 4) {
      let c = t[r[a]];
      ((o[s + 0] = c.r), (o[s + 1] = c.g), (o[s + 2] = c.b), (o[s + 3] = 255));
    }
  }
  function y1(e, n) {
    if (e.byteLength / e.length !== n.byteLength / n.length) throw new Error('Invalid array types');
  }
  function fu(e, n) {
    if (n === 8) return e;
    if (n === 16) {
      for (let t = 0; t < e.byteLength; t += 2) {
        let i = e[t];
        ((e[t] = e[t + 1]), (e[t + 1] = i));
      }
      if (e.byteOffset % 2) {
        let t = new Uint16Array(e.byteLength / 2);
        return (new Uint8Array(t.buffer, t.byteOffset, t.byteLength).set(e), t);
      } else return new Uint16Array(e.buffer, e.byteOffset, e.byteLength / 2);
    } else if (n === 32)
      if (e.byteOffset % 4) {
        let t = new Float32Array(e.byteLength / 4);
        return (new Uint8Array(t.buffer, t.byteOffset, t.byteLength).set(e), t);
      } else return new Float32Array(e.buffer, e.byteOffset, e.byteLength / 4);
    else throw new Error(`Invalid bitDepth (${n})`);
  }
  function ns(e, n, t, i) {
    y1(e.data, n);
    let r = e.width * e.height,
      o = e.data;
    for (let a = 0, s = t | 0; a < r; a++, s = (s + i) | 0) o[s] = n[a];
  }
  function uu(e, n, t, i, r) {
    if (t == 32)
      for (let a = 0; a < e.byteLength; a += 4) {
        let s = e[a + 0],
          c = e[a + 1],
          l = e[a + 2],
          f = e[a + 3];
        ((e[a + 0] = f), (e[a + 1] = l), (e[a + 2] = c), (e[a + 3] = s));
      }
    let o = fu(e, t);
    n && r < i && ns(n, o, r, i);
  }
  function Ja(e, n, t, i) {
    for (let r = 0; r < t; r++) {
      let o = r * n;
      for (let a = 1, s = o + 1; a < n; a++, s++) e[s] = (e[s - 1] + e[s]) % i;
    }
  }
  function is(e, n, t, i, r, o, a, s) {
    let c = (0, Km.inflate)(e);
    if (n && a < o) {
      let l = fu(c, r);
      if (r === 8) (s && Ja(c, t, i, 256), ns(n, c, a, o));
      else if (r === 16) (s && Ja(l, t, i, 65536), ns(n, l, a, o));
      else if (r === 32) {
        s && Ja(c, t * 4, i, 256);
        let f = a,
          d = new Uint32Array(n.data.buffer, n.data.byteOffset, n.data.length);
        for (let u = 0; u < i; u++) {
          let h = t * 4 * u;
          for (let p = 0; p < t; p++, h++, f += o) {
            let _ = h + t,
              b = _ + t,
              g = b + t;
            d[f] = ((c[h] << 24) | (c[_] << 16) | (c[b] << 8) | c[g]) >>> 0;
          }
        }
      } else throw new Error('Invalid bitDepth');
    }
  }
  function hn(e, n, t, i, r, o, a, s) {
    let c = n && n.data,
      l;
    if (s) {
      (ho(e, a.length * i * 4), (l = new Uint32Array(a.length * i)));
      for (let d = 0, u = 0; d < a.length; d++) for (let h = 0; h < i; h++, u++) l[u] = Se(e);
    } else {
      (ho(e, a.length * i * 2), (l = new Uint16Array(a.length * i)));
      for (let d = 0, u = 0; d < a.length; d++) for (let h = 0; h < i; h++, u++) l[u] = pe(e);
    }
    let f = (o - 1) | 0;
    for (let d = 0, u = 0; d < a.length; d++) {
      let h = a[d] | 0,
        p = d > f || h > f;
      if (!c || p) for (let _ = 0; _ < i; _++, u++) De(e, l[u]);
      else
        for (let _ = 0, b = h | 0; _ < i; _++, u++) {
          let g = l[u],
            y = Pt(e, g);
          for (let w = 0, m = 0; w < g; w++) {
            let A = y[w];
            if (A > 128) {
              let M = y[++w];
              A = (256 - A) | 0;
              for (let k = 0; k <= A && m < t; k = (k + 1) | 0, m = (m + 1) | 0)
                ((c[b] = M), (b = (b + o) | 0));
            } else if (A < 128)
              for (let M = 0; M <= A && m < t; M = (M + 1) | 0, m = (m + 1) | 0)
                ((c[b] = y[++w]), (b = (b + o) | 0));
          }
        }
    }
    du(e, l.byteLength);
  }
  function xt(e, n, t, i = !0, r = !1) {
    let o = Se(e);
    if (r) {
      if (o !== 0) throw new Error('Sizes larger than 4GB are not supported');
      o = Se(e);
    }
    if (o <= 0 && i) return;
    let a = e.offset + o;
    if (a > e.view.byteLength) throw new Error('Section exceeds file size');
    let s = t(() => a - e.offset);
    for (
      e.offset !== a &&
      (e.offset > a ? uo(e, 'Exceeded section limits') : uo(e, 'Unread section data'));
      o % n;
    )
      (o++, a++);
    return ((e.offset = a), s);
  }
  function w1(e) {
    switch (pe(e)) {
      case 0: {
        let t = pe(e) / 257,
          i = pe(e) / 257,
          r = pe(e) / 257;
        return (De(e, 2), { r: t, g: i, b: r });
      }
      case 1: {
        let t = pe(e) / 65535,
          i = pe(e) / 65535,
          r = pe(e) / 65535;
        return (De(e, 2), { h: t, s: i, b: r });
      }
      case 2: {
        let t = pe(e) / 257,
          i = pe(e) / 257,
          r = pe(e) / 257,
          o = pe(e) / 257;
        return { c: t, m: i, y: r, k: o };
      }
      case 7: {
        let t = pn(e) / 1e4,
          i = pn(e),
          r = pn(e),
          o = i < 0 ? i / 12800 : i / 12700,
          a = r < 0 ? r / 12800 : r / 12700;
        return (De(e, 2), { l: t, a: o, b: a });
      }
      case 8: {
        let t = (pe(e) * 255) / 1e4;
        return (De(e, 6), { k: t });
      }
      default:
        throw new Error('Invalid color space');
    }
  }
  function _1(e) {
    let n = Se(e);
    for (; n % 4;) n++;
    let t = e.offset + n,
      i = Se(e);
    if (i !== 1) throw new Error(`Invalid pattern version: ${i}`);
    let r = Se(e),
      o = pn(e),
      a = pn(e);
    if (r !== 3 && r !== 1 && r !== 2) throw new Error(`Unsupported pattern color mode: ${r}`);
    let s = qf(e),
      c = go(e, 1),
      l = [];
    if (r === 2) {
      for (let m = 0; m < 256; m++) l.push({ r: Ae(e), g: Ae(e), b: Ae(e) });
      De(e, 4);
    }
    let f = Se(e);
    if (f !== 3) throw new Error(`Invalid pattern VMAL version: ${f}`);
    Se(e);
    let d = Se(e),
      u = Se(e),
      h = Se(e),
      p = Se(e),
      _ = Se(e),
      b = p - u,
      g = h - d,
      y = b * g * 4;
    ho(e, y);
    let w = new Uint8Array(y);
    for (let m = 3; m < w.byteLength; m += 4) w[m] = 255;
    for (let m = 0, A = 0; m < _ + 2; m++) {
      if (!Se(e)) continue;
      let k = Se(e),
        E = Se(e),
        F = Se(e),
        I = Se(e),
        C = Se(e),
        B = Se(e),
        ee = pe(e),
        $ = Ae(e),
        U = k - 23,
        V = Pt(e, U);
      if (E !== 8 || ee !== 8) throw new Error('16bit pixel depth not supported for patterns');
      let X = B - I,
        ie = C - F,
        H = I - u,
        R = F - d;
      if ($ === 0) {
        if (r === 3 && A < 3)
          for (let P = 0; P < ie; P++)
            for (let N = 0; N < X; N++) {
              let z = N + P * X,
                Z = (H + N + (P + R) * b) * 4;
              w[Z + A] = V[z];
            }
        else if (r === 1 && A < 1)
          for (let P = 0; P < ie; P++)
            for (let N = 0; N < X; N++) {
              let z = N + P * X,
                Z = (H + N + (P + R) * b) * 4,
                te = V[z];
              ((w[Z + 0] = te), (w[Z + 1] = te), (w[Z + 2] = te));
            }
        else if (r === 2)
          for (let P = 0; P < ie; P++)
            for (let N = 0; N < X; N++) {
              let z = N + P * X,
                Z = (H + N + (P + R) * b) * 4,
                te = V[z],
                Y = l[te];
              ((w[Z + 0] = Y.r), (w[Z + 1] = Y.g), (w[Z + 2] = Y.b));
            }
        else if (e.throwForMissingFeatures) throw new Error('Invalid color pattern');
      } else if ($ === 1) {
        ho(e, X * ie);
        let P = { data: w, width: b, height: g },
          N = { data: new Uint8Array(X * ie), width: X, height: ie },
          z = po(V.buffer, V.byteOffset, V.byteLength);
        if (
          (r === 3 && A < 3 && (hn(z, N, X, ie, 8, 1, [0], !1), Xf(N, P, H, R, A)),
          r === 1 && A < 1 && (hn(z, N, X, ie, 8, 1, [0], !1), Xf(N, P, H, R, 0), fo(P)),
          r === 2)
        )
          throw new Error('Indexed pattern color mode not implemented');
        du(e, X * ie);
      } else throw new Error('Invalid pattern compression mode');
      A++;
    }
    return (
      (e.offset = t),
      { id: c, name: s, x: o, y: a, bounds: { x: u, y: d, w: b, h: g }, data: w }
    );
  }
  function Xf(e, n, t, i, r) {
    let o = e.width,
      a = e.height,
      s = n.width;
    for (let c = 0; c < a; c++)
      for (let l = 0; l < o; l++) {
        let f = l + c * o,
          d = (t + l + (c + i) * s) * 4,
          u = e.data[f];
        n.data[d + r] = u;
      }
  }
  function ho(e, n) {
    if (e.totalMemoryLimit !== void 0) {
      if (e.totalMemoryLimit < n) throw new Error('Exceeded memory limit');
      e.totalMemoryLimit -= n;
    }
  }
  function du(e, n) {
    e.totalMemoryLimit !== void 0 && (e.totalMemoryLimit += n);
  }
});
var mu = he(yo => {
  'use strict';
  Object.defineProperty(yo, '__esModule', { value: !0 });
  yo.readEffects = v1;
  yo.writeEffects = x1;
  var pu = fn(),
    K = un(),
    G = li(),
    gu = [void 0, 'outer bevel', 'inner bevel', 'emboss', 'pillow emboss', 'stroke emboss'];
  function fi(e) {
    return ((0, K.checkSignature)(e, '8BIM'), pu.toBlendMode[(0, K.readSignature)(e)] || 'normal');
  }
  function di(e, n) {
    ((0, G.writeSignature)(e, '8BIM'), (0, G.writeSignature)(e, pu.fromBlendMode[n] || 'norm'));
  }
  function ui(e) {
    return (0, K.readUint8)(e) / 255;
  }
  function hi(e, n) {
    (0, G.writeUint8)(e, Math.round(n * 255) | 0);
  }
  function v1(e) {
    let n = (0, K.readUint16)(e);
    if (n !== 0) throw new Error(`Invalid effects layer version: ${n}`);
    let t = (0, K.readUint16)(e),
      i = {};
    for (let r = 0; r < t; r++) {
      (0, K.checkSignature)(e, '8BIM');
      let o = (0, K.readSignature)(e);
      switch (o) {
        case 'cmnS': {
          let a = (0, K.readUint32)(e),
            s = (0, K.readUint32)(e),
            c = !!(0, K.readUint8)(e);
          if (((0, K.skipBytes)(e, 2), a !== 7 || s !== 0 || !c))
            throw new Error('Invalid effects common state');
          break;
        }
        case 'dsdw':
        case 'isdw': {
          let a = (0, K.readUint32)(e),
            s = (0, K.readUint32)(e);
          if (a !== 41 && a !== 51) throw new Error(`Invalid shadow size: ${a}`);
          if (s !== 0 && s !== 2) throw new Error(`Invalid shadow version: ${s}`);
          let c = (0, K.readFixedPoint32)(e);
          (0, K.readFixedPoint32)(e);
          let l = (0, K.readFixedPoint32)(e),
            f = (0, K.readFixedPoint32)(e),
            d = (0, K.readColor)(e),
            u = fi(e),
            h = !!(0, K.readUint8)(e),
            p = !!(0, K.readUint8)(e),
            _ = ui(e);
          a >= 51 && (0, K.readColor)(e);
          let b = {
            size: { units: 'Pixels', value: c },
            distance: { units: 'Pixels', value: f },
            angle: l,
            color: d,
            blendMode: u,
            enabled: h,
            useGlobalLight: p,
            opacity: _,
          };
          o === 'dsdw' ? (i.dropShadow = [b]) : (i.innerShadow = [b]);
          break;
        }
        case 'oglw': {
          let a = (0, K.readUint32)(e),
            s = (0, K.readUint32)(e);
          if (a !== 32 && a !== 42) throw new Error(`Invalid outer glow size: ${a}`);
          if (s !== 0 && s !== 2) throw new Error(`Invalid outer glow version: ${s}`);
          let c = (0, K.readFixedPoint32)(e);
          (0, K.readFixedPoint32)(e);
          let l = (0, K.readColor)(e),
            f = fi(e),
            d = !!(0, K.readUint8)(e),
            u = ui(e);
          (a >= 42 && (0, K.readColor)(e),
            (i.outerGlow = {
              size: { units: 'Pixels', value: c },
              color: l,
              blendMode: f,
              enabled: d,
              opacity: u,
            }));
          break;
        }
        case 'iglw': {
          let a = (0, K.readUint32)(e),
            s = (0, K.readUint32)(e);
          if (a !== 32 && a !== 43) throw new Error(`Invalid inner glow size: ${a}`);
          if (s !== 0 && s !== 2) throw new Error(`Invalid inner glow version: ${s}`);
          let c = (0, K.readFixedPoint32)(e);
          (0, K.readFixedPoint32)(e);
          let l = (0, K.readColor)(e),
            f = fi(e),
            d = !!(0, K.readUint8)(e),
            u = ui(e);
          (a >= 43 && ((0, K.readUint8)(e), (0, K.readColor)(e)),
            (i.innerGlow = {
              size: { units: 'Pixels', value: c },
              color: l,
              blendMode: f,
              enabled: d,
              opacity: u,
            }));
          break;
        }
        case 'bevl': {
          let a = (0, K.readUint32)(e),
            s = (0, K.readUint32)(e);
          if (a !== 58 && a !== 78) throw new Error(`Invalid bevel size: ${a}`);
          if (s !== 0 && s !== 2) throw new Error(`Invalid bevel version: ${s}`);
          let c = (0, K.readFixedPoint32)(e),
            l = (0, K.readFixedPoint32)(e),
            f = (0, K.readFixedPoint32)(e),
            d = fi(e),
            u = fi(e),
            h = (0, K.readColor)(e),
            p = (0, K.readColor)(e),
            _ = gu[(0, K.readUint8)(e)] || 'inner bevel',
            b = ui(e),
            g = ui(e),
            y = !!(0, K.readUint8)(e),
            w = !!(0, K.readUint8)(e),
            m = (0, K.readUint8)(e) ? 'down' : 'up';
          (a >= 78 && ((0, K.readColor)(e), (0, K.readColor)(e)),
            (i.bevel = {
              size: { units: 'Pixels', value: f },
              angle: c,
              strength: l,
              highlightBlendMode: d,
              shadowBlendMode: u,
              highlightColor: h,
              shadowColor: p,
              style: _,
              highlightOpacity: b,
              shadowOpacity: g,
              enabled: y,
              useGlobalLight: w,
              direction: m,
            }));
          break;
        }
        case 'sofi': {
          let a = (0, K.readUint32)(e),
            s = (0, K.readUint32)(e);
          if (a !== 34) throw new Error(`Invalid effects solid fill info size: ${a}`);
          if (s !== 2) throw new Error(`Invalid effects solid fill info version: ${s}`);
          let c = fi(e),
            l = (0, K.readColor)(e),
            f = ui(e),
            d = !!(0, K.readUint8)(e);
          ((0, K.readColor)(e),
            (i.solidFill = [{ blendMode: c, color: l, opacity: f, enabled: d }]));
          break;
        }
        default:
          throw new Error(`Invalid effect type: '${o}'`);
      }
    }
    return i;
  }
  function hu(e, n) {
    var t;
    ((0, G.writeUint32)(e, 51),
      (0, G.writeUint32)(e, 2),
      (0, G.writeFixedPoint32)(e, (n.size && n.size.value) || 0),
      (0, G.writeFixedPoint32)(e, 0),
      (0, G.writeFixedPoint32)(e, n.angle || 0),
      (0, G.writeFixedPoint32)(e, (n.distance && n.distance.value) || 0),
      (0, G.writeColor)(e, n.color),
      di(e, n.blendMode),
      (0, G.writeUint8)(e, n.enabled ? 1 : 0),
      (0, G.writeUint8)(e, n.useGlobalLight ? 1 : 0),
      hi(e, (t = n.opacity) !== null && t !== void 0 ? t : 1),
      (0, G.writeColor)(e, n.color));
  }
  function x1(e, n) {
    var t, i, r, o, a, s;
    let c = (t = n.dropShadow) === null || t === void 0 ? void 0 : t[0],
      l = (i = n.innerShadow) === null || i === void 0 ? void 0 : i[0],
      f = n.outerGlow,
      d = n.innerGlow,
      u = n.bevel,
      h = (r = n.solidFill) === null || r === void 0 ? void 0 : r[0],
      p = 1;
    if (
      (c && p++,
      l && p++,
      f && p++,
      d && p++,
      u && p++,
      h && p++,
      (0, G.writeUint16)(e, 0),
      (0, G.writeUint16)(e, p),
      (0, G.writeSignature)(e, '8BIM'),
      (0, G.writeSignature)(e, 'cmnS'),
      (0, G.writeUint32)(e, 7),
      (0, G.writeUint32)(e, 0),
      (0, G.writeUint8)(e, 1),
      (0, G.writeZeros)(e, 2),
      c && ((0, G.writeSignature)(e, '8BIM'), (0, G.writeSignature)(e, 'dsdw'), hu(e, c)),
      l && ((0, G.writeSignature)(e, '8BIM'), (0, G.writeSignature)(e, 'isdw'), hu(e, l)),
      f &&
        ((0, G.writeSignature)(e, '8BIM'),
        (0, G.writeSignature)(e, 'oglw'),
        (0, G.writeUint32)(e, 42),
        (0, G.writeUint32)(e, 2),
        (0, G.writeFixedPoint32)(
          e,
          ((o = f.size) === null || o === void 0 ? void 0 : o.value) || 0
        ),
        (0, G.writeFixedPoint32)(e, 0),
        (0, G.writeColor)(e, f.color),
        di(e, f.blendMode),
        (0, G.writeUint8)(e, f.enabled ? 1 : 0),
        hi(e, f.opacity || 0),
        (0, G.writeColor)(e, f.color)),
      d &&
        ((0, G.writeSignature)(e, '8BIM'),
        (0, G.writeSignature)(e, 'iglw'),
        (0, G.writeUint32)(e, 43),
        (0, G.writeUint32)(e, 2),
        (0, G.writeFixedPoint32)(
          e,
          ((a = d.size) === null || a === void 0 ? void 0 : a.value) || 0
        ),
        (0, G.writeFixedPoint32)(e, 0),
        (0, G.writeColor)(e, d.color),
        di(e, d.blendMode),
        (0, G.writeUint8)(e, d.enabled ? 1 : 0),
        hi(e, d.opacity || 0),
        (0, G.writeUint8)(e, 0),
        (0, G.writeColor)(e, d.color)),
      u)
    ) {
      ((0, G.writeSignature)(e, '8BIM'),
        (0, G.writeSignature)(e, 'bevl'),
        (0, G.writeUint32)(e, 78),
        (0, G.writeUint32)(e, 2),
        (0, G.writeFixedPoint32)(e, u.angle || 0),
        (0, G.writeFixedPoint32)(e, u.strength || 0),
        (0, G.writeFixedPoint32)(
          e,
          ((s = u.size) === null || s === void 0 ? void 0 : s.value) || 0
        ),
        di(e, u.highlightBlendMode),
        di(e, u.shadowBlendMode),
        (0, G.writeColor)(e, u.highlightColor),
        (0, G.writeColor)(e, u.shadowColor));
      let _ = gu.indexOf(u.style);
      ((0, G.writeUint8)(e, _ <= 0 ? 1 : _),
        hi(e, u.highlightOpacity || 0),
        hi(e, u.shadowOpacity || 0),
        (0, G.writeUint8)(e, u.enabled ? 1 : 0),
        (0, G.writeUint8)(e, u.useGlobalLight ? 1 : 0),
        (0, G.writeUint8)(e, u.direction === 'down' ? 1 : 0),
        (0, G.writeColor)(e, u.highlightColor),
        (0, G.writeColor)(e, u.shadowColor));
    }
    h &&
      ((0, G.writeSignature)(e, '8BIM'),
      (0, G.writeSignature)(e, 'sofi'),
      (0, G.writeUint32)(e, 34),
      (0, G.writeUint32)(e, 2),
      di(e, h.blendMode),
      (0, G.writeColor)(e, h.color),
      hi(e, h.opacity || 0),
      (0, G.writeUint8)(e, h.enabled ? 1 : 0),
      (0, G.writeColor)(e, h.color));
  }
});
var wu = he(wo => {
  'use strict';
  Object.defineProperty(wo, '__esModule', { value: !0 });
  wo.parseEngineData = S1;
  wo.serializeEngineData = I1;
  function bu(e) {
    return e === 32 || e === 10 || e === 13 || e === 9;
  }
  function yu(e) {
    return (e >= 48 && e <= 57) || e === 46 || e === 45;
  }
  function S1(e) {
    let n = 0;
    function t() {
      for (; n < e.length && bu(e[n]);) n++;
    }
    function i() {
      let u = e[n];
      return (n++, u === 92 && ((u = e[n]), n++), u);
    }
    function r() {
      let u = '';
      if (e[n] === 41) return (n++, u);
      if (e[n] !== 254 || e[n + 1] !== 255) throw new Error('Invalid utf-16 BOM');
      for (n += 2; n < e.length && e[n] !== 41;) {
        let h = i(),
          p = i(),
          _ = (h << 8) | p;
        u += String.fromCharCode(_);
      }
      return (n++, u);
    }
    let o = null,
      a = [];
    function s(u) {
      a.length ? (c(u), a.push(u)) : (a.push(u), (o = u));
    }
    function c(u) {
      if (!a.length) throw new Error('Invalid data');
      let h = a[a.length - 1];
      if (typeof h == 'string') ((a[a.length - 2][h] = u), f());
      else if (Array.isArray(h)) h.push(u);
      else throw new Error('Invalid data');
    }
    function l(u) {
      a.length || s({});
      let h = a[a.length - 1];
      if (h && typeof h == 'string') c(u === 'nil' ? null : `/${u}`);
      else if (h && typeof h == 'object') a.push(u);
      else throw new Error('Invalid data');
    }
    function f() {
      if (!a.length) throw new Error('Invalid data');
      a.pop();
    }
    t();
    let d = e.length;
    for (; d > 0 && e[d - 1] === 0;) d--;
    for (; n < d;) {
      let u = n,
        h = e[u];
      if (h === 60 && e[u + 1] === 60) ((n += 2), s({}));
      else if (h === 62 && e[u + 1] === 62) ((n += 2), f());
      else if (h === 47) {
        n += 1;
        let p = n;
        for (; n < e.length && !bu(e[n]);) n++;
        let _ = '';
        for (let b = p; b < n; b++) _ += String.fromCharCode(e[b]);
        l(_);
      } else if (h === 40) ((n += 1), c(r()));
      else if (h === 91) ((n += 1), s([]));
      else if (h === 93) ((n += 1), f());
      else if (h === 110 && e[u + 1] === 117 && e[u + 2] === 108 && e[u + 3] === 108)
        ((n += 4), c(null));
      else if (h === 116 && e[u + 1] === 114 && e[u + 2] === 117 && e[u + 3] === 101)
        ((n += 4), c(!0));
      else if (
        h === 102 &&
        e[u + 1] === 97 &&
        e[u + 2] === 108 &&
        e[u + 3] === 115 &&
        e[u + 4] === 101
      )
        ((n += 5), c(!1));
      else if (yu(h)) {
        let p = '';
        for (; n < e.length && yu(e[n]);) ((p += String.fromCharCode(e[n])), n++);
        c(parseFloat(p));
      } else ((n += 1), console.log(`Invalid token '${String.fromCharCode(h)}' (${h}) at ${n}`));
      t();
    }
    return o;
  }
  var k1 = [
      'Axis',
      'XY',
      'Zone',
      'WordSpacing',
      'FirstLineIndent',
      'GlyphSpacing',
      'StartIndent',
      'EndIndent',
      'SpaceBefore',
      'SpaceAfter',
      'LetterSpacing',
      'Values',
      'GridSize',
      'GridLeading',
      'PointBase',
      'BoxBounds',
      'TransformPoint0',
      'TransformPoint1',
      'TransformPoint2',
      'FontSize',
      'Leading',
      'HorizontalScale',
      'VerticalScale',
      'BaselineShift',
      'Tsume',
      'OutlineWidth',
      'AutoLeading',
    ],
    A1 = ['RunLengthArray'];
  function I1(e, n = !1) {
    let t = new Uint8Array(1024),
      i = 0,
      r = 0;
    function o(_) {
      if (i >= t.length) {
        let b = new Uint8Array(t.length * 2);
        (b.set(t), (t = b));
      }
      ((t[i] = _), i++);
    }
    function a(_) {
      for (let b = 0; b < _.length; b++) o(_.charCodeAt(b));
    }
    function s() {
      if (n) a(' ');
      else for (let _ = 0; _ < r; _++) a('	');
    }
    function c(_, b) {
      (s(),
        a(`/${_}`),
        p(b, _, !0),
        n ||
          a(`
`));
    }
    function l(_) {
      return _.toString();
    }
    function f(_) {
      return _.toFixed(5)
        .replace(/(\d)0+$/g, '$1')
        .replace(/^0+\.([1-9])/g, '.$1')
        .replace(/^-0+\.0(\d)/g, '-.0$1');
    }
    function d(_, b) {
      return (b && k1.indexOf(b) !== -1) || (_ | 0) !== _ ? f(_) : l(_);
    }
    function u(_) {
      let b = Object.keys(_);
      return (
        b.indexOf('98') !== -1 && b.unshift(...b.splice(b.indexOf('98'), 1)),
        b.indexOf('99') !== -1 && b.unshift(...b.splice(b.indexOf('99'), 1)),
        b
      );
    }
    function h(_) {
      ((_ === 40 || _ === 41 || _ === 92) && o(92), o(_));
    }
    function p(_, b, g = !1) {
      function y() {
        g ? a(' ') : s();
      }
      if (_ === null) (y(), a(n ? '/nil' : 'null'));
      else if (typeof _ == 'number') (y(), a(d(_, b)));
      else if (typeof _ == 'boolean') (y(), a(_ ? 'true' : 'false'));
      else if (typeof _ == 'string')
        if ((y(), (b === '99' || b === '98') && _.charAt(0) === '/')) a(_);
        else {
          (a('('), o(254), o(255));
          for (let w = 0; w < _.length; w++) {
            let m = _.charCodeAt(w);
            (h((m >> 8) & 255), h(m & 255));
          }
          a(')');
        }
      else if (Array.isArray(_))
        if ((y(), _.every(w => typeof w == 'number'))) {
          a('[');
          let w = A1.indexOf(b) !== -1;
          for (let m of _) (a(' '), a(w ? d(m) : f(m)));
          a(' ]');
        } else {
          (a('['),
            n ||
              a(`
`));
          for (let w of _)
            (p(w, b),
              n ||
                a(`
`));
          (s(), a(']'));
        }
      else if (typeof _ == 'object') {
        (g &&
          !n &&
          a(`
`),
          s(),
          a('<<'),
          n ||
            a(`
`),
          r++);
        for (let w of u(_)) c(w, _[w]);
        (r--, s(), a('>>'));
      }
    }
    if (n) {
      if (typeof e == 'object') for (let _ of u(e)) c(_, e[_]);
    } else
      (a(`

`),
        p(e));
    return t.slice(0, i);
  }
});
var Du = he(xo => {
  'use strict';
  Object.defineProperty(xo, '__esModule', { value: !0 });
  xo.decodeEngineData = L1;
  xo.encodeEngineData = U1;
  var Su = { name: 'MyriadPro-Regular', script: 0, type: 0, synthetic: 0 },
    _o = {
      justification: 'left',
      firstLineIndent: 0,
      startIndent: 0,
      endIndent: 0,
      spaceBefore: 0,
      spaceAfter: 0,
      autoHyphenate: !0,
      hyphenatedWordSize: 6,
      preHyphen: 2,
      postHyphen: 2,
      consecutiveHyphens: 8,
      zone: 36,
      wordSpacing: [0.8, 1, 1.33],
      letterSpacing: [0, 0, 0],
      glyphSpacing: [1, 1, 1],
      autoLeading: 1.2,
      leadingType: 0,
      hanging: !1,
      burasagari: !1,
      kinsokuOrder: 0,
      everyLineComposer: !1,
    },
    F1 = {
      font: Su,
      fontSize: 12,
      fauxBold: !1,
      fauxItalic: !1,
      autoLeading: !0,
      leading: 0,
      horizontalScale: 1,
      verticalScale: 1,
      tracking: 0,
      autoKerning: !0,
      kerning: 0,
      baselineShift: 0,
      fontCaps: 0,
      fontBaseline: 0,
      underline: !1,
      strikethrough: !1,
      ligatures: !0,
      dLigatures: !1,
      baselineDirection: 2,
      tsume: 0,
      styleRunAlignment: 2,
      language: 0,
      noBreak: !1,
      fillColor: { r: 0, g: 0, b: 0 },
      strokeColor: { r: 0, g: 0, b: 0 },
      fillFlag: !0,
      strokeFlag: !1,
      fillFirst: !0,
      yUnderline: 1,
      outlineWidth: 1,
      characterDirection: 0,
      hindiNumbers: !1,
      kashida: 1,
      diacriticPos: 2,
    },
    E1 = {
      isOn: !1,
      show: !1,
      size: 18,
      leading: 22,
      color: { r: 0, g: 0, b: 255 },
      leadingFillColor: { r: 0, g: 0, b: 255 },
      alignLineHeightToGridFlags: !1,
    },
    ls = [
      'justification',
      'firstLineIndent',
      'startIndent',
      'endIndent',
      'spaceBefore',
      'spaceAfter',
      'autoHyphenate',
      'hyphenatedWordSize',
      'preHyphen',
      'postHyphen',
      'consecutiveHyphens',
      'zone',
      'wordSpacing',
      'letterSpacing',
      'glyphSpacing',
      'autoLeading',
      'leadingType',
      'hanging',
      'burasagari',
      'kinsokuOrder',
      'everyLineComposer',
    ],
    cs = [
      'font',
      'fontSize',
      'fauxBold',
      'fauxItalic',
      'autoLeading',
      'leading',
      'horizontalScale',
      'verticalScale',
      'tracking',
      'autoKerning',
      'kerning',
      'baselineShift',
      'fontCaps',
      'fontBaseline',
      'underline',
      'strikethrough',
      'ligatures',
      'dLigatures',
      'baselineDirection',
      'tsume',
      'styleRunAlignment',
      'language',
      'noBreak',
      'fillColor',
      'strokeColor',
      'fillFlag',
      'strokeFlag',
      'fillFirst',
      'yUnderline',
      'outlineWidth',
      'characterDirection',
      'hindiNumbers',
      'kashida',
      'diacriticPos',
    ],
    ku = ['none', 'crisp', 'strong', 'smooth', 'sharp'],
    Au = [
      'left',
      'right',
      'center',
      'justify-left',
      'justify-right',
      'justify-center',
      'justify-all',
    ];
  function Iu(e) {
    return e.substring(0, 1).toUpperCase() + e.substring(1);
  }
  function D1(e) {
    let n = e.Values;
    switch (e.Type) {
      case 0:
        return { k: n[1] * 255 };
      case 1:
        return n[0] === 1
          ? { r: n[1] * 255, g: n[2] * 255, b: n[3] * 255 }
          : { r: n[1] * 255, g: n[2] * 255, b: n[3] * 255, a: n[0] * 255 };
      case 2:
        return { c: n[1] * 255, m: n[2] * 255, y: n[3] * 255, k: n[4] * 255 };
      default:
        throw new Error('Unknown color type in text layer');
    }
  }
  function ss(e) {
    if (e) {
      if ('r' in e)
        return { Type: 1, Values: ['a' in e ? e.a / 255 : 1, e.r / 255, e.g / 255, e.b / 255] };
      if ('c' in e) return { Type: 2, Values: [1, e.c / 255, e.m / 255, e.y / 255, e.k / 255] };
      if ('k' in e) return { Type: 0, Values: [1, e.k / 255] };
      throw new Error('Invalid color type in text layer');
    } else return { Type: 1, Values: [0, 0, 0, 0] };
  }
  function _u(e, n) {
    if (!e || !n || e.length !== n.length) return !1;
    for (let t = 0; t < e.length; t++) if (e[t] !== n[t]) return !1;
    return !0;
  }
  function vu(e, n) {
    if (!e || !n) return !1;
    for (let t of Object.keys(e)) if (e[t] !== n[t]) return !1;
    for (let t of Object.keys(n)) if (e[t] !== n[t]) return !1;
    return !0;
  }
  function M1(e, n) {
    for (let t = 0; t < e.length; t++) if (e[t].name === n.name) return t;
    return (e.push(n), e.length - 1);
  }
  function Fu(e, n, t) {
    let i = {};
    for (let r of n) {
      let o = Iu(r);
      e[o] !== void 0 &&
        (r === 'justification'
          ? (i[r] = Au[e[o]])
          : r === 'font'
            ? (i[r] = t[e[o]])
            : r === 'fillColor' || r === 'strokeColor'
              ? (i[r] = D1(e[o]))
              : (i[r] = e[o]));
    }
    return i;
  }
  function Eu(e, n, t) {
    var i;
    let r = {};
    for (let o of n) {
      let a = Iu(o);
      e[o] !== void 0 &&
        (o === 'justification'
          ? (r[a] = Au.indexOf((i = e[o]) !== null && i !== void 0 ? i : 'left'))
          : o === 'font'
            ? (r[a] = M1(t, e[o]))
            : o === 'fillColor' || o === 'strokeColor'
              ? (r[a] = ss(e[o]))
              : (r[a] = e[o]));
    }
    return r;
  }
  function C1(e, n) {
    return Fu(e, ls, n);
  }
  function O1(e, n) {
    return Fu(e, cs, n);
  }
  function vo(e, n) {
    return Eu(e, ls, n);
  }
  function as(e, n) {
    return Eu(e, cs, n);
  }
  function xu(e, n, t) {
    if (n.length) {
      for (let i of t) {
        let r = n[0].style[i];
        if (r !== void 0) {
          let a = !1;
          (Array.isArray(r)
            ? (a = n.every(s => _u(s.style[i], r)))
            : typeof r == 'object'
              ? (a = n.every(s => vu(s.style[i], r)))
              : (a = n.every(s => s.style[i] === r)),
            a && (e[i] = r));
        }
        if (e[i] !== void 0)
          for (let a of n) {
            let s = !1;
            (Array.isArray(r)
              ? (s = _u(a.style[i], r))
              : typeof r == 'object'
                ? (s = vu(a.style[i], r))
                : (s = a.style[i] === r),
              s && delete a.style[i]);
          }
      }
      n.every(i => Object.keys(i.style).length === 0) && (n.length = 0);
    }
  }
  function L1(e) {
    var n, t, i, r, o, a;
    let s = e.EngineDict,
      c = e.ResourceDict,
      l = c.FontSet.map(b => ({
        name: b.Name,
        script: b.Script,
        type: b.FontType,
        synthetic: b.Synthetic,
      })),
      f = s.Editor.Text.replace(
        /\r/g,
        `
`
      ),
      d = 0;
    for (; /\n$/.test(f);) ((f = f.substring(0, f.length - 1)), d++);
    let u = {
        text: f,
        antiAlias: (n = ku[s.AntiAlias]) !== null && n !== void 0 ? n : 'smooth',
        useFractionalGlyphWidths: !!s.UseFractionalGlyphWidths,
        superscriptSize: c.SuperscriptSize,
        superscriptPosition: c.SuperscriptPosition,
        subscriptSize: c.SubscriptSize,
        subscriptPosition: c.SubscriptPosition,
        smallCapSize: c.SmallCapSize,
      },
      h =
        (a =
          (o =
            (r =
              (i = (t = s.Rendered) === null || t === void 0 ? void 0 : t.Shapes) === null ||
              i === void 0
                ? void 0
                : i.Children) === null || r === void 0
              ? void 0
              : r[0]) === null || o === void 0
            ? void 0
            : o.Cookie) === null || a === void 0
          ? void 0
          : a.Photoshop;
    h &&
      ((u.shapeType = h.ShapeType === 1 ? 'box' : 'point'),
      h.PointBase && (u.pointBase = h.PointBase),
      h.BoxBounds && (u.boxBounds = h.BoxBounds));
    let p = s.ParagraphRun;
    ((u.paragraphStyle = {}), (u.paragraphStyleRuns = []));
    for (let b = 0; b < p.RunArray.length; b++) {
      let g = p.RunArray[b],
        y = p.RunLengthArray[b],
        w = C1(g.ParagraphSheet.Properties, l);
      u.paragraphStyleRuns.push({ length: y, style: w });
    }
    for (let b = d; u.paragraphStyleRuns.length && b > 0; b--)
      --u.paragraphStyleRuns[u.paragraphStyleRuns.length - 1].length === 0 &&
        u.paragraphStyleRuns.pop();
    (xu(u.paragraphStyle, u.paragraphStyleRuns, ls),
      u.paragraphStyleRuns.length || delete u.paragraphStyleRuns);
    let _ = s.StyleRun;
    ((u.style = {}), (u.styleRuns = []));
    for (let b = 0; b < _.RunArray.length; b++) {
      let g = _.RunLengthArray[b],
        y = O1(_.RunArray[b].StyleSheet.StyleSheetData, l);
      (y.font || (y.font = l[0]), u.styleRuns.push({ length: g, style: y }));
    }
    for (let b = d; u.styleRuns.length && b > 0; b--)
      --u.styleRuns[u.styleRuns.length - 1].length === 0 && u.styleRuns.pop();
    return (xu(u.style, u.styleRuns, cs), u.styleRuns.length || delete u.styleRuns, u);
  }
  function U1(e) {
    var n, t, i, r, o, a, s, c, l, f, d, u;
    let h = `${(e.text || '').replace(/\r?\n/g, '\r')}\r`,
      p = [{ name: 'AdobeInvisFont', script: 0, type: 0, synthetic: 0 }],
      _ =
        ((n = e.style) === null || n === void 0 ? void 0 : n.font) ||
        ((i = (t = e.styleRuns) === null || t === void 0 ? void 0 : t.find(U => U.style.font)) ===
          null || i === void 0
          ? void 0
          : i.style.font) ||
        Su,
      b = [],
      g = [],
      y = e.paragraphStyleRuns;
    if (y && y.length) {
      let U = h.length;
      for (let V of y) {
        let X = Math.min(V.length, U);
        ((U -= X),
          X &&
            (U === 1 && V === y[y.length - 1] && (X++, U--),
            g.push(X),
            b.push({
              ParagraphSheet: {
                DefaultStyleSheet: 0,
                Properties: vo(
                  Object.assign(Object.assign(Object.assign({}, _o), e.paragraphStyle), V.style),
                  p
                ),
              },
              Adjustments: { Axis: [1, 0, 1], XY: [0, 0] },
            })));
      }
      U &&
        (g.push(U),
        b.push({
          ParagraphSheet: {
            DefaultStyleSheet: 0,
            Properties: vo(Object.assign(Object.assign({}, _o), e.paragraphStyle), p),
          },
          Adjustments: { Axis: [1, 0, 1], XY: [0, 0] },
        }));
    } else
      for (let U = 0, V = 0; U < h.length; U++)
        h.charCodeAt(U) === 13 &&
          (g.push(U - V + 1),
          b.push({
            ParagraphSheet: {
              DefaultStyleSheet: 0,
              Properties: vo(Object.assign(Object.assign({}, _o), e.paragraphStyle), p),
            },
            Adjustments: { Axis: [1, 0, 1], XY: [0, 0] },
          }),
          (V = U + 1));
    let w = as(Object.assign(Object.assign({}, F1), { font: _ }), p),
      m = e.styleRuns || [{ length: h.length, style: e.style || {} }],
      A = [],
      M = [],
      k = h.length;
    for (let U of m) {
      let V = Math.min(U.length, k);
      ((k -= V),
        V &&
          (k === 1 && U === m[m.length - 1] && (V++, k--),
          M.push(V),
          A.push({
            StyleSheet: {
              StyleSheetData: as(
                Object.assign(
                  Object.assign(
                    { kerning: 0, autoKerning: !0, fillColor: { r: 0, g: 0, b: 0 } },
                    e.style
                  ),
                  U.style
                ),
                p
              ),
            },
          })));
    }
    k &&
      m.length &&
      (M.push(k),
      A.push({
        StyleSheet: {
          StyleSheetData: as(
            Object.assign(
              { kerning: 0, autoKerning: !0, fillColor: { r: 0, g: 0, b: 0 } },
              e.style
            ),
            p
          ),
        },
      }));
    let E = Object.assign(Object.assign({}, E1), e.gridInfo),
      F = e.orientation === 'vertical' ? 2 : 0,
      I = e.orientation === 'vertical' ? 1 : 0,
      C = e.shapeType === 'box' ? 1 : 0,
      B = { ShapeType: C };
    (C === 0 ? (B.PointBase = e.pointBase || [0, 0]) : (B.BoxBounds = e.boxBounds || [0, 0, 0, 0]),
      (B.Base = {
        ShapeType: C,
        TransformPoint0: [1, 0],
        TransformPoint1: [0, 1],
        TransformPoint2: [0, 0],
      }));
    let ee = {
      KinsokuSet: [
        {
          Name: 'PhotoshopKinsokuHard',
          NoStart:
            '\u3001\u3002\uFF0C\uFF0E\u30FB\uFF1A\uFF1B\uFF1F\uFF01\u30FC\u2015\u2019\u201D\uFF09\u3015\uFF3D\uFF5D\u3009\u300B\u300D\u300F\u3011\u30FD\u30FE\u309D\u309E\u3005\u3041\u3043\u3045\u3047\u3049\u3063\u3083\u3085\u3087\u308E\u30A1\u30A3\u30A5\u30A7\u30A9\u30C3\u30E3\u30E5\u30E7\u30EE\u30F5\u30F6\u309B\u309C?!)]},.:;\u2103\u2109\xA2\uFF05\u2030',
          NoEnd:
            '\u2018\u201C\uFF08\u3014\uFF3B\uFF5B\u3008\u300A\u300C\u300E\u3010([{\uFFE5\uFF04\xA3\uFF20\xA7\u3012\uFF03',
          Keep: '\u2015\u2025',
          Hanging: '\u3001\u3002.,',
        },
        {
          Name: 'PhotoshopKinsokuSoft',
          NoStart:
            '\u3001\u3002\uFF0C\uFF0E\u30FB\uFF1A\uFF1B\uFF1F\uFF01\u2019\u201D\uFF09\u3015\uFF3D\uFF5D\u3009\u300B\u300D\u300F\u3011\u30FD\u30FE\u309D\u309E\u3005',
          NoEnd: '\u2018\u201C\uFF08\u3014\uFF3B\uFF5B\u3008\u300A\u300C\u300E\u3010',
          Keep: '\u2015\u2025',
          Hanging: '\u3001\u3002.,',
        },
      ],
      MojiKumiSet: [
        { InternalName: 'Photoshop6MojiKumiSet1' },
        { InternalName: 'Photoshop6MojiKumiSet2' },
        { InternalName: 'Photoshop6MojiKumiSet3' },
        { InternalName: 'Photoshop6MojiKumiSet4' },
      ],
      TheNormalStyleSheet: 0,
      TheNormalParagraphSheet: 0,
      ParagraphSheetSet: [
        {
          Name: 'Normal RGB',
          DefaultStyleSheet: 0,
          Properties: vo(Object.assign(Object.assign({}, _o), e.paragraphStyle), p),
        },
      ],
      StyleSheetSet: [{ Name: 'Normal RGB', StyleSheetData: w }],
      FontSet: p.map(U => ({
        Name: U.name,
        Script: U.script || 0,
        FontType: U.type || 0,
        Synthetic: U.synthetic || 0,
      })),
      SuperscriptSize: (r = e.superscriptSize) !== null && r !== void 0 ? r : 0.583,
      SuperscriptPosition: (o = e.superscriptPosition) !== null && o !== void 0 ? o : 0.333,
      SubscriptSize: (a = e.subscriptSize) !== null && a !== void 0 ? a : 0.583,
      SubscriptPosition: (s = e.subscriptPosition) !== null && s !== void 0 ? s : 0.333,
      SmallCapSize: (c = e.smallCapSize) !== null && c !== void 0 ? c : 0.7,
    };
    return {
      EngineDict: {
        Editor: { Text: h },
        ParagraphRun: {
          DefaultRunData: {
            ParagraphSheet: { DefaultStyleSheet: 0, Properties: {} },
            Adjustments: { Axis: [1, 0, 1], XY: [0, 0] },
          },
          RunArray: b,
          RunLengthArray: g,
          IsJoinable: 1,
        },
        StyleRun: {
          DefaultRunData: { StyleSheet: { StyleSheetData: {} } },
          RunArray: A,
          RunLengthArray: M,
          IsJoinable: 2,
        },
        GridInfo: {
          GridIsOn: !!E.isOn,
          ShowGrid: !!E.show,
          GridSize: (l = E.size) !== null && l !== void 0 ? l : 18,
          GridLeading: (f = E.leading) !== null && f !== void 0 ? f : 22,
          GridColor: ss(E.color),
          GridLeadingFillColor: ss(E.color),
          AlignLineHeightToGridFlags: !!E.alignLineHeightToGridFlags,
        },
        AntiAlias: ku.indexOf((d = e.antiAlias) !== null && d !== void 0 ? d : 'sharp'),
        UseFractionalGlyphWidths:
          (u = e.useFractionalGlyphWidths) !== null && u !== void 0 ? u : !0,
        Rendered: {
          Version: 1,
          Shapes: {
            WritingDirection: F,
            Children: [
              {
                ShapeType: C,
                Procession: I,
                Lines: { WritingDirection: F, Children: [] },
                Cookie: { Photoshop: B },
              },
            ],
          },
        },
      },
      ResourceDict: Object.assign({}, ee),
      DocumentResources: Object.assign({}, ee),
    };
  }
});
var Cu = he(hs => {
  'use strict';
  Object.defineProperty(hs, '__esModule', { value: !0 });
  hs.decodeEngineData2 = T1;
  var fs = { 0: { uproot: !0, children: { 0: { name: 'Type' }, 1: { name: 'Values' } } } },
    ds = {
      0: { name: 'Font' },
      1: { name: 'FontSize' },
      2: { name: 'FauxBold' },
      3: { name: 'FauxItalic' },
      4: { name: 'AutoLeading' },
      5: { name: 'Leading' },
      6: { name: 'HorizontalScale' },
      7: { name: 'VerticalScale' },
      8: { name: 'Tracking' },
      9: { name: 'BaselineShift' },
      11: { name: 'Kerning?' },
      12: { name: 'FontCaps' },
      13: { name: 'FontBaseline' },
      15: { name: 'Strikethrough?' },
      16: { name: 'Underline?' },
      18: { name: 'Ligatures' },
      19: { name: 'DLigatures' },
      23: { name: 'Fractions' },
      24: { name: 'Ordinals' },
      28: { name: 'StylisticAlternates' },
      30: { name: 'OldStyle?' },
      35: { name: 'BaselineDirection' },
      38: { name: 'Language' },
      52: { name: 'NoBreak' },
      53: { name: 'FillColor', children: fs },
      54: { name: 'StrokeColor', children: fs },
      55: { children: { 99: { uproot: !0 } } },
      79: { children: fs },
    },
    us = {
      0: { name: 'Justification' },
      1: { name: 'FirstLineIndent' },
      2: { name: 'StartIndent' },
      3: { name: 'EndIndent' },
      4: { name: 'SpaceBefore' },
      5: { name: 'SpaceAfter' },
      7: { name: 'AutoLeading' },
      9: { name: 'AutoHyphenate' },
      10: { name: 'HyphenatedWordSize' },
      11: { name: 'PreHyphen' },
      12: { name: 'PostHyphen' },
      13: { name: 'ConsecutiveHyphens?' },
      14: { name: 'Zone' },
      15: { name: 'HypenateCapitalizedWords' },
      17: { name: 'WordSpacing' },
      18: { name: 'LetterSpacing' },
      19: { name: 'GlyphSpacing' },
      32: { name: 'StyleSheet', children: ds },
    },
    Mu = { name: 'StyleSheetData', children: ds },
    P1 = {
      0: {
        name: 'ResourceDict',
        children: {
          1: {
            name: 'FontSet',
            children: {
              0: {
                uproot: !0,
                children: {
                  0: {
                    uproot: !0,
                    children: {
                      0: { uproot: !0, children: { 0: { name: 'Name' }, 2: { name: 'FontType' } } },
                    },
                  },
                },
              },
            },
          },
          2: { name: '2', children: {} },
          3: {
            name: 'MojiKumiSet',
            children: {
              0: {
                uproot: !0,
                children: { 0: { uproot: !0, children: { 0: { name: 'InternalName' } } } },
              },
            },
          },
          4: {
            name: 'KinsokuSet',
            children: {
              0: {
                uproot: !0,
                children: {
                  0: {
                    uproot: !0,
                    children: {
                      0: { name: 'Name' },
                      5: {
                        uproot: !0,
                        children: {
                          0: { name: 'NoStart' },
                          1: { name: 'NoEnd' },
                          2: { name: 'Keep' },
                          3: { name: 'Hanging' },
                          4: { name: 'Name' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          5: {
            name: 'StyleSheetSet',
            children: {
              0: {
                uproot: !0,
                children: { 0: { uproot: !0, children: { 0: { name: 'Name' }, 6: Mu } } },
              },
            },
          },
          6: {
            name: 'ParagraphSheetSet',
            children: {
              0: {
                uproot: !0,
                children: {
                  0: {
                    uproot: !0,
                    children: {
                      0: { name: 'Name' },
                      5: { name: 'Properties', children: us },
                      6: { name: 'DefaultStyleSheet' },
                    },
                  },
                },
              },
            },
          },
          8: {
            name: 'TextFrameSet',
            children: {
              0: {
                uproot: !0,
                children: {
                  0: {
                    name: 'path',
                    children: {
                      0: { name: 'name' },
                      1: { name: 'bezierCurve', children: { 0: { name: 'controlPoints' } } },
                      2: {
                        name: 'data',
                        children: {
                          0: { name: 'type' },
                          1: { name: 'orientation' },
                          2: { name: 'frameMatrix' },
                          4: { name: '4' },
                          6: { name: 'textRange' },
                          7: { name: 'rowGutter' },
                          8: { name: 'columnGutter' },
                          9: { name: '9' },
                          10: {
                            name: 'baselineAlignment',
                            children: { 0: { name: 'flag' }, 1: { name: 'min' } },
                          },
                          11: {
                            name: 'pathData',
                            children: {
                              1: { name: '1' },
                              0: { name: 'reversed' },
                              2: { name: '2' },
                              3: { name: '3' },
                              4: { name: 'spacing' },
                              5: { name: '5' },
                              6: { name: '6' },
                              7: { name: '7' },
                              18: { name: '18' },
                            },
                          },
                          12: { name: '12' },
                          13: { name: '13' },
                        },
                      },
                      3: { name: '3' },
                      97: { name: 'uuid' },
                    },
                  },
                },
              },
            },
          },
          9: {
            name: 'Predefined',
            children: {
              0: { children: { 0: { uproot: !0 } } },
              1: { children: { 0: { uproot: !0 } } },
            },
          },
        },
      },
      1: {
        name: 'EngineDict',
        children: {
          0: {
            name: '0',
            children: {
              3: { name: 'SuperscriptSize' },
              4: { name: 'SuperscriptPosition' },
              5: { name: 'SubscriptSize' },
              6: { name: 'SubscriptPosition' },
              7: { name: 'SmallCapSize' },
              8: { name: 'UseFractionalGlyphWidths' },
              15: { children: { 0: { uproot: !0 } } },
            },
          },
          1: {
            name: 'Editors?',
            children: {
              0: {
                name: 'Editor',
                children: {
                  0: { name: 'Text' },
                  5: {
                    name: 'ParagraphRun',
                    children: {
                      0: {
                        name: 'RunArray',
                        children: {
                          0: {
                            name: 'ParagraphSheet',
                            children: {
                              0: {
                                uproot: !0,
                                children: {
                                  0: { name: '0' },
                                  5: { name: '5', children: us },
                                  6: { name: '6' },
                                },
                              },
                            },
                          },
                          1: { name: 'RunLength' },
                        },
                      },
                    },
                  },
                  6: {
                    name: 'StyleRun',
                    children: {
                      0: {
                        name: 'RunArray',
                        children: {
                          0: {
                            name: 'StyleSheet',
                            children: { 0: { uproot: !0, children: { 6: Mu } } },
                          },
                          1: { name: 'RunLength' },
                        },
                      },
                    },
                  },
                },
              },
              1: { name: 'FontVectorData ???' },
            },
          },
          2: { name: 'StyleSheet', children: ds },
          3: { name: 'ParagraphSheet', children: us },
        },
      },
    };
  function Ji(e, n) {
    var t, i;
    if (e === null) return e;
    if (Array.isArray(e)) return e.map(o => Ji(o, n));
    if (typeof e != 'object') return e;
    let r = {};
    for (let o of Object.keys(e))
      if (n[o])
        if (n[o].uproot) {
          (o !== '99' && (r = Ji(e[o], (t = n[o].children) !== null && t !== void 0 ? t : {})),
            e[99] && (r._type = e[99]));
          break;
        } else r[n[o].name || o] = Ji(e[o], (i = n[o].children) !== null && i !== void 0 ? i : {});
      else o === '99' ? (r._type = e[o]) : (r[o] = Ji(e[o], {}));
    return r;
  }
  function T1(e) {
    return Ji(e, P1);
  }
});
var bo = he(ze => {
  'use strict';
  Object.defineProperty(ze, '__esModule', { value: !0 });
  ze.booleanOperations = ze.infoHandlersMap = ze.infoHandlers = void 0;
  ze.readBezierKnot = ju;
  ze.readVectorMask = Vu;
  ze.hasMultiEffects = vs;
  var Ou = qr(),
    Lu = mu(),
    rt = fn(),
    v = un(),
    x = li(),
    S = no(),
    ws = wu(),
    Uu = Du(),
    R1 = Cu(),
    it = 'abcdefghijklmnopqrstuvwxyz';
  ze.infoHandlers = [];
  ze.infoHandlersMap = {};
  function j(e, n, t, i) {
    let r = { key: e, has: n, read: t, write: i };
    (ze.infoHandlers.push(r), (ze.infoHandlersMap[r.key] = r));
  }
  function mn(e, n) {
    ze.infoHandlersMap[e] = ze.infoHandlersMap[n];
  }
  function be(e) {
    return n => n[e] !== void 0;
  }
  function ps(e) {
    if ((0, v.readUint32)(e))
      throw new Error(`Resource size above 4 GB limit at ${e.offset.toString(16)}`);
    return (0, v.readUint32)(e);
  }
  function gs(e, n) {
    ((0, x.writeUint32)(e, 0), (0, x.writeUint32)(e, n));
  }
  j(
    'TySh',
    be('text'),
    (e, n, t) => {
      if ((0, v.readInt16)(e) !== 1) throw new Error('Invalid TySh version');
      let i = [];
      for (let a = 0; a < 6; a++) i.push((0, v.readFloat64)(e));
      if ((0, v.readInt16)(e) !== 50) throw new Error('Invalid TySh text version');
      let r = (0, S.readVersionAndDescriptor)(e);
      if ((0, v.readInt16)(e) !== 1) throw new Error('Invalid TySh warp version');
      let o = (0, S.readVersionAndDescriptor)(e);
      if (
        ((n.text = {
          transform: i,
          left: (0, v.readFloat32)(e),
          top: (0, v.readFloat32)(e),
          right: (0, v.readFloat32)(e),
          bottom: (0, v.readFloat32)(e),
          text: r['Txt '].replace(
            /\r/g,
            `
`
          ),
          index: r.TextIndex || 0,
          gridding: S.textGridding.decode(r.textGridding),
          antiAlias: S.Annt.decode(r.AntA),
          orientation: S.Ornt.decode(r.Ornt),
          warp: {
            style: S.warpStyle.decode(o.warpStyle),
            value: o.warpValue || 0,
            perspective: o.warpPerspective || 0,
            perspectiveOther: o.warpPerspectiveOther || 0,
            rotate: S.Ornt.decode(o.warpRotate),
          },
        }),
        r.bounds && (n.text.bounds = (0, S.descBoundsToBounds)(r.bounds)),
        r.boundingBox && (n.text.boundingBox = (0, S.descBoundsToBounds)(r.boundingBox)),
        r.EngineData)
      ) {
        let a = (0, ws.parseEngineData)(r.EngineData),
          s = (0, Uu.decodeEngineData)(a);
        n.text = Object.assign(Object.assign({}, n.text), s);
      }
      (0, v.skipBytes)(e, t());
    },
    (e, n) => {
      let t = n.text,
        i = t.warp || {},
        r = t.transform || [1, 0, 0, 1, 0, 0],
        o = Object.assign(
          Object.assign(
            Object.assign(
              {
                'Txt ': (t.text || '').replace(/\r?\n/g, '\r'),
                textGridding: S.textGridding.encode(t.gridding),
                Ornt: S.Ornt.encode(t.orientation),
                AntA: S.Annt.encode(t.antiAlias),
              },
              t.bounds ? { bounds: (0, S.boundsToDescBounds)(t.bounds) } : {}
            ),
            t.boundingBox ? { boundingBox: (0, S.boundsToDescBounds)(t.boundingBox) } : {}
          ),
          {
            TextIndex: t.index || 0,
            EngineData: (0, ws.serializeEngineData)((0, Uu.encodeEngineData)(t)),
          }
        );
      (0, x.writeInt16)(e, 1);
      for (let a = 0; a < 6; a++) (0, x.writeFloat64)(e, r[a]);
      ((0, x.writeInt16)(e, 50),
        (0, S.writeVersionAndDescriptor)(e, '', 'TxLr', o, 'text'),
        (0, x.writeInt16)(e, 1),
        (0, S.writeVersionAndDescriptor)(e, '', 'warp', Eo(i)),
        (0, x.writeFloat32)(e, t.left),
        (0, x.writeFloat32)(e, t.top),
        (0, x.writeFloat32)(e, t.right),
        (0, x.writeFloat32)(e, t.bottom));
    }
  );
  j(
    'SoCo',
    e => e.vectorFill !== void 0 && e.vectorStroke === void 0 && e.vectorFill.type === 'color',
    (e, n) => {
      let t = (0, S.readVersionAndDescriptor)(e);
      n.vectorFill = (0, S.parseVectorContent)(t);
    },
    (e, n) => {
      let { descriptor: t } = (0, S.serializeVectorContent)(n.vectorFill);
      (0, S.writeVersionAndDescriptor)(e, '', 'null', t);
    }
  );
  j(
    'GdFl',
    e =>
      e.vectorFill !== void 0 &&
      e.vectorStroke === void 0 &&
      (e.vectorFill.type === 'solid' || e.vectorFill.type === 'noise'),
    (e, n, t) => {
      let i = (0, S.readVersionAndDescriptor)(e);
      ((n.vectorFill = (0, S.parseVectorContent)(i)), (0, v.skipBytes)(e, t()));
    },
    (e, n) => {
      let { descriptor: t } = (0, S.serializeVectorContent)(n.vectorFill);
      (0, S.writeVersionAndDescriptor)(e, '', 'null', t);
    }
  );
  j(
    'PtFl',
    e => e.vectorFill !== void 0 && e.vectorStroke === void 0 && e.vectorFill.type === 'pattern',
    (e, n) => {
      let t = (0, S.readVersionAndDescriptor)(e);
      n.vectorFill = (0, S.parseVectorContent)(t);
    },
    (e, n) => {
      let { descriptor: t } = (0, S.serializeVectorContent)(n.vectorFill);
      (0, S.writeVersionAndDescriptor)(e, '', 'null', t);
    }
  );
  j(
    'vscg',
    e => e.vectorFill !== void 0 && e.vectorStroke !== void 0,
    (e, n, t) => {
      (0, v.readSignature)(e);
      let i = (0, S.readVersionAndDescriptor)(e);
      ((n.vectorFill = (0, S.parseVectorContent)(i)), (0, v.skipBytes)(e, t()));
    },
    (e, n) => {
      let { descriptor: t, key: i } = (0, S.serializeVectorContent)(n.vectorFill);
      ((0, x.writeSignature)(e, i), (0, S.writeVersionAndDescriptor)(e, '', 'null', t));
    }
  );
  function ju(e, n, t) {
    let i = (0, v.readFixedPointPath32)(e) * t,
      r = (0, v.readFixedPointPath32)(e) * n,
      o = (0, v.readFixedPointPath32)(e) * t,
      a = (0, v.readFixedPointPath32)(e) * n,
      s = (0, v.readFixedPointPath32)(e) * t,
      c = (0, v.readFixedPointPath32)(e) * n;
    return [r, i, a, o, c, s];
  }
  function B1(e, n, t, i) {
    ((0, x.writeFixedPointPath32)(e, n[1] / i),
      (0, x.writeFixedPointPath32)(e, n[0] / t),
      (0, x.writeFixedPointPath32)(e, n[3] / i),
      (0, x.writeFixedPointPath32)(e, n[2] / t),
      (0, x.writeFixedPointPath32)(e, n[5] / i),
      (0, x.writeFixedPointPath32)(e, n[4] / t));
  }
  ze.booleanOperations = ['exclude', 'combine', 'subtract', 'intersect'];
  function Vu(e, n, t, i, r) {
    let o = e.offset + r,
      a = n.paths,
      s;
    for (; o - e.offset >= 26;) {
      let c = (0, v.readUint16)(e);
      switch (c) {
        case 0:
        case 3: {
          (0, v.readUint16)(e);
          let l = (0, v.readInt16)(e),
            f = (0, v.readUint16)(e);
          ((0, v.skipBytes)(e, 18),
            (s = { open: c === 3, knots: [], fillRule: f === 2 ? 'non-zero' : 'even-odd' }),
            l !== -1 && (s.operation = ze.booleanOperations[l]),
            a.push(s));
          break;
        }
        case 1:
        case 2:
        case 4:
        case 5:
          s.knots.push({ linked: c === 1 || c === 4, points: ju(e, t, i) });
          break;
        case 6:
          (0, v.skipBytes)(e, 24);
          break;
        case 7: {
          let l = (0, v.readFixedPointPath32)(e),
            f = (0, v.readFixedPointPath32)(e),
            d = (0, v.readFixedPointPath32)(e),
            u = (0, v.readFixedPointPath32)(e),
            h = (0, v.readFixedPointPath32)(e);
          ((0, v.skipBytes)(e, 4),
            (n.clipboard = { top: l, left: f, bottom: d, right: u, resolution: h }));
          break;
        }
        case 8:
          ((n.fillStartsWithAllPixels = !!(0, v.readUint16)(e)), (0, v.skipBytes)(e, 22));
          break;
        default:
          throw new Error('Invalid vmsk section');
      }
    }
    return a;
  }
  j(
    'vmsk',
    be('vectorMask'),
    (e, n, t, { width: i, height: r }) => {
      if ((0, v.readUint32)(e) !== 3) throw new Error('Invalid vmsk version');
      n.vectorMask = { paths: [] };
      let o = n.vectorMask,
        a = (0, v.readUint32)(e);
      ((o.invert = (a & 1) !== 0),
        (o.notLink = (a & 2) !== 0),
        (o.disable = (a & 4) !== 0),
        Vu(e, o, i, r, t()),
        (0, v.skipBytes)(e, t()));
    },
    (e, n, { width: t, height: i }) => {
      let r = n.vectorMask,
        o = (r.invert ? 1 : 0) | (r.notLink ? 2 : 0) | (r.disable ? 4 : 0);
      ((0, x.writeUint32)(e, 3),
        (0, x.writeUint32)(e, o),
        (0, x.writeUint16)(e, 6),
        (0, x.writeZeros)(e, 24));
      let a = r.clipboard;
      (a &&
        ((0, x.writeUint16)(e, 7),
        (0, x.writeFixedPointPath32)(e, a.top),
        (0, x.writeFixedPointPath32)(e, a.left),
        (0, x.writeFixedPointPath32)(e, a.bottom),
        (0, x.writeFixedPointPath32)(e, a.right),
        (0, x.writeFixedPointPath32)(e, a.resolution),
        (0, x.writeZeros)(e, 4)),
        (0, x.writeUint16)(e, 8),
        (0, x.writeUint16)(e, r.fillStartsWithAllPixels ? 1 : 0),
        (0, x.writeZeros)(e, 22));
      for (let s of r.paths) {
        ((0, x.writeUint16)(e, s.open ? 3 : 0),
          (0, x.writeUint16)(e, s.knots.length),
          (0, x.writeUint16)(e, s.operation ? ze.booleanOperations.indexOf(s.operation) : -1),
          (0, x.writeUint16)(e, s.fillRule === 'non-zero' ? 2 : 1),
          (0, x.writeZeros)(e, 18));
        let c = s.open ? 4 : 1,
          l = s.open ? 5 : 2;
        for (let { linked: f, points: d } of s.knots)
          ((0, x.writeUint16)(e, f ? c : l), B1(e, d, t, i));
      }
    }
  );
  mn('vsms', 'vmsk');
  j(
    'vowv',
    be('vowv'),
    (e, n) => {
      n.vowv = (0, v.readUint32)(e);
    },
    (e, n) => {
      (0, x.writeUint32)(e, n.vowv);
    }
  );
  j(
    'vogk',
    be('vectorOrigination'),
    (e, n, t) => {
      if ((0, v.readInt32)(e) !== 1) throw new Error('Invalid vogk version');
      let i = (0, S.readVersionAndDescriptor)(e);
      n.vectorOrigination = { keyDescriptorList: [] };
      for (let r of i.keyDescriptorList) {
        let o = {};
        (r.keyShapeInvalidated != null && (o.keyShapeInvalidated = r.keyShapeInvalidated),
          r.keyOriginType != null && (o.keyOriginType = r.keyOriginType),
          r.keyOriginResolution != null && (o.keyOriginResolution = r.keyOriginResolution),
          r.keyOriginShapeBBox &&
            (o.keyOriginShapeBoundingBox = {
              top: (0, S.parseUnitsOrNumber)(r.keyOriginShapeBBox['Top ']),
              left: (0, S.parseUnitsOrNumber)(r.keyOriginShapeBBox.Left),
              bottom: (0, S.parseUnitsOrNumber)(r.keyOriginShapeBBox.Btom),
              right: (0, S.parseUnitsOrNumber)(r.keyOriginShapeBBox.Rght),
            }));
        let a = r.keyOriginRRectRadii;
        a &&
          (o.keyOriginRRectRadii = {
            topRight: (0, S.parseUnits)(a.topRight),
            topLeft: (0, S.parseUnits)(a.topLeft),
            bottomLeft: (0, S.parseUnits)(a.bottomLeft),
            bottomRight: (0, S.parseUnits)(a.bottomRight),
          });
        let s = r.keyOriginBoxCorners;
        s &&
          (o.keyOriginBoxCorners = [
            { x: s.rectangleCornerA.Hrzn, y: s.rectangleCornerA.Vrtc },
            { x: s.rectangleCornerB.Hrzn, y: s.rectangleCornerB.Vrtc },
            { x: s.rectangleCornerC.Hrzn, y: s.rectangleCornerC.Vrtc },
            { x: s.rectangleCornerD.Hrzn, y: s.rectangleCornerD.Vrtc },
          ]);
        let c = r.Trnf;
        (c && (o.transform = [c.xx, c.xy, c.yx, c.yy, c.tx, c.ty]),
          n.vectorOrigination.keyDescriptorList.push(o));
      }
      (0, v.skipBytes)(e, t());
    },
    (e, n) => {
      let t = n.vectorOrigination,
        i = { keyDescriptorList: [] };
      for (let r = 0; r < t.keyDescriptorList.length; r++) {
        let o = t.keyDescriptorList[r];
        i.keyDescriptorList.push({});
        let a = i.keyDescriptorList[i.keyDescriptorList.length - 1];
        (o.keyOriginType != null && (a.keyOriginType = o.keyOriginType),
          o.keyOriginResolution != null && (a.keyOriginResolution = o.keyOriginResolution));
        let s = o.keyOriginRRectRadii;
        s &&
          (a.keyOriginRRectRadii = {
            unitValueQuadVersion: 1,
            topRight: (0, S.unitsValue)(s.topRight, 'topRight'),
            topLeft: (0, S.unitsValue)(s.topLeft, 'topLeft'),
            bottomLeft: (0, S.unitsValue)(s.bottomLeft, 'bottomLeft'),
            bottomRight: (0, S.unitsValue)(s.bottomRight, 'bottomRight'),
          });
        let c = o.keyOriginShapeBoundingBox;
        c &&
          (a.keyOriginShapeBBox = {
            unitValueQuadVersion: 1,
            'Top ': (0, S.unitsValue)(c.top, 'top'),
            Left: (0, S.unitsValue)(c.left, 'left'),
            Btom: (0, S.unitsValue)(c.bottom, 'bottom'),
            Rght: (0, S.unitsValue)(c.right, 'right'),
          });
        let l = o.keyOriginBoxCorners;
        l &&
          l.length === 4 &&
          (a.keyOriginBoxCorners = {
            rectangleCornerA: { Hrzn: l[0].x, Vrtc: l[0].y },
            rectangleCornerB: { Hrzn: l[1].x, Vrtc: l[1].y },
            rectangleCornerC: { Hrzn: l[2].x, Vrtc: l[2].y },
            rectangleCornerD: { Hrzn: l[3].x, Vrtc: l[3].y },
          });
        let f = o.transform;
        (f &&
          f.length === 6 &&
          (a.Trnf = { xx: f[0], xy: f[1], yx: f[2], yy: f[3], tx: f[4], ty: f[5] }),
          o.keyShapeInvalidated != null && (a.keyShapeInvalidated = o.keyShapeInvalidated),
          (a.keyOriginIndex = r));
      }
      ((0, x.writeInt32)(e, 1), (0, S.writeVersionAndDescriptor)(e, '', 'null', i));
    }
  );
  j(
    'lmfx',
    e => e.effects !== void 0 && vs(e.effects),
    (e, n, t) => {
      if ((0, v.readUint32)(e) !== 0) throw new Error('Invalid lmfx version');
      let r = (0, S.readVersionAndDescriptor)(e);
      ((n.effects = (0, S.parseEffects)(r, !!e.logMissingFeatures)), (0, v.skipBytes)(e, t()));
    },
    (e, n, t, i) => {
      let r = (0, S.serializeEffects)(n.effects, !!i.logMissingFeatures, !0);
      ((0, x.writeUint32)(e, 0), (0, S.writeVersionAndDescriptor)(e, '', 'null', r));
    }
  );
  j(
    'lrFX',
    be('effects'),
    (e, n, t) => {
      (n.effects || (n.effects = (0, Lu.readEffects)(e)), (0, v.skipBytes)(e, t()));
    },
    (e, n) => {
      (0, Lu.writeEffects)(e, n.effects);
    }
  );
  j(
    'luni',
    be('name'),
    (e, n, t) => {
      if (t() > 4) {
        let i = (0, v.readUint32)(e);
        t() >= i * 2
          ? (n.name = (0, v.readUnicodeStringWithLength)(e, i))
          : e.logDevFeatures && e.log('name in luni section is too long');
      } else e.logDevFeatures && e.log('empty luni section');
      (0, v.skipBytes)(e, t());
    },
    (e, n) => {
      (0, x.writeUnicodeString)(e, n.name);
    }
  );
  j(
    'lnsr',
    be('nameSource'),
    (e, n) => (n.nameSource = (0, v.readSignature)(e)),
    (e, n) => (0, x.writeSignature)(e, n.nameSource)
  );
  j(
    'lyid',
    be('id'),
    (e, n) => {
      n.id = (0, v.readUint32)(e);
    },
    (e, n, t, i) => {
      let r = n.id;
      for (; i.layerIds.has(r);) r += 100;
      ((0, x.writeUint32)(e, r), i.layerIds.add(r), i.layerToId.set(n, r));
    }
  );
  j(
    'lsct',
    be('sectionDivider'),
    (e, n, t) => {
      ((n.sectionDivider = { type: (0, v.readUint32)(e) }),
        t() && ((0, v.checkSignature)(e, '8BIM'), (n.sectionDivider.key = (0, v.readSignature)(e))),
        t() && (n.sectionDivider.subType = (0, v.readUint32)(e)));
    },
    (e, n) => {
      ((0, x.writeUint32)(e, n.sectionDivider.type),
        n.sectionDivider.key &&
          ((0, x.writeSignature)(e, '8BIM'),
          (0, x.writeSignature)(e, n.sectionDivider.key),
          n.sectionDivider.subType !== void 0 && (0, x.writeUint32)(e, n.sectionDivider.subType)));
    }
  );
  mn('lsdk', 'lsct');
  j(
    'clbl',
    be('blendClippendElements'),
    (e, n) => {
      ((n.blendClippendElements = !!(0, v.readUint8)(e)), (0, v.skipBytes)(e, 3));
    },
    (e, n) => {
      ((0, x.writeUint8)(e, n.blendClippendElements ? 1 : 0), (0, x.writeZeros)(e, 3));
    }
  );
  j(
    'infx',
    be('blendInteriorElements'),
    (e, n) => {
      ((n.blendInteriorElements = !!(0, v.readUint8)(e)), (0, v.skipBytes)(e, 3));
    },
    (e, n) => {
      ((0, x.writeUint8)(e, n.blendInteriorElements ? 1 : 0), (0, x.writeZeros)(e, 3));
    }
  );
  j(
    'knko',
    be('knockout'),
    (e, n) => {
      ((n.knockout = !!(0, v.readUint8)(e)), (0, v.skipBytes)(e, 3));
    },
    (e, n) => {
      ((0, x.writeUint8)(e, n.knockout ? 1 : 0), (0, x.writeZeros)(e, 3));
    }
  );
  j(
    'lmgm',
    be('layerMaskAsGlobalMask'),
    (e, n) => {
      ((n.layerMaskAsGlobalMask = !!(0, v.readUint8)(e)), (0, v.skipBytes)(e, 3));
    },
    (e, n) => {
      ((0, x.writeUint8)(e, n.layerMaskAsGlobalMask ? 1 : 0), (0, x.writeZeros)(e, 3));
    }
  );
  j(
    'lspf',
    be('protected'),
    (e, n) => {
      let t = (0, v.readUint32)(e);
      ((n.protected = {
        transparency: (t & 1) !== 0,
        composite: (t & 2) !== 0,
        position: (t & 4) !== 0,
      }),
        t & 8 && (n.protected.artboards = !0));
    },
    (e, n) => {
      let t =
        (n.protected.transparency ? 1 : 0) |
        (n.protected.composite ? 2 : 0) |
        (n.protected.position ? 4 : 0) |
        (n.protected.artboards ? 8 : 0);
      (0, x.writeUint32)(e, t);
    }
  );
  j(
    'lclr',
    be('layerColor'),
    (e, n) => {
      let t = (0, v.readUint16)(e);
      ((0, v.skipBytes)(e, 6), (n.layerColor = rt.layerColors[t]));
    },
    (e, n) => {
      let t = rt.layerColors.indexOf(n.layerColor);
      ((0, x.writeUint16)(e, t === -1 ? 0 : t), (0, x.writeZeros)(e, 6));
    }
  );
  j(
    'shmd',
    e =>
      e.timestamp !== void 0 ||
      e.animationFrames !== void 0 ||
      e.animationFrameFlags !== void 0 ||
      e.timeline !== void 0 ||
      e.comps !== void 0,
    (e, n, t) => {
      let i = (0, v.readUint32)(e);
      for (let r = 0; r < i; r++) {
        (0, v.checkSignature)(e, '8BIM');
        let o = (0, v.readSignature)(e);
        ((0, v.readUint8)(e),
          (0, v.skipBytes)(e, 3),
          (0, v.readSection)(e, 1, a => {
            if (o === 'cust') {
              let s = (0, S.readVersionAndDescriptor)(e);
              s.layerTime !== void 0 && (n.timestamp = s.layerTime);
            } else if (o === 'mlst') {
              let s = (0, S.readVersionAndDescriptor)(e);
              n.animationFrames = [];
              for (let c = 0; c < s.LaSt.length; c++) {
                let l = s.LaSt[c],
                  f = { frames: l.FrLs };
                (l.enab !== void 0 && (f.enable = l.enab),
                  l.Ofst && (f.offset = (0, S.horzVrtcToXY)(l.Ofst)),
                  l.FXRf && (f.referencePoint = (0, S.horzVrtcToXY)(l.FXRf)),
                  l.Lefx && (f.effects = (0, S.parseEffects)(l.Lefx, !!e.logMissingFeatures)),
                  l.blendOptions &&
                    l.blendOptions.Opct &&
                    (f.opacity = (0, S.parsePercent)(l.blendOptions.Opct)),
                  n.animationFrames.push(f));
              }
            } else if (o === 'mdyn') {
              (0, v.readUint16)(e);
              let s = (0, v.readUint8)(e),
                c = (0, v.readUint8)(e);
              n.animationFrameFlags = {
                propagateFrameOne: !s,
                unifyLayerPosition: (c & 1) !== 0,
                unifyLayerStyle: (c & 2) !== 0,
                unifyLayerVisibility: (c & 4) !== 0,
              };
            } else if (o === 'tmln') {
              let s = (0, S.readVersionAndDescriptor)(e),
                c = s.timeScope,
                l = {
                  start: (0, S.frac)(c.Strt),
                  duration: (0, S.frac)(c.duration),
                  inTime: (0, S.frac)(c.inTime),
                  outTime: (0, S.frac)(c.outTime),
                  autoScope: s.autoScope,
                  audioLevel: s.audioLevel,
                };
              (s.trackList &&
                (l.tracks = (0, S.parseTrackList)(s.trackList, !!e.logMissingFeatures)),
                (n.timeline = l));
            } else if (o === 'cmls') {
              let s = (0, S.readVersionAndDescriptor)(e);
              ((n.comps = { settings: [] }),
                s.origFXRefPoint &&
                  (n.comps.originalEffectsReferencePoint = {
                    x: s.origFXRefPoint.Hrzn,
                    y: s.origFXRefPoint.Vrtc,
                  }));
              for (let c of s.layerSettings) {
                n.comps.settings.push({ compList: c.compList });
                let l = n.comps.settings[n.comps.settings.length - 1];
                ('enab' in c && (l.enabled = c.enab),
                  c.Ofst && (l.offset = { x: c.Ofst.Hrzn, y: c.Ofst.Vrtc }),
                  c.FXRefPoint &&
                    (l.effectsReferencePoint = { x: c.FXRefPoint.Hrzn, y: c.FXRefPoint.Vrtc }));
              }
            } else if (o === 'extn') {
              let s = (0, S.readVersionAndDescriptor)(e);
              e.logMissingFeatures && e.log('Unhandled "shmd" section key', o);
            } else e.logMissingFeatures && e.log('Unhandled "shmd" section key', o);
            (0, v.skipBytes)(e, a());
          }));
      }
      (0, v.skipBytes)(e, t());
    },
    (e, n, t, i) => {
      let { animationFrames: r, animationFrameFlags: o, timestamp: a, timeline: s, comps: c } = n,
        l = 0;
      (r && l++,
        o && l++,
        s && l++,
        a !== void 0 && l++,
        c && l++,
        (0, x.writeUint32)(e, l),
        r &&
          ((0, x.writeSignature)(e, '8BIM'),
          (0, x.writeSignature)(e, 'mlst'),
          (0, x.writeUint8)(e, 0),
          (0, x.writeZeros)(e, 3),
          (0, x.writeSection)(
            e,
            2,
            () => {
              var f;
              let d = { LaID: (f = n.id) !== null && f !== void 0 ? f : 0, LaSt: [] };
              for (let u = 0; u < r.length; u++) {
                let h = r[u],
                  p = {};
                (h.enable !== void 0 && (p.enab = h.enable),
                  (p.FrLs = h.frames),
                  h.offset && (p.Ofst = (0, S.xyToHorzVrtc)(h.offset)),
                  h.referencePoint && (p.FXRf = (0, S.xyToHorzVrtc)(h.referencePoint)),
                  h.effects && (p.Lefx = (0, S.serializeEffects)(h.effects, !1, !1)),
                  h.opacity !== void 0 &&
                    (p.blendOptions = { Opct: (0, S.unitsPercent)(h.opacity) }),
                  d.LaSt.push(p));
              }
              (0, S.writeVersionAndDescriptor)(e, '', 'null', d);
            },
            !0
          )),
        o &&
          ((0, x.writeSignature)(e, '8BIM'),
          (0, x.writeSignature)(e, 'mdyn'),
          (0, x.writeUint8)(e, 0),
          (0, x.writeZeros)(e, 3),
          (0, x.writeSection)(e, 2, () => {
            ((0, x.writeUint16)(e, 0),
              (0, x.writeUint8)(e, o.propagateFrameOne ? 0 : 15),
              (0, x.writeUint8)(
                e,
                (o.unifyLayerPosition ? 1 : 0) |
                  (o.unifyLayerStyle ? 2 : 0) |
                  (o.unifyLayerVisibility ? 4 : 0)
              ));
          })),
        s &&
          ((0, x.writeSignature)(e, '8BIM'),
          (0, x.writeSignature)(e, 'tmln'),
          (0, x.writeUint8)(e, 0),
          (0, x.writeZeros)(e, 3),
          (0, x.writeSection)(
            e,
            2,
            () => {
              let f = {
                Vrsn: 1,
                timeScope: {
                  Vrsn: 1,
                  Strt: s.start,
                  duration: s.duration,
                  inTime: s.inTime,
                  outTime: s.outTime,
                },
                autoScope: s.autoScope,
                audioLevel: s.audioLevel,
              };
              s.tracks && (f.trackList = (0, S.serializeTrackList)(s.tracks));
              let d = i.layerToId.get(n) || n.id;
              if (!d)
                throw new Error(
                  'You need to provide layer.id value whan writing document with animations'
                );
              ((f.LyrI = d), (0, S.writeVersionAndDescriptor)(e, '', 'null', f, 'anim'));
            },
            !0
          )),
        a !== void 0 &&
          ((0, x.writeSignature)(e, '8BIM'),
          (0, x.writeSignature)(e, 'cust'),
          (0, x.writeUint8)(e, 0),
          (0, x.writeZeros)(e, 3),
          (0, x.writeSection)(
            e,
            2,
            () => {
              let f = { layerTime: a };
              (0, S.writeVersionAndDescriptor)(e, '', 'metadata', f);
            },
            !0
          )),
        c &&
          ((0, x.writeSignature)(e, '8BIM'),
          (0, x.writeSignature)(e, 'cmls'),
          (0, x.writeUint8)(e, 0),
          (0, x.writeZeros)(e, 3),
          (0, x.writeSection)(
            e,
            2,
            () => {
              let f = i.layerToId.get(n) || n.id;
              if (!f)
                throw new Error(
                  'You need to provide layer.id value whan writing document with layer comps'
                );
              let d = {};
              (c.originalEffectsReferencePoint &&
                (d.origFXRefPoint = {
                  Hrzn: c.originalEffectsReferencePoint.x,
                  Vrtc: c.originalEffectsReferencePoint.y,
                }),
                (d.LyrI = f),
                (d.layerSettings = []));
              for (let u of c.settings) {
                let h = {};
                (u.enabled !== void 0 && (h.enab = u.enabled),
                  u.offset && (h.Ofst = { Hrzn: u.offset.x, Vrtc: u.offset.y }),
                  u.effectsReferencePoint &&
                    (h.FXRefPoint = {
                      Hrzn: u.effectsReferencePoint.x,
                      Vrtc: u.effectsReferencePoint.y,
                    }),
                  (h.compList = u.compList),
                  d.layerSettings.push(h));
              }
              (0, S.writeVersionAndDescriptor)(e, '', 'null', d);
            },
            !0
          )));
    }
  );
  j(
    'PxSc',
    () => !1,
    (e, n) => {
      let t = (0, S.readVersionAndDescriptor)(e, !0);
      t.pixelSourceType === 1986285651
        ? (n.pixelSource = {
            type: 'vdPS',
            origin: { x: t.origin.Hrzn, y: t.origin.Vrtc },
            interpretation: {
              interpretAlpha: t.interpretation.interpretAlpha.split('.')[1],
              profile: t.interpretation.profile,
            },
            frameReader: {
              type: 'QTFR',
              link: {
                name: t.frameReader['Lnk ']['Nm  '],
                fullPath: t.frameReader['Lnk '].fullPath,
                originalPath: t.frameReader['Lnk '].originalPath,
                relativePath: t.frameReader['Lnk '].relPath,
                alias: t.frameReader['Lnk '].alis,
              },
              mediaDescriptor: t.frameReader.mediaDescriptor,
            },
            showAlteredVideo: t.showAlteredVideo,
          })
        : e.log('Unknown pixelSourceType');
    },
    (e, n) => {
      let t = n.pixelSource,
        i = {
          _name: '',
          _classID: 'PixelSource',
          pixelSourceType: 1986285651,
          descVersion: 1,
          origin: { Hrzn: t.origin.x, Vrtc: t.origin.y },
          interpretation: {
            _name: '',
            _classID: 'footageInterpretation',
            Vrsn: 1,
            interpretAlpha: `alphaInterpretation.${t.interpretation.interpretAlpha}`,
            profile: t.interpretation.profile,
          },
          frameReader: {
            _name: '',
            _classID: 'FrameReader',
            frameReaderType: 1364477522,
            descVersion: 1,
            'Lnk ': {
              _name: '',
              _classID: 'ExternalFileLink',
              descVersion: 2,
              'Nm  ': t.frameReader.link.name,
              fullPath: t.frameReader.link.fullPath,
              originalPath: t.frameReader.link.originalPath,
              alis: t.frameReader.link.alias,
              relPath: t.frameReader.link.relativePath,
            },
            mediaDescriptor: t.frameReader.mediaDescriptor,
          },
          showAlteredVideo: t.showAlteredVideo,
        };
      (0, S.writeVersionAndDescriptor)(e, '', 'PixelSource', i);
    }
  );
  j(
    'vstk',
    be('vectorStroke'),
    (e, n, t) => {
      let i = (0, S.readVersionAndDescriptor)(e);
      ((n.vectorStroke = {
        strokeEnabled: i.strokeEnabled,
        fillEnabled: i.fillEnabled,
        lineWidth: (0, S.parseUnits)(i.strokeStyleLineWidth),
        lineDashOffset: (0, S.parseUnits)(i.strokeStyleLineDashOffset),
        miterLimit: i.strokeStyleMiterLimit,
        lineCapType: S.strokeStyleLineCapType.decode(i.strokeStyleLineCapType),
        lineJoinType: S.strokeStyleLineJoinType.decode(i.strokeStyleLineJoinType),
        lineAlignment: S.strokeStyleLineAlignment.decode(i.strokeStyleLineAlignment),
        scaleLock: i.strokeStyleScaleLock,
        strokeAdjust: i.strokeStyleStrokeAdjust,
        lineDashSet: i.strokeStyleLineDashSet.map(S.parseUnits),
        blendMode: S.BlnM.decode(i.strokeStyleBlendMode),
        opacity: (0, S.parsePercent)(i.strokeStyleOpacity),
        content: (0, S.parseVectorContent)(i.strokeStyleContent),
        resolution: i.strokeStyleResolution,
      }),
        (0, v.skipBytes)(e, t()));
    },
    (e, n) => {
      var t, i, r;
      let o = n.vectorStroke,
        a = {
          strokeStyleVersion: 2,
          strokeEnabled: !!o.strokeEnabled,
          fillEnabled: !!o.fillEnabled,
          strokeStyleLineWidth: o.lineWidth || { value: 3, units: 'Points' },
          strokeStyleLineDashOffset: o.lineDashOffset || { value: 0, units: 'Points' },
          strokeStyleMiterLimit: (t = o.miterLimit) !== null && t !== void 0 ? t : 100,
          strokeStyleLineCapType: S.strokeStyleLineCapType.encode(o.lineCapType),
          strokeStyleLineJoinType: S.strokeStyleLineJoinType.encode(o.lineJoinType),
          strokeStyleLineAlignment: S.strokeStyleLineAlignment.encode(o.lineAlignment),
          strokeStyleScaleLock: !!o.scaleLock,
          strokeStyleStrokeAdjust: !!o.strokeAdjust,
          strokeStyleLineDashSet: o.lineDashSet || [],
          strokeStyleBlendMode: S.BlnM.encode(o.blendMode),
          strokeStyleOpacity: (0, S.unitsPercent)((i = o.opacity) !== null && i !== void 0 ? i : 1),
          strokeStyleContent: (0, S.serializeVectorContent)(
            o.content || { type: 'color', color: { r: 0, g: 0, b: 0 } }
          ).descriptor,
          strokeStyleResolution: (r = o.resolution) !== null && r !== void 0 ? r : 72,
        };
      (0, S.writeVersionAndDescriptor)(e, '', 'strokeStyle', a);
    }
  );
  j(
    'artb',
    be('artboard'),
    (e, n, t) => {
      let i = (0, S.readVersionAndDescriptor)(e),
        r = i.artboardRect;
      ((n.artboard = {
        rect: { top: r['Top '], left: r.Left, bottom: r.Btom, right: r.Rght },
        guideIndices: i.guideIndeces,
        presetName: i.artboardPresetName,
        color: (0, S.parseColor)(i['Clr ']),
        backgroundType: i.artboardBackgroundType,
      }),
        (0, v.skipBytes)(e, t()));
    },
    (e, n) => {
      var t;
      let i = n.artboard,
        r = i.rect,
        o = {
          artboardRect: { 'Top ': r.top, Left: r.left, Btom: r.bottom, Rght: r.right },
          guideIndeces: i.guideIndices || [],
          artboardPresetName: i.presetName || '',
          'Clr ': (0, S.serializeColor)(i.color),
          artboardBackgroundType: (t = i.backgroundType) !== null && t !== void 0 ? t : 1,
        };
      (0, S.writeVersionAndDescriptor)(e, '', 'artboard', o);
    }
  );
  j(
    'sn2P',
    be('usingAlignedRendering'),
    (e, n) => (n.usingAlignedRendering = !!(0, v.readUint32)(e)),
    (e, n) => (0, x.writeUint32)(e, n.usingAlignedRendering ? 1 : 0)
  );
  var pi = ['unknown', 'vector', 'raster', 'image stack'];
  function Gu(e) {
    var n, t, i, r, o, a;
    let s = Object.assign(
      Object.assign(
        { style: S.warpStyle.decode(e.warpStyle) },
        e.warpValues ? { values: e.warpValues } : { value: e.warpValue || 0 }
      ),
      {
        perspective: e.warpPerspective || 0,
        perspectiveOther: e.warpPerspectiveOther || 0,
        rotate: S.Ornt.decode(e.warpRotate),
        bounds: e.bounds && {
          top: (0, S.parseUnitsOrNumber)(e.bounds['Top ']),
          left: (0, S.parseUnitsOrNumber)(e.bounds.Left),
          bottom: (0, S.parseUnitsOrNumber)(e.bounds.Btom),
          right: (0, S.parseUnitsOrNumber)(e.bounds.Rght),
        },
        uOrder: e.uOrder,
        vOrder: e.vOrder,
      }
    );
    (e.deformNumRows != null || e.deformNumCols != null) &&
      ((s.deformNumRows = e.deformNumRows), (s.deformNumCols = e.deformNumCols));
    let c = e.customEnvelopeWarp;
    if (c) {
      s.customEnvelopeWarp = { meshPoints: [] };
      let l =
          ((n = c.meshPoints.find(d => d.type === 'Hrzn')) === null || n === void 0
            ? void 0
            : n.values) || [],
        f =
          ((t = c.meshPoints.find(d => d.type === 'Vrtc')) === null || t === void 0
            ? void 0
            : t.values) || [];
      for (let d = 0; d < l.length; d++) s.customEnvelopeWarp.meshPoints.push({ x: l[d], y: f[d] });
      (c.quiltSliceX || c.quiltSliceY) &&
        ((s.customEnvelopeWarp.quiltSliceX =
          ((r = (i = c.quiltSliceX) === null || i === void 0 ? void 0 : i[0]) === null ||
          r === void 0
            ? void 0
            : r.values) || []),
        (s.customEnvelopeWarp.quiltSliceY =
          ((a = (o = c.quiltSliceY) === null || o === void 0 ? void 0 : o[0]) === null ||
          a === void 0
            ? void 0
            : a.values) || []));
    }
    return s;
  }
  function _s(e) {
    var n, t;
    return (
      e.deformNumCols != null ||
      e.deformNumRows != null ||
      ((n = e.customEnvelopeWarp) === null || n === void 0 ? void 0 : n.quiltSliceX) ||
      ((t = e.customEnvelopeWarp) === null || t === void 0 ? void 0 : t.quiltSliceY)
    );
  }
  function Eo(e) {
    let n = e.bounds,
      t = Object.assign(
        Object.assign(
          { warpStyle: S.warpStyle.encode(e.style) },
          e.values ? { warpValues: e.values } : { warpValue: e.value || 0 }
        ),
        {
          warpPerspective: e.perspective || 0,
          warpPerspectiveOther: e.perspectiveOther || 0,
          warpRotate: S.Ornt.encode(e.rotate),
          bounds: {
            'Top ': (0, S.unitsValue)((n && n.top) || { units: 'Pixels', value: 0 }, 'bounds.top'),
            Left: (0, S.unitsValue)((n && n.left) || { units: 'Pixels', value: 0 }, 'bounds.left'),
            Btom: (0, S.unitsValue)(
              (n && n.bottom) || { units: 'Pixels', value: 0 },
              'bounds.bottom'
            ),
            Rght: (0, S.unitsValue)(
              (n && n.right) || { units: 'Pixels', value: 0 },
              'bounds.right'
            ),
          },
          uOrder: e.uOrder || 0,
          vOrder: e.vOrder || 0,
        }
      ),
      i = _s(e);
    if (i) {
      let o = t;
      ((o.deformNumRows = e.deformNumRows || 0), (o.deformNumCols = e.deformNumCols || 0));
    }
    let r = e.customEnvelopeWarp;
    if (r) {
      let o = r.meshPoints || [];
      if (i) {
        let a = t;
        a.customEnvelopeWarp = {
          _name: '',
          _classID: 'customEnvelopeWarp',
          quiltSliceX: [{ type: 'quiltSliceX', values: r.quiltSliceX || [] }],
          quiltSliceY: [{ type: 'quiltSliceY', values: r.quiltSliceY || [] }],
          meshPoints: [
            { type: 'Hrzn', values: o.map(s => s.x) },
            { type: 'Vrtc', values: o.map(s => s.y) },
          ],
        };
      } else
        t.customEnvelopeWarp = {
          _name: '',
          _classID: 'customEnvelopeWarp',
          meshPoints: [
            { type: 'Hrzn', values: o.map(a => a.x) },
            { type: 'Vrtc', values: o.map(a => a.y) },
          ],
        };
    }
    return t;
  }
  j(
    'PlLd',
    be('placedLayer'),
    (e, n, t) => {
      if ((0, v.readSignature)(e) !== 'plcL') throw new Error('Invalid PlLd signature');
      if ((0, v.readInt32)(e) !== 3) throw new Error('Invalid PlLd version');
      let i = (0, v.readPascalString)(e, 1),
        r = (0, v.readInt32)(e),
        o = (0, v.readInt32)(e);
      (0, v.readInt32)(e);
      let a = (0, v.readInt32)(e);
      if (!pi[a]) throw new Error('Invalid PlLd type');
      let s = [];
      for (let f = 0; f < 8; f++) s.push((0, v.readFloat64)(e));
      let c = (0, v.readInt32)(e);
      if (c !== 0) throw new Error(`Invalid Warp version ${c}`);
      let l = (0, S.readVersionAndDescriptor)(e);
      ((n.placedLayer = n.placedLayer || {
        id: i,
        type: pi[a],
        pageNumber: r,
        totalPages: o,
        transform: s,
        warp: Gu(l),
      }),
        (0, v.skipBytes)(e, t()));
    },
    (e, n) => {
      let t = n.placedLayer;
      if (
        ((0, x.writeSignature)(e, 'plcL'),
        (0, x.writeInt32)(e, 3),
        !t.id ||
          typeof t.id != 'string' ||
          !/^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(t.id))
      )
        throw new Error(
          'Placed layer ID must be in a GUID format (example: 20953ddb-9391-11ec-b4f1-c15674f50bc4)'
        );
      if (
        ((0, x.writePascalString)(e, t.id, 1),
        (0, x.writeInt32)(e, t.pageNumber || 1),
        (0, x.writeInt32)(e, t.totalPages || 1),
        (0, x.writeInt32)(e, 16),
        pi.indexOf(t.type) === -1)
      )
        throw new Error('Invalid placedLayer type');
      (0, x.writeInt32)(e, pi.indexOf(t.type));
      for (let a = 0; a < 8; a++) (0, x.writeFloat64)(e, t.transform[a]);
      (0, x.writeInt32)(e, 0);
      let i = $u(t),
        o = _s(i) ? 'quiltWarp' : 'warp';
      (0, S.writeVersionAndDescriptor)(e, '', o, Eo(i), o);
    }
  );
  function z1(e) {
    return new Float32Array(e.buffer.slice(e.byteOffset), 0, e.byteLength / 4);
  }
  function N1(e) {
    return new Uint32Array(e.buffer.slice(e.byteOffset), 0, e.byteLength / 4);
  }
  function ms(e) {
    return new Uint8Array(e.buffer, e.byteOffset, e.byteLength);
  }
  function Fo(e) {
    let n = [];
    for (let t = 0; t < e.length; t += 2) n.push({ x: e[t], y: e[t + 1] });
    return n;
  }
  function Qi(e) {
    let n = [];
    for (let t = 0; t < e.length; t++) n.push(e[t].x, e[t].y);
    return n;
  }
  function Pu(e) {
    return Fo(z1(e));
  }
  function er(e) {
    return { x: (0, S.parseUnits)(e.Hrzn), y: (0, S.parseUnits)(e.Vrtc) };
  }
  function tr(e) {
    return {
      _name: '',
      _classID: 'Pnt ',
      Hrzn: (0, S.unitsValue)(e.x, 'x'),
      Vrtc: (0, S.unitsValue)(e.y, 'y'),
    };
  }
  function j1(e, n) {
    let t = {
      name: e['Nm  '],
      opacity: (0, S.parsePercent)(e.blendOptions.Opct),
      blendMode: S.BlnM.decode(e.blendOptions['Md  ']),
      enabled: e.enab,
      hasOptions: e.hasoptions,
      foregroundColor: (0, S.parseColor)(e.FrgC),
      backgroundColor: (0, S.parseColor)(e.BckC),
    };
    if ('Fltr' in e)
      switch (e.Fltr._classID) {
        case 'boxblur':
          return Object.assign(Object.assign({}, t), {
            type: 'box blur',
            filter: { radius: (0, S.parseUnits)(e.Fltr['Rds ']) },
          });
        case 'GsnB':
          return Object.assign(Object.assign({}, t), {
            type: 'gaussian blur',
            filter: { radius: (0, S.parseUnits)(e.Fltr['Rds ']) },
          });
        case 'MtnB':
          return Object.assign(Object.assign({}, t), {
            type: 'motion blur',
            filter: { angle: e.Fltr.Angl, distance: (0, S.parseUnits)(e.Fltr.Dstn) },
          });
        case 'RdlB':
          return Object.assign(Object.assign({}, t), {
            type: 'radial blur',
            filter: {
              amount: e.Fltr.Amnt,
              method: S.BlrM.decode(e.Fltr.BlrM),
              quality: S.BlrQ.decode(e.Fltr.BlrQ),
            },
          });
        case 'shapeBlur':
          return Object.assign(Object.assign({}, t), {
            type: 'shape blur',
            filter: {
              radius: (0, S.parseUnits)(e.Fltr['Rds ']),
              customShape: { name: e.Fltr.customShape['Nm  '], id: e.Fltr.customShape.Idnt },
            },
          });
        case 'SmrB':
          return Object.assign(Object.assign({}, t), {
            type: 'smart blur',
            filter: {
              radius: e.Fltr['Rds '],
              threshold: e.Fltr.Thsh,
              quality: S.SmBQ.decode(e.Fltr.SmBQ),
              mode: S.SmBM.decode(e.Fltr.SmBM),
            },
          });
        case 'surfaceBlur':
          return Object.assign(Object.assign({}, t), {
            type: 'surface blur',
            filter: { radius: (0, S.parseUnits)(e.Fltr['Rds ']), threshold: e.Fltr.Thsh },
          });
        case 'Dspl':
          return Object.assign(Object.assign({}, t), {
            type: 'displace',
            filter: {
              horizontalScale: e.Fltr.HrzS,
              verticalScale: e.Fltr.VrtS,
              displacementMap: S.DspM.decode(e.Fltr.DspM),
              undefinedAreas: S.UndA.decode(e.Fltr.UndA),
              displacementFile: { signature: e.Fltr.DspF.sig, path: e.Fltr.DspF.path },
            },
          });
        case 'Pnch':
          return Object.assign(Object.assign({}, t), {
            type: 'pinch',
            filter: { amount: e.Fltr.Amnt },
          });
        case 'Plr ':
          return Object.assign(Object.assign({}, t), {
            type: 'polar coordinates',
            filter: { conversion: S.Cnvr.decode(e.Fltr.Cnvr) },
          });
        case 'Rple':
          return Object.assign(Object.assign({}, t), {
            type: 'ripple',
            filter: { amount: e.Fltr.Amnt, size: S.RplS.decode(e.Fltr.RplS) },
          });
        case 'Shr ':
          return Object.assign(Object.assign({}, t), {
            type: 'shear',
            filter: {
              shearPoints: e.Fltr.ShrP.map(i => ({ x: i.Hrzn, y: i.Vrtc })),
              shearStart: e.Fltr.ShrS,
              shearEnd: e.Fltr.ShrE,
              undefinedAreas: S.UndA.decode(e.Fltr.UndA),
            },
          });
        case 'Sphr':
          return Object.assign(Object.assign({}, t), {
            type: 'spherize',
            filter: { amount: e.Fltr.Amnt, mode: S.SphM.decode(e.Fltr.SphM) },
          });
        case 'Twrl':
          return Object.assign(Object.assign({}, t), {
            type: 'twirl',
            filter: { angle: e.Fltr.Angl },
          });
        case 'Wave':
          return Object.assign(Object.assign({}, t), {
            type: 'wave',
            filter: {
              numberOfGenerators: e.Fltr.NmbG,
              type: S.Wvtp.decode(e.Fltr.Wvtp),
              wavelength: { min: e.Fltr.WLMn, max: e.Fltr.WLMx },
              amplitude: { min: e.Fltr.AmMn, max: e.Fltr.AmMx },
              scale: { x: e.Fltr.SclH, y: e.Fltr.SclV },
              randomSeed: e.Fltr.RndS,
              undefinedAreas: S.UndA.decode(e.Fltr.UndA),
            },
          });
        case 'ZgZg':
          return Object.assign(Object.assign({}, t), {
            type: 'zigzag',
            filter: { amount: e.Fltr.Amnt, ridges: e.Fltr.NmbR, style: S.ZZTy.decode(e.Fltr.ZZTy) },
          });
        case 'AdNs':
          return Object.assign(Object.assign({}, t), {
            type: 'add noise',
            filter: {
              amount: (0, S.parsePercent)(e.Fltr.Nose),
              distribution: S.Dstr.decode(e.Fltr.Dstr),
              monochromatic: e.Fltr.Mnch,
              randomSeed: e.Fltr.FlRs,
            },
          });
        case 'DstS':
          return Object.assign(Object.assign({}, t), {
            type: 'dust and scratches',
            filter: { radius: e.Fltr['Rds '], threshold: e.Fltr.Thsh },
          });
        case 'Mdn ':
          return Object.assign(Object.assign({}, t), {
            type: 'median',
            filter: { radius: (0, S.parseUnits)(e.Fltr['Rds ']) },
          });
        case 'denoise':
          return Object.assign(Object.assign({}, t), {
            type: 'reduce noise',
            filter: {
              preset: e.Fltr.preset,
              removeJpegArtifact: e.Fltr.removeJPEGArtifact,
              reduceColorNoise: (0, S.parsePercent)(e.Fltr.ClNs),
              sharpenDetails: (0, S.parsePercent)(e.Fltr.Shrp),
              channelDenoise: e.Fltr.channelDenoise.map(i =>
                Object.assign(
                  { channels: i.Chnl.map(S.Chnl.decode), amount: i.Amnt },
                  i.EdgF ? { preserveDetails: i.EdgF } : {}
                )
              ),
            },
          });
        case 'ClrH':
          return Object.assign(Object.assign({}, t), {
            type: 'color halftone',
            filter: {
              radius: e.Fltr['Rds '],
              angle1: e.Fltr.Ang1,
              angle2: e.Fltr.Ang2,
              angle3: e.Fltr.Ang3,
              angle4: e.Fltr.Ang4,
            },
          });
        case 'Crst':
          return Object.assign(Object.assign({}, t), {
            type: 'crystallize',
            filter: { cellSize: e.Fltr.ClSz, randomSeed: e.Fltr.FlRs },
          });
        case 'Mztn':
          return Object.assign(Object.assign({}, t), {
            type: 'mezzotint',
            filter: { type: S.MztT.decode(e.Fltr.MztT), randomSeed: e.Fltr.FlRs },
          });
        case 'Msc ':
          return Object.assign(Object.assign({}, t), {
            type: 'mosaic',
            filter: { cellSize: (0, S.parseUnits)(e.Fltr.ClSz) },
          });
        case 'Pntl':
          return Object.assign(Object.assign({}, t), {
            type: 'pointillize',
            filter: { cellSize: e.Fltr.ClSz, randomSeed: e.Fltr.FlRs },
          });
        case 'Clds':
          return Object.assign(Object.assign({}, t), {
            type: 'clouds',
            filter: { randomSeed: e.Fltr.FlRs },
          });
        case 'DfrC':
          return Object.assign(Object.assign({}, t), {
            type: 'difference clouds',
            filter: { randomSeed: e.Fltr.FlRs },
          });
        case 'Fbrs':
          return Object.assign(Object.assign({}, t), {
            type: 'fibers',
            filter: { variance: e.Fltr.Vrnc, strength: e.Fltr.Strg, randomSeed: e.Fltr.RndS },
          });
        case 'LnsF':
          return Object.assign(Object.assign({}, t), {
            type: 'lens flare',
            filter: {
              brightness: e.Fltr.Brgh,
              position: { x: e.Fltr.FlrC.Hrzn, y: e.Fltr.FlrC.Vrtc },
              lensType: S.Lns.decode(e.Fltr['Lns ']),
            },
          });
        case 'smartSharpen':
          return Object.assign(Object.assign({}, t), {
            type: 'smart sharpen',
            filter: {
              amount: (0, S.parsePercent)(e.Fltr.Amnt),
              radius: (0, S.parseUnits)(e.Fltr['Rds ']),
              threshold: e.Fltr.Thsh,
              angle: e.Fltr.Angl,
              moreAccurate: e.Fltr.moreAccurate,
              blur: S.blurType.decode(e.Fltr.blur),
              preset: e.Fltr.preset,
              shadow: {
                fadeAmount: (0, S.parsePercent)(e.Fltr.sdwM.Amnt),
                tonalWidth: (0, S.parsePercent)(e.Fltr.sdwM.Wdth),
                radius: e.Fltr.sdwM['Rds '],
              },
              highlight: {
                fadeAmount: (0, S.parsePercent)(e.Fltr.hglM.Amnt),
                tonalWidth: (0, S.parsePercent)(e.Fltr.hglM.Wdth),
                radius: e.Fltr.hglM['Rds '],
              },
            },
          });
        case 'UnsM':
          return Object.assign(Object.assign({}, t), {
            type: 'unsharp mask',
            filter: {
              amount: (0, S.parsePercent)(e.Fltr.Amnt),
              radius: (0, S.parseUnits)(e.Fltr['Rds ']),
              threshold: e.Fltr.Thsh,
            },
          });
        case 'Dfs ':
          return Object.assign(Object.assign({}, t), {
            type: 'diffuse',
            filter: { mode: S.DfsM.decode(e.Fltr['Md  ']), randomSeed: e.Fltr.FlRs },
          });
        case 'Embs':
          return Object.assign(Object.assign({}, t), {
            type: 'emboss',
            filter: { angle: e.Fltr.Angl, height: e.Fltr.Hght, amount: e.Fltr.Amnt },
          });
        case 'Extr':
          return Object.assign(Object.assign({}, t), {
            type: 'extrude',
            filter: {
              type: S.ExtT.decode(e.Fltr.ExtT),
              size: e.Fltr.ExtS,
              depth: e.Fltr.ExtD,
              depthMode: S.ExtR.decode(e.Fltr.ExtR),
              randomSeed: e.Fltr.FlRs,
              solidFrontFaces: e.Fltr.ExtF,
              maskIncompleteBlocks: e.Fltr.ExtM,
            },
          });
        case 'Tls ':
          return Object.assign(Object.assign({}, t), {
            type: 'tiles',
            filter: {
              numberOfTiles: e.Fltr.TlNm,
              maximumOffset: e.Fltr.TlOf,
              fillEmptyAreaWith: S.FlCl.decode(e.Fltr.FlCl),
              randomSeed: e.Fltr.FlRs,
            },
          });
        case 'TrcC':
          return Object.assign(Object.assign({}, t), {
            type: 'trace contour',
            filter: { level: e.Fltr['Lvl '], edge: S.CntE.decode(e.Fltr['Edg ']) },
          });
        case 'Wnd ':
          return Object.assign(Object.assign({}, t), {
            type: 'wind',
            filter: { method: S.WndM.decode(e.Fltr.WndM), direction: S.Drct.decode(e.Fltr.Drct) },
          });
        case 'Dntr':
          return Object.assign(Object.assign({}, t), {
            type: 'de-interlace',
            filter: {
              eliminate: S.IntE.decode(e.Fltr.IntE),
              newFieldsBy: S.IntC.decode(e.Fltr.IntC),
            },
          });
        case 'Cstm':
          return Object.assign(Object.assign({}, t), {
            type: 'custom',
            filter: { scale: e.Fltr['Scl '], offset: e.Fltr.Ofst, matrix: e.Fltr.Mtrx },
          });
        case 'HghP':
          return Object.assign(Object.assign({}, t), {
            type: 'high pass',
            filter: { radius: (0, S.parseUnits)(e.Fltr['Rds ']) },
          });
        case 'Mxm ':
          return Object.assign(Object.assign({}, t), {
            type: 'maximum',
            filter: { radius: (0, S.parseUnits)(e.Fltr['Rds ']) },
          });
        case 'Mnm ':
          return Object.assign(Object.assign({}, t), {
            type: 'minimum',
            filter: { radius: (0, S.parseUnits)(e.Fltr['Rds ']) },
          });
        case 'Ofst':
          return Object.assign(Object.assign({}, t), {
            type: 'offset',
            filter: {
              horizontal: e.Fltr.Hrzn,
              vertical: e.Fltr.Vrtc,
              undefinedAreas: S.FlMd.decode(e.Fltr['Fl  ']),
            },
          });
        case 'rigidTransform':
          return Object.assign(Object.assign({}, t), {
            type: 'puppet',
            filter: {
              rigidType: e.Fltr.rigidType,
              bounds: [
                { x: e.Fltr.PuX0, y: e.Fltr.PuY0 },
                { x: e.Fltr.PuX1, y: e.Fltr.PuY1 },
                { x: e.Fltr.PuX2, y: e.Fltr.PuY2 },
                { x: e.Fltr.PuX3, y: e.Fltr.PuY3 },
              ],
              puppetShapeList: e.Fltr.puppetShapeList.map(i => ({
                rigidType: i.rigidType,
                originalVertexArray: Pu(i.originalVertexArray),
                deformedVertexArray: Pu(i.deformedVertexArray),
                indexArray: Array.from(N1(i.indexArray)),
                pinOffsets: Fo(i.pinOffsets),
                posFinalPins: Fo(i.posFinalPins),
                pinVertexIndices: i.pinVertexIndices,
                selectedPin: i.selectedPin,
                pinPosition: Fo(i.PinP),
                pinRotation: i.PnRt,
                pinOverlay: i.PnOv,
                pinDepth: i.PnDp,
                meshQuality: i.meshQuality,
                meshExpansion: i.meshExpansion,
                meshRigidity: i.meshRigidity,
                imageResolution: i.imageResolution,
                meshBoundaryPath: {
                  pathComponents: i.meshBoundaryPath.pathComponents.map(r => ({
                    shapeOperation: r.shapeOperation.split('.')[1],
                    paths: r.SbpL.map(o => ({
                      closed: o.Clsp,
                      points: o['Pts '].map(a => ({
                        anchor: er(a.Anch),
                        forward: er(a['Fwd ']),
                        backward: er(a['Bwd ']),
                        smooth: a.Smoo,
                      })),
                    })),
                  })),
                },
              })),
            },
          });
        case 'PbPl': {
          let i = [],
            r = e.Fltr;
          for (let o = 0; o < it.length && r[`PN${it[o]}a`]; o++)
            for (let a = 0; a < it.length && r[`PN${it[o]}${it[a]}`]; a++)
              i.push({ name: r[`PN${it[o]}${it[a]}`], value: r[`PF${it[o]}${it[a]}`] });
          return Object.assign(Object.assign({}, t), {
            type: 'oil paint plugin',
            filter: { name: e.Fltr.KnNm, gpu: e.Fltr.GpuY, lighting: e.Fltr.LIWy, parameters: i },
          });
        }
        case 'HsbP':
          return Object.assign(Object.assign({}, t), {
            type: 'hsb/hsl',
            filter: { inputMode: S.ClrS.decode(e.Fltr.Inpt), rowOrder: S.ClrS.decode(e.Fltr.Otpt) },
          });
        case 'oilPaint':
          return Object.assign(Object.assign({}, t), {
            type: 'oil paint',
            filter: {
              lightingOn: e.Fltr.lightingOn,
              stylization: e.Fltr.stylization,
              cleanliness: e.Fltr.cleanliness,
              brushScale: e.Fltr.brushScale,
              microBrush: e.Fltr.microBrush,
              lightDirection: e.Fltr.LghD,
              specularity: e.Fltr.specularity,
            },
          });
        case 'LqFy':
          return Object.assign(Object.assign({}, t), {
            type: 'liquify',
            filter: { liquifyMesh: e.Fltr.LqMe },
          });
        case 'perspectiveWarpTransform':
          return Object.assign(Object.assign({}, t), {
            type: 'perspective warp',
            filter: {
              vertices: e.Fltr.vertices.map(er),
              warpedVertices: e.Fltr.warpedVertices.map(er),
              quads: e.Fltr.quads.map(i => i.indices),
            },
          });
        case 'Crvs':
          return Object.assign(Object.assign({}, t), {
            type: 'curves',
            filter: Object.assign(
              { presetKind: S.presetKindType.decode(e.Fltr.presetKind) },
              e.Fltr.Adjs
                ? {
                    adjustments: e.Fltr.Adjs.map(i => {
                      let r = i.Chnl.map(S.Chnl.decode);
                      if (i['Crv '])
                        return {
                          channels: r,
                          curve: i['Crv '].map(o => {
                            let a = { x: o.Hrzn, y: o.Vrtc };
                            return (o.Cnty && (a.curved = !0), a);
                          }),
                        };
                      if (i.Mpng) return { channels: r, values: i.Mpng };
                      throw new Error('Unknown curve adjustment');
                    }),
                  }
                : {}
            ),
          });
        case 'BrgC':
          return Object.assign(Object.assign({}, t), {
            type: 'brightness/contrast',
            filter: {
              brightness: e.Fltr.Brgh,
              contrast: e.Fltr.Cntr,
              useLegacy: !!e.Fltr.useLegacy,
            },
          });
        default:
          if (n.throwForMissingFeatures)
            throw new Error(`Unknown filter classId: ${e.Fltr._classID}`);
          return;
      }
    else
      switch (e.filterID) {
        case 1098281575:
          return Object.assign(Object.assign({}, t), { type: 'average' });
        case 1114403360:
          return Object.assign(Object.assign({}, t), { type: 'blur' });
        case 1114403405:
          return Object.assign(Object.assign({}, t), { type: 'blur more' });
        case 1148416099:
          return Object.assign(Object.assign({}, t), { type: 'despeckle' });
        case 1180922912:
          return Object.assign(Object.assign({}, t), { type: 'facet' });
        case 1181902701:
          return Object.assign(Object.assign({}, t), { type: 'fragment' });
        case 1399353968:
          return Object.assign(Object.assign({}, t), { type: 'sharpen' });
        case 1399353925:
          return Object.assign(Object.assign({}, t), { type: 'sharpen edges' });
        case 1399353933:
          return Object.assign(Object.assign({}, t), { type: 'sharpen more' });
        case 1181639749:
          return Object.assign(Object.assign({}, t), { type: 'find edges' });
        case 1399616122:
          return Object.assign(Object.assign({}, t), { type: 'solarize' });
        case 1314149187:
          return Object.assign(Object.assign({}, t), { type: 'ntsc colors' });
        case 1231976050:
          return Object.assign(Object.assign({}, t), { type: 'invert' });
        default:
          if (n.throwForMissingFeatures) throw new Error(`Unknown filterID: ${e.filterID}`);
      }
  }
  function V1(e, n) {
    return {
      enabled: e.enab,
      validAtPosition: e.validAtPosition,
      maskEnabled: e.filterMaskEnable,
      maskLinked: e.filterMaskLinked,
      maskExtendWithWhite: e.filterMaskExtendWithWhite,
      list: e.filterFXList.map(t => j1(t, n)).filter(t => !!t),
    };
  }
  function Tt(e) {
    return (0, S.unitsValue)(e.radius, 'radius');
  }
  function G1(e) {
    let n = {
      _name: '',
      _classID: 'filterFX',
      'Nm  ': e.name,
      blendOptions: {
        _name: '',
        _classID: 'blendOptions',
        Opct: (0, S.unitsPercentF)(e.opacity),
        'Md  ': S.BlnM.encode(e.blendMode),
      },
      enab: e.enabled,
      hasoptions: e.hasOptions,
      FrgC: (0, S.serializeColor)(e.foregroundColor),
      BckC: (0, S.serializeColor)(e.backgroundColor),
    };
    switch (e.type) {
      case 'average':
        return Object.assign(Object.assign({}, n), { filterID: 1098281575 });
      case 'blur':
        return Object.assign(Object.assign({}, n), { filterID: 1114403360 });
      case 'blur more':
        return Object.assign(Object.assign({}, n), { filterID: 1114403405 });
      case 'box blur':
        return Object.assign(Object.assign({}, n), {
          Fltr: { _name: 'Box Blur', _classID: 'boxblur', 'Rds ': Tt(e.filter) },
          filterID: 697,
        });
      case 'gaussian blur':
        return Object.assign(Object.assign({}, n), {
          Fltr: { _name: 'Gaussian Blur', _classID: 'GsnB', 'Rds ': Tt(e.filter) },
          filterID: 1198747202,
        });
      case 'motion blur':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Motion Blur',
            _classID: 'MtnB',
            Angl: e.filter.angle,
            Dstn: (0, S.unitsValue)(e.filter.distance, 'distance'),
          },
          filterID: 1299476034,
        });
      case 'radial blur':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Radial Blur',
            _classID: 'RdlB',
            Amnt: e.filter.amount,
            BlrM: S.BlrM.encode(e.filter.method),
            BlrQ: S.BlrQ.encode(e.filter.quality),
          },
          filterID: 1382313026,
        });
      case 'shape blur':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Shape Blur',
            _classID: 'shapeBlur',
            'Rds ': Tt(e.filter),
            customShape: {
              _name: '',
              _classID: 'customShape',
              'Nm  ': e.filter.customShape.name,
              Idnt: e.filter.customShape.id,
            },
          },
          filterID: 702,
        });
      case 'smart blur':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Smart Blur',
            _classID: 'SmrB',
            'Rds ': e.filter.radius,
            Thsh: e.filter.threshold,
            SmBQ: S.SmBQ.encode(e.filter.quality),
            SmBM: S.SmBM.encode(e.filter.mode),
          },
          filterID: 1399681602,
        });
      case 'surface blur':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Surface Blur',
            _classID: 'surfaceBlur',
            'Rds ': Tt(e.filter),
            Thsh: e.filter.threshold,
          },
          filterID: 701,
        });
      case 'displace':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Displace',
            _classID: 'Dspl',
            HrzS: e.filter.horizontalScale,
            VrtS: e.filter.verticalScale,
            DspM: S.DspM.encode(e.filter.displacementMap),
            UndA: S.UndA.encode(e.filter.undefinedAreas),
            DspF: {
              sig: e.filter.displacementFile.signature,
              path: e.filter.displacementFile.path,
            },
          },
          filterID: 1148416108,
        });
      case 'pinch':
        return Object.assign(Object.assign({}, n), {
          Fltr: { _name: 'Pinch', _classID: 'Pnch', Amnt: e.filter.amount },
          filterID: 1349411688,
        });
      case 'polar coordinates':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Polar Coordinates',
            _classID: 'Plr ',
            Cnvr: S.Cnvr.encode(e.filter.conversion),
          },
          filterID: 1349284384,
        });
      case 'ripple':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Ripple',
            _classID: 'Rple',
            Amnt: e.filter.amount,
            RplS: S.RplS.encode(e.filter.size),
          },
          filterID: 1383099493,
        });
      case 'shear':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Shear',
            _classID: 'Shr ',
            ShrP: e.filter.shearPoints.map(t => ({
              _name: '',
              _classID: 'Pnt ',
              Hrzn: t.x,
              Vrtc: t.y,
            })),
            UndA: S.UndA.encode(e.filter.undefinedAreas),
            ShrS: e.filter.shearStart,
            ShrE: e.filter.shearEnd,
          },
          filterID: 1399353888,
        });
      case 'spherize':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Spherize',
            _classID: 'Sphr',
            Amnt: e.filter.amount,
            SphM: S.SphM.encode(e.filter.mode),
          },
          filterID: 1399875698,
        });
      case 'twirl':
        return Object.assign(Object.assign({}, n), {
          Fltr: { _name: 'Twirl', _classID: 'Twrl', Angl: e.filter.angle },
          filterID: 1417114220,
        });
      case 'wave':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Wave',
            _classID: 'Wave',
            Wvtp: S.Wvtp.encode(e.filter.type),
            NmbG: e.filter.numberOfGenerators,
            WLMn: e.filter.wavelength.min,
            WLMx: e.filter.wavelength.max,
            AmMn: e.filter.amplitude.min,
            AmMx: e.filter.amplitude.max,
            SclH: e.filter.scale.x,
            SclV: e.filter.scale.y,
            UndA: S.UndA.encode(e.filter.undefinedAreas),
            RndS: e.filter.randomSeed,
          },
          filterID: 1466005093,
        });
      case 'zigzag':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'ZigZag',
            _classID: 'ZgZg',
            Amnt: e.filter.amount,
            NmbR: e.filter.ridges,
            ZZTy: S.ZZTy.encode(e.filter.style),
          },
          filterID: 1516722791,
        });
      case 'add noise':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Add Noise',
            _classID: 'AdNs',
            Dstr: S.Dstr.encode(e.filter.distribution),
            Nose: (0, S.unitsPercentF)(e.filter.amount),
            Mnch: e.filter.monochromatic,
            FlRs: e.filter.randomSeed,
          },
          filterID: 1097092723,
        });
      case 'despeckle':
        return Object.assign(Object.assign({}, n), { filterID: 1148416099 });
      case 'dust and scratches':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Dust & Scratches',
            _classID: 'DstS',
            'Rds ': e.filter.radius,
            Thsh: e.filter.threshold,
          },
          filterID: 1148417107,
        });
      case 'median':
        return Object.assign(Object.assign({}, n), {
          Fltr: { _name: 'Median', _classID: 'Mdn ', 'Rds ': Tt(e.filter) },
          filterID: 1298427424,
        });
      case 'reduce noise':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Reduce Noise',
            _classID: 'denoise',
            ClNs: (0, S.unitsPercentF)(e.filter.reduceColorNoise),
            Shrp: (0, S.unitsPercentF)(e.filter.sharpenDetails),
            removeJPEGArtifact: e.filter.removeJpegArtifact,
            channelDenoise: e.filter.channelDenoise.map(t =>
              Object.assign(
                {
                  _name: '',
                  _classID: 'channelDenoiseParams',
                  Chnl: t.channels.map(i => S.Chnl.encode(i)),
                  Amnt: t.amount,
                },
                t.preserveDetails ? { EdgF: t.preserveDetails } : {}
              )
            ),
            preset: e.filter.preset,
          },
          filterID: 633,
        });
      case 'color halftone':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Color Halftone',
            _classID: 'ClrH',
            'Rds ': e.filter.radius,
            Ang1: e.filter.angle1,
            Ang2: e.filter.angle2,
            Ang3: e.filter.angle3,
            Ang4: e.filter.angle4,
          },
          filterID: 1131180616,
        });
      case 'crystallize':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Crystallize',
            _classID: 'Crst',
            ClSz: e.filter.cellSize,
            FlRs: e.filter.randomSeed,
          },
          filterID: 1131574132,
        });
      case 'facet':
        return Object.assign(Object.assign({}, n), { filterID: 1180922912 });
      case 'fragment':
        return Object.assign(Object.assign({}, n), { filterID: 1181902701 });
      case 'mezzotint':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Mezzotint',
            _classID: 'Mztn',
            MztT: S.MztT.encode(e.filter.type),
            FlRs: e.filter.randomSeed,
          },
          filterID: 1299870830,
        });
      case 'mosaic':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Mosaic',
            _classID: 'Msc ',
            ClSz: (0, S.unitsValue)(e.filter.cellSize, 'cellSize'),
          },
          filterID: 1299407648,
        });
      case 'pointillize':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Pointillize',
            _classID: 'Pntl',
            ClSz: e.filter.cellSize,
            FlRs: e.filter.randomSeed,
          },
          filterID: 1349416044,
        });
      case 'clouds':
        return Object.assign(Object.assign({}, n), {
          Fltr: { _name: 'Clouds', _classID: 'Clds', FlRs: e.filter.randomSeed },
          filterID: 1131177075,
        });
      case 'difference clouds':
        return Object.assign(Object.assign({}, n), {
          Fltr: { _name: 'Difference Clouds', _classID: 'DfrC', FlRs: e.filter.randomSeed },
          filterID: 1147564611,
        });
      case 'fibers':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Fibers',
            _classID: 'Fbrs',
            Vrnc: e.filter.variance,
            Strg: e.filter.strength,
            RndS: e.filter.randomSeed,
          },
          filterID: 1180856947,
        });
      case 'lens flare':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Lens Flare',
            _classID: 'LnsF',
            Brgh: e.filter.brightness,
            FlrC: {
              _name: '',
              _classID: 'Pnt ',
              Hrzn: e.filter.position.x,
              Vrtc: e.filter.position.y,
            },
            'Lns ': S.Lns.encode(e.filter.lensType),
          },
          filterID: 1282306886,
        });
      case 'sharpen':
        return Object.assign(Object.assign({}, n), { filterID: 1399353968 });
      case 'sharpen edges':
        return Object.assign(Object.assign({}, n), { filterID: 1399353925 });
      case 'sharpen more':
        return Object.assign(Object.assign({}, n), { filterID: 1399353933 });
      case 'smart sharpen':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Smart Sharpen',
            _classID: 'smartSharpen',
            Amnt: (0, S.unitsPercentF)(e.filter.amount),
            'Rds ': Tt(e.filter),
            Thsh: e.filter.threshold,
            Angl: e.filter.angle,
            moreAccurate: e.filter.moreAccurate,
            blur: S.blurType.encode(e.filter.blur),
            preset: e.filter.preset,
            sdwM: {
              _name: 'Parameters',
              _classID: 'adaptCorrectTones',
              Amnt: (0, S.unitsPercentF)(e.filter.shadow.fadeAmount),
              Wdth: (0, S.unitsPercentF)(e.filter.shadow.tonalWidth),
              'Rds ': e.filter.shadow.radius,
            },
            hglM: {
              _name: 'Parameters',
              _classID: 'adaptCorrectTones',
              Amnt: (0, S.unitsPercentF)(e.filter.highlight.fadeAmount),
              Wdth: (0, S.unitsPercentF)(e.filter.highlight.tonalWidth),
              'Rds ': e.filter.highlight.radius,
            },
          },
          filterID: 698,
        });
      case 'unsharp mask':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Unsharp Mask',
            _classID: 'UnsM',
            Amnt: (0, S.unitsPercentF)(e.filter.amount),
            'Rds ': Tt(e.filter),
            Thsh: e.filter.threshold,
          },
          filterID: 1433301837,
        });
      case 'diffuse':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Diffuse',
            _classID: 'Dfs ',
            'Md  ': S.DfsM.encode(e.filter.mode),
            FlRs: e.filter.randomSeed,
          },
          filterID: 1147564832,
        });
      case 'emboss':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Emboss',
            _classID: 'Embs',
            Angl: e.filter.angle,
            Hght: e.filter.height,
            Amnt: e.filter.amount,
          },
          filterID: 1164796531,
        });
      case 'extrude':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Extrude',
            _classID: 'Extr',
            ExtS: e.filter.size,
            ExtD: e.filter.depth,
            ExtF: e.filter.solidFrontFaces,
            ExtM: e.filter.maskIncompleteBlocks,
            ExtT: S.ExtT.encode(e.filter.type),
            ExtR: S.ExtR.encode(e.filter.depthMode),
            FlRs: e.filter.randomSeed,
          },
          filterID: 1165522034,
        });
      case 'find edges':
        return Object.assign(Object.assign({}, n), { filterID: 1181639749 });
      case 'solarize':
        return Object.assign(Object.assign({}, n), { filterID: 1399616122 });
      case 'tiles':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Tiles',
            _classID: 'Tls ',
            TlNm: e.filter.numberOfTiles,
            TlOf: e.filter.maximumOffset,
            FlCl: S.FlCl.encode(e.filter.fillEmptyAreaWith),
            FlRs: e.filter.randomSeed,
          },
          filterID: 1416393504,
        });
      case 'trace contour':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Trace Contour',
            _classID: 'TrcC',
            'Lvl ': e.filter.level,
            'Edg ': S.CntE.encode(e.filter.edge),
          },
          filterID: 1416782659,
        });
      case 'wind':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Wind',
            _classID: 'Wnd ',
            WndM: S.WndM.encode(e.filter.method),
            Drct: S.Drct.encode(e.filter.direction),
          },
          filterID: 1466852384,
        });
      case 'de-interlace':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'De-Interlace',
            _classID: 'Dntr',
            IntE: S.IntE.encode(e.filter.eliminate),
            IntC: S.IntC.encode(e.filter.newFieldsBy),
          },
          filterID: 1148089458,
        });
      case 'ntsc colors':
        return Object.assign(Object.assign({}, n), { filterID: 1314149187 });
      case 'invert':
        return Object.assign(Object.assign({}, n), { filterID: 1231976050 });
      case 'custom':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Custom',
            _classID: 'Cstm',
            'Scl ': e.filter.scale,
            Ofst: e.filter.offset,
            Mtrx: e.filter.matrix,
          },
          filterID: 1131639917,
        });
      case 'high pass':
        return Object.assign(Object.assign({}, n), {
          Fltr: { _name: 'High Pass', _classID: 'HghP', 'Rds ': Tt(e.filter) },
          filterID: 1214736464,
        });
      case 'maximum':
        return Object.assign(Object.assign({}, n), {
          Fltr: { _name: 'Maximum', _classID: 'Mxm ', 'Rds ': Tt(e.filter) },
          filterID: 1299737888,
        });
      case 'minimum':
        return Object.assign(Object.assign({}, n), {
          Fltr: { _name: 'Minimum', _classID: 'Mnm ', 'Rds ': Tt(e.filter) },
          filterID: 1299082528,
        });
      case 'offset':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Offset',
            _classID: 'Ofst',
            Hrzn: e.filter.horizontal,
            Vrtc: e.filter.vertical,
            'Fl  ': S.FlMd.encode(e.filter.undefinedAreas),
          },
          filterID: 1332114292,
        });
      case 'puppet':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Rigid Transform',
            _classID: 'rigidTransform',
            null: ['Ordn.Trgt'],
            rigidType: e.filter.rigidType,
            puppetShapeList: e.filter.puppetShapeList.map(t => ({
              _name: '',
              _classID: 'puppetShape',
              rigidType: t.rigidType,
              VrsM: 1,
              VrsN: 0,
              originalVertexArray: ms(new Float32Array(Qi(t.originalVertexArray))),
              deformedVertexArray: ms(new Float32Array(Qi(t.deformedVertexArray))),
              indexArray: ms(new Uint32Array(t.indexArray)),
              pinOffsets: Qi(t.pinOffsets),
              posFinalPins: Qi(t.posFinalPins),
              pinVertexIndices: t.pinVertexIndices,
              PinP: Qi(t.pinPosition),
              PnRt: t.pinRotation,
              PnOv: t.pinOverlay,
              PnDp: t.pinDepth,
              meshQuality: t.meshQuality,
              meshExpansion: t.meshExpansion,
              meshRigidity: t.meshRigidity,
              imageResolution: t.imageResolution,
              meshBoundaryPath: {
                _name: '',
                _classID: 'pathClass',
                pathComponents: t.meshBoundaryPath.pathComponents.map(i => ({
                  _name: '',
                  _classID: 'PaCm',
                  shapeOperation: `shapeOperation.${i.shapeOperation}`,
                  SbpL: i.paths.map(r => ({
                    _name: '',
                    _classID: 'Sbpl',
                    Clsp: r.closed,
                    'Pts ': r.points.map(o => ({
                      _name: '',
                      _classID: 'Pthp',
                      Anch: tr(o.anchor),
                      'Fwd ': tr(o.forward),
                      'Bwd ': tr(o.backward),
                      Smoo: o.smooth,
                    })),
                  })),
                })),
              },
              selectedPin: t.selectedPin,
            })),
            PuX0: e.filter.bounds[0].x,
            PuX1: e.filter.bounds[1].x,
            PuX2: e.filter.bounds[2].x,
            PuX3: e.filter.bounds[3].x,
            PuY0: e.filter.bounds[0].y,
            PuY1: e.filter.bounds[1].y,
            PuY2: e.filter.bounds[2].y,
            PuY3: e.filter.bounds[3].y,
          },
          filterID: 991,
        });
      case 'oil paint plugin': {
        let t = {};
        for (let i = 0; i < e.filter.parameters.length; i++) {
          let { name: r, value: o } = e.filter.parameters[i],
            a = `${it[Math.floor(i / it.length)]}${it[i % it.length]}`;
          ((t[`PN${a}`] = r), (t[`PT${a}`] = 0), (t[`PF${a}`] = o));
        }
        return Object.assign(Object.assign({}, n), {
          Fltr: Object.assign(
            {
              _name: 'Oil Paint Plugin',
              _classID: 'PbPl',
              KnNm: e.filter.name,
              GpuY: e.filter.gpu,
              LIWy: e.filter.lighting,
              FPth: '1',
            },
            t
          ),
          filterID: 1348620396,
        });
      }
      case 'oil paint':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Oil Paint',
            _classID: 'oilPaint',
            lightingOn: e.filter.lightingOn,
            stylization: e.filter.stylization,
            cleanliness: e.filter.cleanliness,
            brushScale: e.filter.brushScale,
            microBrush: e.filter.microBrush,
            LghD: e.filter.lightDirection,
            specularity: e.filter.specularity,
          },
          filterID: 1122,
        });
      case 'liquify':
        return Object.assign(Object.assign({}, n), {
          Fltr: { _name: 'Liquify', _classID: 'LqFy', LqMe: e.filter.liquifyMesh },
          filterID: 1282492025,
        });
      case 'perspective warp':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Perspective Warp',
            _classID: 'perspectiveWarpTransform',
            vertices: e.filter.vertices.map(tr),
            warpedVertices: e.filter.warpedVertices.map(tr),
            quads: e.filter.quads.map(t => ({ indices: t })),
          },
          filterID: 442,
        });
      case 'curves':
        return Object.assign(Object.assign({}, n), {
          Fltr: Object.assign(
            {
              _name: 'Curves',
              _classID: 'Crvs',
              presetKind: S.presetKindType.encode(e.filter.presetKind),
            },
            e.filter.adjustments
              ? {
                  Adjs: e.filter.adjustments.map(t =>
                    'curve' in t
                      ? {
                          _name: '',
                          _classID: 'CrvA',
                          Chnl: t.channels.map(S.Chnl.encode),
                          'Crv ': t.curve.map(i =>
                            Object.assign(
                              { _name: '', _classID: 'Pnt ', Hrzn: i.x, Vrtc: i.y },
                              i.curved ? { Cnty: !0 } : {}
                            )
                          ),
                        }
                      : {
                          _name: '',
                          _classID: 'CrvA',
                          Chnl: t.channels.map(S.Chnl.encode),
                          Mpng: t.values,
                        }
                  ),
                }
              : {}
          ),
          filterID: 1131574899,
        });
      case 'brightness/contrast':
        return Object.assign(Object.assign({}, n), {
          Fltr: {
            _name: 'Brightness/Contrast',
            _classID: 'BrgC',
            Brgh: e.filter.brightness,
            Cntr: e.filter.contrast,
            useLegacy: !!e.filter.useLegacy,
          },
          filterID: 1114793795,
        });
      default:
        throw new Error(`Unknow filter type: ${e.type}`);
    }
  }
  function $u(e) {
    if (e.warp) return e.warp;
    if (!e.width || !e.height)
      throw new Error('You must provide width and height of the linked image in placedLayer');
    let n = e.width,
      t = e.height,
      i = 0,
      r = n / 3,
      o = (n * 2) / 3,
      a = n,
      s = 0,
      c = t / 3,
      l = (t * 2) / 3,
      f = t;
    return {
      style: 'custom',
      value: 0,
      perspective: 0,
      perspectiveOther: 0,
      rotate: 'horizontal',
      bounds: {
        top: { value: 0, units: 'Pixels' },
        left: { value: 0, units: 'Pixels' },
        bottom: { value: t, units: 'Pixels' },
        right: { value: n, units: 'Pixels' },
      },
      uOrder: 4,
      vOrder: 4,
      customEnvelopeWarp: {
        meshPoints: [
          { x: i, y: s },
          { x: r, y: s },
          { x: o, y: s },
          { x: a, y: s },
          { x: i, y: c },
          { x: r, y: c },
          { x: o, y: c },
          { x: a, y: c },
          { x: i, y: l },
          { x: r, y: l },
          { x: o, y: l },
          { x: a, y: l },
          { x: i, y: f },
          { x: r, y: f },
          { x: o, y: f },
          { x: a, y: f },
        ],
      },
    };
  }
  j(
    'SoLd',
    be('placedLayer'),
    (e, n, t) => {
      if ((0, v.readSignature)(e) !== 'soLD') throw new Error('Invalid SoLd type');
      let i = (0, v.readInt32)(e);
      if (i !== 4 && i !== 5) throw new Error('Invalid SoLd version');
      let r = (0, S.readVersionAndDescriptor)(e, !0);
      ((n.placedLayer = {
        id: r.Idnt,
        placed: r.placed,
        type: pi[r.Type],
        pageNumber: r.PgNm,
        totalPages: r.totalPages,
        frameStep: (0, S.frac)(r.frameStep),
        duration: (0, S.frac)(r.duration),
        frameCount: r.frameCount,
        transform: r.Trnf,
        width: r['Sz  '].Wdth,
        height: r['Sz  '].Hght,
        resolution: (0, S.parseUnits)(r.Rslt),
        warp: Gu(r.quiltWarp || r.warp),
      }),
        r.nonAffineTransform &&
          r.nonAffineTransform.some((o, a) => o !== r.Trnf[a]) &&
          (n.placedLayer.nonAffineTransform = r.nonAffineTransform),
        r.Crop && (n.placedLayer.crop = r.Crop),
        r.comp && (n.placedLayer.comp = r.comp),
        r.compInfo &&
          (n.placedLayer.compInfo = {
            compID: r.compInfo.compID,
            originalCompID: r.compInfo.originalCompID,
          }),
        r.filterFX && (n.placedLayer.filter = V1(r.filterFX, e)),
        (0, v.skipBytes)(e, t()));
    },
    (e, n) => {
      var t, i;
      ((0, x.writeSignature)(e, 'soLD'), (0, x.writeInt32)(e, 4));
      let r = n.placedLayer;
      if (
        !r.id ||
        typeof r.id != 'string' ||
        !/^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(r.id)
      )
        throw new Error(
          'Placed layer ID must be in a GUID format (example: 20953ddb-9391-11ec-b4f1-c15674f50bc4)'
        );
      let o = Object.assign(
        Object.assign(
          {
            Idnt: r.id,
            placed: (t = r.placed) !== null && t !== void 0 ? t : r.id,
            PgNm: r.pageNumber || 1,
            totalPages: r.totalPages || 1,
          },
          r.crop ? { Crop: r.crop } : {}
        ),
        {
          frameStep: r.frameStep || { numerator: 0, denominator: 600 },
          duration: r.duration || { numerator: 0, denominator: 600 },
          frameCount: r.frameCount || 0,
          Annt: 16,
          Type: pi.indexOf(r.type),
          Trnf: r.transform,
          nonAffineTransform: (i = r.nonAffineTransform) !== null && i !== void 0 ? i : r.transform,
          warp: Eo($u(r)),
          'Sz  ': { _name: '', _classID: 'Pnt ', Wdth: r.width || 0, Hght: r.height || 0 },
          Rslt: r.resolution
            ? (0, S.unitsValue)(r.resolution, 'resolution')
            : { units: 'Density', value: 72 },
        }
      );
      if (
        (r.filter &&
          (o.filterFX = {
            _name: '',
            _classID: 'filterFXStyle',
            enab: r.filter.enabled,
            validAtPosition: r.filter.validAtPosition,
            filterMaskEnable: r.filter.maskEnabled,
            filterMaskLinked: r.filter.maskLinked,
            filterMaskExtendWithWhite: r.filter.maskExtendWithWhite,
            filterFXList: r.filter.list.map(a => G1(a)),
          }),
        r.warp && _s(r.warp))
      ) {
        let a = Eo(r.warp);
        ((o.quiltWarp = a),
          (o.warp = {
            warpStyle: 'warpStyle.warpNone',
            warpValue: a.warpValue,
            warpPerspective: a.warpPerspective,
            warpPerspectiveOther: a.warpPerspectiveOther,
            warpRotate: a.warpRotate,
            bounds: a.bounds,
            uOrder: a.uOrder,
            vOrder: a.vOrder,
          }));
      } else delete o.quiltWarp;
      (r.comp && (o.comp = r.comp),
        r.compInfo && (o.compInfo = r.compInfo),
        (0, S.writeVersionAndDescriptor)(e, '', 'null', o, o.quiltWarp ? 'quiltWarp' : 'warp'));
    }
  );
  mn('SoLE', 'SoLd');
  j(
    'fxrp',
    be('referencePoint'),
    (e, n) => {
      n.referencePoint = { x: (0, v.readFloat64)(e), y: (0, v.readFloat64)(e) };
    },
    (e, n) => {
      ((0, x.writeFloat64)(e, n.referencePoint.x), (0, x.writeFloat64)(e, n.referencePoint.y));
    }
  );
  j(
    'Lr16',
    () => !1,
    (e, n, t, i, r) => {
      (0, v.readLayerInfo)(e, i, r);
    },
    (e, n) => {}
  );
  j(
    'Lr32',
    () => !1,
    (e, n, t, i, r) => {
      (0, v.readLayerInfo)(e, i, r);
    },
    (e, n) => {}
  );
  j(
    'LMsk',
    be('userMask'),
    (e, n) => {
      if (
        ((n.userMask = { colorSpace: (0, v.readColor)(e), opacity: (0, v.readUint16)(e) / 255 }),
        (0, v.readUint8)(e) !== 128)
      )
        throw new Error('Invalid flag value');
      (0, v.skipBytes)(e, 1);
    },
    (e, n) => {
      let t = n.userMask;
      ((0, x.writeColor)(e, t.colorSpace),
        (0, x.writeUint16)(e, (0, rt.clamp)(t.opacity, 0, 1) * 255),
        (0, x.writeUint8)(e, 128),
        (0, x.writeZeros)(e, 1));
    }
  );
  rt.MOCK_HANDLERS
    ? j(
        'Patt',
        e => e._Patt !== void 0,
        (e, n, t) => {
          n._Patt = (0, v.readBytes)(e, t());
        },
        (e, n) => !1
      )
    : j(
        'Patt',
        e => !!(e.patterns && e.patterns.length > 0),
        (e, n, t) => {
          for (; t() > 0;) {
            let i = (0, v.readPattern)(e);
            (n.patterns === void 0 && (n.patterns = []), n.patterns.push(i));
          }
        },
        (e, n, t, i) => {
          let r = n.patterns || [];
          for (let o of r) (0, x.writePattern)(e, o);
        }
      );
  mn('Pat2', 'Patt');
  mn('Pat3', 'Patt');
  rt.MOCK_HANDLERS &&
    j(
      'CAI ',
      e => e._CAI_ !== void 0,
      (e, n, t) => {
        n._CAI_ = (0, v.readBytes)(e, t());
      },
      (e, n) => {
        (0, x.writeBytes)(e, n._CAI_);
      }
    );
  rt.MOCK_HANDLERS &&
    j(
      'OCIO',
      e => e._OCIO !== void 0,
      (e, n, t) => {
        n._OCIO = (0, v.readBytes)(e, t());
      },
      (e, n) => {
        (0, x.writeBytes)(e, n._OCIO);
      }
    );
  rt.MOCK_HANDLERS &&
    j(
      'GenI',
      e => e._GenI !== void 0,
      (e, n, t) => {
        n._GenI = (0, v.readBytes)(e, t());
      },
      (e, n) => {
        (0, x.writeBytes)(e, n._GenI);
      }
    );
  function Tu(e) {
    let n = (0, v.readInt32)(e),
      t = (0, v.readInt32)(e),
      i = (0, v.readInt32)(e),
      r = (0, v.readInt32)(e);
    return { top: n, left: t, bottom: i, right: r };
  }
  function Ru(e, n) {
    ((0, x.writeInt32)(e, n.top),
      (0, x.writeInt32)(e, n.left),
      (0, x.writeInt32)(e, n.bottom),
      (0, x.writeInt32)(e, n.right));
  }
  j(
    'Anno',
    e => e.annotations !== void 0,
    (e, n, t) => {
      let i = (0, v.readUint16)(e),
        r = (0, v.readUint16)(e);
      if (i !== 2 || r !== 1) throw new Error('Invalid Anno version');
      let o = (0, v.readUint32)(e),
        a = [];
      for (let s = 0; s < o; s++) {
        (0, v.readUint32)(e);
        let c = (0, v.readSignature)(e),
          l = !!(0, v.readUint8)(e);
        ((0, v.readUint8)(e), (0, v.readUint16)(e));
        let f = Tu(e),
          d = Tu(e),
          u = (0, v.readColor)(e),
          h = (0, v.readPascalString)(e, 2),
          p = (0, v.readPascalString)(e, 2),
          _ = (0, v.readPascalString)(e, 2);
        ((0, v.readUint32)(e), (0, v.readSignature)(e));
        let b = (0, v.readUint32)(e),
          g;
        if (c === 'txtA')
          (b >= 2 && (0, v.readUint16)(e) === 65279
            ? (g = (0, v.readUnicodeStringWithLength)(e, (b - 2) / 2))
            : ((e.offset -= 2), (g = (0, v.readAsciiString)(e, b))),
            (g = g.replace(
              /\r/g,
              `
`
            )));
        else if (c === 'sndA') g = (0, v.readBytes)(e, b);
        else throw new Error('Unknown annotation type');
        a.push({
          type: c === 'txtA' ? 'text' : 'sound',
          open: l,
          iconLocation: f,
          popupLocation: d,
          color: u,
          author: h,
          name: p,
          date: _,
          data: g,
        });
      }
      ((n.annotations = a), (0, v.skipBytes)(e, t()));
    },
    (e, n) => {
      let t = n.annotations;
      ((0, x.writeUint16)(e, 2), (0, x.writeUint16)(e, 1), (0, x.writeUint32)(e, t.length));
      for (let i of t) {
        let r = i.type === 'sound';
        if (r && !(i.data instanceof Uint8Array))
          throw new Error('Sound annotation data should be Uint8Array');
        if (!r && typeof i.data != 'string')
          throw new Error('Text annotation data should be string');
        let o = e.offset;
        ((0, x.writeUint32)(e, 0),
          (0, x.writeSignature)(e, r ? 'sndA' : 'txtA'),
          (0, x.writeUint8)(e, i.open ? 1 : 0),
          (0, x.writeUint8)(e, 28),
          (0, x.writeUint16)(e, 1),
          Ru(e, i.iconLocation),
          Ru(e, i.popupLocation),
          (0, x.writeColor)(e, i.color),
          (0, x.writePascalString)(e, i.author || '', 2),
          (0, x.writePascalString)(e, i.name || '', 2),
          (0, x.writePascalString)(e, i.date || '', 2));
        let a = e.offset;
        ((0, x.writeUint32)(e, 0),
          (0, x.writeSignature)(e, r ? 'sndM' : 'txtC'),
          (0, x.writeUint32)(e, 0));
        let s = e.offset;
        if (r) (0, x.writeBytes)(e, i.data);
        else {
          (0, x.writeUint16)(e, 65279);
          let c = i.data.replace(/\n/g, '\r');
          for (let l = 0; l < c.length; l++) (0, x.writeUint16)(e, c.charCodeAt(l));
        }
        (e.view.setUint32(o, e.offset - o, !1),
          e.view.setUint32(a, e.offset - a, !1),
          e.view.setUint32(s - 4, e.offset - s, !1));
      }
    }
  );
  function Zu(e) {
    j(
      e,
      n => {
        let t = n;
        return !(
          !t.linkedFiles ||
          !t.linkedFiles.length ||
          (e === 'lnkE' && !t.linkedFiles.some(i => i.linkedFile))
        );
      },
      (n, t, i, r) => {
        let o = t;
        for (o.linkedFiles = o.linkedFiles || []; i() > 8;) {
          let a = ps(n),
            s = n.offset,
            c = (0, v.readSignature)(n),
            l = (0, v.readInt32)(n),
            f = (0, v.readPascalString)(n, 1),
            d = (0, v.readUnicodeString)(n),
            u = (0, v.readSignature)(n).trim(),
            h = (0, v.readSignature)(n).trim(),
            p = ps(n),
            b = (0, v.readUint8)(n) ? (0, S.readVersionAndDescriptor)(n) : void 0,
            g = c === 'liFE' ? (0, S.readVersionAndDescriptor)(n) : void 0,
            y = { id: f, name: d };
          if (
            (u && (y.type = u),
            h && (y.creator = h),
            b &&
              (y.descriptor = {
                compInfo: { compID: b.compInfo.compID, originalCompID: b.compInfo.originalCompID },
              }),
            c === 'liFE' && l > 3)
          ) {
            let m = (0, v.readInt32)(n),
              A = (0, v.readUint8)(n),
              M = (0, v.readUint8)(n),
              k = (0, v.readUint8)(n),
              E = (0, v.readUint8)(n),
              F = (0, v.readFloat64)(n),
              I = Math.floor(F),
              C = (F - I) * 1e3;
            y.time = new Date(Date.UTC(m, A, M, k, E, I, C)).toISOString();
          }
          let w = c === 'liFE' ? ps(n) : 0;
          for (
            c === 'liFA' && (0, v.skipBytes)(n, 8),
              c === 'liFD' && (y.data = (0, v.readBytes)(n, p)),
              l >= 5 && (y.childDocumentID = (0, v.readUnicodeString)(n)),
              l >= 6 && (y.assetModTime = (0, v.readFloat64)(n)),
              l >= 7 && (y.assetLockedState = (0, v.readUint8)(n)),
              c === 'liFE' && l === 2 && (y.data = (0, v.readBytes)(n, w)),
              n.skipLinkedFilesData && (y.data = void 0),
              e === 'lnkE' &&
                (y.linkedFile = {
                  fileSize: w,
                  name: g?.['Nm  '] || '',
                  fullPath: g?.fullPath || '',
                  originalPath: g?.originalPath || '',
                  relativePath: g?.relPath || '',
                }),
              o.linkedFiles.push(y);
            a % 4;
          )
            a++;
          n.offset = s + a;
        }
        (0, v.skipBytes)(n, i());
      },
      (n, t) => {
        var i, r, o, a, s, c, l, f, d;
        let u = t;
        for (let h of u.linkedFiles) {
          if ((e === 'lnkE') != !!h.linkedFile) continue;
          let p = 2;
          (h.assetLockedState != null
            ? (p = 7)
            : h.assetModTime != null
              ? (p = 6)
              : h.childDocumentID != null
                ? (p = 5)
                : e === 'lnkE' && (p = 3),
            gs(n, 0));
          let _ = n.offset;
          if (
            ((0, x.writeSignature)(n, e === 'lnkE' ? 'liFE' : h.data ? 'liFD' : 'liFA'),
            (0, x.writeInt32)(n, p),
            !h.id ||
              typeof h.id != 'string' ||
              !/^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/.test(h.id))
          )
            throw new Error(
              'Linked file ID must be in a GUID format (example: 20953ddb-9391-11ec-b4f1-c15674f50bc4)'
            );
          if (
            ((0, x.writePascalString)(n, h.id, 1),
            (0, x.writeUnicodeStringWithPadding)(n, h.name || ''),
            (0, x.writeSignature)(n, h.type ? `${h.type}    `.substring(0, 4) : '    '),
            (0, x.writeSignature)(n, h.creator ? `${h.creator}    `.substring(0, 4) : '\0\0\0\0'),
            gs(n, h.data ? h.data.byteLength : 0),
            h.descriptor && h.descriptor.compInfo)
          ) {
            let g = {
              compInfo: {
                compID: h.descriptor.compInfo.compID,
                originalCompID: h.descriptor.compInfo.originalCompID,
              },
            };
            ((0, x.writeUint8)(n, 1), (0, S.writeVersionAndDescriptor)(n, '', 'null', g));
          } else (0, x.writeUint8)(n, 0);
          if (e === 'lnkE') {
            let g = {
              descVersion: 2,
              'Nm  ':
                (r = (i = h.linkedFile) === null || i === void 0 ? void 0 : i.name) !== null &&
                r !== void 0
                  ? r
                  : '',
              fullPath:
                (a = (o = h.linkedFile) === null || o === void 0 ? void 0 : o.fullPath) !== null &&
                a !== void 0
                  ? a
                  : '',
              originalPath:
                (c = (s = h.linkedFile) === null || s === void 0 ? void 0 : s.originalPath) !==
                  null && c !== void 0
                  ? c
                  : '',
              relPath:
                (f = (l = h.linkedFile) === null || l === void 0 ? void 0 : l.relativePath) !==
                  null && f !== void 0
                  ? f
                  : '',
            };
            (0, S.writeVersionAndDescriptor)(n, '', 'ExternalFileLink', g);
            let y = h.time ? new Date(h.time) : new Date();
            ((0, x.writeInt32)(n, y.getUTCFullYear()),
              (0, x.writeUint8)(n, y.getUTCMonth()),
              (0, x.writeUint8)(n, y.getUTCDate()),
              (0, x.writeUint8)(n, y.getUTCHours()),
              (0, x.writeUint8)(n, y.getUTCMinutes()),
              (0, x.writeFloat64)(n, y.getUTCSeconds() + y.getUTCMilliseconds() / 1e3));
          }
          (h.data
            ? (0, x.writeBytes)(n, h.data)
            : gs(n, ((d = h.linkedFile) === null || d === void 0 ? void 0 : d.fileSize) || 0),
            p >= 5 && (0, x.writeUnicodeStringWithPadding)(n, h.childDocumentID || ''),
            p >= 6 && (0, x.writeFloat64)(n, h.assetModTime || 0),
            p >= 7 && (0, x.writeUint8)(n, h.assetLockedState || 0));
          let b = n.offset - _;
          for (n.view.setUint32(_ - 4, b, !1); b % 4;) (b++, (0, x.writeUint8)(n, 0));
        }
      }
    );
  }
  Zu('lnk2');
  Zu('lnkE');
  mn('lnkD', 'lnk2');
  mn('lnk3', 'lnk2');
  j(
    'pths',
    be('pathList'),
    (e, n) => {
      let t = (0, S.readVersionAndDescriptor)(e, !0);
      n.pathList = [];
    },
    (e, n) => {
      let t = { pathList: [] };
      (0, S.writeVersionAndDescriptor)(e, '', 'pathsDataClass', t);
    }
  );
  j(
    'lyvr',
    be('version'),
    (e, n) => (n.version = (0, v.readUint32)(e)),
    (e, n) => (0, x.writeUint32)(e, n.version)
  );
  j(
    'lfxs',
    () => !1,
    (e, n, t) => {
      if ((0, v.readUint32)(e) !== 0) throw new Error('Invalid lfxs version');
      let r = (0, S.readVersionAndDescriptor)(e);
      ((n.effects = (0, S.parseEffects)(r, !!e.logMissingFeatures)), (0, v.skipBytes)(e, t()));
    },
    (e, n, t, i) => {
      let r = (0, S.serializeEffects)(n.effects, !!i.logMissingFeatures, !0);
      ((0, x.writeUint32)(e, 0), (0, S.writeVersionAndDescriptor)(e, '', 'null', r));
    }
  );
  function je(e) {
    return n => !!n.adjustment && n.adjustment.type === e;
  }
  j(
    'brit',
    je('brightness/contrast'),
    (e, n, t) => {
      (n.adjustment ||
        (n.adjustment = {
          type: 'brightness/contrast',
          brightness: (0, v.readInt16)(e),
          contrast: (0, v.readInt16)(e),
          meanValue: (0, v.readInt16)(e),
          labColorOnly: !!(0, v.readUint8)(e),
          useLegacy: !0,
        }),
        (0, v.skipBytes)(e, t()));
    },
    (e, n) => {
      var t;
      let i = n.adjustment;
      ((0, x.writeInt16)(e, i.brightness || 0),
        (0, x.writeInt16)(e, i.contrast || 0),
        (0, x.writeInt16)(e, (t = i.meanValue) !== null && t !== void 0 ? t : 127),
        (0, x.writeUint8)(e, i.labColorOnly ? 1 : 0),
        (0, x.writeZeros)(e, 1));
    }
  );
  function So(e) {
    let n = (0, v.readInt16)(e),
      t = (0, v.readInt16)(e),
      i = (0, v.readInt16)(e),
      r = (0, v.readInt16)(e),
      o = (0, v.readInt16)(e) / 100;
    return {
      shadowInput: n,
      highlightInput: t,
      shadowOutput: i,
      highlightOutput: r,
      midtoneInput: o,
    };
  }
  function nr(e, n) {
    ((0, x.writeInt16)(e, n.shadowInput),
      (0, x.writeInt16)(e, n.highlightInput),
      (0, x.writeInt16)(e, n.shadowOutput),
      (0, x.writeInt16)(e, n.highlightOutput),
      (0, x.writeInt16)(e, Math.round(n.midtoneInput * 100)));
  }
  j(
    'levl',
    je('levels'),
    (e, n, t) => {
      if ((0, v.readUint16)(e) !== 2) throw new Error('Invalid levl version');
      ((n.adjustment = Object.assign(Object.assign({}, n.adjustment), {
        type: 'levels',
        rgb: So(e),
        red: So(e),
        green: So(e),
        blue: So(e),
      })),
        (0, v.skipBytes)(e, t()));
    },
    (e, n) => {
      let t = n.adjustment,
        i = {
          shadowInput: 0,
          highlightInput: 255,
          shadowOutput: 0,
          highlightOutput: 255,
          midtoneInput: 1,
        };
      ((0, x.writeUint16)(e, 2),
        nr(e, t.rgb || i),
        nr(e, t.red || i),
        nr(e, t.green || i),
        nr(e, t.blue || i));
      for (let r = 0; r < 59; r++) nr(e, i);
    }
  );
  function ko(e) {
    let n = (0, v.readUint16)(e),
      t = [];
    for (let i = 0; i < n; i++) {
      let r = (0, v.readInt16)(e),
        o = (0, v.readInt16)(e);
      t.push({ input: o, output: r });
    }
    return t;
  }
  function gn(e, n) {
    (0, x.writeUint16)(e, n.length);
    for (let t of n) ((0, x.writeUint16)(e, t.output), (0, x.writeUint16)(e, t.input));
  }
  j(
    'curv',
    je('curves'),
    (e, n, t) => {
      if (((0, v.readUint8)(e), (0, v.readUint16)(e) !== 1))
        throw new Error('Invalid curv version');
      (0, v.readUint16)(e);
      let i = (0, v.readUint16)(e),
        r = { type: 'curves' };
      (i & 1 && (r.rgb = ko(e)),
        i & 2 && (r.red = ko(e)),
        i & 4 && (r.green = ko(e)),
        i & 8 && (r.blue = ko(e)),
        (n.adjustment = Object.assign(Object.assign({}, n.adjustment), r)),
        (0, v.skipBytes)(e, t()));
    },
    (e, n) => {
      let t = n.adjustment,
        { rgb: i, red: r, green: o, blue: a } = t,
        s = 0,
        c = 0;
      (i && i.length && ((s |= 1), c++),
        r && r.length && ((s |= 2), c++),
        o && o.length && ((s |= 4), c++),
        a && a.length && ((s |= 8), c++),
        (0, x.writeUint8)(e, 0),
        (0, x.writeUint16)(e, 1),
        (0, x.writeUint16)(e, 0),
        (0, x.writeUint16)(e, s),
        i && i.length && gn(e, i),
        r && r.length && gn(e, r),
        o && o.length && gn(e, o),
        a && a.length && gn(e, a),
        (0, x.writeSignature)(e, 'Crv '),
        (0, x.writeUint16)(e, 4),
        (0, x.writeUint16)(e, 0),
        (0, x.writeUint16)(e, c),
        i && i.length && ((0, x.writeUint16)(e, 0), gn(e, i)),
        r && r.length && ((0, x.writeUint16)(e, 1), gn(e, r)),
        o && o.length && ((0, x.writeUint16)(e, 2), gn(e, o)),
        a && a.length && ((0, x.writeUint16)(e, 3), gn(e, a)));
    }
  );
  j(
    'expA',
    je('exposure'),
    (e, n, t) => {
      if ((0, v.readUint16)(e) !== 1) throw new Error('Invalid expA version');
      ((n.adjustment = Object.assign(Object.assign({}, n.adjustment), {
        type: 'exposure',
        exposure: (0, v.readFloat32)(e),
        offset: (0, v.readFloat32)(e),
        gamma: (0, v.readFloat32)(e),
      })),
        (0, v.skipBytes)(e, t()));
    },
    (e, n) => {
      let t = n.adjustment;
      ((0, x.writeUint16)(e, 1),
        (0, x.writeFloat32)(e, t.exposure),
        (0, x.writeFloat32)(e, t.offset),
        (0, x.writeFloat32)(e, t.gamma),
        (0, x.writeZeros)(e, 2));
    }
  );
  j(
    'vibA',
    je('vibrance'),
    (e, n, t) => {
      let i = (0, S.readVersionAndDescriptor)(e);
      ((n.adjustment = { type: 'vibrance' }),
        i.vibrance !== void 0 && (n.adjustment.vibrance = i.vibrance),
        i.Strt !== void 0 && (n.adjustment.saturation = i.Strt),
        (0, v.skipBytes)(e, t()));
    },
    (e, n) => {
      let t = n.adjustment,
        i = {};
      (t.vibrance !== void 0 && (i.vibrance = t.vibrance),
        t.saturation !== void 0 && (i.Strt = t.saturation),
        (0, S.writeVersionAndDescriptor)(e, '', 'null', i));
    }
  );
  function Un(e) {
    return {
      a: (0, v.readInt16)(e),
      b: (0, v.readInt16)(e),
      c: (0, v.readInt16)(e),
      d: (0, v.readInt16)(e),
      hue: (0, v.readInt16)(e),
      saturation: (0, v.readInt16)(e),
      lightness: (0, v.readInt16)(e),
    };
  }
  function Pn(e, n) {
    let t = n || {};
    ((0, x.writeInt16)(e, t.a || 0),
      (0, x.writeInt16)(e, t.b || 0),
      (0, x.writeInt16)(e, t.c || 0),
      (0, x.writeInt16)(e, t.d || 0),
      (0, x.writeInt16)(e, t.hue || 0),
      (0, x.writeInt16)(e, t.saturation || 0),
      (0, x.writeInt16)(e, t.lightness || 0));
  }
  j(
    'hue2',
    je('hue/saturation'),
    (e, n, t) => {
      if ((0, v.readUint16)(e) !== 2) throw new Error('Invalid hue2 version');
      ((n.adjustment = Object.assign(Object.assign({}, n.adjustment), {
        type: 'hue/saturation',
        master: Un(e),
        reds: Un(e),
        yellows: Un(e),
        greens: Un(e),
        cyans: Un(e),
        blues: Un(e),
        magentas: Un(e),
      })),
        (0, v.skipBytes)(e, t()));
    },
    (e, n) => {
      let t = n.adjustment;
      ((0, x.writeUint16)(e, 2),
        Pn(e, t.master),
        Pn(e, t.reds),
        Pn(e, t.yellows),
        Pn(e, t.greens),
        Pn(e, t.cyans),
        Pn(e, t.blues),
        Pn(e, t.magentas));
    }
  );
  function bs(e) {
    return {
      cyanRed: (0, v.readInt16)(e),
      magentaGreen: (0, v.readInt16)(e),
      yellowBlue: (0, v.readInt16)(e),
    };
  }
  function ys(e, n) {
    ((0, x.writeInt16)(e, n.cyanRed || 0),
      (0, x.writeInt16)(e, n.magentaGreen || 0),
      (0, x.writeInt16)(e, n.yellowBlue || 0));
  }
  j(
    'blnc',
    je('color balance'),
    (e, n, t) => {
      ((n.adjustment = {
        type: 'color balance',
        shadows: bs(e),
        midtones: bs(e),
        highlights: bs(e),
        preserveLuminosity: !!(0, v.readUint8)(e),
      }),
        (0, v.skipBytes)(e, t()));
    },
    (e, n) => {
      let t = n.adjustment;
      (ys(e, t.shadows || {}),
        ys(e, t.midtones || {}),
        ys(e, t.highlights || {}),
        (0, x.writeUint8)(e, t.preserveLuminosity ? 1 : 0),
        (0, x.writeZeros)(e, 1));
    }
  );
  j(
    'blwh',
    je('black & white'),
    (e, n, t) => {
      let i = (0, S.readVersionAndDescriptor)(e);
      ((n.adjustment = {
        type: 'black & white',
        reds: i['Rd  '],
        yellows: i.Yllw,
        greens: i['Grn '],
        cyans: i['Cyn '],
        blues: i['Bl  '],
        magentas: i.Mgnt,
        useTint: !!i.useTint,
        presetKind: i.bwPresetKind,
        presetFileName: i.blackAndWhitePresetFileName,
      }),
        i.tintColor !== void 0 && (n.adjustment.tintColor = (0, S.parseColor)(i.tintColor)),
        (0, v.skipBytes)(e, t()));
    },
    (e, n) => {
      let t = n.adjustment,
        i = {
          'Rd  ': t.reds || 0,
          Yllw: t.yellows || 0,
          'Grn ': t.greens || 0,
          'Cyn ': t.cyans || 0,
          'Bl  ': t.blues || 0,
          Mgnt: t.magentas || 0,
          useTint: !!t.useTint,
          tintColor: (0, S.serializeColor)(t.tintColor),
          bwPresetKind: t.presetKind || 0,
          blackAndWhitePresetFileName: t.presetFileName || '',
        };
      (0, S.writeVersionAndDescriptor)(e, '', 'null', i);
    }
  );
  j(
    'phfl',
    je('photo filter'),
    (e, n, t) => {
      let i = (0, v.readUint16)(e);
      if (i !== 2 && i !== 3) throw new Error('Invalid phfl version');
      let r;
      (i === 2
        ? (r = (0, v.readColor)(e))
        : (r = {
            l: (0, v.readInt32)(e) / 100,
            a: (0, v.readInt32)(e) / 100,
            b: (0, v.readInt32)(e) / 100,
          }),
        (n.adjustment = {
          type: 'photo filter',
          color: r,
          density: (0, v.readUint32)(e) / 100,
          preserveLuminosity: !!(0, v.readUint8)(e),
        }),
        (0, v.skipBytes)(e, t()));
    },
    (e, n) => {
      let t = n.adjustment;
      ((0, x.writeUint16)(e, 2),
        (0, x.writeColor)(e, t.color || { l: 0, a: 0, b: 0 }),
        (0, x.writeUint32)(e, (t.density || 0) * 100),
        (0, x.writeUint8)(e, t.preserveLuminosity ? 1 : 0),
        (0, x.writeZeros)(e, 3));
    }
  );
  function Ao(e) {
    let n = (0, v.readInt16)(e),
      t = (0, v.readInt16)(e),
      i = (0, v.readInt16)(e);
    (0, v.skipBytes)(e, 2);
    let r = (0, v.readInt16)(e);
    return { red: n, green: t, blue: i, constant: r };
  }
  function ir(e, n) {
    let t = n || {};
    ((0, x.writeInt16)(e, t.red),
      (0, x.writeInt16)(e, t.green),
      (0, x.writeInt16)(e, t.blue),
      (0, x.writeZeros)(e, 2),
      (0, x.writeInt16)(e, t.constant));
  }
  j(
    'mixr',
    je('channel mixer'),
    (e, n, t) => {
      if ((0, v.readUint16)(e) !== 1) throw new Error('Invalid mixr version');
      let i = (n.adjustment = Object.assign(Object.assign({}, n.adjustment), {
        type: 'channel mixer',
        monochrome: !!(0, v.readUint16)(e),
      }));
      (i.monochrome || ((i.red = Ao(e)), (i.green = Ao(e)), (i.blue = Ao(e))),
        (i.gray = Ao(e)),
        (0, v.skipBytes)(e, t()));
    },
    (e, n) => {
      let t = n.adjustment;
      ((0, x.writeUint16)(e, 1),
        (0, x.writeUint16)(e, t.monochrome ? 1 : 0),
        t.monochrome
          ? (ir(e, t.gray), (0, x.writeZeros)(e, 30))
          : (ir(e, t.red), ir(e, t.green), ir(e, t.blue), ir(e, t.gray)));
    }
  );
  var Bu = (0, rt.createEnum)('colorLookupType', '3dlut', {
      '3dlut': '3DLUT',
      abstractProfile: 'abstractProfile',
      deviceLinkProfile: 'deviceLinkProfile',
    }),
    zu = (0, rt.createEnum)('LUTFormatType', 'look', {
      look: 'LUTFormatLOOK',
      cube: 'LUTFormatCUBE',
      '3dl': 'LUTFormat3DL',
    }),
    Io = (0, rt.createEnum)('colorLookupOrder', 'rgb', { rgb: 'rgbOrder', bgr: 'bgrOrder' });
  j(
    'clrL',
    je('color lookup'),
    (e, n, t) => {
      if ((0, v.readUint16)(e) !== 1) throw new Error('Invalid clrL version');
      let i = (0, S.readVersionAndDescriptor)(e);
      n.adjustment = { type: 'color lookup' };
      let r = n.adjustment;
      (i.lookupType !== void 0 && (r.lookupType = Bu.decode(i.lookupType)),
        i['Nm  '] !== void 0 && (r.name = i['Nm  ']),
        i.Dthr !== void 0 && (r.dither = i.Dthr),
        i.profile !== void 0 && (r.profile = i.profile),
        i.LUTFormat !== void 0 && (r.lutFormat = zu.decode(i.LUTFormat)),
        i.dataOrder !== void 0 && (r.dataOrder = Io.decode(i.dataOrder)),
        i.tableOrder !== void 0 && (r.tableOrder = Io.decode(i.tableOrder)),
        i.LUT3DFileData !== void 0 && (r.lut3DFileData = i.LUT3DFileData),
        i.LUT3DFileName !== void 0 && (r.lut3DFileName = i.LUT3DFileName),
        (0, v.skipBytes)(e, t()));
    },
    (e, n) => {
      let t = n.adjustment,
        i = {};
      (t.lookupType !== void 0 && (i.lookupType = Bu.encode(t.lookupType)),
        t.name !== void 0 && (i['Nm  '] = t.name),
        t.dither !== void 0 && (i.Dthr = t.dither),
        t.profile !== void 0 && (i.profile = t.profile),
        t.lutFormat !== void 0 && (i.LUTFormat = zu.encode(t.lutFormat)),
        t.dataOrder !== void 0 && (i.dataOrder = Io.encode(t.dataOrder)),
        t.tableOrder !== void 0 && (i.tableOrder = Io.encode(t.tableOrder)),
        t.lut3DFileData !== void 0 && (i.LUT3DFileData = t.lut3DFileData),
        t.lut3DFileName !== void 0 && (i.LUT3DFileName = t.lut3DFileName),
        (0, x.writeUint16)(e, 1),
        (0, S.writeVersionAndDescriptor)(e, '', 'null', i));
    }
  );
  j(
    'nvrt',
    je('invert'),
    (e, n, t) => {
      ((n.adjustment = { type: 'invert' }), (0, v.skipBytes)(e, t()));
    },
    () => {}
  );
  j(
    'post',
    je('posterize'),
    (e, n, t) => {
      ((n.adjustment = { type: 'posterize', levels: (0, v.readUint16)(e) }),
        (0, v.skipBytes)(e, t()));
    },
    (e, n) => {
      var t;
      let i = n.adjustment;
      ((0, x.writeUint16)(e, (t = i.levels) !== null && t !== void 0 ? t : 4),
        (0, x.writeZeros)(e, 2));
    }
  );
  j(
    'thrs',
    je('threshold'),
    (e, n, t) => {
      ((n.adjustment = { type: 'threshold', level: (0, v.readUint16)(e) }),
        (0, v.skipBytes)(e, t()));
    },
    (e, n) => {
      var t;
      let i = n.adjustment;
      ((0, x.writeUint16)(e, (t = i.level) !== null && t !== void 0 ? t : 128),
        (0, x.writeZeros)(e, 2));
    }
  );
  var Nu = ['', '', '', 'rgb', 'hsb', '', 'lab'];
  j(
    'grdm',
    je('gradient map'),
    (e, n, t) => {
      let i = (0, v.readUint16)(e);
      if (i !== 1 && i !== 3) throw new Error('Invalid grdm version');
      let r = { type: 'gradient map', gradientType: 'solid' };
      ((r.reverse = !!(0, v.readUint8)(e)), (r.dither = !!(0, v.readUint8)(e)));
      let o = !!(0, v.readUint8)(e);
      if ((e.offset--, o)) {
        let d = (0, v.readSignature)(e);
        r.method = S.gradientInterpolationMethodType.decode(d);
      }
      ((r.name = (0, v.readUnicodeString)(e)), (r.colorStops = []), (r.opacityStops = []));
      let a = (0, v.readUint16)(e);
      for (let d = 0; d < a; d++)
        (r.colorStops.push({
          location: (0, v.readUint32)(e),
          midpoint: (0, v.readUint32)(e) / 100,
          color: (0, v.readColor)(e),
        }),
          (0, v.skipBytes)(e, 2));
      let s = (0, v.readUint16)(e);
      for (let d = 0; d < s; d++)
        r.opacityStops.push({
          location: (0, v.readUint32)(e),
          midpoint: (0, v.readUint32)(e) / 100,
          opacity: (0, v.readUint16)(e) / 255,
        });
      if ((0, v.readUint16)(e) !== 2) throw new Error('Invalid grdm expansion count');
      let l = (0, v.readUint16)(e);
      if (((r.smoothness = l / 4096), (0, v.readUint16)(e) !== 32))
        throw new Error('Invalid grdm length');
      ((r.gradientType = (0, v.readUint16)(e) ? 'noise' : 'solid'),
        (r.randomSeed = (0, v.readUint32)(e)),
        (r.addTransparency = !!(0, v.readUint16)(e)),
        (r.restrictColors = !!(0, v.readUint16)(e)),
        (r.roughness = (0, v.readUint32)(e) / 4096),
        (r.colorModel = Nu[(0, v.readUint16)(e)] || 'rgb'),
        (r.min = [
          (0, v.readUint16)(e) / 32768,
          (0, v.readUint16)(e) / 32768,
          (0, v.readUint16)(e) / 32768,
          (0, v.readUint16)(e) / 32768,
        ]),
        (r.max = [
          (0, v.readUint16)(e) / 32768,
          (0, v.readUint16)(e) / 32768,
          (0, v.readUint16)(e) / 32768,
          (0, v.readUint16)(e) / 32768,
        ]),
        (0, v.skipBytes)(e, t()));
      for (let d of r.colorStops) d.location /= l;
      for (let d of r.opacityStops) d.location /= l;
      n.adjustment = r;
    },
    (e, n) => {
      var t, i, r;
      let o = n.adjustment;
      ((0, x.writeUint16)(e, o.method !== void 0 ? 3 : 1),
        (0, x.writeUint8)(e, o.reverse ? 1 : 0),
        (0, x.writeUint8)(e, o.dither ? 1 : 0),
        o.method !== void 0 &&
          (0, x.writeSignature)(e, S.gradientInterpolationMethodType.encode(o.method)),
        (0, x.writeUnicodeStringWithPadding)(e, o.name || ''),
        (0, x.writeUint16)(e, (o.colorStops && o.colorStops.length) || 0));
      let a = Math.round(((t = o.smoothness) !== null && t !== void 0 ? t : 1) * 4096);
      for (let c of o.colorStops || [])
        ((0, x.writeUint32)(e, Math.round(c.location * a)),
          (0, x.writeUint32)(e, Math.round(c.midpoint * 100)),
          (0, x.writeColor)(e, c.color),
          (0, x.writeZeros)(e, 2));
      (0, x.writeUint16)(e, (o.opacityStops && o.opacityStops.length) || 0);
      for (let c of o.opacityStops || [])
        ((0, x.writeUint32)(e, Math.round(c.location * a)),
          (0, x.writeUint32)(e, Math.round(c.midpoint * 100)),
          (0, x.writeUint16)(e, Math.round(c.opacity * 255)));
      ((0, x.writeUint16)(e, 2),
        (0, x.writeUint16)(e, a),
        (0, x.writeUint16)(e, 32),
        (0, x.writeUint16)(e, o.gradientType === 'noise' ? 1 : 0),
        (0, x.writeUint32)(e, o.randomSeed || 0),
        (0, x.writeUint16)(e, o.addTransparency ? 1 : 0),
        (0, x.writeUint16)(e, o.restrictColors ? 1 : 0),
        (0, x.writeUint32)(
          e,
          Math.round(((i = o.roughness) !== null && i !== void 0 ? i : 1) * 4096)
        ));
      let s = Nu.indexOf((r = o.colorModel) !== null && r !== void 0 ? r : 'rgb');
      (0, x.writeUint16)(e, s === -1 ? 3 : s);
      for (let c = 0; c < 4; c++)
        (0, x.writeUint16)(e, Math.round(((o.min && o.min[c]) || 0) * 32768));
      for (let c = 0; c < 4; c++)
        (0, x.writeUint16)(e, Math.round(((o.max && o.max[c]) || 0) * 32768));
      (0, x.writeZeros)(e, 4);
    }
  );
  function Yt(e) {
    return {
      c: (0, v.readInt16)(e),
      m: (0, v.readInt16)(e),
      y: (0, v.readInt16)(e),
      k: (0, v.readInt16)(e),
    };
  }
  function qt(e, n) {
    let t = n || {};
    ((0, x.writeInt16)(e, t.c),
      (0, x.writeInt16)(e, t.m),
      (0, x.writeInt16)(e, t.y),
      (0, x.writeInt16)(e, t.k));
  }
  j(
    'selc',
    je('selective color'),
    (e, n) => {
      if ((0, v.readUint16)(e) !== 1) throw new Error('Invalid selc version');
      let t = (0, v.readUint16)(e) ? 'absolute' : 'relative';
      ((0, v.skipBytes)(e, 8),
        (n.adjustment = {
          type: 'selective color',
          mode: t,
          reds: Yt(e),
          yellows: Yt(e),
          greens: Yt(e),
          cyans: Yt(e),
          blues: Yt(e),
          magentas: Yt(e),
          whites: Yt(e),
          neutrals: Yt(e),
          blacks: Yt(e),
        }));
    },
    (e, n) => {
      let t = n.adjustment;
      ((0, x.writeUint16)(e, 1),
        (0, x.writeUint16)(e, t.mode === 'absolute' ? 1 : 0),
        (0, x.writeZeros)(e, 8),
        qt(e, t.reds),
        qt(e, t.yellows),
        qt(e, t.greens),
        qt(e, t.cyans),
        qt(e, t.blues),
        qt(e, t.magentas),
        qt(e, t.whites),
        qt(e, t.neutrals),
        qt(e, t.blacks));
    }
  );
  j(
    'CgEd',
    e => {
      let n = e.adjustment;
      return n
        ? (n.type === 'brightness/contrast' && !n.useLegacy) ||
            ((n.type === 'levels' ||
              n.type === 'curves' ||
              n.type === 'exposure' ||
              n.type === 'channel mixer' ||
              n.type === 'hue/saturation') &&
              n.presetFileName !== void 0)
        : !1;
    },
    (e, n, t) => {
      let i = (0, S.readVersionAndDescriptor)(e);
      if (i.Vrsn !== 1) throw new Error('Invalid CgEd version');
      ('presetFileName' in i
        ? (n.adjustment = Object.assign(Object.assign({}, n.adjustment), {
            presetKind: i.presetKind,
            presetFileName: i.presetFileName,
          }))
        : 'curvesPresetFileName' in i
          ? (n.adjustment = Object.assign(Object.assign({}, n.adjustment), {
              presetKind: i.curvesPresetKind,
              presetFileName: i.curvesPresetFileName,
            }))
          : 'mixerPresetFileName' in i
            ? (n.adjustment = Object.assign(Object.assign({}, n.adjustment), {
                presetKind: i.mixerPresetKind,
                presetFileName: i.mixerPresetFileName,
              }))
            : (n.adjustment = {
                type: 'brightness/contrast',
                brightness: i.Brgh,
                contrast: i.Cntr,
                meanValue: i.means,
                useLegacy: !!i.useLegacy,
                labColorOnly: !!i['Lab '],
                auto: !!i.Auto,
              }),
        (0, v.skipBytes)(e, t()));
    },
    (e, n) => {
      var t, i, r, o;
      let a = n.adjustment;
      if (a.type === 'levels' || a.type === 'exposure' || a.type === 'hue/saturation') {
        let s = {
          Vrsn: 1,
          presetKind: (t = a.presetKind) !== null && t !== void 0 ? t : 1,
          presetFileName: a.presetFileName || '',
        };
        (0, S.writeVersionAndDescriptor)(e, '', 'null', s);
      } else if (a.type === 'curves') {
        let s = {
          Vrsn: 1,
          curvesPresetKind: (i = a.presetKind) !== null && i !== void 0 ? i : 1,
          curvesPresetFileName: a.presetFileName || '',
        };
        (0, S.writeVersionAndDescriptor)(e, '', 'null', s);
      } else if (a.type === 'channel mixer') {
        let s = {
          Vrsn: 1,
          mixerPresetKind: (r = a.presetKind) !== null && r !== void 0 ? r : 1,
          mixerPresetFileName: a.presetFileName || '',
        };
        (0, S.writeVersionAndDescriptor)(e, '', 'null', s);
      } else if (a.type === 'brightness/contrast') {
        let s = {
          Vrsn: 1,
          Brgh: a.brightness || 0,
          Cntr: a.contrast || 0,
          means: (o = a.meanValue) !== null && o !== void 0 ? o : 127,
          'Lab ': !!a.labColorOnly,
          useLegacy: !!a.useLegacy,
          Auto: !!a.auto,
        };
        (0, S.writeVersionAndDescriptor)(e, '', 'null', s);
      } else throw new Error('Unhandled CgEd case');
    }
  );
  function $1(e) {
    let n = [];
    function t(i) {
      var r;
      if (i.children)
        for (let o of i.children)
          (((r = o.text) === null || r === void 0 ? void 0 : r.index) !== void 0 &&
            (n[o.text.index] = o),
            t(o));
    }
    return (t(e), n);
  }
  j(
    'Txt2',
    be('engineData'),
    (e, n, t, i) => {
      let r = (0, v.readBytes)(e, t());
      n.engineData = (0, Ou.fromByteArray)(r);
      let o = $1(i),
        a = (0, ws.parseEngineData)(r),
        c = (0, R1.decodeEngineData2)(a).ResourceDict.TextFrameSet;
      if (c)
        for (let l = 0; l < c.length; l++) {
          let f = o[l];
          c[l].path && f?.text && (f.text.textPath = c[l].path);
        }
    },
    (e, n) => {
      let t = (0, Ou.toByteArray)(n.engineData);
      (0, x.writeBytes)(e, t);
    }
  );
  j(
    'FEid',
    be('filterEffectsMasks'),
    (e, n, t) => {
      let i = (0, v.readInt32)(e);
      if (i < 1 || i > 3) throw new Error(`Invalid filterEffects version ${i}`);
      for (n.filterEffectsMasks = []; t() > 8;) {
        if ((0, v.readUint32)(e)) throw new Error('filterEffects: 64 bit length is not supported');
        let r = (0, v.readUint32)(e),
          o = e.offset + r,
          a = (0, v.readPascalString)(e, 1),
          s = (0, v.readInt32)(e);
        if (s !== 1) throw new Error(`Invalid filterEffect version ${s}`);
        if ((0, v.readUint32)(e)) throw new Error('filterEffect: 64 bit length is not supported');
        (0, v.readUint32)(e);
        let c = (0, v.readInt32)(e),
          l = (0, v.readInt32)(e),
          f = (0, v.readInt32)(e),
          d = (0, v.readInt32)(e),
          u = (0, v.readInt32)(e),
          h = (0, v.readInt32)(e),
          p = [];
        for (let b = 0; b < h + 2; b++)
          if ((0, v.readInt32)(e)) {
            if ((0, v.readUint32)(e))
              throw new Error('filterEffect: 64 bit length is not supported');
            let y = (0, v.readUint32)(e);
            if (!y) throw new Error('filterEffect: Empty channel');
            let w = (0, v.readUint16)(e),
              m = (0, v.readBytes)(e, y - 2);
            p.push({ compressionMode: w, data: m });
          } else p.push(void 0);
        if (
          (n.filterEffectsMasks.push({
            id: a,
            top: c,
            left: l,
            bottom: f,
            right: d,
            depth: u,
            channels: p,
          }),
          e.offset < o && (0, v.readUint8)(e))
        ) {
          let b = (0, v.readInt32)(e),
            g = (0, v.readInt32)(e),
            y = (0, v.readInt32)(e),
            w = (0, v.readInt32)(e);
          if ((0, v.readUint32)(e)) throw new Error('filterEffect: 64 bit length is not supported');
          let m = (0, v.readUint32)(e),
            A = (0, v.readUint16)(e),
            M = (0, v.readBytes)(e, m - 2);
          n.filterEffectsMasks[n.filterEffectsMasks.length - 1].extra = {
            top: b,
            left: g,
            bottom: y,
            right: w,
            compressionMode: A,
            data: M,
          };
        }
        e.offset = o;
        let _ = r;
        for (; _ % 4;) (e.offset++, _++);
      }
    },
    (e, n) => {
      var t;
      (0, x.writeInt32)(e, 3);
      for (let i of n.filterEffectsMasks) {
        ((0, x.writeUint32)(e, 0), (0, x.writeUint32)(e, 0));
        let r = e.offset;
        ((0, x.writePascalString)(e, i.id, 1),
          (0, x.writeInt32)(e, 1),
          (0, x.writeUint32)(e, 0),
          (0, x.writeUint32)(e, 0));
        let o = e.offset;
        ((0, x.writeInt32)(e, i.top),
          (0, x.writeInt32)(e, i.left),
          (0, x.writeInt32)(e, i.bottom),
          (0, x.writeInt32)(e, i.right),
          (0, x.writeInt32)(e, i.depth));
        let a = Math.max(0, i.channels.length - 2);
        (0, x.writeInt32)(e, a);
        for (let l = 0; l < a + 2; l++) {
          let f = i.channels[l];
          ((0, x.writeInt32)(e, f ? 1 : 0),
            f &&
              ((0, x.writeUint32)(e, 0),
              (0, x.writeUint32)(e, f.data.length + 2),
              (0, x.writeUint16)(e, f.compressionMode),
              (0, x.writeBytes)(e, f.data)));
        }
        e.view.setUint32(o - 4, e.offset - o, !1);
        let s =
          (t = n.filterEffectsMasks[n.filterEffectsMasks.length - 1]) === null || t === void 0
            ? void 0
            : t.extra;
        s &&
          ((0, x.writeUint8)(e, 1),
          (0, x.writeInt32)(e, s.top),
          (0, x.writeInt32)(e, s.left),
          (0, x.writeInt32)(e, s.bottom),
          (0, x.writeInt32)(e, s.right),
          (0, x.writeUint32)(e, 0),
          (0, x.writeUint32)(e, s.data.byteLength + 2),
          (0, x.writeUint16)(e, s.compressionMode),
          (0, x.writeBytes)(e, s.data));
        let c = e.offset - r;
        for (e.view.setUint32(r - 4, c, !1); c % 4;) ((0, x.writeZeros)(e, 1), c++);
      }
    }
  );
  mn('FXid', 'FEid');
  j(
    'FMsk',
    be('filterMask'),
    (e, n) => {
      n.filterMask = { colorSpace: (0, v.readColor)(e), opacity: (0, v.readUint16)(e) / 255 };
    },
    (e, n) => {
      var t;
      ((0, x.writeColor)(e, n.filterMask.colorSpace),
        (0, x.writeUint16)(
          e,
          (0, rt.clamp)((t = n.filterMask.opacity) !== null && t !== void 0 ? t : 1, 0, 1) * 255
        ));
    }
  );
  j(
    'artd',
    e => e.artboards !== void 0,
    (e, n, t) => {
      let i = (0, S.readVersionAndDescriptor)(e);
      ((n.artboards = {
        count: i['Cnt '],
        autoExpandOffset: {
          horizontal: i.autoExpandOffset.Hrzn,
          vertical: i.autoExpandOffset.Vrtc,
        },
        origin: { horizontal: i.origin.Hrzn, vertical: i.origin.Vrtc },
        autoExpandEnabled: i.autoExpandEnabled,
        autoNestEnabled: i.autoNestEnabled,
        autoPositionEnabled: i.autoPositionEnabled,
        shrinkwrapOnSaveEnabled: !!i.shrinkwrapOnSaveEnabled,
        docDefaultNewArtboardBackgroundColor: (0, S.parseColor)(
          i.docDefaultNewArtboardBackgroundColor
        ),
        docDefaultNewArtboardBackgroundType: i.docDefaultNewArtboardBackgroundType,
      }),
        (0, v.skipBytes)(e, t()));
    },
    (e, n) => {
      var t, i, r, o, a;
      let s = n.artboards,
        c = {
          'Cnt ': s.count,
          autoExpandOffset: s.autoExpandOffset
            ? { Hrzn: s.autoExpandOffset.horizontal, Vrtc: s.autoExpandOffset.vertical }
            : { Hrzn: 0, Vrtc: 0 },
          origin: s.origin
            ? { Hrzn: s.origin.horizontal, Vrtc: s.origin.vertical }
            : { Hrzn: 0, Vrtc: 0 },
          autoExpandEnabled: (t = s.autoExpandEnabled) !== null && t !== void 0 ? t : !0,
          autoNestEnabled: (i = s.autoNestEnabled) !== null && i !== void 0 ? i : !0,
          autoPositionEnabled: (r = s.autoPositionEnabled) !== null && r !== void 0 ? r : !0,
          shrinkwrapOnSaveEnabled:
            (o = s.shrinkwrapOnSaveEnabled) !== null && o !== void 0 ? o : !0,
          docDefaultNewArtboardBackgroundColor: (0, S.serializeColor)(
            s.docDefaultNewArtboardBackgroundColor
          ),
          docDefaultNewArtboardBackgroundType:
            (a = s.docDefaultNewArtboardBackgroundType) !== null && a !== void 0 ? a : 1,
        };
      (0, S.writeVersionAndDescriptor)(e, '', 'null', c, 'artd');
    }
  );
  function vs(e) {
    return Object.keys(e)
      .map(n => e[n])
      .some(n => Array.isArray(n) && n.length > 1);
  }
  j(
    'lfx2',
    e => e.effects !== void 0 && !vs(e.effects),
    (e, n, t) => {
      if ((0, v.readUint32)(e) !== 0) throw new Error('Invalid lfx2 version');
      let r = (0, S.readVersionAndDescriptor)(e);
      ((n.effects = (0, S.parseEffects)(r, !!e.logMissingFeatures)), (0, v.skipBytes)(e, t()));
    },
    (e, n, t, i) => {
      let r = (0, S.serializeEffects)(n.effects, !!i.logMissingFeatures, !0);
      ((0, x.writeUint32)(e, 0), (0, S.writeVersionAndDescriptor)(e, '', 'null', r));
    }
  );
  j(
    'cinf',
    be('compositorUsed'),
    (e, n, t) => {
      let i = (0, S.readVersionAndDescriptor)(e);
      function r(o) {
        return o.split('.')[1];
      }
      ((n.compositorUsed = { description: i.description, reason: i.reason, engine: r(i.Engn) }),
        i.Vrsn && (n.compositorUsed.version = i.Vrsn),
        i.psVersion && (n.compositorUsed.photoshopVersion = i.psVersion),
        i.enableCompCore && (n.compositorUsed.enableCompCore = r(i.enableCompCore)),
        i.enableCompCoreGPU && (n.compositorUsed.enableCompCoreGPU = r(i.enableCompCoreGPU)),
        i.enableCompCoreThreads &&
          (n.compositorUsed.enableCompCoreThreads = r(i.enableCompCoreThreads)),
        i.compCoreSupport && (n.compositorUsed.compCoreSupport = r(i.compCoreSupport)),
        i.compCoreGPUSupport && (n.compositorUsed.compCoreGPUSupport = r(i.compCoreGPUSupport)),
        (0, v.skipBytes)(e, t()));
    },
    (e, n) => {
      let t = n.compositorUsed,
        i = { Vrsn: t.version || { major: 1, minor: 0, fix: 0 } };
      (t.photoshopVersion && (i.psVersion = t.photoshopVersion),
        (i.description = t.description),
        (i.reason = t.reason),
        (i.Engn = `Engn.${t.engine}`),
        t.enableCompCore && (i.enableCompCore = `enable.${t.enableCompCore}`),
        t.enableCompCoreGPU && (i.enableCompCoreGPU = `enable.${t.enableCompCoreGPU}`),
        t.enableCompCoreThreads && (i.enableCompCoreThreads = `enable.${t.enableCompCoreThreads}`),
        t.compCoreSupport && (i.compCoreSupport = `reason.${t.compCoreSupport}`),
        t.compCoreGPUSupport && (i.compCoreGPUSupport = `reason.${t.compCoreGPUSupport}`),
        (0, S.writeVersionAndDescriptor)(e, '', 'null', i));
    }
  );
  j(
    'extn',
    e => e._extn !== void 0,
    (e, n) => {
      let t = (0, S.readVersionAndDescriptor)(e);
      rt.MOCK_HANDLERS && (n._extn = t);
    },
    (e, n) => {
      rt.MOCK_HANDLERS && (0, S.writeVersionAndDescriptor)(e, '', 'null', n._extn);
    }
  );
  j(
    'iOpa',
    be('fillOpacity'),
    (e, n) => {
      ((n.fillOpacity = (0, v.readUint8)(e) / 255), (0, v.skipBytes)(e, 3));
    },
    (e, n) => {
      ((0, x.writeUint8)(e, n.fillOpacity * 255), (0, x.writeZeros)(e, 3));
    }
  );
  j(
    'brst',
    be('channelBlendingRestrictions'),
    (e, n, t) => {
      for (n.channelBlendingRestrictions = []; t() > 4;)
        n.channelBlendingRestrictions.push((0, v.readInt32)(e));
    },
    (e, n) => {
      for (let t of n.channelBlendingRestrictions) (0, x.writeInt32)(e, t);
    }
  );
  j(
    'tsly',
    be('transparencyShapesLayer'),
    (e, n) => {
      ((n.transparencyShapesLayer = !!(0, v.readUint8)(e)), (0, v.skipBytes)(e, 3));
    },
    (e, n) => {
      ((0, x.writeUint8)(e, n.transparencyShapesLayer ? 1 : 0), (0, x.writeZeros)(e, 3));
    }
  );
});
var li = he(_e => {
  'use strict';
  Object.defineProperty(_e, '__esModule', { value: !0 });
  _e.createWriter = X1;
  _e.getWriterBuffer = K1;
  _e.getWriterBufferNoCopy = W1;
  _e.writeUint8 = ve;
  _e.writeInt16 = bn;
  _e.writeUint16 = re;
  _e.writeUint16LE = Wu;
  _e.writeInt32 = Ze;
  _e.writeInt32LE = Y1;
  _e.writeUint32 = xe;
  _e.writeFloat32 = q1;
  _e.writeFloat64 = Ss;
  _e.writeFixedPoint32 = J1;
  _e.writeFixedPointPath32 = Q1;
  _e.writeBytes = or;
  _e.writeZeros = Tn;
  _e.writeSignature = Rn;
  _e.writeAsciiString = eb;
  _e.writePascalString = Mo;
  _e.writeUnicodeStringWithoutLength = Yu;
  _e.writeUnicodeStringWithoutLengthLE = tb;
  _e.writeUnicodeString = qu;
  _e.writeUnicodeStringWithPadding = nb;
  _e.writeSection = St;
  _e.writePsd = ib;
  _e.writeColor = pb;
  _e.writePattern = gb;
  var Me = fn(),
    Z1 = bo(),
    H1 = Ya();
  function X1(e = 4096) {
    let n = new ArrayBuffer(e),
      t = new DataView(n);
    return { buffer: n, view: t, offset: 0, tempBuffer: void 0 };
  }
  function K1(e) {
    return e.buffer.slice(0, e.offset);
  }
  function W1(e) {
    return new Uint8Array(e.buffer, 0, e.offset);
  }
  function ve(e, n) {
    let t = Jt(e, 1);
    e.view.setUint8(t, n);
  }
  function bn(e, n) {
    let t = Jt(e, 2);
    e.view.setInt16(t, n, !1);
  }
  function re(e, n) {
    let t = Jt(e, 2);
    e.view.setUint16(t, n, !1);
  }
  function Wu(e, n) {
    let t = Jt(e, 2);
    e.view.setUint16(t, n, !0);
  }
  function Ze(e, n) {
    let t = Jt(e, 4);
    e.view.setInt32(t, n, !1);
  }
  function Y1(e, n) {
    let t = Jt(e, 4);
    e.view.setInt32(t, n, !0);
  }
  function xe(e, n) {
    let t = Jt(e, 4);
    e.view.setUint32(t, n, !1);
  }
  function q1(e, n) {
    let t = Jt(e, 4);
    e.view.setFloat32(t, n, !1);
  }
  function Ss(e, n) {
    let t = Jt(e, 8);
    e.view.setFloat64(t, n, !1);
  }
  function J1(e, n) {
    Ze(e, n * 65536);
  }
  function Q1(e, n) {
    Ze(e, n * (1 << 24));
  }
  function or(e, n) {
    n &&
      (nd(e, e.offset + n.length),
      new Uint8Array(e.buffer).set(n, e.offset),
      (e.offset += n.length));
  }
  function Tn(e, n) {
    for (let t = 0; t < n; t++) ve(e, 0);
  }
  function Rn(e, n) {
    if (n.length !== 4) throw new Error(`Invalid signature: '${n}'`);
    for (let t = 0; t < 4; t++) ve(e, n.charCodeAt(t));
  }
  function eb(e, n) {
    for (let t = 0; t < n.length; t++) ve(e, n.charCodeAt(t));
  }
  function Mo(e, n, t) {
    let i = n.length;
    if (i > 255) throw new Error('String too long');
    ve(e, i);
    for (let r = 0; r < i; r++) {
      let o = n.charCodeAt(r);
      ve(e, o < 128 ? o : 63);
    }
    for (; ++i % t;) ve(e, 0);
  }
  function Yu(e, n) {
    for (let t = 0; t < n.length; t++) re(e, n.charCodeAt(t));
  }
  function tb(e, n) {
    for (let t = 0; t < n.length; t++) Wu(e, n.charCodeAt(t));
  }
  function qu(e, n) {
    (xe(e, n.length), Yu(e, n));
  }
  function nb(e, n) {
    xe(e, n.length + 1);
    for (let t = 0; t < n.length; t++) re(e, n.charCodeAt(t));
    re(e, 0);
  }
  function Ju(e = []) {
    let n = 0;
    for (let t of e) {
      let { width: i, height: r } = rr(t);
      if (((n = Math.max(n, 2 * r + 2 * i * r)), t.mask)) {
        let { width: o, height: a } = rr(t.mask);
        n = Math.max(n, 2 * a + 2 * o * a);
      }
      if (t.realMask) {
        let { width: o, height: a } = rr(t.realMask);
        n = Math.max(n, 2 * a + 2 * o * a);
      }
      t.children && (n = Math.max(n, Ju(t.children)));
    }
    return n;
  }
  function St(e, n, t, i = !1, r = !1) {
    r && xe(e, 0);
    let o = e.offset;
    (xe(e, 0), t());
    let a = e.offset - o - 4,
      s = a;
    for (; s % n;) (ve(e, 0), s++);
    (i && (a = s), e.view.setUint32(o, a, !1));
  }
  function Qu(e) {
    var n;
    (n = e.children) === null || n === void 0 || n.forEach(Qu);
    let t = e.imageData;
    if (t && (t.data instanceof Uint32Array || t.data instanceof Uint16Array))
      throw new Error('imageData has incorrect bitDepth');
    if ('mask' in e && e.mask) {
      let i = e.mask.imageData;
      if (i && (i.data instanceof Uint32Array || i.data instanceof Uint16Array))
        throw new Error('mask imageData has incorrect bitDepth');
    }
  }
  function ib(e, n, t = {}) {
    var i;
    if (!(+n.width > 0 && +n.height > 0)) throw new Error('Invalid document size');
    if ((n.width > 3e4 || n.height > 3e4) && !t.psb)
      throw new Error('Document size is too large (max is 30000x30000, use PSB format instead)');
    let r = (i = n.bitsPerChannel) !== null && i !== void 0 ? i : 8;
    if (r !== 8) throw new Error('bitsPerChannel other than 8 are not supported for writing');
    Qu(n);
    let o = Object.assign({}, n.imageResources),
      a = Object.assign(Object.assign({}, t), { layerIds: new Set(), layerToId: new Map() });
    a.generateThumbnail && (o.thumbnail = cb(n));
    let s = n.imageData;
    if (
      (!s &&
        n.canvas &&
        (s = n.canvas.getContext('2d').getImageData(0, 0, n.canvas.width, n.canvas.height)),
      s && (n.width !== s.width || n.height !== s.height))
    )
      throw new Error('Document canvas must have the same size as document');
    let c = !!s && (0, Me.hasAlpha)(s),
      l = Math.max(Ju(n.children), 8 * n.width * n.height + 2 * n.height);
    ((e.tempBuffer = new Uint8Array(l)),
      Rn(e, '8BPS'),
      re(e, t.psb ? 2 : 1),
      Tn(e, 6),
      re(e, c ? 4 : 3),
      xe(e, n.height),
      xe(e, n.width),
      re(e, r),
      re(e, 3),
      St(e, 1, () => {
        var _, b, g;
        if (n.palette) {
          for (let y = 0; y < 256; y++)
            ve(e, ((_ = n.palette[y]) === null || _ === void 0 ? void 0 : _.r) || 0);
          for (let y = 0; y < 256; y++)
            ve(e, ((b = n.palette[y]) === null || b === void 0 ? void 0 : b.g) || 0);
          for (let y = 0; y < 256; y++)
            ve(e, ((g = n.palette[y]) === null || g === void 0 ? void 0 : g.b) || 0);
        }
      }));
    let f = [];
    (td(f, n.children),
      f.length || f.push({}),
      (o.layersGroup = f.map(_ => _.linkGroup || 0)),
      (o.layerGroupsEnabledId = f.map(_ => (_.linkGroupEnabled == !1 ? 0 : 1))),
      St(e, 1, () => {
        for (let _ of H1.resourceHandlers) {
          let b = _.has(o),
            g = b === !1 ? 0 : b === !0 ? 1 : b;
          for (let y = 0; y < g; y++)
            (Rn(e, '8BIM'), re(e, _.key), Mo(e, '', 2), St(e, 2, () => _.write(e, o, y)));
        }
      }),
      St(
        e,
        2,
        () => {
          (rb(e, f, n, c, a), sb(e, n.globalLayerMaskInfo), ed(e, n, n, a));
        },
        void 0,
        !!a.psb
      ));
    let d = c ? [0, 1, 2, 3] : [0, 1, 2],
      u = s ? s.width : n.width,
      h = s ? s.height : n.height,
      p = { data: new Uint8Array(u * h * 4), width: u, height: h };
    if ((re(e, 1), Me.RAW_IMAGE_DATA && n.imageDataRaw))
      (console.log('writing raw image data'), or(e, n.imageDataRaw));
    else {
      if (
        (s && p.data.set(new Uint8Array(s.data.buffer, s.data.byteOffset, s.data.byteLength)), c)
      ) {
        let _ = p.width * p.height * 4,
          b = p.data;
        for (let g = 0; g < _; g += 4) {
          let y = b[g + 3];
          if (y != 0 && y != 255) {
            let w = y / 255,
              m = 255 * (1 - w);
            ((b[g + 0] = b[g + 0] * w + m),
              (b[g + 1] = b[g + 1] * w + m),
              (b[g + 2] = b[g + 2] * w + m));
          }
        }
      }
      or(e, (0, Me.writeDataRLE)(e.tempBuffer, p, d, !!t.psb));
    }
  }
  function rb(e, n, t, i, r) {
    St(
      e,
      4,
      () => {
        var o;
        bn(e, i ? -n.length : n.length);
        let a = n.map((s, c) => fb(e.tempBuffer, s, c === 0, r));
        for (let s of a) {
          let { layer: c, top: l, left: f, bottom: d, right: u, channels: h } = s;
          (Ze(e, l), Ze(e, f), Ze(e, d), Ze(e, u), re(e, h.length));
          for (let _ of h) (bn(e, _.id), r.psb && xe(e, 0), xe(e, _.length));
          (Rn(e, '8BIM'),
            Rn(e, Me.fromBlendMode[c.blendMode] || 'norm'),
            ve(
              e,
              Math.round(
                (0, Me.clamp)((o = c.opacity) !== null && o !== void 0 ? o : 1, 0, 1) * 255
              )
            ),
            ve(e, c.clipping ? 1 : 0));
          let p = 8;
          (c.transparencyProtected && (p |= 1),
            c.hidden && (p |= 2),
            (c.vectorMask || (c.sectionDivider && c.sectionDivider.type !== 0) || c.adjustment) &&
              (p |= 16),
            c.effectsOpen && (p |= 32),
            ve(e, p),
            ve(e, 0),
            St(e, 1, () => {
              (ob(e, c, s), ab(e, c), Mo(e, (c.name || '').substring(0, 255), 4), ed(e, c, t, r));
            }));
        }
        for (let s of a) for (let c of s.channels) (re(e, c.compression), c.data && or(e, c.data));
      },
      !0,
      r.psb
    );
  }
  function ob(e, { mask: n, realMask: t }, i) {
    St(e, 1, () => {
      if (!n && !t) return;
      let r = 0,
        o = 0,
        a = 0;
      n &&
        (n.userMaskDensity !== void 0 && (r |= 1),
        n.userMaskFeather !== void 0 && (r |= 2),
        n.vectorMaskDensity !== void 0 && (r |= 4),
        n.vectorMaskFeather !== void 0 && (r |= 8),
        n.disabled && (o |= 2),
        n.positionRelativeToLayer && (o |= 1),
        n.fromVectorData && (o |= 8),
        r && (o |= 16));
      let s = i.mask || {};
      if (
        (Ze(e, s.top || 0),
        Ze(e, s.left || 0),
        Ze(e, s.bottom || 0),
        Ze(e, s.right || 0),
        ve(e, (n && n.defaultColor) || 0),
        ve(e, o),
        t)
      ) {
        (t.disabled && (a |= 2),
          t.positionRelativeToLayer && (a |= 1),
          t.fromVectorData && (a |= 8));
        let c = i.realMask || {};
        (ve(e, a),
          ve(e, t.defaultColor || 0),
          Ze(e, c.top || 0),
          Ze(e, c.left || 0),
          Ze(e, c.bottom || 0),
          Ze(e, c.right || 0));
      }
      (r &&
        n &&
        (ve(e, r),
        n.userMaskDensity !== void 0 && ve(e, Math.round(n.userMaskDensity * 255)),
        n.userMaskFeather !== void 0 && Ss(e, n.userMaskFeather),
        n.vectorMaskDensity !== void 0 && ve(e, Math.round(n.vectorMaskDensity * 255)),
        n.vectorMaskFeather !== void 0 && Ss(e, n.vectorMaskFeather)),
        Tn(e, 2));
    });
  }
  function Do(e, n) {
    (ve(e, n[0]), ve(e, n[1]), ve(e, n[2]), ve(e, n[3]));
  }
  function ab(e, n) {
    St(e, 1, () => {
      let t = n.blendingRanges;
      if (t) {
        (Do(e, t.compositeGrayBlendSource), Do(e, t.compositeGraphBlendDestinationRange));
        for (let i of t.ranges) (Do(e, i.sourceRange), Do(e, i.destRange));
      }
    });
  }
  function sb(e, n) {
    St(e, 1, () => {
      n &&
        (re(e, n.overlayColorSpace),
        re(e, n.colorSpace1),
        re(e, n.colorSpace2),
        re(e, n.colorSpace3),
        re(e, n.colorSpace4),
        re(e, Math.round(n.opacity * 255)),
        ve(e, n.kind),
        Tn(e, 3));
    });
  }
  function ed(e, n, t, i) {
    for (let r of Z1.infoHandlers) {
      let o = r.key;
      if (
        !(o === 'Txt2' && i.invalidateTextLayers) &&
        (o === 'vmsk' && i.psb && (o = 'vsms'), r.has(n))
      ) {
        let a = i.psb && Me.largeAdditionalInfoKeys.indexOf(o) !== -1,
          s = o !== 'Txt2' && o !== 'cinf' && o !== 'extn' && o !== 'CAI ' && o !== 'OCIO',
          c =
            o === 'Txt2' ||
            o === 'luni' ||
            o === 'vmsk' ||
            o === 'artb' ||
            o === 'artd' ||
            o === 'vogk' ||
            o === 'SoLd' ||
            o === 'lnk2' ||
            o === 'vscg' ||
            o === 'vsms' ||
            o === 'GdFl' ||
            o === 'lmfx' ||
            o === 'lrFX' ||
            o === 'cinf' ||
            o === 'PlLd' ||
            o === 'Anno' ||
            o === 'CAI ' ||
            o === 'OCIO' ||
            o === 'GenI' ||
            o === 'FEid' ||
            o === 'curv' ||
            o === 'CgEd' ||
            o === 'vibA' ||
            o === 'blwh' ||
            o === 'grdm';
        (Rn(e, a ? '8B64' : '8BIM'),
          Rn(e, o),
          St(
            e,
            c ? 4 : 2,
            () => {
              r.write(e, n, t, i);
            },
            s,
            a
          ));
      }
    }
  }
  function td(e, n) {
    if (n)
      for (let t of n) {
        if (t.children && t.canvas)
          throw new Error("Invalid layer, cannot have both 'canvas' and 'children' properties");
        if (t.children && t.imageData)
          throw new Error("Invalid layer, cannot have both 'imageData' and 'children' properties");
        t.children
          ? (e.push({ name: '</Layer group>', sectionDivider: { type: 3 } }),
            td(e, t.children),
            e.push(
              Object.assign(Object.assign({}, t), {
                blendMode: t.blendMode === 'pass through' ? 'normal' : t.blendMode,
                sectionDivider: {
                  type: t.opened === !1 ? 2 : 1,
                  key: Me.fromBlendMode[t.blendMode] || 'pass',
                  subType: 0,
                },
              })
            ))
          : e.push(Object.assign({}, t));
      }
  }
  function lb(e, n) {
    let t = e.buffer.byteLength;
    do t *= 2;
    while (n > t);
    let i = new ArrayBuffer(t),
      r = new Uint8Array(i),
      o = new Uint8Array(e.buffer);
    (r.set(o), (e.buffer = i), (e.view = new DataView(e.buffer)));
  }
  function nd(e, n) {
    n > e.buffer.byteLength && lb(e, n);
  }
  function Jt(e, n) {
    let t = e.offset;
    return (nd(e, (e.offset += n)), t);
  }
  function cb(e) {
    let n = (0, Me.createCanvas)(10, 10),
      t = 1;
    e.width > e.height
      ? ((n.width = 160),
        (n.height = Math.floor(e.height * (n.width / e.width))),
        (t = n.width / e.width))
      : ((n.height = 160),
        (n.width = Math.floor(e.width * (n.height / e.height))),
        (t = n.height / e.height));
    let i = n.getContext('2d');
    return (
      i.scale(t, t),
      e.imageData
        ? i.drawImage((0, Me.imageDataToCanvas)(e.imageData), 0, 0)
        : e.canvas && i.drawImage(e.canvas, 0, 0),
      n
    );
  }
  function Hu(e, n, t, i, r, o) {
    let a = i.top | 0,
      s = i.left | 0,
      c = i.right | 0,
      l = i.bottom | 0,
      { width: f, height: d } = rr(i),
      u = i.imageData;
    if (
      (!u && i.canvas && f && d && (u = i.canvas.getContext('2d').getImageData(0, 0, f, d)),
      u && (u.width !== f || u.height !== d))
    )
      throw new Error('Invalid imageData dimentions');
    ((c = s + f), (l = a + d));
    let h, p;
    (Me.RAW_IMAGE_DATA && t[o ? 'realMaskDataRaw' : 'maskDataRaw']
      ? ((h = t[o ? 'realMaskDataRaw' : 'maskDataRaw']),
        (p = t[o ? 'realMaskDataRawCompression' : 'maskDataRawCompression']))
      : u
        ? r.compress
          ? ((h = (0, Me.writeDataZipWithoutPrediction)(u, [0])), (p = 2))
          : ((h = (0, Me.writeDataRLE)(e, u, [0], !!r.psb)), (p = 1))
        : ((h = new Uint8Array(0)), (p = 1)),
      n.channels.push({ id: o ? -3 : -2, compression: p, data: h, length: 2 + h.length }),
      (n[o ? 'realMask' : 'mask'] = { top: a, left: s, right: c, bottom: l }));
  }
  function xs(e) {
    return e
      ? { top: e.top || 0, left: e.left || 0, right: e.right || 0, bottom: e.bottom || 0 }
      : void 0;
  }
  function fb(e, n, t, i) {
    if (n.rawData)
      return Object.assign(
        Object.assign(
          {
            layer: n,
            channels: n.rawData.channels.map(o => {
              var a, s;
              return Object.assign(Object.assign({}, o), {
                length:
                  2 +
                  ((s = (a = o.data) === null || a === void 0 ? void 0 : a.byteLength) !== null &&
                  s !== void 0
                    ? s
                    : 0),
              });
            }),
          },
          xs(n)
        ),
        { mask: xs(n.mask), realMask: xs(n.realMask) }
      );
    let r = db(e, n, t, i);
    return (n.mask && Hu(e, r, n, n.mask, i, !1), n.realMask && Hu(e, r, n, n.realMask, i, !0), r);
  }
  function rr({ canvas: e, imageData: n }) {
    var t, i, r, o;
    let a =
        (i = (t = n?.width) !== null && t !== void 0 ? t : e?.width) !== null && i !== void 0
          ? i
          : 0,
      s =
        (o = (r = n?.height) !== null && r !== void 0 ? r : e?.height) !== null && o !== void 0
          ? o
          : 0;
    return { width: a, height: s };
  }
  function ub(e, n, t, i, r) {
    if (e.data instanceof Uint32Array || e.data instanceof Uint16Array)
      throw new Error('imageData has incorrect bit depth');
    let o = (0, Me.createImageData)(i, r),
      a = e.data,
      s = o.data;
    for (let c = 0; c < r; c++)
      for (let l = 0; l < i; l++) {
        let f = (l + n + (c + t) * e.width) * 4,
          d = (l + c * i) * 4;
        ((s[d] = a[f]), (s[d + 1] = a[f + 1]), (s[d + 2] = a[f + 2]), (s[d + 3] = a[f + 3]));
      }
    return o;
  }
  function db(e, n, t, i) {
    var r;
    let o = n.top | 0,
      a = n.left | 0,
      s = n.right | 0,
      c = n.bottom | 0,
      l = [
        { id: -1, compression: 0, data: void 0, length: 2 },
        { id: 0, compression: 0, data: void 0, length: 2 },
        { id: 1, compression: 0, data: void 0, length: 2 },
        { id: 2, compression: 0, data: void 0, length: 2 },
      ],
      { width: f, height: d } = rr(n);
    if (!(n.canvas || n.imageData) || !f || !d)
      return ((s = a), (c = o), { layer: n, top: o, left: a, right: s, bottom: c, channels: l });
    ((s = a + f), (c = o + d));
    let u = n.imageData || n.canvas.getContext('2d').getImageData(0, 0, f, d);
    if (i.trimImageData) {
      let p = hb(u);
      if (p.left !== 0 || p.top !== 0 || p.right !== u.width || p.bottom !== u.height) {
        if (
          ((a += p.left),
          (o += p.top),
          (s -= u.width - p.right),
          (c -= u.height - p.bottom),
          (f = s - a),
          (d = c - o),
          !f || !d)
        )
          return { layer: n, top: o, left: a, right: s, bottom: c, channels: l };
        u = ub(u, p.left, p.top, f, d);
      }
    }
    let h = [0, 1, 2];
    return (
      (!t ||
        i.noBackground ||
        n.mask ||
        (0, Me.hasAlpha)(u) ||
        (Me.RAW_IMAGE_DATA && !((r = n.imageDataRaw) === null || r === void 0) && r[-1])) &&
        h.unshift(-1),
      (l = h.map(p => {
        let _ = (0, Me.offsetForChannel)(p, !1),
          b,
          g;
        return (
          Me.RAW_IMAGE_DATA && n.imageDataRaw
            ? ((b = n.imageDataRaw[p]), (g = n.imageDataRawCompression[p]))
            : i.compress
              ? ((b = (0, Me.writeDataZipWithoutPrediction)(u, [_])), (g = 2))
              : ((b = (0, Me.writeDataRLE)(e, u, [_], !!i.psb)), (g = 1)),
          { id: p, compression: g, data: b, length: 2 + b.length }
        );
      })),
      { layer: n, top: o, left: a, right: s, bottom: c, channels: l }
    );
  }
  function Xu({ data: e, width: n }, t, i, r) {
    let o = ((t * n + i) * 4 + 3) | 0,
      a = (o + (r - i) * 4) | 0;
    for (let s = o; s < a; s = (s + 4) | 0) if (e[s] !== 0) return !1;
    return !0;
  }
  function Ku({ data: e, width: n }, t, i, r) {
    let o = (n * 4) | 0,
      a = (i * o + t * 4 + 3) | 0;
    for (let s = i, c = a; s < r; s++, c = (c + o) | 0) if (e[c] !== 0) return !1;
    return !0;
  }
  function hb(e) {
    let n = 0,
      t = 0,
      i = e.width,
      r = e.height;
    for (; n < r && Xu(e, n, t, i);) n++;
    for (; r > n && Xu(e, r - 1, t, i);) r--;
    for (; t < i && Ku(e, t, n, r);) t++;
    for (; i > t && Ku(e, i - 1, n, r);) i--;
    return { top: n, left: t, right: i, bottom: r };
  }
  function pb(e, n) {
    n
      ? 'r' in n
        ? (re(e, 0),
          re(e, Math.round(n.r * 257)),
          re(e, Math.round(n.g * 257)),
          re(e, Math.round(n.b * 257)),
          re(e, 0))
        : 'fr' in n
          ? (re(e, 0),
            re(e, Math.round(n.fr * 255 * 257)),
            re(e, Math.round(n.fg * 255 * 257)),
            re(e, Math.round(n.fb * 255 * 257)),
            re(e, 0))
          : 'l' in n
            ? (re(e, 7),
              bn(e, Math.round(n.l * 1e4)),
              bn(e, Math.round(n.a < 0 ? n.a * 12800 : n.a * 12700)),
              bn(e, Math.round(n.b < 0 ? n.b * 12800 : n.b * 12700)),
              re(e, 0))
            : 'h' in n
              ? (re(e, 1),
                re(e, Math.round(n.h * 65535)),
                re(e, Math.round(n.s * 65535)),
                re(e, Math.round(n.b * 65535)),
                re(e, 0))
              : 'c' in n
                ? (re(e, 2),
                  re(e, Math.round(n.c * 257)),
                  re(e, Math.round(n.m * 257)),
                  re(e, Math.round(n.y * 257)),
                  re(e, Math.round(n.k * 257)))
                : (re(e, 8), re(e, Math.round((n.k * 1e4) / 255)), Tn(e, 6))
      : (re(e, 0), Tn(e, 8));
  }
  function gb(e, n) {
    let t = n.bounds.w,
      i = n.bounds.h,
      r = { width: t, height: i, data: n.data };
    xe(e, 0);
    let o = e.offset;
    (xe(e, 1),
      xe(e, 3),
      bn(e, n.x),
      bn(e, n.y),
      qu(e, n.name + '\0'),
      Mo(e, n.id, 1),
      xe(e, 3),
      xe(e, 0));
    let a = e.offset,
      s = n.bounds.y,
      c = n.bounds.x,
      l = s + i,
      f = c + t;
    (xe(e, s), xe(e, c), xe(e, l), xe(e, f), xe(e, 24));
    for (let h = 0; h < 26; h++) {
      let p = h < 3 ? h : h === 25 ? 3 : -1;
      if (p < 0) {
        xe(e, 0);
        continue;
      }
      let _ = new Uint8Array(t * i + 2 * i + 2 * t + 16),
        b = (0, Me.writeDataRLE)(_, r, [p], !1);
      (xe(e, 1),
        xe(e, b.length + 4 + 16 + 2 + 1),
        xe(e, 8),
        xe(e, s),
        xe(e, c),
        xe(e, l),
        xe(e, f),
        re(e, 8),
        ve(e, 1),
        or(e, b));
    }
    let d = e.offset - a,
      u = e.offset - o;
    for (; u % 4;) (Tn(e, 1), u++);
    (e.view.setUint32(a - 4, d, !1), e.view.setUint32(o - 4, u, !1));
  }
});
var od = he(ks => {
  'use strict';
  Object.defineProperty(ks, '__esModule', { value: !0 });
  ks.readAbr = _b;
  var ne = no(),
    Ce = un(),
    mb = [
      'off',
      'fade',
      'pen pressure',
      'pen tilt',
      'stylus wheel',
      'initial direction',
      'direction',
      'initial rotation',
      'rotation',
    ],
    id = [
      'round point',
      'round blunt',
      'round curve',
      'round angle',
      'round fan',
      'flat point',
      'flat blunt',
      'flat curve',
      'flat angle',
      'flat fan',
    ],
    bb = [
      'erodible point',
      'erodible flat',
      'erodible round',
      'erodible square',
      'erodible triangle',
      'custom',
    ],
    yb = { _: 'brush', MixB: 'mixer brush', SmTl: 'smudge brush' };
  function Ve(e) {
    return {
      control: mb[e.bVTy],
      steps: e.fStp,
      jitter: (0, ne.parsePercent)(e.jitter),
      minimum: (0, ne.parsePercent)(e['Mnm ']),
    };
  }
  function rd(e) {
    switch (e._classID) {
      case 'computedBrush':
        return {
          type: 'computed',
          size: (0, ne.parseUnitsToNumber)(e.Dmtr, 'Pixels'),
          angle: (0, ne.parseAngle)(e.Angl),
          roundness: (0, ne.parsePercent)(e.Rndn),
          spacingOn: e.Intr,
          spacing: (0, ne.parsePercent)(e.Spcn),
          flipX: e.flipX,
          flipY: e.flipY,
          hardness: (0, ne.parsePercent)(e.Hrdn),
        };
      case 'sampledBrush':
        return {
          type: 'sampled',
          size: (0, ne.parseUnitsToNumber)(e.Dmtr, 'Pixels'),
          angle: (0, ne.parseAngle)(e.Angl),
          roundness: (0, ne.parsePercent)(e.Rndn),
          spacingOn: e.Intr,
          spacing: (0, ne.parsePercent)(e.Spcn),
          flipX: e.flipX,
          flipY: e.flipY,
          name: e['Nm  '],
          sampledData: e.sampledData,
        };
      case 'dBrush':
        return {
          type: 'dynamic',
          shape: id[e['Shp ']],
          angle: (0, ne.parseAngle)(e.Angl),
          size: (0, ne.parseUnitsToNumber)(e.Dmtr, 'Pixels'),
          density: (0, ne.parsePercent)(e.Dnst),
          length: (0, ne.parsePercent)(e.Lngt),
          clumping: (0, ne.parsePercent)(e.clumping),
          thickness: (0, ne.parsePercent)(e.thickness),
          stiffness: (0, ne.parsePercent)(e.stiffness),
          physics: e.physics,
          spacing: (0, ne.parsePercent)(e.Spcn),
          spacingOn: e.Intr,
          flipX: e.flipX,
          flipY: e.flipY,
        };
      case 'dTips':
        return Object.assign(
          Object.assign(
            {
              type: 'tips',
              angle: (0, ne.parseAngle)(e.Angl),
              size: (0, ne.parseUnitsToNumber)(e.Dmtr, 'Pixels'),
              shape: id[e['Shp ']],
              physics: e.physics,
              spacing: (0, ne.parsePercent)(e.Spcn),
              spacingOn: e.Intr,
              flipX: e.flipX,
              flipY: e.flipY,
              tipsType: bb[e.dtipsType],
              tipsLengthRatio: (0, ne.parsePercent)(e.dtipsLengthRatio),
              tipsHardness: (0, ne.parsePercent)(e.dtipsHardness),
            },
            e.dtipsGridSize && e.dtipsErodibleTipHeightMap
              ? {
                  tipsGridSize: e.dtipsGridSize,
                  tipsErodibleTipHeightMap: wb(e.dtipsErodibleTipHeightMap),
                }
              : {}
          ),
          {
            tipsAirbrushCutoffAngle: e.dtipsAirbrushCutoffAngle,
            tipsAirbrushGranularity: (0, ne.parsePercent)(e.dtipsAirbrushGranularity),
            tipsAirbrushStreakiness: (0, ne.parsePercent)(e.dtipsAirbrushStreakiness),
            tipsAirbrushSplatSize: (0, ne.parsePercent)(e.dtipsAirbrushSplatSize),
            tipsAirbrushSplatCount: e.dtipsAirbrushSplatCount,
          }
        );
      default:
        throw new Error(`Unknown brush classId: ${e._classID}`);
    }
  }
  function wb(e) {
    let n = [];
    for (let t = 0; t < e.byteLength; t++) n.push(e[t]);
    return n;
  }
  function _b(e, n = {}) {
    var t, i, r, o;
    let a = (0, Ce.createReader)(e.buffer, e.byteOffset, e.byteLength),
      s = (0, Ce.readInt16)(a),
      c = [],
      l = [],
      f = [];
    if (s === 1 || s === 2) throw new Error(`Unsupported ABR version (${s})`);
    if (s === 6 || s === 7 || s === 9 || s === 10) {
      let d = (0, Ce.readInt16)(a);
      if (d !== 1 && d !== 2) throw new Error('Unsupported ABR minor version');
      for (; a.offset < a.view.byteLength;) {
        (0, Ce.checkSignature)(a, '8BIM');
        let u = (0, Ce.readSignature)(a),
          h = (0, Ce.readUint32)(a),
          p = a.offset + h;
        switch (u) {
          case 'samp': {
            for (; a.offset < p;) {
              let _ = (0, Ce.readUint32)(a);
              for (; _ & 3;) _++;
              let b = a.offset + _,
                g = (0, Ce.readPascalString)(a, 1);
              (0, Ce.skipBytes)(a, d === 1 ? 10 : 264);
              let y = (0, Ce.readInt32)(a),
                w = (0, Ce.readInt32)(a),
                m = (0, Ce.readInt32)(a) - y,
                A = (0, Ce.readInt32)(a) - w;
              if (A <= 0 || m <= 0) throw new Error('Invalid bounds');
              let M = (0, Ce.readInt16)(a),
                k = (0, Ce.readUint8)(a),
                E = new Uint8Array(A * m);
              if (M === 8)
                if (k === 0) E.set((0, Ce.readBytes)(a, E.byteLength));
                else if (k === 1)
                  (0, Ce.readDataRLE)(a, { width: A, height: m, data: E }, A, m, M, 1, [0], !1);
                else throw new Error('Invalid compression');
              else if (M === 16)
                if (k === 0)
                  for (let F = 0; F < E.byteLength; F++) E[F] = (0, Ce.readUint16)(a) >> 8;
                else
                  throw k === 1
                    ? new Error('not implemented (16bit RLE)')
                    : new Error('Invalid compression');
              else throw new Error('Invalid depth');
              (c.push({ id: g, bounds: { x: w, y, w: A, h: m }, alpha: E }), (a.offset = b));
            }
            break;
          }
          case 'desc': {
            let _ = (0, ne.readVersionAndDescriptor)(a, !0);
            for (let b of _.Brsh) {
              let g = {
                name: b['Nm  '],
                shape: rd(b.Brsh),
                spacing: (0, ne.parsePercent)(b.Spcn),
                wetEdges: b.Wtdg,
                noise: b.Nose,
                useBrushSize: b.useBrushSize,
              };
              (b.interpretation != null && (g.interpretation = b.interpretation),
                b.protectTexture != null && (g.protectTexture = b.protectTexture),
                b.useTipDynamics &&
                  (g.shapeDynamics = {
                    tiltScale: (0, ne.parsePercent)(b.tiltScale),
                    sizeDynamics: Ve(b.szVr),
                    angleDynamics: Ve(b.angleDynamics),
                    roundnessDynamics: Ve(b.roundnessDynamics),
                    flipX: b.flipX,
                    flipY: b.flipY,
                    brushProjection: b.brushProjection,
                    minimumDiameter: (0, ne.parsePercent)(b.minimumDiameter),
                    minimumRoundness: (0, ne.parsePercent)(b.minimumRoundness),
                  }),
                b.useScatter &&
                  (g.scatter = {
                    count: b['Cnt '],
                    bothAxes: b.bothAxes,
                    countDynamics: Ve(b.countDynamics),
                    scatterDynamics: Ve(b.scatterDynamics),
                  }),
                b.useTexture &&
                  b.Txtr &&
                  (g.texture = {
                    id: b.Txtr.Idnt,
                    name: b.Txtr['Nm  '],
                    blendMode: ne.BlnM.decode(b.textureBlendMode),
                    depth: (0, ne.parsePercent)(b.textureDepth),
                    depthMinimum: (0, ne.parsePercent)(b.minimumDepth),
                    depthDynamics: Ve(b.textureDepthDynamics),
                    scale: (0, ne.parsePercent)(b.textureScale),
                    invert: b.InvT,
                    brightness: b.textureBrightness,
                    contrast: b.textureContrast,
                    textureEachTip: !!b.TxtC,
                  }));
              let y = b.dualBrush;
              (y &&
                y.useDualBrush &&
                (g.dualBrush = {
                  flip: y.Flip,
                  shape: rd(y.Brsh),
                  blendMode: ne.BlnM.decode(y.BlnM),
                  useScatter: y.useScatter,
                  spacing: (0, ne.parsePercent)(y.Spcn),
                  count: y['Cnt '],
                  bothAxes: y.bothAxes,
                  countDynamics: Ve(y.countDynamics),
                  scatterDynamics: Ve(y.scatterDynamics),
                }),
                b.useColorDynamics &&
                  (g.colorDynamics = {
                    foregroundBackground: Ve(b.clVr),
                    hue: (0, ne.parsePercent)(b['H   ']),
                    saturation: (0, ne.parsePercent)(b.Strt),
                    brightness: (0, ne.parsePercent)(b.Brgh),
                    purity: (0, ne.parsePercent)(b.purity),
                    perTip: b.colorDynamicsPerTip,
                  }),
                b.usePaintDynamics &&
                  (g.transfer = {
                    flowDynamics: Ve(b.prVr),
                    opacityDynamics: Ve(b.opVr),
                    wetnessDynamics: Ve(b.wtVr),
                    mixDynamics: Ve(b.mxVr),
                  }),
                b.useBrushPose &&
                  (g.brushPose = {
                    overrideAngle: b.overridePoseAngle,
                    overrideTiltX: b.overridePoseTiltX,
                    overrideTiltY: b.overridePoseTiltY,
                    overridePressure: b.overridePosePressure,
                    pressure: (0, ne.parsePercent)(b.brushPosePressure),
                    tiltX: b.brushPoseTiltX,
                    tiltY: b.brushPoseTiltY,
                    angle: b.brushPoseAngle,
                  }));
              let w = b.toolOptions;
              (w &&
                ((g.toolOptions = {
                  type: yb[w._classID] || 'brush',
                  brushPreset: w.brushPreset,
                  flow: (t = w.flow) !== null && t !== void 0 ? t : 100,
                  smooth: (i = w.Smoo) !== null && i !== void 0 ? i : 0,
                  mode: ne.BlnM.decode(w['Md  '] || 'BlnM.Nrml'),
                  opacity: (r = w.Opct) !== null && r !== void 0 ? r : 100,
                  smoothing: !!w.smoothing,
                  smoothingValue: w.smoothingValue || 0,
                  smoothingRadiusMode: !!w.smoothingRadiusMode,
                  smoothingCatchup: !!w.smoothingCatchup,
                  smoothingCatchupAtEnd: !!w.smoothingCatchupAtEnd,
                  smoothingZoomCompensation: !!w.smoothingZoomCompensation,
                  pressureSmoothing: !!w.pressureSmoothing,
                  usePressureOverridesSize: !!w.usePressureOverridesSize,
                  usePressureOverridesOpacity: !!w.usePressureOverridesOpacity,
                  useLegacy: !!w.useLegacy,
                }),
                w.prVr && (g.toolOptions.flowDynamics = Ve(w.prVr)),
                w.opVr && (g.toolOptions.opacityDynamics = Ve(w.opVr)),
                w.szVr && (g.toolOptions.sizeDynamics = Ve(w.szVr)),
                'wetness' in w && (g.toolOptions.wetness = w.wetness),
                'dryness' in w && (g.toolOptions.dryness = w.dryness),
                'mix' in w && (g.toolOptions.mix = w.mix),
                'autoFill' in w && (g.toolOptions.autoFill = w.autoFill),
                'autoClean' in w && (g.toolOptions.autoClean = w.autoClean),
                'loadSolidColorOnly' in w &&
                  (g.toolOptions.loadSolidColorOnly = w.loadSolidColorOnly),
                'sampleAllLayers' in w && (g.toolOptions.sampleAllLayers = w.sampleAllLayers),
                'SmdF' in w && (g.toolOptions.smudgeFingerPainting = w.SmdF),
                'SmdS' in w && (g.toolOptions.smudgeSampleAllLayers = w.SmdS),
                'Prs ' in w && (g.toolOptions.strength = w['Prs '])),
                l.push(g));
            }
            break;
          }
          case 'patt': {
            for (; a.offset < p;) f.push((0, Ce.readPattern)(a));
            a.offset = p;
            break;
          }
          case 'phry': {
            let _ = (0, ne.readVersionAndDescriptor)(a);
            n.logMissingFeatures && !((o = _.hierarchy) === null || o === void 0) && o.length;
            break;
          }
          default:
            throw new Error(`Invalid brush type: ${u}`);
        }
        for (; h % 4;) (a.offset++, h++);
      }
    } else throw new Error(`Unsupported ABR version (${s})`);
    return { samples: c, patterns: f, brushes: l };
  }
});
var ad = he(As => {
  'use strict';
  Object.defineProperty(As, '__esModule', { value: !0 });
  As.readCsh = xb;
  var vb = bo(),
    dt = un();
  function xb(e) {
    let n = (0, dt.createReader)(e.buffer, e.byteOffset, e.byteLength),
      t = { shapes: [] };
    if (((0, dt.checkSignature)(n, 'cush'), (0, dt.readUint32)(n) !== 2))
      throw new Error('Invalid version');
    let i = (0, dt.readUint32)(n);
    for (let r = 0; r < i; r++) {
      let o = (0, dt.readUnicodeString)(n);
      for (; n.offset % 4;) n.offset++;
      if ((0, dt.readUint32)(n) !== 1) throw new Error('Invalid shape version');
      let a = (0, dt.readUint32)(n),
        s = n.offset + a,
        c = (0, dt.readPascalString)(n, 1),
        l = (0, dt.readUint32)(n),
        f = (0, dt.readUint32)(n),
        d = (0, dt.readUint32)(n),
        h = (0, dt.readUint32)(n) - f,
        p = d - l,
        _ = { paths: [] };
      ((0, vb.readVectorMask)(n, _, h, p, s - n.offset),
        t.shapes.push(Object.assign({ name: o, id: c, width: h, height: p }, _)),
        (n.offset = s));
    }
    return t;
  }
});
var dd = he(ht => {
  'use strict';
  Object.defineProperty(ht, '__esModule', { value: !0 });
  ht.Compression =
    ht.ChannelID =
    ht.LayerCompCapturedInfo =
    ht.SectionDividerType =
    ht.ColorMode =
      void 0;
  var sd;
  (function (e) {
    ((e[(e.Bitmap = 0)] = 'Bitmap'),
      (e[(e.Grayscale = 1)] = 'Grayscale'),
      (e[(e.Indexed = 2)] = 'Indexed'),
      (e[(e.RGB = 3)] = 'RGB'),
      (e[(e.CMYK = 4)] = 'CMYK'),
      (e[(e.Multichannel = 7)] = 'Multichannel'),
      (e[(e.Duotone = 8)] = 'Duotone'),
      (e[(e.Lab = 9)] = 'Lab'));
  })(sd || (ht.ColorMode = sd = {}));
  var ld;
  (function (e) {
    ((e[(e.Other = 0)] = 'Other'),
      (e[(e.OpenFolder = 1)] = 'OpenFolder'),
      (e[(e.ClosedFolder = 2)] = 'ClosedFolder'),
      (e[(e.BoundingSectionDivider = 3)] = 'BoundingSectionDivider'));
  })(ld || (ht.SectionDividerType = ld = {}));
  var cd;
  (function (e) {
    ((e[(e.None = 0)] = 'None'),
      (e[(e.Visibility = 1)] = 'Visibility'),
      (e[(e.Position = 2)] = 'Position'),
      (e[(e.Appearance = 4)] = 'Appearance'));
  })(cd || (ht.LayerCompCapturedInfo = cd = {}));
  var fd;
  (function (e) {
    ((e[(e.Color0 = 0)] = 'Color0'),
      (e[(e.Color1 = 1)] = 'Color1'),
      (e[(e.Color2 = 2)] = 'Color2'),
      (e[(e.Color3 = 3)] = 'Color3'),
      (e[(e.Transparency = -1)] = 'Transparency'),
      (e[(e.UserMask = -2)] = 'UserMask'),
      (e[(e.RealUserMask = -3)] = 'RealUserMask'));
  })(fd || (ht.ChannelID = fd = {}));
  var ud;
  (function (e) {
    ((e[(e.RawData = 0)] = 'RawData'),
      (e[(e.RleCompressed = 1)] = 'RleCompressed'),
      (e[(e.ZipWithoutPrediction = 2)] = 'ZipWithoutPrediction'),
      (e[(e.ZipWithPrediction = 3)] = 'ZipWithPrediction'));
  })(ud || (ht.Compression = ud = {}));
});
var pd = he(ue => {
  'use strict';
  var Sb =
      (ue && ue.__createBinding) ||
      (Object.create
        ? function (e, n, t, i) {
            i === void 0 && (i = t);
            var r = Object.getOwnPropertyDescriptor(n, t);
            ((!r || ('get' in r ? !n.__esModule : r.writable || r.configurable)) &&
              (r = {
                enumerable: !0,
                get: function () {
                  return n[t];
                },
              }),
              Object.defineProperty(e, i, r));
          }
        : function (e, n, t, i) {
            (i === void 0 && (i = t), (e[i] = n[t]));
          }),
    Is =
      (ue && ue.__exportStar) ||
      function (e, n) {
        for (var t in e)
          t !== 'default' && !Object.prototype.hasOwnProperty.call(n, t) && Sb(n, e, t);
      };
  Object.defineProperty(ue, '__esModule', { value: !0 });
  ue.getCompositeCanvas =
    ue.getCompositeImageData =
    ue.getLayerRealMaskCanvas =
    ue.getLayerMaskCanvas =
    ue.getLayerCanvas =
    ue.getLayerRealMaskImageData =
    ue.getLayerMaskImageData =
    ue.getLayerImageData =
    ue.decodeLayerPixels =
    ue.byteArrayToBase64 =
    ue.initializeCanvas =
      void 0;
  ue.readPsd = Ib;
  ue.writePsd = Fb;
  ue.writePsdUint8Array = hd;
  ue.writePsdBuffer = Eb;
  var gi = li(),
    pt = un();
  Object.defineProperty(ue, 'decodeLayerPixels', {
    enumerable: !0,
    get: function () {
      return pt.decodeLayerPixels;
    },
  });
  Object.defineProperty(ue, 'getLayerImageData', {
    enumerable: !0,
    get: function () {
      return pt.getLayerImageData;
    },
  });
  Object.defineProperty(ue, 'getLayerMaskImageData', {
    enumerable: !0,
    get: function () {
      return pt.getLayerMaskImageData;
    },
  });
  Object.defineProperty(ue, 'getLayerRealMaskImageData', {
    enumerable: !0,
    get: function () {
      return pt.getLayerRealMaskImageData;
    },
  });
  Object.defineProperty(ue, 'getLayerCanvas', {
    enumerable: !0,
    get: function () {
      return pt.getLayerCanvas;
    },
  });
  Object.defineProperty(ue, 'getLayerMaskCanvas', {
    enumerable: !0,
    get: function () {
      return pt.getLayerMaskCanvas;
    },
  });
  Object.defineProperty(ue, 'getLayerRealMaskCanvas', {
    enumerable: !0,
    get: function () {
      return pt.getLayerRealMaskCanvas;
    },
  });
  Object.defineProperty(ue, 'getCompositeImageData', {
    enumerable: !0,
    get: function () {
      return pt.getCompositeImageData;
    },
  });
  Object.defineProperty(ue, 'getCompositeCanvas', {
    enumerable: !0,
    get: function () {
      return pt.getCompositeCanvas;
    },
  });
  var kb = qr();
  Is(od(), ue);
  Is(ad(), ue);
  var Ab = fn();
  Object.defineProperty(ue, 'initializeCanvas', {
    enumerable: !0,
    get: function () {
      return Ab.initializeCanvas;
    },
  });
  Is(dd(), ue);
  ue.byteArrayToBase64 = kb.fromByteArray;
  function Ib(e, n) {
    let t =
      'buffer' in e
        ? (0, pt.createReader)(e.buffer, e.byteOffset, e.byteLength)
        : (0, pt.createReader)(e);
    return (0, pt.readPsd)(t, n);
  }
  function Fb(e, n) {
    let t = (0, gi.createWriter)();
    return ((0, gi.writePsd)(t, e, n), (0, gi.getWriterBuffer)(t));
  }
  function hd(e, n) {
    let t = (0, gi.createWriter)();
    return ((0, gi.writePsd)(t, e, n), (0, gi.getWriterBufferNoCopy)(t));
  }
  function Eb(e, n) {
    if (typeof Buffer > 'u') throw new Error('Buffer not supported on this platform');
    return Buffer.from(hd(e, n));
  }
});
var qe = Uint8Array,
  Xn = Uint16Array,
  Fh = Int32Array,
  ml = new qe([
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0, 0, 0, 0,
  ]),
  bl = new qe([
    0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13,
    13, 0, 0,
  ]),
  Eh = new qe([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]),
  yl = function (e, n) {
    for (var t = new Xn(31), i = 0; i < 31; ++i) t[i] = n += 1 << e[i - 1];
    for (var r = new Fh(t[30]), i = 1; i < 30; ++i)
      for (var o = t[i]; o < t[i + 1]; ++o) r[o] = ((o - t[i]) << 5) | i;
    return { b: t, r };
  },
  wl = yl(ml, 2),
  _l = wl.b,
  Dh = wl.r;
((_l[28] = 258), (Dh[258] = 28));
var vl = yl(bl, 0),
  Mh = vl.b,
  h2 = vl.r,
  Wo = new Xn(32768);
for (ge = 0; ge < 32768; ++ge)
  (($t = ((ge & 43690) >> 1) | ((ge & 21845) << 1)),
    ($t = (($t & 52428) >> 2) | (($t & 13107) << 2)),
    ($t = (($t & 61680) >> 4) | (($t & 3855) << 4)),
    (Wo[ge] = ((($t & 65280) >> 8) | (($t & 255) << 8)) >> 1));
var $t,
  ge,
  Di = function (e, n, t) {
    for (var i = e.length, r = 0, o = new Xn(n); r < i; ++r) e[r] && ++o[e[r] - 1];
    var a = new Xn(n);
    for (r = 1; r < n; ++r) a[r] = (a[r - 1] + o[r - 1]) << 1;
    var s;
    if (t) {
      s = new Xn(1 << n);
      var c = 15 - n;
      for (r = 0; r < i; ++r)
        if (e[r])
          for (
            var l = (r << 4) | e[r], f = n - e[r], d = a[e[r] - 1]++ << f, u = d | ((1 << f) - 1);
            d <= u;
            ++d
          )
            s[Wo[d] >> c] = l;
    } else for (s = new Xn(i), r = 0; r < i; ++r) e[r] && (s[r] = Wo[a[e[r] - 1]++] >> (15 - e[r]));
    return s;
  },
  Mi = new qe(288);
for (ge = 0; ge < 144; ++ge) Mi[ge] = 8;
var ge;
for (ge = 144; ge < 256; ++ge) Mi[ge] = 9;
var ge;
for (ge = 256; ge < 280; ++ge) Mi[ge] = 7;
var ge;
for (ge = 280; ge < 288; ++ge) Mi[ge] = 8;
var ge,
  xl = new qe(32);
for (ge = 0; ge < 32; ++ge) xl[ge] = 5;
var ge;
var Ch = Di(Mi, 9, 1);
var Oh = Di(xl, 5, 1),
  Ho = function (e) {
    for (var n = e[0], t = 1; t < e.length; ++t) e[t] > n && (n = e[t]);
    return n;
  },
  wt = function (e, n, t) {
    var i = (n / 8) | 0;
    return ((e[i] | (e[i + 1] << 8)) >> (n & 7)) & t;
  },
  Xo = function (e, n) {
    var t = (n / 8) | 0;
    return (e[t] | (e[t + 1] << 8) | (e[t + 2] << 16)) >> (n & 7);
  },
  Lh = function (e) {
    return ((e + 7) / 8) | 0;
  },
  qo = function (e, n, t) {
    return (
      (n == null || n < 0) && (n = 0),
      (t == null || t > e.length) && (t = e.length),
      new qe(e.subarray(n, t))
    );
  };
var Uh = [
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
  Ye = function (e, n, t) {
    var i = new Error(n || Uh[e]);
    if (((i.code = e), Error.captureStackTrace && Error.captureStackTrace(i, Ye), !t)) throw i;
    return i;
  },
  Ph = function (e, n, t, i) {
    var r = e.length,
      o = i ? i.length : 0;
    if (!r || (n.f && !n.l)) return t || new qe(0);
    var a = !t,
      s = a || n.i != 2,
      c = n.i;
    a && (t = new qe(r * 3));
    var l = function (Ue) {
        var yt = t.length;
        if (Ue > yt) {
          var Er = new qe(Math.max(yt * 2, Ue));
          (Er.set(t), (t = Er));
        }
      },
      f = n.f || 0,
      d = n.p || 0,
      u = n.b || 0,
      h = n.l,
      p = n.d,
      _ = n.m,
      b = n.n,
      g = r * 8;
    do {
      if (!h) {
        f = wt(e, d, 1);
        var y = wt(e, d + 1, 3);
        if (((d += 3), y))
          if (y == 1) ((h = Ch), (p = Oh), (_ = 9), (b = 5));
          else if (y == 2) {
            var M = wt(e, d, 31) + 257,
              k = wt(e, d + 10, 15) + 4,
              E = M + wt(e, d + 5, 31) + 1;
            d += 14;
            for (var F = new qe(E), I = new qe(19), C = 0; C < k; ++C)
              I[Eh[C]] = wt(e, d + C * 3, 7);
            d += k * 3;
            for (var B = Ho(I), ee = (1 << B) - 1, $ = Di(I, B, 1), C = 0; C < E;) {
              var U = $[wt(e, d, ee)];
              d += U & 15;
              var w = U >> 4;
              if (w < 16) F[C++] = w;
              else {
                var V = 0,
                  X = 0;
                for (
                  w == 16
                    ? ((X = 3 + wt(e, d, 3)), (d += 2), (V = F[C - 1]))
                    : w == 17
                      ? ((X = 3 + wt(e, d, 7)), (d += 3))
                      : w == 18 && ((X = 11 + wt(e, d, 127)), (d += 7));
                  X--;
                )
                  F[C++] = V;
              }
            }
            var ie = F.subarray(0, M),
              H = F.subarray(M);
            ((_ = Ho(ie)), (b = Ho(H)), (h = Di(ie, _, 1)), (p = Di(H, b, 1)));
          } else Ye(1);
        else {
          var w = Lh(d) + 4,
            m = e[w - 4] | (e[w - 3] << 8),
            A = w + m;
          if (A > r) {
            c && Ye(0);
            break;
          }
          (s && l(u + m), t.set(e.subarray(w, A), u), (n.b = u += m), (n.p = d = A * 8), (n.f = f));
          continue;
        }
        if (d > g) {
          c && Ye(0);
          break;
        }
      }
      s && l(u + 131072);
      for (var R = (1 << _) - 1, P = (1 << b) - 1, N = d; ; N = d) {
        var V = h[Xo(e, d) & R],
          z = V >> 4;
        if (((d += V & 15), d > g)) {
          c && Ye(0);
          break;
        }
        if ((V || Ye(2), z < 256)) t[u++] = z;
        else if (z == 256) {
          ((N = d), (h = null));
          break;
        } else {
          var Z = z - 254;
          if (z > 264) {
            var C = z - 257,
              te = ml[C];
            ((Z = wt(e, d, (1 << te) - 1) + _l[C]), (d += te));
          }
          var Y = p[Xo(e, d) & P],
            se = Y >> 4;
          (Y || Ye(3), (d += Y & 15));
          var H = Mh[se];
          if (se > 3) {
            var te = bl[se];
            ((H += Xo(e, d) & ((1 << te) - 1)), (d += te));
          }
          if (d > g) {
            c && Ye(0);
            break;
          }
          s && l(u + 131072);
          var ke = u + Z;
          if (u < H) {
            var Ee = o - H,
              we = Math.min(H, ke);
            for (Ee + u < 0 && Ye(3); u < we; ++u) t[u] = i[Ee + u];
          }
          for (; u < ke; ++u) t[u] = t[u - H];
        }
      }
      ((n.l = h), (n.p = N), (n.b = u), (n.f = f), h && ((f = 1), (n.m = _), (n.d = p), (n.n = b)));
    } while (!f);
    return u != t.length && a ? qo(t, 0, u) : t.subarray(0, u);
  };
var Th = new qe(0);
var kt = function (e, n) {
    return e[n] | (e[n + 1] << 8);
  },
  st = function (e, n) {
    return (e[n] | (e[n + 1] << 8) | (e[n + 2] << 16) | (e[n + 3] << 24)) >>> 0;
  },
  Ko = function (e, n) {
    return st(e, n) + st(e, n + 4) * 4294967296;
  };
function Rh(e, n) {
  return Ph(e, { i: 2 }, n && n.out, n && n.dictionary);
}
var Yo = typeof TextDecoder < 'u' && new TextDecoder(),
  Bh = 0;
try {
  (Yo.decode(Th, { stream: !0 }), (Bh = 1));
} catch {}
var zh = function (e) {
  for (var n = '', t = 0; ;) {
    var i = e[t++],
      r = (i > 127) + (i > 223) + (i > 239);
    if (t + r > e.length) return { s: n, r: qo(e, t - 1) };
    r
      ? r == 3
        ? ((i =
            (((i & 15) << 18) | ((e[t++] & 63) << 12) | ((e[t++] & 63) << 6) | (e[t++] & 63)) -
            65536),
          (n += String.fromCharCode(55296 | (i >> 10), 56320 | (i & 1023))))
        : r & 1
          ? (n += String.fromCharCode(((i & 31) << 6) | (e[t++] & 63)))
          : (n += String.fromCharCode(((i & 15) << 12) | ((e[t++] & 63) << 6) | (e[t++] & 63)))
      : (n += String.fromCharCode(i));
  }
};
function Nh(e, n) {
  if (n) {
    for (var t = '', i = 0; i < e.length; i += 16384)
      t += String.fromCharCode.apply(null, e.subarray(i, i + 16384));
    return t;
  } else {
    if (Yo) return Yo.decode(e);
    var r = zh(e),
      o = r.s,
      t = r.r;
    return (t.length && Ye(8), o);
  }
}
var jh = function (e, n) {
    return n + 30 + kt(e, n + 26) + kt(e, n + 28);
  },
  Vh = function (e, n, t) {
    var i = kt(e, n + 28),
      r = kt(e, n + 30),
      o = Nh(e.subarray(n + 46, n + 46 + i), !(kt(e, n + 8) & 2048)),
      a = n + 46 + i,
      s = Gh(e, a, r, t, st(e, n + 20), st(e, n + 24), st(e, n + 42)),
      c = s[0],
      l = s[1],
      f = s[2];
    return [kt(e, n + 10), c, l, o, a + r + kt(e, n + 32), f];
  },
  Gh = function (e, n, t, i, r, o, a) {
    var s = r == 4294967295,
      c = o == 4294967295,
      l = a == 4294967295,
      f = n + t,
      d = s + c + l;
    if (i && d) {
      for (; n + 4 < f; n += 4 + kt(e, n + 2))
        if (kt(e, n) == 1)
          return [
            s ? Ko(e, n + 4 + 8 * c) : r,
            c ? Ko(e, n + 4) : o,
            l ? Ko(e, n + 4 + 8 * (c + s)) : a,
            1,
          ];
      i < 2 && Ye(13);
    }
    return [r, o, a, 0];
  };
function Sl(e, n) {
  for (var t = {}, i = e.length - 22; st(e, i) != 101010256; --i)
    (!i || e.length - i > 65558) && Ye(13);
  var r = kt(e, i + 8);
  if (!r) return {};
  var o = st(e, i + 16),
    a = st(e, i - 20) == 117853008;
  if (a) {
    var s = st(e, i - 12);
    ((a = st(e, s) == 101075792), a && ((r = st(e, s + 32)), (o = st(e, s + 48))));
  }
  for (var c = n && n.filter, l = 0; l < r; ++l) {
    var f = Vh(e, o, a),
      d = f[0],
      u = f[1],
      h = f[2],
      p = f[3],
      _ = f[4],
      b = f[5],
      g = jh(e, b);
    ((o = _),
      (!c || c({ name: p, size: u, originalSize: h, compression: d })) &&
        (d
          ? d == 8
            ? (t[p] = Rh(e.subarray(g, g + u), { out: new qe(h) }))
            : Ye(14, 'unknown compression type ' + d)
          : (t[p] = qo(e, g, g + u))));
  }
  return t;
}
var Ir = Ih(pd());
function vi(e) {
  let n = e.length;
  for (; --n >= 0;) e[n] = 0;
}
var Db = 0,
  Qd = 1,
  Mb = 2,
  Cb = 3,
  Ob = 258,
  Ys = 29,
  _r = 256,
  dr = _r + 1 + Ys,
  yi = 30,
  qs = 19,
  e0 = 2 * dr + 1,
  Bn = 15,
  Fs = 16,
  Lb = 7,
  Js = 256,
  t0 = 16,
  n0 = 17,
  i0 = 18,
  js = new Uint8Array([
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
  ]),
  To = new Uint8Array([
    0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13,
    13,
  ]),
  Ub = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7]),
  r0 = new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]),
  Pb = 512,
  en = new Array((dr + 2) * 2);
vi(en);
var cr = new Array(yi * 2);
vi(cr);
var hr = new Array(Pb);
vi(hr);
var pr = new Array(Ob - Cb + 1);
vi(pr);
var Qs = new Array(Ys);
vi(Qs);
var Ro = new Array(yi);
vi(Ro);
function Es(e, n, t, i, r) {
  ((this.static_tree = e),
    (this.extra_bits = n),
    (this.extra_base = t),
    (this.elems = i),
    (this.max_length = r),
    (this.has_stree = e && e.length));
}
var o0, a0, s0;
function Ds(e, n) {
  ((this.dyn_tree = e), (this.max_code = 0), (this.stat_desc = n));
}
var l0 = e => (e < 256 ? hr[e] : hr[256 + (e >>> 7)]),
  gr = (e, n) => {
    ((e.pending_buf[e.pending++] = n & 255), (e.pending_buf[e.pending++] = (n >>> 8) & 255));
  },
  We = (e, n, t) => {
    e.bi_valid > Fs - t
      ? ((e.bi_buf |= (n << e.bi_valid) & 65535),
        gr(e, e.bi_buf),
        (e.bi_buf = n >> (Fs - e.bi_valid)),
        (e.bi_valid += t - Fs))
      : ((e.bi_buf |= (n << e.bi_valid) & 65535), (e.bi_valid += t));
  },
  Bt = (e, n, t) => {
    We(e, t[n * 2], t[n * 2 + 1]);
  },
  c0 = (e, n) => {
    let t = 0;
    do ((t |= e & 1), (e >>>= 1), (t <<= 1));
    while (--n > 0);
    return t >>> 1;
  },
  Tb = e => {
    e.bi_valid === 16
      ? (gr(e, e.bi_buf), (e.bi_buf = 0), (e.bi_valid = 0))
      : e.bi_valid >= 8 &&
        ((e.pending_buf[e.pending++] = e.bi_buf & 255), (e.bi_buf >>= 8), (e.bi_valid -= 8));
  },
  Rb = (e, n) => {
    let t = n.dyn_tree,
      i = n.max_code,
      r = n.stat_desc.static_tree,
      o = n.stat_desc.has_stree,
      a = n.stat_desc.extra_bits,
      s = n.stat_desc.extra_base,
      c = n.stat_desc.max_length,
      l,
      f,
      d,
      u,
      h,
      p,
      _ = 0;
    for (u = 0; u <= Bn; u++) e.bl_count[u] = 0;
    for (t[e.heap[e.heap_max] * 2 + 1] = 0, l = e.heap_max + 1; l < e0; l++)
      ((f = e.heap[l]),
        (u = t[t[f * 2 + 1] * 2 + 1] + 1),
        u > c && ((u = c), _++),
        (t[f * 2 + 1] = u),
        !(f > i) &&
          (e.bl_count[u]++,
          (h = 0),
          f >= s && (h = a[f - s]),
          (p = t[f * 2]),
          (e.opt_len += p * (u + h)),
          o && (e.static_len += p * (r[f * 2 + 1] + h))));
    if (_ !== 0) {
      do {
        for (u = c - 1; e.bl_count[u] === 0;) u--;
        (e.bl_count[u]--, (e.bl_count[u + 1] += 2), e.bl_count[c]--, (_ -= 2));
      } while (_ > 0);
      for (u = c; u !== 0; u--)
        for (f = e.bl_count[u]; f !== 0;)
          ((d = e.heap[--l]),
            !(d > i) &&
              (t[d * 2 + 1] !== u &&
                ((e.opt_len += (u - t[d * 2 + 1]) * t[d * 2]), (t[d * 2 + 1] = u)),
              f--));
    }
  },
  f0 = (e, n, t) => {
    let i = new Array(Bn + 1),
      r = 0,
      o,
      a;
    for (o = 1; o <= Bn; o++) ((r = (r + t[o - 1]) << 1), (i[o] = r));
    for (a = 0; a <= n; a++) {
      let s = e[a * 2 + 1];
      s !== 0 && (e[a * 2] = c0(i[s]++, s));
    }
  },
  Bb = () => {
    let e,
      n,
      t,
      i,
      r,
      o = new Array(Bn + 1);
    for (t = 0, i = 0; i < Ys - 1; i++) for (Qs[i] = t, e = 0; e < 1 << js[i]; e++) pr[t++] = i;
    for (pr[t - 1] = i, r = 0, i = 0; i < 16; i++)
      for (Ro[i] = r, e = 0; e < 1 << To[i]; e++) hr[r++] = i;
    for (r >>= 7; i < yi; i++)
      for (Ro[i] = r << 7, e = 0; e < 1 << (To[i] - 7); e++) hr[256 + r++] = i;
    for (n = 0; n <= Bn; n++) o[n] = 0;
    for (e = 0; e <= 143;) ((en[e * 2 + 1] = 8), e++, o[8]++);
    for (; e <= 255;) ((en[e * 2 + 1] = 9), e++, o[9]++);
    for (; e <= 279;) ((en[e * 2 + 1] = 7), e++, o[7]++);
    for (; e <= 287;) ((en[e * 2 + 1] = 8), e++, o[8]++);
    for (f0(en, dr + 1, o), e = 0; e < yi; e++) ((cr[e * 2 + 1] = 5), (cr[e * 2] = c0(e, 5)));
    ((o0 = new Es(en, js, _r + 1, dr, Bn)),
      (a0 = new Es(cr, To, 0, yi, Bn)),
      (s0 = new Es(new Array(0), Ub, 0, qs, Lb)));
  },
  u0 = e => {
    let n;
    for (n = 0; n < dr; n++) e.dyn_ltree[n * 2] = 0;
    for (n = 0; n < yi; n++) e.dyn_dtree[n * 2] = 0;
    for (n = 0; n < qs; n++) e.bl_tree[n * 2] = 0;
    ((e.dyn_ltree[Js * 2] = 1), (e.opt_len = e.static_len = 0), (e.sym_next = e.matches = 0));
  },
  d0 = e => {
    (e.bi_valid > 8 ? gr(e, e.bi_buf) : e.bi_valid > 0 && (e.pending_buf[e.pending++] = e.bi_buf),
      (e.bi_buf = 0),
      (e.bi_valid = 0));
  },
  gd = (e, n, t, i) => {
    let r = n * 2,
      o = t * 2;
    return e[r] < e[o] || (e[r] === e[o] && i[n] <= i[t]);
  },
  Ms = (e, n, t) => {
    let i = e.heap[t],
      r = t << 1;
    for (
      ;
      r <= e.heap_len &&
      (r < e.heap_len && gd(n, e.heap[r + 1], e.heap[r], e.depth) && r++,
      !gd(n, i, e.heap[r], e.depth));
    )
      ((e.heap[t] = e.heap[r]), (t = r), (r <<= 1));
    e.heap[t] = i;
  },
  md = (e, n, t) => {
    let i,
      r,
      o = 0,
      a,
      s;
    if (e.sym_next !== 0)
      do
        ((i = e.pending_buf[e.sym_buf + o++] & 255),
          (i += (e.pending_buf[e.sym_buf + o++] & 255) << 8),
          (r = e.pending_buf[e.sym_buf + o++]),
          i === 0
            ? Bt(e, r, n)
            : ((a = pr[r]),
              Bt(e, a + _r + 1, n),
              (s = js[a]),
              s !== 0 && ((r -= Qs[a]), We(e, r, s)),
              i--,
              (a = l0(i)),
              Bt(e, a, t),
              (s = To[a]),
              s !== 0 && ((i -= Ro[a]), We(e, i, s))));
      while (o < e.sym_next);
    Bt(e, Js, n);
  },
  Vs = (e, n) => {
    let t = n.dyn_tree,
      i = n.stat_desc.static_tree,
      r = n.stat_desc.has_stree,
      o = n.stat_desc.elems,
      a,
      s,
      c = -1,
      l;
    for (e.heap_len = 0, e.heap_max = e0, a = 0; a < o; a++)
      t[a * 2] !== 0 ? ((e.heap[++e.heap_len] = c = a), (e.depth[a] = 0)) : (t[a * 2 + 1] = 0);
    for (; e.heap_len < 2;)
      ((l = e.heap[++e.heap_len] = c < 2 ? ++c : 0),
        (t[l * 2] = 1),
        (e.depth[l] = 0),
        e.opt_len--,
        r && (e.static_len -= i[l * 2 + 1]));
    for (n.max_code = c, a = e.heap_len >> 1; a >= 1; a--) Ms(e, t, a);
    l = o;
    do
      ((a = e.heap[1]),
        (e.heap[1] = e.heap[e.heap_len--]),
        Ms(e, t, 1),
        (s = e.heap[1]),
        (e.heap[--e.heap_max] = a),
        (e.heap[--e.heap_max] = s),
        (t[l * 2] = t[a * 2] + t[s * 2]),
        (e.depth[l] = (e.depth[a] >= e.depth[s] ? e.depth[a] : e.depth[s]) + 1),
        (t[a * 2 + 1] = t[s * 2 + 1] = l),
        (e.heap[1] = l++),
        Ms(e, t, 1));
    while (e.heap_len >= 2);
    ((e.heap[--e.heap_max] = e.heap[1]), Rb(e, n), f0(t, c, e.bl_count));
  },
  bd = (e, n, t) => {
    let i,
      r = -1,
      o,
      a = n[1],
      s = 0,
      c = 7,
      l = 4;
    for (a === 0 && ((c = 138), (l = 3)), n[(t + 1) * 2 + 1] = 65535, i = 0; i <= t; i++)
      ((o = a),
        (a = n[(i + 1) * 2 + 1]),
        !(++s < c && o === a) &&
          (s < l
            ? (e.bl_tree[o * 2] += s)
            : o !== 0
              ? (o !== r && e.bl_tree[o * 2]++, e.bl_tree[t0 * 2]++)
              : s <= 10
                ? e.bl_tree[n0 * 2]++
                : e.bl_tree[i0 * 2]++,
          (s = 0),
          (r = o),
          a === 0 ? ((c = 138), (l = 3)) : o === a ? ((c = 6), (l = 3)) : ((c = 7), (l = 4))));
  },
  yd = (e, n, t) => {
    let i,
      r = -1,
      o,
      a = n[1],
      s = 0,
      c = 7,
      l = 4;
    for (a === 0 && ((c = 138), (l = 3)), i = 0; i <= t; i++)
      if (((o = a), (a = n[(i + 1) * 2 + 1]), !(++s < c && o === a))) {
        if (s < l)
          do Bt(e, o, e.bl_tree);
          while (--s !== 0);
        else
          o !== 0
            ? (o !== r && (Bt(e, o, e.bl_tree), s--), Bt(e, t0, e.bl_tree), We(e, s - 3, 2))
            : s <= 10
              ? (Bt(e, n0, e.bl_tree), We(e, s - 3, 3))
              : (Bt(e, i0, e.bl_tree), We(e, s - 11, 7));
        ((s = 0),
          (r = o),
          a === 0 ? ((c = 138), (l = 3)) : o === a ? ((c = 6), (l = 3)) : ((c = 7), (l = 4)));
      }
  },
  zb = e => {
    let n;
    for (
      bd(e, e.dyn_ltree, e.l_desc.max_code),
        bd(e, e.dyn_dtree, e.d_desc.max_code),
        Vs(e, e.bl_desc),
        n = qs - 1;
      n >= 3 && e.bl_tree[r0[n] * 2 + 1] === 0;
      n--
    );
    return ((e.opt_len += 3 * (n + 1) + 5 + 5 + 4), n);
  },
  Nb = (e, n, t, i) => {
    let r;
    for (We(e, n - 257, 5), We(e, t - 1, 5), We(e, i - 4, 4), r = 0; r < i; r++)
      We(e, e.bl_tree[r0[r] * 2 + 1], 3);
    (yd(e, e.dyn_ltree, n - 1), yd(e, e.dyn_dtree, t - 1));
  },
  jb = e => {
    let n = 4093624447,
      t;
    for (t = 0; t <= 31; t++, n >>>= 1) if (n & 1 && e.dyn_ltree[t * 2] !== 0) return 0;
    if (e.dyn_ltree[18] !== 0 || e.dyn_ltree[20] !== 0 || e.dyn_ltree[26] !== 0) return 1;
    for (t = 32; t < _r; t++) if (e.dyn_ltree[t * 2] !== 0) return 1;
    return 0;
  },
  wd = !1,
  Vb = e => {
    (wd || (Bb(), (wd = !0)),
      (e.l_desc = new Ds(e.dyn_ltree, o0)),
      (e.d_desc = new Ds(e.dyn_dtree, a0)),
      (e.bl_desc = new Ds(e.bl_tree, s0)),
      (e.bi_buf = 0),
      (e.bi_valid = 0),
      u0(e));
  },
  h0 = (e, n, t, i) => {
    (We(e, (Db << 1) + (i ? 1 : 0), 3),
      d0(e),
      gr(e, t),
      gr(e, ~t),
      t && e.pending_buf.set(e.window.subarray(n, n + t), e.pending),
      (e.pending += t));
  },
  Gb = e => {
    (We(e, Qd << 1, 3), Bt(e, Js, en), Tb(e));
  },
  $b = (e, n, t, i) => {
    let r,
      o,
      a = 0;
    (e.level > 0
      ? (e.strm.data_type === 2 && (e.strm.data_type = jb(e)),
        Vs(e, e.l_desc),
        Vs(e, e.d_desc),
        (a = zb(e)),
        (r = (e.opt_len + 3 + 7) >>> 3),
        (o = (e.static_len + 3 + 7) >>> 3),
        o <= r && (r = o))
      : (r = o = t + 5),
      t + 4 <= r && n !== -1
        ? h0(e, n, t, i)
        : e.strategy === 4 || o === r
          ? (We(e, (Qd << 1) + (i ? 1 : 0), 3), md(e, en, cr))
          : (We(e, (Mb << 1) + (i ? 1 : 0), 3),
            Nb(e, e.l_desc.max_code + 1, e.d_desc.max_code + 1, a + 1),
            md(e, e.dyn_ltree, e.dyn_dtree)),
      u0(e),
      i && d0(e));
  },
  Zb = (e, n, t) => (
    (e.pending_buf[e.sym_buf + e.sym_next++] = n),
    (e.pending_buf[e.sym_buf + e.sym_next++] = n >> 8),
    (e.pending_buf[e.sym_buf + e.sym_next++] = t),
    n === 0
      ? e.dyn_ltree[t * 2]++
      : (e.matches++, n--, e.dyn_ltree[(pr[t] + _r + 1) * 2]++, e.dyn_dtree[l0(n) * 2]++),
    e.sym_next === e.sym_end
  ),
  Hb = Vb,
  Xb = h0,
  Kb = $b,
  Wb = Zb,
  Yb = Gb,
  qb = { _tr_init: Hb, _tr_stored_block: Xb, _tr_flush_block: Kb, _tr_tally: Wb, _tr_align: Yb },
  Jb = (e, n, t, i) => {
    let r = (e & 65535) | 0,
      o = ((e >>> 16) & 65535) | 0,
      a = 0;
    for (; t !== 0;) {
      ((a = t > 2e3 ? 2e3 : t), (t -= a));
      do ((r = (r + n[i++]) | 0), (o = (o + r) | 0));
      while (--a);
      ((r %= 65521), (o %= 65521));
    }
    return r | (o << 16) | 0;
  },
  mr = Jb,
  Qb = () => {
    let e,
      n = [];
    for (var t = 0; t < 256; t++) {
      e = t;
      for (var i = 0; i < 8; i++) e = e & 1 ? 3988292384 ^ (e >>> 1) : e >>> 1;
      n[t] = e;
    }
    return n;
  },
  ey = new Uint32Array(Qb()),
  ty = (e, n, t, i) => {
    let r = ey,
      o = i + t;
    e ^= -1;
    for (let a = i; a < o; a++) e = (e >>> 8) ^ r[(e ^ n[a]) & 255];
    return e ^ -1;
  },
  Le = ty,
  jn = {
    2: 'need dictionary',
    1: 'stream end',
    0: '',
    '-1': 'file error',
    '-2': 'stream error',
    '-3': 'data error',
    '-4': 'insufficient memory',
    '-5': 'buffer error',
    '-6': 'incompatible version',
  },
  $n = {
    Z_NO_FLUSH: 0,
    Z_PARTIAL_FLUSH: 1,
    Z_SYNC_FLUSH: 2,
    Z_FULL_FLUSH: 3,
    Z_FINISH: 4,
    Z_BLOCK: 5,
    Z_TREES: 6,
    Z_OK: 0,
    Z_STREAM_END: 1,
    Z_NEED_DICT: 2,
    Z_ERRNO: -1,
    Z_STREAM_ERROR: -2,
    Z_DATA_ERROR: -3,
    Z_MEM_ERROR: -4,
    Z_BUF_ERROR: -5,
    Z_NO_COMPRESSION: 0,
    Z_BEST_SPEED: 1,
    Z_BEST_COMPRESSION: 9,
    Z_DEFAULT_COMPRESSION: -1,
    Z_FILTERED: 1,
    Z_HUFFMAN_ONLY: 2,
    Z_RLE: 3,
    Z_FIXED: 4,
    Z_DEFAULT_STRATEGY: 0,
    Z_BINARY: 0,
    Z_TEXT: 1,
    Z_UNKNOWN: 2,
    Z_DEFLATED: 8,
  },
  { _tr_init: ny, _tr_stored_block: Gs, _tr_flush_block: iy, _tr_tally: _n, _tr_align: ry } = qb,
  {
    Z_NO_FLUSH: vn,
    Z_PARTIAL_FLUSH: oy,
    Z_FULL_FLUSH: ay,
    Z_FINISH: gt,
    Z_BLOCK: _d,
    Z_OK: Ne,
    Z_STREAM_END: vd,
    Z_STREAM_ERROR: zt,
    Z_DATA_ERROR: sy,
    Z_BUF_ERROR: Cs,
    Z_DEFAULT_COMPRESSION: ly,
    Z_FILTERED: cy,
    Z_HUFFMAN_ONLY: Co,
    Z_RLE: fy,
    Z_FIXED: uy,
    Z_DEFAULT_STRATEGY: dy,
    Z_UNKNOWN: hy,
    Z_DEFLATED: No,
  } = $n,
  py = 9,
  gy = 15,
  my = 8,
  by = 29,
  yy = 256,
  $s = yy + 1 + by,
  wy = 30,
  _y = 19,
  vy = 2 * $s + 1,
  xy = 15,
  de = 3,
  wn = 258,
  Nt = wn + de + 1,
  Sy = 32,
  wi = 42,
  el = 57,
  Zs = 69,
  Hs = 73,
  Xs = 91,
  Ks = 103,
  zn = 113,
  sr = 666,
  He = 1,
  xi = 2,
  Vn = 3,
  Si = 4,
  ky = 3,
  Nn = (e, n) => ((e.msg = jn[n]), n),
  xd = e => e * 2 - (e > 4 ? 9 : 0),
  yn = e => {
    let n = e.length;
    for (; --n >= 0;) e[n] = 0;
  },
  Ay = e => {
    let n,
      t,
      i,
      r = e.w_size;
    ((n = e.hash_size), (i = n));
    do ((t = e.head[--i]), (e.head[i] = t >= r ? t - r : 0));
    while (--n);
    ((n = r), (i = n));
    do ((t = e.prev[--i]), (e.prev[i] = t >= r ? t - r : 0));
    while (--n);
  },
  Iy = (e, n, t) => ((n << e.hash_shift) ^ t) & e.hash_mask,
  xn = Iy,
  ot = e => {
    let n = e.state,
      t = n.pending;
    (t > e.avail_out && (t = e.avail_out),
      t !== 0 &&
        (e.output.set(n.pending_buf.subarray(n.pending_out, n.pending_out + t), e.next_out),
        (e.next_out += t),
        (n.pending_out += t),
        (e.total_out += t),
        (e.avail_out -= t),
        (n.pending -= t),
        n.pending === 0 && (n.pending_out = 0)));
  },
  at = (e, n) => {
    (iy(e, e.block_start >= 0 ? e.block_start : -1, e.strstart - e.block_start, n),
      (e.block_start = e.strstart),
      ot(e.strm));
  },
  ye = (e, n) => {
    e.pending_buf[e.pending++] = n;
  },
  ar = (e, n) => {
    ((e.pending_buf[e.pending++] = (n >>> 8) & 255), (e.pending_buf[e.pending++] = n & 255));
  },
  Ws = (e, n, t, i) => {
    let r = e.avail_in;
    return (
      r > i && (r = i),
      r === 0
        ? 0
        : ((e.avail_in -= r),
          n.set(e.input.subarray(e.next_in, e.next_in + r), t),
          e.state.wrap === 1
            ? (e.adler = mr(e.adler, n, r, t))
            : e.state.wrap === 2 && (e.adler = Le(e.adler, n, r, t)),
          (e.next_in += r),
          (e.total_in += r),
          r)
    );
  },
  p0 = (e, n) => {
    let t = e.max_chain_length,
      i = e.strstart,
      r,
      o,
      a = e.prev_length,
      s = e.nice_match,
      c = e.strstart > e.w_size - Nt ? e.strstart - (e.w_size - Nt) : 0,
      l = e.window,
      f = e.w_mask,
      d = e.prev,
      u = e.strstart + wn,
      h = l[i + a - 1],
      p = l[i + a];
    (e.prev_length >= e.good_match && (t >>= 2), s > e.lookahead && (s = e.lookahead));
    do
      if (
        ((r = n), !(l[r + a] !== p || l[r + a - 1] !== h || l[r] !== l[i] || l[++r] !== l[i + 1]))
      ) {
        ((i += 2), r++);
        do;
        while (
          l[++i] === l[++r] &&
          l[++i] === l[++r] &&
          l[++i] === l[++r] &&
          l[++i] === l[++r] &&
          l[++i] === l[++r] &&
          l[++i] === l[++r] &&
          l[++i] === l[++r] &&
          l[++i] === l[++r] &&
          i < u
        );
        if (((o = wn - (u - i)), (i = u - wn), o > a)) {
          if (((e.match_start = n), (a = o), o >= s)) break;
          ((h = l[i + a - 1]), (p = l[i + a]));
        }
      }
    while ((n = d[n & f]) > c && --t !== 0);
    return a <= e.lookahead ? a : e.lookahead;
  },
  _i = e => {
    let n = e.w_size,
      t,
      i,
      r;
    do {
      if (
        ((i = e.window_size - e.lookahead - e.strstart),
        e.strstart >= n + (n - Nt) &&
          (e.window.set(e.window.subarray(n, n + n - i), 0),
          (e.match_start -= n),
          (e.strstart -= n),
          (e.block_start -= n),
          e.insert > e.strstart && (e.insert = e.strstart),
          Ay(e),
          (i += n)),
        e.strm.avail_in === 0)
      )
        break;
      if (
        ((t = Ws(e.strm, e.window, e.strstart + e.lookahead, i)),
        (e.lookahead += t),
        e.lookahead + e.insert >= de)
      )
        for (
          r = e.strstart - e.insert,
            e.ins_h = e.window[r],
            e.ins_h = xn(e, e.ins_h, e.window[r + 1]);
          e.insert &&
          ((e.ins_h = xn(e, e.ins_h, e.window[r + de - 1])),
          (e.prev[r & e.w_mask] = e.head[e.ins_h]),
          (e.head[e.ins_h] = r),
          r++,
          e.insert--,
          !(e.lookahead + e.insert < de));
        );
    } while (e.lookahead < Nt && e.strm.avail_in !== 0);
  },
  g0 = (e, n) => {
    let t = e.pending_buf_size - 5 > e.w_size ? e.w_size : e.pending_buf_size - 5,
      i,
      r,
      o,
      a = 0,
      s = e.strm.avail_in;
    do {
      if (
        ((i = 65535),
        (o = (e.bi_valid + 42) >> 3),
        e.strm.avail_out < o ||
          ((o = e.strm.avail_out - o),
          (r = e.strstart - e.block_start),
          i > r + e.strm.avail_in && (i = r + e.strm.avail_in),
          i > o && (i = o),
          i < t && ((i === 0 && n !== gt) || n === vn || i !== r + e.strm.avail_in)))
      )
        break;
      ((a = n === gt && i === r + e.strm.avail_in ? 1 : 0),
        Gs(e, 0, 0, a),
        (e.pending_buf[e.pending - 4] = i),
        (e.pending_buf[e.pending - 3] = i >> 8),
        (e.pending_buf[e.pending - 2] = ~i),
        (e.pending_buf[e.pending - 1] = ~i >> 8),
        ot(e.strm),
        r &&
          (r > i && (r = i),
          e.strm.output.set(e.window.subarray(e.block_start, e.block_start + r), e.strm.next_out),
          (e.strm.next_out += r),
          (e.strm.avail_out -= r),
          (e.strm.total_out += r),
          (e.block_start += r),
          (i -= r)),
        i &&
          (Ws(e.strm, e.strm.output, e.strm.next_out, i),
          (e.strm.next_out += i),
          (e.strm.avail_out -= i),
          (e.strm.total_out += i)));
    } while (a === 0);
    return (
      (s -= e.strm.avail_in),
      s &&
        (s >= e.w_size
          ? ((e.matches = 2),
            e.window.set(e.strm.input.subarray(e.strm.next_in - e.w_size, e.strm.next_in), 0),
            (e.strstart = e.w_size),
            (e.insert = e.strstart))
          : (e.window_size - e.strstart <= s &&
              ((e.strstart -= e.w_size),
              e.window.set(e.window.subarray(e.w_size, e.w_size + e.strstart), 0),
              e.matches < 2 && e.matches++,
              e.insert > e.strstart && (e.insert = e.strstart)),
            e.window.set(e.strm.input.subarray(e.strm.next_in - s, e.strm.next_in), e.strstart),
            (e.strstart += s),
            (e.insert += s > e.w_size - e.insert ? e.w_size - e.insert : s)),
        (e.block_start = e.strstart)),
      e.high_water < e.strstart && (e.high_water = e.strstart),
      a
        ? Si
        : n !== vn && n !== gt && e.strm.avail_in === 0 && e.strstart === e.block_start
          ? xi
          : ((o = e.window_size - e.strstart),
            e.strm.avail_in > o &&
              e.block_start >= e.w_size &&
              ((e.block_start -= e.w_size),
              (e.strstart -= e.w_size),
              e.window.set(e.window.subarray(e.w_size, e.w_size + e.strstart), 0),
              e.matches < 2 && e.matches++,
              (o += e.w_size),
              e.insert > e.strstart && (e.insert = e.strstart)),
            o > e.strm.avail_in && (o = e.strm.avail_in),
            o &&
              (Ws(e.strm, e.window, e.strstart, o),
              (e.strstart += o),
              (e.insert += o > e.w_size - e.insert ? e.w_size - e.insert : o)),
            e.high_water < e.strstart && (e.high_water = e.strstart),
            (o = (e.bi_valid + 42) >> 3),
            (o = e.pending_buf_size - o > 65535 ? 65535 : e.pending_buf_size - o),
            (t = o > e.w_size ? e.w_size : o),
            (r = e.strstart - e.block_start),
            (r >= t || ((r || n === gt) && n !== vn && e.strm.avail_in === 0 && r <= o)) &&
              ((i = r > o ? o : r),
              (a = n === gt && e.strm.avail_in === 0 && i === r ? 1 : 0),
              Gs(e, e.block_start, i, a),
              (e.block_start += i),
              ot(e.strm)),
            a ? Vn : He)
    );
  },
  Os = (e, n) => {
    let t, i;
    for (;;) {
      if (e.lookahead < Nt) {
        if ((_i(e), e.lookahead < Nt && n === vn)) return He;
        if (e.lookahead === 0) break;
      }
      if (
        ((t = 0),
        e.lookahead >= de &&
          ((e.ins_h = xn(e, e.ins_h, e.window[e.strstart + de - 1])),
          (t = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h]),
          (e.head[e.ins_h] = e.strstart)),
        t !== 0 && e.strstart - t <= e.w_size - Nt && (e.match_length = p0(e, t)),
        e.match_length >= de)
      )
        if (
          ((i = _n(e, e.strstart - e.match_start, e.match_length - de)),
          (e.lookahead -= e.match_length),
          e.match_length <= e.max_lazy_match && e.lookahead >= de)
        ) {
          e.match_length--;
          do
            (e.strstart++,
              (e.ins_h = xn(e, e.ins_h, e.window[e.strstart + de - 1])),
              (t = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h]),
              (e.head[e.ins_h] = e.strstart));
          while (--e.match_length !== 0);
          e.strstart++;
        } else
          ((e.strstart += e.match_length),
            (e.match_length = 0),
            (e.ins_h = e.window[e.strstart]),
            (e.ins_h = xn(e, e.ins_h, e.window[e.strstart + 1])));
      else ((i = _n(e, 0, e.window[e.strstart])), e.lookahead--, e.strstart++);
      if (i && (at(e, !1), e.strm.avail_out === 0)) return He;
    }
    return (
      (e.insert = e.strstart < de - 1 ? e.strstart : de - 1),
      n === gt
        ? (at(e, !0), e.strm.avail_out === 0 ? Vn : Si)
        : e.sym_next && (at(e, !1), e.strm.avail_out === 0)
          ? He
          : xi
    );
  },
  mi = (e, n) => {
    let t, i, r;
    for (;;) {
      if (e.lookahead < Nt) {
        if ((_i(e), e.lookahead < Nt && n === vn)) return He;
        if (e.lookahead === 0) break;
      }
      if (
        ((t = 0),
        e.lookahead >= de &&
          ((e.ins_h = xn(e, e.ins_h, e.window[e.strstart + de - 1])),
          (t = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h]),
          (e.head[e.ins_h] = e.strstart)),
        (e.prev_length = e.match_length),
        (e.prev_match = e.match_start),
        (e.match_length = de - 1),
        t !== 0 &&
          e.prev_length < e.max_lazy_match &&
          e.strstart - t <= e.w_size - Nt &&
          ((e.match_length = p0(e, t)),
          e.match_length <= 5 &&
            (e.strategy === cy || (e.match_length === de && e.strstart - e.match_start > 4096)) &&
            (e.match_length = de - 1)),
        e.prev_length >= de && e.match_length <= e.prev_length)
      ) {
        ((r = e.strstart + e.lookahead - de),
          (i = _n(e, e.strstart - 1 - e.prev_match, e.prev_length - de)),
          (e.lookahead -= e.prev_length - 1),
          (e.prev_length -= 2));
        do
          ++e.strstart <= r &&
            ((e.ins_h = xn(e, e.ins_h, e.window[e.strstart + de - 1])),
            (t = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h]),
            (e.head[e.ins_h] = e.strstart));
        while (--e.prev_length !== 0);
        if (
          ((e.match_available = 0),
          (e.match_length = de - 1),
          e.strstart++,
          i && (at(e, !1), e.strm.avail_out === 0))
        )
          return He;
      } else if (e.match_available) {
        if (
          ((i = _n(e, 0, e.window[e.strstart - 1])),
          i && at(e, !1),
          e.strstart++,
          e.lookahead--,
          e.strm.avail_out === 0)
        )
          return He;
      } else ((e.match_available = 1), e.strstart++, e.lookahead--);
    }
    return (
      e.match_available && ((i = _n(e, 0, e.window[e.strstart - 1])), (e.match_available = 0)),
      (e.insert = e.strstart < de - 1 ? e.strstart : de - 1),
      n === gt
        ? (at(e, !0), e.strm.avail_out === 0 ? Vn : Si)
        : e.sym_next && (at(e, !1), e.strm.avail_out === 0)
          ? He
          : xi
    );
  },
  Fy = (e, n) => {
    let t,
      i,
      r,
      o,
      a = e.window;
    for (;;) {
      if (e.lookahead <= wn) {
        if ((_i(e), e.lookahead <= wn && n === vn)) return He;
        if (e.lookahead === 0) break;
      }
      if (
        ((e.match_length = 0),
        e.lookahead >= de &&
          e.strstart > 0 &&
          ((r = e.strstart - 1), (i = a[r]), i === a[++r] && i === a[++r] && i === a[++r]))
      ) {
        o = e.strstart + wn;
        do;
        while (
          i === a[++r] &&
          i === a[++r] &&
          i === a[++r] &&
          i === a[++r] &&
          i === a[++r] &&
          i === a[++r] &&
          i === a[++r] &&
          i === a[++r] &&
          r < o
        );
        ((e.match_length = wn - (o - r)),
          e.match_length > e.lookahead && (e.match_length = e.lookahead));
      }
      if (
        (e.match_length >= de
          ? ((t = _n(e, 1, e.match_length - de)),
            (e.lookahead -= e.match_length),
            (e.strstart += e.match_length),
            (e.match_length = 0))
          : ((t = _n(e, 0, e.window[e.strstart])), e.lookahead--, e.strstart++),
        t && (at(e, !1), e.strm.avail_out === 0))
      )
        return He;
    }
    return (
      (e.insert = 0),
      n === gt
        ? (at(e, !0), e.strm.avail_out === 0 ? Vn : Si)
        : e.sym_next && (at(e, !1), e.strm.avail_out === 0)
          ? He
          : xi
    );
  },
  Ey = (e, n) => {
    let t;
    for (;;) {
      if (e.lookahead === 0 && (_i(e), e.lookahead === 0)) {
        if (n === vn) return He;
        break;
      }
      if (
        ((e.match_length = 0),
        (t = _n(e, 0, e.window[e.strstart])),
        e.lookahead--,
        e.strstart++,
        t && (at(e, !1), e.strm.avail_out === 0))
      )
        return He;
    }
    return (
      (e.insert = 0),
      n === gt
        ? (at(e, !0), e.strm.avail_out === 0 ? Vn : Si)
        : e.sym_next && (at(e, !1), e.strm.avail_out === 0)
          ? He
          : xi
    );
  };
function Rt(e, n, t, i, r) {
  ((this.good_length = e),
    (this.max_lazy = n),
    (this.nice_length = t),
    (this.max_chain = i),
    (this.func = r));
}
var lr = [
    new Rt(0, 0, 0, 0, g0),
    new Rt(4, 4, 8, 4, Os),
    new Rt(4, 5, 16, 8, Os),
    new Rt(4, 6, 32, 32, Os),
    new Rt(4, 4, 16, 16, mi),
    new Rt(8, 16, 32, 32, mi),
    new Rt(8, 16, 128, 128, mi),
    new Rt(8, 32, 128, 256, mi),
    new Rt(32, 128, 258, 1024, mi),
    new Rt(32, 258, 258, 4096, mi),
  ],
  Dy = e => {
    ((e.window_size = 2 * e.w_size),
      yn(e.head),
      (e.max_lazy_match = lr[e.level].max_lazy),
      (e.good_match = lr[e.level].good_length),
      (e.nice_match = lr[e.level].nice_length),
      (e.max_chain_length = lr[e.level].max_chain),
      (e.strstart = 0),
      (e.block_start = 0),
      (e.lookahead = 0),
      (e.insert = 0),
      (e.match_length = e.prev_length = de - 1),
      (e.match_available = 0),
      (e.ins_h = 0));
  };
function My() {
  ((this.strm = null),
    (this.status = 0),
    (this.pending_buf = null),
    (this.pending_buf_size = 0),
    (this.pending_out = 0),
    (this.pending = 0),
    (this.wrap = 0),
    (this.gzhead = null),
    (this.gzindex = 0),
    (this.method = No),
    (this.last_flush = -1),
    (this.w_size = 0),
    (this.w_bits = 0),
    (this.w_mask = 0),
    (this.window = null),
    (this.window_size = 0),
    (this.prev = null),
    (this.head = null),
    (this.ins_h = 0),
    (this.hash_size = 0),
    (this.hash_bits = 0),
    (this.hash_mask = 0),
    (this.hash_shift = 0),
    (this.block_start = 0),
    (this.match_length = 0),
    (this.prev_match = 0),
    (this.match_available = 0),
    (this.strstart = 0),
    (this.match_start = 0),
    (this.lookahead = 0),
    (this.prev_length = 0),
    (this.max_chain_length = 0),
    (this.max_lazy_match = 0),
    (this.level = 0),
    (this.strategy = 0),
    (this.good_match = 0),
    (this.nice_match = 0),
    (this.dyn_ltree = new Uint16Array(vy * 2)),
    (this.dyn_dtree = new Uint16Array((2 * wy + 1) * 2)),
    (this.bl_tree = new Uint16Array((2 * _y + 1) * 2)),
    yn(this.dyn_ltree),
    yn(this.dyn_dtree),
    yn(this.bl_tree),
    (this.l_desc = null),
    (this.d_desc = null),
    (this.bl_desc = null),
    (this.bl_count = new Uint16Array(xy + 1)),
    (this.heap = new Uint16Array(2 * $s + 1)),
    yn(this.heap),
    (this.heap_len = 0),
    (this.heap_max = 0),
    (this.depth = new Uint16Array(2 * $s + 1)),
    yn(this.depth),
    (this.sym_buf = 0),
    (this.lit_bufsize = 0),
    (this.sym_next = 0),
    (this.sym_end = 0),
    (this.opt_len = 0),
    (this.static_len = 0),
    (this.matches = 0),
    (this.insert = 0),
    (this.bi_buf = 0),
    (this.bi_valid = 0));
}
var vr = e => {
    if (!e) return 1;
    let n = e.state;
    return !n ||
      n.strm !== e ||
      (n.status !== wi &&
        n.status !== el &&
        n.status !== Zs &&
        n.status !== Hs &&
        n.status !== Xs &&
        n.status !== Ks &&
        n.status !== zn &&
        n.status !== sr)
      ? 1
      : 0;
  },
  m0 = e => {
    if (vr(e)) return Nn(e, zt);
    ((e.total_in = e.total_out = 0), (e.data_type = hy));
    let n = e.state;
    return (
      (n.pending = 0),
      (n.pending_out = 0),
      n.wrap < 0 && (n.wrap = -n.wrap),
      (n.status = n.wrap === 2 ? el : n.wrap ? wi : zn),
      (e.adler = n.wrap === 2 ? 0 : 1),
      (n.last_flush = -2),
      ny(n),
      Ne
    );
  },
  b0 = e => {
    let n = m0(e);
    return (n === Ne && Dy(e.state), n);
  },
  Cy = (e, n) => (vr(e) || e.state.wrap !== 2 ? zt : ((e.state.gzhead = n), Ne)),
  y0 = (e, n, t, i, r, o) => {
    if (!e) return zt;
    let a = 1;
    if (
      (n === ly && (n = 6),
      i < 0 ? ((a = 0), (i = -i)) : i > 15 && ((a = 2), (i -= 16)),
      r < 1 ||
        r > py ||
        t !== No ||
        i < 8 ||
        i > 15 ||
        n < 0 ||
        n > 9 ||
        o < 0 ||
        o > uy ||
        (i === 8 && a !== 1))
    )
      return Nn(e, zt);
    i === 8 && (i = 9);
    let s = new My();
    return (
      (e.state = s),
      (s.strm = e),
      (s.status = wi),
      (s.wrap = a),
      (s.gzhead = null),
      (s.w_bits = i),
      (s.w_size = 1 << s.w_bits),
      (s.w_mask = s.w_size - 1),
      (s.hash_bits = r + 7),
      (s.hash_size = 1 << s.hash_bits),
      (s.hash_mask = s.hash_size - 1),
      (s.hash_shift = ~~((s.hash_bits + de - 1) / de)),
      (s.window = new Uint8Array(s.w_size * 2)),
      (s.head = new Uint16Array(s.hash_size)),
      (s.prev = new Uint16Array(s.w_size)),
      (s.lit_bufsize = 1 << (r + 6)),
      (s.pending_buf_size = s.lit_bufsize * 4),
      (s.pending_buf = new Uint8Array(s.pending_buf_size)),
      (s.sym_buf = s.lit_bufsize),
      (s.sym_end = (s.lit_bufsize - 1) * 3),
      (s.level = n),
      (s.strategy = o),
      (s.method = t),
      b0(e)
    );
  },
  Oy = (e, n) => y0(e, n, No, gy, my, dy),
  Ly = (e, n) => {
    if (vr(e) || n > _d || n < 0) return e ? Nn(e, zt) : zt;
    let t = e.state;
    if (!e.output || (e.avail_in !== 0 && !e.input) || (t.status === sr && n !== gt))
      return Nn(e, e.avail_out === 0 ? Cs : zt);
    let i = t.last_flush;
    if (((t.last_flush = n), t.pending !== 0)) {
      if ((ot(e), e.avail_out === 0)) return ((t.last_flush = -1), Ne);
    } else if (e.avail_in === 0 && xd(n) <= xd(i) && n !== gt) return Nn(e, Cs);
    if (t.status === sr && e.avail_in !== 0) return Nn(e, Cs);
    if ((t.status === wi && t.wrap === 0 && (t.status = zn), t.status === wi)) {
      let r = (No + ((t.w_bits - 8) << 4)) << 8,
        o = -1;
      if (
        (t.strategy >= Co || t.level < 2
          ? (o = 0)
          : t.level < 6
            ? (o = 1)
            : t.level === 6
              ? (o = 2)
              : (o = 3),
        (r |= o << 6),
        t.strstart !== 0 && (r |= Sy),
        (r += 31 - (r % 31)),
        ar(t, r),
        t.strstart !== 0 && (ar(t, e.adler >>> 16), ar(t, e.adler & 65535)),
        (e.adler = 1),
        (t.status = zn),
        ot(e),
        t.pending !== 0)
      )
        return ((t.last_flush = -1), Ne);
    }
    if (t.status === el) {
      if (((e.adler = 0), ye(t, 31), ye(t, 139), ye(t, 8), t.gzhead))
        (ye(
          t,
          (t.gzhead.text ? 1 : 0) +
            (t.gzhead.hcrc ? 2 : 0) +
            (t.gzhead.extra ? 4 : 0) +
            (t.gzhead.name ? 8 : 0) +
            (t.gzhead.comment ? 16 : 0)
        ),
          ye(t, t.gzhead.time & 255),
          ye(t, (t.gzhead.time >> 8) & 255),
          ye(t, (t.gzhead.time >> 16) & 255),
          ye(t, (t.gzhead.time >> 24) & 255),
          ye(t, t.level === 9 ? 2 : t.strategy >= Co || t.level < 2 ? 4 : 0),
          ye(t, t.gzhead.os & 255),
          t.gzhead.extra &&
            t.gzhead.extra.length &&
            (ye(t, t.gzhead.extra.length & 255), ye(t, (t.gzhead.extra.length >> 8) & 255)),
          t.gzhead.hcrc && (e.adler = Le(e.adler, t.pending_buf, t.pending, 0)),
          (t.gzindex = 0),
          (t.status = Zs));
      else if (
        (ye(t, 0),
        ye(t, 0),
        ye(t, 0),
        ye(t, 0),
        ye(t, 0),
        ye(t, t.level === 9 ? 2 : t.strategy >= Co || t.level < 2 ? 4 : 0),
        ye(t, ky),
        (t.status = zn),
        ot(e),
        t.pending !== 0)
      )
        return ((t.last_flush = -1), Ne);
    }
    if (t.status === Zs) {
      if (t.gzhead.extra) {
        let r = t.pending,
          o = (t.gzhead.extra.length & 65535) - t.gzindex;
        for (; t.pending + o > t.pending_buf_size;) {
          let s = t.pending_buf_size - t.pending;
          if (
            (t.pending_buf.set(t.gzhead.extra.subarray(t.gzindex, t.gzindex + s), t.pending),
            (t.pending = t.pending_buf_size),
            t.gzhead.hcrc &&
              t.pending > r &&
              (e.adler = Le(e.adler, t.pending_buf, t.pending - r, r)),
            (t.gzindex += s),
            ot(e),
            t.pending !== 0)
          )
            return ((t.last_flush = -1), Ne);
          ((r = 0), (o -= s));
        }
        let a = new Uint8Array(t.gzhead.extra);
        (t.pending_buf.set(a.subarray(t.gzindex, t.gzindex + o), t.pending),
          (t.pending += o),
          t.gzhead.hcrc &&
            t.pending > r &&
            (e.adler = Le(e.adler, t.pending_buf, t.pending - r, r)),
          (t.gzindex = 0));
      }
      t.status = Hs;
    }
    if (t.status === Hs) {
      if (t.gzhead.name) {
        let r = t.pending,
          o;
        do {
          if (t.pending === t.pending_buf_size) {
            if (
              (t.gzhead.hcrc &&
                t.pending > r &&
                (e.adler = Le(e.adler, t.pending_buf, t.pending - r, r)),
              ot(e),
              t.pending !== 0)
            )
              return ((t.last_flush = -1), Ne);
            r = 0;
          }
          (t.gzindex < t.gzhead.name.length
            ? (o = t.gzhead.name.charCodeAt(t.gzindex++) & 255)
            : (o = 0),
            ye(t, o));
        } while (o !== 0);
        (t.gzhead.hcrc && t.pending > r && (e.adler = Le(e.adler, t.pending_buf, t.pending - r, r)),
          (t.gzindex = 0));
      }
      t.status = Xs;
    }
    if (t.status === Xs) {
      if (t.gzhead.comment) {
        let r = t.pending,
          o;
        do {
          if (t.pending === t.pending_buf_size) {
            if (
              (t.gzhead.hcrc &&
                t.pending > r &&
                (e.adler = Le(e.adler, t.pending_buf, t.pending - r, r)),
              ot(e),
              t.pending !== 0)
            )
              return ((t.last_flush = -1), Ne);
            r = 0;
          }
          (t.gzindex < t.gzhead.comment.length
            ? (o = t.gzhead.comment.charCodeAt(t.gzindex++) & 255)
            : (o = 0),
            ye(t, o));
        } while (o !== 0);
        t.gzhead.hcrc && t.pending > r && (e.adler = Le(e.adler, t.pending_buf, t.pending - r, r));
      }
      t.status = Ks;
    }
    if (t.status === Ks) {
      if (t.gzhead.hcrc) {
        if (t.pending + 2 > t.pending_buf_size && (ot(e), t.pending !== 0))
          return ((t.last_flush = -1), Ne);
        (ye(t, e.adler & 255), ye(t, (e.adler >> 8) & 255), (e.adler = 0));
      }
      if (((t.status = zn), ot(e), t.pending !== 0)) return ((t.last_flush = -1), Ne);
    }
    if (e.avail_in !== 0 || t.lookahead !== 0 || (n !== vn && t.status !== sr)) {
      let r =
        t.level === 0
          ? g0(t, n)
          : t.strategy === Co
            ? Ey(t, n)
            : t.strategy === fy
              ? Fy(t, n)
              : lr[t.level].func(t, n);
      if (((r === Vn || r === Si) && (t.status = sr), r === He || r === Vn))
        return (e.avail_out === 0 && (t.last_flush = -1), Ne);
      if (
        r === xi &&
        (n === oy
          ? ry(t)
          : n !== _d &&
            (Gs(t, 0, 0, !1),
            n === ay &&
              (yn(t.head),
              t.lookahead === 0 && ((t.strstart = 0), (t.block_start = 0), (t.insert = 0)))),
        ot(e),
        e.avail_out === 0)
      )
        return ((t.last_flush = -1), Ne);
    }
    return n !== gt
      ? Ne
      : t.wrap <= 0
        ? vd
        : (t.wrap === 2
            ? (ye(t, e.adler & 255),
              ye(t, (e.adler >> 8) & 255),
              ye(t, (e.adler >> 16) & 255),
              ye(t, (e.adler >> 24) & 255),
              ye(t, e.total_in & 255),
              ye(t, (e.total_in >> 8) & 255),
              ye(t, (e.total_in >> 16) & 255),
              ye(t, (e.total_in >> 24) & 255))
            : (ar(t, e.adler >>> 16), ar(t, e.adler & 65535)),
          ot(e),
          t.wrap > 0 && (t.wrap = -t.wrap),
          t.pending !== 0 ? Ne : vd);
  },
  Uy = e => {
    if (vr(e)) return zt;
    let n = e.state.status;
    return ((e.state = null), n === zn ? Nn(e, sy) : Ne);
  },
  Py = (e, n) => {
    let t = n.length;
    if (vr(e)) return zt;
    let i = e.state,
      r = i.wrap;
    if (r === 2 || (r === 1 && i.status !== wi) || i.lookahead) return zt;
    if ((r === 1 && (e.adler = mr(e.adler, n, t, 0)), (i.wrap = 0), t >= i.w_size)) {
      r === 0 && (yn(i.head), (i.strstart = 0), (i.block_start = 0), (i.insert = 0));
      let c = new Uint8Array(i.w_size);
      (c.set(n.subarray(t - i.w_size, t), 0), (n = c), (t = i.w_size));
    }
    let o = e.avail_in,
      a = e.next_in,
      s = e.input;
    for (e.avail_in = t, e.next_in = 0, e.input = n, _i(i); i.lookahead >= de;) {
      let c = i.strstart,
        l = i.lookahead - (de - 1);
      do
        ((i.ins_h = xn(i, i.ins_h, i.window[c + de - 1])),
          (i.prev[c & i.w_mask] = i.head[i.ins_h]),
          (i.head[i.ins_h] = c),
          c++);
      while (--l);
      ((i.strstart = c), (i.lookahead = de - 1), _i(i));
    }
    return (
      (i.strstart += i.lookahead),
      (i.block_start = i.strstart),
      (i.insert = i.lookahead),
      (i.lookahead = 0),
      (i.match_length = i.prev_length = de - 1),
      (i.match_available = 0),
      (e.next_in = a),
      (e.input = s),
      (e.avail_in = o),
      (i.wrap = r),
      Ne
    );
  },
  Ty = Oy,
  Ry = y0,
  By = b0,
  zy = m0,
  Ny = Cy,
  jy = Ly,
  Vy = Uy,
  Gy = Py,
  $y = 'pako deflate (from Nodeca project)',
  fr = {
    deflateInit: Ty,
    deflateInit2: Ry,
    deflateReset: By,
    deflateResetKeep: zy,
    deflateSetHeader: Ny,
    deflate: jy,
    deflateEnd: Vy,
    deflateSetDictionary: Gy,
    deflateInfo: $y,
  },
  Zy = (e, n) => Object.prototype.hasOwnProperty.call(e, n),
  Hy = function (e) {
    let n = Array.prototype.slice.call(arguments, 1);
    for (; n.length;) {
      let t = n.shift();
      if (t) {
        if (typeof t != 'object') throw new TypeError(t + 'must be non-object');
        for (let i in t) Zy(t, i) && (e[i] = t[i]);
      }
    }
    return e;
  },
  Xy = e => {
    let n = 0;
    for (let i = 0, r = e.length; i < r; i++) n += e[i].length;
    let t = new Uint8Array(n);
    for (let i = 0, r = 0, o = e.length; i < o; i++) {
      let a = e[i];
      (t.set(a, r), (r += a.length));
    }
    return t;
  },
  jo = { assign: Hy, flattenChunks: Xy },
  w0 = !0;
try {
  String.fromCharCode.apply(null, new Uint8Array(1));
} catch {
  w0 = !1;
}
var br = new Uint8Array(256);
for (let e = 0; e < 256; e++)
  br[e] = e >= 252 ? 6 : e >= 248 ? 5 : e >= 240 ? 4 : e >= 224 ? 3 : e >= 192 ? 2 : 1;
br[254] = br[254] = 1;
var Ky = e => {
    if (typeof TextEncoder == 'function' && TextEncoder.prototype.encode)
      return new TextEncoder().encode(e);
    let n,
      t,
      i,
      r,
      o,
      a = e.length,
      s = 0;
    for (r = 0; r < a; r++)
      ((t = e.charCodeAt(r)),
        (t & 64512) === 55296 &&
          r + 1 < a &&
          ((i = e.charCodeAt(r + 1)),
          (i & 64512) === 56320 && ((t = 65536 + ((t - 55296) << 10) + (i - 56320)), r++)),
        (s += t < 128 ? 1 : t < 2048 ? 2 : t < 65536 ? 3 : 4));
    for (n = new Uint8Array(s), o = 0, r = 0; o < s; r++)
      ((t = e.charCodeAt(r)),
        (t & 64512) === 55296 &&
          r + 1 < a &&
          ((i = e.charCodeAt(r + 1)),
          (i & 64512) === 56320 && ((t = 65536 + ((t - 55296) << 10) + (i - 56320)), r++)),
        t < 128
          ? (n[o++] = t)
          : t < 2048
            ? ((n[o++] = 192 | (t >>> 6)), (n[o++] = 128 | (t & 63)))
            : t < 65536
              ? ((n[o++] = 224 | (t >>> 12)),
                (n[o++] = 128 | ((t >>> 6) & 63)),
                (n[o++] = 128 | (t & 63)))
              : ((n[o++] = 240 | (t >>> 18)),
                (n[o++] = 128 | ((t >>> 12) & 63)),
                (n[o++] = 128 | ((t >>> 6) & 63)),
                (n[o++] = 128 | (t & 63))));
    return n;
  },
  Wy = (e, n) => {
    if (n < 65534 && e.subarray && w0)
      return String.fromCharCode.apply(null, e.length === n ? e : e.subarray(0, n));
    let t = '';
    for (let i = 0; i < n; i++) t += String.fromCharCode(e[i]);
    return t;
  },
  Yy = (e, n) => {
    let t = n || e.length;
    if (typeof TextDecoder == 'function' && TextDecoder.prototype.decode)
      return new TextDecoder().decode(e.subarray(0, n));
    let i,
      r,
      o = new Array(t * 2);
    for (r = 0, i = 0; i < t;) {
      let a = e[i++];
      if (a < 128) {
        o[r++] = a;
        continue;
      }
      let s = br[a];
      if (s > 4) {
        ((o[r++] = 65533), (i += s - 1));
        continue;
      }
      for (a &= s === 2 ? 31 : s === 3 ? 15 : 7; s > 1 && i < t;)
        ((a = (a << 6) | (e[i++] & 63)), s--);
      if (s > 1) {
        o[r++] = 65533;
        continue;
      }
      a < 65536
        ? (o[r++] = a)
        : ((a -= 65536), (o[r++] = 55296 | ((a >> 10) & 1023)), (o[r++] = 56320 | (a & 1023)));
    }
    return Wy(o, r);
  },
  qy = (e, n) => {
    ((n = n || e.length), n > e.length && (n = e.length));
    let t = n - 1;
    for (; t >= 0 && (e[t] & 192) === 128;) t--;
    return t < 0 || t === 0 ? n : t + br[e[t]] > n ? t : n;
  },
  yr = { string2buf: Ky, buf2string: Yy, utf8border: qy };
function Jy() {
  ((this.input = null),
    (this.next_in = 0),
    (this.avail_in = 0),
    (this.total_in = 0),
    (this.output = null),
    (this.next_out = 0),
    (this.avail_out = 0),
    (this.total_out = 0),
    (this.msg = ''),
    (this.state = null),
    (this.data_type = 2),
    (this.adler = 0));
}
var _0 = Jy,
  v0 = Object.prototype.toString,
  {
    Z_NO_FLUSH: Qy,
    Z_SYNC_FLUSH: ew,
    Z_FULL_FLUSH: tw,
    Z_FINISH: nw,
    Z_OK: Bo,
    Z_STREAM_END: iw,
    Z_DEFAULT_COMPRESSION: rw,
    Z_DEFAULT_STRATEGY: ow,
    Z_DEFLATED: aw,
  } = $n;
function xr(e) {
  this.options = jo.assign(
    { level: rw, method: aw, chunkSize: 16384, windowBits: 15, memLevel: 8, strategy: ow },
    e || {}
  );
  let n = this.options;
  (n.raw && n.windowBits > 0
    ? (n.windowBits = -n.windowBits)
    : n.gzip && n.windowBits > 0 && n.windowBits < 16 && (n.windowBits += 16),
    (this.err = 0),
    (this.msg = ''),
    (this.ended = !1),
    (this.chunks = []),
    (this.strm = new _0()),
    (this.strm.avail_out = 0));
  let t = fr.deflateInit2(this.strm, n.level, n.method, n.windowBits, n.memLevel, n.strategy);
  if (t !== Bo) throw new Error(jn[t]);
  if ((n.header && fr.deflateSetHeader(this.strm, n.header), n.dictionary)) {
    let i;
    if (
      (typeof n.dictionary == 'string'
        ? (i = yr.string2buf(n.dictionary))
        : v0.call(n.dictionary) === '[object ArrayBuffer]'
          ? (i = new Uint8Array(n.dictionary))
          : (i = n.dictionary),
      (t = fr.deflateSetDictionary(this.strm, i)),
      t !== Bo)
    )
      throw new Error(jn[t]);
    this._dict_set = !0;
  }
}
xr.prototype.push = function (e, n) {
  let t = this.strm,
    i = this.options.chunkSize,
    r,
    o;
  if (this.ended) return !1;
  for (
    n === ~~n ? (o = n) : (o = n === !0 ? nw : Qy),
      typeof e == 'string'
        ? (t.input = yr.string2buf(e))
        : v0.call(e) === '[object ArrayBuffer]'
          ? (t.input = new Uint8Array(e))
          : (t.input = e),
      t.next_in = 0,
      t.avail_in = t.input.length;
    ;
  ) {
    if (
      (t.avail_out === 0 && ((t.output = new Uint8Array(i)), (t.next_out = 0), (t.avail_out = i)),
      (o === ew || o === tw) && t.avail_out <= 6)
    ) {
      (this.onData(t.output.subarray(0, t.next_out)), (t.avail_out = 0));
      continue;
    }
    if (((r = fr.deflate(t, o)), r === iw))
      return (
        t.next_out > 0 && this.onData(t.output.subarray(0, t.next_out)),
        (r = fr.deflateEnd(this.strm)),
        this.onEnd(r),
        (this.ended = !0),
        r === Bo
      );
    if (t.avail_out === 0) {
      this.onData(t.output);
      continue;
    }
    if (o > 0 && t.next_out > 0) {
      (this.onData(t.output.subarray(0, t.next_out)), (t.avail_out = 0));
      continue;
    }
    if (t.avail_in === 0) break;
  }
  return !0;
};
xr.prototype.onData = function (e) {
  this.chunks.push(e);
};
xr.prototype.onEnd = function (e) {
  (e === Bo && (this.result = jo.flattenChunks(this.chunks)),
    (this.chunks = []),
    (this.err = e),
    (this.msg = this.strm.msg));
};
function tl(e, n) {
  let t = new xr(n);
  if ((t.push(e, !0), t.err)) throw t.msg || jn[t.err];
  return t.result;
}
function sw(e, n) {
  return ((n = n || {}), (n.raw = !0), tl(e, n));
}
function lw(e, n) {
  return ((n = n || {}), (n.gzip = !0), tl(e, n));
}
var cw = xr,
  fw = tl,
  uw = sw,
  dw = lw,
  hw = $n,
  pw = { Deflate: cw, deflate: fw, deflateRaw: uw, gzip: dw, constants: hw },
  Oo = 16209,
  gw = 16191,
  mw = function (n, t) {
    let i,
      r,
      o,
      a,
      s,
      c,
      l,
      f,
      d,
      u,
      h,
      p,
      _,
      b,
      g,
      y,
      w,
      m,
      A,
      M,
      k,
      E,
      F,
      I,
      C = n.state;
    ((i = n.next_in),
      (F = n.input),
      (r = i + (n.avail_in - 5)),
      (o = n.next_out),
      (I = n.output),
      (a = o - (t - n.avail_out)),
      (s = o + (n.avail_out - 257)),
      (c = C.dmax),
      (l = C.wsize),
      (f = C.whave),
      (d = C.wnext),
      (u = C.window),
      (h = C.hold),
      (p = C.bits),
      (_ = C.lencode),
      (b = C.distcode),
      (g = (1 << C.lenbits) - 1),
      (y = (1 << C.distbits) - 1));
    e: do {
      (p < 15 && ((h += F[i++] << p), (p += 8), (h += F[i++] << p), (p += 8)), (w = _[h & g]));
      t: for (;;) {
        if (((m = w >>> 24), (h >>>= m), (p -= m), (m = (w >>> 16) & 255), m === 0))
          I[o++] = w & 65535;
        else if (m & 16) {
          ((A = w & 65535),
            (m &= 15),
            m &&
              (p < m && ((h += F[i++] << p), (p += 8)),
              (A += h & ((1 << m) - 1)),
              (h >>>= m),
              (p -= m)),
            p < 15 && ((h += F[i++] << p), (p += 8), (h += F[i++] << p), (p += 8)),
            (w = b[h & y]));
          n: for (;;) {
            if (((m = w >>> 24), (h >>>= m), (p -= m), (m = (w >>> 16) & 255), m & 16)) {
              if (
                ((M = w & 65535),
                (m &= 15),
                p < m && ((h += F[i++] << p), (p += 8), p < m && ((h += F[i++] << p), (p += 8))),
                (M += h & ((1 << m) - 1)),
                M > c)
              ) {
                ((n.msg = 'invalid distance too far back'), (C.mode = Oo));
                break e;
              }
              if (((h >>>= m), (p -= m), (m = o - a), M > m)) {
                if (((m = M - m), m > f && C.sane)) {
                  ((n.msg = 'invalid distance too far back'), (C.mode = Oo));
                  break e;
                }
                if (((k = 0), (E = u), d === 0)) {
                  if (((k += l - m), m < A)) {
                    A -= m;
                    do I[o++] = u[k++];
                    while (--m);
                    ((k = o - M), (E = I));
                  }
                } else if (d < m) {
                  if (((k += l + d - m), (m -= d), m < A)) {
                    A -= m;
                    do I[o++] = u[k++];
                    while (--m);
                    if (((k = 0), d < A)) {
                      ((m = d), (A -= m));
                      do I[o++] = u[k++];
                      while (--m);
                      ((k = o - M), (E = I));
                    }
                  }
                } else if (((k += d - m), m < A)) {
                  A -= m;
                  do I[o++] = u[k++];
                  while (--m);
                  ((k = o - M), (E = I));
                }
                for (; A > 2;) ((I[o++] = E[k++]), (I[o++] = E[k++]), (I[o++] = E[k++]), (A -= 3));
                A && ((I[o++] = E[k++]), A > 1 && (I[o++] = E[k++]));
              } else {
                k = o - M;
                do ((I[o++] = I[k++]), (I[o++] = I[k++]), (I[o++] = I[k++]), (A -= 3));
                while (A > 2);
                A && ((I[o++] = I[k++]), A > 1 && (I[o++] = I[k++]));
              }
            } else if ((m & 64) === 0) {
              w = b[(w & 65535) + (h & ((1 << m) - 1))];
              continue n;
            } else {
              ((n.msg = 'invalid distance code'), (C.mode = Oo));
              break e;
            }
            break;
          }
        } else if ((m & 64) === 0) {
          w = _[(w & 65535) + (h & ((1 << m) - 1))];
          continue t;
        } else if (m & 32) {
          C.mode = gw;
          break e;
        } else {
          ((n.msg = 'invalid literal/length code'), (C.mode = Oo));
          break e;
        }
        break;
      }
    } while (i < r && o < s);
    ((A = p >> 3),
      (i -= A),
      (p -= A << 3),
      (h &= (1 << p) - 1),
      (n.next_in = i),
      (n.next_out = o),
      (n.avail_in = i < r ? 5 + (r - i) : 5 - (i - r)),
      (n.avail_out = o < s ? 257 + (s - o) : 257 - (o - s)),
      (C.hold = h),
      (C.bits = p));
  },
  bi = 15,
  Sd = 852,
  kd = 592,
  Ad = 0,
  Ls = 1,
  Id = 2,
  bw = new Uint16Array([
    3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
    163, 195, 227, 258, 0, 0,
  ]),
  yw = new Uint8Array([
    16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19, 19, 20, 20, 20, 20,
    21, 21, 21, 21, 16, 72, 78,
  ]),
  ww = new Uint16Array([
    1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049,
    3073, 4097, 6145, 8193, 12289, 16385, 24577, 0, 0,
  ]),
  _w = new Uint8Array([
    16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25, 25, 26, 26,
    27, 27, 28, 28, 29, 29, 64, 64,
  ]),
  vw = (e, n, t, i, r, o, a, s) => {
    let c = s.bits,
      l = 0,
      f = 0,
      d = 0,
      u = 0,
      h = 0,
      p = 0,
      _ = 0,
      b = 0,
      g = 0,
      y = 0,
      w,
      m,
      A,
      M,
      k,
      E = null,
      F,
      I = new Uint16Array(bi + 1),
      C = new Uint16Array(bi + 1),
      B = null,
      ee,
      $,
      U;
    for (l = 0; l <= bi; l++) I[l] = 0;
    for (f = 0; f < i; f++) I[n[t + f]]++;
    for (h = c, u = bi; u >= 1 && I[u] === 0; u--);
    if ((h > u && (h = u), u === 0))
      return (
        (r[o++] = (1 << 24) | (64 << 16) | 0),
        (r[o++] = (1 << 24) | (64 << 16) | 0),
        (s.bits = 1),
        0
      );
    for (d = 1; d < u && I[d] === 0; d++);
    for (h < d && (h = d), b = 1, l = 1; l <= bi; l++)
      if (((b <<= 1), (b -= I[l]), b < 0)) return -1;
    if (b > 0 && (e === Ad || u !== 1)) return -1;
    for (C[1] = 0, l = 1; l < bi; l++) C[l + 1] = C[l] + I[l];
    for (f = 0; f < i; f++) n[t + f] !== 0 && (a[C[n[t + f]]++] = f);
    if (
      (e === Ad
        ? ((E = B = a), (F = 20))
        : e === Ls
          ? ((E = bw), (B = yw), (F = 257))
          : ((E = ww), (B = _w), (F = 0)),
      (y = 0),
      (f = 0),
      (l = d),
      (k = o),
      (p = h),
      (_ = 0),
      (A = -1),
      (g = 1 << h),
      (M = g - 1),
      (e === Ls && g > Sd) || (e === Id && g > kd))
    )
      return 1;
    for (;;) {
      ((ee = l - _),
        a[f] + 1 < F
          ? (($ = 0), (U = a[f]))
          : a[f] >= F
            ? (($ = B[a[f] - F]), (U = E[a[f] - F]))
            : (($ = 96), (U = 0)),
        (w = 1 << (l - _)),
        (m = 1 << p),
        (d = m));
      do ((m -= w), (r[k + (y >> _) + m] = (ee << 24) | ($ << 16) | U | 0));
      while (m !== 0);
      for (w = 1 << (l - 1); y & w;) w >>= 1;
      if ((w !== 0 ? ((y &= w - 1), (y += w)) : (y = 0), f++, --I[l] === 0)) {
        if (l === u) break;
        l = n[t + a[f]];
      }
      if (l > h && (y & M) !== A) {
        for (
          _ === 0 && (_ = h), k += d, p = l - _, b = 1 << p;
          p + _ < u && ((b -= I[p + _]), !(b <= 0));
        )
          (p++, (b <<= 1));
        if (((g += 1 << p), (e === Ls && g > Sd) || (e === Id && g > kd))) return 1;
        ((A = y & M), (r[A] = (h << 24) | (p << 16) | (k - o) | 0));
      }
    }
    return (y !== 0 && (r[k + y] = ((l - _) << 24) | (64 << 16) | 0), (s.bits = h), 0);
  },
  ur = vw,
  xw = 0,
  x0 = 1,
  S0 = 2,
  {
    Z_FINISH: Fd,
    Z_BLOCK: Sw,
    Z_TREES: Lo,
    Z_OK: Gn,
    Z_STREAM_END: kw,
    Z_NEED_DICT: Aw,
    Z_STREAM_ERROR: mt,
    Z_DATA_ERROR: k0,
    Z_MEM_ERROR: A0,
    Z_BUF_ERROR: Iw,
    Z_DEFLATED: Ed,
  } = $n,
  Vo = 16180,
  Dd = 16181,
  Md = 16182,
  Cd = 16183,
  Od = 16184,
  Ld = 16185,
  Ud = 16186,
  Pd = 16187,
  Td = 16188,
  Rd = 16189,
  zo = 16190,
  Qt = 16191,
  Us = 16192,
  Bd = 16193,
  Ps = 16194,
  zd = 16195,
  Nd = 16196,
  jd = 16197,
  Vd = 16198,
  Uo = 16199,
  Po = 16200,
  Gd = 16201,
  $d = 16202,
  Zd = 16203,
  Hd = 16204,
  Xd = 16205,
  Ts = 16206,
  Kd = 16207,
  Wd = 16208,
  Fe = 16209,
  I0 = 16210,
  F0 = 16211,
  Fw = 852,
  Ew = 592,
  Dw = 15,
  Mw = Dw,
  Yd = e => ((e >>> 24) & 255) + ((e >>> 8) & 65280) + ((e & 65280) << 8) + ((e & 255) << 24);
function Cw() {
  ((this.strm = null),
    (this.mode = 0),
    (this.last = !1),
    (this.wrap = 0),
    (this.havedict = !1),
    (this.flags = 0),
    (this.dmax = 0),
    (this.check = 0),
    (this.total = 0),
    (this.head = null),
    (this.wbits = 0),
    (this.wsize = 0),
    (this.whave = 0),
    (this.wnext = 0),
    (this.window = null),
    (this.hold = 0),
    (this.bits = 0),
    (this.length = 0),
    (this.offset = 0),
    (this.extra = 0),
    (this.lencode = null),
    (this.distcode = null),
    (this.lenbits = 0),
    (this.distbits = 0),
    (this.ncode = 0),
    (this.nlen = 0),
    (this.ndist = 0),
    (this.have = 0),
    (this.next = null),
    (this.lens = new Uint16Array(320)),
    (this.work = new Uint16Array(288)),
    (this.lendyn = null),
    (this.distdyn = null),
    (this.sane = 0),
    (this.back = 0),
    (this.was = 0));
}
var Zn = e => {
    if (!e) return 1;
    let n = e.state;
    return !n || n.strm !== e || n.mode < Vo || n.mode > F0 ? 1 : 0;
  },
  E0 = e => {
    if (Zn(e)) return mt;
    let n = e.state;
    return (
      (e.total_in = e.total_out = n.total = 0),
      (e.msg = ''),
      n.wrap && (e.adler = n.wrap & 1),
      (n.mode = Vo),
      (n.last = 0),
      (n.havedict = 0),
      (n.flags = -1),
      (n.dmax = 32768),
      (n.head = null),
      (n.hold = 0),
      (n.bits = 0),
      (n.lencode = n.lendyn = new Int32Array(Fw)),
      (n.distcode = n.distdyn = new Int32Array(Ew)),
      (n.sane = 1),
      (n.back = -1),
      Gn
    );
  },
  D0 = e => {
    if (Zn(e)) return mt;
    let n = e.state;
    return ((n.wsize = 0), (n.whave = 0), (n.wnext = 0), E0(e));
  },
  M0 = (e, n) => {
    let t;
    if (Zn(e)) return mt;
    let i = e.state;
    return (
      n < 0 ? ((t = 0), (n = -n)) : ((t = (n >> 4) + 5), n < 48 && (n &= 15)),
      n && (n < 8 || n > 15)
        ? mt
        : (i.window !== null && i.wbits !== n && (i.window = null),
          (i.wrap = t),
          (i.wbits = n),
          D0(e))
    );
  },
  C0 = (e, n) => {
    if (!e) return mt;
    let t = new Cw();
    ((e.state = t), (t.strm = e), (t.window = null), (t.mode = Vo));
    let i = M0(e, n);
    return (i !== Gn && (e.state = null), i);
  },
  Ow = e => C0(e, Mw),
  qd = !0,
  Rs,
  Bs,
  Lw = e => {
    if (qd) {
      ((Rs = new Int32Array(512)), (Bs = new Int32Array(32)));
      let n = 0;
      for (; n < 144;) e.lens[n++] = 8;
      for (; n < 256;) e.lens[n++] = 9;
      for (; n < 280;) e.lens[n++] = 7;
      for (; n < 288;) e.lens[n++] = 8;
      for (ur(x0, e.lens, 0, 288, Rs, 0, e.work, { bits: 9 }), n = 0; n < 32;) e.lens[n++] = 5;
      (ur(S0, e.lens, 0, 32, Bs, 0, e.work, { bits: 5 }), (qd = !1));
    }
    ((e.lencode = Rs), (e.lenbits = 9), (e.distcode = Bs), (e.distbits = 5));
  },
  O0 = (e, n, t, i) => {
    let r,
      o = e.state;
    return (
      o.window === null &&
        ((o.wsize = 1 << o.wbits),
        (o.wnext = 0),
        (o.whave = 0),
        (o.window = new Uint8Array(o.wsize))),
      i >= o.wsize
        ? (o.window.set(n.subarray(t - o.wsize, t), 0), (o.wnext = 0), (o.whave = o.wsize))
        : ((r = o.wsize - o.wnext),
          r > i && (r = i),
          o.window.set(n.subarray(t - i, t - i + r), o.wnext),
          (i -= r),
          i
            ? (o.window.set(n.subarray(t - i, t), 0), (o.wnext = i), (o.whave = o.wsize))
            : ((o.wnext += r),
              o.wnext === o.wsize && (o.wnext = 0),
              o.whave < o.wsize && (o.whave += r))),
      0
    );
  },
  Uw = (e, n) => {
    let t,
      i,
      r,
      o,
      a,
      s,
      c,
      l,
      f,
      d,
      u,
      h,
      p,
      _,
      b = 0,
      g,
      y,
      w,
      m,
      A,
      M,
      k,
      E,
      F = new Uint8Array(4),
      I,
      C,
      B = new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
    if (Zn(e) || !e.output || (!e.input && e.avail_in !== 0)) return mt;
    ((t = e.state),
      t.mode === Qt && (t.mode = Us),
      (a = e.next_out),
      (r = e.output),
      (c = e.avail_out),
      (o = e.next_in),
      (i = e.input),
      (s = e.avail_in),
      (l = t.hold),
      (f = t.bits),
      (d = s),
      (u = c),
      (E = Gn));
    e: for (;;)
      switch (t.mode) {
        case Vo:
          if (t.wrap === 0) {
            t.mode = Us;
            break;
          }
          for (; f < 16;) {
            if (s === 0) break e;
            (s--, (l += i[o++] << f), (f += 8));
          }
          if (t.wrap & 2 && l === 35615) {
            (t.wbits === 0 && (t.wbits = 15),
              (t.check = 0),
              (F[0] = l & 255),
              (F[1] = (l >>> 8) & 255),
              (t.check = Le(t.check, F, 2, 0)),
              (l = 0),
              (f = 0),
              (t.mode = Dd));
            break;
          }
          if ((t.head && (t.head.done = !1), !(t.wrap & 1) || (((l & 255) << 8) + (l >> 8)) % 31)) {
            ((e.msg = 'incorrect header check'), (t.mode = Fe));
            break;
          }
          if ((l & 15) !== Ed) {
            ((e.msg = 'unknown compression method'), (t.mode = Fe));
            break;
          }
          if (
            ((l >>>= 4),
            (f -= 4),
            (k = (l & 15) + 8),
            t.wbits === 0 && (t.wbits = k),
            k > 15 || k > t.wbits)
          ) {
            ((e.msg = 'invalid window size'), (t.mode = Fe));
            break;
          }
          ((t.dmax = 1 << t.wbits),
            (t.flags = 0),
            (e.adler = t.check = 1),
            (t.mode = l & 512 ? Rd : Qt),
            (l = 0),
            (f = 0));
          break;
        case Dd:
          for (; f < 16;) {
            if (s === 0) break e;
            (s--, (l += i[o++] << f), (f += 8));
          }
          if (((t.flags = l), (t.flags & 255) !== Ed)) {
            ((e.msg = 'unknown compression method'), (t.mode = Fe));
            break;
          }
          if (t.flags & 57344) {
            ((e.msg = 'unknown header flags set'), (t.mode = Fe));
            break;
          }
          (t.head && (t.head.text = (l >> 8) & 1),
            t.flags & 512 &&
              t.wrap & 4 &&
              ((F[0] = l & 255), (F[1] = (l >>> 8) & 255), (t.check = Le(t.check, F, 2, 0))),
            (l = 0),
            (f = 0),
            (t.mode = Md));
        case Md:
          for (; f < 32;) {
            if (s === 0) break e;
            (s--, (l += i[o++] << f), (f += 8));
          }
          (t.head && (t.head.time = l),
            t.flags & 512 &&
              t.wrap & 4 &&
              ((F[0] = l & 255),
              (F[1] = (l >>> 8) & 255),
              (F[2] = (l >>> 16) & 255),
              (F[3] = (l >>> 24) & 255),
              (t.check = Le(t.check, F, 4, 0))),
            (l = 0),
            (f = 0),
            (t.mode = Cd));
        case Cd:
          for (; f < 16;) {
            if (s === 0) break e;
            (s--, (l += i[o++] << f), (f += 8));
          }
          (t.head && ((t.head.xflags = l & 255), (t.head.os = l >> 8)),
            t.flags & 512 &&
              t.wrap & 4 &&
              ((F[0] = l & 255), (F[1] = (l >>> 8) & 255), (t.check = Le(t.check, F, 2, 0))),
            (l = 0),
            (f = 0),
            (t.mode = Od));
        case Od:
          if (t.flags & 1024) {
            for (; f < 16;) {
              if (s === 0) break e;
              (s--, (l += i[o++] << f), (f += 8));
            }
            ((t.length = l),
              t.head && (t.head.extra_len = l),
              t.flags & 512 &&
                t.wrap & 4 &&
                ((F[0] = l & 255), (F[1] = (l >>> 8) & 255), (t.check = Le(t.check, F, 2, 0))),
              (l = 0),
              (f = 0));
          } else t.head && (t.head.extra = null);
          t.mode = Ld;
        case Ld:
          if (
            t.flags & 1024 &&
            ((h = t.length),
            h > s && (h = s),
            h &&
              (t.head &&
                ((k = t.head.extra_len - t.length),
                t.head.extra || (t.head.extra = new Uint8Array(t.head.extra_len)),
                t.head.extra.set(i.subarray(o, o + h), k)),
              t.flags & 512 && t.wrap & 4 && (t.check = Le(t.check, i, h, o)),
              (s -= h),
              (o += h),
              (t.length -= h)),
            t.length)
          )
            break e;
          ((t.length = 0), (t.mode = Ud));
        case Ud:
          if (t.flags & 2048) {
            if (s === 0) break e;
            h = 0;
            do
              ((k = i[o + h++]),
                t.head && k && t.length < 65536 && (t.head.name += String.fromCharCode(k)));
            while (k && h < s);
            if (
              (t.flags & 512 && t.wrap & 4 && (t.check = Le(t.check, i, h, o)),
              (s -= h),
              (o += h),
              k)
            )
              break e;
          } else t.head && (t.head.name = null);
          ((t.length = 0), (t.mode = Pd));
        case Pd:
          if (t.flags & 4096) {
            if (s === 0) break e;
            h = 0;
            do
              ((k = i[o + h++]),
                t.head && k && t.length < 65536 && (t.head.comment += String.fromCharCode(k)));
            while (k && h < s);
            if (
              (t.flags & 512 && t.wrap & 4 && (t.check = Le(t.check, i, h, o)),
              (s -= h),
              (o += h),
              k)
            )
              break e;
          } else t.head && (t.head.comment = null);
          t.mode = Td;
        case Td:
          if (t.flags & 512) {
            for (; f < 16;) {
              if (s === 0) break e;
              (s--, (l += i[o++] << f), (f += 8));
            }
            if (t.wrap & 4 && l !== (t.check & 65535)) {
              ((e.msg = 'header crc mismatch'), (t.mode = Fe));
              break;
            }
            ((l = 0), (f = 0));
          }
          (t.head && ((t.head.hcrc = (t.flags >> 9) & 1), (t.head.done = !0)),
            (e.adler = t.check = 0),
            (t.mode = Qt));
          break;
        case Rd:
          for (; f < 32;) {
            if (s === 0) break e;
            (s--, (l += i[o++] << f), (f += 8));
          }
          ((e.adler = t.check = Yd(l)), (l = 0), (f = 0), (t.mode = zo));
        case zo:
          if (t.havedict === 0)
            return (
              (e.next_out = a),
              (e.avail_out = c),
              (e.next_in = o),
              (e.avail_in = s),
              (t.hold = l),
              (t.bits = f),
              Aw
            );
          ((e.adler = t.check = 1), (t.mode = Qt));
        case Qt:
          if (n === Sw || n === Lo) break e;
        case Us:
          if (t.last) {
            ((l >>>= f & 7), (f -= f & 7), (t.mode = Ts));
            break;
          }
          for (; f < 3;) {
            if (s === 0) break e;
            (s--, (l += i[o++] << f), (f += 8));
          }
          switch (((t.last = l & 1), (l >>>= 1), (f -= 1), l & 3)) {
            case 0:
              t.mode = Bd;
              break;
            case 1:
              if ((Lw(t), (t.mode = Uo), n === Lo)) {
                ((l >>>= 2), (f -= 2));
                break e;
              }
              break;
            case 2:
              t.mode = Nd;
              break;
            case 3:
              ((e.msg = 'invalid block type'), (t.mode = Fe));
          }
          ((l >>>= 2), (f -= 2));
          break;
        case Bd:
          for (l >>>= f & 7, f -= f & 7; f < 32;) {
            if (s === 0) break e;
            (s--, (l += i[o++] << f), (f += 8));
          }
          if ((l & 65535) !== ((l >>> 16) ^ 65535)) {
            ((e.msg = 'invalid stored block lengths'), (t.mode = Fe));
            break;
          }
          if (((t.length = l & 65535), (l = 0), (f = 0), (t.mode = Ps), n === Lo)) break e;
        case Ps:
          t.mode = zd;
        case zd:
          if (((h = t.length), h)) {
            if ((h > s && (h = s), h > c && (h = c), h === 0)) break e;
            (r.set(i.subarray(o, o + h), a),
              (s -= h),
              (o += h),
              (c -= h),
              (a += h),
              (t.length -= h));
            break;
          }
          t.mode = Qt;
          break;
        case Nd:
          for (; f < 14;) {
            if (s === 0) break e;
            (s--, (l += i[o++] << f), (f += 8));
          }
          if (
            ((t.nlen = (l & 31) + 257),
            (l >>>= 5),
            (f -= 5),
            (t.ndist = (l & 31) + 1),
            (l >>>= 5),
            (f -= 5),
            (t.ncode = (l & 15) + 4),
            (l >>>= 4),
            (f -= 4),
            t.nlen > 286 || t.ndist > 30)
          ) {
            ((e.msg = 'too many length or distance symbols'), (t.mode = Fe));
            break;
          }
          ((t.have = 0), (t.mode = jd));
        case jd:
          for (; t.have < t.ncode;) {
            for (; f < 3;) {
              if (s === 0) break e;
              (s--, (l += i[o++] << f), (f += 8));
            }
            ((t.lens[B[t.have++]] = l & 7), (l >>>= 3), (f -= 3));
          }
          for (; t.have < 19;) t.lens[B[t.have++]] = 0;
          if (
            ((t.lencode = t.lendyn),
            (t.lenbits = 7),
            (I = { bits: t.lenbits }),
            (E = ur(xw, t.lens, 0, 19, t.lencode, 0, t.work, I)),
            (t.lenbits = I.bits),
            E)
          ) {
            ((e.msg = 'invalid code lengths set'), (t.mode = Fe));
            break;
          }
          ((t.have = 0), (t.mode = Vd));
        case Vd:
          for (; t.have < t.nlen + t.ndist;) {
            for (
              ;
              (b = t.lencode[l & ((1 << t.lenbits) - 1)]),
                (g = b >>> 24),
                (y = (b >>> 16) & 255),
                (w = b & 65535),
                !(g <= f);
            ) {
              if (s === 0) break e;
              (s--, (l += i[o++] << f), (f += 8));
            }
            if (w < 16) ((l >>>= g), (f -= g), (t.lens[t.have++] = w));
            else {
              if (w === 16) {
                for (C = g + 2; f < C;) {
                  if (s === 0) break e;
                  (s--, (l += i[o++] << f), (f += 8));
                }
                if (((l >>>= g), (f -= g), t.have === 0)) {
                  ((e.msg = 'invalid bit length repeat'), (t.mode = Fe));
                  break;
                }
                ((k = t.lens[t.have - 1]), (h = 3 + (l & 3)), (l >>>= 2), (f -= 2));
              } else if (w === 17) {
                for (C = g + 3; f < C;) {
                  if (s === 0) break e;
                  (s--, (l += i[o++] << f), (f += 8));
                }
                ((l >>>= g), (f -= g), (k = 0), (h = 3 + (l & 7)), (l >>>= 3), (f -= 3));
              } else {
                for (C = g + 7; f < C;) {
                  if (s === 0) break e;
                  (s--, (l += i[o++] << f), (f += 8));
                }
                ((l >>>= g), (f -= g), (k = 0), (h = 11 + (l & 127)), (l >>>= 7), (f -= 7));
              }
              if (t.have + h > t.nlen + t.ndist) {
                ((e.msg = 'invalid bit length repeat'), (t.mode = Fe));
                break;
              }
              for (; h--;) t.lens[t.have++] = k;
            }
          }
          if (t.mode === Fe) break;
          if (t.lens[256] === 0) {
            ((e.msg = 'invalid code -- missing end-of-block'), (t.mode = Fe));
            break;
          }
          if (
            ((t.lenbits = 9),
            (I = { bits: t.lenbits }),
            (E = ur(x0, t.lens, 0, t.nlen, t.lencode, 0, t.work, I)),
            (t.lenbits = I.bits),
            E)
          ) {
            ((e.msg = 'invalid literal/lengths set'), (t.mode = Fe));
            break;
          }
          if (
            ((t.distbits = 6),
            (t.distcode = t.distdyn),
            (I = { bits: t.distbits }),
            (E = ur(S0, t.lens, t.nlen, t.ndist, t.distcode, 0, t.work, I)),
            (t.distbits = I.bits),
            E)
          ) {
            ((e.msg = 'invalid distances set'), (t.mode = Fe));
            break;
          }
          if (((t.mode = Uo), n === Lo)) break e;
        case Uo:
          t.mode = Po;
        case Po:
          if (s >= 6 && c >= 258) {
            ((e.next_out = a),
              (e.avail_out = c),
              (e.next_in = o),
              (e.avail_in = s),
              (t.hold = l),
              (t.bits = f),
              mw(e, u),
              (a = e.next_out),
              (r = e.output),
              (c = e.avail_out),
              (o = e.next_in),
              (i = e.input),
              (s = e.avail_in),
              (l = t.hold),
              (f = t.bits),
              t.mode === Qt && (t.back = -1));
            break;
          }
          for (
            t.back = 0;
            (b = t.lencode[l & ((1 << t.lenbits) - 1)]),
              (g = b >>> 24),
              (y = (b >>> 16) & 255),
              (w = b & 65535),
              !(g <= f);
          ) {
            if (s === 0) break e;
            (s--, (l += i[o++] << f), (f += 8));
          }
          if (y && (y & 240) === 0) {
            for (
              m = g, A = y, M = w;
              (b = t.lencode[M + ((l & ((1 << (m + A)) - 1)) >> m)]),
                (g = b >>> 24),
                (y = (b >>> 16) & 255),
                (w = b & 65535),
                !(m + g <= f);
            ) {
              if (s === 0) break e;
              (s--, (l += i[o++] << f), (f += 8));
            }
            ((l >>>= m), (f -= m), (t.back += m));
          }
          if (((l >>>= g), (f -= g), (t.back += g), (t.length = w), y === 0)) {
            t.mode = Xd;
            break;
          }
          if (y & 32) {
            ((t.back = -1), (t.mode = Qt));
            break;
          }
          if (y & 64) {
            ((e.msg = 'invalid literal/length code'), (t.mode = Fe));
            break;
          }
          ((t.extra = y & 15), (t.mode = Gd));
        case Gd:
          if (t.extra) {
            for (C = t.extra; f < C;) {
              if (s === 0) break e;
              (s--, (l += i[o++] << f), (f += 8));
            }
            ((t.length += l & ((1 << t.extra) - 1)),
              (l >>>= t.extra),
              (f -= t.extra),
              (t.back += t.extra));
          }
          ((t.was = t.length), (t.mode = $d));
        case $d:
          for (
            ;
            (b = t.distcode[l & ((1 << t.distbits) - 1)]),
              (g = b >>> 24),
              (y = (b >>> 16) & 255),
              (w = b & 65535),
              !(g <= f);
          ) {
            if (s === 0) break e;
            (s--, (l += i[o++] << f), (f += 8));
          }
          if ((y & 240) === 0) {
            for (
              m = g, A = y, M = w;
              (b = t.distcode[M + ((l & ((1 << (m + A)) - 1)) >> m)]),
                (g = b >>> 24),
                (y = (b >>> 16) & 255),
                (w = b & 65535),
                !(m + g <= f);
            ) {
              if (s === 0) break e;
              (s--, (l += i[o++] << f), (f += 8));
            }
            ((l >>>= m), (f -= m), (t.back += m));
          }
          if (((l >>>= g), (f -= g), (t.back += g), y & 64)) {
            ((e.msg = 'invalid distance code'), (t.mode = Fe));
            break;
          }
          ((t.offset = w), (t.extra = y & 15), (t.mode = Zd));
        case Zd:
          if (t.extra) {
            for (C = t.extra; f < C;) {
              if (s === 0) break e;
              (s--, (l += i[o++] << f), (f += 8));
            }
            ((t.offset += l & ((1 << t.extra) - 1)),
              (l >>>= t.extra),
              (f -= t.extra),
              (t.back += t.extra));
          }
          if (t.offset > t.dmax) {
            ((e.msg = 'invalid distance too far back'), (t.mode = Fe));
            break;
          }
          t.mode = Hd;
        case Hd:
          if (c === 0) break e;
          if (((h = u - c), t.offset > h)) {
            if (((h = t.offset - h), h > t.whave && t.sane)) {
              ((e.msg = 'invalid distance too far back'), (t.mode = Fe));
              break;
            }
            (h > t.wnext ? ((h -= t.wnext), (p = t.wsize - h)) : (p = t.wnext - h),
              h > t.length && (h = t.length),
              (_ = t.window));
          } else ((_ = r), (p = a - t.offset), (h = t.length));
          (h > c && (h = c), (c -= h), (t.length -= h));
          do r[a++] = _[p++];
          while (--h);
          t.length === 0 && (t.mode = Po);
          break;
        case Xd:
          if (c === 0) break e;
          ((r[a++] = t.length), c--, (t.mode = Po));
          break;
        case Ts:
          if (t.wrap) {
            for (; f < 32;) {
              if (s === 0) break e;
              (s--, (l |= i[o++] << f), (f += 8));
            }
            if (
              ((u -= c),
              (e.total_out += u),
              (t.total += u),
              t.wrap & 4 &&
                u &&
                (e.adler = t.check = t.flags ? Le(t.check, r, u, a - u) : mr(t.check, r, u, a - u)),
              (u = c),
              t.wrap & 4 && (t.flags ? l : Yd(l)) !== t.check)
            ) {
              ((e.msg = 'incorrect data check'), (t.mode = Fe));
              break;
            }
            ((l = 0), (f = 0));
          }
          t.mode = Kd;
        case Kd:
          if (t.wrap && t.flags) {
            for (; f < 32;) {
              if (s === 0) break e;
              (s--, (l += i[o++] << f), (f += 8));
            }
            if (t.wrap & 4 && l !== (t.total & 4294967295)) {
              ((e.msg = 'incorrect length check'), (t.mode = Fe));
              break;
            }
            ((l = 0), (f = 0));
          }
          t.mode = Wd;
        case Wd:
          E = kw;
          break e;
        case Fe:
          E = k0;
          break e;
        case I0:
          return A0;
        case F0:
        default:
          return mt;
      }
    return (
      (e.next_out = a),
      (e.avail_out = c),
      (e.next_in = o),
      (e.avail_in = s),
      (t.hold = l),
      (t.bits = f),
      (t.wsize || (u !== e.avail_out && t.mode < Fe && (t.mode < Ts || n !== Fd))) &&
        O0(e, e.output, e.next_out, u - e.avail_out),
      (d -= e.avail_in),
      (u -= e.avail_out),
      (e.total_in += d),
      (e.total_out += u),
      (t.total += u),
      t.wrap & 4 &&
        u &&
        (e.adler = t.check =
          t.flags ? Le(t.check, r, u, e.next_out - u) : mr(t.check, r, u, e.next_out - u)),
      (e.data_type =
        t.bits +
        (t.last ? 64 : 0) +
        (t.mode === Qt ? 128 : 0) +
        (t.mode === Uo || t.mode === Ps ? 256 : 0)),
      ((d === 0 && u === 0) || n === Fd) && E === Gn && (E = Iw),
      E
    );
  },
  Pw = e => {
    if (Zn(e)) return mt;
    let n = e.state;
    return (n.window && (n.window = null), (e.state = null), Gn);
  },
  Tw = (e, n) => {
    if (Zn(e)) return mt;
    let t = e.state;
    return (t.wrap & 2) === 0 ? mt : ((t.head = n), (n.done = !1), Gn);
  },
  Rw = (e, n) => {
    let t = n.length,
      i,
      r,
      o;
    return Zn(e) || ((i = e.state), i.wrap !== 0 && i.mode !== zo)
      ? mt
      : i.mode === zo && ((r = 1), (r = mr(r, n, t, 0)), r !== i.check)
        ? k0
        : ((o = O0(e, n, t, t)), o ? ((i.mode = I0), A0) : ((i.havedict = 1), Gn));
  },
  Bw = D0,
  zw = M0,
  Nw = E0,
  jw = Ow,
  Vw = C0,
  Gw = Uw,
  $w = Pw,
  Zw = Tw,
  Hw = Rw,
  Xw = 'pako inflate (from Nodeca project)',
  tn = {
    inflateReset: Bw,
    inflateReset2: zw,
    inflateResetKeep: Nw,
    inflateInit: jw,
    inflateInit2: Vw,
    inflate: Gw,
    inflateEnd: $w,
    inflateGetHeader: Zw,
    inflateSetDictionary: Hw,
    inflateInfo: Xw,
  };
function Kw() {
  ((this.text = 0),
    (this.time = 0),
    (this.xflags = 0),
    (this.os = 0),
    (this.extra = null),
    (this.extra_len = 0),
    (this.name = ''),
    (this.comment = ''),
    (this.hcrc = 0),
    (this.done = !1));
}
var Ww = Kw,
  L0 = Object.prototype.toString,
  {
    Z_NO_FLUSH: Yw,
    Z_FINISH: qw,
    Z_OK: wr,
    Z_STREAM_END: zs,
    Z_NEED_DICT: Ns,
    Z_STREAM_ERROR: Jw,
    Z_DATA_ERROR: Jd,
    Z_MEM_ERROR: Qw,
  } = $n;
function Sr(e) {
  this.options = jo.assign({ chunkSize: 1024 * 64, windowBits: 15, to: '' }, e || {});
  let n = this.options;
  (n.raw &&
    n.windowBits >= 0 &&
    n.windowBits < 16 &&
    ((n.windowBits = -n.windowBits), n.windowBits === 0 && (n.windowBits = -15)),
    n.windowBits >= 0 && n.windowBits < 16 && !(e && e.windowBits) && (n.windowBits += 32),
    n.windowBits > 15 && n.windowBits < 48 && (n.windowBits & 15) === 0 && (n.windowBits |= 15),
    (this.err = 0),
    (this.msg = ''),
    (this.ended = !1),
    (this.chunks = []),
    (this.strm = new _0()),
    (this.strm.avail_out = 0));
  let t = tn.inflateInit2(this.strm, n.windowBits);
  if (t !== wr) throw new Error(jn[t]);
  if (
    ((this.header = new Ww()),
    tn.inflateGetHeader(this.strm, this.header),
    n.dictionary &&
      (typeof n.dictionary == 'string'
        ? (n.dictionary = yr.string2buf(n.dictionary))
        : L0.call(n.dictionary) === '[object ArrayBuffer]' &&
          (n.dictionary = new Uint8Array(n.dictionary)),
      n.raw && ((t = tn.inflateSetDictionary(this.strm, n.dictionary)), t !== wr)))
  )
    throw new Error(jn[t]);
}
Sr.prototype.push = function (e, n) {
  let t = this.strm,
    i = this.options.chunkSize,
    r = this.options.dictionary,
    o,
    a,
    s;
  if (this.ended) return !1;
  for (
    n === ~~n ? (a = n) : (a = n === !0 ? qw : Yw),
      L0.call(e) === '[object ArrayBuffer]' ? (t.input = new Uint8Array(e)) : (t.input = e),
      t.next_in = 0,
      t.avail_in = t.input.length;
    ;
  ) {
    for (
      t.avail_out === 0 && ((t.output = new Uint8Array(i)), (t.next_out = 0), (t.avail_out = i)),
        o = tn.inflate(t, a),
        o === Ns &&
          r &&
          ((o = tn.inflateSetDictionary(t, r)),
          o === wr ? (o = tn.inflate(t, a)) : o === Jd && (o = Ns));
      t.avail_in > 0 && o === zs && t.state.wrap > 0 && e[t.next_in] !== 0;
    )
      (tn.inflateReset(t), (o = tn.inflate(t, a)));
    switch (o) {
      case Jw:
      case Jd:
      case Ns:
      case Qw:
        return (this.onEnd(o), (this.ended = !0), !1);
    }
    if (((s = t.avail_out), t.next_out && (t.avail_out === 0 || o === zs)))
      if (this.options.to === 'string') {
        let c = yr.utf8border(t.output, t.next_out),
          l = t.next_out - c,
          f = yr.buf2string(t.output, c);
        ((t.next_out = l),
          (t.avail_out = i - l),
          l && t.output.set(t.output.subarray(c, c + l), 0),
          this.onData(f));
      } else
        this.onData(t.output.length === t.next_out ? t.output : t.output.subarray(0, t.next_out));
    if (!(o === wr && s === 0)) {
      if (o === zs) return ((o = tn.inflateEnd(this.strm)), this.onEnd(o), (this.ended = !0), !0);
      if (t.avail_in === 0) break;
    }
  }
  return !0;
};
Sr.prototype.onData = function (e) {
  this.chunks.push(e);
};
Sr.prototype.onEnd = function (e) {
  (e === wr &&
    (this.options.to === 'string'
      ? (this.result = this.chunks.join(''))
      : (this.result = jo.flattenChunks(this.chunks))),
    (this.chunks = []),
    (this.err = e),
    (this.msg = this.strm.msg));
};
function nl(e, n) {
  let t = new Sr(n);
  if ((t.push(e), t.err)) throw t.msg || jn[t.err];
  return t.result;
}
function e_(e, n) {
  return ((n = n || {}), (n.raw = !0), nl(e, n));
}
var t_ = Sr,
  n_ = nl,
  i_ = e_,
  r_ = nl,
  o_ = $n,
  a_ = { Inflate: t_, inflate: n_, inflateRaw: i_, ungzip: r_, constants: o_ },
  { Deflate: s_, deflate: l_, deflateRaw: c_, gzip: f_ } = pw,
  { Inflate: u_, inflate: d_, inflateRaw: h_, ungzip: p_ } = a_,
  g_ = s_,
  m_ = l_,
  b_ = c_,
  y_ = f_,
  w_ = u_,
  __ = d_,
  v_ = h_,
  x_ = p_,
  S_ = $n,
  U0 = {
    Deflate: g_,
    deflate: m_,
    deflateRaw: b_,
    gzip: y_,
    Inflate: w_,
    inflate: __,
    inflateRaw: v_,
    ungzip: x_,
    constants: S_,
  };
async function P0(e) {
  let n = new DataView(e.buffer, e.byteOffset, e.byteLength),
    t = n.getUint32(16),
    i = n.getUint32(20);
  if (!t || !i || t * i > 15e7) throw new Error('Embedded PNG exceeds the preview limit');
  let r = new Blob([new Uint8Array(e)], { type: 'image/png' }),
    o = await createImageBitmap(r);
  try {
    let s = new OffscreenCanvas(o.width, o.height).getContext('2d');
    if (!s) throw new Error('Native PNG preview canvas unavailable');
    s.drawImage(o, 0, 0);
    let c = s.getImageData(0, 0, o.width, o.height);
    return { width: o.width, height: o.height, data: new Uint8Array(c.data.buffer) };
  } finally {
    o.close();
  }
}
async function T0(e, n) {
  let t = [];
  for (let i of e) t.push(await n(i));
  return t;
}
var j0 = [
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
  k_ = new Set(j0.map(e => e.id)),
  il = new Set(j0.filter(e => e.arithmetic).map(e => e.id)),
  A_ = new Set([
    'normal',
    'multiply',
    'screen',
    'overlay',
    'darken',
    'lighten',
    'difference',
    'exclusion',
  ]);
function I_(e, n) {
  if (!n) return !0;
  let t = n.threshold ?? 0;
  switch (n.op) {
    case 'gt':
      return e > t;
    case 'ge':
      return e >= t;
    case 'lt':
      return e < t;
    case 'le':
      return e <= t;
    case 'eq':
      return e === t;
    case 'isfinite':
      return Number.isFinite(e);
    case 'isnan':
      return !Number.isFinite(e);
    default:
      return !0;
  }
}
function F_(e, n, t) {
  switch (t) {
    case 'add':
      return e + n;
    case 'subtract':
      return e - n;
    case 'difference':
    case 'raw-difference':
      return Math.abs(e - n);
    case 'raw-multiply':
      return e * n;
    case 'divide':
      return n === 0 ? NaN : e / n;
    case 'min':
      return Math.min(e, n);
    case 'max':
      return Math.max(e, n);
    case 'average':
      return (e + n) * 0.5;
    case 'normal':
    default:
      return n;
  }
}
function E_(e, n, t, i = 1) {
  let r = Number.isFinite(i) && i > 0 ? i : 1;
  switch (t) {
    case 'multiply':
      return (e * n) / r;
    case 'screen':
      return r - ((r - e) * (r - n)) / r;
    case 'overlay':
      return e <= r * 0.5 ? (2 * e * n) / r : r - (2 * (r - e) * (r - n)) / r;
    case 'darken':
      return Math.min(e, n);
    case 'lighten':
      return Math.max(e, n);
    case 'difference':
      return Math.abs(e - n);
    case 'exclusion':
      return e + n - (2 * e * n) / r;
    case 'normal':
    default:
      return n;
  }
}
function jt(e, n, t) {
  return t <= 0 ? e : t >= 1 ? n : Number.isFinite(e) && Number.isFinite(n) ? e + (n - e) * t : NaN;
}
function Hn(e, n, t, i, r) {
  return i <= 0 || t >= 1
    ? n
    : !Number.isFinite(e) || !Number.isFinite(n)
      ? NaN
      : (n * t + e * i * (1 - t)) / r;
}
function V0(e, n, t, i, r, o, a) {
  if (r <= 0) return n;
  if (t === 'normal') return Hn(e, n, i, r, o);
  if (!Number.isFinite(e) || !Number.isFinite(n)) return NaN;
  let s = E_(e, n, t, a);
  return ((1 - i) * r * e + (1 - r) * i * n + r * i * s) / o;
}
function kr(e, n, t, i, r) {
  let o = n[t] > 0,
    a = r === 4 ? 3 : r;
  for (let s = 0; s < a; s++) e[i + s] = NaN;
  return ((n[t] = 1), r === 4 && (e[i + 3] = 1), o ? 0 : 1);
}
function D_(e) {
  return e.some(n => il.has(n.blendMode ?? 'normal'))
    ? e.some(n => n.channels >= 3)
      ? 3
      : 1
    : e.some(n => n.channels === 2 || n.channels === 4)
      ? 4
      : e.some(n => n.channels >= 3)
        ? 3
        : 1;
}
function M_(e, n, t, i, r, o = 1) {
  let a = (t * e.width + n) * e.channels,
    s = e.data;
  if (e.channels === 1) {
    let c = s[a] * o;
    for (let l = 0; l < i; l++) r[l] = l === 3 ? e.typeMax || 1 : c;
  } else if (e.channels === 2) {
    let c = s[a] * o;
    for (let l = 0; l < i; l++) r[l] = l === 3 ? s[a + 1] : c;
  } else
    for (let c = 0; c < i; c++) {
      let l = s[a + Math.min(c, e.channels - 1)];
      r[c] = c === 3 ? l : l * o;
    }
}
function C_(e, n, t, i, r, o, a, s, c, l, f, d, u, h) {
  let p = e.data,
    _ = e.channels,
    b = d >= 1,
    g = h / (e.typeMax || h);
  if (i === 4 && _ <= 2) {
    for (let y = a; y < c; y++) {
      let w = y * r + o,
        m = w * 4,
        A = ((y - f) * e.width + (o - l)) * _;
      for (let M = o; M < s; M++, w++, m += 4, A += _) {
        let k = _ === 2 ? Number(p[A + 1]) / (e.typeMax || h) : 1;
        if (!Number.isFinite(k)) {
          u += kr(n, t, w, m, 4);
          continue;
        }
        let E = Math.max(0, Math.min(1, k * d));
        if (E <= 0) continue;
        let F = Number(p[A]) * g,
          I = t[w],
          C = E + I * (1 - E);
        (I <= 0
          ? ((n[m] = n[m + 1] = n[m + 2] = F), u++)
          : ((n[m] = Hn(n[m], F, E, I, C)),
            (n[m + 1] = Hn(n[m + 1], F, E, I, C)),
            (n[m + 2] = Hn(n[m + 2], F, E, I, C))),
          (t[w] = C),
          (n[m + 3] = C));
      }
    }
    return u;
  }
  if (i === 4 && _ >= 3) {
    for (let y = a; y < c; y++) {
      let w = y * r + o,
        m = w * 4,
        A = ((y - f) * e.width + (o - l)) * _;
      for (let M = o; M < s; M++, w++, m += 4, A += _) {
        let k = _ === 4 ? Number(p[A + 3]) / (e.typeMax || 255) : 1;
        if (!Number.isFinite(k)) {
          u += kr(n, t, w, m, 4);
          continue;
        }
        let E = Math.max(0, Math.min(1, k * d));
        if (E <= 0) continue;
        let F = t[w],
          I = E + F * (1 - E),
          C = p[A] * g,
          B = p[A + 1] * g,
          ee = p[A + 2] * g;
        (F <= 0
          ? ((n[m] = C), (n[m + 1] = B), (n[m + 2] = ee), u++)
          : ((n[m] = Hn(n[m], C, E, F, I)),
            (n[m + 1] = Hn(n[m + 1], B, E, F, I)),
            (n[m + 2] = Hn(n[m + 2], ee, E, F, I))),
          (t[w] = I),
          (n[m + 3] = I));
      }
    }
    return u;
  }
  if (i === 1 && _ === 1) {
    for (let y = a; y < c; y++) {
      let w = y * r + o,
        m = (y - f) * e.width + (o - l);
      for (let A = o; A < s; A++, w++, m++) {
        let M = p[m] * g;
        t[w] ? (n[w] = jt(n[w], M, d)) : ((n[w] = M), (t[w] = 1), u++);
      }
    }
    return u;
  }
  if (i === 3 && _ === 1) {
    for (let y = a; y < c; y++) {
      let w = y * r + o,
        m = w * 3,
        A = (y - f) * e.width + (o - l);
      for (let M = o; M < s; M++, w++, m += 3, A++) {
        let k = p[A] * g;
        t[w]
          ? b
            ? ((n[m] = k), (n[m + 1] = k), (n[m + 2] = k))
            : ((n[m] = jt(n[m], k, d)),
              (n[m + 1] = jt(n[m + 1], k, d)),
              (n[m + 2] = jt(n[m + 2], k, d)))
          : ((n[m] = k), (n[m + 1] = k), (n[m + 2] = k), (t[w] = 1), u++);
      }
    }
    return u;
  }
  if (i === 3 && _ === 4) {
    for (let y = a; y < c; y++) {
      let w = y * r + o,
        m = w * 3,
        A = ((y - f) * e.width + (o - l)) * 4;
      for (let M = o; M < s; M++, w++, m += 3, A += 4) {
        let k = Number(p[A + 3]) / (e.typeMax || 255);
        if (!Number.isFinite(k)) {
          u += kr(n, t, w, m, 3);
          continue;
        }
        let E = Math.max(0, Math.min(1, k * d));
        if (E <= 0) continue;
        let F = p[A] * g,
          I = p[A + 1] * g,
          C = p[A + 2] * g;
        t[w]
          ? ((n[m] = jt(n[m], F, E)),
            (n[m + 1] = jt(n[m + 1], I, E)),
            (n[m + 2] = jt(n[m + 2], C, E)))
          : ((n[m] = F), (n[m + 1] = I), (n[m + 2] = C), (t[w] = 1), u++);
      }
    }
    return u;
  }
  if (i === 3 && _ >= 3)
    for (let y = a; y < c; y++) {
      let w = y * r + o,
        m = w * 3,
        A = ((y - f) * e.width + (o - l)) * _;
      for (let M = o; M < s; M++, w++, m += 3, A += _) {
        let k = p[A] * g,
          E = p[A + 1] * g,
          F = p[A + 2] * g;
        t[w]
          ? b
            ? ((n[m] = k), (n[m + 1] = E), (n[m + 2] = F))
            : ((n[m] = jt(n[m], k, d)),
              (n[m + 1] = jt(n[m + 1], E, d)),
              (n[m + 2] = jt(n[m + 2], F, d)))
          : ((n[m] = k), (n[m + 1] = E), (n[m + 2] = F), (t[w] = 1), u++);
      }
    }
  return u;
}
function O_(e, n, t, i, r, o, a) {
  let s = e.data,
    c = e.typeMax || a,
    l = a / c;
  for (let f = 0, d = 0; f < t.length; f++, d += 4) {
    let u = Math.max(0, Math.min(1, (Number(s[d + 3]) / c) * r));
    if (!Number.isFinite(u)) {
      o += kr(n, t, f, d, 4);
      continue;
    }
    if (u <= 0) continue;
    let h = t[f],
      p = u + h * (1 - u);
    if (h <= 0) ((n[d] = s[d] * l), (n[d + 1] = s[d + 1] * l), (n[d + 2] = s[d + 2] * l), o++);
    else
      for (let _ = 0; _ < 3; _++) {
        let b = Number(s[d + _]) * l,
          g = n[d + _];
        n[d + _] = V0(g, b, i, u, h, p, a);
      }
    ((t[f] = p), (n[d + 3] = p));
  }
  return o;
}
function rl(e, n, t) {
  let i = e.rasterMask;
  if (!i) return 1;
  let r = n - Math.round(i.offsetX ?? e.offsetX ?? 0),
    o = t - Math.round(i.offsetY ?? e.offsetY ?? 0);
  if (r < 0 || o < 0 || r >= i.width || o >= i.height) return i.invert ? 1 : 0;
  let a = Math.max(1, i.channels ?? 1),
    s = Number(i.data[(o * i.width + r) * a]),
    c = Number.isFinite(s) ? s / (i.typeMax || 255) : 0;
  return ((c = Math.max(0, Math.min(1, c))), i.invert ? 1 - c : c);
}
function G0(e, n, t) {
  let i = n - Math.round(e.offsetX ?? 0),
    r = t - Math.round(e.offsetY ?? 0);
  if (i < 0 || r < 0 || i >= e.width || r >= e.height || !e.data) return 0;
  let o = (r * e.width + i) * e.channels,
    a = rl(e, n, t) * Math.max(0, Math.min(1, e.opacity ?? 1));
  if (a <= 0) return 0;
  let s =
    e.channels === 2 || e.channels === 4
      ? Number(e.data[o + e.channels - 1]) / (e.typeMax || 255)
      : 1;
  return Number.isFinite(s) ? Math.max(0, Math.min(1, s * a)) : NaN;
}
function L_(e, n, t) {
  let i = new Float32Array(n * t),
    r = Math.max(0, Math.round(e.offsetX ?? 0)),
    o = Math.max(0, Math.round(e.offsetY ?? 0)),
    a = Math.min(n, Math.round(e.offsetX ?? 0) + e.width),
    s = Math.min(t, Math.round(e.offsetY ?? 0) + e.height);
  for (let c = o; c < s; c++) for (let l = r; l < a; l++) i[c * n + l] = G0(e, l, c);
  return i;
}
var R0 = new WeakMap(),
  $o = { groupHits: 0, groupMisses: 0, clippingHits: 0, clippingMisses: 0 };
function $0(e, n, t, i, r = new Set()) {
  let o = e.filter(s => (s.parentId || void 0) === i),
    a = [];
  for (let s of o) {
    if (s.kind !== 'group') {
      (s.data || (s.kind === 'adjustment' && s.adjustment)) && a.push(s);
      continue;
    }
    let c = s.id || '';
    if (!c || r.has(c)) continue;
    let l = new Set(r);
    l.add(c);
    let f = $0(e, n, t, c, l),
      d = f.map(p => X0(p)),
      u = R0.get(s),
      h;
    (u && u.width === n && u.height === t && K0(u.snapshots, d)
      ? ($o.groupHits++, (h = u.surface))
      : ($o.groupMisses++,
        (h = W0(f, n, t)),
        R0.set(s, { snapshots: d, width: n, height: t, surface: h })),
      a.push({
        ...s,
        kind: 'raster',
        parentId: void 0,
        data: h.data,
        width: n,
        height: t,
        channels: h.channels,
        isFloat: h.isFloat,
        typeMax: h.typeMax,
        offsetX: s.offsetX ?? 0,
        offsetY: s.offsetY ?? 0,
      }));
  }
  return a;
}
function U_(e, n) {
  let t = e
    .filter(i => Number.isFinite(i.input) && Number.isFinite(i.output))
    .sort((i, r) => i.input - r.input)
    .filter((i, r, o) => r === 0 || i.input !== o[r - 1].input);
  if (!t.length) return n;
  if (n <= t[0].input) return t[0].output;
  for (let i = 1; i < t.length; i++)
    if (n <= t[i].input) {
      let r = t[i - 1],
        o = t[i],
        a = o.input - r.input;
      if (!a) return o.output;
      let s = t[Math.max(0, i - 2)],
        c = t[Math.min(t.length - 1, i + 1)],
        l = (g, y) => (y.output - g.output) / Math.max(1e-6, y.input - g.input),
        f = l(r, o),
        d = i === 1 ? f : (l(s, r) + f) / 2,
        u = i === t.length - 1 ? f : (f + l(o, c)) / 2;
      ((!f || d * f < 0) && (d = 0), (!f || u * f < 0) && (u = 0));
      let h = (n - r.input) / a,
        p = h * h,
        _ = p * h,
        b =
          (2 * _ - 3 * p + 1) * r.output +
          (_ - 2 * p + h) * a * d +
          (-2 * _ + 3 * p) * o.output +
          (_ - p) * a * u;
      return Math.max(Math.min(r.output, o.output), Math.min(Math.max(r.output, o.output), b));
    }
  return t[t.length - 1].output;
}
function B0(e, n, t) {
  if (!n) return e;
  if (Array.isArray(n)) return (U_(n, (e * 255) / t) * t) / 255;
  let i = (e * 255) / t,
    r = n.shadowInput ?? 0,
    o = n.highlightInput ?? 255,
    a = Math.max(0.01, n.midtoneInput ?? 1),
    s = Math.max(0, Math.min(1, (i - r) / Math.max(1e-6, o - r))),
    c = n.shadowOutput ?? 0,
    l = n.highlightOutput ?? 255;
  return ((c + Math.pow(s, 1 / a) * (l - c)) * t) / 255;
}
function Go(e, n, t) {
  let i = Math.max(e, n, t),
    r = Math.min(e, n, t),
    o = i - r,
    a = 0,
    s = (i + r) / 2;
  o && (a = 60 * (i === e ? ((n - t) / o) % 6 : i === n ? (t - e) / o + 2 : (e - n) / o + 4));
  let c = o ? o / (1 - Math.abs(2 * s - 1)) : 0;
  return [(a + 360) % 360, c, s];
}
function Z0(e, n, t) {
  let i = (1 - Math.abs(2 * t - 1)) * n,
    r = i * (1 - Math.abs(((e / 60) % 2) - 1)),
    o = t - i / 2,
    [a, s, c] =
      e < 60
        ? [i, r, 0]
        : e < 120
          ? [r, i, 0]
          : e < 180
            ? [0, i, r]
            : e < 240
              ? [0, r, i]
              : e < 300
                ? [r, 0, i]
                : [i, 0, r];
  return [a + o, s + o, c + o];
}
function H0(e, n) {
  let t = Math.abs(((e - n + 540) % 360) - 180);
  return t <= 30 ? 1 : t >= 60 ? 0 : (60 - t) / 30;
}
function P_(e, n, t) {
  if (!n || !['a', 'b', 'c', 'd'].every(c => Number.isFinite(n[c]))) return H0(e, t);
  let i = n.a,
    r = n.b,
    o = n.c,
    a = n.d;
  for (; r < i;) r += 360;
  for (; o < r;) o += 360;
  for (; a < o;) a += 360;
  let s = 0;
  for (let c = e - 360; c <= e + 720; c += 360)
    c < i ||
      c > a ||
      (s = Math.max(
        s,
        c < r ? (c - i) / Math.max(1e-6, r - i) : c <= o ? 1 : (a - c) / Math.max(1e-6, a - o)
      ));
  return Math.max(0, Math.min(1, s));
}
var z0 = new WeakMap();
function T_(e, n) {
  let t = z0.get(e);
  t || ((t = new Map()), z0.set(e, t));
  let i = t.get(n);
  if (i) return i;
  let r;
  return (
    e.type === 'levels' || e.type === 'curves'
      ? (r = {
          kind: 'lut',
          tables: ['red', 'green', 'blue'].map(s => {
            let c = new Float32Array(256);
            for (let l = 0; l < 256; l++) {
              let f = (l * n) / 255;
              c[l] = B0(B0(f, e.rgb, n), e[s], n);
            }
            return c;
          }),
        })
      : e.type === 'hue/saturation'
        ? (r = { kind: 'hue', value: e })
        : (r = { kind: 'direct', value: e }),
    t.set(n, r),
    r
  );
}
function R_(e, n, t) {
  let i = Math.max(0, Math.min(255, (n * 255) / t)),
    r = Math.floor(i),
    o = Math.min(255, r + 1),
    a = i - r;
  return e[r] + (e[o] - e[r]) * a;
}
function Vt(e) {
  return Math.max(0, Math.min(1, e));
}
function B_(e, n, t = !1) {
  let i = [
      { position: 0, color: { r: 0, g: 0, b: 0 } },
      { position: 1, color: { r: 255, g: 255, b: 255 } },
    ],
    r = (e?.length ? e : i)
      .map(s => ({ ...s, position: Vt(s.position) }))
      .sort((s, c) => s.position - c.position),
    o = t ? 1 - n : n;
  if (o <= r[0].position) {
    let s = r[0].color;
    return [s.r / 255, s.g / 255, s.b / 255];
  }
  for (let s = 1; s < r.length; s++)
    if (o <= r[s].position) {
      let c = r[s - 1],
        l = r[s],
        f = (o - c.position) / Math.max(1e-6, l.position - c.position);
      return [
        c.color.r + (l.color.r - c.color.r) * f,
        c.color.g + (l.color.g - c.color.g) * f,
        c.color.b + (l.color.b - c.color.b) * f,
      ].map(d => d / 255);
    }
  let a = r[r.length - 1].color;
  return [a.r / 255, a.g / 255, a.b / 255];
}
function z_(e, n, t, i) {
  let r = n,
    o = t,
    a = i,
    s = () => 0.2126 * r + 0.7152 * o + 0.0722 * a;
  if (e.type === 'brightness/contrast') {
    let c = (e.brightness || 0) / 100,
      l = Math.max(-0.99, Math.min(0.99, (e.contrast || 0) / 100)),
      f = (1 + l) / (1 - l);
    ((r = (r - 0.5) * f + 0.5 + c), (o = (o - 0.5) * f + 0.5 + c), (a = (a - 0.5) * f + 0.5 + c));
  } else if (e.type === 'exposure') {
    let c = Math.pow(2, e.exposure || 0),
      l = e.offset || 0,
      f = Math.max(0.01, e.gamma ?? 1);
    ((r = Math.pow(Math.max(0, r * c + l), 1 / f)),
      (o = Math.pow(Math.max(0, o * c + l), 1 / f)),
      (a = Math.pow(Math.max(0, a * c + l), 1 / f)));
  } else if (e.type === 'invert') ((r = 1 - r), (o = 1 - o), (a = 1 - a));
  else if (e.type === 'channel mixer') {
    let c = (l, f) => {
      let d = l || f;
      return (
        (r * (d.red ?? 0)) / 100 +
        (o * (d.green ?? 0)) / 100 +
        (a * (d.blue ?? 0)) / 100 +
        (d.constant ?? 0) / 100
      );
    };
    e.monochrome
      ? (r = o = a = c(e.gray, { red: 40, green: 40, blue: 20 }))
      : ([r, o, a] = [
          c(e.red, { red: 100 }),
          c(e.green, { green: 100 }),
          c(e.blue, { blue: 100 }),
        ]);
  } else if (e.type === 'color balance') {
    let c = Go(r, o, a)[2],
      l = s(),
      f = [
        { value: e.shadows, weight: Vt((0.5 - l) * 2) },
        { value: e.midtones, weight: 1 - Math.abs(l - 0.5) * 2 },
        { value: e.highlights, weight: Vt((l - 0.5) * 2) },
      ];
    for (let { value: d, weight: u } of f)
      d &&
        u > 0 &&
        ((r += ((d.cyanRed || 0) / 100) * u),
        (o += ((d.magentaGreen || 0) / 100) * u),
        (a += ((d.yellowBlue || 0) / 100) * u));
    if (e.preserveLuminosity) {
      let [d, u] = Go(Vt(r), Vt(o), Vt(a));
      [r, o, a] = Z0(d, u, c);
    }
  } else if (e.type === 'black & white') {
    let [c, l] = Go(r, o, a),
      f = [0, 60, 120, 180, 240, 300],
      d = [
        e.reds ?? 40,
        e.yellows ?? 60,
        e.greens ?? 40,
        e.cyans ?? 60,
        e.blues ?? 20,
        e.magentas ?? 80,
      ],
      u = 0,
      h = 0;
    for (let _ = 0; _ < f.length; _++) {
      let b = H0(c, f[_]);
      ((u += d[_] * b), (h += b));
    }
    r = o = a = s() + (((h ? u / h : 50) - 50) / 100) * l * 0.5;
  } else if (e.type === 'threshold') r = o = a = s() * 255 >= (e.level ?? 128) ? 1 : 0;
  else if (e.type === 'posterize') {
    let c = Math.max(2, Math.min(255, Math.round(e.levels ?? 4))),
      l = f => Math.round(f * (c - 1)) / (c - 1);
    ((r = l(r)), (o = l(o)), (a = l(a)));
  } else e.type === 'gradient map' && ([r, o, a] = B_(e.stops, Vt(s()), e.reverse));
  return [Vt(r), Vt(o), Vt(a)];
}
function N_(e, n, t, i, r, o) {
  let a = t === 4 ? 3 : t;
  if (i.kind === 'lut') {
    for (let s = 0; s < a; s++) {
      let c = e[n + s],
        l = R_(i.tables[Math.min(s, 2)], c, r);
      e[n + s] = c + (l - c) * o;
    }
    return;
  }
  if (i.kind === 'direct') {
    if (a >= 3) {
      let s = e[n],
        c = e[n + 1],
        l = e[n + 2],
        f = z_(i.value, s / r, c / r, l / r);
      ((e[n] = s + (f[0] * r - s) * o),
        (e[n + 1] = c + (f[1] * r - c) * o),
        (e[n + 2] = l + (f[2] * r - l) * o));
    }
    return;
  }
  if (a >= 3) {
    let s = i.value,
      c = e[n],
      l = e[n + 1],
      f = e[n + 2],
      [d, u, h] = Go(c / r, l / r, f / r);
    if (s.colorize && s.colorizeEnabled !== !1) {
      ((d = (s.colorize.hue + 360) % 360),
        (u = Math.max(0, Math.min(1, s.colorize.saturation / 100))));
      let y = Math.max(-1, Math.min(1, s.colorize.lightness / 100));
      h = y < 0 ? h * (1 + y) : h + (1 - h) * y;
    } else {
      let y = d,
        w = (A, M) => {
          !A ||
            M <= 0 ||
            ((d = (d + (A.hue || 0) * M + 360) % 360),
            (u = Math.max(0, Math.min(1, u + ((A.saturation || 0) / 100) * M))),
            (h = Math.max(0, Math.min(1, h + ((A.lightness || 0) / 100) * M))));
        };
      w(s.master, 1);
      let m = [
        ['reds', 0],
        ['yellows', 60],
        ['greens', 120],
        ['cyans', 180],
        ['blues', 240],
        ['magentas', 300],
      ];
      for (let [A, M] of m) {
        let k = s[A];
        w(k, P_(y, k, M));
      }
    }
    let p = Z0(d, u, h),
      _ = p[0] * r,
      b = p[1] * r,
      g = p[2] * r;
    ((e[n] = c + (_ - c) * o), (e[n + 1] = l + (b - l) * o), (e[n + 2] = f + (g - f) * o));
  }
}
var N0 = new WeakMap();
function X0(e, n = !1) {
  return {
    id: e.id,
    data: e.data,
    adjustment: e.adjustment,
    visible: n ? !0 : e.visible,
    opacity: n ? 1 : e.opacity,
    blendMode: n ? 'normal' : e.blendMode,
    offsetX: e.offsetX,
    offsetY: e.offsetY,
    clipped: n ? !1 : e.clipped,
    width: e.width,
    height: e.height,
    channels: e.channels,
    isFloat: e.isFloat,
    typeMax: e.typeMax,
    maskCondition: e.maskCondition,
    mask: e.rasterMask,
    maskData: e.rasterMask?.data,
  };
}
function K0(e, n) {
  if (e.length !== n.length) return !1;
  for (let t = 0; t < e.length; t++) {
    let i = e[t],
      r = n[t];
    if (
      i.id !== r.id ||
      i.data !== r.data ||
      i.adjustment !== r.adjustment ||
      i.visible !== r.visible ||
      i.opacity !== r.opacity ||
      i.blendMode !== r.blendMode ||
      i.offsetX !== r.offsetX ||
      i.offsetY !== r.offsetY ||
      i.clipped !== r.clipped ||
      i.width !== r.width ||
      i.height !== r.height ||
      i.channels !== r.channels ||
      i.isFloat !== r.isFloat ||
      i.typeMax !== r.typeMax ||
      i.maskCondition !== r.maskCondition ||
      i.mask !== r.mask ||
      i.maskData !== r.maskData
    )
      return !1;
  }
  return !0;
}
function j_(e, n, t) {
  let i = [];
  for (let r = 0; r < e.length;) {
    let o = e[r];
    if (o.clipped || !o.data) {
      (i.push(o), r++);
      continue;
    }
    let a = r + 1;
    for (; a < e.length && e[a].clipped;) a++;
    if (a === r + 1) {
      (i.push(o), r++);
      continue;
    }
    let s = e.slice(r, a),
      c = s.map((d, u) => X0(d, u === 0)),
      l = N0.get(o),
      f;
    if (l && l.width === n && l.height === t && K0(l.snapshots, c))
      ($o.clippingHits++, (f = l.surface));
    else {
      $o.clippingMisses++;
      let d = { ...o, visible: !0, opacity: 1, blendMode: 'normal', clipped: !1 };
      ((f = Y0([d, ...s.slice(1)], n, t)),
        N0.set(o, { snapshots: c, width: n, height: t, surface: f }));
    }
    (i.push({
      ...o,
      data: f.data,
      width: n,
      height: t,
      channels: f.channels,
      isFloat: f.isFloat,
      typeMax: f.typeMax,
      offsetX: 0,
      offsetY: 0,
      rasterMask: void 0,
      clipped: !1,
    }),
      (r = a));
  }
  return i;
}
function W0(e, n, t) {
  return Y0(j_(e, n, t), n, t);
}
function Y0(e, n, t) {
  let i = e.filter(
      g =>
        g &&
        g.visible !== !1 &&
        (g.opacity ?? 1) > 0 &&
        (g.data || (g.kind === 'adjustment' && g.adjustment))
    ),
    r = i.length ? D_(i) : 1,
    o = i.find(g => g.data)?.typeMax ?? 1,
    a = n * t,
    s = new Float32Array(a * r);
  r !== 4 && s.fill(NaN);
  let c = new Float32Array(a),
    l = new Float32Array(r),
    f = 0,
    d = null;
  for (let g = 0; g < i.length; g++) {
    let y = i[g],
      w = Math.round(y.offsetX ?? 0),
      m = Math.round(y.offsetY ?? 0),
      A = Math.max(0, Math.min(1, y.opacity ?? 1)),
      M = k_.has(y.blendMode ?? 'normal') ? (y.blendMode ?? 'normal') : 'normal',
      k = il.has(M),
      E = A_.has(M),
      F = M === 'mask',
      I = Math.max(0, w),
      C = Math.max(0, m),
      B = Math.min(n, w + y.width),
      ee = Math.min(t, m + y.height),
      $ = y.clipped ? d : null;
    if (!(y.clipped && !$)) {
      if (y.kind === 'adjustment' && y.adjustment) {
        let U = o,
          V = T_(y.adjustment, U);
        for (let X = 0; X < t; X++)
          for (let ie = 0; ie < n; ie++) {
            let H = X * n + ie;
            if (!c[H]) continue;
            let R = $ ? ($[H] > 0 ? 1 : 0) : 1,
              P = A * rl(y, ie, X) * R;
            P > 0 && N_(s, H * r, r, V, U, P);
          }
        continue;
      }
      if (M === 'normal' && !y.rasterMask && !y.clipped)
        f = C_(y, s, c, r, n, I, C, B, ee, w, m, A, f, o);
      else if (
        E &&
        r === 4 &&
        y.channels === 4 &&
        !y.rasterMask &&
        !y.clipped &&
        w === 0 &&
        m === 0 &&
        y.width === n &&
        y.height === t
      )
        f = O_(y, s, c, M, A, f, o);
      else
        for (let U = C; U < ee; U++) {
          let V = U - m;
          for (let X = I; X < B; X++) {
            let ie = X - w,
              H = U * n + X,
              R = H * r,
              P = !k && !F ? o / (y.typeMax || o) : 1;
            if ((M_(y, ie, V, r, l, P), F)) {
              let Ee = y.channels >= 3 ? 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2] : l[0];
              if (c[H] && !I_(Ee, y.maskCondition)) {
                for (let we = 0; we < r; we++) s[R + we] = r === 4 ? 0 : NaN;
                ((c[H] = 0), f--);
              }
              continue;
            }
            let N = rl(y, X, U),
              z = $ ? $[H] : 1;
            if (k) {
              let Ee = A * N * z;
              if (Ee <= 0) continue;
              if (!c[H]) {
                for (let we = 0; we < r; we++) s[R + we] = l[we];
                ((c[H] = 1), f++);
                continue;
              }
              for (let we = 0; we < r; we++) {
                let Ue = s[R + we],
                  yt = F_(Ue, l[we], M);
                s[R + we] =
                  Ee >= 1
                    ? yt
                    : Number.isFinite(yt) && Number.isFinite(Ue)
                      ? Ue + (yt - Ue) * Ee
                      : NaN;
              }
              continue;
            }
            if (!E) continue;
            let Z = G0(y, X, U);
            if (Z <= 0 || z <= 0) continue;
            if (!Number.isFinite(Z) || !Number.isFinite(z)) {
              f += kr(s, c, H, R, r);
              continue;
            }
            let te = Z * z;
            if (te <= 0) continue;
            let Y = c[H],
              se = te + Y * (1 - te),
              ke = r === 4 ? 3 : r;
            for (let Ee = 0; Ee < ke; Ee++) {
              let we = l[Ee],
                Ue = s[R + Ee];
              s[R + Ee] = V0(Ue, we, M, te, Y, se, o);
            }
            (Y || f++, (c[H] = se), r === 4 && (s[R + 3] = se));
          }
        }
      y.clipped || (d = i[g + 1]?.clipped ? L_(y, n, t) : null);
    }
  }
  let u = i.some(g => g.isFloat) || i.some(g => il.has(g.blendMode ?? 'normal')),
    h = o;
  if (r === 4) for (let g = 0; g < a; g++) s[g * 4 + 3] *= h;
  let p = 1 / 0,
    _ = -1 / 0,
    b = r === 4 ? 3 : r;
  for (let g = 0; g < a; g++)
    if (c[g])
      for (let y = 0; y < b; y++) {
        let w = s[g * r + y];
        Number.isFinite(w) && ((p = Math.min(p, w)), (_ = Math.max(_, w)));
      }
  return (
    p === 1 / 0 && ((p = 0), (_ = 0)),
    {
      data: s,
      width: n,
      height: t,
      channels: r,
      isFloat: u,
      typeMax: h,
      stats: { min: p, max: _ },
      coveredCount: f,
    }
  );
}
function q0(e, n, t) {
  return W0($0(e, n, t), n, t);
}
var V_ = 15e7,
  sh = 600 * 1024 * 1024,
  J0 = 512 * 1024 * 1024,
  Q0 = 768 * 1024 * 1024,
  ol = [137, 80, 78, 71, 13, 10, 26, 10],
  eh = !1;
function G_() {
  eh ||
    ((0, Ir.initializeCanvas)(
      (e, n) => ({ width: e, height: n }),
      (e, n) => ({ width: e, height: n, data: new Uint8ClampedArray(e * n * 4) })
    ),
    (eh = !0));
}
function Fr(e, n, t = 4) {
  if (!Number.isSafeInteger(e) || !Number.isSafeInteger(n) || e <= 0 || n <= 0)
    throw new Error(`Invalid preview dimensions: ${e}x${n}`);
  let i = e * n;
  if (!Number.isSafeInteger(i) || i > V_ || i * t > sh)
    throw new Error(`Preview dimensions exceed the safety limit: ${e}x${n}`);
}
var sl = P0;
function Sn(e, n) {
  let t = n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return e.match(new RegExp(`\\b${t}\\s*=\\s*["']([^"']*)["']`, 'i'))?.[1];
}
function Ai(e) {
  return e ? new TextDecoder('utf-8', { fatal: !1 }).decode(e) : '';
}
function $_(e, n) {
  let t = 0;
  for (; n.exec(e);) t++;
  return t;
}
function lh(e) {
  return e.replace(/&(?:amp|lt|gt|quot|apos|#\d+|#x[0-9a-f]+);/gi, n => {
    let t = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&apos;': "'" };
    if (t[n]) return t[n];
    let i = /^&#x([0-9a-f]+);$/i.exec(n),
      r = /^&#(\d+);$/.exec(n),
      o = i ? parseInt(i[1], 16) : r ? parseInt(r[1], 10) : NaN;
    return Number.isFinite(o) && o >= 0 && o <= 1114111 ? String.fromCodePoint(o) : n;
  });
}
function ll(e) {
  let n = {},
    t = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g,
    i;
  for (; (i = t.exec(e));) n[i[1]] = lh(i[2] ?? i[3] ?? '');
  return n;
}
function Z_(e) {
  let n = [],
    t = [],
    i = /<\s*(\/?)\s*(stack|layer)\b([^>]*?)(\/?)\s*>/gi,
    r,
    o = 0;
  for (; (r = i.exec(e));) {
    let a = r[1] === '/',
      s = r[2].toLowerCase();
    if (a) {
      s === 'stack' && t.length && t.pop();
      continue;
    }
    let c = { tag: s, attrs: ll(r[3]), children: [] };
    if (++o > 1e5) throw new Error('OpenRaster layer tree exceeds the node safety limit');
    let l = t[t.length - 1];
    if (((l ? l.children : n).push(c), s === 'stack' && r[4] !== '/')) {
      if (t.length >= 4096) throw new Error('OpenRaster group nesting exceeds the safety limit');
      t.push(c);
    }
  }
  return n.length === 1 && n[0].tag === 'stack' && !n[0].attrs.name ? n[0].children : n;
}
function Ii(e, n) {
  let t = Number(e);
  return Number.isFinite(t) ? t : n;
}
function H_(e) {
  return e !== 'hidden';
}
function ch(e) {
  if (!e || e === 'svg:src-over' || e === 'normal') return 'normal';
  let n = e.replace(/^svg:/, '').replace(/^krita:/, '');
  return (
    {
      multiply: 'multiply',
      screen: 'screen',
      overlay: 'overlay',
      darken: 'darken',
      'darken-only': 'darken',
      lighten: 'lighten',
      'lighten-only': 'lighten',
      difference: 'difference',
      exclusion: 'exclusion',
    }[n] || e
  );
}
function fh(e) {
  return ch(e);
}
function X_(e, n, t) {
  switch (t) {
    case 'multiply':
      return (e * n) / 255;
    case 'screen':
      return 255 - ((255 - e) * (255 - n)) / 255;
    case 'overlay':
      return e <= 127.5 ? (2 * e * n) / 255 : 255 - (2 * (255 - e) * (255 - n)) / 255;
    case 'darken':
      return Math.min(e, n);
    case 'lighten':
      return Math.max(e, n);
    case 'difference':
      return Math.abs(e - n);
    case 'exclusion':
      return e + n - (2 * e * n) / 255;
    default:
      return n;
  }
}
function K_(e, n, t, i = 'normal') {
  let r = Math.min(e.length, n.length) / 4;
  for (let o = 0; o < r; o++) {
    let a = o * 4,
      s = (n[a + 3] / 255) * t;
    if (s <= 0) continue;
    let c = e[a + 3] / 255,
      l = s + c * (1 - s);
    for (let f = 0; f < 3; f++) {
      let d = n[a + f],
        u = e[a + f],
        h = X_(u, d, i);
      e[a + f] = l > 0 ? Math.round(((1 - s) * c * u + (1 - c) * s * d + c * s * h) / l) : 0;
    }
    e[a + 3] = Math.round(l * 255);
  }
}
function W_(e, n, t, i) {
  let r = new Uint8Array(e.length);
  for (let o = 0; o < i.height; o++)
    for (let a = 0; a < i.width; a++) {
      let s = i.x + a,
        c = i.y + o;
      if (s < 0 || c < 0 || s >= n || c >= t) continue;
      let l = (o * i.width + a) * 4,
        f = (c * n + s) * 4;
      r.set(i.data.subarray(l, l + 4), f);
    }
  return r;
}
function Y_(e, n) {
  let t = 0,
    i = 0,
    r = 0,
    o = Math.min(e.length, n.length) / 4;
  for (let a = 0; a < o; a++) {
    let s = !1;
    for (let c = 0; c < 4; c++) {
      let l = Math.abs(e[a * 4 + c] - n[a * 4 + c]);
      ((t += l), (i = Math.max(i, l)), s || (s = l > 1));
    }
    s && r++;
  }
  return {
    available: !0,
    meanAbsoluteError: o ? t / (o * 4) : 0,
    maxAbsoluteError: i,
    differentPixelRatio: o ? r / o : 0,
  };
}
function uh(e, n, t) {
  let i = e['tiff-visualizer/numeric-layers.json'];
  if (i)
    try {
      let r = JSON.parse(new TextDecoder().decode(i));
      if (r?.version !== 1 || !Array.isArray(r.layers))
        throw new Error('unsupported manifest version');
      let o = 0;
      for (let a of r.layers) {
        let s = n.find(u => u.sourcePath === a.sourcePath),
          c = e[a.dataPath];
        if (
          !s ||
          !c ||
          !Number.isInteger(a.width) ||
          !Number.isInteger(a.height) ||
          !Number.isInteger(a.channels) ||
          a.width <= 0 ||
          a.height <= 0 ||
          a.channels < 1 ||
          a.channels > 4
        )
          continue;
        let l = a.width * a.height * a.channels,
          f = c.slice().buffer,
          d;
        (a.storage === 'uint8'
          ? (d = new Uint8Array(f))
          : a.storage === 'uint16'
            ? (d = new Uint16Array(f))
            : a.storage === 'float64'
              ? (d = new Float64Array(f))
              : (d = new Float32Array(f)),
          d.length === l &&
            (Object.assign(s, {
              data: d,
              width: a.width,
              height: a.height,
              channels: a.channels,
              isFloat: a.isFloat,
              typeMax: a.typeMax,
              sourceNumericType: a.numericType,
              x: a.x,
              y: a.y,
              support: 'native',
            }),
            o++));
      }
      o &&
        t.push(
          `${o} high-precision raster layer${o === 1 ? '' : 's'} restored with exact TIFF Visualizer sample data`
        );
    } catch (r) {
      t.push(
        `TIFF Visualizer high-precision layer metadata could not be restored: ${r instanceof Error ? r.message : String(r)}`
      );
    }
}
async function q_(e, n, t, i, r, o, a = !1) {
  let s = Z_(i),
    c = new Set(),
    l = E =>
      E.forEach(F => {
        (F.tag === 'layer' &&
          F.attrs.src &&
          c.add(F.attrs.src.replace(/\\/g, '/').replace(/^\.\//, '')),
          l(F.children));
      });
  l(s);
  let f = cl(e, E => c.has(E) || E.startsWith('tiff-visualizer/')),
    d = [],
    u = [];
  i.trim() || u.push('OpenRaster stack.xml is missing; only the integrated preview is available');
  let h = 0,
    p = new Set([
      'normal',
      'multiply',
      'screen',
      'overlay',
      'darken',
      'lighten',
      'difference',
      'exclusion',
    ]),
    _ = async (E, F = [], I = [], C = void 0, B = 0, ee = 0) =>
      T0(E, async $ => {
        let U = `ora-node-${h++}`,
          V = $.attrs.name || ($.tag === 'stack' ? 'Group' : `Layer ${h}`),
          X = B + Math.trunc(Ii($.attrs.x, 0)),
          ie = ee + Math.trunc(Ii($.attrs.y, 0)),
          H = Math.max(0, Math.min(1, Ii($.attrs.opacity, 1))),
          R = H_($.attrs.visibility),
          P = ch($.attrs['composite-op']),
          N = p.has(P) ? 'native' : 'approximate';
        p.has(P) ||
          u.push(`\u201C${V}\u201D uses ${P}; reconstruction currently approximates it as normal`);
        let z = {
          id: U,
          name: V,
          kind: $.tag === 'stack' ? 'group' : 'raster',
          support: N,
          visible: R,
          opacity: H,
          blendMode: P,
          left: X,
          top: ie,
        };
        if ($.tag === 'stack')
          return (
            d.push({
              nodeId: U,
              name: V,
              sourcePath: '',
              kind: 'group',
              parentId: C,
              width: r,
              height: o,
              x: 0,
              y: 0,
              opacity: H,
              visible: R,
              blendMode: P,
              groupPath: F,
              groupIds: I,
              support: N,
            }),
            (z.children = await _($.children, [...F, V], [...I, U], U, X, ie)),
            z
          );
        let Z = ($.attrs.src || '').replace(/\\/g, '/').replace(/^\.\//, ''),
          te = f[Z];
        if (!te)
          return (
            (z.support = 'unsupported'),
            (z.warnings = [`Missing layer entry: ${Z || '(none)'}`]),
            u.push(`Layer \u201C${V}\u201D has no decodable source entry`),
            z
          );
        try {
          let Y = await sl(te);
          ((z.width = Y.width),
            (z.height = Y.height),
            d.push({
              nodeId: U,
              name: V,
              sourcePath: Z,
              kind: 'raster',
              parentId: C,
              data: Y.data,
              width: Y.width,
              height: Y.height,
              x: X,
              y: ie,
              opacity: H,
              visible: R,
              blendMode: P,
              groupPath: F,
              groupIds: I,
              support: N,
            }));
        } catch (Y) {
          ((z.support = 'unsupported'),
            (z.warnings = [Y instanceof Error ? Y.message : String(Y)]),
            u.push(`Layer \u201C${V}\u201D could not be decoded`));
        }
        return z;
      }),
    b = await _(s);
  uh(f, d, u);
  let g = new Map(d.map(E => [E.nodeId, E])),
    y = E => {
      let F = new Uint8Array(r * o * 4);
      for (let I of [...E].reverse()) {
        if (!I.visible || I.opacity <= 0) continue;
        let C =
          I.kind === 'group'
            ? y(I.children || [])
            : (() => {
                let B = g.get(I.id);
                return B ? W_(F, r, o, B) : new Uint8Array(F.length);
              })();
        K_(F, C, I.opacity, p.has(I.blendMode || 'normal') ? I.blendMode : 'normal');
      }
      return F;
    },
    w = y(b),
    m = !a && t.width === r && t.height === o,
    M =
      d.filter(E => E.kind !== 'group' && E.data).length === 0
        ? { available: !1 }
        : m
          ? Y_(t.data, w)
          : { available: !0 };
  m &&
    (M.differentPixelRatio || 0) > 0.01 &&
    u.push(
      `Reconstruction differs from the integrated preview in ${((M.differentPixelRatio || 0) * 100).toFixed(2)}% of pixels`
    );
  let k = {
    format: 'ora',
    width: r,
    height: o,
    bitDepth: 8,
    colorMode: 'RGBA',
    previewKind: 'merged',
    previewIsAuthoritative: n === 'mergedimage.png' && (a || (t.width === r && t.height === o)),
    previewWidth: t.width,
    previewHeight: t.height,
    layerCount: d.length,
    root: b,
    warnings: u,
    reconstruction: M,
  };
  return {
    ...t,
    channels: 4,
    bitDepth: 8,
    sampleFormat: 1,
    ...(a ? {} : { integratedData: t.data }),
    ...(d.length ? { reconstructedData: w } : {}),
    layerAssets: d,
    formatLabel: 'OpenRaster integrated preview',
    formatType: 'ora',
    document: k,
    metadata: {
      container: 'ZIP',
      previewEntry: n,
      previewAuthoritative: k.previewIsAuthoritative,
      layerCount: d.length,
      documentWidth: r,
      documentHeight: o,
      reconstructionMeanError: M.meanAbsoluteError ?? 0,
      reconstructionDifferentPixels: M.differentPixelRatio ?? 0,
      layersOnly: a,
    },
  };
}
function J_(e) {
  let n = [],
    t = [],
    i = /<\s*(\/?)\s*(layer|mask)\b([^>]*?)(\/?)\s*>/gi,
    r,
    o = 0;
  for (; (r = i.exec(e));) {
    let a = r[1] === '/',
      s = r[2].toLowerCase();
    if (a) {
      s === 'layer' && t.length && t.pop();
      continue;
    }
    if (++o > 1e5) throw new Error('Krita layer tree exceeds the node safety limit');
    let c = ll(r[3]);
    if (s === 'mask') {
      t[t.length - 1]?.masks.push(c);
      continue;
    }
    let l = { attrs: c, children: [], masks: [] },
      f = t[t.length - 1];
    ((f ? f.children : n).push(l), r[4] !== '/' && t.push(l));
  }
  return n;
}
function bt(e, n, t, i = '') {
  let r = t.replace(/\\/g, '/').replace(/^\/+/, '') + i;
  return (
    [`${n}/layers/${r}`, `layers/${r}`].find(a => !!e[a]) ||
    Object.keys(e).find(a => a.endsWith(`/layers/${r}`))
  );
}
function Q_(e) {
  let n = {},
    t = /<(?:param|property)\b([^>]*)>([\s\S]*?)<\/(?:param|property)\s*>/gi,
    i,
    r = 0;
  for (; (i = t.exec(e));) {
    if (++r > 1e4) throw new Error('Filter configuration exceeds the parameter safety limit');
    let o = ll(i[1]).name;
    o && (n[o] = lh(i[2].replace(/<[^>]*>/g, '').trim()));
  }
  return n;
}
function Xe(e, n, t) {
  for (let i of n) {
    let r = Number(e[i]);
    if (Number.isFinite(r)) return r;
  }
  return t;
}
function th(e, n, t = !1) {
  for (let i of n) if (i in e) return /^(?:1|true|yes|on)$/i.test(e[i]);
  return t;
}
function nh(e, n) {
  let t = (e || Sn(n, 'name') || '').toLowerCase().replace(/[^a-z0-9]+/g, ''),
    i = Q_(n);
  if (t === 'levels') {
    let r = (i.lightness || '').split(';').map(Number),
      o =
        r.length >= 5 && r.every(Number.isFinite)
          ? r
          : [
              Xe(i, ['blackvalue'], 0) / 255,
              Xe(i, ['whitevalue'], 255) / 255,
              Xe(i, ['gammavalue'], 1),
              Xe(i, ['outblackvalue'], 0) / 255,
              Xe(i, ['outwhitevalue'], 255) / 255,
            ];
    return {
      type: 'levels',
      rgb: {
        shadowInput: o[0] * 255,
        highlightInput: o[1] * 255,
        midtoneInput: o[2],
        shadowOutput: o[3] * 255,
        highlightOutput: o[4] * 255,
      },
    };
  }
  if (['hsvadjustment', 'huesaturation', 'hsladjustment'].includes(t)) {
    let r = th(i, ['colorize']),
      o = {
        hue: Xe(i, ['h', 'hue'], 0),
        saturation: Xe(i, ['s', 'saturation'], r ? 100 : 0),
        lightness: Xe(i, ['v', 'l', 'lightness', 'value'], 0),
      };
    return r
      ? {
          type: 'hue/saturation',
          master: { hue: 0, saturation: 0, lightness: 0 },
          colorize: o,
          colorizeEnabled: !0,
        }
      : {
          type: 'hue/saturation',
          master: o,
          colorize: { hue: 0, saturation: 100, lightness: 0 },
          colorizeEnabled: !1,
        };
  }
  if (t === 'invert') return { type: 'invert' };
  if (t === 'threshold')
    return { type: 'threshold', level: Xe(i, ['threshold', 'level', 'value'], 128) };
  if (t === 'posterize')
    return { type: 'posterize', levels: Xe(i, ['steps', 'levels', 'value'], 4) };
  if (['brightnesscontrast', 'brightnessandcontrast'].includes(t))
    return {
      type: 'brightness/contrast',
      brightness: Xe(i, ['brightness'], 0),
      contrast: Xe(i, ['contrast'], 0),
    };
  if (t === 'colorbalance') {
    let r = o => ({
      cyanRed: Xe(i, [`${o}_cyan_red`, `${o}CyanRed`, `cyan_red_${o}`], 0),
      magentaGreen: Xe(i, [`${o}_magenta_green`, `${o}MagentaGreen`, `magenta_green_${o}`], 0),
      yellowBlue: Xe(i, [`${o}_yellow_blue`, `${o}YellowBlue`, `yellow_blue_${o}`], 0),
    });
    return {
      type: 'color balance',
      shadows: r('shadows'),
      midtones: r('midtones'),
      highlights: r('highlights'),
      preserveLuminosity: th(i, ['preserve_luminosity', 'preserveLuminosity'], !0),
    };
  }
}
function e2(e, n) {
  let t = new Uint8Array(n),
    i = 0,
    r = 0;
  for (; i < e.length && r < t.length;) {
    let o = e[i++];
    if (o < 32) {
      let c = o + 1;
      if (i + c > e.length || r + c > t.length) throw new Error('Invalid Krita LZF literal');
      (t.set(e.subarray(i, i + c), r), (i += c), (r += c));
      continue;
    }
    let a = o >> 5,
      s = r - ((o & 31) << 8) - 1;
    if (a === 7) {
      if (i >= e.length) throw new Error('Invalid Krita LZF length');
      a += e[i++];
    }
    if (i >= e.length) throw new Error('Invalid Krita LZF back-reference');
    if (((s -= e[i++]), (a += 2), s < 0 || r + a > t.length))
      throw new Error('Invalid Krita LZF range');
    for (let c = 0; c < a; c++) t[r++] = t[s++];
  }
  if (r !== n) throw new Error(`Krita LZF tile decoded to ${r} bytes instead of ${n}`);
  return t;
}
function ki(e, n) {
  let t = n.offset;
  for (; n.offset < e.length && e[n.offset] !== 10;) n.offset++;
  let i = new TextDecoder('ascii').decode(e.subarray(t, n.offset)).replace(/\r$/, '');
  return (n.offset < e.length && n.offset++, i);
}
function Ar(e, n, t, i, r) {
  let o = { offset: 0 },
    a = ki(e, o);
  if (a !== 'VERSION 2')
    throw new Error(`Unsupported Krita tile stream: ${a || 'missing version'}`);
  let s = Number(ki(e, o).split(/\s+/)[1]),
    c = Number(ki(e, o).split(/\s+/)[1]),
    l = Number(ki(e, o).split(/\s+/)[1]),
    f = Number(ki(e, o).split(/\s+/)[1]);
  if (s !== 64 || c !== 64 || l !== i || !Number.isSafeInteger(f) || f < 0 || f > 1e6)
    throw new Error(`Unsupported Krita tile geometry or pixel size (${s}x${c}, ${l} B)`);
  let d = i === 4 ? 4 : 1,
    u = new Uint8Array(n * t * d);
  if (r?.length)
    for (let p = 0; p < n * t; p++)
      i === 4
        ? ((u[p * 4] = r[2] || 0),
          (u[p * 4 + 1] = r[1] || 0),
          (u[p * 4 + 2] = r[0] || 0),
          (u[p * 4 + 3] = r[3] || 0))
        : (u[p] = r[0] || 0);
  let h = s * c * l;
  for (let p = 0; p < f; p++) {
    let _ = ki(e, o).split(',');
    if (_.length !== 4 || _[2] !== 'LZF') throw new Error('Invalid Krita tile header');
    let b = Number(_[0]),
      g = Number(_[1]),
      y = Number(_[3]);
    if (
      !Number.isSafeInteger(b) ||
      !Number.isSafeInteger(g) ||
      !Number.isSafeInteger(y) ||
      y < 1 ||
      o.offset + y > e.length
    )
      throw new Error('Invalid Krita tile payload size');
    let w = e.subarray(o.offset, o.offset + y);
    o.offset += y;
    let m;
    if (w[0] === 0) {
      if (w.length !== h + 1) throw new Error('Invalid raw Krita tile size');
      m = w.subarray(1);
    } else if (w[0] === 1) m = e2(w.subarray(1), h);
    else throw new Error(`Unsupported Krita tile compression flag: ${w[0]}`);
    let A = s * c;
    for (let M = 0; M < c; M++)
      for (let k = 0; k < s; k++) {
        let E = b + k,
          F = g + M;
        if (E < 0 || F < 0 || E >= n || F >= t) continue;
        let I = M * s + k,
          C = (F * n + E) * d;
        l === 4
          ? ((u[C] = m[2 * A + I]),
            (u[C + 1] = m[A + I]),
            (u[C + 2] = m[I]),
            (u[C + 3] = m[3 * A + I]))
          : (u[C] = m[I]);
      }
  }
  return u;
}
function t2(e, n, t, i, r, o, a = !1) {
  let s = J_(i),
    c = Sn(i, 'name') || '',
    l = new Set(),
    f = w =>
      w.forEach(m => {
        m.attrs.filename && l.add(m.attrs.filename);
        for (let A of m.masks) A.filename && l.add(A.filename);
        f(m.children);
      });
  f(s);
  let d = cl(
      e,
      w =>
        w.startsWith('tiff-visualizer/') ||
        [...l].some(
          m =>
            w.endsWith(`/layers/${m}`) ||
            w === `layers/${m}` ||
            w.endsWith(`/layers/${m}.defaultpixel`) ||
            w === `layers/${m}.defaultpixel` ||
            w.endsWith(`/layers/${m}.filterconfig`) ||
            w === `layers/${m}.filterconfig` ||
            w.endsWith(`/layers/${m}.pixelselection`) ||
            w === `layers/${m}.pixelselection` ||
            w.endsWith(`/layers/${m}.pixelselection.defaultpixel`) ||
            w === `layers/${m}.pixelselection.defaultpixel`
        )
    ),
    u = [],
    h = [],
    p = 0,
    _ = new Set([
      'normal',
      'multiply',
      'screen',
      'overlay',
      'darken',
      'lighten',
      'difference',
      'exclusion',
    ]),
    b = (w, m, A = [], M = []) =>
      w.map(k => {
        let E = k.attrs,
          F = E.uuid || `kra-node-${p++}`,
          I = E.name || `Layer ${p}`,
          C = Math.trunc(Ii(E.x, 0)),
          B = Math.trunc(Ii(E.y, 0)),
          ee = (E.nodetype || '').toLowerCase(),
          $ =
            ee === 'grouplayer'
              ? 'group'
              : ee === 'paintlayer'
                ? 'raster'
                : ee.includes('vector')
                  ? 'vector'
                  : ee === 'adjustmentlayer'
                    ? 'adjustment'
                    : 'unknown',
          U = Math.max(0, Math.min(1, Ii(E.opacity, 255) / 255)),
          V = E.visible !== '0',
          X = fh(E.compositeop),
          ie =
            $ === 'group' || $ === 'raster' ? (_.has(X) ? 'native' : 'approximate') : 'unsupported',
          H = {
            id: F,
            name: I,
            kind: $,
            support: ie,
            visible: V,
            opacity: U,
            blendMode: X,
            left: C,
            top: B,
          };
        if ($ === 'group') {
          E.passthrough === '1' &&
            ((ie = 'approximate'),
            (H.support = ie),
            h.push(
              `Pass-through group \u201C${I}\u201D is currently reconstructed as an isolated group`
            ));
          let P = {
              nodeId: F,
              name: I,
              sourcePath: '',
              kind: 'group',
              parentId: m,
              width: r,
              height: o,
              x: 0,
              y: 0,
              opacity: U,
              visible: V,
              blendMode: X,
              groupPath: A,
              groupIds: M,
              support: ie,
            },
            N = k.masks.find(
              z =>
                (z.nodetype || '').toLowerCase() === 'transparencymask' &&
                z.visible !== '0' &&
                z.filename
            );
          if (N?.filename)
            try {
              let z = bt(d, c, N.filename, '.pixelselection');
              if (!z) throw new Error('missing pixel data');
              let Z = bt(d, c, N.filename, '.pixelselection.defaultpixel');
              P.rasterMask = {
                data: Ar(d[z], r, o, 1, Z ? d[Z] : void 0),
                width: r,
                height: o,
                channels: 1,
                typeMax: 255,
                x: 0,
                y: 0,
              };
            } catch (z) {
              h.push(
                `Transparency mask for group \u201C${I}\u201D could not be decoded: ${z instanceof Error ? z.message : String(z)}`
              );
            }
          return (u.push(P), (H.children = b(k.children, F, [...A, I], [...M, F])), H);
        }
        if ($ === 'adjustment' && E.filename) {
          let P = bt(d, c, E.filename, '.filterconfig'),
            N = P ? nh(E.filtername, Ai(d[P])) : void 0;
          if (N) {
            H.support = 'approximate';
            let z = {
                nodeId: F,
                name: I,
                sourcePath: P || '',
                kind: 'adjustment',
                adjustment: N,
                parentId: m,
                width: r,
                height: o,
                x: 0,
                y: 0,
                opacity: U,
                visible: V,
                blendMode: X,
                groupPath: A,
                groupIds: M,
                support: 'approximate',
              },
              Z = bt(d, c, E.filename, '.pixelselection');
            if (Z) {
              let te = bt(d, c, E.filename, '.pixelselection.defaultpixel');
              z.rasterMask = {
                data: Ar(d[Z], r, o, 1, te ? d[te] : void 0),
                width: r,
                height: o,
                channels: 1,
                typeMax: 255,
                x: 0,
                y: 0,
              };
            }
            u.push(z);
          } else
            ((H.support = 'unsupported'),
              h.push(
                `Krita adjustment layer \u201C${I}\u201D uses unsupported filter \u201C${E.filtername || 'unknown'}\u201D`
              ));
          return H;
        }
        if ($ !== 'raster' || !E.filename)
          return (
            h.push(`Krita ${ee || 'unknown'} node \u201C${I}\u201D is not an ordinary paint layer`),
            H
          );
        let R = bt(d, c, E.filename);
        try {
          if (!R) throw new Error(`Missing paint data for ${E.filename}`);
          let P = bt(d, c, E.filename, '.defaultpixel'),
            N = Ar(d[R], r, o, 4, P ? d[P] : void 0),
            z = {
              nodeId: F,
              name: I,
              sourcePath: R,
              kind: 'raster',
              parentId: m,
              data: N,
              width: r,
              height: o,
              x: 0,
              y: 0,
              opacity: U,
              visible: V,
              blendMode: X,
              groupPath: A,
              groupIds: M,
              support: ie,
              clipped: E.alphainheritance === '1' || E.inheritalpha === '1' || E.clipping === '1',
            },
            Z = k.masks.find(
              Y =>
                (Y.nodetype || '').toLowerCase() === 'transparencymask' &&
                Y.visible !== '0' &&
                Y.filename
            );
          if (Z?.filename) {
            let Y = bt(d, c, Z.filename, '.pixelselection');
            if (Y) {
              let se = bt(d, c, Z.filename, '.pixelselection.defaultpixel');
              z.rasterMask = {
                data: Ar(d[Y], r, o, 1, se ? d[se] : void 0),
                width: r,
                height: o,
                channels: 1,
                typeMax: 255,
                x: 0,
                y: 0,
              };
            } else h.push(`Transparency mask for \u201C${I}\u201D has no pixel data`);
          }
          let te = [];
          for (let Y = 0; Y < k.masks.length; Y++) {
            let se = k.masks[Y];
            if (
              (se.nodetype || '').toLowerCase() !== 'filtermask' ||
              se.visible === '0' ||
              !se.filename
            )
              continue;
            let ke = bt(d, c, se.filename, '.filterconfig'),
              Ee = ke ? nh(se.filtername, Ai(d[ke])) : void 0;
            if (!Ee) {
              h.push(
                `Krita filter mask \u201C${se.name || se.filename}\u201D uses unsupported filter \u201C${se.filtername || 'unknown'}\u201D`
              );
              continue;
            }
            let we = {
                nodeId: se.uuid || `${F}-filter-${Y}`,
                name: se.name || se.filtername || `Filter ${Y + 1}`,
                sourcePath: ke || '',
                kind: 'adjustment',
                adjustment: Ee,
                parentId: m,
                width: r,
                height: o,
                x: 0,
                y: 0,
                opacity: 1,
                visible: !0,
                blendMode: 'normal',
                groupPath: A,
                groupIds: M,
                support: 'approximate',
                clipped: !0,
              },
              Ue = bt(d, c, se.filename, '.pixelselection');
            if (Ue) {
              let yt = bt(d, c, se.filename, '.pixelselection.defaultpixel');
              we.rasterMask = {
                data: Ar(d[Ue], r, o, 1, yt ? d[yt] : void 0),
                width: r,
                height: o,
                channels: 1,
                typeMax: 255,
                x: 0,
                y: 0,
              };
            }
            te.push(we);
          }
          u.push(...te, z);
        } catch (P) {
          ((ie = 'unsupported'),
            (H.support = ie),
            (H.warnings = [P instanceof Error ? P.message : String(P)]),
            h.push(`Krita paint layer \u201C${I}\u201D could not be decoded: ${H.warnings[0]}`));
        }
        return H;
      }),
    g = b(s);
  uh(d, u, h);
  let y = {
    format: 'kra',
    width: r,
    height: o,
    bitDepth: 8,
    colorMode: Sn(i, 'colorspacename') || 'RGBA',
    previewKind: 'merged',
    previewIsAuthoritative: n === 'mergedimage.png' && t.width === r && t.height === o,
    previewWidth: t.width,
    previewHeight: t.height,
    layerCount: fl(g),
    root: g,
    warnings: h,
  };
  return {
    ...t,
    channels: 4,
    bitDepth: 8,
    sampleFormat: 1,
    layerAssets: u,
    formatLabel: 'Krita integrated preview',
    formatType: 'kra',
    document: y,
    metadata: {
      container: 'ZIP',
      previewEntry: n,
      previewAuthoritative: y.previewIsAuthoritative,
      layerCount: y.layerCount,
      editableNodeCount: u.length,
      documentWidth: r,
      documentHeight: o,
      layersOnly: a,
    },
  };
}
function cl(e, n) {
  let t = 0;
  return Sl(new Uint8Array(e), {
    filter(i) {
      let r = i.name.replace(/\\/g, '/');
      if (r.startsWith('/') || r.split('/').includes('..'))
        throw new Error(`Unsafe ZIP entry path: ${i.name}`);
      if (!n(r)) return !1;
      if (i.originalSize > J0) throw new Error(`ZIP entry is too large: ${i.name}`);
      if (((t += i.originalSize), t > J0))
        throw new Error('Selected ZIP preview entries exceed the memory limit');
      return !0;
    },
  });
}
async function ih(e, n, t = {}) {
  let i = t.previewOnly === !0,
    r = t.layersOnly === !0,
    o =
      e === 'ora'
        ? new Set(['mergedimage.png', 'Thumbnails/thumbnail.png', 'stack.xml', 'mimetype'])
        : new Set([
            'mergedimage.png',
            'preview.png',
            'documentinfo.xml',
            'maindoc.xml',
            'mimetype',
          ]),
    a = cl(n, w => o.has(w)),
    s =
      e === 'ora'
        ? a['mergedimage.png']
          ? 'mergedimage.png'
          : 'Thumbnails/thumbnail.png'
        : a['mergedimage.png']
          ? 'mergedimage.png'
          : 'preview.png',
    c = a[s];
  if (!r && !c) throw new Error(`${e.toUpperCase()} contains no integrated preview image`);
  let f = Ai(a[e === 'ora' ? 'stack.xml' : 'maindoc.xml']),
    d = $_(f, /<layer\b/gi),
    u = c && !r ? await sl(c) : void 0,
    h = Number(Sn(f, 'w') || Sn(f, 'width') || u?.width),
    p = Number(Sn(f, 'h') || Sn(f, 'height') || u?.height);
  Fr(h, p, 4);
  let _ = u || { width: h, height: p, data: new Uint8Array() },
    b = _.width === h && _.height === p;
  if (i) {
    let w = [];
    if (
      (f.trim() ||
        w.push(
          `${e === 'ora' ? 'OpenRaster stack.xml' : 'Krita maindoc.xml'} is missing; only the integrated preview is available`
        ),
      e === 'ora')
    ) {
      let A = Ai(a.mimetype).trim();
      A !== 'image/openraster' &&
        w.push(A ? `Unexpected OpenRaster MIME marker: ${A}` : 'OpenRaster MIME marker is missing');
    }
    let m = {
      format: e,
      width: h,
      height: p,
      bitDepth: 8,
      colorMode: (e === 'kra' && Sn(f, 'colorspacename')) || 'RGBA',
      previewKind: 'merged',
      previewIsAuthoritative: s === 'mergedimage.png' && b,
      previewWidth: _.width,
      previewHeight: _.height,
      layerCount: d,
      root: [],
      warnings: w,
    };
    return {
      ..._,
      channels: 4,
      bitDepth: 8,
      sampleFormat: 1,
      layerAssets: [],
      formatLabel: e === 'ora' ? 'OpenRaster integrated preview' : 'Krita integrated preview',
      formatType: e,
      document: m,
      metadata: {
        container: 'ZIP',
        previewEntry: s,
        previewAuthoritative: m.previewIsAuthoritative,
        layerCount: d,
        documentWidth: h,
        documentHeight: p,
        previewOnly: i,
      },
    };
  }
  if (e === 'ora' && b) {
    let w = await q_(n, s, _, f, h, p, r),
      m = Ai(a.mimetype).trim();
    return (
      m !== 'image/openraster' &&
        w.document.warnings.unshift(
          m ? `Unexpected OpenRaster MIME marker: ${m}` : 'OpenRaster MIME marker is missing'
        ),
      w
    );
  }
  if (e === 'kra') return t2(n, s, _, f, h, p, r);
  let g = [];
  if (
    (e === 'ora' &&
      !f.trim() &&
      g.push('OpenRaster stack.xml is missing; only the integrated preview is available'),
    e === 'ora')
  ) {
    let w = Ai(a.mimetype).trim();
    w !== 'image/openraster' &&
      g.push(w ? `Unexpected OpenRaster MIME marker: ${w}` : 'OpenRaster MIME marker is missing');
  }
  b || g.push(`Embedded preview is ${_.width}x${_.height}; document canvas is ${h}x${p}`);
  let y = {
    format: e,
    width: h,
    height: p,
    bitDepth: 8,
    colorMode: 'RGBA preview',
    previewKind: 'merged',
    previewIsAuthoritative: s === 'mergedimage.png' && b,
    previewWidth: _.width,
    previewHeight: _.height,
    layerCount: d,
    root: [],
    warnings: g,
  };
  return {
    ..._,
    channels: 4,
    bitDepth: 8,
    sampleFormat: 1,
    formatLabel: e === 'ora' ? 'OpenRaster integrated preview' : 'Krita integrated preview',
    formatType: e,
    document: y,
    metadata: {
      container: 'ZIP',
      previewEntry: s,
      previewAuthoritative: y.previewIsAuthoritative,
      layerCount: d,
      documentWidth: h,
      documentHeight: p,
    },
  };
}
function dh(e) {
  return Array.isArray(e.children)
    ? 'group'
    : e.text
      ? 'text'
      : e.placedLayer || e.linkedFile
        ? 'smart-object'
        : e.vectorMask || e.vectorFill || e.vectorStroke
          ? 'vector'
          : e.adjustment
            ? 'adjustment'
            : 'raster';
}
function hh(e, n = 'layer') {
  return Array.isArray(e)
    ? e.map((t, i) => {
        let r = dh(t),
          o = !!ph(t.adjustment),
          a = hh(t.children, `${n}-${i}`),
          s = {
            id: `${n}-${i}`,
            name: String(t.name || `Layer ${i + 1}`),
            kind: r,
            support:
              r === 'group'
                ? t.blendMode === 'pass through'
                  ? 'approximate'
                  : 'native'
                : r === 'adjustment'
                  ? o
                    ? 'approximate'
                    : 'unsupported'
                  : t.imageData?.data
                    ? r === 'raster'
                      ? 'native'
                      : 'cached-raster'
                    : 'unsupported',
            visible: !t.hidden,
            opacity: Number.isFinite(t.opacity) ? Math.max(0, Math.min(1, t.opacity)) : 1,
            blendMode: t.blendMode || 'normal',
            left: t.left,
            top: t.top,
            width: Number.isFinite(t.right) && Number.isFinite(t.left) ? t.right - t.left : void 0,
            height: Number.isFinite(t.bottom) && Number.isFinite(t.top) ? t.bottom - t.top : void 0,
          };
        return (a.length && (s.children = a), s);
      })
    : [];
}
function rh(e, n, t, i) {
  if (!e?.imageData?.data || e.disabled) return;
  let r = e.imageData.data,
    o = e.imageData.width * e.imageData.height,
    a = Math.max(1, Math.floor(r.length / Math.max(1, o))),
    s = new Uint8Array(o),
    c = i === 32 ? 1 : i === 16 ? 65535 : 255;
  for (let f = 0; f < o; f++)
    s[f] = Math.max(0, Math.min(255, Math.round((Number(r[f * a]) * 255) / c)));
  let l = !!e.positionRelativeToLayer;
  return {
    data: s,
    width: e.imageData.width,
    height: e.imageData.height,
    channels: 1,
    typeMax: 255,
    x: Math.trunc(Number(e.left || 0) + (l ? n : 0)),
    y: Math.trunc(Number(e.top || 0) + (l ? t : 0)),
  };
}
function ph(e) {
  if (!(
    !e ||
    ![
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
    ].includes(e.type)
  )) {
    if (e.type === 'hue/saturation' && Number(e.master?.a) === 256)
      return {
        ...e,
        colorizeEnabled: !0,
        colorize: {
          hue: Number(e.master?.b || 0),
          saturation: Number(e.master?.c || 0),
          lightness: Number(e.master?.d || 0),
        },
      };
    if (e.type === 'gradient map') {
      let n = t => {
        if (Number.isFinite(t?.r)) return { r: t.r, g: t.g, b: t.b };
        if (Number.isFinite(t?.fr)) return { r: t.fr * 255, g: t.fg * 255, b: t.fb * 255 };
        if (Number.isFinite(t?.k)) {
          let i = 255 - t.k;
          return { r: i, g: i, b: i };
        }
        return { r: 0, g: 0, b: 0 };
      };
      return {
        type: 'gradient map',
        reverse: !!e.reverse,
        stops: Array.isArray(e.colorStops)
          ? e.colorStops.map(t => ({
              position: Math.max(0, Math.min(1, Number(t.location || 0) / 4096)),
              color: n(t.color),
            }))
          : void 0,
      };
    }
    return e;
  }
}
function gh(e, n, t, i, r = [], o = [], a = 'psd') {
  if (!Array.isArray(e)) return [];
  let s = [];
  for (let c = 0; c < e.length; c++) {
    let l = e[c],
      f = Number.isFinite(l.id) ? `psd-${l.id}` : `${a}-${c}`,
      d = String(l.name || `Layer ${c + 1}`),
      u = dh(l),
      h = Number.isFinite(l.opacity) ? Math.max(0, Math.min(1, Number(l.opacity))) : 1,
      p = !l.hidden,
      _ = fh(l.blendMode);
    if (u === 'group') {
      (s.push({
        nodeId: f,
        name: d,
        sourcePath: '',
        kind: 'group',
        parentId: i,
        width: 1,
        height: 1,
        x: 0,
        y: 0,
        opacity: h,
        visible: p,
        blendMode: _,
        groupPath: r,
        groupIds: o,
        support: l.blendMode === 'pass through' ? 'approximate' : 'native',
      }),
        s.push(...gh(l.children, n, t, f, [...r, d], [...o, f], f)));
      continue;
    }
    let b = Math.trunc(Number(l.left || 0)),
      g = Math.trunc(Number(l.top || 0)),
      y = l.effects ? Object.keys(l.effects).filter(M => M !== 'scale') : [];
    y.length &&
      n.push(
        `PSD layer effects on \u201C${d}\u201D (${y.join(', ')}) are not reconstructed; cached pixels or the integrated preview may include them`
      );
    let w = l.realMask || l.mask;
    ((w?.userMaskFeather || w?.vectorMaskFeather) &&
      n.push(`PSD mask feathering on \u201C${d}\u201D is not reconstructed`),
      w?.userMaskDensity !== void 0 &&
        w.userMaskDensity !== 100 &&
        n.push(`PSD mask density on \u201C${d}\u201D is approximated`));
    let m = ph(l.adjustment);
    if (l.adjustment) {
      let M = !!m;
      (M ||
        n.push(
          `PSD adjustment \u201C${d}\u201D (${l.adjustment.type || 'unknown'}) is inspect-only`
        ),
        s.push({
          nodeId: f,
          name: d,
          sourcePath: '',
          kind: 'adjustment',
          adjustment: m,
          parentId: i,
          width: 1,
          height: 1,
          x: 0,
          y: 0,
          opacity: h,
          visible: p,
          blendMode: _,
          groupPath: r,
          groupIds: o,
          support: M ? 'approximate' : 'unsupported',
          clipped: !!l.clipping,
          rasterMask: rh(l.realMask || l.mask, b, g, t),
        }));
      continue;
    }
    if (!l.imageData?.data) {
      n.push(`PSD ${u} layer \u201C${d}\u201D has no cached raster pixels`);
      continue;
    }
    let A = l.imageData.data;
    s.push({
      nodeId: f,
      name: d,
      sourcePath: '',
      kind: 'raster',
      parentId: i,
      data: A,
      width: l.imageData.width,
      height: l.imageData.height,
      channels: 4,
      isFloat: t === 32,
      typeMax: t === 32 ? 1 : t === 16 ? 65535 : 255,
      sourceNumericType: t === 32 ? 'float32' : t === 16 ? 'uint16' : 'uint8',
      x: b,
      y: g,
      opacity: h,
      visible: p,
      blendMode: _,
      groupPath: r,
      groupIds: o,
      support: u === 'raster' ? 'native' : 'cached-raster',
      clipped: !!l.clipping,
      rasterMask: rh(l.realMask || l.mask, b, g, t),
    });
  }
  return s;
}
function fl(e) {
  let n = 0;
  for (let t of e) n += 1 + fl(t.children || []);
  return n;
}
function oh(e, n, t = {}) {
  G_();
  let i = '',
    r,
    o = t.previewOnly === !0,
    a = t.layersOnly === !0;
  try {
    r = (0, Ir.readPsd)(e, {
      useImageData: !0,
      skipLayerImageData: o,
      skipCompositeImageData: a,
      skipThumbnail: !0,
      skipLinkedFilesData: !0,
      logMissingFeatures: !1,
      totalMemoryLimit: Q0,
    });
  } catch (b) {
    if (o || a) throw b;
    ((i = `PSD editable layers were unavailable: ${b instanceof Error ? b.message : String(b)}`),
      (r = (0, Ir.readPsd)(e, {
        useImageData: !0,
        skipLayerImageData: !0,
        skipThumbnail: !0,
        skipLinkedFilesData: !0,
        logMissingFeatures: !1,
        totalMemoryLimit: Q0,
      })));
  }
  if (!a && !r.imageData?.data) throw new Error('PSD contains no decodable composite image');
  let s = Number(r.bitsPerChannel || 8);
  Fr(r.width, r.height, s === 32 ? 16 : s === 16 ? 8 : 4);
  let c = a ? new Uint8Array() : r.imageData.data,
    l = hh(r.children),
    f = fl(l),
    u =
      {
        0: 'Bitmap',
        1: 'Grayscale',
        2: 'Indexed',
        3: 'RGB',
        4: 'CMYK',
        7: 'Multichannel',
        8: 'Duotone',
        9: 'Lab',
      }[Number(r.colorMode)] || `Mode ${r.colorMode}`,
    h = [];
  (i && h.push(i),
    Number(r.colorMode) !== 3 &&
      h.push(
        `${u} is converted to RGB by the PSD decoder; exact Photoshop color-management parity is unavailable`
      ),
    s !== 8 &&
      h.push(
        `${s}-bit PSD layers depend on decoder conversion and may not match Photoshop exactly`
      ));
  let p = o ? [] : gh(r.children, h, s),
    _ = {
      format: n ? 'psb' : 'psd',
      width: r.width,
      height: r.height,
      bitDepth: s,
      colorMode: u,
      previewKind: 'integrated',
      previewIsAuthoritative: !0,
      previewWidth: r.width,
      previewHeight: r.height,
      layerCount: f,
      root: l,
      warnings: h,
    };
  return {
    width: r.width,
    height: r.height,
    channels: 4,
    bitDepth: s,
    sampleFormat: s === 32 ? 3 : 1,
    data: c,
    layerAssets: p,
    layerOrder: 'bottom-to-top',
    formatLabel: `${n ? 'Photoshop PSB' : 'Photoshop PSD'} composite`,
    formatType: n ? 'psb' : 'psd',
    document: _,
    metadata: {
      colorMode: u,
      bitDepth: s,
      layerCount: f,
      editableNodeCount: p.length,
      previewAuthoritative: !0,
      decoder: 'ag-psd',
      previewOnly: o,
      layersOnly: a,
    },
  };
}
function n2(e, n) {
  let t = n + 8;
  for (; t + 12 <= e.length;) {
    let i = new DataView(e.buffer, e.byteOffset + t, 4).getUint32(0, !1);
    if (i > sh || t + 12 + i > e.length) return null;
    let r = e[t + 4],
      o = e[t + 5],
      a = e[t + 6],
      s = e[t + 7];
    if (((t += 12 + i), r === 73 && o === 69 && a === 78 && s === 68)) return t;
  }
  return null;
}
async function i2(e) {
  let n = new Uint8Array(e);
  if (n.length < 4 || n[0] !== 0 || n[1] !== 255 || n[2] !== 75 || n[3] !== 65)
    throw new Error('Invalid Affinity document signature');
  let t = null;
  for (let a = 4; a <= n.length - ol.length; a++) {
    let s = !0;
    for (let u = 0; u < ol.length; u++)
      if (n[a + u] !== ol[u]) {
        s = !1;
        break;
      }
    if (!s || a + 24 > n.length) continue;
    let c = new DataView(n.buffer, n.byteOffset + a + 16, 8),
      l = c.getUint32(0, !1),
      f = c.getUint32(4, !1);
    try {
      Fr(l, f, 4);
    } catch {
      continue;
    }
    let d = n2(n, a);
    d &&
      ((!t || l * f > t.width * t.height) && (t = { bytes: n.slice(a, d), width: l, height: f }),
      (a = d - 1));
  }
  if (!t) throw new Error('Affinity document contains no supported embedded PNG preview');
  let i = await sl(t.bytes),
    r = [
      'Affinity document layers are proprietary and were not decoded',
      'Embedded preview may be smaller or older than the document canvas',
    ],
    o = {
      format: 'affinity',
      width: i.width,
      height: i.height,
      bitDepth: 8,
      colorMode: 'Unknown (embedded RGBA preview)',
      previewKind: 'embedded',
      previewIsAuthoritative: !1,
      previewWidth: i.width,
      previewHeight: i.height,
      layerCount: 0,
      root: [],
      warnings: r,
    };
  return {
    ...i,
    channels: 4,
    bitDepth: 8,
    sampleFormat: 1,
    formatLabel: 'Affinity embedded preview',
    formatType: 'affinity',
    document: o,
    metadata: {
      previewAuthoritative: !1,
      previewWidth: i.width,
      previewHeight: i.height,
      decoder: 'embedded PNG scanner',
    },
  };
}
var al = class {
  constructor(n, t) {
    ((this.view = new DataView(n)),
      (this.bytes = new Uint8Array(n)),
      (this.version = t),
      (this.pointerBytes = t >= 11 ? 8 : 4));
  }
  check(n, t) {
    if (
      !Number.isSafeInteger(n) ||
      !Number.isSafeInteger(t) ||
      n < 0 ||
      t < 0 ||
      n + t > this.view.byteLength
    )
      throw new Error('XCF structure points outside the file');
  }
  u8(n) {
    return (this.check(n, 1), this.view.getUint8(n));
  }
  u32(n) {
    return (this.check(n, 4), this.view.getUint32(n, !1));
  }
  i32(n) {
    return (this.check(n, 4), this.view.getInt32(n, !1));
  }
  f32(n) {
    return (this.check(n, 4), this.view.getFloat32(n, !1));
  }
  pointer(n) {
    if (this.pointerBytes === 4) return this.u32(n);
    this.check(n, 8);
    let t = this.view.getBigUint64(n, !1);
    if (t > BigInt(Number.MAX_SAFE_INTEGER))
      throw new Error('XCF pointer exceeds JavaScript safe integer range');
    return Number(t);
  }
  string(n) {
    let t = this.u32(n);
    return (
      (n += 4),
      t === 0
        ? { value: '', next: n }
        : (this.check(n, t),
          {
            value: new TextDecoder().decode(this.bytes.subarray(n, n + Math.max(0, t - 1))),
            next: n + t,
          })
    );
  }
};
function ah(e, n) {
  let t = { next: n },
    i = n;
  for (let r = 0; r < 1e5; r++) {
    let o = e.u32(i),
      a = e.u32(i + 4);
    if (((i += 8), o === 0)) return ((t.next = i), t);
    if ((e.check(i, a), o === 17 && a >= 1)) t.compression = e.u8(i);
    else if (o === 6 && a >= 4) t.opacity = e.u32(i) / 255;
    else if (o === 33 && a >= 4) t.opacity = e.f32(i);
    else if (o === 8 && a >= 4) t.visible = e.u32(i) !== 0;
    else if (o === 15 && a >= 8) ((t.offsetX = e.i32(i)), (t.offsetY = e.i32(i + 4)));
    else if (o === 7 && a >= 4) t.mode = e.u32(i);
    else if (o === 29) t.group = !0;
    else if (o === 30 && a % 4 === 0) {
      t.itemPath = [];
      for (let s = 0; s < a; s += 4) t.itemPath.push(e.u32(i + s));
    } else if (o === 1 && a >= 4) {
      let s = Math.min(256, e.u32(i));
      (e.check(i + 4, s * 3), (t.colormap = e.bytes.slice(i + 4, i + 4 + s * 3)));
    }
    i += a;
  }
  throw new Error('XCF property list exceeds the safety limit');
}
function r2(e, n) {
  let t = n['tiff-visualizer-adjustment'];
  if (typeof t == 'string')
    try {
      let o = JSON.parse(t);
      if (o && typeof o == 'object' && typeof o.type == 'string') return o;
    } catch {}
  let i = e
      .toLowerCase()
      .replace(/^(?:gegl|gimp):/, '')
      .replace(/_/g, '-'),
    r = (o, a) => {
      for (let s of o) {
        let c = Number(n[s]);
        if (Number.isFinite(c)) return c;
      }
      return a;
    };
  if (i === 'brightness-contrast')
    return {
      type: 'brightness/contrast',
      brightness: r(['brightness'], 0) * 100,
      contrast: r(['contrast'], 0) * 100,
    };
  if (i === 'exposure')
    return {
      type: 'exposure',
      exposure: r(['exposure'], 0),
      offset: -r(['black-level', 'black_level'], 0),
      gamma: 1,
    };
  if (['invert', 'invert-linear', 'invert-gamma', 'value-invert'].includes(i))
    return { type: 'invert' };
  if (i === 'threshold') return { type: 'threshold', level: r(['value', 'threshold'], 0.5) * 255 };
  if (i === 'posterize') return { type: 'posterize', levels: r(['levels'], 4) };
  if (['hue-chroma', 'hue-saturation'].includes(i))
    return {
      type: 'hue/saturation',
      master: {
        hue: r(['hue'], 0),
        saturation: r(['chroma', 'saturation'], 0),
        lightness: r(['lightness'], 0),
      },
      colorize: { hue: 0, saturation: 100, lightness: 0 },
      colorizeEnabled: !1,
    };
  if (i === 'saturation')
    return {
      type: 'hue/saturation',
      master: { hue: 0, saturation: (r(['scale'], 1) - 1) * 100, lightness: 0 },
      colorize: { hue: 0, saturation: 100, lightness: 0 },
      colorizeEnabled: !1,
    };
  if (i === 'levels')
    return {
      type: 'levels',
      rgb: {
        shadowInput: r(['in-low', 'in_low'], 0) * 255,
        highlightInput: r(['in-high', 'in_high'], 1) * 255,
        midtoneInput: 1,
        shadowOutput: r(['out-low', 'out_low'], 0) * 255,
        highlightOutput: r(['out-high', 'out_high'], 1) * 255,
      },
    };
  if (['channel-mixer', 'mono-mixer'].includes(i)) {
    let o = (a, s) => r(a, s) * 100;
    return i === 'mono-mixer'
      ? {
          type: 'channel mixer',
          monochrome: !0,
          gray: {
            red: o(['red', 'red-gain'], 0.4),
            green: o(['green', 'green-gain'], 0.4),
            blue: o(['blue', 'blue-gain'], 0.2),
            constant: 0,
          },
        }
      : {
          type: 'channel mixer',
          red: {
            red: o(['rr-gain', 'red-red'], 1),
            green: o(['rg-gain', 'red-green'], 0),
            blue: o(['rb-gain', 'red-blue'], 0),
            constant: o(['red-offset'], 0),
          },
          green: {
            red: o(['gr-gain', 'green-red'], 0),
            green: o(['gg-gain', 'green-green'], 1),
            blue: o(['gb-gain', 'green-blue'], 0),
            constant: o(['green-offset'], 0),
          },
          blue: {
            red: o(['br-gain', 'blue-red'], 0),
            green: o(['bg-gain', 'blue-green'], 0),
            blue: o(['bb-gain', 'blue-blue'], 1),
            constant: o(['blue-offset'], 0),
          },
        };
  }
  if (i === 'color-balance') {
    let o = a => ({
      cyanRed: r([`${a}-cyan-red`, `${a}-cyan_red`], 0) * 100,
      magentaGreen: r([`${a}-magenta-green`, `${a}-magenta_green`], 0) * 100,
      yellowBlue: r([`${a}-yellow-blue`, `${a}-yellow_blue`], 0) * 100,
    });
    return {
      type: 'color balance',
      shadows: o('shadows'),
      midtones: o('midtones'),
      highlights: o('highlights'),
      preserveLuminosity: n['preserve-luminosity'] !== !1,
    };
  }
}
function o2(e, n) {
  let t = n,
    i = e.string(t);
  ((t = i.next), (t = e.string(t).next));
  let o = e.string(t);
  ((t = o.next), e.version >= 22 && (t = e.string(t).next));
  let a = !0,
    s = 1,
    c = {};
  for (let l = 0; l < 1e5; l++) {
    let f = e.u32(t),
      d = e.u32(t + 4);
    if (((t += 8), f === 0)) break;
    e.check(t, d);
    let u = t + d;
    if (f === 8 && d >= 4) a = e.u32(t) !== 0;
    else if (f === 33 && d >= 4) s = Math.max(0, Math.min(1, e.f32(t)));
    else if (f === 45 && d >= 8) {
      let h = e.string(t),
        p = h.next,
        _ = e.u32(p);
      if (((p += 4), [1, 5].includes(_) && p + 4 <= u)) c[h.value] = e.i32(p);
      else if ([2, 7].includes(_) && p + 4 <= u) c[h.value] = _ === 2 ? e.u32(p) !== 0 : e.u32(p);
      else if (_ === 3 && p + 4 <= u) c[h.value] = e.f32(p);
      else if ([4, 6].includes(_) && p + 4 <= u) {
        let b = e.string(p);
        b.next <= u && (c[h.value] = b.value);
      }
    }
    t = u;
  }
  return {
    name: i.value || o.value,
    operation: o.value,
    visible: a,
    opacity: s,
    adjustment: r2(o.value, c),
  };
}
function a2(e, n, t, i) {
  let r = new Uint8Array(t * i),
    o = n;
  for (let a = 0; a < i; a++) {
    let s = 0;
    for (; s < t;) {
      let c = e.u8(o++);
      if (c <= 126) {
        let l = c + 1,
          f = e.u8(o++);
        if (s + l > t) throw new Error('Invalid XCF RLE run');
        for (let d = 0; d < l; d++) r[s++ * i + a] = f;
      } else if (c === 127) {
        let l = e.u8(o) * 256 + e.u8(o + 1);
        o += 2;
        let f = e.u8(o++);
        if (l <= 0 || s + l > t) throw new Error('Invalid XCF long RLE run');
        for (let d = 0; d < l; d++) r[s++ * i + a] = f;
      } else {
        let l = c === 128 ? e.u8(o) * 256 + e.u8(o + 1) : 256 - c;
        if ((c === 128 && (o += 2), l <= 0 || s + l > t))
          throw new Error('Invalid XCF RLE literal');
        e.check(o, l);
        for (let f = 0; f < l; f++) r[s++ * i + a] = e.u8(o++);
      }
    }
  }
  return r;
}
function s2(e, n, t, i, r, o) {
  let a = t * i;
  if (r === 0) return (e.check(n, a), e.bytes.slice(n, n + a));
  if (r === 1) return a2(e, n, t, i);
  if (r === 2) {
    let s = o && o > n ? o : e.view.byteLength;
    e.check(n, s - n);
    let c = U0.inflate(e.bytes.subarray(n, s));
    if (c.length !== a) throw new Error('XCF zlib tile decoded to an unexpected size');
    return c;
  }
  throw new Error(`Unsupported XCF compression: ${r}`);
}
function l2(e, n, t, i) {
  if (t === 0 || t === 1) return [e[n], e[n + 1], e[n + 2], t === 1 ? e[n + 3] : 255];
  if (t === 2 || t === 3) {
    let o = e[n];
    return [o, o, o, t === 3 ? e[n + 1] : 255];
  }
  let r = e[n] * 3;
  return [i?.[r] || 0, i?.[r + 1] || 0, i?.[r + 2] || 0, t === 5 ? e[n + 1] : 255];
}
function c2(e) {
  return (
    {
      0: 'normal',
      3: 'multiply',
      4: 'screen',
      5: 'overlay',
      6: 'difference',
      9: 'darken',
      10: 'lighten',
    }[e] || `gimp-${e}`
  );
}
function f2(e) {
  let n = new TextDecoder('ascii').decode(new Uint8Array(e, 0, Math.min(14, e.byteLength)));
  if (!n.startsWith('gimp xcf ')) throw new Error('Invalid XCF signature');
  let t = n.slice(9, 13),
    i = t === 'file' ? 0 : Number(t.slice(1));
  if (!Number.isInteger(i) || i < 0 || i > 25) throw new Error(`Unsupported XCF version tag: ${t}`);
  let r = new al(e, i),
    o = 14,
    a = r.u32(o),
    s = r.u32(o + 4),
    c = r.u32(o + 8);
  o += 12;
  let l = i >= 4 ? r.u32(o) : 150;
  if ((i >= 4 && (o += 4), Fr(a, s, 4), l !== 150 && !(i === 4 && l === 0)))
    throw new Error(
      `XCF preview currently supports 8-bit gamma integer data; file precision is ${l}`
    );
  let f = ah(r, o);
  o = f.next;
  let d = f.compression ?? 1,
    u = [];
  for (let F = 0; F < 1e5; F++, o += r.pointerBytes) {
    let I = r.pointer(o);
    if (!I) {
      o += r.pointerBytes;
      break;
    }
    u.push(I);
  }
  let h = [],
    p = [],
    _ = new Map();
  for (let F = 0; F < u.length; F++) {
    let I = u[F],
      C = r.u32(I),
      B = r.u32(I + 4),
      ee = r.u32(I + 8);
    ((I += 12), Fr(C, B, 4));
    let $ = r.string(I);
    I = $.next;
    let U = ah(r, I);
    I = U.next;
    let V = r.pointer(I);
    I += r.pointerBytes;
    let X = r.pointer(I);
    I += r.pointerBytes;
    let ie = [];
    if (i >= 20)
      for (let ke = 0; ke < 1e4; ke++, I += r.pointerBytes) {
        let Ee = r.pointer(I);
        if (!Ee) break;
        try {
          ie.push(o2(r, Ee));
        } catch (we) {
          p.push(
            `An effect on layer \u201C${$.value || `Layer ${F + 1}`}\u201D could not be decoded: ${we instanceof Error ? we.message : String(we)}`
          );
        }
      }
    let H = U.mode ?? 0,
      R = U.itemPath || [F],
      P = R.slice(0, -1).join('/'),
      N = _.get(P),
      z = c2(H),
      Z = {
        id: `xcf-layer-${F}`,
        name: $.value || `Layer ${F + 1}`,
        kind: U.group ? 'group' : 'raster',
        support: U.group || z !== `gimp-${H}` ? 'native' : 'approximate',
        visible: U.visible !== !1,
        opacity: U.opacity ?? 1,
        blendMode: z,
        left: U.offsetX || 0,
        top: U.offsetY || 0,
        width: C,
        height: B,
      },
      te;
    if (!U.group && V) {
      let ke = r.u32(V),
        Ee = r.u32(V + 4),
        we = r.u32(V + 8);
      if (ke !== C || Ee !== B || we < 1 || we > 4)
        throw new Error('Unsupported XCF layer hierarchy');
      let Ue = r.pointer(V + 12);
      if (!Ue) throw new Error('XCF layer has no pixel level');
      let yt = r.u32(Ue),
        Er = r.u32(Ue + 4);
      if (yt !== C || Er !== B) throw new Error('Unsupported XCF level dimensions');
      let ul = Ue + 8,
        Fi = [];
      for (let Gt = 0; Gt < 1e6; Gt++, ul += r.pointerBytes) {
        let Ei = r.pointer(ul);
        if (!Ei) break;
        Fi.push(Ei);
      }
      let mh = Math.ceil(C / 64) * Math.ceil(B / 64);
      if (Fi.length !== mh) throw new Error('XCF tile count does not match layer dimensions');
      te = new Uint8Array(C * B * 4);
      let dl = Math.ceil(C / 64);
      for (let Gt = 0; Gt < Fi.length; Gt++) {
        let Ei = (Gt % dl) * 64,
          hl = Math.floor(Gt / dl) * 64,
          Zo = Math.min(64, C - Ei),
          pl = Math.min(64, B - hl),
          bh = s2(r, Fi[Gt], Zo * pl, we, d, Fi[Gt + 1]);
        for (let Dr = 0; Dr < pl; Dr++)
          for (let Mr = 0; Mr < Zo; Mr++) {
            let yh = l2(bh, (Dr * Zo + Mr) * we, ee, f.colormap),
              wh = ((hl + Dr) * C + Ei + Mr) * 4;
            te.set(yh, wh);
          }
      }
    }
    (z.startsWith('gimp-') && !U.group
      ? p.push(`Layer \u201C${Z.name}\u201D blend mode ${H} is approximated as normal`)
      : H !== 0 &&
        !U.group &&
        p.push(
          `Layer \u201C${Z.name}\u201D uses ${z}; the quick preview is flattened normally, while Layers View preserves the blend mode`
        ),
      U.group &&
        p.push(
          `Group \u201C${Z.name}\u201D is composited as an isolated editable surface after opening Layers View`
        ),
      X &&
        p.push(
          `Layer mask on \u201C${Z.name}\u201D is present but is not yet decoded by the XCF importer`
        ));
    for (let ke of ie)
      ke.adjustment ||
        p.push(
          `Layer effect \u201C${ke.name}\u201D (${ke.operation}) on \u201C${Z.name}\u201D is not supported by the compositor`
        );
    !U.group && !te && p.push(`Layer \u201C${Z.name}\u201D has no decodable raster payload`);
    let Y = N?.names || [],
      se = N?.ids || [];
    (h.push({
      node: Z,
      pixels: te,
      effects: ie,
      type: ee,
      opacity: U.opacity ?? 1,
      x: U.offsetX || 0,
      y: U.offsetY || 0,
      width: C,
      height: B,
      mode: H,
      parentId: N?.id,
      groupPath: Y,
      groupIds: se,
    }),
      U.group && _.set(R.join('/'), { id: Z.id, names: [...Y, Z.name], ids: [...se, Z.id] }));
  }
  let b = new Uint8Array(a * s * 4);
  for (let F of [...h].reverse())
    if (!(!F.node.visible || !F.pixels))
      for (let I = 0; I < F.height; I++)
        for (let C = 0; C < F.width; C++) {
          let B = F.x + C,
            ee = F.y + I;
          if (B < 0 || ee < 0 || B >= a || ee >= s) continue;
          let $ = (I * F.width + C) * 4,
            U = (ee * a + B) * 4,
            V = (F.pixels[$ + 3] / 255) * F.opacity,
            X = b[U + 3] / 255,
            ie = V + X * (1 - V);
          if (!(ie <= 0)) {
            for (let H = 0; H < 3; H++)
              b[U + H] = Math.round((F.pixels[$ + H] * V + b[U + H] * X * (1 - V)) / ie);
            b[U + 3] = Math.round(ie * 255);
          }
        }
  let g = c === 0 ? 'RGB' : c === 1 ? 'Grayscale' : 'Indexed',
    y = new Map();
  for (let F of h) {
    let I = y.get(F.parentId) || [];
    (I.push(F.node), y.set(F.parentId, I));
  }
  for (let F of h) F.node.kind === 'group' && (F.node.children = y.get(F.node.id) || []);
  let w = y.get(void 0) || h.map(F => F.node),
    m = [];
  for (let F = h.length - 1; F >= 0; F--) {
    let I = h[F];
    I.node.kind === 'group'
      ? m.push({
          nodeId: I.node.id,
          name: I.node.name,
          sourcePath: '',
          kind: 'group',
          parentId: I.parentId,
          width: a,
          height: s,
          x: 0,
          y: 0,
          opacity: I.opacity,
          visible: I.node.visible,
          blendMode: I.node.blendMode || 'normal',
          groupPath: I.groupPath,
          groupIds: I.groupIds,
          support: I.node.support,
        })
      : I.pixels &&
        m.push({
          nodeId: I.node.id,
          name: I.node.name,
          sourcePath: `xcf-layer-${F}`,
          kind: 'raster',
          parentId: I.parentId,
          data: I.pixels,
          width: I.width,
          height: I.height,
          x: I.x,
          y: I.y,
          opacity: I.opacity,
          visible: I.node.visible,
          blendMode: I.node.blendMode || 'normal',
          groupPath: I.groupPath,
          groupIds: I.groupIds,
          support: I.node.support,
        });
    for (let C = 0; C < I.effects.length; C++) {
      let B = I.effects[C];
      B.adjustment &&
        m.push({
          nodeId: `${I.node.id}-effect-${C}`,
          name: B.name,
          sourcePath: `xcf-effect-${F}-${C}`,
          kind: 'adjustment',
          adjustment: B.adjustment,
          parentId: I.parentId,
          width: a,
          height: s,
          x: 0,
          y: 0,
          opacity: B.opacity,
          visible: B.visible,
          blendMode: 'normal',
          groupPath: I.groupPath,
          groupIds: I.groupIds,
          support: 'approximate',
          clipped: !0,
        });
    }
  }
  let A = {
      format: 'xcf',
      width: a,
      height: s,
      bitDepth: 8,
      colorMode: g,
      previewKind: 'reconstructed',
      previewIsAuthoritative: p.length === 0,
      previewWidth: a,
      previewHeight: s,
      layerCount: h.length,
      root: w,
      warnings: p,
    },
    M = m.map(F => ({
      id: F.nodeId,
      data: F.data,
      width: F.width,
      height: F.height,
      channels: 4,
      isFloat: !1,
      typeMax: 255,
      offsetX: F.x,
      offsetY: F.y,
      opacity: F.opacity,
      visible: F.visible,
      blendMode: F.blendMode,
      kind: F.kind,
      adjustment: F.adjustment,
      parentId: F.parentId,
      clipped: F.clipped,
    })),
    k = q0(M, a, s),
    E = new Uint8Array(a * s * 4);
  for (let F = 0; F < a * s; F++) {
    let I = F * k.channels,
      C = F * 4,
      B = ee => {
        let $ = Number(k.data[I + Math.min(ee, k.channels - 1)]);
        return Number.isFinite($) ? Math.max(0, Math.min(255, Math.round($))) : 0;
      };
    k.channels === 1
      ? ((E[C] = E[C + 1] = E[C + 2] = B(0)), (E[C + 3] = Number.isFinite(k.data[I]) ? 255 : 0))
      : ((E[C] = B(0)),
        (E[C + 1] = B(1)),
        (E[C + 2] = B(2)),
        (E[C + 3] = k.channels >= 4 ? B(3) : 255));
  }
  return {
    width: a,
    height: s,
    channels: 4,
    bitDepth: 8,
    sampleFormat: 1,
    data: E,
    formatLabel: 'GIMP XCF reconstructed preview',
    formatType: 'xcf',
    document: A,
    layerAssets: m,
    layerOrder: 'bottom-to-top',
    metadata: {
      xcfVersion: i,
      colorMode: g,
      precision: l,
      compression: d,
      layerCount: h.length,
      previewAuthoritative: A.previewIsAuthoritative,
    },
  };
}
async function u2(e, n, t = {}) {
  let i = performance.now(),
    r;
  switch (e) {
    case 'ora':
      r = await ih('ora', n, t);
      break;
    case 'kra':
      r = await ih('kra', n, t);
      break;
    case 'psd':
      r = oh(n, !1, t);
      break;
    case 'psb':
      r = oh(n, !0, t);
      break;
    case 'xcf':
      r = f2(n);
      break;
    case 'affinity':
      r = await i2(n);
      break;
    default:
      throw new Error(`Unknown layered document format: ${e}`);
  }
  return (
    (r.decodeTimings = [{ name: `decode-${e}-preview`, durationMs: performance.now() - i }]),
    r
  );
}
export { u2 as decodeLayeredPreview };
/*! Bundled license information:

pako/dist/pako.esm.mjs:
  (*! pako 2.1.0 https://github.com/nodeca/pako @license (MIT AND Zlib) *)
*/
