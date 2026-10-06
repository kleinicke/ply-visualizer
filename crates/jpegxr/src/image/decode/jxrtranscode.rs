// Auto-generated scaffold for a faithful JXRLib translation restart.
// Keep one Rust item per original C item; replace stubs bottom-up.

use std::ptr::NonNull;

use crate::image::decode::decode::CWMDecoderParameters;
use crate::image::decode::segdec::{
    decode_macroblock_dc, decode_macroblock_highpass, decode_macroblock_lowpass,
};
use crate::image::decode::str_pred_quant_dec::{pred_ac_dec, pred_dcac_dec};
use crate::image::decode::strdec::{
    read_image_plane_header, read_packets, read_wmi_header, str_dec_init, str_io_dec_init,
    str_io_dec_term,
};
use crate::image::encode::strenc::{
    copy_to, encode_mb, str_enc_init, str_io_enc_term, write_image_plane_header, write_index_table,
    write_index_table_null, write_wmi_header,
};
use crate::image::sys::str_pred_quant::update_pred_info;
use crate::image::sys::strcodec::{
    advance_one_mb_row, attach_is_write, attach_sb, dct_index, detach_is_write, detach_sb,
    dquant_bits, get_tile_pos, put_bit16, tagBitIOInfo, tagCWMIMBInfo, tagSimpleBitIO,
    CCodingContext, CWMITile, CWMImageStrCodec, CWMImageStrCodecParameters, MAX_CHANNELS,
    PACKETLENGTH,
};
use crate::image::sys::windowsmediaphoto::{
    tagCWMIStrCodecParam, tagCWMImageInfo, tagCWMTranscodingParam, AlphaMode, BitstreamFormat,
    Orientation, Overlap, Subband, WMPStream, MAX_TILES,
};
use crate::jxrgluelib::jxrglue::ColorFormat;
use crate::WmpError;

use crate::image::encode::strenc::write_packet_header;

const B_FLIP_V: [i32; 8] = [0, 1, 0, 1, 1, 1, 0, 0];
const B_FLIP_H: [i32; 8] = [0, 0, 1, 1, 0, 1, 0, 1];

/// Original struct: `CTileQPInfo` at `original/jxrlib/image/decode/JXRTranscode.c:63`.
#[derive(Debug, Clone, Default)]
pub struct CTileQPInfo {
    pub dcMode: u8,
    pub dcIndex: [u8; MAX_CHANNELS],
    pub bUseDC: i32,
    pub lpNum: u8,
    pub bUseDCAlpha: i32,
    pub lpNumAlpha: u8,
    pub lpMode: [u8; 16],
    pub lpIndex: [[u8; MAX_CHANNELS]; 16],
    pub bUseLP: i32,
    pub hpNum: u8,
    pub bUseLPAlpha: i32,
    pub hpNumAlpha: u8,
    pub hpMode: [u8; 16],
    pub hpIndex: [[u8; MAX_CHANNELS]; 16],
}

/// Original function: `transcodeQuantizer` at `original/jxrlib/image/decode/JXRTranscode.c:83`.
pub unsafe fn transcode_quantizer(
    p_io: *mut tagBitIOInfo,
    c_index: *mut u8,
    mut c_ch_mode: u8,
    c_channel: usize,
) {
    if c_ch_mode > 2 {
        c_ch_mode = 2;
    }

    if c_channel > 1 {
        put_bit16(p_io, c_ch_mode as u32, 2);
    } else {
        c_ch_mode = 0;
    }

    put_bit16(p_io, *c_index.add(0) as u32, 8);

    if c_ch_mode == 1 {
        put_bit16(p_io, *c_index.add(1) as u32, 8);
    } else if c_ch_mode > 0 {
        let mut i = 1;
        while i < c_channel {
            put_bit16(p_io, *c_index.add(i) as u32, 8);
            i += 1;
        }
    }
}

/// Original function: `transcodeQuantizers` at `original/jxrlib/image/decode/JXRTranscode.c:105`.
pub unsafe fn transcode_quantizers(
    p_io: *mut tagBitIOInfo,
    c_index: *mut [u8; MAX_CHANNELS],
    c_ch_mode: *mut u8,
    c_num: u32,
    c_channel: usize,
    b_copy: i32,
) {
    put_bit16(p_io, if b_copy == 1 { 1 } else { 0 }, 1);
    if b_copy == 0 {
        let mut i = 0;

        put_bit16(p_io, c_num - 1, 4);

        while i < c_num {
            transcode_quantizer(
                p_io,
                (*c_index.add(i as usize)).as_mut_ptr(),
                *c_ch_mode.add(i as usize),
                c_channel,
            );
            i += 1;
        }
    }
}

/// Original function: `transcodeQuantizersAlpha` at `original/jxrlib/image/decode/JXRTranscode.c:118`.
pub unsafe fn transcode_quantizers_alpha(
    p_io: *mut tagBitIOInfo,
    c_index: *mut [u8; MAX_CHANNELS],
    c_num: u32,
    i_channel: usize,
    b_copy: i32,
) {
    put_bit16(p_io, if b_copy == 1 { 1 } else { 0 }, 1);
    if b_copy == 0 {
        let mut i = 0;

        put_bit16(p_io, c_num - 1, 4);

        while i < c_num {
            put_bit16(p_io, (*c_index.add(i as usize))[i_channel] as u32, 8);
            i += 1;
        }
    }
}

/// Original function: `transcodeTileHeader` at `original/jxrlib/image/decode/JXRTranscode.c:131`.
pub unsafe fn transcode_tile_header(sc: &mut CWMImageStrCodec, tile_qp_info: &mut CTileQPInfo) {
    if sc.m_bCtxLeft != 0 && sc.m_bCtxTop != 0 && sc.m_bSecondary == 0 {
        let Some(contexts) = sc.pCodingContextMemory.as_deref_mut() else {
            return;
        };
        let Some(context) = contexts.get_mut(sc.cTileColumn) else {
            return;
        };
        let Some(tile) = sc
            .pTileMemory
            .as_deref_mut()
            .and_then(|tiles| tiles.get_mut(sc.cTileColumn))
        else {
            return;
        };
        let p_id = ((sc.cTileRow * (sc.WMISCP.cNumOfSliceMinus1V as usize + 1) + sc.cTileColumn)
            & 0x1f) as u8;
        let sc_alpha = if sc.m_param.bAlphaChannel != 0 {
            sc.m_pNextSC
                .map(NonNull::as_ptr)
                .unwrap_or(std::ptr::null_mut())
        } else {
            std::ptr::null_mut()
        };
        let i_alpha_pos = sc.m_param.cNumChannels;

        write_packet_header(
            context.m_pIODC,
            if sc.WMISCP.bfBitstreamFormat == BitstreamFormat::Spatial {
                0
            } else {
                1
            },
            p_id,
        );
        if sc.m_param.bTrimFlexbitsFlag != 0
            && sc.WMISCP.bfBitstreamFormat == BitstreamFormat::Spatial
        {
            put_bit16(context.m_pIODC, context.m_iTrimFlexBits as u32, 4);
        }

        if (sc.m_param.uQPMode & 1) != 0 {
            transcode_quantizer(
                context.m_pIODC,
                tile_qp_info.dcIndex.as_mut_ptr(),
                tile_qp_info.dcMode,
                sc.WMISCP.cChannel,
            );
        }
        if !sc_alpha.is_null() && ((*sc_alpha).m_param.uQPMode & 1) != 0 {
            put_bit16(context.m_pIODC, tile_qp_info.dcIndex[i_alpha_pos] as u32, 8);
        }

        if sc.WMISCP.bfBitstreamFormat == BitstreamFormat::Spatial {
            if sc.WMISCP.sbSubband != Subband::DcOnly {
                if (sc.m_param.uQPMode & 2) != 0 {
                    transcode_quantizers(
                        context.m_pIODC,
                        tile_qp_info.lpIndex.as_mut_ptr(),
                        tile_qp_info.lpMode.as_mut_ptr(),
                        tile_qp_info.lpNum as u32,
                        sc.WMISCP.cChannel,
                        tile_qp_info.bUseDC,
                    );
                }
                if !sc_alpha.is_null() && ((*sc_alpha).m_param.uQPMode & 2) != 0 {
                    transcode_quantizers_alpha(
                        context.m_pIODC,
                        tile_qp_info.lpIndex.as_mut_ptr(),
                        tile_qp_info.lpNumAlpha as u32,
                        i_alpha_pos,
                        tile_qp_info.bUseDCAlpha,
                    );
                }
                if sc.WMISCP.sbSubband != Subband::NoHighpass {
                    if (sc.m_param.uQPMode & 4) != 0 {
                        transcode_quantizers(
                            context.m_pIODC,
                            tile_qp_info.hpIndex.as_mut_ptr(),
                            tile_qp_info.hpMode.as_mut_ptr(),
                            tile_qp_info.hpNum as u32,
                            sc.WMISCP.cChannel,
                            tile_qp_info.bUseLP,
                        );
                    }
                    if !sc_alpha.is_null() && ((*sc_alpha).m_param.uQPMode & 4) != 0 {
                        transcode_quantizers_alpha(
                            context.m_pIODC,
                            tile_qp_info.hpIndex.as_mut_ptr(),
                            tile_qp_info.hpNumAlpha as u32,
                            i_alpha_pos,
                            tile_qp_info.bUseLPAlpha,
                        );
                    }
                }
            }
        } else if sc.WMISCP.sbSubband != Subband::DcOnly {
            write_packet_header(context.m_pIOLP, 2, p_id);
            if (sc.m_param.uQPMode & 2) != 0 {
                transcode_quantizers(
                    context.m_pIOLP,
                    tile_qp_info.lpIndex.as_mut_ptr(),
                    tile_qp_info.lpMode.as_mut_ptr(),
                    tile_qp_info.lpNum as u32,
                    sc.WMISCP.cChannel,
                    tile_qp_info.bUseDC,
                );
            }
            if !sc_alpha.is_null() && ((*sc_alpha).m_param.uQPMode & 2) != 0 {
                transcode_quantizers_alpha(
                    context.m_pIOLP,
                    tile_qp_info.lpIndex.as_mut_ptr(),
                    tile_qp_info.lpNumAlpha as u32,
                    i_alpha_pos,
                    tile_qp_info.bUseDCAlpha,
                );
            }

            if sc.WMISCP.sbSubband != Subband::NoHighpass {
                write_packet_header(context.m_pIOAC, 3, p_id);
                if (sc.m_param.uQPMode & 4) != 0 {
                    transcode_quantizers(
                        context.m_pIOAC,
                        tile_qp_info.hpIndex.as_mut_ptr(),
                        tile_qp_info.hpMode.as_mut_ptr(),
                        tile_qp_info.hpNum as u32,
                        sc.WMISCP.cChannel,
                        tile_qp_info.bUseLP,
                    );
                }
                if !sc_alpha.is_null() && ((*sc_alpha).m_param.uQPMode & 4) != 0 {
                    transcode_quantizers_alpha(
                        context.m_pIOAC,
                        tile_qp_info.hpIndex.as_mut_ptr(),
                        tile_qp_info.hpNumAlpha as u32,
                        i_alpha_pos,
                        tile_qp_info.bUseLPAlpha,
                    );
                }

                if sc.WMISCP.sbSubband != Subband::NoFlexbits {
                    write_packet_header(context.m_pIOFL, 4, p_id);
                    if sc.m_param.bTrimFlexbitsFlag != 0 {
                        put_bit16(context.m_pIOFL, context.m_iTrimFlexBits as u32, 4);
                    }
                }
            }
        }
        tile.cBitsLP = if tile_qp_info.bUseDC != 0 {
            0
        } else {
            dquant_bits(tile_qp_info.lpNum) as u8
        };
        tile.cBitsHP = if tile_qp_info.bUseLP != 0 {
            0
        } else {
            dquant_bits(tile_qp_info.hpNum) as u8
        };
        if !sc_alpha.is_null() {
            let Some(alpha_tile) = (*sc_alpha)
                .pTileMemory
                .as_deref_mut()
                .and_then(|tiles| tiles.get_mut(sc.cTileColumn))
            else {
                return;
            };
            alpha_tile.cBitsLP = if tile_qp_info.bUseDCAlpha != 0 {
                0
            } else {
                dquant_bits(tile_qp_info.lpNumAlpha) as u8
            };
            alpha_tile.cBitsHP = if tile_qp_info.bUseLPAlpha != 0 {
                0
            } else {
                dquant_bits(tile_qp_info.hpNumAlpha) as u8
            };
        }
    }
}

/// Original function: `transformDCBlock` at `original/jxrlib/image/decode/JXRTranscode.c:196`.
pub fn transform_dc_block(p_org: &mut [i32], p_dst: &mut [i32], o_orientation: Orientation) {
    debug_assert!(p_org.len() >= 16);
    debug_assert!(p_dst.len() >= 16);
    let o = o_orientation as usize;
    let mut i;

    if B_FLIP_V[o] != 0 {
        i = 0;
        while i < 16 {
            p_org[i + 1] = -p_org[i + 1];
            p_org[i + 3] = -p_org[i + 3];
            i += 4;
        }
    }

    if B_FLIP_H[o] != 0 {
        i = 0;
        while i < 4 {
            p_org[i + 4] = -p_org[i + 4];
            p_org[i + 12] = -p_org[i + 12];
            i += 1;
        }
    }

    if o_orientation < Orientation::RotateCw {
        p_dst[..16].copy_from_slice(&p_org[..16]);
    } else {
        i = 0;
        while i < 16 {
            p_dst[i] = p_org[(i >> 2) + ((i & 3) << 2)];
            i += 1;
        }
    }
}

/// Original function: `transformDCBlock422` at `original/jxrlib/image/decode/JXRTranscode.c:215`.
pub fn transform_dc_block422(p_org: &mut [i32], p_dst: &mut [i32], o_orientation: Orientation) {
    debug_assert!(o_orientation < Orientation::RotateCw);
    debug_assert!(p_org.len() >= 8);
    debug_assert!(p_dst.len() >= 8);
    let o = o_orientation as usize;

    if B_FLIP_V[o] != 0 {
        p_org[1] = -p_org[1];
        p_org[3] = -p_org[3];
        p_org[4] = -p_org[4];
        p_org[5] = -p_org[5];
        p_org[7] = -p_org[7];
    }

    if B_FLIP_H[o] != 0 {
        p_org[2] = -p_org[2];
        p_org[3] = -p_org[3];
        p_org[6] = -p_org[6];
        p_org[7] = -p_org[7];
    }

    if B_FLIP_V[o] != 0 {
        p_dst[0] = p_org[0];
        p_dst[1] = p_org[5];
        p_dst[2] = p_org[6];
        p_dst[3] = p_org[7];
        p_dst[4] = p_org[4];
        p_dst[5] = p_org[1];
        p_dst[6] = p_org[2];
        p_dst[7] = p_org[3];
    } else {
        p_dst[..8].copy_from_slice(&p_org[..8]);
    }
}

/// Original function: `transformDCBlock420` at `original/jxrlib/image/decode/JXRTranscode.c:231`.
pub fn transform_dc_block420(p_org: &mut [i32], p_dst: &mut [i32], o_orientation: Orientation) {
    debug_assert!(p_org.len() >= 4);
    debug_assert!(p_dst.len() >= 4);
    let o = o_orientation as usize;

    if B_FLIP_V[o] != 0 {
        p_org[1] = -p_org[1];
        p_org[3] = -p_org[3];
    }

    if B_FLIP_H[o] != 0 {
        p_org[2] = -p_org[2];
        p_org[3] = -p_org[3];
    }

    p_dst[0] = p_org[0];
    p_dst[3] = p_org[3];
    if o_orientation < Orientation::RotateCw {
        p_dst[1] = p_org[1];
        p_dst[2] = p_org[2];
    } else {
        p_dst[1] = p_org[2];
        p_dst[2] = p_org[1];
    }
}

/// Original function: `transformACBlocks` at `original/jxrlib/image/decode/JXRTranscode.c:246`.
pub fn transform_ac_blocks(p_org: &mut [i32], p_dst: &mut [i32], o_orientation: Orientation) {
    debug_assert!(p_org.len() >= 256);
    debug_assert!(p_dst.len() >= 256);
    let p_t = &dct_index[0];
    let o = o_orientation as usize;
    let mut j = 0;

    while j < 16 {
        let p_o = &mut p_org[j * 16..][..16];
        if B_FLIP_V[o] != 0 {
            let mut i = 0;
            while i < 16 {
                let i1 = p_t[i + 1] as usize;
                let i3 = p_t[i + 3] as usize;
                p_o[i1] = -p_o[i1];
                p_o[i3] = -p_o[i3];
                i += 4;
            }
        }

        if B_FLIP_H[o] != 0 {
            let mut i = 0;
            while i < 4 {
                let i4 = p_t[i + 4] as usize;
                let i12 = p_t[i + 12] as usize;
                p_o[i4] = -p_o[i4];
                p_o[i12] = -p_o[i12];
                i += 1;
            }
        }

        j += 1;
    }

    j = 0;
    while j < 4 {
        let mut i = 0;
        while i < 4 {
            let ii = if B_FLIP_V[o] != 0 { 3 - i } else { i };
            let jj = if B_FLIP_H[o] != 0 { 3 - j } else { j };

            if o_orientation < Orientation::RotateCw {
                let src = &p_org[(j * 4 + i) * 16..][..16];
                let dst = &mut p_dst[(jj * 4 + ii) * 16..][..16];
                dst.copy_from_slice(src);
            } else {
                let p_o = &p_org[(j * 4 + i) * 16..][..16];
                let p_d = &mut p_dst[(ii * 4 + jj) * 16..][..16];
                let mut k = 1;
                while k < 16 {
                    p_d[p_t[k] as usize] = p_o[p_t[(k >> 2) + ((k & 3) << 2)] as usize];
                    k += 1;
                }
            }
            i += 1;
        }
        j += 1;
    }
}

/// Original function: `transformACBlocks422` at `original/jxrlib/image/decode/JXRTranscode.c:278`.
pub fn transform_ac_blocks422(p_org: &mut [i32], p_dst: &mut [i32], o_orientation: Orientation) {
    debug_assert!(o_orientation < Orientation::RotateCw);
    debug_assert!(p_org.len() >= 128);
    debug_assert!(p_dst.len() >= 128);
    let p_t = &dct_index[0];
    let o = o_orientation as usize;
    let mut j = 0;

    while j < 8 {
        let p_o = &mut p_org[j * 16..][..16];
        if B_FLIP_V[o] != 0 {
            let mut i = 0;
            while i < 16 {
                let i1 = p_t[i + 1] as usize;
                let i3 = p_t[i + 3] as usize;
                p_o[i1] = -p_o[i1];
                p_o[i3] = -p_o[i3];
                i += 4;
            }
        }

        if B_FLIP_H[o] != 0 {
            let mut i = 0;
            while i < 4 {
                let i4 = p_t[i + 4] as usize;
                let i12 = p_t[i + 12] as usize;
                p_o[i4] = -p_o[i4];
                p_o[i12] = -p_o[i12];
                i += 1;
            }
        }

        j += 1;
    }

    j = 0;
    while j < 2 {
        let mut i = 0;
        while i < 4 {
            let ii = if B_FLIP_V[o] != 0 { 3 - i } else { i };
            let jj = if B_FLIP_H[o] != 0 { 1 - j } else { j };

            let src = &p_org[(j * 4 + i) * 16..][..16];
            let dst = &mut p_dst[(jj * 4 + ii) * 16..][..16];
            dst.copy_from_slice(src);
            i += 1;
        }
        j += 1;
    }
}

/// Original function: `transformACBlocks420` at `original/jxrlib/image/decode/JXRTranscode.c:305`.
pub fn transform_ac_blocks420(p_org: &mut [i32], p_dst: &mut [i32], o_orientation: Orientation) {
    debug_assert!(p_org.len() >= 64);
    debug_assert!(p_dst.len() >= 64);
    let p_t = &dct_index[0];
    let o = o_orientation as usize;
    let mut j = 0;

    while j < 4 {
        let p_o = &mut p_org[j * 16..][..16];
        if B_FLIP_V[o] != 0 {
            let mut i = 0;
            while i < 16 {
                let i1 = p_t[i + 1] as usize;
                let i3 = p_t[i + 3] as usize;
                p_o[i1] = -p_o[i1];
                p_o[i3] = -p_o[i3];
                i += 4;
            }
        }

        if B_FLIP_H[o] != 0 {
            let mut i = 0;
            while i < 4 {
                let i4 = p_t[i + 4] as usize;
                let i12 = p_t[i + 12] as usize;
                p_o[i4] = -p_o[i4];
                p_o[i12] = -p_o[i12];
                i += 1;
            }
        }

        j += 1;
    }

    j = 0;
    while j < 2 {
        let mut i = 0;
        while i < 2 {
            let ii = if B_FLIP_V[o] != 0 { 1 - i } else { i };
            let jj = if B_FLIP_H[o] != 0 { 1 - j } else { j };

            if o_orientation < Orientation::RotateCw {
                let src = &p_org[(j * 2 + i) * 16..][..16];
                let dst = &mut p_dst[(jj * 2 + ii) * 16..][..16];
                dst.copy_from_slice(src);
            } else {
                let p_o = &p_org[(j * 2 + i) * 16..][..16];
                let p_d = &mut p_dst[(ii * 2 + jj) * 16..][..16];
                let mut k = 1;
                while k < 16 {
                    p_d[p_t[k] as usize] = p_o[p_t[(k >> 2) + ((k & 3) << 2)] as usize];
                    k += 1;
                }
            }
            i += 1;
        }
        j += 1;
    }
}

/// Original function: `getROI` at `original/jxrlib/image/decode/JXRTranscode.c:337`.
pub unsafe fn get_roi(
    p_ii: *mut tagCWMImageInfo,
    p_core: *mut CWMImageStrCodecParameters,
    p_scp: *mut tagCWMIStrCodecParam,
    p_param: *mut tagCWMTranscodingParam,
) -> Result<(), WmpError> {
    let o_o = (*p_param).oOrientation;
    let mut i_tile = [0usize; MAX_TILES as usize];

    let roi_right = (*p_param)
        .cLeftX
        .checked_add((*p_param).cWidth)
        .ok_or(WmpError::Fail)?;
    let roi_bottom = (*p_param)
        .cTopY
        .checked_add((*p_param).cHeight)
        .ok_or(WmpError::Fail)?;
    if roi_right > (*p_ii).cWidth || roi_bottom > (*p_ii).cHeight {
        return Err(WmpError::Fail);
    }

    let mut c_width = (*p_param).cWidth;
    let mut c_height = (*p_param).cHeight;
    let mut i_left = (*p_param)
        .cLeftX
        .checked_add((*p_core).cExtraPixelsLeft)
        .ok_or(WmpError::Fail)?;
    let mut i_top = (*p_param)
        .cTopY
        .checked_add((*p_core).cExtraPixelsTop)
        .ok_or(WmpError::Fail)?;
    if (*p_scp).olOverlap != Overlap::None && (*p_param).bIgnoreOverlap == 0 {
        let c_blurred = if (*p_scp).olOverlap == Overlap::Two {
            10
        } else {
            2
        };

        if i_left > c_blurred {
            i_left -= c_blurred;
            c_width = c_width.checked_add(c_blurred).ok_or(WmpError::Fail)?;
        } else {
            c_width = c_width.checked_add(i_left).ok_or(WmpError::Fail)?;
            i_left = 0;
        }
        if i_top > c_blurred {
            i_top -= c_blurred;
            c_height = c_height.checked_add(c_blurred).ok_or(WmpError::Fail)?;
        } else {
            c_height = c_height.checked_add(i_top).ok_or(WmpError::Fail)?;
            i_top = 0;
        }
        c_width = c_width.checked_add(c_blurred).ok_or(WmpError::Fail)?;
        c_height = c_height.checked_add(c_blurred).ok_or(WmpError::Fail)?;
        let image_right = (*p_ii)
            .cWidth
            .checked_add((*p_core).cExtraPixelsLeft)
            .and_then(|v| v.checked_add((*p_core).cExtraPixelsRight))
            .ok_or(WmpError::Fail)?;
        if i_left.checked_add(c_width).ok_or(WmpError::Fail)? > image_right {
            c_width = image_right - i_left;
        }
        let image_bottom = (*p_ii)
            .cHeight
            .checked_add((*p_core).cExtraPixelsTop)
            .and_then(|v| v.checked_add((*p_core).cExtraPixelsBottom))
            .ok_or(WmpError::Fail)?;
        if i_top.checked_add(c_height).ok_or(WmpError::Fail)? > image_bottom {
            c_height = image_bottom - i_top;
        }
    }

    let mb_top = i_top >> 4;
    let mb_left = i_left >> 4;
    let mb_bottom = i_top
        .checked_add(c_height)
        .and_then(|v| v.checked_add(15))
        .ok_or(WmpError::Fail)?
        >> 4;
    let mb_right = i_left
        .checked_add(c_width)
        .and_then(|v| v.checked_add(15))
        .ok_or(WmpError::Fail)?
        >> 4;
    (*p_core).cExtraPixelsLeft += (*p_param).cLeftX - (mb_left << 4);
    (*p_core).cExtraPixelsRight =
        ((mb_right - mb_left) << 4) - (*p_param).cWidth - (*p_core).cExtraPixelsLeft;
    (*p_core).cExtraPixelsTop += (*p_param).cTopY - (mb_top << 4);
    (*p_core).cExtraPixelsBottom =
        ((mb_bottom - mb_top) << 4) - (*p_param).cHeight - (*p_core).cExtraPixelsTop;

    (*p_ii).cWidth =
        ((mb_right - mb_left) << 4) - (*p_core).cExtraPixelsLeft - (*p_core).cExtraPixelsRight;
    (*p_ii).cHeight =
        ((mb_bottom - mb_top) << 4) - (*p_core).cExtraPixelsTop - (*p_core).cExtraPixelsBottom;
    (*p_param).cLeftX = i_left;
    (*p_param).cTopY = i_top;
    (*p_param).cWidth = c_width;
    (*p_param).cHeight = c_height;

    if o_o == Orientation::FlipH
        || o_o == Orientation::FlipVH
        || o_o == Orientation::RotateCwFlipV
        || o_o == Orientation::RotateCwFlipVH
    {
        let i = (*p_core).cExtraPixelsLeft;
        (*p_core).cExtraPixelsLeft = (*p_core).cExtraPixelsRight;
        (*p_core).cExtraPixelsRight = i;
    }
    if o_o == Orientation::FlipV
        || o_o == Orientation::FlipVH
        || o_o == Orientation::RotateCw
        || o_o == Orientation::RotateCwFlipV
    {
        let i = (*p_core).cExtraPixelsTop;
        (*p_core).cExtraPixelsTop = (*p_core).cExtraPixelsBottom;
        (*p_core).cExtraPixelsBottom = i;
    }
    if o_o >= Orientation::RotateCw {
        let i = (*p_core).cExtraPixelsLeft;
        (*p_core).cExtraPixelsLeft = (*p_core).cExtraPixelsTop;
        (*p_core).cExtraPixelsTop = i;
        let i = (*p_core).cExtraPixelsRight;
        (*p_core).cExtraPixelsRight = (*p_core).cExtraPixelsBottom;
        (*p_core).cExtraPixelsBottom = i;
    }

    {
        let scp = &mut *p_scp;
        let tile_x_count = scp.cNumOfSliceMinus1V as usize + 1;
        let mut selected_len = 0usize;
        i_tile[0] = 0;
        for &tile_x in scp.uiTileX[..tile_x_count].iter() {
            let tile_x = tile_x as usize;
            if (mb_left..mb_right).contains(&tile_x) {
                i_tile[selected_len] = tile_x - mb_left;
                selected_len += 1;
            }
        }
        if i_tile[0] == 0 {
            scp.cNumOfSliceMinus1V = selected_len.saturating_sub(1) as u32;
            for (dst, &src) in scp.uiTileX.iter_mut().zip(i_tile[..selected_len].iter()) {
                *dst = src as u32;
            }
        } else {
            scp.uiTileX[0] = 0;
            scp.cNumOfSliceMinus1V = selected_len as u32;
            for (dst, &src) in scp.uiTileX[1..=selected_len]
                .iter_mut()
                .zip(i_tile[..selected_len].iter())
            {
                *dst = src as u32;
            }
        }
    }
    if o_o == Orientation::FlipH
        || o_o == Orientation::FlipVH
        || o_o == Orientation::RotateCwFlipV
        || o_o == Orientation::RotateCwFlipVH
    {
        let scp = &mut *p_scp;
        let tile_x_count = scp.cNumOfSliceMinus1V as usize + 1;
        for (scratch, &tile_x) in i_tile.iter_mut().zip(scp.uiTileX[..tile_x_count].iter()) {
            *scratch = mb_right - mb_left - tile_x as usize;
        }
        scp.uiTileX[0] = 0;
        for (dst, &src) in scp.uiTileX[1..tile_x_count]
            .iter_mut()
            .zip(i_tile[1..tile_x_count].iter().rev())
        {
            *dst = src as u32;
        }
    }

    {
        let scp = &mut *p_scp;
        let tile_y_count = scp.cNumOfSliceMinus1H as usize + 1;
        let mut selected_len = 0usize;
        i_tile[0] = 0;
        for &tile_y in scp.uiTileY[..tile_y_count].iter() {
            let tile_y = tile_y as usize;
            if (mb_top..mb_bottom).contains(&tile_y) {
                i_tile[selected_len] = tile_y - mb_top;
                selected_len += 1;
            }
        }
        if i_tile[0] == 0 {
            scp.cNumOfSliceMinus1H = selected_len.saturating_sub(1) as u32;
            for (dst, &src) in scp.uiTileY.iter_mut().zip(i_tile[..selected_len].iter()) {
                *dst = src as u32;
            }
        } else {
            scp.uiTileY[0] = 0;
            scp.cNumOfSliceMinus1H = selected_len as u32;
            for (dst, &src) in scp.uiTileY[1..=selected_len]
                .iter_mut()
                .zip(i_tile[..selected_len].iter())
            {
                *dst = src as u32;
            }
        }
    }
    if o_o == Orientation::FlipV
        || o_o == Orientation::FlipVH
        || o_o == Orientation::RotateCw
        || o_o == Orientation::RotateCwFlipV
    {
        let scp = &mut *p_scp;
        let tile_y_count = scp.cNumOfSliceMinus1H as usize + 1;
        for (scratch, &tile_y) in i_tile.iter_mut().zip(scp.uiTileY[..tile_y_count].iter()) {
            *scratch = mb_bottom - mb_top - tile_y as usize;
        }
        scp.uiTileY[0] = 0;
        for (dst, &src) in scp.uiTileY[1..tile_y_count]
            .iter_mut()
            .zip(i_tile[1..tile_y_count].iter().rev())
        {
            *dst = src as u32;
        }
    }
    if o_o >= Orientation::RotateCw {
        let scp = &mut *p_scp;
        let tile_x_count = scp.cNumOfSliceMinus1V as usize + 1;
        let tile_y_count = scp.cNumOfSliceMinus1H as usize + 1;
        for (scratch, &tile_x) in i_tile.iter_mut().zip(scp.uiTileX[..tile_x_count].iter()) {
            *scratch = tile_x as usize;
        }
        for (dst, &src) in scp
            .uiTileX
            .iter_mut()
            .zip(scp.uiTileY[..tile_y_count].iter())
        {
            *dst = src;
        }
        for (dst, &src) in scp.uiTileY.iter_mut().zip(i_tile[..tile_x_count].iter()) {
            *dst = src as u32;
        }
        std::mem::swap(&mut scp.cNumOfSliceMinus1H, &mut scp.cNumOfSliceMinus1V);
    }

    Ok(())
}

/// Original function: `isTileBoundary` at `original/jxrlib/image/decode/JXRTranscode.c:445`.
pub unsafe fn is_tile_boundary(tile_pos: &[u32], c_tiles: u32, c_mbs: u32, i_pos: u32) -> i32 {
    let mut i = 0;

    while i < c_tiles {
        if i_pos == tile_pos[i as usize] * 16 {
            break;
        }
        i += 1;
    }

    if i < c_tiles || (i_pos + 15) / 16 >= c_mbs {
        1
    } else {
        0
    }
}

/// Original function: `isTileExtraction` at `original/jxrlib/image/decode/JXRTranscode.c:456`.
pub unsafe fn is_tile_extraction(
    p_sc: *mut CWMImageStrCodec,
    p_param: *mut tagCWMTranscodingParam,
) -> i32 {
    if (*p_param).bIgnoreOverlap == 0 && (*p_sc).WMISCP.olOverlap == Overlap::None {
        (*p_param).bIgnoreOverlap = 1;
    }

    if (*p_param).bIgnoreOverlap == 1
        && (*p_param).oOrientation == Orientation::None
        && (*p_param).bfBitstreamFormat == (*p_sc).WMISCP.bfBitstreamFormat
    {
        if (*p_param).bfBitstreamFormat == BitstreamFormat::Spatial
            && (*p_param).sbSubband != (*p_sc).WMISCP.sbSubband
        {
            return 0;
        }

        if is_tile_boundary(
            &(*p_sc).WMISCP.uiTileX,
            (*p_sc).WMISCP.cNumOfSliceMinus1V + 1,
            (*p_sc).cmbWidth as u32,
            ((*p_param).cLeftX + (*p_sc).m_param.cExtraPixelsLeft) as u32,
        ) != 0
            && is_tile_boundary(
                &(*p_sc).WMISCP.uiTileY,
                (*p_sc).WMISCP.cNumOfSliceMinus1H + 1,
                (*p_sc).cmbHeight as u32,
                ((*p_param).cTopY + (*p_sc).m_param.cExtraPixelsTop) as u32,
            ) != 0
            && is_tile_boundary(
                &(*p_sc).WMISCP.uiTileX,
                (*p_sc).WMISCP.cNumOfSliceMinus1V + 1,
                (*p_sc).cmbWidth as u32,
                ((*p_param).cLeftX + (*p_param).cWidth + (*p_sc).m_param.cExtraPixelsLeft) as u32,
            ) != 0
            && is_tile_boundary(
                &(*p_sc).WMISCP.uiTileY,
                (*p_sc).WMISCP.cNumOfSliceMinus1H + 1,
                (*p_sc).cmbHeight as u32,
                ((*p_param).cTopY + (*p_param).cHeight + (*p_sc).m_param.cExtraPixelsTop) as u32,
            ) != 0
        {
            return 1;
        }

        return 0;
    }

    0
}

/// Original function: `WMPhotoTranscode` at `original/jxrlib/image/decode/JXRTranscode.c:474`.
pub unsafe fn wm_photo_transcode(
    p_stream_in: *mut WMPStream,
    p_stream_out: *mut WMPStream,
    p_param: *mut tagCWMTranscodingParam,
) -> Result<(), WmpError> {
    let mut mb_buf_alpha = [0 as i32; 256];
    let mut mb_buf = Vec::<i32>::new();
    let mut frame_buf = Vec::<i32>::new();
    let mut frame_buf_alpha = Vec::<i32>::new();
    let mut mb_info = Vec::<tagCWMIMBInfo>::new();
    let mut mb_info_alpha = Vec::<tagCWMIMBInfo>::new();
    let mut tile_qp_info = Vec::<CTileQPInfo>::new();
    let mut enc_index_table = Vec::<usize>::new();
    let mut a_decoder_param = CWMDecoderParameters::default();
    let mut io_header_dec = Vec::<usize>::new();
    let mut io_header_enc = Vec::<usize>::new();
    let mut i_alpha_pos = 0usize;

    if p_stream_in.is_null() || p_stream_out.is_null() || p_param.is_null() {
        return Err(WmpError::Fail);
    }

    let mut o_o = (*p_param).oOrientation;
    let mut p_sc_dec_storage = Box::<CWMImageStrCodec>::default();
    let mut p_sc_dec_next_storage: Option<Box<CWMImageStrCodec>> = None;
    let p_sc_dec = NonNull::from(p_sc_dec_storage.as_mut()).as_ptr();
    let mut p_sc_dec_next = std::ptr::null_mut();

    (*p_sc_dec).WMISCP.pWStream = NonNull::new(p_stream_in);
    if read_wmi_header(
        std::ptr::addr_of_mut!((*p_sc_dec).WMII),
        std::ptr::addr_of_mut!((*p_sc_dec).WMISCP),
        std::ptr::addr_of_mut!((*p_sc_dec).m_param),
    )
    .is_err()
    {
        return Err(WmpError::Fail);
    }

    if (*p_sc_dec).WMISCP.cfColorFormat == ColorFormat::Yuv422 && o_o >= Orientation::RotateCw {
        (*p_param).oOrientation = Orientation::None;
        o_o = Orientation::None;
    }

    (*p_sc_dec).cmbWidth = ((*p_sc_dec).WMII.cWidth
        + (*p_sc_dec).m_param.cExtraPixelsLeft
        + (*p_sc_dec).m_param.cExtraPixelsRight
        + 15)
        / 16;
    (*p_sc_dec).cmbHeight = ((*p_sc_dec).WMII.cHeight
        + (*p_sc_dec).m_param.cExtraPixelsTop
        + (*p_sc_dec).m_param.cExtraPixelsBottom
        + 15)
        / 16;
    (*p_sc_dec).m_param.cNumChannels = (*p_sc_dec).WMISCP.cChannel;
    (*p_sc_dec).m_Dparam = Some(NonNull::from(&mut a_decoder_param));
    // m_Dparam was just assigned Some above; C assigns then derefs unconditionally
    (*(*p_sc_dec)
        .m_Dparam
        .expect("m_Dparam assigned Some on the preceding line")
        .as_ptr())
    .bSkipFlexbits = ((*p_sc_dec).WMISCP.sbSubband == Subband::NoFlexbits) as i32;
    (*p_sc_dec).m_param.bTranscode = 1;

    (*p_param).bIgnoreOverlap = is_tile_extraction(p_sc_dec, p_param);

    let c_unit = if (*p_sc_dec).m_param.cfColorFormat == ColorFormat::Yuv420 {
        384
    } else if (*p_sc_dec).m_param.cfColorFormat == ColorFormat::Yuv422 {
        512
    } else {
        256 * (*p_sc_dec).m_param.cNumChannels
    };
    if c_unit > 256 * MAX_CHANNELS {
        return Err(WmpError::Fail);
    }
    if mb_buf.try_reserve_exact(c_unit).is_err() {
        return Err(WmpError::Fail);
    }
    mb_buf.resize(c_unit, 0);
    let p_mb_buf = mb_buf.as_mut_ptr();
    (*p_sc_dec).p1MBbuffer[0] = NonNull::new(p_mb_buf);
    (*p_sc_dec).p1MBbuffer[1] =
        (*p_sc_dec).p1MBbuffer[0].and_then(|p| NonNull::new(p.as_ptr().add(256)));
    let mut i = 2usize;
    while i < (*p_sc_dec).m_param.cNumChannels {
        (*p_sc_dec).p1MBbuffer[i] = (*p_sc_dec).p1MBbuffer[i - 1].and_then(|p| {
            NonNull::new(p.as_ptr().add(
                if (*p_sc_dec).m_param.cfColorFormat == ColorFormat::Yuv420 {
                    64
                } else if (*p_sc_dec).m_param.cfColorFormat == ColorFormat::Yuv422 {
                    128
                } else {
                    256
                },
            ))
        });
        i += 1;
    }

    if (*p_sc_dec).m_param.bAlphaChannel != 0 {
        let mut sb = tagSimpleBitIO {
            pWS: None,
            cbRead: 0,
            bAccumulator: 0,
            cBitLeft: 0,
            read_error: None,
        };
        i_alpha_pos = (*p_sc_dec).m_param.cNumChannels;
        p_sc_dec_next_storage = Some(Box::<CWMImageStrCodec>::default());
        let Some(next_sc) = p_sc_dec_next_storage.as_mut() else {
            return Err(WmpError::Fail);
        };
        let next_sc_ptr = NonNull::from(next_sc.as_mut());
        (*p_sc_dec).m_pNextSC = Some(next_sc_ptr);
        p_sc_dec_next = next_sc_ptr.as_ptr();
        *p_sc_dec_next = (*p_sc_dec).clone();
        (*p_sc_dec_next).pNextSCMemory = None;
        (*p_sc_dec_next).pCodingContextMemory = None;
        (*p_sc_dec_next).cNumCodingContext = 0;
        (*p_sc_dec_next).m_ppBitIO = None;
        (*p_sc_dec_next).m_ppBitIOMemory = None;
        (*p_sc_dec_next).cBitIOMemory = 0;
        (*p_sc_dec_next).pIndexTableMemory = None;
        (*p_sc_dec_next).cIndexTableMemory = 0;
        (*p_sc_dec_next).pTileMemory = None;
        (*p_sc_dec_next).cTileMemory = 0;
        (*p_sc_dec_next).cResMemory = 0;
        (*p_sc_dec_next).PredInfo = [None; MAX_CHANNELS];
        (*p_sc_dec_next).PredInfoPrevRow = [None; MAX_CHANNELS];
        (*p_sc_dec_next).pPredInfoMemory = None;
        (*p_sc_dec_next).cPredInfoMemory = 0;
        (*p_sc_dec_next).ppWStream = None;
        (*p_sc_dec_next).ppWStreamMemory = None;
        (*p_sc_dec_next).cWStreamMemory = 0;
        (*p_sc_dec_next).cTempFileMemory = 0;
        (*p_sc_dec_next).pResU = None;
        (*p_sc_dec_next).pResV = None;
        (*p_sc_dec_next).pResUMemory = None;
        (*p_sc_dec_next).pResVMemory = None;
        (*p_sc_dec_next).ppTempFileNameMemory = None;
        (*p_sc_dec_next).pPostProcInfo = [[None; 2]; MAX_CHANNELS];
        (*p_sc_dec_next).pPostProcInfoMemory = Default::default();
        (*p_sc_dec_next).p1MBbuffer[0] = NonNull::new(mb_buf_alpha.as_mut_ptr());
        (*p_sc_dec_next).WMISCP.cfColorFormat = ColorFormat::YOnly;
        (*p_sc_dec_next).WMII.cfColorFormat = ColorFormat::YOnly;
        (*p_sc_dec_next).m_param.cfColorFormat = ColorFormat::YOnly;
        (*p_sc_dec_next).WMISCP.cChannel = 1;
        (*p_sc_dec_next).m_param.cNumChannels = 1;
        (*p_sc_dec_next).m_bUVResolutionChange = 0;
        (*p_sc_dec_next).m_bSecondary = 1;
        (*p_sc_dec_next).m_pNextSC = NonNull::new(p_sc_dec);

        let Some(p_wstream) = (*p_sc_dec).WMISCP.pWStream.map(NonNull::as_ptr) else {
            return Err(WmpError::Fail);
        };
        if attach_sb(&mut sb, &mut *p_wstream).is_err() {
            return Err(WmpError::Fail);
        }
        // C discards this return (faithful to WMPhotoTranscode)
        let _ = read_image_plane_header(
            std::ptr::addr_of_mut!((*p_sc_dec_next).WMII),
            std::ptr::addr_of_mut!((*p_sc_dec_next).WMISCP),
            std::ptr::addr_of_mut!((*p_sc_dec_next).m_param),
            &mut sb,
        );
        let _ = detach_sb(&mut sb);

        if str_dec_init(&mut *p_sc_dec_next).is_err() {
            return Err(WmpError::Fail);
        }
    } else {
        (*p_param).uAlphaMode = AlphaMode::None as u8;
    }

    let Some(alpha_mode) = AlphaMode::from_u8((*p_param).uAlphaMode) else {
        return Err(WmpError::Fail);
    };
    let has_alpha_mode = alpha_mode != AlphaMode::None;

    let io_header_size =
        (PACKETLENGTH * 4 - 1) + PACKETLENGTH * 4 + std::mem::size_of::<tagBitIOInfo>();
    let io_header_words = io_header_size.div_ceil(std::mem::size_of::<usize>());
    if io_header_dec.try_reserve_exact(io_header_words).is_err() {
        return Err(WmpError::Fail);
    }
    io_header_dec.resize(io_header_words, 0);
    let p_io_header_dec = io_header_dec.as_mut_ptr().cast::<u8>();
    let p_io_header_dec = (((p_io_header_dec as usize + PACKETLENGTH * 4 - 1)
        & !(PACKETLENGTH * 4 - 1))
        + PACKETLENGTH * 2) as *mut tagBitIOInfo;
    let Some(p_io_header_dec) = NonNull::new(p_io_header_dec) else {
        return Err(WmpError::Fail);
    };
    (*p_sc_dec).pIOHeader = Some(p_io_header_dec);

    if str_io_dec_init(&mut *p_sc_dec).is_err() {
        return Err(WmpError::Fail);
    }
    if str_dec_init(&mut *p_sc_dec).is_err() {
        return Err(WmpError::Fail);
    }
    if (*p_sc_dec).m_param.bAlphaChannel != 0 && str_dec_init(&mut *p_sc_dec_next).is_err() {
        return Err(WmpError::Fail);
    }

    let mut p_sc_enc_storage = Box::<CWMImageStrCodec>::default();
    let mut p_sc_enc_next_storage: Option<Box<CWMImageStrCodec>> = None;
    let p_sc_enc = NonNull::from(p_sc_enc_storage.as_mut()).as_ptr();
    let mut p_sc_enc_next = std::ptr::null_mut();

    (*p_sc_enc).WMII = (*p_sc_dec).WMII;
    (*p_sc_enc).WMISCP = (*p_sc_dec).WMISCP;
    (*p_sc_enc).m_param = (*p_sc_dec).m_param.clone();
    (*p_sc_enc).WMISCP.pWStream = NonNull::new(p_stream_out);
    (*p_sc_enc).WMISCP.bfBitstreamFormat = (*p_param).bfBitstreamFormat;
    (*p_sc_enc).m_param.cfColorFormat = (*p_sc_enc).WMISCP.cfColorFormat;
    (*p_sc_enc).m_param.cNumChannels = if (*p_sc_enc).WMISCP.cfColorFormat == ColorFormat::YOnly {
        1
    } else if (*p_sc_enc).WMISCP.cfColorFormat == ColorFormat::Yuv444 {
        3
    } else {
        (*p_sc_enc).WMISCP.cChannel
    };
    (*p_sc_enc).m_param.bAlphaChannel = has_alpha_mode as i32;
    (*p_sc_enc).m_param.bTranscode = 1;
    if (*p_param).sbSubband >= Subband::Max {
        (*p_param).sbSubband = Subband::All;
    }
    if (*p_param).sbSubband > (*p_sc_enc).WMISCP.sbSubband {
        (*p_sc_enc).WMISCP.sbSubband = (*p_param).sbSubband;
    }
    (*p_sc_enc).m_bSecondary = 0;

    if io_header_enc.try_reserve_exact(io_header_words).is_err() {
        return Err(WmpError::Fail);
    }
    io_header_enc.resize(io_header_words, 0);
    let p_io_header_enc = io_header_enc.as_mut_ptr().cast::<u8>();
    let p_io_header_enc = (((p_io_header_enc as usize + PACKETLENGTH * 4 - 1)
        & !(PACKETLENGTH * 4 - 1))
        + PACKETLENGTH * 2) as *mut tagBitIOInfo;
    let Some(p_io_header_enc) = NonNull::new(p_io_header_enc) else {
        return Err(WmpError::Fail);
    };
    (*p_sc_enc).pIOHeader = Some(p_io_header_enc);

    i = 0;
    while i < (*p_sc_enc).m_param.cNumChannels {
        (*p_sc_enc).pPlane[i] = (*p_sc_dec).p1MBbuffer[i];
        i += 1;
    }

    let total_dec_index =
        (*p_sc_dec).cNumBitIO * ((*p_sc_dec).WMISCP.cNumOfSliceMinus1H as usize + 1);
    i = 1;
    let dec_index_table = (*p_sc_dec)
        .pIndexTableMemory
        .as_deref_mut()
        .map(|table| table.as_mut_ptr());
    while i < total_dec_index {
        let Some(dec_index_table) = dec_index_table else {
            return Err(WmpError::Fail);
        };
        if *dec_index_table.add(i) == 0 && i + 1 != total_dec_index {
            *dec_index_table.add(i) = *dec_index_table.add(i + 1);
        }
        if *dec_index_table.add(i) != 0 && *dec_index_table.add(i) < *dec_index_table.add(i - 1) {
            (*p_param).bIgnoreOverlap = 0;
        }
        i += 1;
    }

    if get_roi(
        std::ptr::addr_of_mut!((*p_sc_enc).WMII),
        std::ptr::addr_of_mut!((*p_sc_enc).m_param),
        std::ptr::addr_of_mut!((*p_sc_enc).WMISCP),
        p_param,
    )
    .is_err()
    {
        return Err(WmpError::Fail);
    }

    let mb_left = (*p_param).cLeftX >> 4;
    let mb_right = (*p_param)
        .cLeftX
        .checked_add((*p_param).cWidth)
        .and_then(|v| v.checked_add(15))
        .ok_or(WmpError::Fail)?
        >> 4;
    let mb_top = (*p_param).cTopY >> 4;
    let mb_bottom = (*p_param)
        .cTopY
        .checked_add((*p_param).cHeight)
        .and_then(|v| v.checked_add(15))
        .ok_or(WmpError::Fail)?
        >> 4;

    if (*p_sc_dec).WMISCP.uiTileX[(*p_sc_dec).WMISCP.cNumOfSliceMinus1V as usize] as usize
        >= mb_left
        && (*p_sc_dec).WMISCP.uiTileX[(*p_sc_dec).WMISCP.cNumOfSliceMinus1V as usize] as usize
            <= mb_right
        && (*p_sc_dec).WMISCP.uiTileY[(*p_sc_dec).WMISCP.cNumOfSliceMinus1H as usize] as usize
            >= mb_top
        && (*p_sc_dec).WMISCP.uiTileY[(*p_sc_dec).WMISCP.cNumOfSliceMinus1H as usize] as usize
            <= mb_bottom
    {
        (*p_param).bIgnoreOverlap = 0;
    }

    (*p_sc_enc).bTileExtraction = (*p_param).bIgnoreOverlap;
    let mb_width = mb_right - mb_left;
    let mb_height = mb_bottom - mb_top;
    (*p_sc_enc).cmbWidth = mb_width;
    (*p_sc_enc).cmbHeight = mb_height;
    if o_o >= Orientation::RotateCw {
        std::mem::swap(&mut (*p_sc_enc).WMII.cWidth, &mut (*p_sc_enc).WMII.cHeight);
        std::mem::swap(&mut (*p_sc_enc).cmbWidth, &mut (*p_sc_enc).cmbHeight);
    }

    if o_o != Orientation::None {
        let frame_count = (*p_sc_enc).cmbWidth * (*p_sc_enc).cmbHeight;
        let Some(frame_sample_count) = frame_count.checked_mul(c_unit) else {
            return Err(WmpError::Fail);
        };
        let Some(frame_byte_count) = frame_sample_count.checked_mul(std::mem::size_of::<i32>())
        else {
            return Err(WmpError::Fail);
        };
        if frame_byte_count < frame_sample_count {
            return Err(WmpError::Fail);
        }
        if frame_buf.try_reserve_exact(frame_sample_count).is_err() {
            return Err(WmpError::Fail);
        }
        frame_buf.resize(frame_sample_count, 0);

        let Some(mb_info_byte_count) =
            frame_count.checked_mul(std::mem::size_of::<tagCWMIMBInfo>())
        else {
            return Err(WmpError::Fail);
        };
        if mb_info_byte_count < frame_count {
            return Err(WmpError::Fail);
        }
        if mb_info.try_reserve_exact(frame_count).is_err() {
            return Err(WmpError::Fail);
        }
        mb_info.resize_with(frame_count, tagCWMIMBInfo::default);

        if has_alpha_mode {
            let Some(alpha_sample_count) = frame_count.checked_mul(256) else {
                return Err(WmpError::Fail);
            };
            let Some(alpha_byte_count) = alpha_sample_count.checked_mul(std::mem::size_of::<i32>())
            else {
                return Err(WmpError::Fail);
            };
            if alpha_byte_count < alpha_sample_count {
                return Err(WmpError::Fail);
            }
            if frame_buf_alpha
                .try_reserve_exact(alpha_sample_count)
                .is_err()
            {
                return Err(WmpError::Fail);
            }
            frame_buf_alpha.resize(alpha_sample_count, 0);

            if mb_info_alpha.try_reserve_exact(frame_count).is_err() {
                return Err(WmpError::Fail);
            }
            mb_info_alpha.resize_with(frame_count, tagCWMIMBInfo::default);
        }
    }

    if o_o < Orientation::RotateCw && (*p_sc_enc).WMII.oOrientation < Orientation::RotateCw {
        (*p_sc_enc).WMII.oOrientation ^= o_o;
    } else if o_o >= Orientation::RotateCw && (*p_sc_enc).WMII.oOrientation >= Orientation::RotateCw
    {
        (*p_sc_enc).WMII.oOrientation ^= o_o;
        (*p_sc_enc).WMII.oOrientation =
            match ((*p_sc_enc).WMII.oOrientation & 1) * 2 + ((*p_sc_enc).WMII.oOrientation >> 1) {
                0 => Orientation::None,
                1 => Orientation::FlipV,
                2 => Orientation::FlipH,
                3 => Orientation::FlipVH,
                4 => Orientation::RotateCw,
                5 => Orientation::RotateCwFlipV,
                6 => Orientation::RotateCwFlipH,
                7 => Orientation::RotateCwFlipVH,
                _ => Orientation::Max,
            };
    } else if o_o >= Orientation::RotateCw && (*p_sc_enc).WMII.oOrientation < Orientation::RotateCw
    {
        (*p_sc_enc).WMII.oOrientation =
            o_o ^ (((*p_sc_enc).WMII.oOrientation & 1) * 2 + ((*p_sc_enc).WMII.oOrientation >> 1));
    } else {
        (*p_sc_enc).WMII.oOrientation ^= match (o_o & 1) * 2 + (o_o >> 1) {
            0 => Orientation::None,
            1 => Orientation::FlipV,
            2 => Orientation::FlipH,
            3 => Orientation::FlipVH,
            4 => Orientation::RotateCw,
            5 => Orientation::RotateCwFlipV,
            6 => Orientation::RotateCwFlipH,
            7 => Orientation::RotateCwFlipVH,
            _ => Orientation::Max,
        };
    }

    if (*p_param).bIgnoreOverlap == 1 {
        let Some(p_wstream) = (*p_sc_enc).WMISCP.pWStream.map(NonNull::as_ptr) else {
            return Err(WmpError::Fail);
        };
        let Some(p_io_header) = (*p_sc_enc).pIOHeader.map(NonNull::as_ptr) else {
            return Err(WmpError::Fail);
        };
        let _ = attach_is_write(p_io_header, p_wstream);
        (*p_sc_enc).pTileMemory = (*p_sc_dec).pTileMemory.clone();
        (*p_sc_enc).cTileMemory = (*p_sc_enc)
            .pTileMemory
            .as_ref()
            .map_or(0, |tiles| tiles.len());
        if (*p_sc_enc)
            .WMISCP
            .cNumOfSliceMinus1H
            .wrapping_add((*p_sc_enc).WMISCP.cNumOfSliceMinus1V)
            == 0
            && (*p_sc_enc).WMISCP.bfBitstreamFormat == BitstreamFormat::Spatial
        {
            (*p_sc_enc).m_param.bIndexTable = 0;
        }
        write_wmi_header(&mut *p_sc_enc)?;
    } else {
        let tile_qp_count = if o_o == Orientation::None {
            1
        } else {
            ((*p_sc_enc).WMISCP.cNumOfSliceMinus1H as usize + 1)
                * ((*p_sc_enc).WMISCP.cNumOfSliceMinus1V as usize + 1)
        };
        let Some(tile_qp_byte_count) =
            tile_qp_count.checked_mul(std::mem::size_of::<CTileQPInfo>())
        else {
            return Err(WmpError::Fail);
        };
        if tile_qp_byte_count < tile_qp_count {
            return Err(WmpError::Fail);
        }
        if tile_qp_info.try_reserve_exact(tile_qp_count).is_err() {
            return Err(WmpError::Fail);
        }
        tile_qp_info.resize_with(tile_qp_count, CTileQPInfo::default);
        if str_enc_init(&mut *p_sc_enc).is_err() {
            return Err(WmpError::Fail);
        }
    }

    if has_alpha_mode {
        p_sc_enc_next_storage = Some(Box::<CWMImageStrCodec>::default());
        let Some(next_sc) = p_sc_enc_next_storage.as_mut() else {
            return Err(WmpError::Fail);
        };
        let next_sc_ptr = NonNull::from(next_sc.as_mut());
        (*p_sc_enc).m_pNextSC = Some(next_sc_ptr);
        p_sc_enc_next = next_sc_ptr.as_ptr();
        *p_sc_enc_next = (*p_sc_enc).clone();
        (*p_sc_enc_next).pNextSCMemory = None;
        (*p_sc_enc_next).pCodingContextMemory = None;
        (*p_sc_enc_next).cNumCodingContext = 0;
        (*p_sc_enc_next).m_ppBitIO = None;
        (*p_sc_enc_next).m_ppBitIOMemory = None;
        (*p_sc_enc_next).cBitIOMemory = 0;
        (*p_sc_enc_next).pIndexTableMemory = None;
        (*p_sc_enc_next).cIndexTableMemory = 0;
        (*p_sc_enc_next).pTileMemory = None;
        (*p_sc_enc_next).cTileMemory = 0;
        (*p_sc_enc_next).cResMemory = 0;
        (*p_sc_enc_next).PredInfo = [None; MAX_CHANNELS];
        (*p_sc_enc_next).PredInfoPrevRow = [None; MAX_CHANNELS];
        (*p_sc_enc_next).pPredInfoMemory = None;
        (*p_sc_enc_next).cPredInfoMemory = 0;
        (*p_sc_enc_next).ppWStream = None;
        (*p_sc_enc_next).ppWStreamMemory = None;
        (*p_sc_enc_next).cWStreamMemory = 0;
        (*p_sc_enc_next).cTempFileMemory = 0;
        (*p_sc_enc_next).pResU = None;
        (*p_sc_enc_next).pResV = None;
        (*p_sc_enc_next).pResUMemory = None;
        (*p_sc_enc_next).pResVMemory = None;
        (*p_sc_enc_next).ppTempFileNameMemory = None;
        (*p_sc_enc_next).pPostProcInfo = [[None; 2]; MAX_CHANNELS];
        (*p_sc_enc_next).pPostProcInfoMemory = Default::default();
        (*p_sc_enc_next).pPlane[0] = (*p_sc_dec_next).p1MBbuffer[0];
        (*p_sc_enc_next).WMISCP.cfColorFormat = ColorFormat::YOnly;
        (*p_sc_enc_next).WMII.cfColorFormat = ColorFormat::YOnly;
        (*p_sc_enc_next).m_param.cfColorFormat = ColorFormat::YOnly;
        (*p_sc_enc_next).WMISCP.cChannel = 1;
        (*p_sc_enc_next).m_param.cNumChannels = 1;
        (*p_sc_enc_next).m_bUVResolutionChange = 0;
        (*p_sc_enc_next).m_bSecondary = 1;
        (*p_sc_enc_next).m_pNextSC = NonNull::new(p_sc_enc);
        (*p_sc_enc_next).m_param = (*p_sc_dec_next).m_param.clone();
        (*p_sc_enc).m_param.bAlphaChannel = 1;

        if (*p_param).bIgnoreOverlap == 1 {
            (*p_sc_enc_next).pTileMemory = (*p_sc_dec_next).pTileMemory.clone();
            (*p_sc_enc_next).cTileMemory = (*p_sc_enc_next)
                .pTileMemory
                .as_ref()
                .map_or(0, |tiles| tiles.len());
        } else if str_enc_init(&mut *p_sc_enc_next).is_err() {
            return Err(WmpError::Fail);
        }
        // C discards this return (faithful to WMPhotoTranscode)
        let _ = write_image_plane_header(&mut *p_sc_enc_next);
    }

    if (*p_param).bIgnoreOverlap == 1 {
        let sb_enc = (*p_sc_enc).WMISCP.sbSubband;
        let sb_dec = (*p_sc_dec).WMISCP.sbSubband;
        let cf_enc = if (*p_sc_enc).WMISCP.bfBitstreamFormat == BitstreamFormat::Spatial
            || sb_enc == Subband::DcOnly
        {
            1
        } else if sb_enc == Subband::NoHighpass {
            2
        } else if sb_enc == Subband::NoFlexbits {
            3
        } else {
            4
        };
        let cf_dec = if (*p_sc_dec).WMISCP.bfBitstreamFormat == BitstreamFormat::Spatial
            || sb_dec == Subband::DcOnly
        {
            1
        } else if sb_dec == Subband::NoHighpass {
            2
        } else if sb_dec == Subband::NoFlexbits {
            3
        } else {
            4
        };
        let Some(index_row_count) = ((*p_sc_enc).WMISCP.cNumOfSliceMinus1H as usize + 1)
            .checked_mul((*p_sc_enc).WMISCP.cNumOfSliceMinus1V as usize + 1)
        else {
            return Err(WmpError::Fail);
        };
        let Some(index_count) = index_row_count.checked_mul(cf_enc) else {
            return Err(WmpError::Fail);
        };
        if enc_index_table.try_reserve_exact(index_count).is_err() {
            return Err(WmpError::Fail);
        }
        enc_index_table.resize(index_count, 0);
        (*p_sc_enc).pIndexTableMemory = Some(enc_index_table.into_boxed_slice());
        (*p_sc_enc).cIndexTableMemory = index_count;
        if cf_enc > cf_dec {
            return Err(WmpError::Fail);
        }
        (*p_sc_enc).cNumBitIO = cf_enc * ((*p_sc_enc).WMISCP.cNumOfSliceMinus1V as usize + 1);

        let mut l = 0usize;
        let Some(dec_index_table) = dec_index_table else {
            return Err(WmpError::Fail);
        };
        let Some(enc_index_table) = (*p_sc_enc)
            .pIndexTableMemory
            .as_deref_mut()
            .map(|table| table.as_mut_ptr())
        else {
            return Err(WmpError::Fail);
        };
        let dec_tile_columns = (*p_sc_dec).WMISCP.cNumOfSliceMinus1V as usize + 1;
        let dec_tile_rows = (*p_sc_dec).WMISCP.cNumOfSliceMinus1H as usize + 1;
        let dec_tile_x = &(&(*p_sc_dec).WMISCP.uiTileX)[..dec_tile_columns];
        let dec_tile_y = &(&(*p_sc_dec).WMISCP.uiTileY)[..dec_tile_rows];
        for (j, &tile_y) in dec_tile_y.iter().enumerate() {
            if !(mb_top..mb_bottom).contains(&(tile_y as usize)) {
                continue;
            }
            for (i, &tile_x) in dec_tile_x.iter().enumerate() {
                if !(mb_left..mb_right).contains(&(tile_x as usize)) {
                    continue;
                }
                for k in 0..cf_enc {
                    let src = (j * dec_tile_columns + i) * cf_dec + k;
                    *enc_index_table.add(l) =
                        *dec_index_table.add(src + 1) - *dec_index_table.add(src);
                    l += 1;
                }
            }
        }

        if (*p_sc_enc)
            .WMISCP
            .cNumOfSliceMinus1H
            .wrapping_add((*p_sc_enc).WMISCP.cNumOfSliceMinus1V)
            == 0
            && (*p_sc_enc).WMISCP.bfBitstreamFormat == BitstreamFormat::Spatial
        {
            (*p_sc_enc).m_param.bIndexTable = 0;
            (*p_sc_enc).cNumBitIO = 0;
            write_index_table_null(&mut *p_sc_enc)?;
        } else {
            write_index_table(&mut *p_sc_enc)?;
        }

        let Some(p_io_header) = (*p_sc_enc).pIOHeader.map(NonNull::as_ptr) else {
            return Err(WmpError::Fail);
        };
        detach_is_write(p_io_header)?;

        l = 0;
        for (j, &tile_y) in dec_tile_y.iter().enumerate() {
            if !(mb_top..mb_bottom).contains(&(tile_y as usize)) {
                continue;
            }
            for (i, &tile_x) in dec_tile_x.iter().enumerate() {
                if !(mb_left..mb_right).contains(&(tile_x as usize)) {
                    continue;
                }
                for k in 0..cf_enc {
                    let src = (j * dec_tile_columns + i) * cf_dec + k;
                    let Some(p_dec_wstream) = (*p_sc_dec).WMISCP.pWStream.map(NonNull::as_ptr)
                    else {
                        return Err(WmpError::Fail);
                    };
                    let Some(p_enc_wstream) = (*p_sc_enc).WMISCP.pWStream.map(NonNull::as_ptr)
                    else {
                        return Err(WmpError::Fail);
                    };
                    let Some(set_pos) = (*p_dec_wstream).SetPos else {
                        return Err(WmpError::Fail);
                    };
                    set_pos(
                        &mut *p_dec_wstream,
                        *dec_index_table.add(src) + (*p_sc_dec).cHeaderSize,
                    )?;
                    copy_to(p_dec_wstream, p_enc_wstream, *enc_index_table.add(l))?;
                    l += 1;
                }
            }
        }
        (*p_sc_enc).pIndexTableMemory = None;
        (*p_sc_enc).cIndexTableMemory = 0;
    } else {
        write_index_table_null(&mut *p_sc_enc)?;
    }

    (*p_sc_dec).cRow = 0;
    while (*p_sc_dec).cRow < mb_bottom && (*p_param).bIgnoreOverlap == 0 {
        (*p_sc_dec).cColumn = 0;
        while (*p_sc_dec).cColumn < (*p_sc_dec).cmbWidth {
            let mut c_row = (*p_sc_dec).cRow as i32;
            let mut c_column = (*p_sc_dec).cColumn as i32;
            std::ptr::write_bytes(p_mb_buf, 0, c_unit);
            if (*p_sc_dec).m_param.bAlphaChannel != 0 {
                let Some(p1_mb_buffer) = (*p_sc_dec_next).p1MBbuffer[0] else {
                    return Err(WmpError::Fail);
                };
                std::ptr::write_bytes(p1_mb_buffer.as_ptr(), 0, 256);
                (*p_sc_dec_next).cRow = (*p_sc_dec).cRow;
                (*p_sc_dec_next).cColumn = (*p_sc_dec).cColumn;
            }

            let mut p_sc_work = p_sc_dec;
            let mut pass = if (*p_sc_dec).m_param.bAlphaChannel != 0 {
                2
            } else {
                1
            };
            while pass > 0 {
                get_tile_pos(&mut *p_sc_work, c_column as usize, c_row as usize);
                if pass == 2 {
                    if let Some(next) = (*p_sc_work).m_pNextSC {
                        let p_sc_work_next = next.as_ptr();
                        (*p_sc_work_next).cTileColumn = (*p_sc_work).cTileColumn;
                        (*p_sc_work_next).cTileRow = (*p_sc_work).cTileRow;
                    }
                }
                if read_packets(&mut *p_sc_work).is_err() {
                    return Err(WmpError::Fail);
                }
                let Some(contexts) = (*p_sc_work).pCodingContextMemory.as_deref_mut() else {
                    return Err(WmpError::Fail);
                };
                let Some(p_context) = contexts.get_mut((*p_sc_work).cTileColumn) else {
                    return Err(WmpError::Fail);
                };
                let p_context = p_context as *mut CCodingContext;
                if decode_macroblock_dc(p_sc_work, p_context, c_column, c_row).is_err() {
                    return Err(WmpError::Fail);
                }
                if (*p_sc_work).cSB > 1
                    && decode_macroblock_lowpass(p_sc_work, p_context, c_column, c_row).is_err()
                {
                    return Err(WmpError::Fail);
                }
                pred_dcac_dec(&mut *p_sc_work);
                if (*p_sc_work).cSB > 2
                    && decode_macroblock_highpass(p_sc_work, p_context, c_column, c_row).is_err()
                {
                    return Err(WmpError::Fail);
                }
                pred_ac_dec(&mut *p_sc_work);
                update_pred_info(
                    p_sc_work,
                    std::ptr::addr_of_mut!((*p_sc_work).MBInfo),
                    c_column as usize,
                    (*p_sc_work).WMISCP.cfColorFormat,
                );
                p_sc_work = (*p_sc_work)
                    .m_pNextSC
                    .map(NonNull::as_ptr)
                    .unwrap_or(std::ptr::null_mut());
                pass -= 1;
            }

            if (*p_sc_dec).cRow >= mb_top
                && (*p_sc_dec).cColumn >= mb_left
                && (*p_sc_dec).cColumn < mb_right
            {
                c_row = ((*p_sc_dec).cRow - mb_top) as i32;
                if B_FLIP_V[o_o as usize] != 0 {
                    c_row = mb_height as i32 - c_row - 1;
                }
                c_column = ((*p_sc_dec).cColumn - mb_left) as i32;
                if B_FLIP_H[o_o as usize] != 0 {
                    c_column = mb_width as i32 - c_column - 1;
                }

                (*p_sc_enc).m_bCtxLeft = 0;
                (*p_sc_enc).m_bCtxTop = 0;
                i = 0;
                while i <= (*p_sc_enc).WMISCP.cNumOfSliceMinus1H as usize {
                    if (*p_sc_enc).WMISCP.uiTileY[i]
                        == if o_o < Orientation::RotateCw {
                            c_row as u32
                        } else {
                            c_column as u32
                        }
                    {
                        (*p_sc_enc).cTileRow = i;
                        (*p_sc_enc).m_bCtxTop = 1;
                        break;
                    }
                    i += 1;
                }
                i = 0;
                while i <= (*p_sc_enc).WMISCP.cNumOfSliceMinus1V as usize {
                    if (*p_sc_enc).WMISCP.uiTileX[i]
                        == if o_o < Orientation::RotateCw {
                            c_column as u32
                        } else {
                            c_row as u32
                        }
                    {
                        (*p_sc_enc).cTileColumn = i;
                        (*p_sc_enc).m_bCtxLeft = 1;
                        break;
                    }
                    i += 1;
                }

                if (*p_sc_enc).m_bCtxLeft != 0 && (*p_sc_enc).m_bCtxTop != 0 {
                    let mut p_tmp = tile_qp_info.as_mut_ptr();
                    let Some(tile) = (*p_sc_dec)
                        .pTileMemory
                        .as_deref_mut()
                        .and_then(|tiles| tiles.get_mut((*p_sc_dec).cTileColumn))
                    else {
                        return Err(WmpError::Fail);
                    };
                    let mut p_tile = tile as *mut CWMITile;
                    if o_o != Orientation::None {
                        p_tmp = p_tmp.add(
                            (*p_sc_enc).cTileRow
                                * ((*p_sc_enc).WMISCP.cNumOfSliceMinus1V as usize + 1)
                                + (*p_sc_enc).cTileColumn,
                        );
                    }
                    let channel_count = (*p_sc_enc).WMISCP.cChannel;
                    (*p_tmp).dcMode = (*p_tile).cChModeDC;
                    for (dst, &quantizer) in (&mut (*p_tmp).dcIndex)[..channel_count]
                        .iter_mut()
                        .zip((&(*p_tile).pQuantizerDC)[..channel_count].iter())
                    {
                        if let Some(quantizer) = quantizer {
                            *dst = (*quantizer.as_ptr()).iIndex;
                        }
                    }
                    if (*p_sc_enc).WMISCP.sbSubband != Subband::DcOnly {
                        (*p_tmp).bUseDC = (*p_tile).bUseDC;
                        (*p_tmp).lpNum = (*p_tile).cNumQPLP;
                        if (*p_tmp).bUseDC == 0 {
                            for j in 0..(*p_tmp).lpNum as usize {
                                (*p_tmp).lpMode[j] = (*p_tile).cChModeLP[j];
                                for (dst, &quantizer) in (&mut (*p_tmp).lpIndex[j])[..channel_count]
                                    .iter_mut()
                                    .zip((&(*p_tile).pQuantizerLP)[..channel_count].iter())
                                {
                                    if let Some(quantizer) = quantizer {
                                        *dst = (*quantizer.as_ptr().add(j)).iIndex;
                                    }
                                }
                            }
                        }
                        if (*p_sc_enc).WMISCP.sbSubband != Subband::NoHighpass {
                            (*p_tmp).bUseLP = (*p_tile).bUseLP;
                            (*p_tmp).hpNum = (*p_tile).cNumQPHP;
                            if (*p_tmp).bUseLP == 0 {
                                for j in 0..(*p_tmp).hpNum as usize {
                                    (*p_tmp).hpMode[j] = (*p_tile).cChModeHP[j];
                                    for (dst, &quantizer) in (&mut (*p_tmp).hpIndex[j])
                                        [..channel_count]
                                        .iter_mut()
                                        .zip((&(*p_tile).pQuantizerHP)[..channel_count].iter())
                                    {
                                        if let Some(quantizer) = quantizer {
                                            *dst = (*quantizer.as_ptr().add(j)).iIndex;
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if has_alpha_mode {
                        let Some(tile) = (*p_sc_dec_next)
                            .pTileMemory
                            .as_deref_mut()
                            .and_then(|tiles| tiles.get_mut((*p_sc_dec).cTileColumn))
                        else {
                            return Err(WmpError::Fail);
                        };
                        p_tile = tile as *mut CWMITile;
                        if let Some(quantizer) = (*p_tile).pQuantizerDC[0] {
                            (*p_tmp).dcIndex[i_alpha_pos] = (*quantizer.as_ptr()).iIndex;
                        }
                        if (*p_sc_enc).WMISCP.sbSubband != Subband::DcOnly {
                            (*p_tmp).bUseDCAlpha = (*p_tile).bUseDC;
                            (*p_tmp).lpNumAlpha = (*p_tile).cNumQPLP;
                            if (*p_tmp).bUseDCAlpha == 0 {
                                for j in 0..(*p_tmp).lpNumAlpha as usize {
                                    if let Some(quantizer) = (*p_tile).pQuantizerLP[0] {
                                        (*p_tmp).lpIndex[j][i_alpha_pos] =
                                            (*quantizer.as_ptr().add(j)).iIndex;
                                    }
                                }
                            }
                            if (*p_sc_enc).WMISCP.sbSubband != Subband::NoHighpass {
                                (*p_tmp).bUseLPAlpha = (*p_tile).bUseLP;
                                (*p_tmp).hpNumAlpha = (*p_tile).cNumQPHP;
                                if (*p_tmp).bUseLPAlpha == 0 {
                                    for j in 0..(*p_tmp).hpNumAlpha as usize {
                                        if let Some(quantizer) = (*p_tile).pQuantizerHP[0] {
                                            (*p_tmp).hpIndex[j][i_alpha_pos] =
                                                (*quantizer.as_ptr().add(j)).iIndex;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }

                if o_o == Orientation::None {
                    (*p_sc_enc).cColumn = (*p_sc_dec).cColumn - mb_left + 1;
                    (*p_sc_enc).cRow = (*p_sc_dec).cRow + 1 - mb_top;
                    (*p_sc_enc).MBInfo = (*p_sc_dec).MBInfo.clone();
                    get_tile_pos(&mut *p_sc_enc, c_column as usize, c_row as usize);
                    if (*p_sc_enc).m_bCtxLeft != 0 && (*p_sc_enc).m_bCtxTop != 0 {
                        transcode_tile_header(&mut *p_sc_enc, &mut tile_qp_info[0]);
                    }
                    if encode_mb(&mut *p_sc_enc, c_column, c_row).is_err() {
                        return Err(WmpError::Fail);
                    }
                    if has_alpha_mode {
                        (*p_sc_enc_next).cColumn = (*p_sc_dec).cColumn - mb_left + 1;
                        (*p_sc_enc_next).cRow = (*p_sc_dec).cRow + 1 - mb_top;
                        get_tile_pos(&mut *p_sc_enc_next, c_column as usize, c_row as usize);
                        (*p_sc_enc_next).MBInfo = (*p_sc_dec_next).MBInfo.clone();
                        if encode_mb(&mut *p_sc_enc_next, c_column, c_row).is_err() {
                            return Err(WmpError::Fail);
                        }
                    }
                } else {
                    let c_off = if o_o < Orientation::RotateCw {
                        c_row as usize * mb_width + c_column as usize
                    } else {
                        c_row as usize + mb_height * c_column as usize
                    };
                    mb_info[c_off] = (*p_sc_dec).MBInfo.clone();
                    std::ptr::copy_nonoverlapping(
                        p_mb_buf,
                        frame_buf.as_mut_ptr().add(c_off * c_unit),
                        c_unit,
                    );
                    if has_alpha_mode {
                        mb_info_alpha[c_off] = (*p_sc_dec_next).MBInfo.clone();
                        std::ptr::copy_nonoverlapping(
                            mb_buf_alpha.as_ptr(),
                            frame_buf_alpha.as_mut_ptr().add(c_off * 256),
                            256,
                        );
                    }
                }
            }
            (*p_sc_dec).cColumn += 1;
        }
        advance_one_mb_row(&mut *p_sc_dec);
        if o_o == Orientation::None {
            advance_one_mb_row(&mut *p_sc_enc);
        }
        (*p_sc_dec).cRow += 1;
    }

    if o_o != Orientation::None {
        (*p_sc_enc).cRow = 1;
        while (*p_sc_enc).cRow <= (*p_sc_enc).cmbHeight {
            (*p_sc_enc).cColumn = 1;
            while (*p_sc_enc).cColumn <= (*p_sc_enc).cmbWidth {
                let c_off = ((*p_sc_enc).cRow - 1) * (*p_sc_enc).cmbWidth + (*p_sc_enc).cColumn - 1;
                i = 0;
                while i < if (*p_sc_enc).m_param.cfColorFormat == ColorFormat::Yuv420
                    || (*p_sc_enc).m_param.cfColorFormat == ColorFormat::Yuv422
                {
                    1
                } else {
                    (*p_sc_enc).m_param.cNumChannels
                } {
                    transform_dc_block(
                        &mut mb_info[c_off].iBlockDC[i],
                        &mut (*p_sc_enc).MBInfo.iBlockDC[i],
                        o_o,
                    );
                    transform_ac_blocks(
                        std::slice::from_raw_parts_mut(
                            frame_buf.as_mut_ptr().add(c_off * c_unit + i * 256),
                            256,
                        ),
                        std::slice::from_raw_parts_mut(p_mb_buf.add(256 * i), 256),
                        o_o,
                    );
                    i += 1;
                }
                if (*p_sc_enc).WMISCP.cfColorFormat == ColorFormat::Yuv420 {
                    i = 0;
                    while i < 2 {
                        transform_dc_block420(
                            &mut mb_info[c_off].iBlockDC[i + 1],
                            &mut (*p_sc_enc).MBInfo.iBlockDC[i + 1],
                            o_o,
                        );
                        transform_ac_blocks420(
                            std::slice::from_raw_parts_mut(
                                frame_buf.as_mut_ptr().add(c_off * c_unit + 256 + i * 64),
                                64,
                            ),
                            std::slice::from_raw_parts_mut(p_mb_buf.add(256 + i * 64), 64),
                            o_o,
                        );
                        i += 1;
                    }
                } else if (*p_sc_enc).WMISCP.cfColorFormat == ColorFormat::Yuv422 {
                    i = 0;
                    while i < 2 {
                        transform_dc_block422(
                            &mut mb_info[c_off].iBlockDC[i + 1],
                            &mut (*p_sc_enc).MBInfo.iBlockDC[i + 1],
                            o_o,
                        );
                        transform_ac_blocks422(
                            std::slice::from_raw_parts_mut(
                                frame_buf.as_mut_ptr().add(c_off * c_unit + 256 + i * 128),
                                128,
                            ),
                            std::slice::from_raw_parts_mut(p_mb_buf.add(256 + i * 128), 128),
                            o_o,
                        );
                        i += 1;
                    }
                }
                (*p_sc_enc).MBInfo.iQIndexLP = mb_info[c_off].iQIndexLP;
                (*p_sc_enc).MBInfo.iQIndexHP = mb_info[c_off].iQIndexHP;

                let c_row = (*p_sc_enc).cRow as i32 - 1;
                let c_column = (*p_sc_enc).cColumn as i32 - 1;
                get_tile_pos(&mut *p_sc_enc, c_column as usize, c_row as usize);
                if (*p_sc_enc).m_bCtxLeft != 0 && (*p_sc_enc).m_bCtxTop != 0 {
                    let tile_qp_index = (*p_sc_enc).cTileRow
                        * ((*p_sc_enc).WMISCP.cNumOfSliceMinus1V as usize + 1)
                        + (*p_sc_enc).cTileColumn;
                    transcode_tile_header(&mut *p_sc_enc, &mut tile_qp_info[tile_qp_index]);
                }
                if encode_mb(&mut *p_sc_enc, c_column, c_row).is_err() {
                    return Err(WmpError::Fail);
                }

                if has_alpha_mode {
                    (*p_sc_enc_next).cColumn = (*p_sc_enc).cColumn;
                    (*p_sc_enc_next).cRow = (*p_sc_enc).cRow;
                    get_tile_pos(&mut *p_sc_enc_next, c_column as usize, c_row as usize);
                    (*p_sc_enc_next).MBInfo = (*p_sc_dec_next).MBInfo.clone();
                    transform_dc_block(
                        &mut mb_info_alpha[c_off].iBlockDC[0],
                        &mut (*p_sc_enc_next).MBInfo.iBlockDC[0],
                        o_o,
                    );
                    transform_ac_blocks(
                        std::slice::from_raw_parts_mut(
                            frame_buf_alpha.as_mut_ptr().add(c_off * 256),
                            256,
                        ),
                        &mut mb_buf_alpha,
                        o_o,
                    );
                    (*p_sc_enc_next).MBInfo.iQIndexLP = mb_info_alpha[c_off].iQIndexLP;
                    (*p_sc_enc_next).MBInfo.iQIndexHP = mb_info_alpha[c_off].iQIndexHP;
                    if encode_mb(&mut *p_sc_enc_next, c_column, c_row).is_err() {
                        return Err(WmpError::Fail);
                    }
                }
                (*p_sc_enc).cColumn += 1;
            }
            advance_one_mb_row(&mut *p_sc_enc);
            (*p_sc_enc).cRow += 1;
        }
    }

    (*p_sc_dec).pPredInfoMemory = None;
    (*p_sc_dec).cPredInfoMemory = 0;
    (*p_sc_dec).PredInfo = [None; MAX_CHANNELS];
    (*p_sc_dec).PredInfoPrevRow = [None; MAX_CHANNELS];
    (*p_sc_dec).pTileMemory = None;
    (*p_sc_dec).cTileMemory = 0;
    // C discards this return (faithful to WMPhotoTranscode)
    let _ = str_io_dec_term(&mut *p_sc_dec);
    (*p_sc_dec).pCodingContextMemory = None;
    (*p_sc_dec).cNumCodingContext = 0;

    if (*p_param).bIgnoreOverlap == 0 {
        (*p_sc_enc).pPredInfoMemory = None;
        (*p_sc_enc).cPredInfoMemory = 0;
        (*p_sc_enc).PredInfo = [None; MAX_CHANNELS];
        (*p_sc_enc).PredInfoPrevRow = [None; MAX_CHANNELS];
        (*p_sc_enc).pTileMemory = None;
        (*p_sc_enc).cTileMemory = 0;
        str_io_enc_term(&mut *p_sc_enc)?;
        (*p_sc_enc).pCodingContextMemory = None;
        (*p_sc_enc).cNumCodingContext = 0;
    }
    drop(p_sc_enc_next_storage);
    drop(p_sc_dec_next_storage);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn get_roi_rejects_wrapping_requested_end() {
        let mut image_info = tagCWMImageInfo {
            cWidth: usize::MAX,
            cHeight: usize::MAX,
            ..Default::default()
        };
        let mut core = CWMImageStrCodecParameters::default();
        let mut scp = tagCWMIStrCodecParam::default();
        let mut param = tagCWMTranscodingParam {
            cLeftX: usize::MAX,
            cWidth: 1,
            cTopY: 0,
            cHeight: 1,
            ..Default::default()
        };

        let result = unsafe { get_roi(&mut image_info, &mut core, &mut scp, &mut param) };

        assert_eq!(result, Err(WmpError::Fail));
    }
}
