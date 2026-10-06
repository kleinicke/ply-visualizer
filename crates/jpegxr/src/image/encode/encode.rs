// Auto-generated scaffold for a faithful JXRLib translation restart.
// Keep one Rust item per original C item; replace stubs bottom-up.

use std::ptr::NonNull;

use crate::image::sys::adapthuff::{allocate, CodingMode};
use crate::image::sys::common::NUMVLCTABLES;
use crate::image::sys::image::{init_zigzag_scan, reset_coding_context};
use crate::image::sys::strcodec::{CCodingContext, CWMImageStrCodec};
use crate::jxrgluelib::jxrglue::ColorFormat;
use crate::WmpError;

use super::segenc::{adapt_highpass_enc, adapt_lowpass_enc};

/// Original function: `AllocateCodingContextEnc` at `original/jxrlib/image/encode/encode.c:48`.
pub unsafe fn allocate_coding_context_enc(
    sc: &mut CWMImageStrCodec,
    i_num_contexts: i32,
    mut i_trim_flex_bits: i32,
) -> Result<(), WmpError> {
    const A_ALPHABET: [i32; NUMVLCTABLES as usize] = [
        5, 4, 8, 7, 7, 12, 6, 6, 12, 6, 6, 7, 7, 12, 6, 6, 12, 6, 6, 7, 7,
    ];

    i_trim_flex_bits = i_trim_flex_bits.clamp(0, 15);
    sc.m_param.bTrimFlexbitsFlag = (i_trim_flex_bits > 0) as i32;

    if i_num_contexts < 1 || i_num_contexts > crate::image::sys::windowsmediaphoto::MAX_TILES as i32
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
        context.m_pAdaptHuffCBPCYMemory = allocate(i_cbp_size, CodingMode::Encoder);
        let Some(adapt_huff_cbpcy) = context.m_pAdaptHuffCBPCYMemory.as_mut() else {
            allocation_failed = true;
            break 'context_loop;
        };
        context.m_pAdaptHuffCBPCY = Some(NonNull::from(adapt_huff_cbpcy.as_mut()));

        context.m_pAdaptHuffCBPCY1Memory = allocate(5, CodingMode::Encoder);
        let Some(adapt_huff_cbpcy1) = context.m_pAdaptHuffCBPCY1Memory.as_mut() else {
            allocation_failed = true;
            break 'context_loop;
        };
        context.m_pAdaptHuffCBPCY1 = Some(NonNull::from(adapt_huff_cbpcy1.as_mut()));

        for k in 0..NUMVLCTABLES {
            context.m_pAHexptMemory[k as usize] =
                allocate(A_ALPHABET[k as usize], CodingMode::Encoder);
            let Some(ahexpt) = context.m_pAHexptMemory[k as usize].as_mut() else {
                allocation_failed = true;
                break 'context_loop;
            };
            context.m_pAHexpt[k as usize] = Some(NonNull::from(ahexpt.as_mut()));
        }

        reset_coding_context_enc(context);
        context.m_iTrimFlexBits = i_trim_flex_bits;
    }
    if allocation_failed {
        sc.pCodingContextMemory = None;
        sc.cNumCodingContext = 0;
        return Err(WmpError::Fail);
    }

    Ok(())
}

/// Original function: `ResetCodingContextEnc` at `original/jxrlib/image/encode/encode.c:107`.
pub unsafe fn reset_coding_context_enc(context: &mut CCodingContext) {
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

    adapt_lowpass_enc(context);
    adapt_highpass_enc(context);

    init_zigzag_scan(context);
    reset_coding_context(context);
}
