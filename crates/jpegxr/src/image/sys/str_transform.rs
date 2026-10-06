// Auto-generated scaffold for a faithful JXRLib translation restart.
// Keep one Rust item per original C item; replace stubs bottom-up.

/// Original function: `strDCT2x2dn` at `original/jxrlib/image/sys/strTransform.c:35`.
pub unsafe fn str_dct2x2dn(pa: &mut i32, pb: &mut i32, pc: &mut i32, pd: &mut i32) {
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

    *pa = a;
    *pb = b;
    *pc = c;
    *pd = d;
}

/// Original function: `strDCT2x2up` at `original/jxrlib/image/sys/strTransform.c:57`.
pub unsafe fn str_dct2x2up(pa: &mut i32, pb: &mut i32, pc: &mut i32, pd: &mut i32) {
    let mut a = *pa;
    let mut b = *pb;
    let c_orig = *pc;
    let mut d = *pd;

    a += d;
    b -= c_orig;
    let t = (a - b + 1) >> 1;
    let c = t - d;
    d = t - c_orig;
    a -= d;
    b += c;

    *pa = a;
    *pb = b;
    *pc = c;
    *pd = d;
}

/// Original function: `FOURBUTTERFLY_HARDCODED1` at `original/jxrlib/image/sys/strTransform.c:79`.
pub unsafe fn fourbutterfly_hardcoded1(p: &mut [i32]) {
    let p = p.as_mut_ptr();
    str_dct2x2dn(
        &mut *p.add(0),
        &mut *p.add(4),
        &mut *p.add(8),
        &mut *p.add(12),
    );
    str_dct2x2dn(
        &mut *p.add(1),
        &mut *p.add(5),
        &mut *p.add(9),
        &mut *p.add(13),
    );
    str_dct2x2dn(
        &mut *p.add(2),
        &mut *p.add(6),
        &mut *p.add(10),
        &mut *p.add(14),
    );
    str_dct2x2dn(
        &mut *p.add(3),
        &mut *p.add(7),
        &mut *p.add(11),
        &mut *p.add(15),
    );
}
