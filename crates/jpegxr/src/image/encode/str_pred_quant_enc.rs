// Auto-generated scaffold for a faithful JXRLib translation restart.
// Keep one Rust item per original C item; replace stubs bottom-up.

use std::ptr::NonNull;

use crate::image::sys::common::{CCBPModel, AVG_NDIFF};
use crate::image::sys::str_pred_quant::{get_ac_pred_mode, get_dcac_pred_mode, update_pred_info};
use crate::image::sys::strcodec::{
    blk_offset, blk_offset_uv, blk_offset_uv_422, dct_index, CCodingContext, CWMITile,
    CWMImageStrCodec,
};
use crate::image::sys::windowsmediaphoto::Subband;
use crate::jxrgluelib::jxrglue::ColorFormat;
use crate::WmpError;

/// Original function: `QUANT_Mulless` at `original/jxrlib/image/encode/strPredQuantEnc.c:32`.
pub unsafe fn quant_mulless(v: i32, o: i32, r: i32) -> i32 {
    let m = v >> 31;
    ((((v ^ m).wrapping_sub(m).wrapping_add(o)) >> r) ^ m).wrapping_sub(m)
}

/// Original function: `MUL32HR` at `original/jxrlib/image/encode/strPredQuantEnc.c:40`.
pub unsafe fn mul32hr(a: u32, b: u32, r: u32) -> i32 {
    (((a as u64).wrapping_mul(b as u64) >> 32) as u32 >> r) as i32
}

/// Original function: `QUANT` at `original/jxrlib/image/encode/strPredQuantEnc.c:45`.
pub unsafe fn quant(v: i32, o: i32, man: i32, exp: i32) -> i32 {
    let m = v >> 31;
    (mul32hr(
        (v ^ m).wrapping_sub(m).wrapping_add(o) as u32,
        man as u32,
        exp as u32,
    ) ^ m)
        .wrapping_sub(m)
}

/// Original function: `quantizeMacroblock` at `original/jxrlib/image/encode/strPredQuantEnc.c:53`.
pub unsafe fn quantize_macroblock(p_sc: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    let p_sc = p_sc as *mut CWMImageStrCodec;
    let Some(tile) = (*p_sc)
        .pTileMemory
        .as_deref_mut()
        .and_then(|tiles| tiles.get_mut((*p_sc).cTileColumn))
    else {
        return Err(WmpError::Fail);
    };
    let p_tile = tile as *mut CWMITile;
    let p_mb_info = std::ptr::addr_of_mut!((*p_sc).MBInfo);
    let cf = (*p_sc).m_param.cfColorFormat;

    if (*p_sc).m_param.bTranscode == 0 {
        for i_channel in 0..(*p_sc).m_param.cNumChannels {
            let b_uv = i_channel > 0
                && (cf == ColorFormat::Yuv444
                    || cf == ColorFormat::Yuv422
                    || cf == ColorFormat::Yuv420);
            let i_num_block = if b_uv {
                if cf == ColorFormat::Yuv422 {
                    8
                } else if cf == ColorFormat::Yuv420 {
                    4
                } else {
                    16
                }
            } else {
                16
            };
            let p_offset = if i_num_block == 4 {
                blk_offset_uv.as_ptr()
            } else if i_num_block == 8 {
                blk_offset_uv_422.as_ptr()
            } else {
                blk_offset.as_ptr()
            };
            let Some(p_qpdc) = (*p_tile).pQuantizerDC[i_channel] else {
                return Err(WmpError::Fail);
            };
            let Some(p_qplp_base) = (*p_tile).pQuantizerLP[i_channel] else {
                return Err(WmpError::Fail);
            };
            let Some(p_qphp_base) = (*p_tile).pQuantizerHP[i_channel] else {
                return Err(WmpError::Fail);
            };
            let p_qpdc = p_qpdc.as_ptr();
            let p_qplp = p_qplp_base.as_ptr().add((*p_mb_info).iQIndexLP as usize);
            let p_qphp = p_qphp_base.as_ptr().add((*p_mb_info).iQIndexHP as usize);

            for j in 0..i_num_block {
                let p_data = (*p_sc).pPlane[i_channel]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(*p_offset.add(j) as usize);

                if j == 0 {
                    *p_data.add(0) = if (*p_qpdc).iMan == 0 {
                        quant_mulless(*p_data.add(0), (*p_qpdc).iOffset, (*p_qpdc).iExp)
                    } else {
                        quant(
                            *p_data.add(0),
                            (*p_qpdc).iOffset,
                            (*p_qpdc).iMan,
                            (*p_qpdc).iExp,
                        )
                    };
                } else if (*p_sc).WMISCP.sbSubband != Subband::DcOnly {
                    *p_data.add(0) = if (*p_qplp).iMan == 0 {
                        quant_mulless(*p_data.add(0), (*p_qplp).iOffset, (*p_qplp).iExp)
                    } else {
                        quant(
                            *p_data.add(0),
                            (*p_qplp).iOffset,
                            (*p_qplp).iMan,
                            (*p_qplp).iExp,
                        )
                    };
                }

                if (*p_sc).WMISCP.sbSubband != Subband::DcOnly
                    && (*p_sc).WMISCP.sbSubband != Subband::NoHighpass
                {
                    for i in 1..16 {
                        *p_data.add(i) = if (*p_qphp).iMan == 0 {
                            quant_mulless(*p_data.add(i), (*p_qphp).iOffset, (*p_qphp).iExp)
                        } else {
                            quant(
                                *p_data.add(i),
                                (*p_qphp).iOffset,
                                (*p_qphp).iMan,
                                (*p_qphp).iExp,
                            )
                        };
                    }
                }
            }
        }
    }

    for i_channel in 0..(*p_sc).m_param.cNumChannels {
        let p_dc = (*p_sc).MBInfo.iBlockDC[i_channel].as_mut_ptr();
        let p_data =
            (*p_sc).pPlane[i_channel].map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);

        if i_channel > 0 && cf == ColorFormat::Yuv422 {
            for i in 0..8 {
                *p_dc.add(i) = *p_data.add(blk_offset_uv_422[i] as usize);
            }
        } else if i_channel > 0 && cf == ColorFormat::Yuv420 {
            for i in 0..4 {
                *p_dc.add(i) = *p_data.add(blk_offset_uv[i] as usize);
            }
        } else {
            for i in 0..16 {
                *p_dc.add(i) = *p_data.add(dct_index[2][i] as usize);
            }
        }
    }

    Ok(())
}

/// Original function: `predMacroblockEnc` at `original/jxrlib/image/encode/strPredQuantEnc.c:109`.
pub unsafe fn pred_macroblock_enc(p_sc: &mut CWMImageStrCodec) {
    let p_sc = p_sc as *mut CWMImageStrCodec;
    let cf = (*p_sc).m_param.cfColorFormat;
    let i_channels = if cf == ColorFormat::Yuv420 || cf == ColorFormat::Yuv422 {
        1
    } else {
        (*p_sc).m_param.cNumChannels as i32
    };
    let mb_x = (*p_sc).cColumn - 1;
    let p_mb_info = std::ptr::addr_of_mut!((*p_sc).MBInfo);
    let i_dcac_pred_mode = get_dcac_pred_mode(&*p_sc, mb_x);
    let i_dc_pred_mode = i_dcac_pred_mode & 0x3;
    let i_ad_pred_mode = i_dcac_pred_mode & 0xC;
    let i_ac_pred_mode = get_ac_pred_mode(&*p_mb_info, cf);

    (*p_mb_info).iOrientation = 2 - i_ac_pred_mode;
    update_pred_info(p_sc, p_mb_info, mb_x, cf);

    for i in 0..i_channels {
        let p_org = (*p_mb_info).iBlockDC[i as usize].as_mut_ptr();

        if i_dc_pred_mode == 1 {
            *p_org.add(0) -= (*(*p_sc).PredInfoPrevRow[i as usize]
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(mb_x))
            .iDC;
        } else if i_dc_pred_mode == 0 {
            *p_org.add(0) -= (*(*p_sc).PredInfo[i as usize]
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(mb_x - 1))
            .iDC;
        } else if i_dc_pred_mode == 2 {
            *p_org.add(0) -= ((*(*p_sc).PredInfo[i as usize]
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(mb_x - 1))
            .iDC + (*(*p_sc).PredInfoPrevRow[i as usize]
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(mb_x))
            .iDC)
                >> 1;
        }

        if i_ad_pred_mode == 4 {
            let p_ref = (*(*p_sc).PredInfoPrevRow[i as usize]
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(mb_x))
            .piAD
            .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);
            *p_org.add(4) -= *p_ref.add(3);
            *p_org.add(8) -= *p_ref.add(4);
            *p_org.add(12) -= *p_ref.add(5);
        } else if i_ad_pred_mode == 0 {
            let p_ref = (*(*p_sc).PredInfo[i as usize]
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(mb_x - 1))
            .piAD
            .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);
            *p_org.add(1) -= *p_ref.add(0);
            *p_org.add(2) -= *p_ref.add(1);
            *p_org.add(3) -= *p_ref.add(2);
        }

        let p_org =
            (*p_sc).pPlane[i as usize].map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);
        if i_ac_pred_mode == 1 {
            for k in (0..=192).step_by(64) {
                for j in (16..=48).rev().step_by(16) {
                    *p_org.add(k + j + 10) -= *p_org.add(k + j + 10 - 16);
                    *p_org.add(k + j + 2) -= *p_org.add(k + j + 2 - 16);
                    *p_org.add(k + j + 9) -= *p_org.add(k + j + 9 - 16);
                }
            }
        } else if i_ac_pred_mode == 0 {
            for k in (0..64).step_by(16) {
                for j in (64..=192).rev().step_by(64) {
                    *p_org.add(k + j + 5) -= *p_org.add(k + j + 5 - 64);
                    *p_org.add(k + j + 1) -= *p_org.add(k + j + 1 - 64);
                    *p_org.add(k + j + 6) -= *p_org.add(k + j + 6 - 64);
                }
            }
        }
    }

    if cf == ColorFormat::Yuv420 {
        for i in 1..3 {
            let p_org = (*p_mb_info).iBlockDC[i as usize].as_mut_ptr();

            if i_dc_pred_mode == 1 {
                *p_org.add(0) -= (*(*p_sc).PredInfoPrevRow[i as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x))
                .iDC;
            } else if i_dc_pred_mode == 0 {
                *p_org.add(0) -= (*(*p_sc).PredInfo[i as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x - 1))
                .iDC;
            } else if i_dc_pred_mode == 2 {
                *p_org.add(0) -= ((*(*p_sc).PredInfo[i as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x - 1))
                .iDC + (*(*p_sc).PredInfoPrevRow[i as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x))
                .iDC + 1)
                    >> 1;
            }

            if i_ad_pred_mode == 4 {
                *p_org.add(2) -= *(*(*p_sc).PredInfoPrevRow[i as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x))
                .piAD
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(1);
            } else if i_ad_pred_mode == 0 {
                *p_org.add(1) -= *(*(*p_sc).PredInfo[i as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x - 1))
                .piAD
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(0);
            }

            let p_org =
                (*p_sc).pPlane[i as usize].map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);
            if i_ac_pred_mode == 1 {
                for j in (16..=48).step_by(32) {
                    *p_org.add(j + 10) -= *p_org.add(j + 10 - 16);
                    *p_org.add(j + 2) -= *p_org.add(j + 2 - 16);
                    *p_org.add(j + 9) -= *p_org.add(j + 9 - 16);
                }
            } else if i_ac_pred_mode == 0 {
                for j in (32..=48).step_by(16) {
                    *p_org.add(j + 5) -= *p_org.add(j + 5 - 32);
                    *p_org.add(j + 1) -= *p_org.add(j + 1 - 32);
                    *p_org.add(j + 6) -= *p_org.add(j + 6 - 32);
                }
            }
        }
    } else if cf == ColorFormat::Yuv422 {
        for i in 1..3 {
            let p_org = (*p_mb_info).iBlockDC[i as usize].as_mut_ptr();

            if i_dc_pred_mode == 1 {
                *p_org.add(0) -= (*(*p_sc).PredInfoPrevRow[i as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x))
                .iDC;
            } else if i_dc_pred_mode == 0 {
                *p_org.add(0) -= (*(*p_sc).PredInfo[i as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x - 1))
                .iDC;
            } else if i_dc_pred_mode == 2 {
                *p_org.add(0) -= ((*(*p_sc).PredInfo[i as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x - 1))
                .iDC + (*(*p_sc).PredInfoPrevRow[i as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x))
                .iDC + 1)
                    >> 1;
            }

            if i_ad_pred_mode == 4 {
                *p_org.add(4) -= *(*(*p_sc).PredInfoPrevRow[i as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x))
                .piAD
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(4);
                *p_org.add(6) -= *p_org.add(2);
                *p_org.add(2) -= *(*(*p_sc).PredInfoPrevRow[i as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x))
                .piAD
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(3);
            } else if i_ad_pred_mode == 0 {
                *p_org.add(4) -= *(*(*p_sc).PredInfo[i as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x - 1))
                .piAD
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(4);
                *p_org.add(1) -= *(*(*p_sc).PredInfo[i as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x - 1))
                .piAD
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(0);
                *p_org.add(5) -= *(*(*p_sc).PredInfo[i as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(mb_x - 1))
                .piAD
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(2);
            } else if i_dc_pred_mode == 1 {
                *p_org.add(6) -= *p_org.add(2);
            }

            let p_org =
                (*p_sc).pPlane[i as usize].map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);
            if i_ac_pred_mode == 1 {
                for j in (16..=48).rev().step_by(16) {
                    for k in (0..=64).step_by(64) {
                        *p_org.add(j + k + 10) -= *p_org.add(j + k + 10 - 16);
                        *p_org.add(j + k + 2) -= *p_org.add(j + k + 2 - 16);
                        *p_org.add(j + k + 9) -= *p_org.add(j + k + 9 - 16);
                    }
                }
            } else if i_ac_pred_mode == 0 {
                for j in (64..=112).step_by(16) {
                    *p_org.add(j + 5) -= *p_org.add(j + 5 - 64);
                    *p_org.add(j + 1) -= *p_org.add(j + 1 - 64);
                    *p_org.add(j + 6) -= *p_org.add(j + 6 - 64);
                }
            }
        }
    }
}

/// Original function: `NumOnes` at `original/jxrlib/image/encode/strPredQuantEnc.c:280`.
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

/// Original function: `predCBPCEnc` at `original/jxrlib/image/encode/strPredQuantEnc.c:294`.
pub unsafe fn pred_cbpc_enc(
    p_sc: *mut CWMImageStrCodec,
    i_cbp: i32,
    mb_x: usize,
    _mb_y: usize,
    mut c: usize,
    p_model: *mut CCBPModel,
) -> i32 {
    let mut i_pred_cbp: i32;
    let i_n_orig = num_ones(i_cbp);
    let i_n_diff = AVG_NDIFF;

    if (*p_sc).m_bCtxLeft != 0 {
        if (*p_sc).m_bCtxTop != 0 {
            i_pred_cbp = 1;
        } else {
            let i_top_cbp = (*(*p_sc).PredInfoPrevRow[c]
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(mb_x))
            .iCBP;
            i_pred_cbp = (i_top_cbp >> 10) & 1;
        }
    } else {
        let i_left_cbp = (*(*p_sc).PredInfo[c]
            .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
            .add(mb_x - 1))
        .iCBP;
        i_pred_cbp = (i_left_cbp >> 5) & 1;
    }

    i_pred_cbp |= (i_cbp & 0x3300) << 2;
    i_pred_cbp |= (i_cbp & 0xcc) << 6;
    i_pred_cbp |= (i_cbp & 0x33) << 2;
    i_pred_cbp |= (i_cbp & 0x11) << 1;
    i_pred_cbp |= (i_cbp & 0x2) << 3;

    if c != 0 {
        c = 1;
    }
    let i_retval = if (*p_model).m_iState[c] == 0 {
        i_pred_cbp ^ i_cbp
    } else if (*p_model).m_iState[c] == 1 {
        i_cbp
    } else {
        i_cbp ^ 0xffff
    };

    (*p_model).m_iCount0[c] += i_n_orig - i_n_diff;
    if ((*p_model).m_iCount0[c] + 16) as u32 >= 32 {
        if (*p_model).m_iCount0[c] < 0 {
            (*p_model).m_iCount0[c] = -16;
        } else {
            (*p_model).m_iCount0[c] = 15;
        }
    }

    (*p_model).m_iCount1[c] += 16 - i_n_orig - i_n_diff;
    if ((*p_model).m_iCount1[c] + 16) as u32 >= 32 {
        if (*p_model).m_iCount1[c] < 0 {
            (*p_model).m_iCount1[c] = -16;
        } else {
            (*p_model).m_iCount1[c] = 15;
        }
    }

    if (*p_model).m_iCount0[c] < 0 {
        if (*p_model).m_iCount0[c] < (*p_model).m_iCount1[c] {
            (*p_model).m_iState[c] = 1;
        } else {
            (*p_model).m_iState[c] = 2;
        }
    } else if (*p_model).m_iCount1[c] < 0 {
        (*p_model).m_iState[c] = 2;
    } else {
        (*p_model).m_iState[c] = 0;
    }

    i_retval
}

/// Original function: `predCBPC420Enc` at `original/jxrlib/image/encode/strPredQuantEnc.c:356`.
pub unsafe fn pred_cbpc420_enc(
    p_sc: *mut CWMImageStrCodec,
    i_cbp: i32,
    mb_x: usize,
    _mb_y: usize,
    c: usize,
    p_model: *mut CCBPModel,
) -> i32 {
    let mut i_pred_cbp: i32;
    let i_n_orig = num_ones(i_cbp) * 4;
    let i_n_diff = AVG_NDIFF;

    if (*p_sc).m_bCtxLeft != 0 {
        if (*p_sc).m_bCtxTop != 0 {
            i_pred_cbp = 1;
        } else {
            let i_top_cbp = (*(*p_sc).PredInfoPrevRow[c]
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(mb_x))
            .iCBP;
            i_pred_cbp = (i_top_cbp >> 2) & 1;
        }
    } else {
        let i_left_cbp = (*(*p_sc).PredInfo[c]
            .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
            .add(mb_x - 1))
        .iCBP;
        i_pred_cbp = (i_left_cbp >> 1) & 1;
    }

    i_pred_cbp |= (i_cbp & 0x1) << 1;
    i_pred_cbp |= (i_cbp & 0x3) << 2;

    let i_retval = if (*p_model).m_iState[1] == 0 {
        i_pred_cbp ^ i_cbp
    } else if (*p_model).m_iState[1] == 1 {
        i_cbp
    } else {
        i_cbp ^ 0xf
    };

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

    i_retval
}

/// Original function: `predCBPC422Enc` at `original/jxrlib/image/encode/strPredQuantEnc.c:414`.
pub unsafe fn pred_cbpc422_enc(
    p_sc: *mut CWMImageStrCodec,
    i_cbp: i32,
    mb_x: usize,
    _mb_y: usize,
    c: usize,
    p_model: *mut CCBPModel,
) -> i32 {
    let mut i_pred_cbp: i32;
    let i_n_orig = num_ones(i_cbp) * 2;
    let i_n_diff = AVG_NDIFF;

    if (*p_sc).m_bCtxLeft != 0 {
        if (*p_sc).m_bCtxTop != 0 {
            i_pred_cbp = 1;
        } else {
            let i_top_cbp = (*(*p_sc).PredInfoPrevRow[c]
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(mb_x))
            .iCBP;
            i_pred_cbp = (i_top_cbp >> 6) & 1;
        }
    } else {
        let i_left_cbp = (*(*p_sc).PredInfo[c]
            .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
            .add(mb_x - 1))
        .iCBP;
        i_pred_cbp = (i_left_cbp >> 1) & 1;
    }

    i_pred_cbp |= (i_cbp & 0x1) << 1;
    i_pred_cbp |= (i_cbp & 0x3) << 2;
    i_pred_cbp |= (i_cbp & 0xc) << 2;
    i_pred_cbp |= (i_cbp & 0x30) << 2;

    let i_retval = if (*p_model).m_iState[1] == 0 {
        i_pred_cbp ^ i_cbp
    } else if (*p_model).m_iState[1] == 1 {
        i_cbp
    } else {
        i_cbp ^ 0xff
    };

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

    i_retval
}

/// Original function: `predCBPEnc` at `original/jxrlib/image/encode/strPredQuantEnc.c:474`.
pub unsafe fn pred_cbp_enc(p_sc: &mut CWMImageStrCodec, p_context: &mut CCodingContext) {
    let p_sc = p_sc as *mut CWMImageStrCodec;
    let p_context = p_context as *mut CCodingContext;
    let mb_x = (*p_sc).cColumn - 1;
    let mb_y = (*p_sc).cRow - 1;
    let p_mb_info = std::ptr::addr_of_mut!((*p_sc).MBInfo);

    for i_channel in 0..(*p_sc).m_param.cNumChannels {
        let cf = (*p_sc).m_param.cfColorFormat;
        let b_uv = i_channel > 0;
        let i_num_block = if b_uv {
            if cf == ColorFormat::Yuv422 {
                8
            } else if cf == ColorFormat::Yuv420 {
                4
            } else {
                16
            }
        } else {
            16
        };
        let p_offset = if i_num_block == 4 {
            blk_offset_uv.as_ptr()
        } else if i_num_block == 8 {
            blk_offset_uv_422.as_ptr()
        } else {
            blk_offset.as_ptr()
        };
        let model_index = if b_uv { 1 } else { 0 };
        let threshold = (1 << (*p_context).m_aModelAC.m_iFlcBits[model_index]) - 1;
        let threshold2 = threshold * 2 + 1;
        let mut i_cbp = 0;

        for j in 0..i_num_block {
            let p_data = (*p_sc).pPlane[i_channel]
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(*p_offset.add(j) as usize);
            for i in 1..16 {
                if (*p_data.add(i) + threshold) as u32 >= threshold2 as u32 {
                    i_cbp |= 1 << j;
                    break;
                }
            }
        }

        (*p_mb_info).iCBP[i_channel] = i_cbp;
        (*(*p_sc).PredInfo[i_channel]
            .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
            .add(mb_x))
        .iCBP = i_cbp;

        if i_num_block == 16 {
            (*p_mb_info).iDiffCBP[i_channel] = pred_cbpc_enc(
                p_sc,
                (*p_mb_info).iCBP[i_channel],
                mb_x,
                mb_y,
                i_channel,
                std::ptr::addr_of_mut!((*p_context).m_aCBPModel),
            );
        } else if i_num_block == 8 {
            (*p_mb_info).iDiffCBP[i_channel] = pred_cbpc422_enc(
                p_sc,
                (*p_mb_info).iCBP[i_channel],
                mb_x,
                mb_y,
                i_channel,
                std::ptr::addr_of_mut!((*p_context).m_aCBPModel),
            );
        } else {
            (*p_mb_info).iDiffCBP[i_channel] = pred_cbpc420_enc(
                p_sc,
                (*p_mb_info).iCBP[i_channel],
                mb_x,
                mb_y,
                i_channel,
                std::ptr::addr_of_mut!((*p_context).m_aCBPModel),
            );
        }
    }
}
