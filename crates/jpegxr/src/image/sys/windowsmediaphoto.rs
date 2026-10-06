// Auto-generated scaffold for a faithful JXRLib translation restart.
// Keep one Rust item per original C item; replace stubs bottom-up.

use crate::jxrgluelib::jxrglue::{BitDepth, ColorFormat};
use std::ops::{BitAnd, BitXor, BitXorAssign, Shr, Sub};
use std::ptr::NonNull;

#[repr(i32)]
#[derive(Debug, Copy, Clone, Default, Eq, PartialEq, Ord, PartialOrd)]
pub enum BitDepthLayout {
    #[default]
    Short = 0,
    Long = 1,
    Max = 2,
}

#[repr(i32)]
#[derive(Debug, Copy, Clone, Default, Eq, PartialEq, Ord, PartialOrd)]
pub enum Orientation {
    #[default]
    None = 0,
    FlipV = 1,
    FlipH = 2,
    FlipVH = 3,
    RotateCw = 4,
    RotateCwFlipV = 5,
    RotateCwFlipH = 6,
    RotateCwFlipVH = 7,
    Max = 8,
}

#[repr(i32)]
#[derive(Debug, Copy, Clone, Default, Eq, PartialEq)]
pub enum BitstreamFormat {
    #[default]
    Spatial = 0,
    Frequency = 1,
}

#[repr(i32)]
#[derive(Debug, Copy, Clone, Eq, PartialEq)]
pub enum Overlap {
    None = 0,
    One = 1,
    Two = 2,
    Max = 3,
}

#[repr(i32)]
#[derive(Debug, Copy, Clone, Default, Eq, PartialEq, Ord, PartialOrd)]
pub enum Subband {
    #[default]
    All = 0,
    NoFlexbits = 1,
    NoHighpass = 2,
    DcOnly = 3,
    Isolated = 4,
    Max = 5,
}

#[repr(u8)]
#[derive(Debug, Copy, Clone, Eq, PartialEq)]
pub enum AlphaMode {
    None = 0,
    Interleaved = 1,
    Planar = 2,
    Only = 3,
}

impl AlphaMode {
    pub fn from_u8(value: u8) -> Option<Self> {
        match value {
            0 => Some(Self::None),
            1 => Some(Self::Interleaved),
            2 => Some(Self::Planar),
            3 => Some(Self::Only),
            _ => None,
        }
    }

    pub fn is_any(self) -> bool {
        self != Self::None
    }
}

impl Sub<i32> for Orientation {
    type Output = Self;

    fn sub(self, rhs: i32) -> Self::Output {
        match self as i32 - rhs {
            0 => Self::None,
            1 => Self::FlipV,
            2 => Self::FlipH,
            3 => Self::FlipVH,
            4 => Self::RotateCw,
            5 => Self::RotateCwFlipV,
            6 => Self::RotateCwFlipH,
            7 => Self::RotateCwFlipVH,
            _ => Self::Max,
        }
    }
}

impl BitXorAssign for Orientation {
    fn bitxor_assign(&mut self, rhs: Self) {
        *self = match *self as i32 ^ rhs as i32 {
            0 => Self::None,
            1 => Self::FlipV,
            2 => Self::FlipH,
            3 => Self::FlipVH,
            4 => Self::RotateCw,
            5 => Self::RotateCwFlipV,
            6 => Self::RotateCwFlipH,
            7 => Self::RotateCwFlipVH,
            _ => Self::Max,
        };
    }
}

impl BitXor<i32> for Orientation {
    type Output = Self;

    fn bitxor(self, rhs: i32) -> Self::Output {
        match self as i32 ^ rhs {
            0 => Self::None,
            1 => Self::FlipV,
            2 => Self::FlipH,
            3 => Self::FlipVH,
            4 => Self::RotateCw,
            5 => Self::RotateCwFlipV,
            6 => Self::RotateCwFlipH,
            7 => Self::RotateCwFlipVH,
            _ => Self::Max,
        }
    }
}

impl BitAnd<i32> for Orientation {
    type Output = i32;

    fn bitand(self, rhs: i32) -> Self::Output {
        self as i32 & rhs
    }
}

impl Shr<i32> for Orientation {
    type Output = i32;

    fn shr(self, rhs: i32) -> Self::Output {
        (self as i32) >> rhs
    }
}

pub const LOG_MAX_TILES: u32 = 12;
pub const MAX_TILES: u32 = 1 << LOG_MAX_TILES;

// Returns a boolean EOS flag (0/1), not a WMP error.
pub type WMPStreamEosFn = unsafe fn(&WMPStream) -> i32;
pub type WMPStreamReadFn = unsafe fn(&mut WMPStream, &mut [u8]) -> Result<(), crate::WmpError>;
pub type WMPStreamWriteFn = unsafe fn(&mut WMPStream, &[u8]) -> Result<(), crate::WmpError>;
pub type WMPStreamSetPosFn = unsafe fn(&mut WMPStream, usize) -> Result<(), crate::WmpError>;
pub type WMPStreamGetPosFn = unsafe fn(&mut WMPStream, &mut usize) -> Result<(), crate::WmpError>;

#[derive(Debug, Default)]
pub struct WMPStreamState {
    pub file: tagFile,
    pub buf: tagBuf,
    pub pv_obj: Option<NonNull<u8>>,
}

/// Original struct: `WMPStream` at `original/jxrlib/image/sys/windowsmediaphoto.h:282`.
#[repr(C)]
#[derive(Debug, Default)]
pub struct WMPStream {
    pub state: WMPStreamState,
    pub fMem: i32,
    pub EOS: Option<WMPStreamEosFn>,
    pub Read: Option<WMPStreamReadFn>,
    pub Write: Option<WMPStreamWriteFn>,
    pub SetPos: Option<WMPStreamSetPosFn>,
    pub GetPos: Option<WMPStreamGetPosFn>,
}

impl Clone for WMPStream {
    fn clone(&self) -> Self {
        Self {
            state: WMPStreamState {
                file: tagFile {
                    file: self
                        .state
                        .file
                        .file
                        .as_ref()
                        .and_then(|file| file.try_clone().ok()),
                    eos: self.state.file.eos,
                },
                buf: self.state.buf,
                pv_obj: self.state.pv_obj,
            },
            fMem: self.fMem,
            EOS: self.EOS,
            Read: self.Read,
            Write: self.Write,
            SetPos: self.SetPos,
            GetPos: self.GetPos,
        }
    }
}

/// Original struct: `tagFile` at `original/jxrlib/image/sys/windowsmediaphoto.h:286`.
#[derive(Debug, Default)]
pub struct tagFile {
    pub file: Option<std::fs::File>,
    pub eos: i32,
}

/// Original struct: `tagBuf` at `original/jxrlib/image/sys/windowsmediaphoto.h:291`.
#[repr(C)]
#[derive(Debug, Copy, Clone, Default)]
pub struct tagBuf {
    pub pbBuf: Option<NonNull<u8>>,
    pub cbBuf: usize,
    pub cbCur: usize,
    pub cbBufCount: usize,
}

/// Original struct: `tagCWMImageInfo` at `original/jxrlib/image/sys/windowsmediaphoto.h:326`.
#[repr(C)]
#[derive(Debug, Clone, Copy, Default)]
pub struct tagCWMImageInfo {
    pub cWidth: usize,
    pub cHeight: usize,
    pub cfColorFormat: ColorFormat,
    pub bdBitDepth: BitDepth,
    pub cBitsPerUnit: usize,
    pub cLeadingPadding: usize,
    pub bRGB: i32,
    pub cChromaCenteringX: u8,
    pub cChromaCenteringY: u8,
    pub cROILeftX: usize,
    pub cROIWidth: usize,
    pub cROITopY: usize,
    pub cROIHeight: usize,
    pub bSkipFlexbits: i32,
    pub cThumbnailWidth: usize,
    pub cThumbnailHeight: usize,
    pub oOrientation: Orientation,
    pub cPostProcStrength: u8,
    pub fPaddedUserBuffer: i32,
}

/// Original struct: `tagCWMIStrCodecParam` at `original/jxrlib/image/sys/windowsmediaphoto.h:358`.
#[derive(Debug, Clone, Copy)]
pub struct tagCWMIStrCodecParam {
    pub bVerbose: i32,
    pub uiDefaultQPIndex: u8,
    pub uiDefaultQPIndexYLP: u8,
    pub uiDefaultQPIndexYHP: u8,
    pub uiDefaultQPIndexU: u8,
    pub uiDefaultQPIndexULP: u8,
    pub uiDefaultQPIndexUHP: u8,
    pub uiDefaultQPIndexV: u8,
    pub uiDefaultQPIndexVLP: u8,
    pub uiDefaultQPIndexVHP: u8,
    pub uiDefaultQPIndexAlpha: u8,
    pub cfColorFormat: ColorFormat,
    pub bdBitDepth: BitDepthLayout,
    pub olOverlap: Overlap,
    pub bfBitstreamFormat: BitstreamFormat,
    pub cChannel: usize,
    pub uAlphaMode: u8,
    pub sbSubband: Subband,
    pub uiTrimFlexBits: u8,
    pub pWStream: Option<NonNull<WMPStream>>,
    pub cbStream: usize,
    pub cNumOfSliceMinus1V: u32,
    pub uiTileX: [u32; MAX_TILES as usize],
    pub cNumOfSliceMinus1H: u32,
    pub uiTileY: [u32; MAX_TILES as usize],
    pub nLenMantissaOrShift: u8,
    pub nExpBias: i8,
    pub bBlackWhite: i32,
    pub bUseHardTileBoundaries: i32,
    pub bProgressiveMode: i32,
    pub bYUVData: i32,
    pub bUnscaledArith: i32,
    pub fMeasurePerf: i32,
}

impl Default for tagCWMIStrCodecParam {
    fn default() -> Self {
        Self {
            bVerbose: 0,
            uiDefaultQPIndex: 0,
            uiDefaultQPIndexYLP: 0,
            uiDefaultQPIndexYHP: 0,
            uiDefaultQPIndexU: 0,
            uiDefaultQPIndexULP: 0,
            uiDefaultQPIndexUHP: 0,
            uiDefaultQPIndexV: 0,
            uiDefaultQPIndexVLP: 0,
            uiDefaultQPIndexVHP: 0,
            uiDefaultQPIndexAlpha: 0,
            cfColorFormat: ColorFormat::YOnly,
            bdBitDepth: BitDepthLayout::Short,
            olOverlap: Overlap::None,
            bfBitstreamFormat: BitstreamFormat::Spatial,
            cChannel: 0,
            uAlphaMode: 0,
            sbSubband: Subband::All,
            uiTrimFlexBits: 0,
            pWStream: None,
            cbStream: 0,
            cNumOfSliceMinus1V: 0,
            uiTileX: [0; MAX_TILES as usize],
            cNumOfSliceMinus1H: 0,
            uiTileY: [0; MAX_TILES as usize],
            nLenMantissaOrShift: 0,
            nExpBias: 0,
            bBlackWhite: 0,
            bUseHardTileBoundaries: 0,
            bProgressiveMode: 0,
            bYUVData: 0,
            bUnscaledArith: 0,
            fMeasurePerf: 0,
        }
    }
}

/// Original struct: `tagCWMImageBufferInfo` at `original/jxrlib/image/sys/windowsmediaphoto.h:409`.
#[derive(Debug, Clone, Copy, Default)]
pub struct tagCWMImageBufferInfo {
    pub pv: Option<NonNull<u8>>,
    pub cLine: usize,
    pub cbStride: usize,
}

/// Original struct: `tagCWMTranscodingParam` at `original/jxrlib/image/sys/windowsmediaphoto.h:472`.
#[derive(Debug, Clone, Default)]
pub struct tagCWMTranscodingParam {
    pub cLeftX: usize,
    pub cWidth: usize,
    pub cTopY: usize,
    pub cHeight: usize,
    pub bfBitstreamFormat: BitstreamFormat,
    pub uAlphaMode: u8,
    pub sbSubband: Subband,
    pub oOrientation: Orientation,
    pub bIgnoreOverlap: i32,
}

/// Original struct: `tagCWMDetilingParam` at `original/jxrlib/image/sys/windowsmediaphoto.h:492`.
#[derive(Debug, Clone)]
pub struct tagCWMDetilingParam {
    pub cWidth: usize,
    pub cHeight: usize,
    pub cChannel: usize,
    pub olOverlap: Overlap,
    pub bdBitdepth: BitDepthLayout,
    pub cNumOfSliceMinus1V: u32,
    pub uiTileX: [u32; MAX_TILES as usize],
    pub cNumOfSliceMinus1H: u32,
    pub uiTileY: [u32; MAX_TILES as usize],
    pub pImage: Option<NonNull<u8>>,
    pub cbStride: usize,
}

impl Default for tagCWMDetilingParam {
    fn default() -> Self {
        Self {
            cWidth: 0,
            cHeight: 0,
            cChannel: 0,
            olOverlap: Overlap::None,
            bdBitdepth: BitDepthLayout::Short,
            cNumOfSliceMinus1V: 0,
            uiTileX: [0; MAX_TILES as usize],
            cNumOfSliceMinus1H: 0,
            uiTileY: [0; MAX_TILES as usize],
            pImage: None,
            cbStride: 0,
        }
    }
}
