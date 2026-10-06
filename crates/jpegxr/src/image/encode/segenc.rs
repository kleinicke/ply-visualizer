// Auto-generated scaffold for a faithful JXRLib translation restart.
// Keep one Rust item per original C item; replace stubs bottom-up.

use std::ptr::NonNull;

use crate::image::encode::str_pred_quant_enc::{pred_cbp_enc, pred_macroblock_enc};
use crate::image::sys::adapthuff::adapt_discriminant;
use crate::image::sys::common::{CAdaptiveHuffman, CONTEXTX, CTDC, MAXTOTAL, NUMVLCTABLES};
use crate::image::sys::image::{gSignificantRunBin, gSignificantRunFixedLength, update_model_mb};
use crate::image::sys::strcodec::{
    blk_offset, blk_offset_uv, blk_offset_uv_422, dct_index, put_bit16, put_bit16z, put_bit32,
    tagBitIOInfo, write_is, CAdaptiveScan, CCodingContext, CWMITile, CWMImageStrCodec,
    MAX_CHANNELS,
};
use crate::image::sys::windowsmediaphoto::{BitstreamFormat, Subband};
use crate::jxrgluelib::jxrglue::ColorFormat;
use crate::WmpError;

static G_RES: [i32; 65] = [
    65 * 2 + 1,
    63 * 2 + 1,
    61 * 2 + 1,
    59 * 2 + 1,
    57 * 2 + 1,
    55 * 2 + 1,
    53 * 2 + 1,
    51 * 2 + 1,
    49 * 2 + 1,
    47 * 2 + 1,
    45 * 2 + 1,
    43 * 2 + 1,
    41 * 2 + 1,
    39 * 2 + 1,
    37 * 2 + 1,
    35 * 2 + 1,
    33 * 2 + 1,
    31 * 2 + 1,
    29 * 2 + 1,
    27 * 2 + 1,
    25 * 2 + 1,
    23 * 2 + 1,
    21 * 2 + 1,
    19 * 2 + 1,
    17 * 2 + 1,
    15 * 2 + 1,
    13 * 2 + 1,
    11 * 2 + 1,
    9 * 2 + 1,
    7 * 2 + 1,
    5 * 2 + 1,
    3 * 2 + 1,
    0,
    2 * 2 + 1,
    4 * 2 + 1,
    6 * 2 + 1,
    8 * 2 + 1,
    10 * 2 + 1,
    12 * 2 + 1,
    14 * 2 + 1,
    16 * 2 + 1,
    18 * 2 + 1,
    20 * 2 + 1,
    22 * 2 + 1,
    24 * 2 + 1,
    26 * 2 + 1,
    28 * 2 + 1,
    30 * 2 + 1,
    32 * 2 + 1,
    34 * 2 + 1,
    36 * 2 + 1,
    38 * 2 + 1,
    40 * 2 + 1,
    42 * 2 + 1,
    44 * 2 + 1,
    46 * 2 + 1,
    48 * 2 + 1,
    50 * 2 + 1,
    52 * 2 + 1,
    54 * 2 + 1,
    56 * 2 + 1,
    58 * 2 + 1,
    60 * 2 + 1,
    62 * 2 + 1,
    64 * 2 + 1,
];

/// Original function: `EncodeSignificantAbsLevel` at `original/jxrlib/image/encode/segenc.c:55`.
pub unsafe fn encode_significant_abs_level(
    mut iAbsLevel: u32,
    pAHexpt: *mut CAdaptiveHuffman,
    pOut: *mut tagBitIOInfo,
) {
    let iIndex: i32;
    let iFixed: i32;
    let aIndex: [i32; 16] = [0, 1, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5];
    let aFixedLength: [i32; 6] = [0, 0, 1, 2, 2, 2];

    debug_assert!(iAbsLevel > 0);
    let Some(delta) = (*pAHexpt).m_pDelta else {
        return;
    };
    let Some(table) = (*pAHexpt).m_pTable else {
        return;
    };
    iAbsLevel = iAbsLevel.wrapping_sub(1);
    if iAbsLevel >= 16 {
        let mut i = iAbsLevel as i32;
        iIndex = 6;
        i >>= 5;
        let mut iFixedMut: i32 = 4;
        while i != 0 {
            iFixedMut += 1;
            debug_assert!(iFixedMut < 30);
            i >>= 1;
        }
        iFixed = iFixedMut;

        (*pAHexpt).m_iDiscriminant = (*pAHexpt)
            .m_iDiscriminant
            .wrapping_add(delta[iIndex as usize]);
        put_bit16z(
            pOut,
            table[(iIndex * 2 + 1) as usize] as _,
            table[(iIndex * 2 + 2) as usize] as _,
        );
        if iFixed > 18 {
            put_bit16z(pOut, 15, 4);
            if iFixed > 21 {
                put_bit16z(pOut, 3, 2);
                put_bit16(pOut, (iFixed - 22) as _, 3);
            } else {
                put_bit16z(pOut, (iFixed - 19) as _, 2);
            }
        } else {
            put_bit16z(pOut, (iFixed - 4) as _, 4);
        }
        put_bit32(pOut, iAbsLevel, iFixed as _);
    } else {
        iIndex = aIndex[iAbsLevel as usize];
        iFixed = aFixedLength[iIndex as usize];

        (*pAHexpt).m_iDiscriminant = (*pAHexpt)
            .m_iDiscriminant
            .wrapping_add(delta[iIndex as usize]);
        put_bit16z(
            pOut,
            table[(iIndex * 2 + 1) as usize] as _,
            table[(iIndex * 2 + 2) as usize] as _,
        );
        put_bit32(pOut, iAbsLevel, iFixed as _);
    }
}

/// Original function: `encodeQPIndex` at `original/jxrlib/image/encode/segenc.c:104`.
pub unsafe fn encode_qp_index(pIO: &mut tagBitIOInfo, iIndex: u8, cBits: u8) {
    if iIndex == 0 {
        put_bit16z(pIO, 0, 1);
    } else {
        put_bit16z(pIO, 1, 1);
        put_bit16z(pIO, iIndex.wrapping_sub(1) as _, cBits as _);
    }
}

/// Original function: `EncodeMacroblockDC` at `original/jxrlib/image/encode/segenc.c:114`.
pub unsafe fn encode_macroblock_dc(
    pSC: &mut CWMImageStrCodec,
    pContext: &mut CCodingContext,
    iMBX: i32,
    iMBY: i32,
) -> Result<(), WmpError> {
    let pSC = pSC as *mut CWMImageStrCodec;
    let pContext = pContext as *mut CCodingContext;
    let Some(tile) = (*pSC)
        .pTileMemory
        .as_deref_mut()
        .and_then(|tiles| tiles.get_mut((*pSC).cTileColumn))
    else {
        return Err(WmpError::Fail);
    };
    let p_tile = tile as *mut CWMITile;
    let p_io = (*pContext).m_pIODC;
    let p_mb_info = std::ptr::addr_of_mut!((*pSC).MBInfo);
    let i_index: i32;
    let mut j: i32 = 0;
    let p_ah: *mut CAdaptiveHuffman;
    let mut a_laplacian_mean: [i32; 2] = [0, 0];
    let mut p_lm = a_laplacian_mean.as_mut_ptr();
    let mut i_model_bits = (*pContext).m_aModelDC.m_iFlcBits[0];
    let cf = (*pSC).m_param.cfColorFormat;
    let i_channels = (*pSC).m_param.cNumChannels as i32;
    let mut qp_random_state = 0x4a58_4d42_u32
        ^ ((*pSC).cTileRow as u32).wrapping_mul(0x9e37_79b9)
        ^ ((*pSC).cTileColumn as u32).wrapping_mul(0x85eb_ca6b)
        ^ (iMBX as u32).wrapping_mul(0xc2b2_ae35)
        ^ (iMBY as u32).wrapping_mul(0x27d4_eb2f);

    write_is(p_io)?;

    if (*pSC).m_param.bTranscode == 0 {
        (*p_mb_info).iQIndexLP = if (*p_tile).cNumQPLP > 1 {
            qp_random_state = qp_random_state
                .wrapping_mul(1_103_515_245)
                .wrapping_add(12_345);
            (((qp_random_state >> 16) as i32) % (*p_tile).cNumQPLP as i32) as u8
        } else {
            0
        };
        (*p_mb_info).iQIndexHP = if (*p_tile).cNumQPHP > 1 {
            qp_random_state = qp_random_state
                .wrapping_mul(1_103_515_245)
                .wrapping_add(12_345);
            (((qp_random_state >> 16) as i32) % (*p_tile).cNumQPHP as i32) as u8
        } else {
            0
        };
    }
    if (*p_tile).cBitsHP == 0 && (*p_tile).cNumQPHP > 1 {
        (*p_mb_info).iQIndexHP = (*p_mb_info).iQIndexLP;
    }

    if (*pSC).WMISCP.bfBitstreamFormat == BitstreamFormat::Spatial
        && (*pSC).WMISCP.sbSubband != Subband::DcOnly
    {
        if (*p_tile).cBitsLP > 0 {
            encode_qp_index(&mut *p_io, (*p_mb_info).iQIndexLP, (*p_tile).cBitsLP);
        }
        if (*pSC).WMISCP.sbSubband != Subband::NoHighpass && (*p_tile).cBitsHP > 0 {
            encode_qp_index(&mut *p_io, (*p_mb_info).iQIndexHP, (*p_tile).cBitsHP);
        }
    }

    if (*pSC).m_param.bTranscode == 0 {
        if let Some(quantize) = (*pSC).Quantize {
            // C discards this return (faithful to EncodeMacroblockDC)
            let _ = quantize(&mut *pSC);
        }
    }

    pred_macroblock_enc(&mut *pSC);

    if cf == ColorFormat::YOnly || cf == ColorFormat::Cmyk || cf == ColorFormat::NComponent {
        let mut i_qdc: i32;
        let mut i_dc: i32;
        let mut i_sign: i32;
        while j < i_channels {
            i_dc = (*p_mb_info).iBlockDC[j as usize][0];
            i_sign = (i_dc < 0) as i32;
            i_dc = i_dc.abs();
            i_qdc = i_dc >> i_model_bits;

            if i_qdc != 0 {
                put_bit16z(p_io, 1, 1);
                let Some(ahexpt) = (*pContext).m_pAHexpt[3] else {
                    return Err(WmpError::Fail);
                };
                encode_significant_abs_level(i_qdc as u32, ahexpt.as_ptr(), p_io);
                *p_lm += 1;
            } else {
                put_bit16z(p_io, 0, 1);
            }

            put_bit16(p_io, i_dc as u32, i_model_bits as u32);
            if i_dc != 0 {
                put_bit16z(p_io, i_sign as u32, 1);
            }

            p_lm = a_laplacian_mean.as_mut_ptr().add(1);
            i_model_bits = (*pContext).m_aModelDC.m_iFlcBits[1];
            j += 1;
        }
    } else {
        let i_dcy: i32;
        let i_dcu: i32;
        let i_dcv: i32;
        let mut i_qdcy: i32;
        let mut i_qdcu: i32;
        let mut i_qdcv: i32;

        let Some(ahexpt) = (*pContext).m_pAHexpt[2] else {
            return Err(WmpError::Fail);
        };
        p_ah = ahexpt.as_ptr();
        i_dcy = (*p_mb_info).iBlockDC[0][0];
        i_qdcy = i_dcy.abs();
        i_dcu = (*p_mb_info).iBlockDC[1][0];
        i_qdcu = i_dcu.abs();
        i_dcv = (*p_mb_info).iBlockDC[2][0];
        i_qdcv = i_dcv.abs();
        if i_model_bits != 0 {
            i_qdcy >>= i_model_bits;
        }

        i_model_bits = (*pContext).m_aModelDC.m_iFlcBits[1];
        if i_model_bits != 0 {
            i_qdcu >>= i_model_bits;
            i_qdcv >>= i_model_bits;
        }
        i_model_bits = (*pContext).m_aModelDC.m_iFlcBits[0];

        i_index = ((i_qdcy != 0) as i32) * 4 + ((i_qdcu != 0) as i32) * 2 + ((i_qdcv != 0) as i32);
        let Some(table) = (*p_ah).m_pTable else {
            return Err(WmpError::Fail);
        };
        put_bit16z(
            p_io,
            table[(i_index * 2 + 1) as usize] as u32,
            table[(i_index * 2 + 2) as usize] as u32,
        );

        if i_qdcy != 0 {
            let Some(ahexpt) = (*pContext).m_pAHexpt[3] else {
                return Err(WmpError::Fail);
            };
            encode_significant_abs_level(i_qdcy as u32, ahexpt.as_ptr(), p_io);
            *p_lm += 1;
        }
        put_bit16(p_io, i_dcy.abs() as u32, i_model_bits as u32);
        if i_dcy != 0 {
            put_bit16z(p_io, (i_dcy < 0) as u32, 1);
        }

        p_lm = a_laplacian_mean.as_mut_ptr().add(1);
        i_model_bits = (*pContext).m_aModelDC.m_iFlcBits[1];

        if i_qdcu != 0 {
            let Some(ahexpt) = (*pContext).m_pAHexpt[4] else {
                return Err(WmpError::Fail);
            };
            encode_significant_abs_level(i_qdcu as u32, ahexpt.as_ptr(), p_io);
            *p_lm += 1;
        }
        put_bit16(p_io, i_dcu.abs() as u32, i_model_bits as u32);
        if i_dcu != 0 {
            put_bit16z(p_io, (i_dcu < 0) as u32, 1);
        }

        if i_qdcv != 0 {
            let Some(ahexpt) = (*pContext).m_pAHexpt[4] else {
                return Err(WmpError::Fail);
            };
            encode_significant_abs_level(i_qdcv as u32, ahexpt.as_ptr(), p_io);
            *p_lm += 1;
        }
        put_bit16(p_io, i_dcv.abs() as u32, i_model_bits as u32);
        if i_dcv != 0 {
            put_bit16z(p_io, (i_dcv < 0) as u32, 1);
        }
    }

    update_model_mb(
        cf,
        i_channels,
        &mut a_laplacian_mean,
        &mut (*pContext).m_aModelDC,
    );

    if (*pSC).m_bResetContext != 0 && (*pSC).WMISCP.sbSubband == Subband::DcOnly {
        let Some(mut ahexpt2) = (*pContext).m_pAHexpt[2] else {
            return Err(WmpError::Fail);
        };
        let Some(mut ahexpt3) = (*pContext).m_pAHexpt[3] else {
            return Err(WmpError::Fail);
        };
        let Some(mut ahexpt4) = (*pContext).m_pAHexpt[4] else {
            return Err(WmpError::Fail);
        };
        adapt_discriminant(ahexpt2.as_mut());
        adapt_discriminant(ahexpt3.as_mut());
        adapt_discriminant(ahexpt4.as_mut());
    }

    Ok(())
}

/// Original function: `AdaptiveScanZero` at `original/jxrlib/image/encode/segenc.c:247`.
pub unsafe fn adaptive_scan_zero(
    pCoeffs: *const i32,
    pScan: *mut CAdaptiveScan,
    pRLCoeffs: *mut i32,
    iCount: i32,
) -> i32 {
    let mut iRun: i32 = 1;
    let mut iNumNonzero: i32 = 0;

    let mut iLevel = *pCoeffs.add((*pScan.add(1)).uScan as usize);
    if iLevel != 0 {
        (*pScan.add(1)).uTotal = (*pScan.add(1)).uTotal.wrapping_add(1);
        *pRLCoeffs.add((iNumNonzero * 2) as usize) = 0;
        *pRLCoeffs.add((iNumNonzero * 2 + 1) as usize) = iLevel;
        iNumNonzero += 1;
        iRun = 0;
    }

    let mut k: i32 = 2;
    while k < iCount {
        iLevel = *pCoeffs.add((*pScan.add(k as usize)).uScan as usize);
        iRun += 1;
        if iLevel != 0 {
            (*pScan.add(k as usize)).uTotal = (*pScan.add(k as usize)).uTotal.wrapping_add(1);
            if (*pScan.add(k as usize)).uTotal > (*pScan.add((k - 1) as usize)).uTotal {
                let cTemp = *pScan.add(k as usize);
                *pScan.add(k as usize) = *pScan.add((k - 1) as usize);
                *pScan.add((k - 1) as usize) = cTemp;
            }
            *pRLCoeffs.add((iNumNonzero * 2) as usize) = iRun - 1;
            *pRLCoeffs.add((iNumNonzero * 2 + 1) as usize) = iLevel;
            iNumNonzero += 1;
            iRun = 0;
        }
        k += 1;
    }

    iNumNonzero
}

/// Original function: `AdaptiveScanTrim` at `original/jxrlib/image/encode/segenc.c:285`.
pub unsafe fn adaptive_scan_trim(
    pCoeffs: *const i32,
    pScan: *mut CAdaptiveScan,
    iModelBits: i32,
    pRLCoeffs: *mut i32,
    iCount: i32,
) -> i32 {
    let mut iRun: i32 = 1;
    let mut iNumNonzero: i32 = 0;
    let iThOff: u32 = (1u32 << iModelBits).wrapping_sub(1);
    let iTh: u32 = iThOff.wrapping_mul(2).wrapping_add(1);

    let mut iLevel = *pCoeffs.add((*pScan.add(1)).uScan as usize);
    if (iLevel as u32).wrapping_add(iThOff) >= iTh {
        let iTemp = if iLevel < 0 {
            iLevel.wrapping_neg()
        } else {
            iLevel
        } >> iModelBits;
        (*pScan.add(1)).uTotal = (*pScan.add(1)).uTotal.wrapping_add(1);
        *pRLCoeffs.add((iNumNonzero * 2) as usize) = 0;
        *pRLCoeffs.add((iNumNonzero * 2 + 1) as usize) = if iLevel < 0 { -iTemp } else { iTemp };
        iNumNonzero += 1;
        iRun = 0;
    }

    let mut k: i32 = 2;
    while k < iCount {
        iRun += 1;
        iLevel = *pCoeffs.add((*pScan.add(k as usize)).uScan as usize);
        if (iLevel as u32).wrapping_add(iThOff) >= iTh {
            let iTemp = if iLevel < 0 {
                iLevel.wrapping_neg()
            } else {
                iLevel
            } >> iModelBits;
            (*pScan.add(k as usize)).uTotal = (*pScan.add(k as usize)).uTotal.wrapping_add(1);
            if (*pScan.add(k as usize)).uTotal > (*pScan.add((k - 1) as usize)).uTotal {
                let cTemp = *pScan.add(k as usize);
                *pScan.add(k as usize) = *pScan.add((k - 1) as usize);
                *pScan.add((k - 1) as usize) = cTemp;
            }
            *pRLCoeffs.add((iNumNonzero * 2) as usize) = iRun - 1;
            *pRLCoeffs.add((iNumNonzero * 2 + 1) as usize) =
                if iLevel < 0 { -iTemp } else { iTemp };
            iNumNonzero += 1;
            iRun = 0;
        }
        k += 1;
    }

    iNumNonzero
}

/// Original function: `AdaptiveScan` at `original/jxrlib/image/encode/segenc.c:343`.
pub unsafe fn adaptive_scan(
    pCoeffs: *const i32,
    pResidual: *mut i32,
    pScan: *mut CAdaptiveScan,
    iModelBits: i32,
    iTrimBits: i32,
    pRLCoeffs: *mut i32,
    iCount: i32,
) -> i32 {
    if iModelBits == 0 {
        adaptive_scan_zero(pCoeffs, pScan, pRLCoeffs, iCount)
    } else if iModelBits <= iTrimBits {
        adaptive_scan_trim(pCoeffs, pScan, iModelBits, pRLCoeffs, iCount)
    } else if iTrimBits == 0 && iModelBits < 6 {
        let mut iRun: i32 = 0;
        let mut iNumNonzero: i32 = 0;
        let iThOff: u32 = (1u32 << iModelBits).wrapping_sub(1);
        let iTh: u32 = iThOff.wrapping_mul(2).wrapping_add(1);

        let mut iLevel = *pCoeffs.add((*pScan.add(1)).uScan as usize);
        if (iLevel as u32).wrapping_add(iThOff) >= iTh {
            let iTemp1 = if iLevel < 0 {
                iLevel.wrapping_neg()
            } else {
                iLevel
            };
            let iTemp = iTemp1 >> iModelBits;
            *pResidual.add((*pScan.add(1)).uScan as usize) = (iTemp1 & iThOff as i32) * 2;
            (*pScan.add(1)).uTotal = (*pScan.add(1)).uTotal.wrapping_add(1);
            *pRLCoeffs.add((iNumNonzero * 2) as usize) = iRun;
            *pRLCoeffs.add((iNumNonzero * 2 + 1) as usize) =
                if iLevel < 0 { -iTemp } else { iTemp };
            iNumNonzero += 1;
            iRun = 0;
        } else {
            iRun += 1;
            *pResidual.add((*pScan.add(1)).uScan as usize) = G_RES[(iLevel + 32) as usize];
        }

        let mut k: i32 = 2;
        while k < iCount {
            let sk = (*pScan.add(k as usize)).uScan as usize;
            iLevel = *pCoeffs.add(sk);
            if (iLevel as u32).wrapping_add(iThOff) >= iTh {
                let iSign: i32 = if iLevel < 0 { -1 } else { 0 };
                let iTemp1 = (iSign ^ iLevel) - iSign;
                let iTemp = iTemp1 >> iModelBits;
                *pResidual.add(sk) = (iTemp1 & iThOff as i32) * 2;
                (*pScan.add(k as usize)).uTotal = (*pScan.add(k as usize)).uTotal.wrapping_add(1);
                if (*pScan.add(k as usize)).uTotal > (*pScan.add((k - 1) as usize)).uTotal {
                    let cTemp = *pScan.add(k as usize);
                    *pScan.add(k as usize) = *pScan.add((k - 1) as usize);
                    *pScan.add((k - 1) as usize) = cTemp;
                }
                *pRLCoeffs.add((iNumNonzero * 2) as usize) = iRun;
                *pRLCoeffs.add((iNumNonzero * 2 + 1) as usize) = (iTemp ^ iSign) - iSign;
                iNumNonzero += 1;
                iRun = 0;
            } else {
                iRun += 1;
                *pResidual.add(sk) = G_RES[(iLevel + 32) as usize];
            }
            k += 1;
        }
        iNumNonzero
    } else {
        let mut iRun: i32 = 0;
        let mut iNumNonzero: i32 = 0;
        let iThOff: u32 = (1u32 << iModelBits).wrapping_sub(1);
        let iTh: u32 = iThOff.wrapping_mul(2).wrapping_add(1);

        let mut iLevel = *pCoeffs.add((*pScan.add(1)).uScan as usize);
        if (iLevel as u32).wrapping_add(iThOff) >= iTh {
            let iTemp1 = if iLevel < 0 {
                iLevel.wrapping_neg()
            } else {
                iLevel
            };
            let iTemp = iTemp1 >> iModelBits;
            *pResidual.add((*pScan.add(1)).uScan as usize) =
                ((iTemp1 & iThOff as i32) >> iTrimBits) * 2;
            (*pScan.add(1)).uTotal = (*pScan.add(1)).uTotal.wrapping_add(1);
            *pRLCoeffs.add((iNumNonzero * 2) as usize) = iRun;
            *pRLCoeffs.add((iNumNonzero * 2 + 1) as usize) =
                if iLevel < 0 { -iTemp } else { iTemp };
            iNumNonzero += 1;
            iRun = 0;
        } else {
            iRun += 1;
            let mut iTemp = if iLevel < 0 { -1 } else { 0 };
            iLevel = ((iLevel + iTemp) >> iTrimBits) - iTemp;
            iTemp = if iLevel < 0 { -1 } else { 0 };
            *pResidual.add((*pScan.add(1)).uScan as usize) =
                (iLevel ^ iTemp) * 4 + (6 & iTemp) + (iLevel != 0) as i32;
        }

        let mut k: i32 = 2;
        while k < iCount {
            let sk = (*pScan.add(k as usize)).uScan as usize;
            iLevel = *pCoeffs.add(sk);
            if (iLevel as u32).wrapping_add(iThOff) >= iTh {
                let iTemp1 = if iLevel < 0 {
                    iLevel.wrapping_neg()
                } else {
                    iLevel
                };
                let iTemp = iTemp1 >> iModelBits;
                *pResidual.add(sk) = ((iTemp1 & iThOff as i32) >> iTrimBits) * 2;
                (*pScan.add(k as usize)).uTotal = (*pScan.add(k as usize)).uTotal.wrapping_add(1);
                if (*pScan.add(k as usize)).uTotal > (*pScan.add((k - 1) as usize)).uTotal {
                    let cTemp = *pScan.add(k as usize);
                    *pScan.add(k as usize) = *pScan.add((k - 1) as usize);
                    *pScan.add((k - 1) as usize) = cTemp;
                }
                *pRLCoeffs.add((iNumNonzero * 2) as usize) = iRun;
                *pRLCoeffs.add((iNumNonzero * 2 + 1) as usize) =
                    if iLevel < 0 { -iTemp } else { iTemp };
                iNumNonzero += 1;
                iRun = 0;
            } else {
                iRun += 1;
                let mut iTemp = if iLevel < 0 { -1 } else { 0 };
                iLevel = ((iLevel + iTemp) >> iTrimBits) - iTemp;
                iTemp = if iLevel < 0 { -1 } else { 0 };
                *pResidual.add(sk) = (iLevel ^ iTemp) * 4 + (6 & iTemp) + (iLevel != 0) as i32;
            }
            k += 1;
        }
        iNumNonzero
    }
}

/// Original function: `EncodeMacroblockLowpass` at `original/jxrlib/image/encode/segenc.c:475`.
pub unsafe fn encode_macroblock_lowpass(
    p_sc: &mut CWMImageStrCodec,
    p_context: &mut CCodingContext,
    _i_mbx: i32,
    _i_mby: i32,
) -> Result<(), WmpError> {
    let p_sc = p_sc as *mut CWMImageStrCodec;
    let p_context = p_context as *mut CCodingContext;
    let cf = (*p_sc).m_param.cfColorFormat;
    let i_channels = (*p_sc).m_param.cNumChannels as i32;
    let mut i_full_channels = if cf == ColorFormat::Yuv420 || cf == ColorFormat::Yuv422 {
        1
    } else {
        i_channels
    };
    let p_mb_info = std::ptr::addr_of_mut!((*p_sc).MBInfo);
    let p_io = (*p_context).m_pIOLP;
    let p_scan = (*p_context).m_aScanLowpass.as_mut_ptr();
    let mut i_run: i32;
    let mut i_model_bits = (*p_context).m_aModelLP.m_iFlcBits[0];
    let mut a_buf: [[i32; 8]; 2] = [[0; 8]; 2];
    let mut a_laplacian_mean: [i32; 2] = [0, 0];
    let mut lm_index = 0usize;
    let mut i_val: i32;
    let mut a_rl_coeffs: [[i32; 32]; MAX_CHANNELS] = [[0; 32]; MAX_CHANNELS];
    let mut i_num_coeffs: [i32; MAX_CHANNELS] = [0; MAX_CHANNELS];
    let a_dc = &(*p_mb_info).iBlockDC;
    let mut a_residual: [[i32; 16]; MAX_CHANNELS] = [[0; 16]; MAX_CHANNELS];

    if i_channels > MAX_CHANNELS as i32 {
        return Err(WmpError::Fail);
    }

    let Some(tile) = (*p_sc)
        .pTileMemory
        .as_deref()
        .and_then(|tiles| tiles.get((*p_sc).cTileColumn))
    else {
        return Err(WmpError::Fail);
    };
    let p_tile = tile as *const CWMITile;
    if (*p_sc).WMISCP.bfBitstreamFormat != BitstreamFormat::Spatial && (*p_tile).cBitsLP > 0 {
        encode_qp_index(&mut *p_io, (*p_mb_info).iQIndexLP, (*p_tile).cBitsLP);
    }

    if (*p_sc).m_bResetRGITotals != 0 {
        let i_scale: i32 = 2;
        let mut i_weight: i32 = i_scale * 16;
        (*p_scan).uTotal = MAXTOTAL;
        for scan in &mut (&mut (*p_context).m_aScanLowpass)[1..16] {
            scan.uTotal = i_weight as u32;
            i_weight -= i_scale;
        }
    }

    for i_channel in 0..i_full_channels as usize {
        i_num_coeffs[i_channel] = adaptive_scan(
            a_dc[i_channel].as_ptr(),
            a_residual[i_channel].as_mut_ptr(),
            p_scan,
            i_model_bits,
            0,
            a_rl_coeffs[i_channel].as_mut_ptr(),
            16,
        );

        i_model_bits = (*p_context).m_aModelLP.m_iFlcBits[1];
    }

    if cf == ColorFormat::Yuv420 || cf == ColorFormat::Yuv422 {
        const A_REMAP: [i32; 7] = [4, 1, 2, 3, 5, 6, 7];
        let remap = &A_REMAP[(cf == ColorFormat::Yuv420) as usize..];
        let i_count = if cf == ColorFormat::Yuv420 { 6 } else { 14 };
        let mut i_coef: i32 = 0;

        i_run = 0;
        i_model_bits = (*p_context).m_aModelLP.m_iFlcBits[1];

        for k in 0..i_count {
            let i_index = remap[(k >> 1) as usize] as usize;
            let i_dc = a_dc[((k & 1) + 1) as usize][i_index];
            i_val = if i_dc < 0 { i_dc.wrapping_neg() } else { i_dc } >> i_model_bits;
            a_buf[(k & 1) as usize][i_index] = i_val;

            if i_val != 0 {
                a_rl_coeffs[1][(i_coef * 2) as usize] = i_run;
                a_rl_coeffs[1][(i_coef * 2 + 1) as usize] = if i_dc < 0 { -i_val } else { i_val };
                i_coef += 1;
                i_run = 0;
            } else {
                i_run += 1;
            }
        }
        i_num_coeffs[1] = i_coef;
    }

    if cf == ColorFormat::Yuv420 || cf == ColorFormat::Yuv422 {
        i_full_channels = 2;
    }

    if cf == ColorFormat::Yuv420 || cf == ColorFormat::Yuv422 || cf == ColorFormat::Yuv444 {
        let i_cbp: i32;
        let i_max = i_full_channels * 4 - 5;
        let mut i_count_m = (*p_context).m_iCBPCountMax;
        let mut i_count_z = (*p_context).m_iCBPCountZero;

        i_cbp = ((i_num_coeffs[0] > 0) as i32)
            + ((i_num_coeffs[1] > 0) as i32) * 2
            + if i_full_channels == 3 {
                ((i_num_coeffs[2] > 0) as i32) * 4
            } else {
                0
            };

        if i_count_z <= 0 || i_count_m < 0 {
            i_val = i_cbp;
            if i_count_m < i_count_z {
                i_val = i_max - i_cbp;
            }
            if i_val == 0 {
                put_bit16z(p_io, 0, 1);
            } else if i_val == 1 {
                put_bit16z(
                    p_io,
                    ((i_full_channels + 1) & 0x6) as u32,
                    i_full_channels as u32,
                );
            } else {
                put_bit16z(
                    p_io,
                    (i_val + i_max + 1) as u32,
                    (i_full_channels + 1) as u32,
                );
            }
        } else {
            put_bit16z(p_io, i_cbp as u32, i_full_channels as u32);
        }

        i_count_m += 1 - 4 * ((i_cbp == i_max) as i32);
        i_count_z += 1 - 4 * ((i_cbp == 0) as i32);
        if i_count_m < -8 {
            i_count_m = -8;
        } else if i_count_m > 7 {
            i_count_m = 7;
        }
        (*p_context).m_iCBPCountMax = i_count_m;

        if i_count_z < -8 {
            i_count_z = -8;
        } else if i_count_z > 7 {
            i_count_z = 7;
        }
        (*p_context).m_iCBPCountZero = i_count_z;
    } else {
        for &i_num_coeff in &i_num_coeffs[..i_channels as usize] {
            put_bit16z(p_io, (i_num_coeff > 0) as u32, 1);
        }
    }

    i_model_bits = (*p_context).m_aModelLP.m_iFlcBits[0];

    for i_channel in 0..i_full_channels as usize {
        let p_rl = a_rl_coeffs[i_channel].as_ptr();
        let i_coef = i_num_coeffs[i_channel];

        if i_coef != 0 {
            a_laplacian_mean[lm_index] += i_coef;
            if encode_block(
                (i_channel != 0) as i32,
                p_rl,
                i_coef,
                &mut (*p_context).m_pAHexpt,
                CTDC,
                p_io,
                (1 + 9 * ((cf == ColorFormat::Yuv420 && i_channel == 1) as i32)
                    + ((cf == ColorFormat::Yuv422 && i_channel == 1) as i32))
                    as u32,
            )
            .is_err()
            {
                return Err(WmpError::Fail);
            }
        }

        if i_model_bits != 0 {
            if (cf == ColorFormat::Yuv420 || cf == ColorFormat::Yuv422) && i_channel != 0 {
                for k in 1..if cf == ColorFormat::Yuv420 { 4 } else { 8 } {
                    let dc_u = a_dc[1][k];
                    let abs_u = if dc_u < 0 { dc_u.wrapping_neg() } else { dc_u };
                    if (*p_context).m_aModelLP.m_iFlcBits[0] > 14
                        || (*p_context).m_aModelLP.m_iFlcBits[1] > 14
                    {
                        put_bit32(p_io, abs_u as u32, i_model_bits as u32);
                    } else {
                        put_bit16(p_io, abs_u as u32, i_model_bits as u32);
                    }
                    if a_buf[0][k as usize] == 0 && dc_u != 0 {
                        put_bit16z(p_io, (dc_u < 0) as u32, 1);
                    }

                    let dc_v = a_dc[2][k];
                    let abs_v = if dc_v < 0 { dc_v.wrapping_neg() } else { dc_v };
                    if (*p_context).m_aModelLP.m_iFlcBits[0] > 14
                        || (*p_context).m_aModelLP.m_iFlcBits[1] > 14
                    {
                        put_bit32(p_io, abs_v as u32, i_model_bits as u32);
                    } else {
                        put_bit16(p_io, abs_v as u32, i_model_bits as u32);
                    }
                    if a_buf[1][k as usize] == 0 && dc_v != 0 {
                        put_bit16z(p_io, (dc_v < 0) as u32, 1);
                    }
                }
            } else {
                for &residual in &a_residual[i_channel][1..16] {
                    put_bit16z(
                        p_io,
                        (residual >> 1) as u32,
                        (i_model_bits + (residual & 1)) as u32,
                    );
                }
            }
        }

        lm_index = 1;
        i_model_bits = (*p_context).m_aModelLP.m_iFlcBits[1];
    }

    write_is(p_io)?;

    update_model_mb(
        cf,
        i_channels,
        &mut a_laplacian_mean,
        &mut (*p_context).m_aModelLP,
    );

    if (*p_sc).m_bResetContext != 0 {
        adapt_lowpass_enc(&mut *p_context);
    }

    Ok(())
}

/// Original function: `AdaptLowpassEnc` at `original/jxrlib/image/encode/segenc.c:657`.
pub unsafe fn adapt_lowpass_enc(p_sc: &mut CCodingContext) {
    let mut kk = 0;
    while kk < CONTEXTX + CTDC {
        let Some(mut ahexpt) = p_sc.m_pAHexpt[kk as usize] else {
            return;
        };
        adapt_discriminant(ahexpt.as_mut());
        kk += 1;
    }
}

/// Original function: `AdaptHighpassEnc` at `original/jxrlib/image/encode/segenc.c:665`.
pub unsafe fn adapt_highpass_enc(p_sc: &mut CCodingContext) {
    let mut kk = 0;
    let Some(mut adapt_huff_cbpcy) = p_sc.m_pAdaptHuffCBPCY else {
        return;
    };
    let Some(mut adapt_huff_cbpcy1) = p_sc.m_pAdaptHuffCBPCY1 else {
        return;
    };
    adapt_discriminant(adapt_huff_cbpcy.as_mut());
    adapt_discriminant(adapt_huff_cbpcy1.as_mut());
    while kk < CONTEXTX {
        let Some(mut ahexpt) = p_sc.m_pAHexpt[(kk + CONTEXTX + CTDC) as usize] else {
            return;
        };
        adapt_discriminant(ahexpt.as_mut());
        kk += 1;
    }
}

/// Original function: `EncodeSignificantRun` at `original/jxrlib/image/encode/segenc.c:693`.
pub unsafe fn encode_significant_run(
    iRun: i32,
    iMaxRun: i32,
    pAHexpt: *mut CAdaptiveHuffman,
    pOut: *mut tagBitIOInfo,
) {
    let aIndex: [i32; 34] = [
        0, 1, 2, 2, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4, 0, 1, 2, 2, 3, 3, 4, 4, 4, 4, 0, 0, 0, 0, 0, 1,
        2, 3, 4, 4,
    ];

    if iMaxRun < 5 {
        let gLen: [i32; 4] = [3, 3, 2, 1];
        if iMaxRun > 1 {
            put_bit16z(
                pOut,
                (iMaxRun != iRun) as u32,
                (gLen[(iMaxRun - iRun) as usize] - (4 - iMaxRun)) as u32,
            );
        }
        return;
    }

    let iBin = gSignificantRunBin[iMaxRun as usize];
    let iIndex = aIndex[(iRun + iBin * 14 - 1) as usize];
    let iFLC = gSignificantRunFixedLength[(iIndex + iBin * 5) as usize];
    let Some(table) = (*pAHexpt).m_pTable else {
        return;
    };
    put_bit16z(
        pOut,
        table[(iIndex * 2 + 1) as usize] as u32,
        table[(iIndex * 2 + 2) as usize] as u32,
    );
    put_bit16(pOut, (iRun + 1) as u32, iFLC as u32);
}

/// Original function: `EncodeFirstIndex` at `original/jxrlib/image/encode/segenc.c:735`.
pub unsafe fn encode_first_index(
    _bChroma: i32,
    _iLoc: i32,
    _iCont: i32,
    iIndex: i32,
    iSign: i32,
    pAHexpt: &mut Option<NonNull<CAdaptiveHuffman>>,
    pOut: *mut tagBitIOInfo,
) {
    let Some(pAHexpt) = *pAHexpt else {
        return;
    };
    let pAHexpt = pAHexpt.as_ptr();
    let Some(delta) = (*pAHexpt).m_pDelta else {
        return;
    };
    let Some(delta1) = (*pAHexpt).m_pDelta1 else {
        return;
    };
    let Some(table) = (*pAHexpt).m_pTable else {
        return;
    };
    (*pAHexpt).m_iDiscriminant = (*pAHexpt)
        .m_iDiscriminant
        .wrapping_add(delta[iIndex as usize]);
    (*pAHexpt).m_iDiscriminant1 = (*pAHexpt)
        .m_iDiscriminant1
        .wrapping_add(delta1[iIndex as usize]);
    put_bit16z(
        pOut,
        (table[(iIndex * 2 + 1) as usize] * 2 + iSign) as u32,
        (table[(iIndex * 2 + 2) as usize] + 1) as u32,
    );
}

/// Original function: `EncodeIndex` at `original/jxrlib/image/encode/segenc.c:751`.
pub unsafe fn encode_index(
    _bChroma: i32,
    iLoc: i32,
    _iCont: i32,
    iIndex: i32,
    iSign: i32,
    pAHexpt: &mut Option<NonNull<CAdaptiveHuffman>>,
    pOut: *mut tagBitIOInfo,
) {
    if iLoc < 15 {
        let Some(pAHexpt) = *pAHexpt else {
            return;
        };
        let pAHexpt = pAHexpt.as_ptr();
        let Some(delta) = (*pAHexpt).m_pDelta else {
            return;
        };
        let Some(delta1) = (*pAHexpt).m_pDelta1 else {
            return;
        };
        let Some(table) = (*pAHexpt).m_pTable else {
            return;
        };
        (*pAHexpt).m_iDiscriminant = (*pAHexpt)
            .m_iDiscriminant
            .wrapping_add(delta[iIndex as usize]);
        (*pAHexpt).m_iDiscriminant1 = (*pAHexpt)
            .m_iDiscriminant1
            .wrapping_add(delta1[iIndex as usize]);
        put_bit16z(
            pOut,
            (table[(iIndex * 2 + 1) as usize] * 2 + iSign) as u32,
            (table[(iIndex * 2 + 2) as usize] + 1) as u32,
        );
    } else if iLoc == 15 {
        let gCode: [u32; 4] = [0, 6, 2, 7];
        let gLen: [u32; 4] = [1, 3, 2, 3];
        put_bit16z(
            pOut,
            gCode[iIndex as usize] * 2 + iSign as u32,
            gLen[iIndex as usize] + 1,
        );
    } else {
        put_bit16z(pOut, (iIndex * 2 + iSign) as u32, 2);
    }
}

/// Original function: `EncodeBlock` at `original/jxrlib/image/encode/segenc.c:777`.
pub unsafe fn encode_block(
    bChroma: i32,
    aLocalCoef: *const i32,
    iNumNonzero: i32,
    pAHexpt: &mut [Option<NonNull<CAdaptiveHuffman>>; NUMVLCTABLES as usize],
    iContextOffset: i32,
    pOut: *mut tagBitIOInfo,
    mut iLocation: u32,
) -> Result<(), WmpError> {
    let mut iLev = *aLocalCoef.add(1);
    let iSR = (*aLocalCoef.add(0) == 0) as i32;
    let iSL = ((iLev + 1) as u32 > 2) as i32;
    let mut iSRn = 1;
    if iNumNonzero == 1 {
        iSRn = 0;
    } else if *aLocalCoef.add(2) > 0 {
        iSRn = 2;
    }
    let mut iIndex = iSRn * 4 + iSL * 2 + iSR;
    encode_first_index(
        bChroma,
        iLocation as i32,
        0,
        iIndex,
        (iLev < 0) as i32,
        &mut pAHexpt[(iContextOffset + bChroma * 3) as usize],
        pOut,
    );
    let mut iCont = iSR & iSRn;
    if iSL != 0 {
        let abs_lev = if iLev < 0 { iLev.wrapping_neg() } else { iLev };
        let Some(ahexpt) = pAHexpt[(6 + iContextOffset + iCont) as usize] else {
            return Err(WmpError::Fail);
        };
        encode_significant_abs_level((abs_lev - 1) as u32, ahexpt.as_ptr(), pOut);
    }
    if iSR == 0 {
        let Some(ahexpt) = pAHexpt[0] else {
            return Err(WmpError::Fail);
        };
        encode_significant_run(
            *aLocalCoef.add(0),
            15 - iLocation as i32,
            ahexpt.as_ptr(),
            pOut,
        );
    }
    iLocation = iLocation.wrapping_add((*aLocalCoef.add(0) + 1) as u32);

    let mut k = 1;
    while k < iNumNonzero {
        if iSRn == 2 {
            let Some(ahexpt) = pAHexpt[0] else {
                return Err(WmpError::Fail);
            };
            encode_significant_run(
                *aLocalCoef.add((k * 2) as usize),
                15 - iLocation as i32,
                ahexpt.as_ptr(),
                pOut,
            );
        }
        iLocation = iLocation.wrapping_add((*aLocalCoef.add((k * 2) as usize) + 1) as u32);
        iSRn = 1;
        if k == iNumNonzero - 1 {
            iSRn = 0;
        } else if *aLocalCoef.add((k * 2 + 2) as usize) > 0 {
            iSRn = 2;
        }
        iLev = *aLocalCoef.add((k * 2 + 1) as usize);
        let iSL = ((iLev + 1) as u32 > 2) as i32;
        iIndex = iSRn * 2 + iSL;
        encode_index(
            bChroma,
            iLocation as i32,
            iCont,
            iIndex,
            (iLev < 0) as i32,
            &mut pAHexpt[(iContextOffset + iCont + 1 + bChroma * 3) as usize],
            pOut,
        );

        iCont &= iSRn;
        if iSL != 0 {
            let abs_lev = if iLev < 0 { iLev.wrapping_neg() } else { iLev };
            let Some(ahexpt) = pAHexpt[(6 + iContextOffset + iCont) as usize] else {
                return Err(WmpError::Fail);
            };
            encode_significant_abs_level((abs_lev - 1) as u32, ahexpt.as_ptr(), pOut);
        }
        k += 1;
    }

    Ok(())
}

/// Original function: `CodeCoeffs` at `original/jxrlib/image/encode/segenc.c:841`.
pub unsafe fn code_coeffs(
    p_sc: *mut CWMImageStrCodec,
    p_context: *mut CCodingContext,
    _i_mbx: i32,
    _i_mby: i32,
    p_io: *mut tagBitIOInfo,
    p_io_fl: *mut tagBitIOInfo,
) -> Result<(), WmpError> {
    let cf = (*p_sc).m_param.cfColorFormat;
    let i_channels = (*p_sc).m_param.cNumChannels as i32;
    let i_planes = if cf == ColorFormat::Yuv420 || cf == ColorFormat::Yuv422 {
        1
    } else {
        i_channels
    };
    let p_mb_info = std::ptr::addr_of_mut!((*p_sc).MBInfo);
    let mut i_n_blocks: i32 = 4;
    let mut i_model_bits = (*p_context).m_aModelAC.m_iFlcBits[0];
    let mut i_flex: i32 = 0;
    let mut i_trim: i32 = 0;
    let mut i_mask: i32 = 0;
    let mut a_laplacian_mean: [i32; 2] = [0, 0];
    let mut lm_index = 0usize;
    let mut b_chroma: i32 = 0;

    debug_assert!(i_model_bits < 16);
    if (*p_context).m_iTrimFlexBits <= i_model_bits
        && (*p_sc).WMISCP.sbSubband != Subband::NoFlexbits
    {
        i_trim = (*p_context).m_iTrimFlexBits;
        i_flex = i_model_bits - (*p_context).m_iTrimFlexBits;
        i_mask = (1 << i_flex) - 1;
    }

    if (*p_sc).WMISCP.sbSubband != Subband::NoFlexbits {
        write_is(p_io_fl)?;
    }

    let p_scan = if (*p_mb_info).iOrientation == 1 {
        (*p_context).m_aScanVert.as_mut_ptr()
    } else {
        (*p_context).m_aScanHoriz.as_mut_ptr()
    };

    for i in 0..i_planes as usize {
        let mut i_pattern = (*p_mb_info).iCBP[i];

        if cf == ColorFormat::Yuv420 {
            i_n_blocks = 6;
            i_pattern += ((*p_mb_info).iCBP[1] << 16) + ((*p_mb_info).iCBP[2] << 20);
        } else if cf == ColorFormat::Yuv422 {
            i_n_blocks = 8;
            i_pattern += ((*p_mb_info).iCBP[1] << 16) + ((*p_mb_info).iCBP[2] << 24);
        }

        let mut i_index = 0usize;
        for i_block in 0..i_n_blocks {
            write_is(p_io)?;
            if p_io != p_io_fl {
                write_is(p_io_fl)?;
            }

            for i_subblock in 0..4 {
                let p_coeffs = if i_block < 4 {
                    (*p_sc).pPlane[i]
                        .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                        .add(blk_offset[i_index] as usize)
                } else if cf == ColorFormat::Yuv420 {
                    (*p_sc).pPlane[(i_block - 3) as usize]
                        .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                        .add(blk_offset_uv[i_subblock as usize] as usize)
                } else {
                    debug_assert_eq!(cf, ColorFormat::Yuv422);
                    (*p_sc).pPlane[(1 + ((i_block - 4) >> 1)) as usize]
                        .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                        .add(blk_offset_uv_422[((i_block & 1) * 4 + i_subblock) as usize] as usize)
                };

                if (i_pattern & 1) == 0 {
                    if i_flex != 0 {
                        for &dct in &dct_index[0][1..16] {
                            let data = *p_coeffs.add(dct as usize);
                            let atdata =
                                (if data < 0 { data.wrapping_neg() } else { data }) >> i_trim;
                            let mut word = atdata & i_mask;
                            let mut len = i_flex;
                            if atdata != 0 {
                                word += word + ((data < 0) as i32);
                                len += 1;
                            }
                            put_bit16z(p_io_fl, word as u32, len as u32);
                        }
                    }
                } else {
                    let mut a_local_coef: [i32; 32] = [0; 32];
                    let mut a_residual: [i32; 16] = [0; 16];

                    let i_num_nonzero = adaptive_scan(
                        p_coeffs,
                        a_residual.as_mut_ptr(),
                        p_scan,
                        i_model_bits,
                        i_trim,
                        a_local_coef.as_mut_ptr(),
                        16,
                    );
                    a_laplacian_mean[lm_index] += i_num_nonzero;
                    if encode_block(
                        b_chroma,
                        a_local_coef.as_ptr(),
                        i_num_nonzero,
                        &mut (*p_context).m_pAHexpt,
                        CTDC + CONTEXTX,
                        p_io,
                        1,
                    )
                    .is_err()
                    {
                        return Err(WmpError::Fail);
                    }

                    if i_flex != 0 {
                        for &dct in &dct_index[0][1..16] {
                            let residual = a_residual[dct as usize];
                            put_bit16z(
                                p_io_fl,
                                (residual >> 1) as u32,
                                (i_flex + (residual & 1)) as u32,
                            );
                        }
                    }
                }

                i_pattern >>= 1;
                i_index += 1;
            }

            if i_block == 3 {
                i_model_bits = (*p_context).m_aModelAC.m_iFlcBits[1];
                debug_assert!(i_model_bits < 16);
                lm_index = 1;
                b_chroma = 1;
                i_trim = 0;
                i_flex = 0;
                i_mask = 0;
                if (*p_context).m_iTrimFlexBits <= i_model_bits
                    && (*p_sc).WMISCP.sbSubband != Subband::NoFlexbits
                {
                    i_trim = (*p_context).m_iTrimFlexBits;
                    i_flex = i_model_bits - i_trim;
                    i_mask = (1 << i_flex) - 1;
                }
            }
        }
    }

    update_model_mb(
        cf,
        i_channels,
        &mut a_laplacian_mean,
        &mut (*p_context).m_aModelAC,
    );

    Ok(())
}

/// Original function: `CodeCBP` at `original/jxrlib/image/encode/segenc.c:972`.
pub unsafe fn code_cbp(
    p_sc: *mut CWMImageStrCodec,
    p_context: *mut CCodingContext,
    _i_mbx: i32,
    _i_mby: i32,
    p_io: *mut tagBitIOInfo,
) -> Result<(), WmpError> {
    let cf = (*p_sc).m_param.cfColorFormat;
    let i_channel = if cf == ColorFormat::NComponent || cf == ColorFormat::Cmyk {
        (*p_sc).m_param.cNumChannels as i32
    } else {
        1
    };
    let mut i_diff_cbpcu: i32;
    let mut i_diff_cbpcv: i32;
    let mut i_diff_cbpcy: i32;
    let mut i_dy: i32;
    let mut i_block: i32;
    let mut i: i32;
    let mut k: i32;
    const A_NUM_ONES: [i32; 16] = [0, 1, 1, 2, 1, 2, 2, 3, 1, 2, 2, 3, 2, 3, 3, 4];
    const A_TAB_LEN: [i32; 16] = [0, 2, 2, 2, 2, 2, 3, 2, 2, 3, 3, 2, 3, 2, 2, 0];
    const A_TAB_CODE: [i32; 16] = [0, 0, 1, 0, 2, 1, 4, 3, 3, 5, 6, 2, 7, 1, 0, 0];
    let mut p_ah: *mut CAdaptiveHuffman;
    let mut i_count: i32;
    let mut i_pattern: i32;
    let mut i_code: i32;
    let mut i_code_u: i32 = 0;
    let mut i_code_v: i32 = 0;

    pred_cbp_enc(&mut *p_sc, &mut *p_context);
    write_is(p_io)?;

    i_diff_cbpcu = (*p_sc).MBInfo.iDiffCBP[1];
    i_diff_cbpcv = (*p_sc).MBInfo.iDiffCBP[2];

    i = 0;
    while i < i_channel {
        i_diff_cbpcy = (*p_sc).MBInfo.iDiffCBP[i as usize];

        if cf == ColorFormat::Yuv420 {
            i_diff_cbpcy = (i_diff_cbpcy & 0xf)
                + ((i_diff_cbpcu & 1) << 4)
                + ((i_diff_cbpcv & 1) << 5)
                + ((i_diff_cbpcy & 0x00f0) << 2)
                + ((i_diff_cbpcu & 2) << 9)
                + ((i_diff_cbpcv & 2) << 10)
                + ((i_diff_cbpcy & 0x0f00) << 4)
                + ((i_diff_cbpcu & 4) << 14)
                + ((i_diff_cbpcv & 4) << 15)
                + ((i_diff_cbpcy & 0xf000) << 6)
                + ((i_diff_cbpcu & 8) << 19)
                + ((i_diff_cbpcv & 8) << 20);
        } else if cf == ColorFormat::Yuv422 {
            i_diff_cbpcy = (i_diff_cbpcy & 0xf)
                + ((i_diff_cbpcu & 1) << 4)
                + ((i_diff_cbpcu & 4) << 3)
                + ((i_diff_cbpcv & 1) << 6)
                + ((i_diff_cbpcv & 4) << 5)
                + ((i_diff_cbpcy & 0x00f0) << 4)
                + ((i_diff_cbpcu & 2) << 11)
                + ((i_diff_cbpcu & 8) << 10)
                + ((i_diff_cbpcv & 2) << 13)
                + ((i_diff_cbpcv & 8) << 12)
                + ((i_diff_cbpcy & 0x0f00) << 8)
                + ((i_diff_cbpcu & 16) << 16)
                + ((i_diff_cbpcu & 64) << 15)
                + ((i_diff_cbpcv & 16) << 18)
                + ((i_diff_cbpcv & 64) << 17)
                + ((i_diff_cbpcy & 0xf000) << 12)
                + ((i_diff_cbpcu & 32) << 23)
                + ((i_diff_cbpcu & 128) << 22)
                + ((i_diff_cbpcv & 32) << 25)
                + ((i_diff_cbpcv & 128) << 24);
        }

        i_pattern = 0;
        i_dy = i_diff_cbpcy;
        if cf == ColorFormat::Yuv444 {
            i_dy |= i_diff_cbpcu | i_diff_cbpcv;
        }

        i_block = 0;
        while i_block < 4 {
            if cf == ColorFormat::Yuv422 {
                i_pattern |= (((i_dy & 0xff) != 0) as i32) * 0x10;
                i_dy >>= 8;
            } else if cf == ColorFormat::Yuv420 {
                i_pattern |= (((i_dy & 0x3f) != 0) as i32) * 0x10;
                i_dy >>= 6;
            } else {
                i_pattern |= (((i_dy & 0xf) != 0) as i32) * 0x10;
                i_dy >>= 4;
            }
            i_pattern >>= 1;
            i_block += 1;
        }

        let Some(adapt_huff_cbpcy1) = (*p_context).m_pAdaptHuffCBPCY1 else {
            return Err(WmpError::Fail);
        };
        p_ah = adapt_huff_cbpcy1.as_ptr();
        i_count = A_NUM_ONES[i_pattern as usize];
        let Some(table) = (*p_ah).m_pTable else {
            return Err(WmpError::Fail);
        };
        let Some(delta) = (*p_ah).m_pDelta else {
            return Err(WmpError::Fail);
        };
        put_bit16z(
            p_io,
            table[(i_count * 2 + 1) as usize] as _,
            table[(i_count * 2 + 2) as usize] as _,
        );
        (*p_ah).m_iDiscriminant = (*p_ah)
            .m_iDiscriminant
            .wrapping_add(delta[i_count as usize]);
        if A_TAB_LEN[i_pattern as usize] != 0 {
            put_bit16z(
                p_io,
                A_TAB_CODE[i_pattern as usize] as _,
                A_TAB_LEN[i_pattern as usize] as _,
            );
        }

        i_block = 0;
        while i_block < 4 {
            if cf == ColorFormat::Yuv444 {
                i_code = i_diff_cbpcy & 0xf;
                i_code_u = i_diff_cbpcu & 0xf;
                i_code_v = i_diff_cbpcv & 0xf;
                i_code |= ((i_code_u != 0) as i32) << 4;
                i_code |= ((i_code_v != 0) as i32) << 5;
                i_diff_cbpcy >>= 4;
                i_diff_cbpcu >>= 4;
                i_diff_cbpcv >>= 4;
            } else if cf == ColorFormat::Yuv422 {
                i_code = i_diff_cbpcy & 0xff;
                i_diff_cbpcy >>= 8;
            } else if cf == ColorFormat::Yuv420 {
                i_code = i_diff_cbpcy & 0x3f;
                i_diff_cbpcy >>= 6;
            } else {
                i_code = i_diff_cbpcy & 0xf;
                i_diff_cbpcy >>= 4;
            }

            if i_code != 0 {
                const G_TAB0: [i32; 16] = [0, 1, 1, 2, 1, 3, 3, 4, 1, 3, 3, 4, 2, 4, 4, 5];
                const G_FL0: [i32; 16] = [0, 2, 2, 1, 2, 2, 2, 2, 2, 2, 2, 2, 1, 2, 2, 0];
                const G_CODE0: [i32; 16] = [0, 0, 1, 0, 2, 0, 1, 0, 3, 2, 3, 1, 1, 2, 3, 0];
                let val: i32;
                let mut i_chroma = i_code >> 4;
                i_code &= 0xf;

                if cf == ColorFormat::Yuv422 {
                    i_code_u = i_chroma & 3;
                    i_code_v = (i_chroma >> 2) & 3;
                    i_chroma = if i_code_u == 0 { 0 } else { 1 };
                    if i_code_v != 0 {
                        i_chroma += 2;
                    }
                }

                if i_chroma != 0 {
                    if G_TAB0[i_code as usize] > 2 {
                        val = 8;
                    } else {
                        val = G_TAB0[i_code as usize] + 6 - 1;
                    }
                } else {
                    val = G_TAB0[i_code as usize] - 1;
                }
                let Some(adapt_huff_cbpcy) = (*p_context).m_pAdaptHuffCBPCY else {
                    return Err(WmpError::Fail);
                };
                p_ah = adapt_huff_cbpcy.as_ptr();
                let Some(table) = (*p_ah).m_pTable else {
                    return Err(WmpError::Fail);
                };
                let Some(delta) = (*p_ah).m_pDelta else {
                    return Err(WmpError::Fail);
                };
                put_bit16z(
                    p_io,
                    table[(val * 2 + 1) as usize] as _,
                    table[(val * 2 + 2) as usize] as _,
                );
                (*p_ah).m_iDiscriminant = (*p_ah).m_iDiscriminant.wrapping_add(delta[val as usize]);

                if i_chroma != 0 {
                    if i_chroma == 1 {
                        put_bit16z(p_io, 1, 1);
                    } else {
                        put_bit16z(p_io, (3 - i_chroma) as _, 2);
                    }
                }
                if val == 8 {
                    if G_TAB0[i_code as usize] == 3 {
                        put_bit16z(p_io, 1, 1);
                    } else {
                        put_bit16z(p_io, (5 - G_TAB0[i_code as usize]) as _, 2);
                    }
                }
                if G_FL0[i_code as usize] != 0 {
                    put_bit16z(
                        p_io,
                        G_CODE0[i_code as usize] as _,
                        G_FL0[i_code as usize] as _,
                    );
                }

                if cf == ColorFormat::Yuv444 {
                    let Some(ahexpt) = (*p_context).m_pAHexpt[1] else {
                        return Err(WmpError::Fail);
                    };
                    p_ah = ahexpt.as_ptr();
                    i_pattern = i_code_u;
                    k = 0;
                    while k < 2 {
                        if i_pattern != 0 {
                            i_count = A_NUM_ONES[i_pattern as usize];
                            i_count -= 1;
                            let Some(table) = (*p_ah).m_pTable else {
                                return Err(WmpError::Fail);
                            };
                            put_bit16z(
                                p_io,
                                table[(i_count * 2 + 1) as usize] as _,
                                table[(i_count * 2 + 2) as usize] as _,
                            );
                            if A_TAB_LEN[i_pattern as usize] != 0 {
                                put_bit16z(
                                    p_io,
                                    A_TAB_CODE[i_pattern as usize] as _,
                                    A_TAB_LEN[i_pattern as usize] as _,
                                );
                            }
                        }
                        i_pattern = i_code_v;
                        k += 1;
                    }
                } else if cf == ColorFormat::Yuv422 {
                    i_pattern = i_code_u;
                    k = 0;
                    while k < 2 {
                        if i_pattern != 0 {
                            if i_pattern == 1 {
                                put_bit16z(p_io, 1, 1);
                            } else {
                                put_bit16z(p_io, (3 - i_pattern) as _, 2);
                            }
                        }
                        i_pattern = i_code_v;
                        k += 1;
                    }
                }
            }
            i_block += 1;
        }

        i += 1;
    }

    Ok(())
}

/// Original function: `EncodeMacroblockHighpass` at `original/jxrlib/image/encode/segenc.c:1158`.
pub unsafe fn encode_macroblock_highpass(
    p_sc: &mut CWMImageStrCodec,
    p_context: &mut CCodingContext,
    i_mbx: i32,
    i_mby: i32,
) -> Result<(), WmpError> {
    let p_sc = p_sc as *mut CWMImageStrCodec;
    let p_context = p_context as *mut CCodingContext;
    let p_io = (*p_context).m_pIOAC;
    let p_io_fl = (*p_context).m_pIOFL;

    let Some(tile) = (*p_sc)
        .pTileMemory
        .as_deref()
        .and_then(|tiles| tiles.get((*p_sc).cTileColumn))
    else {
        return Err(WmpError::Fail);
    };
    let p_tile = tile as *const CWMITile;
    if (*p_sc).WMISCP.bfBitstreamFormat != BitstreamFormat::Spatial && (*p_tile).cBitsHP > 0 {
        encode_qp_index(&mut *p_io, (*p_sc).MBInfo.iQIndexHP, (*p_tile).cBitsHP);
    }

    if (*p_sc).m_bResetRGITotals != 0 {
        let i_scale: i32 = 2;
        let mut i_weight: i32 = i_scale * 16;
        (*p_context).m_aScanHoriz[0].uTotal = MAXTOTAL;
        (*p_context).m_aScanVert[0].uTotal = MAXTOTAL;
        let mut k = 1;
        while k < 16 {
            (*p_context).m_aScanHoriz[k as usize].uTotal = i_weight as u32;
            (*p_context).m_aScanVert[k as usize].uTotal = i_weight as u32;
            i_weight -= i_scale;
            k += 1;
        }
    }

    code_cbp(p_sc, p_context, i_mbx, i_mby, p_io)?;
    if code_coeffs(p_sc, p_context, i_mbx, i_mby, p_io, p_io_fl).is_err() {
        return Err(WmpError::Fail);
    }

    if (*p_sc).m_bResetContext != 0 {
        adapt_highpass_enc(&mut *p_context);
    }

    Ok(())
}
