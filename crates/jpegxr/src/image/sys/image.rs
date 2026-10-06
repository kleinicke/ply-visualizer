// Auto-generated scaffold for a faithful JXRLib translation restart.
// Keep one Rust item per original C item; replace stubs bottom-up.

use crate::image::sys::common::{Band, CAdaptiveModel};
use crate::image::sys::strcodec::{dct_index, CCodingContext, MAX_CHANNELS};
use crate::jxrgluelib::jxrglue::ColorFormat;

pub const grgi_zigzag_inv4x4_lowpass: [i32; 16] =
    [0, 1, 4, 5, 2, 8, 6, 9, 3, 12, 10, 7, 13, 11, 14, 15];
pub const grgi_zigzag_inv4x4_h: [i32; 16] = [0, 1, 4, 5, 2, 8, 6, 9, 3, 12, 10, 7, 13, 11, 14, 15];
pub const grgi_zigzag_inv4x4_v: [i32; 16] = [0, 4, 8, 5, 1, 12, 9, 6, 2, 13, 3, 15, 7, 10, 14, 11];

pub const gSignificantRunBin: [i32; 15] = [-1, -1, -1, -1, 2, 2, 2, 1, 1, 1, 1, 0, 0, 0, 0];

pub const gSignificantRunFixedLength: [i32; 15] = [0, 0, 1, 1, 3, 0, 0, 1, 1, 2, 0, 0, 0, 0, 1];

/// Original function: `UpdateModelMB` at `original/jxrlib/image/sys/image.c:82`.
pub unsafe fn update_model_mb(
    cf: ColorFormat,
    i_channels: i32,
    i_laplacian_mean: &mut [i32; 2],
    model: &mut CAdaptiveModel,
) {
    const MODELWEIGHT: i32 = 70;
    const A_WEIGHT0: [i32; 3] = [240, 12, 1];
    const A_WEIGHT1: [[i32; MAX_CHANNELS]; 3] = [
        [
            0, 240, 120, 80, 60, 48, 40, 34, 30, 27, 24, 22, 20, 18, 17, 16,
        ],
        [0, 12, 6, 4, 3, 2, 2, 2, 2, 1, 1, 1, 1, 1, 1, 1],
        [0, 16, 8, 5, 4, 3, 3, 2, 2, 2, 2, 1, 1, 1, 1, 1],
    ];
    const A_WEIGHT2: [i32; 6] = [120, 37, 2, 120, 18, 1];

    let band_index = (model.m_band as usize) - (Band::Dc as usize);

    i_laplacian_mean[0] *= A_WEIGHT0[band_index];
    if cf == ColorFormat::Yuv420 {
        i_laplacian_mean[1] *= A_WEIGHT2[band_index];
    } else if cf == ColorFormat::Yuv422 {
        i_laplacian_mean[1] *= A_WEIGHT2[3 + band_index];
    } else {
        i_laplacian_mean[1] *= A_WEIGHT1[band_index][(i_channels - 1) as usize];
        if model.m_band == Band::Ac {
            i_laplacian_mean[1] >>= 4;
        }
    }

    for j in 0..2 {
        let i_lm = i_laplacian_mean[j];
        let mut i_ms = model.m_iFlcState[j];
        let mut i_delta = (i_lm - MODELWEIGHT) >> 2;

        if i_delta <= -8 {
            i_delta += 4;
            if i_delta < -16 {
                i_delta = -16;
            }
            i_ms += i_delta;
            if i_ms < -8 {
                if model.m_iFlcBits[j] == 0 {
                    i_ms = -8;
                } else {
                    i_ms = 0;
                    model.m_iFlcBits[j] -= 1;
                }
            }
        } else if i_delta >= 8 {
            i_delta -= 4;
            if i_delta > 15 {
                i_delta = 15;
            }
            i_ms += i_delta;
            if i_ms > 8 {
                if model.m_iFlcBits[j] >= 15 {
                    model.m_iFlcBits[j] = 15;
                    i_ms = 8;
                } else {
                    i_ms = 0;
                    model.m_iFlcBits[j] += 1;
                }
            }
        }
        model.m_iFlcState[j] = i_ms;
        if cf == ColorFormat::YOnly {
            break;
        }
    }
}

/// Original function: `ResetCodingContext` at `original/jxrlib/image/sys/image.c:148`.
pub fn reset_coding_context(context: &mut CCodingContext) {
    context.m_aModelAC = CAdaptiveModel::default();
    context.m_aModelAC.m_band = Band::Ac;

    context.m_aModelLP = CAdaptiveModel::default();
    context.m_aModelLP.m_band = Band::Lp;
    context.m_aModelLP.m_iFlcBits = [4, 4];

    context.m_aModelDC = CAdaptiveModel::default();
    context.m_aModelDC.m_band = Band::Dc;
    context.m_aModelDC.m_iFlcBits = [8, 8];

    context.m_iCBPCountZero = 1;
    context.m_iCBPCountMax = 1;

    context.m_aCBPModel.m_iCount0 = [-4, -4];
    context.m_aCBPModel.m_iCount1 = [4, 4];
    context.m_aCBPModel.m_iState = [0, 0];
}

/// Original function: `InitZigzagScan` at `original/jxrlib/image/sys/image.c:173`.
pub fn init_zigzag_scan(context: &mut CCodingContext) {
    for (i, &scan) in grgi_zigzag_inv4x4_lowpass.iter().enumerate() {
        context.m_aScanLowpass[i].uScan = scan as u32;
        context.m_aScanHoriz[i].uScan = dct_index[0][grgi_zigzag_inv4x4_h[i] as usize] as u32;
        context.m_aScanVert[i].uScan = dct_index[0][grgi_zigzag_inv4x4_v[i] as usize] as u32;
    }
}
