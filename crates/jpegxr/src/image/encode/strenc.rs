// Auto-generated scaffold for a faithful JXRLib translation restart.
// Keep one Rust item per original C item; replace stubs bottom-up.

use std::ptr::NonNull;

use crate::image::encode::encode::{allocate_coding_context_enc, reset_coding_context_enc};
use crate::image::encode::segenc::{
    encode_macroblock_dc, encode_macroblock_highpass, encode_macroblock_lowpass,
};
use crate::image::encode::str_fwd_transform::transform_macroblock;
use crate::image::encode::str_pred_quant_enc::quantize_macroblock;
use crate::image::encode::strenc_x86::str_enc_opt;
use crate::image::sys::common::CBLK_CHROMAS;
use crate::image::sys::perf_timer_ansi::{
    perf_timer_copy_start_time, perf_timer_delete, perf_timer_new, perf_timer_start,
    perf_timer_stop,
};
use crate::image::sys::str_pred_quant::{allocate_pred_info, QPFRACBITS, SHIFTZERO};
use crate::image::sys::strcodec::PACKETLENGTH;
use crate::image::sys::strcodec::{
    advance_mr_ptr, advance_one_mb_row, allocate_bit_io_info, allocate_quantizer,
    allocate_tile_info, attach_is_write, check_image_buffer, create_ws_file_owned,
    create_ws_list_owned, detach_is_write, dquant_bits, fill_to_byte, format_quantizer,
    get_size_write, get_tile_pos, idx_cc, idx_cc_420, init_mr_ptr, output_perf_timer_report,
    put_bit16, put_bit32, set_bit_io_pointers, set_uniform_quantizer, swap_mr_ptr, tagBitIOInfo,
    tagCWMIQuantizer, use_dc_quantizer, use_lp_quantizer, write_is, CCodingContext, CWMITile,
    CWMImageStrCodec, ImageDataProc, WsFileMode, MAX_CHANNELS,
};
use crate::image::sys::windowsmediaphoto::{
    tagCWMIStrCodecParam, tagCWMImageBufferInfo, tagCWMImageInfo, AlphaMode, BitDepthLayout,
    BitstreamFormat, Overlap, Subband, WMPStream,
};
use crate::jxrgluelib::jxrglue::{BitDepth, ColorFormat};
use crate::WmpError;

pub const LOG_MAX_TILES: u32 = 12;
pub const MAX_TILES: u32 = 1 << LOG_MAX_TILES;
pub const MINIMUM_PACKET_LENGTH: usize = 4;
pub const MAX_MEMORY_SIZE_IN_WORDS: usize = 64 << 20;
pub const CODEC_VERSION: u32 = 1;
pub const CODEC_SUBVERSION_NEWSCALING_SOFT_TILES: u32 = 1;
pub const CODEC_SUBVERSION_NEWSCALING_HARD_TILES: u32 = 9;
pub const G_GDI_SIGNATURE: [u8; 8] = *b"WMPHOTO\0";

/// Original union: `uif` at `original/jxrlib/image/encode/strenc.c:352`.
#[derive(Debug, Clone, Default)]
pub struct uif {
    pub i: i32,
    pub f: f32,
}

/// Original function: `writeQuantizer` at `original/jxrlib/image/encode/strenc.c:59`.
pub unsafe fn write_quantizer(
    pQuantizer: *mut Option<NonNull<tagCWMIQuantizer>>,
    pIO: *mut tagBitIOInfo,
    mut cChMode: u8,
    cChannel: usize,
    iPos: usize,
) {
    if cChMode > 2 {
        cChMode = 2;
    }
    let quantizers = std::slice::from_raw_parts_mut(pQuantizer, cChannel);

    if cChannel > 1 {
        put_bit16(pIO, cChMode as u32, 2);
    } else {
        cChMode = 0;
    }

    let Some(first) = quantizers[0] else {
        return;
    };
    put_bit16(pIO, (*first.as_ptr().add(iPos)).iIndex as u32, 8);

    if cChMode == 1 {
        let Some(second) = quantizers[1] else {
            return;
        };
        put_bit16(pIO, (*second.as_ptr().add(iPos)).iIndex as u32, 8);
    } else if cChMode > 0 {
        for quantizer in &quantizers[1..] {
            let Some(quantizer) = *quantizer else {
                return;
            };
            put_bit16(pIO, (*quantizer.as_ptr().add(iPos)).iIndex as u32, 8);
        }
    }
}

/// Original function: `writePacketHeader` at `original/jxrlib/image/encode/strenc.c:84`.
pub unsafe fn write_packet_header(p_io: *mut tagBitIOInfo, pt_packet_type: u8, p_id: u8) {
    put_bit16(p_io, 0, 8);
    put_bit16(p_io, 0, 8);
    put_bit16(p_io, 1, 8);
    put_bit16(p_io, ((p_id << 3) + (pt_packet_type & 7)) as u32, 8);
}

/// Original function: `writeTileHeaderDC` at `original/jxrlib/image/encode/strenc.c:92`.
pub unsafe fn write_tile_header_dc(
    sc: &mut CWMImageStrCodec,
    p_io: *mut tagBitIOInfo,
) -> Result<(), WmpError> {
    let codecs = [
        Some(sc as *mut CWMImageStrCodec),
        sc.m_pNextSC.map(NonNull::as_ptr),
    ];
    let mut qp_random_state = 0x4a58_5244_u32
        ^ (sc.cTileRow as u32).wrapping_mul(0x9e37_79b9)
        ^ (sc.cTileColumn as u32).wrapping_mul(0x85eb_ca6b);

    for p_sc in codecs.into_iter().flatten() {
        if ((*p_sc).m_param.uQPMode & 1) != 0 {
            let Some(tile) = (*p_sc)
                .pTileMemory
                .as_deref_mut()
                .and_then(|tiles| tiles.get_mut((*p_sc).cTileColumn))
            else {
                return Err(WmpError::Fail);
            };
            let p_tile = tile as *mut CWMITile;

            qp_random_state = qp_random_state
                .wrapping_mul(1_103_515_245)
                .wrapping_add(12_345);
            (*p_tile).cChModeDC = ((qp_random_state >> 16) & 3) as u8;

            if (*p_sc).cTileRow + (*p_sc).cTileColumn == 0 {
                for i_tile in 0..=(*p_sc).WMISCP.cNumOfSliceMinus1V {
                    let Some(tile) = (*p_sc)
                        .pTileMemory
                        .as_deref_mut()
                        .and_then(|tiles| tiles.get_mut(i_tile as usize))
                    else {
                        return Err(WmpError::Fail);
                    };
                    if allocate_quantizer(
                        &mut tile.pQuantizerDC,
                        (*p_sc).m_param.cNumChannels,
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

            for i in 0..(*p_sc).m_param.cNumChannels {
                qp_random_state = qp_random_state
                    .wrapping_mul(1_103_515_245)
                    .wrapping_add(12_345);
                let Some(quantizer) = (*p_tile).pQuantizerDC[i] else {
                    return Err(WmpError::Fail);
                };
                (*quantizer.as_ptr()).iIndex = (((qp_random_state >> 16) & 0x2f) + 1) as u8;
            }

            format_quantizer(
                (*p_tile).pQuantizerDC.as_mut_ptr(),
                (*p_tile).cChModeDC,
                (*p_sc).m_param.cNumChannels,
                0,
                1,
                (*p_sc).m_param.bScaledArith,
            );

            for i in 0..(*p_sc).m_param.cNumChannels {
                let Some(quantizer) = (*p_tile).pQuantizerDC[i] else {
                    return Err(WmpError::Fail);
                };
                (*quantizer.as_ptr()).iOffset = (*quantizer.as_ptr()).iQP >> 1;
            }

            write_quantizer(
                (*p_tile).pQuantizerDC.as_mut_ptr(),
                p_io,
                (*p_tile).cChModeDC,
                (*p_sc).m_param.cNumChannels,
                0,
            );
        }
    }

    Ok(())
}

/// Original function: `writeTileHeaderLP` at `original/jxrlib/image/encode/strenc.c:125`.
pub unsafe fn write_tile_header_lp(
    sc: &mut CWMImageStrCodec,
    p_io: *mut tagBitIOInfo,
) -> Result<(), WmpError> {
    let codecs = [
        Some(sc as *mut CWMImageStrCodec),
        sc.m_pNextSC.map(NonNull::as_ptr),
    ];
    let mut qp_random_state = 0x4a58_524c_u32
        ^ (sc.cTileRow as u32).wrapping_mul(0x9e37_79b9)
        ^ (sc.cTileColumn as u32).wrapping_mul(0x85eb_ca6b);

    for p_sc in codecs.into_iter().flatten() {
        if (*p_sc).WMISCP.sbSubband != Subband::DcOnly && ((*p_sc).m_param.uQPMode & 2) != 0 {
            let Some(tile) = (*p_sc)
                .pTileMemory
                .as_deref_mut()
                .and_then(|tiles| tiles.get_mut((*p_sc).cTileColumn))
            else {
                return Err(WmpError::Fail);
            };
            let p_tile = tile as *mut CWMITile;

            qp_random_state = qp_random_state
                .wrapping_mul(1_103_515_245)
                .wrapping_add(12_345);
            (*p_tile).bUseDC = if ((qp_random_state >> 16) & 1) == 0 {
                1
            } else {
                0
            };
            put_bit16(p_io, if (*p_tile).bUseDC == 1 { 1 } else { 0 }, 1);
            (*p_tile).cBitsLP = 0;
            (*p_tile).cNumQPLP = if (*p_tile).bUseDC == 1 {
                1
            } else {
                qp_random_state = qp_random_state
                    .wrapping_mul(1_103_515_245)
                    .wrapping_add(12_345);
                (((qp_random_state >> 16) & 0xf) + 1) as u8
            };

            if (*p_sc).cTileRow > 0 {
                (*p_tile).pQuantizerLPMemory = None;
                (*p_tile).cQuantizerLPMemory = 0;
                (*p_tile).pQuantizerLP.fill(None);
            }

            if allocate_quantizer(
                &mut (*p_tile).pQuantizerLP,
                (*p_sc).m_param.cNumChannels,
                (*p_tile).cNumQPLP as usize,
                &mut (*p_tile).pQuantizerLPMemory,
                &mut (*p_tile).cQuantizerLPMemory,
            )
            .is_err()
            {
                return Err(WmpError::Fail);
            }

            if (*p_tile).bUseDC == 1 {
                use_dc_quantizer(&mut *p_sc, (*p_sc).cTileColumn);
            } else {
                put_bit16(p_io, ((*p_tile).cNumQPLP - 1) as u32, 4);

                (*p_tile).cBitsLP = dquant_bits((*p_tile).cNumQPLP);

                for i in 0..(*p_tile).cNumQPLP {
                    qp_random_state = qp_random_state
                        .wrapping_mul(1_103_515_245)
                        .wrapping_add(12_345);
                    (*p_tile).cChModeLP[i as usize] = ((qp_random_state >> 16) & 3) as u8;

                    for j in 0..(*p_sc).m_param.cNumChannels {
                        qp_random_state = qp_random_state
                            .wrapping_mul(1_103_515_245)
                            .wrapping_add(12_345);
                        let Some(quantizer) = (*p_tile).pQuantizerLP[j] else {
                            return Err(WmpError::Fail);
                        };
                        (*quantizer.as_ptr().add(i as usize)).iIndex =
                            (((qp_random_state >> 16) & 0xfe) + 1) as u8;
                    }
                    format_quantizer(
                        (*p_tile).pQuantizerLP.as_mut_ptr(),
                        (*p_tile).cChModeLP[i as usize],
                        (*p_sc).m_param.cNumChannels,
                        i as usize,
                        1,
                        (*p_sc).m_param.bScaledArith,
                    );
                    write_quantizer(
                        (*p_tile).pQuantizerLP.as_mut_ptr(),
                        p_io,
                        (*p_tile).cChModeLP[i as usize],
                        (*p_sc).m_param.cNumChannels,
                        i as usize,
                    );
                }
            }
        }
    }

    Ok(())
}

/// Original function: `writeTileHeaderHP` at `original/jxrlib/image/encode/strenc.c:169`.
pub unsafe fn write_tile_header_hp(
    sc: &mut CWMImageStrCodec,
    p_io: *mut tagBitIOInfo,
) -> Result<(), WmpError> {
    let codecs = [
        Some(sc as *mut CWMImageStrCodec),
        sc.m_pNextSC.map(NonNull::as_ptr),
    ];
    let mut qp_random_state = 0x4a58_5248_u32
        ^ (sc.cTileRow as u32).wrapping_mul(0x9e37_79b9)
        ^ (sc.cTileColumn as u32).wrapping_mul(0x85eb_ca6b);

    for p_sc in codecs.into_iter().flatten() {
        if (*p_sc).WMISCP.sbSubband != Subband::DcOnly
            && (*p_sc).WMISCP.sbSubband != Subband::NoHighpass
            && ((*p_sc).m_param.uQPMode & 4) != 0
        {
            let Some(tile) = (*p_sc)
                .pTileMemory
                .as_deref_mut()
                .and_then(|tiles| tiles.get_mut((*p_sc).cTileColumn))
            else {
                return Err(WmpError::Fail);
            };
            let p_tile = tile as *mut CWMITile;

            qp_random_state = qp_random_state
                .wrapping_mul(1_103_515_245)
                .wrapping_add(12_345);
            (*p_tile).bUseLP = if ((qp_random_state >> 16) & 1) == 0 {
                1
            } else {
                0
            };
            put_bit16(p_io, if (*p_tile).bUseLP == 1 { 1 } else { 0 }, 1);
            (*p_tile).cBitsHP = 0;

            (*p_tile).cNumQPHP = if (*p_tile).bUseLP == 1 {
                (*p_tile).cNumQPLP
            } else {
                qp_random_state = qp_random_state
                    .wrapping_mul(1_103_515_245)
                    .wrapping_add(12_345);
                (((qp_random_state >> 16) & 0xf) + 1) as u8
            };

            if (*p_sc).cTileRow > 0 {
                (*p_tile).pQuantizerHPMemory = None;
                (*p_tile).cQuantizerHPMemory = 0;
                (*p_tile).pQuantizerHP.fill(None);
            }

            if allocate_quantizer(
                &mut (*p_tile).pQuantizerHP,
                (*p_sc).m_param.cNumChannels,
                (*p_tile).cNumQPHP as usize,
                &mut (*p_tile).pQuantizerHPMemory,
                &mut (*p_tile).cQuantizerHPMemory,
            )
            .is_err()
            {
                return Err(WmpError::Fail);
            }

            if (*p_tile).bUseLP == 1 {
                use_lp_quantizer(&mut *p_sc, (*p_tile).cNumQPHP as usize, (*p_sc).cTileColumn);
            } else {
                put_bit16(p_io, ((*p_tile).cNumQPHP - 1) as u32, 4);
                (*p_tile).cBitsHP = dquant_bits((*p_tile).cNumQPHP);

                for i in 0..(*p_tile).cNumQPHP {
                    qp_random_state = qp_random_state
                        .wrapping_mul(1_103_515_245)
                        .wrapping_add(12_345);
                    (*p_tile).cChModeHP[i as usize] = ((qp_random_state >> 16) & 3) as u8;

                    for j in 0..(*p_sc).m_param.cNumChannels {
                        qp_random_state = qp_random_state
                            .wrapping_mul(1_103_515_245)
                            .wrapping_add(12_345);
                        let Some(quantizer) = (*p_tile).pQuantizerHP[j] else {
                            return Err(WmpError::Fail);
                        };
                        (*quantizer.as_ptr().add(i as usize)).iIndex =
                            (((qp_random_state >> 16) & 0xfe) + 1) as u8;
                    }
                    format_quantizer(
                        (*p_tile).pQuantizerHP.as_mut_ptr(),
                        (*p_tile).cChModeHP[i as usize],
                        (*p_sc).m_param.cNumChannels,
                        i as usize,
                        0,
                        (*p_sc).m_param.bScaledArith,
                    );
                    write_quantizer(
                        (*p_tile).pQuantizerHP.as_mut_ptr(),
                        p_io,
                        (*p_tile).cChModeHP[i as usize],
                        (*p_sc).m_param.cNumChannels,
                        i as usize,
                    );
                }
            }
        }
    }

    Ok(())
}

/// Original function: `encodeMB` at `original/jxrlib/image/encode/strenc.c:212`.
pub unsafe fn encode_mb(sc: &mut CWMImageStrCodec, iMBX: i32, iMBY: i32) -> Result<(), WmpError> {
    let p_context = {
        let Some(contexts) = sc.pCodingContextMemory.as_deref_mut() else {
            return Err(WmpError::Fail);
        };
        let Some(context) = contexts.get_mut(sc.cTileColumn) else {
            return Err(WmpError::Fail);
        };
        context as *mut CCodingContext
    };

    if sc.m_bCtxLeft != 0 && sc.m_bCtxTop != 0 && sc.m_bSecondary == 0 && sc.m_param.bTranscode == 0
    {
        let p_id = ((sc
            .cTileRow
            .wrapping_mul(sc.WMISCP.cNumOfSliceMinus1V as usize + 1)
            .wrapping_add(sc.cTileColumn))
            & 0x1f) as u8;
        let io_dc = (*p_context).m_pIODC;
        let io_lp = (*p_context).m_pIOLP;
        let io_ac = (*p_context).m_pIOAC;
        let io_fl = (*p_context).m_pIOFL;
        let trim_flex_bits = (*p_context).m_iTrimFlexBits;

        if sc.WMISCP.bfBitstreamFormat == BitstreamFormat::Spatial {
            write_packet_header(io_dc, 0, p_id);
            if sc.m_param.bTrimFlexbitsFlag != 0 {
                put_bit16(io_dc, trim_flex_bits as u32, 4);
            }
            // C discards these returns (faithful to encodeMB)
            let _ = write_tile_header_dc(sc, io_dc);
            let _ = write_tile_header_lp(sc, io_dc);
            let _ = write_tile_header_hp(sc, io_dc);
        } else {
            write_packet_header(io_dc, 1, p_id);
            // C discards this return (faithful to encodeMB)
            let _ = write_tile_header_dc(sc, io_dc);
            if sc.cSB > 1 {
                write_packet_header(io_lp, 2, p_id);
                // C discards this return (faithful to encodeMB)
                let _ = write_tile_header_lp(sc, io_lp);
            }
            if sc.cSB > 2 {
                write_packet_header(io_ac, 3, p_id);
                // C discards this return (faithful to encodeMB)
                let _ = write_tile_header_hp(sc, io_ac);
            }
            if sc.cSB > 3 {
                write_packet_header(io_fl, 4, p_id);
                if sc.m_param.bTrimFlexbitsFlag != 0 {
                    put_bit16(io_fl, trim_flex_bits as u32, 4);
                }
            }
        }
    }

    if encode_macroblock_dc(sc, &mut *p_context, iMBX, iMBY).is_err() {
        return Err(WmpError::Fail);
    }

    if sc.WMISCP.sbSubband != Subband::DcOnly {
        if encode_macroblock_lowpass(sc, &mut *p_context, iMBX, iMBY).is_err() {
            return Err(WmpError::Fail);
        }
    }

    if sc.WMISCP.sbSubband != Subband::DcOnly && sc.WMISCP.sbSubband != Subband::NoHighpass {
        if encode_macroblock_highpass(sc, &mut *p_context, iMBX, iMBY).is_err() {
            return Err(WmpError::Fail);
        }
    }

    if iMBX + 1 == sc.cmbWidth as i32
        && (iMBY + 1 == sc.cmbHeight as i32
            || (sc.cTileRow < sc.WMISCP.cNumOfSliceMinus1H as usize
                && iMBY == sc.WMISCP.uiTileY[sc.cTileRow + 1] as i32 - 1))
    {
        if sc.m_pNextSC.is_none() || sc.m_bSecondary != 0 {
            let Some(bit_io_base) = sc.m_ppBitIO else {
                return Err(WmpError::Fail);
            };
            let Some(pp_wstream) = sc.ppWStream.map(NonNull::as_ptr) else {
                return Err(WmpError::Fail);
            };
            let bit_ios = std::slice::from_raw_parts(bit_io_base.as_ptr(), sc.cNumBitIO);
            let streams = std::slice::from_raw_parts(pp_wstream, sc.cNumBitIO);
            let Some(index_table) = sc.pIndexTableMemory.as_deref_mut() else {
                return Err(WmpError::Fail);
            };
            let Some(index_table) = index_table.get_mut(..sc.cNumBitIO * (sc.cTileRow + 1)) else {
                return Err(WmpError::Fail);
            };

            for (k, (&p_io, &p_ws)) in bit_ios.iter().zip(streams.iter()).enumerate() {
                let Some(p_io) = p_io else {
                    return Err(WmpError::Fail);
                };
                let p_io = p_io.as_ptr();
                let Some(p_ws) = p_ws else {
                    return Err(WmpError::Fail);
                };
                let p_ws = p_ws.as_ptr();
                fill_to_byte(p_io);
                let mut l: usize = 0;
                let Some(get_pos) = (*p_ws).GetPos else {
                    return Err(WmpError::Fail);
                };
                get_pos(&mut *p_ws, &mut l)?;
                index_table[sc.cNumBitIO.wrapping_mul(sc.cTileRow).wrapping_add(k)] =
                    l.wrapping_add(get_size_write(p_io) as usize);
            }
        }

        if iMBY + 1 != sc.cmbHeight as i32 {
            let context_count = sc.WMISCP.cNumOfSliceMinus1V as usize + 1;
            let Some(contexts) = sc.pCodingContextMemory.as_deref_mut() else {
                return Err(WmpError::Fail);
            };
            for context in contexts.iter_mut().take(context_count) {
                reset_coding_context_enc(context);
            }
        }
    }

    Ok(())
}

/// Original function: `processMacroblock` at `original/jxrlib/image/encode/strenc.c:284`.
pub unsafe fn process_macroblock(sc: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    let mut sc = sc;
    let top_or_left = sc.cColumn == 0 || sc.cRow == 0;
    let jend = sc.m_pNextSC.is_some() as usize;

    for j in 0..=jend {
        transform_macroblock(sc);
        if !top_or_left {
            get_tile_pos(sc, sc.cColumn - 1, sc.cRow - 1);
            if let Some(next_sc) = sc.m_pNextSC.map(NonNull::as_ptr) {
                (*next_sc).cTileRow = sc.cTileRow;
                (*next_sc).cTileColumn = sc.cTileColumn;
            }
            encode_mb(sc, (sc.cColumn - 1) as i32, (sc.cRow - 1) as i32)?;
        }

        if let Some(next_sc) = sc.m_pNextSC.map(NonNull::as_ptr) {
            (*next_sc).cRow = sc.cRow;
            (*next_sc).cColumn = sc.cColumn;
            sc = &mut *next_sc;
        }
    }

    Ok(())
}

/// Original function: `forwardRGBE` at `original/jxrlib/image/encode/strenc.c:315`.
pub unsafe fn forward_rgbe(mut rgb: i32, mut e: i32) -> i32 {
    let i_result;
    let mut i_append = 1;

    if e == 0 {
        return 0;
    }

    e -= 1;
    while (rgb & 0x80) == 0 && e > 0 {
        rgb = (rgb << 1) + i_append;
        i_append = 0;
        e -= 1;
    }

    if e == 0 {
        i_result = rgb;
    } else {
        e += 1;
        i_result = (rgb & 0x7f) + (e << 7);
    }

    i_result
}

/// Original function: `float2pixel` at `original/jxrlib/image/encode/strenc.c:350`.
pub unsafe fn float2pixel(f: f32, c: i8, lm: u8) -> i32 {
    let h;

    if f == 0.0 {
        h = 0;
    } else {
        let x_i = f.to_bits() as i32;

        let e = (x_i >> 23) & 0x000000ff;
        let mut m = (x_i & 0x007fffff) | 0x800000;
        let mut e = e;
        if e == 0 {
            m ^= 0x800000;
            e += 1;
        }

        let mut e1 = e - 127 + c as i32;
        if e1 <= 1 {
            if e1 < 1 {
                m >>= (1 - e1) as u32;
            }
            e1 = 1;
            if (m & 0x800000) == 0 {
                e1 = 0;
            }
        }
        m &= 0x007fffff;

        let mut h_local = (e1 << lm) + ((m + (1 << (23 - lm - 1))) >> (23 - lm));
        let s = x_i >> 31;
        h_local = (h_local ^ s).wrapping_sub(s);
        h = h_local;
    }

    h
}

/// Original function: `forwardHalf` at `original/jxrlib/image/encode/strenc.c:400`.
pub unsafe fn forward_half(mut h_half: i32) -> i32 {
    let s = h_half >> 31;
    h_half = ((h_half & 0x7fff) ^ s).wrapping_sub(s);
    h_half
}

/// Original function: `StrIOEncInit` at `original/jxrlib/image/encode/strenc.c:421`.
pub unsafe fn str_io_enc_init(sc: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    sc.m_param.bIndexTable = !(sc.WMISCP.bfBitstreamFormat == BitstreamFormat::Spatial
        && sc
            .WMISCP
            .cNumOfSliceMinus1H
            .wrapping_add(sc.WMISCP.cNumOfSliceMinus1V)
            == 0) as i32;
    if allocate_bit_io_info(sc).is_err() {
        return Err(WmpError::Fail);
    }

    let Some(header_io) = sc.pIOHeader else {
        return Err(WmpError::Fail);
    };
    let Some(p_wstream) = sc.WMISCP.pWStream.map(NonNull::as_ptr) else {
        return Err(WmpError::Fail);
    };
    // Faithful to C `attachISWrite(pSC->pIOHeader, pSC->WMISCP.pWStream)` (bare call), discarded.
    let _ = attach_is_write(header_io.as_ptr(), p_wstream);

    if sc.cNumBitIO > 0 {
        let mut streams = Vec::new();
        if streams.try_reserve_exact(sc.cNumBitIO).is_err() {
            return Err(WmpError::Fail);
        }
        streams.resize(sc.cNumBitIO, None);
        let mut streams = streams.into_boxed_slice();
        let Some(streams_ptr) = NonNull::new(streams.as_mut_ptr()) else {
            return Err(WmpError::Fail);
        };
        sc.ppWStream = Some(streams_ptr);
        sc.cWStreamMemory = sc.cNumBitIO;
        sc.ppWStreamMemory = Some(streams);

        let use_temp_files = sc
            .cmbHeight
            .wrapping_mul(sc.cmbWidth)
            .wrapping_mul(sc.WMISCP.cChannel)
            >= MAX_MEMORY_SIZE_IN_WORDS;
        if use_temp_files {
            sc.cTempFileMemory = sc.cNumBitIO;
            let mut temp_file_names = Vec::new();
            if temp_file_names.try_reserve_exact(sc.cNumBitIO).is_err() {
                return Err(WmpError::Fail);
            }
            sc.ppTempFileNameMemory = Some(temp_file_names);
            let mut file_streams = Vec::new();
            if file_streams.try_reserve_exact(sc.cNumBitIO).is_err() {
                return Err(WmpError::Fail);
            }
            file_streams.resize_with(sc.cNumBitIO, || None);
            sc.ppWStreamFileMemory = Some(file_streams);
        } else {
            let mut list_streams = Vec::new();
            if list_streams.try_reserve_exact(sc.cNumBitIO).is_err() {
                return Err(WmpError::Fail);
            }
            list_streams.resize_with(sc.cNumBitIO, || None);
            sc.ppWStreamListMemory = Some(list_streams);
        }

        for i in 0..sc.cNumBitIO {
            let Some(pp_wstream) = sc.ppWStream.map(NonNull::as_ptr) else {
                return Err(WmpError::Fail);
            };
            if use_temp_files {
                let temp_dir = std::env::temp_dir();
                let mut filename = None;
                for attempt in 0..1024 {
                    let path = temp_dir.join(format!(
                        "jpegxr-pure-rs-{}-{i}-{attempt}",
                        std::process::id()
                    ));
                    match std::fs::OpenOptions::new()
                        .write(true)
                        .create_new(true)
                        .open(&path)
                    {
                        Ok(file) => {
                            drop(file);
                            filename = Some(path);
                            break;
                        }
                        Err(err) if err.kind() == std::io::ErrorKind::AlreadyExists => {}
                        Err(_) => return Err(WmpError::Fail),
                    }
                }
                let Some(filename) = filename else {
                    return Err(WmpError::Fail);
                };
                let Some(temp_file_names) = sc.ppTempFileNameMemory.as_mut() else {
                    return Err(WmpError::Fail);
                };
                temp_file_names.push(filename);
                let filename_path = temp_file_names.last().map(|filename| filename.as_path());

                let Some(filename_path) = filename_path else {
                    return Err(WmpError::Fail);
                };
                let Ok(mut stream) =
                    create_ws_file_owned(filename_path, WsFileMode::ReadWriteTruncate)
                else {
                    return Err(WmpError::Fail);
                };
                let stream_ptr = NonNull::from(stream.as_mut());
                *pp_wstream.add(i) = Some(stream_ptr);
                let Some(file_streams) = sc.ppWStreamFileMemory.as_mut() else {
                    return Err(WmpError::Fail);
                };
                file_streams[i] = Some(stream);
            } else {
                let Ok(mut stream) = create_ws_list_owned() else {
                    return Err(WmpError::Fail);
                };
                let stream_ptr = NonNull::from(&mut stream.stream);
                *pp_wstream.add(i) = Some(stream_ptr);
                let Some(list_streams) = sc.ppWStreamListMemory.as_mut() else {
                    return Err(WmpError::Fail);
                };
                list_streams[i] = Some(stream);
            }
            let Some(bit_io_base) = sc.m_ppBitIO else {
                return Err(WmpError::Fail);
            };
            // Faithful to C `attachISWrite(pSC->m_ppBitIO[i], pSC->ppWStream[i])` (bare call), discarded.
            let _ = attach_is_write(
                (*bit_io_base.as_ptr().add(i))
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr),
                (*pp_wstream.add(i)).map_or(std::ptr::null_mut(), NonNull::as_ptr),
            );
        }
    }

    Ok(())
}

/// Original function: `PutVLWordEsc` at `original/jxrlib/image/encode/strenc.c:506`.
pub unsafe fn put_vlword_esc(pIO: *mut tagBitIOInfo, iEscape: i32, s: usize) {
    if iEscape != 0 {
        debug_assert!(iEscape <= 0xff && iEscape > 0xfc);
        put_bit16(pIO, iEscape as _, 8);
    } else if s < 0xfb00 {
        put_bit16(pIO, s as u32, 16);
    } else {
        let mut t = s >> 16;
        if (t >> 16) == 0 {
            put_bit16(pIO, 0xfb, 8);
        } else {
            t >>= 16;
            put_bit16(pIO, 0xfc, 8);
            put_bit16(pIO, ((t >> 16) & 0xffff) as u32, 16);
            put_bit16(pIO, (t & 0xffff) as u32, 16);
        }
        put_bit16(pIO, (t & 0xffff) as u32, 16);
        put_bit16(pIO, (s & 0xffff) as u32, 16);
    }
}

/// Original function: `writeIndexTableNull` at `original/jxrlib/image/encode/strenc.c:534`.
pub unsafe fn write_index_table_null(sc: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    if sc.cNumBitIO == 0 {
        let Some(header_io) = sc.pIOHeader else {
            return Err(WmpError::Fail);
        };
        let p_io = header_io.as_ptr();
        fill_to_byte(p_io);

        put_vlword_esc(p_io, 0, 4);
        put_bit16(p_io, 111, 8);
        put_bit16(p_io, 255, 8);
        put_bit16(p_io, 1, 16);
    }

    Ok(())
}

/// Original function: `writeIndexTable` at `original/jxrlib/image/encode/strenc.c:553`.
pub unsafe fn write_index_table(sc: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    if sc.cNumBitIO > 0 {
        let Some(header_io) = sc.pIOHeader else {
            return Err(WmpError::Fail);
        };
        let p_io = header_io.as_ptr();
        let mut i_size = [0usize; 4];
        let i_entry = sc
            .cNumBitIO
            .wrapping_mul(sc.WMISCP.cNumOfSliceMinus1H as usize + 1);
        let Some(index_table) = sc.pIndexTableMemory.as_deref_mut() else {
            return Err(WmpError::Fail);
        };
        let Some(index_table) = index_table.get_mut(..i_entry) else {
            return Err(WmpError::Fail);
        };

        put_bit16(p_io, 1, 16);

        if sc.bTileExtraction == 0 {
            for i in (0..=sc.WMISCP.cNumOfSliceMinus1H as usize).rev() {
                let mut k = 0usize;
                while k < sc.cNumBitIO {
                    let loop_count = if sc.WMISCP.bfBitstreamFormat == BitstreamFormat::Frequency
                        && sc.WMISCP.bProgressiveMode != 0
                    {
                        sc.cSB as usize
                    } else {
                        1
                    };
                    for i_size in i_size.iter_mut().take(loop_count) {
                        let entry = sc.cNumBitIO * i + k;
                        if i > 0 {
                            index_table[entry] = index_table[entry]
                                .wrapping_sub(index_table[sc.cNumBitIO * (i - 1) + k]);
                        }
                        *i_size = i_size.wrapping_add(index_table[entry]);
                        k += 1;
                    }
                }
            }
        }

        i_size[3] = i_size[2].wrapping_add(i_size[1]).wrapping_add(i_size[0]);
        i_size[2] = i_size[1].wrapping_add(i_size[0]);
        i_size[1] = i_size[0];
        i_size[0] = 0;

        let mut i = 0usize;
        while i < i_entry {
            let loop_count = if sc.WMISCP.bfBitstreamFormat == BitstreamFormat::Frequency
                && sc.WMISCP.bProgressiveMode != 0
            {
                sc.cSB as usize
            } else {
                1
            };
            let mut l = 0usize;
            while l < loop_count {
                write_is(p_io)?;
                let packet_len = index_table[i];
                put_vlword_esc(
                    p_io,
                    if packet_len <= MINIMUM_PACKET_LENGTH {
                        0xff
                    } else {
                        0
                    },
                    i_size[l],
                );
                i_size[l] = i_size[l].wrapping_add(if packet_len <= MINIMUM_PACKET_LENGTH {
                    0
                } else {
                    packet_len
                });
                l += 1;
                i += 1;
            }
        }

        write_is(p_io)?;
        put_vlword_esc(p_io, 0xff, 0);
        fill_to_byte(p_io);
    }

    Ok(())
}

/// Original function: `copyTo` at `original/jxrlib/image/encode/strenc.c:596`.
pub unsafe fn copy_to(
    pSrc: *mut WMPStream,
    pDst: *mut WMPStream,
    mut iBytes: usize,
) -> Result<(), WmpError> {
    let mut pData = [0_u8; PACKETLENGTH];
    let Some(pSrc) = NonNull::new(pSrc) else {
        return Err(WmpError::Fail);
    };
    let Some(pDst) = NonNull::new(pDst) else {
        return Err(WmpError::Fail);
    };
    let pSrc = pSrc.as_ptr();
    let pDst = pDst.as_ptr();
    let Some(read) = (*pSrc).Read else {
        return Err(WmpError::Fail);
    };
    let Some(write) = (*pDst).Write else {
        return Err(WmpError::Fail);
    };

    if iBytes <= MINIMUM_PACKET_LENGTH {
        return Ok(());
    }

    while iBytes > PACKETLENGTH {
        read(&mut *pSrc, &mut pData)?;
        write(&mut *pDst, &pData)?;
        iBytes -= PACKETLENGTH;
    }
    read(&mut *pSrc, &mut pData[..iBytes])?;
    write(&mut *pDst, &pData[..iBytes])?;

    Ok(())
}

/// Original function: `StrIOEncTerm` at `original/jxrlib/image/encode/strenc.c:616`.
pub unsafe fn str_io_enc_term(sc: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    let pSC = sc as *mut CWMImageStrCodec;
    let Some(header_io) = (*pSC).pIOHeader else {
        return Err(WmpError::Fail);
    };
    let pIO = header_io.as_ptr();

    fill_to_byte(pIO);

    if (*pSC).WMISCP.bVerbose != 0 {
        println!(
            "\n{} horizontal tiles:",
            (*pSC).WMISCP.cNumOfSliceMinus1H + 1
        );
        for i in 0..=(*pSC).WMISCP.cNumOfSliceMinus1H {
            println!(
                "    offset of tile {} in MBs: {}",
                i,
                (*pSC).WMISCP.uiTileY[i as usize],
            );
        }

        println!("\n{} vertical tiles:", (*pSC).WMISCP.cNumOfSliceMinus1V + 1);
        for i in 0..=(*pSC).WMISCP.cNumOfSliceMinus1V {
            println!(
                "    offset of tile {} in MBs: {}",
                i,
                (*pSC).WMISCP.uiTileX[i as usize],
            );
        }

        if (*pSC).WMISCP.bfBitstreamFormat == BitstreamFormat::Spatial {
            println!("\nSpatial order bitstream");
        } else {
            println!("\nFrequency order bitstream");
        }

        if (*pSC).m_param.bIndexTable == 0 {
            println!("\nstreaming mode, no index table.");
        } else if (*pSC).WMISCP.bfBitstreamFormat == BitstreamFormat::Spatial {
            for j in 0..=(*pSC).WMISCP.cNumOfSliceMinus1H {
                for i in 0..=(*pSC).WMISCP.cNumOfSliceMinus1V {
                    let Some(index_table) = (*pSC).pIndexTableMemory.as_deref() else {
                        return Err(WmpError::Fail);
                    };
                    let index =
                        j as usize * ((*pSC).WMISCP.cNumOfSliceMinus1V as usize + 1) + i as usize;
                    println!(
                        "bitstream size for tile ({}, {}): {}.",
                        j, i, index_table[index] as i32,
                    );
                }
            }
        } else {
            for j in 0..=(*pSC).WMISCP.cNumOfSliceMinus1H {
                for i in 0..=(*pSC).WMISCP.cNumOfSliceMinus1V {
                    let Some(index_table) = (*pSC).pIndexTableMemory.as_deref() else {
                        return Err(WmpError::Fail);
                    };
                    let base = (j as usize * ((*pSC).WMISCP.cNumOfSliceMinus1V as usize + 1)
                        + i as usize)
                        * 4;
                    println!(
                        "bitstream size of (DC, LP, AC, FL) for tile ({}, {}): {} {} {} {}.",
                        j,
                        i,
                        index_table[base] as i32,
                        index_table[base + 1] as i32,
                        index_table[base + 2] as i32,
                        index_table[base + 3] as i32,
                    );
                }
            }
        }
    }

    write_index_table(sc)?;

    detach_is_write(pIO)?;

    if (*pSC).cNumBitIO > 0 {
        let Some(bit_io_base) = (*pSC).m_ppBitIO else {
            return Err(WmpError::Fail);
        };
        let Some(pDst) = (*pSC).WMISCP.pWStream.map(NonNull::as_ptr) else {
            return Err(WmpError::Fail);
        };
        let Some(index_table) = (*pSC).pIndexTableMemory.as_deref() else {
            return Err(WmpError::Fail);
        };
        let Some(pp_wstream) = (*pSC).ppWStream.map(NonNull::as_ptr) else {
            return Err(WmpError::Fail);
        };

        for i in 0..(*pSC).cNumBitIO {
            detach_is_write(
                (*bit_io_base.as_ptr().add(i))
                    .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr),
            )?;
        }

        if let Some(streams) = (*pSC).ppWStreamMemory.as_mut() {
            for stream in streams.iter_mut().take((*pSC).cNumBitIO) {
                let Some(stream) = *stream else {
                    continue;
                };
                let Some(set_pos) = (*stream.as_ptr()).SetPos else {
                    return Err(WmpError::Fail);
                };
                set_pos(&mut *stream.as_ptr(), 0)?;
            }
        } else {
            for i in 0..(*pSC).cNumBitIO {
                let Some(stream) = *pp_wstream.add(i) else {
                    continue;
                };
                let Some(set_pos) = (*stream.as_ptr()).SetPos else {
                    return Err(WmpError::Fail);
                };
                set_pos(&mut *stream.as_ptr(), 0)?;
            }
        }

        let loop_count = if (*pSC).WMISCP.bfBitstreamFormat == BitstreamFormat::Frequency
            && (*pSC).WMISCP.bProgressiveMode != 0
        {
            (*pSC).cSB as usize
        } else {
            1
        };
        for l in 0..loop_count {
            let mut k = l;
            for _i in 0..=(*pSC).WMISCP.cNumOfSliceMinus1H as usize {
                for j in 0..=(*pSC).WMISCP.cNumOfSliceMinus1V as usize {
                    if (*pSC).WMISCP.bfBitstreamFormat == BitstreamFormat::Spatial {
                        copy_to(
                            (*pp_wstream.add(j)).map_or(std::ptr::null_mut(), NonNull::as_ptr),
                            pDst,
                            index_table[k],
                        )?;
                        k += 1;
                    } else if (*pSC).WMISCP.bProgressiveMode == 0 {
                        copy_to(
                            (*pp_wstream.add(j * (*pSC).cSB as usize))
                                .map_or(std::ptr::null_mut(), NonNull::as_ptr),
                            pDst,
                            index_table[k],
                        )?;
                        k += 1;
                        if (*pSC).cSB > 1 {
                            copy_to(
                                (*pp_wstream.add(j * (*pSC).cSB as usize + 1))
                                    .map_or(std::ptr::null_mut(), NonNull::as_ptr),
                                pDst,
                                index_table[k],
                            )?;
                            k += 1;
                        }
                        if (*pSC).cSB > 2 {
                            copy_to(
                                (*pp_wstream.add(j * (*pSC).cSB as usize + 2))
                                    .map_or(std::ptr::null_mut(), NonNull::as_ptr),
                                pDst,
                                index_table[k],
                            )?;
                            k += 1;
                        }
                        if (*pSC).cSB > 3 {
                            copy_to(
                                (*pp_wstream.add(j * (*pSC).cSB as usize + 3))
                                    .map_or(std::ptr::null_mut(), NonNull::as_ptr),
                                pDst,
                                index_table[k],
                            )?;
                            k += 1;
                        }
                    } else {
                        copy_to(
                            (*pp_wstream.add(j * (*pSC).cSB as usize + l))
                                .map_or(std::ptr::null_mut(), NonNull::as_ptr),
                            pDst,
                            index_table[k],
                        )?;
                        k += (*pSC).cSB as usize;
                    }
                }
            }
        }

        if (*pSC)
            .cmbHeight
            .wrapping_mul((*pSC).cmbWidth)
            .wrapping_mul((*pSC).WMISCP.cChannel)
            >= MAX_MEMORY_SIZE_IN_WORDS
        {
            let mut cleanup_result: Result<(), WmpError> = Ok(());
            if let (Some(file_streams), Some(temp_file_names)) = (
                (*pSC).ppWStreamFileMemory.as_mut(),
                (*pSC).ppTempFileNameMemory.as_ref(),
            ) {
                for i in 0..(*pSC).cNumBitIO {
                    if let Some(stream) = file_streams[i].take() {
                        drop(stream);
                        if std::fs::remove_file(&temp_file_names[i]).is_err() {
                            cleanup_result = Err(WmpError::Fail);
                        }
                    }
                }
            } else {
                cleanup_result = Err(WmpError::Fail);
            }

            (*pSC).ppTempFileNameMemory = None;
            (*pSC).cTempFileMemory = 0;

            if cleanup_result.is_err() {
                return cleanup_result;
            }
        } else {
            (*pSC).ppWStreamListMemory = None;
        }

        if (*pSC).ppWStreamMemory.take().is_some() {
            (*pSC).ppWStream = None;
            (*pSC).cWStreamMemory = 0;
        }
        (*pSC).ppWStreamFileMemory = None;

        if (*pSC).m_ppBitIOMemory.take().is_some() {
            (*pSC).m_ppBitIO = None;
            (*pSC).cBitIOMemory = 0;
        }
        if (*pSC).pIndexTableMemory.take().is_some() {
            (*pSC).cIndexTableMemory = 0;
        }
    }

    Ok(())
}

/// Original function: `WriteImagePlaneHeader` at `original/jxrlib/image/encode/strenc.c:748`.
pub unsafe fn write_image_plane_header(sc: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    let pSC = sc as *mut CWMImageStrCodec;
    let p_ii = std::ptr::addr_of_mut!((*pSC).WMII);
    let p_scp = std::ptr::addr_of_mut!((*pSC).WMISCP);
    let Some(header_io) = (*pSC).pIOHeader else {
        return Err(WmpError::Fail);
    };
    let p_io = header_io.as_ptr();

    put_bit16(p_io, (*pSC).m_param.cfColorFormat as u32, 3);
    put_bit16(p_io, (*pSC).m_param.bScaledArith as u32, 1);

    put_bit16(p_io, (*p_scp).sbSubband as u32, 4);

    match (*pSC).m_param.cfColorFormat {
        ColorFormat::Yuv420 | ColorFormat::Yuv422 | ColorFormat::Yuv444 => {
            put_bit16(p_io, 0, 4);
            put_bit16(p_io, 0, 4);
        }
        ColorFormat::NComponent => {
            put_bit16(p_io, ((*pSC).m_param.cNumChannels as i32 - 1) as u32, 4);
            put_bit16(p_io, 0, 4);
        }
        _ => {}
    }

    match (*p_ii).bdBitDepth {
        BitDepth::Sixteen | BitDepth::SixteenS => {
            put_bit16(p_io, (*p_scp).nLenMantissaOrShift as u32, 8);
        }
        BitDepth::ThirtyTwo | BitDepth::ThirtyTwoS => {
            if (*p_scp).nLenMantissaOrShift == 0 {
                (*p_scp).nLenMantissaOrShift = 10;
            }
            put_bit16(p_io, (*p_scp).nLenMantissaOrShift as u32, 8);
        }
        BitDepth::ThirtyTwoF => {
            if (*p_scp).nLenMantissaOrShift == 0 {
                (*p_scp).nLenMantissaOrShift = 13;
            }
            put_bit16(p_io, (*p_scp).nLenMantissaOrShift as u32, 8);
            put_bit16(p_io, (*p_scp).nExpBias as u32, 8);
        }
        _ => {}
    }

    put_bit16(
        p_io,
        if ((*pSC).m_param.uQPMode & 1) == 1 {
            0
        } else {
            1
        },
        1,
    );
    if ((*pSC).m_param.uQPMode & 1) == 0 {
        let Some(tile) = (*pSC)
            .pTileMemory
            .as_deref_mut()
            .and_then(|tiles| tiles.get_mut(0))
        else {
            return Err(WmpError::Fail);
        };
        write_quantizer(
            tile.pQuantizerDC.as_mut_ptr(),
            p_io,
            ((*pSC).m_param.uQPMode >> 3) as u8 & 3,
            (*pSC).m_param.cNumChannels,
            0,
        );
    }

    if (*pSC).WMISCP.sbSubband != Subband::DcOnly {
        put_bit16(
            p_io,
            if ((*pSC).m_param.uQPMode & 0x200) == 0 {
                1
            } else {
                0
            },
            1,
        );
        if ((*pSC).m_param.uQPMode & 0x200) != 0 {
            put_bit16(
                p_io,
                if ((*pSC).m_param.uQPMode & 2) == 2 {
                    0
                } else {
                    1
                },
                1,
            );
            if ((*pSC).m_param.uQPMode & 2) == 0 {
                let Some(tile) = (*pSC)
                    .pTileMemory
                    .as_deref_mut()
                    .and_then(|tiles| tiles.get_mut(0))
                else {
                    return Err(WmpError::Fail);
                };
                write_quantizer(
                    tile.pQuantizerLP.as_mut_ptr(),
                    p_io,
                    ((*pSC).m_param.uQPMode >> 5) as u8 & 3,
                    (*pSC).m_param.cNumChannels,
                    0,
                );
            }
        }

        if (*pSC).WMISCP.sbSubband != Subband::NoHighpass {
            put_bit16(
                p_io,
                if ((*pSC).m_param.uQPMode & 0x400) == 0 {
                    1
                } else {
                    0
                },
                1,
            );
            if ((*pSC).m_param.uQPMode & 0x400) != 0 {
                put_bit16(
                    p_io,
                    if ((*pSC).m_param.uQPMode & 4) == 4 {
                        0
                    } else {
                        1
                    },
                    1,
                );
                if ((*pSC).m_param.uQPMode & 4) == 0 {
                    let Some(tile) = (*pSC)
                        .pTileMemory
                        .as_deref_mut()
                        .and_then(|tiles| tiles.get_mut(0))
                    else {
                        return Err(WmpError::Fail);
                    };
                    write_quantizer(
                        tile.pQuantizerHP.as_mut_ptr(),
                        p_io,
                        ((*pSC).m_param.uQPMode >> 7) as u8 & 3,
                        (*pSC).m_param.cNumChannels,
                        0,
                    );
                }
            }
        }
    }

    fill_to_byte(p_io);
    Ok(())
}

/// Original function: `WriteWMIHeader` at `original/jxrlib/image/encode/strenc.c:827`.
pub unsafe fn write_wmi_header(sc: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    let pSC = sc as *mut CWMImageStrCodec;
    let p_ii = std::ptr::addr_of_mut!((*pSC).WMII);
    let p_scp = std::ptr::addr_of_mut!((*pSC).WMISCP);
    let p_core_param = std::ptr::addr_of_mut!((*pSC).m_param);
    let Some(header_io) = (*pSC).pIOHeader else {
        return Err(WmpError::Fail);
    };
    let p_io = header_io.as_ptr();
    let b_abbreviated_header: i32 =
        !((((*p_ii).cWidth + 15) / 16 > 255) || (((*p_ii).cHeight + 15) / 16 > 255)) as i32;

    if (*p_core_param).bTranscode == 0 {
        (*p_core_param).cExtraPixelsTop = 0;
        (*p_core_param).cExtraPixelsLeft = 0;
        (*p_core_param).cExtraPixelsRight = 0;
        (*p_core_param).cExtraPixelsBottom = 0;
    }

    let b_inscribed = ((*p_core_param).cExtraPixelsTop != 0
        || (*p_core_param).cExtraPixelsLeft != 0
        || (*p_core_param).cExtraPixelsBottom != 0
        || (*p_core_param).cExtraPixelsRight != 0) as i32;

    for byte in G_GDI_SIGNATURE {
        let Some(header_io) = (*pSC).pIOHeader else {
            return Err(WmpError::Fail);
        };
        put_bit16(header_io.as_ptr(), byte as u32, 8);
    }

    put_bit16(p_io, CODEC_VERSION, 4);
    if (*pSC).WMISCP.bUseHardTileBoundaries != 0 {
        put_bit16(p_io, CODEC_SUBVERSION_NEWSCALING_HARD_TILES, 4);
    } else {
        put_bit16(p_io, CODEC_SUBVERSION_NEWSCALING_SOFT_TILES, 4);
    }

    put_bit16(
        p_io,
        if (*p_scp).cNumOfSliceMinus1V != 0 || (*p_scp).cNumOfSliceMinus1H != 0 {
            1
        } else {
            0
        },
        1,
    );
    put_bit16(p_io, (*p_scp).bfBitstreamFormat as u32, 1);
    put_bit16(p_io, (*p_ii).oOrientation as u32, 3);
    put_bit16(p_io, (*pSC).m_param.bIndexTable as u32, 1);
    put_bit16(p_io, (*p_scp).olOverlap as u32, 2);

    put_bit16(p_io, b_abbreviated_header as u32, 1);
    put_bit16(p_io, 1, 1);
    put_bit16(p_io, b_inscribed as u32, 1);
    put_bit16(p_io, (*pSC).m_param.bTrimFlexbitsFlag as u32, 1);
    put_bit16(p_io, 0, 1);
    put_bit16(p_io, 0, 2);
    put_bit16(p_io, (*pSC).m_param.bAlphaChannel as u32, 1);

    put_bit16(p_io, (*p_ii).cfColorFormat as u32, 4);
    if BitDepth::One == (*p_ii).bdBitDepth && (*p_scp).bBlackWhite != 0 {
        put_bit16(p_io, BitDepth::OneAlt as u32, 4);
    } else {
        put_bit16(p_io, (*p_ii).bdBitDepth as u32, 4);
    }

    put_bit32(
        p_io,
        ((*p_ii).cWidth - 1) as u32,
        if b_abbreviated_header != 0 { 16 } else { 32 },
    );
    put_bit32(
        p_io,
        ((*p_ii).cHeight - 1) as u32,
        if b_abbreviated_header != 0 { 16 } else { 32 },
    );

    if (*p_scp).cNumOfSliceMinus1V != 0 || (*p_scp).cNumOfSliceMinus1H != 0 {
        put_bit16(p_io, (*p_scp).cNumOfSliceMinus1V, LOG_MAX_TILES);
        put_bit16(p_io, (*p_scp).cNumOfSliceMinus1H, LOG_MAX_TILES);
    }

    for i in 0..(*p_scp).cNumOfSliceMinus1V {
        put_bit16(
            p_io,
            (*p_scp).uiTileX[i as usize + 1].wrapping_sub((*p_scp).uiTileX[i as usize]),
            if b_abbreviated_header != 0 { 8 } else { 16 },
        );
    }
    for i in 0..(*p_scp).cNumOfSliceMinus1H {
        put_bit16(
            p_io,
            (*p_scp).uiTileY[i as usize + 1].wrapping_sub((*p_scp).uiTileY[i as usize]),
            if b_abbreviated_header != 0 { 8 } else { 16 },
        );
    }

    if b_inscribed != 0 {
        put_bit16(p_io, (*p_core_param).cExtraPixelsTop as u32, 6);
        put_bit16(p_io, (*p_core_param).cExtraPixelsLeft as u32, 6);
        put_bit16(p_io, (*p_core_param).cExtraPixelsBottom as u32, 6);
        put_bit16(p_io, (*p_core_param).cExtraPixelsRight as u32, 6);
    }
    fill_to_byte(p_io);

    write_image_plane_header(sc)?;

    Ok(())
}

/// Original function: `StrEncInit` at `original/jxrlib/image/encode/strenc.c:915`.
pub unsafe fn str_enc_init(sc: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    let pSC = sc as *mut CWMImageStrCodec;
    let cf = (*pSC).m_param.cfColorFormat;
    let cf_e = (*pSC).WMII.cfColorFormat;
    let mut i_qp_index_y: u16 = 0;
    let mut i_qp_index_ylp: u16 = 0;
    let mut i_qp_index_yhp: u16 = 0;
    let mut i_qp_index_u: u16 = 0;
    let mut i_qp_index_ulp: u16 = 0;
    let mut i_qp_index_uhp: u16 = 0;
    let mut i_qp_index_v: u16 = 0;
    let mut i_qp_index_vlp: u16 = 0;
    let mut i_qp_index_vhp: u16 = 0;
    let b32bit = std::mem::size_of::<usize>() == 4;

    (*pSC).m_bUVResolutionChange = ((((cf_e == ColorFormat::Rgb
        || cf_e == ColorFormat::Yuv444
        || cf_e == ColorFormat::Cmyk
        || cf_e == ColorFormat::Rgbe)
        && (cf == ColorFormat::Yuv422 || cf == ColorFormat::Yuv420))
        || (cf_e == ColorFormat::Yuv422 && cf == ColorFormat::Yuv420))
        && (*pSC).WMISCP.bYUVData == 0) as i32;

    if (*pSC).m_bUVResolutionChange != 0 {
        let c_size = ((if cf_e == ColorFormat::Yuv422 {
            128
        } else {
            256
        }) + (if cf == ColorFormat::Yuv420 { 32 } else { 0 }))
            * (*pSC).cmbWidth
            + 256;

        if b32bit {
            if (((*pSC).cmbWidth >> 16)
                * ((if cf_e == ColorFormat::Yuv422 {
                    128
                } else {
                    256
                }) + (if cf == ColorFormat::Yuv420 { 32 } else { 0 })))
                & 0xffff0000
                != 0
            {
                return Err(WmpError::Fail);
            }
            if c_size >= 0x3fffffff {
                return Err(WmpError::Fail);
            }
        }
        let mut res_u = Vec::new();
        if res_u.try_reserve_exact(c_size).is_err() {
            return Err(WmpError::Fail);
        }
        res_u.resize(c_size, 0);

        let mut res_v = Vec::new();
        if res_v.try_reserve_exact(c_size).is_err() {
            return Err(WmpError::Fail);
        }
        res_v.resize(c_size, 0);

        let mut res_u = res_u.into_boxed_slice();
        let mut res_v = res_v.into_boxed_slice();
        (*pSC).pResU = NonNull::new(res_u.as_mut_ptr());
        (*pSC).pResV = NonNull::new(res_v.as_mut_ptr());
        (*pSC).cResMemory = c_size;
        (*pSC).pResUMemory = Some(res_u);
        (*pSC).pResVMemory = Some(res_v);
    }

    (*pSC).cTileColumn = 0;
    (*pSC).cTileRow = 0;

    if allocate_tile_info(&mut *pSC).is_err() {
        return Err(WmpError::Fail);
    }

    if (*pSC).m_param.bTranscode == 0 {
        (*pSC).m_param.uQPMode = 0x150;

        (*pSC).m_param.bScaledArith = (!(((*pSC).m_param.uQPMode & 7) == 0
            && ((1 == (*pSC).WMISCP.uiDefaultQPIndex as i32) as i32) <= 1
            && (*pSC).WMISCP.sbSubband == Subband::All
            && (*pSC).m_bUVResolutionChange == 0)
            && (*pSC).WMISCP.bUnscaledArith == 0) as i32;
        if BitDepth::ThirtyTwo == (*pSC).WMII.bdBitDepth
            || BitDepth::ThirtyTwoS == (*pSC).WMII.bdBitDepth
            || BitDepth::ThirtyTwoF == (*pSC).WMII.bdBitDepth
        {
            (*pSC).m_param.bScaledArith = 0;
        }
        (*pSC).m_param.uQPMode |= 0x600;

        i_qp_index_y = if (*pSC).m_param.bAlphaChannel != 0 && (*pSC).m_param.cNumChannels == 1 {
            (*pSC).WMISCP.uiDefaultQPIndexAlpha as u16
        } else {
            (*pSC).WMISCP.uiDefaultQPIndex as u16
        };
        i_qp_index_u = if (*pSC).WMISCP.uiDefaultQPIndexU != 0 {
            (*pSC).WMISCP.uiDefaultQPIndexU as u16
        } else {
            i_qp_index_y
        };
        i_qp_index_v = if (*pSC).WMISCP.uiDefaultQPIndexV != 0 {
            (*pSC).WMISCP.uiDefaultQPIndexV as u16
        } else {
            i_qp_index_y
        };
        i_qp_index_ylp = if (*pSC).m_param.bAlphaChannel != 0 && (*pSC).m_param.cNumChannels == 1 {
            (*pSC).WMISCP.uiDefaultQPIndexAlpha as u16
        } else if (*pSC).WMISCP.uiDefaultQPIndexYLP == 0 {
            (*pSC).WMISCP.uiDefaultQPIndex as u16
        } else {
            (*pSC).WMISCP.uiDefaultQPIndexYLP as u16
        };
        i_qp_index_yhp = if (*pSC).m_param.bAlphaChannel != 0 && (*pSC).m_param.cNumChannels == 1 {
            (*pSC).WMISCP.uiDefaultQPIndexAlpha as u16
        } else if (*pSC).WMISCP.uiDefaultQPIndexYHP == 0 {
            (*pSC).WMISCP.uiDefaultQPIndex as u16
        } else {
            (*pSC).WMISCP.uiDefaultQPIndexYHP as u16
        };
        i_qp_index_ulp = if (*pSC).WMISCP.uiDefaultQPIndexULP != 0 {
            (*pSC).WMISCP.uiDefaultQPIndexULP as u16
        } else {
            i_qp_index_u
        };
        i_qp_index_vlp = if (*pSC).WMISCP.uiDefaultQPIndexVLP != 0 {
            (*pSC).WMISCP.uiDefaultQPIndexVLP as u16
        } else {
            i_qp_index_v
        };
        i_qp_index_uhp = if (*pSC).WMISCP.uiDefaultQPIndexUHP != 0 {
            (*pSC).WMISCP.uiDefaultQPIndexUHP as u16
        } else {
            i_qp_index_u
        };
        i_qp_index_vhp = if (*pSC).WMISCP.uiDefaultQPIndexVHP != 0 {
            (*pSC).WMISCP.uiDefaultQPIndexVHP as u16
        } else {
            i_qp_index_v
        };

        if i_qp_index_y < 2 {
            i_qp_index_y = 0;
        }
        if i_qp_index_ylp < 2 {
            i_qp_index_ylp = 0;
        }
        if i_qp_index_yhp < 2 {
            i_qp_index_yhp = 0;
        }
        if i_qp_index_u < 2 {
            i_qp_index_u = 0;
        }
        if i_qp_index_ulp < 2 {
            i_qp_index_ulp = 0;
        }
        if i_qp_index_uhp < 2 {
            i_qp_index_uhp = 0;
        }
        if i_qp_index_v < 2 {
            i_qp_index_v = 0;
        }
        if i_qp_index_vlp < 2 {
            i_qp_index_vlp = 0;
        }
        if i_qp_index_vhp < 2 {
            i_qp_index_vhp = 0;
        }
    }

    if ((*pSC).m_param.uQPMode & 1) == 0 {
        let Some(tile) = (*pSC)
            .pTileMemory
            .as_deref_mut()
            .and_then(|tiles| tiles.get_mut(0))
        else {
            return Err(WmpError::Fail);
        };
        if allocate_quantizer(
            &mut tile.pQuantizerDC,
            (*pSC).m_param.cNumChannels,
            1,
            &mut tile.pQuantizerDCMemory,
            &mut tile.cQuantizerDCMemory,
        )
        .is_err()
        {
            return Err(WmpError::Fail);
        }
        set_uniform_quantizer(&mut *pSC, 0);
        for i in 0..(*pSC).m_param.cNumChannels {
            let Some(quantizer) = (*pSC)
                .pTileMemory
                .as_deref_mut()
                .and_then(|tiles| tiles.get_mut(0))
                .and_then(|tile| tile.pQuantizerDC[i])
            else {
                return Err(WmpError::Fail);
            };
            if (*pSC).m_param.bTranscode != 0 {
                (*quantizer.as_ptr()).iIndex = (*pSC).m_param.uiQPIndexDC[i];
            } else {
                let index = (if i == 0 {
                    i_qp_index_y
                } else if i == 1 {
                    i_qp_index_u
                } else {
                    i_qp_index_v
                } & 0xff) as u8;
                (*pSC).m_param.uiQPIndexDC[i] = index;
                (*quantizer.as_ptr()).iIndex = index;
            }
        }
        let Some(tile) = (*pSC)
            .pTileMemory
            .as_deref_mut()
            .and_then(|tiles| tiles.get_mut(0))
        else {
            return Err(WmpError::Fail);
        };
        format_quantizer(
            tile.pQuantizerDC.as_mut_ptr(),
            ((*pSC).m_param.uQPMode >> 3) as u8 & 3,
            (*pSC).m_param.cNumChannels,
            0,
            1,
            (*pSC).m_param.bScaledArith,
        );

        for i in 0..(*pSC).m_param.cNumChannels {
            let Some(quantizer) = (*pSC)
                .pTileMemory
                .as_deref_mut()
                .and_then(|tiles| tiles.get_mut(0))
                .and_then(|tile| tile.pQuantizerDC[i])
            else {
                return Err(WmpError::Fail);
            };
            (*quantizer.as_ptr()).iOffset = (*quantizer.as_ptr()).iQP >> 1;
        }
    }

    if (*pSC).WMISCP.sbSubband != Subband::DcOnly {
        if ((*pSC).m_param.uQPMode & 2) == 0 {
            let Some(tile) = (*pSC)
                .pTileMemory
                .as_deref_mut()
                .and_then(|tiles| tiles.get_mut(0))
            else {
                return Err(WmpError::Fail);
            };
            if allocate_quantizer(
                &mut tile.pQuantizerLP,
                (*pSC).m_param.cNumChannels,
                1,
                &mut tile.pQuantizerLPMemory,
                &mut tile.cQuantizerLPMemory,
            )
            .is_err()
            {
                return Err(WmpError::Fail);
            }
            set_uniform_quantizer(&mut *pSC, 1);
            for i in 0..(*pSC).m_param.cNumChannels {
                let Some(quantizer) = (*pSC)
                    .pTileMemory
                    .as_deref_mut()
                    .and_then(|tiles| tiles.get_mut(0))
                    .and_then(|tile| tile.pQuantizerLP[i])
                else {
                    return Err(WmpError::Fail);
                };
                if (*pSC).m_param.bTranscode != 0 {
                    (*quantizer.as_ptr()).iIndex = (*pSC).m_param.uiQPIndexLP[i];
                } else {
                    let index = (if i == 0 {
                        i_qp_index_ylp
                    } else if i == 1 {
                        i_qp_index_ulp
                    } else {
                        i_qp_index_vlp
                    } & 0xff) as u8;
                    (*pSC).m_param.uiQPIndexLP[i] = index;
                    (*quantizer.as_ptr()).iIndex = index;
                }
            }
            let Some(tile) = (*pSC)
                .pTileMemory
                .as_deref_mut()
                .and_then(|tiles| tiles.get_mut(0))
            else {
                return Err(WmpError::Fail);
            };
            format_quantizer(
                tile.pQuantizerLP.as_mut_ptr(),
                ((*pSC).m_param.uQPMode >> 5) as u8 & 3,
                (*pSC).m_param.cNumChannels,
                0,
                1,
                (*pSC).m_param.bScaledArith,
            );
        }

        if (*pSC).WMISCP.sbSubband != Subband::NoHighpass {
            if ((*pSC).m_param.uQPMode & 4) == 0 {
                let Some(tile) = (*pSC)
                    .pTileMemory
                    .as_deref_mut()
                    .and_then(|tiles| tiles.get_mut(0))
                else {
                    return Err(WmpError::Fail);
                };
                if allocate_quantizer(
                    &mut tile.pQuantizerHP,
                    (*pSC).m_param.cNumChannels,
                    1,
                    &mut tile.pQuantizerHPMemory,
                    &mut tile.cQuantizerHPMemory,
                )
                .is_err()
                {
                    return Err(WmpError::Fail);
                }
                set_uniform_quantizer(&mut *pSC, 2);
                for i in 0..(*pSC).m_param.cNumChannels {
                    let Some(quantizer) = (*pSC)
                        .pTileMemory
                        .as_deref_mut()
                        .and_then(|tiles| tiles.get_mut(0))
                        .and_then(|tile| tile.pQuantizerHP[i])
                    else {
                        return Err(WmpError::Fail);
                    };
                    if (*pSC).m_param.bTranscode != 0 {
                        (*quantizer.as_ptr()).iIndex = (*pSC).m_param.uiQPIndexHP[i];
                    } else {
                        let index = (if i == 0 {
                            i_qp_index_yhp
                        } else if i == 1 {
                            i_qp_index_uhp
                        } else {
                            i_qp_index_vhp
                        } & 0xff) as u8;
                        (*pSC).m_param.uiQPIndexHP[i] = index;
                        (*quantizer.as_ptr()).iIndex = index;
                    }
                }
                let Some(tile) = (*pSC)
                    .pTileMemory
                    .as_deref_mut()
                    .and_then(|tiles| tiles.get_mut(0))
                else {
                    return Err(WmpError::Fail);
                };
                format_quantizer(
                    tile.pQuantizerHP.as_mut_ptr(),
                    ((*pSC).m_param.uQPMode >> 7) as u8 & 3,
                    (*pSC).m_param.cNumChannels,
                    0,
                    0,
                    (*pSC).m_param.bScaledArith,
                );
            }
        }
    }

    if allocate_pred_info(&mut *pSC).is_err() {
        return Err(WmpError::Fail);
    }

    if (*pSC).WMISCP.cNumOfSliceMinus1V >= MAX_TILES
        || allocate_coding_context_enc(
            &mut *pSC,
            (*pSC).WMISCP.cNumOfSliceMinus1V as i32 + 1,
            (*pSC).WMISCP.uiTrimFlexBits as i32,
        )
        .is_err()
    {
        return Err(WmpError::Fail);
    }

    if (*pSC).m_bSecondary != 0 {
        let Some(next_sc) = (*pSC).m_pNextSC.map(NonNull::as_ptr) else {
            return Err(WmpError::Fail);
        };
        (*pSC).pIOHeader = (*next_sc).pIOHeader;
        (*pSC).m_ppBitIO = (*next_sc).m_ppBitIO;
        (*pSC).m_ppBitIOMemory = None;
        (*pSC).cBitIOMemory = 0;
        (*pSC).cNumBitIO = (*next_sc).cNumBitIO;
        (*pSC).cSB = (*next_sc).cSB;
        (*pSC).ppWStream = (*next_sc).ppWStream;
        (*pSC).ppWStreamMemory = None;
        (*pSC).cWStreamMemory = 0;
        (*pSC).ppTempFileNameMemory = None;
        (*pSC).cTempFileMemory = 0;
        (*pSC).pIndexTableMemory = None;
        (*pSC).cIndexTableMemory = 0;
        set_bit_io_pointers(&mut *pSC)?;
    } else {
        str_io_enc_init(sc)?;
        set_bit_io_pointers(&mut *pSC)?;
        write_wmi_header(sc)?;
    }

    Ok(())
}

/// Original function: `StrEncTerm` at `original/jxrlib/image/encode/strenc.c:1091`.
pub unsafe fn str_enc_term(ctxSC: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    let ctxSC = ctxSC as *mut CWMImageStrCodec;
    let codecs = [Some(ctxSC), (*ctxSC).m_pNextSC.map(NonNull::as_ptr)];

    for (j, pSC) in codecs.into_iter().flatten().enumerate() {
        if std::mem::size_of::<CWMImageStrCodec>() != (*pSC).cbStruct {
            return Err(WmpError::Fail);
        }

        if (*pSC).m_bUVResolutionChange != 0 {
            if (*pSC).cResMemory > 0 {
                (*pSC).pResUMemory = None;
                (*pSC).pResVMemory = None;
                (*pSC).pResU = None;
                (*pSC).pResV = None;
                (*pSC).cResMemory = 0;
            } else {
            }
        }

        (*pSC).pPredInfoMemory = None;
        (*pSC).cPredInfoMemory = 0;
        (*pSC).PredInfo = [None; MAX_CHANNELS];
        (*pSC).PredInfoPrevRow = [None; MAX_CHANNELS];

        if j == 0 {
            str_io_enc_term(&mut *pSC)?;
        }

        (*pSC).pCodingContextMemory = None;
        (*pSC).cNumCodingContext = 0;

        (*pSC).pTileMemory = None;
        (*pSC).cTileMemory = 0;

        (*pSC).WMISCP.nExpBias = (*pSC).WMISCP.nExpBias.wrapping_sub(128u8 as i8);
    }

    Ok(())
}

/// Original function: `setUniformTiling` at `original/jxrlib/image/encode/strenc.c:1125`.
pub unsafe fn set_uniform_tiling(tile: &mut [u32], mut cNumTile: u32, cNumMB: u32) -> u32 {
    while cNumMB.wrapping_add(cNumTile).wrapping_sub(1) / cNumTile > 65535 {
        cNumTile = cNumTile.wrapping_add(1);
    }

    let mut remaining_tiles = cNumTile;
    let mut remaining_mbs = cNumMB;
    for tile_width in tile.iter_mut().take(cNumTile.saturating_sub(1) as usize) {
        *tile_width = remaining_mbs.wrapping_add(remaining_tiles).wrapping_sub(1) / remaining_tiles;
        remaining_mbs = remaining_mbs.wrapping_sub(*tile_width);
        remaining_tiles = remaining_tiles.wrapping_sub(1);
    }

    cNumTile
}

/// Original function: `validateTiling` at `original/jxrlib/image/encode/strenc.c:1140`.
pub unsafe fn validate_tiling(tile: &mut [u32], mut cNumTile: u32, cNumMB: u32) -> u32 {
    if cNumTile == 0 {
        cNumTile = 1;
    }
    if cNumTile > cNumMB {
        cNumTile = 1;
    }
    if cNumTile > MAX_TILES {
        cNumTile = MAX_TILES;
    }

    let mut c_mbs: u32 = 0;
    for i in 0..cNumTile.saturating_sub(1) {
        if tile[i as usize] == 0 || tile[i as usize] > 65535 {
            cNumTile = set_uniform_tiling(tile, cNumTile, cNumMB);
            break;
        }

        c_mbs = c_mbs.wrapping_add(tile[i as usize]);

        if c_mbs >= cNumMB {
            cNumTile = i + 1;
            break;
        }
    }

    if cNumMB.wrapping_sub(c_mbs) > 65536 {
        cNumTile = set_uniform_tiling(tile, cNumTile, cNumMB);
    }

    for i in 1..cNumTile as usize {
        tile[i] = tile[i].wrapping_add(tile[i - 1]);
    }

    for i in (1..cNumTile as usize).rev() {
        tile[i] = tile[i - 1];
    }
    tile[0] = 0;

    cNumTile
}

/// Original function: `ValidateArgs` at `original/jxrlib/image/encode/strenc.c:1181`.
pub unsafe fn validate_args(
    pII: *mut tagCWMImageInfo,
    pSCP: *mut tagCWMIStrCodecParam,
) -> Result<(), WmpError> {
    let mut b_too_narrow_tile: i32 = 0;

    if (*pII).cWidth > (1 << 28)
        || (*pII).cHeight > (1 << 28)
        || (*pII).cWidth == 0
        || (*pII).cHeight == 0
    {
        println!("Unsurpported image size!");
        return Err(WmpError::Fail);
    }

    if ((*pSCP).cfColorFormat == ColorFormat::Yuv420
        || (*pSCP).cfColorFormat == ColorFormat::Yuv422)
        && (*pSCP).olOverlap == Overlap::Two
        && ((((*pII).cWidth as u32 + 15) >> 4) as i32) < 2
    {
        println!(
            "Image width must be at least 2 MB wide for subsampled chroma and two levels of overlap!"
        );
        return Err(WmpError::Fail);
    }

    if (*pSCP).sbSubband == Subband::Isolated || (*pSCP).sbSubband >= Subband::Max {
        (*pSCP).sbSubband = Subband::All;
    }

    if (*pII).bdBitDepth == BitDepth::Five
        && ((*pII).cfColorFormat != ColorFormat::Rgb
            || (*pII).cBitsPerUnit != 16
            || (*pII).cLeadingPadding != 0)
    {
        println!("Unsupported BD_5 image format!");
        return Err(WmpError::Fail);
    }
    if (*pII).bdBitDepth == BitDepth::FiveSixFive
        && ((*pII).cfColorFormat != ColorFormat::Rgb
            || (*pII).cBitsPerUnit != 16
            || (*pII).cLeadingPadding != 0)
    {
        println!("Unsupported BD_565 image format!");
        return Err(WmpError::Fail);
    }
    if (*pII).bdBitDepth == BitDepth::Ten
        && ((*pII).cfColorFormat != ColorFormat::Rgb
            || (*pII).cBitsPerUnit != 32
            || (*pII).cLeadingPadding != 0)
    {
        println!("Unsupported BD_10 image format!");
        return Err(WmpError::Fail);
    }

    if ((*pII).bdBitDepth == BitDepth::Five
        || (*pII).bdBitDepth == BitDepth::FiveSixFive
        || (*pII).bdBitDepth == BitDepth::Ten)
        && ((*pSCP).cfColorFormat != ColorFormat::Yuv420
            && (*pSCP).cfColorFormat != ColorFormat::Yuv422
            && (*pSCP).cfColorFormat != ColorFormat::YOnly)
    {
        (*pSCP).cfColorFormat = ColorFormat::Yuv444;
    }

    if BitDepth::One == (*pII).bdBitDepth {
        if (*pII).cfColorFormat != ColorFormat::YOnly {
            println!("BD_1 image must be black-and white!");
            return Err(WmpError::Fail);
        }
        (*pSCP).cfColorFormat = ColorFormat::YOnly;
    }

    if (*pSCP).bdBitDepth != BitDepthLayout::Long {
        (*pSCP).bdBitDepth = BitDepthLayout::Long;
    }

    let Some(alpha_mode) = AlphaMode::from_u8((*pSCP).uAlphaMode) else {
        println!("Invalid alpha mode!");
        return Err(WmpError::Fail);
    };

    if matches!(alpha_mode, AlphaMode::Planar | AlphaMode::Only)
        && ((*pII).cfColorFormat == ColorFormat::Yuv420
            || (*pII).cfColorFormat == ColorFormat::Yuv422
            || (*pII).bdBitDepth == BitDepth::Five
            || (*pII).bdBitDepth == BitDepth::Ten
            || (*pII).bdBitDepth == BitDepth::One)
    {
        println!("Alpha is not supported for this pixel format!");
        return Err(WmpError::Fail);
    }

    if ((*pSCP).cfColorFormat == ColorFormat::Yuv420
        || (*pSCP).cfColorFormat == ColorFormat::Yuv422)
        && ((*pII).bdBitDepth == BitDepth::SixteenF
            || (*pII).bdBitDepth == BitDepth::ThirtyTwoF
            || (*pII).cfColorFormat == ColorFormat::Rgbe)
    {
        println!("Float or RGBE images must be encoded with YUV 444!");
        return Err(WmpError::Fail);
    }

    (*pSCP).cNumOfSliceMinus1V = validate_tiling(
        &mut (*pSCP).uiTileX,
        (*pSCP).cNumOfSliceMinus1V + 1,
        ((*pII).cWidth as u32 + 15) >> 4,
    ) - 1;
    (*pSCP).cNumOfSliceMinus1H = validate_tiling(
        &mut (*pSCP).uiTileY,
        (*pSCP).cNumOfSliceMinus1H + 1,
        ((*pII).cHeight as u32 + 15) >> 4,
    ) - 1;

    if (*pSCP).bUseHardTileBoundaries != 0
        && ((*pSCP).cfColorFormat == ColorFormat::Yuv420
            || (*pSCP).cfColorFormat == ColorFormat::Yuv422)
        && (*pSCP).olOverlap == Overlap::Two
    {
        for i in 1..=(*pSCP).cNumOfSliceMinus1V as usize {
            if ((*pSCP).uiTileX[i].wrapping_sub((*pSCP).uiTileX[i - 1]) as i32) < 2 {
                b_too_narrow_tile = 1;
                break;
            }
        }
        if (((((*pII).cWidth as u32 + 15) >> 4)
            .wrapping_sub((*pSCP).uiTileX[(*pSCP).cNumOfSliceMinus1V as usize])) as i32)
            < 2
        {
            b_too_narrow_tile = 1;
        }
    }
    if b_too_narrow_tile != 0 {
        println!(
            "Tile width must be at least 2 MB wide for hard tiles, subsampled chroma, and two levels of overlap!"
        );
        return Err(WmpError::Fail);
    }

    if (*pSCP).cChannel > MAX_CHANNELS {
        return Err(WmpError::Fail);
    }
    if (*pII).cfColorFormat == ColorFormat::NComponent && (*pSCP).cChannel == 0 {
        return Err(WmpError::Fail);
    }

    if ((*pII).cfColorFormat == ColorFormat::YOnly && (*pSCP).cfColorFormat != ColorFormat::YOnly)
        || ((*pSCP).cfColorFormat == ColorFormat::Yuv422
            && ((*pII).cfColorFormat == ColorFormat::Yuv420
                || (*pII).cfColorFormat == ColorFormat::YOnly))
        || ((*pSCP).cfColorFormat == ColorFormat::Yuv444
            && ((*pII).cfColorFormat == ColorFormat::Yuv422
                || (*pII).cfColorFormat == ColorFormat::Yuv420
                || (*pII).cfColorFormat == ColorFormat::YOnly))
    {
        (*pSCP).cfColorFormat = (*pII).cfColorFormat;
    } else if (*pII).cfColorFormat == ColorFormat::NComponent {
        (*pSCP).cfColorFormat = ColorFormat::NComponent;
    }
    if ColorFormat::Cmyk == (*pII).cfColorFormat && (*pSCP).cfColorFormat == ColorFormat::NComponent
    {
        (*pSCP).cfColorFormat = ColorFormat::Cmyk;
    }

    if (*pSCP).cfColorFormat != ColorFormat::NComponent {
        if (*pSCP).cfColorFormat == ColorFormat::YOnly {
            (*pSCP).cChannel = 1;
        } else if (*pSCP).cfColorFormat == ColorFormat::Cmyk {
            (*pSCP).cChannel = 4;
        } else {
            (*pSCP).cChannel = 3;
        }
    }

    if (*pSCP).sbSubband >= Subband::Max {
        (*pSCP).sbSubband = Subband::All;
    }

    (*pII).cChromaCenteringX = 0;
    (*pII).cChromaCenteringY = 0;

    Ok(())
}

/// Original function: `InitializeStrEnc` at `original/jxrlib/image/encode/strenc.c:1308`.
pub unsafe fn initialize_str_enc(
    pSC: *mut CWMImageStrCodec,
    pII: *const tagCWMImageInfo,
    pSCP: *const tagCWMIStrCodecParam,
) {
    (*pSC).cbStruct = std::mem::size_of::<CWMImageStrCodec>();
    (*pSC).WMII = *pII;
    (*pSC).WMISCP = (*pSCP).clone();

    if (*pSC).WMISCP.nExpBias == 0 {
        (*pSC).WMISCP.nExpBias = (4u8.wrapping_add(128)) as i8;
    }
    (*pSC).WMISCP.nExpBias = (*pSC).WMISCP.nExpBias.wrapping_add(128u8 as i8);

    (*pSC).cRow = 0;
    (*pSC).cColumn = 0;

    (*pSC).cmbWidth = ((*pSC).WMII.cWidth + 15) / 16;
    (*pSC).cmbHeight = ((*pSC).WMII.cHeight + 15) / 16;

    (*pSC).Load = Some(input_mb_row);
    (*pSC).Quantize = Some(quantize_macroblock);
    (*pSC).ProcessTopLeft = Some(process_macroblock);
    (*pSC).ProcessTop = Some(process_macroblock);
    (*pSC).ProcessTopRight = Some(process_macroblock);
    (*pSC).ProcessLeft = Some(process_macroblock);
    (*pSC).ProcessCenter = Some(process_macroblock);
    (*pSC).ProcessRight = Some(process_macroblock);
    (*pSC).ProcessBottomLeft = Some(process_macroblock);
    (*pSC).ProcessBottom = Some(process_macroblock);
    (*pSC).ProcessBottomRight = Some(process_macroblock);

    (*pSC).m_pNextSC = None;
    (*pSC).m_bSecondary = 0;
}

/// Original function: `ImageStrEncInit` at `original/jxrlib/image/encode/strenc.c:1345`.
pub unsafe fn image_str_enc_init(
    pII: *mut tagCWMImageInfo,
    pSCP: *mut tagCWMIStrCodecParam,
    pctxSC: &mut Option<Box<CWMImageStrCodec>>,
) -> Result<(), WmpError> {
    static CB_CHANNELS: [usize; BitDepthLayout::Max as usize] = [2, 4];

    let cbChannel: usize;
    let cblkChroma: usize;
    let mut i: usize;
    let mut cbMacBlockStride: usize;
    let cbMacBlockChroma: usize;
    let cMacBlock: usize;

    let mut sc_storage = Box::<CWMImageStrCodec>::default();
    let pSC: *mut CWMImageStrCodec = sc_storage.as_mut();
    let mut pb: *mut u8;
    let mut cb: usize;
    let b32bit = std::mem::size_of::<usize>() == 4;
    let mut next_sc_storage: Option<Box<CWMImageStrCodec>> = None;

    if validate_args(pII, pSCP).is_err() {
        return Err(WmpError::Fail);
    }

    *pctxSC = None;

    cbChannel = CB_CHANNELS[(*pSCP).bdBitDepth as usize];
    cblkChroma = CBLK_CHROMAS[(*pSCP).cfColorFormat as usize] as usize;
    cbMacBlockStride = cbChannel * 16 * 16;
    cbMacBlockChroma = cbChannel * 16 * cblkChroma;
    cMacBlock = ((*pII).cWidth + 15) / 16;

    cb = std::mem::size_of::<CWMImageStrCodec>()
        + (128 - 1)
        + (PACKETLENGTH * 4 - 1)
        + (PACKETLENGTH * 2)
        + std::mem::size_of::<tagBitIOInfo>();
    i = cbMacBlockStride + cbMacBlockChroma * ((*pSCP).cChannel - 1);
    if b32bit {
        if (((cMacBlock >> 15) * i) & 0xffff0000) != 0 {
            return Err(WmpError::Fail);
        }
    }
    i *= cMacBlock * 2;
    cb += i;

    let codec_words = cb.div_ceil(std::mem::size_of::<usize>());
    let mut codec_vec = Vec::new();
    if codec_vec.try_reserve_exact(codec_words).is_err() {
        return Err(WmpError::Fail);
    }
    codec_vec.resize(codec_words, 0usize);
    let mut codec_memory = codec_vec.into_boxed_slice();
    pb = codec_memory.as_mut_ptr().cast::<u8>();
    (*pSC).cCodecMemory = codec_words;
    (*pSC).pCodecMemory = Some(codec_memory);

    (*pSC).m_fMeasurePerf = (*pSCP).fMeasurePerf;
    if (*pSC).m_fMeasurePerf != 0 {
        (*pSC).m_ptEndToEndPerf = perf_timer_new();
        (*pSC).m_ptEncDecPerf = perf_timer_new();
        perf_timer_start((*pSC).m_ptEndToEndPerf.as_mut());
        perf_timer_start((*pSC).m_ptEncDecPerf.as_mut());
        perf_timer_copy_start_time(
            (*pSC).m_ptEncDecPerf.as_mut(),
            (*pSC).m_ptEndToEndPerf.as_ref(),
        );
    }

    let Some(alpha_mode) = AlphaMode::from_u8((*pSCP).uAlphaMode) else {
        return Err(WmpError::Fail);
    };
    (*pSC).m_param.cfColorFormat = (*pSCP).cfColorFormat;
    (*pSC).m_param.bAlphaChannel = (alpha_mode == AlphaMode::Only) as i32;
    (*pSC).m_param.cNumChannels = (*pSCP).cChannel;
    (*pSC).m_param.cExtraPixelsBottom = 0;
    (*pSC).m_param.cExtraPixelsTop = (*pSC).m_param.cExtraPixelsBottom;
    (*pSC).m_param.cExtraPixelsLeft = (*pSC).m_param.cExtraPixelsTop;
    (*pSC).m_param.cExtraPixelsRight = (*pSC).m_param.cExtraPixelsLeft;

    (*pSC).cbChannel = cbChannel;

    (*pSC).bTileExtraction = 0;
    (*pSC).m_param.bTranscode = (*pSC).bTileExtraction;

    initialize_str_enc(pSC, pII, pSCP);

    pb = ((pb as usize + 128 - 1) & !(128 - 1)) as *mut u8;
    for i_channel in 0..(*pSC).m_param.cNumChannels {
        (*pSC).a0MBbuffer[i_channel] = NonNull::new(pb.cast::<i32>());
        pb = pb.add(cbMacBlockStride * (*pSC).cmbWidth);
        (*pSC).a1MBbuffer[i_channel] = NonNull::new(pb.cast::<i32>());
        pb = pb.add(cbMacBlockStride * (*pSC).cmbWidth);
        cbMacBlockStride = cbMacBlockChroma;
    }

    pb = (((pb as usize + PACKETLENGTH * 4 - 1) & !(PACKETLENGTH * 4 - 1)) as *mut u8)
        .add(PACKETLENGTH * 2);
    (*pSC).pIOHeader = NonNull::new(pb.cast::<tagBitIOInfo>());

    str_enc_init(&mut *pSC)?;

    if (*pSC).m_param.bAlphaChannel != 0 {
        cbMacBlockStride = cbChannel * 16 * 16;

        cb = std::mem::size_of::<CWMImageStrCodec>() + (128 - 1) + cbMacBlockStride * cMacBlock * 2;
        let next_codec_words = cb.div_ceil(std::mem::size_of::<usize>());
        next_sc_storage = Some(Box::<CWMImageStrCodec>::default());
        let Some(next_sc) = next_sc_storage.as_mut() else {
            return Err(WmpError::Fail);
        };
        let pNextSC = next_sc.as_mut();
        let mut next_codec_vec = Vec::new();
        if next_codec_vec.try_reserve_exact(next_codec_words).is_err() {
            return Err(WmpError::Fail);
        }
        next_codec_vec.resize(next_codec_words, 0usize);
        let mut next_codec_memory = next_codec_vec.into_boxed_slice();
        pb = next_codec_memory.as_mut_ptr().cast::<u8>();
        (*pNextSC).cCodecMemory = next_codec_words;
        (*pNextSC).pCodecMemory = Some(next_codec_memory);

        (*pNextSC).m_param.cfColorFormat = ColorFormat::YOnly;
        (*pNextSC).m_param.cNumChannels = 1;
        (*pNextSC).m_param.bAlphaChannel = 1;
        (*pNextSC).cbChannel = cbChannel;

        initialize_str_enc(pNextSC, pII, pSCP);

        pb = ((pb as usize + 128 - 1) & !(128 - 1)) as *mut u8;
        (*pNextSC).a0MBbuffer[0] = NonNull::new(pb.cast::<i32>());
        pb = pb.add(cbMacBlockStride * (*pNextSC).cmbWidth);
        (*pNextSC).a1MBbuffer[0] = NonNull::new(pb.cast::<i32>());

        (*pNextSC).pIOHeader = (*pSC).pIOHeader;

        (*pNextSC).m_pNextSC = NonNull::new(pSC);
        (*pNextSC).m_bSecondary = 1;

        str_enc_init(pNextSC)?;

        write_image_plane_header(pNextSC)?;
    }

    if let Some(mut next_sc) = next_sc_storage {
        (*pSC).m_pNextSC = Some(NonNull::from(next_sc.as_mut()));
        (*pSC).pNextSCMemory = Some(next_sc);
    } else {
        (*pSC).m_pNextSC = None;
    }
    write_index_table_null(&mut *pSC)?;
    str_enc_opt(&mut *pSC);

    if (*pSC).m_fMeasurePerf != 0 {
        perf_timer_stop((*pSC).m_ptEncDecPerf.as_mut());
    }
    *pctxSC = Some(sc_storage);
    Ok(())
}

/// Original function: `ImageStrEncEncode` at `original/jxrlib/image/encode/strenc.c:1499`.
pub unsafe fn image_str_enc_encode(
    ctxSC: *mut CWMImageStrCodec,
    pBI: *const tagCWMImageBufferInfo,
) -> Result<(), WmpError> {
    let pSC = ctxSC;
    let pNextSC = (*pSC).m_pNextSC.map(NonNull::as_ptr);
    let Some(buffer_info) = NonNull::new(pBI as *mut tagCWMImageBufferInfo) else {
        return Err(WmpError::Fail);
    };
    let ProcessLeft: ImageDataProc;
    let ProcessCenter: ImageDataProc;
    let ProcessRight: ImageDataProc;

    if std::mem::size_of::<CWMImageStrCodec>() != (*pSC).cbStruct {
        return Err(WmpError::Fail);
    }

    if (*pSC).m_fMeasurePerf != 0 {
        perf_timer_start((*pSC).m_ptEncDecPerf.as_mut());
    }

    (*pSC).WMIBI = *buffer_info.as_ptr();
    (*pSC).cColumn = 0;
    init_mr_ptr(&mut *pSC);
    if let Some(pNextSC) = pNextSC {
        (*pNextSC).WMIBI = *buffer_info.as_ptr();
    }

    if 0 == (*pSC).cRow {
        let Some(process_left) = (*pSC).ProcessTopLeft else {
            return Err(WmpError::Fail);
        };
        let Some(process_center) = (*pSC).ProcessTop else {
            return Err(WmpError::Fail);
        };
        let Some(process_right) = (*pSC).ProcessTopRight else {
            return Err(WmpError::Fail);
        };
        ProcessLeft = process_left;
        ProcessCenter = process_center;
        ProcessRight = process_right;
    } else {
        let Some(process_left) = (*pSC).ProcessLeft else {
            return Err(WmpError::Fail);
        };
        let Some(process_center) = (*pSC).ProcessCenter else {
            return Err(WmpError::Fail);
        };
        let Some(process_right) = (*pSC).ProcessRight else {
            return Err(WmpError::Fail);
        };
        ProcessLeft = process_left;
        ProcessCenter = process_center;
        ProcessRight = process_right;
    }

    let Some(load) = (*pSC).Load else {
        return Err(WmpError::Fail);
    };
    if load(&mut *pSC).is_err() {
        return Err(WmpError::Fail);
    }
    if ProcessLeft(&mut *pSC).is_err() {
        return Err(WmpError::Fail);
    }
    advance_mr_ptr(&mut *pSC);

    for column in 1..(*pSC).cmbWidth {
        (*pSC).cColumn = column;
        if ProcessCenter(&mut *pSC).is_err() {
            return Err(WmpError::Fail);
        }
        advance_mr_ptr(&mut *pSC);
    }
    (*pSC).cColumn = (*pSC).cmbWidth;

    if ProcessRight(&mut *pSC).is_err() {
        return Err(WmpError::Fail);
    }
    if (*pSC).cRow != 0 {
        advance_one_mb_row(&mut *pSC);
    }

    (*pSC).cRow += 1;
    swap_mr_ptr(&mut *pSC);

    if (*pSC).m_fMeasurePerf != 0 {
        perf_timer_stop((*pSC).m_ptEncDecPerf.as_mut());
    }
    Ok(())
}

/// Original function: `ImageStrEncTerm` at `original/jxrlib/image/encode/strenc.c:1561`.
pub unsafe fn image_str_enc_term(mut ctxSC: Box<CWMImageStrCodec>) -> Result<(), WmpError> {
    let pSC = ctxSC.as_mut() as *mut CWMImageStrCodec;

    if std::mem::size_of::<CWMImageStrCodec>() != (*pSC).cbStruct {
        return Err(WmpError::Fail);
    }
    if (*pSC).cCodecMemory == 0 {
        return Err(WmpError::Fail);
    }

    if (*pSC).m_fMeasurePerf != 0 {
        perf_timer_start((*pSC).m_ptEncDecPerf.as_mut());
    }
    (*pSC).cColumn = 0;
    init_mr_ptr(&mut *pSC);

    let Some(process_bottom_left) = (*pSC).ProcessBottomLeft else {
        return Err(WmpError::Fail);
    };
    let Some(process_bottom) = (*pSC).ProcessBottom else {
        return Err(WmpError::Fail);
    };
    let Some(process_bottom_right) = (*pSC).ProcessBottomRight else {
        return Err(WmpError::Fail);
    };

    let _ = process_bottom_left(&mut *pSC);
    advance_mr_ptr(&mut *pSC);

    for column in 1..(*pSC).cmbWidth {
        (*pSC).cColumn = column;
        let _ = process_bottom(&mut *pSC);
        advance_mr_ptr(&mut *pSC);
    }
    (*pSC).cColumn = (*pSC).cmbWidth;

    let _ = process_bottom_right(&mut *pSC);

    str_enc_term(&mut *pSC)?;

    if (*pSC).m_fMeasurePerf != 0 {
        perf_timer_stop((*pSC).m_ptEncDecPerf.as_mut());
        perf_timer_stop((*pSC).m_ptEndToEndPerf.as_mut());
        output_perf_timer_report(&mut *pSC);
        perf_timer_delete(&mut (*pSC).m_ptEncDecPerf);
        perf_timer_delete(&mut (*pSC).m_ptEndToEndPerf);
    }

    (*pSC).m_pNextSC = None;
    (*pSC).pNextSCMemory = None;
    Ok(())
}

/// Original function: `downsampleUV` at `original/jxrlib/image/encode/strenc.c:1604`.
pub unsafe fn downsample_uv(sc: &mut CWMImageStrCodec) {
    let cfInt = sc.m_param.cfColorFormat;
    let cfExt = sc.WMII.cfColorFormat;
    let mut pSrc: *mut i32;
    let mut pDst: *mut i32;
    let mut d0: i32;
    let mut d1: i32;
    let mut d2: i32;
    let mut d3: i32;
    let mut d4: i32;
    for iChannel in 1..3 {
        if cfExt != ColorFormat::Yuv422 {
            let cShift = if cfInt == ColorFormat::Yuv422 { 1 } else { 0 };

            pSrc = if iChannel == 1 {
                let Some(res_u) = sc.pResU else {
                    return;
                };
                res_u.as_ptr()
            } else {
                let Some(res_v) = sc.pResV else {
                    return;
                };
                res_v.as_ptr()
            };
            pDst = if cfInt == ColorFormat::Yuv422 {
                let Some(p1_mb_buffer) = sc.p1MBbuffer[iChannel] else {
                    return;
                };
                p1_mb_buffer.as_ptr()
            } else {
                pSrc
            };

            for iRow in 0..16 {
                d0 = *pSrc.add(idx_cc[iRow][2] as usize);
                d4 = d0;
                d1 = *pSrc.add(idx_cc[iRow][1] as usize);
                d3 = d1;
                d2 = *pSrc.add(idx_cc[iRow][0] as usize);

                let mut iColumn = 0;
                while iColumn + 2 < sc.cmbWidth * 16 {
                    *pDst.add(
                        ((iColumn >> 4) << (8 - cShift))
                            + idx_cc[iRow][(iColumn & 15) >> cShift] as usize,
                    ) = (((d1 + d2 + d3) << 2) + (d2 << 1) + d0 + d4 + 8) >> 4;
                    d0 = d2;
                    d1 = d3;
                    d2 = d4;
                    d3 = *pSrc.add(
                        (((iColumn + 3) >> 4) << 8) + idx_cc[iRow][(iColumn + 3) & 0xf] as usize,
                    );
                    d4 = *pSrc.add(
                        (((iColumn + 4) >> 4) << 8) + idx_cc[iRow][(iColumn + 4) & 0xf] as usize,
                    );
                    iColumn += 2;
                }

                d4 = d2;
                *pDst.add(
                    ((iColumn >> 4) << (8 - cShift))
                        + idx_cc[iRow][(iColumn & 15) >> cShift] as usize,
                ) = (((d1 + d2 + d3) << 2) + (d2 << 1) + d0 + d4 + 8) >> 4;
            }
        }

        if cfInt == ColorFormat::Yuv420 {
            let cShift = if cfExt == ColorFormat::Yuv422 { 0 } else { 1 };
            let mut mbOff: usize;
            let mut pxOff: usize;

            let Some(p1_mb_buffer) = sc.p1MBbuffer[iChannel] else {
                return;
            };
            pDst = p1_mb_buffer.as_ptr();
            pSrc = if iChannel == 1 {
                let Some(res_u) = sc.pResU else {
                    return;
                };
                res_u.as_ptr()
            } else {
                let Some(res_v) = sc.pResV else {
                    return;
                };
                res_v.as_ptr()
            };
            let Some(row0) = NonNull::new(
                pSrc.add(sc.cmbWidth << if cfExt == ColorFormat::Yuv422 { 7 } else { 8 }),
            ) else {
                return;
            };
            let Some(row1) = NonNull::new(row0.as_ptr().add(sc.cmbWidth * 8)) else {
                return;
            };
            let Some(row2) = NonNull::new(row1.as_ptr().add(sc.cmbWidth * 8)) else {
                return;
            };
            let Some(row3) = NonNull::new(row2.as_ptr().add(sc.cmbWidth * 8)) else {
                return;
            };
            let row_history = [Some(row0), Some(row1), Some(row2), Some(row3)];

            for iColumn in 0..sc.cmbWidth * 8 {
                mbOff = (iColumn >> 3) << (7 + cShift);
                pxOff = (iColumn & 7) << cShift;

                if sc.cRow == 0 {
                    d0 = *pSrc.add(mbOff + idx_cc[2][pxOff] as usize);
                    d4 = d0;
                    d1 = *pSrc.add(mbOff + idx_cc[1][pxOff] as usize);
                    d3 = d1;
                    d2 = *pSrc.add(mbOff + idx_cc[0][pxOff] as usize);
                } else {
                    let (Some(row0), Some(row1), Some(row2), Some(row3)) = (
                        row_history[0],
                        row_history[1],
                        row_history[2],
                        row_history[3],
                    ) else {
                        return;
                    };
                    d0 = *row0.as_ptr().add(iColumn);
                    d1 = *row1.as_ptr().add(iColumn);
                    d2 = *row2.as_ptr().add(iColumn);
                    d3 = *row3.as_ptr().add(iColumn);
                    d4 = *pSrc.add(mbOff + idx_cc[0][pxOff] as usize);
                    let Some(p0_mb_buffer) = sc.p0MBbuffer[iChannel] else {
                        return;
                    };
                    *p0_mb_buffer
                        .as_ptr()
                        .add(((iColumn >> 3) << 6) + idx_cc_420[7][iColumn & 7] as usize) =
                        (((d1 + d2 + d3) << 2) + (d2 << 1) + d0 + d4 + 8) >> 4;

                    d0 = *row2.as_ptr().add(iColumn);
                    d1 = *row3.as_ptr().add(iColumn);
                    d2 = *pSrc.add(mbOff + idx_cc[0][pxOff] as usize);
                    d3 = *pSrc.add(mbOff + idx_cc[1][pxOff] as usize);
                    d4 = *pSrc.add(mbOff + idx_cc[2][pxOff] as usize);
                }

                let mut iRow = 0;
                while iRow < 12 {
                    *pDst
                        .add(((iColumn >> 3) << 6) + idx_cc_420[iRow >> 1][iColumn & 7] as usize) =
                        (((d1 + d2 + d3) << 2) + (d2 << 1) + d0 + d4 + 8) >> 4;
                    d0 = d2;
                    d1 = d3;
                    d2 = d4;
                    d3 = *pSrc.add(mbOff + idx_cc[iRow + 3][pxOff] as usize);
                    d4 = *pSrc.add(mbOff + idx_cc[iRow + 4][pxOff] as usize);
                    iRow += 2;
                }

                *pDst.add(((iColumn >> 3) << 6) + idx_cc_420[6][iColumn & 7] as usize) =
                    (((d1 + d2 + d3) << 2) + (d2 << 1) + d0 + d4 + 8) >> 4;
                d0 = d2;
                d1 = d3;
                d2 = d4;
                d3 = *pSrc.add(mbOff + idx_cc[iRow + 3][pxOff] as usize);

                if sc.cRow + 1 == sc.cmbHeight {
                    d4 = d2;
                    *pDst.add(((iColumn >> 3) << 6) + idx_cc_420[7][iColumn & 7] as usize) =
                        (((d1 + d2 + d3) << 2) + (d2 << 1) + d0 + d4 + 8) >> 4;
                } else {
                    for iRow in 0..4 {
                        let Some(row) = row_history[iRow] else {
                            return;
                        };
                        *row.as_ptr().add(iColumn) =
                            *pSrc.add(mbOff + idx_cc[iRow + 12][pxOff] as usize);
                    }
                }
            }
        }
    }
}

/// Original function: `padHorizontally` at `original/jxrlib/image/encode/strenc.c:1686`.
pub unsafe fn pad_horizontally(sc: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    if sc.WMII.cWidth != sc.cmbWidth * 16 {
        let cfExt = if sc.WMISCP.bYUVData != 0 {
            sc.m_param.cfColorFormat
        } else {
            sc.WMII.cfColorFormat
        };
        let mut cFullChannel = sc.WMISCP.cChannel;
        let mut iLast = sc.WMII.cWidth - 1;
        let mut channels: [Option<NonNull<i32>>; 16] = [None; 16];

        if cfExt == ColorFormat::Yuv420
            || cfExt == ColorFormat::Yuv422
            || cfExt == ColorFormat::YOnly
        {
            cFullChannel = 1;
        }

        if cFullChannel > channels.len() || sc.WMISCP.cChannel > channels.len() {
            return Err(WmpError::Fail);
        }
        for (i_channel, channel) in channels.iter_mut().take(sc.WMISCP.cChannel).enumerate() {
            *channel = sc.p1MBbuffer[i_channel];
        }

        if sc.m_bUVResolutionChange != 0 {
            channels[1] = sc.pResU;
            channels[2] = sc.pResV;
        }

        for iRow in 0..16 {
            let iPosLast = ((iLast >> 4) << 8) + idx_cc[iRow][iLast & 0xf] as usize;
            for iColumn in iLast + 1..sc.cmbWidth * 16 {
                let iPos = ((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize;
                for iChannel in 0..cFullChannel {
                    let Some(channel) = channels[iChannel] else {
                        return Err(WmpError::Fail);
                    };
                    let channel = channel.as_ptr();
                    *channel.add(iPos) = *channel.add(iPosLast);
                }
            }
        }

        if cfExt == ColorFormat::Yuv422 {
            iLast >>= 1;
            for iRow in 0..16 {
                let iPosLast = ((iLast >> 3) << 7) + idx_cc[iRow][iLast & 7] as usize;
                for iColumn in iLast + 1..sc.cmbWidth * 8 {
                    let iPos = ((iColumn >> 3) << 7) + idx_cc[iRow][iColumn & 7] as usize;
                    for iChannel in 1..3 {
                        let Some(channel) = channels[iChannel] else {
                            return Err(WmpError::Fail);
                        };
                        let channel = channel.as_ptr();
                        *channel.add(iPos) = *channel.add(iPosLast);
                    }
                }
            }
        } else if cfExt == ColorFormat::Yuv420 {
            iLast >>= 1;
            for iRow in 0..8 {
                let iPosLast = ((iLast >> 3) << 6) + idx_cc_420[iRow][iLast & 7] as usize;
                for iColumn in iLast + 1..sc.cmbWidth * 8 {
                    let iPos = ((iColumn >> 3) << 6) + idx_cc_420[iRow][iColumn & 7] as usize;
                    for iChannel in 1..3 {
                        let Some(channel) = channels[iChannel] else {
                            return Err(WmpError::Fail);
                        };
                        let channel = channel.as_ptr();
                        *channel.add(iPos) = *channel.add(iPosLast);
                    }
                }
            }
        }
    }
    Ok(())
}

/// Original function: `inputMBRowAlpha` at `original/jxrlib/image/encode/strenc.c:1740`.
pub unsafe fn input_mb_row_alpha(pSC: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    let pSC = pSC as *mut CWMImageStrCodec;
    if (*pSC).m_bSecondary == 0 {
        let Some(next_sc) = (*pSC).m_pNextSC.map(NonNull::as_ptr) else {
            return Ok(());
        };
        let cShift = if (*next_sc).m_param.bScaledArith != 0 {
            (SHIFTZERO + QPFRACBITS) as usize
        } else {
            0
        };
        let bdExt = (*pSC).WMII.bdBitDepth;
        let iAlphaPos = (*pSC).WMII.cLeadingPadding
            + if (*pSC).WMII.cfColorFormat == ColorFormat::Cmyk {
                4
            } else {
                3
            };
        let cRow = (*pSC).WMIBI.cLine;
        let cColumn = (*pSC).WMII.cWidth;
        let Some(mut src_row) = (*pSC).WMIBI.pv else {
            return Err(WmpError::Fail);
        };
        let Some(pA) = (*next_sc).p1MBbuffer[0] else {
            return Err(WmpError::Fail);
        };
        let pA = pA.as_ptr();

        for iRow in 0..16 {
            let pSrc0 = src_row.as_ptr();
            if bdExt == BitDepth::Eight {
                let cStride = (*pSC).WMII.cBitsPerUnit >> 3;
                let mut pSrc = pSrc0;

                for iColumn in 0..cColumn {
                    *pA.add(((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize) =
                        ((*pSrc.add(iAlphaPos) as i32) - (1 << 7)) << cShift;
                    pSrc = pSrc.add(cStride);
                }
            } else if bdExt == BitDepth::Sixteen {
                let cStride = ((*pSC).WMII.cBitsPerUnit >> 3) / std::mem::size_of::<u16>();
                let nLenMantissaOrShift = (*next_sc).WMISCP.nLenMantissaOrShift;
                let mut pSrc = pSrc0.cast::<u16>();

                for iColumn in 0..cColumn {
                    *pA.add(((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize) =
                        ((*pSrc.add(iAlphaPos) as i32 - (1 << 15)) >> nLenMantissaOrShift)
                            << cShift;
                    pSrc = pSrc.add(cStride);
                }
            } else if bdExt == BitDepth::SixteenS {
                let cStride = ((*pSC).WMII.cBitsPerUnit >> 3) / std::mem::size_of::<i16>();
                let nLenMantissaOrShift = (*next_sc).WMISCP.nLenMantissaOrShift;
                let mut pSrc = pSrc0.cast::<i16>();

                for iColumn in 0..cColumn {
                    *pA.add(((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize) =
                        (*pSrc.add(iAlphaPos) as i32 >> nLenMantissaOrShift) << cShift;
                    pSrc = pSrc.add(cStride);
                }
            } else if bdExt == BitDepth::SixteenF {
                let cStride = ((*pSC).WMII.cBitsPerUnit >> 3) / std::mem::size_of::<u16>();
                let mut pSrc = pSrc0.cast::<i16>();

                for iColumn in 0..cColumn {
                    *pA.add(((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize) =
                        forward_half(*pSrc.add(iAlphaPos) as i32) << cShift;
                    pSrc = pSrc.add(cStride);
                }
            } else if bdExt == BitDepth::ThirtyTwoS {
                let cStride = ((*pSC).WMII.cBitsPerUnit >> 3) / std::mem::size_of::<i32>();
                let nLenMantissaOrShift = (*next_sc).WMISCP.nLenMantissaOrShift;
                let mut pSrc = pSrc0.cast::<i32>();

                for iColumn in 0..cColumn {
                    *pA.add(((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize) =
                        (*pSrc.add(iAlphaPos) as i32 >> nLenMantissaOrShift) << cShift;
                    pSrc = pSrc.add(cStride);
                }
            } else if bdExt == BitDepth::ThirtyTwoF {
                let cStride = ((*pSC).WMII.cBitsPerUnit >> 3) / std::mem::size_of::<f32>();
                let nLen = (*next_sc).WMISCP.nLenMantissaOrShift;
                let nExpBias = (*next_sc).WMISCP.nExpBias;
                let mut pSrc = pSrc0.cast::<f32>();

                for iColumn in 0..cColumn {
                    *pA.add(((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize) =
                        float2pixel(*pSrc.add(iAlphaPos), nExpBias, nLen) << cShift;
                    pSrc = pSrc.add(cStride);
                }
            } else {
                return Err(WmpError::Fail);
            }

            if iRow + 1 < cRow {
                let Some(next_src_row) = NonNull::new(src_row.as_ptr().add((*pSC).WMIBI.cbStride))
                else {
                    return Err(WmpError::Fail);
                };
                src_row = next_src_row;
            }

            for iColumn in cColumn..(*pSC).cmbWidth * 16 {
                *pA.add(((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize) = *pA
                    .add((((cColumn - 1) >> 4) << 8) + idx_cc[iRow][(cColumn - 1) & 0xf] as usize);
            }
        }
    }

    Ok(())
}

/// Original function: `inputMBRow` at `original/jxrlib/image/encode/strenc.c:1815`.
pub unsafe fn input_mb_row(pSC: &mut CWMImageStrCodec) -> Result<(), WmpError> {
    let pSC = pSC as *mut CWMImageStrCodec;
    let cShift = if (*pSC).m_param.bScaledArith != 0 {
        (SHIFTZERO + QPFRACBITS) as usize
    } else {
        0
    };
    let bdExt = (*pSC).WMII.bdBitDepth;
    let cfExt = (*pSC).WMII.cfColorFormat;
    let cfInt = (*pSC).m_param.cfColorFormat;
    let cPixelStride = ((*pSC).WMII.cBitsPerUnit >> 3) as usize;
    let iRowStride = if cfExt == ColorFormat::Yuv420
        || ((*pSC).WMISCP.bYUVData != 0 && (*pSC).m_param.cfColorFormat == ColorFormat::Yuv420)
    {
        2
    } else {
        1
    };
    let cRow = (*pSC).WMIBI.cLine;
    let cColumn = (*pSC).WMII.cWidth;
    let iB = if (*pSC).WMII.bRGB != 0 { 2 } else { 0 };
    let iR = 2 - iB;
    let nLen = (*pSC).WMISCP.nLenMantissaOrShift;
    let nExpBias = (*pSC).WMISCP.nExpBias;

    let Some(p_y) = (*pSC).p1MBbuffer[0] else {
        return Err(WmpError::Fail);
    };
    let pY = p_y.as_ptr();
    let mut pU = std::ptr::null_mut();
    let mut pV = std::ptr::null_mut();
    if cfInt != ColorFormat::YOnly {
        let (Some(p_u), Some(p_v)) = ((*pSC).p1MBbuffer[1], (*pSC).p1MBbuffer[2]) else {
            return Err(WmpError::Fail);
        };
        pU = p_u.as_ptr();
        pV = p_v.as_ptr();
    }

    if check_image_buffer(pSC, cColumn, cRow).is_err() {
        return Err(WmpError::Fail);
    }
    let Some(mut src_row) = (*pSC).WMIBI.pv else {
        return Err(WmpError::Fail);
    };

    if (*pSC).m_bUVResolutionChange != 0 {
        let (Some(res_u), Some(res_v)) = ((*pSC).pResU, (*pSC).pResV) else {
            return Err(WmpError::Fail);
        };
        pU = res_u.as_ptr();
        pV = res_v.as_ptr();
    } else if cfInt == ColorFormat::YOnly {
        pU = pY;
        pV = pY;
    }

    for iRow in (0..16).step_by(iRowStride) {
        let pSrc0 = src_row.as_ptr();
        if (*pSC).WMISCP.bYUVData != 0 {
            let mut pSrc = pSrc0.cast::<i32>().add((*pSC).WMII.cLeadingPadding);
            if (*pSC).m_param.cfColorFormat == ColorFormat::YOnly
                || (*pSC).m_param.cfColorFormat == ColorFormat::Yuv444
                || (*pSC).m_param.cfColorFormat == ColorFormat::NComponent
            {
                let cChannel = (*pSC).m_param.cNumChannels;
                let mut channels: [Option<NonNull<i32>>; 16] = [None; 16];
                if cChannel > channels.len() {
                    return Err(WmpError::Fail);
                }
                for (i_channel, channel) in channels.iter_mut().take(cChannel).enumerate() {
                    *channel = (*pSC).p1MBbuffer[i_channel];
                }
                if (*pSC).m_bUVResolutionChange != 0 {
                    channels[1] = (*pSC).pResU;
                    channels[2] = (*pSC).pResV;
                }

                let mut iColumn = 0usize;
                while iColumn < cColumn {
                    let iPos = ((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize;
                    for iChannel in 0..cChannel {
                        let Some(channel) = channels[iChannel] else {
                            return Err(WmpError::Fail);
                        };
                        *channel.as_ptr().add(iPos) = *pSrc.add(iChannel) as i32;
                    }
                    pSrc = pSrc.add(cChannel);
                    iColumn += 1;
                }
            } else if (*pSC).m_param.cfColorFormat == ColorFormat::Yuv422 {
                let mut iColumn = 0usize;
                while iColumn < cColumn {
                    if cfInt != ColorFormat::YOnly {
                        let iPos =
                            ((iColumn >> 4) << 7) + idx_cc[iRow][(iColumn >> 1) & 7] as usize;
                        *pU.add(iPos) = *pSrc.add(0) as i32;
                        *pV.add(iPos) = *pSrc.add(2) as i32;
                    }
                    *pY.add(((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 15] as usize) =
                        *pSrc.add(1) as i32;
                    *pY.add(
                        (((iColumn + 1) >> 4) << 8) + idx_cc[iRow][(iColumn + 1) & 15] as usize,
                    ) = *pSrc.add(3) as i32;
                    pSrc = pSrc.add(4);
                    iColumn += 2;
                }
            } else if (*pSC).m_param.cfColorFormat == ColorFormat::Yuv420 {
                let mut iColumn = 0usize;
                while iColumn < cColumn {
                    if cfInt != ColorFormat::YOnly {
                        let iPos = ((iColumn >> 4) << 6)
                            + idx_cc_420[iRow >> 1][(iColumn >> 1) & 7] as usize;
                        *pU.add(iPos) = *pSrc.add(4) as i32;
                        *pV.add(iPos) = *pSrc.add(5) as i32;
                    }
                    *pY.add(((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 15] as usize) =
                        *pSrc.add(0) as i32;
                    *pY.add(
                        (((iColumn + 1) >> 4) << 8) + idx_cc[iRow][(iColumn + 1) & 15] as usize,
                    ) = *pSrc.add(1) as i32;
                    *pY.add(((iColumn >> 4) << 8) + idx_cc[iRow + 1][iColumn & 15] as usize) =
                        *pSrc.add(2) as i32;
                    *pY.add(
                        (((iColumn + 1) >> 4) << 8) + idx_cc[iRow + 1][(iColumn + 1) & 15] as usize,
                    ) = *pSrc.add(3) as i32;
                    pSrc = pSrc.add(6);
                    iColumn += 2;
                }
            } else {
                debug_assert!(false);
            }
        } else if bdExt == BitDepth::Eight {
            let mut pSrc = pSrc0.add((*pSC).WMII.cLeadingPadding);
            let iOffset: i32 = 128 << cShift;
            if cfExt == ColorFormat::Rgb {
                debug_assert!((*pSC).m_bSecondary == 0);
                let mut iColumn = 0usize;
                while iColumn < cColumn {
                    let mut r = (*pSrc.add(iR) as i32) << cShift;
                    let mut g = (*pSrc.add(1) as i32) << cShift;
                    let mut b = (*pSrc.add(iB) as i32) << cShift;
                    b -= r;
                    r += ((b + 1) >> 1) - g;
                    g += r >> 1;
                    let iPos = ((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize;
                    *pU.add(iPos) = -r;
                    *pV.add(iPos) = b;
                    *pY.add(iPos) = g - iOffset;
                    pSrc = pSrc.add(cPixelStride);
                    iColumn += 1;
                }
            } else if cfExt == ColorFormat::YOnly
                || cfExt == ColorFormat::Yuv444
                || cfExt == ColorFormat::NComponent
            {
                let cChannel = (*pSC).m_param.cNumChannels;
                let mut channels: [Option<NonNull<i32>>; 16] = [None; 16];
                if cChannel > channels.len() {
                    return Err(WmpError::Fail);
                }
                for (i_channel, channel) in channels.iter_mut().take(cChannel).enumerate() {
                    *channel = (*pSC).p1MBbuffer[i_channel];
                }
                if (*pSC).m_bUVResolutionChange != 0 {
                    channels[1] = (*pSC).pResU;
                    channels[2] = (*pSC).pResV;
                }
                let mut iColumn = 0usize;
                while iColumn < cColumn {
                    let iPos = ((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize;
                    for iChannel in 0..cChannel {
                        let Some(channel) = channels[iChannel] else {
                            return Err(WmpError::Fail);
                        };
                        *channel.as_ptr().add(iPos) =
                            ((*pSrc.add(iChannel) as i32) << cShift) - iOffset;
                    }
                    pSrc = pSrc.add(cPixelStride);
                    iColumn += 1;
                }
            } else if cfExt == ColorFormat::Rgbe {
                let mut iColumn = 0usize;
                while iColumn < cColumn {
                    let iExp = *pSrc.add(3) as i32;
                    let mut r = forward_rgbe(*pSrc.add(0) as i32, iExp) << cShift;
                    let mut g = forward_rgbe(*pSrc.add(1) as i32, iExp) << cShift;
                    let mut b = forward_rgbe(*pSrc.add(2) as i32, iExp) << cShift;
                    b -= r;
                    r += ((b + 1) >> 1) - g;
                    g += r >> 1;
                    let iPos = ((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize;
                    *pU.add(iPos) = -r;
                    *pV.add(iPos) = b;
                    *pY.add(iPos) = g;
                    pSrc = pSrc.add(cPixelStride);
                    iColumn += 1;
                }
            } else if cfExt == ColorFormat::Cmyk {
                let pK = if cfInt == ColorFormat::Cmyk {
                    let Some(p_k) = (*pSC).p1MBbuffer[3] else {
                        return Err(WmpError::Fail);
                    };
                    p_k.as_ptr()
                } else {
                    pY
                };
                let mut iColumn = 0usize;
                while iColumn < cColumn {
                    let mut c = (*pSrc.add(0) as i32) << cShift;
                    let mut m = (*pSrc.add(1) as i32) << cShift;
                    let mut y = (*pSrc.add(2) as i32) << cShift;
                    let mut k = (*pSrc.add(3) as i32) << cShift;
                    y -= c;
                    c += ((y + 1) >> 1) - m;
                    m += (c >> 1) - k;
                    k += (m + 1) >> 1;
                    let iPos = ((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize;
                    *pU.add(iPos) = c;
                    *pV.add(iPos) = -y;
                    *pK.add(iPos) = k;
                    *pY.add(iPos) = iOffset - m;
                    pSrc = pSrc.add(cPixelStride);
                    iColumn += 1;
                }
            } else if cfExt == ColorFormat::Yuv422 {
                let mut iColumn = 0usize;
                while iColumn < cColumn {
                    if cfInt != ColorFormat::YOnly {
                        let iPos =
                            ((iColumn >> 4) << 7) + idx_cc[iRow][(iColumn >> 1) & 7] as usize;
                        *pU.add(iPos) = ((*pSrc.add(0) as i32) << cShift) - iOffset;
                        *pV.add(iPos) = ((*pSrc.add(2) as i32) << cShift) - iOffset;
                    }
                    *pY.add(((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 15] as usize) =
                        ((*pSrc.add(1) as i32) << cShift) - iOffset;
                    *pY.add(
                        (((iColumn + 1) >> 4) << 8) + idx_cc[iRow][(iColumn + 1) & 15] as usize,
                    ) = ((*pSrc.add(3) as i32) << cShift) - iOffset;
                    pSrc = pSrc.add(cPixelStride);
                    iColumn += 2;
                }
            } else if cfExt == ColorFormat::Yuv420 {
                let mut iColumn = 0usize;
                while iColumn < cColumn {
                    if cfInt != ColorFormat::YOnly {
                        let iPos = ((iColumn >> 4) << 6)
                            + idx_cc_420[iRow >> 1][(iColumn >> 1) & 7] as usize;
                        *pU.add(iPos) = ((*pSrc.add(4) as i32) << cShift) - iOffset;
                        *pV.add(iPos) = ((*pSrc.add(5) as i32) << cShift) - iOffset;
                    }
                    *pY.add(((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 15] as usize) =
                        ((*pSrc.add(0) as i32) << cShift) - iOffset;
                    *pY.add(
                        (((iColumn + 1) >> 4) << 8) + idx_cc[iRow][(iColumn + 1) & 15] as usize,
                    ) = ((*pSrc.add(1) as i32) << cShift) - iOffset;
                    *pY.add(((iColumn >> 4) << 8) + idx_cc[iRow + 1][iColumn & 15] as usize) =
                        ((*pSrc.add(2) as i32) << cShift) - iOffset;
                    *pY.add(
                        (((iColumn + 1) >> 4) << 8) + idx_cc[iRow + 1][(iColumn + 1) & 15] as usize,
                    ) = ((*pSrc.add(3) as i32) << cShift) - iOffset;
                    pSrc = pSrc.add(cPixelStride);
                    iColumn += 2;
                }
            } else {
                debug_assert!(false);
            }
        } else if bdExt == BitDepth::Sixteen {
            let mut pSrc = pSrc0.cast::<u16>().add((*pSC).WMII.cLeadingPadding);
            let cStride = cPixelStride / std::mem::size_of::<u16>();
            let iOffset: i32 = ((1 << 15) >> nLen) << cShift;
            if cfExt == ColorFormat::Rgb {
                let mut iColumn = 0usize;
                while iColumn < cColumn {
                    let mut r = ((*pSrc.add(0) as i32) >> nLen) << cShift;
                    let mut g = ((*pSrc.add(1) as i32) >> nLen) << cShift;
                    let mut b = ((*pSrc.add(2) as i32) >> nLen) << cShift;
                    b -= r;
                    r += ((b + 1) >> 1) - g;
                    g += r >> 1;
                    let iPos = ((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize;
                    *pU.add(iPos) = -r;
                    *pV.add(iPos) = b;
                    *pY.add(iPos) = g - iOffset;
                    pSrc = pSrc.add(cStride);
                    iColumn += 1;
                }
            } else if cfExt == ColorFormat::YOnly
                || cfExt == ColorFormat::Yuv444
                || cfExt == ColorFormat::NComponent
            {
                let cChannel = (*pSC).WMISCP.cChannel as usize;
                let mut iColumn = 0usize;
                while iColumn < cColumn {
                    let iPos = ((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize;
                    let mut iChannel = 0usize;
                    while iChannel < cChannel {
                        let Some(p1_mb_buffer) = (*pSC).p1MBbuffer[iChannel] else {
                            return Err(WmpError::Fail);
                        };
                        *p1_mb_buffer.as_ptr().add(iPos) =
                            (((*pSrc.add(iChannel) as i32) >> nLen) << cShift) - iOffset;
                        iChannel += 1;
                    }
                    pSrc = pSrc.add(cStride);
                    iColumn += 1;
                }
            } else if cfExt == ColorFormat::Cmyk {
                let pK = if cfInt == ColorFormat::Cmyk {
                    let Some(p_k) = (*pSC).p1MBbuffer[3] else {
                        return Err(WmpError::Fail);
                    };
                    p_k.as_ptr()
                } else {
                    pY
                };
                let mut iColumn = 0usize;
                while iColumn < cColumn {
                    let mut c = ((*pSrc.add(0) as i32) >> nLen) << cShift;
                    let mut m = ((*pSrc.add(1) as i32) >> nLen) << cShift;
                    let mut y = ((*pSrc.add(2) as i32) >> nLen) << cShift;
                    let mut k = ((*pSrc.add(3) as i32) >> nLen) << cShift;
                    y -= c;
                    c += ((y + 1) >> 1) - m;
                    m += (c >> 1) - k;
                    k += (m + 1) >> 1;
                    let iPos = ((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize;
                    *pU.add(iPos) = c;
                    *pV.add(iPos) = -y;
                    *pK.add(iPos) = k;
                    *pY.add(iPos) = iOffset - m;
                    pSrc = pSrc.add(cStride);
                    iColumn += 1;
                }
            } else if cfExt == ColorFormat::Yuv422 {
                let mut iColumn = 0usize;
                while iColumn < cColumn {
                    if cfInt != ColorFormat::YOnly {
                        let iPos =
                            ((iColumn >> 4) << 7) + idx_cc[iRow][(iColumn >> 1) & 7] as usize;
                        *pU.add(iPos) = ((*pSrc.add(0) as i32) << cShift) - iOffset;
                        *pV.add(iPos) = ((*pSrc.add(2) as i32) << cShift) - iOffset;
                    }
                    *pY.add(((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 15] as usize) =
                        ((*pSrc.add(1) as i32) << cShift) - iOffset;
                    *pY.add(
                        (((iColumn + 1) >> 4) << 8) + idx_cc[iRow][(iColumn + 1) & 15] as usize,
                    ) = ((*pSrc.add(3) as i32) << cShift) - iOffset;
                    pSrc = pSrc.add(cStride);
                    iColumn += 2;
                }
            } else if cfExt == ColorFormat::Yuv420 {
                let mut iColumn = 0usize;
                while iColumn < cColumn {
                    if cfInt != ColorFormat::YOnly {
                        let iPos = ((iColumn >> 4) << 6)
                            + idx_cc_420[iRow >> 1][(iColumn >> 1) & 7] as usize;
                        *pU.add(iPos) = ((*pSrc.add(4) as i32) << cShift) - iOffset;
                        *pV.add(iPos) = ((*pSrc.add(5) as i32) << cShift) - iOffset;
                    }
                    *pY.add(((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 15] as usize) =
                        ((*pSrc.add(0) as i32) << cShift) - iOffset;
                    *pY.add(
                        (((iColumn + 1) >> 4) << 8) + idx_cc[iRow][(iColumn + 1) & 15] as usize,
                    ) = ((*pSrc.add(1) as i32) << cShift) - iOffset;
                    *pY.add(((iColumn >> 4) << 8) + idx_cc[iRow + 1][iColumn & 15] as usize) =
                        ((*pSrc.add(2) as i32) << cShift) - iOffset;
                    *pY.add(
                        (((iColumn + 1) >> 4) << 8) + idx_cc[iRow + 1][(iColumn + 1) & 15] as usize,
                    ) = ((*pSrc.add(3) as i32) << cShift) - iOffset;
                    pSrc = pSrc.add(cStride);
                    iColumn += 2;
                }
            } else {
                debug_assert!(false);
            }
        } else if bdExt == BitDepth::SixteenS
            || bdExt == BitDepth::SixteenF
            || bdExt == BitDepth::ThirtyTwo
            || bdExt == BitDepth::ThirtyTwoS
            || bdExt == BitDepth::ThirtyTwoF
        {
            if bdExt == BitDepth::SixteenS {
                let mut pSrc = pSrc0.cast::<i16>().add((*pSC).WMII.cLeadingPadding);
                let cStride = cPixelStride / std::mem::size_of::<i16>();
                if cfExt == ColorFormat::Rgb {
                    let mut iColumn = 0usize;
                    while iColumn < cColumn {
                        let mut r = ((*pSrc.add(0) as i32) >> nLen) << cShift;
                        let mut g = ((*pSrc.add(1) as i32) >> nLen) << cShift;
                        let mut b = ((*pSrc.add(2) as i32) >> nLen) << cShift;
                        b -= r;
                        r += ((b + 1) >> 1) - g;
                        g += r >> 1;
                        let iPos = ((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize;
                        *pU.add(iPos) = -r;
                        *pV.add(iPos) = b;
                        *pY.add(iPos) = g;
                        pSrc = pSrc.add(cStride);
                        iColumn += 1;
                    }
                } else if cfExt == ColorFormat::YOnly
                    || cfExt == ColorFormat::Yuv444
                    || cfExt == ColorFormat::NComponent
                {
                    let cChannel = (*pSC).WMISCP.cChannel as usize;
                    let mut iColumn = 0usize;
                    while iColumn < cColumn {
                        let iPos = ((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize;
                        let mut iChannel = 0usize;
                        while iChannel < cChannel {
                            let Some(p1_mb_buffer) = (*pSC).p1MBbuffer[iChannel] else {
                                return Err(WmpError::Fail);
                            };
                            *p1_mb_buffer.as_ptr().add(iPos) =
                                ((*pSrc.add(iChannel) as i32) >> nLen) << cShift;
                            iChannel += 1;
                        }
                        pSrc = pSrc.add(cStride);
                        iColumn += 1;
                    }
                } else if cfExt == ColorFormat::Cmyk {
                    let pK = if cfInt == ColorFormat::Cmyk {
                        let Some(p_k) = (*pSC).p1MBbuffer[3] else {
                            return Err(WmpError::Fail);
                        };
                        p_k.as_ptr()
                    } else {
                        pY
                    };
                    let mut iColumn = 0usize;
                    while iColumn < cColumn {
                        let mut c = ((*pSrc.add(0) as i32) >> nLen) << cShift;
                        let mut m = ((*pSrc.add(1) as i32) >> nLen) << cShift;
                        let mut y = ((*pSrc.add(2) as i32) >> nLen) << cShift;
                        let mut k = ((*pSrc.add(3) as i32) >> nLen) << cShift;
                        y -= c;
                        c += ((y + 1) >> 1) - m;
                        m += (c >> 1) - k;
                        k += (m + 1) >> 1;
                        let iPos = ((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize;
                        *pU.add(iPos) = c;
                        *pV.add(iPos) = -y;
                        *pK.add(iPos) = k;
                        *pY.add(iPos) = -m;
                        pSrc = pSrc.add(cStride);
                        iColumn += 1;
                    }
                } else {
                    debug_assert!(false);
                }
            } else if bdExt == BitDepth::SixteenF {
                let mut pSrc = pSrc0.cast::<i16>().add((*pSC).WMII.cLeadingPadding);
                let cStride = cPixelStride / std::mem::size_of::<u16>();
                if cfExt == ColorFormat::Rgb {
                    let mut iColumn = 0usize;
                    while iColumn < cColumn {
                        let mut r = forward_half(*pSrc.add(0) as i32) << cShift;
                        let mut g = forward_half(*pSrc.add(1) as i32) << cShift;
                        let mut b = forward_half(*pSrc.add(2) as i32) << cShift;
                        b -= r;
                        r += ((b + 1) >> 1) - g;
                        g += r >> 1;
                        let iPos = ((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize;
                        *pU.add(iPos) = -r;
                        *pV.add(iPos) = b;
                        *pY.add(iPos) = g;
                        pSrc = pSrc.add(cStride);
                        iColumn += 1;
                    }
                } else if cfExt == ColorFormat::YOnly
                    || cfExt == ColorFormat::Yuv444
                    || cfExt == ColorFormat::NComponent
                {
                    let cChannel = (*pSC).WMISCP.cChannel as usize;
                    let mut iColumn = 0usize;
                    while iColumn < cColumn {
                        let iPos = ((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize;
                        let mut iChannel = 0usize;
                        while iChannel < cChannel {
                            let Some(p1_mb_buffer) = (*pSC).p1MBbuffer[iChannel] else {
                                return Err(WmpError::Fail);
                            };
                            *p1_mb_buffer.as_ptr().add(iPos) =
                                forward_half(*pSrc.add(iChannel) as i32) << cShift;
                            iChannel += 1;
                        }
                        pSrc = pSrc.add(cStride);
                        iColumn += 1;
                    }
                } else {
                    debug_assert!(false);
                }
            } else if bdExt == BitDepth::ThirtyTwo {
                let mut pSrc = pSrc0.cast::<u32>().add((*pSC).WMII.cLeadingPadding);
                let cStride = cPixelStride / std::mem::size_of::<u32>();
                let iOffset: i32 = (((1_i64 << 31) >> nLen) as i32) << cShift;
                if cfExt == ColorFormat::Rgb {
                    let mut iColumn = 0usize;
                    while iColumn < cColumn {
                        let mut r = ((*pSrc.add(0) as i32) >> nLen) << cShift;
                        let mut g = ((*pSrc.add(1) as i32) >> nLen) << cShift;
                        let mut b = ((*pSrc.add(2) as i32) >> nLen) << cShift;
                        b -= r;
                        r += ((b + 1) >> 1) - g;
                        g += r >> 1;
                        let iPos = ((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize;
                        *pU.add(iPos) = -r;
                        *pV.add(iPos) = b;
                        *pY.add(iPos) = g - iOffset;
                        pSrc = pSrc.add(cStride);
                        iColumn += 1;
                    }
                } else if cfExt == ColorFormat::YOnly
                    || cfExt == ColorFormat::Yuv444
                    || cfExt == ColorFormat::NComponent
                {
                    let cChannel = (*pSC).WMISCP.cChannel as usize;
                    let mut iColumn = 0usize;
                    while iColumn < cColumn {
                        let iPos = ((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize;
                        let mut iChannel = 0usize;
                        while iChannel < cChannel {
                            let Some(p1_mb_buffer) = (*pSC).p1MBbuffer[iChannel] else {
                                return Err(WmpError::Fail);
                            };
                            *p1_mb_buffer.as_ptr().add(iPos) =
                                ((*pSrc.add(iChannel) as i32) >> nLen) << cShift;
                            iChannel += 1;
                        }
                        pSrc = pSrc.add(cStride);
                        iColumn += 1;
                    }
                } else {
                    debug_assert!(false);
                }
            } else if bdExt == BitDepth::ThirtyTwoS {
                let mut pSrc = pSrc0.cast::<i32>().add((*pSC).WMII.cLeadingPadding);
                let cStride = cPixelStride / std::mem::size_of::<i32>();
                if cfExt == ColorFormat::Rgb {
                    let mut iColumn = 0usize;
                    while iColumn < cColumn {
                        let mut r = ((*pSrc.add(0) as i32) >> nLen) << cShift;
                        let mut g = ((*pSrc.add(1) as i32) >> nLen) << cShift;
                        let mut b = ((*pSrc.add(2) as i32) >> nLen) << cShift;
                        b -= r;
                        r += ((b + 1) >> 1) - g;
                        g += r >> 1;
                        let iPos = ((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize;
                        *pU.add(iPos) = -r;
                        *pV.add(iPos) = b;
                        *pY.add(iPos) = g;
                        pSrc = pSrc.add(cStride);
                        iColumn += 1;
                    }
                } else if cfExt == ColorFormat::YOnly
                    || cfExt == ColorFormat::Yuv444
                    || cfExt == ColorFormat::NComponent
                {
                    let cChannel = (*pSC).WMISCP.cChannel as usize;
                    let mut iColumn = 0usize;
                    while iColumn < cColumn {
                        let iPos = ((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize;
                        let mut iChannel = 0usize;
                        while iChannel < cChannel {
                            let Some(p1_mb_buffer) = (*pSC).p1MBbuffer[iChannel] else {
                                return Err(WmpError::Fail);
                            };
                            *p1_mb_buffer.as_ptr().add(iPos) =
                                ((*pSrc.add(iChannel) as i32) >> nLen) << cShift;
                            iChannel += 1;
                        }
                        pSrc = pSrc.add(cStride);
                        iColumn += 1;
                    }
                } else {
                    debug_assert!(false);
                }
            } else {
                let mut pSrc = pSrc0.cast::<f32>().add((*pSC).WMII.cLeadingPadding);
                let cStride = cPixelStride / std::mem::size_of::<f32>();
                if cfExt == ColorFormat::Rgb {
                    let mut iColumn = 0usize;
                    while iColumn < cColumn {
                        let mut r = float2pixel(*pSrc.add(0), nExpBias, nLen) << cShift;
                        let mut g = float2pixel(*pSrc.add(1), nExpBias, nLen) << cShift;
                        let mut b = float2pixel(*pSrc.add(2), nExpBias, nLen) << cShift;
                        b -= r;
                        r += ((b + 1) >> 1) - g;
                        g += r >> 1;
                        let iPos = ((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize;
                        *pU.add(iPos) = -r;
                        *pV.add(iPos) = b;
                        *pY.add(iPos) = g;
                        pSrc = pSrc.add(cStride);
                        iColumn += 1;
                    }
                } else if cfExt == ColorFormat::YOnly
                    || cfExt == ColorFormat::Yuv444
                    || cfExt == ColorFormat::NComponent
                {
                    let cChannel = (*pSC).WMISCP.cChannel as usize;
                    let mut iColumn = 0usize;
                    while iColumn < cColumn {
                        let iPos = ((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize;
                        let mut iChannel = 0usize;
                        while iChannel < cChannel {
                            let Some(p1_mb_buffer) = (*pSC).p1MBbuffer[iChannel] else {
                                return Err(WmpError::Fail);
                            };
                            *p1_mb_buffer.as_ptr().add(iPos) =
                                float2pixel(*pSrc.add(iChannel), nExpBias, nLen) << cShift;
                            iChannel += 1;
                        }
                        pSrc = pSrc.add(cStride);
                        iColumn += 1;
                    }
                } else {
                    debug_assert!(false);
                }
            }
        } else if bdExt == BitDepth::Five {
            let mut pSrc = pSrc0;
            let iOffset: i32 = 16 << cShift;
            debug_assert!(cfExt == ColorFormat::Rgb);
            let mut iColumn = 0usize;
            while iColumn < cColumn {
                let mut r = *pSrc.add(0) as i32;
                let mut g = *pSrc.add(1) as i32;
                let mut b = ((g >> 2) & 0x1f) << cShift;
                g = ((r >> 5) + ((g & 3) << 3)) << cShift;
                r = (r & 0x1f) << cShift;
                b -= r;
                r += ((b + 1) >> 1) - g;
                g += r >> 1;
                let iPos = ((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize;
                *pU.add(iPos) = -r;
                *pV.add(iPos) = b;
                *pY.add(iPos) = g - iOffset;
                pSrc = pSrc.add(cPixelStride);
                iColumn += 1;
            }
        } else if bdExt == BitDepth::FiveSixFive {
            let mut pSrc = pSrc0;
            let iOffset: i32 = 32 << cShift;
            debug_assert!(cfExt == ColorFormat::Rgb);
            let mut iColumn = 0usize;
            while iColumn < cColumn {
                let mut r = *pSrc.add(0) as i32;
                let mut g = *pSrc.add(1) as i32;
                let mut b = (g >> 3) << (cShift + 1);
                g = ((r >> 5) + ((g & 7) << 3)) << cShift;
                r = (r & 0x1f) << (cShift + 1);
                b -= r;
                r += ((b + 1) >> 1) - g;
                g += r >> 1;
                let iPos = ((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize;
                *pU.add(iPos) = -r;
                *pV.add(iPos) = b;
                *pY.add(iPos) = g - iOffset;
                pSrc = pSrc.add(cPixelStride);
                iColumn += 1;
            }
        } else if bdExt == BitDepth::Ten {
            let mut pSrc = pSrc0;
            let iOffset: i32 = 512 << cShift;
            debug_assert!(cfExt == ColorFormat::Rgb);
            let mut iColumn = 0usize;
            while iColumn < cColumn {
                let mut r = *pSrc.add(0) as i32;
                let mut g = *pSrc.add(1) as i32;
                let mut b = *pSrc.add(2) as i32;
                r = (r + ((g & 3) << 8)) << cShift;
                g = ((g >> 2) + ((b & 0xf) << 6)) << cShift;
                b = ((b >> 4) + ((*pSrc.add(3) as i32 & 0x3f) << 4)) << cShift;
                b -= r;
                r += ((b + 1) >> 1) - g;
                g += r >> 1;
                let iPos = ((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize;
                *pU.add(iPos) = -r;
                *pV.add(iPos) = b;
                *pY.add(iPos) = g - iOffset;
                pSrc = pSrc.add(cPixelStride);
                iColumn += 1;
            }
        } else if bdExt == BitDepth::One {
            debug_assert!(cfExt == ColorFormat::YOnly);
            let mut iColumn = 0usize;
            while iColumn < cColumn {
                *pY.add(((iColumn >> 4) << 8) + idx_cc[iRow][iColumn & 0xf] as usize) =
                    (((*pSC).WMISCP.bBlackWhite
                        + ((*pSrc0.add(iColumn >> 3) as i32) >> (7 - (iColumn & 7))))
                        & 1)
                        << cShift;
                iColumn += 1;
            }
        }

        if iRow + iRowStride < cRow {
            let Some(next_src_row) = NonNull::new(src_row.as_ptr().add((*pSC).WMIBI.cbStride))
            else {
                return Err(WmpError::Fail);
            };
            src_row = next_src_row;
        }
    }

    pad_horizontally(&mut *pSC)?;

    if (*pSC).m_bUVResolutionChange != 0 {
        downsample_uv(&mut *pSC);
    }

    if AlphaMode::from_u8((*pSC).WMISCP.uAlphaMode) == Some(AlphaMode::Only)
        && input_mb_row_alpha(&mut *pSC).is_err()
    {
        return Err(WmpError::Fail);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    unsafe fn fail_read(_: &mut WMPStream, _: &mut [u8]) -> Result<(), WmpError> {
        Err(WmpError::FileIO)
    }

    unsafe fn ok_read(_: &mut WMPStream, buf: &mut [u8]) -> Result<(), WmpError> {
        buf.fill(0xa5);
        Ok(())
    }

    unsafe fn fail_write(_: &mut WMPStream, _: &[u8]) -> Result<(), WmpError> {
        Err(WmpError::FileIO)
    }

    unsafe fn ok_write(_: &mut WMPStream, _: &[u8]) -> Result<(), WmpError> {
        Ok(())
    }

    #[test]
    fn copy_to_propagates_stream_read_and_write_errors() {
        unsafe {
            let mut src = WMPStream {
                Read: Some(fail_read),
                ..Default::default()
            };
            let mut dst = WMPStream {
                Write: Some(ok_write),
                ..Default::default()
            };
            assert_eq!(
                copy_to(&mut src, &mut dst, PACKETLENGTH + 1),
                Err(WmpError::FileIO)
            );

            src.Read = Some(ok_read);
            dst.Write = Some(fail_write);
            assert_eq!(
                copy_to(&mut src, &mut dst, PACKETLENGTH + 1),
                Err(WmpError::FileIO)
            );
        }
    }

    #[test]
    fn image_str_enc_init_rejects_zero_channel_ncomponent() {
        let mut image_info = tagCWMImageInfo {
            cWidth: 1,
            cHeight: 1,
            cfColorFormat: ColorFormat::NComponent,
            bdBitDepth: BitDepth::Eight,
            cBitsPerUnit: 8,
            cLeadingPadding: 0,
            bRGB: 0,
            cChromaCenteringX: 0,
            cChromaCenteringY: 0,
            cROILeftX: 0,
            cROIWidth: 0,
            cROITopY: 0,
            cROIHeight: 0,
            bSkipFlexbits: 0,
            cThumbnailWidth: 0,
            cThumbnailHeight: 0,
            oOrientation: crate::image::sys::windowsmediaphoto::Orientation::None,
            cPostProcStrength: 0,
            fPaddedUserBuffer: 0,
        };
        let mut scp = tagCWMIStrCodecParam {
            cfColorFormat: ColorFormat::NComponent,
            cChannel: 0,
            ..Default::default()
        };
        let mut ctx = None;

        unsafe {
            assert_eq!(
                image_str_enc_init(&mut image_info, &mut scp, &mut ctx),
                Err(WmpError::Fail)
            );
        }
        assert!(ctx.is_none());
    }

    fn yuv420_two_overlap_hard_tile_case(
        width_mb: usize,
        first_tile_width_mb: u32,
    ) -> (tagCWMImageInfo, tagCWMIStrCodecParam) {
        let image_info = tagCWMImageInfo {
            cWidth: width_mb * 16,
            cHeight: 16,
            cfColorFormat: ColorFormat::Yuv420,
            bdBitDepth: BitDepth::Eight,
            cBitsPerUnit: 8,
            ..Default::default()
        };
        let mut scp = tagCWMIStrCodecParam {
            cfColorFormat: ColorFormat::Yuv420,
            olOverlap: Overlap::Two,
            bUseHardTileBoundaries: 1,
            cNumOfSliceMinus1V: 1,
            cNumOfSliceMinus1H: 0,
            ..Default::default()
        };
        scp.uiTileX[0] = first_tile_width_mb;

        (image_info, scp)
    }

    #[test]
    fn validate_args_rejects_one_mb_vertical_hard_tile_for_yuv420_two_overlap() {
        let (mut image_info, mut scp) = yuv420_two_overlap_hard_tile_case(4, 1);

        unsafe {
            assert_eq!(
                validate_args(&mut image_info, &mut scp),
                Err(WmpError::Fail)
            );
        }
    }

    #[test]
    fn validate_args_accepts_two_mb_vertical_hard_tile_for_yuv420_two_overlap() {
        let (mut image_info, mut scp) = yuv420_two_overlap_hard_tile_case(4, 2);

        unsafe {
            assert_eq!(validate_args(&mut image_info, &mut scp), Ok(()));
        }
    }
}
