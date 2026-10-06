// Auto-generated scaffold for a faithful JXRLib translation restart.
// Keep one Rust item per original C item; replace stubs bottom-up.

use crate::image::sys::windowsmediaphoto::{WMPStream, WMPStreamSetPosFn};
use std::ptr::NonNull;

pub const WMP_INTEL_ENDIAN: u8 = b'I';
pub const SIZEOF_IFD_ENTRY: u32 = 12;
pub const IFD_ENTRY_TYPE_SIZES: [u32; 13] = [0, 1, 1, 2, 4, 8, 1, 1, 2, 4, 8, 4, 8];

pub const WMP_tagEXIFMetadata: u16 = 0x8769;
pub const WMP_tagGPSInfoMetadata: u16 = 0x8825;
pub const WMP_tagInteroperabilityIFD: u16 = 0xa005;
pub const WMP_tagDocumentName: u16 = 0x010d;
pub const WMP_tagImageDescription: u16 = 0x010e;
pub const WMP_tagCameraMake: u16 = 0x010f;
pub const WMP_tagCameraModel: u16 = 0x0110;
pub const WMP_tagPageName: u16 = 0x011d;
pub const WMP_tagPageNumber: u16 = 0x0129;
pub const WMP_tagSoftware: u16 = 0x0131;
pub const WMP_tagDateTime: u16 = 0x0132;
pub const WMP_tagArtist: u16 = 0x013b;
pub const WMP_tagHostComputer: u16 = 0x013c;
pub const WMP_tagXMPMetadata: u16 = 0x02bc;
pub const WMP_tagRatingStars: u16 = 0x4746;
pub const WMP_tagRatingValue: u16 = 0x4749;
pub const WMP_tagCopyright: u16 = 0x8298;
pub const WMP_tagIPTCNAAMetadata: u16 = 0x83bb;
pub const WMP_tagPhotoshopMetadata: u16 = 0x8649;
pub const WMP_tagIccProfile: u16 = 0x8773;
pub const WMP_tagCaption: u16 = 0x9c9b;
pub const WMP_tagPixelFormat: u16 = 0xbc01;
pub const WMP_tagTransformation: u16 = 0xbc02;
pub const WMP_tagCompression: u16 = 0xbc03;
pub const WMP_tagImageType: u16 = 0xbc04;
pub const WMP_tagImageWidth: u16 = 0xbc80;
pub const WMP_tagImageHeight: u16 = 0xbc81;
pub const WMP_tagWidthResolution: u16 = 0xbc82;
pub const WMP_tagHeightResolution: u16 = 0xbc83;
pub const WMP_tagImageOffset: u16 = 0xbcc0;
pub const WMP_tagImageByteCount: u16 = 0xbcc1;
pub const WMP_tagAlphaOffset: u16 = 0xbcc2;
pub const WMP_tagAlphaByteCount: u16 = 0xbcc3;
pub const WMP_tagImageDataDiscard: u16 = 0xbcc4;
pub const WMP_tagAlphaDataDiscard: u16 = 0xbcc5;
pub const WMP_valCompression: u16 = 0xbc;
pub const WMP_valWMPhotoID: u16 = WMP_valCompression;

pub const WMP_typBYTE: u16 = 1;
pub const WMP_typASCII: u16 = 2;
pub const WMP_typSHORT: u16 = 3;
pub const WMP_typLONG: u16 = 4;
pub const WMP_typRATIONAL: u16 = 5;
pub const WMP_typSBYTE: u16 = 6;
pub const WMP_typUNDEFINED: u16 = 7;
pub const WMP_typSSHORT: u16 = 8;
pub const WMP_typSLONG: u16 = 9;
pub const WMP_typSRATIONAL: u16 = 10;
pub const WMP_typFLOAT: u16 = 11;
pub const WMP_typDOUBLE: u16 = 12;

#[repr(i32)]
#[derive(Debug, Copy, Clone, Default, PartialEq, Eq)]
pub enum DpkVarType {
    #[default]
    Empty = 0,
    Ui2 = 18,
    Ui4 = 19,
    LpStr = 30,
    LpWStr = 31,
    ByRefUi1 = 0x4011,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum DpkPropVariantValue {
    Empty,
    Ui2(u16),
    Ui4(u32),
    Bytes(Vec<u8>),
    Wide(Vec<u16>),
}

impl Default for DpkPropVariantValue {
    fn default() -> Self {
        Self::Empty
    }
}

/// Original struct: `DPKPROPVARIANT` at `original/jxrlib/jxrgluelib/JXRMeta.h:128`.
#[derive(Debug, Clone, Default, PartialEq, Eq)]
pub struct DPKPROPVARIANT {
    pub vt: DpkVarType,
    pub value: DpkPropVariantValue,
}

/// Original struct: `DESCRIPTIVEMETADATA` at `original/jxrlib/jxrgluelib/JXRMeta.h:142`.
#[derive(Debug, Clone, Default)]
pub struct DESCRIPTIVEMETADATA {
    pub pvarImageDescription: DPKPROPVARIANT,
    pub pvarCameraMake: DPKPROPVARIANT,
    pub pvarCameraModel: DPKPROPVARIANT,
    pub pvarSoftware: DPKPROPVARIANT,
    pub pvarDateTime: DPKPROPVARIANT,
    pub pvarArtist: DPKPROPVARIANT,
    pub pvarCopyright: DPKPROPVARIANT,
    pub pvarRatingStars: DPKPROPVARIANT,
    pub pvarRatingValue: DPKPROPVARIANT,
    pub pvarCaption: DPKPROPVARIANT,
    pub pvarDocumentName: DPKPROPVARIANT,
    pub pvarPageName: DPKPROPVARIANT,
    pub pvarPageNumber: DPKPROPVARIANT,
    pub pvarHostComputer: DPKPROPVARIANT,
}

/// Original struct: `tagWmpDE` at `original/jxrlib/jxrgluelib/JXRMeta.h:160`.
#[derive(Debug, Clone, Default)]
pub struct tagWmpDE {
    pub uTag: u16,
    pub uType: u16,
    pub uCount: u32,
    pub uValueOrOffset: u32,
}

/// Original struct: `tagWmpDEMisc` at `original/jxrlib/jxrgluelib/JXRMeta.h:168`.
#[repr(C)]
#[derive(Debug, Clone, Copy, Default)]
pub struct tagWmpDEMisc {
    pub uImageOffset: u32,
    pub uImageByteCount: u32,
    pub uAlphaOffset: u32,
    pub uAlphaByteCount: u32,
    pub uOffPixelFormat: u32,
    pub uOffImageByteCount: u32,
    pub uOffAlphaOffset: u32,
    pub uOffAlphaByteCount: u32,
    pub uColorProfileOffset: u32,
    pub uColorProfileByteCount: u32,
    pub uXMPMetadataOffset: u32,
    pub uXMPMetadataByteCount: u32,
    pub uEXIFMetadataOffset: u32,
    pub uEXIFMetadataByteCount: u32,
    pub uGPSInfoMetadataOffset: u32,
    pub uGPSInfoMetadataByteCount: u32,
    pub uIPTCNAAMetadataOffset: u32,
    pub uIPTCNAAMetadataByteCount: u32,
    pub uPhotoshopMetadataOffset: u32,
    pub uPhotoshopMetadataByteCount: u32,
    pub uDescMetadataOffset: u32,
    pub uDescMetadataByteCount: u32,
}

/// Original function: `getbfcpy` at `original/jxrlib/jxrgluelib/JXRMeta.c:38`.
pub unsafe fn get_bf_cpy(
    pbdest: Option<&mut [u8]>,
    pb: Option<&[u8]>,
    ofs: usize,
    n: u32,
) -> Result<(), crate::WmpError> {
    let Some(end) = ofs.checked_add(n as usize) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    let Some(src_buf) = pb else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(dst_buf) = pbdest else {
        return Err(crate::WmpError::InvalidParameter);
    };
    if dst_buf.len() < n as usize {
        return Err(crate::WmpError::BufferOverflow);
    };
    let Some(src) = src_buf.get(ofs..end) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    dst_buf[..n as usize].copy_from_slice(src);
    Ok(())
}

/// Original function: `getbfw` at `original/jxrlib/jxrgluelib/JXRMeta.c:49`.
pub unsafe fn get_bf_w(
    pb: Option<&[u8]>,
    ofs: usize,
    pw: Option<&mut u16>,
) -> Result<(), crate::WmpError> {
    let Some(pw) = pw else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(end) = ofs.checked_add(2) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    let Some(src_buf) = pb else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(bytes) = src_buf.get(ofs..end) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    let Ok(bytes) = bytes.try_into() else {
        return Err(crate::WmpError::BufferOverflow);
    };
    *pw = u16::from_le_bytes(bytes);
    Ok(())
}

/// Original function: `getbfdw` at `original/jxrlib/jxrgluelib/JXRMeta.c:60`.
pub unsafe fn get_bf_dw(
    pb: Option<&[u8]>,
    ofs: usize,
    pdw: Option<&mut u32>,
) -> Result<(), crate::WmpError> {
    let Some(pdw) = pdw else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(end) = ofs.checked_add(4) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    let Some(src_buf) = pb else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(bytes) = src_buf.get(ofs..end) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    let Ok(bytes) = bytes.try_into() else {
        return Err(crate::WmpError::BufferOverflow);
    };
    *pdw = u32::from_le_bytes(bytes);
    Ok(())
}

/// Original function: `getbfwbig` at `original/jxrlib/jxrgluelib/JXRMeta.c:71`.
pub unsafe fn get_bf_w_big(
    pb: Option<&[u8]>,
    ofs: usize,
    pw: Option<&mut u16>,
) -> Result<(), crate::WmpError> {
    let Some(pw) = pw else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(end) = ofs.checked_add(2) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    let Some(src_buf) = pb else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(bytes) = src_buf.get(ofs..end) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    let Ok(bytes) = bytes.try_into() else {
        return Err(crate::WmpError::BufferOverflow);
    };
    *pw = u16::from_be_bytes(bytes);
    Ok(())
}

/// Original function: `getbfdwbig` at `original/jxrlib/jxrgluelib/JXRMeta.c:82`.
pub unsafe fn get_bf_dw_big(
    pb: Option<&[u8]>,
    ofs: usize,
    pdw: Option<&mut u32>,
) -> Result<(), crate::WmpError> {
    let Some(pdw) = pdw else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(end) = ofs.checked_add(4) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    let Some(src_buf) = pb else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(bytes) = src_buf.get(ofs..end) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    let Ok(bytes) = bytes.try_into() else {
        return Err(crate::WmpError::BufferOverflow);
    };
    *pdw = u32::from_be_bytes(bytes);
    Ok(())
}

/// Original function: `getbfwe` at `original/jxrlib/jxrgluelib/JXRMeta.c:93`.
pub unsafe fn get_bf_w_e(
    pb: Option<&[u8]>,
    ofs: usize,
    pw: Option<&mut u16>,
    endian: u8,
) -> Result<(), crate::WmpError> {
    if endian == WMP_INTEL_ENDIAN {
        get_bf_w(pb, ofs, pw)
    } else {
        get_bf_w_big(pb, ofs, pw)
    }
}

/// Original function: `getbfdwe` at `original/jxrlib/jxrgluelib/JXRMeta.c:103`.
pub unsafe fn get_bf_dw_e(
    pb: Option<&[u8]>,
    ofs: usize,
    pdw: Option<&mut u32>,
    endian: u8,
) -> Result<(), crate::WmpError> {
    if endian == WMP_INTEL_ENDIAN {
        get_bf_dw(pb, ofs, pdw)
    } else {
        get_bf_dw_big(pb, ofs, pdw)
    }
}

/// Original function: `setbfcpy` at `original/jxrlib/jxrgluelib/JXRMeta.c:113`.
pub unsafe fn set_bf_cpy(
    pb: Option<&mut [u8]>,
    ofs: usize,
    pbset: Option<&[u8]>,
) -> Result<(), crate::WmpError> {
    let Some(dst_buf) = pb else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(src_buf) = pbset else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(end) = ofs.checked_add(src_buf.len()) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    let Some(dst) = dst_buf.get_mut(ofs..end) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    dst.copy_from_slice(src_buf);
    Ok(())
}

/// Original function: `setbfw` at `original/jxrlib/jxrgluelib/JXRMeta.c:124`.
pub unsafe fn set_bf_w(pb: Option<&mut [u8]>, ofs: usize, dw: u16) -> Result<(), crate::WmpError> {
    let Some(end) = ofs.checked_add(2) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    let Some(dst_buf) = pb else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(dst) = dst_buf.get_mut(ofs..end) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    dst.copy_from_slice(&dw.to_le_bytes());
    Ok(())
}

/// Original function: `setbfdw` at `original/jxrlib/jxrgluelib/JXRMeta.c:136`.
pub unsafe fn set_bf_dw(pb: Option<&mut [u8]>, ofs: usize, dw: u32) -> Result<(), crate::WmpError> {
    let Some(end) = ofs.checked_add(4) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    let Some(dst_buf) = pb else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(dst) = dst_buf.get_mut(ofs..end) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    dst.copy_from_slice(&dw.to_le_bytes());
    Ok(())
}

/// Original function: `setbfwbig` at `original/jxrlib/jxrgluelib/JXRMeta.c:150`.
pub unsafe fn set_bf_w_big(
    pb: Option<&mut [u8]>,
    ofs: usize,
    dw: u16,
) -> Result<(), crate::WmpError> {
    let Some(end) = ofs.checked_add(2) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    let Some(dst_buf) = pb else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(dst) = dst_buf.get_mut(ofs..end) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    dst.copy_from_slice(&dw.to_be_bytes());
    Ok(())
}

/// Original function: `setbfdwbig` at `original/jxrlib/jxrgluelib/JXRMeta.c:162`.
pub unsafe fn set_bf_dw_big(
    pb: Option<&mut [u8]>,
    ofs: usize,
    dw: u32,
) -> Result<(), crate::WmpError> {
    let Some(end) = ofs.checked_add(4) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    let Some(dst_buf) = pb else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(dst) = dst_buf.get_mut(ofs..end) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    dst.copy_from_slice(&dw.to_be_bytes());
    Ok(())
}

/// Original function: `BufferCalcIFDSize` at `original/jxrlib/jxrgluelib/JXRMeta.c:186`.
pub unsafe fn buffer_calc_ifd_size(
    pbdata: Option<&[u8]>,
    ofsifd: u32,
    endian: u8,
    pcbifd: Option<&mut u32>,
) -> Result<(), crate::WmpError> {
    let Some(pcbifd) = pcbifd else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(src_buf) = pbdata else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let mut cDir: u16 = 0;
    let mut cbEXIFIFD: u32 = 0;
    let mut cbGPSInfoIFD: u32 = 0;
    let mut cbInteroperabilityIFD: u32 = 0;

    *pcbifd = 0;
    let mut err = get_bf_w_e(Some(src_buf), ofsifd as usize, Some(&mut cDir), endian);
    if err.is_err() {
        return err;
    }

    let Some(mut cbifd) = (cDir as u32)
        .checked_mul(SIZEOF_IFD_ENTRY)
        .and_then(|dir_bytes| (std::mem::size_of::<u16>() as u32).checked_add(dir_bytes))
        .and_then(|cb| cb.checked_add(std::mem::size_of::<u32>() as u32))
    else {
        return Err(crate::WmpError::BufferOverflow);
    };
    let Some(mut ofsdir) = ofsifd.checked_add(std::mem::size_of::<u16>() as u32) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    for _ in 0..cDir {
        let mut tag: u16 = 0;
        let mut type_: u16 = 0;
        let mut count: u32 = 0;
        let mut value: u32 = 0;

        err = get_bf_w_e(Some(src_buf), ofsdir as usize, Some(&mut tag), endian);
        if err.is_err() {
            return err;
        }
        err = get_bf_w_e(
            Some(src_buf),
            match ofsdir.checked_add(std::mem::size_of::<u16>() as u32) {
                Some(ofs) => ofs as usize,
                None => return Err(crate::WmpError::BufferOverflow),
            },
            Some(&mut type_),
            endian,
        );
        if err.is_err() {
            return err;
        }
        err = get_bf_dw_e(
            Some(src_buf),
            match ofsdir.checked_add(2 * std::mem::size_of::<u16>() as u32) {
                Some(ofs) => ofs as usize,
                None => return Err(crate::WmpError::BufferOverflow),
            },
            Some(&mut count),
            endian,
        );
        if err.is_err() {
            return err;
        }
        err = get_bf_dw_e(
            Some(src_buf),
            match ofsdir
                .checked_add(2 * std::mem::size_of::<u16>() as u32)
                .and_then(|ofs| ofs.checked_add(std::mem::size_of::<u32>() as u32))
            {
                Some(ofs) => ofs as usize,
                None => return Err(crate::WmpError::BufferOverflow),
            },
            Some(&mut value),
            endian,
        );
        if err.is_err() {
            return err;
        }
        if type_ == 0 || type_ as usize >= IFD_ENTRY_TYPE_SIZES.len() {
            return Err(crate::WmpError::Fail);
        }

        if tag == WMP_tagEXIFMetadata {
            err = buffer_calc_ifd_size(Some(src_buf), value, endian, Some(&mut cbEXIFIFD));
            if err.is_err() {
                return err;
            }
        } else if tag == WMP_tagGPSInfoMetadata {
            err = buffer_calc_ifd_size(Some(src_buf), value, endian, Some(&mut cbGPSInfoIFD));
            if err.is_err() {
                return err;
            }
        } else if tag == WMP_tagInteroperabilityIFD {
            err = buffer_calc_ifd_size(
                Some(src_buf),
                value,
                endian,
                Some(&mut cbInteroperabilityIFD),
            );
            if err.is_err() {
                return err;
            }
        } else {
            let Some(datasize) = IFD_ENTRY_TYPE_SIZES[type_ as usize].checked_mul(count) else {
                return Err(crate::WmpError::BufferOverflow);
            };
            if datasize > 4 {
                let Some(next_cbifd) = cbifd.checked_add(datasize) else {
                    return Err(crate::WmpError::BufferOverflow);
                };
                cbifd = next_cbifd;
            }
        }
        let Some(next_ofsdir) = ofsdir.checked_add(SIZEOF_IFD_ENTRY) else {
            return Err(crate::WmpError::BufferOverflow);
        };
        ofsdir = next_ofsdir;
    }
    if cbEXIFIFD != 0 {
        let Some(next_cbifd) = cbifd
            .checked_add(cbifd & 1)
            .and_then(|cb| cb.checked_add(cbEXIFIFD))
        else {
            return Err(crate::WmpError::BufferOverflow);
        };
        cbifd = next_cbifd;
    }
    if cbGPSInfoIFD != 0 {
        let Some(next_cbifd) = cbifd
            .checked_add(cbifd & 1)
            .and_then(|cb| cb.checked_add(cbGPSInfoIFD))
        else {
            return Err(crate::WmpError::BufferOverflow);
        };
        cbifd = next_cbifd;
    }
    if cbInteroperabilityIFD != 0 {
        let Some(next_cbifd) = cbifd
            .checked_add(cbifd & 1)
            .and_then(|cb| cb.checked_add(cbInteroperabilityIFD))
        else {
            return Err(crate::WmpError::BufferOverflow);
        };
        cbifd = next_cbifd;
    }

    *pcbifd = cbifd;
    err
}

/// Original function: `StreamCalcIFDSize` at `original/jxrlib/jxrgluelib/JXRMeta.c:249`.
unsafe fn restore_stream_pos_preserving_error(
    ws: &mut WMPStream,
    set_pos: WMPStreamSetPosFn,
    off_cur_pos: usize,
    prior: Result<(), crate::WmpError>,
) -> Result<(), crate::WmpError> {
    let restore_err = set_pos(ws, off_cur_pos);
    match prior {
        Err(err) => Err(err),
        Ok(()) => restore_err,
    }
}

pub unsafe fn stream_calc_ifd_size(
    pWS: *mut WMPStream,
    uIFDOfs: u32,
    pcbifd: Option<&mut u32>,
) -> Result<(), crate::WmpError> {
    let Some(ws) = pWS.as_mut() else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(pcbifd) = pcbifd else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let mut offCurPos: usize = 0;
    let mut err: Result<(), crate::WmpError>;
    let mut cDir: u16 = 0;
    let mut cbEXIFIFD: u32 = 0;
    let mut cbGPSInfoIFD: u32 = 0;
    let mut cbInteroperabilityIFD: u32 = 0;
    let Some(get_pos) = ws.GetPos else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(set_pos) = ws.SetPos else {
        return Err(crate::WmpError::InvalidParameter);
    };

    *pcbifd = 0;
    err = get_pos(ws, &mut offCurPos);
    if err.is_err() {
        return err;
    }

    err = get_u_short(ws, uIFDOfs as usize, Some(&mut cDir));
    if err.is_err() {
        return restore_stream_pos_preserving_error(ws, set_pos, offCurPos, err);
    }
    let Some(mut cbifd) = (cDir as u32)
        .checked_mul(SIZEOF_IFD_ENTRY)
        .and_then(|dir_bytes| (std::mem::size_of::<u16>() as u32).checked_add(dir_bytes))
        .and_then(|cb| cb.checked_add(std::mem::size_of::<u32>() as u32))
    else {
        return restore_stream_pos_preserving_error(
            ws,
            set_pos,
            offCurPos,
            Err(crate::WmpError::BufferOverflow),
        );
    };
    let Some(mut ofsdir) = uIFDOfs.checked_add(std::mem::size_of::<u16>() as u32) else {
        return restore_stream_pos_preserving_error(
            ws,
            set_pos,
            offCurPos,
            Err(crate::WmpError::BufferOverflow),
        );
    };
    for _ in 0..cDir {
        let mut tag: u16 = 0;
        let mut type_: u16 = 0;
        let mut count: u32 = 0;
        let mut value: u32 = 0;

        err = get_u_short(ws, ofsdir as usize, Some(&mut tag));
        if err.is_err() {
            return restore_stream_pos_preserving_error(ws, set_pos, offCurPos, err);
        }
        err = get_u_short(
            ws,
            match ofsdir.checked_add(std::mem::size_of::<u16>() as u32) {
                Some(ofs) => ofs as usize,
                None => {
                    return restore_stream_pos_preserving_error(
                        ws,
                        set_pos,
                        offCurPos,
                        Err(crate::WmpError::BufferOverflow),
                    );
                }
            },
            Some(&mut type_),
        );
        if err.is_err() {
            return restore_stream_pos_preserving_error(ws, set_pos, offCurPos, err);
        }
        err = get_u_long(
            ws,
            match ofsdir.checked_add(2 * std::mem::size_of::<u16>() as u32) {
                Some(ofs) => ofs as usize,
                None => {
                    return restore_stream_pos_preserving_error(
                        ws,
                        set_pos,
                        offCurPos,
                        Err(crate::WmpError::BufferOverflow),
                    );
                }
            },
            Some(&mut count),
        );
        if err.is_err() {
            return restore_stream_pos_preserving_error(ws, set_pos, offCurPos, err);
        }
        err = get_u_long(
            ws,
            match ofsdir
                .checked_add(2 * std::mem::size_of::<u16>() as u32)
                .and_then(|ofs| ofs.checked_add(std::mem::size_of::<u32>() as u32))
            {
                Some(ofs) => ofs as usize,
                None => {
                    return restore_stream_pos_preserving_error(
                        ws,
                        set_pos,
                        offCurPos,
                        Err(crate::WmpError::BufferOverflow),
                    );
                }
            },
            Some(&mut value),
        );
        if err.is_err() {
            return restore_stream_pos_preserving_error(ws, set_pos, offCurPos, err);
        }
        if type_ == 0 || type_ as usize >= IFD_ENTRY_TYPE_SIZES.len() {
            return restore_stream_pos_preserving_error(
                ws,
                set_pos,
                offCurPos,
                Err(crate::WmpError::UnsupportedFormat),
            );
        }

        if tag == WMP_tagEXIFMetadata {
            err = stream_calc_ifd_size(pWS, value, Some(&mut cbEXIFIFD));
            if err.is_err() {
                return restore_stream_pos_preserving_error(ws, set_pos, offCurPos, err);
            }
        } else if tag == WMP_tagGPSInfoMetadata {
            err = stream_calc_ifd_size(pWS, value, Some(&mut cbGPSInfoIFD));
            if err.is_err() {
                return restore_stream_pos_preserving_error(ws, set_pos, offCurPos, err);
            }
        } else if tag == WMP_tagInteroperabilityIFD {
            err = stream_calc_ifd_size(pWS, value, Some(&mut cbInteroperabilityIFD));
            if err.is_err() {
                return restore_stream_pos_preserving_error(ws, set_pos, offCurPos, err);
            }
        } else {
            let Some(datasize) = IFD_ENTRY_TYPE_SIZES[type_ as usize].checked_mul(count) else {
                return restore_stream_pos_preserving_error(
                    ws,
                    set_pos,
                    offCurPos,
                    Err(crate::WmpError::BufferOverflow),
                );
            };
            if datasize > 4 {
                let Some(next_cbifd) = cbifd.checked_add(datasize) else {
                    return restore_stream_pos_preserving_error(
                        ws,
                        set_pos,
                        offCurPos,
                        Err(crate::WmpError::BufferOverflow),
                    );
                };
                cbifd = next_cbifd;
            }
        }
        let Some(next_ofsdir) = ofsdir.checked_add(SIZEOF_IFD_ENTRY) else {
            return restore_stream_pos_preserving_error(
                ws,
                set_pos,
                offCurPos,
                Err(crate::WmpError::BufferOverflow),
            );
        };
        ofsdir = next_ofsdir;
    }
    if cbEXIFIFD != 0 {
        let Some(next_cbifd) = cbifd
            .checked_add(cbifd & 1)
            .and_then(|cb| cb.checked_add(cbEXIFIFD))
        else {
            return restore_stream_pos_preserving_error(
                ws,
                set_pos,
                offCurPos,
                Err(crate::WmpError::BufferOverflow),
            );
        };
        cbifd = next_cbifd;
    }
    if cbGPSInfoIFD != 0 {
        let Some(next_cbifd) = cbifd
            .checked_add(cbifd & 1)
            .and_then(|cb| cb.checked_add(cbGPSInfoIFD))
        else {
            return restore_stream_pos_preserving_error(
                ws,
                set_pos,
                offCurPos,
                Err(crate::WmpError::BufferOverflow),
            );
        };
        cbifd = next_cbifd;
    }
    if cbInteroperabilityIFD != 0 {
        let Some(next_cbifd) = cbifd
            .checked_add(cbifd & 1)
            .and_then(|cb| cb.checked_add(cbInteroperabilityIFD))
        else {
            return restore_stream_pos_preserving_error(
                ws,
                set_pos,
                offCurPos,
                Err(crate::WmpError::BufferOverflow),
            );
        };
        cbifd = next_cbifd;
    }
    *pcbifd = cbifd;

    restore_stream_pos_preserving_error(ws, set_pos, offCurPos, err)
}

/// Original function: `BufferCopyIFD` at `original/jxrlib/jxrgluelib/JXRMeta.c:322`.
pub unsafe fn buffer_copy_ifd(
    pbsrc: Option<&[u8]>,
    ofssrc: u32,
    endian: u8,
    pbdst: Option<&mut [u8]>,
    pofsdst: Option<&mut u32>,
) -> Result<(), crate::WmpError> {
    let Some(src_buf) = pbsrc else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(dst_buf) = pbdst else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(pofsdst) = pofsdst else {
        return Err(crate::WmpError::InvalidParameter);
    };
    if src_buf.len() > u32::MAX as usize || dst_buf.len() > u32::MAX as usize {
        return Err(crate::WmpError::BufferOverflow);
    }
    let cbsrc = src_buf.len() as u32;
    let cbdst = dst_buf.len() as u32;
    let mut err: Result<(), crate::WmpError>;
    let mut cDir: u16 = 0;
    let mut ofsEXIFIFDEntry: u32 = 0;
    let mut ofsGPSInfoIFDEntry: u32 = 0;
    let mut ofsInteroperabilityIFDEntry: u32 = 0;
    let mut ofsEXIFIFD: u32 = 0;
    let mut ofsGPSInfoIFD: u32 = 0;
    let mut ofsInteroperabilityIFD: u32 = 0;
    let ofsdst = *pofsdst;

    err = get_bf_w_e(Some(src_buf), ofssrc as usize, Some(&mut cDir), endian);
    if err.is_err() {
        return err;
    }
    err = set_bf_w(Some(&mut *dst_buf), ofsdst as usize, cDir);
    if err.is_err() {
        return err;
    }
    let Some(dir_bytes) = SIZEOF_IFD_ENTRY.checked_mul(cDir as u32) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    let Some(ofsnextifd) = ofsdst
        .checked_add(std::mem::size_of::<u16>() as u32)
        .and_then(|ofs| ofs.checked_add(dir_bytes))
    else {
        return Err(crate::WmpError::BufferOverflow);
    };
    let Some(mut ofsdstnextdata) = ofsnextifd.checked_add(std::mem::size_of::<u32>() as u32) else {
        return Err(crate::WmpError::BufferOverflow);
    };

    let Some(mut ofssrcdir) = ofssrc.checked_add(std::mem::size_of::<u16>() as u32) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    let Some(mut ofsdstdir) = ofsdst.checked_add(std::mem::size_of::<u16>() as u32) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    for _ in 0..cDir {
        let mut tag: u16 = 0;
        let mut type_: u16 = 0;
        let mut count: u32 = 0;
        let mut value: u32 = 0;

        err = get_bf_w_e(Some(src_buf), ofssrcdir as usize, Some(&mut tag), endian);
        if err.is_err() {
            return err;
        }
        err = set_bf_w(Some(&mut *dst_buf), ofsdstdir as usize, tag);
        if err.is_err() {
            return err;
        }

        err = get_bf_w_e(
            Some(src_buf),
            match ofssrcdir.checked_add(std::mem::size_of::<u16>() as u32) {
                Some(ofs) => ofs as usize,
                None => return Err(crate::WmpError::BufferOverflow),
            },
            Some(&mut type_),
            endian,
        );
        if err.is_err() {
            return err;
        }
        err = set_bf_w(
            Some(&mut *dst_buf),
            match ofsdstdir.checked_add(std::mem::size_of::<u16>() as u32) {
                Some(ofs) => ofs as usize,
                None => return Err(crate::WmpError::BufferOverflow),
            },
            type_,
        );
        if err.is_err() {
            return err;
        }

        err = get_bf_dw_e(
            Some(src_buf),
            match ofssrcdir.checked_add(2 * std::mem::size_of::<u16>() as u32) {
                Some(ofs) => ofs as usize,
                None => return Err(crate::WmpError::BufferOverflow),
            },
            Some(&mut count),
            endian,
        );
        if err.is_err() {
            return err;
        }
        err = set_bf_dw(
            Some(&mut *dst_buf),
            match ofsdstdir.checked_add(2 * std::mem::size_of::<u16>() as u32) {
                Some(ofs) => ofs as usize,
                None => return Err(crate::WmpError::BufferOverflow),
            },
            count,
        );
        if err.is_err() {
            return err;
        }

        err = get_bf_dw_e(
            Some(src_buf),
            match ofssrcdir
                .checked_add(2 * std::mem::size_of::<u16>() as u32)
                .and_then(|ofs| ofs.checked_add(std::mem::size_of::<u32>() as u32))
            {
                Some(ofs) => ofs as usize,
                None => return Err(crate::WmpError::BufferOverflow),
            },
            Some(&mut value),
            endian,
        );
        if err.is_err() {
            return err;
        }
        err = set_bf_dw(
            Some(&mut *dst_buf),
            match ofsdstdir
                .checked_add(2 * std::mem::size_of::<u16>() as u32)
                .and_then(|ofs| ofs.checked_add(std::mem::size_of::<u32>() as u32))
            {
                Some(ofs) => ofs as usize,
                None => return Err(crate::WmpError::BufferOverflow),
            },
            0,
        );
        if err.is_err() {
            return err;
        }

        if type_ == 0 || type_ as usize >= IFD_ENTRY_TYPE_SIZES.len() {
            return Err(crate::WmpError::Fail);
        }
        if tag == WMP_tagEXIFMetadata {
            ofsEXIFIFDEntry = ofsdstdir;
            ofsEXIFIFD = value;
        } else if tag == WMP_tagGPSInfoMetadata {
            ofsGPSInfoIFDEntry = ofsdstdir;
            ofsGPSInfoIFD = value;
        } else if tag == WMP_tagInteroperabilityIFD {
            ofsInteroperabilityIFDEntry = ofsdstdir;
            ofsInteroperabilityIFD = value;
        } else {
            let Some(mut ofsdstdata) = ofsdstdir
                .checked_add(2 * std::mem::size_of::<u16>() as u32)
                .and_then(|ofs| ofs.checked_add(std::mem::size_of::<u32>() as u32))
            else {
                return Err(crate::WmpError::BufferOverflow);
            };
            let Some(mut ofssrcdata) = ofssrcdir
                .checked_add(2 * std::mem::size_of::<u16>() as u32)
                .and_then(|ofs| ofs.checked_add(std::mem::size_of::<u32>() as u32))
            else {
                return Err(crate::WmpError::BufferOverflow);
            };
            let Some(size) = count.checked_mul(IFD_ENTRY_TYPE_SIZES[type_ as usize]) else {
                return Err(crate::WmpError::BufferOverflow);
            };
            if size > 4 {
                ofssrcdata = value;
                err = set_bf_dw(Some(&mut *dst_buf), ofsdstdata as usize, ofsdstnextdata);
                if err.is_err() {
                    return err;
                }
                ofsdstdata = ofsdstnextdata;
                let Some(next_data) = ofsdstnextdata.checked_add(size) else {
                    return Err(crate::WmpError::BufferOverflow);
                };
                ofsdstnextdata = next_data;
            }
            let Some(ofssrcend) = ofssrcdata.checked_add(size) else {
                return Err(crate::WmpError::BufferOverflow);
            };
            let Some(ofsdstend) = ofsdstdata.checked_add(size) else {
                return Err(crate::WmpError::BufferOverflow);
            };
            if ofssrcend > cbsrc || ofsdstend > cbdst {
                return Err(crate::WmpError::BufferOverflow);
            }
            let Some(src) = src_buf.get(ofssrcdata as usize..ofssrcend as usize) else {
                return Err(crate::WmpError::BufferOverflow);
            };
            let Some(dst) = dst_buf.get_mut(ofsdstdata as usize..ofsdstend as usize) else {
                return Err(crate::WmpError::BufferOverflow);
            };
            if size == count || endian == WMP_INTEL_ENDIAN {
                dst.copy_from_slice(src);
            } else {
                match IFD_ENTRY_TYPE_SIZES[type_ as usize] {
                    2 => {
                        for (src, dst) in src.chunks_exact(2).zip(dst.chunks_exact_mut(2)) {
                            let bytes = [src[0], src[1]];
                            dst.copy_from_slice(&u16::from_be_bytes(bytes).to_le_bytes());
                        }
                    }
                    8 => {
                        if type_ == WMP_typDOUBLE {
                            for (src, dst) in src.chunks_exact(8).zip(dst.chunks_exact_mut(8)) {
                                let dwhi = u32::from_be_bytes([src[0], src[1], src[2], src[3]]);
                                let dwlo = u32::from_be_bytes([src[4], src[5], src[6], src[7]]);
                                dst[..4].copy_from_slice(&dwlo.to_le_bytes());
                                dst[4..].copy_from_slice(&dwhi.to_le_bytes());
                            }
                        } else {
                            for (src, dst) in src.chunks_exact(4).zip(dst.chunks_exact_mut(4)) {
                                let bytes = [src[0], src[1], src[2], src[3]];
                                dst.copy_from_slice(&u32::from_be_bytes(bytes).to_le_bytes());
                            }
                        }
                    }
                    4 => {
                        for (src, dst) in src.chunks_exact(4).zip(dst.chunks_exact_mut(4)) {
                            let bytes = [src[0], src[1], src[2], src[3]];
                            dst.copy_from_slice(&u32::from_be_bytes(bytes).to_le_bytes());
                        }
                    }
                    _ => {}
                }
            }
        }
        let Some(next_ofssrcdir) = ofssrcdir.checked_add(SIZEOF_IFD_ENTRY) else {
            return Err(crate::WmpError::BufferOverflow);
        };
        let Some(next_ofsdstdir) = ofsdstdir.checked_add(SIZEOF_IFD_ENTRY) else {
            return Err(crate::WmpError::BufferOverflow);
        };
        ofssrcdir = next_ofssrcdir;
        ofsdstdir = next_ofsdstdir;
    }
    err = set_bf_dw(Some(&mut *dst_buf), ofsnextifd as usize, 0);
    if err.is_err() {
        return err;
    }

    if ofsEXIFIFDEntry != 0 {
        let Some(aligned_next_data) = ofsdstnextdata.checked_add(ofsdstnextdata & 1) else {
            return Err(crate::WmpError::BufferOverflow);
        };
        ofsdstnextdata = aligned_next_data;
        err = set_bf_dw(
            Some(&mut *dst_buf),
            match ofsEXIFIFDEntry
                .checked_add(2 * std::mem::size_of::<u16>() as u32)
                .and_then(|ofs| ofs.checked_add(std::mem::size_of::<u32>() as u32))
            {
                Some(ofs) => ofs as usize,
                None => return Err(crate::WmpError::BufferOverflow),
            },
            ofsdstnextdata,
        );
        if err.is_err() {
            return err;
        }
        err = buffer_copy_ifd(
            Some(src_buf),
            ofsEXIFIFD,
            endian,
            Some(&mut *dst_buf),
            Some(&mut ofsdstnextdata),
        );
        if err.is_err() {
            return err;
        }
    }
    if ofsGPSInfoIFDEntry != 0 {
        let Some(aligned_next_data) = ofsdstnextdata.checked_add(ofsdstnextdata & 1) else {
            return Err(crate::WmpError::BufferOverflow);
        };
        ofsdstnextdata = aligned_next_data;
        err = set_bf_dw(
            Some(&mut *dst_buf),
            match ofsGPSInfoIFDEntry
                .checked_add(2 * std::mem::size_of::<u16>() as u32)
                .and_then(|ofs| ofs.checked_add(std::mem::size_of::<u32>() as u32))
            {
                Some(ofs) => ofs as usize,
                None => return Err(crate::WmpError::BufferOverflow),
            },
            ofsdstnextdata,
        );
        if err.is_err() {
            return err;
        }
        err = buffer_copy_ifd(
            Some(src_buf),
            ofsGPSInfoIFD,
            endian,
            Some(&mut *dst_buf),
            Some(&mut ofsdstnextdata),
        );
        if err.is_err() {
            return err;
        }
    }
    if ofsInteroperabilityIFDEntry != 0 {
        let Some(aligned_next_data) = ofsdstnextdata.checked_add(ofsdstnextdata & 1) else {
            return Err(crate::WmpError::BufferOverflow);
        };
        ofsdstnextdata = aligned_next_data;
        err = set_bf_dw(
            Some(&mut *dst_buf),
            match ofsInteroperabilityIFDEntry
                .checked_add(2 * std::mem::size_of::<u16>() as u32)
                .and_then(|ofs| ofs.checked_add(std::mem::size_of::<u32>() as u32))
            {
                Some(ofs) => ofs as usize,
                None => return Err(crate::WmpError::BufferOverflow),
            },
            ofsdstnextdata,
        );
        if err.is_err() {
            return err;
        }
        err = buffer_copy_ifd(
            Some(src_buf),
            ofsInteroperabilityIFD,
            endian,
            Some(&mut *dst_buf),
            Some(&mut ofsdstnextdata),
        );
        if err.is_err() {
            return err;
        }
    }
    *pofsdst = ofsdstnextdata;
    err
}

/// Original function: `StreamCopyIFD` at `original/jxrlib/jxrgluelib/JXRMeta.c:474`.
pub unsafe fn stream_copy_ifd(
    pWS: *mut WMPStream,
    ofssrc: u32,
    pbdst: Option<&mut [u8]>,
    pofsdst: Option<&mut u32>,
) -> Result<(), crate::WmpError> {
    let Some(ws) = pWS.as_mut() else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(pofsdst) = pofsdst else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(dst_buf) = pbdst else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let mut offCurPos: usize = 0;
    let mut err: Result<(), crate::WmpError>;
    let mut cDir: u16 = 0;
    let mut ofsEXIFIFDEntry: u32 = 0;
    let mut ofsGPSInfoIFDEntry: u32 = 0;
    let mut ofsInteroperabilityIFDEntry: u32 = 0;
    let mut ofsEXIFIFD: u32 = 0;
    let mut ofsGPSInfoIFD: u32 = 0;
    let mut ofsInteroperabilityIFD: u32 = 0;
    let ofsdst = *pofsdst;
    let Some(get_pos) = ws.GetPos else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(set_pos) = ws.SetPos else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(read) = ws.Read else {
        return Err(crate::WmpError::InvalidParameter);
    };

    err = get_pos(ws, &mut offCurPos);
    if err.is_err() {
        return err;
    }

    'cleanup: loop {
        err = get_u_short(ws, ofssrc as usize, Some(&mut cDir));
        if err.is_err() {
            break 'cleanup;
        }
        err = set_bf_w(Some(&mut *dst_buf), ofsdst as usize, cDir);
        if err.is_err() {
            break 'cleanup;
        }

        let Some(dir_bytes) = SIZEOF_IFD_ENTRY.checked_mul(cDir as u32) else {
            err = Err(crate::WmpError::BufferOverflow);
            break 'cleanup;
        };
        let Some(ofsnextifd) = ofsdst
            .checked_add(std::mem::size_of::<u16>() as u32)
            .and_then(|ofs| ofs.checked_add(dir_bytes))
        else {
            err = Err(crate::WmpError::BufferOverflow);
            break 'cleanup;
        };
        let Some(mut ofsdstnextdata) = ofsnextifd.checked_add(std::mem::size_of::<u32>() as u32)
        else {
            err = Err(crate::WmpError::BufferOverflow);
            break 'cleanup;
        };

        let Some(mut ofssrcdir) = ofssrc.checked_add(std::mem::size_of::<u16>() as u32) else {
            err = Err(crate::WmpError::BufferOverflow);
            break 'cleanup;
        };
        let Some(mut ofsdstdir) = ofsdst.checked_add(std::mem::size_of::<u16>() as u32) else {
            err = Err(crate::WmpError::BufferOverflow);
            break 'cleanup;
        };
        for _ in 0..cDir {
            let mut tag: u16 = 0;
            let mut type_: u16 = 0;
            let mut count: u32 = 0;
            let mut value: u32 = 0;

            err = get_u_short(ws, ofssrcdir as usize, Some(&mut tag));
            if err.is_err() {
                break 'cleanup;
            }
            err = set_bf_w(Some(&mut *dst_buf), ofsdstdir as usize, tag);
            if err.is_err() {
                break 'cleanup;
            }

            err = get_u_short(
                ws,
                match ofssrcdir.checked_add(std::mem::size_of::<u16>() as u32) {
                    Some(ofs) => ofs as usize,
                    None => {
                        err = Err(crate::WmpError::BufferOverflow);
                        break 'cleanup;
                    }
                },
                Some(&mut type_),
            );
            if err.is_err() {
                break 'cleanup;
            }
            err = set_bf_w(
                Some(&mut *dst_buf),
                match ofsdstdir.checked_add(std::mem::size_of::<u16>() as u32) {
                    Some(ofs) => ofs as usize,
                    None => {
                        err = Err(crate::WmpError::BufferOverflow);
                        break 'cleanup;
                    }
                },
                type_,
            );
            if err.is_err() {
                break 'cleanup;
            }

            err = get_u_long(
                ws,
                match ofssrcdir.checked_add(2 * std::mem::size_of::<u16>() as u32) {
                    Some(ofs) => ofs as usize,
                    None => {
                        err = Err(crate::WmpError::BufferOverflow);
                        break 'cleanup;
                    }
                },
                Some(&mut count),
            );
            if err.is_err() {
                break 'cleanup;
            }
            err = set_bf_dw(
                Some(&mut *dst_buf),
                match ofsdstdir.checked_add(2 * std::mem::size_of::<u16>() as u32) {
                    Some(ofs) => ofs as usize,
                    None => {
                        err = Err(crate::WmpError::BufferOverflow);
                        break 'cleanup;
                    }
                },
                count,
            );
            if err.is_err() {
                break 'cleanup;
            }

            err = get_u_long(
                ws,
                match ofssrcdir
                    .checked_add(2 * std::mem::size_of::<u16>() as u32)
                    .and_then(|ofs| ofs.checked_add(std::mem::size_of::<u32>() as u32))
                {
                    Some(ofs) => ofs as usize,
                    None => {
                        err = Err(crate::WmpError::BufferOverflow);
                        break 'cleanup;
                    }
                },
                Some(&mut value),
            );
            if err.is_err() {
                break 'cleanup;
            }
            err = set_bf_dw(
                Some(&mut *dst_buf),
                match ofsdstdir
                    .checked_add(2 * std::mem::size_of::<u16>() as u32)
                    .and_then(|ofs| ofs.checked_add(std::mem::size_of::<u32>() as u32))
                {
                    Some(ofs) => ofs as usize,
                    None => {
                        err = Err(crate::WmpError::BufferOverflow);
                        break 'cleanup;
                    }
                },
                0,
            );
            if err.is_err() {
                break 'cleanup;
            }

            if type_ == 0 || type_ as usize >= IFD_ENTRY_TYPE_SIZES.len() {
                err = Err(crate::WmpError::Fail);
                break 'cleanup;
            }
            if tag == WMP_tagEXIFMetadata {
                ofsEXIFIFDEntry = ofsdstdir;
                ofsEXIFIFD = value;
            } else if tag == WMP_tagGPSInfoMetadata {
                ofsGPSInfoIFDEntry = ofsdstdir;
                ofsGPSInfoIFD = value;
            } else if tag == WMP_tagInteroperabilityIFD {
                ofsInteroperabilityIFDEntry = ofsdstdir;
                ofsInteroperabilityIFD = value;
            } else {
                let Some(mut ofsdstdata) = ofsdstdir
                    .checked_add(2 * std::mem::size_of::<u16>() as u32)
                    .and_then(|ofs| ofs.checked_add(std::mem::size_of::<u32>() as u32))
                else {
                    err = Err(crate::WmpError::BufferOverflow);
                    break 'cleanup;
                };
                let Some(mut ofssrcdata) = ofssrcdir
                    .checked_add(2 * std::mem::size_of::<u16>() as u32)
                    .and_then(|ofs| ofs.checked_add(std::mem::size_of::<u32>() as u32))
                else {
                    err = Err(crate::WmpError::BufferOverflow);
                    break 'cleanup;
                };
                let Some(size) = count.checked_mul(IFD_ENTRY_TYPE_SIZES[type_ as usize]) else {
                    err = Err(crate::WmpError::BufferOverflow);
                    break 'cleanup;
                };
                if size > 4 {
                    ofssrcdata = value;
                    err = set_bf_dw(Some(&mut *dst_buf), ofsdstdata as usize, ofsdstnextdata);
                    if err.is_err() {
                        break 'cleanup;
                    }
                    ofsdstdata = ofsdstnextdata;
                    let Some(next_data) = ofsdstnextdata.checked_add(size) else {
                        err = Err(crate::WmpError::BufferOverflow);
                        break 'cleanup;
                    };
                    ofsdstnextdata = next_data;
                }
                let Some(ofsdstend) = ofsdstdata.checked_add(size) else {
                    err = Err(crate::WmpError::BufferOverflow);
                    break 'cleanup;
                };
                if ofsdstend as usize > dst_buf.len() {
                    err = Err(crate::WmpError::BufferOverflow);
                    break 'cleanup;
                }
                let Some(dst) = dst_buf.get_mut(ofsdstdata as usize..ofsdstend as usize) else {
                    err = Err(crate::WmpError::BufferOverflow);
                    break 'cleanup;
                };
                err = set_pos(ws, ofssrcdata as usize);
                if err.is_err() {
                    break 'cleanup;
                }
                err = read(ws, dst);
                if err.is_err() {
                    break 'cleanup;
                }
            }
            let Some(next_ofssrcdir) = ofssrcdir.checked_add(SIZEOF_IFD_ENTRY) else {
                err = Err(crate::WmpError::BufferOverflow);
                break 'cleanup;
            };
            let Some(next_ofsdstdir) = ofsdstdir.checked_add(SIZEOF_IFD_ENTRY) else {
                err = Err(crate::WmpError::BufferOverflow);
                break 'cleanup;
            };
            ofssrcdir = next_ofssrcdir;
            ofsdstdir = next_ofsdstdir;
        }
        err = set_bf_dw(Some(&mut *dst_buf), ofsnextifd as usize, 0);
        if err.is_err() {
            break 'cleanup;
        }

        if ofsEXIFIFDEntry != 0 {
            let Some(aligned_next_data) = ofsdstnextdata.checked_add(ofsdstnextdata & 1) else {
                err = Err(crate::WmpError::BufferOverflow);
                break 'cleanup;
            };
            ofsdstnextdata = aligned_next_data;
            err = set_bf_dw(
                Some(&mut *dst_buf),
                match ofsEXIFIFDEntry
                    .checked_add(2 * std::mem::size_of::<u16>() as u32)
                    .and_then(|ofs| ofs.checked_add(std::mem::size_of::<u32>() as u32))
                {
                    Some(ofs) => ofs as usize,
                    None => {
                        err = Err(crate::WmpError::BufferOverflow);
                        break 'cleanup;
                    }
                },
                ofsdstnextdata,
            );
            if err.is_err() {
                break 'cleanup;
            }
            err = stream_copy_ifd(
                pWS,
                ofsEXIFIFD,
                Some(&mut *dst_buf),
                Some(&mut ofsdstnextdata),
            );
            if err.is_err() {
                break 'cleanup;
            }
        }
        if ofsGPSInfoIFDEntry != 0 {
            let Some(aligned_next_data) = ofsdstnextdata.checked_add(ofsdstnextdata & 1) else {
                err = Err(crate::WmpError::BufferOverflow);
                break 'cleanup;
            };
            ofsdstnextdata = aligned_next_data;
            err = set_bf_dw(
                Some(&mut *dst_buf),
                match ofsGPSInfoIFDEntry
                    .checked_add(2 * std::mem::size_of::<u16>() as u32)
                    .and_then(|ofs| ofs.checked_add(std::mem::size_of::<u32>() as u32))
                {
                    Some(ofs) => ofs as usize,
                    None => {
                        err = Err(crate::WmpError::BufferOverflow);
                        break 'cleanup;
                    }
                },
                ofsdstnextdata,
            );
            if err.is_err() {
                break 'cleanup;
            }
            err = stream_copy_ifd(
                pWS,
                ofsGPSInfoIFD,
                Some(&mut *dst_buf),
                Some(&mut ofsdstnextdata),
            );
            if err.is_err() {
                break 'cleanup;
            }
        }
        if ofsInteroperabilityIFDEntry != 0 {
            let Some(aligned_next_data) = ofsdstnextdata.checked_add(ofsdstnextdata & 1) else {
                err = Err(crate::WmpError::BufferOverflow);
                break 'cleanup;
            };
            ofsdstnextdata = aligned_next_data;
            err = set_bf_dw(
                Some(&mut *dst_buf),
                match ofsInteroperabilityIFDEntry
                    .checked_add(2 * std::mem::size_of::<u16>() as u32)
                    .and_then(|ofs| ofs.checked_add(std::mem::size_of::<u32>() as u32))
                {
                    Some(ofs) => ofs as usize,
                    None => {
                        err = Err(crate::WmpError::BufferOverflow);
                        break 'cleanup;
                    }
                },
                ofsdstnextdata,
            );
            if err.is_err() {
                break 'cleanup;
            }
            err = stream_copy_ifd(
                pWS,
                ofsInteroperabilityIFD,
                Some(&mut *dst_buf),
                Some(&mut ofsdstnextdata),
            );
            if err.is_err() {
                break 'cleanup;
            }
        }
        *pofsdst = ofsdstnextdata;
        break 'cleanup;
    }

    restore_stream_pos_preserving_error(ws, set_pos, offCurPos, err)
}

/// Original function: `GetUShort` at `original/jxrlib/jxrgluelib/JXRMeta.c:590`.
pub unsafe fn get_u_short(
    ws: &mut WMPStream,
    offPos: usize,
    puValue: Option<&mut u16>,
) -> Result<(), crate::WmpError> {
    let Some(pu_value) = puValue else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let mut err: Result<(), crate::WmpError>;
    let mut bytes = [0_u8; std::mem::size_of::<u16>()];
    let Some(set_pos) = ws.SetPos else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(read) = ws.Read else {
        return Err(crate::WmpError::InvalidParameter);
    };

    err = set_pos(ws, offPos);
    if err.is_err() {
        return err;
    }
    err = read(ws, &mut bytes);
    if err.is_err() {
        return err;
    }
    *pu_value = u16::from_le_bytes(bytes);

    err
}

/// Original function: `GetULong` at `original/jxrlib/jxrgluelib/JXRMeta.c:625`.
pub unsafe fn get_u_long(
    ws: &mut WMPStream,
    offPos: usize,
    puValue: Option<&mut u32>,
) -> Result<(), crate::WmpError> {
    let Some(pu_value) = puValue else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let mut err: Result<(), crate::WmpError>;
    let mut bytes = [0_u8; std::mem::size_of::<u32>()];
    let Some(set_pos) = ws.SetPos else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(read) = ws.Read else {
        return Err(crate::WmpError::InvalidParameter);
    };

    err = set_pos(ws, offPos);
    if err.is_err() {
        return err;
    }
    err = read(ws, &mut bytes);
    if err.is_err() {
        return err;
    }
    *pu_value = u32::from_le_bytes(bytes);

    err
}

/// Original function: `PutUShort` at `original/jxrlib/jxrgluelib/JXRMeta.c:608`.
pub unsafe fn put_u_short(
    ws: &mut WMPStream,
    offPos: usize,
    uValue: u16,
) -> Result<(), crate::WmpError> {
    let mut err: Result<(), crate::WmpError>;
    let bytes = uValue.to_le_bytes();
    let Some(set_pos) = ws.SetPos else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(write) = ws.Write else {
        return Err(crate::WmpError::InvalidParameter);
    };

    err = set_pos(ws, offPos);
    if err.is_err() {
        return err;
    }
    err = write(ws, &bytes);

    err
}

/// Original function: `PutULong` at `original/jxrlib/jxrgluelib/JXRMeta.c:647`.
pub unsafe fn put_u_long(
    ws: &mut WMPStream,
    offPos: usize,
    uValue: u32,
) -> Result<(), crate::WmpError> {
    let mut err: Result<(), crate::WmpError>;
    let bytes = uValue.to_le_bytes();
    let Some(set_pos) = ws.SetPos else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(write) = ws.Write else {
        return Err(crate::WmpError::InvalidParameter);
    };

    err = set_pos(ws, offPos);
    if err.is_err() {
        return err;
    }
    err = write(ws, &bytes);

    err
}

/// Original function: `ReadBinaryData` at `original/jxrlib/jxrgluelib/JXRMeta.c:669`.
pub unsafe fn read_binary_data(
    pWS: *mut WMPStream,
    uCount: u32,
    uValue: u32,
    data: &mut Vec<u8>,
) -> Result<(), crate::WmpError> {
    let Some(data_len) = (uCount as usize).checked_add(2) else {
        return Err(crate::WmpError::BufferOverflow);
    };

    data.clear();
    if data.try_reserve_exact(data_len).is_err() {
        return Err(crate::WmpError::OutOfMemory);
    }
    data.resize(data_len, 0);

    let mut err: Result<(), crate::WmpError> = Ok(());
    loop {
        if uCount <= 4 {
            let value_bytes = uValue.to_le_bytes();
            let Some(dst) = data.as_mut_slice().get_mut(..uCount as usize) else {
                err = Err(crate::WmpError::BufferOverflow);
                break;
            };
            dst.copy_from_slice(&value_bytes[..uCount as usize]);
            break;
        }

        let mut offPosPrev: usize = 0;
        let Some(ws) = pWS.as_mut() else {
            err = Err(crate::WmpError::InvalidParameter);
            break;
        };
        let Some(get_pos) = ws.GetPos else {
            err = Err(crate::WmpError::InvalidParameter);
            break;
        };
        let Some(set_pos) = ws.SetPos else {
            err = Err(crate::WmpError::InvalidParameter);
            break;
        };
        let Some(read) = ws.Read else {
            err = Err(crate::WmpError::InvalidParameter);
            break;
        };

        err = get_pos(ws, &mut offPosPrev);
        if err.is_err() {
            break;
        }
        err = set_pos(ws, uValue as usize);
        if err.is_err() {
            break;
        }
        err = match data.as_mut_slice().get_mut(..uCount as usize) {
            Some(dst) => read(ws, dst),
            None => Err(crate::WmpError::BufferOverflow),
        };
        err = restore_stream_pos_preserving_error(ws, set_pos, offPosPrev, err);
        break;
    }

    if err.is_err() {
        return err;
    }

    err
}

/// Original function: `ReadPropvar` at `original/jxrlib/jxrgluelib/JXRMeta.c:706`.
pub unsafe fn read_propvar(
    pWS: *mut WMPStream,
    uType: u16,
    uCount: u32,
    uValue: u32,
    pvar: *mut DPKPROPVARIANT,
) -> Result<(), crate::WmpError> {
    let Some(pvar) = pvar.as_mut() else {
        return Err(crate::WmpError::InvalidParameter);
    };
    *pvar = DPKPROPVARIANT::default();
    if uCount == 0 {
        return Ok(());
    }

    match uType {
        WMP_typASCII => {
            pvar.vt = DpkVarType::LpStr;
            let Some(data_len) = (uCount as usize).checked_add(2) else {
                return Err(crate::WmpError::BufferOverflow);
            };
            let mut data = Vec::new();
            let err = read_binary_data(pWS, uCount, uValue, &mut data);
            if err.is_err() {
                return err;
            }
            if data[uCount as usize - 1] != 0 {
                return Err(crate::WmpError::InvalidParameter);
            }
            data[uCount as usize] = 0;
            debug_assert_eq!(data.len(), data_len);
            pvar.value = DpkPropVariantValue::Bytes(data);
            Ok(())
        }
        WMP_typBYTE | WMP_typUNDEFINED => {
            pvar.vt = DpkVarType::ByRefUi1;
            let mut data = Vec::new();
            let err = read_binary_data(pWS, uCount, uValue, &mut data);
            if err.is_err() {
                return err;
            }
            pvar.value = DpkPropVariantValue::Bytes(data);
            Ok(())
        }
        WMP_typSHORT => {
            if uCount == 1 {
                pvar.vt = DpkVarType::Ui2;
                pvar.value = DpkPropVariantValue::Ui2((uValue & 0x0000ffff) as u16);
                Ok(())
            } else if uCount == 2 {
                pvar.vt = DpkVarType::Ui4;
                pvar.value = DpkPropVariantValue::Ui4(uValue);
                Ok(())
            } else {
                debug_assert!(false);
                Err(crate::WmpError::NotYetImplemented)
            }
        }
        _ => {
            debug_assert!(false);
            Err(crate::WmpError::NotYetImplemented)
        }
    }
}

/// Original function: `WriteWmpDE` at `original/jxrlib/jxrgluelib/JXRMeta.c:767`.
pub unsafe fn write_wmp_de(
    ws: &mut WMPStream,
    off_pos_out: &mut usize,
    de: &tagWmpDE,
    pb_data: Option<&[u8]>,
    pcbDataWrittenToOffset: Option<&mut u32>,
) -> Result<(), crate::WmpError> {
    let mut err: Result<(), crate::WmpError>;
    let mut offPos = *off_pos_out;
    let mut data_written_to_offset = pcbDataWrittenToOffset;
    let Some(set_pos) = ws.SetPos else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(write) = ws.Write else {
        return Err(crate::WmpError::InvalidParameter);
    };

    debug_assert_ne!(de.uCount, u32::MAX);
    debug_assert_ne!(de.uValueOrOffset, u32::MAX);

    if let Some(written) = data_written_to_offset.as_deref_mut() {
        debug_assert!(pb_data.is_some());
        *written = 0;
    }

    'cleanup: loop {
        err = put_u_short(ws, offPos, de.uTag);
        if err.is_err() {
            break 'cleanup;
        }
        offPos += 2;
        err = put_u_short(ws, offPos, de.uType);
        if err.is_err() {
            break 'cleanup;
        }
        offPos += 2;
        err = put_u_long(ws, offPos, de.uCount);
        if err.is_err() {
            break 'cleanup;
        }
        offPos += 4;

        match de.uType {
            WMP_typASCII | WMP_typUNDEFINED | WMP_typBYTE => {
                if de.uCount <= 4 {
                    let pad = [0_u8; 4];
                    err = set_pos(ws, offPos);
                    if err.is_err() {
                        break 'cleanup;
                    }

                    let inline_value = de.uValueOrOffset.to_ne_bytes();
                    let data = pb_data.unwrap_or(inline_value.as_slice());
                    let Some(data) = data.get(..de.uCount as usize) else {
                        err = Err(crate::WmpError::BufferOverflow);
                        break 'cleanup;
                    };

                    err = write(ws, data);
                    if err.is_err() {
                        break 'cleanup;
                    }
                    err = write(ws, &pad[..(4 - de.uCount) as usize]);
                    if err.is_err() {
                        break 'cleanup;
                    }
                    offPos += 4;
                } else {
                    err = put_u_long(ws, offPos, de.uValueOrOffset);
                    if err.is_err() {
                        break 'cleanup;
                    }
                    offPos += 4;

                    if let Some(pb_data) = pb_data {
                        err = set_pos(ws, de.uValueOrOffset as usize);
                        if err.is_err() {
                            break 'cleanup;
                        }
                        let Some(data) = pb_data.get(..de.uCount as usize) else {
                            err = Err(crate::WmpError::BufferOverflow);
                            break 'cleanup;
                        };
                        err = write(ws, data);
                        if err.is_err() {
                            break 'cleanup;
                        }
                        err = set_pos(ws, offPos);
                        if err.is_err() {
                            break 'cleanup;
                        }
                        if let Some(written) = data_written_to_offset.as_deref_mut() {
                            *written = de.uCount;
                        }
                    }
                }
            }
            WMP_typSHORT => {
                if de.uCount <= 2 {
                    let mut uiShrt1 = 0;
                    let mut uiShrt2 = 0;
                    let value_bytes;
                    let data = if let Some(data) = pb_data {
                        data
                    } else {
                        value_bytes = de.uValueOrOffset.to_ne_bytes();
                        value_bytes.as_slice()
                    };

                    if de.uCount > 0 {
                        let Some(bytes) = data.get(..2) else {
                            err = Err(crate::WmpError::BufferOverflow);
                            break 'cleanup;
                        };
                        let Ok(bytes) = bytes.try_into() else {
                            err = Err(crate::WmpError::BufferOverflow);
                            break 'cleanup;
                        };
                        uiShrt1 = u16::from_ne_bytes(bytes);
                    }

                    if de.uCount > 1 {
                        debug_assert!(false);
                        let Some(bytes) = data.get(2..4) else {
                            err = Err(crate::WmpError::BufferOverflow);
                            break 'cleanup;
                        };
                        let Ok(bytes) = bytes.try_into() else {
                            err = Err(crate::WmpError::BufferOverflow);
                            break 'cleanup;
                        };
                        uiShrt2 = u16::from_ne_bytes(bytes);
                    }

                    err = put_u_short(ws, offPos, uiShrt1);
                    if err.is_err() {
                        break 'cleanup;
                    }
                    offPos += 2;
                    err = put_u_short(ws, offPos, uiShrt2);
                    if err.is_err() {
                        break 'cleanup;
                    }
                    offPos += 2;
                } else {
                    debug_assert!(false);
                    err = put_u_long(ws, offPos, de.uValueOrOffset);
                    if err.is_err() {
                        break 'cleanup;
                    }
                    offPos += 4;

                    if let Some(pb_data) = pb_data {
                        let Some(byte_count) =
                            (de.uCount as usize).checked_mul(std::mem::size_of::<u16>())
                        else {
                            err = Err(crate::WmpError::BufferOverflow);
                            break 'cleanup;
                        };
                        let Some(data) = pb_data.get(..byte_count) else {
                            err = Err(crate::WmpError::BufferOverflow);
                            break 'cleanup;
                        };
                        err = set_pos(ws, de.uValueOrOffset as usize);
                        if err.is_err() {
                            break 'cleanup;
                        }
                        for bytes in data.chunks_exact(std::mem::size_of::<u16>()) {
                            let Ok(bytes) = bytes.try_into() else {
                                err = Err(crate::WmpError::BufferOverflow);
                                break 'cleanup;
                            };
                            let uiShort = u16::from_ne_bytes(bytes);
                            err = put_u_short(ws, offPos, uiShort);
                            if err.is_err() {
                                break 'cleanup;
                            }
                        }
                        err = set_pos(ws, offPos);
                        if err.is_err() {
                            break 'cleanup;
                        }
                        if let Some(written) = data_written_to_offset.as_deref_mut() {
                            *written = de.uCount * std::mem::size_of::<u16>() as u32;
                        }
                    }
                }
            }
            WMP_typFLOAT | WMP_typLONG => {
                if de.uCount <= 1 {
                    let value_bytes;
                    let data = if let Some(pb_data) = pb_data {
                        let Some(data) = pb_data.get(..std::mem::size_of::<u32>()) else {
                            err = Err(crate::WmpError::BufferOverflow);
                            break 'cleanup;
                        };
                        data
                    } else {
                        value_bytes = de.uValueOrOffset.to_ne_bytes();
                        value_bytes.as_slice()
                    };

                    let Ok(value) = data.try_into() else {
                        err = Err(crate::WmpError::BufferOverflow);
                        break 'cleanup;
                    };
                    err = put_u_long(ws, offPos, u32::from_ne_bytes(value));
                    if err.is_err() {
                        break 'cleanup;
                    }
                    offPos += 4;
                } else {
                    debug_assert!(false);
                    err = put_u_long(ws, offPos, de.uValueOrOffset);
                    if err.is_err() {
                        break 'cleanup;
                    }
                    offPos += 4;

                    if let Some(pb_data) = pb_data {
                        let Some(byte_count) =
                            (de.uCount as usize).checked_mul(std::mem::size_of::<u32>())
                        else {
                            err = Err(crate::WmpError::BufferOverflow);
                            break 'cleanup;
                        };
                        let Some(data) = pb_data.get(..byte_count) else {
                            err = Err(crate::WmpError::BufferOverflow);
                            break 'cleanup;
                        };
                        err = set_pos(ws, de.uValueOrOffset as usize);
                        if err.is_err() {
                            break 'cleanup;
                        }
                        for bytes in data.chunks_exact(std::mem::size_of::<u32>()) {
                            let Ok(bytes) = bytes.try_into() else {
                                err = Err(crate::WmpError::BufferOverflow);
                                break 'cleanup;
                            };
                            let uLong = u32::from_ne_bytes(bytes);
                            err = put_u_long(ws, offPos, uLong);
                            if err.is_err() {
                                break 'cleanup;
                            }
                        }
                        err = set_pos(ws, offPos);
                        if err.is_err() {
                            break 'cleanup;
                        }
                        if let Some(written) = data_written_to_offset.as_deref_mut() {
                            *written = de.uCount * std::mem::size_of::<u32>() as u32;
                        }
                    }
                }
            }
            _ => {
                debug_assert!(false);
                err = Err(crate::WmpError::InvalidParameter);
                break 'cleanup;
            }
        }

        break 'cleanup;
    }

    *off_pos_out = offPos;
    err
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::image::sys::strcodec::{create_ws_memory_owned, get_pos_ws_memory};

    unsafe fn set_pos_ws_memory_fails_at_five(
        ws: &mut WMPStream,
        off_pos: usize,
    ) -> Result<(), crate::WmpError> {
        if off_pos == 5 {
            Err(crate::WmpError::Fail)
        } else {
            ws.state.buf.cbCur = off_pos;
            Ok(())
        }
    }

    unsafe fn get_le_u32(buf: &[u8], offset: usize) -> u32 {
        u32::from_le_bytes(buf[offset..offset + 4].try_into().unwrap())
    }

    #[test]
    fn get_helpers_read_little_and_big_endian_values() {
        let data = [0x10, 0x34, 0x12, 0x78, 0x56, 0x34, 0x12];
        let mut w = 0;
        let mut dw = 0;

        unsafe {
            assert_eq!(get_bf_w(Some(&data), 1, Some(&mut w)), Ok(()));
            assert_eq!(w, 0x1234);
            assert_eq!(get_bf_w_big(Some(&data), 1, Some(&mut w)), Ok(()));
            assert_eq!(w, 0x3412);

            assert_eq!(get_bf_dw(Some(&data), 3, Some(&mut dw)), Ok(()));
            assert_eq!(dw, 0x12345678);
            assert_eq!(get_bf_dw_big(Some(&data), 3, Some(&mut dw)), Ok(()));
            assert_eq!(dw, 0x78563412);
        }
    }

    #[test]
    fn get_endian_dispatch_matches_wmp_intel_marker() {
        let data = [0x44, 0x33, 0x22, 0x11];
        let mut w = 0;
        let mut dw = 0;

        unsafe {
            assert_eq!(
                get_bf_w_e(Some(&data), 0, Some(&mut w), WMP_INTEL_ENDIAN),
                Ok(())
            );
            assert_eq!(w, 0x3344);
            assert_eq!(get_bf_w_e(Some(&data), 0, Some(&mut w), b'M'), Ok(()));
            assert_eq!(w, 0x4433);

            assert_eq!(
                get_bf_dw_e(Some(&data), 0, Some(&mut dw), WMP_INTEL_ENDIAN),
                Ok(())
            );
            assert_eq!(dw, 0x11223344);
            assert_eq!(get_bf_dw_e(Some(&data), 0, Some(&mut dw), b'M'), Ok(()));
            assert_eq!(dw, 0x44332211);
        }
    }

    #[test]
    fn set_helpers_write_little_and_big_endian_values() {
        let mut data = [0; 10];
        let src = [9, 8, 7];
        let mut copied = [0; 3];

        unsafe {
            assert_eq!(set_bf_cpy(Some(&mut data), 1, Some(&src)), Ok(()));
            assert_eq!(&data[1..4], &src);
            let copied_len = copied.len() as u32;
            assert_eq!(
                get_bf_cpy(Some(&mut copied), Some(&data), 1, copied_len,),
                Ok(())
            );
            assert_eq!(copied, src);

            assert_eq!(set_bf_w(Some(&mut data), 4, 0x1234), Ok(()));
            assert_eq!(&data[4..6], &[0x34, 0x12]);
            assert_eq!(set_bf_w_big(Some(&mut data), 4, 0x1234), Ok(()));
            assert_eq!(&data[4..6], &[0x12, 0x34]);

            assert_eq!(set_bf_dw(Some(&mut data), 2, 0x12345678), Ok(()));
            assert_eq!(&data[2..6], &[0x78, 0x56, 0x34, 0x12]);
            assert_eq!(set_bf_dw_big(Some(&mut data), 2, 0x12345678), Ok(()));
            assert_eq!(&data[2..6], &[0x12, 0x34, 0x56, 0x78]);
        }
    }

    #[test]
    fn helpers_report_buffer_overflow() {
        let mut data = [0; 2];
        let mut w = 0;
        let mut dw = 0;
        let src = [1, 2, 3];

        unsafe {
            assert_eq!(
                get_bf_cpy(Some(&mut data), Some(&src[..2]), 1, 2),
                Err(crate::WmpError::BufferOverflow)
            );
            assert_eq!(
                get_bf_w(Some(&data), 1, Some(&mut w)),
                Err(crate::WmpError::BufferOverflow)
            );
            assert_eq!(
                get_bf_dw(Some(&data), 0, Some(&mut dw)),
                Err(crate::WmpError::BufferOverflow)
            );
            assert_eq!(
                set_bf_cpy(Some(&mut data), 1, Some(&src)),
                Err(crate::WmpError::BufferOverflow)
            );
            assert_eq!(
                set_bf_w(Some(&mut data), 1, 0),
                Err(crate::WmpError::BufferOverflow)
            );
            assert_eq!(
                set_bf_dw(Some(&mut data), 0, 0),
                Err(crate::WmpError::BufferOverflow)
            );
        }
    }

    #[test]
    fn stream_integer_readers_use_little_endian_offsets() {
        let mut data = [0x99_u8, 0x34, 0x12, 0x78, 0x56, 0x34, 0x12];
        let mut word = 0;
        let mut dword = 0;

        unsafe {
            let mut stream = create_ws_memory_owned(Some(&mut data));
            assert_eq!(get_u_short(&mut *stream, 1, Some(&mut word)), Ok(()));
            assert_eq!(word, 0x1234);
            assert_eq!(get_u_long(&mut *stream, 3, Some(&mut dword)), Ok(()));
            assert_eq!(dword, 0x12345678);
            assert_eq!((*stream).state.buf.cbCur, 7);
        }
    }

    #[test]
    fn read_binary_data_copies_inline_low_bytes_and_zero_padding() {
        let mut data = Vec::new();

        unsafe {
            assert_eq!(
                read_binary_data(std::ptr::null_mut(), 3, 0x11223344, &mut data),
                Ok(())
            );
            assert_eq!(data, [0x44, 0x33, 0x22, 0, 0]);
        }
    }

    #[test]
    fn read_binary_data_reads_stream_data_and_restores_position() {
        let mut backing = [0_u8, 1, 2, 10, 11, 12, 13, 14, 99];
        let mut data = Vec::new();
        let mut pos = 0;

        unsafe {
            let mut stream = create_ws_memory_owned(Some(&mut backing));
            assert_eq!(
                (*stream).SetPos.map(|set_pos| set_pos(&mut *stream, 2)),
                Some(Ok(()))
            );

            assert_eq!(read_binary_data(&mut *stream, 5, 3, &mut data), Ok(()));
            assert_eq!(data, [10, 11, 12, 13, 14, 0, 0]);
            assert!(get_pos_ws_memory(&mut *stream, &mut pos).is_ok());
            assert_eq!(pos, 2);
        }
    }

    #[test]
    fn read_binary_data_restores_position_and_preserves_read_error() {
        let mut backing = [0_u8; 8];
        let mut data = Vec::new();
        let mut pos = 0;

        unsafe {
            let mut stream = create_ws_memory_owned(Some(&mut backing));
            assert_eq!(
                (*stream).SetPos.map(|set_pos| set_pos(&mut *stream, 2)),
                Some(Ok(()))
            );

            assert_eq!(
                read_binary_data(&mut *stream, 5, 6, &mut data),
                Err(crate::WmpError::BufferOverflow)
            );
            assert!(get_pos_ws_memory(&mut *stream, &mut pos).is_ok());
            assert_eq!(pos, 2);
        }
    }

    #[test]
    fn read_propvar_zero_count_clears_variant() {
        let mut var = DPKPROPVARIANT {
            vt: DpkVarType::Ui4,
            value: DpkPropVariantValue::Ui4(0xabcdef01),
        };

        unsafe {
            assert_eq!(
                read_propvar(std::ptr::null_mut(), WMP_typASCII, 0, 0, &mut var),
                Ok(())
            );
            assert_eq!(var.vt, DpkVarType::Empty);
            assert_eq!(var.value, DpkPropVariantValue::Empty);
        }
    }

    #[test]
    fn read_propvar_ascii_uses_binary_data_and_forces_terminator() {
        let mut var = DPKPROPVARIANT::default();

        unsafe {
            assert_eq!(
                read_propvar(std::ptr::null_mut(), WMP_typASCII, 3, 0x004241, &mut var),
                Ok(())
            );
            assert_eq!(var.vt, DpkVarType::LpStr);
            let DpkPropVariantValue::Bytes(data) = &var.value else {
                panic!("missing byte metadata")
            };
            assert_eq!(data, &[b'A', b'B', 0, 0, 0]);
        }
    }

    #[test]
    fn read_propvar_ascii_rejects_unterminated_data() {
        let mut var = DPKPROPVARIANT::default();

        unsafe {
            assert_eq!(
                read_propvar(std::ptr::null_mut(), WMP_typASCII, 3, 0x434241, &mut var),
                Err(crate::WmpError::InvalidParameter)
            );
            assert_eq!(var.vt, DpkVarType::LpStr);
        }
    }

    #[test]
    fn read_propvar_byte_and_undefined_return_byref_bytes() {
        let mut var = DPKPROPVARIANT::default();

        unsafe {
            assert_eq!(
                read_propvar(
                    std::ptr::null_mut(),
                    WMP_typUNDEFINED,
                    4,
                    0x04030201,
                    &mut var
                ),
                Ok(())
            );
            assert_eq!(var.vt, DpkVarType::ByRefUi1);
            let DpkPropVariantValue::Bytes(data) = &var.value else {
                panic!("missing byte metadata")
            };
            assert_eq!(data, &[1, 2, 3, 4, 0, 0]);

            assert_eq!(
                read_propvar(std::ptr::null_mut(), WMP_typBYTE, 1, 0x77, &mut var),
                Ok(())
            );
            assert_eq!(var.vt, DpkVarType::ByRefUi1);
            let DpkPropVariantValue::Bytes(data) = &var.value else {
                panic!("missing byte metadata")
            };
            assert_eq!(data, &[0x77, 0, 0]);
        }
    }

    #[test]
    fn read_propvar_short_scalar_and_pair_match_original_value_rules() {
        let mut var = DPKPROPVARIANT::default();

        unsafe {
            assert_eq!(
                read_propvar(std::ptr::null_mut(), WMP_typSHORT, 1, 0x12345678, &mut var),
                Ok(())
            );
            assert_eq!(var.vt, DpkVarType::Ui2);
            assert_eq!(var.value, DpkPropVariantValue::Ui2(0x5678));

            assert_eq!(
                read_propvar(std::ptr::null_mut(), WMP_typSHORT, 2, 0x12345678, &mut var),
                Ok(())
            );
            assert_eq!(var.vt, DpkVarType::Ui4);
            assert_eq!(var.value, DpkPropVariantValue::Ui4(0x12345678));
        }
    }

    #[test]
    fn buffer_calc_ifd_size_counts_inline_and_out_of_line_data() {
        let mut data = [0_u8; 64];
        let mut size = 0;

        unsafe {
            assert_eq!(set_bf_w(Some(&mut data), 0, 2), Ok(()));
            assert_eq!(set_bf_w(Some(&mut data), 2, 0x0100), Ok(()));
            assert_eq!(set_bf_w(Some(&mut data), 4, WMP_typBYTE), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut data), 6, 5), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut data), 10, 40), Ok(()));
            assert_eq!(set_bf_w(Some(&mut data), 14, 0x0101), Ok(()));
            assert_eq!(set_bf_w(Some(&mut data), 16, WMP_typSHORT), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut data), 18, 2), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut data), 22, 0x2222), Ok(()));

            assert_eq!(
                buffer_calc_ifd_size(Some(&data), 0, WMP_INTEL_ENDIAN, Some(&mut size),),
                Ok(())
            );
            assert_eq!(size, 2 + 2 * SIZEOF_IFD_ENTRY + 4 + 5);
        }
    }

    #[test]
    fn buffer_calc_ifd_size_recurses_nested_ifd_with_alignment() {
        let mut data = [0_u8; 96];
        let mut size = 0;

        unsafe {
            assert_eq!(set_bf_w(Some(&mut data), 0, 2), Ok(()));
            assert_eq!(set_bf_w(Some(&mut data), 2, 0x0100), Ok(()));
            assert_eq!(set_bf_w(Some(&mut data), 4, WMP_typBYTE), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut data), 6, 5), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut data), 10, 48), Ok(()));
            assert_eq!(set_bf_w(Some(&mut data), 14, WMP_tagEXIFMetadata), Ok(()));
            assert_eq!(set_bf_w(Some(&mut data), 16, WMP_typLONG), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut data), 18, 1), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut data), 22, 32), Ok(()));

            assert_eq!(set_bf_w(Some(&mut data), 32, 1), Ok(()));
            assert_eq!(set_bf_w(Some(&mut data), 34, 0x0200), Ok(()));
            assert_eq!(set_bf_w(Some(&mut data), 36, WMP_typBYTE), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut data), 38, 6), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut data), 42, 60), Ok(()));

            assert_eq!(
                buffer_calc_ifd_size(Some(&data), 0, WMP_INTEL_ENDIAN, Some(&mut size),),
                Ok(())
            );
            let outer = 2 + 2 * SIZEOF_IFD_ENTRY + 4 + 5;
            let nested = 2 + SIZEOF_IFD_ENTRY + 4 + 6;
            assert_eq!(size, outer + (outer & 1) + nested);
        }
    }

    #[test]
    fn buffer_calc_ifd_size_rejects_invalid_entry_type() {
        let mut data = [0_u8; 32];
        let mut size = 123;

        unsafe {
            assert_eq!(set_bf_w(Some(&mut data), 0, 1), Ok(()));
            assert_eq!(set_bf_w(Some(&mut data), 2, 0x0100), Ok(()));
            assert_eq!(
                set_bf_w(Some(&mut data), 4, IFD_ENTRY_TYPE_SIZES.len() as u16),
                Ok(())
            );
            assert_eq!(set_bf_dw(Some(&mut data), 6, 1), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut data), 10, 0), Ok(()));

            assert_eq!(
                buffer_calc_ifd_size(Some(&data), 0, WMP_INTEL_ENDIAN, Some(&mut size),),
                Err(crate::WmpError::Fail)
            );
            assert_eq!(size, 0);
        }
    }

    #[test]
    fn stream_calc_ifd_size_matches_buffer_result_and_restores_position() {
        let mut data = [0_u8; 96];
        let mut buffer_size = 0;
        let mut stream_size = 0;
        let mut pos = 0;

        unsafe {
            assert_eq!(set_bf_w(Some(&mut data), 0, 2), Ok(()));
            assert_eq!(set_bf_w(Some(&mut data), 2, 0x0100), Ok(()));
            assert_eq!(set_bf_w(Some(&mut data), 4, WMP_typBYTE), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut data), 6, 5), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut data), 10, 48), Ok(()));
            assert_eq!(set_bf_w(Some(&mut data), 14, WMP_tagEXIFMetadata), Ok(()));
            assert_eq!(set_bf_w(Some(&mut data), 16, WMP_typLONG), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut data), 18, 1), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut data), 22, 32), Ok(()));
            assert_eq!(set_bf_w(Some(&mut data), 32, 1), Ok(()));
            assert_eq!(set_bf_w(Some(&mut data), 34, 0x0200), Ok(()));
            assert_eq!(set_bf_w(Some(&mut data), 36, WMP_typBYTE), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut data), 38, 6), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut data), 42, 60), Ok(()));

            assert_eq!(
                buffer_calc_ifd_size(Some(&data), 0, WMP_INTEL_ENDIAN, Some(&mut buffer_size),),
                Ok(())
            );
            let mut stream = create_ws_memory_owned(Some(&mut data));
            assert_eq!(
                (*stream).SetPos.map(|set_pos| set_pos(&mut *stream, 9)),
                Some(Ok(()))
            );

            assert_eq!(
                stream_calc_ifd_size(&mut *stream, 0, Some(&mut stream_size)),
                Ok(())
            );
            assert_eq!(stream_size, buffer_size);
            assert!(get_pos_ws_memory(&mut *stream, &mut pos).is_ok());
            assert_eq!(pos, 9);
        }
    }

    #[test]
    fn stream_calc_ifd_size_restores_position_and_preserves_invalid_type_error() {
        let mut data = [0_u8; 32];
        let mut size = 123;
        let mut pos = 0;

        unsafe {
            assert_eq!(set_bf_w(Some(&mut data), 0, 1), Ok(()));
            assert_eq!(set_bf_w(Some(&mut data), 2, 0x0100), Ok(()));
            assert_eq!(
                set_bf_w(Some(&mut data), 4, IFD_ENTRY_TYPE_SIZES.len() as u16),
                Ok(())
            );
            assert_eq!(set_bf_dw(Some(&mut data), 6, 1), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut data), 10, 0), Ok(()));
            let mut stream = create_ws_memory_owned(Some(&mut data));
            assert_eq!(
                (*stream).SetPos.map(|set_pos| set_pos(&mut *stream, 5)),
                Some(Ok(()))
            );

            assert_eq!(
                stream_calc_ifd_size(&mut *stream, 0, Some(&mut size)),
                Err(crate::WmpError::UnsupportedFormat)
            );
            assert_eq!(size, 0);
            assert!(get_pos_ws_memory(&mut *stream, &mut pos).is_ok());
            assert_eq!(pos, 5);
        }
    }

    #[test]
    fn stream_calc_ifd_size_returns_restore_error_when_parse_succeeds() {
        let mut data = [0_u8; 32];
        let mut size = 123;

        unsafe {
            assert_eq!(set_bf_w(Some(&mut data), 0, 1), Ok(()));
            assert_eq!(set_bf_w(Some(&mut data), 2, 0x0100), Ok(()));
            assert_eq!(set_bf_w(Some(&mut data), 4, WMP_typBYTE), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut data), 6, 1), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut data), 10, 0), Ok(()));
            let mut stream = create_ws_memory_owned(Some(&mut data));
            assert_eq!(
                (*stream).SetPos.map(|set_pos| set_pos(&mut *stream, 5)),
                Some(Ok(()))
            );
            (*stream).SetPos = Some(set_pos_ws_memory_fails_at_five);

            assert_eq!(
                stream_calc_ifd_size(&mut *stream, 0, Some(&mut size)),
                Err(crate::WmpError::Fail)
            );
            assert_eq!(size, 2 + SIZEOF_IFD_ENTRY + 4);
        }
    }

    #[test]
    fn buffer_copy_ifd_compacts_little_endian_out_of_line_data() {
        let mut src = [0_u8; 64];
        let mut dst = [0_u8; 64];
        let mut ofsdst = 0;

        unsafe {
            assert_eq!(set_bf_w(Some(&mut src), 0, 1), Ok(()));
            assert_eq!(set_bf_w(Some(&mut src), 2, 0x0100), Ok(()));
            assert_eq!(set_bf_w(Some(&mut src), 4, WMP_typBYTE), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut src), 6, 5), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut src), 10, 40), Ok(()));
            src[40..45].copy_from_slice(&[10, 11, 12, 13, 14]);

            assert_eq!(
                buffer_copy_ifd(
                    Some(&src),
                    0,
                    WMP_INTEL_ENDIAN,
                    Some(&mut dst),
                    Some(&mut ofsdst),
                ),
                Ok(())
            );
            assert_eq!(ofsdst, 2 + SIZEOF_IFD_ENTRY + 4 + 5);
            assert_eq!(&dst[0..2], &[1, 0]);
            assert_eq!(&dst[2..4], &[0, 1]);
            assert_eq!(&dst[4..6], &[WMP_typBYTE as u8, 0]);
            assert_eq!(&dst[6..10], &[5, 0, 0, 0]);
            assert_eq!(&dst[10..14], &[18, 0, 0, 0]);
            assert_eq!(&dst[14..18], &[0, 0, 0, 0]);
            assert_eq!(&dst[18..23], &[10, 11, 12, 13, 14]);
        }
    }

    #[test]
    fn buffer_copy_ifd_converts_big_endian_inline_short_values() {
        let mut src = [0_u8; 32];
        let mut dst = [0_u8; 32];
        let mut ofsdst = 0;

        unsafe {
            assert_eq!(set_bf_w_big(Some(&mut src), 0, 1), Ok(()));
            assert_eq!(set_bf_w_big(Some(&mut src), 2, 0x0100), Ok(()));
            assert_eq!(set_bf_w_big(Some(&mut src), 4, WMP_typSHORT), Ok(()));
            assert_eq!(set_bf_dw_big(Some(&mut src), 6, 2), Ok(()));
            src[10..14].copy_from_slice(&[0x11, 0x22, 0x33, 0x44]);

            assert_eq!(
                buffer_copy_ifd(Some(&src), 0, b'M', Some(&mut dst), Some(&mut ofsdst),),
                Ok(())
            );
            assert_eq!(ofsdst, 2 + SIZEOF_IFD_ENTRY + 4);
            assert_eq!(&dst[0..2], &[1, 0]);
            assert_eq!(&dst[2..4], &[0, 1]);
            assert_eq!(&dst[4..6], &[WMP_typSHORT as u8, 0]);
            assert_eq!(&dst[6..10], &[2, 0, 0, 0]);
            assert_eq!(&dst[10..14], &[0x22, 0x11, 0x44, 0x33]);
            assert_eq!(&dst[14..18], &[0, 0, 0, 0]);
        }
    }

    #[test]
    fn buffer_copy_ifd_backpatches_nested_ifd_entry_above_u16_offset() {
        let mut src = [0_u8; 32];
        let mut dst = vec![0_u8; 70_032];
        let mut ofsdst = 70_000;

        unsafe {
            assert_eq!(set_bf_w(Some(&mut src), 0, 1), Ok(()));
            assert_eq!(set_bf_w(Some(&mut src), 2, WMP_tagEXIFMetadata), Ok(()));
            assert_eq!(set_bf_w(Some(&mut src), 4, WMP_typLONG), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut src), 6, 1), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut src), 10, 20), Ok(()));
            assert_eq!(set_bf_w(Some(&mut src), 20, 0), Ok(()));

            assert_eq!(
                buffer_copy_ifd(
                    Some(&src),
                    0,
                    WMP_INTEL_ENDIAN,
                    Some(&mut dst),
                    Some(&mut ofsdst),
                ),
                Ok(())
            );
            assert_eq!(get_le_u32(&dst, 70_010), 70_018);
            assert_eq!(ofsdst, 70_024);
        }
    }

    #[test]
    fn stream_copy_ifd_matches_little_endian_buffer_copy_and_restores_position() {
        let mut src = [0_u8; 96];
        let mut expected = [0_u8; 96];
        let mut dst = [0_u8; 96];
        let mut expected_ofsdst = 0;
        let mut stream_ofsdst = 0;
        let mut pos = 0;

        unsafe {
            assert_eq!(set_bf_w(Some(&mut src), 0, 2), Ok(()));
            assert_eq!(set_bf_w(Some(&mut src), 2, 0x0100), Ok(()));
            assert_eq!(set_bf_w(Some(&mut src), 4, WMP_typBYTE), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut src), 6, 5), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut src), 10, 48), Ok(()));
            assert_eq!(set_bf_w(Some(&mut src), 14, WMP_tagEXIFMetadata), Ok(()));
            assert_eq!(set_bf_w(Some(&mut src), 16, WMP_typLONG), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut src), 18, 1), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut src), 22, 32), Ok(()));
            assert_eq!(set_bf_w(Some(&mut src), 32, 1), Ok(()));
            assert_eq!(set_bf_w(Some(&mut src), 34, 0x0200), Ok(()));
            assert_eq!(set_bf_w(Some(&mut src), 36, WMP_typBYTE), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut src), 38, 6), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut src), 42, 60), Ok(()));
            src[48..53].copy_from_slice(&[10, 11, 12, 13, 14]);
            src[60..66].copy_from_slice(&[20, 21, 22, 23, 24, 25]);

            assert_eq!(
                buffer_copy_ifd(
                    Some(&src),
                    0,
                    WMP_INTEL_ENDIAN,
                    Some(&mut expected),
                    Some(&mut expected_ofsdst),
                ),
                Ok(())
            );

            let mut stream = create_ws_memory_owned(Some(&mut src));
            assert_eq!(
                (*stream).SetPos.map(|set_pos| set_pos(&mut *stream, 9)),
                Some(Ok(()))
            );
            assert_eq!(
                stream_copy_ifd(&mut *stream, 0, Some(&mut dst), Some(&mut stream_ofsdst),),
                Ok(())
            );
            assert_eq!(stream_ofsdst, expected_ofsdst);
            assert_eq!(
                &dst[..stream_ofsdst as usize],
                &expected[..expected_ofsdst as usize]
            );
            assert!(get_pos_ws_memory(&mut *stream, &mut pos).is_ok());
            assert_eq!(pos, 9);
        }
    }

    #[test]
    fn stream_copy_ifd_backpatches_nested_ifd_entry_above_u16_offset() {
        let mut src = [0_u8; 32];
        let mut dst = vec![0_u8; 70_032];
        let mut ofsdst = 70_000;
        let mut pos = 0;

        unsafe {
            assert_eq!(set_bf_w(Some(&mut src), 0, 1), Ok(()));
            assert_eq!(set_bf_w(Some(&mut src), 2, WMP_tagEXIFMetadata), Ok(()));
            assert_eq!(set_bf_w(Some(&mut src), 4, WMP_typLONG), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut src), 6, 1), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut src), 10, 20), Ok(()));
            assert_eq!(set_bf_w(Some(&mut src), 20, 0), Ok(()));

            let mut stream = create_ws_memory_owned(Some(&mut src));
            assert_eq!(
                (*stream).SetPos.map(|set_pos| set_pos(&mut *stream, 7)),
                Some(Ok(()))
            );
            assert_eq!(
                stream_copy_ifd(&mut *stream, 0, Some(&mut dst), Some(&mut ofsdst),),
                Ok(())
            );
            assert_eq!(get_le_u32(&dst, 70_010), 70_018);
            assert_eq!(ofsdst, 70_024);
            assert!(get_pos_ws_memory(&mut *stream, &mut pos).is_ok());
            assert_eq!(pos, 7);
        }
    }

    #[test]
    fn stream_copy_ifd_restores_position_and_preserves_invalid_type_error() {
        let mut src = [0_u8; 32];
        let mut dst = [0_u8; 32];
        let mut ofsdst = 0;
        let mut pos = 0;

        unsafe {
            assert_eq!(set_bf_w(Some(&mut src), 0, 1), Ok(()));
            assert_eq!(set_bf_w(Some(&mut src), 2, 0x0100), Ok(()));
            assert_eq!(
                set_bf_w(Some(&mut src), 4, IFD_ENTRY_TYPE_SIZES.len() as u16),
                Ok(())
            );
            assert_eq!(set_bf_dw(Some(&mut src), 6, 1), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut src), 10, 0), Ok(()));

            let mut stream = create_ws_memory_owned(Some(&mut src));
            assert_eq!(
                (*stream).SetPos.map(|set_pos| set_pos(&mut *stream, 5)),
                Some(Ok(()))
            );

            assert_eq!(
                stream_copy_ifd(&mut *stream, 0, Some(&mut dst), Some(&mut ofsdst),),
                Err(crate::WmpError::Fail)
            );
            assert_eq!(ofsdst, 0);
            assert!(get_pos_ws_memory(&mut *stream, &mut pos).is_ok());
            assert_eq!(pos, 5);
        }
    }

    #[test]
    fn stream_copy_ifd_returns_restore_error_when_copy_succeeds() {
        let mut src = [0_u8; 32];
        let mut dst = [0_u8; 32];
        let mut ofsdst = 0;

        unsafe {
            assert_eq!(set_bf_w(Some(&mut src), 0, 1), Ok(()));
            assert_eq!(set_bf_w(Some(&mut src), 2, 0x0100), Ok(()));
            assert_eq!(set_bf_w(Some(&mut src), 4, WMP_typBYTE), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut src), 6, 1), Ok(()));
            assert_eq!(set_bf_dw(Some(&mut src), 10, 0x44), Ok(()));

            let mut stream = create_ws_memory_owned(Some(&mut src));
            assert_eq!(
                (*stream).SetPos.map(|set_pos| set_pos(&mut *stream, 5)),
                Some(Ok(()))
            );
            (*stream).SetPos = Some(set_pos_ws_memory_fails_at_five);

            assert_eq!(
                stream_copy_ifd(&mut *stream, 0, Some(&mut dst), Some(&mut ofsdst),),
                Err(crate::WmpError::Fail)
            );
            assert_eq!(ofsdst, 2 + SIZEOF_IFD_ENTRY + 4);
        }
    }
}
