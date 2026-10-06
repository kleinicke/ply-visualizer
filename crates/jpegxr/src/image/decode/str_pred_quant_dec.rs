// Auto-generated scaffold for a faithful JXRLib translation restart.
// Keep one Rust item per original C item; replace stubs bottom-up.

use std::ptr::NonNull;

use crate::image::sys::common::{CCBPModel, AVG_NDIFF};
use crate::image::sys::str_pred_quant::{get_ac_pred_mode, get_dcac_pred_mode};
use crate::image::sys::strcodec::{
    blk_offset_uv_422, dct_index, CCodingContext, CWMITile, CWMImageStrCodec,
};
use crate::image::sys::windowsmediaphoto::Subband;
use crate::jxrgluelib::jxrglue::ColorFormat;
use crate::WmpError;

/// Original function: `dequantizeBlock4x4` at `original/jxrlib/image/decode/strPredQuantDec.c:33`.
pub unsafe fn dequantize_block4x4(p_rec: &mut [i32], p_org: &[i32], p_index: &[i32], i_qplp: i32) {
    for i in 1..16 {
        p_rec[p_index[i] as usize] = p_org[i].wrapping_mul(i_qplp);
    }
}

/// Original function: `dequantizeBlock2x2` at `original/jxrlib/image/decode/strPredQuantDec.c:41`.
pub unsafe fn dequantize_block2x2(p_rec: &mut [i32], p_org: &[i32], i_qplp: i32) {
    p_rec[32] = p_org[1].wrapping_mul(i_qplp);
    p_rec[16] = p_org[2].wrapping_mul(i_qplp);
    p_rec[48] = p_org[3].wrapping_mul(i_qplp);
}

/// Original function: `dequantizeBlock4x2` at `original/jxrlib/image/decode/strPredQuantDec.c:48`.
pub unsafe fn dequantize_block4x2(p_rec: &mut [i32], p_org: &[i32], i_qplp: i32) {
    p_rec[64] = p_org[1].wrapping_mul(i_qplp);
    p_rec[16] = p_org[2].wrapping_mul(i_qplp);
    p_rec[80] = p_org[3].wrapping_mul(i_qplp);
    p_rec[32] = p_org[4].wrapping_mul(i_qplp);
    p_rec[96] = p_org[5].wrapping_mul(i_qplp);
    p_rec[48] = p_org[6].wrapping_mul(i_qplp);
    p_rec[112] = p_org[7].wrapping_mul(i_qplp);
}

/// Original function: `dequantizeMacroblock` at `original/jxrlib/image/decode/strPredQuantDec.c:60`.
pub unsafe fn dequantize_macroblock(p_sc: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    let p_sc = p_sc as *mut CWMImageStrCodec;
    let cf = (*p_sc).m_param.cfColorFormat;
    let p_mb_info = std::ptr::addr_of_mut!((*p_sc).MBInfo);
    let Some(tile) = (*p_sc)
        .pTileMemory
        .as_deref_mut()
        .and_then(|tiles| tiles.get_mut((*p_sc).cTileColumn))
    else {
        return Ok(());
    };
    let p_tile = tile as *mut CWMITile;
    let i_channels = (*p_sc).m_param.cNumChannels;

    for i in 0..i_channels {
        let Some(p_qpdc) = (*p_tile).pQuantizerDC[i] else {
            return Ok(());
        };
        *(*p_sc).p1MBbuffer[i]
            .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
            .add(0) = (*p_mb_info).iBlockDC[i][0].wrapping_mul((*p_qpdc.as_ptr()).iQP);

        if (*p_sc).WMISCP.sbSubband != Subband::DcOnly {
            let Some(p_qplp_base) = (*p_tile).pQuantizerLP[i] else {
                return Ok(());
            };
            let p_qplp = p_qplp_base.as_ptr().add((*p_mb_info).iQIndexLP as usize);
            if i == 0 || (cf != ColorFormat::Yuv422 && cf != ColorFormat::Yuv420) {
                let p_rec =
                    (*p_sc).p1MBbuffer[i].map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);
                dequantize_block4x4(
                    std::slice::from_raw_parts_mut(p_rec, 256),
                    &(*p_mb_info).iBlockDC[i],
                    &dct_index[2],
                    (*p_qplp).iQP,
                );
            } else if cf == ColorFormat::Yuv422 {
                let p_rec =
                    (*p_sc).p1MBbuffer[i].map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);
                dequantize_block4x2(
                    std::slice::from_raw_parts_mut(p_rec, 128),
                    &(*p_mb_info).iBlockDC[i],
                    (*p_qplp).iQP,
                );
            } else {
                let p_rec =
                    (*p_sc).p1MBbuffer[i].map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);
                dequantize_block2x2(
                    std::slice::from_raw_parts_mut(p_rec, 64),
                    &(*p_mb_info).iBlockDC[i],
                    (*p_qplp).iQP,
                );
            }
        }
    }

    Ok(())
}

/// Original function: `predDCACDec` at `original/jxrlib/image/decode/strPredQuantDec.c:86`.
pub unsafe fn pred_dcac_dec(p_sc: &mut CWMImageStrCodec) {
    let p_sc = p_sc as *mut CWMImageStrCodec;
    let cf = (*p_sc).m_param.cfColorFormat;
    let i_channels = if cf == ColorFormat::Yuv420 || cf == ColorFormat::Yuv422 {
        1
    } else {
        (*p_sc).m_param.cNumChannels as i32
    };
    let p_mb_info = std::ptr::addr_of_mut!((*p_sc).MBInfo);
    let mb_x = (*p_sc).cColumn;
    let i_dcac_pred_mode = get_dcac_pred_mode(&*p_sc, mb_x);
    let i_dc_pred_mode = i_dcac_pred_mode & 0x3;
    let i_ad_pred_mode = i_dcac_pred_mode & 0xC;

    for ii in 0..i_channels {
        let p_org = (*p_mb_info).iBlockDC[ii as usize].as_mut_ptr();

        if i_dc_pred_mode == 1 {
            *p_org.add(0) += (*(*p_sc).PredInfoPrevRow[ii as usize]
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(mb_x))
            .iDC;
        } else if i_dc_pred_mode == 0 {
            *p_org.add(0) += (*(*p_sc).PredInfo[ii as usize]
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(mb_x - 1))
            .iDC;
        } else if i_dc_pred_mode == 2 {
            *p_org.add(0) += ((*(*p_sc).PredInfo[ii as usize]
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(mb_x - 1))
            .iDC + (*(*p_sc).PredInfoPrevRow[ii as usize]
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(mb_x))
            .iDC)
                >> 1;
        }

        if i_ad_pred_mode == 4 {
            let p_ref = (*(*p_sc).PredInfoPrevRow[ii as usize]
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(mb_x))
            .piAD
            .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);
            *p_org.add(4) += *p_ref.add(3);
            *p_org.add(8) += *p_ref.add(4);
            *p_org.add(12) += *p_ref.add(5);
        } else if i_ad_pred_mode == 0 {
            let p_ref = (*(*p_sc).PredInfo[ii as usize]
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(mb_x - 1))
            .piAD
            .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);
            *p_org.add(1) += *p_ref.add(0);
            *p_org.add(2) += *p_ref.add(1);
            *p_org.add(3) += *p_ref.add(2);
        }
    }

    if cf == ColorFormat::Yuv420 {
        for ii in 1..3 {
            let p_org = (*p_mb_info).iBlockDC[ii as usize].as_mut_ptr();

            if i_dc_pred_mode == 1 {
                *p_org.add(0) += (*(*p_sc).PredInfoPrevRow[ii as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x))
                .iDC;
            } else if i_dc_pred_mode == 0 {
                *p_org.add(0) += (*(*p_sc).PredInfo[ii as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x - 1))
                .iDC;
            } else if i_dc_pred_mode == 2 {
                *p_org.add(0) += ((*(*p_sc).PredInfo[ii as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x - 1))
                .iDC + (*(*p_sc).PredInfoPrevRow[ii as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x))
                .iDC + 1)
                    >> 1;
            }

            if i_ad_pred_mode == 4 {
                *p_org.add(2) += *(*(*p_sc).PredInfoPrevRow[ii as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x))
                .piAD
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(1);
            } else if i_ad_pred_mode == 0 {
                *p_org.add(1) += *(*(*p_sc).PredInfo[ii as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x - 1))
                .piAD
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(0);
            }
        }
    } else if cf == ColorFormat::Yuv422 {
        for ii in 1..3 {
            let p_org = (*p_mb_info).iBlockDC[ii as usize].as_mut_ptr();

            if i_dc_pred_mode == 1 {
                *p_org.add(0) += (*(*p_sc).PredInfoPrevRow[ii as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x))
                .iDC;
            } else if i_dc_pred_mode == 0 {
                *p_org.add(0) += (*(*p_sc).PredInfo[ii as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x - 1))
                .iDC;
            } else if i_dc_pred_mode == 2 {
                *p_org.add(0) += ((*(*p_sc).PredInfo[ii as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x - 1))
                .iDC + (*(*p_sc).PredInfoPrevRow[ii as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x))
                .iDC + 1)
                    >> 1;
            }

            if i_ad_pred_mode == 4 {
                *p_org.add(4) += *(*(*p_sc).PredInfoPrevRow[ii as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x))
                .piAD
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(4);
                *p_org.add(2) += *(*(*p_sc).PredInfoPrevRow[ii as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x))
                .piAD
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(3);
                *p_org.add(6) += *p_org.add(2);
            } else if i_ad_pred_mode == 0 {
                *p_org.add(4) += *(*(*p_sc).PredInfo[ii as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x - 1))
                .piAD
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(4);
                *p_org.add(1) += *(*(*p_sc).PredInfo[ii as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x - 1))
                .piAD
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(0);
                *p_org.add(5) += *(*(*p_sc).PredInfo[ii as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x - 1))
                .piAD
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(2);
            } else if i_dc_pred_mode == 1 {
                *p_org.add(6) += *p_org.add(2);
            }
        }
    }

    (*p_mb_info).iOrientation = 2 - get_ac_pred_mode(&*p_mb_info, cf) as i32;
}

/// Original function: `predACDec` at `original/jxrlib/image/decode/strPredQuantDec.c:185`.
pub unsafe fn pred_ac_dec(p_sc: &mut CWMImageStrCodec) {
    let p_sc = p_sc as *mut CWMImageStrCodec;
    let cf = (*p_sc).m_param.cfColorFormat;
    let i_channels = if cf == ColorFormat::Yuv420 || cf == ColorFormat::Yuv422 {
        1
    } else {
        (*p_sc).m_param.cNumChannels as i32
    };
    let p_mb_info = std::ptr::addr_of_mut!((*p_sc).MBInfo);
    let i_ac_pred_mode = 2 - (*p_mb_info).iOrientation;

    for i in 0..i_channels {
        let p_src =
            (*p_sc).p1MBbuffer[i as usize].map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);

        match i_ac_pred_mode {
            1 => {
                static BLK_IDX: [u8; 12] = [1, 2, 3, 5, 6, 7, 9, 10, 11, 13, 14, 15];
                for blk_idx in BLK_IDX {
                    let p_org = p_src.add(16 * blk_idx as usize);
                    let p_ref = p_org.offset(-16);

                    *p_org.add(2) += *p_ref.add(2);
                    *p_org.add(10) += *p_ref.add(10);
                    *p_org.add(9) += *p_ref.add(9);
                }
            }
            0 => {
                for j in (64..256).step_by(16) {
                    let p_org = p_src.add(j);
                    let p_ref = p_org.offset(-64);

                    *p_org.add(1) += *p_ref.add(1);
                    *p_org.add(5) += *p_ref.add(5);
                    *p_org.add(6) += *p_ref.add(6);
                }
            }
            _ => {}
        }
    }

    if cf == ColorFormat::Yuv420 {
        for i in (16..=20).step_by(4) {
            let p_src = (*p_sc).p1MBbuffer[((i >> 2) - 3) as usize]
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);

            match i_ac_pred_mode {
                1 => {
                    for j in (1..=3).step_by(2) {
                        let p_org = p_src.add(16 * j as usize);
                        let p_ref = p_org.offset(-16);

                        *p_org.add(2) += *p_ref.add(2);
                        *p_org.add(10) += *p_ref.add(10);
                        *p_org.add(9) += *p_ref.add(9);
                    }
                }
                0 => {
                    for j in 2..=3 {
                        let p_org = p_src.add(16 * j as usize);
                        let p_ref = p_org.offset(-32);

                        *p_org.add(1) += *p_ref.add(1);
                        *p_org.add(5) += *p_ref.add(5);
                        *p_org.add(6) += *p_ref.add(6);
                    }
                }
                _ => {}
            }
        }
    } else if cf == ColorFormat::Yuv422 {
        for i in (16..32).step_by(8) {
            let p_src = (*p_sc).p1MBbuffer[((i >> 3) - 1) as usize]
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);

            match i_ac_pred_mode {
                1 => {
                    for j in 2..8 {
                        let p_org = p_src.add(blk_offset_uv_422[j as usize] as usize);
                        let p_ref = p_org.offset(-16);

                        *p_org.add(10) += *p_ref.add(10);
                        *p_org.add(2) += *p_ref.add(2);
                        *p_org.add(9) += *p_ref.add(9);
                    }
                }
                0 => {
                    for j in (1..8).step_by(2) {
                        let p_org = p_src.add(blk_offset_uv_422[j as usize] as usize);
                        let p_ref = p_org.offset(-64);

                        *p_org.add(1) += *p_ref.add(1);
                        *p_org.add(5) += *p_ref.add(5);
                        *p_org.add(6) += *p_ref.add(6);
                    }
                }
                _ => {}
            }
        }
    }
}

/// Original function: `NumOnes` at `original/jxrlib/image/decode/strPredQuantDec.c:323`.
pub unsafe fn num_ones(mut i: i32) -> i32 {
    let mut retval: i32 = 0;
    static G_COUNT: [i32; 16] = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];

    i &= 0xffff;
    while i != 0 {
        retval += G_COUNT[(i & 0xf) as usize];
        i >>= 4;
    }
    retval
}

/// Original function: `predCBPCDec` at `original/jxrlib/image/decode/strPredQuantDec.c:343`.
pub unsafe fn pred_cbpc_dec(
    p_sc: *mut CWMImageStrCodec,
    mut i_cbp: i32,
    mb_x: usize,
    _mb_y: usize,
    c: usize,
    p_model: *mut CCBPModel,
) -> i32 {
    let i_n_diff = AVG_NDIFF;
    let c1 = if c != 0 { 1 } else { 0 };

    if (*p_model).m_iState[c1] == 0 {
        if (*p_sc).m_bCtxLeft != 0 {
            if (*p_sc).m_bCtxTop != 0 {
                i_cbp ^= 1;
            } else {
                let i_top_cbp = (*(*p_sc).PredInfoPrevRow[c]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x))
                .iCBP;
                i_cbp ^= (i_top_cbp >> 10) & 1;
            }
        } else {
            let i_left_cbp = (*(*p_sc).PredInfo[c]
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(mb_x - 1))
            .iCBP;
            i_cbp ^= (i_left_cbp >> 5) & 1;
        }

        i_cbp ^= 0x02 & (i_cbp << 1);
        i_cbp ^= 0x10 & (i_cbp << 3);
        i_cbp ^= 0x20 & (i_cbp << 1);
        i_cbp ^= (i_cbp & 0x33) << 2;
        i_cbp ^= (i_cbp & 0xcc) << 6;
        i_cbp ^= (i_cbp & 0x3300) << 2;
    } else if (*p_model).m_iState[c1] == 2 {
        i_cbp ^= 0xffff;
    }

    let i_n_orig = num_ones(i_cbp);
    (*p_model).m_iCount0[c1] += i_n_orig - i_n_diff;
    if ((*p_model).m_iCount0[c1] + 16) as u32 >= 32 {
        if (*p_model).m_iCount0[c1] < 0 {
            (*p_model).m_iCount0[c1] = -16;
        } else {
            (*p_model).m_iCount0[c1] = 15;
        }
    }

    (*p_model).m_iCount1[c1] += 16 - i_n_orig - i_n_diff;
    if ((*p_model).m_iCount1[c1] + 16) as u32 >= 32 {
        if (*p_model).m_iCount1[c1] < 0 {
            (*p_model).m_iCount1[c1] = -16;
        } else {
            (*p_model).m_iCount1[c1] = 15;
        }
    }

    if (*p_model).m_iCount0[c1] < 0 {
        if (*p_model).m_iCount0[c1] < (*p_model).m_iCount1[c1] {
            (*p_model).m_iState[c1] = 1;
        } else {
            (*p_model).m_iState[c1] = 2;
        }
    } else if (*p_model).m_iCount1[c1] < 0 {
        (*p_model).m_iState[c1] = 2;
    } else {
        (*p_model).m_iState[c1] = 0;
    }

    i_cbp
}

/// Original function: `predCBPC420Dec` at `original/jxrlib/image/decode/strPredQuantDec.c:404`.
pub unsafe fn pred_cbpc420_dec(
    p_sc: *mut CWMImageStrCodec,
    mut i_cbp: i32,
    mb_x: usize,
    _mb_y: usize,
    c: usize,
    p_model: *mut CCBPModel,
) -> i32 {
    let i_n_diff = AVG_NDIFF;

    if (*p_model).m_iState[1] == 0 {
        if (*p_sc).m_bCtxLeft != 0 {
            if (*p_sc).m_bCtxTop != 0 {
                i_cbp ^= 1;
            } else {
                let i_top_cbp = (*(*p_sc).PredInfoPrevRow[c]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x))
                .iCBP;
                i_cbp ^= (i_top_cbp >> 2) & 1;
            }
        } else {
            let i_left_cbp = (*(*p_sc).PredInfo[c]
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(mb_x - 1))
            .iCBP;
            i_cbp ^= (i_left_cbp >> 1) & 1;
        }

        i_cbp ^= 0x02 & (i_cbp << 1);
        i_cbp ^= (i_cbp & 0x3) << 2;
    } else if (*p_model).m_iState[1] == 2 {
        i_cbp ^= 0xf;
    }

    let i_n_orig = num_ones(i_cbp) * 4;
    (*p_model).m_iCount0[1] += i_n_orig - i_n_diff;
    if ((*p_model).m_iCount0[1] + 16) as u32 >= 32 {
        if (*p_model).m_iCount0[1] < 0 {
            (*p_model).m_iCount0[1] = -16;
        } else {
            (*p_model).m_iCount0[1] = 15;
        }
    }

    (*p_model).m_iCount1[1] += 16 - i_n_orig - i_n_diff;
    if ((*p_model).m_iCount1[1] + 16) as u32 >= 32 {
        if (*p_model).m_iCount1[1] < 0 {
            (*p_model).m_iCount1[1] = -16;
        } else {
            (*p_model).m_iCount1[1] = 15;
        }
    }

    if (*p_model).m_iCount0[1] < 0 {
        if (*p_model).m_iCount0[1] < (*p_model).m_iCount1[1] {
            (*p_model).m_iState[1] = 1;
        } else {
            (*p_model).m_iState[1] = 2;
        }
    } else if (*p_model).m_iCount1[1] < 0 {
        (*p_model).m_iState[1] = 2;
    } else {
        (*p_model).m_iState[1] = 0;
    }

    i_cbp
}

/// Original function: `predCBPC422Dec` at `original/jxrlib/image/decode/strPredQuantDec.c:459`.
pub unsafe fn pred_cbpc422_dec(
    p_sc: *mut CWMImageStrCodec,
    mut i_cbp: i32,
    mb_x: usize,
    _mb_y: usize,
    c: usize,
    p_model: *mut CCBPModel,
) -> i32 {
    let i_n_diff = AVG_NDIFF;

    if (*p_model).m_iState[1] == 0 {
        if (*p_sc).m_bCtxLeft != 0 {
            if (*p_sc).m_bCtxTop != 0 {
                i_cbp ^= 1;
            } else {
                let i_top_cbp = (*(*p_sc).PredInfoPrevRow[c]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x))
                .iCBP;
                i_cbp ^= (i_top_cbp >> 6) & 1;
            }
        } else {
            let i_left_cbp = (*(*p_sc).PredInfo[c]
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(mb_x - 1))
            .iCBP;
            i_cbp ^= (i_left_cbp >> 1) & 1;
        }

        i_cbp ^= (i_cbp & 0x1) << 1;
        i_cbp ^= (i_cbp & 0x3) << 2;
        i_cbp ^= (i_cbp & 0xc) << 2;
        i_cbp ^= (i_cbp & 0x30) << 2;
    } else if (*p_model).m_iState[1] == 2 {
        i_cbp ^= 0xff;
    }

    let i_n_orig = num_ones(i_cbp) * 2;
    (*p_model).m_iCount0[1] += i_n_orig - i_n_diff;
    if ((*p_model).m_iCount0[1] + 16) as u32 >= 32 {
        if (*p_model).m_iCount0[1] < 0 {
            (*p_model).m_iCount0[1] = -16;
        } else {
            (*p_model).m_iCount0[1] = 15;
        }
    }

    (*p_model).m_iCount1[1] += 16 - i_n_orig - i_n_diff;
    if ((*p_model).m_iCount1[1] + 16) as u32 >= 32 {
        if (*p_model).m_iCount1[1] < 0 {
            (*p_model).m_iCount1[1] = -16;
        } else {
            (*p_model).m_iCount1[1] = 15;
        }
    }

    if (*p_model).m_iCount0[1] < 0 {
        if (*p_model).m_iCount0[1] < (*p_model).m_iCount1[1] {
            (*p_model).m_iState[1] = 1;
        } else {
            (*p_model).m_iState[1] = 2;
        }
    } else if (*p_model).m_iCount1[1] < 0 {
        (*p_model).m_iState[1] = 2;
    } else {
        (*p_model).m_iState[1] = 0;
    }

    i_cbp
}

/// Original function: `predCBPDec` at `original/jxrlib/image/decode/strPredQuantDec.c:518`.
pub unsafe fn pred_cbp_dec(p_sc: &mut CWMImageStrCodec, p_context: &mut CCodingContext) {
    let p_sc = p_sc as *mut CWMImageStrCodec;
    let p_context = p_context as *mut CCodingContext;
    let cf = (*p_sc).m_param.cfColorFormat;
    let i_channels = if cf == ColorFormat::Yuv420 || cf == ColorFormat::Yuv422 {
        1
    } else {
        (*p_sc).m_param.cNumChannels
    };
    let mb_x = (*p_sc).cColumn;
    let mb_y = (*p_sc).cRow;
    let p_mb_info = std::ptr::addr_of_mut!((*p_sc).MBInfo);

    for i in 0..i_channels {
        (*p_mb_info).iCBP[i] = pred_cbpc_dec(
            p_sc,
            (*p_mb_info).iDiffCBP[i],
            mb_x,
            mb_y,
            i,
            std::ptr::addr_of_mut!((*p_context).m_aCBPModel),
        );
        (*(*p_sc).PredInfo[i]
            .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
            .add(mb_x))
        .iCBP = (*p_mb_info).iCBP[i];
    }

    if cf == ColorFormat::Yuv422 {
        (*p_mb_info).iCBP[1] = pred_cbpc422_dec(
            p_sc,
            (*p_mb_info).iDiffCBP[1],
            mb_x,
            mb_y,
            1,
            std::ptr::addr_of_mut!((*p_context).m_aCBPModel),
        );
        (*(*p_sc).PredInfo[1]
            .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
            .add(mb_x))
        .iCBP = (*p_mb_info).iCBP[1];
        (*p_mb_info).iCBP[2] = pred_cbpc422_dec(
            p_sc,
            (*p_mb_info).iDiffCBP[2],
            mb_x,
            mb_y,
            2,
            std::ptr::addr_of_mut!((*p_context).m_aCBPModel),
        );
        (*(*p_sc).PredInfo[2]
            .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
            .add(mb_x))
        .iCBP = (*p_mb_info).iCBP[2];
    } else if cf == ColorFormat::Yuv420 {
        (*p_mb_info).iCBP[1] = pred_cbpc420_dec(
            p_sc,
            (*p_mb_info).iDiffCBP[1],
            mb_x,
            mb_y,
            1,
            std::ptr::addr_of_mut!((*p_context).m_aCBPModel),
        );
        (*(*p_sc).PredInfo[1]
            .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
            .add(mb_x))
        .iCBP = (*p_mb_info).iCBP[1];
        (*p_mb_info).iCBP[2] = pred_cbpc420_dec(
            p_sc,
            (*p_mb_info).iDiffCBP[2],
            mb_x,
            mb_y,
            2,
            std::ptr::addr_of_mut!((*p_context).m_aCBPModel),
        );
        (*(*p_sc).PredInfo[2]
            .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
            .add(mb_x))
        .iCBP = (*p_mb_info).iCBP[2];
    }
}
