// Auto-generated scaffold for a faithful JXRLib translation restart.
// Keep one Rust item per original C item; replace stubs bottom-up.

use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::ptr::NonNull;

use super::windowsmediaphoto::{
    tagCWMIStrCodecParam, tagCWMImageBufferInfo, tagCWMImageInfo, BitstreamFormat, Subband,
    WMPStream, MAX_TILES,
};
use crate::image::decode::decode::CWMDecoderParameters;
use crate::image::sys::common::{
    CAdaptiveHuffman, CAdaptiveModel, CCBPModel, CBLK_CHROMAS, NUMVLCTABLES,
};
use crate::image::sys::perf_timer::PerfTimerState;
use crate::image::sys::perf_timer_ansi::perf_timer_get_results;
use crate::image::sys::str_pred_quant::{remap_qp, SHIFTZERO};
use crate::jxrgluelib::jxrglue::{BitDepth, ColorFormat};
use crate::WmpError;

pub const PACKETLENGTH: usize = 1 << 12;
pub const MAX_CHANNELS: usize = 16;

pub const dct_index: [[i32; 16]; 3] = [
    [0, 5, 1, 6, 10, 12, 8, 14, 2, 4, 3, 7, 9, 13, 11, 15],
    [0, 5, 1, 6, 10, 12, 8, 14, 2, 4, 3, 7, 9, 13, 11, 15],
    [
        0, 128, 64, 208, 32, 240, 48, 224, 16, 192, 80, 144, 112, 176, 96, 160,
    ],
];
pub const blk_offset: [i32; 16] = [
    0, 64, 16, 80, 128, 192, 144, 208, 32, 96, 48, 112, 160, 224, 176, 240,
];
pub const blk_offset_uv: [i32; 4] = [0, 32, 16, 48];
pub const blk_offset_uv_422: [i32; 8] = [0, 64, 16, 80, 32, 96, 48, 112];

pub const idx_cc: [[u8; 16]; 16] = [
    [
        0x00, 0x01, 0x05, 0x04, 0x40, 0x41, 0x45, 0x44, 0x80, 0x81, 0x85, 0x84, 0xc0, 0xc1, 0xc5,
        0xc4,
    ],
    [
        0x02, 0x03, 0x07, 0x06, 0x42, 0x43, 0x47, 0x46, 0x82, 0x83, 0x87, 0x86, 0xc2, 0xc3, 0xc7,
        0xc6,
    ],
    [
        0x0a, 0x0b, 0x0f, 0x0e, 0x4a, 0x4b, 0x4f, 0x4e, 0x8a, 0x8b, 0x8f, 0x8e, 0xca, 0xcb, 0xcf,
        0xce,
    ],
    [
        0x08, 0x09, 0x0d, 0x0c, 0x48, 0x49, 0x4d, 0x4c, 0x88, 0x89, 0x8d, 0x8c, 0xc8, 0xc9, 0xcd,
        0xcc,
    ],
    [
        0x10, 0x11, 0x15, 0x14, 0x50, 0x51, 0x55, 0x54, 0x90, 0x91, 0x95, 0x94, 0xd0, 0xd1, 0xd5,
        0xd4,
    ],
    [
        0x12, 0x13, 0x17, 0x16, 0x52, 0x53, 0x57, 0x56, 0x92, 0x93, 0x97, 0x96, 0xd2, 0xd3, 0xd7,
        0xd6,
    ],
    [
        0x1a, 0x1b, 0x1f, 0x1e, 0x5a, 0x5b, 0x5f, 0x5e, 0x9a, 0x9b, 0x9f, 0x9e, 0xda, 0xdb, 0xdf,
        0xde,
    ],
    [
        0x18, 0x19, 0x1d, 0x1c, 0x58, 0x59, 0x5d, 0x5c, 0x98, 0x99, 0x9d, 0x9c, 0xd8, 0xd9, 0xdd,
        0xdc,
    ],
    [
        0x20, 0x21, 0x25, 0x24, 0x60, 0x61, 0x65, 0x64, 0xa0, 0xa1, 0xa5, 0xa4, 0xe0, 0xe1, 0xe5,
        0xe4,
    ],
    [
        0x22, 0x23, 0x27, 0x26, 0x62, 0x63, 0x67, 0x66, 0xa2, 0xa3, 0xa7, 0xa6, 0xe2, 0xe3, 0xe7,
        0xe6,
    ],
    [
        0x2a, 0x2b, 0x2f, 0x2e, 0x6a, 0x6b, 0x6f, 0x6e, 0xaa, 0xab, 0xaf, 0xae, 0xea, 0xeb, 0xef,
        0xee,
    ],
    [
        0x28, 0x29, 0x2d, 0x2c, 0x68, 0x69, 0x6d, 0x6c, 0xa8, 0xa9, 0xad, 0xac, 0xe8, 0xe9, 0xed,
        0xec,
    ],
    [
        0x30, 0x31, 0x35, 0x34, 0x70, 0x71, 0x75, 0x74, 0xb0, 0xb1, 0xb5, 0xb4, 0xf0, 0xf1, 0xf5,
        0xf4,
    ],
    [
        0x32, 0x33, 0x37, 0x36, 0x72, 0x73, 0x77, 0x76, 0xb2, 0xb3, 0xb7, 0xb6, 0xf2, 0xf3, 0xf7,
        0xf6,
    ],
    [
        0x3a, 0x3b, 0x3f, 0x3e, 0x7a, 0x7b, 0x7f, 0x7e, 0xba, 0xbb, 0xbf, 0xbe, 0xfa, 0xfb, 0xff,
        0xfe,
    ],
    [
        0x38, 0x39, 0x3d, 0x3c, 0x78, 0x79, 0x7d, 0x7c, 0xb8, 0xb9, 0xbd, 0xbc, 0xf8, 0xf9, 0xfd,
        0xfc,
    ],
];

pub const idx_cc_420: [[u8; 8]; 8] = [
    [0x00, 0x01, 0x05, 0x04, 0x20, 0x21, 0x25, 0x24],
    [0x02, 0x03, 0x07, 0x06, 0x22, 0x23, 0x27, 0x26],
    [0x0a, 0x0b, 0x0f, 0x0e, 0x2a, 0x2b, 0x2f, 0x2e],
    [0x08, 0x09, 0x0d, 0x0c, 0x28, 0x29, 0x2d, 0x2c],
    [0x10, 0x11, 0x15, 0x14, 0x30, 0x31, 0x35, 0x34],
    [0x12, 0x13, 0x17, 0x16, 0x32, 0x33, 0x37, 0x36],
    [0x1a, 0x1b, 0x1f, 0x1e, 0x3a, 0x3b, 0x3f, 0x3e],
    [0x18, 0x19, 0x1d, 0x1c, 0x38, 0x39, 0x3d, 0x3c],
];

/// Original struct: `tagIOContext` at `original/jxrlib/image/sys/strcodec.h:125`.
#[derive(Debug, Clone, Default)]
pub struct tagIOContext {
    pub P0: Option<NonNull<i32>>,
    pub P1: Option<NonNull<i32>>,
    pub P2Info: Option<NonNull<i32>>,
    pub P3: Option<NonNull<i32>>,
}

/// Original struct: `tagMemReadState` at `original/jxrlib/image/sys/strcodec.h:158`.
#[derive(Debug, Clone, Default)]
pub struct tagMemReadState {
    pub pbBuf: Option<NonNull<u8>>,
    pub cbBuf: usize,
    pub cbCur: usize,
}

/// Original struct: `tagBitIOInfo` at `original/jxrlib/image/sys/strcodec.h:165`.
#[repr(C)]
#[derive(Debug, Clone, Copy, Default)]
pub struct tagBitIOInfo {
    pub uiShadow: u32,
    pub uiAccumulator: u32,
    pub cBitsUsed: u32,
    pub iMask: i32,
    pub pbStart: *mut u8,
    pub pbCurrent: *mut u8,
    pub pWS: Option<NonNull<WMPStream>>,
    pub offRef: usize,
}

/// Original struct: `tagCWMIQuantizer` at `original/jxrlib/image/sys/strcodec.h:191`.
#[repr(C)]
#[derive(Debug, Clone, Copy, Default)]
pub struct tagCWMIQuantizer {
    pub iIndex: u8,
    pub iQP: i32,
    pub iOffset: i32,
    pub iMan: i32,
    pub iExp: i32,
}

/// Original struct: `tagCWMIMBInfo` at `original/jxrlib/image/sys/strcodec.h:204`.
#[repr(C)]
#[derive(Debug, Clone, Default)]
pub struct tagCWMIMBInfo {
    pub iBlockDC: [[i32; 16]; MAX_CHANNELS],
    pub iOrientation: i32,
    pub iCBP: [i32; MAX_CHANNELS],
    pub iDiffCBP: [i32; MAX_CHANNELS],
    pub iQIndexLP: u8,
    pub iQIndexHP: u8,
}

pub type ImageDataProc = unsafe fn(&mut CWMImageStrCodec) -> Result<(), WmpError>;

/// Original struct: `CAdaptiveScan` at `original/jxrlib/image/sys/strcodec.h:218`.
#[repr(C)]
#[derive(Debug, Clone, Copy, Default)]
pub struct CAdaptiveScan {
    pub uTotal: u32,
    pub uScan: u32,
}

/// Original struct: `CCodingContext` at `original/jxrlib/image/sys/strcodec.h:224`.
#[repr(C)]
#[derive(Debug, Clone, Default)]
pub struct CCodingContext {
    pub m_pIODC: *mut tagBitIOInfo,
    pub m_pIOLP: *mut tagBitIOInfo,
    pub m_pIOAC: *mut tagBitIOInfo,
    pub m_pIOFL: *mut tagBitIOInfo,
    pub m_pAdaptHuffCBPCY: Option<NonNull<CAdaptiveHuffman>>,
    pub m_pAdaptHuffCBPCY1: Option<NonNull<CAdaptiveHuffman>>,
    pub m_pAHexpt: [Option<NonNull<CAdaptiveHuffman>>; NUMVLCTABLES as usize],
    pub m_pAdaptHuffCBPCYMemory: Option<Box<CAdaptiveHuffman>>,
    pub m_pAdaptHuffCBPCY1Memory: Option<Box<CAdaptiveHuffman>>,
    pub m_pAHexptMemory: [Option<Box<CAdaptiveHuffman>>; NUMVLCTABLES as usize],
    pub m_aScanLowpass: [CAdaptiveScan; 16],
    pub m_aScanHoriz: [CAdaptiveScan; 16],
    pub m_aScanVert: [CAdaptiveScan; 16],
    pub m_aModelAC: CAdaptiveModel,
    pub m_aModelLP: CAdaptiveModel,
    pub m_aModelDC: CAdaptiveModel,
    pub m_iCBPCountZero: i32,
    pub m_iCBPCountMax: i32,
    pub m_aCBPModel: CCBPModel,
    pub m_iTrimFlexBits: i32,
    pub m_bInROI: i32,
}

#[repr(C, align(16384))]
#[derive(Debug, Clone)]
struct BitIoBlock {
    packet: [u8; PACKETLENGTH * 2],
    io: tagBitIOInfo,
}

impl Default for BitIoBlock {
    fn default() -> Self {
        Self {
            packet: [0; PACKETLENGTH * 2],
            io: tagBitIOInfo::default(),
        }
    }
}

#[derive(Debug)]
pub struct BitIoStorage {
    slots: Box<[Option<NonNull<tagBitIOInfo>>]>,
    blocks: Box<[BitIoBlock]>,
}

impl Clone for BitIoStorage {
    fn clone(&self) -> Self {
        let mut blocks = self.blocks.clone();
        let slots = blocks
            .iter_mut()
            .map(|block| Some(NonNull::from(&mut block.io)))
            .collect::<Vec<_>>()
            .into_boxed_slice();

        Self { slots, blocks }
    }
}

/// Original struct: `tagCWMIPredInfo` at `original/jxrlib/image/sys/strcodec.h:260`.
#[derive(Debug, Clone, Default)]
pub struct tagCWMIPredInfo {
    pub iQPIndex: i32,
    pub iCBP: i32,
    pub iDC: i32,
    pub iAD: [i32; 6],
    pub piAD: Option<NonNull<i32>>,
}

/// Original struct: `CWMImageStrCodecParameters` at `original/jxrlib/image/sys/strcodec.h:269`.
#[derive(Debug, Clone, Default)]
pub struct CWMImageStrCodecParameters {
    pub cVersion: usize,
    pub cSubVersion: usize,
    pub cfColorFormat: ColorFormat,
    pub bRBSwapped: i32,
    pub bAlphaChannel: i32,
    pub bScaledArith: i32,
    pub bIndexTable: i32,
    pub bTrimFlexbitsFlag: i32,
    pub bUseHardTileBoundaries: i32,
    pub cNumChannels: usize,
    pub cExtraPixelsTop: usize,
    pub cExtraPixelsLeft: usize,
    pub cExtraPixelsBottom: usize,
    pub cExtraPixelsRight: usize,
    pub bTranscode: i32,
    pub uQPMode: u32,
    pub uiQPIndexDC: [u8; MAX_CHANNELS],
    pub uiQPIndexLP: [u8; MAX_CHANNELS],
    pub uiQPIndexHP: [u8; MAX_CHANNELS],
}

/// Original struct: `CWMITile` at `original/jxrlib/image/sys/strcodec.h:291`.
#[repr(C)]
#[derive(Debug, Clone, Default)]
pub struct CWMITile {
    pub pQuantizerDC: [Option<NonNull<tagCWMIQuantizer>>; MAX_CHANNELS],
    pub pQuantizerLP: [Option<NonNull<tagCWMIQuantizer>>; MAX_CHANNELS],
    pub pQuantizerHP: [Option<NonNull<tagCWMIQuantizer>>; MAX_CHANNELS],
    pub pQuantizerDCMemory: Option<Box<[tagCWMIQuantizer]>>,
    pub pQuantizerLPMemory: Option<Box<[tagCWMIQuantizer]>>,
    pub pQuantizerHPMemory: Option<Box<[tagCWMIQuantizer]>>,
    pub cQuantizerDCMemory: usize,
    pub cQuantizerLPMemory: usize,
    pub cQuantizerHPMemory: usize,
    pub cNumQPLP: u8,
    pub cNumQPHP: u8,
    pub cBitsLP: u8,
    pub cBitsHP: u8,
    pub bUseDC: i32,
    pub bUseLP: i32,
    pub cChModeDC: u8,
    pub cChModeLP: [u8; 16],
    pub cChModeHP: [u8; 16],
}

/// Original struct: `tagPostProcInfo` at `original/jxrlib/image/sys/strcodec.h:312`.
#[repr(C)]
#[derive(Debug, Clone, Copy, Default)]
pub struct tagPostProcInfo {
    pub iMBDC: i32,
    pub ucMBTexture: u8,
    pub iBlockDC: [[i32; 4]; 4],
    pub ucBlockTexture: [[u8; 4]; 4],
}

/// Original struct: `CWMImageStrCodec` at `original/jxrlib/image/sys/strcodec.h:319`.
#[derive(Debug, Clone, Default)]
pub struct CWMImageStrCodec {
    pub cbStruct: usize,
    pub cCodecMemory: usize,
    pub pCodecMemory: Option<Box<[usize]>>,
    pub WMII: tagCWMImageInfo,
    pub WMISCP: tagCWMIStrCodecParam,
    pub WMIBI: tagCWMImageBufferInfo,
    pub MBInfo: tagCWMIMBInfo,
    pub m_param: CWMImageStrCodecParameters,
    pub m_Dparam: Option<NonNull<CWMDecoderParameters>>,
    pub pDparamMemory: Option<Box<CWMDecoderParameters>>,
    pub cSB: u8,
    pub m_bUVResolutionChange: i32,
    pub bTileExtraction: i32,
    pub pIOHeader: Option<NonNull<tagBitIOInfo>>,
    pub bUseHardTileBoundaries: i32,
    pub pInterU: Option<NonNull<i32>>,
    pub pInterV: Option<NonNull<i32>>,
    pub pIndexTableMemory: Option<Box<[usize]>>,
    pub cIndexTableMemory: usize,
    pub cTileRow: usize,
    pub cTileColumn: usize,
    pub m_bCtxLeft: i32,
    pub m_bCtxTop: i32,
    pub m_bResetRGITotals: i32,
    pub m_bResetContext: i32,
    pub pTileMemory: Option<Box<[CWMITile]>>,
    pub cTileMemory: usize,
    pub m_ppBitIO: Option<NonNull<Option<NonNull<tagBitIOInfo>>>>,
    pub m_ppBitIOMemory: Option<Box<BitIoStorage>>,
    pub cBitIOMemory: usize,
    pub cNumBitIO: usize,
    pub cHeaderSize: usize,
    pub pCodingContextMemory: Option<Box<[CCodingContext]>>,
    pub cNumCodingContext: usize,
    pub cNumOfQPIndex: usize,
    pub cBitsDQUANT: u8,
    pub cRow: usize,
    pub cColumn: usize,
    pub cmbWidth: usize,
    pub cmbHeight: usize,
    pub cbChannel: usize,
    pub mbX: usize,
    pub mbY: usize,
    pub tileX: usize,
    pub tileY: usize,
    pub bVertTileBoundary: i32,
    pub bHoriTileBoundary: i32,
    pub bOneMBLeftVertTB: i32,
    pub bOneMBRightVertTB: i32,
    pub iPredBefore: [[i32; 2]; 2],
    pub iPredAfter: [[i32; 2]; 2],
    pub Load: Option<ImageDataProc>,
    pub Transform: Option<ImageDataProc>,
    pub TransformCenter: Option<ImageDataProc>,
    pub Quantize: Option<ImageDataProc>,
    pub ProcessTopLeft: Option<ImageDataProc>,
    pub ProcessTop: Option<ImageDataProc>,
    pub ProcessTopRight: Option<ImageDataProc>,
    pub ProcessLeft: Option<ImageDataProc>,
    pub ProcessCenter: Option<ImageDataProc>,
    pub ProcessRight: Option<ImageDataProc>,
    pub ProcessBottomLeft: Option<ImageDataProc>,
    pub ProcessBottom: Option<ImageDataProc>,
    pub ProcessBottomRight: Option<ImageDataProc>,
    pub pPlane: [Option<NonNull<i32>>; MAX_CHANNELS],
    pub a0MBbuffer: [Option<NonNull<i32>>; MAX_CHANNELS],
    pub a1MBbuffer: [Option<NonNull<i32>>; MAX_CHANNELS],
    pub p0MBbuffer: [Option<NonNull<i32>>; MAX_CHANNELS],
    pub p1MBbuffer: [Option<NonNull<i32>>; MAX_CHANNELS],
    pub pResU: Option<NonNull<i32>>,
    pub pResV: Option<NonNull<i32>>,
    pub pResUMemory: Option<Box<[i32]>>,
    pub pResVMemory: Option<Box<[i32]>>,
    pub cResMemory: usize,
    pub PredInfo: [Option<NonNull<tagCWMIPredInfo>>; MAX_CHANNELS],
    pub PredInfoPrevRow: [Option<NonNull<tagCWMIPredInfo>>; MAX_CHANNELS],
    pub pPredInfoMemory: Option<Box<[tagCWMIPredInfo]>>,
    pub cPredInfoMemory: usize,
    pub ppWStream: Option<NonNull<Option<NonNull<WMPStream>>>>,
    pub ppWStreamMemory: Option<Box<[Option<NonNull<WMPStream>>]>>,
    pub(crate) ppWStreamFileMemory: Option<Vec<Option<Box<WMPStream>>>>,
    pub(crate) ppWStreamListMemory: Option<Vec<Option<Box<WMPListStream>>>>,
    pub cWStreamMemory: usize,
    pub ppTempFileNameMemory: Option<Vec<PathBuf>>,
    pub cTempFileMemory: usize,
    pub m_pNextSC: Option<NonNull<CWMImageStrCodec>>,
    pub pNextSCMemory: Option<Box<CWMImageStrCodec>>,
    pub m_bSecondary: i32,
    pub m_fMeasurePerf: i32,
    pub m_ptEndToEndPerf: Option<Box<PerfTimerState>>,
    pub m_ptEncDecPerf: Option<Box<PerfTimerState>>,
    pub pPostProcInfo: [[Option<NonNull<tagPostProcInfo>>; 2]; MAX_CHANNELS],
    pub pPostProcInfoMemory: [[Option<Box<[tagPostProcInfo]>>; 2]; MAX_CHANNELS],
}

/// Original struct: `tagSimpleBitIO` at `original/jxrlib/image/sys/strcodec.h:560`.
#[repr(C)]
#[derive(Debug, Clone, Copy)]
pub struct tagSimpleBitIO {
    pub pWS: Option<NonNull<WMPStream>>,
    pub cbRead: u32,
    pub bAccumulator: u8,
    pub cBitLeft: u32,
    pub read_error: Option<crate::WmpError>,
}

/// Original struct: `PacketInfo` at `original/jxrlib/image/sys/strcodec.h:609`.
#[derive(Debug, Clone, Default)]
pub struct PacketInfo {
    pub m_iBand: i32,
    pub m_iSize: i32,
    pub m_iOffset: i32,
    pub m_pNext: Option<NonNull<PacketInfo>>,
}

type PacketBuffer = Box<[u8]>;

#[repr(C)]
#[derive(Debug, Clone)]
pub(crate) struct WMPListStream {
    pub(crate) stream: WMPStream,
    packets: Vec<PacketBuffer>,
    len: usize,
}

/// Original function: `checkImageBuffer` at `original/jxrlib/image/sys/strcodec.c:96`.
pub unsafe fn check_image_buffer(
    p_sc: *mut CWMImageStrCodec,
    mut c_width: usize,
    mut c_rows: usize,
) -> Result<(), WmpError> {
    let bd: BitDepth = if (*p_sc).WMISCP.bYUVData != 0 {
        BitDepth::ThirtyTwoS
    } else {
        (*p_sc).WMII.bdBitDepth
    };
    let cf: ColorFormat = if (*p_sc).WMISCP.bYUVData != 0 {
        (*p_sc).m_param.cfColorFormat
    } else {
        (*p_sc).WMII.cfColorFormat
    };
    let b_less_than_64_bit = std::mem::size_of::<usize>() < 8;

    if cf == ColorFormat::Yuv420 {
        let Some(rows) = c_rows.checked_add(1).map(|rows| rows / 2) else {
            return Err(WmpError::Fail);
        };
        c_rows = rows;
    }
    if c_rows > (*p_sc).WMIBI.cLine {
        return Err(WmpError::Fail);
    }

    if cf == ColorFormat::Yuv422 || cf == ColorFormat::Yuv420 {
        let Some(width) = c_width.checked_add(1).map(|width| width / 2) else {
            return Err(WmpError::Fail);
        };
        c_width = width;
    }

    if b_less_than_64_bit && (c_width >> (std::mem::size_of::<usize>() * 8 - 5)) != 0 {
        return Err(WmpError::Fail);
    }

    let c_bytes = if (*p_sc).WMISCP.bYUVData != 0 {
        let component_bytes = if cf == ColorFormat::Yuv420 {
            6
        } else if cf == ColorFormat::Yuv422 {
            4
        } else if cf == ColorFormat::Yuv444 {
            3
        } else {
            1
        };
        let Some(c_bytes) = c_width
            .checked_mul(std::mem::size_of::<i32>())
            .and_then(|bytes| bytes.checked_mul(component_bytes))
        else {
            return Err(WmpError::Fail);
        };
        c_bytes
    } else if bd == BitDepth::One {
        let Some(bits) = (*p_sc).WMII.cBitsPerUnit.checked_mul(c_width) else {
            return Err(WmpError::Fail);
        };
        let Some(bits) = bits.checked_add(7) else {
            return Err(WmpError::Fail);
        };
        bits / 8
    } else {
        let Some(bits_per_unit) = (*p_sc).WMII.cBitsPerUnit.checked_add(7) else {
            return Err(WmpError::Fail);
        };
        let Some(c_bytes) = (bits_per_unit / 8).checked_mul(c_width) else {
            return Err(WmpError::Fail);
        };
        c_bytes
    };

    if c_bytes > (*p_sc).WMIBI.cbStride {
        Err(WmpError::Fail)
    } else {
        Ok(())
    }
}

/// Original function: `writeQPIndex` at `original/jxrlib/image/sys/strcodec.c:126`.
pub unsafe fn write_qp_index(pIO: &mut tagBitIOInfo, uiIndex: u8, cBits: u32) {
    if uiIndex == 0 {
        put_bit16(pIO, 1, 1);
    } else {
        put_bit16(pIO, 0, 1);
        put_bit16(pIO, (uiIndex - 1) as u32, cBits);
    }
}

/// Original function: `readQPIndex` at `original/jxrlib/image/sys/strcodec.c:136`.
pub unsafe fn read_qp_index(pIO: &mut tagBitIOInfo, cBits: u32) -> u8 {
    if get_bit16(pIO, 1) != 0 {
        return 0;
    }

    get_bit16(pIO, cBits) as u8 + 1
}

/// Original function: `getTilePos` at `original/jxrlib/image/sys/strcodec.c:144`.
pub unsafe fn get_tile_pos(sc: &mut CWMImageStrCodec, mb_x: usize, mb_y: usize) {
    if mb_x == 0 {
        sc.cTileColumn = 0;
    } else if sc.cTileColumn < sc.WMISCP.cNumOfSliceMinus1V as usize
        && mb_x == sc.WMISCP.uiTileX[sc.cTileColumn + 1] as usize
    {
        sc.cTileColumn += 1;
    }

    if mb_y == 0 {
        sc.cTileRow = 0;
    } else if sc.cTileRow < sc.WMISCP.cNumOfSliceMinus1H as usize
        && mb_y == sc.WMISCP.uiTileY[sc.cTileRow + 1] as usize
    {
        sc.cTileRow += 1;
    }

    sc.m_bCtxLeft = (mb_x == sc.WMISCP.uiTileX[sc.cTileColumn] as usize) as i32;
    sc.m_bCtxTop = (mb_y == sc.WMISCP.uiTileY[sc.cTileRow] as usize) as i32;

    sc.m_bResetRGITotals =
        (((mb_x - sc.WMISCP.uiTileX[sc.cTileColumn] as usize) & 0xf) == 0) as i32;
    sc.m_bResetContext = sc.m_bResetRGITotals;
    if sc.cTileColumn == sc.WMISCP.cNumOfSliceMinus1V as usize {
        if mb_x + 1 == sc.cmbWidth {
            sc.m_bResetContext = 1;
        }
    } else if mb_x + 1 == sc.WMISCP.uiTileX[sc.cTileColumn + 1] as usize {
        sc.m_bResetContext = 1;
    }
}

/// Original function: `initMRPtr` at `original/jxrlib/image/sys/strcodec.c:175`.
pub unsafe fn init_mr_ptr(sc: &mut CWMImageStrCodec) {
    let iterations = if sc.m_pNextSC.is_none() { 1 } else { 2 };
    let mut current = Some(sc);

    for _ in 0..iterations {
        let Some(sc) = current else {
            break;
        };
        sc.p0MBbuffer = sc.a0MBbuffer;
        sc.p1MBbuffer = sc.a1MBbuffer;
        current = sc.m_pNextSC.map(|mut next| next.as_mut());
    }
}

/// Original function: `advanceMRPtr` at `original/jxrlib/image/sys/strcodec.c:186`.
pub unsafe fn advance_mr_ptr(sc: &mut CWMImageStrCodec) {
    let cf = sc.m_param.cfColorFormat;
    let cp_chroma = (CBLK_CHROMAS[cf as usize] * 16) as usize;
    let iterations = if sc.m_pNextSC.is_none() { 1 } else { 2 };

    debug_assert!(sc.m_bSecondary == 0);
    let mut current = Some(sc);
    for _ in 0..iterations {
        let Some(sc) = current else {
            break;
        };
        let mut cp_stride = 16 * 16;
        let channel_count = sc.m_param.cNumChannels;
        let planes = &mut sc.pPlane[..channel_count];
        let p0_buffers = &mut sc.p0MBbuffer[..channel_count];
        let p1_buffers = &mut sc.p1MBbuffer[..channel_count];

        for ((plane, p0_buffer), p1_buffer) in planes
            .iter_mut()
            .zip(p0_buffers.iter_mut())
            .zip(p1_buffers.iter_mut())
        {
            *plane = *p0_buffer;
            *p0_buffer = p0_buffer.and_then(|p| NonNull::new(p.as_ptr().add(cp_stride)));
            *p1_buffer = p1_buffer.and_then(|p| NonNull::new(p.as_ptr().add(cp_stride)));
            cp_stride = cp_chroma;
        }
        current = sc.m_pNextSC.map(|mut next| next.as_mut());
    }
}

/// Original function: `advanceOneMBRow` at `original/jxrlib/image/sys/strcodec.c:208`.
pub unsafe fn advance_one_mb_row(sc: &mut CWMImageStrCodec) {
    let iterations = if sc.m_pNextSC.is_none() { 1 } else { 2 };
    let mut current = Some(sc);

    for _ in 0..iterations {
        let Some(sc) = current else {
            break;
        };
        let channel_count = sc.m_param.cNumChannels;
        let pred_info = &mut sc.PredInfo[..channel_count];
        let pred_info_prev_row = &mut sc.PredInfoPrevRow[..channel_count];

        for (pred_info, pred_info_prev_row) in pred_info.iter_mut().zip(pred_info_prev_row) {
            std::mem::swap(pred_info, pred_info_prev_row);
        }
        current = sc.m_pNextSC.map(|mut next| next.as_mut());
    }
}

/// Original function: `swapMRPtr` at `original/jxrlib/image/sys/strcodec.c:223`.
pub unsafe fn swap_mr_ptr(sc: &mut CWMImageStrCodec) {
    let iterations = if sc.m_pNextSC.is_none() { 1 } else { 2 };
    let mut current = Some(sc);

    for _ in 0..iterations {
        let Some(sc) = current else {
            break;
        };
        std::mem::swap(&mut sc.a0MBbuffer, &mut sc.a1MBbuffer);
        current = sc.m_pNextSC.map(|mut next| next.as_mut());
    }
}

/// Original function: `IDPEmpty` at `original/jxrlib/image/sys/strcodec.c:239`.
pub unsafe fn idp_empty(_pSC: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    Ok(())
}

/// Original function: `WMPAlloc` at `original/jxrlib/image/sys/strcodec.c:246`.
pub fn wmp_alloc(cb: usize) -> Result<Box<[u8]>, WmpError> {
    let mut allocation = Vec::new();
    if allocation.try_reserve_exact(cb).is_err() {
        return Err(WmpError::OutOfMemory);
    }
    allocation.resize(cb, 0);
    Ok(allocation.into_boxed_slice())
}

/// Original function: `WMPFree` at `original/jxrlib/image/sys/strcodec.c:252`.
pub fn wmp_free(allocation: &mut Option<Box<[u8]>>) -> Result<(), WmpError> {
    *allocation = None;
    Ok(())
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WsFileMode {
    Read,
    WriteTruncate,
    ReadWriteTruncate,
    Append,
}

pub unsafe fn create_ws_file_owned(
    filename: &Path,
    mode: WsFileMode,
) -> Result<Box<WMPStream>, WmpError> {
    let mut options = std::fs::OpenOptions::new();
    match mode {
        WsFileMode::Read => {
            options.read(true);
        }
        WsFileMode::WriteTruncate => {
            options.write(true).create(true).truncate(true);
        }
        WsFileMode::ReadWriteTruncate => {
            options.read(true).write(true).create(true).truncate(true);
        }
        WsFileMode::Append => {
            options.append(true).create(true);
        }
    }
    let Ok(file) = options.open(filename) else {
        return Err(WmpError::FileIO);
    };

    let mut stream = Box::new(WMPStream::default());
    stream.state.file.file = Some(file);
    stream.state.file.eos = 0;
    stream.EOS = Some(eos_ws_file);
    stream.Read = Some(read_ws_file);
    stream.Write = Some(write_ws_file);
    stream.SetPos = Some(set_pos_ws_file);
    stream.GetPos = Some(get_pos_ws_file);

    Ok(stream)
}

/// Original function: `EOSWS_File` at `original/jxrlib/image/sys/strcodec.c:307`.
// Returns a boolean EOS flag (0/1), not a WMP error, so it stays `-> i32`.
pub unsafe fn eos_ws_file(pWS: &WMPStream) -> i32 {
    pWS.state.file.eos
}

/// Original function: `ReadWS_File` at `original/jxrlib/image/sys/strcodec.c:312`.
pub unsafe fn read_ws_file(pWS: &mut WMPStream, buffer: &mut [u8]) -> Result<(), crate::WmpError> {
    let Some(file) = pWS.state.file.file.as_mut() else {
        return Err(crate::WmpError::FileIO);
    };
    if buffer.is_empty() {
        pWS.state.file.eos = 0;
        return Ok(());
    }
    if file.read_exact(buffer).is_err() {
        pWS.state.file.eos = 1;
        return Err(crate::WmpError::FileIO);
    }
    pWS.state.file.eos = 0;
    Ok(())
}

/// Original function: `WriteWS_File` at `original/jxrlib/image/sys/strcodec.c:319`.
pub unsafe fn write_ws_file(pWS: &mut WMPStream, buffer: &[u8]) -> Result<(), crate::WmpError> {
    let Some(file) = pWS.state.file.file.as_mut() else {
        return Err(crate::WmpError::FileIO);
    };
    if !buffer.is_empty() && file.write_all(buffer).is_err() {
        Err(crate::WmpError::FileIO)
    } else {
        pWS.state.file.eos = 0;
        Ok(())
    }
}

/// Original function: `SetPosWS_File` at `original/jxrlib/image/sys/strcodec.c:332`.
pub unsafe fn set_pos_ws_file(pWS: &mut WMPStream, offPos: usize) -> Result<(), crate::WmpError> {
    let Some(file) = pWS.state.file.file.as_mut() else {
        return Err(crate::WmpError::FileIO);
    };
    if file.seek(SeekFrom::Start(offPos as u64)).is_err() {
        Err(crate::WmpError::FileIO)
    } else {
        pWS.state.file.eos = 0;
        Ok(())
    }
}

/// Original function: `GetPosWS_File` at `original/jxrlib/image/sys/strcodec.c:342`.
pub unsafe fn get_pos_ws_file(
    pWS: &mut WMPStream,
    poffPos: &mut usize,
) -> Result<(), crate::WmpError> {
    let Some(file) = pWS.state.file.file.as_mut() else {
        return Err(crate::WmpError::FileIO);
    };
    match file.stream_position() {
        Ok(position) => {
            *poffPos = position as usize;
            Ok(())
        }
        Err(_) => Err(crate::WmpError::FileIO),
    }
}

pub unsafe fn create_ws_memory_owned(buffer: Option<&mut [u8]>) -> Box<WMPStream> {
    let mut stream = Box::new(WMPStream::default());
    stream.state.buf.pbBuf = buffer
        .as_ref()
        .and_then(|buffer| NonNull::new(buffer.as_ptr().cast_mut()));
    stream.state.buf.cbBuf = buffer.as_ref().map_or(0, |buffer| buffer.len());
    stream.state.buf.cbCur = 0;
    stream.EOS = Some(eos_ws_memory);
    stream.Read = Some(read_ws_memory);
    stream.Write = Some(write_ws_memory);
    stream.SetPos = Some(set_pos_ws_memory);
    stream.GetPos = Some(get_pos_ws_memory);

    stream
}

pub(crate) unsafe fn create_ws_memory_read_owned(buffer: &[u8]) -> Box<WMPStream> {
    let mut stream = Box::new(WMPStream::default());
    stream.state.buf.pbBuf = NonNull::new(buffer.as_ptr().cast_mut());
    stream.state.buf.cbBuf = buffer.len();
    stream.state.buf.cbCur = 0;
    stream.EOS = Some(eos_ws_memory);
    stream.Read = Some(read_ws_memory);
    stream.Write = None;
    stream.SetPos = Some(set_pos_ws_memory);
    stream.GetPos = Some(get_pos_ws_memory);

    stream
}

/// Original function: `EOSWS_Memory` at `original/jxrlib/image/sys/strcodec.c:390`.
// Returns a boolean EOS flag (0/1), not a WMP error, so it stays `-> i32`.
pub unsafe fn eos_ws_memory(pWS: &WMPStream) -> i32 {
    let state = &pWS.state.buf;
    (state.cbBuf <= state.cbCur) as i32
}

/// Original function: `ReadWS_Memory` at `original/jxrlib/image/sys/strcodec.c:395`.
pub unsafe fn read_ws_memory(
    pWS: &mut WMPStream,
    output: &mut [u8],
) -> Result<(), crate::WmpError> {
    let state = &mut pWS.state.buf;

    if state.cbBuf < state.cbCur {
        return Err(crate::WmpError::BufferOverflow);
    }
    if state.cbBuf == state.cbCur {
        return if output.is_empty() {
            Ok(())
        } else {
            Err(crate::WmpError::BufferOverflow)
        };
    }
    let Some(buf) = state.pbBuf else {
        return Err(crate::WmpError::BufferOverflow);
    };

    let source = std::slice::from_raw_parts(buf.as_ptr(), state.cbBuf);
    let remaining = source.len() - state.cbCur;
    // A read that runs past the end is CLAMPED, as in the C original
    // (`ReadWS_Memory`, strcodec.c:395): it copies what is left, advances to
    // the end and succeeds, leaving the rest of the caller's buffer untouched.
    //
    // The decoder relies on this. It reads the bitstream a packet at a time
    // (`PACKETLENGTH` = 4096) and the last packet of an image is nearly always
    // short; on a failed read it only tolerates the shortfall when the stream
    // reports EOS, and a read that fails WITHOUT consuming anything leaves
    // this stream's EOS false. Returning an error here therefore turned every
    // in-memory decode into `Codec(Fail)` at the last packet.
    let cb = output.len().min(remaining);

    if cb != 0 {
        let Some(src) = source.get(state.cbCur..state.cbCur + cb) else {
            return Err(crate::WmpError::BufferOverflow);
        };
        output[..cb].copy_from_slice(src);
    }
    state.cbCur += cb;

    Ok(())
}

/// Original function: `WriteWS_Memory` at `original/jxrlib/image/sys/strcodec.c:416`.
pub unsafe fn write_ws_memory(pWS: &mut WMPStream, input: &[u8]) -> Result<(), crate::WmpError> {
    let state = &mut pWS.state.buf;
    let cb = input.len();
    let Some(end) = state.cbCur.checked_add(cb) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    if end == state.cbCur {
        return Ok(());
    }
    if state.cbBuf < end {
        return Err(crate::WmpError::BufferOverflow);
    }
    let Some(buf) = state.pbBuf else {
        return Err(crate::WmpError::BufferOverflow);
    };
    let target = std::slice::from_raw_parts_mut(buf.as_ptr(), state.cbBuf);

    if cb != 0 {
        let Some(dst) = target.get_mut(state.cbCur..end) else {
            return Err(crate::WmpError::BufferOverflow);
        };
        dst.copy_from_slice(input);
    }
    state.cbCur += cb;

    Ok(())
}

/// Original function: `SetPosWS_Memory` at `original/jxrlib/image/sys/strcodec.c:430`.
pub unsafe fn set_pos_ws_memory(pWS: &mut WMPStream, offPos: usize) -> Result<(), crate::WmpError> {
    let state = &mut pWS.state.buf;
    state.cbCur = offPos;
    Ok(())
}

/// Original function: `GetPosWS_Memory` at `original/jxrlib/image/sys/strcodec.c:443`.
pub unsafe fn get_pos_ws_memory(
    pWS: &mut WMPStream,
    poffPos: &mut usize,
) -> Result<(), crate::WmpError> {
    *poffPos = pWS.state.buf.cbCur;
    Ok(())
}

pub(crate) unsafe fn create_ws_list_owned() -> Result<Box<WMPListStream>, WmpError> {
    let mut packets = Vec::new();
    if packets.try_reserve_exact(1).is_err() {
        return Err(WmpError::OutOfMemory);
    }

    let mut packet = Vec::<u8>::new();
    if packet.try_reserve_exact(PACKETLENGTH).is_err() {
        return Err(WmpError::OutOfMemory);
    }
    packet.resize(PACKETLENGTH, 0);
    packets.push(packet.into_boxed_slice());

    let mut stream = Box::new(WMPListStream {
        stream: WMPStream::default(),
        packets,
        len: 0,
    });

    let stream_header = &mut stream.stream;
    stream_header.state.buf.cbBuf = PACKETLENGTH;
    stream_header.state.buf.cbCur = 0;
    stream_header.state.buf.cbBufCount = 0;
    stream_header.EOS = None;
    stream_header.Read = Some(read_ws_list);
    stream_header.Write = Some(write_ws_list);
    stream_header.SetPos = Some(set_pos_ws_list);
    stream_header.GetPos = Some(get_pos_ws_list);

    Ok(stream)
}

/// Original function: `ReadWS_List` at `original/jxrlib/image/sys/strcodec.c:506`.
pub unsafe fn read_ws_list(pWS: &mut WMPStream, output: &mut [u8]) -> Result<(), crate::WmpError> {
    let list = &mut *(pWS as *mut WMPStream).cast::<WMPListStream>();
    let state = &mut list.stream.state.buf;

    let Some(current_pos) = PACKETLENGTH
        .checked_mul(state.cbBufCount)
        .and_then(|base| base.checked_add(state.cbCur))
    else {
        return Err(crate::WmpError::BufferOverflow);
    };
    let Some(end) = current_pos.checked_add(output.len()) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    if end > list.len {
        return Err(crate::WmpError::BufferOverflow);
    }
    if output.is_empty() {
        return Ok(());
    }
    let dst = output;
    let mut written = 0;
    while written < dst.len() {
        let Some(packet) = list.packets.get_mut(state.cbBufCount) else {
            return Err(crate::WmpError::BufferOverflow);
        };
        let cl = (dst.len() - written).min(PACKETLENGTH - state.cbCur);
        let Some(src) = packet.get(state.cbCur..state.cbCur + cl) else {
            return Err(crate::WmpError::BufferOverflow);
        };
        dst[written..written + cl].copy_from_slice(src);

        state.cbCur += cl;
        written += cl;
        if state.cbCur == PACKETLENGTH {
            state.cbCur = 0;
            state.cbBufCount += 1;
        }
    }

    Ok(())
}

/// Original function: `WriteWS_List` at `original/jxrlib/image/sys/strcodec.c:537`.
pub unsafe fn write_ws_list(pWS: &mut WMPStream, input: &[u8]) -> Result<(), crate::WmpError> {
    let list = &mut *(pWS as *mut WMPStream).cast::<WMPListStream>();
    let state = &mut list.stream.state.buf;
    let cb = input.len();
    let Some(packet_base) = PACKETLENGTH.checked_mul(state.cbBufCount) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    let Some(current_pos) = packet_base.checked_add(state.cbCur) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    let Some(end) = current_pos.checked_add(cb) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    if cb == 0 {
        return Ok(());
    }

    let packets_needed = end.div_ceil(PACKETLENGTH);
    if packets_needed > list.packets.len()
        && list
            .packets
            .try_reserve_exact(packets_needed - list.packets.len())
            .is_err()
    {
        return Err(crate::WmpError::OutOfMemory);
    }

    while list.packets.len() < packets_needed {
        if list.packets.try_reserve_exact(1).is_err() {
            return Err(crate::WmpError::OutOfMemory);
        }
        let mut packet = Vec::<u8>::new();
        if packet.try_reserve_exact(PACKETLENGTH).is_err() {
            return Err(crate::WmpError::OutOfMemory);
        }
        packet.resize(PACKETLENGTH, 0);
        list.packets.push(packet.into_boxed_slice());
    }
    let Some(capacity) = list.packets.len().checked_mul(PACKETLENGTH) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    state.cbBuf = capacity;

    let mut read = 0;
    while read < input.len() {
        let cl = (input.len() - read).min(PACKETLENGTH - state.cbCur);
        let Some(packet) = list.packets.get_mut(state.cbBufCount) else {
            return Err(crate::WmpError::BufferOverflow);
        };
        let Some(dst) = packet.get_mut(state.cbCur..state.cbCur + cl) else {
            return Err(crate::WmpError::BufferOverflow);
        };
        dst.copy_from_slice(&input[read..read + cl]);

        state.cbCur += cl;
        read += cl;
        if state.cbCur == PACKETLENGTH {
            state.cbCur = 0;
            state.cbBufCount += 1;
            if state.cbBufCount == list.packets.len() {
                if list.packets.try_reserve_exact(1).is_err() {
                    return Err(crate::WmpError::OutOfMemory);
                }
                let mut packet = Vec::<u8>::new();
                if packet.try_reserve_exact(PACKETLENGTH).is_err() {
                    return Err(crate::WmpError::OutOfMemory);
                }
                packet.resize(PACKETLENGTH, 0);
                list.packets.push(packet.into_boxed_slice());
                let Some(capacity) = state.cbBuf.checked_add(PACKETLENGTH) else {
                    return Err(crate::WmpError::BufferOverflow);
                };
                state.cbBuf = capacity;
            }
        }
    }
    list.len = list.len.max(end);

    Ok(())
}

/// Original function: `SetPosWS_List` at `original/jxrlib/image/sys/strcodec.c:571`.
pub unsafe fn set_pos_ws_list(pWS: &mut WMPStream, offPos: usize) -> Result<(), crate::WmpError> {
    let list = &mut *(pWS as *mut WMPStream).cast::<WMPListStream>();
    let state = &mut list.stream.state.buf;
    let packet_index = offPos / PACKETLENGTH;

    if list.packets.get(packet_index).is_none() {
        return Err(crate::WmpError::BufferOverflow);
    }
    state.cbBufCount = packet_index;
    state.cbCur = offPos % PACKETLENGTH;

    Ok(())
}

/// Original function: `GetPosWS_List` at `original/jxrlib/image/sys/strcodec.c:597`.
pub unsafe fn get_pos_ws_list(
    pWS: &mut WMPStream,
    poffPos: &mut usize,
) -> Result<(), crate::WmpError> {
    let state = &pWS.state.buf;
    let Some(packet_base) = PACKETLENGTH.checked_mul(state.cbBufCount) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    let Some(position) = packet_base.checked_add(state.cbCur) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    *poffPos = position;

    Ok(())
}

/// Original function: `attach_SB` at `original/jxrlib/image/sys/strcodec.c:608`.
pub unsafe fn attach_sb(
    sb: &mut tagSimpleBitIO,
    pWS: &mut WMPStream,
) -> Result<(), crate::WmpError> {
    sb.pWS = Some(NonNull::from(pWS));
    sb.cbRead = 0;
    sb.bAccumulator = 0;
    sb.cBitLeft = 0;
    sb.read_error = None;

    Ok(())
}

/// Original function: `getBit32_SB` at `original/jxrlib/image/sys/strcodec.c:619`.
pub unsafe fn get_bit32_sb(sb: &mut tagSimpleBitIO, mut cBits: u32) -> u32 {
    let mut rc: u32 = 0;

    while sb.cBitLeft < cBits {
        rc <<= sb.cBitLeft;
        rc |= (sb.bAccumulator as u32) >> (8 - sb.cBitLeft);

        cBits -= sb.cBitLeft;

        let Some(stream) = sb.pWS else {
            sb.read_error = Some(crate::WmpError::FileIO);
            return rc;
        };
        let mut stream = stream;
        let Some(read) = stream.as_ref().Read else {
            sb.read_error = Some(crate::WmpError::FileIO);
            return rc;
        };
        if let Err(err) = read(stream.as_mut(), std::slice::from_mut(&mut sb.bAccumulator)) {
            sb.read_error = Some(err);
            return rc;
        }
        sb.cbRead += 1;
        sb.cBitLeft = 8;
    }

    rc <<= cBits;
    rc |= (sb.bAccumulator as u32) >> (8 - cBits);
    sb.bAccumulator = (sb.bAccumulator as u32).wrapping_shl(cBits) as u8;
    sb.cBitLeft -= cBits;

    rc
}

/// Original function: `flushToByte_SB` at `original/jxrlib/image/sys/strcodec.c:644`.
pub unsafe fn flush_to_byte_sb(sb: &mut tagSimpleBitIO) {
    sb.bAccumulator = 0;
    sb.cBitLeft = 0;
}

/// Original function: `getByteRead_SB` at `original/jxrlib/image/sys/strcodec.c:651`.
pub unsafe fn get_byte_read_sb(sb: &tagSimpleBitIO) -> u32 {
    sb.cbRead
}

/// Original function: `detach_SB` at `original/jxrlib/image/sys/strcodec.c:656`.
pub unsafe fn detach_sb(sb: &mut tagSimpleBitIO) -> Result<(), crate::WmpError> {
    debug_assert_eq!(0, sb.cBitLeft);
    sb.pWS = None;

    if let Some(err) = sb.read_error.take() {
        Err(err)
    } else {
        Ok(())
    }
}

/// Original function: `_byteswap_ulong` at `original/jxrlib/image/sys/strcodec.c:674`.
/// Rust identifier adjusted from original name `_byteswap_ulong`.
pub unsafe fn byteswap_ulong(bits: u32) -> u32 {
    let mut r = (bits & 0xff_u32) << 24;
    r |= (bits << 8) & 0xff0000_u32;
    r |= (bits >> 8) & 0xff00_u32;
    r |= (bits >> 24) & 0xff_u32;
    r
}

/// Original function: `load4BE` at `original/jxrlib/image/sys/strcodec.c:686`.
pub unsafe fn load4_be(pv: &[u8]) -> u32 {
    let bytes = &pv[..4];
    u32::from_be_bytes([bytes[0], bytes[1], bytes[2], bytes[3]])
}

/// Original function: `allocateBitIOInfo` at `original/jxrlib/image/sys/strcodec.c:713`.
pub unsafe fn allocate_bit_io_info(sc: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    let sb_subband = sc.WMISCP.sbSubband;

    sc.cSB = if sb_subband == Subband::DcOnly {
        1
    } else if sb_subband == Subband::NoHighpass {
        2
    } else if sb_subband == Subband::NoFlexbits {
        3
    } else {
        4
    };

    let c_num_bit_io: usize;
    if sc.m_param.bIndexTable == 0 {
        debug_assert!(
            sc.WMISCP.bfBitstreamFormat == BitstreamFormat::Spatial
                && sc
                    .WMISCP
                    .cNumOfSliceMinus1H
                    .wrapping_add(sc.WMISCP.cNumOfSliceMinus1V)
                    == 0
        );
        c_num_bit_io = 0;
    } else if sc.WMISCP.bfBitstreamFormat == BitstreamFormat::Spatial {
        c_num_bit_io = sc.WMISCP.cNumOfSliceMinus1V as usize + 1;
    } else {
        c_num_bit_io = (sc.WMISCP.cNumOfSliceMinus1V as usize + 1) * sc.cSB as usize;
    }

    if c_num_bit_io > (MAX_TILES * 4) as usize {
        return Err(WmpError::Fail);
    }

    if c_num_bit_io > 0 {
        if sc.WMISCP.cNumOfSliceMinus1H >= MAX_TILES {
            return Err(WmpError::Fail);
        }

        let mut blocks = Vec::new();
        if blocks.try_reserve_exact(c_num_bit_io).is_err() {
            return Err(WmpError::Fail);
        }
        blocks.resize_with(c_num_bit_io, BitIoBlock::default);
        let mut blocks = blocks.into_boxed_slice();

        let mut slots = Vec::new();
        if slots.try_reserve_exact(c_num_bit_io).is_err() {
            return Err(WmpError::Fail);
        }
        slots.extend(
            blocks
                .iter_mut()
                .map(|block| Some(NonNull::from(&mut block.io))),
        );
        let mut bit_io_memory = Box::new(BitIoStorage {
            slots: slots.into_boxed_slice(),
            blocks,
        });
        let Some(bit_io_base) = NonNull::new(bit_io_memory.slots.as_mut_ptr()) else {
            return Err(WmpError::Fail);
        };

        let Some(index_table_count) =
            c_num_bit_io.checked_mul(sc.WMISCP.cNumOfSliceMinus1H as usize + 1)
        else {
            return Err(WmpError::Fail);
        };
        let mut index_table = Vec::new();
        if index_table.try_reserve_exact(index_table_count).is_err() {
            return Err(WmpError::Fail);
        }
        index_table.resize(index_table_count, 0);
        let index_table = index_table.into_boxed_slice();

        sc.m_ppBitIO = Some(bit_io_base);
        sc.cBitIOMemory = c_num_bit_io;
        sc.m_ppBitIOMemory = Some(bit_io_memory);
        sc.cIndexTableMemory = index_table_count;
        sc.pIndexTableMemory = Some(index_table);
    }

    sc.cNumBitIO = c_num_bit_io;

    Ok(())
}

/// Original function: `setBitIOPointers` at `original/jxrlib/image/sys/strcodec.c:763`.
pub unsafe fn set_bit_io_pointers(sc: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    if sc.cNumBitIO > 0 {
        let Some(contexts) = sc.pCodingContextMemory.as_deref_mut() else {
            return Err(WmpError::Fail);
        };
        let Some(contexts) = contexts.get_mut(..sc.WMISCP.cNumOfSliceMinus1V as usize + 1) else {
            return Err(WmpError::Fail);
        };
        let bit_io_base = if let Some(bit_io_memory) = sc.m_ppBitIOMemory.as_mut() {
            bit_io_memory.slots.as_mut_ptr()
        } else {
            let Some(bit_io_base) = sc.m_ppBitIO else {
                return Err(WmpError::Fail);
            };
            bit_io_base.as_ptr()
        };
        sc.m_ppBitIO = NonNull::new(bit_io_base);
        let bit_io = std::slice::from_raw_parts(bit_io_base, sc.cNumBitIO);

        for (i, context) in contexts.iter_mut().enumerate() {
            if sc.WMISCP.bfBitstreamFormat == BitstreamFormat::Spatial {
                let Some(io) = bit_io[i] else {
                    return Err(WmpError::Fail);
                };
                context.m_pIODC = io.as_ptr();
                context.m_pIOLP = io.as_ptr();
                context.m_pIOAC = io.as_ptr();
                context.m_pIOFL = io.as_ptr();
            } else {
                let j = sc.cSB as usize;
                let base = i * j;

                let Some(io_dc) = bit_io[base] else {
                    return Err(WmpError::Fail);
                };
                context.m_pIODC = io_dc.as_ptr();
                if j > 1 {
                    let Some(io_lp) = bit_io[base + 1] else {
                        return Err(WmpError::Fail);
                    };
                    context.m_pIOLP = io_lp.as_ptr();
                }
                if j > 2 {
                    let Some(io_ac) = bit_io[base + 2] else {
                        return Err(WmpError::Fail);
                    };
                    context.m_pIOAC = io_ac.as_ptr();
                }
                if j > 3 {
                    let Some(io_fl) = bit_io[base + 3] else {
                        return Err(WmpError::Fail);
                    };
                    context.m_pIOFL = io_fl.as_ptr();
                }
            }
        }
    } else {
        let Some(header_io) = sc.pIOHeader else {
            return Err(WmpError::Fail);
        };
        let Some(contexts) = sc.pCodingContextMemory.as_deref_mut() else {
            return Err(WmpError::Fail);
        };
        let Some(context) = contexts.first_mut() else {
            return Err(WmpError::Fail);
        };
        context.m_pIODC = header_io.as_ptr();
        context.m_pIOLP = header_io.as_ptr();
        context.m_pIOAC = header_io.as_ptr();
        context.m_pIOFL = header_io.as_ptr();
    }

    Ok(())
}

/// Original function: `allocateTileInfo` at `original/jxrlib/image/sys/strcodec.c:794`.
pub unsafe fn allocate_tile_info(sc: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    if sc.WMISCP.cNumOfSliceMinus1V >= MAX_TILES {
        return Err(WmpError::Fail);
    }

    let count = sc.WMISCP.cNumOfSliceMinus1V as usize + 1;
    let mut tiles = Vec::new();
    if tiles.try_reserve_exact(count).is_err() {
        return Err(WmpError::Fail);
    }
    tiles.resize_with(count, CWMITile::default);
    let mut tiles = tiles.into_boxed_slice();
    for tile in tiles.iter_mut() {
        tile.cNumQPHP = 1;
        tile.cNumQPLP = 1;
        tile.cBitsHP = 0;
        tile.cBitsLP = 0;
    }
    sc.pTileMemory = Some(tiles);
    let Some(tiles) = sc.pTileMemory.as_mut() else {
        sc.cTileMemory = 0;
        return Err(WmpError::Fail);
    };
    sc.cTileMemory = tiles.len();

    Ok(())
}

/// Original function: `allocateQuantizer` at `original/jxrlib/image/sys/strcodec.c:839`.
pub unsafe fn allocate_quantizer(
    quantizer_slots: &mut [Option<NonNull<tagCWMIQuantizer>>],
    cChannel: usize,
    cQP: usize,
    quantizer_owner: &mut Option<Box<[tagCWMIQuantizer]>>,
    quantizer_memory: &mut usize,
) -> Result<(), WmpError> {
    if cQP > 16 || cChannel > MAX_CHANNELS || quantizer_slots.len() < cChannel {
        return Err(WmpError::Fail);
    }

    let Some(count) = cQP.checked_mul(cChannel) else {
        *quantizer_owner = None;
        quantizer_slots[..cChannel].fill(None);
        *quantizer_memory = 0;
        return Err(WmpError::Fail);
    };
    let mut quantizers = Vec::new();
    if quantizers.try_reserve_exact(count).is_err() {
        return Err(WmpError::Fail);
    }
    quantizers.resize_with(count, tagCWMIQuantizer::default);
    *quantizer_owner = Some(quantizers.into_boxed_slice());
    let Some(quantizers) = quantizer_owner.as_mut() else {
        quantizer_slots[..cChannel].fill(None);
        *quantizer_memory = 0;
        return Err(WmpError::Fail);
    };
    let Some(quantizer_base) = NonNull::new(quantizers.as_mut_ptr()) else {
        quantizer_slots[..cChannel].fill(None);
        *quantizer_memory = 0;
        return Err(WmpError::Fail);
    };
    *quantizer_memory = quantizers.len();

    let quantizer_channels = &mut quantizer_slots[..cChannel];
    for i_ch in 0..cChannel {
        let Some(channel_base) = NonNull::new(quantizer_base.as_ptr().add(i_ch * cQP)) else {
            *quantizer_owner = None;
            quantizer_channels.fill(None);
            *quantizer_memory = 0;
            return Err(WmpError::Fail);
        };
        quantizer_channels[i_ch] = Some(channel_base);
    }

    Ok(())
}

/// Original function: `formatQuantizer` at `original/jxrlib/image/sys/strcodec.c:861`.
pub unsafe fn format_quantizer(
    pQuantizer: *mut Option<NonNull<tagCWMIQuantizer>>,
    cChMode: u8,
    cCh: usize,
    iPos: usize,
    bShiftedUV: i32,
    bScaledArith: i32,
) {
    let quantizers = std::slice::from_raw_parts_mut(pQuantizer, cCh);
    for i_ch in 0..cCh {
        let Some(current) = quantizers[i_ch] else {
            continue;
        };
        let current = current.as_ptr();
        if i_ch > 0 {
            if cChMode == 0 {
                if let Some(first) = quantizers[0] {
                    *current.add(iPos) = *first.as_ptr().add(iPos);
                }
            } else if cChMode == 1 {
                if let Some(second) = quantizers[1] {
                    *current.add(iPos) = *second.as_ptr().add(iPos);
                }
            }
        }
        remap_qp(
            &mut *current.add(iPos),
            if i_ch > 0 && bShiftedUV == 1 {
                SHIFTZERO - 1
            } else {
                SHIFTZERO
            },
            bScaledArith,
        );
    }
}

/// Original function: `setUniformQuantizer` at `original/jxrlib/image/sys/strcodec.c:876`.
pub unsafe fn set_uniform_quantizer(sc: &mut CWMImageStrCodec, sb: usize) {
    let tile_count = sc.WMISCP.cNumOfSliceMinus1V as usize + 1;
    let Some(tiles) = sc.pTileMemory.as_deref_mut() else {
        return;
    };
    let Some(tiles) = tiles.get_mut(..tile_count) else {
        return;
    };
    let Some((first_tile, remaining_tiles)) = tiles.split_first_mut() else {
        return;
    };

    let channel_count = sc.m_param.cNumChannels;
    for tile in remaining_tiles.iter_mut() {
        match sb {
            0 => tile.pQuantizerDC[..channel_count]
                .copy_from_slice(&first_tile.pQuantizerDC[..channel_count]),
            1 => tile.pQuantizerLP[..channel_count]
                .copy_from_slice(&first_tile.pQuantizerLP[..channel_count]),
            _ => tile.pQuantizerHP[..channel_count]
                .copy_from_slice(&first_tile.pQuantizerHP[..channel_count]),
        }
    }
}

/// Original function: `useDCQuantizer` at `original/jxrlib/image/sys/strcodec.c:890`.
pub unsafe fn use_dc_quantizer(sc: &mut CWMImageStrCodec, i_tile: usize) {
    let Some(tiles) = sc.pTileMemory.as_deref_mut() else {
        return;
    };
    let Some(tile) = tiles.get_mut(i_tile) else {
        return;
    };
    for (&dc_quantizer, &lp_quantizer) in tile.pQuantizerDC[..sc.m_param.cNumChannels]
        .iter()
        .zip(&tile.pQuantizerLP[..sc.m_param.cNumChannels])
    {
        let (Some(dc_quantizer), Some(lp_quantizer)) = (dc_quantizer, lp_quantizer) else {
            continue;
        };
        *lp_quantizer.as_ptr() = *dc_quantizer.as_ptr();
    }
}

/// Original function: `useLPQuantizer` at `original/jxrlib/image/sys/strcodec.c:898`.
pub unsafe fn use_lp_quantizer(sc: &mut CWMImageStrCodec, c_qp: usize, i_tile: usize) {
    let Some(tiles) = sc.pTileMemory.as_deref_mut() else {
        return;
    };
    let Some(tile) = tiles.get_mut(i_tile) else {
        return;
    };
    for (&lp_quantizer, &hp_quantizer) in tile.pQuantizerLP[..sc.m_param.cNumChannels]
        .iter()
        .zip(&tile.pQuantizerHP[..sc.m_param.cNumChannels])
    {
        let (Some(lp_quantizer), Some(hp_quantizer)) = (lp_quantizer, hp_quantizer) else {
            continue;
        };
        let lp = std::slice::from_raw_parts(lp_quantizer.as_ptr(), c_qp);
        let hp = std::slice::from_raw_parts_mut(hp_quantizer.as_ptr(), c_qp);
        hp.copy_from_slice(lp);
    }
}

/// Original function: `dquantBits` at `original/jxrlib/image/sys/strcodec.c:907`.
pub unsafe fn dquant_bits(cQP: u8) -> u8 {
    match cQP {
        0..=1 => 0,
        2..=3 => 1,
        4..=5 => 2,
        6..=9 => 3,
        _ => 4,
    }
}

/// Original function: `peekBit16` at `original/jxrlib/image/sys/strcodec.c:913`.
pub unsafe fn peek_bit16(io: &tagBitIOInfo, cBits: u32) -> u32 {
    debug_assert!(cBits <= 16);
    io.uiAccumulator.wrapping_shr(32_u32.wrapping_sub(cBits))
}

/// Original function: `flushBit16` at `original/jxrlib/image/sys/strcodec.c:918`.
pub unsafe fn flush_bit16(io: &mut tagBitIOInfo, cBits: u32) -> u32 {
    debug_assert!(cBits <= 16);
    debug_assert_eq!(io.iMask & 1, 0);
    if io.pbCurrent.is_null() {
        return 0;
    }

    io.cBitsUsed = io.cBitsUsed.wrapping_add(cBits);
    let current_addr = io.pbCurrent.add((io.cBitsUsed >> 3) as usize).addr();
    io.pbCurrent = ((current_addr as isize) & (io.iMask as isize)) as *mut u8;
    if io.pbCurrent.is_null() {
        return 0;
    }
    io.cBitsUsed &= 16 - 1;
    io.uiAccumulator =
        load4_be(std::slice::from_raw_parts(io.pbCurrent, 4)).wrapping_shl(io.cBitsUsed);

    0
}

/// Original function: `getBit16` at `original/jxrlib/image/sys/strcodec.c:923`.
pub unsafe fn get_bit16(io: &mut tagBitIOInfo, cBits: u32) -> u32 {
    let uiRet = peek_bit16(io, cBits);
    flush_bit16(io, cBits);
    uiRet
}

/// Original function: `getBool16` at `original/jxrlib/image/sys/strcodec.c:931`.
pub unsafe fn get_bool16(io: &mut tagBitIOInfo) -> u32 {
    let uiRet = peek_bit16(io, 1);
    flush_bit16(io, 1);
    uiRet
}

/// Original function: `getBit16s` at `original/jxrlib/image/sys/strcodec.c:939`.
pub unsafe fn get_bit16s(io: &mut tagBitIOInfo, cBits: u32) -> i32 {
    let uiRet = peek_bit16(io, cBits + 1);
    if uiRet < 2 {
        flush_bit16(io, cBits);
        0
    } else {
        flush_bit16(io, cBits + 1);
        if uiRet & 1 != 0 {
            -((uiRet >> 1) as i32)
        } else {
            (uiRet >> 1) as i32
        }
    }
}

/// Original function: `getBit32` at `original/jxrlib/image/sys/strcodec.c:955`.
pub unsafe fn get_bit32(io: &mut tagBitIOInfo, mut cBits: u32) -> u32 {
    let mut uiRet = 0;
    if 16 < cBits {
        uiRet = get_bit16(io, 16);
        cBits -= 16;
        uiRet <<= cBits;
    }
    uiRet |= get_bit16(io, cBits);
    uiRet
}

/// Original function: `flushToByte` at `original/jxrlib/image/sys/strcodec.c:973`.
pub unsafe fn flush_to_byte(io: &mut tagBitIOInfo) -> u32 {
    flush_bit16(io, (16 - io.cBitsUsed) & 7)
}

/// Original function: `putBit16z` at `original/jxrlib/image/sys/strcodec.c:980`.
pub unsafe fn put_bit16z(pIO: *mut tagBitIOInfo, uiBits: u32, cBits: u32) {
    debug_assert!(cBits <= 16);
    debug_assert_eq!(0, uiBits.wrapping_shr(cBits));

    let io = &mut *pIO;
    io.uiAccumulator = (io.uiAccumulator << cBits) | uiBits;
    io.cBitsUsed += cBits;

    let bits = io
        .uiAccumulator
        .wrapping_shl(32_u32.wrapping_sub(io.cBitsUsed));
    #[cfg(target_endian = "big")]
    let write_bits = bits >> 16;
    #[cfg(not(target_endian = "big"))]
    let write_bits = byteswap_ulong(bits);
    let write_bytes = (write_bits as u16).to_ne_bytes();
    std::slice::from_raw_parts_mut(io.pbCurrent, write_bytes.len()).copy_from_slice(&write_bytes);

    io.pbCurrent = ((io.pbCurrent.add(((io.cBitsUsed >> 3) & 2) as usize) as isize)
        & (io.iMask as isize)) as *mut u8;
    io.cBitsUsed &= 16 - 1;
}

/// Original function: `putBit16` at `original/jxrlib/image/sys/strcodec.c:994`.
pub unsafe fn put_bit16(pIO: *mut tagBitIOInfo, mut uiBits: u32, cBits: u32) {
    debug_assert!(cBits <= 16);

    uiBits &= !(!0_u32 << cBits);
    put_bit16z(pIO, uiBits, cBits);
}

/// Original function: `putBit32` at `original/jxrlib/image/sys/strcodec.c:1002`.
pub unsafe fn put_bit32(pIO: *mut tagBitIOInfo, uiBits: u32, mut cBits: u32) {
    debug_assert!(cBits <= 32);

    if 16 < cBits {
        put_bit16(pIO, uiBits >> (cBits - 16), 16);
        cBits -= 16;
    }

    put_bit16(pIO, uiBits, cBits);
}

/// Original function: `fillToByte` at `original/jxrlib/image/sys/strcodec.c:1015`.
pub unsafe fn fill_to_byte(pIO: *mut tagBitIOInfo) {
    let io = &*pIO;
    put_bit16z(pIO, 0, (16 - io.cBitsUsed) & 7);
}

/// Original function: `getBit16_S` at `original/jxrlib/image/sys/strcodec.c:1021`.
pub unsafe fn get_bit16_s(pIO: *mut tagBitIOInfo, cBits: u32) -> u32 {
    let rc = get_bit16(&mut *pIO, cBits);
    // Faithful to C `getBit16_S`: the return value of `readIS` is deliberately ignored.
    let _ = read_is(pIO);

    rc
}

/// Original function: `putBit16_S` at `original/jxrlib/image/sys/strcodec.c:1029`.
pub unsafe fn put_bit16_s(pIO: *mut tagBitIOInfo, uiBits: u32, cBits: u32) -> u32 {
    put_bit16(pIO, uiBits, cBits);
    // Faithful to C `putBit16_S`: the return value of `writeIS` is deliberately ignored.
    let _ = write_is(pIO);

    0
}

/// Original function: `getSizeRead` at `original/jxrlib/image/sys/strcodec.c:1042`.
pub unsafe fn get_size_read(pIO: *mut tagBitIOInfo) -> u32 {
    let io = &*pIO;
    (io.pbStart.addr() + PACKETLENGTH * 2 - io.pbCurrent.addr()) as u32 - io.cBitsUsed / 8
}

/// Original function: `getSizeWrite` at `original/jxrlib/image/sys/strcodec.c:1047`.
pub unsafe fn get_size_write(pIO: *mut tagBitIOInfo) -> u32 {
    let io = &*pIO;
    let packet_wrap = if io.pbStart.addr() <= io.pbCurrent.addr() {
        0
    } else {
        PACKETLENGTH * 2
    };
    (io.pbCurrent.addr() + packet_wrap - io.pbStart.addr()) as u32 + io.cBitsUsed / 8
}

/// Original function: `getPosRead` at `original/jxrlib/image/sys/strcodec.c:1055`.
pub unsafe fn get_pos_read(pIO: *mut tagBitIOInfo) -> u32 {
    let io = &*pIO;
    let cb_cached =
        (io.pbStart.addr() + PACKETLENGTH * 2 - io.pbCurrent.addr()) - (io.cBitsUsed / 8) as usize;
    (io.offRef - cb_cached) as u32
}

/// Original function: `attachISRead` at `original/jxrlib/image/sys/strcodec.c:1065`.
pub unsafe fn attach_is_read(
    pIO: *mut tagBitIOInfo,
    pWS: *mut WMPStream,
) -> Result<(), crate::WmpError> {
    let io = &mut *pIO;
    let Some(stream) = NonNull::new(pWS) else {
        return Err(crate::WmpError::FileIO);
    };
    let stream_ref = stream.as_ref();
    let Some(get_pos) = stream_ref.GetPos else {
        return Err(crate::WmpError::FileIO);
    };
    let Some(set_pos) = stream_ref.SetPos else {
        return Err(crate::WmpError::FileIO);
    };
    let Some(read) = stream_ref.Read else {
        return Err(crate::WmpError::FileIO);
    };
    let mut stream = stream;

    get_pos(stream.as_mut(), &mut io.offRef)?;

    io.pbStart = pIO.cast::<u8>().wrapping_sub(PACKETLENGTH * 2);
    io.pbCurrent = io.pbStart;

    set_pos(stream.as_mut(), io.offRef)?;
    let packets = std::slice::from_raw_parts_mut(io.pbStart, PACKETLENGTH * 2);
    if let Err(err) = read(stream.as_mut(), packets) {
        let is_eos = stream
            .as_ref()
            .EOS
            .map(|eos| eos(stream.as_ref()) != 0)
            .unwrap_or(false);
        if !is_eos {
            return Err(err);
        }
        let bytes_read = if let Some(get_pos) = stream.as_ref().GetPos {
            let mut position = io.offRef;
            if get_pos(stream.as_mut(), &mut position).is_ok() && position >= io.offRef {
                (position - io.offRef).min(PACKETLENGTH * 2)
            } else {
                0
            }
        } else {
            0
        };
        packets[bytes_read..].fill(0);
    }
    io.offRef += PACKETLENGTH * 2;

    io.uiAccumulator = load4_be(std::slice::from_raw_parts(io.pbStart, 4));

    io.cBitsUsed = 0;
    io.iMask = !((PACKETLENGTH * 2) as i32);
    io.iMask &= !1;

    io.pWS = Some(stream);
    Ok(())
}

/// Original function: `readIS` at `original/jxrlib/image/sys/strcodec.c:1090`.
pub unsafe fn read_is(pIO: *mut tagBitIOInfo) -> Result<(), crate::WmpError> {
    let io = &mut *pIO;

    if ((io.pbStart.addr() ^ io.pbCurrent.addr()) & PACKETLENGTH) != 0 {
        let Some(pWS) = io.pWS else {
            return Err(crate::WmpError::FileIO);
        };
        let mut pWS = pWS;
        let Some(set_pos) = pWS.as_ref().SetPos else {
            return Err(crate::WmpError::FileIO);
        };
        let Some(read) = pWS.as_ref().Read else {
            return Err(crate::WmpError::FileIO);
        };

        set_pos(pWS.as_mut(), io.offRef)?;
        let packet = std::slice::from_raw_parts_mut(io.pbStart, PACKETLENGTH);
        if let Err(err) = read(pWS.as_mut(), packet) {
            let is_eos = pWS
                .as_ref()
                .EOS
                .map(|eos| eos(pWS.as_ref()) != 0)
                .unwrap_or(false);
            if !is_eos {
                return Err(err);
            }
            let bytes_read = if let Some(get_pos) = pWS.as_ref().GetPos {
                let mut position = io.offRef;
                if get_pos(pWS.as_mut(), &mut position).is_ok() && position >= io.offRef {
                    (position - io.offRef).min(PACKETLENGTH)
                } else {
                    0
                }
            } else {
                0
            };
            packet[bytes_read..].fill(0);
        }
        io.offRef += PACKETLENGTH;

        let Some(shadow_end) = io.pbStart.addr().checked_add(4) else {
            return Err(crate::WmpError::BufferOverflow);
        };
        let Some(packet_end) = io.pbStart.addr().checked_add(PACKETLENGTH) else {
            return Err(crate::WmpError::BufferOverflow);
        };
        if shadow_end > packet_end {
            return Err(crate::WmpError::BufferOverflow);
        }
        io.uiShadow = u32::from_ne_bytes([
            *io.pbStart,
            *io.pbStart.add(1),
            *io.pbStart.add(2),
            *io.pbStart.add(3),
        ]);

        io.pbStart =
            ((io.pbStart.add(PACKETLENGTH).addr() as isize) & (io.iMask as isize)) as *mut u8;
    }

    Ok(())
}

/// Original function: `detachISRead` at `original/jxrlib/image/sys/strcodec.c:1119`.
pub unsafe fn detach_is_read(pIO: *mut tagBitIOInfo) -> Result<(), crate::WmpError> {
    let pWS = (*pIO).pWS;

    flush_to_byte(&mut *pIO);
    debug_assert_eq!(0, (*pIO).cBitsUsed % 8);
    read_is(pIO)?;

    let io = &mut *pIO;
    let cb_remain = (io.pbStart.addr() + PACKETLENGTH * 2)
        .wrapping_sub(io.pbCurrent.addr() + (io.cBitsUsed / 8) as usize);
    let Some(pWS) = pWS else {
        return Err(crate::WmpError::FileIO);
    };
    let mut pWS = pWS;
    let Some(set_pos) = pWS.as_ref().SetPos else {
        return Err(crate::WmpError::FileIO);
    };
    set_pos(pWS.as_mut(), io.offRef.wrapping_sub(cb_remain))?;

    io.pWS = None;
    Ok(())
}

/// Original function: `attachISWrite` at `original/jxrlib/image/sys/strcodec.c:1142`.
pub unsafe fn attach_is_write(
    pIO: *mut tagBitIOInfo,
    pWS: *mut WMPStream,
) -> Result<(), crate::WmpError> {
    let io = &mut *pIO;
    let Some(stream) = NonNull::new(pWS) else {
        return Err(crate::WmpError::FileIO);
    };
    let Some(get_pos) = stream.as_ref().GetPos else {
        return Err(crate::WmpError::FileIO);
    };
    let mut stream = stream;
    get_pos(stream.as_mut(), &mut io.offRef)?;

    io.pbStart = pIO.cast::<u8>().wrapping_sub(PACKETLENGTH * 2);
    io.pbCurrent = io.pbStart;

    io.uiAccumulator = 0;
    io.cBitsUsed = 0;
    io.iMask = !((PACKETLENGTH * 2) as i32);

    io.pWS = Some(stream);
    Ok(())
}

/// Original function: `writeIS` at `original/jxrlib/image/sys/strcodec.c:1158`.
pub unsafe fn write_is(pIO: *mut tagBitIOInfo) -> Result<(), crate::WmpError> {
    let io = &mut *pIO;

    if ((io.pbStart.addr() ^ io.pbCurrent.addr()) & PACKETLENGTH) != 0 {
        let Some(stream) = io.pWS else {
            return Err(crate::WmpError::FileIO);
        };
        let mut stream = stream;
        let Some(write) = stream.as_ref().Write else {
            return Err(crate::WmpError::FileIO);
        };
        write(
            stream.as_mut(),
            std::slice::from_raw_parts(io.pbStart, PACKETLENGTH),
        )?;

        io.pbStart =
            ((io.pbStart.add(PACKETLENGTH).addr() as isize) & (io.iMask as isize)) as *mut u8;
    }

    Ok(())
}

/// Original function: `detachISWrite` at `original/jxrlib/image/sys/strcodec.c:1180`.
pub unsafe fn detach_is_write(pIO: *mut tagBitIOInfo) -> Result<(), crate::WmpError> {
    debug_assert_eq!(0, (*pIO).cBitsUsed % 8);

    write_is(pIO)?;

    let io = &mut *pIO;
    let Some(stream) = io.pWS else {
        return Err(crate::WmpError::FileIO);
    };
    let mut stream = stream;
    let Some(write) = stream.as_ref().Write else {
        return Err(crate::WmpError::FileIO);
    };
    write(
        stream.as_mut(),
        std::slice::from_raw_parts(
            io.pbStart,
            io.pbCurrent.addr() + (io.cBitsUsed / 8) as usize - io.pbStart.addr(),
        ),
    )?;

    io.pWS = None;
    Ok(())
}

/// Original function: `OutputIndivPerfTimer` at `original/jxrlib/image/sys/strcodec.c:1203`.
pub unsafe fn output_indiv_perf_timer(
    pPerfTimer: Option<&mut Box<PerfTimerState>>,
    pszTimerName: &str,
    pszDescription: &str,
    fltMegaPixels: f32,
) {
    let mut fResult = false;

    print!("{pszTimerName} ({pszDescription}): ");
    if let Some(rResults) = perf_timer_get_results(pPerfTimer) {
        fResult = true;
        if rResults.elapsed_time != 0 {
            println!(
                "{:.3} milliseconds, {:.6} MP/sec",
                rResults.elapsed_time as f64 / 1_000_000.0_f64,
                1_000_000_000.0_f64 * fltMegaPixels as f64 / rResults.elapsed_time as f64,
            );
            if rResults.zero_time_intervals > 0 {
                println!(
                    "   *** WARNING: {} time intervals were measured as zero. This perf timer has insufficient precision!\n",
                    rResults.zero_time_intervals,
                );
            }
        }
    }
    if !fResult {
        println!("Results not available!");
    }
}

/// Original function: `OutputPerfTimerReport` at `original/jxrlib/image/sys/strcodec.c:1233`.
pub unsafe fn output_perf_timer_report(state: &mut CWMImageStrCodec) {
    debug_assert!(state.m_fMeasurePerf != 0);

    println!("***************************************************************************");
    println!("* Perf Report");
    println!("***************************************************************************\n");

    let fltMegaPixels = (state.WMII.cWidth as f32 * state.WMII.cHeight as f32) / 1_000_000.0_f32;
    println!(
        "Image Width = {}, Height = {}, total MegaPixels = {:.1} MP",
        state.WMII.cWidth, state.WMII.cHeight, fltMegaPixels as f64,
    );

    output_indiv_perf_timer(
        state.m_ptEncDecPerf.as_mut(),
        "m_ptEncDecPerf",
        "excl I/O",
        fltMegaPixels,
    );
    output_indiv_perf_timer(
        state.m_ptEndToEndPerf.as_mut(),
        "m_ptEndToEndPerf",
        "incl I/O",
        fltMegaPixels,
    );
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn idp_empty_returns_icerr_ok() {
        let mut codec = CWMImageStrCodec::default();
        unsafe {
            assert_eq!(idp_empty(&mut codec), Ok(()));
        }
    }

    #[test]
    fn wmpalloc_zero_initializes_and_wmpfree_nulls_pointer() {
        let mut allocation = Some(wmp_alloc(16).expect("allocation should succeed"));
        assert!(allocation
            .as_deref()
            .is_some_and(|bytes| bytes.iter().all(|&byte| byte == 0)));

        assert!(wmp_free(&mut allocation).is_ok());
        assert!(allocation.is_none());
        assert!(wmp_free(&mut allocation).is_ok());
        assert!(allocation.is_none());
    }

    #[test]
    fn wmpalloc_reports_out_of_memory_for_impossible_size() {
        assert_eq!(wmp_alloc(usize::MAX), Err(crate::WmpError::OutOfMemory));
    }

    #[test]
    fn memory_stream_rejects_short_reads_and_tracks_position() {
        let mut backing = [10_u8, 20, 30, 40];
        let mut out = [0_u8; 8];

        unsafe {
            let mut stream = create_ws_memory_owned(Some(&mut backing));
            assert_eq!(stream.state.buf.cbBuf, backing.len());
            assert_eq!(eos_ws_memory(&stream), 0);

            assert_eq!(
                read_ws_memory(&mut *stream, &mut out[..6]),
                Err(crate::WmpError::BufferOverflow)
            );
            assert_eq!(stream.state.buf.cbCur, 0);
            assert!(read_ws_memory(&mut *stream, &mut out[..4]).is_ok());
            assert_eq!(&out[..4], &backing);
            assert_eq!(stream.state.buf.cbCur, backing.len());
            assert_eq!(eos_ws_memory(&stream), 1);

            let mut pos = 0;
            assert!(get_pos_ws_memory(&mut *stream, &mut pos).is_ok());
            assert_eq!(pos, backing.len());

            assert!(set_pos_ws_memory(&mut *stream, 2).is_ok());
            assert!(read_ws_memory(&mut *stream, &mut out[..1]).is_ok());
            assert_eq!(out[0], 30);
        }
    }

    #[test]
    fn memory_stream_writes_and_reports_overflow() {
        let mut backing = [0_u8; 4];
        let input = [1_u8, 2, 3, 4, 5];

        unsafe {
            let mut stream = create_ws_memory_owned(Some(&mut backing));
            assert!(write_ws_memory(&mut *stream, &input[..4]).is_ok());
            assert_eq!(backing, [1, 2, 3, 4]);
            assert_eq!(
                write_ws_memory(&mut *stream, &input[..1]),
                Err(crate::WmpError::BufferOverflow)
            );
            assert_eq!(stream.state.buf.cbCur, 4);

            assert!(set_pos_ws_memory(&mut *stream, usize::MAX).is_ok());
            assert_eq!(
                write_ws_memory(&mut *stream, &input[..1]),
                Err(crate::WmpError::BufferOverflow)
            );
        }
    }

    #[test]
    fn list_stream_writes_reads_seeks_across_packets_and_closes() {
        let mut input = vec![0_u8; PACKETLENGTH + 3];
        let mut output = [0_u8; 5];
        let mut pos = 0;

        for (idx, byte) in input.iter_mut().enumerate() {
            *byte = (idx & 0xff) as u8;
        }

        unsafe {
            let mut list = create_ws_list_owned().expect("list stream allocation should succeed");
            let stream = &mut list.stream;
            assert!(stream.EOS.is_none());
            assert_eq!(stream.state.buf.cbBuf, PACKETLENGTH);

            let write = stream.Write.expect("Write callback is present");
            let read = stream.Read.expect("Read callback is present");
            let get_pos = stream.GetPos.expect("GetPos callback is present");
            let set_pos = stream.SetPos.expect("SetPos callback is present");

            assert!(write(stream, &input[..PACKETLENGTH]).is_ok());
            assert!(write(stream, &input[PACKETLENGTH..PACKETLENGTH + 3]).is_ok());
            assert_eq!(stream.state.buf.cbBuf, PACKETLENGTH * 2);
            assert!(get_pos(stream, &mut pos).is_ok());
            assert_eq!(pos, PACKETLENGTH + 3);

            assert!(set_pos(stream, PACKETLENGTH - 2).is_ok());
            assert!(read(stream, &mut output).is_ok());
            assert_eq!(
                output,
                [
                    input[PACKETLENGTH - 2],
                    input[PACKETLENGTH - 1],
                    input[PACKETLENGTH],
                    input[PACKETLENGTH + 1],
                    input[PACKETLENGTH + 2],
                ]
            );
            assert!(get_pos(stream, &mut pos).is_ok());
            assert_eq!(pos, PACKETLENGTH + 3);
        }
    }

    #[test]
    fn list_stream_rejects_short_reads_and_nonexistent_packet_seeks() {
        let input = [1_u8, 2, 3];
        let mut output = [0_u8; 4];
        let mut pos = usize::MAX;

        unsafe {
            let mut list = create_ws_list_owned().expect("list stream allocation should succeed");
            let stream = &mut list.stream;

            assert_eq!(
                read_ws_list(stream, &mut output[..1]),
                Err(crate::WmpError::BufferOverflow)
            );
            assert!(get_pos_ws_list(stream, &mut pos).is_ok());
            assert_eq!(pos, 0);

            assert!(write_ws_list(stream, &input).is_ok());
            assert!(set_pos_ws_list(stream, 0).is_ok());
            assert_eq!(
                read_ws_list(stream, &mut output),
                Err(crate::WmpError::BufferOverflow)
            );
            assert!(get_pos_ws_list(stream, &mut pos).is_ok());
            assert_eq!(pos, 0);

            assert_eq!(
                set_pos_ws_list(stream, PACKETLENGTH),
                Err(crate::WmpError::BufferOverflow)
            );
            assert!(get_pos_ws_list(stream, &mut pos).is_ok());
            assert_eq!(pos, 0);
        }
    }

    #[test]
    fn simple_bit_io_reads_msb_first_and_tracks_bytes_read() {
        let mut backing = [0b1011_0010_u8, 0b0110_0000];
        let mut bit_io = tagSimpleBitIO {
            pWS: None,
            cbRead: 99,
            bAccumulator: 0xff,
            cBitLeft: 99,
            read_error: None,
        };

        unsafe {
            let mut stream = create_ws_memory_owned(Some(&mut backing));
            let stream_ptr: *mut WMPStream = &mut *stream;
            assert!(attach_sb(&mut bit_io, &mut *stream).is_ok());
            assert_eq!(bit_io.pWS.map(|stream| stream.as_ptr()), Some(stream_ptr));
            assert_eq!(bit_io.cbRead, 0);
            assert_eq!(bit_io.bAccumulator, 0);
            assert_eq!(bit_io.cBitLeft, 0);

            assert_eq!(get_bit32_sb(&mut bit_io, 3), 0b101);
            assert_eq!(bit_io.cbRead, 1);
            assert_eq!(bit_io.cBitLeft, 5);
            assert_eq!(get_bit32_sb(&mut bit_io, 5), 0b10010);
            assert_eq!(bit_io.cbRead, 1);
            assert_eq!(bit_io.cBitLeft, 0);
            assert_eq!(get_bit32_sb(&mut bit_io, 4), 0b0110);
            assert_eq!(get_byte_read_sb(&mut bit_io), 2);

            flush_to_byte_sb(&mut bit_io);
            assert_eq!(bit_io.bAccumulator, 0);
            assert_eq!(bit_io.cBitLeft, 0);
            assert!(detach_sb(&mut bit_io).is_ok());
            assert!(bit_io.pWS.is_none());
        }
    }

    #[test]
    fn byteswap_and_load4be_match_original_little_endian_branch() {
        let buffer = [0x12_u8, 0x34, 0x56, 0x78];

        unsafe {
            assert_eq!(byteswap_ulong(0x7856_3412), 0x1234_5678);
            assert_eq!(load4_be(&buffer), 0x1234_5678);
        }
    }

    #[test]
    fn bit_io_read_functions_follow_original_accumulator_rules() {
        let mut backing = [0b1011_0010_u8, 0b0110_0101, 0xf0, 0x0f, 0, 0];
        let mut bit_io = tagBitIOInfo {
            uiShadow: 0,
            uiAccumulator: 0,
            cBitsUsed: 0,
            iMask: -2,
            pbStart: backing.as_mut_ptr(),
            pbCurrent: backing.as_mut_ptr(),
            pWS: None,
            offRef: 0,
        };

        unsafe {
            bit_io.uiAccumulator = load4_be(std::slice::from_raw_parts(bit_io.pbStart, 4));

            assert_eq!(peek_bit16(&mut bit_io, 4), 0b1011);
            assert_eq!(bit_io.cBitsUsed, 0);
            assert_eq!(get_bit16(&mut bit_io, 4), 0b1011);
            assert_eq!(bit_io.cBitsUsed, 4);
            assert_eq!(get_bool16(&mut bit_io), 0);
            assert_eq!(bit_io.cBitsUsed, 5);
            assert_eq!(flush_to_byte(&mut bit_io), 0);
            assert_eq!(bit_io.cBitsUsed, 8);
        }

        let mut negative = [0b1010_0000_u8, 0, 0, 0];
        let mut negative_io = tagBitIOInfo {
            uiShadow: 0,
            uiAccumulator: 0,
            cBitsUsed: 0,
            iMask: -2,
            pbStart: negative.as_mut_ptr(),
            pbCurrent: negative.as_mut_ptr(),
            pWS: None,
            offRef: 0,
        };
        let mut positive = [0b1000_0000_u8, 0, 0, 0];
        let mut positive_io = tagBitIOInfo {
            uiShadow: 0,
            uiAccumulator: 0,
            cBitsUsed: 0,
            iMask: -2,
            pbStart: positive.as_mut_ptr(),
            pbCurrent: positive.as_mut_ptr(),
            pWS: None,
            offRef: 0,
        };
        let mut zero = [0_u8; 4];
        let mut zero_io = tagBitIOInfo {
            uiShadow: 0,
            uiAccumulator: 0,
            cBitsUsed: 0,
            iMask: -2,
            pbStart: zero.as_mut_ptr(),
            pbCurrent: zero.as_mut_ptr(),
            pWS: None,
            offRef: 0,
        };

        unsafe {
            negative_io.uiAccumulator =
                load4_be(std::slice::from_raw_parts(negative_io.pbStart, 4));
            positive_io.uiAccumulator =
                load4_be(std::slice::from_raw_parts(positive_io.pbStart, 4));
            zero_io.uiAccumulator = load4_be(std::slice::from_raw_parts(zero_io.pbStart, 4));

            assert_eq!(get_bit16s(&mut negative_io, 2), -2);
            assert_eq!(get_bit16s(&mut positive_io, 2), 2);
            assert_eq!(get_bit16s(&mut zero_io, 2), 0);
        }

        let mut thirty_two = [0x12_u8, 0x34, 0x56, 0x78, 0, 0];
        let mut thirty_two_io = tagBitIOInfo {
            uiShadow: 0,
            uiAccumulator: 0,
            cBitsUsed: 0,
            iMask: -2,
            pbStart: thirty_two.as_mut_ptr(),
            pbCurrent: thirty_two.as_mut_ptr(),
            pWS: None,
            offRef: 0,
        };

        unsafe {
            thirty_two_io.uiAccumulator =
                load4_be(std::slice::from_raw_parts(thirty_two_io.pbStart, 4));
            assert_eq!(get_bit32(&mut thirty_two_io, 24), 0x123456);
        }
    }

    #[test]
    fn bit_io_write_functions_follow_original_accumulator_rules() {
        let mut halfword_backing = [0_u16; 4];
        let mut halfword_io = tagBitIOInfo {
            uiShadow: 0,
            uiAccumulator: 0,
            cBitsUsed: 0,
            iMask: -2,
            pbStart: halfword_backing.as_mut_ptr().cast::<u8>(),
            pbCurrent: halfword_backing.as_mut_ptr().cast::<u8>(),
            pWS: None,
            offRef: 0,
        };

        unsafe {
            put_bit16(&mut halfword_io, 0xabcd, 16);
            let bytes = std::slice::from_raw_parts(halfword_backing.as_ptr().cast::<u8>(), 8);
            assert_eq!(&bytes[..2], &[0xab, 0xcd]);
            assert_eq!(halfword_io.cBitsUsed, 0);
            assert_eq!(halfword_io.pbCurrent, halfword_io.pbStart.add(2));
        }

        let mut masked_backing = [0_u16; 2];
        let mut masked_io = tagBitIOInfo {
            uiShadow: 0,
            uiAccumulator: 0,
            cBitsUsed: 0,
            iMask: -2,
            pbStart: masked_backing.as_mut_ptr().cast::<u8>(),
            pbCurrent: masked_backing.as_mut_ptr().cast::<u8>(),
            pWS: None,
            offRef: 0,
        };

        unsafe {
            put_bit16(&mut masked_io, 0xff, 4);
            fill_to_byte(&mut masked_io);
            let bytes = std::slice::from_raw_parts(masked_backing.as_ptr().cast::<u8>(), 4);
            assert_eq!(&bytes[..2], &[0xf0, 0]);
            assert_eq!(masked_io.cBitsUsed, 8);
            assert_eq!(masked_io.pbCurrent, masked_io.pbStart);
        }

        let mut split_backing = [0_u16; 4];
        let mut split_io = tagBitIOInfo {
            uiShadow: 0,
            uiAccumulator: 0,
            cBitsUsed: 0,
            iMask: -2,
            pbStart: split_backing.as_mut_ptr().cast::<u8>(),
            pbCurrent: split_backing.as_mut_ptr().cast::<u8>(),
            pWS: None,
            offRef: 0,
        };

        unsafe {
            put_bit32(&mut split_io, 0x123456, 24);
            let bytes = std::slice::from_raw_parts(split_backing.as_ptr().cast::<u8>(), 8);
            assert_eq!(&bytes[..4], &[0x12, 0x34, 0x56, 0]);
            assert_eq!(split_io.cBitsUsed, 8);
            assert_eq!(split_io.pbCurrent, split_io.pbStart.add(2));
        }
    }

    #[test]
    fn bit_io_size_and_position_queries_follow_original_pointer_arithmetic() {
        let mut backing = [0_u8; 32];
        let mut read_io = tagBitIOInfo {
            uiShadow: 0,
            uiAccumulator: 0,
            cBitsUsed: 16,
            iMask: -2,
            pbStart: backing.as_mut_ptr(),
            pbCurrent: unsafe { backing.as_mut_ptr().add(10) },
            pWS: None,
            offRef: 10_000,
        };
        let mut write_io = tagBitIOInfo {
            uiShadow: 0,
            uiAccumulator: 0,
            cBitsUsed: 8,
            iMask: -2,
            pbStart: backing.as_mut_ptr(),
            pbCurrent: unsafe { backing.as_mut_ptr().add(6) },
            pWS: None,
            offRef: 0,
        };
        let mut wrapped_write_io = tagBitIOInfo {
            uiShadow: 0,
            uiAccumulator: 0,
            cBitsUsed: 16,
            iMask: -2,
            pbStart: backing.as_mut_ptr(),
            pbCurrent: (backing.as_mut_ptr() as usize - 4) as *mut u8,
            pWS: None,
            offRef: 0,
        };

        unsafe {
            assert_eq!(get_size_read(&mut read_io), (PACKETLENGTH * 2 - 12) as u32);
            assert_eq!(
                get_pos_read(&mut read_io),
                10_000 - (PACKETLENGTH * 2 - 12) as u32
            );
            assert_eq!(get_size_write(&mut write_io), 7);
            assert_eq!(
                get_size_write(&mut wrapped_write_io),
                (PACKETLENGTH * 2 - 2) as u32
            );
        }
    }

    #[test]
    fn attach_is_write_initializes_bit_io_state_from_stream_position() {
        let mut backing = [0_u8; 8];
        let mut bit_io = tagBitIOInfo {
            uiShadow: 77,
            uiAccumulator: 0xffff,
            cBitsUsed: 13,
            iMask: 123,
            pbStart: backing.as_mut_ptr(),
            pbCurrent: backing.as_mut_ptr(),
            pWS: None,
            offRef: 0,
        };

        unsafe {
            let mut stream = create_ws_memory_owned(Some(&mut backing));
            let stream_ptr: *mut WMPStream = &mut *stream;
            assert!(set_pos_ws_memory(&mut *stream, 3).is_ok());
            assert!(attach_is_write(&mut bit_io, stream_ptr).is_ok());

            let expected_start = (&mut bit_io as *mut tagBitIOInfo)
                .cast::<u8>()
                .wrapping_sub(PACKETLENGTH * 2);
            assert_eq!(bit_io.offRef, 3);
            assert_eq!(bit_io.pbStart, expected_start);
            assert_eq!(bit_io.pbCurrent, expected_start);
            assert_eq!(bit_io.uiAccumulator, 0);
            assert_eq!(bit_io.cBitsUsed, 0);
            assert_eq!(bit_io.iMask, !((PACKETLENGTH * 2) as i32));
            assert_eq!(bit_io.pWS.map(|stream| stream.as_ptr()), Some(stream_ptr));
        }
    }

    #[test]
    fn write_is_writes_full_packet_when_packet_bit_changes() {
        let mut packet = vec![0_u8; PACKETLENGTH * 2];
        let mut output = vec![0_u8; PACKETLENGTH];

        for (idx, byte) in packet.iter_mut().take(PACKETLENGTH).enumerate() {
            *byte = (idx & 0xff) as u8;
        }

        let mut bit_io = tagBitIOInfo {
            uiShadow: 0,
            uiAccumulator: 0,
            cBitsUsed: 0,
            iMask: -1,
            pbStart: packet.as_mut_ptr(),
            pbCurrent: unsafe { packet.as_mut_ptr().add(PACKETLENGTH) },
            pWS: None,
            offRef: 0,
        };

        unsafe {
            let mut stream = create_ws_memory_owned(Some(&mut output));
            bit_io.pWS = Some(NonNull::from(&mut *stream));
            assert!(write_is(&mut bit_io).is_ok());
            assert_eq!(&output[..], &packet[..PACKETLENGTH]);
            assert_eq!(bit_io.pbStart, packet.as_mut_ptr().add(PACKETLENGTH));
            assert_eq!(stream.state.buf.cbCur, PACKETLENGTH);
        }

        let mut no_write_output = [0_u8; 4];
        let mut no_write_io = tagBitIOInfo {
            uiShadow: 0,
            uiAccumulator: 0,
            cBitsUsed: 0,
            iMask: -1,
            pbStart: packet.as_mut_ptr(),
            pbCurrent: packet.as_mut_ptr(),
            pWS: None,
            offRef: 0,
        };

        unsafe {
            let mut no_write_stream = create_ws_memory_owned(Some(&mut no_write_output));
            no_write_io.pWS = Some(NonNull::from(&mut *no_write_stream));
            assert!(write_is(&mut no_write_io).is_ok());
            assert_eq!(no_write_stream.state.buf.cbCur, 0);
            assert_eq!(no_write_io.pbStart, packet.as_mut_ptr());
        }
    }

    #[test]
    fn detach_is_write_flushes_partial_buffer_and_clears_stream() {
        let mut packet = [1_u8, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
        let mut output = [0_u8; 12];
        let mut bit_io = tagBitIOInfo {
            uiShadow: 0,
            uiAccumulator: 0,
            cBitsUsed: 8,
            iMask: -1,
            pbStart: packet.as_mut_ptr(),
            pbCurrent: unsafe { packet.as_mut_ptr().add(10) },
            pWS: None,
            offRef: 0,
        };

        unsafe {
            let mut stream = create_ws_memory_owned(Some(&mut output));
            bit_io.pWS = Some(NonNull::from(&mut *stream));
            assert!(detach_is_write(&mut bit_io).is_ok());
            assert_eq!(&output[..11], &packet[..11]);
            assert_eq!(stream.state.buf.cbCur, 11);
            assert!(bit_io.pWS.is_none());
        }
    }

    #[test]
    fn attach_read_and_read_is_fill_original_pre_object_packet_buffer() {
        let alloc_size = PACKETLENGTH * 2 + std::mem::size_of::<tagBitIOInfo>();
        let mut backing = vec![0usize; alloc_size.div_ceil(std::mem::size_of::<usize>())];
        let base = backing.as_mut_ptr().cast::<u8>();
        let pio = unsafe { base.add(PACKETLENGTH * 2).cast::<tagBitIOInfo>() };
        let mut input = vec![0_u8; PACKETLENGTH * 3];

        for (idx, byte) in input.iter_mut().enumerate() {
            *byte = (idx & 0xff) as u8;
        }

        unsafe {
            std::ptr::write(
                pio,
                tagBitIOInfo {
                    uiShadow: 0,
                    uiAccumulator: 0,
                    cBitsUsed: 99,
                    iMask: 0,
                    pbStart: std::ptr::null_mut(),
                    pbCurrent: std::ptr::null_mut(),
                    pWS: None,
                    offRef: 0,
                },
            );
            let mut stream = create_ws_memory_owned(Some(&mut input));
            let stream_ptr: *mut WMPStream = &mut *stream;
            assert!(attach_is_read(pio, stream_ptr).is_ok());
            assert_eq!((*pio).pbStart, base);
            assert_eq!((*pio).pbCurrent, base);
            assert_eq!((*pio).offRef, PACKETLENGTH * 2);
            assert_eq!(
                (*pio).uiAccumulator,
                load4_be(std::slice::from_raw_parts(base, 4))
            );
            assert_eq!((*pio).uiAccumulator, 0x0001_0203);
            assert_eq!((*pio).cBitsUsed, 0);
            assert_eq!((*pio).iMask, (!((PACKETLENGTH * 2) as i32)) & !1);
            assert_eq!((*pio).pWS.map(|stream| stream.as_ptr()), Some(stream_ptr));
            assert_eq!(&std::slice::from_raw_parts(base, 8)[..], &input[..8]);

            (*pio).pbCurrent = (*pio).pbStart.add(PACKETLENGTH);
            let expected_start =
                (((*pio).pbStart.add(PACKETLENGTH) as isize) & ((*pio).iMask as isize)) as *mut u8;
            assert!(read_is(pio).is_ok());
            assert_eq!((*pio).offRef, PACKETLENGTH * 3);
            assert_eq!(
                (*pio).uiShadow,
                std::ptr::read_unaligned(base.cast::<u32>())
            );
            assert_eq!((*pio).pbStart, expected_start);
            assert_eq!(
                &std::slice::from_raw_parts(base, 8)[..],
                &input[PACKETLENGTH * 2..][..8]
            );
        }
    }

    #[test]
    fn read_is_zero_pads_file_eof_without_discarding_partial_packet() {
        let path = std::env::temp_dir().join(format!(
            "jpegxr-pure-rs-read-is-eof-{}-{}.bin",
            std::process::id(),
            1
        ));
        let mut input = vec![0_u8; PACKETLENGTH * 2 + 3];
        let alloc_size = PACKETLENGTH * 2 + std::mem::size_of::<tagBitIOInfo>();
        let mut backing = vec![0usize; alloc_size.div_ceil(std::mem::size_of::<usize>())];
        let base = backing.as_mut_ptr().cast::<u8>();
        let pio = unsafe { base.add(PACKETLENGTH * 2).cast::<tagBitIOInfo>() };

        for (idx, byte) in input.iter_mut().enumerate() {
            *byte = (idx & 0xff) as u8;
        }
        std::fs::write(&path, &input).expect("temporary packet input should be written");

        unsafe {
            std::ptr::write(
                pio,
                tagBitIOInfo {
                    uiShadow: 0,
                    uiAccumulator: 0,
                    cBitsUsed: 0,
                    iMask: 0,
                    pbStart: std::ptr::null_mut(),
                    pbCurrent: std::ptr::null_mut(),
                    pWS: None,
                    offRef: 0,
                },
            );
            let mut stream = create_ws_file_owned(path.as_path(), WsFileMode::Read)
                .expect("file stream creation should succeed");
            assert!(attach_is_read(pio, &mut *stream).is_ok());

            (*pio).pbCurrent = (*pio).pbStart.add(PACKETLENGTH);
            assert!(read_is(pio).is_ok());
            assert_eq!(
                &std::slice::from_raw_parts(base, 8)[..3],
                &input[PACKETLENGTH * 2..][..3]
            );
            assert_eq!(&std::slice::from_raw_parts(base.add(3), 5)[..], &[0; 5]);
            assert_ne!(eos_ws_file(&stream), 0);
        }

        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn detach_is_read_flushes_to_byte_restores_stream_position_and_clears_stream() {
        let alloc_size = PACKETLENGTH * 2 + std::mem::size_of::<tagBitIOInfo>();
        let mut backing = vec![0usize; alloc_size.div_ceil(std::mem::size_of::<usize>())];
        let base = backing.as_mut_ptr().cast::<u8>();
        let pio = unsafe { base.add(PACKETLENGTH * 2).cast::<tagBitIOInfo>() };
        let mut input = vec![0_u8; PACKETLENGTH * 2];
        let mut pos = usize::MAX;

        for (idx, byte) in input.iter_mut().enumerate() {
            *byte = (idx & 0xff) as u8;
        }

        unsafe {
            std::ptr::write(
                pio,
                tagBitIOInfo {
                    uiShadow: 0,
                    uiAccumulator: 0,
                    cBitsUsed: 0,
                    iMask: 0,
                    pbStart: std::ptr::null_mut(),
                    pbCurrent: std::ptr::null_mut(),
                    pWS: None,
                    offRef: 0,
                },
            );
            let mut stream = create_ws_memory_owned(Some(&mut input));
            let stream_ptr: *mut WMPStream = &mut *stream;
            assert!(attach_is_read(pio, stream_ptr).is_ok());
            assert!(detach_is_read(pio).is_ok());
            assert!((*pio).pWS.is_none());
            assert!(get_pos_ws_memory(&mut *stream, &mut pos).is_ok());
            let cb_remain = ((*pio).pbStart as usize + PACKETLENGTH * 2)
                .wrapping_sub((*pio).pbCurrent as usize + ((*pio).cBitsUsed / 8) as usize);
            assert_eq!(pos, (*pio).offRef.wrapping_sub(cb_remain));
        }
    }

    #[test]
    fn bit_io_stream_wrappers_delegate_to_bit_and_packet_functions() {
        let mut read_backing = [0b1101_0101_u8, 0, 0, 0, 0, 0];
        let mut read_io = tagBitIOInfo {
            uiShadow: 0,
            uiAccumulator: 0,
            cBitsUsed: 0,
            iMask: -2,
            pbStart: read_backing.as_mut_ptr(),
            pbCurrent: read_backing.as_mut_ptr(),
            pWS: None,
            offRef: 0,
        };
        let mut write_backing = [0_u16; 2];
        let mut write_io = tagBitIOInfo {
            uiShadow: 0,
            uiAccumulator: 0,
            cBitsUsed: 0,
            iMask: -2,
            pbStart: write_backing.as_mut_ptr().cast::<u8>(),
            pbCurrent: write_backing.as_mut_ptr().cast::<u8>(),
            pWS: None,
            offRef: 0,
        };

        unsafe {
            read_io.uiAccumulator = load4_be(std::slice::from_raw_parts(read_io.pbStart, 4));
            assert_eq!(get_bit16_s(&mut read_io, 4), 0b1101);
            assert_eq!(read_io.cBitsUsed, 4);

            assert_eq!(put_bit16_s(&mut write_io, 0b1010, 4), 0);
            let bytes = std::slice::from_raw_parts(write_backing.as_ptr().cast::<u8>(), 4);
            assert_eq!(&bytes[..2], &[0xa0, 0]);
            assert_eq!(write_io.cBitsUsed, 4);
        }
    }

    #[test]
    fn quantizer_allocation_sets_channel_pointers_and_base() {
        let mut quantizers = [None; MAX_CHANNELS];
        let mut quantizer_owner = None;
        let mut quantizer_memory = 0usize;

        unsafe {
            assert_eq!(
                allocate_quantizer(
                    &mut quantizers,
                    3,
                    2,
                    &mut quantizer_owner,
                    &mut quantizer_memory,
                ),
                Ok(())
            );
            let Some(q0) = quantizers[0] else {
                panic!("missing first quantizer");
            };
            let Some(q1) = quantizers[1] else {
                panic!("missing second quantizer");
            };
            let Some(q2) = quantizers[2] else {
                panic!("missing third quantizer");
            };
            assert_eq!(q1.as_ptr(), q0.as_ptr().add(2));
            assert_eq!(q2.as_ptr(), q1.as_ptr().add(2));
            assert!(quantizers[3].is_none());
            assert!(quantizer_owner.is_some());
            assert_eq!(quantizer_memory, 6);

            (*q0.as_ptr()).iIndex = 7;
            (*q1.as_ptr()).iQP = 42;
            assert_eq!((*q0.as_ptr()).iIndex, 7);
            assert_eq!((*q1.as_ptr()).iQP, 42);
        }

        // The quantizer base is owned by `quantizer_owner`; the channel pointers in
        // `quantizers` alias into that boxed slice. Teardown is now Drop-based, so
        // dropping the owner releases the backing storage that the old
        // `free_quantizer` call used to free explicitly.
        drop(quantizer_owner);
    }

    #[test]
    fn quantizer_allocation_rejects_original_bounds() {
        let mut quantizers = [None; MAX_CHANNELS + 1];
        let mut quantizer_owner = None;
        let mut quantizer_memory = 0usize;

        unsafe {
            assert_eq!(
                allocate_quantizer(
                    &mut quantizers,
                    MAX_CHANNELS + 1,
                    1,
                    &mut quantizer_owner,
                    &mut quantizer_memory,
                ),
                Err(WmpError::Fail)
            );
            assert!(quantizers[0].is_none());
            assert_eq!(
                allocate_quantizer(
                    &mut quantizers,
                    1,
                    17,
                    &mut quantizer_owner,
                    &mut quantizer_memory,
                ),
                Err(WmpError::Fail)
            );
            assert!(quantizers[0].is_none());
        }
    }

    #[test]
    fn dquant_bits_matches_original_thresholds() {
        unsafe {
            assert_eq!(dquant_bits(0), 0);
            assert_eq!(dquant_bits(1), 0);
            assert_eq!(dquant_bits(2), 1);
            assert_eq!(dquant_bits(3), 1);
            assert_eq!(dquant_bits(4), 2);
            assert_eq!(dquant_bits(5), 2);
            assert_eq!(dquant_bits(6), 3);
            assert_eq!(dquant_bits(9), 3);
            assert_eq!(dquant_bits(10), 4);
            assert_eq!(dquant_bits(u8::MAX), 4);
        }
    }

    #[test]
    fn file_stream_writes_reads_seeks_and_closes() {
        let path = std::env::temp_dir().join(format!(
            "jpegxr-pure-rs-file-stream-{}-{}.bin",
            std::process::id(),
            1
        ));
        let input = [5_u8, 6, 7, 8];
        let mut output = [0_u8; 4];
        let mut pos = 0;

        unsafe {
            let mut stream = create_ws_file_owned(path.as_path(), WsFileMode::ReadWriteTruncate)
                .expect("file stream creation should succeed");
            assert!(write_ws_file(&mut *stream, &input).is_ok());
            assert!(get_pos_ws_file(&mut *stream, &mut pos).is_ok());
            assert_eq!(pos, input.len());
            assert!(set_pos_ws_file(&mut *stream, 0).is_ok());
            assert!(read_ws_file(&mut *stream, &mut output).is_ok());
            assert_eq!(output, input);
            assert_eq!(
                read_ws_file(&mut *stream, &mut output),
                Err(crate::WmpError::FileIO)
            );
            assert_ne!(eos_ws_file(&stream), 0);
        }

        // Best-effort cleanup of the temp file; failure to remove it does not affect the test.
        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn file_stream_rejects_short_reads_without_padding_success() {
        let path = std::env::temp_dir().join(format!(
            "jpegxr-pure-rs-file-stream-short-read-{}-{}.bin",
            std::process::id(),
            1
        ));
        let input = [5_u8, 6];
        let mut output = [0_u8; 4];

        std::fs::write(&path, input).expect("temporary input should be written");

        unsafe {
            let mut stream = create_ws_file_owned(path.as_path(), WsFileMode::Read)
                .expect("file stream creation should succeed");
            assert_eq!(
                read_ws_file(&mut *stream, &mut output),
                Err(crate::WmpError::FileIO)
            );
            assert_ne!(eos_ws_file(&stream), 0);
        }

        let _ = std::fs::remove_file(path);
    }

    #[test]
    fn check_image_buffer_rounds_yuv420_odd_dimensions_for_rows_and_stride() {
        let mut codec = CWMImageStrCodec::default();
        codec.WMISCP.bYUVData = 1;
        codec.m_param.cfColorFormat = ColorFormat::Yuv420;
        codec.WMIBI.cLine = 3;
        codec.WMIBI.cbStride = 72;

        unsafe {
            assert_eq!(check_image_buffer(&mut codec, 5, 5), Ok(()));

            codec.WMIBI.cbStride = 71;
            assert_eq!(check_image_buffer(&mut codec, 5, 5), Err(WmpError::Fail));

            codec.WMIBI.cbStride = 72;
            codec.WMIBI.cLine = 2;
            assert_eq!(check_image_buffer(&mut codec, 5, 5), Err(WmpError::Fail));
        }
    }
}
