// Auto-generated scaffold for a faithful JXRLib translation restart.
// Keep one Rust item per original C item; replace stubs bottom-up.

use crate::image::sys::strcodec::{CWMITile, CWMImageStrCodec};

/// Original function: `quantizeMacroblock` at `original/jxrlib/image/encode/strenc_x86.c:307`.
pub unsafe fn quantize_macroblock_x86(pSC: &mut CWMImageStrCodec) -> i32 {
    let pSC = pSC as *mut CWMImageStrCodec;
    let Some(tile) = (*pSC)
        .pTileMemory
        .as_deref_mut()
        .and_then(|tiles| tiles.get_mut((*pSC).cTileColumn))
    else {
        return 0 as i32;
    };
    let pTile = tile as *mut CWMITile;
    let pMBInfo = std::ptr::addr_of_mut!((*pSC).MBInfo);

    let mut iChannel = 0;
    while iChannel < 3 {
        let Some(p_qpdc) = (*pTile).pQuantizerDC[iChannel] else {
            return 0 as i32;
        };
        let Some(p_qplp_base) = (*pTile).pQuantizerLP[iChannel] else {
            return 0 as i32;
        };
        let Some(p_qphp_base) = (*pTile).pQuantizerHP[iChannel] else {
            return 0 as i32;
        };
        let pQPDC = p_qpdc.as_ptr();
        let pQPLP = p_qplp_base.as_ptr().add((*pMBInfo).iQIndexLP as usize);
        let pQPHP = p_qphp_base.as_ptr().add((*pMBInfo).iQIndexHP as usize);

        let mut j = 0;
        while j < 16 {
            let pData = (*pSC).pPlane[iChannel]
                .map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr)
                .add(crate::image::sys::strcodec::blk_offset[j] as usize);

            if j == 0 {
                *pData.add(0) = if (*pQPDC).iMan == 0 {
                    crate::image::encode::str_pred_quant_enc::quant_mulless(
                        *pData.add(0),
                        (*pQPDC).iOffset,
                        (*pQPDC).iExp,
                    )
                } else {
                    crate::image::encode::str_pred_quant_enc::quant(
                        *pData.add(0),
                        (*pQPDC).iOffset,
                        (*pQPDC).iMan,
                        (*pQPDC).iExp,
                    )
                };
            } else {
                *pData.add(0) = if (*pQPLP).iMan == 0 {
                    crate::image::encode::str_pred_quant_enc::quant_mulless(
                        *pData.add(0),
                        (*pQPLP).iOffset,
                        (*pQPLP).iExp,
                    )
                } else {
                    crate::image::encode::str_pred_quant_enc::quant(
                        *pData.add(0),
                        (*pQPLP).iOffset,
                        (*pQPLP).iMan,
                        (*pQPLP).iExp,
                    )
                };
            }

            let mut i = 1;
            while i < 16 {
                *pData.add(i) = if (*pQPHP).iMan == 0 {
                    crate::image::encode::str_pred_quant_enc::quant_mulless(
                        *pData.add(i),
                        (*pQPHP).iOffset,
                        (*pQPHP).iExp,
                    )
                } else {
                    crate::image::encode::str_pred_quant_enc::quant(
                        *pData.add(i),
                        (*pQPHP).iOffset,
                        (*pQPHP).iMan,
                        (*pQPHP).iExp,
                    )
                };
                i += 1;
            }

            j += 1;
        }

        iChannel += 1;
    }

    let mut iChannel = 0;
    while iChannel < 3 {
        let pDC = (*pSC).MBInfo.iBlockDC[iChannel].as_mut_ptr();
        let pData = (*pSC).pPlane[iChannel].map_or(std::ptr::null_mut(), std::ptr::NonNull::as_ptr);

        let mut i = 0;
        while i < 16 {
            *pDC.add(i) = *pData.add(crate::image::sys::strcodec::dct_index[2][i] as usize);
            i += 1;
        }

        iChannel += 1;
    }

    0 as i32
}

/// Original function: `StrEncOpt` at `original/jxrlib/image/encode/strenc_x86.c:376`.
pub unsafe fn str_enc_opt(_sc: &mut CWMImageStrCodec) {}
