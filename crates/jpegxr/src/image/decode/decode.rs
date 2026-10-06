// Auto-generated scaffold for a faithful JXRLib translation restart.
// Keep one Rust item per original C item; replace stubs bottom-up.

use std::ptr::NonNull;

use crate::image::sys::adapthuff::{allocate, CodingMode};
use crate::image::sys::common::{CAdaptiveHuffman, NUMVLCTABLES};
use crate::image::sys::image::{init_zigzag_scan, reset_coding_context};
use crate::image::sys::strcodec::{CCodingContext, CWMImageStrCodec};
use crate::jxrgluelib::jxrglue::ColorFormat;
use crate::WmpError;

use super::segdec::{adapt_highpass_dec, adapt_lowpass_dec};

/// Original struct: `CWMDecoderParameters` at `original/jxrlib/image/decode/decode.h:32`.
#[derive(Debug, Clone, Default)]
pub struct CWMDecoderParameters {
    pub bDecodeFullFrame: i32,
    pub bDecodeFullWidth: i32,
    pub bSkipFlexbits: i32,
    pub cThumbnailScale: usize,
    pub bDecodeHP: i32,
    pub bDecodeLP: i32,
    pub cROILeftX: usize,
    pub cROIRightX: usize,
    pub cROITopY: usize,
    pub cROIBottomY: usize,
    pub offset_x: Vec<usize>,
    pub offset_y: Vec<usize>,
}

/// Original function: `InitializeAH` at `original/jxrlib/image/decode/decode.c:80`.
pub unsafe fn initialize_ah(
    pp_ad_huff: &mut Option<NonNull<CAdaptiveHuffman>>,
    p_ad_huff_owner: &mut Option<Box<CAdaptiveHuffman>>,
    i_sym: i32,
) -> Result<(), WmpError> {
    *p_ad_huff_owner = allocate(i_sym, CodingMode::Decoder);
    if p_ad_huff_owner.is_none() {
        *pp_ad_huff = None;
        println!("Insufficient memory to init decoder.");
        return Err(WmpError::Fail);
    }

    *pp_ad_huff = p_ad_huff_owner.as_deref_mut().map(NonNull::from);
    Ok(())
}

/// Original function: `AllocateCodingContextDec` at `original/jxrlib/image/decode/decode.c:113`.
pub unsafe fn allocate_coding_context_dec(
    sc: &mut CWMImageStrCodec,
    i_num_contexts: i32,
) -> Result<(), WmpError> {
    const A_ALPHABET: [i32; NUMVLCTABLES as usize] = [
        5, 4, 8, 7, 7, 12, 6, 6, 12, 6, 6, 7, 7, 12, 6, 6, 12, 6, 6, 7, 7,
    ];

    if i_num_contexts > crate::image::sys::windowsmediaphoto::MAX_TILES as i32 || i_num_contexts < 1
    {
        return Err(WmpError::Fail);
    }

    let context_count = i_num_contexts as usize;
    let mut contexts = Vec::new();
    if contexts.try_reserve_exact(context_count).is_err() {
        sc.cNumCodingContext = 0;
        return Err(WmpError::Fail);
    }
    contexts.resize_with(context_count, CCodingContext::default);
    let contexts = contexts.into_boxed_slice();
    sc.cNumCodingContext = context_count;
    sc.pCodingContextMemory = Some(contexts);
    let i_cbp_size = if sc.m_param.cfColorFormat == ColorFormat::YOnly
        || sc.m_param.cfColorFormat == ColorFormat::NComponent
        || sc.m_param.cfColorFormat == ColorFormat::Cmyk
    {
        5
    } else {
        9
    };

    let Some(contexts) = sc.pCodingContextMemory.as_mut() else {
        sc.cNumCodingContext = 0;
        return Err(WmpError::Fail);
    };
    let mut allocation_failed = false;
    'context_loop: for context in contexts.iter_mut() {
        if initialize_ah(
            &mut context.m_pAdaptHuffCBPCY,
            &mut context.m_pAdaptHuffCBPCYMemory,
            i_cbp_size,
        )
        .is_err()
        {
            allocation_failed = true;
            break 'context_loop;
        }
        if initialize_ah(
            &mut context.m_pAdaptHuffCBPCY1,
            &mut context.m_pAdaptHuffCBPCY1Memory,
            5,
        )
        .is_err()
        {
            allocation_failed = true;
            break 'context_loop;
        }

        for k in 0..NUMVLCTABLES {
            if initialize_ah(
                &mut context.m_pAHexpt[k as usize],
                &mut context.m_pAHexptMemory[k as usize],
                A_ALPHABET[k as usize],
            )
            .is_err()
            {
                allocation_failed = true;
                break 'context_loop;
            }
        }

        reset_coding_context_dec(context);
    }
    if allocation_failed {
        sc.pCodingContextMemory = None;
        sc.cNumCodingContext = 0;
        return Err(WmpError::Fail);
    }

    Ok(())
}

/// Original function: `ResetCodingContextDec` at `original/jxrlib/image/decode/decode.c:162`.
pub unsafe fn reset_coding_context_dec(context: &mut CCodingContext) {
    if let Some(adapt_huff_cbpcy) = context.m_pAdaptHuffCBPCYMemory.as_deref_mut() {
        adapt_huff_cbpcy.m_bInitialize = 0;
        context.m_pAdaptHuffCBPCY = Some(NonNull::from(adapt_huff_cbpcy));
    } else if let Some(mut adapt_huff_cbpcy) = context.m_pAdaptHuffCBPCY {
        adapt_huff_cbpcy.as_mut().m_bInitialize = 0;
    } else {
        return;
    }

    if let Some(adapt_huff_cbpcy1) = context.m_pAdaptHuffCBPCY1Memory.as_deref_mut() {
        adapt_huff_cbpcy1.m_bInitialize = 0;
        context.m_pAdaptHuffCBPCY1 = Some(NonNull::from(adapt_huff_cbpcy1));
    } else if let Some(mut adapt_huff_cbpcy1) = context.m_pAdaptHuffCBPCY1 {
        adapt_huff_cbpcy1.as_mut().m_bInitialize = 0;
    } else {
        return;
    }

    for k in 0..NUMVLCTABLES {
        if let Some(ahexpt) = context.m_pAHexptMemory[k as usize].as_deref_mut() {
            ahexpt.m_bInitialize = 0;
            context.m_pAHexpt[k as usize] = Some(NonNull::from(ahexpt));
        } else if let Some(mut ahexpt) = context.m_pAHexpt[k as usize] {
            ahexpt.as_mut().m_bInitialize = 0;
        } else {
            return;
        }
    }

    // C discards this return (faithful to ResetCodingContextDec)
    let _ = adapt_lowpass_dec(context);
    // C discards this return (faithful to ResetCodingContextDec)
    let _ = adapt_highpass_dec(context);

    init_zigzag_scan(context);
    reset_coding_context(context);
}
