// Auto-generated scaffold for a faithful JXRLib translation restart.
// Keep one Rust item per original C item; replace stubs bottom-up.

use crate::common::include::guiddef::is_equal_guid;
use crate::jxrgluelib::jxrglue::{
    pixel_format_lookup, tagPKFormatConverter, tagPKImageDecode, tagPKImageDecodeWMP,
    tagPKPixelInfo, tagPKRect, tagWmpStrCodecParam, BitDepth,
    GUID_PKPixelFormat128bppRGBAFixedPoint, GUID_PKPixelFormat128bppRGBAFloat,
    GUID_PKPixelFormat128bppRGBFixedPoint, GUID_PKPixelFormat128bppRGBFloat,
    GUID_PKPixelFormat12bppYUV420, GUID_PKPixelFormat16bppGray,
    GUID_PKPixelFormat16bppGrayFixedPoint, GUID_PKPixelFormat16bppGrayHalf,
    GUID_PKPixelFormat16bppRGB555, GUID_PKPixelFormat16bppRGB565, GUID_PKPixelFormat16bppYUV422,
    GUID_PKPixelFormat24bppBGR, GUID_PKPixelFormat24bppRGB, GUID_PKPixelFormat32bppBGR,
    GUID_PKPixelFormat32bppBGRA, GUID_PKPixelFormat32bppGrayFixedPoint,
    GUID_PKPixelFormat32bppGrayFloat, GUID_PKPixelFormat32bppPBGRA, GUID_PKPixelFormat32bppPRGBA,
    GUID_PKPixelFormat32bppRGB101010, GUID_PKPixelFormat32bppRGBA, GUID_PKPixelFormat32bppRGBE,
    GUID_PKPixelFormat48bppRGB, GUID_PKPixelFormat48bppRGBFixedPoint,
    GUID_PKPixelFormat48bppRGBHalf, GUID_PKPixelFormat64bppRGBA,
    GUID_PKPixelFormat64bppRGBAFixedPoint, GUID_PKPixelFormat64bppRGBAHalf,
    GUID_PKPixelFormat64bppRGBFixedPoint, GUID_PKPixelFormat64bppRGBHalf,
    GUID_PKPixelFormat8bppGray, GUID_PKPixelFormat96bppRGBFixedPoint,
    GUID_PKPixelFormat96bppRGBFloat, GUID_PKPixelFormatBlackWhite, GUID_PKPixelFormatDontCare,
    PKPixelConverterFn, PKPixelFormatGUID, LOOKUP_FORWARD,
};
use std::ptr::NonNull;

pub const HLF_MIN: f32 = 0.00006103515625;
pub const HLF_MAX: f32 = 65504.0;
pub const HLF_MIN_BITS: u16 = 0x0400;
pub const HLF_MAX_BITS: u16 = 0x7bff;
pub const HLF_MIN_BITS_NEG: u16 = HLF_MIN_BITS | 0x8000;
pub const HLF_MAX_BITS_NEG: u16 = HLF_MAX_BITS | 0x8000;
pub const HLF_QNaN_BITZS: u16 = 0x7fff;

/// Original struct: `tagPKPixelConverterInfo` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:2075`.
#[derive(Debug, Clone, Copy)]
pub struct tagPKPixelConverterInfo {
    pub pGUIDPixFmtFrom: PKPixelFormatGUID,
    pub pGUIDPixFmtTo: PKPixelFormatGUID,
    pub Convert: PKPixelConverterFn,
}

/// Original struct: `tagPKPixelConverter2Info` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:2173`.
#[derive(Debug, Clone, Copy)]
pub struct tagPKPixelConverter2Info {
    pub pGUIDPixFmtFrom: PKPixelFormatGUID,
    pub pGUIDPixFmtTo: PKPixelFormatGUID,
}

static S_PC_INFO: [tagPKPixelConverterInfo; 76] = [
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat24bppRGB,
        pGUIDPixFmtTo: GUID_PKPixelFormat24bppBGR,
        Convert: rgb24_bgr24,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat24bppBGR,
        pGUIDPixFmtTo: GUID_PKPixelFormat24bppRGB,
        Convert: bgr24_rgb24,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat24bppRGB,
        pGUIDPixFmtTo: GUID_PKPixelFormat32bppBGR,
        Convert: rgb24_bgr32,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat32bppBGR,
        pGUIDPixFmtTo: GUID_PKPixelFormat24bppRGB,
        Convert: bgr32_rgb24,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat24bppRGB,
        pGUIDPixFmtTo: GUID_PKPixelFormat8bppGray,
        Convert: rgb24_gray8,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat8bppGray,
        pGUIDPixFmtTo: GUID_PKPixelFormat24bppRGB,
        Convert: gray8_rgb24,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat24bppBGR,
        pGUIDPixFmtTo: GUID_PKPixelFormat8bppGray,
        Convert: bgr24_gray8,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat8bppGray,
        pGUIDPixFmtTo: GUID_PKPixelFormat24bppBGR,
        Convert: gray8_bgr24,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat128bppRGBAFixedPoint,
        pGUIDPixFmtTo: GUID_PKPixelFormat128bppRGBAFloat,
        Convert: rgba128_fixed_rgba128_float,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat128bppRGBAFloat,
        pGUIDPixFmtTo: GUID_PKPixelFormat128bppRGBAFixedPoint,
        Convert: rgba128_float_rgba128_fixed,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat96bppRGBFixedPoint,
        pGUIDPixFmtTo: GUID_PKPixelFormat96bppRGBFloat,
        Convert: rgb96_fixed_rgb96_float,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat96bppRGBFloat,
        pGUIDPixFmtTo: GUID_PKPixelFormat96bppRGBFixedPoint,
        Convert: rgb96_float_rgb96_fixed,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat96bppRGBFloat,
        pGUIDPixFmtTo: GUID_PKPixelFormat128bppRGBFloat,
        Convert: rgb96_float_rgb128_float,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat128bppRGBFloat,
        pGUIDPixFmtTo: GUID_PKPixelFormat96bppRGBFloat,
        Convert: rgb128_float_rgb96_float,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat96bppRGBFixedPoint,
        pGUIDPixFmtTo: GUID_PKPixelFormat128bppRGBFixedPoint,
        Convert: rgb96_float_rgb128_float,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat128bppRGBFixedPoint,
        pGUIDPixFmtTo: GUID_PKPixelFormat96bppRGBFixedPoint,
        Convert: rgb128_float_rgb96_float,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat64bppRGBHalf,
        pGUIDPixFmtTo: GUID_PKPixelFormat48bppRGBHalf,
        Convert: rgb64_half_rgb48_half,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat48bppRGBHalf,
        pGUIDPixFmtTo: GUID_PKPixelFormat64bppRGBHalf,
        Convert: rgb48_half_rgb64_half,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat64bppRGBFixedPoint,
        pGUIDPixFmtTo: GUID_PKPixelFormat48bppRGBFixedPoint,
        Convert: rgb64_half_rgb48_half,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat48bppRGBFixedPoint,
        pGUIDPixFmtTo: GUID_PKPixelFormat64bppRGBFixedPoint,
        Convert: rgb48_half_rgb64_half,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat32bppBGR,
        pGUIDPixFmtTo: GUID_PKPixelFormat24bppBGR,
        Convert: bgr32_bgr24,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat24bppBGR,
        pGUIDPixFmtTo: GUID_PKPixelFormat32bppBGR,
        Convert: bgr24_bgr32,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat96bppRGBFloat,
        pGUIDPixFmtTo: GUID_PKPixelFormat128bppRGBFixedPoint,
        Convert: rgb96_float_rgb128_fixed,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat128bppRGBFixedPoint,
        pGUIDPixFmtTo: GUID_PKPixelFormat96bppRGBFloat,
        Convert: rgb128_fixed_rgb96_float,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat32bppGrayFixedPoint,
        pGUIDPixFmtTo: GUID_PKPixelFormat32bppGrayFloat,
        Convert: gray32_fixed_gray32_float,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat32bppGrayFloat,
        pGUIDPixFmtTo: GUID_PKPixelFormat32bppGrayFixedPoint,
        Convert: gray32_float_gray32_fixed,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat16bppGrayFixedPoint,
        pGUIDPixFmtTo: GUID_PKPixelFormat32bppGrayFloat,
        Convert: gray16_fixed_gray32_float,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat32bppGrayFloat,
        pGUIDPixFmtTo: GUID_PKPixelFormat16bppGrayFixedPoint,
        Convert: gray32_float_gray16_fixed,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat48bppRGBFixedPoint,
        pGUIDPixFmtTo: GUID_PKPixelFormat96bppRGBFloat,
        Convert: rgb48_fixed_rgb96_float,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat96bppRGBFloat,
        pGUIDPixFmtTo: GUID_PKPixelFormat48bppRGBFixedPoint,
        Convert: rgb96_float_rgb48_fixed,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat64bppRGBFixedPoint,
        pGUIDPixFmtTo: GUID_PKPixelFormat96bppRGBFloat,
        Convert: rgb64_fixed_rgb96_float,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat96bppRGBFloat,
        pGUIDPixFmtTo: GUID_PKPixelFormat64bppRGBFixedPoint,
        Convert: rgb96_float_rgb64_fixed,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat64bppRGBAFixedPoint,
        pGUIDPixFmtTo: GUID_PKPixelFormat128bppRGBAFloat,
        Convert: rgba64_fixed_rgba128_float,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat128bppRGBAFloat,
        pGUIDPixFmtTo: GUID_PKPixelFormat64bppRGBAFixedPoint,
        Convert: rgba128_float_rgba64_fixed,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat32bppRGBE,
        pGUIDPixFmtTo: GUID_PKPixelFormat96bppRGBFloat,
        Convert: rgbe_rgb96_float,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat96bppRGBFloat,
        pGUIDPixFmtTo: GUID_PKPixelFormat32bppRGBE,
        Convert: rgb96_float_rgbe,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat64bppRGBAHalf,
        pGUIDPixFmtTo: GUID_PKPixelFormat128bppRGBAFloat,
        Convert: rgba64_half_rgba128_float,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat128bppRGBAFloat,
        pGUIDPixFmtTo: GUID_PKPixelFormat64bppRGBAHalf,
        Convert: rgba128_float_rgba64_half,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat64bppRGBHalf,
        pGUIDPixFmtTo: GUID_PKPixelFormat96bppRGBFloat,
        Convert: rgb64_half_rgb96_float,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat96bppRGBFloat,
        pGUIDPixFmtTo: GUID_PKPixelFormat64bppRGBHalf,
        Convert: rgb96_float_rgb64_half,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat48bppRGBHalf,
        pGUIDPixFmtTo: GUID_PKPixelFormat96bppRGBFloat,
        Convert: rgb48_half_rgb96_float,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat96bppRGBFloat,
        pGUIDPixFmtTo: GUID_PKPixelFormat48bppRGBHalf,
        Convert: rgb96_float_rgb48_half,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat16bppGrayHalf,
        pGUIDPixFmtTo: GUID_PKPixelFormat32bppGrayFloat,
        Convert: gray16_half_gray32_float,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat32bppGrayFloat,
        pGUIDPixFmtTo: GUID_PKPixelFormat16bppGrayHalf,
        Convert: gray32_float_gray16_half,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat16bppRGB555,
        pGUIDPixFmtTo: GUID_PKPixelFormat24bppRGB,
        Convert: rgb555_rgb24,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat24bppRGB,
        pGUIDPixFmtTo: GUID_PKPixelFormat16bppRGB555,
        Convert: rgb24_rgb555,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat16bppRGB565,
        pGUIDPixFmtTo: GUID_PKPixelFormat24bppRGB,
        Convert: rgb565_rgb24,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat24bppRGB,
        pGUIDPixFmtTo: GUID_PKPixelFormat16bppRGB565,
        Convert: rgb24_rgb565,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat32bppRGB101010,
        pGUIDPixFmtTo: GUID_PKPixelFormat48bppRGB,
        Convert: rgb101010_rgb48,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat48bppRGB,
        pGUIDPixFmtTo: GUID_PKPixelFormat32bppRGB101010,
        Convert: rgb48_rgb101010,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat32bppRGBA,
        pGUIDPixFmtTo: GUID_PKPixelFormat32bppBGRA,
        Convert: rgba32_bgra32,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat32bppBGRA,
        pGUIDPixFmtTo: GUID_PKPixelFormat32bppRGBA,
        Convert: bgra32_rgba32,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat32bppPRGBA,
        pGUIDPixFmtTo: GUID_PKPixelFormat32bppPBGRA,
        Convert: rgba32_bgra32,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat32bppPBGRA,
        pGUIDPixFmtTo: GUID_PKPixelFormat32bppPRGBA,
        Convert: bgra32_rgba32,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormatBlackWhite,
        pGUIDPixFmtTo: GUID_PKPixelFormat8bppGray,
        Convert: black_white_gray8,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat16bppGray,
        pGUIDPixFmtTo: GUID_PKPixelFormat8bppGray,
        Convert: gray16_gray8,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat48bppRGB,
        pGUIDPixFmtTo: GUID_PKPixelFormat24bppRGB,
        Convert: rgb48_rgb24,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat64bppRGBA,
        pGUIDPixFmtTo: GUID_PKPixelFormat32bppRGBA,
        Convert: rgba64_rgba32,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat32bppGrayFloat,
        pGUIDPixFmtTo: GUID_PKPixelFormat8bppGray,
        Convert: gray32_float_gray8,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat96bppRGBFloat,
        pGUIDPixFmtTo: GUID_PKPixelFormat24bppRGB,
        Convert: rgb96_float_rgb24,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat128bppRGBFloat,
        pGUIDPixFmtTo: GUID_PKPixelFormat24bppRGB,
        Convert: rgb128_float_rgb24,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat128bppRGBAFloat,
        pGUIDPixFmtTo: GUID_PKPixelFormat32bppRGBA,
        Convert: rgba128_float_rgba32,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat16bppGrayFixedPoint,
        pGUIDPixFmtTo: GUID_PKPixelFormat8bppGray,
        Convert: gray16_fixed_gray8,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat32bppGrayFixedPoint,
        pGUIDPixFmtTo: GUID_PKPixelFormat8bppGray,
        Convert: gray32_fixed_gray8,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat48bppRGBFixedPoint,
        pGUIDPixFmtTo: GUID_PKPixelFormat24bppRGB,
        Convert: rgb48_fixed_rgb24,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat64bppRGBFixedPoint,
        pGUIDPixFmtTo: GUID_PKPixelFormat24bppRGB,
        Convert: rgb64_fixed_rgb24,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat96bppRGBFixedPoint,
        pGUIDPixFmtTo: GUID_PKPixelFormat24bppRGB,
        Convert: rgb96_fixed_rgb24,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat128bppRGBFixedPoint,
        pGUIDPixFmtTo: GUID_PKPixelFormat24bppRGB,
        Convert: rgb128_fixed_rgb24,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat64bppRGBAFixedPoint,
        pGUIDPixFmtTo: GUID_PKPixelFormat32bppRGBA,
        Convert: rgba64_fixed_rgba32,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat128bppRGBAFixedPoint,
        pGUIDPixFmtTo: GUID_PKPixelFormat32bppRGBA,
        Convert: rgba128_fixed_rgba32,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat16bppGrayHalf,
        pGUIDPixFmtTo: GUID_PKPixelFormat8bppGray,
        Convert: gray16_half_gray8,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat48bppRGBHalf,
        pGUIDPixFmtTo: GUID_PKPixelFormat24bppRGB,
        Convert: rgb48_half_rgb24,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat64bppRGBHalf,
        pGUIDPixFmtTo: GUID_PKPixelFormat24bppRGB,
        Convert: rgb64_half_rgb24,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat64bppRGBAHalf,
        pGUIDPixFmtTo: GUID_PKPixelFormat32bppRGBA,
        Convert: rgba64_half_rgba32,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat32bppRGB101010,
        pGUIDPixFmtTo: GUID_PKPixelFormat24bppRGB,
        Convert: rgb101010_rgb24,
    },
    tagPKPixelConverterInfo {
        pGUIDPixFmtFrom: GUID_PKPixelFormat32bppRGBE,
        pGUIDPixFmtTo: GUID_PKPixelFormat24bppRGB,
        Convert: rgbe_rgb24,
    },
];

static S_PC_INFO2: [tagPKPixelConverter2Info; 4] = [
    tagPKPixelConverter2Info {
        pGUIDPixFmtFrom: GUID_PKPixelFormat128bppRGBFloat,
        pGUIDPixFmtTo: GUID_PKPixelFormat128bppRGBAFloat,
    },
    tagPKPixelConverter2Info {
        pGUIDPixFmtFrom: GUID_PKPixelFormatDontCare,
        pGUIDPixFmtTo: GUID_PKPixelFormat16bppRGB555,
    },
    tagPKPixelConverter2Info {
        pGUIDPixFmtFrom: GUID_PKPixelFormatDontCare,
        pGUIDPixFmtTo: GUID_PKPixelFormat16bppRGB565,
    },
    tagPKPixelConverter2Info {
        pGUIDPixFmtFrom: GUID_PKPixelFormatDontCare,
        pGUIDPixFmtTo: GUID_PKPixelFormat32bppBGRA,
    },
];

/// Original function: `Convert_Half_To_Float` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:48`.
pub unsafe fn convert_half_to_float(u16_: u16) -> u32 {
    let s = ((u16_ >> 15) & 0x0001) as u32;
    let e = ((u16_ >> 10) & 0x001f) as u32;
    let m = ((u16_ >> 0) & 0x03ff) as u32;

    if e == 0 {
        return s << 31;
    } else if e == 0x1f {
        return (s << 31) | (0xff << 23) | (m << 13);
    }

    (s << 31) | ((e.wrapping_sub(15).wrapping_add(127)) << 23) | (m << 13)
}

/// Original function: `Convert_Float_To_Half` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:68`.
pub unsafe fn convert_float_to_half(f: f32) -> u16 {
    let iFloat = f.to_bits();

    if f != f {
        return (iFloat | HLF_QNaN_BITZS as u32) as u16;
    } else if f < -HLF_MAX {
        return HLF_MAX_BITS_NEG;
    } else if HLF_MAX < f {
        return HLF_MAX_BITS;
    } else if -HLF_MIN < f && f < HLF_MIN {
        return ((iFloat >> 16) & 0x8000) as u16;
    }

    let s = (iFloat >> 31) & 0x00000001;
    let e = (iFloat >> 23) & 0x000000ff;
    let m = (iFloat >> 0) & 0x007fffff;

    ((s << 15) | ((e.wrapping_sub(127).wrapping_add(15)) << 10) | (m >> 13)) as u16
}

/// Original function: `Convert_Float_To_U8` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:101`.
pub unsafe fn convert_float_to_u8(f: f32) -> u8 {
    if f <= 0.0 {
        0
    } else if f <= 0.0031308 {
        ((255.0 * f * 12.92) + 0.5) as u8
    } else if f < 1.0 {
        ((255.0 * ((1.055 * f.powf(1.0 / 2.4)) - 0.055)) + 0.5) as u8
    } else {
        255
    }
}

/// Original function: `Convert_AlphaFloat_To_U8` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:122`.
pub unsafe fn convert_alpha_float_to_u8(f: f32) -> u8 {
    if f <= 0.0 {
        0
    } else if f < 1.0 {
        ((255.0 * f) + 0.5) as u8
    } else {
        255
    }
}

/// Original function: `RGB24_BGR24` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:140`.
pub unsafe fn rgb24_bgr24(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let Some(rect) = pRect.as_ref() else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(pb) = NonNull::new(pb) else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let row_len = (rect.Width * 3) as usize;

    for y in 0..rect.Height {
        let row = std::slice::from_raw_parts_mut(
            pb.as_ptr().add(checked_row_offset(cbStride, y)?),
            row_len,
        );
        for pixel in row.chunks_exact_mut(3) {
            pixel.swap(0, 2);
        }
    }

    Ok(())
}

/// Original function: `BGR24_RGB24` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:162`.
pub unsafe fn bgr24_rgb24(
    pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    rgb24_bgr24(&mut *pFC, pRect, pb, cbStride)
}

/// Original function: `RGB24_BGR32` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:167`.
pub unsafe fn rgb24_bgr32(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let Some(rect) = pRect.as_ref() else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(pb) = NonNull::new(pb) else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let row_len = (rect.Width * 4) as usize;

    for y in (0..rect.Height).rev() {
        let row = std::slice::from_raw_parts_mut(
            pb.as_ptr().add(checked_row_offset(cbStride, y)?),
            row_len,
        );
        for j in (0..rect.Width).rev() {
            let src = (3 * j) as usize;
            let dst = (4 * j) as usize;
            let r = row[src];
            let g = row[src + 1];
            let b = row[src + 2];
            row[dst] = b;
            row[dst + 1] = g;
            row[dst + 2] = r;
            row[dst + 3] = 0;
        }
    }

    Ok(())
}

/// Original function: `BGR32_RGB24` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:190`.
pub unsafe fn bgr32_rgb24(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let Some(rect) = pRect.as_ref() else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(pb) = NonNull::new(pb) else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let row_len = (rect.Width * 4) as usize;

    for y in 0..rect.Height {
        let row = std::slice::from_raw_parts_mut(
            pb.as_ptr().add(checked_row_offset(cbStride, y)?),
            row_len,
        );
        for j in 0..rect.Width {
            let src = (4 * j) as usize;
            let dst = (3 * j) as usize;
            let b = row[src];
            row[dst] = row[src + 2];
            row[dst + 1] = row[src + 1];
            row[dst + 2] = b;
        }
    }

    Ok(())
}

/// Original function: `RGB24_Gray8` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:213`.
pub unsafe fn rgb24_gray8(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let (rect, pb, row_len) = validate_direct_raw_converter_args(pRect, pb, cbStride, 3)?;

    for y in 0..rect.Height {
        let row = std::slice::from_raw_parts_mut(
            pb.as_ptr().add(checked_row_offset(cbStride, y)?),
            row_len,
        );
        for k in 0..rect.Width {
            let j = (3 * k) as usize;
            let r = row[j];
            let g = row[j + 1];
            let b = row[j + 2];

            row[k as usize] = r / 4 + g / 2 + b / 8 + 16;
        }
    }

    Ok(())
}

/// Original function: `BGR24_Gray8` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:236`.
pub unsafe fn bgr24_gray8(
    pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    bgr24_rgb24(&mut *pFC, pRect, pb, cbStride)?;
    rgb24_gray8(&mut *pFC, pRect, pb, cbStride)
}

/// Original function: `Gray8_RGB24` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:247`.
pub unsafe fn gray8_rgb24(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let (rect, pb, row_len) = validate_direct_raw_converter_args(pRect, pb, cbStride, 3)?;

    for y in 0..rect.Height {
        let row = std::slice::from_raw_parts_mut(
            pb.as_ptr().add(checked_row_offset(cbStride, y)?),
            row_len,
        );
        for j in (0..rect.Width).rev() {
            let k = (3 * j) as usize;
            let v = row[j as usize];

            row[k] = v;
            row[k + 1] = v;
            row[k + 2] = v;
        }
    }

    Ok(())
}

/// Original function: `Gray8_BGR24` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:270`.
pub unsafe fn gray8_bgr24(
    pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    gray8_rgb24(&mut *pFC, pRect, pb, cbStride)
}

/// Original function: `RGB48_BGR48` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:276`.
pub unsafe fn rgb48_bgr48(
    pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let (rect, pb, row_len) = validate_direct_raw_converter_args(pRect, pb, cbStride, 2)?;
    let Some(buffer_len) = (cbStride as usize).checked_mul(rect.Height as usize) else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let buffer = std::slice::from_raw_parts_mut(pb.as_ptr(), buffer_len);

    pk_format_converter_copy(&mut *pFC, Some(rect), &mut *buffer, cbStride)?;

    for y in 0..rect.Height {
        let row = std::slice::from_raw_parts_mut(
            buffer.as_mut_ptr().add(checked_row_offset(cbStride, y)?),
            row_len,
        );
        for pixel in row.chunks_exact_mut(6) {
            pixel.swap(0, 4);
            pixel.swap(1, 5);
        }
    }

    Ok(())
}

/// Original function: `BGR48_RGB48` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:305`.
pub unsafe fn bgr48_rgb48(
    pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    rgb48_bgr48(&mut *pFC, pRect, pb, cbStride)
}

/// Original function: `RGB48_Gray16` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:310`.
pub unsafe fn rgb48_gray16(
    pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let (Some(rect), Some(pb)) = (pRect.as_ref(), NonNull::new(pb)) else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(buffer_len) = (cbStride as usize).checked_mul(rect.Height as usize) else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let buffer = std::slice::from_raw_parts_mut(pb.as_ptr(), buffer_len);

    pk_format_converter_copy(&mut *pFC, Some(rect), &mut *buffer, cbStride)?;

    let row_len = rect.Width as usize;
    for y in 0..rect.Height {
        let row = std::slice::from_raw_parts_mut(
            buffer
                .as_mut_ptr()
                .add(cbStride as usize * y as usize)
                .cast::<u16>(),
            row_len,
        );
        for (k, j) in (0..row_len).step_by(3).enumerate() {
            let r = row[j];
            let g = row[j + 1];
            let b = row[j + 2];

            row[k] = r / 4 + g / 2 + b / 8 + 16;
        }
    }

    Ok(())
}

/// Original function: `RGBA128Fixed_RGBA128Float` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:342`.
pub unsafe fn rgba128_fixed_rgba128_float(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidthX4 = (4 * (*pRect).Width) as usize;
    let fltCvtFactor: f32 = 1.0 / ((1_i32 << 24) as f32);
    let Some(pb) = NonNull::new(pb) else {
        return Err(crate::WmpError::InvalidParameter);
    };

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(
            pb.as_ptr()
                .add((cbStride as i32 * y) as usize)
                .cast::<u32>(),
            iWidthX4,
        );

        for value in row {
            let fixed = *value as i32;
            *value = ((fixed as f32) * fltCvtFactor).to_bits();
        }
    }

    Ok(())
}

/// Original function: `RGBA128Float_RGBA128Fixed` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:365`.
pub unsafe fn rgba128_float_rgba128_fixed(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidthX4 = (4 * (*pRect).Width) as usize;
    let fltCvtFactor: f32 = (1_i32 << 24) as f32;
    let Some(pb) = NonNull::new(pb) else {
        return Err(crate::WmpError::InvalidParameter);
    };

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(
            pb.as_ptr()
                .add((cbStride as i32 * y) as usize)
                .cast::<u32>(),
            iWidthX4,
        );

        for value in row {
            let float = f32::from_bits(*value);
            *value = (((float * fltCvtFactor) + 0.5) as i32) as u32;
        }
    }

    Ok(())
}

/// Original function: `RGB96Fixed_RGB96Float` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:389`.
pub unsafe fn rgb96_fixed_rgb96_float(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidthX3 = (3 * (*pRect).Width) as usize;
    let fltCvtFactor: f32 = 1.0 / ((1_i32 << 24) as f32);
    let Some(pb) = NonNull::new(pb) else {
        return Err(crate::WmpError::InvalidParameter);
    };

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(
            pb.as_ptr()
                .add((cbStride as i32 * y) as usize)
                .cast::<u32>(),
            iWidthX3,
        );

        for value in row {
            let fixed = *value as i32;
            *value = ((fixed as f32) * fltCvtFactor).to_bits();
        }
    }

    Ok(())
}

/// Original function: `RGB128Fixed_RGB96Float` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:412`.
pub unsafe fn rgb128_fixed_rgb96_float(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let Some(rect) = pRect.as_ref() else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(pb) = NonNull::new(pb) else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let iHeight = rect.Height;
    let iWidth = rect.Width;
    let fltCvtFactor: f32 = 1.0 / ((1_i32 << 24) as f32);

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(
            pb.as_ptr()
                .add((cbStride as i32 * y) as usize)
                .cast::<u32>(),
            (4 * iWidth) as usize,
        );

        for x in 0..iWidth as usize {
            row[3 * x] = ((row[4 * x] as i32 as f32) * fltCvtFactor).to_bits();
            row[3 * x + 1] = ((row[4 * x + 1] as i32 as f32) * fltCvtFactor).to_bits();
            row[3 * x + 2] = ((row[4 * x + 2] as i32 as f32) * fltCvtFactor).to_bits();
        }
    }

    Ok(())
}

/// Original function: `RGB96Float_RGB96Fixed` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:440`.
pub unsafe fn rgb96_float_rgb96_fixed(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let Some(rect) = pRect.as_ref() else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(pb) = NonNull::new(pb) else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let iHeight = rect.Height;
    let iWidthX3 = (3 * rect.Width) as usize;
    let fltCvtFactor: f32 = (1_i32 << 24) as f32;

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(
            pb.as_ptr()
                .add((cbStride as i32 * y) as usize)
                .cast::<u32>(),
            iWidthX3,
        );

        for value in row {
            let float = f32::from_bits(*value);
            *value = (((float * fltCvtFactor) + 0.5) as i32) as u32;
        }
    }

    Ok(())
}

/// Original function: `RGB96Float_RGB128Fixed` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:463`.
pub unsafe fn rgb96_float_rgb128_fixed(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let Some(rect) = pRect.as_ref() else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(pb) = NonNull::new(pb) else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let iHeight = rect.Height;
    let iWidth = rect.Width;
    let fltCvtFactor: f32 = (1_i32 << 24) as f32;

    for y in (0..iHeight).rev() {
        let row = std::slice::from_raw_parts_mut(
            pb.as_ptr()
                .add((cbStride as i32 * y) as usize)
                .cast::<u32>(),
            (4 * iWidth) as usize,
        );

        for x in (0..iWidth as usize).rev() {
            row[4 * x] = (((f32::from_bits(row[3 * x]) * fltCvtFactor) + 0.5) as i32) as u32;
            row[4 * x + 1] =
                (((f32::from_bits(row[3 * x + 1]) * fltCvtFactor) + 0.5) as i32) as u32;
            row[4 * x + 2] =
                (((f32::from_bits(row[3 * x + 2]) * fltCvtFactor) + 0.5) as i32) as u32;
            row[4 * x + 3] = 0;
        }
    }

    Ok(())
}

/// Original function: `RGB96Float_RGB128Float` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:492`.
pub unsafe fn rgb96_float_rgb128_float(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let Some(rect) = pRect.as_ref() else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(pb) = NonNull::new(pb) else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let iHeight = rect.Height;
    let iWidth = rect.Width;

    for y in (0..iHeight).rev() {
        let row = std::slice::from_raw_parts_mut(
            pb.as_ptr()
                .add((cbStride as i32 * y) as usize)
                .cast::<u32>(),
            (4 * iWidth) as usize,
        );

        for x in (0..iWidth as usize).rev() {
            row[4 * x] = row[3 * x];
            row[4 * x + 1] = row[3 * x + 1];
            row[4 * x + 2] = row[3 * x + 2];
            row[4 * x + 3] = 0.0f32.to_bits();
        }
    }

    Ok(())
}

/// Original function: `RGB128Float_RGB96Float` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:520`.
pub unsafe fn rgb128_float_rgb96_float(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let Some(rect) = pRect.as_ref() else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(pb) = NonNull::new(pb) else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let iHeight = rect.Height;
    let iWidth = rect.Width;

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(
            pb.as_ptr()
                .add((cbStride as i32 * y) as usize)
                .cast::<u32>(),
            (4 * iWidth) as usize,
        );

        for x in 0..iWidth as usize {
            row[3 * x] = row[4 * x];
            row[3 * x + 1] = row[4 * x + 1];
            row[3 * x + 2] = row[4 * x + 2];
        }
    }

    Ok(())
}

/// Original function: `RGB48Half_RGB64Half` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:546`.
pub unsafe fn rgb48_half_rgb64_half(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let Some(rect) = pRect.as_ref() else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(pb) = NonNull::new(pb) else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let iHeight = rect.Height;
    let iWidth = rect.Width;

    for y in (0..iHeight).rev() {
        let row = std::slice::from_raw_parts_mut(
            pb.as_ptr()
                .add((cbStride as i32 * y) as usize)
                .cast::<i16>(),
            (4 * iWidth) as usize,
        );

        for x in (0..iWidth as usize).rev() {
            row[4 * x] = row[3 * x];
            row[4 * x + 1] = row[3 * x + 1];
            row[4 * x + 2] = row[3 * x + 2];
            row[4 * x + 3] = 0;
        }
    }

    Ok(())
}

/// Original function: `RGB64Half_RGB48Half` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:574`.
pub unsafe fn rgb64_half_rgb48_half(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let Some(rect) = pRect.as_ref() else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(pb) = NonNull::new(pb) else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let iHeight = rect.Height;
    let iWidth = rect.Width;

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(
            pb.as_ptr()
                .add((cbStride as i32 * y) as usize)
                .cast::<i16>(),
            (4 * iWidth) as usize,
        );

        for x in 0..iWidth as usize {
            row[3 * x] = row[4 * x];
            row[3 * x + 1] = row[4 * x + 1];
            row[3 * x + 2] = row[4 * x + 2];
        }
    }

    Ok(())
}

/// Original function: `BGR24_BGR32` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:600`.
pub unsafe fn bgr24_bgr32(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let Some(rect) = pRect.as_ref() else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(pb) = NonNull::new(pb) else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let iHeight = rect.Height;
    let iWidth = rect.Width;

    for y in (0..iHeight).rev() {
        let row = std::slice::from_raw_parts_mut(
            pb.as_ptr().add(checked_row_offset(cbStride, y)?),
            (4 * iWidth) as usize,
        );

        for x in (0..iWidth as usize).rev() {
            let b = row[3 * x];
            let g = row[3 * x + 1];
            let r = row[3 * x + 2];
            row[4 * x] = b;
            row[4 * x + 1] = g;
            row[4 * x + 2] = r;
            row[4 * x + 3] = 0;
        }
    }

    Ok(())
}

/// Original function: `BGR32_BGR24` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:628`.
pub unsafe fn bgr32_bgr24(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let Some(rect) = pRect.as_ref() else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(pb) = NonNull::new(pb) else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let iHeight = rect.Height;
    let iWidth = rect.Width;

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(
            pb.as_ptr().add(checked_row_offset(cbStride, y)?),
            (4 * iWidth) as usize,
        );

        for x in 0..iWidth as usize {
            row[3 * x] = row[4 * x];
            row[3 * x + 1] = row[4 * x + 1];
            row[3 * x + 2] = row[4 * x + 2];
        }
    }

    Ok(())
}

/// Original function: `Gray32Fixed_Gray32Float` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:654`.
pub unsafe fn gray32_fixed_gray32_float(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let Some(rect) = pRect.as_ref() else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(pb) = NonNull::new(pb) else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let iHeight = rect.Height;
    let iWidth = rect.Width as usize;
    let fltCvtFactor: f32 = 1.0 / ((1_i32 << 24) as f32);

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(
            pb.as_ptr()
                .add((cbStride as i32 * y) as usize)
                .cast::<u32>(),
            iWidth,
        );

        for value in row {
            let fixed = *value as i32;
            *value = ((fixed as f32) * fltCvtFactor).to_bits();
        }
    }

    Ok(())
}

/// Original function: `Gray32Float_Gray32Fixed` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:677`.
pub unsafe fn gray32_float_gray32_fixed(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let Some(rect) = pRect.as_ref() else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(pb) = NonNull::new(pb) else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let iHeight = rect.Height;
    let iWidth = rect.Width as usize;
    let fltCvtFactor: f32 = (1_i32 << 24) as f32;

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(
            pb.as_ptr()
                .add((cbStride as i32 * y) as usize)
                .cast::<u32>(),
            iWidth,
        );

        for value in row {
            let float = f32::from_bits(*value);
            *value = (((float * fltCvtFactor) + 0.5) as i32) as u32;
        }
    }

    Ok(())
}

/// Original function: `Gray16Fixed_Gray32Float` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:701`.
pub unsafe fn gray16_fixed_gray32_float(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * std::mem::size_of::<f32>();
    let fltCvtFactor: f32 = 1.0 / ((1_i32 << 13) as f32);

    for y in (0..iHeight).rev() {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in (0..iWidth).rev() {
            let src = 2 * x;
            let dst = 4 * x;
            let value = i16::from_ne_bytes([row[src], row[src + 1]]);
            row[dst..dst + 4].copy_from_slice(&((value as f32) * fltCvtFactor).to_ne_bytes());
        }
    }

    Ok(())
}

/// Original function: `Gray32Float_Gray16Fixed` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:725`.
pub unsafe fn gray32_float_gray16_fixed(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * std::mem::size_of::<f32>();
    let fltCvtFactor: f32 = (1_i32 << 13) as f32;

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidth {
            let src = 4 * x;
            let dst = 2 * x;
            let value = f32::from_ne_bytes([row[src], row[src + 1], row[src + 2], row[src + 3]]);
            row[dst..dst + 2]
                .copy_from_slice(&(((value * fltCvtFactor) + 0.5) as i16).to_ne_bytes());
        }
    }

    Ok(())
}

/// Original function: `RGB48Fixed_RGB96Float` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:749`.
pub unsafe fn rgb48_fixed_rgb96_float(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidthX3 = (3 * (*pRect).Width) as usize;
    let row_len = iWidthX3 * std::mem::size_of::<f32>();
    let fltCvtFactor: f32 = 1.0 / ((1_i32 << 13) as f32);

    for y in (0..iHeight).rev() {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in (0..iWidthX3).rev() {
            let src = 2 * x;
            let dst = 4 * x;
            let value = i16::from_ne_bytes([row[src], row[src + 1]]);
            row[dst..dst + 4].copy_from_slice(&((value as f32) * fltCvtFactor).to_ne_bytes());
        }
    }

    Ok(())
}

/// Original function: `RGB96Float_RGB48Fixed` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:773`.
pub unsafe fn rgb96_float_rgb48_fixed(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidthX3 = (3 * (*pRect).Width) as usize;
    let row_len = iWidthX3 * std::mem::size_of::<f32>();
    let fltCvtFactor: f32 = (1_i32 << 13) as f32;

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidthX3 {
            let src = 4 * x;
            let dst = 2 * x;
            let value = f32::from_ne_bytes([row[src], row[src + 1], row[src + 2], row[src + 3]]);
            row[dst..dst + 2]
                .copy_from_slice(&(((value * fltCvtFactor) + 0.5) as i16).to_ne_bytes());
        }
    }

    Ok(())
}

/// Original function: `RGB64Fixed_RGB96Float` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:797`.
pub unsafe fn rgb64_fixed_rgb96_float(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * 3 * std::mem::size_of::<f32>();
    let fltCvtFactor: f32 = 1.0 / ((1_i32 << 13) as f32);

    for y in (0..iHeight).rev() {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in (0..iWidth).rev() {
            let src = 8 * x;
            let dst = 12 * x;
            let r = i16::from_ne_bytes([row[src], row[src + 1]]);
            row[dst..dst + 4].copy_from_slice(&((r as f32) * fltCvtFactor).to_ne_bytes());

            let g = i16::from_ne_bytes([row[src + 2], row[src + 3]]);
            row[dst + 4..dst + 8].copy_from_slice(&((g as f32) * fltCvtFactor).to_ne_bytes());

            let b = i16::from_ne_bytes([row[src + 4], row[src + 5]]);
            row[dst + 8..dst + 12].copy_from_slice(&((b as f32) * fltCvtFactor).to_ne_bytes());
        }
    }

    Ok(())
}

/// Original function: `RGB96Float_RGB64Fixed` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:825`.
pub unsafe fn rgb96_float_rgb64_fixed(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * 3 * std::mem::size_of::<f32>();
    let fltCvtFactor: f32 = (1_i32 << 13) as f32;

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidth {
            let src = 12 * x;
            let dst = 8 * x;
            let r = f32::from_ne_bytes([row[src], row[src + 1], row[src + 2], row[src + 3]]);
            let g = f32::from_ne_bytes([row[src + 4], row[src + 5], row[src + 6], row[src + 7]]);
            let b = f32::from_ne_bytes([row[src + 8], row[src + 9], row[src + 10], row[src + 11]]);

            row[dst..dst + 2].copy_from_slice(&(((r * fltCvtFactor) + 0.5) as i16).to_ne_bytes());
            row[dst + 2..dst + 4]
                .copy_from_slice(&(((g * fltCvtFactor) + 0.5) as i16).to_ne_bytes());
            row[dst + 4..dst + 6]
                .copy_from_slice(&(((b * fltCvtFactor) + 0.5) as i16).to_ne_bytes());
            row[dst + 6..dst + 8].copy_from_slice(&0_i16.to_ne_bytes());
        }
    }

    Ok(())
}

/// Original function: `RGBA64Fixed_RGBA128Float` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:854`.
pub unsafe fn rgba64_fixed_rgba128_float(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidthX4 = (4 * (*pRect).Width) as usize;
    let row_len = iWidthX4 * std::mem::size_of::<f32>();
    let fltCvtFactor: f32 = 1.0 / ((1_i32 << 13) as f32);

    for y in (0..iHeight).rev() {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in (0..iWidthX4).rev() {
            let src = 2 * x;
            let dst = 4 * x;
            let value = i16::from_ne_bytes([row[src], row[src + 1]]);
            row[dst..dst + 4].copy_from_slice(&((value as f32) * fltCvtFactor).to_ne_bytes());
        }
    }

    Ok(())
}

/// Original function: `RGBA128Float_RGBA64Fixed` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:879`.
pub unsafe fn rgba128_float_rgba64_fixed(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidthX4 = (4 * (*pRect).Width) as usize;
    let row_len = iWidthX4 * std::mem::size_of::<f32>();
    let fltCvtFactor: f32 = (1_i32 << 13) as f32;

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidthX4 {
            let src = 4 * x;
            let dst = 2 * x;
            let value = f32::from_ne_bytes([row[src], row[src + 1], row[src + 2], row[src + 3]]);
            row[dst..dst + 2]
                .copy_from_slice(&(((value * fltCvtFactor) + 0.5) as i16).to_ne_bytes());
        }
    }

    Ok(())
}

/// Original function: `RGBE_RGB96Float` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:904`.
pub unsafe fn rgbe_rgb96_float(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let width = (*pRect).Width as usize;
    let row_len = width * 3 * std::mem::size_of::<f32>();

    for y in (0..iHeight).rev() {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in (0..width).rev() {
            let src = 4 * x;
            let dst = 3 * x;
            let rawExp = row[src + 3];

            if rawExp == 0 {
                row[dst * std::mem::size_of::<f32>()..(dst + 3) * std::mem::size_of::<f32>()]
                    .fill(0);
            } else {
                let adjExp: i32 = rawExp as i32 - 128 - 8;
                let mut fltExp: f32;

                if adjExp > -32 && adjExp < 32 {
                    fltExp = ((1_u32) << adjExp.abs()) as f32;
                    if adjExp < 0 {
                        fltExp = 1.0 / fltExp;
                    }
                } else {
                    fltExp = 2.0_f32.powi(adjExp);
                }

                // Source and destination alias the same buffer; the original C reads each
                // source channel immediately before writing its float, so an in-place write
                // can clobber a not-yet-read source byte. Read each channel only after the
                // prior channel's float has been written to reproduce that overwrite order.
                let dst = dst * std::mem::size_of::<f32>();
                let red = row[src];
                row[dst..dst + 4].copy_from_slice(&((red as f32) * fltExp).to_ne_bytes());
                let green = row[src + 1];
                row[dst + 4..dst + 8].copy_from_slice(&((green as f32) * fltExp).to_ne_bytes());
                let blue = row[src + 2];
                row[dst + 8..dst + 12].copy_from_slice(&((blue as f32) * fltExp).to_ne_bytes());
            }
        }
    }

    Ok(())
}

/// Original function: `RGB96Float_RGBE` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:957`.
pub unsafe fn rgb96_float_rgbe(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let width = (*pRect).Width as usize;
    let row_len = width * 3 * std::mem::size_of::<f32>();

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..width {
            let src = 3 * x * std::mem::size_of::<f32>();
            let dst = 4 * x;
            let fltRed =
                f32::from_ne_bytes([row[src], row[src + 1], row[src + 2], row[src + 3]]).max(0.0);
            let fltGreen =
                f32::from_ne_bytes([row[src + 4], row[src + 5], row[src + 6], row[src + 7]])
                    .max(0.0);
            let fltBlue =
                f32::from_ne_bytes([row[src + 8], row[src + 9], row[src + 10], row[src + 11]])
                    .max(0.0);
            let mut fltMaxPos = fltRed;

            if fltGreen > fltMaxPos {
                fltMaxPos = fltGreen;
            }

            if fltBlue > fltMaxPos {
                fltMaxPos = fltBlue;
            }

            if fltMaxPos < 1e-32 {
                row[dst..dst + 4].fill(0);
            } else {
                let e = fltMaxPos.log2().floor() as i32 + 1;
                let fltScale = 256.0 / 2.0_f32.powi(e);

                row[dst] = (fltRed * fltScale) as u8;
                row[dst + 1] = (fltGreen * fltScale) as u8;
                row[dst + 2] = (fltBlue * fltScale) as u8;
                row[dst + 3] = (e + 128) as u8;
            }
        }
    }

    Ok(())
}

/// Original function: `RGBA64Half_RGBA128Float` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1013`.
pub unsafe fn rgba64_half_rgba128_float(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidthX4 = (4 * (*pRect).Width) as usize;
    let row_len = iWidthX4 * std::mem::size_of::<f32>();

    for y in (0..iHeight).rev() {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in (0..iWidthX4).rev() {
            let src = 2 * x;
            let dst = 4 * x;
            let half = u16::from_ne_bytes([row[src], row[src + 1]]);
            row[dst..dst + 4].copy_from_slice(&convert_half_to_float(half).to_ne_bytes());
        }
    }

    Ok(())
}

/// Original function: `RGBA128Float_RGBA64Half` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1036`.
pub unsafe fn rgba128_float_rgba64_half(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidthX4 = (4 * (*pRect).Width) as usize;
    let row_len = iWidthX4 * std::mem::size_of::<f32>();

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidthX4 {
            let src = 4 * x;
            let dst = 2 * x;
            let value = f32::from_ne_bytes([row[src], row[src + 1], row[src + 2], row[src + 3]]);
            row[dst..dst + 2].copy_from_slice(&convert_float_to_half(value).to_ne_bytes());
        }
    }

    Ok(())
}

/// Original function: `RGB64Half_RGB96Float` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1059`.
pub unsafe fn rgb64_half_rgb96_float(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * 3 * std::mem::size_of::<f32>();

    for y in (0..iHeight).rev() {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in (0..iWidth).rev() {
            let src = 8 * x;
            let dst = 12 * x;
            let r = u16::from_ne_bytes([row[src], row[src + 1]]);
            row[dst..dst + 4].copy_from_slice(&convert_half_to_float(r).to_ne_bytes());

            let g = u16::from_ne_bytes([row[src + 2], row[src + 3]]);
            row[dst + 4..dst + 8].copy_from_slice(&convert_half_to_float(g).to_ne_bytes());

            let b = u16::from_ne_bytes([row[src + 4], row[src + 5]]);
            row[dst + 8..dst + 12].copy_from_slice(&convert_half_to_float(b).to_ne_bytes());
        }
    }

    Ok(())
}

/// Original function: `RGB96Float_RGB64Half` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1086`.
pub unsafe fn rgb96_float_rgb64_half(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * 3 * std::mem::size_of::<f32>();

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidth {
            let src = 12 * x;
            let dst = 8 * x;
            let r = f32::from_ne_bytes([row[src], row[src + 1], row[src + 2], row[src + 3]]);
            let g = f32::from_ne_bytes([row[src + 4], row[src + 5], row[src + 6], row[src + 7]]);
            let b = f32::from_ne_bytes([row[src + 8], row[src + 9], row[src + 10], row[src + 11]]);

            row[dst..dst + 2].copy_from_slice(&convert_float_to_half(r).to_ne_bytes());
            row[dst + 2..dst + 4].copy_from_slice(&convert_float_to_half(g).to_ne_bytes());
            row[dst + 4..dst + 6].copy_from_slice(&convert_float_to_half(b).to_ne_bytes());
            row[dst + 6..dst + 8].copy_from_slice(&0_u16.to_ne_bytes());
        }
    }

    Ok(())
}

/// Original function: `RGB48Half_RGB96Float` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1114`.
pub unsafe fn rgb48_half_rgb96_float(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidthX3 = (3 * (*pRect).Width) as usize;
    let row_len = iWidthX3 * std::mem::size_of::<f32>();

    for y in (0..iHeight).rev() {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in (0..iWidthX3).rev() {
            let src = 2 * x;
            let dst = 4 * x;
            let half = u16::from_ne_bytes([row[src], row[src + 1]]);
            row[dst..dst + 4].copy_from_slice(&convert_half_to_float(half).to_ne_bytes());
        }
    }

    Ok(())
}

/// Original function: `RGB96Float_RGB48Half` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1137`.
pub unsafe fn rgb96_float_rgb48_half(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidthX3 = (3 * (*pRect).Width) as usize;
    let row_len = iWidthX3 * std::mem::size_of::<f32>();

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidthX3 {
            let src = 4 * x;
            let dst = 2 * x;
            let value = f32::from_ne_bytes([row[src], row[src + 1], row[src + 2], row[src + 3]]);
            row[dst..dst + 2].copy_from_slice(&convert_float_to_half(value).to_ne_bytes());
        }
    }

    Ok(())
}

/// Original function: `Gray16Half_Gray32Float` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1160`.
pub unsafe fn gray16_half_gray32_float(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * std::mem::size_of::<f32>();

    for y in (0..iHeight).rev() {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in (0..iWidth).rev() {
            let src = 2 * x;
            let dst = 4 * x;
            let half = u16::from_ne_bytes([row[src], row[src + 1]]);
            row[dst..dst + 4].copy_from_slice(&convert_half_to_float(half).to_ne_bytes());
        }
    }

    Ok(())
}

/// Original function: `Gray32Float_Gray16Half` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1183`.
pub unsafe fn gray32_float_gray16_half(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * std::mem::size_of::<f32>();

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidth {
            let src = 4 * x;
            let dst = 2 * x;
            let value = f32::from_ne_bytes([row[src], row[src + 1], row[src + 2], row[src + 3]]);
            row[dst..dst + 2].copy_from_slice(&convert_float_to_half(value).to_ne_bytes());
        }
    }

    Ok(())
}

/// Original function: `RGB555_RGB24` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1205`.
pub unsafe fn rgb555_rgb24(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * 3;

    for y in (0..iHeight).rev() {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in (0..iWidth).rev() {
            let src = 2 * x;
            let dst = 3 * x;
            let v = u16::from_ne_bytes([row[src], row[src + 1]]);
            let r = (v >> 10) & 0x1f;
            let g = (v >> 5) & 0x1f;
            let b = v & 0x1f;

            row[dst] = (r << 3) as u8;
            row[dst + 1] = (g << 3) as u8;
            row[dst + 2] = (b << 3) as u8;
        }
    }

    Ok(())
}

/// Original function: `RGB101010_RGB48` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1237`.
pub unsafe fn rgb101010_rgb48(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * 3 * std::mem::size_of::<u16>();

    for y in (0..iHeight).rev() {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in (0..iWidth).rev() {
            let src = 4 * x;
            let dst = 6 * x;
            let v = u32::from_ne_bytes([row[src], row[src + 1], row[src + 2], row[src + 3]]);
            let r = (v >> 20) & 0x3ff;
            let g = (v >> 10) & 0x3ff;
            let b = v & 0x3ff;

            row[dst..dst + 2].copy_from_slice(&((r << 6) as u16).to_ne_bytes());
            row[dst + 2..dst + 4].copy_from_slice(&((g << 6) as u16).to_ne_bytes());
            row[dst + 4..dst + 6].copy_from_slice(&((b << 6) as u16).to_ne_bytes());
        }
    }

    Ok(())
}

/// Original function: `RGB24_RGB555` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1269`.
pub unsafe fn rgb24_rgb555(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * 3;

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidth {
            let src = 3 * x;
            let dst = 2 * x;
            let r = row[src] as u16;
            let g = row[src + 1] as u16;
            let b = row[src + 2] as u16;

            row[dst..dst + 2]
                .copy_from_slice(&(((r & 0xf8) << 7) | ((g & 0xf8) << 2) | (b >> 3)).to_ne_bytes());
        }
    }

    Ok(())
}

/// Original function: `RGB48_RGB101010` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1302`.
pub unsafe fn rgb48_rgb101010(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * 3 * std::mem::size_of::<u16>();

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidth {
            let src = 6 * x;
            let dst = 4 * x;
            let r = u16::from_ne_bytes([row[src], row[src + 1]]) as u32;
            let g = u16::from_ne_bytes([row[src + 2], row[src + 3]]) as u32;
            let b = u16::from_ne_bytes([row[src + 4], row[src + 5]]) as u32;

            row[dst..dst + 4].copy_from_slice(
                &((3 << 30) | ((r & 0x0000_ffc0) << 14) | ((g & 0x0000_ffc0) << 4) | (b >> 6))
                    .to_ne_bytes(),
            );
        }
    }

    Ok(())
}

/// Original function: `RGB565_RGB24` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1335`.
pub unsafe fn rgb565_rgb24(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * 3;

    for y in (0..iHeight).rev() {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in (0..iWidth).rev() {
            let src = 2 * x;
            let dst = 3 * x;
            let v = u16::from_ne_bytes([row[src], row[src + 1]]);
            let r = (v >> 11) & 0x1f;
            let g = (v >> 5) & 0x3f;
            let b = v & 0x1f;

            row[dst] = (r << 3) as u8;
            row[dst + 1] = (g << 2) as u8;
            row[dst + 2] = (b << 3) as u8;
        }
    }

    Ok(())
}

/// Original function: `RGB24_RGB565` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1368`.
pub unsafe fn rgb24_rgb565(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * 3;

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidth {
            let src = 3 * x;
            let dst = 2 * x;
            let r = row[src] as u16;
            let g = row[src + 1] as u16;
            let b = row[src + 2] as u16;

            row[dst..dst + 2]
                .copy_from_slice(&(((r & 0xf8) << 8) | ((g & 0xfc) << 3) | (b >> 3)).to_ne_bytes());
        }
    }

    Ok(())
}

/// Original function: `RGBA32_BGRA32` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1400`.
pub unsafe fn rgba32_bgra32(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidthX4 = (4 * (*pRect).Width) as usize;

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), iWidthX4);

        for pixel in row.chunks_exact_mut(4) {
            pixel.swap(0, 2);
        }
    }

    Ok(())
}

/// Original function: `BGRA32_RGBA32` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1426`.
pub unsafe fn bgra32_rgba32(
    pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    rgba32_bgra32(&mut *pFC, pRect, pb, cbStride)
}

/// Original function: `BlackWhite_Gray8` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1432`.
pub unsafe fn black_white_gray8(
    pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width;
    let Some(decoder) = pFC.pDecoder else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let decoder = decoder.as_ref();
    let bBlackWhite = decoder.WMP.wmiSCP.bBlackWhite;

    for y in (0..iHeight).rev() {
        let row =
            std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), iWidth as usize);

        if iWidth % 8 != 0 {
            let v = row[(iWidth / 8) as usize];

            for n in 0..iWidth % 8 {
                row[(iWidth / 8 * 8 + n) as usize] =
                    if ((((v >> (7 - n)) & 0x1) != 0) as i32 ^ bBlackWhite) != 0 {
                        0xff
                    } else {
                        0x00
                    };
            }
        }

        for x in (0..iWidth / 8).rev() {
            let v = row[x as usize];

            for n in 0..8 {
                row[(8 * x + n) as usize] =
                    if ((((v >> (7 - n)) & 0x1) != 0) as i32 ^ bBlackWhite) != 0 {
                        0xff
                    } else {
                        0x00
                    };
            }
        }
    }

    Ok(())
}

/// Original function: `Gray16_Gray8` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1472`.
pub unsafe fn gray16_gray8(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let width = (*pRect).Width as usize;
    let row_len = width * std::mem::size_of::<u16>();

    for y in 0..(*pRect).Height {
        let row = std::slice::from_raw_parts_mut(pb.add(cbStride as usize * y as usize), row_len);
        for j in 0..width {
            let src = 2 * j;
            let v = u16::from_ne_bytes([row[src], row[src + 1]]);
            row[j] = (v >> 8) as u8;
        }
    }

    Ok(())
}

/// Original function: `RGB48_RGB24` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1493`.
pub unsafe fn rgb48_rgb24(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * 3 * std::mem::size_of::<u16>();

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidth {
            let src = 6 * x;
            let r = u16::from_ne_bytes([row[src], row[src + 1]]);
            let g = u16::from_ne_bytes([row[src + 2], row[src + 3]]);
            let b = u16::from_ne_bytes([row[src + 4], row[src + 5]]);

            row[3 * x] = (r >> 8) as u8;
            row[3 * x + 1] = (g >> 8) as u8;
            row[3 * x + 2] = (b >> 8) as u8;
        }
    }

    Ok(())
}

/// Original function: `RGBA64_RGBA32` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1523`.
pub unsafe fn rgba64_rgba32(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * 4 * std::mem::size_of::<u16>();

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidth {
            let src = 8 * x;
            let r = u16::from_ne_bytes([row[src], row[src + 1]]);
            let g = u16::from_ne_bytes([row[src + 2], row[src + 3]]);
            let b = u16::from_ne_bytes([row[src + 4], row[src + 5]]);
            let a = u16::from_ne_bytes([row[src + 6], row[src + 7]]);

            row[4 * x] = (r >> 8) as u8;
            row[4 * x + 1] = (g >> 8) as u8;
            row[4 * x + 2] = (b >> 8) as u8;
            row[4 * x + 3] = (a >> 8) as u8;
        }
    }

    Ok(())
}

/// Original function: `Gray32Float_Gray8` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1555`.
pub unsafe fn gray32_float_gray8(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * std::mem::size_of::<f32>();

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidth {
            let src = 4 * x;
            let v = f32::from_ne_bytes([row[src], row[src + 1], row[src + 2], row[src + 3]]);

            row[x] = convert_float_to_u8(v);
        }
    }

    Ok(())
}

/// Original function: `RGB96Float_RGB24` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1581`.
pub unsafe fn rgb96_float_rgb24(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * 3 * std::mem::size_of::<f32>();

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidth {
            let src = 12 * x;
            let r = f32::from_ne_bytes([row[src], row[src + 1], row[src + 2], row[src + 3]]);
            let g = f32::from_ne_bytes([row[src + 4], row[src + 5], row[src + 6], row[src + 7]]);
            let b = f32::from_ne_bytes([row[src + 8], row[src + 9], row[src + 10], row[src + 11]]);

            row[3 * x] = convert_float_to_u8(r);
            row[3 * x + 1] = convert_float_to_u8(g);
            row[3 * x + 2] = convert_float_to_u8(b);
        }
    }

    Ok(())
}

/// Original function: `RGB128Float_RGB24` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1611`.
pub unsafe fn rgb128_float_rgb24(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * 4 * std::mem::size_of::<f32>();

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidth {
            let src = 16 * x;
            let r = f32::from_ne_bytes([row[src], row[src + 1], row[src + 2], row[src + 3]]);
            let g = f32::from_ne_bytes([row[src + 4], row[src + 5], row[src + 6], row[src + 7]]);
            let b = f32::from_ne_bytes([row[src + 8], row[src + 9], row[src + 10], row[src + 11]]);

            row[3 * x] = convert_float_to_u8(r);
            row[3 * x + 1] = convert_float_to_u8(g);
            row[3 * x + 2] = convert_float_to_u8(b);
        }
    }

    Ok(())
}

/// Original function: `RGBA128Float_RGBA32` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1641`.
pub unsafe fn rgba128_float_rgba32(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * 4 * std::mem::size_of::<f32>();

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidth {
            let src = 16 * x;
            let r = f32::from_ne_bytes([row[src], row[src + 1], row[src + 2], row[src + 3]]);
            let g = f32::from_ne_bytes([row[src + 4], row[src + 5], row[src + 6], row[src + 7]]);
            let b = f32::from_ne_bytes([row[src + 8], row[src + 9], row[src + 10], row[src + 11]]);
            let a =
                f32::from_ne_bytes([row[src + 12], row[src + 13], row[src + 14], row[src + 15]]);

            row[4 * x] = convert_float_to_u8(r);
            row[4 * x + 1] = convert_float_to_u8(g);
            row[4 * x + 2] = convert_float_to_u8(b);
            row[4 * x + 3] = convert_alpha_float_to_u8(a);
        }
    }

    Ok(())
}

/// Original function: `Gray16Fixed_Gray8` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1673`.
pub unsafe fn gray16_fixed_gray8(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * std::mem::size_of::<i16>();
    let fltCvtFactor: f32 = 1.0 / ((1 << 13) as f32);

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidth {
            let src = 2 * x;
            let value = i16::from_ne_bytes([row[src], row[src + 1]]);
            row[x] = convert_float_to_u8((value as f32) * fltCvtFactor);
        }
    }

    Ok(())
}

/// Original function: `Gray32Fixed_Gray8` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1698`.
pub unsafe fn gray32_fixed_gray8(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * std::mem::size_of::<i32>();
    let fltCvtFactor: f32 = 1.0 / ((1 << 24) as f32);

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidth {
            let src = 4 * x;
            let value = i32::from_ne_bytes([row[src], row[src + 1], row[src + 2], row[src + 3]]);
            row[x] = convert_float_to_u8((value as f32) * fltCvtFactor);
        }
    }

    Ok(())
}

/// Original function: `RGB48Fixed_RGB24` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1723`.
pub unsafe fn rgb48_fixed_rgb24(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * 3 * std::mem::size_of::<i16>();
    let fltCvtFactor: f32 = 1.0 / ((1 << 13) as f32);

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidth {
            let src = 6 * x;
            let r = i16::from_ne_bytes([row[src], row[src + 1]]);
            let g = i16::from_ne_bytes([row[src + 2], row[src + 3]]);
            let b = i16::from_ne_bytes([row[src + 4], row[src + 5]]);

            row[3 * x] = convert_float_to_u8((r as f32) * fltCvtFactor);
            row[3 * x + 1] = convert_float_to_u8((g as f32) * fltCvtFactor);
            row[3 * x + 2] = convert_float_to_u8((b as f32) * fltCvtFactor);
        }
    }

    Ok(())
}

/// Original function: `RGB64Fixed_RGB24` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1749`.
pub unsafe fn rgb64_fixed_rgb24(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * 4 * std::mem::size_of::<i16>();
    let fltCvtFactor: f32 = 1.0 / ((1 << 13) as f32);

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidth {
            let src = 8 * x;
            let r = i16::from_ne_bytes([row[src], row[src + 1]]);
            let g = i16::from_ne_bytes([row[src + 2], row[src + 3]]);
            let b = i16::from_ne_bytes([row[src + 4], row[src + 5]]);

            row[3 * x] = convert_float_to_u8((r as f32) * fltCvtFactor);
            row[3 * x + 1] = convert_float_to_u8((g as f32) * fltCvtFactor);
            row[3 * x + 2] = convert_float_to_u8((b as f32) * fltCvtFactor);
        }
    }

    Ok(())
}

/// Original function: `RGB96Fixed_RGB24` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1775`.
pub unsafe fn rgb96_fixed_rgb24(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * 3 * std::mem::size_of::<i32>();
    let fltCvtFactor: f32 = 1.0 / ((1 << 24) as f32);

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidth {
            let src = 12 * x;
            let r = i32::from_ne_bytes([row[src], row[src + 1], row[src + 2], row[src + 3]]);
            let g = i32::from_ne_bytes([row[src + 4], row[src + 5], row[src + 6], row[src + 7]]);
            let b = i32::from_ne_bytes([row[src + 8], row[src + 9], row[src + 10], row[src + 11]]);

            row[3 * x] = convert_float_to_u8((r as f32) * fltCvtFactor);
            row[3 * x + 1] = convert_float_to_u8((g as f32) * fltCvtFactor);
            row[3 * x + 2] = convert_float_to_u8((b as f32) * fltCvtFactor);
        }
    }

    Ok(())
}

/// Original function: `RGB128Fixed_RGB24` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1801`.
pub unsafe fn rgb128_fixed_rgb24(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * 4 * std::mem::size_of::<i32>();
    let fltCvtFactor: f32 = 1.0 / ((1 << 24) as f32);

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidth {
            let src = 16 * x;
            let r = i32::from_ne_bytes([row[src], row[src + 1], row[src + 2], row[src + 3]]);
            let g = i32::from_ne_bytes([row[src + 4], row[src + 5], row[src + 6], row[src + 7]]);
            let b = i32::from_ne_bytes([row[src + 8], row[src + 9], row[src + 10], row[src + 11]]);

            row[3 * x] = convert_float_to_u8((r as f32) * fltCvtFactor);
            row[3 * x + 1] = convert_float_to_u8((g as f32) * fltCvtFactor);
            row[3 * x + 2] = convert_float_to_u8((b as f32) * fltCvtFactor);
        }
    }

    Ok(())
}

/// Original function: `RGBA64Fixed_RGBA32` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1827`.
pub unsafe fn rgba64_fixed_rgba32(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * 4 * std::mem::size_of::<i16>();
    let fltCvtFactor: f32 = 1.0 / ((1 << 13) as f32);

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidth {
            let src = 8 * x;
            let r = i16::from_ne_bytes([row[src], row[src + 1]]);
            let g = i16::from_ne_bytes([row[src + 2], row[src + 3]]);
            let b = i16::from_ne_bytes([row[src + 4], row[src + 5]]);
            let a = i16::from_ne_bytes([row[src + 6], row[src + 7]]);

            row[4 * x] = convert_float_to_u8((r as f32) * fltCvtFactor);
            row[4 * x + 1] = convert_float_to_u8((g as f32) * fltCvtFactor);
            row[4 * x + 2] = convert_float_to_u8((b as f32) * fltCvtFactor);
            row[4 * x + 3] = convert_alpha_float_to_u8((a as f32) * fltCvtFactor);
        }
    }

    Ok(())
}

/// Original function: `RGBA128Fixed_RGBA32` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1854`.
pub unsafe fn rgba128_fixed_rgba32(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * 4 * std::mem::size_of::<i32>();
    let fltCvtFactor: f32 = 1.0 / ((1 << 24) as f32);

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidth {
            let src = 16 * x;
            let r = i32::from_ne_bytes([row[src], row[src + 1], row[src + 2], row[src + 3]]);
            let g = i32::from_ne_bytes([row[src + 4], row[src + 5], row[src + 6], row[src + 7]]);
            let b = i32::from_ne_bytes([row[src + 8], row[src + 9], row[src + 10], row[src + 11]]);
            let a =
                i32::from_ne_bytes([row[src + 12], row[src + 13], row[src + 14], row[src + 15]]);

            row[4 * x] = convert_float_to_u8((r as f32) * fltCvtFactor);
            row[4 * x + 1] = convert_float_to_u8((g as f32) * fltCvtFactor);
            row[4 * x + 2] = convert_float_to_u8((b as f32) * fltCvtFactor);
            row[4 * x + 3] = convert_alpha_float_to_u8((a as f32) * fltCvtFactor);
        }
    }

    Ok(())
}

/// Original function: `Gray16Half_Gray8` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1881`.
pub unsafe fn gray16_half_gray8(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * std::mem::size_of::<u16>();

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidth {
            let src = 2 * x;
            let half = u16::from_ne_bytes([row[src], row[src + 1]]);
            let v = convert_half_to_float(half);

            row[x] = convert_float_to_u8(f32::from_bits(v));
        }
    }

    Ok(())
}

/// Original function: `RGB48Half_RGB24` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1907`.
pub unsafe fn rgb48_half_rgb24(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * 3 * std::mem::size_of::<u16>();

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidth {
            let src = 6 * x;
            let r = convert_half_to_float(u16::from_ne_bytes([row[src], row[src + 1]]));
            let g = convert_half_to_float(u16::from_ne_bytes([row[src + 2], row[src + 3]]));
            let b = convert_half_to_float(u16::from_ne_bytes([row[src + 4], row[src + 5]]));

            row[3 * x] = convert_float_to_u8(f32::from_bits(r));
            row[3 * x + 1] = convert_float_to_u8(f32::from_bits(g));
            row[3 * x + 2] = convert_float_to_u8(f32::from_bits(b));
        }
    }

    Ok(())
}

/// Original function: `RGB64Half_RGB24` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1936`.
pub unsafe fn rgb64_half_rgb24(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * 4 * std::mem::size_of::<u16>();

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidth {
            let src = 8 * x;
            let r = convert_half_to_float(u16::from_ne_bytes([row[src], row[src + 1]]));
            let g = convert_half_to_float(u16::from_ne_bytes([row[src + 2], row[src + 3]]));
            let b = convert_half_to_float(u16::from_ne_bytes([row[src + 4], row[src + 5]]));

            row[3 * x] = convert_float_to_u8(f32::from_bits(r));
            row[3 * x + 1] = convert_float_to_u8(f32::from_bits(g));
            row[3 * x + 2] = convert_float_to_u8(f32::from_bits(b));
        }
    }

    Ok(())
}

/// Original function: `RGBA64Half_RGBA32` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1965`.
pub unsafe fn rgba64_half_rgba32(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * 4 * std::mem::size_of::<u16>();

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidth {
            let src = 8 * x;
            let r = convert_half_to_float(u16::from_ne_bytes([row[src], row[src + 1]]));
            let g = convert_half_to_float(u16::from_ne_bytes([row[src + 2], row[src + 3]]));
            let b = convert_half_to_float(u16::from_ne_bytes([row[src + 4], row[src + 5]]));
            let a = convert_half_to_float(u16::from_ne_bytes([row[src + 6], row[src + 7]]));

            row[4 * x] = convert_float_to_u8(f32::from_bits(r));
            row[4 * x + 1] = convert_float_to_u8(f32::from_bits(g));
            row[4 * x + 2] = convert_float_to_u8(f32::from_bits(b));
            row[4 * x + 3] = convert_alpha_float_to_u8(f32::from_bits(a));
        }
    }

    Ok(())
}

/// Original function: `RGB101010_RGB24` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:1996`.
pub unsafe fn rgb101010_rgb24(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let iHeight = (*pRect).Height;
    let iWidth = (*pRect).Width as usize;
    let row_len = iWidth * std::mem::size_of::<u32>();

    for y in 0..iHeight {
        let row = std::slice::from_raw_parts_mut(pb.add((cbStride as i32 * y) as usize), row_len);

        for x in 0..iWidth {
            let src = 4 * x;
            let v = u32::from_ne_bytes([row[src], row[src + 1], row[src + 2], row[src + 3]]);
            let r = (v >> 20) & 0x3ff;
            let g = (v >> 10) & 0x3ff;
            let b = v & 0x3ff;

            row[3 * x] = (r >> 2) as u8;
            row[3 * x + 1] = (g >> 2) as u8;
            row[3 * x + 2] = (b >> 2) as u8;
        }
    }

    Ok(())
}

/// Original function: `RGBE_RGB24` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:2027`.
pub unsafe fn rgbe_rgb24(
    _pFC: &mut tagPKFormatConverter,
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let row_len = ((*pRect).Width * 4) as usize;

    for y in 0..(*pRect).Height {
        let row = std::slice::from_raw_parts_mut(pb.add(cbStride as usize * y as usize), row_len);
        for j in 0..(*pRect).Width {
            let src = (4 * j) as usize;
            let dst = (3 * j) as usize;
            let rawExp = row[src + 3];

            if rawExp == 0 {
                row[dst] = 0;
                row[dst + 1] = 0;
                row[dst + 2] = 0;
            } else {
                let adjExp = rawExp as i32 - 128 - 8;
                let mut fltExp: f32;

                if adjExp > -32 && adjExp < 32 {
                    fltExp = ((1_u32) << adjExp.abs()) as f32;
                    if adjExp < 0 {
                        fltExp = 1.0 / fltExp;
                    }
                } else {
                    fltExp = 2.0_f32.powi(adjExp);
                }

                row[dst] = convert_float_to_u8((row[src] as f32) * fltExp);
                row[dst + 1] = convert_float_to_u8((row[src + 1] as f32) * fltExp);
                row[dst + 2] = convert_float_to_u8((row[src + 2] as f32) * fltExp);
            }
        }
    }

    Ok(())
}

/// Original function: `PKFormatConverter_Initialize` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:2190`.
pub unsafe fn pk_format_converter_initialize(
    pFC: &mut tagPKFormatConverter,
    pID: *mut tagPKImageDecode,
    pExt: *const u8,
    enPF: PKPixelFormatGUID,
) -> Result<(), crate::WmpError> {
    let mut enPFFrom = GUID_PKPixelFormatDontCare;

    let Some(decoder) = pID.as_ref() else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let get_pf = decoder.GetPixelFormat;

    match get_pf {
        Some(get_pixel_format) => get_pixel_format(&mut *pID, Some(&mut enPFFrom)),
        None => Err(crate::WmpError::AbstractMethod),
    }?;
    pk_format_converter_initialize_convert(&mut *pFC, enPFFrom, pExt, enPF)?;

    pFC.pDecoder = Some(NonNull::new_unchecked(pID));

    Ok(())
}

/// Original function: `PKFormatConverter_InitializeConvert` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:2207`.
pub unsafe fn pk_format_converter_initialize_convert(
    pFC: &mut tagPKFormatConverter,
    enPFFrom: PKPixelFormatGUID,
    pExt: *const u8,
    mut enPFTo: PKPixelFormatGUID,
) -> Result<(), crate::WmpError> {
    let err: Result<(), crate::WmpError> = Ok(());
    let fc = pFC;

    fc.enPixelFormat = enPFTo;

    let ext = if pExt.is_null() {
        Vec::new()
    } else {
        let mut ext = Vec::new();
        let mut ext_len = 0usize;
        while *pExt.add(ext_len) != 0 {
            ext.push(*pExt.add(ext_len));
            ext_len += 1;
        }
        ext
    };

    if !ext.is_empty() {
        const BMP_EXT: &[u8] = b".bmp";
        const TIF_EXT: &[u8] = b".tif";
        const TIFF_EXT: &[u8] = b".tiff";

        if enPFTo == GUID_PKPixelFormat24bppRGB
            && ext.len() <= BMP_EXT.len()
            && ext.eq_ignore_ascii_case(&BMP_EXT[..ext.len()])
        {
            enPFTo = GUID_PKPixelFormat24bppBGR;
        }
        if (ext.len() <= TIF_EXT.len() && ext.eq_ignore_ascii_case(&TIF_EXT[..ext.len()]))
            || (ext.len() <= TIFF_EXT.len() && ext.eq_ignore_ascii_case(&TIFF_EXT[..ext.len()]))
        {
            if enPFTo == GUID_PKPixelFormat32bppBGRA {
                enPFTo = GUID_PKPixelFormat32bppRGBA;
            }
            if enPFTo == GUID_PKPixelFormat32bppPBGRA {
                enPFTo = GUID_PKPixelFormat32bppPRGBA;
            }
        }
    }

    if enPFFrom != enPFTo {
        for pci in &S_PC_INFO {
            if enPFFrom == pci.pGUIDPixFmtFrom && enPFTo == pci.pGUIDPixFmtTo {
                fc.Convert = Some(pci.Convert);
                return err;
            }
        }

        for pci in &S_PC_INFO2 {
            if enPFFrom == pci.pGUIDPixFmtFrom && enPFTo == pci.pGUIDPixFmtTo {
                return err;
            }
        }
        return Err(crate::WmpError::UnsupportedFormat);
    }

    err
}

/// Original function: `PKFormatConverter_EnumConversions` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:2259`.
pub unsafe fn pk_format_converter_enum_conversions(
    pguidSourcePF: *const PKPixelFormatGUID,
    iIndex: u32,
    ppguidTargetPF: *mut *const PKPixelFormatGUID,
) -> Result<(), crate::WmpError> {
    let mut iCurrIdx: u32 = 0;
    let mut errResult = Err(crate::WmpError::IndexNotFound);
    let (Some(source_pf), Some(target_pf)) = (pguidSourcePF.as_ref(), ppguidTargetPF.as_mut())
    else {
        return Err(crate::WmpError::InvalidParameter);
    };

    *target_pf = &GUID_PKPixelFormatDontCare;
    for pci in &S_PC_INFO {
        if pci.pGUIDPixFmtFrom == *source_pf {
            if iCurrIdx == iIndex {
                errResult = Ok(());
                *target_pf = std::ptr::addr_of!(pci.pGUIDPixFmtTo);
                break;
            }
            iCurrIdx += 1;
        }
    }

    errResult
}

/// Original function: `PKFormatConverter_GetPixelFormat` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:2286`.
pub unsafe fn pk_format_converter_get_pixel_format(
    pFC: &mut tagPKFormatConverter,
    pPF: Option<&mut PKPixelFormatGUID>,
) -> Result<(), crate::WmpError> {
    let Some(pixel_format) = pPF else {
        return Err(crate::WmpError::InvalidParameter);
    };
    *pixel_format = pFC.enPixelFormat;

    Ok(())
}

/// Original function: `PKFormatConverter_GetSourcePixelFormat` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:2293`.
pub unsafe fn pk_format_converter_get_source_pixel_format(
    pFC: &mut tagPKFormatConverter,
    pPF: Option<&mut PKPixelFormatGUID>,
) -> Result<(), crate::WmpError> {
    let Some(pixel_format) = pPF else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(decoder) = pFC.pDecoder else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let decoder_ptr = decoder.as_ptr();
    let get_pixel_format_fn = (*decoder_ptr).GetPixelFormat;

    match get_pixel_format_fn {
        Some(get_pixel_format) => get_pixel_format(&mut *decoder_ptr, Some(pixel_format)),
        None => Err(crate::WmpError::AbstractMethod),
    }
}

/// Original function: `PKFormatConverter_GetSize` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:2298`.
pub unsafe fn pk_format_converter_get_size(
    pFC: &mut tagPKFormatConverter,
    piWidth: Option<&mut i32>,
    piHeight: Option<&mut i32>,
) -> Result<(), crate::WmpError> {
    let (Some(width), Some(height)) = (piWidth, piHeight) else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(decoder) = pFC.pDecoder else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let decoder_ptr = decoder.as_ptr();
    let get_size_fn = (*decoder_ptr).GetSize;

    match get_size_fn {
        Some(get_size) => get_size(&mut *decoder_ptr, Some(width), Some(height)),
        None => Err(crate::WmpError::AbstractMethod),
    }
}

/// Original function: `PKFormatConverter_GetResolution` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:2303`.
pub unsafe fn pk_format_converter_get_resolution(
    pFC: &mut tagPKFormatConverter,
    pfrX: Option<&mut f32>,
    pfrY: Option<&mut f32>,
) -> Result<(), crate::WmpError> {
    let (Some(res_x), Some(res_y)) = (pfrX, pfrY) else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(decoder) = pFC.pDecoder else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let decoder_ptr = decoder.as_ptr();
    let get_resolution_fn = (*decoder_ptr).GetResolution;

    match get_resolution_fn {
        Some(get_resolution) => get_resolution(&mut *decoder_ptr, Some(res_x), Some(res_y)),
        None => Err(crate::WmpError::AbstractMethod),
    }
}

fn format_row_bytes(pixel_info: &tagPKPixelInfo, width: i32) -> Option<usize> {
    let width = u32::try_from(width).ok()?;
    let shift = u32::from(
        pixel_info.pGUIDPixFmt == Some(GUID_PKPixelFormat12bppYUV420)
            || pixel_info.pGUIDPixFmt == Some(GUID_PKPixelFormat16bppYUV422),
    );
    let row_bytes = if BitDepth::One == pixel_info.bdBitDepth {
        pixel_info.cbitUnit.checked_mul(width)?.checked_add(7)? >> 3
    } else {
        ((pixel_info.cbitUnit.checked_add(7)?) >> 3).checked_mul(width)?
    } >> shift;

    usize::try_from(row_bytes).ok()
}

fn checked_row_offset(cb_stride: u32, y: i32) -> Result<usize, crate::WmpError> {
    let y = usize::try_from(y).map_err(|_| crate::WmpError::InvalidParameter)?;
    (cb_stride as usize)
        .checked_mul(y)
        .ok_or(crate::WmpError::BufferOverflow)
}

unsafe fn validate_direct_raw_converter_args<'a>(
    pRect: *const tagPKRect,
    pb: *mut u8,
    cbStride: u32,
    bytes_per_width_unit: usize,
) -> Result<(&'a tagPKRect, NonNull<u8>, usize), crate::WmpError> {
    let Some(rect) = pRect.as_ref() else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let Some(pb) = NonNull::new(pb) else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let width = usize::try_from(rect.Width).map_err(|_| crate::WmpError::InvalidParameter)?;
    let height = usize::try_from(rect.Height).map_err(|_| crate::WmpError::InvalidParameter)?;
    if width == 0 || height == 0 {
        return Err(crate::WmpError::InvalidParameter);
    }

    let row_len = width
        .checked_mul(bytes_per_width_unit)
        .ok_or(crate::WmpError::BufferOverflow)?;
    if (cbStride as usize) < row_len {
        return Err(crate::WmpError::InvalidParameter);
    }
    let last_row = checked_row_offset(cbStride, rect.Height - 1)?;
    last_row
        .checked_add(row_len)
        .ok_or(crate::WmpError::BufferOverflow)?;

    Ok((rect, pb, row_len))
}

unsafe fn validate_converter_copy_args(
    pFC: &mut tagPKFormatConverter,
    decoder: *mut tagPKImageDecode,
    rect: &tagPKRect,
    pb_len: usize,
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    if rect.Width <= 0 || rect.Height <= 0 {
        return Err(crate::WmpError::InvalidParameter);
    }

    let mut min_stride = 1usize;
    if let Some(get_source_pixel_format) = (*decoder).GetPixelFormat {
        let mut source_format = GUID_PKPixelFormatDontCare;
        get_source_pixel_format(&mut *decoder, Some(&mut source_format))?;
        if !is_equal_guid(&source_format, &GUID_PKPixelFormatDontCare) {
            let mut source_info = tagPKPixelInfo {
                pGUIDPixFmt: Some(source_format),
                ..Default::default()
            };
            pixel_format_lookup(&mut source_info, LOOKUP_FORWARD)?;
            min_stride = min_stride.max(
                format_row_bytes(&source_info, rect.Width)
                    .ok_or(crate::WmpError::BufferOverflow)?,
            );
        }
    }

    if !is_equal_guid(&pFC.enPixelFormat, &GUID_PKPixelFormatDontCare) {
        let mut target_info = tagPKPixelInfo {
            pGUIDPixFmt: Some(pFC.enPixelFormat),
            ..Default::default()
        };
        pixel_format_lookup(&mut target_info, LOOKUP_FORWARD)?;
        min_stride = min_stride.max(
            format_row_bytes(&target_info, rect.Width).ok_or(crate::WmpError::BufferOverflow)?,
        );
    }
    let stride = cbStride as usize;
    if stride < min_stride {
        return Err(crate::WmpError::InvalidParameter);
    }

    let height = usize::try_from(rect.Height).map_err(|_| crate::WmpError::InvalidParameter)?;
    let min_len = stride
        .checked_mul(height)
        .ok_or(crate::WmpError::BufferOverflow)?;
    if pb_len < min_len {
        return Err(crate::WmpError::BufferOverflow);
    }

    Ok(())
}

/// Original function: `PKFormatConverter_Copy` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:2308`.
pub unsafe fn pk_format_converter_copy(
    pFC: &mut tagPKFormatConverter,
    pRect: Option<&tagPKRect>,
    pb: &mut [u8],
    cbStride: u32,
) -> Result<(), crate::WmpError> {
    let Some(rect) = pRect else {
        return Err(crate::WmpError::InvalidParameter);
    };

    let Some(decoder) = pFC.pDecoder else {
        return Err(crate::WmpError::InvalidParameter);
    };
    let decoder_ptr = decoder.as_ptr();
    let copy_fn = (*decoder_ptr).Copy;
    let convert_fn = pFC.Convert;

    validate_converter_copy_args(pFC, decoder_ptr, rect, pb.len(), cbStride)?;

    match copy_fn {
        Some(copy) => copy(&mut *decoder_ptr, Some(rect), pb, cbStride),
        None => Err(crate::WmpError::AbstractMethod),
    }?;
    match convert_fn {
        Some(convert) => convert(&mut *pFC, rect, pb.as_mut_ptr(), cbStride),
        None => Err(crate::WmpError::AbstractMethod),
    }
}

/// Original function: `PKFormatConverter_Convert` at `original/jxrlib/jxrgluelib/JXRGluePFC.c:2319`.
pub unsafe fn pk_format_converter_convert(
    _pFC: &mut tagPKFormatConverter,
    _pRect: *const tagPKRect,
    _pb: *mut u8,
    _cbStride: u32,
) -> Result<(), crate::WmpError> {
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::jxrgluelib::jxrglue::{
        GUID_PKPixelFormat128bppRGBAFloat, GUID_PKPixelFormat16bppRGB555,
        GUID_PKPixelFormat24bppBGR, GUID_PKPixelFormat24bppRGB, GUID_PKPixelFormat32bppBGR,
        GUID_PKPixelFormat32bppBGRA, GUID_PKPixelFormat32bppRGBA, GUID_PKPixelFormat48bppRGB,
        GUID_PKPixelFormatDontCare,
    };
    use std::sync::atomic::{AtomicUsize, Ordering};

    static FORMAT_COPY_CALLS: AtomicUsize = AtomicUsize::new(0);
    static FORMAT_CONVERT_CALLS: AtomicUsize = AtomicUsize::new(0);

    #[test]
    fn half_to_float_returns_original_float_bit_patterns() {
        unsafe {
            assert_eq!(convert_half_to_float(0x0000), 0x0000_0000);
            assert_eq!(convert_half_to_float(0x8000), 0x8000_0000);
            assert_eq!(convert_half_to_float(0x0001), 0x0000_0000);
            assert_eq!(convert_half_to_float(0x3c00), 0x3f80_0000);
            assert_eq!(convert_half_to_float(0xbc00), 0xbf80_0000);
            assert_eq!(convert_half_to_float(0x7c00), 0x7f80_0000);
            assert_eq!(convert_half_to_float(0x7e00), 0x7fc0_0000);
        }
    }

    #[test]
    fn float_to_half_matches_original_threshold_and_bit_rules() {
        unsafe {
            assert_eq!(convert_float_to_half(1.0), 0x3c00);
            assert_eq!(convert_float_to_half(-2.0), 0xc000);
            assert_eq!(convert_float_to_half(0.0), 0x0000);
            assert_eq!(convert_float_to_half(-0.0), 0x8000);
            assert_eq!(convert_float_to_half(HLF_MAX * 2.0), HLF_MAX_BITS);
            assert_eq!(convert_float_to_half(-HLF_MAX * 2.0), HLF_MAX_BITS_NEG);
            assert_eq!(
                convert_float_to_half(f32::from_bits(0x7fc0_0000)),
                HLF_QNaN_BITZS
            );
        }
    }

    #[test]
    fn float_to_u8_uses_srgb_curve_and_alpha_uses_linear_scale() {
        unsafe {
            assert_eq!(convert_float_to_u8(-1.0), 0);
            assert_eq!(convert_float_to_u8(0.0), 0);
            assert_eq!(convert_float_to_u8(0.5), 188);
            assert_eq!(convert_float_to_u8(1.0), 255);
            assert_eq!(convert_float_to_u8(f32::NAN), 255);

            assert_eq!(convert_alpha_float_to_u8(-1.0), 0);
            assert_eq!(convert_alpha_float_to_u8(0.0), 0);
            assert_eq!(convert_alpha_float_to_u8(0.5), 128);
            assert_eq!(convert_alpha_float_to_u8(1.0), 255);
            assert_eq!(convert_alpha_float_to_u8(f32::NAN), 255);
        }
    }

    #[test]
    fn rgb24_bgr24_and_wrapper_swap_channels_per_row_with_stride() {
        let rect = tagPKRect {
            X: 0,
            Y: 0,
            Width: 2,
            Height: 2,
        };
        let mut pixels = [1, 2, 3, 4, 5, 6, 99, 99, 10, 20, 30, 40, 50, 60, 88, 88];

        unsafe {
            assert_eq!(
                rgb24_bgr24(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    pixels.as_mut_ptr(),
                    8
                ),
                Ok(())
            );
            assert_eq!(
                pixels,
                [3, 2, 1, 6, 5, 4, 99, 99, 30, 20, 10, 60, 50, 40, 88, 88]
            );
            assert_eq!(
                bgr24_rgb24(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    pixels.as_mut_ptr(),
                    8
                ),
                Ok(())
            );
            assert_eq!(
                pixels,
                [1, 2, 3, 4, 5, 6, 99, 99, 10, 20, 30, 40, 50, 60, 88, 88]
            );
        }
    }

    #[test]
    fn checked_row_offset_accepts_strides_larger_than_i32_max() {
        assert_eq!(
            checked_row_offset(i32::MAX as u32 + 1, 1),
            Ok(2_147_483_648)
        );
    }

    #[test]
    fn direct_rgb_gray_converters_reject_null_and_nonpositive_inputs() {
        let rect = tagPKRect {
            X: 0,
            Y: 0,
            Width: 1,
            Height: 1,
        };
        let negative_width = tagPKRect { Width: -1, ..rect };
        let negative_height = tagPKRect { Height: -1, ..rect };
        let zero_width = tagPKRect { Width: 0, ..rect };
        let mut pixels = [0_u8; 3];

        unsafe {
            assert_eq!(
                rgb24_gray8(
                    &mut tagPKFormatConverter::default(),
                    std::ptr::null(),
                    pixels.as_mut_ptr(),
                    3,
                ),
                Err(crate::WmpError::InvalidParameter)
            );
            assert_eq!(
                gray8_rgb24(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    std::ptr::null_mut(),
                    3,
                ),
                Err(crate::WmpError::InvalidParameter)
            );
            assert_eq!(
                rgb24_gray8(
                    &mut tagPKFormatConverter::default(),
                    &negative_width,
                    pixels.as_mut_ptr(),
                    3,
                ),
                Err(crate::WmpError::InvalidParameter)
            );
            assert_eq!(
                gray8_rgb24(
                    &mut tagPKFormatConverter::default(),
                    &negative_height,
                    pixels.as_mut_ptr(),
                    3,
                ),
                Err(crate::WmpError::InvalidParameter)
            );
            assert_eq!(
                rgb24_gray8(
                    &mut tagPKFormatConverter::default(),
                    &zero_width,
                    pixels.as_mut_ptr(),
                    3,
                ),
                Err(crate::WmpError::InvalidParameter)
            );
            assert_eq!(
                gray8_rgb24(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    pixels.as_mut_ptr(),
                    2,
                ),
                Err(crate::WmpError::InvalidParameter)
            );
        }
    }

    #[test]
    fn rgb24_bgr32_and_bgr32_rgb24_expand_and_contract_in_place() {
        let rect = tagPKRect {
            X: 0,
            Y: 0,
            Width: 2,
            Height: 1,
        };
        let mut expand = [1, 2, 3, 4, 5, 6, 77, 77];
        let mut contract = [3, 2, 1, 222, 6, 5, 4, 111];

        unsafe {
            assert_eq!(
                rgb24_bgr32(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    expand.as_mut_ptr(),
                    8
                ),
                Ok(())
            );
            assert_eq!(expand, [3, 2, 1, 0, 6, 5, 4, 0]);

            assert_eq!(
                bgr32_rgb24(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    contract.as_mut_ptr(),
                    8
                ),
                Ok(())
            );
            assert_eq!(contract, [1, 2, 3, 4, 5, 6, 4, 111]);
        }
    }

    #[test]
    fn rgb24_bgr32_width_three_expands_right_to_left_with_zero_fourth_byte() {
        let rect = tagPKRect {
            X: 0,
            Y: 0,
            Width: 3,
            Height: 1,
        };
        let mut pixels = [
            11_u8, 22, 33, 44, 55, 66, 77, 88, 99, 0xaa, 0xbb, 0xcc, 0xdd,
        ];

        unsafe {
            assert_eq!(
                rgb24_bgr32(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    pixels.as_mut_ptr(),
                    13,
                ),
                Ok(())
            );
        }

        assert_eq!(pixels, [33, 22, 11, 0, 66, 55, 44, 0, 99, 88, 77, 0, 0xdd]);
    }

    #[test]
    fn rgb_and_bgr_to_gray8_match_original_integer_formula() {
        let rect = tagPKRect {
            X: 0,
            Y: 0,
            Width: 2,
            Height: 1,
        };
        let mut rgb = [100, 80, 40, 4, 6, 8, 55, 55];
        let mut bgr = [40, 80, 100, 8, 6, 4, 55, 55];

        unsafe {
            assert_eq!(
                rgb24_gray8(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    rgb.as_mut_ptr(),
                    8
                ),
                Ok(())
            );
            assert_eq!(rgb, [86, 21, 40, 4, 6, 8, 55, 55]);

            assert_eq!(
                bgr24_gray8(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    bgr.as_mut_ptr(),
                    8
                ),
                Ok(())
            );
            assert_eq!(bgr, [86, 21, 40, 4, 6, 8, 55, 55]);
        }
    }

    #[test]
    fn gray8_rgb24_and_bgr24_expand_from_end_to_preserve_source_values() {
        let rect = tagPKRect {
            X: 0,
            Y: 0,
            Width: 3,
            Height: 1,
        };
        let mut rgb = [7, 8, 9, 0, 0, 0, 0, 0, 0];
        let mut bgr = [10, 11, 12, 0, 0, 0, 0, 0, 0];

        unsafe {
            assert_eq!(
                gray8_rgb24(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    rgb.as_mut_ptr(),
                    9
                ),
                Ok(())
            );
            assert_eq!(rgb, [7, 7, 7, 8, 8, 8, 9, 9, 9]);

            assert_eq!(
                gray8_bgr24(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    bgr.as_mut_ptr(),
                    9
                ),
                Ok(())
            );
            assert_eq!(bgr, [10, 10, 10, 11, 11, 11, 12, 12, 12]);
        }
    }

    #[test]
    fn rgb48_bgr48_and_gray16_call_copy_then_apply_original_word_rules() {
        let rect = tagPKRect {
            X: 0,
            Y: 0,
            Width: 6,
            Height: 1,
        };
        let mut decoder = tagPKImageDecode {
            Initialize: None,
            GetPixelFormat: None,
            GetSize: None,
            GetResolution: None,
            GetColorContext: None,
            GetDescriptiveMetadata: None,
            GetRawStream: None,
            Copy: Some(|_pID, pRect, pb, _cbStride| {
                let Some(rect) = pRect else {
                    return Err(crate::WmpError::InvalidParameter);
                };
                let values: [u16; 6] = [1, 2, 3, 4, 5, 6];
                let ps = pb.as_mut_ptr().cast::<u16>();
                let mut i = 0;
                while i < rect.Width {
                    unsafe {
                        *ps.add(i as usize) = values[i as usize];
                    }
                    i += 1;
                }
                Ok(())
            }),
            GetFrameCount: None,
            SelectFrame: None,
            pStream: None,
            pStreamMemory: None,
            offStart: 0,
            guidPixFormat: GUID_PKPixelFormatDontCare,
            uWidth: 0,
            uHeight: 0,
            idxCurrentLine: 0,
            fResX: 0.0,
            fResY: 0.0,
            cFrame: 0,
            WMP: tagPKImageDecodeWMP::default(),
        };
        let mut converter = tagPKFormatConverter {
            Initialize: None,
            InitializeConvert: None,
            GetPixelFormat: None,
            GetSourcePixelFormat: None,
            GetSize: None,
            GetResolution: None,
            Copy: None,
            Convert: Some(|_pFC, _pRect, _pb, _cbStride| Ok(())),
            pDecoder: Some(NonNull::from(&mut decoder)),
            enPixelFormat: GUID_PKPixelFormatDontCare,
        };
        let mut rgb_words = [0_u16; 7];
        let mut bgr_words = [0_u16; 7];

        unsafe {
            assert_eq!(
                rgb48_bgr48(&mut converter, &rect, rgb_words.as_mut_ptr().cast(), 14),
                Ok(())
            );
            assert_eq!(rgb_words, [3, 2, 1, 6, 5, 4, 0]);

            assert_eq!(
                bgr48_rgb48(&mut converter, &rect, bgr_words.as_mut_ptr().cast(), 14),
                Ok(())
            );
            assert_eq!(bgr_words, [3, 2, 1, 6, 5, 4, 0]);
        }

        unsafe {
            (*converter
                .pDecoder
                .expect("converter has a decoder")
                .as_ptr())
            .Copy = Some(|_pID, pRect, pb, _cbStride| {
                let Some(rect) = pRect else {
                    return Err(crate::WmpError::InvalidParameter);
                };
                let values: [u16; 6] = [400, 800, 1600, 1000, 2000, 3000];
                let ps = pb.as_mut_ptr().cast::<u16>();
                let mut i = 0;
                while i < rect.Width {
                    *ps.add(i as usize) = values[i as usize];
                    i += 1;
                }
                Ok(())
            });
        }
        let mut gray_words = [0_u16; 7];

        unsafe {
            assert_eq!(
                rgb48_gray16(&mut converter, &rect, gray_words.as_mut_ptr().cast(), 14),
                Ok(())
            );
            assert_eq!(gray_words, [716, 1641, 1600, 1000, 2000, 3000, 0]);
        }
    }

    #[test]
    fn rgb48_bgr48_accepts_unaligned_byte_buffer() {
        let rect = tagPKRect {
            X: 0,
            Y: 0,
            Width: 6,
            Height: 1,
        };
        let mut decoder = tagPKImageDecode {
            Copy: Some(|_pID, _pRect, pb, _cbStride| {
                for (dst, value) in pb.chunks_exact_mut(2).zip([1_u16, 2, 3, 4, 5, 6]) {
                    dst.copy_from_slice(&value.to_ne_bytes());
                }
                Ok(())
            }),
            ..Default::default()
        };
        let mut converter = tagPKFormatConverter {
            Convert: Some(|_pFC, _pRect, _pb, _cbStride| Ok(())),
            pDecoder: Some(NonNull::from(&mut decoder)),
            enPixelFormat: GUID_PKPixelFormatDontCare,
            ..Default::default()
        };
        let mut storage = [0_u8; 13];
        let unaligned = storage[1..].as_mut_ptr();

        unsafe {
            assert_eq!(rgb48_bgr48(&mut converter, &rect, unaligned, 12), Ok(()));
        }

        let values: Vec<u16> = storage[1..]
            .chunks_exact(2)
            .map(|bytes| u16::from_ne_bytes([bytes[0], bytes[1]]))
            .collect();
        assert_eq!(values, vec![3, 2, 1, 6, 5, 4]);
    }

    #[test]
    fn pk_format_converter_copy_validates_rect_stride_and_buffer_before_callbacks() {
        FORMAT_COPY_CALLS.store(0, Ordering::SeqCst);
        FORMAT_CONVERT_CALLS.store(0, Ordering::SeqCst);

        let rect = tagPKRect {
            X: 0,
            Y: 0,
            Width: 2,
            Height: 2,
        };
        let mut decoder = tagPKImageDecode {
            GetPixelFormat: Some(|_pID, pPF| {
                let Some(pixel_format) = pPF else {
                    return Err(crate::WmpError::InvalidParameter);
                };
                *pixel_format = GUID_PKPixelFormat24bppRGB;
                Ok(())
            }),
            Copy: Some(|_pID, _pRect, pb, _cbStride| {
                FORMAT_COPY_CALLS.fetch_add(1, Ordering::SeqCst);
                pb[0] = 9;
                Ok(())
            }),
            ..Default::default()
        };
        let mut converter = tagPKFormatConverter {
            Convert: Some(|_pFC, _pRect, pb, _cbStride| {
                FORMAT_CONVERT_CALLS.fetch_add(1, Ordering::SeqCst);
                unsafe {
                    *pb = (*pb).wrapping_add(1);
                }
                Ok(())
            }),
            pDecoder: Some(NonNull::from(&mut decoder)),
            enPixelFormat: GUID_PKPixelFormat32bppBGR,
            ..Default::default()
        };
        let mut pixels = [0_u8; 16];
        let mut short_pixels = [0_u8; 15];

        unsafe {
            assert_eq!(
                pk_format_converter_copy(&mut converter, None, &mut pixels, 8),
                Err(crate::WmpError::InvalidParameter)
            );
            assert_eq!(
                pk_format_converter_copy(
                    &mut converter,
                    Some(&tagPKRect {
                        Width: 0,
                        Height: 1,
                        ..rect
                    }),
                    &mut pixels,
                    8,
                ),
                Err(crate::WmpError::InvalidParameter)
            );
            assert_eq!(
                pk_format_converter_copy(&mut converter, Some(&rect), &mut pixels, 7),
                Err(crate::WmpError::InvalidParameter)
            );
            assert_eq!(
                pk_format_converter_copy(&mut converter, Some(&rect), &mut short_pixels, 8),
                Err(crate::WmpError::BufferOverflow)
            );
            assert_eq!(FORMAT_COPY_CALLS.load(Ordering::SeqCst), 0);
            assert_eq!(FORMAT_CONVERT_CALLS.load(Ordering::SeqCst), 0);

            assert_eq!(
                pk_format_converter_copy(&mut converter, Some(&rect), &mut pixels, 8),
                Ok(())
            );
            assert_eq!(pixels[0], 10);
            assert_eq!(FORMAT_COPY_CALLS.load(Ordering::SeqCst), 1);
            assert_eq!(FORMAT_CONVERT_CALLS.load(Ordering::SeqCst), 1);
        }
    }

    #[test]
    fn tiny_width_expanding_converters_do_not_assert() {
        let rect = tagPKRect {
            X: 0,
            Y: 0,
            Width: 1,
            Height: 1,
        };
        let mut bgr = [4_u8, 5, 6, 0];
        let mut rgbe = [1.0f32.to_bits(), 0.5f32.to_bits(), 0.25f32.to_bits()];

        unsafe {
            assert_eq!(
                bgr24_bgr32(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    bgr.as_mut_ptr(),
                    4,
                ),
                Ok(())
            );
            assert_eq!(bgr, [4, 5, 6, 0]);

            assert_eq!(
                rgb96_float_rgbe(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    rgbe.as_mut_ptr().cast(),
                    12,
                ),
                Ok(())
            );
            let bytes = std::slice::from_raw_parts(rgbe.as_ptr().cast::<u8>(), 4);
            assert_eq!(bytes, &[128, 64, 32, 129]);
        }
    }

    #[test]
    fn fixed_to_float_converters_scale_by_twenty_four_fraction_bits() {
        let rect_one = tagPKRect {
            X: 0,
            Y: 0,
            Width: 1,
            Height: 1,
        };
        let rect_two = tagPKRect {
            X: 0,
            Y: 0,
            Width: 2,
            Height: 1,
        };
        let mut rgba = [1_i32 << 24, -(1_i32 << 23), 0, 3_i32 << 23];
        let mut rgb = [1_i32 << 24, 1_i32 << 23, -(1_i32 << 23)];
        let mut rgba_to_rgb = [
            1_i32 << 24,
            2_i32 << 24,
            3_i32 << 24,
            111,
            -(1_i32 << 24),
            0,
            1_i32 << 23,
            222,
        ];

        unsafe {
            assert_eq!(
                rgba128_fixed_rgba128_float(
                    &mut tagPKFormatConverter::default(),
                    &rect_one,
                    rgba.as_mut_ptr().cast(),
                    16,
                ),
                Ok(())
            );
            // unaligned read of packed f32 values
            let rgba_f: [f32; 4] = std::array::from_fn(|i| unsafe {
                std::ptr::read_unaligned(rgba.as_ptr().cast::<f32>().add(i))
            });
            assert_eq!(rgba_f, [1.0, -0.5, 0.0, 1.5]);

            assert_eq!(
                rgb96_fixed_rgb96_float(
                    &mut tagPKFormatConverter::default(),
                    &rect_one,
                    rgb.as_mut_ptr().cast(),
                    12,
                ),
                Ok(())
            );
            // unaligned read of packed f32 values
            let rgb_f: [f32; 3] = std::array::from_fn(|i| unsafe {
                std::ptr::read_unaligned(rgb.as_ptr().cast::<f32>().add(i))
            });
            assert_eq!(rgb_f, [1.0, 0.5, -0.5]);

            assert_eq!(
                rgb128_fixed_rgb96_float(
                    &mut tagPKFormatConverter::default(),
                    &rect_two,
                    rgba_to_rgb.as_mut_ptr().cast(),
                    32,
                ),
                Ok(())
            );
            // unaligned read of packed f32 values
            let rgb_from_rgba_f: [f32; 6] = std::array::from_fn(|i| unsafe {
                std::ptr::read_unaligned(rgba_to_rgb.as_ptr().cast::<f32>().add(i))
            });
            assert_eq!(rgb_from_rgba_f, [1.0, 2.0, 3.0, -1.0, 0.0, 0.5]);
        }
    }

    #[test]
    fn float_to_fixed_converters_scale_and_round_like_original() {
        let rect_one = tagPKRect {
            X: 0,
            Y: 0,
            Width: 1,
            Height: 1,
        };
        let mut rgba_bits = [1.0_f32, 0.5, 0.25, -0.25].map(f32::to_bits);
        let mut rgb_bits = [1.0_f32, 0.5, -0.25].map(f32::to_bits);

        unsafe {
            assert_eq!(
                rgba128_float_rgba128_fixed(
                    &mut tagPKFormatConverter::default(),
                    &rect_one,
                    rgba_bits.as_mut_ptr().cast(),
                    16,
                ),
                Ok(())
            );
            // unaligned read of packed i32 values
            let rgba_i: [i32; 4] = std::array::from_fn(|i| unsafe {
                std::ptr::read_unaligned(rgba_bits.as_ptr().cast::<i32>().add(i))
            });
            assert_eq!(rgba_i, [1 << 24, 1 << 23, 1 << 22, -4194303]);

            assert_eq!(
                rgb96_float_rgb96_fixed(
                    &mut tagPKFormatConverter::default(),
                    &rect_one,
                    rgb_bits.as_mut_ptr().cast(),
                    12,
                ),
                Ok(())
            );
            // unaligned read of packed i32 values
            let rgb_i: [i32; 3] = std::array::from_fn(|i| unsafe {
                std::ptr::read_unaligned(rgb_bits.as_ptr().cast::<i32>().add(i))
            });
            assert_eq!(rgb_i, [1 << 24, 1 << 23, -4194303]);
        }
    }

    #[test]
    fn rgb96_to_rgb128_converters_match_original_sequential_in_place_expansion() {
        let rect = tagPKRect {
            X: 0,
            Y: 0,
            Width: 3,
            Height: 1,
        };
        let mut fixed_bits = [
            1.0_f32, 0.5, 0.25, 2.0, 0.75, 0.25, 1.0, 1.5, 0.125, 99.0, 98.0, 97.0,
        ]
        .map(f32::to_bits);
        let mut float = [
            1.0_f32, 0.5, 0.25, 2.0, 0.75, 0.25, 1.0, 1.5, 0.125, 99.0, 98.0, 97.0,
        ];

        unsafe {
            assert_eq!(
                rgb96_float_rgb128_fixed(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    fixed_bits.as_mut_ptr().cast(),
                    48,
                ),
                Ok(())
            );
            // unaligned read of packed i32 values
            let fixed: [i32; 12] = std::array::from_fn(|i| unsafe {
                std::ptr::read_unaligned(fixed_bits.as_ptr().cast::<i32>().add(i))
            });
            assert_eq!(
                fixed,
                [
                    1 << 24,
                    1 << 23,
                    1 << 22,
                    0,
                    2 << 24,
                    0,
                    0,
                    0,
                    1 << 24,
                    25165824,
                    0,
                    0,
                ]
            );

            assert_eq!(
                rgb96_float_rgb128_float(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    float.as_mut_ptr().cast(),
                    48,
                ),
                Ok(())
            );
            assert_eq!(
                float,
                [1.0, 0.5, 0.25, 0.0, 2.0, 2.0, 2.0, 0.0, 1.0, 1.5, 1.0, 0.0]
            );
        }
    }

    #[test]
    fn rgb128_to_rgb96_float_and_half_converters_match_original_in_place_order() {
        let rect_float = tagPKRect {
            X: 0,
            Y: 0,
            Width: 2,
            Height: 1,
        };
        let rect_half = tagPKRect {
            X: 0,
            Y: 0,
            Width: 3,
            Height: 1,
        };
        let mut float = [1.0_f32, 2.0, 3.0, 99.0, -1.0, 0.0, 0.5, 88.0];
        let mut half_expand: [i16; 12] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 99, 98, 97];
        let mut half_contract: [i16; 12] = [1, 2, 3, 99, 4, 5, 6, 98, 7, 8, 9, 97];

        unsafe {
            assert_eq!(
                rgb128_float_rgb96_float(
                    &mut tagPKFormatConverter::default(),
                    &rect_float,
                    float.as_mut_ptr().cast(),
                    32,
                ),
                Ok(())
            );
            assert_eq!(&float[..6], &[1.0, 2.0, 3.0, -1.0, 0.0, 0.5]);

            assert_eq!(
                rgb48_half_rgb64_half(
                    &mut tagPKFormatConverter::default(),
                    &rect_half,
                    half_expand.as_mut_ptr().cast(),
                    24,
                ),
                Ok(())
            );
            assert_eq!(half_expand, [1, 2, 3, 0, 4, 4, 4, 0, 7, 8, 7, 0]);

            assert_eq!(
                rgb64_half_rgb48_half(
                    &mut tagPKFormatConverter::default(),
                    &rect_half,
                    half_contract.as_mut_ptr().cast(),
                    24,
                ),
                Ok(())
            );
            assert_eq!(&half_contract[..9], &[1, 2, 3, 4, 5, 6, 7, 8, 9]);
        }
    }

    #[test]
    fn bgr24_bgr32_and_bgr32_bgr24_match_original_in_place_order() {
        let rect_expand = tagPKRect {
            X: 0,
            Y: 0,
            Width: 3,
            Height: 1,
        };
        let rect_contract = tagPKRect {
            X: 0,
            Y: 0,
            Width: 2,
            Height: 1,
        };
        let mut expand = [1_u8, 2, 3, 4, 5, 6, 7, 8, 9, 99, 98, 97];
        let mut contract = [1_u8, 2, 3, 99, 4, 5, 6, 98, 77, 76];

        unsafe {
            assert_eq!(
                bgr24_bgr32(
                    &mut tagPKFormatConverter::default(),
                    &rect_expand,
                    expand.as_mut_ptr(),
                    12
                ),
                Ok(())
            );
            assert_eq!(expand, [1, 2, 3, 0, 4, 5, 6, 0, 7, 8, 9, 0]);

            assert_eq!(
                bgr32_bgr24(
                    &mut tagPKFormatConverter::default(),
                    &rect_contract,
                    contract.as_mut_ptr(),
                    10,
                ),
                Ok(())
            );
            assert_eq!(contract, [1, 2, 3, 4, 5, 6, 6, 98, 77, 76]);
        }
    }

    #[test]
    fn gray_fixed_and_float_converters_use_original_scales_and_order() {
        let rect_three = tagPKRect {
            X: 0,
            Y: 0,
            Width: 3,
            Height: 1,
        };
        let mut gray32_fixed = [1_i32 << 24, 1_i32 << 23, -(1_i32 << 23)];
        let mut gray32_float_bits = [1.0_f32, 0.5, -0.25].map(f32::to_bits);
        let mut gray16_fixed: [i16; 6] = [1 << 13, 1 << 12, -(1 << 12), 111, 112, 113];
        let mut gray16_float_bits = [1.0_f32, 0.5, -0.25].map(f32::to_bits);

        unsafe {
            assert_eq!(
                gray32_fixed_gray32_float(
                    &mut tagPKFormatConverter::default(),
                    &rect_three,
                    gray32_fixed.as_mut_ptr().cast(),
                    12,
                ),
                Ok(())
            );
            // unaligned read of packed f32 values
            let gray32_float: [f32; 3] = std::array::from_fn(|i| unsafe {
                std::ptr::read_unaligned(gray32_fixed.as_ptr().cast::<f32>().add(i))
            });
            assert_eq!(gray32_float, [1.0, 0.5, -0.5]);

            assert_eq!(
                gray32_float_gray32_fixed(
                    &mut tagPKFormatConverter::default(),
                    &rect_three,
                    gray32_float_bits.as_mut_ptr().cast(),
                    12,
                ),
                Ok(())
            );
            // unaligned read of packed i32 values
            let gray32_i: [i32; 3] = std::array::from_fn(|i| unsafe {
                std::ptr::read_unaligned(gray32_float_bits.as_ptr().cast::<i32>().add(i))
            });
            assert_eq!(gray32_i, [1 << 24, 1 << 23, -4194303]);

            assert_eq!(
                gray16_fixed_gray32_float(
                    &mut tagPKFormatConverter::default(),
                    &rect_three,
                    gray16_fixed.as_mut_ptr().cast(),
                    24,
                ),
                Ok(())
            );
            // unaligned read of packed f32 values
            let gray16_float: [f32; 3] = std::array::from_fn(|i| unsafe {
                std::ptr::read_unaligned(gray16_fixed.as_ptr().cast::<f32>().add(i))
            });
            assert_eq!(gray16_float, [1.0, 0.5, -0.5]);

            assert_eq!(
                gray32_float_gray16_fixed(
                    &mut tagPKFormatConverter::default(),
                    &rect_three,
                    gray16_float_bits.as_mut_ptr().cast(),
                    12,
                ),
                Ok(())
            );
            // unaligned read of packed i16 values
            let gray16_i: [i16; 6] = std::array::from_fn(|i| unsafe {
                std::ptr::read_unaligned(gray16_float_bits.as_ptr().cast::<i16>().add(i))
            });
            assert_eq!(&gray16_i[..3], &[1 << 13, 1 << 12, -2047]);
        }
    }

    #[test]
    fn rgb48_and_rgba64_fixed_float_converters_use_thirteen_fraction_bits() {
        let rect_rgb = tagPKRect {
            X: 0,
            Y: 0,
            Width: 2,
            Height: 1,
        };
        let rect_rgba = tagPKRect {
            X: 0,
            Y: 0,
            Width: 1,
            Height: 1,
        };
        let mut rgb_fixed: [i16; 12] = [
            1 << 13,
            1 << 12,
            -(1 << 12),
            2 << 12,
            3 << 12,
            1 << 11,
            101,
            102,
            103,
            104,
            105,
            106,
        ];
        let mut rgb_float_bits = [1.0_f32, 0.5, -0.25, 0.25, 1.5, 0.0].map(f32::to_bits);
        let mut rgba_fixed: [i16; 8] = [1 << 13, 1 << 12, -(1 << 12), 3 << 11, 91, 92, 93, 94];
        let mut rgba_float_bits = [1.0_f32, 0.5, -0.25, 0.75].map(f32::to_bits);

        unsafe {
            assert_eq!(
                rgb48_fixed_rgb96_float(
                    &mut tagPKFormatConverter::default(),
                    &rect_rgb,
                    rgb_fixed.as_mut_ptr().cast(),
                    48,
                ),
                Ok(())
            );
            // unaligned read of packed f32 values
            let rgb_float: [f32; 6] = std::array::from_fn(|i| unsafe {
                std::ptr::read_unaligned(rgb_fixed.as_ptr().cast::<f32>().add(i))
            });
            assert_eq!(rgb_float, [1.0, 0.5, -0.5, 1.0, 1.5, 0.25]);

            assert_eq!(
                rgb96_float_rgb48_fixed(
                    &mut tagPKFormatConverter::default(),
                    &rect_rgb,
                    rgb_float_bits.as_mut_ptr().cast(),
                    24,
                ),
                Ok(())
            );
            // unaligned read of packed i16 values
            let rgb_i: [i16; 12] = std::array::from_fn(|i| unsafe {
                std::ptr::read_unaligned(rgb_float_bits.as_ptr().cast::<i16>().add(i))
            });
            assert_eq!(&rgb_i[..6], &[1 << 13, 1 << 12, -2047, 1 << 11, 3 << 12, 0]);

            assert_eq!(
                rgba64_fixed_rgba128_float(
                    &mut tagPKFormatConverter::default(),
                    &rect_rgba,
                    rgba_fixed.as_mut_ptr().cast(),
                    32,
                ),
                Ok(())
            );
            // unaligned read of packed f32 values
            let rgba_float: [f32; 4] = std::array::from_fn(|i| unsafe {
                std::ptr::read_unaligned(rgba_fixed.as_ptr().cast::<f32>().add(i))
            });
            assert_eq!(rgba_float, [1.0, 0.5, -0.5, 0.75]);

            assert_eq!(
                rgba128_float_rgba64_fixed(
                    &mut tagPKFormatConverter::default(),
                    &rect_rgba,
                    rgba_float_bits.as_mut_ptr().cast(),
                    16,
                ),
                Ok(())
            );
            // unaligned read of packed i16 values
            let rgba_i: [i16; 8] = std::array::from_fn(|i| unsafe {
                std::ptr::read_unaligned(rgba_float_bits.as_ptr().cast::<i16>().add(i))
            });
            assert_eq!(&rgba_i[..4], &[1 << 13, 1 << 12, -2047, 3 << 11]);
        }
    }

    #[test]
    fn rgb64_fixed_and_rgb96_float_converters_drop_and_zero_alpha_like_original() {
        let rect = tagPKRect {
            X: 0,
            Y: 0,
            Width: 2,
            Height: 1,
        };
        let mut fixed: [i16; 16] = [
            1 << 13,
            1 << 12,
            -(1 << 12),
            99,
            2 << 12,
            3 << 12,
            1 << 11,
            88,
            81,
            82,
            83,
            84,
            85,
            86,
            87,
            88,
        ];
        let mut float_bits = [1.0_f32, 0.5, -0.25, 0.25, 1.5, 0.0].map(f32::to_bits);

        unsafe {
            assert_eq!(
                rgb64_fixed_rgb96_float(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    fixed.as_mut_ptr().cast(),
                    64,
                ),
                Ok(())
            );
            // unaligned read of packed f32 values
            let float: [f32; 6] = std::array::from_fn(|i| unsafe {
                std::ptr::read_unaligned(fixed.as_ptr().cast::<f32>().add(i))
            });
            assert_eq!(float, [1.0, 1.984375, 0.0, 1.0, 1.5, 0.0]);

            assert_eq!(
                rgb96_float_rgb64_fixed(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    float_bits.as_mut_ptr().cast(),
                    24,
                ),
                Ok(())
            );
            // unaligned read of packed i16 values
            let fixed_from_float: [i16; 12] = std::array::from_fn(|i| unsafe {
                std::ptr::read_unaligned(float_bits.as_ptr().cast::<i16>().add(i))
            });
            assert_eq!(
                &fixed_from_float[..8],
                &[1 << 13, 1 << 12, -2047, 0, 1 << 11, 3 << 12, 0, 0]
            );
        }
    }

    #[test]
    fn rgbe_rgb96_float_decodes_with_original_in_place_overwrite_order() {
        let rect = tagPKRect {
            X: 0,
            Y: 0,
            Width: 2,
            Height: 1,
        };
        let mut data = [
            128_u8, 64, 32, 137, 9, 8, 7, 0, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102,
            103, 104, 105, 106,
        ];

        unsafe {
            assert_eq!(
                rgbe_rgb96_float(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    data.as_mut_ptr(),
                    24
                ),
                Ok(())
            );
            // unaligned read of packed f32 values
            let float: [f32; 6] = std::array::from_fn(|i| unsafe {
                std::ptr::read_unaligned(data.as_ptr().cast::<f32>().add(i))
            });
            assert_eq!(float, [256.0, 0.0, 256.0, 0.0, 0.0, 0.0]);
        }
    }

    #[test]
    fn rgb96_float_rgbe_clamps_negative_values_and_uses_no_rounding() {
        let rect = tagPKRect {
            X: 0,
            Y: 0,
            Width: 3,
            Height: 1,
        };
        let mut data = [
            1.0_f32, 0.5, 0.25, -1.0, 0.0, 0.0, 256.0, 128.0, 64.0, 91.0, 92.0, 93.0,
        ];

        unsafe {
            assert_eq!(
                rgb96_float_rgbe(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    data.as_mut_ptr().cast(),
                    48
                ),
                Ok(())
            );
            let bytes = std::slice::from_raw_parts(data.as_ptr().cast::<u8>(), 12);
            assert_eq!(bytes, &[128, 64, 32, 129, 0, 0, 0, 0, 128, 64, 32, 137]);
        }
    }

    #[test]
    fn rgba_and_rgb48_half_converters_use_scalar_half_rules() {
        let rect_one = tagPKRect {
            X: 0,
            Y: 0,
            Width: 1,
            Height: 1,
        };
        let rect_rgb = tagPKRect {
            X: 0,
            Y: 0,
            Width: 2,
            Height: 1,
        };
        let mut rgba_half: [i16; 8] = [0x3c00, 0x4000, 0xbc00u16 as i16, 0x0000, 91, 92, 93, 94];
        let mut rgba_float_bits = [1.0_f32, -2.0, 0.0, HLF_MAX * 2.0].map(f32::to_bits);
        let mut rgb_half: [i16; 12] = [
            0x3c00,
            0x4000,
            0xbc00u16 as i16,
            0x0000,
            0x3800,
            0x4200,
            101,
            102,
            103,
            104,
            105,
            106,
        ];
        let mut rgb_float_bits = [1.0_f32, -2.0, 0.0, 0.5, HLF_MAX * 2.0, -0.0].map(f32::to_bits);

        unsafe {
            assert_eq!(
                rgba64_half_rgba128_float(
                    &mut tagPKFormatConverter::default(),
                    &rect_one,
                    rgba_half.as_mut_ptr().cast(),
                    32,
                ),
                Ok(())
            );
            // unaligned read of packed f32 values
            let rgba_float: [f32; 4] = std::array::from_fn(|i| unsafe {
                std::ptr::read_unaligned(rgba_half.as_ptr().cast::<f32>().add(i))
            });
            assert_eq!(rgba_float, [1.0, 2.0, -1.0, 0.0]);

            assert_eq!(
                rgba128_float_rgba64_half(
                    &mut tagPKFormatConverter::default(),
                    &rect_one,
                    rgba_float_bits.as_mut_ptr().cast(),
                    16,
                ),
                Ok(())
            );
            // unaligned read of packed u16 values
            let rgba_i: [u16; 8] = std::array::from_fn(|i| unsafe {
                std::ptr::read_unaligned(rgba_float_bits.as_ptr().cast::<u16>().add(i))
            });
            assert_eq!(&rgba_i[..4], &[0x3c00, 0xc000, 0x0000, HLF_MAX_BITS]);

            assert_eq!(
                rgb48_half_rgb96_float(
                    &mut tagPKFormatConverter::default(),
                    &rect_rgb,
                    rgb_half.as_mut_ptr().cast(),
                    48,
                ),
                Ok(())
            );
            // unaligned read of packed f32 values
            let rgb_float: [f32; 6] = std::array::from_fn(|i| unsafe {
                std::ptr::read_unaligned(rgb_half.as_ptr().cast::<f32>().add(i))
            });
            assert_eq!(rgb_float, [1.0, 2.0, -1.0, 0.0, 0.5, 3.0]);

            assert_eq!(
                rgb96_float_rgb48_half(
                    &mut tagPKFormatConverter::default(),
                    &rect_rgb,
                    rgb_float_bits.as_mut_ptr().cast(),
                    24,
                ),
                Ok(())
            );
            // unaligned read of packed u16 values
            let rgb_i: [u16; 12] = std::array::from_fn(|i| unsafe {
                std::ptr::read_unaligned(rgb_float_bits.as_ptr().cast::<u16>().add(i))
            });
            assert_eq!(
                &rgb_i[..6],
                &[0x3c00, 0xc000, 0x0000, 0x3800, HLF_MAX_BITS, 0x8000]
            );
        }
    }

    #[test]
    fn rgb64_and_gray_half_converters_match_original_in_place_order() {
        let rect_one = tagPKRect {
            X: 0,
            Y: 0,
            Width: 1,
            Height: 1,
        };
        let mut rgb64_half: [i16; 8] = [0x3c00, 0x4000, 0x4200, 99, 91, 92, 93, 94];
        let mut rgb64_float_bits = [1.0_f32, -2.0, 0.5].map(f32::to_bits);
        let mut gray_half: [i16; 4] = [0x3c00, 0x4000, 91, 92];
        let mut gray_float_bits = [1.0_f32, -2.0].map(f32::to_bits);

        unsafe {
            assert_eq!(
                rgb64_half_rgb96_float(
                    &mut tagPKFormatConverter::default(),
                    &rect_one,
                    rgb64_half.as_mut_ptr().cast(),
                    32,
                ),
                Ok(())
            );
            // unaligned read of packed f32 values
            let rgb_float: [f32; 3] = std::array::from_fn(|i| unsafe {
                std::ptr::read_unaligned(rgb64_half.as_ptr().cast::<f32>().add(i))
            });
            assert_eq!(rgb_float, [1.0, 1.875, 0.0]);

            assert_eq!(
                rgb96_float_rgb64_half(
                    &mut tagPKFormatConverter::default(),
                    &rect_one,
                    rgb64_float_bits.as_mut_ptr().cast(),
                    12,
                ),
                Ok(())
            );
            // unaligned read of packed u16 values
            let rgb_i: [u16; 6] = std::array::from_fn(|i| unsafe {
                std::ptr::read_unaligned(rgb64_float_bits.as_ptr().cast::<u16>().add(i))
            });
            assert_eq!(&rgb_i[..4], &[0x3c00, 0xc000, 0x3800, 0x0000]);

            assert_eq!(
                gray16_half_gray32_float(
                    &mut tagPKFormatConverter::default(),
                    &rect_one,
                    gray_half.as_mut_ptr().cast(),
                    16,
                ),
                Ok(())
            );
            // unaligned read of packed f32 values
            let gray_float: [f32; 1] = std::array::from_fn(|i| unsafe {
                std::ptr::read_unaligned(gray_half.as_ptr().cast::<f32>().add(i))
            });
            assert_eq!(gray_float, [1.0]);

            assert_eq!(
                gray32_float_gray16_half(
                    &mut tagPKFormatConverter::default(),
                    &rect_one,
                    gray_float_bits.as_mut_ptr().cast(),
                    8,
                ),
                Ok(())
            );
            // unaligned read of packed u16 values
            let gray_i: [u16; 4] = std::array::from_fn(|i| unsafe {
                std::ptr::read_unaligned(gray_float_bits.as_ptr().cast::<u16>().add(i))
            });
            assert_eq!(gray_i[0], 0x3c00);
        }
    }

    #[test]
    fn packed_rgb555_and_rgb565_converters_match_original_bit_layouts() {
        let rect = tagPKRect {
            X: 0,
            Y: 0,
            Width: 1,
            Height: 1,
        };
        let mut rgb555 = [((17_u16 << 10) | (9 << 5) | 3), 0, 0];
        let mut rgb565 = [((17_u16 << 11) | (41 << 5) | 3), 0, 0];
        let mut rgb_to_555 = [0xf8_u8, 0x80, 0x18, 0, 0, 0];
        let mut rgb_to_565 = [0xf8_u8, 0x84, 0x18, 0, 0, 0];

        unsafe {
            assert_eq!(
                rgb555_rgb24(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    rgb555.as_mut_ptr().cast(),
                    6
                ),
                Ok(())
            );
            assert_eq!(
                std::slice::from_raw_parts(rgb555.as_ptr().cast::<u8>(), 3),
                &[136, 72, 24]
            );

            assert_eq!(
                rgb565_rgb24(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    rgb565.as_mut_ptr().cast(),
                    6
                ),
                Ok(())
            );
            assert_eq!(
                std::slice::from_raw_parts(rgb565.as_ptr().cast::<u8>(), 3),
                &[136, 164, 24]
            );

            assert_eq!(
                rgb24_rgb555(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    rgb_to_555.as_mut_ptr(),
                    6
                ),
                Ok(())
            );
            // rgb_to_555 is `[u8; 6]` (1-byte aligned); read the packed u16 without an
            // alignment requirement rather than via a 2-byte-aligned slice.
            assert_eq!(
                std::ptr::read_unaligned(rgb_to_555.as_ptr().cast::<u16>()),
                0x7e03
            );

            assert_eq!(
                rgb24_rgb565(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    rgb_to_565.as_mut_ptr(),
                    6
                ),
                Ok(())
            );
            // rgb_to_565 is `[u8; 6]` (1-byte aligned); read the packed u16 without an
            // alignment requirement rather than via a 2-byte-aligned slice.
            assert_eq!(
                std::ptr::read_unaligned(rgb_to_565.as_ptr().cast::<u16>()),
                0xfc23
            );
        }
    }

    #[test]
    fn packed_rgb101010_converters_match_original_bit_layouts() {
        let rect = tagPKRect {
            X: 0,
            Y: 0,
            Width: 1,
            Height: 1,
        };
        let packed = (3_u32 << 30) | (0x155 << 20) | (0x2aa << 10) | 0x03f;
        let mut rgb101010 = [packed, 0, 0];
        let mut rgb48: [u16; 6] = [0xffc0, 0x8040, 0x0100, 0, 0, 0];

        unsafe {
            assert_eq!(
                rgb101010_rgb48(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    rgb101010.as_mut_ptr().cast(),
                    12,
                ),
                Ok(())
            );
            // unaligned read of packed u16 values
            let rgb101010_u16: [u16; 3] = std::array::from_fn(|i| unsafe {
                std::ptr::read_unaligned(rgb101010.as_ptr().cast::<u16>().add(i))
            });
            assert_eq!(rgb101010_u16, [0x5540, 0xaa80, 0x0fc0]);

            assert_eq!(
                rgb48_rgb101010(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    rgb48.as_mut_ptr().cast(),
                    12
                ),
                Ok(())
            );
            // rgb48 is `[u16; 6]` (2-byte aligned); read the packed u32 result without an
            // alignment requirement rather than via a 4-byte-aligned slice.
            assert_eq!(
                std::ptr::read_unaligned(rgb48.as_ptr().cast::<u32>()),
                0xfff8_0404
            );
        }
    }

    #[test]
    fn rgba32_bgra32_and_wrapper_swap_red_blue_per_pixel() {
        let rect = tagPKRect {
            X: 0,
            Y: 0,
            Width: 2,
            Height: 1,
        };
        let mut direct = [1_u8, 2, 3, 4, 5, 6, 7, 8];
        let mut wrapper = [9_u8, 10, 11, 12, 13, 14, 15, 16];

        unsafe {
            assert_eq!(
                rgba32_bgra32(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    direct.as_mut_ptr(),
                    8
                ),
                Ok(())
            );
            assert_eq!(direct, [3, 2, 1, 4, 7, 6, 5, 8]);

            assert_eq!(
                bgra32_rgba32(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    wrapper.as_mut_ptr(),
                    8
                ),
                Ok(())
            );
            assert_eq!(wrapper, [11, 10, 9, 12, 15, 14, 13, 16]);
        }
    }

    #[test]
    fn black_white_gray8_expands_bits_and_respects_inversion_flag() {
        let rect = tagPKRect {
            X: 0,
            Y: 0,
            Width: 10,
            Height: 1,
        };
        let mut decoder = tagPKImageDecode {
            Initialize: None,
            GetPixelFormat: None,
            GetSize: None,
            GetResolution: None,
            GetColorContext: None,
            GetDescriptiveMetadata: None,
            GetRawStream: None,
            Copy: None,
            GetFrameCount: None,
            SelectFrame: None,
            pStream: None,
            pStreamMemory: None,
            offStart: 0,
            guidPixFormat: GUID_PKPixelFormatDontCare,
            uWidth: 0,
            uHeight: 0,
            idxCurrentLine: 0,
            fResX: 0.0,
            fResY: 0.0,
            cFrame: 0,
            WMP: tagPKImageDecodeWMP {
                wmiSCP: tagWmpStrCodecParam {
                    bBlackWhite: 0,
                    ..Default::default()
                },
                ..Default::default()
            },
        };
        let mut converter = tagPKFormatConverter {
            Initialize: None,
            InitializeConvert: None,
            GetPixelFormat: None,
            GetSourcePixelFormat: None,
            GetSize: None,
            GetResolution: None,
            Copy: None,
            Convert: None,
            pDecoder: Some(NonNull::from(&mut decoder)),
            enPixelFormat: GUID_PKPixelFormatDontCare,
        };
        let mut normal = [0b1010_0101_u8, 0b0100_0000, 0, 0, 0, 0, 0, 0, 0, 0];
        let mut inverted = normal;

        unsafe {
            assert_eq!(
                black_white_gray8(&mut converter, &rect, normal.as_mut_ptr(), 10),
                Ok(())
            );
            assert_eq!(
                normal,
                [0xff, 0x00, 0xff, 0x00, 0x00, 0xff, 0x00, 0xff, 0x00, 0xff]
            );

            (*converter
                .pDecoder
                .expect("converter has a decoder")
                .as_ptr())
            .WMP
            .wmiSCP
            .bBlackWhite = 1;
            assert_eq!(
                black_white_gray8(&mut converter, &rect, inverted.as_mut_ptr(), 10),
                Ok(())
            );
            assert_eq!(
                inverted,
                [0x00, 0xff, 0x00, 0xff, 0xff, 0x00, 0xff, 0x00, 0xff, 0x00]
            );
        }
    }

    #[test]
    fn gray16_rgb48_and_rgba64_downconvert_by_high_byte() {
        let rect_gray = tagPKRect {
            X: 0,
            Y: 0,
            Width: 3,
            Height: 1,
        };
        let rect_rgb = tagPKRect {
            X: 0,
            Y: 0,
            Width: 2,
            Height: 1,
        };
        let rect_rgba = tagPKRect {
            X: 0,
            Y: 0,
            Width: 1,
            Height: 1,
        };
        let mut gray: [u16; 4] = [0x1200, 0xabcd, 0x00ff, 0x7777];
        let mut rgb: [u16; 8] = [
            0x1200, 0x3400, 0x5600, 0xabcd, 0x0100, 0xff00, 0x7777, 0x8888,
        ];
        let mut rgba: [u16; 4] = [0x1200, 0x3400, 0x5600, 0xabcd];

        unsafe {
            assert_eq!(
                gray16_gray8(
                    &mut tagPKFormatConverter::default(),
                    &rect_gray,
                    gray.as_mut_ptr().cast(),
                    8
                ),
                Ok(())
            );
            assert_eq!(
                std::slice::from_raw_parts(gray.as_ptr().cast::<u8>(), 3),
                &[0x12, 0xab, 0x00]
            );

            assert_eq!(
                rgb48_rgb24(
                    &mut tagPKFormatConverter::default(),
                    &rect_rgb,
                    rgb.as_mut_ptr().cast(),
                    16
                ),
                Ok(())
            );
            assert_eq!(
                std::slice::from_raw_parts(rgb.as_ptr().cast::<u8>(), 6),
                &[0x12, 0x34, 0x56, 0xab, 0x01, 0xff]
            );

            assert_eq!(
                rgba64_rgba32(
                    &mut tagPKFormatConverter::default(),
                    &rect_rgba,
                    rgba.as_mut_ptr().cast(),
                    8
                ),
                Ok(())
            );
            assert_eq!(
                std::slice::from_raw_parts(rgba.as_ptr().cast::<u8>(), 4),
                &[0x12, 0x34, 0x56, 0xab]
            );
        }
    }

    #[test]
    fn float_downconverters_use_scalar_u8_rules_and_drop_alpha_lanes() {
        let rect_gray = tagPKRect {
            X: 0,
            Y: 0,
            Width: 3,
            Height: 1,
        };
        let rect_rgb = tagPKRect {
            X: 0,
            Y: 0,
            Width: 2,
            Height: 1,
        };
        let mut gray: [f32; 4] = [-0.25, 0.0, 1.0, 0.5];
        let mut rgb96: [f32; 8] = [0.0, 1.0, 2.0, -1.0, 0.0, 1.0, 0.25, 0.5];
        let mut rgb128: [f32; 8] = [0.0, 1.0, 2.0, 99.0, -1.0, 0.0, 1.0, 77.0];

        unsafe {
            assert_eq!(
                gray32_float_gray8(
                    &mut tagPKFormatConverter::default(),
                    &rect_gray,
                    gray.as_mut_ptr().cast(),
                    16
                ),
                Ok(())
            );
            assert_eq!(
                std::slice::from_raw_parts(gray.as_ptr().cast::<u8>(), 3),
                &[0x00, 0x00, 0xff]
            );

            assert_eq!(
                rgb96_float_rgb24(
                    &mut tagPKFormatConverter::default(),
                    &rect_rgb,
                    rgb96.as_mut_ptr().cast(),
                    32
                ),
                Ok(())
            );
            assert_eq!(
                std::slice::from_raw_parts(rgb96.as_ptr().cast::<u8>(), 6),
                &[0x00, 0xff, 0xff, 0x00, 0x00, 0xff]
            );

            assert_eq!(
                rgb128_float_rgb24(
                    &mut tagPKFormatConverter::default(),
                    &rect_rgb,
                    rgb128.as_mut_ptr().cast(),
                    32
                ),
                Ok(())
            );
            assert_eq!(
                std::slice::from_raw_parts(rgb128.as_ptr().cast::<u8>(), 6),
                &[0x00, 0xff, 0xff, 0x00, 0x00, 0xff]
            );
        }
    }

    #[test]
    fn rgba_float_and_fixed_gray_downconverters_use_original_scales() {
        let rect_rgba = tagPKRect {
            X: 0,
            Y: 0,
            Width: 1,
            Height: 1,
        };
        let rect_gray = tagPKRect {
            X: 0,
            Y: 0,
            Width: 3,
            Height: 1,
        };
        let mut rgba: [f32; 4] = [0.0, 1.0, 2.0, 0.5];
        let mut gray16: [i16; 4] = [-1, 0, 8192, 1234];
        let mut gray32: [i32; 4] = [-1, 0, 16_777_216, 1234];

        unsafe {
            assert_eq!(
                rgba128_float_rgba32(
                    &mut tagPKFormatConverter::default(),
                    &rect_rgba,
                    rgba.as_mut_ptr().cast(),
                    16
                ),
                Ok(())
            );
            assert_eq!(
                std::slice::from_raw_parts(rgba.as_ptr().cast::<u8>(), 4),
                &[0x00, 0xff, 0xff, 0x80]
            );

            assert_eq!(
                gray16_fixed_gray8(
                    &mut tagPKFormatConverter::default(),
                    &rect_gray,
                    gray16.as_mut_ptr().cast(),
                    8
                ),
                Ok(())
            );
            assert_eq!(
                std::slice::from_raw_parts(gray16.as_ptr().cast::<u8>(), 3),
                &[0x00, 0x00, 0xff]
            );

            assert_eq!(
                gray32_fixed_gray8(
                    &mut tagPKFormatConverter::default(),
                    &rect_gray,
                    gray32.as_mut_ptr().cast(),
                    16
                ),
                Ok(())
            );
            assert_eq!(
                std::slice::from_raw_parts(gray32.as_ptr().cast::<u8>(), 3),
                &[0x00, 0x00, 0xff]
            );
        }
    }

    #[test]
    fn fixed_rgb_downconverters_scale_and_ignore_alpha_source_lanes() {
        let rect = tagPKRect {
            X: 0,
            Y: 0,
            Width: 2,
            Height: 1,
        };
        let mut rgb48: [i16; 8] = [-1, 0, 8192, 8192, 16384, 4096, 1234, 5678];
        let mut rgb64: [i16; 8] = [-1, 0, 8192, 30000, 8192, 16384, 4096, -30000];
        let mut rgb96: [i32; 8] = [
            -1, 0, 16_777_216, 16_777_216, 33_554_432, 8_388_608, 1234, 5678,
        ];
        let mut rgb128: [i32; 8] = [
            -1,
            0,
            16_777_216,
            99_999_999,
            16_777_216,
            33_554_432,
            8_388_608,
            -99_999_999,
        ];

        unsafe {
            assert_eq!(
                rgb48_fixed_rgb24(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    rgb48.as_mut_ptr().cast(),
                    16
                ),
                Ok(())
            );
            assert_eq!(
                std::slice::from_raw_parts(rgb48.as_ptr().cast::<u8>(), 6),
                &[0x00, 0x00, 0xff, 0xff, 0xff, 0xbc]
            );

            assert_eq!(
                rgb64_fixed_rgb24(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    rgb64.as_mut_ptr().cast(),
                    16
                ),
                Ok(())
            );
            assert_eq!(
                std::slice::from_raw_parts(rgb64.as_ptr().cast::<u8>(), 6),
                &[0x00, 0x00, 0xff, 0xff, 0xff, 0xbc]
            );

            assert_eq!(
                rgb96_fixed_rgb24(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    rgb96.as_mut_ptr().cast(),
                    32
                ),
                Ok(())
            );
            assert_eq!(
                std::slice::from_raw_parts(rgb96.as_ptr().cast::<u8>(), 6),
                &[0x00, 0x00, 0xff, 0xff, 0xff, 0xbc]
            );

            assert_eq!(
                rgb128_fixed_rgb24(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    rgb128.as_mut_ptr().cast(),
                    32
                ),
                Ok(())
            );
            assert_eq!(
                std::slice::from_raw_parts(rgb128.as_ptr().cast::<u8>(), 6),
                &[0x00, 0x00, 0xff, 0xff, 0xff, 0xbc]
            );
        }
    }

    #[test]
    fn fixed_rgba_downconverters_use_alpha_linear_scale() {
        let rect = tagPKRect {
            X: 0,
            Y: 0,
            Width: 1,
            Height: 1,
        };
        let mut rgba64: [i16; 4] = [-1, 0, 8192, 4096];
        let mut rgba128: [i32; 4] = [-1, 0, 16_777_216, 8_388_608];

        unsafe {
            assert_eq!(
                rgba64_fixed_rgba32(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    rgba64.as_mut_ptr().cast(),
                    8
                ),
                Ok(())
            );
            assert_eq!(
                std::slice::from_raw_parts(rgba64.as_ptr().cast::<u8>(), 4),
                &[0x00, 0x00, 0xff, 0x80]
            );

            assert_eq!(
                rgba128_fixed_rgba32(
                    &mut tagPKFormatConverter::default(),
                    &rect,
                    rgba128.as_mut_ptr().cast(),
                    16
                ),
                Ok(())
            );
            assert_eq!(
                std::slice::from_raw_parts(rgba128.as_ptr().cast::<u8>(), 4),
                &[0x00, 0x00, 0xff, 0x80]
            );
        }
    }

    #[test]
    fn half_downconverters_use_scalar_half_and_u8_rules() {
        let rect_gray = tagPKRect {
            X: 0,
            Y: 0,
            Width: 3,
            Height: 1,
        };
        let rect_rgb = tagPKRect {
            X: 0,
            Y: 0,
            Width: 2,
            Height: 1,
        };
        let rect_rgba = tagPKRect {
            X: 0,
            Y: 0,
            Width: 1,
            Height: 1,
        };
        let mut gray: [u16; 4] = [0xbc00, 0x0000, 0x3c00, 0x3800];
        let mut rgb48: [u16; 8] = [0x0000, 0x3c00, 0x3800, 0xbc00, 0x0000, 0x3c00, 91, 92];
        let mut rgb64: [u16; 8] = [
            0x0000, 0x3c00, 0x3800, 0x7bff, 0xbc00, 0x0000, 0x3c00, 0x7bff,
        ];
        let mut rgba: [u16; 4] = [0xbc00, 0x0000, 0x3c00, 0x3800];

        unsafe {
            assert_eq!(
                gray16_half_gray8(
                    &mut tagPKFormatConverter::default(),
                    &rect_gray,
                    gray.as_mut_ptr().cast(),
                    8
                ),
                Ok(())
            );
            assert_eq!(
                std::slice::from_raw_parts(gray.as_ptr().cast::<u8>(), 3),
                &[0x00, 0x00, 0xff]
            );

            assert_eq!(
                rgb48_half_rgb24(
                    &mut tagPKFormatConverter::default(),
                    &rect_rgb,
                    rgb48.as_mut_ptr().cast(),
                    16
                ),
                Ok(())
            );
            assert_eq!(
                std::slice::from_raw_parts(rgb48.as_ptr().cast::<u8>(), 6),
                &[0x00, 0xff, 0xbc, 0x00, 0x00, 0xff]
            );

            assert_eq!(
                rgb64_half_rgb24(
                    &mut tagPKFormatConverter::default(),
                    &rect_rgb,
                    rgb64.as_mut_ptr().cast(),
                    16
                ),
                Ok(())
            );
            assert_eq!(
                std::slice::from_raw_parts(rgb64.as_ptr().cast::<u8>(), 6),
                &[0x00, 0xff, 0xbc, 0x00, 0x00, 0xff]
            );

            assert_eq!(
                rgba64_half_rgba32(
                    &mut tagPKFormatConverter::default(),
                    &rect_rgba,
                    rgba.as_mut_ptr().cast(),
                    8
                ),
                Ok(())
            );
            assert_eq!(
                std::slice::from_raw_parts(rgba.as_ptr().cast::<u8>(), 4),
                &[0x00, 0x00, 0xff, 0x80]
            );
        }
    }

    #[test]
    fn packed_rgb101010_and_rgbe_downconvert_to_rgb24() {
        let rect_packed = tagPKRect {
            X: 0,
            Y: 0,
            Width: 1,
            Height: 1,
        };
        let rect_rgbe = tagPKRect {
            X: 0,
            Y: 0,
            Width: 2,
            Height: 1,
        };
        let mut packed = [(3_u32 << 30) | (0x3ff << 20) | (0x200 << 10) | 0x004, 0];
        let mut rgbe = [128_u8, 64, 0, 128, 255, 255, 255, 0];

        unsafe {
            assert_eq!(
                rgb101010_rgb24(
                    &mut tagPKFormatConverter::default(),
                    &rect_packed,
                    packed.as_mut_ptr().cast(),
                    8
                ),
                Ok(())
            );
            assert_eq!(
                std::slice::from_raw_parts(packed.as_ptr().cast::<u8>(), 3),
                &[0xff, 0x80, 0x01]
            );

            assert_eq!(
                rgbe_rgb24(
                    &mut tagPKFormatConverter::default(),
                    &rect_rgbe,
                    rgbe.as_mut_ptr(),
                    8
                ),
                Ok(())
            );
            assert_eq!(&rgbe[..6], &[0xbc, 0x89, 0x00, 0x00, 0x00, 0x00]);
        }
    }

    #[test]
    fn format_converter_initialize_convert_uses_table_and_extension_remaps() {
        let mut converter = tagPKFormatConverter {
            Initialize: None,
            InitializeConvert: None,
            GetPixelFormat: None,
            GetSourcePixelFormat: None,
            GetSize: None,
            GetResolution: None,
            Copy: None,
            Convert: Some(pk_format_converter_convert),
            pDecoder: None,
            enPixelFormat: GUID_PKPixelFormatDontCare,
        };
        let bmp = b".bmp\0";
        let tif = b".tif\0";

        unsafe {
            assert_eq!(
                pk_format_converter_initialize_convert(
                    &mut converter,
                    GUID_PKPixelFormat24bppRGB,
                    bmp.as_ptr(),
                    GUID_PKPixelFormat24bppRGB,
                ),
                Ok(())
            );
            assert_eq!(
                converter.Convert.expect("Convert callback is present") as usize,
                rgb24_bgr24 as usize
            );
            assert!(is_equal_guid(
                &converter.enPixelFormat,
                &GUID_PKPixelFormat24bppRGB
            ));

            converter.Convert = Some(pk_format_converter_convert);
            assert_eq!(
                pk_format_converter_initialize_convert(
                    &mut converter,
                    GUID_PKPixelFormat32bppRGBA,
                    tif.as_ptr(),
                    GUID_PKPixelFormat32bppBGRA,
                ),
                Ok(())
            );
            assert_eq!(
                converter.Convert.expect("Convert callback is present") as usize,
                pk_format_converter_convert as usize
            );
            assert!(is_equal_guid(
                &converter.enPixelFormat,
                &GUID_PKPixelFormat32bppBGRA
            ));
        }
    }

    #[test]
    fn format_converter_initialize_convert_allows_noop_pairs_and_rejects_unknown_pairs() {
        let mut converter = tagPKFormatConverter {
            Initialize: None,
            InitializeConvert: None,
            GetPixelFormat: None,
            GetSourcePixelFormat: None,
            GetSize: None,
            GetResolution: None,
            Copy: None,
            Convert: Some(pk_format_converter_convert),
            pDecoder: None,
            enPixelFormat: GUID_PKPixelFormatDontCare,
        };

        unsafe {
            assert_eq!(
                pk_format_converter_initialize_convert(
                    &mut converter,
                    GUID_PKPixelFormat128bppRGBFloat,
                    std::ptr::null(),
                    GUID_PKPixelFormat128bppRGBAFloat,
                ),
                Ok(())
            );
            assert_eq!(
                converter.Convert.expect("Convert callback is present") as usize,
                pk_format_converter_convert as usize
            );

            assert_eq!(
                pk_format_converter_initialize_convert(
                    &mut converter,
                    GUID_PKPixelFormat8bppGray,
                    std::ptr::null(),
                    GUID_PKPixelFormat16bppRGB555,
                ),
                Err(crate::WmpError::UnsupportedFormat)
            );
        }
    }

    #[test]
    fn format_converter_initialize_gets_source_format_and_sets_decoder_after_success() {
        let mut decoder = tagPKImageDecode {
            Initialize: None,
            GetPixelFormat: Some(|_pID, pPF| {
                let Some(pixel_format) = pPF else {
                    return Err(crate::WmpError::InvalidParameter);
                };
                *pixel_format = GUID_PKPixelFormat24bppRGB;
                Ok(())
            }),
            GetSize: None,
            GetResolution: None,
            GetColorContext: None,
            GetDescriptiveMetadata: None,
            GetRawStream: None,
            Copy: None,
            GetFrameCount: None,
            SelectFrame: None,
            pStream: None,
            pStreamMemory: None,
            offStart: 0,
            guidPixFormat: GUID_PKPixelFormatDontCare,
            uWidth: 0,
            uHeight: 0,
            idxCurrentLine: 0,
            fResX: 0.0,
            fResY: 0.0,
            cFrame: 0,
            WMP: tagPKImageDecodeWMP::default(),
        };
        let mut converter = tagPKFormatConverter {
            Initialize: None,
            InitializeConvert: None,
            GetPixelFormat: None,
            GetSourcePixelFormat: None,
            GetSize: None,
            GetResolution: None,
            Copy: None,
            Convert: Some(pk_format_converter_convert),
            pDecoder: None,
            enPixelFormat: GUID_PKPixelFormatDontCare,
        };

        unsafe {
            assert_eq!(
                pk_format_converter_initialize(
                    &mut converter,
                    &mut decoder,
                    std::ptr::null(),
                    GUID_PKPixelFormat24bppBGR,
                ),
                Ok(())
            );
            assert_eq!(
                converter.pDecoder.map(|decoder| decoder.as_ptr()),
                Some(&mut decoder as *mut tagPKImageDecode)
            );
            assert_eq!(
                converter.Convert.expect("Convert callback is present") as usize,
                rgb24_bgr24 as usize
            );
        }
    }

    #[test]
    fn format_converter_enum_conversions_returns_targets_in_table_order() {
        let mut target: *const PKPixelFormatGUID = std::ptr::null();

        unsafe {
            assert_eq!(
                pk_format_converter_enum_conversions(&GUID_PKPixelFormat24bppRGB, 0, &mut target),
                Ok(())
            );
            assert!(is_equal_guid(&*target, &GUID_PKPixelFormat24bppBGR));

            assert_eq!(
                pk_format_converter_enum_conversions(&GUID_PKPixelFormat24bppRGB, 1, &mut target),
                Ok(())
            );
            assert!(is_equal_guid(&*target, &GUID_PKPixelFormat32bppBGR));

            assert_eq!(
                pk_format_converter_enum_conversions(&GUID_PKPixelFormat48bppRGB, 99, &mut target),
                Err(crate::WmpError::IndexNotFound)
            );
            assert!(is_equal_guid(&*target, &GUID_PKPixelFormatDontCare));
        }
    }
}
