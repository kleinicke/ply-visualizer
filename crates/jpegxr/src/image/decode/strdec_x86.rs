// Auto-generated scaffold for a faithful JXRLib translation restart.
// Keep one Rust item per original C item; replace stubs bottom-up.

use crate::image::sys::strcodec::CWMImageStrCodec;

/// Original function: `strDCT2x2up_OPT` at `original/jxrlib/image/decode/strdec_x86.c:1103`.
pub unsafe fn str_dct2x2up_opt(pa: *mut i32, pb: *mut i32, pc: *mut i32, pd: *mut i32) {
    let mut a = *pa;
    let mut b = *pb;
    let c_in = *pc;
    let mut d = *pd;

    a += d;
    b -= c_in;
    let t = (a - b + 1) >> 1;
    let c = t - d;
    d = t - c_in;
    a -= d;
    b += c;

    *pa = a;
    *pb = b;
    *pc = c;
    *pd = d;
}

/// Original function: `invOdd_OPT` at `original/jxrlib/image/decode/strdec_x86.c:1125`.
pub unsafe fn inv_odd_opt(pa: *mut i32, pb: *mut i32, pc: *mut i32, pd: *mut i32) {
    let mut a = *pa;
    let mut b = *pb;
    let mut c = *pc;
    let mut d = *pd;

    b += d;
    a -= c;
    d -= b >> 1;
    c += (a + 1) >> 1;

    a -= (b * 3 + 4) >> 3;
    b += (a * 3 + 4) >> 3;
    c -= (d * 3 + 4) >> 3;
    d += (c * 3 + 4) >> 3;

    c -= (b + 1) >> 1;
    d = ((a + 1) >> 1) - d;
    b += c;
    a -= d;

    *pa = a;
    *pb = b;
    *pc = c;
    *pd = d;
}

/// Original function: `invOddOdd_OPT` at `original/jxrlib/image/decode/strdec_x86.c:1156`.
pub unsafe fn inv_odd_odd_opt(pa: *mut i32, pb: *mut i32, pc: *mut i32, pd: *mut i32) {
    let mut a = *pa;
    let mut b = *pb;
    let mut c = *pc;
    let mut d = *pd;

    d += a;
    c -= b;
    let t1 = d >> 1;
    a -= t1;
    let t2 = c >> 1;
    b += t2;

    a -= (b * 3 + 3) >> 3;
    b += (a * 3 + 3) >> 2;
    a -= (b * 3 + 4) >> 3;

    b -= t2;
    a += t1;
    c += b;
    d -= a;

    *pa = a;
    *pb = -b;
    *pc = -c;
    *pd = d;
}

/// Original function: `strDCT2x2dn_SSE2_1` at `original/jxrlib/image/decode/strdec_x86.c:1188`.
pub unsafe fn str_dct2x2dn_sse2_1(p: *mut i32) {
    let mut i = 0;
    while i < 4 {
        let mut a = *p.add(i);
        let mut b = *p.add(4 + i);
        let c_in = *p.add(8 + i);
        let mut d = *p.add(12 + i);

        a += d;
        b -= c_in;
        let t = (a - b) >> 1;
        let c = t - d;
        d = t - c_in;
        a -= d;
        b += c;

        *p.add(i) = a;
        *p.add(4 + i) = b;
        *p.add(8 + i) = c;
        *p.add(12 + i) = d;
        i += 1;
    }
}

/// Original function: `strIDCT4x4Stage1_OPT_H1` at `original/jxrlib/image/decode/strdec_x86.c:1213`.
pub unsafe fn str_idct4x4_stage1_opt_h1(p: *mut i32) {
    str_dct2x2up_opt(p.add(0), p.add(1), p.add(2), p.add(3));
    inv_odd_opt(p.add(5), p.add(4), p.add(7), p.add(6));
    inv_odd_opt(p.add(10), p.add(8), p.add(11), p.add(9));
    inv_odd_odd_opt(p.add(15), p.add(14), p.add(13), p.add(12));
}

/// Original function: `strIDCT4x4Stage1_OPT_H2` at `original/jxrlib/image/decode/strdec_x86.c:1228`.
pub unsafe fn str_idct4x4_stage1_opt_h2(p: *mut i32) {
    str_dct2x2dn_sse2_1(p);
}

/// Original function: `strIDCT4x4Stage1_OPT5` at `original/jxrlib/image/decode/strdec_x86.c:1234`.
pub unsafe fn str_idct4x4_stage1_opt5(p0: *mut i32, p1: *mut i32) {
    str_idct4x4_stage1_opt_h1(p0.offset(-96));
    str_idct4x4_stage1_opt_h1(p0.offset(-80));
    str_idct4x4_stage1_opt_h1(p0.offset(-32));
    str_idct4x4_stage1_opt_h1(p0.offset(-16));

    str_idct4x4_stage1_opt_h1(p0.offset(32));
    str_idct4x4_stage1_opt_h1(p0.offset(48));
    str_idct4x4_stage1_opt_h1(p0.offset(96));
    str_idct4x4_stage1_opt_h1(p0.offset(112));

    str_idct4x4_stage1_opt_h1(p1.offset(-128));
    str_idct4x4_stage1_opt_h1(p1.offset(-112));
    str_idct4x4_stage1_opt_h1(p1.offset(-64));
    str_idct4x4_stage1_opt_h1(p1.offset(-48));

    str_idct4x4_stage1_opt_h1(p1.offset(0));
    str_idct4x4_stage1_opt_h1(p1.offset(16));
    str_idct4x4_stage1_opt_h1(p1.offset(64));
    str_idct4x4_stage1_opt_h1(p1.offset(80));

    str_idct4x4_stage1_opt_h2(p0.offset(-96));
    str_idct4x4_stage1_opt_h2(p0.offset(-80));
    str_idct4x4_stage1_opt_h2(p0.offset(-32));
    str_idct4x4_stage1_opt_h2(p0.offset(-16));
    str_idct4x4_stage1_opt_h2(p0.offset(32));
    str_idct4x4_stage1_opt_h2(p0.offset(48));
    str_idct4x4_stage1_opt_h2(p0.offset(96));
    str_idct4x4_stage1_opt_h2(p0.offset(112));

    str_idct4x4_stage1_opt_h2(p1.offset(-128));
    str_idct4x4_stage1_opt_h2(p1.offset(-112));
    str_idct4x4_stage1_opt_h2(p1.offset(-64));
    str_idct4x4_stage1_opt_h2(p1.offset(-48));
    str_idct4x4_stage1_opt_h2(p1.offset(0));
    str_idct4x4_stage1_opt_h2(p1.offset(16));
    str_idct4x4_stage1_opt_h2(p1.offset(64));
    str_idct4x4_stage1_opt_h2(p1.offset(80));
}

/// Original function: `StrDecOpt` at `original/jxrlib/image/decode/strdec_x86.c:1581`.
pub unsafe fn str_dec_opt(_sc: &mut CWMImageStrCodec) {}
