// Auto-generated scaffold for a faithful JXRLib translation restart.
// Keep one Rust item per original C item; replace stubs bottom-up.

use crate::image::sys::strcodec::{
    tagCWMIMBInfo, tagCWMIPredInfo, tagCWMIQuantizer, CWMImageStrCodec, MAX_CHANNELS,
};
use crate::jxrgluelib::jxrglue::ColorFormat;
use crate::WmpError;
use std::ptr::NonNull;

pub const SHIFTZERO: i32 = 1;
pub const QPFRACBITS: i32 = 2;

/// Original struct: `tagQPManExp` at `original/jxrlib/image/sys/strPredQuant.c:34`.
#[repr(C)]
#[derive(Debug, Clone, Copy, Default)]
pub struct tagQPManExp {
    pub iMan: i32,
    pub iExp: i32,
}

static gs_QPRecipTable: [tagQPManExp; 32] = [
    tagQPManExp { iMan: 0x0, iExp: 0 },
    tagQPManExp { iMan: 0x0, iExp: 0 },
    tagQPManExp { iMan: 0x0, iExp: 1 },
    tagQPManExp {
        iMan: 0xaaaaaaabu32 as i32,
        iExp: 1,
    },
    tagQPManExp { iMan: 0x0, iExp: 2 },
    tagQPManExp {
        iMan: 0xcccccccdu32 as i32,
        iExp: 2,
    },
    tagQPManExp {
        iMan: 0xaaaaaaabu32 as i32,
        iExp: 2,
    },
    tagQPManExp {
        iMan: 0x92492493u32 as i32,
        iExp: 2,
    },
    tagQPManExp { iMan: 0x0, iExp: 3 },
    tagQPManExp {
        iMan: 0xe38e38e4u32 as i32,
        iExp: 3,
    },
    tagQPManExp {
        iMan: 0xcccccccdu32 as i32,
        iExp: 3,
    },
    tagQPManExp {
        iMan: 0xba2e8ba3u32 as i32,
        iExp: 3,
    },
    tagQPManExp {
        iMan: 0xaaaaaaabu32 as i32,
        iExp: 3,
    },
    tagQPManExp {
        iMan: 0x9d89d89eu32 as i32,
        iExp: 3,
    },
    tagQPManExp {
        iMan: 0x92492493u32 as i32,
        iExp: 3,
    },
    tagQPManExp {
        iMan: 0x88888889u32 as i32,
        iExp: 3,
    },
    tagQPManExp { iMan: 0x0, iExp: 4 },
    tagQPManExp {
        iMan: 0xf0f0f0f1u32 as i32,
        iExp: 4,
    },
    tagQPManExp {
        iMan: 0xe38e38e4u32 as i32,
        iExp: 4,
    },
    tagQPManExp {
        iMan: 0xd79435e6u32 as i32,
        iExp: 4,
    },
    tagQPManExp {
        iMan: 0xcccccccdu32 as i32,
        iExp: 4,
    },
    tagQPManExp {
        iMan: 0xc30c30c4u32 as i32,
        iExp: 4,
    },
    tagQPManExp {
        iMan: 0xba2e8ba3u32 as i32,
        iExp: 4,
    },
    tagQPManExp {
        iMan: 0xb21642c9u32 as i32,
        iExp: 4,
    },
    tagQPManExp {
        iMan: 0xaaaaaaabu32 as i32,
        iExp: 4,
    },
    tagQPManExp {
        iMan: 0xa3d70a3eu32 as i32,
        iExp: 4,
    },
    tagQPManExp {
        iMan: 0x9d89d89eu32 as i32,
        iExp: 4,
    },
    tagQPManExp {
        iMan: 0x97b425eeu32 as i32,
        iExp: 4,
    },
    tagQPManExp {
        iMan: 0x92492493u32 as i32,
        iExp: 4,
    },
    tagQPManExp {
        iMan: 0x8d3dcb09u32 as i32,
        iExp: 4,
    },
    tagQPManExp {
        iMan: 0x88888889u32 as i32,
        iExp: 4,
    },
    tagQPManExp {
        iMan: 0x84210843u32 as i32,
        iExp: 4,
    },
];

/// Original function: `remapQP` at `original/jxrlib/image/sys/strPredQuant.c:79`.
pub unsafe fn remap_qp(pQP: &mut tagCWMIQuantizer, iShift: i32, bScaledArith: i32) {
    let uiQPIndex = pQP.iIndex;

    if uiQPIndex == 0 {
        pQP.iQP = 1;
        pQP.iMan = 0;
        pQP.iExp = 0;
        pQP.iOffset = 0;
    } else if bScaledArith == 0 {
        let man;
        let exp;
        let ciShift = SHIFTZERO - (SHIFTZERO + QPFRACBITS);

        if pQP.iIndex < 32 {
            man = ((pQP.iIndex as i32) + 3) >> 2;
            exp = ciShift + 2;
        } else if pQP.iIndex < 48 {
            man = (16 + ((pQP.iIndex as i32) & 0xf) + 1) >> 1;
            exp = ((pQP.iIndex as i32 >> 4) - 1) + 1 + ciShift;
        } else {
            man = 16 + ((pQP.iIndex as i32) & 0xf);
            exp = ((pQP.iIndex as i32 >> 4) - 1) + ciShift;
        }

        pQP.iQP = man.wrapping_shl(exp as u32);
        pQP.iMan = gs_QPRecipTable[man as usize].iMan;
        pQP.iExp = gs_QPRecipTable[man as usize].iExp + exp;
        pQP.iOffset = (pQP.iQP.wrapping_mul(3).wrapping_add(1)) >> 3;
    } else {
        let man;
        let exp;

        if pQP.iIndex < 16 {
            man = pQP.iIndex as i32;
            exp = iShift;
        } else {
            man = 16 + ((pQP.iIndex as i32) & 0xf);
            exp = ((pQP.iIndex as i32 >> 4) - 1) + iShift;
        }

        pQP.iQP = man.wrapping_shl(exp as u32);
        pQP.iMan = gs_QPRecipTable[man as usize].iMan;
        pQP.iExp = gs_QPRecipTable[man as usize].iExp + exp;
        pQP.iOffset = (pQP.iQP.wrapping_mul(3).wrapping_add(1)) >> 3;
    }
}

/// Original function: `allocatePredInfo` at `original/jxrlib/image/sys/strPredQuant.c:125`.
pub fn allocate_pred_info(sc: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    let mb_width = sc.cmbWidth;
    let i_channels = sc.m_param.cNumChannels;
    let b32_bit = std::mem::size_of::<usize>() == 4;

    if b32_bit
        && (((mb_width >> 16)
            .wrapping_mul(i_channels)
            .wrapping_mul(2)
            .wrapping_mul(std::mem::size_of::<tagCWMIPredInfo>()))
            & 0xffff0000)
            != 0
    {
        return Err(WmpError::Fail);
    }

    let pred_info_count = mb_width.wrapping_mul(i_channels).wrapping_mul(2);
    let mut pred_info = Vec::new();
    if pred_info.try_reserve_exact(pred_info_count).is_err() {
        return Err(WmpError::Fail);
    }
    pred_info.resize(pred_info_count, tagCWMIPredInfo::default());
    let mut pred_info = pred_info.into_boxed_slice();
    sc.cPredInfoMemory = pred_info_count;

    let mut chunks = pred_info.chunks_exact_mut(mb_width);
    for i in 0..i_channels {
        let Some(row) = chunks.next() else {
            sc.PredInfo = [None; MAX_CHANNELS];
            sc.PredInfoPrevRow = [None; MAX_CHANNELS];
            sc.cPredInfoMemory = 0;
            return Err(WmpError::Fail);
        };
        let Some(pred_info_row) = NonNull::new(row.as_mut_ptr()) else {
            sc.PredInfo = [None; MAX_CHANNELS];
            sc.PredInfoPrevRow = [None; MAX_CHANNELS];
            sc.cPredInfoMemory = 0;
            return Err(WmpError::Fail);
        };
        sc.PredInfo[i] = Some(pred_info_row);

        let Some(prev_row) = chunks.next() else {
            sc.PredInfo = [None; MAX_CHANNELS];
            sc.PredInfoPrevRow = [None; MAX_CHANNELS];
            sc.cPredInfoMemory = 0;
            return Err(WmpError::Fail);
        };
        let Some(pred_info_prev_row) = NonNull::new(prev_row.as_mut_ptr()) else {
            sc.PredInfo = [None; MAX_CHANNELS];
            sc.PredInfoPrevRow = [None; MAX_CHANNELS];
            sc.cPredInfoMemory = 0;
            return Err(WmpError::Fail);
        };
        sc.PredInfoPrevRow[i] = Some(pred_info_prev_row);

        for pred in row.iter_mut().chain(prev_row.iter_mut()) {
            pred.piAD = NonNull::new(pred.iAD.as_mut_ptr());
        }
    }

    sc.pPredInfoMemory = Some(pred_info);

    Ok(())
}

/// Original function: `getACPredMode` at `original/jxrlib/image/sys/strPredQuant.c:166`.
pub unsafe fn get_ac_pred_mode(mb_info: &tagCWMIMBInfo, cf: ColorFormat) -> i32 {
    const ORIENT_WEIGHT: i32 = 4;
    let coeffs = &mb_info.iBlockDC[0];
    let mut str_h = coeffs[1].abs() + coeffs[2].abs() + coeffs[3].abs();
    let mut str_v = coeffs[4].abs() + coeffs[8].abs() + coeffs[12].abs();

    if cf != ColorFormat::YOnly && cf != ColorFormat::NComponent {
        let coeffs_u = &mb_info.iBlockDC[1];
        let coeffs_v = &mb_info.iBlockDC[2];

        str_h += coeffs_u[1].abs() + coeffs_v[1].abs();
        if cf == ColorFormat::Yuv420 {
            str_v += coeffs_u[2].abs() + coeffs_v[2].abs();
        } else if cf == ColorFormat::Yuv422 {
            str_v += coeffs_u[2].abs() + coeffs_v[2].abs() + coeffs_u[6].abs() + coeffs_v[6].abs();
            str_h += coeffs_u[5].abs() + coeffs_v[5].abs();
        } else {
            str_v += coeffs_u[4].abs() + coeffs_v[4].abs();
        }
    }

    if str_h * ORIENT_WEIGHT < str_v {
        1
    } else if str_v * ORIENT_WEIGHT < str_h {
        0
    } else {
        2
    }
}

/// Original function: `getDCACPredMode` at `original/jxrlib/image/sys/strPredQuant.c:194`.
pub unsafe fn get_dcac_pred_mode(sc: &CWMImageStrCodec, mb_x: usize) -> i32 {
    const ORIENT_WEIGHT: i32 = 4;
    let i_dc_mode;
    let mut i_ad_mode = 2;

    if sc.m_bCtxLeft != 0 && sc.m_bCtxTop != 0 {
        i_dc_mode = 3;
    } else if sc.m_bCtxLeft != 0 {
        i_dc_mode = 1;
    } else if sc.m_bCtxTop != 0 {
        i_dc_mode = 0;
    } else {
        let cf = sc.m_param.cfColorFormat;
        let Some(pred_info) = sc.PredInfo[0] else {
            return 0;
        };
        let Some(pred_info_prev_row) = sc.PredInfoPrevRow[0] else {
            return 0;
        };
        let pred_info = pred_info.as_ptr();
        let pred_info_prev_row = pred_info_prev_row.as_ptr();
        let i_l = (*pred_info.add(mb_x - 1)).iDC;
        let i_t = (*pred_info_prev_row.add(mb_x)).iDC;
        let i_tl = (*pred_info_prev_row.add(mb_x - 1)).iDC;
        let str_h;
        let str_v;

        if cf == ColorFormat::YOnly || cf == ColorFormat::NComponent {
            str_h = (i_tl - i_l).abs();
            str_v = (i_tl - i_t).abs();
        } else {
            let Some(pred_info_prev_row_u) = sc.PredInfoPrevRow[1] else {
                return 0;
            };
            let Some(pred_info_u) = sc.PredInfo[1] else {
                return 0;
            };
            let Some(pred_info_prev_row_v) = sc.PredInfoPrevRow[2] else {
                return 0;
            };
            let Some(pred_info_v) = sc.PredInfo[2] else {
                return 0;
            };
            let p_tu = pred_info_prev_row_u.as_ptr().add(mb_x);
            let p_lu = pred_info_u.as_ptr().add(mb_x - 1);
            let p_tlu = p_tu.offset(-1);
            let p_tv = pred_info_prev_row_v.as_ptr().add(mb_x);
            let p_lv = pred_info_v.as_ptr().add(mb_x - 1);
            let p_tlv = p_tv.offset(-1);
            let scale = if cf == ColorFormat::Yuv420 {
                8
            } else if cf == ColorFormat::Yuv422 {
                4
            } else {
                2
            };

            str_h = (i_tl - i_l).abs() * scale
                + ((*p_tlu).iDC - (*p_lu).iDC).abs()
                + ((*p_tlv).iDC - (*p_lv).iDC).abs();
            str_v = (i_tl - i_t).abs() * scale
                + ((*p_tlu).iDC - (*p_tu).iDC).abs()
                + ((*p_tlv).iDC - (*p_tv).iDC).abs();
        }
        i_dc_mode = if str_h * ORIENT_WEIGHT < str_v {
            1
        } else if str_v * ORIENT_WEIGHT < str_h {
            0
        } else {
            2
        };
    }

    let Some(pred_info_y) = sc.PredInfo[0] else {
        return i_dc_mode + (i_ad_mode << 2);
    };
    let Some(pred_info_prev_row_y) = sc.PredInfoPrevRow[0] else {
        return i_dc_mode + (i_ad_mode << 2);
    };

    if i_dc_mode == 1
        && sc.MBInfo.iQIndexLP as i32 == (*pred_info_prev_row_y.as_ptr().add(mb_x)).iQPIndex
    {
        i_ad_mode = 1;
    }
    if i_dc_mode == 0
        && sc.MBInfo.iQIndexLP as i32 == (*pred_info_y.as_ptr().add(mb_x - 1)).iQPIndex
    {
        i_ad_mode = 0;
    }

    i_dc_mode + (i_ad_mode << 2)
}

/// Original function: `copyAC` at `original/jxrlib/image/sys/strPredQuant.c:236`.
pub unsafe fn copy_ac(src: &[i32], dst: &mut [i32]) {
    dst[0] = src[1];
    dst[1] = src[2];
    dst[2] = src[3];
    dst[3] = src[4];
    dst[4] = src[8];
    dst[5] = src[12];
}

/// Original function: `updatePredInfo` at `original/jxrlib/image/sys/strPredQuant.c:250`.
pub unsafe fn update_pred_info(
    p_sc: *mut CWMImageStrCodec,
    p_mb_info: *mut tagCWMIMBInfo,
    mb_x: usize,
    cf: ColorFormat,
) {
    let i_channels = if cf == ColorFormat::Yuv420 || cf == ColorFormat::Yuv422 {
        1
    } else {
        (*p_sc).m_param.cNumChannels as i32
    };

    let mut i = 0;
    while i < i_channels {
        let Some(pred_info) = (*p_sc).PredInfo[i as usize] else {
            return;
        };
        let p_pred_info = pred_info.as_ptr().add(mb_x);
        let p = (*p_mb_info).iBlockDC[i as usize].as_ptr();

        (*p_pred_info).iDC = *p.add(0);
        (*p_pred_info).iQPIndex = (*p_mb_info).iQIndexLP as i32;
        let dc = &(*p_mb_info).iBlockDC[i as usize];
        let Some(pi_ad) = (*p_pred_info).piAD else {
            return;
        };
        let ac = std::slice::from_raw_parts_mut(pi_ad.as_ptr(), 6);
        copy_ac(dc, ac);

        i += 1;
    }

    if cf == ColorFormat::Yuv420 {
        i = 1;
        while i < 3 {
            let Some(pred_info) = (*p_sc).PredInfo[i as usize] else {
                return;
            };
            let p_pred_info = pred_info.as_ptr().add(mb_x);
            let p = (*p_mb_info).iBlockDC[i as usize].as_ptr();

            (*p_pred_info).iDC = *p.add(0);
            (*p_pred_info).iQPIndex = (*p_mb_info).iQIndexLP as i32;
            let Some(pi_ad) = (*p_pred_info).piAD else {
                return;
            };
            *pi_ad.as_ptr().add(0) = *p.add(1);
            *pi_ad.as_ptr().add(1) = *p.add(2);

            i += 1;
        }
    } else if cf == ColorFormat::Yuv422 {
        i = 1;
        while i < 3 {
            let Some(pred_info) = (*p_sc).PredInfo[i as usize] else {
                return;
            };
            let p_pred_info = pred_info.as_ptr().add(mb_x);
            let p = (*p_mb_info).iBlockDC[i as usize].as_ptr();

            (*p_pred_info).iQPIndex = (*p_mb_info).iQIndexLP as i32;
            (*p_pred_info).iDC = *p.add(0);
            let Some(pi_ad) = (*p_pred_info).piAD else {
                return;
            };
            *pi_ad.as_ptr().add(0) = *p.add(1);
            *pi_ad.as_ptr().add(1) = *p.add(2);
            *pi_ad.as_ptr().add(2) = *p.add(5);
            *pi_ad.as_ptr().add(3) = *p.add(6);
            *pi_ad.as_ptr().add(4) = *p.add(4);

            i += 1;
        }
    }
}
