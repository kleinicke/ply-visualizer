// Auto-generated scaffold for a faithful JXRLib translation restart.
// Keep one Rust item per original C item; replace stubs bottom-up.

use std::ptr::NonNull;

use crate::image::sys::adapthuff::adapt_discriminant;
use crate::image::sys::common::{CAdaptiveHuffman, CONTEXTX, CTDC, MAXTOTAL, NUMVLCTABLES};
use crate::image::sys::image::{gSignificantRunBin, gSignificantRunFixedLength, update_model_mb};
use crate::image::sys::strcodec::{
    blk_offset, blk_offset_uv, blk_offset_uv_422, byteswap_ulong, dct_index,
    peek_bit16 as sys_peek_bit16, read_is, tagBitIOInfo, CAdaptiveScan, CCodingContext,
    CWMImageStrCodec, MAX_CHANNELS,
};
use crate::image::sys::windowsmediaphoto::{BitstreamFormat, Subband};
use crate::jxrgluelib::jxrglue::ColorFormat;
use crate::WmpError;

use super::str_pred_quant_dec::pred_cbp_dec;

pub const HUFFMAN_DECODE_ROOT_BITS_LOG: i32 = 3;
pub const HUFFMAN_DECODE_ROOT_BITS: u32 = 5;

/// Original function: `_load4` at `original/jxrlib/image/decode/segdec.c:55`.
/// Rust identifier adjusted from original name `_load4`.
pub unsafe fn load4(pv: *const u8) -> u32 {
    #[cfg(target_endian = "big")]
    {
        std::ptr::read_unaligned(pv.cast::<u32>())
    }
    #[cfg(not(target_endian = "big"))]
    {
        byteswap_ulong(std::ptr::read_unaligned(pv.cast::<u32>()))
    }
}

/// Original function: `_peekBit16` at `original/jxrlib/image/decode/segdec.c:71`.
/// Rust identifier adjusted from original name `_peekBit16`.
pub unsafe fn peek_bit16(io: &tagBitIOInfo, cBits: u32) -> u32 {
    debug_assert!(cBits <= 16);
    io.uiAccumulator.wrapping_shr(32_u32.wrapping_sub(cBits))
}

/// Original function: `_flushBit16` at `original/jxrlib/image/decode/segdec.c:78`.
/// Rust identifier adjusted from original name `_flushBit16`.
pub unsafe fn flush_bit16(io: &mut tagBitIOInfo, cBits: u32) -> u32 {
    debug_assert!(cBits <= 16);
    debug_assert_eq!(io.iMask & 1, 0);
    io.cBitsUsed = io.cBitsUsed.wrapping_add(cBits);
    io.pbCurrent = ((io.pbCurrent.add((io.cBitsUsed >> 3) as usize) as isize) & (io.iMask as isize))
        as *mut u8;
    io.cBitsUsed &= 16 - 1;
    io.uiAccumulator = load4(io.pbCurrent).wrapping_shl(io.cBitsUsed);
    0
}

/// Original function: `_getBit16` at `original/jxrlib/image/decode/segdec.c:83`.
/// Rust identifier adjusted from original name `_getBit16`.
pub unsafe fn get_bit16(io: &mut tagBitIOInfo, cBits: u32) -> u32 {
    let uiRet = peek_bit16(io, cBits);
    flush_bit16(io, cBits);
    uiRet
}

/// Original function: `getHuff` at `original/jxrlib/image/decode/segdec.c:95`.
pub unsafe fn get_huff(decode_table: &[i16], pIO: *mut tagBitIOInfo) -> i32 {
    let mut iSymbol: i32 =
        decode_table[sys_peek_bit16(&*pIO, HUFFMAN_DECODE_ROOT_BITS) as usize] as i32;

    crate::image::sys::strcodec::flush_bit16(
        &mut *pIO,
        if iSymbol < 0 {
            HUFFMAN_DECODE_ROOT_BITS
        } else {
            (iSymbol & ((1 << HUFFMAN_DECODE_ROOT_BITS_LOG) - 1)) as u32
        },
    );
    let mut iSymbolHuff = iSymbol >> HUFFMAN_DECODE_ROOT_BITS_LOG;

    if iSymbolHuff < 0 {
        iSymbolHuff = iSymbol;
        loop {
            iSymbol = decode_table[(iSymbolHuff
                + (1 << 15)
                + crate::image::sys::strcodec::get_bit16(&mut *pIO, 1) as i32)
                as usize] as i32;
            iSymbolHuff = iSymbol;
            if iSymbolHuff >= 0 {
                break;
            }
        }
    }

    iSymbolHuff
}

/// Original function: `_getBool16` at `original/jxrlib/image/decode/segdec.c:111`.
/// Rust identifier adjusted from original name `_getBool16`.
pub unsafe fn get_bool16(io: &mut tagBitIOInfo) -> u32 {
    let uiRet = io.uiAccumulator >> 31;
    io.cBitsUsed += 1;
    if io.cBitsUsed < 16 {
        io.uiAccumulator <<= 1;
    } else {
        io.pbCurrent = ((io.pbCurrent.add((io.cBitsUsed >> 3) as usize) as isize)
            & (io.iMask as isize)) as *mut u8;
        io.cBitsUsed &= 16 - 1;
        io.uiAccumulator = load4(io.pbCurrent).wrapping_shl(io.cBitsUsed);
    }
    uiRet
}

/// Original function: `_getSign` at `original/jxrlib/image/decode/segdec.c:128`.
/// Rust identifier adjusted from original name `_getSign`.
pub unsafe fn get_sign(io: &mut tagBitIOInfo) -> i32 {
    let uiRet = (io.uiAccumulator as i32) >> 31;
    io.cBitsUsed += 1;
    if io.cBitsUsed < 16 {
        io.uiAccumulator <<= 1;
    } else {
        io.pbCurrent = ((io.pbCurrent.add((io.cBitsUsed >> 3) as usize) as isize)
            & (io.iMask as isize)) as *mut u8;
        io.cBitsUsed &= 16 - 1;
        io.uiAccumulator = load4(io.pbCurrent).wrapping_shl(io.cBitsUsed);
    }
    uiRet
}

/// Original function: `_getBit16s` at `original/jxrlib/image/decode/segdec.c:150`.
/// Rust identifier adjusted from original name `_getBit16s`.
pub unsafe fn get_bit16s(io: &mut tagBitIOInfo, cBits: u32) -> i32 {
    let mut iRet = peek_bit16(io, cBits + 1) as i32;
    iRet = ((iRet >> 1) ^ (-(iRet & 1))) + (iRet & 1);
    flush_bit16(io, cBits + (iRet != 0) as u32);
    iRet
}

/// Original function: `_getHuffShort` at `original/jxrlib/image/decode/segdec.c:161`.
/// Rust identifier adjusted from original name `_getHuffShort`.
pub unsafe fn get_huff_short(decode_table: &[i16], pIO: *mut tagBitIOInfo) -> i32 {
    let iSymbol = decode_table[peek_bit16(&*pIO, HUFFMAN_DECODE_ROOT_BITS) as usize] as i32;
    debug_assert!(iSymbol >= 0);
    crate::image::sys::strcodec::flush_bit16(
        &mut *pIO,
        (iSymbol & ((1 << HUFFMAN_DECODE_ROOT_BITS_LOG) - 1)) as u32,
    );
    iSymbol >> HUFFMAN_DECODE_ROOT_BITS_LOG
}

/// Original function: `AdaptDecFixed` at `original/jxrlib/image/decode/segdec.c:172`.
pub unsafe fn adapt_dec_fixed(p_ah: &mut CAdaptiveHuffman) -> Result<(), WmpError> {
    adapt_discriminant(p_ah);
    Ok(())
}

/// Original function: `DecodeCBP` at `original/jxrlib/image/decode/segdec.c:181`.
pub unsafe fn decode_cbp(
    p_sc: &mut CWMImageStrCodec,
    p_context: &mut CCodingContext,
) -> Result<(), WmpError> {
    let p_sc = p_sc as *mut CWMImageStrCodec;
    let p_context = p_context as *mut CCodingContext;
    let p_io = (*p_context).m_pIOAC;
    let cf = (*p_sc).m_param.cfColorFormat;
    let i_channel = if cf == ColorFormat::NComponent || cf == ColorFormat::Cmyk {
        (*p_sc).m_param.cNumChannels as i32
    } else {
        1
    };
    let Some(p_ah_cbp) = (*p_context).m_pAdaptHuffCBPCY else {
        return Err(WmpError::Fail);
    };
    let p_ah_cbp = p_ah_cbp.as_ptr();
    let Some(p_ah_cbp1) = (*p_context).m_pAdaptHuffCBPCY1 else {
        return Err(WmpError::Fail);
    };
    let p_ah_cbp1 = p_ah_cbp1.as_ptr();
    let Some(p_ahex1) = (*p_context).m_pAHexpt[1] else {
        return Err(WmpError::Fail);
    };
    let p_ahex1 = p_ahex1.as_ptr();

    read_is(p_io)?;

    let mut i = 0;
    while i < i_channel {
        let mut i_cbpcy = 0;
        let mut i_cbpcu = 0;
        let mut i_cbpcv = 0;
        let Some(cbp1_decode_table) = (*p_ah_cbp1).m_hufDecTable else {
            return Err(WmpError::Fail);
        };
        let mut i_num_cbp = get_huff_short(cbp1_decode_table, p_io);
        let Some(cbp1_delta) = (*p_ah_cbp1).m_pDelta else {
            return Err(WmpError::Fail);
        };
        (*p_ah_cbp1).m_iDiscriminant += cbp1_delta[i_num_cbp as usize];

        match i_num_cbp {
            2 => {
                i_num_cbp = get_bit16(&mut *p_io, 2) as i32;
                if i_num_cbp == 0 {
                    i_num_cbp = 3;
                } else if i_num_cbp == 1 {
                    i_num_cbp = 5;
                } else {
                    let a_tab: [i32; 4] = [6, 9, 10, 12];
                    i_num_cbp = a_tab[(i_num_cbp * 2 + get_bool16(&mut *p_io) as i32 - 4) as usize];
                }
            }
            1 => {
                i_num_cbp = 1 << get_bit16(&mut *p_io, 2);
            }
            3 => {
                i_num_cbp = 0xf ^ (1 << get_bit16(&mut *p_io, 2));
            }
            4 => {
                i_num_cbp = 0xf;
            }
            _ => {}
        }

        let mut i_block = 0;
        while i_block < 4 {
            if (i_num_cbp & (1 << i_block)) != 0 {
                let g_flc0: [u32; 6] = [0, 2, 1, 2, 2, 0];
                let g_off0: [u32; 6] = [0, 4, 2, 8, 12, 1];
                let g_out0: [u32; 16] = [0, 15, 3, 12, 1, 2, 4, 8, 5, 6, 9, 10, 7, 11, 13, 14];
                let Some(cbp_decode_table) = (*p_ah_cbp).m_hufDecTable else {
                    return Err(WmpError::Fail);
                };
                let mut i_num_block_cbp = get_huff(cbp_decode_table, p_io);
                let mut val = i_num_block_cbp as u32 + 1;

                let Some(cbp_delta) = (*p_ah_cbp).m_pDelta else {
                    return Err(WmpError::Fail);
                };
                (*p_ah_cbp).m_iDiscriminant += cbp_delta[i_num_block_cbp as usize];
                i_num_block_cbp = 0;

                if val >= 6 {
                    if get_bool16(&mut *p_io) != 0 {
                        i_num_block_cbp = 0x10;
                    } else if get_bool16(&mut *p_io) != 0 {
                        i_num_block_cbp = 0x20;
                    } else {
                        i_num_block_cbp = 0x30;
                    }
                    if val == 9 {
                        if get_bool16(&mut *p_io) != 0 {
                        } else if get_bool16(&mut *p_io) != 0 {
                            val = 10;
                        } else {
                            val = 11;
                        }
                    }
                    val -= 6;
                }
                let mut i_code1 = g_off0[val as usize];
                if g_flc0[val as usize] != 0 {
                    i_code1 += get_bit16(&mut *p_io, g_flc0[val as usize]);
                }
                i_num_block_cbp += g_out0[i_code1 as usize] as i32;

                if cf == ColorFormat::Yuv444 {
                    i_cbpcy |= (i_num_block_cbp & 0xf) << (i_block * 4);
                    let mut k = 0;
                    while k < 2 {
                        let b_is_chroma = (i_num_block_cbp >> (k + 4)) & 0x01;
                        if b_is_chroma != 0 {
                            let Some(ahex1_decode_table) = (*p_ahex1).m_hufDecTable else {
                                return Err(WmpError::Fail);
                            };
                            let mut i_code = get_huff_short(ahex1_decode_table, p_io);
                            match i_code {
                                1 => {
                                    i_code = get_bit16(&mut *p_io, 2) as i32;
                                    if i_code == 0 {
                                        i_code = 3;
                                    } else if i_code == 1 {
                                        i_code = 5;
                                    } else {
                                        let a_tab: [i32; 4] = [6, 9, 10, 12];
                                        i_code = a_tab[(i_code * 2 + get_bool16(&mut *p_io) as i32
                                            - 4)
                                            as usize];
                                    }
                                }
                                0 => {
                                    i_code = 1 << get_bit16(&mut *p_io, 2);
                                }
                                2 => {
                                    i_code = 0xf ^ (1 << get_bit16(&mut *p_io, 2));
                                }
                                3 => {
                                    i_code = 0xf;
                                }
                                _ => {}
                            }
                            if k == 0 {
                                i_cbpcu |= i_code << (i_block * 4);
                            } else {
                                i_cbpcv |= i_code << (i_block * 4);
                            }
                        }
                        k += 1;
                    }
                } else if cf == ColorFormat::Yuv420 {
                    i_cbpcy |= (i_num_block_cbp & 0xf) << (i_block * 4);
                    i_cbpcu |= ((i_num_block_cbp >> 4) & 0x1) << i_block;
                    i_cbpcv |= ((i_num_block_cbp >> 5) & 0x1) << i_block;
                } else if cf == ColorFormat::Yuv422 {
                    i_cbpcy |= (i_num_block_cbp & 0xf) << (i_block * 4);
                    let mut k = 0;
                    while k < 2 {
                        let mut i_code = 5;
                        let i_shift: [i32; 4] = [0, 1, 4, 5];
                        if ((i_num_block_cbp >> (k + 4)) & 0x01) != 0 {
                            if get_bool16(&mut *p_io) != 0 {
                                i_code = 1;
                            } else if get_bool16(&mut *p_io) != 0 {
                                i_code = 4;
                            }
                            i_code <<= i_shift[i_block as usize];
                            if k == 0 {
                                i_cbpcu |= i_code;
                            } else {
                                i_cbpcv |= i_code;
                            }
                        }
                        k += 1;
                    }
                } else {
                    i_cbpcy |= i_num_block_cbp << (i_block * 4);
                }
            }
            i_block += 1;
        }

        (*p_sc).MBInfo.iDiffCBP[i as usize] = i_cbpcy;
        if cf == ColorFormat::Yuv420 || cf == ColorFormat::Yuv444 || cf == ColorFormat::Yuv422 {
            (*p_sc).MBInfo.iDiffCBP[1] = i_cbpcu;
            (*p_sc).MBInfo.iDiffCBP[2] = i_cbpcv;
        }
        i += 1;
    }
    Ok(())
}

/// Original function: `DecodeSignificantRun` at `original/jxrlib/image/decode/segdec.c:356`.
pub unsafe fn decode_significant_run(
    iMaxRun: i32,
    pAHexpt: *mut CAdaptiveHuffman,
    pIO: *mut tagBitIOInfo,
) -> Option<i32> {
    let aRemap: [i32; 15] = [1, 2, 3, 5, 7, 1, 2, 3, 5, 7, 1, 2, 3, 4, 5];
    let iBin = gSignificantRunBin[iMaxRun as usize];

    if iMaxRun < 5 {
        if iMaxRun == 1 {
            return Some(1);
        } else if get_bool16(&mut *pIO) != 0 {
            return Some(1);
        } else if iMaxRun == 2 || get_bool16(&mut *pIO) != 0 {
            return Some(2);
        } else if iMaxRun == 3 || get_bool16(&mut *pIO) != 0 {
            return Some(3);
        }
        return Some(4);
    }

    // C dereferences pAHexpt->m_hufDecTable unconditionally; None is the defensive Rust equivalent.
    let Some(decode_table) = (*pAHexpt).m_hufDecTable else {
        return None;
    };
    let mut iIndex = get_huff_short(decode_table, pIO);
    iIndex += iBin * 5;
    let mut iRun = aRemap[iIndex as usize];
    let iFLC = gSignificantRunFixedLength[iIndex as usize];
    if iFLC != 0 {
        iRun += get_bit16(&mut *pIO, iFLC as u32) as i32;
    }
    Some(iRun)
}

/// Original function: `DecodeFirstIndex` at `original/jxrlib/image/decode/segdec.c:392`.
pub unsafe fn decode_first_index(
    pIndex: *mut i32,
    pAHexpt: *mut CAdaptiveHuffman,
    pIO: *mut tagBitIOInfo,
) {
    let Some(decode_table) = (*pAHexpt).m_hufDecTable else {
        return;
    };
    let iIndex = get_huff(decode_table, pIO);
    let Some(delta) = (*pAHexpt).m_pDelta else {
        return;
    };
    (*pAHexpt).m_iDiscriminant = (*pAHexpt)
        .m_iDiscriminant
        .wrapping_add(delta[iIndex as usize]);
    let Some(delta1) = (*pAHexpt).m_pDelta1 else {
        return;
    };
    (*pAHexpt).m_iDiscriminant1 = (*pAHexpt)
        .m_iDiscriminant1
        .wrapping_add(delta1[iIndex as usize]);
    *pIndex = iIndex;
}

/// Original function: `DecodeIndex` at `original/jxrlib/image/decode/segdec.c:407`.
pub unsafe fn decode_index(
    pIndex: *mut i32,
    iLoc: i32,
    pAHexpt: *mut CAdaptiveHuffman,
    pIO: *mut tagBitIOInfo,
) {
    let iIndex: i32;
    if iLoc < 15 {
        let Some(decode_table) = (*pAHexpt).m_hufDecTable else {
            return;
        };
        iIndex = get_huff_short(decode_table, pIO);
        let Some(delta) = (*pAHexpt).m_pDelta else {
            return;
        };
        (*pAHexpt).m_iDiscriminant = (*pAHexpt)
            .m_iDiscriminant
            .wrapping_add(delta[iIndex as usize]);
        let Some(delta1) = (*pAHexpt).m_pDelta1 else {
            return;
        };
        (*pAHexpt).m_iDiscriminant1 = (*pAHexpt)
            .m_iDiscriminant1
            .wrapping_add(delta1[iIndex as usize]);
        *pIndex = iIndex;
    } else if iLoc == 15 {
        if get_bool16(&mut *pIO) == 0 {
            iIndex = 0;
        } else if get_bool16(&mut *pIO) == 0 {
            iIndex = 2;
        } else {
            iIndex = 1 + 2 * get_bool16(&mut *pIO) as i32;
        }
        *pIndex = iIndex;
    } else {
        let iSL = get_bit16(&mut *pIO, 1) as i32;
        *pIndex = iSL;
    }
}

/// Original function: `DecodeBlock` at `original/jxrlib/image/decode/segdec.c:436`.
pub unsafe fn decode_block(
    bChroma: i32,
    aLocalCoef: *mut i32,
    pAHexpt: *mut Option<NonNull<CAdaptiveHuffman>>,
    iContextOffset: i32,
    pIO: *mut tagBitIOInfo,
    mut iLocation: i32,
) -> Option<i32> {
    let mut iIndex: i32 = 0;
    let mut iNumNonzero: i32 = 1;
    let pAH1 = pAHexpt.add((iContextOffset + bChroma * 3) as usize);

    let Some(ahexpt) = *pAH1.add(0) else {
        return Some(0);
    };
    decode_first_index(std::ptr::addr_of_mut!(iIndex), ahexpt.as_ptr(), pIO);
    let mut iSR = iIndex & 1;
    let mut iSRn = iIndex >> 2;

    let mut iCont = iSR & iSRn;
    let mut iSign = get_sign(&mut *pIO);

    if (iIndex & 2) != 0 {
        let Some(ahexpt) = *pAHexpt.add((6 + iContextOffset + iCont) as usize) else {
            return Some(0);
        };
        *aLocalCoef.add(1) = (decode_significant_abs_level(ahexpt.as_ptr(), pIO)? ^ iSign) - iSign;
    } else {
        *aLocalCoef.add(1) = 1 | iSign;
    }
    *aLocalCoef.add(0) = 0;
    if iSR == 0 {
        let Some(ahexpt) = *pAHexpt.add(0) else {
            return Some(0);
        };
        *aLocalCoef.add(0) = decode_significant_run(15 - iLocation, ahexpt.as_ptr(), pIO)?;
    }
    iLocation += *aLocalCoef.add(0) + 1;

    while iSRn != 0 {
        iSR = iSRn & 1;
        *aLocalCoef.add((iNumNonzero * 2) as usize) = 0;
        if iSR == 0 {
            let Some(ahexpt) = *pAHexpt.add(0) else {
                return Some(0);
            };
            *aLocalCoef.add((iNumNonzero * 2) as usize) =
                decode_significant_run(15 - iLocation, ahexpt.as_ptr(), pIO)?;
        }
        iLocation += *aLocalCoef.add((iNumNonzero * 2) as usize) + 1;
        let Some(ahexpt) = *pAH1.add((iCont + 1) as usize) else {
            return Some(0);
        };
        decode_index(
            std::ptr::addr_of_mut!(iIndex),
            iLocation,
            ahexpt.as_ptr(),
            pIO,
        );
        iSRn = iIndex >> 1;

        debug_assert!(iSRn >= 0 && iSRn < 3);
        iCont &= iSRn;
        iSign = get_sign(&mut *pIO);

        if (iIndex & 1) != 0 {
            let Some(ahexpt) = *pAHexpt.add((6 + iContextOffset + iCont) as usize) else {
                return Some(0);
            };
            *aLocalCoef.add((iNumNonzero * 2 + 1) as usize) =
                (decode_significant_abs_level(ahexpt.as_ptr(), pIO)? ^ iSign) - iSign;
        } else {
            *aLocalCoef.add((iNumNonzero * 2 + 1) as usize) = 1 | iSign;
        }
        iNumNonzero += 1;
    }
    Some(iNumNonzero)
}

/// Original function: `DecodeBlockHighpass` at `original/jxrlib/image/decode/segdec.c:491`.
pub unsafe fn decode_block_highpass(
    bChroma: i32,
    pAHexpt: *mut Option<NonNull<CAdaptiveHuffman>>,
    pIO: *mut tagBitIOInfo,
    iQP: i32,
    pCoef: *mut i32,
    pScan: *mut CAdaptiveScan,
) -> Option<i32> {
    let iContextOffset = CTDC + CONTEXTX;
    let mut iLoc: u32 = 1;
    let mut iIndex: i32 = 0;
    let mut iNumNonzero: i32 = 1;
    let pAH1 = pAHexpt.add((iContextOffset + bChroma * 3) as usize);

    let Some(ahexpt) = *pAH1.add(0) else {
        return Some(0);
    };
    decode_first_index(std::ptr::addr_of_mut!(iIndex), ahexpt.as_ptr(), pIO);
    let mut iSR = iIndex & 1;
    let mut iSRn = iIndex >> 2;

    let mut iCont = iSR & iSRn;
    let mut iSign = get_sign(&mut *pIO);

    let mut iLevel = (iQP ^ iSign) - iSign;
    if (iIndex & 2) != 0 {
        let Some(ahexpt) = *pAHexpt.add((6 + iContextOffset + iCont) as usize) else {
            return Some(0);
        };
        iLevel *= decode_significant_abs_level(ahexpt.as_ptr(), pIO)?;
    }
    if iSR == 0 {
        let Some(ahexpt) = *pAHexpt.add(0) else {
            return Some(0);
        };
        iLoc += decode_significant_run(15 - iLoc as i32, ahexpt.as_ptr(), pIO)? as u32;
    }
    iLoc &= 0xf;
    *pCoef.add((*pScan.add(iLoc as usize)).uScan as usize) = iLevel;
    (*pScan.add(iLoc as usize)).uTotal = (*pScan.add(iLoc as usize)).uTotal.wrapping_add(1);
    if iLoc != 0 && (*pScan.add(iLoc as usize)).uTotal > (*pScan.add(iLoc as usize - 1)).uTotal {
        let cTemp = *pScan.add(iLoc as usize);
        *pScan.add(iLoc as usize) = *pScan.add(iLoc as usize - 1);
        *pScan.add(iLoc as usize - 1) = cTemp;
    }
    iLoc = (iLoc + 1) & 0xf;

    while iSRn != 0 {
        iSR = iSRn & 1;
        if iSR == 0 {
            let Some(ahexpt) = *pAHexpt.add(0) else {
                return Some(0);
            };
            iLoc += decode_significant_run(15 - iLoc as i32, ahexpt.as_ptr(), pIO)? as u32;
            if iLoc >= 16 {
                return Some(16);
            }
        }
        let Some(ahexpt) = *pAH1.add((iCont + 1) as usize) else {
            return Some(0);
        };
        decode_index(
            std::ptr::addr_of_mut!(iIndex),
            iLoc as i32 + 1,
            ahexpt.as_ptr(),
            pIO,
        );
        iSRn = iIndex >> 1;

        debug_assert!(iSRn >= 0 && iSRn < 3);
        iCont &= iSRn;
        iSign = get_sign(&mut *pIO);

        iLevel = (iQP ^ iSign) - iSign;
        if (iIndex & 1) != 0 {
            let Some(ahexpt) = *pAHexpt.add((6 + iContextOffset + iCont) as usize) else {
                return Some(0);
            };
            iLevel *= decode_significant_abs_level(ahexpt.as_ptr(), pIO)?;
        }

        *pCoef.add((*pScan.add(iLoc as usize)).uScan as usize) = iLevel;
        (*pScan.add(iLoc as usize)).uTotal = (*pScan.add(iLoc as usize)).uTotal.wrapping_add(1);
        if iLoc != 0 && (*pScan.add(iLoc as usize)).uTotal > (*pScan.add(iLoc as usize - 1)).uTotal
        {
            let cTemp = *pScan.add(iLoc as usize);
            *pScan.add(iLoc as usize) = *pScan.add(iLoc as usize - 1);
            *pScan.add(iLoc as usize - 1) = cTemp;
        }

        iLoc = (iLoc + 1) & 0xf;
        iNumNonzero += 1;
    }
    Some(iNumNonzero)
}

/// Original function: `DecodeBlockAdaptive` at `original/jxrlib/image/decode/segdec.c:569`.
pub unsafe fn decode_block_adaptive(
    bNoSkip: i32,
    bChroma: i32,
    pAdHuff: *mut Option<NonNull<CAdaptiveHuffman>>,
    pIO: *mut tagBitIOInfo,
    pIOFL: *mut tagBitIOInfo,
    pCoeffs: *mut i32,
    pScan: *mut CAdaptiveScan,
    iModelBits: i32,
    iTrim: i32,
    iQP: i32,
    pOrder: *const i32,
    bSkipFlexbits: i32,
) -> Option<i32> {
    let mut iNumNonzero = 0;
    let mut iFlex = iModelBits - iTrim;

    if iFlex < 0 || bSkipFlexbits != 0 {
        iFlex = 0;
    }

    if bNoSkip != 0 {
        let iQP1 = iQP << iModelBits;
        iNumNonzero = decode_block_highpass(bChroma, pAdHuff, pIO, iQP1, pCoeffs, pScan)?;
    }
    if iFlex != 0 {
        let mut k: u32;
        if iQP + iTrim == 1 {
            debug_assert!(iTrim == 0);
            debug_assert!(iQP == 1);

            k = 1;
            while k < 16 {
                let pk = pCoeffs.add(*pOrder.add(k as usize) as usize);
                if *pk < 0 {
                    let fine = get_bit16(&mut *pIOFL, iFlex as u32) as i32;
                    *pk -= fine;
                } else if *pk > 0 {
                    let fine = get_bit16(&mut *pIOFL, iFlex as u32) as i32;
                    *pk += fine;
                } else {
                    *pk = get_bit16s(&mut *pIOFL, iFlex as u32);
                }
                k += 1;
            }
        } else {
            let iQP1 = iQP << iTrim;
            k = 1;
            while k < 16 {
                let order = *pOrder.add(k as usize);
                let kk = *pCoeffs.add(order as usize);
                if kk < 0 {
                    let fine = get_bit16(&mut *pIOFL, iFlex as u32) as i32;
                    *pCoeffs.add(order as usize) -= iQP1 * fine;
                } else if kk > 0 {
                    let fine = get_bit16(&mut *pIOFL, iFlex as u32) as i32;
                    *pCoeffs.add(order as usize) += iQP1 * fine;
                } else {
                    *pCoeffs.add(order as usize) = iQP1 * get_bit16s(&mut *pIOFL, iFlex as u32);
                }
                k += 1;
            }
        }
    }

    Some(iNumNonzero)
}

/// Original function: `DecodeCoeffs` at `original/jxrlib/image/decode/segdec.c:633`.
pub unsafe fn decode_coeffs(
    p_sc: *mut CWMImageStrCodec,
    p_context: *mut CCodingContext,
    _i_mbx: i32,
    _i_mby: i32,
    p_io: *mut tagBitIOInfo,
    p_io_fl: *mut tagBitIOInfo,
) -> Result<(), WmpError> {
    let p_tile = (*p_sc)
        .pTileMemory
        .as_deref()
        // pSC->pTile is allocated before any block decode; C derefs it unconditionally
        .expect("pTile allocated before decoding")
        .as_ptr()
        .add((*p_sc).cTileColumn);
    let cf = (*p_sc).m_param.cfColorFormat;
    let i_channels = (*p_sc).m_param.cNumChannels as i32;
    let i_planes = if cf == ColorFormat::Yuv420 || cf == ColorFormat::Yuv422 {
        1
    } else {
        i_channels
    };
    let mut i_n_blocks = 4;
    let mut i_model_bits = (*p_context).m_aModelAC.m_iFlcBits[0];
    let mut a_laplacian_mean: [i32; 2] = [0, 0];
    let mut p_lm = a_laplacian_mean.as_mut_ptr();
    let p_order = dct_index[0].as_ptr();
    let i_orient = (*p_sc).MBInfo.iOrientation;
    let mut b_chroma = 0;

    let i_cbpcu = (*p_sc).MBInfo.iCBP[1];
    let i_cbpcv = (*p_sc).MBInfo.iCBP[2];
    let mut i_cbpcy = (*p_sc).MBInfo.iCBP[0];

    let p_scan = if i_orient == 1 {
        (*p_context).m_aScanVert.as_mut_ptr()
    } else {
        (*p_context).m_aScanHoriz.as_mut_ptr()
    };

    if cf == ColorFormat::Yuv420 {
        i_n_blocks = 6;
        i_cbpcy += (i_cbpcu << 16) + (i_cbpcv << 20);
    } else if cf == ColorFormat::Yuv422 {
        i_n_blocks = 8;
        i_cbpcy += (i_cbpcu << 16) + (i_cbpcv << 24);
    }

    let mut i = 0;
    while i < i_planes {
        let mut i_index = 0;

        if (*p_sc).WMISCP.sbSubband != Subband::NoFlexbits {
            read_is(p_io_fl)?;
        }

        let mut i_block = 0;
        while i_block < i_n_blocks {
            read_is(p_io)?;
            if p_io != p_io_fl {
                read_is(p_io_fl)?;
            }

            let i_qp = if (*p_sc).m_param.bTranscode != 0 {
                1
            } else {
                let qp_channel = if i_planes > 1 {
                    i
                } else if i_block > 3 {
                    if cf == ColorFormat::Yuv420 {
                        i_block - 3
                    } else {
                        i_block / 2 - 1
                    }
                } else {
                    0
                };
                let Some(quantizer) = (*p_tile).pQuantizerHP[qp_channel as usize] else {
                    return Err(WmpError::Fail);
                };
                (*quantizer.as_ptr().add((*p_sc).MBInfo.iQIndexHP as usize)).iQP
            };

            let mut i_subblock = 0;
            while i_subblock < 4 {
                let mut p_coeffs = (*p_sc).p1MBbuffer[i as usize]
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    .add(blk_offset[(i_index & 0xf) as usize] as usize);

                if i_block >= 4 {
                    if cf == ColorFormat::Yuv420 {
                        p_coeffs = (*p_sc).p1MBbuffer[(i_block - 3) as usize]
                            .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                            .add(blk_offset_uv[i_subblock as usize] as usize);
                    } else {
                        p_coeffs = (*p_sc).p1MBbuffer[(1 + (1 & (i_block >> 1))) as usize]
                            .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                            .add(
                                ((i_block & 1) * 32 + blk_offset_uv_422[i_subblock as usize])
                                    as usize,
                            );
                    }
                }

                // m_Dparam set during decoder init; C derefs pSC->m_Dparam unconditionally
                debug_assert!(
                    (*(*p_sc)
                        .m_Dparam
                        .expect("m_Dparam set during decoder init")
                        .as_ptr())
                    .bSkipFlexbits
                        == 0
                        || (*p_sc).WMISCP.bfBitstreamFormat == BitstreamFormat::Frequency
                        || (*p_sc).WMISCP.sbSubband == Subband::NoFlexbits
                );
                let i_num_non_zero = decode_block_adaptive(
                    i_cbpcy & 1,
                    b_chroma,
                    (*p_context).m_pAHexpt.as_mut_ptr(),
                    p_io,
                    p_io_fl,
                    p_coeffs,
                    p_scan,
                    i_model_bits,
                    (*p_context).m_iTrimFlexBits,
                    i_qp,
                    p_order,
                    // m_Dparam set during decoder init; C derefs pSC->m_Dparam unconditionally
                    (*(*p_sc)
                        .m_Dparam
                        .expect("m_Dparam set during decoder init")
                        .as_ptr())
                    .bSkipFlexbits,
                )
                .ok_or(WmpError::Fail)?;
                if i_num_non_zero > 16 {
                    return Err(WmpError::Fail);
                }
                *p_lm += i_num_non_zero;

                i_subblock += 1;
                i_index += 1;
                i_cbpcy >>= 1;
            }
            if i_block == 3 {
                i_model_bits = (*p_context).m_aModelAC.m_iFlcBits[1];
                p_lm = a_laplacian_mean.as_mut_ptr().add(1);
                b_chroma = 1;
            }
            i_block += 1;
        }

        i_cbpcy = (*p_sc).MBInfo.iCBP[((i + 1) & 0xf) as usize];
        debug_assert_eq!(crate::image::sys::strcodec::MAX_CHANNELS, 16);
        i += 1;
    }

    update_model_mb(
        cf,
        i_channels,
        &mut a_laplacian_mean,
        &mut (*p_context).m_aModelAC,
    );
    Ok(())
}

/// Original function: `DecodeSignificantAbsLevel` at `original/jxrlib/image/decode/segdec.c:738`.
pub unsafe fn decode_significant_abs_level(
    pAHexpt: *mut CAdaptiveHuffman,
    pIO: *mut tagBitIOInfo,
) -> Option<i32> {
    let mut iIndex: u32;
    let iFixed: i32;
    let mut iLevel: i32;
    let aRemap: [i32; 6] = [2, 3, 4, 6, 10, 14];
    let aFixedLength: [i32; 6] = [0, 0, 1, 2, 2, 2];

    // C dereferences pAHexpt->m_hufDecTable unconditionally; None is the defensive Rust equivalent.
    let Some(decode_table) = (*pAHexpt).m_hufDecTable else {
        return None;
    };
    iIndex = get_huff(decode_table, pIO) as u32;
    debug_assert!(iIndex <= 6);
    // C dereferences pAHexpt->m_pDelta unconditionally; None is the defensive Rust equivalent.
    let Some(delta) = (*pAHexpt).m_pDelta else {
        return None;
    };
    (*pAHexpt).m_iDiscriminant = (*pAHexpt)
        .m_iDiscriminant
        .wrapping_add(delta[iIndex as usize]);
    if iIndex < 2 {
        iLevel = iIndex as i32 + 2;
    } else if iIndex < 6 {
        iFixed = aFixedLength[iIndex as usize];
        iLevel = aRemap[iIndex as usize] + get_bit16(&mut *pIO, iFixed as u32) as i32;
    } else {
        let mut iFixedMut = get_bit16(&mut *pIO, 4) as i32 + 4;
        if iFixedMut == 19 {
            iFixedMut += get_bit16(&mut *pIO, 2) as i32;
            if iFixedMut == 22 {
                iFixedMut += get_bit16(&mut *pIO, 3) as i32;
            }
        }
        iLevel = 2 + (1 << iFixedMut);
        iIndex = crate::image::sys::strcodec::get_bit32(&mut *pIO, iFixedMut as u32);
        iLevel += iIndex as i32;
    }
    Some(iLevel)
}

/// Original function: `decodeQPIndex` at `original/jxrlib/image/decode/segdec.c:771`.
pub unsafe fn decode_qp_index(pIO: *mut tagBitIOInfo, cBits: u8) -> u8 {
    if get_bit16(&mut *pIO, 1) == 0 {
        return 0;
    }
    get_bit16(&mut *pIO, cBits as u32).wrapping_add(1) as u8
}

/// Original function: `DecodeMacroblockLowpass` at `original/jxrlib/image/decode/segdec.c:781`.
pub unsafe fn decode_macroblock_lowpass(
    p_sc: *mut CWMImageStrCodec,
    p_context: *mut CCodingContext,
    _i_mbx: i32,
    _i_mbydummy: i32,
) -> Result<(), WmpError> {
    let cf = (*p_sc).m_param.cfColorFormat;
    let i_channels = (*p_sc).m_param.cNumChannels as i32;
    let i_full_planes = if cf == ColorFormat::Yuv420 || cf == ColorFormat::Yuv422 {
        2
    } else {
        i_channels
    };
    let p_scan = (*p_context).m_aScanLowpass.as_mut_ptr();
    let p_io = (*p_context).m_pIOLP;
    let mut i_model_bits = (*p_context).m_aModelLP.m_iFlcBits[0];
    let mut a_rl_coeffs: [i32; 32] = [0; 32];
    let mut i_index: i32;
    let mut a_laplacian_mean: [i32; 2] = [0, 0];
    let mut p_lm = a_laplacian_mean.as_mut_ptr();
    let mut i_cbp = 0;
    let mut use_wide_get_bits = false;
    let p_mb_info = std::ptr::addr_of_mut!((*p_sc).MBInfo);
    let mut a_dc: [Option<NonNull<i32>>; MAX_CHANNELS] = [None; MAX_CHANNELS];

    read_is(p_io)?;
    let p_tile = (*p_sc)
        .pTileMemory
        .as_deref()
        // pSC->pTile is allocated before any block decode; C derefs it unconditionally
        .expect("pTile allocated before decoding")
        .as_ptr()
        .add((*p_sc).cTileColumn);
    if (*p_sc).WMISCP.bfBitstreamFormat != BitstreamFormat::Spatial && (*p_tile).cBitsLP > 0 {
        (*p_mb_info).iQIndexLP = decode_qp_index(p_io, (*p_tile).cBitsLP);
    }

    let mut k = 0;
    while k < (*p_sc).m_param.cNumChannels as i32 {
        a_dc[(k & 15) as usize] = NonNull::new((*p_mb_info).iBlockDC[k as usize].as_mut_ptr());
        k += 1;
    }

    if (*p_sc).m_bResetRGITotals != 0 {
        let i_scale = 2;
        let mut i_weight = i_scale * 16;
        (*p_scan.add(0)).uTotal = MAXTOTAL;
        k = 1;
        while k < 16 {
            (*p_scan.add(k as usize)).uTotal = i_weight as u32;
            i_weight -= i_scale;
            k += 1;
        }
    }

    if cf == ColorFormat::Yuv420 || cf == ColorFormat::Yuv422 || cf == ColorFormat::Yuv444 {
        let mut i_count_m = (*p_context).m_iCBPCountMax;
        let mut i_count_z = (*p_context).m_iCBPCountZero;
        let i_max = i_full_planes * 4 - 5;
        if i_count_z <= 0 || i_count_m < 0 {
            i_cbp = 0;
            if get_bool16(&mut *p_io) != 0 {
                i_cbp = 1;
                k = get_bit16(&mut *p_io, (i_full_planes - 1) as u32) as i32;
                if k != 0 {
                    i_cbp = k * 2 + get_bit16(&mut *p_io, 1) as i32;
                }
            }
            if i_count_m < i_count_z {
                i_cbp = i_max - i_cbp;
            }
        } else {
            i_cbp = get_bit16(&mut *p_io, i_full_planes as u32) as i32;
        }

        i_count_m += 1 - 4 * (i_cbp == i_max) as i32;
        i_count_z += 1 - 4 * (i_cbp == 0) as i32;
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
        let mut i_channel = 0;
        while i_channel < i_channels {
            i_cbp |= (if use_wide_get_bits {
                crate::image::sys::strcodec::get_bit32(&mut *p_io, 1)
            } else {
                get_bit16(&mut *p_io, 1)
            } as i32)
                << i_channel;
            i_channel += 1;
        }
    }

    if (*p_context).m_aModelLP.m_iFlcBits[0] > 14 || (*p_context).m_aModelLP.m_iFlcBits[1] > 14 {
        use_wide_get_bits = true;
    }

    let mut i_channel = 0;
    while i_channel < i_full_planes {
        let Some(p_coeffs) = a_dc[i_channel as usize] else {
            return Err(WmpError::Fail);
        };
        let p_coeffs = p_coeffs.as_ptr();

        if (i_cbp & 1) != 0 {
            let i_num_nonzero = decode_block(
                (i_channel > 0) as i32,
                a_rl_coeffs.as_mut_ptr(),
                (*p_context).m_pAHexpt.as_mut_ptr(),
                CTDC,
                p_io,
                1 + 9 * (cf == ColorFormat::Yuv420 && i_channel == 1) as i32
                    + (cf == ColorFormat::Yuv422 && i_channel == 1) as i32,
            )
            .ok_or(WmpError::Fail)?;

            if (cf == ColorFormat::Yuv420 || cf == ColorFormat::Yuv422) && i_channel != 0 {
                let mut a_temp: [i32; 16] = [0; 16];
                let a_remap: [i32; 7] = [4, 1, 2, 3, 5, 6, 7];
                let p_remap = a_remap.as_ptr().add((cf == ColorFormat::Yuv420) as usize);
                let i_count = if cf == ColorFormat::Yuv420 { 6 } else { 14 };

                *p_lm += i_num_nonzero;
                i_index = 0;

                k = 0;
                while k < i_num_nonzero {
                    i_index += a_rl_coeffs[(k * 2) as usize];
                    a_temp[(i_index & 0xf) as usize] = a_rl_coeffs[(k * 2 + 1) as usize];
                    i_index += 1;
                    k += 1;
                }

                k = 0;
                while k < i_count {
                    let Some(dc) = a_dc[((k & 1) + 1) as usize] else {
                        return Err(WmpError::Fail);
                    };
                    *dc.as_ptr().add(*p_remap.add((k >> 1) as usize) as usize) = a_temp[k as usize];
                    k += 1;
                }
            } else {
                *p_lm += i_num_nonzero;
                i_index = 1;

                k = 0;
                while k < i_num_nonzero {
                    i_index += a_rl_coeffs[(k * 2) as usize];
                    *p_coeffs.add((*p_scan.add(i_index as usize)).uScan as usize) =
                        a_rl_coeffs[(k * 2 + 1) as usize];
                    (*p_scan.add(i_index as usize)).uTotal =
                        (*p_scan.add(i_index as usize)).uTotal.wrapping_add(1);
                    if (*p_scan.add(i_index as usize)).uTotal
                        > (*p_scan.add((i_index - 1) as usize)).uTotal
                    {
                        let c_temp = *p_scan.add(i_index as usize);
                        *p_scan.add(i_index as usize) = *p_scan.add((i_index - 1) as usize);
                        *p_scan.add((i_index - 1) as usize) = c_temp;
                    }
                    i_index += 1;
                    k += 1;
                }
            }
        }

        if i_model_bits != 0 {
            if (cf == ColorFormat::Yuv420 || cf == ColorFormat::Yuv422) && i_channel != 0 {
                let Some(dc1) = a_dc[1] else {
                    return Err(WmpError::Fail);
                };
                let Some(dc2) = a_dc[2] else {
                    return Err(WmpError::Fail);
                };
                let dc1 = dc1.as_ptr();
                let dc2 = dc2.as_ptr();
                k = 1;
                while k < if cf == ColorFormat::Yuv420 { 4 } else { 8 } {
                    if *dc1.add(k as usize) > 0 {
                        *dc1.add(k as usize) <<= i_model_bits;
                        *dc1.add(k as usize) += if use_wide_get_bits {
                            crate::image::sys::strcodec::get_bit32(&mut *p_io, i_model_bits as u32)
                        } else {
                            get_bit16(&mut *p_io, i_model_bits as u32)
                        } as i32;
                    } else if *dc1.add(k as usize) < 0 {
                        *dc1.add(k as usize) <<= i_model_bits;
                        *dc1.add(k as usize) -= if use_wide_get_bits {
                            crate::image::sys::strcodec::get_bit32(&mut *p_io, i_model_bits as u32)
                        } else {
                            get_bit16(&mut *p_io, i_model_bits as u32)
                        } as i32;
                    } else {
                        *dc1.add(k as usize) = if use_wide_get_bits {
                            crate::image::sys::strcodec::get_bit32(&mut *p_io, i_model_bits as u32)
                        } else {
                            get_bit16(&mut *p_io, i_model_bits as u32)
                        } as i32;
                        if *dc1.add(k as usize) != 0 && get_bool16(&mut *p_io) != 0 {
                            *dc1.add(k as usize) = -*dc1.add(k as usize);
                        }
                    }

                    if *dc2.add(k as usize) > 0 {
                        *dc2.add(k as usize) <<= i_model_bits;
                        *dc2.add(k as usize) += if use_wide_get_bits {
                            crate::image::sys::strcodec::get_bit32(&mut *p_io, i_model_bits as u32)
                        } else {
                            get_bit16(&mut *p_io, i_model_bits as u32)
                        } as i32;
                    } else if *dc2.add(k as usize) < 0 {
                        *dc2.add(k as usize) <<= i_model_bits;
                        *dc2.add(k as usize) -= if use_wide_get_bits {
                            crate::image::sys::strcodec::get_bit32(&mut *p_io, i_model_bits as u32)
                        } else {
                            get_bit16(&mut *p_io, i_model_bits as u32)
                        } as i32;
                    } else {
                        *dc2.add(k as usize) = if use_wide_get_bits {
                            crate::image::sys::strcodec::get_bit32(&mut *p_io, i_model_bits as u32)
                        } else {
                            get_bit16(&mut *p_io, i_model_bits as u32)
                        } as i32;
                        if *dc2.add(k as usize) != 0 && get_bool16(&mut *p_io) != 0 {
                            *dc2.add(k as usize) = -*dc2.add(k as usize);
                        }
                    }
                    k += 1;
                }
            } else {
                k = 1;
                while k < 16 {
                    if *p_coeffs.add(k as usize) > 0 {
                        *p_coeffs.add(k as usize) <<= i_model_bits;
                        *p_coeffs.add(k as usize) += if use_wide_get_bits {
                            crate::image::sys::strcodec::get_bit32(&mut *p_io, i_model_bits as u32)
                        } else {
                            get_bit16(&mut *p_io, i_model_bits as u32)
                        } as i32;
                    } else if *p_coeffs.add(k as usize) < 0 {
                        *p_coeffs.add(k as usize) <<= i_model_bits;
                        *p_coeffs.add(k as usize) -= if use_wide_get_bits {
                            crate::image::sys::strcodec::get_bit32(&mut *p_io, i_model_bits as u32)
                        } else {
                            get_bit16(&mut *p_io, i_model_bits as u32)
                        } as i32;
                    } else {
                        let r1 = peek_bit16(&*p_io, (i_model_bits + 1) as u32) as i32;
                        *p_coeffs.add(k as usize) = ((r1 >> 1) ^ (-(r1 & 1))) + (r1 & 1);
                        flush_bit16(
                            &mut *p_io,
                            (i_model_bits + (*p_coeffs.add(k as usize) != 0) as i32) as u32,
                        );
                    }
                    k += 1;
                }
            }
        }
        p_lm = a_laplacian_mean.as_mut_ptr().add(1);
        i_model_bits = (*p_context).m_aModelLP.m_iFlcBits[1];

        i_cbp >>= 1;
        i_channel += 1;
    }

    update_model_mb(
        cf,
        i_channels,
        &mut a_laplacian_mean,
        &mut (*p_context).m_aModelLP,
    );

    if (*p_sc).m_bResetContext != 0 {
        // C discards this return (faithful to DecodeMacroblockLowpass)
        let _ = adapt_lowpass_dec(&mut *p_context);
    }

    Ok(())
}

/// Original function: `DecodeMacroblockDC` at `original/jxrlib/image/decode/segdec.c:1012`.
pub unsafe fn decode_macroblock_dc(
    p_sc: *mut CWMImageStrCodec,
    p_context: *mut CCodingContext,
    _i_mbx: i32,
    _i_mby: i32,
) -> Result<(), WmpError> {
    let p_tile = (*p_sc)
        .pTileMemory
        .as_deref()
        // pSC->pTile is allocated before any block decode; C derefs it unconditionally
        .expect("pTile allocated before decoding")
        .as_ptr()
        .add((*p_sc).cTileColumn);
    let p_mb_info = std::ptr::addr_of_mut!((*p_sc).MBInfo);
    let cf = (*p_sc).m_param.cfColorFormat;
    let i_channels = (*p_sc).m_param.cNumChannels as i32;
    let p_io = (*p_context).m_pIODC;
    let mut a_laplacian_mean: [i32; 2] = [0, 0];
    let mut p_lm = a_laplacian_mean.as_mut_ptr();
    let mut i_model_bits = (*p_context).m_aModelDC.m_iFlcBits[0];

    let mut i = 0;
    while i < i_channels {
        std::ptr::write_bytes((*p_mb_info).iBlockDC[i as usize].as_mut_ptr(), 0, 16);
        i += 1;
    }

    read_is(p_io)?;

    (*p_mb_info).iQIndexLP = 0;
    (*p_mb_info).iQIndexHP = 0;

    if (*p_sc).WMISCP.bfBitstreamFormat == BitstreamFormat::Spatial
        && (*p_sc).WMISCP.sbSubband != Subband::DcOnly
    {
        if (*p_tile).cBitsLP > 0 {
            (*p_mb_info).iQIndexLP = decode_qp_index(p_io, (*p_tile).cBitsLP);
        }
        if (*p_sc).WMISCP.sbSubband != Subband::NoHighpass && (*p_tile).cBitsHP > 0 {
            (*p_mb_info).iQIndexHP = decode_qp_index(p_io, (*p_tile).cBitsHP);
        }
    }
    if (*p_tile).cBitsHP == 0 && (*p_tile).cNumQPHP > 1 {
        (*p_mb_info).iQIndexHP = (*p_mb_info).iQIndexLP;
    }
    if (*p_mb_info).iQIndexLP >= (*p_tile).cNumQPLP || (*p_mb_info).iQIndexHP >= (*p_tile).cNumQPHP
    {
        return Err(WmpError::Fail);
    }

    if cf == ColorFormat::YOnly || cf == ColorFormat::Cmyk || cf == ColorFormat::NComponent {
        i = 0;
        while i < i_channels {
            let mut i_qdcy = 0;
            if get_bool16(&mut *p_io) != 0 {
                let Some(ahexpt) = (*p_context).m_pAHexpt[3] else {
                    return Err(WmpError::Fail);
                };
                i_qdcy =
                    decode_significant_abs_level(ahexpt.as_ptr(), p_io).ok_or(WmpError::Fail)? - 1;
                *p_lm += 1;
            }
            if i_model_bits != 0 {
                i_qdcy =
                    (i_qdcy << i_model_bits) | get_bit16(&mut *p_io, i_model_bits as u32) as i32;
            }
            if i_qdcy != 0 && get_bool16(&mut *p_io) != 0 {
                i_qdcy = -i_qdcy;
            }
            (*p_mb_info).iBlockDC[i as usize][0] = i_qdcy;

            p_lm = a_laplacian_mean.as_mut_ptr().add(1);
            i_model_bits = (*p_context).m_aModelDC.m_iFlcBits[1];
            i += 1;
        }
    } else {
        let Some(p_ah) = (*p_context).m_pAHexpt[2] else {
            return Err(WmpError::Fail);
        };
        let p_ah = p_ah.as_ptr();
        let Some(decode_table) = (*p_ah).m_hufDecTable else {
            return Err(WmpError::Fail);
        };
        let i_index = get_huff(decode_table, p_io);
        let mut i_qdcy = i_index >> 2;
        let mut i_qdcu = (i_index >> 1) & 1;
        let mut i_qdcv = i_index & 1;

        if i_qdcy != 0 {
            let Some(ahexpt) = (*p_context).m_pAHexpt[3] else {
                return Err(WmpError::Fail);
            };
            i_qdcy = decode_significant_abs_level(ahexpt.as_ptr(), p_io).ok_or(WmpError::Fail)? - 1;
            *p_lm += 1;
        }
        if i_model_bits != 0 {
            i_qdcy = (i_qdcy << i_model_bits) | get_bit16(&mut *p_io, i_model_bits as u32) as i32;
        }
        if i_qdcy != 0 && get_bool16(&mut *p_io) != 0 {
            i_qdcy = -i_qdcy;
        }
        (*p_mb_info).iBlockDC[0][0] = i_qdcy;

        p_lm = a_laplacian_mean.as_mut_ptr().add(1);
        i_model_bits = (*p_context).m_aModelDC.m_iFlcBits[1];

        if i_qdcu != 0 {
            let Some(ahexpt) = (*p_context).m_pAHexpt[4] else {
                return Err(WmpError::Fail);
            };
            i_qdcu = decode_significant_abs_level(ahexpt.as_ptr(), p_io).ok_or(WmpError::Fail)? - 1;
            *p_lm += 1;
        }
        if i_model_bits != 0 {
            i_qdcu = (i_qdcu << i_model_bits) | get_bit16(&mut *p_io, i_model_bits as u32) as i32;
        }
        if i_qdcu != 0 && get_bool16(&mut *p_io) != 0 {
            i_qdcu = -i_qdcu;
        }
        (*p_mb_info).iBlockDC[1][0] = i_qdcu;

        if i_qdcv != 0 {
            let Some(ahexpt) = (*p_context).m_pAHexpt[4] else {
                return Err(WmpError::Fail);
            };
            i_qdcv = decode_significant_abs_level(ahexpt.as_ptr(), p_io).ok_or(WmpError::Fail)? - 1;
            *p_lm += 1;
        }
        if i_model_bits != 0 {
            i_qdcv = (i_qdcv << i_model_bits) | get_bit16(&mut *p_io, i_model_bits as u32) as i32;
        }
        if i_qdcv != 0 && get_bool16(&mut *p_io) != 0 {
            i_qdcv = -i_qdcv;
        }
        (*p_mb_info).iBlockDC[2][0] = i_qdcv;
    }

    update_model_mb(
        cf,
        i_channels,
        &mut a_laplacian_mean,
        &mut (*p_context).m_aModelDC,
    );

    // m_Dparam set during decoder init; C derefs pSC->m_Dparam unconditionally
    if (((*p_sc).WMISCP.bfBitstreamFormat == BitstreamFormat::Frequency
        && (*(*p_sc)
            .m_Dparam
            .expect("m_Dparam set during decoder init")
            .as_ptr())
        .cThumbnailScale
            >= 16)
        || (*p_sc).WMISCP.sbSubband == Subband::DcOnly)
        && (*p_sc).m_bResetContext != 0
    {
        let mut kk = 2;
        while kk < 5 {
            let Some(mut ahexpt) = (*p_context).m_pAHexpt[kk as usize] else {
                return Err(WmpError::Fail);
            };
            if adapt_dec_fixed(ahexpt.as_mut()).is_err() {
                return Err(WmpError::Fail);
            }
            kk += 1;
        }
    }

    Ok(())
}

/// Original function: `DecodeMacroblockHighpass` at `original/jxrlib/image/decode/segdec.c:1130`.
pub unsafe fn decode_macroblock_highpass(
    p_sc: *mut CWMImageStrCodec,
    p_context: *mut CCodingContext,
    i_mbx: i32,
    i_mby: i32,
) -> Result<(), WmpError> {
    if (*p_sc).m_bResetRGITotals != 0 {
        let i_scale = 2;
        let mut i_weight = i_scale * 16;
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

    let p_tile = (*p_sc)
        .pTileMemory
        .as_deref()
        // pSC->pTile is allocated before any block decode; C derefs it unconditionally
        .expect("pTile allocated before decoding")
        .as_ptr()
        .add((*p_sc).cTileColumn);
    if (*p_sc).WMISCP.bfBitstreamFormat != BitstreamFormat::Spatial && (*p_tile).cBitsHP > 0 {
        (*p_sc).MBInfo.iQIndexHP = decode_qp_index((*p_context).m_pIOAC, (*p_tile).cBitsHP);
        if (*p_sc).MBInfo.iQIndexHP >= (*p_tile).cNumQPHP {
            return Err(WmpError::Fail);
        }
    } else if (*p_tile).cBitsHP == 0 && (*p_tile).cNumQPHP > 1 {
        (*p_sc).MBInfo.iQIndexHP = (*p_sc).MBInfo.iQIndexLP;
    }

    decode_cbp(&mut *p_sc, &mut *p_context)?;
    pred_cbp_dec(&mut *p_sc, &mut *p_context);

    if decode_coeffs(
        p_sc,
        p_context,
        i_mbx,
        i_mby,
        (*p_context).m_pIOAC,
        (*p_context).m_pIOFL,
    )
    .is_err()
    {
        return Err(WmpError::Fail);
    }

    if (*p_sc).m_bResetContext != 0 {
        // C discards this return (faithful to DecodeMacroblockHighpass)
        let _ = adapt_highpass_dec(&mut *p_context);
    }

    Ok(())
}

/// Original function: `AdaptLowpassDec` at `original/jxrlib/image/decode/segdec.c:1171`.
pub unsafe fn adapt_lowpass_dec(p_sc: &mut CCodingContext) -> Result<(), WmpError> {
    let mut kk = 0;
    while kk < CONTEXTX + CTDC {
        let Some(mut ahexpt) = p_sc.m_pAHexpt[kk as usize] else {
            return Err(WmpError::Fail);
        };
        if adapt_dec_fixed(ahexpt.as_mut()).is_err() {
            return Err(WmpError::Fail);
        }
        kk += 1;
    }
    Ok(())
}

/// Original function: `AdaptHighpassDec` at `original/jxrlib/image/decode/segdec.c:1186`.
pub unsafe fn adapt_highpass_dec(p_sc: &mut CCodingContext) -> Result<(), WmpError> {
    let mut kk = 0;
    let Some(mut adapt_huff_cbpcy) = p_sc.m_pAdaptHuffCBPCY else {
        return Err(WmpError::Fail);
    };
    if adapt_dec_fixed(adapt_huff_cbpcy.as_mut()).is_err() {
        return Err(WmpError::Fail);
    }
    let Some(mut adapt_huff_cbpcy1) = p_sc.m_pAdaptHuffCBPCY1 else {
        return Err(WmpError::Fail);
    };
    if adapt_dec_fixed(adapt_huff_cbpcy1.as_mut()).is_err() {
        return Err(WmpError::Fail);
    }
    while kk < CONTEXTX {
        let Some(mut ahexpt) = p_sc.m_pAHexpt[(kk + CONTEXTX + CTDC) as usize] else {
            return Err(WmpError::Fail);
        };
        if adapt_dec_fixed(ahexpt.as_mut()).is_err() {
            return Err(WmpError::Fail);
        }
        kk += 1;
    }

    Ok(())
}
