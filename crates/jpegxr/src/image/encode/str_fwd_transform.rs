// Auto-generated scaffold for a faithful JXRLib translation restart.
// Keep one Rust item per original C item; replace stubs bottom-up.

use crate::image::sys::str_transform::{fourbutterfly_hardcoded1, str_dct2x2dn, str_dct2x2up};
use crate::image::sys::strcodec::CWMImageStrCodec;
use crate::image::sys::windowsmediaphoto::Overlap;
use crate::jxrgluelib::jxrglue::ColorFormat;

/// Original function: `strDCT4x4Stage1` at `original/jxrlib/image/encode/strFwdTransform.c:72`.
pub unsafe fn str_dct4x4_stage1(p: *mut i32) {
    fourbutterfly_hardcoded1(std::slice::from_raw_parts_mut(p, 16));

    str_dct2x2up(
        &mut *p.add(0),
        &mut *p.add(1),
        &mut *p.add(2),
        &mut *p.add(3),
    );

    fwd_odd_odd(
        &mut *p.add(15),
        &mut *p.add(14),
        &mut *p.add(13),
        &mut *p.add(12),
    );

    fwd_odd(
        &mut *p.add(5),
        &mut *p.add(4),
        &mut *p.add(7),
        &mut *p.add(6),
    );

    fwd_odd(
        &mut *p.add(10),
        &mut *p.add(8),
        &mut *p.add(11),
        &mut *p.add(9),
    );
}

/// Original function: `strDCT4x4SecondStage` at `original/jxrlib/image/encode/strFwdTransform.c:91`.
pub unsafe fn str_dct4x4_second_stage(p: *mut i32) {
    str_dct2x2dn(
        &mut *p.add(0),
        &mut *p.add(192),
        &mut *p.add(48),
        &mut *p.add(240),
    );
    str_dct2x2dn(
        &mut *p.add(64),
        &mut *p.add(128),
        &mut *p.add(112),
        &mut *p.add(176),
    );
    str_dct2x2dn(
        &mut *p.add(16),
        &mut *p.add(208),
        &mut *p.add(32),
        &mut *p.add(224),
    );
    str_dct2x2dn(
        &mut *p.add(80),
        &mut *p.add(144),
        &mut *p.add(96),
        &mut *p.add(160),
    );

    str_dct2x2up(
        &mut *p.add(0),
        &mut *p.add(64),
        &mut *p.add(16),
        &mut *p.add(80),
    );

    fwd_odd_odd(
        &mut *p.add(160),
        &mut *p.add(224),
        &mut *p.add(176),
        &mut *p.add(240),
    );

    fwd_odd(
        &mut *p.add(128),
        &mut *p.add(192),
        &mut *p.add(144),
        &mut *p.add(208),
    );

    fwd_odd(
        &mut *p.add(32),
        &mut *p.add(48),
        &mut *p.add(96),
        &mut *p.add(112),
    );
}

/// Original function: `strNormalizeEnc` at `original/jxrlib/image/encode/strFwdTransform.c:109`.
pub unsafe fn str_normalize_enc(p: *mut i32, b_chroma: bool) {
    if b_chroma {
        for i in (0..256).step_by(16) {
            *p.add(i) >>= 1;
        }
    }
}

/// Original function: `strDCT2x2dnEnc` at `original/jxrlib/image/encode/strFwdTransform.c:125`.
pub unsafe fn str_dct2x2dn_enc(pa: &mut i32, pb: &mut i32, pc: &mut i32, pd: &mut i32) {
    let mut a = (*pa + 0) >> 1;
    let mut b = (*pb + 0) >> 1;
    let c_orig = (*pc + 0) >> 1;
    let mut d = (*pd + 0) >> 1;

    a += d;
    b -= c_orig;
    let t = (a - b) >> 1;
    let c = t - d;
    d = t - c_orig;
    a -= d;
    b += c;

    *pa = a;
    *pb = b;
    *pc = c;
    *pd = d;
}

/// Original function: `strPre2` at `original/jxrlib/image/encode/strFwdTransform.c:150`.
pub unsafe fn str_pre2(pa: &mut i32, pb: &mut i32) {
    let mut a = *pa;
    let mut b = *pb;

    b -= (a + 2) >> 2;
    a -= (b + 1) >> 1;

    a -= b >> 5;
    a -= b >> 9;
    a -= b >> 13;

    b -= (a + 2) >> 2;

    *pa = a;
    *pb = b;
}

/// Original function: `strPre2x2` at `original/jxrlib/image/encode/strFwdTransform.c:170`.
pub unsafe fn str_pre2x2(pa: &mut i32, pb: &mut i32, pc: &mut i32, pd: &mut i32) {
    let mut a = *pa;
    let mut b = *pb;
    let mut c = *pc;
    let mut d = *pd;

    a += d;
    b += c;
    d -= (a + 1) >> 1;
    c -= (b + 1) >> 1;

    b -= (a + 2) >> 2;
    a -= (b + 1) >> 1;
    a -= b >> 5;
    a -= b >> 9;
    a -= b >> 13;
    b -= (a + 2) >> 2;

    d += (a + 1) >> 1;
    c += (b + 1) >> 1;
    a -= d;
    b -= c;

    *pa = a;
    *pb = b;
    *pc = c;
    *pd = d;
}

/// Original function: `strPre4` at `original/jxrlib/image/encode/strFwdTransform.c:205`.
pub unsafe fn str_pre4(pa: *mut i32, pb: *mut i32, pc: *mut i32, pd: *mut i32) {
    let mut a = *pa;
    let mut b = *pb;
    let mut c = *pc;
    let mut d = *pd;

    a += d;
    b += c;
    d -= (a + 1) >> 1;
    c -= (b + 1) >> 1;

    d -= (c + 1) >> 1;
    c += (d + 1) >> 1;

    str_hstenc1_edge(&mut a, &mut d);
    str_hstenc1_edge(&mut b, &mut c);

    d += (a + 1) >> 1;
    c += (b + 1) >> 1;
    a -= d;
    b -= c;

    *pa = a;
    *pb = b;
    *pc = c;
    *pd = d;
}

/// Original function: `strPre4x4Stage1Split` at `original/jxrlib/image/encode/strFwdTransform.c:237`.
pub unsafe fn str_pre4x4_stage1_split(mut p0: *mut i32, mut p1: *mut i32, i_offset: i32) {
    let p2 = p0.offset((72 - i_offset) as isize);
    let p3 = p1.offset((64 - i_offset) as isize);
    p0 = p0.add(12);
    p1 = p1.add(4);

    str_hstenc(
        &mut *p0.add(0),
        &mut *p2.add(0),
        &mut *p1.add(0),
        &mut *p3.add(0),
    );
    str_hstenc(
        &mut *p0.add(1),
        &mut *p2.add(1),
        &mut *p1.add(1),
        &mut *p3.add(1),
    );
    str_hstenc(
        &mut *p0.add(2),
        &mut *p2.add(2),
        &mut *p1.add(2),
        &mut *p3.add(2),
    );
    str_hstenc(
        &mut *p0.add(3),
        &mut *p2.add(3),
        &mut *p1.add(3),
        &mut *p3.add(3),
    );
    str_hstenc1(&mut *p0.add(0), &mut *p3.add(0));
    str_hstenc1(&mut *p0.add(1), &mut *p3.add(1));
    str_hstenc1(&mut *p0.add(2), &mut *p3.add(2));
    str_hstenc1(&mut *p0.add(3), &mut *p3.add(3));

    *p1.add(3) -= (*p1.add(2) + 1) >> 1;
    *p1.add(2) += (*p1.add(3) + 1) >> 1;
    *p1.add(1) -= (*p1.add(0) + 1) >> 1;
    *p1.add(0) += (*p1.add(1) + 1) >> 1;
    *p2.add(3) -= (*p2.add(1) + 1) >> 1;
    *p2.add(1) += (*p2.add(3) + 1) >> 1;
    *p2.add(2) -= (*p2.add(0) + 1) >> 1;
    *p2.add(0) += (*p2.add(2) + 1) >> 1;

    fwd_odd_odd_pre(
        &mut *p3.add(0),
        &mut *p3.add(1),
        &mut *p3.add(2),
        &mut *p3.add(3),
    );

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
}

/// Original function: `strPre4x4Stage1` at `original/jxrlib/image/encode/strFwdTransform.c:270`.
pub unsafe fn str_pre4x4_stage1(p: *mut i32, i_offset: i32) {
    str_pre4x4_stage1_split(p, p.add(16), i_offset);
}

/// Original function: `strPre4x4Stage2Split` at `original/jxrlib/image/encode/strFwdTransform.c:283`.
pub unsafe fn str_pre4x4_stage2_split(p0: *mut i32, p1: *mut i32) {
    str_hstenc(
        &mut *p0.offset(-96),
        &mut *p0.add(96),
        &mut *p1.offset(-112),
        &mut *p1.add(80),
    );
    str_hstenc(
        &mut *p0.offset(-32),
        &mut *p0.add(32),
        &mut *p1.offset(-48),
        &mut *p1.add(16),
    );
    str_hstenc(
        &mut *p0.offset(-80),
        &mut *p0.add(112),
        &mut *p1.offset(-128),
        &mut *p1.add(64),
    );
    str_hstenc(
        &mut *p0.offset(-16),
        &mut *p0.add(48),
        &mut *p1.offset(-64),
        &mut *p1.add(0),
    );
    str_hstenc1(&mut *p0.offset(-96), &mut *p1.add(80));
    str_hstenc1(&mut *p0.offset(-32), &mut *p1.add(16));
    str_hstenc1(&mut *p0.offset(-80), &mut *p1.add(64));
    str_hstenc1(&mut *p0.offset(-16), &mut *p1.add(0));

    *p1.offset(-112) -= (*p1.offset(-48) + 1) >> 1;
    *p1.offset(-48) += (*p1.offset(-112) + 1) >> 1;
    *p1.offset(-128) -= (*p1.offset(-64) + 1) >> 1;
    *p1.offset(-64) += (*p1.offset(-128) + 1) >> 1;
    *p0.add(96) -= (*p0.add(112) + 1) >> 1;
    *p0.add(112) += (*p0.add(96) + 1) >> 1;
    *p0.add(32) -= (*p0.add(48) + 1) >> 1;
    *p0.add(48) += (*p0.add(32) + 1) >> 1;

    fwd_odd_odd_pre(
        &mut *p1.add(0),
        &mut *p1.add(64),
        &mut *p1.add(16),
        &mut *p1.add(80),
    );

    str_dct2x2dn(
        &mut *p0.offset(-96),
        &mut *p1.offset(-112),
        &mut *p0.add(96),
        &mut *p1.add(80),
    );
    str_dct2x2dn(
        &mut *p0.offset(-32),
        &mut *p1.offset(-48),
        &mut *p0.add(32),
        &mut *p1.add(16),
    );
    str_dct2x2dn(
        &mut *p0.offset(-80),
        &mut *p1.offset(-128),
        &mut *p0.add(112),
        &mut *p1.add(64),
    );
    str_dct2x2dn(
        &mut *p0.offset(-16),
        &mut *p1.offset(-64),
        &mut *p0.add(48),
        &mut *p1.add(0),
    );
}

/// Original function: `strHSTenc` at `original/jxrlib/image/encode/strFwdTransform.c:317`.
pub unsafe fn str_hstenc(pa: &mut i32, pb: &mut i32, pc: &mut i32, pd: &mut i32) {
    let mut a = *pa;
    let mut b = *pb;
    let mut d = *pc;
    let mut c = *pd;

    a += c;
    b -= d;
    c = ((a - b) >> 1) - c;
    d += b >> 1;
    b += c;

    a -= (d * 3 + 4) >> 3;

    *pa = a;
    *pb = b;
    *pc = c;
    *pd = d;
}

/// Original function: `strHSTenc1` at `original/jxrlib/image/encode/strFwdTransform.c:340`.
pub unsafe fn str_hstenc1(pa: &mut i32, pd: &mut i32) {
    let mut a = *pa;
    let mut d = *pd;

    d -= a >> 7;
    d += a >> 10;

    d -= (a * 3 + 0) >> 4;
    a -= (d * 3 + 0) >> 3;
    d = (a >> 1) - d;
    a -= d;

    *pa = a;
    *pd = d;
}

/// Original function: `strHSTenc1_edge` at `original/jxrlib/image/encode/strFwdTransform.c:360`.
pub unsafe fn str_hstenc1_edge(pa: &mut i32, pd: &mut i32) {
    let mut a = *pa;
    let mut d = -*pd;

    a -= d;
    d += a >> 1;
    a -= (d * 3 + 4) >> 3;

    d -= a >> 7;
    d += a >> 10;

    d -= (a * 3 + 0) >> 4;
    a -= (d * 3 + 0) >> 3;
    d = (a >> 1) - d;
    a -= d;

    *pa = a;
    *pd = d;
}

/// Original function: `fwdOddOdd` at `original/jxrlib/image/encode/strFwdTransform.c:386`.
pub unsafe fn fwd_odd_odd(pa: &mut i32, pb: &mut i32, pc: &mut i32, pd: &mut i32) {
    let mut a = *pa;
    let mut b = -*pb;
    let mut c = -*pc;
    let mut d = *pd;

    d += a;
    c -= b;
    let t1 = d >> 1;
    a -= t1;
    let t2 = c >> 1;
    b += t2;

    a += (b * 3 + 4) >> 3;
    b -= (a * 3 + 3) >> 2;
    a += (b * 3 + 3) >> 3;

    b -= t2;
    a += t1;
    c += b;
    d -= a;

    *pa = a;
    *pb = b;
    *pc = c;
    *pd = d;
}

/// Original function: `fwdOddOddPre` at `original/jxrlib/image/encode/strFwdTransform.c:418`.
pub unsafe fn fwd_odd_odd_pre(pa: &mut i32, pb: &mut i32, pc: &mut i32, pd: &mut i32) {
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

    a += (b * 3 + 4) >> 3;
    b -= (a * 3 + 2) >> 2;
    a += (b * 3 + 6) >> 3;

    b -= t2;
    a += t1;
    c += b;
    d -= a;

    *pa = a;
    *pb = b;
    *pc = c;
    *pd = d;
}

/// Original function: `fwdOdd` at `original/jxrlib/image/encode/strFwdTransform.c:451`.
pub unsafe fn fwd_odd(pa: &mut i32, pb: &mut i32, pc: &mut i32, pd: &mut i32) {
    let mut a = *pa;
    let mut b = *pb;
    let mut c = *pc;
    let mut d = *pd;

    b -= c;
    a += d;
    c += (b + 1) >> 1;
    d = ((a + 1) >> 1) - d;

    b -= (a * 3 + 4) >> 3;
    a += (b * 3 + 4) >> 3;
    d -= (c * 3 + 4) >> 3;
    c += (d * 3 + 4) >> 3;

    d += b >> 1;
    c -= (a + 1) >> 1;
    b -= d;
    a += c;

    *pa = a;
    *pb = b;
    *pc = c;
    *pd = d;
}

/// Original function: `transformMacroblock` at `original/jxrlib/image/encode/strFwdTransform.c:484`.
pub unsafe fn transform_macroblock(p_sc: &mut CWMImageStrCodec) {
    let p_sc = p_sc as *mut CWMImageStrCodec;
    let ol_overlap = (*p_sc).WMISCP.olOverlap;
    let cf_color_format = (*p_sc).m_param.cfColorFormat;
    let left = (*p_sc).cColumn == 0;
    let right = (*p_sc).cColumn == (*p_sc).cmbWidth;
    let top = (*p_sc).cRow == 0;
    let bottom = (*p_sc).cRow == (*p_sc).cmbHeight;
    let left_or_right = left || right;
    let top_or_bottom = top || bottom;
    let top_or_left = left || top;
    let left_adjacent_column = (*p_sc).cColumn == 1;
    let right_adjacent_column = (*p_sc).cColumn == (*p_sc).cmbWidth - 1;
    let i_num_chroma_full_planes =
        if cf_color_format == ColorFormat::Yuv420 || cf_color_format == ColorFormat::Yuv422 {
            1
        } else {
            (*p_sc).m_param.cNumChannels
        };

    if (*p_sc).WMISCP.bUseHardTileBoundaries != 0 {
        if (*p_sc).cColumn == 0 {
            (*p_sc).bVertTileBoundary = 0;
            (*p_sc).tileY = 0;
        }
        (*p_sc).bOneMBLeftVertTB = 0;
        (*p_sc).bOneMBRightVertTB = 0;
        if (*p_sc).tileY > 0
            && (*p_sc).tileY <= (*p_sc).WMISCP.cNumOfSliceMinus1H as usize
            && (*p_sc).cColumn - 1 == (*p_sc).WMISCP.uiTileY[(*p_sc).tileY] as usize
        {
            (*p_sc).bOneMBRightVertTB = 1;
        }
        if (*p_sc).tileY < (*p_sc).WMISCP.cNumOfSliceMinus1H as usize
            && (*p_sc).cColumn == (*p_sc).WMISCP.uiTileY[(*p_sc).tileY + 1] as usize
        {
            (*p_sc).bVertTileBoundary = 1;
            (*p_sc).tileY += 1;
        } else {
            (*p_sc).bVertTileBoundary = 0;
        }
        if (*p_sc).tileY < (*p_sc).WMISCP.cNumOfSliceMinus1H as usize
            && (*p_sc).cColumn + 1 == (*p_sc).WMISCP.uiTileY[(*p_sc).tileY + 1] as usize
        {
            (*p_sc).bOneMBLeftVertTB = 1;
        }

        if (*p_sc).cRow == 0 {
            (*p_sc).bHoriTileBoundary = 0;
            (*p_sc).tileX = 0;
        } else if (*p_sc).mbY != (*p_sc).cRow
            && (*p_sc).tileX < (*p_sc).WMISCP.cNumOfSliceMinus1V as usize
            && (*p_sc).cRow == (*p_sc).WMISCP.uiTileX[(*p_sc).tileX + 1] as usize
        {
            (*p_sc).bHoriTileBoundary = 1;
            (*p_sc).tileX += 1;
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

    let mut i = 0;
    while i < i_num_chroma_full_planes {
        let p0 = (*p_sc).p0MBbuffer[i].map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);
        let p1 = (*p_sc).p1MBbuffer[i].map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);

        if ol_overlap != Overlap::None {
            if (top || (*p_sc).bHoriTileBoundary != 0) && (left || (*p_sc).bVertTileBoundary != 0) {
                str_pre4(p1, p1.add(1), p1.add(2), p1.add(3));
            }
            if (top || (*p_sc).bHoriTileBoundary != 0) && (right || (*p_sc).bVertTileBoundary != 0)
            {
                str_pre4(
                    p1.offset(-59),
                    p1.offset(-60),
                    p1.offset(-57),
                    p1.offset(-58),
                );
            }
            if (bottom || (*p_sc).bHoriTileBoundary != 0)
                && (left || (*p_sc).bVertTileBoundary != 0)
            {
                str_pre4(
                    p0.add(48 + 10),
                    p0.add(48 + 11),
                    p0.add(48 + 8),
                    p0.add(48 + 9),
                );
            }
            if (bottom || (*p_sc).bHoriTileBoundary != 0)
                && (right || (*p_sc).bVertTileBoundary != 0)
            {
                str_pre4(p0.offset(-1), p0.offset(-2), p0.offset(-3), p0.offset(-4));
            }
            if !right && !bottom {
                if top || (*p_sc).bHoriTileBoundary != 0 {
                    let mut j = if left || (*p_sc).bVertTileBoundary != 0 {
                        0
                    } else {
                        -64
                    };
                    while j < 192 {
                        let p = p1.offset(j);
                        str_pre4(p.add(5), p.add(4), p.add(64), p.add(65));
                        str_pre4(p.add(7), p.add(6), p.add(66), p.add(67));
                        j += 64;
                    }
                } else {
                    let mut j = if left || (*p_sc).bVertTileBoundary != 0 {
                        0
                    } else {
                        -64
                    };
                    while j < 192 {
                        str_pre4x4_stage1_split(p0.offset(48 + j), p1.offset(j), 0);
                        j += 64;
                    }
                }

                if left || (*p_sc).bVertTileBoundary != 0 {
                    if !top && (*p_sc).bHoriTileBoundary == 0 {
                        str_pre4(p0.add(58), p0.add(56), p1, p1.add(2));
                        str_pre4(p0.add(59), p0.add(57), p1.add(1), p1.add(3));
                    }
                    let mut j = -64;
                    while j < -16 {
                        let p = p1.offset(j);
                        str_pre4(p.add(74), p.add(72), p.add(80), p.add(82));
                        str_pre4(p.add(75), p.add(73), p.add(81), p.add(83));
                        j += 16;
                    }
                } else {
                    let mut j = -64;
                    while j < -16 {
                        str_pre4x4_stage1(p1.offset(j), 0);
                        j += 16;
                    }
                }

                str_pre4x4_stage1(p1, 0);
                str_pre4x4_stage1(p1.add(16), 0);
                str_pre4x4_stage1(p1.add(32), 0);
                str_pre4x4_stage1(p1.add(64), 0);
                str_pre4x4_stage1(p1.add(80), 0);
                str_pre4x4_stage1(p1.add(96), 0);
                str_pre4x4_stage1(p1.add(128), 0);
                str_pre4x4_stage1(p1.add(144), 0);
                str_pre4x4_stage1(p1.add(160), 0);
            }

            if bottom || (*p_sc).bHoriTileBoundary != 0 {
                let mut j = if left || (*p_sc).bVertTileBoundary != 0 {
                    48
                } else {
                    -16
                };
                while j < if right { -16 } else { 240 } {
                    let p = p0.offset(j);
                    str_pre4(p.add(15), p.add(14), p.add(74), p.add(75));
                    str_pre4(p.add(13), p.add(12), p.add(72), p.add(73));
                    j += 64;
                }
            }

            if (right || (*p_sc).bVertTileBoundary != 0) && !bottom {
                if !top && (*p_sc).bHoriTileBoundary == 0 {
                    str_pre4(p0.offset(-1), p0.offset(-3), p1.offset(-59), p1.offset(-57));
                    str_pre4(p0.offset(-2), p0.offset(-4), p1.offset(-60), p1.offset(-58));
                }
                let mut j = -64;
                while j < -16 {
                    let p = p1.offset(j);
                    str_pre4(p.add(15), p.add(13), p.add(21), p.add(23));
                    str_pre4(p.add(14), p.add(12), p.add(20), p.add(22));
                    j += 16;
                }
            }
        }

        if !top {
            let mut j = if left { 48 } else { -16 };
            while j < if right { 48 } else { 240 } {
                str_dct4x4_stage1(p0.offset(j));
                j += 64;
            }
        }

        if !bottom {
            let mut j = if left { 0 } else { -64 };
            while j < if right { 0 } else { 192 } {
                str_dct4x4_stage1(p1.offset(j));
                str_dct4x4_stage1(p1.offset(j + 16));
                str_dct4x4_stage1(p1.offset(j + 32));
                j += 64;
            }
        }

        if ol_overlap == Overlap::Two {
            if (top || (*p_sc).bHoriTileBoundary != 0) && (left || (*p_sc).bVertTileBoundary != 0) {
                str_pre4(p1, p1.add(64), p1.add(16), p1.add(64 + 16));
            }
            if (top || (*p_sc).bHoriTileBoundary != 0) && (right || (*p_sc).bVertTileBoundary != 0)
            {
                str_pre4(
                    p1.offset(-128),
                    p1.offset(-64),
                    p1.offset(-128 + 16),
                    p1.offset(-64 + 16),
                );
            }
            if (bottom || (*p_sc).bHoriTileBoundary != 0)
                && (left || (*p_sc).bVertTileBoundary != 0)
            {
                str_pre4(p0.add(32), p0.add(96), p0.add(32 + 16), p0.add(96 + 16));
            }
            if (bottom || (*p_sc).bHoriTileBoundary != 0)
                && (right || (*p_sc).bVertTileBoundary != 0)
            {
                str_pre4(
                    p0.offset(-96),
                    p0.offset(-32),
                    p0.offset(-96 + 16),
                    p0.offset(-32 + 16),
                );
            }
            if (left_or_right || (*p_sc).bVertTileBoundary != 0)
                && !top_or_bottom
                && (*p_sc).bHoriTileBoundary == 0
            {
                if left || (*p_sc).bVertTileBoundary != 0 {
                    let j = 0;
                    str_pre4(
                        p0.offset(j + 32),
                        p0.offset(j + 48),
                        p1.offset(j),
                        p1.offset(j + 16),
                    );
                    str_pre4(
                        p0.offset(j + 96),
                        p0.offset(j + 112),
                        p1.offset(j + 64),
                        p1.offset(j + 80),
                    );
                }
                if right || (*p_sc).bVertTileBoundary != 0 {
                    let j = -128;
                    str_pre4(
                        p0.offset(j + 32),
                        p0.offset(j + 48),
                        p1.offset(j),
                        p1.offset(j + 16),
                    );
                    str_pre4(
                        p0.offset(j + 96),
                        p0.offset(j + 112),
                        p1.offset(j + 64),
                        p1.offset(j + 80),
                    );
                }
            }

            if !left_or_right && (*p_sc).bVertTileBoundary == 0 {
                if top_or_bottom || (*p_sc).bHoriTileBoundary != 0 {
                    if top || (*p_sc).bHoriTileBoundary != 0 {
                        let p = p1;
                        str_pre4(p.offset(-128), p.offset(-64), p, p.add(64));
                        str_pre4(p.offset(-112), p.offset(-48), p.add(16), p.add(80));
                    }
                    if bottom || (*p_sc).bHoriTileBoundary != 0 {
                        let p = p0.add(32);
                        str_pre4(p.offset(-128), p.offset(-64), p, p.add(64));
                        str_pre4(p.offset(-112), p.offset(-48), p.add(16), p.add(80));
                    }
                } else {
                    str_pre4x4_stage2_split(p0, p1);
                }
            }
        }

        if !top_or_left {
            if (*p_sc).m_param.bScaledArith != 0 {
                str_normalize_enc(p0.offset(-256), i != 0);
            }
            str_dct4x4_second_stage(p0.offset(-256));
        }

        i += 1;
    }

    let mut i = 0;
    while i < if cf_color_format == ColorFormat::Yuv420 {
        2
    } else {
        0
    } {
        let p0 = (*p_sc).p0MBbuffer[1 + i].map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);
        let p1 = (*p_sc).p1MBbuffer[1 + i].map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);

        if ol_overlap != Overlap::None {
            if (top || (*p_sc).bHoriTileBoundary != 0) && (left || (*p_sc).bVertTileBoundary != 0) {
                str_pre4(p1, p1.add(1), p1.add(2), p1.add(3));
            }
            if (top || (*p_sc).bHoriTileBoundary != 0) && (right || (*p_sc).bVertTileBoundary != 0)
            {
                str_pre4(
                    p1.offset(-27),
                    p1.offset(-28),
                    p1.offset(-25),
                    p1.offset(-26),
                );
            }
            if (bottom || (*p_sc).bHoriTileBoundary != 0)
                && (left || (*p_sc).bVertTileBoundary != 0)
            {
                str_pre4(
                    p0.add(16 + 10),
                    p0.add(16 + 11),
                    p0.add(16 + 8),
                    p0.add(16 + 9),
                );
            }
            if (bottom || (*p_sc).bHoriTileBoundary != 0)
                && (right || (*p_sc).bVertTileBoundary != 0)
            {
                str_pre4(p0.offset(-1), p0.offset(-2), p0.offset(-3), p0.offset(-4));
            }
            if !right && !bottom {
                if top || (*p_sc).bHoriTileBoundary != 0 {
                    let mut j = if left || (*p_sc).bVertTileBoundary != 0 {
                        0
                    } else {
                        -32
                    };
                    while j < 32 {
                        let p = p1.offset(j);
                        str_pre4(p.add(5), p.add(4), p.add(32), p.add(33));
                        str_pre4(p.add(7), p.add(6), p.add(34), p.add(35));
                        j += 32;
                    }
                } else {
                    let mut j = if left || (*p_sc).bVertTileBoundary != 0 {
                        0
                    } else {
                        -32
                    };
                    while j < 32 {
                        str_pre4x4_stage1_split(p0.offset(16 + j), p1.offset(j), 32);
                        j += 32;
                    }
                }

                if left || (*p_sc).bVertTileBoundary != 0 {
                    if !top && (*p_sc).bHoriTileBoundary == 0 {
                        str_pre4(p0.add(26), p0.add(24), p1, p1.add(2));
                        str_pre4(p0.add(27), p0.add(25), p1.add(1), p1.add(3));
                    }
                    str_pre4(p1.add(10), p1.add(8), p1.add(16), p1.add(18));
                    str_pre4(p1.add(11), p1.add(9), p1.add(17), p1.add(19));
                } else if (*p_sc).bVertTileBoundary == 0 {
                    str_pre4x4_stage1(p1.offset(-32), 32);
                }

                str_pre4x4_stage1(p1, 32);
            }

            if bottom || (*p_sc).bHoriTileBoundary != 0 {
                let mut j = if left || (*p_sc).bVertTileBoundary != 0 {
                    16
                } else {
                    -16
                };
                while j < if right { -16 } else { 32 } {
                    let p = p0.offset(j);
                    str_pre4(p.add(15), p.add(14), p.add(42), p.add(43));
                    str_pre4(p.add(13), p.add(12), p.add(40), p.add(41));
                    j += 32;
                }
            }

            if (right || (*p_sc).bVertTileBoundary != 0) && !bottom {
                if !top && (*p_sc).bHoriTileBoundary == 0 {
                    str_pre4(p0.offset(-1), p0.offset(-3), p1.offset(-27), p1.offset(-25));
                    str_pre4(p0.offset(-2), p0.offset(-4), p1.offset(-28), p1.offset(-26));
                }
                str_pre4(
                    p1.offset(-17),
                    p1.offset(-19),
                    p1.offset(-11),
                    p1.offset(-9),
                );
                str_pre4(
                    p1.offset(-18),
                    p1.offset(-20),
                    p1.offset(-12),
                    p1.offset(-10),
                );
            }
        }

        if !top {
            let mut j = if left { 16 } else { -16 };
            while j < if right { 16 } else { 48 } {
                str_dct4x4_stage1(p0.offset(j));
                j += 32;
            }
        }

        if !bottom {
            let mut j = if left { 0 } else { -32 };
            while j < if right { 0 } else { 32 } {
                str_dct4x4_stage1(p1.offset(j));
                j += 32;
            }
        }

        if ol_overlap == Overlap::Two {
            if (left_adjacent_column || (*p_sc).bOneMBRightVertTB != 0)
                && (top || (*p_sc).bHoriTileBoundary != 0)
            {
                *p1.offset(-64) -= *p1.offset(-64 + 32);
            }
            if (right_adjacent_column || (*p_sc).bOneMBLeftVertTB != 0)
                && (top || (*p_sc).bHoriTileBoundary != 0)
            {
                (*p_sc).iPredBefore[i][0] = *p1;
            }
            if (right || (*p_sc).bVertTileBoundary != 0) && (top || (*p_sc).bHoriTileBoundary != 0)
            {
                *p1.offset(-64 + 32) -= (*p_sc).iPredBefore[i][0];
            }
            if (left_adjacent_column || (*p_sc).bOneMBRightVertTB != 0)
                && (bottom || (*p_sc).bHoriTileBoundary != 0)
            {
                *p0.offset(-64 + 16) -= *p0.offset(-64 + 48);
            }
            if (right_adjacent_column || (*p_sc).bOneMBLeftVertTB != 0)
                && (bottom || (*p_sc).bHoriTileBoundary != 0)
            {
                (*p_sc).iPredBefore[i][1] = *p0.add(16);
            }
            if (right || (*p_sc).bVertTileBoundary != 0)
                && (bottom || (*p_sc).bHoriTileBoundary != 0)
            {
                *p0.offset(-64 + 48) -= (*p_sc).iPredBefore[i][1];
            }

            if (left_or_right || (*p_sc).bVertTileBoundary != 0)
                && !top_or_bottom
                && (*p_sc).bHoriTileBoundary == 0
            {
                if left || (*p_sc).bVertTileBoundary != 0 {
                    str_pre2(&mut *p0.add(16), &mut *p1);
                }
                if right || (*p_sc).bVertTileBoundary != 0 {
                    str_pre2(&mut *p0.offset(-32 + 16), &mut *p1.offset(-32));
                }
            }

            if !left_or_right {
                if (top_or_bottom || (*p_sc).bHoriTileBoundary != 0)
                    && (*p_sc).bVertTileBoundary == 0
                {
                    if top || (*p_sc).bHoriTileBoundary != 0 {
                        str_pre2(&mut *p1.offset(-32), &mut *p1);
                    }
                    if bottom || (*p_sc).bHoriTileBoundary != 0 {
                        str_pre2(&mut *p0.offset(16 - 32), &mut *p0.add(16));
                    }
                } else if !top_or_bottom
                    && (*p_sc).bHoriTileBoundary == 0
                    && (*p_sc).bVertTileBoundary == 0
                {
                    str_pre2x2(
                        &mut *p0.offset(-16),
                        &mut *p0.add(16),
                        &mut *p1.offset(-32),
                        &mut *p1,
                    );
                }
            }

            if (left_adjacent_column || (*p_sc).bOneMBRightVertTB != 0)
                && (top || (*p_sc).bHoriTileBoundary != 0)
            {
                *p1.offset(-64) += *p1.offset(-64 + 32);
            }
            if (right_adjacent_column || (*p_sc).bOneMBLeftVertTB != 0)
                && (top || (*p_sc).bHoriTileBoundary != 0)
            {
                (*p_sc).iPredAfter[i][0] = *p1;
            }
            if (right || (*p_sc).bVertTileBoundary != 0) && (top || (*p_sc).bHoriTileBoundary != 0)
            {
                *p1.offset(-64 + 32) += (*p_sc).iPredAfter[i][0];
            }
            if (left_adjacent_column || (*p_sc).bOneMBRightVertTB != 0)
                && (bottom || (*p_sc).bHoriTileBoundary != 0)
            {
                *p0.offset(-64 + 16) += *p0.offset(-64 + 48);
            }
            if (right_adjacent_column || (*p_sc).bOneMBLeftVertTB != 0)
                && (bottom || (*p_sc).bHoriTileBoundary != 0)
            {
                (*p_sc).iPredAfter[i][1] = *p0.add(16);
            }
            if (right || (*p_sc).bVertTileBoundary != 0)
                && (bottom || (*p_sc).bHoriTileBoundary != 0)
            {
                *p0.offset(-64 + 48) += (*p_sc).iPredAfter[i][1];
            }
        }

        if !top_or_left {
            if (*p_sc).m_param.bScaledArith == 0 {
                str_dct2x2dn(
                    &mut *p0.offset(-64),
                    &mut *p0.offset(-32),
                    &mut *p0.offset(-48),
                    &mut *p0.offset(-16),
                );
            } else {
                str_dct2x2dn_enc(
                    &mut *p0.offset(-64),
                    &mut *p0.offset(-32),
                    &mut *p0.offset(-48),
                    &mut *p0.offset(-16),
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
    } {
        let p0 = (*p_sc).p0MBbuffer[1 + i].map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);
        let p1 = (*p_sc).p1MBbuffer[1 + i].map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);

        if ol_overlap != Overlap::None {
            if (top || (*p_sc).bHoriTileBoundary != 0) && (left || (*p_sc).bVertTileBoundary != 0) {
                str_pre4(p1, p1.add(1), p1.add(2), p1.add(3));
            }
            if (top || (*p_sc).bHoriTileBoundary != 0) && (right || (*p_sc).bVertTileBoundary != 0)
            {
                str_pre4(
                    p1.offset(-59),
                    p1.offset(-60),
                    p1.offset(-57),
                    p1.offset(-58),
                );
            }
            if (bottom || (*p_sc).bHoriTileBoundary != 0)
                && (left || (*p_sc).bVertTileBoundary != 0)
            {
                str_pre4(
                    p0.add(48 + 10),
                    p0.add(48 + 11),
                    p0.add(48 + 8),
                    p0.add(48 + 9),
                );
            }
            if (bottom || (*p_sc).bHoriTileBoundary != 0)
                && (right || (*p_sc).bVertTileBoundary != 0)
            {
                str_pre4(p0.offset(-1), p0.offset(-2), p0.offset(-3), p0.offset(-4));
            }
            if !right && !bottom {
                if top || (*p_sc).bHoriTileBoundary != 0 {
                    let mut j = if left || (*p_sc).bVertTileBoundary != 0 {
                        0
                    } else {
                        -64
                    };
                    while j < 64 {
                        let p = p1.offset(j);
                        str_pre4(p.add(5), p.add(4), p.add(64), p.add(65));
                        str_pre4(p.add(7), p.add(6), p.add(66), p.add(67));
                        j += 64;
                    }
                } else {
                    let mut j = if left || (*p_sc).bVertTileBoundary != 0 {
                        0
                    } else {
                        -64
                    };
                    while j < 64 {
                        str_pre4x4_stage1_split(p0.offset(48 + j), p1.offset(j), 0);
                        j += 64;
                    }
                }

                if left || (*p_sc).bVertTileBoundary != 0 {
                    if !top && (*p_sc).bHoriTileBoundary == 0 {
                        str_pre4(p0.add(58), p0.add(56), p1, p1.add(2));
                        str_pre4(p0.add(59), p0.add(57), p1.add(1), p1.add(3));
                    }
                    let mut j = 0;
                    while j < 48 {
                        let p = p1.offset(j);
                        str_pre4(p.add(10), p.add(8), p.add(16), p.add(18));
                        str_pre4(p.add(11), p.add(9), p.add(17), p.add(19));
                        j += 16;
                    }
                } else if (*p_sc).bVertTileBoundary == 0 {
                    let mut j = -64;
                    while j < -16 {
                        str_pre4x4_stage1(p1.offset(j), 0);
                        j += 16;
                    }
                }

                str_pre4x4_stage1(p1, 0);
                str_pre4x4_stage1(p1.add(16), 0);
                str_pre4x4_stage1(p1.add(32), 0);
            }

            if bottom || (*p_sc).bHoriTileBoundary != 0 {
                let mut j = if left || (*p_sc).bVertTileBoundary != 0 {
                    48
                } else {
                    -16
                };
                while j < if right { -16 } else { 112 } {
                    let p = p0.offset(j);
                    str_pre4(p.add(15), p.add(14), p.add(74), p.add(75));
                    str_pre4(p.add(13), p.add(12), p.add(72), p.add(73));
                    j += 64;
                }
            }

            if (right || (*p_sc).bVertTileBoundary != 0) && !bottom {
                if !top && (*p_sc).bHoriTileBoundary == 0 {
                    str_pre4(p0.offset(-1), p0.offset(-3), p1.offset(-59), p1.offset(-57));
                    str_pre4(p0.offset(-2), p0.offset(-4), p1.offset(-60), p1.offset(-58));
                }
                let mut j = -64;
                while j < -16 {
                    let p = p1.offset(j);
                    str_pre4(p.add(15), p.add(13), p.add(21), p.add(23));
                    str_pre4(p.add(14), p.add(12), p.add(20), p.add(22));
                    j += 16;
                }
            }
        }

        if !top {
            let mut j = if left { 48 } else { -16 };
            while j < if right { 48 } else { 112 } {
                str_dct4x4_stage1(p0.offset(j));
                j += 64;
            }
        }

        if !bottom {
            let mut j = if left { 0 } else { -64 };
            while j < if right { 0 } else { 64 } {
                str_dct4x4_stage1(p1.offset(j));
                str_dct4x4_stage1(p1.offset(j + 16));
                str_dct4x4_stage1(p1.offset(j + 32));
                j += 64;
            }
        }

        if ol_overlap == Overlap::Two {
            if (left_adjacent_column || (*p_sc).bOneMBRightVertTB != 0)
                && (top || (*p_sc).bHoriTileBoundary != 0)
            {
                *p1.offset(-128) -= *p1.offset(-128 + 64);
            }
            if (right_adjacent_column || (*p_sc).bOneMBLeftVertTB != 0)
                && (top || (*p_sc).bHoriTileBoundary != 0)
            {
                (*p_sc).iPredBefore[i][0] = *p1;
            }
            if (right || (*p_sc).bVertTileBoundary != 0) && (top || (*p_sc).bHoriTileBoundary != 0)
            {
                *p1.offset(-128 + 64) -= (*p_sc).iPredBefore[i][0];
            }
            if (left_adjacent_column || (*p_sc).bOneMBRightVertTB != 0)
                && (bottom || (*p_sc).bHoriTileBoundary != 0)
            {
                *p0.offset(-128 + 48) -= *p0.offset(-128 + 112);
            }
            if (right_adjacent_column || (*p_sc).bOneMBLeftVertTB != 0)
                && (bottom || (*p_sc).bHoriTileBoundary != 0)
            {
                (*p_sc).iPredBefore[i][1] = *p0.add(48);
            }
            if (right || (*p_sc).bVertTileBoundary != 0)
                && (bottom || (*p_sc).bHoriTileBoundary != 0)
            {
                *p0.offset(-128 + 112) -= (*p_sc).iPredBefore[i][1];
            }

            if !bottom {
                if left_or_right || (*p_sc).bVertTileBoundary != 0 {
                    if !top && (*p_sc).bHoriTileBoundary == 0 {
                        if left || (*p_sc).bVertTileBoundary != 0 {
                            str_pre2(&mut *p0.add(48), &mut *p1);
                        }
                        if right || (*p_sc).bVertTileBoundary != 0 {
                            str_pre2(&mut *p0.offset(48 - 64), &mut *p1.offset(-64));
                        }
                    }
                    if left || (*p_sc).bVertTileBoundary != 0 {
                        str_pre2(&mut *p1.add(16), &mut *p1.add(32));
                    }
                    if right || (*p_sc).bVertTileBoundary != 0 {
                        str_pre2(&mut *p1.offset(-48), &mut *p1.offset(-48 + 16));
                    }
                }

                if !left_or_right && (*p_sc).bVertTileBoundary == 0 {
                    if top || (*p_sc).bHoriTileBoundary != 0 {
                        str_pre2(&mut *p1.offset(-64), &mut *p1);
                    } else {
                        str_pre2x2(
                            &mut *p0.offset(-16),
                            &mut *p0.add(48),
                            &mut *p1.offset(-64),
                            &mut *p1,
                        );
                    }
                    str_pre2x2(
                        &mut *p1.offset(-48),
                        &mut *p1.add(16),
                        &mut *p1.offset(-32),
                        &mut *p1.add(32),
                    );
                }
            }

            if (bottom || (*p_sc).bHoriTileBoundary != 0)
                && !left_or_right
                && (*p_sc).bVertTileBoundary == 0
            {
                str_pre2(&mut *p0.offset(-16), &mut *p0.add(48));
            }

            if (left_adjacent_column || (*p_sc).bOneMBRightVertTB != 0)
                && (top || (*p_sc).bHoriTileBoundary != 0)
            {
                *p1.offset(-128) += *p1.offset(-128 + 64);
            }
            if (right_adjacent_column || (*p_sc).bOneMBLeftVertTB != 0)
                && (top || (*p_sc).bHoriTileBoundary != 0)
            {
                (*p_sc).iPredAfter[i][0] = *p1;
            }
            if (right || (*p_sc).bVertTileBoundary != 0) && (top || (*p_sc).bHoriTileBoundary != 0)
            {
                *p1.offset(-128 + 64) += (*p_sc).iPredAfter[i][0];
            }
            if (left_adjacent_column || (*p_sc).bOneMBRightVertTB != 0)
                && (bottom || (*p_sc).bHoriTileBoundary != 0)
            {
                *p0.offset(-128 + 48) += *p0.offset(-128 + 112);
            }
            if (right_adjacent_column || (*p_sc).bOneMBLeftVertTB != 0)
                && (bottom || (*p_sc).bHoriTileBoundary != 0)
            {
                (*p_sc).iPredAfter[i][1] = *p0.add(48);
            }
            if (right || (*p_sc).bVertTileBoundary != 0)
                && (bottom || (*p_sc).bHoriTileBoundary != 0)
            {
                *p0.offset(-128 + 112) += (*p_sc).iPredAfter[i][1];
            }
        }

        if !top_or_left {
            if (*p_sc).m_param.bScaledArith == 0 {
                str_dct2x2dn(
                    &mut *p0.offset(-128),
                    &mut *p0.offset(-64),
                    &mut *p0.offset(-112),
                    &mut *p0.offset(-48),
                );
                str_dct2x2dn(
                    &mut *p0.offset(-96),
                    &mut *p0.offset(-32),
                    &mut *p0.offset(-80),
                    &mut *p0.offset(-16),
                );
            } else {
                str_dct2x2dn_enc(
                    &mut *p0.offset(-128),
                    &mut *p0.offset(-64),
                    &mut *p0.offset(-112),
                    &mut *p0.offset(-48),
                );
                str_dct2x2dn_enc(
                    &mut *p0.offset(-96),
                    &mut *p0.offset(-32),
                    &mut *p0.offset(-80),
                    &mut *p0.offset(-16),
                );
            }

            *p0.offset(-96) -= *p0.offset(-128);
            *p0.offset(-128) += (*p0.offset(-96) + 1) >> 1;
        }

        i += 1;
    }
}
