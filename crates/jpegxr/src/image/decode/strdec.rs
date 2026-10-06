// Auto-generated scaffold for a faithful JXRLib translation restart.
// Keep one Rust item per original C item; replace stubs bottom-up.

use std::ptr::NonNull;

use super::decode::{allocate_coding_context_dec, reset_coding_context_dec, CWMDecoderParameters};
use super::postprocess::{init_post_proc, term_post_proc};
use super::segdec::{decode_macroblock_dc, decode_macroblock_highpass, decode_macroblock_lowpass};
use super::str_inv_transform::{
    inv_transform_macroblock, inv_transform_macroblock_altered_operators_hard,
};
use super::str_pred_quant_dec::{dequantize_macroblock, pred_ac_dec, pred_dcac_dec};
use crate::image::sys::perf_timer_ansi::{
    perf_timer_copy_start_time, perf_timer_delete, perf_timer_new, perf_timer_start,
    perf_timer_stop,
};
use crate::image::sys::str_pred_quant::{
    allocate_pred_info, update_pred_info, QPFRACBITS, SHIFTZERO,
};
use crate::image::sys::strcodec::{
    advance_mr_ptr, advance_one_mb_row, allocate_bit_io_info, allocate_quantizer,
    allocate_tile_info, attach_is_read, attach_sb, check_image_buffer, detach_is_read, detach_sb,
    dquant_bits, flush_to_byte, flush_to_byte_sb, format_quantizer, get_bit16, get_bit32,
    get_bit32_sb, get_byte_read_sb, get_pos_read, get_tile_pos, idx_cc, idx_cc_420, init_mr_ptr,
    output_perf_timer_report, read_is, set_bit_io_pointers, set_uniform_quantizer, swap_mr_ptr,
    tagBitIOInfo, tagCWMIQuantizer, tagSimpleBitIO, use_dc_quantizer, use_lp_quantizer,
    CCodingContext, CWMITile, CWMImageStrCodec, CWMImageStrCodecParameters, ImageDataProc,
    MAX_CHANNELS, PACKETLENGTH,
};
use crate::image::sys::windowsmediaphoto::{
    tagCWMIStrCodecParam, tagCWMImageBufferInfo, tagCWMImageInfo, AlphaMode, BitDepthLayout,
    BitstreamFormat, Orientation, Overlap, Subband, LOG_MAX_TILES,
};
use crate::jxrgluelib::jxrglue::{BitDepth, ColorFormat};
use crate::WmpError;
pub const CODEC_VERSION: u32 = 1;
pub const CODEC_SUBVERSION: usize = 0;
pub const CODEC_SUBVERSION_NEWSCALING_SOFT_TILES: u32 = 1;
pub const CODEC_SUBVERSION_NEWSCALING_HARD_TILES: u32 = 9;
pub const CBLK_CHROMAS: [i32; 9] = [0, 4, 8, 16, 16, 16, 16, 0, 0];

/// Original union: `uif` at `original/jxrlib/image/decode/strdec.c:466`.
#[derive(Debug, Clone, Default)]
pub struct uif {
    pub i: i32,
    pub f: f32,
}

/// Original function: `readQuantizerSB` at `original/jxrlib/image/decode/strdec.c:53`.
pub unsafe fn read_quantizer_sb(
    qp_index: &mut [u8],
    p_io: &mut tagSimpleBitIO,
    c_channel: usize,
) -> u8 {
    let mut c_ch_mode = 0;

    if c_channel > MAX_CHANNELS || qp_index.len() < c_channel {
        return 0;
    }
    let qp_index = &mut qp_index[..c_channel];

    if c_channel > 1 {
        c_ch_mode = get_bit32_sb(p_io, 2) as u8;
    }

    qp_index[0] = get_bit32_sb(p_io, 8) as u8;

    if c_ch_mode == 1 {
        qp_index[1] = get_bit32_sb(p_io, 8) as u8;
    } else if c_ch_mode > 0 {
        for qp_index in &mut qp_index[1..] {
            *qp_index = get_bit32_sb(p_io, 8) as u8;
        }
    }

    c_ch_mode
}

/// Original function: `readQuantizer` at `original/jxrlib/image/decode/strdec.c:78`.
pub unsafe fn read_quantizer(
    p_quantizer: *mut Option<NonNull<tagCWMIQuantizer>>,
    p_io: *mut tagBitIOInfo,
    c_channel: usize,
    i_pos: usize,
) -> u8 {
    let mut c_ch_mode = 0;
    let quantizers = std::slice::from_raw_parts_mut(p_quantizer, c_channel);

    if c_channel > 1 {
        c_ch_mode = get_bit16(&mut *p_io, 2) as u8;
    }

    let Some(first) = quantizers[0] else {
        return 0;
    };
    (*first.as_ptr().add(i_pos)).iIndex = get_bit16(&mut *p_io, 8) as u8;

    if c_ch_mode == 1 {
        let Some(second) = quantizers[1] else {
            return 0;
        };
        (*second.as_ptr().add(i_pos)).iIndex = get_bit16(&mut *p_io, 8) as u8;
    } else if c_ch_mode > 0 {
        for quantizer in &mut quantizers[1..] {
            let Some(quantizer) = *quantizer else {
                return 0;
            };
            (*quantizer.as_ptr().add(i_pos)).iIndex = get_bit16(&mut *p_io, 8) as u8;
        }
    }

    c_ch_mode
}

/// Original function: `readPacketHeader` at `original/jxrlib/image/decode/strdec.c:102`.
pub unsafe fn read_packet_header(
    p_io: *mut tagBitIOInfo,
    _pt_packet_type: u8,
    _p_id: u8,
) -> Result<(), WmpError> {
    if get_bit16(&mut *p_io, 8) != 0
        || get_bit16(&mut *p_io, 8) != 0
        || get_bit16(&mut *p_io, 8) != 1
    {
        return Err(WmpError::Fail);
    }
    get_bit16(&mut *p_io, 8);
    Ok(())
}

/// Original function: `readTileHeaderDC` at `original/jxrlib/image/decode/strdec.c:112`.
pub unsafe fn read_tile_header_dc(
    sc: &mut CWMImageStrCodec,
    p_io: *mut tagBitIOInfo,
) -> Result<(), WmpError> {
    if (sc.m_param.uQPMode & 1) != 0 {
        let Some(tile) = sc
            .pTileMemory
            .as_deref_mut()
            .and_then(|tiles| tiles.get_mut(sc.cTileColumn))
        else {
            return Err(WmpError::Fail);
        };
        let p_tile = tile as *mut CWMITile;

        if sc.cTileRow + sc.cTileColumn == 0 {
            for i_tile in 0..=sc.WMISCP.cNumOfSliceMinus1V {
                let Some(tile) = sc
                    .pTileMemory
                    .as_deref_mut()
                    .and_then(|tiles| tiles.get_mut(i_tile as usize))
                else {
                    return Err(WmpError::Fail);
                };
                if allocate_quantizer(
                    &mut tile.pQuantizerDC,
                    sc.m_param.cNumChannels,
                    1,
                    &mut tile.pQuantizerDCMemory,
                    &mut tile.cQuantizerDCMemory,
                )
                .is_err()
                {
                    return Err(WmpError::Fail);
                }
            }
        }

        (*p_tile).cChModeDC = read_quantizer(
            (*p_tile).pQuantizerDC.as_mut_ptr(),
            p_io,
            sc.m_param.cNumChannels,
            0,
        );
        format_quantizer(
            (*p_tile).pQuantizerDC.as_mut_ptr(),
            (*p_tile).cChModeDC,
            sc.m_param.cNumChannels,
            0,
            1,
            sc.m_param.bScaledArith,
        );
    }

    Ok(())
}

/// Original function: `readTileHeaderLP` at `original/jxrlib/image/decode/strdec.c:130`.
pub unsafe fn read_tile_header_lp(
    sc: &mut CWMImageStrCodec,
    p_io: *mut tagBitIOInfo,
) -> Result<(), WmpError> {
    if sc.WMISCP.sbSubband != Subband::DcOnly && (sc.m_param.uQPMode & 2) != 0 {
        let c_tile_column = sc.cTileColumn;
        let c_num_channels = sc.m_param.cNumChannels;
        let b_scaled_arith = sc.m_param.bScaledArith;
        let Some(tile) = sc
            .pTileMemory
            .as_deref_mut()
            .and_then(|tiles| tiles.get_mut(c_tile_column))
        else {
            return Err(WmpError::Fail);
        };
        let p_tile = tile as *mut CWMITile;

        (*p_tile).bUseDC = if get_bit16(&mut *p_io, 1) == 1 { 1 } else { 0 };
        (*p_tile).cBitsLP = 0;
        (*p_tile).cNumQPLP = 1;

        if sc.cTileRow > 0 {
            (*p_tile).pQuantizerLPMemory = None;
            (*p_tile).cQuantizerLPMemory = 0;
            (*p_tile).pQuantizerLP.fill(None);
        }

        if (*p_tile).bUseDC == 1 {
            if allocate_quantizer(
                &mut (*p_tile).pQuantizerLP,
                c_num_channels,
                (*p_tile).cNumQPLP as usize,
                &mut (*p_tile).pQuantizerLPMemory,
                &mut (*p_tile).cQuantizerLPMemory,
            )
            .is_err()
            {
                return Err(WmpError::Fail);
            }
            use_dc_quantizer(sc, c_tile_column);
        } else {
            (*p_tile).cNumQPLP = get_bit16(&mut *p_io, 4) as u8 + 1;
            (*p_tile).cBitsLP = dquant_bits((*p_tile).cNumQPLP);

            if allocate_quantizer(
                &mut (*p_tile).pQuantizerLP,
                c_num_channels,
                (*p_tile).cNumQPLP as usize,
                &mut (*p_tile).pQuantizerLPMemory,
                &mut (*p_tile).cQuantizerLPMemory,
            )
            .is_err()
            {
                return Err(WmpError::Fail);
            }

            for i in 0..(*p_tile).cNumQPLP {
                (*p_tile).cChModeLP[i as usize] = read_quantizer(
                    (*p_tile).pQuantizerLP.as_mut_ptr(),
                    p_io,
                    c_num_channels,
                    i as usize,
                );
                format_quantizer(
                    (*p_tile).pQuantizerLP.as_mut_ptr(),
                    (*p_tile).cChModeLP[i as usize],
                    c_num_channels,
                    i as usize,
                    1,
                    b_scaled_arith,
                );
            }
        }
    }

    Ok(())
}

/// Original function: `readTileHeaderHP` at `original/jxrlib/image/decode/strdec.c:165`.
pub unsafe fn read_tile_header_hp(
    sc: &mut CWMImageStrCodec,
    p_io: *mut tagBitIOInfo,
) -> Result<(), WmpError> {
    if sc.WMISCP.sbSubband != Subband::DcOnly
        && sc.WMISCP.sbSubband != Subband::NoHighpass
        && (sc.m_param.uQPMode & 4) != 0
    {
        let c_tile_column = sc.cTileColumn;
        let c_num_channels = sc.m_param.cNumChannels;
        let b_scaled_arith = sc.m_param.bScaledArith;
        let Some(tile) = sc
            .pTileMemory
            .as_deref_mut()
            .and_then(|tiles| tiles.get_mut(c_tile_column))
        else {
            return Err(WmpError::Fail);
        };
        let p_tile = tile as *mut CWMITile;

        (*p_tile).bUseLP = if get_bit16(&mut *p_io, 1) == 1 { 1 } else { 0 };
        (*p_tile).cBitsHP = 0;
        (*p_tile).cNumQPHP = 1;

        if sc.cTileRow > 0 {
            (*p_tile).pQuantizerHPMemory = None;
            (*p_tile).cQuantizerHPMemory = 0;
            (*p_tile).pQuantizerHP.fill(None);
        }

        if (*p_tile).bUseLP == 1 {
            (*p_tile).cNumQPHP = (*p_tile).cNumQPLP;
            if allocate_quantizer(
                &mut (*p_tile).pQuantizerHP,
                c_num_channels,
                (*p_tile).cNumQPHP as usize,
                &mut (*p_tile).pQuantizerHPMemory,
                &mut (*p_tile).cQuantizerHPMemory,
            )
            .is_err()
            {
                return Err(WmpError::Fail);
            }
            use_lp_quantizer(sc, (*p_tile).cNumQPHP as usize, c_tile_column);
        } else {
            (*p_tile).cNumQPHP = get_bit16(&mut *p_io, 4) as u8 + 1;
            (*p_tile).cBitsHP = dquant_bits((*p_tile).cNumQPHP);

            if allocate_quantizer(
                &mut (*p_tile).pQuantizerHP,
                c_num_channels,
                (*p_tile).cNumQPHP as usize,
                &mut (*p_tile).pQuantizerHPMemory,
                &mut (*p_tile).cQuantizerHPMemory,
            )
            .is_err()
            {
                return Err(WmpError::Fail);
            }

            for i in 0..(*p_tile).cNumQPHP {
                (*p_tile).cChModeHP[i as usize] = read_quantizer(
                    (*p_tile).pQuantizerHP.as_mut_ptr(),
                    p_io,
                    c_num_channels,
                    i as usize,
                );
                format_quantizer(
                    (*p_tile).pQuantizerHP.as_mut_ptr(),
                    (*p_tile).cChModeHP[i as usize],
                    c_num_channels,
                    i as usize,
                    0,
                    b_scaled_arith,
                );
            }
        }
    }

    Ok(())
}

/// Original function: `readPackets` at `original/jxrlib/image/decode/strdec.c:201`.
pub unsafe fn read_packets(p_sc: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    let p_sc = p_sc as *mut CWMImageStrCodec;
    let Some(contexts) = (*p_sc).pCodingContextMemory.as_deref_mut() else {
        return Err(WmpError::Fail);
    };

    if (*p_sc).cColumn == 0 && (*p_sc).cRow == (*p_sc).WMISCP.uiTileY[(*p_sc).cTileRow] as usize {
        if (*p_sc).m_bSecondary != 0 {
            if (*p_sc).cNumBitIO > 0 {
                for k in 0..=(*p_sc).WMISCP.cNumOfSliceMinus1V as usize {
                    let Some(context) = contexts.get_mut(k) else {
                        return Err(WmpError::Fail);
                    };
                    reset_coding_context_dec(context);
                }
            } else {
                let Some(context) = contexts.first_mut() else {
                    return Err(WmpError::Fail);
                };
                reset_coding_context_dec(context);
            }
        } else {
            let bit_io_base = (*p_sc).m_ppBitIO.map(NonNull::as_ptr);
            for k in 0..(*p_sc).cNumBitIO {
                if let Some(pp_wstream) = (*p_sc).ppWStream.map(NonNull::as_ptr) {
                    let Some(bit_io_base) = bit_io_base else {
                        return Err(WmpError::Fail);
                    };
                    let c_bands = if (*p_sc).WMISCP.bfBitstreamFormat == BitstreamFormat::Spatial {
                        1usize
                    } else {
                        (*p_sc).cSB as usize
                    };
                    let pp_ws = pp_wstream.add(
                        ((*p_sc).WMISCP.cNumOfSliceMinus1V as usize + 1)
                            * (*p_sc).cTileRow
                            * c_bands
                            + k / c_bands * c_bands
                            + (k % c_bands),
                    );

                    let p_io = (*bit_io_base.add(k))
                        .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);
                    if (*p_sc).cTileRow > 0 && (*p_io).pWS.is_some() {
                        let _ = detach_is_read(p_io);
                    }

                    if let Some(pp_ws) = *pp_ws {
                        let _ = attach_is_read(p_io, pp_ws.as_ptr());
                    }
                } else {
                    let Some(bit_io_base) = bit_io_base else {
                        return Err(WmpError::Fail);
                    };
                    if (*p_sc).cTileRow > 0 {
                        let _ = detach_is_read(
                            (*bit_io_base.add(k))
                                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr),
                        );
                    }
                    let Some(p_wstream) = (*p_sc).WMISCP.pWStream.map(NonNull::as_ptr) else {
                        return Err(WmpError::Fail);
                    };
                    let Some(set_pos) = (*p_wstream).SetPos else {
                        return Err(WmpError::Fail);
                    };
                    let Some(index_table) = (*p_sc).pIndexTableMemory.as_deref() else {
                        return Err(WmpError::Fail);
                    };
                    let index = (*p_sc).cNumBitIO * (*p_sc).cTileRow + k;
                    let _ = set_pos(&mut *p_wstream, index_table[index] + (*p_sc).cHeaderSize);
                    let _ = attach_is_read(
                        (*bit_io_base.add(k))
                            .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr),
                        p_wstream,
                    );
                }
            }

            if (*p_sc).cNumBitIO == 0 {
                let Some(header_io) = (*p_sc).pIOHeader else {
                    return Err(WmpError::Fail);
                };
                let p_io_header = header_io.as_ptr();
                let _ = detach_is_read(p_io_header);
                if let Some(pp_wstream) = (*p_sc).ppWStream.map(NonNull::as_ptr) {
                    let Some(p_wstream) = *pp_wstream.add(0) else {
                        return Err(WmpError::Fail);
                    };
                    let _ = attach_is_read(p_io_header, p_wstream.as_ptr());
                } else {
                    let Some(p_wstream) = (*p_sc).WMISCP.pWStream.map(NonNull::as_ptr) else {
                        return Err(WmpError::Fail);
                    };
                    let Some(set_pos) = (*p_wstream).SetPos else {
                        return Err(WmpError::Fail);
                    };
                    let _ = set_pos(&mut *p_wstream, (*p_sc).cHeaderSize);
                    let _ = attach_is_read(p_io_header, p_wstream);
                }
            }

            let bit_io_base = (*p_sc).m_ppBitIO.map(NonNull::as_ptr);
            for k in 0..=(*p_sc).WMISCP.cNumOfSliceMinus1V as usize {
                let Some(context) = contexts.get_mut(k) else {
                    return Err(WmpError::Fail);
                };
                let p_id = (((*p_sc).cTileRow * ((*p_sc).WMISCP.cNumOfSliceMinus1V as usize + 1)
                    + k)
                    & 0x1f) as u8;

                if (*p_sc).WMISCP.bfBitstreamFormat == BitstreamFormat::Spatial {
                    let p_io = if (*p_sc).cNumBitIO == 0 {
                        let Some(header_io) = (*p_sc).pIOHeader else {
                            return Err(WmpError::Fail);
                        };
                        header_io.as_ptr()
                    } else {
                        let Some(bit_io_base) = bit_io_base else {
                            return Err(WmpError::Fail);
                        };
                        (*bit_io_base.add(k))
                            .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                    };

                    if p_io.is_null() || read_packet_header(p_io, 0, p_id).is_err() {
                        return Err(WmpError::Fail);
                    }
                    context.m_iTrimFlexBits = if (*p_sc).m_param.bTrimFlexbitsFlag != 0 {
                        get_bit16(&mut *p_io, 4) as i32
                    } else {
                        0
                    };
                } else {
                    let Some(bit_io_base) = bit_io_base else {
                        return Err(WmpError::Fail);
                    };
                    let p_io_dc = (*bit_io_base.add(k * (*p_sc).cSB as usize))
                        .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);
                    if p_io_dc.is_null() || read_packet_header(p_io_dc, 1, p_id).is_err() {
                        return Err(WmpError::Fail);
                    }
                    if (*p_sc).cSB > 1 {
                        let p_io_lp = (*bit_io_base.add(k * (*p_sc).cSB as usize + 1))
                            .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);
                        if p_io_lp.is_null() || read_packet_header(p_io_lp, 2, p_id).is_err() {
                            return Err(WmpError::Fail);
                        }
                    }
                    if (*p_sc).cSB > 2 {
                        let p_io_ac = (*bit_io_base.add(k * (*p_sc).cSB as usize + 2))
                            .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);
                        if p_io_ac.is_null() || read_packet_header(p_io_ac, 3, p_id).is_err() {
                            return Err(WmpError::Fail);
                        }
                    }
                    if (*p_sc).cSB > 3 {
                        let p_io_fl = (*bit_io_base.add(k * (*p_sc).cSB as usize + 3))
                            .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);
                        if p_io_fl.is_null() {
                            return Err(WmpError::Fail);
                        }
                        // C discards this return: bad flexbits packet doesn't generate an error (faithful to readPackets)
                        let _ = read_packet_header(p_io_fl, 4, p_id);
                        context.m_iTrimFlexBits = if (*p_sc).m_param.bTrimFlexbitsFlag != 0 {
                            get_bit16(&mut *p_io_fl, 4) as i32
                        } else {
                            0
                        };
                    }
                }

                reset_coding_context_dec(context);
            }
        }
    }

    if (*p_sc).m_bCtxLeft != 0 && (*p_sc).m_bCtxTop != 0 && (*p_sc).m_bSecondary == 0 {
        let Some(p_context) = contexts.get_mut((*p_sc).cTileColumn) else {
            return Err(WmpError::Fail);
        };
        let p_io_dc = p_context.m_pIODC;
        let p_io_lp = p_context.m_pIOLP;
        let p_io_ac = p_context.m_pIOAC;

        // C discards this return (faithful to readPackets)
        let _ = read_tile_header_dc(&mut *p_sc, p_io_dc);
        if let Some(mut next_sc) = (*p_sc).m_pNextSC {
            // C discards this return (faithful to readPackets)
            let _ = read_tile_header_dc(next_sc.as_mut(), p_io_dc);
        }
        if (*p_sc).cSB > 1 {
            // C discards this return (faithful to readPackets)
            let _ = read_tile_header_lp(&mut *p_sc, p_io_lp);
            if let Some(mut next_sc) = (*p_sc).m_pNextSC {
                // C discards this return (faithful to readPackets)
                let _ = read_tile_header_lp(next_sc.as_mut(), p_io_lp);
            }
        }
        if (*p_sc).cSB > 2 {
            // C discards this return (faithful to readPackets)
            let _ = read_tile_header_hp(&mut *p_sc, p_io_ac);
            if let Some(mut next_sc) = (*p_sc).m_pNextSC {
                // C discards this return (faithful to readPackets)
                let _ = read_tile_header_hp(next_sc.as_mut(), p_io_ac);
            }
        }
    }

    Ok(())
}

/// Original function: `processMacroblockDec` at `original/jxrlib/image/decode/strdec.c:309`.
pub unsafe fn process_macroblock_dec(pSC: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    let mut pSC = pSC as *mut CWMImageStrCodec;
    let Some(dparam) = (*pSC).m_Dparam else {
        return Err(WmpError::Fail);
    };
    let ol_overlap = (*pSC).WMISCP.olOverlap;
    let bottom = (*pSC).cRow == (*pSC).cmbHeight;
    let bottom_or_right = bottom || (*pSC).cColumn == (*pSC).cmbWidth;
    let mut result: Result<(), WmpError> = Ok(());
    let jend = ((*pSC).m_pNextSC.is_some()) as usize;
    let mut j = 0;

    while j <= jend {
        if !bottom_or_right {
            get_tile_pos(&mut *pSC, (*pSC).cColumn, (*pSC).cRow);

            if jend != 0 {
                let Some(next_sc) = (*pSC).m_pNextSC else {
                    return Err(WmpError::Fail);
                };
                (*next_sc.as_ptr()).cTileColumn = (*pSC).cTileColumn;
                (*next_sc.as_ptr()).cTileRow = (*pSC).cTileRow;
            }

            let Some(contexts) = (*pSC).pCodingContextMemory.as_deref_mut() else {
                return Err(WmpError::Fail);
            };
            let Some(p_context) = contexts.get_mut((*pSC).cTileColumn) else {
                return Err(WmpError::Fail);
            };
            let p_context = p_context as *mut CCodingContext;

            if read_packets(&mut *pSC).is_err() {
                return Err(WmpError::Fail);
            }

            if (*dparam.as_ptr()).bDecodeFullFrame == 0
                && (*pSC).cColumn == (*pSC).WMISCP.uiTileX[(*pSC).cTileColumn] as usize
            {
                let r_left = (*dparam.as_ptr()).cROILeftX;
                let r_right = (*dparam.as_ptr()).cROIRightX;
                let r_top = (*dparam.as_ptr()).cROITopY;
                let r_bottom = (*dparam.as_ptr()).cROIBottomY;
                let r_ext = if ol_overlap == Overlap::None {
                    0
                } else if ol_overlap == Overlap::One {
                    2
                } else {
                    10
                };
                let Some(t_left) = (*pSC).cColumn.checked_mul(16) else {
                    return Err(WmpError::Fail);
                };
                let Some(t_top) = ((*pSC).WMISCP.uiTileY[(*pSC).cTileRow] as usize).checked_mul(16)
                else {
                    return Err(WmpError::Fail);
                };
                let tile_right = if (*pSC).cTileColumn != (*pSC).WMISCP.cNumOfSliceMinus1V as usize
                {
                    (*pSC).WMISCP.uiTileX[(*pSC).cTileColumn + 1] as usize
                } else {
                    (*pSC).cmbWidth
                };
                let Some(t_right) = tile_right.checked_mul(16) else {
                    return Err(WmpError::Fail);
                };
                let tile_bottom = if (*pSC).cTileRow != (*pSC).WMISCP.cNumOfSliceMinus1H as usize {
                    (*pSC).WMISCP.uiTileY[(*pSC).cTileRow + 1] as usize
                } else {
                    (*pSC).cmbHeight
                };
                let Some(t_bottom) = tile_bottom.checked_mul(16) else {
                    return Err(WmpError::Fail);
                };
                let Some(t_right_ext) = t_right.checked_add(r_ext) else {
                    return Err(WmpError::Fail);
                };
                let Some(t_bottom_ext) = t_bottom.checked_add(r_ext) else {
                    return Err(WmpError::Fail);
                };
                let Some(r_right_ext) = r_right.checked_add(r_ext) else {
                    return Err(WmpError::Fail);
                };
                let Some(r_bottom_ext) = r_bottom.checked_add(r_ext) else {
                    return Err(WmpError::Fail);
                };
                let Some(row_start) = (*pSC).cRow.checked_mul(16) else {
                    return Err(WmpError::Fail);
                };

                (*p_context).m_bInROI = if r_left >= t_right_ext
                    || r_top >= t_bottom_ext
                    || t_left > r_right_ext
                    || t_top > r_bottom_ext
                    || row_start > r_bottom_ext
                {
                    0
                } else {
                    1
                };
            }

            if (*dparam.as_ptr()).bDecodeFullFrame != 0 || (*p_context).m_bInROI != 0 {
                result =
                    decode_macroblock_dc(pSC, p_context, (*pSC).cColumn as i32, (*pSC).cRow as i32);
                if result.is_err() {
                    return result;
                }

                if (*dparam.as_ptr()).bDecodeLP != 0 {
                    result = decode_macroblock_lowpass(
                        pSC,
                        p_context,
                        (*pSC).cColumn as i32,
                        (*pSC).cRow as i32,
                    );
                    if result.is_err() {
                        return result;
                    }
                }

                pred_dcac_dec(&mut *pSC);

                // C discards this return (faithful to processMacroblockDec)
                let _ = dequantize_macroblock(&mut *pSC);

                if (*dparam.as_ptr()).bDecodeHP != 0 {
                    result = decode_macroblock_highpass(
                        pSC,
                        p_context,
                        (*pSC).cColumn as i32,
                        (*pSC).cRow as i32,
                    );
                    if result.is_err() {
                        return result;
                    }
                    pred_ac_dec(&mut *pSC);
                }

                update_pred_info(
                    pSC,
                    std::ptr::addr_of_mut!((*pSC).MBInfo),
                    (*pSC).cColumn,
                    (*pSC).m_param.cfColorFormat,
                );
            }
        }

        let outside_roi_transform = if (*dparam.as_ptr()).bDecodeFullFrame == 0 {
            let Some(column_start) = (*pSC).cColumn.checked_mul(16) else {
                return Err(WmpError::Fail);
            };
            let Some(row_start) = (*pSC).cRow.checked_mul(16) else {
                return Err(WmpError::Fail);
            };
            let Some(roi_right_ext) = (*dparam.as_ptr()).cROIRightX.checked_add(25) else {
                return Err(WmpError::Fail);
            };
            let Some(column_end_ext) = column_start.checked_add(25) else {
                return Err(WmpError::Fail);
            };
            let Some(roi_bottom_ext) = (*dparam.as_ptr()).cROIBottomY.checked_add(25) else {
                return Err(WmpError::Fail);
            };
            let Some(row_end_ext) = row_start.checked_add(25) else {
                return Err(WmpError::Fail);
            };
            column_start > roi_right_ext
                || column_end_ext < (*dparam.as_ptr()).cROILeftX
                || row_start > roi_bottom_ext
                || row_end_ext < (*dparam.as_ptr()).cROITopY
        } else {
            false
        };
        if !outside_roi_transform {
            let Some(transform) = (*pSC).Transform else {
                return Err(WmpError::Fail);
            };
            // C discards this return (faithful to processMacroblockDec)
            let _ = transform(&mut *pSC);
        }

        if jend != 0 {
            let Some(next_sc) = (*pSC).m_pNextSC else {
                return Err(WmpError::Fail);
            };
            (*next_sc.as_ptr()).cRow = (*pSC).cRow;
            (*next_sc.as_ptr()).cColumn = (*pSC).cColumn;
            pSC = next_sc.as_ptr();
        }

        j += 1;
    }

    result
}

/// Original function: `inverseConvert` at `original/jxrlib/image/decode/strdec.c:415`.
pub fn inverse_convert(i_f: i32, p_rgb: &mut u8, p_e: &mut u8) {
    if i_f <= 0 {
        *p_rgb = 0;
        *p_e = 0;
    } else if (i_f >> 7) > 1 {
        *p_e = (i_f >> 7) as u8;
        *p_rgb = ((i_f & 0x7f) | 0x80) as u8;
    } else {
        *p_e = 1;
        *p_rgb = i_f as u8;
    }
}

/// Original function: `inverseConvertRGBE` at `original/jxrlib/image/decode/strdec.c:436`.
pub unsafe fn inverse_convert_rgbe(i_fr: i32, i_fg: i32, i_fb: i32, p_rgbe: &mut [u8]) {
    let mut p_r_e = 0;
    let mut p_g_e = 0;
    let mut p_b_e = 0;

    let (rgb, e) = p_rgbe.split_at_mut(3);
    inverse_convert(i_fr, &mut rgb[0], &mut p_r_e);
    inverse_convert(i_fg, &mut rgb[1], &mut p_g_e);
    inverse_convert(i_fb, &mut rgb[2], &mut p_b_e);

    e[0] = std::cmp::max(std::cmp::max(p_r_e, p_g_e), p_b_e);

    if e[0] > p_r_e {
        let i_shift = e[0] - p_r_e;
        rgb[0] = (((rgb[0] as i32) * 2 + 1) >> (i_shift + 1)) as u8;
    }
    if e[0] > p_g_e {
        let i_shift = e[0] - p_g_e;
        rgb[1] = (((rgb[1] as i32) * 2 + 1) >> (i_shift + 1)) as u8;
    }
    if e[0] > p_b_e {
        let i_shift = e[0] - p_b_e;
        rgb[2] = (((rgb[2] as i32) * 2 + 1) >> (i_shift + 1)) as u8;
    }
}

/// Original function: `pixel2float` at `original/jxrlib/image/decode/strdec.c:464`.
pub unsafe fn pixel2float(h: i32, c: i8, lm: u8) -> f32 {
    let lmshift: i32 = 1 << lm;

    let mut i_temp_h = h as i32;
    let s = i_temp_h >> 31;
    i_temp_h = (i_temp_h ^ s).wrapping_sub(s);

    let mut e = ((i_temp_h as u32) >> lm) as i32;
    let mut m = (i_temp_h & (lmshift - 1)) | lmshift;
    if e == 0 {
        m ^= lmshift;
        e = 1;
    }

    e += 127 - c as i32;
    while m < lmshift && e > 1 && m > 0 {
        e -= 1;
        m <<= 1;
    }
    if m < lmshift {
        e = 0;
    } else {
        m ^= lmshift;
    }
    m <<= 23 - lm;

    f32::from_bits(((s & 0x80000000_u32 as i32) | (e << 23) | m) as u32)
}

/// Original function: `backwardHalf` at `original/jxrlib/image/decode/strdec.c:504`.
pub unsafe fn backward_half(mut h_half: i32) -> u16 {
    let s = h_half >> 31;
    h_half = ((h_half & 0x7fff) ^ s).wrapping_sub(s);
    h_half as u16
}

/// Original function: `interpolateUV` at `original/jxrlib/image/decode/strdec.c:513`.
pub unsafe fn interpolate_uv(pSC: &mut CWMImageStrCodec) {
    let pSC = pSC as *mut CWMImageStrCodec;
    let cf_ext = (*pSC).WMII.cfColorFormat;
    let c_width = (*pSC).cmbWidth * 16;
    let (Some(p_src_u), Some(p_src_v)) = ((*pSC).a0MBbuffer[1], (*pSC).a0MBbuffer[2]) else {
        return;
    };
    let p_src_u = p_src_u.as_ptr();
    let p_src_v = p_src_v.as_ptr();
    let (Some(a1_u), Some(a1_v)) = ((*pSC).a1MBbuffer[1], (*pSC).a1MBbuffer[2]) else {
        return;
    };
    let a1_u = a1_u.as_ptr();
    let a1_v = a1_v.as_ptr();
    let Some(p_dst_u) = (*pSC).pResU else {
        return;
    };
    let Some(p_dst_v) = (*pSC).pResV else {
        return;
    };
    let p_dst_u = p_dst_u.as_ptr();
    let p_dst_v = p_dst_v.as_ptr();
    let mut i_idx_s: usize = 0;
    let mut i_idx_d: usize = 0;

    if (*pSC).m_param.cfColorFormat == ColorFormat::Yuv422 {
        for i_row in 0..16 {
            let mut i_column = 0;
            while i_column < c_width {
                i_idx_s = ((i_column >> 4) << 7) + idx_cc[i_row][(i_column >> 1) & 7] as usize;
                i_idx_d = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize;

                *p_dst_u.add(i_idx_d) = *p_src_u.add(i_idx_s);
                *p_dst_v.add(i_idx_d) = *p_src_v.add(i_idx_s);

                if i_column > 0 {
                    let i_l = i_column - 2;
                    let i_idx_l = ((i_l >> 4) << 8) + idx_cc[i_row][i_l & 15] as usize;
                    let i_c = i_column - 1;
                    let i_idx_c = ((i_c >> 4) << 8) + idx_cc[i_row][i_c & 15] as usize;

                    *p_dst_u.add(i_idx_c) =
                        (*p_dst_u.add(i_idx_l) + *p_dst_u.add(i_idx_d) + 1) >> 1;
                    *p_dst_v.add(i_idx_c) =
                        (*p_dst_v.add(i_idx_l) + *p_dst_v.add(i_idx_d) + 1) >> 1;
                }

                i_column += 2;
            }

            i_idx_s = (((i_column - 1) >> 4) << 8) + idx_cc[i_row][(i_column - 1) & 15] as usize;
            *p_dst_u.add(i_idx_s) = *p_dst_u.add(i_idx_d);
            *p_dst_v.add(i_idx_s) = *p_dst_v.add(i_idx_d);
        }
    } else {
        let c_shift = if cf_ext == ColorFormat::Yuv422 { 3 } else { 4 };
        for i_column in (0..c_width).step_by(2) {
            let c_mb = (i_column >> 4) << (4 + c_shift);
            let c_pix = (i_column >> (4 - c_shift)) & ((1 << c_shift) - 1);

            for i_row in (0..16).step_by(2) {
                i_idx_s =
                    ((i_column >> 4) << 6) + idx_cc_420[i_row >> 1][(i_column >> 1) & 7] as usize;
                i_idx_d = c_mb + idx_cc[i_row][c_pix] as usize;

                *p_dst_u.add(i_idx_d) = *p_src_u.add(i_idx_s);
                *p_dst_v.add(i_idx_d) = *p_src_v.add(i_idx_s);

                if i_row > 0 {
                    let i_idx_t = c_mb + idx_cc[i_row - 2][c_pix] as usize;
                    let i_idx_c = c_mb + idx_cc[i_row - 1][c_pix] as usize;

                    *p_dst_u.add(i_idx_c) =
                        (*p_dst_u.add(i_idx_t) + *p_dst_u.add(i_idx_d) + 1) >> 1;
                    *p_dst_v.add(i_idx_c) =
                        (*p_dst_v.add(i_idx_t) + *p_dst_v.add(i_idx_d) + 1) >> 1;
                }
            }

            i_idx_s = c_mb + idx_cc[15][c_pix] as usize;
            if (*pSC).cRow == (*pSC).cmbHeight {
                *p_dst_u.add(i_idx_s) = *p_dst_u.add(i_idx_d);
                *p_dst_v.add(i_idx_s) = *p_dst_v.add(i_idx_d);
            } else {
                let i_idx_b = ((i_column >> 4) << 6) + idx_cc_420[0][(i_column >> 1) & 7] as usize;

                *p_dst_u.add(i_idx_s) = (*a1_u.add(i_idx_b) + *p_dst_u.add(i_idx_d) + 1) >> 1;
                *p_dst_v.add(i_idx_s) = (*a1_v.add(i_idx_b) + *p_dst_v.add(i_idx_d) + 1) >> 1;
            }
        }

        if cf_ext != ColorFormat::Yuv422 {
            for i_row in 0..16 {
                let mut i_column = 1;
                while i_column < c_width - 2 {
                    let i_idx_l =
                        (((i_column - 1) >> 4) << 8) + idx_cc[i_row][(i_column - 1) & 15] as usize;

                    i_idx_d = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize;
                    i_idx_s =
                        (((i_column + 1) >> 4) << 8) + idx_cc[i_row][(i_column + 1) & 15] as usize;

                    *p_dst_u.add(i_idx_d) =
                        (*p_dst_u.add(i_idx_s) + *p_dst_u.add(i_idx_l) + 1) >> 1;
                    *p_dst_v.add(i_idx_d) =
                        (*p_dst_v.add(i_idx_s) + *p_dst_v.add(i_idx_l) + 1) >> 1;

                    i_column += 2;
                }

                i_idx_d = (((c_width - 1) >> 4) << 8) + idx_cc[i_row][(c_width - 1) & 15] as usize;
                *p_dst_u.add(i_idx_d) = *p_dst_u.add(i_idx_s);
                *p_dst_v.add(i_idx_d) = *p_dst_v.add(i_idx_s);
            }
        }
    }
}

/// Original function: `outputNChannel` at `original/jxrlib/image/decode/strdec.c:608`.
pub unsafe fn output_n_channel(
    pSC: *mut CWMImageStrCodec,
    i_first_row: usize,
    i_first_column: usize,
    c_width: usize,
    c_height: usize,
    i_shift: usize,
    i_bias: i32,
) {
    let p_ii = std::ptr::addr_of!((*pSC).WMII);
    let c_channel = if (*p_ii).cfColorFormat == ColorFormat::YOnly {
        1
    } else {
        (*pSC).WMISCP.cChannel
    };
    let n_len = (*pSC).WMISCP.nLenMantissaOrShift;
    let n_exp_bias = (*pSC).WMISCP.nExpBias;
    // m_Dparam is Some for the entire decode after StrDecInit.
    let dparam = (*pSC).m_Dparam.expect("m_Dparam set during StrDecInit");

    let mut channels = (*pSC)
        .a0MBbuffer
        .map(|channel| channel.map_or(std::ptr::null_mut(), NonNull::as_ptr));
    let offset_x = &(&(*dparam.as_ptr()).offset_x)[..];
    let offset_y = &(&(*dparam.as_ptr()).offset_y)[(((*pSC).cRow - 1) * 16)..];
    let channel_len = (((c_width.saturating_sub(1) >> 4) + 1) << 8) as usize;
    let buffer_bytes = (*pSC).WMIBI.cLine * (*pSC).WMIBI.cbStride;

    debug_assert!(c_channel <= channels.len());

    if (*pSC).m_bUVResolutionChange != 0 {
        let (Some(res_u), Some(res_v)) = ((*pSC).pResU, (*pSC).pResV) else {
            return;
        };
        channels[1] = res_u.as_ptr();
        channels[2] = res_v.as_ptr();
    }
    let Some(base) = (*pSC).WMIBI.pv else {
        return;
    };

    match (*pSC).WMII.bdBitDepth {
        BitDepth::Eight => {
            let dst_buffer = std::slice::from_raw_parts_mut(base.as_ptr(), buffer_bytes);
            for i_row in i_first_row..c_height {
                let i_y = offset_y[i_row];
                for i_column in i_first_column..c_width {
                    let i_idx = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize;
                    let dst_offset = i_y + offset_x[i_column];
                    let dst = &mut dst_buffer[dst_offset..dst_offset + c_channel];
                    for (i_channel, channel) in channels.iter().take(c_channel).enumerate() {
                        let channel = std::slice::from_raw_parts(*channel, channel_len);
                        let p = ((channel[i_idx] + i_bias) >> i_shift) as i32;
                        dst[i_channel] = if p < 0 {
                            0
                        } else if p > 255 {
                            255
                        } else {
                            p as u8
                        };
                    }
                }
            }
        }
        BitDepth::Sixteen => {
            let dst_buffer =
                std::slice::from_raw_parts_mut(base.as_ptr().cast::<u16>(), buffer_bytes / 2);
            for i_row in i_first_row..c_height {
                let i_y = offset_y[i_row];
                for i_column in i_first_column..c_width {
                    let i_idx = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize;
                    let dst_offset = i_y + offset_x[i_column];
                    let dst = &mut dst_buffer[dst_offset..dst_offset + c_channel];
                    for (i_channel, channel) in channels.iter().take(c_channel).enumerate() {
                        let channel = std::slice::from_raw_parts(*channel, channel_len);
                        let mut p = ((channel[i_idx] + i_bias) >> i_shift) as i32;
                        p <<= n_len;
                        dst[i_channel] = if p < 0 {
                            0
                        } else if p > 65535 {
                            65535
                        } else {
                            p as u16
                        };
                    }
                }
            }
        }
        BitDepth::SixteenS => {
            let dst_buffer =
                std::slice::from_raw_parts_mut(base.as_ptr().cast::<i16>(), buffer_bytes / 2);
            for i_row in i_first_row..c_height {
                let i_y = offset_y[i_row];
                for i_column in i_first_column..c_width {
                    let i_idx = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize;
                    let dst_offset = i_y + offset_x[i_column];
                    let dst = &mut dst_buffer[dst_offset..dst_offset + c_channel];
                    for (i_channel, channel) in channels.iter().take(c_channel).enumerate() {
                        let channel = std::slice::from_raw_parts(*channel, channel_len);
                        let mut p = ((channel[i_idx] + i_bias) >> i_shift) as i32;
                        p <<= n_len;
                        dst[i_channel] = if p < -32768 {
                            -32768
                        } else if p > 32767 {
                            32767
                        } else {
                            p as i16
                        };
                    }
                }
            }
        }
        BitDepth::SixteenF => {
            let dst_buffer =
                std::slice::from_raw_parts_mut(base.as_ptr().cast::<u16>(), buffer_bytes / 2);
            for i_row in i_first_row..c_height {
                let i_y = offset_y[i_row];
                for i_column in i_first_column..c_width {
                    let i_idx = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 0xf] as usize;
                    let dst_offset = i_y + offset_x[i_column];
                    let dst = &mut dst_buffer[dst_offset..dst_offset + c_channel];
                    for (i_channel, channel) in channels.iter().take(c_channel).enumerate() {
                        let channel = std::slice::from_raw_parts(*channel, channel_len);
                        let p = ((channel[i_idx] + i_bias) >> i_shift) as i32;
                        dst[i_channel] = backward_half(p);
                    }
                }
            }
        }
        BitDepth::ThirtyTwo => {
            let dst_buffer =
                std::slice::from_raw_parts_mut(base.as_ptr().cast::<u32>(), buffer_bytes / 4);
            for i_row in i_first_row..c_height {
                let i_y = offset_y[i_row];
                for i_column in i_first_column..c_width {
                    let i_idx = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 0xf] as usize;
                    let dst_offset = i_y + offset_x[i_column];
                    let dst = &mut dst_buffer[dst_offset..dst_offset + c_channel];
                    for (i_channel, channel) in channels.iter().take(c_channel).enumerate() {
                        let channel = std::slice::from_raw_parts(*channel, channel_len);
                        let mut p = ((channel[i_idx] + i_bias) >> i_shift) as i32;
                        p <<= n_len;
                        dst[i_channel] = p as u32;
                    }
                }
            }
        }
        BitDepth::ThirtyTwoS => {
            let dst_buffer =
                std::slice::from_raw_parts_mut(base.as_ptr().cast::<i32>(), buffer_bytes / 4);
            for i_row in i_first_row..c_height {
                let i_y = offset_y[i_row];
                for i_column in i_first_column..c_width {
                    let i_idx = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 0xf] as usize;
                    let dst_offset = i_y + offset_x[i_column];
                    let dst = &mut dst_buffer[dst_offset..dst_offset + c_channel];
                    for (i_channel, channel) in channels.iter().take(c_channel).enumerate() {
                        let channel = std::slice::from_raw_parts(*channel, channel_len);
                        let mut p = ((channel[i_idx] + i_bias) >> i_shift) as i32;
                        p <<= n_len;
                        dst[i_channel] = p as i32;
                    }
                }
            }
        }
        BitDepth::ThirtyTwoF => {
            let dst_buffer =
                std::slice::from_raw_parts_mut(base.as_ptr().cast::<f32>(), buffer_bytes / 4);
            for i_row in i_first_row..c_height {
                let i_y = offset_y[i_row];
                for i_column in i_first_column..c_width {
                    let i_idx = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 0xf] as usize;
                    let dst_offset = i_y + offset_x[i_column];
                    let dst = &mut dst_buffer[dst_offset..dst_offset + c_channel];
                    for (i_channel, channel) in channels.iter().take(c_channel).enumerate() {
                        let channel = std::slice::from_raw_parts(*channel, channel_len);
                        let p = ((channel[i_idx] + i_bias) >> i_shift) as i32;
                        dst[i_channel] = pixel2float(p, n_exp_bias, n_len);
                    }
                }
            }
        }
        _ => {
            debug_assert!(false);
        }
    }
}

/// Original function: `fixup_Y_ONLY_to_Others` at `original/jxrlib/image/decode/strdec.c:737`.
pub unsafe fn fixup_y_only_to_others(
    pSC: *const CWMImageStrCodec,
    pBI: *const tagCWMImageBufferInfo,
) {
    let p_ii = std::ptr::addr_of!((*pSC).WMII);
    let p_scp = std::ptr::addr_of!((*pSC).WMISCP);
    let c_width: usize;
    let c_height: usize;

    if ColorFormat::Rgb != (*p_ii).cfColorFormat || ColorFormat::YOnly != (*p_scp).cfColorFormat {
        return;
    }
    let Some(base) = (*pBI).pv else {
        return;
    };

    c_width = if (*p_ii).cROIWidth != 0 {
        (*p_ii).cROIWidth
    } else {
        (*p_ii).cWidth
    };
    c_height = if (*p_ii).cROIHeight != 0 {
        (*p_ii).cROIHeight
    } else {
        (*p_ii).cHeight
    };

    match (*p_ii).bdBitDepth {
        BitDepth::Eight => {
            let n_ch = (*p_ii).cBitsPerUnit >> 3;
            let mut idx_y = 0;
            while idx_y < c_height {
                let mut p_t = base.as_ptr().add((*pBI).cbStride * idx_y);
                let mut idx_x = 0;
                while idx_x < c_width {
                    *p_t.add(1) = *p_t.add(0);
                    *p_t.add(2) = *p_t.add(0);
                    p_t = p_t.add(n_ch);
                    idx_x += 1;
                }
                idx_y += 1;
            }
        }
        BitDepth::Sixteen | BitDepth::SixteenS | BitDepth::SixteenF => {
            let n_ch = ((*p_ii).cBitsPerUnit >> 3) / std::mem::size_of::<u16>();
            let mut idx_y = 0;
            while idx_y < c_height {
                let mut p_t = base
                    .as_ptr()
                    .cast::<u8>()
                    .add((*pBI).cbStride * idx_y)
                    .cast::<u16>();
                let mut idx_x = 0;
                while idx_x < c_width {
                    *p_t.add(1) = *p_t.add(0);
                    *p_t.add(2) = *p_t.add(0);
                    p_t = p_t.add(n_ch);
                    idx_x += 1;
                }
                idx_y += 1;
            }
        }
        BitDepth::ThirtyTwo | BitDepth::ThirtyTwoS | BitDepth::ThirtyTwoF => {
            let n_ch = ((*p_ii).cBitsPerUnit >> 3) / std::mem::size_of::<f32>();
            let mut idx_y = 0;
            while idx_y < c_height {
                let mut p_t = base
                    .as_ptr()
                    .cast::<u8>()
                    .add((*pBI).cbStride * idx_y)
                    .cast::<u32>();
                let mut idx_x = 0;
                while idx_x < c_width {
                    *p_t.add(1) = *p_t.add(0);
                    *p_t.add(2) = *p_t.add(0);
                    p_t = p_t.add(n_ch);
                    idx_x += 1;
                }
                idx_y += 1;
            }
        }
        BitDepth::Five | BitDepth::Ten | BitDepth::FiveSixFive => {}
        _ => {}
    }
}

/// Original function: `outputMBRowAlpha` at `original/jxrlib/image/decode/strdec.c:791`.
pub unsafe fn output_mb_row_alpha(pSC: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    let pSC = pSC as *mut CWMImageStrCodec;
    let Some(dparam) = (*pSC).m_Dparam else {
        return Err(WmpError::Fail);
    };
    if (*pSC).WMII.bdBitDepth == BitDepth::Eight && (*pSC).WMISCP.cfColorFormat == ColorFormat::Rgb
    {
        return Ok(());
    }

    let next_sc = ((*pSC).m_bSecondary == 0)
        .then_some((*pSC).m_pNextSC)
        .flatten();

    if let Some(p_next_sc) = next_sc {
        let p_next_sc = p_next_sc.as_ptr();
        let bd = (*pSC).WMII.bdBitDepth;
        let i_shift = if (*pSC).m_param.bScaledArith != 0 {
            SHIFTZERO + QPFRACBITS
        } else {
            0
        } as usize;
        let c_height = std::cmp::min(
            ((*dparam.as_ptr()).cROIBottomY + 1) - ((*pSC).cRow - 1) * 16,
            16,
        );
        let c_width = (*dparam.as_ptr()).cROIRightX + 1;
        let i_first_row = if ((*pSC).cRow - 1) * 16 > (*dparam.as_ptr()).cROITopY {
            0
        } else {
            (*dparam.as_ptr()).cROITopY & 0xf
        };
        let i_first_column = (*dparam.as_ptr()).cROILeftX;
        let i_alpha_pos = (*pSC).WMII.cLeadingPadding
            + if (*pSC).WMII.cfColorFormat == ColorFormat::Cmyk {
                4
            } else {
                3
            };
        let Some(p_a) = (*p_next_sc).a0MBbuffer[0] else {
            return Err(WmpError::Fail);
        };
        let p_a = p_a.as_ptr();
        let n_len = (*pSC).WMISCP.nLenMantissaOrShift;
        let n_exp_bias = (*pSC).WMISCP.nExpBias;
        let p_offset_x = (*dparam.as_ptr()).offset_x.as_ptr();
        let p_offset_y = (*dparam.as_ptr())
            .offset_y
            .as_ptr()
            .add(((*pSC).cRow - 1) * 16);

        if ColorFormat::Rgb != (*pSC).WMII.cfColorFormat
            && ColorFormat::Cmyk != (*pSC).WMII.cfColorFormat
        {
            return Err(WmpError::Fail);
        }
        let Some(base) = (*pSC).WMIBI.pv else {
            return Err(WmpError::Fail);
        };

        if bd == BitDepth::Eight {
            let i_bias = (1 << (i_shift + 7)) + if i_shift == 0 { 0 } else { 1 << (i_shift - 1) };
            let mut i_row = i_first_row;
            while i_row < c_height {
                let i_y = *p_offset_y.add(i_row);
                let mut i_column = i_first_column;
                while i_column < c_width {
                    let a = (*p_a
                        .add(((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize)
                        + i_bias)
                        >> i_shift;
                    let p_dst = base
                        .as_ptr()
                        .cast::<u8>()
                        .add(*p_offset_x.add(i_column) + i_y);
                    *p_dst.add(i_alpha_pos) = if a < 0 {
                        0
                    } else if a > 255 {
                        255
                    } else {
                        a as u8
                    };
                    i_column += 1;
                }
                i_row += 1;
            }
        } else if bd == BitDepth::Sixteen {
            let i_bias = (1 << (i_shift + 15)) + if i_shift == 0 { 0 } else { 1 << (i_shift - 1) };
            let mut i_row = i_first_row;
            while i_row < c_height {
                let i_y = *p_offset_y.add(i_row);
                let mut i_column = i_first_column;
                while i_column < c_width {
                    let a = ((*p_a
                        .add(((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize)
                        + i_bias)
                        >> i_shift)
                        << n_len;
                    let p_dst = base
                        .as_ptr()
                        .cast::<u16>()
                        .add(*p_offset_x.add(i_column) + i_y);
                    *p_dst.add(i_alpha_pos) = if a < 0 {
                        0
                    } else if a > 65535 {
                        65535
                    } else {
                        a as u16
                    };
                    i_column += 1;
                }
                i_row += 1;
            }
        } else if bd == BitDepth::SixteenS {
            let i_bias = if i_shift == 0 { 0 } else { 1 << (i_shift - 1) };
            let mut i_row = i_first_row;
            while i_row < c_height {
                let i_y = *p_offset_y.add(i_row);
                let mut i_column = i_first_column;
                while i_column < c_width {
                    let a = ((*p_a
                        .add(((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize)
                        + i_bias)
                        >> i_shift)
                        << n_len;
                    let p_dst = base
                        .as_ptr()
                        .cast::<i16>()
                        .add(*p_offset_x.add(i_column) + i_y);
                    *p_dst.add(i_alpha_pos) = if a < -32768 {
                        -32768
                    } else if a > 32767 {
                        32767
                    } else {
                        a as i16
                    };
                    i_column += 1;
                }
                i_row += 1;
            }
        } else if bd == BitDepth::SixteenF {
            let i_bias = if i_shift == 0 { 0 } else { 1 << (i_shift - 1) };
            let mut i_row = i_first_row;
            while i_row < c_height {
                let i_y = *p_offset_y.add(i_row);
                let mut i_column = i_first_column;
                while i_column < c_width {
                    let a = (*p_a
                        .add(((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize)
                        + i_bias)
                        >> i_shift;
                    let p_dst = base
                        .as_ptr()
                        .cast::<u16>()
                        .add(*p_offset_x.add(i_column) + i_y);
                    *p_dst.add(i_alpha_pos) = backward_half(a);
                    i_column += 1;
                }
                i_row += 1;
            }
        } else if bd == BitDepth::ThirtyTwoS {
            let i_bias = if i_shift == 0 { 0 } else { 1 << (i_shift - 1) };
            let mut i_row = i_first_row;
            while i_row < c_height {
                let i_y = *p_offset_y.add(i_row);
                let mut i_column = i_first_column;
                while i_column < c_width {
                    let a = ((*p_a
                        .add(((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize)
                        + i_bias)
                        >> i_shift)
                        << n_len;
                    let p_dst = base
                        .as_ptr()
                        .cast::<i32>()
                        .add(*p_offset_x.add(i_column) + i_y);
                    *p_dst.add(i_alpha_pos) = a;
                    i_column += 1;
                }
                i_row += 1;
            }
        } else if bd == BitDepth::ThirtyTwoF {
            let i_bias = if i_shift == 0 { 0 } else { 1 << (i_shift - 1) };
            let mut i_row = i_first_row;
            while i_row < c_height {
                let i_y = *p_offset_y.add(i_row);
                let mut i_column = i_first_column;
                while i_column < c_width {
                    let a = (*p_a
                        .add(((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize)
                        + i_bias)
                        >> i_shift;
                    let p_dst = base
                        .as_ptr()
                        .cast::<f32>()
                        .add(*p_offset_x.add(i_column) + i_y);
                    *p_dst.add(i_alpha_pos) = pixel2float(a, n_exp_bias, n_len);
                    i_column += 1;
                }
                i_row += 1;
            }
        } else {
            return Err(WmpError::Fail);
        }
    }

    Ok(())
}

/// Original function: `outputMBRow` at `original/jxrlib/image/decode/strdec.c:873`.
pub unsafe fn output_mb_row(pSC: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    let pSC = pSC as *mut CWMImageStrCodec;
    let Some(dparam) = (*pSC).m_Dparam else {
        return Err(WmpError::Fail);
    };
    let cf_ext = if (*pSC).m_param.cfColorFormat == ColorFormat::YOnly {
        ColorFormat::YOnly
    } else {
        (*pSC).WMII.cfColorFormat
    };
    let bd = (*pSC).WMII.bdBitDepth;
    let i_shift = if (*pSC).m_param.bScaledArith != 0 {
        (SHIFTZERO + QPFRACBITS) as usize
    } else {
        0
    };
    let c_height = std::cmp::min(
        ((*dparam.as_ptr()).cROIBottomY + 1) - ((*pSC).cRow - 1) * 16,
        16,
    );
    let c_width = (*dparam.as_ptr()).cROIRightX + 1;
    let i_first_row = if ((*pSC).cRow - 1) * 16 > (*dparam.as_ptr()).cROITopY {
        0
    } else {
        (*dparam.as_ptr()).cROITopY & 0xf
    };
    let i_first_column = (*dparam.as_ptr()).cROILeftX;
    let Some(p_y) = (*pSC).a0MBbuffer[0] else {
        return Err(WmpError::Fail);
    };
    let p_y = p_y.as_ptr();
    let p_u = if (*pSC).m_bUVResolutionChange != 0 {
        let Some(res_u) = (*pSC).pResU else {
            return Err(WmpError::Fail);
        };
        res_u.as_ptr()
    } else {
        // C assigns a0MBbuffer[1] directly (strdec.c:882); it is legitimately NULL for a
        // single-channel (YOnly) image where only a0MBbuffer[0] is allocated, and is never
        // dereferenced in that path — so allow NULL rather than treating it as an error.
        (*pSC).a0MBbuffer[1].map_or(std::ptr::null_mut(), NonNull::as_ptr)
    };
    let p_v = if (*pSC).m_bUVResolutionChange != 0 {
        let Some(res_v) = (*pSC).pResV else {
            return Err(WmpError::Fail);
        };
        res_v.as_ptr()
    } else {
        // C assigns a0MBbuffer[2] directly (strdec.c:883); NULL for single-channel images.
        (*pSC).a0MBbuffer[2].map_or(std::ptr::null_mut(), NonNull::as_ptr)
    };
    let i_b = if (*pSC).WMII.bRGB != 0 { 2 } else { 0 };
    let i_r = 2 - i_b;
    let n_len = (*pSC).WMISCP.nLenMantissaOrShift;
    let n_exp_bias = (*pSC).WMISCP.nExpBias;
    let p_offset_x = (*dparam.as_ptr()).offset_x.as_ptr();
    let p_offset_y = (*dparam.as_ptr())
        .offset_y
        .as_ptr()
        .add(((*pSC).cRow - 1) * if cf_ext == ColorFormat::Yuv420 { 8 } else { 16 });

    if let Some(next_sc) = (*pSC).m_pNextSC {
        debug_assert!((*pSC).m_param.bScaledArith == (*next_sc.as_ptr()).m_param.bScaledArith);
    }

    if check_image_buffer(
        pSC,
        if (*pSC).WMII.oOrientation >= Orientation::RotateCw {
            (*pSC).WMII.cROIHeight
        } else {
            (*pSC).WMII.cROIWidth
        },
        c_height - i_first_row,
    )
    .is_err()
    {
        return Err(WmpError::Fail);
    }

    if (*pSC).m_bUVResolutionChange != 0 {
        interpolate_uv(&mut *pSC);
    }
    let Some(base) = (*pSC).WMIBI.pv else {
        return Err(WmpError::Fail);
    };

    if (*pSC).WMISCP.bYUVData != 0 {
        let mut p_dst = base.as_ptr().cast::<i32>().add(
            ((*pSC).cRow - 1)
                * if (*pSC).m_param.cfColorFormat == ColorFormat::Yuv420 {
                    8
                } else {
                    16
                }
                * (*pSC).WMIBI.cbStride
                / std::mem::size_of::<i32>(),
        );

        match (*pSC).m_param.cfColorFormat {
            ColorFormat::YOnly | ColorFormat::Yuv444 | ColorFormat::NComponent => {
                let p_channel = (*pSC)
                    .a0MBbuffer
                    .map(|channel| channel.map_or(std::ptr::null_mut(), NonNull::as_ptr));
                let c_channel = if (*pSC).WMII.cfColorFormat == ColorFormat::YOnly {
                    1
                } else {
                    (*pSC).WMISCP.cChannel
                };
                debug_assert!(c_channel <= p_channel.len());

                for i_row in i_first_row..c_height {
                    let mut p_row = p_dst;
                    for i_column in i_first_column..c_width {
                        for p_channel in p_channel.iter().take(c_channel) {
                            let p = *(*p_channel).add(
                                ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 0xf] as usize,
                            );
                            *p_row = p;
                            p_row = p_row.add(1);
                        }
                    }
                    p_dst = p_dst.add((*pSC).WMIBI.cbStride / std::mem::size_of::<i32>());
                }
            }
            ColorFormat::Yuv422 => {
                for i_row in i_first_row..c_height {
                    let mut p_row = p_dst;
                    for i_column in (i_first_column..c_width).step_by(2) {
                        let i_idx =
                            ((i_column >> 4) << 7) + idx_cc[i_row][(i_column >> 1) & 7] as usize;
                        let u = *p_u.add(i_idx);
                        let v = *p_v.add(i_idx);
                        let y0 = *p_y
                            .add(((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize);
                        let y1 = *p_y.add(
                            (((i_column + 1) >> 4) << 8)
                                + idx_cc[i_row][(i_column + 1) & 15] as usize,
                        );
                        *p_row.add(0) = u;
                        *p_row.add(1) = y0;
                        *p_row.add(2) = v;
                        *p_row.add(3) = y1;
                        p_row = p_row.add(4);
                    }
                    p_dst = p_dst.add((*pSC).WMIBI.cbStride / std::mem::size_of::<i32>());
                }
            }
            ColorFormat::Yuv420 => {
                for i_row in (i_first_row..c_height).step_by(2) {
                    let mut p_row = p_dst;
                    for i_column in (i_first_column..c_width).step_by(2) {
                        let i_idx = ((i_column >> 4) << 6)
                            + idx_cc_420[i_row >> 1][(i_column >> 1) & 7] as usize;
                        let u = *p_u.add(i_idx);
                        let v = *p_v.add(i_idx);
                        let y0 = *p_y
                            .add(((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize);
                        let y1 = *p_y.add(
                            (((i_column + 1) >> 4) << 8)
                                + idx_cc[i_row][(i_column + 1) & 15] as usize,
                        );
                        let y2 = *p_y.add(
                            ((i_column >> 4) << 8) + idx_cc[i_row + 1][i_column & 15] as usize,
                        );
                        let y3 = *p_y.add(
                            (((i_column + 1) >> 4) << 8)
                                + idx_cc[i_row + 1][(i_column + 1) & 15] as usize,
                        );
                        *p_row.add(0) = y0;
                        *p_row.add(1) = y1;
                        *p_row.add(2) = y2;
                        *p_row.add(3) = y3;
                        *p_row.add(4) = u;
                        *p_row.add(5) = v;
                        p_row = p_row.add(6);
                    }
                    p_dst = p_dst.add((*pSC).WMIBI.cbStride / std::mem::size_of::<i32>());
                }
            }
            _ => debug_assert!(false),
        }
    } else if bd == BitDepth::Eight {
        let i_bias1 = 128 << i_shift;
        let i_bias2 = if (*pSC).m_param.bScaledArith != 0 {
            (1 << (SHIFTZERO + QPFRACBITS - 1)) - 1
        } else {
            0
        };
        let i_bias = i_bias1 + i_bias2;
        match cf_ext {
            ColorFormat::Rgb => {
                let p_a = if matches!(
                    AlphaMode::from_u8((*pSC).WMISCP.uAlphaMode),
                    Some(AlphaMode::Interleaved | AlphaMode::Planar | AlphaMode::Only)
                ) {
                    (*pSC)
                        .m_pNextSC
                        .and_then(|next_sc| (*next_sc.as_ptr()).a0MBbuffer[0].map(NonNull::as_ptr))
                } else {
                    None
                };
                for i_row in i_first_row..c_height {
                    let i_y = *p_offset_y.add(i_row);
                    for i_column in i_first_column..c_width {
                        let i_idx = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize;
                        let mut g = *p_y.add(i_idx) + i_bias;
                        let mut r = -*p_u.add(i_idx);
                        let mut b = *p_v.add(i_idx);
                        let mut a = p_a.map_or(0, |p_a| *p_a.add(i_idx) + i_bias);
                        g -= r >> 1;
                        r -= ((b + 1) >> 1) - g;
                        b += r;
                        if (*pSC).m_param.bScaledArith != 0 {
                            g >>= i_shift;
                            b >>= i_shift;
                            r >>= i_shift;
                            a >>= i_shift;
                        }
                        let p_dst = base
                            .as_ptr()
                            .cast::<u8>()
                            .add(*p_offset_x.add(i_column) + i_y);
                        *p_dst.add(i_r) = if r < 0 {
                            0
                        } else if r > 255 {
                            255
                        } else {
                            r as u8
                        };
                        *p_dst.add(1) = if g < 0 {
                            0
                        } else if g > 255 {
                            255
                        } else {
                            g as u8
                        };
                        *p_dst.add(i_b) = if b < 0 {
                            0
                        } else if b > 255 {
                            255
                        } else {
                            b as u8
                        };
                        if p_a.is_some() {
                            *p_dst.add(3) = if a < 0 {
                                0
                            } else if a > 255 {
                                255
                            } else {
                                a as u8
                            };
                        }
                    }
                }
            }
            ColorFormat::YOnly | ColorFormat::Yuv444 | ColorFormat::NComponent => {
                output_n_channel(
                    pSC,
                    i_first_row,
                    i_first_column,
                    c_width,
                    c_height,
                    i_shift,
                    i_bias,
                );
            }
            ColorFormat::Yuv422 => {
                let mut i_row = i_first_row;
                while i_row < c_height {
                    let i_y = *p_offset_y.add(i_row);
                    let mut i_column = i_first_column;
                    while i_column < c_width {
                        let i_idx =
                            ((i_column >> 4) << 7) + idx_cc[i_row][(i_column >> 1) & 7] as usize;
                        let u = (*p_u.add(i_idx) + i_bias) >> i_shift;
                        let v = (*p_v.add(i_idx) + i_bias) >> i_shift;
                        let y0 = (*p_y
                            .add(((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize)
                            + i_bias)
                            >> i_shift;
                        let y1 = (*p_y.add(
                            (((i_column + 1) >> 4) << 8)
                                + idx_cc[i_row][(i_column + 1) & 15] as usize,
                        ) + i_bias)
                            >> i_shift;
                        let p_dst = base
                            .as_ptr()
                            .cast::<u8>()
                            .add(*p_offset_x.add(i_column >> 1) + i_y);
                        *p_dst.add(0) = if u < 0 {
                            0
                        } else if u > 255 {
                            255
                        } else {
                            u as u8
                        };
                        *p_dst.add(1) = if y0 < 0 {
                            0
                        } else if y0 > 255 {
                            255
                        } else {
                            y0 as u8
                        };
                        *p_dst.add(2) = if v < 0 {
                            0
                        } else if v > 255 {
                            255
                        } else {
                            v as u8
                        };
                        *p_dst.add(3) = if y1 < 0 {
                            0
                        } else if y1 > 255 {
                            255
                        } else {
                            y1 as u8
                        };
                        i_column += 2;
                    }
                    i_row += 1;
                }
            }
            ColorFormat::Yuv420 => {
                const IS4: [[usize; 4]; 8] = [
                    [0, 1, 2, 3],
                    [2, 3, 0, 1],
                    [1, 0, 3, 2],
                    [3, 2, 1, 0],
                    [1, 3, 0, 2],
                    [3, 1, 2, 0],
                    [0, 2, 1, 3],
                    [2, 0, 3, 1],
                ];
                let o_o = (*pSC).WMII.oOrientation as usize;
                let i0 = IS4[o_o][0];
                let i1 = IS4[o_o][1];
                let i2 = IS4[o_o][2];
                let i3 = IS4[o_o][3];
                let mut i_row = i_first_row;
                while i_row < c_height {
                    let i_y = *p_offset_y.add(i_row >> 1);
                    let mut i_column = i_first_column;
                    while i_column < c_width {
                        let i_idx = ((i_column >> 4) << 6)
                            + idx_cc_420[i_row >> 1][(i_column >> 1) & 7] as usize;
                        let u = (*p_u.add(i_idx) + i_bias) >> i_shift;
                        let v = (*p_v.add(i_idx) + i_bias) >> i_shift;
                        let y0 = (*p_y
                            .add(((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize)
                            + i_bias)
                            >> i_shift;
                        let y1 = (*p_y.add(
                            (((i_column + 1) >> 4) << 8)
                                + idx_cc[i_row][(i_column + 1) & 15] as usize,
                        ) + i_bias)
                            >> i_shift;
                        let y2 = (*p_y.add(
                            ((i_column >> 4) << 8) + idx_cc[i_row + 1][i_column & 15] as usize,
                        ) + i_bias)
                            >> i_shift;
                        let y3 = (*p_y.add(
                            (((i_column + 1) >> 4) << 8)
                                + idx_cc[i_row + 1][(i_column + 1) & 15] as usize,
                        ) + i_bias)
                            >> i_shift;
                        let p_dst = base
                            .as_ptr()
                            .cast::<u8>()
                            .add(*p_offset_x.add(i_column >> 1) + i_y);
                        *p_dst.add(i0) = if y0 < 0 {
                            0
                        } else if y0 > 255 {
                            255
                        } else {
                            y0 as u8
                        };
                        *p_dst.add(i1) = if y1 < 0 {
                            0
                        } else if y1 > 255 {
                            255
                        } else {
                            y1 as u8
                        };
                        *p_dst.add(i2) = if y2 < 0 {
                            0
                        } else if y2 > 255 {
                            255
                        } else {
                            y2 as u8
                        };
                        *p_dst.add(i3) = if y3 < 0 {
                            0
                        } else if y3 > 255 {
                            255
                        } else {
                            y3 as u8
                        };
                        *p_dst.add(4) = if u < 0 {
                            0
                        } else if u > 255 {
                            255
                        } else {
                            u as u8
                        };
                        *p_dst.add(5) = if v < 0 {
                            0
                        } else if v > 255 {
                            255
                        } else {
                            v as u8
                        };
                        i_column += 2;
                    }
                    i_row += 2;
                }
            }
            ColorFormat::Cmyk => {
                let Some(p_k) = (*pSC).a0MBbuffer[3] else {
                    return Err(WmpError::Fail);
                };
                let p_k = p_k.as_ptr();
                let mut i_row = i_first_row;
                while i_row < c_height {
                    let i_y = *p_offset_y.add(i_row);
                    let mut i_column = i_first_column;
                    while i_column < c_width {
                        let i_idx = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize;
                        let mut m = -*p_y.add(i_idx) + i_bias1;
                        let mut c = *p_u.add(i_idx);
                        let mut y = -*p_v.add(i_idx);
                        let mut k = *p_k.add(i_idx) + i_bias2;
                        k -= c >> 2;
                        c += k;
                        k += m;
                        c += m;
                        m += y;
                        c >>= i_shift;
                        m >>= i_shift;
                        y >>= i_shift;
                        k >>= i_shift;
                        let p_dst = base
                            .as_ptr()
                            .cast::<u8>()
                            .add(*p_offset_x.add(i_column) + i_y);
                        *p_dst.add(0) = if c < 0 {
                            0
                        } else if c > 255 {
                            255
                        } else {
                            c as u8
                        };
                        *p_dst.add(1) = if m < 0 {
                            0
                        } else if m > 255 {
                            255
                        } else {
                            m as u8
                        };
                        *p_dst.add(2) = if y < 0 {
                            0
                        } else if y > 255 {
                            255
                        } else {
                            y as u8
                        };
                        *p_dst.add(3) = if k < 0 {
                            0
                        } else if k > 255 {
                            255
                        } else {
                            k as u8
                        };
                        i_column += 1;
                    }
                    i_row += 1;
                }
            }
            ColorFormat::Rgbe => {
                let mut i_row = i_first_row;
                while i_row < c_height {
                    let i_y = *p_offset_y.add(i_row);
                    let mut i_column = i_first_column;
                    while i_column < c_width {
                        let i_idx = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize;
                        let mut g = *p_y.add(i_idx) + i_bias2;
                        let mut r = -*p_u.add(i_idx);
                        let mut b = *p_v.add(i_idx);
                        g -= r >> 1;
                        r -= ((b + 1) >> 1) - g;
                        b += r;
                        let p_dst = base
                            .as_ptr()
                            .cast::<u8>()
                            .add(*p_offset_x.add(i_column) + i_y);
                        inverse_convert_rgbe(
                            r >> i_shift,
                            g >> i_shift,
                            b >> i_shift,
                            std::slice::from_raw_parts_mut(p_dst, 4),
                        );
                        i_column += 1;
                    }
                    i_row += 1;
                }
            }
            _ => debug_assert!(false),
        }
    } else if bd == BitDepth::Sixteen {
        let i_bias = ((((1_i64 << 15) >> n_len) << i_shift) as i32)
            + if i_shift == 0 { 0 } else { 1 << (i_shift - 1) };
        match cf_ext {
            ColorFormat::Rgb => {
                let mut i_row = i_first_row;
                while i_row < c_height {
                    let i_y = *p_offset_y.add(i_row);
                    let mut i_column = i_first_column;
                    while i_column < c_width {
                        let i_idx = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize;
                        let mut g = *p_y.add(i_idx) + i_bias;
                        let mut r = -*p_u.add(i_idx);
                        let mut b = *p_v.add(i_idx);
                        g -= r >> 1;
                        r -= ((b + 1) >> 1) - g;
                        b += r;
                        if (*pSC).m_param.bScaledArith == 0 {
                            g <<= n_len;
                            b <<= n_len;
                            r <<= n_len;
                        } else {
                            g = (g >> i_shift) << n_len;
                            b = (b >> i_shift) << n_len;
                            r = (r >> i_shift) << n_len;
                        }
                        let p_dst = base
                            .as_ptr()
                            .cast::<u16>()
                            .add(*p_offset_x.add(i_column) + i_y);
                        *p_dst.add(0) = if r < 0 {
                            0
                        } else if r > 65535 {
                            65535
                        } else {
                            r as u16
                        };
                        *p_dst.add(1) = if g < 0 {
                            0
                        } else if g > 65535 {
                            65535
                        } else {
                            g as u16
                        };
                        *p_dst.add(2) = if b < 0 {
                            0
                        } else if b > 65535 {
                            65535
                        } else {
                            b as u16
                        };
                        i_column += 1;
                    }
                    i_row += 1;
                }
            }
            ColorFormat::YOnly | ColorFormat::Yuv444 | ColorFormat::NComponent => {
                output_n_channel(
                    pSC,
                    i_first_row,
                    i_first_column,
                    c_width,
                    c_height,
                    i_shift,
                    i_bias,
                );
            }
            ColorFormat::Yuv422 => {
                let o_o = (*pSC).WMII.oOrientation;
                let i0 = if o_o == Orientation::FlipH
                    || o_o == Orientation::FlipVH
                    || o_o == Orientation::RotateCwFlipV
                    || o_o == Orientation::RotateCwFlipVH
                {
                    1
                } else {
                    0
                };
                let i1 = 1 - i0;
                let mut i_row = i_first_row;
                while i_row < c_height {
                    let i_y = *p_offset_y.add(i_row);
                    let mut i_column = i_first_column;
                    while i_column < c_width {
                        let i_idx =
                            ((i_column >> 4) << 7) + idx_cc[i_row][(i_column >> 1) & 7] as usize;
                        let u = ((*p_u.add(i_idx) + i_bias) >> i_shift) << n_len;
                        let v = ((*p_v.add(i_idx) + i_bias) >> i_shift) << n_len;
                        let y0 = ((*p_y
                            .add(((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize)
                            + i_bias)
                            >> i_shift)
                            << n_len;
                        let y1 = ((*p_y.add(
                            (((i_column + 1) >> 4) << 8)
                                + idx_cc[i_row][(i_column + 1) & 15] as usize,
                        ) + i_bias)
                            >> i_shift)
                            << n_len;
                        let p_dst = base
                            .as_ptr()
                            .cast::<u16>()
                            .add(*p_offset_x.add(i_column >> 1) + i_y);
                        *p_dst.add(i0) = if u < 0 {
                            0
                        } else if u > 65535 {
                            65535
                        } else {
                            u as u16
                        };
                        *p_dst.add(i1) = if y0 < 0 {
                            0
                        } else if y0 > 65535 {
                            65535
                        } else {
                            y0 as u16
                        };
                        *p_dst.add(2) = if v < 0 {
                            0
                        } else if v > 65535 {
                            65535
                        } else {
                            v as u16
                        };
                        *p_dst.add(3) = if y1 < 0 {
                            0
                        } else if y1 > 65535 {
                            65535
                        } else {
                            y1 as u16
                        };
                        i_column += 2;
                    }
                    i_row += 1;
                }
            }
            ColorFormat::Yuv420 => {
                const IS4: [[usize; 4]; 8] = [
                    [0, 1, 2, 3],
                    [2, 3, 0, 1],
                    [1, 0, 3, 2],
                    [3, 2, 1, 0],
                    [1, 3, 0, 2],
                    [3, 1, 2, 0],
                    [0, 2, 1, 3],
                    [2, 0, 3, 1],
                ];
                let o_o = (*pSC).WMII.oOrientation as usize;
                let i0 = IS4[o_o][0];
                let i1 = IS4[o_o][1];
                let i2 = IS4[o_o][2];
                let i3 = IS4[o_o][3];
                let mut i_row = i_first_row;
                while i_row < c_height {
                    let i_y = *p_offset_y.add(i_row >> 1);
                    let mut i_column = i_first_column;
                    while i_column < c_width {
                        let i_idx =
                            ((i_column >> 3) << 6) + idx_cc[i_row][(i_column >> 1) & 7] as usize;
                        let u = ((*p_u.add(i_idx) + i_bias) >> i_shift) << n_len;
                        let v = ((*p_v.add(i_idx) + i_bias) >> i_shift) << n_len;
                        let y0 = ((*p_y
                            .add(((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize)
                            + i_bias)
                            >> i_shift)
                            << n_len;
                        let y1 = ((*p_y.add(
                            (((i_column + 1) >> 4) << 8)
                                + idx_cc[i_row][(i_column + 1) & 15] as usize,
                        ) + i_bias)
                            >> i_shift)
                            << n_len;
                        let y2 = ((*p_y.add(
                            ((i_column >> 4) << 8) + idx_cc[i_row + 1][i_column & 15] as usize,
                        ) + i_bias)
                            >> i_shift)
                            << n_len;
                        let y3 = ((*p_y.add(
                            (((i_column + 1) >> 4) << 8)
                                + idx_cc[i_row + 1][(i_column + 1) & 15] as usize,
                        ) + i_bias)
                            >> i_shift)
                            << n_len;
                        let p_dst = base
                            .as_ptr()
                            .cast::<u16>()
                            .add(*p_offset_x.add(i_column >> 1) + i_y);
                        *p_dst.add(i0) = if y0 < 0 {
                            0
                        } else if y0 > 65535 {
                            65535
                        } else {
                            y0 as u16
                        };
                        *p_dst.add(i1) = if y1 < 0 {
                            0
                        } else if y1 > 65535 {
                            65535
                        } else {
                            y1 as u16
                        };
                        *p_dst.add(i2) = if y2 < 0 {
                            0
                        } else if y2 > 65535 {
                            65535
                        } else {
                            y2 as u16
                        };
                        *p_dst.add(i3) = if y3 < 0 {
                            0
                        } else if y3 > 65535 {
                            65535
                        } else {
                            y3 as u16
                        };
                        *p_dst.add(4) = if u < 0 {
                            0
                        } else if u > 65535 {
                            65535
                        } else {
                            u as u16
                        };
                        *p_dst.add(5) = if v < 0 {
                            0
                        } else if v > 65535 {
                            65535
                        } else {
                            v as u16
                        };
                        i_column += 2;
                    }
                    i_row += 2;
                }
            }
            ColorFormat::Cmyk => {
                let Some(p_k) = (*pSC).a0MBbuffer[3] else {
                    return Err(WmpError::Fail);
                };
                let p_k = p_k.as_ptr();
                let i_bias1 = (32768 >> n_len) << i_shift;
                let i_bias2 = i_bias - i_bias1;
                let mut i_row = i_first_row;
                while i_row < c_height {
                    let i_y = *p_offset_y.add(i_row);
                    let mut i_column = i_first_column;
                    while i_column < c_width {
                        let i_idx = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize;
                        let mut m = -*p_y.add(i_idx) + i_bias1;
                        let mut c = *p_u.add(i_idx);
                        let mut y = -*p_v.add(i_idx);
                        let mut k = *p_k.add(i_idx) + i_bias2;
                        k -= c >> 2;
                        c += k;
                        k += m;
                        c += m;
                        m += y;
                        c = (c >> i_shift) << n_len;
                        m = (m >> i_shift) << n_len;
                        y = (y >> i_shift) << n_len;
                        k = (k >> i_shift) << n_len;
                        let p_dst = base
                            .as_ptr()
                            .cast::<u16>()
                            .add(*p_offset_x.add(i_column) + i_y);
                        *p_dst.add(0) = if c < 0 {
                            0
                        } else if c > 65535 {
                            65535
                        } else {
                            c as u16
                        };
                        *p_dst.add(1) = if m < 0 {
                            0
                        } else if m > 65535 {
                            65535
                        } else {
                            m as u16
                        };
                        *p_dst.add(2) = if y < 0 {
                            0
                        } else if y > 65535 {
                            65535
                        } else {
                            y as u16
                        };
                        *p_dst.add(3) = if k < 0 {
                            0
                        } else if k > 65535 {
                            65535
                        } else {
                            k as u16
                        };
                        i_column += 1;
                    }
                    i_row += 1;
                }
            }
            _ => debug_assert!(false),
        }
    } else if bd == BitDepth::SixteenS {
        let i_bias = if (*pSC).m_param.bScaledArith != 0 {
            (1 << (SHIFTZERO + QPFRACBITS - 1)) - 1
        } else {
            0
        };
        match cf_ext {
            ColorFormat::Rgb => {
                let mut i_row = i_first_row;
                while i_row < c_height {
                    let i_y = *p_offset_y.add(i_row);
                    let mut i_column = i_first_column;
                    while i_column < c_width {
                        let i_idx = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize;
                        let mut g = *p_y.add(i_idx) + i_bias;
                        let mut r = -*p_u.add(i_idx);
                        let mut b = *p_v.add(i_idx);
                        g -= r >> 1;
                        r -= ((b + 1) >> 1) - g;
                        b += r;
                        r = (r >> i_shift) << n_len;
                        g = (g >> i_shift) << n_len;
                        b = (b >> i_shift) << n_len;
                        let p_dst = base
                            .as_ptr()
                            .cast::<i16>()
                            .add(*p_offset_x.add(i_column) + i_y);
                        *p_dst.add(0) = if r < -32768 {
                            -32768
                        } else if r > 32767 {
                            32767
                        } else {
                            r as i16
                        };
                        *p_dst.add(1) = if g < -32768 {
                            -32768
                        } else if g > 32767 {
                            32767
                        } else {
                            g as i16
                        };
                        *p_dst.add(2) = if b < -32768 {
                            -32768
                        } else if b > 32767 {
                            32767
                        } else {
                            b as i16
                        };
                        i_column += 1;
                    }
                    i_row += 1;
                }
            }
            ColorFormat::YOnly | ColorFormat::Yuv444 | ColorFormat::NComponent => {
                output_n_channel(
                    pSC,
                    i_first_row,
                    i_first_column,
                    c_width,
                    c_height,
                    i_shift,
                    i_bias,
                );
            }
            ColorFormat::Cmyk => {
                let Some(p_k) = (*pSC).a0MBbuffer[3] else {
                    return Err(WmpError::Fail);
                };
                let p_k = p_k.as_ptr();
                let mut i_row = i_first_row;
                while i_row < c_height {
                    let i_y = *p_offset_y.add(i_row);
                    let mut i_column = i_first_column;
                    while i_column < c_width {
                        let i_idx = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize;
                        let mut m = -*p_y.add(i_idx);
                        let mut c = *p_u.add(i_idx);
                        let mut y = -*p_v.add(i_idx);
                        let mut k = *p_k.add(i_idx) + i_bias;
                        k -= c >> 2;
                        c += k;
                        k += m;
                        c += m;
                        m += y;
                        c = (c >> i_shift) << n_len;
                        m = (m >> i_shift) << n_len;
                        y = (y >> i_shift) << n_len;
                        k = (k >> i_shift) << n_len;
                        let p_dst = base
                            .as_ptr()
                            .cast::<i16>()
                            .add(*p_offset_x.add(i_column) + i_y);
                        *p_dst.add(0) = c as i16;
                        *p_dst.add(1) = m as i16;
                        *p_dst.add(2) = y as i16;
                        *p_dst.add(3) = k as i16;
                        i_column += 1;
                    }
                    i_row += 1;
                }
            }
            _ => debug_assert!(false),
        }
    } else if bd == BitDepth::SixteenF {
        let i_bias = if (*pSC).m_param.bScaledArith != 0 {
            (1 << (SHIFTZERO + QPFRACBITS - 1)) - 1
        } else {
            0
        };
        match cf_ext {
            ColorFormat::Rgb => {
                let mut i_row = i_first_row;
                while i_row < c_height {
                    let i_y = *p_offset_y.add(i_row);
                    let mut i_column = i_first_column;
                    while i_column < c_width {
                        let i_idx = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize;
                        let mut g = *p_y.add(i_idx) + i_bias;
                        let mut r = -*p_u.add(i_idx);
                        let mut b = *p_v.add(i_idx);
                        g -= r >> 1;
                        r -= ((b + 1) >> 1) - g;
                        b += r;
                        let p_dst = base
                            .as_ptr()
                            .cast::<u16>()
                            .add(*p_offset_x.add(i_column) + i_y);
                        *p_dst.add(0) = backward_half(r >> i_shift);
                        *p_dst.add(1) = backward_half(g >> i_shift);
                        *p_dst.add(2) = backward_half(b >> i_shift);
                        i_column += 1;
                    }
                    i_row += 1;
                }
            }
            ColorFormat::YOnly | ColorFormat::Yuv444 | ColorFormat::NComponent => {
                output_n_channel(
                    pSC,
                    i_first_row,
                    i_first_column,
                    c_width,
                    c_height,
                    i_shift,
                    i_bias,
                );
            }
            _ => debug_assert!(false),
        }
    } else if bd == BitDepth::ThirtyTwo {
        let i_bias = ((((1_i64 << 31) >> n_len) << i_shift) as i32)
            + if i_shift == 0 { 0 } else { 1 << (i_shift - 1) };
        match cf_ext {
            ColorFormat::Rgb => {
                let mut i_row = i_first_row;
                while i_row < c_height {
                    let i_y = *p_offset_y.add(i_row);
                    let mut i_column = i_first_column;
                    while i_column < c_width {
                        let i_idx = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize;
                        let mut g = *p_y.add(i_idx) + i_bias;
                        let mut r = -*p_u.add(i_idx);
                        let mut b = *p_v.add(i_idx);
                        g -= r >> 1;
                        r -= ((b + 1) >> 1) - g;
                        b += r;
                        let p_dst = base
                            .as_ptr()
                            .cast::<u32>()
                            .add(*p_offset_x.add(i_column) + i_y);
                        *p_dst.add(0) = ((r >> i_shift) << n_len) as u32;
                        *p_dst.add(1) = ((g >> i_shift) << n_len) as u32;
                        *p_dst.add(2) = ((b >> i_shift) << n_len) as u32;
                        i_column += 1;
                    }
                    i_row += 1;
                }
            }
            ColorFormat::YOnly | ColorFormat::Yuv444 | ColorFormat::NComponent => {
                output_n_channel(
                    pSC,
                    i_first_row,
                    i_first_column,
                    c_width,
                    c_height,
                    i_shift,
                    i_bias,
                );
            }
            _ => debug_assert!(false),
        }
    } else if bd == BitDepth::ThirtyTwoS {
        let i_bias = if (*pSC).m_param.bScaledArith != 0 {
            (1 << (SHIFTZERO + QPFRACBITS - 1)) - 1
        } else {
            0
        };
        match cf_ext {
            ColorFormat::Rgb => {
                let mut i_row = i_first_row;
                while i_row < c_height {
                    let i_y = *p_offset_y.add(i_row);
                    let mut i_column = i_first_column;
                    while i_column < c_width {
                        let i_idx = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize;
                        let mut g = *p_y.add(i_idx) + i_bias;
                        let mut r = -*p_u.add(i_idx);
                        let mut b = *p_v.add(i_idx);
                        g -= r >> 1;
                        r -= ((b + 1) >> 1) - g;
                        b += r;
                        let p_dst = base
                            .as_ptr()
                            .cast::<i32>()
                            .add(*p_offset_x.add(i_column) + i_y);
                        *p_dst.add(0) = ((r >> i_shift) << n_len) as i32;
                        *p_dst.add(1) = ((g >> i_shift) << n_len) as i32;
                        *p_dst.add(2) = ((b >> i_shift) << n_len) as i32;
                        i_column += 1;
                    }
                    i_row += 1;
                }
            }
            ColorFormat::YOnly | ColorFormat::Yuv444 | ColorFormat::NComponent => {
                output_n_channel(
                    pSC,
                    i_first_row,
                    i_first_column,
                    c_width,
                    c_height,
                    i_shift,
                    i_bias,
                );
            }
            _ => debug_assert!(false),
        }
    } else if bd == BitDepth::ThirtyTwoF {
        let i_bias = if (*pSC).m_param.bScaledArith != 0 {
            (1 << (SHIFTZERO + QPFRACBITS - 1)) - 1
        } else {
            0
        };
        match cf_ext {
            ColorFormat::Rgb => {
                let mut i_row = i_first_row;
                while i_row < c_height {
                    let i_y = *p_offset_y.add(i_row);
                    let mut i_column = i_first_column;
                    while i_column < c_width {
                        let i_idx = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize;
                        let mut g = *p_y.add(i_idx) + i_bias;
                        let mut r = -*p_u.add(i_idx);
                        let mut b = *p_v.add(i_idx);
                        g -= r >> 1;
                        r -= ((b + 1) >> 1) - g;
                        b += r;
                        let p_dst = base
                            .as_ptr()
                            .cast::<f32>()
                            .add(*p_offset_x.add(i_column) + i_y);
                        *p_dst.add(0) = pixel2float(r >> i_shift, n_exp_bias, n_len);
                        *p_dst.add(1) = pixel2float(g >> i_shift, n_exp_bias, n_len);
                        *p_dst.add(2) = pixel2float(b >> i_shift, n_exp_bias, n_len);
                        i_column += 1;
                    }
                    i_row += 1;
                }
            }
            ColorFormat::YOnly | ColorFormat::Yuv444 | ColorFormat::NComponent => {
                output_n_channel(
                    pSC,
                    i_first_row,
                    i_first_column,
                    c_width,
                    c_height,
                    i_shift,
                    i_bias,
                );
            }
            _ => debug_assert!(false),
        }
    } else if bd == BitDepth::Five {
        let i_bias = (16 << i_shift)
            + if (*pSC).m_param.bScaledArith != 0 {
                (1 << (SHIFTZERO + QPFRACBITS - 1)) - 1
            } else {
                0
            };
        debug_assert!(cf_ext == ColorFormat::Rgb);
        let mut i_row = i_first_row;
        while i_row < c_height {
            let i_y = *p_offset_y.add(i_row);
            let mut i_column = i_first_column;
            while i_column < c_width {
                let i_idx = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize;
                let mut g = *p_y.add(i_idx) + i_bias;
                let mut r = -*p_u.add(i_idx);
                let mut b = *p_v.add(i_idx);
                g -= r >> 1;
                r -= ((b + 1) >> 1) - g;
                b += r;
                g >>= i_shift;
                b >>= i_shift;
                r >>= i_shift;
                let p_dst = base
                    .as_ptr()
                    .cast::<u16>()
                    .add(*p_offset_x.add(i_column) + i_y);
                let rr = if r < 0 {
                    0
                } else if r > 31 {
                    31
                } else {
                    r as u16
                };
                let gg = if g < 0 {
                    0
                } else if g > 31 {
                    31
                } else {
                    g as u16
                };
                let bb = if b < 0 {
                    0
                } else if b > 31 {
                    31
                } else {
                    b as u16
                };
                *p_dst = if (*pSC).m_param.bRBSwapped != 0 {
                    bb + (gg << 5) + (rr << 10)
                } else {
                    rr + (gg << 5) + (bb << 10)
                };
                i_column += 1;
            }
            i_row += 1;
        }
    } else if bd == BitDepth::FiveSixFive {
        let i_bias = (32 << i_shift)
            + if (*pSC).m_param.bScaledArith != 0 {
                (1 << (SHIFTZERO + QPFRACBITS - 1)) - 1
            } else {
                0
            };
        debug_assert!(cf_ext == ColorFormat::Rgb);
        let mut i_row = i_first_row;
        while i_row < c_height {
            let i_y = *p_offset_y.add(i_row);
            let mut i_column = i_first_column;
            while i_column < c_width {
                let i_idx = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize;
                let mut g = *p_y.add(i_idx) + i_bias;
                let mut r = -*p_u.add(i_idx);
                let mut b = *p_v.add(i_idx);
                g -= r >> 1;
                r -= ((b + 1) >> 1) - g;
                b += r;
                g >>= i_shift;
                b >>= i_shift + 1;
                r >>= i_shift + 1;
                let p_dst = base
                    .as_ptr()
                    .cast::<u16>()
                    .add(*p_offset_x.add(i_column) + i_y);
                let rr = if r < 0 {
                    0
                } else if r > 31 {
                    31
                } else {
                    r as u16
                };
                let gg = if g < 0 {
                    0
                } else if g > 63 {
                    63
                } else {
                    g as u16
                };
                let bb = if b < 0 {
                    0
                } else if b > 31 {
                    31
                } else {
                    b as u16
                };
                *p_dst = if (*pSC).m_param.bRBSwapped != 0 {
                    bb + (gg << 5) + (rr << 11)
                } else {
                    rr + (gg << 5) + (bb << 11)
                };
                i_column += 1;
            }
            i_row += 1;
        }
    } else if bd == BitDepth::Ten {
        let i_bias = (512 << i_shift)
            + if (*pSC).m_param.bScaledArith != 0 {
                (1 << (SHIFTZERO + QPFRACBITS - 1)) - 1
            } else {
                0
            };
        debug_assert!(cf_ext == ColorFormat::Rgb);
        let mut i_row = i_first_row;
        while i_row < c_height {
            let i_y = *p_offset_y.add(i_row);
            let mut i_column = i_first_column;
            while i_column < c_width {
                let i_idx = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize;
                let mut g = *p_y.add(i_idx) + i_bias;
                let mut r = -*p_u.add(i_idx);
                let mut b = *p_v.add(i_idx);
                g -= r >> 1;
                r -= ((b + 1) >> 1) - g;
                b += r;
                g >>= i_shift;
                b >>= i_shift;
                r >>= i_shift;
                let p_dst = base
                    .as_ptr()
                    .cast::<u32>()
                    .add(*p_offset_x.add(i_column) + i_y);
                let rr = if r < 0 {
                    0
                } else if r > 1023 {
                    1023
                } else {
                    r as u32
                };
                let gg = if g < 0 {
                    0
                } else if g > 1023 {
                    1023
                } else {
                    g as u32
                };
                let bb = if b < 0 {
                    0
                } else if b > 1023 {
                    1023
                } else {
                    b as u32
                };
                *p_dst = if (*pSC).m_param.bRBSwapped != 0 {
                    bb + (gg << 10) + (rr << 20)
                } else {
                    rr + (gg << 10) + (bb << 20)
                };
                i_column += 1;
            }
            i_row += 1;
        }
    } else if bd == BitDepth::One {
        let i_pos = (*pSC).WMII.cLeadingPadding;
        let i_th = if i_shift > 0 { 1 << (i_shift - 1) } else { 1 };
        debug_assert!(
            cf_ext == ColorFormat::YOnly && (*pSC).m_param.cfColorFormat == ColorFormat::YOnly
        );
        if (*pSC).WMII.oOrientation < Orientation::RotateCw {
            let mut i_row = i_first_row;
            while i_row < c_height {
                let i_y = *p_offset_y.add(i_row) + i_pos;
                let mut i_column = i_first_column;
                while i_column < c_width {
                    let p_byte = base
                        .as_ptr()
                        .cast::<u8>()
                        .add((*p_offset_x.add(i_column) >> 3) + i_y);
                    let c_byte = *p_byte;
                    let c_shift = (7 - (*p_offset_x.add(i_column) & 7)) as u8;
                    let bit = (((*pSC).WMISCP.bBlackWhite
                        + (*p_y.add(((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize)
                            >= i_th) as i32) as u8
                        + (c_byte >> c_shift))
                        & 0x1;
                    *p_byte ^= bit << c_shift;
                    i_column += 1;
                }
                i_row += 1;
            }
        } else {
            let mut i_row = i_first_row;
            while i_row < c_height {
                let i_y = *p_offset_y.add(i_row) + i_pos;
                let mut i_column = i_first_column;
                while i_column < c_width {
                    let p_byte = base
                        .as_ptr()
                        .cast::<u8>()
                        .add(*p_offset_x.add(i_column) + (i_y >> 3));
                    let c_byte = *p_byte;
                    let c_shift = (7 - (i_y & 7)) as u8;
                    let bit = (((*pSC).WMISCP.bBlackWhite
                        + (*p_y.add(((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize)
                            >= i_th) as i32) as u8
                        + (c_byte >> c_shift))
                        & 0x1;
                    *p_byte ^= bit << c_shift;
                    i_column += 1;
                }
                i_row += 1;
            }
        }
    }

    if matches!(
        AlphaMode::from_u8((*pSC).WMISCP.uAlphaMode),
        Some(AlphaMode::Interleaved | AlphaMode::Planar | AlphaMode::Only)
    ) && output_mb_row_alpha(&mut *pSC).is_err()
    {
        return Err(WmpError::Fail);
    }

    Ok(())
}

/// Original function: `outputNChannelThumbnail` at `original/jxrlib/image/decode/strdec.c:1707`.
pub unsafe fn output_n_channel_thumbnail(
    pSC: *mut CWMImageStrCodec,
    c_mul: i32,
    r_shift_y: usize,
    i_first_row: usize,
    i_first_column: usize,
) {
    // m_Dparam is Some for the entire decode after StrDecInit.
    let dparam = (*pSC).m_Dparam.expect("m_Dparam set during StrDecInit");
    let t_scale = (*dparam.as_ptr()).cThumbnailScale;
    let c_width = (*dparam.as_ptr()).cROIRightX + 1;
    let c_height = std::cmp::min(
        ((*dparam.as_ptr()).cROIBottomY + 1) - ((*pSC).cRow - 1) * 16,
        16,
    );
    let c_channel = (*pSC).WMISCP.cChannel;
    let n_len = (*pSC).WMISCP.nLenMantissaOrShift;
    let n_exp_bias = (*pSC).WMISCP.nExpBias;
    let mut n_bits = 0_usize;
    let mut channels = (*pSC)
        .a0MBbuffer
        .map(|channel| channel.map_or(std::ptr::null_mut(), NonNull::as_ptr));
    let offset_x = &(&(*dparam.as_ptr()).offset_x)[..];
    let offset_y = &(&(*dparam.as_ptr()).offset_y)[(((*pSC).cRow - 1) * 16 / t_scale)..];
    let channel_len = (((c_width.saturating_sub(1) >> 4) + 1) << 8) as usize;

    while (1_usize << n_bits) < t_scale {
        n_bits += 1;
    }

    debug_assert!(c_channel <= channels.len());

    if (*pSC).m_bUVResolutionChange != 0 {
        let (Some(res_u), Some(res_v)) = ((*pSC).pResU, (*pSC).pResV) else {
            return;
        };
        channels[1] = res_u.as_ptr();
        channels[2] = res_v.as_ptr();
    }
    let Some(base) = (*pSC).WMIBI.pv else {
        return;
    };

    match (*pSC).WMII.bdBitDepth {
        BitDepth::Eight => {
            let i_offset = ((128 << r_shift_y) / c_mul) as i32;
            for i_row in (i_first_row..c_height).step_by(t_scale) {
                let i_y = offset_y[i_row >> n_bits];
                for i_column in (i_first_column..c_width).step_by(t_scale) {
                    let i_idx = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize;
                    let dst = std::slice::from_raw_parts_mut(
                        base.as_ptr()
                            .cast::<u8>()
                            .add(i_y + offset_x[i_column >> n_bits]),
                        c_channel,
                    );
                    for (i_channel, channel) in channels.iter().take(c_channel).enumerate() {
                        let channel = std::slice::from_raw_parts(*channel, channel_len);
                        let p = (((channel[i_idx] + i_offset) * c_mul) >> r_shift_y) as i32;
                        dst[i_channel] = if p < 0 {
                            0
                        } else if p > 255 {
                            255
                        } else {
                            p as u8
                        };
                    }
                }
            }
        }
        BitDepth::Sixteen => {
            let i_offset = ((32768 << r_shift_y) / c_mul) as i32;
            for i_row in (i_first_row..c_height).step_by(t_scale) {
                let i_y = offset_y[i_row >> n_bits];
                for i_column in (i_first_column..c_width).step_by(t_scale) {
                    let i_idx = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize;
                    let dst = std::slice::from_raw_parts_mut(
                        base.as_ptr()
                            .cast::<u16>()
                            .add(i_y + offset_x[i_column >> n_bits]),
                        c_channel,
                    );
                    for (i_channel, channel) in channels.iter().take(c_channel).enumerate() {
                        let channel = std::slice::from_raw_parts(*channel, channel_len);
                        let p =
                            ((((channel[i_idx] + i_offset) * c_mul) >> r_shift_y) << n_len) as i32;
                        dst[i_channel] = if p < 0 {
                            0
                        } else if p > 65535 {
                            65535
                        } else {
                            p as u16
                        };
                    }
                }
            }
        }
        BitDepth::SixteenS => {
            for i_row in (i_first_row..c_height).step_by(t_scale) {
                let i_y = offset_y[i_row >> n_bits];
                for i_column in (i_first_column..c_width).step_by(t_scale) {
                    let i_idx = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize;
                    let dst = std::slice::from_raw_parts_mut(
                        base.as_ptr()
                            .cast::<i16>()
                            .add(i_y + offset_x[i_column >> n_bits]),
                        c_channel,
                    );
                    for (i_channel, channel) in channels.iter().take(c_channel).enumerate() {
                        let channel = std::slice::from_raw_parts(*channel, channel_len);
                        let p = (((channel[i_idx] * c_mul) >> r_shift_y) << n_len) as i32;
                        dst[i_channel] = if p < -32768 {
                            -32768
                        } else if p > 32767 {
                            32767
                        } else {
                            p as i16
                        };
                    }
                }
            }
        }
        BitDepth::SixteenF => {
            for i_row in (i_first_row..c_height).step_by(t_scale) {
                let i_y = offset_y[i_row >> n_bits];
                for i_column in (i_first_column..c_width).step_by(t_scale) {
                    let i_idx = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize;
                    let dst = std::slice::from_raw_parts_mut(
                        base.as_ptr()
                            .cast::<u16>()
                            .add(i_y + offset_x[i_column >> n_bits]),
                        c_channel,
                    );
                    for (i_channel, channel) in channels.iter().take(c_channel).enumerate() {
                        let channel = std::slice::from_raw_parts(*channel, channel_len);
                        let p = ((channel[i_idx] * c_mul) >> r_shift_y) as i32;
                        dst[i_channel] = backward_half(p);
                    }
                }
            }
        }
        BitDepth::ThirtyTwo => {
            let i_offset = ((((1_i64 << 31) >> n_len) << r_shift_y) / c_mul as i64) as i32;
            for i_row in (i_first_row..c_height).step_by(t_scale) {
                let i_y = offset_y[i_row >> n_bits];
                for i_column in (i_first_column..c_width).step_by(t_scale) {
                    let i_idx = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize;
                    let dst = std::slice::from_raw_parts_mut(
                        base.as_ptr()
                            .cast::<u32>()
                            .add(i_y + offset_x[i_column >> n_bits]),
                        c_channel,
                    );
                    for (i_channel, channel) in channels.iter().take(c_channel).enumerate() {
                        let channel = std::slice::from_raw_parts(*channel, channel_len);
                        let p =
                            ((((channel[i_idx] + i_offset) * c_mul) >> r_shift_y) << n_len) as i32;
                        dst[i_channel] = p as u32;
                    }
                }
            }
        }
        BitDepth::ThirtyTwoS => {
            for i_row in (i_first_row..c_height).step_by(t_scale) {
                let i_y = offset_y[i_row >> n_bits];
                for i_column in (i_first_column..c_width).step_by(t_scale) {
                    let i_idx = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize;
                    let dst = std::slice::from_raw_parts_mut(
                        base.as_ptr()
                            .cast::<i32>()
                            .add(i_y + offset_x[i_column >> n_bits]),
                        c_channel,
                    );
                    for (i_channel, channel) in channels.iter().take(c_channel).enumerate() {
                        let channel = std::slice::from_raw_parts(*channel, channel_len);
                        let p = (((channel[i_idx] * c_mul) >> r_shift_y) << n_len) as i32;
                        dst[i_channel] = p as i32;
                    }
                }
            }
        }
        BitDepth::ThirtyTwoF => {
            for i_row in (i_first_row..c_height).step_by(t_scale) {
                let i_y = offset_y[i_row >> n_bits];
                for i_column in (i_first_column..c_width).step_by(t_scale) {
                    let i_idx = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize;
                    let dst = std::slice::from_raw_parts_mut(
                        base.as_ptr()
                            .cast::<f32>()
                            .add(i_y + offset_x[i_column >> n_bits]),
                        c_channel,
                    );
                    for (i_channel, channel) in channels.iter().take(c_channel).enumerate() {
                        let channel = std::slice::from_raw_parts(*channel, channel_len);
                        let p = ((channel[i_idx] * c_mul) >> r_shift_y) as i32;
                        dst[i_channel] = pixel2float(p, n_exp_bias, n_len);
                    }
                }
            }
        }
        _ => {
            debug_assert!(false);
        }
    }
}

/// Original function: `decodeThumbnailAlpha` at `original/jxrlib/image/decode/strdec.c:1835`.
pub unsafe fn decode_thumbnail_alpha(
    pSC: *mut CWMImageStrCodec,
    n_bits: usize,
    c_mul: i32,
    r_shift_y: usize,
) -> Result<(), WmpError> {
    let Some(dparam) = (*pSC).m_Dparam else {
        return Err(WmpError::Fail);
    };
    let next_sc = ((*pSC).m_bSecondary == 0)
        .then_some((*pSC).m_pNextSC)
        .flatten();

    if let Some(p_next_sc) = next_sc {
        let p_next_sc = p_next_sc.as_ptr();
        let t_scale = 1_usize << n_bits;
        let c_height = std::cmp::min(
            ((*dparam.as_ptr()).cROIBottomY + 1) - ((*pSC).cRow - 1) * 16,
            16,
        );
        let c_width = (*dparam.as_ptr()).cROIRightX + 1;
        let i_first_row = (((if ((*pSC).cRow - 1) * 16 > (*dparam.as_ptr()).cROITopY {
            0
        } else {
            (*dparam.as_ptr()).cROITopY & 0xf
        }) + t_scale
            - 1)
            / t_scale)
            * t_scale;
        let i_first_column = ((*dparam.as_ptr()).cROILeftX + t_scale - 1) / t_scale * t_scale;
        let i_alpha_pos = (*pSC).WMII.cLeadingPadding
            + if (*pSC).WMII.cfColorFormat == ColorFormat::Cmyk {
                4
            } else {
                3
            };
        let bd = (*pSC).WMII.bdBitDepth;
        let Some(p_src) = (*p_next_sc).a0MBbuffer[0] else {
            return Err(WmpError::Fail);
        };
        let p_src = p_src.as_ptr();
        let n_len = (*p_next_sc).WMISCP.nLenMantissaOrShift;
        let Some(base) = (*pSC).WMIBI.pv else {
            return Err(WmpError::Fail);
        };
        let n_exp_bias = (*p_next_sc).WMISCP.nExpBias;
        let p_offset_x = (*dparam.as_ptr()).offset_x.as_ptr();
        let p_offset_y = (*dparam.as_ptr())
            .offset_y
            .as_ptr()
            .add(((*pSC).cRow - 1) * 16 / t_scale);

        if ColorFormat::Rgb != (*pSC).WMII.cfColorFormat
            && ColorFormat::Cmyk != (*pSC).WMII.cfColorFormat
        {
            return Err(WmpError::Fail);
        }

        if bd == BitDepth::Eight {
            let offset = (128 << r_shift_y) / c_mul;
            for i_row in (i_first_row..c_height).step_by(t_scale) {
                let i_y = *p_offset_y.add(i_row >> n_bits);
                for i_column in (i_first_column..c_width).step_by(t_scale) {
                    let a = ((*p_src
                        .add(((i_column >> 4) << 8) + idx_cc[i_row][i_column & 0xf] as usize)
                        + offset)
                        * c_mul)
                        >> r_shift_y;
                    let p_dst = base
                        .as_ptr()
                        .cast::<u8>()
                        .add(*p_offset_x.add(i_column >> n_bits) + i_y);
                    *p_dst.add(i_alpha_pos) = if a < 0 {
                        0
                    } else if a > 255 {
                        255
                    } else {
                        a as u8
                    };
                }
            }
        } else if bd == BitDepth::Sixteen {
            let offset = (32768 << r_shift_y) / c_mul;
            for i_row in (i_first_row..c_height).step_by(t_scale) {
                let i_y = *p_offset_y.add(i_row >> n_bits);
                for i_column in (i_first_column..c_width).step_by(t_scale) {
                    let a = (((*p_src
                        .add(((i_column >> 4) << 8) + idx_cc[i_row][i_column & 0xf] as usize)
                        + offset)
                        * c_mul)
                        >> r_shift_y)
                        << n_len;
                    let p_dst = base
                        .as_ptr()
                        .cast::<u16>()
                        .add(*p_offset_x.add(i_column >> n_bits) + i_y);
                    *p_dst.add(i_alpha_pos) = if a < 0 {
                        0
                    } else if a > 65535 {
                        65535
                    } else {
                        a as u16
                    };
                }
            }
        } else if bd == BitDepth::SixteenS {
            for i_row in (i_first_row..c_height).step_by(t_scale) {
                let i_y = *p_offset_y.add(i_row >> n_bits);
                for i_column in (i_first_column..c_width).step_by(t_scale) {
                    let a = ((*p_src
                        .add(((i_column >> 4) << 8) + idx_cc[i_row][i_column & 0xf] as usize)
                        * c_mul)
                        >> r_shift_y)
                        << n_len;
                    let p_dst = base
                        .as_ptr()
                        .cast::<i16>()
                        .add(*p_offset_x.add(i_column >> n_bits) + i_y);
                    *p_dst.add(i_alpha_pos) = if a < -32768 {
                        -32768
                    } else if a > 32767 {
                        32767
                    } else {
                        a as i16
                    };
                }
            }
        } else if bd == BitDepth::SixteenF {
            for i_row in (i_first_row..c_height).step_by(t_scale) {
                let i_y = *p_offset_y.add(i_row >> n_bits);
                for i_column in (i_first_column..c_width).step_by(t_scale) {
                    let a = (*p_src
                        .add(((i_column >> 4) << 8) + idx_cc[i_row][i_column & 0xf] as usize)
                        * c_mul)
                        >> r_shift_y;
                    let p_dst = base
                        .as_ptr()
                        .cast::<u16>()
                        .add(*p_offset_x.add(i_column >> n_bits) + i_y);
                    *p_dst.add(i_alpha_pos) = backward_half(a);
                }
            }
        } else if bd == BitDepth::ThirtyTwoS {
            for i_row in (i_first_row..c_height).step_by(t_scale) {
                let i_y = *p_offset_y.add(i_row >> n_bits);
                for i_column in (i_first_column..c_width).step_by(t_scale) {
                    let a = ((*p_src
                        .add(((i_column >> 4) << 8) + idx_cc[i_row][i_column & 0xf] as usize)
                        * c_mul)
                        >> r_shift_y)
                        << n_len;
                    let p_dst = base
                        .as_ptr()
                        .cast::<i32>()
                        .add(*p_offset_x.add(i_column >> n_bits) + i_y);
                    *p_dst.add(i_alpha_pos) = a;
                }
            }
        } else if bd == BitDepth::ThirtyTwoF {
            for i_row in (i_first_row..c_height).step_by(t_scale) {
                let i_y = *p_offset_y.add(i_row >> n_bits);
                for i_column in (i_first_column..c_width).step_by(t_scale) {
                    let a = (*p_src
                        .add(((i_column >> 4) << 8) + idx_cc[i_row][i_column & 0xf] as usize)
                        * c_mul)
                        >> r_shift_y;
                    let p_dst = base
                        .as_ptr()
                        .cast::<f32>()
                        .add(*p_offset_x.add(i_column >> n_bits) + i_y);
                    *p_dst.add(i_alpha_pos) = pixel2float(a, n_exp_bias, n_len);
                }
            }
        } else {
            return Err(WmpError::Fail);
        }
    }

    Ok(())
}

/// Original function: `decodeThumbnail` at `original/jxrlib/image/decode/strdec.c:1913`.
pub unsafe fn decode_thumbnail(pSC: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    let pSC = pSC as *mut CWMImageStrCodec;
    let Some(dparam) = (*pSC).m_Dparam else {
        return Err(WmpError::Fail);
    };
    let t_scale = (*dparam.as_ptr()).cThumbnailScale;
    let c_height = std::cmp::min(
        (if (*dparam.as_ptr()).bDecodeFullFrame != 0 {
            (*pSC).WMII.cHeight
        } else {
            (*dparam.as_ptr()).cROIBottomY + 1
        }) - ((*pSC).cRow - 1) * 16,
        16,
    );
    let c_width = if (*dparam.as_ptr()).bDecodeFullFrame != 0 {
        (*pSC).WMII.cWidth
    } else {
        (*dparam.as_ptr()).cROIRightX + 1
    };
    let i_first_row = (((if ((*pSC).cRow - 1) * 16 > (*dparam.as_ptr()).cROITopY {
        0
    } else {
        (*dparam.as_ptr()).cROITopY & 0xf
    }) + t_scale
        - 1)
        / t_scale)
        * t_scale;
    let i_first_column = ((*dparam.as_ptr()).cROILeftX + t_scale - 1) / t_scale * t_scale;
    let cf_int = (*pSC).m_param.cfColorFormat;
    let cf_ext = if (*pSC).m_param.cfColorFormat == ColorFormat::YOnly {
        ColorFormat::YOnly
    } else {
        (*pSC).WMII.cfColorFormat
    };
    let bd = (*pSC).WMII.bdBitDepth;
    let ol = (*pSC).WMISCP.olOverlap;
    let i_b = if (*pSC).WMII.bRGB != 0 { 2 } else { 0 };
    let i_r = 2 - i_b;
    let n_len = (*pSC).WMISCP.nLenMantissaOrShift;
    let n_exp_bias = (*pSC).WMISCP.nExpBias;
    let mut offset: i32;
    let (Some(p_src_y), Some(p_src_u), Some(p_src_v)) = (
        (*pSC).a0MBbuffer[0],
        (*pSC).a0MBbuffer[1],
        (*pSC).a0MBbuffer[2],
    ) else {
        return Err(WmpError::Fail);
    };
    let p_src_y = p_src_y.as_ptr();
    let mut p_src_u = p_src_u.as_ptr();
    let mut p_src_v = p_src_v.as_ptr();
    let p_offset_x = (*dparam.as_ptr()).offset_x.as_ptr();
    let p_offset_y = (*dparam.as_ptr())
        .offset_y
        .as_ptr()
        .add(((*pSC).cRow - 1) * 16 / t_scale);
    let c_mul: i32 = if t_scale >= 16 {
        if ol == Overlap::None {
            16
        } else if ol == Overlap::One {
            23
        } else {
            34
        }
    } else if t_scale >= 4 {
        if ol == Overlap::None {
            64
        } else {
            93
        }
    } else {
        258
    };
    let r_shift_y: usize = 8 + if (*pSC).m_param.bScaledArith != 0 {
        (SHIFTZERO + QPFRACBITS) as usize
    } else {
        0
    };
    let r_shift_uv = r_shift_y
        - if (*pSC).m_param.bScaledArith != 0 && t_scale >= 16 {
            if cf_int == ColorFormat::Yuv420 || cf_int == ColorFormat::Yuv422 {
                2
            } else {
                1
            }
        } else {
            0
        };
    let mut n_bits = 0_usize;
    while (1_usize << n_bits) < t_scale {
        n_bits += 1;
    }

    debug_assert!(t_scale == (1_usize << n_bits));

    if check_image_buffer(
        pSC,
        if (*pSC).WMII.oOrientation < Orientation::RotateCw {
            (*pSC).WMII.cROIWidth
        } else {
            (*pSC).WMII.cROIHeight
        },
        (c_height - i_first_row) / (*dparam.as_ptr()).cThumbnailScale,
    )
    .is_err()
    {
        return Err(WmpError::Fail);
    }

    if (((*pSC).cRow - 1) * 16) % t_scale != 0 {
        return Ok(());
    }
    if (*pSC).cRow * 16 <= (*dparam.as_ptr()).cROITopY
        || (*pSC).cRow * 16 > (*dparam.as_ptr()).cROIBottomY + 16
    {
        return Ok(());
    }
    let Some(base) = (*pSC).WMIBI.pv else {
        return Err(WmpError::Fail);
    };

    if (cf_int == ColorFormat::Yuv422 || cf_int == ColorFormat::Yuv420)
        && cf_ext != ColorFormat::YOnly
    {
        let Some(p_dst_u) = (*pSC).pResU else {
            return Err(WmpError::Fail);
        };
        let Some(p_dst_v) = (*pSC).pResV else {
            return Err(WmpError::Fail);
        };
        let p_dst_u = p_dst_u.as_ptr();
        let p_dst_v = p_dst_v.as_ptr();
        let mut i_row = 0;
        while i_row < 16 {
            let mut i_column = 0;
            while i_column < c_width {
                let i_idx1 = if cf_int == ColorFormat::Yuv422 {
                    ((i_column >> 4) << 7) + idx_cc[i_row][(i_column >> 1) & 7] as usize
                } else {
                    ((i_column >> 4) << 6) + idx_cc_420[i_row >> 1][(i_column >> 1) & 7] as usize
                };
                let i_idx2 = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize;
                *p_dst_u.add(i_idx2) = *p_src_u.add(i_idx1);
                *p_dst_v.add(i_idx2) = *p_src_v.add(i_idx1);
                i_column += t_scale;
            }
            i_row += t_scale;
        }

        if t_scale == 4 {
            if cf_int == ColorFormat::Yuv420 {
                let mut i_column = 0;
                while i_column < c_width {
                    let i_idx1 = ((i_column >> 4) << 8) + idx_cc[0][i_column & 15] as usize;
                    let i_idx2 = ((i_column >> 4) << 8) + idx_cc[4][i_column & 15] as usize;
                    let i_idx3 = ((i_column >> 4) << 8) + idx_cc[8][i_column & 15] as usize;
                    *p_dst_u.add(i_idx2) = (*p_dst_u.add(i_idx1) + *p_dst_u.add(i_idx3) + 1) >> 1;
                    *p_dst_v.add(i_idx2) = (*p_dst_v.add(i_idx1) + *p_dst_v.add(i_idx3) + 1) >> 1;
                    let i_idx1 = ((i_column >> 4) << 8) + idx_cc[12][i_column & 15] as usize;
                    *p_dst_u.add(i_idx1) = *p_dst_u.add(i_idx3);
                    *p_dst_v.add(i_idx1) = *p_dst_v.add(i_idx3);
                    i_column += 8;
                }
            }

            let mut i_row = 0;
            while i_row < 16 {
                let mut i_idx3 = 0_usize;
                let mut i_column = 0;
                while thumbnail_chroma_has_next_sample(i_column, c_width) {
                    let i_idx1 = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize;
                    let i_idx2 =
                        ((i_column >> 4) << 8) + idx_cc[i_row][(i_column + 4) & 15] as usize;
                    i_idx3 = ((i_column >> 4) << 8) + idx_cc[i_row][(i_column + 8) & 15] as usize;
                    *p_dst_u.add(i_idx2) = (*p_dst_u.add(i_idx1) + *p_dst_u.add(i_idx3) + 1) >> 1;
                    *p_dst_v.add(i_idx2) = (*p_dst_v.add(i_idx1) + *p_dst_v.add(i_idx3) + 1) >> 1;
                    i_column += 8;
                }
                let i_idx2 = ((i_column >> 4) << 8) + idx_cc[i_row][(i_column + 4) & 15] as usize;
                *p_dst_u.add(i_idx2) = *p_dst_u.add(i_idx3);
                *p_dst_v.add(i_idx2) = *p_dst_v.add(i_idx3);
                i_row += 4;
            }
        }
        p_src_u = p_dst_u;
        p_src_v = p_dst_v;
    }

    if bd == BitDepth::Eight {
        offset = (128 << r_shift_y) / c_mul;
        match cf_ext {
            ColorFormat::Rgb => {
                let mut i_row = i_first_row;
                while i_row < c_height {
                    let i_y = *p_offset_y.add(i_row >> n_bits);
                    let mut i_column = i_first_column;
                    while i_column < c_width {
                        let i_pos = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 0xf] as usize;
                        let mut g = ((*p_src_y.add(i_pos) + offset) * c_mul) >> r_shift_y;
                        let mut r = -(*p_src_u.add(i_pos) * c_mul) >> r_shift_uv;
                        let mut b = (*p_src_v.add(i_pos) * c_mul) >> r_shift_uv;
                        g -= r >> 1;
                        r -= ((b + 1) >> 1) - g;
                        b += r;
                        let p_dst = base
                            .as_ptr()
                            .cast::<u8>()
                            .add(*p_offset_x.add(i_column >> n_bits) + i_y);
                        *p_dst.add(i_b) = if b < 0 {
                            0
                        } else if b > 255 {
                            255
                        } else {
                            b as u8
                        };
                        *p_dst.add(1) = if g < 0 {
                            0
                        } else if g > 255 {
                            255
                        } else {
                            g as u8
                        };
                        *p_dst.add(i_r) = if r < 0 {
                            0
                        } else if r > 255 {
                            255
                        } else {
                            r as u8
                        };
                        i_column += t_scale;
                    }
                    i_row += t_scale;
                }
            }
            ColorFormat::YOnly | ColorFormat::Yuv444 | ColorFormat::NComponent => {
                output_n_channel_thumbnail(pSC, c_mul, r_shift_y, i_first_row, i_first_column);
            }
            ColorFormat::Rgbe => {
                let mut i_row = i_first_row;
                while i_row < c_height {
                    let i_y = *p_offset_y.add(i_row >> n_bits);
                    let mut i_column = i_first_column;
                    while i_column < c_width {
                        let i_pos = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 0xf] as usize;
                        let mut g = (*p_src_y.add(i_pos) * c_mul) >> r_shift_y;
                        let mut r = -((*p_src_u.add(i_pos) * c_mul) >> r_shift_uv);
                        let mut b = (*p_src_v.add(i_pos) * c_mul) >> r_shift_uv;
                        g -= r >> 1;
                        r -= ((b + 1) >> 1) - g;
                        b += r;
                        let p_dst = base
                            .as_ptr()
                            .cast::<u8>()
                            .add(*p_offset_x.add(i_column >> n_bits) + i_y);
                        inverse_convert_rgbe(r, g, b, std::slice::from_raw_parts_mut(p_dst, 4));
                        i_column += t_scale;
                    }
                    i_row += t_scale;
                }
            }
            ColorFormat::Cmyk => {
                let Some(p_src_k) = (*pSC).a0MBbuffer[3] else {
                    return Err(WmpError::Fail);
                };
                let p_src_k = p_src_k.as_ptr();
                let i_bias1 = (128 << r_shift_y) / c_mul;
                let i_bias2 = ((128 << r_shift_uv) / c_mul) >> 1;
                let mut i_row = i_first_row;
                while i_row < c_height {
                    let i_y = *p_offset_y.add(i_row >> n_bits);
                    let mut i_column = i_first_column;
                    while i_column < c_width {
                        let i_pos = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 0xf] as usize;
                        let mut m = ((-*p_src_y.add(i_pos) + i_bias1) * c_mul) >> r_shift_y;
                        let mut c = (*p_src_u.add(i_pos) * c_mul) >> r_shift_uv;
                        let y = -(*p_src_v.add(i_pos) * c_mul) >> r_shift_uv;
                        let mut k = ((*p_src_k.add(i_pos) + i_bias2) * c_mul) >> r_shift_uv;
                        k -= c >> 2;
                        c += k;
                        k += m;
                        c += m;
                        m += y;
                        let p_dst = base
                            .as_ptr()
                            .cast::<u8>()
                            .add(*p_offset_x.add(i_column >> n_bits) + i_y);
                        *p_dst.add(0) = if c < 0 {
                            0
                        } else if c > 255 {
                            255
                        } else {
                            c as u8
                        };
                        *p_dst.add(1) = if m < 0 {
                            0
                        } else if m > 255 {
                            255
                        } else {
                            m as u8
                        };
                        *p_dst.add(2) = if y < 0 {
                            0
                        } else if y > 255 {
                            255
                        } else {
                            y as u8
                        };
                        *p_dst.add(3) = if k < 0 {
                            0
                        } else if k > 255 {
                            255
                        } else {
                            k as u8
                        };
                        i_column += t_scale;
                    }
                    i_row += t_scale;
                }
            }
            _ => debug_assert!(false),
        }
    }
    if bd == BitDepth::Sixteen {
        offset = ((((1_i64 << 15) >> n_len) << r_shift_y) / c_mul as i64) as i32;
        match cf_ext {
            ColorFormat::Rgb => {
                let mut i_row = i_first_row;
                while i_row < c_height {
                    let i_y = *p_offset_y.add(i_row >> n_bits);
                    let mut i_column = i_first_column;
                    while i_column < c_width {
                        let i_pos = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 0xf] as usize;
                        let mut g = ((*p_src_y.add(i_pos) + offset) * c_mul) >> r_shift_y;
                        let mut r = -(*p_src_u.add(i_pos) * c_mul) >> r_shift_uv;
                        let mut b = (*p_src_v.add(i_pos) * c_mul) >> r_shift_uv;
                        g -= r >> 1;
                        r -= ((b + 1) >> 1) - g;
                        b += r;
                        let p_dst = base
                            .as_ptr()
                            .cast::<u16>()
                            .add(*p_offset_x.add(i_column >> n_bits) + i_y);
                        r <<= n_len;
                        g <<= n_len;
                        b <<= n_len;
                        *p_dst.add(0) = if r < 0 {
                            0
                        } else if r > 65535 {
                            65535
                        } else {
                            r as u16
                        };
                        *p_dst.add(1) = if g < 0 {
                            0
                        } else if g > 65535 {
                            65535
                        } else {
                            g as u16
                        };
                        *p_dst.add(2) = if b < 0 {
                            0
                        } else if b > 65535 {
                            65535
                        } else {
                            b as u16
                        };
                        i_column += t_scale;
                    }
                    i_row += t_scale;
                }
            }
            ColorFormat::YOnly | ColorFormat::Yuv444 | ColorFormat::NComponent => {
                output_n_channel_thumbnail(pSC, c_mul, r_shift_y, i_first_row, i_first_column);
            }
            ColorFormat::Cmyk => {
                let Some(p_src_k) = (*pSC).a0MBbuffer[3] else {
                    return Err(WmpError::Fail);
                };
                let p_src_k = p_src_k.as_ptr();
                let i_bias1 = (32768 << r_shift_y) / c_mul;
                let i_bias2 = ((32768 << r_shift_uv) / c_mul) >> 1;
                let mut i_row = i_first_row;
                while i_row < c_height {
                    let i_y = *p_offset_y.add(i_row >> n_bits);
                    let mut i_column = i_first_column;
                    while i_column < c_width {
                        let i_pos = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 0xf] as usize;
                        let mut m = ((-*p_src_y.add(i_pos) + i_bias1) * c_mul) >> r_shift_y;
                        let mut c = (*p_src_u.add(i_pos) * c_mul) >> r_shift_uv;
                        let mut y = -(*p_src_v.add(i_pos) * c_mul) >> r_shift_uv;
                        let mut k = ((*p_src_k.add(i_pos) + i_bias2) * c_mul) >> r_shift_uv;
                        k -= c >> 2;
                        c += k;
                        k += m;
                        c += m;
                        m += y;
                        let p_dst = base
                            .as_ptr()
                            .cast::<u16>()
                            .add(*p_offset_x.add(i_column >> n_bits) + i_y);
                        c <<= n_len;
                        m <<= n_len;
                        y <<= n_len;
                        k <<= n_len;
                        *p_dst.add(0) = if c < 0 {
                            0
                        } else if c > 65535 {
                            65535
                        } else {
                            c as u16
                        };
                        *p_dst.add(1) = if m < 0 {
                            0
                        } else if m > 65535 {
                            65535
                        } else {
                            m as u16
                        };
                        *p_dst.add(2) = if y < 0 {
                            0
                        } else if y > 65535 {
                            65535
                        } else {
                            y as u16
                        };
                        *p_dst.add(3) = if k < 0 {
                            0
                        } else if k > 65535 {
                            65535
                        } else {
                            k as u16
                        };
                        i_column += t_scale;
                    }
                    i_row += t_scale;
                }
            }
            _ => debug_assert!(false),
        }
    }
    if bd == BitDepth::SixteenS {
        match cf_ext {
            ColorFormat::Rgb => {
                let mut i_row = i_first_row;
                while i_row < c_height {
                    let i_y = *p_offset_y.add(i_row >> n_bits);
                    let mut i_column = i_first_column;
                    while i_column < c_width {
                        let i_pos = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 0xf] as usize;
                        let mut g = (*p_src_y.add(i_pos) * c_mul) >> r_shift_y;
                        let mut r = -(*p_src_u.add(i_pos) * c_mul) >> r_shift_uv;
                        let mut b = (*p_src_v.add(i_pos) * c_mul) >> r_shift_uv;
                        g -= r >> 1;
                        r -= ((b + 1) >> 1) - g;
                        b += r;
                        let p_dst = base
                            .as_ptr()
                            .cast::<i16>()
                            .add(*p_offset_x.add(i_column >> n_bits) + i_y);
                        r <<= n_len;
                        g <<= n_len;
                        b <<= n_len;
                        *p_dst.add(0) = if r < -32768 {
                            -32768
                        } else if r > 32767 {
                            32767
                        } else {
                            r as i16
                        };
                        *p_dst.add(1) = if g < -32768 {
                            -32768
                        } else if g > 32767 {
                            32767
                        } else {
                            g as i16
                        };
                        *p_dst.add(2) = if b < -32768 {
                            -32768
                        } else if b > 32767 {
                            32767
                        } else {
                            b as i16
                        };
                        i_column += t_scale;
                    }
                    i_row += t_scale;
                }
            }
            ColorFormat::YOnly | ColorFormat::Yuv444 | ColorFormat::NComponent => {
                output_n_channel_thumbnail(pSC, c_mul, r_shift_y, i_first_row, i_first_column);
            }
            ColorFormat::Cmyk => {
                let Some(p_src_k) = (*pSC).a0MBbuffer[3] else {
                    return Err(WmpError::Fail);
                };
                let p_src_k = p_src_k.as_ptr();
                let mut i_row = i_first_row;
                while i_row < c_height {
                    let i_y = *p_offset_y.add(i_row >> n_bits);
                    let mut i_column = i_first_column;
                    while i_column < c_width {
                        let i_pos = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 0xf] as usize;
                        let mut m = -(*p_src_y.add(i_pos) * c_mul) >> r_shift_y;
                        let mut c = (*p_src_u.add(i_pos) * c_mul) >> r_shift_uv;
                        let mut y = -(*p_src_v.add(i_pos) * c_mul) >> r_shift_uv;
                        let mut k = (*p_src_k.add(i_pos) * c_mul) >> r_shift_uv;
                        k -= c >> 2;
                        c += k;
                        k += m;
                        c += m;
                        m += y;
                        let p_dst = base
                            .as_ptr()
                            .cast::<i16>()
                            .add(*p_offset_x.add(i_column >> n_bits) + i_y);
                        c <<= n_len;
                        m <<= n_len;
                        y <<= n_len;
                        k <<= n_len;
                        *p_dst.add(0) = if c < -32768 {
                            -32768
                        } else if c > 32767 {
                            32767
                        } else {
                            c as i16
                        };
                        *p_dst.add(1) = if m < -32768 {
                            -32768
                        } else if m > 32767 {
                            32767
                        } else {
                            m as i16
                        };
                        *p_dst.add(2) = if y < -32768 {
                            -32768
                        } else if y > 32767 {
                            32767
                        } else {
                            y as i16
                        };
                        *p_dst.add(3) = if k < -32768 {
                            -32768
                        } else if k > 32767 {
                            32767
                        } else {
                            k as i16
                        };
                        i_column += t_scale;
                    }
                    i_row += t_scale;
                }
            }
            _ => debug_assert!(false),
        }
    } else if bd == BitDepth::SixteenF {
        match cf_ext {
            ColorFormat::Rgb => {
                let mut i_row = i_first_row;
                while i_row < c_height {
                    let i_y = *p_offset_y.add(i_row >> n_bits);
                    let mut i_column = i_first_column;
                    while i_column < c_width {
                        let i_pos = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 0xf] as usize;
                        let mut g = (*p_src_y.add(i_pos) * c_mul) >> r_shift_y;
                        let mut r = -(*p_src_u.add(i_pos) * c_mul) >> r_shift_uv;
                        let mut b = (*p_src_v.add(i_pos) * c_mul) >> r_shift_uv;
                        g -= r >> 1;
                        r -= ((b + 1) >> 1) - g;
                        b += r;
                        let p_dst = base
                            .as_ptr()
                            .cast::<u16>()
                            .add(*p_offset_x.add(i_column >> n_bits) + i_y);
                        *p_dst.add(0) = backward_half(r);
                        *p_dst.add(1) = backward_half(g);
                        *p_dst.add(2) = backward_half(b);
                        i_column += t_scale;
                    }
                    i_row += t_scale;
                }
            }
            ColorFormat::YOnly | ColorFormat::Yuv444 | ColorFormat::NComponent => {
                output_n_channel_thumbnail(pSC, c_mul, r_shift_y, i_first_row, i_first_column);
            }
            _ => debug_assert!(false),
        }
    } else if bd == BitDepth::ThirtyTwo {
        offset = ((((1_i64 << 31) >> n_len) << r_shift_y) / c_mul as i64) as i32;
        match cf_ext {
            ColorFormat::Rgb => {
                let mut i_row = i_first_row;
                while i_row < c_height {
                    let i_y = *p_offset_y.add(i_row >> n_bits);
                    let mut i_column = i_first_column;
                    while i_column < c_width {
                        let i_pos = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 0xf] as usize;
                        let mut g = ((*p_src_y.add(i_pos) + offset) * c_mul) >> r_shift_y;
                        let mut r = -(*p_src_u.add(i_pos) * c_mul) >> r_shift_uv;
                        let mut b = (*p_src_v.add(i_pos) * c_mul) >> r_shift_uv;
                        g -= r >> 1;
                        r -= ((b + 1) >> 1) - g;
                        b += r;
                        let p_dst = base
                            .as_ptr()
                            .cast::<u32>()
                            .add(*p_offset_x.add(i_column >> n_bits) + i_y);
                        *p_dst.add(0) = (r << n_len) as u32;
                        *p_dst.add(1) = (g << n_len) as u32;
                        *p_dst.add(2) = (b << n_len) as u32;
                        i_column += t_scale;
                    }
                    i_row += t_scale;
                }
            }
            ColorFormat::YOnly | ColorFormat::Yuv444 | ColorFormat::NComponent => {
                output_n_channel_thumbnail(pSC, c_mul, r_shift_y, i_first_row, i_first_column);
            }
            _ => debug_assert!(false),
        }
    } else if bd == BitDepth::ThirtyTwoS {
        match cf_ext {
            ColorFormat::Rgb => {
                let mut i_row = i_first_row;
                while i_row < c_height {
                    let i_y = *p_offset_y.add(i_row >> n_bits);
                    let mut i_column = i_first_column;
                    while i_column < c_width {
                        let i_pos = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 0xf] as usize;
                        let mut g = (*p_src_y.add(i_pos) * c_mul) >> r_shift_y;
                        let mut r = -(*p_src_u.add(i_pos) * c_mul) >> r_shift_uv;
                        let mut b = (*p_src_v.add(i_pos) * c_mul) >> r_shift_uv;
                        g -= r >> 1;
                        r -= ((b + 1) >> 1) - g;
                        b += r;
                        let p_dst = base
                            .as_ptr()
                            .cast::<i32>()
                            .add(*p_offset_x.add(i_column >> n_bits) + i_y);
                        *p_dst.add(0) = (r << n_len) as i32;
                        *p_dst.add(1) = (g << n_len) as i32;
                        *p_dst.add(2) = (b << n_len) as i32;
                        i_column += t_scale;
                    }
                    i_row += t_scale;
                }
            }
            ColorFormat::YOnly | ColorFormat::Yuv444 | ColorFormat::NComponent => {
                output_n_channel_thumbnail(pSC, c_mul, r_shift_y, i_first_row, i_first_column);
            }
            _ => debug_assert!(false),
        }
    } else if bd == BitDepth::ThirtyTwoF {
        match cf_ext {
            ColorFormat::Rgb => {
                let mut i_row = i_first_row;
                while i_row < c_height {
                    let i_y = *p_offset_y.add(i_row >> n_bits);
                    let mut i_column = i_first_column;
                    while i_column < c_width {
                        let i_pos = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 0xf] as usize;
                        let mut g = (*p_src_y.add(i_pos) * c_mul) >> r_shift_y;
                        let mut r = -(*p_src_u.add(i_pos) * c_mul) >> r_shift_uv;
                        let mut b = (*p_src_v.add(i_pos) * c_mul) >> r_shift_uv;
                        g -= r >> 1;
                        r -= ((b + 1) >> 1) - g;
                        b += r;
                        let p_dst = base
                            .as_ptr()
                            .cast::<f32>()
                            .add(*p_offset_x.add(i_column >> n_bits) + i_y);
                        *p_dst.add(0) = pixel2float(r, n_exp_bias, n_len);
                        *p_dst.add(1) = pixel2float(g, n_exp_bias, n_len);
                        *p_dst.add(2) = pixel2float(b, n_exp_bias, n_len);
                        i_column += t_scale;
                    }
                    i_row += t_scale;
                }
            }
            ColorFormat::YOnly | ColorFormat::Yuv444 | ColorFormat::NComponent => {
                output_n_channel_thumbnail(pSC, c_mul, r_shift_y, i_first_row, i_first_column);
            }
            _ => debug_assert!(false),
        }
    } else if bd == BitDepth::One {
        let i_pos = (*pSC).WMII.cLeadingPadding;
        debug_assert!(
            cf_ext == ColorFormat::YOnly && (*pSC).m_param.cfColorFormat == ColorFormat::YOnly
        );
        if (*pSC).WMII.oOrientation < Orientation::RotateCw {
            let mut i_row = i_first_row;
            while i_row < c_height {
                let i_y = *p_offset_y.add(i_row >> n_bits) + i_pos;
                let mut i_column = i_first_column;
                while i_column < c_width {
                    let b_bw = ((*pSC).WMISCP.bBlackWhite
                        ^ ((*p_src_y
                            .add(((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize)
                            > 0) as i32)) as u8;
                    let p_byte = base
                        .as_ptr()
                        .cast::<u8>()
                        .add((*p_offset_x.add(i_column >> n_bits) >> 3) + i_y);
                    let c_byte = *p_byte;
                    let c_shift = (7 - (*p_offset_x.add(i_column >> n_bits) & 7)) as u8;
                    *p_byte ^= ((b_bw + (c_byte >> c_shift)) & 0x1) << c_shift;
                    i_column += t_scale;
                }
                i_row += t_scale;
            }
        } else {
            let mut i_row = i_first_row;
            while i_row < c_height {
                let i_y = *p_offset_y.add(i_row >> n_bits) + i_pos;
                let mut i_column = i_first_column;
                while i_column < c_width {
                    let b_bw = ((*pSC).WMISCP.bBlackWhite
                        ^ ((*p_src_y
                            .add(((i_column >> 4) << 8) + idx_cc[i_row][i_column & 15] as usize)
                            > 0) as i32)) as u8;
                    let p_byte = base
                        .as_ptr()
                        .cast::<u8>()
                        .add(*p_offset_x.add(i_column >> n_bits) + (i_y >> 3));
                    let c_byte = *p_byte;
                    let c_shift = (7 - (i_y & 7)) as u8;
                    *p_byte ^= ((b_bw + (c_byte >> c_shift)) & 0x1) << c_shift;
                    i_column += t_scale;
                }
                i_row += t_scale;
            }
        }
    } else if bd == BitDepth::Five {
        offset = (16 << r_shift_y) / c_mul;
        let mut i_row = i_first_row;
        while i_row < c_height {
            let i_y = *p_offset_y.add(i_row >> n_bits);
            let mut i_column = i_first_column;
            while i_column < c_width {
                let i_pos = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 0xf] as usize;
                let mut g = ((*p_src_y.add(i_pos) + offset) * c_mul) >> r_shift_y;
                let mut r = -(*p_src_u.add(i_pos) * c_mul) >> r_shift_uv;
                let mut b = (*p_src_v.add(i_pos) * c_mul) >> r_shift_uv;
                g -= r >> 1;
                r -= ((b + 1) >> 1) - g;
                b += r;
                let p_dst = base
                    .as_ptr()
                    .cast::<u16>()
                    .add(*p_offset_x.add(i_column >> n_bits) + i_y);
                let cr = if r < 0 {
                    0
                } else if r > 31 {
                    31
                } else {
                    r as u16
                };
                let cg = if g < 0 {
                    0
                } else if g > 31 {
                    31
                } else {
                    g as u16
                };
                let cb = if b < 0 {
                    0
                } else if b > 31 {
                    31
                } else {
                    b as u16
                };
                *p_dst = cr + (cg << 5) + (cb << 10);
                i_column += t_scale;
            }
            i_row += t_scale;
        }
    } else if bd == BitDepth::FiveSixFive {
        offset = (32 << r_shift_y) / c_mul;
        let mut i_row = i_first_row;
        while i_row < c_height {
            let i_y = *p_offset_y.add(i_row >> n_bits);
            let mut i_column = i_first_column;
            while i_column < c_width {
                let i_pos = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 0xf] as usize;
                let mut g = ((*p_src_y.add(i_pos) + offset) * c_mul) >> r_shift_y;
                let mut r = -(*p_src_u.add(i_pos) * c_mul) >> r_shift_uv;
                let mut b = (*p_src_v.add(i_pos) * c_mul) >> r_shift_uv;
                g -= r >> 1;
                r -= ((b + 1) >> 1) - g;
                b += r;
                r /= 2;
                b /= 2;
                let p_dst = base
                    .as_ptr()
                    .cast::<u16>()
                    .add(*p_offset_x.add(i_column >> n_bits) + i_y);
                let cr = if r < 0 {
                    0
                } else if r > 31 {
                    31
                } else {
                    r as u16
                };
                let cg = if g < 0 {
                    0
                } else if g > 63 {
                    63
                } else {
                    g as u16
                };
                let cb = if b < 0 {
                    0
                } else if b > 31 {
                    31
                } else {
                    b as u16
                };
                *p_dst = cr + (cg << 5) + (cb << 11);
                i_column += t_scale;
            }
            i_row += t_scale;
        }
    } else if bd == BitDepth::Ten {
        offset = (512 << r_shift_y) / c_mul;
        let mut i_row = i_first_row;
        while i_row < c_height {
            let i_y = *p_offset_y.add(i_row >> n_bits);
            let mut i_column = i_first_column;
            while i_column < c_width {
                let i_pos = ((i_column >> 4) << 8) + idx_cc[i_row][i_column & 0xf] as usize;
                let mut g = ((*p_src_y.add(i_pos) + offset) * c_mul) >> r_shift_y;
                let mut r = -(*p_src_u.add(i_pos) * c_mul) >> r_shift_uv;
                let mut b = (*p_src_v.add(i_pos) * c_mul) >> r_shift_uv;
                g -= r >> 1;
                r -= ((b + 1) >> 1) - g;
                b += r;
                let p_dst = base
                    .as_ptr()
                    .cast::<u32>()
                    .add(*p_offset_x.add(i_column >> n_bits) + i_y);
                let cr = if r < 0 {
                    0
                } else if r > 1023 {
                    1023
                } else {
                    r as u32
                };
                let cg = if g < 0 {
                    0
                } else if g > 1023 {
                    1023
                } else {
                    g as u32
                };
                let cb = if b < 0 {
                    0
                } else if b > 1023 {
                    1023
                } else {
                    b as u32
                };
                *p_dst = cr + (cg << 10) + (cb << 20);
                i_column += t_scale;
            }
            i_row += t_scale;
        }
    }

    if matches!(
        AlphaMode::from_u8((*pSC).WMISCP.uAlphaMode),
        Some(AlphaMode::Interleaved | AlphaMode::Planar | AlphaMode::Only)
    ) && decode_thumbnail_alpha(pSC, n_bits, c_mul, r_shift_y).is_err()
    {
        return Err(WmpError::Fail);
    }

    Ok(())
}

/// Original function: `GetVLWordEsc` at `original/jxrlib/image/decode/strdec.c:2433`.
pub unsafe fn get_vl_word_esc(p_io: *mut tagBitIOInfo, mut i_escape: Option<&mut i32>) -> usize {
    let mut s: usize;

    if let Some(i_escape) = i_escape.as_deref_mut() {
        *i_escape = 0;
    }

    s = get_bit32(&mut *p_io, 8) as usize;
    if s == 0xfd || s == 0xfe || s == 0xff {
        if let Some(i_escape) = i_escape.as_deref_mut() {
            *i_escape = s as i32;
        }
        s = 0;
    } else if s < 0xfb {
        s = (s << 8) | get_bit32(&mut *p_io, 8) as usize;
    } else {
        s -= 0xfb;
        if s != 0 {
            s = (get_bit32(&mut *p_io, 16) as usize) << 16;
            s = (s | get_bit32(&mut *p_io, 16) as usize) << 16;
            s <<= 16;
        }
        s |= (get_bit32(&mut *p_io, 16) as usize) << 16;
        s |= get_bit32(&mut *p_io, 16) as usize;
    }
    s
}

/// Original function: `readIndexTable` at `original/jxrlib/image/decode/strdec.c:2463`.
pub unsafe fn read_index_table(p_sc: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    let p_sc = p_sc as *mut CWMImageStrCodec;
    let Some(header_io) = (*p_sc).pIOHeader else {
        return Err(WmpError::Fail);
    };
    let p_io = header_io.as_ptr();
    read_is(p_io)?;

    if (*p_sc).cNumBitIO > 0 {
        let Some(p_table) = (*p_sc).pIndexTableMemory.as_deref_mut() else {
            return Err(WmpError::Fail);
        };
        let i_entry = ((*p_sc).cNumBitIO as u32) * ((*p_sc).WMISCP.cNumOfSliceMinus1H + 1);

        if get_bit32(&mut *p_io, 16) != 1 {
            return Err(WmpError::Fail);
        }

        for i in 0..i_entry {
            read_is(p_io)?;
            p_table[i as usize] = get_vl_word_esc(p_io, None);
        }
    }

    (*p_sc).cHeaderSize = get_vl_word_esc(p_io, None);
    flush_to_byte(&mut *p_io);

    (*p_sc).cHeaderSize += get_pos_read(p_io) as usize;

    Ok(())
}

/// Original function: `StrIODecInit` at `original/jxrlib/image/decode/strdec.c:2491`.
pub unsafe fn str_io_dec_init(p_sc: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    if allocate_bit_io_info(p_sc).is_err() {
        return Err(WmpError::Fail);
    }
    let p_sc = p_sc as *mut CWMImageStrCodec;

    let Some(header_io) = (*p_sc).pIOHeader else {
        return Err(WmpError::Fail);
    };
    let Some(p_wstream) = (*p_sc).WMISCP.pWStream.map(NonNull::as_ptr) else {
        return Err(WmpError::Fail);
    };
    attach_is_read(header_io.as_ptr(), p_wstream)?;
    read_index_table(&mut *p_sc)?;

    if (*p_sc).WMISCP.bVerbose != 0 {
        println!(
            "\n{} horizontal tiles:",
            (*p_sc).WMISCP.cNumOfSliceMinus1H + 1
        );
        for i in 0..=(*p_sc).WMISCP.cNumOfSliceMinus1H {
            println!(
                "    offset of tile {} in MBs: {}",
                i,
                (*p_sc).WMISCP.uiTileY[i as usize],
            );
        }

        println!(
            "\n{} vertical tiles:",
            (*p_sc).WMISCP.cNumOfSliceMinus1V + 1
        );
        for i in 0..=(*p_sc).WMISCP.cNumOfSliceMinus1V {
            println!(
                "    offset of tile {} in MBs: {}",
                i,
                (*p_sc).WMISCP.uiTileX[i as usize],
            );
        }

        if (*p_sc).WMISCP.bfBitstreamFormat == BitstreamFormat::Spatial {
            println!("\nSpatial order bitstream");
        } else {
            println!("\nFrequency order bitstream");
        }

        if (*p_sc).m_param.bIndexTable == 0 {
            println!("\nstreaming mode, no index table.");
        } else if (*p_sc).WMISCP.bfBitstreamFormat == BitstreamFormat::Spatial {
            for j in 0..=(*p_sc).WMISCP.cNumOfSliceMinus1H {
                for i in 0..=(*p_sc).WMISCP.cNumOfSliceMinus1V {
                    let Some(index_table) = (*p_sc).pIndexTableMemory.as_deref() else {
                        return Err(WmpError::Fail);
                    };
                    let p = (j * ((*p_sc).WMISCP.cNumOfSliceMinus1V + 1) + i) as usize;
                    if i + j
                        != (*p_sc).WMISCP.cNumOfSliceMinus1H + (*p_sc).WMISCP.cNumOfSliceMinus1V
                    {
                        println!(
                            "bitstream size for tile ({}, {}): {}.",
                            j,
                            i,
                            index_table[p + 1] - index_table[p],
                        );
                    } else {
                        println!("bitstream size for tile ({}, {}): unknown.", j, i);
                    }
                }
            }
        } else {
            for j in 0..=(*p_sc).WMISCP.cNumOfSliceMinus1H {
                for i in 0..=(*p_sc).WMISCP.cNumOfSliceMinus1V {
                    let Some(index_table) = (*p_sc).pIndexTableMemory.as_deref() else {
                        return Err(WmpError::Fail);
                    };
                    let p = ((j * ((*p_sc).WMISCP.cNumOfSliceMinus1V + 1) + i) * 4) as usize;
                    if i + j
                        != (*p_sc).WMISCP.cNumOfSliceMinus1H + (*p_sc).WMISCP.cNumOfSliceMinus1V
                    {
                        println!(
                            "bitstream size of (DC, LP, AC, FL) for tile ({}, {}): {} {} {} {}.",
                            j,
                            i,
                            index_table[p + 1] - index_table[p],
                            index_table[p + 2] - index_table[p + 1],
                            index_table[p + 3] - index_table[p + 2],
                            index_table[p + 4] - index_table[p + 3],
                        );
                    } else {
                        println!(
                            "bitstream size of (DC, LP, AC, FL) for tile ({}, {}): {} {} {} unknown.",
                            j,
                            i,
                            index_table[p + 1] - index_table[p],
                            index_table[p + 2] - index_table[p + 1],
                            index_table[p + 3] - index_table[p + 2],
                        );
                    }
                }
            }
        }
    }

    Ok(())
}

/// Original function: `StrIODecTerm` at `original/jxrlib/image/decode/strdec.c:2557`.
pub unsafe fn str_io_dec_term(sc: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    let Some(header_io) = sc.pIOHeader else {
        return Err(WmpError::Fail);
    };
    let _ = detach_is_read(header_io.as_ptr());

    if sc.m_ppBitIOMemory.take().is_some() {
        sc.m_ppBitIO = None;
        sc.cBitIOMemory = 0;
    }
    if sc.pIndexTableMemory.take().is_some() {
        sc.cIndexTableMemory = 0;
    }

    Ok(())
}

/// Original function: `initLookupTables` at `original/jxrlib/image/decode/strdec.c:2567`.
pub unsafe fn init_lookup_tables(p_sc: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    let p_sc = p_sc as *mut CWMImageStrCodec;
    const CB_CHANNELS: [u8; 11] = [1, 1, 2, 2, 2, 4, 4, 4, u8::MAX, u8::MAX, u8::MAX];
    let p_ii = std::ptr::addr_of_mut!((*p_sc).WMII);
    let mut c_stride_x: usize;
    let mut c_stride_y: usize;
    let mut i_first = 0_usize;
    let mut w: usize;
    let mut h: usize;
    let mut b_reverse: i32;
    let Some(dparam) = (*p_sc).m_Dparam else {
        return Err(WmpError::Fail);
    };
    let p_dparam = dparam.as_ptr();

    if (*p_dparam).cThumbnailScale > 1 {
        w = (*p_ii).cThumbnailWidth;
        h = (*p_ii).cThumbnailHeight;
    } else {
        w = (*p_ii).cWidth;
        h = (*p_ii).cHeight;
    }

    w = w.wrapping_add(
        ((*p_dparam).cROILeftX + (*p_dparam).cThumbnailScale - 1) / (*p_dparam).cThumbnailScale,
    );
    h = h.wrapping_add(
        ((*p_dparam).cROITopY + (*p_dparam).cThumbnailScale - 1) / (*p_dparam).cThumbnailScale,
    );

    match (*p_ii).bdBitDepth {
        BitDepth::Sixteen
        | BitDepth::SixteenS
        | BitDepth::Five
        | BitDepth::FiveSixFive
        | BitDepth::SixteenF => {
            c_stride_y = (*p_sc).WMIBI.cbStride / 2;
        }
        BitDepth::ThirtyTwo | BitDepth::ThirtyTwoS | BitDepth::ThirtyTwoF | BitDepth::Ten => {
            c_stride_y = (*p_sc).WMIBI.cbStride / 4;
        }
        _ => {
            c_stride_y = (*p_sc).WMIBI.cbStride;
        }
    }

    match (*p_ii).cfColorFormat {
        ColorFormat::Yuv420 => {
            c_stride_x = 6;
            w >>= 1;
            h >>= 1;
        }
        ColorFormat::Yuv422 => {
            c_stride_x = 4;
            w >>= 1;
        }
        _ => {
            c_stride_x =
                ((*p_ii).cBitsPerUnit >> 3) / CB_CHANNELS[(*p_ii).bdBitDepth as usize] as usize;
        }
    }

    if (*p_ii).bdBitDepth == BitDepth::One
        || (*p_ii).bdBitDepth == BitDepth::Five
        || (*p_ii).bdBitDepth == BitDepth::Ten
        || (*p_ii).bdBitDepth == BitDepth::FiveSixFive
    {
        c_stride_x = 1;
    }

    if (*p_ii).oOrientation > Orientation::FlipVH {
        std::mem::swap(&mut c_stride_x, &mut c_stride_y);
    }

    if w.checked_mul(std::mem::size_of::<usize>()).is_none() {
        return Err(WmpError::Fail);
    }
    let mut offset_x = Vec::new();
    if offset_x.try_reserve_exact(w).is_err() {
        return Err(WmpError::Fail);
    }
    offset_x.resize(w, 0);

    b_reverse = ((*p_ii).oOrientation == Orientation::FlipH
        || (*p_ii).oOrientation == Orientation::FlipVH
        || (*p_ii).oOrientation == Orientation::RotateCwFlipV
        || (*p_ii).oOrientation == Orientation::RotateCwFlipVH) as i32;
    let chroma_divisor_x = chroma_roi_x_divisor((*p_ii).cfColorFormat);
    if (*p_dparam).bDecodeFullFrame == 0 {
        i_first = roi_scaled_start(
            (*p_dparam).cROILeftX,
            (*p_dparam).cThumbnailScale,
            chroma_divisor_x,
        )
        .ok_or(WmpError::Fail)?;
    }

    let reverse_limit_x = if (*p_dparam).bDecodeFullFrame != 0 {
        w
    } else {
        roi_scaled_span(
            (*p_dparam).cROILeftX,
            (*p_dparam).cROIRightX,
            (*p_dparam).cThumbnailScale,
            chroma_divisor_x,
        )
        .ok_or(WmpError::Fail)?
    };
    let x_count = bounded_roi_fill_count(
        w,
        i_first,
        reverse_limit_x,
        (*p_dparam).bDecodeFullFrame != 0,
    )
    .ok_or(WmpError::Fail)?;
    for i in 0..x_count {
        let x = if b_reverse != 0 {
            reverse_limit_x
                .checked_sub(1)
                .and_then(|limit| limit.checked_sub(i))
                .ok_or(WmpError::Fail)?
        } else {
            i
        };
        let offset_index = i.checked_add(i_first).ok_or(WmpError::Fail)?;
        let x_offset = x.checked_mul(c_stride_x).ok_or(WmpError::Fail)?;
        offset_x[offset_index] = (*p_ii)
            .cLeadingPadding
            .checked_add(x_offset)
            .ok_or(WmpError::Fail)?;
    }

    if h.checked_mul(std::mem::size_of::<usize>()).is_none() {
        return Err(WmpError::Fail);
    }
    let mut offset_y = Vec::new();
    if offset_y.try_reserve_exact(h).is_err() {
        return Err(WmpError::Fail);
    }
    offset_y.resize(h, 0);

    b_reverse = ((*p_ii).oOrientation == Orientation::FlipV
        || (*p_ii).oOrientation == Orientation::FlipVH
        || (*p_ii).oOrientation == Orientation::RotateCw
        || (*p_ii).oOrientation == Orientation::RotateCwFlipV) as i32;
    let chroma_divisor_y = chroma_roi_y_divisor((*p_ii).cfColorFormat);
    if (*p_dparam).bDecodeFullFrame == 0 {
        i_first = roi_scaled_start(
            (*p_dparam).cROITopY,
            (*p_dparam).cThumbnailScale,
            chroma_divisor_y,
        )
        .ok_or(WmpError::Fail)?;
    }

    let reverse_limit_y = if (*p_dparam).bDecodeFullFrame != 0 {
        h
    } else {
        roi_scaled_span(
            (*p_dparam).cROITopY,
            (*p_dparam).cROIBottomY,
            (*p_dparam).cThumbnailScale,
            chroma_divisor_y,
        )
        .ok_or(WmpError::Fail)?
    };
    let y_count = bounded_roi_fill_count(
        h,
        i_first,
        reverse_limit_y,
        (*p_dparam).bDecodeFullFrame != 0,
    )
    .ok_or(WmpError::Fail)?;
    for i in 0..y_count {
        let y = if b_reverse != 0 {
            reverse_limit_y
                .checked_sub(1)
                .and_then(|limit| limit.checked_sub(i))
                .ok_or(WmpError::Fail)?
        } else {
            i
        };
        let offset_index = i.checked_add(i_first).ok_or(WmpError::Fail)?;
        offset_y[offset_index] = y.checked_mul(c_stride_y).ok_or(WmpError::Fail)?;
    }

    (*p_dparam).offset_x = offset_x;
    (*p_dparam).offset_y = offset_y;

    Ok(())
}

fn div_ceil_checked(n: usize, d: usize) -> Option<usize> {
    if d == 0 {
        return None;
    }
    n.checked_add(d - 1).map(|n| n / d)
}

fn roi_scaled_start(start: usize, thumbnail_scale: usize, chroma_divisor: usize) -> Option<usize> {
    Some(div_ceil_checked(start, thumbnail_scale)? / chroma_divisor)
}

fn roi_scaled_span(
    left: usize,
    right: usize,
    thumbnail_scale: usize,
    chroma_divisor: usize,
) -> Option<usize> {
    let width = right.checked_sub(left)?.checked_add(1)?;
    div_ceil_checked(div_ceil_checked(width, thumbnail_scale)?, chroma_divisor)
}

fn chroma_roi_x_divisor(cf: ColorFormat) -> usize {
    if cf == ColorFormat::Yuv420 || cf == ColorFormat::Yuv422 {
        2
    } else {
        1
    }
}

fn chroma_roi_y_divisor(cf: ColorFormat) -> usize {
    if cf == ColorFormat::Yuv420 {
        2
    } else {
        1
    }
}

fn bounded_roi_fill_count(
    table_len: usize,
    i_first: usize,
    reverse_limit: usize,
    full_frame: bool,
) -> Option<usize> {
    let available = table_len.checked_sub(i_first)?;
    if full_frame {
        Some(available)
    } else {
        Some(available.min(reverse_limit))
    }
}

fn thumbnail_chroma_has_next_sample(i_column: usize, c_width: usize) -> bool {
    i_column
        .checked_add(8)
        .is_some_and(|next_column| next_column < c_width)
}

/// Original function: `setROI` at `original/jxrlib/image/decode/strdec.c:2662`.
pub unsafe fn set_roi(p_sc: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    let p_sc = p_sc as *mut CWMImageStrCodec;
    let p_wmii = std::ptr::addr_of_mut!((*p_sc).WMII);
    let p_scp = std::ptr::addr_of_mut!((*p_sc).WMISCP);
    // m_Dparam is Some for the entire decode after StrDecInit.
    let dparam = (*p_sc).m_Dparam.expect("m_Dparam set during StrDecInit");
    let p_dparam = dparam.as_ptr();

    (*p_wmii).cWidth = (*p_wmii)
        .cWidth
        .wrapping_sub((*p_sc).m_param.cExtraPixelsLeft + (*p_sc).m_param.cExtraPixelsRight);
    (*p_wmii).cHeight = (*p_wmii)
        .cHeight
        .wrapping_sub((*p_sc).m_param.cExtraPixelsTop + (*p_sc).m_param.cExtraPixelsBottom);

    (*p_dparam).bSkipFlexbits = ((*p_scp).sbSubband == Subband::NoFlexbits) as i32;
    (*p_dparam).bDecodeHP =
        ((*p_scp).sbSubband == Subband::All || (*p_scp).sbSubband == Subband::NoFlexbits) as i32;
    (*p_dparam).bDecodeLP = ((*p_scp).sbSubband != Subband::DcOnly) as i32;
    (*p_dparam).cThumbnailScale = 1;
    while (*p_dparam)
        .cThumbnailScale
        .wrapping_mul((*p_wmii).cThumbnailWidth)
        < (*p_wmii).cWidth
    {
        (*p_dparam).cThumbnailScale <<= 1;
    }
    if (*p_sc).WMISCP.bfBitstreamFormat == BitstreamFormat::Frequency {
        if (*p_dparam).cThumbnailScale >= 4 {
            (*p_dparam).bDecodeHP = 0;
        }
        if (*p_dparam).cThumbnailScale >= 16 {
            (*p_dparam).bDecodeLP = 0;
        }
    }

    (*p_wmii).cWidth = (*p_wmii)
        .cWidth
        .wrapping_add((*p_sc).m_param.cExtraPixelsLeft + (*p_sc).m_param.cExtraPixelsRight);
    (*p_wmii).cHeight = (*p_wmii)
        .cHeight
        .wrapping_add((*p_sc).m_param.cExtraPixelsTop + (*p_sc).m_param.cExtraPixelsBottom);

    let Some(roi_left_scaled) = (*p_wmii).cROILeftX.checked_mul((*p_dparam).cThumbnailScale) else {
        return Err(WmpError::Fail);
    };
    let Some(roi_left) = roi_left_scaled.checked_add((*p_sc).m_param.cExtraPixelsLeft) else {
        return Err(WmpError::Fail);
    };
    (*p_dparam).cROILeftX = roi_left;
    let Some(roi_width) = (*p_wmii).cROIWidth.checked_mul((*p_dparam).cThumbnailScale) else {
        return Err(WmpError::Fail);
    };
    let Some(roi_right_end) = (*p_dparam).cROILeftX.checked_add(roi_width) else {
        return Err(WmpError::Fail);
    };
    let Some(roi_right) = roi_right_end.checked_sub(1) else {
        return Err(WmpError::Fail);
    };
    (*p_dparam).cROIRightX = roi_right;
    let Some(roi_top_scaled) = (*p_wmii).cROITopY.checked_mul((*p_dparam).cThumbnailScale) else {
        return Err(WmpError::Fail);
    };
    let Some(roi_top) = roi_top_scaled.checked_add((*p_sc).m_param.cExtraPixelsTop) else {
        return Err(WmpError::Fail);
    };
    (*p_dparam).cROITopY = roi_top;
    let Some(roi_height) = (*p_wmii)
        .cROIHeight
        .checked_mul((*p_dparam).cThumbnailScale)
    else {
        return Err(WmpError::Fail);
    };
    let Some(roi_bottom_end) = (*p_dparam).cROITopY.checked_add(roi_height) else {
        return Err(WmpError::Fail);
    };
    let Some(roi_bottom) = roi_bottom_end.checked_sub(1) else {
        return Err(WmpError::Fail);
    };
    (*p_dparam).cROIBottomY = roi_bottom;

    if (*p_dparam).cROIRightX >= (*p_wmii).cWidth {
        (*p_dparam).cROIRightX = (*p_wmii).cWidth.wrapping_sub(1);
    }
    if (*p_dparam).cROIBottomY >= (*p_wmii).cHeight {
        (*p_dparam).cROIBottomY = (*p_wmii).cHeight.wrapping_sub(1);
    }

    let Some(roi_origin_sum) = (*p_dparam).cROILeftX.checked_add((*p_dparam).cROITopY) else {
        return Err(WmpError::Fail);
    };
    let Some(roi_right_mb) = (*p_dparam).cROIRightX.checked_add(15) else {
        return Err(WmpError::Fail);
    };
    let Some(width_mb) = (*p_wmii).cWidth.checked_add(14) else {
        return Err(WmpError::Fail);
    };
    let Some(roi_bottom_mb) = (*p_dparam).cROIBottomY.checked_add(15) else {
        return Err(WmpError::Fail);
    };
    let Some(height_mb) = (*p_wmii).cHeight.checked_add(14) else {
        return Err(WmpError::Fail);
    };

    (*p_dparam).bDecodeFullFrame = ((roi_origin_sum == 0)
        && (roi_right_mb / 16 >= width_mb / 16)
        && (roi_bottom_mb / 16 >= height_mb / 16)) as i32;

    (*p_dparam).bDecodeFullWidth =
        (((*p_dparam).cROILeftX == 0) && (roi_right_mb / 16 >= width_mb / 16)) as i32;

    (*p_wmii).cWidth = (*p_wmii)
        .cWidth
        .wrapping_sub((*p_sc).m_param.cExtraPixelsLeft + (*p_sc).m_param.cExtraPixelsRight);
    (*p_wmii).cHeight = (*p_wmii)
        .cHeight
        .wrapping_sub((*p_sc).m_param.cExtraPixelsTop + (*p_sc).m_param.cExtraPixelsBottom);

    if (*p_sc).WMISCP.bfBitstreamFormat == BitstreamFormat::Frequency
        && (*p_wmii).bSkipFlexbits == 1
    {
        (*p_dparam).bSkipFlexbits = 1;
    }

    (*p_sc).cTileRow = 0;
    (*p_sc).cTileColumn = (*p_sc).cTileRow;

    Ok(())
}

/// Original function: `StrDecInit` at `original/jxrlib/image/decode/strdec.c:2713`.
pub unsafe fn str_dec_init(sc: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    let cf_int = sc.m_param.cfColorFormat;
    let cf_ext = sc.WMII.cfColorFormat;
    let mut i: usize;

    sc.m_bUVResolutionChange = ((cf_ext != ColorFormat::YOnly)
        && ((cf_int == ColorFormat::Yuv420 && cf_ext != ColorFormat::Yuv420)
            || (cf_int == ColorFormat::Yuv422 && cf_ext != ColorFormat::Yuv422))
        && sc.WMISCP.bYUVData == 0) as i32;
    if sc.m_bUVResolutionChange != 0 {
        let c_res: usize = if cf_ext == ColorFormat::Yuv422 {
            128
        } else {
            256
        };
        let Some(c_res_memory) = c_res.checked_mul(sc.cmbWidth) else {
            return Err(WmpError::Fail);
        };
        let Some(c_res_bytes) = c_res_memory.checked_mul(std::mem::size_of::<i32>()) else {
            return Err(WmpError::Fail);
        };
        if c_res_bytes < sc.cmbWidth {
            return Err(WmpError::Fail);
        }

        let mut res_u = Vec::new();
        if res_u.try_reserve_exact(c_res_memory).is_err() {
            return Err(WmpError::Fail);
        }
        res_u.resize(c_res_memory, 0);

        let mut res_v = Vec::new();
        if res_v.try_reserve_exact(c_res_memory).is_err() {
            return Err(WmpError::Fail);
        }
        res_v.resize(c_res_memory, 0);

        let mut res_u = res_u.into_boxed_slice();
        let mut res_v = res_v.into_boxed_slice();
        sc.pResU = NonNull::new(res_u.as_mut_ptr());
        sc.pResV = NonNull::new(res_v.as_mut_ptr());
        sc.cResMemory = c_res_memory;
        sc.pResUMemory = Some(res_u);
        sc.pResVMemory = Some(res_v);
    }

    if allocate_pred_info(sc).is_err() {
        return Err(WmpError::Fail);
    }

    if allocate_tile_info(sc).is_err() {
        return Err(WmpError::Fail);
    }

    if (sc.m_param.uQPMode & 1) == 0 {
        let Some(tile) = sc
            .pTileMemory
            .as_deref_mut()
            .and_then(|tiles| tiles.get_mut(0))
        else {
            return Err(WmpError::Fail);
        };
        if allocate_quantizer(
            &mut tile.pQuantizerDC,
            sc.m_param.cNumChannels,
            1,
            &mut tile.pQuantizerDCMemory,
            &mut tile.cQuantizerDCMemory,
        )
        .is_err()
        {
            return Err(WmpError::Fail);
        }
        set_uniform_quantizer(sc, 0);
        let Some(tile) = sc
            .pTileMemory
            .as_deref_mut()
            .and_then(|tiles| tiles.get_mut(0))
        else {
            return Err(WmpError::Fail);
        };
        for i in 0..sc.m_param.cNumChannels {
            if let Some(quantizer) = tile.pQuantizerDC[i] {
                (*quantizer.as_ptr()).iIndex = sc.m_param.uiQPIndexDC[i];
            }
        }
        format_quantizer(
            tile.pQuantizerDC.as_mut_ptr(),
            (sc.m_param.uQPMode >> 3) as u8 & 3,
            sc.m_param.cNumChannels,
            0,
            1,
            sc.m_param.bScaledArith,
        );
    }

    if sc.WMISCP.sbSubband != Subband::DcOnly {
        if (sc.m_param.uQPMode & 2) == 0 {
            let Some(tile) = sc
                .pTileMemory
                .as_deref_mut()
                .and_then(|tiles| tiles.get_mut(0))
            else {
                return Err(WmpError::Fail);
            };
            if allocate_quantizer(
                &mut tile.pQuantizerLP,
                sc.m_param.cNumChannels,
                1,
                &mut tile.pQuantizerLPMemory,
                &mut tile.cQuantizerLPMemory,
            )
            .is_err()
            {
                return Err(WmpError::Fail);
            }
            set_uniform_quantizer(sc, 1);
            if (sc.m_param.uQPMode & 0x200) == 0 {
                use_dc_quantizer(sc, 0);
            } else {
                let Some(tile) = sc
                    .pTileMemory
                    .as_deref_mut()
                    .and_then(|tiles| tiles.get_mut(0))
                else {
                    return Err(WmpError::Fail);
                };
                for i in 0..sc.m_param.cNumChannels {
                    if let Some(quantizer) = tile.pQuantizerLP[i] {
                        (*quantizer.as_ptr()).iIndex = sc.m_param.uiQPIndexLP[i];
                    }
                }
                format_quantizer(
                    tile.pQuantizerLP.as_mut_ptr(),
                    (sc.m_param.uQPMode >> 5) as u8 & 3,
                    sc.m_param.cNumChannels,
                    0,
                    1,
                    sc.m_param.bScaledArith,
                );
            }
        }

        if sc.WMISCP.sbSubband != Subband::NoHighpass {
            if (sc.m_param.uQPMode & 4) == 0 {
                let Some(tile) = sc
                    .pTileMemory
                    .as_deref_mut()
                    .and_then(|tiles| tiles.get_mut(0))
                else {
                    return Err(WmpError::Fail);
                };
                if allocate_quantizer(
                    &mut tile.pQuantizerHP,
                    sc.m_param.cNumChannels,
                    1,
                    &mut tile.pQuantizerHPMemory,
                    &mut tile.cQuantizerHPMemory,
                )
                .is_err()
                {
                    return Err(WmpError::Fail);
                }
                set_uniform_quantizer(sc, 2);

                if (sc.m_param.uQPMode & 0x400) == 0 {
                    use_lp_quantizer(sc, 1, 0);
                } else {
                    let Some(tile) = sc
                        .pTileMemory
                        .as_deref_mut()
                        .and_then(|tiles| tiles.get_mut(0))
                    else {
                        return Err(WmpError::Fail);
                    };
                    for i in 0..sc.m_param.cNumChannels {
                        if let Some(quantizer) = tile.pQuantizerHP[i] {
                            (*quantizer.as_ptr()).iIndex = sc.m_param.uiQPIndexHP[i];
                        }
                    }
                    format_quantizer(
                        tile.pQuantizerHP.as_mut_ptr(),
                        (sc.m_param.uQPMode >> 7) as u8 & 3,
                        sc.m_param.cNumChannels,
                        0,
                        0,
                        sc.m_param.bScaledArith,
                    );
                }
            }
        }
    }

    if sc.WMISCP.cNumOfSliceMinus1V >= crate::image::sys::windowsmediaphoto::MAX_TILES
        || allocate_coding_context_dec(sc, sc.WMISCP.cNumOfSliceMinus1V as i32 + 1).is_err()
    {
        return Err(WmpError::Fail);
    }

    if sc.m_bSecondary != 0 {
        let Some(next_sc) = sc.m_pNextSC else {
            return Err(WmpError::Fail);
        };
        let next_sc = next_sc.as_ptr();
        sc.pIOHeader = (*next_sc).pIOHeader;
        sc.m_ppBitIO = (*next_sc).m_ppBitIO;
        sc.m_ppBitIOMemory = None;
        sc.cBitIOMemory = 0;
        sc.cNumBitIO = (*next_sc).cNumBitIO;
        sc.cSB = (*next_sc).cSB;
    }

    // C discards this return (faithful to StrDecInit)
    let _ = set_bit_io_pointers(sc);

    Ok(())
}

/// Original function: `StrDecTerm` at `original/jxrlib/image/decode/strdec.c:2794`.
pub unsafe fn str_dec_term(sc: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    let codecs = [Some(NonNull::from(&mut *sc)), sc.m_pNextSC];

    for (j, mut codec) in codecs.into_iter().flatten().enumerate() {
        let codec = codec.as_mut();
        if codec.m_bUVResolutionChange != 0 {
            if codec.cResMemory > 0 {
                codec.pResUMemory = None;
                codec.pResVMemory = None;
                codec.pResU = None;
                codec.pResV = None;
                codec.cResMemory = 0;
            }
        }

        codec.pPredInfoMemory = None;
        codec.cPredInfoMemory = 0;
        codec.PredInfo = [None; MAX_CHANNELS];
        codec.PredInfoPrevRow = [None; MAX_CHANNELS];

        codec.pTileMemory = None;
        codec.cTileMemory = 0;

        codec.pCodingContextMemory = None;
        codec.cNumCodingContext = 0;

        if codec.WMII.cPostProcStrength != 0 {
            term_post_proc(
                &mut codec.pPostProcInfo,
                &mut codec.pPostProcInfoMemory,
                codec.cmbWidth,
                codec.m_param.cNumChannels,
            );
        }

        if j == 0 {
            // C discards this return (faithful to StrDecTerm)
            let _ = str_io_dec_term(codec);
        }
    }

    Ok(())
}

/// Original function: `ReadImagePlaneHeader` at `original/jxrlib/image/decode/strdec.c:2831`.
pub unsafe fn read_image_plane_header(
    pII: *mut tagCWMImageInfo,
    pSCP: *mut tagCWMIStrCodecParam,
    pSC: *mut CWMImageStrCodecParameters,
    pSB: &mut tagSimpleBitIO,
) -> Result<(), WmpError> {
    (*pSC).cfColorFormat = match get_bit32_sb(pSB, 3) {
        0 => ColorFormat::YOnly,
        1 => ColorFormat::Yuv420,
        2 => ColorFormat::Yuv422,
        3 => ColorFormat::Yuv444,
        4 => ColorFormat::Cmyk,
        6 => ColorFormat::NComponent,
        _ => return Err(WmpError::Fail),
    };
    (*pSCP).cfColorFormat = (*pSC).cfColorFormat;
    (*pSC).bScaledArith = get_bit32_sb(pSB, 1) as i32;

    (*pSCP).sbSubband = match get_bit32_sb(pSB, 4) {
        0 => Subband::All,
        1 => Subband::NoFlexbits,
        2 => Subband::NoHighpass,
        3 => Subband::DcOnly,
        4 => Subband::Isolated,
        _ => return Err(WmpError::Fail),
    };

    match (*pSC).cfColorFormat {
        ColorFormat::YOnly => {
            (*pSC).cNumChannels = 1;
        }
        ColorFormat::Yuv420 => {
            (*pSC).cNumChannels = 3;
            get_bit32_sb(pSB, 1);
            (*pII).cChromaCenteringX = get_bit32_sb(pSB, 3) as u8;
            get_bit32_sb(pSB, 1);
            (*pII).cChromaCenteringY = get_bit32_sb(pSB, 3) as u8;
        }
        ColorFormat::Yuv422 => {
            (*pSC).cNumChannels = 3;
            get_bit32_sb(pSB, 1);
            (*pII).cChromaCenteringX = get_bit32_sb(pSB, 3) as u8;
            get_bit32_sb(pSB, 4);
        }
        ColorFormat::Yuv444 => {
            (*pSC).cNumChannels = 3;
            get_bit32_sb(pSB, 4);
            get_bit32_sb(pSB, 4);
        }
        ColorFormat::NComponent => {
            (*pSC).cNumChannels = get_bit32_sb(pSB, 4) as usize + 1;
            get_bit32_sb(pSB, 4);
        }
        ColorFormat::Cmyk => {
            (*pSC).cNumChannels = 4;
        }
        _ => {}
    }

    match (*pII).bdBitDepth {
        BitDepth::Sixteen | BitDepth::SixteenS | BitDepth::ThirtyTwo | BitDepth::ThirtyTwoS => {
            (*pSCP).nLenMantissaOrShift = get_bit32_sb(pSB, 8) as u8;
        }
        BitDepth::ThirtyTwoF => {
            (*pSCP).nLenMantissaOrShift = get_bit32_sb(pSB, 8) as u8;
            (*pSCP).nExpBias = get_bit32_sb(pSB, 8) as i8;
        }
        _ => {}
    }

    (*pSC).uQPMode = 0;
    if get_bit32_sb(pSB, 1) == 1 {
        (*pSC).uQPMode = (*pSC).uQPMode.wrapping_add(
            (read_quantizer_sb(&mut (*pSC).uiQPIndexDC, pSB, (*pSC).cNumChannels) as u32) << 3,
        );
    } else {
        (*pSC).uQPMode = (*pSC).uQPMode.wrapping_add(1);
    }
    if (*pSCP).sbSubband != Subband::DcOnly {
        if get_bit32_sb(pSB, 1) == 0 {
            (*pSC).uQPMode = (*pSC).uQPMode.wrapping_add(0x200);
            if get_bit32_sb(pSB, 1) == 1 {
                (*pSC).uQPMode = (*pSC).uQPMode.wrapping_add(
                    (read_quantizer_sb(&mut (*pSC).uiQPIndexLP, pSB, (*pSC).cNumChannels) as u32)
                        << 5,
                );
            } else {
                (*pSC).uQPMode = (*pSC).uQPMode.wrapping_add(2);
            }
        } else {
            (*pSC).uQPMode = (*pSC)
                .uQPMode
                .wrapping_add(((*pSC).uQPMode & 1) << 1)
                .wrapping_add(((*pSC).uQPMode & 0x18) << 2);
        }

        if (*pSCP).sbSubband != Subband::NoHighpass {
            if get_bit32_sb(pSB, 1) == 0 {
                (*pSC).uQPMode = (*pSC).uQPMode.wrapping_add(0x400);
                if get_bit32_sb(pSB, 1) == 1 {
                    (*pSC).uQPMode = (*pSC).uQPMode.wrapping_add(
                        (read_quantizer_sb(&mut (*pSC).uiQPIndexHP, pSB, (*pSC).cNumChannels)
                            as u32)
                            << 7,
                    );
                } else {
                    (*pSC).uQPMode = (*pSC).uQPMode.wrapping_add(4);
                }
            } else {
                (*pSC).uQPMode = (*pSC)
                    .uQPMode
                    .wrapping_add(((*pSC).uQPMode & 2) << 1)
                    .wrapping_add(((*pSC).uQPMode & 0x60) << 2);
            }
        }
    }

    if (*pSCP).sbSubband == Subband::DcOnly {
        (*pSC).uQPMode |= 0x200;
    } else if (*pSCP).sbSubband == Subband::NoHighpass {
        (*pSC).uQPMode |= 0x400;
    }

    if ((*pSC).uQPMode & 0x600) == 0 {
        return Err(WmpError::Fail);
    }

    flush_to_byte_sb(pSB);

    Ok(())
}

/// Original function: `ReadWMIHeader` at `original/jxrlib/image/decode/strdec.c:2941`.
pub unsafe fn read_wmi_header(
    pII: *mut tagCWMImageInfo,
    pSCP: *mut tagCWMIStrCodecParam,
    pSC: *mut CWMImageStrCodecParameters,
) -> Result<(), WmpError> {
    let mut i: u32;
    let b_tiling_present: i32;
    let b_inscribed: i32;
    let b_tile_stretch: i32;
    let b_abbreviated_header: i32;
    let Some(p_ws) = (*pSCP).pWStream.map(NonNull::as_ptr) else {
        return Err(WmpError::Fail);
    };

    let mut sb = tagSimpleBitIO {
        pWS: None,
        cbRead: 0,
        bAccumulator: 0,
        cBitLeft: 0,
        read_error: None,
    };
    let mut sz_ms = [0_u8; 8];
    let cb_stream: u32 = 0;

    let Some(read) = (*p_ws).Read else {
        return Err(WmpError::Fail);
    };
    let err = read(&mut *p_ws, &mut sz_ms);
    if err.is_err() {
        return Err(WmpError::Fail);
    }
    if &sz_ms[..7] != b"WMPHOTO" {
        return Err(WmpError::Fail);
    }

    if attach_sb(&mut sb, &mut *p_ws).is_err() {
        return Err(WmpError::Fail);
    }

    i = get_bit32_sb(&mut sb, 4);
    if i != CODEC_VERSION {
        return Err(WmpError::Fail);
    }
    (*pSC).cVersion = i as usize;
    i = get_bit32_sb(&mut sb, 4);
    if i != CODEC_SUBVERSION as u32
        && i != CODEC_SUBVERSION_NEWSCALING_SOFT_TILES
        && i != CODEC_SUBVERSION_NEWSCALING_HARD_TILES
    {
        return Err(WmpError::Fail);
    }
    (*pSC).cSubVersion = i as usize;

    (*pSC).bUseHardTileBoundaries = 0;
    if (*pSC).cSubVersion == CODEC_SUBVERSION_NEWSCALING_HARD_TILES as usize {
        (*pSC).bUseHardTileBoundaries = 1;
    }

    (*pSCP).bUseHardTileBoundaries = (*pSC).bUseHardTileBoundaries;

    b_tiling_present = get_bit32_sb(&mut sb, 1) as i32;
    (*pSCP).bfBitstreamFormat = match get_bit32_sb(&mut sb, 1) {
        0 => BitstreamFormat::Spatial,
        1 => BitstreamFormat::Frequency,
        _ => return Err(WmpError::Fail),
    };
    (*pII).oOrientation = match get_bit32_sb(&mut sb, 3) {
        0 => Orientation::None,
        1 => Orientation::FlipV,
        2 => Orientation::FlipH,
        3 => Orientation::FlipVH,
        4 => Orientation::RotateCw,
        5 => Orientation::RotateCwFlipV,
        6 => Orientation::RotateCwFlipH,
        7 => Orientation::RotateCwFlipVH,
        _ => return Err(WmpError::Fail),
    };
    (*pSC).bIndexTable = get_bit32_sb(&mut sb, 1) as i32;
    i = get_bit32_sb(&mut sb, 2);
    (*pSCP).olOverlap = match i {
        0 => Overlap::None,
        1 => Overlap::One,
        2 => Overlap::Two,
        _ => return Err(WmpError::Fail),
    };

    b_abbreviated_header = get_bit32_sb(&mut sb, 1) as i32;
    (*pSCP).bdBitDepth = match get_bit32_sb(&mut sb, 1) {
        0 => BitDepthLayout::Short,
        1 => BitDepthLayout::Long,
        _ => return Err(WmpError::Fail),
    };
    // JXRLIB reads this bit but then forces BD_LONG; keeping Short would underallocate the
    // later i32 coefficient buffers.
    (*pSCP).bdBitDepth = BitDepthLayout::Long;
    b_inscribed = get_bit32_sb(&mut sb, 1) as i32;
    (*pSC).bTrimFlexbitsFlag = get_bit32_sb(&mut sb, 1) as i32;
    b_tile_stretch = get_bit32_sb(&mut sb, 1) as i32;
    (*pSC).bRBSwapped = get_bit32_sb(&mut sb, 1) as i32;
    get_bit32_sb(&mut sb, 1);
    (*pSC).bAlphaChannel = get_bit32_sb(&mut sb, 1) as i32;

    (*pII).cfColorFormat = match get_bit32_sb(&mut sb, 4) {
        0 => ColorFormat::YOnly,
        1 => ColorFormat::Yuv420,
        2 => ColorFormat::Yuv422,
        3 => ColorFormat::Yuv444,
        4 => ColorFormat::Cmyk,
        6 => ColorFormat::NComponent,
        7 => ColorFormat::Rgb,
        8 => ColorFormat::Rgbe,
        9 => ColorFormat::Max,
        _ => return Err(WmpError::Fail),
    };
    (*pII).bdBitDepth = match get_bit32_sb(&mut sb, 4) {
        0 => BitDepth::One,
        1 => BitDepth::Eight,
        2 => BitDepth::Sixteen,
        3 => BitDepth::SixteenS,
        4 => BitDepth::SixteenF,
        5 => BitDepth::ThirtyTwo,
        6 => BitDepth::ThirtyTwoS,
        7 => BitDepth::ThirtyTwoF,
        8 => BitDepth::Five,
        9 => BitDepth::Ten,
        10 => BitDepth::FiveSixFive,
        15 => BitDepth::OneAlt,
        _ => return Err(WmpError::Fail),
    };

    if (*pII).bdBitDepth == BitDepth::OneAlt {
        (*pII).bdBitDepth = BitDepth::One;
        (*pSCP).bBlackWhite = 1;
    }

    (*pII).cWidth =
        get_bit32_sb(&mut sb, if b_abbreviated_header != 0 { 16 } else { 32 }) as usize + 1;
    (*pII).cHeight =
        get_bit32_sb(&mut sb, if b_abbreviated_header != 0 { 16 } else { 32 }) as usize + 1;
    (*pSC).cExtraPixelsTop = 0;
    (*pSC).cExtraPixelsLeft = 0;
    (*pSC).cExtraPixelsBottom = 0;
    (*pSC).cExtraPixelsRight = 0;
    if b_inscribed == 0 && ((*pII).cWidth & 0xf) != 0 {
        (*pSC).cExtraPixelsRight = 0x10 - ((*pII).cWidth & 0xf);
    }
    if b_inscribed == 0 && ((*pII).cHeight & 0xf) != 0 {
        (*pSC).cExtraPixelsBottom = 0x10 - ((*pII).cHeight & 0xf);
    }

    (*pSCP).cNumOfSliceMinus1V = 0;
    (*pSCP).cNumOfSliceMinus1H = 0;
    if b_tiling_present != 0 {
        (*pSCP).cNumOfSliceMinus1V = get_bit32_sb(&mut sb, LOG_MAX_TILES);
        (*pSCP).cNumOfSliceMinus1H = get_bit32_sb(&mut sb, LOG_MAX_TILES);
    }
    if (*pSC).bIndexTable == 0
        && ((*pSCP).bfBitstreamFormat == BitstreamFormat::Frequency
            || (*pSCP)
                .cNumOfSliceMinus1V
                .wrapping_add((*pSCP).cNumOfSliceMinus1H)
                > 0)
    {
        return Err(WmpError::Fail);
    }

    (*pSCP).uiTileX[0] = 0;
    (*pSCP).uiTileY[0] = 0;
    for i in 0..(*pSCP).cNumOfSliceMinus1V {
        (*pSCP).uiTileX[i as usize + 1] =
            get_bit32_sb(&mut sb, if b_abbreviated_header != 0 { 8 } else { 16 })
                .wrapping_add((*pSCP).uiTileX[i as usize]);
    }
    for i in 0..(*pSCP).cNumOfSliceMinus1H {
        (*pSCP).uiTileY[i as usize + 1] =
            get_bit32_sb(&mut sb, if b_abbreviated_header != 0 { 8 } else { 16 })
                .wrapping_add((*pSCP).uiTileY[i as usize]);
    }
    if b_tile_stretch != 0 {
        for _ in 0..((*pSCP).cNumOfSliceMinus1V + 1).wrapping_mul((*pSCP).cNumOfSliceMinus1H + 1) {
            get_bit32_sb(&mut sb, 8);
        }
    }

    if b_inscribed != 0 {
        (*pSC).cExtraPixelsTop = get_bit32_sb(&mut sb, 6) as usize;
        (*pSC).cExtraPixelsLeft = get_bit32_sb(&mut sb, 6) as usize;
        (*pSC).cExtraPixelsBottom = get_bit32_sb(&mut sb, 6) as usize;
        (*pSC).cExtraPixelsRight = get_bit32_sb(&mut sb, 6) as usize;
    }

    if (((*pII)
        .cWidth
        .wrapping_add((*pSC).cExtraPixelsLeft)
        .wrapping_add((*pSC).cExtraPixelsRight))
        & 0xf)
        + (((*pII)
            .cHeight
            .wrapping_add((*pSC).cExtraPixelsTop)
            .wrapping_add((*pSC).cExtraPixelsBottom))
            & 0xf)
        != 0
    {
        if ((*pII).cWidth & 0xf)
            .wrapping_add((*pII).cHeight & 0xf)
            .wrapping_add((*pSC).cExtraPixelsLeft)
            .wrapping_add((*pSC).cExtraPixelsTop)
            != 0
        {
            return Err(WmpError::Fail);
        }
        if (*pII).cWidth <= (*pSC).cExtraPixelsRight || (*pII).cHeight <= (*pSC).cExtraPixelsBottom
        {
            return Err(WmpError::Fail);
        }
        (*pII).cWidth = (*pII).cWidth.wrapping_sub((*pSC).cExtraPixelsRight);
        (*pII).cHeight = (*pII).cHeight.wrapping_sub((*pSC).cExtraPixelsBottom);
    }

    flush_to_byte_sb(&mut sb);

    if read_image_plane_header(pII, pSCP, pSC, &mut sb).is_err() {
        return Err(WmpError::Fail);
    }

    if detach_sb(&mut sb).is_err() {
        return Err(WmpError::Fail);
    }
    (*pSCP).cbStream = (cb_stream.wrapping_sub(get_byte_read_sb(&mut sb))) as usize;

    let alpha_mode = if (*pSC).bAlphaChannel != 0 {
        let Some(alpha_mode) = AlphaMode::from_u8((*pSCP).uAlphaMode) else {
            return Err(WmpError::Fail);
        };
        alpha_mode
    } else {
        AlphaMode::None
    };
    (*pSCP).uAlphaMode = alpha_mode as u8;
    (*pSCP).cChannel = (*pSC).cNumChannels;

    if ((*pII).bdBitDepth == BitDepth::Five
        || (*pII).bdBitDepth == BitDepth::Ten
        || (*pII).bdBitDepth == BitDepth::FiveSixFive)
        && ((*pSCP).cfColorFormat != ColorFormat::Yuv444
            && (*pSCP).cfColorFormat != ColorFormat::Yuv422
            && (*pSCP).cfColorFormat != ColorFormat::Yuv420
            && (*pSCP).cfColorFormat != ColorFormat::YOnly)
    {
        return Err(WmpError::Fail);
    }

    Ok(())
}

/// Original function: `ImageStrDecGetInfo` at `original/jxrlib/image/decode/strdec.c:3086`.
pub unsafe fn image_str_dec_get_info(
    pII: *mut tagCWMImageInfo,
    pSCP: *mut tagCWMIStrCodecParam,
) -> Result<(), WmpError> {
    let mut cMarker: usize = 0;
    let mut aDummy = CWMImageStrCodecParameters::default();

    let Some(p_wstream) = (*pSCP).pWStream.map(NonNull::as_ptr) else {
        return Err(WmpError::Fail);
    };
    let Some(get_pos) = (*p_wstream).GetPos else {
        return Err(WmpError::Fail);
    };
    let mut err = get_pos(&mut *p_wstream, &mut cMarker);
    if err.is_err() {
        return Err(WmpError::Fail);
    }
    if read_wmi_header(pII, pSCP, std::ptr::addr_of_mut!(aDummy)).is_err() {
        return Err(WmpError::Fail);
    }
    let Some(set_pos) = (*p_wstream).SetPos else {
        return Err(WmpError::Fail);
    };
    err = set_pos(&mut *p_wstream, cMarker);
    if err.is_err() {
        return Err(WmpError::Fail);
    }
    Ok(())
}

/// Original function: `WMPhotoValidate` at `original/jxrlib/image/decode/strdec.c:3104`.
pub unsafe fn wm_photo_validate(
    pII: *mut tagCWMImageInfo,
    pSCP: *mut tagCWMIStrCodecParam,
) -> Result<(), WmpError> {
    let mut cII = tagCWMImageInfo::default();
    let cSCP = *pSCP;
    let mut cScale: usize = 1;

    if image_str_dec_get_info(std::ptr::addr_of_mut!(cII), pSCP).is_err() {
        return Err(WmpError::Fail);
    }

    (*pII).bdBitDepth = cII.bdBitDepth;
    (*pII).cWidth = cII.cWidth;
    (*pII).cHeight = cII.cHeight;

    if (*pII).cWidth == 0 || (*pII).cHeight == 0 {
        return Err(WmpError::Fail);
    }

    (*pSCP).bVerbose = cSCP.bVerbose;
    (*pSCP).cbStream = cSCP.cbStream;
    (*pSCP).pWStream = cSCP.pWStream;
    let Some(alpha_mode) = AlphaMode::from_u8((*pSCP).uAlphaMode) else {
        return Err(WmpError::Fail);
    };
    if matches!(alpha_mode, AlphaMode::Planar | AlphaMode::Only) {
        (*pSCP).uAlphaMode = cSCP.uAlphaMode;
    }

    if (*pSCP).cfColorFormat == ColorFormat::NComponent {
        (*pII).cfColorFormat = ColorFormat::NComponent;
    }
    if (*pSCP).cfColorFormat == ColorFormat::Cmyk
        && (*pII).cfColorFormat != ColorFormat::YOnly
        && (*pII).cfColorFormat != ColorFormat::Rgb
    {
        (*pII).cfColorFormat = ColorFormat::Cmyk;
    }
    if (*pSCP).cfColorFormat == ColorFormat::Yuv422 && (*pII).cfColorFormat == ColorFormat::Yuv420 {
        (*pII).cfColorFormat = ColorFormat::Yuv422;
    }
    if (*pSCP).cfColorFormat == ColorFormat::Yuv444
        && ((*pII).cfColorFormat == ColorFormat::Yuv422
            || (*pII).cfColorFormat == ColorFormat::Yuv420)
    {
        (*pII).cfColorFormat = ColorFormat::Yuv444;
    }
    if cII.cfColorFormat == ColorFormat::Rgb
        && (*pII).cfColorFormat != ColorFormat::YOnly
        && (*pII).cfColorFormat != ColorFormat::NComponent
    {
        (*pII).cfColorFormat = cII.cfColorFormat;
    }
    if cII.cfColorFormat == ColorFormat::Rgbe {
        (*pII).cfColorFormat = ColorFormat::Rgbe;
    }

    if (*pII).cThumbnailWidth == 0 || (*pII).cThumbnailWidth > (*pII).cWidth {
        (*pII).cThumbnailWidth = (*pII).cWidth;
    }
    if (*pII).cThumbnailHeight == 0 || (*pII).cThumbnailHeight > (*pII).cHeight {
        (*pII).cThumbnailHeight = (*pII).cHeight;
    }
    if ((*pII).cWidth + (*pII).cThumbnailWidth - 1) / (*pII).cThumbnailWidth
        != ((*pII).cHeight + (*pII).cThumbnailHeight - 1) / (*pII).cThumbnailHeight
    {
        while ((*pII).cWidth + cScale - 1) / cScale > (*pII).cThumbnailWidth
            && ((*pII).cHeight + cScale - 1) / cScale > (*pII).cThumbnailHeight
            && (cScale << 1) != 0
        {
            cScale <<= 1;
        }
    } else {
        cScale = ((*pII).cWidth + (*pII).cThumbnailWidth - 1) / (*pII).cThumbnailWidth;
        if cScale == 0 {
            cScale = 1;
        }
    }
    (*pII).cThumbnailWidth = ((*pII).cWidth + cScale - 1) / cScale;
    (*pII).cThumbnailHeight = ((*pII).cHeight + cScale - 1) / cScale;

    if (*pII).cROIHeight == 0 || (*pII).cROIWidth == 0 {
        (*pII).cROILeftX = 0;
        (*pII).cROITopY = 0;
        (*pII).cROIWidth = (*pII).cThumbnailWidth;
        (*pII).cROIHeight = (*pII).cThumbnailHeight;
    }
    if (*pII).cROILeftX >= (*pII).cThumbnailWidth {
        (*pII).cROILeftX = 0;
    }
    if (*pII).cROITopY >= (*pII).cThumbnailHeight {
        (*pII).cROITopY = 0;
    }
    if (*pII)
        .cROILeftX
        .checked_add((*pII).cROIWidth)
        .ok_or(WmpError::Fail)?
        > (*pII).cThumbnailWidth
    {
        (*pII).cROIWidth = (*pII).cThumbnailWidth - (*pII).cROILeftX;
    }
    if (*pII)
        .cROITopY
        .checked_add((*pII).cROIHeight)
        .ok_or(WmpError::Fail)?
        > (*pII).cThumbnailHeight
    {
        (*pII).cROIHeight = (*pII).cThumbnailHeight - (*pII).cROITopY;
    }

    Ok(())
}

/// Original function: `InitializeStrDec` at `original/jxrlib/image/decode/strdec.c:3184`.
pub unsafe fn initialize_str_dec(
    pSC: *mut CWMImageStrCodec,
    pParams: *const CWMImageStrCodecParameters,
    pSCIn: *const CWMImageStrCodec,
) {
    (*pSC).m_param = (*pParams).clone();

    (*pSC).cbStruct = std::mem::size_of::<CWMImageStrCodec>();
    (*pSC).WMII = (*pSCIn).WMII;
    (*pSC).WMISCP = (*pSCIn).WMISCP;

    (*pSC).cRow = 0;
    (*pSC).cColumn = 0;

    (*pSC).cmbWidth = ((*pSC).WMII.cWidth + 15) / 16;
    (*pSC).cmbHeight = ((*pSC).WMII.cHeight + 15) / 16;

    (*pSC).Load = Some(output_mb_row);
    (*pSC).Transform = if (*pParams).cSubVersion == CODEC_SUBVERSION {
        Some(inv_transform_macroblock)
    } else {
        Some(inv_transform_macroblock_altered_operators_hard)
    };
    (*pSC).TransformCenter = (*pSC).Transform;

    (*pSC).ProcessTopLeft = Some(process_macroblock_dec);
    (*pSC).ProcessTop = Some(process_macroblock_dec);
    (*pSC).ProcessTopRight = Some(process_macroblock_dec);
    (*pSC).ProcessLeft = Some(process_macroblock_dec);
    (*pSC).ProcessCenter = Some(process_macroblock_dec);
    (*pSC).ProcessRight = Some(process_macroblock_dec);
    (*pSC).ProcessBottomLeft = Some(process_macroblock_dec);
    (*pSC).ProcessBottom = Some(process_macroblock_dec);
    (*pSC).ProcessBottomRight = Some(process_macroblock_dec);

    (*pSC).m_pNextSC = None;
    (*pSC).m_bSecondary = 0;
}

/// Original function: `ImageStrDecInit` at `original/jxrlib/image/decode/strdec.c:3222`.
pub unsafe fn image_str_dec_init(
    pII: *mut tagCWMImageInfo,
    pSCP: *mut tagCWMIStrCodecParam,
    pctxSC: &mut Option<Box<CWMImageStrCodec>>,
) -> Result<(), WmpError> {
    static CB_CHANNELS: [usize; BitDepthLayout::Max as usize] = [2, 4];

    let cb_channel: usize;
    let cblk_chroma: usize;
    let mut cb_mac_block_stride: usize;
    let cb_mac_block_chroma: usize;
    let c_mac_block: usize;

    let mut sc = CWMImageStrCodec::default();
    let mut sc_storage = Box::<CWMImageStrCodec>::default();
    let p_sc: *mut CWMImageStrCodec = sc_storage.as_mut();
    let mut p_next_sc: *mut CWMImageStrCodec = std::ptr::null_mut();
    let mut pb: *mut u8;
    let mut cb: usize;
    let mut next_sc_storage: Option<Box<CWMImageStrCodec>> = None;
    let mut i: usize;
    let mut b_lossy_transcoding = 0;
    let b_use_hard_tile_boundaries: i32;
    let b_less_than_64_bit = std::mem::size_of::<*mut CWMImageStrCodec>() < 8;

    *pctxSC = None;

    if wm_photo_validate(pII, pSCP).is_err() {
        return Err(WmpError::Fail);
    }

    if (*pSCP).sbSubband == Subband::Isolated {
        return Err(WmpError::Fail);
    }

    sc.WMISCP.pWStream = (*pSCP).pWStream;
    if read_wmi_header(
        std::ptr::addr_of_mut!(sc.WMII),
        std::ptr::addr_of_mut!(sc.WMISCP),
        std::ptr::addr_of_mut!(sc.m_param),
    )
    .is_err()
    {
        return Err(WmpError::Fail);
    }

    b_use_hard_tile_boundaries = sc.WMISCP.bUseHardTileBoundaries;
    if sc.WMII.cfColorFormat == ColorFormat::Cmyk && (*pII).cfColorFormat == ColorFormat::Rgb {
        b_lossy_transcoding = 1;
    }
    // C sets bLossyTranscoding but never reads it (dead in ImageStrDecInit); kept faithful
    let _ = b_lossy_transcoding;
    if (*pSCP).cfColorFormat != ColorFormat::Cmyk && (*pII).cfColorFormat == ColorFormat::Cmyk {
        return Err(WmpError::Fail);
    }

    sc.WMISCP = *pSCP;
    sc.WMII = *pII;

    sc.WMII.cWidth = sc
        .WMII
        .cWidth
        .wrapping_add(sc.m_param.cExtraPixelsLeft)
        .wrapping_add(sc.m_param.cExtraPixelsRight);
    sc.WMII.cHeight = sc
        .WMII
        .cHeight
        .wrapping_add(sc.m_param.cExtraPixelsTop)
        .wrapping_add(sc.m_param.cExtraPixelsBottom);
    (*pII).cROILeftX = (*pII).cROILeftX.wrapping_add(sc.m_param.cExtraPixelsLeft);
    (*pII).cROITopY = (*pII).cROITopY.wrapping_add(sc.m_param.cExtraPixelsTop);

    cb_channel = CB_CHANNELS[sc.WMISCP.bdBitDepth as usize];
    cblk_chroma = CBLK_CHROMAS[sc.m_param.cfColorFormat as usize] as usize;

    cb_mac_block_stride = cb_channel * 16 * 16;
    cb_mac_block_chroma = cb_channel * 16 * cblk_chroma;
    c_mac_block = (sc.WMII.cWidth + 15) / 16;

    cb = std::mem::size_of::<CWMImageStrCodec>()
        + (128 - 1)
        + std::mem::size_of::<CWMDecoderParameters>();
    cb += (PACKETLENGTH * 4 - 1) + (PACKETLENGTH * 2) + std::mem::size_of::<tagBitIOInfo>();

    i = (cb_mac_block_stride + cb_mac_block_chroma * (sc.m_param.cNumChannels - 1)) * 2;
    if b_less_than_64_bit && ((i * (c_mac_block >> 16)) & 0xffffc000) != 0 {
        return Err(WmpError::Fail);
    }
    cb += i * c_mac_block;

    let codec_words = cb.div_ceil(std::mem::size_of::<usize>());
    let mut codec_vec = Vec::new();
    if codec_vec.try_reserve_exact(codec_words).is_err() {
        return Err(WmpError::Fail);
    }
    codec_vec.resize(codec_words, 0usize);
    let mut codec_memory = codec_vec.into_boxed_slice();
    pb = codec_memory.as_mut_ptr().cast::<u8>();
    (*p_sc).cCodecMemory = codec_words;
    (*p_sc).pCodecMemory = Some(codec_memory);

    (*p_sc).m_fMeasurePerf = (*pSCP).fMeasurePerf;
    if (*p_sc).m_fMeasurePerf != 0 {
        (*p_sc).m_ptEndToEndPerf = perf_timer_new();
        (*p_sc).m_ptEncDecPerf = perf_timer_new();
        perf_timer_start((*p_sc).m_ptEndToEndPerf.as_mut());
        perf_timer_start((*p_sc).m_ptEncDecPerf.as_mut());
        perf_timer_copy_start_time(
            (*p_sc).m_ptEncDecPerf.as_mut(),
            (*p_sc).m_ptEndToEndPerf.as_ref(),
        );
    }

    (*p_sc).pDparamMemory = Some(Box::<CWMDecoderParameters>::default());
    let Some(dparam) = (*p_sc).pDparamMemory.as_mut() else {
        return Err(WmpError::Fail);
    };
    (*p_sc).m_Dparam = Some(NonNull::from(dparam.as_mut()));
    (*p_sc).cbChannel = cb_channel;
    (*p_sc).bUseHardTileBoundaries = b_use_hard_tile_boundaries;

    initialize_str_dec(p_sc, std::ptr::addr_of!(sc.m_param), std::ptr::addr_of!(sc));

    pb = ((pb as usize + 128 - 1) & !(128 - 1)) as *mut u8;
    i = 0;
    while i < (*p_sc).m_param.cNumChannels {
        (*p_sc).a0MBbuffer[i] = NonNull::new(pb.cast::<i32>());
        pb = pb.add(cb_mac_block_stride * (*p_sc).cmbWidth);
        (*p_sc).a1MBbuffer[i] = NonNull::new(pb.cast::<i32>());
        pb = pb.add(cb_mac_block_stride * (*p_sc).cmbWidth);
        cb_mac_block_stride = cb_mac_block_chroma;
        i += 1;
    }

    pb = (((pb as usize + PACKETLENGTH * 4 - 1) & !(PACKETLENGTH * 4 - 1)) as *mut u8)
        .add(PACKETLENGTH * 2);
    (*p_sc).pIOHeader = NonNull::new(pb.cast::<tagBitIOInfo>());

    if (*p_sc).m_param.bAlphaChannel != 0 {
        let mut sb = tagSimpleBitIO {
            pWS: None,
            cbRead: 0,
            bAccumulator: 0,
            cBitLeft: 0,
            read_error: None,
        };
        cb_mac_block_stride = cb_channel * 16 * 16;

        cb = std::mem::size_of::<CWMImageStrCodec>()
            + (128 - 1)
            + cb_mac_block_stride * c_mac_block * 2;
        let next_codec_words = cb.div_ceil(std::mem::size_of::<usize>());
        next_sc_storage = Some(Box::<CWMImageStrCodec>::default());
        let Some(next_sc) = next_sc_storage.as_mut() else {
            return Err(WmpError::Fail);
        };
        p_next_sc = next_sc.as_mut();
        let mut next_codec_vec = Vec::new();
        if next_codec_vec.try_reserve_exact(next_codec_words).is_err() {
            return Err(WmpError::Fail);
        }
        next_codec_vec.resize(next_codec_words, 0usize);
        let mut next_codec_memory = next_codec_vec.into_boxed_slice();
        pb = next_codec_memory.as_mut_ptr().cast::<u8>();
        (*p_next_sc).cCodecMemory = next_codec_words;
        (*p_next_sc).pCodecMemory = Some(next_codec_memory);

        let Some(p_wstream) = (*pSCP).pWStream.map(NonNull::as_ptr) else {
            return Err(WmpError::Fail);
        };
        if attach_sb(&mut sb, &mut *p_wstream).is_err() {
            return Err(WmpError::Fail);
        }
        initialize_str_dec(
            p_next_sc,
            std::ptr::addr_of!(sc.m_param),
            std::ptr::addr_of!(sc),
        );
        read_image_plane_header(
            std::ptr::addr_of_mut!((*p_next_sc).WMII),
            std::ptr::addr_of_mut!((*p_next_sc).WMISCP),
            std::ptr::addr_of_mut!((*p_next_sc).m_param),
            &mut sb,
        )?;
        detach_sb(&mut sb)?;

        (*p_next_sc).m_Dparam = (*p_sc).m_Dparam;
        (*p_next_sc).cbChannel = cb_channel;

        (*p_next_sc).m_param.cfColorFormat = ColorFormat::YOnly;
        (*p_next_sc).m_param.cNumChannels = 1;
        (*p_next_sc).m_param.bAlphaChannel = 1;

        pb = ((pb as usize + 128 - 1) & !(128 - 1)) as *mut u8;
        (*p_next_sc).a0MBbuffer[0] = NonNull::new(pb.cast::<i32>());
        pb = pb.add(cb_mac_block_stride * (*p_next_sc).cmbWidth);
        (*p_next_sc).a1MBbuffer[0] = NonNull::new(pb.cast::<i32>());

        (*p_next_sc).pIOHeader = (*p_sc).pIOHeader;

        (*p_next_sc).m_pNextSC = NonNull::new(p_sc);
        (*p_next_sc).m_bSecondary = 1;
    } else {
        (*p_sc).WMISCP.uAlphaMode = AlphaMode::None as u8;
    }

    if str_io_dec_init(&mut *p_sc).is_err() {
        return Err(WmpError::Fail);
    }
    if str_dec_init(&mut *p_sc).is_err() {
        return Err(WmpError::Fail);
    }
    if !p_next_sc.is_null() && str_dec_init(&mut *p_next_sc).is_err() {
        return Err(WmpError::Fail);
    }

    if let Some(mut next_sc) = next_sc_storage {
        (*p_sc).m_pNextSC = Some(NonNull::from(next_sc.as_mut()));
        (*p_sc).pNextSCMemory = Some(next_sc);
    } else {
        (*p_sc).m_pNextSC = None;
    }

    *pII = (*p_sc).WMII;
    *pSCP = (*p_sc).WMISCP;

    if (*p_sc).WMII.cPostProcStrength != 0 {
        // C discards this return (faithful to ImageStrDecInit)
        let _ = init_post_proc(
            &mut (*p_sc).pPostProcInfo,
            &mut (*p_sc).pPostProcInfoMemory,
            (*p_sc).cmbWidth,
            (*p_sc).m_param.cNumChannels,
        );
        if (*p_sc).m_param.bAlphaChannel != 0 {
            // C discards this return (faithful to ImageStrDecInit)
            let _ = init_post_proc(
                &mut (*p_next_sc).pPostProcInfo,
                &mut (*p_next_sc).pPostProcInfoMemory,
                (*p_next_sc).cmbWidth,
                (*p_next_sc).m_param.cNumChannels,
            );
        }
    }

    if (*p_sc).m_fMeasurePerf != 0 {
        perf_timer_stop((*p_sc).m_ptEncDecPerf.as_mut());
    }

    *pctxSC = Some(sc_storage);
    Ok(())
}

/// Original function: `ImageStrDecDecode` at `original/jxrlib/image/decode/strdec.c:3408`.
pub unsafe fn image_str_dec_decode(
    ctx_sc: *mut CWMImageStrCodec,
    p_bi: *const tagCWMImageBufferInfo,
) -> Result<(), WmpError> {
    let p_sc = ctx_sc;
    let Some(dparam) = (*p_sc).m_Dparam else {
        return Err(WmpError::Fail);
    };
    let p_next_sc = (*p_sc).m_pNextSC;
    let c_mb_row: usize;
    let mut k: usize;

    let mut process_left;
    let mut process_center;
    let mut process_right;
    let mut transform: Option<ImageDataProc>;
    let i_chroma_elements = if (*p_sc).m_param.cfColorFormat == ColorFormat::Yuv420 {
        8 * 8
    } else if (*p_sc).m_param.cfColorFormat == ColorFormat::Yuv422 {
        8 * 16
    } else {
        16 * 16
    };

    if std::mem::size_of::<CWMImageStrCodec>() != (*p_sc).cbStruct {
        return Err(WmpError::Fail);
    }

    if (*p_sc).m_fMeasurePerf != 0 {
        perf_timer_start((*p_sc).m_ptEncDecPerf.as_mut());
    }

    (*p_sc).WMIBI = *p_bi;

    set_roi(&mut *p_sc)?;
    if let Some(mut p_next_sc) = p_next_sc {
        let p_next_sc = p_next_sc.as_mut();
        (*p_next_sc).WMIBI = (*p_sc).WMIBI;
        set_roi(p_next_sc)?;
    }

    c_mb_row = if (*dparam.as_ptr()).bDecodeFullFrame != 0 {
        (*p_sc).cmbHeight
    } else {
        ((*dparam.as_ptr())
            .cROIBottomY
            .checked_add(16)
            .ok_or(WmpError::Fail)?)
            >> 4
    };

    if init_lookup_tables(&mut *p_sc).is_err() {
        return Err(WmpError::Fail);
    }
    if let Some(mut p_next_sc) = p_next_sc {
        if init_lookup_tables(p_next_sc.as_mut()).is_err() {
            return Err(WmpError::Fail);
        }
    }

    if (*p_sc).WMII.bdBitDepth == BitDepth::One {
        let Some(base) = (*p_sc).WMIBI.pv else {
            return Err(WmpError::Fail);
        };
        let mut i = 0;
        while i < (*p_sc).WMIBI.cLine {
            let Some(row_offset) = i.checked_mul((*p_sc).WMIBI.cbStride) else {
                return Err(WmpError::Fail);
            };
            std::ptr::write_bytes(base.as_ptr().add(row_offset), 0, (*p_sc).WMIBI.cbStride);
            i += 1;
        }
    }

    (*p_sc).cRow = 0;
    process_left = (*p_sc).ProcessTopLeft;
    process_center = (*p_sc).ProcessTop;
    process_right = (*p_sc).ProcessTopRight;
    transform = if (*p_sc).m_param.cSubVersion == CODEC_SUBVERSION {
        Some(inv_transform_macroblock)
    } else {
        Some(inv_transform_macroblock_altered_operators_hard)
    };

    (*p_sc).cRow = 0;
    while (*p_sc).cRow <= c_mb_row {
        (*p_sc).cColumn = 0;
        init_mr_ptr(&mut *p_sc);

        let Some(p1_mb_buffer) = (*p_sc).p1MBbuffer[0] else {
            return Err(WmpError::Fail);
        };
        std::ptr::write_bytes(p1_mb_buffer.as_ptr(), 0, 16 * 16 * (*p_sc).cmbWidth);
        k = 1;
        while k < (*p_sc).m_param.cNumChannels {
            let Some(p1_mb_buffer) = (*p_sc).p1MBbuffer[k] else {
                return Err(WmpError::Fail);
            };
            std::ptr::write_bytes(
                p1_mb_buffer.as_ptr(),
                0,
                i_chroma_elements * (*p_sc).cmbWidth,
            );
            k += 1;
        }
        if let Some(next_sc) = (*p_sc).m_pNextSC {
            let next_sc = next_sc.as_ptr();
            let Some(p1_mb_buffer) = (*next_sc).p1MBbuffer[0] else {
                return Err(WmpError::Fail);
            };
            std::ptr::write_bytes(p1_mb_buffer.as_ptr(), 0, 16 * 16 * (*next_sc).cmbWidth);
        }

        let Some(process_left_fn) = process_left else {
            return Err(WmpError::Fail);
        };
        if process_left_fn(&mut *p_sc).is_err() {
            return Err(WmpError::Fail);
        }
        advance_mr_ptr(&mut *p_sc);

        (*p_sc).Transform = transform;
        (*p_sc).cColumn = 1;
        while (*p_sc).cColumn < (*p_sc).cmbWidth {
            let Some(process_center_fn) = process_center else {
                return Err(WmpError::Fail);
            };
            if process_center_fn(&mut *p_sc).is_err() {
                return Err(WmpError::Fail);
            }
            advance_mr_ptr(&mut *p_sc);
            (*p_sc).cColumn += 1;
        }
        (*p_sc).Transform = if (*p_sc).m_param.cSubVersion == CODEC_SUBVERSION {
            Some(inv_transform_macroblock)
        } else {
            Some(inv_transform_macroblock_altered_operators_hard)
        };

        let Some(process_right_fn) = process_right else {
            return Err(WmpError::Fail);
        };
        if process_right_fn(&mut *p_sc).is_err() {
            return Err(WmpError::Fail);
        }

        if (*p_sc).cRow != 0 {
            let Some(row_start) = (*p_sc).cRow.checked_mul(16) else {
                return Err(WmpError::Fail);
            };
            if (*dparam.as_ptr()).cThumbnailScale < 2
                && ((*dparam.as_ptr()).bDecodeFullFrame != 0
                    || ((row_start > (*dparam.as_ptr()).cROITopY)
                        && (row_start
                            <= (*dparam.as_ptr())
                                .cROIBottomY
                                .checked_add(16)
                                .ok_or(WmpError::Fail)?)))
            {
                let Some(load) = (*p_sc).Load else {
                    return Err(WmpError::Fail);
                };
                if load(&mut *p_sc).is_err() {
                    return Err(WmpError::Fail);
                }
            }

            if (*dparam.as_ptr()).cThumbnailScale >= 2 && decode_thumbnail(&mut *p_sc).is_err() {
                return Err(WmpError::Fail);
            }
        }

        advance_one_mb_row(&mut *p_sc);
        swap_mr_ptr(&mut *p_sc);

        if (*p_sc).cRow == c_mb_row.wrapping_sub(1) {
            process_left = (*p_sc).ProcessBottomLeft;
            process_center = (*p_sc).ProcessBottom;
            process_right = (*p_sc).ProcessBottomRight;
            transform = if (*p_sc).m_param.cSubVersion == CODEC_SUBVERSION {
                Some(inv_transform_macroblock)
            } else {
                Some(inv_transform_macroblock_altered_operators_hard)
            };
        } else {
            process_left = (*p_sc).ProcessLeft;
            process_center = (*p_sc).ProcessCenter;
            process_right = (*p_sc).ProcessRight;
            transform = (*p_sc).TransformCenter;
        }

        (*p_sc).cRow += 1;
    }

    fixup_y_only_to_others(p_sc, p_bi);

    if (*p_sc).m_fMeasurePerf != 0 {
        perf_timer_stop((*p_sc).m_ptEncDecPerf.as_mut());
    }
    Ok(())
}

/// Original function: `ImageStrDecTerm` at `original/jxrlib/image/decode/strdec.c:3603`.
pub unsafe fn image_str_dec_term(mut ctx_sc: Box<CWMImageStrCodec>) -> Result<(), WmpError> {
    let p_sc = ctx_sc.as_mut() as *mut CWMImageStrCodec;
    if std::mem::size_of::<CWMImageStrCodec>() != (*p_sc).cbStruct {
        return Err(WmpError::Fail);
    }

    if (*p_sc).m_fMeasurePerf != 0 {
        perf_timer_start((*p_sc).m_ptEncDecPerf.as_mut());
    }

    if (*p_sc).cCodecMemory == 0 {
        return Err(WmpError::Fail);
    }

    // C discards this return (faithful to ImageStrDecTerm)
    let _ = str_dec_term(&mut *p_sc);
    if (*p_sc).m_fMeasurePerf != 0 {
        perf_timer_stop((*p_sc).m_ptEncDecPerf.as_mut());
        output_perf_timer_report(&mut *p_sc);
        perf_timer_delete(&mut (*p_sc).m_ptEncDecPerf);
        perf_timer_delete(&mut (*p_sc).m_ptEndToEndPerf);
    }

    (*p_sc).m_pNextSC = None;
    (*p_sc).pNextSCMemory = None;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn read_quantizer_sb_accepts_exactly_max_channels() {
        let mut qp_index = [0xff; MAX_CHANNELS];
        let mut bit_io = tagSimpleBitIO {
            pWS: None,
            cbRead: 0,
            bAccumulator: 0,
            cBitLeft: 0,
            read_error: None,
        };

        let mode = unsafe { read_quantizer_sb(&mut qp_index, &mut bit_io, MAX_CHANNELS) };

        assert_eq!(mode, 0);
        assert_eq!(qp_index[0], 0);
        assert_eq!(bit_io.read_error, Some(WmpError::FileIO));
    }

    #[test]
    fn thumbnail_chroma_interpolation_guard_handles_small_widths() {
        for c_width in 0..=8 {
            assert!(!thumbnail_chroma_has_next_sample(0, c_width));
        }

        assert!(thumbnail_chroma_has_next_sample(0, 9));
        assert!(thumbnail_chroma_has_next_sample(0, 16));
        assert!(!thumbnail_chroma_has_next_sample(8, 16));
    }

    #[test]
    fn roi_scaled_start_uses_chroma_units() {
        assert_eq!(
            roi_scaled_start(4, 1, chroma_roi_x_divisor(ColorFormat::Yuv422)),
            Some(2)
        );
        assert_eq!(
            roi_scaled_start(5, 2, chroma_roi_x_divisor(ColorFormat::Yuv420)),
            Some(1)
        );
        assert_eq!(
            roi_scaled_start(5, 2, chroma_roi_x_divisor(ColorFormat::Rgb)),
            Some(3)
        );
    }

    #[test]
    fn roi_scaled_span_is_checked_and_keeps_single_chroma_sample() {
        assert_eq!(
            roi_scaled_span(4, 7, 1, chroma_roi_x_divisor(ColorFormat::Yuv422)),
            Some(2)
        );
        assert_eq!(
            roi_scaled_span(1, 1, 1, chroma_roi_x_divisor(ColorFormat::Yuv420)),
            Some(1)
        );
        assert_eq!(
            roi_scaled_span(7, 4, 1, chroma_roi_x_divisor(ColorFormat::Yuv422)),
            None
        );
    }

    #[test]
    fn bounded_roi_fill_count_caps_reversed_subsampled_roi() {
        let i_first = roi_scaled_start(4, 1, chroma_roi_x_divisor(ColorFormat::Yuv422)).unwrap();
        let reverse_limit =
            roi_scaled_span(4, 7, 1, chroma_roi_x_divisor(ColorFormat::Yuv422)).unwrap();

        assert_eq!(i_first, 2);
        assert_eq!(reverse_limit, 2);
        assert_eq!(
            bounded_roi_fill_count(10, i_first, reverse_limit, false),
            Some(2)
        );
        assert_eq!(
            bounded_roi_fill_count(10, i_first, reverse_limit, true),
            Some(8)
        );
        assert_eq!(
            bounded_roi_fill_count(1, i_first, reverse_limit, false),
            None
        );
    }
}
