function de(e) {
  let n = e.length;
  for (; --n >= 0;) e[n] = 0;
}
var hi = 0,
  gn = 1,
  di = 2,
  ui = 3,
  _i = 258,
  pt = 29,
  Ue = 256,
  ke = Ue + 1 + pt,
  fe = 30,
  wt = 19,
  mn = 2 * ke + 1,
  Q = 15,
  We = 16,
  bi = 7,
  xt = 256,
  pn = 16,
  wn = 17,
  xn = 18,
  ft = new Uint8Array([
    0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
  ]),
  Pe = new Uint8Array([
    0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13,
    13,
  ]),
  gi = new Uint8Array([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 3, 7]),
  yn = new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]),
  mi = 512,
  X = new Array((ke + 2) * 2);
de(X);
var we = new Array(fe * 2);
de(we);
var ve = new Array(mi);
de(ve);
var Ee = new Array(_i - ui + 1);
de(Ee);
var yt = new Array(pt);
de(yt);
var He = new Array(fe);
de(He);
function Ve(e, n, t, i, a) {
  ((this.static_tree = e),
    (this.extra_bits = n),
    (this.extra_base = t),
    (this.elems = i),
    (this.max_length = a),
    (this.has_stree = e && e.length));
}
var kn, vn, En;
function Je(e, n) {
  ((this.dyn_tree = e), (this.max_code = 0), (this.stat_desc = n));
}
var Rn = e => (e < 256 ? ve[e] : ve[256 + (e >>> 7)]),
  Re = (e, n) => {
    ((e.pending_buf[e.pending++] = n & 255), (e.pending_buf[e.pending++] = (n >>> 8) & 255));
  },
  O = (e, n, t) => {
    e.bi_valid > We - t
      ? ((e.bi_buf |= (n << e.bi_valid) & 65535),
        Re(e, e.bi_buf),
        (e.bi_buf = n >> (We - e.bi_valid)),
        (e.bi_valid += t - We))
      : ((e.bi_buf |= (n << e.bi_valid) & 65535), (e.bi_valid += t));
  },
  P = (e, n, t) => {
    O(e, t[n * 2], t[n * 2 + 1]);
  },
  An = (e, n) => {
    let t = 0;
    do ((t |= e & 1), (e >>>= 1), (t <<= 1));
    while (--n > 0);
    return t >>> 1;
  },
  pi = e => {
    e.bi_valid === 16
      ? (Re(e, e.bi_buf), (e.bi_buf = 0), (e.bi_valid = 0))
      : e.bi_valid >= 8 &&
        ((e.pending_buf[e.pending++] = e.bi_buf & 255), (e.bi_buf >>= 8), (e.bi_valid -= 8));
  },
  wi = (e, n) => {
    let t = n.dyn_tree,
      i = n.max_code,
      a = n.stat_desc.static_tree,
      r = n.stat_desc.has_stree,
      s = n.stat_desc.extra_bits,
      l = n.stat_desc.extra_base,
      d = n.stat_desc.max_length,
      o,
      f,
      x,
      h,
      c,
      m,
      b = 0;
    for (h = 0; h <= Q; h++) e.bl_count[h] = 0;
    for (t[e.heap[e.heap_max] * 2 + 1] = 0, o = e.heap_max + 1; o < mn; o++)
      ((f = e.heap[o]),
        (h = t[t[f * 2 + 1] * 2 + 1] + 1),
        h > d && ((h = d), b++),
        (t[f * 2 + 1] = h),
        !(f > i) &&
          (e.bl_count[h]++,
          (c = 0),
          f >= l && (c = s[f - l]),
          (m = t[f * 2]),
          (e.opt_len += m * (h + c)),
          r && (e.static_len += m * (a[f * 2 + 1] + c))));
    if (b !== 0) {
      do {
        for (h = d - 1; e.bl_count[h] === 0;) h--;
        (e.bl_count[h]--, (e.bl_count[h + 1] += 2), e.bl_count[d]--, (b -= 2));
      } while (b > 0);
      for (h = d; h !== 0; h--)
        for (f = e.bl_count[h]; f !== 0;)
          ((x = e.heap[--o]),
            !(x > i) &&
              (t[x * 2 + 1] !== h &&
                ((e.opt_len += (h - t[x * 2 + 1]) * t[x * 2]), (t[x * 2 + 1] = h)),
              f--));
    }
  },
  Mn = (e, n, t) => {
    let i = new Array(Q + 1),
      a = 0,
      r,
      s;
    for (r = 1; r <= Q; r++) ((a = (a + t[r - 1]) << 1), (i[r] = a));
    for (s = 0; s <= n; s++) {
      let l = e[s * 2 + 1];
      l !== 0 && (e[s * 2] = An(i[l]++, l));
    }
  },
  xi = () => {
    let e,
      n,
      t,
      i,
      a,
      r = new Array(Q + 1);
    for (t = 0, i = 0; i < pt - 1; i++) for (yt[i] = t, e = 0; e < 1 << ft[i]; e++) Ee[t++] = i;
    for (Ee[t - 1] = i, a = 0, i = 0; i < 16; i++)
      for (He[i] = a, e = 0; e < 1 << Pe[i]; e++) ve[a++] = i;
    for (a >>= 7; i < fe; i++)
      for (He[i] = a << 7, e = 0; e < 1 << (Pe[i] - 7); e++) ve[256 + a++] = i;
    for (n = 0; n <= Q; n++) r[n] = 0;
    for (e = 0; e <= 143;) ((X[e * 2 + 1] = 8), e++, r[8]++);
    for (; e <= 255;) ((X[e * 2 + 1] = 9), e++, r[9]++);
    for (; e <= 279;) ((X[e * 2 + 1] = 7), e++, r[7]++);
    for (; e <= 287;) ((X[e * 2 + 1] = 8), e++, r[8]++);
    for (Mn(X, ke + 1, r), e = 0; e < fe; e++) ((we[e * 2 + 1] = 5), (we[e * 2] = An(e, 5)));
    ((kn = new Ve(X, ft, Ue + 1, ke, Q)),
      (vn = new Ve(we, Pe, 0, fe, Q)),
      (En = new Ve(new Array(0), gi, 0, wt, bi)));
  },
  Sn = e => {
    let n;
    for (n = 0; n < ke; n++) e.dyn_ltree[n * 2] = 0;
    for (n = 0; n < fe; n++) e.dyn_dtree[n * 2] = 0;
    for (n = 0; n < wt; n++) e.bl_tree[n * 2] = 0;
    ((e.dyn_ltree[xt * 2] = 1), (e.opt_len = e.static_len = 0), (e.sym_next = e.matches = 0));
  },
  In = e => {
    (e.bi_valid > 8 ? Re(e, e.bi_buf) : e.bi_valid > 0 && (e.pending_buf[e.pending++] = e.bi_buf),
      (e.bi_buf = 0),
      (e.bi_valid = 0));
  },
  zt = (e, n, t, i) => {
    let a = n * 2,
      r = t * 2;
    return e[a] < e[r] || (e[a] === e[r] && i[n] <= i[t]);
  },
  qe = (e, n, t) => {
    let i = e.heap[t],
      a = t << 1;
    for (
      ;
      a <= e.heap_len &&
      (a < e.heap_len && zt(n, e.heap[a + 1], e.heap[a], e.depth) && a++,
      !zt(n, i, e.heap[a], e.depth));
    )
      ((e.heap[t] = e.heap[a]), (t = a), (a <<= 1));
    e.heap[t] = i;
  },
  Tt = (e, n, t) => {
    let i,
      a,
      r = 0,
      s,
      l;
    if (e.sym_next !== 0)
      do
        ((i = e.pending_buf[e.sym_buf + r++] & 255),
          (i += (e.pending_buf[e.sym_buf + r++] & 255) << 8),
          (a = e.pending_buf[e.sym_buf + r++]),
          i === 0
            ? P(e, a, n)
            : ((s = Ee[a]),
              P(e, s + Ue + 1, n),
              (l = ft[s]),
              l !== 0 && ((a -= yt[s]), O(e, a, l)),
              i--,
              (s = Rn(i)),
              P(e, s, t),
              (l = Pe[s]),
              l !== 0 && ((i -= He[s]), O(e, i, l))));
      while (r < e.sym_next);
    P(e, xt, n);
  },
  ct = (e, n) => {
    let t = n.dyn_tree,
      i = n.stat_desc.static_tree,
      a = n.stat_desc.has_stree,
      r = n.stat_desc.elems,
      s,
      l,
      d = -1,
      o;
    for (e.heap_len = 0, e.heap_max = mn, s = 0; s < r; s++)
      t[s * 2] !== 0 ? ((e.heap[++e.heap_len] = d = s), (e.depth[s] = 0)) : (t[s * 2 + 1] = 0);
    for (; e.heap_len < 2;)
      ((o = e.heap[++e.heap_len] = d < 2 ? ++d : 0),
        (t[o * 2] = 1),
        (e.depth[o] = 0),
        e.opt_len--,
        a && (e.static_len -= i[o * 2 + 1]));
    for (n.max_code = d, s = e.heap_len >> 1; s >= 1; s--) qe(e, t, s);
    o = r;
    do
      ((s = e.heap[1]),
        (e.heap[1] = e.heap[e.heap_len--]),
        qe(e, t, 1),
        (l = e.heap[1]),
        (e.heap[--e.heap_max] = s),
        (e.heap[--e.heap_max] = l),
        (t[o * 2] = t[s * 2] + t[l * 2]),
        (e.depth[o] = (e.depth[s] >= e.depth[l] ? e.depth[s] : e.depth[l]) + 1),
        (t[s * 2 + 1] = t[l * 2 + 1] = o),
        (e.heap[1] = o++),
        qe(e, t, 1));
    while (e.heap_len >= 2);
    ((e.heap[--e.heap_max] = e.heap[1]), wi(e, n), Mn(t, d, e.bl_count));
  },
  Dt = (e, n, t) => {
    let i,
      a = -1,
      r,
      s = n[1],
      l = 0,
      d = 7,
      o = 4;
    for (s === 0 && ((d = 138), (o = 3)), n[(t + 1) * 2 + 1] = 65535, i = 0; i <= t; i++)
      ((r = s),
        (s = n[(i + 1) * 2 + 1]),
        !(++l < d && r === s) &&
          (l < o
            ? (e.bl_tree[r * 2] += l)
            : r !== 0
              ? (r !== a && e.bl_tree[r * 2]++, e.bl_tree[pn * 2]++)
              : l <= 10
                ? e.bl_tree[wn * 2]++
                : e.bl_tree[xn * 2]++,
          (l = 0),
          (a = r),
          s === 0 ? ((d = 138), (o = 3)) : r === s ? ((d = 6), (o = 3)) : ((d = 7), (o = 4))));
  },
  Ot = (e, n, t) => {
    let i,
      a = -1,
      r,
      s = n[1],
      l = 0,
      d = 7,
      o = 4;
    for (s === 0 && ((d = 138), (o = 3)), i = 0; i <= t; i++)
      if (((r = s), (s = n[(i + 1) * 2 + 1]), !(++l < d && r === s))) {
        if (l < o)
          do P(e, r, e.bl_tree);
          while (--l !== 0);
        else
          r !== 0
            ? (r !== a && (P(e, r, e.bl_tree), l--), P(e, pn, e.bl_tree), O(e, l - 3, 2))
            : l <= 10
              ? (P(e, wn, e.bl_tree), O(e, l - 3, 3))
              : (P(e, xn, e.bl_tree), O(e, l - 11, 7));
        ((l = 0),
          (a = r),
          s === 0 ? ((d = 138), (o = 3)) : r === s ? ((d = 6), (o = 3)) : ((d = 7), (o = 4)));
      }
  },
  yi = e => {
    let n;
    for (
      Dt(e, e.dyn_ltree, e.l_desc.max_code),
        Dt(e, e.dyn_dtree, e.d_desc.max_code),
        ct(e, e.bl_desc),
        n = wt - 1;
      n >= 3 && e.bl_tree[yn[n] * 2 + 1] === 0;
      n--
    );
    return ((e.opt_len += 3 * (n + 1) + 5 + 5 + 4), n);
  },
  ki = (e, n, t, i) => {
    let a;
    for (O(e, n - 257, 5), O(e, t - 1, 5), O(e, i - 4, 4), a = 0; a < i; a++)
      O(e, e.bl_tree[yn[a] * 2 + 1], 3);
    (Ot(e, e.dyn_ltree, n - 1), Ot(e, e.dyn_dtree, t - 1));
  },
  vi = e => {
    let n = 4093624447,
      t;
    for (t = 0; t <= 31; t++, n >>>= 1) if (n & 1 && e.dyn_ltree[t * 2] !== 0) return 0;
    if (e.dyn_ltree[18] !== 0 || e.dyn_ltree[20] !== 0 || e.dyn_ltree[26] !== 0) return 1;
    for (t = 32; t < Ue; t++) if (e.dyn_ltree[t * 2] !== 0) return 1;
    return 0;
  },
  Nt = !1,
  Ei = e => {
    (Nt || (xi(), (Nt = !0)),
      (e.l_desc = new Je(e.dyn_ltree, kn)),
      (e.d_desc = new Je(e.dyn_dtree, vn)),
      (e.bl_desc = new Je(e.bl_tree, En)),
      (e.bi_buf = 0),
      (e.bi_valid = 0),
      Sn(e));
  },
  Un = (e, n, t, i) => {
    (O(e, (hi << 1) + (i ? 1 : 0), 3),
      In(e),
      Re(e, t),
      Re(e, ~t),
      t && e.pending_buf.set(e.window.subarray(n, n + t), e.pending),
      (e.pending += t));
  },
  Ri = e => {
    (O(e, gn << 1, 3), P(e, xt, X), pi(e));
  },
  Ai = (e, n, t, i) => {
    let a,
      r,
      s = 0;
    (e.level > 0
      ? (e.strm.data_type === 2 && (e.strm.data_type = vi(e)),
        ct(e, e.l_desc),
        ct(e, e.d_desc),
        (s = yi(e)),
        (a = (e.opt_len + 3 + 7) >>> 3),
        (r = (e.static_len + 3 + 7) >>> 3),
        r <= a && (a = r))
      : (a = r = t + 5),
      t + 4 <= a && n !== -1
        ? Un(e, n, t, i)
        : e.strategy === 4 || r === a
          ? (O(e, (gn << 1) + (i ? 1 : 0), 3), Tt(e, X, we))
          : (O(e, (di << 1) + (i ? 1 : 0), 3),
            ki(e, e.l_desc.max_code + 1, e.d_desc.max_code + 1, s + 1),
            Tt(e, e.dyn_ltree, e.dyn_dtree)),
      Sn(e),
      i && In(e));
  },
  Mi = (e, n, t) => (
    (e.pending_buf[e.sym_buf + e.sym_next++] = n),
    (e.pending_buf[e.sym_buf + e.sym_next++] = n >> 8),
    (e.pending_buf[e.sym_buf + e.sym_next++] = t),
    n === 0
      ? e.dyn_ltree[t * 2]++
      : (e.matches++, n--, e.dyn_ltree[(Ee[t] + Ue + 1) * 2]++, e.dyn_dtree[Rn(n) * 2]++),
    e.sym_next === e.sym_end
  ),
  Si = Ei,
  Ii = Un,
  Ui = Ai,
  zi = Mi,
  Ti = Ri,
  Di = { _tr_init: Si, _tr_stored_block: Ii, _tr_flush_block: Ui, _tr_tally: zi, _tr_align: Ti },
  Oi = (e, n, t, i) => {
    let a = (e & 65535) | 0,
      r = ((e >>> 16) & 65535) | 0,
      s = 0;
    for (; t !== 0;) {
      ((s = t > 2e3 ? 2e3 : t), (t -= s));
      do ((a = (a + n[i++]) | 0), (r = (r + a) | 0));
      while (--s);
      ((a %= 65521), (r %= 65521));
    }
    return a | (r << 16) | 0;
  },
  Ae = Oi,
  Ni = () => {
    let e,
      n = [];
    for (var t = 0; t < 256; t++) {
      e = t;
      for (var i = 0; i < 8; i++) e = e & 1 ? 3988292384 ^ (e >>> 1) : e >>> 1;
      n[t] = e;
    }
    return n;
  },
  Zi = new Uint32Array(Ni()),
  Li = (e, n, t, i) => {
    let a = Zi,
      r = i + t;
    e ^= -1;
    for (let s = i; s < r; s++) e = (e >>> 8) ^ a[(e ^ n[s]) & 255];
    return e ^ -1;
  },
  z = Li,
  ne = {
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
  re = {
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
  { _tr_init: Ci, _tr_stored_block: ht, _tr_flush_block: Fi, _tr_tally: W, _tr_align: $i } = Di,
  {
    Z_NO_FLUSH: V,
    Z_PARTIAL_FLUSH: Pi,
    Z_FULL_FLUSH: Hi,
    Z_FINISH: L,
    Z_BLOCK: Zt,
    Z_OK: T,
    Z_STREAM_END: Lt,
    Z_STREAM_ERROR: H,
    Z_DATA_ERROR: Yi,
    Z_BUF_ERROR: Qe,
    Z_DEFAULT_COMPRESSION: Bi,
    Z_FILTERED: Xi,
    Z_HUFFMAN_ONLY: Ze,
    Z_RLE: Ki,
    Z_FIXED: ji,
    Z_DEFAULT_STRATEGY: Gi,
    Z_UNKNOWN: Wi,
    Z_DEFLATED: Xe,
  } = re,
  Vi = 9,
  Ji = 15,
  qi = 8,
  Qi = 29,
  ea = 256,
  dt = ea + 1 + Qi,
  ta = 30,
  na = 19,
  ia = 2 * dt + 1,
  aa = 15,
  R = 3,
  G = 258,
  Y = G + R + 1,
  ra = 32,
  ce = 42,
  kt = 57,
  ut = 69,
  _t = 73,
  bt = 91,
  gt = 103,
  ee = 113,
  me = 666,
  D = 1,
  ue = 2,
  ie = 3,
  _e = 4,
  oa = 3,
  te = (e, n) => ((e.msg = ne[n]), n),
  Ct = e => e * 2 - (e > 4 ? 9 : 0),
  j = e => {
    let n = e.length;
    for (; --n >= 0;) e[n] = 0;
  },
  la = e => {
    let n,
      t,
      i,
      a = e.w_size;
    ((n = e.hash_size), (i = n));
    do ((t = e.head[--i]), (e.head[i] = t >= a ? t - a : 0));
    while (--n);
    ((n = a), (i = n));
    do ((t = e.prev[--i]), (e.prev[i] = t >= a ? t - a : 0));
    while (--n);
  },
  sa = (e, n, t) => ((n << e.hash_shift) ^ t) & e.hash_mask,
  J = sa,
  N = e => {
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
  Z = (e, n) => {
    (Fi(e, e.block_start >= 0 ? e.block_start : -1, e.strstart - e.block_start, n),
      (e.block_start = e.strstart),
      N(e.strm));
  },
  M = (e, n) => {
    e.pending_buf[e.pending++] = n;
  },
  ge = (e, n) => {
    ((e.pending_buf[e.pending++] = (n >>> 8) & 255), (e.pending_buf[e.pending++] = n & 255));
  },
  mt = (e, n, t, i) => {
    let a = e.avail_in;
    return (
      a > i && (a = i),
      a === 0
        ? 0
        : ((e.avail_in -= a),
          n.set(e.input.subarray(e.next_in, e.next_in + a), t),
          e.state.wrap === 1
            ? (e.adler = Ae(e.adler, n, a, t))
            : e.state.wrap === 2 && (e.adler = z(e.adler, n, a, t)),
          (e.next_in += a),
          (e.total_in += a),
          a)
    );
  },
  zn = (e, n) => {
    let t = e.max_chain_length,
      i = e.strstart,
      a,
      r,
      s = e.prev_length,
      l = e.nice_match,
      d = e.strstart > e.w_size - Y ? e.strstart - (e.w_size - Y) : 0,
      o = e.window,
      f = e.w_mask,
      x = e.prev,
      h = e.strstart + G,
      c = o[i + s - 1],
      m = o[i + s];
    (e.prev_length >= e.good_match && (t >>= 2), l > e.lookahead && (l = e.lookahead));
    do
      if (
        ((a = n), !(o[a + s] !== m || o[a + s - 1] !== c || o[a] !== o[i] || o[++a] !== o[i + 1]))
      ) {
        ((i += 2), a++);
        do;
        while (
          o[++i] === o[++a] &&
          o[++i] === o[++a] &&
          o[++i] === o[++a] &&
          o[++i] === o[++a] &&
          o[++i] === o[++a] &&
          o[++i] === o[++a] &&
          o[++i] === o[++a] &&
          o[++i] === o[++a] &&
          i < h
        );
        if (((r = G - (h - i)), (i = h - G), r > s)) {
          if (((e.match_start = n), (s = r), r >= l)) break;
          ((c = o[i + s - 1]), (m = o[i + s]));
        }
      }
    while ((n = x[n & f]) > d && --t !== 0);
    return s <= e.lookahead ? s : e.lookahead;
  },
  he = e => {
    let n = e.w_size,
      t,
      i,
      a;
    do {
      if (
        ((i = e.window_size - e.lookahead - e.strstart),
        e.strstart >= n + (n - Y) &&
          (e.window.set(e.window.subarray(n, n + n - i), 0),
          (e.match_start -= n),
          (e.strstart -= n),
          (e.block_start -= n),
          e.insert > e.strstart && (e.insert = e.strstart),
          la(e),
          (i += n)),
        e.strm.avail_in === 0)
      )
        break;
      if (
        ((t = mt(e.strm, e.window, e.strstart + e.lookahead, i)),
        (e.lookahead += t),
        e.lookahead + e.insert >= R)
      )
        for (
          a = e.strstart - e.insert,
            e.ins_h = e.window[a],
            e.ins_h = J(e, e.ins_h, e.window[a + 1]);
          e.insert &&
          ((e.ins_h = J(e, e.ins_h, e.window[a + R - 1])),
          (e.prev[a & e.w_mask] = e.head[e.ins_h]),
          (e.head[e.ins_h] = a),
          a++,
          e.insert--,
          !(e.lookahead + e.insert < R));
        );
    } while (e.lookahead < Y && e.strm.avail_in !== 0);
  },
  Tn = (e, n) => {
    let t = e.pending_buf_size - 5 > e.w_size ? e.w_size : e.pending_buf_size - 5,
      i,
      a,
      r,
      s = 0,
      l = e.strm.avail_in;
    do {
      if (
        ((i = 65535),
        (r = (e.bi_valid + 42) >> 3),
        e.strm.avail_out < r ||
          ((r = e.strm.avail_out - r),
          (a = e.strstart - e.block_start),
          i > a + e.strm.avail_in && (i = a + e.strm.avail_in),
          i > r && (i = r),
          i < t && ((i === 0 && n !== L) || n === V || i !== a + e.strm.avail_in)))
      )
        break;
      ((s = n === L && i === a + e.strm.avail_in ? 1 : 0),
        ht(e, 0, 0, s),
        (e.pending_buf[e.pending - 4] = i),
        (e.pending_buf[e.pending - 3] = i >> 8),
        (e.pending_buf[e.pending - 2] = ~i),
        (e.pending_buf[e.pending - 1] = ~i >> 8),
        N(e.strm),
        a &&
          (a > i && (a = i),
          e.strm.output.set(e.window.subarray(e.block_start, e.block_start + a), e.strm.next_out),
          (e.strm.next_out += a),
          (e.strm.avail_out -= a),
          (e.strm.total_out += a),
          (e.block_start += a),
          (i -= a)),
        i &&
          (mt(e.strm, e.strm.output, e.strm.next_out, i),
          (e.strm.next_out += i),
          (e.strm.avail_out -= i),
          (e.strm.total_out += i)));
    } while (s === 0);
    return (
      (l -= e.strm.avail_in),
      l &&
        (l >= e.w_size
          ? ((e.matches = 2),
            e.window.set(e.strm.input.subarray(e.strm.next_in - e.w_size, e.strm.next_in), 0),
            (e.strstart = e.w_size),
            (e.insert = e.strstart))
          : (e.window_size - e.strstart <= l &&
              ((e.strstart -= e.w_size),
              e.window.set(e.window.subarray(e.w_size, e.w_size + e.strstart), 0),
              e.matches < 2 && e.matches++,
              e.insert > e.strstart && (e.insert = e.strstart)),
            e.window.set(e.strm.input.subarray(e.strm.next_in - l, e.strm.next_in), e.strstart),
            (e.strstart += l),
            (e.insert += l > e.w_size - e.insert ? e.w_size - e.insert : l)),
        (e.block_start = e.strstart)),
      e.high_water < e.strstart && (e.high_water = e.strstart),
      s
        ? _e
        : n !== V && n !== L && e.strm.avail_in === 0 && e.strstart === e.block_start
          ? ue
          : ((r = e.window_size - e.strstart),
            e.strm.avail_in > r &&
              e.block_start >= e.w_size &&
              ((e.block_start -= e.w_size),
              (e.strstart -= e.w_size),
              e.window.set(e.window.subarray(e.w_size, e.w_size + e.strstart), 0),
              e.matches < 2 && e.matches++,
              (r += e.w_size),
              e.insert > e.strstart && (e.insert = e.strstart)),
            r > e.strm.avail_in && (r = e.strm.avail_in),
            r &&
              (mt(e.strm, e.window, e.strstart, r),
              (e.strstart += r),
              (e.insert += r > e.w_size - e.insert ? e.w_size - e.insert : r)),
            e.high_water < e.strstart && (e.high_water = e.strstart),
            (r = (e.bi_valid + 42) >> 3),
            (r = e.pending_buf_size - r > 65535 ? 65535 : e.pending_buf_size - r),
            (t = r > e.w_size ? e.w_size : r),
            (a = e.strstart - e.block_start),
            (a >= t || ((a || n === L) && n !== V && e.strm.avail_in === 0 && a <= r)) &&
              ((i = a > r ? r : a),
              (s = n === L && e.strm.avail_in === 0 && i === a ? 1 : 0),
              ht(e, e.block_start, i, s),
              (e.block_start += i),
              N(e.strm)),
            s ? ie : D)
    );
  },
  et = (e, n) => {
    let t, i;
    for (;;) {
      if (e.lookahead < Y) {
        if ((he(e), e.lookahead < Y && n === V)) return D;
        if (e.lookahead === 0) break;
      }
      if (
        ((t = 0),
        e.lookahead >= R &&
          ((e.ins_h = J(e, e.ins_h, e.window[e.strstart + R - 1])),
          (t = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h]),
          (e.head[e.ins_h] = e.strstart)),
        t !== 0 && e.strstart - t <= e.w_size - Y && (e.match_length = zn(e, t)),
        e.match_length >= R)
      )
        if (
          ((i = W(e, e.strstart - e.match_start, e.match_length - R)),
          (e.lookahead -= e.match_length),
          e.match_length <= e.max_lazy_match && e.lookahead >= R)
        ) {
          e.match_length--;
          do
            (e.strstart++,
              (e.ins_h = J(e, e.ins_h, e.window[e.strstart + R - 1])),
              (t = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h]),
              (e.head[e.ins_h] = e.strstart));
          while (--e.match_length !== 0);
          e.strstart++;
        } else
          ((e.strstart += e.match_length),
            (e.match_length = 0),
            (e.ins_h = e.window[e.strstart]),
            (e.ins_h = J(e, e.ins_h, e.window[e.strstart + 1])));
      else ((i = W(e, 0, e.window[e.strstart])), e.lookahead--, e.strstart++);
      if (i && (Z(e, !1), e.strm.avail_out === 0)) return D;
    }
    return (
      (e.insert = e.strstart < R - 1 ? e.strstart : R - 1),
      n === L
        ? (Z(e, !0), e.strm.avail_out === 0 ? ie : _e)
        : e.sym_next && (Z(e, !1), e.strm.avail_out === 0)
          ? D
          : ue
    );
  },
  le = (e, n) => {
    let t, i, a;
    for (;;) {
      if (e.lookahead < Y) {
        if ((he(e), e.lookahead < Y && n === V)) return D;
        if (e.lookahead === 0) break;
      }
      if (
        ((t = 0),
        e.lookahead >= R &&
          ((e.ins_h = J(e, e.ins_h, e.window[e.strstart + R - 1])),
          (t = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h]),
          (e.head[e.ins_h] = e.strstart)),
        (e.prev_length = e.match_length),
        (e.prev_match = e.match_start),
        (e.match_length = R - 1),
        t !== 0 &&
          e.prev_length < e.max_lazy_match &&
          e.strstart - t <= e.w_size - Y &&
          ((e.match_length = zn(e, t)),
          e.match_length <= 5 &&
            (e.strategy === Xi || (e.match_length === R && e.strstart - e.match_start > 4096)) &&
            (e.match_length = R - 1)),
        e.prev_length >= R && e.match_length <= e.prev_length)
      ) {
        ((a = e.strstart + e.lookahead - R),
          (i = W(e, e.strstart - 1 - e.prev_match, e.prev_length - R)),
          (e.lookahead -= e.prev_length - 1),
          (e.prev_length -= 2));
        do
          ++e.strstart <= a &&
            ((e.ins_h = J(e, e.ins_h, e.window[e.strstart + R - 1])),
            (t = e.prev[e.strstart & e.w_mask] = e.head[e.ins_h]),
            (e.head[e.ins_h] = e.strstart));
        while (--e.prev_length !== 0);
        if (
          ((e.match_available = 0),
          (e.match_length = R - 1),
          e.strstart++,
          i && (Z(e, !1), e.strm.avail_out === 0))
        )
          return D;
      } else if (e.match_available) {
        if (
          ((i = W(e, 0, e.window[e.strstart - 1])),
          i && Z(e, !1),
          e.strstart++,
          e.lookahead--,
          e.strm.avail_out === 0)
        )
          return D;
      } else ((e.match_available = 1), e.strstart++, e.lookahead--);
    }
    return (
      e.match_available && ((i = W(e, 0, e.window[e.strstart - 1])), (e.match_available = 0)),
      (e.insert = e.strstart < R - 1 ? e.strstart : R - 1),
      n === L
        ? (Z(e, !0), e.strm.avail_out === 0 ? ie : _e)
        : e.sym_next && (Z(e, !1), e.strm.avail_out === 0)
          ? D
          : ue
    );
  },
  fa = (e, n) => {
    let t,
      i,
      a,
      r,
      s = e.window;
    for (;;) {
      if (e.lookahead <= G) {
        if ((he(e), e.lookahead <= G && n === V)) return D;
        if (e.lookahead === 0) break;
      }
      if (
        ((e.match_length = 0),
        e.lookahead >= R &&
          e.strstart > 0 &&
          ((a = e.strstart - 1), (i = s[a]), i === s[++a] && i === s[++a] && i === s[++a]))
      ) {
        r = e.strstart + G;
        do;
        while (
          i === s[++a] &&
          i === s[++a] &&
          i === s[++a] &&
          i === s[++a] &&
          i === s[++a] &&
          i === s[++a] &&
          i === s[++a] &&
          i === s[++a] &&
          a < r
        );
        ((e.match_length = G - (r - a)),
          e.match_length > e.lookahead && (e.match_length = e.lookahead));
      }
      if (
        (e.match_length >= R
          ? ((t = W(e, 1, e.match_length - R)),
            (e.lookahead -= e.match_length),
            (e.strstart += e.match_length),
            (e.match_length = 0))
          : ((t = W(e, 0, e.window[e.strstart])), e.lookahead--, e.strstart++),
        t && (Z(e, !1), e.strm.avail_out === 0))
      )
        return D;
    }
    return (
      (e.insert = 0),
      n === L
        ? (Z(e, !0), e.strm.avail_out === 0 ? ie : _e)
        : e.sym_next && (Z(e, !1), e.strm.avail_out === 0)
          ? D
          : ue
    );
  },
  ca = (e, n) => {
    let t;
    for (;;) {
      if (e.lookahead === 0 && (he(e), e.lookahead === 0)) {
        if (n === V) return D;
        break;
      }
      if (
        ((e.match_length = 0),
        (t = W(e, 0, e.window[e.strstart])),
        e.lookahead--,
        e.strstart++,
        t && (Z(e, !1), e.strm.avail_out === 0))
      )
        return D;
    }
    return (
      (e.insert = 0),
      n === L
        ? (Z(e, !0), e.strm.avail_out === 0 ? ie : _e)
        : e.sym_next && (Z(e, !1), e.strm.avail_out === 0)
          ? D
          : ue
    );
  };
function $(e, n, t, i, a) {
  ((this.good_length = e),
    (this.max_lazy = n),
    (this.nice_length = t),
    (this.max_chain = i),
    (this.func = a));
}
var pe = [
    new $(0, 0, 0, 0, Tn),
    new $(4, 4, 8, 4, et),
    new $(4, 5, 16, 8, et),
    new $(4, 6, 32, 32, et),
    new $(4, 4, 16, 16, le),
    new $(8, 16, 32, 32, le),
    new $(8, 16, 128, 128, le),
    new $(8, 32, 128, 256, le),
    new $(32, 128, 258, 1024, le),
    new $(32, 258, 258, 4096, le),
  ],
  ha = e => {
    ((e.window_size = 2 * e.w_size),
      j(e.head),
      (e.max_lazy_match = pe[e.level].max_lazy),
      (e.good_match = pe[e.level].good_length),
      (e.nice_match = pe[e.level].nice_length),
      (e.max_chain_length = pe[e.level].max_chain),
      (e.strstart = 0),
      (e.block_start = 0),
      (e.lookahead = 0),
      (e.insert = 0),
      (e.match_length = e.prev_length = R - 1),
      (e.match_available = 0),
      (e.ins_h = 0));
  };
function da() {
  ((this.strm = null),
    (this.status = 0),
    (this.pending_buf = null),
    (this.pending_buf_size = 0),
    (this.pending_out = 0),
    (this.pending = 0),
    (this.wrap = 0),
    (this.gzhead = null),
    (this.gzindex = 0),
    (this.method = Xe),
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
    (this.dyn_ltree = new Uint16Array(ia * 2)),
    (this.dyn_dtree = new Uint16Array((2 * ta + 1) * 2)),
    (this.bl_tree = new Uint16Array((2 * na + 1) * 2)),
    j(this.dyn_ltree),
    j(this.dyn_dtree),
    j(this.bl_tree),
    (this.l_desc = null),
    (this.d_desc = null),
    (this.bl_desc = null),
    (this.bl_count = new Uint16Array(aa + 1)),
    (this.heap = new Uint16Array(2 * dt + 1)),
    j(this.heap),
    (this.heap_len = 0),
    (this.heap_max = 0),
    (this.depth = new Uint16Array(2 * dt + 1)),
    j(this.depth),
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
var ze = e => {
    if (!e) return 1;
    let n = e.state;
    return !n ||
      n.strm !== e ||
      (n.status !== ce &&
        n.status !== kt &&
        n.status !== ut &&
        n.status !== _t &&
        n.status !== bt &&
        n.status !== gt &&
        n.status !== ee &&
        n.status !== me)
      ? 1
      : 0;
  },
  Dn = e => {
    if (ze(e)) return te(e, H);
    ((e.total_in = e.total_out = 0), (e.data_type = Wi));
    let n = e.state;
    return (
      (n.pending = 0),
      (n.pending_out = 0),
      n.wrap < 0 && (n.wrap = -n.wrap),
      (n.status = n.wrap === 2 ? kt : n.wrap ? ce : ee),
      (e.adler = n.wrap === 2 ? 0 : 1),
      (n.last_flush = -2),
      Ci(n),
      T
    );
  },
  On = e => {
    let n = Dn(e);
    return (n === T && ha(e.state), n);
  },
  ua = (e, n) => (ze(e) || e.state.wrap !== 2 ? H : ((e.state.gzhead = n), T)),
  Nn = (e, n, t, i, a, r) => {
    if (!e) return H;
    let s = 1;
    if (
      (n === Bi && (n = 6),
      i < 0 ? ((s = 0), (i = -i)) : i > 15 && ((s = 2), (i -= 16)),
      a < 1 ||
        a > Vi ||
        t !== Xe ||
        i < 8 ||
        i > 15 ||
        n < 0 ||
        n > 9 ||
        r < 0 ||
        r > ji ||
        (i === 8 && s !== 1))
    )
      return te(e, H);
    i === 8 && (i = 9);
    let l = new da();
    return (
      (e.state = l),
      (l.strm = e),
      (l.status = ce),
      (l.wrap = s),
      (l.gzhead = null),
      (l.w_bits = i),
      (l.w_size = 1 << l.w_bits),
      (l.w_mask = l.w_size - 1),
      (l.hash_bits = a + 7),
      (l.hash_size = 1 << l.hash_bits),
      (l.hash_mask = l.hash_size - 1),
      (l.hash_shift = ~~((l.hash_bits + R - 1) / R)),
      (l.window = new Uint8Array(l.w_size * 2)),
      (l.head = new Uint16Array(l.hash_size)),
      (l.prev = new Uint16Array(l.w_size)),
      (l.lit_bufsize = 1 << (a + 6)),
      (l.pending_buf_size = l.lit_bufsize * 4),
      (l.pending_buf = new Uint8Array(l.pending_buf_size)),
      (l.sym_buf = l.lit_bufsize),
      (l.sym_end = (l.lit_bufsize - 1) * 3),
      (l.level = n),
      (l.strategy = r),
      (l.method = t),
      On(e)
    );
  },
  _a = (e, n) => Nn(e, n, Xe, Ji, qi, Gi),
  ba = (e, n) => {
    if (ze(e) || n > Zt || n < 0) return e ? te(e, H) : H;
    let t = e.state;
    if (!e.output || (e.avail_in !== 0 && !e.input) || (t.status === me && n !== L))
      return te(e, e.avail_out === 0 ? Qe : H);
    let i = t.last_flush;
    if (((t.last_flush = n), t.pending !== 0)) {
      if ((N(e), e.avail_out === 0)) return ((t.last_flush = -1), T);
    } else if (e.avail_in === 0 && Ct(n) <= Ct(i) && n !== L) return te(e, Qe);
    if (t.status === me && e.avail_in !== 0) return te(e, Qe);
    if ((t.status === ce && t.wrap === 0 && (t.status = ee), t.status === ce)) {
      let a = (Xe + ((t.w_bits - 8) << 4)) << 8,
        r = -1;
      if (
        (t.strategy >= Ze || t.level < 2
          ? (r = 0)
          : t.level < 6
            ? (r = 1)
            : t.level === 6
              ? (r = 2)
              : (r = 3),
        (a |= r << 6),
        t.strstart !== 0 && (a |= ra),
        (a += 31 - (a % 31)),
        ge(t, a),
        t.strstart !== 0 && (ge(t, e.adler >>> 16), ge(t, e.adler & 65535)),
        (e.adler = 1),
        (t.status = ee),
        N(e),
        t.pending !== 0)
      )
        return ((t.last_flush = -1), T);
    }
    if (t.status === kt) {
      if (((e.adler = 0), M(t, 31), M(t, 139), M(t, 8), t.gzhead))
        (M(
          t,
          (t.gzhead.text ? 1 : 0) +
            (t.gzhead.hcrc ? 2 : 0) +
            (t.gzhead.extra ? 4 : 0) +
            (t.gzhead.name ? 8 : 0) +
            (t.gzhead.comment ? 16 : 0)
        ),
          M(t, t.gzhead.time & 255),
          M(t, (t.gzhead.time >> 8) & 255),
          M(t, (t.gzhead.time >> 16) & 255),
          M(t, (t.gzhead.time >> 24) & 255),
          M(t, t.level === 9 ? 2 : t.strategy >= Ze || t.level < 2 ? 4 : 0),
          M(t, t.gzhead.os & 255),
          t.gzhead.extra &&
            t.gzhead.extra.length &&
            (M(t, t.gzhead.extra.length & 255), M(t, (t.gzhead.extra.length >> 8) & 255)),
          t.gzhead.hcrc && (e.adler = z(e.adler, t.pending_buf, t.pending, 0)),
          (t.gzindex = 0),
          (t.status = ut));
      else if (
        (M(t, 0),
        M(t, 0),
        M(t, 0),
        M(t, 0),
        M(t, 0),
        M(t, t.level === 9 ? 2 : t.strategy >= Ze || t.level < 2 ? 4 : 0),
        M(t, oa),
        (t.status = ee),
        N(e),
        t.pending !== 0)
      )
        return ((t.last_flush = -1), T);
    }
    if (t.status === ut) {
      if (t.gzhead.extra) {
        let a = t.pending,
          r = (t.gzhead.extra.length & 65535) - t.gzindex;
        for (; t.pending + r > t.pending_buf_size;) {
          let l = t.pending_buf_size - t.pending;
          if (
            (t.pending_buf.set(t.gzhead.extra.subarray(t.gzindex, t.gzindex + l), t.pending),
            (t.pending = t.pending_buf_size),
            t.gzhead.hcrc &&
              t.pending > a &&
              (e.adler = z(e.adler, t.pending_buf, t.pending - a, a)),
            (t.gzindex += l),
            N(e),
            t.pending !== 0)
          )
            return ((t.last_flush = -1), T);
          ((a = 0), (r -= l));
        }
        let s = new Uint8Array(t.gzhead.extra);
        (t.pending_buf.set(s.subarray(t.gzindex, t.gzindex + r), t.pending),
          (t.pending += r),
          t.gzhead.hcrc && t.pending > a && (e.adler = z(e.adler, t.pending_buf, t.pending - a, a)),
          (t.gzindex = 0));
      }
      t.status = _t;
    }
    if (t.status === _t) {
      if (t.gzhead.name) {
        let a = t.pending,
          r;
        do {
          if (t.pending === t.pending_buf_size) {
            if (
              (t.gzhead.hcrc &&
                t.pending > a &&
                (e.adler = z(e.adler, t.pending_buf, t.pending - a, a)),
              N(e),
              t.pending !== 0)
            )
              return ((t.last_flush = -1), T);
            a = 0;
          }
          (t.gzindex < t.gzhead.name.length
            ? (r = t.gzhead.name.charCodeAt(t.gzindex++) & 255)
            : (r = 0),
            M(t, r));
        } while (r !== 0);
        (t.gzhead.hcrc && t.pending > a && (e.adler = z(e.adler, t.pending_buf, t.pending - a, a)),
          (t.gzindex = 0));
      }
      t.status = bt;
    }
    if (t.status === bt) {
      if (t.gzhead.comment) {
        let a = t.pending,
          r;
        do {
          if (t.pending === t.pending_buf_size) {
            if (
              (t.gzhead.hcrc &&
                t.pending > a &&
                (e.adler = z(e.adler, t.pending_buf, t.pending - a, a)),
              N(e),
              t.pending !== 0)
            )
              return ((t.last_flush = -1), T);
            a = 0;
          }
          (t.gzindex < t.gzhead.comment.length
            ? (r = t.gzhead.comment.charCodeAt(t.gzindex++) & 255)
            : (r = 0),
            M(t, r));
        } while (r !== 0);
        t.gzhead.hcrc && t.pending > a && (e.adler = z(e.adler, t.pending_buf, t.pending - a, a));
      }
      t.status = gt;
    }
    if (t.status === gt) {
      if (t.gzhead.hcrc) {
        if (t.pending + 2 > t.pending_buf_size && (N(e), t.pending !== 0))
          return ((t.last_flush = -1), T);
        (M(t, e.adler & 255), M(t, (e.adler >> 8) & 255), (e.adler = 0));
      }
      if (((t.status = ee), N(e), t.pending !== 0)) return ((t.last_flush = -1), T);
    }
    if (e.avail_in !== 0 || t.lookahead !== 0 || (n !== V && t.status !== me)) {
      let a =
        t.level === 0
          ? Tn(t, n)
          : t.strategy === Ze
            ? ca(t, n)
            : t.strategy === Ki
              ? fa(t, n)
              : pe[t.level].func(t, n);
      if (((a === ie || a === _e) && (t.status = me), a === D || a === ie))
        return (e.avail_out === 0 && (t.last_flush = -1), T);
      if (
        a === ue &&
        (n === Pi
          ? $i(t)
          : n !== Zt &&
            (ht(t, 0, 0, !1),
            n === Hi &&
              (j(t.head),
              t.lookahead === 0 && ((t.strstart = 0), (t.block_start = 0), (t.insert = 0)))),
        N(e),
        e.avail_out === 0)
      )
        return ((t.last_flush = -1), T);
    }
    return n !== L
      ? T
      : t.wrap <= 0
        ? Lt
        : (t.wrap === 2
            ? (M(t, e.adler & 255),
              M(t, (e.adler >> 8) & 255),
              M(t, (e.adler >> 16) & 255),
              M(t, (e.adler >> 24) & 255),
              M(t, e.total_in & 255),
              M(t, (e.total_in >> 8) & 255),
              M(t, (e.total_in >> 16) & 255),
              M(t, (e.total_in >> 24) & 255))
            : (ge(t, e.adler >>> 16), ge(t, e.adler & 65535)),
          N(e),
          t.wrap > 0 && (t.wrap = -t.wrap),
          t.pending !== 0 ? T : Lt);
  },
  ga = e => {
    if (ze(e)) return H;
    let n = e.state.status;
    return ((e.state = null), n === ee ? te(e, Yi) : T);
  },
  ma = (e, n) => {
    let t = n.length;
    if (ze(e)) return H;
    let i = e.state,
      a = i.wrap;
    if (a === 2 || (a === 1 && i.status !== ce) || i.lookahead) return H;
    if ((a === 1 && (e.adler = Ae(e.adler, n, t, 0)), (i.wrap = 0), t >= i.w_size)) {
      a === 0 && (j(i.head), (i.strstart = 0), (i.block_start = 0), (i.insert = 0));
      let d = new Uint8Array(i.w_size);
      (d.set(n.subarray(t - i.w_size, t), 0), (n = d), (t = i.w_size));
    }
    let r = e.avail_in,
      s = e.next_in,
      l = e.input;
    for (e.avail_in = t, e.next_in = 0, e.input = n, he(i); i.lookahead >= R;) {
      let d = i.strstart,
        o = i.lookahead - (R - 1);
      do
        ((i.ins_h = J(i, i.ins_h, i.window[d + R - 1])),
          (i.prev[d & i.w_mask] = i.head[i.ins_h]),
          (i.head[i.ins_h] = d),
          d++);
      while (--o);
      ((i.strstart = d), (i.lookahead = R - 1), he(i));
    }
    return (
      (i.strstart += i.lookahead),
      (i.block_start = i.strstart),
      (i.insert = i.lookahead),
      (i.lookahead = 0),
      (i.match_length = i.prev_length = R - 1),
      (i.match_available = 0),
      (e.next_in = s),
      (e.input = l),
      (e.avail_in = r),
      (i.wrap = a),
      T
    );
  },
  pa = _a,
  wa = Nn,
  xa = On,
  ya = Dn,
  ka = ua,
  va = ba,
  Ea = ga,
  Ra = ma,
  Aa = 'pako deflate (from Nodeca project)',
  xe = {
    deflateInit: pa,
    deflateInit2: wa,
    deflateReset: xa,
    deflateResetKeep: ya,
    deflateSetHeader: ka,
    deflate: va,
    deflateEnd: Ea,
    deflateSetDictionary: Ra,
    deflateInfo: Aa,
  },
  Ma = (e, n) => Object.prototype.hasOwnProperty.call(e, n),
  Sa = function (e) {
    let n = Array.prototype.slice.call(arguments, 1);
    for (; n.length;) {
      let t = n.shift();
      if (t) {
        if (typeof t != 'object') throw new TypeError(t + 'must be non-object');
        for (let i in t) Ma(t, i) && (e[i] = t[i]);
      }
    }
    return e;
  },
  Ia = e => {
    let n = 0;
    for (let i = 0, a = e.length; i < a; i++) n += e[i].length;
    let t = new Uint8Array(n);
    for (let i = 0, a = 0, r = e.length; i < r; i++) {
      let s = e[i];
      (t.set(s, a), (a += s.length));
    }
    return t;
  },
  Ke = { assign: Sa, flattenChunks: Ia },
  Zn = !0;
try {
  String.fromCharCode.apply(null, new Uint8Array(1));
} catch {
  Zn = !1;
}
var Me = new Uint8Array(256);
for (let e = 0; e < 256; e++)
  Me[e] = e >= 252 ? 6 : e >= 248 ? 5 : e >= 240 ? 4 : e >= 224 ? 3 : e >= 192 ? 2 : 1;
Me[254] = Me[254] = 1;
var Ua = e => {
    if (typeof TextEncoder == 'function' && TextEncoder.prototype.encode)
      return new TextEncoder().encode(e);
    let n,
      t,
      i,
      a,
      r,
      s = e.length,
      l = 0;
    for (a = 0; a < s; a++)
      ((t = e.charCodeAt(a)),
        (t & 64512) === 55296 &&
          a + 1 < s &&
          ((i = e.charCodeAt(a + 1)),
          (i & 64512) === 56320 && ((t = 65536 + ((t - 55296) << 10) + (i - 56320)), a++)),
        (l += t < 128 ? 1 : t < 2048 ? 2 : t < 65536 ? 3 : 4));
    for (n = new Uint8Array(l), r = 0, a = 0; r < l; a++)
      ((t = e.charCodeAt(a)),
        (t & 64512) === 55296 &&
          a + 1 < s &&
          ((i = e.charCodeAt(a + 1)),
          (i & 64512) === 56320 && ((t = 65536 + ((t - 55296) << 10) + (i - 56320)), a++)),
        t < 128
          ? (n[r++] = t)
          : t < 2048
            ? ((n[r++] = 192 | (t >>> 6)), (n[r++] = 128 | (t & 63)))
            : t < 65536
              ? ((n[r++] = 224 | (t >>> 12)),
                (n[r++] = 128 | ((t >>> 6) & 63)),
                (n[r++] = 128 | (t & 63)))
              : ((n[r++] = 240 | (t >>> 18)),
                (n[r++] = 128 | ((t >>> 12) & 63)),
                (n[r++] = 128 | ((t >>> 6) & 63)),
                (n[r++] = 128 | (t & 63))));
    return n;
  },
  za = (e, n) => {
    if (n < 65534 && e.subarray && Zn)
      return String.fromCharCode.apply(null, e.length === n ? e : e.subarray(0, n));
    let t = '';
    for (let i = 0; i < n; i++) t += String.fromCharCode(e[i]);
    return t;
  },
  Ta = (e, n) => {
    let t = n || e.length;
    if (typeof TextDecoder == 'function' && TextDecoder.prototype.decode)
      return new TextDecoder().decode(e.subarray(0, n));
    let i,
      a,
      r = new Array(t * 2);
    for (a = 0, i = 0; i < t;) {
      let s = e[i++];
      if (s < 128) {
        r[a++] = s;
        continue;
      }
      let l = Me[s];
      if (l > 4) {
        ((r[a++] = 65533), (i += l - 1));
        continue;
      }
      for (s &= l === 2 ? 31 : l === 3 ? 15 : 7; l > 1 && i < t;)
        ((s = (s << 6) | (e[i++] & 63)), l--);
      if (l > 1) {
        r[a++] = 65533;
        continue;
      }
      s < 65536
        ? (r[a++] = s)
        : ((s -= 65536), (r[a++] = 55296 | ((s >> 10) & 1023)), (r[a++] = 56320 | (s & 1023)));
    }
    return za(r, a);
  },
  Da = (e, n) => {
    ((n = n || e.length), n > e.length && (n = e.length));
    let t = n - 1;
    for (; t >= 0 && (e[t] & 192) === 128;) t--;
    return t < 0 || t === 0 ? n : t + Me[e[t]] > n ? t : n;
  },
  Se = { string2buf: Ua, buf2string: Ta, utf8border: Da };
function Oa() {
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
var Ln = Oa,
  Cn = Object.prototype.toString,
  {
    Z_NO_FLUSH: Na,
    Z_SYNC_FLUSH: Za,
    Z_FULL_FLUSH: La,
    Z_FINISH: Ca,
    Z_OK: Ye,
    Z_STREAM_END: Fa,
    Z_DEFAULT_COMPRESSION: $a,
    Z_DEFAULT_STRATEGY: Pa,
    Z_DEFLATED: Ha,
  } = re;
function Te(e) {
  this.options = Ke.assign(
    { level: $a, method: Ha, chunkSize: 16384, windowBits: 15, memLevel: 8, strategy: Pa },
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
    (this.strm = new Ln()),
    (this.strm.avail_out = 0));
  let t = xe.deflateInit2(this.strm, n.level, n.method, n.windowBits, n.memLevel, n.strategy);
  if (t !== Ye) throw new Error(ne[t]);
  if ((n.header && xe.deflateSetHeader(this.strm, n.header), n.dictionary)) {
    let i;
    if (
      (typeof n.dictionary == 'string'
        ? (i = Se.string2buf(n.dictionary))
        : Cn.call(n.dictionary) === '[object ArrayBuffer]'
          ? (i = new Uint8Array(n.dictionary))
          : (i = n.dictionary),
      (t = xe.deflateSetDictionary(this.strm, i)),
      t !== Ye)
    )
      throw new Error(ne[t]);
    this._dict_set = !0;
  }
}
Te.prototype.push = function (e, n) {
  let t = this.strm,
    i = this.options.chunkSize,
    a,
    r;
  if (this.ended) return !1;
  for (
    n === ~~n ? (r = n) : (r = n === !0 ? Ca : Na),
      typeof e == 'string'
        ? (t.input = Se.string2buf(e))
        : Cn.call(e) === '[object ArrayBuffer]'
          ? (t.input = new Uint8Array(e))
          : (t.input = e),
      t.next_in = 0,
      t.avail_in = t.input.length;
    ;
  ) {
    if (
      (t.avail_out === 0 && ((t.output = new Uint8Array(i)), (t.next_out = 0), (t.avail_out = i)),
      (r === Za || r === La) && t.avail_out <= 6)
    ) {
      (this.onData(t.output.subarray(0, t.next_out)), (t.avail_out = 0));
      continue;
    }
    if (((a = xe.deflate(t, r)), a === Fa))
      return (
        t.next_out > 0 && this.onData(t.output.subarray(0, t.next_out)),
        (a = xe.deflateEnd(this.strm)),
        this.onEnd(a),
        (this.ended = !0),
        a === Ye
      );
    if (t.avail_out === 0) {
      this.onData(t.output);
      continue;
    }
    if (r > 0 && t.next_out > 0) {
      (this.onData(t.output.subarray(0, t.next_out)), (t.avail_out = 0));
      continue;
    }
    if (t.avail_in === 0) break;
  }
  return !0;
};
Te.prototype.onData = function (e) {
  this.chunks.push(e);
};
Te.prototype.onEnd = function (e) {
  (e === Ye && (this.result = Ke.flattenChunks(this.chunks)),
    (this.chunks = []),
    (this.err = e),
    (this.msg = this.strm.msg));
};
function vt(e, n) {
  let t = new Te(n);
  if ((t.push(e, !0), t.err)) throw t.msg || ne[t.err];
  return t.result;
}
function Ya(e, n) {
  return ((n = n || {}), (n.raw = !0), vt(e, n));
}
function Ba(e, n) {
  return ((n = n || {}), (n.gzip = !0), vt(e, n));
}
var Xa = Te,
  Ka = vt,
  ja = Ya,
  Ga = Ba,
  Wa = re,
  Va = { Deflate: Xa, deflate: Ka, deflateRaw: ja, gzip: Ga, constants: Wa },
  Le = 16209,
  Ja = 16191,
  qa = function (n, t) {
    let i,
      a,
      r,
      s,
      l,
      d,
      o,
      f,
      x,
      h,
      c,
      m,
      b,
      _,
      g,
      k,
      p,
      u,
      y,
      S,
      w,
      I,
      A,
      v,
      E = n.state;
    ((i = n.next_in),
      (A = n.input),
      (a = i + (n.avail_in - 5)),
      (r = n.next_out),
      (v = n.output),
      (s = r - (t - n.avail_out)),
      (l = r + (n.avail_out - 257)),
      (d = E.dmax),
      (o = E.wsize),
      (f = E.whave),
      (x = E.wnext),
      (h = E.window),
      (c = E.hold),
      (m = E.bits),
      (b = E.lencode),
      (_ = E.distcode),
      (g = (1 << E.lenbits) - 1),
      (k = (1 << E.distbits) - 1));
    e: do {
      (m < 15 && ((c += A[i++] << m), (m += 8), (c += A[i++] << m), (m += 8)), (p = b[c & g]));
      t: for (;;) {
        if (((u = p >>> 24), (c >>>= u), (m -= u), (u = (p >>> 16) & 255), u === 0))
          v[r++] = p & 65535;
        else if (u & 16) {
          ((y = p & 65535),
            (u &= 15),
            u &&
              (m < u && ((c += A[i++] << m), (m += 8)),
              (y += c & ((1 << u) - 1)),
              (c >>>= u),
              (m -= u)),
            m < 15 && ((c += A[i++] << m), (m += 8), (c += A[i++] << m), (m += 8)),
            (p = _[c & k]));
          n: for (;;) {
            if (((u = p >>> 24), (c >>>= u), (m -= u), (u = (p >>> 16) & 255), u & 16)) {
              if (
                ((S = p & 65535),
                (u &= 15),
                m < u && ((c += A[i++] << m), (m += 8), m < u && ((c += A[i++] << m), (m += 8))),
                (S += c & ((1 << u) - 1)),
                S > d)
              ) {
                ((n.msg = 'invalid distance too far back'), (E.mode = Le));
                break e;
              }
              if (((c >>>= u), (m -= u), (u = r - s), S > u)) {
                if (((u = S - u), u > f && E.sane)) {
                  ((n.msg = 'invalid distance too far back'), (E.mode = Le));
                  break e;
                }
                if (((w = 0), (I = h), x === 0)) {
                  if (((w += o - u), u < y)) {
                    y -= u;
                    do v[r++] = h[w++];
                    while (--u);
                    ((w = r - S), (I = v));
                  }
                } else if (x < u) {
                  if (((w += o + x - u), (u -= x), u < y)) {
                    y -= u;
                    do v[r++] = h[w++];
                    while (--u);
                    if (((w = 0), x < y)) {
                      ((u = x), (y -= u));
                      do v[r++] = h[w++];
                      while (--u);
                      ((w = r - S), (I = v));
                    }
                  }
                } else if (((w += x - u), u < y)) {
                  y -= u;
                  do v[r++] = h[w++];
                  while (--u);
                  ((w = r - S), (I = v));
                }
                for (; y > 2;) ((v[r++] = I[w++]), (v[r++] = I[w++]), (v[r++] = I[w++]), (y -= 3));
                y && ((v[r++] = I[w++]), y > 1 && (v[r++] = I[w++]));
              } else {
                w = r - S;
                do ((v[r++] = v[w++]), (v[r++] = v[w++]), (v[r++] = v[w++]), (y -= 3));
                while (y > 2);
                y && ((v[r++] = v[w++]), y > 1 && (v[r++] = v[w++]));
              }
            } else if ((u & 64) === 0) {
              p = _[(p & 65535) + (c & ((1 << u) - 1))];
              continue n;
            } else {
              ((n.msg = 'invalid distance code'), (E.mode = Le));
              break e;
            }
            break;
          }
        } else if ((u & 64) === 0) {
          p = b[(p & 65535) + (c & ((1 << u) - 1))];
          continue t;
        } else if (u & 32) {
          E.mode = Ja;
          break e;
        } else {
          ((n.msg = 'invalid literal/length code'), (E.mode = Le));
          break e;
        }
        break;
      }
    } while (i < a && r < l);
    ((y = m >> 3),
      (i -= y),
      (m -= y << 3),
      (c &= (1 << m) - 1),
      (n.next_in = i),
      (n.next_out = r),
      (n.avail_in = i < a ? 5 + (a - i) : 5 - (i - a)),
      (n.avail_out = r < l ? 257 + (l - r) : 257 - (r - l)),
      (E.hold = c),
      (E.bits = m));
  },
  se = 15,
  Ft = 852,
  $t = 592,
  Pt = 0,
  tt = 1,
  Ht = 2,
  Qa = new Uint16Array([
    3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
    163, 195, 227, 258, 0, 0,
  ]),
  er = new Uint8Array([
    16, 16, 16, 16, 16, 16, 16, 16, 17, 17, 17, 17, 18, 18, 18, 18, 19, 19, 19, 19, 20, 20, 20, 20,
    21, 21, 21, 21, 16, 72, 78,
  ]),
  tr = new Uint16Array([
    1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049,
    3073, 4097, 6145, 8193, 12289, 16385, 24577, 0, 0,
  ]),
  nr = new Uint8Array([
    16, 16, 16, 16, 17, 17, 18, 18, 19, 19, 20, 20, 21, 21, 22, 22, 23, 23, 24, 24, 25, 25, 26, 26,
    27, 27, 28, 28, 29, 29, 64, 64,
  ]),
  ir = (e, n, t, i, a, r, s, l) => {
    let d = l.bits,
      o = 0,
      f = 0,
      x = 0,
      h = 0,
      c = 0,
      m = 0,
      b = 0,
      _ = 0,
      g = 0,
      k = 0,
      p,
      u,
      y,
      S,
      w,
      I = null,
      A,
      v = new Uint16Array(se + 1),
      E = new Uint16Array(se + 1),
      q = null,
      Ut,
      Oe,
      Ne;
    for (o = 0; o <= se; o++) v[o] = 0;
    for (f = 0; f < i; f++) v[n[t + f]]++;
    for (c = d, h = se; h >= 1 && v[h] === 0; h--);
    if ((c > h && (c = h), h === 0))
      return (
        (a[r++] = (1 << 24) | (64 << 16) | 0),
        (a[r++] = (1 << 24) | (64 << 16) | 0),
        (l.bits = 1),
        0
      );
    for (x = 1; x < h && v[x] === 0; x++);
    for (c < x && (c = x), _ = 1, o = 1; o <= se; o++)
      if (((_ <<= 1), (_ -= v[o]), _ < 0)) return -1;
    if (_ > 0 && (e === Pt || h !== 1)) return -1;
    for (E[1] = 0, o = 1; o < se; o++) E[o + 1] = E[o] + v[o];
    for (f = 0; f < i; f++) n[t + f] !== 0 && (s[E[n[t + f]]++] = f);
    if (
      (e === Pt
        ? ((I = q = s), (A = 20))
        : e === tt
          ? ((I = Qa), (q = er), (A = 257))
          : ((I = tr), (q = nr), (A = 0)),
      (k = 0),
      (f = 0),
      (o = x),
      (w = r),
      (m = c),
      (b = 0),
      (y = -1),
      (g = 1 << c),
      (S = g - 1),
      (e === tt && g > Ft) || (e === Ht && g > $t))
    )
      return 1;
    for (;;) {
      ((Ut = o - b),
        s[f] + 1 < A
          ? ((Oe = 0), (Ne = s[f]))
          : s[f] >= A
            ? ((Oe = q[s[f] - A]), (Ne = I[s[f] - A]))
            : ((Oe = 96), (Ne = 0)),
        (p = 1 << (o - b)),
        (u = 1 << m),
        (x = u));
      do ((u -= p), (a[w + (k >> b) + u] = (Ut << 24) | (Oe << 16) | Ne | 0));
      while (u !== 0);
      for (p = 1 << (o - 1); k & p;) p >>= 1;
      if ((p !== 0 ? ((k &= p - 1), (k += p)) : (k = 0), f++, --v[o] === 0)) {
        if (o === h) break;
        o = n[t + s[f]];
      }
      if (o > c && (k & S) !== y) {
        for (
          b === 0 && (b = c), w += x, m = o - b, _ = 1 << m;
          m + b < h && ((_ -= v[m + b]), !(_ <= 0));
        )
          (m++, (_ <<= 1));
        if (((g += 1 << m), (e === tt && g > Ft) || (e === Ht && g > $t))) return 1;
        ((y = k & S), (a[y] = (c << 24) | (m << 16) | (w - r) | 0));
      }
    }
    return (k !== 0 && (a[w + k] = ((o - b) << 24) | (64 << 16) | 0), (l.bits = c), 0);
  },
  ye = ir,
  ar = 0,
  Fn = 1,
  $n = 2,
  {
    Z_FINISH: Yt,
    Z_BLOCK: rr,
    Z_TREES: Ce,
    Z_OK: ae,
    Z_STREAM_END: or,
    Z_NEED_DICT: lr,
    Z_STREAM_ERROR: C,
    Z_DATA_ERROR: Pn,
    Z_MEM_ERROR: Hn,
    Z_BUF_ERROR: sr,
    Z_DEFLATED: Bt,
  } = re,
  je = 16180,
  Xt = 16181,
  Kt = 16182,
  jt = 16183,
  Gt = 16184,
  Wt = 16185,
  Vt = 16186,
  Jt = 16187,
  qt = 16188,
  Qt = 16189,
  Be = 16190,
  B = 16191,
  nt = 16192,
  en = 16193,
  it = 16194,
  tn = 16195,
  nn = 16196,
  an = 16197,
  rn = 16198,
  Fe = 16199,
  $e = 16200,
  on = 16201,
  ln = 16202,
  sn = 16203,
  fn = 16204,
  cn = 16205,
  at = 16206,
  hn = 16207,
  dn = 16208,
  U = 16209,
  Yn = 16210,
  Bn = 16211,
  fr = 852,
  cr = 592,
  hr = 15,
  dr = hr,
  un = e => ((e >>> 24) & 255) + ((e >>> 8) & 65280) + ((e & 65280) << 8) + ((e & 255) << 24);
function ur() {
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
var oe = e => {
    if (!e) return 1;
    let n = e.state;
    return !n || n.strm !== e || n.mode < je || n.mode > Bn ? 1 : 0;
  },
  Xn = e => {
    if (oe(e)) return C;
    let n = e.state;
    return (
      (e.total_in = e.total_out = n.total = 0),
      (e.msg = ''),
      n.wrap && (e.adler = n.wrap & 1),
      (n.mode = je),
      (n.last = 0),
      (n.havedict = 0),
      (n.flags = -1),
      (n.dmax = 32768),
      (n.head = null),
      (n.hold = 0),
      (n.bits = 0),
      (n.lencode = n.lendyn = new Int32Array(fr)),
      (n.distcode = n.distdyn = new Int32Array(cr)),
      (n.sane = 1),
      (n.back = -1),
      ae
    );
  },
  Kn = e => {
    if (oe(e)) return C;
    let n = e.state;
    return ((n.wsize = 0), (n.whave = 0), (n.wnext = 0), Xn(e));
  },
  jn = (e, n) => {
    let t;
    if (oe(e)) return C;
    let i = e.state;
    return (
      n < 0 ? ((t = 0), (n = -n)) : ((t = (n >> 4) + 5), n < 48 && (n &= 15)),
      n && (n < 8 || n > 15)
        ? C
        : (i.window !== null && i.wbits !== n && (i.window = null),
          (i.wrap = t),
          (i.wbits = n),
          Kn(e))
    );
  },
  Gn = (e, n) => {
    if (!e) return C;
    let t = new ur();
    ((e.state = t), (t.strm = e), (t.window = null), (t.mode = je));
    let i = jn(e, n);
    return (i !== ae && (e.state = null), i);
  },
  _r = e => Gn(e, dr),
  _n = !0,
  rt,
  ot,
  br = e => {
    if (_n) {
      ((rt = new Int32Array(512)), (ot = new Int32Array(32)));
      let n = 0;
      for (; n < 144;) e.lens[n++] = 8;
      for (; n < 256;) e.lens[n++] = 9;
      for (; n < 280;) e.lens[n++] = 7;
      for (; n < 288;) e.lens[n++] = 8;
      for (ye(Fn, e.lens, 0, 288, rt, 0, e.work, { bits: 9 }), n = 0; n < 32;) e.lens[n++] = 5;
      (ye($n, e.lens, 0, 32, ot, 0, e.work, { bits: 5 }), (_n = !1));
    }
    ((e.lencode = rt), (e.lenbits = 9), (e.distcode = ot), (e.distbits = 5));
  },
  Wn = (e, n, t, i) => {
    let a,
      r = e.state;
    return (
      r.window === null &&
        ((r.wsize = 1 << r.wbits),
        (r.wnext = 0),
        (r.whave = 0),
        (r.window = new Uint8Array(r.wsize))),
      i >= r.wsize
        ? (r.window.set(n.subarray(t - r.wsize, t), 0), (r.wnext = 0), (r.whave = r.wsize))
        : ((a = r.wsize - r.wnext),
          a > i && (a = i),
          r.window.set(n.subarray(t - i, t - i + a), r.wnext),
          (i -= a),
          i
            ? (r.window.set(n.subarray(t - i, t), 0), (r.wnext = i), (r.whave = r.wsize))
            : ((r.wnext += a),
              r.wnext === r.wsize && (r.wnext = 0),
              r.whave < r.wsize && (r.whave += a))),
      0
    );
  },
  gr = (e, n) => {
    let t,
      i,
      a,
      r,
      s,
      l,
      d,
      o,
      f,
      x,
      h,
      c,
      m,
      b,
      _ = 0,
      g,
      k,
      p,
      u,
      y,
      S,
      w,
      I,
      A = new Uint8Array(4),
      v,
      E,
      q = new Uint8Array([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
    if (oe(e) || !e.output || (!e.input && e.avail_in !== 0)) return C;
    ((t = e.state),
      t.mode === B && (t.mode = nt),
      (s = e.next_out),
      (a = e.output),
      (d = e.avail_out),
      (r = e.next_in),
      (i = e.input),
      (l = e.avail_in),
      (o = t.hold),
      (f = t.bits),
      (x = l),
      (h = d),
      (I = ae));
    e: for (;;)
      switch (t.mode) {
        case je:
          if (t.wrap === 0) {
            t.mode = nt;
            break;
          }
          for (; f < 16;) {
            if (l === 0) break e;
            (l--, (o += i[r++] << f), (f += 8));
          }
          if (t.wrap & 2 && o === 35615) {
            (t.wbits === 0 && (t.wbits = 15),
              (t.check = 0),
              (A[0] = o & 255),
              (A[1] = (o >>> 8) & 255),
              (t.check = z(t.check, A, 2, 0)),
              (o = 0),
              (f = 0),
              (t.mode = Xt));
            break;
          }
          if ((t.head && (t.head.done = !1), !(t.wrap & 1) || (((o & 255) << 8) + (o >> 8)) % 31)) {
            ((e.msg = 'incorrect header check'), (t.mode = U));
            break;
          }
          if ((o & 15) !== Bt) {
            ((e.msg = 'unknown compression method'), (t.mode = U));
            break;
          }
          if (
            ((o >>>= 4),
            (f -= 4),
            (w = (o & 15) + 8),
            t.wbits === 0 && (t.wbits = w),
            w > 15 || w > t.wbits)
          ) {
            ((e.msg = 'invalid window size'), (t.mode = U));
            break;
          }
          ((t.dmax = 1 << t.wbits),
            (t.flags = 0),
            (e.adler = t.check = 1),
            (t.mode = o & 512 ? Qt : B),
            (o = 0),
            (f = 0));
          break;
        case Xt:
          for (; f < 16;) {
            if (l === 0) break e;
            (l--, (o += i[r++] << f), (f += 8));
          }
          if (((t.flags = o), (t.flags & 255) !== Bt)) {
            ((e.msg = 'unknown compression method'), (t.mode = U));
            break;
          }
          if (t.flags & 57344) {
            ((e.msg = 'unknown header flags set'), (t.mode = U));
            break;
          }
          (t.head && (t.head.text = (o >> 8) & 1),
            t.flags & 512 &&
              t.wrap & 4 &&
              ((A[0] = o & 255), (A[1] = (o >>> 8) & 255), (t.check = z(t.check, A, 2, 0))),
            (o = 0),
            (f = 0),
            (t.mode = Kt));
        case Kt:
          for (; f < 32;) {
            if (l === 0) break e;
            (l--, (o += i[r++] << f), (f += 8));
          }
          (t.head && (t.head.time = o),
            t.flags & 512 &&
              t.wrap & 4 &&
              ((A[0] = o & 255),
              (A[1] = (o >>> 8) & 255),
              (A[2] = (o >>> 16) & 255),
              (A[3] = (o >>> 24) & 255),
              (t.check = z(t.check, A, 4, 0))),
            (o = 0),
            (f = 0),
            (t.mode = jt));
        case jt:
          for (; f < 16;) {
            if (l === 0) break e;
            (l--, (o += i[r++] << f), (f += 8));
          }
          (t.head && ((t.head.xflags = o & 255), (t.head.os = o >> 8)),
            t.flags & 512 &&
              t.wrap & 4 &&
              ((A[0] = o & 255), (A[1] = (o >>> 8) & 255), (t.check = z(t.check, A, 2, 0))),
            (o = 0),
            (f = 0),
            (t.mode = Gt));
        case Gt:
          if (t.flags & 1024) {
            for (; f < 16;) {
              if (l === 0) break e;
              (l--, (o += i[r++] << f), (f += 8));
            }
            ((t.length = o),
              t.head && (t.head.extra_len = o),
              t.flags & 512 &&
                t.wrap & 4 &&
                ((A[0] = o & 255), (A[1] = (o >>> 8) & 255), (t.check = z(t.check, A, 2, 0))),
              (o = 0),
              (f = 0));
          } else t.head && (t.head.extra = null);
          t.mode = Wt;
        case Wt:
          if (
            t.flags & 1024 &&
            ((c = t.length),
            c > l && (c = l),
            c &&
              (t.head &&
                ((w = t.head.extra_len - t.length),
                t.head.extra || (t.head.extra = new Uint8Array(t.head.extra_len)),
                t.head.extra.set(i.subarray(r, r + c), w)),
              t.flags & 512 && t.wrap & 4 && (t.check = z(t.check, i, c, r)),
              (l -= c),
              (r += c),
              (t.length -= c)),
            t.length)
          )
            break e;
          ((t.length = 0), (t.mode = Vt));
        case Vt:
          if (t.flags & 2048) {
            if (l === 0) break e;
            c = 0;
            do
              ((w = i[r + c++]),
                t.head && w && t.length < 65536 && (t.head.name += String.fromCharCode(w)));
            while (w && c < l);
            if (
              (t.flags & 512 && t.wrap & 4 && (t.check = z(t.check, i, c, r)),
              (l -= c),
              (r += c),
              w)
            )
              break e;
          } else t.head && (t.head.name = null);
          ((t.length = 0), (t.mode = Jt));
        case Jt:
          if (t.flags & 4096) {
            if (l === 0) break e;
            c = 0;
            do
              ((w = i[r + c++]),
                t.head && w && t.length < 65536 && (t.head.comment += String.fromCharCode(w)));
            while (w && c < l);
            if (
              (t.flags & 512 && t.wrap & 4 && (t.check = z(t.check, i, c, r)),
              (l -= c),
              (r += c),
              w)
            )
              break e;
          } else t.head && (t.head.comment = null);
          t.mode = qt;
        case qt:
          if (t.flags & 512) {
            for (; f < 16;) {
              if (l === 0) break e;
              (l--, (o += i[r++] << f), (f += 8));
            }
            if (t.wrap & 4 && o !== (t.check & 65535)) {
              ((e.msg = 'header crc mismatch'), (t.mode = U));
              break;
            }
            ((o = 0), (f = 0));
          }
          (t.head && ((t.head.hcrc = (t.flags >> 9) & 1), (t.head.done = !0)),
            (e.adler = t.check = 0),
            (t.mode = B));
          break;
        case Qt:
          for (; f < 32;) {
            if (l === 0) break e;
            (l--, (o += i[r++] << f), (f += 8));
          }
          ((e.adler = t.check = un(o)), (o = 0), (f = 0), (t.mode = Be));
        case Be:
          if (t.havedict === 0)
            return (
              (e.next_out = s),
              (e.avail_out = d),
              (e.next_in = r),
              (e.avail_in = l),
              (t.hold = o),
              (t.bits = f),
              lr
            );
          ((e.adler = t.check = 1), (t.mode = B));
        case B:
          if (n === rr || n === Ce) break e;
        case nt:
          if (t.last) {
            ((o >>>= f & 7), (f -= f & 7), (t.mode = at));
            break;
          }
          for (; f < 3;) {
            if (l === 0) break e;
            (l--, (o += i[r++] << f), (f += 8));
          }
          switch (((t.last = o & 1), (o >>>= 1), (f -= 1), o & 3)) {
            case 0:
              t.mode = en;
              break;
            case 1:
              if ((br(t), (t.mode = Fe), n === Ce)) {
                ((o >>>= 2), (f -= 2));
                break e;
              }
              break;
            case 2:
              t.mode = nn;
              break;
            case 3:
              ((e.msg = 'invalid block type'), (t.mode = U));
          }
          ((o >>>= 2), (f -= 2));
          break;
        case en:
          for (o >>>= f & 7, f -= f & 7; f < 32;) {
            if (l === 0) break e;
            (l--, (o += i[r++] << f), (f += 8));
          }
          if ((o & 65535) !== ((o >>> 16) ^ 65535)) {
            ((e.msg = 'invalid stored block lengths'), (t.mode = U));
            break;
          }
          if (((t.length = o & 65535), (o = 0), (f = 0), (t.mode = it), n === Ce)) break e;
        case it:
          t.mode = tn;
        case tn:
          if (((c = t.length), c)) {
            if ((c > l && (c = l), c > d && (c = d), c === 0)) break e;
            (a.set(i.subarray(r, r + c), s),
              (l -= c),
              (r += c),
              (d -= c),
              (s += c),
              (t.length -= c));
            break;
          }
          t.mode = B;
          break;
        case nn:
          for (; f < 14;) {
            if (l === 0) break e;
            (l--, (o += i[r++] << f), (f += 8));
          }
          if (
            ((t.nlen = (o & 31) + 257),
            (o >>>= 5),
            (f -= 5),
            (t.ndist = (o & 31) + 1),
            (o >>>= 5),
            (f -= 5),
            (t.ncode = (o & 15) + 4),
            (o >>>= 4),
            (f -= 4),
            t.nlen > 286 || t.ndist > 30)
          ) {
            ((e.msg = 'too many length or distance symbols'), (t.mode = U));
            break;
          }
          ((t.have = 0), (t.mode = an));
        case an:
          for (; t.have < t.ncode;) {
            for (; f < 3;) {
              if (l === 0) break e;
              (l--, (o += i[r++] << f), (f += 8));
            }
            ((t.lens[q[t.have++]] = o & 7), (o >>>= 3), (f -= 3));
          }
          for (; t.have < 19;) t.lens[q[t.have++]] = 0;
          if (
            ((t.lencode = t.lendyn),
            (t.lenbits = 7),
            (v = { bits: t.lenbits }),
            (I = ye(ar, t.lens, 0, 19, t.lencode, 0, t.work, v)),
            (t.lenbits = v.bits),
            I)
          ) {
            ((e.msg = 'invalid code lengths set'), (t.mode = U));
            break;
          }
          ((t.have = 0), (t.mode = rn));
        case rn:
          for (; t.have < t.nlen + t.ndist;) {
            for (
              ;
              (_ = t.lencode[o & ((1 << t.lenbits) - 1)]),
                (g = _ >>> 24),
                (k = (_ >>> 16) & 255),
                (p = _ & 65535),
                !(g <= f);
            ) {
              if (l === 0) break e;
              (l--, (o += i[r++] << f), (f += 8));
            }
            if (p < 16) ((o >>>= g), (f -= g), (t.lens[t.have++] = p));
            else {
              if (p === 16) {
                for (E = g + 2; f < E;) {
                  if (l === 0) break e;
                  (l--, (o += i[r++] << f), (f += 8));
                }
                if (((o >>>= g), (f -= g), t.have === 0)) {
                  ((e.msg = 'invalid bit length repeat'), (t.mode = U));
                  break;
                }
                ((w = t.lens[t.have - 1]), (c = 3 + (o & 3)), (o >>>= 2), (f -= 2));
              } else if (p === 17) {
                for (E = g + 3; f < E;) {
                  if (l === 0) break e;
                  (l--, (o += i[r++] << f), (f += 8));
                }
                ((o >>>= g), (f -= g), (w = 0), (c = 3 + (o & 7)), (o >>>= 3), (f -= 3));
              } else {
                for (E = g + 7; f < E;) {
                  if (l === 0) break e;
                  (l--, (o += i[r++] << f), (f += 8));
                }
                ((o >>>= g), (f -= g), (w = 0), (c = 11 + (o & 127)), (o >>>= 7), (f -= 7));
              }
              if (t.have + c > t.nlen + t.ndist) {
                ((e.msg = 'invalid bit length repeat'), (t.mode = U));
                break;
              }
              for (; c--;) t.lens[t.have++] = w;
            }
          }
          if (t.mode === U) break;
          if (t.lens[256] === 0) {
            ((e.msg = 'invalid code -- missing end-of-block'), (t.mode = U));
            break;
          }
          if (
            ((t.lenbits = 9),
            (v = { bits: t.lenbits }),
            (I = ye(Fn, t.lens, 0, t.nlen, t.lencode, 0, t.work, v)),
            (t.lenbits = v.bits),
            I)
          ) {
            ((e.msg = 'invalid literal/lengths set'), (t.mode = U));
            break;
          }
          if (
            ((t.distbits = 6),
            (t.distcode = t.distdyn),
            (v = { bits: t.distbits }),
            (I = ye($n, t.lens, t.nlen, t.ndist, t.distcode, 0, t.work, v)),
            (t.distbits = v.bits),
            I)
          ) {
            ((e.msg = 'invalid distances set'), (t.mode = U));
            break;
          }
          if (((t.mode = Fe), n === Ce)) break e;
        case Fe:
          t.mode = $e;
        case $e:
          if (l >= 6 && d >= 258) {
            ((e.next_out = s),
              (e.avail_out = d),
              (e.next_in = r),
              (e.avail_in = l),
              (t.hold = o),
              (t.bits = f),
              qa(e, h),
              (s = e.next_out),
              (a = e.output),
              (d = e.avail_out),
              (r = e.next_in),
              (i = e.input),
              (l = e.avail_in),
              (o = t.hold),
              (f = t.bits),
              t.mode === B && (t.back = -1));
            break;
          }
          for (
            t.back = 0;
            (_ = t.lencode[o & ((1 << t.lenbits) - 1)]),
              (g = _ >>> 24),
              (k = (_ >>> 16) & 255),
              (p = _ & 65535),
              !(g <= f);
          ) {
            if (l === 0) break e;
            (l--, (o += i[r++] << f), (f += 8));
          }
          if (k && (k & 240) === 0) {
            for (
              u = g, y = k, S = p;
              (_ = t.lencode[S + ((o & ((1 << (u + y)) - 1)) >> u)]),
                (g = _ >>> 24),
                (k = (_ >>> 16) & 255),
                (p = _ & 65535),
                !(u + g <= f);
            ) {
              if (l === 0) break e;
              (l--, (o += i[r++] << f), (f += 8));
            }
            ((o >>>= u), (f -= u), (t.back += u));
          }
          if (((o >>>= g), (f -= g), (t.back += g), (t.length = p), k === 0)) {
            t.mode = cn;
            break;
          }
          if (k & 32) {
            ((t.back = -1), (t.mode = B));
            break;
          }
          if (k & 64) {
            ((e.msg = 'invalid literal/length code'), (t.mode = U));
            break;
          }
          ((t.extra = k & 15), (t.mode = on));
        case on:
          if (t.extra) {
            for (E = t.extra; f < E;) {
              if (l === 0) break e;
              (l--, (o += i[r++] << f), (f += 8));
            }
            ((t.length += o & ((1 << t.extra) - 1)),
              (o >>>= t.extra),
              (f -= t.extra),
              (t.back += t.extra));
          }
          ((t.was = t.length), (t.mode = ln));
        case ln:
          for (
            ;
            (_ = t.distcode[o & ((1 << t.distbits) - 1)]),
              (g = _ >>> 24),
              (k = (_ >>> 16) & 255),
              (p = _ & 65535),
              !(g <= f);
          ) {
            if (l === 0) break e;
            (l--, (o += i[r++] << f), (f += 8));
          }
          if ((k & 240) === 0) {
            for (
              u = g, y = k, S = p;
              (_ = t.distcode[S + ((o & ((1 << (u + y)) - 1)) >> u)]),
                (g = _ >>> 24),
                (k = (_ >>> 16) & 255),
                (p = _ & 65535),
                !(u + g <= f);
            ) {
              if (l === 0) break e;
              (l--, (o += i[r++] << f), (f += 8));
            }
            ((o >>>= u), (f -= u), (t.back += u));
          }
          if (((o >>>= g), (f -= g), (t.back += g), k & 64)) {
            ((e.msg = 'invalid distance code'), (t.mode = U));
            break;
          }
          ((t.offset = p), (t.extra = k & 15), (t.mode = sn));
        case sn:
          if (t.extra) {
            for (E = t.extra; f < E;) {
              if (l === 0) break e;
              (l--, (o += i[r++] << f), (f += 8));
            }
            ((t.offset += o & ((1 << t.extra) - 1)),
              (o >>>= t.extra),
              (f -= t.extra),
              (t.back += t.extra));
          }
          if (t.offset > t.dmax) {
            ((e.msg = 'invalid distance too far back'), (t.mode = U));
            break;
          }
          t.mode = fn;
        case fn:
          if (d === 0) break e;
          if (((c = h - d), t.offset > c)) {
            if (((c = t.offset - c), c > t.whave && t.sane)) {
              ((e.msg = 'invalid distance too far back'), (t.mode = U));
              break;
            }
            (c > t.wnext ? ((c -= t.wnext), (m = t.wsize - c)) : (m = t.wnext - c),
              c > t.length && (c = t.length),
              (b = t.window));
          } else ((b = a), (m = s - t.offset), (c = t.length));
          (c > d && (c = d), (d -= c), (t.length -= c));
          do a[s++] = b[m++];
          while (--c);
          t.length === 0 && (t.mode = $e);
          break;
        case cn:
          if (d === 0) break e;
          ((a[s++] = t.length), d--, (t.mode = $e));
          break;
        case at:
          if (t.wrap) {
            for (; f < 32;) {
              if (l === 0) break e;
              (l--, (o |= i[r++] << f), (f += 8));
            }
            if (
              ((h -= d),
              (e.total_out += h),
              (t.total += h),
              t.wrap & 4 &&
                h &&
                (e.adler = t.check = t.flags ? z(t.check, a, h, s - h) : Ae(t.check, a, h, s - h)),
              (h = d),
              t.wrap & 4 && (t.flags ? o : un(o)) !== t.check)
            ) {
              ((e.msg = 'incorrect data check'), (t.mode = U));
              break;
            }
            ((o = 0), (f = 0));
          }
          t.mode = hn;
        case hn:
          if (t.wrap && t.flags) {
            for (; f < 32;) {
              if (l === 0) break e;
              (l--, (o += i[r++] << f), (f += 8));
            }
            if (t.wrap & 4 && o !== (t.total & 4294967295)) {
              ((e.msg = 'incorrect length check'), (t.mode = U));
              break;
            }
            ((o = 0), (f = 0));
          }
          t.mode = dn;
        case dn:
          I = or;
          break e;
        case U:
          I = Pn;
          break e;
        case Yn:
          return Hn;
        case Bn:
        default:
          return C;
      }
    return (
      (e.next_out = s),
      (e.avail_out = d),
      (e.next_in = r),
      (e.avail_in = l),
      (t.hold = o),
      (t.bits = f),
      (t.wsize || (h !== e.avail_out && t.mode < U && (t.mode < at || n !== Yt))) &&
        Wn(e, e.output, e.next_out, h - e.avail_out),
      (x -= e.avail_in),
      (h -= e.avail_out),
      (e.total_in += x),
      (e.total_out += h),
      (t.total += h),
      t.wrap & 4 &&
        h &&
        (e.adler = t.check =
          t.flags ? z(t.check, a, h, e.next_out - h) : Ae(t.check, a, h, e.next_out - h)),
      (e.data_type =
        t.bits +
        (t.last ? 64 : 0) +
        (t.mode === B ? 128 : 0) +
        (t.mode === Fe || t.mode === it ? 256 : 0)),
      ((x === 0 && h === 0) || n === Yt) && I === ae && (I = sr),
      I
    );
  },
  mr = e => {
    if (oe(e)) return C;
    let n = e.state;
    return (n.window && (n.window = null), (e.state = null), ae);
  },
  pr = (e, n) => {
    if (oe(e)) return C;
    let t = e.state;
    return (t.wrap & 2) === 0 ? C : ((t.head = n), (n.done = !1), ae);
  },
  wr = (e, n) => {
    let t = n.length,
      i,
      a,
      r;
    return oe(e) || ((i = e.state), i.wrap !== 0 && i.mode !== Be)
      ? C
      : i.mode === Be && ((a = 1), (a = Ae(a, n, t, 0)), a !== i.check)
        ? Pn
        : ((r = Wn(e, n, t, t)), r ? ((i.mode = Yn), Hn) : ((i.havedict = 1), ae));
  },
  xr = Kn,
  yr = jn,
  kr = Xn,
  vr = _r,
  Er = Gn,
  Rr = gr,
  Ar = mr,
  Mr = pr,
  Sr = wr,
  Ir = 'pako inflate (from Nodeca project)',
  K = {
    inflateReset: xr,
    inflateReset2: yr,
    inflateResetKeep: kr,
    inflateInit: vr,
    inflateInit2: Er,
    inflate: Rr,
    inflateEnd: Ar,
    inflateGetHeader: Mr,
    inflateSetDictionary: Sr,
    inflateInfo: Ir,
  };
function Ur() {
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
var zr = Ur,
  Vn = Object.prototype.toString,
  {
    Z_NO_FLUSH: Tr,
    Z_FINISH: Dr,
    Z_OK: Ie,
    Z_STREAM_END: lt,
    Z_NEED_DICT: st,
    Z_STREAM_ERROR: Or,
    Z_DATA_ERROR: bn,
    Z_MEM_ERROR: Nr,
  } = re;
function De(e) {
  this.options = Ke.assign({ chunkSize: 1024 * 64, windowBits: 15, to: '' }, e || {});
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
    (this.strm = new Ln()),
    (this.strm.avail_out = 0));
  let t = K.inflateInit2(this.strm, n.windowBits);
  if (t !== Ie) throw new Error(ne[t]);
  if (
    ((this.header = new zr()),
    K.inflateGetHeader(this.strm, this.header),
    n.dictionary &&
      (typeof n.dictionary == 'string'
        ? (n.dictionary = Se.string2buf(n.dictionary))
        : Vn.call(n.dictionary) === '[object ArrayBuffer]' &&
          (n.dictionary = new Uint8Array(n.dictionary)),
      n.raw && ((t = K.inflateSetDictionary(this.strm, n.dictionary)), t !== Ie)))
  )
    throw new Error(ne[t]);
}
De.prototype.push = function (e, n) {
  let t = this.strm,
    i = this.options.chunkSize,
    a = this.options.dictionary,
    r,
    s,
    l;
  if (this.ended) return !1;
  for (
    n === ~~n ? (s = n) : (s = n === !0 ? Dr : Tr),
      Vn.call(e) === '[object ArrayBuffer]' ? (t.input = new Uint8Array(e)) : (t.input = e),
      t.next_in = 0,
      t.avail_in = t.input.length;
    ;
  ) {
    for (
      t.avail_out === 0 && ((t.output = new Uint8Array(i)), (t.next_out = 0), (t.avail_out = i)),
        r = K.inflate(t, s),
        r === st &&
          a &&
          ((r = K.inflateSetDictionary(t, a)),
          r === Ie ? (r = K.inflate(t, s)) : r === bn && (r = st));
      t.avail_in > 0 && r === lt && t.state.wrap > 0 && e[t.next_in] !== 0;
    )
      (K.inflateReset(t), (r = K.inflate(t, s)));
    switch (r) {
      case Or:
      case bn:
      case st:
      case Nr:
        return (this.onEnd(r), (this.ended = !0), !1);
    }
    if (((l = t.avail_out), t.next_out && (t.avail_out === 0 || r === lt)))
      if (this.options.to === 'string') {
        let d = Se.utf8border(t.output, t.next_out),
          o = t.next_out - d,
          f = Se.buf2string(t.output, d);
        ((t.next_out = o),
          (t.avail_out = i - o),
          o && t.output.set(t.output.subarray(d, d + o), 0),
          this.onData(f));
      } else
        this.onData(t.output.length === t.next_out ? t.output : t.output.subarray(0, t.next_out));
    if (!(r === Ie && l === 0)) {
      if (r === lt) return ((r = K.inflateEnd(this.strm)), this.onEnd(r), (this.ended = !0), !0);
      if (t.avail_in === 0) break;
    }
  }
  return !0;
};
De.prototype.onData = function (e) {
  this.chunks.push(e);
};
De.prototype.onEnd = function (e) {
  (e === Ie &&
    (this.options.to === 'string'
      ? (this.result = this.chunks.join(''))
      : (this.result = Ke.flattenChunks(this.chunks))),
    (this.chunks = []),
    (this.err = e),
    (this.msg = this.strm.msg));
};
function Et(e, n) {
  let t = new De(n);
  if ((t.push(e), t.err)) throw t.msg || ne[t.err];
  return t.result;
}
function Zr(e, n) {
  return ((n = n || {}), (n.raw = !0), Et(e, n));
}
var Lr = De,
  Cr = Et,
  Fr = Zr,
  $r = Et,
  Pr = re,
  Hr = { Inflate: Lr, inflate: Cr, inflateRaw: Fr, ungzip: $r, constants: Pr },
  { Deflate: Yr, deflate: Br, deflateRaw: Xr, gzip: Kr } = Va,
  { Inflate: jr, inflate: Gr, inflateRaw: Wr, ungzip: Vr } = Hr,
  Jr = Yr,
  qr = Br,
  Qr = Xr,
  eo = Kr,
  to = jr,
  no = Gr,
  io = Wr,
  ao = Vr,
  ro = re,
  Rt = {
    Deflate: Jr,
    deflate: qr,
    deflateRaw: Qr,
    gzip: eo,
    Inflate: to,
    inflate: no,
    inflateRaw: io,
    ungzip: ao,
    constants: ro,
  };
var oo = ['rect', 'ellipse', 'polygon', 'freehand', 'mask'];
function At(e) {
  return oo.indexOf(e) >= 0;
}
var po = { x: 0, y: 0, width: 0, height: 0, mask: new Uint8Array(0), count: 0 };
function Jn(e, n = 0.75) {
  let t = Math.floor(e.length / 2);
  if (t < 3) return e.slice();
  let i = new Uint8Array(t);
  ((i[0] = 1), (i[t - 1] = 1));
  let a = [[0, t - 1]];
  for (; a.length;) {
    let [s, l] = a.pop();
    if (l <= s + 1) continue;
    let d = e[s * 2],
      o = e[s * 2 + 1],
      f = e[l * 2],
      x = e[l * 2 + 1],
      h = f - d,
      c = x - o,
      m = h * h + c * c,
      b = -1,
      _ = -1;
    for (let g = s + 1; g < l; g++) {
      let k = e[g * 2],
        p = e[g * 2 + 1],
        u;
      if (m === 0) u = Math.hypot(k - d, p - o);
      else {
        let y = ((k - d) * h + (p - o) * c) / m;
        ((y = Math.max(0, Math.min(1, y))), (u = Math.hypot(d + y * h - k, o + y * c - p)));
      }
      u > b && ((b = u), (_ = g));
    }
    b > n && _ > 0 && ((i[_] = 1), a.push([s, _], [_, l]));
  }
  let r = [];
  for (let s = 0; s < t; s++) i[s] && r.push(e[s * 2], e[s * 2 + 1]);
  return r;
}
var F = 64,
  ii = 64,
  ai = 1232041332,
  Mt = 0,
  ri = 1,
  oi = 2,
  li = 3,
  qn = 4,
  St = 5,
  lo = 6,
  si = 7,
  fi = 8,
  so = 9,
  It = 10,
  ci = 128;
function Qn(e, n = 'ROI') {
  if (e.length < F) return null;
  let t = new DataView(e.buffer, e.byteOffset, e.byteLength);
  if (t.getUint32(0, !1) !== ai) return null;
  let i = [],
    a = t.getUint16(4, !1),
    r = t.getUint8(6),
    s = t.getInt16(8, !1),
    l = t.getInt16(10, !1),
    d = t.getInt16(12, !1),
    o = t.getInt16(14, !1),
    f = t.getUint16(16, !1),
    x = t.getUint16(50, !1),
    h = t.getInt32(56, !1),
    c = t.getInt32(60, !1),
    m = (x & ci) !== 0,
    b = n;
  if (c > 0 && c + ii <= e.length) {
    let p = t.getInt32(c + 16, !1),
      u = t.getInt32(c + 20, !1);
    if (p > 0 && u > 0 && p + u * 2 <= e.length) {
      let y = '';
      for (let S = 0; S < u; S++) y += String.fromCharCode(t.getUint16(p + S * 2, !1));
      y && (b = y);
    }
  }
  let _ = { id: _o(), name: b, source: 'imagej', page: h > 0 ? h - 1 : void 0 },
    g = o - l,
    k = d - s;
  switch (r) {
    case ri:
      return { roi: { ..._, kind: 'rect', x: l, y: s, width: g, height: k }, notes: i };
    case oi:
      return { roi: { ..._, kind: 'ellipse', x: l, y: s, width: g, height: k }, notes: i };
    case li: {
      let p = t.getFloat32(18, !1),
        u = t.getFloat32(22, !1),
        y = t.getFloat32(26, !1),
        S = t.getFloat32(30, !1),
        w = t.getUint16(34, !1);
      return { roi: { ..._, kind: 'line', points: [p, u, y, S], lineWidth: w || 1 }, notes: i };
    }
    case Mt:
    case si:
    case fi:
    case St:
    case qn:
    case It: {
      if (
        f <= 0 ||
        (F + f * 4 > e.length &&
          ((f = Math.floor((e.length - F) / 4)),
          i.push('Coordinate list was truncated; imported the readable part.'),
          f < 2))
      )
        return null;
      let u = [];
      if (m && F + f * 4 + f * 8 <= e.length) {
        let y = F + f * 4;
        for (let S = 0; S < f; S++)
          u.push(t.getFloat32(y + S * 4, !1), t.getFloat32(y + f * 4 + S * 4, !1));
      } else
        for (let y = 0; y < f; y++)
          u.push(l + t.getInt16(F + y * 2, !1), s + t.getInt16(F + f * 2 + y * 2, !1));
      return r === It
        ? { roi: { ..._, kind: 'point', points: u }, notes: i }
        : r === St || r === qn
          ? {
              roi: { ..._, kind: 'polyline', points: u, lineWidth: t.getUint16(34, !1) || 1 },
              notes: i,
            }
          : { roi: { ..._, kind: r === Mt ? 'polygon' : 'freehand', points: u }, notes: i };
    }
    case so:
      return null;
    case lo:
    default:
      return (a > 300 && i.push(`Unsupported ImageJ ROI type ${r}.`), null);
  }
}
function fo(e, n) {
  let t,
    i = null,
    a = { left: 0, top: 0, right: 0, bottom: 0 },
    r = null;
  switch (e.kind) {
    case 'rect':
      ((t = ri),
        (a = {
          left: Math.round(e.x),
          top: Math.round(e.y),
          right: Math.round(e.x + e.width),
          bottom: Math.round(e.y + e.height),
        }));
      break;
    case 'ellipse':
      ((t = oi),
        (a = {
          left: Math.round(e.x),
          top: Math.round(e.y),
          right: Math.round(e.x + e.width),
          bottom: Math.round(e.y + e.height),
        }));
      break;
    case 'line': {
      t = li;
      let b = e.points;
      if (!b || b.length < 4) return null;
      ((r = [b[0], b[1], b[2], b[3]]),
        (a = {
          left: Math.floor(Math.min(b[0], b[2])),
          top: Math.floor(Math.min(b[1], b[3])),
          right: Math.ceil(Math.max(b[0], b[2])),
          bottom: Math.ceil(Math.max(b[1], b[3])),
        }));
      break;
    }
    case 'polygon':
      ((t = Mt), (i = e.points));
      break;
    case 'freehand':
      ((t = si), (i = e.points));
      break;
    case 'polyline':
      ((t = St), (i = e.points));
      break;
    case 'point':
      ((t = It), (i = e.points));
      break;
    case 'mask':
      if (((t = fi), (i = n || null), !i || i.length < 6)) return null;
      break;
    default:
      return null;
  }
  if (i) {
    if (i.length < 4) return null;
    let b = 1 / 0,
      _ = 1 / 0,
      g = -1 / 0,
      k = -1 / 0;
    for (let p = 0; p + 1 < i.length; p += 2)
      ((b = Math.min(b, i[p])),
        (g = Math.max(g, i[p])),
        (_ = Math.min(_, i[p + 1])),
        (k = Math.max(k, i[p + 1])));
    a = { left: Math.floor(b), top: Math.floor(_), right: Math.ceil(g), bottom: Math.ceil(k) };
  }
  let s = i ? Math.floor(i.length / 2) : 0,
    l = i ? s * 4 + s * 8 : 0,
    d = e.name ? Array.from(e.name).slice(0, 512) : [],
    o = F + l,
    f = o + ii,
    x = f + d.length * 2,
    h = new Uint8Array(x),
    c = new DataView(h.buffer);
  (c.setUint32(0, ai, !1),
    c.setUint16(4, 228, !1),
    c.setUint8(6, t),
    c.setInt16(8, be(a.top), !1),
    c.setInt16(10, be(a.left), !1),
    c.setInt16(12, be(a.bottom), !1),
    c.setInt16(14, be(a.right), !1),
    c.setUint16(16, s, !1),
    r &&
      (c.setFloat32(18, r[0], !1),
      c.setFloat32(22, r[1], !1),
      c.setFloat32(26, r[2], !1),
      c.setFloat32(30, r[3], !1)));
  let m = e.lineWidth || 0;
  if (
    (c.setUint16(34, Math.min(255, Math.max(0, Math.round(m))), !1),
    c.setUint16(50, i ? ci : 0, !1),
    c.setInt32(56, e.page !== void 0 ? e.page + 1 : 0, !1),
    c.setInt32(60, o, !1),
    i)
  ) {
    for (let _ = 0; _ < s; _++)
      (c.setInt16(F + _ * 2, be(Math.round(i[_ * 2] - a.left)), !1),
        c.setInt16(F + s * 2 + _ * 2, be(Math.round(i[_ * 2 + 1] - a.top)), !1));
    let b = F + s * 4;
    for (let _ = 0; _ < s; _++)
      (c.setFloat32(b + _ * 4, i[_ * 2], !1), c.setFloat32(b + s * 4 + _ * 4, i[_ * 2 + 1], !1));
  }
  if (d.length > 0) {
    (c.setInt32(o + 16, f, !1), c.setInt32(o + 20, d.length, !1));
    for (let b = 0; b < d.length; b++) c.setUint16(f + b * 2, d[b].charCodeAt(0), !1);
  }
  return h;
}
function co(e) {
  let n = new DataView(e.buffer, e.byteOffset, e.byteLength),
    t = -1;
  for (let s = e.length - 22; s >= 0 && s > e.length - 22 - 65536; s--)
    if (n.getUint32(s, !0) === 101010256) {
      t = s;
      break;
    }
  if (t < 0) return [];
  let i = n.getUint16(t + 10, !0),
    a = n.getUint32(t + 16, !0),
    r = [];
  for (let s = 0; s < i && !(a + 46 > e.length || n.getUint32(a, !0) !== 33639248); s++) {
    let l = n.getUint16(a + 10, !0),
      d = n.getUint32(a + 20, !0),
      o = n.getUint16(a + 28, !0),
      f = n.getUint16(a + 30, !0),
      x = n.getUint16(a + 32, !0),
      h = n.getUint32(a + 42, !0),
      c = new TextDecoder().decode(e.subarray(a + 46, a + 46 + o));
    if (h + 30 <= e.length && n.getUint32(h, !0) === 67324752) {
      let m = n.getUint16(h + 26, !0),
        b = n.getUint16(h + 28, !0),
        _ = h + 30 + m + b,
        g = e.subarray(_, _ + d);
      try {
        let k = l === 0 ? g.slice() : Rt.inflateRaw(g);
        r.push({ name: c, bytes: k });
      } catch {}
    }
    a += 46 + o + f + x;
  }
  return r;
}
function ho(e) {
  let n = [],
    t = [],
    i = 0;
  for (let f of e) {
    let x = new TextEncoder().encode(f.name),
      h = Rt.deflateRaw(f.bytes),
      c = uo(f.bytes),
      m = new Uint8Array(30 + x.length + h.length),
      b = new DataView(m.buffer);
    (b.setUint32(0, 67324752, !0),
      b.setUint16(4, 20, !0),
      b.setUint16(6, 0, !0),
      b.setUint16(8, 8, !0),
      b.setUint16(10, 0, !0),
      b.setUint16(12, 0, !0),
      b.setUint32(14, c, !0),
      b.setUint32(18, h.length, !0),
      b.setUint32(22, f.bytes.length, !0),
      b.setUint16(26, x.length, !0),
      b.setUint16(28, 0, !0),
      m.set(x, 30),
      m.set(h, 30 + x.length),
      n.push(m));
    let _ = new Uint8Array(46 + x.length),
      g = new DataView(_.buffer);
    (g.setUint32(0, 33639248, !0),
      g.setUint16(4, 20, !0),
      g.setUint16(6, 20, !0),
      g.setUint16(8, 0, !0),
      g.setUint16(10, 8, !0),
      g.setUint32(16, c, !0),
      g.setUint32(20, h.length, !0),
      g.setUint32(24, f.bytes.length, !0),
      g.setUint16(28, x.length, !0),
      g.setUint32(42, i, !0),
      _.set(x, 46),
      t.push(_),
      (i += m.length));
  }
  let a = t.reduce((f, x) => f + x.length, 0),
    r = new Uint8Array(22),
    s = new DataView(r.buffer);
  (s.setUint32(0, 101010256, !0),
    s.setUint16(8, e.length, !0),
    s.setUint16(10, e.length, !0),
    s.setUint32(12, a, !0),
    s.setUint32(16, i, !0));
  let l = i + a + r.length,
    d = new Uint8Array(l),
    o = 0;
  for (let f of n) (d.set(f, o), (o += f.length));
  for (let f of t) (d.set(f, o), (o += f.length));
  return (d.set(r, o), d);
}
var Ge = null;
function uo(e) {
  if (!Ge) {
    Ge = new Uint32Array(256);
    for (let t = 0; t < 256; t++) {
      let i = t;
      for (let a = 0; a < 8; a++) i = i & 1 ? 3988292384 ^ (i >>> 1) : i >>> 1;
      Ge[t] = i >>> 0;
    }
  }
  let n = 4294967295;
  for (let t = 0; t < e.length; t++) n = Ge[(n ^ e[t]) & 255] ^ (n >>> 8);
  return (n ^ 4294967295) >>> 0;
}
function vo(e, n) {
  if (!(e.length >= 4 && e[0] === 80 && e[1] === 75)) {
    let a = Qn(e, ti(n));
    return a ? [a] : [];
  }
  let i = [];
  for (let a of co(e)) {
    let r = Qn(a.bytes, ti(a.name));
    r && i.push(r);
  }
  return i;
}
function Eo(e, n) {
  let t = [],
    i = [],
    a = new Set();
  for (let r of e) {
    let s = r.kind === 'mask' ? Jn(n(r), 0.5) : void 0,
      l = fo(r, s);
    if (!l) {
      i.push(r.name);
      continue;
    }
    let d = `${ei(r.name)}.roi`,
      o = 2;
    for (; a.has(d);) d = `${ei(r.name)}-${o++}.roi`;
    (a.add(d), t.push({ name: d, bytes: l }));
  }
  return { bytes: ho(t), exported: t.length, skipped: i };
}
function ei(e) {
  return (e || 'roi').replace(/[^\w.\- ]+/g, '_').slice(0, 100) || 'roi';
}
function ti(e) {
  return (e.split('/').pop() || e).replace(/\.roi$/i, '');
}
function be(e) {
  return Math.max(-32768, Math.min(32767, Math.round(e)));
}
var ni = 0;
function _o() {
  return (ni++, `roi-${Date.now().toString(36)}-${ni.toString(36)}`);
}
function Ro(e) {
  return !(e.kind === 'mask' || (At(e.kind) && e.angle));
}
export {
  Qn as decodeImageJRoi,
  fo as encodeImageJRoi,
  Eo as exportImageJRois,
  vo as importImageJRois,
  Ro as isLosslessForImageJ,
  co as readRoiZip,
  ho as writeRoiZip,
};
/*! Bundled license information:

pako/dist/pako.esm.mjs:
  (*! pako 2.1.0 https://github.com/nodeca/pako @license (MIT AND Zlib) *)
*/
