// Auto-generated scaffold for a faithful JXRLib translation restart.
// Keep one Rust item per original C item; replace stubs bottom-up.

use crate::image::decode::jxrtranscode::wm_photo_transcode;
use crate::image::decode::strdec::{
    image_str_dec_decode, image_str_dec_get_info, image_str_dec_init, image_str_dec_term,
};
use crate::image::encode::strenc::{image_str_enc_encode, image_str_enc_init, image_str_enc_term};
use crate::image::sys::strcodec::CWMImageStrCodec;
use crate::image::sys::windowsmediaphoto::{
    tagCWMImageBufferInfo, tagCWMTranscodingParam, AlphaMode, BitDepthLayout, Orientation,
    WMPStream,
};
use crate::jxrgluelib::jxrglue::{
    pixel_format_lookup, pk_image_decode_create_owned, pk_image_decode_initialize,
    pk_image_encode_create_owned, tagPKImageDecode, tagPKImageEncode, tagPKPixelInfo, tagPKRect,
    BandedEncodeState, BitDepth, ColorFormat, PKPixelFormatGUID, PixelFormatFlags, LOOKUP_FORWARD,
};
use crate::jxrgluelib::jxrmeta::{
    buffer_copy_ifd, get_u_long, get_u_short, put_u_long, put_u_short, read_propvar,
    stream_calc_ifd_size, tagWmpDE, write_wmp_de, DpkPropVariantValue, DpkVarType,
    WMP_tagAlphaByteCount, WMP_tagAlphaDataDiscard, WMP_tagAlphaOffset, WMP_tagArtist,
    WMP_tagCameraMake, WMP_tagCameraModel, WMP_tagCaption, WMP_tagCompression, WMP_tagCopyright,
    WMP_tagDateTime, WMP_tagDocumentName, WMP_tagEXIFMetadata, WMP_tagGPSInfoMetadata,
    WMP_tagHeightResolution, WMP_tagHostComputer, WMP_tagIPTCNAAMetadata, WMP_tagIccProfile,
    WMP_tagImageByteCount, WMP_tagImageDataDiscard, WMP_tagImageDescription, WMP_tagImageHeight,
    WMP_tagImageOffset, WMP_tagImageType, WMP_tagImageWidth, WMP_tagPageName, WMP_tagPageNumber,
    WMP_tagPhotoshopMetadata, WMP_tagPixelFormat, WMP_tagRatingStars, WMP_tagRatingValue,
    WMP_tagSoftware, WMP_tagTransformation, WMP_tagWidthResolution, WMP_tagXMPMetadata,
    WMP_typASCII, WMP_typBYTE, WMP_typFLOAT, WMP_typLONG, WMP_typSHORT, WMP_typUNDEFINED,
    WMP_valWMPhotoID, DESCRIPTIVEMETADATA, DPKPROPVARIANT, SIZEOF_IFD_ENTRY, WMP_INTEL_ENDIAN,
};
use std::ptr::NonNull;
pub const TEMPFILE_COPYBUF_SIZE: usize = 8192;

/// Original union: `uf` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:1544`.
#[derive(Debug, Clone, Default)]
pub struct uf {
    pub uVal: u32,
    pub fVal: f32,
}

/// Original function: `CalcMetadataSizeLPSTR` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:39`.
pub unsafe fn calc_metadata_size_lpstr(
    var: &DPKPROPVARIANT,
    inactive_metadata: &mut u16,
    offset_size: &mut u32,
    count: Option<&mut u32>,
) {
    if DpkVarType::Empty != var.vt {
        let DpkPropVariantValue::Bytes(data) = &var.value else {
            return;
        };
        let Some(first_null) = data.iter().position(|&byte| byte == 0) else {
            return;
        };
        let uiLenWithNull = (first_null + 1) as u32;
        debug_assert_eq!(DpkVarType::LpStr, var.vt);

        if uiLenWithNull > 4 {
            *offset_size = (*offset_size).wrapping_add(uiLenWithNull);
        }

        if let Some(count) = count {
            *count = uiLenWithNull;
        }
    } else {
        *inactive_metadata = (*inactive_metadata).wrapping_add(1);
    }
}

/// Original function: `CalcMetadataSizeLPWSTR` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:60`.
pub unsafe fn calc_metadata_size_lpwstr(
    var: &DPKPROPVARIANT,
    inactive_metadata: &mut u16,
    offset_size: &mut u32,
    count: Option<&mut u32>,
) {
    if DpkVarType::Empty != var.vt {
        let DpkPropVariantValue::Wide(data) = &var.value else {
            return;
        };
        let Some(first_null) = data.iter().position(|&unit| unit == 0) else {
            return;
        };
        let cch = first_null as u32;
        let uiCBWithNull = std::mem::size_of::<u16>() as u32 * cch.wrapping_add(1);
        debug_assert_eq!(DpkVarType::LpWStr, var.vt);

        if uiCBWithNull > 4 {
            *offset_size = (*offset_size).wrapping_add(uiCBWithNull);
        }

        if let Some(count) = count {
            *count = uiCBWithNull;
        }
    } else {
        *inactive_metadata = (*inactive_metadata).wrapping_add(1);
    }
}

/// Original function: `CalcMetadataSizeUI2` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:81`.
pub unsafe fn calc_metadata_size_ui2(
    var: &DPKPROPVARIANT,
    inactive_metadata: &mut u16,
    _metadata_size: &mut u32,
) {
    if DpkVarType::Empty != var.vt {
        debug_assert_eq!(DpkVarType::Ui2, var.vt);
    } else {
        *inactive_metadata = (*inactive_metadata).wrapping_add(1);
    }
}

/// Original function: `CalcMetadataSizeUI4` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:95`.
pub unsafe fn calc_metadata_size_ui4(
    var: &DPKPROPVARIANT,
    inactive_metadata: &mut u16,
    _container_size: &mut u32,
) {
    if DpkVarType::Empty != var.vt {
        debug_assert_eq!(DpkVarType::Ui4, var.vt);
    } else {
        *inactive_metadata = (*inactive_metadata).wrapping_add(1);
    }
}

/// Original function: `CalcMetadataOffsetSize` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:109`.
pub unsafe fn calc_metadata_offset_size(
    p_ie: *mut tagPKImageEncode,
    inactive_metadata: &mut u16,
    metadata_size: &mut u32,
) -> Result<(), crate::WmpError> {
    let err = Ok(());

    calc_metadata_size_lpstr(
        &(*p_ie).sDescMetadata.pvarImageDescription,
        inactive_metadata,
        metadata_size,
        None,
    );
    calc_metadata_size_lpstr(
        &(*p_ie).sDescMetadata.pvarCameraMake,
        inactive_metadata,
        metadata_size,
        None,
    );
    calc_metadata_size_lpstr(
        &(*p_ie).sDescMetadata.pvarCameraModel,
        inactive_metadata,
        metadata_size,
        None,
    );
    calc_metadata_size_lpstr(
        &(*p_ie).sDescMetadata.pvarSoftware,
        inactive_metadata,
        metadata_size,
        None,
    );
    calc_metadata_size_lpstr(
        &(*p_ie).sDescMetadata.pvarDateTime,
        inactive_metadata,
        metadata_size,
        None,
    );
    calc_metadata_size_lpstr(
        &(*p_ie).sDescMetadata.pvarArtist,
        inactive_metadata,
        metadata_size,
        None,
    );
    calc_metadata_size_lpstr(
        &(*p_ie).sDescMetadata.pvarCopyright,
        inactive_metadata,
        metadata_size,
        None,
    );
    calc_metadata_size_ui2(
        &(*p_ie).sDescMetadata.pvarRatingStars,
        inactive_metadata,
        metadata_size,
    );
    calc_metadata_size_ui2(
        &(*p_ie).sDescMetadata.pvarRatingValue,
        inactive_metadata,
        metadata_size,
    );
    calc_metadata_size_lpwstr(
        &(*p_ie).sDescMetadata.pvarCaption,
        inactive_metadata,
        metadata_size,
        None,
    );
    calc_metadata_size_lpstr(
        &(*p_ie).sDescMetadata.pvarDocumentName,
        inactive_metadata,
        metadata_size,
        None,
    );
    calc_metadata_size_lpstr(
        &(*p_ie).sDescMetadata.pvarPageName,
        inactive_metadata,
        metadata_size,
        None,
    );
    calc_metadata_size_ui4(
        &(*p_ie).sDescMetadata.pvarPageNumber,
        inactive_metadata,
        metadata_size,
    );
    calc_metadata_size_lpstr(
        &(*p_ie).sDescMetadata.pvarHostComputer,
        inactive_metadata,
        metadata_size,
        None,
    );

    err
}

/// Original function: `CopyDescMetadata` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:134`.
pub unsafe fn copy_desc_metadata(
    dst_var: &mut DPKPROPVARIANT,
    varSrc: &DPKPROPVARIANT,
) -> Result<(), crate::WmpError> {
    dst_var.vt = varSrc.vt;
    match varSrc.vt {
        DpkVarType::LpStr => {
            let DpkPropVariantValue::Bytes(src) = &varSrc.value else {
                return Err(crate::WmpError::InvalidParameter);
            };
            if !src.iter().any(|&byte| byte == 0) {
                return Err(crate::WmpError::InvalidParameter);
            }
            let mut dst = Vec::new();
            if dst.try_reserve_exact(src.len()).is_err() {
                return Err(crate::WmpError::OutOfMemory);
            }
            dst.extend_from_slice(src);
            dst_var.vt = DpkVarType::LpStr;
            dst_var.value = DpkPropVariantValue::Bytes(dst);
        }
        DpkVarType::LpWStr => {
            let DpkPropVariantValue::Wide(src) = &varSrc.value else {
                return Err(crate::WmpError::InvalidParameter);
            };
            if !src.iter().any(|&unit| unit == 0) {
                return Err(crate::WmpError::InvalidParameter);
            }
            let mut dst = Vec::new();
            if dst.try_reserve_exact(src.len()).is_err() {
                return Err(crate::WmpError::OutOfMemory);
            }
            dst.extend_from_slice(src);
            dst_var.vt = DpkVarType::LpWStr;
            dst_var.value = DpkPropVariantValue::Wide(dst);
        }
        DpkVarType::Ui2 => {
            let DpkPropVariantValue::Ui2(value) = &varSrc.value else {
                return Err(crate::WmpError::InvalidParameter);
            };
            dst_var.value = DpkPropVariantValue::Ui2(*value);
        }
        DpkVarType::Ui4 => {
            let DpkPropVariantValue::Ui4(value) = &varSrc.value else {
                return Err(crate::WmpError::InvalidParameter);
            };
            dst_var.value = DpkPropVariantValue::Ui4(*value);
        }
        DpkVarType::Empty => {
            *dst_var = DPKPROPVARIANT::default();
            debug_assert_eq!(DpkVarType::Empty, dst_var.vt);
        }
        _ => {
            debug_assert!(false);
            return Err(crate::WmpError::NotYetImplemented);
        }
    }

    Ok(())
}

/// Original function: `WriteDescMetadata` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:206`.
pub unsafe fn write_desc_metadata(
    image_encode: &mut tagPKImageEncode,
    var: &DPKPROPVARIANT,
    wmp_de: &mut tagWmpDE,
    curr_desc_metadata_offset: &mut u32,
    off_pos: &mut usize,
) -> Result<(), crate::WmpError> {
    let Some(p_ws) = image_encode.pStream else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let p_ws = &mut *p_ws.as_ptr();
    let p_de_misc = &mut image_encode.WMP.wmiDEMisc;
    let mut ui_metadata_offset_size = 0;
    let mut ui_count = 0;
    let mut ui_data_written_to_offset = 0;
    let mut ui_temp = 0;

    if p_de_misc.uDescMetadataOffset == 0 || p_de_misc.uDescMetadataByteCount == 0 {
        return Ok(());
    }

    if *curr_desc_metadata_offset > p_de_misc.uDescMetadataByteCount {
        return Err(crate::WmpError::BufferOverflow);
    }

    match var.vt {
        DpkVarType::Empty => {}
        DpkVarType::LpStr => {
            let DpkPropVariantValue::Bytes(data) = &var.value else {
                return Err(crate::WmpError::InvalidParameter);
            };
            if !data.iter().any(|&byte| byte == 0) {
                return Err(crate::WmpError::InvalidParameter);
            }
            calc_metadata_size_lpstr(
                var,
                &mut ui_temp,
                &mut ui_metadata_offset_size,
                Some(&mut ui_count),
            );
            wmp_de.uCount = ui_count;
            let Some(value_or_offset) = p_de_misc
                .uDescMetadataOffset
                .checked_add(*curr_desc_metadata_offset)
            else {
                return Err(crate::WmpError::BufferOverflow);
            };
            wmp_de.uValueOrOffset = value_or_offset;
            let err = write_wmp_de(
                p_ws,
                off_pos,
                wmp_de,
                Some(data.as_slice()),
                Some(&mut ui_data_written_to_offset),
            );
            if err.is_err() {
                return err;
            }
        }
        DpkVarType::LpWStr => {
            let DpkPropVariantValue::Wide(data) = &var.value else {
                return Err(crate::WmpError::InvalidParameter);
            };
            if !data.iter().any(|&unit| unit == 0) {
                return Err(crate::WmpError::InvalidParameter);
            }
            calc_metadata_size_lpwstr(
                var,
                &mut ui_temp,
                &mut ui_metadata_offset_size,
                Some(&mut ui_count),
            );
            wmp_de.uCount = ui_count;
            let Some(value_or_offset) = p_de_misc
                .uDescMetadataOffset
                .checked_add(*curr_desc_metadata_offset)
            else {
                return Err(crate::WmpError::BufferOverflow);
            };
            wmp_de.uValueOrOffset = value_or_offset;
            let Some(byte_count) = data.len().checked_mul(std::mem::size_of::<u16>()) else {
                return Err(crate::WmpError::BufferOverflow);
            };
            let data_bytes = std::slice::from_raw_parts(data.as_ptr().cast::<u8>(), byte_count);
            let err = write_wmp_de(
                p_ws,
                off_pos,
                wmp_de,
                Some(data_bytes),
                Some(&mut ui_data_written_to_offset),
            );
            if err.is_err() {
                return err;
            }
        }
        DpkVarType::Ui2 => {
            calc_metadata_size_ui2(var, &mut ui_temp, &mut ui_metadata_offset_size);
            wmp_de.uCount = 1;
            let DpkPropVariantValue::Ui2(value) = &var.value else {
                return Err(crate::WmpError::InvalidParameter);
            };
            wmp_de.uValueOrOffset = *value as u32;
            let err = write_wmp_de(p_ws, off_pos, wmp_de, None, None);
            if err.is_err() {
                return err;
            }
        }
        DpkVarType::Ui4 => {
            calc_metadata_size_ui4(var, &mut ui_temp, &mut ui_metadata_offset_size);
            wmp_de.uCount = 1;
            let DpkPropVariantValue::Ui4(value) = &var.value else {
                return Err(crate::WmpError::InvalidParameter);
            };
            wmp_de.uValueOrOffset = *value;
            let err = write_wmp_de(p_ws, off_pos, wmp_de, None, None);
            if err.is_err() {
                return err;
            }
        }
        _ => {
            debug_assert!(false);
            return Err(crate::WmpError::NotYetImplemented);
        }
    }

    let Some(next_offset) = curr_desc_metadata_offset.checked_add(ui_data_written_to_offset) else {
        return Err(crate::WmpError::BufferOverflow);
    };
    if next_offset > p_de_misc.uDescMetadataByteCount {
        return Err(crate::WmpError::BufferOverflow);
    }
    *curr_desc_metadata_offset = next_offset;

    Ok(())
}

fn checked_advance_metadata_offset(
    image_offset: &mut u32,
    byte_count: u32,
) -> Result<u32, crate::WmpError> {
    let offset = *image_offset;
    *image_offset = image_offset
        .checked_add(byte_count)
        .ok_or(crate::WmpError::BufferOverflow)?;
    Ok(offset)
}

fn checked_align_metadata_offset(image_offset: &mut u32) -> Result<(), crate::WmpError> {
    *image_offset = image_offset
        .checked_add(*image_offset & 1)
        .ok_or(crate::WmpError::BufferOverflow)?;
    Ok(())
}

/// Original function: `WriteContainerPre` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:279`.
pub unsafe fn write_container_pre(pIE: *mut tagPKImageEncode) -> Result<(), crate::WmpError> {
    // C initializes `ERR err = WMP_errSuccess`, but that value is always overwritten before
    // it is read (first assignment below), so declare without the dead initializer.
    let mut err: Result<(), crate::WmpError>;
    const OFFSET_OF_PFD: u32 = 0x20;
    let Some(pWS) = (*pIE).pStream.map(NonNull::as_ptr) else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(get_pos) = (*pWS).GetPos else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(set_pos) = (*pWS).SetPos else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(write) = (*pWS).Write else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let pDEMisc = std::ptr::addr_of_mut!((*pIE).WMP.wmiDEMisc);
    let mut pi = tagPKPixelInfo::default();
    let mut offPos = 0usize;
    let iimm = [0x49_u8, 0x49_u8];
    let mut cbMetadataOffsetSize = 0_u32;
    let mut cInactiveMetadata = 0_u16;
    let mut uiCurrDescMetadataOffset = 0_u32;
    let wmpDEs = [
        tagWmpDE {
            uTag: WMP_tagDocumentName,
            uType: WMP_typASCII,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagImageDescription,
            uType: WMP_typASCII,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagCameraMake,
            uType: WMP_typASCII,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagCameraModel,
            uType: WMP_typASCII,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagPageName,
            uType: WMP_typASCII,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagPageNumber,
            uType: WMP_typLONG,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagSoftware,
            uType: WMP_typASCII,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagDateTime,
            uType: WMP_typASCII,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagArtist,
            uType: WMP_typASCII,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagHostComputer,
            uType: WMP_typASCII,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagRatingStars,
            uType: WMP_typSHORT,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagRatingValue,
            uType: WMP_typSHORT,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagCopyright,
            uType: WMP_typASCII,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagCaption,
            uType: WMP_typBYTE,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagXMPMetadata,
            uType: WMP_typBYTE,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagIPTCNAAMetadata,
            uType: WMP_typBYTE,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagPhotoshopMetadata,
            uType: WMP_typBYTE,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagEXIFMetadata,
            uType: WMP_typLONG,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagIccProfile,
            uType: WMP_typUNDEFINED,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagGPSInfoMetadata,
            uType: WMP_typLONG,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagPixelFormat,
            uType: WMP_typBYTE,
            uCount: 16,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagTransformation,
            uType: WMP_typLONG,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagImageWidth,
            uType: WMP_typLONG,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagImageHeight,
            uType: WMP_typLONG,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagWidthResolution,
            uType: WMP_typFLOAT,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagHeightResolution,
            uType: WMP_typFLOAT,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagImageOffset,
            uType: WMP_typLONG,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagImageByteCount,
            uType: WMP_typLONG,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagAlphaOffset,
            uType: WMP_typLONG,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
        tagWmpDE {
            uTag: WMP_tagAlphaByteCount,
            uType: WMP_typLONG,
            uCount: 1,
            uValueOrOffset: u32::MAX,
        },
    ];
    let mut cWmpDEs = wmpDEs.len() as u16;
    let mut i = 0usize;
    let zero_len = (SIZEOF_IFD_ENTRY as usize) * wmpDEs.len() + std::mem::size_of::<u32>();
    let zero = vec![0_u8; zero_len];
    debug_assert!(zero_len > 0x20);

    'cleanup: loop {
        err = get_pos(&mut *pWS, &mut offPos);
        if err.is_err() {
            break 'cleanup;
        }
        if offPos != 0 {
            err = Err(crate::WmpError::UnsupportedFormat);
            break 'cleanup;
        }

        err = write(&mut *pWS, &iimm);
        if err.is_err() {
            break 'cleanup;
        }
        offPos += 2;
        err = put_u_short(&mut *pWS, offPos, 0x01bc);
        if err.is_err() {
            break 'cleanup;
        }
        offPos += 2;
        err = put_u_long(&mut *pWS, offPos, OFFSET_OF_PFD);
        if err.is_err() {
            break 'cleanup;
        }
        offPos += 4;

        (*pDEMisc).uOffPixelFormat = offPos as u32;
        pi.pGUIDPixFmt = Some((*pIE).guidPixFormat);
        err = pixel_format_lookup(&mut pi, LOOKUP_FORWARD);
        if err.is_err() {
            break 'cleanup;
        }

        let guid = &(*pIE).guidPixFormat;
        err = put_u_long(&mut *pWS, offPos, guid.data1);
        if err.is_err() {
            break 'cleanup;
        }
        err = put_u_short(&mut *pWS, offPos + 4, guid.data2);
        if err.is_err() {
            break 'cleanup;
        }
        err = put_u_short(&mut *pWS, offPos + 6, guid.data3);
        if err.is_err() {
            break 'cleanup;
        }
        err = write(&mut *pWS, &guid.data4);
        if err.is_err() {
            break 'cleanup;
        }
        offPos += 16;

        err = calc_metadata_offset_size(pIE, &mut cInactiveMetadata, &mut cbMetadataOffsetSize);
        if err.is_err() {
            break 'cleanup;
        }
        cWmpDEs = cWmpDEs.wrapping_sub(cInactiveMetadata);

        debug_assert!(offPos <= OFFSET_OF_PFD as usize);
        if offPos < OFFSET_OF_PFD as usize {
            err = write(&mut *pWS, &zero[..OFFSET_OF_PFD as usize - offPos]);
            if err.is_err() {
                break 'cleanup;
            }
        }
        offPos = OFFSET_OF_PFD as usize;

        if !(*pIE).WMP.bHasAlpha
            || AlphaMode::from_u8((*pIE).WMP.wmiSCP.uAlphaMode) != Some(AlphaMode::Planar)
        {
            cWmpDEs = cWmpDEs.wrapping_sub(2);
        }
        if (*pIE).cbXMPMetadataByteCount == 0 {
            cWmpDEs = cWmpDEs.wrapping_sub(1);
        }
        if (*pIE).cbIPTCNAAMetadataByteCount == 0 {
            cWmpDEs = cWmpDEs.wrapping_sub(1);
        }
        if (*pIE).cbPhotoshopMetadataByteCount == 0 {
            cWmpDEs = cWmpDEs.wrapping_sub(1);
        }
        if (*pIE).cbEXIFMetadataByteCount == 0 {
            cWmpDEs = cWmpDEs.wrapping_sub(1);
        }
        if (*pIE).cbColorContext == 0 {
            cWmpDEs = cWmpDEs.wrapping_sub(1);
        }
        if (*pIE).cbGPSInfoMetadataByteCount == 0 {
            cWmpDEs = cWmpDEs.wrapping_sub(1);
        }

        let Some(image_offset) = u32::try_from(offPos)
            .ok()
            .and_then(|ofs| ofs.checked_add(std::mem::size_of::<u16>() as u32))
            .and_then(|ofs| {
                SIZEOF_IFD_ENTRY
                    .checked_mul(cWmpDEs as u32)
                    .and_then(|dir_bytes| ofs.checked_add(dir_bytes))
            })
            .and_then(|ofs| ofs.checked_add(std::mem::size_of::<u32>() as u32))
        else {
            err = Err(crate::WmpError::BufferOverflow);
            break 'cleanup;
        };
        (*pDEMisc).uImageOffset = image_offset;

        if cbMetadataOffsetSize > 0 {
            (*pDEMisc).uDescMetadataByteCount = cbMetadataOffsetSize;
            match checked_advance_metadata_offset(
                &mut (*pDEMisc).uImageOffset,
                cbMetadataOffsetSize,
            ) {
                Ok(offset) => (*pDEMisc).uDescMetadataOffset = offset,
                Err(e) => {
                    err = Err(e);
                    break 'cleanup;
                }
            }
        }
        if (*pIE).cbXMPMetadataByteCount > 0 {
            match checked_advance_metadata_offset(
                &mut (*pDEMisc).uImageOffset,
                (*pIE).cbXMPMetadataByteCount,
            ) {
                Ok(offset) => (*pDEMisc).uXMPMetadataOffset = offset,
                Err(e) => {
                    err = Err(e);
                    break 'cleanup;
                }
            }
        }
        if (*pIE).cbIPTCNAAMetadataByteCount > 0 {
            match checked_advance_metadata_offset(
                &mut (*pDEMisc).uImageOffset,
                (*pIE).cbIPTCNAAMetadataByteCount,
            ) {
                Ok(offset) => (*pDEMisc).uIPTCNAAMetadataOffset = offset,
                Err(e) => {
                    err = Err(e);
                    break 'cleanup;
                }
            }
        }
        if (*pIE).cbPhotoshopMetadataByteCount > 0 {
            match checked_advance_metadata_offset(
                &mut (*pDEMisc).uImageOffset,
                (*pIE).cbPhotoshopMetadataByteCount,
            ) {
                Ok(offset) => (*pDEMisc).uPhotoshopMetadataOffset = offset,
                Err(e) => {
                    err = Err(e);
                    break 'cleanup;
                }
            }
        }
        if (*pIE).cbEXIFMetadataByteCount > 0 {
            (*pDEMisc).uEXIFMetadataOffset = (*pDEMisc).uImageOffset;
            if let Err(e) = checked_align_metadata_offset(&mut (*pDEMisc).uImageOffset) {
                err = Err(e);
                break 'cleanup;
            }
            if let Err(e) = checked_advance_metadata_offset(
                &mut (*pDEMisc).uImageOffset,
                (*pIE).cbEXIFMetadataByteCount,
            ) {
                err = Err(e);
                break 'cleanup;
            }
        }
        if (*pIE).cbColorContext > 0 {
            match checked_advance_metadata_offset(
                &mut (*pDEMisc).uImageOffset,
                (*pIE).cbColorContext,
            ) {
                Ok(offset) => (*pDEMisc).uColorProfileOffset = offset,
                Err(e) => {
                    err = Err(e);
                    break 'cleanup;
                }
            }
        }
        if (*pIE).cbGPSInfoMetadataByteCount > 0 {
            (*pDEMisc).uGPSInfoMetadataOffset = (*pDEMisc).uImageOffset;
            if let Err(e) = checked_align_metadata_offset(&mut (*pDEMisc).uImageOffset) {
                err = Err(e);
                break 'cleanup;
            }
            if let Err(e) = checked_advance_metadata_offset(
                &mut (*pDEMisc).uImageOffset,
                (*pIE).cbGPSInfoMetadataByteCount,
            ) {
                err = Err(e);
                break 'cleanup;
            }
        }

        err = put_u_short(&mut *pWS, offPos, cWmpDEs);
        if err.is_err() {
            break 'cleanup;
        }
        offPos += 2;
        let zero_fill_len =
            SIZEOF_IFD_ENTRY as usize * cWmpDEs as usize + std::mem::size_of::<u32>();
        err = write(&mut *pWS, &zero[..zero_fill_len]);
        if err.is_err() {
            break 'cleanup;
        }

        let desc = [
            &(*pIE).sDescMetadata.pvarDocumentName,
            &(*pIE).sDescMetadata.pvarImageDescription,
            &(*pIE).sDescMetadata.pvarCameraMake,
            &(*pIE).sDescMetadata.pvarCameraModel,
            &(*pIE).sDescMetadata.pvarPageName,
            &(*pIE).sDescMetadata.pvarPageNumber,
            &(*pIE).sDescMetadata.pvarSoftware,
            &(*pIE).sDescMetadata.pvarDateTime,
            &(*pIE).sDescMetadata.pvarArtist,
            &(*pIE).sDescMetadata.pvarHostComputer,
            &(*pIE).sDescMetadata.pvarRatingStars,
            &(*pIE).sDescMetadata.pvarRatingValue,
            &(*pIE).sDescMetadata.pvarCopyright,
            &(*pIE).sDescMetadata.pvarCaption,
        ];
        let desc_tags = [
            WMP_tagDocumentName,
            WMP_tagImageDescription,
            WMP_tagCameraMake,
            WMP_tagCameraModel,
            WMP_tagPageName,
            WMP_tagPageNumber,
            WMP_tagSoftware,
            WMP_tagDateTime,
            WMP_tagArtist,
            WMP_tagHostComputer,
            WMP_tagRatingStars,
            WMP_tagRatingValue,
            WMP_tagCopyright,
            WMP_tagCaption,
        ];
        for (desc_var, desc_tag) in desc.into_iter().zip(desc_tags) {
            let mut wmpDE = wmpDEs[i].clone();
            i += 1;
            debug_assert_eq!(desc_tag, wmpDE.uTag);
            err = write_desc_metadata(
                &mut *pIE,
                desc_var,
                &mut wmpDE,
                &mut uiCurrDescMetadataOffset,
                &mut offPos,
            );
            if err.is_err() {
                break 'cleanup;
            }
        }

        let mut wmpDE = wmpDEs[i].clone();
        i += 1;
        debug_assert_eq!(WMP_tagXMPMetadata, wmpDE.uTag);
        if (*pIE).cbXMPMetadataByteCount > 0 {
            let Some(metadata) = (*pIE).xmpMetadataMemory.as_ref() else {
                err = Err(crate::WmpError::InvalidParameter);
                break 'cleanup;
            };
            let mut uiTemp = 0_u32;
            wmpDE.uCount = (*pIE).cbXMPMetadataByteCount;
            wmpDE.uValueOrOffset = (*pDEMisc).uXMPMetadataOffset;
            err = write_wmp_de(
                &mut *pWS,
                &mut offPos,
                &wmpDE,
                Some(metadata.as_ref()),
                Some(&mut uiTemp),
            );
            if err.is_err() {
                break 'cleanup;
            }
        }

        wmpDE = wmpDEs[i].clone();
        i += 1;
        debug_assert_eq!(WMP_tagIPTCNAAMetadata, wmpDE.uTag);
        if (*pIE).cbIPTCNAAMetadataByteCount > 0 {
            let Some(metadata) = (*pIE).iptcNAAMetadataMemory.as_ref() else {
                err = Err(crate::WmpError::InvalidParameter);
                break 'cleanup;
            };
            let mut uiTemp = 0_u32;
            wmpDE.uCount = (*pIE).cbIPTCNAAMetadataByteCount;
            wmpDE.uValueOrOffset = (*pDEMisc).uIPTCNAAMetadataOffset;
            err = write_wmp_de(
                &mut *pWS,
                &mut offPos,
                &wmpDE,
                Some(metadata.as_ref()),
                Some(&mut uiTemp),
            );
            if err.is_err() {
                break 'cleanup;
            }
        }

        wmpDE = wmpDEs[i].clone();
        i += 1;
        debug_assert_eq!(WMP_tagPhotoshopMetadata, wmpDE.uTag);
        if (*pIE).cbPhotoshopMetadataByteCount > 0 {
            let Some(metadata) = (*pIE).photoshopMetadataMemory.as_ref() else {
                err = Err(crate::WmpError::InvalidParameter);
                break 'cleanup;
            };
            let mut uiTemp = 0_u32;
            wmpDE.uCount = (*pIE).cbPhotoshopMetadataByteCount;
            wmpDE.uValueOrOffset = (*pDEMisc).uPhotoshopMetadataOffset;
            err = write_wmp_de(
                &mut *pWS,
                &mut offPos,
                &wmpDE,
                Some(metadata.as_ref()),
                Some(&mut uiTemp),
            );
            if err.is_err() {
                break 'cleanup;
            }
        }

        wmpDE = wmpDEs[i].clone();
        i += 1;
        debug_assert_eq!(WMP_tagEXIFMetadata, wmpDE.uTag);
        if (*pIE).cbEXIFMetadataByteCount > 0 {
            let Some(metadata) = (*pIE).exifMetadataMemory.as_ref() else {
                err = Err(crate::WmpError::InvalidParameter);
                break 'cleanup;
            };
            let mut uiTemp: u32;
            if ((*pDEMisc).uEXIFMetadataOffset & 1) != 0 {
                err = set_pos(&mut *pWS, (*pDEMisc).uEXIFMetadataOffset as usize);
                if err.is_err() {
                    break 'cleanup;
                }
                err = write(&mut *pWS, &zero[..1]);
                if err.is_err() {
                    break 'cleanup;
                }
            }
            (*pDEMisc).uEXIFMetadataOffset = (*pDEMisc)
                .uEXIFMetadataOffset
                .wrapping_add((*pDEMisc).uEXIFMetadataOffset & 1);
            wmpDE.uValueOrOffset = (*pDEMisc).uEXIFMetadataOffset;
            err = write_wmp_de(&mut *pWS, &mut offPos, &wmpDE, None, None);
            if err.is_err() {
                break 'cleanup;
            }
            let Some(exif_temp_len) = (*pDEMisc)
                .uEXIFMetadataOffset
                .checked_add((*pIE).cbEXIFMetadataByteCount)
            else {
                err = Err(crate::WmpError::BufferOverflow);
                break 'cleanup;
            };
            let mut exif_metadata = Vec::new();
            if exif_metadata
                .try_reserve_exact(exif_temp_len as usize)
                .is_err()
            {
                err = Err(crate::WmpError::OutOfMemory);
                break 'cleanup;
            }
            exif_metadata.resize(exif_temp_len as usize, 0);
            uiTemp = (*pDEMisc).uEXIFMetadataOffset;
            let exif_byte_count = (*pIE).cbEXIFMetadataByteCount as usize;
            if metadata.len() < exif_byte_count {
                err = Err(crate::WmpError::BufferOverflow);
                break 'cleanup;
            }
            err = buffer_copy_ifd(
                Some(&metadata[..exif_byte_count]),
                0,
                WMP_INTEL_ENDIAN,
                Some(exif_metadata.as_mut_slice()),
                Some(&mut uiTemp),
            );
            if err.is_err() {
                break 'cleanup;
            }
            err = set_pos(&mut *pWS, (*pDEMisc).uEXIFMetadataOffset as usize);
            if err.is_err() {
                break 'cleanup;
            }
            let exif_offset = (*pDEMisc).uEXIFMetadataOffset as usize;
            err = write(
                &mut *pWS,
                &exif_metadata[exif_offset..exif_offset + exif_byte_count],
            );
            if err.is_err() {
                break 'cleanup;
            }
        }

        wmpDE = wmpDEs[i].clone();
        i += 1;
        debug_assert_eq!(WMP_tagIccProfile, wmpDE.uTag);
        if (*pIE).cbColorContext > 0 {
            let Some(metadata) = (*pIE).colorContextMemory.as_ref() else {
                err = Err(crate::WmpError::InvalidParameter);
                break 'cleanup;
            };
            let mut uiTemp = 0_u32;
            wmpDE.uCount = (*pIE).cbColorContext;
            wmpDE.uValueOrOffset = (*pDEMisc).uColorProfileOffset;
            err = write_wmp_de(
                &mut *pWS,
                &mut offPos,
                &wmpDE,
                Some(metadata.as_ref()),
                Some(&mut uiTemp),
            );
            if err.is_err() {
                break 'cleanup;
            }
        }

        wmpDE = wmpDEs[i].clone();
        i += 1;
        debug_assert_eq!(WMP_tagGPSInfoMetadata, wmpDE.uTag);
        if (*pIE).cbGPSInfoMetadataByteCount > 0 {
            let Some(metadata) = (*pIE).gpsInfoMetadataMemory.as_ref() else {
                err = Err(crate::WmpError::InvalidParameter);
                break 'cleanup;
            };
            let mut uiTemp: u32;
            if ((*pDEMisc).uGPSInfoMetadataOffset & 1) != 0 {
                err = set_pos(&mut *pWS, (*pDEMisc).uGPSInfoMetadataOffset as usize);
                if err.is_err() {
                    break 'cleanup;
                }
                err = write(&mut *pWS, &zero[..1]);
                if err.is_err() {
                    break 'cleanup;
                }
            }
            (*pDEMisc).uGPSInfoMetadataOffset = (*pDEMisc)
                .uGPSInfoMetadataOffset
                .wrapping_add((*pDEMisc).uGPSInfoMetadataOffset & 1);
            wmpDE.uValueOrOffset = (*pDEMisc).uGPSInfoMetadataOffset;
            err = write_wmp_de(&mut *pWS, &mut offPos, &wmpDE, None, None);
            if err.is_err() {
                break 'cleanup;
            }
            let Some(gps_temp_len) = (*pDEMisc)
                .uGPSInfoMetadataOffset
                .checked_add((*pIE).cbGPSInfoMetadataByteCount)
            else {
                err = Err(crate::WmpError::BufferOverflow);
                break 'cleanup;
            };
            let mut gps_info_metadata = Vec::new();
            if gps_info_metadata
                .try_reserve_exact(gps_temp_len as usize)
                .is_err()
            {
                err = Err(crate::WmpError::OutOfMemory);
                break 'cleanup;
            }
            gps_info_metadata.resize(gps_temp_len as usize, 0);
            uiTemp = (*pDEMisc).uGPSInfoMetadataOffset;
            let gps_byte_count = (*pIE).cbGPSInfoMetadataByteCount as usize;
            if metadata.len() < gps_byte_count {
                err = Err(crate::WmpError::BufferOverflow);
                break 'cleanup;
            }
            err = buffer_copy_ifd(
                Some(&metadata[..gps_byte_count]),
                0,
                WMP_INTEL_ENDIAN,
                Some(gps_info_metadata.as_mut_slice()),
                Some(&mut uiTemp),
            );
            if err.is_err() {
                break 'cleanup;
            }
            err = set_pos(&mut *pWS, (*pDEMisc).uGPSInfoMetadataOffset as usize);
            if err.is_err() {
                break 'cleanup;
            }
            let gps_offset = (*pDEMisc).uGPSInfoMetadataOffset as usize;
            err = write(
                &mut *pWS,
                &gps_info_metadata[gps_offset..gps_offset + gps_byte_count],
            );
            if err.is_err() {
                break 'cleanup;
            }
        }

        wmpDE = wmpDEs[i].clone();
        i += 1;
        debug_assert_eq!(WMP_tagPixelFormat, wmpDE.uTag);
        wmpDE.uValueOrOffset = (*pDEMisc).uOffPixelFormat;
        err = write_wmp_de(&mut *pWS, &mut offPos, &wmpDE, None, None);
        if err.is_err() {
            break 'cleanup;
        }

        wmpDE = wmpDEs[i].clone();
        i += 1;
        debug_assert_eq!(WMP_tagTransformation, wmpDE.uTag);
        wmpDE.uValueOrOffset = (*pIE).WMP.oOrientation as u32;
        err = write_wmp_de(&mut *pWS, &mut offPos, &wmpDE, None, None);
        if err.is_err() {
            break 'cleanup;
        }

        wmpDE = wmpDEs[i].clone();
        i += 1;
        debug_assert_eq!(WMP_tagImageWidth, wmpDE.uTag);
        wmpDE.uValueOrOffset = (*pIE).uWidth;
        err = write_wmp_de(&mut *pWS, &mut offPos, &wmpDE, None, None);
        if err.is_err() {
            break 'cleanup;
        }

        wmpDE = wmpDEs[i].clone();
        i += 1;
        debug_assert_eq!(WMP_tagImageHeight, wmpDE.uTag);
        wmpDE.uValueOrOffset = (*pIE).uHeight;
        err = write_wmp_de(&mut *pWS, &mut offPos, &wmpDE, None, None);
        if err.is_err() {
            break 'cleanup;
        }

        wmpDE = wmpDEs[i].clone();
        i += 1;
        debug_assert_eq!(WMP_tagWidthResolution, wmpDE.uTag);
        wmpDE.uValueOrOffset = (*pIE).fResX.to_bits();
        err = write_wmp_de(&mut *pWS, &mut offPos, &wmpDE, None, None);
        if err.is_err() {
            break 'cleanup;
        }

        wmpDE = wmpDEs[i].clone();
        i += 1;
        debug_assert_eq!(WMP_tagHeightResolution, wmpDE.uTag);
        wmpDE.uValueOrOffset = (*pIE).fResY.to_bits();
        err = write_wmp_de(&mut *pWS, &mut offPos, &wmpDE, None, None);
        if err.is_err() {
            break 'cleanup;
        }

        wmpDE = wmpDEs[i].clone();
        i += 1;
        debug_assert_eq!(WMP_tagImageOffset, wmpDE.uTag);
        wmpDE.uValueOrOffset = (*pDEMisc).uImageOffset;
        err = write_wmp_de(&mut *pWS, &mut offPos, &wmpDE, None, None);
        if err.is_err() {
            break 'cleanup;
        }

        wmpDE = wmpDEs[i].clone();
        i += 1;
        debug_assert_eq!(WMP_tagImageByteCount, wmpDE.uTag);
        (*pDEMisc).uOffImageByteCount = offPos as u32;
        wmpDE.uValueOrOffset = 0;
        err = write_wmp_de(&mut *pWS, &mut offPos, &wmpDE, None, None);
        if err.is_err() {
            break 'cleanup;
        }

        if (*pIE).WMP.bHasAlpha
            && AlphaMode::from_u8((*pIE).WMP.wmiSCP.uAlphaMode) == Some(AlphaMode::Planar)
        {
            wmpDE = wmpDEs[i].clone();
            i += 1;
            debug_assert_eq!(WMP_tagAlphaOffset, wmpDE.uTag);
            (*pDEMisc).uOffAlphaOffset = offPos as u32;
            wmpDE.uValueOrOffset = 0;
            err = write_wmp_de(&mut *pWS, &mut offPos, &wmpDE, None, None);
            if err.is_err() {
                break 'cleanup;
            }

            wmpDE = wmpDEs[i].clone();
            debug_assert_eq!(WMP_tagAlphaByteCount, wmpDE.uTag);
            (*pDEMisc).uOffAlphaByteCount = offPos as u32;
            wmpDE.uValueOrOffset = 0;
            err = write_wmp_de(&mut *pWS, &mut offPos, &wmpDE, None, None);
            if err.is_err() {
                break 'cleanup;
            }
        }

        err = put_u_long(&mut *pWS, offPos, 0);
        if err.is_err() {
            break 'cleanup;
        }
        offPos += 4;

        debug_assert_eq!(0, offPos & 1);
        if (*pDEMisc).uColorProfileOffset > 0
            || (*pDEMisc).uDescMetadataOffset > 0
            || (*pDEMisc).uXMPMetadataOffset > 0
            || (*pDEMisc).uIPTCNAAMetadataOffset > 0
            || (*pDEMisc).uPhotoshopMetadataOffset > 0
            || (*pDEMisc).uEXIFMetadataOffset > 0
            || (*pDEMisc).uGPSInfoMetadataOffset > 0
        {
            debug_assert!(
                (*pDEMisc).uColorProfileOffset == offPos as u32
                    || (*pDEMisc).uDescMetadataOffset == offPos as u32
                    || (*pDEMisc).uXMPMetadataOffset == offPos as u32
                    || (*pDEMisc).uIPTCNAAMetadataOffset == offPos as u32
                    || (*pDEMisc).uPhotoshopMetadataOffset == offPos as u32
                    || (*pDEMisc).uEXIFMetadataOffset == offPos as u32
                    || (*pDEMisc).uGPSInfoMetadataOffset == offPos as u32
            );
            err = set_pos(&mut *pWS, (*pDEMisc).uImageOffset as usize);
            if err.is_err() {
                break 'cleanup;
            }
            offPos = (*pDEMisc).uImageOffset as usize;
        }
        debug_assert_eq!((*pDEMisc).uImageOffset as usize, offPos);
        break 'cleanup;
    }

    err
}

/// Original function: `WriteContainerPost` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:704`.
pub unsafe fn write_container_post(pIE: *mut tagPKImageEncode) -> Result<(), crate::WmpError> {
    let Some(pWS) = (*pIE).pStream.map(NonNull::as_ptr) else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let pDEMisc = std::ptr::addr_of_mut!((*pIE).WMP.wmiDEMisc);
    let mut offPos: usize;

    let mut deImageByteCount = tagWmpDE {
        uTag: WMP_tagImageByteCount,
        uType: WMP_typLONG,
        uCount: 1,
        uValueOrOffset: 0,
    };
    let mut deAlphaOffset = tagWmpDE {
        uTag: WMP_tagAlphaOffset,
        uType: WMP_typLONG,
        uCount: 1,
        uValueOrOffset: 0,
    };
    let mut deAlphaByteCount = tagWmpDE {
        uTag: WMP_tagAlphaByteCount,
        uType: WMP_typLONG,
        uCount: 1,
        uValueOrOffset: 0,
    };

    deImageByteCount.uValueOrOffset =
        u32::try_from((*pIE).WMP.nCbImage).map_err(|_| crate::WmpError::BufferOverflow)?;
    offPos = (*pDEMisc).uOffImageByteCount as usize;
    let mut err = write_wmp_de(&mut *pWS, &mut offPos, &deImageByteCount, None, None);
    if err.is_err() {
        return err;
    }

    if (*pIE).WMP.bHasAlpha
        && AlphaMode::from_u8((*pIE).WMP.wmiSCP.uAlphaMode) == Some(AlphaMode::Planar)
    {
        deAlphaOffset.uValueOrOffset =
            u32::try_from((*pIE).WMP.nOffAlpha).map_err(|_| crate::WmpError::BufferOverflow)?;
        offPos = (*pDEMisc).uOffAlphaOffset as usize;
        err = write_wmp_de(&mut *pWS, &mut offPos, &deAlphaOffset, None, None);
        if err.is_err() {
            return err;
        }

        deAlphaByteCount.uValueOrOffset = (*pIE)
            .WMP
            .nCbAlpha
            .checked_add((*pIE).WMP.nOffAlpha)
            .and_then(|v| u32::try_from(v).ok())
            .ok_or(crate::WmpError::BufferOverflow)?;
        offPos = (*pDEMisc).uOffAlphaByteCount as usize;
        err = write_wmp_de(&mut *pWS, &mut offPos, &deAlphaByteCount, None, None);
        if err.is_err() {
            return err;
        }
    }

    Ok(())
}

/// Original function: `PKImageEncode_Initialize_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:739`.
pub unsafe fn pk_image_encode_initialize_wmp(
    pIE: &mut tagPKImageEncode,
    pStream: &mut WMPStream,
    param: Option<&crate::jxrgluelib::jxrglue::tagWmpStrCodecParam>,
    cbParam: usize,
) -> Result<(), crate::WmpError> {
    let pIE = pIE as *mut tagPKImageEncode;
    if std::mem::size_of_val(&(*pIE).WMP.wmiSCP) != cbParam {
        return Err(crate::WmpError::InvalidArgument);
    }
    let Some(param) = param else {
        return Err(crate::WmpError::InvalidArgument);
    };

    (*pIE).WMP.wmiSCP = *param;
    (*pIE).WMP.wmiSCP_Alpha = *param;
    (*pIE).pStream = Some(NonNull::from(&mut *pStream));

    (*pIE).WMP.wmiSCP.pWStream = Some(NonNull::from(&mut *pStream));
    (*pIE).WMP.wmiSCP_Alpha.pWStream = Some(NonNull::from(pStream));

    Ok(())
}

/// Original function: `PKImageEncode_Terminate_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:760`.
pub unsafe fn pk_image_encode_terminate_wmp(
    _pIE: &mut tagPKImageEncode,
) -> Result<(), crate::WmpError> {
    let err = Ok(());
    err
}

/// Original function: `PKImageEncode_EncodeContent_Init` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:769`.
pub unsafe fn pk_image_encode_encode_content_init(
    pIE: *mut tagPKImageEncode,
    PI: tagPKPixelInfo,
    cLine: u32,
    pbPixels: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    (*pIE).WMP.wmiI.cWidth = (*pIE).uWidth as usize;
    (*pIE).WMP.wmiI.cHeight = (*pIE).uHeight as usize;
    (*pIE).WMP.wmiI.bdBitDepth = PI.bdBitDepth;
    (*pIE).WMP.wmiI.cBitsPerUnit = PI.cbitUnit as usize;
    (*pIE).WMP.wmiI.bRGB = ((PI.grBit & PixelFormatFlags::BGR) == PixelFormatFlags::NONE) as i32;
    (*pIE).WMP.wmiI.cfColorFormat = PI.cfColorFormat;
    (*pIE).WMP.wmiI.oOrientation = (*pIE).WMP.oOrientation;

    if PI.cfColorFormat == ColorFormat::NComponent && PI.cChannel == 0 {
        return Err(crate::WmpError::InvalidParameter);
    }

    if 0 == (pbPixels as usize % 128)
        && 0 == ((*pIE).uWidth % 16)
        && 0 == (cLine % 16)
        && 0 == (cbStride % 128)
    {
        (*pIE).WMP.wmiI.fPaddedUserBuffer = 1;
    }

    if PI.cfColorFormat == ColorFormat::NComponent
        && (PI.grBit & PixelFormatFlags::HAS_ALPHA) == PixelFormatFlags::NONE
    {
        (*pIE).WMP.wmiSCP.cChannel = PI.cChannel;
    } else {
        (*pIE).WMP.wmiSCP.cChannel = PI.cChannel - 1;
    }

    (*pIE).idxCurrentLine = 0;

    (*pIE).WMP.wmiSCP.fMeasurePerf = 0;
    let mut ctx_sc = None;
    image_str_enc_init(
        std::ptr::addr_of_mut!((*pIE).WMP.wmiI),
        std::ptr::addr_of_mut!((*pIE).WMP.wmiSCP),
        &mut ctx_sc,
    )?;
    let Some(ctx_sc) = ctx_sc else {
        return Err(crate::WmpError::Fail);
    };
    (*pIE).WMP.ctxSC = Some(ctx_sc);

    Ok(())
}

/// Original function: `PKImageEncode_EncodeContent_Encode` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:819`.
pub unsafe fn pk_image_encode_encode_content_encode(
    pIE: *mut tagPKImageEncode,
    cLine: u32,
    pbPixels: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    if cLine > 0 && pbPixels.is_null() {
        return Err(crate::WmpError::InvalidParameter);
    }

    let mut i: u32 = 0;

    while i < cLine {
        let f420 = (*pIE).WMP.wmiI.cfColorFormat == ColorFormat::Yuv420
            || ((*pIE).WMP.wmiSCP.bYUVData != 0
                && (*pIE).WMP.wmiSCP.cfColorFormat == ColorFormat::Yuv420);
        let row_offset = checked_banded_row_offset(cbStride as usize, i as usize, f420)
            .ok_or(crate::WmpError::BufferOverflow)?;
        let wmiBI = tagCWMImageBufferInfo {
            pv: NonNull::new(pbPixels.add(row_offset)),
            cLine: std::cmp::min(16, cLine - i) as usize,
            cbStride: cbStride as usize,
        };
        let Some(ctx_sc) = (*pIE).WMP.ctxSC.as_mut() else {
            return Err(crate::WmpError::Fail);
        };
        if image_str_enc_encode(ctx_sc.as_mut(), std::ptr::addr_of!(wmiBI)).is_err() {
            return Err(crate::WmpError::Fail);
        }
        i += 16;
    }
    (*pIE).idxCurrentLine = (*pIE).idxCurrentLine.wrapping_add(cLine);

    Ok(())
}

/// Original function: `PKImageEncode_EncodeContent_Term` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:845`.
pub unsafe fn pk_image_encode_encode_content_term(
    pIE: *mut tagPKImageEncode,
) -> Result<(), crate::WmpError> {
    let Some(ctx_sc) = (*pIE).WMP.ctxSC.take() else {
        return Err(crate::WmpError::Fail);
    };
    image_str_enc_term(ctx_sc)?;

    Ok(())
}

/// Original function: `PKImageEncode_EncodeContent` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:855`.
pub unsafe fn pk_image_encode_encode_content(
    pIE: *mut tagPKImageEncode,
    PI: tagPKPixelInfo,
    cLine: u32,
    pbPixels: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let mut offPos: usize = 0;
    let Some(p_stream) = (*pIE).pStream.map(NonNull::as_ptr) else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(get_pos) = (*p_stream).GetPos else {
        return Err(crate::WmpError::InvalidParameter);
    };

    let mut err = get_pos(&mut *p_stream, &mut offPos);
    if err.is_err() {
        return err;
    }
    (*pIE).WMP.nOffImage = offPos as _;

    err = pk_image_encode_encode_content_init(pIE, PI, cLine, pbPixels, cbStride);
    if err.is_err() {
        return err;
    }
    err = pk_image_encode_encode_content_encode(pIE, cLine, pbPixels, cbStride);
    if err.is_err() {
        return err;
    }
    err = pk_image_encode_encode_content_term(pIE);
    if err.is_err() {
        return err;
    }

    err = get_pos(&mut *p_stream, &mut offPos);
    if err.is_err() {
        return err;
    }
    (*pIE).WMP.nCbImage = offPos as i64 - (*pIE).WMP.nOffImage;

    Ok(())
}

/// Original function: `PKImageEncode_EncodeAlpha_Init` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:880`.
pub unsafe fn pk_image_encode_encode_alpha_init(
    pIE: *mut tagPKImageEncode,
    PI: tagPKPixelInfo,
    _cLine: u32,
    _pbPixels: *mut u8,
    _cbStride: u32,
) -> Result<(), crate::WmpError> {
    (*pIE).WMP.wmiI_Alpha = (*pIE).WMP.wmiI;

    (*pIE).WMP.wmiI_Alpha.cWidth = (*pIE).uWidth as usize;
    (*pIE).WMP.wmiI_Alpha.cHeight = (*pIE).uHeight as usize;
    (*pIE).WMP.wmiI_Alpha.bdBitDepth = PI.bdBitDepth;
    (*pIE).WMP.wmiI_Alpha.cBitsPerUnit = PI.cbitUnit as usize;
    (*pIE).WMP.wmiI_Alpha.bRGB =
        ((PI.grBit & PixelFormatFlags::BGR) == PixelFormatFlags::NONE) as i32;
    (*pIE).WMP.wmiI.oOrientation = (*pIE).WMP.oOrientation;

    match (*pIE).WMP.wmiI.bdBitDepth {
        BitDepth::Eight => {
            (*pIE).WMP.wmiI_Alpha.cLeadingPadding += ((*pIE).WMP.wmiI.cBitsPerUnit >> 3) - 1;
        }
        BitDepth::Sixteen | BitDepth::SixteenS | BitDepth::SixteenF => {
            (*pIE).WMP.wmiI_Alpha.cLeadingPadding +=
                ((*pIE).WMP.wmiI.cBitsPerUnit >> 3) / std::mem::size_of::<u16>() - 1;
        }
        BitDepth::ThirtyTwo | BitDepth::ThirtyTwoS | BitDepth::ThirtyTwoF => {
            (*pIE).WMP.wmiI_Alpha.cLeadingPadding +=
                ((*pIE).WMP.wmiI.cBitsPerUnit >> 3) / std::mem::size_of::<f32>() - 1;
        }
        BitDepth::Five | BitDepth::Ten | BitDepth::FiveSixFive => {}
        _ => {}
    }

    (*pIE).WMP.wmiI_Alpha.cfColorFormat = ColorFormat::YOnly;

    (*pIE).WMP.wmiSCP_Alpha.cfColorFormat = ColorFormat::YOnly;

    (*pIE).idxCurrentLine = 0;
    (*pIE).WMP.wmiSCP_Alpha.fMeasurePerf = 0;
    let mut ctx_sc_alpha = None;
    image_str_enc_init(
        std::ptr::addr_of_mut!((*pIE).WMP.wmiI_Alpha),
        std::ptr::addr_of_mut!((*pIE).WMP.wmiSCP_Alpha),
        &mut ctx_sc_alpha,
    )?;
    let Some(ctx_sc_alpha) = ctx_sc_alpha else {
        return Err(crate::WmpError::Fail);
    };
    (*pIE).WMP.ctxSC_Alpha = Some(ctx_sc_alpha);

    Ok(())
}

/// Original function: `PKImageEncode_EncodeAlpha_Encode` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:945`.
pub unsafe fn pk_image_encode_encode_alpha_encode(
    pIE: *mut tagPKImageEncode,
    cLine: u32,
    pbPixels: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    if cLine > 0 && pbPixels.is_null() {
        return Err(crate::WmpError::InvalidParameter);
    }

    let mut i: u32 = 0;

    while i < cLine {
        let row_offset = checked_banded_row_offset(cbStride as usize, i as usize, false)
            .ok_or(crate::WmpError::BufferOverflow)?;
        let wmiBI = tagCWMImageBufferInfo {
            pv: NonNull::new(pbPixels.add(row_offset)),
            cLine: std::cmp::min(16, cLine - i) as usize,
            cbStride: cbStride as usize,
        };
        let Some(ctx_sc_alpha) = (*pIE).WMP.ctxSC_Alpha.as_mut() else {
            return Err(crate::WmpError::Fail);
        };
        if image_str_enc_encode(ctx_sc_alpha.as_mut(), std::ptr::addr_of!(wmiBI)).is_err() {
            return Err(crate::WmpError::Fail);
        }
        i += 16;
    }
    (*pIE).idxCurrentLine = (*pIE).idxCurrentLine.wrapping_add(cLine);

    Ok(())
}

fn checked_banded_row_offset(cb_stride: usize, line: usize, yuv420: bool) -> Option<usize> {
    let offset = cb_stride.checked_mul(line)?;
    let offset = if yuv420 { offset / 2 } else { offset };
    (offset <= isize::MAX as usize).then_some(offset)
}

/// Original function: `PKImageEncode_EncodeAlpha_Term` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:969`.
pub unsafe fn pk_image_encode_encode_alpha_term(
    pIE: *mut tagPKImageEncode,
) -> Result<(), crate::WmpError> {
    let Some(ctx_sc_alpha) = (*pIE).WMP.ctxSC_Alpha.take() else {
        return Err(crate::WmpError::Fail);
    };
    image_str_enc_term(ctx_sc_alpha)?;

    Ok(())
}

/// Original function: `PKImageEncode_EncodeAlpha` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:979`.
pub unsafe fn pk_image_encode_encode_alpha(
    pIE: *mut tagPKImageEncode,
    PI: tagPKPixelInfo,
    cLine: u32,
    pbPixels: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let mut offPos: usize = 0;
    let Some(p_stream) = (*pIE).pStream.map(NonNull::as_ptr) else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(get_pos) = (*p_stream).GetPos else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(write) = (*p_stream).Write else {
        return Err(crate::WmpError::InvalidParameter);
    };

    let mut err = get_pos(&mut *p_stream, &mut offPos);
    if err.is_err() {
        return err;
    }
    if (offPos & 1) != 0 {
        let zero = 0_u8;
        err = write(&mut *p_stream, &[zero]);
        if err.is_err() {
            return err;
        }
        offPos += 1;
    }
    (*pIE).WMP.nOffAlpha = offPos as _;

    err = pk_image_encode_encode_alpha_init(pIE, PI, cLine, pbPixels, cbStride);
    if err.is_err() {
        return err;
    }
    err = pk_image_encode_encode_alpha_encode(pIE, cLine, pbPixels, cbStride);
    if err.is_err() {
        return err;
    }
    err = pk_image_encode_encode_alpha_term(pIE);
    if err.is_err() {
        return err;
    }

    err = get_pos(&mut *p_stream, &mut offPos);
    if err.is_err() {
        return err;
    }
    (*pIE).WMP.nCbAlpha = offPos as i64 - (*pIE).WMP.nOffAlpha;

    Ok(())
}

/// Original function: `SetMetadata` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:1012`.
pub unsafe fn set_metadata(
    pIE: *mut tagPKImageEncode,
    metadata: Option<&[u8]>,
    pcb_set: &mut u32,
    owner: &mut Option<Box<[u8]>>,
) -> Result<(), crate::WmpError> {
    let Some(image_encode) = pIE.as_mut() else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(metadata) = metadata else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Ok(metadata_len) = u32::try_from(metadata.len()) else {
        return Err(crate::WmpError::BufferOverflow);
    };

    if image_encode.fHeaderDone {
        return Err(crate::WmpError::OutOfSequence);
    }

    *owner = None;
    *pcb_set = 0;

    let mut owned = Vec::new();
    if owned.try_reserve_exact(metadata.len()).is_err() {
        return Err(crate::WmpError::OutOfMemory);
    }
    owned.extend_from_slice(metadata);

    *owner = Some(owned.into_boxed_slice());
    *pcb_set = metadata_len;

    Ok(())
}

/// Original function: `PKImageEncode_SetColorContext_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:1038`.
pub unsafe fn pk_image_encode_set_color_context_wmp(
    pIE: &mut tagPKImageEncode,
    colorContext: Option<&[u8]>,
) -> Result<(), crate::WmpError> {
    let Some(color_context) = colorContext else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let pIE = pIE as *mut tagPKImageEncode;
    let image_encode = &mut *pIE;

    set_metadata(
        pIE,
        Some(color_context),
        &mut image_encode.cbColorContext,
        &mut image_encode.colorContextMemory,
    )
}

/// Original function: `PKImageEncode_SetXMPMetadata_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:1047`.
pub unsafe fn pk_image_encode_set_xmpmetadata_wmp(
    pIE: *mut tagPKImageEncode,
    xmp_metadata: Option<&[u8]>,
) -> Result<(), crate::WmpError> {
    let cbTemp: u32;
    let open_tag = b"<dc:format>";
    let close_tag = b"</dc:format>";
    let hd_photo_format = b"<dc:format>image/vnd.ms-photo</dc:format>";

    let Some(image_encode) = pIE.as_mut() else {
        return Err(crate::WmpError::InvalidParameter);
    };

    if image_encode.fHeaderDone {
        return Err(crate::WmpError::OutOfSequence);
    }
    let Some(xmp_metadata) = xmp_metadata else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Ok(mut cbXMPMetadata) = u32::try_from(xmp_metadata.len()) else {
        return Err(crate::WmpError::BufferOverflow);
    };

    image_encode.xmpMetadataMemory = None;
    image_encode.cbXMPMetadataByteCount = 0;

    let Some(cb_buffer) = cbXMPMetadata
        .checked_add(1)
        .and_then(|cb| cb.checked_add(open_tag.len() as u32))
        .and_then(|cb| cb.checked_add(close_tag.len() as u32))
        .and_then(|cb| cb.checked_add(hd_photo_format.len() as u32))
        .map(|cb| cb as usize)
    else {
        image_encode.cbXMPMetadataByteCount = 0;
        return Err(crate::WmpError::BufferOverflow);
    };
    let mut temp = Vec::new();
    if temp.try_reserve_exact(cb_buffer).is_err() {
        image_encode.cbXMPMetadataByteCount = 0;
        return Err(crate::WmpError::OutOfMemory);
    };
    temp.extend_from_slice(xmp_metadata);
    temp.push(0);
    temp.resize(cb_buffer, 0);

    let mut metadata_len = 0usize;
    while metadata_len < cbXMPMetadata as usize && temp[metadata_len] != 0 {
        metadata_len += 1;
    }
    cbXMPMetadata = metadata_len as u32;

    let mut format_begin = None;
    let mut i = 0usize;
    while i + open_tag.len() <= metadata_len {
        if &temp[i..i + open_tag.len()] == open_tag {
            format_begin = Some(i);
            break;
        }
        i += 1;
    }

    if let Some(format_begin) = format_begin {
        let mut format_end = None;
        i = format_begin;
        while i + close_tag.len() <= metadata_len {
            if &temp[i..i + close_tag.len()] == close_tag {
                format_end = Some(i);
                break;
            }
            i += 1;
        }
        let Some(mut format_end) = format_end else {
            image_encode.cbXMPMetadataByteCount = 0;
            return Err(crate::WmpError::Fail);
        };

        let mut less_than = None;
        i = format_begin + open_tag.len();
        while i < metadata_len {
            if temp[i] == b'<' {
                less_than = Some(i);
                break;
            }
            i += 1;
        }
        if less_than != Some(format_end) {
            image_encode.cbXMPMetadataByteCount = 0;
            return Err(crate::WmpError::Fail);
        }
        format_end += close_tag.len();

        let format_span = (format_end - format_begin) as u32;
        cbTemp = cbXMPMetadata - format_span + hd_photo_format.len() as u32;
        debug_assert!(cbTemp as usize <= cb_buffer);
        if format_begin + hd_photo_format.len() > cb_buffer {
            image_encode.cbXMPMetadataByteCount = 0;
            return Err(crate::WmpError::BufferOverflow);
        }
        temp.copy_within(
            format_end..cbXMPMetadata as usize,
            format_begin + hd_photo_format.len(),
        );
        temp[format_begin..format_begin + hd_photo_format.len()].copy_from_slice(hd_photo_format);
    } else {
        cbTemp = cbXMPMetadata;
    }

    let mut metadata = Vec::new();
    if metadata.try_reserve_exact(cbTemp as usize).is_err() {
        image_encode.cbXMPMetadataByteCount = 0;
        return Err(crate::WmpError::OutOfMemory);
    }
    metadata.extend_from_slice(&temp[..cbTemp as usize]);
    image_encode.xmpMetadataMemory = Some(metadata.into_boxed_slice());
    image_encode.cbXMPMetadataByteCount = cbTemp;
    Ok(())
}

/// Original function: `PKImageEncode_SetEXIFMetadata_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:1112`.
pub unsafe fn pk_image_encode_set_exifmetadata_wmp(
    pIE: *mut tagPKImageEncode,
    exif_metadata: Option<&[u8]>,
) -> Result<(), crate::WmpError> {
    let Some(image_encode) = pIE.as_mut() else {
        return Err(crate::WmpError::InvalidParameter);
    };

    set_metadata(
        pIE,
        exif_metadata,
        &mut image_encode.cbEXIFMetadataByteCount,
        &mut image_encode.exifMetadataMemory,
    )
}

/// Original function: `PKImageEncode_SetGPSInfoMetadata_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:1120`.
pub unsafe fn pk_image_encode_set_gpsinfo_metadata_wmp(
    pIE: *mut tagPKImageEncode,
    gps_info_metadata: Option<&[u8]>,
) -> Result<(), crate::WmpError> {
    let Some(image_encode) = pIE.as_mut() else {
        return Err(crate::WmpError::InvalidParameter);
    };

    set_metadata(
        pIE,
        gps_info_metadata,
        &mut image_encode.cbGPSInfoMetadataByteCount,
        &mut image_encode.gpsInfoMetadataMemory,
    )
}

/// Original function: `PKImageEncode_SetIPTCNAAMetadata_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:1128`.
pub unsafe fn pk_image_encode_set_iptcna_metadata_wmp(
    pIE: *mut tagPKImageEncode,
    iptc_naa_metadata: Option<&[u8]>,
) -> Result<(), crate::WmpError> {
    let Some(image_encode) = pIE.as_mut() else {
        return Err(crate::WmpError::InvalidParameter);
    };

    set_metadata(
        pIE,
        iptc_naa_metadata,
        &mut image_encode.cbIPTCNAAMetadataByteCount,
        &mut image_encode.iptcNAAMetadataMemory,
    )
}

/// Original function: `PKImageEncode_SetPhotoshopMetadata_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:1136`.
pub unsafe fn pk_image_encode_set_photoshop_metadata_wmp(
    pIE: *mut tagPKImageEncode,
    photoshop_metadata: Option<&[u8]>,
) -> Result<(), crate::WmpError> {
    let Some(image_encode) = pIE.as_mut() else {
        return Err(crate::WmpError::InvalidParameter);
    };

    set_metadata(
        pIE,
        photoshop_metadata,
        &mut image_encode.cbPhotoshopMetadataByteCount,
        &mut image_encode.photoshopMetadataMemory,
    )
}

/// Original function: `PKImageEncode_SetDescriptiveMetadata_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:1144`.
pub unsafe fn pk_image_encode_set_descriptive_metadata_wmp(
    pIE: &mut tagPKImageEncode,
    pSrcMeta: Option<&DESCRIPTIVEMETADATA>,
) -> Result<(), crate::WmpError> {
    let pIE = pIE as *mut tagPKImageEncode;
    let Some(src_meta) = pSrcMeta else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let dst_meta = &mut (*pIE).sDescMetadata;

    if (*pIE).fHeaderDone {
        return Err(crate::WmpError::OutOfSequence);
    }

    for (dst, src) in [
        (
            &mut dst_meta.pvarImageDescription,
            &src_meta.pvarImageDescription,
        ),
        (&mut dst_meta.pvarCameraMake, &src_meta.pvarCameraMake),
        (&mut dst_meta.pvarCameraModel, &src_meta.pvarCameraModel),
        (&mut dst_meta.pvarSoftware, &src_meta.pvarSoftware),
        (&mut dst_meta.pvarDateTime, &src_meta.pvarDateTime),
        (&mut dst_meta.pvarArtist, &src_meta.pvarArtist),
        (&mut dst_meta.pvarCopyright, &src_meta.pvarCopyright),
        (&mut dst_meta.pvarRatingStars, &src_meta.pvarRatingStars),
        (&mut dst_meta.pvarRatingValue, &src_meta.pvarRatingValue),
        (&mut dst_meta.pvarCaption, &src_meta.pvarCaption),
        (&mut dst_meta.pvarDocumentName, &src_meta.pvarDocumentName),
        (&mut dst_meta.pvarPageName, &src_meta.pvarPageName),
        (&mut dst_meta.pvarPageNumber, &src_meta.pvarPageNumber),
        (&mut dst_meta.pvarHostComputer, &src_meta.pvarHostComputer),
    ] {
        let err = copy_desc_metadata(dst, src);
        if err.is_err() {
            return err;
        }
    }

    Ok(())
}

/// Original function: `PKImageEncode_WritePixels_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:1178`.
pub unsafe fn pk_image_encode_write_pixels_wmp(
    pIE: &mut tagPKImageEncode,
    cLine: u32,
    pbPixels: &[u8],
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let pIE = pIE as *mut tagPKImageEncode;
    let mut PI = tagPKPixelInfo::default();

    debug_assert!(BandedEncodeState::Uninitialized == (*pIE).WMP.eBandedEncState);
    (*pIE).WMP.eBandedEncState = BandedEncodeState::NonBandedEncode;

    PI.pGUIDPixFmt = Some((*pIE).guidPixFormat);
    let mut err: Result<(), crate::WmpError> = pixel_format_lookup(&mut PI, LOOKUP_FORWARD);
    if err.is_err() {
        return err;
    }
    let required_len = (cbStride as usize)
        .checked_mul(cLine as usize)
        .ok_or(crate::WmpError::InvalidParameter)?;
    if pbPixels.len() < required_len {
        return Err(crate::WmpError::InvalidParameter);
    }
    (*pIE).WMP.bHasAlpha = (PI.grBit & PixelFormatFlags::HAS_ALPHA) != PixelFormatFlags::NONE;

    if !(*pIE).fHeaderDone {
        err = write_container_pre(pIE);
        if err.is_err() {
            return err;
        }
        (*pIE).fHeaderDone = true;
    }

    let pb_pixels = pbPixels.as_ptr().cast_mut();
    err = pk_image_encode_encode_content(pIE, PI, cLine, pb_pixels, cbStride);
    if err.is_err() {
        return err;
    }
    if (*pIE).WMP.bHasAlpha
        && AlphaMode::from_u8((*pIE).WMP.wmiSCP.uAlphaMode) == Some(AlphaMode::Planar)
    {
        err = pk_image_encode_encode_alpha(pIE, PI, cLine, pb_pixels, cbStride);
        if err.is_err() {
            return err;
        }
    }

    write_container_post(pIE)
}

/// Original function: `PKImageEncode_WritePixelsBandedBegin_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:1220`.
pub unsafe fn pk_image_encode_write_pixels_banded_begin_wmp(
    pIE: &mut tagPKImageEncode,
    pPATempFile: Option<&mut WMPStream>,
) -> Result<(), crate::WmpError> {
    let pIE = pIE as *mut tagPKImageEncode;
    debug_assert!(BandedEncodeState::Uninitialized == (*pIE).WMP.eBandedEncState);
    (*pIE).WMP.eBandedEncState = BandedEncodeState::Init;
    (*pIE).WMP.pPATempFile = pPATempFile.map(NonNull::from);

    Ok(())
}

/// Original function: `PKImageEncode_WritePixelsBanded_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:1235`.
pub unsafe fn pk_image_encode_write_pixels_banded_wmp(
    pIE: &mut tagPKImageEncode,
    cLine: u32,
    pbPixels: *mut u8,
    cbStride: u32,
    fLastCall: i32,
) -> Result<(), crate::WmpError> {
    if cLine > 0 && pbPixels.is_null() {
        return Err(crate::WmpError::InvalidParameter);
    }

    let pIE = pIE as *mut tagPKImageEncode;
    let mut PI = tagPKPixelInfo::default();
    let mut fPI = 0;
    let eEncStateOrig = (*pIE).WMP.eBandedEncState;
    let pPATempFile = (*pIE).WMP.pPATempFile;

    if fLastCall == 0 && 0 != cLine % 16 {
        return Err(crate::WmpError::MustBeMultipleOf16LinesUntilLastCall);
    }

    if !(*pIE).fHeaderDone || BandedEncodeState::Init == (*pIE).WMP.eBandedEncState {
        PI.pGUIDPixFmt = Some((*pIE).guidPixFormat);
        let err: Result<(), crate::WmpError> = pixel_format_lookup(&mut PI, LOOKUP_FORWARD);
        if err.is_err() {
            return err;
        }
        (*pIE).WMP.bHasAlpha = (PI.grBit & PixelFormatFlags::HAS_ALPHA) != PixelFormatFlags::NONE;
        fPI = 1;

        if (*pIE).WMP.bHasAlpha
            && AlphaMode::from_u8((*pIE).WMP.wmiSCP.uAlphaMode) == Some(AlphaMode::Planar)
            && pPATempFile.is_none()
        {
            return Err(crate::WmpError::PlanarAlphaBandedEncRequiresTempFile);
        }
    }

    if !(*pIE).fHeaderDone {
        debug_assert!(fPI != 0);
        let err = write_container_pre(pIE);
        if err.is_err() {
            return err;
        }
        (*pIE).fHeaderDone = true;
    }

    if BandedEncodeState::Init == (*pIE).WMP.eBandedEncState {
        let mut offPos: usize = 0;
        let Some(p_stream) = (*pIE).pStream.map(NonNull::as_ptr) else {
            return Err(crate::WmpError::InvalidParameter);
        };
        let Some(get_pos) = (*p_stream).GetPos else {
            return Err(crate::WmpError::InvalidParameter);
        };
        let err = get_pos(&mut *p_stream, &mut offPos);
        if err.is_err() {
            return err;
        }
        (*pIE).WMP.nOffImage = offPos as _;

        debug_assert!(fPI != 0);
        let err = pk_image_encode_encode_content_init(pIE, PI, cLine, pbPixels, cbStride);
        if err.is_err() {
            return err;
        }
        (*pIE).WMP.eBandedEncState = BandedEncodeState::Encoding;
    }

    let mut err = pk_image_encode_encode_content_encode(pIE, cLine, pbPixels, cbStride);
    if err.is_err() {
        return err;
    }
    if (*pIE).WMP.bHasAlpha
        && AlphaMode::from_u8((*pIE).WMP.wmiSCP.uAlphaMode) == Some(AlphaMode::Planar)
    {
        if BandedEncodeState::Init == eEncStateOrig {
            let mut offStart: usize = 0;
            let Some(p_temp_file) = pPATempFile else {
                return Err(crate::WmpError::InvalidParameter);
            };
            let p_temp_file = p_temp_file.as_ptr();
            let Some(get_pos) = (*p_temp_file).GetPos else {
                return Err(crate::WmpError::InvalidParameter);
            };

            err = get_pos(&mut *p_temp_file, &mut offStart);
            if err.is_err() {
                return err;
            }
            debug_assert_eq!(0, offStart);
            debug_assert_eq!((*pIE).WMP.wmiSCP_Alpha.pWStream, (*pIE).WMP.wmiSCP.pWStream);

            (*pIE).WMP.wmiSCP_Alpha.pWStream = NonNull::new(p_temp_file);
            err = pk_image_encode_encode_alpha_init(pIE, PI, cLine, pbPixels, cbStride);
            if err.is_err() {
                return err;
            }
        }

        err = pk_image_encode_encode_alpha_encode(pIE, cLine, pbPixels, cbStride);
        if err.is_err() {
            return err;
        }
    }

    Ok(())
}

/// Original function: `PKImageEncode_WritePixelsBandedEnd_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:1305`.
pub unsafe fn pk_image_encode_write_pixels_banded_end_wmp(
    pIE: &mut tagPKImageEncode,
) -> Result<(), crate::WmpError> {
    let pIE = pIE as *mut tagPKImageEncode;
    let Some(pMainStream) = (*pIE).WMP.wmiSCP.pWStream.map(NonNull::as_ptr) else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let mut offAlpha: usize = 0;
    let Some(main_get_pos) = (*pMainStream).GetPos else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(main_write) = (*pMainStream).Write else {
        return Err(crate::WmpError::InvalidParameter);
    };

    debug_assert!(BandedEncodeState::Encoding == (*pIE).WMP.eBandedEncState);

    let mut err = pk_image_encode_encode_content_term(pIE);
    if err.is_err() {
        return err;
    }
    err = main_get_pos(&mut *pMainStream, &mut offAlpha);
    if err.is_err() {
        return err;
    }
    (*pIE).WMP.nCbImage = offAlpha as i64 - (*pIE).WMP.nOffImage;

    if (*pIE).WMP.bHasAlpha
        && AlphaMode::from_u8((*pIE).WMP.wmiSCP.uAlphaMode) == Some(AlphaMode::Planar)
    {
        let mut cbAlpha: usize = 0;
        let mut cbBytesCopied: usize;
        let Some(pAlphaStream) = (*pIE).WMP.wmiSCP_Alpha.pWStream.map(NonNull::as_ptr) else {
            return Err(crate::WmpError::InvalidParameter);
        };
        let Some(alpha_get_pos) = (*pAlphaStream).GetPos else {
            return Err(crate::WmpError::InvalidParameter);
        };
        let Some(alpha_set_pos) = (*pAlphaStream).SetPos else {
            return Err(crate::WmpError::InvalidParameter);
        };
        let Some(alpha_read) = (*pAlphaStream).Read else {
            return Err(crate::WmpError::InvalidParameter);
        };

        debug_assert!(pAlphaStream != pMainStream);

        err = pk_image_encode_encode_alpha_term(pIE);
        if err.is_err() {
            return err;
        }

        err = alpha_get_pos(&mut *pAlphaStream, &mut cbAlpha);
        if err.is_err() {
            return err;
        }

        cbBytesCopied = 0;
        err = alpha_set_pos(&mut *pAlphaStream, 0);
        if err.is_err() {
            return err;
        }
        while cbBytesCopied < cbAlpha {
            let mut rgbBuf = [0_u8; TEMPFILE_COPYBUF_SIZE];
            let cbCopy = std::cmp::min(rgbBuf.len(), cbAlpha - cbBytesCopied);

            err = alpha_read(&mut *pAlphaStream, &mut rgbBuf[..cbCopy]);
            if err.is_err() {
                return err;
            }
            err = main_write(&mut *pMainStream, &rgbBuf[..cbCopy]);
            if err.is_err() {
                return err;
            }

            cbBytesCopied += cbCopy;
        }
        debug_assert_eq!(cbBytesCopied, cbAlpha);

        (*pIE).WMP.nOffAlpha = offAlpha as _;
        (*pIE).WMP.nCbAlpha = cbAlpha as _;
    }

    write_container_post(pIE)
}

/// Original function: `PKImageEncode_Transcode_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:1360`.
pub unsafe fn pk_image_encode_transcode_wmp(
    pIE: &mut tagPKImageEncode,
    pID: *mut tagPKImageDecode,
    pParam: *mut tagCWMTranscodingParam,
) -> Result<(), crate::WmpError> {
    let pIE = pIE as *mut tagPKImageEncode;
    let mut fResX: f32 = 0.0;
    let mut fResY: f32 = 0.0;
    let mut pixGUID = PKPixelFormatGUID::default();
    let mut tcParamAlpha = tagCWMTranscodingParam::default();
    let mut offPos: usize = 0;
    let fPlanarAlpha: i32;
    let mut PI = tagPKPixelInfo::default();

    let Some(get_pixel_format) = (*pID).GetPixelFormat else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(set_pixel_format) = (*pIE).SetPixelFormat else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(set_size) = (*pIE).SetSize else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(get_resolution) = (*pID).GetResolution else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(set_resolution) = (*pIE).SetResolution else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(get_raw_stream) = (*pID).GetRawStream else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(p_ws_enc) = (*pIE).pStream else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let pWSEnc = p_ws_enc.as_ptr();
    let Some(enc_get_pos) = (*pWSEnc).GetPos else {
        return Err(crate::WmpError::InvalidParameter);
    };

    let mut err = get_pixel_format(&mut *pID, Some(&mut pixGUID));
    if err.is_err() {
        return err;
    }
    err = set_pixel_format(&mut *pIE, pixGUID);
    if err.is_err() {
        return err;
    }

    err = set_size(&mut *pIE, (*pParam).cWidth as i32, (*pParam).cHeight as i32);
    if err.is_err() {
        return err;
    }

    err = get_resolution(&mut *pID, Some(&mut fResX), Some(&mut fResY));
    if err.is_err() {
        return err;
    }
    err = set_resolution(&mut *pIE, fResX, fResY);
    if err.is_err() {
        return err;
    }

    PI.pGUIDPixFmt = Some((*pIE).guidPixFormat);
    err = pixel_format_lookup(&mut PI, LOOKUP_FORWARD);
    if err.is_err() {
        return err;
    }
    let Some(alpha_mode) = AlphaMode::from_u8((*pParam).uAlphaMode) else {
        return Err(crate::WmpError::AlphaModeCannotBeTranscoded);
    };
    (*pIE).WMP.bHasAlpha = ((PI.grBit & PixelFormatFlags::HAS_ALPHA) != PixelFormatFlags::NONE)
        && alpha_mode == AlphaMode::Planar;
    debug_assert!(!(*pIE).WMP.bHasAlpha || alpha_mode == AlphaMode::Planar);

    PI.pGUIDPixFmt = Some(pixGUID);
    err = pixel_format_lookup(&mut PI, LOOKUP_FORWARD);
    if err.is_err() {
        return err;
    }
    if (PI.grBit & PixelFormatFlags::HAS_ALPHA) == PixelFormatFlags::NONE && alpha_mode.is_any() {
        return Err(crate::WmpError::AlphaModeCannotBeTranscoded);
    }
    if (PI.grBit & PixelFormatFlags::HAS_ALPHA) != PixelFormatFlags::NONE
        && alpha_mode == AlphaMode::Planar
        && !(*pID).WMP.bHasAlpha
    {
        return Err(crate::WmpError::AlphaModeCannotBeTranscoded);
    }
    if (PI.grBit & PixelFormatFlags::HAS_ALPHA) != PixelFormatFlags::NONE
        && alpha_mode == AlphaMode::Only
        && (*pID).WMP.bHasAlpha
    {
        return Err(crate::WmpError::AlphaModeCannotBeTranscoded);
    }

    fPlanarAlpha = ((*pIE).WMP.bHasAlpha && alpha_mode == AlphaMode::Planar) as i32;

    err = write_container_pre(pIE);
    if err.is_err() {
        return err;
    }

    if fPlanarAlpha != 0 {
        tcParamAlpha = (*pParam).clone();
    }

    let p_ws_dec = match get_raw_stream(&mut *pID) {
        Ok(p_ws_dec) => p_ws_dec,
        Err(err) => return Err(err),
    };
    let pWSDec = p_ws_dec.as_ptr();
    let Some(dec_set_pos) = (*pWSDec).SetPos else {
        return Err(crate::WmpError::InvalidParameter);
    };

    if wm_photo_transcode(pWSDec, pWSEnc, pParam).is_err() {
        return Err(crate::WmpError::Fail);
    }
    err = enc_get_pos(&mut *pWSEnc, &mut offPos);
    if err.is_err() {
        return err;
    }
    (*pIE).WMP.nCbImage = offPos as i64 - (*pIE).WMP.nOffImage;

    if fPlanarAlpha != 0 {
        (*pIE).WMP.nOffAlpha = offPos as _;

        debug_assert!((*pID).WMP.wmiDEMisc.uAlphaOffset > 0);
        err = dec_set_pos(&mut *pWSDec, (*pID).WMP.wmiDEMisc.uAlphaOffset as usize);
        if err.is_err() {
            return err;
        }

        if wm_photo_transcode(pWSDec, pWSEnc, std::ptr::addr_of_mut!(tcParamAlpha)).is_err() {
            return Err(crate::WmpError::Fail);
        }
        err = enc_get_pos(&mut *pWSEnc, &mut offPos);
        if err.is_err() {
            return err;
        }
        (*pIE).WMP.nCbAlpha = offPos as i64 - (*pIE).WMP.nOffAlpha;
    }

    write_container_post(pIE)
}

/// Original function: `PKImageEncode_CreateNewFrame_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:1438`.
pub unsafe fn pk_image_encode_create_new_frame_wmp(
    _pIE: &mut tagPKImageEncode,
) -> Result<(), crate::WmpError> {
    let err;

    err = Err(crate::WmpError::NotYetImplemented);

    err
}

/// Original function: `PKImageEncode_Create_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:1499`.
pub unsafe fn pk_image_encode_create_wmp_owned() -> Box<tagPKImageEncode> {
    let mut image_encode = pk_image_encode_create_owned();
    image_encode.Initialize = Some(pk_image_encode_initialize_wmp);
    image_encode.Terminate = Some(pk_image_encode_terminate_wmp);
    image_encode.SetColorContext = Some(pk_image_encode_set_color_context_wmp);
    image_encode.SetDescriptiveMetadata = Some(pk_image_encode_set_descriptive_metadata_wmp);
    image_encode.WritePixels = Some(pk_image_encode_write_pixels_wmp);

    image_encode.WritePixelsBandedBegin = Some(pk_image_encode_write_pixels_banded_begin_wmp);
    image_encode.WritePixelsBanded = Some(pk_image_encode_write_pixels_banded_wmp);
    image_encode.WritePixelsBandedEnd = Some(pk_image_encode_write_pixels_banded_end_wmp);

    image_encode.Transcode = Some(pk_image_encode_transcode_wmp);
    image_encode.CreateNewFrame = Some(pk_image_encode_create_new_frame_wmp);
    image_encode.bWMP = true;

    image_encode
}

/// Original function: `ParsePFDEntry` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:1531`.
pub unsafe fn parse_pfd_entry(
    pID: &mut tagPKImageDecode,
    uTag: u16,
    uType: u16,
    uCount: u32,
    uValue: u32,
) -> Result<(), crate::WmpError> {
    let err = Ok(());
    let mut err_tmp: Result<(), crate::WmpError>;
    let mut pi = tagPKPixelInfo::default();
    let id = &mut *pID;
    let Some(p_ws) = id.pStream.map(NonNull::as_ptr) else {
        return Err(crate::WmpError::InvalidParameter);
    };

    match uTag {
        WMP_tagPixelFormat => {
            let Some(read) = (*p_ws).Read else {
                return Err(crate::WmpError::InvalidParameter);
            };
            let guid = &mut id.guidPixFormat;
            err_tmp = get_u_long(&mut *p_ws, uValue as usize, Some(&mut guid.data1));
            if err_tmp.is_err() {
                return err_tmp;
            }
            err_tmp = get_u_short(&mut *p_ws, uValue as usize + 4, Some(&mut guid.data2));
            if err_tmp.is_err() {
                return err_tmp;
            }
            err_tmp = get_u_short(&mut *p_ws, uValue as usize + 6, Some(&mut guid.data3));
            if err_tmp.is_err() {
                return err_tmp;
            }
            err_tmp = read(&mut *p_ws, &mut guid.data4);
            if err_tmp.is_err() {
                return err_tmp;
            }

            pi.pGUIDPixFmt = Some(id.guidPixFormat);
            pixel_format_lookup(&mut pi, LOOKUP_FORWARD)?;

            id.WMP.bHasAlpha = (pi.grBit & PixelFormatFlags::HAS_ALPHA) != PixelFormatFlags::NONE;
            id.WMP.wmiI.cBitsPerUnit = pi.cbitUnit as usize;
            id.WMP.wmiI.bRGB =
                ((pi.grBit & PixelFormatFlags::BGR) == PixelFormatFlags::NONE) as i32;
        }
        WMP_tagTransformation => {
            if uCount != 1 {
                return Err(crate::WmpError::UnsupportedFormat);
            }
            let o_orientation = match uValue {
                0 => Orientation::None,
                1 => Orientation::FlipV,
                2 => Orientation::FlipH,
                3 => Orientation::FlipVH,
                4 => Orientation::RotateCw,
                5 => Orientation::RotateCwFlipV,
                6 => Orientation::RotateCwFlipH,
                7 => Orientation::RotateCwFlipVH,
                _ => return Err(crate::WmpError::UnsupportedFormat),
            };
            id.WMP.fOrientationFromContainer = true;
            id.WMP.oOrientationFromContainer = o_orientation;
        }
        WMP_tagImageWidth => {
            if uValue == 0 {
                return Err(crate::WmpError::UnsupportedFormat);
            }
        }
        WMP_tagImageHeight => {
            if uValue == 0 {
                return Err(crate::WmpError::UnsupportedFormat);
            }
        }
        WMP_tagImageOffset => {
            if uCount != 1 {
                return Err(crate::WmpError::UnsupportedFormat);
            }
            id.WMP.wmiDEMisc.uImageOffset = uValue;
        }
        WMP_tagImageByteCount => {
            if uCount != 1 {
                return Err(crate::WmpError::UnsupportedFormat);
            }
            id.WMP.wmiDEMisc.uImageByteCount = uValue;
        }
        WMP_tagAlphaOffset => {
            if uCount != 1 {
                return Err(crate::WmpError::UnsupportedFormat);
            }
            id.WMP.wmiDEMisc.uAlphaOffset = uValue;
        }
        WMP_tagAlphaByteCount => {
            if uCount != 1 {
                return Err(crate::WmpError::UnsupportedFormat);
            }
            id.WMP.wmiDEMisc.uAlphaByteCount = uValue;
        }
        WMP_tagWidthResolution => {
            if uCount != 1 {
                return Err(crate::WmpError::UnsupportedFormat);
            }
            id.fResX = f32::from_bits(uValue);
        }
        WMP_tagHeightResolution => {
            if uCount != 1 {
                return Err(crate::WmpError::UnsupportedFormat);
            }
            id.fResY = f32::from_bits(uValue);
        }
        WMP_tagIccProfile => {
            id.WMP.wmiDEMisc.uColorProfileByteCount = uCount;
            id.WMP.wmiDEMisc.uColorProfileOffset = uValue;
        }
        WMP_tagXMPMetadata => {
            id.WMP.wmiDEMisc.uXMPMetadataByteCount = uCount;
            id.WMP.wmiDEMisc.uXMPMetadataOffset = uValue;
        }
        WMP_tagEXIFMetadata => {
            id.WMP.wmiDEMisc.uEXIFMetadataOffset = uValue;
            err_tmp = stream_calc_ifd_size(
                p_ws,
                uValue,
                Some(&mut id.WMP.wmiDEMisc.uEXIFMetadataByteCount),
            );
            // C uses CallIgnoreError here: a metadata sizing/read failure is deliberately
            // ignored so it does not abort parsing of the remaining descriptive fields.
            let _ = err_tmp;
        }
        WMP_tagGPSInfoMetadata => {
            id.WMP.wmiDEMisc.uGPSInfoMetadataOffset = uValue;
            err_tmp = stream_calc_ifd_size(
                p_ws,
                uValue,
                Some(&mut id.WMP.wmiDEMisc.uGPSInfoMetadataByteCount),
            );
            // C uses CallIgnoreError here: a metadata sizing/read failure is deliberately
            // ignored so it does not abort parsing of the remaining descriptive fields.
            let _ = err_tmp;
        }
        WMP_tagIPTCNAAMetadata => {
            id.WMP.wmiDEMisc.uIPTCNAAMetadataByteCount = uCount;
            id.WMP.wmiDEMisc.uIPTCNAAMetadataOffset = uValue;
        }
        WMP_tagPhotoshopMetadata => {
            id.WMP.wmiDEMisc.uPhotoshopMetadataByteCount = uCount;
            id.WMP.wmiDEMisc.uPhotoshopMetadataOffset = uValue;
        }
        WMP_tagCompression
        | WMP_tagImageType
        | WMP_tagImageDataDiscard
        | WMP_tagAlphaDataDiscard => {}
        WMP_tagImageDescription => {
            err_tmp = read_propvar(
                p_ws,
                uType,
                uCount,
                uValue,
                &mut id.WMP.sDescMetadata.pvarImageDescription,
            );
            // C uses CallIgnoreError here: a metadata sizing/read failure is deliberately
            // ignored so it does not abort parsing of the remaining descriptive fields.
            let _ = err_tmp;
            debug_assert_eq!(
                id.WMP.sDescMetadata.pvarImageDescription.vt,
                DpkVarType::LpStr
            );
        }
        WMP_tagCameraMake => {
            err_tmp = read_propvar(
                p_ws,
                uType,
                uCount,
                uValue,
                &mut id.WMP.sDescMetadata.pvarCameraMake,
            );
            // C uses CallIgnoreError here: a metadata sizing/read failure is deliberately
            // ignored so it does not abort parsing of the remaining descriptive fields.
            let _ = err_tmp;
            debug_assert_eq!(id.WMP.sDescMetadata.pvarCameraMake.vt, DpkVarType::LpStr);
        }
        WMP_tagCameraModel => {
            err_tmp = read_propvar(
                p_ws,
                uType,
                uCount,
                uValue,
                &mut id.WMP.sDescMetadata.pvarCameraModel,
            );
            // C uses CallIgnoreError here: a metadata sizing/read failure is deliberately
            // ignored so it does not abort parsing of the remaining descriptive fields.
            let _ = err_tmp;
            debug_assert_eq!(id.WMP.sDescMetadata.pvarCameraModel.vt, DpkVarType::LpStr);
        }
        WMP_tagSoftware => {
            err_tmp = read_propvar(
                p_ws,
                uType,
                uCount,
                uValue,
                &mut id.WMP.sDescMetadata.pvarSoftware,
            );
            // C uses CallIgnoreError here: a metadata sizing/read failure is deliberately
            // ignored so it does not abort parsing of the remaining descriptive fields.
            let _ = err_tmp;
            debug_assert_eq!(id.WMP.sDescMetadata.pvarSoftware.vt, DpkVarType::LpStr);
        }
        WMP_tagDateTime => {
            err_tmp = read_propvar(
                p_ws,
                uType,
                uCount,
                uValue,
                &mut id.WMP.sDescMetadata.pvarDateTime,
            );
            // C uses CallIgnoreError here: a metadata sizing/read failure is deliberately
            // ignored so it does not abort parsing of the remaining descriptive fields.
            let _ = err_tmp;
            debug_assert_eq!(id.WMP.sDescMetadata.pvarDateTime.vt, DpkVarType::LpStr);
        }
        WMP_tagArtist => {
            err_tmp = read_propvar(
                p_ws,
                uType,
                uCount,
                uValue,
                &mut id.WMP.sDescMetadata.pvarArtist,
            );
            // C uses CallIgnoreError here: a metadata sizing/read failure is deliberately
            // ignored so it does not abort parsing of the remaining descriptive fields.
            let _ = err_tmp;
            debug_assert_eq!(id.WMP.sDescMetadata.pvarArtist.vt, DpkVarType::LpStr);
        }
        WMP_tagCopyright => {
            err_tmp = read_propvar(
                p_ws,
                uType,
                uCount,
                uValue,
                &mut id.WMP.sDescMetadata.pvarCopyright,
            );
            // C uses CallIgnoreError here: a metadata sizing/read failure is deliberately
            // ignored so it does not abort parsing of the remaining descriptive fields.
            let _ = err_tmp;
            debug_assert_eq!(id.WMP.sDescMetadata.pvarCopyright.vt, DpkVarType::LpStr);
        }
        WMP_tagRatingStars => {
            err_tmp = read_propvar(
                p_ws,
                uType,
                uCount,
                uValue,
                &mut id.WMP.sDescMetadata.pvarRatingStars,
            );
            // C uses CallIgnoreError here: a metadata sizing/read failure is deliberately
            // ignored so it does not abort parsing of the remaining descriptive fields.
            let _ = err_tmp;
            debug_assert_eq!(id.WMP.sDescMetadata.pvarRatingStars.vt, DpkVarType::Ui2);
        }
        WMP_tagRatingValue => {
            err_tmp = read_propvar(
                p_ws,
                uType,
                uCount,
                uValue,
                &mut id.WMP.sDescMetadata.pvarRatingValue,
            );
            // C uses CallIgnoreError here: a metadata sizing/read failure is deliberately
            // ignored so it does not abort parsing of the remaining descriptive fields.
            let _ = err_tmp;
            debug_assert_eq!(id.WMP.sDescMetadata.pvarRatingValue.vt, DpkVarType::Ui2);
        }
        WMP_tagCaption => {
            err_tmp = read_propvar(
                p_ws,
                uType,
                uCount,
                uValue,
                &mut id.WMP.sDescMetadata.pvarCaption,
            );
            if err_tmp.is_err() {
                return Ok(());
            }
            let caption = &mut id.WMP.sDescMetadata.pvarCaption;
            if caption.vt != DpkVarType::ByRefUi1 {
                return Ok(());
            }
            let DpkPropVariantValue::Bytes(bytes) = &caption.value else {
                return Ok(());
            };
            if uCount == 0
                || bytes.len() < uCount as usize
                || uCount as usize % std::mem::size_of::<u16>() != 0
            {
                return Ok(());
            }
            let cch = uCount as usize / std::mem::size_of::<u16>();
            let mut wide = Vec::new();
            if wide.try_reserve_exact(cch + 1).is_err() {
                return Err(crate::WmpError::OutOfMemory);
            }
            for bytes in bytes[..uCount as usize].chunks_exact(std::mem::size_of::<u16>()) {
                wide.push(u16::from_le_bytes([bytes[0], bytes[1]]));
            }
            if wide.last().copied() != Some(0) {
                return Ok(());
            }
            wide.push(0);
            caption.vt = DpkVarType::LpWStr;
            caption.value = DpkPropVariantValue::Wide(wide);
        }
        WMP_tagDocumentName => {
            err_tmp = read_propvar(
                p_ws,
                uType,
                uCount,
                uValue,
                &mut id.WMP.sDescMetadata.pvarDocumentName,
            );
            // C uses CallIgnoreError here: a metadata sizing/read failure is deliberately
            // ignored so it does not abort parsing of the remaining descriptive fields.
            let _ = err_tmp;
            debug_assert_eq!(id.WMP.sDescMetadata.pvarDocumentName.vt, DpkVarType::LpStr);
        }
        WMP_tagPageName => {
            err_tmp = read_propvar(
                p_ws,
                uType,
                uCount,
                uValue,
                &mut id.WMP.sDescMetadata.pvarPageName,
            );
            // C uses CallIgnoreError here: a metadata sizing/read failure is deliberately
            // ignored so it does not abort parsing of the remaining descriptive fields.
            let _ = err_tmp;
            debug_assert_eq!(id.WMP.sDescMetadata.pvarPageName.vt, DpkVarType::LpStr);
        }
        WMP_tagPageNumber => {
            err_tmp = read_propvar(
                p_ws,
                uType,
                uCount,
                uValue,
                &mut id.WMP.sDescMetadata.pvarPageNumber,
            );
            // C uses CallIgnoreError here: a metadata sizing/read failure is deliberately
            // ignored so it does not abort parsing of the remaining descriptive fields.
            let _ = err_tmp;
            debug_assert_eq!(id.WMP.sDescMetadata.pvarPageNumber.vt, DpkVarType::Ui4);
        }
        WMP_tagHostComputer => {
            err_tmp = read_propvar(
                p_ws,
                uType,
                uCount,
                uValue,
                &mut id.WMP.sDescMetadata.pvarHostComputer,
            );
            // C uses CallIgnoreError here: a metadata sizing/read failure is deliberately
            // ignored so it does not abort parsing of the remaining descriptive fields.
            let _ = err_tmp;
            debug_assert_eq!(id.WMP.sDescMetadata.pvarHostComputer.vt, DpkVarType::LpStr);
        }
        _ => {}
    }

    err
}

/// Original function: `ParsePFD` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:1760`.
pub unsafe fn parse_pfd(
    pID: &mut tagPKImageDecode,
    mut offPos: usize,
    cEntry: u16,
) -> Result<(), crate::WmpError> {
    let err = Ok(());
    let Some(p_ws) = pID.pStream.map(NonNull::as_ptr) else {
        return Err(crate::WmpError::InvalidParameter);
    };

    for _ in 0..cEntry {
        let mut u_tag: u16 = 0;
        let mut u_type: u16 = 0;
        let mut u_count: u32 = 0;
        let mut u_value: u32 = 0;

        let mut e: Result<(), crate::WmpError> = get_u_short(&mut *p_ws, offPos, Some(&mut u_tag));
        if e.is_err() {
            return e;
        }
        let Some(next_off) = offPos.checked_add(2) else {
            return Err(crate::WmpError::BufferOverflow);
        };
        offPos = next_off;
        e = get_u_short(&mut *p_ws, offPos, Some(&mut u_type));
        if e.is_err() {
            return e;
        }
        let Some(next_off) = offPos.checked_add(2) else {
            return Err(crate::WmpError::BufferOverflow);
        };
        offPos = next_off;
        e = get_u_long(&mut *p_ws, offPos, Some(&mut u_count));
        if e.is_err() {
            return e;
        }
        let Some(next_off) = offPos.checked_add(4) else {
            return Err(crate::WmpError::BufferOverflow);
        };
        offPos = next_off;
        e = get_u_long(&mut *p_ws, offPos, Some(&mut u_value));
        if e.is_err() {
            return e;
        }
        let Some(next_off) = offPos.checked_add(4) else {
            return Err(crate::WmpError::BufferOverflow);
        };
        offPos = next_off;

        e = parse_pfd_entry(pID, u_tag, u_type, u_count, u_value);
        if e.is_err() {
            return e;
        }
    }

    pID.WMP.bHasAlpha = pID.WMP.bHasAlpha
        && pID.WMP.wmiDEMisc.uAlphaOffset != 0
        && pID.WMP.wmiDEMisc.uAlphaByteCount != 0;

    err
}

/// Original function: `ReadContainer` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:1790`.
pub unsafe fn read_container(pID: &mut tagPKImageDecode) -> Result<(), crate::WmpError> {
    let mut err: Result<(), crate::WmpError>;

    let Some(p_ws) = pID.pStream.map(NonNull::as_ptr) else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(get_pos) = (*p_ws).GetPos else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(read) = (*p_ws).Read else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(set_pos) = (*p_ws).SetPos else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let mut off_pos: usize = 0;

    let mut sz_sig = [0_u8; 2];
    let mut u_wmp_id: u16 = 0;
    let mut off_pfd: u32 = 0;
    let mut c_pfd_entry: u16 = 0;
    let b_version: u8;

    err = get_pos(&mut *p_ws, &mut off_pos);
    if err.is_err() {
        return err;
    }
    if off_pos != 0 {
        return Err(crate::WmpError::UnsupportedFormat);
    }

    err = read(&mut *p_ws, &mut sz_sig);
    if err.is_err() {
        return err;
    }
    off_pos += 2;
    if sz_sig[0] != b'I' || sz_sig[1] != b'I' {
        return Err(crate::WmpError::UnsupportedFormat);
    }

    err = get_u_short(&mut *p_ws, off_pos, Some(&mut u_wmp_id));
    if err.is_err() {
        return err;
    }
    off_pos += 2;
    if WMP_valWMPhotoID != (0x00ff & u_wmp_id) {
        return Err(crate::WmpError::UnsupportedFormat);
    }

    b_version = ((0xff00 & u_wmp_id) >> 8) as u8;
    if b_version != 0 && b_version != 1 {
        return Err(crate::WmpError::UnsupportedFormat);
    }

    err = get_u_long(&mut *p_ws, off_pos, Some(&mut off_pfd));
    if err.is_err() {
        return err;
    }

    off_pos = off_pfd as usize;
    err = get_u_short(&mut *p_ws, off_pos, Some(&mut c_pfd_entry));
    if err.is_err() {
        return err;
    }
    off_pos += 2;
    if c_pfd_entry == 0 || c_pfd_entry == u16::MAX {
        return Err(crate::WmpError::UnsupportedFormat);
    }
    err = parse_pfd(pID, off_pos, c_pfd_entry);
    if err.is_err() {
        return err;
    }

    err = set_pos(&mut *p_ws, pID.WMP.wmiDEMisc.uImageOffset as usize);
    if err.is_err() {
        return err;
    }

    err
}

/// Original function: `PKImageDecode_Initialize_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:1838`.
pub unsafe fn pk_image_decode_initialize_wmp(
    pID: &mut tagPKImageDecode,
    pWS: &mut WMPStream,
) -> Result<(), crate::WmpError> {
    let mut err = pk_image_decode_initialize(&mut *pID, &mut *pWS);
    if err.is_err() {
        return err;
    }

    err = read_container(pID);
    if err.is_err() {
        return err;
    }

    pID.WMP.wmiSCP.pWStream = Some(NonNull::from(pWS));
    pID.WMP.DecoderCurrMBRow = 0;
    pID.WMP.cLinesDecoded = 0;
    pID.WMP.cLinesCropped = 0;
    pID.WMP.fFirstNonZeroDecode = false;

    if image_str_dec_get_info(
        std::ptr::addr_of_mut!(pID.WMP.wmiI),
        std::ptr::addr_of_mut!(pID.WMP.wmiSCP),
    )
    .is_err()
    {
        return Err(crate::WmpError::Fail);
    }
    debug_assert!(ColorFormat::YOnly <= pID.WMP.wmiSCP.cfColorFormat);
    debug_assert!(pID.WMP.wmiSCP.cfColorFormat < ColorFormat::Max);
    debug_assert!(
        pID.WMP.wmiSCP.bdBitDepth == BitDepthLayout::Short
            || pID.WMP.wmiSCP.bdBitDepth == BitDepthLayout::Long
    );

    if pID.WMP.fOrientationFromContainer {
        pID.WMP.wmiI.oOrientation = pID.WMP.oOrientationFromContainer;
    } else {
        pID.WMP.wmiI.oOrientation = Orientation::None;
    }

    let p_ii = std::ptr::addr_of_mut!(pID.WMP.wmiI);
    pID.uWidth = (*p_ii).cWidth as u32;
    pID.uHeight = (*p_ii).cHeight as u32;

    err
}

/// Original function: `PKImageDecode_GetSize_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:1885`.
pub unsafe fn pk_image_decode_get_size_wmp(
    pID: &mut tagPKImageDecode,
    piWidth: Option<&mut i32>,
    piHeight: Option<&mut i32>,
) -> Result<(), crate::WmpError> {
    let Some(width) = piWidth else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(height) = piHeight else {
        return Err(crate::WmpError::InvalidParameter);
    };
    if pID.WMP.wmiI.oOrientation >= Orientation::RotateCw {
        *width = pID.uHeight as i32;
        *height = pID.uWidth as i32;
    } else {
        *width = pID.uWidth as i32;
        *height = pID.uHeight as i32;
    }
    Ok(())
}

/// Original function: `PKImageDecode_GetRawStream_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:1904`.
pub unsafe fn pk_image_decode_get_raw_stream_wmp(
    pID: &mut tagPKImageDecode,
) -> Result<NonNull<WMPStream>, crate::WmpError> {
    let Some(p_ws) = pID.pStream else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let pWS = p_ws.as_ptr();
    let Some(set_pos) = (*pWS).SetPos else {
        return Err(crate::WmpError::InvalidParameter);
    };
    if let Err(err) = set_pos(&mut *pWS, pID.WMP.wmiDEMisc.uImageOffset as usize) {
        return Err(err);
    }

    Ok(p_ws)
}

/// Original function: `PKImageDecode_Copy_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:1919`.
pub unsafe fn pk_image_decode_copy_wmp(
    pID: &mut tagPKImageDecode,
    pRect: Option<&tagPKRect>,
    pb: &mut [u8],
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let mut err = Ok(());
    let mut c_thumbnail_scale: u32;
    let _lines_per_mb_row: u32;
    let mut wmi_bi = tagCWMImageBufferInfo::default();
    let Some(p_ws) = pID.pStream.map(NonNull::as_ptr) else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let temp_alpha_mode: u8;
    let Some(set_pos) = (*p_ws).SetPos else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(rect) = pRect else {
        return Err(crate::WmpError::InvalidParameter);
    };
    if rect.Width <= 0 || rect.Height <= 0 || cbStride == 0 {
        return Err(crate::WmpError::InvalidParameter);
    }
    let bytes_per_pixel = pID.WMP.wmiI.cBitsPerUnit.div_ceil(8);
    if bytes_per_pixel == 0 {
        return Err(crate::WmpError::UnsupportedFormat);
    }
    let row_bytes = (rect.Width as usize)
        .checked_mul(bytes_per_pixel)
        .ok_or(crate::WmpError::BufferOverflow)?;
    if (cbStride as usize) < row_bytes {
        return Err(crate::WmpError::BufferOverflow);
    }
    let required_len = (cbStride as usize)
        .checked_mul(rect.Height as usize)
        .ok_or(crate::WmpError::BufferOverflow)?;
    if pb.len() < required_len {
        return Err(crate::WmpError::BufferOverflow);
    }

    wmi_bi.pv = NonNull::new(pb.as_mut_ptr());
    wmi_bi.cLine = rect.Height as usize;
    wmi_bi.cbStride = cbStride as usize;

    if rect.X != 0 {
        return Err(crate::WmpError::InvalidParameter);
    }
    if rect.Y != 0 {
        return Err(crate::WmpError::InvalidParameter);
    }

    c_thumbnail_scale = 1;
    if pID.WMP.wmiI.cThumbnailWidth > 0 {
        while (c_thumbnail_scale as usize) * pID.WMP.wmiI.cThumbnailWidth < pID.uWidth as usize {
            c_thumbnail_scale <<= 1;
        }
    }
    _lines_per_mb_row = 16 / c_thumbnail_scale;

    if 0 == ((pb.as_ptr() as usize) % 128)
        && 0 == (rect.Height % 16)
        && 0 == (rect.Width % 16)
        && 0 == (cbStride % 128)
    {
        pID.WMP.wmiI.fPaddedUserBuffer = 1;
    }

    if !pID.WMP.bHasAlpha
        || AlphaMode::from_u8(pID.WMP.wmiSCP.uAlphaMode) != Some(AlphaMode::Interleaved)
    {
        if pID.WMP.bHasAlpha {
            temp_alpha_mode = pID.WMP.wmiSCP.uAlphaMode;
            pID.WMP.wmiSCP.uAlphaMode = AlphaMode::None as u8;
        } else {
            temp_alpha_mode = AlphaMode::None as u8;
        }
        pID.WMP.wmiSCP.fMeasurePerf = 0;

        let mut ctx_sc = None;
        if image_str_dec_init(
            std::ptr::addr_of_mut!(pID.WMP.wmiI),
            std::ptr::addr_of_mut!(pID.WMP.wmiSCP),
            &mut ctx_sc,
        )
        .is_err()
        {
            return Err(crate::WmpError::Fail);
        }
        let Some(ctx_sc) = ctx_sc else {
            return Err(crate::WmpError::Fail);
        };
        pID.WMP.ctxSC = Some(ctx_sc);
        let Some(ctx_sc) = pID.WMP.ctxSC.as_mut() else {
            return Err(crate::WmpError::Fail);
        };
        if image_str_dec_decode(ctx_sc.as_mut(), std::ptr::addr_of!(wmi_bi)).is_err() {
            return Err(crate::WmpError::Fail);
        }
        let Some(ctx_sc) = pID.WMP.ctxSC.take() else {
            return Err(crate::WmpError::Fail);
        };
        if image_str_dec_term(ctx_sc).is_err() {
            return Err(crate::WmpError::Fail);
        }

        if pID.WMP.bHasAlpha {
            pID.WMP.wmiSCP.uAlphaMode = temp_alpha_mode;
        }
    }

    if pID.WMP.bHasAlpha && AlphaMode::from_u8(pID.WMP.wmiSCP.uAlphaMode) != Some(AlphaMode::None) {
        pID.WMP.wmiI_Alpha = pID.WMP.wmiI;
        pID.WMP.wmiSCP_Alpha = pID.WMP.wmiSCP;

        pID.WMP.wmiI_Alpha.cfColorFormat = ColorFormat::YOnly;

        match pID.WMP.wmiI.bdBitDepth {
            BitDepth::Eight => {
                pID.WMP.wmiI_Alpha.cLeadingPadding += (pID.WMP.wmiI.cBitsPerUnit >> 3) - 1;
            }
            BitDepth::Sixteen | BitDepth::SixteenS | BitDepth::SixteenF => {
                pID.WMP.wmiI_Alpha.cLeadingPadding +=
                    (pID.WMP.wmiI.cBitsPerUnit >> 3) / std::mem::size_of::<u16>() - 1;
            }
            BitDepth::ThirtyTwo | BitDepth::ThirtyTwoS | BitDepth::ThirtyTwoF => {
                pID.WMP.wmiI_Alpha.cLeadingPadding +=
                    (pID.WMP.wmiI.cBitsPerUnit >> 3) / std::mem::size_of::<f32>() - 1;
            }
            BitDepth::Five | BitDepth::Ten | BitDepth::FiveSixFive => {}
            _ => {}
        }

        pID.WMP.wmiSCP_Alpha.fMeasurePerf = 0;
        err = set_pos(&mut *p_ws, pID.WMP.wmiDEMisc.uAlphaOffset as usize);
        if err.is_err() {
            return err;
        }

        let mut ctx_sc_alpha = None;
        if image_str_dec_init(
            std::ptr::addr_of_mut!(pID.WMP.wmiI_Alpha),
            std::ptr::addr_of_mut!(pID.WMP.wmiSCP_Alpha),
            &mut ctx_sc_alpha,
        )
        .is_err()
        {
            return Err(crate::WmpError::Fail);
        }
        let Some(ctx_sc_alpha) = ctx_sc_alpha else {
            return Err(crate::WmpError::Fail);
        };
        pID.WMP.ctxSC_Alpha = Some(ctx_sc_alpha);
        let Some(ctx_sc_alpha) = pID.WMP.ctxSC_Alpha.as_mut() else {
            return Err(crate::WmpError::Fail);
        };
        if image_str_dec_decode(ctx_sc_alpha.as_mut(), std::ptr::addr_of!(wmi_bi)).is_err() {
            return Err(crate::WmpError::Fail);
        }
        let Some(ctx_sc_alpha) = pID.WMP.ctxSC_Alpha.take() else {
            return Err(crate::WmpError::Fail);
        };
        if image_str_dec_term(ctx_sc_alpha).is_err() {
            return Err(crate::WmpError::Fail);
        }
    }

    pID.idxCurrentLine = pID.idxCurrentLine.wrapping_add(rect.Height as u32);

    err
}

/// Original function: `PKImageDecode_GetMetadata_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:2153`.
pub unsafe fn pk_image_decode_get_metadata_wmp(
    pID: &mut tagPKImageDecode,
    uOffset: u32,
    uByteCount: u32,
    pbGot: Option<&mut [u8]>,
    pcbGot: Option<&mut u32>,
) -> Result<(), crate::WmpError> {
    let mut err = Ok(());
    let Some(got_count) = pcbGot else {
        return Err(crate::WmpError::InvalidParameter);
    };

    if let Some(got) = pbGot.filter(|_| uOffset != 0) {
        let Some(pWS) = pID.pStream.map(NonNull::as_ptr) else {
            return Err(crate::WmpError::InvalidParameter);
        };
        let mut iCurrPos = 0usize;
        let Some(get_pos) = (*pWS).GetPos else {
            return Err(crate::WmpError::InvalidParameter);
        };
        let Some(set_pos) = (*pWS).SetPos else {
            return Err(crate::WmpError::InvalidParameter);
        };
        let Some(read) = (*pWS).Read else {
            return Err(crate::WmpError::InvalidParameter);
        };

        if *got_count < uByteCount || got.len() < uByteCount as usize {
            err = Err(crate::WmpError::BufferOverflow);
        } else {
            err = get_pos(&mut *pWS, &mut iCurrPos);
            if err.is_ok() {
                err = set_pos(&mut *pWS, uOffset as usize);
            }
            if err.is_ok() {
                err = read(&mut *pWS, &mut got[..uByteCount as usize]);
                if err.is_err() {
                    let restore_err = set_pos(&mut *pWS, iCurrPos);
                    if restore_err.is_err() {
                        err = restore_err;
                    }
                }
            }
            if err.is_ok() {
                err = set_pos(&mut *pWS, iCurrPos);
            }
        }
    }

    if err.is_err() {
        *got_count = 0;
    } else {
        *got_count = uByteCount;
    }

    err
}

/// Original function: `PKImageDecode_GetColorContext_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:2180`.
pub unsafe fn pk_image_decode_get_color_context_wmp(
    pID: &mut tagPKImageDecode,
    pbColorContext: Option<&mut [u8]>,
    pcbColorContext: Option<&mut u32>,
) -> Result<(), crate::WmpError> {
    let offset = pID.WMP.wmiDEMisc.uColorProfileOffset;
    let byte_count = pID.WMP.wmiDEMisc.uColorProfileByteCount;
    pk_image_decode_get_metadata_wmp(pID, offset, byte_count, pbColorContext, pcbColorContext)
}

/// Original function: `PKImageDecode_GetXMPMetadata_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:2187`.
pub unsafe fn pk_image_decode_get_xmpmetadata_wmp(
    pID: &mut tagPKImageDecode,
    pbXMPMetadata: Option<&mut [u8]>,
    pcbXMPMetadata: Option<&mut u32>,
) -> Result<(), crate::WmpError> {
    let offset = pID.WMP.wmiDEMisc.uXMPMetadataOffset;
    let byte_count = pID.WMP.wmiDEMisc.uXMPMetadataByteCount;
    pk_image_decode_get_metadata_wmp(pID, offset, byte_count, pbXMPMetadata, pcbXMPMetadata)
}

/// Original function: `PKImageDecode_GetEXIFMetadata_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:2194`.
pub unsafe fn pk_image_decode_get_exifmetadata_wmp(
    pID: &mut tagPKImageDecode,
    pbEXIFMetadata: Option<&mut [u8]>,
    pcbEXIFMetadata: Option<&mut u32>,
) -> Result<(), crate::WmpError> {
    let offset = pID.WMP.wmiDEMisc.uEXIFMetadataOffset;
    let byte_count = pID.WMP.wmiDEMisc.uEXIFMetadataByteCount;
    pk_image_decode_get_metadata_wmp(pID, offset, byte_count, pbEXIFMetadata, pcbEXIFMetadata)
}

/// Original function: `PKImageDecode_GetGPSInfoMetadata_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:2201`.
pub unsafe fn pk_image_decode_get_gpsinfo_metadata_wmp(
    pID: &mut tagPKImageDecode,
    pbGPSInfoMetadata: Option<&mut [u8]>,
    pcbGPSInfoMetadata: Option<&mut u32>,
) -> Result<(), crate::WmpError> {
    let offset = pID.WMP.wmiDEMisc.uGPSInfoMetadataOffset;
    let byte_count = pID.WMP.wmiDEMisc.uGPSInfoMetadataByteCount;
    pk_image_decode_get_metadata_wmp(
        pID,
        offset,
        byte_count,
        pbGPSInfoMetadata,
        pcbGPSInfoMetadata,
    )
}

/// Original function: `PKImageDecode_GetIPTCNAAMetadata_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:2208`.
pub unsafe fn pk_image_decode_get_iptcna_metadata_wmp(
    pID: &mut tagPKImageDecode,
    pbIPTCNAAMetadata: Option<&mut [u8]>,
    pcbIPTCNAAMetadata: Option<&mut u32>,
) -> Result<(), crate::WmpError> {
    let offset = pID.WMP.wmiDEMisc.uIPTCNAAMetadataOffset;
    let byte_count = pID.WMP.wmiDEMisc.uIPTCNAAMetadataByteCount;
    pk_image_decode_get_metadata_wmp(
        pID,
        offset,
        byte_count,
        pbIPTCNAAMetadata,
        pcbIPTCNAAMetadata,
    )
}

/// Original function: `PKImageDecode_GetPhotoshopMetadata_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:2215`.
pub unsafe fn pk_image_decode_get_photoshop_metadata_wmp(
    pID: &mut tagPKImageDecode,
    pbPhotoshopMetadata: Option<&mut [u8]>,
    pcbPhotoshopMetadata: Option<&mut u32>,
) -> Result<(), crate::WmpError> {
    let offset = pID.WMP.wmiDEMisc.uPhotoshopMetadataOffset;
    let byte_count = pID.WMP.wmiDEMisc.uPhotoshopMetadataByteCount;
    pk_image_decode_get_metadata_wmp(
        pID,
        offset,
        byte_count,
        pbPhotoshopMetadata,
        pcbPhotoshopMetadata,
    )
}

/// Original function: `PKImageDecode_GetDescriptiveMetadata_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:2222`.
pub unsafe fn pk_image_decode_get_descriptive_metadata_wmp(
    pID: &mut tagPKImageDecode,
    pDescMetadata: Option<&mut DESCRIPTIVEMETADATA>,
) -> Result<(), crate::WmpError> {
    let err = Ok(());
    let Some(desc_metadata) = pDescMetadata else {
        return Err(crate::WmpError::InvalidParameter);
    };

    *desc_metadata = pID.WMP.sDescMetadata.clone();
    err
}

/// Original function: `PKImageDecode_Create_WMP` at `original/jxrlib/jxrgluelib/JXRGlueJxr.c:2265`.
pub unsafe fn pk_image_decode_create_wmp_owned() -> Box<tagPKImageDecode> {
    let mut image_decode = pk_image_decode_create_owned();
    image_decode.Initialize = Some(pk_image_decode_initialize_wmp);
    image_decode.GetSize = Some(pk_image_decode_get_size_wmp);
    image_decode.GetRawStream = Some(pk_image_decode_get_raw_stream_wmp);
    image_decode.Copy = Some(pk_image_decode_copy_wmp);
    image_decode.GetColorContext = Some(pk_image_decode_get_color_context_wmp);
    image_decode.GetDescriptiveMetadata = Some(pk_image_decode_get_descriptive_metadata_wmp);

    image_decode
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::image::sys::strcodec::{
        create_ws_memory_owned, get_pos_ws_memory, set_pos_ws_memory,
    };
    use crate::jxrgluelib::jxrglue::GUID_PKPixelFormat8bppGray;
    use crate::jxrgluelib::jxrmeta::{DpkPropVariantValue, DpkVarType};

    #[test]
    fn metadata_size_string_helpers_match_original_offset_thresholds() {
        let short_ascii = b"abc\0";
        let long_ascii = b"abcd\0";
        let short_wide: [u16; 2] = [0x41, 0];
        let long_wide: [u16; 3] = [0x41, 0x42, 0];
        let mut inactive = 7;
        let mut offset = 100;
        let mut count = 99;

        unsafe {
            calc_metadata_size_lpstr(
                &DPKPROPVARIANT {
                    vt: DpkVarType::LpStr,
                    value: DpkPropVariantValue::Bytes(short_ascii.to_vec()),
                },
                &mut inactive,
                &mut offset,
                Some(&mut count),
            );
            assert_eq!(inactive, 7);
            assert_eq!(offset, 100);
            assert_eq!(count, 4);

            calc_metadata_size_lpstr(
                &DPKPROPVARIANT {
                    vt: DpkVarType::LpStr,
                    value: DpkPropVariantValue::Bytes(long_ascii.to_vec()),
                },
                &mut inactive,
                &mut offset,
                None,
            );
            assert_eq!(offset, 105);

            calc_metadata_size_lpwstr(
                &DPKPROPVARIANT {
                    vt: DpkVarType::LpWStr,
                    value: DpkPropVariantValue::Wide(short_wide.to_vec()),
                },
                &mut inactive,
                &mut offset,
                Some(&mut count),
            );
            assert_eq!(offset, 105);
            assert_eq!(count, 4);

            calc_metadata_size_lpwstr(
                &DPKPROPVARIANT {
                    vt: DpkVarType::LpWStr,
                    value: DpkPropVariantValue::Wide(long_wide.to_vec()),
                },
                &mut inactive,
                &mut offset,
                Some(&mut count),
            );
            assert_eq!(offset, 111);
            assert_eq!(count, 6);
        }
    }

    #[test]
    fn metadata_size_scalar_helpers_only_count_empty_entries() {
        let mut inactive = 3;
        let mut metadata_size = 77;

        unsafe {
            calc_metadata_size_ui2(
                &DPKPROPVARIANT {
                    vt: DpkVarType::Ui2,
                    value: DpkPropVariantValue::Ui2(5),
                },
                &mut inactive,
                &mut metadata_size,
            );
            calc_metadata_size_ui4(
                &DPKPROPVARIANT {
                    vt: DpkVarType::Ui4,
                    value: DpkPropVariantValue::Ui4(9),
                },
                &mut inactive,
                &mut metadata_size,
            );
            assert_eq!(inactive, 3);
            assert_eq!(metadata_size, 77);

            calc_metadata_size_lpstr(
                &DPKPROPVARIANT {
                    vt: DpkVarType::Empty,
                    value: DpkPropVariantValue::Empty,
                },
                &mut inactive,
                &mut metadata_size,
                None,
            );
            calc_metadata_size_lpwstr(
                &DPKPROPVARIANT {
                    vt: DpkVarType::Empty,
                    value: DpkPropVariantValue::Empty,
                },
                &mut inactive,
                &mut metadata_size,
                None,
            );
            calc_metadata_size_ui2(
                &DPKPROPVARIANT {
                    vt: DpkVarType::Empty,
                    value: DpkPropVariantValue::Empty,
                },
                &mut inactive,
                &mut metadata_size,
            );
            calc_metadata_size_ui4(
                &DPKPROPVARIANT {
                    vt: DpkVarType::Empty,
                    value: DpkPropVariantValue::Empty,
                },
                &mut inactive,
                &mut metadata_size,
            );
            assert_eq!(inactive, 7);
            assert_eq!(metadata_size, 77);
        }
    }

    #[test]
    fn write_desc_metadata_writes_page_number_as_ui4_long_entry() {
        let mut backing = [0_u8; 32];
        let mut wmp_de = tagWmpDE {
            uTag: WMP_tagPageNumber,
            uType: WMP_typLONG,
            uCount: u32::MAX,
            uValueOrOffset: u32::MAX,
        };
        let var = DPKPROPVARIANT {
            vt: DpkVarType::Ui4,
            value: DpkPropVariantValue::Ui4(0x0102_0304),
        };
        let mut curr_offset = 0;
        let mut off_pos = 0;

        unsafe {
            let mut stream = create_ws_memory_owned(Some(&mut backing));
            let mut encoder = tagPKImageEncode {
                pStream: Some(NonNull::from(&mut *stream)),
                ..Default::default()
            };
            encoder.WMP.wmiDEMisc.uDescMetadataOffset = 16;
            encoder.WMP.wmiDEMisc.uDescMetadataByteCount = 4;

            assert_eq!(
                write_desc_metadata(
                    &mut encoder,
                    &var,
                    &mut wmp_de,
                    &mut curr_offset,
                    &mut off_pos,
                ),
                Ok(())
            );
            drop(stream);
        }

        assert_eq!(wmp_de.uType, WMP_typLONG);
        assert_eq!(wmp_de.uCount, 1);
        assert_eq!(curr_offset, 0);
        assert_eq!(off_pos, 12);
        assert_eq!(
            &backing[..12],
            &[0x29, 0x01, 0x04, 0x00, 1, 0, 0, 0, 4, 3, 2, 1]
        );
    }

    #[test]
    fn desc_metadata_copy_and_free_match_variant_rules() {
        let ascii = b"camera\0";
        let wide: [u16; 4] = [0x41, 0x42, 0x43, 0];
        let mut dst = DPKPROPVARIANT {
            vt: DpkVarType::Ui4,
            value: DpkPropVariantValue::Ui4(0xdeadbeef),
        };

        unsafe {
            assert_eq!(
                copy_desc_metadata(
                    &mut dst,
                    &DPKPROPVARIANT {
                        vt: DpkVarType::LpStr,
                        value: DpkPropVariantValue::Bytes(ascii.to_vec()),
                    },
                ),
                Ok(())
            );
            assert_eq!(dst.vt, DpkVarType::LpStr);
            let DpkPropVariantValue::Bytes(dst_bytes) = &dst.value else {
                panic!("missing copied byte metadata")
            };
            assert_eq!(dst_bytes, ascii);
            dst = DPKPROPVARIANT::default();
            assert_eq!(dst.value, DpkPropVariantValue::Empty);

            assert_eq!(
                copy_desc_metadata(
                    &mut dst,
                    &DPKPROPVARIANT {
                        vt: DpkVarType::LpWStr,
                        value: DpkPropVariantValue::Wide(wide.to_vec()),
                    },
                ),
                Ok(())
            );
            assert_eq!(dst.vt, DpkVarType::LpWStr);
            let DpkPropVariantValue::Wide(dst_wide) = &dst.value else {
                panic!("missing copied wide metadata")
            };
            assert_eq!(dst_wide, &wide);
            dst = DPKPROPVARIANT::default();
            assert_eq!(dst.value, DpkPropVariantValue::Empty);

            assert_eq!(
                copy_desc_metadata(
                    &mut dst,
                    &DPKPROPVARIANT {
                        vt: DpkVarType::Ui2,
                        value: DpkPropVariantValue::Ui2(0x1234),
                    },
                ),
                Ok(())
            );
            assert_eq!(dst.vt, DpkVarType::Ui2);
            assert_eq!(dst.value, DpkPropVariantValue::Ui2(0x1234));

            assert_eq!(
                copy_desc_metadata(
                    &mut dst,
                    &DPKPROPVARIANT {
                        vt: DpkVarType::Ui4,
                        value: DpkPropVariantValue::Ui4(0xabcdef01),
                    },
                ),
                Ok(())
            );
            assert_eq!(dst.vt, DpkVarType::Ui4);
            assert_eq!(dst.value, DpkPropVariantValue::Ui4(0xabcdef01));

            assert_eq!(
                copy_desc_metadata(
                    &mut dst,
                    &DPKPROPVARIANT {
                        vt: DpkVarType::Empty,
                        value: DpkPropVariantValue::Empty,
                    },
                ),
                Ok(())
            );
            assert_eq!(dst.vt, DpkVarType::Empty);
            assert_eq!(dst.value, DpkPropVariantValue::Empty);
        }
    }

    #[test]
    fn write_container_pre_rejects_metadata_offset_overflow_before_wrapping() {
        let mut backing = [0_u8; 2048];
        let mut stream = unsafe { create_ws_memory_owned(Some(&mut backing)) };
        let mut encoder = tagPKImageEncode {
            pStream: Some(NonNull::from(&mut *stream)),
            guidPixFormat: GUID_PKPixelFormat8bppGray,
            cbXMPMetadataByteCount: u32::MAX,
            ..Default::default()
        };

        unsafe {
            assert_eq!(
                write_container_pre(&mut encoder),
                Err(crate::WmpError::BufferOverflow)
            );
        }
    }

    unsafe fn fail_metadata_read(_: &mut WMPStream, _: &mut [u8]) -> Result<(), crate::WmpError> {
        Err(crate::WmpError::FileIO)
    }

    #[test]
    fn pk_image_decode_get_metadata_wmp_restores_position_after_read_error() {
        let mut backing = [0_u8; 32];
        let mut stream = unsafe { create_ws_memory_owned(Some(&mut backing)) };
        let mut decoder = tagPKImageDecode::default();
        let mut got = [0_u8; 4];
        let mut got_count = got.len() as u32;
        let mut pos = 0;

        unsafe {
            assert_eq!(set_pos_ws_memory(&mut stream, 9), Ok(()));
            stream.Read = Some(fail_metadata_read);
            decoder.pStream = Some(NonNull::from(&mut *stream));

            assert_eq!(
                pk_image_decode_get_metadata_wmp(
                    &mut decoder,
                    3,
                    got.len() as u32,
                    Some(&mut got),
                    Some(&mut got_count),
                ),
                Err(crate::WmpError::FileIO)
            );
            assert_eq!(got_count, 0);
            assert_eq!(get_pos_ws_memory(&mut stream, &mut pos), Ok(()));
            assert_eq!(pos, 9);
        }
    }

    #[test]
    fn write_container_post_rejects_image_byte_count_overflow() {
        let mut backing = [0_u8; 64];
        let mut stream = unsafe { create_ws_memory_owned(Some(&mut backing)) };
        let mut encoder = tagPKImageEncode {
            pStream: Some(NonNull::from(&mut *stream)),
            ..Default::default()
        };
        encoder.WMP.nCbImage = i64::from(u32::MAX) + 1;

        unsafe {
            assert_eq!(
                write_container_post(&mut encoder),
                Err(crate::WmpError::BufferOverflow)
            );
        }
    }

    #[test]
    fn pk_image_decode_get_size_wmp_swaps_dimensions_for_rotated_orientation() {
        let mut decoder = tagPKImageDecode {
            uWidth: 640,
            uHeight: 480,
            ..Default::default()
        };
        let mut width = 0;
        let mut height = 0;

        unsafe {
            decoder.WMP.wmiI.oOrientation = Orientation::FlipVH;
            assert_eq!(
                pk_image_decode_get_size_wmp(&mut decoder, Some(&mut width), Some(&mut height)),
                Ok(())
            );
            assert_eq!((width, height), (640, 480));

            decoder.WMP.wmiI.oOrientation = Orientation::RotateCw;
            assert_eq!(
                pk_image_decode_get_size_wmp(&mut decoder, Some(&mut width), Some(&mut height)),
                Ok(())
            );
            assert_eq!((width, height), (480, 640));
        }
    }

    #[test]
    fn pk_image_decode_get_raw_stream_wmp_seeks_to_image_offset_and_returns_stream() {
        let mut backing = [0_u8; 16];
        let mut decoder = tagPKImageDecode::default();
        let mut pos = 0;

        let mut stream = unsafe { create_ws_memory_owned(Some(&mut backing)) };
        unsafe {
            assert_eq!(set_pos_ws_memory(&mut stream, 11), Ok(()));
            let stream_ptr = NonNull::from(&mut *stream);
            decoder.pStream = Some(stream_ptr);
            decoder.WMP.wmiDEMisc.uImageOffset = 5;

            let raw_stream = pk_image_decode_get_raw_stream_wmp(&mut decoder)
                .expect("raw stream should be returned");
            assert_eq!(raw_stream, stream_ptr);
            assert_eq!(get_pos_ws_memory(&mut stream, &mut pos), Ok(()));
            assert_eq!(pos, 5);
        }
    }

    #[test]
    fn pk_image_encode_write_pixels_wmp_rejects_short_pixel_slice() {
        let mut encoder = tagPKImageEncode {
            guidPixFormat: GUID_PKPixelFormat8bppGray,
            ..Default::default()
        };
        let pixels = [0_u8; 31];

        unsafe {
            assert_eq!(
                pk_image_encode_write_pixels_wmp(&mut encoder, 4, &pixels, 8),
                Err(crate::WmpError::InvalidParameter)
            );
        }
    }

    #[test]
    fn pk_image_encode_write_pixels_banded_wmp_rejects_null_pixels_for_lines() {
        let mut encoder = tagPKImageEncode::default();

        unsafe {
            assert_eq!(
                pk_image_encode_write_pixels_banded_wmp(
                    &mut encoder,
                    16,
                    std::ptr::null_mut(),
                    8,
                    0,
                ),
                Err(crate::WmpError::InvalidParameter)
            );
        }
    }

    #[test]
    fn encode_raw_helpers_reject_null_pixels_for_lines_before_encoder_access() {
        unsafe {
            assert_eq!(
                pk_image_encode_encode_content_encode(
                    std::ptr::null_mut(),
                    1,
                    std::ptr::null_mut(),
                    8
                ),
                Err(crate::WmpError::InvalidParameter)
            );
            assert_eq!(
                pk_image_encode_encode_alpha_encode(
                    std::ptr::null_mut(),
                    1,
                    std::ptr::null_mut(),
                    8
                ),
                Err(crate::WmpError::InvalidParameter)
            );
        }
    }

    #[test]
    fn checked_banded_row_offset_rejects_overflow_before_yuv420_halving() {
        assert_eq!(checked_banded_row_offset(12, 16, false), Some(192));
        assert_eq!(checked_banded_row_offset(12, 16, true), Some(96));
        assert_eq!(
            checked_banded_row_offset(isize::MAX as usize + 1, 1, false),
            None
        );
        assert_eq!(
            checked_banded_row_offset(isize::MAX as usize + 1, 2, true),
            None
        );
        assert_eq!(checked_banded_row_offset(usize::MAX, 2, false), None);
        assert_eq!(checked_banded_row_offset(usize::MAX, 2, true), None);
    }

    #[test]
    fn pk_image_encode_initialize_wmp_invalid_params_leave_stream_pointers_unset() {
        let mut backing = [0_u8; 8];
        let mut stream = unsafe { create_ws_memory_owned(Some(&mut backing)) };
        let param = crate::jxrgluelib::jxrglue::tagWmpStrCodecParam::default();
        let valid_size = std::mem::size_of::<crate::jxrgluelib::jxrglue::tagWmpStrCodecParam>();

        unsafe {
            let mut encoder = tagPKImageEncode::default();
            assert_eq!(
                pk_image_encode_initialize_wmp(&mut encoder, &mut stream, Some(&param), 0),
                Err(crate::WmpError::InvalidArgument)
            );
            assert!(encoder.pStream.is_none());
            assert!(encoder.WMP.wmiSCP.pWStream.is_none());
            assert!(encoder.WMP.wmiSCP_Alpha.pWStream.is_none());

            let mut encoder = tagPKImageEncode::default();
            assert_eq!(
                pk_image_encode_initialize_wmp(&mut encoder, &mut stream, None, valid_size),
                Err(crate::WmpError::InvalidArgument)
            );
            assert!(encoder.pStream.is_none());
            assert!(encoder.WMP.wmiSCP.pWStream.is_none());
            assert!(encoder.WMP.wmiSCP_Alpha.pWStream.is_none());
        }
    }
}
