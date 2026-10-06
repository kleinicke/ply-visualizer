// Auto-generated scaffold for a faithful JXRLib translation restart.
// Keep one Rust item per original C item; replace stubs bottom-up.

use crate::image::sys::common::CAdaptiveHuffman;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum CodingMode {
    Encoder,
    Decoder,
}

static G4_HUFF_LOOKUP_TABLE: [i16; 40] = [
    19, 19, 19, 19, 27, 27, 27, 27, 10, 10, 10, 10, 10, 10, 10, 10, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
    1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0,
];
static G5_HUFF_LOOKUP_TABLE: [[i16; 42]; 2] = [
    [
        28, 28, 36, 36, 19, 19, 19, 19, 10, 10, 10, 10, 10, 10, 10, 10, 1, 1, 1, 1, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    [
        11, 11, 11, 11, 19, 19, 19, 19, 27, 27, 27, 27, 35, 35, 35, 35, 1, 1, 1, 1, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
];
static G6_HUFF_LOOKUP_TABLE: [[i16; 44]; 4] = [
    [
        13, 29, 44, 44, 19, 19, 19, 19, 34, 34, 34, 34, 34, 34, 34, 34, 1, 1, 1, 1, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    [
        12, 12, 28, 28, 43, 43, 43, 43, 2, 2, 2, 2, 2, 2, 2, 2, 18, 18, 18, 18, 18, 18, 18, 18, 34,
        34, 34, 34, 34, 34, 34, 34, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    [
        4, 4, 12, 12, 43, 43, 43, 43, 18, 18, 18, 18, 18, 18, 18, 18, 26, 26, 26, 26, 26, 26, 26,
        26, 34, 34, 34, 34, 34, 34, 34, 34, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    [
        5, 13, 36, 36, 43, 43, 43, 43, 18, 18, 18, 18, 18, 18, 18, 18, 25, 25, 25, 25, 25, 25, 25,
        25, 25, 25, 25, 25, 25, 25, 25, 25, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
];
static G7_HUFF_LOOKUP_TABLE: [[i16; 46]; 2] = [
    [
        45, 53, 36, 36, 27, 27, 27, 27, 2, 2, 2, 2, 2, 2, 2, 2, 10, 10, 10, 10, 10, 10, 10, 10, 18,
        18, 18, 18, 18, 18, 18, 18, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    [
        -32736, 37, 28, 28, 19, 19, 19, 19, 10, 10, 10, 10, 10, 10, 10, 10, 1, 1, 1, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 1, 1, 1, 1, 5, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
];
static G8_HUFF_LOOKUP_TABLE: [[i16; 48]; 2] = [
    [
        53, 21, 28, 28, 11, 11, 11, 11, 43, 43, 43, 43, 59, 59, 59, 59, 2, 2, 2, 2, 2, 2, 2, 2, 34,
        34, 34, 34, 34, 34, 34, 34, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    [
        52, 52, 20, 20, 3, 3, 3, 3, 11, 11, 11, 11, 27, 27, 27, 27, 35, 35, 35, 35, 43, 43, 43, 43,
        58, 58, 58, 58, 58, 58, 58, 58, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
];
static G9_HUFF_LOOKUP_TABLE: [[i16; 50]; 2] = [
    [
        13, 29, 37, 61, 20, 20, 68, 68, 3, 3, 3, 3, 51, 51, 51, 51, 41, 41, 41, 41, 41, 41, 41, 41,
        41, 41, 41, 41, 41, 41, 41, 41, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    [
        -32736, 53, 28, 28, 11, 11, 11, 11, 19, 19, 19, 19, 43, 43, 43, 43, 1, 1, 1, 1, 1, 1, 1, 1,
        1, 1, 1, 1, 1, 1, 1, 1, -32734, 4, 7, 8, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
];
static G12_HUFF_LOOKUP_TABLE: [[i16; 56]; 5] = [
    [
        -32736, 5, 76, 76, 37, 53, 69, 85, 43, 43, 43, 43, 91, 91, 91, 91, 57, 57, 57, 57, 57, 57,
        57, 57, 57, 57, 57, 57, 57, 57, 57, 57, -32734, 1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
    [
        -32736, 85, 13, 53, 4, 4, 36, 36, 43, 43, 43, 43, 67, 67, 67, 67, 75, 75, 75, 75, 91, 91,
        91, 91, 58, 58, 58, 58, 58, 58, 58, 58, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0,
    ],
    [
        -32736, 37, 92, 92, 11, 11, 11, 11, 43, 43, 43, 43, 59, 59, 59, 59, 67, 67, 67, 67, 75, 75,
        75, 75, 2, 2, 2, 2, 2, 2, 2, 2, -32734, -32732, 2, 3, 6, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
    ],
    [
        -32736, 29, 37, 69, 3, 3, 3, 3, 43, 43, 43, 43, 59, 59, 59, 59, 75, 75, 75, 75, 91, 91, 91,
        91, 10, 10, 10, 10, 10, 10, 10, 10, -32734, 10, 2, 6, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0, 0, 0,
    ],
    [
        -32736, 93, 28, 28, 60, 60, 76, 76, 3, 3, 3, 3, 43, 43, 43, 43, 9, 9, 9, 9, 9, 9, 9, 9, 9,
        9, 9, 9, 9, 9, 9, 9, -32734, -32732, -32730, 2, 4, 8, 6, 10, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
        0, 0, 0, 0, 0, 0,
    ],
];

static G4_CODE_TABLE: [i32; 9] = [4, 1, 1, 1, 2, 0, 3, 1, 3];
static G5_CODE_TABLE: [i32; 22] = [
    5, 1, 1, 1, 2, 1, 3, 0, 4, 1, 4, 5, 1, 1, 0, 3, 1, 3, 2, 3, 3, 3,
];
static G5_DELTA_TABLE: [i32; 5] = [0, -1, 0, 1, 1];
static G6_CODE_TABLE: [i32; 52] = [
    6, 1, 1, 0, 5, 1, 3, 1, 5, 1, 2, 1, 4, 6, 1, 2, 0, 4, 2, 2, 1, 4, 3, 2, 1, 3, 6, 0, 4, 1, 4, 1,
    2, 2, 2, 3, 2, 1, 3, 6, 0, 5, 1, 5, 1, 2, 1, 1, 1, 4, 1, 3,
];
static G6_DELTA_TABLE: [i32; 18] = [-1, 1, 1, 1, 0, 1, -2, 0, 0, 2, 0, 0, -1, -1, 0, 1, -2, 0];
static G7_CODE_TABLE: [i32; 30] = [
    7, 1, 2, 2, 2, 3, 2, 1, 3, 1, 4, 0, 5, 1, 5, 7, 1, 1, 1, 2, 1, 3, 1, 4, 1, 5, 0, 6, 1, 6,
];
static G7_DELTA_TABLE: [i32; 7] = [1, 0, -1, -1, -1, -1, -1];
static G8_CODE_TABLE: [i32; 34] = [
    8, 2, 2, 1, 3, 1, 5, 1, 4, 3, 2, 2, 3, 0, 5, 3, 3, 8, 1, 3, 2, 3, 1, 4, 3, 3, 4, 3, 5, 3, 0, 4,
    3, 2,
];
static G9_CODE_TABLE: [i32; 38] = [
    9, 2, 3, 0, 5, 2, 4, 1, 5, 2, 5, 1, 1, 3, 3, 3, 5, 3, 4, 9, 1, 1, 1, 3, 2, 3, 1, 4, 1, 6, 3, 3,
    1, 5, 0, 7, 1, 7,
];
static G9_DELTA_TABLE: [i32; 9] = [2, 2, 1, 1, -1, -2, -2, -2, -3];
static G12_CODE_TABLE: [i32; 125] = [
    12, 1, 5, 1, 6, 0, 7, 1, 7, 4, 5, 2, 3, 5, 5, 1, 1, 6, 5, 1, 4, 7, 5, 3, 3, 12, 2, 4, 2, 5, 0,
    6, 1, 6, 3, 4, 2, 3, 3, 5, 3, 2, 3, 3, 4, 3, 1, 5, 5, 3, 12, 3, 2, 1, 3, 0, 7, 1, 7, 1, 5, 2,
    3, 2, 7, 3, 3, 4, 3, 5, 3, 3, 7, 1, 4, 12, 1, 3, 3, 2, 0, 7, 1, 5, 2, 5, 2, 3, 1, 7, 3, 3, 3,
    5, 4, 3, 1, 6, 5, 3, 12, 2, 3, 1, 1, 1, 7, 1, 4, 2, 7, 3, 3, 0, 8, 2, 4, 3, 7, 3, 4, 1, 8, 1,
    5,
];
static G12_DELTA_TABLE: [i32; 48] = [
    1, 1, 1, 1, 1, 0, 0, -1, 2, 1, 0, 0, 2, 2, -1, -1, -1, 0, -2, -1, 0, 0, -2, -1, -1, 1, 0, 2, 0,
    0, 0, 0, -2, 0, 1, 1, 0, 1, 0, 1, -2, 0, -1, -1, -2, -1, -2, -2,
];

const THRESHOLD: i32 = 8;
const MEMORY: i32 = 8;
static G_MAX_TABLES: [i32; 13] = [0, 0, 0, 0, 1, 2, 4, 2, 2, 2, 0, 0, 5];
static G_SECOND_DISC: [i32; 13] = [0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1];

/// Original function: `Allocate` at `original/jxrlib/image/sys/adapthuff.c:135`.
pub unsafe fn allocate(i_n_symbols: i32, _cm: CodingMode) -> Option<Box<CAdaptiveHuffman>> {
    if i_n_symbols > 255 || i_n_symbols <= 0 {
        return None;
    }

    Some(Box::new(CAdaptiveHuffman {
        m_iNSymbols: i_n_symbols,
        m_pTable: None,
        m_pDelta: None,
        m_pDelta1: None,
        m_iTableIndex: 0,
        m_hufDecTable: None,
        m_bInitialize: 0,
        m_iDiscriminant: 0,
        m_iDiscriminant1: 0,
        m_iUpperBound: 0,
        m_iLowerBound: 0,
    }))
}

/// Original function: `AdaptDiscriminant` at `original/jxrlib/image/sys/adapthuff.c:413`.
pub unsafe fn adapt_discriminant(ad_huff: &mut CAdaptiveHuffman) {
    let i_sym = ad_huff.m_iNSymbols;
    let mut p_delta: Option<&'static [i32]> = None;
    let mut changed = false;

    if ad_huff.m_bInitialize == 0 {
        ad_huff.m_bInitialize = 1;
        ad_huff.m_iDiscriminant = 0;
        ad_huff.m_iDiscriminant1 = 0;
        ad_huff.m_iTableIndex = G_SECOND_DISC[i_sym as usize];
    }

    let d_l = ad_huff.m_iDiscriminant;
    let mut d_h = ad_huff.m_iDiscriminant;
    if G_SECOND_DISC[i_sym as usize] != 0 {
        d_h = ad_huff.m_iDiscriminant1;
    }

    if d_l < ad_huff.m_iLowerBound {
        ad_huff.m_iTableIndex -= 1;
        changed = true;
    } else if d_h > ad_huff.m_iUpperBound {
        ad_huff.m_iTableIndex += 1;
        changed = true;
    }
    if changed {
        ad_huff.m_iDiscriminant = 0;
        ad_huff.m_iDiscriminant1 = 0;
    }

    ad_huff.m_iDiscriminant = ad_huff
        .m_iDiscriminant
        .clamp(-THRESHOLD * MEMORY, THRESHOLD * MEMORY);

    ad_huff.m_iDiscriminant1 = ad_huff
        .m_iDiscriminant1
        .clamp(-THRESHOLD * MEMORY, THRESHOLD * MEMORY);

    let t = ad_huff.m_iTableIndex;
    debug_assert!(t >= 0);
    debug_assert!(t < G_MAX_TABLES[i_sym as usize]);

    ad_huff.m_iLowerBound = if t == 0 { i32::MIN } else { -THRESHOLD };
    ad_huff.m_iUpperBound = if t == G_MAX_TABLES[i_sym as usize] - 1 {
        1 << 30
    } else {
        THRESHOLD
    };

    let p_codes = match i_sym {
        4 => {
            ad_huff.m_hufDecTable = Some(&G4_HUFF_LOOKUP_TABLE);
            &G4_CODE_TABLE[..]
        }
        5 => {
            p_delta = Some(&G5_DELTA_TABLE);
            ad_huff.m_hufDecTable = Some(&G5_HUFF_LOOKUP_TABLE[t as usize]);
            &G5_CODE_TABLE[((i_sym * 2 + 1) * t) as usize..]
        }
        6 => {
            ad_huff.m_pDelta1 = Some(
                &G6_DELTA_TABLE
                    [(i_sym * (t - i32::from(t + 1 == G_MAX_TABLES[i_sym as usize]))) as usize..],
            );
            p_delta = Some(&G6_DELTA_TABLE[((t - 1 + i32::from(t == 0)) * i_sym) as usize..]);
            ad_huff.m_hufDecTable = Some(&G6_HUFF_LOOKUP_TABLE[t as usize]);
            &G6_CODE_TABLE[((i_sym * 2 + 1) * t) as usize..]
        }
        7 => {
            p_delta = Some(&G7_DELTA_TABLE);
            ad_huff.m_hufDecTable = Some(&G7_HUFF_LOOKUP_TABLE[t as usize]);
            &G7_CODE_TABLE[((i_sym * 2 + 1) * t) as usize..]
        }
        8 => {
            ad_huff.m_hufDecTable = Some(&G8_HUFF_LOOKUP_TABLE[0]);
            &G8_CODE_TABLE[..]
        }
        9 => {
            p_delta = Some(&G9_DELTA_TABLE);
            ad_huff.m_hufDecTable = Some(&G9_HUFF_LOOKUP_TABLE[t as usize]);
            &G9_CODE_TABLE[((i_sym * 2 + 1) * t) as usize..]
        }
        12 => {
            ad_huff.m_pDelta1 = Some(
                &G12_DELTA_TABLE
                    [(i_sym * (t - i32::from(t + 1 == G_MAX_TABLES[i_sym as usize]))) as usize..],
            );
            p_delta = Some(&G12_DELTA_TABLE[((t - 1 + i32::from(t == 0)) * i_sym) as usize..]);
            ad_huff.m_hufDecTable = Some(&G12_HUFF_LOOKUP_TABLE[t as usize]);
            &G12_CODE_TABLE[((i_sym * 2 + 1) * t) as usize..]
        }
        _ => {
            debug_assert!(false);
            return;
        }
    };

    ad_huff.m_pTable = Some(p_codes);
    ad_huff.m_pDelta = p_delta;
}
