// Auto-generated scaffold for a faithful JXRLib translation restart.
// Keep one Rust item per original C item; replace stubs bottom-up.

use std::ptr::NonNull;

use super::postprocess::{post_proc_block, post_proc_mb, slide_one_mb_row, update_post_proc_info};
use crate::image::sys::str_transform::{fourbutterfly_hardcoded1, str_dct2x2dn, str_dct2x2up};
use crate::image::sys::strcodec::{CWMITile, CWMImageStrCodec, MAX_CHANNELS};
use crate::image::sys::windowsmediaphoto::{Overlap, Subband};
use crate::jxrgluelib::jxrglue::ColorFormat;
use crate::WmpError;

/// Original function: `strIDCT4x4Stage1` at `original/jxrlib/image/decode/strInvTransform.c:58`.
pub unsafe fn str_idct4x4_stage1(p: &mut [i32]) {
    str_dct2x2up(
        &mut *p.as_mut_ptr().add(0),
        &mut *p.as_mut_ptr().add(1),
        &mut *p.as_mut_ptr().add(2),
        &mut *p.as_mut_ptr().add(3),
    );

    inv_odd(
        &mut *p.as_mut_ptr().add(5),
        &mut *p.as_mut_ptr().add(4),
        &mut *p.as_mut_ptr().add(7),
        &mut *p.as_mut_ptr().add(6),
    );

    inv_odd(
        &mut *p.as_mut_ptr().add(10),
        &mut *p.as_mut_ptr().add(8),
        &mut *p.as_mut_ptr().add(11),
        &mut *p.as_mut_ptr().add(9),
    );

    inv_odd_odd(
        &mut *p.as_mut_ptr().add(15),
        &mut *p.as_mut_ptr().add(14),
        &mut *p.as_mut_ptr().add(13),
        &mut *p.as_mut_ptr().add(12),
    );

    fourbutterfly_hardcoded1(&mut p[..16]);
}

/// Original function: `strIDCT4x4Stage2` at `original/jxrlib/image/decode/strInvTransform.c:77`.
pub unsafe fn str_idct4x4_stage2(p: &mut [i32]) {
    let ptr = p.as_mut_ptr();
    inv_odd(
        &mut *ptr.add(32),
        &mut *ptr.add(48),
        &mut *ptr.add(96),
        &mut *ptr.add(112),
    );

    inv_odd(
        &mut *ptr.add(128),
        &mut *ptr.add(192),
        &mut *ptr.add(144),
        &mut *ptr.add(208),
    );

    inv_odd_odd(
        &mut *ptr.add(160),
        &mut *ptr.add(224),
        &mut *ptr.add(176),
        &mut *ptr.add(240),
    );

    str_dct2x2up(
        &mut *ptr.add(0),
        &mut *ptr.add(64),
        &mut *ptr.add(16),
        &mut *ptr.add(80),
    );

    str_dct2x2dn(
        &mut *ptr.add(0),
        &mut *ptr.add(192),
        &mut *ptr.add(48),
        &mut *ptr.add(240),
    );
    str_dct2x2dn(
        &mut *ptr.add(64),
        &mut *ptr.add(128),
        &mut *ptr.add(112),
        &mut *ptr.add(176),
    );
    str_dct2x2dn(
        &mut *ptr.add(16),
        &mut *ptr.add(208),
        &mut *ptr.add(32),
        &mut *ptr.add(224),
    );
    str_dct2x2dn(
        &mut *ptr.add(80),
        &mut *ptr.add(144),
        &mut *ptr.add(96),
        &mut *ptr.add(160),
    );
}

/// Original function: `strNormalizeDec` at `original/jxrlib/image/decode/strInvTransform.c:95`.
pub fn str_normalize_dec(p: &mut [i32], b_chroma: i32) {
    if b_chroma != 0 {
        for i in (0..256).step_by(16) {
            p[i] += p[i];
        }
    }
}

/// Original function: `strDCT2x2dnDec` at `original/jxrlib/image/decode/strInvTransform.c:111`.
pub fn str_dct2x2dn_dec(pa: &mut i32, pb: &mut i32, pc: &mut i32, pd: &mut i32) {
    let mut a = *pa;
    let mut b = *pb;
    let c_orig = *pc;
    let mut d = *pd;

    a += d;
    b -= c_orig;
    let t = (a - b) >> 1;
    let c = t - d;
    d = t - c_orig;
    a -= d;
    b += c;

    *pa = a * 2;
    *pb = b * 2;
    *pc = c * 2;
    *pd = d * 2;
}

/// Original function: `strPost2` at `original/jxrlib/image/decode/strInvTransform.c:136`.
pub fn str_post2(a: &mut i32, b: &mut i32) {
    *b += (*a + 4) >> 3;
    *a += (*b + 2) >> 2;
    *b += (*a + 4) >> 3;
}

/// Original function: `strPost2_alternate` at `original/jxrlib/image/decode/strInvTransform.c:143`.
pub fn str_post2_alternate(pa: &mut i32, pb: &mut i32) {
    let mut a = *pa;
    let mut b = *pb;

    b += (a + 2) >> 2;
    a += (b + 1) >> 1;
    a += b >> 5;
    a += b >> 9;
    a += b >> 13;

    b += (a + 2) >> 2;

    *pa = a;
    *pb = b;
}

/// Original function: `strPost2x2` at `original/jxrlib/image/decode/strInvTransform.c:162`.
pub fn str_post2x2(pa: &mut i32, pb: &mut i32, pc: &mut i32, pd: &mut i32) {
    let mut a = *pa;
    let mut b = *pb;
    let mut c = *pc;
    let mut d = *pd;

    a += d;
    b += c;
    d -= (a + 1) >> 1;
    c -= (b + 1) >> 1;

    b += (a + 2) >> 2;
    a += (b + 1) >> 1;
    b += (a + 2) >> 2;

    d += (a + 1) >> 1;
    c += (b + 1) >> 1;
    a -= d;
    b -= c;

    *pa = a;
    *pb = b;
    *pc = c;
    *pd = d;
}

/// Original function: `strPost2x2_alternate` at `original/jxrlib/image/decode/strInvTransform.c:193`.
pub fn str_post2x2_alternate(pa: &mut i32, pb: &mut i32, pc: &mut i32, pd: &mut i32) {
    let mut a = *pa;
    let mut b = *pb;
    let mut c = *pc;
    let mut d = *pd;

    a += d;
    b += c;
    d -= (a + 1) >> 1;
    c -= (b + 1) >> 1;

    b += (a + 2) >> 2;
    a += (b + 1) >> 1;
    a += b >> 5;
    a += b >> 9;
    a += b >> 13;
    b += (a + 2) >> 2;

    d += (a + 1) >> 1;
    c += (b + 1) >> 1;
    a -= d;
    b -= c;

    *pa = a;
    *pb = b;
    *pc = c;
    *pd = d;
}

/// Original function: `strPost4` at `original/jxrlib/image/decode/strInvTransform.c:228`.
pub fn str_post4(pa: &mut i32, pb: &mut i32, pc: &mut i32, pd: &mut i32) {
    let mut a = *pa;
    let mut b = *pb;
    let mut c = *pc;
    let mut d = *pd;

    a += d;
    b += c;
    d -= (a + 1) >> 1;
    c -= (b + 1) >> 1;

    c -= (d + 1) >> 1;
    d += (c + 1) >> 1;

    d += (a + 1) >> 1;
    c += (b + 1) >> 1;
    a -= d - ((d * 3 + 16) >> 5);
    b -= c - ((c * 3 + 16) >> 5);
    d += (a * 3 + 8) >> 4;
    c += (b * 3 + 8) >> 4;
    a += (d * 3 + 16) >> 5;
    b += (c * 3 + 16) >> 5;

    *pa = a;
    *pb = b;
    *pc = c;
    *pd = d;
}

/// Original function: `strPost4_alternate` at `original/jxrlib/image/decode/strInvTransform.c:252`.
pub fn str_post4_alternate(pa: &mut i32, pb: &mut i32, pc: &mut i32, pd: &mut i32) {
    let mut a = *pa;
    let mut b = *pb;
    let mut c = *pc;
    let mut d = *pd;

    a += d;
    b += c;
    d -= (a + 1) >> 1;
    c -= (b + 1) >> 1;

    str_hstdec1_edge(&mut a, &mut d);
    str_hstdec1_edge(&mut b, &mut c);
    c -= (d + 1) >> 1;
    d += (c + 1) >> 1;
    d += (a + 1) >> 1;
    c += (b + 1) >> 1;

    a -= d;
    b -= c;

    *pa = a;
    *pb = b;
    *pc = c;
    *pd = d;
}

/// Original function: `DCCompensate` at `original/jxrlib/image/decode/strInvTransform.c:283`.
pub fn dc_compensate(a: &mut i32, b: &mut i32, c: &mut i32, d: &mut i32, mut iDC: i32) {
    iDC >>= 1;
    *a -= iDC;
    *d -= iDC;
    *b += iDC;
    *c += iDC;
}

/// Original function: `ClipDCL` at `original/jxrlib/image/decode/strInvTransform.c:300`.
pub unsafe fn clip_dcl(iDCL: i32, iAltDCL: i32) -> i32 {
    let mut iClipDCL = 0;
    if iDCL > 0 {
        if iAltDCL > 0 {
            iClipDCL = std::cmp::min(iDCL, iAltDCL);
        } else {
            iClipDCL = 0;
        }
    } else if iDCL < 0 {
        if iAltDCL < 0 {
            iClipDCL = std::cmp::max(iDCL, iAltDCL);
        } else {
            iClipDCL = 0;
        }
    }
    iClipDCL
}

/// Original function: `strPost4x4Stage1Split` at `original/jxrlib/image/decode/strInvTransform.c:318`.
pub unsafe fn str_post4x4_stage1_split(
    mut p0: *mut i32,
    mut p1: *mut i32,
    i_offset: i32,
    i_hpqp: i32,
    b_hp_absent: i32,
) {
    let p2 = p0.offset((72 - i_offset) as isize);
    let p3 = p1.offset((64 - i_offset) as isize);
    p0 = p0.add(12);
    p1 = p1.add(4);

    str_dct2x2dn(
        &mut *p0.add(0),
        &mut *p2.add(0),
        &mut *p1.add(0),
        &mut *p3.add(0),
    );
    str_dct2x2dn(
        &mut *p0.add(1),
        &mut *p2.add(1),
        &mut *p1.add(1),
        &mut *p3.add(1),
    );
    str_dct2x2dn(
        &mut *p0.add(2),
        &mut *p2.add(2),
        &mut *p1.add(2),
        &mut *p3.add(2),
    );
    str_dct2x2dn(
        &mut *p0.add(3),
        &mut *p2.add(3),
        &mut *p1.add(3),
        &mut *p3.add(3),
    );

    inv_odd_odd_post(
        &mut *p3.add(0),
        &mut *p3.add(1),
        &mut *p3.add(2),
        &mut *p3.add(3),
    );

    *p1.add(2) -= (*p1.add(3) + 1) >> 1;
    *p1.add(3) += (*p1.add(2) + 1) >> 1;
    *p1.add(0) -= (*p1.add(1) + 1) >> 1;
    *p1.add(1) += (*p1.add(0) + 1) >> 1;
    *p2.add(1) -= (*p2.add(3) + 1) >> 1;
    *p2.add(3) += (*p2.add(1) + 1) >> 1;
    *p2.add(0) -= (*p2.add(2) + 1) >> 1;
    *p2.add(2) += (*p2.add(0) + 1) >> 1;

    str_hstdec1(&mut *p0.add(0), &mut *p3.add(0));
    str_hstdec1(&mut *p0.add(1), &mut *p3.add(1));
    str_hstdec1(&mut *p0.add(2), &mut *p3.add(2));
    str_hstdec1(&mut *p0.add(3), &mut *p3.add(3));
    str_hstdec(
        &mut *p0.add(0),
        &mut *p2.add(0),
        &mut *p1.add(0),
        &mut *p3.add(0),
    );
    str_hstdec(
        &mut *p0.add(1),
        &mut *p2.add(1),
        &mut *p1.add(1),
        &mut *p3.add(1),
    );
    str_hstdec(
        &mut *p0.add(2),
        &mut *p2.add(2),
        &mut *p1.add(2),
        &mut *p3.add(2),
    );
    str_hstdec(
        &mut *p0.add(3),
        &mut *p2.add(3),
        &mut *p1.add(3),
        &mut *p3.add(3),
    );

    let i_tmp0 = (*p0.add(0) + *p1.add(0) + *p2.add(0) + *p3.add(0)) >> 1;
    let i_tmp1 = (*p0.add(1) + *p1.add(1) + *p2.add(1) + *p3.add(1)) >> 1;
    let i_tmp2 = (*p0.add(2) + *p1.add(2) + *p2.add(2) + *p3.add(2)) >> 1;
    let i_tmp3 = (*p0.add(3) + *p1.add(3) + *p2.add(3) + *p3.add(3)) >> 1;
    let mut i_dcl0 = (i_tmp0 * 595 + 65536) >> 17;
    let mut i_dcl1 = (i_tmp1 * 595 + 65536) >> 17;
    let mut i_dcl2 = (i_tmp2 * 595 + 65536) >> 17;
    let mut i_dcl3 = (i_tmp3 * 595 + 65536) >> 17;
    if (i_dcl0.abs() < i_hpqp && i_hpqp > 20) || b_hp_absent != 0 {
        let i_dcl_alt0 = (*p0.add(0) - *p1.add(0) - *p2.add(0) + *p3.add(0)) >> 1;
        i_dcl0 = clip_dcl(i_dcl0, i_dcl_alt0);
        dc_compensate(
            &mut *p0.add(0),
            &mut *p2.add(0),
            &mut *p1.add(0),
            &mut *p3.add(0),
            i_dcl0,
        );
    }
    if (i_dcl1.abs() < i_hpqp && i_hpqp > 20) || b_hp_absent != 0 {
        let i_dcl_alt1 = (*p0.add(1) - *p1.add(1) - *p2.add(1) + *p3.add(1)) >> 1;
        i_dcl1 = clip_dcl(i_dcl1, i_dcl_alt1);
        dc_compensate(
            &mut *p0.add(1),
            &mut *p2.add(1),
            &mut *p1.add(1),
            &mut *p3.add(1),
            i_dcl1,
        );
    }
    if (i_dcl2.abs() < i_hpqp && i_hpqp > 20) || b_hp_absent != 0 {
        let i_dcl_alt2 = (*p0.add(2) - *p1.add(2) - *p2.add(2) + *p3.add(2)) >> 1;
        i_dcl2 = clip_dcl(i_dcl2, i_dcl_alt2);
        dc_compensate(
            &mut *p0.add(2),
            &mut *p2.add(2),
            &mut *p1.add(2),
            &mut *p3.add(2),
            i_dcl2,
        );
    }
    if (i_dcl3.abs() < i_hpqp && i_hpqp > 20) || b_hp_absent != 0 {
        let i_dcl_alt3 = (*p0.add(3) - *p1.add(3) - *p2.add(3) + *p3.add(3)) >> 1;
        i_dcl3 = clip_dcl(i_dcl3, i_dcl_alt3);
        dc_compensate(
            &mut *p0.add(3),
            &mut *p2.add(3),
            &mut *p1.add(3),
            &mut *p3.add(3),
            i_dcl3,
        );
    }
}

/// Original function: `strPost4x4Stage1` at `original/jxrlib/image/decode/strInvTransform.c:384`.
pub unsafe fn str_post4x4_stage1(p: *mut i32, i_offset: i32, i_hpqp: i32, b_hp_absent: i32) {
    str_post4x4_stage1_split(p, p.add(16), i_offset, i_hpqp, b_hp_absent);
}

/// Original function: `strPost4x4Stage1Split_alternate` at `original/jxrlib/image/decode/strInvTransform.c:389`.
pub unsafe fn str_post4x4_stage1_split_alternate(
    mut p0: *mut i32,
    mut p1: *mut i32,
    i_offset: i32,
) {
    let p2 = p0.offset((72 - i_offset) as isize);
    let p3 = p1.offset((64 - i_offset) as isize);
    p0 = p0.add(12);
    p1 = p1.add(4);

    str_dct2x2dn(
        &mut *p0.add(0),
        &mut *p2.add(0),
        &mut *p1.add(0),
        &mut *p3.add(0),
    );
    str_dct2x2dn(
        &mut *p0.add(1),
        &mut *p2.add(1),
        &mut *p1.add(1),
        &mut *p3.add(1),
    );
    str_dct2x2dn(
        &mut *p0.add(2),
        &mut *p2.add(2),
        &mut *p1.add(2),
        &mut *p3.add(2),
    );
    str_dct2x2dn(
        &mut *p0.add(3),
        &mut *p2.add(3),
        &mut *p1.add(3),
        &mut *p3.add(3),
    );

    inv_odd_odd_post(
        &mut *p3.add(0),
        &mut *p3.add(1),
        &mut *p3.add(2),
        &mut *p3.add(3),
    );

    *p1.add(2) -= (*p1.add(3) + 1) >> 1;
    *p1.add(3) += (*p1.add(2) + 1) >> 1;
    *p1.add(0) -= (*p1.add(1) + 1) >> 1;
    *p1.add(1) += (*p1.add(0) + 1) >> 1;
    *p2.add(1) -= (*p2.add(3) + 1) >> 1;
    *p2.add(3) += (*p2.add(1) + 1) >> 1;
    *p2.add(0) -= (*p2.add(2) + 1) >> 1;
    *p2.add(2) += (*p2.add(0) + 1) >> 1;

    str_hstdec1_alternate(&mut *p0.add(0), &mut *p3.add(0));
    str_hstdec1_alternate(&mut *p0.add(1), &mut *p3.add(1));
    str_hstdec1_alternate(&mut *p0.add(2), &mut *p3.add(2));
    str_hstdec1_alternate(&mut *p0.add(3), &mut *p3.add(3));
    str_hstdec(
        &mut *p0.add(0),
        &mut *p2.add(0),
        &mut *p1.add(0),
        &mut *p3.add(0),
    );
    str_hstdec(
        &mut *p0.add(1),
        &mut *p2.add(1),
        &mut *p1.add(1),
        &mut *p3.add(1),
    );
    str_hstdec(
        &mut *p0.add(2),
        &mut *p2.add(2),
        &mut *p1.add(2),
        &mut *p3.add(2),
    );
    str_hstdec(
        &mut *p0.add(3),
        &mut *p2.add(3),
        &mut *p1.add(3),
        &mut *p3.add(3),
    );
}

/// Original function: `strPost4x4Stage1_alternate` at `original/jxrlib/image/decode/strInvTransform.c:422`.
pub unsafe fn str_post4x4_stage1_alternate(p: *mut i32, i_offset: i32) {
    str_post4x4_stage1_split_alternate(p, p.add(16), i_offset);
}

/// Original function: `strPost4x4Stage2Split` at `original/jxrlib/image/decode/strInvTransform.c:444`.
pub unsafe fn str_post4x4_stage2_split(p0: *mut i32, p1: *mut i32) {
    str_dct2x2dn(
        &mut *p0.offset(-96),
        &mut *p0.add(96),
        &mut *p1.offset(-112),
        &mut *p1.add(80),
    );
    str_dct2x2dn(
        &mut *p0.offset(-32),
        &mut *p0.add(32),
        &mut *p1.offset(-48),
        &mut *p1.add(16),
    );
    str_dct2x2dn(
        &mut *p0.offset(-80),
        &mut *p0.add(112),
        &mut *p1.offset(-128),
        &mut *p1.add(64),
    );
    str_dct2x2dn(
        &mut *p0.offset(-16),
        &mut *p0.add(48),
        &mut *p1.offset(-64),
        &mut *p1.add(0),
    );

    inv_odd_odd_post(
        &mut *p1.add(0),
        &mut *p1.add(64),
        &mut *p1.add(16),
        &mut *p1.add(80),
    );

    *p0.add(48) -= (*p0.add(32) + 1) >> 1;
    *p0.add(32) += (*p0.add(48) + 1) >> 1;
    *p0.add(112) -= (*p0.add(96) + 1) >> 1;
    *p0.add(96) += (*p0.add(112) + 1) >> 1;
    *p1.offset(-64) -= (*p1.offset(-128) + 1) >> 1;
    *p1.offset(-128) += (*p1.offset(-64) + 1) >> 1;
    *p1.offset(-48) -= (*p1.offset(-112) + 1) >> 1;
    *p1.offset(-112) += (*p1.offset(-48) + 1) >> 1;

    str_hstdec1(&mut *p0.offset(-96), &mut *p1.add(80));
    str_hstdec1(&mut *p0.offset(-32), &mut *p1.add(16));
    str_hstdec1(&mut *p0.offset(-80), &mut *p1.add(64));
    str_hstdec1(&mut *p0.offset(-16), &mut *p1.add(0));

    str_hstdec(
        &mut *p0.offset(-96),
        &mut *p1.offset(-112),
        &mut *p0.add(96),
        &mut *p1.add(80),
    );
    str_hstdec(
        &mut *p0.offset(-32),
        &mut *p1.offset(-48),
        &mut *p0.add(32),
        &mut *p1.add(16),
    );
    str_hstdec(
        &mut *p0.offset(-80),
        &mut *p1.offset(-128),
        &mut *p0.add(112),
        &mut *p1.add(64),
    );
    str_hstdec(
        &mut *p0.offset(-16),
        &mut *p1.offset(-64),
        &mut *p0.add(48),
        &mut *p1.add(0),
    );
}

/// Original function: `strPost4x4Stage2Split_alternate` at `original/jxrlib/image/decode/strInvTransform.c:473`.
pub unsafe fn str_post4x4_stage2_split_alternate(p0: *mut i32, p1: *mut i32) {
    str_dct2x2dn(
        &mut *p0.offset(-96),
        &mut *p0.add(96),
        &mut *p1.offset(-112),
        &mut *p1.add(80),
    );
    str_dct2x2dn(
        &mut *p0.offset(-32),
        &mut *p0.add(32),
        &mut *p1.offset(-48),
        &mut *p1.add(16),
    );
    str_dct2x2dn(
        &mut *p0.offset(-80),
        &mut *p0.add(112),
        &mut *p1.offset(-128),
        &mut *p1.add(64),
    );
    str_dct2x2dn(
        &mut *p0.offset(-16),
        &mut *p0.add(48),
        &mut *p1.offset(-64),
        &mut *p1.add(0),
    );

    inv_odd_odd_post(
        &mut *p1.add(0),
        &mut *p1.add(64),
        &mut *p1.add(16),
        &mut *p1.add(80),
    );

    *p0.add(48) -= (*p0.add(32) + 1) >> 1;
    *p0.add(32) += (*p0.add(48) + 1) >> 1;
    *p0.add(112) -= (*p0.add(96) + 1) >> 1;
    *p0.add(96) += (*p0.add(112) + 1) >> 1;
    *p1.offset(-64) -= (*p1.offset(-128) + 1) >> 1;
    *p1.offset(-128) += (*p1.offset(-64) + 1) >> 1;
    *p1.offset(-48) -= (*p1.offset(-112) + 1) >> 1;
    *p1.offset(-112) += (*p1.offset(-48) + 1) >> 1;

    str_hstdec1_alternate(&mut *p0.offset(-96), &mut *p1.add(80));
    str_hstdec1_alternate(&mut *p0.offset(-32), &mut *p1.add(16));
    str_hstdec1_alternate(&mut *p0.offset(-80), &mut *p1.add(64));
    str_hstdec1_alternate(&mut *p0.offset(-16), &mut *p1.add(0));

    str_hstdec(
        &mut *p0.offset(-96),
        &mut *p1.offset(-112),
        &mut *p0.add(96),
        &mut *p1.add(80),
    );
    str_hstdec(
        &mut *p0.offset(-32),
        &mut *p1.offset(-48),
        &mut *p0.add(32),
        &mut *p1.add(16),
    );
    str_hstdec(
        &mut *p0.offset(-80),
        &mut *p1.offset(-128),
        &mut *p0.add(112),
        &mut *p1.add(64),
    );
    str_hstdec(
        &mut *p0.offset(-16),
        &mut *p1.offset(-64),
        &mut *p0.add(48),
        &mut *p1.add(0),
    );
}

/// Original function: `strHSTdec1` at `original/jxrlib/image/decode/strInvTransform.c:507`.
pub fn str_hstdec1(pa: &mut i32, pd: &mut i32) {
    let mut a = *pa;
    let mut d = *pd;

    a += d;
    d = (a >> 1) - d;
    a += (d * 3 + 0) >> 3;
    d += (a * 3 + 0) >> 4;

    *pa = a;
    *pd = d;
}

/// Original function: `strHSTdec1_alternate` at `original/jxrlib/image/decode/strInvTransform.c:524`.
pub fn str_hstdec1_alternate(pa: &mut i32, pd: &mut i32) {
    let mut a = *pa;
    let mut d = *pd;

    a += d;
    d = (a >> 1) - d;
    a += (d * 3 + 0) >> 3;
    d += (a * 3 + 0) >> 4;

    d += a >> 7;
    d -= a >> 10;

    *pa = a;
    *pd = d;
}

/// Original function: `strHSTdec1_edge` at `original/jxrlib/image/decode/strInvTransform.c:544`.
pub fn str_hstdec1_edge(pa: &mut i32, pd: &mut i32) {
    let mut a = *pa;
    let mut d = *pd;

    a += d;
    d = (a >> 1) - d;
    a += (d * 3 + 0) >> 3;
    d += (a * 3 + 0) >> 4;

    d += a >> 7;
    d -= a >> 10;

    a += (d * 3 + 4) >> 3;
    d -= a >> 1;
    a += d;

    *pa = a;
    *pd = -d;
}

/// Original function: `strHSTdec` at `original/jxrlib/image/decode/strInvTransform.c:569`.
pub fn str_hstdec(pa: &mut i32, pb: &mut i32, pc: &mut i32, pd: &mut i32) {
    let mut a = *pa;
    let mut b = *pb;
    let mut c = *pc;
    let mut d = *pd;

    b -= c;
    a += (d * 3 + 4) >> 3;

    d -= b >> 1;
    c = ((a - b) >> 1) - c;
    *pc = d;
    *pd = c;
    *pa = a - c;
    *pb = b + d;
}

/// Original function: `invOddOdd` at `original/jxrlib/image/decode/strInvTransform.c:589`.
pub fn inv_odd_odd(pa: &mut i32, pb: &mut i32, pc: &mut i32, pd: &mut i32) {
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

/// Original function: `invOddOddPost` at `original/jxrlib/image/decode/strInvTransform.c:622`.
pub fn inv_odd_odd_post(pa: &mut i32, pb: &mut i32, pc: &mut i32, pd: &mut i32) {
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

    a -= (b * 3 + 6) >> 3;
    b += (a * 3 + 2) >> 2;
    a -= (b * 3 + 4) >> 3;

    b -= t2;
    a += t1;
    c += b;
    d -= a;

    *pa = a;
    *pb = b;
    *pc = c;
    *pd = d;
}

/// Original function: `invOdd` at `original/jxrlib/image/decode/strInvTransform.c:656`.
pub fn inv_odd(pa: &mut i32, pb: &mut i32, pc: &mut i32, pd: &mut i32) {
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

/// Original function: `invTransformMacroblock` at `original/jxrlib/image/decode/strInvTransform.c:689`.
pub unsafe fn inv_transform_macroblock(p_sc: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    let p_sc = p_sc as *mut CWMImageStrCodec;
    let ol_overlap = (*p_sc).WMISCP.olOverlap;
    let cf_color_format = (*p_sc).m_param.cfColorFormat;
    let left = ((*p_sc).cColumn == 0) as i32;
    let right = ((*p_sc).cColumn == (*p_sc).cmbWidth) as i32;
    let top = ((*p_sc).cRow == 0) as i32;
    let bottom = ((*p_sc).cRow == (*p_sc).cmbHeight) as i32;
    let top_or_bottom = ((top != 0) || (bottom != 0)) as i32;
    let left_or_right = ((left != 0) || (right != 0)) as i32;
    let top_or_left = ((top != 0) || (left != 0)) as i32;
    let bottom_or_right = ((bottom != 0) || (right != 0)) as i32;
    let mb_width = (*p_sc).cmbWidth;
    let mb_x = (*p_sc).cColumn;
    let i_channels =
        if cf_color_format == ColorFormat::Yuv420 || cf_color_format == ColorFormat::Yuv422 {
            1
        } else {
            (*p_sc).m_param.cNumChannels
        };
    // m_Dparam set during decoder init; C derefs pSC->m_Dparam unconditionally
    let t_scale = (*(*p_sc)
        .m_Dparam
        .expect("m_Dparam set during decoder init")
        .as_ptr())
    .cThumbnailScale;
    let mut qp = [0 as i32; MAX_CHANNELS];
    let mut dcqp = [0 as i32; MAX_CHANNELS];
    let i_strength = 1 << (*p_sc).WMII.cPostProcStrength;
    let b_hp_absent = ((*p_sc).WMISCP.sbSubband == Subband::NoHighpass
        || (*p_sc).WMISCP.sbSubband == Subband::DcOnly) as i32;
    let Some(tile) = (*p_sc)
        .pTileMemory
        .as_deref_mut()
        .and_then(|tiles| tiles.get_mut((*p_sc).cTileColumn))
    else {
        return Ok(());
    };
    let p_tile = tile as *mut CWMITile;

    if (*p_sc).WMII.cPostProcStrength > 0 {
        let mut i = 0;
        while i < i_channels {
            let Some(p_qplp_base) = (*p_tile).pQuantizerLP[i] else {
                return Ok(());
            };
            let p_qplp = p_qplp_base.as_ptr().add((*p_sc).MBInfo.iQIndexLP as usize);
            qp[i] = (*p_qplp).iQP * i_strength * if ol_overlap == Overlap::None { 2 } else { 1 };
            let Some(p_qpdc) = (*p_tile).pQuantizerDC[i] else {
                return Ok(());
            };
            dcqp[i] = (*p_qpdc.as_ptr()).iQP * i_strength;
            i += 1;
        }

        if left != 0 {
            slide_one_mb_row(
                &mut (*p_sc).pPostProcInfo,
                &mut (*p_sc).pPostProcInfoMemory,
                (*p_sc).m_param.cNumChannels,
                mb_width,
                top != 0,
                bottom != 0,
            );
        }
    }

    let mut i = 0;
    while i < i_channels && t_scale < 16 {
        let p0 = (*p_sc).p0MBbuffer[i].map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);
        let p1 = (*p_sc).p1MBbuffer[i].map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);
        let mut i_hpqp = 255;
        if b_hp_absent == 0 {
            let Some(p_qphp_base) = (*p_tile).pQuantizerHP[i] else {
                return Ok(());
            };
            i_hpqp = (*p_qphp_base.as_ptr().add((*p_sc).MBInfo.iQIndexHP as usize)).iQP;
        }

        if bottom_or_right == 0 {
            if (*p_sc).WMII.cPostProcStrength > 0 {
                update_post_proc_info(
                    &mut (*p_sc).pPostProcInfoMemory,
                    std::slice::from_raw_parts(p1, 256),
                    mb_x,
                    i,
                );
            }

            str_idct4x4_stage2(std::slice::from_raw_parts_mut(p1, 256));
            if (*p_sc).m_param.bScaledArith != 0 {
                str_normalize_dec(std::slice::from_raw_parts_mut(p1, 256), (i != 0) as i32);
            }
        }

        if ol_overlap == Overlap::Two {
            if left_or_right != 0 && top_or_bottom == 0 {
                let j = if left != 0 { 0 } else { -128 };
                str_post4(
                    &mut *p0.offset(j + 32),
                    &mut *p0.offset(j + 48),
                    &mut *p1.offset(j),
                    &mut *p1.offset(j + 16),
                );
                str_post4(
                    &mut *p0.offset(j + 96),
                    &mut *p0.offset(j + 112),
                    &mut *p1.offset(j + 64),
                    &mut *p1.offset(j + 80),
                );
            }

            if left_or_right == 0 {
                if top_or_bottom != 0 {
                    let p = if top != 0 { p1 } else { p0.add(32) };
                    str_post4(
                        &mut *p.offset(-128),
                        &mut *p.offset(-64),
                        &mut *p.add(0),
                        &mut *p.add(64),
                    );
                    str_post4(
                        &mut *p.offset(-112),
                        &mut *p.offset(-48),
                        &mut *p.add(16),
                        &mut *p.add(80),
                    );
                } else {
                    str_post4x4_stage2_split(p0, p1);
                }
            }
        }

        if (*p_sc).WMII.cPostProcStrength > 0 {
            post_proc_mb(&mut (*p_sc).pPostProcInfoMemory, p0, p1, mb_x, i, dcqp[i]);
        }

        if t_scale >= 4 {
            i += 1;
            continue;
        }

        if top == 0 {
            let mut j = if left != 0 { 32 } else { -96 };
            while j < if right != 0 { 32 } else { 160 } {
                str_idct4x4_stage1(std::slice::from_raw_parts_mut(p0.offset(j), 16));
                str_idct4x4_stage1(std::slice::from_raw_parts_mut(p0.offset(j + 16), 16));
                j += 64;
            }
        }

        if bottom == 0 {
            let mut j = if left != 0 { 0 } else { -128 };
            while j < if right != 0 { 0 } else { 128 } {
                str_idct4x4_stage1(std::slice::from_raw_parts_mut(p1.offset(j), 16));
                str_idct4x4_stage1(std::slice::from_raw_parts_mut(p1.offset(j + 16), 16));
                j += 64;
            }
        }

        if ol_overlap != Overlap::None {
            if left_or_right != 0 {
                let j = if left != 0 { 10 } else { -64 + 14 };
                if top == 0 {
                    let p = p0.offset(16 + j);
                    str_post4(
                        &mut *p.add(0),
                        &mut *p.offset(-2),
                        &mut *p.add(6),
                        &mut *p.add(8),
                    );
                    str_post4(
                        &mut *p.add(1),
                        &mut *p.offset(-1),
                        &mut *p.add(7),
                        &mut *p.add(9),
                    );
                    str_post4(
                        &mut *p.add(16),
                        &mut *p.add(14),
                        &mut *p.add(22),
                        &mut *p.add(24),
                    );
                    str_post4(
                        &mut *p.add(17),
                        &mut *p.add(15),
                        &mut *p.add(23),
                        &mut *p.add(25),
                    );
                }
                if bottom == 0 {
                    let p = p1.offset(j);
                    str_post4(
                        &mut *p.add(0),
                        &mut *p.offset(-2),
                        &mut *p.add(6),
                        &mut *p.add(8),
                    );
                    str_post4(
                        &mut *p.add(1),
                        &mut *p.offset(-1),
                        &mut *p.add(7),
                        &mut *p.add(9),
                    );
                }
                if top_or_bottom == 0 {
                    str_post4(
                        &mut *p0.offset(48 + j),
                        &mut *p0.offset(48 + j - 2),
                        &mut *p1.offset(-10 + j),
                        &mut *p1.offset(-8 + j),
                    );
                    str_post4(
                        &mut *p0.offset(48 + j + 1),
                        &mut *p0.offset(48 + j - 1),
                        &mut *p1.offset(-9 + j),
                        &mut *p1.offset(-7 + j),
                    );
                }
            }

            if top != 0 {
                let mut j = if left != 0 { 0 } else { -192 };
                while j < if right != 0 { -64 } else { 64 } {
                    let p = p1.offset(j);
                    str_post4(
                        &mut *p.add(5),
                        &mut *p.add(4),
                        &mut *p.add(64),
                        &mut *p.add(65),
                    );
                    str_post4(
                        &mut *p.add(7),
                        &mut *p.add(6),
                        &mut *p.add(66),
                        &mut *p.add(67),
                    );
                    str_post4x4_stage1(p1.offset(j), 0, i_hpqp, b_hp_absent);
                    j += 64;
                }
            } else if bottom != 0 {
                let mut j = if left != 0 { 0 } else { -192 };
                while j < if right != 0 { -64 } else { 64 } {
                    str_post4x4_stage1(p0.offset(16 + j), 0, i_hpqp, b_hp_absent);
                    str_post4x4_stage1(p0.offset(32 + j), 0, i_hpqp, b_hp_absent);
                    let p = p0.offset(48 + j);
                    str_post4(
                        &mut *p.add(15),
                        &mut *p.add(14),
                        &mut *p.add(74),
                        &mut *p.add(75),
                    );
                    str_post4(
                        &mut *p.add(13),
                        &mut *p.add(12),
                        &mut *p.add(72),
                        &mut *p.add(73),
                    );
                    j += 64;
                }
            } else {
                let mut j = if left != 0 { 0 } else { -192 };
                while j < if right != 0 { -64 } else { 64 } {
                    str_post4x4_stage1(p0.offset(16 + j), 0, i_hpqp, b_hp_absent);
                    str_post4x4_stage1(p0.offset(32 + j), 0, i_hpqp, b_hp_absent);
                    str_post4x4_stage1_split(
                        p0.offset(48 + j),
                        p1.offset(j),
                        0,
                        i_hpqp,
                        b_hp_absent,
                    );
                    str_post4x4_stage1(p1.offset(j), 0, i_hpqp, b_hp_absent);
                    j += 64;
                }
            }
        }

        if (*p_sc).WMII.cPostProcStrength > 0 && top_or_left == 0 {
            post_proc_block(&(*p_sc).pPostProcInfoMemory, p0, p1, mb_x, i, qp[i]);
        }

        i += 1;
    }

    let mut i = 0;
    while i < if cf_color_format == ColorFormat::Yuv420 {
        2
    } else {
        0
    } && t_scale < 16
    {
        let p0 = (*p_sc).p0MBbuffer[1 + i].map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);
        let p1 = (*p_sc).p1MBbuffer[1 + i].map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);
        let mut i_hpqp = 255;
        if b_hp_absent == 0 {
            let Some(p_qphp_base) = (*p_tile).pQuantizerHP[i] else {
                return Ok(());
            };
            i_hpqp = (*p_qphp_base.as_ptr().add((*p_sc).MBInfo.iQIndexHP as usize)).iQP;
        }

        if bottom_or_right == 0 {
            if (*p_sc).m_param.bScaledArith == 0 {
                str_dct2x2dn(
                    &mut *p1,
                    &mut *p1.add(32),
                    &mut *p1.add(16),
                    &mut *p1.add(48),
                );
            } else {
                str_dct2x2dn_dec(
                    &mut *p1,
                    &mut *p1.add(32),
                    &mut *p1.add(16),
                    &mut *p1.add(48),
                );
            }
        }

        if ol_overlap == Overlap::Two {
            if left_or_right != 0 && top_or_bottom == 0 {
                let j = if left != 0 { 0 } else { -32 };
                str_post2(&mut *p0.offset(j + 16), &mut *p1.offset(j));
            }

            if left_or_right == 0 {
                if top_or_bottom != 0 {
                    let p = if top != 0 { p1 } else { p0.add(16) };
                    str_post2(&mut *p.offset(-32), &mut *p);
                } else {
                    str_post2x2(
                        &mut *p0.offset(-16),
                        &mut *p0.add(16),
                        &mut *p1.offset(-32),
                        &mut *p1,
                    );
                }
            }
        }

        if t_scale >= 4 {
            i += 1;
            continue;
        }

        if top == 0 {
            let mut j = if left != 0 { 16 } else { -16 };
            while j < if right != 0 { 16 } else { 48 } {
                str_idct4x4_stage1(std::slice::from_raw_parts_mut(p0.offset(j), 16));
                j += 32;
            }
        }

        if bottom == 0 {
            let mut j = if left != 0 { 0 } else { -32 };
            while j < if right != 0 { 0 } else { 32 } {
                str_idct4x4_stage1(std::slice::from_raw_parts_mut(p1.offset(j), 16));
                j += 32;
            }
        }

        if ol_overlap != Overlap::None {
            if left == 0 && top == 0 {
                if bottom != 0 {
                    let mut j = -48;
                    while j < if right != 0 { -16 } else { 16 } {
                        let p = p0.offset(j);
                        str_post4(
                            &mut *p.add(15),
                            &mut *p.add(14),
                            &mut *p.add(42),
                            &mut *p.add(43),
                        );
                        str_post4(
                            &mut *p.add(13),
                            &mut *p.add(12),
                            &mut *p.add(40),
                            &mut *p.add(41),
                        );
                        j += 32;
                    }
                } else {
                    let mut j = -48;
                    while j < if right != 0 { -16 } else { 16 } {
                        str_post4x4_stage1_split(
                            p0.offset(j),
                            p1.offset(-16 + j),
                            32,
                            i_hpqp,
                            b_hp_absent,
                        );
                        j += 32;
                    }
                }

                if right != 0 {
                    if bottom == 0 {
                        str_post4(
                            &mut *p0.offset(-2),
                            &mut *p0.offset(-4),
                            &mut *p1.offset(-28),
                            &mut *p1.offset(-26),
                        );
                        str_post4(
                            &mut *p0.offset(-1),
                            &mut *p0.offset(-3),
                            &mut *p1.offset(-27),
                            &mut *p1.offset(-25),
                        );
                    }
                    str_post4(
                        &mut *p0.offset(-18),
                        &mut *p0.offset(-20),
                        &mut *p0.offset(-12),
                        &mut *p0.offset(-10),
                    );
                    str_post4(
                        &mut *p0.offset(-17),
                        &mut *p0.offset(-19),
                        &mut *p0.offset(-11),
                        &mut *p0.offset(-9),
                    );
                } else {
                    str_post4x4_stage1(p0.offset(-32), 32, i_hpqp, b_hp_absent);
                }

                str_post4x4_stage1(p0.offset(-64), 32, i_hpqp, b_hp_absent);
            } else if top != 0 {
                let mut j = if left != 0 { 0 } else { -64 };
                while j < if right != 0 { -32 } else { 0 } {
                    let p = p1.offset(j + 4);
                    str_post4(
                        &mut *p.add(1),
                        &mut *p.add(0),
                        &mut *p.add(28),
                        &mut *p.add(29),
                    );
                    str_post4(
                        &mut *p.add(3),
                        &mut *p.add(2),
                        &mut *p.add(30),
                        &mut *p.add(31),
                    );
                    j += 32;
                }
            } else if left != 0 {
                if bottom == 0 {
                    str_post4(
                        &mut *p0.add(26),
                        &mut *p0.add(24),
                        &mut *p1.add(0),
                        &mut *p1.add(2),
                    );
                    str_post4(
                        &mut *p0.add(27),
                        &mut *p0.add(25),
                        &mut *p1.add(1),
                        &mut *p1.add(3),
                    );
                }
                str_post4(
                    &mut *p0.add(10),
                    &mut *p0.add(8),
                    &mut *p0.add(16),
                    &mut *p0.add(18),
                );
                str_post4(
                    &mut *p0.add(11),
                    &mut *p0.add(9),
                    &mut *p0.add(17),
                    &mut *p0.add(19),
                );
            }
        }

        i += 1;
    }

    let mut i = 0;
    while i < if cf_color_format == ColorFormat::Yuv422 {
        2
    } else {
        0
    } && t_scale < 16
    {
        let p0 = (*p_sc).p0MBbuffer[1 + i].map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);
        let p1 = (*p_sc).p1MBbuffer[1 + i].map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);
        let mut i_hpqp = 255;
        if b_hp_absent == 0 {
            let Some(p_qphp_base) = (*p_tile).pQuantizerHP[i] else {
                return Ok(());
            };
            i_hpqp = (*p_qphp_base.as_ptr().add((*p_sc).MBInfo.iQIndexHP as usize)).iQP;
        }

        // m_Dparam set during decoder init; C derefs pSC->m_Dparam unconditionally
        if bottom_or_right == 0
            && (*(*p_sc)
                .m_Dparam
                .expect("m_Dparam set during decoder init")
                .as_ptr())
            .cThumbnailScale
                < 16
        {
            *p1.add(0) -= (*p1.add(32) + 1) >> 1;
            *p1.add(32) += *p1.add(0);

            if (*p_sc).m_param.bScaledArith == 0 {
                str_dct2x2dn(
                    &mut *p1.add(0),
                    &mut *p1.add(64),
                    &mut *p1.add(16),
                    &mut *p1.add(80),
                );
                str_dct2x2dn(
                    &mut *p1.add(32),
                    &mut *p1.add(96),
                    &mut *p1.add(48),
                    &mut *p1.add(112),
                );
            } else {
                str_dct2x2dn_dec(
                    &mut *p1.add(0),
                    &mut *p1.add(64),
                    &mut *p1.add(16),
                    &mut *p1.add(80),
                );
                str_dct2x2dn_dec(
                    &mut *p1.add(32),
                    &mut *p1.add(96),
                    &mut *p1.add(48),
                    &mut *p1.add(112),
                );
            }
        }

        if ol_overlap == Overlap::Two {
            if bottom == 0 {
                if left_or_right != 0 {
                    if top == 0 {
                        let j = if left != 0 { 0 } else { -64 };
                        str_post2(&mut *p0.offset(48 + j), &mut *p1.offset(j));
                    }

                    let j = if left != 0 { 16 } else { -48 };
                    str_post2(&mut *p1.offset(j), &mut *p1.offset(j + 16));
                } else {
                    if top != 0 {
                        str_post2(&mut *p1.offset(-64), &mut *p1);
                    } else {
                        str_post2x2(
                            &mut *p0.offset(-16),
                            &mut *p0.add(48),
                            &mut *p1.offset(-64),
                            &mut *p1,
                        );
                    }
                    str_post2x2(
                        &mut *p1.offset(-48),
                        &mut *p1.add(16),
                        &mut *p1.offset(-32),
                        &mut *p1.add(32),
                    );
                }
            } else if left_or_right == 0 {
                str_post2(&mut *p0.offset(-16), &mut *p0.add(48));
            }
        }

        if t_scale >= 4 {
            i += 1;
            continue;
        }

        if top == 0 {
            let mut j = if left != 0 { 48 } else { -16 };
            while j < if right != 0 { 48 } else { 112 } {
                str_idct4x4_stage1(std::slice::from_raw_parts_mut(p0.offset(j), 16));
                j += 64;
            }
        }

        if bottom == 0 {
            let mut j = if left != 0 { 0 } else { -64 };
            while j < if right != 0 { 0 } else { 64 } {
                str_idct4x4_stage1(std::slice::from_raw_parts_mut(p1.offset(j), 16));
                str_idct4x4_stage1(std::slice::from_raw_parts_mut(p1.offset(j + 16), 16));
                str_idct4x4_stage1(std::slice::from_raw_parts_mut(p1.offset(j + 32), 16));
                j += 64;
            }
        }

        if ol_overlap != Overlap::None {
            if top == 0 {
                if left_or_right != 0 {
                    let j = if left != 0 { 42 } else { -32 + 14 };
                    let p = p0.offset(j);
                    str_post4(
                        &mut *p.add(0),
                        &mut *p.offset(-2),
                        &mut *p.add(6),
                        &mut *p.add(8),
                    );
                    str_post4(
                        &mut *p.add(1),
                        &mut *p.offset(-1),
                        &mut *p.add(7),
                        &mut *p.add(9),
                    );
                }

                let mut j = if left != 0 { 0 } else { -128 };
                while j < if right != 0 { -64 } else { 0 } {
                    str_post4x4_stage1(p0.offset(j + 32), 0, i_hpqp, b_hp_absent);
                    j += 64;
                }
            }

            if bottom == 0 {
                if left_or_right != 0 {
                    let j = if left != 0 { 10 } else { -64 + 14 };
                    let mut p = p1.offset(j);
                    str_post4(
                        &mut *p.add(0),
                        &mut *p.offset(-2),
                        &mut *p.add(6),
                        &mut *p.add(8),
                    );
                    str_post4(
                        &mut *p.add(1),
                        &mut *p.offset(-1),
                        &mut *p.add(7),
                        &mut *p.add(9),
                    );

                    p = p.add(16);
                    str_post4(
                        &mut *p.add(0),
                        &mut *p.offset(-2),
                        &mut *p.add(6),
                        &mut *p.add(8),
                    );
                    str_post4(
                        &mut *p.add(1),
                        &mut *p.offset(-1),
                        &mut *p.add(7),
                        &mut *p.add(9),
                    );
                }

                let mut j = if left != 0 { 0 } else { -128 };
                while j < if right != 0 { -64 } else { 0 } {
                    str_post4x4_stage1(p1.offset(j), 0, i_hpqp, b_hp_absent);
                    str_post4x4_stage1(p1.offset(j + 16), 0, i_hpqp, b_hp_absent);
                    j += 64;
                }
            }

            if top_or_bottom != 0 {
                let p = if top != 0 { p1.add(5) } else { p0.add(48 + 13) };
                let mut j = if left != 0 { 0 } else { -128 };
                while j < if right != 0 { -64 } else { 0 } {
                    str_post4(
                        &mut *p.offset(j),
                        &mut *p.offset(j - 1),
                        &mut *p.offset(j + 59),
                        &mut *p.offset(j + 60),
                    );
                    str_post4(
                        &mut *p.offset(j + 2),
                        &mut *p.offset(j + 1),
                        &mut *p.offset(j + 61),
                        &mut *p.offset(j + 62),
                    );
                    j += 64;
                }
            } else {
                if left_or_right != 0 {
                    let j = if left != 0 { 0 } else { -64 + 4 };
                    str_post4(
                        &mut *p0.offset(j + 48 + 10),
                        &mut *p0.offset(j + 48 + 10 - 2),
                        &mut *p1.offset(j),
                        &mut *p1.offset(j + 2),
                    );
                    str_post4(
                        &mut *p0.offset(j + 48 + 10 + 1),
                        &mut *p0.offset(j + 48 + 10 - 1),
                        &mut *p1.offset(j + 1),
                        &mut *p1.offset(j + 3),
                    );
                }

                let mut j = if left != 0 { 0 } else { -128 };
                while j < if right != 0 { -64 } else { 0 } {
                    str_post4x4_stage1_split(
                        p0.offset(j + 48),
                        p1.offset(j),
                        0,
                        i_hpqp,
                        b_hp_absent,
                    );
                    j += 64;
                }
            }
        }

        i += 1;
    }

    Ok(())
}

/// Original function: `invTransformMacroblock_alteredOperators_hard` at `original/jxrlib/image/decode/strInvTransform.c:1169`.
pub unsafe fn inv_transform_macroblock_altered_operators_hard(
    p_sc: &mut CWMImageStrCodec,
) -> Result<(), WmpError> {
    let p_sc = p_sc as *mut CWMImageStrCodec;
    let ol_overlap = (*p_sc).WMISCP.olOverlap;
    let cf_color_format = (*p_sc).m_param.cfColorFormat;
    let left = ((*p_sc).cColumn == 0) as i32;
    let right = ((*p_sc).cColumn == (*p_sc).cmbWidth) as i32;
    let top = ((*p_sc).cRow == 0) as i32;
    let bottom = ((*p_sc).cRow == (*p_sc).cmbHeight) as i32;
    let top_or_bottom = ((top != 0) || (bottom != 0)) as i32;
    let left_or_right = ((left != 0) || (right != 0)) as i32;
    let top_or_left = ((top != 0) || (left != 0)) as i32;
    let bottom_or_right = ((bottom != 0) || (right != 0)) as i32;
    let left_adjacent_column = ((*p_sc).cColumn == 1) as i32;
    let right_adjacent_column = ((*p_sc).cColumn == (*p_sc).cmbWidth - 1) as i32;
    let mb_width = (*p_sc).cmbWidth;
    let i_channels =
        if cf_color_format == ColorFormat::Yuv420 || cf_color_format == ColorFormat::Yuv422 {
            1
        } else {
            (*p_sc).m_param.cNumChannels
        };
    // m_Dparam set during decoder init; C derefs pSC->m_Dparam unconditionally
    let t_scale = (*(*p_sc)
        .m_Dparam
        .expect("m_Dparam set during decoder init")
        .as_ptr())
    .cThumbnailScale;
    let mut qp = [0 as i32; MAX_CHANNELS];
    let mut dcqp = [0 as i32; MAX_CHANNELS];
    let i_strength = 1 << (*p_sc).WMII.cPostProcStrength;
    let Some(tile) = (*p_sc)
        .pTileMemory
        .as_deref_mut()
        .and_then(|tiles| tiles.get_mut((*p_sc).cTileColumn))
    else {
        return Ok(());
    };
    let p_tile = tile as *mut CWMITile;

    if (*p_sc).WMISCP.bUseHardTileBoundaries != 0 {
        if (*p_sc).cColumn == 0 {
            (*p_sc).bVertTileBoundary = 0;
            (*p_sc).tileX = 0;
        }
        (*p_sc).bOneMBLeftVertTB = 0;
        (*p_sc).bOneMBRightVertTB = 0;
        if (*p_sc).tileX > 0
            && (*p_sc).tileX <= (*p_sc).WMISCP.cNumOfSliceMinus1V as usize
            && (*p_sc).cColumn - 1 == (*p_sc).WMISCP.uiTileX[(*p_sc).tileX] as usize
        {
            (*p_sc).bOneMBRightVertTB = 1;
        }
        if (*p_sc).tileX < (*p_sc).WMISCP.cNumOfSliceMinus1V as usize
            && (*p_sc).cColumn == (*p_sc).WMISCP.uiTileX[(*p_sc).tileX + 1] as usize
        {
            (*p_sc).bVertTileBoundary = 1;
            (*p_sc).tileX += 1;
        } else {
            (*p_sc).bVertTileBoundary = 0;
        }
        if (*p_sc).tileX < (*p_sc).WMISCP.cNumOfSliceMinus1V as usize
            && (*p_sc).cColumn + 1 == (*p_sc).WMISCP.uiTileX[(*p_sc).tileX + 1] as usize
        {
            (*p_sc).bOneMBLeftVertTB = 1;
        }

        if (*p_sc).cRow == 0 {
            (*p_sc).bHoriTileBoundary = 0;
            (*p_sc).tileY = 0;
        } else if (*p_sc).mbY != (*p_sc).cRow
            && (*p_sc).tileY < (*p_sc).WMISCP.cNumOfSliceMinus1H as usize
            && (*p_sc).cRow == (*p_sc).WMISCP.uiTileY[(*p_sc).tileY + 1] as usize
        {
            (*p_sc).bHoriTileBoundary = 1;
            (*p_sc).tileY += 1;
        } else if (*p_sc).mbY != (*p_sc).cRow {
            (*p_sc).bHoriTileBoundary = 0;
        }
    } else {
        (*p_sc).bVertTileBoundary = 0;
        (*p_sc).bHoriTileBoundary = 0;
        (*p_sc).bOneMBLeftVertTB = 0;
        (*p_sc).bOneMBRightVertTB = 0;
    }
    (*p_sc).mbX = (*p_sc).cColumn;
    (*p_sc).mbY = (*p_sc).cRow;
    let mb_x = (*p_sc).mbX;

    if (*p_sc).WMII.cPostProcStrength > 0 {
        let mut i = 0;
        while i < i_channels {
            let Some(p_qplp_base) = (*p_tile).pQuantizerLP[i] else {
                return Ok(());
            };
            let p_qplp = p_qplp_base.as_ptr().add((*p_sc).MBInfo.iQIndexLP as usize);
            qp[i] = (*p_qplp).iQP * i_strength * if ol_overlap == Overlap::None { 2 } else { 1 };
            let Some(p_qpdc) = (*p_tile).pQuantizerDC[i] else {
                return Ok(());
            };
            dcqp[i] = (*p_qpdc.as_ptr()).iQP * i_strength;
            i += 1;
        }

        if left != 0 {
            slide_one_mb_row(
                &mut (*p_sc).pPostProcInfo,
                &mut (*p_sc).pPostProcInfoMemory,
                (*p_sc).m_param.cNumChannels,
                mb_width,
                top != 0,
                bottom != 0,
            );
        }
    }

    let mut i = 0;
    while i < i_channels && t_scale < 16 {
        let p0 = (*p_sc).p0MBbuffer[i].map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);
        let p1 = (*p_sc).p1MBbuffer[i].map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);

        if bottom_or_right == 0 {
            if (*p_sc).WMII.cPostProcStrength > 0 {
                update_post_proc_info(
                    &mut (*p_sc).pPostProcInfoMemory,
                    std::slice::from_raw_parts(p1, 256),
                    mb_x,
                    i,
                );
            }

            str_idct4x4_stage2(std::slice::from_raw_parts_mut(p1, 256));
            if (*p_sc).m_param.bScaledArith != 0 {
                str_normalize_dec(std::slice::from_raw_parts_mut(p1, 256), (i != 0) as i32);
            }
        }

        if ol_overlap == Overlap::Two {
            if (top != 0 || (*p_sc).bHoriTileBoundary != 0)
                && (left != 0 || (*p_sc).bVertTileBoundary != 0)
            {
                str_post4_alternate(
                    &mut *p1,
                    &mut *p1.add(64),
                    &mut *p1.add(16),
                    &mut *p1.add(64 + 16),
                );
            }
            if (top != 0 || (*p_sc).bHoriTileBoundary != 0)
                && (right != 0 || (*p_sc).bVertTileBoundary != 0)
            {
                str_post4_alternate(
                    &mut *p1.offset(-128),
                    &mut *p1.offset(-64),
                    &mut *p1.offset(-128 + 16),
                    &mut *p1.offset(-64 + 16),
                );
            }
            if (bottom != 0 || (*p_sc).bHoriTileBoundary != 0)
                && (left != 0 || (*p_sc).bVertTileBoundary != 0)
            {
                str_post4_alternate(
                    &mut *p0.add(32),
                    &mut *p0.add(96),
                    &mut *p0.add(32 + 16),
                    &mut *p0.add(96 + 16),
                );
            }
            if (bottom != 0 || (*p_sc).bHoriTileBoundary != 0)
                && (right != 0 || (*p_sc).bVertTileBoundary != 0)
            {
                str_post4_alternate(
                    &mut *p0.offset(-96),
                    &mut *p0.offset(-32),
                    &mut *p0.offset(-96 + 16),
                    &mut *p0.offset(-32 + 16),
                );
            }

            if (left_or_right != 0 || (*p_sc).bVertTileBoundary != 0)
                && top_or_bottom == 0
                && (*p_sc).bHoriTileBoundary == 0
            {
                if left != 0 || (*p_sc).bVertTileBoundary != 0 {
                    let j = 0;
                    str_post4_alternate(
                        &mut *p0.offset(j + 32),
                        &mut *p0.offset(j + 48),
                        &mut *p1.offset(j),
                        &mut *p1.offset(j + 16),
                    );
                    str_post4_alternate(
                        &mut *p0.offset(j + 96),
                        &mut *p0.offset(j + 112),
                        &mut *p1.offset(j + 64),
                        &mut *p1.offset(j + 80),
                    );
                }
                if right != 0 || (*p_sc).bVertTileBoundary != 0 {
                    let j = -128;
                    str_post4_alternate(
                        &mut *p0.offset(j + 32),
                        &mut *p0.offset(j + 48),
                        &mut *p1.offset(j),
                        &mut *p1.offset(j + 16),
                    );
                    str_post4_alternate(
                        &mut *p0.offset(j + 96),
                        &mut *p0.offset(j + 112),
                        &mut *p1.offset(j + 64),
                        &mut *p1.offset(j + 80),
                    );
                }
            }

            if left_or_right == 0 {
                if (top_or_bottom != 0 || (*p_sc).bHoriTileBoundary != 0)
                    && (*p_sc).bVertTileBoundary == 0
                {
                    if top != 0 || (*p_sc).bHoriTileBoundary != 0 {
                        let p = p1;
                        str_post4_alternate(
                            &mut *p.offset(-128),
                            &mut *p.offset(-64),
                            &mut *p.add(0),
                            &mut *p.add(64),
                        );
                        str_post4_alternate(
                            &mut *p.offset(-112),
                            &mut *p.offset(-48),
                            &mut *p.add(16),
                            &mut *p.add(80),
                        );
                    }
                    if bottom != 0 || (*p_sc).bHoriTileBoundary != 0 {
                        let p = p0.add(32);
                        str_post4_alternate(
                            &mut *p.offset(-128),
                            &mut *p.offset(-64),
                            &mut *p.add(0),
                            &mut *p.add(64),
                        );
                        str_post4_alternate(
                            &mut *p.offset(-112),
                            &mut *p.offset(-48),
                            &mut *p.add(16),
                            &mut *p.add(80),
                        );
                    }
                }

                if top_or_bottom == 0
                    && (*p_sc).bHoriTileBoundary == 0
                    && (*p_sc).bVertTileBoundary == 0
                {
                    str_post4x4_stage2_split_alternate(p0, p1);
                }
            }
        }

        if (*p_sc).WMII.cPostProcStrength > 0 {
            post_proc_mb(&mut (*p_sc).pPostProcInfoMemory, p0, p1, mb_x, i, dcqp[i]);
        }

        if t_scale >= 4 {
            i += 1;
            continue;
        }

        if top == 0 {
            let mut j = if left != 0 { 32 } else { -96 };
            while j < if right != 0 { 32 } else { 160 } {
                str_idct4x4_stage1(std::slice::from_raw_parts_mut(p0.offset(j), 16));
                str_idct4x4_stage1(std::slice::from_raw_parts_mut(p0.offset(j + 16), 16));
                j += 64;
            }
        }

        if bottom == 0 {
            let mut j = if left != 0 { 0 } else { -128 };
            while j < if right != 0 { 0 } else { 128 } {
                str_idct4x4_stage1(std::slice::from_raw_parts_mut(p1.offset(j), 16));
                str_idct4x4_stage1(std::slice::from_raw_parts_mut(p1.offset(j + 16), 16));
                j += 64;
            }
        }

        if ol_overlap != Overlap::None {
            if left_or_right != 0 || (*p_sc).bVertTileBoundary != 0 {
                if (top != 0 || (*p_sc).bHoriTileBoundary != 0)
                    && (left != 0 || (*p_sc).bVertTileBoundary != 0)
                {
                    str_post4_alternate(
                        &mut *p1,
                        &mut *p1.add(1),
                        &mut *p1.add(2),
                        &mut *p1.add(3),
                    );
                }
                if (top != 0 || (*p_sc).bHoriTileBoundary != 0)
                    && (right != 0 || (*p_sc).bVertTileBoundary != 0)
                {
                    str_post4_alternate(
                        &mut *p1.offset(-59),
                        &mut *p1.offset(-60),
                        &mut *p1.offset(-57),
                        &mut *p1.offset(-58),
                    );
                }
                if (bottom != 0 || (*p_sc).bHoriTileBoundary != 0)
                    && (left != 0 || (*p_sc).bVertTileBoundary != 0)
                {
                    str_post4_alternate(
                        &mut *p0.add(48 + 10),
                        &mut *p0.add(48 + 11),
                        &mut *p0.add(48 + 8),
                        &mut *p0.add(48 + 9),
                    );
                }
                if (bottom != 0 || (*p_sc).bHoriTileBoundary != 0)
                    && (right != 0 || (*p_sc).bVertTileBoundary != 0)
                {
                    str_post4_alternate(
                        &mut *p0.offset(-1),
                        &mut *p0.offset(-2),
                        &mut *p0.offset(-3),
                        &mut *p0.offset(-4),
                    );
                }
                if left != 0 || (*p_sc).bVertTileBoundary != 0 {
                    let j = 10;
                    if top == 0 {
                        let p = p0.offset(16 + j);
                        str_post4_alternate(
                            &mut *p.add(0),
                            &mut *p.offset(-2),
                            &mut *p.add(6),
                            &mut *p.add(8),
                        );
                        str_post4_alternate(
                            &mut *p.add(1),
                            &mut *p.offset(-1),
                            &mut *p.add(7),
                            &mut *p.add(9),
                        );
                        str_post4_alternate(
                            &mut *p.add(16),
                            &mut *p.add(14),
                            &mut *p.add(22),
                            &mut *p.add(24),
                        );
                        str_post4_alternate(
                            &mut *p.add(17),
                            &mut *p.add(15),
                            &mut *p.add(23),
                            &mut *p.add(25),
                        );
                    }
                    if bottom == 0 {
                        let p = p1.offset(j);
                        str_post4_alternate(
                            &mut *p.add(0),
                            &mut *p.offset(-2),
                            &mut *p.add(6),
                            &mut *p.add(8),
                        );
                        str_post4_alternate(
                            &mut *p.add(1),
                            &mut *p.offset(-1),
                            &mut *p.add(7),
                            &mut *p.add(9),
                        );
                    }
                    if top_or_bottom == 0 && (*p_sc).bHoriTileBoundary == 0 {
                        str_post4_alternate(
                            &mut *p0.offset(48 + j),
                            &mut *p0.offset(48 + j - 2),
                            &mut *p1.offset(-10 + j),
                            &mut *p1.offset(-8 + j),
                        );
                        str_post4_alternate(
                            &mut *p0.offset(48 + j + 1),
                            &mut *p0.offset(48 + j - 1),
                            &mut *p1.offset(-9 + j),
                            &mut *p1.offset(-7 + j),
                        );
                    }
                }
                if right != 0 || (*p_sc).bVertTileBoundary != 0 {
                    let j = -64 + 14;
                    if top == 0 {
                        let p = p0.offset(16 + j);
                        str_post4_alternate(
                            &mut *p.add(0),
                            &mut *p.offset(-2),
                            &mut *p.add(6),
                            &mut *p.add(8),
                        );
                        str_post4_alternate(
                            &mut *p.add(1),
                            &mut *p.offset(-1),
                            &mut *p.add(7),
                            &mut *p.add(9),
                        );
                        str_post4_alternate(
                            &mut *p.add(16),
                            &mut *p.add(14),
                            &mut *p.add(22),
                            &mut *p.add(24),
                        );
                        str_post4_alternate(
                            &mut *p.add(17),
                            &mut *p.add(15),
                            &mut *p.add(23),
                            &mut *p.add(25),
                        );
                    }
                    if bottom == 0 {
                        let p = p1.offset(j);
                        str_post4_alternate(
                            &mut *p.add(0),
                            &mut *p.offset(-2),
                            &mut *p.add(6),
                            &mut *p.add(8),
                        );
                        str_post4_alternate(
                            &mut *p.add(1),
                            &mut *p.offset(-1),
                            &mut *p.add(7),
                            &mut *p.add(9),
                        );
                    }
                    if top_or_bottom == 0 && (*p_sc).bHoriTileBoundary == 0 {
                        str_post4_alternate(
                            &mut *p0.offset(48 + j),
                            &mut *p0.offset(48 + j - 2),
                            &mut *p1.offset(-10 + j),
                            &mut *p1.offset(-8 + j),
                        );
                        str_post4_alternate(
                            &mut *p0.offset(48 + j + 1),
                            &mut *p0.offset(48 + j - 1),
                            &mut *p1.offset(-9 + j),
                            &mut *p1.offset(-7 + j),
                        );
                    }
                }
            }

            if top != 0 || (*p_sc).bHoriTileBoundary != 0 {
                let mut j = if left != 0 { 0 } else { -192 };
                while j < if right != 0 { -64 } else { 64 } {
                    if (*p_sc).bVertTileBoundary == 0 || j != -64 {
                        let p = p1.offset(j);
                        str_post4_alternate(
                            &mut *p.add(5),
                            &mut *p.add(4),
                            &mut *p.add(64),
                            &mut *p.add(65),
                        );
                        str_post4_alternate(
                            &mut *p.add(7),
                            &mut *p.add(6),
                            &mut *p.add(66),
                            &mut *p.add(67),
                        );
                        str_post4x4_stage1_alternate(p1.offset(j), 0);
                    }
                    j += 64;
                }
            }

            if bottom != 0 || (*p_sc).bHoriTileBoundary != 0 {
                let mut j = if left != 0 { 0 } else { -192 };
                while j < if right != 0 { -64 } else { 64 } {
                    if (*p_sc).bVertTileBoundary == 0 || j != -64 {
                        str_post4x4_stage1_alternate(p0.offset(16 + j), 0);
                        str_post4x4_stage1_alternate(p0.offset(32 + j), 0);
                        let p = p0.offset(48 + j);
                        str_post4_alternate(
                            &mut *p.add(15),
                            &mut *p.add(14),
                            &mut *p.add(74),
                            &mut *p.add(75),
                        );
                        str_post4_alternate(
                            &mut *p.add(13),
                            &mut *p.add(12),
                            &mut *p.add(72),
                            &mut *p.add(73),
                        );
                    }
                    j += 64;
                }
            }

            if top == 0 && bottom == 0 && (*p_sc).bHoriTileBoundary == 0 {
                let mut j = if left != 0 { 0 } else { -192 };
                while j < if right != 0 { -64 } else { 64 } {
                    if (*p_sc).bVertTileBoundary == 0 || j != -64 {
                        str_post4x4_stage1_alternate(p0.offset(16 + j), 0);
                        str_post4x4_stage1_alternate(p0.offset(32 + j), 0);
                        str_post4x4_stage1_split_alternate(p0.offset(48 + j), p1.offset(j), 0);
                        str_post4x4_stage1_alternate(p1.offset(j), 0);
                    }
                    j += 64;
                }
            }
        }

        if (*p_sc).WMII.cPostProcStrength > 0 && top_or_left == 0 {
            post_proc_block(&(*p_sc).pPostProcInfoMemory, p0, p1, mb_x, i, qp[i]);
        }

        i += 1;
    }

    let mut i = 0;
    while i < if cf_color_format == ColorFormat::Yuv420 {
        2
    } else {
        0
    } && t_scale < 16
    {
        let p0 = (*p_sc).p0MBbuffer[1 + i].map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);
        let p1 = (*p_sc).p1MBbuffer[1 + i].map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);

        if bottom_or_right == 0 {
            if (*p_sc).m_param.bScaledArith == 0 {
                str_dct2x2dn(
                    &mut *p1,
                    &mut *p1.add(32),
                    &mut *p1.add(16),
                    &mut *p1.add(48),
                );
            } else {
                str_dct2x2dn_dec(
                    &mut *p1,
                    &mut *p1.add(32),
                    &mut *p1.add(16),
                    &mut *p1.add(48),
                );
            }
        }

        if ol_overlap == Overlap::Two {
            if (left_adjacent_column != 0 || (*p_sc).bOneMBRightVertTB != 0)
                && (top != 0 || (*p_sc).bHoriTileBoundary != 0)
            {
                *p1.offset(-64) -= *p1.offset(-64 + 32);
            }
            if (right_adjacent_column != 0 || (*p_sc).bOneMBLeftVertTB != 0)
                && (top != 0 || (*p_sc).bHoriTileBoundary != 0)
            {
                (*p_sc).iPredBefore[i][0] = *p1;
            }
            if (right != 0 || (*p_sc).bVertTileBoundary != 0)
                && (top != 0 || (*p_sc).bHoriTileBoundary != 0)
            {
                *p1.offset(-64 + 32) -= (*p_sc).iPredBefore[i][0];
            }
            if (left_adjacent_column != 0 || (*p_sc).bOneMBRightVertTB != 0)
                && (bottom != 0 || (*p_sc).bHoriTileBoundary != 0)
            {
                *p0.offset(-64 + 16) -= *p0.offset(-64 + 48);
            }
            if (right_adjacent_column != 0 || (*p_sc).bOneMBLeftVertTB != 0)
                && (bottom != 0 || (*p_sc).bHoriTileBoundary != 0)
            {
                (*p_sc).iPredBefore[i][1] = *p0.add(16);
            }
            if (right != 0 || (*p_sc).bVertTileBoundary != 0)
                && (bottom != 0 || (*p_sc).bHoriTileBoundary != 0)
            {
                *p0.offset(-64 + 48) -= (*p_sc).iPredBefore[i][1];
            }

            if (left_or_right != 0 || (*p_sc).bVertTileBoundary != 0)
                && top_or_bottom == 0
                && (*p_sc).bHoriTileBoundary == 0
            {
                if left != 0 || (*p_sc).bVertTileBoundary != 0 {
                    str_post2_alternate(&mut *p0.add(16), &mut *p1);
                }
                if right != 0 || (*p_sc).bVertTileBoundary != 0 {
                    str_post2_alternate(&mut *p0.offset(-32 + 16), &mut *p1.offset(-32));
                }
            }

            if left_or_right == 0 {
                if (top_or_bottom != 0 || (*p_sc).bHoriTileBoundary != 0)
                    && (*p_sc).bVertTileBoundary == 0
                {
                    if top != 0 || (*p_sc).bHoriTileBoundary != 0 {
                        str_post2_alternate(&mut *p1.offset(-32), &mut *p1);
                    }
                    if bottom != 0 || (*p_sc).bHoriTileBoundary != 0 {
                        str_post2_alternate(&mut *p0.offset(16 - 32), &mut *p0.add(16));
                    }
                } else if top_or_bottom == 0
                    && (*p_sc).bHoriTileBoundary == 0
                    && (*p_sc).bVertTileBoundary == 0
                {
                    str_post2x2_alternate(
                        &mut *p0.offset(-16),
                        &mut *p0.add(16),
                        &mut *p1.offset(-32),
                        &mut *p1,
                    );
                }
            }

            if (left_adjacent_column != 0 || (*p_sc).bOneMBRightVertTB != 0)
                && (top != 0 || (*p_sc).bHoriTileBoundary != 0)
            {
                *p1.offset(-64) += *p1.offset(-64 + 32);
            }
            if (right_adjacent_column != 0 || (*p_sc).bOneMBLeftVertTB != 0)
                && (top != 0 || (*p_sc).bHoriTileBoundary != 0)
            {
                (*p_sc).iPredAfter[i][0] = *p1;
            }
            if (right != 0 || (*p_sc).bVertTileBoundary != 0)
                && (top != 0 || (*p_sc).bHoriTileBoundary != 0)
            {
                *p1.offset(-64 + 32) += (*p_sc).iPredAfter[i][0];
            }
            if (left_adjacent_column != 0 || (*p_sc).bOneMBRightVertTB != 0)
                && (bottom != 0 || (*p_sc).bHoriTileBoundary != 0)
            {
                *p0.offset(-64 + 16) += *p0.offset(-64 + 48);
            }
            if (right_adjacent_column != 0 || (*p_sc).bOneMBLeftVertTB != 0)
                && (bottom != 0 || (*p_sc).bHoriTileBoundary != 0)
            {
                (*p_sc).iPredAfter[i][1] = *p0.add(16);
            }
            if (right != 0 || (*p_sc).bVertTileBoundary != 0)
                && (bottom != 0 || (*p_sc).bHoriTileBoundary != 0)
            {
                *p0.offset(-64 + 48) += (*p_sc).iPredAfter[i][1];
            }
        }

        if t_scale >= 4 {
            i += 1;
            continue;
        }

        if top == 0 {
            let mut j = if left != 0 {
                48
            } else if left_adjacent_column != 0 || (*p_sc).bOneMBRightVertTB != 0 {
                -48
            } else {
                -16
            };
            while j < if right != 0 || (*p_sc).bVertTileBoundary != 0 {
                16
            } else {
                48
            } {
                str_idct4x4_stage1(std::slice::from_raw_parts_mut(p0.offset(j), 16));
                j += 32;
            }
        }

        if bottom == 0 {
            let mut j = if left != 0 {
                32
            } else if left_adjacent_column != 0 || (*p_sc).bOneMBRightVertTB != 0 {
                -64
            } else {
                -32
            };
            while j < if right != 0 || (*p_sc).bVertTileBoundary != 0 {
                0
            } else {
                32
            } {
                str_idct4x4_stage1(std::slice::from_raw_parts_mut(p1.offset(j), 16));
                j += 32;
            }
        }

        if ol_overlap != Overlap::None {
            if (top != 0 || (*p_sc).bHoriTileBoundary != 0)
                && (left_adjacent_column != 0 || (*p_sc).bOneMBRightVertTB != 0)
            {
                str_post4_alternate(
                    &mut *p1.offset(-64),
                    &mut *p1.offset(-64 + 1),
                    &mut *p1.offset(-64 + 2),
                    &mut *p1.offset(-64 + 3),
                );
            }
            if (top != 0 || (*p_sc).bHoriTileBoundary != 0)
                && (right != 0 || (*p_sc).bVertTileBoundary != 0)
            {
                str_post4_alternate(
                    &mut *p1.offset(-27),
                    &mut *p1.offset(-28),
                    &mut *p1.offset(-25),
                    &mut *p1.offset(-26),
                );
            }
            if (bottom != 0 || (*p_sc).bHoriTileBoundary != 0)
                && (left_adjacent_column != 0 || (*p_sc).bOneMBRightVertTB != 0)
            {
                str_post4_alternate(
                    &mut *p0.offset(-64 + 16 + 10),
                    &mut *p0.offset(-64 + 16 + 11),
                    &mut *p0.offset(-64 + 16 + 8),
                    &mut *p0.offset(-64 + 16 + 9),
                );
            }
            if (bottom != 0 || (*p_sc).bHoriTileBoundary != 0)
                && (right != 0 || (*p_sc).bVertTileBoundary != 0)
            {
                str_post4_alternate(
                    &mut *p0.offset(-1),
                    &mut *p0.offset(-2),
                    &mut *p0.offset(-3),
                    &mut *p0.offset(-4),
                );
            }
            if left == 0 && top == 0 {
                if left_adjacent_column != 0 || (*p_sc).bOneMBRightVertTB != 0 {
                    if bottom == 0 && (*p_sc).bHoriTileBoundary == 0 {
                        str_post4_alternate(
                            &mut *p0.offset(-64 + 26),
                            &mut *p0.offset(-64 + 24),
                            &mut *p1.offset(-64),
                            &mut *p1.offset(-64 + 2),
                        );
                        str_post4_alternate(
                            &mut *p0.offset(-64 + 27),
                            &mut *p0.offset(-64 + 25),
                            &mut *p1.offset(-64 + 1),
                            &mut *p1.offset(-64 + 3),
                        );
                    }
                    str_post4_alternate(
                        &mut *p0.offset(-64 + 10),
                        &mut *p0.offset(-64 + 8),
                        &mut *p0.offset(-64 + 16),
                        &mut *p0.offset(-64 + 18),
                    );
                    str_post4_alternate(
                        &mut *p0.offset(-64 + 11),
                        &mut *p0.offset(-64 + 9),
                        &mut *p0.offset(-64 + 17),
                        &mut *p0.offset(-64 + 19),
                    );
                }
                if bottom != 0 || (*p_sc).bHoriTileBoundary != 0 {
                    let p = p0.offset(-48);
                    str_post4_alternate(
                        &mut *p.add(15),
                        &mut *p.add(14),
                        &mut *p.add(42),
                        &mut *p.add(43),
                    );
                    str_post4_alternate(
                        &mut *p.add(13),
                        &mut *p.add(12),
                        &mut *p.add(40),
                        &mut *p.add(41),
                    );
                    if right == 0 && (*p_sc).bVertTileBoundary == 0 {
                        let p = p0.offset(-16);
                        str_post4_alternate(
                            &mut *p.add(15),
                            &mut *p.add(14),
                            &mut *p.add(42),
                            &mut *p.add(43),
                        );
                        str_post4_alternate(
                            &mut *p.add(13),
                            &mut *p.add(12),
                            &mut *p.add(40),
                            &mut *p.add(41),
                        );
                    }
                } else {
                    str_post4x4_stage1_split_alternate(p0.offset(-48), p1.offset(-16 - 48), 32);
                    if right == 0 && (*p_sc).bVertTileBoundary == 0 {
                        str_post4x4_stage1_split_alternate(p0.offset(-16), p1.offset(-16 - 16), 32);
                    }
                }

                if right != 0 || (*p_sc).bVertTileBoundary != 0 {
                    if bottom == 0 && (*p_sc).bHoriTileBoundary == 0 {
                        str_post4_alternate(
                            &mut *p0.offset(-2),
                            &mut *p0.offset(-4),
                            &mut *p1.offset(-28),
                            &mut *p1.offset(-26),
                        );
                        str_post4_alternate(
                            &mut *p0.offset(-1),
                            &mut *p0.offset(-3),
                            &mut *p1.offset(-27),
                            &mut *p1.offset(-25),
                        );
                    }
                    str_post4_alternate(
                        &mut *p0.offset(-18),
                        &mut *p0.offset(-20),
                        &mut *p0.offset(-12),
                        &mut *p0.offset(-10),
                    );
                    str_post4_alternate(
                        &mut *p0.offset(-17),
                        &mut *p0.offset(-19),
                        &mut *p0.offset(-11),
                        &mut *p0.offset(-9),
                    );
                } else {
                    str_post4x4_stage1_alternate(p0.offset(-32), 32);
                }
                str_post4x4_stage1_alternate(p0.offset(-64), 32);
            }

            if top != 0 || (*p_sc).bHoriTileBoundary != 0 {
                if left == 0 {
                    let p = p1.offset(-64 + 4);
                    str_post4_alternate(
                        &mut *p.add(1),
                        &mut *p.add(0),
                        &mut *p.add(28),
                        &mut *p.add(29),
                    );
                    str_post4_alternate(
                        &mut *p.add(3),
                        &mut *p.add(2),
                        &mut *p.add(30),
                        &mut *p.add(31),
                    );
                }
                if left == 0 && right == 0 && (*p_sc).bVertTileBoundary == 0 {
                    let p = p1.offset(-32 + 4);
                    str_post4_alternate(
                        &mut *p.add(1),
                        &mut *p.add(0),
                        &mut *p.add(28),
                        &mut *p.add(29),
                    );
                    str_post4_alternate(
                        &mut *p.add(3),
                        &mut *p.add(2),
                        &mut *p.add(30),
                        &mut *p.add(31),
                    );
                }
            }
        }

        i += 1;
    }

    let mut i = 0;
    while i < if cf_color_format == ColorFormat::Yuv422 {
        2
    } else {
        0
    } && t_scale < 16
    {
        let p0 = (*p_sc).p0MBbuffer[1 + i].map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);
        let p1 = (*p_sc).p1MBbuffer[1 + i].map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);

        // m_Dparam set during decoder init; C derefs pSC->m_Dparam unconditionally
        if bottom_or_right == 0
            && (*(*p_sc)
                .m_Dparam
                .expect("m_Dparam set during decoder init")
                .as_ptr())
            .cThumbnailScale
                < 16
        {
            *p1 -= (*p1.add(32) + 1) >> 1;
            *p1.add(32) += *p1;

            if (*p_sc).m_param.bScaledArith == 0 {
                str_dct2x2dn(
                    &mut *p1,
                    &mut *p1.add(64),
                    &mut *p1.add(16),
                    &mut *p1.add(80),
                );
                str_dct2x2dn(
                    &mut *p1.add(32),
                    &mut *p1.add(96),
                    &mut *p1.add(48),
                    &mut *p1.add(112),
                );
            } else {
                str_dct2x2dn_dec(
                    &mut *p1,
                    &mut *p1.add(64),
                    &mut *p1.add(16),
                    &mut *p1.add(80),
                );
                str_dct2x2dn_dec(
                    &mut *p1.add(32),
                    &mut *p1.add(96),
                    &mut *p1.add(48),
                    &mut *p1.add(112),
                );
            }
        }

        if ol_overlap == Overlap::Two {
            if (left_adjacent_column != 0 || (*p_sc).bOneMBRightVertTB != 0)
                && (top != 0 || (*p_sc).bHoriTileBoundary != 0)
            {
                *p1.offset(-128) -= *p1.offset(-128 + 64);
            }
            if (right_adjacent_column != 0 || (*p_sc).bOneMBLeftVertTB != 0)
                && (top != 0 || (*p_sc).bHoriTileBoundary != 0)
            {
                (*p_sc).iPredBefore[i][0] = *p1;
            }
            if (right != 0 || (*p_sc).bVertTileBoundary != 0)
                && (top != 0 || (*p_sc).bHoriTileBoundary != 0)
            {
                *p1.offset(-128 + 64) -= (*p_sc).iPredBefore[i][0];
            }
            if (left_adjacent_column != 0 || (*p_sc).bOneMBRightVertTB != 0)
                && (bottom != 0 || (*p_sc).bHoriTileBoundary != 0)
            {
                *p0.offset(-128 + 48) -= *p0.offset(-128 + 112);
            }
            if (right_adjacent_column != 0 || (*p_sc).bOneMBLeftVertTB != 0)
                && (bottom != 0 || (*p_sc).bHoriTileBoundary != 0)
            {
                (*p_sc).iPredBefore[i][1] = *p0.add(48);
            }
            if (right != 0 || (*p_sc).bVertTileBoundary != 0)
                && (bottom != 0 || (*p_sc).bHoriTileBoundary != 0)
            {
                *p0.offset(-128 + 112) -= (*p_sc).iPredBefore[i][1];
            }

            if bottom == 0 {
                if left_or_right != 0 || (*p_sc).bVertTileBoundary != 0 {
                    if top == 0 && (*p_sc).bHoriTileBoundary == 0 {
                        if left != 0 || (*p_sc).bVertTileBoundary != 0 {
                            str_post2_alternate(&mut *p0.add(48), &mut *p1);
                        }
                        if right != 0 || (*p_sc).bVertTileBoundary != 0 {
                            str_post2_alternate(&mut *p0.offset(48 - 64), &mut *p1.offset(-64));
                        }
                    }

                    if left != 0 || (*p_sc).bVertTileBoundary != 0 {
                        str_post2_alternate(&mut *p1.add(16), &mut *p1.add(32));
                    }
                    if right != 0 || (*p_sc).bVertTileBoundary != 0 {
                        str_post2_alternate(&mut *p1.offset(-48), &mut *p1.offset(-48 + 16));
                    }
                }

                if left_or_right == 0 && (*p_sc).bVertTileBoundary == 0 {
                    if top != 0 || (*p_sc).bHoriTileBoundary != 0 {
                        str_post2_alternate(&mut *p1.offset(-64), &mut *p1);
                    } else {
                        str_post2x2_alternate(
                            &mut *p0.offset(-16),
                            &mut *p0.add(48),
                            &mut *p1.offset(-64),
                            &mut *p1,
                        );
                    }
                    str_post2x2_alternate(
                        &mut *p1.offset(-48),
                        &mut *p1.add(16),
                        &mut *p1.offset(-32),
                        &mut *p1.add(32),
                    );
                }
            }

            if (bottom != 0 || (*p_sc).bHoriTileBoundary != 0)
                && left_or_right == 0
                && (*p_sc).bVertTileBoundary == 0
            {
                str_post2_alternate(&mut *p0.offset(-16), &mut *p0.add(48));
            }

            if (left_adjacent_column != 0 || (*p_sc).bOneMBRightVertTB != 0)
                && (top != 0 || (*p_sc).bHoriTileBoundary != 0)
            {
                *p1.offset(-128) += *p1.offset(-128 + 64);
            }
            if (right_adjacent_column != 0 || (*p_sc).bOneMBLeftVertTB != 0)
                && (top != 0 || (*p_sc).bHoriTileBoundary != 0)
            {
                (*p_sc).iPredAfter[i][0] = *p1;
            }
            if (right != 0 || (*p_sc).bVertTileBoundary != 0)
                && (top != 0 || (*p_sc).bHoriTileBoundary != 0)
            {
                *p1.offset(-128 + 64) += (*p_sc).iPredAfter[i][0];
            }
            if (left_adjacent_column != 0 || (*p_sc).bOneMBRightVertTB != 0)
                && (bottom != 0 || (*p_sc).bHoriTileBoundary != 0)
            {
                *p0.offset(-128 + 48) += *p0.offset(-128 + 112);
            }
            if (right_adjacent_column != 0 || (*p_sc).bOneMBLeftVertTB != 0)
                && (bottom != 0 || (*p_sc).bHoriTileBoundary != 0)
            {
                (*p_sc).iPredAfter[i][1] = *p0.add(48);
            }
            if (right != 0 || (*p_sc).bVertTileBoundary != 0)
                && (bottom != 0 || (*p_sc).bHoriTileBoundary != 0)
            {
                *p0.offset(-128 + 112) += (*p_sc).iPredAfter[i][1];
            }
        }

        if t_scale >= 4 {
            i += 1;
            continue;
        }

        if top == 0 {
            let mut j = if left != 0 {
                112
            } else if left_adjacent_column != 0 || (*p_sc).bOneMBRightVertTB != 0 {
                -80
            } else {
                -16
            };
            while j < if right != 0 || (*p_sc).bVertTileBoundary != 0 {
                48
            } else {
                112
            } {
                str_idct4x4_stage1(std::slice::from_raw_parts_mut(p0.offset(j), 16));
                j += 64;
            }
        }

        if bottom == 0 {
            let mut j = if left != 0 {
                64
            } else if left_adjacent_column != 0 || (*p_sc).bOneMBRightVertTB != 0 {
                -128
            } else {
                -64
            };
            while j < if right != 0 || (*p_sc).bVertTileBoundary != 0 {
                0
            } else {
                64
            } {
                str_idct4x4_stage1(std::slice::from_raw_parts_mut(p1.offset(j), 16));
                str_idct4x4_stage1(std::slice::from_raw_parts_mut(p1.offset(j + 16), 16));
                str_idct4x4_stage1(std::slice::from_raw_parts_mut(p1.offset(j + 32), 16));
                j += 64;
            }
        }

        if ol_overlap != Overlap::None {
            if (top != 0 || (*p_sc).bHoriTileBoundary != 0)
                && (left_adjacent_column != 0 || (*p_sc).bOneMBRightVertTB != 0)
            {
                str_post4_alternate(
                    &mut *p1.offset(-128),
                    &mut *p1.offset(-128 + 1),
                    &mut *p1.offset(-128 + 2),
                    &mut *p1.offset(-128 + 3),
                );
            }
            if (top != 0 || (*p_sc).bHoriTileBoundary != 0)
                && (right != 0 || (*p_sc).bVertTileBoundary != 0)
            {
                str_post4_alternate(
                    &mut *p1.offset(-59),
                    &mut *p1.offset(-60),
                    &mut *p1.offset(-57),
                    &mut *p1.offset(-58),
                );
            }
            if (bottom != 0 || (*p_sc).bHoriTileBoundary != 0)
                && (left_adjacent_column != 0 || (*p_sc).bOneMBRightVertTB != 0)
            {
                str_post4_alternate(
                    &mut *p0.offset(-128 + 48 + 10),
                    &mut *p0.offset(-128 + 48 + 11),
                    &mut *p0.offset(-128 + 48 + 8),
                    &mut *p0.offset(-128 + 48 + 9),
                );
            }
            if (bottom != 0 || (*p_sc).bHoriTileBoundary != 0)
                && (right != 0 || (*p_sc).bVertTileBoundary != 0)
            {
                str_post4_alternate(
                    &mut *p0.offset(-1),
                    &mut *p0.offset(-2),
                    &mut *p0.offset(-3),
                    &mut *p0.offset(-4),
                );
            }

            if top == 0 {
                if left_adjacent_column != 0 || (*p_sc).bOneMBRightVertTB != 0 {
                    let p = p0.offset(32 + 10 - 128);
                    str_post4_alternate(
                        &mut *p.add(0),
                        &mut *p.offset(-2),
                        &mut *p.add(6),
                        &mut *p.add(8),
                    );
                    str_post4_alternate(
                        &mut *p.add(1),
                        &mut *p.offset(-1),
                        &mut *p.add(7),
                        &mut *p.add(9),
                    );
                }
                if right != 0 || (*p_sc).bVertTileBoundary != 0 {
                    let p = p0.offset(-32 + 14);
                    str_post4_alternate(
                        &mut *p.add(0),
                        &mut *p.offset(-2),
                        &mut *p.add(6),
                        &mut *p.add(8),
                    );
                    str_post4_alternate(
                        &mut *p.add(1),
                        &mut *p.offset(-1),
                        &mut *p.add(7),
                        &mut *p.add(9),
                    );
                }
                let mut j = if left != 0 { 0 } else { -128 };
                while j < if right != 0 || (*p_sc).bVertTileBoundary != 0 {
                    -64
                } else {
                    0
                } {
                    str_post4x4_stage1_alternate(p0.offset(j + 32), 0);
                    j += 64;
                }
            }

            if bottom == 0 {
                if left_adjacent_column != 0 || (*p_sc).bOneMBRightVertTB != 0 {
                    let mut p = p1.offset(10 - 128);
                    str_post4_alternate(
                        &mut *p.add(0),
                        &mut *p.offset(-2),
                        &mut *p.add(6),
                        &mut *p.add(8),
                    );
                    str_post4_alternate(
                        &mut *p.add(1),
                        &mut *p.offset(-1),
                        &mut *p.add(7),
                        &mut *p.add(9),
                    );
                    p = p.add(16);
                    str_post4_alternate(
                        &mut *p.add(0),
                        &mut *p.offset(-2),
                        &mut *p.add(6),
                        &mut *p.add(8),
                    );
                    str_post4_alternate(
                        &mut *p.add(1),
                        &mut *p.offset(-1),
                        &mut *p.add(7),
                        &mut *p.add(9),
                    );
                }
                if right != 0 || (*p_sc).bVertTileBoundary != 0 {
                    let mut p = p1.offset(-64 + 14);
                    str_post4_alternate(
                        &mut *p.add(0),
                        &mut *p.offset(-2),
                        &mut *p.add(6),
                        &mut *p.add(8),
                    );
                    str_post4_alternate(
                        &mut *p.add(1),
                        &mut *p.offset(-1),
                        &mut *p.add(7),
                        &mut *p.add(9),
                    );
                    p = p.add(16);
                    str_post4_alternate(
                        &mut *p.add(0),
                        &mut *p.offset(-2),
                        &mut *p.add(6),
                        &mut *p.add(8),
                    );
                    str_post4_alternate(
                        &mut *p.add(1),
                        &mut *p.offset(-1),
                        &mut *p.add(7),
                        &mut *p.add(9),
                    );
                }
                let mut j = if left != 0 { 0 } else { -128 };
                while j < if right != 0 || (*p_sc).bVertTileBoundary != 0 {
                    -64
                } else {
                    0
                } {
                    str_post4x4_stage1_alternate(p1.offset(j), 0);
                    str_post4x4_stage1_alternate(p1.offset(j + 16), 0);
                    j += 64;
                }
            }

            if top_or_bottom != 0 || (*p_sc).bHoriTileBoundary != 0 {
                if top != 0 || (*p_sc).bHoriTileBoundary != 0 {
                    let p = p1.add(5);
                    let mut j = if left != 0 { 0 } else { -128 };
                    while j < if right != 0 || (*p_sc).bVertTileBoundary != 0 {
                        -64
                    } else {
                        0
                    } {
                        str_post4_alternate(
                            &mut *p.offset(j),
                            &mut *p.offset(j - 1),
                            &mut *p.offset(j + 59),
                            &mut *p.offset(j + 60),
                        );
                        str_post4_alternate(
                            &mut *p.offset(j + 2),
                            &mut *p.offset(j + 1),
                            &mut *p.offset(j + 61),
                            &mut *p.offset(j + 62),
                        );
                        j += 64;
                    }
                }

                if bottom != 0 || (*p_sc).bHoriTileBoundary != 0 {
                    let p = p0.add(48 + 13);
                    let mut j = if left != 0 { 0 } else { -128 };
                    while j < if right != 0 || (*p_sc).bVertTileBoundary != 0 {
                        -64
                    } else {
                        0
                    } {
                        str_post4_alternate(
                            &mut *p.offset(j),
                            &mut *p.offset(j - 1),
                            &mut *p.offset(j + 59),
                            &mut *p.offset(j + 60),
                        );
                        str_post4_alternate(
                            &mut *p.offset(j + 2),
                            &mut *p.offset(j + 1),
                            &mut *p.offset(j + 61),
                            &mut *p.offset(j + 62),
                        );
                        j += 64;
                    }
                }
            } else {
                if left_adjacent_column != 0 || (*p_sc).bOneMBRightVertTB != 0 {
                    let j = -128;
                    str_post4_alternate(
                        &mut *p0.offset(j + 48 + 10),
                        &mut *p0.offset(j + 48 + 10 - 2),
                        &mut *p1.offset(j),
                        &mut *p1.offset(j + 2),
                    );
                    str_post4_alternate(
                        &mut *p0.offset(j + 48 + 10 + 1),
                        &mut *p0.offset(j + 48 + 10 - 1),
                        &mut *p1.offset(j + 1),
                        &mut *p1.offset(j + 3),
                    );
                }

                if right != 0 || (*p_sc).bVertTileBoundary != 0 {
                    let j = -64 + 4;
                    str_post4_alternate(
                        &mut *p0.offset(j + 48 + 10),
                        &mut *p0.offset(j + 48 + 10 - 2),
                        &mut *p1.offset(j),
                        &mut *p1.offset(j + 2),
                    );
                    str_post4_alternate(
                        &mut *p0.offset(j + 48 + 10 + 1),
                        &mut *p0.offset(j + 48 + 10 - 1),
                        &mut *p1.offset(j + 1),
                        &mut *p1.offset(j + 3),
                    );
                }

                let mut j = if left != 0 { 0 } else { -128 };
                while j < if right != 0 || (*p_sc).bVertTileBoundary != 0 {
                    -64
                } else {
                    0
                } {
                    str_post4x4_stage1_split_alternate(p0.offset(j + 48), p1.offset(j), 0);
                    j += 64;
                }
            }
        }

        i += 1;
    }

    Ok(())
}
