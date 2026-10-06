// Auto-generated scaffold for a faithful JXRLib translation restart.
// Keep one Rust item per original C item; replace stubs bottom-up.

#[repr(i32)]
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub enum Band {
    Header = 0,
    #[default]
    Dc = 1,
    Lp = 2,
    Ac = 3,
    Fl = 4,
}

pub const CONTEXTX: i32 = 8;
pub const CTDC: i32 = 5;
pub const NUMVLCTABLES: i32 = 21;
pub const CBLK_CHROMAS: [i32; 9] = [0, 4, 8, 16, 16, 16, 16, 0, 0];
pub const AVG_NDIFF: i32 = 3;
pub const MAXTOTAL: u32 = 32767;

/// Original struct: `CAdaptiveHuffman` at `original/jxrlib/image/sys/common.h:67`.
#[repr(C)]
#[derive(Debug, Clone, Copy, Default)]
pub struct CAdaptiveHuffman {
    pub m_iNSymbols: i32,
    pub m_pTable: Option<&'static [i32]>,
    pub m_pDelta: Option<&'static [i32]>,
    pub m_pDelta1: Option<&'static [i32]>,
    pub m_iTableIndex: i32,
    pub m_hufDecTable: Option<&'static [i16]>,
    pub m_bInitialize: i32,
    pub m_iDiscriminant: i32,
    pub m_iDiscriminant1: i32,
    pub m_iUpperBound: i32,
    pub m_iLowerBound: i32,
}

/// Original struct: `CAdaptiveModel` at `original/jxrlib/image/sys/common.h:86`.
#[repr(C)]
#[derive(Debug, Clone, Default)]
pub struct CAdaptiveModel {
    pub m_iFlcState: [i32; 2],
    pub m_iFlcBits: [i32; 2],
    pub m_band: Band,
}

/// Original struct: `CCBPModel` at `original/jxrlib/image/sys/common.h:92`.
#[repr(C)]
#[derive(Debug, Clone, Default)]
pub struct CCBPModel {
    pub m_iCount0: [i32; 2],
    pub m_iCount1: [i32; 2],
    pub m_iState: [i32; 2],
}
